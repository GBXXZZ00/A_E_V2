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
  let F = null; let yo = null; let editando = null; let enlAbierto = null;   // enlaces plegados: { cliente, abierto }

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
      fila('Líder', esc(D.ejecutiva || 'Sin asignar')) +
      fila('Documentos', D.vacias ? '<span class="chip ambar">' + esc(D.vacias === 1 ? 'Falta 1' : 'Faltan ' + D.vacias) + '</span>' : '<span class="chip verde">Completos</span>') +
      (D.vacias && D.ruta_documentos ? fila('Qué hacer', esc(RUTAS[D.ruta_documentos])) : '') +
      (D.vgt ? fila('Requisitos VGT', D.vgt.faltan ? '<span class="chip ambar">' + esc(D.vgt.faltan === 1 ? 'Falta 1' : 'Faltan ' + D.vgt.faltan) + '</span>' : '<span class="chip verde">Completos</span>') : '') +
      (D.tipo === 'isp' && D.plazo ? fila('Plazo ISP', esc('Semana del ' + ddmm(addDias(D.plazo, -4)))) : '') +
      fila('Contrato', esc(D.ruta_contrato || 'Sin siguiente paso')) +
      (D.estatus_anterior ? fila('App vieja', esc(C.capital(String(D.estatus_anterior).toLowerCase())) + ' <small class="ded-gris">no confiable</small>') : '') +
      (F.puedo && F.puedo.estatus ? fila('Estatus legal', C.chipEstatus(F.cliente.estatus) + '<button type="button" class="enlace" data-paso="estatus">Cambiar</button>') : '') +
      '</div>';
    if(D.feedback || D.observacion) h += '<p class="nota-chica ded-nota">' + esc([D.feedback, D.observacion].filter(Boolean).join('. ')) + '</p>';

    // Enlaces plegados: una línea con cuántos están activos y la capacidad que suman; se abren al tocar
    h += '<div class="secc">Enlaces</div>';
    if(!(D.enlaces || []).length) h += '<p class="nota-chica">Sin enlaces en el archivo de la analista ni en Odoo.</p>';
    else {
      const abierto = !!enlAbierto && enlAbierto.cliente === F.cliente.id && enlAbierto.abierto;
      h += '<button type="button" class="plegado" data-ded-enl="1" aria-expanded="' + abierto + '" aria-controls="dedEnl"><span class="plg-tx">' + esc(resumenEnlaces(D.enlaces)) + '</span>' + ic('abajo') + '</button>' +
        '<div class="ded-enl" id="dedEnl"' + (abierto ? '' : ' hidden') + '>' + D.enlaces.map(enlace).join('') + '</div>';
    }

    h += '<div class="secc">Contactos de la empresa<span class="der">No son del representante legal</span></div>';
    if(!(D.contactos || []).length) h += '<p class="nota-chica">Sin contactos en el archivo de la analista.</p>';
    else h += '<div class="datos">' + D.contactos.map((k) => fila(AREA[k.area] || k.area,
      esc(k.nombre || '') + (k.telefono ? ' <a class="enlace" href="tel:' + esc(String(k.telefono).replace(/\D/g, '')) + '">' + esc(tel(k.telefono)) + '</a>' : '') +
      (k.correo ? ' <a class="enlace" href="mailto:' + esc(k.correo) + '">' + esc(k.correo) + '</a>' : ''))).join('') + '</div>';
    return h;
  }
  // "2 enlaces activos · 5,1 Gbps" (más los suspendidos si hay)
  function resumenEnlaces(l){
    const act = l.filter((e) => e.activo); const sus = l.length - act.length;
    const tot = act.reduce((a, e) => a + (Number(e.cap_entregada !== null && e.cap_entregada !== undefined ? e.cap_entregada : e.cap_facturada !== null && e.cap_facturada !== undefined ? e.cap_facturada : e.cap_inicial) || 0), 0);
    return [C.plural(act.length, 'enlace activo', 'enlaces activos'), tot ? cap(tot) : '', sus ? C.plural(sus, 'suspendido', 'suspendidos') : ''].filter(Boolean).join(' · ');
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

  // ---------- Contratos: una tarjeta por contrato (servicio dedicado, PYME si es combinado, VGT con sus proyectos, colocation por sitio) ----------
  function tarjeta(titulo, estatus, cuerpo, idEditar, clase){
    return '<div class="ctr-t' + (clase ? ' ' + clase : '') + '"><div class="ctr-cab"><b>' + esc(titulo) + '</b>' + estatus + (idEditar && esAdmin() ? '<button type="button" class="enlace" data-ctr-editar="' + esc(idEditar) + '">Editar</button>' : '') + '</div>' + cuerpo + '</div>';
  }
  function contratos(ficha, quien){
    F = ficha; yo = quien || yo; const D = F.cliente.dedicado; if(!D) return '';
    const lista = D.contratos || []; const c = F.cliente;
    let h = bloqueVgt(lista.filter((k) => k.tipo === 'vgt'), D);
    h += '<p class="nota-chica" style="margin-top:12px">Los dedicados no comisionan. El vencimiento se escribe a mano mientras se define la duración de los contratos.</p>';
    const combinado = c.seg === 'PYME + Dedicado';
    if(!lista.some((k) => k.tipo !== 'vgt') && !combinado) return h + C.vacio('Sin contratos', h.indexOf('ctr-vgt') >= 0 ? 'Fuera del VGT, este dedicado todavía no tiene contratos cargados.' : 'Este dedicado todavía no tiene contratos cargados.');
    const serv = lista.filter((k) => k.tipo === 'servicio');
    serv.forEach((k) => {
      h += tarjeta('Servicio dedicado', chip(k.estatus), '<div class="datos">' + fila('Firma', k.firmado_en ? esc(fecha(k.firmado_en)) : '<span class="ded-gris">Sin fecha</span>') +
        fila('Vence', k.vence ? esc(k.vence) : '<span class="ded-gris">Sin escribir</span>') + (k.nota ? fila('Nota', esc(k.nota)) : '') +
        (k.editado_por ? fila('Cambió', esc(k.editado_por + (k.editado_en ? ', ' + fecha(k.editado_en) : ''))) : '') + '</div>', k.id);
    });
    if(combinado){
      // PYME del mismo cliente: su estatus es el legal; los documentos comunes son los mismos
      const docP = (F.documentos || []).find((d) => d.casilla === 'contrato_pyme');
      const dedFirmado = serv.some((k) => k.estatus === 'firmado');
      const est = docP && docP.firmado_en ? '<span class="chip verde">Firmado</span>' : dedFirmado ? '<span class="chip ambar">Contrato PYME por elaborar</span>' : C.chipEstatus(c.estatus);
      h += tarjeta('Contrato PYME', est, '<div class="datos">' + fila('Firma', docP && docP.firmado_en ? esc(fecha(docP.firmado_en)) : '<span class="ded-gris">Sin firmar</span>') +
        fila('Documentos', 'Los mismos del dedicado') + '</div>');
    }
    const col = lista.filter((k) => k.tipo === 'colocation');
    if(col.length){
      h += tarjeta('Colocation', '<span class="chip">' + esc(col.length === 1 ? '1 sitio' : col.length + ' sitios') + '</span>', '<div class="ctr-proy">' +
        col.map((x) => '<div class="ctr-p ctr-p2"><span><b>' + esc(x.sitio || 'Sin sitio') + '</b><small>' + esc([x.municipio, x.estado].filter(Boolean).join(', ')) + '</small></span>' + chip(x.estatus) +
          (esAdmin() ? '<button type="button" class="enlace" data-ctr-editar="' + esc(x.id) + '">Editar</button>' : '') + '</div>').join('') + '</div>');
    }
    return h;
  }

  // ---------- VGT: bloque propio arriba de Contratos (contrato, proyectos y postes, requisitos con sus documentos) ----------
  const EST_DOC = { aprobado: ['verde', 'Aprobado'], por_revisar: ['ambar', 'Por revisar'], devuelto: ['rojo', 'Devuelto'] };
  function bloqueVgt(vgt, D){
    const V = D.vgt; if(!vgt.length && !V) return '';
    const hoy = F.hoy || new Date().toISOString().slice(0, 10);
    let cuerpo = '';
    if(vgt.length){
      const k = vgt[0]; const postes = vgt.reduce((a, x) => a + (Number(x.postes) || 0), 0);
      const uso = (u) => { const t = String(u || '').toUpperCase(); return t === 'SI' ? 'En uso' : t === 'NO' ? 'No' : t === 'EN PROYECTO' ? 'En proyecto' : (u || ''); };
      cuerpo += '<div class="datos">' + fila('Contrato', k.numero ? 'N° ' + esc(k.numero) : '<span class="ded-gris">Sin número</span>') +
          fila('Firma', k.firmado_en ? esc(fecha(k.firmado_en)) : '<span class="ded-gris">Sin fecha</span>') + fila('Vence', k.vence ? esc(k.vence) : '<span class="ded-gris">Sin escribir</span>') + '</div>' +
        '<div class="ctr-proy"><div class="ctr-proy-t"><span>' + esc(vgt.length === 1 ? '1 proyecto' : vgt.length + ' proyectos') + '</span><span>' + esc(postes + ' postes') + '</span></div>' +
        vgt.map((x) => '<div class="ctr-p"><b>' + esc(x.proyecto || 'Sin nombre') + '</b><small>' + esc([x.estado, x.postes ? x.postes + ' postes' : '', uso(x.en_uso), x.odt ? 'ODT ' + x.odt : ''].filter(Boolean).join(' · ')) + '</small></div>').join('') + '</div>';
    }
    if(V){
      // Cada requisito con el estado de su documento; las actas de cambios sustanciales solo si ya hay alguna
      const docs = F.documentos || [];
      const req = (V.requisitos || []).filter((r) => r.clave !== 'asamblea' || docs.some((d) => d.casilla === 'otro' && d.numero === r.numero));
      const pol = {}; (V.polizas || []).forEach((p) => { pol[p.numero] = p.vence_en; });
      cuerpo += '<div class="ctr-proy"><div class="ctr-proy-t"><span>Requisitos</span><span>' + esc(V.faltan ? (V.faltan === 1 ? 'Falta 1' : 'Faltan ' + V.faltan) : 'Completos') + '</span></div>' +
        req.map((r) => {
          const d = docs.find((x) => x.casilla === 'otro' && x.numero === r.numero); const e = d ? EST_DOC[d.estado] || ['', 'Subido'] : r.requerido ? ['ambar', 'Falta'] : ['', 'Opcional'];
          const v = pol[r.numero] || (d && d.vence_en); const dv = v ? C.diasEntre(hoy, v) : null;
          const sub = v ? (dv < 0 ? 'Venció el ' + fecha(v) : 'Vence el ' + fecha(v)) : '';
          return '<div class="ctr-p ctr-p2"><span><b>' + esc(String(r.texto || '').replace(/ \d$/, '')) + '</b>' + (sub ? '<small class="' + (dv < 0 ? 'mal' : dv <= 30 ? 'ojo' : '') + '">' + esc(sub) + '</small>' : '') + '</span>' +
            '<span class="chip ' + e[0] + '">' + esc(e[1]) + '</span></div>';
        }).join('') +
        '<button type="button" class="btn btn-chico btn-2 btn-ancho" data-ir-tab="documentos" data-ir-grupo="vgt" style="margin-top:10px">Subir o ver en Documentos</button></div>';
    }
    return tarjeta('VGT', vgt.length ? chip(vgt[0].estatus) : '<span class="chip">Sin contrato</span>', cuerpo, vgt.length ? vgt[0].id : null, 'ctr-vgt');
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
    if((b = t.closest('[data-ded-enl]'))){
      const ab = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', String(ab)); const z = $('dedEnl'); if(z) z.hidden = !ab;
      enlAbierto = { cliente: F && F.cliente.id, abierto: ab }; return;
    }
    if((b = t.closest('[data-ctr-editar]'))){ abrirContrato(b.dataset.ctrEditar); return; }
    if((b = t.closest('#formDed [data-ded-tipo]'))){ Array.prototype.forEach.call(document.querySelectorAll('#formDed [data-ded-tipo]'), (x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); }); return; }
    if((b = t.closest('#dVer'))){ b.setAttribute('aria-checked', String(b.getAttribute('aria-checked') !== 'true')); }
  });
  document.addEventListener('submit', (e) => { if(e.target.id === 'formDed' || e.target.id === 'formCtr') guardar(e); });

  window.FichaDedicado = { datos, contratos, RUTAS, CONTRATO };
})();
