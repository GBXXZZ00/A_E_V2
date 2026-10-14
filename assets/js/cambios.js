// Migraciones (antes la pestaña "Cambios" de Comisiones): cambios de categoría y de titularidad.
// El líder pide el cambio aquí (reemplaza el WhatsApp); el administrador aprueba las titularidades; el analista marca Emitido;
// el archivo de cambios de categoría o el TAD lo confirman. Lo que aparece sin solicitud queda en su bandeja.
// Ningún cambio entra solo a comisión: confirmado a PYME queda "por decidir" y el Analista Senior o el administrador dicen Sí o No.
(function(){
  'use strict';
  const C = window.Comun;
  const { $, esc, ic, rpc, toast, vacio, abrirHoja, cerrarHoja, hojaAbierta, prepararHojas, fecha, plural, normalizeStr } = C;
  let yo = null; let D = null; let activo = false; let busca = ''; let pedido = 0; let N = null; let V = null; let tab = ''; let abrirId = 0; let fresco = false;
  const ESTADO = {
    por_aprobar: ['ambar', 'Por aprobar'], por_emitir: ['azul', 'Por emitir'], emitido: ['morado', 'Por confirmar'], confirmado: ['verde', 'Confirmado'],
    sin_solicitud: ['rojo', 'Sin solicitud'], rechazado: ['', 'Rechazado'], cancelado: ['', 'Cancelado'], error: ['', 'Fue un error'], revertido: ['', 'Revertido']
  };
  const TIPO = { categoria: 'Categoría', titularidad: 'Titularidad', ambos: 'Categoría y titularidad' };
  const chip = (e) => { const x = ESTADO[e] || ['', e]; return '<span class="chip ' + x[0] + '">' + esc(x[1]) + '</span>'; };
  const lista = () => $('lista');

  async function cargar(){
    const mio = ++pedido;
    if(!D && activo) lista().innerHTML = '<div class="sk-bloque"><span class="sk" style="height:64px;border-radius:16px"></span><span class="sk" style="height:64px;border-radius:16px"></span><span class="sk" style="height:64px;border-radius:16px"></span></div>';
    try { const r = await rpc('cambios_lista', {}); if(mio !== pedido) return; D = r; fresco = true; C.cache.guardar('cambios:' + (yo && yo.rol), r); pintar(); avisarContador(); }
    catch (e) {
      if(mio !== pedido) return;
      if(!D && activo) lista().innerHTML = '<div class="vacio" role="alert"><b>No se pudieron cargar los cambios</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" data-cam="reintentar">Reintentar</button></div>';
      if(activo) toast(e.message, 'error');
    }
  }
  const decidible = (c) => c.estado === 'confirmado' && c.comision === 'por_decidir' && !c.solo_registro;
  const TABS = [
    ['por_aprobar', 'Por aprobar', 'Cambios de titular que esperan la aprobación del administrador.', (c) => c.estado === 'por_aprobar'],
    ['por_emitir', 'Por emitir', 'El analista del líder lo hace en el sistema y marca Emitido.', (c) => c.estado === 'por_emitir'],
    ['emitido', 'Por confirmar', 'Se confirman solos con el archivo de cambios de categoría o el TAD.', (c) => c.estado === 'emitido'],
    ['sin_solicitud', 'Sin solicitud', 'Cambios hacia o desde PYME que aparecieron en el archivo o en el TAD sin pedirse aquí. Vincúlalo a un líder, o márcalo como error o revertido.', (c) => c.estado === 'sin_solicitud'],
    ['decidir', 'Comisión por decidir', 'Cambios a PYME ya confirmados. El Analista Senior o el administrador deciden si comisionan; solo el Sí entra al corte.', decidible],
    ['confirmado', 'Confirmados', 'Ningún cambio entra solo a comisión: se decide uno por uno.', (c) => c.estado === 'confirmado'],
    ['cerrados', 'Cerrados', 'Rechazados, cancelados, errores y revertidos.', (c) => ['rechazado', 'cancelado', 'error', 'revertido'].indexOf(c.estado) >= 0],
    ['negativos', 'Negativos', 'Servicios que pasaron de PYME a otra categoría.', (c) => !!c.negativo]
  ];
  const TAB = (id) => TABS.find((t) => t[0] === id) || TABS[1];
  // Lo que espera a quien mira (Inicio, Mi trabajo y la pestaña marcada al entrar)
  function pendientes(){
    if(!D) return 0; const P = D.puedo || {};
    return (D.filas || []).filter((c) => (P.aprobar && c.estado === 'por_aprobar') || (P.emitir && c.estado === 'por_emitir') || (P.vincular && c.estado === 'sin_solicitud') || (P.decidir && decidible(c))).length;
  }
  function avisarContador(){ document.dispatchEvent(new CustomEvent('cambios-contador', { detail: pendientes() })); }
  // Al entrar sin pestaña elegida: lo primero que le toca a quien mira
  function tabInicial(){
    const P = (D && D.puedo) || {}; const fs = (D && D.filas) || [];
    const orden = [P.decidir && 'decidir', P.aprobar && 'por_aprobar', P.vincular && 'sin_solicitud', 'por_emitir', 'emitido'].filter(Boolean);
    return orden.find((id) => fs.some(TAB(id)[3])) || 'por_emitir';
  }
  function leerUrl(){ const u = new URLSearchParams(location.search); const f = u.get('f'); tab = TABS.some((t) => t[0] === f) ? f : ''; abrirId = Number(u.get('c')) || 0; }
  function guardarUrl(){ try { const u = new URLSearchParams(); if(tab) u.set('f', tab); if(busca) u.set('q', busca); const q = u.toString(); history.replaceState(history.state, '', location.pathname + (q ? '?' + q : '')); } catch (e) {} }

  function filaCambio(c){
    const s = c.servicios || []; const cod = s.map((x) => x.sucursal + '-' + x.codigo).slice(0, 3).join(', ') + (s.length > 3 ? ' y ' + (s.length - 3) + ' más' : '');
    const cat = c.categoria_nueva ? (c.categoria_anterior || '?') + ' a ' + c.categoria_nueva : '';
    const sub = [TIPO[c.tipo], cod, cat, c.nuevo ? 'A ' + c.nuevo.nombre : '', c.lider || (c.estado === 'sin_solicitud' ? 'Sin líder' : ''), fecha(c.fecha_cambio || c.creado_en)].filter(Boolean).join(' · ');
    const etq = comTag(c) + (c.negativo ? '<span class="tagn rojo">PYME a otra categoría</span>' : '') +
      ((c.requisitos || []).some((r) => !r.ok) ? '<span class="tagn ambar">Faltan documentos</span>' : '');
    return '<button type="button" class="fila" data-cambio="' + esc(c.id) + '"><span class="tx"><b>' + esc(c.titular.nombre || 'Titular sin nombre') + '</b><small>' + esc(sub) + '</small>' +
      (etq ? '<small class="etqs">' + etq + '</small>' : '') + '</span><span class="par-m">' + chip(c.estado) + '</span></button>';
  }
  function comTag(c){
    if(!c.comision) return c.comisiona && c.estado !== 'confirmado' ? '<span class="tagn">A PYME</span>' : '';
    if(c.solo_registro) return '<span class="tagn">Solo registro</span>';
    return { por_decidir: '<span class="tagn ambar">Comisión por decidir</span>', si: '<span class="tagn verde">Comisiona</span>', no: '<span class="tagn">No comisiona</span>' }[c.comision] || '';
  }
  function pintar(){
    if(!D || !activo) return;
    if(!tab) tab = tabInicial();
    const b = normalizeStr(busca);
    const ok = (c) => !b || normalizeStr(c.titular.nombre).indexOf(b) >= 0 || normalizeStr(c.lider).indexOf(b) >= 0 || (c.servicios || []).some((s) => String(s.codigo).indexOf(busca) >= 0) || String(c.titular.doc || '').indexOf(busca.replace(/\D/g, '') || '-') >= 0;
    const fs = (D.filas || []).filter(ok); const P = D.puedo || {};
    if(tab === 'decidir' && !P.decidir && !fs.some(TAB('decidir')[3])) tab = tabInicial();
    const f = $('filtros');
    if(f) f.innerHTML = TABS.filter((t) => t[0] !== 'decidir' || P.decidir || fs.some(t[3])).map((t) => { const n = fs.filter(t[3]).length; const urge = n && ((t[0] === 'decidir' && P.decidir) || (t[0] === 'por_aprobar' && P.aprobar) || (t[0] === 'sin_solicitud' && P.vincular) || (t[0] === 'por_emitir' && P.emitir));
      return '<button type="button" role="tab" data-camtab="' + t[0] + '" aria-selected="' + (t[0] === tab) + '" class="' + (t[0] === tab ? 'on' : '') + '">' + esc(t[1]) + ' <em' + (urge ? ' class="rj"' : '') + '>' + n + '</em></button>'; }).join('');
    const T = TAB(tab); const a = $('ayuda'); if(a) a.textContent = T[2];
    let h = '<div class="cam-cab"><div class="cam-info">' + (D.indice ? 'TAD completo del ' + esc(fecha(D.indice.en)) + ' · ' + esc(C.hora(D.indice.en)) : '<span class="mal">Falta subir el TAD completo en Actualizar: sin él no se pueden buscar servicios.</span>') +
      (D.archivo ? '<br>Archivo de cambios del ' + esc(fecha(D.archivo.en)) + ' · ' + esc(C.hora(D.archivo.en)) : '') + '</div>' +
      '<button type="button" class="btn btn-chico" data-cam="nuevo">' + ic('mas') + 'Nuevo cambio</button></div>';
    const l = fs.filter(T[3]);
    if(l.length) h += '<div class="grupo abierto">' + l.map(filaCambio).join('') + '</div>';
    else if(b) h += vacio('Sin resultados', 'Nada coincide con "' + busca + '" en ' + T[1] + '.');
    else if(!(D.filas || []).length) h += vacio('Sin cambios todavía', 'Toca Nuevo cambio para pedir un cambio de categoría o de titular. Ya no hace falta mandarlo por WhatsApp.');
    else h += vacio('Nada en ' + T[1], 'Mira las otras pestañas.');
    lista().innerHTML = h;
    // ?c= abre ese cambio; con lo guardado en el dispositivo se espera la carga fresca si todavía no aparece
    if(abrirId){ const k = abrirId; const esta = (D.filas || []).some((c) => c.id === k); if(esta || fresco) abrirId = 0; if(esta) abrirDetalle(k); }
  }

  // ---------- Hojas ----------
  function hoja(id, idT){
    let h = $(id);
    if(!h){ h = document.createElement('section'); h.id = id; h.className = 'hoja'; h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', idT); h.setAttribute('aria-hidden', 'true'); document.body.appendChild(h); prepararHojas(); }
    return h;
  }
  const cab = (idT, t, sub) => '<div class="cab"><div><h2 id="' + idT + '">' + esc(t) + '</h2>' + (sub ? '<p class="sub-hoja">' + esc(sub) + '</p>' : '') + '</div><button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>';

  // Nuevo cambio (corrida 14/10 tarde, Parte 3): titular de hoy y sus servicios, qué cambia, categoría de la lista del TAD,
  // tipo de solicitud de la planilla oficial (de natural o jurídico a natural o jurídico) y el nuevo titular leído de su RIF con el OCR.
  const SOL = [['natural_natural', 'Natural a natural'], ['natural_juridico', 'Natural a jurídico'], ['juridico_natural', 'Jurídico a natural'], ['juridico_juridico', 'Jurídico a jurídico']];
  // Documentos que se piden según el tipo de solicitud (los mismos que exige el servidor en privado.cambio_requisitos)
  function docsDe(sol){
    const act = sol.indexOf('natural_') === 0 ? 'Cédula o RIF del titular actual' : 'RIF del titular actual';
    const l = ['Planilla de cambio de titular firmada por los dos', act];
    if(sol === 'natural_natural') l.push('Cédula del nuevo titular');
    else if(sol === 'juridico_natural') l.push('Cédula del nuevo titular', 'RIF personal del nuevo titular');
    else l.push('RIF de la empresa nueva', 'Acta constitutiva y actas de asamblea', 'Cédula y RIF del representante legal');
    return l;
  }
  let CATS = null; let pidiendoCats = false;
  async function cargarCats(){
    if(CATS || pidiendoCats) return; pidiendoCats = true;
    try { CATS = await rpc('cambio_categorias', {}); } catch (e) { if(N) N.err.cat = 'No se pudo traer la lista de categorías. ' + e.message; }
    pidiendoCats = false; if(N) pintarNuevo();
  }
  function abrirNuevo(){
    N = { res: null, sel: {}, tipo: 'categoria', err: {}, sol: '', ocr: null, archivo: null };
    hoja('hojaCambioN', 'tCamN').innerHTML = cab('tCamN', 'Nuevo cambio', 'Busca el titular como está en el TAD') + '<div class="hoja-cuerpo" id="cCamN"></div><div class="hoja-pie"><button type="button" class="btn btn-2" data-cierra="1">Cancelar</button><button type="button" class="btn" data-cam="crear" id="camCrear">Pedir cambio</button></div>';
    pintarNuevo(); abrirHoja('hojaCambioN'); cargarCats();
    setTimeout(() => { const i = $('camBusca'); if(i) i.focus(); }, 300);
  }
  // El titular de hoy (el de los servicios marcados) dice de dónde parte la solicitud
  function titularElegido(){
    const k = Object.keys(N.sel).find((x) => N.sel[x]); if(!k || !N.res) return null;
    return N.res.find((t) => t.servicios.some((s) => s.clave === k)) || null;
  }
  function pintarNuevo(){
    const z = $('cCamN'); if(!z || !N) return;
    const e = (k) => '<div class="error" id="eCam_' + k + '" role="alert">' + esc(N.err[k] || '') + '</div>';
    const radios = (id, lista, valor, attr, clase) => '<div class="' + clase + '" role="radiogroup" aria-labelledby="' + id + '">' + lista.map((x) =>
      '<button type="button" role="radio" ' + attr + '="' + x[0] + '" aria-checked="' + (valor === x[0]) + '" class="' + (valor === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div>';
    // 1. Titular de hoy
    let h = '<section class="cam-sec"><h3 class="cam-h">Titular de hoy</h3><label class="rotulo" for="camBusca">Nombre, cédula o RIF</label><div class="busca-linea"><input class="campo" id="camBusca" maxlength="60" autocomplete="off" enterkeyhint="search" value="' + esc(N.q || '') + '"><button type="button" class="btn btn-2 btn-chico" data-cam="buscar">Buscar</button></div>' + e('busca');
    if(N.buscando) h += '<p class="nota-chica"><span class="cargando-linea"><i></i>Buscando en el TAD…</span></p>';
    else if(N.res){
      if(!N.res.length) h += '<p class="nota-chica">No aparece en el TAD. Revisa el nombre o escribe el RIF sin guiones.</p>';
      N.res.forEach((t, i) => {
        h += '<div class="cam-tit"><b>' + esc(t.nombre || 'Sin nombre') + '</b><small>' + esc(C.docFmt(t.doc_tipo || '', t.doc_numero || '')) + ' · ' + plural(t.servicios.length, 'servicio', 'servicios') + '</small>' +
          t.servicios.map((s) => '<label class="cam-srv"><input type="checkbox" data-srv="' + esc(s.clave) + '" data-tit="' + i + '"' + (N.sel[s.clave] ? ' checked' : '') + '><span><b>' + esc(s.sucursal + '-' + s.codigo) + (s.pon ? ' · PON ' + esc(s.pon) : '') + '</b><small>' +
            esc([s.plan, s.categoria, s.estado].filter(Boolean).join(' · ')) + '</small><small>' + esc(s.direccion || 'Sin dirección') + '</small></span></label>').join('') + '</div>';
      });
    }
    h += e('servicios') + '</section>';
    // 2. Qué cambia
    h += '<section class="cam-sec"><h3 class="cam-h" id="rCamTipo">Qué cambia</h3>' + radios('rCamTipo', [['categoria', 'Categoría'], ['titularidad', 'Titular'], ['ambos', 'Los dos']], N.tipo, 'data-camtipo', 'tres') +
      '<p class="nota-chica">' + esc(N.tipo === 'categoria' ? 'Sin documentos: va directo al analista.' : N.tipo === 'titularidad' ? 'Lo aprueba el administrador. No comisiona.' : 'Lo aprueba el administrador. Comisiona por la categoría.') + '</p>';
    if(N.tipo !== 'titularidad'){
      h += '<label class="rotulo arriba" for="camCat">Categoría nueva</label>';
      if(!CATS && !N.err.cat) h += '<div class="sk" style="height:48px;border-radius:14px" aria-hidden="true"></div>';
      else h += '<select class="campo" id="camCat"' + (CATS ? '' : ' disabled') + '><option value="">Elige la categoría</option>' + (CATS || []).map((c) => '<option' + (c === N.cat ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select>';
      h += e('cat');
    }
    h += '</section>';
    if(N.tipo !== 'categoria'){
      // 3. Tipo de solicitud (planilla oficial) y lo que se va a pedir
      const tt = titularElegido(); const actNat = tt ? /^[VE]/i.test(tt.doc_tipo || '') : null;
      h += '<section class="cam-sec"><h3 class="cam-h" id="rCamSol">Tipo de solicitud</h3>' +
        (tt ? '<p class="nota-chica">Según el TAD, el titular de hoy es ' + (actNat ? 'persona natural' : 'jurídica') + '.</p>' : '') +
        radios('rCamSol', SOL, N.sol, 'data-camsol', 'cam-sol') + e('sol');
      if(N.sol) h += '<div class="cam-docs"><b>Se van a pedir</b><ul>' + docsDe(N.sol).map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></div>';
      h += '</section>';
      // 4. Nuevo titular: el RIF se lee con el OCR y la persona confirma
      const nat = N.sol ? /_natural$/.test(N.sol) : false; const o = N.ocr;
      h += '<section class="cam-sec"><h3 class="cam-h">Nuevo titular</h3>' +
        '<div class="cam-rif"><button type="button" class="btn btn-2 btn-ancho" data-cam="rif"' + (N.leyendo ? ' disabled' : '') + '>' + ic('subir') + (N.leyendo ? 'Leyendo el RIF…' : N.archivo ? 'Cambiar el RIF' : 'Subir RIF') + '</button>' +
        '<input type="file" id="camRifArchivo" accept="application/pdf,image/jpeg,image/png" hidden>' +
        (N.archivo ? '<p class="nota-chica">' + esc(N.archivo.name) + '. Queda en la casilla ' + (nat ? 'RIF personal' : 'RIF de la empresa') + ' del nuevo titular al pedir el cambio.</p>' : '<p class="nota-chica">Llena el RIF, el nombre y el domicilio. Confírmalos antes de pedir.</p>') + '</div>';
      if(o && !N.leyendo){
        if(o.estado === 'ok' && !o.dudosa && /^rif_/.test(o.tipo || '')) h += '<div class="al-banda verde" role="status"><b>Leído del RIF</b><p>Revisa que esté bien y corrige si hace falta.</p></div>';
        else if(o.estado === 'ok' && /^rif_/.test(o.tipo || '')) h += '<div class="al-banda ambar" role="status"><b>Lectura dudosa</b><p>' + esc((o.datos && o.datos.motivos || []).join(', ') || 'Revisa cada dato') + '. Corrige lo que no esté bien.</p></div>';
        else if(o.estado === 'ok') h += '<div class="al-banda rojo" role="alert"><b>No corresponde a un RIF</b><p>El archivo parece ' + esc(o.tipo === 'cedula' ? 'una cédula' : 'otro documento') + '. Sube el RIF o escribe los datos.</p></div>';
        else h += '<div class="al-banda ambar" role="status"><b>No se pudo leer</b><p>' + esc(o.error || 'Google no devolvió el texto') + '. Escribe los datos; el archivo igual se guarda.</p></div>';
      }
      h += '<label class="rotulo arriba" for="camDoc">' + (nat ? 'Cédula o RIF' : 'RIF') + '</label><input class="campo" id="camDoc" maxlength="16" autocomplete="off" autocapitalize="characters" inputmode="text" value="' + esc(N.doc || '') + '">' + e('doc') +
        '<label class="rotulo arriba" for="camNom">' + (nat ? 'Nombre completo' : 'Razón social') + '</label><input class="campo" id="camNom" maxlength="120" autocomplete="off" value="' + esc(N.nom || '') + '">' + e('nom') +
        '<label class="rotulo arriba" for="camDom">Domicilio fiscal</label><textarea class="area corta" id="camDom" maxlength="300">' + esc(N.dom || '') + '</textarea>' + e('dom') + '</section>';
    }
    h += '<section class="cam-sec"><label class="rotulo" for="camNota">Nota (opcional)</label><textarea class="area corta" id="camNota" maxlength="500">' + esc(N.nota || '') + '</textarea>' + e('general') + '</section>';
    z.innerHTML = h;
  }
  function leerCampos(){
    if(!N) return; const v = (id) => { const x = $(id); return x ? x.value : undefined; };
    if(v('camBusca') !== undefined) N.q = v('camBusca'); if(v('camCat') !== undefined) N.cat = v('camCat');
    if(v('camDoc') !== undefined) N.doc = v('camDoc'); if(v('camNom') !== undefined) N.nom = v('camNom'); if(v('camDom') !== undefined) N.dom = v('camDom'); if(v('camNota') !== undefined) N.nota = v('camNota');
  }
  async function buscar(){
    leerCampos(); N.err = {}; const t = String(N.q || '').trim();
    if(t.replace(/\D/g, '').length < 5 && normalizeStr(t).length < 3){ N.err.busca = 'Escribe al menos 3 letras o el RIF'; pintarNuevo(); return; }
    N.buscando = true; pintarNuevo();
    try { const r = await rpc('servicios_buscar', { p_texto: t }); N.res = r.sin_indice ? [] : r.titulares || []; if(r.sin_indice) N.err.busca = 'Falta subir el TAD completo en Actualizar'; }
    catch (e) { N.err.busca = e.message; }
    N.buscando = false; pintarNuevo();
  }
  // "Subir RIF": el OCR de Google Drive lo lee (sin IA) y llena RIF, nombre y domicilio para que la persona confirme
  async function leerRif(file){
    leerCampos(); N.err = {};
    if(!/^(application\/pdf|image\/(jpeg|png))$/i.test(file.type)){ N.err.doc = 'Sube el RIF en PDF, JPG o PNG'; pintarNuevo(); return; }
    if(file.size > 10 * 1024 * 1024){ N.err.doc = 'El archivo pesa más de 10 MB'; pintarNuevo(); return; }
    N.archivo = file; N.leyendo = true; N.ocr = null; pintarNuevo();
    const mio = N; let o;
    try {
      const s = await window.db.auth.getSession(); const tk = (s.data && s.data.session && s.data.session.access_token) || '';
      if(!tk) throw new Error('Tu sesión venció. Entra de nuevo');
      const fd = new FormData(); fd.append('archivo', file, file.name);
      const r = await fetch(window.db.supabaseUrl + '/functions/v1/ocr_leer', { method: 'POST', headers: { Authorization: 'Bearer ' + tk, apikey: window.db.supabaseKey }, body: fd });
      o = await r.json().catch(() => ({ estado: 'sin_lectura', error: 'Respuesta inválida' }));
      if(!r.ok && !o.estado) o = { estado: 'sin_lectura', error: o.error || 'No se pudo leer' };
    } catch (e) { o = { estado: 'sin_lectura', error: navigator.onLine === false ? 'Sin conexión' : e.message }; }
    if(N !== mio) return;   // cerró o abrió otro pedido mientras leía
    N.leyendo = false; N.ocr = o;
    const d = o.datos || {};
    if(o.estado === 'ok' && /^rif_/.test(o.tipo || '')){
      // Persona natural: la cédula sin el dígito verificador, como se guarda en la base; empresa: el RIF completo
      if(d.rif){ N.doc = /^[VE]/.test(d.rif) ? d.rif.charAt(0) + '-' + d.rif.slice(1, -1).replace(/^0+/, '') : d.rif.charAt(0) + '-' + d.rif.slice(1, 9) + '-' + d.rif.slice(9);
        if(!N.sol){ const tt = titularElegido(); const de = tt && /^[VE]/i.test(tt.doc_tipo || '') ? 'natural' : 'juridico'; N.sol = de + '_' + (/^[VE]/.test(d.rif) ? 'natural' : 'juridico'); } }
      if(d.razon_social) N.nom = d.razon_social; if(d.domicilio) N.dom = d.domicilio;
    }
    pintarNuevo();
  }
  async function crear(b){
    leerCampos(); N.err = {};
    const claves = Object.keys(N.sel).filter((k) => N.sel[k]);
    if(!claves.length) N.err.servicios = 'Marca al menos un servicio';
    if(N.tipo !== 'titularidad' && !String(N.cat || '').trim()) N.err.cat = 'Elige la categoría nueva';
    let letra = '';
    if(N.tipo !== 'categoria'){
      if(!N.sol) N.err.sol = 'Elige el tipo de solicitud';
      const nat = /_natural$/.test(N.sol || '');
      letra = (String(N.doc || '').match(/[VEJGPC]/i) || [nat ? 'V' : 'J'])[0].toUpperCase();
      if(String(N.doc || '').replace(/\D/g, '').length < 5) N.err.doc = 'Escribe ' + (nat ? 'la cédula o el RIF' : 'el RIF') + ' del nuevo titular';
      else if(N.sol && nat && 'VE'.indexOf(letra) < 0) N.err.doc = 'Una persona natural lleva V o E';
      else if(N.sol && !nat && 'VE'.indexOf(letra) >= 0) N.err.doc = 'Una empresa lleva J, G, C o P';
      if(String(N.nom || '').trim().length < 3) N.err.nom = 'Escribe ' + (nat ? 'el nombre' : 'la razón social');
    }
    if(Object.keys(N.err).length){ pintarNuevo(); const p = document.querySelector('#cCamN .error:not(:empty)'); if(p) p.scrollIntoView({ block: 'center' }); return; }
    b.disabled = true; b.textContent = 'Guardando…';
    const o = N.ocr; const arch = N.archivo; const nat = /_natural$/.test(N.sol || '');
    try {
      const id = await rpc('cambio_crear', { p_datos: { tipo: N.tipo, servicios: claves, categoria_nueva: N.tipo === 'titularidad' ? null : String(N.cat).trim(), nota: N.nota || null, tipo_solicitud: N.tipo === 'categoria' ? null : N.sol,
        nuevo: N.tipo === 'categoria' ? null : { tipo: letra, doc: N.doc, nombre: N.nom, natural: nat, domicilio: String(N.dom || '').trim() || null, ocr: o ? { estado: o.estado, tipo: o.tipo || null, dudosa: !!o.dudosa } : null } } });
      toast(N.tipo === 'categoria' ? 'Cambio pedido. Le llega al analista' : 'Cambio pedido. Le llega al administrador para aprobarlo');
      N = null; cerrarHoja(true); D = null; await cargar(); abrirDetalle(Number(id));
      // El RIF que se leyó queda en la casilla del nuevo titular
      if(arch) guardarRif(Number(id), arch, nat);
    } catch (e) { N.err.general = e.message; pintarNuevo(); b.disabled = false; b.textContent = 'Pedir cambio'; }
  }
  async function guardarRif(idCambio, arch, nat){
    try {
      const d = await rpc('cambio_detalle', { p_id: idCambio }); if(!d.nuevo || !d.nuevo.cliente_id) return;
      const F = await rpc('cliente_ficha', { p_cliente: d.nuevo.cliente_id }); const cas = nat ? 'rif_personal' : 'rif_empresa'; const num = nat ? 1 : 0;
      // Si el nuevo titular ya existía y tiene su RIF, no se pisa sin que alguien lo vea
      if((F.documentos || []).some((x) => x.casilla === cas && x.numero === num)){ toast('El nuevo titular ya tiene RIF en su expediente. Si este es más nuevo, súbelo desde su expediente'); return; }
      if(!window.Ficha.subirArchivoA(F, cas, num, arch, () => { if(V && V.id === idCambio) cargarDetalle(); cargar(); })) toast('El cambio quedó pedido, pero el RIF no se guardó porque hay otra subida en curso. Súbelo desde el cambio', 'error');
    } catch (e) { toast('El cambio quedó pedido, pero el RIF no se guardó: ' + e.message + '. Súbelo desde el cambio', 'error'); }
  }

  // Detalle: estado, servicios, documentos, planilla, acciones y bitácora
  async function abrirDetalle(id){
    V = { id, d: null };
    hoja('hojaCambio', 'tCam').innerHTML = cab('tCam', 'Cambio', '') + '<div class="hoja-cuerpo" id="cCam"><div class="sk-bloque"><span class="sk" style="height:64px;border-radius:16px"></span><span class="sk" style="height:64px;border-radius:16px"></span></div></div><div class="hoja-pie hidden" id="pCam"></div>';
    abrirHoja('hojaCambio'); cargarDetalle();
  }
  async function cargarDetalle(){
    if(!V) return; const mio = V;
    try { const d = await rpc('cambio_detalle', { p_id: V.id }); if(V !== mio) return; V.d = d; pintarDetalle(); }
    catch (e) { if(V !== mio) return; $('cCam').innerHTML = '<div class="vacio" role="alert"><b>No se pudo abrir el cambio</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" data-cam="reDetalle">Reintentar</button></div>'; }
  }
  const fila = (etq, valor) => '<div class="dato-f"><span>' + esc(etq) + '</span><b>' + valor + '</b></div>';
  function pintarDetalle(){
    const d = V.d; const P = (D && D.puedo) || {}; const e = ESTADO[d.estado] || ['', d.estado];
    $('tCam').textContent = TIPO[d.tipo] ? 'Cambio de ' + TIPO[d.tipo].toLowerCase() : 'Cambio';
    const sigue = { por_aprobar: 'Espera la aprobación del administrador.', por_emitir: 'El analista lo hace en el sistema y marca Emitido.', emitido: 'Se confirma solo con el archivo de cambios de categoría o el TAD.',
      confirmado: !d.comision ? 'Listo.' : d.solo_registro ? 'Es de antes del ' + fecha(D && D.desde) + ': queda solo como registro.' : d.comision === 'por_decidir' ? 'Falta decidir si comisiona.' : d.comision === 'si' ? 'Comisiona en el corte con la regla de siempre (Legal y pago).' : 'No comisiona.', sin_solicitud: 'Apareció sin pedirse en la app. Vincúlalo a un líder o márcalo.',
      rechazado: d.cierre_nota || '', cancelado: d.cierre_nota || '', error: d.cierre_nota || 'No comisiona.', revertido: d.cierre_nota || 'No comisiona.' }[d.estado] || '';
    let h = '<div class="estado ' + (e[0] || 'gris') + '"><b>' + esc(e[1]) + '</b><small>' + esc(sigue) + '</small></div>';
    if(d.negativo) h += '<div class="al-banda rojo" role="note"><b>PYME a otra categoría</b><p>Cuenta como indicador negativo.</p></div>';
    h += '<div class="datos">' + fila('Titular', esc(d.titular.nombre || '') + ' <small>' + esc(C.docFmt(d.titular.tipo || '', d.titular.doc || '')) + '</small>') +
      (d.nuevo ? fila('Nuevo titular', esc(d.nuevo.nombre) + ' <small>' + esc(C.docFmt(d.nuevo.tipo || '', d.nuevo.doc || '')) + '</small>') : '') +
      (d.categoria_nueva ? fila('Categoría', esc((d.categoria_anterior || '?') + ' a ' + d.categoria_nueva)) : '') +
      fila('Líder', esc(d.lider || 'Sin líder')) + fila('Pedido', esc(d.creado_por ? d.creado_por + ', ' + fecha(d.creado_en) : d.origen === 'archivo' ? 'Archivo o TAD, ' + fecha(d.creado_en) : fecha(d.creado_en))) +
      (d.nota ? fila('Nota', esc(d.nota)) : '') + '</div>';
    if(d.comision) h += bloqueComision(d, P);
    h += '<div class="secc">Servicios<span class="der">' + (d.servicios || []).length + '</span></div><div class="datos">' + (d.servicios || []).map((s) => fila(s.sucursal + '-' + s.codigo, esc([s.plan, s.categoria, s.pon ? 'PON ' + s.pon : ''].filter(Boolean).join(' · ')) + '<small class="ded-gris"> ' + esc(s.direccion || '') + '</small>')).join('') + '</div>';
    if(d.tipo !== 'categoria'){
      const req = d.requisitos || []; const falta = req.filter((r) => !r.ok).length;
      h += '<div class="secc">Documentos<span class="der">' + (falta ? (falta === 1 ? 'Falta 1' : 'Faltan ' + falta) : 'Completos') + '</span></div>' +
        '<p class="nota-chica">Van al expediente del nuevo titular.</p>' + req.map((r) => '<div class="chk"><i class="' + (r.ok ? 'ok">' + ic('check') : 'no">') + '</i><span>' + esc(r.texto) + '</span>' +
          (!r.ok && ['por_aprobar', 'por_emitir', 'emitido'].indexOf(d.estado) >= 0 ? '<button type="button" class="mini pri" data-cam-subir="' + esc(r.casilla + ':' + r.numero) + '">Subir</button>' : '') + '</div>').join('') +
        (d.nuevo && d.nuevo.cliente_id ? '<button type="button" class="exp" data-cam="expediente"><span>Abrir expediente del nuevo titular<small>Documentos, contacto e hilo</small></span>' + ic('derecha', 'ch') + '</button>' : '');
      h += '<div class="secc">Planilla de cambio de titular</div><p class="nota-chica">Se imprime, la firman y ponen las huellas ambos titulares, y se sube aquí arriba.</p>' +
        '<div class="acc-prof"><button type="button" class="mini" data-cam="planilla">' + ic('doc') + 'Descargar</button><button type="button" class="mini pri" data-cam="planillaWa">' + ic('wa') + 'Enviar por WhatsApp</button></div>';
    }
    if(d.estado === 'sin_solicitud' && P.vincular) h += '<div class="secc">¿De quién es?</div><label class="rotulo" for="camLider">Vincular a un líder</label><select class="campo" id="camLider"><option value="">Elige el líder</option>' +
      ((D && D.lideres) || []).map((l) => '<option value="' + esc(l.id) + '">' + esc(l.nombre) + '</option>').join('') + '</select><div class="error" id="eCamLider" role="alert"></div>';
    if(['por_aprobar', 'por_emitir', 'sin_solicitud'].indexOf(d.estado) >= 0) h += '<label class="rotulo arriba" for="camNotaAcc">Nota' + (d.estado === 'sin_solicitud' ? ' (opcional)' : ' (para rechazar o cancelar)') + '</label><textarea class="area corta" id="camNotaAcc" maxlength="500"></textarea><div class="error" id="eCamAcc" role="alert"></div>';
    h += '<div class="secc">Qué ha pasado</div>' + ((d.bitacora || []).length ? '<div class="datos">' + d.bitacora.map((x) => fila(fecha(x.en) + ' ' + C.hora(x.en), esc(textoBit(x)) + (x.por ? ' · ' + esc(C.primerNombre(x.por)) : ''))).join('') + '</div>' : '<p class="nota-chica">Sin movimientos.</p>');
    $('cCam').innerHTML = h;
    // Acciones según el estado y quién mira
    const acc = []; const es = (r) => yo && yo.rol === r;
    if(d.estado === 'por_aprobar' && P.aprobar){ acc.push(['rechazar', 'Rechazar', 'btn-2']); acc.push(['aprobar', 'Aprobar', '']); }
    if(d.estado === 'por_emitir' && P.emitir) acc.push(['emitido', 'Marcar emitido', '']);
    if((d.estado === 'por_emitir' || d.estado === 'emitido') && P.confirmar) acc.push(['confirmar', 'Confirmar a mano', 'btn-2']);
    if(d.estado === 'sin_solicitud' && P.vincular){ acc.push(['error', 'Fue un error', 'btn-2']); acc.push(['revertido', 'Revertido', 'btn-2']); acc.push(['vincular', 'Vincular', '']); }
    if((d.estado === 'por_aprobar' || d.estado === 'por_emitir') && (es('admin') || d.creado_por === (yo && yo.nombre))) acc.unshift(['cancelar', 'Cancelar pedido', 'btn-2']);
    // La comisión del cambio: Sí o No con motivo (solo Analista Senior o administrador)
    const com = [];
    if(d.estado === 'confirmado' && d.comision && !d.solo_registro && P.decidir){
      if(d.comision !== 'no') com.push(['no', d.comision === 'si' ? 'Quitar la comisión' : 'No comisiona', 'btn-2']);
      if(d.comision !== 'si') com.push(['si', 'Sí comisiona', '']);
    }
    const p = $('pCam'); p.classList.toggle('hidden', !acc.length && !com.length);
    p.innerHTML = acc.map((a) => '<button type="button" class="btn ' + a[2] + '" data-cam-acc="' + a[0] + '">' + esc(a[1]) + '</button>').join('') +
      com.map((a) => '<button type="button" class="btn ' + a[2] + '" data-cam-com="' + a[0] + '">' + esc(a[1]) + '</button>').join('');
  }
  function bloqueComision(d, P){
    const est = d.solo_registro ? ['gris', 'Solo registro', 'El cambio es del ' + fecha(d.fecha_cambio) + ', antes del ' + fecha(D && D.desde) + ' (fecha mínima para comisionar).']
      : d.comision === 'por_decidir' ? ['ambar', 'Por decidir', P.decidir ? 'Decide si este cambio comisiona. Escribe el motivo y elige abajo.' : 'Lo decide el Analista Senior o el administrador.']
      : d.comision === 'si' ? ['verde', 'Comisiona', 'Entró al corte como "Cambio de categoría".'] : ['gris', 'No comisiona', ''];
    let h = '<div class="secc">Comisión</div><div class="estado ' + est[0] + '"><b>' + esc(est[1]) + '</b><small>' + esc(est[2]) + '</small></div>';
    if(d.comision_motivo && d.comision !== 'por_decidir') h += '<div class="datos">' + fila('Motivo', esc(d.comision_motivo)) + fila('Decidió', esc((d.comision_por || '') + (d.comision_en ? ', ' + fecha(d.comision_en) : ''))) + '</div>';
    if(d.estado === 'confirmado' && !d.solo_registro && P.decidir) h += '<label class="rotulo arriba" for="camMotivo">Motivo de la decisión</label><textarea class="area corta" id="camMotivo" maxlength="500"></textarea><div class="error" id="eCamMotivo" role="alert"></div>';
    return h;
  }
  const textoBit = (x) => x.accion === 'cambio_comision' ? ((x.despues || {}).comision === 'si' ? 'Marcó que comisiona' : 'Marcó que no comisiona') + ((x.despues || {}).motivo ? ': ' + x.despues.motivo : '') : (TEXTO_BIT[x.accion] || x.accion);
  async function decidir(b, a){
    const m = $('camMotivo') ? $('camMotivo').value.trim() : ''; const er = $('eCamMotivo'); if(er) er.textContent = '';
    if(m.length < 4){ if(er) er.textContent = 'Escribe el motivo'; else toast('Escribe el motivo', 'error'); if($('camMotivo')){ $('camMotivo').focus(); er.scrollIntoView({ block: 'nearest' }); } return; }
    const txt = b.textContent; b.disabled = true; b.textContent = 'Guardando…';
    try {
      await rpc('cambio_comision', { p_id: V.d.id, p_si: a === 'si', p_motivo: m });
      toast(a === 'si' ? 'Comisiona. Ya está en el corte' : V.d.comision === 'si' ? 'Comisión quitada' : 'Marcado que no comisiona');
      cargar(); cargarDetalle();
    } catch (e) { if(er) er.textContent = e.message; else toast(e.message, 'error'); b.disabled = false; b.textContent = txt; }
  }
  const TEXTO_BIT = { cambio_creado: 'Pidió el cambio', cambio_aprobar: 'Aprobó', cambio_rechazar: 'Rechazó', cambio_cancelar: 'Canceló', cambio_emitido: 'Marcó emitido', cambio_confirmar: 'Confirmó a mano',
    cambio_confirmado: 'Quedó confirmado', cambio_vincular: 'Lo vinculó a un líder', cambio_error: 'Marcó que fue un error', cambio_revertido: 'Marcó revertido' };
  async function accion(b, a){
    const d = V.d; const nota = $('camNotaAcc') ? $('camNotaAcc').value.trim() : ''; const er = $('eCamAcc'); if(er) er.textContent = '';
    let lider = null;
    if(a === 'vincular'){ lider = $('camLider').value; if(!lider){ $('eCamLider').textContent = 'Elige el líder'; return; } }
    if(a === 'rechazar' && !nota){ if(er) er.textContent = 'Escribe por qué se rechaza'; return; }
    const txt = b.textContent; b.disabled = true; b.textContent = 'Guardando…';
    try {
      await rpc('cambio_accion', { p_id: d.id, p_accion: a, p_nota: nota || null, p_lider: lider });
      toast({ aprobar: 'Aprobado. Le llega al analista', rechazar: 'Rechazado', cancelar: 'Pedido cancelado', emitido: 'Marcado emitido. Se confirma con el archivo o el TAD', confirmar: 'Confirmado',
        vincular: 'Vinculado y confirmado', error: 'Marcado como error', revertido: 'Marcado como revertido' }[a] || 'Listo');
      cargar(); cargarDetalle();
    } catch (e) { if(er) er.textContent = e.message; else toast(e.message, 'error'); b.disabled = false; b.textContent = txt; }
  }
  // Planilla con los datos del momento
  function datosPlanilla(){
    const d = V.d; const t = d.titular || {}; const n = d.nuevo || {}; const k = d.nuevo_contacto || {}; const s = (d.servicios || [])[0] || {};
    const tipo = (t.natural ? 'natural' : 'juridico') + '_' + (n.natural ? 'natural' : 'juridico');
    return { tipo, servicio: (d.servicios || []).map((x) => x.sucursal + '-' + x.codigo).join(', '), ubicacion: s.direccion || '', fecha: '',
      actual: { nombre: t.nombre, doc: C.docFmt(t.tipo || '', t.doc || ''), natural: !!t.natural, direccion: s.direccion || '' },
      nuevo: { nombre: n.nombre, doc: C.docFmt(n.tipo || '', n.doc || ''), natural: !!n.natural, direccion: k.direccion || '', correo: k.correo || '', telefono: k.telefono || '' } };
  }
  function archivoPlanilla(){
    const blob = window.Documentos.planillaTitular(datosPlanilla());
    const nom = window.Documentos.nombreArchivo('cambio-de-titular', (V.d.titular || {}).nombre || 'cliente');
    return new File([blob], nom, { type: 'application/pdf' });
  }
  function puedeCompartir(){ try { return window.matchMedia('(pointer: coarse)').matches && !!navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] }); } catch (e) { return false; } }
  async function enviarPlanilla(){
    let f; try { f = archivoPlanilla(); } catch (e) { toast('No se pudo armar la planilla. Intenta de nuevo', 'error'); return; }
    const texto = 'Hola. Te envío la planilla de cambio de titular del servicio ' + datosPlanilla().servicio + '. Por favor imprímela, fírmala con tus huellas (ambos titulares) y envíamela con la copia de la cédula o el RIF de ambos.';
    if(puedeCompartir()){
      try { await navigator.share({ files: [f], text: texto }); } catch (e) { if(!(e && e.name === 'AbortError')) toast('No se pudo abrir Compartir. Intenta de nuevo', 'error'); }
    } else { window.Archivos.descargar(f, f.name); window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank', 'noopener'); }
  }
  // Subir un documento del cambio al expediente del nuevo titular
  async function subir(cas, num){
    const d = V.d; if(!d.nuevo || !d.nuevo.cliente_id) return;
    let F;
    try { F = await rpc('cliente_ficha', { p_cliente: d.nuevo.cliente_id }); } catch (e) { toast(e.message, 'error'); return; }
    window.Ficha.subirA(F, cas, num, () => { cargarDetalle(); cargar(); });
  }

  document.addEventListener('click', (ev) => {
    const t = ev.target; let b;
    if((b = t.closest('[data-cam]'))){
      const a = b.dataset.cam;
      if(a === 'rif'){ const i = $('camRifArchivo'); if(i){ i.value = ''; i.click(); } return; }
      if(a === 'nuevo') abrirNuevo(); else if(a === 'buscar') buscar(); else if(a === 'crear') crear(b); else if(a === 'reintentar') cargar(); else if(a === 'reDetalle') cargarDetalle();
      else if(a === 'planilla'){ try { const f = archivoPlanilla(); window.Archivos.descargar(f, f.name); toast('Planilla descargada'); } catch (e) { toast('No se pudo armar la planilla. Intenta de nuevo', 'error'); } }
      else if(a === 'planillaWa') enviarPlanilla();
      else if(a === 'expediente' && V && V.d && V.d.nuevo) window.Ficha.abrir(V.d.nuevo.cliente_id, { yo, tab: 'documentos', alCerrar: cargarDetalle });
      return;
    }
    if((b = t.closest('[data-cambio]'))){ abrirDetalle(Number(b.dataset.cambio)); return; }
    if((b = t.closest('[data-cam-acc]'))){ accion(b, b.dataset.camAcc); return; }
    if((b = t.closest('[data-cam-com]'))){ decidir(b, b.dataset.camCom); return; }
    if((b = t.closest('[data-camtab]'))){ tab = b.dataset.camtab; guardarUrl(); pintar(); return; }
    if((b = t.closest('[data-cam-subir]'))){ const p = b.dataset.camSubir.split(':'); subir(p[0], Number(p[1])); return; }
    if((b = t.closest('[data-camtipo]'))){ leerCampos(); N.tipo = b.dataset.camtipo; pintarNuevo(); return; }
    if((b = t.closest('[data-camsol]'))){ leerCampos(); N.sol = b.dataset.camsol; N.err.sol = ''; pintarNuevo(); return; }
  });
  document.addEventListener('change', (ev) => {
    if(ev.target && ev.target.id === 'camRifArchivo' && N){ const f = ev.target.files && ev.target.files[0]; if(f) leerRif(f); return; }
    const x = ev.target.closest('[data-srv]'); if(!x || !N) return;
    // Los servicios de un cambio son de un solo titular
    const tit = x.dataset.tit;
    if(x.checked) Object.keys(N.sel).forEach((k) => { const o = document.querySelector('[data-srv="' + k + '"]'); if(o && o.dataset.tit !== tit){ N.sel[k] = false; o.checked = false; } });
    N.sel[x.dataset.srv] = x.checked; const er = $('eCam_servicios'); if(er) er.textContent = '';
    if(N.tipo !== 'categoria'){ leerCampos(); pintarNuevo(); }   // el titular elegido dice de dónde parte la solicitud
  });
  document.addEventListener('keydown', (ev) => { if(ev.key === 'Enter' && ev.target && ev.target.id === 'camBusca'){ ev.preventDefault(); buscar(); } });

  // Página Migraciones
  let tBusca = null;
  const bq = $('busca');
  const fb = $('formBusca'); if(fb) fb.addEventListener('submit', (e) => { e.preventDefault(); if(bq) bq.blur(); });
  if(bq) bq.addEventListener('input', () => { clearTimeout(tBusca); tBusca = setTimeout(() => { busca = bq.value.trim(); guardarUrl(); pintar(); }, 140); });
  window.Armazon.arrancar(['admin', 'analista', 'lider'], { activo: 'migraciones' }, (p) => {
    yo = p; activo = true; window.Ficha.montar(); leerUrl();
    busca = (new URLSearchParams(location.search).get('q') || '').slice(0, 60); if(bq) bq.value = busca;
    if(!D){ const g = C.cache.leer('cambios:' + p.rol); if(g) D = g; }
    if(D) pintar(); cargar();
  }, (p) => { yo = p; });
})();
