// Comisiones: quién cumple en el corte, qué le falta a cada cliente y cómo viene el mes.
(function(){
  'use strict';
  const { $, esc, ic, rpc, toast, cache, esqueleto, vacio, fecha, mes, capital, plural, chipEstatus, docFmt, abrirHoja, cerrarHoja, hojaAbierta, casilla, MOTIVOS, primerNombre, dia, hora, normalizeStr } = window.Comun;
  const S = window.Sesion;
  const FILTROS = [
    { id: 'todos', t: 'Todos' }, { id: 'asignar', t: 'Por asignar' }, { id: 'ultimo', t: 'Último corte' }, { id: 'legal', t: 'Falta legal' },
    { id: 'pago', t: 'Debe instalación' }, { id: 'subir', t: 'Archivos por subir' }, { id: 'eventos', t: 'Eventos' }
  ];
  // Filtros que solo salen cuando tienen algo (o están elegidos)
  const OPCIONALES = ['asignar', 'subir', 'eventos'];
  const TOPE = 8;   // filas por bloque antes de "Ver más"
  let yo = null; let d = null; let vista = 'corte'; let PI = null; let pedidoPI = 0; let filtro = 'todos'; let corte = ''; let pedido = 0; let busca = '';
  const abiertos = {}; const completos = {};

  function leerUrl(){
    const u = new URLSearchParams(location.search);
    const f = u.get('f'); filtro = FILTROS.some((x) => x.id === f) ? f : 'todos';
    busca = (u.get('q') || '').slice(0, 60);
    vista = u.get('t') === 'instalar' ? 'instalar' : 'corte';
    const c = u.get('c'); corte = /^\d{4}-(0[1-9]|1[0-2])/.test(c || '') ? c.slice(0, 7) + '-01' : '';
  }
  function guardarUrl(){
    const u = new URLSearchParams();
    if(vista === 'instalar') u.set('t', 'instalar');
    if(filtro !== 'todos' && vista === 'corte') u.set('f', filtro);
    if(busca) u.set('q', busca);
    if(d && corte && corte !== d.actual) u.set('c', corte.slice(0, 7));
    const s = u.toString();
    history.replaceState(history.state, '', location.pathname + (s ? '?' + s : ''));
  }
  const nombreCorte = (c) => capital(mes(c + 'T12:00:00Z')) + ' ' + String(c).slice(0, 4);
  function menosMeses(c, n){ let a = Number(c.slice(0, 4)); let m = Number(c.slice(5, 7)) - n; while(m < 1){ m += 12; a--; } return a + '-' + String(m).padStart(2, '0') + '-01'; }

  const ordenCorta = (o) => String(o || '').split('/').pop();
  // El buscador mira nombre, líder, RIF o cédula, código y número de orden
  function coincide(f){
    const b = normalizeStr(busca); if(!b) return true;
    const dg = busca.replace(/\D/g, '');
    return normalizeStr(f.nombre).indexOf(b) >= 0 || normalizeStr(f.lider).indexOf(b) >= 0 ||
      (dg.length >= 3 && (String(f.doc || '').replace(/\D/g, '').indexOf(dg) >= 0 || String(f.codigo || '').indexOf(dg) >= 0 || String(f.orden || '').replace(/\D/g, '').indexOf(dg) >= 0));
  }
  const porAsignar = () => (d ? d.filas.filter((f) => !f.orden_ok).length : 0);
  function pasa(f){
    if(filtro === 'asignar') return !f.orden_ok;
    if(filtro === 'ultimo') return f.origen === 'anterior';
    if(filtro === 'legal') return !f.legal_ok;
    if(filtro === 'pago') return !f.pago_ok;
    if(filtro === 'subir') return !!f.por_subir;
    return true;
  }
  function conteo(id){
    if(!d) return '';
    if(id === 'todos') return d.filas.length;
    if(id === 'eventos') return (d.eventos || []).length;
    const g = filtro; filtro = id; const n = d.filas.filter(pasa).length; filtro = g; return n;
  }

  function pintarCorte(){
    const actual = d ? d.actual : corte; if(!actual) return;
    const ops = [0, 1, 2, 3, 4, 5].map((n) => menosMeses(actual, n));
    const elegido = d ? d.corte : corte; if(elegido && ops.indexOf(elegido) < 0) ops.push(elegido);
    $('corte').innerHTML = ops.map((c, i) => '<option value="' + c + '"' + (c === (d ? d.corte : corte) ? ' selected' : '') + '>' + esc(nombreCorte(c)) + (i === 0 ? ' (en curso)' : '') + '</option>').join('');
  }
  function pintarFiltros(){
    $('filtros').innerHTML = FILTROS.filter((f) => (OPCIONALES.indexOf(f.id) < 0 || filtro === f.id || Number(conteo(f.id)) > 0)).map((f) => {
      const n = conteo(f.id);
      return '<button type="button" role="tab" data-filtro="' + f.id + '" class="' + (f.id === filtro ? 'on' : '') + '" aria-selected="' + (f.id === filtro) + '">' + esc(f.t) + (n === '' ? '' : ' <em>' + esc(n) + '</em>') + '</button>';
    }).join('');
    const ay = $('ayudaFiltro'); if(ay) ay.innerHTML = ayudaFiltro();
  }
  function pintarMets(){
    const propias = d.filas.filter((f) => f.origen === 'corte'); const ult = d.filas.filter((f) => f.origen === 'anterior');
    const cumplen = d.filas.filter((f) => f.cumple).length;
    const enCurso = d.corte === d.actual;
    const lim = d.limite || d.fin;
    $('rango').textContent = 'Instalaciones del ' + fecha(d.inicio) + ' al ' + fecha(d.fin) + (enCurso ? '. Legal y pago hasta el ' + fecha(lim).split(' de ')[0] + ': ' + (d.dias > 0 ? 'faltan ' + plural(d.dias, 'día', 'días') : 'es hoy') : '. Corte cerrado');
    $('mets').innerHTML =
      '<div class="met negro"><b>' + cumplen + '</b><small>' + (enCurso ? 'Cumplen hasta hoy' : 'Cumplieron') + ' de ' + d.filas.length + '</small></div>' +
      '<div class="met"><b>' + propias.length + '</b><small>Instaladas en el corte</small></div>' +
      '<div class="met"><b' + (ult.some((f) => !f.cumple) ? ' class="alerta"' : '') + '>' + ult.filter((f) => !f.cumple).length + '</b><small>En su último corte</small></div>' +
      '<div class="met solo-pc"><b>' + d.filas.filter((f) => !f.legal_ok).length + '</b><small>Les falta legal</small></div>' +
      '<div class="met solo-pc"><b>' + d.filas.filter((f) => !f.pago_ok).length + '</b><small>Deben la instalación</small></div>';
  }
  function marca(ok, texto, revisar){
    return '<span class="m ' + (ok ? 'verde' : revisar ? 'ambar' : 'rojo') + '">' + ic(ok ? 'check' : revisar ? 'alerta' : 'x') + esc(texto) + '</span>';
  }
  function ordenTexto(f){
    if(f.orden_ok) return f.orden ? 'Orden ' + esc(ordenCorta(f.orden)) : 'Asignada a mano';
    return f.orden ? '<span class="tx-ambar">Orden ' + esc(ordenCorta(f.orden)) + ' por confirmar</span>' : '<span class="tx-rojo">Sin orden</span>';
  }
  // Etiquetas informativas de la fila: archivos por subir y la carta de bienvenida
  function etiquetas(f){
    let h = '';
    if(f.instalador === 'Cambio de categoría') h += '<span class="tagn verde">Cambio de categoría</span>';
    if(f.por_subir) h += '<span class="tagn ambar">' + (f.aprobado_por_subir ? 'Aprobado, documentos por subir' : 'Archivos por subir') + '</span>';
    if(f.servicio_id) h += f.bienvenida_en ? '<span class="tagn verde">Enviada ' + esc(diaMes(f.bienvenida_en)) + '</span>' : '<span class="tagn">Bienvenida por enviar</span>';
    return h;
  }
  const diaMes = (x) => { const t = new Date(x); return isNaN(t) ? '' : String(t.getDate()).padStart(2, '0') + '/' + String(t.getMonth() + 1).padStart(2, '0'); };
  function fila(f){
    const marcas = !f.orden_ok ? '<span class="m ambar">' + ic('alerta') + 'Por asignar</span>'
      : f.excepcion && f.cumple ? marca(true, 'Excepción')
      : marca(f.legal_ok, 'Legal') + marca(f.pago_ok, f.revisar_pago ? 'Revisar pago' : 'Pago', f.revisar_pago);
    return '<button type="button" class="fila" data-com="' + esc(f.instalacion_id) + '" data-cliente="' + esc(f.cliente_id) + '">' +
      '<span class="tx"><b>' + esc(f.nombre) + '</b><small>' + (f.es_natural ? '<span class="tagn">Natural</span>' : '') + esc(f.codigo || '') + ' · ' + esc(fecha(f.instalada_en)) + ' · ' + ordenTexto(f) + '</small>' +
        (!f.orden_ok && f.motivo ? '<small class="motivo">' + esc(f.motivo) + '</small>' : '') + (etiquetas(f) ? '<small class="etqs">' + etiquetas(f) + '</small>' : '') + '</span>' +
      '<span class="par-m">' + marcas + '</span></button>';
  }
  function bloque(clave, titulo, filas, tono){
    if(!filas.length) return '';
    const todo = completos[clave] || filas.length <= TOPE; const ver = todo ? filas : filas.slice(0, TOPE);
    return '<div class="sub-bloque ' + (tono || 'liso') + '">' + esc(titulo) + '<span class="n2">' + filas.filter((f) => f.cumple).length + ' de ' + filas.length + ' cumplen</span></div>' +
      ver.map(fila).join('') +
      (todo ? '' : '<button type="button" class="fila mas" data-mas="' + esc(clave) + '">Ver ' + (filas.length - TOPE) + ' más</button>');
  }
  // Qué quiere decir cada filtro que confunde (lote 2, C)
  const AYUDA = {
    pago: 'Debe instalación: según el TAD, el cliente todavía no ha pagado la instalación. Mientras no la pague, no comisiona. Se quita sola cuando el TAD trae el pago.',
    asignar: 'Por asignar: no se sabe de qué líder es la instalación (la orden no tiene código de vendedor o la creó otra persona). No comisiona hasta que el Analista Senior le pone dueño.'
  };
  function ayudaFiltro(){
    // Lote 3: los clientes con excepción pagada en un corte anterior no están en este corte; se gestionan en Clientes
    const xp = filtro === 'subir' && d && d.exc_pagada ? ' <a class="enlace" href="clientes.html?f=por_subir">' + plural(d.exc_pagada, 'cliente', 'clientes') + ' con excepción pagada también ' + (d.exc_pagada === 1 ? 'tiene' : 'tienen') + ' archivos por subir. Ver en Clientes</a>' : '';
    return AYUDA[filtro] || xp ? '<p class="ayuda-filtro" role="note">' + esc(AYUDA[filtro] || '') + xp + '</p>' : '';
  }
  function pintarLista(){
    if(filtro === 'eventos'){
      const p = (d.eventos || []).filter(coincide);
      if(!p.length){ $('lista').innerHTML = vacio('Sin eventos', 'Las instalaciones marcadas como evento que no comisionan salen aquí.'); return; }
      $('lista').innerHTML = '<div class="grupo abierto"><div class="sub-bloque liso" style="border-top:0">Eventos que no comisionan<span class="n2">Ábrelos para decidir</span></div>' +
        p.map((o) => '<button type="button" class="fila" data-com="' + esc(o.instalacion_id) + '" data-cliente="' + esc(o.cliente_id) + '"><span class="tx"><b>' + esc(o.nombre) + '</b><small>' + esc(o.codigo || '') + ' · ' + esc(fecha(o.instalada_en)) + ' · ' + esc(o.lider) + '</small></span><span class="m azul">Evento</span></button>').join('') + '</div>';
      return;
    }
    const filas = d.filas.filter(pasa).filter(coincide);
    if(!filas.length){
      $('lista').innerHTML = busca && d.filas.filter(pasa).length ? vacio('Sin resultados', 'Nadie coincide con "' + busca + '". Revisa cómo está escrito o busca por código o número de orden.')
        : d.filas.length ? vacio('Nada en este filtro', 'Prueba con otro filtro o mira todos.') : vacio('Sin instalaciones en este corte', 'Cuando se instale un servicio que comisiona aparecerá aquí.');
      return;
    }
    const grupos = []; const idx = {};
    filas.forEach((f) => { const l = f.lider || 'Sin líder'; if(idx[l] === undefined){ idx[l] = grupos.length; grupos.push({ lider: l, filas: [] }); } grupos[idx[l]].filas.push(f); });
    const solo = grupos.length === 1 || !!busca || filtro === 'asignar';
    $('lista').innerHTML = grupos.map((g) => {
      const cumplen = g.filas.filter((f) => f.cumple).length; const ult = g.filas.filter((f) => f.origen === 'anterior' && !f.cumple).length;
      const abierto = solo || abiertos[g.lider];
      return '<div class="grupo' + (abierto ? ' abierto' : '') + '" data-lider="' + esc(g.lider) + '">' +
        '<button type="button" class="grupo-cab" data-grupo="' + esc(g.lider) + '" aria-expanded="' + !!abierto + '"><span class="tx"><b>' + esc(g.lider) + '</b><small>' + plural(g.filas.length, 'instalación', 'instalaciones') +
          (ult ? ' · <span class="mal">' + ult + ' en último corte</span>' : '') + '</small></span><span class="num">' + cumplen + ' de ' + g.filas.length + '</span>' + ic('abajo') + '</button>' +
        '<div class="grupo-cuerpo">' + barraPendientes(g) +
          bloque(g.lider + '|a', 'Último corte: si no cumplen se pierden', g.filas.filter((f) => f.origen === 'anterior'), 'rojo') +
          bloque(g.lider + '|c', 'Instaladas en este corte', g.filas.filter((f) => f.origen === 'corte')) +
        '</div></div>';
    }).join('');
  }
  function pintarLado(){
    const comp = d.comparativa || []; const max = Math.max(1, ...comp.map((c) => c.total));
    const lid = d.lideres || []; const maxL = Math.max(1, ...lid.map((l) => Math.max(l.actual, l.anterior)));
    let h = '<div class="panel"><span class="tit">Últimos 6 cortes</span><p class="nota-chica">Instalaciones que comisionan en cada corte</p>' +
      comp.map((c) => '<div class="bar-fila"><span>' + esc(capital(mes(c.corte + 'T12:00:00Z')).slice(0, 3)) + '</span><span class="bar"><i class="' + (c.corte === d.actual ? 'curso' : '') + '" style="transform:scaleX(' + (c.total / max).toFixed(3) + ')"></i></span><b>' + esc(c.total) + '</b></div>').join('') + '</div>';
    if(lid.length > 1){
      h += '<div class="panel" style="margin-top:16px"><span class="tit">Por líder</span><p class="nota-chica">' + esc(nombreCorte(d.corte)) + ' frente al corte anterior</p>' +
        lid.map((l) => '<div class="bar-fila ancha"><span>' + esc(l.lider) + '</span><span class="bar"><i style="transform:scaleX(' + (l.actual / maxL).toFixed(3) + ')"></i></span><b>' + esc(l.actual) + '</b></div>' +
          '<div class="bar-fila ancha" style="margin-top:3px"><span class="nota-chica" style="margin:0">Anterior</span><span class="bar"><i class="curso" style="transform:scaleX(' + (l.anterior / maxL).toFixed(3) + ')"></i></span><b style="color:var(--text2)">' + esc(l.anterior) + '</b></div>').join('') + '</div>';
    }
    $('lado').innerHTML = h;
  }
  function pintar(){
    pintarCorte(); pintarMets(); pintarAvisos(); pintarFiltros(); pintarVistas();
    if(vista === 'corte'){ pintarLista(); pintarLado(); }
  }

  // ---------- Pestaña Por instalar: órdenes de Odoo abiertas sin instalación, con su reloj ----------
  const conInstalar = () => !!yo && ['admin', 'analista', 'lider'].indexOf(yo.rol) >= 0;
  function pintarVistas(){
    if(!conInstalar()){ $('vistas').innerHTML = ''; return; }
    const rojas = PI ? vigentes(PI.filas).filter((o) => o.color === 'rojo').length : 0;
    $('vistas').innerHTML = [['corte', 'Corte'], ['instalar', 'Por instalar']].map((x) => '<button type="button" role="tab" data-vista="' + x[0] + '" aria-selected="' + (vista === x[0]) + '" class="' + (vista === x[0] ? 'on' : '') + '">' + x[1] +
      (x[0] === 'instalar' && rojas ? ' <em>' + rojas + '</em>' : '') + '</button>').join('');
    // Los cambios viven en Migraciones; aquí solo el aviso de los que esperan la decisión de comisión
    const av = $('avisoCam'); if(av) av.innerHTML = porDecidir ? '<a class="cam-dec" href="migraciones.html?f=decidir">' + ic('cambio') + '<span>' + esc(plural(porDecidir, 'cambio por decidir', 'cambios por decidir')) + '<small>Se deciden en Migraciones</small></span>' + ic('derecha', 'ch') + '</a>' : '';
    document.querySelector('main').classList.toggle('vista-instalar', vista !== 'corte');
  }
  function cambiarVista(v){
    if(v === vista) return; vista = v; guardarUrl(); pintarVistas();
    if(vista === 'instalar') cargarInstalar(); else if(d){ pintarLista(); pintarLado(); } else cargar();
  }
  // Cambios a PYME confirmados que esperan Sí o No de comisión (se deciden en Migraciones). Sale del mismo resumen de Mi trabajo,
  // así solo lo ven el Analista Senior y el administrador (los que deciden)
  let porDecidir = 0;
  async function cargarPorDecidir(){
    if(!yo || ['admin', 'analista'].indexOf(yo.rol) < 0) return;
    try { const r = await rpc('trabajo_resumen', {}); porDecidir = ((r && r.tipos && r.tipos.cambio_comision) || {}).n || 0; pintarVistas(); }
    catch (e) { /* El aviso es secundario: si falla, Comisiones sigue igual y Migraciones lo muestra */ }
  }
  async function cargarInstalar(){
    const mio = ++pedidoPI; const clave = 'instalar:' + yo.rol;
    if(!PI){ const g = cache.leer(clave); if(g){ PI = g; pintarInstalar(); } else if(vista === 'instalar') $('lista').innerHTML = esqueleto(5); }
    try {
      const r = await rpc('por_instalar'); if(mio !== pedidoPI) return;
      PI = r; PI.filas = PI.filas || []; cache.guardar(clave, PI); pintarVistas(); if(vista === 'instalar') pintarInstalar();
    } catch (e) {
      if(mio !== pedidoPI) return;
      if(!PI && vista === 'instalar') $('lista').innerHTML = '<div class="vacio" role="alert"><b>No se pudieron cargar las órdenes</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" id="reintentarPI">Reintentar</button></div>';
      toast(e.message, 'error');
    }
  }
  const horasTexto = (h) => { const n = Math.floor(Number(h) || 0); return n < 1 ? 'Recién' : n + ' h'; };
  function filaInstalar(o){
    const tono = o.color === 'rojo' ? 'rojo' : o.color === 'ambar' ? 'ambar' : 'gris';
    const etq = (o.veces ? '<span class="tagn ambar">Reprogramada ' + (o.veces === 1 ? '1 vez' : o.veces + ' veces') + '</span>' : '') +
      (o.provisional ? '<span class="tagn azul">Provisional</span>' : '') + (o.lider === 'Por asignar' ? '<span class="tagn rojo">Dueño por asignar</span>' : '');
    const sub = esc(ordenCorta(o.numero)) + ' · ' + esc(o.etapa || 'Sin etapa') + ' · Registrada el ' + esc(fecha(o.inicio)) + ', ' + esc(hora(o.inicio));
    const cuerpo = '<span class="tx"><b>' + esc(o.cliente || 'Cliente nuevo') + '</b><small>' + sub + '</small>' + (etq ? '<small class="etqs">' + etq + '</small>' : '') + '</span>' +
      '<span class="m ' + tono + '" title="Horas contadas de 8:00 a 22:00">' + ic('reloj') + esc(horasTexto(o.horas)) + '</span>';
    let acc = '';
    if(o.parecido_id) acc += '<div class="ins-acc"><span>¿Es este cliente? <b>' + esc(o.parecido || '') + '</b></span><button type="button" class="mini pri" data-es-cli="si" data-orden="' + esc(o.orden_id) + '" data-cli="' + esc(o.parecido_id) + '">Sí, es ese</button><button type="button" class="mini" data-es-cli="no" data-orden="' + esc(o.orden_id) + '">No, es otro</button></div>';
    if(PI.puedo && PI.puedo.asignar && o.provisional && o.lider === 'Por asignar') acc += '<div class="ins-acc"><span>La orden la creó otra persona sin código.</span><button type="button" class="mini pri" data-dueno-prov="' + esc(o.cliente_id) + '" data-nombre="' + esc(o.cliente) + '">Elegir dueño</button></div>';
    return '<div class="ins">' + (o.cliente_id && !o.parecido_id ? '<button type="button" class="fila" data-exp="' + esc(o.cliente_id) + '">' + cuerpo + '</button>' : '<div class="fila">' + cuerpo + '</div>') + acc + '</div>';
  }
  // Indicadores arriba (mismo dato que la lista): faltan, en rojo, horas promedio, la más vieja, reprogramadas y por líder
  function kpisInstalar(todas){
    if(!todas.length) return '';
    const rojas = todas.filter((o) => o.color === 'rojo').length; const rep = todas.filter((o) => o.veces > 0).length;
    const hs = todas.map((o) => Number(o.horas) || 0); const prom = Math.round(hs.reduce((a, x) => a + x, 0) / hs.length);
    const vieja = todas.reduce((m, o) => ((Number(o.horas) || 0) > (Number(m.horas) || 0) ? o : m), todas[0]);
    const g = {}; todas.forEach((o) => { g[o.lider || 'Por asignar'] = (g[o.lider || 'Por asignar'] || 0) + 1; });
    const lid = yo.rol === 'lider' ? '' : '<div class="ik lideres"><small>Faltan por líder</small><div class="ik-chips">' +
      Object.keys(g).sort((x, y) => g[y] - g[x] || x.localeCompare(y)).map((l) => '<span class="ik-chip' + (l === 'Por asignar' ? ' rojo' : '') + '">' + esc(l) + ' <b>' + g[l] + '</b></span>').join('') + '</div></div>';
    return '<div class="ins-kpis" role="group" aria-label="Resumen de órdenes por instalar">' +
      '<div class="ik grande"><small>Faltan por instalar</small><b>' + todas.length + '</b><span>' + (rojas ? '<em class="ik-rojo">' + plural(rojas, 'en rojo', 'en rojo') + '</em> · pasadas de 24 h de reloj' : 'Ninguna en rojo') + '</span></div>' +
      '<div class="ik"><small>Promedio</small><b>' + prom + ' h</b><span>de reloj</span></div>' +
      '<div class="ik"><small>La más vieja</small><b>' + esc(horasTexto(vieja.horas)) + '</b><span>' + esc(vieja.cliente || 'Cliente nuevo') + '</span></div>' +
      '<div class="ik"><small>Reprogramadas</small><b>' + rep + '</b><span>' + (rep ? 'movidas en Odoo' : 'ninguna') + '</span></div>' + lid + '</div>';
  }
  // Lote 3: solo órdenes creadas desde el 01/10/2026; las anteriores con "Ver anteriores"
  let verAnt = false;
  const vigentes = (l) => (l || []).filter((o) => verAnt || !o.anterior);
  function pintarInstalar(){
    if(!PI || vista !== 'instalar') return;
    const ok = (o) => { const b = normalizeStr(busca); return !b || normalizeStr(o.cliente).indexOf(b) >= 0 || normalizeStr(o.lider).indexOf(b) >= 0 || String(o.numero || '').indexOf(busca) >= 0; };
    const filas = vigentes(PI.filas).filter(ok); let h = kpisInstalar(vigentes(PI.filas));
    const nAnt = (PI.filas || []).concat(PI.realizadas || []).filter((o) => o.anterior).length;
    // Bandeja 1: órdenes abiertas en Odoo que todavía no se instalan
    h += '<section class="bandeja-ins" aria-labelledby="bIns1"><div class="bandeja-cab"><h3 id="bIns1">Órdenes abiertas sin instalar</h3><span class="n">' + filas.length + '</span></div>' +
      '<p class="nota-chica ins-ayuda">El reloj cuenta de 8:00 a 22:00, todos los días, desde la primera orden. Ámbar a las 16 horas y rojo a las 24. Se apaga cuando llega la instalación o Odoo la cancela.</p>';
    if(!filas.length) h += vacio(busca ? 'Sin resultados' : 'Nada por instalar', busca ? 'Nadie coincide con "' + busca + '".' : 'No hay órdenes abiertas sin instalación. Cuando un líder monte una orden en Odoo, aparece aquí.');
    else if(yo.rol === 'lider') h += '<div class="grupo abierto">' + filas.map(filaInstalar).join('') + '</div>';
    else {
      const g = {}; filas.forEach((o) => { (g[o.lider] = g[o.lider] || []).push(o); });
      const peso = (l) => g[l].filter((o) => o.color === 'rojo').length * 1000 + g[l].filter((o) => o.color === 'ambar').length;
      h += Object.keys(g).sort((a, b) => peso(b) - peso(a) || a.localeCompare(b)).map((l) => {
        const ab = abiertos['i|' + l] !== undefined ? abiertos['i|' + l] : true;   // es una lista de trabajo corta: abre con todo a la vista
        const r = g[l].filter((o) => o.color === 'rojo').length;
        return '<div class="grupo' + (ab ? ' abierto' : '') + '"><button type="button" class="grupo-cab" data-grupo="i|' + esc(l) + '" aria-expanded="' + ab + '"><span class="tx"><b>' + esc(l) + '</b><small>' +
          plural(g[l].length, 'orden abierta', 'órdenes abiertas') + (r ? ' · <span class="mal">' + r + ' en rojo</span>' : '') + '</small></span>' + ic('abajo') + '</button><div class="grupo-cuerpo">' + g[l].map(filaInstalar).join('') + '</div></div>';
      }).join('');
    }
    h += '</section>';
    // Bandeja 2: Odoo dice realizada pero la instalación no llegó (solo quien puede verla)
    const re = vigentes(PI.realizadas).filter((o) => ok(Object.assign({ numero: o.numero }, o)));
    if(PI.puedo && PI.puedo.realizadas){
      h += '<section class="bandeja-ins" aria-labelledby="bIns2"><div class="bandeja-cab"><h3 id="bIns2">Realizadas en Odoo sin instalación</h3><span class="n">' + re.length + '</span></div>' +
        '<p class="nota-chica ins-ayuda">Órdenes de los últimos 60 días que Odoo marca como realizadas y no tienen instalación en el TAD. Revisa si falta cargar el TAD o falló el cruce.</p>';
      h += !re.length ? vacio('Todo cuadra', 'Cada orden realizada en Odoo tiene su instalación.') : '<div class="grupo abierto">' +
        re.map((o) => '<' + (o.cliente_id ? 'button type="button" data-exp="' + esc(o.cliente_id) + '"' : 'div') + ' class="fila"><span class="tx"><b>' + esc(o.cliente) + '</b><small>' + esc(ordenCorta(o.numero)) + ' · ' + esc(o.lider || 'Sin líder') +
          ' · Realizada el ' + esc(fecha(o.ejecutada_en || o.creada_en)) + '</small></span><span class="m azul">Realizado</span></' + (o.cliente_id ? 'button' : 'div') + '>').join('') + '</div>';
      h += '</section>';
    }
    if(nAnt) h += '<p class="nota-chica ins-ant">' + (verAnt ? 'Incluye las órdenes creadas antes del 01/10. ' : 'Solo órdenes creadas desde el 01/10. ') +
      '<button type="button" class="enlace" id="verAnteriores">' + (verAnt ? 'Ocultar anteriores' : 'Ver anteriores (' + nAnt + ')') + '</button></p>';
    $('lista').innerHTML = h;
  }
  function abrirDuenoProv(cliente, nombre){
    const h = hojaChica('hojaDueno', 'tDueno');
    h.innerHTML = cabHoja('tDueno', 'Dueño del cliente', nombre) + '<form id="formDueno" novalidate data-cliente="' + esc(cliente) + '"><label class="rotulo" for="duenoSel">Pertenece a</label><select class="campo" id="duenoSel"><option value="">Elige el líder</option>' +
      ((PI && PI.duenos) || []).map((x) => '<option>' + esc(x) + '</option>').join('') + '</select><div class="error" id="eDueno" role="alert"></div>' +
      '<p class="nota">La orden la creó otra persona sin código de vendedor. El cliente queda a nombre del líder que elijas.</p><div class="acciones"><button type="submit" class="btn btn-ancho" id="guardarDueno">Guardar</button></div></form>';
    abrirHoja('hojaDueno');
  }
  // Lo que pide atención en el corte y lo que se puede hacer con él
  function pintarAvisos(){
    const P = d.puedo || {}; const n = porAsignar(); let h = '';
    if(d.certificado) h += '<div class="franja verde">' + ic('check') + '<span><b>Corte certificado</b>' + esc((d.certificado.por ? 'Por ' + primerNombre(d.certificado.por) + ', el ' : 'El ') + fecha(d.certificado.en)) + '. Lo que ves quedó fijo.</span>' +
      (P.quitar_certificado ? '<button type="button" class="mini" id="quitarCert">Quitar</button>' : '') + '</div>';
    if(n && filtro !== 'asignar') h += '<button type="button" class="franja ambar" data-filtro="asignar">' + ic('alerta') + '<span><b>' + plural(n, 'pendiente', 'pendientes') + ' por asignar</b>' +
      'No se sabe de qué líder son. ' + (P.asignar ? 'No comisionan hasta que confirmes la orden y a quién pertenecen.' : 'No comisionan hasta que el Analista Senior las asigne.') + '</span>' + ic('derecha') + '</button>';
    $('avisos').innerHTML = h;
    $('acciones').innerHTML = (d.filas.length ? '<button type="button" class="mini" id="bajarExcel">' + ic('doc') + 'Bajar Excel</button>' : '') +
      (P.certificar ? '<button type="button" class="mini pri" id="abrirCert">' + ic('check') + 'Certificar corte</button>' : '');
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
    const cierre = x.dias <= 0 ? 'Hoy, el ' + dia + ', es el límite para Legal y pago' : 'El límite para Legal y pago es el ' + dia + ' y ' + (x.dias === 1 ? 'falta 1 día' : 'faltan ' + x.dias + ' días');
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
    const mio = ++pedido; const clave = 'comisiones3:' + (corte || 'actual');
    const guardado = cache.leer(clave);
    if(guardado && guardado.rol === yo.rol){ d = guardado; pintar(); }
    else { if(vista === 'corte') $('lista').innerHTML = esqueleto(5); $('mets').innerHTML = '<span class="sk" style="height:76px;border-radius:18px"></span><span class="sk" style="height:76px;border-radius:18px"></span><span class="sk" style="height:76px;border-radius:18px"></span>'; $('lado').innerHTML = ''; }
    try {
      const r = await rpc('comisiones_corte', { p_corte: corte || null });
      if(mio !== pedido) return;
      d = r; d.filas = d.filas || []; corte = d.corte; cache.guardar(clave, d);
      pintar(); guardarUrl(); if(K && K.F) pintarComision();
    } catch (e) {
      if(mio !== pedido) return;
      if(!d && vista === 'corte') $('lista').innerHTML = '<div class="vacio" role="alert"><b>No se pudieron cargar las comisiones</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" id="reintentar">Reintentar</button></div>';
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
  function abrirComision(inst, cliente){
    montarHoja();
    const f = d.filas.find((x) => String(x.instalacion_id) === String(inst)) || (d.eventos || []).find((x) => String(x.instalacion_id) === String(inst)) || {};
    K = { inst: Number(inst), cliente: Number(cliente), F: null }; profAbierto = false;
    $('cabCom').innerHTML = '<div class="f-cab"><div class="tx"><h2 class="nom" id="tCom">' + esc(f.nombre || 'Cliente') + '</h2><p class="dat">' + esc([f.sucursal && f.codigo ? f.sucursal + '-' + f.codigo : f.codigo, f.instalada_en ? 'Instalado el ' + fecha(f.instalada_en) : ''].filter(Boolean).join(' · ')) + '</p></div>' +
      '<button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>';
    $('cuerpoCom').innerHTML = '<div class="sk-bloque"><span class="sk" style="height:64px;border-radius:16px"></span><span class="sk" style="height:150px;border-radius:16px"></span><span class="sk" style="height:90px;border-radius:16px"></span></div>';
    abrirHoja('hojaComision');
    cargarComision();
  }
  async function cargarComision(){
    if(!K) return; const mia = K;
    try { const F = await rpc('cliente_ficha', { p_cliente: mia.cliente }); if(K !== mia) return; K.F = F; pintarComision(); }
    catch (e) { if(K !== mia) return; $('cuerpoCom').innerHTML = '<div class="aviso" role="alert"><b>No se pudo abrir</b><p>' + esc(e.message) + '</p><p style="margin-top:14px"><button type="button" class="btn btn-chico" id="reintentarCom">Reintentar</button></p></div>'; toast(e.message, 'error'); }
  }
  // Una línea del checklist de Legal: hecha, por revisar, devuelta o por hacer
  function itemDoc(F, cas, num, nombre){
    const x = (F.documentos || []).find((y) => y.casilla === cas && y.numero === num); const k = cas + ':' + num;
    if(x && x.estado === 'aprobado') return [1, '<div class="chk"><i class="ok">' + ic('check') + '</i><span>' + esc(nombre) + '</span></div>'];
    if(x && x.estado === 'por_revisar') return [0, '<div class="chk"><i class="rv">' + ic('reloj') + '</i><span>' + esc(nombre) + '<small>Subido. Legal lo está revisando</small></span><button type="button" class="mini" data-ir-doc="' + k + '">Ver</button></div>'];
    if(x && x.estado === 'devuelto') return [0, '<div class="chk"><i class="no"></i><span>' + esc(nombre) + '<small class="mal">Devuelto' + (x.revisado_por ? ' por ' + esc(primerNombre(x.revisado_por)) : '') + (x.revisado_en ? ' ' + esc(dia(x.revisado_en).toLowerCase()) : '') + ': ' + esc((MOTIVOS[x.motivo] || 'revisa la nota').toLowerCase()) + (x.nota ? '. "' + esc(x.nota) + '"' : '') + '</small></span><button type="button" class="mini pri" data-sube-doc="' + k + '">Subir de nuevo</button></div>'];
    return [0, '<div class="chk"><i class="no"></i><span>' + esc(nombre) + '</span><button type="button" class="mini pri" data-sube-doc="' + k + '">Subir</button></div>'];
  }
  // Contacto del representante: teléfono y correo en una sola línea
  function itemContacto(r, n, natural, presencial){
    const tel = String(r.telefono || '').trim(); const co = String(r.correo || '').trim(); const k = 'rep:' + n;
    if(tel && (co || (presencial && n === 1))) return [1, '<div class="chk"><i class="ok">' + ic('check') + '</i><span>Contacto<small>' + esc(tel) + (co ? ' · ' + esc(co) : ' · Contrato presencial, sin correo') + '</small></span><button type="button" class="mini" data-ir-campo="' + k + '">Cambiar</button></div>'];
    if(natural && !tel && !co) return [0, '<div class="chk"><i class="opc"></i><span>Contacto<small>Opcional para personas naturales</small></span><button type="button" class="mini" data-ir-campo="' + k + '">Escribir</button></div>'];
    return [0, '<div class="chk"><i class="' + (natural ? 'opc' : 'no') + '"></i><span>Contacto<small' + (natural ? '' : ' class="mal"') + '>' + esc(tel || co ? (tel || co) + '. Falta el ' + (tel ? 'correo' : 'teléfono') : 'Falta el teléfono y el correo') + '</small></span><button type="button" class="mini pri" data-ir-campo="' + k + '">Escribir</button></div>'];
  }
  function itemDato(nombre, valor, clave){
    const v = String(valor || '').trim();
    if(v) return [1, '<div class="chk"><i class="ok">' + ic('check') + '</i><span>' + nombre + '<small>' + esc(v) + '</small></span></div>'];
    return [0, '<div class="chk"><i class="no"></i><span>' + nombre + '</span><button type="button" class="mini pri" data-ir-campo="' + clave + '">Escribir</button></div>'];
  }
  function pintarComision(){
    const F = K.F; const c = F.cliente; const i = (F.comision || []).find((x) => Number(x.id) === K.inst) || (F.comision || [])[0];
    const f = (d && d.filas.find((x) => Number(x.instalacion_id) === K.inst)) || {};
    const P = (d && d.puedo) || {}; const est = i ? i.estado : 'no_comisiona';
    const legalOk = !!c.legal_ok_en; const pagoOk = !!(i && i.pago_ok_en); const ok = est === 'cumple'; const ultimo = est === 'ultimo_corte'; const perdida = est === 'perdida';
    const sinAsignar = est === 'por_asignar'; const exc = !!(i && i.excepcion_corte);
    const nReq = !c.es_natural && c.regimen_firma === 'conjunta' ? 2 : 1;
    const nReps = Math.max(nReq, (F.representantes || []).reduce((a, r) => Math.max(a, r.orden), 1));
    let hechos = 0; let total = 0; let legal = '';
    const suma = (x, cuenta) => { if(cuenta){ total++; hechos += x[0]; } return x[1]; };
    for(let n = 1; n <= nReps; n++){
      const r = (F.representantes || []).find((x) => x.orden === n) || {}; const req = n <= nReq;
      legal += '<div class="sec">' + (c.es_natural ? 'Titular' : 'Representante ' + n) + (req ? '' : '<span>Opcional</span>') + '</div>' +
        suma(itemContacto(r, n, c.es_natural, c.presencial), req && !c.es_natural) +
        suma(itemDoc(F, 'cedula', n, 'Cédula'), req) + suma(itemDoc(F, 'rif_personal', n, 'RIF personal'), req);
    }
    if(!c.es_natural){
      legal += '<div class="sec">Empresa</div>' + suma(itemDato('Correo de la empresa', c.correo_empresa, 'correo_empresa'), true) +
        suma(itemDoc(F, 'rif_empresa', 0, 'RIF de la empresa'), true) + suma(itemDoc(F, 'acta_constitutiva', 0, 'Acta constitutiva'), true) + (c.es_isp ? suma(itemDoc(F, 'conatel', 0, 'Permiso de Conatel'), true) : '');
    }
    const fal = F.faltantes || [];
    const tituloEstado = !i || !i.comisiona ? 'Esta instalación no comisiona' : sinAsignar ? 'Pendiente por asignar' : ok && exc ? 'Comisiona por excepción en ' + mes(i.corte_pago) : ok ? 'Cumple. Comisiona en ' + mes(i.corte_pago || i.corte)
      : perdida ? 'No cumplió a tiempo: se perdió' : ultimo ? 'Último corte: si no cumple el ' + fecha(F.corte.limite || F.corte.fin).split(' de ')[0] + ' se pierde' : 'Todavía no cumple';
    const sub = !i || !i.comisiona ? (i && i.es_evento && !i.es_aliado ? 'Es un evento y el Analista Senior decidió que no comisiona.' : i && i.es_aliado ? 'Es una instalación de aliado' + (i.instalador ? ': ' + capital(i.instalador) : '') + '. No comisiona.' : 'Los dedicados y las instalaciones de aliado no comisionan.')
      : sinAsignar ? 'No comisiona hasta que el Analista Senior confirme la orden de Odoo y a quién pertenece.'
      : ok && exc ? 'Motivo: ' + (i.excepcion_motivo || 'sin motivo') + (i.excepcion_por ? '. La dio ' + primerNombre(i.excepcion_por) + '.' : '')
      : perdida ? 'Era del corte de ' + mes(i.corte) + '.' : 'Corte de ' + mes(F.corte.etiqueta) + ', límite el ' + fecha(F.corte.limite || F.corte.fin).split(' de ')[0] + '. ' + (F.corte.dias <= 0 ? 'Es hoy.' : 'Faltan ' + plural(F.corte.dias, 'día', 'días') + '.');
    const ns = (F.servicios || []).length;
    let h = '<div class="estado ' + (ok ? 'verde' : ultimo || perdida ? 'rojo' : 'ambar') + '"><b>' + esc(tituloEstado) + '</b><small>' + esc(sub) + '</small></div>' +
      bloqueProforma(F, i) +
      '<button type="button" class="exp" id="abrirExp"><span>Abrir expediente del cliente<small>' + plural(ns, 'servicio', 'servicios') + ' en este ' + (c.es_natural ? 'documento' : 'RIF') + ' · datos, documentos e hilo</small></span>' + ic('derecha', 'ch') + '</button>';
    if(i && i.comisiona){
      const asigna = !!(F.puedo.asignar && P.asignar);
      h += '<div class="req"><div class="req-t">Orden de Odoo<span class="m ' + (i.orden_ok ? 'verde' : i.orden ? 'ambar' : 'rojo') + '">' + (i.orden_ok ? (i.orden ? 'Confirmada' : 'A mano') : i.orden ? 'Por confirmar' : 'Sin orden') + '</span></div>' +
        '<p>' + (i.orden ? esc(i.orden) + (f.orden_titulo ? '. ' + esc(f.orden_titulo) : '') : i.orden_ok ? 'No tiene orden de Odoo: se asignó a mano.' : 'No hay una orden de Odoo reciente con el nombre de este cliente.') + '</p>' +
        (!i.orden_ok && i.motivo ? '<p class="tx-ambar">' + esc(i.motivo) + '</p>' : '') +
        '<div class="chk"><span>Pertenece a<small>' + esc(i.dueno || 'Por asignar') + (!i.orden_ok && i.dueno ? ' (propuesto)' : '') + '</small></span>' +
        (!asigna ? '' : !i.orden_ok && i.orden && i.dueno && f.orden_id ? '<button type="button" class="mini" id="asigCambiar">Cambiar</button><button type="button" class="mini pri" id="asigConfirmar">Confirmar</button>'
          : !i.orden_ok ? '<button type="button" class="mini pri" id="asigCambiar">Asignar</button>' : '<button type="button" class="mini" id="asigCambiar">Cambiar</button>') + '</div>' +
        (!asigna && !i.orden_ok ? '<p class="nota-chica">La asigna el Analista Senior.</p>' : '') + '</div>';
    }
    // Un solo lugar para el check de Legal: en revisión cuenta como listo y solo el administrador lo quita o lo aprueba a mano
    const lc = c.legal_como;
    h += '<div class="req"><div class="req-t">Legal<span class="m ' + (legalOk ? 'verde' : 'rojo') + '">' + (!legalOk ? 'Falta' : lc === 'revision' ? 'En revisión' : lc === 'excepcion' ? 'Aprobado a mano' : 'Cumple') + '</span></div>' +
        '<p>' + (!legalOk ? hechos + ' de ' + total + ' listos. Estatus: ' + esc((window.Comun.ESTATUS[c.estatus] || {}).t || c.estatus) + '.'
          : lc === 'revision' ? 'Pasó a revisión el ' + esc(fecha(c.legal_ok_en)) + '. Cuenta como listo hasta que el administrador le quite el check.'
          : lc === 'excepcion' ? 'El administrador lo aprobó el ' + esc(fecha(c.legal_ok_en)) + ' aunque falten documentos.' : 'Cumplió el ' + esc(fecha(c.legal_ok_en)) + '.') + '</p>' +
        (F.puedo.legal ? '<div class="chk"><span>' + (legalOk ? '¿No debe contar?' : '¿Aprobar aunque falten documentos?') + '</span><button type="button" class="mini' + (legalOk ? '' : ' pri') + '" id="legalCheck" data-quita-legal="' + (legalOk ? '1' : '0') + '">' + (legalOk ? 'Quitar Legal' : 'Aprobar Legal') + '</button></div>' : '') + legal +
        '<p class="nota-chica hidden" id="subidaCom" role="status"><span class="cargando-linea"><i></i></span> </p>' +
        (fal.length ? '<div class="chk"><span>¿No los tienes?</span><button type="button" class="mini" id="pedirCom">Pedir al cliente</button></div>' : '') + '</div>';
    if(i && i.comisiona){
      h += '<div class="req"><div class="req-t">Pago de instalación<span class="m ' + (pagoOk ? 'verde' : 'rojo') + '">' + (pagoOk ? 'Pagada' : 'Debe') + '</span></div>' +
        '<p>' + (pagoOk ? (i.pago_manual ? 'Marcada a mano el ' : 'Quedó sin deuda el ') + esc(fecha(i.pago_ok_en)) + '.' : ns > 1 ? 'Tiene ' + ns + ' servicios: el TAD no distingue cuál debe. Se revisa a mano.' : 'El TAD todavía la muestra con deuda.') + '</p>' +
        (F.puedo.pago ? '<div class="chk"><span>' + (pagoOk ? '¿Fue un error?' : 'Si ya pagó') + '</span><button type="button" class="mini' + (pagoOk ? '' : ' pri') + '" id="pagoCom" data-pagada="' + (pagoOk ? '0' : '1') + '">' + (pagoOk ? 'Quitar pago' : 'Marcar pagada') + '</button></div>'
          : pagoOk ? '' : '<p class="nota-chica">Lo marca el Analista Senior o el administrador.</p>') + '</div>';
      const puedeExc = !!(F.puedo.excepcion && P.excepcion);
      if(exc) h += '<div class="req"><div class="req-t">Excepción<span class="m verde">Activa</span></div><p>' + esc(i.excepcion_motivo || '') + (i.excepcion_por ? ' La dio ' + esc(primerNombre(i.excepcion_por)) + '.' : '') + '</p>' +
        (puedeExc ? '<div class="chk"><span>¿Ya no aplica?</span><button type="button" class="mini" id="excQuitar">Quitar excepción</button></div>' : '') + '</div>';
      else if(puedeExc && !ok && !sinAsignar) h += '<div class="req"><div class="req-t">Excepción</div><p>Comisiona aunque no cumpla. Solo la da el administrador y el líder ve el motivo.</p>' +
        '<div class="chk"><span>¿Debe comisionar igual?</span><button type="button" class="mini" id="excAbrir">Dar excepción</button></div></div>';
    }
    h += bloqueEvento(F, i, P);
    const mov = (F.hilo || []).slice(0, 4);
    h += '<div class="req"><div class="req-t">Qué ha pasado</div>' + (mov.length ? '<div class="hilo" style="padding:10px 0 0">' + mov.map(window.Ficha.lineaHilo).join('') + '</div>' : '<p>Todavía no hay movimientos.</p>') +
      ((F.hilo || []).length > 4 ? '<button type="button" class="enlace" id="verHilo">Ver todo el hilo</button>' : '') + '</div>';
    $('cuerpoCom').innerHTML = h;
  }

  // Proforma y carta, arriba de la hoja: el PDF sale siempre con los datos del momento y cada envío queda anotado
  function bloqueProforma(F, i){
    if(!i || !i.servicio_id || !F.puedo.enviar) return '';
    const sv = (F.servicios || []).find((x) => Number(x.id) === Number(i.servicio_id)); if(!sv) return '';
    const sinIp = !sv.ip && !sv.ip6; const b = sv.bienvenida_envio; const p = sv.proforma_envio;
    const una = (e, que) => (e ? que + ' enviada por ' + (e.por || 'alguien del equipo') + ', ' + diaMes(e.en) : '');
    const estado = [una(b, 'Carta'), una(p, 'Proforma')].filter(Boolean).join('. ');
    // Lote 3: bloque compacto. Una línea de IP con enlace chico y Descargar / Enviar en una sola fila
    const ip = [sv.ip, sv.ip6].filter(Boolean).join(' · ');
    return '<div class="req prof"><div class="req-t">Proforma y carta<span class="m ' + (b ? 'verde' : 'ambar') + '">' + (b ? 'Enviada ' + esc(diaMes(b.en)) : 'Por enviar') + '</span></div>' +
      '<p class="prof-l">IP: ' + (sinIp ? '<b class="mal">falta</b>' : esc(ip)) + (F.puedo.ip ? ' · <button type="button" class="enlace chico" id="profIp">' + (sinIp ? 'Escribir' : 'Cambiar') + '</button>' : '') + '</p>' +
      (estado ? '<p class="nota-chica">' + esc(estado) + '.</p>' : '') +
      '<div class="acc-prof"><button type="button" class="mini" id="profBajar">' + ic('doc') + 'Descargar</button><button type="button" class="mini pri" id="profEnviar">' + ic('wa') + (b ? 'Reenviar' : 'Enviar') + '</button></div></div>';
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
  function abrirCertificar(){
    const n = porAsignar(); const cumplen = d.filas.filter((f) => f.cumple).length;
    hojaChica('hojaCert', 'tCert').innerHTML = cabHoja('tCert', 'Certificar ' + nombreCorte(d.corte).toLowerCase(), 'Del ' + fecha(d.inicio) + ' al ' + fecha(d.fin)) +
      '<div class="estado verde"><b>' + cumplen + ' de ' + d.filas.length + ' comisionan</b><small>Es lo que queda en el Excel del corte.</small></div>' +
      (n ? '<div class="estado ambar"><b>' + plural(n, 'queda', 'quedan') + ' por asignar</b><small>Si certificas ahora, no comisionan en este corte.</small></div>' : '') +
      '<p class="nota-chica">Al certificar, el corte queda fijo: lo que cambie después ya no lo mueve.</p>' +
      '<div class="acciones"><button type="button" class="btn btn-ancho" id="certificar">Certificar corte</button></div>';
    abrirHoja('hojaCert');
  }
  // Lo que se gestiona desde aquí abre el expediente encima; al cerrarlo se vuelve a esta hoja ya actualizada
  function alExpediente(o){ if(!K) return; window.Ficha.abrir(K.cliente, Object.assign({ yo, alCerrar: tras }, o || {})); }
  function tras(){ cache.borrarTodo(); if(K) cargarComision(); cargar(); if(vista === 'instalar') cargarInstalar(); cargarPorDecidir(); }

  document.addEventListener('click', (e) => {
    const f = e.target.closest('#filtros [data-filtro], #avisos [data-filtro]');
    if(f){ filtro = f.dataset.filtro; guardarUrl(); pintarFiltros(); if(d){ pintarAvisos(); pintarLista(); } return; }
    const g = e.target.closest('#lista [data-grupo]');
    if(g){ const l = g.dataset.grupo; abiertos[l] = !g.parentNode.classList.contains('abierto'); g.parentNode.classList.toggle('abierto', abiertos[l]); g.setAttribute('aria-expanded', String(abiertos[l])); return; }
    const m = e.target.closest('[data-mas]');
    if(m){ completos[m.dataset.mas] = true; const l = m.closest('.grupo').dataset.lider; abiertos[l] = true; pintarLista(); return; }
    if(e.target.closest('#lista #reintentar')){ cargar(); return; }
    const vv = e.target.closest('#vistas [data-vista]'); if(vv){ cambiarVista(vv.dataset.vista); return; }
    if(e.target.closest('#reintentarPI')){ cargarInstalar(); return; }
    if(e.target.closest('#verAnteriores')){ verAnt = !verAnt; pintarInstalar(); pintarVistas(); return; }
    const ec = e.target.closest('[data-es-cli]');
    if(ec){ const si = ec.dataset.esCli === 'si'; Array.prototype.forEach.call(ec.parentNode.querySelectorAll('button'), (x) => { x.disabled = true; });
      rpc('orden_es_cliente', { p_orden: Number(ec.dataset.orden), p_cliente: si ? Number(ec.dataset.cli) : null })
        .then(() => { toast(si ? 'Listo: la orden quedó en ese cliente' : 'Listo: se creó el cliente provisional'); cache.borrarTodo(); PI = null; cargarInstalar(); })
        .catch((err) => { toast(err.message, 'error'); Array.prototype.forEach.call(ec.parentNode.querySelectorAll('button'), (x) => { x.disabled = false; }); }); return; }
    const dp = e.target.closest('[data-dueno-prov]'); if(dp){ abrirDuenoProv(Number(dp.dataset.duenoProv), dp.dataset.nombre); return; }
    const t = e.target; let b;
    if((b = t.closest('[data-com]'))){ abrirComision(b.dataset.com, b.dataset.cliente); return; }
    if((b = t.closest('[data-exp]'))){ window.Ficha.abrir(Number(b.dataset.exp), { yo, alCerrar: tras }); return; }
    if(t.closest('#reintentarCom')){ cargarComision(); return; }
    if(t.closest('#abrirExp')){ alExpediente({ tab: 'datos' }); return; }
    if(t.closest('#verHilo')){ alExpediente({ tab: 'hilo' }); return; }
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
    if((b = t.closest('#certificar')) && d){ b.disabled = true; b.textContent = 'Certificando…';
      rpc('corte_certificar', { p_corte: d.corte }).then(() => { toast('Corte certificado'); if(hojaAbierta() === 'hojaCert') cerrarHoja(); cache.borrarTodo(); cargar(); })
        .catch((err) => { toast(err.message, 'error'); if(document.contains(b)){ b.disabled = false; b.textContent = 'Certificar corte'; } }); return; }
    if((b = t.closest('#quitarCert')) && d){ b.disabled = true;
      rpc('corte_descertificar', { p_corte: d.corte }).then(() => { toast('Certificación quitada'); cache.borrarTodo(); cargar(); }).catch((err) => { toast(err.message, 'error'); if(document.contains(b)) b.disabled = false; }); return; }
    if(t.closest('#asigCambiar') && K){ abrirAsignar(); return; }
    if((b = t.closest('#asigConfirmar')) && K && K.F){
      const f = d.filas.find((x) => Number(x.instalacion_id) === K.inst) || {}; const i = (K.F.comision || []).find((x) => Number(x.id) === K.inst) || {};
      if(!f.orden_id || !i.dueno){ abrirAsignar(); return; }
      asignar(f.orden_id, i.dueno, b); return; }
    if(t.closest('#asigBuscar') && A){ buscarOrdenes($('asigBusca').value.trim()); return; }
    if(t.closest('#excAbrir') && K){ abrirExcepcion(); return; }
    if((b = t.closest('#legalCheck')) && K){ abrirLegal(b.dataset.quitaLegal === '1'); return; }
    if((b = t.closest('#excQuitar')) && K){ b.disabled = true;
      rpc('instalacion_excepcion', { p_instalacion: K.inst, p_corte: null, p_motivo: null }).then(() => { toast('Excepción quitada'); tras(); }).catch((err) => { toast(err.message, 'error'); if(document.contains(b)) b.disabled = false; }); return; }
    if((b = t.closest('#pagoCom')) && K){ b.disabled = true; const pagada = b.dataset.pagada === '1';
      rpc('instalacion_pago', { p_instalacion: K.inst, p_pagada: pagada }).then(() => { toast(pagada ? 'Instalación marcada como pagada' : 'Pago quitado'); tras(); }).catch((err) => { toast(err.message, 'error'); if(document.contains(b)) b.disabled = false; }); }
  });
  document.addEventListener('submit', (e) => {
    if(e.target.id === 'formDueno'){ e.preventDefault(); const v = $('duenoSel').value; $('eDueno').textContent = '';
      if(!v){ $('eDueno').textContent = 'Elige el líder'; return; }
      const b = $('guardarDueno'); b.disabled = true; b.textContent = 'Guardando…';
      rpc('provisional_dueno', { p_cliente: Number(e.target.dataset.cliente), p_dueno: v })
        .then(() => { toast('Listo: el cliente quedó a nombre de ' + v); if(hojaAbierta() === 'hojaDueno') cerrarHoja(); cache.borrarTodo(); PI = null; cargarInstalar(); })
        .catch((err) => { $('eDueno').textContent = err.message; b.disabled = false; b.textContent = 'Guardar'; }); return; }
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
  $('busca').addEventListener('input', () => { clearTimeout(tBusca); tBusca = setTimeout(() => { busca = $('busca').value.trim(); guardarUrl(); if(vista === 'instalar') pintarInstalar(); else if(d) pintarLista(); }, 140); });
  $('corte').addEventListener('change', () => { corte = $('corte').value; d = null; cargar(); });

  window.Armazon.arrancar(['admin', 'abogado', 'lider', 'analista'], { activo: 'comisiones' }, (p) => {
    yo = p;
    window.Ficha.montar();
    leerUrl(); $('busca').value = busca; pintarFiltros(); pintarVistas();
    cargar(); if(conInstalar()){ cargarInstalar(); cargarPorDecidir(); }
  }, (p) => { yo = p; });
})();
