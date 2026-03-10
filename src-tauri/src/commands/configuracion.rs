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
    pub impresora_ip: String,
    pub impresora_tipo: String,
    pub impresora_puerto: i32,
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

#[tauri::command]
pub fn obtener_configuracion_tienda(
    db: tauri::State<DatabasePool>,
) -> Result<ConfiguracionTienda, String> {
    let conn = db.get_conn();

    let query = "SELECT id, nombre_tienda, direccion, telefono, email, rfc, mensaje_recibo, COALESCE(impresora_ip, ''), COALESCE(impresora_tipo, 'TERMICA'), COALESCE(impresora_puerto, 9100) FROM configuracion_tienda LIMIT 1";
    
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
                impresora_ip: row.get(7)?,
                impresora_tipo: row.get(8)?,
                impresora_puerto: row.get(9)?,
            })
        })
        .optional()
        .map_err(|e| format!("Error al obtener configuracion: {}", e))?;

    result.ok_or_else(|| "No hay configuracion registrada".to_string())
}

#[tauri::command]
pub fn actualizar_configuracion_tienda(
    db: tauri::State<DatabasePool>,
    nombre_tienda: String,
    direccion: String,
    telefono: String,
    email: String,
    rfc: String,
    mensaje_recibo: String,
    impresora_ip: String,
    impresora_tipo: String,
    impresora_puerto: i32,
) -> Result<String, String> {
    let conn = db.get_conn();

    let query = r"
        UPDATE configuracion_tienda 
        SET nombre_tienda = ?,
            direccion = ?,
            telefono = ?,
            email = ?,
            rfc = ?,
            mensaje_recibo = ?,
            impresora_ip = ?,
            impresora_tipo = ?,
            impresora_puerto = ?
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
            &impresora_ip,
            &impresora_tipo,
            impresora_puerto,
        ],
    )
    .map_err(|e| format!("Error al actualizar configuracion: {}", e))?;

    Ok("Configuracion actualizada exitosamente".to_string())
}

#[tauri::command]
pub fn agregar_categoria(
    db: tauri::State<DatabasePool>,
    nombre: String,
    descripcion: Option<String>,
) -> Result<String, String> {
    let conn = db.get_conn();
    conn.execute(
        "INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)",
        params![&nombre, &descripcion],
    )
    .map_err(|e| format!("Error al agregar categoria: {}", e))?;
    Ok("Categoria agregada exitosamente".to_string())
}

#[tauri::command]
pub fn actualizar_categoria(
    db: tauri::State<DatabasePool>,
    categoria_id: i32,
    nombre: String,
    descripcion: Option<String>,
) -> Result<String, String> {
    let conn = db.get_conn();
    conn.execute(
        "UPDATE categorias SET nombre = ?, descripcion = ? WHERE id = ?",
        params![&nombre, &descripcion, categoria_id],
    )
    .map_err(|e| format!("Error al actualizar categoria: {}", e))?;
    Ok("Categoria actualizada exitosamente".to_string())
}

#[tauri::command]
pub fn obtener_usuarios(db: tauri::State<DatabasePool>) -> Result<Vec<Usuario>, String> {
    let conn = db.get_conn();
    let mut stmt = conn
        .prepare(r"
            SELECT u.id, u.username, u.nombre_completo, u.email, u.rol_id, r.nombre as rol_nombre, u.activo
            FROM usuarios u
            JOIN roles r ON u.rol_id = r.id
            ORDER BY u.nombre_completo
        ")
        .map_err(|e| format!("Error al preparar consulta: {}", e))?;

    let usuarios: Vec<Usuario> = stmt
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
        .map_err(|e| format!("Error al obtener usuarios: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(usuarios)
}

#[tauri::command]
pub fn obtener_roles(db: tauri::State<DatabasePool>) -> Result<Vec<Rol>, String> {
    let conn = db.get_conn();
    let mut stmt = conn
        .prepare("SELECT id, nombre FROM roles WHERE activo = 1 ORDER BY nombre")
        .map_err(|e| format!("Error al preparar consulta: {}", e))?;

    let roles: Vec<Rol> = stmt
        .query_map([], |row| {
            Ok(Rol {
                id: row.get(0)?,
                nombre: row.get(1)?,
            })
        })
        .map_err(|e| format!("Error al obtener roles: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(roles)
}

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
    let password_hash = bcrypt::hash(&password, bcrypt::DEFAULT_COST)
        .map_err(|e| format!("Error al hashear contrasena: {}", e))?;

    conn.execute(
        "INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol_id) VALUES (?, ?, ?, ?, ?)",
        params![&username, &password_hash, &nombre_completo, &email, rol_id],
    )
    .map_err(|e| format!("Error al agregar usuario: {}", e))?;

    Ok("Usuario agregado exitosamente".to_string())
}

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
            .map_err(|e| format!("Error al hashear contrasena: {}", e))?;
        conn.execute(
            r"UPDATE usuarios SET username = ?, nombre_completo = ?, email = ?, rol_id = ?, password_hash = ? WHERE id = ?",
            params![&username, &nombre_completo, &email, rol_id, &password_hash, usuario_id],
        )
        .map_err(|e| format!("Error al actualizar usuario: {}", e))?;
    } else {
        conn.execute(
            r"UPDATE usuarios SET username = ?, nombre_completo = ?, email = ?, rol_id = ? WHERE id = ?",
            params![&username, &nombre_completo, &email, rol_id, usuario_id],
        )
        .map_err(|e| format!("Error al actualizar usuario: {}", e))?;
    }

    Ok("Usuario actualizado exitosamente".to_string())
}