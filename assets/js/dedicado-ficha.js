// Expediente de un cliente dedicado: enlaces y contactos de la empresa (en Datos), contratos (pestaña Contratos)
// y lo que solo el administrador cambia (ruta, verificar, contratos), siempre con bitácora en el servidor.
(function(){
  'use strict';
  const C = window.Comun;
  const { $, esc, ic, rpc, toast, fecha, abrirHoja, cerrarHoja, prepararHojas } = C;

  const RUTAS = { cargar: 'Cargar a la app (ya se recibieron)', completar: 'Revisar y completar en la app', pedir: 'Pedir al cliente', validar: 'Validar con la analista dónde están' };
  const CONTRATO = {
    sin_contrato: ['', 'Sin contrato'], en_elaboracion: ['morado', 'En elaboración'], por_firmar: ['ambar', 'Por firmar'], firmado: ['verde', 'Firmado'],
    actualizar: ['rojo', 'Actualizar y volver a firmar'], del_cliente: ['azul', 'Lo pone el cliente'], por_confirmar: ['ambar', 'Firmado por confirmar']
  };
  const AREA = { presidencia: 'Presidencia', administracion: 'Administración', tecnologia: 'Tecnología', empresa: 'Correo de la empresa' };
  const TIPO_CTR = { servicio: 'Contrato de servicio', vgt: 'VGT', colocation: 'Colocation' };
  let F = null; let yo = null; let editando = null;

  const esAdmin = () => !!yo && yo.rol === 'admin';
  const chip = (e) => { const x = CONTRATO[e] || ['', e || 'Sin dato']; return '<span class="chip ' + x[0] + '">' + esc(x[1]) + '</span>'; };
  const fila = (etq, valor) => '<div class="dato-f"><span>' + esc(etq) + '</span><b>' + valor + '</b></div>';
  const num = (n) => (n === null || n === undefined || n === '' ? '' : Number(n).toLocaleString('es-VE', { maximumFractionDigits: 2 }));
  const cap = (n) => { const v = Number(n); if(!n && n !== 0) return ''; return v >= 1000 ? num(v / 1000) + ' Gbps' : num(v) + ' Mbps'; };
  const tel = (t) => { const d = String(t || '').replace(/\D/g, ''); return d.length === 11 ? d.slice(0, 4) + '-' + d.slice(4) : d; };

  // ---------- Datos: el resumen del dedicado, sus enlaces y los contactos de la empresa ----------
  function datos(ficha, quien){
    F = ficha; yo = quien || yo; const D = F.cliente.dedicado; if(!D) return '';
    const activos = (D.enlaces || []).filter((e) => e.activo);
    let h = '';
    if(D.verificar) h += '<div class="al-banda ambar" role="note"><b>Pendiente por verificar</b><p>' + esc(D.verificar_motivo || 'Revisar el RIF de este cliente.') + ' Igual se pueden subir sus documentos.</p></div>';
    h += '<div class="secc">Dedicado' + (esAdmin() ? '<button type="button" class="enlace der" data-ded-editar="1">Editar</button>' : '') + '</div><div class="datos">' +
      fila('Tipo', D.tipo === 'isp' ? 'Dedicado ISP' : 'Dedicado corporativo') +
      fila('Ejecutiva', esc(D.ejecutiva || 'Sin asignar')) +
      fila('Documentos', D.vacias ? '<span class="chip ambar">' + esc(D.vacias === 1 ? 'Falta 1' : 'Faltan ' + D.vacias) + '</span> ' + esc(RUTAS[D.ruta_documentos] || 'Sin ruta') : '<span class="chip verde">Completos</span>') +
      (D.tipo === 'isp' && D.plazo ? fila('Plazo ISP', esc('Semana del ' + ddmm(addDias(D.plazo, -4)))) : '') +
      fila('Contrato', esc(D.ruta_contrato || 'Sin siguiente paso')) +
      (D.estatus_anterior ? fila('App vieja', esc(C.capital(String(D.estatus_anterior).toLowerCase())) + ' <small class="ded-gris">no confiable</small>') : '') +
      (F.puedo && F.puedo.estatus ? fila('Estatus legal', C.chipEstatus(F.cliente.estatus) + '<button type="button" class="enlace" data-paso="estatus">Cambiar</button>') : '') +
      '</div>';
    if(D.feedback || D.observacion) h += '<p class="nota-chica ded-nota">' + esc([D.feedback, D.observacion].filter(Boolean).join('. ')) + '</p>';

    h += '<div class="secc">Enlaces<span class="der">' + esc(activos.length + ' activos de ' + (D.enlaces || []).length) + '</span></div>';
    if(!(D.enlaces || []).length) h += '<p class="nota-chica">Sin enlaces en el archivo de la analista ni en Odoo.</p>';
    else h += '<div class="ded-enl">' + D.enlaces.map(enlace).join('') + '</div>';

    h += '<div class="secc">Contactos de la empresa<span class="der">No son del representante legal</span></div>';
    if(!(D.contactos || []).length) h += '<p class="nota-chica">Sin contactos en el archivo de la analista.</p>';
    else h += '<div class="datos">' + D.contactos.map((k) => fila(AREA[k.area] || k.area,
      esc(k.nombre || '') + (k.telefono ? ' <a class="enlace" href="tel:' + esc(String(k.telefono).replace(/\D/g, '')) + '">' + esc(tel(k.telefono)) + '</a>' : '') +
      (k.correo ? ' <a class="enlace" href="mailto:' + esc(k.correo) + '">' + esc(k.correo) + '</a>' : ''))).join('') + '</div>';
    return h;
  }
  const ddmm = (iso) => String(iso).slice(8, 10) + '/' + String(iso).slice(5, 7);
  function addDias(iso, n){ const d = new Date(String(iso).slice(0, 10) + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function enlace(e){
    const caps = [e.cap_entregada !== null && e.cap_entregada !== undefined ? 'Entregada ' + cap(e.cap_entregada) : '', e.cap_facturada !== null && e.cap_facturada !== undefined && e.cap_facturada !== e.cap_entregada ? 'facturada ' + cap(e.cap_facturada) : '',
      e.cap_regalia ? 'regalía ' + cap(e.cap_regalia) : ''].filter(Boolean).join(', ');
    const lugar = [e.municipio, e.estado].filter(Boolean).join(', ');
    return '<div class="ded-e' + (e.activo ? '' : ' apagado') + '"><div class="ded-e1"><b>' + esc(e.nodo || 'Sin nodo') + '</b>' +
      '<span class="chip ' + (e.activo ? 'verde' : '') + '">' + (e.activo ? 'Activo' : 'Suspendido') + '</span></div>' +
      '<small>' + esc([e.servicio === 'transporte' ? 'Transporte' : e.servicio === 'internet' ? 'Internet' : '', e.codigo ? e.codigo.replace(/^CRM-SRV-AIRTEK-/, '') : 'Sin código de enlace', e.infraestructura].filter(Boolean).join(' · ')) + '</small>' +
      (caps || e.tarifa !== null ? '<small>' + esc([caps, e.tarifa !== null && e.tarifa !== undefined ? 'Tarifa ' + num(e.tarifa) : ''].filter(Boolean).join(' · ')) + '</small>' : '') +
      (lugar || e.inicio ? '<small>' + esc([lugar, e.inicio ? 'Inicio según la analista: ' + e.inicio : ''].filter(Boolean).join(' · ')) + '</small>' : '') + '</div>';
  }

  // ---------- Contratos: servicio (uno por cliente), VGT por proyecto y colocation por sitio ----------
  function contratos(ficha, quien){
    F = ficha; yo = quien || yo; const D = F.cliente.dedicado; if(!D) return '';
    const lista = D.contratos || []; let h = '<p class="nota-chica" style="margin-top:12px">Los dedicados no comisionan. El vencimiento se escribe a mano mientras se define la duración de los contratos.</p>';
    if(!lista.length) return h + C.vacio('Sin contratos', 'Este dedicado todavía no tiene contratos cargados.');
    ['servicio', 'vgt', 'colocation'].forEach((t) => {
      const xs = lista.filter((k) => k.tipo === t); if(!xs.length) return;
      h += '<div class="secc">' + esc(TIPO_CTR[t]) + (xs.length > 1 ? '<span class="der">' + xs.length + '</span>' : '') + '</div>';
      xs.forEach((k) => {
        const det = t === 'vgt' ? [k.proyecto, k.numero ? 'N° ' + k.numero : '', k.postes ? k.postes + ' postes' : '', k.fecha ? 'Fecha ' + k.fecha : '', k.estado].filter(Boolean).join(' · ')
          : t === 'colocation' ? [k.sitio, k.municipio, k.estado].filter(Boolean).join(' · ') : (k.nota || '');
        h += '<div class="datos">' + fila('Estatus', chip(k.estatus) + (esAdmin() ? '<button type="button" class="enlace" data-ctr-editar="' + esc(k.id) + '">Editar</button>' : '')) +
          (det ? fila(t === 'servicio' ? 'Nota' : 'Detalle', esc(det)) : '') +
          fila('Firma', k.firmado_en ? esc(fecha(k.firmado_en)) : '<span class="ded-gris">Sin fecha</span>') +
          fila('Vence', k.vence ? esc(k.vence) : '<span class="ded-gris">Sin escribir</span>') +
          (k.editado_por ? fila('Cambió', esc(k.editado_por + (k.editado_en ? ', ' + fecha(k.editado_en) : ''))) : '') + '</div>';
      });
    });
    return h;
  }

  // ---------- Hojas de edición (solo administrador) ----------
  function hoja(idHoja, idTitulo){
    let h = $(idHoja);
    if(!h){ h = document.createElement('section'); h.id = idHoja; h.className = 'hoja'; h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', idTitulo); h.setAttribute('aria-hidden', 'true'); document.body.appendChild(h); prepararHojas(); }
    return h;
  }
  const cab = (idT, t, sub) => '<div class="cab"><div><h2 id="' + idT + '">' + esc(t) + '</h2>' + (sub ? '<p class="sub-hoja">' + esc(sub) + '</p>' : '') + '</div><button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>';
  function abrirEditar(){
    const D = F && F.cliente.dedicado; if(!D || !esAdmin()) return;
    editando = { tipo: 'ded', cliente: F.cliente.id };
    const h = hoja('hojaDed', 'tDed');
    h.innerHTML = cab('tDed', 'Dedicado', F.cliente.nombre) + '<form id="formDed" novalidate>' +
      '<span class="rotulo">Tipo</span><div class="tres dos" role="radiogroup" aria-label="Tipo">' + [['isp', 'ISP'], ['corporativo', 'Corporativo']].map((x) =>
        '<button type="button" role="radio" data-ded-tipo="' + x[0] + '" aria-checked="' + (D.tipo === x[0]) + '" class="' + (D.tipo === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div>' +
      '<label class="rotulo arriba" for="dRuta">Ruta de documentos</label><select class="campo" id="dRuta"><option value="">Sin ruta</option>' +
        Object.keys(RUTAS).map((k) => '<option value="' + k + '"' + (D.ruta_documentos === k ? ' selected' : '') + '>' + esc(RUTAS[k]) + '</option>').join('') + '</select>' +
      '<label class="rotulo arriba" for="dCtr">Siguiente paso del contrato</label><input class="campo" id="dCtr" maxlength="300" autocomplete="off" value="' + esc(D.ruta_contrato || '') + '">' +
      '<label class="rotulo arriba" for="dPlazo">Plazo de documentos</label><input class="campo" id="dPlazo" type="date" value="' + esc(D.plazo || '') + '">' +
      '<div class="interr" style="margin-top:14px"><span class="tx">Pendiente por verificar<small>RIF repetido, distinto o duplicado</small></span><button type="button" class="sw" role="switch" id="dVer" aria-checked="' + !!D.verificar + '" aria-label="Pendiente por verificar"></button></div>' +
      '<label class="rotulo arriba" for="dMot">Qué hay que verificar</label><input class="campo" id="dMot" maxlength="300" autocomplete="off" value="' + esc(D.verificar_motivo || '') + '">' +
      '<div class="error" id="eDed" role="alert"></div><div class="acciones"><button type="submit" class="btn btn-ancho" id="guardarDed">Guardar</button></div></form>';
    abrirHoja('hojaDed');
  }
  function abrirContrato(idCtr){
    const D = F && F.cliente.dedicado; const k = D && (D.contratos || []).find((x) => String(x.id) === String(idCtr)); if(!k || !esAdmin()) return;
    editando = { tipo: 'ctr', id: k.id };
    const h = hoja('hojaCtr', 'tCtr');
    h.innerHTML = cab('tCtr', TIPO_CTR[k.tipo] || 'Contrato', F.cliente.nombre + (k.proyecto ? ' · ' + k.proyecto : k.sitio ? ' · ' + k.sitio : '')) + '<form id="formCtr" novalidate>' +
      '<label class="rotulo" for="kEst">Estatus</label><select class="campo" id="kEst">' + Object.keys(CONTRATO).map((e) => '<option value="' + e + '"' + (k.estatus === e ? ' selected' : '') + '>' + esc(CONTRATO[e][1]) + '</option>').join('') + '</select>' +
      '<label class="rotulo arriba" for="kFirma">Fecha de firma</label><input class="campo" id="kFirma" type="date" max="' + esc(new Date().toISOString().slice(0, 10)) + '" value="' + esc(k.firmado_en || '') + '"><div class="error" id="eFirma" role="alert"></div>' +
      '<label class="rotulo arriba" for="kVence">Vencimiento</label><input class="campo" id="kVence" maxlength="120" autocomplete="off" value="' + esc(k.vence || '') + '"><p class="nota">Escríbelo como esté en el contrato, por ejemplo "12 meses desde la firma".</p>' +
      '<label class="rotulo arriba" for="kNota">Nota</label><input class="campo" id="kNota" maxlength="500" autocomplete="off" value="' + esc(k.nota || '') + '">' +
      '<div class="error" id="eCtr" role="alert"></div><div class="acciones"><button type="submit" class="btn btn-ancho" id="guardarCtr">Guardar</button></div></form>';
    abrirHoja('hojaCtr');
  }
  async function guardar(e){
    e.preventDefault(); if(!editando) return;
    const esDed = editando.tipo === 'ded'; const b = $(esDed ? 'guardarDed' : 'guardarCtr'); const err = $(esDed ? 'eDed' : 'eCtr'); err.textContent = '';
    let fn; let args;
    if(esDed){
      const tipo = (document.querySelector('#formDed [data-ded-tipo].on') || {}).dataset; const ver = $('dVer').getAttribute('aria-checked') === 'true';
      if(ver && !$('dMot').value.trim()){ err.textContent = 'Escribe qué hay que verificar'; $('dMot').focus(); return; }
      fn = 'dedicado_editar'; args = { p_cliente: editando.cliente, p_campos: { tipo: tipo ? tipo.dedTipo : 'corporativo', ruta_documentos: $('dRuta').value, ruta_contrato: $('dCtr').value.trim(), plazo_documentos: $('dPlazo').value, verificar: ver, verificar_motivo: $('dMot').value.trim() } };
    } else {
      const f = $('kFirma').value; $('eFirma').textContent = '';
      if(f && f > new Date().toISOString().slice(0, 10)){ $('eFirma').textContent = 'La fecha de firma no puede ser futura'; return; }
      fn = 'dedicado_contrato_editar'; args = { p_id: editando.id, p_campos: { estatus: $('kEst').value, firmado_en: f, vence: $('kVence').value.trim(), nota: $('kNota').value.trim() } };
    }
    b.disabled = true; b.textContent = 'Guardando…';
    try {
      await rpc(fn, args);
      toast('Guardado'); cerrarHoja(); editando = null;
      if(window.Ficha) window.Ficha.recargar();
      document.dispatchEvent(new CustomEvent('dedicado-cambio'));
    } catch (x) { err.textContent = x.message; toast(x.message, 'error'); }
    finally { b.disabled = false; b.textContent = 'Guardar'; }
  }

  document.addEventListener('click', (e) => {
    const t = e.target; let b;
    if(t.closest('[data-ded-editar]')){ abrirEditar(); return; }
    if((b = t.closest('[data-ctr-editar]'))){ abrirContrato(b.dataset.ctrEditar); return; }
    if((b = t.closest('#formDed [data-ded-tipo]'))){ Array.prototype.forEach.call(document.querySelectorAll('#formDed [data-ded-tipo]'), (x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); }); return; }
    if((b = t.closest('#dVer'))){ b.setAttribute('aria-checked', String(b.getAttribute('aria-checked') !== 'true')); }
  });
  document.addEventListener('submit', (e) => { if(e.target.id === 'formDed' || e.target.id === 'formCtr') guardar(e); });

  window.FichaDedicado = { datos, contratos, RUTAS, CONTRATO };
})();
