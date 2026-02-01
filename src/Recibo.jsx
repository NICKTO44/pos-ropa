import { useRef, useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import jsPDF from 'jspdf';
import './Recibo.css';

function Recibo({ venta, onCerrar }) {
  const reciboRef = useRef(null);
  const [configTienda, setConfigTienda] = useState({
    nombre_tienda: 'TIENDA DE ROPA',
    rfc: 'XAXX010101000',
    telefono: '(555) 123-4567',
    direccion: '',
    mensaje_recibo: '¡GRACIAS POR SU COMPRA!'
  });

  // Cargar configuración al montar el componente
  useEffect(() => {
    cargarConfiguracion();
  }, []);

  const cargarConfiguracion = async () => {
    try {
      const config = await invoke('obtener_configuracion_tienda');
      setConfigTienda(config);
    } catch (error) {
      console.error('Error al cargar configuración:', error);
      // Si falla, usa los valores por defecto que ya están en el estado
    }
  };

  const handleDescargarPDF = () => {
    const doc = new jsPDF({
      unit: 'mm',
      format: [80, 297], // Ancho 80mm, largo variable (máx A4)
      orientation: 'portrait'
    });

    let y = 10;
    const lineHeight = 5;

    // Header con datos dinámicos
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(configTienda.nombre_tienda.toUpperCase(), 40, y, { align: 'center' });
    y += lineHeight + 2;
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text('Sistema de Ventas', 40, y, { align: 'center' });
    y += lineHeight;
    
    if (configTienda.rfc) {
      doc.text(`RFC: ${configTienda.rfc}`, 40, y, { align: 'center' });
      y += lineHeight;
    }
    
    if (configTienda.telefono) {
      doc.text(`Tel: ${configTienda.telefono}`, 40, y, { align: 'center' });
      y += lineHeight;
    }
    
    if (configTienda.direccion) {
      doc.setFontSize(8);
      const direccionLineas = doc.splitTextToSize(configTienda.direccion, 70);
      direccionLineas.forEach(linea => {
        doc.text(linea, 40, y, { align: 'center' });
        y += lineHeight - 1;
      });
      doc.setFontSize(9);
    }
    
    y += 3;

    // Separador
    doc.text('================================', 5, y);
    y += lineHeight + 2;

    // Info
    doc.setFontSize(9);
    doc.text(`FOLIO: ${venta.folio}`, 5, y);
    y += lineHeight;
    
    const fecha = new Date().toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    doc.text(`FECHA: ${fecha}`, 5, y);
    y += lineHeight;
    doc.text(`CAJERO: ${venta.cajero}`, 5, y);
    y += lineHeight + 3;

    // Separador
    doc.text('================================', 5, y);
    y += lineHeight + 2;

    // Productos
    doc.setFont(undefined, 'bold');
    doc.text('CANT  DESCRIPCION    P.UNIT   TOTAL', 5, y);
    y += lineHeight;
    doc.setFont(undefined, 'normal');

    venta.productos.forEach(producto => {
      const nombre = producto.nombre.length > 20 
        ? producto.nombre.substring(0, 20) + '...' 
        : producto.nombre;
      
      const linea = `${producto.cantidad}x    ${nombre}`;
      doc.text(linea, 5, y);
      y += lineHeight;
      
      const precioUnitario = producto.precio.toFixed(2);
      const totalLinea = (producto.cantidad * producto.precio).toFixed(2);
      const precio = `       S/ ${precioUnitario}   S/ ${totalLinea}`;
      doc.text(precio, 5, y);
      y += lineHeight + 1;
    });

    y += 2;
    doc.text('================================', 5, y);
    y += lineHeight + 2;

    // Totales
    doc.text(`SUBTOTAL:`, 5, y);
    doc.text(`S/ ${venta.subtotal.toFixed(2)}`, 70, y, { align: 'right' });
    y += lineHeight;

    if (venta.descuento > 0) {
      doc.text(`DESCUENTO:`, 5, y);
      doc.text(`-S/ ${venta.descuento.toFixed(2)}`, 70, y, { align: 'right' });
      y += lineHeight;
    }

    doc.setFont(undefined, 'bold');
    doc.setFontSize(11);
    doc.text(`TOTAL:`, 5, y);
    doc.text(`S/ ${venta.total.toFixed(2)}`, 70, y, { align: 'right' });
    y += lineHeight + 3;

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text('================================', 5, y);
    y += lineHeight + 2;

    // Pago
    doc.text(`METODO DE PAGO: ${venta.metodoPago}`, 5, y);
    y += lineHeight;

    if (venta.metodoPago === 'EFECTIVO') {
      doc.text(`EFECTIVO: S/ ${venta.montoRecibido.toFixed(2)}`, 5, y);
      y += lineHeight;
      doc.text(`CAMBIO: S/ ${venta.cambio.toFixed(2)}`, 5, y);
      y += lineHeight;
    }

    y += 3;
    doc.text('================================', 5, y);
    y += lineHeight + 2;

    // Footer con mensaje personalizable
    doc.setFont(undefined, 'bold');
    const mensajePrincipal = configTienda.mensaje_recibo || '¡GRACIAS POR SU COMPRA!';
    doc.text(mensajePrincipal, 40, y, { align: 'center' });
    y += lineHeight;
    doc.setFont(undefined, 'normal');
    doc.text('Vuelva Pronto', 40, y, { align: 'center' });
    y += lineHeight + 2;
    doc.setFontSize(7);
    doc.text('Este ticket no es valido como factura', 40, y, { align: 'center' });
    y += lineHeight;
    doc.text('Para devoluciones conserve su ticket', 40, y, { align: 'center' });

    // Guardar PDF
    doc.save(`Ticket-${venta.folio}.pdf`);
  };

  const handleImprimir = () => {
    // Ocultar los botones antes de imprimir
    const botonesAcciones = document.querySelector('.recibo-acciones');
    if (botonesAcciones) {
      botonesAcciones.style.display = 'none';
    }

    // Imprimir
    window.print();

    // Restaurar botones después de imprimir/cancelar
    setTimeout(() => {
      if (botonesAcciones) {
        botonesAcciones.style.display = 'flex';
      }
    }, 100);
  };

  const formatearFecha = () => {
    const ahora = new Date();
    return ahora.toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="recibo-overlay">
      <div className="recibo-container">
        <div className="recibo-acciones no-print">
          <button onClick={handleImprimir} className="btn-imprimir">
            🖨️ Imprimir
          </button>
          <button onClick={handleDescargarPDF} className="btn-descargar">
            📥 Descargar PDF
          </button>
          <button onClick={onCerrar} className="btn-cerrar">
            ✕ Cerrar
          </button>
        </div>

        <div className="recibo-ticket" ref={reciboRef}>
          <div className="recibo-header">
            <h1>🏪 {configTienda.nombre_tienda}</h1>
            <p>Sistema de Ventas</p>
            {configTienda.rfc && <p>RUC: {configTienda.rfc}</p>}
            {configTienda.telefono && <p>Tel: {configTienda.telefono}</p>}
            {configTienda.direccion && <p className="direccion">{configTienda.direccion}</p>}
          </div>

          <div className="recibo-separador">================================</div>

          <div className="recibo-info">
            <div className="info-row">
              <span>FOLIO:</span>
              <span><strong>{venta.folio}</strong></span>
            </div>
            <div className="info-row">
              <span>FECHA:</span>
              <span>{formatearFecha()}</span>
            </div>
            <div className="info-row">
              <span>CAJERO:</span>
              <span>{venta.cajero}</span>
            </div>
          </div>

          <div className="recibo-separador">================================</div>

          <div className="recibo-productos">
            <table>
              <thead>
                <tr>
                  <th>CANT</th>
                  <th>DESCRIPCIÓN</th>
                  <th>P.UNIT</th>
                  <th>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {venta.productos.map((producto, index) => (
                  <tr key={index}>
                    <td>{producto.cantidad}</td>
                    <td className="desc">{producto.nombre}</td>
                    <td>S/ {producto.precio.toFixed(2)}</td>
                    <td>S/ {(producto.cantidad * producto.precio * (1 - (producto.descuento || 0) / 100)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="recibo-separador">================================</div>

          <div className="recibo-totales">
            <div className="total-row">
              <span>SUBTOTAL:</span>
              <span>S/ {venta.subtotal.toFixed(2)}</span>
            </div>
            {venta.descuento > 0 && (
              <div className="total-row">
                <span>DESCUENTO:</span>
                <span>-S/ {venta.descuento.toFixed(2)}</span>
              </div>
            )}
            <div className="total-row total-final">
              <span><strong>TOTAL:</strong></span>
              <span><strong>S/ {venta.total.toFixed(2)}</strong></span>
            </div>
          </div>

          <div className="recibo-separador">================================</div>

          <div className="recibo-pago">
            <div className="pago-row">
              <span>MÉTODO DE PAGO:</span>
              <span><strong>{venta.metodoPago}</strong></span>
            </div>
            {venta.metodoPago === 'EFECTIVO' && (
              <>
                <div className="pago-row">
                  <span>EFECTIVO:</span>
                  <span>S/ {venta.montoRecibido.toFixed(2)}</span>
                </div>
                <div className="pago-row">
                  <span>CAMBIO:</span>
                  <span>S/ {venta.cambio.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>

          <div className="recibo-separador">================================</div>

          <div className="recibo-footer">
            <p>{configTienda.mensaje_recibo || '¡GRACIAS POR SU COMPRA!'}</p>
            <p>Vuelva Pronto</p>
            <p className="small">Este ticket no es válido como factura</p>
            <p className="small">Para devoluciones conserve su ticket</p>
          </div>

          <div className="recibo-separador">================================</div>
        </div>
      </div>
    </div>
  );
}

export default Recibo;