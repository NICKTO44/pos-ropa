// commands/mod.rs
// Módulo de comandos Tauri

pub mod auth;
pub mod productos;
pub mod ventas;
pub mod reportes;
pub mod configuracion;
pub mod devoluciones; 

pub use auth::{login, test_database_connection};
pub use productos::{
    obtener_productos, 
    buscar_producto_por_codigo, 
    agregar_producto,
    obtener_productos_stock_bajo,
    actualizar_producto,
    obtener_categorias,
    obtener_nombres_categorias,          // ← AGREGAR
    buscar_productos_filtrado,    // ← AGREGAR
};
pub use ventas::{procesar_venta};
pub use reportes::{
    obtener_ventas_rango,
    obtener_productos_mas_vendidos,
    obtener_estadisticas_ventas,
    obtener_ventas_hoy,
    obtener_estadisticas_con_devoluciones,  // ← AGREGAR

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