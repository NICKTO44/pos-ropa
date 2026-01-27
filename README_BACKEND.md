# 🚀 Backend - Instalación Rápida

## 📥 Archivos Descargados

Has descargado **12 archivos** para el backend:

### 📄 Documentación:
1. **INSTRUCCIONES_BACKEND.md** ← Lee esto primero (guía completa)
2. **instalar_backend.sh** ← Script automático de instalación

### 💻 Archivos de Código Rust:

**Database (Conexión a MySQL):**
3. `database_connection.rs` → Maneja la conexión a MySQL
4. `database_mod.rs` → Módulo de database

**Models (Estructura de datos):**
5. `models_usuario.rs` → Modelo de Usuario
6. `models_producto.rs` → Modelo de Producto
7. `models_venta.rs` → Modelo de Venta
8. `models_mod.rs` → Módulo de models

**Commands (Funciones para el frontend):**
9. `commands_auth.rs` → Login y autenticación
10. `commands_productos.rs` → Gestión de productos
11. `commands_mod.rs` → Módulo de commands

**Principal:**
12. `main_rs.rs` → Archivo principal (reemplazar main.rs actual)

---

## ⚡ Instalación Rápida (3 Pasos)

### **Paso 1: Mover archivos**

Mueve TODOS los archivos descargados a:
```
~/Documents/SistemaEscritorio/backend/sistema-tienda/
```

### **Paso 2: Ejecutar script**

Abre Terminal y ejecuta:

```bash
cd ~/Documents/SistemaEscritorio/backend/sistema-tienda
chmod +x instalar_backend.sh
./instalar_backend.sh
```

### **Paso 3: Configurar contraseña de MySQL**

Edita el archivo de conexión:

```bash
nano src-tauri/src/database/connection.rs
```

Busca la línea 40 aproximadamente:
```rust
"tu_password_aqui", // ⚠️ CAMBIAR ESTO
```

Cámbiala por tu contraseña real de MySQL:
```rust
"TuPasswordDeMySQL", 
```

Guarda: `Ctrl+O`, `Enter`, `Ctrl+X`

---

## ✅ Probar que funciona

```bash
npm run tauri dev
```

Si ves esto, **¡funciona!**:
```
✅ Conexión a base de datos establecida
   Compiling sistema-tienda v0.1.0
```

---

## 🎯 ¿Qué hace cada archivo?

### **database_connection.rs**
- Crea el pool de conexiones a MySQL
- Función para probar la conexión
- Configuración de credenciales

### **models_usuario.rs**
- Define la estructura de Usuario
- Define LoginRequest y LoginResponse
- Para autenticación

### **models_producto.rs**  
- Define la estructura de Producto
- ProductoNuevo para agregar productos
- ProductoResponse para respuestas

### **models_venta.rs**
- Define la estructura de Venta
- DetalleVenta para items de venta
- VentaNueva para crear ventas

### **commands_auth.rs**
- `login()` - Función de login
- `test_database_connection()` - Probar BD
- Valida credenciales contra la BD

### **commands_productos.rs**
- `obtener_productos()` - Listar todos
- `buscar_producto_por_codigo()` - Buscar por código
- `agregar_producto()` - Crear producto
- `obtener_productos_stock_bajo()` - Alertas de stock

### **main_rs.rs** (reemplaza main.rs)
- Inicializa la aplicación
- Conecta a MySQL al iniciar
- Registra todos los comandos

---

## 🔧 Estructura Final

Después de instalar, tendrás:

```
sistema-tienda/
└── src-tauri/
    └── src/
        ├── main.rs              ✅ Actualizado
        ├── database/            ✅ Nueva carpeta
        │   ├── connection.rs    ✅ Nuevo
        │   └── mod.rs           ✅ Nuevo
        ├── models/              ✅ Nueva carpeta
        │   ├── usuario.rs       ✅ Nuevo
        │   ├── producto.rs      ✅ Nuevo
        │   ├── venta.rs         ✅ Nuevo
        │   └── mod.rs           ✅ Nuevo
        └── commands/            ✅ Nueva carpeta
            ├── auth.rs          ✅ Nuevo
            ├── productos.rs     ✅ Nuevo
            └── mod.rs           ✅ Nuevo
```

---

## ❌ Problemas Comunes

### "permission denied: ./instalar_backend.sh"
```bash
chmod +x instalar_backend.sh
```

### "Error al conectar a la base de datos"
1. Verifica que MySQL esté corriendo: `mysql.server status`
2. Verifica tu contraseña en `connection.rs`
3. Verifica que exista la BD: `mysql -u root -p tienda_db`

### "cannot find macro `tauri`"
Limpia y recompila:
```bash
cd src-tauri
cargo clean
cd ..
npm run tauri dev
```

---

## 🎯 Funciones Disponibles (una vez instalado)

Desde React, podrás llamar:

```javascript
import { invoke } from '@tauri-apps/api/tauri';

// Login
const resultado = await invoke('login', {
  credenciales: { username: 'admin', password: 'admin123' }
});

// Productos
const productos = await invoke('obtener_productos');

// Buscar producto
const producto = await invoke('buscar_producto_por_codigo', {
  codigo: '7501234567890'
});

// Productos con stock bajo
const stockBajo = await invoke('obtener_productos_stock_bajo');
```

---

## 📚 Más Información

Lee **INSTRUCCIONES_BACKEND.md** para:
- Instalación manual paso a paso
- Explicación detallada de cada archivo
- Más ejemplos de uso
- Debugging avanzado

---

## ✅ Checklist

- [ ] Archivos descargados y movidos a la carpeta del proyecto
- [ ] Script ejecutado con `./instalar_backend.sh`
- [ ] Contraseña de MySQL actualizada en `connection.rs`
- [ ] `npm run tauri dev` ejecutado sin errores
- [ ] Mensaje "Conexión a base de datos establecida" visible

**Cuando todo esté ✅, avísame para continuar con el frontend React.** 🚀
