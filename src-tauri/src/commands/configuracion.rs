// commands/configuracion.rs
// Comandos de configuración

use crate::database::DatabasePool;
use mysql::prelude::*;
use mysql::params;
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
    let mut conn = match db.get_conn() {
        Ok(c) => c,
        Err(e) => return Err(format!("Error de conexión: {}", e)),
    };

    let query = "SELECT id, nombre_tienda, direccion, telefono, email, rfc, mensaje_recibo FROM configuracion_tienda LIMIT 1";
    
    let result: Result<Option<(i32, String, String, String, String, String, String)>, _> = conn.query_first(query);

    match result {
        Ok(Some((id, nombre_tienda, direccion, telefono, email, rfc, mensaje_recibo))) => {
            Ok(ConfiguracionTienda {
                id,
                nombre_tienda,
                direccion,
                telefono,
                email,
                rfc,
                mensaje_recibo,
            })
        }
        Ok(None) => Err("No hay configuración registrada".to_string()),
        Err(e) => Err(format!("Error al obtener configuración: {}", e)),
    }
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
    let mut conn = match db.get_conn() {
        Ok(c) => c,
        Err(e) => return Err(format!("Error de conexión: {}", e)),
    };

    let query = r"
        UPDATE configuracion_tienda 
        SET nombre_tienda = :nombre_tienda,
            direccion = :direccion,
            telefono = :telefono,
            email = :email,
            rfc = :rfc,
            mensaje_recibo = :mensaje_recibo
        WHERE id = 1
    ";

    let result = conn.exec_drop(
        query,
        params! {
            "nombre_tienda" => &nombre_tienda,
            "direccion" => &direccion,
            "telefono" => &telefono,
            "email" => &email,
            "rfc" => &rfc,
            "mensaje_recibo" => &mensaje_recibo,
        },
    );

    match result {
        Ok(_) => Ok("Configuración actualizada exitosamente".to_string()),
        Err(e) => Err(format!("Error al actualizar configuración: {}", e)),
    }
}

// Comando: Agregar categoría
#[tauri::command]
pub fn agregar_categoria(
    db: tauri::State<DatabasePool>,
    nombre: String,
    descripcion: Option<String>,
) -> Result<String, String> {
    let mut conn = match db.get_conn() {
        Ok(c) => c,
        Err(e) => return Err(format!("Error de conexión: {}", e)),
    };

    let query = "INSERT INTO categorias (nombre, descripcion) VALUES (:nombre, :descripcion)";

    let result = conn.exec_drop(
        query,
        params! {
            "nombre" => &nombre,
            "descripcion" => &descripcion,
        },
    );

    match result {
        Ok(_) => Ok("Categoría agregada exitosamente".to_string()),
        Err(e) => Err(format!("Error al agregar categoría: {}", e)),
    }
}

// Comando: Actualizar categoría
#[tauri::command]
pub fn actualizar_categoria(
    db: tauri::State<DatabasePool>,
    categoria_id: i32,
    nombre: String,
    descripcion: Option<String>,
) -> Result<String, String> {
    let mut conn = match db.get_conn() {
        Ok(c) => c,
        Err(e) => return Err(format!("Error de conexión: {}", e)),
    };

    let query = r"
        UPDATE categorias 
        SET nombre = :nombre, descripcion = :descripcion
        WHERE id = :id
    ";

    let result = conn.exec_drop(
        query,
        params! {
            "id" => categoria_id,
            "nombre" => &nombre,
            "descripcion" => &descripcion,
        },
    );

    match result {
        Ok(_) => Ok("Categoría actualizada exitosamente".to_string()),
        Err(e) => Err(format!("Error al actualizar categoría: {}", e)),
    }
}

