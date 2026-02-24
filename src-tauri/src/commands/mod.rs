// commands/mod.rs
// Módulo de comandos Tauri - v1.5

pub mod auth;
pub mod productos;
pub mod ventas;
pub mod reportes;
pub mod configuracion;
pub mod devoluciones;
pub mod licencias;
pub mod cajas;
pub mod proveedores; // 🆕

pub use auth::{login, test_database_connection};
pub use productos::{
    obtener_productos,
    buscar_producto_por_codigo,
    agregar_producto,
    obtener_productos_stock_bajo,
    actualizar_producto,
    obtener_categorias,
    obtener_categorias_con_tipo,
    obtener_nombres_categorias,
    buscar_productos_filtrado,
    obtener_variantes_producto,
    obtener_producto_con_variantes,
};
pub use ventas::{procesar_venta};
pub use reportes::{
    obtener_ventas_rango,
    obtener_productos_mas_vendidos,
    obtener_estadisticas_ventas,
    obtener_ventas_hoy,
    obtener_estadisticas_con_devoluciones,
};
pub use configuracion::{
    obtener_configuracion_tienda,
    actualizar_configuracion_tienda,
    agregar_categoria,
    actualizar_categoria,
    obtener_usuarios,
    obtener_roles,
    agregar_usuario,
    actualizar_usuario,
};
pub use devoluciones::{
    buscar_venta_para_devolucion,
    procesar_devolucion,
};
pub use cajas::{
    abrir_caja,
    cerrar_caja,
    registrar_movimiento_efectivo,
    obtener_caja_abierta_usuario,
    verificar_caja_abierta_sistema,
    obtener_reporte_cierre,
    obtener_historial_cajas,
    obtener_detalle_caja,
};
pub use proveedores::{
    obtener_proveedores,
    agregar_proveedor,
    actualizar_proveedor,
    eliminar_proveedor,
    obtener_compras,
    obtener_detalle_compra,
    crear_compra,
    recibir_mercaderia,
    registrar_pago_compra,
    cancelar_compra,
    // 🆕 v1.5 Devoluciones a Proveedor
    registrar_devolucion_proveedor,
    resolver_devolucion_proveedor,
    obtener_devoluciones_proveedor,
};