// Ficha del cliente: hilo, documentos por casilla, datos con servicios y comisión.
(function(){
  'use strict';
  const C = window.Comun;
  const { $, esc, ic, rpc, toast, fecha, hora, dia, mes, diasEntre, plural, capital, primerNombre, docFmt, sucursal, chipEstatus, estadoServicio, casilla, faltaTexto, devueltoFrase, normalizeStr, abrirHoja, cerrarHoja, hojaAbierta } = C;
  const S = window.Sesion;
  const db = window.db;
  const TABS = ['hilo', 'documentos', 'datos', 'comision'];
  const MAX_ARCHIVO = 15 * 1024 * 1024;
  const TIPOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

  let yo = null; let id = 0; let F = null; let tab = 'hilo';
  let hiloTodo = false; let soloNotas = false; let actasTodas = false; const repsAbiertos = {};
  let ocupado = false;            // hay una subida en curso
  let destino = null;             // casilla a la que va el archivo que se está eligiendo
  let ver = null;                 // { docId, cola, paso, motivo, archivo }
  let lote = [];                  // archivos de "Subir varios"
  let campo = null;               // lo que se edita en la hoja pequeña

  const docDe = (cas, num) => (F.documentos || []).find((d) => d.casilla === cas && d.numero === num);
  const porRevisar = () => (F.documentos || []).filter((d) => d.estado === 'por_revisar');
  const esRequerido = (cas, num) => (F.requeridos || []).some((r) => r.casilla === cas && r.numero === num);
  const liderCorto = () => primerNombre(F.cliente.lider) || 'el líder';

  // ---------- Carga ----------
  async function cargar(primera){
    try {
      F = await rpc('cliente_ficha', { p_cliente: id });
      document.title = F.cliente.nombre;
      pintarTodo();
      if(primera) alLlegar();
    } catch (e) {
      if(!F){
        $('cabFicha').innerHTML = '<div class="aviso" role="alert" style="flex:1"><b>No se pudo abrir el cliente</b><p>' + esc(e.message) + '</p>' +
          '<p style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="btn btn-chico" id="reintentar">Reintentar</button><a class="btn btn-chico btn-2" href="clientes.html">Volver a Clientes</a></p></div>';
        $('tabs').classList.add('hidden'); $('cuerpoFicha').classList.add('hidden');
      } else if(!hojaAbierta()) pintarTodo();   // deja los botones como estaban
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
    const u = new URLSearchParams(location.search);
    if(u.get('revisar') && F.puedo.revisar && porRevisar().length) abrirRevision();
    else if(u.get('pedir')) pedir(u.get('pedir') === '1' ? null : u.get('pedir'));
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
    $('cabFicha').innerHTML = '<div class="izq"><div class="linea1"><h1 class="nom">' + esc(c.nombre) + '</h1><span class="seg">' + esc(c.seg) + '</span></div>' +
      '<p class="dat">' + esc(dat) + '</p>' +
      '<div class="chips">' + chipEstatus(c.estatus) + (s0 ? estadoServicio(s0.estado) : '') + (c.por_instalar ? '<span class="chip azul">Por instalar</span>' : '') +
        (c.es_top ? '<span class="chip">Cliente TOP</span>' : '') + (c.es_demo ? '<span class="chip">Dato de ejemplo</span>' : '') + '</div></div>' +
      '<div class="contacto">' + window.Pedir.iconos(clienteContacto()) + '</div>' +
      (p ? '<div class="paso ' + p.tono + '" id="paso"><span class="tx">' + esc(p.texto) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' +
        (p.boton ? '<button type="button" class="btn btn-chico" data-paso="' + esc(p.accion) + '">' + esc(p.boton) + '</button>' : '') + '</div>' : '');
    const bar = $('accionesBar'); if(bar) bar.innerHTML = window.Pedir.iconos(clienteContacto());
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
        es_top: d.valor === 'true' ? 'lo marcó como Cliente TOP' : 'le quitó la marca de Cliente TOP', es_isp: d.valor === 'true' ? 'lo marcó como proveedor de internet' : 'le quitó la marca de proveedor de internet' }[h.texto] || 'actualizó un dato'); break;
      case 'gestion': t = quien + (d.hecho ? ' marcó la ' : ' quitó la marca de la ') + (h.texto === 'bienvenida' ? 'carta de bienvenida' : 'proforma') + (d.hecho ? ' como enviada' : ''); break;
      case 'pago': tono = h.texto === 'pagada' ? 'verde' : ''; t = quien + (h.texto === 'pagada' ? ' marcó la instalación como pagada' : ' quitó el pago de la instalación'); break;
      case 'instalacion': t = 'Se instaló el servicio'; break;
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
    $('tab-hilo').innerHTML = '<div class="tit">Hilo<span class="sep"></span><div class="filtros" style="margin-top:0"><button type="button" data-hilo="todo" class="' + (soloNotas ? '' : 'on') + '" data-chico>Todo</button><button type="button" data-hilo="notas" class="' + (soloNotas ? 'on' : '') + '" data-chico>Notas</button></div></div>' +
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
  function casillaHtml(cas, num, opciones){
    const o = opciones || {}; const d = docDe(cas, num); const nombre = o.nombre || casilla(cas, num);
    const puedeSubir = !(cas.indexOf('contrato_') === 0 && !F.puedo.contrato);
    if(!d){
      return '<div class="casilla" data-casilla="' + cas + ':' + num + '"><span class="tx"><b>' + esc(nombre) + '</b><small>' + esc(o.sub || (esRequerido(cas, num) ? 'Obligatorio' : 'Opcional')) + '</small></span>' +
        (puedeSubir ? '<button type="button" class="btn btn-2" data-subir="' + cas + ':' + num + '">Subir</button>' : '') + '</div>';
    }
    if(d.estado === 'devuelto'){
      return '<div class="casilla devuelta" data-casilla="' + cas + ':' + num + '"><button type="button" class="tx" data-ver="' + d.id + '"><b>' + esc(nombre) + '</b><small>' + esc(subCasilla(d)) + '</small></button>' +
        (puedeSubir ? '<button type="button" class="btn" data-subir="' + cas + ':' + num + '">Reemplazar</button>' : '') + '</div>';
    }
    return '<button type="button" class="casilla llena" data-casilla="' + cas + ':' + num + '" data-ver="' + d.id + '"><span class="tx"><b>' + esc(nombre) + '</b><small' + (d.vence_en && d.vence_en < F.hoy ? ' style="color:var(--rojo)"' : '') + '>' + esc(subCasilla(d)) + '</small></span>' +
      '<span class="chip ' + (d.estado === 'aprobado' ? 'verde">Aprobado' : 'ambar">Por revisar') + '</span>' + ic('derecha', 'ch') + '</button>';
  }
  function campoHtml(etq, valor, clave, obligatorio){
    const falta = !String(valor || '').trim();
    return '<div><span class="etq">' + etq + '</span><button type="button" class="campo-m' + (falta && obligatorio ? ' falta-c' : '') + '" data-campo="' + clave + '">' +
      '<span>' + esc(falta ? (obligatorio ? 'Falta. Tócalo para escribirlo' : 'Sin dato. Tócalo para escribirlo') : valor) + '</span>' + ic('lapiz') + '</button></div>';
  }
  function grupoRep(n, requeridoN){
    const r = (F.representantes || []).find((x) => x.orden === n) || {};
    const docs = [docDe('cedula', n), docDe('rif_personal', n)]; const listos = docs.filter((d) => d && d.estado !== 'devuelto').length;
    const cuerpo = '<div class="uno"><span class="etq">Nombre</span><div class="campo-m fijo"><span>' + esc(r.nombre || 'Lo llena el análisis de documentos') + '</span></div></div>' +
      '<div class="par">' + campoHtml('Correo', r.correo, 'rep:' + n, n === 1) + campoHtml('Teléfono', r.telefono, 'rep:' + n, n === 1) + '</div>' +
      casillaHtml('cedula', n, { nombre: 'Cédula' }) + casillaHtml('rif_personal', n, { nombre: 'RIF personal' });
    if(n === 1) return '<section class="grupo2" data-grupo="rep1"><div class="gt">' + (F.cliente.es_natural ? 'Titular' : 'Representante 1') + ' <small>' + listos + ' de 2</small></div>' + cuerpo + '</section>';
    const abierto = !!repsAbiertos[n];
    return '<button type="button" class="plegado" data-rep="' + n + '" aria-expanded="' + abierto + '">Representante ' + n + ' <span>' + (listos ? listos + ' de 2' : requeridoN ? 'Obligatorio. Sin cargar' : 'Sin cargar') + '</span>' + ic(abierto ? 'arriba' : 'abajo', 'ch') + '</button>' +
      (abierto ? '<section class="grupo2" data-grupo="rep' + n + '" style="margin-top:8px">' + cuerpo + '</section>' : '');
  }
  function pintarDocumentos(){
    const c = F.cliente; const req = F.requeridos || []; const fal = F.faltantes || [];
    const listos = req.filter((r) => { const d = docDe(r.casilla, r.numero); return d && d.estado !== 'devuelto'; }).length;
    const datos = fal.filter((x) => x.dato).length;
    const completo = listos === req.length && !datos;
    const nReq = !c.es_natural && c.regimen_firma === 'conjunta' ? 2 : 1;
    const nReps = Math.max(nReq, (F.representantes || []).reduce((a, r) => Math.max(a, r.orden), 1));
    let h = '<div class="tit">Documentos</div>' +
      '<div class="docs-cab"><b>' + listos + ' de ' + plural(req.length, 'casilla obligatoria', 'casillas obligatorias') + '</b><span class="' + (completo ? 'bien' : '') + '">' +
        (completo ? 'Completo' : datos ? 'Falta ' + plural(datos, 'dato', 'datos') : 'Falta ' + plural(req.length - listos, 'documento', 'documentos')) + '</span></div>' +
      '<div class="prog"><i style="transform:scaleX(' + (req.length ? listos / req.length : 0) + ')"></i></div>' +
      '<div class="acc"><button type="button" class="btn btn-chico btn-2" id="subirVarios"' + (ocupado ? ' disabled' : '') + '>' + ic('subir') + 'Subir varios</button>' +
        (F.puedo.revisar && porRevisar().length ? '<button type="button" class="btn btn-chico" id="revisarTodo">Revisar ' + porRevisar().length + '</button>' : '') + '</div>' +
      '<p class="nota-chica' + (ocupado ? '' : ' hidden') + '" id="estadoSubida" role="status"><span class="cargando-linea"><i></i><span id="textoSubida">Subiendo…</span></span></p>';
    for(let n = 1; n <= nReps; n++) h += grupoRep(n, n <= nReq);
    if(!c.es_natural && nReps < 4) h += '<button type="button" class="btn btn-chico btn-2 btn-ancho" id="agregarRep" style="margin-top:8px">Agregar representante <span style="font-weight:500;color:var(--text2)">hasta 4</span></button>';
    if(!c.es_natural){
      const actas = [1, 2, 3, 4].filter((n) => docDe('acta_asamblea', n)); const libre = [1, 2, 3, 4].find((n) => !docDe('acta_asamblea', n));
      const mostrar = actasTodas ? [1, 2, 3, 4] : actas.concat(libre ? [libre] : []).sort();
      const base = 2 + (c.es_isp ? 1 : 0); const baseListas = ['rif_empresa', 'acta_constitutiva'].concat(c.es_isp ? ['conatel'] : []).filter((k) => { const d = docDe(k, 0); return d && d.estado !== 'devuelto'; }).length;
      h += '<section class="grupo2" data-grupo="empresa"><div class="gt">Empresa <small>' + baseListas + ' de ' + base + ' base</small></div>' +
        '<div class="uno">' + campoHtml('Correo de la empresa', c.correo_empresa, 'correo_empresa', true).replace(/^<div>/, '').replace(/<\/div>$/, '') + '</div>' +
        casillaHtml('rif_empresa', 0, { nombre: 'RIF vigente' }) + casillaHtml('acta_constitutiva', 0) + (c.es_isp ? casillaHtml('conatel', 0) : '') +
        mostrar.map((n) => casillaHtml('acta_asamblea', n)).join('') +
        (!actasTodas && mostrar.length < 4 ? '<button type="button" class="plegado" id="actasMas">' + plural(4 - mostrar.length, 'casilla más', 'casillas más') + ' de actas de asamblea' + ic('abajo', 'ch') + '</button>' : '') + '</section>';
    }
    const tieneDed = /Dedicado/.test(c.seg); const tienePyme = !/^Dedicado/.test(c.seg);
    h += '<section class="grupo2" data-grupo="contrato"><div class="gt">Contrato <small>Lo sube Legal</small></div>' +
      (tienePyme || docDe('contrato_pyme', 0) ? casillaHtml('contrato_pyme', 0, { sub: 'Con fecha de firma y de vencimiento' }) : '') +
      (tieneDed || docDe('contrato_dedicado', 0) ? casillaHtml('contrato_dedicado', 0, { sub: 'Con fecha de firma y de vencimiento' }) : '') + '</section>';
    const otros = (F.documentos || []).filter((d) => d.casilla === 'otro');
    h += '<section class="grupo2" data-grupo="otros"><div class="gt">Otros documentos</div>' + otros.map((d) => casillaHtml('otro', d.numero)).join('') +
      '<div class="casilla"><span class="tx"><b>Otro documento</b><small>Lo que no entra en las casillas de arriba</small></span><button type="button" class="btn btn-2" data-subir="otro:0">Subir</button></div></section>';
    $('tab-documentos').innerHTML = h;
  }

  // ---------- Datos ----------
  function fila(etq, valor){ return '<div class="dato-f"><span>' + etq + '</span><b>' + valor + '</b></div>'; }
  function pintarDatos(){
    const c = F.cliente; const s = F.servicios || []; const s0 = s[0] || {};
    const diasGestion = diasEntre(c.creado_en, new Date().toISOString());
    let h = '<div class="tit">Datos</div><div class="secc" style="margin-top:14px">' + (c.es_natural ? 'Titular' : 'Empresa') + '<span class="der">Viene de Proham</span></div><div class="datos">' +
      fila(c.es_natural ? 'Nombre' : 'Razón social', esc(c.nombre)) + fila(c.es_natural ? 'Documento' : 'RIF', esc(docFmt(c.doc_tipo, c.doc_numero))) + fila('Tipo', esc(c.seg)) + fila('Líder', esc(c.lider || 'Sin asignar')) +
      fila('Teléfono', esc(c.telefono || s0.telefono || 'Sin teléfono')) + fila('Dirección', esc(c.direccion || s0.direccion || 'Sin dirección')) +
      fila('En gestión', c.estatus === 'contrato_firmado' ? 'Cerrado' : esc(plural(diasGestion, 'día', 'días'))) +
      fila('Estatus legal', chipEstatus(c.estatus) + (F.puedo.estatus ? '<button type="button" class="enlace" id="cambiarEstatus">Cambiar</button>' : '')) + '</div>';
    h += '<div class="secc">' + (s.length ? plural(s.length, 'servicio', 'servicios') + ' en este ' + (c.es_natural ? 'documento' : 'RIF') : 'Servicios') + '</div>';
    if(!s.length) h += '<div class="serv"><div class="l1"><b>Todavía sin instalar</b><span class="chip azul">Por instalar</span></div><p>' +
      (F.orden ? 'Orden de Odoo ' + esc(F.orden.numero) + ' del ' + esc(fecha(F.orden.creada_en)) + ' · ' + esc(F.orden.etapa || '') + '<br>' : '') + 'Puedes adelantar los documentos mientras se instala.</p></div>';
    s.forEach((x) => {
      h += '<div class="serv"><div class="l1"><b>' + esc(x.sucursal + '-' + x.codigo) + '</b>' + estadoServicio(x.estado) + (x.con_deuda ? '<span class="chip rojo">Debe instalación</span>' : '') + '</div>' +
        '<p><b>' + esc(sucursal(x.sucursal)) + '</b>' + (x.plan ? ' · ' + esc(x.plan) : '') + '<br>' + (x.fecha_instalacion ? 'Instalado el ' + esc(fecha(x.fecha_instalacion, true)) : 'Sin fecha de instalación') +
        ((x.ip || x.equipo) ? '<br>' + [x.ip ? 'IP ' + esc(x.ip) : '', x.equipo ? 'Serial ' + esc(x.equipo) : ''].filter(Boolean).join(' · ') : '') + '</p></div>';
    });
    if(!c.es_natural){
      const r = c.regimen_firma || ''; const dis = F.puedo.regimen ? '' : ' disabled';
      h += '<div class="secc">Régimen de firma' + (F.puedo.regimen ? '' : '<span class="der">Lo define Legal</span>') + '</div><div class="tres" role="radiogroup" aria-label="Régimen de firma">' +
        [['', 'Sin definir'], ['individual', 'Individual'], ['conjunta', 'Conjunta']].map((x) => '<button type="button" role="radio" aria-checked="' + (r === x[0]) + '" data-regimen="' + x[0] + '" class="' + (r === x[0] ? 'on' : '') + '"' + dis + '>' + x[1] + '</button>').join('') + '</div>' +
        (r === 'conjunta' ? '<p class="nota-chica">Con firma conjunta se piden la cédula y el RIF de dos representantes.</p>' : '') +
        '<div class="interr"><span class="tx">Proveedor de internet (ISP)<small>Se le pide el permiso de Conatel</small></span><button type="button" class="sw" role="switch" aria-checked="' + !!c.es_isp + '" data-interr="es_isp" aria-label="Proveedor de internet"' + dis + '></button></div>';
    }
    h += '<div class="secc">Cartera</div><div class="interr"><span class="tx">Cliente TOP<small>Protegido: los aliados no pueden instalarlo</small></span>' +
      '<button type="button" class="sw" role="switch" aria-checked="' + !!c.es_top + '" data-interr="es_top" aria-label="Cliente TOP"' + (F.puedo.top ? '' : ' disabled') + '></button></div>';
    const g = (cual, etq) => { const en = c[cual + '_en']; return fila(etq, (en ? '<span class="chip verde">Enviada</span> ' + esc(fecha(en)) + (c[cual + '_por'] ? ', ' + esc(primerNombre(c[cual + '_por'])) : '') : '<span class="chip">Sin enviar</span>') +
      (F.puedo.gestion ? '<button type="button" class="enlace" data-gestion="' + cual + '" data-hecho="' + (en ? '0' : '1') + '" style="margin-left:auto">' + (en ? 'Quitar' : 'Marcar') + '</button>' : '')); };
    h += '<div class="secc">Gestión del analista<span class="der">Opcional</span></div><div class="datos">' + g('proforma', 'Proforma') + g('bienvenida', 'Bienvenida') + '</div>';
    $('tab-datos').innerHTML = h;
  }

  // ---------- Comisión ----------
  function pintarComision(){
    const c = F.cliente; const lista = F.comision || [];
    let h = '<div class="tit">Comisión</div>';
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
    if(TABS.indexOf(t) < 0) t = 'hilo';
    tab = t;
    Array.prototype.forEach.call($('tabs').querySelectorAll('button'), (b) => { const on = b.dataset.tab === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    TABS.forEach((x) => $('tab-' + x).classList.toggle('on', x === t));
    if(!sinUrl){ const u = new URLSearchParams(location.search); u.set('t', t); u.delete('revisar'); u.delete('pedir'); history.replaceState(null, '', location.pathname + '?' + u.toString()); }
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
    const h = $('hojaCampo');
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
    const b = $('guardarCampo'); const co = $('cCorreo').value.trim(); $('eCampo').textContent = '';
    if(co && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(co)){ $('eCampo').textContent = 'Ese correo no parece válido'; return; }
    b.disabled = true; b.textContent = 'Guardando…';
    try {
      if(campo.tipo === 'empresa') await rpc('cliente_dato', { p_cliente: id, p_campo: 'correo_empresa', p_valor: co });
      else await rpc('cliente_representante', { p_cliente: id, p_orden: campo.orden, p_correo: co, p_telefono: $('cTel').value.trim() });
      if(campo.tipo === 'rep' && campo.orden > 1) repsAbiertos[campo.orden] = true;
      toast('Guardado'); cerrarHoja(); await cargar();
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
    const p = $('progLote'); if(p) p.textContent = texto;
  }
  // items: [{ files:[File], casillas:[{casilla,numero}], vence_en, firmado_en }]
  async function guardarItems(items){
    if(ocupado) return false;
    ocupado = true; const total = items.reduce((a, it) => a + it.files.length, 0); let hecho = 0;
    Array.prototype.forEach.call(document.querySelectorAll('[data-subir],#subirVarios'), (b) => { b.disabled = true; });
    try {
      const envio = [];
      for(const it of items){
        const archivos = [];
        for(const file of it.files){
          hecho++; avance('Subiendo ' + hecho + ' de ' + total + '…');
          const pr = await preparar(file);
          const ruta = id + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + '-' + nombreSeguro(pr.nombre, pr.mime);
          const r = await db.storage.from('expedientes').upload(ruta, pr.blob, { contentType: pr.mime, upsert: false });
          if(r.error) throw new Error(C.mensajeError(r.error, 'No se pudo subir "' + file.name + '". Intenta de nuevo'));
          archivos.push({ ruta, nombre: file.name.slice(0, 200), mime: pr.mime, tamano: pr.tamano });
        }
        envio.push({ archivos, casillas: it.casillas, vence_en: it.vence_en || null, firmado_en: it.firmado_en || null });
      }
      avance('Guardando…');
      const n = await rpc('documentos_registrar', { p_cliente: id, p_items: envio });
      toast(plural(n, 'documento guardado', 'documentos guardados'));
      ocupado = false; await cargar();
      return true;
    } catch (e) {
      ocupado = false; toast(e.message, 'error'); pintarDocumentos();
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
  function abrirRevision(){ const cola = porRevisar().map((d) => d.id); if(!cola.length) return; irTab('documentos'); ver = { docId: cola[0], cola, paso: 'ver', motivo: null, archivo: 0, url: {} }; pintarVer(); abrirHoja('hojaVer'); cargarArchivo(); }
  function abrirVer(docId){ ver = { docId, cola: null, paso: 'ver', motivo: null, archivo: 0, url: {} }; pintarVer(); abrirHoja('hojaVer'); cargarArchivo(); }
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
    if(!a || !url){ z.innerHTML = papel(a && !a.ruta && !a.url_externa ? 'Archivo de ejemplo. No tiene imagen guardada.' : 'No se pudo abrir el archivo. Cierra y vuelve a intentar.'); return; }
    if(ab){ ab.href = url; ab.classList.remove('hidden'); }
    const pdf = a.mime === 'application/pdf' || /\.pdf$/i.test(a.nombre || '');
    if(!pdf) z.innerHTML = '<img src="' + esc(url) + '" alt="' + esc(casilla(d.casilla, d.numero)) + '">';
    else if(window.matchMedia('(min-width:900px)').matches) z.innerHTML = '<iframe src="' + esc(url) + '" title="' + esc(casilla(d.casilla, d.numero)) + '"></iframe>';
    else z.innerHTML = '<div>' + papel('Documento en PDF') + '<a class="btn btn-chico" href="' + esc(url) + '" target="_blank" rel="noopener" style="margin-top:12px">Abrir el PDF</a></div>';
  }
  // Pide un enlace temporal al almacenamiento privado
  async function cargarArchivo(){
    const d = docVer(); if(!d) return;
    const n = ver.archivo; const a = (d.archivos || [])[n]; const mio = ver;
    if(!a){ ver.url[n] = ''; mostrarArchivo(); return; }
    if(ver.url[n] !== undefined){ mostrarArchivo(); return; }
    let url = '';
    if(a.ruta){
      try { const r = await db.storage.from('expedientes').createSignedUrl(a.ruta, 600); if(!r.error && r.data) url = r.data.signedUrl || ''; } catch (e) {}
    } else if(a.url_externa && /^https:\/\//i.test(a.url_externa)) url = a.url_externa;
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
    try {
      const cola = ver.cola; const actual = d.id;
      F = await rpc('cliente_ficha', { p_cliente: id });
      // Sigue con el próximo que quede por revisar; si no hay, cierra
      const sig = cola ? cola.slice(cola.indexOf(actual) + 1).find((x) => { const y = (F.documentos || []).find((z) => z.id === x); return y && y.estado === 'por_revisar'; }) : null;
      if(sig){ ver = { docId: sig, cola, paso: 'ver', motivo: null, archivo: 0, url: {} }; pintarTodo(); cargarArchivo(); }
      else { ver = null; cerrarHoja(); pintarTodo(); if(cola) toast('Listo. No quedan documentos por revisar'); }
    } catch (e) { ver = null; cerrarHoja(); toast('Quedó guardado, pero no se pudo actualizar la pantalla. Recarga la página', 'error'); }
  }

  // ---------- Eventos ----------
  document.addEventListener('click', (e) => {
    const t = e.target;
    let b;
    if(t.closest('#reintentar')){ location.reload(); return; }
    if((b = t.closest('#tabs [data-tab]'))){ irTab(b.dataset.tab); return; }
    if((b = t.closest('[data-paso]'))){
      const a = b.dataset.paso;
      if(a === 'revisar') abrirRevision(); else if(a === 'estatus') abrirEstatus(); else if(a.indexOf('pedir:') === 0) pedir(a.slice(6)); else if(a.indexOf('tab:') === 0){ irTab(a.slice(4)); const g = document.querySelector('[data-grupo="contrato"]'); if(g) g.scrollIntoView({ block: 'center' }); }
      return;
    }
    if(t.closest('#hiloMas')){ hiloTodo = true; pintarHilo(); return; }
    if((b = t.closest('[data-hilo]'))){ soloNotas = b.dataset.hilo === 'notas'; pintarHilo(); return; }
    if((b = t.closest('[data-subir]'))){ const p = b.dataset.subir.split(':'); elegirPara(p[0], Number(p[1])); return; }
    if((b = t.closest('[data-ver]'))){ abrirVer(Number(b.dataset.ver)); return; }
    if((b = t.closest('[data-campo]'))){ abrirCampo(b.dataset.campo); return; }
    if((b = t.closest('[data-rep]'))){ const n = Number(b.dataset.rep); repsAbiertos[n] = !repsAbiertos[n]; pintarDocumentos(); return; }
    if(t.closest('#agregarRep')){ const n = (F.representantes || []).reduce((a, r) => Math.max(a, r.orden), 0) + 1;
      if(n === 1 || !(F.representantes || []).some((r) => r.orden === 1)){ abrirCampo('rep:1'); toast('Primero completa el representante 1'); } else abrirCampo('rep:' + Math.min(4, n)); return; }
    if(t.closest('#actasMas')){ actasTodas = true; pintarDocumentos(); return; }
    if(t.closest('#subirVarios')){ abrirVarios(); return; }
    if(t.closest('#revisarTodo')){ abrirRevision(); return; }
    if(t.closest('#cambiarEstatus')){ abrirEstatus(); return; }
    if((b = t.closest('[data-estatus]'))){
      Array.prototype.forEach.call($('hojaEstatus').querySelectorAll('.mot'), (x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); });
      const g = $('guardarEstatus'); g.disabled = b.dataset.estatus === F.cliente.estatus; g.dataset.valor = b.dataset.estatus; return;
    }
    if((b = t.closest('#guardarEstatus'))){ const v = b.dataset.valor; b.disabled = true; rpc('cliente_estatus', { p_cliente: id, p_estatus: v }).then(() => { toast('Estatus cambiado'); cerrarHoja(); return cargar(); }).catch((err) => { toast(err.message, 'error'); b.disabled = false; }); return; }
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
  $('archivo').addEventListener('change', alElegir);
  $('archivosLote').addEventListener('change', () => { agregarLote(Array.prototype.slice.call($('archivosLote').files || [])); });
  // En escritorio también se puede arrastrar a la hoja de Subir varios
  $('hojaVarios').addEventListener('dragover', (e) => { e.preventDefault(); const s = $('soltar'); if(s) s.classList.add('sobre'); });
  $('hojaVarios').addEventListener('dragleave', () => { const s = $('soltar'); if(s) s.classList.remove('sobre'); });
  $('hojaVarios').addEventListener('drop', (e) => { e.preventDefault(); if(e.dataTransfer && e.dataTransfer.files) agregarLote(Array.prototype.slice.call(e.dataTransfer.files)); });
  $('hojaVarios').addEventListener('hoja-cerrada', () => { if(!ocupado){ soltarMinis(); lote = []; } });
  $('hojaVer').addEventListener('hoja-cerrada', () => { ver = null; });
  document.addEventListener('visibilitychange', () => { if(!document.hidden && F && !ocupado && !hojaAbierta()) cargar(); });

  (async function(){
    yo = await S.requerir(['admin', 'abogado', 'lider', 'analista']);
    if(!yo) return;
    const u = new URLSearchParams(location.search);
    id = Number(u.get('id')) || 0;
    // Se vuelve a la pantalla desde donde se llegó
    const deComisiones = /comisiones\.html/.test(document.referrer || '');
    const volver = deComisiones ? { enlace: 'comisiones.html', texto: 'Comisiones' } : { enlace: 'clientes.html', texto: 'Clientes' };
    const vp = $('volverPc'); vp.href = volver.enlace; vp.lastChild.textContent = volver.texto;
    window.Armazon.montar(yo, { activo: deComisiones ? 'comisiones' : 'clientes', volver, acciones: ' ' });
    window.Pedir.alContactar(() => cargar());
    if(!id){ location.replace('clientes.html'); return; }
    irTab(u.get('t') || 'hilo', true);
    cargar(true);
  })();
})();
