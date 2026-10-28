// Lote 28/10: Revisión en lote (Mi trabajo, pantalla 2 de mi-trabajo-28oct). Documentos por revisar agrupados por cliente con lo que dijo la IA.
// Filtros de la IA (Apto, No apto, A mano, Sin leer) y "Solo el corte". Aprobar varios, devolver varios con el motivo de la IA (editable) y leer con IA.
// Todo pasa por revision_lote (bitácora por documento, estatus y aviso al líder). "Ver uno por uno" abre la revisión de siempre (pantalla partida).
(function(){
  'use strict';
  const C = window.Comun;
  const { $, esc, ic, rpc, toast, plural, abrirHoja, cerrarHoja, prepararHojas } = C;
  const IA = [['apto', 'IA: Apto', 'ok'], ['no_apto', 'IA: No apto', 'r'], ['mano', 'A mano', 'a'], ['sin_leer', 'Sin leer', 'g']];
  let Z = null; let O = {}; let L = null; let filtro = 'todos'; let corte = false; let busca = ''; let desde = 0; let pedido = 0; let ocupado = false;
  const elegidos = new Map();   // doc id -> { doc, cliente }
  let tBusca = null;

  function abrir(cont, o){
    Z = cont; O = o || {}; L = null; filtro = 'todos'; corte = false; busca = ''; desde = 0; elegidos.clear();
    Z.innerHTML = '<div class="rl-top"><button type="button" class="enlace rl-volver" data-rl="volver">' + ic('volver') + 'Mi trabajo</button><h1 class="titulo">Revisar documentos</h1><span class="rl-prog" id="rlProg"></span></div>' +
      '<div class="rl-flt" id="rlFlt" role="group" aria-label="Filtrar por lo que dijo la IA"></div>' +
      '<div class="rl-busca"><label class="rotulo" for="rlBusca">Buscar cliente</label><input class="campo" id="rlBusca" type="search" maxlength="60" autocomplete="off" enterkeyhint="search"></div>' +
      '<div class="rl-bar hidden" id="rlBar" role="status"></div><div id="rlLista" aria-live="polite"></div>' +
      '<p class="nota-chica rl-pie">¿Quieres comparar lo que dijo la IA con lo que decidió Legal? <a class="enlace" href="revision.html?b=comparar">Comparar IA y Legal</a></p>';
    $('rlBusca').addEventListener('input', () => { clearTimeout(tBusca); tBusca = setTimeout(() => { busca = $('rlBusca').value.trim(); desde = 0; cargar(); }, 300); });
    cargar();
  }
  async function cargar(mas){
    const mio = ++pedido;
    if(!mas){ if(!L) $('rlLista').innerHTML = '<div class="sk-bloque"><span class="sk" style="height:120px;border-radius:16px"></span><span class="sk" style="height:120px;border-radius:16px"></span></div>'; else $('rlLista').setAttribute('aria-busy', 'true'); }
    try {
      const r = await rpc('revision_lote_lista', { p_ia: filtro, p_corte: corte, p_busca: busca || null, p_desde: desde, p_limite: 30 }); if(mio !== pedido) return;
      if(mas && L) L.clientes = L.clientes.concat(r.clientes || []); else L = r;
      L.total = r.total; L.conteos = r.conteos; L.hoy_aprobados = r.hoy_aprobados;
      pintar();
    } catch (e) {
      if(mio !== pedido) return;
      if(!L) $('rlLista').innerHTML = '<div class="vacio" role="alert"><b>No se pudo cargar la revisión</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" data-rl="reintentar">Reintentar</button></div>';
      toast(e.message, 'error');
    } finally { $('rlLista').removeAttribute('aria-busy'); }
  }
  const puede = () => !!(L && L.puedo_cerrar);
  function pintar(){
    const k = L.conteos || {};
    $('rlProg').innerHTML = esc(plural(k.clientes || 0, 'cliente', 'clientes')) + (puede() ? ' · hoy aprobaste <b>' + (L.hoy_aprobados || 0) + '</b>' : '');
    $('rlFlt').innerHTML = IA.map((x) => '<button type="button" class="rl-f' + (filtro === x[0] ? ' on' : '') + '" aria-pressed="' + (filtro === x[0]) + '" data-rl-ia="' + x[0] + '"><i class="c-' + x[2] + '" aria-hidden="true"></i>' + x[1] + ' <span>' + (k[x[0]] || 0) + '</span></button>').join('') +
      '<button type="button" class="rl-f cor' + (corte ? ' on' : '') + '" aria-pressed="' + corte + '" data-rl-corte="1">Solo el corte de ' + esc(L.corte || 'este mes') + ' <span>' + (k.corte || 0) + '</span></button>';
    const cs = L.clientes || [];
    let h = cs.map(grupoHtml).join('');
    if(!cs.length) h = C.vacio(filtro !== 'todos' || corte || busca ? 'Nada con ese filtro' : 'Nada por revisar', filtro !== 'todos' || corte || busca ? 'Quita el filtro para ver el resto.' : 'Cuando suban documentos, aparecen aquí agrupados por cliente.');
    if(cs.length < (L.total || 0)) h += '<button type="button" class="btn btn-chico btn-2 mt-mas" data-rl="mas">Ver ' + Math.min(30, L.total - cs.length) + ' clientes más de ' + (L.total - cs.length) + '</button>';
    $('rlLista').innerHTML = h; pintarBar();
  }
  function grupoHtml(c){
    const docs = c.docs || []; const todos = docs.length && docs.every((d) => elegidos.has(d.id));
    return '<div class="rl-grp" data-cli="' + esc(c.id) + '"><div class="rl-gh">' + (puede() ? '<button type="button" class="rl-cb' + (todos ? ' on' : '') + '" data-rl-cli="' + esc(c.id) + '" aria-pressed="' + todos + '" aria-label="Elegir todos los de ' + esc(c.nombre) + '"></button>' : '') +
      '<b>' + esc(c.nombre) + '</b><span class="rl-s">' + esc([c.lider, plural(c.n, 'documento', 'documentos'), c.en_corte ? 'en el corte' : c.espera > 0 ? 'espera ' + plural(c.espera, 'día', 'días') : 'de hoy'].join(' · ')) + '</span>' +
      '<span class="rl-acts"><button type="button" class="btn btn-chico btn-2" data-rl-drive="' + esc(c.id) + '">Abrir en Drive</button><button type="button" class="btn btn-chico btn-2" data-rl-uno="' + esc(c.id) + '">Ver uno por uno</button></span></div>' +
      docs.map((d) => { const x = IA.find((y) => y[0] === d.ia) || IA[3]; const on = elegidos.has(d.id);
        return '<div class="rl-row">' + (puede() ? '<button type="button" class="rl-cb' + (on ? ' on' : '') + '" data-rl-doc="' + esc(d.id) + '" data-c="' + esc(c.id) + '" aria-pressed="' + on + '" aria-label="Elegir ' + esc(d.cas) + '"></button>' : '<span></span>') +
          '<span class="rl-dn"><b>' + esc(d.cas) + '</b><small>' + esc(d.numero > 0 && d.numero < 60 && /cedula|rif_personal/.test(d.casilla) ? 'representante ' + d.numero : d.casilla === 'acta_asamblea' ? 'acta ' + d.numero : '') + '</small></span>' +
          '<span class="rl-why"><span class="chip ' + ({ ok: 'verde', r: 'rojo', a: 'ambar', g: '' }[x[2]]) + '">' + esc(x[1].replace('IA: ', '')) + '</span>' + esc(d.nota || d.texto || (d.ia === 'sin_leer' ? 'La IA no lo ha leído' : '')) + '</span>' +
          '<small class="rl-d">' + esc(d.dias > 0 ? 'hace ' + plural(d.dias, 'día', 'días') : 'hoy') + '</small></div>'; }).join('') + '</div>';
  }
  function pintarBar(){
    const z = $('rlBar'); const n = elegidos.size; z.classList.toggle('hidden', !puede());
    if(!puede()) return;
    const cs = new Set(Array.from(elegidos.values()).map((x) => x.cliente));
    z.innerHTML = '<b>' + (n ? esc(plural(n, 'documento', 'documentos') + ' de ' + plural(cs.size, 'cliente', 'clientes') + (n === 1 ? ' seleccionado' : ' seleccionados')) : 'Toca los documentos o el cliente para elegirlos') + '</b>' +
      '<button type="button" class="btn btn-chico btn-2" data-rl="ia"' + (n ? '' : ' disabled') + '>Leer con IA</button>' +
      '<button type="button" class="btn btn-chico btn-2 rl-no" data-rl="devolver"' + (n ? '' : ' disabled') + '>Devolver con el motivo de la IA</button>' +
      '<button type="button" class="btn btn-chico" data-rl="aprobar"' + (n ? '' : ' disabled') + '>Aprobar seleccionados</button>';
  }
  const docDe = (id) => { for(const c of (L.clientes || [])){ const d = (c.docs || []).find((x) => String(x.id) === String(id)); if(d) return { d, c }; } return null; };
  function elegir(id, cli, on){ const x = docDe(id); if(!x) return; if(on) elegidos.set(x.d.id, { doc: x.d, cliente: Number(cli) }); else elegidos.delete(x.d.id); }

  async function mandar(items, que){
    if(ocupado) return; ocupado = true; pintarBar();
    try {
      const r = await rpc('revision_lote', { p_items: items });
      elegidos.clear(); const quedan = Math.max(0, ((L.conteos || {}).docs || 0) - r.aprobados - r.devueltos);
      const om = (r.omitidos || []).length;
      if(O.aviso) O.aviso((que === 'aprobar' ? plural(r.aprobados, 'aprobado', 'aprobados') : plural(r.devueltos, 'devuelto', 'devueltos')) + '. Se quitaron de tus pendientes · quedan ' + quedan +
        (om ? '. ' + plural(om, 'va', 'van') + ' uno por uno: la IA ' + (om === 1 ? 'lo devolvió' : 'los devolvió') : ''), null, false);
      if(r.listos) setTimeout(() => { if(O.aviso) O.aviso('¡Bien! ' + (r.listos === 1 ? '1 cliente quedó' : r.listos + ' clientes quedaron') + ' con los documentos al día', null, true); }, 2500);
      desde = 0; await cargar();
    } catch (e) { toast(e.message, 'error'); }
    finally { ocupado = false; if(L) pintarBar(); }
  }
  function aprobar(){ const items = Array.from(elegidos.values()).map((x) => ({ doc: x.doc.id, accion: 'aprobar' })); if(items.length) mandar(items, 'aprobar'); }
  // Devolver: el motivo y la nota de la IA, editables uno por uno
  function hoja(id, idT){
    let h = $(id);
    if(!h){ h = document.createElement('section'); h.id = id; h.className = 'hoja'; h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', idT); h.setAttribute('aria-hidden', 'true'); document.body.appendChild(h); prepararHojas(); }
    return h;
  }
  const cab = (idT, t, sub) => '<div class="asa" aria-hidden="true"></div><div class="cab"><div><h2 id="' + idT + '">' + esc(t) + '</h2>' + (sub ? '<p class="sub-hoja">' + esc(sub) + '</p>' : '') + '</div><button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>';
  function abrirDevolver(){
    const l = Array.from(elegidos.values()); if(!l.length) return;
    const h = hoja('hojaRlDev', 'tRlDev');
    h.innerHTML = cab('tRlDev', 'Devolver documentos', plural(l.length, 'documento', 'documentos') + '. Revisa el motivo antes de enviarlo') + '<form id="formRlDev" novalidate class="hoja-cuerpo">' +
      l.map((x, i) => { const c = (L.clientes || []).find((k) => k.id === x.cliente) || {};
        return '<div class="rl-dev"><b>' + esc(x.doc.cas) + ' · ' + esc(c.nombre || '') + '</b><label class="rotulo arriba" for="rlM' + i + '">Motivo</label><select class="campo" id="rlM' + i + '" data-dev-m="' + esc(x.doc.id) + '">' +
          Object.keys(C.MOTIVOS).map((m) => '<option value="' + m + '"' + ((x.doc.motivo || 'otro') === m ? ' selected' : '') + '>' + esc(C.MOTIVOS[m]) + '</option>').join('') + '</select>' +
          '<label class="rotulo arriba" for="rlN' + i + '">Nota para el líder</label><textarea class="area corta" id="rlN' + i + '" maxlength="500" data-dev-n="' + esc(x.doc.id) + '">' + esc(x.doc.nota || x.doc.texto || '') + '</textarea><div class="error" id="eRlN' + i + '" role="alert"></div></div>'; }).join('') +
      '<div class="acciones"><button type="submit" class="btn btn-peligro btn-ancho">Devolver ' + l.length + '</button></div></form>';
    abrirHoja('hojaRlDev');
  }
  function enviarDevolver(){
    const items = []; let malo = false;
    Array.prototype.forEach.call(document.querySelectorAll('#formRlDev [data-dev-m]'), (s, i) => {
      const n = document.querySelector('#formRlDev [data-dev-n="' + s.dataset.devM + '"]'); const nota = n.value.trim(); $('eRlN' + i).textContent = '';
      if(s.value === 'otro' && !nota){ $('eRlN' + i).textContent = 'Con "Otro motivo" escribe la nota'; malo = true; }
      items.push({ doc: Number(s.dataset.devM), accion: 'devolver', motivo: s.value, nota });
    });
    if(malo) return; cerrarHoja(); mandar(items, 'devolver');
  }
  // Leer con IA: cuánto cuesta lo nuevo, y se lanza (hasta 25 clientes a la vez)
  async function abrirIA(){
    const ids = Array.from(new Set(Array.from(elegidos.values()).map((x) => x.cliente)));
    if(ids.length > 25){ toast('Elige hasta 25 clientes para leer con IA', 'error'); return; }
    const h = hoja('hojaRlIA', 'tRlIA');
    h.innerHTML = cab('tRlIA', 'Leer con IA', plural(ids.length, 'cliente', 'clientes')) + '<div class="hoja-cuerpo" id="cRlIA"><span class="sk" style="height:120px;border-radius:16px;display:block"></span></div>';
    abrirHoja('hojaRlIA');
    let d; try { d = await rpc('ia_estimar', { p_clientes: ids }); }
    catch (e) { $('cRlIA').innerHTML = '<div class="aviso" role="alert"><b>No se pudo calcular</b><p>' + esc(e.message) + '</p></div>'; return; }
    const cs = d.clientes || []; const nuevos = cs.reduce((s, c) => s + (c.nuevos || 0), 0);
    $('cRlIA').innerHTML = '<div class="estado azul"><b>' + esc(plural(nuevos, 'archivo nuevo por leer', 'archivos nuevos por leer')) + '</b><small>' +
      esc(nuevos ? 'Unos US$ ' + (nuevos * 0.04).toFixed(2) + ' en total. Lo ya leído se vuelve a revisar sin costo.' : 'Todo ya se leyó: revisar de nuevo no cuesta.') + '</small></div>' +
      '<p class="nota">Nada cambia el estatus hasta que apruebes o devuelvas. El resultado sale aquí con su filtro.</p><div class="error" id="eRlIA" role="alert"></div>' +
      '<div class="acciones"><button type="button" class="btn btn-ancho" data-rl="ia-ok" data-ids="' + esc(ids.join(',')) + '">Leer con IA</button></div>';
  }
  async function lanzarIA(b){
    b.disabled = true; $('eRlIA').textContent = '';
    try {
      const r = await rpc('ia_lanzar', { p_clientes: b.dataset.ids.split(',').map(Number) }); const n = (r.lanzadas || []).length;
      cerrarHoja(); elegidos.clear(); pintarBar();
      if(O.aviso) O.aviso(n ? 'La IA empezó a leer ' + plural(n, 'cliente', 'clientes') + '. Vuelve en unos minutos' : 'No se lanzó ninguno: ya se estaban leyendo', null, !!n);
      cargar();
    } catch (e) { $('eRlIA').textContent = e.message; b.disabled = false; }
  }
  async function abrirDrive(cli, b){
    b.disabled = true;
    try { const k = await rpc('drive_carpeta_info', { p_cliente: Number(cli) }); const url = k && k.url && /^https:\/\/drive\.google\.com\//.test(k.url) ? k.url : '';
      if(url) window.open(url, '_blank', 'noopener'); else toast('Este cliente todavía no tiene carpeta en Drive'); }
    catch (e) { toast(e.message, 'error'); }
    finally { b.disabled = false; }
  }

  document.addEventListener('click', (ev) => {
    if(!Z || (!ev.target.closest('#vistaLote') && !ev.target.closest('#hojaRlDev') && !ev.target.closest('#hojaRlIA'))) return;
    const t = ev.target; let b;
    if((b = t.closest('[data-rl-ia]'))){ filtro = filtro === b.dataset.rlIa ? 'todos' : b.dataset.rlIa; desde = 0; elegidos.clear(); cargar(); return; }
    if(t.closest('[data-rl-corte]')){ corte = !corte; desde = 0; elegidos.clear(); cargar(); return; }
    if((b = t.closest('[data-rl-cli]'))){ const c = (L.clientes || []).find((x) => String(x.id) === b.dataset.rlCli); const on = b.getAttribute('aria-pressed') !== 'true'; (c.docs || []).forEach((d) => elegir(d.id, c.id, on)); pintar(); return; }
    if((b = t.closest('[data-rl-doc]'))){ elegir(b.dataset.rlDoc, b.dataset.c, b.getAttribute('aria-pressed') !== 'true'); pintar(); return; }
    if((b = t.closest('[data-rl-uno]'))){ window.Ficha.abrir(Number(b.dataset.rlUno), { yo: O.yo, tab: 'documentos', revisar: puede(), alCerrar: () => cargar() }); return; }
    if((b = t.closest('[data-rl-drive]'))){ abrirDrive(b.dataset.rlDrive, b); return; }
    if((b = t.closest('[data-rl]'))){
      const a = b.dataset.rl;
      if(a === 'volver'){ Z = null; if(O.alSalir) O.alSalir(); }
      else if(a === 'reintentar') cargar(); else if(a === 'mas'){ desde = (L.clientes || []).length; cargar(true); }
      else if(a === 'aprobar') aprobar(); else if(a === 'devolver') abrirDevolver(); else if(a === 'ia') abrirIA(); else if(a === 'ia-ok') lanzarIA(b);
    }
  });
  document.addEventListener('submit', (e) => { if(e.target.id === 'formRlDev'){ e.preventDefault(); enviarDevolver(); } });

  window.RevisionLote = { abrir };
})();
