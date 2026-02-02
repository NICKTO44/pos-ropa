// commands/licencias.rs
// Sistema de control de licencias

use crate::database::DatabasePool;
use rusqlite::params;
use serde::{Deserialize, Serialize};

// =====================================================
// ESTRUCTURAS
// =====================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct EstadoLicencia {
    pub tipo_licencia: String,
    pub estado: String,
    pub fecha_instalacion: String,
    pub fecha_expiracion: String,
    pub dias_restantes: i32,
    pub puede_operar: bool,
    pub modo_solo_lectura: bool,
    pub codigo_activacion: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ResultadoActivacion {
    pub success: bool,
    pub mensaje: String,
    pub nueva_fecha_expiracion: Option<String>,
    pub tipo_licencia: Option<String>,
}

// =====================================================
// COMANDO: Obtener estado actual de la licencia
// =====================================================
#[tauri::command]
pub fn obtener_estado_licencia(
    db: tauri::State<DatabasePool>,
) -> Result<EstadoLicencia, String> {
    let conn = db.get_conn();

    // Obtener licencia actual (siempre hay 1 registro)
    let query = "
        SELECT 
            tipo_licencia,
            estado,
            fecha_instalacion,
            fecha_expiracion,
            codigo_activacion
        FROM licencias
        WHERE id = 1
    ";

    let mut stmt = conn
        .prepare(query)
        .map_err(|e| format!("Error al preparar query: {}", e))?;

    let resultado = stmt.query_row([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, Option<String>>(4)?,
        ))
    });

    match resultado {
        Ok((tipo_licencia, estado, fecha_instalacion, fecha_expiracion, codigo_activacion)) => {
            // Calcular días restantes
            let dias_restantes = calcular_dias_restantes_interno(&conn, &fecha_expiracion)?;

            // Determinar si puede operar
            let puede_operar = estado == "ACTIVO" || estado == "GRACIA";
            let modo_solo_lectura = estado == "EXPIRADO";

            Ok(EstadoLicencia {
                tipo_licencia,
                estado,
                fecha_instalacion,
                fecha_expiracion,
                dias_restantes,
                puede_operar,
                modo_solo_lectura,
                codigo_activacion,
            })
        }
        Err(e) => Err(format!("Error al obtener licencia: {}", e)),
    }
}

// =====================================================
// COMANDO: Verificar y actualizar estado de licencia
// =====================================================
#[tauri::command]
pub fn verificar_licencia(db: tauri::State<DatabasePool>) -> Result<bool, String> {
    let mut conn = db.get_conn();

    // Obtener licencia actual
    let query = "
        SELECT 
            estado,
            fecha_expiracion,
            tipo_licencia
        FROM licencias
        WHERE id = 1
    ";

    let (estado_actual, fecha_expiracion, tipo_licencia): (String, String, String) = conn
        .query_row(query, [], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
            ))
        })
        .map_err(|e| format!("Error al leer licencia: {}", e))?;

    // Calcular días restantes
    let dias_restantes = calcular_dias_restantes_interno(&conn, &fecha_expiracion)?;

    // Determinar nuevo estado
    let nuevo_estado = if dias_restantes > 0 {
        "ACTIVO"
    } else if dias_restantes >= -3 {
        // Período de gracia: 3 días después de expirar
        "GRACIA"
    } else {
        "EXPIRADO"
    };

    // Si cambió el estado, actualizarlo
    if nuevo_estado != estado_actual {
        conn.execute(
            "UPDATE licencias SET estado = ?, fecha_actualizacion = datetime('now') WHERE id = 1",
            params![nuevo_estado],
        )
        .map_err(|e| format!("Error al actualizar estado: {}", e))?;

        println!("✅ Estado de licencia actualizado: {} → {}", estado_actual, nuevo_estado);
    }

    // Puede operar si está ACTIVO o en GRACIA
    Ok(nuevo_estado == "ACTIVO" || nuevo_estado == "GRACIA")
}

