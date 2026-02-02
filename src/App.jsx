import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import Login from './Login';
import Sidebar from './Sidebar';
import POS from './POS';
import Inventario from './Inventario';
import Reportes from './Reportes';
import Configuracion from './Configuracion';
import Devoluciones from './Devoluciones';
import ActivarLicencia from './ActivarLicencia';
import BannerLicencia from './BannerLicencia';
import './App.css';

function App() {
  const [usuario, setUsuario] = useState(null);
  const [vistaActual, setVistaActual] = useState('pos');
  const [sidebarColapsado, setSidebarColapsado] = useState(false);
  
  // 🆕 Estados de licencia
  const [estadoLicencia, setEstadoLicencia] = useState(null);
  const [modoSoloLectura, setModoSoloLectura] = useState(false);
  const [mostrarActivacion, setMostrarActivacion] = useState(false);
  const [cargandoLicencia, setCargandoLicencia] = useState(true);

  // 🆕 Verificar licencia al iniciar
  useEffect(() => {
    verificarLicencia();
  }, []);

  // 🆕 Verificar licencia periódicamente (cada 5 minutos)
  useEffect(() => {
    const interval = setInterval(() => {
      verificarLicencia();
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(interval);
  }, []);

  // 🆕 Función para verificar estado de licencia
  const verificarLicencia = async () => {
    try {
      const estado = await invoke('obtener_estado_licencia');
      setEstadoLicencia(estado);

      // Actualizar estado en el backend
      await invoke('verificar_licencia');

      // 🔧 ARREGLADO: Solo mostrar activación si NO está en modo lectura
      if (estado.estado === 'EXPIRADO' && !usuario && !modoSoloLectura) {
        setMostrarActivacion(true);
      }

      // Determinar modo solo lectura
      setModoSoloLectura(estado.modo_solo_lectura);

    } catch (error) {
      console.error('Error al verificar licencia:', error);
    } finally {
      setCargandoLicencia(false);
    }
  };

  // 🆕 Manejar activación exitosa
  const handleActivacionExitosa = async (esModoLectura) => {
    setModoSoloLectura(esModoLectura);
    setMostrarActivacion(false);
    
    // 🔧 ARREGLADO: NO recargar licencia, ya la tenemos
    // El estado de licencia no cambió, solo cambiamos de vista
  };

  // 🆕 Abrir modal de activación desde banner
  const handleAbrirActivacion = () => {
    setMostrarActivacion(true);
  };

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

  // 🆕 Si está cargando licencia, mostrar splash
  if (cargandoLicencia) {
    return (
      <div className="app-loading">
        <div className="loading-spinner">
          <div className="spinner-icon">🏪</div>
          <p>Cargando sistema...</p>
        </div>
      </div>
    );
  }

  // 🆕 Si está expirado y no hay usuario, mostrar activación
  if (estadoLicencia?.estado === 'EXPIRADO' && !usuario && mostrarActivacion) {
    return (
      <ActivarLicencia 
        estadoLicencia={estadoLicencia}
        onActivacionExitosa={handleActivacionExitosa}
      />
    );
  }

  // Si no hay usuario, mostrar login
  if (!usuario) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // 🆕 Si usuario logueado en modo lectura, puede ver modal de activación
  if (mostrarActivacion && usuario) {
    return (
      <ActivarLicencia 
        estadoLicencia={estadoLicencia}
        onActivacionExitosa={handleActivacionExitosa}
      />
    );
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

    // 🆕 Pasar modoSoloLectura a todos los módulos
    switch (vistaActual) {
      case 'pos':
        return <POS usuario={usuario} onVolver={() => setVistaActual('pos')} modoSoloLectura={modoSoloLectura} />;
      
      case 'inventario':
        return <Inventario usuario={usuario} onVolver={() => setVistaActual('pos')} modoSoloLectura={modoSoloLectura} />;
      
      case 'reportes':
        return <Reportes usuario={usuario} onVolver={() => setVistaActual('pos')} modoSoloLectura={modoSoloLectura} />;
      
      case 'devoluciones':
        return <Devoluciones usuario={usuario} onVolver={() => setVistaActual('pos')} modoSoloLectura={modoSoloLectura} />;
      
      case 'configuracion':
        return <Configuracion usuario={usuario} onVolver={() => setVistaActual('pos')} modoSoloLectura={modoSoloLectura} />;
      
      default:
        return <POS usuario={usuario} onVolver={() => setVistaActual('pos')} modoSoloLectura={modoSoloLectura} />;
    }
  };

  // Layout con Sidebar + Contenido
  return (
    <div className="app-layout">
      {/* 🆕 Banner de licencia */}
      <BannerLicencia 
        estadoLicencia={estadoLicencia}
        onActivarClick={handleAbrirActivacion}
      />

      <Sidebar
        moduloActual={vistaActual}
        cambiarModulo={cambiarModulo}
        usuario={usuario}
        cerrarSesion={handleLogout}
        colapsado={sidebarColapsado}
        toggleColapsar={toggleSidebar}
      />
      
      <main className="app-content">
        {/* 🆕 Agregar padding-top si hay banner visible */}
        <div className={estadoLicencia && (
          estadoLicencia.estado === 'EXPIRADO' || 
          estadoLicencia.estado === 'GRACIA' || 
          estadoLicencia.dias_restantes <= 3
        ) ? 'content-with-banner' : ''}>
          {renderContenido()}
        </div>
      </main>
    </div>
  );
}

export default App;