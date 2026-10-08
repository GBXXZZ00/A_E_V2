// Comisiones: quién cumple en el corte, qué le falta a cada cliente y cómo viene el mes.
(function(){
  'use strict';
  const { $, esc, ic, rpc, toast, cache, esqueleto, vacio, fecha, mes, capital, plural, chipEstatus, docFmt, abrirHoja, cerrarHoja, hojaAbierta, casilla, MOTIVOS, primerNombre, dia, normalizeStr } = window.Comun;
  const S = window.Sesion;
  const FILTROS = [
    { id: 'todos', t: 'Todos' }, { id: 'asignar', t: 'Por asignar' }, { id: 'ultimo', t: 'Último corte' }, { id: 'legal', t: 'Falta legal' },
    { id: 'pago', t: 'Debe instalación' }, { id: 'instalar', t: 'Por instalar' }
  ];
  const TOPE = 8;   // filas por bloque antes de "Ver más"
  let yo = null; let d = null; let filtro = 'todos'; let corte = ''; let pedido = 0; let busca = '';
  const abiertos = {}; const completos = {};

  function leerUrl(){
    const u = new URLSearchParams(location.search);
    const f = u.get('f'); filtro = FILTROS.some((x) => x.id === f) ? f : 'todos';
    busca = (u.get('q') || '').slice(0, 60);
    const c = u.get('c'); corte = /^\d{4}-(0[1-9]|1[0-2])/.test(c || '') ? c.slice(0, 7) + '-01' : '';
  }
  function guardarUrl(){
    const u = new URLSearchParams();
    if(filtro !== 'todos') u.set('f', filtro);
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
    return true;
  }
  function conteo(id){
    if(!d) return '';
    if(id === 'instalar') return d.corte === d.actual ? (d.por_instalar || []).length : '';
    if(id === 'todos') return d.filas.length;
    const g = filtro; filtro = id; const n = d.filas.filter(pasa).length; filtro = g; return n;
  }

  function pintarCorte(){
    const actual = d ? d.actual : corte; if(!actual) return;
    const ops = [0, 1, 2, 3, 4, 5].map((n) => menosMeses(actual, n));
    const elegido = d ? d.corte : corte; if(elegido && ops.indexOf(elegido) < 0) ops.push(elegido);
    $('corte').innerHTML = ops.map((c, i) => '<option value="' + c + '"' + (c === (d ? d.corte : corte) ? ' selected' : '') + '>' + esc(nombreCorte(c)) + (i === 0 ? ' (en curso)' : '') + '</option>').join('');
  }
  function pintarFiltros(){
    $('filtros').innerHTML = FILTROS.filter((f) => (f.id !== 'instalar' || !d || d.corte === d.actual) && (f.id !== 'asignar' || filtro === 'asignar' || porAsignar() > 0)).map((f) => {
      const n = conteo(f.id);
      return '<button type="button" role="tab" data-filtro="' + f.id + '" class="' + (f.id === filtro ? 'on' : '') + '" aria-selected="' + (f.id === filtro) + '">' + esc(f.t) + (n === '' ? '' : ' <em>' + esc(n) + '</em>') + '</button>';
    }).join('');
  }
  function pintarMets(){
    const propias = d.filas.filter((f) => f.origen === 'corte'); const ult = d.filas.filter((f) => f.origen === 'anterior');
    const cumplen = d.filas.filter((f) => f.cumple).length;
    const enCurso = d.corte === d.actual;
    $('rango').textContent = 'Del ' + fecha(d.inicio) + ' al ' + fecha(d.fin) + (enCurso ? '. ' + (d.dias > 0 ? 'Faltan ' + plural(d.dias, 'día', 'días') : 'Cierra hoy') : '. Corte cerrado');
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
  function fila(f){
    const marcas = !f.orden_ok ? '<span class="m ambar">' + ic('alerta') + 'Por asignar</span>'
      : f.excepcion && f.cumple ? marca(true, 'Excepción')
      : marca(f.legal_ok, 'Legal') + marca(f.pago_ok, f.revisar_pago ? 'Revisar pago' : 'Pago', f.revisar_pago);
    return '<button type="button" class="fila" data-com="' + esc(f.instalacion_id) + '" data-cliente="' + esc(f.cliente_id) + '">' +
      '<span class="tx"><b>' + esc(f.nombre) + '</b><small>' + (f.es_natural ? '<span class="tagn">Natural</span>' : '') + esc(f.codigo || '') + ' · ' + esc(fecha(f.instalada_en)) + ' · ' + ordenTexto(f) + '</small></span>' +
      '<span class="par-m">' + marcas + '</span></button>';
  }
  function bloque(clave, titulo, filas, tono){
    if(!filas.length) return '';
    const todo = completos[clave] || filas.length <= TOPE; const ver = todo ? filas : filas.slice(0, TOPE);
    return '<div class="sub-bloque ' + (tono || 'liso') + '">' + esc(titulo) + '<span class="n2">' + filas.filter((f) => f.cumple).length + ' de ' + filas.length + ' cumplen</span></div>' +
      ver.map(fila).join('') +
      (todo ? '' : '<button type="button" class="fila mas" data-mas="' + esc(clave) + '">Ver ' + (filas.length - TOPE) + ' más</button>');
  }
  function pintarLista(){
    if(filtro === 'instalar'){
      const p = d.por_instalar || [];
      if(!p.length){ $('lista').innerHTML = vacio('Nada por instalar', 'No hay órdenes abiertas en este momento.'); return; }
      $('lista').innerHTML = '<div class="grupo abierto"><div class="sub-bloque liso" style="border-top:0">Órdenes abiertas<span class="n2">Aún no cuentan para el corte</span></div>' +
        p.map((o) => '<button type="button" class="fila" data-exp="' + esc(o.cliente_id) + '"><span class="tx"><b>' + esc(o.nombre) + '</b><small>' + esc(o.orden || '') + ' · ' + esc(o.lider || 'Sin líder') + ' · Creada el ' + esc(fecha(o.creada_en)) + '</small></span><span class="m azul">' + esc(o.etapa || 'Sin etapa') + '</span></button>').join('') + '</div>';
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
        '<div class="grupo-cuerpo">' +
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
    if(filtro === 'instalar' && d.corte !== d.actual) filtro = 'todos';
    pintarCorte(); pintarMets(); pintarAvisos(); pintarFiltros(); pintarLista(); pintarLado();
  }
  // Lo que pide atención en el corte y lo que se puede hacer con él
  function pintarAvisos(){
    const P = d.puedo || {}; const n = porAsignar(); let h = '';
    if(d.certificado) h += '<div class="franja verde">' + ic('check') + '<span><b>Corte certificado</b>' + esc((d.certificado.por ? 'Por ' + primerNombre(d.certificado.por) + ', el ' : 'El ') + fecha(d.certificado.en)) + '. Lo que ves quedó fijo.</span>' +
      (P.quitar_certificado ? '<button type="button" class="mini" id="quitarCert">Quitar</button>' : '') + '</div>';
    if(n && filtro !== 'asignar') h += '<button type="button" class="franja ambar" data-filtro="asignar">' + ic('alerta') + '<span><b>' + plural(n, 'pendiente', 'pendientes') + ' por asignar</b>' +
      (P.asignar ? 'No comisionan hasta que confirmes la orden y a quién pertenecen.' : 'No comisionan hasta que el Analista Senior las asigne.') + '</span>' + ic('derecha') + '</button>';
    $('avisos').innerHTML = h;
    $('acciones').innerHTML = (d.filas.length ? '<button type="button" class="mini" id="bajarExcel">' + ic('doc') + 'Bajar Excel</button>' : '') +
      (P.certificar ? '<button type="button" class="mini pri" id="abrirCert">' + ic('check') + 'Certificar corte</button>' : '');
  }
  function bajarExcel(){
    const si = (v) => (v ? 'Sí' : 'No');
    const filas = d.filas.map((f) => [f.lider || '', f.nombre || '', f.doc || '', f.es_natural ? 'Natural' : 'Jurídico', f.sucursal || '', f.codigo || '', fecha(f.instalada_en, true),
      f.orden || (f.orden_ok ? 'Asignada a mano' : 'Sin orden'), f.origen === 'anterior' ? 'Último corte' : 'Este corte', si(f.legal_ok), si(f.pago_ok), f.excepcion ? (f.excepcion_motivo || 'Sí') : '',
      !f.orden_ok ? 'Por asignar' : si(f.cumple)]);
    const res = {}; d.filas.forEach((f) => { const l = f.lider || 'Por asignar'; res[l] = res[l] || [l, 0, 0]; res[l][1]++; if(f.cumple) res[l][2]++; });
    const blob = window.Archivos.xlsx([
      { nombre: 'Detalle', columnas: [{ t: 'Líder', ancho: 22 }, { t: 'Cliente', ancho: 42 }, { t: 'RIF o cédula', ancho: 16 }, { t: 'Tipo', ancho: 10 }, { t: 'Sucursal', ancho: 9 }, { t: 'Código', ancho: 11 }, { t: 'Instalado', ancho: 22 },
        { t: 'Orden de Odoo', ancho: 26 }, { t: 'Corte', ancho: 13 }, { t: 'Legal', ancho: 7 }, { t: 'Pago', ancho: 7 }, { t: 'Excepción', ancho: 30 }, { t: 'Comisiona', ancho: 12 }], filas },
      { nombre: 'Resumen', columnas: [{ t: 'Líder', ancho: 24 }, { t: 'Instalaciones', ancho: 14 }, { t: 'Comisionan', ancho: 12 }], filas: Object.keys(res).sort().map((k) => res[k]).concat([['Total', d.filas.length, d.filas.filter((f) => f.cumple).length]]) }
    ]);
    window.Archivos.descargar(blob, 'Comisiones-' + d.corte.slice(0, 7) + (d.certificado ? '-certificado' : '') + '.xlsx');
    toast('Excel descargado');
  }

  async function cargar(){
    const mio = ++pedido; const clave = 'comisiones3:' + (corte || 'actual');
    const guardado = cache.leer(clave);
    if(guardado && guardado.rol === yo.rol){ d = guardado; pintar(); }
    else { $('lista').innerHTML = esqueleto(5); $('mets').innerHTML = '<span class="sk" style="height:76px;border-radius:18px"></span><span class="sk" style="height:76px;border-radius:18px"></span><span class="sk" style="height:76px;border-radius:18px"></span>'; $('lado').innerHTML = ''; }
    try {
      const r = await rpc('comisiones_corte', { p_corte: corte || null });
      if(mio !== pedido) return;
      d = r; d.filas = d.filas || []; corte = d.corte; cache.guardar(clave, d);
      pintar(); guardarUrl(); if(K && K.F) pintarComision();
    } catch (e) {
      if(mio !== pedido) return;
      if(!d) $('lista').innerHTML = '<div class="vacio" role="alert"><b>No se pudieron cargar las comisiones</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" id="reintentar">Reintentar</button></div>';
      toast(e.message, 'error');
    }
  }

  // ---------- Hoja corta de comisión: solo lo que decide la comisión, con gestión ----------
  let K = null;   // { inst, cliente, F }
  function montarHoja(){
    if($('hojaComision')) return;
    const h = document.createElement('section'); h.id = 'hojaComision'; h.className = 'hoja lado corta';
    h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', 'tCom'); h.setAttribute('aria-hidden', 'true');
    h.innerHTML = '<div class="asa" aria-hidden="true"></div><div class="ficha-cab" id="cabCom"></div><div class="ficha-cuerpo" id="cuerpoCom"></div>';
    document.body.appendChild(h); window.Comun.prepararHojas();
    h.addEventListener('hoja-cerrada', () => { K = null; });
  }
  function abrirComision(inst, cliente){
    montarHoja();
    const f = d.filas.find((x) => String(x.instalacion_id) === String(inst)) || {};
    K = { inst: Number(inst), cliente: Number(cliente), F: null };
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
    if(x && x.estado === 'devuelto') return [0, '<div class="chk"><i class="no"></i><span>' + esc(nombre) + '<small class="mal">Devuelto' + (x.revisado_por ? ' por ' + esc(primerNombre(x.revisado_por)) : '') + (x.revisado_en ? ' ' + esc(dia(x.revisado_en).toLowerCase()) : '') + ': ' + esc((MOTIVOS[x.motivo] || 'revisa la nota').toLowerCase()) + (x.nota ? '. "' + esc(x.nota) + '"' : '') + '</small></span><button type="button" class="mini pri" data-ir-doc="' + k + '">Subir de nuevo</button></div>'];
    return [0, '<div class="chk"><i class="no"></i><span>' + esc(nombre) + '</span><button type="button" class="mini pri" data-ir-doc="' + k + '">Subir</button></div>'];
  }
  // Contacto del representante: teléfono y correo en una sola línea
  function itemContacto(r, n, natural){
    const tel = String(r.telefono || '').trim(); const co = String(r.correo || '').trim(); const k = 'rep:' + n;
    if(tel && co) return [1, '<div class="chk"><i class="ok">' + ic('check') + '</i><span>Contacto<small>' + esc(tel) + ' · ' + esc(co) + '</small></span><button type="button" class="mini" data-ir-campo="' + k + '">Cambiar</button></div>'];
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
        suma(itemContacto(r, n, c.es_natural), req && !c.es_natural) +
        suma(itemDoc(F, 'cedula', n, 'Cédula'), req) + suma(itemDoc(F, 'rif_personal', n, 'RIF personal'), req);
    }
    if(!c.es_natural){
      legal += '<div class="sec">Empresa</div>' + suma(itemDato('Correo de la empresa', c.correo_empresa, 'correo_empresa'), true) +
        suma(itemDoc(F, 'rif_empresa', 0, 'RIF de la empresa'), true) + suma(itemDoc(F, 'acta_constitutiva', 0, 'Acta constitutiva'), true) + (c.es_isp ? suma(itemDoc(F, 'conatel', 0, 'Permiso de Conatel'), true) : '');
    }
    const fal = F.faltantes || [];
    const tituloEstado = !i || !i.comisiona ? 'Esta instalación no comisiona' : sinAsignar ? 'Pendiente por asignar' : ok && exc ? 'Comisiona por excepción en ' + mes(i.corte_pago) : ok ? 'Cumple. Comisiona en ' + mes(i.corte_pago || i.corte)
      : perdida ? 'No cumplió a tiempo: se perdió' : ultimo ? 'Último corte: si no cumple el ' + fecha(F.corte.fin).split(' de ')[0] + ' se pierde' : 'Todavía no cumple';
    const sub = !i || !i.comisiona ? (i && i.es_aliado ? 'Es una instalación de aliado' + (i.instalador ? ': ' + capital(i.instalador) : '') + '. No comisiona.' : 'Los dedicados y las instalaciones de aliado no comisionan.')
      : sinAsignar ? 'No comisiona hasta que el Analista Senior confirme la orden de Odoo y a quién pertenece.'
      : ok && exc ? 'Motivo: ' + (i.excepcion_motivo || 'sin motivo') + (i.excepcion_por ? '. La dio ' + primerNombre(i.excepcion_por) + '.' : '')
      : perdida ? 'Era del corte de ' + mes(i.corte) + '.' : 'Corte de ' + mes(F.corte.etiqueta) + ', cierra el ' + fecha(F.corte.fin).split(' de ')[0] + '. ' + (F.corte.dias <= 0 ? 'Cierra hoy.' : 'Faltan ' + plural(F.corte.dias, 'día', 'días') + '.');
    const ns = (F.servicios || []).length;
    let h = '<div class="estado ' + (ok ? 'verde' : ultimo || perdida ? 'rojo' : 'ambar') + '"><b>' + esc(tituloEstado) + '</b><small>' + esc(sub) + '</small></div>' +
      '<button type="button" class="exp" id="abrirExp"><span>Abrir expediente del cliente<small>' + plural(ns, 'servicio', 'servicios') + ' en este ' + (c.es_natural ? 'documento' : 'RIF') + ' · datos, documentos e hilo</small></span>' + ic('derecha', 'ch') + '</button>';
    if(i && i.comisiona){
      const asigna = !!(F.puedo.asignar && P.asignar);
      h += '<div class="req"><div class="req-t">Orden de Odoo<span class="m ' + (i.orden_ok ? 'verde' : i.orden ? 'ambar' : 'rojo') + '">' + (i.orden_ok ? (i.orden ? 'Confirmada' : 'A mano') : i.orden ? 'Por confirmar' : 'Sin orden') + '</span></div>' +
        '<p>' + (i.orden ? esc(i.orden) + (f.orden_titulo ? '. ' + esc(f.orden_titulo) : '') : i.orden_ok ? 'No tiene orden de Odoo: se asignó a mano.' : 'No hay una orden de Odoo reciente con el nombre de este cliente.') + '</p>' +
        '<div class="chk"><span>Pertenece a<small>' + esc(i.dueno || 'Por asignar') + (!i.orden_ok && i.dueno ? ' (propuesto)' : '') + '</small></span>' +
        (!asigna ? '' : !i.orden_ok && i.orden && i.dueno && f.orden_id ? '<button type="button" class="mini" id="asigCambiar">Cambiar</button><button type="button" class="mini pri" id="asigConfirmar">Confirmar</button>'
          : !i.orden_ok ? '<button type="button" class="mini pri" id="asigCambiar">Asignar</button>' : '<button type="button" class="mini" id="asigCambiar">Cambiar</button>') + '</div>' +
        (!asigna && !i.orden_ok ? '<p class="nota-chica">La asigna el Analista Senior.</p>' : '') + '</div>';
    }
    h += '<div class="req"><div class="req-t">Legal<span class="m ' + (legalOk ? 'verde' : 'rojo') + '">' + (legalOk ? 'Cumple' : 'Falta') + '</span></div>' +
        '<p>' + (legalOk ? 'Cumplió el ' + esc(fecha(c.legal_ok_en)) + '.' : hechos + ' de ' + total + ' listos. Estatus: ' + esc((window.Comun.ESTATUS[c.estatus] || {}).t || c.estatus) + '.') + '</p>' + legal +
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
    const mov = (F.hilo || []).slice(0, 4);
    h += '<div class="req"><div class="req-t">Qué ha pasado</div>' + (mov.length ? '<div class="hilo" style="padding:10px 0 0">' + mov.map(window.Ficha.lineaHilo).join('') + '</div>' : '<p>Todavía no hay movimientos.</p>') +
      ((F.hilo || []).length > 4 ? '<button type="button" class="enlace" id="verHilo">Ver todo el hilo</button>' : '') + '</div>';
    $('cuerpoCom').innerHTML = h;
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
  function tras(){ cache.borrarTodo(); if(K) cargarComision(); cargar(); }

  document.addEventListener('click', (e) => {
    const f = e.target.closest('#filtros [data-filtro], #avisos [data-filtro]');
    if(f){ filtro = f.dataset.filtro; guardarUrl(); pintarFiltros(); if(d){ pintarAvisos(); pintarLista(); } return; }
    const g = e.target.closest('#lista [data-grupo]');
    if(g){ const l = g.dataset.grupo; abiertos[l] = !g.parentNode.classList.contains('abierto'); g.parentNode.classList.toggle('abierto', abiertos[l]); g.setAttribute('aria-expanded', String(abiertos[l])); return; }
    const m = e.target.closest('[data-mas]');
    if(m){ completos[m.dataset.mas] = true; const l = m.closest('.grupo').dataset.lider; abiertos[l] = true; pintarLista(); return; }
    if(e.target.closest('#lista #reintentar')){ cargar(); return; }
    const t = e.target; let b;
    if((b = t.closest('[data-com]'))){ abrirComision(b.dataset.com, b.dataset.cliente); return; }
    if((b = t.closest('[data-exp]'))){ window.Ficha.abrir(Number(b.dataset.exp), { yo, alCerrar: tras }); return; }
    if(t.closest('#reintentarCom')){ cargarComision(); return; }
    if(t.closest('#abrirExp')){ alExpediente({ tab: 'datos' }); return; }
    if(t.closest('#verHilo')){ alExpediente({ tab: 'hilo' }); return; }
    if((b = t.closest('[data-ir-doc]'))){ alExpediente({ tab: 'documentos', casilla: b.dataset.irDoc }); return; }
    if((b = t.closest('[data-ir-campo]'))){ alExpediente({ tab: 'documentos', campo: b.dataset.irCampo }); return; }
    if(t.closest('#pedirCom') && K && K.F){ const c = K.F.cliente; window.Pedir.abrir({ id: c.id, nombre: c.nombre, es_natural: c.es_natural, estatus: c.estatus, falta: K.F.faltantes, tel: c.tel, correo: c.correo }, { yo: yo.nombre, alHacer: tras }); return; }
    if(t.closest('#bajarExcel') && d){ bajarExcel(); return; }
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
    if((b = t.closest('#excQuitar')) && K){ b.disabled = true;
      rpc('instalacion_excepcion', { p_instalacion: K.inst, p_corte: null, p_motivo: null }).then(() => { toast('Excepción quitada'); tras(); }).catch((err) => { toast(err.message, 'error'); if(document.contains(b)) b.disabled = false; }); return; }
    if((b = t.closest('#pagoCom')) && K){ b.disabled = true; const pagada = b.dataset.pagada === '1';
      rpc('instalacion_pago', { p_instalacion: K.inst, p_pagada: pagada }).then(() => { toast(pagada ? 'Instalación marcada como pagada' : 'Pago quitado'); tras(); }).catch((err) => { toast(err.message, 'error'); if(document.contains(b)) b.disabled = false; }); }
  });
  document.addEventListener('submit', (e) => {
    if(e.target.id === 'formAsig' && A && K){ e.preventDefault(); const er = $('eAsig'); er.textContent = '';
      const m = document.querySelector('#asigOrdenes input:checked'); const dueno = $('asigDueno').value;
      if(!m){ er.textContent = 'Elige la orden o marca Sin orden de Odoo'; return; }
      if(!dueno){ er.textContent = 'Elige a quién pertenece'; $('asigDueno').focus(); return; }
      asignar(m.value ? Number(m.value) : null, dueno, $('asigGuardar'), (msj) => { er.textContent = msj; }); return; }
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

  (async function(){
    yo = await S.requerir(['admin', 'abogado', 'lider', 'analista']);
    if(!yo) return;
    window.Armazon.montar(yo, { activo: 'comisiones' });
    window.Ficha.montar();
    leerUrl(); $('busca').value = busca; pintarFiltros();
    cargar();
  })();
})();
