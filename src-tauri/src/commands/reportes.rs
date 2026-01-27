// commands/reportes.rs
// Comandos de reportes

use crate::database::DatabasePool;
use mysql::prelude::*;
use mysql::params;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct VentaResumen {
    pub id: i32,
    pub folio: String,
    pub fecha_hora: String,
    pub total: f64,
    pub metodo_pago: String,
    pub cajero: String,
    pub estado: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProductoVendido {
    pub producto_nombre: String,
    pub cantidad_vendida: i32,
    pub total_vendido: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EstadisticasVentas {
    pub total_ventas: i32,
    pub monto_total: f64,
    pub ticket_promedio: f64,
    pub ventas_efectivo: f64,
    pub ventas_tarjeta: f64,
    pub ventas_transferencia: f64,
}

// Comando: Obtener ventas por rango de fechas
#[tauri::command]
pub fn obtener_ventas_rango(
    db: tauri::State<DatabasePool>,
    fecha_inicio: String,
    fecha_fin: String,
) -> Result<Vec<VentaResumen>, String> {
    let mut conn = match db.get_conn() {
        Ok(c) => c,
        Err(e) => return Err(format!("Error de conexión: {}", e)),
    };

    let query = r"
        SELECT 
            v.id,
            v.folio,
            DATE_FORMAT(v.fecha_hora, '%Y-%m-%d %H:%i') as fecha_hora,
            v.total,
            v.metodo_pago,
            u.nombre_completo as cajero,
            v.estado
        FROM ventas v
        JOIN usuarios u ON v.usuario_id = u.id
        WHERE DATE(v.fecha_hora) BETWEEN :fecha_inicio AND :fecha_fin
        ORDER BY v.fecha_hora DESC
    ";

    let result: Result<Vec<(i32, String, String, f64, String, String, String)>, _> = conn.exec(
        query,
        params! {
            "fecha_inicio" => &fecha_inicio,
            "fecha_fin" => &fecha_fin,
        },
    );

    match result {
        Ok(rows) => {
            let ventas = rows
                .into_iter()
                .map(|(id, folio, fecha_hora, total, metodo_pago, cajero, estado)| VentaResumen {
                    id,
                    folio,
                    fecha_hora,
                    total,
                    metodo_pago,
                    cajero,
                    estado,
                })
                .collect();
            Ok(ventas)
        }
        Err(e) => Err(format!("Error al obtener ventas: {}", e)),
    }
}

// Comando: Obtener productos más vendidos
#[tauri::command]
pub fn obtener_productos_mas_vendidos(
    db: tauri::State<DatabasePool>,
    fecha_inicio: String,
    fecha_fin: String,
    limite: i32,
) -> Result<Vec<ProductoVendido>, String> {
    let mut conn = match db.get_conn() {
        Ok(c) => c,
        Err(e) => return Err(format!("Error de conexión: {}", e)),
    };

    let query = r"
        SELECT 
            p.nombre as producto_nombre,
            SUM(dv.cantidad) as cantidad_vendida,
            SUM(dv.total_linea) as total_vendido
        FROM detalles_venta dv
        JOIN productos p ON dv.producto_id = p.id
        JOIN ventas v ON dv.venta_id = v.id
        WHERE DATE(v.fecha_hora) BETWEEN :fecha_inicio AND :fecha_fin
            AND v.estado = 'COMPLETADA'
        GROUP BY p.id, p.nombre
        ORDER BY cantidad_vendida DESC
        LIMIT :limite
    ";

    let result: Result<Vec<(String, i32, f64)>, _> = conn.exec(
        query,
        params! {
            "fecha_inicio" => &fecha_inicio,
            "fecha_fin" => &fecha_fin,
            "limite" => limite,
        },
    );

    match result {
        Ok(rows) => {
            let productos = rows
                .into_iter()
                .map(|(producto_nombre, cantidad_vendida, total_vendido)| ProductoVendido {
                    producto_nombre,
                    cantidad_vendida,
                    total_vendido,
                })
                .collect();
            Ok(productos)
        }
        Err(e) => Err(format!("Error al obtener productos vendidos: {}", e)),
    }
}

// Comando: Obtener estadísticas de ventas
#[tauri::command]
pub fn obtener_estadisticas_ventas(
    db: tauri::State<DatabasePool>,
    fecha_inicio: String,
    fecha_fin: String,
) -> Result<EstadisticasVentas, String> {
    let mut conn = match db.get_conn() {
        Ok(c) => c,
        Err(e) => return Err(format!("Error de conexión: {}", e)),
    };

    let query = r"
        SELECT 
            COUNT(*) as total_ventas,
            COALESCE(SUM(total), 0) as monto_total,
            COALESCE(AVG(total), 0) as ticket_promedio,
            COALESCE(SUM(CASE WHEN metodo_pago = 'EFECTIVO' THEN total ELSE 0 END), 0) as ventas_efectivo,
            COALESCE(SUM(CASE WHEN metodo_pago = 'TARJETA' THEN total ELSE 0 END), 0) as ventas_tarjeta,
            COALESCE(SUM(CASE WHEN metodo_pago = 'TRANSFERENCIA' THEN total ELSE 0 END), 0) as ventas_transferencia
        FROM ventas
        WHERE DATE(fecha_hora) BETWEEN :fecha_inicio AND :fecha_fin
            AND estado = 'COMPLETADA'
    ";

    let result: Result<Option<(i64, f64, f64, f64, f64, f64)>, _> = conn.exec_first(
        query,
        params! {
            "fecha_inicio" => &fecha_inicio,
            "fecha_fin" => &fecha_fin,
        },
    );

    match result {
        Ok(Some((total_ventas, monto_total, ticket_promedio, ventas_efectivo, ventas_tarjeta, ventas_transferencia))) => {
            Ok(EstadisticasVentas {
                total_ventas: total_ventas as i32,
                monto_total,
                ticket_promedio,
                ventas_efectivo,
                ventas_tarjeta,
                ventas_transferencia,
            })
        }
        Ok(None) => Ok(EstadisticasVentas {
            total_ventas: 0,
            monto_total: 0.0,
            ticket_promedio: 0.0,
            ventas_efectivo: 0.0,
            ventas_tarjeta: 0.0,
            ventas_transferencia: 0.0,
        }),
        Err(e) => Err(format!("Error al obtener estadísticas: {}", e)),
    }
}

// Comando: Obtener ventas de hoy
#[tauri::command]
pub fn obtener_ventas_hoy(db: tauri::State<DatabasePool>) -> Result<Vec<VentaResumen>, String> {
    let mut conn = match db.get_conn() {
        Ok(c) => c,
        Err(e) => return Err(format!("Error de conexión: {}", e)),
    };

    let query = r"
        SELECT 
            v.id,
            v.folio,
            DATE_FORMAT(v.fecha_hora, '%Y-%m-%d %H:%i') as fecha_hora,
            v.total,
            v.metodo_pago,
            u.nombre_completo as cajero,
            v.estado
        FROM ventas v
        JOIN usuarios u ON v.usuario_id = u.id
        WHERE DATE(v.fecha_hora) = CURDATE()
        ORDER BY v.fecha_hora DESC
    ";

    let result: Result<Vec<(i32, String, String, f64, String, String, String)>, _> = conn.query(query);

    match result {
        Ok(rows) => {
            let ventas = rows
                .into_iter()
                .map(|(id, folio, fecha_hora, total, metodo_pago, cajero, estado)| VentaResumen {
                    id,
                    folio,
                    fecha_hora,
                    total,
                    metodo_pago,
                    cajero,
                    estado,
                })
                .collect();
            Ok(ventas)
        }
        Err(e) => Err(format!("Error al obtener ventas: {}", e)),
    }
}
// Comando: Obtener estadísticas con devoluciones
#[tauri::command]
pub fn obtener_estadisticas_con_devoluciones(
    db: tauri::State<DatabasePool>,
    fecha_inicio: String,
    fecha_fin: String,
) -> Result<serde_json::Value, String> {
    let mut conn = match db.get_conn() {
        Ok(c) => c,
        Err(e) => return Err(format!("Error de conexión: {}", e)),
    };

    // Estadísticas de ventas
    let query_ventas = r"
        SELECT 
            COUNT(*) as total_ventas,
            COALESCE(SUM(total), 0) as total_vendido,
            COALESCE(AVG(total), 0) as ticket_promedio
        FROM ventas
        WHERE DATE(fecha_hora) BETWEEN :fecha_inicio AND :fecha_fin
          AND estado = 'COMPLETADA'
    ";

    let ventas_stats: (i64, f64, f64) = conn
        .exec_first(
            query_ventas,
            params! {
                "fecha_inicio" => &fecha_inicio,
                "fecha_fin" => &fecha_fin,
            },
        )
        .map_err(|e| format!("Error al obtener estadísticas de ventas: {}", e))?
        .unwrap_or((0, 0.0, 0.0));

    // Estadísticas de devoluciones
    let query_devoluciones = r"
        SELECT 
            COUNT(*) as total_devoluciones,
            COALESCE(SUM(monto_reembolsado), 0) as total_devuelto
        FROM devoluciones
        WHERE DATE(fecha_hora) BETWEEN :fecha_inicio AND :fecha_fin
          AND estado = 'PROCESADA'
    ";

    let dev_stats: (i64, f64) = conn
        .exec_first(
            query_devoluciones,
            params! {
                "fecha_inicio" => &fecha_inicio,
                "fecha_fin" => &fecha_fin,
            },
        )
        .map_err(|e| format!("Error al obtener estadísticas de devoluciones: {}", e))?
        .unwrap_or((0, 0.0));

    let (total_ventas, total_vendido, ticket_promedio) = ventas_stats;
    let (total_devoluciones, total_devuelto) = dev_stats;
    let total_neto = total_vendido - total_devuelto;

    let resultado = serde_json::json!({
        "ventas": {
            "cantidad": total_ventas,
            "total": total_vendido,
            "ticket_promedio": ticket_promedio
        },
        "devoluciones": {
            "cantidad": total_devoluciones,
            "total": total_devuelto
        },
        "total_neto": total_neto
    });

    Ok(resultado)
}