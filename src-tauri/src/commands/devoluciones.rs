// commands/devoluciones.rs
// Comandos de devoluciones

use crate::database::DatabasePool;
use mysql::prelude::*;
use mysql::params;
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
    let mut conn = match db.get_conn() {
        Ok(c) => c,
        Err(e) => return Err(format!("Error de conexión: {}", e)),
    };

    // Obtener datos de la venta
    let query_venta = r"
        SELECT id, folio, DATE_FORMAT(fecha_hora, '%Y-%m-%d %H:%i:%s') as fecha_hora, total, metodo_pago
        FROM ventas
        WHERE folio = :folio AND estado = 'COMPLETADA'
    ";

    let venta: Option<(i32, String, String, f64, String)> = conn
        .exec_first(query_venta, params! { "folio" => &folio })
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
        WHERE dv.venta_id = :venta_id
    ";

    let productos: Vec<(i32, String, i32, f64, f64)> = conn
        .exec(query_productos, params! { "venta_id" => venta_id })
        .map_err(|e| format!("Error al obtener productos: {}", e))?;

    let productos_detalle: Vec<ProductoVentaDetalle> = productos
        .into_iter()
        .map(|(producto_id, nombre, cantidad, precio_unitario, subtotal)| {
            ProductoVentaDetalle {
                producto_id,
                nombre,
                cantidad,
                precio_unitario,
                subtotal,
            }
        })
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
    let mut conn = match db.get_conn() {
        Ok(c) => c,
        Err(e) => return Err(format!("Error de conexión: {}", e)),
    };

    // Iniciar transacción
    let mut tx = match conn.start_transaction(mysql::TxOpts::default()) {
        Ok(t) => t,
        Err(e) => return Err(format!("Error al iniciar transacción: {}", e)),
    };

    // Generar folio de devolución
    let fecha_actual = chrono::Local::now().format("%Y%m%d").to_string();
    let folio_query = format!(
        "SELECT COALESCE(MAX(CAST(SUBSTRING(folio_devolucion, -4) AS UNSIGNED)), 0) + 1 AS siguiente
         FROM devoluciones
         WHERE folio_devolucion LIKE 'DEV-{}%'",
        fecha_actual
    );

    let siguiente_numero: u32 = match tx.query_first(&folio_query) {
        Ok(Some(num)) => num,
        Ok(None) => 1,
        Err(e) => {
            let _ = tx.rollback();
            return Err(format!("Error al generar folio: {}", e));
        }
    };

    let folio_devolucion = format!("DEV-{}-{:04}", fecha_actual, siguiente_numero);

    // VALIDAR DEVOLUCIONES Y CALCULAR MONTO TOTAL
    let mut monto_total = 0.0;

    for producto in &productos {
        // Verificar cuánto ya se devolvió de este producto
        let query_devuelto = r"
            SELECT COALESCE(SUM(dd.cantidad_devuelta), 0) as total_devuelto
            FROM detalles_devolucion dd
            JOIN devoluciones d ON dd.devolucion_id = d.id
            WHERE d.venta_original_id = :venta_id 
              AND dd.producto_id = :producto_id
              AND d.estado = 'PROCESADA'
        ";

        let ya_devuelto: i32 = tx
            .exec_first(
                query_devuelto,
                params! {
                    "venta_id" => ventaId,
                    "producto_id" => producto.producto_id,
                },
            )
            .map_err(|e| format!("Error al verificar devoluciones: {}", e))?
            .unwrap_or(0);

        // Obtener cantidad original comprada
        let query_cantidad_original = r"
            SELECT cantidad
            FROM detalles_venta
            WHERE venta_id = :venta_id AND producto_id = :producto_id
        ";

        let cantidad_original: i32 = tx
            .exec_first(
                query_cantidad_original,
                params! {
                    "venta_id" => ventaId,
                    "producto_id" => producto.producto_id,
                },
            )
            .map_err(|e| format!("Error al obtener cantidad original: {}", e))?
            .ok_or("Producto no encontrado en venta")?;

        // Validar que no se devuelva más de lo comprado
        if ya_devuelto + producto.cantidad > cantidad_original {
            let _ = tx.rollback();
            return Err(format!(
                "No puedes devolver {} unidades. Compradas: {}, Ya devueltas: {}, Disponibles: {}",
                producto.cantidad,
                cantidad_original,
                ya_devuelto,
                cantidad_original - ya_devuelto
            ));
        }

        // Obtener precio unitario de la venta original
        let query_precio = r"
            SELECT precio_unitario
            FROM detalles_venta
            WHERE venta_id = :venta_id AND producto_id = :producto_id
        ";

        let precio_unitario: f64 = tx
            .exec_first(
                query_precio,
                params! {
                    "venta_id" => ventaId,
                    "producto_id" => producto.producto_id,
                },
            )
            .map_err(|e| format!("Error al obtener precio: {}", e))?
            .ok_or("Producto no encontrado en la venta")?;

        let subtotal = precio_unitario * producto.cantidad as f64;
        monto_total += subtotal;
    }

    // Insertar devolución
    let insert_devolucion = r"
        INSERT INTO devoluciones (
            venta_original_id, folio_devolucion, monto_reembolsado,
            metodo_reembolso, motivo, usuario_id, estado
        ) VALUES (
            :venta_id, :folio_devolucion, :monto_reembolsado,
            'EFECTIVO', :motivo, :usuario_id, 'PROCESADA'
        )
    ";

    tx.exec_drop(
        insert_devolucion,
        params! {
            "venta_id" => ventaId,
            "folio_devolucion" => &folio_devolucion,
            "monto_reembolsado" => monto_total,
            "motivo" => &motivo,
            "usuario_id" => usuarioId,
        },
    )
    .map_err(|e| format!("Error al insertar devolución: {}", e))?;

    let devolucion_id = tx.last_insert_id().unwrap();

    // Insertar detalles y actualizar stock
    for producto in &productos {
        // Obtener precio unitario
        let query_precio = r"
            SELECT precio_unitario
            FROM detalles_venta
            WHERE venta_id = :venta_id AND producto_id = :producto_id
        ";

        let precio_unitario: f64 = tx
            .exec_first(
                query_precio,
                params! {
                    "venta_id" => ventaId,
                    "producto_id" => producto.producto_id,
                },
            )
            .map_err(|e| format!("Error al obtener precio: {}", e))?
            .ok_or("Precio no encontrado")?;

        let subtotal = precio_unitario * producto.cantidad as f64;

        // Insertar detalle de devolución
        let insert_detalle = r"
            INSERT INTO detalles_devolucion (
                devolucion_id, producto_id, cantidad_devuelta,
                precio_unitario, subtotal, condicion
            ) VALUES (
                :devolucion_id, :producto_id, :cantidad_devuelta,
                :precio_unitario, :subtotal, 'REVENTA'
            )
        ";

        tx.exec_drop(
            insert_detalle,
            params! {
                "devolucion_id" => devolucion_id,
                "producto_id" => producto.producto_id,
                "cantidad_devuelta" => producto.cantidad,
                "precio_unitario" => precio_unitario,
                "subtotal" => subtotal,
            },
        )
        .map_err(|e| format!("Error al insertar detalle: {}", e))?;

        // Actualizar stock (AUTOMÁTICO)
        let update_stock = r"
            UPDATE productos
            SET stock = stock + :cantidad
            WHERE id = :producto_id
        ";

        tx.exec_drop(
            update_stock,
            params! {
                "cantidad" => producto.cantidad,
                "producto_id" => producto.producto_id,
            },
        )
        .map_err(|e| format!("Error al actualizar stock: {}", e))?;

        // Obtener stock anterior y nuevo
        let stock_nuevo: i32 = tx
            .exec_first(
                "SELECT stock FROM productos WHERE id = :producto_id",
                params! {
                    "producto_id" => producto.producto_id,
                },
            )
            .map_err(|e| format!("Error al obtener stock: {}", e))?
            .unwrap_or(0);

        let stock_anterior = stock_nuevo - producto.cantidad;

        // Registrar movimiento de inventario
        let insert_movimiento = r"
            INSERT INTO movimientos_inventario (
                producto_id, tipo_movimiento, cantidad,
                stock_anterior, stock_nuevo, referencia, usuario_id
            ) VALUES (
                :producto_id, 'DEVOLUCION', :cantidad,
                :stock_anterior, :stock_nuevo, :folio_devolucion, :usuario_id
            )
        ";

        tx.exec_drop(
            insert_movimiento,
            params! {
                "producto_id" => producto.producto_id,
                "cantidad" => producto.cantidad,
                "stock_anterior" => stock_anterior,
                "stock_nuevo" => stock_nuevo,
                "folio_devolucion" => &folio_devolucion,
                "usuario_id" => usuarioId,
            },
        )
        .map_err(|e| format!("Error al registrar movimiento: {}", e))?;
    }

    // Commit
    tx.commit()
        .map_err(|e| format!("Error al confirmar transacción: {}", e))?;

    Ok(DevolucionResponse {
        success: true,
        message: "Devolución procesada exitosamente".to_string(),
        folio_devolucion: Some(folio_devolucion),
    })
}