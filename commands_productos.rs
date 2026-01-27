// commands/productos.rs
// Comandos de productos

use crate::database::DatabasePool;
use crate::models::{Producto, ProductoNuevo, ProductoResponse, ProductosResponse};
use mysql::prelude::*;
use mysql::params;

// Comando: Obtener todos los productos
#[tauri::command]
pub fn obtener_productos(db: tauri::State<DatabasePool>) -> ProductosResponse {
    let mut conn = match db.get_conn() {
        Ok(c) => c,
        Err(_) => {
            return ProductosResponse {
                success: false,
                productos: vec![],
            }
        }
    };

    let query = r"
        SELECT 
            p.id, p.codigo, p.nombre, p.descripcion, p.precio, 
            p.stock, p.stock_minimo, p.categoria_id, c.nombre as categoria_nombre, p.activo
        FROM productos p
        LEFT JOIN categorias c ON p.categoria_id = c.id
        WHERE p.activo = TRUE
        ORDER BY p.nombre
    ";

    let result: Result<Vec<(i32, String, String, Option<String>, f64, i32, i32, i32, Option<String>, bool)>, _> =
        conn.query(query);

    match result {
        Ok(rows) => {
            let productos: Vec<Producto> = rows
                .into_iter()
                .map(
                    |(id, codigo, nombre, descripcion, precio, stock, stock_minimo, categoria_id, categoria_nombre, activo)| {
                        Producto {
                            id,
                            codigo,
                            nombre,
                            descripcion,
                            precio,
                            stock,
                            stock_minimo,
                            categoria_id,
                            categoria_nombre,
                            activo,
                        }
                    },
                )
                .collect();

            ProductosResponse {
                success: true,
                productos,
            }
        }
        Err(_) => ProductosResponse {
            success: false,
            productos: vec![],
        },
    }
}

// Comando: Buscar producto por código
#[tauri::command]
pub fn buscar_producto_por_codigo(
    db: tauri::State<DatabasePool>,
    codigo: String,
) -> ProductoResponse {
    let mut conn = match db.get_conn() {
        Ok(c) => c,
        Err(e) => {
            return ProductoResponse {
                success: false,
                message: format!("Error de conexión: {}", e),
                producto: None,
            }
        }
    };

    let query = r"
        SELECT 
            p.id, p.codigo, p.nombre, p.descripcion, p.precio, 
            p.stock, p.stock_minimo, p.categoria_id, c.nombre as categoria_nombre, p.activo
        FROM productos p
        LEFT JOIN categorias c ON p.categoria_id = c.id
        WHERE p.codigo = :codigo AND p.activo = TRUE
    ";

    let result: Result<Option<(i32, String, String, Option<String>, f64, i32, i32, i32, Option<String>, bool)>, _> =
        conn.exec_first(query, params! {
            "codigo" => codigo,
        });

    match result {
        Ok(Some((id, codigo, nombre, descripcion, precio, stock, stock_minimo, categoria_id, categoria_nombre, activo))) => {
            let producto = Producto {
                id,
                codigo,
                nombre,
                descripcion,
                precio,
                stock,
                stock_minimo,
                categoria_id,
                categoria_nombre,
                activo,
            };

            ProductoResponse {
                success: true,
                message: "Producto encontrado".to_string(),
                producto: Some(producto),
            }
        }
        Ok(None) => ProductoResponse {
            success: false,
            message: "Producto no encontrado".to_string(),
            producto: None,
        },
        Err(e) => ProductoResponse {
            success: false,
            message: format!("Error en consulta: {}", e),
            producto: None,
        },
    }
}

// Comando: Agregar nuevo producto
#[tauri::command]
pub fn agregar_producto(
    db: tauri::State<DatabasePool>,
    producto: ProductoNuevo,
) -> ProductoResponse {
    let mut conn = match db.get_conn() {
        Ok(c) => c,
        Err(e) => {
            return ProductoResponse {
                success: false,
                message: format!("Error de conexión: {}", e),
                producto: None,
            }
        }
    };

    let query = r"
        INSERT INTO productos (codigo, nombre, descripcion, precio, stock, stock_minimo, categoria_id)
        VALUES (:codigo, :nombre, :descripcion, :precio, :stock, :stock_minimo, :categoria_id)
    ";

    let result = conn.exec_drop(
        query,
        params! {
            "codigo" => &producto.codigo,
            "nombre" => &producto.nombre,
            "descripcion" => &producto.descripcion,
            "precio" => producto.precio,
            "stock" => producto.stock,
            "stock_minimo" => producto.stock_minimo,
            "categoria_id" => producto.categoria_id,
        },
    );

    match result {
        Ok(_) => ProductoResponse {
            success: true,
            message: "Producto agregado exitosamente".to_string(),
            producto: None,
        },
        Err(e) => ProductoResponse {
            success: false,
            message: format!("Error al agregar producto: {}", e),
            producto: None,
        },
    }
}

// Comando: Obtener productos con stock bajo
#[tauri::command]
pub fn obtener_productos_stock_bajo(db: tauri::State<DatabasePool>) -> ProductosResponse {
    let mut conn = match db.get_conn() {
        Ok(c) => c,
        Err(_) => {
            return ProductosResponse {
                success: false,
                productos: vec![],
            }
        }
    };

    let query = "SELECT * FROM v_productos_stock_bajo";

    let result: Result<Vec<(i32, String, String, i32, i32, String, i32)>, _> = conn.query(query);

    match result {
        Ok(rows) => {
            let productos: Vec<Producto> = rows
                .into_iter()
                .map(|(id, codigo, nombre, stock, stock_minimo, categoria, _)| Producto {
                    id,
                    codigo,
                    nombre,
                    descripcion: None,
                    precio: 0.0,
                    stock,
                    stock_minimo,
                    categoria_id: 0,
                    categoria_nombre: Some(categoria),
                    activo: true,
                })
                .collect();

            ProductosResponse {
                success: true,
                productos,
            }
        }
        Err(_) => ProductosResponse {
            success: false,
            productos: vec![],
        },
    }
}
