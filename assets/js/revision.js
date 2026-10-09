// Revisión: bandejas del administrador y de la abogada, revisar varios clientes con IA y comparar lo que propuso con lo que decidió Legal.
(function(){
  'use strict';
  const { $, esc, ic, rpc, toast, vacio, docFmt, chipEstatus, plural, iniciales, abrirHoja, cerrarHoja, hojaAbierta, fecha, casilla, cache, ESTATUS } = window.Comun;
  const S = window.Sesion;
  const POR_PAGINA = 30;
  const BANDEJAS = {
    admin: [
      { id: 'por_revisar', t: 'Por revisar', a: 'Expedientes con documentos nuevos. Ábrelos para revisar a mano o márcalos para la IA.' },
      { id: 'borradores', t: 'Borradores de la IA', a: 'La IA ya terminó: revisa lo que propuso y cierra la revisión.' },
      { id: 'en_curso', t: 'Revisión en curso', a: 'Tienen documentos marcados sin cerrar. El líder todavía no sabe nada.' },
      { id: 'leyendo', t: 'La IA está leyendo', a: 'Se actualiza sola. Puedes seguir trabajando.' },
      { id: 'por_firmar', t: 'Por firmar', a: 'El contrato ya se envió y falta la firma del cliente.' },
      { id: 'analizables', t: 'Todos con documentos', a: 'Marca los clientes que quieres revisar con IA. Solo se pagan los archivos que nunca se han leído.' },
      { id: 'comparar', t: 'Comparar con Legal', a: 'Lo que propuso la IA contra lo que quedó decidido, documento por documento.' }
    ],
    abogado: [
      { id: 'contrato', t: 'Para contrato', a: 'Documentos recibidos y revisados: falta elaborar el contrato.' },
      { id: 'por_firmar', t: 'Por firmar', a: 'El contrato ya se envió y falta la firma del cliente.' },
      { id: 'por_revisar', t: 'Por revisar', a: 'Puedes marcar los documentos; la revisión la cierra el administrador.' },
      { id: 'en_curso', t: 'Revisión en curso', a: 'Tienen documentos marcados sin cerrar.' }
    ]
  };
  const VEREDICTO = { apto: ['verde', 'IA: Apto'], no_apto: ['rojo', 'IA: No apto'], revisar_a_mano: ['morado', 'IA: A mano'] };

  let yo = null; let rol = ''; let bandeja = ''; let q = ''; let filas = []; let total = 0; let conteos = null;
  let pedido = 0; let reloj = null; let sondeo = null; let marcados = new Map(); let comparar = null;

  const lista = () => BANDEJAS[rol] || [];
  const actual = () => lista().find((b) => b.id === bandeja) || lista()[0];
  const puedeIA = () => rol === 'admin' && bandeja !== 'comparar';

  function leerUrl(){
    const u = new URLSearchParams(location.search); const b = u.get('b');
    bandeja = lista().some((x) => x.id === b) ? b : lista()[0].id;
    q = (u.get('q') || '').slice(0, 60);
  }
  function guardarUrl(){
    const u = new URLSearchParams(); if(bandeja !== lista()[0].id) u.set('b', bandeja); if(q) u.set('q', q);
    const s = u.toString(); history.replaceState(history.state, '', location.pathname + (s ? '?' + s : ''));
  }
  function pintarAtajos(){
    $('filtros').innerHTML = lista().map((b) => {
      const c = conteos && conteos[b.id] !== undefined ? '<em>' + esc(conteos[b.id]) + '</em>' : '';
      return '<button type="button" data-bandeja="' + b.id + '" class="' + (b.id === bandeja ? 'on' : '') + '" aria-pressed="' + (b.id === bandeja) + '">' + esc(b.t) + ' ' + c + '</button>';
    }).join('');
    $('ayuda').textContent = actual().a;
  }

  // ---------- Lista ----------
  function chipIA(f){
    const k = f.ia; if(!k) return '';
    if(k.estado === 'en_cola' || k.estado === 'leyendo') return '<span class="chip azul">Leyendo ' + esc(k.avance + ' de ' + k.total) + '</span>';
    if(k.estado === 'error') return '<span class="chip rojo">La IA no terminó</span>';
    if(k.estado === 'lista'){ const v = VEREDICTO[k.veredicto] || ['', 'IA lista']; return '<span class="chip ' + v[0] + '">' + v[1] + '</span>'; }
    return '';
  }
  function fila(f){
    const sub = [docFmt(f.doc_tipo, f.doc_numero), f.lider || 'Sin líder'].filter(Boolean).join(' · ');
    const arch = f.archivos ? plural(f.archivos, 'archivo', 'archivos') + (f.nuevos ? ', ' + f.nuevos + ' sin leer' : ', todos leídos') : 'Sin documentos';
    const marc = marcados.has(f.id); const leyendo = f.ia && (f.ia.estado === 'en_cola' || f.ia.estado === 'leyendo');
    return '<div class="rv' + (marc ? ' sel' : '') + (puedeIA() ? ' con-caja' : '') + '">' +
      (puedeIA() ? '<button type="button" class="caja-rv' + (marc ? ' on' : '') + '" data-marcar="' + esc(f.id) + '" aria-pressed="' + marc + '" aria-label="Marcar ' + esc(f.nombre) + '"' + (leyendo || !f.archivos ? ' disabled' : '') + '><i></i></button>' : '') +
      '<button type="button" class="rv-cuerpo" data-cliente="' + esc(f.id) + '">' +
        '<span class="quien"><span class="mono" aria-hidden="true">' + esc(iniciales(f.nombre).charAt(0)) + '</span><span><b>' + esc(f.nombre) + '</b><small>' + esc(sub) + '</small></span></span>' +
        '<span class="rv-chips">' + chipEstatus(f.estatus) + chipIA(f) + (f.marcas ? '<span class="chip">' + esc(plural(f.marcas, 'marcado', 'marcados')) + '</span>' : '') + '</span>' +
        '<span class="rv-arch">' + esc(arch) + '</span>' + ic('derecha', 'ch fl') + '</button></div>';
  }
  function pintarLista(){
    if(bandeja === 'comparar') return pintarComparar();
    $('cuentaLista').textContent = q ? plural(total, 'resultado', 'resultados') : plural(total, 'cliente', 'clientes');
    if(!filas.length){
      $('lista').innerHTML = q ? vacio('No encontramos nada con "' + q + '"', 'Prueba con otra parte del nombre o el RIF sin guiones.')
        : vacio('Nada en esta bandeja', { borradores: 'Cuando la IA termine una revisión, aparece aquí.', leyendo: 'La IA no está leyendo ningún expediente ahora.', en_curso: 'No hay revisiones sin cerrar.', contrato: 'Ningún expediente espera contrato.' }[bandeja] || 'No hay clientes en este grupo ahora mismo.',
          rol === 'admin' && bandeja !== 'analizables' ? '<button type="button" class="btn btn-chico btn-2" data-bandeja="analizables">Ver todos con documentos</button>' : '');
      $('pieLista').classList.add('hidden'); return;
    }
    $('lista').innerHTML = '<div class="lista-rv">' + filas.map(fila).join('') + '</div>';
    const pie = $('pieLista'); pie.classList.remove('hidden');
    pie.innerHTML = '<span>Mostrando ' + filas.length + ' de ' + total + '.</span>' + (filas.length < total ? '<button type="button" class="btn btn-chico btn-2" id="verMas">Ver más</button>' : '');
  }
  function esqueletos(){ let h = ''; for(let i = 0; i < 6; i++) h += '<div class="sk-cli" aria-hidden="true"><span class="sk" style="width:40px;height:40px;border-radius:12px"></span><span class="sk-tx"><span class="sk" style="width:' + (45 + i * 7) + '%;height:14px"></span><span class="sk" style="width:' + (30 + i * 5) + '%;height:11px"></span></span></div>'; return h; }
  const clave = () => 'revision:' + rol + ':' + bandeja + ':' + q;

  async function cargar(mas){
    const mio = ++pedido; clearTimeout(sondeo);
    if(bandeja === 'comparar') return cargarComparar(mio);
    if(!mas){
      const g = cache.leer(clave());
      if(g){ filas = g.filas; total = g.total; conteos = g.conteos; pintarAtajos(); pintarLista(); }
      else { $('lista').innerHTML = esqueletos(); $('pieLista').classList.add('hidden'); $('cuentaLista').textContent = 'Cargando…'; }
    } else { const b = $('verMas'); if(b){ b.disabled = true; b.textContent = 'Cargando…'; } }
    try {
      const d = await rpc('revision_bandeja', { p_bandeja: bandeja, p_busca: q || null, p_desde: mas ? filas.length : 0, p_limite: POR_PAGINA });
      if(mio !== pedido) return;
      filas = mas ? filas.concat(d.filas || []) : (d.filas || []); total = d.total || 0; conteos = d.conteos || null;
      if(!mas) cache.guardar(clave(), { filas, total, conteos });
      pintarAtajos(); pintarLista(); pintarAccion(); vigilar();
    } catch (e) {
      if(mio !== pedido) return;
      if(!mas || !filas.length) $('lista').innerHTML = '<div class="vacio" role="alert"><b>No se pudo cargar la bandeja</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" id="reintentar">Reintentar</button></div>';
      else { const b = $('verMas'); if(b){ b.disabled = false; b.textContent = 'Ver más'; } }
      toast(e.message, 'error');
    }
  }
  // Si hay expedientes leyéndose en pantalla, la lista se refresca sola cada 8 segundos
  function vigilar(){
    clearTimeout(sondeo);
    const hay = bandeja === 'leyendo' ? filas.length : filas.some((f) => f.ia && (f.ia.estado === 'en_cola' || f.ia.estado === 'leyendo'));
    if(!hay) return;
    sondeo = setTimeout(() => { if(!document.hidden && !hojaAbierta()) refrescar(); else vigilar(); }, 8000);
  }
  async function refrescar(){
    if(bandeja === 'comparar') return cargar(false);
    const mio = ++pedido;
    try {
      const d = await rpc('revision_bandeja', { p_bandeja: bandeja, p_busca: q || null, p_desde: 0, p_limite: Math.min(60, Math.max(POR_PAGINA, filas.length)) });
      if(mio !== pedido) return;
      const antes = filas.filter((f) => f.ia && (f.ia.estado === 'en_cola' || f.ia.estado === 'leyendo')).map((f) => f.id);
      filas = d.filas || []; total = d.total || 0; conteos = d.conteos || null;
      const listos = filas.filter((f) => antes.includes(f.id) && f.ia && f.ia.estado === 'lista');
      if(listos.length) toast(listos.length === 1 ? 'La IA terminó con ' + listos[0].nombre + '. Míralo en Borradores de la IA' : 'La IA terminó ' + listos.length + ' revisiones. Míralas en Borradores de la IA');
      pintarAtajos(); pintarLista(); pintarAccion(); vigilar();
    } catch (e) { vigilar(); }
  }

  // ---------- Marcar varios y lanzar la IA ----------
  function pintarAccion(){
    const a = $('accionRv');
    if(!puedeIA() || !marcados.size){ a.classList.add('hidden'); a.innerHTML = ''; return; }
    const nuevos = Array.from(marcados.values()).reduce((s, f) => s + (f.nuevos || 0), 0);
    a.classList.remove('hidden');
    a.innerHTML = '<span class="tx"><b>' + esc(plural(marcados.size, 'cliente marcado', 'clientes marcados')) + '</b>' + esc(plural(nuevos, 'archivo por leer', 'archivos por leer')) + '</span>' +
      '<button type="button" class="btn btn-chico btn-2 solo-pc" id="quitarMarcas">Quitar marcas</button><button type="button" class="btn btn-chico" id="revisarIA">Revisar ' + marcados.size + ' con IA</button>';
  }
  async function abrirLanzar(){
    const ids = Array.from(marcados.keys());
    const h = $('hojaLanzar');
    h.innerHTML = cab('tLanzar', 'Revisar con IA', plural(ids.length, 'cliente', 'clientes')) + '<div id="cuerpoLanzar"><span class="sk" style="height:22px;border-radius:8px;display:block;width:60%"></span><span class="sk" style="height:120px;border-radius:16px;display:block;margin-top:12px"></span></div>';
    abrirHoja('hojaLanzar');
    let d;
    try { d = await rpc('ia_estimar', { p_clientes: ids }); }
    catch (e) { $('cuerpoLanzar').innerHTML = '<div class="aviso" role="alert"><b>No se pudo calcular</b><p>' + esc(e.message) + '</p></div>'; return; }
    const cs = d.clientes || []; const nuevos = cs.reduce((s, c) => s + (c.nuevos || 0), 0);
    $('cuerpoLanzar').innerHTML = '<div class="estado azul"><b>' + esc(plural(nuevos, 'archivo nuevo por leer', 'archivos nuevos por leer')) + '</b><small>' +
        esc(nuevos ? 'Unos US$ ' + (nuevos * 0.04).toFixed(2) + ' en total. Lo ya leído se vuelve a revisar sin costo.' : 'Todo ya se leyó: revisar de nuevo no cuesta.') + '</small></div>' +
      '<div class="datos">' + cs.map((c) => '<div class="dato-f"><span>' + esc(c.nombre) + '</span><b>' + esc(c.activa ? 'Ya se está leyendo' : plural(c.archivos, 'archivo', 'archivos') + (c.nuevos ? ', ' + c.nuevos + ' sin leer' : '')) + '</b></div>').join('') + '</div>' +
      '<p class="nota">Puedes seguir trabajando. Cada cliente queda con un borrador; nada cambia el estatus ni le llega al líder hasta que cierres la revisión.</p>' +
      '<div class="error" id="eLanzar" role="alert"></div><div class="acciones"><button type="button" class="btn btn-ancho" id="confirmarIA">Revisar</button></div>';
  }
  async function lanzar(b){
    b.disabled = true; $('eLanzar').textContent = '';
    let r;
    try { r = await rpc('ia_lanzar', { p_clientes: Array.from(marcados.keys()) }); }
    catch (e) { $('eLanzar').textContent = e.message; b.disabled = false; return; }
    const n = (r.lanzadas || []).length; const om = r.omitidos || [];
    if(hojaAbierta() === 'hojaLanzar') cerrarHoja();
    marcados.clear(); pintarAccion();
    toast(n ? 'La IA empezó a leer ' + plural(n, 'cliente', 'clientes') + (om.length ? '. ' + plural(om.length, 'quedó fuera', 'quedaron fuera') + ' porque ya se estaban leyendo' : '') : 'No se lanzó ninguno: ya se estaban leyendo');
    bandeja = 'leyendo'; guardarUrl(); pintarAtajos(); cargar(false);
  }
  const cab = (idT, t, sub) => '<div class="asa" aria-hidden="true"></div><div class="cab"><div><h2 id="' + idT + '">' + esc(t) + '</h2>' + (sub ? '<p class="sub-hoja">' + esc(sub) + '</p>' : '') + '</div><button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>';

  // ---------- Comparar con Legal ----------
  async function cargarComparar(mio){
    $('accionRv').classList.add('hidden'); $('pieLista').classList.add('hidden');
    if(!comparar){ $('lista').innerHTML = esqueletos(); $('cuentaLista').textContent = 'Cargando…'; }
    try { const d = await rpc('ia_comparar', {}); if(mio !== pedido) return; comparar = d.filas || []; pintarAtajos(); pintarComparar(); }
    catch (e) { if(mio !== pedido) return; $('lista').innerHTML = '<div class="vacio" role="alert"><b>No se pudo cargar la comparación</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" id="reintentar">Reintentar</button></div>'; }
  }
  const LEGAL_TX = { bien: 'aprobado', problema: 'devuelto' };
  const IA_TX = { bien: 'bien', problema: 'devolver', revisar_a_mano: 'a mano' };
  function pintarComparar(){
    const fs = comparar || [];
    let docs = 0, igual = 0, mano = 0, clientesIgual = 0;
    fs.forEach((f) => {
      let todo = true;
      (f.docs || []).forEach((x) => { if(!x.legal) return; if(x.ia === 'revisar_a_mano'){ mano++; return; } docs++; if(x.ia === x.legal) igual++; else todo = false; });
      if(todo) clientesIgual++;
    });
    $('cuentaLista').textContent = plural(fs.length, 'cliente revisado con IA', 'clientes revisados con IA');
    if(!fs.length){ $('lista').innerHTML = vacio('Todavía no hay revisiones con IA', 'Marca clientes en "Todos con documentos" y revísalos con IA para compararlos.', '<button type="button" class="btn btn-chico btn-2" data-bandeja="analizables">Ver todos con documentos</button>'); return; }
    const pct = docs ? Math.round(100 * igual / docs) : 0;
    $('lista').innerHTML = '<div class="cifras-rv"><div class="cifra-rv grande"><b>' + igual + ' de ' + docs + '</b><small>documentos donde la IA coincide con Legal (' + pct + ' %)</small></div>' +
      '<div class="cifra-rv"><b>' + clientesIgual + ' de ' + fs.length + '</b><small>clientes sin diferencias</small></div><div class="cifra-rv"><b>' + mano + '</b><small>que la IA dejó a mano</small></div></div>' +
      '<div class="lista-rv">' + fs.map((f) => {
        const dif = (f.docs || []).filter((x) => x.legal && x.ia !== 'revisar_a_mano' && x.ia !== x.legal);
        const v = VEREDICTO[f.veredicto] || ['', 'IA'];
        return '<div class="rv"><button type="button" class="rv-cuerpo" data-cliente="' + esc(f.cliente) + '">' +
          '<span class="quien"><span class="mono" aria-hidden="true">' + esc(iniciales(f.nombre).charAt(0)) + '</span><span><b>' + esc(f.nombre) + '</b><small>' + esc(docFmt(f.doc_tipo, f.doc_numero) + ' · ' + fecha(f.en) + ' · US$ ' + Number(f.costo_usd || 0).toFixed(2)) + '</small></span></span>' +
          '<span class="rv-chips">' + chipEstatus(f.estatus) + '<span class="chip ' + v[0] + '">' + v[1] + '</span></span>' +
          '<span class="rv-arch">' + (dif.length ? esc(dif.map((x) => casilla(x.casilla, x.numero) + ': IA ' + IA_TX[x.ia] + ', Legal ' + LEGAL_TX[x.legal]).join(' · ')) : 'Sin diferencias con Legal') + '</span>' + ic('derecha', 'ch fl') + '</button></div>';
      }).join('') + '</div>';
  }

  // ---------- Eventos ----------
  function abrirCliente(id){ window.Ficha.abrir(id, { yo, tab: 'documentos', alCerrar: refrescar }); }
  document.addEventListener('click', (e) => {
    const t = e.target; let b;
    if((b = t.closest('#filtros [data-bandeja], #lista [data-bandeja]'))){ bandeja = b.dataset.bandeja; q = ''; $('busca').value = ''; marcados.clear(); guardarUrl(); pintarAtajos(); cargar(false); return; }
    if((b = t.closest('[data-marcar]'))){
      const id = Number(b.dataset.marcar); const f = filas.find((x) => x.id === id); if(!f) return;
      if(marcados.has(id)) marcados.delete(id); else { if(marcados.size >= 25){ toast('Hasta 25 clientes por vez', 'error'); return; } marcados.set(id, f); }
      const on = marcados.has(id); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.closest('.rv').classList.toggle('sel', on); pintarAccion(); return;
    }
    if(t.closest('#quitarMarcas')){ marcados.clear(); pintarLista(); pintarAccion(); return; }
    if(t.closest('#revisarIA')){ abrirLanzar(); return; }
    if((b = t.closest('#confirmarIA'))){ lanzar(b); return; }
    if(t.closest('#verMas')){ cargar(true); return; }
    if(t.closest('#lista #reintentar')){ cargar(false); return; }
    if((b = t.closest('.rv-cuerpo[data-cliente]'))) abrirCliente(Number(b.dataset.cliente));
  });
  $('formBusca').addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(reloj); buscar(); $('busca').blur(); });
  $('busca').addEventListener('input', () => { clearTimeout(reloj); reloj = setTimeout(buscar, 380); });
  function buscar(){ const v = $('busca').value.trim(); if(v === q) return; q = v; guardarUrl(); cargar(false); }
  document.addEventListener('visibilitychange', () => { if(!document.hidden && yo && !hojaAbierta()) refrescar(); });

  (async function(){
    yo = await S.requerir(['admin', 'abogado']);
    if(!yo) return;
    rol = yo.rol;
    window.Armazon.montar(yo, { activo: 'revision' });
    window.Ficha.montar(); window.Ficha.alContactarFuera(refrescar);
    leerUrl(); $('busca').value = q; pintarAtajos();
    cargar(false);
    const c = Number(new URLSearchParams(location.search).get('c')) || 0;
    if(c) abrirCliente(c);
  })();
})();
