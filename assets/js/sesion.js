// Sesión: entrar con usuario y PIN, perfil de quien entró, salir y cambiar PIN.
(function(){
  'use strict';
  const db = window.db;
  const DOMINIO = '@aev2.app';
  const K_EQUIPO = 'ae_equipo';
  const K_USUARIO = 'ae_usuario';
  const EQUIPOS = { ventas: 'Ventas corporativas', aliados: 'Aliados comerciales' };
  const ROLES = { admin: 'Administrador', abogado: 'Legal', lider: 'Líder', analista: 'Analista', aliado: 'Aliado', gerencia: 'Gerencia' };
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
  const CAMPOS = ['id', 'usuario', 'nombre', 'rol', 'senior', 'canales', 'dedicados', 'gerencia', 'cargo', 'equipo', 'codigo_vendedor'];
  function firma(p){ return p ? JSON.stringify(CAMPOS.map((k) => p[k] === undefined ? null : p[k])) : ''; }
  function guardarPerfil(p){
    if(!p){ guardar(K_PERFIL, null); return; }
    const o = {}; CAMPOS.forEach((k) => { o[k] = p[k] === undefined ? null : p[k]; }); o.activo = true; o.debe_cambiar_pin = false;
    guardar(K_PERFIL, JSON.stringify(o));
  }
  function idSesionGuardada(){
    try {
      const k = Object.keys(localStorage).find((x) => /^sb-.+-auth-token$/.test(x)); if(!k) return null;
      const s = JSON.parse(localStorage.getItem(k) || 'null'); return s && s.user ? s.user.id : null;
    } catch (e) { return null; }
  }
  function perfilGuardado(roles){
    let p = null; try { p = JSON.parse(leer(K_PERFIL) || 'null'); } catch (e) { p = null; }
    if(!p || !p.id || !p.rol || p.id !== idSesionGuardada()) return null;
    if(roles ? roles.indexOf(p.rol) < 0 : p.rol === 'gerencia') return null;
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
      .select('id, usuario, nombre, rol, senior, canales, dedicados, gerencia, cargo, equipo, codigo_vendedor, activo, debe_cambiar_pin')
      .eq('id', s.user.id).maybeSingle();
    if(error) throw error;
    perfilActual = data || null;
    // Lote 7: la marca Gerencia es un rol de solo lectura (en la base, privado.rol_actual() dice lo mismo)
    if(perfilActual && perfilActual.gerencia) perfilActual.rol = 'gerencia';
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
    perfilActual = null; guardarPerfil(null); marcarActividad(true); guardar('ae_vencio', null);
    // Lo que quedó en pantalla de otra persona no se le muestra a quien entra
    if(window.Comun && window.Comun.cache) window.Comun.cache.borrarTodo();
    return data.session;
  }
  async function salir(){
    perfilActual = null; guardarPerfil(null);
    if(window.Comun && window.Comun.cache) window.Comun.cache.borrarTodo();
    // Se avisa al servidor, pero sin quedar esperando si tarda: la sesión del dispositivo se borra igual
    // Lote S: solo este equipo (el teléfono de la misma persona sigue con su sesión)
    const fuera = db ? db.auth.signOut({ scope: 'local' }).catch(() => {}) : Promise.resolve();
    await Promise.race([fuera, new Promise((ok) => setTimeout(ok, 1500))]);
    [window.localStorage, window.sessionStorage].forEach((m) => { try { Object.keys(m).filter((k) => /^sb-.+-auth-token$/.test(k)).forEach((k) => m.removeItem(k)); } catch (e) {} });
    guardar(K_ACT, null);
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

  // ---------- Lote S: sesión hasta N horas sin uso ----------
  // La última actividad (toque, tecla, volver a la app) se guarda en el dispositivo. Si pasó más que el ajuste, se sale.
  // Nunca se cierra con subidas o cargas en curso: cada módulo con cola registra su "ocupado" en AE_ocupado.
  const K_ACT = 'ae_actividad'; const K_HORAS = 'ae_inactividad_h'; let ultimaMarca = 0;
  const ocupados = [];
  // También cuenta como ocupado una hoja abierta con algo escrito sin guardar
  const escritoSinGuardar = () => Array.from(document.querySelectorAll('.hoja.ver input, .hoja.ver textarea')).some((x) =>
    x.type === 'checkbox' || x.type === 'radio' ? x.checked !== x.defaultChecked : x.type !== 'file' && x.type !== 'hidden' && x.value !== x.defaultValue);
  window.AE_ocupado = (fn) => { if(typeof fn === 'function'){ ocupados.push(fn); return false; } return escritoSinGuardar() || ocupados.some((f) => { try { return !!f(); } catch (e) { return false; } }); };
  function horasInactividad(){ const h = Number(leer(K_HORAS)); return h >= 1 && h <= 72 ? h : 12; }
  function guardarHoras(h){ h = Number(h); if(h >= 1 && h <= 72) guardar(K_HORAS, String(h)); }
  function marcarActividad(forzar){ const ahora = Date.now(); if(forzar || ahora - ultimaMarca > 60000){ ultimaMarca = ahora; guardar(K_ACT, String(ahora)); } }
  function vencida(){ const t = Number(leer(K_ACT)); return !!t && Date.now() - t > horasInactividad() * 3600e3; }
  // Destino para volver después del PIN: solo páginas propias
  const destinoValido = (d) => typeof d === 'string' && /^[a-z]+\.html(\?[^#]*)?$/.test(d) && d.indexOf('index.html') !== 0;
  function conDestino(pagina){
    const aqui = location.pathname.split('/').pop() + location.search;
    return destinoValido(aqui) ? pagina + '?ir=' + encodeURIComponent(aqui) : pagina;
  }
  function destino(){ const d = new URLSearchParams(location.search).get('ir'); return destinoValido(d) ? d : 'inicio.html'; }
  let cerrando = false;
  async function revisarInactividad(){
    if(cerrando || !idSesionGuardada()) return false;
    if(!vencida()){ marcarActividad(); return false; }
    if(window.AE_ocupado()){ marcarActividad(true); return false; }
    cerrando = true; await salir(); guardar('ae_vencio', '1'); location.replace(conDestino('index.html')); return true;
  }
  if(idSesionGuardada() && !leer(K_ACT)) marcarActividad(true);
  ['pointerdown', 'keydown'].forEach((t) => document.addEventListener(t, () => { revisarInactividad(); }, { capture: true, passive: true }));
  // Si la sesión venció, el toque que la descubrió no hace nada (no compite con la salida)
  document.addEventListener('click', (e) => { if(cerrando){ e.preventDefault(); e.stopPropagation(); } }, true);
  document.addEventListener('visibilitychange', () => { if(!document.hidden) revisarInactividad(); });
  setInterval(() => { if(vencida()) revisarInactividad(); }, 300000);

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
    if(!p || !p.activo){ await salir(); location.replace(conDestino('index.html')); return null; }
    if(p.debe_cambiar_pin){ location.replace('index.html#cambiar'); return null; }
    if(p.rol === 'gerencia' && !(roles && roles.indexOf('gerencia') >= 0)){ location.replace('gerencia.html'); return null; }
    if(roles && roles.indexOf(p.rol) < 0){ location.replace('inicio.html'); return null; }
    return p;
  }

  window.Sesion = { EQUIPOS, ROLES, equipoGuardado, guardarEquipo, usuarioGuardado, guardarUsuario,
    sesionActual, perfil, perfilGuardado, firma, entrar, salir, verificarPin, cambiarPin, pinFacil, puedeEntrar, requerir,
    horasInactividad, guardarHoras, destino, conDestino };
})();
