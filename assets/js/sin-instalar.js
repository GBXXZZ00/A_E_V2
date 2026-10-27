// Lote 27/10: dos atajos de la Lista de Comisiones.
// Sin instalar (A5): órdenes de Odoo PYME abiertas sin instalación, con días (ámbar desde 15, rojo desde 60), qué falta y "Subir documentos":
//   un panel con el RIF (si no existe se crea el cliente y la orden queda unida), las casillas del expediente y "Enviar a revisión".
// Sin líder (C1): instalados del mes cuyo cliente no tiene líder; "Asignar líder" a varios a la vez (bitácora por cada uno).
(function(){
  'use strict';
  const C = window.Comun;
  const { $, esc, ic, rpc, toast, plural, abrirHoja, cerrarHoja, prepararHojas, normalizeStr, vacio, esqueleto, fecha } = C;
  let yo = null; let SI = null; let SL = null; let marcados = new Set(); let O = null; let busca = '';
  const coincide = (txt) => { const b = normalizeStr(busca); return !b || normalizeStr(txt).indexOf(b) >= 0; };
  const tonoDias = (d) => d >= 60 ? 'rojo' : d >= 15 ? 'ambar' : 'gris';

  // ---------- Sin instalar ----------
  async function cargarSinInstalar(cont){
    if(!SI) cont.innerHTML = esqueleto(6);
    try { SI = await rpc('ordenes_sin_instalar_lista', {}); pintarSinInstalar(cont); }
    catch (e) { if(!SI) cont.innerHTML = '<div class="vacio" role="alert"><b>No se pudieron cargar las órdenes</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" data-si-reintentar>Reintentar</button></div>'; else toast(e.message, 'error'); }
  }
  function pintarSinInstalar(cont){
    if(!SI) return;
    const filas = (SI.filas || []).filter((o) => coincide([o.cliente, o.numero, o.lider, o.titulo].join(' ')));
    const viejas = (SI.filas || []).filter((o) => o.dias >= SI.dias_alerta).length;
    let h = '<div class="si-cab"><p class="nota-chica">' + esc(plural((SI.filas || []).length, 'orden abierta', 'órdenes abiertas')) + ' en Odoo sin instalación · ' + esc(plural(viejas, 'pasa', 'pasan')) + ' de ' + SI.dias_alerta + ' días y le llega aviso al líder.' +
      (SI.puede_ajustar ? ' <button type="button" class="enlace" data-si-dias>Cambiar días</button>' : '') + '</p></div>';
    if(!filas.length) h += vacio(busca ? 'Sin resultados' : 'Nada sin instalar', busca ? 'Nadie coincide con "' + busca + '".' : 'Todas las órdenes abiertas ya tienen instalación. Cuando una se atrase, sale aquí.');
    else h += '<div class="grupo abierto si-lista">' + filas.map((o) => '<div class="si-f"><span class="tx"><b>' + esc(o.cliente || 'Sin cliente en la app') + '</b>' +
      '<small>' + esc('Orden ' + (o.numero || o.orden_id) + ' · ' + (o.lider || 'Sin líder') + ' · ' + (o.etapa || '')) + '</small><small class="si-falta">' + esc(o.falta || '') + '</small></span>' +
      '<span class="m ' + tonoDias(o.dias) + '">' + esc(plural(o.dias, 'día', 'días')) + '</span>' +
      (SI.puede_subir ? '<button type="button" class="btn btn-chico btn-2" data-si-subir="' + esc(o.orden_id) + '">Subir documentos</button>' : '') + '</div>').join('') + '</div>';
    cont.innerHTML = h;
  }
  function hojaOrden(){
    let h = $('hojaOrden');
    if(!h){ h = document.createElement('section'); h.id = 'hojaOrden'; h.className = 'hoja completa lado angosta'; h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', 'tOrden'); h.setAttribute('aria-hidden', 'true');
      document.body.appendChild(h); prepararHojas(); h.addEventListener('click', clicOrden); h.addEventListener('submit', (e) => { e.preventDefault(); buscarRif(); }); }
    return h;
  }
  function pintarOrden(){
    const o = O.o; const h = hojaOrden();
    let cuerpo = '<form id="formRif" novalidate><label class="rotulo" for="oRif">RIF del cliente</label><input class="campo" id="oRif" autocomplete="off" inputmode="text" maxlength="20" value="' + esc(O.rif || '') + '"' + (O.F ? ' disabled' : '') + ' data-foco>' +
      '<div class="error" id="eRif" role="alert">' + esc(O.err || '') + '</div>' +
      (O.pideNombre ? '<label class="rotulo" for="oNom">Nombre del cliente</label><input class="campo" id="oNom" maxlength="200" autocomplete="off" value="' + esc(O.nombre || '') + '"><div class="error" id="eNom" role="alert">' + esc(O.errNom || '') + '</div>' +
        '<p class="nota-chica">Ese RIF no está en la app. Se crea el cliente y la orden queda unida a él.</p>' : '') +
      (O.F ? '' : '<button type="submit" class="btn btn-ancho"' + (O.ocupado ? ' disabled' : '') + '>' + (O.ocupado ? 'Buscando…' : O.pideNombre ? 'Crear cliente y unir la orden' : 'Buscar cliente') + '</button>') + '</form>';
    if(O.F) cuerpo += '<div class="si-cli"><b>' + esc(O.F.cliente.nombre) + '</b><small>' + (O.nuevo ? 'Cliente nuevo, unido a la orden' : 'La orden quedó unida a este cliente') + '</small></div>' +
      '<div class="h2">Documentos</div><div id="docsOrden">' + window.Ficha.documentosPara(O.F) + '</div>';
    else if(O.cargandoF) cuerpo += esqueleto(4);
    h.innerHTML = '<div class="hoja-cab"><div class="tx"><small>' + esc('Orden ' + (o.numero || o.orden_id) + ' · ' + plural(o.dias, 'día', 'días') + ' sin instalar') + '</small><b id="tOrden">' + esc(o.cliente || 'Sin cliente en la app') + '</b></div>' +
      '<button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div><div class="hoja-cuerpo">' + cuerpo + '</div>' +
      (O.F ? '<div class="hoja-pie"><button type="button" class="btn" id="oEnviar">Enviar a revisión</button></div>' : '');
  }
  async function abrirOrden(id){
    const o = (SI && SI.filas || []).find((x) => String(x.orden_id) === String(id)); if(!o) return;
    window.Ficha.montar();
    O = { o, rif: '', F: null };
    pintarOrden(); abrirHoja('hojaOrden');
    // Si la orden ya tiene un cliente con RIF, se va directo a sus documentos
    if(o.cliente_id && !o.provisional){ O.cargandoF = true; pintarOrden(); await cargarFicha(o.cliente_id); }
  }
  async function cargarFicha(cli){
    try { O.F = await rpc('cliente_ficha', { p_cliente: cli }); const cl = O.F.cliente || {}; if(cl.doc_numero) O.rif = (cl.doc_tipo || 'J') + '-' + cl.doc_numero; }
    catch (e) { O.err = e.message; }
    O.cargandoF = false; if($('hojaOrden')) pintarOrden();
  }
  async function buscarRif(){
    if(!O || O.ocupado) return;
    O.rif = ($('oRif').value || '').trim(); O.nombre = $('oNom') ? $('oNom').value.trim() : ''; O.err = ''; O.errNom = '';
    if(!/\d{5,}/.test(O.rif.replace(/\D/g, '').replace(/^0+/, ''))){ O.err = 'Escribe el RIF con la letra y los números, por ejemplo J-12345678-9'; pintarOrden(); $('oRif').focus(); return; }
    if(O.pideNombre && !O.nombre){ O.errNom = 'Escribe el nombre del cliente'; pintarOrden(); $('oNom').focus(); return; }
    O.ocupado = true; pintarOrden();
    try {
      const r = await rpc('orden_cliente_rif', { p_orden: O.o.orden_id, p_rif: O.rif, p_nombre: O.pideNombre ? O.nombre : null });
      O.ocupado = false; O.nuevo = !!r.nuevo; O.cargandoF = true; pintarOrden();
      toast(r.nuevo ? 'Cliente creado y unido a la orden' : 'Orden unida a ' + r.nombre);
      await cargarFicha(r.cliente_id); SI = null; refrescar();
    } catch (e) {
      O.ocupado = false;
      if(/no está en la app/i.test(e.message)){ O.pideNombre = true; pintarOrden(); if($('oNom')) $('oNom').focus(); }
      else { O.err = e.message; pintarOrden(); }
    }
  }
  function recargarFicha(){ if(O && O.F) cargarFicha(O.F.cliente.id); }
  function clicOrden(ev){
    const t = ev.target; let b;
    if(!O) return;
    if(O.F && t.closest('#docsOrden')){
      if((b = t.closest('[data-subir]'))){ const p = b.dataset.subir.split(':'); window.Ficha.subirA(O.F, p[0], Number(p[1]), recargarFicha); return; }
      if((b = t.closest('[data-campo]'))){ window.Ficha.editarCampo(O.F, b.dataset.campo, recargarFicha); return; }
    }
    if((b = t.closest('#oEnviar'))){ b.disabled = true;
      rpc('orden_enviar_revision', { p_cliente: O.F.cliente.id }).then((r) => { toast(plural(r.documentos, 'documento quedó', 'documentos quedaron') + ' en la bandeja de Revisión'); cerrarHoja(); })
        .catch((e) => { toast(e.message, 'error'); if(document.contains(b)) b.disabled = false; }); }
  }
  function cambiarDias(){
    hojaLider().innerHTML = '<div class="asa" aria-hidden="true"></div><div class="cab"><h2 id="tLidL">Aviso de órdenes sin instalar</h2><button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      '<label class="rotulo" for="siDias">Avisar al líder desde (días)</label><input class="campo" id="siDias" type="number" inputmode="numeric" min="1" max="180" value="' + esc(SI.dias_alerta) + '" data-foco>' +
      '<div class="error" id="eSiDias" role="alert"></div><p class="nota-chica">Al administrador le llega un resumen de las que pasan de ese número.</p><div class="acc" style="margin-top:14px"><button type="button" class="btn btn-2" data-cierra="1">Cancelar</button><button type="button" class="btn" id="siDiasGuardar">Guardar</button></div>';
    abrirHoja('hojaLiderLote');
  }
  // ---------- Sin líder ----------
  async function cargarSinLider(cont){
    if(!SL) cont.innerHTML = esqueleto(6);
    try { SL = await rpc('sin_lider_lista', {}); marcados = new Set([...marcados].filter((id) => (SL.filas || []).some((f) => f.cliente_id === id))); pintarSinLider(cont); }
    catch (e) { if(!SL) cont.innerHTML = '<div class="vacio" role="alert"><b>No se pudo cargar la lista</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" data-sl-reintentar>Reintentar</button></div>'; else toast(e.message, 'error'); }
  }
  function pintarSinLider(cont){
    if(!SL) return;
    const filas = (SL.filas || []).filter((f) => coincide([f.nombre, f.doc, f.codigos].join(' ')));
    let h = '<div class="si-cab"><p class="nota-chica">' + esc(plural((SL.filas || []).length, 'cliente instalado', 'clientes instalados')) + ' este mes sin líder. Sin líder no comisionan ni salen en los números de nadie.</p>' +
      (SL.puede && filas.length ? '<div class="si-acc"><button type="button" class="btn btn-chico btn-2" data-sl-todos>' + (filas.every((f) => marcados.has(f.cliente_id)) ? 'Quitar marcas' : 'Marcar todos') + '</button>' +
        '<button type="button" class="btn btn-chico" data-sl-asignar' + (marcados.size ? '' : ' disabled') + '>Asignar líder' + (marcados.size ? ' a ' + marcados.size : '') + '</button></div>' : '') + '</div>';
    if(!filas.length) h += vacio(busca ? 'Sin resultados' : 'Todos tienen líder', busca ? 'Nadie coincide con "' + busca + '".' : 'Los clientes instalados este mes ya tienen su líder.');
    else h += '<div class="grupo abierto si-lista">' + filas.map((f) => (SL.puede ? '<label class="si-f si-marca"><input type="checkbox" data-sl-marca="' + esc(f.cliente_id) + '"' + (marcados.has(f.cliente_id) ? ' checked' : '') + '>' : '<div class="si-f">') +
      '<span class="tx"><b>' + esc(f.nombre) + '</b><small>' + esc(f.doc + ' · ' + (f.codigos || '') + ' · instalado el ' + fecha(f.fecha)) + '</small></span><span class="m ambar">Sin líder</span>' + (SL.puede ? '</label>' : '</div>')).join('') + '</div>';
    cont.innerHTML = h;
  }
  function hojaLider(){
    let h = $('hojaLiderLote');
    if(!h){ h = document.createElement('section'); h.id = 'hojaLiderLote'; h.className = 'hoja'; h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', 'tLidL'); h.setAttribute('aria-hidden', 'true');
      document.body.appendChild(h); prepararHojas(); h.addEventListener('click', clicLider); }
    return h;
  }
  function abrirAsignar(){
    if(!marcados.size) return;
    hojaLider().innerHTML = '<div class="asa" aria-hidden="true"></div><div class="cab"><h2 id="tLidL">Asignar líder a ' + esc(plural(marcados.size, 'cliente', 'clientes')) + '</h2><button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      '<label class="rotulo" for="slLider">Líder</label><select class="campo" id="slLider" data-foco><option value="">Elige el líder</option>' + (SL.lideres || []).map((l) => '<option value="' + esc(l.id) + '">' + esc(l.nombre) + '</option>').join('') + '</select>' +
      '<div class="error" id="eSl" role="alert"></div><p class="nota-chica">Queda en la bitácora y en el hilo de cada cliente.</p><div class="acc" style="margin-top:14px"><button type="button" class="btn btn-2" data-cierra="1">Cancelar</button><button type="button" class="btn" id="slConfirmar">Confirmar</button></div>';
    abrirHoja('hojaLiderLote');
  }
  function clicLider(ev){
    const g = ev.target.closest('#siDiasGuardar');
    if(g){ const n = Number(($('siDias').value || '').trim()); if(!Number.isInteger(n) || n < 1 || n > 180){ $('eSiDias').textContent = 'Escribe un número entero entre 1 y 180'; return; }
      g.disabled = true; rpc('orden_dias_guardar', { p_dias: n }).then(() => { toast('Listo: se avisa desde ' + plural(n, 'día', 'días')); cerrarHoja(); SI = null; refrescar(); })
        .catch((e) => { $('eSiDias').textContent = e.message; g.disabled = false; }); return; }
    const b = ev.target.closest('#slConfirmar'); if(!b) return;
    const l = $('slLider').value; if(!l){ $('eSl').textContent = 'Elige el líder'; return; }
    b.disabled = true; b.textContent = 'Asignando…';
    rpc('clientes_lider_lote', { p_clientes: [...marcados], p_lider: l }).then((n) => { toast(plural(n, 'cliente quedó', 'clientes quedaron') + ' con su líder'); marcados.clear(); cerrarHoja(); SL = null; refrescar(); })
      .catch((e) => { $('eSl').textContent = e.message; b.disabled = false; b.textContent = 'Confirmar'; });
  }

  // ---------- Conexión con Comisiones ----------
  let actual = null; let cont = null;
  function mostrar(vista, c, persona, texto){ actual = vista; cont = c; yo = persona; busca = texto || ''; if(vista === 'sin_instalar') cargarSinInstalar(c); else cargarSinLider(c); }
  function refrescar(){ if(!cont || !actual) return; if(actual === 'sin_instalar') cargarSinInstalar(cont); else cargarSinLider(cont); }
  function buscar(texto){ busca = texto || ''; if(actual === 'sin_instalar') pintarSinInstalar(cont); else if(actual === 'sin_lider') pintarSinLider(cont); }
  document.addEventListener('click', (ev) => {
    const t = ev.target; let b;
    if(!cont || !cont.contains(t)) return;
    if(t.closest('[data-si-reintentar]') || t.closest('[data-sl-reintentar]')){ refrescar(); return; }
    if((b = t.closest('[data-si-subir]'))){ abrirOrden(b.dataset.siSubir); return; }
    if(t.closest('[data-si-dias]')){ cambiarDias(); return; }
    if(t.closest('[data-sl-asignar]')){ abrirAsignar(); return; }
    if(t.closest('[data-sl-todos]')){ const fs = (SL.filas || []).filter((f) => coincide([f.nombre, f.doc, f.codigos].join(' '))); const todos = fs.every((f) => marcados.has(f.cliente_id));
      fs.forEach((f) => { if(todos) marcados.delete(f.cliente_id); else marcados.add(f.cliente_id); }); pintarSinLider(cont); }
  });
  document.addEventListener('change', (ev) => { const x = ev.target.closest && ev.target.closest('[data-sl-marca]'); if(!x) return; const id = Number(x.dataset.slMarca); if(x.checked) marcados.add(id); else marcados.delete(id); pintarSinLider(cont); });
  window.SinInstalar = { mostrar, refrescar, buscar };
})();
