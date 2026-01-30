import { useState } from 'react';
import Login from './Login';
import Sidebar from './Sidebar';
import POS from './POS';
import Inventario from './Inventario';
import Reportes from './Reportes';
import Configuracion from './Configuracion';
import Devoluciones from './Devoluciones';
import './App.css';

function App() {
  const [usuario, setUsuario] = useState(null);
  const [vistaActual, setVistaActual] = useState('pos');
  const [sidebarColapsado, setSidebarColapsado] = useState(false);

  const handleLoginSuccess = (user) => {
    setUsuario(user);
    setVistaActual('pos');
  };

  const handleLogout = () => {
    setUsuario(null);
    setVistaActual('pos');
  };

  const cambiarModulo = (modulo) => {
    if (tienePermiso(modulo)) {
      setVistaActual(modulo);
    }
  };

  const toggleSidebar = () => {
    setSidebarColapsado(!sidebarColapsado);
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

  // Si no hay usuario, mostrar login
  if (!usuario) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Función para renderizar el contenido según la vista
  const renderContenido = () => {
    // Verificar permisos antes de renderizar
    if (!tienePermiso(vistaActual)) {
      return (
        <div className="acceso-denegado">
          <h2>🔒 Acceso Denegado</h2>
          <p>No tienes permisos para acceder a este módulo</p>
          <button 
            onClick={() => {
              // Redirigir al primer módulo disponible
              if (tienePermiso('pos')) setVistaActual('pos');
              else if (tienePermiso('inventario')) setVistaActual('inventario');
              else if (tienePermiso('reportes')) setVistaActual('reportes');
            }} 
            className="btn-volver"
          >
            ← Ir al inicio
          </button>
        </div>
      );
    }

    // Renderizar el módulo correspondiente
    switch (vistaActual) {
      case 'pos':
        return <POS usuario={usuario} onVolver={() => setVistaActual('pos')} />;
      
      case 'inventario':
        return <Inventario usuario={usuario} onVolver={() => setVistaActual('pos')} />;
      
      case 'reportes':
        return <Reportes usuario={usuario} onVolver={() => setVistaActual('pos')} />;
      
      case 'devoluciones':
        return <Devoluciones usuario={usuario} onVolver={() => setVistaActual('pos')} />;
      
      case 'configuracion':
        return <Configuracion usuario={usuario} onVolver={() => setVistaActual('pos')} />;
      
      default:
        return <POS usuario={usuario} onVolver={() => setVistaActual('pos')} />;
    }
  };

  // Layout con Sidebar + Contenido
  return (
    <div className="app-layout">
      <Sidebar
        moduloActual={vistaActual}
        cambiarModulo={cambiarModulo}
        usuario={usuario}
        cerrarSesion={handleLogout}
        colapsado={sidebarColapsado}
        toggleColapsar={toggleSidebar}
      />
      
      <main className="app-content">
        {renderContenido()}
      </main>
    </div>
  );
}

export default App;