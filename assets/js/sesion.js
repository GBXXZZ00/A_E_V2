// Sesión: entrar con usuario y PIN, perfil de quien entró, salir y cambiar PIN.
(function(){
  'use strict';
  const db = window.db;
  const DOMINIO = '@aev2.app';
  const K_EQUIPO = 'ae_equipo';
  const K_USUARIO = 'ae_usuario';
  const EQUIPOS = { ventas: 'Ventas corporativas', aliados: 'Aliados comerciales' };
  const ROLES = { admin: 'Administrador', abogado: 'Legal', lider: 'Líder', analista: 'Analista', aliado: 'Aliado' };
  let perfilActual = null;

  const leer = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const guardar = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };

  function equipoGuardado(){ const e = leer(K_EQUIPO); return EQUIPOS[e] ? e : null; }
  function guardarEquipo(e){ guardar(K_EQUIPO, EQUIPOS[e] ? e : null); }
  // En el dispositivo solo se recuerda usuario, nombre y cargo. El PIN nunca se guarda.
  function usuarioGuardado(){
    try { const u = JSON.parse(leer(K_USUARIO) || 'null'); return u && /^[a-z0-9]{3,30}$/.test(u.usuario || '') ? u : null; } catch (e) { return null; }
  }
  function guardarUsuario(p){ guardar(K_USUARIO, p ? JSON.stringify({ usuario: p.usuario, nombre: p.nombre, cargo: p.cargo || '' }) : null); }

  async function sesionActual(){
    if(!db) return null;
    const { data } = await db.auth.getSession();
    return data ? data.session : null;
  }
  async function perfil(forzar){
    if(perfilActual && !forzar) return perfilActual;
    const s = await sesionActual();
    if(!s) return null;
    const { data, error } = await db.from('perfiles')
      .select('id, usuario, nombre, rol, senior, cargo, equipo, codigo_vendedor, activo, debe_cambiar_pin')
      .eq('id', s.user.id).maybeSingle();
    if(error) throw error;
    perfilActual = data || null;
    return perfilActual;
  }
  async function entrar(usuario, pin){
    const { data, error } = await db.auth.signInWithPassword({ email: usuario + DOMINIO, password: pin });
    if(error) throw error;
    perfilActual = null;
    // Lo que quedó en pantalla de otra persona no se le muestra a quien entra
    if(window.Comun && window.Comun.cache) window.Comun.cache.borrarTodo();
    return data.session;
  }
  async function salir(){
    perfilActual = null;
    try { await db.auth.signOut(); } catch (e) {}
  }
  // Comprueba el PIN actual de quien ya entró (para el cambio voluntario)
  async function verificarPin(usuario, pin){
    const { error } = await db.auth.signInWithPassword({ email: usuario + DOMINIO, password: pin });
    if(error) throw error;
  }
  async function cambiarPin(pin){
    const { error } = await db.auth.updateUser({ password: pin });
    // Si el PIN ya quedó guardado en un intento anterior que se cortó, solo falta avisar al servidor
    const yaEstaba = error && /same|different/i.test(error.message || '') && perfilActual && perfilActual.debe_cambiar_pin;
    if(error && !yaEstaba) throw error;
    const r = await db.rpc('pin_cambiado');
    if(r.error) throw r.error;
    if(perfilActual) perfilActual.debe_cambiar_pin = false;
  }
  function pinFacil(pin){ return /^(\d)\1{5}$/.test(pin) || pin === '123456' || pin === '654321'; }
  function puedeEntrar(p, equipo){ return !!p && (p.equipo === 'ambos' || p.equipo === equipo); }

  // En los módulos: sin sesión válida se vuelve a la pantalla de acceso
  async function requerir(roles){
    let p = null;
    try { p = await perfil(); }
    catch (e) {
      // Un corte de internet no cierra la sesión: se avisa y se deja reintentar
      const main = document.querySelector('main');
      if(main) main.innerHTML = '<div class="aviso" role="alert"><b>Sin conexión</b><p>No pudimos cargar tus datos. Revisa tu internet.</p><p style="margin-top:16px"><button type="button" class="btn btn-chico" id="reintentarSesion">Reintentar</button></p></div>';
      const b = document.getElementById('reintentarSesion'); if(b) b.addEventListener('click', () => location.reload());
      return null;
    }
    if(!p || !p.activo){ await salir(); location.replace('index.html'); return null; }
    if(p.debe_cambiar_pin){ location.replace('index.html#cambiar'); return null; }
    if(roles && roles.indexOf(p.rol) < 0){ location.replace('inicio.html'); return null; }
    return p;
  }

  window.Sesion = { EQUIPOS, ROLES, equipoGuardado, guardarEquipo, usuarioGuardado, guardarUsuario,
    sesionActual, perfil, entrar, salir, verificarPin, cambiarPin, pinFacil, puedeEntrar, requerir };
})();
