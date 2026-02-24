// models/producto.rs
// Modelo de Producto con soporte de variantes/tallas

use serde::{Deserialize, Serialize};

// =====================================================
// MODELO PRINCIPAL: Producto
// =====================================================
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
    pub descuento_porcentaje: f64,
    pub tiene_variantes: bool,  // 🆕
    pub activo: bool,
}

// =====================================================
// 🆕 MODELO: Variante de producto (talla)
// =====================================================
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProductoVariante {
    pub id: i32,
    pub producto_id: i32,
    pub talla: String,
    pub stock: i32,
    pub stock_minimo: i32,
    pub activo: bool,
}

// =====================================================
// 🆕 REQUEST: Variante al crear/editar producto
// =====================================================
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VarianteInput {
    pub talla: String,
    pub stock: i32,
    pub stock_minimo: Option<i32>,
}

// =====================================================
// REQUEST: Nuevo producto
// =====================================================
#[derive(Debug, Serialize, Deserialize)]
pub struct ProductoNuevo {
    pub codigo: String,
    pub nombre: String,
    pub descripcion: Option<String>,
    pub precio: f64,
    pub stock: i32,           // Solo usado si tiene_variantes = false
    pub stock_minimo: i32,
    pub categoria_id: i32,
    pub descuento_porcentaje: Option<f64>,
    pub tiene_variantes: Option<bool>,      // 🆕
    pub variantes: Option<Vec<VarianteInput>>, // 🆕
}

// =====================================================
// RESPONSES
// =====================================================
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

// =====================================================
// 🆕 RESPONSE: Producto con sus variantes
// =====================================================
#[derive(Debug, Serialize, Deserialize)]
pub struct ProductoConVariantes {
    pub producto: Producto,
    pub variantes: Vec<ProductoVariante>,
}