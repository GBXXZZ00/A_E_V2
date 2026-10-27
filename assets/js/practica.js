// Corrida 23/10: modo práctica. Con el modo encendido, la app no habla con el servidor: todo lo responde un mundo de mentira
// que corre en este navegador (el mismo de las pruebas, en assets/js/practica-mundo.js) y se guarda en este dispositivo.
// Así nada de lo que se haga en práctica puede tocar datos reales. Se entra con una cuenta de práctica (pruebalider, pruebaadmin...) o desde el menú de la cuenta.
// Este archivo va en todas las páginas ANTES de supabase-client.js: la librería toma fetch al crear el cliente.
(function(){
  'use strict';
  var K = 'ae_practica'; var KE = 'ae_practica_estado'; var KS = 'sb-tgjcwgvaybidcawkqksm-auth-token';
  var SERVIDOR = /^https:\/\/[a-z0-9]+\.supabase\.co\//i;
  var V = ((document.currentScript && document.currentScript.src.match(/[?&]v=(\d+)/)) || [])[1] || '1';
  var real = window.fetch.bind(window);
  var guarda = null; try { guarda = window.localStorage; } catch (e) { guarda = null; }
  var leer = function(k){ try { return guarda ? guarda.getItem(k) : null; } catch (e) { return null; } };
  var poner = function(k, v){ try { if(guarda) v === null ? guarda.removeItem(k) : guarda.setItem(k, v); } catch (e) {} };
  var activo = function(){ return leer(K) === '1'; };

  // Cuentas de práctica: PIN temporal y cambio obligatorio al entrar. Los nombres y datos son inventados.
  var PIN = '583014';
  var PERSONAS = [
    { id: '11111111-1111-4111-8111-111111111111', usuario: 'pruebaadmin', nombre: 'Marcos Rivas', rol: 'admin', cargo: 'Administrador de contratos', equipo: 'ambos', codigo_vendedor: 1 },
    { id: '22222222-2222-4222-8222-222222222222', usuario: 'pruebalider', nombre: 'Lucía Ferrer', rol: 'lider', cargo: 'Líder de ventas', equipo: 'ventas', nombre_odoo: 'Lucía Ferrer', whatsapp: '584140000001' },
    { id: '33333333-3333-4333-8333-333333333333', usuario: 'pruebaanalista', nombre: 'Pedro Salas', rol: 'analista', cargo: 'Analista de canales', equipo: 'ventas', codigo_vendedor: 5, nombre_odoo: 'Pedro Salas' },
    { id: '77777777-7777-4777-8777-777777777777', usuario: 'pruebaabogado', nombre: 'Sara Ibáñez', rol: 'abogado', cargo: 'Abogada', equipo: 'ambos' },
    { id: '88888888-8888-4888-8888-888888888888', usuario: 'pruebaaliado', nombre: 'Redes Norte Ejemplo', rol: 'aliado', cargo: 'Aliado comercial', equipo: 'aliados' },
    { id: '77777777-7777-4777-8777-777777777700', usuario: 'pruebagerencia', nombre: 'Gina Paredes', rol: 'abogado', gerencia: true, cargo: 'Gerente', equipo: 'ambos' },
    { id: '99999999-9999-4999-8999-999999999999', usuario: 'pruebacanales', nombre: 'Carla Canales', rol: 'analista', canales: true, cargo: 'Coordinación de canales', equipo: 'ambos' }
  ].map(function(p){ return Object.assign({ pin: PIN, activo: true, debe_cambiar_pin: true, codigo_vendedor: null, nombre_odoo: null, whatsapp: null, correo: null }, p); });
  var DE_ROL = { admin: 'pruebaadmin', lider: 'pruebalider', analista: 'pruebaanalista', abogado: 'pruebaabogado', aliado: 'pruebaaliado', gerencia: 'pruebagerencia' };

  // ---------- El mundo ----------
  var W = null; var M = null; var cargando = null; var tGuardar = 0;
  function cargarMundo(){
    if(cargando) return cargando;
    cargando = new Promise(function(ok, mal){
      var s = document.createElement('script'); s.src = 'assets/js/practica-mundo.js?v=' + V; s.onload = ok;
      s.onerror = function(){ cargando = null; mal(new Error('No se pudo abrir el modo práctica. Revisa tu internet')); };
      document.head.appendChild(s);
    }).then(armar);
    return cargando;
  }
  function armar(){
    W = window.PracticaMundo; var g = null; try { g = JSON.parse(leer(KE) || 'null'); } catch (e) { g = null; }
    M = { llamadas: [], personas: g && g.personas ? g.personas : PERSONAS.map(function(p){ return Object.assign({}, p); }), datos: g && g.datos ? g.datos : W.mundo.baseDatos() };
    W.mundo.usar(M);
    var aliado = M.personas.find(function(p){ return p.rol === 'aliado'; }); var canales = M.personas.find(function(p){ return p.canales; });
    W.aliados.mundoAliados(M, aliado, canales);
    if(g && g.al) Object.assign(M.al, g.al);
    else {
      // El aliado de práctica pide un cliente del líder de práctica (caso de la guía)
      M.al.sols.forEach(function(s){ s.cliente = String(s.cliente || '').replace(/<[^>]*>/g, '').trim(); });
      if(!g) bienvenida();
    }
    return M;
  }
  function guardar(){
    clearTimeout(tGuardar);
    tGuardar = setTimeout(function(){ if(M) poner(KE, JSON.stringify({ personas: M.personas, datos: M.datos, al: M.al })); }, 250);
  }
  var hace = function(min){ return new Date(Date.now() - min * 60000).toISOString(); };
  function aviso(para, tipo, titulo, texto, enlace){
    var a = M.datos.avisos = M.datos.avisos || []; var id = a.reduce(function(n, x){ return Math.max(n, Number(x.id) || 0); }, 0) + 1;
    a.unshift({ id: id, tipo: tipo, titulo: titulo, texto: texto, enlace: enlace || 'inicio.html', en: new Date().toISOString(), leido: false, para: para });
  }
  function bienvenida(){
    M.personas.forEach(function(p){ aviso(p.usuario, 'cliente', 'Bienvenido a la práctica', 'Todo lo que veas aquí es inventado. Toca "Guía" arriba para saber qué probar.', 'inicio.html'); });
  }

  // ---------- Respuestas como las del servidor ----------
  var b64 = function(o){ return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  var ahora = function(){ return Math.floor(Date.now() / 1000); };
  var jwt = function(id){ return b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: id, exp: ahora() + 86400, role: 'authenticated', aud: 'authenticated', practica: true }) + '.practica'; };
  function sesionDe(p){
    return { access_token: jwt(p.id), token_type: 'bearer', expires_in: 86400, expires_at: ahora() + 86400, refresh_token: 'practica-' + p.id,
      user: { id: p.id, aud: 'authenticated', role: 'authenticated', email: p.usuario + '@aev2.app', user_metadata: {} } };
  }
  function cabecera(h, n){ if(!h) return ''; if(typeof h.get === 'function') return h.get(n) || ''; var k = Object.keys(h).find(function(x){ return x.toLowerCase() === n; }); return k ? h[k] : ''; }
  function quien(h){
    try { var t = String(cabecera(h, 'authorization')).split(' ')[1]; var s = JSON.parse(decodeURIComponent(escape(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))))).sub;
      return M.personas.find(function(p){ return p.id === s; }) || null; } catch (e) { return null; }
  }
  var json = function(x, st){ return new Response(x === undefined ? 'null' : JSON.stringify(x), { status: st || 200, headers: { 'content-type': 'application/json', 'content-range': '0-0/*' } }); };
  var PDF = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF';
  var PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  function cuerpo(b){ if(typeof b === 'string'){ try { return JSON.parse(b || '{}'); } catch (e) { return {}; } } return {}; }
  function campo(b, n){ try { return b && typeof b.get === 'function' ? String(b.get(n) || '') : ''; } catch (e) { return ''; } }
  function archivoDe(b){ try { var f = b && typeof b.get === 'function' ? b.get('archivo') : null; return f ? { tipo: f.type || '', tam: f.size || 0 } : { tipo: '', tam: 0 }; } catch (e) { return { tipo: '', tam: 0 }; } }

  async function responder(url, init){
    await cargarMundo(); W.mundo.usar(M);
    var u = decodeURIComponent(url); var h = init.headers; var met = String(init.method || 'GET').toUpperCase(); var b = cuerpo(init.body);
    await new Promise(function(ok){ setTimeout(ok, 60); });
    if(u.indexOf('/functions/v1/entrar') >= 0){
      if(b.accion === 'cambiar'){
        var yo0 = quien(h); if(!yo0) return json({ error: 'Tu sesión venció. Entra de nuevo' }, 401);
        if(!/^\d{6}$/.test(b.pin_nuevo || '') || /^(\d)\1{5}$/.test(b.pin_nuevo) || b.pin_nuevo === '123456' || b.pin_nuevo === '654321' || b.pin_nuevo === PIN) return json({ error: 'El PIN debe tener 6 números, no ser uno fácil de adivinar y no ser el temporal' }, 400);
        yo0.pin = b.pin_nuevo; yo0.debe_cambiar_pin = false; guardar(); return json({ ok: true });
      }
      var p = M.personas.find(function(x){ return x.usuario === b.usuario; });
      if(!p || p.pin !== b.pin) return json({ error: 'Usuario o PIN incorrecto. En práctica, pide el PIN temporal al administrador' }, 401);
      if(b.accion === 'verificar') return json({ ok: true });
      var s = sesionDe(p); return json({ session: { access_token: s.access_token, refresh_token: s.refresh_token } });
    }
    if(u.indexOf('/auth/v1/token') >= 0){
      var r = cuerpo(init.body); var pp = r.refresh_token ? M.personas.find(function(x){ return 'practica-' + x.id === r.refresh_token; }) : M.personas.find(function(x){ return x.usuario + '@aev2.app' === r.email && x.pin === r.password; });
      return pp ? json(sesionDe(pp)) : json({ code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400);
    }
    if(u.indexOf('/auth/v1/logout') >= 0) return new Response(null, { status: 204 });
    if(u.indexOf('/auth/v1/user') >= 0){
      var yo1 = quien(h); if(!yo1) return json({ msg: 'no' }, 401);
      if(met === 'PUT'){ yo1.pin = b.password; guardar(); }
      return json(sesionDe(yo1).user);
    }
    if(u.indexOf('/rest/v1/rpc/pin_cambiado') >= 0){ var yo2 = quien(h); if(yo2){ yo2.debe_cambiar_pin = false; guardar(); } return json(null); }
    var rp = u.match(/\/rest\/v1\/rpc\/([a-z0-9_]+)/);
    if(rp){
      var yo = quien(h); if(!yo || !yo.activo) return json({ code: 'P0001', message: 'Tu sesión venció. Entra de nuevo' }, 400);
      var f = W.mundo.RPC[rp[1]];
      if(!f) return json({ code: 'P0001', message: 'Esto no está en el modo práctica todavía. Pruébalo con tu cuenta normal' }, 400);
      var res = f(M, yo, b); if(M.llamadas.length > 200) M.llamadas.splice(0, 100);
      if(res && res.__error) return json(res.__error, 400);
      if(rp[1] === 'solicitud_enviar') pedidoDeAliado(b.p_sol);
      guardar(); return json(res);
    }
    if(u.indexOf('/rest/v1/perfiles') >= 0){
      var yo3 = quien(h); if(!yo3) return json([]); var fila = Object.assign({}, yo3); delete fila.pin;
      return /vnd\.pgrst\.object/.test(cabecera(h, 'accept')) ? json(fila) : json([fila]);
    }
    if(u.indexOf('/functions/v1/drive_subir') >= 0){
      var yo4 = quien(h); if(!yo4) return json({ error: 'Tu sesión venció. Entra de nuevo' }, 401);
      var a = archivoDe(init.body); var r2 = W.mundo.driveSubir(M, yo4, campo(init.body, 'cliente'), campo(init.body, 'nombre'), a.tipo, a.tam);
      guardar(); return r2.error ? json({ error: r2.error }, r2.status) : json(r2);
    }
    if(u.indexOf('/functions/v1/drive_archivo') >= 0){
      var yo5 = quien(h); if(!yo5) return json({ error: 'Tu sesión venció. Entra de nuevo' }, 401);
      var r3 = W.mundo.archivoDrive(M, yo5, b.archivo); if(r3.error) return json({ error: r3.error }, r3.status);
      if(b.vista === 'mini' || /^image\//.test(r3.archivo.mime)) return new Response(Uint8Array.from(atob(PNG), function(c){ return c.charCodeAt(0); }), { status: 200, headers: { 'content-type': 'image/png' } });
      return new Response(PDF, { status: 200, headers: { 'content-type': 'application/pdf' } });
    }
    if(u.indexOf('/functions/v1/aliado_rif') >= 0) return rifAliado(init.body);
    if(u.indexOf('/functions/v1/ocr_leer') >= 0) return json({ estado: 'sin_lectura', error: 'En práctica no se lee el archivo' });
    if(u.indexOf('/functions/v1/') >= 0) return json({ error: 'Esto no está en el modo práctica todavía' }, 400);
    if(u.indexOf('/storage/v1/') >= 0) return json({ error: 'cerrado' }, 403);
    return json([]);
  }
  // El aliado sube el RIF: en práctica siempre sale un cliente del líder de práctica, para ver el aviso de "pidió tu cliente"
  function rifAliado(body){
    var sid = Number(campo(body, 'solicitud')); var s = M.al.sols.find(function(x){ return x.id === sid; });
    var lider = M.personas.find(function(p){ return p.usuario === 'pruebalider'; });
    var c = M.datos.clientes.find(function(x){ return x.lider_id === lider.id; });
    if(!s || !c) return json({ estado: 'ilegible' });
    s.cliente_id = c.id; s.cliente = c.nombre; s.rif = c.rif || 'J000000011'; guardar();
    return json({ estado: 'libre', cliente: c.id, nombre: c.nombre, rif: s.rif });
  }
  function pedidoDeAliado(id){
    var s = M.al.sols.find(function(x){ return x.id === Number(id); }); if(!s) return;
    var c = M.datos.clientes.find(function(x){ return x.id === s.cliente_id; }); if(!c) return;
    var d = M.personas.find(function(p){ return p.id === c.lider_id; });
    if(d) aviso(d.usuario, 'cliente', 'Un aliado pidió tu cliente', (s.aliado || 'Un aliado') + ' pidió instalar a ' + c.nombre + '. Revisa la solicitud con el administrador.', 'clientes.html?c=' + c.id);
    M.personas.filter(function(p){ return p.rol === 'admin' || p.gerencia; }).forEach(function(p){ aviso(p.usuario, 'cliente', 'Solicitud de aliado', (s.aliado || 'Un aliado') + ' pidió a ' + c.nombre + '.', p.gerencia ? 'gerencia.html' : 'aliados.html'); });
  }

  // Todo pedido al servidor pasa por aquí: con el modo encendido nunca sale a internet
  window.fetch = function(entrada, init){
    var url = typeof entrada === 'string' ? entrada : entrada && entrada.url ? entrada.url : String(entrada);
    if(!SERVIDOR.test(url)) return real(entrada, init);
    var o = init || {};
    if(!activo()){
      // Una cuenta de práctica enciende el modo práctica al entrar (en la pantalla de acceso no hay sesión real que perder)
      if(url.indexOf('/functions/v1/entrar') >= 0 && /"usuario":"prueba(admin|lider|analista|abogado|aliado|gerencia|canales)"/.test(typeof o.body === 'string' ? o.body : '')){ limpiarCache(); poner(K, '1'); }
      else return real(entrada, init);
    }
    return responder(url, o).catch(function(e){ return json({ code: 'P0001', message: e.message || 'No se pudo abrir el modo práctica' }, 503); });
  };

  // ---------- Entrar y salir ----------
  function limpiarCache(){
    try { if(guarda) Object.keys(guarda).filter(function(k){ return k === KS || k.indexOf('ae_c_') === 0 || k === 'ae_perfil' || k.indexOf('ae_cache') === 0; }).forEach(function(k){ guarda.removeItem(k); }); } catch (e) {}
    try { Object.keys(window.sessionStorage).filter(function(k){ return k.indexOf('ae_') === 0; }).forEach(function(k){ window.sessionStorage.removeItem(k); }); } catch (e) {}
  }
  // Desde una cuenta normal: entra como la persona de práctica de su mismo rol, sin PIN
  async function entrar(rol){
    limpiarCache(); poner(K, '1'); await cargarMundo();
    var p = M.personas.find(function(x){ return x.usuario === (DE_ROL[rol] || 'pruebalider'); });
    p.debe_cambiar_pin = false; guardar();
    poner(KS, JSON.stringify(sesionDe(p))); poner('ae_actividad', String(Date.now()));
    setTimeout(function(){ location.href = 'inicio.html'; }, 300);
  }
  function salir(){ limpiarCache(); poner(K, null); location.href = 'index.html'; }
  function reiniciar(){ poner(KE, null); M = null; cargando = null; location.reload(); }

  // ---------- Banda, guía y avisos de práctica ----------
  var GUIA = {
    admin: ['Abre Clientes y entra a un expediente con documentos en revisión: apruébalos o devuélvelos con un motivo.', 'Abre el Panel: toca un módulo, cambia a "Año contra año" y toca una barra para filtrar la lista.', 'En Aliados, revisa la solicitud que envió el aliado de práctica.', 'Con "Avisos de práctica" (arriba) manda un aviso a un rol y entra con esa cuenta para verlo en la campana.'],
    lider: ['Mira la campana: ahí llegan los avisos (por ejemplo, cuando un aliado pide tu cliente).', 'Abre Clientes, entra a un expediente y sube un documento que falte.', 'Usa "Contactar" en la ficha para ver el mensaje ya escrito.', 'Abre el Panel: ves solo lo tuyo.'],
    analista: ['Abre Comisiones y revisa una instalación del corte.', 'Abre Migraciones y sigue un cambio por los pasos.', 'Abre el Panel y filtra por líder.'],
    abogado: ['Abre Revisión y revisa los documentos de un cliente.', 'Abre un contrato por firmar desde la ficha.'],
    aliado: ['Crea una solicitud nueva y sube el RIF: en práctica sale un cliente del líder de práctica.', 'Completa los datos y envíala: el líder y el administrador reciben el aviso.'],
    gerencia: ['Abre el Panel: ves todos los módulos en solo lectura.', 'Toca un módulo y cambia entre "Mes a mes" y "Año contra año".', 'Abre Gerencia para el resumen por mes y líder.']
  };
  var CASO = {
    documentos_pendientes: 'Faltan documentos: sube los que faltan desde la pestaña Documentos.',
    documentos_solicitados: 'Se pidieron documentos: usa "Contactar" para recordarle al cliente.',
    documentos_recibidos: 'Llegaron documentos: el administrador los pasa a revisión.',
    documentos_en_revision: 'En revisión: el administrador aprueba o devuelve cada documento.',
    por_firmar: 'Por firmar: genera el contrato y súbelo firmado.',
    contrato_firmado: 'Firmado: revisa que el contrato esté en Documentos.'
  };
  var yo = function(){ try { var p = JSON.parse(leer('ae_perfil') || 'null'); return p && (p.perfil || p); } catch (e) { return null; } };
  var rolDe = function(p){ return p ? (p.gerencia ? 'gerencia' : p.rol) : ''; };
  var esc = function(t){ return String(t === null || t === undefined ? '' : t).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function banda(){
    if(!activo() || document.getElementById('prBanda')) return;
    var b = document.createElement('div'); b.id = 'prBanda'; b.className = 'pr-banda'; b.setAttribute('role', 'status');
    b.innerHTML = '<span><b>Modo práctica</b> · nada de esto es real</span><span class="pr-acc"><button type="button" data-pr="guia">Guía</button><button type="button" data-pr="admin" class="hidden">Avisos de práctica</button><button type="button" data-pr="salir">Salir</button></span>';
    document.body.insertBefore(b, document.body.firstChild); document.body.classList.add('en-practica');
    setTimeout(function(){ if(rolDe(yo()) === 'admin') b.querySelector('[data-pr="admin"]').classList.remove('hidden'); }, 1200);
  }
  function hoja(id, html){
    var C = window.Comun; var h = document.getElementById(id);
    if(!h){ h = document.createElement('section'); h.id = id; h.className = 'hoja'; h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-hidden', 'true'); document.body.appendChild(h); if(C) C.prepararHojas(); }
    h.innerHTML = '<div class="asa" aria-hidden="true"></div>' + html;
    if(C) C.abrirHoja(id); else h.classList.add('ver');
  }
  function cab(t, sub){ return '<div class="cab"><div><h2>' + esc(t) + '</h2>' + (sub ? '<p class="sub-hoja">' + esc(sub) + '</p>' : '') + '</div><button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">×</button></div>'; }
  function verGuia(){
    var r = rolDe(yo()); var pasos = GUIA[r] || GUIA.lider;
    hoja('hojaPrGuia', cab('Qué probar', 'Tu cuenta de práctica: ' + ({ admin: 'administrador', lider: 'líder', analista: 'analista', abogado: 'Legal', aliado: 'aliado', gerencia: 'gerencia' }[r] || r)) +
      '<ol class="pr-pasos">' + pasos.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>' +
      '<p class="nota-chica">Los avisos de práctica salen en la campana de este dispositivo. Para ver lo que le llega a otro rol, sal y entra con la cuenta de ese rol.</p>');
  }
  function verAdmin(){
    hoja('hojaPrAdmin', cab('Avisos de práctica', 'Llegan a la campana de las cuentas de práctica') +
      '<form id="prAviso" novalidate><label class="rotulo" for="prPara">Para</label><select class="campo" id="prPara"><option value="">Todos</option><option value="lider">Líderes</option><option value="analista">Analistas</option><option value="abogado">Legal</option><option value="aliado">Aliados</option><option value="gerencia">Gerencia</option></select>' +
      '<label class="rotulo" for="prTexto">Mensaje</label><textarea class="campo" id="prTexto" rows="3" maxlength="300"></textarea><p class="error hidden" id="prErr">Escribe el mensaje</p>' +
      '<div class="acciones"><button type="submit" class="btn btn-ancho">Enviar aviso de práctica</button></div></form>' +
      '<div class="acciones"><button type="button" class="btn btn-2 btn-ancho" data-pr="reiniciar">Reiniciar práctica</button></div><p class="nota-chica">Reiniciar vuelve todos los casos de práctica a como empezaron en este dispositivo.</p>');
  }
  async function enviarAviso(ev){
    ev.preventDefault(); var t = document.getElementById('prTexto').value.trim(); var para = document.getElementById('prPara').value;
    document.getElementById('prErr').classList.toggle('hidden', !!t); if(!t) return;
    await cargarMundo(); var n = 0;
    M.personas.filter(function(p){ return p.activo && (!para || rolDe(p) === para); }).forEach(function(p){ aviso(p.usuario, 'cliente', 'Aviso de práctica', t, 'inicio.html'); n++; });
    guardar(); if(window.Comun) window.Comun.toast('Aviso enviado a ' + n + (n === 1 ? ' cuenta' : ' cuentas') + ' de práctica');
    if(window.Comun && window.Comun.cerrarHoja) window.Comun.cerrarHoja();
  }
  // Recuadro de instrucciones dentro de cada expediente de práctica
  function cajaFicha(){
    if(!activo()) return; var h = document.getElementById('hojaFicha'); if(!h || !h.classList.contains('ver')) return;
    var cabF = document.getElementById('cabFicha'); if(!cabF || cabF.parentNode.querySelector('.pr-caja')) return;
    var E = (window.Comun && window.Comun.ESTATUS) || {}; var tx = cabF.textContent || '';
    var k = Object.keys(CASO).find(function(x){ return E[x] && E[x].t && tx.indexOf(E[x].t) >= 0; });
    var txt = CASO[k] || 'Caso de práctica: prueba aquí lo que harías con un cliente real.';
    var d = document.createElement('div'); d.className = 'pr-caja'; d.innerHTML = '<b>Caso de práctica</b><span>' + esc(txt) + '</span>';
    cabF.parentNode.insertBefore(d, cabF.nextSibling);
  }
  document.addEventListener('click', function(ev){
    var t = ev.target; var b = t.closest ? t.closest('[data-pr],[data-practica]') : null; if(!b) return;
    if(b.hasAttribute('data-practica')){ ev.preventDefault(); if(activo()) salir(); else entrar(rolDe(yo())); return; }
    var a = b.getAttribute('data-pr');
    if(a === 'guia') verGuia(); else if(a === 'admin') verAdmin(); else if(a === 'salir') salir(); else if(a === 'reiniciar'){ if(window.confirm('¿Reiniciar todos los casos de práctica de este dispositivo?')) reiniciar(); }
  });
  document.addEventListener('submit', function(ev){ if(ev.target && ev.target.id === 'prAviso') enviarAviso(ev); });
  if(activo()){
    var arrancar = function(){ banda(); new MutationObserver(cajaFicha).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true }); };
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar); else arrancar();
  }
  window.Practica = { activo: activo, entrar: entrar, salir: salir, reiniciar: reiniciar };
})();
