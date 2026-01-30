import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import Recibo from './Recibo';
import './POS.css';

function POS({ usuario, onVolver }) {
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

  // Cargar productos y categorías al inicio
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

  // Búsqueda inteligente en tiempo real
  useEffect(() => {
    const filtrar = async () => {
      if (codigoBuscar.trim() === '' && categoriaSeleccionada === 'TODAS') {
        setProductosFiltrados(productos);
        return;
      }

      try {
        const resultado = await invoke('buscar_productos_filtrado', {
          termino: codigoBuscar.trim(),
          categoria: categoriaSeleccionada === 'TODAS' ? null : categoriaSeleccionada
        });
        setProductosFiltrados(resultado);
      } catch (error) {
        console.error('Error al filtrar:', error);
        setProductosFiltrados([]);
      }
    };

    const timeoutId = setTimeout(filtrar, 300); // Debounce de 300ms
    return () => clearTimeout(timeoutId);
  }, [codigoBuscar, categoriaSeleccionada, productos]);

const buscarProductoPorCodigo = async () => {
  if (!codigoBuscar.trim()) return;
  
  setBuscando(true);
  try {
    // Primero intentar buscar por código exacto (para códigos de barras)
    const resultadoCodigo = await invoke('buscar_producto_por_codigo', { 
      codigo: codigoBuscar.trim() 
    });
    
    if (resultadoCodigo.success && resultadoCodigo.producto) {
      // Encontrado por código exacto
      agregarAlCarrito(resultadoCodigo.producto);
      setCodigoBuscar('');
      mostrarMensaje('success', `✅ ${resultadoCodigo.producto.nombre} agregado`);
    } else {
      // No encontrado por código, buscar por nombre
      const resultadoFiltrado = await invoke('buscar_productos_filtrado', {
        termino: codigoBuscar.trim(),
        categoria: categoriaSeleccionada === 'TODAS' ? null : categoriaSeleccionada
      });
      
      if (resultadoFiltrado.length === 1) {
        // Solo un resultado, agregarlo automáticamente
        agregarAlCarrito(resultadoFiltrado[0]);
        setCodigoBuscar('');
        mostrarMensaje('success', `✅ ${resultadoFiltrado[0].nombre} agregado`);
      } else if (resultadoFiltrado.length > 1) {
        // Múltiples resultados, mostrar mensaje
        mostrarMensaje('error', `⚠️ ${resultadoFiltrado.length} productos encontrados. Haz clic en uno.`);
      } else {
        // Ningún resultado
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

  const agregarAlCarrito = (producto) => {
    const existe = carrito.find(item => item.id === producto.id);
    
    if (existe) {
      if (existe.cantidad < producto.stock) {
        setCarrito(carrito.map(item =>
          item.id === producto.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        ));
      } else {
        mostrarMensaje('error', '❌ Stock insuficiente');
      }
    } else {
      if (producto.stock > 0) {
        setCarrito([...carrito, {
          id: producto.id,
          codigo: producto.codigo,
          nombre: producto.nombre,
          precio: producto.precio,
          cantidad: 1,
          stock: producto.stock,
          descuento_porcentaje: producto.descuento_porcentaje || 0
        }]);
      } else {
        mostrarMensaje('error', '❌ Producto sin stock');
      }
    }
  };

  const modificarCantidad = (productoId, nuevaCantidad) => {
    const producto = carrito.find(item => item.id === productoId);
    
    if (nuevaCantidad < 1) {
      eliminarDelCarrito(productoId);
      return;
    }

    if (nuevaCantidad > producto.stock) {
      mostrarMensaje('error', `❌ Solo hay ${producto.stock} en stock`);
      return;
    }

    setCarrito(carrito.map(item =>
      item.id === productoId
        ? { ...item, cantidad: nuevaCantidad }
        : item
    ));
  };

  const eliminarDelCarrito = (productoId) => {
    setCarrito(carrito.filter(item => item.id !== productoId));
  };

  const aplicarDescuento = (productoId, descuento) => {
    const descuentoValido = Math.min(Math.max(descuento, 0), 100);
    setCarrito(carrito.map(item =>
      item.id === productoId
        ? { ...item, descuento_porcentaje: descuentoValido }
        : item
    ));
  };

  const calcularSubtotalItem = (item) => {
    const subtotal = item.precio * item.cantidad;
    const descuento = subtotal * ((item.descuento_porcentaje || 0) / 100);
    return subtotal - descuento;
  };

  const calcularSubtotal = () => {
    return carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  };

  const calcularDescuentoTotal = () => {
    return carrito.reduce((sum, item) => {
      const subtotal = item.precio * item.cantidad;
      const descuento = subtotal * ((item.descuento_porcentaje || 0) / 100);
      return sum + descuento;
    }, 0);
  };

  const calcularTotal = () => {
    return carrito.reduce((sum, item) => sum + calcularSubtotalItem(item), 0);
  };

  const calcularCambio = () => {
    if (metodoPago !== 'EFECTIVO') return 0;
    const recibido = parseFloat(montoRecibido) || 0;
    const total = calcularTotal();
    return recibido - total;
  };

  const procesarVenta = async () => {
    if (carrito.length === 0) {
      mostrarMensaje('error', '❌ El carrito está vacío');
      return;
    }

    const total = calcularTotal();
    
    if (metodoPago === 'EFECTIVO') {
      const recibido = parseFloat(montoRecibido) || 0;
      if (recibido < total) {
        mostrarMensaje('error', '❌ Monto insuficiente');
        return;
      }
    }

    setProcesando(true);

    try {
      const productosVenta = carrito.map(item => ({
        id: item.id,
        nombre: item.nombre,
        codigo: item.codigo,
        precio: item.precio,
        cantidad: item.cantidad,
        descuentoPorcentaje: item.descuento_porcentaje || 0
      }));

      const resultado = await invoke('procesar_venta', {
        productos: productosVenta,
        total: calcularTotal(),
        metodoPago: metodoPago,
        montoRecibido: metodoPago === 'EFECTIVO' ? parseFloat(montoRecibido) : null,
        cambio: metodoPago === 'EFECTIVO' ? calcularCambio() : null,
        usuarioId: usuario.id
      });

      const ventaParaRecibo = {
        folio: resultado.folio,
        subtotal: calcularSubtotal(),
        descuento: calcularDescuentoTotal(),
        total: calcularTotal(),
        metodoPago: metodoPago,
        montoRecibido: metodoPago === 'EFECTIVO' ? parseFloat(montoRecibido) : 0,
        cambio: metodoPago === 'EFECTIVO' ? calcularCambio() : 0,
        cajero: usuario.nombre_completo,
        productos: carrito.map(item => ({
          nombre: item.nombre,
          cantidad: item.cantidad,
          precio: item.precio,
          descuento: item.descuento_porcentaje || 0
        }))
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
      mostrarMensaje('error', '❌ Error al procesar venta');
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
        <button onClick={onVolver} className="btn-volver">
          ← Volver
        </button>
        <h2> Punto de Venta</h2>
        <div className="pos-usuario">{usuario.nombre_completo}</div>
      </div>

      <div className="pos-content">
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
                disabled={buscando}
                autoFocus
              />
              <select 
                value={categoriaSeleccionada}
                onChange={(e) => setCategoriaSeleccionada(e.target.value)}
                className="select-categoria"
              >
                {categorias.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <button 
                onClick={buscarProductoPorCodigo}
                disabled={buscando}
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
              {productosFiltrados.map(producto => (
                <div 
                  key={producto.id} 
                  className="producto-card"
                  onClick={() => agregarAlCarrito(producto)}
                >
                  <div className="producto-nombre">{producto.nombre}</div>
                  <div className="producto-precio">S/ {producto.precio.toFixed(2)}</div>
                  <div className="producto-stock">Stock: {producto.stock}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="pos-right">
          <div className="carrito">
            <h3>🛒 Carrito de Compra</h3>
            
            {carrito.length === 0 ? (
              <div className="carrito-vacio">
                <p>El carrito está vacío</p>
                <p>Escanea un producto para comenzar</p>
              </div>
            ) : (
              <div className="carrito-items">
                {carrito.map(item => (
                  <div key={item.id} className="carrito-item">
                    <div className="item-info">
                      <div className="item-nombre">{item.nombre}</div>
                      <div className="item-precio">S/ {item.precio.toFixed(2)}</div>
                    </div>
                    
                    <div className="item-controles">
                      <div className="cantidad-control">
                        <button 
                          onClick={() => modificarCantidad(item.id, item.cantidad - 1)}
                          className="btn-cantidad"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          value={item.cantidad}
                          onChange={(e) => modificarCantidad(item.id, parseInt(e.target.value) || 1)}
                          className="input-cantidad"
                          min="1"
                          max={item.stock}
                        />
                        <button 
                          onClick={() => modificarCantidad(item.id, item.cantidad + 1)}
                          className="btn-cantidad"
                        >
                          +
                        </button>
                      </div>
                      
                      <div className="descuento-control">
                        <label>Desc %:</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.descuento_porcentaje || 0}
                          onChange={(e) => aplicarDescuento(item.id, parseFloat(e.target.value) || 0)}
                          className="input-descuento"
                        />
                      </div>
                      
                      <button 
                        onClick={() => eliminarDelCarrito(item.id)}
                        className="btn-eliminar"
                      >
                        🗑️
                      </button>
                    </div>
                    
                    <div className="item-subtotal">
                      {item.descuento_porcentaje > 0 && (
                        <div className="item-descuento-aplicado">
                          Descuento: -S/ {((item.precio * item.cantidad * item.descuento_porcentaje) / 100).toFixed(2)}
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
              <button
                className={metodoPago === 'EFECTIVO' ? 'active' : ''}
                onClick={() => setMetodoPago('EFECTIVO')}
              >
                💵 Efectivo
              </button>
              <button
                className={metodoPago === 'TARJETA' ? 'active' : ''}
                onClick={() => setMetodoPago('TARJETA')}
              >
                💳 Tarjeta
              </button>
              <button
                className={metodoPago === 'TRANSFERENCIA' ? 'active' : ''}
                onClick={() => setMetodoPago('TRANSFERENCIA')}
              >
                📱 Transferencia
              </button>
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
              />
              {montoRecibido && (
                <div className="cambio">
                  <span>Cambio:</span>
                  <span className={calcularCambio() >= 0 ? 'positivo' : 'negativo'}>
                    S/ ${calcularCambio().toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}

          {mensaje.texto && (
            <div className={`mensaje ${mensaje.tipo}`}>
              {mensaje.texto}
            </div>
          )}

          <div className="acciones">
            <button 
              onClick={limpiarCarrito}
              className="btn-limpiar"
              disabled={carrito.length === 0}
            >
              🗑️ Limpiar
            </button>
            <button 
              onClick={procesarVenta}
              className="btn-procesar"
              disabled={carrito.length === 0 || procesando}
            >
              {procesando ? 'Procesando...' : '✅ Procesar Venta'}
            </button>
          </div>
        </div>
      </div>
{/* Modal de confirmación para limpiar carrito */}
{mostrarConfirmacionLimpiar && (
  <div className="modal-confirmacion-overlay">
    <div className="modal-confirmacion">
      <h3>⚠️ Limpiar Carrito</h3>
      <p>¿Estás seguro de que deseas eliminar todos los productos del carrito?</p>
      <div className="confirmacion-acciones">
        <button 
          onClick={() => setMostrarConfirmacionLimpiar(false)} 
          className="btn-cancelar-modal"
        >
          Cancelar
        </button>
        <button 
          onClick={confirmarLimpiarCarrito} 
          className="btn-confirmar-modal"
        >
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