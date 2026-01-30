import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './Devoluciones.css';

function Devoluciones({ usuario, onVolver }) {
  const [folio, setFolio] = useState('');
  const [ventaEncontrada, setVentaEncontrada] = useState(null);
  const [productosSeleccionados, setProductosSeleccionados] = useState({});
  const [motivo, setMotivo] = useState('DEFECTUOSO');
  const [buscando, setBuscando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);

  const buscarVenta = async () => {
    if (!folio.trim()) {
      mostrarMensaje('error', '❌ Ingresa un folio');
      return;
    }

    setBuscando(true);
    try {
      const venta = await invoke('buscar_venta_para_devolucion', { folio: folio.trim() });
      setVentaEncontrada(venta);
      setProductosSeleccionados({});
      mostrarMensaje('success', '✅ Venta encontrada');
    } catch (error) {
      console.error('Error:', error);
      mostrarMensaje('error', `❌ ${error}`);
      setVentaEncontrada(null);
    } finally {
      setBuscando(false);
    }
  };

  const toggleProducto = (productoId, checked) => {
    if (checked) {
      setProductosSeleccionados({
        ...productosSeleccionados,
        [productoId]: 1
      });
    } else {
      const nuevo = { ...productosSeleccionados };
      delete nuevo[productoId];
      setProductosSeleccionados(nuevo);
    }
  };

  const cambiarCantidad = (productoId, cantidad, maxCantidad) => {
    const cantidadValida = Math.max(1, Math.min(cantidad, maxCantidad));
    setProductosSeleccionados({
      ...productosSeleccionados,
      [productoId]: cantidadValida
    });
  };

  const calcularTotalDevolucion = () => {
    if (!ventaEncontrada) return 0;
    
    let total = 0;
    Object.entries(productosSeleccionados).forEach(([productoId, cantidad]) => {
      const producto = ventaEncontrada.productos.find(p => p.producto_id === parseInt(productoId));
      if (producto) {
        total += producto.precio_unitario * cantidad;
      }
    });
    return total;
  };

  const procesarDevolucion = async () => {
    const productosArray = Object.entries(productosSeleccionados);
    
    if (productosArray.length === 0) {
      mostrarMensaje('error', '❌ Selecciona al menos un producto');
      return;
    }

    // Mostrar modal de confirmación
    setMostrarConfirmacion(true);
  };

  const confirmarDevolucion = async () => {
    setMostrarConfirmacion(false);
    setProcesando(true);
    
    try {
      const productosArray = Object.entries(productosSeleccionados);
      const productos = productosArray.map(([productoId, cantidad]) => ({
        producto_id: parseInt(productoId),
        cantidad: cantidad
      }));

      const resultado = await invoke('procesar_devolucion', {
  ventaId: ventaEncontrada.venta_id,           // ← camelCase
  folioVenta: ventaEncontrada.folio,          // ← camelCase
  productos: productos,
  motivo: motivo,
  usuarioId: usuario.id                 // ← camelCase
});

      mostrarMensaje('success', `✅ ${resultado.message}\nFolio: ${resultado.folio_devolucion}`);
      
      // Limpiar formulario
      setFolio('');
      setVentaEncontrada(null);
      setProductosSeleccionados({});
      setMotivo('DEFECTUOSO');
      
    } catch (error) {
      console.error('❌ Error completo:', error);
      mostrarMensaje('error', `❌ Error: ${error}`);
    } finally {
      setProcesando(false);
    }
  };

  const mostrarMensaje = (tipo, texto) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje({ tipo: '', texto: '' }), 5000);
  };

  const limpiarFormulario = () => {
    setFolio('');
    setVentaEncontrada(null);
    setProductosSeleccionados({});
    setMotivo('DEFECTUOSO');
  };

  return (
    <div className="devoluciones-container">
      <div className="devoluciones-header">
        <button onClick={onVolver} className="btn-volver">
          ← Volver
        </button>
        <h2>Devoluciones</h2>
        <div className="devoluciones-usuario"> {usuario.nombre_completo}</div>
      </div>

      <div className="devoluciones-content">
        {/* Buscar venta */}
        <div className="buscar-venta-card">
          <h3>📄 Buscar Venta por Folio</h3>
          <div className="buscar-input-group">
            <input
              type="text"
              value={folio}
              onChange={(e) => setFolio(e.target.value.toUpperCase())}
              onKeyPress={(e) => e.key === 'Enter' && buscarVenta()}
              placeholder="Ejemplo: V-20260125-0001"
              disabled={buscando}
            />
            <button 
              onClick={buscarVenta} 
              disabled={buscando}
              className="btn-buscar"
            >
              {buscando ? 'Buscando...' : '🔍 Buscar'}
            </button>
          </div>
        </div>

        {mensaje.texto && (
          <div className={`mensaje ${mensaje.tipo}`}>
            {mensaje.texto}
          </div>
        )}

        {/* Detalles de la venta */}
        {ventaEncontrada && (
          <div className="venta-encontrada">
            <div className="venta-info-card">
              <h3>📋 Información de la Venta</h3>
              <div className="venta-info-grid">
                <div className="info-item">
                  <span className="label">Folio:</span>
                  <span className="value">{ventaEncontrada.folio}</span>
                </div>
                <div className="info-item">
                  <span className="label">Fecha:</span>
                  <span className="value">{new Date(ventaEncontrada.fecha_hora).toLocaleString('es-PE')}</span>
                </div>
                <div className="info-item">
                  <span className="label">Total Original:</span>
                  <span className="value">${ventaEncontrada.total.toFixed(2)}</span>
                </div>
                <div className="info-item">
                  <span className="label">Método Pago:</span>
                  <span className="value">{ventaEncontrada.metodo_pago}</span>
                </div>
              </div>
            </div>

            {/* Productos */}
            <div className="productos-devolucion-card">
              <h3>📦 Productos de la Venta</h3>
              <p className="instruccion">Selecciona los productos a devolver:</p>
              
              <div className="productos-lista">
                {ventaEncontrada.productos.map(producto => (
                  <div key={producto.producto_id} className="producto-devolucion-item">
                    <div className="producto-checkbox">
                      <input
                        type="checkbox"
                        checked={!!productosSeleccionados[producto.producto_id]}
                        onChange={(e) => toggleProducto(producto.producto_id, e.target.checked)}
                      />
                    </div>
                    
                    <div className="producto-info">
                      <div className="producto-nombre">{producto.nombre}</div>
                      <div className="producto-detalles">
                        Cantidad vendida: {producto.cantidad} | 
                        Precio unitario: ${producto.precio_unitario.toFixed(2)}
                      </div>
                    </div>

                    {productosSeleccionados[producto.producto_id] && (
                      <div className="cantidad-devolver">
                        <label>Cant. a devolver:</label>
                        <input
                          type="number"
                          min="1"
                          max={producto.cantidad}
                          value={productosSeleccionados[producto.producto_id]}
                          onChange={(e) => cambiarCantidad(
                            producto.producto_id, 
                            parseInt(e.target.value) || 1,
                            producto.cantidad
                          )}
                        />
                      </div>
                    )}

                    <div className="producto-subtotal">
                      {productosSeleccionados[producto.producto_id] && (
                        <span className="subtotal-devolucion">
                          ${(producto.precio_unitario * productosSeleccionados[producto.producto_id]).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Motivo y total */}
            {Object.keys(productosSeleccionados).length > 0 && (
              <div className="devolucion-footer">
                <div className="motivo-card">
                  <label>Motivo de devolución:</label>
                  <select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                    <option value="DEFECTUOSO">Producto defectuoso</option>
                    <option value="TALLA_INCORRECTA">Talla incorrecta</option>
                    <option value="NO_LE_GUSTO">No le gustó</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>

                <div className="total-devolucion-card">
                  <div className="total-label">💵 Total a Devolver:</div>
                  <div className="total-monto">S/ ${calcularTotalDevolucion().toFixed(2)}</div>
                </div>

                <div className="acciones-devolucion">
                  <button onClick={limpiarFormulario} className="btn-cancelar">
                    Cancelar
                  </button>
                  <button 
                    onClick={procesarDevolucion} 
                    disabled={procesando}
                    className="btn-procesar-devolucion"
                  >
                    {procesando ? 'Procesando...' : '✅ Procesar Devolución'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de confirmación */}
      {mostrarConfirmacion && (
        <div className="modal-confirmacion-overlay">
          <div className="modal-confirmacion">
            <h3>⚠️ Confirmar Devolución</h3>
            <p>¿Estás seguro de procesar esta devolución?</p>
            <div className="confirmacion-detalles">
              <strong>Monto a devolver: S/ ${calcularTotalDevolucion().toFixed(2)}</strong>
            </div>
            <div className="confirmacion-acciones">
              <button onClick={() => setMostrarConfirmacion(false)} className="btn-cancelar-modal">
                Cancelar
              </button>
              <button onClick={confirmarDevolucion} className="btn-confirmar-modal">
                ✅ Sí, Procesar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Devoluciones;    