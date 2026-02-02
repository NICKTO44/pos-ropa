-- =====================================================
-- SISTEMA DE GESTIÓN DE TIENDA - VERSIÓN SQLite
-- Base de Datos: SQLite 3
-- Fecha: Enero 2026
-- Versión: 1.1 - Con Sistema de Licencias
-- =====================================================

PRAGMA foreign_keys = OFF;

-- =====================================================
-- TABLA: roles
-- =====================================================
DROP TABLE IF EXISTS roles;
CREATE TABLE roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  permisos TEXT, -- JSON almacenado como TEXT
  activo INTEGER DEFAULT 1, -- 0 = false, 1 = true
  fecha_creacion TEXT DEFAULT (datetime('now')),
  fecha_actualizacion TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_roles_nombre ON roles(nombre);
CREATE INDEX idx_roles_activo ON roles(activo);

-- =====================================================
-- TABLA: usuarios
-- =====================================================
DROP TABLE IF EXISTS usuarios;
CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, -- Hash bcrypt
  nombre_completo TEXT NOT NULL,
  email TEXT,
  rol_id INTEGER NOT NULL,
  activo INTEGER DEFAULT 1,
  intentos_fallidos INTEGER DEFAULT 0,
  bloqueado_hasta TEXT,
  ultimo_acceso TEXT,
  fecha_creacion TEXT DEFAULT (datetime('now')),
  fecha_actualizacion TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (rol_id) REFERENCES roles(id)
);

CREATE INDEX idx_usuarios_username ON usuarios(username);
CREATE INDEX idx_usuarios_activo ON usuarios(activo);
CREATE INDEX idx_usuarios_rol ON usuarios(rol_id);

-- =====================================================
-- TABLA: sesiones_log
-- =====================================================
DROP TABLE IF EXISTS sesiones_log;
CREATE TABLE sesiones_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  fecha_hora TEXT DEFAULT (datetime('now')),
  ip_address TEXT,
  user_agent TEXT,
  resultado TEXT NOT NULL CHECK(resultado IN ('EXITOSO', 'FALLIDO', 'BLOQUEADO')),
  motivo_fallo TEXT,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE INDEX idx_sesiones_usuario ON sesiones_log(usuario_id);
CREATE INDEX idx_sesiones_fecha ON sesiones_log(fecha_hora);

-- =====================================================
-- TABLA: categorias
-- =====================================================
DROP TABLE IF EXISTS categorias;
CREATE TABLE categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  activo INTEGER DEFAULT 1,
  fecha_creacion TEXT DEFAULT (datetime('now')),
  fecha_actualizacion TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_categorias_nombre ON categorias(nombre);
CREATE INDEX idx_categorias_activo ON categorias(activo);

-- =====================================================
-- TABLA: productos
-- =====================================================
DROP TABLE IF EXISTS productos;
CREATE TABLE productos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio REAL NOT NULL CHECK (precio > 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  stock_minimo INTEGER DEFAULT 5,
  categoria_id INTEGER NOT NULL,
  descuento_porcentaje REAL DEFAULT 0,
  imagen_url TEXT,
  activo INTEGER DEFAULT 1,
  fecha_creacion TEXT DEFAULT (datetime('now')),
  fecha_actualizacion TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

CREATE INDEX idx_productos_codigo ON productos(codigo);
CREATE INDEX idx_productos_nombre ON productos(nombre);
CREATE INDEX idx_productos_categoria ON productos(categoria_id);
CREATE INDEX idx_productos_activo ON productos(activo);

-- =====================================================
-- TABLA: ventas
-- =====================================================
DROP TABLE IF EXISTS ventas;
CREATE TABLE ventas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  folio TEXT NOT NULL UNIQUE,
  fecha_hora TEXT DEFAULT (datetime('now')),
  subtotal REAL NOT NULL CHECK (subtotal >= 0),
  descuento REAL DEFAULT 0 CHECK (descuento >= 0),
  total REAL NOT NULL CHECK (total >= 0),
  metodo_pago TEXT NOT NULL CHECK(metodo_pago IN ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'MIXTO')),
  monto_recibido REAL,
  cambio REAL,
  usuario_id INTEGER NOT NULL,
  estado TEXT DEFAULT 'COMPLETADA' CHECK(estado IN ('COMPLETADA', 'CANCELADA', 'PENDIENTE')),
  motivo_cancelacion TEXT,
  notas TEXT,
  licencia_tipo TEXT, -- NUEVO: Registra con qué tipo de licencia se hizo (TRIAL, MENSUAL, ANUAL)
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE INDEX idx_ventas_folio ON ventas(folio);
CREATE INDEX idx_ventas_fecha ON ventas(fecha_hora);
CREATE INDEX idx_ventas_usuario ON ventas(usuario_id);
CREATE INDEX idx_ventas_estado ON ventas(estado);
CREATE INDEX idx_ventas_metodo ON ventas(metodo_pago);

