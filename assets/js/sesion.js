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

  // Perfil guardado en el dispositivo (rol y marcas, nunca el PIN) para dibujar la navegación al instante.
  // Solo vale si hay una sesión abierta del mismo usuario; el servidor sigue decidiendo los permisos.
  const K_PERFIL = 'ae_perfil';
  const CAMPOS = ['id', 'usuario', 'nombre', 'rol', 'senior', 'canales', 'dedicados', 'cargo', 'equipo', 'codigo_vendedor'];
  function firma(p){ return p ? JSON.stringify(CAMPOS.map((k) => p[k] === undefined ? null : p[k])) : ''; }
  function guardarPerfil(p){
    if(!p){ guardar(K_PERFIL, null); return; }
    const o = {}; CAMPOS.forEach((k) => { o[k] = p[k] === undefined ? null : p[k]; }); o.activo = true; o.debe_cambiar_pin = false;
    guardar(K_PERFIL, JSON.stringify(o));
  }
  function idSesionGuardada(){
    try {
      const k = Object.keys(sessionStorage).find((x) => /^sb-.+-auth-token$/.test(x)); if(!k) return null;
      const s = JSON.parse(sessionStorage.getItem(k) || 'null'); return s && s.user ? s.user.id : null;
    } catch (e) { return null; }
  }
  function perfilGuardado(roles){
    let p = null; try { p = JSON.parse(leer(K_PERFIL) || 'null'); } catch (e) { p = null; }
    if(!p || !p.id || !p.rol || p.id !== idSesionGuardada()) return null;
    if(roles && roles.indexOf(p.rol) < 0) return null;
    return p;
  }

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
      .select('id, usuario, nombre, rol, senior, canales, dedicados, cargo, equipo, codigo_vendedor, activo, debe_cambiar_pin')
      .eq('id', s.user.id).maybeSingle();
    if(error) throw error;
    perfilActual = data || null;
    guardarPerfil(perfilActual && perfilActual.activo && !perfilActual.debe_cambiar_pin ? perfilActual : null);
    return perfilActual;
  }
  // Entrada segura (lote 2, E): pasa por la función "entrar", que cuenta los intentos y bloquea.
  // Para volver a la entrada de antes: poner ENTRADA_SEGURA en false y publicar (ver claude/traspaso.md).
  const ENTRADA_SEGURA = true;
  async function porEntrada(cuerpo){
    let r;
    try { r = await db.functions.invoke('entrar', { body: cuerpo }); } catch (e) { r = { error: e }; }
    if(!r.error){ if(r.data && r.data.error) throw new Error(r.data.error); return r.data || {}; }
    const st = r.error.context && r.error.context.status; let j = null;
    try { j = await r.error.context.json(); } catch (e) {}
    const msj = (j && j.error) || '';
    if(st === 401) throw Object.assign(new Error('Invalid login credentials'), { status: 401, quedan: j ? j.quedan : null });
    if(st === 403) throw Object.assign(new Error('User is banned'), { status: 403 });
    if(st === 429) throw Object.assign(new Error(msj || 'Demasiados intentos. Espera unos minutos'), { status: 429 });
    if(st === 400 && msj) throw Object.assign(new Error(msj), { status: 400 });
    // La función no respondió (caída o sin publicar): se marca para usar la entrada de respaldo
    throw Object.assign(new Error(msj || 'No se pudo entrar. Intenta de nuevo'), { status: st || 0, caida: true });
  }
  async function entrarDirecto(usuario, pin){
    const { data, error } = await db.auth.signInWithPassword({ email: usuario + DOMINIO, password: pin });
    if(error) throw error;
    return data.session;
  }
  async function entrar(usuario, pin){
    let sesion = null;
    if(ENTRADA_SEGURA){
      try {
        const d = await porEntrada({ accion: 'entrar', usuario, pin });
        const { data, error } = await db.auth.setSession(d.session || {});
        if(error) throw error;
        sesion = data.session;
      } catch (e) {
        // Respaldo: si la función no responde, se intenta la entrada de antes (solo sirve a cuentas que no han pasado a la nueva)
        if(!e.caida) throw e;
        sesion = await entrarDirecto(usuario, pin);
      }
    } else sesion = await entrarDirecto(usuario, pin);
    const data = { session: sesion };
    perfilActual = null; guardarPerfil(null);
    // Lo que quedó en pantalla de otra persona no se le muestra a quien entra
    if(window.Comun && window.Comun.cache) window.Comun.cache.borrarTodo();
    return data.session;
  }
  async function salir(){
    perfilActual = null; guardarPerfil(null);
    if(window.Comun && window.Comun.cache) window.Comun.cache.borrarTodo();
    // Se avisa al servidor, pero sin quedar esperando si tarda: la sesión del dispositivo se borra igual
    const fuera = db ? db.auth.signOut().catch(() => {}) : Promise.resolve();
    await Promise.race([fuera, new Promise((ok) => setTimeout(ok, 1500))]);
    try { Object.keys(sessionStorage).filter((k) => /^sb-.+-auth-token$/.test(k)).forEach((k) => sessionStorage.removeItem(k)); } catch (e) {}
  }
  // Comprueba el PIN actual de quien ya entró (para el cambio voluntario)
  async function verificarPin(usuario, pin){
    if(ENTRADA_SEGURA){
      try { await porEntrada({ accion: 'verificar', usuario, pin }); return; }
      catch (e) { if(!e.caida) throw e; }
    }
    const { error } = await db.auth.signInWithPassword({ email: usuario + DOMINIO, password: pin });
    if(error) throw error;
  }
  async function cambiarPin(pin){
    let error = null;
    if(ENTRADA_SEGURA){
      try { await porEntrada({ accion: 'cambiar', pin_nuevo: pin }); }
      catch (e) { if(!e.caida) throw e; error = (await db.auth.updateUser({ password: pin })).error; }
    } else error = (await db.auth.updateUser({ password: pin })).error;
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
    sesionActual, perfil, perfilGuardado, firma, entrar, salir, verificarPin, cambiarPin, pinFacil, puedeEntrar, requerir };
})();
