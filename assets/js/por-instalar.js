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

  // ---------- Subir documentos de un cliente nuevo ----------
  let N = null;
  function pasos(){
    const p = [['Orden (opcional)', !!N.orden || !!N.F], ['Cliente y documentos', !!N.F && !(N.F.faltantes || []).length], ['Enviar', !!N.enviado]];
    const act = N.enviado ? 3 : N.F ? 2 : 1;
    return '<ol class="nv-pasos">' + p.map((x, i) => '<li class="' + (i + 1 < act || x[1] ? 'hecho' : i + 1 === act ? 'on' : '') + '"><i>' + (i + 1 < act || (x[1] && i + 1 !== act) ? ic('check') : i + 1) + '</i>' + esc(x[0]) + '</li>').join('') + '</ol>';
  }
  function pintarNuevo(){
    const h = hoja('hojaNuevo', 'tNuevo'); if(!N) return;
    let c = pasos();
    // Orden (opcional)
    if(N.orden) c += '<div class="nv-orden"><span><b>Orden ' + esc(ordenCorta(N.orden.numero)) + ' · ' + esc(N.orden.lider || 'Por asignar') + '</b><small>' + esc((N.orden.cliente || 'Sin cliente en la app') + ' · creada ' + diaMes(N.orden.creada_en)) + '</small></span>' +
      (N.F ? '' : '<button type="button" class="enlace" data-nv-sin-orden>Quitar</button>') + '</div>';
    else if(!N.F) c += '<div class="nv-orden sin"><span><b>Sin orden de Odoo por ahora</b><small>Se une sola cuando la orden aparezca en Odoo o la instalación en el TAD</small></span><button type="button" class="enlace" data-nv-buscar>' + (N.buscando ? 'Cerrar' : 'Buscar orden') + '</button></div>';
    if(N.buscando && !N.F){
      const q = normalizeStr(N.qo || ''); const libres = ((PI && PI.filas) || []).filter((o) => !o.en_app && (!q || normalizeStr([o.cliente, o.titulo, o.numero].join(' ')).indexOf(q) >= 0)).slice(0, 8);
      c += '<label class="rotulo arriba" for="nvBuscaO">Buscar la orden</label><input class="campo" id="nvBuscaO" type="search" maxlength="60" autocomplete="off" value="' + esc(N.qo || '') + '">' +
        (!PI ? esqueleto(2) : libres.length ? libres.map((o) => '<button type="button" class="fila" data-nv-orden="' + esc(o.orden_id) + '"><span class="tx"><b>' + esc(ordenCorta(o.numero) + ' · ' + (o.cliente || 'Sin nombre')) + '</b><small>' + esc((o.lider || 'Por asignar') + ' · creada ' + diaMes(o.creada_en)) + '</small></span>' + ic('derecha', 'ch') + '</button>').join('')
          : '<p class="nota-chica">Ninguna orden sin cliente coincide. Sigue sin orden: se une sola después.</p>');
    }
    if(!N.F){
      const nat = !!N.natural;
      c += '<div class="tres nv-tipo" role="radiogroup" aria-label="Tipo de cliente">' + [['j', 'Jurídico', !nat], ['n', 'Natural', nat]].map((x) => '<button type="button" role="radio" data-nv-tipo="' + x[0] + '" aria-checked="' + x[2] + '" class="' + (x[2] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div>' +
        '<div class="pi-2"><div><label class="rotulo" for="nvRif">' + (nat ? 'Cédula' : 'RIF') + '</label><input class="campo" id="nvRif" maxlength="20" autocomplete="off" value="' + esc(N.rif || '') + '"><div class="error" id="eNvRif" role="alert">' + esc(N.eRif || '') + '</div></div>' +
        '<div><label class="rotulo" for="nvNom">Posible nombre del cliente</label><input class="campo" id="nvNom" maxlength="200" autocomplete="off" value="' + esc(N.nombre || '') + '"><div class="error" id="eNvNom" role="alert">' + esc(N.eNom || '') + '</div></div></div>';
      if(N.parecidos) c += '<div class="estado ambar"><b>¿Es este cliente?</b><small>Hay un cliente provisional con un nombre parecido. Si es el mismo, sus documentos y su orden se juntan.</small></div>' +
        N.parecidos.map((p) => '<div class="ins-acc"><span><b>' + esc(p.nombre) + '</b> · ' + esc(p.lider) + '</span><button type="button" class="mini pri" data-nv-par="' + esc(p.id) + '">Sí, es este</button></div>').join('') +
        '<div class="ins-acc"><span>Ninguno es</span><button type="button" class="mini" data-nv-par="0">No, es otro: crear</button></div>';
      else c += '<div class="acciones"><button type="button" class="btn btn-ancho" data-nv-seguir' + (N.ocupado ? ' disabled' : '') + '>' + (N.ocupado ? 'Buscando…' : 'Continuar') + '</button></div>' +
        '<p class="nota-chica">Si el RIF no existe en la app, se crea el cliente al continuar.</p>';
      h.innerHTML = cab('tNuevo', 'Subir documentos de un cliente nuevo', 'Queda como "Pendiente por instalar" hasta que el TAD traiga la instalación') + '<div class="hoja-cuerpo">' + c + '</div>';
      return;
    }
    const F = N.F; const fal = F.faltantes || [];
    const listos = (F.documentos || []).filter((x) => x.estado !== 'devuelto' && (x.archivos || []).length).length;
    const tot = listos + fal.length;
    c += '<div class="si-cli"><b>' + esc(F.cliente.nombre) + '</b><small>' + esc(C.docFmt(F.cliente.doc_tipo, F.cliente.doc_numero)) + ' · ' + esc(N.creado ? 'No existía en la app: se creó' : N.unido ? 'Se unió al cliente provisional' : 'Ya estaba en la app') + '</small></div>' +
      '<button type="button" class="nv-zona" data-nv-varios><b>Arrastra aquí varios archivos a la vez</b><span>Después marcas qué trae cada uno. También puedes subir casilla por casilla.</span></button>' +
      '<div id="docsNuevo">' + window.Ficha.documentosPara(F) + '</div>';
    const pie = '<div class="hoja-pie col"><p><b>' + listos + ' de ' + tot + ' listos.</b> ' + (fal.length ? 'Faltan: ' + esc(C.lista ? C.lista(fal) : fal.join(', ')) + '.' : 'Ya está todo.') + '</p>' +
      '<span class="nv-barra" aria-hidden="true"><i style="transform:scaleX(' + (tot ? (listos / tot).toFixed(3) : 0) + ')"></i></span>' +
      '<div class="nv-acc"><button type="button" class="btn btn-2" data-nv-guardar>Guardar lo que llevo</button><button type="button" class="btn" data-nv-enviar' + (fal.length || N.enviado ? ' disabled' : '') + '>' + (N.enviado ? 'Enviado a revisión' : 'Enviar a revisión') + '</button></div>' +
      '<p>"Enviar a revisión" se activa cuando esté todo. Lo guardado ya aparece en la lista del líder como "Pendiente por instalar · documentos subidos".</p></div>';
    h.innerHTML = cab('tNuevo', 'Subir documentos de un cliente nuevo', 'Queda como "Pendiente por instalar" hasta que el TAD traiga la instalación') + '<div class="hoja-cuerpo">' + c + '</div>' + pie;
  }
  function abrirNuevo(o){
    window.Ficha.montar();
    N = Object.assign({ orden: null, F: null, natural: false }, o || {});
    if(N.orden && N.orden.cliente && !N.nombre) N.nombre = N.orden.cliente;
    pintarNuevo(); abrirHoja('hojaNuevo');
    if(!PI) cargarPI();
    const h = $('hojaNuevo');
    if(!h.dataset.listo){ h.dataset.listo = '1';
      h.addEventListener('click', clicNuevo);
      h.addEventListener('input', (ev) => { if(!N) return; if(ev.target.id === 'nvRif') N.rif = ev.target.value; if(ev.target.id === 'nvNom') N.nombre = ev.target.value;
        if(ev.target.id === 'nvBuscaO'){ N.qo = ev.target.value; clearTimeout(N.tb); N.tb = setTimeout(() => { pintarNuevo(); const x = $('nvBuscaO'); if(x){ x.focus(); x.setSelectionRange(x.value.length, x.value.length); } }, 160); } });
      h.addEventListener('dragover', (ev) => { if(N && N.F){ ev.preventDefault(); const z = ev.target.closest('[data-suelta]') || ev.target.closest('.nv-zona'); h.querySelectorAll('.sobre').forEach((x) => x.classList.remove('sobre')); if(z) z.classList.add('sobre'); } });
      h.addEventListener('dragleave', (ev) => { if(!h.contains(ev.relatedTarget)) h.querySelectorAll('.sobre').forEach((x) => x.classList.remove('sobre')); });
      h.addEventListener('drop', (ev) => { if(!N || !N.F) return; ev.preventDefault(); h.querySelectorAll('.sobre').forEach((x) => x.classList.remove('sobre'));
        const files = Array.prototype.slice.call((ev.dataTransfer && ev.dataTransfer.files) || []); if(!files.length) return;
        const c = ev.target.closest('[data-suelta]'); if(c){ const p = c.dataset.casilla.split(':'); window.Ficha.soltarA(N.F, p[0], Number(p[1]), files, recargarNuevo); } else window.Ficha.variosA(N.F, recargarNuevo, files); });
      h.addEventListener('hoja-cerrada', () => { const f = N && N.alCambiar; const t = N && N.tocado; N = null; if(t && f) f(); });
    }
  }
  async function recargarNuevo(){ if(!N || !N.F) return; const mio = N; N.tocado = true; try { const F = await rpc('cliente_ficha', { p_cliente: N.F.cliente.id }); if(N === mio){ N.F = F; pintarNuevo(); } } catch (e) { toast(e.message, 'error'); } }
  async function crearCliente(parecido){
    if(!N || N.ocupado) return;
    N.rif = ($('nvRif') ? $('nvRif').value : N.rif || '').trim(); N.nombre = ($('nvNom') ? $('nvNom').value : N.nombre || '').trim(); N.eRif = ''; N.eNom = '';
    const dg = N.rif.replace(/\D/g, '').replace(/^0+/, '');
    if(!/^\d{5,10}$/.test(dg)) N.eRif = N.natural ? 'Escribe la cédula, solo con números' : 'Escribe el RIF con la letra y los números, por ejemplo J-12345678-9';
    if(N.nombre.length < 3) N.eNom = 'Escribe el posible nombre del cliente';
    if(N.eRif || N.eNom){ pintarNuevo(); return; }
    const rif = /^[VEJGPC]/i.test(N.rif) ? N.rif : (N.natural ? 'V' : 'J') + '-' + N.rif;
    N.ocupado = true; pintarNuevo(); const mio = N;
    try {
      let r;
      if(N.orden && parecido === undefined) r = await rpc('orden_cliente_rif', { p_orden: N.orden.orden_id, p_rif: rif, p_nombre: N.nombre });
      else r = await rpc('cliente_nuevo', { p_rif: rif, p_nombre: N.nombre, p_parecido: parecido === undefined ? null : parecido });
      if(N !== mio) return;
      N.ocupado = false;
      if(r && r.parecidos){ N.parecidos = r.parecidos; pintarNuevo(); return; }
      N.parecidos = null; N.creado = !!(r.creado || r.nuevo); N.unido = !!r.unido; N.tocado = true;
      toast(N.creado ? 'Cliente creado: ya puedes subir sus documentos' : r.existe ? 'Ese RIF ya está en la app: subes sus documentos' : 'Listo: sube sus documentos');
      N.F = await rpc('cliente_ficha', { p_cliente: r.cliente_id }); if(N === mio) pintarNuevo();
    } catch (e) { if(N !== mio) return; N.ocupado = false; N.eRif = e.message; pintarNuevo(); }
  }
  function clicNuevo(ev){
    const t = ev.target; let b;
    if(!N) return;
    if((b = t.closest('[data-nv-tipo]'))){ N.natural = b.dataset.nvTipo === 'n'; pintarNuevo(); return; }
    if(t.closest('[data-nv-buscar]')){ N.buscando = !N.buscando; pintarNuevo(); if(N.buscando && !PI) cargarPI(); return; }
    if(t.closest('[data-nv-sin-orden]')){ N.orden = null; pintarNuevo(); return; }
    if((b = t.closest('[data-nv-orden]'))){ N.orden = ((PI && PI.filas) || []).find((x) => String(x.orden_id) === b.dataset.nvOrden) || null; N.buscando = false; if(N.orden && !N.nombre) N.nombre = N.orden.cliente || ''; pintarNuevo(); return; }
    if(t.closest('[data-nv-seguir]')){ crearCliente(); return; }
    if((b = t.closest('[data-nv-par]'))){ crearCliente(Number(b.dataset.nvPar)); return; }
    if(N.F && t.closest('[data-nv-varios]')){ window.Ficha.variosA(N.F, recargarNuevo); return; }
    if(N.F && t.closest('#docsNuevo')){
      if((b = t.closest('[data-subir]'))){ const p = b.dataset.subir.split(':'); window.Ficha.subirA(N.F, p[0], Number(p[1]), recargarNuevo); return; }
      if((b = t.closest('[data-campo]'))){ window.Ficha.editarCampo(N.F, b.dataset.campo, recargarNuevo); return; }
    }
    if(t.closest('[data-nv-guardar]')){ toast('Guardado: queda como Pendiente por instalar'); cerrarHoja(); return; }
    if((b = t.closest('[data-nv-enviar]')) && N.F){ b.disabled = true;
      rpc('cliente_nuevo_enviar', { p_cliente: N.F.cliente.id }).then(() => { N.enviado = true; N.tocado = true; toast('Enviado a revisión: los documentos quedaron en la bandeja del administrador'); pintarNuevo(); })
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
