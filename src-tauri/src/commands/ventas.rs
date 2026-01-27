// commands/ventas.rs
// Comandos de ventas

use crate::database::DatabasePool;
use mysql::prelude::*;
use mysql::params;
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
    let mut conn = match db.get_conn() {
        Ok(c) => c,
        Err(e) => return Err(format!("Error de conexión: {}", e)),
    };

    // Iniciar transacción
    let mut tx = match conn.start_transaction(mysql::TxOpts::default()) {
        Ok(t) => t,
        Err(e) => return Err(format!("Error al iniciar transacción: {}", e)),
    };

    // 1. Generar folio único
    let fecha_actual = chrono::Local::now().format("%Y%m%d").to_string();
    let folio_query = format!(
        "SELECT COALESCE(MAX(CAST(SUBSTRING(folio, -4) AS UNSIGNED)), 0) + 1 AS siguiente
         FROM ventas
         WHERE folio LIKE 'V-{}%'",
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
        ) VALUES (
            :folio, :subtotal, :descuento, :total, :metodo_pago,
            :monto_recibido, :cambio, :usuario_id, 'COMPLETADA'
        )
    ";

    let venta_result = tx.exec_drop(
        insert_venta,
        params! {
            "folio" => &folio,
            "subtotal" => subtotal,
            "descuento" => descuento_total,
            "total" => total,
            "metodo_pago" => &metodo_pago,
            "monto_recibido" => monto_recibido,
            "cambio" => cambio,
            "usuario_id" => usuario_id,
        },
    );

    if let Err(e) = venta_result {
        let _ = tx.rollback();
        return Err(format!("Error al insertar venta: {}", e));
    }

    let venta_id: u64 = tx.last_insert_id().unwrap();

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
            ) VALUES (
                :venta_id, :producto_id, :cantidad, :precio_unitario,
                :subtotal, :descuento_linea, :total_linea
            )
        ";

        let detalle_result = tx.exec_drop(
            insert_detalle,
            params! {
                "venta_id" => venta_id,
                "producto_id" => producto.id,
                "cantidad" => cantidad,
                "precio_unitario" => precio_unitario,
                "subtotal" => subtotal_linea,
                "descuento_linea" => descuento_linea,
                "total_linea" => total_linea,
            },
        );

        if let Err(e) = detalle_result {
            let _ = tx.rollback();
            return Err(format!("Error al insertar detalle de venta: {}", e));
        }
    }

    // 5. Commit de la transacción
    if let Err(e) = tx.commit() {
        return Err(format!("Error al confirmar transacción: {}", e));
    }

    Ok(VentaResult {
        venta_id: venta_id as i32,
        folio: folio.clone(),
    })
}