// database/connection.rs
// Manejo de conexión a MySQL

use mysql::*;
use mysql::prelude::*;
use std::sync::{Arc, Mutex};

// Pool de conexiones global
pub struct DatabasePool {
    pool: Arc<Mutex<Pool>>,
}

impl DatabasePool {
    // Crear nueva instancia del pool
    pub fn new(url: &str) -> Result<Self> {
        let pool = Pool::new(url)?;
        Ok(DatabasePool {
            pool: Arc::new(Mutex::new(pool)),
        })
    }

    // Obtener una conexión del pool
    pub fn get_conn(&self) -> Result<PooledConn> {
        let pool = self.pool.lock().unwrap();
        pool.get_conn()
    }
}

// Función para crear la URL de conexión
pub fn create_database_url(
    host: &str,
    port: u16,
    database: &str,
    user: &str,
    password: &str,
) -> String {
    format!(
        "mysql://{}:{}@{}:{}/{}",
        user, password, host, port, database
    )
}

// Configuración por defecto
pub fn default_database_url() -> String {
    create_database_url(
        "localhost",
        3306,
        "tienda_db",
        "root",
        "root", // ⚠️ CAMBIAR ESTO
    )
}

// Probar conexión a la base de datos
pub fn test_connection(url: &str) -> Result<bool> {
    let pool = Pool::new(url)?;
    let mut conn = pool.get_conn()?;
    
    // Hacer una consulta simple
    let result: Option<i32> = conn.query_first("SELECT 1")?;
    
    Ok(result == Some(1))
}
