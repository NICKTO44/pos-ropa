import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './Configuracion.css';

function Configuracion({ usuario, onVolver }) {
  // Verificar que solo administradores puedan acceder
  if (usuario.rol_id !== 1) {
    return (
      <div className="configuracion-container">
        <div className="configuracion-header">
          <button onClick={onVolver} className="btn-volver">
            ← Volver
          </button>
          <h2>Configuración del Sistema</h2>
        </div>
        <div style={{ padding: '60px', textAlign: 'center' }}>
          <h2>🔒 Acceso Denegado</h2>
          <p>Solo los administradores pueden acceder a esta sección.</p>
          <button onClick={onVolver} style={{ 
            padding: '10px 20px', 
            background: '#667eea', 
            color: 'white', 
            border: 'none', 
            borderRadius: '8px',
            cursor: 'pointer',
            marginTop: '20px'
          }}>
            Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  // Estados (después de la verificación)
  const [tabActual, setTabActual] = useState('tienda');
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

  // Estados para Datos de la Tienda
  const [configTienda, setConfigTienda] = useState({
    nombre_tienda: '',
    direccion: '',
    telefono: '',
    email: '',
    rfc: '',
    mensaje_recibo: ''
  });
  // Estados para Categorías
  const [categorias, setCategorias] = useState([]);
  const [modalCategoria, setModalCategoria] = useState(false);
  const [categoriaEditando, setCategoriaEditando] = useState(null);
  const [formCategoria, setFormCategoria] = useState({ nombre: '', descripcion: '' });

  // Estados para Usuarios
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [modalUsuario, setModalUsuario] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [formUsuario, setFormUsuario] = useState({
    username: '',
    password: '',
    nombre_completo: '',
    email: '',
    rol_id: ''
  });

  useEffect(() => {
    cargarConfiguracionTienda();
    cargarCategorias();
    cargarUsuarios();
    cargarRoles();
  }, []);

  // ==================== FUNCIONES DE TIENDA ====================
  const cargarConfiguracionTienda = async () => {
    try {
      const config = await invoke('obtener_configuracion_tienda');
      setConfigTienda(config);
    } catch (error) {
      console.error('Error al cargar configuración:', error);
    }
  };

  const guardarConfiguracionTienda = async () => {
    try {
      await invoke('actualizar_configuracion_tienda', {
        nombreTienda: configTienda.nombre_tienda,
        direccion: configTienda.direccion,
        telefono: configTienda.telefono,
        email: configTienda.email,
        rfc: configTienda.rfc,
        mensajeRecibo: configTienda.mensaje_recibo
      });
      mostrarMensaje('success', '✅ Configuración guardada correctamente');
    } catch (error) {
      console.error('Error al guardar configuración:', error);
      mostrarMensaje('error', '❌ Error al guardar configuración');
    }
  };

  // ==================== FUNCIONES DE CATEGORÍAS ====================
  const cargarCategorias = async () => {
    try {
      const cats = await invoke('obtener_categorias');
      const categoriasConDetalles = cats.map(([id, nombre]) => ({
        id,
        nombre,
        descripcion: '',
        activo: true
      }));
      setCategorias(categoriasConDetalles);
    } catch (error) {
      console.error('Error al cargar categorías:', error);
    }
  };

  const abrirModalCategoria = (categoria = null) => {
    if (categoria) {
      setCategoriaEditando(categoria);
      setFormCategoria({
        nombre: categoria.nombre,
        descripcion: categoria.descripcion || ''
      });
    } else {
      setCategoriaEditando(null);
      setFormCategoria({ nombre: '', descripcion: '' });
    }
    setModalCategoria(true);
  };

  const guardarCategoria = async () => {
    try {
      if (categoriaEditando) {
        await invoke('actualizar_categoria', {
          categoriaId: categoriaEditando.id,
          nombre: formCategoria.nombre,
          descripcion: formCategoria.descripcion || null
        });
        mostrarMensaje('success', '✅ Categoría actualizada');
      } else {
        await invoke('agregar_categoria', {
          nombre: formCategoria.nombre,
          descripcion: formCategoria.descripcion || null
        });
        mostrarMensaje('success', '✅ Categoría agregada');
      }
      setModalCategoria(false);
      cargarCategorias();
    } catch (error) {
      console.error('Error al guardar categoría:', error);
      mostrarMensaje('error', '❌ Error al guardar categoría');
    }
  };

  // ==================== FUNCIONES DE USUARIOS ====================
  const cargarUsuarios = async () => {
    try {
      const users = await invoke('obtener_usuarios');
      setUsuarios(users);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
    }
  };

  const cargarRoles = async () => {
    try {
      const rolesData = await invoke('obtener_roles');
      setRoles(rolesData);
    } catch (error) {
      console.error('Error al cargar roles:', error);
    }
  };

  const abrirModalUsuario = (usuario = null) => {
    if (usuario) {
      setUsuarioEditando(usuario);
      setFormUsuario({
        username: usuario.username,
        password: '',
        nombre_completo: usuario.nombre_completo,
        email: usuario.email || '',
        rol_id: usuario.rol_id.toString()
      });
    } else {
      setUsuarioEditando(null);
      setFormUsuario({
        username: '',
        password: '',
        nombre_completo: '',
        email: '',
        rol_id: roles.length > 0 ? roles[0].id.toString() : ''
      });
    }
    setModalUsuario(true);
  };

  const guardarUsuario = async () => {
    try {
      if (usuarioEditando) {
        await invoke('actualizar_usuario', {
          usuarioId: usuarioEditando.id,
          username: formUsuario.username,
          nombreCompleto: formUsuario.nombre_completo,
          email: formUsuario.email || null,
          rolId: parseInt(formUsuario.rol_id),
          nuevaPassword: formUsuario.password || null
        });
        mostrarMensaje('success', '✅ Usuario actualizado');
      } else {
        if (!formUsuario.password) {
          mostrarMensaje('error', '❌ La contraseña es obligatoria');
          return;
        }
        await invoke('agregar_usuario', {
          username: formUsuario.username,
          password: formUsuario.password,
          nombreCompleto: formUsuario.nombre_completo,
          email: formUsuario.email || null,
          rolId: parseInt(formUsuario.rol_id)
        });
        mostrarMensaje('success', '✅ Usuario agregado');
      }
      setModalUsuario(false);
      cargarUsuarios();
    } catch (error) {
      console.error('Error al guardar usuario:', error);
      mostrarMensaje('error', '❌ Error al guardar usuario');
    }
  };

  const mostrarMensaje = (tipo, texto) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje({ tipo: '', texto: '' }), 3000);
  };

  return (
    <div className="configuracion-container">
      <div className="configuracion-header">
        <button onClick={onVolver} className="btn-volver">
          ← Volver
        </button>
        <h2>⚙️ Configuración del Sistema</h2>
        <div className="configuracion-usuario">{usuario.nombre_completo}</div>
      </div>

      <div className="configuracion-content">
        {/* Tabs */}
        <div className="tabs">
          <button
            className={`tab ${tabActual === 'tienda' ? 'active' : ''}`}
            onClick={() => setTabActual('tienda')}
          >
            🏪 Datos de la Tienda
          </button>
          <button
            className={`tab ${tabActual === 'categorias' ? 'active' : ''}`}
            onClick={() => setTabActual('categorias')}
          >
            📂 Categorías
          </button>
          <button
            className={`tab ${tabActual === 'usuarios' ? 'active' : ''}`}
            onClick={() => setTabActual('usuarios')}
          >
            👥 Usuarios
          </button>
        </div>

        {mensaje.texto && (
          <div className={`mensaje ${mensaje.tipo}`}>
            {mensaje.texto}
          </div>
        )}

        {/* Contenido según tab actual */}
        <div className="tab-content">
          {/* TAB: DATOS DE LA TIENDA */}
          {tabActual === 'tienda' && (
            <div className="panel-tienda">
              <h3>Información de la Tienda</h3>
              <form className="form-tienda" onSubmit={(e) => { e.preventDefault(); guardarConfiguracionTienda(); }}>
                <div className="form-group">
                  <label>Nombre de la Tienda *</label>
                  <input
                    type="text"
                    value={configTienda.nombre_tienda}
                    onChange={(e) => setConfigTienda({...configTienda, nombre_tienda: e.target.value})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>RUC</label>
                  <input
                    type="text"
                    value={configTienda.rfc}
                    onChange={(e) => setConfigTienda({...configTienda, rfc: e.target.value})}
                    maxLength="13"
                  />
                </div>

                <div className="form-group">
                  <label>Teléfono</label>
                  <input
                    type="text"
                    value={configTienda.telefono}
                    onChange={(e) => setConfigTienda({...configTienda, telefono: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={configTienda.email}
                    onChange={(e) => setConfigTienda({...configTienda, email: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Dirección</label>
                  <textarea
                    value={configTienda.direccion}
                    onChange={(e) => setConfigTienda({...configTienda, direccion: e.target.value})}
                    rows="3"
                  />
                </div>

                <div className="form-group">
                  <label>Mensaje en Recibo</label>
                  <textarea
                    value={configTienda.mensaje_recibo}
                    onChange={(e) => setConfigTienda({...configTienda, mensaje_recibo: e.target.value})}
                    rows="2"
                  />
                </div>

                <button type="submit" className="btn-guardar-config">
                  💾 Guardar Configuración
                </button>
              </form>
            </div>
          )}

          {/* TAB: CATEGORÍAS */}
          {tabActual === 'categorias' && (
            <div className="panel-categorias">
              <div className="panel-header">
                <h3>Gestión de Categorías</h3>
                <button onClick={() => abrirModalCategoria()} className="btn-nuevo">
                  ➕ Nueva Categoría
                </button>
              </div>

              <div className="tabla-container">
                <table className="tabla-config">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Nombre</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categorias.map(cat => (
                      <tr key={cat.id}>
                        <td>{cat.id}</td>
                        <td>{cat.nombre}</td>
                        <td>
                          <button
                            onClick={() => abrirModalCategoria(cat)}
                            className="btn-editar-small"
                          >
                            ✏️ Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: USUARIOS */}
          {tabActual === 'usuarios' && (
            <div className="panel-usuarios">
              <div className="panel-header">
                <h3>Gestión de Usuarios</h3>
                <button onClick={() => abrirModalUsuario()} className="btn-nuevo">
                  ➕ Nuevo Usuario
                </button>
              </div>

              <div className="tabla-container">
                <table className="tabla-config">
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Nombre Completo</th>
                      <th>Email</th>
                      <th>Rol</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map(user => (
                      <tr key={user.id}>
                        <td>{user.username}</td>
                        <td>{user.nombre_completo}</td>
                        <td>{user.email || '-'}</td>
                        <td>
                          <span className="badge-rol">{user.rol_nombre}</span>
                        </td>
                        <td>
                          {user.activo ? (
                            <span className="badge badge-success">✓ Activo</span>
                          ) : (
                            <span className="badge badge-inactive">✗ Inactivo</span>
                          )}
                        </td>
                        <td>
                          <button
                            onClick={() => abrirModalUsuario(user)}
                            className="btn-editar-small"
                          >
                            ✏️ Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL CATEGORÍA */}
      {modalCategoria && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{categoriaEditando ? '✏️ Editar Categoría' : '➕ Nueva Categoría'}</h3>
              <button onClick={() => setModalCategoria(false)} className="btn-cerrar-modal">✕</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); guardarCategoria(); }} className="form-modal">
              <div className="form-group">
                <label>Nombre *</label>
                <input
                  type="text"
                  value={formCategoria.nombre}
                  onChange={(e) => setFormCategoria({...formCategoria, nombre: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <textarea
                  value={formCategoria.descripcion}
                  onChange={(e) => setFormCategoria({...formCategoria, descripcion: e.target.value})}
                  rows="3"
                />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setModalCategoria(false)} className="btn-cancelar">
                  Cancelar
                </button>
                <button type="submit" className="btn-guardar">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL USUARIO */}
      {modalUsuario && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{usuarioEditando ? '✏️ Editar Usuario' : '➕ Nuevo Usuario'}</h3>
              <button onClick={() => setModalUsuario(false)} className="btn-cerrar-modal">✕</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); guardarUsuario(); }} className="form-modal">
              <div className="form-group">
                <label>Usuario *</label>
                <input
                  type="text"
                  value={formUsuario.username}
                  onChange={(e) => setFormUsuario({...formUsuario, username: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>{usuarioEditando ? 'Nueva Contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}</label>
                <input
                  type="password"
                  value={formUsuario.password}
                  onChange={(e) => setFormUsuario({...formUsuario, password: e.target.value})}
                  required={!usuarioEditando}
                />
              </div>
              <div className="form-group">
                <label>Nombre Completo *</label>
                <input
                  type="text"
                  value={formUsuario.nombre_completo}
                  onChange={(e) => setFormUsuario({...formUsuario, nombre_completo: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formUsuario.email}
                  onChange={(e) => setFormUsuario({...formUsuario, email: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Rol *</label>
                <select
                  value={formUsuario.rol_id}
                  onChange={(e) => setFormUsuario({...formUsuario, rol_id: e.target.value})}
                  required
                >
                  {roles.map(rol => (
                    <option key={rol.id} value={rol.id}>{rol.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setModalUsuario(false)} className="btn-cancelar">
                  Cancelar
                </button>
                <button type="submit" className="btn-guardar">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Configuracion;
