// main.rs
// Archivo principal de la aplicación Tauri - SQLite

// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod database;
mod models;
mod commands;

use database::{DatabasePool, default_database_path, database_exists, initialize_database};
use commands::*;

fn main() {
    // Obtener ruta de la base de datos
    let db_path = default_database_path();
    
    // Verificar si la base de datos existe, si no, crearla
    if !database_exists(&db_path) {
        println!("📦 Base de datos no encontrada. Creando nueva base de datos...");
        match initialize_database(&db_path) {
            Ok(_) => println!("✅ Base de datos SQLite creada exitosamente en: {}", db_path),
            Err(e) => {
                eprintln!("❌ Error fatal al crear base de datos: {}", e);
                eprintln!("💡 Verifica permisos de escritura en el directorio");
                panic!("No se puede continuar sin base de datos");
            }
        }
    } else {
        println!("✅ Base de datos SQLite encontrada: {}", db_path);
    }
    
    // Crear pool de conexiones
    let db_pool = match DatabasePool::new(&db_path) {
        Ok(pool) => {
            println!("✅ Conexión a SQLite establecida correctamente");
            pool
        }
        Err(e) => {
            eprintln!("❌ Error al conectar a la base de datos: {}", e);
            eprintln!("💡 Verifica que el archivo tienda.db no esté corrupto");
            panic!("No se puede continuar sin base de datos");
        }
    };

    tauri::Builder::default()
        .manage(db_pool)
        .invoke_handler(tauri::generate_handler![
            // Comandos de autenticación
            login,
            test_database_connection,
            // Comandos de productos
            obtener_productos,
            buscar_producto_por_codigo,
            agregar_producto,
            obtener_productos_stock_bajo,
            actualizar_producto,
            obtener_categorias,
            obtener_nombres_categorias,
            buscar_productos_filtrado, 
            // Comandos de ventas
            procesar_venta,
            // Comandos de reportes
            obtener_ventas_rango,
            obtener_productos_mas_vendidos,
            obtener_estadisticas_ventas,
            obtener_ventas_hoy,
            obtener_estadisticas_con_devoluciones,
            // Comandos de configuración
            obtener_configuracion_tienda,
            actualizar_configuracion_tienda,
            agregar_categoria,
            actualizar_categoria,
            obtener_usuarios,
            obtener_roles,
            agregar_usuario,
            actualizar_usuario,
            // Comandos de devoluciones
            buscar_venta_para_devolucion,
            procesar_devolucion,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}