// Lote 28/10 (maqueta comisiones-28oct, pantallas 4, 11 y 12):
// Por instalar: órdenes de Odoo del corte sin instalación, con el reloj de 8 a. m. a 10 p. m. (más de 24 horas, menos de 24 horas y viejas aparte),
//   buscador por orden, nombre o RIF y "¿No aparece la orden? Súbelo igual".
// Subir documentos de un cliente nuevo: la orden es opcional; sin orden se sube con el posible nombre y el RIF y queda "Pendiente por instalar"
//   (se une solo cuando Odoo o el TAD lo traen; si hay un provisional parecido pregunta "¿Es este cliente?").
(function(){
  'use strict';
  const C = window.Comun;
  const { $, esc, ic, rpc, toast, plural, abrirHoja, cerrarHoja, hojaAbierta, prepararHojas, normalizeStr, vacio, esqueleto, fecha } = C;
  let PI = null; let pedidoPI = 0; let O = null;   // O: estado de la hoja Por instalar
  const ordenCorta = (o) => String(o || '').split('/').pop();
  const diaMes = (x) => { const t = new Date(x); return isNaN(t) ? '' : String(t.getDate()).padStart(2, '0') + '/' + String(t.getMonth() + 1).padStart(2, '0'); };
  // Horas del reloj: hasta 48 se dicen en horas; después en días de reloj (14 horas por día)
  const reloj = (h) => { const n = Number(h) || 0; return n >= 48 ? [plural(Math.floor(n / 14), 'día', 'días'), 'rojo'] : [plural(Math.floor(n), 'hora', 'horas'), n >= 24 ? 'ambar' : 'gris']; };
  function hoja(id, titulo){
    let h = $(id);
    if(!h){ h = document.createElement('section'); h.id = id; h.className = 'hoja completa lado angosta'; h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true');
      h.setAttribute('aria-labelledby', titulo); h.setAttribute('aria-hidden', 'true'); document.body.appendChild(h); prepararHojas(); }
    return h;
  }
  const cab = (idT, t, sub) => '<div class="hoja-cab"><div class="tx"><b id="' + idT + '">' + esc(t) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div><button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>';

  // ---------- Por instalar ----------
  async function cargarPI(){
    const mio = ++pedidoPI;
    try { const r = await rpc('por_instalar'); if(mio !== pedidoPI) return; PI = r; PI.filas = PI.filas || []; PI.pendientes = PI.pendientes || []; }
    catch (e) { if(mio !== pedidoPI) return; if(O){ O.error = e.message; } toast(e.message, 'error'); }
    if(O) pintarPI(); if(N && N.buscando) pintarNuevo();
  }
  const limite = () => (PI && PI.horas_alerta) || 24;
  function tabDe(o){ return o.vieja ? 'viejas' : Number(o.horas) >= limite() ? 'mas' : 'menos'; }
  function tarjeta(o, destacada){
    const r = reloj(o.horas); const conCli = o.en_app;
    const btn = conCli ? '<button type="button" class="mini" data-pi-ver="' + esc(o.cliente_id) + '">Ver cliente</button>'
      : '<button type="button" class="mini' + (destacada ? ' pri' : '') + '" data-pi-subir="' + esc(o.orden_id) + '">' + (destacada ? 'Elegir y subir documentos' : 'Subir documentos') + '</button>';
    let acc = '';
    if(o.parecido_id) acc += '<div class="ins-acc"><span>¿Es este cliente? <b>' + esc(o.parecido || '') + '</b></span><button type="button" class="mini pri" data-es-cli="si" data-orden="' + esc(o.orden_id) + '" data-cli="' + esc(o.parecido_id) + '">Sí, es ese</button><button type="button" class="mini" data-es-cli="no" data-orden="' + esc(o.orden_id) + '">No, es otro</button></div>';
    if(PI.puedo && PI.puedo.asignar && o.provisional && o.lider === 'Por asignar') acc += '<div class="ins-acc"><span>La orden la creó otra persona sin código.</span><button type="button" class="mini pri" data-dueno-prov="' + esc(o.cliente_id) + '" data-nombre="' + esc(o.cliente) + '">Elegir dueño</button></div>';
    return '<div class="pi-t' + (destacada ? ' on' : '') + '"><div class="pi-l1"><small>' + esc(ordenCorta(o.numero) + ' · ' + (o.lider || 'Por asignar')) + '</small><span class="chip ' + r[1] + '">' + esc(r[0]) + '</span></div>' +
      '<b class="' + (o.cliente_id && !o.provisional ? '' : 'mal') + '">' + esc(o.cliente_id && !o.provisional ? o.cliente : 'Sin cliente en la app') + '</b>' +
      (o.cliente_id && !o.provisional ? '' : o.cliente ? '<small>En Odoo: ' + esc(o.cliente) + '</small>' : '') +
      '<small>Creada ' + esc(diaMes(o.creada_en)) + (o.etapa ? ' · ' + esc(o.etapa) : '') + (o.veces ? ' · reprogramada ' + (o.veces === 1 ? '1 vez' : o.veces + ' veces') : '') + '</small>' +
      '<div class="pi-l3"><span class="chip ' + (o.docs ? 'verde">Documentos subidos' : 'gris">Sin documentos') + '</span>' + btn + '</div>' + acc + '</div>';
  }
  function pintarPI(){
    const h = hoja('hojaPorInst', 'tPorInst');
    if(!O) return;
    let cuerpo = '';
    if(!PI && O.error) cuerpo = '<div class="vacio" role="alert"><b>No se pudieron cargar las órdenes</b><p>' + esc(O.error) + '</p><button type="button" class="btn btn-chico" data-pi-reintentar>Reintentar</button></div>';
    else if(!PI) cuerpo = esqueleto(5);
    else {
      const filas = PI.filas; const n = { mas: 0, menos: 0, viejas: 0 }; filas.forEach((o) => { n[tabDe(o)]++; });
      const tabs = [['mas', 'Pasan de ' + limite() + ' horas'], ['menos', 'Menos de ' + limite() + ' horas'], ['viejas', 'Viejas']];
      cuerpo += '<div class="tres pi-tabs" role="tablist">' + tabs.map((t) => '<button type="button" role="tab" data-pi-tab="' + t[0] + '" class="' + (O.tab === t[0] ? 'on' : '') + '" aria-selected="' + (O.tab === t[0]) + '">' + t[1] + ' · ' + n[t[0]] + '</button>').join('') + '</div>';
      cuerpo += '<label class="rotulo arriba" for="piBusca">Buscar la orden</label><input class="campo" id="piBusca" type="search" maxlength="60" autocomplete="off" enterkeyhint="search" value="' + esc(O.q || '') + '"><p class="nota-chica">Por número de orden, nombre o RIF</p>';
      const q = normalizeStr(O.q || ''); const dg = String(O.q || '').replace(/\D/g, '');
      const coincide = (o) => !q || normalizeStr([o.cliente, o.titulo, o.lider].join(' ')).indexOf(q) >= 0 || (dg.length >= 3 && (String(o.numero || '').replace(/\D/g, '').indexOf(dg) >= 0 || String(o.rif || '').replace(/\D/g, '').indexOf(dg) >= 0));
      if(q) { const top = filas.filter(coincide).slice(0, 3); if(top.length) cuerpo += top.map((o) => tarjeta(o, true)).join(''); else cuerpo += '<p class="nota-chica" role="status">Ninguna orden coincide con "' + esc(O.q) + '".</p>'; }
      cuerpo += '<div class="pi-igual"><b>¿No aparece la orden? Súbelo igual</b><div class="pi-2">' +
        '<div><label class="rotulo" for="piNom">Posible nombre del cliente</label><input class="campo" id="piNom" maxlength="200" autocomplete="off" value="' + esc(O.nom || '') + '"><div class="error" id="ePiNom" role="alert"></div></div>' +
        '<div><label class="rotulo" for="piRif">RIF o cédula</label><input class="campo" id="piRif" maxlength="20" autocomplete="off" value="' + esc(O.rif || '') + '"><div class="error" id="ePiRif" role="alert"></div></div></div>' +
        '<p class="nota-chica">Queda como "Pendiente por instalar". Cuando el cruce con Odoo o el TAD lo encuentre, se une solo. Si ya existe uno parecido, te pregunta "¿Es este cliente?".</p>' +
        '<button type="button" class="btn btn-2 btn-chico" data-pi-igual>Continuar y subir documentos</button></div>';
      const lista = filas.filter((o) => tabDe(o) === O.tab && (!q || coincide(o)));
      cuerpo += '<h3 class="pi-h">' + esc(O.tab === 'mas' ? 'Órdenes que pasan de ' + limite() + ' horas' : O.tab === 'menos' ? 'Órdenes de menos de ' + limite() + ' horas' : 'Órdenes de antes de este corte') + '</h3>';
      cuerpo += lista.length ? lista.map((o) => tarjeta(o)).join('') : vacio(O.tab === 'mas' ? 'Ninguna pasa de ' + limite() + ' horas' : 'Nada aquí', O.tab === 'viejas' ? 'No quedan órdenes viejas sin instalar.' : 'Cuando se monte una orden en Odoo, aparece aquí con su reloj.');
      if((PI.pendientes || []).length) cuerpo += '<h3 class="pi-h">Subidos sin orden · ' + PI.pendientes.length + '</h3>' + PI.pendientes.map((p) => '<button type="button" class="fila pi-pend" data-pi-ver="' + esc(p.cliente_id) + '"><span class="tx"><b>' + esc(p.nombre) + '</b><small>' +
        esc(p.doc + ' · ' + (p.dueno || 'Por asignar') + ' · ' + plural(p.docs, 'documento', 'documentos')) + '</small></span><span class="chip ' + (p.enviado ? 'verde">Enviado a revisión' : 'gris">Pendiente por instalar') + '</span></button>').join('');
      if(PI.puedo && PI.puedo.realizadas && (PI.realizadas || []).length) cuerpo += '<h3 class="pi-h">Realizadas en Odoo sin instalación · ' + PI.realizadas.length + '</h3><p class="nota-chica">Odoo las marca realizadas pero no tienen instalación en el TAD. Revisa si falta cargar el TAD o falló el cruce.</p>' +
        PI.realizadas.map((o) => '<' + (o.cliente_id ? 'button type="button" data-pi-ver="' + esc(o.cliente_id) + '"' : 'div') + ' class="fila"><span class="tx"><b>' + esc(o.cliente) + '</b><small>' + esc(ordenCorta(o.numero) + ' · ' + (o.lider || 'Sin líder') + ' · realizada el ' + fecha(o.ejecutada_en || o.creada_en)) + '</small></span><span class="chip azul">Realizado</span></' + (o.cliente_id ? 'button' : 'div') + '>').join('');
      cuerpo += '<p class="nota-chica pi-pie">Cuando el TAD trae la instalación, la orden pasa sola al corte con sus documentos. El líder recibe un aviso al pasar las ' + limite() + ' horas.' +
        (PI.puedo && PI.puedo.horas ? ' <button type="button" class="enlace" data-pi-horas>Cambiar horas</button>' : '') + '</p>';
    }
    h.innerHTML = cab('tPorInst', 'Por instalar', 'Órdenes de Odoo del corte sin instalación. El reloj cuenta de 8 a. m. a 10 p. m.') + '<div class="hoja-cuerpo">' + cuerpo + '</div>';
  }
  function abrirPI(o){
    window.Ficha.montar();
    O = Object.assign({ tab: 'mas', q: '' }, O && O.q ? { q: O.q } : {}, o || {});
    pintarPI(); if(hojaAbierta() !== 'hojaPorInst') abrirHoja('hojaPorInst'); cargarPI();
    const h = $('hojaPorInst');
    if(!h.dataset.listo){ h.dataset.listo = '1';
      h.addEventListener('click', clicPI);
      h.addEventListener('input', (ev) => { if(ev.target.id === 'piBusca'){ clearTimeout(O.tb); const v = ev.target.value; O.tb = setTimeout(() => { O.q = v.trim(); const c = $('piBusca'); pintarPI(); const c2 = $('piBusca'); if(c2){ c2.focus(); c2.setSelectionRange(c2.value.length, c2.value.length); } }, 180); }
        if(ev.target.id === 'piNom') O.nom = ev.target.value; if(ev.target.id === 'piRif') O.rif = ev.target.value; });
      h.addEventListener('hoja-cerrada', () => { const f = O && O.alCambiar; if(O && O.tocado && f) f(); });
    }
  }
  function clicPI(ev){
    const t = ev.target; let b;
    if(!O) return;
    if(t.closest('[data-pi-reintentar]')){ O.error = null; cargarPI(); return; }
    if((b = t.closest('[data-pi-tab]'))){ O.tab = b.dataset.piTab; pintarPI(); return; }
    if((b = t.closest('[data-pi-ver]'))){ window.Ficha.abrir(Number(b.dataset.piVer), { yo: O.yo, alCerrar: () => { O.tocado = true; cargarPI(); } }); return; }
    if((b = t.closest('[data-pi-subir]'))){ const o = PI.filas.find((x) => String(x.orden_id) === b.dataset.piSubir); abrirNuevo({ yo: O.yo, orden: o, alCambiar: () => { O.tocado = true; cargarPI(); } }); return; }
    if(t.closest('[data-pi-igual]')){
      const nom = ($('piNom').value || '').trim(); const rif = ($('piRif').value || '').trim(); let mal = false;
      $('ePiNom').textContent = ''; $('ePiRif').textContent = '';
      if(nom.length < 3){ $('ePiNom').textContent = 'Escribe el posible nombre'; mal = true; }
      if(!/\d{5,}/.test(rif.replace(/\D/g, '').replace(/^0+/, ''))){ $('ePiRif').textContent = 'Escribe el RIF o la cédula'; mal = true; }
      if(mal) return;
      abrirNuevo({ yo: O.yo, nombre: nom, rif, alCambiar: () => { O.tocado = true; cargarPI(); } }); return; }
    if(t.closest('[data-pi-horas]')){ cambiarHoras(); return; }
    const ec = t.closest('[data-es-cli]');
    if(ec){ const si = ec.dataset.esCli === 'si'; ec.parentNode.querySelectorAll('button').forEach((x) => { x.disabled = true; });
      rpc('orden_es_cliente', { p_orden: Number(ec.dataset.orden), p_cliente: si ? Number(ec.dataset.cli) : null })
        .then(() => { toast(si ? 'Listo: la orden quedó en ese cliente' : 'Listo: se creó el cliente provisional'); O.tocado = true; cargarPI(); })
        .catch((err) => { toast(err.message, 'error'); ec.parentNode.querySelectorAll('button').forEach((x) => { x.disabled = false; }); }); return; }
    const dp = t.closest('[data-dueno-prov]'); if(dp){ abrirDuenoProv(Number(dp.dataset.duenoProv), dp.dataset.nombre); }
  }
  function hojaChica(id, idT){
    let h = $(id);
    if(!h){ h = document.createElement('section'); h.id = id; h.className = 'hoja'; h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', idT); h.setAttribute('aria-hidden', 'true'); document.body.appendChild(h); prepararHojas(); }
    return h;
  }
  const cabChica = (idT, t, sub) => '<div class="cab"><div><h2 id="' + idT + '">' + esc(t) + '</h2>' + (sub ? '<p class="sub-hoja">' + esc(sub) + '</p>' : '') + '</div><button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>';
  function abrirDuenoProv(cliente, nombre){
    const h = hojaChica('hojaDueno', 'tDueno');
    h.innerHTML = cabChica('tDueno', 'Dueño del cliente', nombre) + '<form id="formDueno" novalidate data-cliente="' + esc(cliente) + '"><label class="rotulo" for="duenoSel">Pertenece a</label><select class="campo" id="duenoSel"><option value="">Elige el líder</option>' +
      ((PI && PI.duenos) || []).map((x) => '<option>' + esc(x) + '</option>').join('') + '</select><div class="error" id="eDueno" role="alert"></div>' +
      '<p class="nota">La orden la creó otra persona sin código de vendedor. El cliente queda a nombre del líder que elijas.</p><div class="acciones"><button type="submit" class="btn btn-ancho" id="guardarDueno">Guardar</button></div></form>';
    abrirHoja('hojaDueno');
  }
  // Aviso al líder: desde cuántas horas del reloj (solo administrador)
  function cambiarHoras(){
    const h = hojaChica('hojaHorasPI', 'tHorasPI');
    h.innerHTML = cabChica('tHorasPI', 'Aviso de órdenes sin instalar', 'Horas del reloj de 8 a. m. a 10 p. m.') + '<form id="formHorasPI" novalidate><label class="rotulo" for="piHoras">Avisar al líder desde (horas)</label>' +
      '<input class="campo" id="piHoras" type="number" inputmode="numeric" min="1" max="720" value="' + esc(limite()) + '" data-foco><div class="error" id="ePiHoras" role="alert"></div>' +
      '<p class="nota-chica">Al administrador le llega un resumen semanal de las que pasan de ese número. Queda en la bitácora.</p><div class="acciones"><button type="submit" class="btn btn-ancho" id="piHorasGuardar">Guardar</button></div></form>';
    abrirHoja('hojaHorasPI');
  }
  document.addEventListener('submit', (e) => {
    if(e.target.id === 'formDueno'){ e.preventDefault(); const v = $('duenoSel').value; $('eDueno').textContent = '';
      if(!v){ $('eDueno').textContent = 'Elige el líder'; return; }
      const b = $('guardarDueno'); b.disabled = true; b.textContent = 'Guardando…';
      rpc('provisional_dueno', { p_cliente: Number(e.target.dataset.cliente), p_dueno: v })
        .then(() => { toast('Listo: el cliente quedó a nombre de ' + v); if(hojaAbierta() === 'hojaDueno') cerrarHoja(); if(O) O.tocado = true; cargarPI(); })
        .catch((err) => { $('eDueno').textContent = err.message; b.disabled = false; b.textContent = 'Guardar'; }); return; }
    if(e.target.id === 'formHorasPI'){ e.preventDefault(); const n = Number(($('piHoras').value || '').trim()); const er = $('ePiHoras'); er.textContent = '';
      if(!Number.isInteger(n) || n < 1 || n > 720){ er.textContent = 'Escribe un número entero entre 1 y 720'; return; }
      const b = $('piHorasGuardar'); b.disabled = true;
      rpc('orden_horas_guardar', { p_horas: n }).then(() => { toast('Listo: se avisa desde ' + plural(n, 'hora', 'horas')); if(hojaAbierta() === 'hojaHorasPI') cerrarHoja(); cargarPI(); })
        .catch((err) => { er.textContent = err.message; b.disabled = false; }); }
  });

  // ---------- Cliente nuevo (lote 12/11 B, maqueta comisiones-hoja.html 4 y 6c) ----------
  // Paso 1: se suelta el RIF (o la cédula), el OCR lo lee, se busca en la app sin crear nada (cliente_rif_buscar) y se propone la orden por el nombre.
  // Paso 2: los documentos, con el RIF ya en su casilla. Al enviar: "Enviado a revisión" con sus 3 pasos.
  let N = null;
  const SUB = 'Queda "Pendiente por instalar" hasta que el TAD traiga la instalación';
  const MESC = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const diaCorto = (x) => { const t = new Date(x); return isNaN(t) ? '' : t.getDate() + ' ' + MESC[t.getMonth()]; };
  function pasos(){
    const dos = !!N.F; const fin = !!N.enviado;
    return '<div class="nv-p2"><span class="' + (dos ? 'hecho' : 'on') + '"><i>' + (dos ? ic('check') : '1') + '</i>El RIF</span><span class="ln" aria-hidden="true"></span>' +
      '<span class="' + (fin ? 'hecho' : dos ? 'on' : '') + '"><i>' + (fin ? ic('check') : '2') + '</i>Documentos</span></div>';
  }
  // La orden sugerida por el nombre (de las órdenes del corte sin cliente en la app)
  function ordenSugerida(){
    if(N.orden || N.sinSug || !PI) return null;
    const nom = normalizeStr(N.nombre || ''); if(nom.length < 4) return null;
    const clave = nom.replace(/\b(c ?a|s ?a|c ?a ?s|s ?r ?l|inversiones|comercial|grupo|corporacion)\b/g, ' ').replace(/[^a-z0-9 ]/g, ' ').trim().split(/\s+/).filter((x) => x.length > 2).slice(0, 2);
    if(!clave.length) return null;
    return ((PI && PI.filas) || []).find((o) => !o.en_app && clave.every((w) => normalizeStr([o.cliente, o.titulo].join(' ')).indexOf(w) >= 0)) || null;
  }
  function bandaApp(){
    const B = N.busq;
    if(N.buscandoApp) return '<div class="nv-banda gris" role="status"><b>Buscando en la app…</b>Un momento.</div>';
    if(!B) return '';
    if(B.error) return '<div class="nv-banda rojo" role="alert"><b>No se pudo buscar</b>' + esc(B.error) + ' <button type="button" class="enlace" data-nv-rebuscar>Reintentar</button></div>';
    if(B.estado === 'otro') return '<div class="nv-banda rojo" role="alert"><b>Ese RIF ya es de otro líder</b>Pídele al administrador que lo revise.</div>';
    if(B.estado === 'existe') return '<div class="nv-banda azul" role="status"><b>Ya está en la app</b>' + esc(B.nombre || '') + '. Al continuar subes sus documentos.' +
      '<span class="nv-dos-b"><button type="button" class="hc-b s ch" data-nv-abrir="' + esc(B.cliente_id) + '">Abrir su expediente</button></span></div>';
    if((B.parecidos || []).length) return '<div class="nv-banda ambar" role="status"><b>¿Es este?</b>Hay un cliente provisional con un nombre parecido. Si es el mismo, sus documentos y su orden se juntan.</div>' +
      '<div class="hc-tarj">' + B.parecidos.map((p) => '<div class="hc-fl"><span class="tx"><b>' + esc(p.nombre) + '</b><small>' + esc(p.lider) + '</small></span><button type="button" class="hc-b ch" data-nv-par="' + esc(p.id) + '">Sí, es este</button></div>').join('') +
        '<div class="hc-fl"><span class="tx"><b>Ninguno es</b><small>Se crea un cliente nuevo</small></span><button type="button" class="hc-b s ch" data-nv-par="0">No, es otro: crear</button></div></div>';
    return '<div class="nv-banda verde" role="status"><b>No está en la app</b>' + (N.archivo ? 'Se crea al continuar y el RIF queda subido en su casilla.' : 'Se crea al continuar.') + '</div>';
  }
  function filaOrden(){
    if(N.orden) return '<div class="hc-tarj nv-ord"><div class="hc-fl"><span class="hc-ic">' + ic('doc') + '</span><span class="tx"><b>Orden ' + esc(ordenCorta(N.orden.numero)) + ' · ' + esc(N.orden.lider || 'Por asignar') + '</b><small>' + esc((N.orden.cliente || 'Sin cliente en la app') + ' · creada el ' + diaCorto(N.orden.creada_en)) + '</small></span>' +
      '<button type="button" class="enlace" data-nv-sin-orden>Quitar</button></div></div>';
    const sg = ordenSugerida();
    let h = sg ? '<div class="hc-tarj"><div class="hc-fl"><span class="hc-ic">' + ic('doc') + '</span><span class="tx"><b>Orden ' + esc(ordenCorta(sg.numero)) + ' · ' + esc(sg.lider || 'Por asignar') + '</b><small>Sugerida por el nombre · creada el ' + esc(diaCorto(sg.creada_en)) + '</small></span>' +
        '<span class="bts"><button type="button" class="hc-b s ch" data-nv-otra>Otra</button><button type="button" class="hc-b ch" data-nv-orden="' + esc(sg.orden_id) + '">Es esta</button></span></div></div>'
      : '<div class="hc-tarj"><div class="hc-fl"><span class="hc-ic">' + ic('doc') + '</span><span class="tx"><b>Sin orden de Odoo por ahora</b><small>Es opcional: se une sola cuando la orden o la instalación aparezcan</small></span><button type="button" class="hc-b s ch" data-nv-buscar>' + (N.buscando ? 'Cerrar' : 'Buscar orden') + '</button></div></div>';
    if(N.buscando){
      const q = normalizeStr(N.qo || ''); const libres = ((PI && PI.filas) || []).filter((o) => !o.en_app && (!q || normalizeStr([o.cliente, o.titulo, o.numero].join(' ')).indexOf(q) >= 0)).slice(0, 8);
      h += '<label class="rotulo arriba" for="nvBuscaO">Buscar la orden</label><input class="campo" id="nvBuscaO" type="search" maxlength="60" autocomplete="off" value="' + esc(N.qo || '') + '">' +
        (!PI ? esqueleto(2) : libres.length ? libres.map((o) => '<button type="button" class="fila" data-nv-orden="' + esc(o.orden_id) + '"><span class="tx"><b>' + esc(ordenCorta(o.numero) + ' · ' + (o.cliente || 'Sin nombre')) + '</b><small>' + esc((o.lider || 'Por asignar') + ' · creada ' + diaMes(o.creada_en)) + '</small></span>' + ic('derecha', 'ch') + '</button>').join('')
          : '<p class="nota-chica">Ninguna orden sin cliente coincide. Sigue sin orden: se une sola después.</p>');
    }
    return h;
  }
  function pintarNuevo(){
    const h = hoja('hojaNuevo', 'tNuevo'); if(!N) return;
    h.classList.add('hoja-nv');
    // Pantalla final al enviar
    if(N.enviado && N.F){
      const n = (N.F.documentos || []).filter((x) => (x.archivos || []).length).length; const t = N.enviado;
      h.innerHTML = cab('tNuevo', 'Cliente nuevo', N.F.cliente.nombre + ' · ' + C.docFmt(N.F.cliente.doc_tipo, N.F.cliente.doc_numero)) + '<div class="hoja-cuerpo"><div class="nv-fin"><span class="ok">' + ic('check') + '</span><h3>Enviado a revisión</h3>' +
        '<p>' + esc((n === 1 ? 'El documento quedó' : 'Los ' + n + ' documentos quedaron') + ' en la bandeja del administrador. Te avisamos si devuelve alguno.') + '</p></div>' +
        '<div class="nv-lin"><div><i class="h">' + ic('check') + '</i><span><b>Documentos subidos</b><small>Hoy, ' + esc(C.hora(t)) + '</small></span></div>' +
        '<div><i>2</i><span><b>Revisión del administrador</b><small>Si falta algo, te llega en Mi trabajo</small></span></div>' +
        '<div><i>3</i><span><b>Instalación</b><small>Cuando el TAD la traiga, se une sola y entra a Comisiones</small></span></div></div></div>' +
        '<div class="hoja-pie nv-pie2"><button type="button" class="hc-b s" data-nv-otro>Subir otro cliente</button><button type="button" class="hc-b" data-nv-pend>Ver mis pendientes</button></div>';
      return;
    }
    if(!N.F){
      let c = pasos(); const o = N.ocr;
      const conDatos = N.manual || N.archivo;
      if(!conDatos){
        c += '<div class="nv-zona2" data-nv-zona><span class="ic">' + ic('subir') + '</span><b><span class="solo-pc">Suelta aquí el RIF de la empresa</span><span class="solo-tel">Sube el RIF de la empresa</span></b>' +
          '<small><span class="solo-pc">PDF o foto. Leemos el número y la razón social, y buscamos si ya está en la app.</span><span class="solo-tel">Foto o PDF. Leemos el número y la razón social.</span></small>' +
          '<button type="button" class="hc-b s ch" data-nv-elegir><span class="solo-pc">Elegir archivo</span><span class="solo-tel">Tomar foto o elegir</span></button></div>' +
          '<input type="file" id="nvArchivo" accept="application/pdf,image/jpeg,image/png" hidden>' + (N.eArchivo ? '<div class="error" role="alert">' + esc(N.eArchivo) + '</div>' : '') +
          '<button type="button" class="enlace nv-manual" data-nv-manual>No tengo el RIF: escribir los datos</button>';
        h.innerHTML = cab('tNuevo', 'Cliente nuevo', SUB) + '<div class="hoja-cuerpo nv-c">' + c + '</div>';
        return;
      }
      if(N.archivo){
        const est = N.leyendo ? 'Leyendo el archivo…' : !o ? '' : o.estado !== 'ok' ? 'No se pudo leer: escribe los datos' : /^rif_|^cedula$/.test(o.tipo || '') ? (o.dudosa ? 'Lectura dudosa · revisa cada dato' : (o.tipo === 'cedula' ? 'Leído de la cédula' : 'Leído del RIF') + ' · revisa y corrige si hace falta') : 'No parece un RIF';
        const cls = N.leyendo || !o ? '' : o.estado !== 'ok' || o.dudosa ? ' w' : /^rif_|^cedula$/.test(o.tipo || '') ? '' : ' r';
        c += '<div class="nv-leido"><span class="pdf">' + (/pdf/i.test(N.archivo.type) ? 'PDF' : 'FOTO') + '</span><span class="tx"><b>' + esc(N.archivo.name) + '</b><small class="' + cls + '">' + esc(est) + '</small></span>' +
          '<button type="button" class="enlace" data-nv-cambiar' + (N.leyendo ? ' disabled' : '') + '>Cambiar</button></div>' +
          (N.leyendo ? '<span class="nv-franja" aria-hidden="true"><i></i></span>' : '') + '<input type="file" id="nvArchivo" accept="application/pdf,image/jpeg,image/png" hidden>';
        if(o && !N.leyendo && o.estado === 'ok' && !/^rif_|^cedula$/.test(o.tipo || '')) c += '<div class="nv-banda rojo" role="alert"><b>No corresponde a un RIF</b>El archivo parece ' + esc(o.tipo === 'poliza' ? 'una póliza' : o.tipo === 'combinado' ? 'una cédula y un RIF juntos' : 'otro documento') + '. Sube el RIF o escribe los datos.</div>';
        else if(o && !N.leyendo && o.dudosa) c += '<div class="nv-banda ambar" role="status"><b>Lectura dudosa</b>' + esc(((o.datos && o.datos.motivos) || []).join(', ') || 'Revisa cada dato') + '. Corrige lo que no esté bien.</div>';
        else if(o && !N.leyendo && o.estado !== 'ok') c += '<div class="nv-banda ambar" role="status"><b>No se pudo leer</b>' + esc(o.error || 'Google no devolvió el texto') + '. Escribe los datos; el archivo igual queda en su casilla.</div>';
      }
      const nat = /^[VE]/i.test(String(N.rif || '').trim());
      c += '<div class="nv-dos"><div><label class="rotulo" for="nvRif">' + (nat ? 'Cédula o RIF' : 'RIF') + '</label><input class="campo" id="nvRif" maxlength="20" autocomplete="off" autocapitalize="characters" value="' + esc(N.rif || '') + '"' + (N.leyendo ? ' disabled' : '') + '><div class="error" id="eNvRif" role="alert">' + esc(N.eRif || '') + '</div></div>' +
        '<div><label class="rotulo" for="nvNom">' + (nat ? 'Nombre completo' : 'Razón social') + '</label><input class="campo" id="nvNom" maxlength="200" autocomplete="off" value="' + esc(N.nombre || '') + '"' + (N.leyendo ? ' disabled' : '') + '><div class="error" id="eNvNom" role="alert">' + esc(N.eNom || '') + '</div></div></div>';
      if(!N.leyendo) c += bandaApp() + filaOrden();
      const bloq = N.leyendo || N.ocupado || N.buscandoApp || (N.busq && N.busq.estado === 'otro') || (N.busq && (N.busq.parecidos || []).length);
      h.innerHTML = cab('tNuevo', 'Cliente nuevo', SUB) + '<div class="hoja-cuerpo nv-c">' + c + '</div>' +
        '<div class="hoja-pie nv-pie"><button type="button" class="hc-b an" data-nv-seguir' + (bloq ? ' disabled' : '') + '>' + (N.ocupado ? 'Creando…' : 'Continuar a los documentos') + '</button></div>';
      return;
    }
    const F = N.F; const fal = F.faltantes || [];
    const listos = (F.documentos || []).filter((x) => x.estado !== 'devuelto' && (x.archivos || []).length).length;
    const tot = listos + fal.length;
    let c = pasos() + '<div class="si-cli"><b>' + esc(F.cliente.nombre) + '</b><small>' + esc(C.docFmt(F.cliente.doc_tipo, F.cliente.doc_numero)) + ' · ' + esc(N.creado ? 'No existía en la app: se creó' : N.unido ? 'Se unió al cliente provisional' : 'Ya estaba en la app') + '</small></div>' +
      '<button type="button" class="nv-zona" data-nv-varios><b>Arrastra aquí varios archivos a la vez</b><span>Después marcas qué trae cada uno. También puedes subir casilla por casilla.</span></button>' +
      '<div id="docsNuevo">' + window.Ficha.documentosPara(F) + '</div>';
    // Pie corto: cuántos van, la barra y los dos botones (Enviar se activa cuando no falta nada)
    const pie = '<div class="hoja-pie col nv-pie3"><p><b>' + listos + ' de ' + tot + ' listos</b>' + (fal.length ? ' · ' + (fal.length === 1 ? 'falta 1' : 'faltan ' + fal.length) + '. Enviar se activa cuando esté todo.' : ' · ya está todo.') + '</p>' +
      '<span class="nv-barra" aria-hidden="true"><i style="transform:scaleX(' + (tot ? (listos / tot).toFixed(3) : 0) + ')"></i></span>' +
      '<div class="nv-acc"><button type="button" class="hc-b s" data-nv-guardar>Guardar lo que llevo</button><button type="button" class="hc-b" data-nv-enviar' + (fal.length ? ' disabled' : '') + '>Enviar a revisión</button></div></div>';
    h.innerHTML = cab('tNuevo', 'Cliente nuevo', SUB) + '<div class="hoja-cuerpo">' + c + '</div>' + pie;
  }
  function abrirNuevo(o){
    window.Ficha.montar();
    N = Object.assign({ orden: null, F: null }, o || {});
    if(N.orden && N.orden.cliente && !N.nombre) N.nombre = N.orden.cliente;
    if(N.rif || N.nombre) N.manual = true;
    pintarNuevo(); abrirHoja('hojaNuevo');
    if(!PI) cargarPI();
    if(N.manual && N.rif) buscarApp();
    const h = $('hojaNuevo');
    if(!h.dataset.listo){ h.dataset.listo = '1';
      h.addEventListener('click', clicNuevo);
      h.addEventListener('change', (ev) => { if(ev.target.id === 'nvArchivo' && N){ const f = ev.target.files && ev.target.files[0]; if(f) leerRif(f); } });
      h.addEventListener('input', (ev) => { if(!N) return; if(ev.target.id === 'nvRif' || ev.target.id === 'nvNom'){ if(ev.target.id === 'nvRif') N.rif = ev.target.value; else { N.nombre = ev.target.value; N.sinSug = false; }
          clearTimeout(N.tq); N.tq = setTimeout(() => { if(N && !N.F) buscarApp(true); }, 700); }
        if(ev.target.id === 'nvBuscaO'){ N.qo = ev.target.value; clearTimeout(N.tb); N.tb = setTimeout(() => { pintarNuevo(); const x = $('nvBuscaO'); if(x){ x.focus(); x.setSelectionRange(x.value.length, x.value.length); } }, 160); } });
      // Arrastrar funciona en los dos pasos: en el paso 1 recibe el RIF; en el 2, a una casilla o varios a la vez
      h.addEventListener('dragover', (ev) => { if(!N || N.enviado) return; ev.preventDefault(); const z = ev.target.closest('[data-suelta]') || ev.target.closest('.nv-zona') || ev.target.closest('[data-nv-zona]'); h.querySelectorAll('.sobre').forEach((x) => x.classList.remove('sobre')); if(z) z.classList.add('sobre'); });
      h.addEventListener('dragleave', (ev) => { if(!h.contains(ev.relatedTarget)) h.querySelectorAll('.sobre').forEach((x) => x.classList.remove('sobre')); });
      h.addEventListener('drop', (ev) => { if(!N || N.enviado) return; ev.preventDefault(); h.querySelectorAll('.sobre').forEach((x) => x.classList.remove('sobre'));
        const files = Array.prototype.slice.call((ev.dataTransfer && ev.dataTransfer.files) || []); if(!files.length) return;
        if(!N.F){ leerRif(files[0]); return; }
        const c = ev.target.closest('[data-suelta]'); if(c){ const p = c.dataset.casilla.split(':'); window.Ficha.soltarA(N.F, p[0], Number(p[1]), files, recargarNuevo); } else window.Ficha.variosA(N.F, recargarNuevo, files); });
      h.addEventListener('hoja-cerrada', () => { const f = N && N.alCambiar; const t = N && N.tocado; N = null; if(t && f) f(); });
    }
  }
  // El OCR que ya existe (como en Cambios): leído, dudoso en ámbar, no es RIF en rojo, no se pudo leer
  async function leerRif(file){
    if(!N || N.F) return; N.eArchivo = '';
    if(!/^(application\/pdf|image\/(jpeg|png))$/i.test(file.type)){ N.eArchivo = 'Sube el RIF en PDF, JPG o PNG'; pintarNuevo(); return; }
    if(file.size > 10 * 1024 * 1024){ N.eArchivo = 'El archivo pesa más de 10 MB'; pintarNuevo(); return; }
    N.archivo = file; N.leyendo = true; N.ocr = null; N.busq = null; N.esCedula = false; pintarNuevo();
    const mio = N; let o;
    try {
      const s = await window.db.auth.getSession(); const tk = (s.data && s.data.session && s.data.session.access_token) || '';
      if(!tk) throw new Error('Tu sesión venció. Entra de nuevo');
      const fd = new FormData(); fd.append('archivo', file, file.name);
      const r = await fetch(window.db.supabaseUrl + '/functions/v1/ocr_leer', { method: 'POST', headers: { Authorization: 'Bearer ' + tk, apikey: window.db.supabaseKey }, body: fd });
      o = await r.json().catch(() => ({ estado: 'sin_lectura', error: 'Respuesta inválida' }));
      if(!r.ok && !o.estado) o = { estado: 'sin_lectura', error: o.error || 'No se pudo leer' };
    } catch (e) { o = { estado: 'sin_lectura', error: navigator.onLine === false ? 'Sin conexión' : e.message }; }
    if(N !== mio) return;
    N.leyendo = false; N.ocr = o; const d = o.datos || {};
    if(o.estado === 'ok' && /^rif_/.test(o.tipo || '') && d.rif){
      const nat = /^[VE]/.test(d.rif); N.rif = nat ? d.rif.charAt(0) + '-' + d.rif.slice(1, -1).replace(/^0+/, '') : d.rif.charAt(0) + '-' + d.rif.slice(1, 9) + '-' + d.rif.slice(9);
      if(d.razon_social) N.nombre = d.razon_social;
    } else if(o.estado === 'ok' && o.tipo === 'cedula' && d.numero){
      // Si el archivo es una cédula, se lee como cédula
      N.rif = (d.letra || 'V') + '-' + String(d.numero).replace(/^0+/, ''); N.nombre = [d.nombres, d.apellidos].filter(Boolean).join(' ') || N.nombre;
      N.esCedula = true;
    }
    pintarNuevo();
    if(N.rif) buscarApp();
  }
  // Busca en la app sin crear nada: nuevo (con provisionales parecidos), ya está o es de otro líder
  async function buscarApp(callado){
    if(!N || N.F) return;
    const dg = String(N.rif || '').replace(/\D/g, '').replace(/^0+/, '');
    if(!/^\d{5,10}$/.test(dg)){ if(!callado){ N.busq = null; pintarNuevo(); } return; }
    const mio = N; const pedido = (N.pb = (N.pb || 0) + 1);
    N.buscandoApp = true; if(!callado) pintarNuevo(); else refrescarBanda();
    let r; try { r = await rpc('cliente_rif_buscar', { p_rif: N.rif, p_nombre: N.nombre || null }); } catch (e) { r = { error: e.message }; }
    if(N !== mio || N.pb !== pedido) return;
    N.buscandoApp = false; N.busq = r; if(callado) refrescarBanda(); else pintarNuevo();
  }
  // Mientras escribe no se repinta todo (no pierde el cursor): solo la banda, la orden y el botón
  function refrescarBanda(){
    const h = $('hojaNuevo'); if(!h || !N || N.F) return;
    const a = document.activeElement; const id = a && a.id; const pos = a && typeof a.selectionStart === 'number' ? a.selectionStart : null;
    pintarNuevo();
    const x = id && $(id); if(x){ x.focus(); if(pos !== null) try { x.setSelectionRange(pos, pos); } catch (e) { /* campo sin cursor */ } }
  }
  async function recargarNuevo(){ if(!N || !N.F) return; const mio = N; N.tocado = true; try { const F = await rpc('cliente_ficha', { p_cliente: N.F.cliente.id }); if(N === mio){ N.F = F; pintarNuevo(); } } catch (e) { toast(e.message, 'error'); } }
  async function crearCliente(parecido){
    if(!N || N.ocupado) return;
    N.rif = ($('nvRif') ? $('nvRif').value : N.rif || '').trim(); N.nombre = ($('nvNom') ? $('nvNom').value : N.nombre || '').trim(); N.eRif = ''; N.eNom = '';
    const dg = N.rif.replace(/\D/g, '').replace(/^0+/, '');
    if(!/^\d{5,10}$/.test(dg)) N.eRif = 'Escribe el RIF con la letra y los números, por ejemplo J-12345678-9';
    if(N.nombre.length < 3) N.eNom = 'Escribe la razón social o el nombre del cliente';
    if(N.eRif || N.eNom){ pintarNuevo(); return; }
    // Sin el selector Jurídico/Natural: la letra lo dice (V o E es persona; sin letra, J)
    const rif = /^[VEJGPC]/i.test(N.rif) ? N.rif : 'J-' + N.rif;
    N.ocupado = true; pintarNuevo(); const mio = N;
    try {
      let r;
      if(N.orden && parecido === undefined) r = await rpc('orden_cliente_rif', { p_orden: N.orden.orden_id, p_rif: rif, p_nombre: N.nombre });
      else r = await rpc('cliente_nuevo', { p_rif: rif, p_nombre: N.nombre, p_parecido: parecido === undefined ? null : parecido });
      if(N !== mio) return;
      N.ocupado = false;
      if(r && r.parecidos){ N.busq = { estado: 'nuevo', parecidos: r.parecidos }; pintarNuevo(); return; }
      N.creado = !!(r.creado || r.nuevo); N.unido = !!r.unido; N.tocado = true;
      toast(N.creado ? 'Cliente creado: sube sus documentos' : r.existe ? 'Ese RIF ya está en la app: subes sus documentos' : 'Listo: sube sus documentos');
      N.F = await rpc('cliente_ficha', { p_cliente: r.cliente_id }); if(N !== mio) return;
      pintarNuevo();
      // El archivo del RIF queda en su casilla al entrar al paso 2
      if(N.archivo && !N.rifSubido){ N.rifSubido = true; const nat = !!N.F.cliente.es_natural;
        const cas = N.esCedula ? ['cedula', 1] : nat ? ['rif_personal', 1] : ['rif_empresa', 0];
        window.Ficha.soltarA(N.F, cas[0], cas[1], [N.archivo], recargarNuevo); }
    } catch (e) { if(N !== mio) return; N.ocupado = false; N.eRif = e.message; pintarNuevo(); }
  }
  function clicNuevo(ev){
    const t = ev.target; let b;
    if(!N) return;
    if(t.closest('[data-nv-elegir]') || t.closest('[data-nv-cambiar]')){ const i = $('nvArchivo'); if(i){ i.value = ''; i.click(); } return; }
    if(t.closest('[data-nv-zona]') && !t.closest('button')){ const i = $('nvArchivo'); if(i){ i.value = ''; i.click(); } return; }
    if(t.closest('[data-nv-manual]')){ N.manual = true; pintarNuevo(); const x = $('nvRif'); if(x) x.focus(); return; }
    if(t.closest('[data-nv-rebuscar]')){ buscarApp(); return; }
    if((b = t.closest('[data-nv-abrir]'))){ window.Ficha.abrir(Number(b.dataset.nvAbrir), { yo: N.yo, tab: 'documentos' }); return; }
    if(t.closest('[data-nv-buscar]')){ N.buscando = !N.buscando; pintarNuevo(); if(N.buscando && !PI) cargarPI(); return; }
    if(t.closest('[data-nv-otra]')){ N.sinSug = true; N.buscando = true; pintarNuevo(); if(!PI) cargarPI(); return; }
    if(t.closest('[data-nv-sin-orden]')){ N.orden = null; N.sinSug = true; pintarNuevo(); return; }
    if((b = t.closest('[data-nv-orden]'))){ N.orden = ((PI && PI.filas) || []).find((x) => String(x.orden_id) === b.dataset.nvOrden) || null; N.buscando = false; if(N.orden && !N.nombre) N.nombre = N.orden.cliente || ''; pintarNuevo(); return; }
    if(t.closest('[data-nv-seguir]')){ crearCliente(); return; }
    if((b = t.closest('[data-nv-par]'))){ crearCliente(Number(b.dataset.nvPar)); return; }
    if(t.closest('[data-nv-otro]')){ const o = { yo: N.yo, alCambiar: N.alCambiar, alPendientes: N.alPendientes, tocado: N.tocado }; N = Object.assign({ orden: null, F: null }, o); pintarNuevo(); return; }
    if(t.closest('[data-nv-pend]')){ const f = N.alPendientes; cerrarHoja(); if(f) f(); else location.href = 'comisiones.html?f=pendientes'; return; }
    if(N.F && t.closest('[data-nv-varios]')){ window.Ficha.variosA(N.F, recargarNuevo); return; }
    if(N.F && t.closest('#docsNuevo')){
      if((b = t.closest('[data-subir]'))){ const p = b.dataset.subir.split(':'); window.Ficha.subirA(N.F, p[0], Number(p[1]), recargarNuevo); return; }
      if((b = t.closest('[data-campo]'))){ window.Ficha.editarCampo(N.F, b.dataset.campo, recargarNuevo); return; }
    }
    if(t.closest('[data-nv-guardar]')){ toast('Guardado: queda como Pendiente por instalar'); cerrarHoja(); return; }
    if((b = t.closest('[data-nv-enviar]')) && N.F){ b.disabled = true;
      rpc('cliente_nuevo_enviar', { p_cliente: N.F.cliente.id }).then(() => { N.enviado = new Date().toISOString(); N.tocado = true; pintarNuevo(); })
        .catch((e) => { toast(e.message, 'error'); if(document.contains(b)) b.disabled = false; }); }
  }
  // Mientras se sube desde aquí, la casilla dice "Subiendo"
  document.addEventListener('ficha-subida', () => { if(N && N.F && document.querySelector('#hojaNuevo.ver')) pintarNuevo(); });

  // ---------- Clientes instalados sin líder (antes "Sin líder") ----------
  function sinLider(o){
    const h = hoja('hojaSinLider', 'tSinLider');
    h.innerHTML = cab('tSinLider', 'Clientes instalados sin líder', 'Sin líder no comisionan ni salen en los números de nadie') + '<div class="hoja-cuerpo" id="cuerpoSinLider"></div>';
    abrirHoja('hojaSinLider');
    if(window.SinInstalar) window.SinInstalar.mostrar('sin_lider', $('cuerpoSinLider'), (o && o.yo) || null, '');
  }

  window.PorInstalar = { abrir: abrirPI, sinLider, recargar: cargarPI };
  window.ClienteNuevo = { abrir: abrirNuevo };
})();
