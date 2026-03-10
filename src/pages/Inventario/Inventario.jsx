import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './Inventario.css';

// Tallas predefinidas según tipo de categoría
const TALLAS_ROPA = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const TALLAS_CALZADO = ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44'];

function Inventario({ usuario, onVolver, modoSoloLectura }) {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]); // [[id, nombre, tipo_talla], ...]
  const [filtro, setFiltro] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [mostrarModal, setMostrarModal] = useState(false);
  const [productoEditando, setProductoEditando] = useState(null);
  const [mostrarStockBajo, setMostrarStockBajo] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
  const [guardando, setGuardando] = useState(false);

  // Form data base
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    precio: '',
    stock: '',
    stock_minimo: '',
    categoria_id: '',
    descuento_porcentaje: 0,
  });

  // Estado de tallas
  const [tieneVariantes, setTieneVariantes] = useState(false);
  const [tipoTallaCategoria, setTipoTallaCategoria] = useState('NINGUNA');
  // { 'S': { activa: true, stock: 3, stock_minimo: 2 }, ... }
  const [tallasSeleccionadas, setTallasSeleccionadas] = useState({});

  useEffect(() => {
    cargarProductos();
    cargarCategorias();
  }, []);

  const cargarProductos = async () => {
    try {
      const resultado = await invoke('obtener_productos');
      if (resultado.success) setProductos(resultado.productos);
    } catch (error) {
      console.error('Error al cargar productos:', error);
    }
  };

  const cargarCategorias = async () => {
    try {
      // Usar el nuevo comando que incluye tipo_talla
      const cats = await invoke('obtener_categorias_con_tipo');
      setCategorias(cats); // [[id, nombre, tipo_talla], ...]
    } catch (error) {
      // Fallback al comando anterior si el nuevo no existe aún
      try {
        const cats = await invoke('obtener_categorias');
        setCategorias(cats.map(([id, nombre]) => [id, nombre, 'ROPA']));
      } catch (e) {
        console.error('Error al cargar categorías:', e);
      }
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

  // Al cambiar categoría en el form → actualizar tipo de talla
  const handleCategoriaChange = (categoriaId) => {
    setFormData(f => ({ ...f, categoria_id: categoriaId }));
    const cat = categorias.find(([id]) => id.toString() === categoriaId.toString());
    const tipo = cat ? cat[2] : 'NINGUNA';
    setTipoTallaCategoria(tipo);
    if (tipo === 'NINGUNA') {
      setTieneVariantes(false);
      setTallasSeleccionadas({});
    }
  };

  const handleToggleVariantes = (activar) => {
    setTieneVariantes(activar);
    if (!activar) setTallasSeleccionadas({});
  };

  const handleToggleTalla = (talla) => {
    setTallasSeleccionadas(prev => {
      if (prev[talla]) {
        const nuevo = { ...prev };
        delete nuevo[talla];
        return nuevo;
      }
      return { ...prev, [talla]: { stock: 0, stock_minimo: 2 } };
    });
  };

  const handleTallaStockChange = (talla, campo, valor) => {
    setTallasSeleccionadas(prev => ({
      ...prev,
      [talla]: { ...prev[talla], [campo]: parseInt(valor) || 0 },
    }));
  };

  const abrirModalNuevo = () => {
    if (modoSoloLectura) {
      mostrarMensaje('error', '🔒 Activa tu licencia para agregar productos');
      return;
    }
    setProductoEditando(null);
    const primeraCat = categorias.length > 0 ? categorias[0] : null;
    setFormData({
      codigo: '',
      nombre: '',
      descripcion: '',
      precio: '',
      stock: '',
      stock_minimo: '',
      categoria_id: primeraCat ? primeraCat[0] : '',
      descuento_porcentaje: 0,
    });
    setTieneVariantes(false);
    setTallasSeleccionadas({});
    setTipoTallaCategoria(primeraCat ? primeraCat[2] : 'NINGUNA');
    setMostrarModal(true);
  };

  const abrirModalEditar = async (producto) => {
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
      descuento_porcentaje: producto.descuento_porcentaje || 0,
    });
    const cat = categorias.find(([id]) => id.toString() === producto.categoria_id.toString());
    const tipo = cat ? cat[2] : 'NINGUNA';
    setTipoTallaCategoria(tipo);
    setTieneVariantes(producto.tiene_variantes || false);

    // Cargar variantes existentes si tiene
    if (producto.tiene_variantes) {
      try {
        const vars = await invoke('obtener_variantes_producto', { productoId: producto.id });
        const tallasMap = {};
        vars.forEach(v => {
          tallasMap[v.talla] = { stock: v.stock, stock_minimo: v.stock_minimo };
        });
        setTallasSeleccionadas(tallasMap);
      } catch (e) {
        console.error('Error al cargar variantes:', e);
        setTallasSeleccionadas({});
      }
    } else {
      setTallasSeleccionadas({});
    }

    setMostrarModal(true);
  };

  const cerrarModal = () => {
    setMostrarModal(false);
    setProductoEditando(null);
    setTieneVariantes(false);
    setTallasSeleccionadas({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (modoSoloLectura) {
      mostrarMensaje('error', '🔒 Activa tu licencia para guardar cambios');
      cerrarModal();
      return;
    }

    if (tieneVariantes && Object.keys(tallasSeleccionadas).length === 0) {
      mostrarMensaje('error', '❌ Selecciona al menos una talla');
      return;
    }

    const variantesArray = tieneVariantes
      ? Object.entries(tallasSeleccionadas).map(([talla, datos]) => ({
          talla,
          stock: datos.stock,
          stock_minimo: datos.stock_minimo,
        }))
      : null;

    setGuardando(true);
    try {
      if (productoEditando) {
        const resultado = await invoke('actualizar_producto', {
          productoId: productoEditando.id,
          codigo: formData.codigo,
          nombre: formData.nombre,
          descripcion: formData.descripcion || null,
          precio: parseFloat(formData.precio),
          stock: tieneVariantes ? 0 : parseInt(formData.stock),
          stockMinimo: parseInt(formData.stock_minimo),
          categoriaId: parseInt(formData.categoria_id),
          descuentoPorcentaje: parseFloat(formData.descuento_porcentaje) || 0,
          tieneVariantes: tieneVariantes,
          variantes: variantesArray,
        });
        if (resultado.success) {
          mostrarMensaje('success', '✅ Producto actualizado correctamente');
          cerrarModal();
          cargarProductos();
        } else {
          mostrarMensaje('error', `❌ ${resultado.message}`);
        }
      } else {
        const resultado = await invoke('agregar_producto', {
          producto: {
            codigo: formData.codigo,
            nombre: formData.nombre,
            descripcion: formData.descripcion || null,
            precio: parseFloat(formData.precio),
            stock: tieneVariantes ? 0 : parseInt(formData.stock),
            stock_minimo: parseInt(formData.stock_minimo),
            categoria_id: parseInt(formData.categoria_id),
            descuento_porcentaje: parseFloat(formData.descuento_porcentaje) || 0,
            tiene_variantes: tieneVariantes,
            variantes: variantesArray,
          },
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
    } finally {
      setGuardando(false);
    }
  };

  const mostrarMensaje = (tipo, texto) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje({ tipo: '', texto: '' }), 3000);
  };

  const productosFiltrados = productos.filter(producto => {
    const coincideTexto =
      producto.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
      producto.codigo.toLowerCase().includes(filtro.toLowerCase());
    const coincideCategoria =
      categoriaFiltro === '' || producto.categoria_id.toString() === categoriaFiltro;
    return coincideTexto && coincideCategoria;
  });

  const tallasDisponibles = tipoTallaCategoria === 'CALZADO' ? TALLAS_CALZADO : TALLAS_ROPA;
  const stockTotalVariantes = Object.values(tallasSeleccionadas).reduce((s, t) => s + (t.stock || 0), 0);

  return (
    <div className="inventario-container">
      <div className="inventario-header">
        <button onClick={onVolver} className="btn-volver">← Volver</button>
        <h2>Gestión de Inventario</h2>
        <div className="inventario-usuario">👤 {usuario.nombre_completo}</div>
      </div>

      {modoSoloLectura && (
        <div className="modo-lectura-banner">
          <span className="icono-lectura">📖</span>
          <span className="texto-lectura">
            Modo Solo Lectura - Puedes ver el inventario pero no editarlo
          </span>
        </div>
      )}

      <div className="inventario-content">
        {/* Toolbar */}
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
            <button onClick={() => { setMostrarStockBajo(false); cargarProductos(); }} className="btn-todos">
              📋 Todos
            </button>
            <button onClick={cargarProductosStockBajo} className="btn-stock-bajo">
              ⚠️ Stock Bajo
            </button>
            <button
              onClick={abrirModalNuevo}
              className="btn-nuevo"
              disabled={modoSoloLectura}
              style={{ opacity: modoSoloLectura ? 0.6 : 1, cursor: modoSoloLectura ? 'not-allowed' : 'pointer' }}
            >
              {modoSoloLectura ? '🔒 Nuevo Producto' : '➕ Nuevo Producto'}
            </button>
          </div>
        </div>

        {mensaje.texto && (
          <div className={`mensaje ${mensaje.tipo}`}>{mensaje.texto}</div>
        )}

        {/* Stats */}
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

        {/* Tabla */}
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
                    {mostrarStockBajo ? '✅ No hay productos con stock bajo' : 'No se encontraron productos'}
                  </td>
                </tr>
              ) : (
                productosFiltrados.map(producto => (
                  <tr key={producto.id} className={producto.stock <= producto.stock_minimo ? 'stock-bajo-row' : ''}>
                    <td>{producto.codigo}</td>
                    <td className="nombre-col">
                      <div className="nombre-producto">
                        {producto.nombre}
                        {producto.tiene_variantes && (
                          <span className="badge-tallas">
                            {/* detectar si es calzado por categoría */}
                            👕 Tallas
                          </span>
                        )}
                      </div>
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
                        disabled={modoSoloLectura}
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

      {/* Modal */}
      {mostrarModal && !modoSoloLectura && (
        <div className="modal-overlay">
          <div className="modal-content modal-content-grande">
            <div className="modal-header">
              <h3>{productoEditando ? '✏️ Editar Producto' : '➕ Nuevo Producto'}</h3>
              <button onClick={cerrarModal} className="btn-cerrar-modal">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="form-producto">

              {/* Código + Categoría */}
              <div className="form-row">
                <div className="form-group">
                  <label>Código *</label>
                  <input
                    type="text"
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Categoría *</label>
                  <select
                    value={formData.categoria_id}
                    onChange={(e) => handleCategoriaChange(e.target.value)}
                    required
                  >
                    {categorias.map(([id, nombre]) => (
                      <option key={id} value={id}>{nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Nombre */}
              <div className="form-group">
                <label>Nombre del Producto *</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                />
              </div>

              {/* Descripción */}
              <div className="form-group">
                <label>Descripción</label>
                <textarea
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  rows="2"
                />
              </div>

              {/* Precio + Stock mínimo + Descuento */}
              <div className="form-row">
                <div className="form-group">
                  <label>Precio *</label>
                  <input
                    type="number" step="0.01"
                    value={formData.precio}
                    onChange={(e) => setFormData({ ...formData, precio: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Stock Mínimo *</label>
                  <input
                    type="number"
                    value={formData.stock_minimo}
                    onChange={(e) => setFormData({ ...formData, stock_minimo: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Descuento %</label>
                  <input
                    type="number" min="0" max="100" step="0.01"
                    value={formData.descuento_porcentaje}
                    onChange={(e) => setFormData({ ...formData, descuento_porcentaje: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
              </div>

              {/* ============ SECCIÓN TALLAS ============ */}
              {tipoTallaCategoria !== 'NINGUNA' ? (
                <div className="seccion-tallas">
                  <div className="tallas-header">
                    <span className="tallas-titulo">
                      {tipoTallaCategoria === 'CALZADO' ? '👟' : '👕'} Tallas
                    </span>
                    <div className="tallas-toggle">
                      <button
                        type="button"
                        className={`toggle-btn ${!tieneVariantes ? 'activo' : ''}`}
                        onClick={() => handleToggleVariantes(false)}
                      >
                        Sin tallas
                      </button>
                      <button
                        type="button"
                        className={`toggle-btn ${tieneVariantes ? 'activo' : ''}`}
                        onClick={() => handleToggleVariantes(true)}
                      >
                        Con tallas
                      </button>
                    </div>
                  </div>

                  {/* Sin variantes → stock único */}
                  {!tieneVariantes && (
                    <div className="form-group" style={{ marginTop: '12px' }}>
                      <label>Stock Actual *</label>
                      <input
                        type="number"
                        value={formData.stock}
                        onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                        required
                      />
                    </div>
                  )}

                  {/* Con variantes → selector de tallas */}
                  {tieneVariantes && (
                    <div className="tallas-selector">
                      <p className="tallas-instruccion">
                        Selecciona las tallas disponibles e ingresa el stock de cada una:
                      </p>
                      <div className="tallas-grid">
                        {tallasDisponibles.map(talla => {
                          const seleccionada = !!tallasSeleccionadas[talla];
                          return (
                            <div key={talla} className={`talla-item ${seleccionada ? 'seleccionada' : ''}`}>
                              <button
                                type="button"
                                className={`talla-btn ${seleccionada ? 'activa' : ''}`}
                                onClick={() => handleToggleTalla(talla)}
                              >
                                {talla}
                              </button>
                              {seleccionada && (
                                <div className="talla-inputs">
                                  <div className="talla-input-grupo">
                                    <span className="talla-input-label">Stock</span>
                                    <input
                                      type="number" min="0"
                                      value={tallasSeleccionadas[talla].stock}
                                      onChange={(e) => handleTallaStockChange(talla, 'stock', e.target.value)}
                                      className="talla-input"
                                    />
                                  </div>
                                  <div className="talla-input-grupo">
                                    <span className="talla-input-label">Mín</span>
                                    <input
                                      type="number" min="0"
                                      value={tallasSeleccionadas[talla].stock_minimo}
                                      onChange={(e) => handleTallaStockChange(talla, 'stock_minimo', e.target.value)}
                                      className="talla-input"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {Object.keys(tallasSeleccionadas).length > 0 && (
                        <div className="tallas-resumen">
                          <span>📦 Stock total:</span>
                          <strong>{stockTotalVariantes} unidades</strong>
                          <span className="tallas-resumen-detalle">
                            ({Object.keys(tallasSeleccionadas).length} talla{Object.keys(tallasSeleccionadas).length !== 1 ? 's' : ''}: {Object.keys(tallasSeleccionadas).join(', ')})
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Categoría sin tallas (Accesorios, Ofertas) → stock único */
                <div className="form-group">
                  <label>Stock Actual *</label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    required
                  />
                  <small style={{ color: '#666', fontSize: '12px', marginTop: '5px', display: 'block' }}>
                    💡 Descuento automático al escanear este producto (0-100%)
                  </small>
                </div>
              )}

              <div className="form-actions">
                <button type="button" onClick={cerrarModal} className="btn-cancelar">
                  Cancelar
                </button>
                <button type="submit" className="btn-guardar" disabled={guardando}>
                  {guardando ? 'Guardando...' : (productoEditando ? 'Actualizar' : 'Agregar')} Producto
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