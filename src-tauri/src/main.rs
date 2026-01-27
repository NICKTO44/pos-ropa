// main.rs
// Archivo principal de la aplicación Tauri

// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod database;
mod models;
mod commands;

use database::{DatabasePool, default_database_url};
use commands::*;

fn main() {
    // Crear pool de conexiones a la base de datos
    let database_url = default_database_url();
    
    let db_pool = match DatabasePool::new(&database_url) {
        Ok(pool) => {
            println!("✅ Conexión a base de datos establecida");
            pool
        }
        Err(e) => {
            eprintln!("❌ Error al conectar a la base de datos: {}", e);
            eprintln!("⚠️  La aplicación continuará pero las funciones de BD no estarán disponibles");
            eprintln!("💡 Verifica que MySQL esté corriendo y las credenciales sean correctas");
            
            // Crear un pool con configuración por defecto (fallará en uso pero permite iniciar la app)
            DatabasePool::new("mysql://localhost:3306/tienda_db").unwrap()
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
            obtener_categorias, 
            obtener_nombres_categorias,          // ← AGREGAR
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
            buscar_venta_para_devolucion,
            procesar_devolucion,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}