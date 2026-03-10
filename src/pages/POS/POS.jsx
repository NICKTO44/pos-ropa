import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import Recibo from '../../components/Recibo';
import './POS.css';

function POS({ usuario, onVolver, modoSoloLectura }) {
  const [productos, setProductos] = useState([]);
  const [productosFiltrados, setProductosFiltrados] = useState([]);
  const [carrito, setCarrito] = useState([]);
  const [codigoBuscar, setCodigoBuscar] = useState('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('TODAS');
  const [categorias, setCategorias] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [montoRecibido, setMontoRecibido] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
  const [mostrarRecibo, setMostrarRecibo] = useState(false);
  const [datosVenta, setDatosVenta] = useState(null);
  const [mostrarConfirmacionLimpiar, setMostrarConfirmacionLimpiar] = useState(false);
  const inputCodigoRef = useRef(null);

  // 🆕 Modal selector de talla
  const [modalTalla, setModalTalla] = useState(null);
  // modalTalla = { producto, variantes: [{id, talla, stock}] }

  useEffect(() => {
    cargarProductos();
    cargarCategorias();
  }, []);

  const cargarProductos = async () => {
    try {
      const resultado = await invoke('obtener_productos');
      if (resultado.success) {
        setProductos(resultado.productos);
        setProductosFiltrados(resultado.productos);
      }
    } catch (error) {
      console.error('Error al cargar productos:', error);
    }
  };

  const cargarCategorias = async () => {
    try {
      const cats = await invoke('obtener_nombres_categorias');
      setCategorias(['TODAS', ...cats]);
    } catch (error) {
      console.error('Error al cargar categorías:', error);
    }
  };

  useEffect(() => {
    const filtrar = async () => {
      if (codigoBuscar.trim() === '' && categoriaSeleccionada === 'TODAS') {
        setProductosFiltrados(productos);
        return;
      }
      try {
        const resultado = await invoke('buscar_productos_filtrado', {
          termino: codigoBuscar.trim(),
          categoria: categoriaSeleccionada === 'TODAS' ? null : categoriaSeleccionada,
        });
        setProductosFiltrados(resultado);
      } catch {
        setProductosFiltrados([]);
      }
    };
    const t = setTimeout(filtrar, 300);
    return () => clearTimeout(t);
  }, [codigoBuscar, categoriaSeleccionada, productos]);

  const buscarProductoPorCodigo = async () => {
    if (!codigoBuscar.trim()) return;
    if (modoSoloLectura) {
      mostrarMensaje('error', '🔒 Activa tu licencia para procesar ventas');
      return;
    }
    setBuscando(true);
    try {
      const resultadoCodigo = await invoke('buscar_producto_por_codigo', {
        codigo: codigoBuscar.trim(),
      });
      if (resultadoCodigo.success && resultadoCodigo.producto) {
        await manejarAgregarProducto(resultadoCodigo.producto);
        setCodigoBuscar('');
      } else {
        const resultadoFiltrado = await invoke('buscar_productos_filtrado', {
          termino: codigoBuscar.trim(),
          categoria: categoriaSeleccionada === 'TODAS' ? null : categoriaSeleccionada,
        });
        if (resultadoFiltrado.length === 1) {
          await manejarAgregarProducto(resultadoFiltrado[0]);
          setCodigoBuscar('');
        } else if (resultadoFiltrado.length > 1) {
          mostrarMensaje('error', `⚠️ ${resultadoFiltrado.length} productos encontrados. Haz clic en uno.`);
        } else {
          mostrarMensaje('error', '❌ Producto no encontrado');
        }
      }
    } catch (error) {
      console.error('Error:', error);
      mostrarMensaje('error', '❌ Error al buscar producto');
    } finally {
      setBuscando(false);
      inputCodigoRef.current?.focus();
    }
  };

const getStockClass = (stock) => {
  if (stock === 0) return 'out';
  if (stock <= 3)  return 'low';
  return 'normal';
};

const getStockTexto = (stock) => {
  if (stock === 0) return 'Agotado';
  return `Stock: ${stock}`;
};

  // 🆕 Punto central para agregar producto — decide si pedir talla o no
  const manejarAgregarProducto = async (producto) => {
    if (modoSoloLectura) {
      mostrarMensaje('error', '🔒 Activa tu licencia para agregar productos al carrito');
      return;
    }

    if (producto.tiene_variantes) {
      // Cargar variantes y mostrar modal
      try {
        const variantes = await invoke('obtener_variantes_producto', {
          productoId: producto.id,
        });
        const disponibles = variantes.filter(v => v.stock > 0);
        if (disponibles.length === 0) {
          mostrarMensaje('error', '❌ Sin stock en ninguna talla');
          return;
        }
        setModalTalla({ producto, variantes: disponibles });
      } catch (e) {
        console.error('Error al cargar variantes:', e);
        mostrarMensaje('error', '❌ Error al cargar tallas');
      }
    } else {
      agregarAlCarrito(producto, null, null);
    }
  };

  // 🆕 Confirmar talla seleccionada desde el modal
  const confirmarTalla = (variante) => {
    if (!modalTalla) return;
    agregarAlCarrito(modalTalla.producto, variante.id, variante.talla, variante.stock);
    setModalTalla(null);
    mostrarMensaje('success', `✅ ${modalTalla.producto.nombre} talla ${variante.talla} agregado`);
    inputCodigoRef.current?.focus();
  };

  const agregarAlCarrito = (producto, varianteId = null, talla = null, stockVariante = null) => {
    // Clave única en carrito: producto_id + variante_id (o solo producto_id si no tiene tallas)
    const claveCarrito = varianteId ? `${producto.id}-${varianteId}` : `${producto.id}`;
    const stockReal = stockVariante !== null ? stockVariante : producto.stock;

    const existe = carrito.find(item => item.claveCarrito === claveCarrito);

    if (existe) {
      if (existe.cantidad < stockReal) {
        setCarrito(carrito.map(item =>
          item.claveCarrito === claveCarrito
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        ));
      } else {
        mostrarMensaje('error', `❌ Stock insuficiente para talla ${talla || ''}`);
      }
    } else {
      if (stockReal > 0) {
        setCarrito([...carrito, {
          claveCarrito,
          id: producto.id,
          variante_id: varianteId,
          talla,
          codigo: producto.codigo,
          nombre: producto.nombre,
          precio: producto.precio,
          cantidad: 1,
          stock: stockReal,
          descuento_porcentaje: producto.descuento_porcentaje || 0,
        }]);
      } else {
        mostrarMensaje('error', '❌ Producto sin stock');
      }
    }
  };

  const modificarCantidad = (claveCarrito, nuevaCantidad) => {
    if (modoSoloLectura) return;
    const producto = carrito.find(item => item.claveCarrito === claveCarrito);
    if (nuevaCantidad < 1) { eliminarDelCarrito(claveCarrito); return; }
    if (nuevaCantidad > producto.stock) {
      mostrarMensaje('error', `❌ Solo hay ${producto.stock} en stock`);
      return;
    }
    setCarrito(carrito.map(item =>
      item.claveCarrito === claveCarrito ? { ...item, cantidad: nuevaCantidad } : item
    ));
  };

  const eliminarDelCarrito = (claveCarrito) => {
    if (modoSoloLectura) return;
    setCarrito(carrito.filter(item => item.claveCarrito !== claveCarrito));
  };

  const aplicarDescuento = (claveCarrito, descuento) => {
    if (modoSoloLectura) return;
    const d = Math.min(Math.max(descuento, 0), 100);
    setCarrito(carrito.map(item =>
      item.claveCarrito === claveCarrito ? { ...item, descuento_porcentaje: d } : item
    ));
  };

  const calcularSubtotalItem = (item) => {
    const sub = item.precio * item.cantidad;
    return sub - sub * ((item.descuento_porcentaje || 0) / 100);
  };

  const calcularSubtotal    = () => carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const calcularDescuentoTotal = () => carrito.reduce((s, i) => {
    const sub = i.precio * i.cantidad;
    return s + sub * ((i.descuento_porcentaje || 0) / 100);
  }, 0);
  const calcularTotal = () => carrito.reduce((s, i) => s + calcularSubtotalItem(i), 0);
  const calcularCambio = () => {
    if (metodoPago !== 'EFECTIVO') return 0;
    return (parseFloat(montoRecibido) || 0) - calcularTotal();
  };

  const procesarVenta = async () => {
    if (modoSoloLectura) { mostrarMensaje('error', '🔒 Activa tu licencia para procesar ventas'); return; }
    if (carrito.length === 0) { mostrarMensaje('error', '❌ El carrito está vacío'); return; }
    if (metodoPago === 'EFECTIVO' && (parseFloat(montoRecibido) || 0) < calcularTotal()) {
      mostrarMensaje('error', '❌ Monto insuficiente'); return;
    }

    setProcesando(true);
    try {
      // 🆕 Incluir variante_id y talla en cada producto
      const productosVenta = carrito.map(item => ({
        id: item.id,
        nombre: item.nombre,
        codigo: item.codigo,
        precio: item.precio,
        cantidad: item.cantidad,
        descuentoPorcentaje: item.descuento_porcentaje || 0,
        varianteId: item.variante_id || null,
        talla: item.talla || null,
      }));

      const resultado = await invoke('procesar_venta', {
        productos: productosVenta,
        total: calcularTotal(),
        metodoPago,
        montoRecibido: metodoPago === 'EFECTIVO' ? parseFloat(montoRecibido) : null,
        cambio: metodoPago === 'EFECTIVO' ? calcularCambio() : null,
        usuarioId: usuario.id,
      });

      const ventaParaRecibo = {
        folio: resultado.folio,
        subtotal: calcularSubtotal(),
        descuento: calcularDescuentoTotal(),
        total: calcularTotal(),
        metodoPago,
        montoRecibido: metodoPago === 'EFECTIVO' ? parseFloat(montoRecibido) : 0,
        cambio: metodoPago === 'EFECTIVO' ? calcularCambio() : 0,
        cajero: usuario.nombre_completo,
        productos: carrito.map(item => ({
          nombre: item.nombre + (item.talla ? ` (${item.talla})` : ''),
          cantidad: item.cantidad,
          precio: item.precio,
          descuento: item.descuento_porcentaje || 0,
        })),
      };

      setDatosVenta(ventaParaRecibo);
      setMostrarRecibo(true);
      setCarrito([]);
      setMontoRecibido('');
      setCodigoBuscar('');
      await cargarProductos();
      mostrarMensaje('success', '✅ Venta procesada exitosamente');
    } catch (error) {
      console.error('❌ Error al procesar venta:', error);
      mostrarMensaje('error', `❌ ${error}`);
    } finally {
      setProcesando(false);
      inputCodigoRef.current?.focus();
    }
  };

  const mostrarMensaje = (tipo, texto) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje({ tipo: '', texto: '' }), 3000);
  };

  const limpiarCarrito = () => {
    if (modoSoloLectura) return;
    setMostrarConfirmacionLimpiar(true);
  };

  const confirmarLimpiarCarrito = () => {
    setCarrito([]);
    setMontoRecibido('');
    setCodigoBuscar('');
    setMostrarConfirmacionLimpiar(false);
    inputCodigoRef.current?.focus();
  };

  return (
    <div className="pos-container">
      <div className="pos-header">
        <button onClick={onVolver} className="btn-volver">← Volver</button>
        <h2>🛒 Punto de Venta</h2>
        <div className="pos-usuario">{usuario.nombre_completo}</div>
      </div>

      {modoSoloLectura && (
        <div className="modo-lectura-banner">
          <span className="icono-lectura">📖</span>
          <span className="texto-lectura">
            Modo Solo Lectura - Puedes ver productos pero no procesar ventas
          </span>
        </div>
      )}

      <div className="pos-content">
        {/* ===== IZQUIERDA: Búsqueda y productos ===== */}
        <div className="pos-left">
          <div className="busqueda-rapida">
            <h3>🔍 Buscar Producto</h3>
            <div className="input-group">
              <input
                ref={inputCodigoRef}
                type="text"
                value={codigoBuscar}
                onChange={(e) => setCodigoBuscar(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && buscarProductoPorCodigo()}
                placeholder="Escanea código o escribe nombre..."
                disabled={buscando || modoSoloLectura}
                autoFocus
              />
              <select
                value={categoriaSeleccionada}
                onChange={(e) => setCategoriaSeleccionada(e.target.value)}
                className="select-categoria"
                disabled={modoSoloLectura}
              >
                {categorias.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <button
                onClick={buscarProductoPorCodigo}
                disabled={buscando || modoSoloLectura}
              >
                {buscando ? 'Buscando...' : '🔍 Buscar'}
              </button>
            </div>
            {(codigoBuscar || categoriaSeleccionada !== 'TODAS') && (
              <div className="filtros-activos">
                {codigoBuscar && <span className="badge">📝 "{codigoBuscar}"</span>}
                {categoriaSeleccionada !== 'TODAS' && (
                  <span className="badge">🏷️ {categoriaSeleccionada}</span>
                )}
              </div>
            )}
          </div>

          <div className="lista-productos">
            <h3>📦 Productos Disponibles</h3>
            
            
          <div className="productos-grid">
            {productosFiltrados.map(producto => {
              const sinStock   = producto.stock === 0;
              const stockClass = getStockClass(producto.stock);

              return (
                <div
                  key={producto.id}
                  className={[
                    'producto-card',
                    modoSoloLectura      ? 'disabled'   : '',
                    sinStock             ? 'sin-stock'  : '',
                    stockClass === 'low' ? 'stock-low'  : '',
                    producto.tiene_variantes ? 'con-tallas' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => !modoSoloLectura && !sinStock && manejarAgregarProducto(producto)}
                >
                  <div className="producto-nombre">{producto.nombre}</div>
                  <div className="producto-precio">S/ {producto.precio.toFixed(2)}</div>

                  <div className="producto-stock">
                    <span className={`stock-texto ${stockClass !== 'normal' ? stockClass : ''}`}>
                      {getStockTexto(producto.stock)}
                    </span>
                  </div>

                  {producto.tiene_variantes && producto.tallas_disponibles && (
                    <div className="tallas-chips">
                      {producto.tallas_disponibles.map(t => (
                        <span key={t} className="talla-chip-card">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </div>
        </div>

        {/* ===== DERECHA: Carrito ===== */}
        <div className="pos-right">
          <div className="carrito">
            <h3>🛒 Carrito de Compra</h3>

            {carrito.length === 0 ? (
              <div className="carrito-vacio">
                <p>El carrito está vacío</p>
                <p>{modoSoloLectura ? 'Activa tu licencia para procesar ventas' : 'Escanea un producto para comenzar'}</p>
              </div>
            ) : (
              <div className="carrito-items">
                {carrito.map(item => (
                  <div key={item.claveCarrito} className="carrito-item">
                    <div className="item-info">
                      <div className="item-nombre">
                        {item.nombre}
                        {item.talla && (
                          <span className="item-talla-badge">Talla {item.talla}</span>
                        )}
                      </div>
                      <div className="item-precio">S/ {item.precio.toFixed(2)}</div>
                    </div>

                    <div className="item-controles">
                      <div className="cantidad-control">
                        <button
                          onClick={() => modificarCantidad(item.claveCarrito, item.cantidad - 1)}
                          className="btn-cantidad"
                          disabled={modoSoloLectura}
                        >−</button>
                        <input
                          type="number"
                          value={item.cantidad}
                          onChange={(e) => modificarCantidad(item.claveCarrito, parseInt(e.target.value) || 1)}
                          className="input-cantidad"
                          min="1" max={item.stock}
                          disabled={modoSoloLectura}
                        />
                        <button
                          onClick={() => modificarCantidad(item.claveCarrito, item.cantidad + 1)}
                          className="btn-cantidad"
                          disabled={modoSoloLectura}
                        >+</button>
                      </div>

                      <div className="descuento-control">
                        <label>Desc %:</label>
                        <input
                          type="number" min="0" max="100"
                          value={item.descuento_porcentaje || 0}
                          onChange={(e) => aplicarDescuento(item.claveCarrito, parseFloat(e.target.value) || 0)}
                          className="input-descuento"
                          disabled={modoSoloLectura}
                        />
                      </div>

                      <button
                        onClick={() => eliminarDelCarrito(item.claveCarrito)}
                        className="btn-eliminar"
                        disabled={modoSoloLectura}
                      >🗑️</button>
                    </div>

                    <div className="item-subtotal">
                      {item.descuento_porcentaje > 0 && (
                        <div className="item-descuento-aplicado">
                          Descuento: -S/ {(item.precio * item.cantidad * item.descuento_porcentaje / 100).toFixed(2)}
                        </div>
                      )}
                      <div className="subtotal-valor">
                        Subtotal: S/ {calcularSubtotalItem(item).toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="totales">
            <div className="total-row">
              <span>Subtotal:</span>
              <span>S/ {calcularSubtotal().toFixed(2)}</span>
            </div>
            {calcularDescuentoTotal() > 0 && (
              <div className="total-row descuento">
                <span>Descuento total:</span>
                <span>-S/ {calcularDescuentoTotal().toFixed(2)}</span>
              </div>
            )}
            <div className="total-row total-final">
              <span>TOTAL:</span>
              <span>S/ {calcularTotal().toFixed(2)}</span>
            </div>
          </div>

          <div className="metodo-pago">
            <h4>Método de Pago</h4>
            <div className="metodos">
              {['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'].map(m => (
                <button
                  key={m}
                  className={metodoPago === m ? 'active' : ''}
                  onClick={() => !modoSoloLectura && setMetodoPago(m)}
                  disabled={modoSoloLectura}
                >
                  {m === 'EFECTIVO' ? ' Efectivo' : m === 'TARJETA' ? ' Tarjeta' : ' Transferencia'}
                </button>
              ))}
            </div>
          </div>

          {metodoPago === 'EFECTIVO' && carrito.length > 0 && (
            <div className="monto-recibido">
              <label>Monto Recibido:</label>
              <input
                type="number"
                value={montoRecibido}
                onChange={(e) => setMontoRecibido(e.target.value)}
                placeholder="0.00"
                step="0.01"
                disabled={modoSoloLectura}
              />
              {montoRecibido && (
                <div className="cambio">
                  <span>Cambio:</span>
                  <span className={calcularCambio() >= 0 ? 'positivo' : 'negativo'}>
                    S/ {calcularCambio().toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}

          {mensaje.texto && (
            <div className={`mensaje ${mensaje.tipo}`}>{mensaje.texto}</div>
          )}

          <div className="acciones">
            <button
              onClick={limpiarCarrito}
              className="btn-limpiar"
              disabled={carrito.length === 0 || modoSoloLectura}
            >🗑️ Limpiar</button>
            <button
              onClick={procesarVenta}
              className="btn-procesar"
              disabled={carrito.length === 0 || procesando || modoSoloLectura}
            >
              {procesando ? 'Procesando...' : modoSoloLectura ? '🔒 Licencia Expirada' : '✅ Procesar Venta'}
            </button>
          </div>
        </div>
      </div>

      {/* ======================== MODAL SELECTOR DE TALLA ======================== */}
      {modalTalla && (
        <div className="modal-talla-overlay" onClick={() => setModalTalla(null)}>
          <div className="modal-talla" onClick={e => e.stopPropagation()}>
            <div className="modal-talla-header">
              <div>
                <h3>{modalTalla.producto.nombre}</h3>
                <p className="modal-talla-precio">S/ {modalTalla.producto.precio.toFixed(2)}</p>
              </div>
              <button className="btn-cerrar-modal-talla" onClick={() => setModalTalla(null)}>✕</button>
            </div>
            <p className="modal-talla-hint">Selecciona una talla para agregar al carrito:</p>
            <div className="modal-talla-grid">
              {modalTalla.variantes.map(v => (
                <button
                  key={v.id}
                  className="talla-opcion"
                  onClick={() => confirmarTalla(v)}
                >
                  <span className="talla-opcion-nombre">{v.talla}</span>
                  <span className="talla-opcion-stock">{v.stock} disp.</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmación limpiar */}
      {mostrarConfirmacionLimpiar && (
        <div className="modal-confirmacion-overlay">
          <div className="modal-confirmacion">
            <h3>⚠️ Limpiar Carrito</h3>
            <p>¿Estás seguro de que deseas eliminar todos los productos del carrito?</p>
            <div className="confirmacion-acciones">
              <button onClick={() => setMostrarConfirmacionLimpiar(false)} className="btn-cancelar-modal">
                Cancelar
              </button>
              <button onClick={confirmarLimpiarCarrito} className="btn-confirmar-modal">
                ✅ Sí, Limpiar
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarRecibo && datosVenta && (
        <Recibo
          venta={datosVenta}
          onCerrar={() => {
            setMostrarRecibo(false);
            setDatosVenta(null);
            inputCodigoRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}

export default POS;