-- =====================================================
-- TABLA: detalles_venta
-- =====================================================
DROP TABLE IF EXISTS detalles_venta;
CREATE TABLE detalles_venta (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id INTEGER NOT NULL,
  producto_id INTEGER NOT NULL,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario REAL NOT NULL CHECK (precio_unitario >= 0),
  subtotal REAL NOT NULL CHECK (subtotal >= 0),
  descuento_linea REAL DEFAULT 0,
  total_linea REAL NOT NULL CHECK (total_linea >= 0),
  FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE INDEX idx_detalles_venta ON detalles_venta(venta_id);
CREATE INDEX idx_detalles_producto ON detalles_venta(producto_id);

-- =====================================================
-- TABLA: devoluciones
-- =====================================================
DROP TABLE IF EXISTS devoluciones;
CREATE TABLE devoluciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_original_id INTEGER NOT NULL,
  folio_devolucion TEXT NOT NULL UNIQUE,
  fecha_hora TEXT DEFAULT (datetime('now')),
  usuario_id INTEGER NOT NULL,
  monto_reembolsado REAL NOT NULL CHECK (monto_reembolsado >= 0),
  metodo_reembolso TEXT NOT NULL CHECK(metodo_reembolso IN ('EFECTIVO', 'TARJETA', 'VALE', 'CREDITO')),
  motivo TEXT NOT NULL,
  estado TEXT DEFAULT 'PROCESADA' CHECK(estado IN ('PROCESADA', 'PENDIENTE', 'RECHAZADA')),
  notas TEXT,
  FOREIGN KEY (venta_original_id) REFERENCES ventas(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE INDEX idx_devoluciones_venta ON devoluciones(venta_original_id);
CREATE INDEX idx_devoluciones_folio ON devoluciones(folio_devolucion);
CREATE INDEX idx_devoluciones_fecha ON devoluciones(fecha_hora);

-- =====================================================
-- TABLA: detalles_devolucion
-- =====================================================
DROP TABLE IF EXISTS detalles_devolucion;
CREATE TABLE detalles_devolucion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  devolucion_id INTEGER NOT NULL,
  producto_id INTEGER NOT NULL,
  venta_id INTEGER NOT NULL,
  cantidad_devuelta INTEGER NOT NULL CHECK (cantidad_devuelta > 0),
  precio_unitario REAL NOT NULL,
  subtotal REAL NOT NULL CHECK (subtotal >= 0),
  condicion TEXT NOT NULL CHECK(condicion IN ('REVENTA', 'DEFECTUOSO', 'VENCIDO')),
  FOREIGN KEY (devolucion_id) REFERENCES devoluciones(id) ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE INDEX idx_detalles_devolucion ON detalles_devolucion(devolucion_id);
CREATE INDEX idx_detalles_devolucion_producto ON detalles_devolucion(producto_id);

-- =====================================================
-- TABLA: movimientos_inventario
-- =====================================================
DROP TABLE IF EXISTS movimientos_inventario;
CREATE TABLE movimientos_inventario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL,
  tipo_movimiento TEXT NOT NULL CHECK(tipo_movimiento IN ('VENTA', 'DEVOLUCION', 'ENTRADA', 'SALIDA', 'AJUSTE', 'MERMA')),
  cantidad INTEGER NOT NULL,
  stock_anterior INTEGER NOT NULL,
  stock_nuevo INTEGER NOT NULL,
  venta_id INTEGER,
  devolucion_id INTEGER,
  usuario_id INTEGER,
  referencia TEXT,
  motivo TEXT,
  fecha_hora TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (producto_id) REFERENCES productos(id),
  FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE SET NULL,
  FOREIGN KEY (devolucion_id) REFERENCES devoluciones(id) ON DELETE SET NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE INDEX idx_movimientos_producto ON movimientos_inventario(producto_id);
CREATE INDEX idx_movimientos_tipo ON movimientos_inventario(tipo_movimiento);
CREATE INDEX idx_movimientos_fecha ON movimientos_inventario(fecha_hora);

-- =====================================================
-- TABLA: proveedores
-- =====================================================
DROP TABLE IF EXISTS proveedores;
CREATE TABLE proveedores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  contacto TEXT,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  rfc TEXT,
  activo INTEGER DEFAULT 1,
  fecha_creacion TEXT DEFAULT (datetime('now')),
  fecha_actualizacion TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_proveedores_nombre ON proveedores(nombre);
CREATE INDEX idx_proveedores_activo ON proveedores(activo);

-- =====================================================
-- TABLA: compras
-- =====================================================
DROP TABLE IF EXISTS compras;
CREATE TABLE compras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  folio TEXT NOT NULL UNIQUE,
  proveedor_id INTEGER NOT NULL,
  fecha_compra TEXT NOT NULL,
  fecha_recepcion TEXT,
  total REAL NOT NULL CHECK (total >= 0),
  estado TEXT DEFAULT 'PENDIENTE' CHECK(estado IN ('PENDIENTE', 'RECIBIDA', 'PARCIAL', 'CANCELADA')),
  usuario_id INTEGER NOT NULL,
  factura_numero TEXT,
  notas TEXT,
  fecha_creacion TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (proveedor_id) REFERENCES proveedores(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE INDEX idx_compras_folio ON compras(folio);
CREATE INDEX idx_compras_proveedor ON compras(proveedor_id);
CREATE INDEX idx_compras_fecha ON compras(fecha_compra);

-- =====================================================
-- TABLA: detalles_compra
-- =====================================================
DROP TABLE IF EXISTS detalles_compra;
CREATE TABLE detalles_compra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  compra_id INTEGER NOT NULL,
  producto_id INTEGER NOT NULL,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_compra REAL NOT NULL CHECK (precio_compra >= 0),
  subtotal REAL NOT NULL CHECK (subtotal >= 0),
  FOREIGN KEY (compra_id) REFERENCES compras(id) ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE INDEX idx_detalles_compra ON detalles_compra(compra_id);
CREATE INDEX idx_detalles_compra_producto ON detalles_compra(producto_id);

-- =====================================================
-- TABLA: configuracion_tienda
-- =====================================================
DROP TABLE IF EXISTS configuracion_tienda;
CREATE TABLE configuracion_tienda (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre_tienda TEXT NOT NULL,
  direccion TEXT,
  telefono TEXT,
  email TEXT,
  rfc TEXT,
  logo_path TEXT,
  mensaje_recibo TEXT,
  moneda TEXT DEFAULT 'PEN',
  formato_folio TEXT DEFAULT 'V-{YYYY}{MM}{DD}-{####}',
  iva_porcentaje REAL DEFAULT 0,
  dias_devolucion INTEGER DEFAULT 7,
  backup_automatico INTEGER DEFAULT 1,
  hora_backup TEXT DEFAULT '23:00:00',
  fecha_actualizacion TEXT DEFAULT (datetime('now'))
);

-- =====================================================
-- TABLA: auditoria
-- =====================================================
DROP TABLE IF EXISTS auditoria;
CREATE TABLE auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER,
  accion TEXT NOT NULL,
  tabla_afectada TEXT,
  registro_id INTEGER,
  valores_anteriores TEXT, -- JSON como TEXT
  valores_nuevos TEXT, -- JSON como TEXT
  ip_address TEXT,
  fecha_hora TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX idx_auditoria_usuario ON auditoria(usuario_id);
CREATE INDEX idx_auditoria_tabla ON auditoria(tabla_afectada);
CREATE INDEX idx_auditoria_fecha ON auditoria(fecha_hora);

-- =====================================================
-- TABLA: cajas
-- =====================================================
DROP TABLE IF EXISTS cajas;
CREATE TABLE cajas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  fecha_apertura TEXT DEFAULT (datetime('now')),
  fecha_cierre TEXT,
  monto_inicial REAL NOT NULL CHECK (monto_inicial >= 0),
  monto_final REAL,
  ventas_efectivo REAL DEFAULT 0,
  ventas_tarjeta REAL DEFAULT 0,
  ventas_transferencia REAL DEFAULT 0,
  total_ventas REAL DEFAULT 0,
  diferencia REAL,
  estado TEXT DEFAULT 'ABIERTA' CHECK(estado IN ('ABIERTA', 'CERRADA')),
  notas TEXT,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE INDEX idx_cajas_usuario ON cajas(usuario_id);
CREATE INDEX idx_cajas_fecha ON cajas(fecha_apertura);
CREATE INDEX idx_cajas_estado ON cajas(estado);

-- =====================================================
-- 🆕 TABLA: licencias (NUEVO)
-- Sistema de control de licencias y períodos de prueba
-- =====================================================
DROP TABLE IF EXISTS licencias;
CREATE TABLE licencias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Fechas críticas
  fecha_instalacion TEXT NOT NULL,
  fecha_primera_activacion TEXT,
  fecha_expiracion TEXT NOT NULL,
  fecha_ultimo_aviso TEXT, -- Para controlar recordatorios
  
  -- Tipo y estado
  tipo_licencia TEXT NOT NULL CHECK(tipo_licencia IN ('TRIAL', 'MENSUAL', 'ANUAL', 'PERPETUA')),
  estado TEXT NOT NULL CHECK(estado IN ('ACTIVO', 'GRACIA', 'EXPIRADO', 'SUSPENDIDO')),
  
  -- Código de activación
  codigo_activacion TEXT UNIQUE,
  codigo_usado INTEGER DEFAULT 0, -- 0 = no usado, 1 = ya usado
  
  -- Información del cliente (opcional)
  nombre_cliente TEXT,
  email_cliente TEXT,
  telefono_cliente TEXT,
  
  -- Control de intentos
  intentos_activacion INTEGER DEFAULT 0,
  fecha_ultimo_intento TEXT,
  
  -- Metadata del sistema
  version_app TEXT,
  sistema_operativo TEXT,
  machine_id TEXT, -- Identificador único de la máquina
  
  -- Contadores y estadísticas
  total_ventas_realizadas INTEGER DEFAULT 0,
  total_productos_vendidos INTEGER DEFAULT 0,
  
  -- Control de avisos
  avisos_enviados INTEGER DEFAULT 0, -- Cuántos recordatorios se han mostrado
  
  -- Timestamps
  fecha_creacion TEXT DEFAULT (datetime('now')),
  fecha_actualizacion TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_licencias_estado ON licencias(estado);
CREATE INDEX idx_licencias_tipo ON licencias(tipo_licencia);
CREATE INDEX idx_licencias_expiracion ON licencias(fecha_expiracion);
CREATE INDEX idx_licencias_codigo ON licencias(codigo_activacion);

-- =====================================================
-- 🆕 TABLA: historial_licencias (NUEVO)
-- Registro de todas las acciones relacionadas con licencias
-- =====================================================
DROP TABLE IF EXISTS historial_licencias;
CREATE TABLE historial_licencias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Tipo de acción
  accion TEXT NOT NULL CHECK(accion IN (
    'INSTALACION',
    'ACTIVACION',
    'RENOVACION',
    'EXPIRACION',
    'CAMBIO_ESTADO',
    'INTENTO_ACTIVACION_FALLIDO',
    'MODO_SOLO_LECTURA'
  )),
  
  -- Estados anterior y nuevo
  estado_anterior TEXT,
  estado_nuevo TEXT,
  tipo_licencia_anterior TEXT,
  tipo_licencia_nueva TEXT,
  
  -- Código utilizado (si aplica)
  codigo_usado TEXT,
  
  -- Resultado
  resultado TEXT NOT NULL CHECK(resultado IN ('EXITOSO', 'FALLIDO')),
  mensaje TEXT,
  
  -- Información adicional
  dias_agregados INTEGER, -- Para activaciones/renovaciones
  fecha_expiracion_anterior TEXT,
  fecha_expiracion_nueva TEXT,
  
  -- Metadata
  ip_local TEXT,
  usuario_sistema TEXT,
  detalles TEXT, -- JSON con info adicional
  
  -- Timestamp
  fecha_hora TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_historial_accion ON historial_licencias(accion);
CREATE INDEX idx_historial_fecha ON historial_licencias(fecha_hora);
CREATE INDEX idx_historial_codigo ON historial_licencias(codigo_usado);
CREATE INDEX idx_historial_resultado ON historial_licencias(resultado);

PRAGMA foreign_keys = ON;

-- =====================================================
-- DATOS INICIALES - ROLES
-- =====================================================
INSERT INTO roles (nombre, descripcion, permisos, activo) VALUES 
('Administrador', 'Acceso total al sistema', '{"ventas": true, "inventario": true, "reportes": true, "usuarios": true}', 1),
('Cajero', 'Procesar ventas', '{"ventas": true, "inventario": false}', 1),
('Almacenista', 'Gestionar inventario', '{"ventas": false, "inventario": true}', 1);

-- =====================================================
-- DATOS INICIALES - USUARIOS
-- Contraseñas: admin123, cajero123, almacen123
-- =====================================================
INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol_id, activo) VALUES 
('admin', '$2b$10$6sgAUnLGk2CS.I.3sNHy8.qiAuUVH7uOWYWpusN6sJU39XHjEFEGW', 'Administrador General', 'admin@sistema.com', 1, 1),
('cajero', '$2b$10$YourHashedPasswordForCajero', 'Cajero Principal', 'cajero@sistema.com', 2, 1),
('almacenista', '$2b$10$YourHashedPasswordForAlmacenista', 'Almacenista', 'almacenista@sistema.com', 3, 1);

-- =====================================================
-- DATOS INICIALES - CATEGORÍAS
-- =====================================================
INSERT INTO categorias (nombre, descripcion, activo) VALUES 
('Playeras y Camisas', 'Playeras, camisas casuales y formales', 1),
('Pantalones y Jeans', 'Pantalones de mezclilla, casuales y formales', 1),
('Vestidos y Faldas', 'Vestidos, faldas y jumpers', 1),
('Ropa Deportiva', 'Ropa para ejercicio y actividades deportivas', 1),
('Ropa Formal', 'Trajes, sacos, vestidos de gala', 1),
('Chamarras y Abrigos', 'Chamarras, suéteres, abrigos', 1),
('Ropa Interior y Calcetines', 'Ropa íntima, calcetines, medias', 1),
('Calzado', 'Zapatos, tenis, botas, sandalias', 1),
('Accesorios', 'Cinturones, bufandas, gorras, bolsas', 1),
('Ropa de Niño', 'Ropa para niños de todas las edades', 1),
('Ropa de Niña', 'Ropa para niñas de todas las edades', 1),
('Ofertas y Promociones', 'Productos en oferta y liquidación', 1);

-- =====================================================
-- DATOS INICIALES - CONFIGURACIÓN
-- =====================================================
INSERT INTO configuracion_tienda (nombre_tienda, direccion, telefono, email, rfc, mensaje_recibo, moneda) VALUES 
('Mi Tienda de Ropa', 'Dirección de tu tienda', '(555) 123-4567', 'contacto@mitienda.com', 'XAXX010101000', '¡Gracias por su compra! Vuelva pronto.', 'PEN');

-- =====================================================
-- 🆕 DATOS INICIALES - LICENCIA (NUEVO)
-- Se crea licencia TRIAL de 15 días en primera instalación
-- =====================================================
INSERT INTO licencias (
  fecha_instalacion,
  fecha_expiracion,
  tipo_licencia,
  estado,
  version_app
) VALUES (
  datetime('now'),
  datetime('now', '+15 days'),
  'TRIAL',
  'ACTIVO',
  '1.0.0'
);

-- Registrar en historial
INSERT INTO historial_licencias (
  accion,
  estado_nuevo,
  tipo_licencia_nueva,
  resultado,
  mensaje,
  dias_agregados,
  fecha_expiracion_nueva
) VALUES (
  'INSTALACION',
  'ACTIVO',
  'TRIAL',
  'EXITOSO',
  'Licencia trial de 15 días creada automáticamente',
  15,
  datetime('now', '+15 days')
);

-- =====================================================
-- TRIGGERS PARA ACTUALIZACIÓN DE STOCK
-- =====================================================

-- Trigger: Actualizar stock al realizar venta
CREATE TRIGGER trg_after_venta_insert
AFTER INSERT ON detalles_venta
FOR EACH ROW
WHEN (SELECT estado FROM ventas WHERE id = NEW.venta_id) = 'COMPLETADA'
BEGIN
  UPDATE productos 
  SET stock = stock - NEW.cantidad
  WHERE id = NEW.producto_id;
  
  INSERT INTO movimientos_inventario (producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, venta_id, usuario_id, motivo)
  VALUES (
    NEW.producto_id,
    'VENTA',
    -NEW.cantidad,
    (SELECT stock + NEW.cantidad FROM productos WHERE id = NEW.producto_id),
    (SELECT stock FROM productos WHERE id = NEW.producto_id),
    NEW.venta_id,
    (SELECT usuario_id FROM ventas WHERE id = NEW.venta_id),
    'Venta automática - Folio: ' || (SELECT folio FROM ventas WHERE id = NEW.venta_id)
  );
END;

-- Trigger: Restaurar stock al cancelar venta
CREATE TRIGGER trg_after_venta_cancelar
AFTER UPDATE ON ventas
FOR EACH ROW
WHEN OLD.estado = 'COMPLETADA' AND NEW.estado = 'CANCELADA'
BEGIN
  UPDATE productos
  SET stock = stock + (
    SELECT SUM(cantidad) FROM detalles_venta WHERE venta_id = NEW.id
  )
  WHERE id IN (SELECT producto_id FROM detalles_venta WHERE venta_id = NEW.id);
END;

-- Trigger: Actualizar stock al procesar devolución
CREATE TRIGGER trg_after_devolucion_insert
AFTER INSERT ON detalles_devolucion
FOR EACH ROW
WHEN NEW.condicion = 'REVENTA'
BEGIN
  UPDATE productos
  SET stock = stock + NEW.cantidad_devuelta
  WHERE id = NEW.producto_id;
  
  INSERT INTO movimientos_inventario (producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, devolucion_id, usuario_id, motivo)
  VALUES (
    NEW.producto_id,
    'DEVOLUCION',
    NEW.cantidad_devuelta,
    (SELECT stock - NEW.cantidad_devuelta FROM productos WHERE id = NEW.producto_id),
    (SELECT stock FROM productos WHERE id = NEW.producto_id),
    NEW.devolucion_id,
    (SELECT usuario_id FROM devoluciones WHERE id = NEW.devolucion_id),
    'Devolución - Condición: REVENTA'
  );
END;

-- =====================================================
-- 🆕 TRIGGERS PARA LICENCIAS (NUEVO)
-- =====================================================

-- Trigger: Actualizar fecha_actualizacion al modificar licencia
CREATE TRIGGER trg_licencias_update
AFTER UPDATE ON licencias
FOR EACH ROW
BEGIN
  UPDATE licencias
  SET fecha_actualizacion = datetime('now')
  WHERE id = NEW.id;
END;

-- Trigger: Registrar cambios en historial al actualizar licencia
CREATE TRIGGER trg_licencias_historial
AFTER UPDATE ON licencias
FOR EACH ROW
WHEN OLD.estado != NEW.estado OR OLD.tipo_licencia != NEW.tipo_licencia
BEGIN
  INSERT INTO historial_licencias (
    accion,
    estado_anterior,
    estado_nuevo,
    tipo_licencia_anterior,
    tipo_licencia_nueva,
    resultado,
    mensaje,
    fecha_expiracion_anterior,
    fecha_expiracion_nueva
  ) VALUES (
    CASE 
      WHEN NEW.tipo_licencia != OLD.tipo_licencia THEN 'ACTIVACION'
      WHEN NEW.estado = 'EXPIRADO' THEN 'EXPIRACION'
      ELSE 'CAMBIO_ESTADO'
    END,
    OLD.estado,
    NEW.estado,
    OLD.tipo_licencia,
    NEW.tipo_licencia,
    'EXITOSO',
    'Cambio automático de estado o tipo de licencia',
    OLD.fecha_expiracion,
    NEW.fecha_expiracion
  );
END;

-- =====================================================
-- FIN DEL SCRIPT SQLite CON SISTEMA DE LICENCIAS
-- =====================================================
