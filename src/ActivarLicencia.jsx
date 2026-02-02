import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './ActivarLicencia.css';

function ActivarLicencia({ onActivacionExitosa, estadoLicencia }) {
  const [codigo, setCodigo] = useState('');
  const [validando, setValidando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);

  // 🔧 SIN AUTO-FORMATO - Solo limpieza básica
  const handleCodigoChange = (e) => {
    // Convertir a mayúsculas y quitar espacios extra
    const valor = e.target.value.toUpperCase().trim();
    
    console.log('📝 Código ingresado:', valor);
    console.log('📏 Longitud:', valor.length, 'caracteres');
    
    setCodigo(valor);
    setError('');
  };

  const handleActivar = async () => {
    const codigoLimpio = codigo.trim();
    
    console.log('═══════════════════════════════');
    console.log('🔍 Intentando activar...');
    console.log('Código:', codigoLimpio);
    console.log('Longitud:', codigoLimpio.length);
    console.log('═══════════════════════════════');

    if (!codigoLimpio) {
      setError('Por favor ingresa un código');
      return;
    }

    setValidando(true);
    setError('');

    try {
      console.log('📡 Enviando a backend...');
      const resultado = await invoke('activar_licencia', { codigo: codigoLimpio });
      console.log('📨 Respuesta:', resultado);
      
      if (resultado.success) {
        console.log('✅ Activación exitosa!');
        setExito(true);
        setTimeout(() => {
          onActivacionExitosa(false);
        }, 2000);
      } else {
        console.log('❌ Activación fallida:', resultado.mensaje);
        setError(resultado.mensaje);
      }
    } catch (err) {
      console.error('❌ Error de red:', err);
      setError('Error al activar licencia. Intenta nuevamente.');
    } finally {
      setValidando(false);
    }
  };

  const handleModoLectura = () => {
    onActivacionExitosa(true);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !validando) {
      handleActivar();
    }
  };

  return (
    <div className="activar-licencia-overlay">
      <div className="activar-licencia-container">
        {/* Logo/Header */}
        <div className="activar-header">
          <div className="activar-logo">🏪</div>
          <h1>Sistema De Ventas</h1>
          <p className="activar-version">v1.0.1</p>
        </div>

        {/* Estado actual */}
        <div className={`activar-estado ${estadoLicencia?.estado === 'EXPIRADO' ? 'expirado' : 'gracia'}`}>
          {estadoLicencia?.estado === 'EXPIRADO' ? (
            <>
              <span className="icono-estado">🔒</span>
              <div className="estado-texto">
                <h2>Licencia Expirada</h2>
                <p>Tu período de prueba ha finalizado.</p>
                {estadoLicencia?.tipo_licencia === 'TRIAL' && (
                  <p className="estado-detalle">Período de prueba: 15 días completados</p>
                )}
              </div>
            </>
          ) : (
            <>
              <span className="icono-estado">⚠️</span>
              <div className="estado-texto">
                <h2>Período de Gracia</h2>
                <p>Tu licencia expiró. Actívala para continuar.</p>
                <p className="estado-detalle">
                  Quedan {Math.abs(estadoLicencia?.dias_restantes || 0)} días de gracia
                </p>
              </div>
            </>
          )}
        </div>

        {/* Mensaje de éxito */}
        {exito && (
          <div className="activar-exito">
            <span className="icono-exito">✅</span>
            <div>
              <h3>¡Licencia Activada!</h3>
              <p>Redirigiendo...</p>
            </div>
          </div>
        )}

        {/* Formulario de activación */}
        {!exito && (
          <>
            <div className="activar-form">
              <h3>Activar Licencia</h3>
              <p className="activar-instrucciones">
                Copia y pega tu código de activación EXACTAMENTE como fue generado.
              </p>

              <div className="form-group">
                <label>Código de Activación:</label>
                <input
                  type="text"
                  value={codigo}
                  onChange={handleCodigoChange}
                  onKeyPress={handleKeyPress}
                  placeholder="POS-M-XXXX-XXXX-XXXX"
                  className={error ? 'input-error' : ''}
                  disabled={validando}
                  autoFocus
                  spellCheck={false}
                  autoComplete="off"
                  style={{ fontFamily: 'monospace', letterSpacing: '1px' }}
                  maxLength={20}
                />
                <span className="input-hint">
                  📋 Pega el código tal cual (con guiones). Ejemplo: POS-M-A7K9-N2B5-01XM
                  <span style={{float: 'right', color: codigo.length === 20 ? '#22c55e' : '#94a3b8', fontFamily: 'monospace'}}>
                    {codigo.length}/20
                  </span>
                </span>
              </div>

              {error && (
                <div className="activar-error">
                  <span className="icono-error">❌</span>
                  {error}
                </div>
              )}

              <div className="activar-acciones">
                <button 
                  onClick={handleActivar}
                  disabled={validando || !codigo.trim()}
                  className="btn-activar" 
                >
                  {validando ? (
                    <>
                      <span className="spinner">⏳</span>
                      Validando...
                    </>
                  ) : (
                    <>
                      🔑 Activar Licencia
                    </>
                  )}
                </button>
                {/* 🆕 BOTÓN VOLVER (solo si NO está expirado) */}
  {estadoLicencia?.estado !== 'EXPIRADO' && (
    <button
      onClick={() => onActivacionExitosa(false)}
      className="btn-volver-licencia"
      disabled={validando}
    >
      ← Volver al Sistema
    </button>
  )}
                {estadoLicencia?.estado === 'EXPIRADO' && (
                  <button
                    onClick={handleModoLectura}
                    className="btn-lectura"
                    disabled={validando}
                  >
                    📖 Modo Solo Lectura
                  </button>
                )}
              </div>
            </div>

            {/* Información de planes */}
            <div className="activar-planes">
              <h4> Planes Disponibles</h4>
              <div className="planes-grid">
                <div className="plan-card">
                  <div className="plan-header">
                    <span className="plan-icono">📅</span>
                    <h5>Mensual</h5>
                  </div>
                  <div className="plan-precio">S/40 <span>/mes</span></div>
                  <ul className="plan-features">
                    <li>✓ Todas las funciones</li>
                    <li>✓ Soporte por email</li>
                    <li>✓ Actualizaciones incluidas</li>
                  </ul>
                </div>

                <div className="plan-card plan-destacado">
                  <div className="plan-badge">Ahorra 20%</div>
                  <div className="plan-header">
                    <span className="plan-icono">🎯</span>
                    <h5>Anual</h5>
                  </div>
                  <div className="plan-precio"> S/384 <span>/año</span></div>
                  <ul className="plan-features">
                    <li>✓ Todas las funciones</li>
                    <li>✓ Soporte prioritario</li>
                    <li>✓ Actualizaciones incluidas</li>
                    <li>✓ Ahorra S/96 al año</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Footer con contacto */}
            <div className="activar-footer">
              <p>¿Necesitas ayuda?</p>
              <div className="footer-contacto">
                <a href="mailto:desarrollosescritorio4@gmail.com" className="link-contacto">
                  📧 desarrollosescritorio4@gmail.com
                </a>
                <a href="tel:+51927391918" className="link-contacto">
                  📞 +51 927 391 918
                </a>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ActivarLicencia;