// models/producto.rs
// Modelo de Producto

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Producto {
    pub id: i32,
    pub codigo: String,
    pub nombre: String,
    pub descripcion: Option<String>,
    pub precio: f64,
    pub stock: i32,
    pub stock_minimo: i32,
    pub categoria_id: i32,
    pub categoria_nombre: Option<String>,
    pub activo: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProductoNuevo {
    pub codigo: String,
    pub nombre: String,
    pub descripcion: Option<String>,
    pub precio: f64,
    pub stock: i32,
    pub stock_minimo: i32,
    pub categoria_id: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProductoResponse {
    pub success: bool,
    pub message: String,
    pub producto: Option<Producto>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProductosResponse {
    pub success: bool,
    pub productos: Vec<Producto>,
}