// Comando: Obtener todos los usuarios
#[tauri::command]
pub fn obtener_usuarios(db: tauri::State<DatabasePool>) -> Result<Vec<Usuario>, String> {
    let mut conn = match db.get_conn() {
        Ok(c) => c,
        Err(e) => return Err(format!("Error de conexión: {}", e)),
    };

    let query = r"
        SELECT u.id, u.username, u.nombre_completo, u.email, u.rol_id, r.nombre as rol_nombre, u.activo
        FROM usuarios u
        JOIN roles r ON u.rol_id = r.id
        ORDER BY u.nombre_completo
    ";

    let result: Result<Vec<(i32, String, String, Option<String>, i32, String, bool)>, _> = conn.query(query);

    match result {
        Ok(rows) => {
            let usuarios = rows
                .into_iter()
                .map(|(id, username, nombre_completo, email, rol_id, rol_nombre, activo)| Usuario {
                    id,
                    username,
                    nombre_completo,
                    email,
                    rol_id,
                    rol_nombre,
                    activo,
                })
                .collect();
            Ok(usuarios)
        }
        Err(e) => Err(format!("Error al obtener usuarios: {}", e)),
    }
}

// Comando: Obtener todos los roles
#[tauri::command]
pub fn obtener_roles(db: tauri::State<DatabasePool>) -> Result<Vec<Rol>, String> {
    let mut conn = match db.get_conn() {
        Ok(c) => c,
        Err(e) => return Err(format!("Error de conexión: {}", e)),
    };

    let query = "SELECT id, nombre FROM roles WHERE activo = TRUE ORDER BY nombre";
    
    let result: Result<Vec<(i32, String)>, _> = conn.query(query);

    match result {
        Ok(rows) => {
            let roles = rows
                .into_iter()
                .map(|(id, nombre)| Rol { id, nombre })
                .collect();
            Ok(roles)
        }
        Err(e) => Err(format!("Error al obtener roles: {}", e)),
    }
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
    let mut conn = match db.get_conn() {
        Ok(c) => c,
        Err(e) => return Err(format!("Error de conexión: {}", e)),
    };

    // Hashear password con bcrypt
    let password_hash = bcrypt::hash(&password, bcrypt::DEFAULT_COST)
        .map_err(|e| format!("Error al hashear contraseña: {}", e))?;

    let query = r"
        INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol_id)
        VALUES (:username, :password_hash, :nombre_completo, :email, :rol_id)
    ";

    let result = conn.exec_drop(
        query,
        params! {
            "username" => &username,
            "password_hash" => &password_hash,
            "nombre_completo" => &nombre_completo,
            "email" => &email,
            "rol_id" => rol_id,
        },
    );

    match result {
        Ok(_) => Ok("Usuario agregado exitosamente".to_string()),
        Err(e) => Err(format!("Error al agregar usuario: {}", e)),
    }
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
    let mut conn = match db.get_conn() {
        Ok(c) => c,
        Err(e) => return Err(format!("Error de conexión: {}", e)),
    };

    let query = if let Some(pass) = nueva_password {
        let password_hash = bcrypt::hash(&pass, bcrypt::DEFAULT_COST)
            .map_err(|e| format!("Error al hashear contraseña: {}", e))?;
        
        conn.exec_drop(
            r"UPDATE usuarios 
              SET username = :username, 
                  nombre_completo = :nombre_completo, 
                  email = :email, 
                  rol_id = :rol_id,
                  password_hash = :password_hash
              WHERE id = :id",
            params! {
                "id" => usuario_id,
                "username" => &username,
                "nombre_completo" => &nombre_completo,
                "email" => &email,
                "rol_id" => rol_id,
                "password_hash" => &password_hash,
            },
        )
    } else {
        conn.exec_drop(
            r"UPDATE usuarios 
              SET username = :username, 
                  nombre_completo = :nombre_completo, 
                  email = :email, 
                  rol_id = :rol_id
              WHERE id = :id",
            params! {
                "id" => usuario_id,
                "username" => &username,
                "nombre_completo" => &nombre_completo,
                "email" => &email,
                "rol_id" => rol_id,
            },
        )
    };

    match query {
        Ok(_) => Ok("Usuario actualizado exitosamente".to_string()),
        Err(e) => Err(format!("Error al actualizar usuario: {}", e)),
    }
}
