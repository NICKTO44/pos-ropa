import { useState } from 'react';
import Login from './Login';
import POS from './POS';
import Inventario from './Inventario';
import Reportes from './Reportes';
import Configuracion from './Configuracion';
import Devoluciones from './Devoluciones';
import './App.css';

function App() {
  const [usuario, setUsuario] = useState(null);
  const [vistaActual, setVistaActual] = useState('dashboard');

  const handleLoginSuccess = (user) => {
    setUsuario(user);
    setVistaActual('dashboard');
  };

  const handleLogout = () => {
    setUsuario(null);
    setVistaActual('dashboard');
  };

  const abrirVista = (vista) => {
    setVistaActual(vista);
  };

  // Función para verificar permisos
  const tienePermiso = (modulo) => {
    if (!usuario) return false;
    
    const permisos = {
      1: { pos: true, inventario: true, reportes: true, configuracion: true, devoluciones: true },      // Administrador
      2: { pos: true, inventario: false, reportes: true, configuracion: false, devoluciones: false },    // Cajero
      3: { pos: false, inventario: true, reportes: false, configuracion: false, devoluciones: false },   // Almacenista
    };
    
    return permisos[usuario.rol_id]?.[modulo] || false;
  };

  if (!usuario) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Renderizar vista según la selección
  if (vistaActual === 'pos') {
    if (!tienePermiso('pos')) {
      return (
        <div className="app-container">
          <div className="acceso-denegado">
            <h2>🔒 Acceso Denegado</h2>
            <p>No tienes permisos para acceder al Punto de Venta</p>
            <button onClick={() => setVistaActual('dashboard')} className="btn-volver">
              ← Volver al Inicio
            </button>
          </div>
        </div>
      );
    }
    return <POS usuario={usuario} onVolver={() => setVistaActual('dashboard')} />;
  }

  if (vistaActual === 'inventario') {
    if (!tienePermiso('inventario')) {
      return (
        <div className="app-container">
          <div className="acceso-denegado">
            <h2>🔒 Acceso Denegado</h2>
            <p>No tienes permisos para acceder al Inventario</p>
            <button onClick={() => setVistaActual('dashboard')} className="btn-volver">
              ← Volver al Inicio
            </button>
          </div>
        </div>
      );
    }
    return <Inventario usuario={usuario} onVolver={() => setVistaActual('dashboard')} />;
  }

  if (vistaActual === 'reportes') {
    if (!tienePermiso('reportes')) {
      return (
        <div className="app-container">
          <div className="acceso-denegado">
            <h2>🔒 Acceso Denegado</h2>
            <p>No tienes permisos para acceder a los Reportes</p>
            <button onClick={() => setVistaActual('dashboard')} className="btn-volver">
              ← Volver al Inicio
            </button>
          </div>
        </div>
      );
    }
    return <Reportes usuario={usuario} onVolver={() => setVistaActual('dashboard')} />;
  }

  if (vistaActual === 'configuracion') {
    if (!tienePermiso('configuracion')) {
      return (
        <div className="app-container">
          <div className="acceso-denegado">
            <h2>🔒 Acceso Denegado</h2>
            <p>Solo los administradores pueden acceder a esta sección</p>
            <button onClick={() => setVistaActual('dashboard')} className="btn-volver">
              ← Volver al Inicio
            </button>
          </div>
        </div>
      );
    }
    return <Configuracion usuario={usuario} onVolver={() => setVistaActual('dashboard')} />;
  }

  if (vistaActual === 'devoluciones') {
    if (!tienePermiso('devoluciones')) {
      return (
        <div className="app-container">
          <div className="acceso-denegado">
            <h2>🔒 Acceso Denegado</h2>
            <p>Solo los administradores pueden procesar devoluciones</p>
            <button onClick={() => setVistaActual('dashboard')} className="btn-volver">
              ← Volver al Inicio
            </button>
          </div>
        </div>
      );
    }
    return <Devoluciones usuario={usuario} onVolver={() => setVistaActual('dashboard')} />;
  }

  // Dashboard principal con control de permisos
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🏪 Sistema de Tienda</h1>
        <div className="user-info">
          <span>👤 {usuario.nombre_completo}</span>
          <button onClick={handleLogout} className="logout-btn">
            Cerrar Sesión
          </button>
        </div>
      </header>

      <main className="app-main">
        <div className="dashboard">
          <h2>Bienvenido al Sistema</h2>
          <p>Has iniciado sesión correctamente como: <strong>{usuario.username}</strong></p>
          
          <div className="menu-cards">
            {tienePermiso('pos') && (
              <div className="card" onClick={() => abrirVista('pos')}>
                <h3>💰 Ventas</h3>
                <p>Punto de venta</p>
              </div>
            )}
            
            {tienePermiso('inventario') && (
              <div className="card" onClick={() => abrirVista('inventario')}>
                <h3>📦 Inventario</h3>
                <p>Gestión de productos</p>
              </div>
            )}
            
            {tienePermiso('reportes') && (
              <div className="card" onClick={() => abrirVista('reportes')}>
                <h3>📊 Reportes</h3>
                <p>Análisis de ventas</p>
              </div>
            )}
            
            {tienePermiso('devoluciones') && (
              <div className="card" onClick={() => abrirVista('devoluciones')}>
                <h3>🔄 Devoluciones</h3>
                <p>Procesar devoluciones</p>
              </div>
            )}
            
            {tienePermiso('configuracion') && (
              <div className="card" onClick={() => abrirVista('configuracion')}>
                <h3>⚙️ Configuración</h3>
                <p>Ajustes del sistema</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;