// =====================================================
// COMANDO: Activar licencia con código
// =====================================================
#[tauri::command]
pub fn activar_licencia(
    db: tauri::State<DatabasePool>,
    codigo: String,
) -> Result<ResultadoActivacion, String> {
    let mut conn = db.get_conn();

    // Limpiar código (quitar espacios, convertir a mayúsculas)
    let codigo_limpio = codigo.trim().to_uppercase().replace(" ", "");

    // Validar formato del código
    if !validar_formato_codigo(&codigo_limpio) {
        return Ok(ResultadoActivacion {
            success: false,
            mensaje: "Código inválido. Formato correcto: POS-M-XXXX-XXXX-XXXX".to_string(),
            nueva_fecha_expiracion: None,
            tipo_licencia: None,
        });
    }

    // Validar checksum
    if !validar_checksum(&codigo_limpio) {
        return Ok(ResultadoActivacion {
            success: false,
            mensaje: "Código inválido. Verificación falló.".to_string(),
            nueva_fecha_expiracion: None,
            tipo_licencia: None,
        });
    }

    // Verificar si el código ya fue usado
    let ya_usado: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM licencias WHERE codigo_activacion = ?",
            params![&codigo_limpio],
            |row| row.get::<_, i32>(0).map(|count| count > 0),
        )
        .unwrap_or(false);

    if ya_usado {
        return Ok(ResultadoActivacion {
            success: false,
            mensaje: "Este código ya ha sido utilizado.".to_string(),
            nueva_fecha_expiracion: None,
            tipo_licencia: None,
        });
    }

    // Extraer tipo de licencia del código
    let tipo = extraer_tipo_licencia(&codigo_limpio)?;
    
    // Calcular días a agregar
    let dias_a_agregar = match tipo.as_str() {
        "MENSUAL" => 30,
        "ANUAL" => 365,
        _ => {
            return Ok(ResultadoActivacion {
                success: false,
                mensaje: "Tipo de licencia no reconocido en el código.".to_string(),
                nueva_fecha_expiracion: None,
                tipo_licencia: None,
            });
        }
    };

    // Iniciar transacción
    conn.execute("BEGIN TRANSACTION", [])
        .map_err(|e| format!("Error al iniciar transacción: {}", e))?;

    // Actualizar licencia
    let resultado = conn.execute(
        "UPDATE licencias SET 
            tipo_licencia = ?,
            estado = 'ACTIVO',
            codigo_activacion = ?,
            codigo_usado = 1,
            fecha_primera_activacion = COALESCE(fecha_primera_activacion, datetime('now')),
            fecha_expiracion = datetime('now', ? || ' days'),
            intentos_activacion = intentos_activacion + 1,
            fecha_actualizacion = datetime('now')
        WHERE id = 1",
        params![&tipo, &codigo_limpio, format!("+{}", dias_a_agregar)],
    );

    match resultado {
        Ok(_) => {
            // Obtener nueva fecha de expiración
            let nueva_fecha: String = conn
                .query_row(
                    "SELECT fecha_expiracion FROM licencias WHERE id = 1",
                    [],
                    |row| row.get(0),
                )
                .unwrap_or_default();

            // Registrar en historial
            let _ = conn.execute(
                "INSERT INTO historial_licencias (
                    accion, estado_nuevo, tipo_licencia_nueva, codigo_usado,
                    resultado, mensaje, dias_agregados, fecha_expiracion_nueva
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                params![
                    "ACTIVACION",
                    "ACTIVO",
                    &tipo,
                    &codigo_limpio,
                    "EXITOSO",
                    format!("Licencia {} activada correctamente", tipo),
                    dias_a_agregar,
                    &nueva_fecha,
                ],
            );

            // Commit
            conn.execute("COMMIT", [])
                .map_err(|e| format!("Error al confirmar transacción: {}", e))?;

            println!("✅ Licencia {} activada. Válida hasta: {}", tipo, nueva_fecha);

            Ok(ResultadoActivacion {
                success: true,
                mensaje: format!("¡Licencia {} activada exitosamente!", tipo),
                nueva_fecha_expiracion: Some(nueva_fecha),
                tipo_licencia: Some(tipo),
            })
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Ok(ResultadoActivacion {
                success: false,
                mensaje: format!("Error al activar licencia: {}", e),
                nueva_fecha_expiracion: None,
                tipo_licencia: None,
            })
        }
    }
}

