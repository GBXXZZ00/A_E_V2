// Lote 21/10: lo que se le hace a un cliente sin tocar su estatus, desde la fila de Clientes o desde su hoja.
// Etiqueta de gestión (Contactado, Sin contacto, Esperando documentos) con fecha y nota; cambiar líder y suspender (solo administrador).
// Todo pasa por funciones del servidor que revisan el permiso y dejan bitácora.
(function(){
  'use strict';
  const C = window.Comun;
  const { $, esc, ic, rpc, toast, abrirHoja, cerrarHoja, prepararHojas } = C;
  const GES = C.GESTION;
  let ctx = null;   // { tipo, cliente, alTerminar, F }

  function hoja(idHoja, idTitulo){
    let h = $(idHoja);
    if(!h){ h = document.createElement('section'); h.id = idHoja; h.className = 'hoja'; h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', idTitulo); h.setAttribute('aria-hidden', 'true'); document.body.appendChild(h); prepararHojas(); }
    return h;
  }
  const cab = (idT, t, sub) => '<div class="cab"><div><h2 id="' + idT + '">' + esc(t) + '</h2>' + (sub ? '<p class="sub-hoja">' + esc(sub) + '</p>' : '') + '</div><button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>';
  const hoy = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

  // ---------- Etiqueta de gestión: fecha y nota arriba, y un toque en la etiqueta la guarda ----------
  function etiquetar(cliente, alTerminar, actual){
    ctx = { tipo: 'etq', cliente: Number(cliente), alTerminar };
    const h = hoja('hojaEtq', 'tEtq');
    h.innerHTML = cab('tEtq', 'Etiqueta de gestión', 'No cambia el estatus. Toca la que corresponde') + '<form id="formEtq" novalidate>' +
      '<label class="rotulo" for="etqFecha">Fecha</label><input class="campo" id="etqFecha" type="date" value="' + esc(hoy()) + '"><div class="error" id="eEtqFecha" role="alert"></div>' +
      '<label class="rotulo arriba" for="etqNota">Nota (opcional)</label><input class="campo" id="etqNota" maxlength="300" autocomplete="off">' +
      '<div class="etq-op" role="group" aria-label="Etiqueta">' + Object.keys(GES).map((k) => '<button type="button" class="' + k + (actual && actual.e === k ? ' on' : '') + '" data-etq="' + k + '"><i aria-hidden="true"></i>' + esc(GES[k]) + '</button>').join('') + '</div>' +
      '<div class="error" id="eEtq" role="alert"></div></form>';
    abrirHoja('hojaEtq');
  }
  async function guardarEtq(b){
    if(!ctx || ctx.tipo !== 'etq') return;
    const f = $('etqFecha').value; $('eEtq').textContent = ''; $('eEtqFecha').textContent = '';
    if(!f){ $('eEtqFecha').textContent = 'Pon la fecha'; return; }
    const todos = document.querySelectorAll('#hojaEtq [data-etq]'); Array.prototype.forEach.call(todos, (x) => { x.disabled = true; });
    const k = b.dataset.etq; const c = ctx;
    try {
      await rpc('cliente_etiqueta', { p_cliente: c.cliente, p_etiqueta: k, p_fecha: f, p_nota: $('etqNota').value.trim() || null });
      toast('Etiqueta: ' + GES[k]); cerrarHoja(); ctx = null; if(c.alTerminar) c.alTerminar();
    } catch (e) { $('eEtq').textContent = e.message; toast(e.message, 'error'); Array.prototype.forEach.call(todos, (x) => { x.disabled = false; }); }
  }

  // ---------- Cambiar líder (PYME o del dedicado) ----------
  function lider(F, cual, alTerminar){
    if(!F || !F.puedo || !F.puedo.lider_cambiar) return;
    ctx = { tipo: 'lider', cliente: F.cliente.id, cual: cual === 'dedicado' ? 'dedicado' : 'pyme', alTerminar };
    const ls = F.lideres || []; const actual = ctx.cual === 'dedicado' ? ((F.cliente.dedicado || {}).ejecutiva || '') : (F.cliente.lider || '');
    const h = hoja('hojaLider', 'tLider');
    h.innerHTML = cab('tLider', ctx.cual === 'dedicado' ? 'Cambiar líder del dedicado' : 'Cambiar líder', F.cliente.nombre) + '<form id="formLider" novalidate>' +
      '<label class="rotulo" for="lidSel">Líder</label><select class="campo" id="lidSel"><option value="">Elige un líder</option>' +
        ls.map((x) => '<option value="' + esc(x.id) + '"' + (x.nombre === actual ? ' disabled' : '') + '>' + esc(x.nombre + (x.nombre === actual ? ' (actual)' : '')) + '</option>').join('') + '</select><div class="error" id="eLider" role="alert"></div>' +
      '<p class="nota">' + (ctx.cual === 'dedicado' ? 'El dedicado pasa a la lista de quien elijas.' : 'El cliente pasa a la lista de quien elijas. La comisión de las instalaciones ya cargadas no cambia de dueño.') + ' Queda en la bitácora.</p>' +
      '<div class="acciones"><button type="submit" class="btn btn-ancho" id="guardarLider">Cambiar líder</button></div></form>';
    abrirHoja('hojaLider');
  }
  async function guardarLider(e){
    e.preventDefault(); if(!ctx || ctx.tipo !== 'lider') return;
    const v = $('lidSel').value; $('eLider').textContent = '';
    if(!v){ $('eLider').textContent = 'Elige el líder nuevo'; return; }
    const b = $('guardarLider'); b.disabled = true; b.textContent = 'Guardando…'; const c = ctx;
    try { await rpc('cliente_lider_cambiar', { p_cliente: c.cliente, p_lider: v, p_cual: c.cual }); toast('Líder cambiado'); cerrarHoja(); ctx = null; if(c.alTerminar) c.alTerminar(); }
    catch (x) { $('eLider').textContent = x.message; toast(x.message, 'error'); b.disabled = false; b.textContent = 'Cambiar líder'; }
  }

  // ---------- Suspender o reactivar ----------
  function suspender(F, si, alTerminar){
    if(!F || !F.puedo || !F.puedo.suspender) return;
    ctx = { tipo: 'sus', cliente: F.cliente.id, si: !!si, alTerminar };
    const h = hoja('hojaSus', 'tSus');
    h.innerHTML = cab('tSus', si ? 'Marcar como suspendido' : 'Reactivar cliente', F.cliente.nombre) + '<form id="formSus" novalidate>' +
      (si ? '<label class="rotulo" for="susNota">Por qué se suspende</label><input class="campo" id="susNota" maxlength="300" autocomplete="off" data-foco><div class="error" id="eSus" role="alert"></div>' +
        '<p class="nota">No sale en la lista ni en los contadores (se ve con "Ver suspendidos"). Se le pueden seguir pidiendo documentos.</p>'
        : '<p class="nota" style="margin-top:0">Vuelve a la lista y a los contadores.' + (F.cliente.suspendido_nota ? ' Se suspendió por: ' + esc(F.cliente.suspendido_nota) + '.' : '') + '</p><div class="error" id="eSus" role="alert"></div>') +
      '<div class="acciones"><button type="submit" class="btn btn-ancho' + (si ? ' btn-peligro' : '') + '" id="guardarSus">' + (si ? 'Suspender' : 'Reactivar') + '</button></div></form>';
    abrirHoja('hojaSus');
  }
  async function guardarSus(e){
    e.preventDefault(); if(!ctx || ctx.tipo !== 'sus') return;
    const n = ctx.si ? $('susNota').value.trim() : null; $('eSus').textContent = '';
    if(ctx.si && n.length < 3){ $('eSus').textContent = 'Escribe por qué se suspende'; $('susNota').focus(); return; }
    const b = $('guardarSus'); b.disabled = true; b.textContent = 'Guardando…'; const c = ctx;
    try { await rpc('cliente_suspender', { p_cliente: c.cliente, p_suspender: c.si, p_nota: n }); toast(c.si ? 'Cliente suspendido' : 'Cliente reactivado'); cerrarHoja(); ctx = null; if(c.alTerminar) c.alTerminar(); }
    catch (x) { $('eSus').textContent = x.message; toast(x.message, 'error'); b.disabled = false; b.textContent = c.si ? 'Suspender' : 'Reactivar'; }
  }


  // ---------- Lote 05/11 F1-F2: registrar un dedicado nuevo (antes de que exista en el TAD) ----------
  let reloj = null; let datos = null;
  function registrarDedicado(o){
    ctx = { tipo: 'ded', yo: o.yo, alCrear: o.alCrear, tipoDed: o.tipo === 'isp' ? 'isp' : o.tipo === 'corporativo' ? 'corporativo' : '' }; datos = null;
    const h = hoja('hojaDedNuevo', 'tDedNuevo'); const esLider = o.yo && o.yo.rol === 'lider';
    h.innerHTML = cab('tDedNuevo', 'Registrar dedicado nuevo', 'Para adelantar documentos y contrato') + '<form id="formDedNuevo" novalidate>' +
      '<label class="rotulo" for="dnRif">RIF</label><input class="campo" id="dnRif" maxlength="14" autocomplete="off" inputmode="text" value="' + esc(o.rif || '') + '" data-foco><div class="error" id="eDnRif" role="alert"></div><p class="nota" id="dnRifNota" aria-live="polite"></p>' +
      '<label class="rotulo arriba" for="dnNom">Razón social</label><input class="campo" id="dnNom" maxlength="200" autocomplete="off"><div class="error" id="eDnNom" role="alert"></div>' +
      '<div class="rotulo arriba" id="dnTipoT">Tipo</div><div class="dp-modos" role="group" aria-labelledby="dnTipoT">' +
        '<button type="button" class="dp-modo' + (ctx.tipoDed === 'isp' ? ' on' : '') + '" data-dn-tipo="isp" aria-pressed="' + (ctx.tipoDed === 'isp') + '"><b>ISP</b></button>' +
        '<button type="button" class="dp-modo' + (ctx.tipoDed === 'corporativo' ? ' on' : '') + '" data-dn-tipo="corporativo" aria-pressed="' + (ctx.tipoDed === 'corporativo') + '"><b>Corporativo</b></button></div>' +
      '<div class="error" id="eDnTipo" role="alert"></div><p class="nota" id="dnTipoNota">' + (ctx.tipoDed === 'isp' ? 'ISP pide además el permiso de Conatel.' : '') + '</p>' +
      (esLider ? '<p class="nota">Líder: tú.</p>' : '<label class="rotulo arriba" for="dnLider">Líder</label><select class="campo" id="dnLider"><option value="">Cargando…</option></select><div class="error" id="eDnLider" role="alert"></div>') +
      '<label class="rotulo arriba" for="dnSrv">Servicio a contratar (opcional)</label><input class="campo" id="dnSrv" maxlength="200" autocomplete="off">' +
      '<div class="acciones"><button type="submit" class="btn btn-ancho" id="guardarDedNuevo">Registrar y subir documentos</button></div>' +
      '<p class="nota">Se abre su expediente en la pestaña Documentos, igual que cualquier cliente.</p></form>';
    abrirHoja('hojaDedNuevo');
    revisarRif(true);
  }
  async function revisarRif(conLideres){
    const v = ($('dnRif') || {}).value || ''; const nota = $('dnRifNota'); const dig = v.replace(/\D/g, '');
    if(!conLideres && dig.length < 5){ if(nota) nota.innerHTML = ''; return; }
    try {
      const d = await rpc('dedicado_registro_datos', { p_rif: dig.length >= 5 ? v : null });
      if(!$('formDedNuevo')) return; datos = d;
      if(conLideres && $('dnLider')) $('dnLider').innerHTML = '<option value="">Elige el líder</option>' + (d.lideres || []).map((x) => '<option value="' + esc(x.id) + '">' + esc(x.nombre) + '</option>').join('');
      const e = d.existe;
      nota.innerHTML = dig.length < 5 ? '' : !e ? 'No existe en la app. Puedes seguir.'
        : e.puedo ? '<b>Ya existe: ' + esc(e.nombre || '') + '.</b> <button type="button" class="enlace" data-dn-abrir="' + esc(e.id) + '">Abrir su expediente</button>'
        : '<b>Ese RIF ya es un cliente' + (e.lider ? ' de ' + esc(e.lider) : '') + '.</b> Pídele al administrador que lo revise.';
    } catch (x) { if(nota) nota.textContent = x.message; }
  }
  async function guardarDed(e){
    e.preventDefault(); if(!ctx || ctx.tipo !== 'ded') return;
    ['eDnRif', 'eDnNom', 'eDnTipo', 'eDnLider'].forEach((k) => { if($(k)) $(k).textContent = ''; });
    const rif = $('dnRif').value.trim(); const nom = $('dnNom').value.trim(); const lid = $('dnLider') ? $('dnLider').value : null;
    let mal = false;
    if(rif.replace(/\D/g, '').length < 5){ $('eDnRif').textContent = 'Escribe el RIF de la empresa'; mal = true; }
    if(datos && datos.existe){ $('eDnRif').textContent = 'Ese RIF ya existe en la app'; mal = true; }
    if(nom.length < 3){ $('eDnNom').textContent = 'Escribe la razón social'; mal = true; }
    if(!ctx.tipoDed){ $('eDnTipo').textContent = 'Elige si es ISP o corporativo'; mal = true; }
    if($('dnLider') && !lid){ $('eDnLider').textContent = 'Elige el líder'; mal = true; }
    if(mal) return;
    const b = $('guardarDedNuevo'); b.disabled = true; b.textContent = 'Registrando…'; const c = ctx;
    try {
      const r = await rpc('dedicado_registrar', { p_rif: rif, p_nombre: nom, p_tipo: c.tipoDed, p_lider: lid || null, p_servicio: $('dnSrv').value.trim() || null });
      toast('Dedicado registrado. Sube sus documentos'); cerrarHoja(); ctx = null; if(c.alCrear) c.alCrear(r.cliente_id);
    } catch (x) { $('eDnRif').textContent = x.message; toast(x.message, 'error'); b.disabled = false; b.textContent = 'Registrar y subir documentos'; }
  }
  document.addEventListener('input', (e) => { if(e.target && e.target.id === 'dnRif'){ clearTimeout(reloj); datos = null; reloj = setTimeout(() => revisarRif(false), 400); } });
  document.addEventListener('click', (e) => {
    let b = e.target.closest('#hojaDedNuevo [data-dn-tipo]');
    if(b && ctx && ctx.tipo === 'ded'){ ctx.tipoDed = b.dataset.dnTipo; Array.prototype.forEach.call(document.querySelectorAll('#hojaDedNuevo [data-dn-tipo]'), (x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
      $('dnTipoNota').textContent = ctx.tipoDed === 'isp' ? 'ISP pide además el permiso de Conatel.' : ''; return; }
    b = e.target.closest('#hojaDedNuevo [data-dn-abrir]');
    if(b && ctx){ const c = ctx; cerrarHoja(); ctx = null; if(c.alCrear) c.alCrear(Number(b.dataset.dnAbrir)); }
  });

  document.addEventListener('click', (e) => { const b = e.target.closest('#hojaEtq [data-etq]'); if(b){ e.preventDefault(); guardarEtq(b); } });
  document.addEventListener('submit', (e) => {
    if(e.target.id === 'formEtq') e.preventDefault();
    else if(e.target.id === 'formLider') guardarLider(e);
    else if(e.target.id === 'formSus') guardarSus(e);
    else if(e.target.id === 'formDedNuevo') guardarDed(e);
  });

  window.Gestion = { etiquetar, lider, suspender, registrarDedicado };
})();
