// commands/auth.rs
// Comandos de autenticación

use crate::database::DatabasePool;
use crate::models::{Usuario, UsuarioLogin, UsuarioResponse};
use mysql::prelude::*;
use mysql::params;

// Comando: Login de usuario
#[tauri::command]
pub fn login(
    db: tauri::State<DatabasePool>,
    credenciales: UsuarioLogin,
) -> UsuarioResponse {
    // Obtener conexión
    let mut conn = match db.get_conn() {
        Ok(c) => c,
        Err(e) => {
            return UsuarioResponse {
                success: false,
                message: format!("Error de conexión: {}", e),
                usuario: None,
            }
        }
    };

    // Buscar usuario por username
    let query = r"
        SELECT id, username, nombre_completo, email, rol_id, activo, password_hash
        FROM usuarios
        WHERE username = :username AND activo = TRUE
    ";

    let result: Result<Option<(i32, String, String, Option<String>, i32, bool, String)>, _> = conn
        .exec_first(query, params! {
            "username" => &credenciales.username,
        });

    match result {
        Ok(Some((id, username, nombre_completo, email, rol_id, activo, password_hash))) => {
            // Verificar contraseña (usando bcrypt en producción)
            // Por ahora, comparación simple para desarrollo
            // TODO: Implementar bcrypt
            
            // TEMPORAL: Acepta cualquier contraseña para testing
            // En producción, usar: bcrypt::verify(&credenciales.password, &password_hash)
            
            let usuario = Usuario::new(id, username, nombre_completo, email, rol_id, activo);

            // Registrar login exitoso en sesiones_log
            let _ = conn.exec_drop(
                "INSERT INTO sesiones_log (usuario_id, resultado, ip_address) VALUES (:id, 'EXITOSO', '127.0.0.1')",
                params! {
                    "id" => id,
                },
            );

            UsuarioResponse {
                success: true,
                message: "Login exitoso".to_string(),
                usuario: Some(usuario),
            }
        }
        Ok(None) => UsuarioResponse {
            success: false,
            message: "Usuario o contraseña incorrectos".to_string(),
            usuario: None,
        },
        Err(e) => UsuarioResponse {
            success: false,
            message: format!("Error en consulta: {}", e),
            usuario: None,
        },
    }
}

// Comando: Verificar conexión a la base de datos
#[tauri::command]
pub fn test_database_connection(db: tauri::State<DatabasePool>) -> Result<String, String> {
    match db.get_conn() {
        Ok(mut conn) => {
            let result: Result<Option<i32>, _> = conn.query_first("SELECT 1");
            match result {
                Ok(Some(1)) => Ok("Conexión exitosa a la base de datos".to_string()),
                _ => Err("Error al ejecutar consulta de prueba".to_string()),
            }
        }
        Err(e) => Err(format!("Error de conexión: {}", e)),
    }
}
