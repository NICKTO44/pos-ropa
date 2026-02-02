import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './Inventario.css';

function Inventario({ usuario, onVolver, modoSoloLectura }) {  // 🆕 Recibe modoSoloLectura
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [mostrarModal, setMostrarModal] = useState(false);
  const [productoEditando, setProductoEditando] = useState(null);
  const [mostrarStockBajo, setMostrarStockBajo] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

  // Form data
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    precio: '',
    stock: '',
    stock_minimo: '',
    categoria_id: '',
    descuento_porcentaje: 0
  });

  useEffect(() => {
    cargarProductos();
    cargarCategorias();
  }, []);

  const cargarProductos = async () => {
    try {
      const resultado = await invoke('obtener_productos');
      if (resultado.success) {
        setProductos(resultado.productos);
      }
    } catch (error) {
      console.error('Error al cargar productos:', error);
    }
  };

  const cargarCategorias = async () => {
    try {
      const cats = await invoke('obtener_categorias');
      setCategorias(cats);
    } catch (error) {
      console.error('Error al cargar categorías:', error);
    }
  };

  const cargarProductosStockBajo = async () => {
    try {
      const resultado = await invoke('obtener_productos_stock_bajo');
      if (resultado.success) {
        setProductos(resultado.productos);
        setMostrarStockBajo(true);
      }
    } catch (error) {
      console.error('Error al cargar productos con stock bajo:', error);
    }
  };

  const abrirModalNuevo = () => {
    // 🆕 Verificar modo solo lectura
    if (modoSoloLectura) {
      mostrarMensaje('error', '🔒 Activa tu licencia para agregar productos');
      return;
    }
    
    setProductoEditando(null);
    setFormData({
      codigo: '',
      nombre: '',
      descripcion: '',
      precio: '',
      stock: '',
      stock_minimo: '',
      categoria_id: categorias.length > 0 ? categorias[0][0] : '',
      descuento_porcentaje: 0
    });
    setMostrarModal(true);
  };

  const abrirModalEditar = (producto) => {
    // 🆕 Verificar modo solo lectura
    if (modoSoloLectura) {
      mostrarMensaje('error', '🔒 Activa tu licencia para editar productos');
      return;
    }
    
    setProductoEditando(producto);
    setFormData({
      codigo: producto.codigo,
      nombre: producto.nombre,
      descripcion: producto.descripcion || '',
      precio: producto.precio.toString(),
      stock: producto.stock.toString(),
      stock_minimo: producto.stock_minimo.toString(),
      categoria_id: producto.categoria_id.toString(),
      descuento_porcentaje: producto.descuento_porcentaje || 0
    });
    setMostrarModal(true);
  };

  const cerrarModal = () => {
    setMostrarModal(false);
    setProductoEditando(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 🆕 Verificar modo solo lectura (por si acaso)
    if (modoSoloLectura) {
      mostrarMensaje('error', '🔒 Activa tu licencia para guardar cambios');
      cerrarModal();
      return;
    }

    try {
      if (productoEditando) {
        // Actualizar producto existente
        const resultado = await invoke('actualizar_producto', {
          productoId: productoEditando.id,
          codigo: formData.codigo,
          nombre: formData.nombre,
          descripcion: formData.descripcion || null,
          precio: parseFloat(formData.precio),
          stock: parseInt(formData.stock),
          stockMinimo: parseInt(formData.stock_minimo),
          categoriaId: parseInt(formData.categoria_id),
          descuentoPorcentaje: parseFloat(formData.descuento_porcentaje) || 0
        });

        if (resultado.success) {
          mostrarMensaje('success', '✅ Producto actualizado correctamente');
          cerrarModal();
          cargarProductos();
        } else {
          mostrarMensaje('error', `❌ ${resultado.message}`);
        }
      } else {
        // Agregar nuevo producto
        const resultado = await invoke('agregar_producto', {
          producto: {
            codigo: formData.codigo,
            nombre: formData.nombre,
            descripcion: formData.descripcion || null,
            precio: parseFloat(formData.precio),
            stock: parseInt(formData.stock),
            stock_minimo: parseInt(formData.stock_minimo),
            categoria_id: parseInt(formData.categoria_id),
            descuento_porcentaje: parseFloat(formData.descuento_porcentaje) || 0
          }
        });

        if (resultado.success) {
          mostrarMensaje('success', '✅ Producto agregado correctamente');
          cerrarModal();
          cargarProductos();
        } else {
          mostrarMensaje('error', `❌ ${resultado.message}`);
        }
      }
    } catch (error) {
      console.error('Error al guardar producto:', error);
      mostrarMensaje('error', '❌ Error al guardar producto');
    }
  };

  const mostrarMensaje = (tipo, texto) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje({ tipo: '', texto: '' }), 3000);
  };

  const productosFiltrados = productos.filter(producto => {
    const coincideTexto = producto.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
                         producto.codigo.toLowerCase().includes(filtro.toLowerCase());
    const coincideCategoria = categoriaFiltro === '' || 
                             producto.categoria_id.toString() === categoriaFiltro;
    return coincideTexto && coincideCategoria;
  });

  return (
    <div className="inventario-container">
      <div className="inventario-header">
        <button onClick={onVolver} className="btn-volver">
          ← Volver
        </button>
        <h2>Gestión de Inventario</h2>
        <div className="inventario-usuario">👤 {usuario.nombre_completo}</div>
      </div>

      {/* 🆕 Banner de modo solo lectura */}
      {modoSoloLectura && (
        <div className="modo-lectura-banner">
          <span className="icono-lectura">📖</span>
          <span className="texto-lectura">
            Modo Solo Lectura - Puedes ver el inventario pero no editarlo
          </span>
        </div>
      )}

      <div className="inventario-content">
        {/* Barra de herramientas */}
        <div className="toolbar">
          <div className="toolbar-left">
            <input
              type="text"
              placeholder="🔍 Buscar producto..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="input-buscar"
            />
            <select
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              className="select-categoria"
            >
              <option value="">Todas las categorías</option>
              {categorias.map(([id, nombre]) => (
                <option key={id} value={id}>{nombre}</option>
              ))}
            </select>
          </div>

          <div className="toolbar-right">
            <button 
              onClick={() => {
                setMostrarStockBajo(false);
                cargarProductos();
              }}
              className="btn-todos"
            >
              📋 Todos
            </button>
            <button 
              onClick={cargarProductosStockBajo}
              className="btn-stock-bajo"
            >
              ⚠️ Stock Bajo
            </button>
            <button 
              onClick={abrirModalNuevo}
              className="btn-nuevo"
              disabled={modoSoloLectura}  // 🆕 Deshabilitado en modo lectura
              style={{ opacity: modoSoloLectura ? 0.6 : 1, cursor: modoSoloLectura ? 'not-allowed' : 'pointer' }}
            >
              {modoSoloLectura ? '🔒 Nuevo Producto' : '➕ Nuevo Producto'}
            </button>
          </div>
        </div>

        {mensaje.texto && (
          <div className={`mensaje ${mensaje.tipo}`}>
            {mensaje.texto}
          </div>
        )}

        {/* Estadísticas */}
        <div className="stats">
          <div className="stat-card">
            <div className="stat-number">{productos.length}</div>
            <div className="stat-label">Productos Totales</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">
              {productos.filter(p => p.stock <= p.stock_minimo).length}
            </div>
            <div className="stat-label">Stock Bajo</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{categorias.length}</div>
            <div className="stat-label">Categorías</div>
          </div>
        </div>

        {/* Tabla de productos */}
        <div className="tabla-container">
          <table className="tabla-productos">
            <thead>
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Stock Mín</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="8" className="sin-resultados">
                    {mostrarStockBajo 
                      ? '✅ No hay productos con stock bajo' 
                      : 'No se encontraron productos'}
                  </td>
                </tr>
              ) : (
                productosFiltrados.map(producto => (
                  <tr key={producto.id} className={producto.stock <= producto.stock_minimo ? 'stock-bajo-row' : ''}>
                    <td>{producto.codigo}</td>
                    <td className="nombre-col">
                      <div className="nombre-producto">{producto.nombre}</div>
                      {producto.descripcion && (
                        <div className="descripcion-producto">{producto.descripcion}</div>
                      )}
                    </td>
                    <td>{producto.categoria_nombre || 'Sin categoría'}</td>
                    <td className="precio-col">S/ {producto.precio.toFixed(2)}</td>
                    <td className="stock-col">
                      <span className={producto.stock <= producto.stock_minimo ? 'stock-bajo' : 'stock-ok'}>
                        {producto.stock}
                      </span>
                    </td>
                    <td>{producto.stock_minimo}</td>
                    <td>
                      {producto.stock <= producto.stock_minimo ? (
                        <span className="badge badge-warning">⚠️ Bajo</span>
                      ) : (
                        <span className="badge badge-success">✓ OK</span>
                      )}
                    </td>
                    <td>
                      <button 
                        onClick={() => abrirModalEditar(producto)}
                        className="btn-editar"
                        disabled={modoSoloLectura}  // 🆕 Deshabilitado en modo lectura
                        style={{ opacity: modoSoloLectura ? 0.6 : 1, cursor: modoSoloLectura ? 'not-allowed' : 'pointer' }}
                      >
                        {modoSoloLectura ? '🔒 Editar' : '✏️ Editar'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para agregar/editar producto */}
      {mostrarModal && !modoSoloLectura && (  // 🆕 Solo mostrar si NO está en modo lectura
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{productoEditando ? '✏️ Editar Producto' : '➕ Nuevo Producto'}</h3>
              <button onClick={cerrarModal} className="btn-cerrar-modal">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="form-producto">
              <div className="form-row">
                <div className="form-group">
                  <label>Código *</label>
                  <input
                    type="text"
                    value={formData.codigo}
                    onChange={(e) => setFormData({...formData, codigo: e.target.value})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Categoría *</label>
                  <select
                    value={formData.categoria_id}
                    onChange={(e) => setFormData({...formData, categoria_id: e.target.value})}
                    required
                  >
                    {categorias.map(([id, nombre]) => (
                      <option key={id} value={id}>{nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Nombre del Producto *</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Descripción</label>
                <textarea
                  value={formData.descripcion}
                  onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                  rows="3"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Precio *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.precio}
                    onChange={(e) => setFormData({...formData, precio: e.target.value})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Stock Actual *</label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({...formData, stock: e.target.value})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Stock Mínimo *</label>
                  <input
                    type="number"
                    value={formData.stock_minimo}
                    onChange={(e) => setFormData({...formData, stock_minimo: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Descuento % (opcional)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.descuento_porcentaje}
                  onChange={(e) => setFormData({...formData, descuento_porcentaje: parseFloat(e.target.value) || 0})}
                  placeholder="0"
                />
                <small style={{color: '#666', fontSize: '12px', marginTop: '5px', display: 'block'}}>
                  💡 Descuento automático al escanear este producto (0-100%)
                </small>
              </div>

              <div className="form-actions">
                <button type="button" onClick={cerrarModal} className="btn-cancelar">
                  Cancelar
                </button>
                <button type="submit" className="btn-guardar">
                  {productoEditando ? 'Actualizar' : 'Agregar'} Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Inventario;