// =====================================================
// COMANDO: Calcular días restantes
// =====================================================
#[tauri::command]
pub fn calcular_dias_restantes(db: tauri::State<DatabasePool>) -> Result<i32, String> {
    let conn = db.get_conn();

    let fecha_expiracion: String = conn
        .query_row(
            "SELECT fecha_expiracion FROM licencias WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Error al obtener fecha de expiración: {}", e))?;

    calcular_dias_restantes_interno(&conn, &fecha_expiracion)
}

// =====================================================
// COMANDO: Validar código (sin activar)
// =====================================================
#[tauri::command]
pub fn validar_codigo_activacion(codigo: String) -> Result<bool, String> {
    let codigo_limpio = codigo.trim().to_uppercase().replace(" ", "");
    
    if !validar_formato_codigo(&codigo_limpio) {
        return Ok(false);
    }

    Ok(validar_checksum(&codigo_limpio))
}

// =====================================================
// FUNCIONES AUXILIARES INTERNAS
// =====================================================

// Calcular días restantes
fn calcular_dias_restantes_interno(
    conn: &rusqlite::Connection,
    fecha_expiracion: &str,
) -> Result<i32, String> {
    let query = "
        SELECT CAST(
            (julianday(?) - julianday('now')) AS INTEGER
        ) as dias_restantes
    ";

    let dias: i32 = conn
        .query_row(query, params![fecha_expiracion], |row| row.get(0))
        .map_err(|e| format!("Error al calcular días: {}", e))?;

    Ok(dias)
}

// Validar formato del código: POS-M-XXXX-XXXX-XXXX
fn validar_formato_codigo(codigo: &str) -> bool {
    // Formato: POS-[M|A]-XXXX-XXXX-XXXX
    let partes: Vec<&str> = codigo.split('-').collect();
    
    if partes.len() != 5 {
        return false;
    }

    // Verificar prefijo
    if partes[0] != "POS" {
        return false;
    }

    // Verificar tipo (M o A)
    if partes[1] != "M" && partes[1] != "A" {
        return false;
    }

    // Verificar que las otras partes sean alfanuméricas y de 4 caracteres
    for i in 2..5 {
        if partes[i].len() != 4 {
            return false;
        }
        if !partes[i].chars().all(|c| c.is_alphanumeric()) {
            return false;
        }
    }

    true
}

// Validar checksum del código
fn validar_checksum(codigo: &str) -> bool {
    let partes: Vec<&str> = codigo.split('-').collect();
    if partes.len() != 5 {
        return false;
    }

    // El checksum es la última parte
    let checksum_recibido = partes[4];
    
    // Concatenar las partes 2 y 3 para calcular checksum
    let datos = format!("{}{}", partes[2], partes[3]);
    
    // Calcular checksum esperado
    let checksum_calculado = calcular_checksum_simple(&datos);
    
    checksum_recibido == checksum_calculado
}

// Calcular checksum simple (4 caracteres)
fn calcular_checksum_simple(datos: &str) -> String {
    let mut sum: u32 = 0;
    
    for (i, c) in datos.chars().enumerate() {
        sum = sum.wrapping_add((c as u32) * ((i + 1) as u32));
    }
    
    // Convertir a base36 y tomar 4 caracteres
    let mut resultado = String::new();
    let mut valor = sum;
    let chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    
    for _ in 0..4 {
        resultado.push(chars.chars().nth((valor % 36) as usize).unwrap());
        valor /= 36;
    }
    
    resultado.chars().rev().collect()
}

