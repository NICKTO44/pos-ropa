import { useState, useEffect } from 'react';
import './BannerLicencia.css';

function BannerLicencia({ estadoLicencia, onActivarClick }) {
  const [mostrar, setMostrar] = useState(true);

  // No mostrar banner si está en estado normal (trial activo con más de 3 días)
  if (!estadoLicencia) return null;
  
  const { estado, tipo_licencia, dias_restantes } = estadoLicencia;

  // Si está activo y tiene más de 3 días, no mostrar nada
  if (estado === 'ACTIVO' && dias_restantes > 3) {
    return null;
  }

  // Determinar estilo según estado
  let claseEstado = 'banner-info';
  let icono = 'ℹ️';
  let mensaje = '';

  if (estado === 'EXPIRADO') {
    claseEstado = 'banner-error';
    icono = '🔒';
    mensaje = 'Licencia expirada - Modo Solo Lectura activo';
  } else if (estado === 'GRACIA') {
    claseEstado = 'banner-warning';
    icono = '⚠️';
    const diasGracia = Math.abs(dias_restantes);
    mensaje = `Licencia expirada - Período de gracia: ${diasGracia} día${diasGracia !== 1 ? 's' : ''} restante${diasGracia !== 1 ? 's' : ''}`;
  } else if (dias_restantes <= 3) {
    claseEstado = 'banner-warning';
    icono = '⏰';
    mensaje = `Tu ${tipo_licencia === 'TRIAL' ? 'período de prueba' : 'licencia'} expira en ${dias_restantes} día${dias_restantes !== 1 ? 's' : ''}`;
  }

  if (!mostrar) return null;

  return (
    <div className={`banner-licencia ${claseEstado}`}>
      <div className="banner-contenido">
        <span className="banner-icono">{icono}</span>
        <span className="banner-mensaje">{mensaje}</span>
      </div>
      <div className="banner-acciones">
        <button onClick={onActivarClick} className="banner-btn-activar">
          🔑 Activar Licencia
        </button>
        <button onClick={() => setMostrar(false)} className="banner-btn-cerrar">
          ✕
        </button>
      </div>
    </div>
  );
}

export default BannerLicencia;