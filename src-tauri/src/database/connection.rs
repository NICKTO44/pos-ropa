// database/connection.rs
use rusqlite::{Connection, Result};
use std::sync::{Arc, Mutex};
use std::path::{Path, PathBuf};
use std::fs;

pub struct DatabasePool {
    conn: Arc<Mutex<Connection>>,
}

impl DatabasePool {
    pub fn new(db_path: &str) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        conn.execute("PRAGMA foreign_keys = ON", [])?;
        Ok(DatabasePool {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    pub fn get_conn(&self) -> std::sync::MutexGuard<Connection> {
        self.conn.lock().unwrap()
    }
}

pub fn get_database_path() -> PathBuf {
    let app_data_dir = if cfg!(target_os = "windows") {
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
        std::env::var("HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("."))
            .join("Library")
            .join("Application Support")
            .join("Sistema POS Ropa")
    } else {
        std::env::var("HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("."))
            .join(".local")
            .join("share")
            .join("sistema-pos-ropa")
    };

    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir).ok();
        println!("Directorio de datos creado: {:?}", app_data_dir);
    }

    app_data_dir.join("tienda.db")
}

pub fn migrate_database_if_needed() -> bool {
    let new_path = get_database_path();
    
    if new_path.exists() {
        println!("Base de datos ya esta en AppData");
        return true;
    }

    let old_path = std::env::current_dir()
        .ok()
        .map(|mut p| { p.push("tienda.db"); p });

    if let Some(old_path) = old_path {
        if old_path.exists() {
            match fs::copy(&old_path, &new_path) {
                Ok(_) => {
                    println!("Base de datos migrada a AppData");
                    return true;
                }
                Err(e) => {
                    eprintln!("Error al migrar BD: {}", e);
                    return false;
                }
            }
        }
    }

    println!("No hay base de datos para migrar");
    false
}

pub fn initialize_database(db_path: &str) -> Result<()> {
    println!("Inicializando base de datos en: {}", db_path);
    let conn = Connection::open(db_path)?;
    let schema = include_str!("../../schema_sqlite.sql");
    conn.execute_batch(schema)?;
    println!("Base de datos inicializada correctamente");
    Ok(())
}

pub fn database_exists(db_path: &str) -> bool {
    if !Path::new(db_path).exists() {
        return false;
    }
    if let Ok(conn) = Connection::open(db_path) {
        if let Ok(mut stmt) = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'") {
            return stmt.exists([]).unwrap_or(false);
        }
    }
    false
}

pub fn run_migrations(db_path: &str) -> Result<()> {
    let conn = Connection::open(db_path)?;

    // Migración: tabla licencias
    let has_licencias: bool = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='licencias'")?
        .exists([])?;

    if !has_licencias {
        println!("Ejecutando migracion: Agregar sistema de licencias...");
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
        println!("Migracion completada: Sistema de licencias agregado");
    } else {
        // Migración: columna primera_vez_mostrado
        let has_primera_vez: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('licencias') WHERE name='primera_vez_mostrado'",
                [],
                |row| Ok(row.get::<_, i32>(0)? > 0),
            )
            .unwrap_or(false);

        if !has_primera_vez {
            println!("Agregando columna primera_vez_mostrado...");
            conn.execute("ALTER TABLE licencias ADD COLUMN primera_vez_mostrado INTEGER DEFAULT 0", [])?;
            println!("Columna primera_vez_mostrado agregada");
        }
    }

    // 🆕 Migración: columnas de impresora en configuracion_tienda
    let has_impresora_ip: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('configuracion_tienda') WHERE name='impresora_ip'",
            [],
            |row| Ok(row.get::<_, i32>(0)? > 0),
        )
        .unwrap_or(false);

    if !has_impresora_ip {
        println!("Agregando columnas de impresora...");
        conn.execute_batch(r#"
            ALTER TABLE configuracion_tienda ADD COLUMN impresora_ip TEXT DEFAULT '';
            ALTER TABLE configuracion_tienda ADD COLUMN impresora_tipo TEXT DEFAULT 'TERMICA';
            ALTER TABLE configuracion_tienda ADD COLUMN impresora_puerto INTEGER DEFAULT 9100;
        "#)?;
        println!("Columnas de impresora agregadas");
    }

    println!("Base de datos actualizada");
    Ok(())
}

pub fn default_database_path() -> String {
    get_database_path().to_str().unwrap().to_string()
}

pub fn test_connection(db_path: &str) -> Result<bool> {
    let conn = Connection::open(db_path)?;
    let result: i32 = conn.query_row("SELECT 1", [], |row| row.get(0))?;
    Ok(result == 1)
}

pub fn setup_database() -> Result<String> {
    println!("Configurando base de datos...");
    migrate_database_if_needed();
    let db_path = get_database_path();
    let db_path_str = db_path.to_str().unwrap();
    println!("Ruta de base de datos: {}", db_path_str);

    if !database_exists(db_path_str) {
        println!("Base de datos no existe, inicializando...");
        initialize_database(db_path_str)?;
    } else {
        println!("Base de datos encontrada");
        run_migrations(db_path_str)?;
    }

    match test_connection(db_path_str) {
        Ok(true) => println!("Conexion a base de datos exitosa"),
        Ok(false) => eprintln!("Advertencia: Prueba de conexion fallo"),
        Err(e) => eprintln!("Error de conexion: {}", e),
    }

    Ok(db_path_str.to_string())
}
