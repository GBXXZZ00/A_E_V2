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

  document.addEventListener('click', (e) => { const b = e.target.closest('#hojaEtq [data-etq]'); if(b){ e.preventDefault(); guardarEtq(b); } });
  document.addEventListener('submit', (e) => {
    if(e.target.id === 'formEtq') e.preventDefault();
    else if(e.target.id === 'formLider') guardarLider(e);
    else if(e.target.id === 'formSus') guardarSus(e);
  });

  window.Gestion = { etiquetar, lider, suspender };
})();
