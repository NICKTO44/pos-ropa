
use rusqlite::OptionalExtension;
use crate::database::DatabasePool;
use rusqlite::params;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct VentaParaDevolucion {
    pub venta_id: i32,
    pub folio: String,
    pub fecha_hora: String,
    pub total: f64,
    pub metodo_pago: String,
    pub productos: Vec<ProductoVentaDetalle>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProductoVentaDetalle {
    pub producto_id: i32,
    pub nombre: String,
    pub cantidad: i32,
    pub precio_unitario: f64,
    pub subtotal: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProductoDevolver {
    pub producto_id: i32,
    pub cantidad: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DevolucionResponse {
    pub success: bool,
    pub message: String,
    pub folio_devolucion: Option<String>,
}

// Comando: Buscar venta por folio para devolución
#[tauri::command]
pub fn buscar_venta_para_devolucion(
    db: tauri::State<DatabasePool>,
    folio: String,
) -> Result<VentaParaDevolucion, String> {
    let conn = db.get_conn();

    // Obtener datos de la venta
    let query_venta = r"
        SELECT id, folio, strftime('%Y-%m-%d %H:%M:%S', fecha_hora) as fecha_hora, total, metodo_pago
        FROM ventas
        WHERE folio = ? AND estado = 'COMPLETADA'
    ";

    let mut stmt_venta = conn
        .prepare(query_venta)
        .map_err(|e| format!("Error al preparar consulta: {}", e))?;

    let venta = stmt_venta
        .query_row([&folio], |row| {
            Ok((
                row.get::<_, i32>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, f64>(3)?,
                row.get::<_, String>(4)?,
            ))
        })
        .optional()
        .map_err(|e| format!("Error al buscar venta: {}", e))?;

    let (venta_id, folio, fecha_hora, total, metodo_pago) = match venta {
        Some(v) => v,
        None => return Err("Venta no encontrada o no completada".to_string()),
    };

    // Obtener productos de la venta
    let query_productos = r"
        SELECT 
            dv.producto_id,
            p.nombre,
            dv.cantidad,
            dv.precio_unitario,
            dv.total_linea
        FROM detalles_venta dv
        JOIN productos p ON dv.producto_id = p.id
        WHERE dv.venta_id = ?
    ";

    let mut stmt_productos = conn
        .prepare(query_productos)
        .map_err(|e| format!("Error al preparar consulta de productos: {}", e))?;

    let productos_iter = stmt_productos
        .query_map([venta_id], |row| {
            Ok(ProductoVentaDetalle {
                producto_id: row.get(0)?,
                nombre: row.get(1)?,
                cantidad: row.get(2)?,
                precio_unitario: row.get(3)?,
                subtotal: row.get(4)?,
            })
        })
        .map_err(|e| format!("Error al obtener productos: {}", e))?;

    let productos_detalle: Vec<ProductoVentaDetalle> = productos_iter
        .filter_map(|r| r.ok())
        .collect();

    Ok(VentaParaDevolucion {
        venta_id,
        folio,
        fecha_hora,
        total,
        metodo_pago,
        productos: productos_detalle,
    })
}

// Comando: Procesar devolución
#[tauri::command]
pub fn procesar_devolucion(
    db: tauri::State<DatabasePool>,
    #[allow(non_snake_case)]
    ventaId: i32,
    #[allow(non_snake_case)]
    folioVenta: String,
    productos: Vec<ProductoDevolver>,
    motivo: String,
    #[allow(non_snake_case)]
    usuarioId: i32,
) -> Result<DevolucionResponse, String> {
    let mut conn = db.get_conn();

    // Iniciar transacción
    conn.execute("BEGIN TRANSACTION", [])
        .map_err(|e| format!("Error al iniciar transacción: {}", e))?;

    // Función auxiliar para rollback
    let rollback_on_error = |conn: &rusqlite::Connection, msg: String| -> String {
        let _ = conn.execute("ROLLBACK", []);
        msg
    };

    // Generar folio de devolución
    let fecha_actual = chrono::Local::now().format("%Y%m%d").to_string();
    let folio_query = format!(
        "SELECT COALESCE(MAX(CAST(substr(folio_devolucion, -4) AS INTEGER)), 0) + 1 AS siguiente
         FROM devoluciones
         WHERE folio_devolucion LIKE 'DEV-{}%'",
        fecha_actual
    );

    let siguiente_numero: i32 = conn
        .query_row(&folio_query, [], |row| row.get(0))
        .unwrap_or(1);

    let folio_devolucion = format!("DEV-{}-{:04}", fecha_actual, siguiente_numero);

    // VALIDAR DEVOLUCIONES Y CALCULAR MONTO TOTAL
    let mut monto_total = 0.0;

    for producto in &productos {
        // Verificar cuánto ya se devolvió de este producto
        let query_devuelto = r"
            SELECT COALESCE(SUM(dd.cantidad_devuelta), 0) as total_devuelto
            FROM detalles_devolucion dd
            JOIN devoluciones d ON dd.devolucion_id = d.id
            WHERE d.venta_original_id = ? 
              AND dd.producto_id = ?
              AND d.estado = 'PROCESADA'
        ";

        let ya_devuelto: i32 = conn
            .query_row(
                query_devuelto,
                params![ventaId, producto.producto_id],
                |row| row.get(0),
            )
            .unwrap_or(0);

        // Obtener cantidad original comprada
        let query_cantidad_original = r"
            SELECT cantidad
            FROM detalles_venta
            WHERE venta_id = ? AND producto_id = ?
        ";

        let cantidad_original: Option<i32> = conn
            .query_row(
                query_cantidad_original,
                params![ventaId, producto.producto_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| rollback_on_error(&conn, format!("Error al obtener cantidad original: {}", e)))?;

        let cantidad_original = match cantidad_original {
            Some(c) => c,
            None => {
                return Err(rollback_on_error(&conn, "Producto no encontrado en venta".to_string()));
            }
        };

        // Validar que no se devuelva más de lo comprado
        if ya_devuelto + producto.cantidad > cantidad_original {
            return Err(rollback_on_error(
                &conn,
                format!(
                    "No puedes devolver {} unidades. Compradas: {}, Ya devueltas: {}, Disponibles: {}",
                    producto.cantidad,
                    cantidad_original,
                    ya_devuelto,
                    cantidad_original - ya_devuelto
                ),
            ));
        }

        // Obtener precio unitario de la venta original
        let query_precio = r"
            SELECT precio_unitario
            FROM detalles_venta
            WHERE venta_id = ? AND producto_id = ?
        ";

        let precio_unitario: Option<f64> = conn
            .query_row(
                query_precio,
                params![ventaId, producto.producto_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| rollback_on_error(&conn, format!("Error al obtener precio: {}", e)))?;

        let precio_unitario = match precio_unitario {
            Some(p) => p,
            None => {
                return Err(rollback_on_error(&conn, "Producto no encontrado en la venta".to_string()));
            }
        };

        let subtotal = precio_unitario * producto.cantidad as f64;
        monto_total += subtotal;
    }

    // Insertar devolución
    let insert_devolucion = r"
        INSERT INTO devoluciones (
            venta_original_id, folio_devolucion, monto_reembolsado,
            metodo_reembolso, motivo, usuario_id, estado
        ) VALUES (?, ?, ?, 'EFECTIVO', ?, ?, 'PROCESADA')
    ";

    if let Err(e) = conn.execute(
        insert_devolucion,
        params![ventaId, &folio_devolucion, monto_total, &motivo, usuarioId],
    ) {
        return Err(rollback_on_error(&conn, format!("Error al insertar devolución: {}", e)));
    }

    let devolucion_id = conn.last_insert_rowid() as i32;

    // Insertar detalles y actualizar stock
    for producto in &productos {
        // Obtener precio unitario
        let query_precio = r"
            SELECT precio_unitario
            FROM detalles_venta
            WHERE venta_id = ? AND producto_id = ?
        ";

        let precio_unitario: f64 = conn
            .query_row(
                query_precio,
                params![ventaId, producto.producto_id],
                |row| row.get(0),
            )
            .map_err(|e| rollback_on_error(&conn, format!("Error al obtener precio: {}", e)))?;

        let subtotal = precio_unitario * producto.cantidad as f64;

        // Insertar detalle de devolución
        let insert_detalle = r"
            INSERT INTO detalles_devolucion (
                devolucion_id, producto_id, venta_id, cantidad_devuelta,
                precio_unitario, subtotal, condicion
            ) VALUES (?, ?, ?, ?, ?, ?, 'REVENTA')
        ";

        if let Err(e) = conn.execute(
            insert_detalle,
            params![
                devolucion_id,
                producto.producto_id,
                ventaId,
                producto.cantidad,
                precio_unitario,
                subtotal,
            ],
        ) {
            return Err(rollback_on_error(&conn, format!("Error al insertar detalle: {}", e)));
        }

        // Actualizar stock (AUTOMÁTICO - el trigger lo maneja, pero lo hacemos manual aquí)
        let update_stock = r"
            UPDATE productos
            SET stock = stock + ?
            WHERE id = ?
        ";

        if let Err(e) = conn.execute(update_stock, params![producto.cantidad, producto.producto_id]) {
            return Err(rollback_on_error(&conn, format!("Error al actualizar stock: {}", e)));
        }

        // Obtener stock anterior y nuevo
        let stock_nuevo: i32 = conn
            .query_row(
                "SELECT stock FROM productos WHERE id = ?",
                params![producto.producto_id],
                |row| row.get(0),
            )
            .unwrap_or(0);

        let stock_anterior = stock_nuevo - producto.cantidad;

        // Registrar movimiento de inventario
        let insert_movimiento = r"
            INSERT INTO movimientos_inventario (
                producto_id, tipo_movimiento, cantidad,
                stock_anterior, stock_nuevo, referencia, usuario_id
            ) VALUES (?, 'DEVOLUCION', ?, ?, ?, ?, ?)
        ";

        if let Err(e) = conn.execute(
            insert_movimiento,
            params![
                producto.producto_id,
                producto.cantidad,
                stock_anterior,
                stock_nuevo,
                &folio_devolucion,
                usuarioId,
            ],
        ) {
            return Err(rollback_on_error(&conn, format!("Error al registrar movimiento: {}", e)));
        }
    }

    // Commit
    if let Err(e) = conn.execute("COMMIT", []) {
        return Err(format!("Error al confirmar transacción: {}", e));
    }

    Ok(DevolucionResponse {
        success: true,
        message: "Devolución procesada exitosamente".to_string(),
        folio_devolucion: Some(folio_devolucion),
    })
}