
use rusqlite::OptionalExtension;
use crate::database::DatabasePool;
use crate::models::{Producto, ProductoNuevo, ProductoResponse, ProductosResponse};
use rusqlite::params;

// Comando: Obtener todos los productos
#[tauri::command]
pub fn obtener_productos(db: tauri::State<DatabasePool>) -> ProductosResponse {
    let conn = db.get_conn();

    let query = r"
        SELECT 
            p.id, p.codigo, p.nombre, p.descripcion, p.precio, 
            p.stock, p.stock_minimo, p.categoria_id, c.nombre as categoria_nombre, 
            p.descuento_porcentaje, p.activo
        FROM productos p
        LEFT JOIN categorias c ON p.categoria_id = c.id
        WHERE p.activo = 1
        ORDER BY p.nombre
    ";

    let mut stmt = match conn.prepare(query) {
        Ok(s) => s,
        Err(_) => {
            return ProductosResponse {
                success: false,
                productos: vec![],
            }
        }
    };

    let productos_iter = stmt.query_map([], |row| {
        Ok(Producto {
            id: row.get(0)?,
            codigo: row.get(1)?,
            nombre: row.get(2)?,
            descripcion: row.get(3)?,
            precio: row.get(4)?,
            stock: row.get(5)?,
            stock_minimo: row.get(6)?,
            categoria_id: row.get(7)?,
            categoria_nombre: row.get(8)?,
            descuento_porcentaje: row.get(9)?,
            activo: row.get(10)?,
        })
    });

    match productos_iter {
        Ok(iter) => {
            let productos: Vec<Producto> = iter
                .filter_map(|r| r.ok())
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
    let conn = db.get_conn();

    let query = r"
        SELECT 
            p.id, p.codigo, p.nombre, p.descripcion, p.precio, 
            p.stock, p.stock_minimo, p.categoria_id, c.nombre as categoria_nombre, 
            p.descuento_porcentaje, p.activo
        FROM productos p
        LEFT JOIN categorias c ON p.categoria_id = c.id
        WHERE p.codigo = ? AND p.activo = 1
    ";

    let mut stmt = match conn.prepare(query) {
        Ok(s) => s,
        Err(e) => {
            return ProductoResponse {
                success: false,
                message: format!("Error al preparar consulta: {}", e),
                producto: None,
            }
        }
    };

    let result = stmt.query_row([codigo], |row| {
        Ok(Producto {
            id: row.get(0)?,
            codigo: row.get(1)?,
            nombre: row.get(2)?,
            descripcion: row.get(3)?,
            precio: row.get(4)?,
            stock: row.get(5)?,
            stock_minimo: row.get(6)?,
            categoria_id: row.get(7)?,
            categoria_nombre: row.get(8)?,
            descuento_porcentaje: row.get(9)?,
            activo: row.get(10)?,
        })
    }).optional();

    match result {
        Ok(Some(producto)) => ProductoResponse {
            success: true,
            message: "Producto encontrado".to_string(),
            producto: Some(producto),
        },
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
    let conn = db.get_conn();

    let query = r"
        INSERT INTO productos (codigo, nombre, descripcion, precio, stock, stock_minimo, categoria_id, descuento_porcentaje)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ";

    let result = conn.execute(
        query,
        params![
            &producto.codigo,
            &producto.nombre,
            &producto.descripcion,
            producto.precio,
            producto.stock,
            producto.stock_minimo,
            producto.categoria_id,
            producto.descuento_porcentaje.unwrap_or(0.0),
        ],
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
    let conn = db.get_conn();

    let query = r"
        SELECT 
            p.id, p.codigo, p.nombre, p.stock, p.stock_minimo, c.nombre as categoria,
            (p.stock - p.stock_minimo) as diferencia
        FROM productos p
        LEFT JOIN categorias c ON p.categoria_id = c.id
        WHERE p.activo = 1 AND p.stock <= p.stock_minimo
        ORDER BY diferencia, p.nombre
    ";

    let mut stmt = match conn.prepare(query) {
        Ok(s) => s,
        Err(_) => {
            return ProductosResponse {
                success: false,
                productos: vec![],
            }
        }
    };

    let productos_iter = stmt.query_map([], |row| {
        Ok(Producto {
            id: row.get(0)?,
            codigo: row.get(1)?,
            nombre: row.get(2)?,
            descripcion: None,
            precio: 0.0,
            stock: row.get(3)?,
            stock_minimo: row.get(4)?,
            categoria_id: 0,
            categoria_nombre: row.get::<_, Option<String>>(5)?,
            descuento_porcentaje: 0.0,
            activo: true,
        })
    });

    match productos_iter {
        Ok(iter) => {
            let productos: Vec<Producto> = iter
                .filter_map(|r| r.ok())
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
    let conn = db.get_conn();

    let query = r"
        UPDATE productos 
        SET codigo = ?, 
            nombre = ?, 
            descripcion = ?, 
            precio = ?, 
            stock = ?, 
            stock_minimo = ?, 
            categoria_id = ?,
            descuento_porcentaje = ?
        WHERE id = ?
    ";

    let result = conn.execute(
        query,
        params![
            &codigo,
            &nombre,
            &descripcion,
            precio,
            stock,
            stock_minimo,
            categoria_id,
            descuento_porcentaje.unwrap_or(0.0),
            producto_id,
        ],
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
    let conn = db.get_conn();

    let query = "SELECT id, nombre FROM categorias WHERE activo = 1 ORDER BY nombre";
    
    let mut stmt = conn
        .prepare(query)
        .map_err(|e| format!("Error al preparar consulta: {}", e))?;
    
    let categorias_iter = stmt
        .query_map([], |row| {
            Ok((row.get::<_, i32>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| format!("Error al obtener categorías: {}", e))?;
    
    let categorias: Vec<(i32, String)> = categorias_iter
        .filter_map(|r| r.ok())
        .collect();
    
    Ok(categorias)
}

// Comando: Obtener solo nombres de categorías (para filtros)
#[tauri::command]
pub fn obtener_nombres_categorias(db: tauri::State<DatabasePool>) -> Result<Vec<String>, String> {
    let conn = db.get_conn();

    let query = "SELECT nombre FROM categorias WHERE activo = 1 ORDER BY nombre";
    
    let mut stmt = conn
        .prepare(query)
        .map_err(|e| format!("Error al preparar consulta: {}", e))?;
    
    let categorias_iter = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| format!("Error al obtener categorías: {}", e))?;
    
    let categorias: Vec<String> = categorias_iter
        .filter_map(|r| r.ok())
        .collect();
    
    Ok(categorias)
}

// Comando: Buscar productos con filtros (nombre, código, categoría)
#[tauri::command]
pub fn buscar_productos_filtrado(
    db: tauri::State<DatabasePool>,
    termino: String,
    categoria: Option<String>,
) -> Result<Vec<Producto>, String> {
    let conn = db.get_conn();

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

    // Filtro por término de búsqueda (nombre o código)
    if !termino.is_empty() {
        conditions.push(format!("(p.nombre LIKE '%{}%' OR p.codigo LIKE '%{}%')", termino, termino));
    }

    // Filtro por categoría
    if let Some(cat) = categoria {
        if !cat.is_empty() && cat != "TODAS" {
            conditions.push(format!("c.nombre = '{}'", cat));
        }
    }

    if !conditions.is_empty() {
        query.push_str(" AND ");
        query.push_str(&conditions.join(" AND "));
    }

    query.push_str(" ORDER BY p.nombre LIMIT 100");

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Error al preparar consulta: {}", e))?;

    let productos_iter = stmt
        .query_map([], |row| {
            Ok(Producto {
                id: row.get(0)?,
                codigo: row.get(1)?,
                nombre: row.get(2)?,
                descripcion: row.get(3)?,
                precio: row.get(4)?,
                stock: row.get(5)?,
                stock_minimo: row.get(6)?,
                categoria_id: row.get(7)?,
                categoria_nombre: row.get(8)?,
                descuento_porcentaje: row.get(9)?,
                activo: row.get(10)?,
            })
        })
        .map_err(|e| format!("Error al ejecutar consulta: {}", e))?;

    let productos: Vec<Producto> = productos_iter
        .filter_map(|r| r.ok())
        .collect();

    Ok(productos)
}