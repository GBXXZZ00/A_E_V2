// Gestiones (lote 22/10): un grupo de clientes con meta, plazo y responsables. La meta se mide sola contra el expediente;
// cada cliente lleva su estado (Contactado, Sin contacto, Esperando, Cumplido o Resuelto) con nota, fecha prometida e historial.
// Las crean el administrador, el Analista Senior y el coordinador. Al vencer o cumplirse se archivan con su resultado.
(function(){
  'use strict';
  const C = window.Comun;
  const { $, esc, ic, rpc, toast, abrirHoja, cerrarHoja, prepararHojas, fecha, plural, normalizeStr } = C;
  const META = { expediente_completo: 'Expediente completo', actas_subidas: 'Actas subidas', contrato_firmado: 'Contrato firmado', conatel: 'Habilitación Conatel', vgt: 'Documentos de VGT' };
  const ESTADOS = [['contactado', 'Contactado'], ['sin_contacto', 'Sin contacto'], ['esperando', 'Esperando'], ['cumplido', 'Cumplido'], ['resuelto', 'Resuelto']];
  const TONO = { contactado: 'azul', sin_contacto: 'rojo', esperando: 'ambar', cumplido: 'verde', resuelto: 'gris' };
  const ACCION = { creada: 'Creó la gestión', agregado: 'Agregó el cliente', estado: 'Cambió el estado', etiqueta_anterior: 'Etiqueta de Clientes', archivada: 'Se archivó', cumplida_a_mano: 'La marcó cumplida' };
  let G = null; let N = null; let ops = {};
  const nomEstado = (e) => (ESTADOS.find((x) => x[0] === e) || [e, e])[1];

  function hoja(id, idT){
    let h = $(id);
    if(!h){ h = document.createElement('section'); h.id = id; h.className = 'hoja'; h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', idT); h.setAttribute('aria-hidden', 'true'); document.body.appendChild(h); prepararHojas(); }
    return h;
  }
  const cab = (idT, t, sub) => '<div class="cab"><div><h2 id="' + idT + '">' + esc(t) + '</h2>' + (sub ? '<p class="sub-hoja" id="' + idT + 's">' + esc(sub) + '</p>' : '') + '</div><button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>';
  const fila = (etq, valor) => '<div class="dato-f"><span>' + esc(etq) + '</span><b>' + valor + '</b></div>';

  // ---------- Detalle de una gestión ----------
  async function abrir(id, o){
    ops = o || {}; G = { id, d: null, cliente: ops.cliente || null };
    hoja('hojaGes', 'tGes').innerHTML = cab('tGes', 'Gestión', '') + '<div class="hoja-cuerpo" id="cGes"><div class="sk-bloque"><span class="sk" style="height:64px;border-radius:16px"></span><span class="sk" style="height:64px;border-radius:16px"></span></div></div><div class="hoja-pie hidden" id="pGes"></div>';
    abrirHoja('hojaGes'); await cargar();
  }
  async function cargar(){
    if(!G) return; const mio = G;
    try { const d = await rpc('gestion_detalle', { p_id: G.id }); if(G !== mio) return; G.d = d; pintar(); }
    catch (e) { if(G !== mio) return; $('cGes').innerHTML = '<div class="vacio" role="alert"><b>No se pudo abrir la gestión</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" data-gs="re">Reintentar</button></div>'; }
  }
  function pintar(){
    const d = G.d; const pct = d.total ? Math.round(d.hechos * 100 / d.total) : 0; const hoy = C.hoyClave();
    const dd = C.diasEntre(hoy, d.plazo); const activa = d.estado === 'activa';
    $('tGes').textContent = d.nombre;
    let h = '<div class="estado ' + (activa ? (dd <= 2 ? 'ambar' : 'azul') : d.estado === 'cumplida' ? 'verde' : 'gris') + '"><b>' + esc(d.hechos + ' de ' + d.total) +
      (activa ? (dd < 0 ? ', venció' : dd === 0 ? ', vence hoy' : ', faltan ' + plural(dd, 'día', 'días')) : d.estado === 'cumplida' ? ', cumplida' : ', vencida') + '</b><small>' + esc(META[d.meta] || d.meta) + ' · plazo ' + fecha(d.plazo) + '</small></div>' +
      '<span class="mt-barra grande" aria-hidden="true"><i style="transform:scaleX(' + (pct / 100).toFixed(3) + ')"></i></span>' +
      '<div class="datos">' + fila('Responsables', esc((d.responsables || []).map((r) => r.nombre).join(', ') || 'Sin responsables')) + fila('La creó', esc(d.creado_por || '')) +
      (d.cumplida_mano ? fila('Cumplida a mano', esc(d.nota_cumplida || '')) : '') + '</div>';
    const cls = (d.clientes || []).slice().sort((a, b) => (a.cliente_id === G.cliente ? -1 : b.cliente_id === G.cliente ? 1 : 0));
    h += '<div class="secc">Clientes<span class="der">' + cls.length + '</span></div>' + cls.map((c) => {
      const e = c.cumple ? 'cumplido' : c.estado; const ab = G.abierto === c.cliente_id || (G.cliente === c.cliente_id && G.abierto === undefined);
      return '<div class="ges-cli' + (ab ? ' abierto' : '') + '"><button type="button" class="fila" data-gs-cli="' + esc(c.cliente_id) + '" aria-expanded="' + ab + '"><span class="tx"><b>' + esc(c.nombre) + '</b><small>' +
        esc([c.lider ? 'Líder ' + c.lider : '', c.promesa ? 'Prometió el ' + fecha(c.promesa) : '', c.nota || ''].filter(Boolean).join(' · ')) + '</small></span><span class="chip ' + TONO[e] + '">' + esc(c.cumple ? 'Cumplido (solo)' : nomEstado(e)) + '</span></button>' +
        (ab ? formCliente(c, activa) : '') + '</div>';
    }).join('');
    $('cGes').innerHTML = h;
    const p = $('pGes'); const puede = activa && ops.puedeCrear !== false && window.Gestiones.puedeCrear;
    p.classList.toggle('hidden', !puede);
    p.innerHTML = puede ? '<button type="button" class="btn btn-2" data-gs="cumplir">Marcar cumplida</button>' : '';
  }
  function formCliente(c, activa){
    let h = '<div class="ges-form">';
    if(activa){
      h += '<p class="rotulo" id="rGesEst' + c.cliente_id + '">Estado</p><div class="cam-sol ges-est" role="radiogroup" aria-labelledby="rGesEst' + c.cliente_id + '">' + ESTADOS.map((x) =>
        '<button type="button" role="radio" data-gs-est="' + x[0] + '" aria-checked="' + (c.estado === x[0]) + '" class="' + (c.estado === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div>' +
        '<label class="rotulo arriba" for="gesNota">Nota</label><textarea class="area corta" id="gesNota" maxlength="500">' + esc(c.nota || '') + '</textarea>' +
        '<label class="rotulo arriba" for="gesProm">Fecha en que prometió entregar (opcional)</label><input class="campo" id="gesProm" type="date" value="' + esc(c.promesa || '') + '">' +
        '<div class="error" id="eGes" role="alert"></div><p style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="btn btn-chico" data-gs="guardar" data-cli="' + esc(c.cliente_id) + '">Guardar</button>' +
        '<button type="button" class="btn btn-chico btn-2" data-gs="ficha" data-cli="' + esc(c.cliente_id) + '">Abrir cliente</button></p>';
    }
    h += (c.historial || []).length ? '<div class="secc">Historial</div><div class="datos">' + c.historial.map((x) => fila(fecha(x.en) + ' ' + C.hora(x.en),
      esc((ACCION[x.accion] || x.accion) + (x.estado ? ': ' + nomEstado(x.estado) : '') + (x.nota ? '. ' + x.nota : '') + (x.promesa ? '. Prometió el ' + fecha(x.promesa) : '')) + (x.por ? ' · ' + esc(C.primerNombre(x.por)) : ''))).join('') + '</div>' : '';
    return h + '</div>';
  }
  async function guardar(b){
    const cli = Number(b.dataset.cli); const est = (document.querySelector('.ges-est [aria-checked="true"]') || {}).dataset; const er = $('eGes'); er.textContent = '';
    const nota = $('gesNota').value.trim(); const prom = $('gesProm').value || null;
    if(!est || !est.gsEst){ er.textContent = 'Elige el estado'; return; }
    if(est.gsEst === 'resuelto' && nota.length < 3){ er.textContent = 'Escribe cómo se resolvió'; $('gesNota').focus(); return; }
    b.disabled = true;
    try { await rpc('gestion_cliente_estado', { p_id: G.id, p_cliente: cli, p_estado: est.gsEst, p_nota: nota || null, p_promesa: prom }); toast('Guardado en el historial'); G.abierto = null; await cargar(); }
    catch (e) { er.textContent = e.message; b.disabled = false; }
  }
  function pedirCumplir(){
    const p = $('pGes');
    p.innerHTML = '<div style="flex:1;min-width:0"><label class="rotulo" for="gesNotaC">Nota de por qué está cumplida</label><textarea class="area corta" id="gesNotaC" maxlength="500"></textarea><div class="error" id="eGesC" role="alert"></div>' +
      '<p style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="btn btn-chico btn-2" data-gs="noCumplir">Cancelar</button><button type="button" class="btn btn-chico" data-gs="siCumplir">Marcar cumplida</button></p></div>';
    $('gesNotaC').focus();
  }
  async function cumplir(b){
    const n = $('gesNotaC').value.trim(); if(n.length < 4){ $('eGesC').textContent = 'Escribe la nota'; return; }
    b.disabled = true;
    try { await rpc('gestion_cumplir', { p_id: G.id, p_nota: n }); toast('Gestión cumplida y archivada'); await cargar(); if(ops.alCerrar) ops.alCerrar(); }
    catch (e) { $('eGesC').textContent = e.message; b.disabled = false; }
  }

  // ---------- Nueva gestión ----------
  async function nueva(o){
    ops = o || {}; N = { nombre: '', meta: '', plazo: '', resp: {}, clientes: [], res: null, err: {}, personas: null };
    hoja('hojaGesN', 'tGesN').innerHTML = cab('tGesN', 'Nueva gestión', 'Un grupo de clientes con meta, plazo y responsables') + '<div class="hoja-cuerpo" id="cGesN"></div>' +
      '<div class="hoja-pie"><button type="button" class="btn btn-2" data-cierra="1">Cancelar</button><button type="button" class="btn" data-gs="crear">Crear gestión</button></div>';
    pintarNueva(); abrirHoja('hojaGesN');
    try { const r = await rpc('mi_trabajo_personas', {}); N.personas = r; } catch (e) { N.err.resp = 'No se pudo traer la lista de personas. ' + e.message; }
    pintarNueva();
  }
  function leer(){ if(!N) return; const v = (id) => { const x = $(id); return x ? x.value : undefined; }; if(v('gesNom') !== undefined) N.nombre = v('gesNom'); if(v('gesMeta') !== undefined) N.meta = v('gesMeta'); if(v('gesPlazo') !== undefined) N.plazo = v('gesPlazo'); if(v('gesBusca') !== undefined) N.q = v('gesBusca'); }
  function pintarNueva(){
    const z = $('cGesN'); if(!z || !N) return; const e = (k) => '<div class="error" id="eGesN_' + k + '" role="alert">' + esc(N.err[k] || '') + '</div>';
    let h = '<label class="rotulo" for="gesNom">Nombre</label><input class="campo" id="gesNom" maxlength="120" autocomplete="off" value="' + esc(N.nombre) + '">' + e('nombre') +
      '<label class="rotulo arriba" for="gesMeta">Meta</label><select class="campo" id="gesMeta"><option value="">Elige la meta</option>' + Object.keys(META).map((k) => '<option value="' + k + '"' + (N.meta === k ? ' selected' : '') + '>' + esc(META[k]) + '</option>').join('') + '</select>' +
      '<p class="nota-chica">Se mide sola contra el expediente de cada cliente.</p>' + e('meta') +
      '<label class="rotulo arriba" for="gesPlazo">Plazo</label><input class="campo" id="gesPlazo" type="date" value="' + esc(N.plazo) + '">' + e('plazo') +
      '<p class="rotulo arriba">Responsables</p>';
    if(!N.personas && !N.err.resp) h += '<div class="sk" style="height:44px;border-radius:14px" aria-hidden="true"></div>';
    else h += '<div class="ges-resp">' + (N.personas || []).map((p) => '<label class="cam-srv"><input type="checkbox" data-gs-resp="' + esc(p.id) + '"' + (N.resp[p.id] ? ' checked' : '') + '><span><b>' + esc(p.nombre) + '</b><small>' + esc(p.rol_txt || '') + '</small></span></label>').join('') + '</div>';
    h += e('resp') + '<p class="rotulo arriba">Clientes<span class="der"> ' + N.clientes.length + '</span></p>' +
      (N.clientes.length ? '<ul class="cam-arch">' + N.clientes.map((c, i) => '<li><span>' + esc(c.nombre) + '</span><button type="button" class="enlace" data-gs-quitar="' + i + '">Quitar</button></li>').join('') + '</ul>' : '') +
      '<label class="rotulo arriba" for="gesBusca">Buscar cliente por nombre o RIF</label><div class="busca-linea"><input class="campo" id="gesBusca" maxlength="60" autocomplete="off" enterkeyhint="search" value="' + esc(N.q || '') + '"><button type="button" class="btn btn-2 btn-chico" data-gs="buscar">Buscar</button></div>' + e('clientes');
    if(N.buscando) h += '<p class="nota-chica"><span class="cargando-linea"><i></i>Buscando…</span></p>';
    else if(N.res) h += N.res.length ? '<div class="grupo abierto">' + N.res.map((c) => '<button type="button" class="fila" data-gs-add="' + esc(c.id) + '" data-nombre="' + esc(c.nombre) + '"><span class="tx"><b>' + esc(c.nombre) + '</b><small>' + esc(C.docFmt(c.doc_tipo || '', c.doc_numero || '') + (c.lider ? ' · ' + c.lider : '')) + '</small></span>' +
      (N.clientes.some((x) => x.id === c.id) ? '<span class="chip verde">Agregado</span>' : '<span class="chip azul">Agregar</span>') + '</button>').join('') + '</div>' : '<p class="nota-chica">No aparece. Revisa el nombre o el RIF.</p>';
    z.innerHTML = h + e('general');
  }
  async function buscarCli(){
    leer(); N.err = {}; const t = String(N.q || '').trim();
    if(normalizeStr(t).length < 3 && t.replace(/\D/g, '').length < 4){ N.err.clientes = 'Escribe al menos 3 letras o el RIF'; pintarNueva(); return; }
    N.buscando = true; pintarNueva();
    try { const r = await rpc('clientes_lista3', { p_filtro: 'todos', p_busca: t, p_limite: 20, p_desde: 0, p_f: {} }); N.res = r.filas || []; }
    catch (e) { N.err.clientes = e.message; }
    N.buscando = false; pintarNueva();
  }
  async function crear(b){
    leer(); N.err = {};
    if(String(N.nombre).trim().length < 3) N.err.nombre = 'Escribe el nombre';
    if(!N.meta) N.err.meta = 'Elige la meta';
    if(!N.plazo) N.err.plazo = 'Elige el plazo';
    const resp = Object.keys(N.resp).filter((k) => N.resp[k]); if(!resp.length) N.err.resp = 'Elige al menos un responsable';
    if(!N.clientes.length) N.err.clientes = 'Agrega al menos un cliente';
    if(Object.keys(N.err).length){ pintarNueva(); const p = document.querySelector('#cGesN .error:not(:empty)'); if(p) p.scrollIntoView({ block: 'center' }); return; }
    b.disabled = true; b.textContent = 'Guardando…';
    try {
      const id = await rpc('gestion_crear', { p_datos: { nombre: N.nombre.trim(), meta: N.meta, plazo: N.plazo, responsables: resp, clientes: N.clientes.map((c) => c.id) } });
      toast('Gestión creada'); N = null; cerrarHoja(true); if(ops.alCrear) ops.alCrear(); abrir(Number(id), { alCerrar: ops.alCrear });
    } catch (e) { N.err.general = e.message; pintarNueva(); b.disabled = false; b.textContent = 'Crear gestión'; }
  }

  document.addEventListener('click', (ev) => {
    const t = ev.target; let b;
    if((b = t.closest('[data-gs]'))){
      const a = b.dataset.gs;
      if(a === 're') cargar(); else if(a === 'guardar') guardar(b); else if(a === 'cumplir') pedirCumplir(); else if(a === 'noCumplir') pintar(); else if(a === 'siCumplir') cumplir(b);
      else if(a === 'ficha') window.Ficha.abrir(Number(b.dataset.cli), { alCerrar: cargar });
      else if(a === 'buscar') buscarCli(); else if(a === 'crear') crear(b);
      return;
    }
    if((b = t.closest('[data-gs-cli]')) && G){ const k = Number(b.dataset.gsCli); G.abierto = G.abierto === k || (G.abierto === undefined && G.cliente === k) ? null : k; pintar(); return; }
    if((b = t.closest('[data-gs-est]'))){ b.parentNode.querySelectorAll('[data-gs-est]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); }); return; }
    if((b = t.closest('[data-gs-add]')) && N){ leer(); const id = Number(b.dataset.gsAdd); if(!N.clientes.some((c) => c.id === id)) N.clientes.push({ id, nombre: b.dataset.nombre }); N.err.clientes = ''; pintarNueva(); return; }
    if((b = t.closest('[data-gs-quitar]')) && N){ leer(); N.clientes.splice(Number(b.dataset.gsQuitar), 1); pintarNueva(); }
  });
  document.addEventListener('change', (ev) => { const x = ev.target.closest && ev.target.closest('[data-gs-resp]'); if(x && N){ N.resp[x.dataset.gsResp] = x.checked; N.err.resp = ''; } });
  document.addEventListener('keydown', (ev) => { if(ev.key === 'Enter' && ev.target && ev.target.id === 'gesBusca'){ ev.preventDefault(); buscarCli(); } });

  window.Gestiones = { META, ESTADOS, abrir, nueva, puedeCrear: false };
})();
