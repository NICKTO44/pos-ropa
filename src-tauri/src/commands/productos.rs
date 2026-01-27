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
            p.stock, p.stock_minimo, p.categoria_id, c.nombre as categoria_nombre, 
            p.descuento_porcentaje, p.activo
        FROM productos p
        LEFT JOIN categorias c ON p.categoria_id = c.id
        WHERE p.activo = TRUE
        ORDER BY p.nombre
    ";

    let result: Result<Vec<(i32, String, String, Option<String>, f64, i32, i32, i32, Option<String>, f64, bool)>, _> =
        conn.query(query);

    match result {
        Ok(rows) => {
            let productos: Vec<Producto> = rows
                .into_iter()
                .map(
                    |(id, codigo, nombre, descripcion, precio, stock, stock_minimo, categoria_id, categoria_nombre, descuento_porcentaje, activo)| {
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
                            descuento_porcentaje,
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
            p.stock, p.stock_minimo, p.categoria_id, c.nombre as categoria_nombre, 
            p.descuento_porcentaje, p.activo
        FROM productos p
        LEFT JOIN categorias c ON p.categoria_id = c.id
        WHERE p.codigo = :codigo AND p.activo = TRUE
    ";

    let result: Result<Option<(i32, String, String, Option<String>, f64, i32, i32, i32, Option<String>, f64, bool)>, _> =
        conn.exec_first(query, params! {
            "codigo" => codigo,
        });

    match result {
        Ok(Some((id, codigo, nombre, descripcion, precio, stock, stock_minimo, categoria_id, categoria_nombre, descuento_porcentaje, activo))) => {
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
                descuento_porcentaje,
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
        INSERT INTO productos (codigo, nombre, descripcion, precio, stock, stock_minimo, categoria_id, descuento_porcentaje)
        VALUES (:codigo, :nombre, :descripcion, :precio, :stock, :stock_minimo, :categoria_id, :descuento_porcentaje)
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
            "descuento_porcentaje" => producto.descuento_porcentaje.unwrap_or(0.0),
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
                    descuento_porcentaje: 0.0,
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

// Comando: Actualizar producto
#[tauri::command]
pub fn actualizar_producto(
    db: tauri::State<DatabasePool>,
    producto_id: i32,
    codigo: String,
    nombre: String,
    descripcion: Option<String>,
    precio: f64,
    stock: i32,
    stock_minimo: i32,
    categoria_id: i32,
    descuento_porcentaje: Option<f64>,
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
        UPDATE productos 
        SET codigo = :codigo, 
            nombre = :nombre, 
            descripcion = :descripcion, 
            precio = :precio, 
            stock = :stock, 
            stock_minimo = :stock_minimo, 
            categoria_id = :categoria_id,
            descuento_porcentaje = :descuento_porcentaje
        WHERE id = :id
    ";

    let result = conn.exec_drop(
        query,
        params! {
            "id" => producto_id,
            "codigo" => &codigo,
            "nombre" => &nombre,
            "descripcion" => &descripcion,
            "precio" => precio,
            "stock" => stock,
            "stock_minimo" => stock_minimo,
            "categoria_id" => categoria_id,
            "descuento_porcentaje" => descuento_porcentaje.unwrap_or(0.0),
        },
    );

    match result {
        Ok(_) => ProductoResponse {
            success: true,
            message: "Producto actualizado exitosamente".to_string(),
            producto: None,
        },
        Err(e) => ProductoResponse {
            success: false,
            message: format!("Error al actualizar producto: {}", e),
            producto: None,
        },
    }
}

// Comando: Obtener categorías (nombres únicos desde tabla categorias)
#[tauri::command]
pub fn obtener_categorias(db: tauri::State<DatabasePool>) -> Result<Vec<(i32, String)>, String> {
    let mut conn = match db.get_conn() {
        Ok(c) => c,
        Err(e) => return Err(format!("Error de conexión: {}", e)),
    };

    let query = "SELECT id, nombre FROM categorias WHERE activo = 1 ORDER BY nombre";
    
    // Retornar tuplas (id, nombre)
    let categorias: Vec<(i32, String)> = conn
        .query(query)
        .map_err(|e| format!("Error al obtener categorías: {}", e))?;
    
    Ok(categorias)
}
// Comando: Obtener solo nombres de categorías (para filtros)
#[tauri::command]
pub fn obtener_nombres_categorias(db: tauri::State<DatabasePool>) -> Result<Vec<String>, String> {
    let mut conn = match db.get_conn() {
        Ok(c) => c,
        Err(e) => return Err(format!("Error de conexión: {}", e)),
    };

    let query = "SELECT nombre FROM categorias WHERE activo = 1 ORDER BY nombre";
    
    let categorias: Vec<String> = conn
        .query_map(query, |nombre: String| nombre)
        .map_err(|e| format!("Error al obtener categorías: {}", e))?;
    
    Ok(categorias)
}
// Comando: Buscar productos con filtros (nombre, código, categoría)
#[tauri::command]
pub fn buscar_productos_filtrado(
    db: tauri::State<DatabasePool>,
    termino: String,
    categoria: Option<String>,
) -> Result<Vec<Producto>, String> {
    let mut conn = match db.get_conn() {
        Ok(c) => c,
        Err(e) => return Err(format!("Error de conexión: {}", e)),
    };

    let mut query = String::from(r"
        SELECT 
            p.id, p.codigo, p.nombre, p.descripcion, p.precio, 
            p.stock, p.stock_minimo, p.categoria_id, c.nombre as categoria_nombre, 
            p.descuento_porcentaje, p.activo
        FROM productos p
        LEFT JOIN categorias c ON p.categoria_id = c.id
        WHERE p.activo = 1 AND p.stock > 0
    ");

    let mut conditions = Vec::new();
    let mut params_vec: Vec<(&str, mysql::Value)> = Vec::new();

    // Filtro por término de búsqueda (nombre o código)
    if !termino.is_empty() {
        conditions.push("(p.nombre LIKE :termino OR p.codigo LIKE :codigo)");
        let like_term = format!("%{}%", termino);
        params_vec.push(("termino", mysql::Value::from(like_term.clone())));
        params_vec.push(("codigo", mysql::Value::from(like_term)));
    }

    // Filtro por categoría
    if let Some(cat) = categoria {
        if !cat.is_empty() && cat != "TODAS" {
            conditions.push("c.nombre = :categoria");
            params_vec.push(("categoria", mysql::Value::from(cat)));
        }
    }

    if !conditions.is_empty() {
        query.push_str(" AND ");
        query.push_str(&conditions.join(" AND "));
    }

    query.push_str(" ORDER BY p.nombre LIMIT 100");

    let productos: Vec<(i32, String, String, Option<String>, f64, i32, i32, i32, Option<String>, f64, bool)> = conn
        .exec(&query, params_vec)
        .map_err(|e| format!("Error al buscar productos: {}", e))?;

    let resultado: Vec<Producto> = productos
        .into_iter()
        .map(|(id, codigo, nombre, descripcion, precio, stock, stock_minimo, categoria_id, categoria_nombre, descuento_porcentaje, activo)| {
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
                descuento_porcentaje,
                activo,
            }
        })
        .collect();

    Ok(resultado)
}