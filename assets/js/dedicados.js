// Dedicados: pantalla de operación para el administrador y la analista (corrida urgente 14/10). Los expedientes viven en Clientes
// (tarjetas Dedicado corporativo y Dedicado ISP); aquí se mira la operación: lo pendiente de cada cliente, enlaces y capacidades,
// contratos y vencimientos, proyectos VGT, pólizas por vencer y, cuando se defina el archivo, cobranza. Tocar un cliente abre la misma hoja.
// El líder y Legal que lleguen aquí (enlaces viejos) van a Clientes con la tarjeta ISP marcada.
(function(){
  'use strict';
  const { $, esc, ic, rpc, toast, cache, vacio, docFmt, chipEstatus, plural, iniciales, abrirHoja, normalizeStr, fecha, diasEntre, ESTATUS } = window.Comun;
  const POR_PAGINA = 40;
  const VISTAS = [
    { id: 'pendientes', t: 'Pendientes', col: 'Lo pendiente' }, { id: 'enlaces', t: 'Enlaces', col: 'Enlaces y capacidad' },
    { id: 'contratos', t: 'Contratos', col: 'Contratos y vencimientos' }, { id: 'vgt', t: 'VGT', col: 'Proyectos VGT' },
    { id: 'polizas', t: 'Pólizas', col: 'Póliza' }, { id: 'cobranza', t: 'Cobranza', col: '' }
  ];
  // A estos se llega desde los avisos de arriba
  const EXTRA = { isp: 'ISP', verificar: 'Por verificar' };
  const SELS = [{ k: 'lider', t: 'Líder' }, { k: 'tipo', t: 'Tipo' }, { k: 'estatus', t: 'Estatus legal' }, { k: 'vgt', t: 'VGT' }, { k: 'activo', t: 'Enlaces' }];
  let yo = null; let D = null; let vista = 'pendientes'; let extra = ''; let q = ''; let sel = {}; let mostrar = POR_PAGINA; let marcado = 0; let pedido = 0; let reloj = null;

  function leerUrl(){
    const u = new URLSearchParams(location.search);
    const v = u.get('v'); vista = VISTAS.some((x) => x.id === v) ? v : 'pendientes';
    const f = u.get('f'); extra = Object.prototype.hasOwnProperty.call(EXTRA, f || '') ? f : '';
    q = (u.get('q') || '').slice(0, 60);
    sel = {}; SELS.forEach((x) => { const s = u.get(x.k); if(s) sel[x.k] = s.slice(0, 60); });
    return { c: Number(u.get('c')) || 0, t: u.get('t') || '' };
  }
  function guardarUrl(){
    const u = new URLSearchParams();
    if(vista !== 'pendientes') u.set('v', vista); if(extra) u.set('f', extra); if(q) u.set('q', q);
    SELS.forEach((x) => { if(sel[x.k]) u.set(x.k, sel[x.k]); });
    const s = u.toString(); history.replaceState(history.state, '', location.pathname + (s ? '?' + s : ''));
  }
  const nSel = () => SELS.filter((x) => sel[x.k]).length;
  const filas = () => (D && D.filas) || [];

  // ---------- Qué cuenta en cada vista ----------
  const tipoDe = (r) => (r.seg === 'PYME + Dedicado' ? 'combinado' : r.tipo === 'isp' || r.seg === 'Dedicado ISP' ? 'isp' : 'corporativo');
  const CTR = () => (window.FichaDedicado && window.FichaDedicado.CONTRATO) || {};
  const ctrTxt = (e) => ((CTR()[e] || [])[1] || e || 'Sin dato').toLowerCase();
  function pendientes(r){
    const l = [];
    if(r.verificar) l.push(['ambar', 'Por verificar']);
    if(r.vacias) l.push([r.tipo === 'isp' ? 'rojo' : 'ambar', r.vacias === 1 ? 'Falta 1 documento' : 'Faltan ' + r.vacias + ' documentos']);
    if(r.por_revisar) l.push(['ambar', plural(r.por_revisar, 'documento', 'documentos') + ' por revisar']);
    if(r.contrato && r.contrato !== 'firmado' && r.contrato !== 'del_cliente') l.push(['morado', 'Contrato ' + ctrTxt(r.contrato)]);
    if(r.vgt && r.vgt_faltan) l.push(['ambar', 'VGT: ' + (r.vgt_faltan === 1 ? 'falta 1 requisito' : 'faltan ' + r.vgt_faltan + ' requisitos')]);
    if(r.vgt_por_firmar) l.push(['ambar', 'VGT por firmar']);
    const dp = diasPoliza(r); if(dp !== null && dp <= 30) l.push([dp < 0 ? 'rojo' : 'ambar', dp < 0 ? 'Póliza vencida' : 'Póliza vence en ' + plural(dp, 'día', 'días')]);
    return l;
  }
  const diasPoliza = (r) => (r.poliza_vence ? diasEntre((D && D.hoy ? D.hoy + 'T12:00:00' : new Date().toISOString()), String(r.poliza_vence).slice(0, 10) + 'T12:00:00') : null);
  const cap = (n) => { const v = Number(n); if(!n) return 'Sin capacidad'; return v >= 1000 ? (v / 1000).toLocaleString('es-VE', { maximumFractionDigits: 2 }) + ' Gbps' : v.toLocaleString('es-VE', { maximumFractionDigits: 2 }) + ' Mbps'; };
  const DE_VISTA = {
    pendientes: (r) => pendientes(r).length > 0,
    enlaces: () => true,
    contratos: (r) => (r.contratos || []).length > 0 || tipoDe(r) === 'combinado',
    vgt: (r) => r.vgt,
    polizas: (r) => !!r.poliza_vence,
    cobranza: () => false
  };
  function sigue(r){
    if(vista === 'pendientes'){ const l = pendientes(r); return [l[0] ? l[0][0] : 'verde', l.map((x) => x[1]).join(' · ') || 'Sin pendientes']; }
    if(vista === 'enlaces') return [r.enlaces ? 'azul' : 'gris', plural(r.enlaces, 'enlace activo', 'enlaces activos') + (r.enlaces ? ' · ' + cap(r.capacidad) : '') + (r.nodos ? ' · ' + r.nodos : '')];
    if(vista === 'contratos'){
      const l = (r.contratos || []).map((k) => ({ servicio: 'Servicio', vgt: 'VGT', colocation: 'Colocation' }[k.tipo] || k.tipo) + ': ' + ctrTxt(k.estatus) + (k.vence ? ', vence ' + k.vence : ''));
      if(tipoDe(r) === 'combinado') l.push('PYME: ' + (r.estatus === 'contrato_firmado' ? 'firmado' : 'por elaborar'));
      const malo = (r.contratos || []).some((k) => ['actualizar', 'por_firmar', 'sin_contrato'].indexOf(k.estatus) >= 0);
      return [malo ? 'ambar' : 'verde', l.join(' · ') || 'Sin contratos'];
    }
    if(vista === 'vgt') return [r.vgt_faltan || r.vgt_por_firmar ? 'ambar' : 'verde', plural(r.vgt_proyectos || 0, 'proyecto', 'proyectos') + ' · ' + plural(r.vgt_postes || 0, 'poste', 'postes') + ' · ' + (r.vgt_faltan ? (r.vgt_faltan === 1 ? 'falta 1 requisito' : 'faltan ' + r.vgt_faltan + ' requisitos') : 'requisitos completos') + (r.vgt_por_firmar ? ' · por firmar' : '')];
    if(vista === 'polizas'){ const d = diasPoliza(r); return [d < 0 ? 'rojo' : d <= 30 ? 'ambar' : 'verde', (d < 0 ? 'Venció el ' : 'Vence el ') + fecha(r.poliza_vence) + (d >= 0 ? ' (en ' + plural(d, 'día', 'días') + ')' : '')]; }
    return ['gris', ''];
  }
  function orden(l){
    if(vista === 'enlaces') return l.slice().sort((a, b) => (Number(b.capacidad) || 0) - (Number(a.capacidad) || 0));
    if(vista === 'polizas') return l.slice().sort((a, b) => String(a.poliza_vence).localeCompare(String(b.poliza_vence)));
    if(vista === 'pendientes') return l.slice().sort((a, b) => pendientes(b).length - pendientes(a).length);
    return l;
  }
  function pasaSel(r){
    return (!sel.lider || (r.ejecutiva || 'Sin asignar') === sel.lider) && (!sel.tipo || tipoDe(r) === sel.tipo) && (!sel.estatus || r.estatus === sel.estatus) &&
      (!sel.vgt || (sel.vgt === 'con' ? r.vgt : r.vgt && r.vgt_por_firmar)) && (!sel.activo || (sel.activo === 'activos' ? r.activo : !r.activo)) &&
      (!extra || (extra === 'isp' ? tipoDe(r) === 'isp' : r.verificar));
  }
  function pasaBusca(r){
    if(!q) return true; const b = normalizeStr(q); const d = q.replace(/\D/g, '');
    return normalizeStr(r.nombre).indexOf(b) >= 0 || (d.length >= 3 && String(r.doc_numero || '').indexOf(d.replace(/^0+/, '')) >= 0);
  }
  const visibles = () => orden(filas().filter((r) => pasaSel(r) && pasaBusca(r) && (q ? true : DE_VISTA[vista](r))));

  // ---------- Pintar ----------
  function pintarAviso(){
    const isp = filas().filter((r) => r.tipo === 'isp'); const faltan = isp.filter((r) => r.vacias > 0).length; const ver = filas().filter((r) => r.verificar).length;
    const plazo = (isp.find((r) => r.plazo) || {}).plazo;
    let h = '';
    if(isp.length && plazo) h += '<button type="button" class="franja ' + (faltan ? 'ambar' : 'verde') + '" data-extra="isp">' + ic(faltan ? 'alerta' : 'check') + '<span><b>ISP: documentos hasta la semana del ' + esc(semana(plazo)) + '</b>' +
      esc(faltan ? 'A ' + plural(faltan, 'ISP le faltan', 'ISP les faltan') + ' documentos. Tócalo para verlos.' : 'Todos los ISP tienen sus documentos.') + '</span></button>';
    if(ver) h += '<button type="button" class="franja ambar" data-extra="verificar">' + ic('alerta') + '<span><b>' + plural(ver, 'cliente pendiente', 'clientes pendientes') + ' por verificar</b>RIF repetido, distinto o duplicado. Igual se pueden subir sus documentos.</span></button>';
    $('avisoDed').innerHTML = h;
  }
  function semana(iso){ const d = new Date(String(iso).slice(0, 10) + 'T12:00:00'); d.setDate(d.getDate() - 4); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); }
  function pintarVistas(){
    const n = nSel(); const base = filas().filter((r) => pasaSel(r) && pasaBusca(r));
    $('filtros').innerHTML = '<button type="button" class="bfil" id="abrirFiltros">Filtros' + (n ? '<u>' + n + '</u>' : '') + '</button>' +
      (extra ? '<button type="button" class="on" data-quitar-extra="1" aria-pressed="true">' + esc(EXTRA[extra]) + ' ' + ic('x') + '</button>' : '') +
      VISTAS.map((v) => { const c = D && v.id !== 'cobranza' ? base.filter(DE_VISTA[v.id]).length : null; const on = v.id === vista && !q;
        return '<button type="button" data-vista="' + v.id + '" class="' + (on ? 'on' : '') + '" aria-pressed="' + on + '">' + esc(v.t) + (c !== null ? ' <em>' + c + '</em>' : '') + '</button>'; }).join('');
    const V = VISTAS.find((x) => x.id === vista);
    $('enc').innerHTML = '<span>Cliente</span><span>Líder</span><span>Estatus legal</span><span>' + esc(V.col) + '</span><span></span>';
  }
  function opcionesDe(k){
    if(k === 'lider') return Array.from(new Set(filas().map((r) => r.ejecutiva || 'Sin asignar'))).sort().map((v) => [v, v]);
    if(k === 'tipo') return [['isp', 'ISP'], ['corporativo', 'Corporativo'], ['combinado', 'Combinado (dedicado + PYME)']];
    if(k === 'estatus') return Object.keys(ESTATUS).map((e) => [e, ESTATUS[e].t]);
    if(k === 'vgt') return [['con', 'Con VGT'], ['por_firmar', 'VGT por firmar']];
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
  function fila(r){
    const s = sigue(r); const tp = tipoDe(r);
    const sub = [r.provisional ? 'Provisional, sin RIF' : docFmt(r.doc_tipo, r.doc_numero), tp === 'isp' ? 'Dedicado ISP' : tp === 'combinado' ? 'Dedicado + PYME' : 'Dedicado corporativo', r.colocation ? 'Colocation' : ''].filter(Boolean).join(' · ');
    return '<button type="button" class="cli' + (marcado === r.id ? ' sel' : '') + (r.activo ? '' : ' apagado') + '" data-cliente="' + esc(r.id) + '">' +
      '<span class="quien"><span class="mono" aria-hidden="true">' + esc(iniciales(r.nombre).charAt(0)) + '</span><span><b>' + esc(r.nombre) + '</b><small>' +
        (r.verificar ? '<span class="tagn ambar">Pendiente por verificar</span>' : '') + (tp === 'isp' ? '<span class="tagn azul">ISP</span>' : '') +
        (r.vgt ? (r.vgt_por_firmar ? '<span class="tagn ambar">VGT por firmar</span>' : '<span class="tagn azul">VGT</span>') : '') + esc(sub) + '</small></span></span>' +
      '<span class="c2">' + esc(r.ejecutiva || 'Sin asignar') + '</span><span class="c3">' + chipEstatus(r.estatus) + '</span>' +
      '<span class="sig ' + s[0] + '">' + esc(s[1]) + '</span>' + ic('derecha', 'ch fl') + '</button>';
  }
  function pintarLista(){
    if(vista === 'cobranza' && !q){
      $('enc').classList.add('hidden'); $('pieLista').classList.add('hidden'); $('cuentaLista').innerHTML = '&nbsp;';
      $('lista').innerHTML = vacio('Cobranza e ingresos', 'Aquí se verá lo facturado, lo cobrado y lo pendiente de cada dedicado. Falta que el administrador diga de qué archivo salen esos datos.');
      return;
    }
    const v = visibles(); const n = nSel();
    $('cuentaLista').innerHTML = (q ? plural(v.length, 'resultado', 'resultados') + ' en todos los dedicados' : plural(v.length, 'dedicado', 'dedicados')) + (n || extra ? '<button type="button" class="enlace" id="quitarFiltros">Quitar filtros</button>' : '');
    if(!v.length){
      $('enc').classList.add('hidden'); $('pieLista').classList.add('hidden');
      $('lista').innerHTML = !filas().length ? vacio('Todavía no hay dedicados', 'Sube el archivo de la analista en Actualizar datos para cargarlos.')
        : q ? vacio('No encontramos nada con "' + q + '"', 'Prueba con otra parte del nombre o el RIF sin guiones.')
        : n || extra ? vacio('Ningún dedicado con esos filtros', 'Quita alguno para ver más.', '<button type="button" class="btn btn-chico btn-2" id="quitarFiltros2">Quitar filtros</button>')
        : vacio('Nada en ' + VISTAS.find((x) => x.id === vista).t, vista === 'pendientes' ? 'Ningún dedicado tiene pendientes ahora mismo.' : 'Mira las otras pestañas.');
      return;
    }
    $('enc').classList.remove('hidden');
    $('lista').innerHTML = '<div class="lista-cli">' + v.slice(0, mostrar).map(fila).join('') + '</div>';
    const pie = $('pieLista'); pie.classList.remove('hidden');
    pie.innerHTML = '<span>Mostrando ' + Math.min(mostrar, v.length) + ' de ' + v.length + '.</span>' + (mostrar < v.length ? '<button type="button" class="btn btn-chico btn-2" id="verMas">Ver más</button>' : '');
  }
  function pintar(){ pintarAviso(); pintarVistas(); pintarSels(); pintarLista(); }
  function esqueletos(){ let h = ''; for(let i = 0; i < 6; i++) h += '<div class="sk-cli" aria-hidden="true"><span class="sk" style="width:40px;height:40px;border-radius:12px"></span><span class="sk-tx"><span class="sk" style="width:' + (45 + i * 7) + '%;height:14px"></span><span class="sk" style="width:' + (30 + i * 5) + '%;height:11px"></span></span></div>'; return h; }

  async function cargar(){
    const mio = ++pedido;
    if(!D){ const g = cache.leer('dedicados2'); if(g && g.rol === yo.rol){ D = g; pintar(); } else { $('lista').innerHTML = esqueletos(); $('cuentaLista').textContent = 'Cargando…'; } }
    try {
      const d = await rpc('dedicados_lista', {});
      if(mio !== pedido) return;
      D = d; cache.guardar('dedicados2', d); pintar();
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
    if((b = t.closest('#filtros [data-vista]'))){ vista = b.dataset.vista; q = ''; $('busca').value = ''; mostrar = POR_PAGINA; guardarUrl(); pintar(); return; }
    if((b = t.closest('#avisoDed [data-extra]'))){ extra = b.dataset.extra; vista = 'pendientes'; q = ''; $('busca').value = ''; mostrar = POR_PAGINA; guardarUrl(); pintar(); return; }
    if(t.closest('#filtros [data-quitar-extra]')){ extra = ''; guardarUrl(); pintar(); return; }
    if(t.closest('#abrirFiltros')){ abrirHoja('hojaFiltros'); return; }
    if(t.closest('#quitarFiltros') || t.closest('#quitarFiltros2') || t.closest('#limpiarFiltros')){ sel = {}; extra = ''; mostrar = POR_PAGINA; guardarUrl(); pintar(); return; }
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
    // El líder y Legal ven sus dedicados en Clientes: los enlaces viejos siguen funcionando
    if(p.rol === 'lider' || p.rol === 'abogado'){
      // Con un cliente: se abre su hoja sin fijar tarjeta (puede ser corporativo); sin cliente: la tarjeta ISP
      const u = new URLSearchParams(location.search); const n = new URLSearchParams();
      if(Number(u.get('c'))){ n.set('c', u.get('c')); if(u.get('t')) n.set('t', u.get('t')); } else n.set('s', 'isp');
      location.replace('clientes.html?' + n.toString()); return;
    }
    window.Ficha.montar();
    const u = leerUrl(); $('busca').value = q; pintarVistas(); pintarSels();
    cargar();
    if(u.c){ guardarUrl(); abrirCliente(u.c, { tab: u.t }); }
  }, (p) => { yo = p; });
})();
