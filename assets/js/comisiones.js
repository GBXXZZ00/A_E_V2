// Comisiones (lote 28/10, maqueta claude/maquetas/comisiones-28oct): tarjetas Instalaciones PYME | Cambios de categoría | Cartas y proformas,
// pestañas por equipo (Ventas corporativas, Canales de atención, Aliados comerciales), avisos Por instalar y Por asignar,
// "Subir documentos de un cliente nuevo", chips y listas desplegables por dueño. Tocar un cliente abre la hoja de comisión.
(function(){
  'use strict';
  const { $, esc, ic, rpc, toast, cache, esqueleto, vacio, fecha, mes, capital, plural, chipEstatus, docFmt, abrirHoja, cerrarHoja, hojaAbierta, casilla, MOTIVOS, primerNombre, dia, hora, normalizeStr } = window.Comun;
  const S = window.Sesion;
  const FILTROS = [
    { id: 'todos', t: 'Todas' }, { id: 'comisionan', t: 'Comisionan' }, { id: 'legal', t: 'Falta legal' }, { id: 'pago', t: 'Sin pago' },
    { id: 'ultimo', t: 'Del corte anterior' }, { id: 'pendientes', t: 'Pendientes por instalar' }, { id: 'asignar', t: 'Por asignar' }, { id: 'subir', t: 'Archivos por subir' }, { id: 'eventos', t: 'Eventos' }
  ];
  // Filtros que solo salen cuando tienen algo (o están elegidos)
  const OPCIONALES = ['asignar', 'subir', 'eventos', 'pendientes'];
  const EQUIPOS = [['corporativas', 'Ventas corporativas'], ['canales', 'Canales de atención'], ['aliados', 'Aliados comerciales']];
  const TOPE = 12;   // filas por dueño antes de "Ver más"
  let yo = null; let d = null; let filtro = 'todos'; let corte = ''; let pedido = 0; let busca = ''; let equipo = ''; let seg = 'inst';
  const abiertos = {}; const completos = {};

  function leerUrl(){
    const u = new URLSearchParams(location.search);
    const f = u.get('f'); filtro = FILTROS.some((x) => x.id === f) ? f : 'todos';
    busca = (u.get('q') || '').slice(0, 60);
    const e = u.get('e'); equipo = EQUIPOS.some((x) => x[0] === e) ? e : '';
    const t = u.get('t') || '';
    seg = t === 'cartas' || t === 'cambios' ? t : 'inst';
    if(t === 'por_asignar' || t === 'sin_lider') filtro = 'asignar';
    pedidoInicial = ['instalar', 'sin_instalar', 'por_instalar'].indexOf(t) >= 0 ? 'por_instalar' : t === 'nuevo' ? 'nuevo' : '';
    const c = u.get('c'); corte = /^\d{4}-(0[1-9]|1[0-2])/.test(c || '') ? c.slice(0, 7) + '-01' : '';
  }
  let pedidoInicial = '';
  function guardarUrl(){
    const u = new URLSearchParams();
    if(seg !== 'inst') u.set('t', seg);
    if(equipo && seg === 'inst') u.set('e', equipo);
    if(filtro !== 'todos' && seg === 'inst') u.set('f', filtro);
    if(busca) u.set('q', busca);
    if(d && corte && corte !== d.actual) u.set('c', corte.slice(0, 7));
    if(new URLSearchParams(location.search).get('v') === 'resumen') u.set('v', 'resumen');
    const s = u.toString();
    history.replaceState(history.state, '', location.pathname + (s ? '?' + s : ''));
  }
  const nombreCorte = (c) => capital(mes(c + 'T12:00:00Z')) + ' ' + String(c).slice(0, 4);
  function menosMeses(c, n){ let a = Number(c.slice(0, 4)); let m = Number(c.slice(5, 7)) - n; while(m < 1){ m += 12; a--; } return a + '-' + String(m).padStart(2, '0') + '-01'; }
  const ordenCorta = (o) => String(o || '').split('/').pop();
  const diaMes = (x) => { const t = new Date(x); return isNaN(t) ? '' : String(t.getDate()).padStart(2, '0') + '/' + String(t.getMonth() + 1).padStart(2, '0'); };
  const hace = (x) => { const t = new Date(x); if(isNaN(t)) return ''; const n = Math.max(0, Math.floor((Date.now() - t.getTime()) / 86400000)); return n === 0 ? 'hoy' : 'hace ' + plural(n, 'día', 'días'); };
  const iniciales = (n) => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();

  // El buscador mira nombre, dueño, RIF o cédula, código y número de orden
  function coincide(f){
    const b = normalizeStr(busca); if(!b) return true;
    const dg = busca.replace(/\D/g, '');
    return normalizeStr(f.nombre).indexOf(b) >= 0 || normalizeStr(f.lider || f.dueno).indexOf(b) >= 0 ||
      (dg.length >= 3 && (String(f.doc || '').replace(/\D/g, '').indexOf(dg) >= 0 || String(f.codigo || '').indexOf(dg) >= 0 || String(f.orden || '').replace(/\D/g, '').indexOf(dg) >= 0));
  }
  const esLider = () => !!yo && yo.rol === 'lider';
  // Pestañas que ve cada uno: el líder lo suyo y Aliados; administrador y Canales, todo
  function equiposVisibles(){
    if(!d) return [];
    if(esLider()){ const mio = (d.yo && d.yo.equipo) || 'corporativas'; return EQUIPOS.filter((x) => x[0] === mio || x[0] === 'aliados'); }
    return EQUIPOS;
  }
  const deEquipo = (f, e) => f.equipo === e || (e === 'corporativas' && (f.equipo === 'sin_dueno' || !f.equipo));
  const filasInst = (e) => (e === 'aliados' ? (d.aliados || []) : d.filas.filter((f) => !f.migracion && deEquipo(f, e)));
  const pendInst = (e) => (e === 'aliados' ? [] : (d.pendientes || []).filter((p) => deEquipo(p, e)).map((p) => Object.assign({ pend: true, lider: p.dueno }, p)));
  const cartaPend = (f) => f.carta && ['por_enviar', 'falta_ip', 'lider'].indexOf(f.carta.k) >= 0;
  const todasCorte = () => d.filas.concat(d.aliados || []);
  const porAsignar = () => (d ? d.filas.filter((f) => !f.orden_ok).length : 0);
  function pasa(f){
    if(f.pend) return filtro === 'todos' || filtro === 'pendientes';
    if(filtro === 'pendientes') return false;
    if(filtro === 'comisionan') return !!f.cumple;
    if(filtro === 'asignar') return !f.orden_ok && f.equipo !== 'aliados';
    if(filtro === 'ultimo') return f.origen === 'anterior';
    if(filtro === 'legal') return !f.legal_ok;
    if(filtro === 'pago') return !f.pago_ok;
    if(filtro === 'subir') return !!f.por_subir;
    return true;
  }
  function filasVista(){
    if(seg === 'cambios') return d.filas.filter((f) => f.migracion);
    if(seg === 'cartas') return todasCorte().filter((f) => f.origen === 'corte' && cartaPend(f));
    if(filtro === 'asignar') return d.filas.filter((f) => !f.orden_ok);
    return filasInst(equipo).concat(pendInst(equipo));
  }
  function conteo(id){
    if(!d) return '';
    if(id === 'eventos') return (d.eventos || []).length;
    const g = filtro; filtro = id; const n = (id === 'asignar' ? d.filas.filter((f) => !f.orden_ok) : filasInst(equipo).concat(pendInst(equipo))).filter(pasa).length; filtro = g; return n;
  }

  function pintarCorte(){
    const actual = d ? d.actual : corte; if(!actual) return;
    const sig = d && d.siguiente ? d.siguiente : null;
    const ops = (sig ? [sig] : []).concat([0, 1, 2, 3, 4, 5].map((n) => menosMeses(actual, n)));
    const elegido = d ? d.corte : corte; if(elegido && ops.indexOf(elegido) < 0) ops.push(elegido);
    $('corte').innerHTML = ops.map((c) => '<option value="' + c + '"' + (c === (d ? d.corte : corte) ? ' selected' : '') + '>' + esc(nombreCorte(c)) + (c === actual ? ' (en curso)' : c === sig ? ' (siguiente)' : '') + '</option>').join('');
  }
  function pintarRango(){
    const enCurso = d.corte === d.actual; const sig = !!d.siguiente && d.corte === d.siguiente;
    const lim = fecha(d.limite || d.fin).split(' de ')[0];
    // Lote urgente 20/10: el corte se cierra a mano; el día límite es un aviso
    $('rango').textContent = 'Del ' + fecha(d.inicio) + ' al ' + fecha(d.fin) + '. ' + (d.certificado ? 'Corte cerrado.'
      : sig ? 'Corte siguiente: empieza a contar cuando se cierre el de ' + mes(d.actual) + '.'
      : enCurso ? (d.dias > 0 ? 'Día límite el ' + lim + ': ' + (d.dias === 1 ? 'falta ' : 'faltan ') + plural(d.dias, 'día', 'días') + '.' : d.dias === 0 ? 'Hoy es el día límite del corte.' : 'El día límite fue el ' + lim + '. Sigue abierto hasta que se cierre.')
      : d.abierto === false || !d.manual ? 'Corte cerrado.' : 'Sigue abierto.');
  }
  // Tarjetas de arriba: tocar una cambia lo que se ve
  function pintarSegs(){
    const inst = d.filas.filter((f) => !f.migracion).concat(d.aliados || []);
    const cumplen = inst.filter((f) => f.cumple).length; const ant = inst.filter((f) => f.origen === 'anterior').length;
    const mig = d.filas.filter((f) => f.migracion); const pe = todasCorte().filter((f) => f.origen === 'corte' && cartaPend(f)).length;
    const t = (id, n, tit, sub, cls) => '<button type="button" class="cx-seg' + (cls ? ' ' + cls : '') + (seg === id ? ' on' : '') + '" data-seg="' + id + '" aria-pressed="' + (seg === id) + '"><b>' + n + '</b><span><span class="t">' + tit + '</span><small>' + esc(sub) + '</small></span></button>';
    $('segs').innerHTML = t('inst', inst.length, 'Instalaciones PYME', plural(cumplen, 'comisiona', 'comisionan') + (ant ? ' · ' + plural(ant, 'viene', 'vienen') + ' del corte anterior' : '')) +
      t('cambios', mig.length, 'Cambios de categoría', 'Migraciones confirmadas en este corte') +
      (d.puedo && d.puedo.enviar !== undefined ? t('cartas', pe, 'Cartas y proformas', 'por enviar', 'ambar') : '');
  }
  function pintarEquipos(){
    const vs = equiposVisibles(); if(!equipo || !vs.some((x) => x[0] === equipo)) equipo = vs.length ? vs[0][0] : 'corporativas';
    const todos = seg === 'cartas';
    $('equipos').innerHTML = seg === 'cambios' ? '' : vs.map((x) => { const on = todos || x[0] === equipo;
      const n = todos ? todasCorte().filter((f) => f.origen === 'corte' && cartaPend(f) && deEquipo(f, x[0])).length : filasInst(x[0]).length;
      return '<button type="button" role="tab" class="cx-eq' + (on ? ' on' : '') + '" data-equipo="' + x[0] + '" aria-selected="' + on + '">' + x[1] + ' <span class="cnt">' + n + '</span></button>'; }).join('');
    $('equipos').classList.toggle('todas', todos);
  }
  // Avisos del corte en curso: Por instalar, Por asignar y el botón azul para subir un cliente nuevo
  function pintarAlertas(){
    const z = $('alertas'); const enCurso = d.corte === d.actual;
    if(!enCurso || seg !== 'inst' || !['admin', 'analista', 'lider'].includes(yo.rol)){ z.innerHTML = ''; return; }
    const pi = d.pi || {}; const n = porAsignar(); const pend = (d.pendientes || []).length;
    z.innerHTML = '<button type="button" class="cx-al' + (pi.mas24 ? ' w' : '') + '" data-abrir="por_instalar"><span class="h">Por instalar</span><span class="big">' + plural(pi.mas24 || 0, 'orden', 'órdenes') + '</span>' +
        '<span class="s">Del corte, pasan de ' + (d.horas_alerta || 24) + ' horas sin instalar</span><span class="go">Ver órdenes</span></button>' +
      (yo.rol !== 'lider' ? '<button type="button" class="cx-al' + (n ? '' : ' ok') + '" data-filtro="asignar"><span class="h">Por asignar</span><span class="big">' + plural(n, 'instalación', 'instalaciones') + '</span>' +
        '<span class="s">' + (n ? 'Sin dueño: no comisionan hasta asignarlas' : 'Todas tienen dueño') + '</span><span class="go">' + (n ? 'Asignar dueño' : 'Ver clientes sin líder') + '</span></button>' : '') +
      (d.puedo && d.puedo.subir_nuevo ? '<button type="button" class="cx-al azul" data-abrir="nuevo"><span class="big">Subir documentos de un cliente nuevo</span><span class="s">Buscas su orden de Odoo o lo subes con el posible nombre</span>' +
        '<span class="pill">' + plural(pend, 'pendiente por instalar', 'pendientes por instalar') + '</span></button>' : '');
  }
  function pintarFiltros(){
    if(seg !== 'inst'){ $('filtros').innerHTML = ''; const ay0 = $('ayudaFiltro'); if(ay0) ay0.innerHTML = seg === 'cartas' ? '<p class="ayuda-filtro cx-todas" role="note">Las tres pestañas quedan marcadas: se ve todo lo que falta por enviar, también los cambios de categoría. <button type="button" class="enlace" data-seg="inst">Quitar filtro</button></p>' : ''; return; }
    $('filtros').innerHTML = FILTROS.filter((f) => (OPCIONALES.indexOf(f.id) < 0 || filtro === f.id || Number(conteo(f.id)) > 0) && !(f.id === 'asignar' && esLider())).map((f) => {
      const n = conteo(f.id);
      return '<button type="button" role="tab" data-filtro="' + f.id + '" class="' + (f.id === filtro ? 'on' : '') + '" aria-selected="' + (f.id === filtro) + '">' + esc(f.t) + (n === '' ? '' : ' <em>' + esc(n) + '</em>') + '</button>';
    }).join('');
    const ay = $('ayudaFiltro'); if(ay) ay.innerHTML = ayudaFiltro();
  }
  // Qué le falta a la fila, en chips
  function chipsFalta(f){
    if(f.pend) return '<span class="chip gris">Pendiente por instalar</span>' + (f.docs ? '<span class="chip verde">' + (f.enviado ? 'Enviado a revisión' : 'Documentos subidos') + '</span>' : '<span class="chip gris">Sin documentos</span>');
    if(f.equipo === 'aliados') return (f.legal_ok ? '<span class="chip verde">Legal listo</span>' : '<span class="chip ambar">Falta legal</span>') + (f.pago_ok ? '' : '<span class="chip rojo">Debe instalación</span>');
    let h = '';
    if(f.origen === 'anterior') h += '<span class="chip azul">Del corte anterior</span>';
    if(f.por_subir && f.legal_ok) h += '<span class="chip ambar">Archivos por subir</span>';   // no cambia la comisión
    if(f.cumple) return h + '<span class="chip verde">' + (f.excepcion ? 'Comisiona por excepción' : 'Comisiona') + '</span>';
    if(!f.orden_ok) h += '<span class="chip ambar">Por asignar</span>';
    if(!f.legal_ok) h += '<span class="chip ambar">' + (f.por_subir ? 'Archivos por subir' : 'Falta legal') + '</span>';
    if(!f.pago_ok) h += '<span class="chip ' + (f.revisar_pago ? 'ambar">Revisar pago' : 'rojo">Debe instalación') + '</span>';
    if(f.movida) h += '<span class="chip ambar">Movida a mano</span>';
    return h || '<span class="chip ambar">Falta la orden</span>';
  }
  // Carta de bienvenida y proforma: un solo envío; Canales siempre la envía
  function cartaTexto(f){
    if(f.pend) return ['gris', 'Se envía al instalar', ''];
    const k = f.carta || {}; const dias = Number(k.dias) || 0;
    if(k.k === 'enviada') return ['verde', 'Enviada ' + diaMes(k.canales.en), 'Por ' + (k.canales.por || 'Canales') + ' (Canales)'];
    if(k.k === 'lider') return ['azul', 'Enviada por el líder · falta Canales', 'Le toca a Canales de atención'];
    if(k.k === 'falta_ip') return ['ambar', 'Por enviar · falta la IP', f.equipo === 'aliados' && esLider() ? 'La envía Canales' : 'Le toca a Canales de atención'];
    if(k.k === 'por_enviar') return [dias > 2 ? 'rojo' : 'ambar', 'Por enviar · ' + plural(dias, 'día', 'días'), f.equipo === 'aliados' && esLider() ? 'La envía Canales' : 'Le toca a Canales de atención'];
    return ['gris', 'Sin registro', ''];
  }
  function fila(f){
    const c = cartaTexto(f); const att = f.pend ? 'data-exp="' + esc(f.cliente_id) + '"' : 'data-com="' + esc(f.instalacion_id) + '" data-cliente="' + esc(f.cliente_id) + '"';
    const inst = f.pend ? '<b>Sin instalar</b><small>' + esc(f.desde ? 'desde ' + hace(f.desde).replace('hace ', '') : '') + '</small>' : '<b>' + esc(diaMes(f.instalada_en)) + '</b><small>' + esc(hace(f.instalada_en)) + '</small>';
    return '<button type="button" class="cx-fila" ' + att + '><span class="cx-c"><b>' + esc(f.nombre || 'Sin nombre') + '</b><small>' + esc(f.doc || '') + (f.codigo ? ' · ' + esc(f.codigo) : '') + '</small></span>' +
      '<span class="cx-i">' + inst + '</span><span class="cx-o">' + (f.orden ? esc(ordenCorta(f.orden)) + (f.orden_ok ? '' : '<small class="tx-ambar">por confirmar</small>') : '<span class="tx-rojo">Sin orden</span>') + (!f.orden_ok && f.motivo ? '<small class="cx-mot">' + esc(f.motivo) + '</small>' : '') + '</span>' +
      '<span class="cx-q">' + chipsFalta(f) + '</span><span class="cx-cp"><span class="chip ' + c[0] + '">' + esc(c[1]) + '</span>' + (c[2] ? '<small>' + esc(c[2]) + '</small>' : '') + '</span></button>';
  }
  // Fila corta para la vista de cartas (pantalla 3): nombre, cuándo se instaló y el estado de la carta
  function filaCarta(f){
    const c = cartaTexto(f);
    const sub = f.migracion ? 'Cambio de categoría · confirmado ' + hace(f.instalada_en) : f.carta && f.carta.k === 'lider' ? 'El líder la envió el ' + diaMes(f.carta.lider.en) + ' · Canales debe enviarla igual'
      : 'Instalada ' + hace(f.instalada_en) + (f.equipo === 'aliados' ? ' · el líder solo la ve, no la envía' : '');
    return '<button type="button" class="cx-fila corta" data-com="' + esc(f.instalacion_id) + '" data-cliente="' + esc(f.cliente_id) + '" data-carta="1"><span class="cx-c"><b>' + esc(f.nombre) + '</b><small>' + esc(sub) + '</small></span>' +
      '<span class="chip ' + c[0] + '">' + esc(c[1]) + '</span></button>';
  }
  function grupos(filas, porNombre){
    const g = []; const idx = {};
    filas.forEach((f) => { const l = porNombre(f); if(idx[l] === undefined){ idx[l] = g.length; g.push({ l, filas: [] }); } g[idx[l]].filas.push(f); });
    return g;
  }
  function pintarLista(){
    if(seg === 'inst' && filtro === 'eventos'){
      const p = (d.eventos || []).filter(coincide);
      $('lista').innerHTML = !p.length ? vacio('Sin eventos', 'Las instalaciones marcadas como evento que no comisionan salen aquí.') : '<div class="grupo abierto"><div class="sub-bloque liso" style="border-top:0">Eventos que no comisionan<span class="n2">Ábrelos para decidir</span></div>' +
        p.map((o) => '<button type="button" class="fila" data-com="' + esc(o.instalacion_id) + '" data-cliente="' + esc(o.cliente_id) + '"><span class="tx"><b>' + esc(o.nombre) + '</b><small>' + esc(o.codigo || '') + ' · ' + esc(fecha(o.instalada_en)) + ' · ' + esc(o.lider) + '</small></span><span class="m azul">Evento</span></button>').join('') + '</div>';
      return;
    }
    const base = filasVista(); const filas = base.filter((f) => (seg !== 'inst' || pasa(f)) && coincide(f));
    if(!filas.length){
      $('lista').innerHTML = (busca && base.length ? vacio('Sin resultados', 'Nadie coincide con "' + busca + '". Revisa cómo está escrito o busca por código o número de orden.')
        : seg === 'cartas' ? vacio('Todo enviado', 'No quedan cartas de bienvenida y proformas por enviar en este corte.')
        : seg === 'cambios' ? vacio('Sin cambios de categoría', 'Las migraciones a PYME confirmadas en el corte salen aquí.')
        : base.length ? vacio('Nada en este filtro', 'Prueba con otro filtro o mira todas.') : vacio('Sin instalaciones en este equipo', 'Cuando se instale un servicio que comisiona aparecerá aquí.')) +
        (seg === 'cambios' ? migExtras() : '') + (seg === 'inst' ? bandejasExtra() : '');
      return;
    }
    let h = '';
    if(seg === 'cartas'){
      const normales = filas.filter((f) => !f.migracion); const camb = filas.filter((f) => f.migracion);
      h = grupos(normales, (f) => (f.equipo === 'aliados' ? f.lider + ' · Aliado' : f.lider || 'Por asignar')).sort((a, b) => b.filas.length - a.filas.length).map((g) => grupoHtml('c|' + g.l, g.l, g.filas, true)).join('') +
        (camb.length ? grupoHtml('c|__camb', 'Cambios de categoría', camb, true) : '');
    } else {
      const solo = !!busca || filtro === 'asignar';
      const gs = grupos(filas, (f) => f.lider || f.dueno || 'Por asignar');
      gs.sort((a, b) => (a.l === 'Por asignar') - (b.l === 'Por asignar') || b.filas.filter((f) => !f.pend).length - a.filas.filter((f) => !f.pend).length || a.l.localeCompare(b.l));
      h = gs.map((g, n) => grupoHtml(seg + '|' + equipo + '|' + g.l, g.l, g.filas, false, solo || gs.length === 1 || (abiertos[seg + '|' + equipo + '|' + g.l] === undefined && n === 0))).join('');
      if(seg === 'cambios') h += migExtras();
      else h += bandejasExtra();
    }
    $('lista').innerHTML = h;
  }
  function grupoHtml(k, titulo, filas, cartas, abrir){
    const ab = abiertos[k] !== undefined ? abiertos[k] : (cartas || !!abrir);
    const inst = filas.filter((f) => !f.pend);
    const pills = cartas ? '<span class="p w">' + plural(filas.length, 'por enviar', 'por enviar') + '</span>'
      : '<span class="p g">' + plural(inst.length, 'instalada', 'instaladas') + '</span><span class="p ok">' + inst.filter((f) => f.cumple).length + ' ' + (inst.filter((f) => f.cumple).length === 1 ? 'comisiona' : 'comisionan') + '</span>' +
        (inst.some((f) => !f.legal_ok) ? '<span class="p w">' + inst.filter((f) => !f.legal_ok).length + ' falta legal</span>' : '') +
        (inst.some(cartaPend) ? '<span class="p w">' + inst.filter(cartaPend).length + ' por enviar</span>' : '') +
        (filas.length > inst.length ? '<span class="p g">' + (filas.length - inst.length) + ' por instalar</span>' : '');
    const todo = completos[k] || filas.length <= TOPE; const ver = todo ? filas : filas.slice(0, TOPE);
    const cuerpo = (cartas ? '' : '<div class="cx-th" aria-hidden="true"><span>Cliente</span><span>Instalada</span><span>Orden de Odoo</span><span>Qué falta</span><span>Carta y proforma</span></div>') +
      ver.map(cartas ? filaCarta : fila).join('') + (todo ? '' : '<button type="button" class="fila mas" data-mas="' + esc(k) + '">Ver ' + (filas.length - TOPE) + ' más</button>');
    return '<div class="grupo cx-grupo' + (ab ? ' abierto' : '') + '" data-lider="' + esc(titulo) + '" data-k="' + esc(k) + '"><button type="button" class="grupo-cab" data-grupo="' + esc(k) + '" aria-expanded="' + !!ab + '">' + ic('abajo') +
      (cartas ? '' : '<span class="av" aria-hidden="true">' + esc(iniciales(titulo)) + '</span>') + '<span class="tx"><b>' + esc(titulo) + '</b></span><span class="stats">' + pills + '</span></button>' +
      '<div class="grupo-cuerpo">' + (cartas ? '' : barraPendientes({ lider: titulo })) + cuerpo + '</div></div>';
  }
  // Qué quiere decir cada filtro que confunde (lote 2, C)
  const AYUDA = {
    pago: 'Sin pago: según el TAD, el cliente todavía no ha pagado la instalación. Mientras no la pague, no comisiona. Se quita sola cuando el TAD trae el pago.',
    asignar: 'Por asignar: no se sabe de quién es la instalación (la orden no tiene código de vendedor o la creó otra persona). No comisiona hasta que el Analista Senior le pone dueño.',
    pendientes: 'Pendientes por instalar: clientes con documentos subidos que todavía no tienen la instalación. Pasan solos al corte cuando el TAD la trae.'
  };
  function ayudaFiltro(){
    // Lote 3: los clientes con excepción pagada en un corte anterior no están en este corte; se gestionan en Clientes
    const xp = filtro === 'subir' && d && d.exc_pagada ? ' <a class="enlace" href="clientes.html?f=por_subir">' + plural(d.exc_pagada, 'cliente', 'clientes') + ' con excepción pagada también ' + (d.exc_pagada === 1 ? 'tiene' : 'tienen') + ' archivos por subir. Ver en Clientes</a>' : '';
    const sl = filtro === 'asignar' && yo.rol !== 'lider' ? ' <button type="button" class="enlace" data-abrir="sin_lider">Clientes instalados sin líder</button>' : '';
    return AYUDA[filtro] || xp || sl ? '<p class="ayuda-filtro" role="note">' + esc(AYUDA[filtro] || '') + xp + sl + '</p>' : '';
  }
  // Migraciones del corte que no comisionan aquí: cambios a residencial (indicador negativo) e histórico pagado fuera de la app
  let MIG = null;
  async function cargarMig(mio){
    try { const r = await rpc('migraciones_corte', { p_corte: d.corte }); if(mio !== pedido) return; MIG = r; if(seg === 'cambios') pintarLista(); }
    catch (e) { MIG = null; }
  }
  function migExtras(){
    if(!MIG || !d || MIG.corte !== d.corte || busca) return '';
    const caja = (k, titulo, sub, items, chip, cls) => {
      if(!items.length) return '';
      const ab = !!abiertos[k];
      return '<div class="grupo bandeja-extra' + (ab ? ' abierto' : '') + '" data-lider="' + k + '"><button type="button" class="grupo-cab" data-grupo="' + k + '" aria-expanded="' + ab + '"><span class="tx"><b>' + titulo + '</b><small>' + esc(sub) + '</small></span><span class="num">' + items.length + '</span>' + ic('abajo') + '</button>' +
        '<div class="grupo-cuerpo">' + items.map((o) => '<a class="fila" href="migraciones.html?f=confirmado&c=' + encodeURIComponent(o.id) + '"><span class="tx"><b>' + esc(o.nombre || 'Sin nombre') + '</b><small>' +
          esc([fecha(o.en), o.lider].filter(Boolean).join(' · ')) + '</small></span><span class="m ' + cls + '">' + esc(chip) + '</span></a>').join('') + '</div></div>';
    };
    return caja('__res', 'Cambios a residencial', 'Indicador negativo del líder. No comisionan', MIG.residencial || [], 'Negativo', 'rojo') +
      caja('__his', 'Histórico pagado fuera de la app', 'Del consolidado de cambios de categoría. No entran al corte', MIG.historico || [], 'Pagado fuera', 'gris');
  }
  // Lote 21/10: bandejas plegables debajo de la lista: "No comisionan" (anuladas a mano) y, en un corte certificado, "Fuera de la foto"
  function bandejasExtra(){
    if(busca || filtro !== 'todos' || equipo === 'aliados') return '';
    const caja = (k, titulo, sub, items, chip, cls) => {
      if(!items.length) return '';
      const ab = !!abiertos[k];
      return '<div class="grupo bandeja-extra' + (ab ? ' abierto' : '') + '" data-lider="' + k + '"><button type="button" class="grupo-cab" data-grupo="' + k + '" aria-expanded="' + ab + '"><span class="tx"><b>' + titulo + '</b><small>' + esc(sub) + '</small></span><span class="num">' + items.length + '</span>' + ic('abajo') + '</button>' +
        '<div class="grupo-cuerpo">' + items.map((o) => '<button type="button" class="fila" data-com="' + esc(o.instalacion_id) + '" data-cliente="' + esc(o.cliente_id) + '"><span class="tx"><b>' + esc(o.nombre) + '</b><small>' +
          esc([o.codigo, fecha(o.instalada_en), o.lider, o.motivo].filter(Boolean).join(' · ')) + '</small></span><span class="m ' + cls + '">' + esc(chip) + '</span></button>').join('') + '</div></div>';
    };
    return caja('__nc', 'No comisionan', 'Marcadas a mano con su motivo. Ábrelas para ver o volver a activar', d.no_comisionan || [], 'No comisiona', 'rojo') +
      caja('__ff', 'Fuera de la foto', 'Son de este corte certificado pero no quedaron en su foto. Ábrelas para asignar, marcar evento o pasar al corte abierto', d.fuera_foto || [], 'Fuera de la foto', 'ambar');
  }
  function pintar(){
    pintarCorte(); pintarRango(); pintarSegs(); pintarEquipos(); pintarAlertas(); pintarAvisos(); pintarFiltros(); pintarLista();
  }
  // Lo que pide atención en el corte y lo que se puede hacer con él
  function pintarAvisos(){
    const P = d.puedo || {}; let h = '';
    if(!d.certificado && d.manual && d.corte === d.actual && d.dias <= 0) h += '<div class="franja ambar">' + ic('reloj') + '<span><b>' + (d.dias === 0 ? 'Hoy es el día límite del corte' : 'El corte de ' + mes(d.corte) + ' sigue abierto') + '</b>' +
      (P.certificar ? 'Lo que se cumpla antes de cerrarlo cuenta. Ciérralo cuando termines Legal y pagos.' : 'Lo que se cumpla antes de que lo cierren cuenta para este corte.') + '</span>' +
      (P.certificar ? '<button type="button" class="mini pri" data-cerrar-corte>Cerrar corte</button>' : '') + '</div>';
    if(d.certificado) h += '<div class="franja verde">' + ic('check') + '<span><b>Corte cerrado</b>' + esc((d.certificado.por ? 'Por ' + primerNombre(d.certificado.por) + ', el ' : 'El ') + fecha(d.certificado.en)) + '. Lo que ves quedó fijo.</span>' +
      (P.quitar_certificado ? '<button type="button" class="mini" id="quitarCert">Quitar</button>' : '') + '</div>';
    $('avisos').innerHTML = h;
    $('acciones').innerHTML = (d.filas.length ? '<button type="button" class="mini" id="bajarExcel">' + ic('doc') + 'Bajar Excel</button>' : '') +
      (P.pago_dias ? '<button type="button" class="mini" id="pagoDiasAbrir">' + ic('reloj') + 'Días para el pago</button>' : '') +
      (P.certificar ? '<button type="button" class="mini pri" id="abrirCert">' + ic('check') + 'Cerrar corte</button>' : '');
  }
  // Por instalar y Subir documentos de un cliente nuevo viven en por-instalar.js; al terminar se recarga la lista
  function abrirExtra(cual){
    if(cual === 'por_instalar' && window.PorInstalar) window.PorInstalar.abrir({ yo, alCambiar: tras });
    else if(cual === 'nuevo' && window.ClienteNuevo) window.ClienteNuevo.abrir({ yo, alCambiar: tras });
    else if(cual === 'sin_lider' && window.PorInstalar) window.PorInstalar.sinLider({ yo });
  }
  // Columnas del Excel del corte (para planta externa). Para cambiar el orden basta mover las líneas.
  const si = (v) => (v ? 'Sí' : 'No');
  const COLUMNAS_EXCEL = [
    { t: 'Líder', ancho: 22, v: (f) => f.lider || '' },
    { t: 'Cliente', ancho: 42, v: (f) => f.nombre || '' },
    { t: 'RIF o cédula', ancho: 16, v: (f) => f.doc || '' },
    { t: 'Tipo', ancho: 10, v: (f) => (f.es_natural ? 'Natural' : 'Jurídico') },
    { t: 'Sucursal', ancho: 9, v: (f) => f.sucursal || '' },
    { t: 'Código', ancho: 11, v: (f) => f.codigo || '' },
    { t: 'Instalado', ancho: 22, v: (f) => fecha(f.instalada_en, true) },
    { t: 'Técnico o instalador', ancho: 24, v: (f) => capital(f.instalador || '') },
    { t: 'N° de orden de Odoo', ancho: 14, v: (f) => (f.orden ? ordenCorta(f.orden) : '') },
    { t: 'Orden de Odoo', ancho: 26, v: (f) => f.orden || (f.orden_ok ? 'Asignada a mano' : 'Sin orden') },
    { t: 'Corte', ancho: 13, v: (f) => (f.origen === 'anterior' ? 'Último corte' : 'Este corte') },
    { t: 'Legal', ancho: 7, v: (f) => si(f.legal_ok) },
    { t: 'Pago', ancho: 7, v: (f) => si(f.pago_ok) },
    { t: 'Excepción', ancho: 30, v: (f) => (f.excepcion ? (f.excepcion_motivo || 'Sí') : '') },
    { t: 'Comisiona', ancho: 12, v: (f) => (!f.orden_ok ? 'Por asignar' : si(f.cumple)) }
  ];
  function bajarExcel(){
    const filas = d.filas.map((f) => COLUMNAS_EXCEL.map((c) => c.v(f)));
    const res = {}; d.filas.forEach((f) => { const l = f.lider || 'Por asignar'; res[l] = res[l] || [l, 0, 0]; res[l][1]++; if(f.cumple) res[l][2]++; });
    const blob = window.Archivos.xlsx([
      { nombre: 'Detalle', columnas: COLUMNAS_EXCEL.map((c) => ({ t: c.t, ancho: c.ancho })), filas },
      { nombre: 'Resumen', columnas: [{ t: 'Líder', ancho: 24 }, { t: 'Instalaciones', ancho: 14 }, { t: 'Comisionan', ancho: 12 }], filas: Object.keys(res).sort().map((k) => res[k]).concat([['Total', d.filas.length, d.filas.filter((f) => f.cumple).length]]) }
    ]);
    window.Archivos.descargar(blob, 'Comisiones-' + d.corte.slice(0, 7) + (d.certificado ? '-certificado' : '') + '.xlsx');
    toast('Excel descargado');
  }

  // ---------- Enviar pendientes al líder (solo admin, corte en curso) ----------
  const SIN_LIDER = ['sin lider', 'por asignar'];
  function barraPendientes(g){
    if(!yo || yo.rol !== 'admin' || !d || d.corte !== d.actual || SIN_LIDER.indexOf(normalizeStr(g.lider)) >= 0) return '';
    if(!d.filas.some((f) => f.lider === g.lider && !f.cumple)) return '';
    return '<div class="pend-barra"><button type="button" class="btn btn-2 btn-chico" data-pend="' + esc(g.lider) + '">' + ic('wa') + 'Enviar pendientes</button>' +
      '<span>Mensaje de seguimiento por WhatsApp</span></div>';
  }
  const TOPE_MSJ = 12;   // con más clientes pendientes va un resumen y la lista en PDF
  let P = null;   // { datos, pendientes, pdf }
  const saludo = () => { const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; };
  function detalle(f){
    if(!f.orden_ok) return 'pendiente por asignar, todavía no comisiona.';
    const partes = [];
    if(!f.legal_ok){
      if((f.falta || []).length) partes.push('falta ' + window.Comun.lista(f.falta));
      if((f.devuelto || []).length) partes.push('corregir ' + window.Comun.lista(f.devuelto) + ' (lo devolvió Legal)');
      if(!partes.length) partes.push('documentos en revisión con Legal');
    }
    const docs = partes.length ? partes.join('; ') + '.' : '';
    if(f.pago_ok) return docs;
    return docs ? docs + ' Debe la instalación.' : 'debe la instalación.';
  }
  function armarPendientes(x){
    const pend = x.filas.filter((f) => !f.cumple); let n = 0;
    const sec = (origen) => pend.filter((f) => f.origen === origen).map((f) => ({ n: ++n, nombre: window.Documentos.limpiarNombre(f.nombre), codigo: f.codigo || '', detalle: detalle(f) }));
    const ultimo = sec('anterior'); const actual = sec('corte');
    const dia = Number(String(x.limite || x.fin).slice(8, 10));
    const cierre = x.dias < 0 ? 'El corte sigue abierto: envíalo lo antes posible, se cierra en cualquier momento' : x.dias === 0 ? 'Hoy, el ' + dia + ', es el límite para Legal y pago' : 'El límite para Legal y pago es el ' + dia + ' y ' + (x.dias === 1 ? 'falta 1 día' : 'faltan ' + x.dias + ' días');
    const cumplen = x.filas.filter((f) => f.cumple).length;
    const cab = saludo() + ', ' + primerNombre(x.nombre) + '. Te paso tus pendientes del corte de ' + mes(x.corte) + '. ' + cierre + '.';
    const cola = 'Ya cumplen: ' + cumplen + ' de ' + x.filas.length + '.\n\nCualquier documento me lo envías por aquí o lo subes en la app. Gracias.';
    const linea = (f) => f.n + '. ' + f.nombre + (f.codigo ? ' (' + f.codigo + ')' : '') + ': ' + f.detalle;
    const conPdf = pend.length > TOPE_MSJ;
    let cuerpo;
    if(conPdf){
      cuerpo = 'Tienes ' + pend.length + ' clientes con pendientes' + (ultimo.length ? ': ' + ultimo.length + ' del último corte (si no cumplen el ' + dia + ', se pierde la comisión) y ' + actual.length + ' de este corte' : '') + '. Te envío la lista completa en PDF.';
    } else {
      const b = [];
      if(ultimo.length) b.push('ÚLTIMO CORTE (si no cumplen el ' + dia + ', se pierde la comisión)\n' + ultimo.map(linea).join('\n'));
      if(actual.length) b.push('DE ESTE CORTE\n' + actual.map(linea).join('\n'));
      cuerpo = b.join('\n\n');
    }
    return { texto: cab + '\n\n' + cuerpo + '\n\n' + cola, pendientes: pend.length, conPdf, ultimo, actual, cierre, cumplen, dia };
  }
  const may = (f) => Object.assign({}, f, { detalle: capital(f.detalle) });
  function pdfPendientes(){
    const x = P.datos; const a = P.armado; const hoy = new Date();
    const blob = window.Documentos.pendientes({ lider: x.nombre, corte: mes(x.corte), cierre: a.cierre, cumplen: a.cumplen, total: x.filas.length,
      fecha: String(hoy.getDate()).padStart(2, '0') + '/' + String(hoy.getMonth() + 1).padStart(2, '0') + '/' + hoy.getFullYear(),
      secciones: [{ titulo: 'Último corte: si no cumplen el ' + a.dia + ', se pierde la comisión', rojo: true, filas: a.ultimo.map(may) }, { titulo: 'De este corte', filas: a.actual.map(may) }] });
    const base = String(x.nombre).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'lider';
    return new File([blob], 'Pendientes_' + base + '_' + mes(x.corte) + '.pdf', { type: 'application/pdf' });
  }
  async function abrirPendientes(lider){
    const h = hojaChica('hojaPend', 'tPend');
    h.innerHTML = cabHoja('tPend', 'Enviar pendientes', lider) + '<div id="cuerpoPend"><span class="sk" style="height:22px;border-radius:8px;display:block;width:60%"></span><span class="sk" style="height:180px;border-radius:20px;display:block;margin-top:14px"></span></div>';
    if(hojaAbierta() !== 'hojaPend') abrirHoja('hojaPend');
    P = { lider };
    let x;
    try { x = await rpc('pendientes_lider', { p_lider: lider }); }
    catch (e) { if(P && P.lider === lider && $('cuerpoPend')) $('cuerpoPend').innerHTML = '<div class="vacio" role="alert"><b>No se pudieron armar los pendientes</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" data-pend="' + esc(lider) + '">Reintentar</button></div>'; return; }
    if(!P || P.lider !== lider || !$('cuerpoPend')) return;
    const a = armarPendientes(x); P = { lider, datos: x, armado: a };
    const num = window.Comun.telWa(x.whatsapp);
    $('cuerpoPend').innerHTML = '<p class="nota-chica" style="margin-top:0">' + (num ? 'Para ' + esc(x.nombre) + ', al ' + esc(window.Documentos.telFmt(x.whatsapp)) + '.' : esc(x.nombre) + ' no tiene WhatsApp en Usuarios: al abrir WhatsApp eliges su chat.') +
        (x.ultimo ? ' Último envío: ' + esc(dia(x.ultimo).toLowerCase()) + '.' : '') + '</p>' +
      '<label class="rotulo arriba" for="pendMsj">Mensaje</label><textarea class="area" id="pendMsj" rows="12" maxlength="6000">' + esc(a.texto) + '</textarea>' +
      (a.conPdf ? '<p class="nota-chica">Son ' + a.pendientes + ' clientes: el mensaje va corto y la lista completa en PDF. <button type="button" class="enlace" id="pendVerPdf">Ver el PDF</button></p>' : '<p class="nota-chica">Puedes cambiar el texto antes de enviarlo.</p>') +
      '<div class="error" id="ePend" role="alert"></div><div class="acciones"><button type="button" class="btn btn-ancho" id="pendEnviar">' + ic('wa') + 'Enviar por WhatsApp</button></div>';
  }
  function puedeCompartir(){
    try { return window.matchMedia('(pointer: coarse)').matches && !!navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] }); } catch (e) { return false; }
  }
  async function enviarPendientes(b){
    if(!P || !P.datos) return;
    const er = $('ePend'); er.textContent = '';
    const texto = $('pendMsj').value.trim();
    if(texto.length < 20){ er.textContent = 'Escribe el mensaje antes de enviarlo'; $('pendMsj').focus(); return; }
    let archivo = null;
    if(P.armado.conPdf){ try { archivo = pdfPendientes(); } catch (e) { er.textContent = 'No se pudo armar el PDF. Intenta de nuevo'; return; } }
    const num = P.datos.whatsapp;
    if(archivo && puedeCompartir()){
      if(num) try { await navigator.clipboard.writeText(window.Documentos.telFmt(num)); } catch (e) {}
      try { await navigator.share({ files: [archivo], text: texto }); }
      catch (e) { if(e && e.name === 'AbortError') return; er.textContent = 'No se pudo abrir Compartir. Intenta de nuevo'; return; }
    } else {
      if(archivo) window.Archivos.descargar(archivo, archivo.name);
      window.open(num ? window.Comun.enlaceWa(num, texto) : 'https://wa.me/?text=' + encodeURIComponent(texto), '_blank', 'noopener');
    }
    b.disabled = true;
    try { await rpc('pendientes_enviados', { p_lider: P.lider, p_pendientes: P.armado.pendientes, p_pdf: !!archivo }); }
    catch (e) { toast('Se abrió WhatsApp, pero no quedó anotado el envío: ' + e.message, 'error'); b.disabled = false; return; }
    toast(archivo && !puedeCompartir() ? 'PDF descargado. Adjúntalo en el chat de WhatsApp. Quedó anotado el envío' : 'Quedó anotado el envío');
    if(hojaAbierta() === 'hojaPend') cerrarHoja();
  }

  async function cargar(){
    const mio = ++pedido; const clave = 'comisiones4:' + (corte || 'actual');
    const guardado = cache.leer(clave);
    if(guardado && guardado.rol === yo.rol){ d = guardado; pintar(); }
    else { $('lista').innerHTML = esqueleto(5); $('segs').innerHTML = '<span class="sk" style="height:66px;border-radius:18px"></span><span class="sk" style="height:66px;border-radius:18px"></span><span class="sk" style="height:66px;border-radius:18px"></span>'; }
    try {
      const r = await rpc('comisiones_lista', { p_corte: corte || null });
      if(mio !== pedido) return;
      d = r; d.filas = d.filas || []; d.aliados = d.aliados || []; d.pendientes = d.pendientes || []; corte = d.corte; cache.guardar(clave, d);
      pintar(); guardarUrl(); if(K && K.F) pintarComision();
      cargarMig(mio);
    } catch (e) {
      if(mio !== pedido) return;
      if(!d) $('lista').innerHTML = '<div class="vacio" role="alert"><b>No se pudieron cargar las comisiones</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" id="reintentar">Reintentar</button></div>';
      toast(e.message, 'error');
    }
  }

  // ---------- Hoja corta de comisión: solo lo que decide la comisión, con gestión ----------
  let K = null;   // { inst, cliente, F }
  let profAbierto = false; // Proforma y carta plegada hasta que se abra
  function montarHoja(){
    if($('hojaComision')) return;
    const h = document.createElement('section'); h.id = 'hojaComision'; h.className = 'hoja lado corta';
    h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', 'tCom'); h.setAttribute('aria-hidden', 'true');
    h.innerHTML = '<div class="asa" aria-hidden="true"></div><div class="ficha-cab" id="cabCom"></div><div class="ficha-cuerpo" id="cuerpoCom"></div>';
    document.body.appendChild(h); window.Comun.prepararHojas();
    h.addEventListener('hoja-cerrada', () => { K = null; profAbierto = false; });
    h.addEventListener('toggle', (e) => { if(e.target.classList && e.target.classList.contains('prof')) profAbierto = e.target.open; }, true);
  }
  function abrirComision(inst, cliente, carta){
    montarHoja();
    const f = d.filas.concat(d.aliados || []).find((x) => String(x.instalacion_id) === String(inst)) || (d.eventos || []).find((x) => String(x.instalacion_id) === String(inst)) || {};
    K = { inst: Number(inst), cliente: Number(cliente), F: null, carta: !!carta }; profAbierto = false;
    $('cabCom').innerHTML = '<div class="f-cab"><div class="tx"><h2 class="nom" id="tCom">' + esc(f.nombre || 'Cliente') + '</h2><p class="dat">' + esc([f.sucursal && f.codigo ? f.sucursal + '-' + f.codigo : f.codigo, f.instalada_en ? 'Instalado el ' + fecha(f.instalada_en) : ''].filter(Boolean).join(' · ')) + '</p></div>' +
      '<button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      // Lote A: contactar a quien tiene lo que falta para comisionar
      (window.Contacto && f.instalacion_id && 'orden_ok' in f ? window.Contacto.boton('comision', f.instalacion_id, !f.orden_ok ? 'orden' : !f.legal_ok ? 'legal' : !f.pago_ok ? 'pago' : '') : '');
    if(window.Contacto) window.Contacto.llenar($('cabCom'));
    $('cuerpoCom').innerHTML = '<div class="sk-bloque"><span class="sk" style="height:64px;border-radius:16px"></span><span class="sk" style="height:150px;border-radius:16px"></span><span class="sk" style="height:90px;border-radius:16px"></span></div>';
    if(hojaAbierta() !== 'hojaComision') abrirHoja('hojaComision'); else $('cuerpoCom').scrollTop = 0;
    cargarComision();
  }
  async function cargarComision(){
    if(!K) return; const mia = K;
    try { const F = await rpc('cliente_ficha', { p_cliente: mia.cliente }); if(K !== mia) return; K.F = F; pintarComision(); }
    catch (e) { if(K !== mia) return; $('cuerpoCom').innerHTML = '<div class="aviso" role="alert"><b>No se pudo abrir</b><p>' + esc(e.message) + '</p><p style="margin-top:14px"><button type="button" class="btn btn-chico" id="reintentarCom">Reintentar</button></p></div>'; toast(e.message, 'error'); }
  }
  // ---------- Lote 21/10: hoja de comisión ----------
  // Arriba el estado y los datos clave; tres bloques plegables con su mini chequeo y su estado en la cabecera; abajo los ajustes.
  const filaChq = (est, nombre, sub) => '<div class="chk"><i class="' + est + '">' + (est === 'ok' ? ic('check') : est === 'rv' ? ic('reloj') : '') + '</i><span>' + nombre + '<small>' + esc(sub) + '</small></span></div>';
  // Lote 28/10: lo que falta va primero, abierto y en ámbar; lo listo, plegado y en verde
  function plegable(id, titulo, chip, cls, cuerpo, extra){
    K.ab = K.ab || {}; const ab = !!K.ab[id]; const zid = id === 'legal' ? 'docsCom' : 'plg-' + id;
    const est = cls === 'verde' ? ' hc-listo' : cls === 'ambar' || cls === 'rojo' ? ' hc-falta' : '';
    return '<section class="req plg-com' + est + '" data-plg="' + id + '"><button type="button" class="plegado" data-plg-btn="' + id + '"' + (extra || '') + ' aria-expanded="' + ab + '" aria-controls="' + zid + '">' +
      '<span class="plg-tx">' + (est ? '<i class="pt" aria-hidden="true"></i>' : '') + titulo + '</span>' + (chip ? '<span class="m ' + cls + '">' + esc(chip) + '</span>' : '') + ic('abajo') + '</button>' +
      '<div id="' + zid + '" class="plg-z"' + (ab ? '' : ' hidden') + '>' + cuerpo + '</div></section>';
  }
  function datosClave(F, i){
    const c = F.cliente; const est = (window.Comun.ESTATUS[c.estatus] || {}).t || c.estatus || '';
    const cod = i ? [i.sucursal, i.codigo].filter(Boolean).join('-') : '';
    return '<div class="datos-com">' + [['Estatus legal', est], ['Líder', i ? i.dueno || 'Por asignar' : 'Sin instalación'], ['Código', cod || 'Sin código'],
      ['Instalada', i ? fecha(i.instalada_en) : ''], ['Orden de Odoo', i && i.orden ? ordenCorta(i.orden) : 'Sin orden']]
      .map((x) => '<div class="dato-f"><span>' + x[0] + '</span><b>' + esc(x[1]) + '</b></div>').join('') + '</div>';
  }
  // 1. Legal y documentos: mini chequeo, firma, Aprobar Legal, Pedir al cliente y las casillas del expediente
  function bloqueLegal(F){
    const c = F.cliente; const fal = F.faltantes || []; const ok = !!c.legal_ok_en; const lc = c.legal_como;
    const pr = (F.documentos || []).filter((x) => x.estado === 'por_revisar').length;
    const est = (window.Comun.ESTATUS[c.estatus] || {}).t || c.estatus || '';
    const chip = !ok ? (fal.length ? plural(fal.length, 'falta', 'faltan') : 'Falta Legal') : lc === 'revision' ? 'En revisión' : lc === 'excepcion' ? 'Aprobado a mano' : 'Cumple';
    let h = filaChq(ok ? 'ok' : 'no', 'Legal', ok ? (lc === 'revision' ? 'Pasó a revisión el ' + fecha(c.legal_ok_en) + '. Cuenta como listo' : lc === 'excepcion' ? 'Aprobado a mano el ' + fecha(c.legal_ok_en) : 'Cumplió el ' + fecha(c.legal_ok_en)) : 'Estatus: ' + est) +
      filaChq(fal.length ? 'no' : pr ? 'rv' : 'ok', 'Documentos', (fal.length ? plural(fal.length, 'falta', 'faltan') + ' en el expediente' : 'Completo') + (pr ? ' · ' + pr + ' por revisar' : ''));
    if(!c.es_natural){
      const fis = !!c.presencial; const dis = F.puedo.presencial ? '' : ' disabled';
      h += '<span class="rotulo" id="rFirma">Firma del contrato</span><div class="tres" role="radiogroup" aria-labelledby="rFirma">' +
        [['digital', 'Digital', !fis], ['fisica', 'Física', fis]].map((x) => '<button type="button" role="radio" data-firma="' + x[0] + '" aria-checked="' + x[2] + '" class="' + (x[2] ? 'on' : '') + '"' + dis + '>' + x[1] + '</button>').join('') + '</div>' +
        '<p class="nota-chica">' + (fis ? 'El cliente firma en físico. No se piden correos ni teléfono; sí los documentos legales. Comisiona igual.' : 'Firma digital: se piden el correo y el teléfono del representante.') + '</p>';
    }
    if(F.puedo.legal) h += '<div class="chk"><span>' + (ok ? '¿No debe contar?' : '¿Aprobar aunque falten documentos?') + '</span><button type="button" class="mini' + (ok ? '' : ' pri') + '" id="legalCheck" data-quita-legal="' + (ok ? '1' : '0') + '">' + (ok ? 'Quitar Legal' : 'Aprobar Legal') + '</button></div>';
    if(fal.length) h += '<div class="chk"><span>¿No los tienes?</span><button type="button" class="mini" id="pedirCom">Pedir al cliente</button></div>';
    h += '<div class="acc"><button type="button" class="btn btn-chico btn-2" id="comVarios">' + ic('subir') + 'Subir varios</button></div>' +
      '<p class="nota-chica solo-pc" style="text-align:center">También puedes arrastrar un archivo y soltarlo sobre una casilla.</p>' + window.Ficha.documentosPara(F);
    return plegable('legal', 'Legal y documentos', chip, ok ? 'verde' : fal.length ? 'rojo' : 'ambar', h, ' data-docs-com');
  }
  // 2. Pago: qué dice el TAD y cuándo, revisar pago, marcar o quitar (pregunta antes) y nota
  function bloquePago(F, i){
    if(!i || !i.comisiona) return '';
    const ok = !!i.pago_ok_en; const rv = ok ? null : i.revisar_motivo;
    const tad = i.tad_deuda === false ? 'Sin deuda' : i.tad_deuda === true ? 'Con deuda' : 'Sin dato del TAD';
    let h = filaChq(i.tad_deuda === false ? 'ok' : i.tad_deuda ? 'no' : 'rv', 'Qué dice el TAD', tad + (i.tad_visto ? ', carga del ' + fecha(i.tad_visto) : '')) +
      filaChq(ok ? 'ok' : rv ? 'rv' : 'no', 'Pago de la instalación', ok ? (i.pago_manual ? 'Marcado a mano el ' : 'Lo dio el TAD el ') + fecha(i.pago_ok_en) + '. Queda fijo' : rv ? 'Revisar a mano' : 'Debe la instalación');
    if(rv) h += '<div class="al-banda ambar" role="note"><b>' + (rv === 'factura_mes' ? 'Revisar pago: factura nueva del mes' : 'Revisar pago') + '</b><p>' +
      (rv === 'factura_mes' ? 'Se instaló del 20 en adelante y el TAD de este mes trae la factura nueva del mes, que no es la instalación. Si ya pagó, márcalo a mano.' : 'El cliente tiene más de un servicio; el TAD no puede decidir. Marca el pago a mano.') + '</p></div>';
    else if(!ok && i.tad_deuda === false) h += '<p class="nota-chica">El TAD da el pago solo si se cargó al menos ' + plural(Number(i.pago_dias) || 3, 'día', 'días') + ' después de instalar.</p>';
    if(F.puedo.pago){
      h += '<div class="chk"><span>' + (ok ? '¿Fue un error?' : 'Si ya pagó') + '</span><button type="button" class="mini' + (ok ? '' : ' pri') + '" id="pagoCom" data-pagada="' + (ok ? '0' : '1') + '">' + (ok ? 'Quitar pago' : 'Marcar pagada') + '</button></div>' +
        '<label class="rotulo arriba" for="pagoNota">Nota del pago</label><textarea class="area corta" id="pagoNota" maxlength="500">' + esc(i.pago_nota || '') + '</textarea>' +
        '<div class="error" id="ePagoNota" role="alert"></div><div class="acc"><button type="button" class="btn btn-chico btn-2" id="pagoNotaGuardar">Guardar nota</button></div>';
    } else h += (ok ? '' : '<p class="nota-chica">Lo marca el Analista Senior o el administrador.</p>') + (i.pago_nota ? '<p>Nota: ' + esc(i.pago_nota) + '</p>' : '');
    return plegable('pago', 'Pago', ok ? 'Pagada' : rv ? 'Revisar pago' : 'Debe', ok ? 'verde' : rv ? 'ambar' : 'rojo', h);
  }
  // 3. Carta de bienvenida y proforma (lote 28/10): un solo envío; Canales siempre la envía, el líder es respaldo; la IP va aquí
  function cartaDe(i, sv){
    const f = d && d.filas.concat(d.aliados || []).find((x) => Number(x.instalacion_id) === K.inst);
    if(f && f.carta) return f.carta;
    const b = sv && sv.bienvenida_envio; if(!b) return { k: 'por_enviar', dias: 0 };
    return { k: 'enviada', canales: { por: b.por, en: b.en, canal: b.canal } };
  }
  function bloqueCarta(F, i){
    if(!i || !F.puedo.enviar) return '';
    const sv = i.servicio_id && (F.servicios || []).find((x) => Number(x.id) === Number(i.servicio_id));
    if(!sv) return plegable('carta', 'Carta de bienvenida y proforma', 'Sin servicio', 'gris', '<p>Todavía no tiene un servicio enlazado. Sale cuando el TAD traiga el servicio de esta instalación.</p>');
    const k = cartaDe(i, sv); const dias = Number(k.dias) || 0; const sinIp = !sv.ip && !sv.ip6;
    const soloVe = yo.rol === 'lider' && i.es_aliado;
    const chip = k.k === 'enviada' ? 'Enviada por Canales' : k.k === 'lider' ? 'Enviada por el líder · falta Canales' : sinIp ? 'Por enviar · falta la IP' : 'Por enviar · ' + plural(dias, 'día', 'días');
    const cls = k.k === 'enviada' || (k.k === 'lider' && yo.rol === 'lider') ? 'verde' : k.k === 'lider' ? 'azul' : dias > 2 ? 'rojo' : 'ambar';
    const env = (x, quien, extra) => x ? '<div class="cp-env' + (extra ? ' ' + extra : '') + '"><i>' + ic('check') + '</i><span><b>' + quien + '</b><small>' + esc([x.por, x.en ? fecha(x.en) + ', ' + hora(x.en) : '', x.canal ? 'por ' + (x.canal === 'whatsapp' ? 'WhatsApp' : x.canal) : '', 'carta y proforma'].filter(Boolean).join(' · ')) + '</small></span></div>' : '';
    let h = '<p class="nota-chica">Canales de atención debe enviarla siempre. Si el líder la envía, queda marcado, pero no reemplaza el envío de Canales.</p>' +
      env(k.canales, 'Envío de Canales de atención (obligatorio)') + env(k.lider, 'Envío del líder (respaldo)', 'lid') +
      '<div class="cp-doc"><span><b>Proforma de instalación</b><small>' + esc(sv.plan || 'Servicio de internet') + ' · contrato ' + esc(String(sv.codigo || '').replace(/^0+/, '')) + '</small></span><button type="button" class="enlace" data-cp-pdf="proforma">Ver PDF</button></div>' +
      ((sv.carta || {}).puede ? '<div class="cp-doc"><span><b>Carta de bienvenida</b><small>Con los datos del líder y la IP</small></span><button type="button" class="enlace" data-cp-pdf="bienvenida">Ver PDF</button></div>'
        : '<p class="nota-chica">La carta sale cuando la instalación tenga dueño. Por ahora va solo la proforma.</p>') +
      '<div class="chk"><span>IP del servicio<small>' + esc(sinIp ? 'Falta: la carta dirá "Pendiente por asignar"' : [sv.ip, sv.ip6].filter(Boolean).join(' · ')) + '</small></span>' + (F.puedo.ip ? '<button type="button" class="mini" id="profIp">' + (sinIp ? 'Escribir' : 'Cambiar') + '</button>' : '') + '</div>';
    if(soloVe) h += '<p class="nota-chica">Es un cliente de aliado: la carta y proforma la envía Canales de atención.</p>';
    else {
      const p2 = K.paso2 && Number(K.paso2.servicio) === Number(sv.id) ? K.paso2 : null;
      h += (p2 && p2.paso2 ? '<a class="btn btn-ancho cp-paso2" href="' + esc(p2.enlace) + '" target="_blank" rel="noopener">' + ic('wa') + 'Paso 2: abrir el chat de ' + esc(p2.telefono) + '</a>' : '') +
        '<button type="button" class="btn btn-ancho cp-wa" id="cartaWa">' + ic('wa') + (k.k === 'enviada' ? 'Volver a enviar por WhatsApp' : 'Enviar carta y proforma por WhatsApp') + '</button>' +
        '<p class="nota-chica">Un solo toque: copia el número del cliente y abre WhatsApp con los dos PDF y el mensaje. En la laptop los descarga y abre WhatsApp Web en su chat.</p>' +
        '<button type="button" class="enlace" id="cartaOtra">O enviar por correo (opcional)</button>';
    }
    return plegable('carta', 'Carta de bienvenida y proforma', chip, cls, h).replace('class="req plg-com', 'class="req plg-com cp');
  }
  // 4. Orden de Odoo y dueño
  function bloqueOrden(F, i, f, P){
    if(!i || !i.comisiona) return '';
    const asigna = !!(F.puedo.asignar && P.asignar);
    const h = '<p>' + (i.orden ? esc(i.orden) + (f.orden_titulo ? '. ' + esc(f.orden_titulo) : '') : i.orden_ok ? 'No tiene orden de Odoo: se asignó a mano.' : 'No hay una orden de Odoo reciente con el nombre de este cliente.') + '</p>' +
      (!i.orden_ok && i.motivo ? '<p class="tx-ambar">' + esc(i.motivo) + '</p>' : '') +
      '<div class="chk"><span>Pertenece a<small>' + esc(i.dueno || 'Por asignar') + (!i.orden_ok && i.dueno ? ' (propuesto)' : '') + '</small></span>' +
      (!asigna ? '' : !i.orden_ok && i.orden && i.dueno && f.orden_id ? '<button type="button" class="mini" id="asigCambiar">Cambiar</button><button type="button" class="mini pri" id="asigConfirmar">Confirmar</button>'
        : !i.orden_ok ? '<button type="button" class="mini pri" id="asigCambiar">Asignar</button>' : '<button type="button" class="mini" id="asigCambiar">Cambiar</button>') + '</div>' +
      (!asigna && !i.orden_ok ? '<p class="nota-chica">La asigna el Analista Senior.</p>' : '');
    return plegable('orden', 'Orden de Odoo', i.orden_ok ? (i.orden ? ordenCorta(i.orden) : 'A mano') : i.orden ? 'Por confirmar' : 'Sin orden', i.orden_ok ? 'verde' : 'ambar', h);
  }
  // Abajo: a quién pertenece, evento, corte, excepción, No comisiona y corregir un corte certificado
  function bloqueAjustes(F, i, f, P){
    if(!i) return '';
    let h = '';
    if(i.comisiona){
      h += bloqueEvento(F, i, P) + bloqueCorte(i, P);
      const exc = !!i.excepcion_corte; const puedeExc = !!(F.puedo.excepcion && P.excepcion);
      if(exc) h += '<div class="req"><div class="req-t">Excepción<span class="m verde">Activa</span></div><p>' + esc(i.excepcion_motivo || '') + (i.excepcion_por ? ' La dio ' + esc(primerNombre(i.excepcion_por)) + '.' : '') + '</p>' +
        (puedeExc ? '<div class="chk"><span>¿Ya no aplica?</span><button type="button" class="mini" id="excQuitar">Quitar excepción</button></div>' : '') + '</div>';
      else if(puedeExc && i.estado !== 'cumple' && i.estado !== 'por_asignar') h += '<div class="req"><div class="req-t">Excepción</div><p>Comisiona aunque no cumpla. Solo la da el administrador y el líder ve el motivo.</p>' +
        '<div class="chk"><span>¿Debe comisionar igual?</span><button type="button" class="mini" id="excAbrir">Dar excepción</button></div></div>';
    } else h += bloqueEvento(F, i, P);
    // No comisiona: la marca el Analista Senior o el administrador con motivo; solo el administrador la vuelve a activar
    if(i.anulada && i.anulada_motivo) h += '<div class="req"><div class="req-t">No comisiona<span class="m rojo">Anulada</span></div><p>Motivo: ' + esc(i.anulada_motivo) + (i.anulada_por ? '. La marcó ' + esc(primerNombre(i.anulada_por)) : '') + (i.anulada_en ? ' el ' + esc(fecha(i.anulada_en)) : '') + '.</p>' +
      (P.reactivar ? '<div class="chk"><span>¿Fue un error?</span><button type="button" class="mini" id="ncReactivar">Volver a activar</button></div>' : '') + '</div>';
    else if(!i.anulada && i.comisiona && P.no_comisiona && !i.en_foto) h += '<div class="req"><div class="req-t">No comisiona</div><p>La instalación deja de contar en Comisiones. Queda en la bandeja "No comisionan" y se puede volver a activar.</p>' +
      '<div class="chk"><span>¿No debe comisionar?</span><button type="button" class="mini" id="ncAbrir">No comisiona</button></div></div>';
    // Corregir un corte certificado (solo administrador): la foto no cambia
    const certCorte = i.en_foto || (d && d.certificado && d.corte === i.corte ? d.corte : null);
    if(P.corregir && certCorte && !i.anulada){
      h += '<div class="req"><div class="req-t">Corte certificado' + (i.correccion ? '<span class="m ambar">Corregida</span>' : '') + '</div>' +
        '<p>' + (i.en_foto ? 'Está en la foto de ' + esc(nombreCorte(i.en_foto).toLowerCase()) + '.' : 'Es de ' + esc(nombreCorte(certCorte).toLowerCase()) + ', pero no quedó en su foto.') +
          (i.correccion ? ' ' + (i.correccion === 'no_se_pago' ? 'Se corrigió: no se pagó y pasó al corte abierto.' : 'Se corrigió: se pagó en ese corte.') + (i.correccion_motivo ? ' Motivo: ' + esc(i.correccion_motivo) + '.' : '') : ' La foto no cambia; la corrección queda en la bitácora.') + '</p>' +
        (i.correccion ? '' : '<div class="acc"><button type="button" class="btn btn-chico btn-2" data-corregir="no_se_pago">No se pagó</button><button type="button" class="btn btn-chico btn-2" data-corregir="se_pago">Se pagó allá</button></div>') + '</div>';
    }
    h += '<div class="req"><div class="req-t">Escribir una nota</div><p>La nota queda en el hilo del cliente.</p><div class="chk"><span>¿Algo que contar?</span><button type="button" class="mini" id="verHiloNota">Escribir una nota</button></div></div>';
    return plegable('ajustes', 'Más acciones', i.anulada ? 'No comisiona' : i.movida ? 'Movida a mano' : '', i.anulada ? 'rojo' : '', h).replace('class="req plg-com', 'class="req plg-com mas-acc');
  }
  function pintarComision(){
    const F = K.F; const c = F.cliente; const i = (F.comision || []).find((x) => Number(x.id) === K.inst) || (F.comision || [])[0];
    const f = (d && d.filas.find((x) => Number(x.instalacion_id) === K.inst)) || {};
    const P = (d && d.puedo) || {}; const est = i ? i.estado : 'no_comisiona';
    const ok = est === 'cumple'; const ultimo = est === 'ultimo_corte'; const perdida = est === 'perdida'; const anulada = est === 'anulada';
    const sinAsignar = est === 'por_asignar'; const exc = !!(i && i.excepcion_corte);
    const tituloEstado = anulada ? 'No comisiona' : !i || !i.comisiona ? 'Esta instalación no comisiona' : sinAsignar ? 'Pendiente por asignar' : ok && exc ? 'Comisiona por excepción en ' + mes(i.corte_pago) : ok ? 'Cumple. Comisiona en ' + mes(i.corte_pago || i.corte)
      : perdida ? 'No cumplió a tiempo: se perdió' : ultimo ? 'Último corte: si no cumple el ' + fecha(F.corte.limite || F.corte.fin).split(' de ')[0] + ' se pierde' : 'Todavía no cumple';
    // Qué le falta, dicho en una línea
    const falta = !i || !i.comisiona ? [] : [!c.legal_ok_en ? 'Legal' : '', !i.pago_ok_en ? 'el pago' : '', !i.orden_ok ? 'la orden de Odoo' : ''].filter(Boolean);
    const sub = anulada ? 'Motivo: ' + (i.anulada_motivo || 'sin motivo') + '.' : !i || !i.comisiona ? (i && i.es_evento && !i.es_aliado ? 'Es un evento y el Analista Senior decidió que no comisiona.' : i && i.es_aliado ? 'Es una instalación de aliado' + (i.instalador ? ': ' + capital(i.instalador) : '') + '. No comisiona.' : 'Los dedicados y las instalaciones de aliado no comisionan.')
      : sinAsignar ? 'No comisiona hasta que el Analista Senior confirme la orden de Odoo y a quién pertenece.'
      : ok && exc ? 'Motivo: ' + (i.excepcion_motivo || 'sin motivo') + (i.excepcion_por ? '. La dio ' + primerNombre(i.excepcion_por) + '.' : '')
      : ok ? 'Tiene Legal, pago y orden de Odoo.'
      : perdida ? 'Era del corte de ' + mes(i.corte) + '.' : (falta.length ? 'Le falta ' + window.Comun.lista(falta) + '. ' : '') + 'Corte de ' + mes(F.corte.etiqueta) + ', límite el ' + fecha(F.corte.limite || F.corte.fin).split(' de ')[0] + '. ' + (F.corte.dias < 0 ? 'El corte sigue abierto hasta que se cierre.' : F.corte.dias === 0 ? 'Es hoy.' : (F.corte.dias === 1 ? 'Falta ' : 'Faltan ') + plural(F.corte.dias, 'día', 'días') + '.');
    // Lote 28/10: resumen arriba (Legal, Pago, Orden); lo que falta primero y abierto; lo listo plegado
    const lOk = !!c.legal_ok_en; const pOk = !!(i && i.pago_ok_en); const oOk = !!(i && i.orden_ok);
    const marca = (t, okx) => '<span class="chip ' + (okx ? 'verde' : 'ambar') + '">' + t + '</span>';
    const faltan = [lOk, pOk, oOk].filter((x) => !x).length;
    let h = '<div class="hc-res ' + (ok ? 'ok' : ultimo || perdida || anulada ? 'mal' : '') + '"><div class="l1"><b>' + esc(ok ? 'Comisiona' : anulada ? 'No comisiona' : !i || !i.comisiona ? 'No comisiona' : 'Aún no comisiona') + '</b>' +
      (i && i.comisiona && !anulada ? '<span class="hc-m">' + marca('Legal', lOk) + marca('Pago', pOk) + marca('Orden', oOk) + '</span>' : '') + '</div>' +
      '<small>' + esc(i && i.comisiona && !ok && !anulada && !perdida ? 'Faltan ' + faltan + ' de 3. ' + sub : tituloEstado + '. ' + sub) + '</small></div>';
    const k0 = i && i.servicio_id ? cartaDe(i, (F.servicios || []).find((x) => Number(x.id) === Number(i.servicio_id))) : null;
    const cartaFalta = !!k0 && ['por_enviar', 'falta_ip'].indexOf(k0.k) >= 0 || (k0 && k0.k === 'lider' && yo.rol !== 'lider');
    if(!K.abInit){ K.abInit = true; K.ab = K.ab || {}; K.ab.legal = !lOk; K.ab.pago = !pOk; K.ab.orden = !oOk; K.ab.carta = cartaFalta || !!K.carta; }
    const bloques = [[!lOk, bloqueLegal(F)], [!pOk, bloquePago(F, i)], [cartaFalta, bloqueCarta(F, i)], [!oOk, bloqueOrden(F, i, f, P)]];
    h += bloques.filter((x) => x[0]).map((x) => x[1]).join('') + bloques.filter((x) => !x[0]).map((x) => x[1]).join('');
    // Siguiente por enviar (cuando se viene de la lista de cartas)
    const sig = K.carta && d ? todasCorte().filter((x) => x.origen === 'corte' && cartaPend(x) && Number(x.instalacion_id) !== K.inst) : [];
    if(sig.length) h += '<button type="button" class="btn btn-ancho hc-sig" data-com="' + esc(sig[0].instalacion_id) + '" data-cliente="' + esc(sig[0].cliente_id) + '" data-carta="1">Siguiente por enviar (' + sig.length + ') ' + ic('derecha') + '</button>';
    h += '<div class="hc-acc"><button type="button" class="btn btn-2" id="abrirExp">Ver expediente completo</button></div>' + bloqueAjustes(F, i, f, P);
    const mov = (F.hilo || []).slice(0, 6);
    h += plegable('hilo', 'Hilo', plural((F.hilo || []).length, 'registro', 'registros'), 'gris', (mov.length ? '<div class="hilo" style="padding:4px 0 0">' + mov.map(window.Ficha.lineaHilo).join('') + '</div>' : '<p>Todavía no hay movimientos.</p>') +
      ((F.hilo || []).length > 6 ? '<button type="button" class="enlace" id="verHilo">Ver todo el hilo</button>' : ''));
    $('cuerpoCom').innerHTML = h;
    // La línea de datos de arriba: RIF · Código · Líder · instalada · corte
    const dt = $('cabCom') && $('cabCom').querySelector('.dat');
    if(dt && i) dt.textContent = [docFmt(c.doc_tipo, c.doc_numero), i.codigo ? 'Código ' + String(i.codigo).replace(/^0+/, '') : '', (i.es_aliado ? 'Aliado ' : 'Líder ') + (i.dueno || capital(i.instalador || '') || 'por asignar'), i.instalada_en ? 'instalada ' + diaMes(i.instalada_en) : '', i.corte ? 'corte de ' + mes(i.corte) : ''].filter(Boolean).join(' · ');
  }

  // Lote urgente 20/10: cambiar de corte (solo entre el corte en curso y el siguiente, ambos abiertos)
  function opcionesCorte(i){
    if(!d || !i || !i.corte) return [];
    const abiertos = [d.actual, d.siguiente].filter(Boolean);
    return abiertos.indexOf(i.corte) < 0 ? [] : abiertos.filter((c) => c !== i.corte);
  }
  function bloqueCorte(i, P){
    if(!i || !i.comisiona) return '';
    const ops = P.asignar ? opcionesCorte(i) : [];
    if(!i.movida && !ops.length) return '';
    return '<div class="req"><div class="req-t">Corte' + (i.movida ? '<span class="m ambar">Movida a mano</span>' : '') + '</div>' +
      '<p>Cuenta en el corte de ' + esc(mes(i.corte)) + '.' + (i.movida ? ' Por su fecha era de ' + esc(mes(i.corte_natural)) + '. Motivo: ' + esc(i.movida_motivo || 'sin motivo') + '.' : '') + '</p>' +
      (ops.length ? '<div class="chk"><span>¿Debe contar en otro corte?</span><button type="button" class="mini" id="corteCambiar">Cambiar de corte</button></div>' : '') + '</div>';
  }
  // Ajuste del administrador: cuántos días después de instalar tiene que ser el TAD que da el pago
  function abrirPagoDias(){
    const h = hojaChica('hojaPagoDias', 'tPagoDias');
    h.innerHTML = cabHoja('tPagoDias', 'Días para el pago', 'Pago de la instalación con el TAD') + '<form id="formPagoDias" novalidate>' +
      '<label class="rotulo" for="pagoDias">Días después de instalar</label><input class="campo" id="pagoDias" type="number" inputmode="numeric" min="0" max="30" data-foco>' +
      '<p class="nota-chica">Un TAD cargado antes de esos días no da el pago, porque la cuenta por cobrar de la instalación se genera después. Queda en la bitácora.</p>' +
      '<div class="error" id="ePagoDias" role="alert"></div><div class="acciones"><button type="submit" class="btn btn-ancho" id="pagoDiasGuardar">Guardar</button></div></form>';
    abrirHoja('hojaPagoDias');
    rpc('pago_dias', {}).then((n) => { const x = $('pagoDias'); if(x) x.value = n; }).catch((e) => { const er = $('ePagoDias'); if(er) er.textContent = e.message; });
  }
  // Hoja chica con motivo: No comisiona y corregir un corte certificado
  const MOTIVO = {
    nc: { t: 'No comisiona', nota: 'Deja de contar en Comisiones y queda en la bandeja "No comisionan". Solo el administrador la vuelve a activar.', b: 'No comisiona' },
    no_se_pago: { t: 'No se pagó', nota: 'Pasa al corte abierto para pagarse allí. La foto del corte certificado no cambia.', b: 'Pasar al corte abierto' },
    se_pago: { t: 'Se pagó allá', nota: 'Queda pagada en el corte certificado y no vuelve a salir. La foto no cambia.', b: 'Marcar pagada allá' }
  };
  function abrirMotivo(tipo){
    const m = MOTIVO[tipo]; if(!m || !K || !K.F) return;
    hojaChica('hojaMotivoCom', 'tMotivoCom').innerHTML = cabHoja('tMotivoCom', m.t, K.F.cliente.nombre) + '<form id="formMotivoCom" novalidate data-tipo="' + tipo + '">' +
      '<label class="rotulo" for="motivoCom">Motivo</label><textarea class="area corta" id="motivoCom" maxlength="500" data-foco></textarea>' +
      '<p class="nota-chica">' + m.nota + ' Queda en la bitácora.</p>' +
      '<div class="error" id="eMotivoCom" role="alert"></div><div class="acciones"><button type="submit" class="btn btn-ancho" id="motivoComGuardar">' + m.b + '</button></div></form>';
    abrirHoja('hojaMotivoCom');
  }
  function abrirCambioCorte(){
    if(!K || !K.F) return;
    const i = (K.F.comision || []).find((x) => Number(x.id) === K.inst); const ops = opcionesCorte(i); if(!ops.length) return;
    hojaChica('hojaCorteMov', 'tCorteMov').innerHTML = cabHoja('tCorteMov', 'Cambiar de corte', K.F.cliente.nombre) + '<form id="formCorteMov" novalidate>' +
      '<p class="nota">Ahora cuenta en ' + esc(nombreCorte(i.corte).toLowerCase()) + '. Solo se cambia entre cortes abiertos.</p>' +
      (ops.length === 1 ? '<div class="estado al-gris"><b>Pasa a ' + esc(nombreCorte(ops[0]).toLowerCase()) + '</b><small>Es el otro corte abierto.</small></div><button type="button" class="on" data-corte-mov="' + esc(ops[0]) + '" hidden></button>'
        : '<span class="rotulo" id="rCorteMov">Pasar a</span><div class="tres" role="radiogroup" aria-labelledby="rCorteMov">' +
          ops.map((c, n) => '<button type="button" role="radio" data-corte-mov="' + esc(c) + '" aria-checked="' + (n === 0) + '" class="' + (n === 0 ? 'on' : '') + '">' + esc(nombreCorte(c)) + '</button>').join('') + '</div>') +
      '<label class="rotulo" for="corteMovMotivo">Motivo</label><textarea class="area corta" id="corteMovMotivo" maxlength="500" data-foco></textarea>' +
      '<p class="nota-chica">Queda en la bitácora y la fila dice "Movida a mano".</p>' +
      '<div class="error" id="eCorteMov" role="alert"></div><div class="acciones"><button type="submit" class="btn btn-ancho" id="corteMovGuardar">Cambiar de corte</button></div></form>';
    abrirHoja('hojaCorteMov');
  }
  function bajarProforma(){
    const F = K && K.F; const i = F && (F.comision || []).find((x) => Number(x.id) === K.inst);
    const sv = i && (F.servicios || []).find((x) => Number(x.id) === Number(i.servicio_id)); if(!sv) return;
    const D = window.Documentos;
    try {
      const x = D.datosDe(F, sv);
      window.Archivos.descargar(new File([D.proforma(x)], D.nombreArchivo('proforma', x.nombre), { type: 'application/pdf' }), D.nombreArchivo('proforma', x.nombre));
      if((sv.carta || {}).puede) window.Archivos.descargar(new File([D.carta(x)], D.nombreArchivo('bienvenida', x.nombre), { type: 'application/pdf' }), D.nombreArchivo('bienvenida', x.nombre));
      toast((sv.carta || {}).puede ? 'Proforma y carta descargadas' : 'Proforma descargada. La carta sale cuando la instalación tenga dueño');
    } catch (e) { toast('No se pudo armar el PDF. Intenta de nuevo', 'error'); }
  }
  // Evento: mientras no haya nomenclatura lo marca el Analista Senior y decide si comisiona
  function bloqueEvento(F, i, P){
    if(!i || i.es_aliado || (!i.comisiona && !i.es_evento)) return '';
    const puede = !!(F.puedo.evento && P.asignar);
    const valor = !i.es_evento ? 'no' : i.evento_comisiona || (i.comisiona && i.evento_comisiona !== false) ? 'si_com' : 'si_no';
    if(!puede && !i.es_evento) return '';
    const txt = { no: 'No es evento', si_com: 'Evento: comisiona', si_no: 'Evento: no comisiona' };
    return '<div class="req"><div class="req-t">Evento<span class="m ' + (valor === 'no' ? 'gris' : 'azul') + '">' + txt[valor] + '</span></div>' +
      (puede ? '<p>' + (i.evento_manual ? 'Marcado a mano.' : 'Con EVENTO en el título de la orden se marca solo.') + ' Decide aquí si comisiona.</p>' +
        '<div class="tres" role="radiogroup" aria-label="Evento">' + [['no', 'No es evento'], ['si_com', 'Comisiona'], ['si_no', 'No comisiona']].map((x) =>
          '<button type="button" role="radio" data-evento="' + x[0] + '" aria-checked="' + (valor === x[0]) + '" class="' + (valor === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div>'
        : '<p>Lo decide el Analista Senior.</p>') + '</div>';
  }

  // ---------- Hojas pequeñas: orden y dueño, excepción y certificar ----------
  function hojaChica(idHoja, idTitulo){
    let h = $(idHoja);
    if(!h){ h = document.createElement('section'); h.id = idHoja; h.className = 'hoja'; h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', idTitulo); h.setAttribute('aria-hidden', 'true'); document.body.appendChild(h); window.Comun.prepararHojas(); }
    return h;
  }
  const cabHoja = (idTitulo, titulo, sub) => '<div class="cab"><div><h2 id="' + idTitulo + '">' + esc(titulo) + '</h2>' + (sub ? '<p class="sub-hoja">' + esc(sub) + '</p>' : '') + '</div><button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>';

  let A = null;   // { inst, ordenes, tocado }
  function abrirAsignar(){
    if(!K || !K.F) return;
    const f = d.filas.find((x) => Number(x.instalacion_id) === K.inst) || {}; const i = (K.F.comision || []).find((x) => Number(x.id) === K.inst) || {};
    A = { inst: K.inst, ordenes: null, tocado: false, actual: f.orden_id || null };
    const duenos = d.duenos || []; const mio = normalizeStr(i.dueno);
    hojaChica('hojaAsignar', 'tAsig').innerHTML = cabHoja('tAsig', 'Orden y dueño', K.F.cliente.nombre) + '<form id="formAsig" novalidate>' +
      '<span class="rotulo" id="rAsigOrd">Orden de Odoo</span><div class="ops" id="asigOrdenes" role="radiogroup" aria-labelledby="rAsigOrd"><span class="sk" style="height:56px;border-radius:12px;display:block"></span></div>' +
      '<label class="rotulo arriba" for="asigBusca">Buscar otra orden</label><div class="busca-linea"><input class="campo" id="asigBusca" maxlength="60" autocomplete="off" enterkeyhint="search"><button type="button" class="btn btn-2 btn-chico" id="asigBuscar">Buscar</button></div>' +
      '<p class="nota-chica">Escribe el número de la orden o el nombre del cliente como está en Odoo.</p>' +
      '<label class="rotulo arriba" for="asigDueno">Pertenece a</label><select class="campo" id="asigDueno"><option value="">Elige a quién pertenece</option>' +
      duenos.map((n) => '<option value="' + esc(n) + '"' + (normalizeStr(n) === mio ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select>' +
      '<div class="error" id="eAsig" role="alert"></div><div class="acciones"><button type="submit" class="btn btn-ancho" id="asigGuardar">Guardar</button></div></form>';
    abrirHoja('hojaAsignar'); buscarOrdenes('');
  }
  async function buscarOrdenes(texto){
    if(!A) return; const mia = A; const z = $('asigOrdenes'); const antes = (document.querySelector('#asigOrdenes input:checked') || {}).value;
    try {
      const r = await rpc('ordenes_buscar', { p_instalacion: A.inst, p_texto: texto || null }); if(A !== mia) return;
      A.ordenes = r || [];
      const marcada = antes !== undefined ? antes : (A.ordenes.some((o) => o.id === A.actual && !o.motivo) ? String(A.actual) : null);
      z.innerHTML = A.ordenes.map((o) => '<label class="opr' + (o.motivo ? ' no' : '') + '"><input type="radio" name="asigOrden" value="' + esc(o.id) + '"' + (o.motivo ? ' disabled' : '') + (String(o.id) === marcada ? ' checked' : '') + '>' +
          '<span><b>' + esc(ordenCorta(o.numero)) + '</b><small>' + esc(o.titulo || '') + '</small><small>' + esc([o.creador ? 'La creó ' + o.creador : '', o.creada_en ? 'el ' + fecha(o.creada_en) : '', o.etapa].filter(Boolean).join(' · ')) + '</small>' +
          (o.motivo ? '<small class="mal">No sirve: ' + esc(o.motivo.toLowerCase()) + '</small>' : '') + '</span></label>').join('') +
        (A.ordenes.length ? '' : '<p class="nota-chica" style="margin:0 0 8px">' + (texto ? 'Ninguna orden coincide con esa búsqueda.' : 'No hay órdenes recientes con el nombre de este cliente. Busca abajo o asígnala a mano.') + '</p>') +
        '<label class="opr"><input type="radio" name="asigOrden" value=""' + (marcada === '' ? ' checked' : '') + '><span><b>Sin orden de Odoo</b><small>Se asigna a mano. Queda anotado quién lo hizo.</small></span></label>';
    } catch (e) { if(A !== mia) return; z.innerHTML = '<p class="nota-chica mal" role="alert">' + esc(e.message) + '</p>'; toast(e.message, 'error'); }
  }
  async function asignar(orden, dueno, boton, alError){
    const texto = boton.textContent; boton.disabled = true; boton.textContent = 'Guardando…';
    try {
      await rpc('instalacion_asignar', { p_instalacion: K.inst, p_orden: orden, p_dueno: dueno });
      toast('Asignada a ' + dueno); if(hojaAbierta() === 'hojaAsignar') cerrarHoja(); tras();
    } catch (e) { if(alError) alError(e.message); else toast(e.message, 'error'); if(document.contains(boton)){ boton.disabled = false; boton.textContent = texto; } }
  }
  function abrirExcepcion(){
    if(!K || !K.F) return;
    hojaChica('hojaExc', 'tExc').innerHTML = cabHoja('tExc', 'Excepción de comisión', K.F.cliente.nombre) + '<form id="formExc" novalidate>' +
      '<label class="rotulo" for="excMotivo">Motivo</label><textarea class="area corta" id="excMotivo" maxlength="500" data-foco></textarea>' +
      '<p class="nota-chica">Comisiona en ' + esc(nombreCorte(d.corte)) + ' aunque le falte Legal o el pago. El líder verá el motivo.</p>' +
      '<div class="error" id="eExc" role="alert"></div><div class="acciones"><button type="submit" class="btn btn-ancho" id="excGuardar">Dar excepción</button></div></form>';
    abrirHoja('hojaExc');
  }
  function abrirLegal(quitar){
    if(!K || !K.F) return;
    hojaChica('hojaLegal', 'tLegal').innerHTML = cabHoja('tLegal', quitar ? 'Quitar Legal' : 'Aprobar Legal', K.F.cliente.nombre) + '<form id="formLegal" novalidate data-quita-legal="' + (quitar ? '1' : '0') + '">' +
      '<label class="rotulo" for="legalMotivo">Motivo' + (quitar ? ' (opcional)' : '') + '</label><textarea class="area corta" id="legalMotivo" maxlength="500" data-foco></textarea>' +
      '<p class="nota-chica">' + (quitar ? 'Deja de contar para la comisión del corte abierto. Un corte certificado no cambia.' : 'Legal cuenta como listo aunque falten documentos. Lo que falta sigue saliendo como Falta en el expediente.') + ' Queda en la bitácora.</p>' +
      '<div class="error" id="eLegal" role="alert"></div><div class="acciones"><button type="submit" class="btn btn-ancho" id="legalGuardar">' + (quitar ? 'Quitar Legal' : 'Aprobar Legal') + '</button></div></form>';
    abrirHoja('hojaLegal');
  }
  // Cerrar corte: resumen del servidor (cuántas cumplen, cuántas pasan al siguiente) y confirmación
  function abrirCertificar(){
    const h = hojaChica('hojaCert', 'tCert');
    h.innerHTML = cabHoja('tCert', 'Cerrar ' + nombreCorte(d.corte).toLowerCase(), 'Del ' + fecha(d.inicio) + ' al ' + fecha(d.fin)) +
      '<div id="certCuerpo"><div class="sk-bloque"><span class="sk" style="height:56px;border-radius:14px"></span><span class="sk" style="height:56px;border-radius:14px"></span></div></div>';
    abrirHoja('hojaCert');
    const c = d.corte;
    rpc('corte_cierre_resumen', { p_corte: c }).then((r) => {
      const z = $('certCuerpo'); if(!z || !d || d.corte !== c) return;
      ['total', 'cumplen', 'pasan', 'se_pierden', 'por_asignar'].forEach((k) => { r[k] = Number(r[k]) || 0; });
      z.innerHTML = '<div class="estado verde"><b>' + r.cumplen + ' de ' + r.total + ' comisionan</b><small>Es lo que queda en el Excel del corte.</small></div>' +
        (r.pasan ? '<div class="estado ambar"><b>' + plural(r.pasan, 'pasa', 'pasan') + ' al corte siguiente</b><small>No cumplieron en este corte. Tienen el siguiente para cumplir.</small></div>' : '') +
        (r.se_pierden ? '<div class="estado rojo"><b>' + plural(r.se_pierden, 'se pierde', 'se pierden') + '</b><small>Era su último corte y no cumplieron. Queda la constancia.</small></div>' : '') +
        (r.por_asignar ? '<div class="estado ambar"><b>' + plural(r.por_asignar, 'queda', 'quedan') + ' por asignar</b><small>Si cierras ahora, no comisionan en este corte.</small></div>' : '') +
        '<p class="nota-chica">Al cerrar, el corte queda fijo: lo que cambie después ya no lo mueve. Queda en la bitácora.</p>' +
        '<div class="acciones"><button type="button" class="btn btn-ancho" id="certificar">Cerrar corte</button></div>';
    }).catch((e) => { const z = $('certCuerpo'); if(z) z.innerHTML = '<div class="estado rojo"><b>No se pudo preparar el cierre</b><small>' + esc(e.message) + '. Intenta de nuevo.</small></div>'; });
  }
  // Lo que se gestiona desde aquí abre el expediente encima; al cerrarlo se vuelve a esta hoja ya actualizada
  function alExpediente(o){ if(!K) return; window.Ficha.abrir(K.cliente, Object.assign({ yo, alCerrar: tras }, o || {})); }
  function tras(){ cache.borrarTodo(); if(K) cargarComision(); cargar(); }

  document.addEventListener('click', (e) => {
    const f = e.target.closest('#filtros [data-filtro], #alertas [data-filtro]');
    if(f){ if(f.closest('#alertas') && !porAsignar()){ abrirExtra('sin_lider'); return; }
      filtro = filtro === f.dataset.filtro && f.closest('#alertas') ? 'todos' : f.dataset.filtro; seg = 'inst'; guardarUrl(); if(d) pintar(); else pintarFiltros(); return; }
    const g = e.target.closest('#lista [data-grupo]');
    if(g){ const l = g.dataset.grupo; abiertos[l] = !g.parentNode.classList.contains('abierto'); g.parentNode.classList.toggle('abierto', abiertos[l]); g.setAttribute('aria-expanded', String(abiertos[l])); return; }
    const m = e.target.closest('[data-mas]');
    if(m){ completos[m.dataset.mas] = true; const g = m.closest('.grupo'); abiertos[g.dataset.k || g.dataset.lider] = true; pintarLista(); return; }
    if(e.target.closest('#lista #reintentar')){ cargar(); return; }
    const sg = e.target.closest('[data-seg]'); if(sg && d){ seg = seg === sg.dataset.seg && seg !== 'inst' ? 'inst' : sg.dataset.seg; if(seg !== 'inst') filtro = 'todos'; guardarUrl(); pintar(); return; }
    const eq = e.target.closest('#equipos [data-equipo]'); if(eq && d){ equipo = eq.dataset.equipo; if(seg === 'cartas') seg = 'inst'; filtro = 'todos'; guardarUrl(); pintar(); return; }
    const ab = e.target.closest('[data-abrir]'); if(ab){ abrirExtra(ab.dataset.abrir); return; }
    const t = e.target; let b;
    if((b = t.closest('[data-com]'))){ abrirComision(b.dataset.com, b.dataset.cliente, !!b.dataset.carta); return; }
    // Carta y proforma: un solo botón por WhatsApp, correo opcional y ver los PDF
    const iK = () => K && K.F && (K.F.comision || []).find((x) => Number(x.id) === K.inst);
    if((b = t.closest('#cartaWa')) && iK()){ const sid = iK().servicio_id; b.disabled = true;
      window.Ficha.cartaWhatsapp(K.F, sid, tras).then((r) => { if(r && K){ K.paso2 = Object.assign({ servicio: sid }, r); pintarComision(); } else if(document.contains(b)) b.disabled = false; })
        .catch((e) => { toast('No se pudo abrir WhatsApp. Intenta de nuevo', 'error'); if(document.contains(b)) b.disabled = false; }); return; }
    if(t.closest('#cartaOtra') && iK()){ window.Ficha.cartaOtra(K.F, iK().servicio_id, tras); return; }
    if((b = t.closest('[data-cp-pdf]')) && iK()){ window.Ficha.cartaPdf(K.F, iK().servicio_id, b.dataset.cpPdf); return; }
    if(t.closest('#verHiloNota')){ alExpediente({ tab: 'hilo' }); return; }
    if((b = t.closest('[data-exp]'))){ window.Ficha.abrir(Number(b.dataset.exp), { yo, alCerrar: tras }); return; }
    if(t.closest('#reintentarCom')){ cargarComision(); return; }
    if(t.closest('#abrirExp')){ alExpediente({ tab: 'datos' }); return; }
    if(t.closest('#verHilo')){ alExpediente({ tab: 'hilo' }); return; }
    // Documentos dentro de la hoja de comisión: las mismas casillas del expediente
    if((b = t.closest('[data-plg-btn]')) && K){ K.ab = K.ab || {}; const id = b.dataset.plgBtn; K.ab[id] = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', String(K.ab[id]));
      const z = $(b.getAttribute('aria-controls')); if(z) z.hidden = !K.ab[id]; return; }
    // Firma Digital o Física (Física = contrato presencial)
    if((b = t.closest('[data-firma]')) && K && K.F){ if(b.classList.contains('on')) return; const fis = b.dataset.firma === 'fisica';
      Array.prototype.forEach.call(document.querySelectorAll('[data-firma]'), (x) => { x.disabled = true; });
      rpc('cliente_marca', { p_cliente: K.F.cliente.id, p_marca: 'contrato_presencial', p_valor: fis }).then(() => { toast(fis ? 'Firma física: no se piden correos ni teléfono' : 'Firma digital'); tras(); })
        .catch((err) => { toast(err.message, 'error'); Array.prototype.forEach.call(document.querySelectorAll('[data-firma]'), (x) => { x.disabled = false; }); }); return; }
    if((b = t.closest('#pagoNotaGuardar')) && K){ const n = $('pagoNota').value.trim(); $('ePagoNota').textContent = ''; b.disabled = true; b.textContent = 'Guardando…';
      rpc('instalacion_pago_nota', { p_instalacion: K.inst, p_nota: n }).then(() => { toast('Nota guardada'); tras(); })
        .catch((err) => { $('ePagoNota').textContent = err.message; if(document.contains(b)){ b.disabled = false; b.textContent = 'Guardar nota'; } }); return; }
    if(t.closest('#ncAbrir') && K){ abrirMotivo('nc'); return; }
    if(t.closest('#pagoDiasAbrir')){ abrirPagoDias(); return; }
    if((b = t.closest('[data-corregir]')) && K){ abrirMotivo(b.dataset.corregir); return; }
    if((b = t.closest('#ncReactivar')) && K){ b.disabled = true;
      rpc('instalacion_no_comisiona', { p_instalacion: K.inst, p_si: false, p_motivo: '' }).then(() => { toast('Vuelve a comisionar'); tras(); })
        .catch((err) => { toast(err.message, 'error'); if(document.contains(b)) b.disabled = false; }); return; }
    if(t.closest('#docsCom') && K && K.F){
      if((b = t.closest('[data-subir]'))){ const p = b.dataset.subir.split(':'); window.Ficha.subirA(K.F, p[0], Number(p[1]), tras); return; }
      if((b = t.closest('[data-campo]'))){ window.Ficha.editarCampo(K.F, b.dataset.campo, tras); return; }
      if((b = t.closest('[data-ver]'))){ const cs = b.closest('[data-casilla]'); alExpediente({ tab: 'documentos', casilla: cs ? cs.dataset.casilla : null }); return; }
      if(t.closest('#comVarios')){ window.Ficha.variosA(K.F, tras); return; }
      if((b = t.closest('[data-marca-cli]'))){ const nuevo = b.getAttribute('aria-checked') !== 'true'; b.disabled = true;
        rpc('cliente_marca', { p_cliente: K.F.cliente.id, p_marca: b.dataset.marcaCli, p_valor: nuevo }).then(() => { toast(nuevo ? 'Marcado como contrato presencial' : 'Ya no es contrato presencial'); tras(); })
          .catch((err) => { toast(err.message, 'error'); if(document.contains(b)) b.disabled = false; }); return; }
    }
    if((b = t.closest('[data-ir-doc]'))){ alExpediente({ tab: 'documentos', casilla: b.dataset.irDoc }); return; }
    // Subir un documento o escribir un dato se hace aquí mismo, sin saltar al expediente
    if((b = t.closest('[data-sube-doc]')) && K && K.F){ const p = b.dataset.subeDoc.split(':'); window.Ficha.subirA(K.F, p[0], Number(p[1]), tras); return; }
    if((b = t.closest('[data-ir-campo]')) && K && K.F){ window.Ficha.editarCampo(K.F, b.dataset.irCampo, tras); return; }
    if(t.closest('#pedirCom') && K && K.F){ const c = K.F.cliente; window.Pedir.abrir({ id: c.id, nombre: c.nombre, es_natural: c.es_natural, estatus: c.estatus, falta: K.F.faltantes, tel: c.tel, correo: c.correo }, { yo: yo.nombre, alHacer: tras }); return; }
    if(t.closest('#bajarExcel') && d){ bajarExcel(); return; }
    if(t.closest('#profBajar') && K && K.F){ bajarProforma(); return; }
    if(t.closest('#profEnviar') && K && K.F){ const i = (K.F.comision || []).find((x) => Number(x.id) === K.inst); if(i && i.servicio_id) window.Ficha.enviarDesde(K.F, i.servicio_id, tras); return; }
    if(t.closest('#profIp') && K && K.F){ const i = (K.F.comision || []).find((x) => Number(x.id) === K.inst); if(i && i.servicio_id) window.Ficha.editarCampo(K.F, 'ip:' + i.servicio_id, tras); return; }
    if((b = t.closest('[data-evento]')) && K && K.F){ if(b.classList.contains('on')) return; const v = b.dataset.evento;
      Array.prototype.forEach.call(document.querySelectorAll('[data-evento]'), (x) => { x.disabled = true; });
      rpc('instalacion_evento', { p_instalacion: K.inst, p_evento: v !== 'no', p_comisiona: v === 'si_com' }).then(() => { toast(v === 'no' ? 'Quitada la marca de evento' : v === 'si_com' ? 'Evento: comisiona' : 'Evento: no comisiona'); tras(); })
        .catch((err) => { toast(err.message, 'error'); Array.prototype.forEach.call(document.querySelectorAll('[data-evento]'), (x) => { x.disabled = false; }); }); return; }
    if((b = t.closest('[data-pend]')) && d){ abrirPendientes(b.dataset.pend); return; }
    if((b = t.closest('#pendEnviar'))){ enviarPendientes(b); return; }
    if(t.closest('#pendVerPdf') && P && P.datos){ let f; try { f = pdfPendientes(); } catch (err) { toast('No se pudo armar el PDF. Intenta de nuevo', 'error'); return; }
      const u = URL.createObjectURL(f); const w = window.open(u, '_blank'); if(!w) window.Archivos.descargar(f, f.name); setTimeout(() => URL.revokeObjectURL(u), 120000); return; }
    if(t.closest('#abrirCert') && d){ abrirCertificar(); return; }
    if(t.closest('[data-cerrar-corte]') && d){ abrirCertificar(); return; }
    if((b = t.closest('#certificar')) && d){ b.disabled = true; b.textContent = 'Cerrando…';
      rpc('corte_certificar', { p_corte: d.corte }).then((r) => { toast('Corte cerrado' + (r && r.pasan ? '. ' + plural(r.pasan, 'pasa', 'pasan') + ' al siguiente' : '')); if(hojaAbierta() === 'hojaCert') cerrarHoja(); cache.borrarTodo(); corte = ''; d = null; cargar(); })
        .catch((err) => { toast(err.message, 'error'); if(document.contains(b)){ b.disabled = false; b.textContent = 'Cerrar corte'; } }); return; }
    if((b = t.closest('#quitarCert')) && d){ b.disabled = true;
      rpc('corte_descertificar', { p_corte: d.corte }).then(() => { toast('Certificación quitada'); cache.borrarTodo(); cargar(); }).catch((err) => { toast(err.message, 'error'); if(document.contains(b)) b.disabled = false; }); return; }
    if(t.closest('#asigCambiar') && K){ abrirAsignar(); return; }
    if((b = t.closest('#asigConfirmar')) && K && K.F){
      const f = d.filas.find((x) => Number(x.instalacion_id) === K.inst) || {}; const i = (K.F.comision || []).find((x) => Number(x.id) === K.inst) || {};
      if(!f.orden_id || !i.dueno){ abrirAsignar(); return; }
      asignar(f.orden_id, i.dueno, b); return; }
    if(t.closest('#asigBuscar') && A){ buscarOrdenes($('asigBusca').value.trim()); return; }
    if(t.closest('#excAbrir') && K){ abrirExcepcion(); return; }
    if(t.closest('#corteCambiar') && K){ abrirCambioCorte(); return; }
    if((b = t.closest('[data-corte-mov]'))){ Array.prototype.forEach.call(document.querySelectorAll('[data-corte-mov]'), (x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); }); return; }
    if((b = t.closest('#legalCheck')) && K){ abrirLegal(b.dataset.quitaLegal === '1'); return; }
    if((b = t.closest('#excQuitar')) && K){ b.disabled = true;
      rpc('instalacion_excepcion', { p_instalacion: K.inst, p_corte: null, p_motivo: null }).then(() => { toast('Excepción quitada'); tras(); }).catch((err) => { toast(err.message, 'error'); if(document.contains(b)) b.disabled = false; }); return; }
    // Lote urgente 20/10: quitar un pago pide confirmación en el mismo lugar
    if(t.closest('[data-pago-no]')){ const z = $('pagoConfirma'); if(z){ z.remove(); const x = $('pagoCom'); if(x){ x.closest('.chk').classList.remove('hidden'); x.focus(); } } return; }
    if((b = t.closest('#pagoCom')) && K && b.dataset.pagada === '0'){
      const fila = b.closest('.chk'); if(!fila || $('pagoConfirma')) return; fila.classList.add('hidden');
      fila.insertAdjacentHTML('afterend', '<div class="chk" id="pagoConfirma" role="alertdialog" aria-label="Quitar el pago"><span>¿Quitar el pago de este cliente?<small>Deja de contar para la comisión. El TAD no lo vuelve a marcar solo.</small></span>' +
        '<button type="button" class="mini" data-pago-no>No</button><button type="button" class="mini pri" id="pagoSi" data-pagada="0">Sí, quitar</button></div>');
      $('pagoSi').focus(); return; }
    if((b = t.closest('#pagoCom, #pagoSi')) && K){ b.disabled = true; const pagada = b.dataset.pagada === '1';
      rpc('instalacion_pago', { p_instalacion: K.inst, p_pagada: pagada }).then(() => { toast(pagada ? 'Instalación marcada como pagada' : 'Pago quitado'); tras(); }).catch((err) => { toast(err.message, 'error'); if(document.contains(b)) b.disabled = false; }); }
  });
  const sinSobre = () => Array.prototype.forEach.call(document.querySelectorAll('#docsCom .sobre'), (x) => x.classList.remove('sobre'));
  document.addEventListener('dragover', (e) => { const z = e.target.closest && e.target.closest('#docsCom'); if(!z) return; e.preventDefault(); sinSobre(); const c = e.target.closest('[data-suelta]'); (c || z).classList.add('sobre'); });
  document.addEventListener('dragleave', (e) => { const z = $('docsCom'); if(z && !z.contains(e.relatedTarget)) sinSobre(); });
  document.addEventListener('drop', (e) => {
    const z = e.target.closest && e.target.closest('#docsCom'); if(!z || !K || !K.F) return;
    e.preventDefault(); sinSobre();
    const files = Array.prototype.slice.call((e.dataTransfer && e.dataTransfer.files) || []); if(!files.length) return;
    const c = e.target.closest('[data-suelta]');
    if(c){ const p = c.dataset.casilla.split(':'); window.Ficha.soltarA(K.F, p[0], Number(p[1]), files, tras); }
    else window.Ficha.variosA(K.F, tras, files);
  });
  // Mientras se sube desde aquí, la casilla dice "Subiendo"
  document.addEventListener('ficha-subida', () => { if(K && K.F && document.querySelector('#hojaComision.ver')) pintarComision(); });
  document.addEventListener('submit', (e) => {
    if(e.target.id === 'formAsig' && A && K){ e.preventDefault(); const er = $('eAsig'); er.textContent = '';
      const m = document.querySelector('#asigOrdenes input:checked'); const dueno = $('asigDueno').value;
      if(!m){ er.textContent = 'Elige la orden o marca Sin orden de Odoo'; return; }
      if(!dueno){ er.textContent = 'Elige a quién pertenece'; $('asigDueno').focus(); return; }
      asignar(m.value ? Number(m.value) : null, dueno, $('asigGuardar'), (msj) => { er.textContent = msj; }); return; }
    if(e.target.id === 'formLegal' && K){ e.preventDefault(); const er = $('eLegal'); er.textContent = ''; const m = $('legalMotivo').value.trim(); const b = $('legalGuardar');
      const quitar = e.target.dataset.quitaLegal === '1'; const txt = b.textContent;
      if(!quitar && m.length < 3){ er.textContent = 'Escribe el motivo'; $('legalMotivo').focus(); return; }
      b.disabled = true; b.textContent = 'Guardando…';
      rpc(quitar ? 'legal_quitar' : 'legal_aprobar', { p_cliente: K.cliente, p_motivo: m || null }).then(() => { toast(quitar ? 'Legal quitado' : 'Legal aprobado a mano'); if(hojaAbierta() === 'hojaLegal') cerrarHoja(); tras(); })
        .catch((err) => { er.textContent = err.message; b.disabled = false; b.textContent = txt; }); return; }
    if(e.target.id === 'formPagoDias'){ e.preventDefault(); const er = $('ePagoDias'); er.textContent = ''; const v = $('pagoDias').value.trim(); const b = $('pagoDiasGuardar');
      if(!/^\d{1,2}$/.test(v) || Number(v) > 30){ er.textContent = 'Escribe un número de días entre 0 y 30'; $('pagoDias').focus(); return; }
      b.disabled = true; b.textContent = 'Guardando…';
      rpc('pago_dias_guardar', { p_dias: Number(v) }).then((n) => { toast('El TAD da el pago desde ' + plural(n, 'día', 'días') + ' después de instalar'); if(hojaAbierta() === 'hojaPagoDias') cerrarHoja(); })
        .catch((err) => { er.textContent = err.message; b.disabled = false; b.textContent = 'Guardar'; }); return; }
    if(e.target.id === 'formMotivoCom' && K){ e.preventDefault(); const er = $('eMotivoCom'); er.textContent = ''; const m = $('motivoCom').value.trim(); const b = $('motivoComGuardar'); const tipo = e.target.dataset.tipo;
      if(m.length < 5){ er.textContent = 'Escribe el motivo'; $('motivoCom').focus(); return; }
      b.disabled = true; b.textContent = 'Guardando…';
      const pr = tipo === 'nc' ? rpc('instalacion_no_comisiona', { p_instalacion: K.inst, p_si: true, p_motivo: m }) : rpc('instalacion_corregir_certificado', { p_instalacion: K.inst, p_accion: tipo, p_motivo: m });
      pr.then(() => { toast(tipo === 'nc' ? 'Ya no comisiona' : tipo === 'no_se_pago' ? 'Pasó al corte abierto' : 'Quedó pagada en el corte certificado'); if(hojaAbierta() === 'hojaMotivoCom') cerrarHoja(); tras(); })
        .catch((err) => { er.textContent = err.message; b.disabled = false; b.textContent = MOTIVO[tipo].b; }); return; }
    if(e.target.id === 'formCorteMov' && K){ e.preventDefault(); const er = $('eCorteMov'); er.textContent = ''; const m = $('corteMovMotivo').value.trim(); const b = $('corteMovGuardar');
      const el = document.querySelector('[data-corte-mov].on'); const c = el ? el.dataset.corteMov : '';
      if(!c){ er.textContent = 'Elige el corte'; return; }
      if(m.length < 5){ er.textContent = 'Escribe el motivo del cambio'; $('corteMovMotivo').focus(); return; }
      b.disabled = true; b.textContent = 'Guardando…';
      rpc('instalacion_mover_corte', { p_instalacion: K.inst, p_corte: c, p_motivo: m }).then(() => { toast('Ahora cuenta en ' + nombreCorte(c).toLowerCase()); if(hojaAbierta() === 'hojaCorteMov') cerrarHoja(); tras(); })
        .catch((err) => { er.textContent = err.message; b.disabled = false; b.textContent = 'Cambiar de corte'; }); return; }
    if(e.target.id === 'formExc' && K){ e.preventDefault(); const er = $('eExc'); er.textContent = ''; const m = $('excMotivo').value.trim(); const b = $('excGuardar');
      if(m.length < 5){ er.textContent = 'Escribe el motivo de la excepción'; $('excMotivo').focus(); return; }
      b.disabled = true; b.textContent = 'Guardando…';
      rpc('instalacion_excepcion', { p_instalacion: K.inst, p_corte: d.corte, p_motivo: m }).then(() => { toast('Excepción guardada'); if(hojaAbierta() === 'hojaExc') cerrarHoja(); tras(); })
        .catch((err) => { er.textContent = err.message; b.disabled = false; b.textContent = 'Dar excepción'; }); }
  });
  document.addEventListener('change', (e) => {
    if(e.target.id === 'asigDueno' && A){ A.tocado = true; return; }
    // Al elegir una orden se propone a quien la creó, si nadie ha tocado el dueño
    if(e.target.name === 'asigOrden' && A && !A.tocado && e.target.value){
      const o = (A.ordenes || []).find((x) => String(x.id) === e.target.value); const s = $('asigDueno');
      const op = o && Array.prototype.find.call(s.options, (x) => x.value && normalizeStr(x.value) === normalizeStr(o.creador));
      if(op && !s.value) s.value = op.value;
    }
  });
  document.addEventListener('keydown', (e) => { if(e.key === 'Enter' && e.target.id === 'asigBusca'){ e.preventDefault(); if(A) buscarOrdenes(e.target.value.trim()); } });
  let tBusca = null;
  $('busca').addEventListener('input', () => { clearTimeout(tBusca); tBusca = setTimeout(() => { busca = $('busca').value.trim(); guardarUrl(); if(d) pintarLista(); }, 140); });
  $('corte').addEventListener('change', () => { corte = $('corte').value; d = null; cargar(); });

  window.Armazon.arrancar(['admin', 'abogado', 'lider', 'analista'], { activo: 'comisiones' }, (p) => {
    yo = p;
    window.Ficha.montar();
    // Lote 28/10: el Resumen de Comisiones va por corte (comisiones-resumen.js)
    if(window.Resumen && p.rol !== 'abogado') window.Resumen.enModulo({ modulo: 'comisiones', yo: p, crear: window.ComResumen ? window.ComResumen.crear : undefined });
    leerUrl(); $('busca').value = busca;
    cargar();
    if(pedidoInicial) setTimeout(() => abrirExtra(pedidoInicial), 0);
  }, (p) => { yo = p; });
})();
