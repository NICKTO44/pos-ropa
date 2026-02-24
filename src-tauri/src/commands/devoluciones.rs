// commands/devoluciones.rs
// Comandos de devoluciones con soporte de variantes/tallas

use rusqlite::OptionalExtension;
use crate::database::DatabasePool;
use rusqlite::params;
use serde::{Deserialize, Serialize};

// =====================================================
// ESTRUCTURAS
// =====================================================

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
    // 🆕 Usar detalle_id como clave única en lugar de producto_id
    // (el mismo producto puede aparecer 2 veces con distintas tallas)
    pub detalle_id: i32,
    pub producto_id: i32,
    pub variante_id: Option<i32>,  // 🆕
    pub talla: Option<String>,     // 🆕
    pub nombre: String,
    pub cantidad: i32,
    pub precio_unitario: f64,
    pub subtotal: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProductoDevolver {
    pub detalle_id: i32,       // 🆕 clave única
    pub producto_id: i32,
    pub variante_id: Option<i32>, // 🆕
    pub cantidad: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DevolucionResponse {
    pub success: bool,
    pub message: String,
    pub folio_devolucion: Option<String>,
}

// =====================================================
// COMANDO: Buscar venta por folio para devolución
// =====================================================
#[tauri::command]
pub fn buscar_venta_para_devolucion(
    db: tauri::State<'_, DatabasePool>,
    folio: String,
) -> Result<VentaParaDevolucion, String> {
    let conn = db.get_conn();

    // Obtener datos de la venta
    let venta = conn
        .query_row(
            r"SELECT id, folio, strftime('%Y-%m-%d %H:%M:%S', fecha_hora), total, metodo_pago
              FROM ventas
              WHERE folio = ? AND estado = 'COMPLETADA'",
            [&folio],
            |row| Ok((
                row.get::<_, i32>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, f64>(3)?,
                row.get::<_, String>(4)?,
            )),
        )
        .optional()
        .map_err(|e| format!("Error al buscar venta: {}", e))?;

    let (venta_id, folio, fecha_hora, total, metodo_pago) = match venta {
        Some(v) => v,
        None => return Err("Venta no encontrada o no completada".to_string()),
    };

    // 🆕 Obtener productos incluyendo detalle_id, variante_id y talla
    let mut stmt = conn
        .prepare(r"
            SELECT
                dv.id as detalle_id,
                dv.producto_id,
                dv.variante_id,
                dv.talla,
                p.nombre,
                dv.cantidad,
                dv.precio_unitario,
                dv.total_linea
            FROM detalles_venta dv
            JOIN productos p ON dv.producto_id = p.id
            WHERE dv.venta_id = ?
            ORDER BY dv.id
        ")
        .map_err(|e| format!("Error al preparar consulta: {}", e))?;

    let productos: Vec<ProductoVentaDetalle> = stmt
        .query_map([venta_id], |row| {
            Ok(ProductoVentaDetalle {
                detalle_id:    row.get(0)?,
                producto_id:   row.get(1)?,
                variante_id:   row.get(2)?,
                talla:         row.get(3)?,
                nombre:        row.get(4)?,
                cantidad:      row.get(5)?,
                precio_unitario: row.get(6)?,
                subtotal:      row.get(7)?,
            })
        })
        .map_err(|e| format!("Error al obtener productos: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(VentaParaDevolucion { venta_id, folio, fecha_hora, total, metodo_pago, productos })
}

// =====================================================
// COMANDO: Procesar devolución
// =====================================================
#[tauri::command]
pub fn procesar_devolucion(
    db: tauri::State<'_, DatabasePool>,
    #[allow(non_snake_case)] ventaId: i32,
    #[allow(non_snake_case)] folioVenta: String,
    productos: Vec<ProductoDevolver>,
    motivo: String,
    #[allow(non_snake_case)] usuarioId: i32,
) -> Result<DevolucionResponse, String> {
    let conn = db.get_conn();

    conn.execute("BEGIN TRANSACTION", [])
        .map_err(|e| format!("Error al iniciar transacción: {}", e))?;

    let rollback = |conn: &rusqlite::Connection, msg: String| -> String {
        let _ = conn.execute("ROLLBACK", []);
        msg
    };

    // Generar folio de devolución
    let fecha_actual = chrono::Local::now().format("%Y%m%d").to_string();
    let siguiente: i32 = conn
        .query_row(
            &format!(
                "SELECT COALESCE(MAX(CAST(substr(folio_devolucion,-4) AS INTEGER)),0)+1
                 FROM devoluciones WHERE folio_devolucion LIKE 'DEV-{}%'",
                fecha_actual
            ),
            [],
            |row| row.get(0),
        )
        .unwrap_or(1);

    let folio_devolucion = format!("DEV-{}-{:04}", fecha_actual, siguiente);

    // Validar y calcular monto total
    let mut monto_total = 0.0f64;

    for p in &productos {
        // 🆕 Validar usando detalle_id para precisión con variantes
        let ya_devuelto: i32 = conn
            .query_row(
                r"SELECT COALESCE(SUM(dd.cantidad_devuelta), 0)
                  FROM detalles_devolucion dd
                  JOIN devoluciones d ON dd.devolucion_id = d.id
                  WHERE dd.detalle_venta_id = ? AND d.estado = 'PROCESADA'",
                params![p.detalle_id],
                |row| row.get(0),
            )
            .unwrap_or(0);

        let cantidad_original: Option<i32> = conn
            .query_row(
                "SELECT cantidad FROM detalles_venta WHERE id = ?",
                params![p.detalle_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| rollback(&conn, format!("Error al obtener cantidad: {}", e)))?;

        let cantidad_original = match cantidad_original {
            Some(c) => c,
            None => return Err(rollback(&conn, "Detalle de venta no encontrado".to_string())),
        };

        if ya_devuelto + p.cantidad > cantidad_original {
            return Err(rollback(&conn, format!(
                "No puedes devolver {} unidades. Disponibles para devolución: {}",
                p.cantidad,
                cantidad_original - ya_devuelto
            )));
        }

        let precio: f64 = conn
            .query_row(
                "SELECT precio_unitario FROM detalles_venta WHERE id = ?",
                params![p.detalle_id],
                |row| row.get(0),
            )
            .map_err(|e| rollback(&conn, format!("Error al obtener precio: {}", e)))?;

        monto_total += precio * p.cantidad as f64;
    }

    // Insertar devolución
    if let Err(e) = conn.execute(
        r"INSERT INTO devoluciones
            (venta_original_id, folio_devolucion, monto_reembolsado,
             metodo_reembolso, motivo, usuario_id, estado)
          VALUES (?, ?, ?, 'EFECTIVO', ?, ?, 'PROCESADA')",
        params![ventaId, &folio_devolucion, monto_total, &motivo, usuarioId],
    ) {
        return Err(rollback(&conn, format!("Error al insertar devolución: {}", e)));
    }

    let devolucion_id = conn.last_insert_rowid() as i32;

    // Insertar detalles y actualizar stock
    for p in &productos {
        let precio: f64 = conn
            .query_row(
                "SELECT precio_unitario FROM detalles_venta WHERE id = ?",
                params![p.detalle_id],
                |row| row.get(0),
            )
            .map_err(|e| rollback(&conn, format!("Error precio: {}", e)))?;

        let subtotal = precio * p.cantidad as f64;

        // 🆕 Insertar detalle usando detalle_venta_id
        if let Err(e) = conn.execute(
            r"INSERT INTO detalles_devolucion
                (devolucion_id, producto_id, variante_id, detalle_venta_id,
                 venta_id, cantidad_devuelta, precio_unitario, subtotal, condicion)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'REVENTA')",
            params![
                devolucion_id,
                p.producto_id,
                p.variante_id,
                p.detalle_id,
                ventaId,
                p.cantidad,
                precio,
                subtotal,
            ],
        ) {
            return Err(rollback(&conn, format!("Error al insertar detalle: {}", e)));
        }

        // 🆕 Actualizar stock: variante si tiene, producto si no
        if let Some(variante_id) = p.variante_id {
            if let Err(e) = conn.execute(
                "UPDATE producto_variantes SET stock = stock + ? WHERE id = ?",
                params![p.cantidad, variante_id],
            ) {
                return Err(rollback(&conn, format!("Error al actualizar stock variante: {}", e)));
            }
            // El trigger actualiza el stock total del producto automáticamente
        } else {
            if let Err(e) = conn.execute(
                "UPDATE productos SET stock = stock + ? WHERE id = ?",
                params![p.cantidad, p.producto_id],
            ) {
                return Err(rollback(&conn, format!("Error al actualizar stock: {}", e)));
            }
        }

        // Stock nuevo para el movimiento
        let stock_nuevo: i32 = conn
            .query_row(
                "SELECT stock FROM productos WHERE id = ?",
                params![p.producto_id],
                |row| row.get(0),
            )
            .unwrap_or(0);

        // Registrar movimiento de inventario
        if let Err(e) = conn.execute(
            r"INSERT INTO movimientos_inventario
                (producto_id, variante_id, tipo_movimiento, cantidad,
                 stock_anterior, stock_nuevo, referencia, usuario_id)
              VALUES (?, ?, 'DEVOLUCION', ?, ?, ?, ?, ?)",
            params![
                p.producto_id,
                p.variante_id,
                p.cantidad,
                stock_nuevo - p.cantidad,
                stock_nuevo,
                &folio_devolucion,
                usuarioId,
            ],
        ) {
            return Err(rollback(&conn, format!("Error al registrar movimiento: {}", e)));
        }
    }

    conn.execute("COMMIT", [])
        .map_err(|e| format!("Error al confirmar: {}", e))?;

    Ok(DevolucionResponse {
        success: true,
        message: "Devolución procesada exitosamente".to_string(),
        folio_devolucion: Some(folio_devolucion),
    })
}