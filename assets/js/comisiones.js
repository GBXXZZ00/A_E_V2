// Comisiones: quién cumple en el corte, qué le falta a cada cliente y cómo viene el mes.
(function(){
  'use strict';
  const { $, esc, ic, rpc, toast, cache, esqueleto, vacio, fecha, mes, capital, plural, chipEstatus, docFmt } = window.Comun;
  const S = window.Sesion;
  const FILTROS = [
    { id: 'todos', t: 'Todos' }, { id: 'ultimo', t: 'Último corte' }, { id: 'legal', t: 'Falta legal' },
    { id: 'pago', t: 'Debe instalación' }, { id: 'instalar', t: 'Por instalar' }
  ];
  const TOPE = 8;   // filas por bloque antes de "Ver más"
  let yo = null; let d = null; let filtro = 'todos'; let corte = ''; let pedido = 0;
  const abiertos = {}; const completos = {};

  function leerUrl(){
    const u = new URLSearchParams(location.search);
    const f = u.get('f'); filtro = FILTROS.some((x) => x.id === f) ? f : 'todos';
    const c = u.get('c'); corte = /^\d{4}-(0[1-9]|1[0-2])/.test(c || '') ? c.slice(0, 7) + '-01' : '';
  }
  function guardarUrl(){
    const u = new URLSearchParams();
    if(filtro !== 'todos') u.set('f', filtro);
    if(d && corte && corte !== d.actual) u.set('c', corte.slice(0, 7));
    const s = u.toString();
    history.replaceState(null, '', location.pathname + (s ? '?' + s : ''));
  }
  const nombreCorte = (c) => capital(mes(c + 'T12:00:00Z')) + ' ' + String(c).slice(0, 4);
  function menosMeses(c, n){ let a = Number(c.slice(0, 4)); let m = Number(c.slice(5, 7)) - n; while(m < 1){ m += 12; a--; } return a + '-' + String(m).padStart(2, '0') + '-01'; }

  function pasa(f){
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
    $('filtros').innerHTML = FILTROS.filter((f) => f.id !== 'instalar' || !d || d.corte === d.actual).map((f) => {
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
  function fila(f){
    return '<a class="fila" href="cliente.html?id=' + encodeURIComponent(f.cliente_id) + '&t=comision" data-cliente="' + esc(f.cliente_id) + '">' +
      '<span class="tx"><b>' + esc(f.nombre) + '</b><small>' + esc(f.codigo || '') + ' · Instalado el ' + esc(fecha(f.instalada_en)) + '</small></span>' +
      '<span class="par-m">' + marca(f.legal_ok, 'Legal') + marca(f.pago_ok, f.revisar_pago ? 'Revisar pago' : 'Pago', f.revisar_pago) + '</span></a>';
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
        p.map((o) => '<a class="fila" href="cliente.html?id=' + encodeURIComponent(o.cliente_id) + '"><span class="tx"><b>' + esc(o.nombre) + '</b><small>' + esc(o.orden || '') + ' · ' + esc(o.lider || 'Sin líder') + ' · Creada el ' + esc(fecha(o.creada_en)) + '</small></span><span class="m azul">' + esc(o.etapa || 'Sin etapa') + '</span></a>').join('') + '</div>';
      return;
    }
    const filas = d.filas.filter(pasa);
    if(!filas.length){
      $('lista').innerHTML = d.filas.length ? vacio('Nada en este filtro', 'Prueba con otro filtro o mira todos.') : vacio('Sin instalaciones en este corte', 'Cuando se instale un servicio que comisiona aparecerá aquí.');
      return;
    }
    const grupos = []; const idx = {};
    filas.forEach((f) => { const l = f.lider || 'Sin líder'; if(idx[l] === undefined){ idx[l] = grupos.length; grupos.push({ lider: l, filas: [] }); } grupos[idx[l]].filas.push(f); });
    const solo = grupos.length === 1;
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
    pintarCorte(); pintarMets(); pintarFiltros(); pintarLista(); pintarLado();
  }

  async function cargar(){
    const mio = ++pedido; const clave = 'comisiones:' + (corte || 'actual');
    const guardado = cache.leer(clave);
    if(guardado && guardado.rol === yo.rol){ d = guardado; pintar(); }
    else { $('lista').innerHTML = esqueleto(5); $('mets').innerHTML = '<span class="sk" style="height:76px;border-radius:18px"></span><span class="sk" style="height:76px;border-radius:18px"></span><span class="sk" style="height:76px;border-radius:18px"></span>'; $('lado').innerHTML = ''; }
    try {
      const r = await rpc('comisiones_corte', { p_corte: corte || null });
      if(mio !== pedido) return;
      d = r; d.filas = d.filas || []; corte = d.corte; cache.guardar(clave, d);
      pintar(); guardarUrl();
    } catch (e) {
      if(mio !== pedido) return;
      if(!d) $('lista').innerHTML = '<div class="vacio" role="alert"><b>No se pudieron cargar las comisiones</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" id="reintentar">Reintentar</button></div>';
      toast(e.message, 'error');
    }
  }

  document.addEventListener('click', (e) => {
    const f = e.target.closest('[data-filtro]');
    if(f){ filtro = f.dataset.filtro; guardarUrl(); pintarFiltros(); if(d) pintarLista(); return; }
    const g = e.target.closest('[data-grupo]');
    if(g){ const l = g.dataset.grupo; abiertos[l] = !g.parentNode.classList.contains('abierto'); g.parentNode.classList.toggle('abierto', abiertos[l]); g.setAttribute('aria-expanded', String(abiertos[l])); return; }
    const m = e.target.closest('[data-mas]');
    if(m){ completos[m.dataset.mas] = true; const l = m.closest('.grupo').dataset.lider; abiertos[l] = true; pintarLista(); return; }
    if(e.target.closest('#reintentar')) cargar();
  });
  $('corte').addEventListener('change', () => { corte = $('corte').value; d = null; cargar(); });

  (async function(){
    yo = await S.requerir(['admin', 'abogado', 'lider', 'analista']);
    if(!yo) return;
    window.Armazon.montar(yo, { activo: 'comisiones' });
    leerUrl(); pintarFiltros();
    cargar();
  })();
})();
