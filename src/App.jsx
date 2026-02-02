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
import SplashScreen from './SplashScreen';
import ModalBienvenida from './ModalBienvenida';
import './App.css';

function App() {
  const [usuario, setUsuario] = useState(null);
  const [vistaActual, setVistaActual] = useState('pos');
  const [sidebarColapsado, setSidebarColapsado] = useState(false);
  
  // Estados de licencia
  const [estadoLicencia, setEstadoLicencia] = useState(null);
  const [modoSoloLectura, setModoSoloLectura] = useState(false);
  const [mostrarActivacion, setMostrarActivacion] = useState(false);
  const [cargandoLicencia, setCargandoLicencia] = useState(true);

  // Estados para splash y modal
  const [mostrarSplash, setMostrarSplash] = useState(false);
  const [tipoSplash, setTipoSplash] = useState('');
  const [mostrarModalBienvenida, setMostrarModalBienvenida] = useState(false);
  const [esPrimeraVez, setEsPrimeraVez] = useState(false);

  // 🔧 MOVER renderContenido AQUÍ (antes de los useEffect)
  const renderContenido = () => {
    if (!tienePermiso(vistaActual)) {
      return (
        <div className="acceso-denegado">
          <h2>🔒 Acceso Denegado</h2>
          <p>No tienes permisos para acceder a este módulo</p>
          <button 
            onClick={() => {
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

  const tienePermiso = (modulo) => {
    if (!usuario) return false;
    
    const permisos = {
      1: { pos: true, inventario: true, reportes: true, configuracion: true, devoluciones: true },
      2: { pos: true, inventario: false, reportes: true, configuracion: false, devoluciones: false },
      3: { pos: false, inventario: true, reportes: false, configuracion: false, devoluciones: false },
    };
    
    return permisos[usuario.rol_id]?.[modulo] || false;
  };

  // Verificar licencia y primera vez al iniciar
  useEffect(() => {
    inicializarApp();
  }, []);

  // Verificar licencia periódicamente (cada 5 minutos)
  useEffect(() => {
    const interval = setInterval(() => {
      verificarLicencia();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // Mostrar modal bienvenida después del primer login
  useEffect(() => {
    console.log('🔍 useEffect modal ejecutado');
    console.log('  usuario:', usuario);
    console.log('  esPrimeraVez:', esPrimeraVez);
    console.log('  mostrarModalBienvenida:', mostrarModalBienvenida);
    
    if (usuario && esPrimeraVez && !mostrarModalBienvenida) {
      console.log('✅ Condiciones cumplidas, mostrando modal...');
      setTimeout(() => {
        console.log('🎉 Seteando mostrarModalBienvenida = true');
        setMostrarModalBienvenida(true);
      }, 500);
    }
  }, [usuario, esPrimeraVez]);

  const inicializarApp = async () => {
    try {
      const estado = await invoke('obtener_estado_licencia');
      setEstadoLicencia(estado);

      const primeraVez = await invoke('verificar_primera_vez');
      console.log('🔍 PRIMERA VEZ:', primeraVez);
      setEsPrimeraVez(primeraVez);

      const diasRestantes = estado.dias_restantes || 0;
      
      if (primeraVez) {
        setTipoSplash('bienvenida');
        setMostrarSplash(true);
      } else if (diasRestantes === 7) {
        setTipoSplash('recordatorio');
        setMostrarSplash(true);
      } else if (diasRestantes === 3 || diasRestantes === 2) {
        setTipoSplash('urgente');
        setMostrarSplash(true);
      } else if (diasRestantes === 1) {
        setTipoSplash('ultimo');
        setMostrarSplash(true);
      } else if (estado.estado === 'EXPIRADO' && diasRestantes === 0) {
        setTipoSplash('expirado');
        setMostrarSplash(true);
      }

      await invoke('verificar_licencia');

      if (estado.estado === 'EXPIRADO' && !modoSoloLectura) {
        setMostrarActivacion(true);
      }

      setModoSoloLectura(estado.modo_solo_lectura);

    } catch (error) {
      console.error('Error al inicializar app:', error);
    } finally {
      setCargandoLicencia(false);
    }
  };

  const verificarLicencia = async () => {
    try {
      const estado = await invoke('obtener_estado_licencia');
      setEstadoLicencia(estado);
      await invoke('verificar_licencia');

      if (estado.estado === 'EXPIRADO' && !usuario && !modoSoloLectura) {
        setMostrarActivacion(true);
      }

      setModoSoloLectura(estado.modo_solo_lectura);
    } catch (error) {
      console.error('Error al verificar licencia:', error);
    }
  };

  const handleCerrarSplash = () => {
    setMostrarSplash(false);
  };

  const handleComprarDesdeSplash = () => {
    setMostrarSplash(false);
    setMostrarActivacion(true);
  };

  const handleCerrarModalBienvenida = async (noMostrarMas) => {
    setMostrarModalBienvenida(false);
    
    if (noMostrarMas) {
      try {
        await invoke('marcar_primera_vez_vista');
        setEsPrimeraVez(false);
      } catch (error) {
        console.error('Error al marcar primera vez:', error);
      }
    }
  };

  const handleVerPlanesDesdeModal = () => {
  setMostrarModalBienvenida(false);
  setMostrarActivacion(true);
};

  const handleActivacionExitosa = async (esModoLectura) => {
    setModoSoloLectura(esModoLectura);
      setMostrarActivacion(false);  // ← Ya cierra el modal
    await verificarLicencia();
  };

  const handleAbrirActivacion = () => {
    setMostrarActivacion(true);
  };

  const handleLoginSuccess = (user) => {
    console.log('🔐 Login exitoso:', user);
    console.log('🔍 esPrimeraVez actual:', esPrimeraVez);
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

  if (mostrarSplash && !usuario) {
    return (
      <SplashScreen 
        diasRestantes={estadoLicencia?.dias_restantes || 0}
        tipo={tipoSplash}
        onContinuar={handleCerrarSplash}
        onComprar={handleComprarDesdeSplash}
        autoCerrar={false}
        duracion={3000}
      />
    );
  }

  if (mostrarActivacion && !usuario) {
    return (
      <ActivarLicencia 
        estadoLicencia={estadoLicencia}
        onActivacionExitosa={handleActivacionExitosa}
      />
    );
  }

  if (!usuario) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  if (mostrarModalBienvenida) {
    return (
      <>
        <div className="app-layout">
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
            <div className={estadoLicencia && (
              estadoLicencia.estado === 'EXPIRADO' || 
              estadoLicencia.estado === 'GRACIA' || 
              estadoLicencia.dias_restantes <= 3
            ) ? 'content-with-banner' : ''}>
              {renderContenido()}
            </div>
          </main>
        </div>
        <ModalBienvenida 
          diasRestantes={estadoLicencia?.dias_restantes || 15}
          onCerrar={handleCerrarModalBienvenida}
          onVerPlanes={handleVerPlanesDesdeModal}
        />
      </>
    );
  }

  if (mostrarActivacion && usuario) {
    return (
      <ActivarLicencia 
        estadoLicencia={estadoLicencia}
        onActivacionExitosa={handleActivacionExitosa}
      />
    );
  }

  return (
    <div className="app-layout">
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