// Expediente del cliente como hoja que sale encima de la lista: datos, documentos por casilla, hilo y comisión.
(function(){
  'use strict';
  const C = window.Comun;
  const { $, esc, ic, rpc, toast, fecha, hora, dia, mes, diasEntre, plural, capital, primerNombre, docFmt, sucursal, chipEstatus, estadoServicio, casilla, faltaTexto, devueltoFrase, normalizeStr, abrirHoja, cerrarHoja, hojaAbierta, iniciales } = C;
  const S = window.Sesion;
  const db = window.db;
  // Lote 21/10: Datos, Documentos, Contrato, VGT (solo si tiene), Hilo y Comisión (solo con instalación en un corte)
  const TABS = ['datos', 'documentos', 'contrato', 'vgt', 'hilo', 'comision'];
  const MAX_ARCHIVO = 15 * 1024 * 1024;
  // Lote 22/10: hasta 10 representantes y 15 actas de asamblea (la base pone el mismo límite)
  const REPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; const ACTAS = REPS.concat([11, 12, 13, 14, 15]);
  const TIPOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

  let yo = null; let id = 0; let F = null; let tab = 'datos'; let montada = false; let alCerrar = null; let llegada = null;
  const encima = () => { const h = hojaAbierta(); return !!h && h !== 'hojaFicha'; };
  let hiloTodo = false; let hiloF = 'todo'; let repExtra = 0; let actaExtra = 0;
  let fuera = null;               // { cliente, F, alTerminar }: se sube o se escribe desde otra hoja, sin abrir el expediente
  let ocupado = false;            // hay subidas en la cola
  if(window.AE_ocupado) window.AE_ocupado(() => ocupado); // Lote S: no cerrar la sesión por inactividad con subidas en curso
  let subiendo = {};              // casillas que se están subiendo ('12|cedula:1': texto): se ven con su barra en la misma fila
  const cola = []; let trabajando = false;   // lote 21/10: subidas en segundo plano, una tras otra
  let selMode = false; let selDocs = new Set();   // "Aprobar seleccionados"
  let drive;                      // carpeta del cliente en Drive (solo admin): undefined cargando, null sin permiso
  let rev = null;                 // revisión en curso (solo quien revisa): marcas sin cerrar, historial, WhatsApp del líder y la última revisión con IA
  let sondeo = null;              // mientras la IA lee, se pregunta cada pocos segundos cómo va
  let excIA = null;               // punto al que se le concede excepción
  let destino = null;             // casilla a la que va el archivo que se está eligiendo
  let ver = null;                 // { docId, cola, paso, motivo, archivo }
  let lote = [];                  // archivos de "Subir varios"
  let varF = null; let varFin = null;   // "Subir varios" desde otra hoja (la de comisión): su ficha y qué hacer al terminar
  let campo = null;               // lo que se edita en la hoja pequeña

  const FF = () => F;
  const docDe = (cas, num) => ((varF || F).documentos || []).find((d) => d.casilla === cas && d.numero === num);
  const porRevisar = () => (F.documentos || []).filter((d) => d.estado === 'por_revisar');
  // Revisión de una sola vez: lo marcado no cuenta como revisado hasta cerrar la revisión
  const marcas = () => (rev && rev.marcas) || [];
  const marcaDe = (docId) => marcas().find((m) => m.documento === docId) || null;
  const sinMarcar = () => porRevisar().filter((d) => !marcaDe(d.id));
  const revisa = () => !!(yo && (yo.rol === 'admin' || yo.rol === 'abogado'));
  const iaActiva = () => !!(rev && rev.ia && (rev.ia.estado === 'en_cola' || rev.ia.estado === 'leyendo'));
  const iaDe = (docId) => (rev && rev.ia && rev.ia.estado === 'lista' && (rev.ia.marcas || []).find((m) => m.documento === docId)) || null;
  const esRequerido = (cas, num) => (F.requeridos || []).some((r) => r.casilla === cas && r.numero === num);
  const liderCorto = () => primerNombre(F.cliente.lider) || 'el líder';

  // ---------- Carga ----------
  async function cargar(primera){
    const mio = id; if(!mio) return;
    try {
      const [r, rv, ga] = await Promise.all([rpc('cliente_ficha', { p_cliente: mio }), leerRevision(mio), rpc('cliente_gestiones', { p_cliente: mio }).catch(() => [])]);
      if(mio !== id) return;   // ya se abrió otro cliente: esta respuesta no es de él
      F = r; rev = rv; F.gesActivas = ga || [];
      F.puedo = Object.assign({ marcar_rep: !!(F.puedo || {}).revisar }, F.puedo || {});   // Lote 05/11 C4: Firma este / Ya no aplica
      // Un provisional que ya se unió: se abre el cliente real
      if(F.cliente.unido_a){ id = Number(F.cliente.unido_a); toast('Ese cliente provisional ya se unió a su cliente real'); cargar(primera); return; }
      pintarTodo(); vigilar();
      if(primera) alLlegar();
      cargarDrive(mio);
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
  // Marcas sin cerrar e historial de revisiones; si falla, la ficha abre igual y avisa en Documentos
  async function leerRevision(mio){
    if(!revisa()) return null;
    try {
      const [r, pts] = await Promise.all([rpc('revision_estado', { p_cliente: mio }), rpc('revision_puntos_de', { p_cliente: mio }).catch(() => ({}))]);
      if(r) r.puntos = pts || {};   // Lote 05/11 C1: puntos del panel "Revisión del expediente"
      return r;
    }
    catch (e) { return { error: e.message, marcas: [], historial: [], puntos: {} }; }
  }
  // Fila "Carpeta en Drive" (solo el administrador): soporte para ver dónde quedó cada archivo
  async function cargarDrive(mio){
    if(!yo || yo.rol !== 'admin') return;
    try { const r = await rpc('drive_carpeta_info', { p_cliente: mio }); if(mio !== id) return; drive = r || null; }
    catch (e) { if(mio !== id) return; drive = { error: true }; }
    if(F) pintarDocumentos();
  }
  function driveHtml(){
    if(!yo || yo.rol !== 'admin') return '';
    const k = drive; let sub;
    if(k === undefined) sub = 'Buscando la carpeta…';
    else if(!k || k.error) sub = 'No se pudo revisar la carpeta. Cierra y abre el cliente para intentar de nuevo';
    else if(!k.url) sub = 'Sin carpeta todavía. Se crea sola con el primer documento';
    else sub = (k.creada_por_app ? 'Creada por la app ' + dia(k.creada_en).toLowerCase().replace(/^(\d)/, 'el $1') + (k.creada_por ? ' por ' + primerNombre(k.creada_por) : '') : 'Carpeta de la app vieja') +
      (k.ultima_en ? '. Última subida: ' + dia(k.ultima_en).toLowerCase().replace(/^(\d)/, 'el $1') + ' ' + hora(k.ultima_en) + (k.ultima_por ? ' por ' + primerNombre(k.ultima_por) : '') : '');
    const url = k && !k.error && k.url && /^https:\/\/drive\.google\.com\//.test(k.url) ? k.url : '';
    return '<div class="casilla doc drive" id="filaDrive"><span class="ico" aria-hidden="true">' + ic('carpeta') + '</span><span class="tx"><b>Carpeta en Drive</b><small>' + esc(sub) + '</small></span>' +
      (url ? '<a class="mini" href="' + esc(url) + '" target="_blank" rel="noopener">Abrir</a>' : '') + '</div>';
  }
  function pintarTodo(){
    $('tabs').classList.remove('hidden'); $('cuerpoFicha').classList.remove('hidden');
    pintarCab(); pintarHilo(); pintarDocumentos(); pintarDatos(); pintarComision(); pintarDedicado();
    if(hojaAbierta() === 'hojaVer' && ver) pintarVer();
  }
  // Atajos que llegan en la dirección: pestaña, revisar o pedir
  function alLlegar(){
    const o = llegada || {}; llegada = null;
    if(o.revisar && F.puedo.revisar && porRevisar().length) abrirRevision();
    else if(o.pedir) pedir(o.pedir === '1' ? null : o.pedir);
    else if(o.campo) abrirCampo(o.campo);
    else if(o.enviar) abrirEnviar(o.enviar);
    // Lote 28/10: desde Mi trabajo, 'devuelto' o 'falta' llevan a la primera casilla en ese estado
    else if(o.casilla){ const el = o.casilla === 'devuelto' || o.casilla === 'falta' ? document.querySelector('#tab-documentos .casilla.' + (o.casilla === 'devuelto' ? 'dev' : 'falta')) : document.querySelector('#tab-documentos [data-casilla="' + o.casilla + '"]'); if(el){ el.scrollIntoView({ block: 'center' }); el.classList.add('sobre'); setTimeout(() => el.classList.remove('sobre'), 1600); } }
  }

  // ---------- Encabezado y paso siguiente ----------
  // El cliente provisional (de una orden sin RIF) muestra "Provisional, sin RIF" en vez del número interno
  const rifDe = (c) => (c.provisional ? 'Provisional, sin RIF' : docFmt(c.doc_tipo, c.doc_numero));
  function paso(){
    const c = F.cliente; const f = F.faltantes || []; const n = F.puedo.revisar ? sinMarcar().length : porRevisar().length;
    const dev = f.some((x) => x.e === 'devuelto'); const fal = f.some((x) => x.e === 'falta');
    if(c.provisional && F.rol !== 'abogado') return { tono: 'azul', texto: 'Cliente provisional, todavía sin RIF', sub: 'Salió de una orden de Odoo. Sube sus documentos desde ya; al conocer el RIF se une al cliente real o queda como cliente normal', boton: 'Escribir RIF', accion: 'rif' };
    if(c.estatus === 'contrato_firmado') return { tono: 'verde', texto: 'Contrato firmado', sub: 'El expediente está completo' };
    if(F.puedo.revisar && iaActiva()) return { tono: 'azul', texto: 'La IA está leyendo el expediente', sub: rev.ia.avance + ' de ' + rev.ia.total + ' archivos. El resultado sale en Documentos' };
    if(F.puedo.revisar && marcas().length){
      const cierra = rev && rev.puede_cerrar;
      if(n) return { tono: 'azul', texto: 'Revisión en curso', sub: resumenMarcas() + '. ' + (n === 1 ? 'Queda 1 documento' : 'Quedan ' + n + ' documentos') + ' por revisar', boton: 'Seguir revisando', accion: 'revisar' };
      return { tono: 'azul', texto: 'Revisión lista para cerrar', sub: resumenMarcas() + '. ' + (cierra ? capital(liderCorto()) + ' no se entera hasta que la cierres' : 'La cierra el administrador'), boton: cierra ? 'Cerrar revisión' : '', accion: 'cerrarrev' };
    }
    if(c.estatus === 'por_firmar') return F.puedo.contrato
      ? { tono: 'morado', texto: 'Falta la firma del cliente', sub: 'Cuando llegue, sube el contrato firmado', boton: 'Subir contrato', accion: 'tab:contrato' }
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
    return i.estado === 'ultimo_corte' ? 'Último corte: límite el ' + fecha(F.corte.limite || F.corte.fin) : 'Corte de ' + mes(F.corte.etiqueta) + ': ' + (F.corte.dias < 0 ? 'abierto hasta que se cierre' : F.corte.dias === 0 ? 'el límite es hoy' : (F.corte.dias === 1 ? 'falta ' : 'faltan ') + plural(F.corte.dias, 'día', 'días'));
  }
  function clienteContacto(){ const c = F.cliente; return { id: c.id, nombre: c.nombre, es_natural: c.es_natural, estatus: c.estatus, falta: F.faltantes, tel: c.tel, correo: c.correo }; }
  function pintarCab(){
    const c = F.cliente; const p = paso(); const s0 = (F.servicios || [])[0];
    const nEnl = c.dedicado ? (c.dedicado.enlaces || []).filter((e) => e.activo).length : 0;
    const pinst = c.por_instalar && !c.dedicado;   // un dedicado sin servicios PYME no está "por instalar": tiene enlaces
    const dat = [rifDe(c), c.lider || 'Sin líder', c.dedicado && !(F.servicios || []).length ? plural(nEnl, 'enlace activo', 'enlaces activos') : pinst ? 'Sin instalar' : plural((F.servicios || []).length, 'servicio', 'servicios')].join(' · ');
    const sub = p ? (p.sub || subCorte()) : '';
    $('cabFicha').innerHTML = '<div class="f-cab"><span class="mono" aria-hidden="true">' + esc(iniciales(c.nombre).charAt(0)) + '</span><div class="tx"><h1 class="nom" id="tFicha">' + esc(c.nombre) + '</h1><p class="dat">' + esc(dat) + '</p></div>' +
        '<button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      '<div class="chips">' + chipEstatus(c.estatus) + '<span class="seg">' + esc(c.seg) + '</span>' + (s0 ? estadoServicio(s0.estado) : '') + (pinst ? '<span class="chip azul">Por instalar</span>' : '') +
        (c.es_top ? '<span class="chip">Cliente TOP</span>' : '') + (c.es_demo ? '<span class="chip">Dato de ejemplo</span>' : '') +
        (c.suspendido_en ? '<span class="chip rojo">Suspendido</span>' : '') + (c.dedicado && c.dedicado.sin_tad ? '<span class="chip azul" title="Registrado a mano. Cuando el TAD traiga este RIF se une solo">Aún no está en el TAD</span>' : '') + etqChip() + '</div>' +
      '<div class="contacto">' + window.Pedir.iconos(clienteContacto()) + '</div>' +
      (p ? '<div class="paso ' + p.tono + '" id="paso"><span class="tx">' + esc(p.texto) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' +
        (p.boton ? '<button type="button" class="btn btn-chico" data-paso="' + esc(p.accion) + '">' + esc(p.boton) + '</button>' : '') + '</div>' : '') +
      (window.Contacto ? window.Contacto.boton('cliente', c.id, '', c.estatus + ':' + (F.documentos || []).filter((x) => x.estado === 'devuelto').length) : '');   // Lote A: contactar a quien tiene el paso
    if(window.Contacto) window.Contacto.llenar($('cabFicha'));
    const nr = F.puedo.revisar ? sinMarcar().length : porRevisar().length; const t = $('tabs').querySelector('[data-tab="documentos"]');
    const nb = F.puedo.revisar && nr ? nr : (F.faltantes || []).length;   // Lote 28/10: el resto ve cuántos faltan
    if(t) t.innerHTML = 'Documentos' + (nb ? '<em>' + nb + '</em>' : '');
  }

  // Lote 21/10: última etiqueta de gestión; se cambia con un toque
  const GES = C.GESTION || {};
  function etqChip(){
    const g = (F.gestion || [])[0]; const tono = { contactado: 'verde', sin_contacto: 'rojo', esperando: 'ambar' };
    return '<button type="button" class="chip chip-btn ' + (g ? tono[g.e] || '' : '') + '" data-etiquetar-ficha="1" aria-label="Etiqueta de gestión">' + ic('etiqueta') + esc(g ? GES[g.e] || g.e : 'Poner etiqueta') + '</button>';
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
      case 'documento_aprobado': case 'documento_devuelto':
        if(h.texto === 'revision'){   // cierre de una revisión: una sola entrada con todo
          tono = d.devueltos ? 'rojo' : 'verde'; const e = C.ESTATUS[d.estatus] || null;
          t = quien + ' cerró la revisión: ' + plural(d.aprobados || 0, 'aprobado', 'aprobados') + (d.devueltos ? ' y ' + plural(d.devueltos, 'devuelto', 'devueltos') : '') + (e && d.estatus !== d.antes ? '. Pasó a <b>' + esc(e.t) + '</b>' : '');
          const dv = (d.documentos || []).filter((x) => x.accion === 'devolver');
          glo = dv.length ? '<div class="glo rojo">' + dv.map((x) => esc(casilla(x.casilla, x.numero) + ': ' + (C.MOTIVOS[x.motivo] || 'Devuelto') + (x.nota ? '. ' + x.nota : ''))).join('<br>') + '</div>' : '';
          break;
        }
        if(h.tipo === 'documento_aprobado'){ tono = 'verde'; t = quien + ' aprobó: ' + esc(casilla(d.casilla || h.texto, d.numero)); break; }
        tono = 'rojo'; t = quien + ' devolvió: ' + esc(casilla(d.casilla || h.texto, d.numero));
        glo = '<div class="glo rojo">' + esc((C.MOTIVOS[d.motivo] || 'Devuelto') + (d.nota ? '. ' + d.nota : '')) + '</div>'; break;
      case 'dato': t = quien + ' ' + ({ representante: 'actualizó el contacto del representante ' + (d.orden || 1), correo_empresa: 'actualizó el correo de la empresa', telefono: 'actualizó el teléfono', direccion: 'actualizó la dirección',
        regimen_firma: 'puso el régimen de firma en ' + (d.valor === 'conjunta' ? 'Conjunta' : d.valor === 'individual' ? 'Individual' : 'Sin definir'),
        ip: 'actualizó la IP' + (d.codigo ? ' del servicio ' + d.codigo : ''), es_top: d.valor === 'true' ? 'lo marcó como Cliente TOP' : 'le quitó la marca de Cliente TOP', es_isp: d.valor === 'true' ? 'lo marcó como proveedor de internet' : 'le quitó la marca de proveedor de internet',
        dedicado_creado: 'entró como cliente dedicado desde el archivo de la analista',
        legal_aprobado: 'aprobó Legal a mano', legal_quitado: 'le quitó el check de Legal',
        contrato_presencial: d.valor === 'true' ? 'lo marcó como contrato presencial' : 'le quitó la marca de contrato presencial',
        exc_pagada: d.valor === 'true' ? 'lo marcó como excepción pagada con documentos por subir' : 'le quitó la marca de excepción pagada',
        etiqueta: 'le puso la etiqueta ' + esc((C.GESTION || {})[d.etiqueta] || d.etiqueta || ''), lider: 'cambió ' + (d.cual === 'dedicado' ? 'la líder del dedicado' : 'el líder') + (d.antes ? ' de ' + esc(d.antes) : '') + ' a ' + esc(d.lider || ''),
        suspendido: 'suspendió al cliente', reactivado: 'reactivó al cliente' }[h.texto] || 'actualizó un dato');
        if(h.texto === 'etiqueta' || h.texto === 'suspendido' || h.texto === 'reactivado'){ tono = h.texto === 'suspendido' ? 'rojo' : h.texto === 'reactivado' ? 'verde' : ''; if(d.nota) glo = '<div class="glo gris">' + esc(d.nota) + '</div>'; }
        if(h.texto === 'legal_aprobado' || h.texto === 'legal_quitado'){ tono = h.texto === 'legal_aprobado' ? 'verde' : 'rojo'; if(d.motivo) glo = '<div class="glo gris">' + esc(d.motivo) + '</div>'; }
        break;
      case 'gestion': { const que = h.texto === 'ambas' ? 'la proforma y la carta de bienvenida' : h.texto === 'bienvenida' ? 'la carta de bienvenida' : 'la proforma';
        if(d.canal === 'whatsapp' || d.canal === 'correo'){ tono = 'azul'; t = quien + ' envió ' + que + (d.canal === 'correo' ? ' por correo' : ' por WhatsApp'); }
        else t = quien + (d.hecho ? ' marcó ' : ' quitó la marca de ') + que + (d.hecho ? (h.texto === 'ambas' ? ' como enviadas' : ' como enviada') : '');
        break; }
      case 'pago': tono = h.texto === 'pagada' ? 'verde' : ''; t = quien + (h.texto === 'pagada' ? ' marcó la instalación como pagada' : ' quitó el pago de la instalación'); break;
      case 'instalacion':
        if(h.texto === 'asignada'){ t = quien + ' asignó la comisión a <b>' + esc(d.dueno || '') + '</b>' + (d.orden ? ', con la orden ' + esc(String(d.orden).split('/').pop()) : ', sin orden de Odoo'); }
        else if(h.texto === 'excepcion'){ tono = 'verde'; t = quien + ' dio una excepción de comisión'; glo = d.motivo ? '<div class="glo gris">' + esc(d.motivo) + '</div>' : ''; }
        else if(h.texto === 'excepcion_quitada') t = quien + ' quitó la excepción de comisión';
        else if(h.texto === 'evento') t = quien + (d.evento ? ' marcó la instalación como evento: ' + (d.comisiona ? 'comisiona' : 'no comisiona') : ' quitó la marca de evento');
        else t = 'Se instaló el servicio';
        break;
      case 'correo': tono = 'azul'; t = '<b>Correo del cliente</b>'; glo = h.texto ? '<div class="glo gris">' + esc(h.texto) + '</div>' : ''; break;
      default: t = esc(h.texto || h.tipo);
    }
    return '<div class="lin"><i class="' + tono + '"></i><span>' + t + glo + '</span><time>' + esc(hora(h.en)) + '</time></div>';
  }
  function pintarHilo(){
    // Lote 28/10: filtros del hilo por tipo de movimiento
    const TIPOS_H = { documentos: ['documento_subido', 'documento_aprobado', 'documento_devuelto'], mensajes: ['nota', 'contacto'], gestion: ['gestion'], estatus: ['estatus', 'dato', 'pago'] };
    let lista = F.hilo || [];
    if(hiloF !== 'todo') lista = lista.filter((h) => (TIPOS_H[hiloF] || []).indexOf(h.tipo) >= 0);
    const LIM = 12; const visibles = hiloTodo ? lista : lista.slice(0, LIM);
    let h = ''; let ultimoDia = '';
    visibles.forEach((x) => { const d = dia(x.en); if(d !== ultimoDia){ h += '<span class="dia">' + esc(d) + '</span>'; ultimoDia = d; } h += lineaHilo(x); });
    if(!visibles.length) h = '<p class="nota-chica">' + (hiloF !== 'todo' ? 'Nada de este tipo todavía. Toca Todo para ver el resto.' : 'Todavía no hay movimientos. Lo que pase con este cliente queda anotado aquí.') + '</p>';
    if(!hiloTodo && lista.length > LIM) h += '<button type="button" class="enlace" id="hiloMas" style="justify-self:start">Ver ' + plural(lista.length - LIM, 'movimiento anterior', 'movimientos anteriores') + '</button>';
    const previa = $('nota'); const texto = previa ? previa.value : ''; const conFoco = previa && document.activeElement === previa;
    $('tab-hilo').innerHTML = '<div class="tit"><div class="filtros" style="margin-top:0" role="group" aria-label="Filtrar el hilo">' + [['todo', 'Todo'], ['documentos', 'Documentos'], ['mensajes', 'Mensajes'], ['gestion', 'Gestión'], ['estatus', 'Estatus']].map((x) => '<button type="button" data-hilo="' + x[0] + '" class="' + (hiloF === x[0] ? 'on' : '') + '" aria-pressed="' + (hiloF === x[0]) + '" data-chico>' + x[1] + '</button>').join('') + '</div></div>' +
      '<div class="hilo" id="hilo">' + h + '</div>' +
      '<form class="escribir" id="formNota" autocomplete="off"><label class="solo-lector" for="nota">Escribe una nota</label><input id="nota" maxlength="1000" placeholder="Escribe una nota" enterkeyhint="send">' +
      '<button type="submit" aria-label="Guardar nota">' + ic('enviar') + '</button></form>';
    if(texto){ $('nota').value = texto; if(conFoco) $('nota').focus(); }
  }

  // ---------- Documentos ----------
  function subCasilla(d){
    const hoy = F.hoy;
    if(d.estado === 'devuelto') return 'Devuelto: ' + (C.MOTIVOS[d.motivo] || 'revisa la nota').toLowerCase();
    if(d.casilla === 'acta_asamblea') return d.firmado_en ? 'Acta del ' + fecha(d.firmado_en, true) : 'Falta la fecha del acta';
    if(d.firmado_en) return 'Firmado el ' + fecha(d.firmado_en, true) + (d.vence_en ? '. Vence el ' + fecha(d.vence_en, true) : '');
    if(d.vence_en) return (d.vence_en < hoy ? 'Venció el ' : 'Vence el ') + fecha(d.vence_en, true);
    if(d.casilla === 'otro' && d.nota) return d.nota;
    if((d.comparte || []).length) return 'Mismo archivo que: ' + C.lista(d.comparte.map((x) => casilla(x.casilla, x.numero)));
    if((d.archivos || []).length > 1) return d.archivos.length + ' archivos';
    return 'Subido ' + dia(d.subido_en).toLowerCase().replace(/^(\d)/, 'el $1') + (d.subido_por ? ' por ' + primerNombre(d.subido_por) : '');
  }
  // Cada casilla tiene un solo estado y una sola acción
  function casillaHtml(cas, num, opciones){
    const o = opciones || {}; const d = docDe(cas, num); const nombre = o.nombre || (d && d.titulo) || casilla(cas, num); const k = cas + ':' + num;
    const puedeSubir = !(cas.indexOf('contrato_') === 0 && !F.puedo.contrato);
    const ks = (varF || F).cliente.id + '|' + k; const sb = subiendo[ks];
    if(sb) return '<div class="casilla doc subiendo" data-casilla="' + k + '" aria-busy="true"><span class="ico" aria-hidden="true">' + ic('subir') + '</span><span class="tx"><b>' + esc(nombre) + '</b><small class="tx-subida" data-sube="' + esc(ks) + '">' + esc(typeof sb === 'string' ? sb : 'Subiendo a Drive…') + '</small><span class="carga-barra" aria-hidden="true"><i></i></span></span><span class="chip azul">' + (sb === 'En cola…' ? 'En cola' : 'Subiendo') + '</span></div>';
    // Aprobar seleccionados: los que esperan revisión se marcan con un toque
    if(selMode && d && d.estado === 'por_revisar' && F.puedo.revisar && !marcaDe(d.id)){
      const on = selDocs.has(d.id);
      return '<button type="button" class="casilla doc rev elegible' + (on ? ' on' : '') + '" data-casilla="' + k + '" data-sel-doc="' + d.id + '" aria-pressed="' + on + '"><span class="ico caja" aria-hidden="true">' + (on ? ic('check') : '') + '</span><span class="tx"><b>' + esc(nombre) + '</b><small>' + esc(subCasilla(d)) + '</small></span><span class="chip ' + (on ? 'azul">Para aprobar' : 'ambar">Por revisar') + '</span></button>';
    }
    const rq = !d ? reqDe(cas, num) : null;
    if(rq){
      // Lote 05/11 C2: lo que se PIDIÓ queda en rojo con el nombre completo hasta que lo suban
      return '<div class="casilla doc falta pedida" data-casilla="' + k + '"' + (puedeSubir ? ' data-suelta="1"' : '') + '><button type="button" class="cuerpo" data-subir="' + k + '"><span class="ico" aria-hidden="true">!</span><span class="tx"><b>Falta: ' + esc(rq.t) + '</b><small>' +
        esc((rq.m ? 'Por qué: ' + rq.m + '. ' : '') + 'Pedido' + (rq.ia ? ' (propuesta de la IA)' : '') + (rq.por ? ' por ' + primerNombre(rq.por) : '') + (rq.en ? ' el ' + fecha(rq.en, true) : '') + '.') + '</small></span></button>' +
        (F.puedo.revisar ? '<button type="button" class="mini" data-req-quitar="' + esc(rq.req) + '">Quitar pedido</button>' : puedeSubir ? '<button type="button" class="mini pri" data-subir="' + k + '">Subir</button>' : '') + '</div>';
    }
    if(!d){
      const req = o.req !== undefined ? o.req : esRequerido(cas, num);
      if(!puedeSubir) return '<div class="casilla doc" data-casilla="' + k + '"><span class="ico">' + ic('doc') + '</span><span class="tx"><b>' + esc(nombre) + '</b><small>' + esc(o.sub || 'Lo sube Legal') + '</small></span></div>';
      return '<button type="button" class="casilla doc falta" data-casilla="' + k + '" data-subir="' + k + '" data-suelta="1"><span class="ico mas" aria-hidden="true">+</span><span class="tx"><b>' + esc(nombre) + '</b><small>' + esc(o.sub || (req ? 'Toca o suelta el archivo aquí' : 'Opcional')) + '</small></span>' +
        (req ? '<span class="chip rojo">Falta</span>' : '') + '</button>';
    }
    const mk = F.puedo.revisar ? marcaDe(d.id) : null;
    if(mk){
      const dv = mk.accion === 'devolver';
      const ia = mk.origen === 'ia'; const pg = ia && mk.pagina ? ' (página ' + mk.pagina + ')' : '';
      return '<button type="button" class="casilla doc marcada ' + (dv ? 'dev' : '') + '" data-casilla="' + k + '" data-ver="' + d.id + '"><span class="ico" aria-hidden="true">' + (dv ? '!' : ic('check')) + '</span><span class="tx"><b>' + esc(nombre) + '</b><small>' +
        esc(dv ? (ia ? 'La IA propone devolver: ' : 'Para devolver: ') + (C.MOTIVOS[mk.motivo] || '').toLowerCase() + (mk.nota ? '. ' + mk.nota : '') + pg : ia ? 'La IA lo da por bueno' + pg + '. Se aprueba al cerrar' : 'Para aprobar al cerrar la revisión') + '</small></span><span class="chip ' + (dv ? 'rojo">' : 'azul">') + (ia ? 'IA: ' : '') + (dv ? 'Devolver' : 'Aprobar') + '</span></button>';
    }
    const iaM = F.puedo.revisar && d.estado === 'por_revisar' ? iaDe(d.id) : null;
    if(iaM && iaM.propuesta === 'revisar_a_mano'){
      return '<button type="button" class="casilla doc rev" data-casilla="' + k + '" data-ver="' + d.id + '"><span class="ico" aria-hidden="true">?</span><span class="tx"><b>' + esc(nombre) + '</b><small>' + esc('La IA no pudo decidir: ' + (iaM.nota || 'míralo tú')) + '</small></span><span class="chip morado">Míralo tú</span></button>';
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
    const tel = String(r.telefono || '').trim(); const co = String(r.correo || '').trim(); const algo = tel || co;
    // Lote urgente 20/10: con contrato presencial no se piden correos ni teléfono (el contacto queda opcional)
    const pres = n === 1 && !!F.cliente.presencial; const lleno = !!(tel && co);
    const falta = obligatorio && !lleno;
    const sub = lleno ? tel + ' · ' + co : algo ? algo + (obligatorio ? '. Falta el ' + (tel ? 'correo' : 'teléfono') : '') : obligatorio ? 'Toca para escribir el teléfono y el correo' : pres ? 'Opcional: contrato presencial' : 'Opcional';
    return '<button type="button" class="casilla doc dato ' + (falta ? 'falta' : algo ? 'ok' : '') + '" data-campo="rep:' + n + '"><span class="ico' + (algo && !falta ? '' : ' mas') + '" aria-hidden="true">' + (algo && !falta ? ic('check') : ic('lapiz')) + '</span>' +
      '<span class="tx"><b>Contacto</b><small>' + esc(sub) + '</small></span>' + (falta ? '<span class="chip rojo">Falta</span>' : algo ? ic('lapiz', 'ch') : '') + '</button>';
  }
  // Lote urgente 20/10: un representante agregado sin ningún dato ni archivo no se pide y se puede quitar
  const repConAlgo = (n) => { const r = (F.representantes || []).find((x) => x.orden === n) || {};
    return !!(String(r.nombre || '').trim() || String(r.correo || '').trim() || String(r.telefono || '').trim() || docDe('cedula', n) || docDe('rif_personal', n)); };
  // Lote 05/11 C4: con firma separada cuenta el representante que firma ("Firma este"); "Ya no aplica" queda en gris en el historial
  const firmanteN = () => { const r = (F.requeridos || []).find((x) => x.casilla === 'cedula'); return r ? Number(r.numero) : 1; };
  function marcasRep(r, n){
    if(F.cliente.es_natural || !F.puedo.marcar_rep) return '';
    const sep = F.cliente.regimen_firma !== 'conjunta'; const b = (m, t) => '<button type="button" class="enlace chico" data-rep-marca="' + n + ':' + m + '">' + t + '</button>';
    return '<div class="rep-marcas">' + (sep && firmanteN() !== n ? b('firma', 'Firma este') : '') + b('no_junta', 'No está en la junta') + b('ya_no_aplica', 'Ya no aplica') + '</div>';
  }
  function grupoRep(n, requeridoN, quitable){
    const r = (F.representantes || []).find((x) => x.orden === n) || {};
    if(!F.cliente.es_natural && r.marca && r.marca !== 'cuenta'){
      const docs = ['cedula', 'rif_personal'].map((k) => docDe(k, n)).filter(Boolean);
      return '<section class="bloque rep-fuera" data-grupo="rep' + n + '"><div class="sec">Representante ' + n + (r.nombre ? '<span>' + esc(r.nombre) + '</span>' : '') + '<span class="chip gris">' + (r.marca === 'no_junta' ? 'No está en la junta' : 'Ya no aplica') + '</span></div>' +
        '<p class="nota-chica">' + esc((r.marca_motivo ? r.marca_motivo + '. ' : '') + (F.cliente.regimen_firma === 'conjunta' ? 'No cuenta para la firma.' : 'Con firma separada no se le pide nada.')) + '</p>' +
        (docs.length ? '<p class="nota-chica">' + docs.map((d) => '<button type="button" class="enlace chico" data-ver="' + d.id + '">' + esc(casilla(d.casilla, d.numero)) + '</button>').join(' · ') + ' · se guardan en el historial, no cuentan</p>' : '') +
        (F.puedo.marcar_rep ? '<button type="button" class="btn btn-chico btn-2" data-rep-marca="' + n + ':cuenta">Volver a contar</button>' : '') + '</section>';
    }
    const vacio = !requeridoN && !repConAlgo(n); const firma = !F.cliente.es_natural && F.cliente.regimen_firma !== 'conjunta' && firmanteN() === n && repConAlgo(n);
    return '<section class="bloque" data-grupo="rep' + n + '"><div class="sec">' + (F.cliente.es_natural ? 'Titular' : 'Representante ' + n) + (r.nombre ? '<span>' + esc(r.nombre) + '</span>' : vacio ? '<span>Opcional</span>' : '') + (firma ? '<span class="chip azul">Firma este</span>' : '') + '</div>' + marcasRep(r, n) +
      contactoHtml(r, n, requeridoN && !F.cliente.es_natural && !F.cliente.presencial) +
      casillaHtml('cedula', n, { nombre: 'Cédula' }) + casillaHtml('rif_personal', n, { nombre: 'RIF personal' }) +
      (vacio && quitable ? '<button type="button" class="enlace" data-quitar-rep="' + n + '">Quitar representante</button>' : '') + '</section>';
  }
  function pintarDocumentos(){
    const c = F.cliente; const fal = F.faltantes || []; const nr = F.puedo.revisar ? sinMarcar().length : porRevisar().length;
    const aprobados = (F.documentos || []).filter((d) => d.estado === 'aprobado').length;
    const pedirM = c.estatus === 'grandes_negocios' ? 'pedir' : 'recordar';
    // Lote 28/10: arriba, qué falta en una línea y el botón para pedirlo; abajo, la zona para soltar varios archivos
    const falN = fal.map((x) => x.t + (x.e === 'devuelto' ? ' (devuelta)' : ''));
    let h = presencialHtml() + suspHtml() +
      (fal.length ? '<div class="fd-sum" data-faltan="' + fal.length + '"><span><b>' + (fal.length === 1 ? 'Falta 1:' : 'Faltan ' + fal.length + ':') + '</b> ' + esc(C.lista(falN)) + '</span><button type="button" class="btn btn-chico" data-paso="pedir:' + pedirM + '">Pedir lo que falta</button></div>'
        : '<div class="fd-sum ok" data-faltan="0"><span><b>No falta nada.</b> ' + esc(plural(aprobados, 'documento aprobado', 'documentos aprobados')) + (nr ? ', ' + esc(plural(nr, 'por revisar', 'por revisar')) : '') + '</span></div>') +
      '<div class="acc">' +
        (F.puedo.revisar && nr ? '<button type="button" class="btn btn-chico" id="revisarTodo">Revisar ' + nr + '</button>' : '') +
        (F.puedo.revisar && nr > 1 ? '<button type="button" class="btn btn-chico btn-2" id="elegirAprobar" aria-pressed="' + selMode + '">' + (selMode ? 'Cancelar' : 'Aprobar seleccionados') + '</button>' : '') + '</div>' +
      (selMode ? '<div class="al-banda azul sel-barra" role="status"><b>' + (selDocs.size ? plural(selDocs.size, 'documento elegido', 'documentos elegidos') : 'Toca los documentos que quieres aprobar') + '</b><p>Quedan marcados para aprobar; se aprueban al cerrar la revisión.</p>' +
        '<p style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="btn btn-chico" id="aprobarSel"' + (selDocs.size ? '' : ' disabled') + '>Aprobar ' + (selDocs.size || '') + '</button><button type="button" class="btn btn-chico btn-2" id="selTodos">Elegir todos</button></p></div>' : '') +
      (c.aprobado_por_subir ? '<div class="al-banda ambar" role="note"><b>Aprobado, documentos por subir</b><p>Legal ya lo aprobó. Sube lo que falta: no cambia su aprobación ni su comisión.</p></div>' : '') +
      quePedir() + bloqueIA() + panelRevision() + barraRevision() +
      '<button type="button" class="fd-drop" id="subirVarios">' + ic('subir') + '<span><span class="solo-pc">Arrastra aquí varios archivos y marca qué trae cada uno</span><span class="solo-tel">Toca para subir varios archivos y marca qué trae cada uno</span></span></button>' +
      '<p class="nota-chica' + (colaDe(id) ? '' : ' hidden') + '" id="estadoSubida" role="status"><span class="cargando-linea"><i></i><span id="textoSubida">' + esc(textoCola()) + '</span></span></p>' + driveHtml();
    h += casillasHtml(false) + historialRevisiones();
    $('tab-documentos').innerHTML = h;
  }
  // Las casillas del expediente, en su orden. emb: dentro de otra hoja (la de comisión), sin agregar representantes ni actas
  // Lote urgente 20/10: el interruptor de contrato presencial va arriba de Documentos (y en la hoja de comisión)
  // Lote 21/10: la firma Digital o Física (Física = contrato presencial) se elige en la pestaña Contrato; aquí solo se avisa
  function presencialHtml(){
    const c = F.cliente; if(c.es_natural || !c.presencial) return '';
    return '<div class="al-banda azul presencial-docs" role="note"><b>Firma física (contrato presencial)</b><p>No se piden correos ni teléfono; sí los documentos legales. Comisiona igual.</p>' +
      '<p style="margin-top:8px"><button type="button" class="enlace" data-ir-tab="contrato">Cambiar en Contrato</button></p></div>';
  }
  // Suspendido: se le pueden seguir pidiendo documentos
  function suspHtml(){
    const c = F.cliente; if(!c.suspendido_en) return '';
    return '<div class="al-banda rojo" role="note"><b>Cliente suspendido</b><p>' + esc(c.suspendido_nota || 'Sin nota') + '. No sale en la lista ni en los contadores; igual se le pueden pedir documentos.</p></div>';
  }
  function casillasHtml(emb){
    const c = F.cliente; let h = '';   // en la hoja de comisión la firma (Digital o Física) va en su bloque Legal
    const nReq = !c.es_natural && c.regimen_firma === 'conjunta' ? 2 : 1;
    // Los representantes que se ven: los que pide el régimen, los que tienen algo y el que se acaba de agregar
    const conAlgo = REPS.slice(1).filter((n) => repConAlgo(n));
    const pedidosRep = reqs().filter((x) => x.k === 'cedula' || x.k === 'rif_personal').map((x) => Number(x.n));
    const nReps = Math.max(nReq, firmanteN(), conAlgo.length ? Math.max.apply(null, conAlgo) : 1, pedidosRep.length ? Math.max.apply(null, pedidosRep) : 1, emb ? 0 : repExtra);
    for(let n = 1; n <= nReps; n++) h += grupoRep(n, esRequerido('cedula', n) || (c.regimen_firma === 'conjunta' && n <= nReq), !emb && n === nReps);
    if(!emb && !c.es_natural && nReps < REPS.length) h += '<button type="button" class="btn btn-chico btn-2 btn-ancho" id="agregarRep" style="margin-top:12px">Agregar representante</button>';
    if(!c.es_natural){
      // Las actas de asamblea se agregan con su botón, hasta 15; las que tienen fecha van en orden de fecha
      const actas = ACTAS.filter((n) => docDe('acta_asamblea', n)).sort((a, b) => (docDe('acta_asamblea', a).firmado_en || '9999').localeCompare(docDe('acta_asamblea', b).firmado_en || '9999') || a - b);
      const libres = ACTAS.filter((n) => !docDe('acta_asamblea', n));
      const pedidas = libres.filter((n) => reqDe('acta_asamblea', n)); const libres2 = libres.filter((n) => !reqDe('acta_asamblea', n));
      const mostrar = actas.concat(pedidas).concat(libres2.slice(0, Math.min(emb ? (actas.length || pedidas.length ? 0 : 1) : actaExtra, libres2.length)));
      h += '<section class="bloque" data-grupo="empresa"><div class="sec">Empresa</div>' + datoHtml('Correo de la empresa', c.correo_empresa, 'correo_empresa', !c.presencial) +
        casillaHtml('rif_empresa', 0, { nombre: 'RIF de la empresa' }) + casillaHtml('acta_constitutiva', 0) + (c.es_isp ? casillaHtml('conatel', 0, { sub: docDe('conatel', 0) ? undefined : 'Habilitación vigente con atributos de Internet y Transporte' }) : '') +
        mostrar.map((n) => casillaHtml('acta_asamblea', n, { sub: 'Toca o suelta el archivo aquí' })).join('') +
        (!emb && mostrar.length < ACTAS.length ? '<button type="button" class="btn btn-chico btn-2 btn-ancho" id="agregarActa" style="margin-top:10px">' + ic('mas') + 'Agregar acta de asamblea</button>' : '') + '</section>';
    }
    const tieneDed = /Dedicado/.test(c.seg); const tienePyme = !/^Dedicado/.test(c.seg);
    // El contrato aparece cuando ya se envió a firmar (o si ya hay uno guardado). Los naturales no llevan contrato.
    const hayContrato = !!(docDe('contrato_pyme', 0) || docDe('contrato_dedicado', 0));
    if(emb && (hayContrato || (!c.es_natural && (c.estatus === 'por_firmar' || c.estatus === 'contrato_firmado')))){
      h += '<section class="bloque" data-grupo="contrato"><div class="sec">Contrato<span>Lo sube Legal</span></div>' +
        ((tienePyme && !c.es_natural) || docDe('contrato_pyme', 0) ? casillaHtml('contrato_pyme', 0, { sub: F.puedo.contrato ? 'Con fecha de firma y de vencimiento' : 'Lo sube Legal' }) : '') +
        (tieneDed || docDe('contrato_dedicado', 0) ? casillaHtml('contrato_dedicado', 0, { sub: F.puedo.contrato ? 'Con fecha de firma y de vencimiento' : 'Lo sube Legal' }) : '') + '</section>';
    }
    if(emb) h += grupoVgt();
    const otros = (F.documentos || []).filter((d) => d.casilla === 'otro' && d.numero < 60);
    const otrosPed = reqs().filter((x) => x.k === 'otro' && Number(x.n) < 60 && !docDe('otro', Number(x.n)));
    h += '<section class="bloque" data-grupo="otros"><div class="sec">Otros documentos</div>' + otros.map((d) => casillaHtml('otro', d.numero, { nombre: d.titulo || undefined })).join('') + otrosPed.map((x) => casillaHtml('otro', Number(x.n))).join('') +
      '<button type="button" class="casilla doc" data-subir="otro:0" data-casilla="otro:0" data-suelta="1"><span class="ico mas" aria-hidden="true">+</span><span class="tx"><b>Otro documento</b><small>Lo que no entra en las casillas de arriba</small></span></button></section>';
    return h;
  }
  // Lote 3: requisitos VGT, con su propio contador. Los comunes (actas, RIF, cédulas, Conatel) no se repiten.
  // Lote 05/11 F3: las 2 pólizas son del cliente (sirven para todas sus solicitudes); la propuesta comercial firmada y las planillas de tendido van por solicitud
  let vgtExtra = 0;
  function grupoVgt(conSol){
    const V = (F.cliente.dedicado || {}).vgt; if(!V) return '';
    const R = V.requisitos || []; const hoy = F.hoy || new Date().toISOString().slice(0, 10);
    const asam = R.filter((r) => r.clave === 'asamblea'); const conAsam = asam.filter((r) => docDe('otro', r.numero));
    const libres = asam.filter((r) => !docDe('otro', r.numero));
    const verAsam = conAsam.concat(libres.slice(0, (conAsam.length ? 0 : 1) + vgtExtra));
    // Lote 05/11 A4: responsabilidad civil general mínimo US$ 100.000; la patronal no tiene mínimo
    const sub = (r) => (r.vence ? 'Con vencimiento. ' + (/patronal/i.test(r.texto || '') ? 'Sin monto mínimo' : 'Mínimo US$ 100.000') + ', aseguradora del top 10 de SUDEASEG y mención al contrato' : r.requerido ? 'Toca o suelta el archivo aquí' : 'Opcional');
    const aviso = (V.polizas || []).filter((p) => p.vence_en && C.diasEntre(hoy, p.vence_en) <= 30).map((p) => {
      const r = R.find((x) => x.numero === p.numero) || {}; const d = C.diasEntre(hoy, p.vence_en);
      return '<div class="al-banda ' + (d < 0 ? 'rojo' : 'ambar') + '" role="note"><b>' + esc(r.texto || 'Póliza') + '</b><p>' + esc(d < 0 ? 'Venció el ' + fecha(p.vence_en) + '. Pide la renovación.' : 'Vence el ' + fecha(p.vence_en) + '. Pide la renovación antes.') + '</p></div>';
    }).join('');
    // 22/10: una póliza sin fecha de vencimiento no puede avisar antes de vencer
    const sinFecha = R.filter((r) => r.vence).map((r) => docDe('otro', r.numero)).filter((d) => d && d.estado !== 'devuelto' && !d.vence_en);
    const faltaFecha = sinFecha.length ? '<div class="al-banda ambar" role="note"><b>' + (sinFecha.length === 1 ? 'Falta la fecha de vencimiento de una póliza' : 'Falta la fecha de vencimiento de las pólizas') + '</b><p>' +
      (F.puedo.revisar ? 'Toca la póliza, escribe la fecha de vencimiento y guarda. Sin fecha no te podemos avisar antes de que venza.' : 'Pídele al administrador que la escriba. Sin fecha no te podemos avisar antes de que venza.') + '</p></div>' : '';
    const req = R.filter((r) => r.requerido); const pf = V.polizas_faltan != null ? V.polizas_faltan : req.filter((r) => { const d = docDe('otro', r.numero); return !d || d.estado === 'devuelto'; }).length;
    const vieja = R.filter((r) => r.clave === 'propuesta' && !r.requerido && docDe('otro', r.numero));
    return '<section class="bloque" data-grupo="vgt"><div class="sec">Pólizas VGT del cliente<span>' + (req.length - pf) + ' de ' + req.length + '</span></div>' +
      '<p class="nota-chica estado-sub' + (colaDe(id) ? '' : ' hidden') + '" role="status"><span class="cargando-linea"><i></i><span class="texto-sub">' + esc(textoCola()) + '</span></span></p>' + aviso + faltaFecha +
      '<p class="nota-chica">Sirven para todas sus solicitudes. La fecha de vencimiento se escribe al subirlas o revisarlas; 30 días antes te avisamos.</p>' +
      req.map((r) => casillaHtml('otro', r.numero, { nombre: r.texto, req: true, sub: sub(r) })).join('') +
      vieja.map((r) => casillaHtml('otro', r.numero, { nombre: r.texto, req: false })).join('') +
      '<div class="rot">Opcional</div>' +
      datoHtml('Correo para notificaciones', V.correo, 'vgt_correo', true) +
      verAsam.map((r) => casillaHtml('otro', r.numero, { nombre: r.texto.replace(/ \d$/, ''), req: false, sub: sub(r) })).join('') +
      (verAsam.length < asam.length ? '<button type="button" class="btn btn-chico btn-2 btn-ancho" id="agregarVgt" style="margin-top:10px">' + ic('mas') + 'Agregar acta de cambios sustanciales</button>' : '') +
      R.filter((r) => r.clave !== 'asamblea' && r.clave !== 'propuesta' && !r.requerido).map((r) => casillaHtml('otro', r.numero, { nombre: r.texto, req: false, sub: sub(r) })).join('') + '</section>' +
      (conSol ? solicitudesVgt(V) : '<p class="nota-chica">La propuesta comercial y las planillas de tendido van por solicitud, en la pestaña Contratos y VGT.</p>');
  }
  // Una tarjeta por solicitud (fila de VGT del dedicado): propuesta comercial firmada (1) y planillas de tendido (1 o más)
  function solicitudesVgt(V){
    const S = V.solicitudes || []; const puedeNueva = yo && yo.rol !== 'aliado';
    const fila = (s, tipo, ds) => {
      const nom = tipo === 'propuesta' ? 'Propuesta comercial firmada' : 'Planilla de tendido aprobada por infraestructura';
      const subidos = ds.filter((d) => docDe('otro', d.numero));
      if(!subidos.length){
        if(!s.pide) return '';
        return '<button type="button" class="casilla doc falta" data-vgt-subir="' + esc(s.id + ':' + tipo) + '"><span class="ico" aria-hidden="true">!</span><span class="tx"><b>' + esc(tipo === 'propuesta' ? nom : 'Planillas de tendido aprobadas por infraestructura') + '</b><small>' +
          esc(tipo === 'propuesta' ? 'La genera el administrador; falta la firma del cliente' : 'Puede llevar varias si los postes están en zonas distintas') + '</small></span><span class="chip rojo">Falta</span></button>';
      }
      return subidos.map((d, i) => casillaHtml('otro', d.numero, { nombre: tipo === 'planilla' && subidos.length > 1 ? 'Planilla de tendido ' + (i + 1) : nom, req: true })).join('') +
        (tipo === 'planilla' && s.pide !== false ? '<button type="button" class="btn btn-chico btn-2" data-vgt-subir="' + esc(s.id + ':planilla:otra') + '">' + ic('mas') + 'Otra planilla</button>' : '');
    };
    const tarjeta = (s) => {
      const ds = s.docs || []; const prop = ds.filter((d) => d.tipo === 'propuesta'); const plan = ds.filter((d) => d.tipo === 'planilla');
      const est = s.negada ? ['rojo', 'Negada'] : s.estatus === 'firmado' ? ['verde', 'Contrato firmado'] : !s.pide ? ['gris', 'No pide documentos'] : s.faltan ? ['ambar', s.faltan === 1 ? 'Falta 1' : 'Faltan ' + s.faltan] : (V.polizas_faltan ? ['ambar', 'Faltan las pólizas'] : ['verde', 'Lista para contrato']);
      const sub = [s.postes ? s.postes + ' postes' : '', s.fecha ? 'solicitada ' + s.fecha : '', s.odt && !/revisar/i.test(s.odt) ? 'ODT ' + s.odt : ''].filter(Boolean).join(' · ');
      return '<div class="vgt-sol" data-sol="' + esc(s.id) + '"><div class="vgt-sol-c"><span class="tx"><b>' + esc(s.proyecto || 'Solicitud ' + s.id) + '</b><small>' + esc(sub) + '</small></span><span class="chip ' + est[0] + '">' + esc(est[1]) + '</span></div>' +
        (s.negada ? '<p class="nota-chica">Solicitud negada: no se le pide nada.</p>' : fila(s, 'propuesta', prop) + fila(s, 'planilla', plan)) + '</div>';
    };
    const activas = S.filter((s) => !s.negada); const neg = S.filter((s) => s.negada);
    return '<section class="bloque" data-grupo="vgt-sol"><div class="sec">Solicitudes de VGT<span>' + S.length + '</span></div>' +
      (activas.length ? activas.map(tarjeta).join('') : '<p class="nota-chica">Ninguna solicitud activa.</p>') +
      (neg.length ? '<details class="vgt-hist"><summary>' + esc(plural(neg.length, 'solicitud negada', 'solicitudes negadas')) + '</summary>' + neg.map(tarjeta).join('') + '</details>' : '') +
      (puedeNueva ? '<button type="button" class="btn btn-chico btn-2 btn-ancho" id="vgtNueva" style="margin-top:10px">' + ic('mas') + 'Nueva solicitud</button>' : '') +
      '<p class="nota-chica">El abogado ve cada solicitud en Mi trabajo, "Por elaborar · VGT", cuando tiene las pólizas del cliente y su propuesta y planilla.</p></section>';
  }
  // Un dedicado sin VGT activo también puede pedir uno
  const vgtSinSol = () => '<section class="bloque" data-grupo="vgt-sol"><div class="sec">VGT</div><p class="nota-chica">Sin solicitudes de VGT activas. Si el cliente va a usar postes, crea su solicitud.</p>' +
    '<button type="button" class="btn btn-chico btn-2 btn-ancho" id="vgtNueva">' + ic('mas') + 'Nueva solicitud de VGT</button></section>';
  function abrirNuevaSol(){
    campo = { tipo: 'vgt_sol' };
    $('hojaCampo').innerHTML = cabHoja('tCampo', 'Nueva solicitud de VGT', F.cliente.nombre) + '<form id="formSol" novalidate>' +
      '<label class="rotulo" for="sProy">Proyecto o tramo</label><input class="campo" id="sProy" maxlength="120" autocomplete="off" data-foco><div class="error" id="eSProy" role="alert"></div>' +
      '<label class="rotulo arriba" for="sPostes">Postes</label><input class="campo" id="sPostes" inputmode="numeric" maxlength="4" autocomplete="off"><div class="error" id="eSPostes" role="alert"></div>' +
      '<label class="rotulo arriba" for="sFecha">Fecha de la solicitud</label><input class="campo" id="sFecha" type="date" max="' + esc(F.hoy || '') + '" value="' + esc(F.hoy || '') + '">' +
      '<p class="nota">Después sube la propuesta comercial firmada y la planilla de tendido aprobada por infraestructura.</p>' +
      '<div class="acciones"><button type="submit" class="btn btn-ancho" id="guardarSol">Crear solicitud</button></div></form>';
    abrirHoja('hojaCampo');
  }
  async function guardarSol(e){
    e.preventDefault(); $('eSProy').textContent = ''; $('eSPostes').textContent = '';
    const p = $('sProy').value.trim(); const n = $('sPostes').value.trim();
    if(p.length < 3){ $('eSProy').textContent = 'Escribe el nombre del proyecto o del tramo'; $('sProy').focus(); return; }
    if(n && !/^\d{1,4}$/.test(n)){ $('eSPostes').textContent = 'Solo el número de postes'; $('sPostes').focus(); return; }
    const b = $('guardarSol'); b.disabled = true; b.textContent = 'Creando…';
    try { await rpc('vgt_solicitud_nueva', { p_cliente: F.cliente.id, p_proyecto: p, p_postes: n ? Number(n) : null, p_fecha: $('sFecha').value || null }); cerrarHoja(); toast('Solicitud creada. Sube su propuesta y su planilla'); await cargar(); }
    catch (x) { $('eSProy').textContent = x.message; b.disabled = false; b.textContent = 'Crear solicitud'; }
  }
  document.addEventListener('submit', (e) => { if(e.target && e.target.id === 'formSol') guardarSol(e); });
  const resumenMarcas = () => { const ap = marcas().filter((m) => m.accion === 'aprobar').length; const dv = marcas().length - ap;
    return [ap ? plural(ap, 'para aprobar', 'para aprobar') : '', dv ? plural(dv, 'para devolver', 'para devolver') : ''].filter(Boolean).join(' y '); };
  // ---------- Revisión con IA ----------
  const VEREDICTO = { apto: ['verde', 'Apto'], no_apto: ['rojo', 'No apto'], revisar_a_mano: ['morado', 'Revisar a mano'] };
  const PUNTO = { bloquea: ['rojo', 'Bloquea'], mano: ['morado', 'A mano'], aviso: ['azul', 'Aviso'], ok: ['verde', 'Cumple'] };
  function puntoIA(p, puede){
    const t = PUNTO[p.estado] || PUNTO.aviso;
    return '<div class="ia-p"><span class="chip ' + (p.excepcion ? 'azul' : t[0]) + '">' + (p.excepcion ? 'Excepción' : t[1]) + '</span><span class="tx"><b>' + esc(p.titulo) + '</b><small>' + esc(p.detalle + (p.pagina ? ' ' + p.pagina + '.' : '')) + '</small>' +
      (puede && p.excepcionable && p.estado === 'bloquea' ? '<button type="button" class="enlace" data-exc-ia="' + esc(p.id) + '">Conceder excepción</button>' : '') +
      (puede && p.excepcion ? '<button type="button" class="enlace" data-quitar-exc="' + esc(p.id) + '">Quitar excepción</button>' : '') + '</span></div>';
  }
  function bloqueIA(){
    if(!F.puedo.revisar || !rev || rev.error) return '';
    const k = rev.ia; const puede = !!rev.puede_ia;
    const boton = (txt) => (puede && rev.archivos && !iaActiva() ? '<button type="button" class="mini' + (k && k.estado === 'lista' ? '' : ' pri') + '" id="mandarIA">' + txt + '</button>' : '');
    if(!k || k.estado === 'cerrada'){
      if(!puede) return '';
      return '<div class="ia-bloque"><div class="ia-cab"><span class="tx"><b>Revisión con IA</b><small>' + (rev.archivos ? plural(rev.archivos, 'archivo', 'archivos') + (rev.nuevos ? ', ' + plural(rev.nuevos, 'sin leer', 'sin leer') : ', todos ya leídos') : 'Todavía no hay documentos') +
        (k ? '. La última se usó al cerrar la revisión del ' + esc(fecha(k.terminada_en)) : '') + '.</small></span>' + boton('Mandar a revisión con IA') + '</div></div>';
    }
    if(iaActiva()){
      return '<div class="ia-bloque" id="iaLeyendo" aria-busy="true"><div class="ia-cab"><span class="tx"><b>' + (k.nuevos ? 'La IA está leyendo' : 'La IA está actualizando el resultado') + '</b><small>' +
        (k.nuevos ? esc(k.avance + ' de ' + k.total) + ' archivos. Puedes seguir trabajando: el resultado sale aquí y las propuestas quedan marcadas.' : 'Con los datos de ahora y lo que ya leyó: no cuesta. Tarda unos segundos.') + '</small><span class="carga-barra" aria-hidden="true"><i></i></span></span>' +
        (k.trabada && puede ? '<button type="button" class="mini" id="reanudarIA">Reanudar</button>' : '') + '</div></div>';
    }
    if(k.estado === 'error'){
      return '<div class="ia-bloque"><div class="estado rojo chico" role="alert"><small>La IA no pudo terminar: ' + esc(k.error || 'error desconocido') + '</small>' + (puede ? '<button type="button" class="mini" id="reanudarIA">Reintentar</button>' : '') + '</div></div>';
    }
    const v = VEREDICTO[k.veredicto] || ['', 'Sin veredicto'];
    const orden = { bloquea: 0, mano: 1, aviso: 2 };
    const malos = (k.puntos || []).filter((p) => p.estado !== 'ok' || p.excepcion).sort((a, b) => (orden[a.estado] === undefined ? 3 : orden[a.estado]) - (orden[b.estado] === undefined ? 3 : orden[b.estado]));
    const buenos = (k.puntos || []).filter((p) => p.estado === 'ok' && !p.excepcion);
    return '<div class="ia-bloque" id="iaResultado"><div class="ia-cab"><span class="tx"><b>Revisión con IA <span class="chip ' + v[0] + '">' + v[1] + '</span></b><small>' + esc(dia(k.terminada_en) + ' ' + hora(k.terminada_en)) + ' · ' + plural(k.total, 'archivo', 'archivos') + ' · ' + esc('US$ ' + Number(k.costo_usd || 0).toFixed(2)) +
      '. Lo que propone ya está marcado en cada documento: cámbialo si no estás de acuerdo y cierra la revisión.</small></span>' + boton('Revisar de nuevo') + '</div>' + avisoViejo(k, puede) +
      (malos.length ? '<div class="ia-ps">' + malos.map((p) => puntoIA(p, puede)).join('') + '</div>' : '') +
      (buenos.length ? '<details class="ia-ok"><summary>' + plural(buenos.length, 'punto del expediente cumple', 'puntos del expediente cumplen') + '</summary><div class="ia-ps">' + buenos.map((p) => puntoIA(p, puede)).join('') + '</div></details>' : '') + '</div>';
  }
  // Mientras la IA lee, se pregunta cada 5 segundos; al terminar se refresca el expediente
  function vigilar(){
    clearTimeout(sondeo); sondeo = null;
    if(actualizarSolo()) return;
    if(!id || !iaActiva()) return;
    const mio = id;
    sondeo = setTimeout(async () => {
      if(mio !== id) return;
      let r; try { r = await rpc('revision_estado', { p_cliente: mio }); } catch (e) { vigilar(); return; }
      if(mio !== id) return;
      rev = r;
      if(iaActiva()){ if(!encima()) pintarDocumentos(); pintarCab(); vigilar(); return; }
      try { F = await rpc('cliente_ficha', { p_cliente: mio }); } catch (e) {}
      if(mio !== id) return;
      pintarTodo();
      const k = rev.ia;
      if(k && k.estado === 'lista') toast('La IA terminó: ' + ((VEREDICTO[k.veredicto] || [])[1] || 'revisa el resultado') + '. Mira Documentos');
      else if(k && k.estado === 'error') toast('La IA no pudo terminar: ' + (k.error || ''), 'error');
    }, 5000);
  }
  function abrirMandarIA(){
    if(!rev || !rev.puede_ia) return;
    const n = rev.nuevos || 0;
    $('hojaIA').innerHTML = cabHoja('tIA', 'Revisión con IA', F.cliente.nombre) +
      '<div class="datos" style="margin-top:0">' + fila('Archivos', esc(plural(rev.archivos || 0, 'archivo vigente', 'archivos vigentes'))) +
        fila('Por leer', esc(n ? plural(n, 'archivo nuevo', 'archivos nuevos') + ', unos US$ ' + (n * 0.04).toFixed(2) : 'Ninguno: todo ya se leyó, no cuesta')) + '</div>' +
      '<p class="nota">La IA lee los documentos, propone aprobar o devolver cada uno y revisa el expediente completo. No cambia el estatus ni le avisa al líder: eso pasa cuando tú cierras la revisión. Lo que ya marcaste a mano se respeta.</p>' +
      '<div class="error" id="eIA" role="alert"></div>' +
      '<div class="acciones"><button type="button" class="btn btn-ancho" id="lanzarIA">Revisar con IA</button></div>';
    abrirHoja('hojaIA');
  }
  async function lanzarIA(b){
    b.disabled = true; $('eIA').textContent = '';
    try {
      const r = await rpc('ia_lanzar', { p_clientes: [id] });
      if(!(r && (r.lanzadas || []).length)){ const o = ((r && r.omitidos) || [])[0]; $('eIA').textContent = (o && o.motivo) || 'No se pudo lanzar la revisión'; b.disabled = false; return; }
    } catch (e) { $('eIA').textContent = e.message; b.disabled = false; return; }
    if(hojaAbierta() === 'hojaIA') cerrarHoja();
    toast('La IA empezó a leer. Te aviso aquí cuando termine');
    try { rev = await rpc('revision_estado', { p_cliente: id }); } catch (e) {}
    pintarTodo(); vigilar();
  }
  // Lote 3: el resultado de la IA nunca se relee solo. El administrador lo actualiza con el enlace chico si quiere.
  function actualizarSolo(){ return false; }
  async function actualizarIA(b, solo){
    if(b) b.disabled = true;
    const mio = id;
    try { await rpc('ia_actualizar', { p_corrida: rev.ia.id }); if(mio !== id) return; rev = await rpc('revision_estado', { p_cliente: mio }); }
    catch (e) { if(mio === id) toast((solo ? 'No se pudo actualizar el resultado de la IA: ' : '') + e.message, 'error'); if(b && document.contains(b)) b.disabled = false; return; }
    if(mio !== id) return;
    if(!solo){ if(hojaAbierta() === 'hojaCerrarRev') cerrarHoja(); toast('La IA está actualizando el resultado. Te aviso aquí cuando termine'); }
    pintarTodo(); vigilar();
  }
  // Aviso de que el resultado es de antes de un cambio en el expediente
  function avisoViejo(k, puede){
    if(!k || k.estado !== 'lista' || !k.cambio) return '';
    const n = k.sin_leer || 0;
    return '<div class="estado ambar chico ia-vieja" role="status"><small>' +
      (n ? 'Subieron ' + plural(n, 'archivo', 'archivos') + ' después de la IA y este resultado no ' + (n === 1 ? 'lo' : 'los') + ' incluye.' + (puede ? ' Leer' + (n === 1 ? 'lo' : 'los') + ' cuesta unos US$ ' + (n * 0.04).toFixed(2) + '.' : '')
        : 'Cambiaron datos después de la IA y este resultado es de antes.') +
      (puede ? '' : ' El administrador debe actualizarlo.') + '</small>' +
      (puede ? '<button type="button" class="enlace chico" data-actualizar-ia>Actualizar resultado</button>' : '') + '</div>';
  }
  async function reanudarIA(b){
    b.disabled = true;
    try { await rpc('ia_reanudar', { p_corrida: rev.ia.id }); rev = await rpc('revision_estado', { p_cliente: id }); }
    catch (e) { toast(e.message, 'error'); b.disabled = false; return; }
    pintarTodo(); vigilar();
  }
  function abrirExcIA(punto){
    const p = ((rev && rev.ia && rev.ia.puntos) || []).find((x) => x.id === punto); if(!p) return;
    excIA = punto;
    $('hojaExcIA').innerHTML = cabHoja('tExcIA', 'Excepción: ' + p.titulo.toLowerCase(), F.cliente.nombre) +
      '<p class="nota" style="margin-top:0">' + esc(p.detalle) + '</p>' +
      '<label class="rotulo arriba" for="motExcIA">Motivo</label><textarea class="area corta" id="motExcIA" maxlength="300"></textarea><div class="error" id="eExcIA" role="alert"></div>' +
      '<p class="nota">Queda en la bitácora con tu nombre. La IA vuelve a decidir con la excepción, sin volver a leer (no cuesta).</p>' +
      '<div class="acciones"><button type="button" class="btn btn-ancho" id="darExcIA">Conceder excepción</button></div>';
    abrirHoja('hojaExcIA');
  }
  async function darExcIA(b, quitar, punto){
    const mot = quitar ? null : $('motExcIA').value.trim();
    if(!quitar && mot.length < 5){ $('eExcIA').textContent = 'Escribe el motivo (al menos 5 letras)'; $('motExcIA').focus(); return; }
    b.disabled = true;
    try { await rpc('ia_excepcion', { p_corrida: rev.ia.id, p_punto: punto || excIA, p_motivo: mot, p_quitar: !!quitar }); rev = await rpc('revision_estado', { p_cliente: id }); }
    catch (e) { if(quitar) toast(e.message, 'error'); else $('eExcIA').textContent = e.message; b.disabled = false; return; }
    if(!quitar && hojaAbierta() === 'hojaExcIA') cerrarHoja();
    toast(quitar ? 'Excepción quitada. La IA vuelve a decidir' : 'Excepción anotada. La IA vuelve a decidir');
    pintarTodo(); vigilar();
  }
  // Barra de la revisión en curso: lo marcado y el botón para cerrarla
  function barraRevision(){
    if(!F.puedo.revisar || !rev) return '';
    if(rev.error) return '<div class="estado ambar chico" role="alert"><small>No se pudo leer la revisión en curso: ' + esc(rev.error) + '</small><button type="button" class="mini" id="revReintentar">Reintentar</button></div>';
    if(!marcas().length) return '';
    const quedan = sinMarcar().length;
    return '<div class="estado azul chico" id="barraRev"><small>Revisión en curso: ' + esc(resumenMarcas()) + (quedan ? '. ' + (quedan === 1 ? 'Queda 1' : 'Quedan ' + quedan) + ' por revisar' : '') + '. ' + esc(capital(liderCorto())) + ' no se entera hasta cerrarla.</small>' +
      (rev.puede_cerrar ? '<button type="button" class="mini pri" id="abrirCerrarRev">Cerrar revisión</button>' : '') + '</div>';
  }
  function historialRevisiones(){
    const hs = (rev && rev.historial) || []; if(!F.puedo.revisar || !hs.length) return '';
    return '<section class="bloque" data-grupo="revisiones"><div class="sec">Revisiones<span>' + hs.length + '</span></div>' + hs.map((r) => {
      const e = C.ESTATUS[r.estatus] || { t: r.estatus || '' }; const dv = r.devueltos > 0;
      return '<div class="casilla doc ' + (dv ? 'dev' : 'ok') + '"><span class="ico" aria-hidden="true">' + (dv ? '!' : ic('check')) + '</span><span class="tx"><b>' + esc(e.t) + (r.con_ia ? ' · con IA' : '') + '</b><small>' +
        esc(dia(r.en) + ' ' + hora(r.en) + (r.por ? ' · ' + primerNombre(r.por) : '') + ' · ' + plural(r.aprobados || 0, 'aprobado', 'aprobados') + (dv ? ', ' + plural(r.devueltos, 'devuelto', 'devueltos') : '') + (r.enviado ? ' · se avisó al líder' : '')) + '</small></span></div>';
    }).join('') + '</section>';
  }

  // ---------- Lote 05/11 parte C ----------
  const REQ_TIPOS = [['junta', 'Acta de asamblea de ratificación o cambio de junta directiva'], ['razon', 'Acta de asamblea de cambio de razón social'], ['domicilio', 'Acta de asamblea de cambio de domicilio fiscal'],
    ['prorroga', 'Acta de asamblea de prórroga de la duración'], ['nombra', 'Acta que nombra al representante'], ['otro', 'Otro documento (escribe cuál)']];
  const reqTexto = (k) => { const x = REQ_TIPOS.find((t) => t[0] === k); return x && k !== 'otro' ? x[1] : String(k || ''); };
  const reqs = () => (F.faltantes || []).filter((x) => x.req);
  const reqDe = (cas, num) => reqs().find((x) => x.k === cas && Number(x.n) === Number(num)) || null;
  // Puntos del panel en el orden de la oficina: [id, título, punto de la IA, documento que se pide por defecto]
  const PUNTOS_REV = [['razon_social', 'Razón social', 'razon_social', 'razon'], ['domicilio', 'Domicilio fiscal', 'domicilio', 'domicilio'], ['vigencia', 'Vigencia de la empresa', 'duracion', 'prorroga'],
    ['junta', 'Junta directiva', 'junta', 'junta'], ['firmantes', 'Firmantes', 'firmantes', 'nombra'], ['contacto', 'Contacto', 'contacto', 'otro']];
  const tipoDeFalta = (t) => { const n = normalizeStr(t || ''); return /junta/.test(n) ? 'junta' : /razon social|nombre/.test(n) ? 'razon' : /domicilio/.test(n) ? 'domicilio' : /prorroga|duracion/.test(n) ? 'prorroga' : /representante/.test(n) ? 'nombra' : null; };
  // C1: panel "Revisión del expediente". La IA solo propone (borde punteado, "Propuesta, falta confirmar"); nunca sale como Bien ya marcado.
  // Lote 10/11 C1: fuera de una revisión el panel es una sola línea "Revisión: N de M marcados · Abrir"; se abre al revisar
  let rpAbierto = /[?&]revisar=1/.test(location.search); const rpCambiar = {};
  function panelRevision(){
    if(!F.puedo.revisar || !rev || rev.error || F.cliente.es_natural) return '';
    const ptsL = rev.puntos || {}; const marcados = PUNTOS_REV.filter((q) => ptsL[q[0]]).length;
    if(!rpAbierto && !marcas().length){
      const faltan = PUNTOS_REV.filter((q) => !ptsL[q[0]]).map((q) => q[1].toLowerCase());
      const txt = faltan.length ? 'Falta ' + (faltan.length > 2 ? faltan[0] + ' y ' + (faltan.length - 1) + ' más' : faltan.join(' y ')) : 'Todo marcado';
      return '<div class="rp-linea' + (faltan.length ? '' : ' ok') + '"><span class="pt" aria-hidden="true"></span><b>Revisión: ' + marcados + ' de ' + PUNTOS_REV.length + ' marcados</b><small>' + esc(txt) + '</small><button type="button" class="btn btn-chico btn-2" data-rp-abrir="1">Abrir</button></div>';
    }
    const k = rev.ia && rev.ia.estado === 'lista' ? rev.ia : null;
    const noLeyo = !!(rev.ia && rev.ia.estado === 'error') || !!(k && (k.puntos || []).some((p) => p.id === 'actas' && p.estado === 'mano'));
    const pts = rev.puntos || {}; let pend = 0, ped = 0, man = 0;
    const filas = PUNTOS_REV.map(([pid, t, iaId]) => {
      const s = pts[pid] || null; const p = k && !noLeyo ? (k.puntos || []).find((x) => x.id === iaId || (iaId === 'junta' && x.id === 'junta')) : null;
      const prop = p ? (p.estado === 'ok' || p.excepcion ? 'bien' : p.estado === 'bloquea' ? 'pedir' : 'revisar') : null;
      if(!s) pend++; else if(s.decision === 'pedir') ped++; else if(s.decision === 'revisar') man++;
      const chip = s ? (s.decision === 'bien' ? ['verde', 'Bien'] : s.decision === 'pedir' ? ['rojo', 'Por pedir'] : ['ambar', 'Revisar a mano']) : prop ? ['azul', 'Propuesta, falta confirmar'] : ['gris', 'Sin marcar'];
      const cls = (d) => 'rp-op' + (s && s.decision === d ? ' on' : (!s && prop === d ? ' prop' : ''));
      const extra = s && s.decision === 'pedir' ? 'Se pedirá: ' + reqTexto(s.documento) + (s.nota ? '. ' + s.nota : '') : !s && prop === 'pedir' && p.falta ? 'Propuesta de la IA: pedir ' + p.falta : '';
      // Marcado: solo su chip (tocarlo deja cambiarlo); sin marcar: los tres botones en una fila
      const ops = s && !rpCambiar[pid] ? '<button type="button" class="chip ' + chip[0] + ' rp-chip" data-rp-cambiar="' + pid + '" aria-label="' + esc(t + ': ' + chip[1] + '. Cambiar') + '">' + chip[1] + '</button>' : '<div class="rp-ops" role="group" aria-label="' + esc(t) + '"><button type="button" class="' + cls('bien') + '" data-pt="' + pid + ':bien" aria-pressed="' + !!(s && s.decision === 'bien') + '">Bien</button><button type="button" class="' + cls('pedir') + '" data-pt="' + pid + ':pedir" aria-pressed="' + !!(s && s.decision === 'pedir') + '">Pedir</button><button type="button" class="' + cls('revisar') + '" data-pt="' + pid + ':revisar" aria-pressed="' + !!(s && s.decision === 'revisar') + '">Revisar</button></div>';
      return '<div class="rp-f" data-rp="' + pid + '"><div class="rp-tx"><b>' + esc(t) + '</b><small>' + esc(p ? p.detalle : 'Mira el documento y marca') + '</small>' + (!s && prop ? '<small class="rp-pr">Propuesta de la IA: ' + esc(prop === 'bien' ? 'Bien' : prop === 'pedir' ? 'Pedir' : 'Revisar') + ', falta confirmar</small>' : '') + (extra ? '<small class="rp-x">' + esc(extra) + '</small>' : '') + '</div>' + ops + '</div>';
    }).join('');
    const hay = Object.keys(pts).length;
    return '<section class="rp" aria-labelledby="rpT"><div class="rp-cab"><b id="rpT">Revisión del expediente</b>' + (!marcas().length ? '<button type="button" class="enlace rp-plegar" data-rp-plegar="1">Plegar</button>' : '') + '<small>' + esc(noLeyo ? 'La IA no pudo leer los documentos. Revisa tú y marca cada punto.' : k ? 'La IA leyó los documentos. Sus propuestas salen con borde punteado: confirma con un toque o cambia.' : 'Sin lectura de la IA. Revisas tú y marcas cada punto; funciona igual.') + '</small></div>' + filas +
      '<div class="rp-pie"><span>' + esc(pend ? (pend === 1 ? 'Falta 1 punto por confirmar' : 'Faltan ' + pend + ' puntos por confirmar') : plural(ped, 'por pedir', 'por pedir') + ' · ' + plural(man, 'a mano', 'a mano')) + '</span>' +
      '<button type="button" class="btn btn-chico" data-pt-cerrar' + (hay ? '' : ' disabled') + '>Cerrar revisión</button></div></section>';
  }
  async function marcarPunto(b){
    const [pid, dec] = b.dataset.pt.split(':'); const actual = ((rev && rev.puntos) || {})[pid];
    if(dec === 'pedir' && !(actual && actual.decision === 'pedir')){
      const iaP = rev.ia && rev.ia.estado === 'lista' ? (rev.ia.puntos || []).find((x) => x.id === (PUNTOS_REV.find((q) => q[0] === pid) || [])[2]) : null;
      abrirPedir({ punto: pid, tipo: (iaP && tipoDeFalta(iaP.falta)) || (PUNTOS_REV.find((q) => q[0] === pid) || [])[3] || 'junta', texto: pid === 'contacto' ? 'Correo del representante' : '' });
      return;
    }
    const nueva = actual && actual.decision === dec ? null : dec;   // tocar lo mismo otra vez lo desmarca
    b.disabled = true;
    try { await rpc('revision_punto', { p_cliente: id, p_punto: pid, p_decision: nueva }); delete rpCambiar[pid]; rev.puntos = Object.assign({}, rev.puntos); if(nueva) rev.puntos[pid] = { decision: nueva }; else delete rev.puntos[pid]; pintarDocumentos(); }
    catch (e) { toast(e.message, 'error'); b.disabled = false; }
  }
  async function cerrarPuntos(b){
    b.disabled = true;
    try {
      const r = await rpc('revision_puntos_aplicar', { p_cliente: id });
      toast(r.pedidos ? plural(r.pedidos, 'documento pedido', 'documentos pedidos') + '. ' + capital(liderCorto()) + ' ya tiene el mensaje para el cliente' : 'Revisión del expediente cerrada');
      await cargar();
      if(marcas().length && rev && rev.puede_cerrar) abrirCerrar();   // los documentos marcados se aprueban o devuelven en el mismo cierre
    } catch (e) { toast(e.message, 'error'); b.disabled = false; }
  }
  // C2: Pedir un documento que no está (requerimiento). Desde el panel queda como punto; desde un documento se crea al momento.
  let pedirO = null;
  function abrirPedir(o){ pedirO = Object.assign({ tipo: 'junta', texto: '', nota: '' }, o); pintarPedir(); abrirHoja('hojaCampo'); }
  function pintarPedir(){
    const o = pedirO;
    $('hojaCampo').innerHTML = cabHoja('tPedir', 'Pedir otro documento', F.cliente.nombre) +
      '<p class="nota" style="margin-top:0">Este documento está bien, pero falta otro. La casilla queda en rojo con este nombre hasta que lo suban y lo apruebes.</p>' +
      '<div class="motivos" role="radiogroup" aria-label="Qué documento falta">' + REQ_TIPOS.map(([k, t]) => '<button type="button" role="radio" aria-checked="' + (o.tipo === k) + '" class="mot' + (o.tipo === k ? ' on' : '') + '" data-req-tipo="' + k + '"><i></i>' + esc(t) + '</button>').join('') + '</div>' +
      (o.tipo === 'otro' ? '<label class="rotulo arriba" for="reqTexto">Cuál documento</label><input class="campo" id="reqTexto" maxlength="120" autocomplete="off" value="' + esc(o.texto) + '">' : '') +
      (o.origenT ? '<p class="nota">Origen: ' + esc(o.origenT) + ' (se guarda en la bitácora)</p>' : '') +
      '<label class="rotulo arriba" for="reqNota">Nota para ' + esc(liderCorto()) + ' (opcional)</label><textarea class="area corta" id="reqNota" maxlength="300">' + esc(o.nota) + '</textarea><div class="error" id="eReq" role="alert"></div>' +
      '<div class="acciones"><button type="button" class="btn btn-ancho" id="reqGuardar">' + (o.punto ? 'Marcar para pedir' : 'Pedir documento') + '</button></div>';
  }
  function leerPedir(){ if(!pedirO) return; const t = $('reqTexto'); const n = $('reqNota'); if(t) pedirO.texto = t.value; if(n) pedirO.nota = n.value; }
  async function guardarPedir(b){
    leerPedir(); const o = pedirO; $('eReq').textContent = '';
    if(o.tipo === 'otro' && String(o.texto).trim().length < 3){ $('eReq').textContent = 'Escribe qué documento falta'; if($('reqTexto')) $('reqTexto').focus(); return; }
    b.disabled = true;
    try {
      if(o.punto){ await rpc('revision_punto', { p_cliente: id, p_punto: o.punto, p_decision: 'pedir', p_documento: o.tipo === 'otro' ? String(o.texto).trim() : o.tipo, p_nota: String(o.nota).trim() || null });
        rev.puntos = Object.assign({}, rev.puntos, { [o.punto]: { decision: 'pedir', documento: o.tipo === 'otro' ? String(o.texto).trim() : o.tipo, nota: String(o.nota).trim() } }); cerrarHoja(); pintarDocumentos(); toast('Marcado para pedir al cerrar la revisión'); return; }
      await rpc('requerimiento_crear', { p_cliente: id, p_tipo: o.tipo, p_texto: o.tipo === 'otro' ? String(o.texto).trim() : null, p_motivo: String(o.nota).trim() || null, p_origen: o.origen || null });
      cerrarHoja(); toast('Pedido. ' + capital(liderCorto()) + ' lo ve en rojo con el mensaje para el cliente'); await cargar();
    } catch (e) { $('eReq').textContent = e.message; b.disabled = false; }
  }
  // C8: "Qué pedirle al cliente": el mensaje listo con lo pedido y lo devuelto, y cada línea con su botón para subir
  function quePedir(){
    const L = (F.faltantes || []).filter((x) => !x.dato && (x.req || x.e === 'devuelto')); if(!L.length) return '';
    const nombres = L.map((x) => (x.req ? x.t : capital(x.t) + (x.e === 'devuelto' ? ' (la que enviaron no sirve: ' + (C.MOTIVOS[x.m] || 'revisar').toLowerCase() + ')' : '')));
    const msj = 'Buenos días. Para completar su expediente necesitamos ' + (nombres.length === 1 ? 'el siguiente documento' : 'los siguientes documentos') + ': ' + C.lista(nombres) + '. ' + (L.some((x) => /acta/i.test(x.t)) ? 'Las actas deben estar inscritas en el Registro. ' : '') + 'Puede enviarlos por aquí. Gracias.';
    quePedirMsj = msj;
    return '<section class="qp" aria-labelledby="qpT"><div class="qp-cab"><b id="qpT">Qué pedirle al cliente</b><small>' + esc(F.puedo.revisar ? 'Esto le llega a ' + liderCorto() + ' con el mensaje listo.' : 'Mándale este mensaje y sube lo que te envíe en su casilla.') + '</small></div>' +
      '<p class="qp-msj">' + esc(msj) + '</p><div class="acc"><button type="button" class="btn btn-chico" data-qp="wa">' + ic('enviar') + 'Enviar por WhatsApp</button><button type="button" class="btn btn-chico btn-2" data-qp="copiar">Copiar mensaje</button></div>' +
      L.map((x) => '<div class="qp-l"><span class="ico" aria-hidden="true">!</span><span class="tx"><b>' + esc(x.req ? x.t : capital(x.t)) + '</b>' + (x.m && x.req ? '<small>' + esc(x.m) + '</small>' : x.e === 'devuelto' ? '<small>Devuelta: ' + esc((C.MOTIVOS[x.m] || '').toLowerCase()) + '</small>' : '') + '</span>' +
        '<button type="button" class="mini pri" data-subir="' + esc(x.k + ':' + x.n) + '">' + esc('Subir ' + (/^acta|^cédula|^c[eé]dula/i.test(x.t) ? 'esta' : 'este') + ' ' + (x.req ? (x.k === 'acta_asamblea' ? 'acta' : 'documento') : 'documento')) + '</button></div>').join('') + '</section>';
  }
  let quePedirMsj = '';
  async function accionQuePedir(b){
    if(b.dataset.qp === 'copiar'){ try { await navigator.clipboard.writeText(quePedirMsj); toast('Mensaje copiado. Pégalo en el chat del cliente'); } catch (e) { toast('No se pudo copiar. Mantén presionado el mensaje y cópialo', 'error'); } return; }
    const tel = String((F.cliente.tel || '')).replace(/\D/g, '').replace(/^0/, '58');
    window.open('https://wa.me/' + (tel.length >= 11 ? tel : '') + '?text=' + encodeURIComponent(quePedirMsj), '_blank', 'noopener');
  }
  async function marcarRep(b){
    const [n, m] = b.dataset.repMarca.split(':'); b.disabled = true;
    await accion('representante_marcar', { p_cliente: id, p_orden: Number(n), p_marca: m, p_motivo: m === 'ya_no_aplica' ? 'Marcado a mano' : null },
      m === 'firma' ? 'Listo: firma este representante' : m === 'cuenta' ? 'Vuelve a contar' : 'Listo: ya no cuenta. Sus documentos quedan en el historial', b);
  }
  // C6: documentos extra: cambiar título y convertir en acta (sin volver a subir)
  function abrirTitulo(d){
    $('hojaCampo').innerHTML = cabHoja('tTitulo', 'Cambiar título', F.cliente.nombre) + '<label class="rotulo" for="nuevoTitulo">Título del documento</label><input class="campo" id="nuevoTitulo" maxlength="80" autocomplete="off" value="' + esc(d.titulo || '') + '" data-foco>' +
      '<div class="error" id="eTitulo" role="alert"></div><div class="acciones"><button type="button" class="btn btn-ancho" data-titulo-guardar="' + d.id + '">Guardar título</button></div>';
    abrirHoja('hojaCampo');
  }
  function abrirAActa(d){
    $('hojaCampo').innerHTML = cabHoja('tAActa', 'Convertir en acta', d.titulo || F.cliente.nombre) + '<p class="nota" style="margin-top:0">Pasa a las actas de asamblea sin volver a subirlo y queda por revisar.</p>' +
      '<label class="rotulo" for="aActaFecha">Fecha de inscripción en el Registro</label><input class="campo" id="aActaFecha" type="date" max="' + esc(F.hoy) + '"><div class="error" id="eAActa" role="alert"></div>' +
      '<div class="acciones"><button type="button" class="btn btn-ancho" data-a-acta="' + d.id + '">Convertir en acta</button></div>';
    abrirHoja('hojaCampo');
  }
  async function guardarTitulo(b){ const t = $('nuevoTitulo').value.trim(); if(t.length < 3){ $('eTitulo').textContent = 'Escribe el título (al menos 3 letras)'; $('nuevoTitulo').focus(); return; }
    b.disabled = true; try { await rpc('documento_titulo', { p_documento: Number(b.dataset.tituloGuardar), p_titulo: t }); cerrarHoja(); toast('Título guardado'); await cargar(); } catch (e) { $('eTitulo').textContent = e.message; b.disabled = false; } }
  async function guardarAActa(b){ const f = $('aActaFecha').value; if(!f){ $('eAActa').textContent = 'Escribe la fecha de inscripción'; $('aActaFecha').focus(); return; } if(f > F.hoy){ $('eAActa').textContent = 'La fecha no puede ser futura'; return; }
    b.disabled = true; try { await rpc('documento_a_acta', { p_documento: Number(b.dataset.aActa), p_fecha: f }); cerrarHoja(); toast('Ahora es un acta de asamblea'); await cargar(); } catch (e) { $('eAActa').textContent = e.message; b.disabled = false; } }
  // C5: acta que cambia la junta o el representante
  function actaJuntaHtml(d){
    if(d.casilla !== 'acta_asamblea' || !F.puedo.revisar) return '';
    const a = ver.acta; if(a === undefined) return '<div class="aj"><span class="cargando-linea"><i></i>Leyendo si esta acta cambia la junta</span></div>';
    const dirs = ver.dirs || [];
    return '<div class="aj"><label class="aj-chk"><input type="checkbox" id="ajCambia"' + (ver.ajCambia ? ' checked' : '') + '><span><b>Esta acta cambia la junta o el representante</b><small>Márcala solo si nombra, ratifica o saca directores. Una venta de acciones sola no cambia la junta.</small></span></label>' +
      (ver.ajCambia ? '<div class="aj-dirs"><span class="rotulo">Junta que queda vigente</span>' + dirs.map((x, i) => '<div class="aj-d"><label class="solo-lector" for="ajN' + i + '">Nombre</label><input class="campo" id="ajN' + i + '" data-aj="' + i + ':nombre" maxlength="120" placeholder="Nombre y apellido" value="' + esc(x.nombre || '') + '">' +
          '<label class="solo-lector" for="ajC' + i + '">Cédula</label><input class="campo" id="ajC' + i + '" data-aj="' + i + ':cedula" maxlength="15" inputmode="numeric" placeholder="Cédula" value="' + esc(x.cedula || '') + '">' +
          '<label class="solo-lector" for="ajG' + i + '">Cargo</label><input class="campo" id="ajG' + i + '" data-aj="' + i + ':cargo" maxlength="60" placeholder="Cargo" value="' + esc(x.cargo || '') + '">' +
          '<label class="aj-f"><input type="checkbox" data-aj="' + i + ':firma"' + (x.firma ? ' checked' : '') + '> Firma</label></div>').join('') +
        '<button type="button" class="btn btn-chico btn-2" id="ajAgregar">' + ic('mas') + 'Agregar director</button>' +
        '<p class="nota">' + esc(F.cliente.regimen_firma === 'conjunta' ? 'Firma conjunta: se piden la cédula y el RIF de cada uno que firma.' : 'Con firma separada basta un director completo.') + ' Al guardar, los que salieron pasan a Ya no aplica y, si alguien nuevo firma, se piden su cédula y su RIF.</p></div>' : '') +
      '<div class="error" id="eAj" role="alert"></div><button type="button" class="btn btn-chico" id="ajGuardar">' + (a && a.cambia && !ver.ajCambia ? 'Desmarcar y revertir' : 'Guardar') + '</button>' +
      (a && a.cambia ? '<p class="nota">Marcada por ' + esc(primerNombre(a.por) || 'alguien') + ' el ' + esc(fecha(a.en, true)) + '.</p>' : '') + '</div>';
  }
  async function cargarActa(d){
    if(d.casilla !== 'acta_asamblea' || !F.puedo.revisar) return;
    let a = null; try { a = await rpc('acta_junta_de', { p_documento: d.id }); } catch (e) { a = null; }
    if(!ver || ver.docId !== d.id) return;
    ver.acta = a; ver.ajCambia = !!(a && a.cambia);
    ver.dirs = a && a.directores && a.directores.length ? a.directores.map((x) => Object.assign({}, x)) : (F.representantes || []).filter((r) => r.nombre && (!r.marca || r.marca === 'cuenta')).map((r) => ({ nombre: r.nombre, cedula: '', cargo: '', firma: !!r.firma }));
    if(!ver.dirs.length) ver.dirs = [{ nombre: '', cedula: '', cargo: '', firma: true }];
    if(hojaAbierta() === 'hojaVer') pintarVer();
  }
  function leerActa(){ Array.prototype.forEach.call(document.querySelectorAll('#hojaVer [data-aj]'), (x) => { const [i, k] = x.dataset.aj.split(':'); const o = ver.dirs[Number(i)]; if(o) o[k] = x.type === 'checkbox' ? x.checked : x.value; }); }
  async function guardarActa(b){
    leerActa(); const d = docVer(); const f = ($('fechaActa') || {}).value || d.firmado_en; const er = $('eAj'); er.textContent = '';
    const dirs = (ver.dirs || []).filter((x) => String(x.nombre || '').trim().length >= 3).map((x) => ({ nombre: String(x.nombre).trim(), cedula: String(x.cedula || '').replace(/\D/g, ''), cargo: String(x.cargo || '').trim(), firma: !!x.firma }));
    if(ver.ajCambia && !f){ er.textContent = 'Escribe la fecha del acta arriba'; return; }
    if(ver.ajCambia && !dirs.length){ er.textContent = 'Agrega al menos un director con su nombre'; return; }
    b.disabled = true;
    try {
      const r = await rpc('acta_junta_guardar', { p_documento: d.id, p_cambia: !!ver.ajCambia, p_fecha: f || null, p_directores: dirs });
      toast(!r.cambia ? 'Acta desmarcada: todo vuelve a como estaba' : [(r.ya_no_aplica || []).length ? plural(r.ya_no_aplica.length, 'representante pasa', 'representantes pasan') + ' a Ya no aplica' : '', r.pedidos ? plural(r.pedidos, 'documento pedido', 'documentos pedidos') : ''].filter(Boolean).join('. ') || 'Guardado');
      ver.acta = undefined; await cargar(); if(docVer()) cargarActa(docVer());
    } catch (e) { er.textContent = e.message; b.disabled = false; }
  }

  // ---------- Datos ----------
  function fila(etq, valor){ return '<div class="dato-f"><span>' + etq + '</span><b>' + valor + '</b></div>'; }
  function pintarDatos(){
    const c = F.cliente; const todos = F.servicios || []; const s0 = todos[0] || {};
    // Lote 3: en un dedicado solo se listan los servicios PYME del TAD; los enlaces dedicados van aparte
    const s = c.dedicado ? todos.filter((x) => String(x.categoria || '').toUpperCase() !== 'DEDICADO') : todos;
    const diasGestion = diasEntre(c.creado_en, new Date().toISOString());
    const r1 = (F.representantes || []).find((x) => x.orden === 1) || {};
    const tj = (titulo, fuerte, lineas, extra) => '<div class="tj"><span class="tj-t">' + titulo + '</span><b>' + fuerte + '</b>' + lineas.filter(Boolean).map((l) => '<small>' + l + '</small>').join('') + (extra || '') + '</div>';
    // Lote 28/10: franja con la gestión activa del cliente (si la hay)
    const ESTG = {}; ((window.Gestiones || {}).ESTADOS || [['contactado', 'Contactado'], ['sin_contacto', 'Sin contacto'], ['esperando', 'Esperando'], ['cumplido', 'Cumplido'], ['resuelto', 'Resuelto']]).forEach((x) => { ESTG[x[0]] = x[1]; });
    const TONOG = { contactado: 'azul', sin_contacto: 'rojo', esperando: 'ambar', cumplido: 'verde', resuelto: 'gris' };
    let h = suspHtml() + (F.gesActivas || []).map((g) => '<div class="fg-ges"><span class="chip azul">Gestión activa</span><b>' + esc(g.nombre) + '</b><span class="chip ' + (TONOG[g.estado] || 'gris') + '">' + esc(ESTG[g.estado] || g.estado) + '</span>' +
      (g.desde ? '<small>desde ' + esc(fecha(g.desde)) + '</small>' : '') + (window.Gestiones ? '<button type="button" class="enlace" data-ges-ficha="' + esc(g.gestion) + '">Cambiar estado · Marcar cumplida</button>' : '') + '</div>').join('') + '<div class="tarjs">' +
      tj(c.es_natural ? 'Titular' : 'Empresa', esc(c.nombre), [esc(rifDe(c)) + ' · ' + esc(c.seg), esc(c.direccion || s0.direccion || 'Sin dirección')]) +
      tj(c.es_natural ? 'Contacto' : 'Representante', esc(r1.nombre || (c.es_natural ? c.nombre : 'Sin nombre todavía')), [esc(r1.telefono || c.telefono || s0.telefono || 'Sin teléfono'), esc(r1.correo || c.correo_empresa || 'Sin correo')]) +
      tj('Líder', esc(c.lider || 'Sin asignar'), [c.estatus === 'contrato_firmado' ? 'Gestión cerrada' : 'En gestión hace ' + esc(plural(diasGestion, 'día', 'días'))], F.puedo.lider_cambiar ? '<button type="button" class="enlace" data-lider-cambiar="pyme" style="margin-top:8px">Cambiar líder</button>' : '') +
      tj('Estatus legal', chipEstatus(c.estatus), [], F.puedo.estatus ? '<button type="button" class="enlace" id="cambiarEstatus" style="margin-top:8px">Cambiar</button>' : '') + '</div>';
    const soloDed = !!c.dedicado && !s.length;   // dedicado sin servicios PYME: sus enlaces van abajo
    h += soloDed ? '<div>' : '<div class="serv-n"><b>' + s.length + '</b><span>' + (s.length === 1 ? 'Servicio' : 'Servicios') + ' en este ' + (c.es_natural ? 'documento' : 'RIF') + '</span></div><div class="srv-lista">';
    if(!s.length && !soloDed) h += '<div class="tj"><span class="tj-t">Sin instalar<span class="chip azul">Por instalar</span></span><b>Todavía sin servicio</b><small>' +
      (F.orden ? 'Orden de Odoo ' + esc(F.orden.numero) + ' del ' + esc(fecha(F.orden.creada_en)) + ' · ' + esc(F.orden.etapa || '') : 'Puedes adelantar los documentos mientras se instala.') + '</small></div>';
    // Lote 28/10: cada servicio en un rectángulo de ancho completo, con su IP y la carta y proforma
    s.forEach((x) => {
      const env = x.bienvenida_envio || x.proforma_envio;
      h += '<div class="srv-r"><span class="srv-c">' + esc(x.sucursal + '-' + x.codigo) + '</span><span class="srv-p">' + esc(x.plan || x.categoria || 'Servicio') + '</span>' +
        '<span class="srv-e">' + (x.con_deuda ? '<span class="chip rojo">Con deuda</span>' : estadoServicio(x.estado)) + '</span>' +
        '<small class="srv-m">' + [esc(sucursal(x.sucursal)), x.fecha_instalacion ? 'instalado el ' + esc(fecha(x.fecha_instalacion, true)) : 'sin fecha de instalación', x.equipo ? 'serial ' + esc(x.equipo) : ''].filter(Boolean).join(' · ') + '</small>' +
        '<div class="srv-ip"><span>' + (x.ip || x.ip6 ? [x.ip ? 'IPv4 ' + esc(x.ip) : '', x.ip6 ? 'IPv6 ' + esc(x.ip6) : ''].filter(Boolean).join(' · ') : 'IP pendiente por asignar') + '</span>' +
          (esNuevo() ? (F.puedo.enviar ? '<button type="button" class="chip ' + (env ? 'verde' : 'ambar') + ' chip-btn" data-enviar="' + esc(x.id) + '" title="' + esc(estadoEnvio(x)) + '">' + (env ? 'Carta y proforma enviadas' : 'Carta y proforma por enviar') + '</button>'
            : '<span class="chip ' + (env ? 'verde' : 'ambar') + '" title="' + esc(estadoEnvio(x)) + '">' + (env ? 'Carta y proforma enviadas' : 'Carta y proforma por enviar') + '</span>') : '') +
          (F.puedo.ip ? '<button type="button" class="enlace" data-ip="' + esc(x.id) + '">' + (x.ip || x.ip6 ? 'Cambiar IP' : 'Escribir IP') + '</button>' : '') + '</div>' +
        ipConfHtml(x) + '</div>';
    });
    h += '</div>';
    if(c.dedicado && window.FichaDedicado) h += window.FichaDedicado.datos(F, yo);
    if(!c.es_natural){
      const r = c.regimen_firma || ''; const dis = F.puedo.regimen ? '' : ' disabled';
      h += '<div class="secc">Régimen de firma' + (F.puedo.regimen ? '' : '<span class="der">Lo define Legal</span>') + '</div><div class="tres" role="radiogroup" aria-label="Régimen de firma">' +
        [['', 'Sin definir'], ['individual', 'Individual'], ['conjunta', 'Conjunta']].map((x) => '<button type="button" role="radio" aria-checked="' + (r === x[0]) + '" data-regimen="' + x[0] + '" class="' + (r === x[0] ? 'on' : '') + '"' + dis + '>' + x[1] + '</button>').join('') + '</div>' +
        (r === 'conjunta' ? '<p class="nota-chica">Con firma conjunta se piden la cédula y el RIF de dos representantes.</p>' : '') +
        (/Dedicado/.test(c.seg) || c.es_isp ? '<div class="interr"><span class="tx">Proveedor de internet (ISP)<small>Se le pide el permiso de Conatel</small></span><button type="button" class="sw" role="switch" aria-checked="' + !!c.es_isp + '" data-interr="es_isp" aria-label="Proveedor de internet"' + dis + '></button></div>' : '') +
        '<p class="nota-chica">La firma Digital o Física (contrato presencial) se marca en Contrato.</p>';
    }
    // Lote 21/10: etiquetas de gestión (no cambian el estatus)
    const gs = F.gestion || [];
    h += '<div class="secc">Gestión<button type="button" class="enlace der" data-etiquetar-ficha="1">Poner etiqueta</button></div>' +
      (gs.length ? '<div class="datos">' + gs.slice(0, 4).map((g) => fila(esc(fecha(g.fecha)), esc((GES[g.e] || g.e) + (g.por ? ' · ' + primerNombre(g.por) : '')) + (g.nota ? '<small class="ded-gris" style="display:block;font-weight:500">' + esc(g.nota) + '</small>' : ''))).join('') + '</div>'
        : '<p class="nota-chica">Sin etiquetas todavía. Marca Contactado, Sin contacto o Esperando documentos para que el equipo sepa en qué va.</p>');
    h += '<div class="secc">Cartera</div><div class="interr"><span class="tx">Cliente TOP<small>Protegido: los aliados no pueden instalarlo</small></span>' +
      '<button type="button" class="sw" role="switch" aria-checked="' + !!c.es_top + '" data-interr="es_top" aria-label="Cliente TOP"' + (F.puedo.top ? '' : ' disabled') + '></button></div>';
    if(F.puedo.exc_pagada || c.exc_pagada) h += '<div class="interr"><span class="tx">Excepción pagada, documentos por subir<small>Se le pagó la comisión por excepción. Sale en Archivos por subir hasta completar</small></span>' +
      '<button type="button" class="sw" role="switch" aria-checked="' + !!c.exc_pagada + '" data-marca-cli="exc_pagada" aria-label="Excepción pagada, documentos por subir"' + (F.puedo.exc_pagada ? '' : ' disabled') + '></button></div>';
    if(F.puedo.suspender) h += '<div class="interr"><span class="tx">' + (c.suspendido_en ? 'Suspendido' : 'Suspender cliente') + '<small>' + esc(c.suspendido_en ? 'Desde el ' + fecha(c.suspendido_en) + (c.suspendido_por ? ' por ' + primerNombre(c.suspendido_por) : '') : 'Sale de la lista y de los contadores. Se le pueden seguir pidiendo documentos') + '</small></span>' +
      '<button type="button" class="btn btn-chico ' + (c.suspendido_en ? '' : 'btn-2') + '" data-suspender="' + (c.suspendido_en ? '0' : '1') + '">' + (c.suspendido_en ? 'Reactivar' : 'Marcar como suspendido') + '</button></div>';
    $('tab-datos').innerHTML = h;
  }

  // Lote 3: proforma y carta solo para clientes nuevos (con instalación en un corte de Comisiones); dedicados no
  function esNuevo(){ return !F.cliente.dedicado && (F.comision || []).some((i) => i.comisiona); }

  // ---------- Proforma y carta de bienvenida ----------
  function estadoEnvio(x){
    const una = (e, que) => (e ? que + ' enviada el ' + fecha(e.en) + (e.por ? ', ' + primerNombre(e.por) : '') : '');
    return [una(x.bienvenida_envio, 'Carta'), una(x.proforma_envio, 'Proforma')].filter(Boolean).join(' · ') || 'Proforma y carta sin enviar';
  }
  let env = null;   // { servicio, tipo }
  let envF = null; let envFin = null;   // envío desde otra hoja (Comisiones), sin abrir el expediente
  const EF = () => envF || F;
  const saludoHora = () => { const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; };
  function telefonosDe(sv){
    const F = EF();
    const D = window.Documentos; const vistos = {}; const r = [];
    const pon = (t, de) => { const n = D.waNumero(t); if(n.length < 11 || vistos[n]) return; vistos[n] = 1; r.push({ n: String(t), t: D.telFmt(t) + ' · ' + de }); };
    (F.representantes || []).forEach((x) => pon(x.telefono, F.cliente.es_natural ? 'titular' : 'representante ' + x.orden));
    pon(F.cliente.telefono, 'Proham'); pon(sv.telefono, 'TAD');
    (F.servicios || []).forEach((x) => { if(x !== sv) pon(x.telefono, 'TAD, otro servicio'); });
    return r;
  }
  function abrirEnviar(servicioId){
    const F = EF();
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
    // Lote 28/10: carta y proforma salen juntas en un solo envío
    h += '<p class="nota-chica env-juntas">' + (k.puede ? 'Se envían juntas: la carta de bienvenida y la proforma.' : 'Por ahora solo la proforma: la carta sale cuando la instalación tenga dueño.') + '</p>' +
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
    const F = EF();
    const sv = (F.servicios || []).find((x) => x.id === env.servicio); const D = window.Documentos; const x = D.datosDe(F, sv, telefono); const r = [];
    if(tipo !== 'bienvenida') r.push(new File([D.proforma(x)], D.nombreArchivo('proforma', x.nombre), { type: 'application/pdf' }));
    if(tipo !== 'proforma') r.push(new File([D.carta(x)], D.nombreArchivo('bienvenida', x.nombre), { type: 'application/pdf' }));
    return r;
  }
  const tiposDe = (tipo) => (tipo === 'ambas' ? ['proforma', 'bienvenida'] : [tipo]);
  async function anotarEnvio(tipo, canal, destino){
    const mio = id;
    try {
      if(tipo === 'ambas') await rpc('carta_enviar', { p_servicio: env.servicio, p_canal: canal, p_destino: destino || null });
      else await rpc('envio_registrar', { p_servicio: env.servicio, p_tipos: tiposDe(tipo), p_canal: canal, p_destino: destino || null });
      toast(canal === 'manual' ? 'Marcado como enviado' : 'Quedó anotado en el hilo');
    }
    catch (e) { toast(e.message, 'error'); return; }
    const fin = envFin;
    if(hojaAbierta() === 'hojaEnviar') cerrarHoja();
    if(fin) fin(); else if(mio === id) cargar();
  }
  function numeroEnvio(){
    const s = $('envNum'); const v = s && s.value ? s.value : $('envOtro').value.trim();
    if(window.Documentos.waNumero(v).length < 11){ $('eEnv').textContent = 'Escribe un número de WhatsApp completo, con el código del operador'; if(!s.value) $('envOtro').focus(); return null; }
    return v;
  }
  const copiar = (t) => { try { if(navigator.clipboard) navigator.clipboard.writeText(t).catch(() => {}); } catch (e) {} };
  async function enviarWhatsapp(){
    const F = EF();
    $('eEnv').textContent = ''; const num = numeroEnvio(); if(!num) return;
    const D = window.Documentos; const tipo = env.tipo; let files;
    try { files = archivosEnvio(tipo, num); } catch (e) { toast('No se pudo armar el PDF. Intenta de nuevo', 'error'); return; }
    const msj = mensajeWa(F, tipo);
    try { copiar(D.telFmt(num)); } catch (e) {}   // si no deja copiar, igual se comparte
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
    const F = EF();
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
        : i.estado === 'perdida' ? 'No cumplió en ' + mes(i.corte) + ' ni en el corte siguiente' : i.estado === 'ultimo_corte' ? 'Era de ' + mes(i.corte) + '. Límite el ' + fecha(F.corte.limite || F.corte.fin)
        : 'Corte de ' + mes(i.corte) + ', límite el ' + fecha(F.corte.limite || F.corte.fin).split(' de ')[0];
      // Lote 28/10: una tarjeta por servicio con Legal, Pago y Orden en chips
      const nf = (F.faltantes || []).length;
      const chips = i.comisiona ? '<div class="fc-ck">' +
        '<span class="chip ' + (legalOk ? 'verde">Legal: cumple' : nf ? 'ambar">Legal: ' + (nf === 1 ? 'falta 1' : 'faltan ' + nf) : 'ambar">Legal: ' + esc(((C.ESTATUS || {})[c.estatus] || {}).t || 'en curso')) + '</span>' +
        '<span class="chip ' + (i.pago_ok_en ? 'verde">Pago: pagada' + (i.pago_manual ? ' a mano' : '') : 'rojo">Pago: debe instalación') + '</span>' +
        (i.orden ? '<span class="chip ' + (i.orden_ok === false ? 'ambar' : 'verde') + '">Orden ' + esc(i.orden) + '</span>' : '<span class="chip ambar">Sin orden</span>') + '</div>'
        : '<div class="fc-ck"><span class="chip ' + e[0] + '">' + e[1] + '</span></div>';
      h += '<div class="secc">' + esc(i.sucursal + '-' + i.codigo) + '<span class="der">Instalado el ' + esc(fecha(i.instalada_en)) + '</span></div><div class="fc-card" data-instalacion="' + i.id + '">' + chips +
        '<b>' + esc(capital(corteTxt)) + '</b>' + (i.comisiona && i.estado !== 'cumple' ? '<small>Si no cumple, pasa al corte siguiente' + (i.dueno ? '. Dueño: ' + esc(i.dueno) : '') + '.</small>' : i.dueno ? '<small>Dueño: ' + esc(i.dueno) + '.</small>' : '') +
        '<div class="fc-acc">' + (F.puedo.pago && i.comisiona ? '<button type="button" class="enlace" data-pago="' + i.id + '" data-pagada="' + (i.pago_ok_en ? '0' : '1') + '">' + (i.pago_ok_en ? 'Quitar pago' : 'Marcar pagada') + '</button>' : '') +
          (i.comisiona && yo && yo.rol !== 'gerencia' && !/comisiones\.html$/.test(location.pathname) ? '<a class="enlace" href="comisiones.html?q=' + encodeURIComponent(i.codigo) + '">Abrir en Comisiones</a>' : '') + '</div></div>';
    });
    $('tab-comision').innerHTML = h;
  }

  // ---------- Pestañas ----------
  // Lote 21/10: Contrato (una tarjeta por contrato), VGT solo si tiene y Comisión solo con instalación en un corte
  function pintarDedicado(){
    const c = F.cliente; const D = c.dedicado; const tb = $('tabs');
    const hayCtr = !c.es_natural || !!D || (F.documentos || []).some((d) => d.casilla.indexOf('contrato_') === 0);
    const hayVgt = !!D && (!!D.vgt || (D.contratos || []).some((k) => k.tipo === 'vgt'));
    const hayCom = (F.comision || []).length > 0;
    // Lote 28/10: en un dedicado, contratos y VGT van juntos en una pestaña (pantalla 9 de la maqueta)
    const junto = !!D && hayVgt; const nPend = (c.contrato_pend ? 1 : 0) + (junto ? ((D.vgt && D.vgt.faltan) || 0) : 0);
    tb.querySelector('[data-tab="contrato"]').classList.toggle('hidden', !hayCtr && !junto);
    tb.querySelector('[data-tab="vgt"]').classList.toggle('hidden', !hayVgt || junto);
    tb.querySelector('[data-tab="comision"]').classList.toggle('hidden', !hayCom);
    const bc = tb.querySelector('[data-tab="contrato"]'); bc.innerHTML = (junto ? 'Contratos y VGT' : 'Contrato') + (nPend ? '<em>' + (junto ? nPend : '!') + '</em>' : '');
    $('tab-contrato').innerHTML = (hayCtr && window.FichaDedicado ? window.FichaDedicado.contratos(F, yo) : '') +
      (junto && window.FichaDedicado ? '<div class="secc ctr-vgt-t">VGT</div>' + window.FichaDedicado.vgt(F, yo) + grupoVgt(true) : '') + (D && !D.vgt && yo && yo.rol !== 'aliado' ? vgtSinSol() : '');
    $('tab-vgt').innerHTML = hayVgt && !junto && window.FichaDedicado ? window.FichaDedicado.vgt(F, yo) + grupoVgt(true) : '';
    if(tab === 'vgt' && junto){ irTab('contrato', true); return; }
    if((tab === 'contrato' && !hayCtr && !junto) || (tab === 'vgt' && !hayVgt) || (tab === 'comision' && !hayCom)) irTab('datos', true);
  }
  function tabVisible(t){ const b = $('tabs').querySelector('[data-tab="' + t + '"]'); return !!b && !b.classList.contains('hidden'); }
  function irTab(t, sinUrl){
    if(t === 'contratos') t = 'contrato';   // enlaces viejos
    if(t === 'vgt' && F && F.cliente.dedicado && !tabVisible('vgt')) t = 'contrato';   // Lote 28/10: el VGT va dentro de Contratos y VGT
    if(TABS.indexOf(t) < 0 || (F && !tabVisible(t))) t = 'datos';
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
    if(clave === 'rif'){
      campo = { tipo: 'rif' };
      h.innerHTML = cabHoja('tCampo', 'RIF del cliente', F.cliente.nombre) + '<form id="formCampo" novalidate><label class="rotulo" for="cRif">RIF de la empresa o cédula</label>' +
        '<input class="campo" id="cRif" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="16" data-foco><p class="nota">Con su letra: J, V, E o G. Si ya existe un cliente con ese RIF, este se une a él con sus documentos.</p><div class="error" id="eCampo" role="alert"></div>' +
        '<div class="acciones"><button type="submit" class="btn btn-ancho" id="guardarCampo">Guardar</button></div></form>';
      abrirHoja('hojaCampo'); return;
    }
    if(clave === 'vgt_correo'){
      const V = (F.cliente.dedicado || {}).vgt || {};
      campo = { tipo: 'vgt' };
      h.innerHTML = cabHoja('tCampo', 'Correo para notificaciones', 'Contrato VGT · ' + F.cliente.nombre) + '<form id="formCampo" novalidate><label class="rotulo" for="cCorreo">Correo para notificaciones</label>' +
        '<input class="campo" id="cCorreo" type="email" inputmode="email" autocapitalize="none" autocomplete="off" maxlength="120" value="' + esc(V.correo || '') + '" data-foco><div class="error" id="eCampo" role="alert"></div>' +
        '<div class="acciones"><button type="submit" class="btn btn-ancho" id="guardarCampo">Guardar</button></div></form>';
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
      if(campo.tipo === 'rif'){
        const v = $('cRif').value.trim(); if(!/^[VEJGPCvejgpc]?[\s.-]*\d[\d.\s-]{4,12}$/.test(v)){ $('eCampo').textContent = 'Escribe el RIF con su letra. Ejemplo: J-401234567'; b.disabled = false; b.textContent = 'Guardar'; return; }
        const nuevo = await rpc('provisional_rif', { p_cliente: cli, p_rif: v });
        toast(Number(nuevo) !== Number(cli) ? 'Ya existía: se unió a ese cliente con sus documentos' : 'Listo: ya es un cliente normal'); if(hojaAbierta() === 'hojaCampo') cerrarHoja();
        if(Number(nuevo) !== Number(cli)){ id = Number(nuevo); } await cargar(); return;
      }
      if(campo.tipo === 'ip') await rpc('servicio_ip', { p_servicio: campo.servicio, p_ip: $('cIp').value.trim(), p_ip6: $('cIp6').value.trim() });
      else if(campo.tipo === 'vgt') await rpc('dedicado_vgt_correo', { p_cliente: cli, p_correo: co });
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
      '<div id="pregEstatus"></div><div class="acciones"><button type="button" class="btn btn-ancho" id="guardarEstatus" disabled>Guardar</button></div>';
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
  // ---------- Cola de subidas (lote 21/10) ----------
  // Se puede soltar o elegir otro archivo sin esperar al anterior: cada subida entra a la cola y se sube por detrás, en orden.
  // La casilla dice "En cola" o "Subiendo" con su avance; se puede seguir trabajando y hasta cambiar de cliente.
  const claveSub = (cli, c) => cli + '|' + c.casilla + ':' + (c.numero === 'auto' ? 'auto' : Number(c.numero || 0));
  const colaDe = (cli) => cola.filter((t) => t.cli === cli).length;
  function textoCola(){
    if(!cola.length) return '';
    const t = cola[0]; const resto = cola.length - 1;
    return (t.texto || 'Subiendo a Drive…').replace(/…$/, '') + (resto ? '. ' + plural(resto, 'subida más', 'subidas más') + ' en cola' : '') + '. Puedes seguir trabajando';
  }
  function avance(t, texto){
    t.texto = texto;
    t.items.forEach((it) => it.casillas.forEach((c) => { subiendo[claveSub(t.cli, c)] = texto; }));
    t.items.forEach((it) => it.casillas.forEach((c) => Array.prototype.forEach.call(document.querySelectorAll('.tx-subida[data-sube="' + claveSub(t.cli, c) + '"]'), (x) => { x.textContent = texto; })));
    pintarCola();
  }
  function pintarCola(){
    const z = $('estadoSubida'); if(z){ z.classList.toggle('hidden', !cola.length); const tx = $('textoSubida'); if(tx) tx.textContent = textoCola(); }
    Array.prototype.forEach.call(document.querySelectorAll('.estado-sub'), (x) => { x.classList.toggle('hidden', !colaDe(id)); const tx = x.querySelector('.texto-sub'); if(tx) tx.textContent = textoCola(); });
    const q = $('subidaCom'); if(q){ q.classList.toggle('hidden', !cola.length); if(cola.length) q.lastChild.textContent = textoCola(); }
  }
  function repintarSubida(t){
    if(t.f) document.dispatchEvent(new CustomEvent('ficha-subida'));   // la hoja de comisión pinta su casilla
    else if(t.cli === id && F){ pintarDocumentos(); if($('tab-vgt') && $('tab-vgt').innerHTML) pintarDedicado(); }   // 22/10: la pestaña VGT también dice "Subiendo"
    pintarCola();
  }
  // Cada archivo va a Drive por la función drive_subir: carpeta "RIF - NOMBRE" del cliente (se crea sola) y subcarpeta por tipo de servicio
  async function subirADrive(cli, pr, original, casillas){
    let tk = '';
    try { const s = await db.auth.getSession(); tk = (s.data && s.data.session && s.data.session.access_token) || ''; } catch (e) {}
    if(!tk) throw new Error('Tu sesión venció. Entra de nuevo');
    const fd = new FormData();
    const seguro = nombreSeguro(pr.nombre, pr.mime); const base = String(original || pr.nombre || 'archivo').replace(/\.[a-z0-9]{2,5}$/i, '').trim().slice(0, 140) || 'archivo';
    fd.append('cliente', String(cli)); fd.append('nombre', base + seguro.slice(seguro.lastIndexOf('.')));   // el nombre original queda en la base con la extensión de lo que de verdad se sube
    if(casillas) fd.append('casillas', casillas);   // en Drive se llama "RIF - Casilla - fecha" (lote 3)
    fd.append('archivo', pr.blob.type === pr.mime ? pr.blob : pr.blob.slice(0, pr.blob.size, pr.mime), seguro);   // un PDF sin tipo se reconoce por el nombre
    let r;
    try { r = await fetch(db.supabaseUrl + '/functions/v1/drive_subir', { method: 'POST', headers: { Authorization: 'Bearer ' + tk, apikey: db.supabaseKey }, body: fd }); }
    catch (e) { throw new Error('Sin conexión. "' + original + '" no se subió. Revisa el internet e intenta de nuevo'); }
    let d = {}; try { d = await r.json(); } catch (e) {}
    if(!r.ok || !d.drive_id) throw new Error(String(d.error || 'No se pudo subir "' + original + '". Intenta de nuevo').replace(/\.$/, ''));
    return d;
  }
  // items: [{ files:[File], casillas:[{casilla,numero}], vence_en, firmado_en, titulo, nota }]. Devuelve una promesa que se cumple al guardar (true) o al fallar (false).
  function guardarItems(items){
    const f = fuera; fuera = null; const cli = f ? f.cliente : id;   // el cliente de esta subida, aunque después se abra otro
    return new Promise((listo) => {
      const t = { cli, items, f, listo, texto: cola.length ? 'En cola…' : 'Subiendo a Drive…' };
      cola.push(t); ocupado = true;
      items.forEach((it) => it.casillas.forEach((c) => { subiendo[claveSub(cli, c)] = t.texto; }));
      repintarSubida(t);
      if(!trabajando) trabajar();
    });
  }
  const yaSubidos = {};
  async function subirTrabajo(t){
    const total = t.items.reduce((a, it) => a + it.files.length, 0); let hecho = 0;
    const envio = [];
    for(const it of t.items){
      // Los archivos de una misma subida van a Drive a la vez (hasta 3)
      const archivos = new Array(it.files.length); let sig = 0;
      const nombreCas = it.casillas.map((c) => casilla(c.casilla, c.numero === 'auto' ? 1 : Number(c.numero || 0))).join(' + ');
      const uno = async () => { while(sig < it.files.length){ const n = sig++; const file = it.files[n];
        // Lote 05/11 C7: el mismo archivo ya subido para este cliente (en esta sesión) se enlaza, no se sube otra vez
        const kf = t.cli + '|' + file.name + '|' + file.size + '|' + (file.lastModified || 0);
        if(yaSubidos[kf]){ archivos[n] = { drive_id: yaSubidos[kf] }; hecho++; continue; }
        const pr = await preparar(file); const r = await subirADrive(t.cli, pr, file.name, nombreCas); archivos[n] = { drive_id: r.drive_id }; yaSubidos[kf] = r.drive_id;
        hecho++; avance(t, total > 1 ? 'Subiendo a Drive ' + hecho + ' de ' + total + '…' : 'Subiendo a Drive…'); } };
      avance(t, total > 1 ? 'Subiendo a Drive ' + (hecho + 1) + ' de ' + total + '…' : 'Subiendo a Drive…');
      await Promise.all(Array.from({ length: Math.min(3, it.files.length) }, uno));
      envio.push({ archivos, casillas: it.casillas, vence_en: it.vence_en || null, firmado_en: it.firmado_en || null, titulo: it.titulo || null, nota: it.nota || null });
    }
    avance(t, 'Guardando…');
    return rpc('documentos_registrar', { p_cliente: t.cli, p_items: envio });
  }
  async function trabajar(){
    trabajando = true;
    while(cola.length){
      const t = cola[0]; let ok = false;
      try { const n = await subirTrabajo(t); toast(plural(n, 'documento guardado', 'documentos guardados')); ok = true; }
      catch (e) { toast(e.message, 'error'); }
      cola.shift(); ocupado = cola.length > 0;
      t.items.forEach((it) => it.casillas.forEach((c) => { delete subiendo[claveSub(t.cli, c)]; }));
      try {
        if(t.f){ if(t.f.alTerminar) t.f.alTerminar(); }
        else if(t.cli === id && F){ if(ok && !cola.some((x) => x.cli === t.cli)) await cargar(); else pintarDocumentos(); }
        pintarCola();
        // El RIF recién subido: con el ajuste "Llenar datos del expediente con OCR" se proponen razón social y domicilio
        const rifIt = ok && t.items.find((it) => it.files.length === 1 && it.casillas.length === 1 && (it.casillas[0].casilla === 'rif_empresa' || (it.casillas[0].casilla === 'rif_personal' && (t.f ? t.f.F : F) && (t.f ? t.f.F : F).cliente.es_natural)));
        if(rifIt && !t.f && t.cli === id) proponerDelRif(t.cli, rifIt.files[0]);
      } catch (e) {}
      t.listo(ok);
    }
    trabajando = false; pintarCola();
  }
  // ---------- OCR del RIF (corrida 14/10 tarde): propone razón social y domicilio; la persona confirma ----------
  let OCRA = null;
  async function ocrAjustes(){ if(OCRA) return OCRA; try { OCRA = (await rpc('ocr_ajustes', {})) || {}; } catch (e) { return {}; } return OCRA; }
  async function proponerDelRif(cli, file){
    if(!yo || ['admin', 'analista', 'abogado'].indexOf(yo.rol) < 0) return;
    if(!(await ocrAjustes()).expediente || !/^(application\/pdf|image\/(jpeg|png))$/i.test(file.type)) return;
    let o = null;
    try {
      const s = await window.db.auth.getSession(); const tk = (s.data && s.data.session && s.data.session.access_token) || ''; if(!tk) return;
      const fd = new FormData(); fd.append('archivo', file, file.name);
      const r = await fetch(window.db.supabaseUrl + '/functions/v1/ocr_leer', { method: 'POST', headers: { Authorization: 'Bearer ' + tk, apikey: window.db.supabaseKey }, body: fd });
      o = await r.json().catch(() => null);
    } catch (e) { return; }   // el OCR es de ayuda: si falla, no estorba
    if(!o || o.estado !== 'ok' || o.dudosa || !/^rif_/.test(o.tipo || '') || !o.datos || cli !== id || !F) return;
    const d = o.datos; const c = F.cliente;
    // El número del RIF leído contra el del cliente (sin ceros a la izquierda)
    const nr = String(d.rif || '').slice(1).replace(/^0+/, ''); const nc = String(c.doc_numero || '').replace(/^0+/, '');
    // La base puede guardar el número sin el dígito verificador (cédulas y RIF viejos)
    if(nr && nc && nr !== nc && nr.slice(0, -1) !== nc){ toast('El RIF del archivo es ' + d.rif.charAt(0) + '-' + d.rif.slice(1) + ' y no el de este cliente. Revisa la casilla', 'error'); return; }
    const cambia = [];
    if(d.razon_social && normalizeStr(d.razon_social) !== normalizeStr(c.nombre)) cambia.push(['nombre', 'Razón social', d.razon_social, c.nombre]);
    if(d.domicilio && normalizeStr(d.domicilio) !== normalizeStr(c.direccion || '')) cambia.push(['direccion', 'Domicilio fiscal', d.domicilio, c.direccion || 'Sin dirección']);
    if(!cambia.length) return;
    let h = $('hojaOcr');
    if(!h){ h = document.createElement('section'); h.id = 'hojaOcr'; h.className = 'hoja'; h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', 'tOcr'); h.setAttribute('aria-hidden', 'true'); document.body.appendChild(h); C.prepararHojas(); }
    h.innerHTML = cabHoja('tOcr', 'Datos leídos del RIF', 'Revisa y marca lo que quieras usar') + '<form id="formOcr" novalidate>' +
      cambia.map((x) => '<label class="cam-srv"><input type="checkbox" data-ocr-campo="' + x[0] + '" checked><span><b>' + esc(x[1]) + '</b><small>Del RIF: ' + esc(x[2]) + '</small><small>Hoy: ' + esc(x[3]) + '</small></span></label>').join('') +
      '<div class="error" id="eOcr" role="alert"></div><div class="acciones" style="display:flex;gap:10px"><button type="button" class="btn btn-2" data-cierra="1">Dejar como está</button><button type="submit" class="btn" style="flex:1" id="usarOcr">Usar estos datos</button></div></form>';
    h._cambia = cambia; h._cli = cli;
    abrirHoja('hojaOcr');
  }
  async function usarOcr(ev){
    ev.preventDefault(); const h = $('hojaOcr'); const b = $('usarOcr'); $('eOcr').textContent = '';
    const marc = (h._cambia || []).filter((x) => { const k = h.querySelector('[data-ocr-campo="' + x[0] + '"]'); return k && k.checked; });
    if(!marc.length){ cerrarHoja(); return; }
    b.disabled = true; b.textContent = 'Guardando…';
    try { for(const x of marc) await rpc('cliente_dato', { p_cliente: h._cli, p_campo: x[0], p_valor: x[2] }); toast('Datos del RIF guardados'); cerrarHoja(); if(h._cli === id) cargar(); }
    catch (e) { $('eOcr').textContent = e.message; b.disabled = false; b.textContent = 'Usar estos datos'; }
  }
  document.addEventListener('submit', (e) => { if(e.target && e.target.id === 'formOcr') usarOcr(e); });

  function elegirPara(cas, num){
    destino = { casilla: cas, numero: num };
    const inp = $('archivo'); inp.value = ''; inp.click();
  }
  async function alElegir(){
    const files = Array.prototype.slice.call($('archivo').files || []); if(!files.length || !destino) return;
    const d = destino; destino = null;
    // Lote 05/11 F3: la casilla de una propuesta o planilla de solicitud se pide al servidor después de elegir el archivo
    if(d.vgt){ try { d.numero = await rpc('vgt_casilla', { p_contrato: d.vgt.sol, p_tipo: d.vgt.tipo, p_otra: !!d.vgt.otra }); } catch (e) { toast(e.message, 'error'); return; } guardarItems([{ files, casillas: [{ casilla: 'otro', numero: d.numero }] }]); return; }
    if(d.casilla.indexOf('contrato_') === 0){ abrirFechas(d, files); return; }
    if(esPoliza(d)){ abrirVence(d, files); return; }
    if(d.casilla === 'otro' && d.numero < 60){ abrirOtro(d, files); return; }
    guardarItems([{ files, casillas: [d] }]);
  }
  // Lote 21/10: "Otro documento" pide nombre (obligatorio) y nota
  function abrirOtro(d, files){
    campo = { tipo: 'otro', destino: d, files, f: fuera }; fuera = null;
    $('hojaCampo').innerHTML = cabHoja('tCampo', 'Otro documento', files.length === 1 ? files[0].name : files.length + ' archivos') + '<form id="formOtro" novalidate>' +
      '<label class="rotulo" for="oNombre">Nombre del documento</label><input class="campo" id="oNombre" maxlength="80" autocomplete="off" data-foco><div class="error" id="eOtro" role="alert"></div>' +
      '<label class="rotulo arriba" for="oNota">Nota (opcional)</label><input class="campo" id="oNota" maxlength="300" autocomplete="off">' +
      '<div class="acciones"><button type="submit" class="btn btn-ancho">Subir documento</button></div></form>';
    abrirHoja('hojaCampo');
  }
  function guardarOtro(e){
    e.preventDefault(); const n = $('oNombre').value.trim();
    if(n.length < 3){ $('eOtro').textContent = 'Escribe qué documento es'; $('oNombre').focus(); return; }
    const c = campo; cerrarHoja(); fuera = c.f || null;
    guardarItems([{ files: c.files, casillas: [c.destino], titulo: n, nota: $('oNota').value.trim() || null }]);
  }
  // 22/10: las pólizas de VGT piden su fecha de vencimiento al subirse (así avisa 30 días antes aunque se apruebe sola)
  const esPoliza = (d) => d.casilla === 'otro' && [66, 67].indexOf(Number(d.numero)) >= 0;
  function abrirVence(d, files){
    campo = { tipo: 'poliza', destino: { casilla: 'otro', numero: Number(d.numero) }, files, f: fuera }; fuera = null;
    $('hojaCampo').innerHTML = cabHoja('tCampo', casilla('otro', Number(d.numero)), files.length === 1 ? files[0].name : files.length + ' archivos') + '<form id="formVence" novalidate>' +
      '<label class="rotulo" for="pVence">Fecha de vencimiento de la póliza</label><input class="campo" id="pVence" type="date" data-foco><div class="error" id="ePVence" role="alert"></div>' +
      '<p class="nota">30 días antes te avisamos a ti y al administrador para pedir la renovación.</p>' +
      '<div class="acciones"><button type="submit" class="btn btn-ancho">Subir póliza</button></div></form>';
    abrirHoja('hojaCampo');
  }
  function guardarVence(e){
    e.preventDefault(); const v = $('pVence').value; $('ePVence').textContent = '';
    if(!v){ $('ePVence').textContent = 'Pon la fecha en que vence la póliza'; $('pVence').focus(); return; }
    const c = campo; cerrarHoja(); fuera = c.f || null;
    guardarItems([{ files: c.files, casillas: [c.destino], vence_en: v }]);
  }
  // El contrato pide la fecha de firma antes de guardarse
  function abrirFechas(d, files){
    campo = { tipo: 'contrato', destino: d, files };
    $('hojaCampo').innerHTML = cabHoja('tCampo', casilla(d.casilla, 0), files.length === 1 ? files[0].name : files.length + ' archivos') + '<form id="formFechas" novalidate>' +
      '<label class="rotulo" for="cFirma">Fecha de firma</label><input class="campo" id="cFirma" type="date" max="' + esc(((fuera && fuera.F) || F).hoy) + '" data-foco><div class="error" id="eCampo" role="alert"></div>' +
      '<label class="rotulo" for="cVence">Fecha de vencimiento</label><input class="campo" id="cVence" type="date"><div class="error" id="eVenceC" role="alert"></div>' +
      '<p class="nota">Al guardarlo con fecha de firma, el cliente pasa a Contrato firmado.</p>' +
      '<div class="acciones"><button type="submit" class="btn btn-ancho">Subir contrato</button></div></form>';
    abrirHoja('hojaCampo');
  }
  function guardarFechas(e){
    e.preventDefault(); const f = $('cFirma').value; const v = $('cVence').value;
    $('eCampo').textContent = ''; $('eVenceC').textContent = '';
    if(!f){ $('eCampo').textContent = 'Pon la fecha en que se firmó'; return; }
    if(!v){ $('eVenceC').textContent = 'Pon la fecha de vencimiento del contrato'; $('cVence').focus(); return; }
    if(v <= f){ $('eVenceC').textContent = 'El vencimiento debe ser después de la firma'; return; }
    const c = campo; cerrarHoja();
    guardarItems([{ files: c.files, casillas: [c.destino], firmado_en: f, vence_en: v || null }]);
  }

  // ---------- Subir varios ----------
  function opcionesLote(){
    const G = varF || F; const c = G.cliente; const o = [];
    const nReq = !c.es_natural && c.regimen_firma === 'conjunta' ? 2 : 1;
    const nReps = Math.max(nReq, (G.representantes || []).reduce((a, r) => Math.max(a, r.orden), 1));
    if(!c.es_natural){ o.push({ k: 'rif_empresa:0', t: 'RIF de la empresa' }, { k: 'acta_constitutiva:0', t: 'Acta constitutiva' }, { k: 'acta_asamblea:auto', t: 'Acta de asamblea', libre: true }); if(c.es_isp) o.push({ k: 'conatel:0', t: 'Conatel: habilitación vigente' }); }
    for(let n = 1; n <= nReps; n++){ const suf = c.es_natural ? '' : ' rep. ' + n; o.push({ k: 'cedula:' + n, t: 'Cédula' + suf }, { k: 'rif_personal:' + n, t: (c.es_natural ? 'RIF personal' : 'RIF') + suf }); }
    // Lote 22/10: documentos de un cambio de titular (planilla e identidad del titular actual), cuando la hoja viene desde Migraciones
    (G.extraCasillas || []).forEach((x) => o.push(x));
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
      return '<div class="arch ' + (marcadas.length ? 'ok' : 'no') + '" data-item="' + n + '"><span class="mini">' + mini + '</span><div>' +
        '<div class="nom"><span>' + esc(it.files.length > 1 ? it.files.length + ' fotos: ' + it.files.map((f) => f.name).join(', ') : it.files[0].name) + '</span>' +
          '<button type="button" class="quitar" data-quitar="' + n + '" aria-label="Quitar este archivo">' + ic('x') + '</button></div>' +
        '<div class="checks" role="group" aria-label="Qué trae">' + ops.map((o) => { const p = o.k.split(':'); const ap = !o.libre && !it.marcas[o.k] && (docDe(p[0], Number(p[1])) || {}).estado === 'aprobado';   // Lote 28/10: lo aprobado sale apagado
          return '<button type="button" class="ck' + (it.marcas[o.k] ? ' on' : '') + '" aria-pressed="' + !!it.marcas[o.k] + '" data-marca="' + o.k + '"' + (ap ? ' disabled' : '') + '>' + ic('check') + esc(o.t + (ap ? ' · aprobado' : '')) + '</button>'; }).join('') + '</div>' +
        (it.marcas['otro:0'] ? '<label class="rotulo arriba" for="lt' + n + '">Nombre del documento</label><input class="campo" id="lt' + n + '" data-titulo="' + n + '" maxlength="80" autocomplete="off" value="' + esc(it.titulo || '') + '">' : '') +
        (it.files.length > 1 ? '<button type="button" class="enlace" data-separar="' + n + '">Son documentos distintos: separar las fotos</button>' : '') +
        (!marcadas.length ? '<div class="nota2" style="color:var(--rojo)">Marca qué trae para poder guardarlo.</div>'
          : marcadas.length > 1 ? '<div class="nota2" style="color:var(--text2)">Trae ' + marcadas.length + ' documentos: queda en las ' + marcadas.length + ' casillas sin cortarlo.</div>' : '') +
        (marcadas.some((k) => { const p = k.split(':'); return p[1] !== 'auto' && p[0] !== 'otro' && docDe(p[0], Number(p[1])); }) ? '<div class="nota2" style="color:var(--ambar)">Reemplaza el que ya está en esa casilla.</div>' : '') +
        '</div></div>';
    }).join('');
    $('hojaVarios').innerHTML = '<div class="hoja-cab"><div class="tx"><b id="tVarios">Subir varios</b><small>' + esc((varF || F).cliente.nombre) + '</small></div><button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      '<div class="hoja-cuerpo"><div class="sv-pasos" aria-label="Pasos"><span class="' + (lote.length ? 'hecho' : 'on') + '"><i>' + (lote.length ? ic('check') : '1') + '</i>Elegir archivos</span>' +
        '<span class="' + (lote.length && sinMarcar ? 'on' : lote.length ? 'hecho' : '') + '"><i>' + (lote.length && !sinMarcar ? ic('check') : '2') + '</i>Marcar qué trae cada uno</span><span class="' + (lote.length && !sinMarcar ? 'on' : '') + '"><i>3</i>Guardar</span></div>' +
        (lote.length ? '<p class="nota-chica">Toca lo que trae cada archivo. Si trae dos cosas (por ejemplo cédula y RIF en la misma hoja), marca las dos. Lo ya aprobado sale apagado.</p>' : '') +
        '<button type="button" class="soltar" id="soltar" data-foco>' + ic('subir', 'g') + '<b>' + (lote.length ? 'Agregar más archivos' : 'Elige todos los archivos juntos') + '</b>Después marca qué trae cada uno.</button>' +
        (lote.length ? '<div class="secc">' + plural(lote.length, 'archivo', 'archivos') + '. Marca qué trae cada uno</div>' + filas : '<p class="nota-chica" style="text-align:center;margin-top:14px">Fotos o PDF. Un escaneo con varios documentos se puede marcar en varias casillas.</p>') + '</div>' +
      '<div class="hoja-pie col"><button type="button" class="btn" id="guardarLote"' + (!lote.length || sinMarcar ? ' disabled' : '') + '>Guardar en sus casillas</button>' +
        '<p id="progLote">' + (!lote.length ? 'Todavía no has elegido archivos.' : (sinMarcar ? '<b>Falta marcar ' + plural(sinMarcar, 'archivo', 'archivos') + '.</b> ' : '<b>Todo marcado.</b> ') + 'Al guardar, cada uno va a su casilla, queda en el hilo y pasa a revisión.') + '</p></div>';
  }
  async function guardarLote(){
    const libres = ACTAS.filter((n) => !docDe('acta_asamblea', n)); const items = [];
    for(const it of lote){
      const cas = [];
      for(const k of Object.keys(it.marcas)){
        const p = k.split(':');
        if(p[1] === 'auto'){ const n = libres.shift(); if(!n){ toast('Ya están las ' + ACTAS.length + ' actas de asamblea. Para cambiar una, reemplázala desde su casilla', 'error'); return; } cas.push({ casilla: p[0], numero: n }); }
        else cas.push({ casilla: p[0], numero: Number(p[1]) });
      }
      if(it.marcas['otro:0'] && String(it.titulo || '').trim().length < 3){ toast('Escribe el nombre de cada archivo marcado como Otro', 'error'); const x = document.querySelector('#hojaVarios [data-titulo="' + lote.indexOf(it) + '"]'); if(x) x.focus(); return; }
      items.push({ files: it.files, casillas: cas, titulo: it.marcas['otro:0'] ? String(it.titulo).trim().slice(0, 80) : null });
    }
    // Lote 21/10: se manda a la cola y la hoja se cierra; la subida sigue por detrás
    const ext = varF; if(ext) fuera = { cliente: ext.cliente.id, F: ext, alTerminar: varFin };
    guardarItems(items); soltarMinis(); lote = [];
    if(hojaAbierta() === 'hojaVarios'){ cerrarHoja(); if(!ext) irTab('documentos'); }
    toast('Subiendo ' + plural(items.length, 'archivo', 'archivos') + ' por detrás. Puedes seguir trabajando');
  }

  // ---------- Ver y revisar un documento ----------
  function abrirRevision(){ rpAbierto = true; const cola = sinMarcar().map((d) => d.id); if(!cola.length) return; irTab('documentos'); soltarBlobs(); ver = { docId: cola[0], cola, paso: 'ver', motivo: null, archivo: 0, url: {} }; pintarVer(); abrirHoja('hojaVer'); cargarArchivo(); }
  function abrirVer(docId){ soltarBlobs(); ver = { docId, cola: null, paso: 'ver', motivo: null, archivo: 0, url: {} }; pintarVer(); abrirHoja('hojaVer'); cargarArchivo(); const d = docVer(); if(d) cargarActa(d); }
  // Motivos de devolución: "Sin los datos del Registro" se guarda como otro motivo con esa nota (la base solo tiene los 5 de siempre)
  const MOTIVOS_DEV = Object.assign({}, C.MOTIVOS, { no_corresponde: 'No es de esta empresa', sin_registro: 'Sin los datos del Registro' });
  function docVer(){ return (F.documentos || []).find((d) => d.id === ver.docId); }
  function pintarVer(){
    const d = docVer(); const h = $('hojaVer');
    if(!d){ cerrarHoja(); return; }
    const titulo = d.titulo || casilla(d.casilla, d.numero);
    const pos = ver.cola ? ver.cola.indexOf(d.id) + 1 : 0;
    const cab = '<div class="hoja-cab"><div class="tx"><b id="tVer">' + esc(titulo) + '</b><small>' + esc(F.cliente.nombre) + (ver.cola ? ' · Documento ' + pos + ' de ' + ver.cola.length : '') + '</small></div><button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>';
    if(ver.paso === 'devolver'){
      h.classList.add('angosta');
      // Lote 05/11 C2/C3: Devolver (el subido está malo) y Pedir (falta otro) son dos acciones distintas.
      // La constitutiva solo se devuelve si no es de la empresa, está ilegible o no trae los datos del Registro.
      const consti = d.casilla === 'acta_constitutiva';
      const mots = Object.keys(MOTIVOS_DEV).filter((k) => !consti || ['ilegible', 'no_corresponde', 'sin_registro'].includes(k));
      h.innerHTML = cab + '<div class="hoja-cuerpo"><div class="dp-modos" role="group" aria-label="Qué hacer"><button type="button" class="dp-modo on" aria-pressed="true"><b>Devolver este documento</b><small>El que subieron está malo</small></button>' +
        '<button type="button" class="dp-modo" id="verPedir"><b>Pedir otro documento</b><small>Este está bien, pero falta algo</small></button></div>' +
        '<h2 style="font-size:20px;font-weight:800;margin:14px 0">¿Por qué lo devuelves?</h2>' + (consti ? '<p class="nota" style="margin-top:0">La constitutiva solo se devuelve si no es de la empresa, está ilegible o no trae los datos del Registro. Para pedir un acta usa Pedir otro documento.</p>' : '') + '<div class="motivos" role="radiogroup" aria-label="Motivo">' +
        mots.map((k) => '<button type="button" role="radio" aria-checked="' + (ver.motivo === k) + '" class="mot' + (ver.motivo === k ? ' on' : '') + '" data-motivo="' + k + '"><i></i>' + esc(MOTIVOS_DEV[k]) + '</button>').join('') + '</div>' +
        '<label class="rotulo arriba" for="notaDev">Nota para ' + esc(liderCorto()) + (ver.motivo === 'otro' ? '' : ' (opcional)') + '</label><textarea class="area corta" id="notaDev" maxlength="500">' + esc(ver.nota || '') + '</textarea><div class="error" id="eDev" role="alert"></div><p class="nota">' + esc(capital(liderCorto())) + ' se entera cuando se cierre la revisión.</p></div>' +
        '<div class="hoja-pie"><button type="button" class="btn btn-2" id="devVolver">Volver</button><button type="button" class="btn btn-peligro" id="devConfirmar"' + (ver.motivo ? '' : ' disabled') + '>Marcar para devolver</button></div>';
      return;
    }
    h.classList.remove('angosta');
    const arch = d.archivos || []; const a = arch[ver.archivo] || arch[0];
    const paginas = arch.length > 1 ? '<div class="paginas">' + arch.map((x, n) => '<button type="button" data-archivo="' + n + '" class="' + (n === ver.archivo ? 'on' : '') + '">Archivo ' + (n + 1) + '</button>').join('') + '</div>' : '';
    const estado = d.estado === 'aprobado' ? '<span class="chip verde">Aprobado</span>' : d.estado === 'devuelto' ? '<span class="chip rojo">Devuelto</span>' : '<span class="chip ambar">Por revisar</span>';
    const mk = F.puedo.revisar ? marcaDe(d.id) : null;
    const info = '<div class="datos" style="margin-top:0">' + fila('Estado', estado + (d.revisado_por ? ' ' + esc(primerNombre(d.revisado_por)) + ', ' + esc(dia(d.revisado_en).toLowerCase()) : '')) +
      (mk ? fila('En esta revisión', (mk.accion === 'devolver' ? '<span class="chip rojo">Devolver</span> ' + esc((C.MOTIVOS[mk.motivo] || '') + (mk.nota ? '. ' + mk.nota : '')) : '<span class="chip azul">Aprobar</span>' + (mk.nota ? ' ' + esc(mk.nota) : '')) +
        (mk.origen === 'ia' ? ' <small>' + esc('Propuesta de la IA' + (mk.pagina ? ', página ' + mk.pagina : '')) + '</small>' : '') +
        ' <button type="button" class="enlace" id="verQuitarMarca">Quitar marca</button>') : '') +
      (!mk && iaDe(d.id) && iaDe(d.id).propuesta === 'revisar_a_mano' ? fila('La IA', esc('No pudo decidir: ' + (iaDe(d.id).nota || ''))) : '') +
      fila('Subido', esc(dia(d.subido_en)) + (d.subido_por ? ' por ' + esc(d.subido_por) : '')) +
      (d.estado === 'devuelto' ? fila('Motivo', esc(C.MOTIVOS[d.motivo] || '') + (d.nota ? '. ' + esc(d.nota) : '')) : '') +
      (d.casilla === 'acta_asamblea' ? '' : d.firmado_en ? fila('Firmado', esc(fecha(d.firmado_en, true))) : '') +
      (!F.puedo.revisar && d.vence_en ? fila('Vence', esc(fecha(d.vence_en, true))) : '') +
      ((d.comparte || []).length ? fila('También trae', esc(C.lista(d.comparte.map((x) => casilla(x.casilla, x.numero))))) : '') +
      (a ? fila('Archivo', esc(a.nombre || '')) : '') + '</div>' +
      (F.puedo.revisar && !(d.casilla.indexOf('contrato_') === 0 && !F.puedo.contrato) ? '<button type="button" class="btn btn-chico btn-2" id="verReemplazar" style="margin-top:12px">' + ic('subir') + 'Reemplazar archivo</button>' : '') +
      (mk && mk.origen === 'ia' && mk.accion === 'devolver' && rev && rev.puede_cerrar ? '<label class="rotulo arriba" for="excDoc">Si lo apruebas igual, escribe el motivo</label><textarea class="area corta" id="excDoc" maxlength="300"></textarea>' +
        '<p class="nota">Aprobar lo que la IA devolvió es una excepción: queda en la bitácora con tu nombre.</p>' : '') +
      (d.casilla === 'otro' && d.numero < 60 && !F.cliente.es_natural ? '<div class="acc" style="margin-top:12px"><button type="button" class="btn btn-chico btn-2" data-doc-titulo="' + d.id + '">Cambiar título</button>' + (F.puedo.revisar ? '<button type="button" class="btn btn-chico btn-2" data-doc-acta="' + d.id + '">Convertir en acta</button>' : '') + '</div>' : '') +
      (d.casilla === 'acta_asamblea' ? '<label class="rotulo arriba" for="fechaActa">Fecha del acta</label><div style="display:flex;gap:10px;align-items:center"><input class="campo" id="fechaActa" style="flex:1;min-width:0" type="date" max="' + esc(F.hoy) + '" value="' + esc(d.firmado_en || '') + '"><button type="button" class="btn btn-chico btn-2" id="guardarFechaActa">Guardar fecha</button></div>' +
        '<p class="nota">Las actas se ordenan por esta fecha en el expediente.</p><div class="error" id="errFechaActa" role="alert"></div>' + actaJuntaHtml(d) : '') +
      (F.puedo.revisar ? '<label class="rotulo arriba" for="venceDoc">Fecha de vencimiento (opcional)</label><input class="campo" id="venceDoc" type="date" value="' + esc(d.vence_en || '') + '">' +
        '<p class="nota">Sirve para avisar antes de que se venza.</p>' : '');
    const puedeSubir = !(d.casilla.indexOf('contrato_') === 0 && !F.puedo.contrato);
    const pie = F.puedo.revisar
      ? '<div class="hoja-pie"><button type="button" class="btn btn-peligro" id="verDevolver">Devolver</button><button type="button" class="btn" id="verAprobar">' + (d.estado === 'aprobado' && !mk ? 'Guardar' : ver.cola && pos < ver.cola.length ? 'Aprobar y seguir' : 'Aprobar') + '</button></div>'
      : '<div class="hoja-pie">' + (puedeSubir ? '<button type="button" class="btn btn-2" id="verReemplazar">Reemplazar</button>' : '') + '<button type="button" class="btn" data-cierra="1">Cerrar</button></div>';
    h.innerHTML = cab + '<div class="hoja-cuerpo"><div class="revisar-cols"><section><div class="visor" id="visor"><span class="cargando-linea"><i></i>Abriendo el archivo</span></div>' + paginas +
      '<div class="visor-pie"><span>' + (arch.length > 1 ? 'Archivo ' + (ver.archivo + 1) + ' de ' + arch.length : '') + '</span><a class="enlace hidden" id="abrirCompleto" target="_blank" rel="noopener">Abrir completo</a>' +
        (a && /^https:\/\/drive\.google\.com\//.test(a.url_externa || '') ? '<a class="enlace" id="abrirDrive" href="' + esc(a.url_externa) + '" target="_blank" rel="noopener">Abrir en Drive</a>' : '') + '</div></section>' +
      '<section style="margin-top:14px">' + info + '</section></div></div>' + pie;
    if(ver.url[ver.archivo] !== undefined) mostrarArchivo();
  }
  // Lote 22/10: el reporte "Clientes Empresariales" trae otra IP (otro equipo, o distinta a la puesta a mano)
  function ipConfHtml(x){
    if(!x.ip_conf) return '';
    const rep = [x.ip_prop ? 'IPv4 ' + x.ip_prop : '', x.ip6_prop ? 'IPv6 ' + x.ip6_prop : ''].filter(Boolean).join(' · ') || 'sin IP';
    const por = x.ip_conf === 'equipo' ? 'El reporte trae esta IP con otro equipo' + (x.ip_prop_equipo ? ' (' + x.ip_prop_equipo + ')' : '') : 'La IP escrita a mano no es la del reporte';
    return '<div class="al-banda ambar ip-conf" role="note"><b>IP por confirmar</b><p>' + esc(por + ': ' + rep + '.') + '</p>' +
      (F.puedo.ip ? '<p style="margin-top:8px;display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="btn btn-chico" data-ip-usar="' + esc(x.id) + '">Usar la del reporte</button><button type="button" class="btn btn-chico btn-2" data-ip-dejar="' + esc(x.id) + '">Dejar la actual</button></p>' : '') + '</div>';
  }
  async function ipConfirmar(b, usar){
    b.disabled = true;
    try { await rpc('servicio_ip_confirmar', { p_servicio: Number(usar ? b.dataset.ipUsar : b.dataset.ipDejar), p_usar_reporte: usar }); toast(usar ? 'IP del reporte guardada' : 'Se deja la IP actual'); cargar(); }
    catch (e) { toast(e.message, 'error'); b.disabled = false; }
  }
  // Lote 22/10: fecha de un acta de asamblea (las ordena en el expediente)
  async function guardarFechaActa(b){
    const d = docVer(); const v = $('fechaActa').value || null; const er = $('errFechaActa'); if(!d) return;
    er.textContent = '';
    if(v && v > F.hoy){ er.textContent = 'La fecha no puede ser futura'; $('fechaActa').focus(); return; }
    b.disabled = true;
    try { await rpc('documento_fecha_acta', { p_documento: d.id, p_fecha: v }); d.firmado_en = v; toast('Fecha del acta guardada'); pintarDocumentos(); pintarVer(); }
    catch (e) { er.textContent = e.message; b.disabled = false; }
  }
  function papel(texto){ return '<div><div class="papel"><i></i><i style="width:70%"></i><i></i><i></i><i style="width:55%"></i><i></i><i style="width:80%"></i></div>' + esc(texto) + '</div>'; }
  function mostrarArchivo(){
    const d = docVer(); const z = $('visor'); if(!d || !z) return;
    const a = (d.archivos || [])[ver.archivo]; const url = ver.url[ver.archivo]; const ab = $('abrirCompleto');
    // Lote 21/10: mientras llega el archivo completo se ve la miniatura (primera página)
    if(url === undefined && (ver.mini || {})[ver.archivo]){ z.innerHTML = '<div class="visor-mini"><img src="' + esc(ver.mini[ver.archivo]) + '" alt="' + esc(d.titulo || casilla(d.casilla, d.numero)) + '"><span class="cargando-linea"><i></i>Cargando el archivo completo</span></div>'; return; }
    if(!a || !url){ z.innerHTML = papel(a && !a.url_externa ? 'Archivo de ejemplo. No tiene imagen guardada.' : ((ver.fallo || {})[ver.archivo] ? ver.fallo[ver.archivo] + '.' : 'No se pudo abrir el archivo. Cierra y vuelve a intentar.')); return; }
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
  async function bajarDeDrive(a, vista){
    let tk = '';
    try { const s = await db.auth.getSession(); tk = (s.data && s.data.session && s.data.session.access_token) || ''; } catch (e) {}
    if(!tk) throw new Error('Tu sesión venció. Entra de nuevo');
    let r;
    try { r = await fetch(db.supabaseUrl + '/functions/v1/drive_archivo', { method: 'POST', headers: { Authorization: 'Bearer ' + tk, apikey: db.supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify(vista ? { archivo: a.id, vista } : { archivo: a.id }) }); }
    catch (e) { throw new Error('Sin conexión. Revisa el internet'); }
    if(!r.ok){ let m = ''; try { m = String((await r.json()).error || ''); } catch (e) {} throw new Error(m.replace(/\.$/, '') || 'No se pudo abrir el archivo'); }
    let b;
    try { b = await r.blob(); } catch (e) { throw new Error('Se cortó la conexión mientras bajaba el archivo'); }
    const u = URL.createObjectURL(b); blobs.push(u); return u;
  }
  // Todos los archivos viven en Drive: se piden a la función drive_archivo
  async function cargarArchivo(){
    const d = docVer(); if(!d) return;
    const n = ver.archivo; const a = (d.archivos || [])[n]; const mio = ver;
    if(!a){ ver.url[n] = ''; mostrarArchivo(); return; }
    if(ver.url[n] !== undefined){ mostrarArchivo(); return; }
    let url = '';
    if((a.url_externa || a.drive_id) && a.id){
      // La miniatura pesa poco y llega antes; el archivo completo se pide a la vez y la reemplaza al llegar
      ver.mini = ver.mini || {};
      bajarDeDrive(a, 'mini').then((u) => { if(mio === ver && ver.docId === d.id && ver.url[n] === undefined){ ver.mini[n] = u; if(ver.archivo === n) mostrarArchivo(); } }).catch(() => {});
      try { url = await bajarDeDrive(a); }
      catch (e) { if(mio === ver){ ver.fallo = ver.fallo || {}; ver.fallo[n] = e.message; } }
    }
    if(mio !== ver || ver.docId !== d.id) return;
    ver.url[n] = url; mostrarArchivo();
  }
  async function revisar(accionRev){
    const d = docVer(); if(!d) return;
    const args = { p_documento: d.id, p_accion: accionRev, p_motivo: null, p_nota: null, p_vence: null };
    if(accionRev === 'aprobar'){
      const v = $('venceDoc'); args.p_vence = v && v.value ? v.value : null;
      const x = $('excDoc');
      if(x){ const m = x.value.trim(); if(m.length < 5){ toast('Escribe el motivo para aprobar lo que la IA devolvió', 'error'); x.focus(); return; } args.p_nota = m; }
    }
    else {
      ver.nota = $('notaDev').value.trim();
      if(!ver.motivo){ $('eDev').textContent = 'Elige un motivo'; return; }
      if(ver.motivo === 'otro' && !ver.nota){ $('eDev').textContent = 'Escribe el motivo en la nota'; $('notaDev').focus(); return; }
      args.p_motivo = ver.motivo === 'sin_registro' ? 'otro' : ver.motivo; args.p_nota = ver.motivo === 'sin_registro' ? 'Sin los datos del Registro' + (ver.nota ? '. ' + ver.nota : '') : ver.nota || null;
    }
    // Lote 21/10: la marca se ve al instante y se guarda por detrás; nunca espera la vista previa ni el recálculo.
    // Si el servidor la rechaza, se quita y se avisa.
    const previa = marcaDe(d.id); const cliM = id;
    const nueva = { documento: d.id, accion: accionRev, motivo: args.p_motivo, nota: args.p_nota, vence_en: args.p_vence, origen: 'manual', por: yo && yo.nombre };
    if(!rev) rev = { marcas: [], historial: [] };
    rev.marcas = marcas().filter((m) => m.documento !== d.id).concat([nueva]);
    guardandoMarcas++;
    const p = rpc('documento_marcar', args).then(() => true, (e) => {
      if(rev) rev.marcas = marcas().filter((m) => m !== nueva).concat(previa ? [previa] : []);
      toast('No se guardó la marca de ' + (d.titulo || casilla(d.casilla, d.numero)) + ': ' + e.message, 'error');
      if(F && !encima()) pintarTodo(); else if(hojaAbierta() === 'hojaVer' && ver) pintarVer();
      return false;
    });
    marcasPend = marcasPend.then(() => p);
    p.then(() => { guardandoMarcas--; if(!guardandoMarcas && id === cliM) recargarRevision().then(() => { if(F && !encima()) pintarTodo(); }).catch(() => {}); });
    toast(accionRev === 'aprobar' ? 'Marcado para aprobar' : 'Marcado para devolver');
    if(!ver || hojaAbierta() !== 'hojaVer'){ pintarTodo(); return; }   // cerraron el visor
    const cola = ver.cola; const actual = d.id;
    // Sigue con el próximo que quede sin marcar; si no hay, cierra
    const sig = cola ? cola.slice(cola.indexOf(actual) + 1).find((x) => { const y = (F.documentos || []).find((z) => z.id === x); return y && y.estado === 'por_revisar' && !marcaDe(x); }) : null;
    if(sig){ soltarBlobs(); ver = { docId: sig, cola, paso: 'ver', motivo: null, archivo: 0, url: {} }; pintarTodo(); cargarArchivo(); }
    else { ver = null; cerrarHoja(); pintarTodo(); if(cola) toast(rev && rev.puede_cerrar ? 'Listo. Toca Cerrar revisión para avisarle a ' + liderCorto() : 'Listo. El administrador cierra la revisión'); }
  }
  let guardandoMarcas = 0; let marcasPend = Promise.resolve();
  async function recargarRevision(){
    const [f, r] = await Promise.all([rpc('cliente_ficha', { p_cliente: id }), rpc('revision_estado', { p_cliente: id })]);
    F = f; rev = r;
  }
  async function quitarMarca(b){
    const d = docVer(); if(!d) return; b.disabled = true;
    try { await rpc('documento_marcar', { p_documento: d.id, p_accion: 'quitar', p_motivo: null, p_nota: null, p_vence: null }); await recargarRevision(); }
    catch (e) { toast(e.message, 'error'); if(document.contains(b)) b.disabled = false; return; }
    toast('Marca quitada'); pintarTodo();
  }

  // ---------- Cerrar revisión: todo junto, una sola vez ----------
  function estatusDespues(){ const k = claveDespues(); return k ? (C.ESTATUS[k] || {}).t || '' : ''; }
  function claveDespues(){
    const c = F.cliente; if(['grandes_negocios', 'documentos_pendientes', 'documentos_solicitados', 'documentos_en_revision', 'documentos_recibidos'].indexOf(c.estatus) < 0) return '';
    const docDeFalta = (x) => (F.documentos || []).find((d) => d.casilla === x.k && d.numero === x.n) || {};
    const dv = marcas().some((m) => m.accion === 'devolver') || (F.faltantes || []).some((x) => { if(x.e !== 'devuelto') return false; const m = marcaDe(docDeFalta(x).id); return !m || m.accion !== 'aprobar'; });
    const falta = (F.faltantes || []).some((x) => x.e === 'falta');
    return dv ? 'documentos_pendientes' : falta ? ((F.documentos || []).length ? 'documentos_pendientes' : c.estatus) : sinMarcar().some((d) => esRequerido(d.casilla, d.numero)) ? 'documentos_en_revision' : 'documentos_recibidos';
  }
  // Lote 3: si un cambio baja a pendiente a un cliente que comisiona en un corte abierto, se pregunta antes de quitarle la comisión
  const CON_LEGAL = ['documentos_en_revision', 'documentos_recibidos', 'contrato_en_curso', 'por_firmar', 'contrato_firmado'];
  function preguntaComision(estatus){
    const c = F.cliente;
    if(!estatus || !c.abierta || !c.legal_ok_en || c.legal_como === 'excepcion' || CON_LEGAL.indexOf(estatus) >= 0 || !(F.puedo || {}).legal) return '';
    return '<div class="estado ambar preg-com" id="pregCom"><b>Este cliente comisiona en el corte de ' + esc(C.mes(c.abierta)) + '. ¿Quitarle la comisión?</b>' +
      '<small>Un corte certificado no cambia.</small><div class="tres dos" role="radiogroup" aria-label="¿Quitarle la comisión?">' +
      '<button type="button" role="radio" aria-checked="false" data-quitar-com="si">Sí, quitarla</button><button type="button" role="radio" aria-checked="false" data-quitar-com="no">No, que siga</button></div>' +
      '<div class="error" id="ePregCom" role="alert"></div></div>';
  }
  // Devuelve null si falta responder, true si hay que quitar Legal y false si no
  function respuestaComision(){
    const z = $('pregCom'); if(!z) return false;
    const b = z.querySelector('[aria-checked="true"]');
    if(!b){ $('ePregCom').textContent = 'Elige si se le quita la comisión'; return null; }
    return b.dataset.quitarCom === 'si';
  }
  async function quitarLegalTras(quitar, motivo){
    if(!quitar) return;
    try { await rpc('legal_quitar', { p_cliente: id, p_motivo: motivo }); toast('Se le quitó la comisión del corte abierto'); }
    catch (e) { toast('El estatus cambió, pero no se pudo quitar la comisión: ' + e.message, 'error'); }
  }
  function mensajeRevision(){
    const c = F.cliente; const lis = [];
    marcas().filter((m) => m.accion === 'devolver').forEach((m) => { const d = (F.documentos || []).find((x) => x.id === m.documento);
      lis.push('• ' + (d ? casilla(d.casilla, d.numero) : 'Documento') + ': ' + (C.MOTIVOS[m.motivo] || 'devuelto').toLowerCase() + (m.nota ? '. ' + m.nota : '')); });
    (F.faltantes || []).filter((x) => x.e === 'falta').forEach((x) => lis.push('• Falta ' + x.t));
    // Lo que la IA pide aparte, sin devolver un documento (junta vencida: acta de asamblea)
    const k = rev && rev.ia && rev.ia.estado === 'lista' ? rev.ia : null;
    if(k) (k.puntos || []).filter((p) => p.pedir && p.estado === 'bloquea' && p.falta).forEach((p) => lis.push('• Falta ' + p.falta.charAt(0).toLowerCase() + p.falta.slice(1)));
    if(!lis.length) return '';
    const quien = primerNombre(c.lider);
    return saludoHora() + (quien ? ', ' + quien : '') + '. Del cliente ' + c.nombre + (c.provisional ? '' : ' (' + docFmt(c.doc_tipo, c.doc_numero) + ')') + ' hace falta:\n' + lis.join('\n') + '\nCuando lo tengas, súbelo a la app. Gracias.';
  }
  function abrirCerrar(){
    if(!rev || !rev.puede_cerrar || !marcas().length) return;
    const ap = marcas().filter((m) => m.accion === 'aprobar'); const dv = marcas().filter((m) => m.accion === 'devolver');
    const nom = (m) => { const d = (F.documentos || []).find((x) => x.id === m.documento); return d ? casilla(d.casilla, d.numero) : 'Documento'; };
    const quedan = sinMarcar().length; const despues = estatusDespues(); const msj = mensajeRevision();
    const k = rev.ia && rev.ia.estado === 'lista' ? rev.ia : null; const v = k ? VEREDICTO[k.veredicto] : null;
    const iaMalos = k ? (k.puntos || []).filter((p) => p.estado === 'bloquea' || p.estado === 'mano') : [];
    $('hojaCerrarRev').innerHTML = cabHoja('tCerrarRev', 'Cerrar revisión', F.cliente.nombre) +
      '<div class="datos" style="margin-top:0">' +
        (ap.length ? fila('Se aprueban', esc(C.lista(ap.map(nom)))) : '') +
        (dv.length ? fila('Se devuelven', dv.map((m) => esc(nom(m) + ': ' + (C.MOTIVOS[m.motivo] || ''))).join('<br>')) : '') +
        (despues ? fila('Estatus', esc(despues)) : '') + (v ? fila('La IA', '<span class="chip ' + v[0] + '">' + v[1] + '</span>') : '') + '</div>' +
      avisoViejo(k, true) +
      (iaMalos.length ? '<div class="ia-ps" style="margin-top:10px">' + iaMalos.map((p) => puntoIA(p, false)).join('') + '</div>' : '') +
      (quedan ? '<div class="estado ambar chico"><small>' + (quedan === 1 ? 'Queda 1 documento sin revisar. Seguirá' : 'Quedan ' + quedan + ' documentos sin revisar. Seguirán') + ' por revisar.</small></div>' : '') +
      (msj ? '<label class="rotulo arriba" for="msjRev">Mensaje para ' + esc(liderCorto()) + '</label><textarea class="area" id="msjRev" maxlength="4000">' + esc(msj) + '</textarea>' +
        '<p class="nota">Puedes cambiarlo antes de enviarlo. ' + (rev.lider_whatsapp ? 'Se abre el WhatsApp de ' + esc(liderCorto()) + '.' : 'No tiene WhatsApp en Usuarios: se abre WhatsApp para que elijas el chat.') + '</p>'
        : '<p class="nota">No hay nada que pedirle a ' + esc(liderCorto()) + '.</p>') +
      preguntaComision(claveDespues()) +
      '<div class="error" id="eCerrar" role="alert"></div>' +
      '<div class="acciones">' + (msj ? '<button type="button" class="btn btn-2" id="cerrarRevSolo">Cerrar sin enviar</button><button type="button" class="btn" id="cerrarRevEnviar">Cerrar y enviar</button>'
        : '<button type="button" class="btn btn-ancho" id="cerrarRevSolo">Cerrar revisión</button>') + '</div>';
    abrirHoja('hojaCerrarRev');
  }
  async function cerrarRevision(enviar){
    await marcasPend;   // las marcas que se están guardando por detrás van primero
    const er = $('eCerrar'); er.textContent = '';
    const m = $('msjRev'); const texto = m ? m.value.trim() : '';
    if(enviar && texto.length < 10){ er.textContent = 'Escribe el mensaje o cierra sin enviar'; m.focus(); return; }
    const quitar = respuestaComision(); if(quitar === null) return;
    const bs = ['cerrarRevSolo', 'cerrarRevEnviar'].map($).filter(Boolean); bs.forEach((x) => { x.disabled = true; });
    // WhatsApp se abre primero: después de esperar al servidor el navegador lo bloquearía
    if(enviar) window.open(rev && rev.lider_whatsapp ? C.enlaceWa(rev.lider_whatsapp, texto) : 'https://wa.me/?text=' + encodeURIComponent(texto), '_blank', 'noopener');
    let r;
    try { r = await rpc('revision_cerrar', { p_cliente: id, p_mensaje: texto || null, p_enviado: !!enviar }); }
    catch (e) { er.textContent = (enviar ? 'Se abrió WhatsApp, pero la revisión no se cerró: ' : '') + e.message; bs.forEach((x) => { if(document.contains(x)) x.disabled = false; }); return; }
    await quitarLegalTras(quitar, 'Revisión cerrada con documentos devueltos');
    if(hojaAbierta() === 'hojaCerrarRev') cerrarHoja();
    const e = C.ESTATUS[r && r.estatus] || null;
    toast('Revisión cerrada' + (e ? '. Quedó en ' + e.t : ''));
    cargar();
  }

  // Aprobar seleccionados: una sola llamada marca todos para aprobar; la pantalla responde al instante y se pone al día por detrás
  async function aprobarSel(b){
    const ids = Array.from(selDocs); if(!ids.length) return; b.disabled = true; b.textContent = 'Marcando…';
    try { await rpc('documentos_marcar_varios', { p_documentos: ids }); }
    catch (e) { toast(e.message, 'error'); b.disabled = false; b.textContent = 'Aprobar ' + ids.length; return; }
    if(rev){ rev.marcas = (rev.marcas || []).filter((m) => ids.indexOf(m.documento) < 0).concat(ids.map((x) => ({ documento: x, accion: 'aprobar', origen: 'manual' }))); }
    selMode = false; selDocs = new Set(); pintarTodo();
    toast(plural(ids.length, 'documento marcado', 'documentos marcados') + ' para aprobar. ' + (rev && rev.puede_cerrar ? 'Cierra la revisión para avisarle a ' + liderCorto() : 'El administrador cierra la revisión'));
    recargarRevision().then(() => { if(F && !encima()) pintarTodo(); }).catch(() => {});
  }

  // ---------- Eventos ----------
  document.addEventListener('click', (e) => {
    const t = e.target;
    let b;
    if(t.closest('#hojaFicha #reintentar')){ cargar(true); return; }
    if((b = t.closest('#tabs [data-tab]'))){ irTab(b.dataset.tab); return; }
    if((b = t.closest('#hojaFicha [data-ir-tab]'))){ irTab(b.dataset.irTab); const g = b.dataset.irGrupo && document.querySelector('#tab-' + tab + ' [data-grupo="' + b.dataset.irGrupo + '"]'); if(g) g.scrollIntoView({ block: 'center' }); return; }
    if((b = t.closest('[data-paso]'))){
      const a = b.dataset.paso;
      if(a === 'rif') abrirCampo('rif'); else if(a === 'revisar') abrirRevision(); else if(a === 'cerrarrev') abrirCerrar(); else if(a === 'estatus') abrirEstatus(); else if(a.indexOf('pedir:') === 0) pedir(a.slice(6)); else if(a.indexOf('tab:') === 0) irTab(a.slice(4));
      return;
    }
    if(t.closest('#hiloMas')){ hiloTodo = true; pintarHilo(); return; }
    if((b = t.closest('[data-hilo]'))){ hiloF = b.dataset.hilo; pintarHilo(); return; }
    if((b = t.closest('#hojaFicha [data-vgt-subir]'))){ fuera = null; const p = b.dataset.vgtSubir.split(':'); destino = { casilla: 'otro', numero: 0, vgt: { sol: Number(p[0]), tipo: p[1], otra: p[2] === 'otra' } }; const inp = $('archivo'); inp.value = ''; inp.click(); return; }
    if(t.closest('#hojaFicha #vgtNueva')){ abrirNuevaSol(); return; }
    if((b = t.closest('#hojaFicha [data-subir]'))){ fuera = null; const p = b.dataset.subir.split(':'); elegirPara(p[0], Number(p[1])); return; }
    if((b = t.closest('#hojaFicha [data-ip]'))){ fuera = null; abrirCampo('ip:' + b.dataset.ip); return; }
    if((b = t.closest('#hojaFicha [data-enviar]'))){ abrirEnviar(b.dataset.enviar); return; }
    if((b = t.closest('#hojaEnviar [data-env-tipo]')) && env){ env.tipo = b.dataset.envTipo; Array.prototype.forEach.call($('hojaEnviar').querySelectorAll('[data-env-tipo]'), (x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); }); return; }
    if((b = t.closest('[data-env-ver]')) && env){ verPdf(b.dataset.envVer); return; }
    if(t.closest('#envWa') && env){ enviarWhatsapp(); return; }
    if(t.closest('#envCorreo') && env){ enviarCorreo(); return; }
    if(t.closest('#envIp') && env){ const sid = env.servicio; const fe = envF ? { cliente: envF.cliente.id, F: envF, alTerminar: envFin } : null; cerrarHoja(); fuera = fe; abrirCampo('ip:' + sid); return; }
    if((b = t.closest('#envManual')) && env){ if(b.dataset.armado !== '1'){ b.dataset.armado = '1'; b.textContent = '¿Seguro? Toca otra vez'; setTimeout(() => { if(document.contains(b)){ b.dataset.armado = ''; b.textContent = 'Ya se envió por fuera'; } }, 4000); return; }
      b.disabled = true; anotarEnvio(env.tipo, 'manual', null); return; }
    if(t.closest('#agregarVgt')){ vgtExtra = Math.min(4, vgtExtra + 1); pintarDedicado(); return; }
    if(t.closest('#agregarActa')){ actaExtra = Math.min(ACTAS.length, actaExtra + 1); pintarDocumentos(); const cs = document.querySelectorAll('[data-grupo="empresa"] [data-casilla^="acta_asamblea"]'); if(cs.length) cs[cs.length - 1].scrollIntoView({ block: 'center' }); return; }
    if((b = t.closest('[data-ver]')) && !t.closest('#docsCom')){ abrirVer(Number(b.dataset.ver)); return; }   // en la hoja de comisión lo maneja comisiones.js
    if((b = t.closest('#hojaFicha [data-campo]'))){ fuera = null; abrirCampo(b.dataset.campo); return; }
    if((b = t.closest('[data-quitar-rep]'))){ repExtra = Math.max(0, Number(b.dataset.quitarRep) - 1); pintarDocumentos(); return; }
    if(t.closest('#agregarRep')){ const vis = document.querySelectorAll('#tab-documentos [data-grupo^="rep"]').length; const n = Math.max(vis, repExtra, !F.cliente.es_natural && F.cliente.regimen_firma === 'conjunta' ? 2 : 1) + 1; repExtra = Math.min(REPS.length, n); pintarDocumentos(); const g = document.querySelector('[data-grupo="rep' + repExtra + '"]'); if(g) g.scrollIntoView({ block: 'center' }); return; }
    if(t.closest('#subirVarios')){ abrirVarios(); return; }
    // Aprobar seleccionados
    if(t.closest('#elegirAprobar')){ selMode = !selMode; selDocs = new Set(); pintarDocumentos(); return; }
    if((b = t.closest('[data-sel-doc]'))){ const n = Number(b.dataset.selDoc); if(selDocs.has(n)) selDocs.delete(n); else selDocs.add(n); pintarDocumentos(); return; }
    if(t.closest('#selTodos')){ sinMarcar().forEach((d) => selDocs.add(d.id)); pintarDocumentos(); return; }
    if((b = t.closest('#aprobarSel'))){ aprobarSel(b); return; }
    // Gestión, líder y suspensión (cliente-gestion.js)
    if((b = t.closest('#hojaFicha [data-ges-ficha]')) && F && window.Gestiones){ window.Gestiones.abrir(Number(b.dataset.gesFicha), { cliente: F.cliente.id, alCerrar: () => cargar() }); return; }
    if(t.closest('#hojaFicha [data-etiquetar-ficha]') && F && window.Gestion){ window.Gestion.etiquetar(F.cliente.id, () => cargar(), (F.gestion || [])[0]); return; }
    if((b = t.closest('#hojaFicha [data-lider-cambiar]')) && F && window.Gestion){ window.Gestion.lider(F, b.dataset.liderCambiar, () => cargar()); return; }
    if((b = t.closest('#hojaFicha [data-suspender]')) && F && window.Gestion){ window.Gestion.suspender(F, b.dataset.suspender === '1', () => cargar()); return; }
    // Firma Digital o Física del contrato PYME (Física = contrato presencial)
    if((b = t.closest('#hojaFicha [data-firma-cli]')) && F){ if(b.classList.contains('on')) return; const fis = b.dataset.valor === 'fisica';
      accion('cliente_marca', { p_cliente: id, p_marca: 'contrato_presencial', p_valor: fis }, fis ? 'Firma física: no se piden correos ni teléfono' : 'Firma digital', b); return; }
    if(t.closest('#revisarTodo')){ abrirRevision(); return; }
    // Lote 05/11 parte C
    if((b = t.closest('#hojaFicha [data-rp-abrir]'))){ rpAbierto = true; pintarDocumentos(); return; }
    if((b = t.closest('#hojaFicha [data-rp-plegar]'))){ rpAbierto = false; pintarDocumentos(); return; }
    if((b = t.closest('#hojaFicha [data-rp-cambiar]'))){ rpCambiar[b.dataset.rpCambiar] = true; pintarDocumentos(); return; }
    if((b = t.closest('#hojaFicha [data-pt]'))){ marcarPunto(b); return; }
    if((b = t.closest('#hojaFicha [data-pt-cerrar]'))){ cerrarPuntos(b); return; }
    if((b = t.closest('[data-req-quitar]'))){ if(b.dataset.armado !== '1'){ b.dataset.armado = '1'; b.textContent = '¿Quitar? Toca otra vez'; setTimeout(() => { if(document.contains(b)){ b.dataset.armado = ''; b.textContent = 'Quitar pedido'; } }, 4000); return; }
      accion('requerimiento_anular', { p_id: Number(b.dataset.reqQuitar) }, 'Pedido quitado', b); return; }
    if((b = t.closest('#hojaCampo [data-req-tipo]')) && pedirO){ leerPedir(); pedirO.tipo = b.dataset.reqTipo; pintarPedir(); if(pedirO.tipo === 'otro' && $('reqTexto')) $('reqTexto').focus(); return; }
    if((b = t.closest('#reqGuardar'))){ guardarPedir(b); return; }
    if((b = t.closest('[data-qp]'))){ accionQuePedir(b); return; }
    if((b = t.closest('[data-rep-marca]'))){ marcarRep(b); return; }
    if((b = t.closest('[data-doc-titulo]'))){ const d = (F.documentos || []).find((x) => x.id === Number(b.dataset.docTitulo)); if(d){ cerrarHoja(); abrirTitulo(d); } return; }
    if((b = t.closest('[data-doc-acta]'))){ const d = (F.documentos || []).find((x) => x.id === Number(b.dataset.docActa)); if(d){ cerrarHoja(); abrirAActa(d); } return; }
    if((b = t.closest('[data-titulo-guardar]'))){ guardarTitulo(b); return; }
    if((b = t.closest('[data-a-acta]'))){ guardarAActa(b); return; }
    if(t.closest('#verPedir')){ const d = docVer(); if(d){ const o = { origen: d.id, origenT: d.titulo || casilla(d.casilla, d.numero), tipo: d.casilla === 'acta_constitutiva' ? 'junta' : 'otro' }; cerrarHoja(); abrirPedir(o); } return; }
    if(t.closest('#ajCambia')){ leerActa(); ver.ajCambia = t.checked; pintarVer(); return; }
    if(t.closest('#ajAgregar')){ leerActa(); ver.dirs.push({ nombre: '', cedula: '', cargo: '', firma: false }); pintarVer(); return; }
    if((b = t.closest('#ajGuardar'))){ guardarActa(b); return; }
    if(t.closest('#abrirCerrarRev')){ abrirCerrar(); return; }
    if(t.closest('#cerrarRevSolo')){ cerrarRevision(false); return; }
    if(t.closest('#cerrarRevEnviar')){ cerrarRevision(true); return; }
    if(t.closest('#revReintentar')){ cargar(); return; }
    if((b = t.closest('#verQuitarMarca'))){ quitarMarca(b); return; }
    if(t.closest('#mandarIA')){ abrirMandarIA(); return; }
    if((b = t.closest('#lanzarIA'))){ lanzarIA(b); return; }
    if((b = t.closest('#reanudarIA'))){ reanudarIA(b); return; }
    if((b = t.closest('[data-actualizar-ia]'))){ actualizarIA(b, false); return; }
    if((b = t.closest('[data-exc-ia]'))){ abrirExcIA(b.dataset.excIa); return; }
    if((b = t.closest('#darExcIA'))){ darExcIA(b, false); return; }
    if((b = t.closest('[data-quitar-exc]'))){ darExcIA(b, true, b.dataset.quitarExc); return; }
    if(t.closest('#cambiarEstatus')){ abrirEstatus(); return; }
    if((b = t.closest('[data-estatus]'))){
      Array.prototype.forEach.call($('hojaEstatus').querySelectorAll('.mot'), (x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); });
      const g = $('guardarEstatus'); g.disabled = b.dataset.estatus === F.cliente.estatus; g.dataset.valor = b.dataset.estatus;
      $('pregEstatus').innerHTML = b.dataset.estatus === F.cliente.estatus ? '' : preguntaComision(b.dataset.estatus);
      const pq = $('pregCom'); if(pq) pq.scrollIntoView({ block: 'nearest' }); return;
    }
    if((b = t.closest('[data-quitar-com]'))){
      Array.prototype.forEach.call(b.parentNode.querySelectorAll('button'), (x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); });
      const er = $('ePregCom'); if(er) er.textContent = ''; return;
    }
    if((b = t.closest('#guardarEstatus'))){
      const v = b.dataset.valor; const quitar = respuestaComision(); if(quitar === null) return;
      b.disabled = true;
      rpc('cliente_estatus', { p_cliente: id, p_estatus: v }).then(async () => { toast('Estatus cambiado'); await quitarLegalTras(quitar, 'Cambio de estatus a ' + ((C.ESTATUS[v] || {}).t || v));
        if(hojaAbierta() === 'hojaEstatus') cerrarHoja(); return cargar(); }).catch((err) => { toast(err.message, 'error'); b.disabled = false; }); return;
    }
    if((b = t.closest('[data-regimen]'))){ if(b.dataset.regimen !== (F.cliente.regimen_firma || '')) accion('cliente_dato', { p_cliente: id, p_campo: 'regimen_firma', p_valor: b.dataset.regimen }, 'Régimen de firma guardado', b); return; }
    if((b = t.closest('[data-marca-cli]')) && !t.closest('#docsCom')){ const nuevo = b.getAttribute('aria-checked') !== 'true'; accion('cliente_marca', { p_cliente: id, p_marca: b.dataset.marcaCli, p_valor: nuevo }, 'Guardado', b); return; }
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
    if((b = t.closest('#guardarFechaActa'))){ guardarFechaActa(b); return; }
    if((b = t.closest('[data-ip-usar]'))){ ipConfirmar(b, true); return; }
    if((b = t.closest('[data-ip-dejar]'))){ ipConfirmar(b, false); return; }
  });
  document.addEventListener('submit', (e) => {
    if(e.target.id === 'formNota') guardarNota(e);
    else if(e.target.id === 'formCampo') guardarCampo(e);
    else if(e.target.id === 'formFechas') guardarFechas(e);
    else if(e.target.id === 'formVence') guardarVence(e);
    else if(e.target.id === 'formOtro') guardarOtro(e);
  });
  document.addEventListener('visibilitychange', () => { if(!document.hidden && F && id && !ocupado && !encima()) cargar(); });

  // Arrastrar desde la computadora: sobre una casilla la llena; fuera de ellas abre Subir varios
  function soltarEn(e){
    e.preventDefault(); limpiarSobre();
    const files = Array.prototype.slice.call((e.dataTransfer && e.dataTransfer.files) || []); if(!files.length || !F) return;
    const c = e.target.closest('[data-suelta]');
    if(c){ const p = c.dataset.casilla.split(':'); const d = { casilla: p[0], numero: Number(p[1]) }; fuera = null;
      if(d.casilla.indexOf('contrato_') === 0){ abrirFechas(d, files); return; }
      if(esPoliza(d)){ abrirVence(d, files); return; }
      if(d.casilla === 'otro' && d.numero < 60){ abrirOtro(d, files); return; }
      guardarItems([{ files, casillas: [d] }]); return; }
    abrirVarios(); agregarLote(files);
  }
  // Quita el recuadro de la zona misma y de cualquier casilla (también al soltar fuera o cancelar)
  function limpiarSobre(){
    ['tab-documentos', 'tab-contrato', 'tab-vgt'].forEach((k) => { const z = document.getElementById(k); if(z) z.classList.remove('sobre'); });
    Array.prototype.forEach.call(document.querySelectorAll('#tab-documentos .sobre, #tab-contrato .sobre, #tab-vgt .sobre'), (x) => x.classList.remove('sobre'));
  }

  function montar(){
    if(montada) return; montada = true;
    const h = document.createElement('section'); h.id = 'hojaFicha'; h.className = 'hoja lado ficha';
    h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', 'tFicha'); h.setAttribute('aria-hidden', 'true');
    h.innerHTML = '<div class="asa" aria-hidden="true"></div><div class="ficha-cab" id="cabFicha"></div>' +
      '<div class="tabs" id="tabs" role="tablist" aria-label="Secciones del cliente">' +
        '<button type="button" role="tab" data-tab="datos">Datos</button><button type="button" role="tab" data-tab="documentos">Documentos</button>' +
        '<button type="button" role="tab" data-tab="contrato" class="hidden">Contrato</button><button type="button" role="tab" data-tab="vgt" class="hidden">VGT</button>' +
        '<button type="button" role="tab" data-tab="hilo">Hilo</button><button type="button" role="tab" data-tab="comision" class="hidden">Comisión</button></div>' +
      '<div class="ficha-cuerpo" id="cuerpoFicha"><section class="panel-tab" id="tab-datos" aria-label="Datos"></section><section class="panel-tab" id="tab-documentos" aria-label="Documentos"></section>' +
        '<section class="panel-tab" id="tab-contrato" aria-label="Contrato"></section><section class="panel-tab" id="tab-vgt" aria-label="VGT"></section>' +
        '<section class="panel-tab" id="tab-hilo" aria-label="Hilo"></section><section class="panel-tab" id="tab-comision" aria-label="Comisión"></section></div>';
    document.body.appendChild(h);
    const mas = document.createElement('div');
    mas.innerHTML = '<input type="file" id="archivo" class="hidden" multiple accept="image/*,application/pdf" tabindex="-1" aria-hidden="true">' +
      '<input type="file" id="archivosLote" class="hidden" multiple accept="image/*,application/pdf" tabindex="-1" aria-hidden="true">' +
      '<section class="hoja completa lado" id="hojaVer" role="dialog" aria-modal="true" aria-labelledby="tVer" aria-hidden="true"></section>' +
      '<section class="hoja completa lado" id="hojaVarios" role="dialog" aria-modal="true" aria-labelledby="tVarios" aria-hidden="true"></section>' +
      '<section class="hoja" id="hojaCampo" role="dialog" aria-modal="true" aria-labelledby="tCampo" aria-hidden="true"></section>' +
      '<section class="hoja" id="hojaEstatus" role="dialog" aria-modal="true" aria-labelledby="tEstatus" aria-hidden="true"></section>' +
      '<section class="hoja" id="hojaEnviar" role="dialog" aria-modal="true" aria-labelledby="tEnviar" aria-hidden="true"></section>' +
      '<section class="hoja" id="hojaCerrarRev" role="dialog" aria-modal="true" aria-labelledby="tCerrarRev" aria-hidden="true"></section>' +
      '<section class="hoja" id="hojaIA" role="dialog" aria-modal="true" aria-labelledby="tIA" aria-hidden="true"></section>' +
      '<section class="hoja" id="hojaExcIA" role="dialog" aria-modal="true" aria-labelledby="tExcIA" aria-hidden="true"></section>';
    while(mas.firstChild) document.body.appendChild(mas.firstChild);
    C.prepararHojas();
    $('archivo').addEventListener('change', alElegir);
    $('archivosLote').addEventListener('change', () => { agregarLote(Array.prototype.slice.call($('archivosLote').files || [])); });
    // En escritorio también se puede arrastrar a la hoja de Subir varios
    $('hojaVarios').addEventListener('dragover', (e) => { e.preventDefault(); const s = $('soltar'); if(s) s.classList.add('sobre'); });
    $('hojaVarios').addEventListener('dragleave', () => { const s = $('soltar'); if(s) s.classList.remove('sobre'); });
    $('hojaVarios').addEventListener('drop', (e) => { e.preventDefault(); if(e.dataTransfer && e.dataTransfer.files) agregarLote(Array.prototype.slice.call(e.dataTransfer.files)); });
    $('hojaVarios').addEventListener('hoja-cerrada', () => { soltarMinis(); lote = []; varF = null; varFin = null; });
    $('hojaVarios').addEventListener('input', (e) => { const x = e.target.closest('[data-titulo]'); if(x && lote[Number(x.dataset.titulo)]) lote[Number(x.dataset.titulo)].titulo = x.value; });
    $('hojaVer').addEventListener('hoja-cerrada', () => { ver = null; soltarBlobs(); });
    $('hojaEnviar').addEventListener('hoja-cerrada', () => { env = null; envF = null; envFin = null; });
    $('hojaEnviar').addEventListener('change', (e) => { if(e.target.id === 'envNum'){ $('envOtroZ').classList.toggle('hidden', !!e.target.value); $('eEnv').textContent = ''; if(!e.target.value) $('envOtro').focus(); } });
    ['tab-documentos', 'tab-contrato', 'tab-vgt'].forEach((z) => { const zona = $(z);
      zona.addEventListener('dragover', (e) => { e.preventDefault(); limpiarSobre(); const c = e.target.closest('[data-suelta]'); (c || zona).classList.add('sobre'); });
      zona.addEventListener('dragleave', (e) => { if(!zona.contains(e.relatedTarget)) limpiarSobre(); });
      zona.addEventListener('drop', soltarEn); });
    // Soltar fuera de la zona, cancelar con Esc o salir de la ventana: no queda el recuadro puesto
    const conArchivos = (e) => !!(e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0);
    window.addEventListener('dragover', (e) => { if(conArchivos(e)) e.preventDefault(); });
    window.addEventListener('drop', (e) => { limpiarSobre(); if(conArchivos(e)) e.preventDefault(); });
    window.addEventListener('dragend', limpiarSobre);
    document.addEventListener('dragleave', (e) => { if(!e.relatedTarget) limpiarSobre(); });
    h.addEventListener('hoja-cerrada', () => { const f = alCerrar; id = 0; F = null; alCerrar = null; ver = null; clearTimeout(sondeo); sondeo = null; if(f) f(); });
    window.Pedir.alContactar(() => { if(id) cargar(); else if(externo) externo(); });
  }
  let externo = null;

  // opciones: { yo, tab, revisar, pedir, alCerrar }
  function abrir(idCliente, opciones){
    const o = opciones || {};
    montar();
    yo = o.yo || yo; id = Number(idCliente) || 0; drive = undefined; rev = null; clearTimeout(sondeo); sondeo = null; if(!id) return;
    F = null; fuera = null; hiloTodo = false; hiloF = 'todo'; repExtra = 0; actaExtra = 0; selMode = false; selDocs = new Set(); llegada = { revisar: o.revisar, pedir: o.pedir, casilla: o.casilla, campo: o.campo, enviar: o.enviar }; alCerrar = o.alCerrar || null;
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
    montar();
    fuera = { cliente: ficha.cliente.id, F: ficha, alTerminar }; destino = { casilla: cas, numero: num };
    const inp = $('archivo'); inp.value = ''; inp.click();
  }
  // Un archivo que ya se eligió en otra hoja (el RIF leído en el formulario de cambio de titular) va directo a su casilla
  function subirArchivoA(ficha, cas, num, file, alTerminar){
    montar();
    fuera = { cliente: ficha.cliente.id, F: ficha, alTerminar };
    guardarItems([{ files: [file], casillas: [{ casilla: cas, numero: num }] }]); return true;
  }
  // Lote urgente 20/10: los documentos en la hoja de comisión son las mismas casillas del expediente
  function documentosPara(ficha){ const prev = F; F = ficha; try { return casillasHtml(true); } finally { F = prev; } }
  function variosA(ficha, alTerminar, files){
    montar();
    varF = ficha; varFin = alTerminar || null; abrirVarios(); if(files && files.length) agregarLote(files);
  }
  // Archivos soltados sobre una casilla de otra hoja
  function soltarA(ficha, cas, num, files, alTerminar){
    montar();
    fuera = { cliente: ficha.cliente.id, F: ficha, alTerminar };
    if(cas.indexOf('contrato_') === 0){ abrirFechas({ casilla: cas, numero: num }, files); return; }
    if(esPoliza({ casilla: cas, numero: num })){ abrirVence({ casilla: cas, numero: num }, files); return; }
    if(cas === 'otro' && num < 60){ abrirOtro({ casilla: cas, numero: num }, files); return; }
    guardarItems([{ files, casillas: [{ casilla: cas, numero: num }] }]);
  }
  // Proforma y carta desde otra hoja: siempre con los datos del momento (la ficha recién leída)
  function mensajeWa(F, tipo){
    const quien = saludoHora() + '. Le escribe ' + ((F.yo && F.yo.nombre) || 'el equipo') + ', de Airtek. ';
    return quien + (tipo === 'proforma' ? 'Le envío la proforma de instalación de su servicio de internet, con las opciones de pago.'
      : 'Le damos la bienvenida a Airtek Empresas. Le envío su carta de bienvenida con los datos de su servicio' + (tipo === 'ambas' ? ' y la proforma de instalación.' : '.')) + ' Quedo a su orden. Gracias.';
  }
  // Lote 28/10: carta y proforma en un solo toque (como la nota de entrega de Artesanos). Copia el número del cliente y comparte los dos PDF
  // con el mensaje; en Android queda el paso 2 para abrir el chat; en la laptop descarga los PDF y abre WhatsApp Web en su chat.
  async function cartaWhatsapp(ficha, servicioId, alTerminar){
    montar(); envF = ficha; envFin = null;
    const F = EF(); const sv = (F.servicios || []).find((x) => String(x.id) === String(servicioId)); if(!sv) return null;
    const tels = telefonosDe(sv);
    if(!tels.length){ envFin = alTerminar || null; abrirEnviar(servicioId); return null; }   // sin número guardado: se escribe en la hoja de envío
    const k = sv.carta || {}; env = { servicio: sv.id, tipo: k.puede ? 'ambas' : 'proforma' };
    const D = window.Documentos; const num = tels[0].n; let files;
    try { files = archivosEnvio(env.tipo, num); } catch (e) { toast('No se pudo armar el PDF. Intenta de nuevo', 'error'); return null; }
    const msj = mensajeWa(F, env.tipo); let paso2 = false;
    try { copiar(D.telFmt(num)); } catch (e) {}   // si no deja copiar, igual se comparte
    if(puedeCompartir()){
      try { await navigator.share({ files, text: msj }); paso2 = true; }
      catch (e) { if(e && e.name === 'AbortError') return null; toast('No se pudo abrir Compartir. Intenta de nuevo', 'error'); return null; }
    } else {
      try { files.forEach((f) => window.Archivos.descargar(f, f.name)); window.open('https://web.whatsapp.com/send?phone=' + D.waNumero(num) + '&text=' + encodeURIComponent(msj), '_blank', 'noopener'); }
      catch (e) { toast('No se pudieron descargar los PDF. Intenta de nuevo', 'error'); return null; }
    }
    try {
      if(env.tipo === 'ambas') await rpc('carta_enviar', { p_servicio: sv.id, p_canal: 'whatsapp', p_destino: D.telFmt(num) });
      else await rpc('envio_registrar', { p_servicio: sv.id, p_tipos: ['proforma'], p_canal: 'whatsapp', p_destino: D.telFmt(num) });
    } catch (e) { toast('Se abrió WhatsApp, pero no quedó anotado el envío: ' + e.message, 'error'); return null; }
    toast(paso2 ? 'Quedó anotado. Paso 2: abre el chat del cliente' : 'PDF descargados y número copiado (' + D.telFmt(num) + '). Arrástralos al chat de WhatsApp Web');
    if(alTerminar) alTerminar();
    return { telefono: D.telFmt(num), paso2, enlace: C.enlaceWa(num) };
  }
  function cartaPdf(ficha, servicioId, tipo){ montar(); envF = ficha; env = { servicio: Number(servicioId), tipo }; verPdf(tipo); }
  function cartaOtra(ficha, servicioId, alTerminar){ enviarDesde(ficha, servicioId, alTerminar); }
  function enviarDesde(ficha, servicioId, alTerminar){ montar(); envF = ficha; envFin = alTerminar || null; abrirEnviar(servicioId); }
  // Lote 10/11 D11: a qué número sale la carta (primero el del representante, si no el de Proham y luego el del TAD)
  function telefonosCarta(ficha, servicioId){ const g = envF; envF = ficha; try { const sv = (EF().servicios || []).find((x) => String(x.id) === String(servicioId)); return sv ? telefonosDe(sv) : []; } finally { envF = g; } }
  function editarCampo(ficha, clave, alTerminar){ montar(); fuera = { cliente: ficha.cliente.id, F: ficha, alTerminar }; abrirCampo(clave); }
  window.Ficha = { cartaWhatsapp, telefonosCarta, cartaPdf, cartaOtra, subirA, subirArchivoA, documentosPara, variosA, soltarA, ocupado: () => ocupado, editarCampo, enviarDesde, lineaHilo, abrir, montar, abierta: () => id, alContactarFuera: (f) => { externo = f; }, recargar: () => { if(id) cargar(); },
    etiquetar: (cli, alTerminar) => { if(window.Gestion) window.Gestion.etiquetar(cli, alTerminar); } };
})();
