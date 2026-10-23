// Expediente de un cliente dedicado: enlaces y contactos de la empresa (en Datos), contratos (pestaña Contratos)
// y lo que solo el administrador cambia (ruta, verificar, contratos), siempre con bitácora en el servidor.
(function(){
  'use strict';
  const C = window.Comun;
  const { $, esc, ic, rpc, toast, fecha, abrirHoja, cerrarHoja, prepararHojas, plural } = C;

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
      fila('Líder', esc(D.ejecutiva || 'Sin asignar') + (F.puedo && F.puedo.lider_cambiar ? '<button type="button" class="enlace" data-lider-cambiar="dedicado">Cambiar</button>' : '')) +
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

  // ---------- Contrato (lote 21/10): una tarjeta por contrato (PYME, Dedicado, Colocation) con su estatus y su firma Digital o Física ----------
  // Física = contrato presencial: no se piden correos ni teléfono. Firmado sin archivo o sin vencimiento queda marcado (y en la bandeja de Legal).
  function tarjeta(titulo, estatus, cuerpo, idEditar, clase){
    return '<div class="ctr-t' + (clase ? ' ' + clase : '') + '"><div class="ctr-cab"><b>' + esc(titulo) + '</b>' + estatus + (idEditar && esAdmin() ? '<button type="button" class="enlace" data-ctr-editar="' + esc(idEditar) + '">Editar</button>' : '') + '</div>' + cuerpo + '</div>';
  }
  const PYME_EST = { contrato_en_curso: ['morado', 'En elaboración'], por_firmar: ['ambar', 'Por firmar'], contrato_firmado: ['verde', 'Firmado'] };
  const gris = (t) => '<span class="ded-gris">' + esc(t) + '</span>';
  function firmaHtml(valor, attr, puede){
    return '<div class="ctr-firma"><span class="rotulo">Firma</span><div class="tres dos" role="radiogroup" aria-label="Firma">' + [['digital', 'Digital'], ['fisica', 'Física']].map((x) =>
      '<button type="button" role="radio" ' + attr + ' data-valor="' + x[0] + '" aria-checked="' + (valor === x[0]) + '" class="' + (valor === x[0] ? 'on' : '') + '"' + (puede ? '' : ' disabled') + '>' + x[1] + '</button>').join('') + '</div></div>';
  }
  function pendTag(firmado, conArchivo, vence){
    if(!firmado) return '';
    if(!conArchivo) return '<span class="chip ambar">Firmado: falta subir contrato</span>';
    return vence ? '' : '<span class="chip ambar">Falta vencimiento</span>';
  }
  function archivoFila(d, cas, puede, fisica){
    if(d && (d.archivos || []).length) return fila('Archivo', '<button type="button" class="enlace" data-ver="' + esc(d.id) + '">Ver contrato</button>' + (puede ? '<button type="button" class="enlace" data-subir="' + cas + ':0" style="margin-left:12px">Reemplazar</button>' : ''));
    return fila('Archivo', puede ? '<button type="button" class="enlace" data-subir="' + cas + ':0">' + (fisica ? 'Subir firmado en físico' : 'Subir contrato firmado') + '</button>' : gris('Sin archivo'));
  }
  function contratos(ficha, quien){
    F = ficha; yo = quien || yo; const c = F.cliente; const D = c.dedicado; const docs = F.documentos || [];
    const lista = D ? (D.contratos || []).filter((k) => k.tipo !== 'vgt') : [];
    const tienePyme = !c.es_natural && !/^Dedicado/.test(c.seg || '');
    const puedeC = !!(F.puedo && F.puedo.contrato); const puedeF = !!(F.puedo && F.puedo.presencial);
    let h = '';
    if(c.contrato_pend) h += '<div class="al-banda ambar" role="note"><b>' + (c.contrato_pend === 'sin_archivo' ? 'Firmado: falta subir contrato' : 'Falta vencimiento') + '</b><p>' +
      (c.contrato_pend === 'sin_archivo' ? 'Sube el contrato firmado (o el escaneado si se firmó en físico) con su fecha de vencimiento.' : 'Escribe la fecha de vencimiento del contrato firmado.') + '</p></div>';
    // Contrato que sigue el estatus legal del cliente (PYME, o dedicado sin ficha de la analista): su firma es la marca de contrato presencial
    const porEstatus = (titulo, cas, clase) => {
      const d = docs.find((x) => x.casilla === cas); const e = PYME_EST[c.estatus] || ['', 'Sin contrato todavía'];
      const firmado = c.estatus === 'contrato_firmado' || !!(d && d.firmado_en); const fis = !!c.presencial;
      return tarjeta(titulo, '<span class="chip ' + e[0] + '">' + esc(e[1]) + '</span>' + pendTag(firmado, !!(d && (d.archivos || []).length), d && d.vence_en),
        firmaHtml(fis ? 'fisica' : 'digital', 'data-firma-cli="1"', puedeF) +
        (fis ? '<p class="nota-chica">El cliente firma en físico. No se piden correos ni teléfono; sí los documentos legales. Comisiona igual.</p>' : '') +
        '<div class="datos">' + fila('Firmado', d && d.firmado_en ? esc(fecha(d.firmado_en)) : gris('Sin fecha')) + fila('Vence', d && d.vence_en ? esc(fecha(d.vence_en)) : gris('Sin fecha')) +
        archivoFila(d, cas, puedeC, fis) + '</div>' + (!firmado && !puedeC ? '<p class="nota-chica">El contrato lo sube Legal.</p>' : ''), null, clase);
    };
    if(tienePyme) h += porEstatus('Contrato PYME', 'contrato_pyme', 'ctr-pyme');
    if(!c.es_natural && /Dedicado/.test(c.seg || '') && !lista.some((k) => k.tipo === 'servicio')) h += porEstatus('Contrato dedicado', 'contrato_dedicado', 'ctr-ded');
    const docD = docs.find((x) => x.casilla === 'contrato_dedicado');
    lista.filter((k) => k.tipo === 'servicio').forEach((k) => {
      const fis = k.firma === 'fisica'; const firmado = k.estatus === 'firmado';
      h += tarjeta('Contrato dedicado', chip(k.estatus) + pendTag(firmado, !!k.con_archivo, k.vence_en), firmaHtml(fis ? 'fisica' : k.firma === 'digital' ? 'digital' : '', 'data-firma-ctr="' + esc(k.id) + '"', esAdmin()) +
        '<div class="datos">' + fila('Firmado', k.firmado_en ? esc(fecha(k.firmado_en)) : gris('Sin fecha')) +
        fila('Vence', k.vence_en ? esc(fecha(k.vence_en)) : k.vence ? esc(k.vence) + ' ' + gris('(falta la fecha)') : gris('Sin fecha')) + archivoFila(docD, 'contrato_dedicado', puedeC, fis) +
        (k.nota ? fila('Nota', esc(k.nota)) : '') + (k.editado_por ? fila('Cambió', esc(k.editado_por + (k.editado_en ? ', ' + fecha(k.editado_en) : ''))) : '') + '</div>', k.id, 'ctr-ded');
    });
    const col = lista.filter((k) => k.tipo === 'colocation');
    if(col.length){
      h += tarjeta('Colocation', '<span class="chip">' + esc(col.length === 1 ? '1 sitio' : col.length + ' sitios') + '</span>', '<div class="ctr-proy">' +
        col.map((x) => '<div class="ctr-p ctr-p2"><span><b>' + esc(x.sitio || 'Sin sitio') + '</b><small>' + esc([[x.municipio, x.estado].filter(Boolean).join(', '), x.firma === 'fisica' ? 'Firma física' : x.firma === 'digital' ? 'Firma digital' : '', x.vence_en ? 'Vence ' + fecha(x.vence_en) : ''].filter(Boolean).join(' · ')) + '</small></span>' + chip(x.estatus) +
          (esAdmin() ? '<button type="button" class="enlace" data-ctr-editar="' + esc(x.id) + '">Editar</button>' : '') + '</div>').join('') + '</div>');
    }
    if(D) h += '<p class="nota-chica" style="margin-top:12px">Los dedicados no comisionan.</p>';
    return h || C.vacio('Sin contratos', c.es_natural ? 'Las personas naturales no llevan contrato.' : 'Este cliente todavía no tiene contratos.');
  }

  // ---------- VGT (pestaña propia): contrato y proyectos; los requisitos y pólizas son casillas de la ficha ----------
  function vgt(ficha, quien){
    F = ficha; yo = quien || yo; const D = F.cliente.dedicado; if(!D) return '';
    const l = (D.contratos || []).filter((k) => k.tipo === 'vgt'); if(!l.length) return '';
    const k = l[0]; const U = (u) => String(u || '').toUpperCase();
    // 23/10 (Parte F): solo cuentan los tramos En uso o En proyecto; los demás van plegados como historial
    const usos = l.filter((x) => U(x.en_uso) === 'SI'); const proy = l.filter((x) => U(x.en_uso) === 'EN PROYECTO'); const resto = l.filter((x) => ['SI', 'EN PROYECTO'].indexOf(U(x.en_uso)) < 0);
    const suma = (a) => a.reduce((t, x) => t + (Number(x.postes) || 0), 0);
    const faltan = (D.vgt && D.vgt.faltan) || 0; const falta = faltan ? 'falta: ' + (faltan === 1 ? '1 requisito' : faltan + ' requisitos') : 'requisitos completos';
    const neg = resto.find((x) => U(x.en_uso) === 'NEGADA');
    const est = usos.length ? ['verde', 'VGT en uso · ' + suma(usos) + ' postes · ' + falta]
      : proy.length ? ['azul', 'En proyecto · ' + (faltan ? 'pedir pólizas' : 'requisitos completos')]
      : neg ? ['rojo', 'Solicitud negada'] : ['gris', 'Sin VGT en uso'];
    const sub = usos.length || proy.length ? [usos.length ? plural(usos.length, 'tramo en uso', 'tramos en uso') : '', proy.length ? plural(proy.length, 'tramo en proyecto', 'tramos en proyecto') : ''].filter(Boolean).join(', ')
      : neg ? (neg.negada_en ? 'Negada el ' + fecha(neg.negada_en) : 'Negada') + (neg.negada_motivo ? ': ' + neg.negada_motivo : '') + '. No se le piden pólizas' : 'No se le piden pólizas';
    const CH = { SI: ['verde', 'En uso'], 'EN PROYECTO': ['azul', 'En proyecto'], NO: ['gris', 'No'], NEGADA: ['rojo', 'Negada'] };
    const odt = (x) => { const o = String(x.odt || '').trim(); if(!o || /revisar/i.test(o)) return '<span class="chip ambar">Sin ODT</span>';
      return 'ODT ' + esc(o) + (x.odt_orden ? ' · ' + esc(String(x.odt_orden.titulo || '').slice(0, 60)) + (x.odt_orden.creada_en ? ', ' + esc(fecha(x.odt_orden.creada_en)) : '') : ''); };
    const tramo = (x) => { const c = CH[U(x.en_uso)] || ['gris', x.en_uso || 'Sin dato'];
      return '<div class="vgt-tramo"><div class="tx"><b>' + esc(x.proyecto || 'Sin nombre') + '</b><small>' + esc([x.estado, x.postes ? x.postes + ' postes' : '', x.fecha].filter(Boolean).join(' · ')) + '</small><small>' + odt(x) + '</small>' +
        (U(x.en_uso) === 'NEGADA' && x.negada_motivo ? '<small class="mal">' + esc(x.negada_motivo) + '</small>' : '') + '</div><span class="chip ' + c[0] + '">' + esc(c[1]) + '</span>' +
        (esAdmin() ? '<button type="button" class="vgt-mas" data-tramo-menu="' + esc(x.id) + '" aria-label="Opciones del tramo">⋯</button>' : '') + '</div>'; };
    const cuerpo = '<div class="estado ' + est[0] + ' vgt-est"><b>' + esc(est[1]) + '</b><small>' + esc(sub) + '</small></div>' +
      '<div class="datos">' + fila('Contrato', k.numero ? 'N° ' + esc(k.numero) : gris('Sin número')) +
        fila('Firmado', k.firmado_en ? esc(fecha(k.firmado_en)) : gris('Sin fecha')) + fila('Vence', k.vence_en ? esc(fecha(k.vence_en)) : k.vence ? esc(k.vence) : gris('Sin fecha')) + '</div>' +
      '<div class="ctr-proy"><div class="ctr-proy-t"><span>' + esc(suma(usos) + ' postes en uso · ' + suma(proy) + ' en proyecto') + '</span></div>' +
      usos.concat(proy).map(tramo).join('') + (usos.length + proy.length ? '' : '<p class="nota-chica">Ningún tramo en uso ni en proyecto.</p>') + '</div>' +
      (resto.length ? '<details class="vgt-hist"><summary>Historial: ' + esc(plural(resto.length, 'tramo sin uso o negado', 'tramos sin uso o negados')) + '</summary>' + resto.map(tramo).join('') + '</details>' : '');
    return tarjeta('Contrato VGT', chip(k.estatus) + pendTag(k.estatus === 'firmado', !k.falta_archivo, k.vence_en), cuerpo, k.id, 'ctr-vgt');
  }
  // Menú del tramo (solo administrador): uso, denegar con motivo y fecha, editar datos. Todo queda en la bitácora y en el hilo.
  let tramoEd = null;
  function abrirTramo(id, paso){
    const x = ((F && F.cliente.dedicado && F.cliente.dedicado.contratos) || []).find((k) => String(k.id) === String(id)); if(!x || !esAdmin()) return;
    tramoEd = x; const h = hoja('hojaTramo', 'tTramo'); const U = String(x.en_uso || '').toUpperCase();
    const op = (v, t) => '<button type="button" class="op" data-tramo-uso="' + v + '"' + (U === v ? ' disabled' : '') + '><span class="tx">' + esc(t) + (U === v ? '<small>Así está ahora</small>' : '') + '</span></button>';
    h.innerHTML = cab('tTramo', paso === 'negar' ? 'Denegar solicitud' : paso === 'editar' ? 'Editar tramo' : 'Tramo VGT', (x.proyecto || 'Sin nombre') + (x.postes ? ' · ' + x.postes + ' postes' : '')) +
      (paso === 'negar' ? '<form id="formNegar" novalidate><label class="rotulo" for="nMot">Motivo</label><textarea class="area corta" id="nMot" maxlength="500"></textarea><div class="error" id="eNMot" role="alert"></div>' +
          '<label class="rotulo arriba" for="nFecha">Fecha de la negativa</label><input class="campo" id="nFecha" type="date" max="' + esc(F.hoy || '') + '"><div class="error" id="eNFecha" role="alert"></div>' +
          '<p class="nota">Si era el único tramo en uso o en proyecto, el cliente sale de VGT, ya no se le piden pólizas y le avisamos al líder.</p><div class="acciones"><button type="submit" class="btn btn-peligro btn-ancho">Denegar</button></div></form>'
        : paso === 'editar' ? '<form id="formTramo" novalidate><label class="rotulo" for="tProy">Proyecto o ruta</label><input class="campo" id="tProy" maxlength="200" value="' + esc(x.proyecto || '') + '">' +
          '<label class="rotulo arriba" for="tPostes">Postes</label><input class="campo" id="tPostes" inputmode="numeric" maxlength="5" value="' + esc(x.postes == null ? '' : x.postes) + '"><div class="error" id="eTPostes" role="alert"></div>' +
          '<label class="rotulo arriba" for="tFecha">Fecha</label><input class="campo" id="tFecha" maxlength="60" value="' + esc(x.fecha || '') + '">' +
          '<label class="rotulo arriba" for="tOdt">ODT de infraestructura</label><input class="campo" id="tOdt" maxlength="80" value="' + esc(x.odt || '') + '"><p class="nota">Vacía o "REVISAR", el tramo sale como Sin ODT.</p>' +
          '<div class="acciones"><button type="submit" class="btn btn-ancho">Guardar</button></div></form>'
        : '<div class="rot">Uso</div>' + op('SI', 'Marcar en uso') + op('EN PROYECTO', 'Marcar en proyecto') + op('NO', 'Marcar sin uso') +
          '<div class="rot">Datos</div><button type="button" class="op" data-tramo-paso="editar"><span class="tx">Editar postes, fecha, proyecto y ODT</span></button>' +
          (U !== 'NEGADA' ? '<button type="button" class="op salir" data-tramo-paso="negar"><span class="tx">Denegar solicitud</span></button>' : ''));
    abrirHoja('hojaTramo');
  }
  async function guardarTramo(campos, b){
    if(!tramoEd) return; if(b) b.disabled = true;
    try { await rpc('dedicado_tramo_editar', { p_id: tramoEd.id, p_campos: campos }); toast('Tramo guardado'); cerrarHoja(); if(window.Ficha) window.Ficha.recargar(); }
    catch (e) { toast(e.message, 'error'); if(b) b.disabled = false; }
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
      '<label class="rotulo arriba" for="kVenceEn">Fecha de vencimiento</label><input class="campo" id="kVenceEn" type="date" value="' + esc(k.vence_en || '') + '"><div class="error" id="eVence" role="alert"></div>' +
        (k.vence ? '<p class="nota">En el archivo de la analista decía: ' + esc(k.vence) + '</p>' : '') + '<p class="nota">Obligatoria al marcarlo Firmado.</p>' +
      '<label class="rotulo arriba" for="kFirmaTipo">Firma</label><select class="campo" id="kFirmaTipo"><option value="">Sin definir</option>' + [['digital', 'Digital'], ['fisica', 'Física (presencial)']].map((x) => '<option value="' + x[0] + '"' + (k.firma === x[0] ? ' selected' : '') + '>' + x[1] + '</option>').join('') + '</select>' +
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
      const f = $('kFirma').value; const v = $('kVenceEn').value; $('eFirma').textContent = ''; $('eVence').textContent = '';
      if(f && f > new Date().toISOString().slice(0, 10)){ $('eFirma').textContent = 'La fecha de firma no puede ser futura'; return; }
      if($('kEst').value === 'firmado' && !v){ $('eVence').textContent = 'Pon la fecha de vencimiento: es obligatoria al marcarlo Firmado'; $('kVenceEn').focus(); return; }
      if(v && f && v <= f){ $('eVence').textContent = 'El vencimiento debe ser después de la firma'; return; }
      fn = 'dedicado_contrato_editar'; args = { p_id: editando.id, p_campos: { estatus: $('kEst').value, firmado_en: f, vence_en: v, firma: $('kFirmaTipo').value, nota: $('kNota').value.trim() } };
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
    if((b = t.closest('[data-tramo-menu]'))){ abrirTramo(b.dataset.tramoMenu); return; }
    if((b = t.closest('[data-tramo-paso]')) && tramoEd){ abrirTramo(tramoEd.id, b.dataset.tramoPaso); return; }
    if((b = t.closest('[data-tramo-uso]')) && tramoEd){ guardarTramo({ en_uso: b.dataset.tramoUso }, b); return; }
    // Firma Digital o Física de un contrato dedicado (solo administrador)
    if((b = t.closest('[data-firma-ctr]')) && esAdmin()){ if(b.classList.contains('on')) return; const v = b.dataset.valor; b.disabled = true;
      rpc('dedicado_contrato_editar', { p_id: Number(b.dataset.firmaCtr), p_campos: { firma: v } }).then(() => { toast(v === 'fisica' ? 'Firma física' : 'Firma digital'); if(window.Ficha) window.Ficha.recargar(); })
        .catch((x) => { toast(x.message, 'error'); b.disabled = false; }); return; }
    if((b = t.closest('#formDed [data-ded-tipo]'))){ Array.prototype.forEach.call(document.querySelectorAll('#formDed [data-ded-tipo]'), (x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); }); return; }
    if((b = t.closest('#dVer'))){ b.setAttribute('aria-checked', String(b.getAttribute('aria-checked') !== 'true')); }
  });
  document.addEventListener('submit', (e) => { if(e.target.id === 'formDed' || e.target.id === 'formCtr') guardar(e); });
  document.addEventListener('submit', (e) => {
    if(e.target.id === 'formNegar'){ e.preventDefault(); const m = $('nMot').value.trim(); const f = $('nFecha').value; $('eNMot').textContent = ''; $('eNFecha').textContent = '';
      if(m.length < 5){ $('eNMot').textContent = 'Escribe el motivo de la negativa'; return; } if(!f){ $('eNFecha').textContent = 'Pon la fecha de la negativa'; return; }
      guardarTramo({ en_uso: 'NEGADA', motivo: m, negada_en: f }, e.target.querySelector('[type="submit"]')); }
    if(e.target.id === 'formTramo'){ e.preventDefault(); const p = $('tPostes').value.trim(); $('eTPostes').textContent = '';
      if(p && !/^\d{1,5}$/.test(p)){ $('eTPostes').textContent = 'Los postes son un número entero'; return; }
      guardarTramo({ proyecto: $('tProy').value, postes: p, fecha: $('tFecha').value, odt: $('tOdt').value }, e.target.querySelector('[type="submit"]')); }
  });

  window.FichaDedicado = { datos, contratos, vgt, RUTAS, CONTRATO };
})();
