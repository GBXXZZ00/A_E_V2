// Lote 28/10 (maqueta clientes-28oct, pantallas 1 a 3): arriba de la lista de Clientes, lo nuevo.
// Barra de estatus legal en 5 grupos que cambia con la tarjeta (tocar un grupo filtra la lista), atajos de dedicados,
// Gestiones activas (Ver sus clientes, Cambiar fecha, Dar por terminada) y la prioridad "sin gestionar, instalados en 6 meses y habilitados".
// Líder: lo suyo en la lista; los clientes de otros líderes en un desplegable de solo consulta y, al buscar, con "Es de ...".
(function(){
  'use strict';
  const C = window.Comun;
  const { $, esc, ic, rpc, toast, plural, abrirHoja, cerrarHoja, hojaAbierta, prepararHojas, cache } = C;
  const GRUPOS = [['sin_gestionar', 'Sin gestionar', 'gris'], ['faltan', 'Faltan documentos', 'w'], ['revision', 'En revisión', 'azul2'], ['por_firmar', 'Por firmar', 'azul'], ['firmado', 'Firmado', 'ok']];
  const EST = { sin_gestionar: ['grandes_negocios'], faltan: ['documentos_solicitados', 'documentos_pendientes'], revision: ['documentos_recibidos', 'documentos_en_revision'], por_firmar: ['por_firmar', 'contrato_en_curso'], firmado: ['contrato_firmado'] };
  const NOMBRE = { pyme: 'PYME', corporativo: 'Dedicado corporativo', isp: 'Dedicado ISP' };
  const num = (n) => Number(n || 0).toLocaleString('es-VE');
  let O = null; let P = null; let pedido = 0; let OT = null; let otrosAbierto = false;

  const seg = () => { const t = O.tarjeta(); return NOMBRE[t] ? t : 'pyme'; };
  function sub(t){
    const s = P && P.segmentos && P.segmentos[t]; if(!s) return null;
    const firm = num(s.grupos[4]) + ' firmados';
    if(t === 'pyme') return firm + ' · ' + num(s.grupos[0]) + ' sin gestionar';
    if(t === 'corporativo') return firm + (s.sin_fecha ? ' · ' + plural(s.sin_fecha, 'contrato sin fecha', 'contratos sin fecha') : '');
    return firm + (s.polizas ? ' · ' + num(s.polizas) + ' con pólizas pendientes' : '');
  }
  function plazoChip(g){
    if(!g.plazo) return '<span class="chip ambar">Sin fecha</span>';
    const d = Math.round((new Date(g.plazo + 'T12:00:00') - new Date(new Date().toISOString().slice(0, 10) + 'T12:00:00')) / 86400000);
    return d < 0 ? '<span class="chip rojo">Venció hace ' + plural(-d, 'día', 'días') + '</span>' : d === 0 ? '<span class="chip ambar">Vence hoy</span>' : '<span class="chip gris">Vence el ' + esc(g.plazo.slice(8, 10) + '/' + g.plazo.slice(5, 7)) + '</span>';
  }
  function pintar(){
    const z = $('panelCli'); if(!z || !O) return;
    if(!P){ z.innerHTML = '<span class="sk" style="display:block;height:150px;border-radius:20px;margin-top:14px"></span>'; return; }
    if(P.error){ z.innerHTML = '<div class="aviso" role="alert"><b>No se pudo cargar el estatus legal</b><p>' + esc(P.error) + '</p><button type="button" class="btn btn-chico" data-cp-reintentar>Reintentar</button></div>'; return; }
    const t = seg(); const s = (P.segmentos || {})[t] || { total: 0, grupos: [0, 0, 0, 0, 0] }; const tot = Math.max(1, s.grupos.reduce((a, x) => a + x, 0));
    let h = '<section class="cp-legal" aria-labelledby="cpLegalT"><div class="cp-h"><h2 id="cpLegalT">Estatus legal · ' + esc(NOMBRE[t]) + '</h2><small>Cambia con la tarjeta de arriba. Toca un grupo para filtrar la lista.</small></div>' +
      '<div class="cp-barra" aria-hidden="true">' + s.grupos.map((n, i) => n ? '<i class="c-' + GRUPOS[i][2] + '" style="flex:' + n + ' 1 0"></i>' : '').join('') + '</div>' +
      '<div class="cp-gs">' + GRUPOS.map((g, i) => '<button type="button" class="cp-g" data-cp-grupo="' + g[0] + '"><small><i class="c-' + g[2] + '"></i>' + g[1] + '</small><b>' + num(s.grupos[i]) + '</b></button>').join('') + '</div></section>';
    // Atajos de dedicados
    if(t !== 'pyme'){
      const at = [];
      if(t === 'isp' && s.polizas) at.push(['vgt', 'Pólizas VGT pendientes', s.polizas, 'w']);
      if(s.sin_fecha) at.push(['fecha', 'Contratos sin fecha', s.sin_fecha]);
      if(t === 'isp' && s.suspendidos) at.push(['sus', 'Suspendidos', s.suspendidos]);
      if(at.length) h += '<div class="filtros cp-at">' + at.map((x) => '<button type="button" data-cp-atajo="' + x[0] + '" class="' + (x[3] ? 'w' : '') + '">' + esc(x[1]) + ' <em>' + num(x[2]) + '</em></button>').join('') + '</div>';
    }
    const gs = P.gestiones || [];
    if(gs.length) h += '<div class="cp-h cp-gh"><h2>Gestiones activas</h2><span class="cnt">' + gs.length + '</span></div><div class="cp-gest">' + gs.map((g) => {
      const tot2 = Math.max(1, g.total || 0); const es = g.estados || {};
      return '<article class="cp-ge"><div class="l1"><b>' + esc(g.nombre) + '</b>' + plazoChip(g) + '</div>' +
        '<small>' + esc((g.plazo ? 'Meta: ' + g.plazo.slice(8, 10) + '/' + g.plazo.slice(5, 7) : 'Sin fecha') + ' · Responsables: ' + ((g.responsables || []).map((r) => r.nombre).join(', ') || 'sin responsables')) + '</small>' +
        '<span class="cp-pr" aria-hidden="true"><i style="transform:scaleX(' + ((g.hechos || 0) / tot2).toFixed(3) + ')"></i></span>' +
        '<small><b>' + num(g.hechos) + ' de ' + num(g.total) + ' cumplidos</b> · ' + num(es.contactado) + ' contactados · ' + num(es.sin_contacto) + ' sin contacto</small>' +
        '<div class="acc"><button type="button" class="btn btn-chico" data-cp-ver="' + esc(g.id) + '">Ver sus clientes</button>' +
        (P.puedo_gestion ? '<button type="button" class="btn btn-chico btn-2" data-cp-fecha="' + esc(g.id) + '">' + (g.plazo ? 'Cambiar fecha' : 'Poner fecha') + '</button><button type="button" class="btn btn-chico btn-2" data-cp-fin="' + esc(g.id) + '">Dar por terminada</button>' : '') + '</div></article>';
    }).join('') + '</div>';
    if(t === 'pyme' && P.prioridad && P.prioridad.n) h += '<div class="cp-pri"><span><b>Empieza por aquí: ' + num(P.prioridad.n) + ' sin gestionar, instalados en los últimos 6 meses y habilitados</b>' +
      '<small>Son los que más pesan. Puedes crear una gestión con ellos o pedirle a cada líder lo suyo.</small></span>' +
      (P.puedo_crear_gestion ? '<button type="button" class="btn btn-chico" data-cp-crear>Crear gestión</button>' : '<button type="button" class="btn btn-chico btn-2" data-cp-grupo="sin_gestionar">Ver cuáles son</button>') + '</div>';
    z.innerHTML = h;
  }
  async function cargar(){
    const mio = ++pedido; const k = 'clipanel:' + (O.yo && O.yo.id);
    if(!P){ const g = cache.leer(k); if(g) P = g; pintar(); O.alCambiar(); }
    try { const r = await rpc('clientes_panel', {}); if(mio !== pedido) return; P = r; cache.guardar(k, r); }
    catch (e) { if(mio !== pedido) return; if(!P) P = { error: e.message }; else toast('No se pudo actualizar el estatus legal. ' + e.message, 'error'); }
    pintar(); O.alCambiar();
  }
  // ---------- Clientes de otros líderes (solo el líder): desplegable de solo consulta ----------
  function tarjetaOtro(c){
    const g = GRUPOS.find((x) => x[0] === c.grupo) || GRUPOS[0]; const tono = { gris: 'gris', w: 'ambar', azul2: 'azul', azul: 'azul', ok: 'verde' }[g[2]];
    return '<div class="cp-otro"><b>' + esc(c.nombre) + '</b><small>' + esc(c.doc + ' · ' + plural(c.n_serv, 'servicio', 'servicios')) + '</small>' +
      '<span class="chips"><span class="chip ' + tono + '">' + esc(g[1]) + '</span><span class="chip morado">Es de ' + esc(c.lider) + '</span><span class="chip gris">Solo consulta</span></span></div>';
  }
  function pintarOtros(){
    const z = $('otrosLid'); if(!z || !O) return;
    if(!O.yo || O.yo.rol !== 'lider'){ z.innerHTML = ''; return; }
    const q = O.busca();
    if(q){ // al buscar, el ajeno sale con "Es de ..."
      z.innerHTML = !OT || OT.q !== q ? '' : OT.filas.length ? '<section class="cp-otros abierto"><div class="cp-h"><h2>De otros líderes · "' + esc(q) + '"</h2><small>' + plural(OT.total, 'resultado', 'resultados') + ' · solo para consultar</small></div><div class="cp-ogrid">' + OT.filas.map(tarjetaOtro).join('') + '</div></section>' : '';
      return;
    }
    const n = OT && !OT.q ? OT.total : null;
    z.innerHTML = '<section class="cp-otros' + (otrosAbierto ? ' abierto' : '') + '"><button type="button" class="cp-oc" data-cp-otros aria-expanded="' + otrosAbierto + '">' + ic('abajo') + '<b>Clientes de otros líderes</b><small>' + (n === null ? 'solo para consultar, se abre al tocar' : num(n) + ' · solo para consultar') + '</small></button>' +
      (otrosAbierto ? (!OT ? C.esqueleto(3) : OT.error ? '<p class="nota-chica" role="alert">' + esc(OT.error) + '</p>' : '<div class="cp-ogrid">' + OT.filas.map(tarjetaOtro).join('') + '</div>' +
        (OT.filas.length < OT.total ? '<button type="button" class="btn btn-2 btn-chico" data-cp-mas>Ver ' + Math.min(30, OT.total - OT.filas.length) + ' más</button>' : '')) : '') + '</section>';
  }
  async function cargarOtros(q, mas){
    const desde = mas && OT ? OT.filas.length : 0;
    try { const r = await rpc('clientes_otros', { p_busca: q || null, p_desde: desde, p_limite: 30 });
      OT = { q: q || '', total: r.total, filas: (mas && OT ? OT.filas : []).concat(r.filas || []) }; }
    catch (e) { OT = { q: q || '', total: 0, filas: [], error: e.message }; }
    pintarOtros();
  }
  // ---------- Cambiar fecha de una gestión ----------
  function hojaFecha(id){
    const g = (P.gestiones || []).find((x) => String(x.id) === String(id)); if(!g) return;
    let h = $('hojaGesFecha');
    if(!h){ h = document.createElement('section'); h.id = 'hojaGesFecha'; h.className = 'hoja'; h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', 'tGesF'); h.setAttribute('aria-hidden', 'true'); document.body.appendChild(h); prepararHojas(); }
    h.innerHTML = '<div class="asa" aria-hidden="true"></div><div class="cab"><div><h2 id="tGesF">' + (g.plazo ? 'Cambiar fecha' : 'Poner fecha') + '</h2><p class="sub-hoja">' + esc(g.nombre) + '</p></div><button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      '<form id="formGesF" novalidate data-id="' + esc(g.id) + '"><label class="rotulo" for="gesFecha">Nueva fecha</label><input class="campo" id="gesFecha" type="date" value="' + esc(g.plazo || '') + '" data-foco><div class="error" id="eGesF" role="alert"></div>' +
      '<p class="nota-chica">Queda en la bitácora. Los responsables ven la fecha nueva en Mi trabajo.</p><div class="acciones"><button type="submit" class="btn btn-ancho" id="gesFGuardar">Guardar</button></div></form>';
    abrirHoja('hojaGesFecha');
  }
  document.addEventListener('submit', (e) => {
    if(e.target.id !== 'formGesF') return; e.preventDefault();
    const v = $('gesFecha').value; const er = $('eGesF'); er.textContent = '';
    if(!/^\d{4}-\d{2}-\d{2}$/.test(v)){ er.textContent = 'Elige la fecha'; return; }
    const b = $('gesFGuardar'); b.disabled = true; b.textContent = 'Guardando…';
    rpc('gestion_plazo', { p_id: Number(e.target.dataset.id), p_plazo: v }).then(() => { toast('Fecha guardada'); if(hojaAbierta() === 'hojaGesFecha') cerrarHoja(); cache.borrarTodo(); cargar(); })
      .catch((err) => { er.textContent = err.message; b.disabled = false; b.textContent = 'Guardar'; });
  });
  document.addEventListener('click', (e) => {
    const t = e.target; let b; if(!O) return;
    if(!t.closest('#panelCli') && !t.closest('#otrosLid')) return;
    if(t.closest('[data-cp-reintentar]')){ P = null; cargar(); return; }
    if((b = t.closest('[data-cp-grupo]'))){ O.aplicar({ sel: { estatus: EST[b.dataset.cpGrupo] } }); return; }
    if((b = t.closest('[data-cp-atajo]'))){ const a = b.dataset.cpAtajo; O.aplicar(a === 'vgt' ? { sel: { vgt: ['incompletos'] } } : a === 'sus' ? { sel: { otros: ['suspendidos'] } } : { filtro: 'revisar_fecha' }); return; }
    if((b = t.closest('[data-cp-ver]'))){ O.aplicar({ sel: { gestion: [b.dataset.cpVer] }, tarjeta: 'todas' }); return; }
    if((b = t.closest('[data-cp-fecha]'))){ hojaFecha(b.dataset.cpFecha); return; }
    if((b = t.closest('[data-cp-fin]')) && window.Gestiones){ window.Gestiones.abrir(Number(b.dataset.cpFin), { alCerrar: () => { cache.borrarTodo(); cargar(); } }); return; }
    if(t.closest('[data-cp-crear]') && window.Gestiones){ window.Gestiones.puedeCrear = true;
      window.Gestiones.nueva({ nombre: 'Recientes sin documentos', meta: 'expediente_completo', clientes: (P.prioridad.clientes || []), alCrear: () => { cache.borrarTodo(); cargar(); } }); return; }
    if(t.closest('[data-cp-otros]')){ otrosAbierto = !otrosAbierto; pintarOtros(); if(otrosAbierto && (!OT || OT.q)) cargarOtros(''); return; }
    if(t.closest('[data-cp-mas]')){ cargarOtros('', true); }
  });
  window.ClientesPanel = {
    // o: { yo, tarjeta(), busca(), aplicar({ sel, filtro, tarjeta }), alCambiar() }
    montar(o){ O = o; cargar(); pintarOtros(); if(o.yo && o.yo.rol === 'lider') cargarOtros(''); },
    pintar(){ pintar(); pintarOtros(); },
    buscar(q){ if(!O || !O.yo || O.yo.rol !== 'lider') return; if(q) cargarOtros(q); else { OT = OT && OT.q ? null : OT; pintarOtros(); if(!OT) cargarOtros(''); } },
    sub, recargar: cargar
  };
})();