// Extraer tipo de licencia del código
fn extraer_tipo_licencia(codigo: &str) -> Result<String, String> {
    let partes: Vec<&str> = codigo.split('-').collect();
    
    if partes.len() < 2 {
        return Err("Código inválido".to_string());
    }

    match partes[1] {
        "M" => Ok("MENSUAL".to_string()),
        "A" => Ok("ANUAL".to_string()),
        _ => Err("Tipo de licencia no reconocido".to_string()),
    }
}
// =====================================================
// 🆕 COMANDO 1: Verificar si es primera vez
// =====================================================
#[tauri::command]
pub fn verificar_primera_vez(db: tauri::State<DatabasePool>) -> Result<bool, String> {
    let conn = db.get_conn();

    // Verificar si la columna existe (por si aún no se ejecutó la migración)
    let columna_existe: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('licencias') WHERE name='primera_vez_mostrado'",
            [],
            |row| Ok(row.get::<_, i32>(0)? > 0),
        )
        .unwrap_or(false);

    if !columna_existe {
        // Si la columna no existe, asumir que es primera vez
        println!("⚠️ Columna 'primera_vez_mostrado' no existe aún");
        return Ok(true);
    }

    // Verificar si ya se mostró el mensaje de bienvenida
    let ya_mostrado: i32 = conn
        .query_row(
            "SELECT COALESCE(primera_vez_mostrado, 0) FROM licencias WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Retornar true si NO se ha mostrado (primera vez)
    Ok(ya_mostrado == 0)
}

// =====================================================
// 🆕 COMANDO 2: Marcar que ya se mostró el mensaje de primera vez
// =====================================================
#[tauri::command]
pub fn marcar_primera_vez_vista(db: tauri::State<DatabasePool>) -> Result<bool, String> {
    let conn = db.get_conn();

    // Verificar si la columna existe
    let columna_existe: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('licencias') WHERE name='primera_vez_mostrado'",
            [],
            |row| Ok(row.get::<_, i32>(0)? > 0),
        )
        .unwrap_or(false);

    if !columna_existe {
        println!("⚠️ Columna 'primera_vez_mostrado' no existe aún");
        return Ok(false);
    }

    // Marcar como visto
    let resultado = conn.execute(
        "UPDATE licencias SET primera_vez_mostrado = 1 WHERE id = 1",
        [],
    );

    match resultado {
        Ok(_) => {
            println!("✅ Primera vez marcada como vista");
            Ok(true)
        }
        Err(e) => {
            println!("❌ Error al marcar primera vez: {}", e);
            Ok(false)
        }
    }
}
// =====================================================
// COMANDO: Obtener información para debug (SOLO DESARROLLO)
// =====================================================
#[tauri::command]
pub fn obtener_info_debug_licencia(
    db: tauri::State<DatabasePool>,
) -> Result<String, String> {
    let conn = db.get_conn();

    let query = "
        SELECT 
            tipo_licencia,
            estado,
            fecha_instalacion,
            fecha_expiracion,
            CAST((julianday(fecha_expiracion) - julianday('now')) AS INTEGER) as dias_restantes,
            codigo_activacion
        FROM licencias
        WHERE id = 1
    ";

    let resultado: Result<String, _> = conn.query_row(query, [], |row| {
        let tipo: String = row.get(0)?;
        let estado: String = row.get(1)?;
        let instalacion: String = row.get(2)?;
        let expiracion: String = row.get(3)?;
        let dias: i32 = row.get(4)?;
        let codigo: Option<String> = row.get(5)?;

        Ok(format!(
            "Tipo: {}\nEstado: {}\nInstalación: {}\nExpiración: {}\nDías restantes: {}\nCódigo: {}",
            tipo,
            estado,
            instalacion,
            expiracion,
            dias,
            codigo.unwrap_or("No activado".to_string())
        ))
    });

    resultado.map_err(|e| format!("Error: {}", e))
}