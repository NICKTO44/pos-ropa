
use rusqlite::OptionalExtension;
use crate::database::DatabasePool;
use rusqlite::params;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ConfiguracionTienda {
    pub id: i32,
    pub nombre_tienda: String,
    pub direccion: String,
    pub telefono: String,
    pub email: String,
    pub rfc: String,
    pub mensaje_recibo: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Categoria {
    pub id: i32,
    pub nombre: String,
    pub descripcion: Option<String>,
    pub activo: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Usuario {
    pub id: i32,
    pub username: String,
    pub nombre_completo: String,
    pub email: Option<String>,
    pub rol_id: i32,
    pub rol_nombre: String,
    pub activo: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Rol {
    pub id: i32,
    pub nombre: String,
}

// Comando: Obtener configuración de la tienda
#[tauri::command]
pub fn obtener_configuracion_tienda(
    db: tauri::State<DatabasePool>,
) -> Result<ConfiguracionTienda, String> {
    let conn = db.get_conn();

    let query = "SELECT id, nombre_tienda, direccion, telefono, email, rfc, mensaje_recibo FROM configuracion_tienda LIMIT 1";
    
    let result = conn
        .query_row(query, [], |row| {
            Ok(ConfiguracionTienda {
                id: row.get(0)?,
                nombre_tienda: row.get(1)?,
                direccion: row.get(2)?,
                telefono: row.get(3)?,
                email: row.get(4)?,
                rfc: row.get(5)?,
                mensaje_recibo: row.get(6)?,
            })
        })
        .optional()
        .map_err(|e| format!("Error al obtener configuración: {}", e))?;

    result.ok_or_else(|| "No hay configuración registrada".to_string())
}

// Comando: Actualizar configuración de la tienda
#[tauri::command]
pub fn actualizar_configuracion_tienda(
    db: tauri::State<DatabasePool>,
    nombre_tienda: String,
    direccion: String,
    telefono: String,
    email: String,
    rfc: String,
    mensaje_recibo: String,
) -> Result<String, String> {
    let conn = db.get_conn();

    let query = r"
        UPDATE configuracion_tienda 
        SET nombre_tienda = ?,
            direccion = ?,
            telefono = ?,
            email = ?,
            rfc = ?,
            mensaje_recibo = ?
        WHERE id = 1
    ";

    conn.execute(
        query,
        params![
            &nombre_tienda,
            &direccion,
            &telefono,
            &email,
            &rfc,
            &mensaje_recibo,
        ],
    )
    .map_err(|e| format!("Error al actualizar configuración: {}", e))?;

    Ok("Configuración actualizada exitosamente".to_string())
}

// Comando: Agregar categoría
#[tauri::command]
pub fn agregar_categoria(
    db: tauri::State<DatabasePool>,
    nombre: String,
    descripcion: Option<String>,
) -> Result<String, String> {
    let conn = db.get_conn();

    let query = "INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)";

    conn.execute(query, params![&nombre, &descripcion])
        .map_err(|e| format!("Error al agregar categoría: {}", e))?;

    Ok("Categoría agregada exitosamente".to_string())
}

// Comando: Actualizar categoría
#[tauri::command]
pub fn actualizar_categoria(
    db: tauri::State<DatabasePool>,
    categoria_id: i32,
    nombre: String,
    descripcion: Option<String>,
) -> Result<String, String> {
    let conn = db.get_conn();

    let query = r"
        UPDATE categorias 
        SET nombre = ?, descripcion = ?
        WHERE id = ?
    ";

    conn.execute(query, params![&nombre, &descripcion, categoria_id])
        .map_err(|e| format!("Error al actualizar categoría: {}", e))?;

    Ok("Categoría actualizada exitosamente".to_string())
}

// Comando: Obtener todos los usuarios
#[tauri::command]
pub fn obtener_usuarios(db: tauri::State<DatabasePool>) -> Result<Vec<Usuario>, String> {
    let conn = db.get_conn();

    let query = r"
        SELECT u.id, u.username, u.nombre_completo, u.email, u.rol_id, r.nombre as rol_nombre, u.activo
        FROM usuarios u
        JOIN roles r ON u.rol_id = r.id
        ORDER BY u.nombre_completo
    ";

    let mut stmt = conn
        .prepare(query)
        .map_err(|e| format!("Error al preparar consulta: {}", e))?;

    let usuarios_iter = stmt
        .query_map([], |row| {
            Ok(Usuario {
                id: row.get(0)?,
                username: row.get(1)?,
                nombre_completo: row.get(2)?,
                email: row.get(3)?,
                rol_id: row.get(4)?,
                rol_nombre: row.get(5)?,
                activo: row.get(6)?,
            })
        })
        .map_err(|e| format!("Error al obtener usuarios: {}", e))?;

    let usuarios: Vec<Usuario> = usuarios_iter
        .filter_map(|r| r.ok())
        .collect();

    Ok(usuarios)
}

// Comando: Obtener todos los roles
#[tauri::command]
pub fn obtener_roles(db: tauri::State<DatabasePool>) -> Result<Vec<Rol>, String> {
    let conn = db.get_conn();

    let query = "SELECT id, nombre FROM roles WHERE activo = 1 ORDER BY nombre";
    
    let mut stmt = conn
        .prepare(query)
        .map_err(|e| format!("Error al preparar consulta: {}", e))?;

    let roles_iter = stmt
        .query_map([], |row| {
            Ok(Rol {
                id: row.get(0)?,
                nombre: row.get(1)?,
            })
        })
        .map_err(|e| format!("Error al obtener roles: {}", e))?;

    let roles: Vec<Rol> = roles_iter
        .filter_map(|r| r.ok())
        .collect();

    Ok(roles)
}

// Comando: Agregar usuario
#[tauri::command]
pub fn agregar_usuario(
    db: tauri::State<DatabasePool>,
    username: String,
    password: String,
    nombre_completo: String,
    email: Option<String>,
    rol_id: i32,
) -> Result<String, String> {
    let conn = db.get_conn();

    // Hashear password con bcrypt
    let password_hash = bcrypt::hash(&password, bcrypt::DEFAULT_COST)
        .map_err(|e| format!("Error al hashear contraseña: {}", e))?;

    let query = r"
        INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol_id)
        VALUES (?, ?, ?, ?, ?)
    ";

    conn.execute(
        query,
        params![&username, &password_hash, &nombre_completo, &email, rol_id],
    )
    .map_err(|e| format!("Error al agregar usuario: {}", e))?;

    Ok("Usuario agregado exitosamente".to_string())
}

// Comando: Actualizar usuario
#[tauri::command]
pub fn actualizar_usuario(
    db: tauri::State<DatabasePool>,
    usuario_id: i32,
    username: String,
    nombre_completo: String,
    email: Option<String>,
    rol_id: i32,
    nueva_password: Option<String>,
) -> Result<String, String> {
    let conn = db.get_conn();

    if let Some(pass) = nueva_password {
        let password_hash = bcrypt::hash(&pass, bcrypt::DEFAULT_COST)
            .map_err(|e| format!("Error al hashear contraseña: {}", e))?;
        
        conn.execute(
            r"UPDATE usuarios 
              SET username = ?, 
                  nombre_completo = ?, 
                  email = ?, 
                  rol_id = ?,
                  password_hash = ?
              WHERE id = ?",
            params![
                &username,
                &nombre_completo,
                &email,
                rol_id,
                &password_hash,
                usuario_id,
            ],
        )
        .map_err(|e| format!("Error al actualizar usuario: {}", e))?;
    } else {
        conn.execute(
            r"UPDATE usuarios 
              SET username = ?, 
                  nombre_completo = ?, 
                  email = ?, 
                  rol_id = ?
              WHERE id = ?",
            params![&username, &nombre_completo, &email, rol_id, usuario_id],
        )
        .map_err(|e| format!("Error al actualizar usuario: {}", e))?;
    }

    Ok("Usuario actualizado exitosamente".to_string())
}