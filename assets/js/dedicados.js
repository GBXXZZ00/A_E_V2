// Dedicados: la lista se queda quieta (ISP primero) y el expediente sale encima, con Datos, Documentos y Contratos.
// Cada ejecutiva ve solo sus clientes (lo filtra el servidor). Son pocos: se traen todos y se filtran aquí.
(function(){
  'use strict';
  const { $, esc, ic, rpc, toast, cache, vacio, docFmt, chipEstatus, plural, iniciales, abrirHoja, normalizeStr } = window.Comun;
  const POR_PAGINA = 40;
  const ATAJOS = [
    { id: 'todos', t: 'Todos' }, { id: 'isp', t: 'ISP' }, { id: 'corporativo', t: 'Corporativo' },
    { id: 'faltan', t: 'Faltan documentos' }, { id: 'verificar', t: 'Por verificar' }
  ];
  const SELS = [{ k: 'ejecutiva', t: 'Ejecutiva' }, { k: 'ruta', t: 'Ruta de documentos' }, { k: 'activo', t: 'Enlaces' }];
  const RUTA_CORTA = { cargar: 'Cargar a la app', completar: 'Completar en la app', pedir: 'Pedir al cliente', validar: 'Validar con la analista' };
  let yo = null; let D = null; let filtro = 'todos'; let q = ''; let sel = {}; let mostrar = POR_PAGINA; let marcado = 0; let pedido = 0; let reloj = null;

  function leerUrl(){
    const u = new URLSearchParams(location.search);
    const f = u.get('f'); filtro = ATAJOS.some((x) => x.id === f) ? f : 'todos';
    q = (u.get('q') || '').slice(0, 60);
    sel = {}; SELS.forEach((x) => { const v = u.get(x.k); if(v) sel[x.k] = v.slice(0, 60); });
    return { c: Number(u.get('c')) || 0, t: u.get('t') || '' };
  }
  function guardarUrl(){
    const u = new URLSearchParams();
    if(filtro !== 'todos') u.set('f', filtro); if(q) u.set('q', q);
    SELS.forEach((x) => { if(sel[x.k]) u.set(x.k, sel[x.k]); });
    const s = u.toString(); history.replaceState(history.state, '', location.pathname + (s ? '?' + s : ''));
  }
  const nSel = () => SELS.filter((x) => sel[x.k]).length;
  const filas = () => (D && D.filas) || [];

  // Filtros en el dispositivo (búsqueda por nombre, RIF o código Proham)
  function pasaSel(r){
    return (!sel.ejecutiva || (r.ejecutiva || 'Sin asignar') === sel.ejecutiva) && (!sel.ruta || (r.ruta_documentos || 'sin') === sel.ruta) &&
      (!sel.activo || (sel.activo === 'activos' ? r.activo : !r.activo));
  }
  function pasaAtajo(r, f){
    return f === 'isp' ? r.tipo === 'isp' : f === 'corporativo' ? r.tipo !== 'isp' : f === 'faltan' ? r.vacias > 0 : f === 'verificar' ? r.verificar : true;
  }
  function pasaBusca(r){
    if(!q) return true; const b = normalizeStr(q); const d = q.replace(/\D/g, '');
    return normalizeStr(r.nombre).indexOf(b) >= 0 || (d.length >= 3 && String(r.doc_numero || '').indexOf(d.replace(/^0+/, '')) >= 0);
  }
  const visibles = () => filas().filter((r) => pasaSel(r) && pasaBusca(r) && (q ? true : pasaAtajo(r, filtro)));

  function pintarAviso(){
    const isp = filas().filter((r) => r.tipo === 'isp'); const faltan = isp.filter((r) => r.vacias > 0).length; const ver = filas().filter((r) => r.verificar).length;
    const plazo = (isp.find((r) => r.plazo) || {}).plazo;
    let h = '';
    if(isp.length && plazo) h += '<button type="button" class="franja ' + (faltan ? 'ambar' : 'verde') + '" data-filtro="isp">' + ic(faltan ? 'alerta' : 'check') + '<span><b>ISP: documentos hasta la semana del ' + esc(semana(plazo)) + '</b>' +
      esc(faltan ? 'A ' + plural(faltan, 'ISP le faltan', 'ISP les faltan') + ' documentos. Tócalo para verlos.' : 'Todos los ISP tienen sus documentos.') + '</span></button>';
    if(ver) h += '<button type="button" class="franja ambar" data-filtro="verificar">' + ic('alerta') + '<span><b>' + plural(ver, 'cliente pendiente', 'clientes pendientes') + ' por verificar</b>RIF repetido, distinto o duplicado. Igual se pueden subir sus documentos.</span></button>';
    $('avisoDed').innerHTML = h;
  }
  function semana(iso){ const d = new Date(String(iso).slice(0, 10) + 'T12:00:00'); d.setDate(d.getDate() - 4); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); }
  function pintarAtajos(){
    const n = nSel();
    $('filtros').innerHTML = '<button type="button" class="bfil" id="abrirFiltros">Filtros' + (n ? '<u>' + n + '</u>' : '') + '</button>' + ATAJOS.map((f) => {
      const c = D ? filas().filter((r) => pasaSel(r) && pasaAtajo(r, f.id)).length : null;
      const on = f.id === filtro && !q;
      return '<button type="button" data-filtro="' + f.id + '" class="' + (on ? 'on' : '') + '" aria-pressed="' + on + '">' + esc(f.t) + (c !== null ? ' <em>' + c + '</em>' : '') + '</button>';
    }).join('');
  }
  function opcionesDe(k){
    if(k === 'ejecutiva') return Array.from(new Set(filas().map((r) => r.ejecutiva || 'Sin asignar'))).sort().map((v) => [v, v]);
    if(k === 'ruta') return Object.keys(RUTA_CORTA).map((v) => [v, RUTA_CORTA[v]]).concat([['sin', 'Sin ruta']]);
    return [['activos', 'Con algo activo'], ['suspendidos', 'Todo suspendido']];
  }
  function pintarSels(){
    const campos = (pre) => SELS.map((x) => {
      const ops = opcionesDe(x.k); const v = sel[x.k] || '';
      return '<div class="campo-s"><label for="' + pre + x.k + '">' + x.t + '</label><select id="' + pre + x.k + '" data-sel="' + x.k + '" class="' + (v ? 'puesto' : '') + '"><option value="">Todos</option>' +
        ops.map((o) => '<option value="' + esc(o[0]) + '"' + (o[0] === v ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select></div>';
    }).join('');
    const foco = document.activeElement && document.activeElement.id;
    $('selsPc').innerHTML = campos('p'); $('selsTel').innerHTML = campos('t');
    if(foco && $(foco) && $(foco).tagName === 'SELECT') $(foco).focus();
    const b = $('verFiltrados'); if(b) b.textContent = 'Ver ' + plural(visibles().length, 'dedicado', 'dedicados');
  }
  // Documentos y contrato: lo que falta y qué sigue, en una línea
  function sigue(r){
    const ctr = window.FichaDedicado && window.FichaDedicado.CONTRATO[r.contrato];
    const docs = r.vacias ? (r.vacias === 1 ? 'Falta 1 documento' : 'Faltan ' + r.vacias + ' documentos') + (r.ruta_documentos ? ': ' + RUTA_CORTA[r.ruta_documentos].toLowerCase() : '') : r.por_revisar ? plural(r.por_revisar, 'documento', 'documentos') + ' por revisar' : 'Documentos completos';
    return [r.vacias ? (r.tipo === 'isp' ? 'rojo' : 'ambar') : 'verde', docs + (ctr ? '. Contrato: ' + ctr[1].toLowerCase() : '')];
  }
  function fila(r){
    const s = sigue(r);
    const sub = [r.provisional ? 'Provisional, sin RIF' : docFmt(r.doc_tipo, r.doc_numero), r.tipo === 'isp' ? 'Dedicado ISP' : 'Dedicado corporativo', plural(r.enlaces, 'enlace activo', 'enlaces activos'), r.vgt ? 'VGT' : '', r.colocation ? 'Colocation' : ''].filter(Boolean).join(' · ');
    return '<button type="button" class="cli' + (marcado === r.id ? ' sel' : '') + (r.activo ? '' : ' apagado') + '" data-cliente="' + esc(r.id) + '">' +
      '<span class="quien"><span class="mono" aria-hidden="true">' + esc(iniciales(r.nombre).charAt(0)) + '</span><span><b>' + esc(r.nombre) + '</b><small>' +
        (r.verificar ? '<span class="tagn ambar">Pendiente por verificar</span>' : '') + (r.tipo === 'isp' ? '<span class="tagn azul">ISP</span>' : '') + esc(sub) + '</small></span></span>' +
      '<span class="c2">' + esc(r.ejecutiva || 'Sin asignar') + '</span><span class="c3">' + chipEstatus(r.estatus) + '</span>' +
      '<span class="sig ' + s[0] + '">' + esc(s[1]) + '</span>' + ic('derecha', 'ch fl') + '</button>';
  }
  function pintarLista(){
    const v = visibles(); const n = nSel();
    $('cuentaLista').innerHTML = (q ? plural(v.length, 'resultado', 'resultados') + ' en todos los dedicados' : plural(v.length, 'dedicado', 'dedicados')) + (n ? '<button type="button" class="enlace" id="quitarFiltros">Quitar filtros</button>' : '');
    if(!v.length){
      $('enc').classList.add('hidden'); $('pieLista').classList.add('hidden');
      $('lista').innerHTML = !filas().length ? vacio('Todavía no tienes dedicados', yo && yo.rol === 'lider' ? 'Cuando el administrador te asigne clientes dedicados, aparecen aquí.' : 'Sube el archivo de la analista en Actualizar datos para cargarlos.')
        : q ? vacio('No encontramos nada con "' + q + '"', 'Prueba con otra parte del nombre o el RIF sin guiones.')
        : vacio('Ningún dedicado con esos filtros', 'Quita alguno para ver más.', '<button type="button" class="btn btn-chico btn-2" id="quitarFiltros2">Quitar filtros</button>');
      return;
    }
    $('enc').classList.remove('hidden');
    $('lista').innerHTML = '<div class="lista-cli">' + v.slice(0, mostrar).map(fila).join('') + '</div>';
    const pie = $('pieLista'); pie.classList.remove('hidden');
    pie.innerHTML = '<span>Mostrando ' + Math.min(mostrar, v.length) + ' de ' + v.length + '.</span>' + (mostrar < v.length ? '<button type="button" class="btn btn-chico btn-2" id="verMas">Ver más</button>' : '');
  }
  function pintar(){ pintarAviso(); pintarAtajos(); pintarSels(); pintarLista(); }
  function esqueletos(){ let h = ''; for(let i = 0; i < 6; i++) h += '<div class="sk-cli" aria-hidden="true"><span class="sk" style="width:40px;height:40px;border-radius:12px"></span><span class="sk-tx"><span class="sk" style="width:' + (45 + i * 7) + '%;height:14px"></span><span class="sk" style="width:' + (30 + i * 5) + '%;height:11px"></span></span></div>'; return h; }

  async function cargar(){
    const mio = ++pedido;
    if(!D){ const g = cache.leer('dedicados'); if(g && g.rol === yo.rol){ D = g; pintar(); } else { $('lista').innerHTML = esqueletos(); $('cuentaLista').textContent = 'Cargando…'; } }
    try {
      const d = await rpc('dedicados_lista', {});
      if(mio !== pedido) return;
      D = d; cache.guardar('dedicados', d); pintar();
    } catch (e) {
      if(mio !== pedido) return;
      if(!D) $('lista').innerHTML = '<div class="vacio" role="alert"><b>No se pudo cargar la lista</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" id="reintentar">Reintentar</button></div>';
      toast(e.message, 'error');
    }
  }
  function abrirCliente(idc, o){
    marcado = idc; Array.prototype.forEach.call(document.querySelectorAll('.cli'), (x) => x.classList.toggle('sel', Number(x.dataset.cliente) === idc));
    window.Ficha.abrir(idc, Object.assign({ yo, alCerrar: cargar }, o || {}));
  }

  document.addEventListener('click', (e) => {
    const t = e.target; let b;
    if((b = t.closest('#filtros [data-filtro], #avisoDed [data-filtro]'))){ filtro = b.dataset.filtro; q = ''; $('busca').value = ''; mostrar = POR_PAGINA; guardarUrl(); pintar(); return; }
    if(t.closest('#abrirFiltros')){ abrirHoja('hojaFiltros'); return; }
    if(t.closest('#quitarFiltros') || t.closest('#quitarFiltros2') || t.closest('#limpiarFiltros')){ sel = {}; mostrar = POR_PAGINA; guardarUrl(); pintar(); return; }
    if(t.closest('#verMas')){ mostrar += POR_PAGINA; pintarLista(); return; }
    if(t.closest('#lista #reintentar')){ cargar(); return; }
    if((b = t.closest('.cli[data-cliente]'))) abrirCliente(Number(b.dataset.cliente));
  });
  document.addEventListener('change', (e) => {
    const x = e.target.closest('[data-sel]'); if(!x) return;
    if(x.value) sel[x.dataset.sel] = x.value; else delete sel[x.dataset.sel];
    mostrar = POR_PAGINA; guardarUrl(); pintar();
  });
  $('formBusca').addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(reloj); buscar(); $('busca').blur(); });
  $('busca').addEventListener('input', () => { clearTimeout(reloj); reloj = setTimeout(buscar, 250); });
  function buscar(){ const v = $('busca').value.trim().slice(0, 60); if(v === q) return; q = v; mostrar = POR_PAGINA; guardarUrl(); pintar(); }
  $('hojaFiltros').addEventListener('hoja-cerrada', () => setTimeout(guardarUrl, 60));
  document.addEventListener('dedicado-cambio', () => cargar());
  document.addEventListener('visibilitychange', () => { if(!document.hidden && yo && !window.Comun.hojaAbierta()) cargar(); });

  window.Armazon.arrancar(['admin', 'abogado', 'lider', 'analista'], { activo: 'dedicados' }, (p) => {
    yo = p;
    window.Ficha.montar();
    const u = leerUrl(); $('busca').value = q; pintarAtajos(); pintarSels();
    cargar();
    if(u.c){ guardarUrl(); abrirCliente(u.c, { tab: u.t }); }
  }, (p) => { yo = p; });
})();
