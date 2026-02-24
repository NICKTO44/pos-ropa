// Caja/AbrirCaja.jsx
// Modal para abrir caja de turno

import { useState } from 'react';
import { abrirCaja } from '../services/cajaService';
import './AbrirCaja.css';

function AbrirCaja({ usuario, onCerrar, onCajaAbierta }) {
  const [turno, setTurno] = useState('MAÑANA');
  const [montoInicial, setMontoInicial] = useState('200');
  const [observaciones, setObservaciones] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const monto = parseFloat(montoInicial);
    
    if (isNaN(monto) || monto < 0) {
      setError('El monto inicial debe ser un número válido');
      return;
    }

    setProcesando(true);

    try {
      const resultado = await abrirCaja(
        usuario.id,
        1, // Número de caja (siempre 1 porque solo hay una)
        turno,
        monto,
        observaciones || null
      );

      if (resultado.success) {
        onCajaAbierta(resultado.caja);
      } else {
        setError(resultado.message);
      }
    } catch (err) {
      console.error('Error:', err);
      setError(err.toString());
    } finally {
      setProcesando(false);
    }
  };

  const horaActual = new Date().getHours();
  const turnoSugerido = 
    horaActual >= 6 && horaActual < 14 ? 'MAÑANA' :
    horaActual >= 14 && horaActual < 22 ? 'TARDE' : 'NOCHE';

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-abrir-caja" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Abrir Caja</h2>
          <button className="btn-cerrar-modal" onClick={onCerrar}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="form-abrir-caja">
          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}

          {/* Información del usuario */}
          <div className="info-usuario">
            <div className="info-item">
              <span className="label">Cajero:</span>
              <span className="value">{usuario.nombre_completo}</span>
            </div>
            <div className="info-item">
              <span className="label">Fecha:</span>
              <span className="value">{new Date().toLocaleDateString('es-PE')}</span>
            </div>
          </div>

          {/* Selección de turno - SIN ICONOS */}
          <div className="form-group">
            <label htmlFor="turno">
              Turno <span className="required">*</span>
            </label>
            <div className="turnos-grid">
              <button
                type="button"
                className={`btn-turno ${turno === 'MAÑANA' ? 'active' : ''}`}
                onClick={() => setTurno('MAÑANA')}
              >
                <div className="turno-info">
                  <span className="turno-nombre">Mañana</span>
                  <span className="turno-horario">8:00 AM - 2:00 PM</span>
                </div>
                {turnoSugerido === 'MAÑANA' && (
                  <span className="badge-sugerido">Sugerido</span>
                )}
              </button>

              <button
                type="button"
                className={`btn-turno ${turno === 'TARDE' ? 'active' : ''}`}
                onClick={() => setTurno('TARDE')}
              >
                <div className="turno-info">
                  <span className="turno-nombre">Tarde</span>
                  <span className="turno-horario">2:00 PM - 10:00 PM</span>
                </div>
                {turnoSugerido === 'TARDE' && (
                  <span className="badge-sugerido">Sugerido</span>
                )}
              </button>

              <button
                type="button"
                className={`btn-turno ${turno === 'NOCHE' ? 'active' : ''}`}
                onClick={() => setTurno('NOCHE')}
              >
                <div className="turno-info">
                  <span className="turno-nombre">Noche</span>
                  <span className="turno-horario">10:00 PM - 6:00 AM</span>
                </div>
                {turnoSugerido === 'NOCHE' && (
                  <span className="badge-sugerido">Sugerido</span>
                )}
              </button>
            </div>
          </div>

          {/* Monto inicial - ARREGLADO */}
          <div className="form-group">
            <label htmlFor="montoInicial">
              Monto Inicial (Fondo de Cambio) <span className="required">*</span>
            </label>
            <div className="input-moneda">
              <span className="simbolo-moneda">S/</span>
              <input
                id="montoInicial"
                type="number"
                step="0.01"
                min="0"
                value={montoInicial}
                onChange={(e) => setMontoInicial(e.target.value)}
                placeholder="200.00"
                required
                autoFocus
              />
            </div>
            <small className="input-hint">
              Cantidad de efectivo con la que inicias la caja
            </small>
          </div>

          {/* Observaciones */}
          <div className="form-group">
            <label htmlFor="observaciones">
              Observaciones (opcional)
            </label>
            <textarea
              id="observaciones"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Ej: Turno normal, todo en orden"
              rows="3"
            />
          </div>

          {/* Acciones */}
          <div className="modal-acciones">
            <button 
              type="button" 
              className="btn-cancelar"
              onClick={onCerrar}
              disabled={procesando}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="btn-abrir"
              disabled={procesando}
            >
              {procesando ? 'Abriendo...' : ' Abrir Caja'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AbrirCaja;