// Migraciones (lote 22/10): un módulo simple para los cambios de categoría y de titular.
// El líder registra el cambio y sube los documentos; el administrador los revisa en el expediente (al aprobarlos pasa solo al analista);
// el analista del líder lo hace en Proham y marca Hecho; la siguiente carga del TAD lo confirma sola.
// Lo que el TAD muestra sin registro va a "Sin registro" (administrador y Analista Senior).
(function(){
  'use strict';
  const C = window.Comun;
  const { $, esc, ic, rpc, toast, vacio, abrirHoja, cerrarHoja, prepararHojas, fecha, plural, normalizeStr } = C;
  let yo = null; let D = null; let activo = false; let busca = ''; let pedido = 0; let N = null; let V = null; let tab = ''; let abrirId = 0; let fresco = false;
  const ESTADO = {
    por_revisar: ['ambar', 'Por revisar'], por_emitir: ['azul', 'Por emitir'], por_confirmar: ['morado', 'Por confirmar'], confirmado: ['verde', 'Confirmada'],
    sin_registro: ['rojo', 'Sin registro'], cancelado: ['', 'Cancelado'], error: ['', 'Fue un error'], revertido: ['', 'Revertido']
  };
  const TIPO = { migracion: 'Migración a PYME', titularidad: 'Cambio de titular', ambos: 'Migración y cambio de titular', residencial: 'Cambio a residencial' };
  const AYUDA_TIPO = {
    migracion: 'Pasa de residencial a empresa: en Proham se cambian el plan y la categoría. Comisiona.',
    titularidad: 'El servicio pasa a otra persona o empresa. No comisiona.',
    ambos: 'Cambia de titular y pasa a PYME. Comisiona por la categoría.',
    residencial: 'Deja de ser empresa. Cuenta como indicador negativo del líder.'
  };
  const AVISO = { falta_plan: 'Falta cambiar el plan', falta_categoria: 'Falta cambiar la categoría' };
  const chip = (e) => { const x = ESTADO[e] || ['', e]; return '<span class="chip ' + x[0] + '">' + esc(x[1]) + '</span>'; };
  const lista = () => $('lista');
  const cerrado = (c) => ['cancelado', 'error', 'revertido'].indexOf(c.estado) >= 0;

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
  const TABS = [
    ['por_revisar', 'Por revisar', 'El administrador revisa los documentos en el expediente. Al aprobarlos, el cambio pasa solo al analista.', (c) => c.estado === 'por_revisar'],
    ['por_emitir', 'Por emitir', 'El analista del líder lo hace en Proham (plan y categoría a la vez) y marca Hecho.', (c) => c.estado === 'por_emitir'],
    ['por_confirmar', 'Por confirmar', 'Se confirman solos con la siguiente carga del TAD completo.', (c) => c.estado === 'por_confirmar'],
    ['confirmado', 'Confirmadas', 'Ya se ven en el TAD. Las migraciones comisionan con Legal y pago; el histórico se pagó fuera de la app.', (c) => c.estado === 'confirmado' || cerrado(c)],
    ['sin_registro', 'Sin registro', 'Cambios que el TAD muestra sin registro en la app. Asígnalo a un líder, o márcalo como error o revertido.', (c) => c.estado === 'sin_registro']
  ];
  const TAB = (id) => TABS.find((t) => t[0] === id) || TABS[1];
  // Lo que espera a quien mira (Inicio, Mi trabajo y la pestaña marcada al entrar)
  function pendientes(){
    if(!D) return 0; const P = D.puedo || {};
    return (D.filas || []).filter((c) => (P.revisar && c.estado === 'por_revisar') || c.puedo_hecho || (P.sin_registro && c.estado === 'sin_registro')).length;
  }
  function avisarContador(){ document.dispatchEvent(new CustomEvent('cambios-contador', { detail: pendientes() })); }
  function tabInicial(){
    const P = (D && D.puedo) || {}; const fs = (D && D.filas) || [];
    if(P.revisar && fs.some((c) => c.estado === 'por_revisar')) return 'por_revisar';
    if(fs.some((c) => c.puedo_hecho)) return 'por_emitir';
    if(P.sin_registro && fs.some((c) => c.estado === 'sin_registro')) return 'sin_registro';
    return ['por_revisar', 'por_emitir', 'por_confirmar'].find((id) => fs.some(TAB(id)[3])) || 'por_revisar';
  }
  function leerUrl(){ const u = new URLSearchParams(location.search); const f = u.get('f'); tab = TABS.some((t) => t[0] === f) ? f : ''; abrirId = Number(u.get('c')) || 0; }
  function guardarUrl(){ try { const u = new URLSearchParams(); if(tab) u.set('f', tab); if(busca) u.set('q', busca); const q = u.toString(); history.replaceState(history.state, '', location.pathname + (q ? '?' + q : '')); } catch (e) {} }

  const codigos = (c) => { const s = c.servicios || []; return s.map((x) => (x.sucursal ? x.sucursal + '-' : '') + x.codigo).slice(0, 2).join(', ') + (s.length > 2 ? ' y ' + (s.length - 2) + ' más' : ''); };
  function etiquetas(c){
    let h = '';
    if(c.aviso) h += '<span class="tagn ambar">' + esc(AVISO[c.aviso]) + '</span>';
    if(c.pagado_fuera) h += '<span class="tagn">Pagado fuera de la app</span>';
    else if(c.estado === 'confirmado' && c.comision === 'si') h += '<span class="tagn verde">Comisiona</span>';
    if(c.tipo === 'residencial' && c.estado === 'confirmado') h += '<span class="tagn rojo">Indicador negativo</span>';
    if(c.estado === 'por_revisar' && c.docs && c.docs.faltan) h += '<span class="tagn ambar">' + (c.docs.faltan === 1 ? 'Falta 1 documento' : 'Faltan ' + c.docs.faltan + ' documentos') + '</span>';
    else if(c.estado === 'por_revisar' && c.docs && c.docs.total) h += '<span class="tagn azul">Documentos por aprobar</span>';
    if(c.puedo_hecho) h += '<span class="tagn azul">Te toca</span>';
    return h;
  }
  function filaCambio(c){
    const sub = [TIPO[c.tipo], codigos(c), c.nuevo ? 'A ' + c.nuevo.nombre : '', c.lider || (c.estado === 'sin_registro' ? 'Sin líder' : ''), fecha(c.fecha_cambio || c.creado_en)].filter(Boolean).join(' · ');
    const etq = etiquetas(c);
    return '<button type="button" class="fila" data-cambio="' + esc(c.id) + '"><span class="tx"><b>' + esc((c.titular && c.titular.nombre) || 'Titular sin nombre') + '</b><small>' + esc(sub) + '</small>' +
      (etq ? '<small class="etqs">' + etq + '</small>' : '') + '</span><span class="par-m">' + chip(c.estado) + '</span></button>';
  }
  function pintar(){
    if(!D || !activo) return;
    const P = D.puedo || {};
    if(!tab || (tab === 'sin_registro' && !P.sin_registro)) tab = tabInicial();
    const b = normalizeStr(busca); const dig = busca.replace(/\D/g, '');
    const ok = (c) => !b || normalizeStr(c.titular && c.titular.nombre).indexOf(b) >= 0 || normalizeStr(c.lider).indexOf(b) >= 0 || normalizeStr(c.nuevo && c.nuevo.nombre).indexOf(b) >= 0 ||
      (dig && ((c.servicios || []).some((s) => String(s.codigo).replace(/^0+/, '').indexOf(dig.replace(/^0+/, '')) >= 0) || String((c.titular && c.titular.doc) || '').indexOf(dig) >= 0));
    const fs = (D.filas || []).filter(ok);
    const f = $('filtros');
    if(f) f.innerHTML = TABS.filter((t) => t[0] !== 'sin_registro' || P.sin_registro).map((t) => {
      const n = fs.filter(t[0] === 'confirmado' ? (c) => c.estado === 'confirmado' : t[3]).length;
      const urge = n && ((t[0] === 'por_revisar' && P.revisar) || (t[0] === 'sin_registro') || (t[0] === 'por_emitir' && fs.some((c) => c.puedo_hecho)));
      return '<button type="button" role="tab" data-camtab="' + t[0] + '" aria-selected="' + (t[0] === tab) + '" class="' + (t[0] === tab ? 'on' : '') + '">' + esc(t[1]) + ' <em' + (urge ? ' class="rj"' : '') + '>' + n + '</em></button>'; }).join('');
    const T = TAB(tab); const a = $('ayuda'); if(a) a.textContent = T[2];
    let h = '<div class="cam-cab"><div class="cam-info">' + (D.indice ? 'TAD completo del ' + esc(fecha(D.indice.en)) + ' · ' + esc(C.hora(D.indice.en)) : '<span class="mal">Falta subir el TAD completo en Actualizar: sin él no se pueden buscar servicios.</span>') + '</div>' +
      '<button type="button" class="btn btn-chico" data-cam="nuevo">' + ic('mas') + 'Nuevo cambio</button></div>';
    const l = fs.filter(T[3]); const abiertos = l.filter((c) => !cerrado(c)); const cerrados = l.filter(cerrado);
    if(abiertos.length) h += '<div class="grupo abierto">' + abiertos.map(filaCambio).join('') + '</div>';
    if(cerrados.length) h += '<details class="cam-cerrados"><summary>Cancelados, errores y revertidos <em>' + cerrados.length + '</em></summary><div class="grupo abierto">' + cerrados.map(filaCambio).join('') + '</div></details>';
    if(!l.length){
      if(b) h += vacio('Sin resultados', 'Nada coincide con "' + busca + '" en ' + T[1] + '.');
      else if(!(D.filas || []).length) h += vacio('Sin cambios todavía', 'Toca Nuevo cambio para registrar una migración, un cambio de titular o un cambio a residencial.');
      else h += vacio('Nada en ' + T[1], 'Mira las otras pestañas.');
    }
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

  // ---------- Nuevo cambio: una sola pantalla con tres bloques y un botón ----------
  // Casillas que tocan según lo que cambia (las mismas que exige el servidor en privado.cambio_requisitos)
  function casillasQueTocan(){
    const t = N.tipo; if(!t || t === 'residencial') return [];
    const tt = titularElegido(); const actNat = tt ? /^[VE]/i.test(tt.doc_tipo || '') : false;
    const legal = (nat) => nat ? ['Cédula', 'RIF personal'] : ['RIF de la empresa', 'Acta constitutiva', 'Cédula y RIF del representante legal'];
    if(t === 'migracion') return legal(actNat);
    return ['Planilla de cambio de titular firmada', 'Cédula o RIF del titular actual'].concat(legal(N.natural).map((x) => x + ' del nuevo titular'));
  }
  function abrirNuevo(){
    N = { res: null, sel: {}, tipo: '', err: {}, natural: false, ocr: null, archivo: null, files: [] };
    hoja('hojaCambioN', 'tCamN').innerHTML = cab('tCamN', 'Nuevo cambio', 'Busca el servicio como está en el TAD') + '<div class="hoja-cuerpo" id="cCamN"></div>' +
      '<div class="hoja-pie"><button type="button" class="btn btn-2" data-cierra="1">Cancelar</button><button type="button" class="btn" data-cam="crear" id="camCrear">Registrar</button></div>';
    pintarNuevo(); abrirHoja('hojaCambioN');
    setTimeout(() => { const i = $('camBusca'); if(i) i.focus(); }, 300);
  }
  // El titular de hoy (el de los servicios marcados)
  function titularElegido(){
    const k = Object.keys(N.sel).find((x) => N.sel[x]); if(!k || !N.res) return null;
    return N.res.find((t) => t.servicios.some((s) => s.clave === k)) || null;
  }
  function pintarNuevo(){
    const z = $('cCamN'); if(!z || !N) return;
    const e = (k) => '<div class="error" id="eCam_' + k + '" role="alert">' + esc(N.err[k] || '') + '</div>';
    // 1. Servicio
    let h = '<section class="cam-sec"><h3 class="cam-h">1. Servicio</h3><label class="rotulo" for="camBusca">Código, nombre, cédula o RIF</label><div class="busca-linea"><input class="campo" id="camBusca" maxlength="60" autocomplete="off" enterkeyhint="search" value="' + esc(N.q || '') + '"><button type="button" class="btn btn-2 btn-chico" data-cam="buscar">Buscar</button></div>' + e('busca');
    if(N.buscando) h += '<p class="nota-chica"><span class="cargando-linea"><i></i>Buscando en el TAD…</span></p>';
    else if(N.res){
      if(!N.res.length) h += '<p class="nota-chica">No aparece en el TAD. Revisa el código o el nombre, o escribe el RIF sin guiones.</p>';
      N.res.forEach((t, i) => {
        h += '<div class="cam-tit"><b>' + esc(t.nombre || 'Sin nombre') + '</b><small>' + esc(C.docFmt(t.doc_tipo || '', t.doc_numero || '')) + ' · ' + plural(t.servicios.length, 'servicio', 'servicios') + '</small>' +
          t.servicios.map((s) => '<label class="cam-srv"><input type="checkbox" data-srv="' + esc(s.clave) + '" data-tit="' + i + '"' + (N.sel[s.clave] ? ' checked' : '') + '><span><b>' + esc(s.sucursal + '-' + s.codigo) + ' · ' + esc(C.sucursal(s.sucursal)) + '</b><small>' +
            esc([s.plan, s.categoria, s.estado].filter(Boolean).join(' · ')) + (s.empresa ? ' <span class="tagn verde">Empresa</span>' : '') + '</small><small>' + esc(s.direccion || 'Sin dirección') + '</small></span></label>').join('') + '</div>';
      });
    }
    h += e('servicios') + '</section>';
    // 2. Qué cambia
    h += '<section class="cam-sec"><h3 class="cam-h" id="rCamTipo">2. Qué cambia</h3><div class="cam-tipos" role="radiogroup" aria-labelledby="rCamTipo">' +
      ['migracion', 'titularidad', 'ambos', 'residencial'].map((t) => '<button type="button" role="radio" data-camtipo="' + t + '" aria-checked="' + (N.tipo === t) + '" class="cam-tipo' + (N.tipo === t ? ' on' : '') + '"><b>' + esc(TIPO[t]) + '</b><small>' + esc(AYUDA_TIPO[t]) + '</small></button>').join('') + '</div>' + e('tipo');
    if(N.tipo === 'residencial') h += '<label class="rotulo arriba" for="camMotivo">Motivo</label><textarea class="area corta" id="camMotivo" maxlength="500">' + esc(N.motivo || '') + '</textarea>' + e('motivo') +
      '<p class="nota-chica">Va directo al analista: no lleva documentos.</p>';
    h += '</section>';
    // 3. Nuevo titular y documentos
    const titular = N.tipo === 'titularidad' || N.tipo === 'ambos';
    if(titular){
      const o = N.ocr;
      h += '<section class="cam-sec"><h3 class="cam-h">3. Nuevo titular</h3>' +
        '<div class="cam-rif"><button type="button" class="btn btn-2 btn-ancho" data-cam="rif"' + (N.leyendo ? ' disabled' : '') + '>' + ic('subir') + (N.leyendo ? 'Leyendo el RIF…' : N.archivo ? 'Cambiar el RIF' : 'Subir RIF') + '</button>' +
        '<input type="file" id="camRifArchivo" accept="application/pdf,image/jpeg,image/png" hidden>' +
        (N.archivo ? '<p class="nota-chica">' + esc(N.archivo.name) + '. Queda en la casilla de RIF del nuevo titular al registrar.</p>' : '<p class="nota-chica">Llena el RIF, el nombre y el domicilio. Confírmalos antes de registrar.</p>') + '</div>';
      if(o && !N.leyendo){
        if(o.estado === 'ok' && !o.dudosa && /^rif_/.test(o.tipo || '')) h += '<div class="al-banda verde" role="status"><b>Leído del RIF</b><p>Revisa que esté bien y corrige si hace falta.</p></div>';
        else if(o.estado === 'ok' && /^rif_/.test(o.tipo || '')) h += '<div class="al-banda ambar" role="status"><b>Lectura dudosa</b><p>' + esc((o.datos && o.datos.motivos || []).join(', ') || 'Revisa cada dato') + '. Corrige lo que no esté bien.</p></div>';
        else if(o.estado === 'ok') h += '<div class="al-banda rojo" role="alert"><b>No corresponde a un RIF</b><p>El archivo parece ' + esc(o.tipo === 'cedula' ? 'una cédula' : 'otro documento') + '. Sube el RIF o escribe los datos.</p></div>';
        else h += '<div class="al-banda ambar" role="status"><b>No se pudo leer</b><p>' + esc(o.error || 'Google no devolvió el texto') + '. Escribe los datos; el archivo igual se guarda.</p></div>';
      }
      h += '<p class="rotulo arriba" id="rCamPer">Es</p><div class="cam-sol" role="radiogroup" aria-labelledby="rCamPer">' + [[false, 'Empresa'], [true, 'Persona natural']].map((x) =>
        '<button type="button" role="radio" data-camnat="' + x[0] + '" aria-checked="' + (N.natural === x[0]) + '" class="' + (N.natural === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div>';
      h += '<label class="rotulo arriba" for="camDoc">' + (N.natural ? 'Cédula o RIF' : 'RIF') + '</label><input class="campo" id="camDoc" maxlength="16" autocomplete="off" autocapitalize="characters" value="' + esc(N.doc || '') + '">' + e('doc') +
        '<label class="rotulo arriba" for="camNom">' + (N.natural ? 'Nombre completo' : 'Razón social') + '</label><input class="campo" id="camNom" maxlength="120" autocomplete="off" value="' + esc(N.nom || '') + '">' + e('nom') +
        '<label class="rotulo arriba" for="camDom">Domicilio fiscal</label><textarea class="area corta" id="camDom" maxlength="300">' + esc(N.dom || '') + '</textarea>';
      if(!N.natural) h += '<label class="rotulo arriba" for="camRepN">Nombre del representante legal</label><input class="campo" id="camRepN" maxlength="120" autocomplete="off" value="' + esc(N.repN || '') + '">' + e('repN') +
        '<label class="rotulo arriba" for="camRepC">Cédula del representante legal</label><input class="campo" id="camRepC" maxlength="12" inputmode="numeric" autocomplete="off" value="' + esc(N.repC || '') + '">' + e('repC');
      h += '<label class="rotulo arriba" for="camCorreo">Correo</label><input class="campo" id="camCorreo" type="email" maxlength="120" autocomplete="off" autocapitalize="none" value="' + esc(N.correo || '') + '">' + e('correo') +
        '<label class="rotulo arriba" for="camTel">Teléfono</label><input class="campo" id="camTel" type="tel" maxlength="20" inputmode="tel" autocomplete="off" value="' + esc(N.tel || '') + '">' + e('tel') + '</section>';
    }
    // Documentos: una zona para soltar varios archivos y las casillas que tocan
    const cas = casillasQueTocan();
    if(cas.length){
      h += '<section class="cam-sec"><h3 class="cam-h">' + (titular ? '4' : '3') + '. Documentos</h3>' +
        '<button type="button" class="soltar cam-soltar" data-cam="archivos" id="camSoltar">' + ic('subir', 'g') + '<b>' + (N.files.length ? plural(N.files.length, 'archivo listo', 'archivos listos') + '. Toca para agregar más' : 'Toca o suelta aquí los documentos') + '</b>Fotos o PDF. Al registrar marcas qué trae cada uno.</button>' +
        '<input type="file" id="camArchivos" accept="application/pdf,image/*" multiple hidden>' +
        (N.files.length ? '<ul class="cam-arch">' + N.files.map((f, i) => '<li><span>' + esc(f.name) + '</span><button type="button" class="enlace" data-cam-quitar="' + i + '">Quitar</button></li>').join('') + '</ul>' : '') +
        '<div class="cam-docs"><b>Casillas que tocan</b><ul>' + cas.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></div>' +
        '<p class="nota-chica">Quedan en el expediente del cliente, por revisar. Si falta alguno, se puede subir después desde el cambio.</p></section>';
    }
    h += '<section class="cam-sec"><label class="rotulo" for="camNota">Nota (opcional)</label><textarea class="area corta" id="camNota" maxlength="500">' + esc(N.nota || '') + '</textarea>' +
      (D && D.puedo && D.puedo.elegir_lider ? '<label class="rotulo arriba" for="camLiderN">Líder</label><select class="campo" id="camLiderN"><option value="">Sin líder</option>' + (D.lideres || []).map((l) => '<option value="' + esc(l.id) + '"' + (N.lider === l.id ? ' selected' : '') + '>' + esc(l.nombre) + '</option>').join('') + '</select>' : '') +
      e('general') + '</section>';
    z.innerHTML = h;
  }
  function leerCampos(){
    if(!N) return; const v = (id) => { const x = $(id); return x ? x.value : undefined; };
    [['camBusca', 'q'], ['camDoc', 'doc'], ['camNom', 'nom'], ['camDom', 'dom'], ['camNota', 'nota'], ['camMotivo', 'motivo'], ['camRepN', 'repN'], ['camRepC', 'repC'], ['camCorreo', 'correo'], ['camTel', 'tel'], ['camLiderN', 'lider']]
      .forEach((p) => { const x = v(p[0]); if(x !== undefined) N[p[1]] = x; });
  }
  async function buscar(){
    leerCampos(); N.err = {}; const t = String(N.q || '').trim();
    if(t.replace(/\D/g, '').length < 2 && normalizeStr(t).length < 3){ N.err.busca = 'Escribe al menos 3 letras, el código o el RIF'; pintarNuevo(); return; }
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
      if(d.rif){ N.natural = /^[VE]/.test(d.rif); N.doc = N.natural ? d.rif.charAt(0) + '-' + d.rif.slice(1, -1).replace(/^0+/, '') : d.rif.charAt(0) + '-' + d.rif.slice(1, 9) + '-' + d.rif.slice(9); }
      if(d.razon_social) N.nom = d.razon_social; if(d.domicilio) N.dom = d.domicilio;
    }
    pintarNuevo();
  }
  async function crear(b){
    leerCampos(); N.err = {};
    const claves = Object.keys(N.sel).filter((k) => N.sel[k]);
    if(!claves.length) N.err.servicios = 'Marca al menos un servicio';
    if(!N.tipo) N.err.tipo = 'Elige qué cambia';
    if(N.tipo === 'residencial' && String(N.motivo || '').trim().length < 4) N.err.motivo = 'Escribe el motivo';
    let letra = '';
    if(N.tipo === 'titularidad' || N.tipo === 'ambos'){
      const nat = N.natural;
      letra = (String(N.doc || '').match(/[VEJGPC]/i) || [nat ? 'V' : 'J'])[0].toUpperCase();
      if(String(N.doc || '').replace(/\D/g, '').length < 5) N.err.doc = 'Escribe ' + (nat ? 'la cédula o el RIF' : 'el RIF') + ' del nuevo titular';
      else if(nat && 'VE'.indexOf(letra) < 0) N.err.doc = 'Una persona natural lleva V o E';
      else if(!nat && 'VE'.indexOf(letra) >= 0) N.err.doc = 'Una empresa lleva J, G, C o P';
      if(String(N.nom || '').trim().length < 3) N.err.nom = 'Escribe ' + (nat ? 'el nombre' : 'la razón social');
      if(!nat && String(N.repN || '').trim().length < 3) N.err.repN = 'Escribe el nombre del representante legal';
      if(!nat && String(N.repC || '').replace(/\D/g, '').length < 5) N.err.repC = 'Escribe la cédula del representante legal';
      if(N.correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(N.correo).trim())) N.err.correo = 'Revisa el correo';
      if(N.tel && String(N.tel).replace(/\D/g, '').length < 10) N.err.tel = 'Revisa el teléfono';
    }
    if(Object.keys(N.err).length){ pintarNuevo(); const p = document.querySelector('#cCamN .error:not(:empty)'); if(p) p.scrollIntoView({ block: 'center' }); return; }
    b.disabled = true; b.textContent = 'Guardando…';
    const o = N.ocr; const arch = N.archivo; const nat = N.natural; const files = N.files.slice(); const tipo = N.tipo;
    const titular = tipo === 'titularidad' || tipo === 'ambos';
    try {
      const id = await rpc('cambio_crear', { p_datos: { tipo, servicios: claves, nota: N.nota || null, motivo: tipo === 'residencial' ? String(N.motivo).trim() : null, lider_id: N.lider || null,
        nuevo: titular ? { tipo: letra, doc: N.doc, nombre: N.nom, natural: nat, domicilio: String(N.dom || '').trim() || null, correo: String(N.correo || '').trim() || null, telefono: String(N.tel || '').trim() || null,
          rep_nombre: nat ? null : String(N.repN || '').trim(), rep_cedula: nat ? null : String(N.repC || '').trim(), ocr: o ? { estado: o.estado, tipo: o.tipo || null, dudosa: !!o.dudosa } : null } : null } });
      toast(tipo === 'residencial' ? 'Cambio registrado. Le llega al analista' : 'Cambio registrado. El administrador revisa los documentos');
      N = null; cerrarHoja(true); D = null; await cargar();
      await abrirDetalle(Number(id), { planilla: titular });
      // El RIF leído va a su casilla y los demás archivos se marcan uno por uno en el expediente
      if(arch) await guardarRif(Number(id), arch, nat);
      if(files.length) subirVarios(files);
    } catch (e) { if(N){ N.err.general = e.message; pintarNuevo(); } else toast(e.message, 'error'); b.disabled = false; b.textContent = 'Registrar'; }
  }
  // Ficha del cliente donde van los documentos del cambio, con las casillas del cambio de titular
  async function fichaDestino(d){
    const cli = d.tipo === 'migracion' ? d.cliente_id : d.nuevo && d.nuevo.cliente_id; if(!cli) return null;
    const F = await rpc('cliente_ficha', { p_cliente: cli });
    if(d.tipo === 'titularidad' || d.tipo === 'ambos') F.extraCasillas = [{ k: 'otro:80', t: 'Planilla de cambio de titular firmada' }, { k: 'otro:81', t: 'Cédula o RIF del titular actual' }];
    return F;
  }
  async function guardarRif(idCambio, arch, nat){
    try {
      const d = V && V.id === idCambio && V.d ? V.d : await rpc('cambio_detalle', { p_id: idCambio }); if(!d.nuevo || !d.nuevo.cliente_id) return;
      const F = await fichaDestino(d); const cas = nat ? 'rif_personal' : 'rif_empresa'; const num = nat ? 1 : 0;
      // Si el nuevo titular ya existía y tiene su RIF, no se pisa sin que alguien lo vea
      if((F.documentos || []).some((x) => x.casilla === cas && x.numero === num)){ toast('El nuevo titular ya tiene RIF en su expediente. Si este es más nuevo, súbelo desde su expediente'); return; }
      if(!window.Ficha.subirArchivoA(F, cas, num, arch, () => { if(V && V.id === idCambio) cargarDetalle(); cargar(); })) toast('El cambio quedó registrado, pero el RIF no se guardó porque hay otra subida en curso. Súbelo desde el cambio', 'error');
    } catch (e) { toast('El cambio quedó registrado, pero el RIF no se guardó: ' + e.message + '. Súbelo desde el cambio', 'error'); }
  }
  async function subirVarios(files){
    if(!V || !V.d) return;
    try { const F = await fichaDestino(V.d); if(!F) return; window.Ficha.variosA(F, () => { cargarDetalle(); cargar(); }, files); }
    catch (e) { toast('No se pudieron preparar los documentos: ' + e.message + '. Súbelos desde el cambio', 'error'); }
  }

  // ---------- Detalle: estado, servicios, documentos, planilla, acciones y bitácora ----------
  async function abrirDetalle(id, o){
    V = { id, d: null, planilla: !!(o && o.planilla) };
    hoja('hojaCambio', 'tCam').innerHTML = cab('tCam', 'Cambio', '') + '<div class="hoja-cuerpo" id="cCam"><div class="sk-bloque"><span class="sk" style="height:64px;border-radius:16px"></span><span class="sk" style="height:64px;border-radius:16px"></span></div></div><div class="hoja-pie hidden" id="pCam"></div>';
    abrirHoja('hojaCambio'); await cargarDetalle();
  }
  async function cargarDetalle(){
    if(!V) return; const mio = V;
    try { const d = await rpc('cambio_detalle', { p_id: V.id }); if(V !== mio) return; V.d = d; pintarDetalle(); }
    catch (e) { if(V !== mio) return; const z = $('cCam'); if(z) z.innerHTML = '<div class="vacio" role="alert"><b>No se pudo abrir el cambio</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" data-cam="reDetalle">Reintentar</button></div>'; }
  }
  const fila = (etq, valor) => '<div class="dato-f"><span>' + esc(etq) + '</span><b>' + valor + '</b></div>';
  const ESTADO_DOC = { aprobado: ['verde', 'Aprobado'], por_revisar: ['ambar', 'Por revisar'], devuelto: ['rojo', 'Devuelto'], falta: ['rojo', 'Falta'] };
  function siguePaso(d){
    if(d.estado === 'por_revisar') return d.docs && d.docs.faltan ? 'Faltan documentos. Súbelos aquí abajo; el administrador los revisa en el expediente.' : 'El administrador revisa los documentos. Al aprobarlos pasa solo al analista.';
    if(d.estado === 'por_emitir') return d.puedo_hecho ? 'Hazlo en Proham (plan y categoría a la vez) y toca Hecho.' : 'El analista del líder lo hace en Proham y marca Hecho.';
    if(d.estado === 'por_confirmar') return d.aviso ? AVISO[d.aviso] + ' en Proham. Se confirma con la siguiente carga del TAD.' : 'Se confirma solo con la siguiente carga del TAD completo.';
    if(d.estado === 'confirmado') return d.pagado_fuera ? 'Histórico: se pagó fuera de la app. No entra al corte.' : d.tipo === 'residencial' ? 'Cuenta como indicador negativo del líder.' : d.comision === 'si' ? 'Comisiona en el corte con la regla de siempre (Legal y pago).' : 'No comisiona.';
    if(d.estado === 'sin_registro') return 'El TAD lo muestra sin registro en la app. Asígnalo a un líder, o márcalo como error o revertido.';
    return d.cierre_nota || '';
  }
  function pintarDetalle(){
    const d = V.d; const P = (D && D.puedo) || {}; const e = ESTADO[d.estado] || ['', d.estado];
    $('tCam').textContent = TIPO[d.tipo] || 'Cambio';
    let h = '<div class="estado ' + (e[0] || 'gris') + '"><b>' + esc(e[1]) + '</b><small>' + esc(siguePaso(d)) + '</small></div>';
    if(window.Contacto) h += window.Contacto.boton('cambio', d.id || V.id, '', d.estado + ':' + (d.aviso || ''));   // Lote A: contactar a quien tiene el paso
    if(d.aviso && d.estado !== 'confirmado') h += '<div class="al-banda ambar" role="note"><b>' + esc(AVISO[d.aviso]) + '</b><p>El TAD ya muestra ' + (d.aviso === 'falta_plan' ? 'la categoría PYME, pero el plan sigue siendo residencial.' : 'el plan EMP, pero la categoría sigue siendo residencial.') + ' Pide que lo completen en Proham.</p></div>';
    if(d.tipo === 'residencial' && d.motivo) h += '<div class="al-banda rojo" role="note"><b>Cambio a residencial</b><p>' + esc(d.motivo) + '</p></div>';
    const t = d.titular || {};
    h += '<div class="datos">' + fila(d.nuevo ? 'Titular actual' : 'Titular', esc(t.nombre || 'Sin nombre') + ' <small>' + esc(C.docFmt(t.tipo || '', t.doc || '')) + '</small>') +
      (d.nuevo ? fila('Nuevo titular', esc(d.nuevo.nombre) + ' <small>' + esc(C.docFmt(d.nuevo.tipo || '', d.nuevo.doc || '')) + '</small>') +
        (d.nuevo.rep_nombre ? fila('Representante legal', esc(d.nuevo.rep_nombre) + (d.nuevo.rep_cedula ? ' <small>V-' + esc(d.nuevo.rep_cedula) + '</small>' : '')) : '') : '') +
      (d.categoria_anterior || d.categoria_nueva ? fila('Categoría', esc((d.categoria_anterior || '?') + ' a ' + (d.categoria_nueva || '?'))) : '') +
      (d.plan_anterior || d.plan_nuevo ? fila('Plan', esc((d.plan_anterior || '?') + ' a ' + (d.plan_nuevo || '?'))) : '') +
      fila('Líder', esc(d.lider || 'Sin líder')) +
      fila('Registro', esc(d.origen === 'historico' ? 'Histórico del consolidado' : d.origen === 'tad' ? 'Visto en el TAD, ' + fecha(d.creado_en) : (d.creado_por || '') + ', ' + fecha(d.creado_en))) +
      (d.fecha_cambio ? fila('Fecha del cambio', esc(fecha(d.fecha_cambio))) : '') +
      (d.emitido_en ? fila('Hecho en Proham', esc((d.emitido_por || '') + ', ' + fecha(d.emitido_en))) : '') +
      (d.nota ? fila('Nota', esc(d.nota)) : '') + '</div>';
    h += '<div class="secc">Servicios<span class="der">' + (d.servicios || []).length + '</span></div><div class="datos">' + (d.servicios || []).map((s) => fila((s.sucursal ? s.sucursal + '-' : '') + s.codigo,
      esc([s.plan, s.categoria, s.equipo ? 'Equipo ' + s.equipo : ''].filter(Boolean).join(' · ')) + '<small class="ded-gris"> ' + esc(s.direccion || '') + '</small>')).join('') + '</div>';
    // Documentos del cambio, con su estado en el expediente
    const req = d.requisitos || [];
    if(req.length){
      const falta = req.filter((r) => r.estado === 'falta' || r.estado === 'devuelto').length;
      const abierto = ['por_revisar', 'por_emitir', 'por_confirmar', 'sin_registro'].indexOf(d.estado) >= 0 || (d.origen === 'historico' && falta);
      h += '<div class="secc">Documentos<span class="der">' + (falta ? (falta === 1 ? 'Falta 1' : 'Faltan ' + falta) : req.every((r) => r.estado === 'aprobado') ? 'Aprobados' : 'Por revisar') + '</span></div>' +
        '<p class="nota-chica">Van al expediente de ' + esc(d.tipo === 'migracion' ? 'este cliente' : 'el nuevo titular') + '.</p>' +
        req.map((r) => { const x = ESTADO_DOC[r.estado] || ['', r.estado]; return '<div class="chk"><i class="' + (r.estado === 'aprobado' ? 'ok">' + ic('check') : 'no">') + '</i><span>' + esc(r.texto) + ' <span class="chip ' + x[0] + '">' + esc(x[1]) + '</span></span>' +
          ((r.estado === 'falta' || r.estado === 'devuelto') && abierto ? '<button type="button" class="mini pri" data-cam-subir="' + esc(r.casilla + ':' + r.numero) + '">Subir</button>' : '') + '</div>'; }).join('') +
        (abierto && falta ? '<button type="button" class="btn btn-chico btn-2" data-cam="varios" style="margin-top:10px">' + ic('subir') + 'Subir varios</button>' : '') +
        ((d.tipo === 'migracion' ? d.cliente_id : d.nuevo && d.nuevo.cliente_id) ? '<button type="button" class="exp" data-cam="expediente"><span>Abrir expediente<small>Documentos, contacto e hilo</small></span>' + ic('derecha', 'ch') + '</button>' : '');
    }
    if((d.tipo === 'titularidad' || d.tipo === 'ambos') && d.nuevo){
      h += '<div class="secc">Planilla de cambio de titular</div>' + (V.planilla ? '<div class="al-banda verde" role="status"><b>Planilla lista</b><p>Descárgala o envíala por WhatsApp para que la firmen los dos titulares.</p></div>' : '') +
        '<p class="nota-chica">La oficial, con los datos del cambio. Se imprime, la firman y ponen las huellas ambos titulares, y se sube en Documentos.</p>' +
        '<div class="acc-prof"><button type="button" class="mini" data-cam="planilla">' + ic('doc') + 'Descargar</button><button type="button" class="mini pri" data-cam="planillaWa">' + ic('wa') + 'Enviar por WhatsApp</button></div>';
    }
    if(d.estado === 'sin_registro' && P.sin_registro) h += '<div class="secc">¿De quién es?</div><label class="rotulo" for="camLider">Asignar a un líder</label><select class="campo" id="camLider"><option value="">Elige el líder</option>' +
      ((D && D.lideres) || []).map((l) => '<option value="' + esc(l.id) + '">' + esc(l.nombre) + '</option>').join('') + '</select><div class="error" id="eCamLider" role="alert"></div>' +
      '<p class="nota-chica">Al asignarlo entra al flujo con sus documentos. Un cambio a residencial queda confirmado como indicador negativo del líder.</p>';
    const notaAcc = (d.estado === 'por_revisar' && P.revisar) || d.estado === 'sin_registro' || ((d.estado === 'por_emitir' || d.estado === 'por_confirmar') && P.confirmar) || puedeCancelar(d);
    if(notaAcc) h += '<label class="rotulo arriba" for="camNotaAcc">Nota</label><textarea class="area corta" id="camNotaAcc" maxlength="500"></textarea><div class="error" id="eCamAcc" role="alert"></div>';
    h += '<div class="secc">Qué ha pasado</div>' + ((d.bitacora || []).length ? '<div class="datos">' + d.bitacora.map((x) => fila(fecha(x.en) + ' ' + C.hora(x.en), esc(TEXTO_BIT[x.accion] || x.accion) + (x.por ? ' · ' + esc(C.primerNombre(x.por)) : ''))).join('') + '</div>' : '<p class="nota-chica">Sin movimientos.</p>');
    $('cCam').innerHTML = h; if(window.Contacto) window.Contacto.llenar($('cCam'));
    // Acciones según el estado y quién mira
    const acc = [];
    if(puedeCancelar(d)) acc.push(['cancelar', 'Cancelar', 'btn-2']);
    if(d.estado === 'por_revisar' && P.revisar) acc.push(['pasar', 'Pasar al analista', 'btn-2']);
    if((d.estado === 'por_emitir' || d.estado === 'por_confirmar') && P.confirmar) acc.push(['confirmar', 'Confirmar a mano', 'btn-2']);
    if(d.puedo_hecho) acc.push(['hecho', 'Hecho', '']);
    if(d.estado === 'sin_registro' && P.sin_registro){ acc.push(['error', 'Fue un error', 'btn-2']); acc.push(['revertido', 'Revertido', 'btn-2']); acc.push(['asignar', 'Asignar', '']); }
    const p = $('pCam'); p.classList.toggle('hidden', !acc.length);
    p.innerHTML = acc.map((a) => '<button type="button" class="btn ' + a[2] + '" data-cam-acc="' + a[0] + '">' + esc(a[1]) + '</button>').join('');
  }
  const puedeCancelar = (d) => (d.estado === 'por_revisar' || d.estado === 'por_emitir') && !!yo && (yo.rol === 'admin' || d.creado_por === yo.nombre);
  const TEXTO_BIT = { cambio_creado: 'Registró el cambio', cambio_docs_aprobados: 'Documentos aprobados: pasó al analista', cambio_pasar: 'Lo pasó al analista', cambio_hecho: 'Marcó Hecho en Proham',
    cambio_cancelar: 'Canceló', cambio_confirmar: 'Confirmó a mano', cambio_confirmado: 'Quedó confirmado', cambio_asignar: 'Lo asignó a un líder', cambio_error: 'Marcó que fue un error',
    cambio_revertido: 'Marcó revertido', cambio_sin_registro: 'El TAD lo mostró sin registro', cambio_historico: 'Cargado del histórico' };
  async function accion(b, a){
    const d = V.d; const nota = $('camNotaAcc') ? $('camNotaAcc').value.trim() : ''; const er = $('eCamAcc'); if(er) er.textContent = '';
    let lider = null;
    if(a === 'asignar'){ lider = $('camLider').value; if(!lider){ $('eCamLider').textContent = 'Elige el líder'; $('camLider').focus(); return; } }
    if((a === 'pasar' || a === 'confirmar') && !nota){ if(er){ er.textContent = a === 'pasar' ? 'Escribe por qué pasa sin todos los documentos aprobados' : 'Escribe por qué se confirma a mano'; $('camNotaAcc').focus(); } return; }
    const txt = b.textContent; b.disabled = true; b.textContent = 'Guardando…';
    try {
      await rpc('cambio_accion', { p_id: d.id, p_accion: a, p_nota: nota || null, p_lider: lider });
      toast({ hecho: 'Listo. Se confirma con la siguiente carga del TAD', pasar: 'Pasó al analista', cancelar: 'Cambio cancelado', confirmar: 'Confirmado',
        asignar: 'Asignado al líder', error: 'Marcado como error', revertido: 'Marcado como revertido' }[a] || 'Listo');
      cargar(); cargarDetalle();
    } catch (e) { if(er) er.textContent = e.message; else toast(e.message, 'error'); b.disabled = false; b.textContent = txt; }
  }
  // Planilla oficial con los datos del momento: titular actual del TAD (y del expediente si ya es cliente), nuevo titular de lo que escribió el líder
  function datosPlanilla(){
    const d = V.d; const t = d.titular || {}; const n = d.nuevo || {}; const ka = d.actual_contacto || {}; const kn = d.nuevo_contacto || {}; const s = (d.servicios || [])[0] || {};
    const hoy = new Date(); const dd = (x) => String(x).padStart(2, '0');
    return { tipo: (t.natural ? 'natural' : 'juridico') + '_' + (n.natural ? 'natural' : 'juridico'), servicio: (d.servicios || []).map((x) => x.sucursal + '-' + x.codigo).join(', '),
      ubicacion: s.direccion || ka.direccion || '', fecha: dd(hoy.getDate()) + '/' + dd(hoy.getMonth() + 1) + '/' + hoy.getFullYear(),
      actual: { nombre: t.nombre, doc: C.docFmt(t.tipo || '', t.doc || ''), natural: t.natural === null || t.natural === undefined ? undefined : !!t.natural, direccion: ka.direccion || '', correo: ka.correo || '', telefono: ka.telefono || '' },
      nuevo: { nombre: n.nombre, doc: C.docFmt(n.tipo || '', n.doc || ''), natural: !!n.natural, direccion: kn.direccion || n.domicilio || '', correo: kn.correo || n.correo || '', telefono: kn.telefono || n.telefono || '' } };
  }
  async function archivoPlanilla(){
    const blob = await window.Documentos.planillaTitular(datosPlanilla());
    const nom = window.Documentos.nombreArchivo('cambio-de-titular', (V.d.titular || {}).nombre || 'cliente');
    return new File([blob], nom, { type: 'application/pdf' });
  }
  function puedeCompartir(){ try { return window.matchMedia('(pointer: coarse)').matches && !!navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] }); } catch (e) { return false; } }
  async function descargarPlanilla(){
    try { const f = await archivoPlanilla(); window.Archivos.descargar(f, f.name); toast('Planilla descargada'); }
    catch (e) { toast(navigator.onLine === false ? 'Sin conexión: no se pudo traer la plantilla' : 'No se pudo armar la planilla. Intenta de nuevo', 'error'); }
  }
  async function enviarPlanilla(){
    let f; try { f = await archivoPlanilla(); } catch (e) { toast(navigator.onLine === false ? 'Sin conexión: no se pudo traer la plantilla' : 'No se pudo armar la planilla. Intenta de nuevo', 'error'); return; }
    const texto = 'Hola. Te envío la planilla de cambio de titular del servicio ' + datosPlanilla().servicio + '. Por favor imprímela, fírmenla con sus huellas los dos titulares y envíamela con la copia de la cédula o el RIF de ambos.';
    if(puedeCompartir()){
      try { await navigator.share({ files: [f], text: texto }); } catch (e) { if(!(e && e.name === 'AbortError')) toast('No se pudo abrir Compartir. Intenta de nuevo', 'error'); }
    } else { window.Archivos.descargar(f, f.name); window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank', 'noopener'); }
  }
  // Subir un documento del cambio al expediente que le toca
  async function subir(cas, num){
    let F; try { F = await fichaDestino(V.d); } catch (e) { toast(e.message, 'error'); return; }
    if(F) window.Ficha.subirA(F, cas, num, () => { cargarDetalle(); cargar(); });
  }
  function agregarArchivos(lista){
    const nuevos = Array.from(lista || []).filter((f) => /^image\//.test(f.type) || f.type === 'application/pdf' || /\.(jpe?g|png|webp|heic|heif|pdf)$/i.test(f.name));
    if(nuevos.length < (lista || []).length) toast('Solo fotos o PDF', 'error');
    if(N.files.length + nuevos.length > 30){ toast('Sube hasta 30 archivos de una vez', 'error'); return; }
    leerCampos(); N.files = N.files.concat(nuevos); pintarNuevo();
  }

  document.addEventListener('click', (ev) => {
    const t = ev.target; let b;
    if((b = t.closest('[data-cam]'))){
      const a = b.dataset.cam;
      if(a === 'rif'){ const i = $('camRifArchivo'); if(i){ i.value = ''; i.click(); } return; }
      if(a === 'archivos'){ const i = $('camArchivos'); if(i){ i.value = ''; i.click(); } return; }
      if(a === 'nuevo') abrirNuevo(); else if(a === 'buscar') buscar(); else if(a === 'crear') crear(b); else if(a === 'reintentar') cargar(); else if(a === 'reDetalle') cargarDetalle();
      else if(a === 'planilla') descargarPlanilla();
      else if(a === 'planillaWa') enviarPlanilla();
      else if(a === 'varios') subirVarios([]);
      else if(a === 'expediente' && V && V.d){ const cli = V.d.tipo === 'migracion' ? V.d.cliente_id : V.d.nuevo && V.d.nuevo.cliente_id; if(cli) window.Ficha.abrir(cli, { yo, tab: 'documentos', alCerrar: cargarDetalle }); }
      return;
    }
    if((b = t.closest('[data-cambio]'))){ abrirDetalle(Number(b.dataset.cambio)); return; }
    if((b = t.closest('[data-cam-acc]'))){ accion(b, b.dataset.camAcc); return; }
    if((b = t.closest('[data-camtab]'))){ tab = b.dataset.camtab; guardarUrl(); pintar(); return; }
    if((b = t.closest('[data-cam-subir]'))){ const p = b.dataset.camSubir.split(':'); subir(p[0], Number(p[1])); return; }
    if((b = t.closest('[data-cam-quitar]')) && N){ leerCampos(); N.files.splice(Number(b.dataset.camQuitar), 1); pintarNuevo(); return; }
    if((b = t.closest('[data-camtipo]')) && N){ leerCampos(); N.tipo = b.dataset.camtipo; N.err.tipo = ''; pintarNuevo(); return; }
    if((b = t.closest('[data-camnat]')) && N){ leerCampos(); N.natural = b.dataset.camnat === 'true'; pintarNuevo(); return; }
  });
  document.addEventListener('change', (ev) => {
    if(ev.target && ev.target.id === 'camRifArchivo' && N){ const f = ev.target.files && ev.target.files[0]; if(f) leerRif(f); return; }
    if(ev.target && ev.target.id === 'camArchivos' && N){ agregarArchivos(ev.target.files); return; }
    const x = ev.target.closest('[data-srv]'); if(!x || !N) return;
    // Los servicios de un cambio son de un solo titular
    const tit = x.dataset.tit;
    if(x.checked) Object.keys(N.sel).forEach((k) => { const o = document.querySelector('[data-srv="' + k + '"]'); if(o && o.dataset.tit !== tit){ N.sel[k] = false; o.checked = false; } });
    N.sel[x.dataset.srv] = x.checked; const er = $('eCam_servicios'); if(er) er.textContent = '';
    if(N.tipo){ leerCampos(); pintarNuevo(); }   // el titular elegido dice qué casillas tocan
  });
  // Soltar archivos sobre la zona de documentos
  document.addEventListener('dragover', (ev) => { if(ev.target.closest && ev.target.closest('#camSoltar')){ ev.preventDefault(); ev.target.closest('#camSoltar').classList.add('sobre'); } });
  document.addEventListener('dragleave', (ev) => { const z = ev.target.closest && ev.target.closest('#camSoltar'); if(z) z.classList.remove('sobre'); });
  document.addEventListener('drop', (ev) => { const z = ev.target.closest && ev.target.closest('#camSoltar'); if(!z || !N) return; ev.preventDefault(); z.classList.remove('sobre'); agregarArchivos(ev.dataTransfer && ev.dataTransfer.files); });
  document.addEventListener('keydown', (ev) => { if(ev.key === 'Enter' && ev.target && ev.target.id === 'camBusca'){ ev.preventDefault(); buscar(); } });

  // Página Migraciones
  let tBusca = null;
  const bq = $('busca');
  const fb = $('formBusca'); if(fb) fb.addEventListener('submit', (e) => { e.preventDefault(); if(bq) bq.blur(); });
  if(bq) bq.addEventListener('input', () => { clearTimeout(tBusca); tBusca = setTimeout(() => { busca = bq.value.trim(); guardarUrl(); pintar(); }, 140); });
  window.Armazon.arrancar(['admin', 'analista', 'lider'], { activo: 'migraciones' }, (p) => {
    yo = p; activo = true; window.Ficha.montar(); leerUrl();
    if(window.Resumen) window.Resumen.enModulo({ modulo: 'migraciones', yo: p });   // lote 27/10
    busca = (new URLSearchParams(location.search).get('q') || '').slice(0, 60); if(bq) bq.value = busca;
    if(!D){ const g = C.cache.leer('cambios:' + p.rol); if(g) D = g; }
    if(D) pintar(); cargar();
  }, (p) => { yo = p; });
})();
