// Expediente del cliente como hoja que sale encima de la lista: datos, documentos por casilla, hilo y comisión.
(function(){
  'use strict';
  const C = window.Comun;
  const { $, esc, ic, rpc, toast, fecha, hora, dia, mes, diasEntre, plural, capital, primerNombre, docFmt, sucursal, chipEstatus, estadoServicio, casilla, faltaTexto, devueltoFrase, normalizeStr, abrirHoja, cerrarHoja, hojaAbierta, iniciales } = C;
  const S = window.Sesion;
  const db = window.db;
  const TABS = ['datos', 'documentos', 'hilo', 'comision'];
  const MAX_ARCHIVO = 15 * 1024 * 1024;
  const TIPOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

  let yo = null; let id = 0; let F = null; let tab = 'datos'; let montada = false; let alCerrar = null; let llegada = null;
  const encima = () => { const h = hojaAbierta(); return !!h && h !== 'hojaFicha'; };
  let hiloTodo = false; let soloNotas = false; let repExtra = 0; let actaExtra = 0;
  let fuera = null;               // { cliente, F, alTerminar }: se sube o se escribe desde otra hoja, sin abrir el expediente
  let ocupado = false;            // hay una subida en curso
  let destino = null;             // casilla a la que va el archivo que se está eligiendo
  let ver = null;                 // { docId, cola, paso, motivo, archivo }
  let lote = [];                  // archivos de "Subir varios"
  let campo = null;               // lo que se edita en la hoja pequeña

  const FF = () => F;
  const docDe = (cas, num) => (F.documentos || []).find((d) => d.casilla === cas && d.numero === num);
  const porRevisar = () => (F.documentos || []).filter((d) => d.estado === 'por_revisar');
  const esRequerido = (cas, num) => (F.requeridos || []).some((r) => r.casilla === cas && r.numero === num);
  const liderCorto = () => primerNombre(F.cliente.lider) || 'el líder';

  // ---------- Carga ----------
  async function cargar(primera){
    const mio = id; if(!mio) return;
    try {
      const r = await rpc('cliente_ficha', { p_cliente: mio });
      if(mio !== id) return;   // ya se abrió otro cliente: esta respuesta no es de él
      F = r;
      pintarTodo();
      if(primera) alLlegar();
    } catch (e) {
      if(mio !== id) return;
      if(!F){
        $('cabFicha').innerHTML = '<div class="aviso" role="alert" style="flex:1;margin-top:0"><b>No se pudo abrir el cliente</b><p>' + esc(e.message) + '</p>' +
          '<p style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="btn btn-chico" id="reintentar">Reintentar</button><button type="button" class="btn btn-chico btn-2" data-cierra="1">Cerrar</button></p></div>';
        $('tabs').classList.add('hidden'); $('cuerpoFicha').classList.add('hidden');
      } else if(!encima()) pintarTodo();   // deja los botones como estaban
      toast(e.message, 'error');
    }
  }
  function pintarTodo(){
    $('tabs').classList.remove('hidden'); $('cuerpoFicha').classList.remove('hidden');
    pintarCab(); pintarHilo(); pintarDocumentos(); pintarDatos(); pintarComision();
    if(hojaAbierta() === 'hojaVer' && ver) pintarVer();
  }
  // Atajos que llegan en la dirección: pestaña, revisar o pedir
  function alLlegar(){
    const o = llegada || {}; llegada = null;
    if(o.revisar && F.puedo.revisar && porRevisar().length) abrirRevision();
    else if(o.pedir) pedir(o.pedir === '1' ? null : o.pedir);
    else if(o.campo) abrirCampo(o.campo);
    else if(o.enviar) abrirEnviar(o.enviar);
    else if(o.casilla){ const el = document.querySelector('#tab-documentos [data-casilla="' + o.casilla + '"]'); if(el){ el.scrollIntoView({ block: 'center' }); el.classList.add('sobre'); setTimeout(() => el.classList.remove('sobre'), 1600); } }
  }

  // ---------- Encabezado y paso siguiente ----------
  function paso(){
    const c = F.cliente; const f = F.faltantes || []; const n = porRevisar().length;
    const dev = f.some((x) => x.e === 'devuelto'); const fal = f.some((x) => x.e === 'falta');
    if(c.estatus === 'contrato_firmado') return { tono: 'verde', texto: 'Contrato firmado', sub: 'El expediente está completo' };
    if(c.estatus === 'por_firmar') return F.puedo.contrato
      ? { tono: 'morado', texto: 'Falta la firma del cliente', sub: 'Cuando llegue, sube el contrato firmado', boton: 'Subir contrato', accion: 'tab:documentos' }
      : { tono: 'morado', texto: 'Falta la firma del cliente', sub: 'El contrato ya se le envió', boton: 'Recordar la firma', accion: 'pedir:firma' };
    if(c.estatus === 'contrato_en_curso') return { tono: 'morado', texto: 'Legal está elaborando el contrato', sub: F.puedo.estatus ? 'Cuando lo envíes, pásalo a Pendiente por firmar' : '', boton: F.puedo.estatus ? 'Cambiar estatus' : '', accion: 'estatus' };
    if(c.estatus === 'documentos_recibidos') return { tono: 'verde', texto: 'Documentos completos y aprobados', sub: 'Sigue el contrato', boton: F.puedo.estatus ? 'Cambiar estatus' : '', accion: 'estatus' };
    if(dev) return { tono: 'rojo', texto: faltaTexto(f), sub: 'Hay que pedirlo de nuevo y reemplazarlo', boton: 'Recordar al cliente', accion: 'pedir:recordar' };
    if(c.estatus === 'documentos_en_revision' && n){
      return F.puedo.revisar ? { tono: 'ambar', texto: 'Te toca revisar ' + plural(n, 'documento', 'documentos'), boton: 'Revisar', accion: 'revisar' }
        : { tono: 'ambar', texto: 'Legal está revisando ' + plural(n, 'documento', 'documentos'), sub: 'Te avisamos si devuelven alguno' };
    }
    if(fal) return { tono: 'gris', texto: faltaTexto(f), boton: c.estatus === 'grandes_negocios' ? 'Pedir documentos' : 'Recordar al cliente', accion: c.estatus === 'grandes_negocios' ? 'pedir:pedir' : 'pedir:recordar' };
    return null;
  }
  function subCorte(){
    const i = (F.comision || []).find((x) => x.estado === 'ultimo_corte') || (F.comision || []).find((x) => x.estado === 'en_curso');
    if(!i) return '';
    return i.estado === 'ultimo_corte' ? 'Último corte: cierra el ' + fecha(F.corte.fin) : 'Corte de ' + mes(F.corte.etiqueta) + ': ' + (F.corte.dias <= 0 ? 'cierra hoy' : 'faltan ' + plural(F.corte.dias, 'día', 'días'));
  }
  function clienteContacto(){ const c = F.cliente; return { id: c.id, nombre: c.nombre, es_natural: c.es_natural, estatus: c.estatus, falta: F.faltantes, tel: c.tel, correo: c.correo }; }
  function pintarCab(){
    const c = F.cliente; const p = paso(); const s0 = (F.servicios || [])[0];
    const dat = [docFmt(c.doc_tipo, c.doc_numero), c.lider || 'Sin líder', c.por_instalar ? 'Sin instalar' : plural((F.servicios || []).length, 'servicio', 'servicios')].join(' · ');
    const sub = p ? (p.sub || subCorte()) : '';
    $('cabFicha').innerHTML = '<div class="f-cab"><span class="mono" aria-hidden="true">' + esc(iniciales(c.nombre).charAt(0)) + '</span><div class="tx"><h1 class="nom" id="tFicha">' + esc(c.nombre) + '</h1><p class="dat">' + esc(dat) + '</p></div>' +
        '<button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      '<div class="chips">' + chipEstatus(c.estatus) + '<span class="seg">' + esc(c.seg) + '</span>' + (s0 ? estadoServicio(s0.estado) : '') + (c.por_instalar ? '<span class="chip azul">Por instalar</span>' : '') +
        (c.es_top ? '<span class="chip">Cliente TOP</span>' : '') + (c.es_demo ? '<span class="chip">Dato de ejemplo</span>' : '') + '</div>' +
      '<div class="contacto">' + window.Pedir.iconos(clienteContacto()) + '</div>' +
      (p ? '<div class="paso ' + p.tono + '" id="paso"><span class="tx">' + esc(p.texto) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' +
        (p.boton ? '<button type="button" class="btn btn-chico" data-paso="' + esc(p.accion) + '">' + esc(p.boton) + '</button>' : '') + '</div>' : '');
    const nr = porRevisar().length; const t = $('tabs').querySelector('[data-tab="documentos"]');
    if(t) t.innerHTML = 'Documentos' + (nr ? '<em>' + nr + '</em>' : '');
  }

  // ---------- Hilo ----------
  function lineaHilo(h){
    const d = h.detalle || {}; const quien = '<b>' + esc(primerNombre(h.autor) || 'Alguien') + '</b>';
    const canal = { whatsapp: 'por WhatsApp', correo: 'por correo', llamada: 'por teléfono' }[d.canal] || '';
    let t = ''; let tono = ''; let glo = '';
    switch(h.tipo){
      case 'nota': t = quien + ' dejó una nota'; glo = '<div class="glo gris">' + esc(h.texto) + '</div>'; break;
      case 'estatus': { const e = C.ESTATUS[h.texto] || { t: h.texto, c: '' }; tono = e.c === 'gris' ? '' : e.c;
        t = (d.como === 'manual' && h.autor ? quien + ' lo pasó a ' : 'Pasó a ') + '<b>' + esc(e.t) + '</b>'; break; }
      case 'contacto': tono = 'azul';
        t = d.motivo === 'pedir' ? quien + ' pidió los documentos ' + canal : d.motivo === 'recordar' ? quien + ' le recordó al cliente ' + canal
          : d.motivo === 'firma' ? quien + ' recordó la firma ' + canal : d.canal === 'llamada' ? quien + ' llamó al cliente' : quien + ' escribió ' + canal; break;
      case 'documento_subido': { const cs = (d.casillas || []).map((x) => casilla(x.casilla, x.numero));
        t = quien + ' subió ' + plural(Number(h.texto) || cs.length || 1, 'documento', 'documentos') + (cs.length && cs.length <= 3 ? ': ' + esc(C.lista(cs)) : ''); break; }
      case 'documento_aprobado': tono = 'verde'; t = quien + ' aprobó: ' + esc(casilla(d.casilla || h.texto, d.numero)); break;
      case 'documento_devuelto': tono = 'rojo'; t = quien + ' devolvió: ' + esc(casilla(d.casilla || h.texto, d.numero));
        glo = '<div class="glo rojo">' + esc((C.MOTIVOS[d.motivo] || 'Devuelto') + (d.nota ? '. ' + d.nota : '')) + '</div>'; break;
      case 'dato': t = quien + ' ' + ({ representante: 'actualizó el contacto del representante ' + (d.orden || 1), correo_empresa: 'actualizó el correo de la empresa', telefono: 'actualizó el teléfono', direccion: 'actualizó la dirección',
        regimen_firma: 'puso el régimen de firma en ' + (d.valor === 'conjunta' ? 'Conjunta' : d.valor === 'individual' ? 'Individual' : 'Sin definir'),
        ip: 'actualizó la IP' + (d.codigo ? ' del servicio ' + d.codigo : ''), es_top: d.valor === 'true' ? 'lo marcó como Cliente TOP' : 'le quitó la marca de Cliente TOP', es_isp: d.valor === 'true' ? 'lo marcó como proveedor de internet' : 'le quitó la marca de proveedor de internet' }[h.texto] || 'actualizó un dato'); break;
      case 'gestion': { const que = h.texto === 'ambas' ? 'la proforma y la carta de bienvenida' : h.texto === 'bienvenida' ? 'la carta de bienvenida' : 'la proforma';
        if(d.canal === 'whatsapp' || d.canal === 'correo'){ tono = 'azul'; t = quien + ' envió ' + que + (d.canal === 'correo' ? ' por correo' : ' por WhatsApp'); }
        else t = quien + (d.hecho ? ' marcó ' : ' quitó la marca de ') + que + (d.hecho ? (h.texto === 'ambas' ? ' como enviadas' : ' como enviada') : '');
        break; }
      case 'pago': tono = h.texto === 'pagada' ? 'verde' : ''; t = quien + (h.texto === 'pagada' ? ' marcó la instalación como pagada' : ' quitó el pago de la instalación'); break;
      case 'instalacion':
        if(h.texto === 'asignada'){ t = quien + ' asignó la comisión a <b>' + esc(d.dueno || '') + '</b>' + (d.orden ? ', con la orden ' + esc(String(d.orden).split('/').pop()) : ', sin orden de Odoo'); }
        else if(h.texto === 'excepcion'){ tono = 'verde'; t = quien + ' dio una excepción de comisión'; glo = d.motivo ? '<div class="glo gris">' + esc(d.motivo) + '</div>' : ''; }
        else if(h.texto === 'excepcion_quitada') t = quien + ' quitó la excepción de comisión';
        else t = 'Se instaló el servicio';
        break;
      case 'correo': tono = 'azul'; t = '<b>Correo del cliente</b>'; glo = h.texto ? '<div class="glo gris">' + esc(h.texto) + '</div>' : ''; break;
      default: t = esc(h.texto || h.tipo);
    }
    return '<div class="lin"><i class="' + tono + '"></i><span>' + t + glo + '</span><time>' + esc(hora(h.en)) + '</time></div>';
  }
  function pintarHilo(){
    let lista = F.hilo || [];
    if(soloNotas) lista = lista.filter((h) => h.tipo === 'nota');
    const LIM = 12; const visibles = hiloTodo ? lista : lista.slice(0, LIM);
    let h = ''; let ultimoDia = '';
    visibles.forEach((x) => { const d = dia(x.en); if(d !== ultimoDia){ h += '<span class="dia">' + esc(d) + '</span>'; ultimoDia = d; } h += lineaHilo(x); });
    if(!visibles.length) h = '<p class="nota-chica">' + (soloNotas ? 'Todavía no hay notas.' : 'Todavía no hay movimientos. Lo que pase con este cliente queda anotado aquí.') + '</p>';
    if(!hiloTodo && lista.length > LIM) h += '<button type="button" class="enlace" id="hiloMas" style="justify-self:start">Ver ' + plural(lista.length - LIM, 'movimiento anterior', 'movimientos anteriores') + '</button>';
    const previa = $('nota'); const texto = previa ? previa.value : ''; const conFoco = previa && document.activeElement === previa;
    $('tab-hilo').innerHTML = '<div class="tit"><div class="filtros" style="margin-top:0"><button type="button" data-hilo="todo" class="' + (soloNotas ? '' : 'on') + '" data-chico>Todo</button><button type="button" data-hilo="notas" class="' + (soloNotas ? 'on' : '') + '" data-chico>Notas</button></div></div>' +
      '<div class="hilo" id="hilo">' + h + '</div>' +
      '<form class="escribir" id="formNota" autocomplete="off"><label class="solo-lector" for="nota">Escribe una nota</label><input id="nota" maxlength="1000" placeholder="Escribe una nota" enterkeyhint="send">' +
      '<button type="submit" aria-label="Guardar nota">' + ic('enviar') + '</button></form>';
    if(texto){ $('nota').value = texto; if(conFoco) $('nota').focus(); }
  }

  // ---------- Documentos ----------
  function subCasilla(d){
    const hoy = F.hoy;
    if(d.estado === 'devuelto') return 'Devuelto: ' + (C.MOTIVOS[d.motivo] || 'revisa la nota').toLowerCase();
    if(d.firmado_en) return 'Firmado el ' + fecha(d.firmado_en, true) + (d.vence_en ? '. Vence el ' + fecha(d.vence_en, true) : '');
    if(d.vence_en) return (d.vence_en < hoy ? 'Venció el ' : 'Vence el ') + fecha(d.vence_en, true);
    if((d.comparte || []).length) return 'Mismo archivo que: ' + C.lista(d.comparte.map((x) => casilla(x.casilla, x.numero)));
    if((d.archivos || []).length > 1) return d.archivos.length + ' archivos';
    return 'Subido ' + dia(d.subido_en).toLowerCase().replace(/^(\d)/, 'el $1') + (d.subido_por ? ' por ' + primerNombre(d.subido_por) : '');
  }
  // Cada casilla tiene un solo estado y una sola acción
  function casillaHtml(cas, num, opciones){
    const o = opciones || {}; const d = docDe(cas, num); const nombre = o.nombre || casilla(cas, num); const k = cas + ':' + num;
    const puedeSubir = !(cas.indexOf('contrato_') === 0 && !F.puedo.contrato);
    if(!d){
      const req = esRequerido(cas, num);
      if(!puedeSubir) return '<div class="casilla doc" data-casilla="' + k + '"><span class="ico">' + ic('doc') + '</span><span class="tx"><b>' + esc(nombre) + '</b><small>' + esc(o.sub || 'Lo sube Legal') + '</small></span></div>';
      return '<button type="button" class="casilla doc falta" data-casilla="' + k + '" data-subir="' + k + '" data-suelta="1"><span class="ico mas" aria-hidden="true">+</span><span class="tx"><b>' + esc(nombre) + '</b><small>' + esc(o.sub || (req ? 'Toca o suelta el archivo aquí' : 'Opcional')) + '</small></span>' +
        (req ? '<span class="chip rojo">Falta</span>' : '') + '</button>';
    }
    if(d.estado === 'devuelto'){
      return '<div class="casilla doc dev" data-casilla="' + k + '"' + (puedeSubir ? ' data-suelta="1"' : '') + '><button type="button" class="cuerpo" data-ver="' + d.id + '"><span class="ico" aria-hidden="true">!</span><span class="tx"><b>' + esc(nombre) + '</b><small>' + esc(subCasilla(d)) + (d.nota ? '. ' + esc(d.nota) : '') + '</small></span></button>' +
        (puedeSubir ? '<button type="button" class="mini pri" data-subir="' + k + '">Subir de nuevo</button>' : '<span class="chip rojo">Devuelto</span>') + '</div>';
    }
    const ok = d.estado === 'aprobado';
    return '<button type="button" class="casilla doc ' + (ok ? 'ok' : 'rev') + '" data-casilla="' + k + '" data-ver="' + d.id + '"><span class="ico" aria-hidden="true">' + (ok ? ic('check') : ic('reloj')) + '</span><span class="tx"><b>' + esc(nombre) + '</b><small' + (d.vence_en && d.vence_en < F.hoy ? ' style="color:var(--rojo)"' : '') + '>' + esc(subCasilla(d)) + '</small></span>' +
      '<span class="chip ' + (ok ? 'verde">Aprobado' : 'ambar">Por revisar') + '</span></button>';
  }
  // Teléfono y correo son casillas como las demás: cuentan para pasar a revisión
  function datoHtml(nombre, valor, clave, obligatorio){
    const falta = !String(valor || '').trim();
    return '<button type="button" class="casilla doc dato ' + (falta ? (obligatorio ? 'falta' : '') : 'ok') + '" data-campo="' + clave + '"><span class="ico' + (falta ? ' mas' : '') + '" aria-hidden="true">' + (falta ? ic('lapiz') : ic('check')) + '</span>' +
      '<span class="tx"><b>' + nombre + '</b><small>' + esc(falta ? (obligatorio ? 'Toca para escribirlo' : 'Opcional') : valor) + '</small></span>' + (falta && obligatorio ? '<span class="chip rojo">Falta</span>' : falta ? '' : ic('lapiz', 'ch')) + '</button>';
  }
  // Contacto del representante: una sola casilla con el teléfono y el correo
  function contactoHtml(r, n, obligatorio){
    const tel = String(r.telefono || '').trim(); const co = String(r.correo || '').trim(); const lleno = !!(tel && co); const algo = tel || co;
    const falta = obligatorio && !lleno;
    const sub = lleno ? tel + ' · ' + co : algo ? algo + (obligatorio ? '. Falta el ' + (tel ? 'correo' : 'teléfono') : '') : obligatorio ? 'Toca para escribir el teléfono y el correo' : 'Opcional';
    return '<button type="button" class="casilla doc dato ' + (falta ? 'falta' : algo ? 'ok' : '') + '" data-campo="rep:' + n + '"><span class="ico' + (algo && !falta ? '' : ' mas') + '" aria-hidden="true">' + (algo && !falta ? ic('check') : ic('lapiz')) + '</span>' +
      '<span class="tx"><b>Contacto</b><small>' + esc(sub) + '</small></span>' + (falta ? '<span class="chip rojo">Falta</span>' : algo ? ic('lapiz', 'ch') : '') + '</button>';
  }
  function grupoRep(n, requeridoN){
    const r = (F.representantes || []).find((x) => x.orden === n) || {};
    return '<section class="bloque" data-grupo="rep' + n + '"><div class="sec">' + (F.cliente.es_natural ? 'Titular' : 'Representante ' + n) + (r.nombre ? '<span>' + esc(r.nombre) + '</span>' : !requeridoN ? '<span>Opcional</span>' : '') + '</div>' +
      contactoHtml(r, n, requeridoN && !F.cliente.es_natural) +
      casillaHtml('cedula', n, { nombre: 'Cédula' }) + casillaHtml('rif_personal', n, { nombre: 'RIF personal' }) + '</section>';
  }
  function pintarDocumentos(){
    const c = F.cliente; const fal = F.faltantes || []; const nr = porRevisar().length;
    const aprobados = (F.documentos || []).filter((d) => d.estado === 'aprobado').length;
    const nReq = !c.es_natural && c.regimen_firma === 'conjunta' ? 2 : 1;
    const nReps = Math.max(nReq, (F.representantes || []).reduce((a, r) => Math.max(a, r.orden), 1), repExtra);
    const pedirM = c.estatus === 'grandes_negocios' ? 'pedir' : 'recordar';
    let h = '<div class="res"><div class="r"><b>' + fal.length + '</b><small>' + (fal.length === 1 ? 'Falta' : 'Faltan') + '</small></div><div class="a"><b>' + nr + '</b><small>Por revisar</small></div><div class="v"><b>' + aprobados + '</b><small>' + (aprobados === 1 ? 'Aprobado' : 'Aprobados') + '</small></div></div>' +
      '<div class="acc"><button type="button" class="btn btn-chico btn-2" id="subirVarios"' + (ocupado ? ' disabled' : '') + '>' + ic('subir') + 'Subir varios</button>' +
        (F.puedo.revisar && nr ? '<button type="button" class="btn btn-chico" id="revisarTodo">Revisar ' + nr + '</button>'
          : fal.length ? '<button type="button" class="btn btn-chico" data-paso="pedir:' + pedirM + '">Pedir lo que falta</button>' : '') + '</div>' +
      '<p class="nota-chica solo-pc" style="text-align:center">También puedes arrastrar un archivo desde tu computadora y soltarlo sobre una casilla.</p>' +
      '<p class="nota-chica' + (ocupado ? '' : ' hidden') + '" id="estadoSubida" role="status"><span class="cargando-linea"><i></i><span id="textoSubida">Subiendo…</span></span></p>';
    for(let n = 1; n <= nReps; n++) h += grupoRep(n, n <= nReq);
    if(!c.es_natural && nReps < 4) h += '<button type="button" class="btn btn-chico btn-2 btn-ancho" id="agregarRep" style="margin-top:12px">Agregar representante</button>';
    if(!c.es_natural){
      // Las actas de asamblea se agregan con su botón, hasta 4
      const actas = [1, 2, 3, 4].filter((n) => docDe('acta_asamblea', n)); const libres = [1, 2, 3, 4].filter((n) => !docDe('acta_asamblea', n));
      const mostrar = actas.concat(libres.slice(0, Math.min(actaExtra, libres.length))).sort();
      h += '<section class="bloque" data-grupo="empresa"><div class="sec">Empresa</div>' + datoHtml('Correo de la empresa', c.correo_empresa, 'correo_empresa', true) +
        casillaHtml('rif_empresa', 0, { nombre: 'RIF de la empresa' }) + casillaHtml('acta_constitutiva', 0) + (c.es_isp ? casillaHtml('conatel', 0) : '') +
        mostrar.map((n) => casillaHtml('acta_asamblea', n, { sub: 'Toca o suelta el archivo aquí' })).join('') +
        (mostrar.length < 4 ? '<button type="button" class="btn btn-chico btn-2 btn-ancho" id="agregarActa" style="margin-top:10px">' + ic('mas') + 'Agregar acta de asamblea</button>' : '') + '</section>';
    }
    const tieneDed = /Dedicado/.test(c.seg); const tienePyme = !/^Dedicado/.test(c.seg);
    // El contrato aparece cuando ya se envió a firmar (o si ya hay uno guardado). Los naturales no llevan contrato.
    const hayContrato = !!(docDe('contrato_pyme', 0) || docDe('contrato_dedicado', 0));
    if(hayContrato || (!c.es_natural && (c.estatus === 'por_firmar' || c.estatus === 'contrato_firmado'))){
      h += '<section class="bloque" data-grupo="contrato"><div class="sec">Contrato<span>Lo sube Legal</span></div>' +
        ((tienePyme && !c.es_natural) || docDe('contrato_pyme', 0) ? casillaHtml('contrato_pyme', 0, { sub: F.puedo.contrato ? 'Con fecha de firma y de vencimiento' : 'Lo sube Legal' }) : '') +
        (tieneDed || docDe('contrato_dedicado', 0) ? casillaHtml('contrato_dedicado', 0, { sub: F.puedo.contrato ? 'Con fecha de firma y de vencimiento' : 'Lo sube Legal' }) : '') + '</section>';
    }
    const otros = (F.documentos || []).filter((d) => d.casilla === 'otro');
    h += '<section class="bloque" data-grupo="otros"><div class="sec">Otros documentos</div>' + otros.map((d) => casillaHtml('otro', d.numero)).join('') +
      '<button type="button" class="casilla doc" data-subir="otro:0" data-casilla="otro:0" data-suelta="1"><span class="ico mas" aria-hidden="true">+</span><span class="tx"><b>Otro documento</b><small>Lo que no entra en las casillas de arriba</small></span></button></section>';
    $('tab-documentos').innerHTML = h;
  }

  // ---------- Datos ----------
  function fila(etq, valor){ return '<div class="dato-f"><span>' + etq + '</span><b>' + valor + '</b></div>'; }
  function pintarDatos(){
    const c = F.cliente; const s = F.servicios || []; const s0 = s[0] || {};
    const diasGestion = diasEntre(c.creado_en, new Date().toISOString());
    const r1 = (F.representantes || []).find((x) => x.orden === 1) || {};
    const tj = (titulo, fuerte, lineas, extra) => '<div class="tj"><span class="tj-t">' + titulo + '</span><b>' + fuerte + '</b>' + lineas.filter(Boolean).map((l) => '<small>' + l + '</small>').join('') + (extra || '') + '</div>';
    let h = '<div class="tarjs">' +
      tj(c.es_natural ? 'Titular' : 'Empresa', esc(c.nombre), [esc(docFmt(c.doc_tipo, c.doc_numero)) + ' · ' + esc(c.seg), esc(c.direccion || s0.direccion || 'Sin dirección')]) +
      tj(c.es_natural ? 'Contacto' : 'Representante', esc(r1.nombre || (c.es_natural ? c.nombre : 'Sin nombre todavía')), [esc(r1.telefono || c.telefono || s0.telefono || 'Sin teléfono'), esc(r1.correo || c.correo_empresa || 'Sin correo')]) +
      tj('Líder', esc(c.lider || 'Sin asignar'), [c.estatus === 'contrato_firmado' ? 'Gestión cerrada' : 'En gestión hace ' + esc(plural(diasGestion, 'día', 'días'))]) +
      tj('Estatus legal', chipEstatus(c.estatus), [], F.puedo.estatus ? '<button type="button" class="enlace" id="cambiarEstatus" style="margin-top:8px">Cambiar</button>' : '') + '</div>';
    h += '<div class="serv-n"><b>' + s.length + '</b><span>' + (s.length === 1 ? 'Servicio' : 'Servicios') + ' en este ' + (c.es_natural ? 'documento' : 'RIF') + '</span></div><div class="tarjs">';
    if(!s.length) h += '<div class="tj"><span class="tj-t">Sin instalar<span class="chip azul">Por instalar</span></span><b>Todavía sin servicio</b><small>' +
      (F.orden ? 'Orden de Odoo ' + esc(F.orden.numero) + ' del ' + esc(fecha(F.orden.creada_en)) + ' · ' + esc(F.orden.etapa || '') : 'Puedes adelantar los documentos mientras se instala.') + '</small></div>';
    s.forEach((x) => {
      h += '<div class="tj"><span class="tj-t">' + esc(x.sucursal + '-' + x.codigo) + estadoServicio(x.estado) + '</span><b>' + esc(x.plan || x.categoria || 'Servicio') + '</b>' +
        '<small>' + esc(sucursal(x.sucursal)) + ' · ' + (x.fecha_instalacion ? 'Instalado el ' + esc(fecha(x.fecha_instalacion, true)) : 'Sin fecha de instalación') + '</small>' +
        (x.equipo ? '<small>Serial ' + esc(x.equipo) + '</small>' : '') +
        (x.con_deuda ? '<small style="color:var(--rojo);font-weight:600">Con deuda en el TAD</small>' : '') +
        '<div class="ip-l"><span>' + (x.ip || x.ip6 ? [x.ip ? 'IPv4 ' + esc(x.ip) : '', x.ip6 ? 'IPv6 ' + esc(x.ip6) : ''].filter(Boolean).join(' · ') : 'IP pendiente por asignar') + '</span>' +
          (F.puedo.ip ? '<button type="button" class="enlace" data-ip="' + esc(x.id) + '">' + (x.ip || x.ip6 ? 'Cambiar IP' : 'Escribir IP') + '</button>' : '') + '</div>' +
        (F.puedo.enviar ? '<div class="ip-l env-l"><span>' + esc(estadoEnvio(x)) + '</span><button type="button" class="mini" data-enviar="' + esc(x.id) + '">Proforma y carta</button></div>' : '') + '</div>';
    });
    h += '</div>';
    if(!c.es_natural){
      const r = c.regimen_firma || ''; const dis = F.puedo.regimen ? '' : ' disabled';
      h += '<div class="secc">Régimen de firma' + (F.puedo.regimen ? '' : '<span class="der">Lo define Legal</span>') + '</div><div class="tres" role="radiogroup" aria-label="Régimen de firma">' +
        [['', 'Sin definir'], ['individual', 'Individual'], ['conjunta', 'Conjunta']].map((x) => '<button type="button" role="radio" aria-checked="' + (r === x[0]) + '" data-regimen="' + x[0] + '" class="' + (r === x[0] ? 'on' : '') + '"' + dis + '>' + x[1] + '</button>').join('') + '</div>' +
        (r === 'conjunta' ? '<p class="nota-chica">Con firma conjunta se piden la cédula y el RIF de dos representantes.</p>' : '') +
        (/Dedicado/.test(c.seg) || c.es_isp ? '<div class="interr"><span class="tx">Proveedor de internet (ISP)<small>Se le pide el permiso de Conatel</small></span><button type="button" class="sw" role="switch" aria-checked="' + !!c.es_isp + '" data-interr="es_isp" aria-label="Proveedor de internet"' + dis + '></button></div>' : '');
    }
    h += '<div class="secc">Cartera</div><div class="interr"><span class="tx">Cliente TOP<small>Protegido: los aliados no pueden instalarlo</small></span>' +
      '<button type="button" class="sw" role="switch" aria-checked="' + !!c.es_top + '" data-interr="es_top" aria-label="Cliente TOP"' + (F.puedo.top ? '' : ' disabled') + '></button></div>';
    $('tab-datos').innerHTML = h;
  }

  // ---------- Proforma y carta de bienvenida ----------
  function estadoEnvio(x){
    const una = (e, que) => (e ? que + ' enviada el ' + fecha(e.en) + (e.por ? ', ' + primerNombre(e.por) : '') : '');
    return [una(x.bienvenida_envio, 'Carta'), una(x.proforma_envio, 'Proforma')].filter(Boolean).join(' · ') || 'Proforma y carta sin enviar';
  }
  let env = null;   // { servicio, tipo }
  const saludoHora = () => { const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; };
  function telefonosDe(sv){
    const D = window.Documentos; const vistos = {}; const r = [];
    const pon = (t, de) => { const n = D.waNumero(t); if(n.length < 11 || vistos[n]) return; vistos[n] = 1; r.push({ n: String(t), t: D.telFmt(t) + ' · ' + de }); };
    (F.representantes || []).forEach((x) => pon(x.telefono, F.cliente.es_natural ? 'titular' : 'representante ' + x.orden));
    pon(F.cliente.telefono, 'Proham'); pon(sv.telefono, 'TAD');
    (F.servicios || []).forEach((x) => { if(x !== sv) pon(x.telefono, 'TAD, otro servicio'); });
    return r;
  }
  function abrirEnviar(servicioId){
    const sv = (F.servicios || []).find((x) => String(x.id) === String(servicioId)); if(!sv || !F.puedo.enviar) return;
    const k = sv.carta || {}; const tels = telefonosDe(sv); const sinIp = !sv.ip && !sv.ip6;
    env = { servicio: sv.id, tipo: k.puede ? 'ambas' : 'proforma' };
    const aviso = (t, extra) => '<div class="estado ambar chico"><small>' + t + '</small>' + (extra || '') + '</div>';
    let h = cabHoja('tEnviar', 'Proforma y carta', F.cliente.nombre + ' · ' + sv.sucursal + '-' + sv.codigo);
    if(!k.puede) h += aviso('La carta de bienvenida sale cuando la instalación tenga dueño. Se asigna en Comisiones.');
    else {
      if(sinIp) h += aviso('Este servicio no tiene IP: la carta dirá "Pendiente por asignar".', F.puedo.ip ? '<button type="button" class="mini" id="envIp">Escribir IP</button>' : '');
      if(k.lider && !k.whatsapp) h += aviso('A ' + esc(k.lider) + ' le falta el WhatsApp en Usuarios: la carta saldrá sin ese dato.');
    }
    h += '<span class="rotulo arriba" id="rEnvTipo">Qué envías</span><div class="tres" role="radiogroup" aria-labelledby="rEnvTipo">' +
      [['proforma', 'Proforma'], ['bienvenida', 'Carta'], ['ambas', 'Las dos']].map((x) => '<button type="button" role="radio" data-env-tipo="' + x[0] + '" aria-checked="' + (env.tipo === x[0]) + '" class="' + (env.tipo === x[0] ? 'on' : '') + '"' + (x[0] !== 'proforma' && !k.puede ? ' disabled' : '') + '>' + x[1] + '</button>').join('') + '</div>' +
      '<div class="ver-l"><button type="button" class="enlace" data-env-ver="proforma">Ver la proforma</button>' + (k.puede ? '<button type="button" class="enlace" data-env-ver="bienvenida">Ver la carta</button>' : '') + '</div>' +
      '<label class="rotulo arriba" for="envNum">WhatsApp del cliente</label><select class="campo" id="envNum">' + tels.map((x) => '<option value="' + esc(x.n) + '">' + esc(x.t) + '</option>').join('') + '<option value="">Otro número</option></select>' +
      '<div id="envOtroZ"' + (tels.length ? ' class="hidden"' : '') + '><label class="rotulo arriba" for="envOtro">Otro número</label><input class="campo" id="envOtro" type="tel" inputmode="tel" autocomplete="off" maxlength="20"></div>' +
      '<div class="error" id="eEnv" role="alert"></div>' +
      '<div class="acciones col"><button type="button" class="btn btn-ancho" id="envWa">' + ic('wa') + (puedeCompartir() ? 'Compartir por WhatsApp' : 'Descargar y abrir WhatsApp') + '</button>' +
      '<button type="button" class="btn btn-2 btn-ancho" id="envCorreo">' + ic('correo') + 'Enviar las dos por correo</button></div>' +
      '<p class="nota-chica" id="envAyuda">' + (puedeCompartir() ? 'Se copia el número y se abre Compartir con el PDF: elige WhatsApp y pega el número.' : 'Se descarga el PDF, se copia el número y se abre el chat: arrastra el PDF al chat.') + '</p>' +
      '<div class="ip-l env-l"><span>' + esc(estadoEnvio(sv)) + '</span>' + (F.puedo.gestion ? '<button type="button" class="enlace" id="envManual">Ya se envió por fuera</button>' : '') + '</div>';
    $('hojaEnviar').innerHTML = h;
    abrirHoja('hojaEnviar');
  }
  // En teléfono se comparte el archivo; en computadora se descarga
  function puedeCompartir(){
    try { return window.matchMedia('(pointer: coarse)').matches && !!navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] }); } catch (e) { return false; }
  }
  function archivosEnvio(tipo, telefono){
    const sv = (F.servicios || []).find((x) => x.id === env.servicio); const D = window.Documentos; const x = D.datosDe(F, sv, telefono); const r = [];
    if(tipo !== 'bienvenida') r.push(new File([D.proforma(x)], D.nombreArchivo('proforma', x.nombre), { type: 'application/pdf' }));
    if(tipo !== 'proforma') r.push(new File([D.carta(x)], D.nombreArchivo('bienvenida', x.nombre), { type: 'application/pdf' }));
    return r;
  }
  const tiposDe = (tipo) => (tipo === 'ambas' ? ['proforma', 'bienvenida'] : [tipo]);
  async function anotarEnvio(tipo, canal, destino){
    const mio = id;
    try { await rpc('envio_registrar', { p_servicio: env.servicio, p_tipos: tiposDe(tipo), p_canal: canal, p_destino: destino || null }); toast(canal === 'manual' ? 'Marcado como enviado' : 'Quedó anotado en el hilo'); }
    catch (e) { toast(e.message, 'error'); return; }
    if(hojaAbierta() === 'hojaEnviar') cerrarHoja();
    if(mio === id) cargar();
  }
  function numeroEnvio(){
    const s = $('envNum'); const v = s && s.value ? s.value : $('envOtro').value.trim();
    if(window.Documentos.waNumero(v).length < 11){ $('eEnv').textContent = 'Escribe un número de WhatsApp completo, con el código del operador'; if(!s.value) $('envOtro').focus(); return null; }
    return v;
  }
  const copiar = (t) => { try { if(navigator.clipboard) navigator.clipboard.writeText(t).catch(() => {}); } catch (e) {} };
  async function enviarWhatsapp(){
    $('eEnv').textContent = ''; const num = numeroEnvio(); if(!num) return;
    const D = window.Documentos; const tipo = env.tipo; let files;
    try { files = archivosEnvio(tipo, num); } catch (e) { toast('No se pudo armar el PDF. Intenta de nuevo', 'error'); return; }
    const quien = saludoHora() + '. Le escribe ' + (F.yo.nombre || 'el equipo') + ', de Airtek. ';
    const msj = quien + (tipo === 'proforma' ? 'Le envío la proforma de instalación de su servicio de internet, con las opciones de pago.'
      : 'Le damos la bienvenida a Airtek Empresas. Le envío su carta de bienvenida con los datos de su servicio' + (tipo === 'ambas' ? ' y la proforma de instalación.' : '.')) + ' Quedo a su orden. Gracias.';
    copiar(D.telFmt(num));
    if(puedeCompartir()){
      try { await navigator.share({ files, text: msj }); }
      catch (e) { if(e && e.name === 'AbortError') return; toast('No se pudo abrir Compartir. Intenta de nuevo', 'error'); return; }
    } else {
      files.forEach((f) => window.Archivos.descargar(f, f.name));
      window.open(C.enlaceWa(num, msj), '_blank', 'noopener');
      toast('PDF descargado y número copiado. Arrástralo al chat');
    }
    anotarEnvio(tipo, 'whatsapp', D.telFmt(num));
  }
  async function enviarCorreo(){
    $('eEnv').textContent = ''; const c = F.cliente; const sv = (F.servicios || []).find((x) => x.id === env.servicio); const k = sv.carta || {};
    if(!c.correo){ $('eEnv').textContent = 'Este cliente no tiene correo guardado. Escríbelo en Documentos, en Contacto.'; return; }
    const tipo = k.puede ? 'ambas' : 'proforma'; const D = window.Documentos; let files;
    try { files = archivosEnvio(tipo); } catch (e) { toast('No se pudo armar el PDF. Intenta de nuevo', 'error'); return; }
    const nombre = D.limpiarNombre(c.nombre); const asunto = 'Bienvenido a Airtek Empresas: ' + nombre;
    const cuerpo = (c.es_natural ? 'Estimado(a) ' + nombre + ':' : 'Estimados señores de ' + nombre + ':') + '\n\nReciban un cordial saludo. ' + (tipo === 'ambas'
        ? 'Les damos la bienvenida a Airtek Empresas.\n\nAdjuntamos la carta de bienvenida con los datos de su servicio (contrato N° ' + String(sv.codigo).replace(/^0+/, '') + ') y la proforma de instalación con las opciones de pago.'
        : 'Adjuntamos la proforma de instalación de su servicio de internet (contrato N° ' + String(sv.codigo).replace(/^0+/, '') + '), con las opciones de pago.') +
      '\n\nQuedamos a su disposición para cualquier consulta.\n\nAtentamente,\n' + (F.yo.nombre || 'Airtek Empresas') + '\nAirtek Empresas\n0412 247 8343';
    if(puedeCompartir()){
      copiar(c.correo);
      try { await navigator.share({ files, title: asunto, text: cuerpo }); }
      catch (e) { if(e && e.name === 'AbortError') return; toast('No se pudo abrir Compartir. Intenta de nuevo', 'error'); return; }
    } else {
      files.forEach((f) => window.Archivos.descargar(f, f.name));
      location.href = C.enlaceCorreo(c.correo, asunto, cuerpo);
      toast(plural(files.length, 'PDF descargado', 'PDF descargados') + '. Adjúntalos al correo que se abrió');
    }
    anotarEnvio(tipo, 'correo', c.correo);
  }
  function verPdf(tipo){
    let f; try { f = archivosEnvio(tipo)[0]; } catch (e) { toast('No se pudo armar el PDF. Intenta de nuevo', 'error'); return; }
    const u = URL.createObjectURL(f); const w = window.open(u, '_blank');
    if(!w) window.Archivos.descargar(f, f.name);
    setTimeout(() => URL.revokeObjectURL(u), 120000);
  }

  // ---------- Comisión ----------
  function pintarComision(){
    const c = F.cliente; const lista = F.comision || [];
    let h = '';
    if(!lista.length){
      h += '<div class="serv" style="margin-top:12px"><div class="l1"><b>Todavía no cuenta</b>' + (c.por_instalar ? '<span class="chip azul">Por instalar</span>' : '') + '</div><p>' +
        (c.por_instalar ? 'La comisión empieza a contar cuando se instale el servicio. Adelantar los documentos ayuda a cumplir en el mismo corte.' : 'Este cliente no tiene instalaciones cargadas en la app.') + '</p></div>';
    }
    const ET = { cumple: ['verde', 'Cumple'], en_curso: ['ambar', 'En curso'], ultimo_corte: ['rojo', 'Último corte'], perdida: ['rojo', 'Se perdió'], no_comisiona: ['', 'No comisiona'] };
    lista.forEach((i) => {
      const e = ET[i.estado] || ['', i.estado]; const legalOk = !!c.legal_ok_en;
      const corteTxt = i.estado === 'no_comisiona' ? 'Los dedicados no comisionan' : i.estado === 'cumple' ? 'Entra en el corte de ' + mes(i.corte_pago || i.corte)
        : i.estado === 'perdida' ? 'No cumplió en ' + mes(i.corte) + ' ni en el corte siguiente' : i.estado === 'ultimo_corte' ? 'Era de ' + mes(i.corte) + '. Cierra el ' + fecha(F.corte.fin)
        : 'Corte de ' + mes(i.corte) + ', cierra el ' + fecha(F.corte.fin).split(' de ')[0];
      h += '<div class="secc">' + esc(i.sucursal + '-' + i.codigo) + '<span class="der">Instalado el ' + esc(fecha(i.instalada_en)) + '</span></div><div class="datos" data-instalacion="' + i.id + '">' +
        fila('Estado', '<span class="chip ' + e[0] + '">' + e[1] + '</span>') + fila('Corte', esc(capital(corteTxt))) +
        (i.comisiona ? fila('Legal', legalOk ? '<span class="chip verde">Cumple</span> ' + esc(fecha(c.legal_ok_en)) : chipEstatus(c.estatus)) +
          fila('Instalación', (i.pago_ok_en ? '<span class="chip verde">Pagada</span> ' + esc(fecha(i.pago_ok_en)) + (i.pago_manual ? ' · a mano' : '') : '<span class="chip">Debe instalación</span>') +
            (F.puedo.pago ? '<button type="button" class="enlace" data-pago="' + i.id + '" data-pagada="' + (i.pago_ok_en ? '0' : '1') + '" style="margin-left:auto">' + (i.pago_ok_en ? 'Quitar pago' : 'Marcar pagada') + '</button>' : '')) : '') + '</div>';
    });
    $('tab-comision').innerHTML = h;
  }

  // ---------- Pestañas ----------
  function irTab(t, sinUrl){
    if(TABS.indexOf(t) < 0) t = 'datos';
    tab = t;
    Array.prototype.forEach.call($('tabs').querySelectorAll('button'), (b) => { const on = b.dataset.tab === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    TABS.forEach((x) => $('tab-' + x).classList.toggle('on', x === t));
    const cu = $('cuerpoFicha'); if(cu && !sinUrl) cu.scrollTop = 0;
  }

  // ---------- Acciones sencillas ----------
  async function accion(nombre, args, mensaje, boton){
    if(boton) boton.disabled = true;
    try { await rpc(nombre, args); if(mensaje) toast(mensaje); await cargar(); return true; }
    catch (e) { toast(e.message, 'error'); if(boton && document.contains(boton)) boton.disabled = false; return false; }
  }
  function pedir(motivo){
    window.Pedir.abrir(clienteContacto(), { yo: yo.nombre, motivo: motivo || undefined, alHacer: () => cargar() });
  }
  async function guardarNota(e){
    e.preventDefault();
    const inp = $('nota'); const t = inp.value.trim(); if(!t){ inp.focus(); return; }
    const b = e.target.querySelector('button'); b.disabled = true;
    try { await rpc('cliente_nota', { p_cliente: id, p_texto: t }); inp.value = ''; toast('Nota guardada'); await cargar(); }
    catch (err) { toast(err.message, 'error'); b.disabled = false; }
  }

  // ---------- Hoja pequeña: contacto del representante o correo de la empresa ----------
  function abrirCampo(clave){
    const h = $('hojaCampo'); const F = fuera ? fuera.F : FF();
    if(String(clave).indexOf('ip:') === 0){
      const sv = (F.servicios || []).find((x) => String(x.id) === String(clave).slice(3)); if(!sv) return;
      campo = { tipo: 'ip', servicio: sv.id };
      h.innerHTML = cabHoja('tCampo', 'IP del servicio', sv.sucursal + '-' + sv.codigo + (sv.plan ? ' · ' + sv.plan : '')) + '<form id="formCampo" novalidate>' +
        '<label class="rotulo" for="cIp">IPv4</label><input class="campo" id="cIp" inputmode="decimal" autocapitalize="none" autocomplete="off" spellcheck="false" maxlength="18" value="' + esc(sv.ip || '') + '" data-foco>' +
        '<label class="rotulo arriba" for="cIp6">IPv6 (opcional)</label><input class="campo" id="cIp6" autocapitalize="none" autocomplete="off" spellcheck="false" maxlength="43" value="' + esc(sv.ip6 || '') + '">' +
        '<p class="nota">Sale en la carta de bienvenida. Si la dejas vacía, la carta dice "Pendiente por asignar".</p>' +
        '<div class="error" id="eCampo" role="alert"></div><div class="acciones"><button type="submit" class="btn btn-ancho" id="guardarCampo">Guardar</button></div></form>';
      abrirHoja('hojaCampo'); return;
    }
    if(clave === 'correo_empresa'){
      campo = { tipo: 'empresa' };
      h.innerHTML = cabHoja('tCampo', 'Correo de la empresa', F.cliente.nombre) + '<form id="formCampo" novalidate><label class="rotulo" for="cCorreo">Correo de la empresa</label>' +
        '<input class="campo" id="cCorreo" type="email" inputmode="email" autocapitalize="none" autocomplete="off" maxlength="120" value="' + esc(F.cliente.correo_empresa || '') + '" data-foco><div class="error" id="eCampo" role="alert"></div>' +
        '<div class="acciones"><button type="submit" class="btn btn-ancho" id="guardarCampo">Guardar</button></div></form>';
    } else {
      const n = Number(String(clave).split(':')[1]); const r = (F.representantes || []).find((x) => x.orden === n) || {};
      campo = { tipo: 'rep', orden: n };
      h.innerHTML = cabHoja('tCampo', (F.cliente.es_natural ? 'Contacto del titular' : 'Contacto del representante ' + n), 'El nombre lo llena el análisis de documentos') + '<form id="formCampo" novalidate>' +
        '<label class="rotulo" for="cCorreo">Correo</label><input class="campo" id="cCorreo" type="email" inputmode="email" autocapitalize="none" autocomplete="off" maxlength="120" value="' + esc(r.correo || '') + '" data-foco>' +
        '<label class="rotulo arriba" for="cTel">Teléfono</label><input class="campo" id="cTel" type="tel" inputmode="tel" autocomplete="off" maxlength="20" value="' + esc(r.telefono || '') + '">' +
        '<div class="error" id="eCampo" role="alert"></div><div class="acciones"><button type="submit" class="btn btn-ancho" id="guardarCampo">Guardar</button></div></form>';
    }
    abrirHoja('hojaCampo');
  }
  function cabHoja(idTitulo, titulo, sub){
    return '<div class="cab"><div><h2 id="' + idTitulo + '">' + esc(titulo) + '</h2>' + (sub ? '<p class="sub-hoja">' + esc(sub) + '</p>' : '') + '</div><button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>';
  }
  async function guardarCampo(e){
    e.preventDefault(); if(!campo) return;
    const b = $('guardarCampo'); const co = $('cCorreo') ? $('cCorreo').value.trim() : ''; $('eCampo').textContent = '';
    if(co && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(co)){ $('eCampo').textContent = 'Ese correo no parece válido'; return; }
    const f = fuera; const cli = f ? f.cliente : id;
    b.disabled = true; b.textContent = 'Guardando…';
    try {
      if(campo.tipo === 'ip') await rpc('servicio_ip', { p_servicio: campo.servicio, p_ip: $('cIp').value.trim(), p_ip6: $('cIp6').value.trim() });
      else if(campo.tipo === 'empresa') await rpc('cliente_dato', { p_cliente: cli, p_campo: 'correo_empresa', p_valor: co });
      else await rpc('cliente_representante', { p_cliente: cli, p_orden: campo.orden, p_correo: co, p_telefono: $('cTel').value.trim() });
      toast('Guardado'); if(hojaAbierta() === 'hojaCampo') cerrarHoja();
      if(f){ if(f.alTerminar) f.alTerminar(); } else await cargar();
    } catch (err) { $('eCampo').textContent = err.message; b.disabled = false; b.textContent = 'Guardar'; }
  }

  // ---------- Hoja de estatus ----------
  function abrirEstatus(){
    const act = F.cliente.estatus;
    $('hojaEstatus').innerHTML = cabHoja('tEstatus', 'Cambiar estatus', 'Los de documentos se mueven solos. Aquí se cambia a mano.') +
      '<div class="motivos" role="radiogroup" aria-label="Estatus">' + Object.keys(C.ESTATUS).map((k) => '<button type="button" role="radio" aria-checked="' + (k === act) + '" class="mot' + (k === act ? ' on' : '') + '" data-estatus="' + k + '"><i></i>' + esc(C.ESTATUS[k].t) + '</button>').join('') + '</div>' +
      '<div class="acciones"><button type="button" class="btn btn-ancho" id="guardarEstatus" disabled>Guardar</button></div>';
    abrirHoja('hojaEstatus');
  }

  // ---------- Subir archivos ----------
  function nombreSeguro(nombre, mime){
    const ext = mime === 'application/pdf' ? 'pdf' : mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const base = normalizeStr(String(nombre || 'archivo').replace(/\.[a-z0-9]{2,5}$/i, '')).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'archivo';
    return base + '.' + ext;
  }
  function leerImagen(file){
    return new Promise((ok, mal) => {
      const url = URL.createObjectURL(file); const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); ok(img); };
      img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('No se pudo leer la foto "' + file.name + '". Envíala en JPG o en PDF')); };
      img.src = url;
    });
  }
  // Las fotos se achican antes de subir: pesan menos y suben rápido con mala señal
  async function preparar(file){
    const esImagen = /^image\//.test(file.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
    const esPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if(!esImagen && !esPdf) throw new Error('"' + file.name + '" no es una foto ni un PDF');
    if(esPdf){
      if(file.size > MAX_ARCHIVO) throw new Error('"' + file.name + '" pesa más de 15 MB');
      return { blob: file, mime: 'application/pdf', nombre: file.name, tamano: file.size };
    }
    const img = await leerImagen(file);
    const esc2 = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(img.naturalWidth * esc2)); cv.height = Math.max(1, Math.round(img.naturalHeight * esc2));
    const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
    const blob = await new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.82));
    if(!blob) throw new Error('No se pudo preparar la foto "' + file.name + '"');
    if(TIPOS.indexOf(file.type) >= 0 && file.type !== 'image/png' && file.size <= blob.size) return { blob: file, mime: file.type, nombre: file.name, tamano: file.size };
    if(blob.size > MAX_ARCHIVO) throw new Error('"' + file.name + '" pesa más de 15 MB');
    return { blob, mime: 'image/jpeg', nombre: file.name, tamano: blob.size };
  }
  function avance(texto){
    const z = $('estadoSubida'); if(z){ z.classList.remove('hidden'); const t = $('textoSubida'); if(t) t.textContent = texto; }
    const q = $('subidaCom'); if(q){ q.classList.remove('hidden'); q.lastChild.textContent = texto; }
    const p = $('progLote'); if(p) p.textContent = texto;
  }
  // items: [{ files:[File], casillas:[{casilla,numero}], vence_en, firmado_en }]
  async function guardarItems(items){
    if(ocupado) return false;
    const f = fuera; fuera = null;
    ocupado = true; const total = items.reduce((a, it) => a + it.files.length, 0); let hecho = 0; const cli = f ? f.cliente : id;   // el cliente de esta subida, aunque después se abra otro
    Array.prototype.forEach.call(document.querySelectorAll('[data-subir],#subirVarios'), (b) => { b.disabled = true; });
    try {
      const envio = [];
      for(const it of items){
        const archivos = [];
        for(const file of it.files){
          hecho++; avance('Subiendo ' + hecho + ' de ' + total + '…');
          const pr = await preparar(file);
          const ruta = cli + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + '-' + nombreSeguro(pr.nombre, pr.mime);
          const r = await db.storage.from('expedientes').upload(ruta, pr.blob, { contentType: pr.mime, upsert: false });
          if(r.error) throw new Error(C.mensajeError(r.error, 'No se pudo subir "' + file.name + '". Intenta de nuevo'));
          archivos.push({ ruta, nombre: file.name.slice(0, 200), mime: pr.mime, tamano: pr.tamano });
        }
        envio.push({ archivos, casillas: it.casillas, vence_en: it.vence_en || null, firmado_en: it.firmado_en || null });
      }
      avance('Guardando…');
      const n = await rpc('documentos_registrar', { p_cliente: cli, p_items: envio });
      toast(plural(n, 'documento guardado', 'documentos guardados'));
      ocupado = false; if(f){ if(f.alTerminar) f.alTerminar(); } else if(cli === id) await cargar();
      return true;
    } catch (e) {
      ocupado = false; toast(e.message, 'error'); if(f){ if(f.alTerminar) f.alTerminar(); } else if(cli === id && F) pintarDocumentos();
      return false;
    }
  }
  function elegirPara(cas, num){
    if(ocupado){ toast('Espera a que termine la subida'); return; }
    destino = { casilla: cas, numero: num };
    const inp = $('archivo'); inp.value = ''; inp.click();
  }
  function alElegir(){
    const files = Array.prototype.slice.call($('archivo').files || []); if(!files.length || !destino) return;
    const d = destino; destino = null;
    if(d.casilla.indexOf('contrato_') === 0){ abrirFechas(d, files); return; }
    guardarItems([{ files, casillas: [d] }]);
  }
  // El contrato pide la fecha de firma antes de guardarse
  function abrirFechas(d, files){
    campo = { tipo: 'contrato', destino: d, files };
    $('hojaCampo').innerHTML = cabHoja('tCampo', casilla(d.casilla, 0), files.length === 1 ? files[0].name : files.length + ' archivos') + '<form id="formFechas" novalidate>' +
      '<label class="rotulo" for="cFirma">Fecha de firma</label><input class="campo" id="cFirma" type="date" max="' + esc(F.hoy) + '" data-foco><div class="error" id="eCampo" role="alert"></div>' +
      '<label class="rotulo" for="cVence">Fecha de vencimiento (opcional)</label><input class="campo" id="cVence" type="date">' +
      '<p class="nota">Al guardarlo con fecha de firma, el cliente pasa a Contrato firmado.</p>' +
      '<div class="acciones"><button type="submit" class="btn btn-ancho">Subir contrato</button></div></form>';
    abrirHoja('hojaCampo');
  }
  function guardarFechas(e){
    e.preventDefault(); const f = $('cFirma').value; const v = $('cVence').value;
    if(!f){ $('eCampo').textContent = 'Pon la fecha en que se firmó'; return; }
    if(v && v <= f){ $('eCampo').textContent = 'El vencimiento debe ser después de la firma'; return; }
    const c = campo; cerrarHoja(); irTab('documentos');
    guardarItems([{ files: c.files, casillas: [c.destino], firmado_en: f, vence_en: v || null }]);
  }

  // ---------- Subir varios ----------
  function opcionesLote(){
    const c = F.cliente; const o = [];
    const nReq = !c.es_natural && c.regimen_firma === 'conjunta' ? 2 : 1;
    const nReps = Math.max(nReq, (F.representantes || []).reduce((a, r) => Math.max(a, r.orden), 1));
    if(!c.es_natural){ o.push({ k: 'rif_empresa:0', t: 'RIF de la empresa' }, { k: 'acta_constitutiva:0', t: 'Acta constitutiva' }, { k: 'acta_asamblea:auto', t: 'Acta de asamblea', libre: true }); if(c.es_isp) o.push({ k: 'conatel:0', t: 'Permiso de Conatel' }); }
    for(let n = 1; n <= nReps; n++){ const suf = c.es_natural ? '' : ' rep. ' + n; o.push({ k: 'cedula:' + n, t: 'Cédula' + suf }, { k: 'rif_personal:' + n, t: (c.es_natural ? 'RIF personal' : 'RIF') + suf }); }
    o.push({ k: 'otro:0', t: 'Otro', libre: true });
    return o;
  }
  function soltarMinis(){ lote.forEach((it) => (it.minis || []).forEach((u) => URL.revokeObjectURL(u))); }
  function abrirVarios(){ soltarMinis(); lote = []; pintarVarios(); abrirHoja('hojaVarios'); }
  function agregarLote(files){
    const buenos = []; const malos = [];
    files.forEach((f) => { const ok = /^image\//.test(f.type) || f.type === 'application/pdf' || /\.(jpe?g|png|webp|heic|heif|pdf)$/i.test(f.name); (ok ? buenos : malos).push(f); });
    if(malos.length) toast(plural(malos.length, 'archivo no es', 'archivos no son') + ' foto ni PDF y no se agregó', 'error');
    if(lote.length + buenos.length > 30){ toast('Sube hasta 30 archivos de una vez', 'error'); return; }
    const fotos = buenos.filter((f) => !(f.type === 'application/pdf' || /\.pdf$/i.test(f.name))); const pdfs = buenos.filter((f) => fotos.indexOf(f) < 0);
    pdfs.forEach((f) => lote.push({ files: [f], marcas: {}, minis: [] }));
    // Varias fotos elegidas juntas suelen ser las caras de un mismo documento
    if(fotos.length) lote.push({ files: fotos, marcas: {}, minis: fotos.slice(0, 1).map((f) => URL.createObjectURL(f)) });
    pintarVarios();
  }
  function pintarVarios(){
    const ops = opcionesLote(); const sinMarcar = lote.filter((it) => !Object.keys(it.marcas).length).length;
    const filas = lote.map((it, n) => {
      const pdf = it.files[0].type === 'application/pdf' || /\.pdf$/i.test(it.files[0].name);
      const mini = pdf ? 'PDF' : it.minis[0] ? '<img src="' + esc(it.minis[0]) + '" alt="">' : 'Foto';
      const marcadas = Object.keys(it.marcas);
      return '<div class="arch" data-item="' + n + '"><span class="mini">' + mini + '</span><div>' +
        '<div class="nom"><span>' + esc(it.files.length > 1 ? it.files.length + ' fotos: ' + it.files.map((f) => f.name).join(', ') : it.files[0].name) + '</span>' +
          '<button type="button" class="quitar" data-quitar="' + n + '" aria-label="Quitar este archivo">' + ic('x') + '</button></div>' +
        '<div class="checks" role="group" aria-label="Qué trae">' + ops.map((o) => '<button type="button" class="ck' + (it.marcas[o.k] ? ' on' : '') + '" aria-pressed="' + !!it.marcas[o.k] + '" data-marca="' + o.k + '">' + ic('check') + esc(o.t) + '</button>').join('') + '</div>' +
        (it.files.length > 1 ? '<button type="button" class="enlace" data-separar="' + n + '">Son documentos distintos: separar las fotos</button>' : '') +
        (!marcadas.length ? '<div class="nota2" style="color:var(--rojo)">Marca qué trae para poder guardarlo.</div>'
          : marcadas.length > 1 ? '<div class="nota2" style="color:var(--text2)">Trae ' + marcadas.length + ' documentos: queda en las ' + marcadas.length + ' casillas sin cortarlo.</div>' : '') +
        (marcadas.some((k) => { const p = k.split(':'); return p[1] !== 'auto' && p[0] !== 'otro' && docDe(p[0], Number(p[1])); }) ? '<div class="nota2" style="color:var(--ambar)">Reemplaza el que ya está en esa casilla.</div>' : '') +
        '</div></div>';
    }).join('');
    $('hojaVarios').innerHTML = '<div class="hoja-cab"><div class="tx"><b id="tVarios">Subir varios</b><small>' + esc(F.cliente.nombre) + '</small></div><button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      '<div class="hoja-cuerpo"><button type="button" class="soltar" id="soltar" data-foco>' + ic('subir', 'g') + '<b>' + (lote.length ? 'Agregar más archivos' : 'Elige todos los archivos juntos') + '</b>Después marca qué trae cada uno.</button>' +
        (lote.length ? '<div class="secc">' + plural(lote.length, 'archivo', 'archivos') + '. Marca qué trae cada uno</div>' + filas : '<p class="nota-chica" style="text-align:center;margin-top:14px">Fotos o PDF. Un escaneo con varios documentos se puede marcar en varias casillas.</p>') + '</div>' +
      '<div class="hoja-pie col"><button type="button" class="btn" id="guardarLote"' + (!lote.length || sinMarcar ? ' disabled' : '') + '>Guardar' + (lote.length ? ' ' + lote.length : '') + '</button>' +
        '<p id="progLote">' + (!lote.length ? 'Todavía no has elegido archivos.' : sinMarcar ? 'Falta marcar ' + plural(sinMarcar, 'archivo', 'archivos') + '.' : 'Todo marcado. Quedan por revisar al guardar.') + '</p></div>';
  }
  async function guardarLote(){
    const libres = [1, 2, 3, 4].filter((n) => !docDe('acta_asamblea', n)); const items = [];
    for(const it of lote){
      const cas = [];
      for(const k of Object.keys(it.marcas)){
        const p = k.split(':');
        if(p[1] === 'auto'){ const n = libres.shift(); if(!n){ toast('Ya están las 4 actas de asamblea. Para cambiar una, reemplázala desde su casilla', 'error'); return; } cas.push({ casilla: p[0], numero: n }); }
        else cas.push({ casilla: p[0], numero: Number(p[1]) });
      }
      items.push({ files: it.files, casillas: cas });
    }
    const b = $('guardarLote'); b.disabled = true; b.textContent = 'Subiendo…';
    const ok = await guardarItems(items);
    if(ok){ soltarMinis(); lote = []; if(hojaAbierta() === 'hojaVarios'){ cerrarHoja(); irTab('documentos'); } }
    else if(hojaAbierta() === 'hojaVarios') pintarVarios();
  }

  // ---------- Ver y revisar un documento ----------
  function abrirRevision(){ const cola = porRevisar().map((d) => d.id); if(!cola.length) return; irTab('documentos'); soltarBlobs(); ver = { docId: cola[0], cola, paso: 'ver', motivo: null, archivo: 0, url: {} }; pintarVer(); abrirHoja('hojaVer'); cargarArchivo(); }
  function abrirVer(docId){ soltarBlobs(); ver = { docId, cola: null, paso: 'ver', motivo: null, archivo: 0, url: {} }; pintarVer(); abrirHoja('hojaVer'); cargarArchivo(); }
  function docVer(){ return (F.documentos || []).find((d) => d.id === ver.docId); }
  function pintarVer(){
    const d = docVer(); const h = $('hojaVer');
    if(!d){ cerrarHoja(); return; }
    const titulo = casilla(d.casilla, d.numero);
    const pos = ver.cola ? ver.cola.indexOf(d.id) + 1 : 0;
    const cab = '<div class="hoja-cab"><div class="tx"><b id="tVer">' + esc(titulo) + '</b><small>' + esc(F.cliente.nombre) + (ver.cola ? ' · Documento ' + pos + ' de ' + ver.cola.length : '') + '</small></div><button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>';
    if(ver.paso === 'devolver'){
      h.classList.add('angosta');
      h.innerHTML = cab + '<div class="hoja-cuerpo"><h2 style="font-size:20px;font-weight:800;margin-bottom:14px">¿Por qué lo devuelves?</h2><div class="motivos" role="radiogroup" aria-label="Motivo">' +
        Object.keys(C.MOTIVOS).map((k) => '<button type="button" role="radio" aria-checked="' + (ver.motivo === k) + '" class="mot' + (ver.motivo === k ? ' on' : '') + '" data-motivo="' + k + '"><i></i>' + esc(C.MOTIVOS[k]) + '</button>').join('') + '</div>' +
        '<label class="rotulo arriba" for="notaDev">Nota para ' + esc(liderCorto()) + (ver.motivo === 'otro' ? '' : ' (opcional)') + '</label><textarea class="area corta" id="notaDev" maxlength="500">' + esc(ver.nota || '') + '</textarea><div class="error" id="eDev" role="alert"></div></div>' +
        '<div class="hoja-pie"><button type="button" class="btn btn-2" id="devVolver">Volver</button><button type="button" class="btn btn-peligro" id="devConfirmar"' + (ver.motivo ? '' : ' disabled') + '>Devolver a ' + esc(liderCorto()) + '</button></div>';
      return;
    }
    h.classList.remove('angosta');
    const arch = d.archivos || []; const a = arch[ver.archivo] || arch[0];
    const paginas = arch.length > 1 ? '<div class="paginas">' + arch.map((x, n) => '<button type="button" data-archivo="' + n + '" class="' + (n === ver.archivo ? 'on' : '') + '">Archivo ' + (n + 1) + '</button>').join('') + '</div>' : '';
    const estado = d.estado === 'aprobado' ? '<span class="chip verde">Aprobado</span>' : d.estado === 'devuelto' ? '<span class="chip rojo">Devuelto</span>' : '<span class="chip ambar">Por revisar</span>';
    const info = '<div class="datos" style="margin-top:0">' + fila('Estado', estado + (d.revisado_por ? ' ' + esc(primerNombre(d.revisado_por)) + ', ' + esc(dia(d.revisado_en).toLowerCase()) : '')) +
      fila('Subido', esc(dia(d.subido_en)) + (d.subido_por ? ' por ' + esc(d.subido_por) : '')) +
      (d.estado === 'devuelto' ? fila('Motivo', esc(C.MOTIVOS[d.motivo] || '') + (d.nota ? '. ' + esc(d.nota) : '')) : '') +
      (d.firmado_en ? fila('Firmado', esc(fecha(d.firmado_en, true))) : '') +
      (!F.puedo.revisar && d.vence_en ? fila('Vence', esc(fecha(d.vence_en, true))) : '') +
      ((d.comparte || []).length ? fila('También trae', esc(C.lista(d.comparte.map((x) => casilla(x.casilla, x.numero))))) : '') +
      (a ? fila('Archivo', esc(a.nombre || '')) : '') + '</div>' +
      (F.puedo.revisar ? '<label class="rotulo arriba" for="venceDoc">Fecha de vencimiento (opcional)</label><input class="campo" id="venceDoc" type="date" value="' + esc(d.vence_en || '') + '">' +
        '<p class="nota">Sirve para avisar antes de que se venza.</p>' : '');
    const puedeSubir = !(d.casilla.indexOf('contrato_') === 0 && !F.puedo.contrato);
    const pie = F.puedo.revisar
      ? '<div class="hoja-pie"><button type="button" class="btn btn-peligro" id="verDevolver">Devolver</button><button type="button" class="btn" id="verAprobar">' + (d.estado === 'aprobado' ? 'Guardar' : ver.cola && pos < ver.cola.length ? 'Aprobar y seguir' : 'Aprobar') + '</button></div>'
      : '<div class="hoja-pie">' + (puedeSubir ? '<button type="button" class="btn btn-2" id="verReemplazar">Reemplazar</button>' : '') + '<button type="button" class="btn" data-cierra="1">Cerrar</button></div>';
    h.innerHTML = cab + '<div class="hoja-cuerpo"><div class="revisar-cols"><section><div class="visor" id="visor"><span class="cargando-linea"><i></i>Abriendo el archivo</span></div>' + paginas +
      '<div class="visor-pie"><span>' + (arch.length > 1 ? 'Archivo ' + (ver.archivo + 1) + ' de ' + arch.length : '') + '</span><a class="enlace hidden" id="abrirCompleto" target="_blank" rel="noopener">Abrir completo</a></div></section>' +
      '<section style="margin-top:14px">' + info + '</section></div></div>' + pie;
    if(ver.url[ver.archivo] !== undefined) mostrarArchivo();
  }
  function papel(texto){ return '<div><div class="papel"><i></i><i style="width:70%"></i><i></i><i></i><i style="width:55%"></i><i></i><i style="width:80%"></i></div>' + esc(texto) + '</div>'; }
  function mostrarArchivo(){
    const d = docVer(); const z = $('visor'); if(!d || !z) return;
    const a = (d.archivos || [])[ver.archivo]; const url = ver.url[ver.archivo]; const ab = $('abrirCompleto');
    if(!a || !url){ z.innerHTML = papel(a && !a.ruta && !a.url_externa ? 'Archivo de ejemplo. No tiene imagen guardada.' : ((ver.fallo || {})[ver.archivo] ? ver.fallo[ver.archivo] + '.' : 'No se pudo abrir el archivo. Cierra y vuelve a intentar.')); return; }
    if(ab){ ab.href = url; ab.classList.remove('hidden'); }
    const pdf = a.mime === 'application/pdf' || /\.pdf$/i.test(a.nombre || '');
    const imagen = /^image\//i.test(a.mime || '') || /\.(jpe?g|png|gif|webp)$/i.test(a.nombre || '');
    if(!pdf && !imagen){ if(ab) ab.classList.add('hidden'); z.innerHTML = '<div>' + papel('Este archivo no se puede ver aquí') + '<button type="button" class="btn btn-chico" id="bajarArch" data-url="' + esc(url) + '" data-nombre="' + esc(a.nombre || 'archivo') + '" style="margin-top:12px">Descargar el archivo</button></div>'; }
    else if(!pdf) z.innerHTML = '<img src="' + esc(url) + '" alt="' + esc(casilla(d.casilla, d.numero)) + '">';
    else if(window.matchMedia('(min-width:900px)').matches) z.innerHTML = '<iframe src="' + esc(url) + '" title="' + esc(casilla(d.casilla, d.numero)) + '"></iframe>';
    else z.innerHTML = '<div>' + papel('Documento en PDF') + '<a class="btn btn-chico" href="' + esc(url) + '" target="_blank" rel="noopener" style="margin-top:12px">Abrir el PDF</a></div>';
  }
  // Los archivos de Drive los entrega la función drive_archivo (la base revisa el permiso); quedan en memoria mientras el visor esté abierto
  let blobs = [];
  function soltarBlobs(){ blobs.forEach((u) => { try { URL.revokeObjectURL(u); } catch (e) {} }); blobs = []; }
  async function bajarDeDrive(a){
    let tk = '';
    try { const s = await db.auth.getSession(); tk = (s.data && s.data.session && s.data.session.access_token) || ''; } catch (e) {}
    if(!tk) throw new Error('Tu sesión venció. Entra de nuevo');
    let r;
    try { r = await fetch(db.supabaseUrl + '/functions/v1/drive_archivo', { method: 'POST', headers: { Authorization: 'Bearer ' + tk, apikey: db.supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ archivo: a.id }) }); }
    catch (e) { throw new Error('Sin conexión. Revisa el internet'); }
    if(!r.ok){ let m = ''; try { m = String((await r.json()).error || ''); } catch (e) {} throw new Error(m.replace(/\.$/, '') || 'No se pudo abrir el archivo'); }
    let b;
    try { b = await r.blob(); } catch (e) { throw new Error('Se cortó la conexión mientras bajaba el archivo'); }
    const u = URL.createObjectURL(b); blobs.push(u); return u;
  }
  // Pide un enlace temporal al almacenamiento privado, o el archivo a Drive
  async function cargarArchivo(){
    const d = docVer(); if(!d) return;
    const n = ver.archivo; const a = (d.archivos || [])[n]; const mio = ver;
    if(!a){ ver.url[n] = ''; mostrarArchivo(); return; }
    if(ver.url[n] !== undefined){ mostrarArchivo(); return; }
    let url = '';
    if(a.ruta){
      try { const r = await db.storage.from('expedientes').createSignedUrl(a.ruta, 600); if(!r.error && r.data) url = r.data.signedUrl || ''; } catch (e) {}
    } else if(a.url_externa && a.id){
      try { url = await bajarDeDrive(a); }
      catch (e) { if(mio === ver){ ver.fallo = ver.fallo || {}; ver.fallo[n] = e.message; } }
    }
    if(mio !== ver || ver.docId !== d.id) return;
    ver.url[n] = url; mostrarArchivo();
  }
  async function revisar(accionRev){
    const d = docVer(); if(!d) return;
    const args = { p_documento: d.id, p_accion: accionRev, p_motivo: null, p_nota: null, p_vence: null };
    if(accionRev === 'aprobar'){ const v = $('venceDoc'); args.p_vence = v && v.value ? v.value : null; }
    else {
      ver.nota = $('notaDev').value.trim();
      if(!ver.motivo){ $('eDev').textContent = 'Elige un motivo'; return; }
      if(ver.motivo === 'otro' && !ver.nota){ $('eDev').textContent = 'Escribe el motivo en la nota'; $('notaDev').focus(); return; }
      args.p_motivo = ver.motivo; args.p_nota = ver.nota || null;
    }
    const b = $(accionRev === 'aprobar' ? 'verAprobar' : 'devConfirmar'); b.disabled = true;
    try { await rpc('documento_revisar', args); }
    catch (e) { toast(e.message, 'error'); if(document.contains(b)) b.disabled = false; return; }
    toast(accionRev === 'aprobar' ? 'Aprobado' : 'Devuelto a ' + liderCorto());
    if(!ver || hojaAbierta() !== 'hojaVer'){ cargar(); return; }   // cerraron el visor mientras guardaba
    const cola = ver.cola; const actual = d.id;
    try {
      F = await rpc('cliente_ficha', { p_cliente: id });
      // Sigue con el próximo que quede por revisar; si no hay, cierra
      const sig = cola ? cola.slice(cola.indexOf(actual) + 1).find((x) => { const y = (F.documentos || []).find((z) => z.id === x); return y && y.estado === 'por_revisar'; }) : null;
      if(sig){ soltarBlobs(); ver = { docId: sig, cola, paso: 'ver', motivo: null, archivo: 0, url: {} }; pintarTodo(); cargarArchivo(); }
      else { ver = null; cerrarHoja(); pintarTodo(); if(cola) toast('Listo. No quedan documentos por revisar'); }
    } catch (e) { ver = null; if(hojaAbierta() === 'hojaVer') cerrarHoja(); toast('Quedó guardado, pero no se pudo actualizar la pantalla. Cierra y abre el cliente', 'error'); }
  }

  // ---------- Eventos ----------
  document.addEventListener('click', (e) => {
    const t = e.target;
    let b;
    if(t.closest('#hojaFicha #reintentar')){ cargar(true); return; }
    if((b = t.closest('#tabs [data-tab]'))){ irTab(b.dataset.tab); return; }
    if((b = t.closest('[data-paso]'))){
      const a = b.dataset.paso;
      if(a === 'revisar') abrirRevision(); else if(a === 'estatus') abrirEstatus(); else if(a.indexOf('pedir:') === 0) pedir(a.slice(6)); else if(a.indexOf('tab:') === 0){ irTab(a.slice(4)); const g = document.querySelector('[data-grupo="contrato"]'); if(g) g.scrollIntoView({ block: 'center' }); }
      return;
    }
    if(t.closest('#hiloMas')){ hiloTodo = true; pintarHilo(); return; }
    if((b = t.closest('[data-hilo]'))){ soloNotas = b.dataset.hilo === 'notas'; pintarHilo(); return; }
    if((b = t.closest('#hojaFicha [data-subir]'))){ fuera = null; const p = b.dataset.subir.split(':'); elegirPara(p[0], Number(p[1])); return; }
    if((b = t.closest('#hojaFicha [data-ip]'))){ fuera = null; abrirCampo('ip:' + b.dataset.ip); return; }
    if((b = t.closest('#hojaFicha [data-enviar]'))){ abrirEnviar(b.dataset.enviar); return; }
    if((b = t.closest('#hojaEnviar [data-env-tipo]')) && env){ env.tipo = b.dataset.envTipo; Array.prototype.forEach.call($('hojaEnviar').querySelectorAll('[data-env-tipo]'), (x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); }); return; }
    if((b = t.closest('[data-env-ver]')) && env){ verPdf(b.dataset.envVer); return; }
    if(t.closest('#envWa') && env){ enviarWhatsapp(); return; }
    if(t.closest('#envCorreo') && env){ enviarCorreo(); return; }
    if(t.closest('#envIp') && env){ const sid = env.servicio; cerrarHoja(); fuera = null; abrirCampo('ip:' + sid); return; }
    if((b = t.closest('#envManual')) && env){ if(b.dataset.armado !== '1'){ b.dataset.armado = '1'; b.textContent = '¿Seguro? Toca otra vez'; setTimeout(() => { if(document.contains(b)){ b.dataset.armado = ''; b.textContent = 'Ya se envió por fuera'; } }, 4000); return; }
      b.disabled = true; anotarEnvio(env.tipo, 'manual', null); return; }
    if(t.closest('#agregarActa')){ actaExtra = Math.min(4, actaExtra + 1); pintarDocumentos(); const cs = document.querySelectorAll('[data-grupo="empresa"] [data-casilla^="acta_asamblea"]'); if(cs.length) cs[cs.length - 1].scrollIntoView({ block: 'center' }); return; }
    if((b = t.closest('[data-ver]'))){ abrirVer(Number(b.dataset.ver)); return; }
    if((b = t.closest('#hojaFicha [data-campo]'))){ fuera = null; abrirCampo(b.dataset.campo); return; }
    if(t.closest('#agregarRep')){ const n = Math.max((F.representantes || []).reduce((a, x) => Math.max(a, x.orden), 1), repExtra, !F.cliente.es_natural && F.cliente.regimen_firma === 'conjunta' ? 2 : 1) + 1; repExtra = Math.min(4, n); pintarDocumentos(); const g = document.querySelector('[data-grupo="rep' + repExtra + '"]'); if(g) g.scrollIntoView({ block: 'center' }); return; }
    if(t.closest('#subirVarios')){ abrirVarios(); return; }
    if(t.closest('#revisarTodo')){ abrirRevision(); return; }
    if(t.closest('#cambiarEstatus')){ abrirEstatus(); return; }
    if((b = t.closest('[data-estatus]'))){
      Array.prototype.forEach.call($('hojaEstatus').querySelectorAll('.mot'), (x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); });
      const g = $('guardarEstatus'); g.disabled = b.dataset.estatus === F.cliente.estatus; g.dataset.valor = b.dataset.estatus; return;
    }
    if((b = t.closest('#guardarEstatus'))){ const v = b.dataset.valor; b.disabled = true; rpc('cliente_estatus', { p_cliente: id, p_estatus: v }).then(() => { toast('Estatus cambiado'); if(hojaAbierta() === 'hojaEstatus') cerrarHoja(); return cargar(); }).catch((err) => { toast(err.message, 'error'); b.disabled = false; }); return; }
    if((b = t.closest('[data-regimen]'))){ if(b.dataset.regimen !== (F.cliente.regimen_firma || '')) accion('cliente_dato', { p_cliente: id, p_campo: 'regimen_firma', p_valor: b.dataset.regimen }, 'Régimen de firma guardado', b); return; }
    if((b = t.closest('[data-interr]'))){ const nuevo = b.getAttribute('aria-checked') !== 'true'; accion('cliente_dato', { p_cliente: id, p_campo: b.dataset.interr, p_valor: String(nuevo) }, 'Guardado', b); return; }
    if((b = t.closest('[data-gestion]'))){ accion('cliente_gestion', { p_cliente: id, p_cual: b.dataset.gestion, p_hecho: b.dataset.hecho === '1' }, b.dataset.hecho === '1' ? 'Marcada como enviada' : 'Marca quitada', b); return; }
    if((b = t.closest('[data-pago]'))){ accion('instalacion_pago', { p_instalacion: Number(b.dataset.pago), p_pagada: b.dataset.pagada === '1' }, b.dataset.pagada === '1' ? 'Instalación marcada como pagada' : 'Pago quitado', b); return; }
    // Subir varios
    if(t.closest('#soltar')){ const inp = $('archivosLote'); inp.value = ''; inp.click(); return; }
    if((b = t.closest('[data-marca]'))){
      const n = Number(b.closest('.arch').dataset.item); const k = b.dataset.marca; const it = lote[n]; if(!it) return;
      if(it.marcas[k]) delete it.marcas[k];
      else { if(k.indexOf('otro') !== 0 && k.indexOf(':auto') < 0) lote.forEach((o) => { delete o.marcas[k]; }); it.marcas[k] = true; }   // una casilla fija recibe un solo archivo
      pintarVarios(); return;
    }
    if((b = t.closest('[data-quitar]'))){ const it = lote.splice(Number(b.dataset.quitar), 1)[0]; if(it) (it.minis || []).forEach((u) => URL.revokeObjectURL(u)); pintarVarios(); return; }
    if((b = t.closest('[data-separar]'))){ const n = Number(b.dataset.separar); const it = lote[n]; if(!it) return; (it.minis || []).forEach((u) => URL.revokeObjectURL(u));
      lote.splice.apply(lote, [n, 1].concat(it.files.map((f) => ({ files: [f], marcas: {}, minis: [URL.createObjectURL(f)] })))); pintarVarios(); return; }
    if(t.closest('#guardarLote')){ guardarLote(); return; }
    // Ver y revisar
    // Dentro de la hoja Chromium pierde el nombre del archivo: se descarga con un enlace suelto en la página
    if((b = t.closest('#bajarArch'))){ const x = document.createElement('a'); x.href = b.dataset.url; x.download = b.dataset.nombre || 'archivo'; x.rel = 'noopener'; document.body.appendChild(x); x.click(); x.remove(); return; }
    if((b = t.closest('[data-archivo]'))){ ver.archivo = Number(b.dataset.archivo); pintarVer(); cargarArchivo(); return; }
    if(t.closest('#verAprobar')){ revisar('aprobar'); return; }
    if(t.closest('#verDevolver')){ ver.paso = 'devolver'; ver.motivo = null; ver.nota = ''; pintarVer(); return; }
    if(t.closest('#devVolver')){ ver.paso = 'ver'; pintarVer(); return; }
    if((b = t.closest('[data-motivo]'))){ ver.nota = $('notaDev').value; ver.motivo = b.dataset.motivo; pintarVer(); return; }
    if(t.closest('#devConfirmar')){ revisar('devolver'); return; }
    if(t.closest('#verReemplazar')){ const d = docVer(); cerrarHoja(); if(d) elegirPara(d.casilla, d.numero); return; }
  });
  document.addEventListener('submit', (e) => {
    if(e.target.id === 'formNota') guardarNota(e);
    else if(e.target.id === 'formCampo') guardarCampo(e);
    else if(e.target.id === 'formFechas') guardarFechas(e);
  });
  document.addEventListener('visibilitychange', () => { if(!document.hidden && F && id && !ocupado && !encima()) cargar(); });

  // Arrastrar desde la computadora: sobre una casilla la llena; fuera de ellas abre Subir varios
  function soltarEn(e){
    const files = Array.prototype.slice.call((e.dataTransfer && e.dataTransfer.files) || []); if(!files.length || !F) return;
    e.preventDefault(); limpiarSobre();
    if(ocupado){ toast('Espera a que termine la subida'); return; }
    const c = e.target.closest('[data-suelta]');
    if(c){ const p = c.dataset.casilla.split(':'); const d = { casilla: p[0], numero: Number(p[1]) };
      if(d.casilla.indexOf('contrato_') === 0){ abrirFechas(d, files); return; }
      guardarItems([{ files, casillas: [d] }]); return; }
    abrirVarios(); agregarLote(files);
  }
  function limpiarSobre(){ Array.prototype.forEach.call(document.querySelectorAll('#tab-documentos .sobre'), (x) => x.classList.remove('sobre')); }

  function montar(){
    if(montada) return; montada = true;
    const h = document.createElement('section'); h.id = 'hojaFicha'; h.className = 'hoja lado ficha';
    h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', 'tFicha'); h.setAttribute('aria-hidden', 'true');
    h.innerHTML = '<div class="asa" aria-hidden="true"></div><div class="ficha-cab" id="cabFicha"></div>' +
      '<div class="tabs" id="tabs" role="tablist" aria-label="Secciones del cliente">' +
        '<button type="button" role="tab" data-tab="datos">Datos</button><button type="button" role="tab" data-tab="documentos">Documentos</button>' +
        '<button type="button" role="tab" data-tab="hilo">Hilo</button><button type="button" role="tab" data-tab="comision">Comisión</button></div>' +
      '<div class="ficha-cuerpo" id="cuerpoFicha"><section class="panel-tab" id="tab-datos" aria-label="Datos"></section><section class="panel-tab" id="tab-documentos" aria-label="Documentos"></section>' +
        '<section class="panel-tab" id="tab-hilo" aria-label="Hilo"></section><section class="panel-tab" id="tab-comision" aria-label="Comisión"></section></div>';
    document.body.appendChild(h);
    const mas = document.createElement('div');
    mas.innerHTML = '<input type="file" id="archivo" class="hidden" multiple accept="image/*,application/pdf" tabindex="-1" aria-hidden="true">' +
      '<input type="file" id="archivosLote" class="hidden" multiple accept="image/*,application/pdf" tabindex="-1" aria-hidden="true">' +
      '<section class="hoja completa lado" id="hojaVer" role="dialog" aria-modal="true" aria-labelledby="tVer" aria-hidden="true"></section>' +
      '<section class="hoja completa lado" id="hojaVarios" role="dialog" aria-modal="true" aria-labelledby="tVarios" aria-hidden="true"></section>' +
      '<section class="hoja" id="hojaCampo" role="dialog" aria-modal="true" aria-labelledby="tCampo" aria-hidden="true"></section>' +
      '<section class="hoja" id="hojaEstatus" role="dialog" aria-modal="true" aria-labelledby="tEstatus" aria-hidden="true"></section>' +
      '<section class="hoja" id="hojaEnviar" role="dialog" aria-modal="true" aria-labelledby="tEnviar" aria-hidden="true"></section>';
    while(mas.firstChild) document.body.appendChild(mas.firstChild);
    C.prepararHojas();
    $('archivo').addEventListener('change', alElegir);
    $('archivosLote').addEventListener('change', () => { agregarLote(Array.prototype.slice.call($('archivosLote').files || [])); });
    // En escritorio también se puede arrastrar a la hoja de Subir varios
    $('hojaVarios').addEventListener('dragover', (e) => { e.preventDefault(); const s = $('soltar'); if(s) s.classList.add('sobre'); });
    $('hojaVarios').addEventListener('dragleave', () => { const s = $('soltar'); if(s) s.classList.remove('sobre'); });
    $('hojaVarios').addEventListener('drop', (e) => { e.preventDefault(); if(e.dataTransfer && e.dataTransfer.files) agregarLote(Array.prototype.slice.call(e.dataTransfer.files)); });
    $('hojaVarios').addEventListener('hoja-cerrada', () => { if(!ocupado){ soltarMinis(); lote = []; } });
    $('hojaVer').addEventListener('hoja-cerrada', () => { ver = null; soltarBlobs(); });
    $('hojaEnviar').addEventListener('hoja-cerrada', () => { env = null; });
    $('hojaEnviar').addEventListener('change', (e) => { if(e.target.id === 'envNum'){ $('envOtroZ').classList.toggle('hidden', !!e.target.value); $('eEnv').textContent = ''; if(!e.target.value) $('envOtro').focus(); } });
    const zona = $('tab-documentos');
    zona.addEventListener('dragover', (e) => { e.preventDefault(); limpiarSobre(); const c = e.target.closest('[data-suelta]'); (c || zona).classList.add('sobre'); });
    zona.addEventListener('dragleave', (e) => { if(!zona.contains(e.relatedTarget)) limpiarSobre(); });
    zona.addEventListener('drop', soltarEn);
    h.addEventListener('hoja-cerrada', () => { const f = alCerrar; id = 0; F = null; alCerrar = null; ver = null; if(f) f(); });
    window.Pedir.alContactar(() => { if(id) cargar(); else if(externo) externo(); });
  }
  let externo = null;

  // opciones: { yo, tab, revisar, pedir, alCerrar }
  function abrir(idCliente, opciones){
    const o = opciones || {};
    montar();
    yo = o.yo || yo; id = Number(idCliente) || 0; if(!id) return;
    F = null; fuera = null; hiloTodo = false; soloNotas = false; repExtra = 0; actaExtra = 0; llegada = { revisar: o.revisar, pedir: o.pedir, casilla: o.casilla, campo: o.campo, enviar: o.enviar }; alCerrar = o.alCerrar || null;
    $('cabFicha').innerHTML = '<div class="f-cab"><span class="mono sk" aria-hidden="true"></span><div class="tx"><span class="sk" style="width:70%;height:22px"></span><span class="sk" style="width:50%;height:12px;margin-top:8px"></span></div>' +
      '<button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>';
    TABS.forEach((x) => { $('tab-' + x).innerHTML = '<div class="sk-bloque"><span class="sk" style="height:64px;border-radius:16px"></span><span class="sk" style="height:64px;border-radius:16px"></span><span class="sk" style="height:64px;border-radius:16px"></span></div>'; });
    $('tabs').classList.remove('hidden'); $('cuerpoFicha').classList.remove('hidden');
    irTab(o.tab || (o.revisar ? 'documentos' : 'datos'), true);
    abrirHoja('hojaFicha');
    cargar(true);
  }
  // Desde otra hoja (la de comisión): subir a una casilla o escribir un dato sin abrir el expediente
  function subirA(ficha, cas, num, alTerminar){
    montar(); if(ocupado){ toast('Espera a que termine la subida'); return; }
    fuera = { cliente: ficha.cliente.id, F: ficha, alTerminar }; destino = { casilla: cas, numero: num };
    const inp = $('archivo'); inp.value = ''; inp.click();
  }
  function editarCampo(ficha, clave, alTerminar){ montar(); fuera = { cliente: ficha.cliente.id, F: ficha, alTerminar }; abrirCampo(clave); }
  window.Ficha = { subirA, editarCampo, lineaHilo, abrir, montar, abierta: () => id, alContactarFuera: (f) => { externo = f; }, recargar: () => { if(id) cargar(); } };
})();
