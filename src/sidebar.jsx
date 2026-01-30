import React from 'react';
import './Sidebar.css';

function Sidebar({ 
  moduloActual, 
  cambiarModulo, 
  usuario, 
  cerrarSesion, 
  colapsado, 
  toggleColapsar 
}) {
  
  // Definir todos los módulos con sus permisos
  const todosLosModulos = [
    {
      id: 'pos',
      nombre: 'Punto de Venta',
      icono: '💳',
      descripcion: 'Ventas',
      roles: [1, 2] // Administrador y Cajero
    },
    {
      id: 'inventario',
      nombre: 'Inventario',
      icono: '📦',
      descripcion: 'Gestión de productos',
      roles: [1, 3] // Administrador y Almacenista
    },
    {
      id: 'reportes',
      nombre: 'Reportes',
      icono: '📈',
      descripcion: 'Análisis de ventas',
      roles: [1, 2] // Administrador y Cajero
    },
    {
      id: 'devoluciones',
      nombre: 'Devoluciones',
      icono: '↩️',
      descripcion: 'Procesar devoluciones',
      roles: [1] // Solo Administrador
    },
    {
      id: 'configuracion',
      nombre: 'Configuración',
      icono: '⚙️',
      descripcion: 'Ajustes del sistema',
      roles: [1] // Solo Administrador
    }
  ];

  // Filtrar módulos según el rol del usuario
  const modulosPermitidos = todosLosModulos.filter(modulo => 
    modulo.roles.includes(usuario?.rol_id)
  );

  return (
    <div className={`sidebar ${colapsado ? 'colapsado' : ''}`}>
      {/* Header con logo y toggle */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="logo-icon">🏪</div>
          {!colapsado && (
            <div className="logo-text">
              <h2>Sistema Tienda</h2>
              <p>POS</p>
            </div>
          )}
        </div>
        <button 
          className="btn-toggle-sidebar" 
          onClick={toggleColapsar}
          title={colapsado ? 'Expandir' : 'Colapsar'}
        >
          {colapsado ? '→' : '←'}
        </button>
      </div>

      {/* Navegación - Solo muestra módulos permitidos */}
      <nav className="sidebar-nav">
        {modulosPermitidos.map(modulo => (
          <button
            key={modulo.id}
            className={`nav-item ${moduloActual === modulo.id ? 'active' : ''}`}
            onClick={() => cambiarModulo(modulo.id)}
            title={colapsado ? modulo.nombre : ''}
          >
            <span className="nav-icon">{modulo.icono}</span>
            {!colapsado && (
              <div className="nav-text">
                <span className="nav-nombre">{modulo.nombre}</span>
                <span className="nav-descripcion">{modulo.descripcion}</span>
              </div>
            )}
            {!colapsado && moduloActual === modulo.id && (
              <div className="active-indicator"></div>
            )}
          </button>
        ))}
      </nav>

      {/* Usuario y cerrar sesión */}
      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">
            {usuario?.nombre_completo?.charAt(0).toUpperCase() || 'U'}
          </div>
          {!colapsado && (
            <div className="user-details">
              <span className="user-nombre">{usuario?.nombre_completo || 'Usuario'}</span>
              <span className="user-rol">{usuario?.rol || 'Rol'}</span>
            </div>
          )}
        </div>
        <button 
          className="btn-cerrar-sesion" 
          onClick={cerrarSesion}
          title="Cerrar Sesión"
        >
          {colapsado ? '🚪' : '🚪 Cerrar Sesión'}
        </button>
      </div>
    </div>
  );
}

export default Sidebar;