// commands/ventas.rs
// Comandos de ventas - SQLite

use crate::database::DatabasePool;
use rusqlite::params;
use serde::{Deserialize, Serialize};

// Estructuras
#[derive(Debug, Serialize, Deserialize)]
pub struct ProductoVenta {
    pub id: i32,
    pub nombre: String,
    pub codigo: String,
    pub precio: f64,
    pub cantidad: i32,
    #[serde(rename = "descuentoPorcentaje")]  
    pub descuento_porcentaje: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VentaResult {
    pub venta_id: i32,
    pub folio: String,
}

// Comando: Procesar venta
#[tauri::command]
pub fn procesar_venta(
    db: tauri::State<DatabasePool>,
    productos: Vec<ProductoVenta>,
    total: f64,
    metodo_pago: String,
    monto_recibido: Option<f64>,
    cambio: Option<f64>,
    usuario_id: i32,
) -> Result<VentaResult, String> {
    let mut conn = db.get_conn();

    // Iniciar transacción
    conn.execute("BEGIN TRANSACTION", [])
        .map_err(|e| format!("Error al iniciar transacción: {}", e))?;

    // Función auxiliar para rollback en caso de error
    let rollback_on_error = |conn: &rusqlite::Connection, msg: String| -> String {
        let _ = conn.execute("ROLLBACK", []);
        msg
    };

    // 1. Generar folio único
    let fecha_actual = chrono::Local::now().format("%Y%m%d").to_string();
    let folio_query = format!(
        "SELECT COALESCE(MAX(CAST(substr(folio, -4) AS INTEGER)), 0) + 1 AS siguiente
         FROM ventas
         WHERE folio LIKE 'V-{}%'",
        fecha_actual
    );

    let siguiente_numero: i32 = conn
        .query_row(&folio_query, [], |row| row.get(0))
        .unwrap_or(1);

    let folio = format!("V-{}-{:04}", fecha_actual, siguiente_numero);

    // 2. Calcular subtotal y descuento total
    let mut subtotal = 0.0;
    let mut descuento_total = 0.0;
    
    for producto in &productos {
        let precio_unitario = producto.precio;
        let cantidad = producto.cantidad as f64;
        let descuento_porcentaje = producto.descuento_porcentaje.unwrap_or(0.0);
        
        let subtotal_linea = precio_unitario * cantidad;
        let descuento_linea = subtotal_linea * (descuento_porcentaje / 100.0);
        
        subtotal += subtotal_linea;
        descuento_total += descuento_linea;
    }

    // 3. Insertar venta
    let insert_venta = r"
        INSERT INTO ventas (
            folio, subtotal, descuento, total, metodo_pago, 
            monto_recibido, cambio, usuario_id, estado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETADA')
    ";

    if let Err(e) = conn.execute(
        insert_venta,
        params![
            &folio,
            subtotal,
            descuento_total,
            total,
            &metodo_pago,
            monto_recibido,
            cambio,
            usuario_id,
        ],
    ) {
        return Err(rollback_on_error(&conn, format!("Error al insertar venta: {}", e)));
    }

    let venta_id = conn.last_insert_rowid() as i32;

    // 4. Insertar detalles de venta con descuentos
    for producto in &productos {
        let precio_unitario = producto.precio;
        let cantidad = producto.cantidad;
        let descuento_porcentaje = producto.descuento_porcentaje.unwrap_or(0.0);
        
        let subtotal_linea = precio_unitario * cantidad as f64;
        let descuento_linea = subtotal_linea * (descuento_porcentaje / 100.0);
        let total_linea = subtotal_linea - descuento_linea;

        let insert_detalle = r"
            INSERT INTO detalles_venta (
                venta_id, producto_id, cantidad, precio_unitario, 
                subtotal, descuento_linea, total_linea
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ";

        if let Err(e) = conn.execute(
            insert_detalle,
            params![
                venta_id,
                producto.id,
                cantidad,
                precio_unitario,
                subtotal_linea,
                descuento_linea,
                total_linea,
            ],
        ) {
            return Err(rollback_on_error(&conn, format!("Error al insertar detalle de venta: {}", e)));
        }
    }

    // 5. Commit de la transacción
    if let Err(e) = conn.execute("COMMIT", []) {
        return Err(format!("Error al confirmar transacción: {}", e));
    }

    Ok(VentaResult {
        venta_id,
        folio: folio.clone(),
    })
}