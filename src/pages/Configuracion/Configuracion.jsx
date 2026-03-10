import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './Configuracion.css';

function Configuracion({ usuario, onVolver }) {
  if (usuario.rol_id !== 1) {
    return (
      <div className="configuracion-container">
        <div className="configuracion-header">
          <button onClick={onVolver} className="btn-volver">← Volver</button>
          <h2>Configuracion del Sistema</h2>
        </div>
        <div style={{ padding: '60px', textAlign: 'center' }}>
          <h2>Acceso Denegado</h2>
          <p>Solo los administradores pueden acceder a esta seccion.</p>
          <button onClick={onVolver} style={{ padding: '10px 20px', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '20px' }}>
            Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  const [tabActual, setTabActual] = useState('tienda');
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

  const [configTienda, setConfigTienda] = useState({
    nombre_tienda: '',
    direccion: '',
    telefono: '',
    email: '',
    rfc: '',
    mensaje_recibo: '',
    impresora_ip: '',
    impresora_tipo: 'TERMICA',
    impresora_puerto: 9100,
  });

  const [categorias, setCategorias] = useState([]);
  const [modalCategoria, setModalCategoria] = useState(false);
  const [categoriaEditando, setCategoriaEditando] = useState(null);
  const [formCategoria, setFormCategoria] = useState({ nombre: '', descripcion: '' });

  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [modalUsuario, setModalUsuario] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [formUsuario, setFormUsuario] = useState({
    username: '', password: '', nombre_completo: '', email: '', rol_id: ''
  });

  const [probandoImpresora, setProbandoImpresora] = useState(false);

  useEffect(() => {
    cargarConfiguracionTienda();
    cargarCategorias();
    cargarUsuarios();
    cargarRoles();
  }, []);

  const cargarConfiguracionTienda = async () => {
    try {
      const config = await invoke('obtener_configuracion_tienda');
      setConfigTienda({
        ...config,
        impresora_ip: config.impresora_ip || '',
        impresora_tipo: config.impresora_tipo || 'TERMICA',
        impresora_puerto: config.impresora_puerto || 9100,
      });
    } catch (error) {
      console.error('Error al cargar configuracion:', error);
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
        mensajeRecibo: configTienda.mensaje_recibo,
        impresoraIp: configTienda.impresora_ip,
        impresoraTipo: configTienda.impresora_tipo,
        impresoraPuerto: parseInt(configTienda.impresora_puerto) || 9100,
      });
      mostrarMensaje('success', 'Configuracion guardada correctamente');
    } catch (error) {
      console.error('Error al guardar configuracion:', error);
      mostrarMensaje('error', 'Error al guardar configuracion');
    }
  };

  const probarImpresora = async () => {
    setProbandoImpresora(true);
    try {
      await invoke('probar_impresora');
      mostrarMensaje('success', 'Prueba enviada correctamente');
    } catch (error) {
      mostrarMensaje('error', 'Error: ' + error);
    } finally {
      setProbandoImpresora(false);
    }
  };

  const cargarCategorias = async () => {
    try {
      const cats = await invoke('obtener_categorias');
      setCategorias(cats.map(([id, nombre]) => ({ id, nombre, descripcion: '', activo: true })));
    } catch (error) {
      console.error('Error al cargar categorias:', error);
    }
  };

  const abrirModalCategoria = (categoria = null) => {
    if (categoria) {
      setCategoriaEditando(categoria);
      setFormCategoria({ nombre: categoria.nombre, descripcion: categoria.descripcion || '' });
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
        mostrarMensaje('success', 'Categoria actualizada');
      } else {
        await invoke('agregar_categoria', {
          nombre: formCategoria.nombre,
          descripcion: formCategoria.descripcion || null
        });
        mostrarMensaje('success', 'Categoria agregada');
      }
      setModalCategoria(false);
      cargarCategorias();
    } catch (error) {
      mostrarMensaje('error', 'Error al guardar categoria');
    }
  };

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

  const abrirModalUsuario = (usr = null) => {
    if (usr) {
      setUsuarioEditando(usr);
      setFormUsuario({
        username: usr.username, password: '',
        nombre_completo: usr.nombre_completo,
        email: usr.email || '', rol_id: usr.rol_id.toString()
      });
    } else {
      setUsuarioEditando(null);
      setFormUsuario({
        username: '', password: '', nombre_completo: '',
        email: '', rol_id: roles.length > 0 ? roles[0].id.toString() : ''
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
        mostrarMensaje('success', 'Usuario actualizado');
      } else {
        if (!formUsuario.password) {
          mostrarMensaje('error', 'La contrasena es obligatoria');
          return;
        }
        await invoke('agregar_usuario', {
          username: formUsuario.username,
          password: formUsuario.password,
          nombreCompleto: formUsuario.nombre_completo,
          email: formUsuario.email || null,
          rolId: parseInt(formUsuario.rol_id)
        });
        mostrarMensaje('success', 'Usuario agregado');
      }
      setModalUsuario(false);
      cargarUsuarios();
    } catch (error) {
      mostrarMensaje('error', 'Error al guardar usuario');
    }
  };

  const mostrarMensaje = (tipo, texto) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje({ tipo: '', texto: '' }), 3000);
  };

  return (
    <div className="configuracion-container">
      <div className="configuracion-header">
        <button onClick={onVolver} className="btn-volver">← Volver</button>
        <h2>Configuracion del Sistema</h2>
        <div className="configuracion-usuario">{usuario.nombre_completo}</div>
      </div>

      <div className="configuracion-content">
        <div className="tabs">
          <button className={`tab ${tabActual === 'tienda' ? 'active' : ''}`} onClick={() => setTabActual('tienda')}>
            Datos de la Tienda
          </button>
          <button className={`tab ${tabActual === 'impresora' ? 'active' : ''}`} onClick={() => setTabActual('impresora')}>
            Impresora
          </button>
          <button className={`tab ${tabActual === 'categorias' ? 'active' : ''}`} onClick={() => setTabActual('categorias')}>
            Categorias
          </button>
          <button className={`tab ${tabActual === 'usuarios' ? 'active' : ''}`} onClick={() => setTabActual('usuarios')}>
            Usuarios
          </button>
        </div>

        {mensaje.texto && (
          <div className={`mensaje ${mensaje.tipo}`}>{mensaje.texto}</div>
        )}

        <div className="tab-content">

          {/* TAB: DATOS DE LA TIENDA */}
          {tabActual === 'tienda' && (
            <div className="panel-tienda">
              <h3>Informacion de la Tienda</h3>
              <form className="form-tienda" onSubmit={(e) => { e.preventDefault(); guardarConfiguracionTienda(); }}>
                <div className="form-group">
                  <label>Nombre de la Tienda *</label>
                  <input type="text" value={configTienda.nombre_tienda}
                    onChange={(e) => setConfigTienda({...configTienda, nombre_tienda: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>RUC</label>
                  <input type="text" value={configTienda.rfc}
                    onChange={(e) => setConfigTienda({...configTienda, rfc: e.target.value})} maxLength="13" />
                </div>
                <div className="form-group">
                  <label>Telefono</label>
                  <input type="text" value={configTienda.telefono}
                    onChange={(e) => setConfigTienda({...configTienda, telefono: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={configTienda.email}
                    onChange={(e) => setConfigTienda({...configTienda, email: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Direccion</label>
                  <textarea value={configTienda.direccion}
                    onChange={(e) => setConfigTienda({...configTienda, direccion: e.target.value})} rows="3" />
                </div>
                <div className="form-group">
                  <label>Mensaje en Recibo</label>
                  <textarea value={configTienda.mensaje_recibo}
                    onChange={(e) => setConfigTienda({...configTienda, mensaje_recibo: e.target.value})} rows="2" />
                </div>
                <button type="submit" className="btn-guardar-config">Guardar Configuracion</button>
              </form>
            </div>
          )}

          {/* TAB: IMPRESORA */}
          {tabActual === 'impresora' && (
            <div className="panel-tienda">
              <h3>Configuracion de Impresora</h3>
              <form className="form-tienda" onSubmit={(e) => { e.preventDefault(); guardarConfiguracionTienda(); }}>
                <div className="form-group">
                  <label>Tipo de Impresora</label>
                  <select value={configTienda.impresora_tipo}
                    onChange={(e) => setConfigTienda({...configTienda, impresora_tipo: e.target.value})}>
                    <option value="TERMICA">Termica (TM-T20, TM-T88, etc.)</option>
                    <option value="MATRICIAL">Matricial (TM-U220, etc.)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>IP de la Impresora</label>
                  <input type="text" value={configTienda.impresora_ip}
                    onChange={(e) => setConfigTienda({...configTienda, impresora_ip: e.target.value})}
                    placeholder="Ej: 192.168.18.50" />
                </div>
                <div className="form-group">
                  <label>Puerto</label>
                  <input type="number" value={configTienda.impresora_puerto}
                    onChange={(e) => setConfigTienda({...configTienda, impresora_puerto: e.target.value})}
                    placeholder="9100" />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button type="submit" className="btn-guardar-config">Guardar</button>
                  <button type="button" className="btn-guardar-config"
                    style={{ background: '#48bb78' }}
                    onClick={probarImpresora}
                    disabled={probandoImpresora || !configTienda.impresora_ip}>
                    {probandoImpresora ? 'Probando...' : 'Probar Impresora'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB: CATEGORIAS */}
          {tabActual === 'categorias' && (
            <div className="panel-categorias">
              <div className="panel-header">
                <h3>Gestion de Categorias</h3>
                <button onClick={() => abrirModalCategoria()} className="btn-nuevo">Nueva Categoria</button>
              </div>
              <div className="tabla-container">
                <table className="tabla-config">
                  <thead>
                    <tr><th>ID</th><th>Nombre</th><th>Acciones</th></tr>
                  </thead>
                  <tbody>
                    {categorias.map(cat => (
                      <tr key={cat.id}>
                        <td>{cat.id}</td>
                        <td>{cat.nombre}</td>
                        <td>
                          <button onClick={() => abrirModalCategoria(cat)} className="btn-editar-small">Editar</button>
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
                <h3>Gestion de Usuarios</h3>
                <button onClick={() => abrirModalUsuario()} className="btn-nuevo">Nuevo Usuario</button>
              </div>
              <div className="tabla-container">
                <table className="tabla-config">
                  <thead>
                    <tr><th>Usuario</th><th>Nombre Completo</th><th>Email</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr>
                  </thead>
                  <tbody>
                    {usuarios.map(usr => (
                      <tr key={usr.id}>
                        <td>{usr.username}</td>
                        <td>{usr.nombre_completo}</td>
                        <td>{usr.email || '-'}</td>
                        <td><span className="badge-rol">{usr.rol_nombre}</span></td>
                        <td>
                          {usr.activo
                            ? <span className="badge badge-success">Activo</span>
                            : <span className="badge badge-inactive">Inactivo</span>}
                        </td>
                        <td>
                          <button onClick={() => abrirModalUsuario(usr)} className="btn-editar-small">Editar</button>
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

      {/* MODAL CATEGORIA */}
      {modalCategoria && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{categoriaEditando ? 'Editar Categoria' : 'Nueva Categoria'}</h3>
              <button onClick={() => setModalCategoria(false)} className="btn-cerrar-modal">X</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); guardarCategoria(); }} className="form-modal">
              <div className="form-group">
                <label>Nombre *</label>
                <input type="text" value={formCategoria.nombre}
                  onChange={(e) => setFormCategoria({...formCategoria, nombre: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Descripcion</label>
                <textarea value={formCategoria.descripcion}
                  onChange={(e) => setFormCategoria({...formCategoria, descripcion: e.target.value})} rows="3" />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setModalCategoria(false)} className="btn-cancelar">Cancelar</button>
                <button type="submit" className="btn-guardar">Guardar</button>
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
              <h3>{usuarioEditando ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
              <button onClick={() => setModalUsuario(false)} className="btn-cerrar-modal">X</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); guardarUsuario(); }} className="form-modal">
              <div className="form-group">
                <label>Usuario *</label>
                <input type="text" value={formUsuario.username}
                  onChange={(e) => setFormUsuario({...formUsuario, username: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>{usuarioEditando ? 'Nueva Contrasena (dejar vacio para no cambiar)' : 'Contrasena *'}</label>
                <input type="password" value={formUsuario.password}
                  onChange={(e) => setFormUsuario({...formUsuario, password: e.target.value})}
                  required={!usuarioEditando} />
              </div>
              <div className="form-group">
                <label>Nombre Completo *</label>
                <input type="text" value={formUsuario.nombre_completo}
                  onChange={(e) => setFormUsuario({...formUsuario, nombre_completo: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={formUsuario.email}
                  onChange={(e) => setFormUsuario({...formUsuario, email: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Rol *</label>
                <select value={formUsuario.rol_id}
                  onChange={(e) => setFormUsuario({...formUsuario, rol_id: e.target.value})} required>
                  {roles.map(rol => (
                    <option key={rol.id} value={rol.id}>{rol.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setModalUsuario(false)} className="btn-cancelar">Cancelar</button>
                <button type="submit" className="btn-guardar">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Configuracion;