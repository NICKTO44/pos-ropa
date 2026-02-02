// database/connection.rs
// Manejo de conexión a SQLite con BD en AppData

use rusqlite::{Connection, Result};
use std::sync::{Arc, Mutex};
use std::path::{Path, PathBuf};
use std::fs;

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

// 🔧 NUEVO: Obtener ruta de AppData (preserva datos al actualizar)
pub fn get_database_path() -> PathBuf {
    // Obtener directorio de datos de la aplicación
    let app_data_dir = if cfg!(target_os = "windows") {
        // Windows: C:\Users\Usuario\AppData\Roaming\Sistema POS Ropa\
        std::env::var("APPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                let mut path = std::env::var("USERPROFILE")
                    .map(PathBuf::from)
                    .unwrap_or_else(|_| PathBuf::from("."));
                path.push("AppData");
                path.push("Roaming");
                path
            })
            .join("Sistema POS Ropa")
    } else if cfg!(target_os = "macos") {
        // macOS: ~/Library/Application Support/Sistema POS Ropa/
        std::env::var("HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("."))
            .join("Library")
            .join("Application Support")
            .join("Sistema POS Ropa")
    } else {
        // Linux: ~/.local/share/sistema-pos-ropa/
        std::env::var("HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("."))
            .join(".local")
            .join("share")
            .join("sistema-pos-ropa")
    };

    // Crear directorio si no existe
    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir).ok();
        println!("📁 Directorio de datos creado: {:?}", app_data_dir);
    }

    app_data_dir.join("tienda.db")
}

// 🔧 NUEVO: Migrar BD de ubicación antigua a AppData
pub fn migrate_database_if_needed() -> bool {
    let new_path = get_database_path();
    
    // Si ya existe en AppData, no hacer nada
    if new_path.exists() {
        println!("✅ Base de datos ya está en AppData");
        return true;
    }

    // Buscar BD en ubicación antigua (current_dir)
    let old_path = std::env::current_dir()
        .ok()
        .map(|mut p| {
            p.push("tienda.db");
            p
        });

    if let Some(old_path) = old_path {
        if old_path.exists() {
            // Copiar BD a nueva ubicación
            match fs::copy(&old_path, &new_path) {
                Ok(_) => {
                    println!("✅ Base de datos migrada a AppData");
                    println!("   Desde: {:?}", old_path);
                    println!("   Hacia: {:?}", new_path);
                    return true;
                }
                Err(e) => {
                    eprintln!("❌ Error al migrar BD: {}", e);
                    return false;
                }
            }
        }
    }

    println!("ℹ️ No hay base de datos para migrar");
    false
}

// Función para inicializar la base de datos (primera vez)
pub fn initialize_database(db_path: &str) -> Result<()> {
    println!("🔧 Inicializando base de datos en: {}", db_path);
    
    let conn = Connection::open(db_path)?;
    
    // 🔧 USAR EL SCHEMA EXISTENTE
    let schema = include_str!("../../schema_sqlite.sql");
    conn.execute_batch(schema)?;
    
    println!("✅ Base de datos inicializada correctamente");
    Ok(())
}

// 🔧 FUNCIÓN CORREGIDA: Verificar si la BD existe y tiene tablas
pub fn database_exists(db_path: &str) -> bool {
    // Primero verificar si el archivo existe
    if !Path::new(db_path).exists() {
        return false;
    }
    
    // Si existe, verificar que tenga tablas
    if let Ok(conn) = Connection::open(db_path) {
        if let Ok(mut stmt) = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'") {
            return stmt.exists([]).unwrap_or(false);
        }
    }
    false
}

// 🔧 NUEVO: Verificar y ejecutar migraciones de actualización
pub fn run_migrations(db_path: &str) -> Result<()> {
    let conn = Connection::open(db_path)?;
    
    // Verificar si tabla licencias existe
    let has_licencias: bool = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='licencias'")?
        .exists([])?;
    
    if !has_licencias {
        println!("🔧 Ejecutando migración: Agregar sistema de licencias...");
        
        // Crear tablas de licencias (CON primera_vez_mostrado)
        conn.execute_batch(r#"
            CREATE TABLE IF NOT EXISTS licencias (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tipo_licencia TEXT NOT NULL DEFAULT 'TRIAL',
                estado TEXT NOT NULL DEFAULT 'ACTIVO',
                fecha_instalacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_expiracion TIMESTAMP,
                codigo_activacion TEXT,
                fecha_ultima_activacion TIMESTAMP,
                intentos_activacion INTEGER DEFAULT 0,
                primera_vez_mostrado INTEGER DEFAULT 0
            );

            INSERT INTO licencias (tipo_licencia, estado, fecha_expiracion)
            SELECT 'TRIAL', 'ACTIVO', datetime('now', '+15 days')
            WHERE NOT EXISTS (SELECT 1 FROM licencias WHERE id = 1);

            CREATE TABLE IF NOT EXISTS historial_licencias (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tipo_licencia TEXT NOT NULL,
                codigo_activacion TEXT,
                fecha_activacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_expiracion TIMESTAMP,
                estado TEXT,
                notas TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_licencias_estado ON licencias(estado);
            CREATE INDEX IF NOT EXISTS idx_licencias_codigo ON licencias(codigo_activacion);
            CREATE INDEX IF NOT EXISTS idx_historial_fecha ON historial_licencias(fecha_activacion);
        "#)?;
        
        println!("✅ Migración completada: Sistema de licencias agregado");
    } else {
        println!("✅ Base de datos actualizada");
        
        // 🆕 MIGRACIÓN: Agregar columna primera_vez_mostrado si no existe
        let has_columna: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('licencias') WHERE name='primera_vez_mostrado'",
                [],
                |row| Ok(row.get::<_, i32>(0)? > 0),
            )
            .unwrap_or(false);
        
        if !has_columna {
            println!("🔧 Agregando columna primera_vez_mostrado...");
            conn.execute(
                "ALTER TABLE licencias ADD COLUMN primera_vez_mostrado INTEGER DEFAULT 0",
                [],
            )?;
            println!("✅ Columna primera_vez_mostrado agregada");
        }
    }
    
    Ok(())
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

// 🔧 NUEVO: Función de setup completo
pub fn setup_database() -> Result<String> {
    println!("🚀 Configurando base de datos...");
    
    // 1. Migrar BD antigua si existe
    migrate_database_if_needed();
    
    // 2. Obtener ruta en AppData
    let db_path = get_database_path();
    let db_path_str = db_path.to_str().unwrap();
    
    println!("📍 Ruta de base de datos: {}", db_path_str);
    
    // 3. Si no existe, inicializar
    if !database_exists(db_path_str) {
        println!("🔧 Base de datos no existe, inicializando...");
        initialize_database(db_path_str)?;
    } else {
        println!("✅ Base de datos encontrada");
        
        // 4. Ejecutar migraciones de actualización
        run_migrations(db_path_str)?;
    }
    
    // 5. Probar conexión
    match test_connection(db_path_str) {
        Ok(true) => println!("✅ Conexión a base de datos exitosa"),
        Ok(false) => eprintln!("⚠️ Advertencia: Prueba de conexión falló"),
        Err(e) => eprintln!("❌ Error de conexión: {}", e),
    }
    
    Ok(db_path_str.to_string())
}