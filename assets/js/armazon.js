// Armazón común de los módulos: barra de arriba, navegación y menú de cuenta.
(function(){
  'use strict';
  const { $, esc, ic, iniciales, fecha, abrirHoja, cerrarHoja, prepararHojas, cache, rpc, toast } = window.Comun;
  const S = window.Sesion;
  window.ACTUALIZAR_LISTO = true;   // la pantalla Actualizar ya existe

  const NAV = [
    { id: 'inicio', texto: 'Inicio', icono: 'casa', enlace: 'inicio.html' },
    { id: 'comisiones', texto: 'Comisiones', icono: 'barras', enlace: 'comisiones.html' },
    { id: 'trabajo', texto: 'Mi trabajo', icono: 'check', enlace: 'trabajo.html', roles: ['admin', 'analista', 'lider', 'abogado'], soloPc: true },
    { id: 'clientes', texto: 'Clientes', icono: 'edificio', enlace: 'clientes.html' },
    // En el teléfono entra solo si la barra de abajo no pasa de 5 botones (el administrador la abre desde Inicio)
    { id: 'migraciones', texto: 'Migraciones', icono: 'cambio', enlace: 'migraciones.html', roles: ['admin', 'analista', 'lider'], opcionalTel: true },
    { id: 'factibilidad', texto: 'Factibilidad', icono: 'wifi', enlace: 'factibilidad.html', roles: ['admin', 'analista', 'lider'] },
    { id: 'revision', texto: 'Revisión', icono: 'doc', enlace: 'revision.html', roles: ['admin', 'abogado'] },
    { id: 'aliados', texto: 'Aliados', icono: 'usuarios', enlace: 'aliados.html', roles: ['admin', 'analista', 'lider', 'abogado'], soloPc: true },
    { id: 'gerencia', texto: 'Gerencia', icono: 'barras', enlace: 'gerencia.html', roles: ['admin', 'analista', 'lider', 'abogado', 'gerencia'], soloPc: true }
  ];

  // Un módulo se ve por rol o, para un líder, por su marca (líder de dedicados)
  const puedeVer = (n, p) => p.rol === 'gerencia' ? n.id === 'gerencia' : !n.roles || n.roles.indexOf(p.rol) >= 0 || (n.marca && p.rol === 'lider' && !!p[n.marca]);
  // opciones: { activo: 'inicio'|'comisiones'|'clientes'|'factibilidad'|'revision'|'aliados'|null, sinNav: bool, volver: {enlace, texto}, acciones: html }
  let montado = null;   // { clave, res }: lo que ya está dibujado, para no repetirlo al confirmar la sesión
  function montar(p, opciones){
    const o = opciones || {};
    const clave = S.firma(p) + '|' + S.equipoGuardado() + '|' + JSON.stringify(o);
    if(montado && montado.clave === clave && $('barra').querySelector('.cuenta')) return montado.res;
    let equipo = S.equipoGuardado();
    if(!S.puedeEntrar(p, equipo)) equipo = p.equipo === 'ambos' ? 'ventas' : p.equipo;
    const conNav = !o.sinNav && equipo !== 'aliados' && p.rol !== 'aliado';
    const cargo = p.cargo || S.ROLES[p.rol] || '';
    const barra = $('barra');
    barra.innerHTML =
      (o.volver ? '<a class="barra-volver" href="' + esc(o.volver.enlace) + '">' + ic('volver', 'ch') + esc(o.volver.texto) + '</a>' : '') +
      '<a class="marca" href="inicio.html" aria-label="Inicio"><img class="logo" src="assets/img/logo.svg?v=5" alt="Airtek" width="96" height="12"><span>Empresas</span></a>' +
      (conNav ? '<nav class="navpc" aria-label="Navegación">' + NAV.filter((n) => puedeVer(n, p)).map((n) => '<a href="' + n.enlace + '" data-nav="' + n.id + '"' + (o.activo === n.id ? ' class="on" aria-current="page"' : '') + '>' + n.texto + '</a>').join('') + '</nav>' : '') +
      '<span class="sep"></span>' +
      (o.acciones ? '<div class="acciones-bar" id="accionesBar">' + o.acciones + '</div>' : '') +
      (p.rol !== 'gerencia' ? campanaHtml() : '') +
      '<button type="button" class="cuenta" id="cuenta" data-abre="hojaCuenta" aria-label="Mi cuenta">' +
        '<span class="tx"><b>' + esc(p.nombre) + '</b><small>' + esc(cargo) + '</small></span><span class="av" aria-hidden="true">' + esc(iniciales(p.nombre)) + '</span></button>';
    document.body.classList.toggle('modo-ficha', !!o.volver);

    if(conNav){
      document.body.classList.add('con-nav');
      let nav = $('navAbajo');
      if(!nav){ nav = document.createElement('nav'); nav.id = 'navAbajo'; nav.className = 'nav'; nav.setAttribute('aria-label', 'Navegación'); document.body.appendChild(nav); }
      let tel = NAV.filter((n) => puedeVer(n, p) && (!n.soloPc || p.rol === 'gerencia') && !(n.pcSalvoMarca && !(p.rol === 'lider' && p[n.marca])));
      if(tel.length > 5) tel = tel.filter((n) => !n.opcionalTel);
      nav.innerHTML = tel.map((n) => '<a href="' + n.enlace + '" data-nav="' + n.id + '"' + (o.activo === n.id ? ' class="on" aria-current="page"' : '') + '><span>' + ic(n.icono) + '</span>' + n.texto + '</a>').join('');
    }
    if(conNav) contadores(null, p);
    if(p.rol !== 'gerencia') avisosIniciar(p);
    sesionIniciar();

    let hoja = $('hojaCuenta');
    if(!hoja){
      hoja = document.createElement('section'); hoja.id = 'hojaCuenta'; hoja.className = 'hoja';
      hoja.setAttribute('role', 'dialog'); hoja.setAttribute('aria-modal', 'true'); hoja.setAttribute('aria-label', 'Mi cuenta'); hoja.setAttribute('aria-hidden', 'true');
      document.body.appendChild(hoja);
    }
    const ini = cache.leer('inicio') || {};
    const admin = p.rol === 'admin'; const sube = p.rol === 'admin' || p.rol === 'analista';
    hoja.innerHTML =
      '<div class="asa" aria-hidden="true"></div>' +
      '<div class="yo-cab"><span class="av" aria-hidden="true">' + esc(iniciales(p.nombre)) + '</span>' +
        '<span class="tx"><b id="dNombre">' + esc(p.nombre) + '</b><small id="dCargo">' + esc(cargo) + '</small></span>' +
        '<button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      '<div class="datos"><div class="dato-f"><span>Usuario</span><b id="dUsuario">' + esc(p.usuario) + '</b></div>' +
        '<div class="dato-f"><span>Equipo</span><b id="dEquipo">' + esc(S.EQUIPOS[equipo] || '') + '</b></div></div>' +
      (equipo !== 'aliados' && (admin || (sube && window.ACTUALIZAR_LISTO)) ? '<div class="rot">Administración</div>' : '') +
      (equipo !== 'aliados' && admin ? '<a class="op" href="usuarios.html" data-ir="usuarios"><span class="ic">' + ic('usuarios') + '</span><span class="tx">Usuarios<small id="dUsuarios">' +
        (ini.usuarios ? esc(ini.usuarios) + ' con acceso' : 'Cuentas, roles y PIN del equipo') + '</small></span>' + ic('derecha', 'ch') + '</a>' : '') +
      (equipo !== 'aliados' && sube && window.ACTUALIZAR_LISTO ? '<a class="op" href="actualizar.html" data-ir="actualizar"><span class="ic">' + ic('actualizar') + '</span><span class="tx">Actualizar datos<small id="dTad">' +
        (ini.tad_en ? 'Último TAD: ' + esc(fecha(ini.tad_en)) : 'Odoo, instalaciones y TAD') + '</small></span>' + ic('derecha', 'ch') + '</a>' : '') +
      (equipo !== 'aliados' && admin ? '<button type="button" class="op" data-inact="1"><span class="ic">' + ic('candado') + '</span><span class="tx">Cierre por falta de uso<small id="dInact">Después de ' + esc(S.horasInactividad()) + ' horas sin usar la app</small></span>' + ic('derecha', 'ch') + '</button>' : '') +
      (equipo !== 'aliados' && admin ? '<button type="button" class="op" data-ocr-aj="1"><span class="ic">' + ic('doc') + '</span><span class="tx">Lectura con OCR<small>Qué se lee sin IA</small></span>' + ic('derecha', 'ch') + '</button>' : '') +
      '<div class="rot">Mi cuenta</div>' +
      '<a class="op" href="index.html#cambiar" data-foco><span class="ic">' + ic('candado') + '</span><span class="tx">Cambiar PIN</span>' + ic('derecha', 'ch') + '</a>' +
      '<button type="button" class="op salir" id="salir"><span class="ic">' + ic('salir') + '</span><span class="tx">Salir</span></button>';
    prepararHojas();
    $('salir').addEventListener('click', async () => { cache.borrarTodo(); await S.salir(); location.replace('index.html'); });
    montado = { clave, res: { equipo, conNav } };
    return montado.res;
  }

  // Corrida 14/10 tarde: cada módulo del menú lleva su contador de pendientes (la misma fuente que Mi trabajo e Inicio).
  // Se guarda en el dispositivo y se pide de nuevo cada 2 minutos como máximo; si falla, el menú sigue sin número.
  const K_CONT = 'contadores_menu'; let pidiendo = false;
  function numerosNav(r){
    const m = (r && r.modulos) || {}; const n = (k) => (m[k] || {}).n || 0; const rj = (k) => (m[k] || {}).rojo || 0;
    return { trabajo: [r ? r.total || 0 : 0, r ? r.rojo || 0 : 0], clientes: [n('expedientes') + n('dedicados'), rj('expedientes') + rj('dedicados')],
      comisiones: [n('comisiones'), rj('comisiones')], migraciones: [n('migraciones'), rj('migraciones')], aliados: [n('aliados'), rj('aliados')] };
  }
  function pintarNumeros(r){
    const nums = numerosNav(r);
    Array.prototype.forEach.call(document.querySelectorAll('[data-nav]'), (a) => {
      let b = a.querySelector('.nbadge'); const x = nums[a.dataset.nav];
      const nom = a.dataset.nom || (a.dataset.nom = a.textContent.replace(/\d+\+?/g, '').trim());
      if(!x || !x[0]){ if(b) b.remove(); a.removeAttribute('aria-label'); return; }
      if(!b){ b = document.createElement('b'); b.className = 'nbadge'; (a.querySelector('span') || a).appendChild(b); }
      b.textContent = x[0] > 99 ? '99+' : String(x[0]); b.classList.toggle('rojo', x[1] > 0);
      b.setAttribute('aria-hidden', 'true'); a.setAttribute('aria-label', nom + ', ' + x[0] + ' pendientes' + (x[1] ? ', ' + x[1] + ' vencidos' : ''));
    });
  }
  // resumen: lo que ya trajo la página (Inicio); sin él, se usa lo guardado y se pide si está viejo
  async function contadores(resumen, p){
    const yo = p || {}; if(['admin', 'analista', 'lider'].indexOf(yo.rol) < 0) return;
    if(resumen){ cache.guardar(K_CONT, { uid: yo.id, en: Date.now(), r: resumen }); pintarNumeros(resumen); return; }
    const g = cache.leer(K_CONT); const mio = g && g.uid === yo.id ? g : null;
    if(mio) pintarNumeros(mio.r);
    if(/(?:inicio|trabajo)\.html$|\/$/.test(location.pathname)) return;   // estas páginas ya piden el resumen y lo pasan aquí
    if((mio && Date.now() - mio.en < 120000) || pidiendo || !navigator.onLine) return;
    pidiendo = true;
    try { const r = await rpc('trabajo_resumen', {}); if(r){ cache.guardar(K_CONT, { uid: yo.id, en: Date.now(), r }); pintarNumeros(r); } }
    catch (e) { /* el contador es de ayuda: si falla, la página sigue y su propia carga avisa del error */ }
    finally { pidiendo = false; }
  }


  // ---------- Lote 22/10: avisos (campana con contador, lista y avisos al teléfono) ----------
  // Cada aviso es una tarea de Mi trabajo o un hecho que te toca saber; al tocarlo abre la tarea exacta. Se apaga solo al resolverse.
  const K_AV = 'avisos_n'; let avYo = null; let avPidiendo = false; let avReloj = null;
  const SVG_CAMPANA = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
  const campanaHtml = () => '<button type="button" class="campana" id="campana" aria-label="Avisos">' + SVG_CAMPANA + '<b class="nbadge hidden" aria-hidden="true"></b></button>';
  function pintarCampana(n){
    const b = $('campana'); if(!b) return; const x = b.querySelector('.nbadge');
    x.classList.toggle('hidden', !n); x.textContent = n > 99 ? '99+' : String(n || '');
    b.setAttribute('aria-label', n ? 'Avisos, ' + n + ' sin leer' : 'Avisos');
  }
  async function contarAvisos(forzar){
    if(!avYo) return; const g = cache.leer(K_AV); const mio = g && g.uid === avYo.id ? g : null;
    if(mio) pintarCampana(mio.n);
    if(!forzar && ((mio && Date.now() - mio.en < 60000) || avPidiendo || !navigator.onLine)) return;
    avPidiendo = true;
    try { const n = await rpc('avisos_contar', {}); cache.guardar(K_AV, { uid: avYo.id, en: Date.now(), n }); pintarCampana(n); }
    catch (e) { /* la campana es de ayuda: si falla, la página sigue */ }
    finally { avPidiendo = false; }
  }
  async function pintarTarjetaAlertas(){
    const z = $('zonaAlertas'); if(!z || !avYo) return;
    // "Ahora no" la esconde en este equipo por 14 días (es una ayuda, no una tarea)
    let ya = 0; try { ya = Number(localStorage.getItem('ae_alertas_no')) || 0; } catch (e) {}
    let html = ''; if(Date.now() - ya > 14 * 86400e3){ try { html = await bloquePush(true); } catch (e) { html = ''; } }
    z.innerHTML = html ? '<div class="av-inicio">' + html.replace(/<\/div>$/, '<p class="av-no"><button type="button" class="enlace" data-av="ahoraNo">Ahora no</button></p></div>') + '</div>' : '';
  }
  function avisosIniciar(p){
    avYo = p; contarAvisos(); pintarTarjetaAlertas();
    clearInterval(avReloj); avReloj = setInterval(() => { if(!document.hidden) contarAvisos(); }, 120000);
  }
  const pushPosible = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && location.protocol === 'https:';
  const esIphone = () => /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches);
  async function suscripcionActual(){ try { const r = await navigator.serviceWorker.ready; return await r.pushManager.getSubscription(); } catch (e) { return null; } }
  const deB64u = (s) => { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
  // Lote A: la misma lógica sirve para la tarjeta "Activar alertas" de Inicio (enInicio), que no sale si ya están activas
  async function bloquePush(enInicio){
    if(esIphone()) return '<div class="al-banda azul av-push" role="note"><b>Avisos en este iPhone</b><p>Primero instala la app: en Safari toca Compartir y luego "Agregar a inicio". Ábrela desde ahí y activa los avisos aquí.</p></div>';
    if(!pushPosible()) return '';
    if(Notification.permission === 'denied') return '<div class="al-banda ambar av-push" role="note"><b>Los avisos están bloqueados en este equipo</b><p>Actívalos en los permisos del navegador para este sitio y ' + (enInicio ? 'vuelve a abrir la app' : 'vuelve a abrir esta lista') + '.</p></div>';
    const s = await suscripcionActual();
    if(s && Notification.permission === 'granted') return enInicio ? '' : '<p class="nota-chica av-push-ok">Este equipo recibe los avisos. No suenan de 10 p.m. a 8 a.m.<button type="button" class="enlace" data-av="quitarPush">Dejar de recibirlos aquí</button></p>';
    return '<div class="al-banda azul av-push" role="note"><b>Recibe los avisos en este equipo</b><p>Te llega al momento lo que te toca hacer, aunque la app esté cerrada: documentos por revisar, contratos, cambios, pagos. No suenan de 10 p.m. a 8 a.m.</p>' +
      '<p style="margin-top:10px"><button type="button" class="btn btn-chico" data-av="activar">' + (enInicio ? 'Activar alertas' : 'Activar avisos') + '</button></p><div class="error" role="alert"></div></div>';
  }
  async function activarPush(b){
    const caja = b.closest('.av-push'); const er = caja && caja.querySelector('.error'); if(er) er.textContent = ''; b.disabled = true;
    try {
      const clave = await rpc('push_clave_publica', {});
      if(!clave) throw new Error('Los avisos al teléfono todavía se están preparando. Intenta en unos minutos');
      const permiso = await Notification.requestPermission();
      if(permiso !== 'granted') throw new Error(permiso === 'denied' ? 'Bloqueaste los avisos. Actívalos en los permisos del navegador' : 'No diste el permiso. Toca Activar avisos otra vez');
      const reg = await navigator.serviceWorker.ready;
      const s = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: deB64u(clave) });
      const j = s.toJSON();
      await rpc('push_suscribir', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_agente: navigator.userAgent.slice(0, 200) });
      toast('Listo. Este equipo recibirá los avisos'); if($('hojaAvisos')) pintarAvisos(); pintarTarjetaAlertas();
    } catch (e) { if(er) er.textContent = e.message || 'No se pudo activar'; else toast(e.message, 'error'); b.disabled = false; }
  }
  async function quitarPush(){
    try { const s = await suscripcionActual(); if(s){ await rpc('push_quitar', { p_endpoint: s.endpoint }); await s.unsubscribe(); } toast('Este equipo ya no recibe avisos'); pintarAvisos(); pintarTarjetaAlertas(); }
    catch (e) { toast(e.message, 'error'); }
  }
  // Lote A: los avisos se agrupan por categoría (una fila por tipo con sin leer y total, plegable); el "Venció" va como marca roja
  let AV = null; const GR = {}; const abiertos = new Set();
  function hojaAvisos(){
    let h = $('hojaAvisos');
    if(!h){ h = document.createElement('section'); h.id = 'hojaAvisos'; h.className = 'hoja'; h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', 'tAvisos'); h.setAttribute('aria-hidden', 'true'); document.body.appendChild(h); prepararHojas(); }
    return h;
  }
  const hace = (t) => { const m = Math.max(0, Math.round((Date.now() - new Date(t).getTime()) / 60000)); return m < 1 ? 'Ahora' : m < 60 ? 'Hace ' + m + ' min' : m < 1440 ? 'Hace ' + Math.round(m / 60) + ' h' : fecha(t); };
  const filaAviso = (a) => '<button type="button" class="fila av-f' + (a.leido ? '' : ' nuevo') + '" data-aviso="' + esc(a.id) + '" data-tipo="' + esc(a.tipo) + '"><span class="pto ' + (a.leido ? 'gris' : 'azul') + '" aria-hidden="true"></span><span class="tx"><b>' + esc(a.titulo) + '</b><small>' + esc(a.texto || '') + '</small><small class="av-t">' +
    (a.vencido ? '<span class="av-venc">Venció</span>' : '') + esc(hace(a.en)) + '</small></span>' + ic('derecha', 'ch') + '</button>';
  function grupoHtml(g){
    const ab = abiertos.has(g.tipo); const l = GR[g.tipo];
    const cuerpo = !ab ? '' : !l ? '<div class="sk-bloque av-sk"><span class="sk" style="height:56px;border-radius:12px"></span><span class="sk" style="height:56px;border-radius:12px"></span></div>'
      : l.error ? '<div class="vacio" role="alert"><b>No se pudo cargar</b><p>' + esc(l.error) + '</p><button type="button" class="btn btn-chico" data-avg="' + esc(g.tipo) + '" data-reabrir="1">Reintentar</button></div>'
      : l.map(filaAviso).join('') + (g.sin_leer ? '<div class="av-g-pie"><button type="button" class="enlace" data-av-leer-g="' + esc(g.tipo) + '">Marcar leído este grupo</button></div>' : '');
    return '<div class="grupo av-lista' + (ab ? ' abierto' : '') + '"><button type="button" class="grupo-cab" data-avg="' + esc(g.tipo) + '" aria-expanded="' + ab + '"><span class="tx"><b>' + esc(g.nombre) + '</b><small>' +
      (g.sin_leer ? esc(g.sin_leer) + ' sin leer · ' : '') + esc(g.total) + (g.total === 1 ? ' aviso' : ' avisos') + (g.vencidos ? ' · <span class="mal">' + esc(g.vencidos) + (g.vencidos === 1 ? ' vencido' : ' vencidos') + '</span>' : '') + '</small></span>' +
      (g.sin_leer ? '<b class="nbadge">' + esc(g.sin_leer > 99 ? '99+' : g.sin_leer) + '</b>' : '') + ic('abajo') + '</button><div class="grupo-cuerpo">' + cuerpo + '</div></div>';
  }
  async function pintarAvisos(){
    const h = hojaAvisos(); const push = await bloquePush();
    let cuerpo;
    if(!AV) cuerpo = '<div class="sk-bloque"><span class="sk" style="height:60px;border-radius:16px"></span><span class="sk" style="height:60px;border-radius:16px"></span><span class="sk" style="height:60px;border-radius:16px"></span></div>';
    else if(AV.error) cuerpo = '<div class="vacio" role="alert"><b>No se pudieron cargar los avisos</b><p>' + esc(AV.error) + '</p><button type="button" class="btn btn-chico" data-av="reintentar">Reintentar</button></div>';
    else if(!(AV.grupos || []).length) cuerpo = '<div class="vacio"><b>No tienes avisos</b><p>Cuando algo te toque, aparece aquí y en Mi trabajo.</p></div>';
    else cuerpo = AV.grupos.map(grupoHtml).join('');
    h.innerHTML = '<div class="cab"><div><h2 id="tAvisos">Avisos</h2><p class="sub-hoja">' + (AV && AV.sin_leer ? esc(AV.sin_leer) + ' sin leer. Abre un grupo y toca un aviso para ir a la tarea.' : 'Abre un grupo y toca un aviso para ir a la tarea. Se apagan solos cuando se resuelven.') + '</p></div>' +
      '<button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div><div class="hoja-cuerpo">' + push + cuerpo + '</div>' +
      (AV && AV.sin_leer ? '<div class="hoja-pie"><button type="button" class="btn btn-2" data-av="leerTodo">Marcar todo leído</button></div>' : '');
  }
  const PIDE = {};   // número de la última petición por grupo: una respuesta vieja no pisa la nueva
  async function cargarGrupo(tipo){
    const n = (PIDE[tipo] || 0) + 1; PIDE[tipo] = n; GR[tipo] = null; pintarAvisos();
    let r; try { r = await rpc('avisos_grupo', { p_tipo: tipo, p_limite: 60 }); } catch (e) { r = { error: e.message }; }
    if(PIDE[tipo] !== n) return;
    GR[tipo] = r; pintarAvisos();
  }
  async function abrirAvisos(){
    AV = null; Object.keys(GR).forEach((k) => { delete GR[k]; PIDE[k] = (PIDE[k] || 0) + 1; }); pintarAvisos(); abrirHoja('hojaAvisos');
    try {
      AV = await rpc('avisos_mios', { p_limite: 5 }); pintarCampana(AV.sin_leer); cache.guardar(K_AV, { uid: avYo && avYo.id, en: Date.now(), n: AV.sin_leer });
      // Si hay un solo grupo, o el primero tiene sin leer, se abre solo
      abiertos.clear(); if(AV.grupos && AV.grupos[0] && (AV.grupos.length === 1 || AV.grupos[0].sin_leer)) abiertos.add(AV.grupos[0].tipo);
    } catch (e) { AV = { error: e.message }; }
    pintarAvisos();
    abiertos.forEach((t) => cargarGrupo(t));
  }
  function marcarLeidos(tipo, n){
    const g = AV && (AV.grupos || []).find((x) => x.tipo === tipo); if(!g) return;
    const k = Math.min(n, g.sin_leer); g.sin_leer -= k; AV.sin_leer = Math.max(0, AV.sin_leer - k);
    pintarCampana(AV.sin_leer); cache.guardar(K_AV, { uid: avYo && avYo.id, en: Date.now(), n: AV.sin_leer });
  }
  document.addEventListener('click', async (ev) => {
    const t = ev.target; let b;
    if(t.closest('#campana')){ abrirAvisos(); return; }
    if((b = t.closest('[data-avg]'))){
      const tipo = b.dataset.avg;
      if(b.dataset.reabrir){ cargarGrupo(tipo); return; }
      if(abiertos.has(tipo)){ abiertos.delete(tipo); pintarAvisos(); return; }
      abiertos.add(tipo); if(GR[tipo] && !GR[tipo].error) pintarAvisos(); else if(GR[tipo] !== null) cargarGrupo(tipo); else pintarAvisos();
      return;
    }
    if((b = t.closest('[data-aviso]'))){
      const l = GR[b.dataset.tipo] || []; const a = Array.isArray(l) && l.find((x) => String(x.id) === b.dataset.aviso); if(!a) return;
      try { if(!a.leido){ await rpc('avisos_leer', { p_ids: a.ids || [a.id] }); a.leido = true; marcarLeidos(a.tipo, 1); } } catch (e) {}
      cache.guardar(K_AV, { uid: avYo && avYo.id, en: 0, n: 0 });
      if(a.enlace && /^[a-z]+\.html(\?.*)?$/.test(a.enlace)) location.href = a.enlace; else cerrarHoja();
      return;
    }
    if((b = t.closest('[data-av-leer-g]'))){
      const tipo = b.dataset.avLeerG; b.disabled = true;
      try { await rpc('avisos_leer_grupo', { p_tipo: tipo }); const l = GR[tipo]; const n = Array.isArray(l) ? l.filter((a) => !a.leido).length : 0; if(Array.isArray(l)) l.forEach((a) => { a.leido = true; });
        const g = (AV.grupos || []).find((x) => x.tipo === tipo); marcarLeidos(tipo, g ? g.sin_leer : n); pintarAvisos(); }
      catch (e) { toast(e.message, 'error'); b.disabled = false; }
      return;
    }
    if((b = t.closest('[data-av]'))){
      const x = b.dataset.av;
      if(x === 'reintentar') abrirAvisos();
      else if(x === 'ahoraNo'){ try { localStorage.setItem('ae_alertas_no', String(Date.now())); } catch (e) {} pintarTarjetaAlertas(); }
      else if(x === 'activar') activarPush(b);
      else if(x === 'quitarPush') quitarPush();
      else if(x === 'leerTodo'){ b.disabled = true; try { await rpc('avisos_leer', { p_ids: null }); Object.values(GR).forEach((l) => { if(Array.isArray(l)) l.forEach((a) => { a.leido = true; }); }); (AV.grupos || []).forEach((g) => { g.sin_leer = 0; }); AV.sin_leer = 0; pintarCampana(0); cache.guardar(K_AV, { uid: avYo && avYo.id, en: Date.now(), n: 0 }); pintarAvisos(); } catch (e) { toast(e.message, 'error'); b.disabled = false; } }
    }
  });
  document.addEventListener('visibilitychange', () => { if(!document.hidden && avYo) contarAvisos(); });

  // ---------- Lote S: la sesión sigue viva (no la cerró el administrador) y horas sin uso ----------
  let sesReloj = null; let sesPidiendo = false;
  async function revisarSesion(){
    if(sesPidiendo || !navigator.onLine) return; sesPidiendo = true;
    try {
      const r = await rpc('sesion_viva', {});
      if(r && r.horas) S.guardarHoras(r.horas);
      if(r && r.viva === false){ await S.salir(); try { localStorage.setItem('ae_vencio', 'cerrada'); } catch (e) {} location.replace('index.html'); }
    } catch (e) { /* sin red o error del servidor: no se cierra nada */ }
    finally { sesPidiendo = false; }
  }
  function sesionIniciar(){
    revisarSesion();
    clearInterval(sesReloj); sesReloj = setInterval(() => { if(!document.hidden) revisarSesion(); }, 120000);
  }
  document.addEventListener('visibilitychange', () => { if(!document.hidden && sesReloj) revisarSesion(); });
  function abrirInact(){
    let h = $('hojaInact');
    if(!h){ h = document.createElement('section'); h.id = 'hojaInact'; h.className = 'hoja'; h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', 'tInact'); h.setAttribute('aria-hidden', 'true'); document.body.appendChild(h); prepararHojas(); }
    h.innerHTML = '<div class="cab"><div><h2 id="tInact">Cierre por falta de uso</h2><p class="sub-hoja">Si nadie toca la app en ese tiempo, pide el PIN otra vez. Vale para todos; cada equipo lo toma la próxima vez que abra la app.</p></div><button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      '<div><label class="rotulo" for="inactHoras">Horas sin uso (de 1 a 72)</label><input class="campo" id="inactHoras" type="number" inputmode="numeric" min="1" max="72" step="1" value="' + esc(S.horasInactividad()) + '"><div class="error" id="eInact" role="alert"></div></div>' +
      '<div class="hoja-pie"><button type="button" class="btn" data-inact-guardar="1">Guardar</button></div>';
    abrirHoja('hojaInact');
  }
  document.addEventListener('click', async (ev) => {
    const t = ev.target; let b;
    if(t.closest('[data-inact]')){ abrirInact(); return; }
    if((b = t.closest('[data-inact-guardar]'))){
      const n = Number($('inactHoras').value); const er = $('eInact'); er.textContent = '';
      if(!Number.isInteger(n) || n < 1 || n > 72){ er.textContent = 'Escribe un número entero entre 1 y 72'; return; }
      b.disabled = true;
      try { const r = await rpc('inactividad_guardar', { p_horas: n }); S.guardarHoras(r.horas); const d = $('dInact'); if(d) d.textContent = 'Después de ' + r.horas + ' horas sin usar la app'; toast('Listo. La app pide el PIN tras ' + r.horas + ' horas sin uso'); cerrarHoja(); }
      catch (e) { er.textContent = e.message || 'No se pudo guardar'; }
      finally { b.disabled = false; }
    }
  });

  // Corrida 14/10 tarde: ajustes del OCR (solo el administrador). Arrancan en NO; con NO todo sigue como antes (la IA)
  const AJ_OCR = [['aliados', 'Usar OCR en aliados', 'El RIF de una solicitud se lee con OCR; si es dudoso, con la IA'],
    ['revision', 'Usar OCR en la revisión', 'RIF y cédulas claros no van a la IA; combinados, actas y dudosos sí'],
    ['expediente', 'Llenar datos del expediente con OCR', 'Al subir el RIF propone razón social y domicilio para confirmar']];
  async function abrirAjOcr(){
    let h = $('hojaOcrAj');
    if(!h){ h = document.createElement('section'); h.id = 'hojaOcrAj'; h.className = 'hoja'; h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', 'tOcrAj'); h.setAttribute('aria-hidden', 'true'); document.body.appendChild(h); prepararHojas(); }
    const pinta = (v, err) => { h.innerHTML = '<div class="cab"><div><h2 id="tOcrAj">Lectura con OCR</h2><p class="sub-hoja">Google Drive lee el texto gratis; la IA queda para lo que hay que entender.</p></div><button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      (err ? '<div class="vacio" role="alert"><b>No se pudieron leer los ajustes</b><p>' + esc(err) + '</p><button type="button" class="btn btn-chico" data-ocr-aj="1">Reintentar</button></div>'
        : !v ? '<div class="sk-bloque"><span class="sk" style="height:60px;border-radius:16px"></span><span class="sk" style="height:60px;border-radius:16px"></span><span class="sk" style="height:60px;border-radius:16px"></span></div>'
        : AJ_OCR.map((x) => '<div class="interr"><span class="tx">' + esc(x[1]) + '<small>' + esc(x[2]) + '</small></span><button type="button" class="sw" role="switch" data-ocr-sw="' + x[0] + '" aria-checked="' + !!v[x[0]] + '" aria-label="' + esc(x[1]) + '"></button></div>').join('') +
          '<p class="nota-chica">Si el OCR falla o lee algo dudoso, siempre sigue la IA. Cada cambio queda en la bitácora.</p>'); };
    pinta(null); abrirHoja('hojaOcrAj');
    try { pinta(await rpc('ocr_ajustes', {})); } catch (e) { pinta(null, e.message); }
  }
  document.addEventListener('click', async (ev) => {
    const t = ev.target; let b;
    if(t.closest('[data-ocr-aj]')){ abrirAjOcr(); return; }
    if((b = t.closest('[data-ocr-sw]'))){
      if(b.disabled) return; const si = b.getAttribute('aria-checked') !== 'true'; b.disabled = true;
      try { const v = await rpc('ocr_ajuste_guardar', { p_clave: b.dataset.ocrSw, p_si: si }); b.setAttribute('aria-checked', String(!!v[b.dataset.ocrSw])); toast(si ? 'Prendido' : 'Apagado'); }
      catch (e) { toast(e.message, 'error'); }
      finally { b.disabled = false; }
    }
  });

  // Opciones de cada página, para dibujar la navegación antes de que responda el servidor
  function opcionesPagina(){
    const pag = (location.pathname.split('/').pop() || '').replace('.html', '');
    if(pag === 'usuarios' || pag === 'actualizar') return { activo: null, volver: { enlace: 'inicio.html', texto: 'Inicio' } };
    if(NAV.some((n) => n.id === pag)) return { activo: pag };
    return null;
  }
  // Con el perfil guardado se dibuja todo al instante; S.requerir() confirma después y montar() corrige si algo cambió.
  // Devuelve ese perfil si sirve para esta página (para pintar lo último visto mientras llega lo nuevo).
  function temprano(roles){
    const o = opcionesPagina(); if(!o) return null;
    // Nunca en blanco: mientras corre el módulo, la lista muestra su esqueleto
    const l = $('lista'); if(l && !l.innerHTML.trim()) l.innerHTML = window.Comun.esqueleto(6);
    const z = $('zonaCorte'); if(z && !z.innerHTML.trim()) z.innerHTML = '<div class="sk" style="height:92px;border-radius:22px;margin-top:18px"></div>';
    const p = S.perfilGuardado(roles); if(!p) return null;
    try { montar(p, o); } catch (e) { return null; }
    return p;
  }
  temprano();

  // Arranque de un módulo: con perfil guardado, iniciar() corre al instante (lista con lo último visto);
  // si no, espera a S.requerir(). Si el servidor dice algo distinto del perfil guardado, se recarga con el bueno.
  async function arrancar(roles, o, iniciar, alConfirmar){
    const pre = temprano(roles);
    if(pre){ montar(pre, o); iniciar(pre); }
    const p = await S.requerir(roles);
    if(!p) return null;
    if(pre && S.firma(pre) !== S.firma(p)){ location.reload(); return null; }
    montar(p, o);
    if(!pre) iniciar(p); else if(alConfirmar) alConfirmar(p);
    return p;
  }

  // Actualiza los textos del menú cuando llegan los datos de Inicio
  function datosMenu(ini){
    if(!ini) return;
    const u = $('dUsuarios'); if(u && ini.usuarios) u.textContent = ini.usuarios + ' con acceso';
    const t = $('dTad'); if(t) t.textContent = ini.tad_en ? 'Último TAD: ' + fecha(ini.tad_en) : 'Odoo, instalaciones y TAD';
  }

  window.Armazon = { montar, temprano, arrancar, datosMenu, contadores, cerrarCuenta: cerrarHoja, abrirCuenta: () => abrirHoja('hojaCuenta') };
})();
