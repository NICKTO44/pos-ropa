// models/mod.rs
// Módulo de modelos

pub mod usuario;
pub mod producto;
pub mod venta;

pub use usuario::{Usuario, UsuarioLogin, UsuarioResponse};
pub use producto::{Producto, ProductoNuevo, ProductoResponse, ProductosResponse};
pub use venta::{Venta, DetalleVenta, VentaNueva, VentaResponse};
