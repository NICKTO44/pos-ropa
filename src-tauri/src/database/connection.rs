// database/connection.rs
// Manejo de conexión a SQLite

use rusqlite::{Connection, Result};
use std::sync::{Arc, Mutex};
use std::path::PathBuf;

// Pool de conexiones SQLite
pub struct DatabasePool {
    conn: Arc<Mutex<Connection>>,
}

impl DatabasePool {
    // Crear nueva instancia con conexión a SQLite
    pub fn new(db_path: &str) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        
        // Habilitar foreign keys (importante!)
        conn.execute("PRAGMA foreign_keys = ON", [])?;
        
        Ok(DatabasePool {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

   
    pub fn get_conn(&self) -> std::sync::MutexGuard<Connection> {
        self.conn.lock().unwrap()
    }
}

// Función para obtener la ruta de la base de datos
pub fn get_database_path() -> PathBuf {
    // En producción, guardar en directorio de datos de la aplicación
    let mut path = std::env::current_dir().unwrap();
    path.push("tienda.db");
    path
}

// Función para inicializar la base de datos (primera vez)
pub fn initialize_database(db_path: &str) -> Result<()> {
    let conn = Connection::open(db_path)?;
    
    // Leer y ejecutar el script SQL de inicialización
    let schema = include_str!("../../schema_sqlite.sql");
    conn.execute_batch(schema)?;
    
    println!("✅ Base de datos inicializada correctamente");
    Ok(())
}

// Función para verificar si la BD existe y tiene tablas
pub fn database_exists(db_path: &str) -> bool {
    if let Ok(conn) = Connection::open(db_path) {
        if let Ok(mut stmt) = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'") {
            return stmt.exists([]).unwrap_or(false);
        }
    }
    false
}

// Configuración por defecto
pub fn default_database_path() -> String {
    get_database_path().to_str().unwrap().to_string()
}

// Probar conexión a la base de datos
pub fn test_connection(db_path: &str) -> Result<bool> {
    let conn = Connection::open(db_path)?;
    let result: i32 = conn.query_row("SELECT 1", [], |row| row.get(0))?;
    Ok(result == 1)
}