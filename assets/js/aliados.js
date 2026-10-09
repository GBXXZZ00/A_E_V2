// Aliados comerciales: el aliado pide un cliente subiendo sus documentos (el RIF se lee primero y dice si está disponible),
// la IA revisa el resto y él sigue cada paso con etiquetas. El administrador decide excepciones, referidos y el buzón;
// la coordinación de canales paga instalaciones y referidos; el equipo ve los instalados por aliados.
(function(){
  'use strict';
  const { $, esc, ic, rpc, toast, vacio, esqueleto, abrirHoja, cerrarHoja, hojaAbierta, fecha, hora, plural, docFmt, casilla, enlaceWa, cache } = window.Comun;
  const S = window.Sesion;
  const POR_PAGINA = 40;
  const MAX = 15 * 1024 * 1024;
  const TIPOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

  // Etiquetas: el color es solo para el estado
  const ETQ = {
    borrador: ['Borrador', ''], analizando: ['Analizando', 'azul'], recaudos: ['Recaudos incompletos', 'ambar'], excepcion: ['Excepción solicitada', 'morado'],
    revision: ['En revisión', 'morado'], lista: ['Lista para instalar', 'verde'], listaobs: ['Lista con observaciones', 'verde'], curso: ['Instalación en curso', 'azul'],
    instalada: ['Instalada', 'verde'], sininst: ['Sin instalar', ''], noprocede: ['No procede', 'rojo'], cartera: ['Cliente en cartera', ''], otro: ['En gestión por otro', '']
  };
  const ETQ_RF = { referido: ['Referido', 'azul'], aceptado: ['Referido aceptado', 'azul'], no_aceptado: ['Referido no aceptado', ''], instalado: ['Referido instalado', 'verde'], pagado: ['Referido pagado', ''] };
  const SIGUE = {
    borrador: 'Sube los documentos y toca Enviar solicitud.',
    analizando: 'La IA está revisando. Puedes cerrar esta pantalla: el resultado queda aquí.',
    recaudos: 'Sube lo que falta o corrige lo marcado y toca Revisar de nuevo. Si no existe, pide una excepción.',
    excepcion: 'El administrador revisa tu pedido. La respuesta queda aquí.',
    revision: 'El administrador está revisando tus documentos. La respuesta queda aquí.',
    lista: 'Puedes instalar. Marca cuándo vas a instalar para reservar el cliente.',
    listaobs: 'Puedes instalar. Revisa las observaciones: no te frenan.',
    curso: 'Cuando llegue la orden de instalación con tu nombre pasa sola a Instalada.',
    instalada: 'Listo. El cliente quedó en la cartera Aliado Comercial.',
    sininst: 'El cliente quedó libre para otros.',
    noprocede: 'Esta solicitud se cerró. Lee la respuesta del administrador.',
    cartera: 'Este cliente ya es de la oficina. Si lo conseguiste tú, refiérelo: se paga con dos residenciales si se instala.',
    otro: 'Otra persona ya está gestionando este cliente. No se puede instalar ni referir por ahora.'
  };
  const chip = (k) => { const e = ETQ[k] || [k, '']; return '<span class="chip punto ' + e[1] + '">' + esc(e[0]) + '</span>'; };
  const chipRf = (k) => { const e = ETQ_RF[k] || [k, '']; return '<span class="chip punto ' + e[1] + '">' + esc(e[0]) + '</span>'; };
  const rifFmt = (r) => (r ? docFmt(r.charAt(0), r.slice(1)) : '');
  const ABIERTA = ['borrador', 'analizando', 'recaudos', 'excepcion', 'revision', 'lista', 'listaobs', 'curso'];

  let yo = null; let modo = ''; let tab = ''; let D = null; let pagos = null; let instalados = null; let aliadosAdm = null;
  let pedido = 0; let mostrar = POR_PAGINA; let sondeo = null;

  // ---------- Secciones según el rol ----------
  const TABS = {
    aliado: [['inicio', 'Inicio'], ['solicitudes', 'Mis solicitudes'], ['referidos', 'Referidos']],
    canales: [['inicio', 'Inicio'], ['solicitudes', 'Mis solicitudes'], ['referidos', 'Referidos'], ['pagos', 'Pagos'], ['instalados', 'Instalados por aliados']],
    admin: [['para_ti', 'Para ti'], ['analizando', 'Analizando'], ['recaudos', 'Recaudos incompletos'], ['listas', 'Listas para instalar'], ['curso', 'En curso'],
      ['instaladas', 'Instaladas'], ['cerradas', 'Sin instalar'], ['bloq', 'Intentos bloqueados'], ['refs', 'Referidos'], ['sinp', 'Instalado sin permiso'],
      ['viejas', 'Consultas viejas'], ['pagos', 'Pagos'], ['instalados', 'Instalados por aliados'], ['aliados', 'Aliados y usuarios']],
    equipo: [['instalados', 'Instalados por aliados']]
  };
  const AYUDA = {
    inicio: 'Sube los documentos del cliente y en minutos sabes si puedes instalarlo.', solicitudes: 'Todas tus solicitudes con su etiqueta.',
    referidos: 'Clientes que pasaste a la oficina. Se pagan con dos residenciales cuando se instalan.',
    para_ti: 'Excepciones, revisiones, referidos e instalaciones sin permiso que esperan tu respuesta.', analizando: 'La IA las está revisando.',
    recaudos: 'El aliado debe completar o corregir.', listas: 'Aprobadas: el aliado puede instalar.', curso: 'El aliado marcó cuándo va a instalar.',
    instaladas: 'Llegó la orden de instalación.', cerradas: 'No se instalaron o no proceden. El cliente quedó libre.',
    bloq: 'Pidieron un cliente que ya es de la oficina o que otra persona gestiona.', refs: 'Clientes referidos por los aliados.',
    sinp: 'Instalaciones de aliados sin solicitud aprobada. Las nuevas llegan solas con cada carga de órdenes de instalación.',
    viejas: 'Los casos de la app vieja (AppSheet), con su situación.', pagos: 'Solo PYME instaladas por el mismo aliado de la solicitud, y referidos instalados. Aparte del corte de los líderes.',
    instalados: 'Clientes que instalaron los aliados. Solo para ver.', aliados: 'Enlaza cada aliado con su usuario. Los usuarios se crean en Usuarios con el rol Aliado.'
  };
  const tabs = () => TABS[modo] || [];

  function leerUrl(){
    const u = new URLSearchParams(location.search); const t = u.get('t');
    tab = tabs().some((x) => x[0] === t) ? t : tabs()[0][0];
  }
  function guardarUrl(){
    const u = new URLSearchParams(); if(tab !== tabs()[0][0]) u.set('t', tab);
    const s = u.toString(); history.replaceState(history.state, '', location.pathname + (s ? '?' + s : ''));
  }

  // ---------- Datos ----------
  const sols = () => (D && D.solicitudes) || [];
  const refs = () => (D && D.referidos) || [];
  function cuenta(t){
    if(!D) return null;
    const s = sols();
    switch(t){
      case 'para_ti': return s.filter((x) => x.etiqueta === 'excepcion' || x.etiqueta === 'revision').length + refs().filter((r) => r.etiqueta === 'referido').length + (D.sin_permiso || []).filter((p) => p.origen === 'carga' && !p.revisado_en).length;
      case 'analizando': return s.filter((x) => x.etiqueta === 'analizando').length;
      case 'recaudos': return s.filter((x) => x.etiqueta === 'recaudos').length;
      case 'listas': return s.filter((x) => x.etiqueta === 'lista' || x.etiqueta === 'listaobs').length;
      case 'curso': return s.filter((x) => x.etiqueta === 'curso').length;
      case 'instaladas': return s.filter((x) => x.etiqueta === 'instalada').length;
      case 'cerradas': return s.filter((x) => x.etiqueta === 'sininst' || x.etiqueta === 'noprocede').length;
      case 'bloq': return s.filter((x) => x.etiqueta === 'cartera' || x.etiqueta === 'otro').length;
      case 'refs': return refs().length;
      case 'sinp': return (D.sin_permiso || []).filter((p) => !p.revisado_en).length;
      case 'viejas': return (D.viejas || []).length;
      case 'solicitudes': return s.length;
      case 'referidos': return refs().length;
      default: return null;
    }
  }
  function pintarTabs(){
    $('filtros').innerHTML = tabs().length > 1 ? tabs().map((x) => { const c = cuenta(x[0]);
      return '<button type="button" data-tab="' + x[0] + '" class="' + (x[0] === tab ? 'on' : '') + '" aria-pressed="' + (x[0] === tab) + '">' + esc(x[1]) + (c !== null ? ' <em>' + c + '</em>' : '') + '</button>'; }).join('') : '';
    $('ayuda').textContent = AYUDA[tab] || '';
    $('accionCab').innerHTML = (modo === 'aliado' || modo === 'canales') && tab !== 'pagos' && tab !== 'instalados' ? '<button type="button" class="btn btn-chico solo-pc" data-acc="nueva">Nueva solicitud</button>' : '';
  }
  const clave = () => 'aliados:' + modo;
  async function cargar(){
    const mio = ++pedido; clearTimeout(sondeo);
    if(tab === 'pagos') return cargarPagos(mio);
    if(tab === 'instalados') return cargarInstalados(mio);
    if(tab === 'aliados') return cargarAliadosAdm(mio);
    if(!D){ const g = cache.leer(clave()); if(g){ D = g; pintarTabs(); pintar(); } else { $('lista').innerHTML = esqueleto(6); $('cuentaLista').textContent = 'Cargando…'; } }
    try {
      const d = await rpc(modo === 'admin' ? 'aliados_bandeja' : 'aliado_inicio', {});
      if(mio !== pedido) return;
      D = d; cache.guardar(clave(), d); pintarTabs(); pintar(); vigilar();
    } catch (e) {
      if(mio !== pedido) return;
      if(!D) $('lista').innerHTML = errorCaja('No se pudo cargar', e.message);
      toast(e.message, 'error');
    }
  }
  const errorCaja = (t, m) => '<div class="vacio" role="alert"><b>' + esc(t) + '</b><p>' + esc(m) + '</p><button type="button" class="btn btn-chico" data-acc="reintentar">Reintentar</button></div>';
  // Mientras haya algo analizándose, se refresca solo
  function vigilar(){
    clearTimeout(sondeo);
    if(!sols().some((s) => s.etiqueta === 'analizando')) return;
    sondeo = setTimeout(() => { if(!document.hidden && !hojaAbierta()) cargar(); else vigilar(); }, 8000);
  }

  // ---------- Listas ----------
  function filaSol(s){
    const sub = [rifFmt(s.rif), s.codigo, modo === 'admin' ? s.aliado : ''].filter(Boolean).join(' · ');
    const cuando = s.etiqueta === 'curso' && s.fecha_instalacion ? 'Instala el ' + fecha(s.fecha_instalacion) : s.etiqueta === 'instalada' && s.instalada_en ? 'Instalada el ' + fecha(s.instalada_en) : 'Desde el ' + fecha(s.creada_en);
    return '<div class="rv"><button type="button" class="rv-cuerpo" data-sol="' + esc(s.id) + '">' +
      '<span class="quien"><span class="mono" aria-hidden="true">' + esc(String(s.cliente || 'S').charAt(0)) + '</span><span><b>' + esc(s.cliente || 'RIF por leer') + '</b><small>' + esc(sub) + '</small></span></span>' +
      '<span class="rv-chips">' + chip(s.etiqueta) + (s.pagada_en ? '<span class="chip">Pagada</span>' : '') + '</span>' +
      '<span class="rv-arch">' + esc(cuando) + (s.motivo_cierre ? ' · ' + esc(s.motivo_cierre) : '') + '</span>' + ic('derecha', 'ch fl') + '</button></div>';
  }
  function filaRef(r){
    const sub = [rifFmt(r.rif), r.codigo, modo !== 'aliado' ? r.aliado : ''].filter(Boolean).join(' · ');
    const extra = r.etiqueta === 'instalado' ? (r.horas >= 0 ? 'Quedan ' + r.horas + ' h para pagar' : 'Pago atrasado') : r.lider ? 'Lo lleva ' + r.lider : 'Desde el ' + fecha(r.creado_en);
    return '<div class="rv"><button type="button" class="rv-cuerpo" data-ref="' + esc(r.id) + '">' +
      '<span class="quien"><span class="mono" aria-hidden="true">' + esc(String(r.cliente || 'R').charAt(0)) + '</span><span><b>' + esc(r.cliente || 'Cliente ' + rifFmt(r.rif)) + '</b><small>' + esc(sub) + '</small></span></span>' +
      '<span class="rv-chips">' + chipRf(r.etiqueta) + (r.etiqueta === 'instalado' && r.horas < 0 ? '<span class="chip rojo">Pago atrasado</span>' : '') + '</span>' +
      '<span class="rv-arch">' + esc(extra) + '</span>' + ic('derecha', 'ch fl') + '</button></div>';
  }
  function filaSinp(p){
    return '<div class="rv"><button type="button" class="rv-cuerpo" data-sinp="' + esc(p.id) + '">' +
      '<span class="quien"><span class="mono" aria-hidden="true">' + esc(String(p.cliente || 'S').charAt(0)) + '</span><span><b>' + esc(p.cliente || 'Sin nombre') + '</b><small>' + esc([p.rif ? docFmt(/^\d/.test(p.rif) ? '' : p.rif.charAt(0), /^\d/.test(p.rif) ? p.rif : p.rif.slice(1)) : '', 'Instaló ' + (p.aliado || 'sin enlazar')].filter(Boolean).join(' · ')) + '</small></span></span>' +
      '<span class="rv-chips">' + (p.revisado_en ? '<span class="chip">Revisado</span>' : '<span class="chip punto rojo">Sin permiso</span>') + (p.origen === 'historico' ? '<span class="chip">Antes del módulo</span>' : '') + '</span>' +
      '<span class="rv-arch">' + esc(fecha(p.instalada_en, true) + (p.categoria ? ' · ' + p.categoria : '')) + '</span>' + ic('derecha', 'ch fl') + '</button></div>';
  }
  function paginar(filas, render, vacioTx){
    if(!filas.length) return vacio(vacioTx[0], vacioTx[1], vacioTx[2] || '');
    return '<div class="lista-rv">' + filas.slice(0, mostrar).map(render).join('') + '</div>' +
      (filas.length > mostrar ? '<div class="pie-lista"><span>Mostrando ' + mostrar + ' de ' + filas.length + '.</span><button type="button" class="btn btn-chico btn-2" data-acc="mas">Ver más</button></div>' : '');
  }
  function pintar(){
    const s = sols(); let h = ''; let n = 0;
    const de = (f) => s.filter(f);
    if(tab === 'inicio'){
      const toca = de((x) => ['recaudos', 'lista', 'listaobs', 'curso', 'borrador'].indexOf(x.etiqueta) >= 0);
      h = '<div class="al-grandes"><button type="button" class="al-grande prin" data-acc="nueva"><b>Nueva solicitud</b><small>Sube los documentos y te decimos si puedes instalar</small></button>' +
        '<button type="button" class="al-grande" data-acc="referir"><b>Referir cliente</b><small>Pásalo a la oficina y cobra si se instala</small></button></div>' +
        '<div class="h2">Lo que te toca</div>' + paginar(toca, filaSol, ['Nada pendiente', 'Cuando una solicitud necesite algo de ti, aparece aquí.']);
      n = toca.length;
    } else if(tab === 'solicitudes'){ h = paginar(s, filaSol, ['Todavía no tienes solicitudes', 'Toca Nueva solicitud y sube los documentos del cliente.', '<button type="button" class="btn btn-chico" data-acc="nueva">Nueva solicitud</button>']); n = s.length; }
    else if(tab === 'referidos' || tab === 'refs'){
      h = (tab === 'referidos' ? '<div class="al-acc"><button type="button" class="btn btn-chico btn-2" data-acc="referir">' + (modo === 'canales' ? 'Cargar referido' : 'Referir cliente') + '</button></div>' : '') +
        paginar(refs(), filaRef, ['Sin referidos', modo === 'admin' ? 'Cuando un aliado refiera un cliente, aparece aquí.' : 'Si consigues un cliente que ya es de la oficina, refiérelo.']); n = refs().length;
    }
    else if(tab === 'para_ti'){
      const ex = de((x) => x.etiqueta === 'excepcion' || x.etiqueta === 'revision'); const rf = refs().filter((r) => r.etiqueta === 'referido');
      const sp = (D.sin_permiso || []).filter((p) => p.origen === 'carga' && !p.revisado_en);
      h = (ex.length ? '<div class="h2">Excepciones y revisiones</div><div class="lista-rv">' + ex.map(filaSol).join('') + '</div>' : '') +
        (rf.length ? '<div class="h2">Referidos por aceptar</div><div class="lista-rv">' + rf.map(filaRef).join('') + '</div>' : '') +
        (sp.length ? '<div class="h2">Instalado sin permiso</div><div class="lista-rv">' + sp.map(filaSinp).join('') + '</div>' : '');
      n = ex.length + rf.length + sp.length;
      if(!n) h = vacio('No tienes nada por responder', 'Las excepciones, revisiones, referidos e instalaciones sin permiso te aparecen aquí.');
    }
    else if(tab === 'sinp'){ const sp = D.sin_permiso || []; h = paginar(sp, filaSinp, ['Ninguna', 'Todo lo que instalaron los aliados tenía permiso.']); n = sp.length; }
    else if(tab === 'viejas'){
      const v = D.viejas || [];
      h = paginar(v, (x) => '<div class="rv"><div class="rv-cuerpo"><span class="quien"><span class="mono" aria-hidden="true">' + esc(String(x.cliente || 'C').charAt(0)) + '</span><span><b>' + esc(x.cliente || 'Sin nombre') + '</b><small>' + esc([x.rif, x.aliado].filter(Boolean).join(' · ')) + '</small></span></span>' +
        '<span class="rv-chips"><span class="chip punto ' + (/^instalado/.test(x.situacion) ? 'verde' : x.situacion === 'consulta' ? '' : 'ambar') + '">' + esc(VIEJA[x.situacion] || x.situacion) + '</span></span></div></div>', ['Sin consultas viejas', '']);
      n = v.length;
    } else {
      const f = { analizando: (x) => x.etiqueta === 'analizando', recaudos: (x) => x.etiqueta === 'recaudos', listas: (x) => x.etiqueta === 'lista' || x.etiqueta === 'listaobs',
        curso: (x) => x.etiqueta === 'curso', instaladas: (x) => x.etiqueta === 'instalada', cerradas: (x) => x.etiqueta === 'sininst' || x.etiqueta === 'noprocede', bloq: (x) => x.etiqueta === 'cartera' || x.etiqueta === 'otro' }[tab];
      const l = f ? de(f) : []; h = paginar(l, filaSol, ['No hay solicitudes aquí', 'Prueba con otra sección.']); n = l.length;
    }
    $('cuentaLista').textContent = tab === 'inicio' || tab === 'para_ti' ? '' : plural(n, 'registro', 'registros');
    $('lista').innerHTML = h;
  }
  const VIEJA = { instalado: 'Instalado', instalado_sin_cliente: 'Instalado sin cliente', pendiente_por_instalacion: 'Pendiente por instalación', consulta: 'Consulta' };

  // ---------- Pagos ----------
  async function cargarPagos(mio){
    if(!pagos){ $('lista').innerHTML = esqueleto(4); $('cuentaLista').textContent = 'Cargando…'; }
    try { const d = await rpc('aliados_pagos', {}); if(mio !== pedido) return; pagos = d; pintarPagos(); }
    catch (e) { if(mio !== pedido) return; $('lista').innerHTML = errorCaja('No se pudieron cargar los pagos', e.message); }
  }
  function pintarPagos(){
    const ins = pagos.instalaciones || []; const rf = pagos.referidos || [];
    $('cuentaLista').textContent = plural(ins.length + rf.length, 'pago pendiente', 'pagos pendientes');
    $('lista').innerHTML =
      '<div class="h2 al-h2">Instalaciones PYME por pagar <em>' + ins.length + '</em>' + (ins.length ? '<button type="button" class="btn btn-chico btn-2" data-acc="excel">Descargar Excel</button>' : '') + '</div>' +
      (ins.length ? '<div class="lista-rv">' + ins.map((s) => '<div class="rv al-pago"><div class="rv-cuerpo"><span class="quien"><span class="mono" aria-hidden="true">' + esc(String(s.cliente || 'C').charAt(0)) + '</span><span><b>' + esc(s.cliente) + '</b><small>' + esc([rifFmt(s.rif), s.aliado, 'Instalada el ' + fecha(s.instalada_en)].join(' · ')) + '</small></span></span></div>' +
        '<button type="button" class="btn btn-chico" data-pagar="instalacion" data-id="' + esc(s.id) + '">Marcar pagado</button></div>').join('') + '</div>' : vacio('No hay instalaciones por pagar', 'Aparecen solas cuando llega la orden de instalación del aliado.')) +
      '<div class="h2 al-h2">Referidos por pagar <em>' + rf.length + '</em></div>' +
      (rf.length ? '<div class="lista-rv">' + rf.map((r) => '<div class="rv al-pago"><div class="rv-cuerpo"><span class="quien"><span class="mono" aria-hidden="true">' + esc(String(r.cliente || 'R').charAt(0)) + '</span><span><b>' + esc(r.cliente || rifFmt(r.rif)) + '</b><small>' + esc([rifFmt(r.rif), r.aliado].join(' · ')) + '</small></span></span>' +
        '<span class="rv-chips">' + (r.horas >= 0 ? '<span class="chip punto azul">Quedan ' + r.horas + ' h</span>' : '<span class="chip punto rojo">Pago atrasado</span>') + '</span></div>' +
        '<button type="button" class="btn btn-chico" data-pagar="referido" data-id="' + esc(r.id) + '">Marcar pagado</button></div>').join('') + '</div>' : vacio('No hay referidos por pagar', 'Aparecen cuando el cliente referido se instala. Hay 72 horas para pagar.'));
  }
  function excel(){
    const ins = (pagos && pagos.instalaciones) || [];
    const blob = window.Archivos.xlsx([{ nombre: 'Por pagar', columnas: [{ t: 'Solicitud', ancho: 12 }, { t: 'Aliado', ancho: 30 }, { t: 'Cliente', ancho: 36 }, { t: 'RIF', ancho: 16 }, { t: 'Servicio', ancho: 16 }, { t: 'Equipo', ancho: 20 }, { t: 'Categoría', ancho: 14 }, { t: 'Instalada', ancho: 14 }],
      filas: ins.map((s) => [s.codigo, s.aliado, s.cliente, rifFmt(s.rif), s.servicio || '', s.equipo || '', s.categoria || '', fecha(s.instalada_en, true)]) }]);
    window.Archivos.descargar(blob, 'aliados-por-pagar.xlsx');
  }

  // ---------- Instalados por aliados ----------
  async function cargarInstalados(mio){
    if(!instalados){ $('lista').innerHTML = esqueleto(6); $('cuentaLista').textContent = 'Cargando…'; }
    try { const d = await rpc('instalados_aliados', {}); if(mio !== pedido) return; instalados = d || []; pintarInstalados(); }
    catch (e) { if(mio !== pedido) return; $('lista').innerHTML = errorCaja('No se pudo cargar la lista', e.message); }
  }
  function pintarInstalados(){
    $('cuentaLista').textContent = plural(instalados.length, 'instalación', 'instalaciones');
    $('lista').innerHTML = paginar(instalados, (x) => '<div class="rv"><div class="rv-cuerpo"><span class="quien"><span class="mono" aria-hidden="true">' + esc(String(x.cliente || 'C').charAt(0)) + '</span><span><b>' + esc(x.cliente || 'Sin nombre') + '</b><small>' + esc([x.rif ? docFmt(x.rif.charAt(0), x.rif.slice(1)) : '', x.aliado].filter(Boolean).join(' · ')) + '</small></span></span>' +
      '<span class="rv-chips"><span class="chip punto verde">Instalada</span>' + (x.con_permiso === false ? '<span class="chip punto rojo">Sin permiso</span>' : '') + '</span><span class="rv-arch">' + esc(fecha(x.instalada_en, true) + (x.categoria ? ' · ' + x.categoria : '')) + '</span></div></div>',
      ['Todavía no hay instalaciones de aliados', 'Aparecen cuando se cargan las órdenes de instalación.']);
  }

  // ---------- Aliados y usuarios (administrador) ----------
  async function cargarAliadosAdm(mio){
    if(!aliadosAdm){ $('lista').innerHTML = esqueleto(6); $('cuentaLista').textContent = 'Cargando…'; }
    try { const d = await rpc('aliados_lista', {}); if(mio !== pedido) return; aliadosAdm = d; pintarAliadosAdm(); }
    catch (e) { if(mio !== pedido) return; $('lista').innerHTML = errorCaja('No se pudo cargar la lista', e.message); }
  }
  function pintarAliadosAdm(){
    const as = aliadosAdm.aliados || []; const ps = aliadosAdm.perfiles || [];
    $('cuentaLista').textContent = plural(as.length, 'aliado', 'aliados') + ', ' + as.filter((a) => a.perfil).length + ' con usuario';
    $('lista').innerHTML = '<div class="lista-rv">' + as.map((a) => {
      const opc = ps.filter((p) => (a.es_canales ? p.rol === 'analista' : p.rol === 'aliado'));
      return '<div class="rv al-enlace"><div class="rv-cuerpo"><span class="quien"><span class="mono" aria-hidden="true">' + esc(a.nombre.charAt(0)) + '</span><span><b>' + esc(a.es_canales ? 'Coordinación de canales' : a.nombre) + '</b><small>' + esc(a.es_canales ? 'Hace solicitudes, referidos y pagos' : a.codigo ? 'Código ' + a.codigo + ' en las órdenes de instalación' : 'Sin código en las órdenes') + '</small></span></span></div>' +
        '<div class="campo-s"><label for="enl' + a.id + '">Usuario</label><select id="enl' + a.id + '" data-enlazar="' + a.id + '" class="' + (a.perfil ? 'puesto' : '') + '"><option value="">Sin usuario</option>' +
        opc.map((p) => '<option value="' + esc(p.id) + '"' + (p.id === a.perfil ? ' selected' : '') + '>' + esc(p.nombre + ' (' + p.usuario + ')') + '</option>').join('') + '</select></div></div>';
    }).join('') + '</div>';
  }
  async function enlazar(sel){
    const id = Number(sel.dataset.enlazar); const v = sel.value || null; sel.disabled = true;
    try { await rpc('aliado_enlazar', { p_aliado: id, p_perfil: v }); toast(v ? 'Usuario enlazado' : 'Usuario quitado'); aliadosAdm = null; cargar(); }
    catch (e) { toast(e.message, 'error'); sel.disabled = false; aliadosAdm = null; cargar(); }
  }

  // ---------- Hojas ----------
  function hoja(id, ancha){
    let h = $(id); if(h) return h;
    h = document.createElement('section'); h.id = id; h.className = 'hoja completa lado angosta' + (ancha ? ' al-ancha' : '');
    h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', 't' + id); h.setAttribute('aria-hidden', 'true');
    document.body.appendChild(h); window.Comun.prepararHojas(); return h;
  }
  const cab = (id, t, s) => '<div class="asa" aria-hidden="true"></div><div class="hoja-cab"><div class="tx"><b id="t' + id + '">' + esc(t) + '</b><small>' + esc(s || '') + '</small></div><button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>';

  // Subida a Drive con el permiso del cliente de la solicitud y registro en su casilla
  async function token(){ let tk = ''; try { const s = await window.db.auth.getSession(); tk = (s.data && s.data.session && s.data.session.access_token) || ''; } catch (e) {} if(!tk) throw new Error('Tu sesión venció. Entra de nuevo'); return tk; }
  function validar(file){
    if(!file) throw new Error('No llegó el archivo');
    const t = TIPOS.indexOf(file.type) >= 0 ? file.type : /\.pdf$/i.test(file.name) ? 'application/pdf' : '';
    if(!t) throw new Error('Solo se aceptan fotos y PDF');
    if(file.size > MAX) throw new Error('El archivo pesa más de 15 MB. Toma la foto de nuevo o reduce el PDF');
    return t;
  }
  async function subir(cliente, file, cas, num){
    const t = validar(file); const tk = await token(); const db = window.db;
    const fd = new FormData(); fd.append('cliente', String(cliente)); fd.append('nombre', String(file.name || 'archivo').slice(0, 140));
    fd.append('archivo', file.type === t ? file : file.slice(0, file.size, t), file.name || 'archivo');
    let r; try { r = await fetch(db.supabaseUrl + '/functions/v1/drive_subir', { method: 'POST', headers: { Authorization: 'Bearer ' + tk, apikey: db.supabaseKey }, body: fd }); }
    catch (e) { throw new Error('Sin conexión. El archivo no se subió. Revisa el internet e intenta de nuevo'); }
    let d = {}; try { d = await r.json(); } catch (e) {}
    if(!r.ok || !d.drive_id) throw new Error(String(d.error || 'No se pudo subir el archivo. Intenta de nuevo'));
    await rpc('documentos_registrar', { p_cliente: cliente, p_items: [{ archivos: [{ drive_id: d.drive_id }], casillas: [{ casilla: cas, numero: num }] }] });
  }
  let destino = null;   // { fn(file) }
  function elegir(fn){ destino = fn; const i = $('alArchivo'); i.value = ''; i.click(); }

  // ---------- Nueva solicitud ----------
  let N = null;
  const CAS_EMP = [['rif_empresa', 0, 'RIF de la empresa', 'Se lee primero: te dice al momento si el cliente está disponible'], ['acta_constitutiva', 0, 'Acta constitutiva', ''], ['cedula', 1, 'Cédula del representante', ''], ['rif_personal', 1, 'RIF del representante', '']];
  const CAS_NAT = [['rif_personal', 1, 'RIF personal', 'Se lee primero: te dice al momento si el cliente está disponible'], ['cedula', 1, 'Cédula', '']];
  function casillasN(){
    if(N.tipo === 'natural') return CAS_NAT;
    const l = CAS_EMP.slice();
    for(let i = 1; i <= N.asambleas; i++) l.push(['acta_asamblea', i, 'Acta de asamblea' + (i > 1 ? ' ' + i : ''), i === 1 ? 'Si hubo cambios de junta, domicilio o nombre' : '']);
    for(let r = 2; r <= N.reps; r++){ l.push(['cedula', r, 'Cédula del representante ' + r, '']); l.push(['rif_personal', r, 'RIF del representante ' + r, '']); }
    return l;
  }
  async function abrirNueva(){
    N = { id: null, tipo: 'empresa', rif: null, cliente: null, nombre: '', estado: null, msg: '', cas: {}, reps: 1, asambleas: 0, c: { correo: '', tel: '', correoEmp: '' }, err: {} };
    const h = hoja('hojaNueva'); h.innerHTML = cab('hojaNueva', 'Nueva solicitud', 'Sube los documentos del cliente') + '<div class="hoja-cuerpo" id="cNueva">' + esqueleto(3) + '</div><div class="hoja-pie" id="pNueva"></div>';
    abrirHoja('hojaNueva');
    try { const r = await rpc('solicitud_crear', { p_tipo: 'empresa' }); N.id = r.id; N.codigo = r.codigo; pintarNueva(); }
    catch (e) { $('cNueva').innerHTML = errorCaja('No se pudo empezar la solicitud', e.message); }
  }
  function bandaRif(){
    const e = N.estado; const nom = esc(N.nombre || '');
    if(!e) return '<div class="al-banda"><b>Empieza por el ' + (N.tipo === 'empresa' ? 'RIF de la empresa' : 'RIF personal') + '</b><p>Con eso te decimos al momento si el cliente está disponible. Después subes lo demás.</p></div>';
    if(e === 'leyendo') return '<div class="al-banda azul" role="status"><b>Leyendo el RIF y revisando la cartera…</b><p>Tarda unos segundos.</p><span class="al-barra corre" aria-hidden="true"><i></i></span></div>';
    if(e === 'libre') return '<div class="al-banda verde" role="status"><b>Cliente disponible: ' + nom + '</b><p>' + esc(rifFmt(N.rif)) + '. Sube lo demás: cada documento se empieza a leer apenas sube.</p></div>';
    if(e === 'cartera') return '<div class="al-banda" role="status"><b>Cliente en cartera</b><p>' + (nom || 'Este cliente') + ' ya es de la oficina. No hace falta subir más: refiérelo y se paga con dos residenciales si se instala.</p><button type="button" class="btn btn-chico" data-acc="referirSol" data-id="' + N.id + '">Referir cliente</button></div>';
    if(e === 'otro') return '<div class="al-banda" role="status"><b>En gestión por otro</b><p>Otra persona ya está gestionando ' + (nom ? nom.replace(/\.$/, '') : 'este cliente') + '. No se puede instalar ni referir por ahora.</p></div>';
    if(e === 'repetida') return '<div class="al-banda ambar" role="alert"><b>Ya tienes una solicitud de este cliente</b><p>Es la ' + esc(N.repetida) + '. Síguela desde ahí.</p><button type="button" class="btn btn-chico" data-sol="' + esc(N.repetidaId) + '">Abrir ' + esc(N.repetida) + '</button></div>';
    return '<div class="al-banda ambar" role="alert"><b>' + esc(e === 'no_es_rif' ? 'Ese archivo no es un RIF' : e === 'ilegible' ? 'No pudimos leer el RIF' : 'No se pudo leer el RIF') + '</b><p>' + esc(N.msg || 'Sube una foto más clara, con buena luz y sin cortes.') + '</p></div>';
  }
  function chipCas(st){
    if(!st) return '<span class="chip">Falta</span>';
    if(st.estado === 'subiendo') return '<span class="chip punto azul">Subiendo…</span>';
    if(st.estado === 'error') return '<span class="chip punto rojo">No se subió</span>';
    if(st.lectura === 'ok') return '<span class="chip punto verde">Leído</span>';
    if(st.lectura === 'ilegible' || st.lectura === 'formato') return '<span class="chip punto ambar">No se lee</span>';
    return '<span class="chip punto azul">Leyendo</span>';
  }
  function pintarNueva(){
    if(!N || !$('cNueva')) return;
    const bloq = N.estado === 'cartera' || N.estado === 'otro' || N.estado === 'repetida'; const libre = N.estado === 'libre';
    const l = casillasN(); const primero = l[0];
    const filaC = (c, i) => {
      const k = c[0] + ':' + c[1]; const st = N.cas[k]; const off = bloq || (i > 0 && !libre) || (i === 0 && (N.estado === 'leyendo' || libre)) || (st && st.estado === 'subiendo');
      return '<div class="al-cas"><div class="tx"><b>' + esc(c[2]) + '</b>' + (c[3] ? '<small>' + esc(c[3]) + '</small>' : '') + (st && st.error ? '<small class="mal">' + esc(st.error) + '</small>' : '') + '</div>' +
        (i === 0 && N.estado && N.estado !== 'ilegible' && N.estado !== 'no_es_rif' && N.estado !== 'error' ? (libre ? chipCas(st) : '<span class="chip punto azul">' + (N.estado === 'leyendo' ? 'Leyendo' : 'Leído') + '</span>') : chipCas(st)) +
        '<button type="button" class="btn btn-chico ' + (st ? 'btn-2' : '') + '" data-subirn="' + k + '"' + (off ? ' disabled' : '') + '>' + (st && st.estado === 'subiendo' ? 'Subiendo…' : st || (i === 0 && N.estado && N.estado !== 'ilegible' && N.estado !== 'no_es_rif' && N.estado !== 'error') ? 'Subir de nuevo' : 'Subir') + '</button></div>';
    };
    const campos = N.tipo === 'empresa' ? [['correo', 'Correo del representante', 'email'], ['tel', 'Teléfono del representante', 'tel'], ['correoEmp', 'Correo de la empresa', 'email']] : [['tel', 'Teléfono', 'tel'], ['correo', 'Correo', 'email']];
    $('cNueva').innerHTML =
      '<span class="rotulo" id="rTipoN">El cliente es</span><div class="al-seg" role="radiogroup" aria-labelledby="rTipoN">' +
        [['empresa', 'Empresa'], ['natural', 'Persona natural']].map((x) => '<button type="button" role="radio" aria-checked="' + (N.tipo === x[0]) + '" class="' + (N.tipo === x[0] ? 'on' : '') + '" data-tipon="' + x[0] + '"' + (N.estado && N.estado !== 'ilegible' && N.estado !== 'no_es_rif' && N.estado !== 'error' ? ' disabled' : '') + '>' + x[1] + '</button>').join('') + '</div>' +
      bandaRif() +
      '<div class="h2 al-h2">Documentos</div><div class="al-casillas">' + l.map(filaC).join('') + '</div>' +
      (N.tipo === 'empresa' && libre ? '<div class="al-acc"><button type="button" class="btn btn-chico btn-2" data-acc="masAsamblea"' + (N.asambleas >= 4 ? ' disabled' : '') + '>Agregar acta de asamblea</button><button type="button" class="btn btn-chico btn-2" data-acc="masRep"' + (N.reps >= 4 ? ' disabled' : '') + '>Agregar representante</button></div>' +
        '<p class="nota">Si la junta firma en forma conjunta, o quien firma es otro director, agrega sus documentos.</p>' : '') +
      (libre ? '<div class="h2 al-h2">Contacto</div>' + campos.map((c) => '<label class="rotulo arriba" for="n_' + c[0] + '">' + esc(c[1]) + '</label><input class="campo" id="n_' + c[0] + '" data-campon="' + c[0] + '" type="' + c[2] + '" inputmode="' + (c[2] === 'tel' ? 'tel' : 'email') + '" autocomplete="off" maxlength="120" value="' + esc(N.c[c[0]]) + '"' + (N.err[c[0]] ? ' aria-invalid="true"' : '') + ' aria-describedby="e_' + c[0] + '"><div class="error" id="e_' + c[0] + '" role="alert">' + esc(N.err[c[0]] || '') + '</div>').join('') : '');
    pintarPieNueva();
    if(primero) {}   // la primera casilla siempre es el RIF
  }
  function faltanN(){
    const f = casillasN().filter((c) => c[0] !== 'acta_asamblea' && !(N.cas[c[0] + ':' + c[1]] && N.cas[c[0] + ':' + c[1]].estado === 'listo')).map((c) => c[2]);
    const cs = N.tipo === 'empresa' ? [['correo', 'correo del representante'], ['tel', 'teléfono'], ['correoEmp', 'correo de la empresa']] : [['tel', 'teléfono'], ['correo', 'correo']];
    return f.concat(cs.filter((c) => !String(N.c[c[0]] || '').trim()).map((c) => c[1]));
  }
  function pintarPieNueva(){
    const p = $('pNueva'); if(!p) return;
    if(N.estado === 'cartera' || N.estado === 'otro' || N.estado === 'repetida'){ p.innerHTML = '<button type="button" class="btn btn-2" data-cierra="1">Cerrar</button>'; return; }
    const f = N.estado === 'libre' ? faltanN() : ['RIF'];
    const subiendo = Object.keys(N.cas).some((k) => N.cas[k].estado === 'subiendo');
    p.className = 'hoja-pie col';
    p.innerHTML = (f.length ? '<p>Falta: ' + esc(f.slice(0, 2).join(', ') + (f.length > 2 ? ' y ' + (f.length - 2) + ' más' : '')) + '</p>' : '<p>Todo listo. Al enviar, la IA revisa el expediente completo.</p>') +
      '<button type="button" class="btn" data-acc="enviarN"' + (f.length || subiendo || N.enviando ? ' disabled' : '') + '>' + (N.enviando ? 'Enviando…' : 'Enviar solicitud') + '</button>';
  }
  async function leerRif(file){
    try { validar(file); } catch (e) { N.estado = 'error'; N.msg = e.message; pintarNueva(); return; }
    N.estado = 'leyendo'; N.msg = ''; N.archivoRif = file; pintarNueva();
    let r; let d = {};
    try {
      const tk = await token(); const db = window.db; const fd = new FormData(); fd.append('solicitud', String(N.id)); fd.append('archivo', file, file.name || 'rif');
      r = await fetch(db.supabaseUrl + '/functions/v1/aliado_rif', { method: 'POST', headers: { Authorization: 'Bearer ' + tk, apikey: db.supabaseKey }, body: fd });
      try { d = await r.json(); } catch (e) {}
    } catch (e) { N.estado = 'error'; N.msg = e.message && /sesión/.test(e.message) ? e.message : 'Sin conexión. Revisa el internet e intenta de nuevo.'; pintarNueva(); return; }
    if(!r.ok){ N.estado = 'error'; N.msg = String(d.error || 'No se pudo leer el RIF. Intenta de nuevo.'); pintarNueva(); return; }
    N.estado = d.estado; N.nombre = d.nombre || ''; N.rif = d.rif || null;
    if(d.estado === 'repetida'){ N.repetida = d.codigo; N.repetidaId = d.id; }
    if(d.estado === 'no_es_rif') N.msg = 'Sube la foto o el PDF del RIF' + (N.tipo === 'empresa' ? ' de la empresa' : '') + '.';
    if(d.estado === 'libre'){ N.cliente = d.cliente; subirN(CAS_PRIMERA(), file); }
    pintarNueva(); invalidar();
  }
  const CAS_PRIMERA = () => (N.tipo === 'empresa' ? 'rif_empresa:0' : 'rif_personal:1');
  async function subirN(k, file){
    const [cas, num] = k.split(':'); N.cas[k] = { estado: 'subiendo' }; pintarNueva();
    try { await subir(N.cliente, file, cas, Number(num)); N.cas[k] = { estado: 'listo', lectura: null }; vigilarN(); }
    catch (e) { N.cas[k] = { estado: 'error', error: e.message }; toast(e.message, 'error'); }
    pintarNueva();
  }
  let sondeoN = null;
  // Cada documento se lee apenas sube: la casilla pasa de Leyendo a Leído
  function vigilarN(){
    clearTimeout(sondeoN);
    sondeoN = setTimeout(async () => {
      if(!N || hojaAbierta() !== 'hojaNueva') return;
      try {
        const d = await rpc('solicitud_estado', { p_sol: N.id });
        (d.docs || []).forEach((x) => { const k = x.casilla + ':' + x.numero; const a = (x.archivos || [])[0]; if(N.cas[k] && N.cas[k].estado === 'listo' && a) N.cas[k].lectura = a.lectura; });
        pintarNueva();
      } catch (e) {}
      if(Object.keys(N.cas).some((k) => N.cas[k].estado === 'listo' && !N.cas[k].lectura)) vigilarN();
    }, 4000);
  }
  async function guardarContacto(sol, c, tipo){
    return rpc('solicitud_contacto', { p_sol: sol, p_correo: c.correo || null, p_telefono: c.tel || null, p_correo_empresa: tipo === 'empresa' ? (c.correoEmp || null) : null });
  }
  async function enviarN(){
    N.err = {};
    const mail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/; const tel = (v) => String(v || '').replace(/\D/g, '').length >= 10;
    if(!mail.test(N.c.correo.trim())) N.err.correo = 'Escribe un correo válido.';
    if(!tel(N.c.tel)) N.err.tel = 'Escribe el teléfono con su código, por ejemplo 0414 1234567.';
    if(N.tipo === 'empresa' && !mail.test(N.c.correoEmp.trim())) N.err.correoEmp = 'Escribe un correo válido.';
    if(Object.keys(N.err).length){ pintarNueva(); const k = Object.keys(N.err)[0]; const el = $('n_' + k); if(el) el.focus(); return; }
    N.enviando = true; pintarPieNueva();
    try { await guardarContacto(N.id, N.c, N.tipo); await rpc('solicitud_enviar', { p_sol: N.id }); }
    catch (e) { N.enviando = false; pintarPieNueva(); toast(e.message, 'error'); return; }
    const id = N.id; N = null; cerrarHoja(true); invalidar(); cargar(); abrirSol(id);
  }

  // ---------- Detalle de una solicitud ----------
  let SOL = null; let sondeoS = null;
  async function abrirSol(id){
    SOL = { id, d: null };
    const h = hoja('hojaSol'); h.innerHTML = cab('hojaSol', 'Solicitud', '') + '<div class="hoja-cuerpo" id="cSol">' + esqueleto(4) + '</div><div class="hoja-pie hidden" id="pSol"></div>';
    abrirHoja('hojaSol'); cargarSol();
  }
  async function cargarSol(){
    if(!SOL) return; clearTimeout(sondeoS);
    try { const d = await rpc('solicitud_estado', { p_sol: SOL.id }); if(!SOL || SOL.id !== d.id) return; SOL.d = d; pintarSol(); }
    catch (e) { if($('cSol')) $('cSol').innerHTML = errorCaja('No se pudo abrir la solicitud', e.message).replace('data-acc="reintentar"', 'data-acc="reintentarSol"'); }
  }
  const PASOS = (d) => { const k = d.ia || {}; const total = Number(k.total) || 0; const av = Number(k.avance) || 0; const leyendo = k.estado === 'en_cola' || k.estado === 'leyendo';
    const n = !k.estado ? 2 : leyendo ? (av >= total ? 3 : 2) : 4;
    return { n, av, total }; };
  function pasos(d){
    const p = PASOS(d);
    const fila = (i, t, s) => '<div class="al-paso ' + (p.n > i ? 'hecho' : p.n === i ? 'activo' : 'espera') + '"><i aria-hidden="true"></i><div><b>' + esc(t) + '</b>' + (s ? '<small>' + esc(s) + '</small>' : '') + '</div></div>';
    const frac = Math.min(1, (p.n - 1 + (p.n === 2 && p.total ? p.av / p.total : 0)) / 4);
    return '<div class="al-banda verde"><b>Cliente disponible</b><p>El RIF se leyó primero. Ahora la IA revisa lo demás.</p></div>' +
      '<div class="h2 al-h2">Revisando tu solicitud</div><span class="al-barra" aria-hidden="true"><i style="transform:scaleX(' + frac.toFixed(2) + ')"></i></span>' +
      '<div class="al-pasos" role="status">' + fila(0, 'RIF leído', d.cliente + ', ' + rifFmt(d.rif)) + fila(1, 'Cartera revisada', 'No es TOP, no tiene orden abierta ni otro aliado') +
      fila(2, 'Leyendo documentos', p.total ? p.av + ' de ' + p.total + ' leídos' : 'Lo que ya se leyó al subir no se vuelve a leer') + fila(3, 'Revisando firmantes, junta y actas', 'Mismas reglas de los contratos') + fila(4, 'Armando el resultado', '') + '</div>' +
      '<p class="nota">Puedes cerrar esta pantalla. El resultado queda en Mis solicitudes.</p>';
  }
  function docsSol(d, aliadoPuede){
    const marcas = {}; ((d.ia && d.ia.marcas) || []).forEach((m) => { marcas[m.documento] = m; });
    const conIA = d.ia && (d.ia.estado === 'lista' || d.ia.estado === 'cerrada');
    const filas = (d.docs || []).map((x) => {
      const m = conIA ? marcas[x.id] : null; const a = (x.archivos || [])[0] || {};
      let c = '<span class="chip punto azul">Subido</span>'; let nota = '';
      if(m){ if(m.propuesta === 'bien'){ c = '<span class="chip punto verde">Bien</span>'; } else if(m.propuesta === 'problema'){ c = '<span class="chip punto ambar">Por corregir</span>'; nota = m.nota; } else { c = '<span class="chip punto morado">Lo revisa el administrador</span>'; nota = m.nota; } }
      else if(a.lectura === 'ok') c = '<span class="chip punto verde">Leído</span>'; else if(a.lectura === 'ilegible' || a.lectura === 'formato') c = '<span class="chip punto ambar">No se lee</span>';
      return '<div class="al-cas"><div class="tx"><b>' + esc(casilla(x.casilla, x.numero)) + '</b>' + (nota ? '<small>' + esc(nota) + '</small>' : '') + '</div>' + c +
        (aliadoPuede && m && m.propuesta !== 'bien' ? '<button type="button" class="btn btn-chico" data-subirs="' + esc(x.casilla + ':' + x.numero) + '">Subir de nuevo</button>' : '') + '</div>';
    });
    // Lo que falta: casillas sin documento (se suben aquí) y contactos
    const faltan = conIA ? ((d.ia.puntos || []).filter((p) => p.estado === 'bloquea' && /^falta_/.test(p.id))) : [];
    faltan.forEach((p) => {
      const m = /^falta_([a-z_]+)_(\d+)$/.exec(p.id); const cas = m && m[1]; const num = m && Number(m[2]);
      const esDoc = cas && ['cedula', 'rif_personal', 'rif_empresa', 'acta_constitutiva', 'acta_asamblea', 'conatel'].indexOf(cas) >= 0;
      filas.push('<div class="al-cas"><div class="tx"><b>' + esc(p.titulo) + '</b><small>' + esc(p.detalle || '') + '</small></div><span class="chip punto ambar">Falta</span>' +
        (aliadoPuede && esDoc ? '<button type="button" class="btn btn-chico" data-subirs="' + esc(cas + ':' + num) + '">Subir</button>' : '') + '</div>');
    });
    return filas.length ? '<div class="al-casillas">' + filas.join('') + '</div>' : '<p class="nota">Todavía no hay documentos.</p>';
  }
  function puntosSol(d){
    if(!d.ia || !d.ia.puntos) return '';
    const bl = d.ia.puntos.filter((p) => p.estado === 'bloquea' && !/^falta_/.test(p.id));
    const av = d.ia.puntos.filter((p) => p.estado === 'aviso'); const mano = d.ia.puntos.filter((p) => p.estado === 'mano');
    const lista = (ps, c) => ps.map((p) => '<div class="al-cas"><div class="tx"><b>' + esc(p.titulo) + '</b><small>' + esc(p.detalle || '') + (p.falta ? ' Falta: ' + esc(p.falta.charAt(0).toLowerCase() + p.falta.slice(1)) + '.' : '') + '</small></div><span class="chip punto ' + c + '">' + (c === 'ambar' ? 'Por corregir' : c === 'morado' ? 'A revisar' : 'Observación') + '</span></div>').join('');
    return (bl.length ? '<div class="h2 al-h2">Por corregir en las actas</div><div class="al-casillas">' + lista(bl, 'ambar') + '</div>' : '') +
      (mano.length ? '<div class="h2 al-h2">Lo revisa el administrador</div><div class="al-casillas">' + lista(mano, 'morado') + '</div>' : '') +
      (av.length ? '<div class="h2 al-h2">Observaciones</div><div class="al-casillas">' + lista(av, '') + '</div>' : '');
  }
  function pintarSol(){
    const d = SOL.d; const adm = !!d.es_admin; const k = d.etiqueta; const e = ETQ[k] || [k, ''];
    const h = $('hojaSol'); if(!h) return;
    h.querySelector('.hoja-cab b').textContent = d.cliente || 'Solicitud';
    h.querySelector('.hoja-cab small').textContent = [rifFmt(d.rif), d.codigo, adm ? d.aliado : ''].filter(Boolean).join(' · ');
    const aliadoPuede = !adm && k === 'recaudos';
    let acc = '';
    if(!adm){
      if(k === 'recaudos') acc = '<button type="button" class="btn btn-chico" data-acc="revisarDeNuevo">Revisar de nuevo</button><button type="button" class="btn btn-chico btn-2" data-form="excepcion">Pedir excepción</button><button type="button" class="btn btn-chico btn-2" data-acc="whats">Escribir al administrador</button>';
      else if(k === 'lista' || k === 'listaobs') acc = '<button type="button" class="btn btn-chico" data-form="curso">Marcar instalación en curso</button><button type="button" class="btn btn-chico btn-2" data-form="noinst">No se instaló</button>';
      else if(k === 'curso') acc = (d.fecha_instalacion && d.fecha_instalacion < window.Comun.hoyClave() ? '<button type="button" class="btn btn-chico" data-acc="yaInstale"' + (d.ya_instale_en ? ' disabled' : '') + '>' + (d.ya_instale_en ? 'Ya avisaste que instalaste' : 'Sí, ya instalé') + '</button>' : '<button type="button" class="btn btn-chico btn-2" data-form="curso">Cambiar fecha</button>') + '<button type="button" class="btn btn-chico btn-2" data-form="noinst">No se instaló</button>';
      else if(k === 'cartera') acc = '<button type="button" class="btn btn-chico" data-acc="referirSol" data-id="' + esc(d.id) + '">Referir cliente</button>';
      else if(k === 'excepcion' || k === 'revision') acc = '<button type="button" class="btn btn-chico btn-2" data-acc="whats">Escribir al administrador</button>';
    } else {
      if(k === 'excepcion') acc = '<button type="button" class="btn btn-chico" data-form="decidir" data-modo="aprobar">Admitir excepción</button><button type="button" class="btn btn-chico btn-2" data-form="decidir" data-modo="negar">Negar</button>';
      else if(k === 'revision') acc = '<button type="button" class="btn btn-chico" data-form="decidir" data-modo="aprobar">Aprobar</button><button type="button" class="btn btn-chico btn-2" data-form="decidir" data-modo="devolver">Pedir corregir</button>';
      else if(k === 'recaudos') acc = '<button type="button" class="btn btn-chico btn-2" data-form="decidir" data-modo="aprobar">Aprobar igual</button>';
      if(ABIERTA.indexOf(k) >= 0 && k !== 'borrador') acc += '<button type="button" class="btn btn-chico btn-2" data-form="decidir" data-modo="noprocede">No procede</button>';
      if(d.cliente_id) acc += '<button type="button" class="btn btn-chico btn-2" data-acc="expediente">Abrir expediente</button>';
    }
    const det = k === 'recaudos' ? 'Revisa lo marcado abajo. ' + SIGUE[k] : k === 'curso' && d.fecha_instalacion ? 'Instalas el ' + fecha(d.fecha_instalacion) + '. ' + SIGUE[k] : k === 'sininst' ? (d.motivo_cierre || '') + ' ' + SIGUE[k] : SIGUE[k] || '';
    $('cSol').innerHTML = (k === 'analizando' ? pasos(d) :
      '<div class="estado ' + (e[1] || 'al-gris') + '"><b>' + esc(e[0]) + '</b><small>' + esc(det) + '</small></div>' +
      (adm && d.bloqueo ? '<p class="nota">Bloqueo: ' + esc({ top: 'cliente TOP', cartera: 'cartera de un líder', grandes_negocios: 'Grandes negocios', servicio: 'ya tiene servicio', odoo: 'orden de Odoo abierta', otro_aliado: 'otro aliado lo pidió' }[d.bloqueo] || d.bloqueo) + (d.lider ? ' (' + esc(d.lider) + ')' : '') + '.</p>' : '') +
      (d.excepcion && d.excepcion.motivo ? '<div class="al-nota"><b>Excepción pedida' + (d.excepcion.punto ? ': ' + esc(d.excepcion.punto) : '') + '.</b> ' + esc(d.excepcion.motivo) + '</div>' : '') +
      (d.respuesta ? '<div class="al-nota"><b>Respuesta del administrador:</b> ' + esc(d.respuesta) + '</div>' : '') +
      (acc ? '<div class="al-acc">' + acc + '</div>' : '') +
      (adm && (k === 'lista' || k === 'listaobs') ? '<p class="nota">Correo de aprobación al aliado: pendiente, llega con las notificaciones.</p>' : '') +
      (k === 'cartera' || k === 'otro' ? '' : '<div class="h2 al-h2">Documentos</div>' + docsSol(d, aliadoPuede) + puntosSol(d)) +
      (aliadoPuede ? contactoSol(d) : '')) +
      '<div class="h2 al-h2">Historial</div><div class="al-hilo">' + (d.hilo || []).map((x) => '<div class="al-hi ' + esc(x.color) + '"><div>' + esc(x.texto) + '<small>' + esc(fecha(x.en) + ' ' + hora(x.en)) + '</small></div></div>').join('') + '</div>';
    if(k === 'analizando'){ sondeoS = setTimeout(() => { if(hojaAbierta() === 'hojaSol') cargarSol(); }, 3000); }
  }
  function contactoSol(d){
    const c = d.contacto || {}; const falta = ((d.ia && d.ia.puntos) || []).some((p) => /^falta_(correo|telefono|correo_empresa)_/.test(p.id));
    if(!falta) return '';
    const emp = d.tipo === 'empresa';
    const fila = (k, t, v, tipo) => '<label class="rotulo arriba" for="s_' + k + '">' + esc(t) + '</label><input class="campo" id="s_' + k + '" type="' + tipo + '" inputmode="' + (tipo === 'tel' ? 'tel' : 'email') + '" maxlength="120" value="' + esc(v || '') + '">';
    return '<div class="h2 al-h2">Contacto</div>' + fila('correo', emp ? 'Correo del representante' : 'Correo', c.correo, 'email') + fila('tel', emp ? 'Teléfono del representante' : 'Teléfono', c.telefono, 'tel') +
      (emp ? fila('correoEmp', 'Correo de la empresa', c.correo_empresa, 'email') : '') + '<div class="error" id="eContacto" role="alert"></div><div class="al-acc"><button type="button" class="btn btn-chico btn-2" data-acc="guardarContacto">Guardar contacto</button></div>';
  }

  // ---------- Formularios cortos ----------
  function abrirForm(tipo, extra){
    const h = hoja('hojaForm'); const d = SOL && SOL.d; const x = extra || {};
    let t = ''; let s = d ? d.cliente : ''; let cuerpo = ''; let boton = 'Guardar';
    if(tipo === 'excepcion'){
      const pts = [];
      ((d.ia && d.ia.marcas) || []).filter((m) => m.propuesta === 'problema').forEach((m) => { const doc = (d.docs || []).find((y) => y.id === m.documento); pts.push((doc ? casilla(doc.casilla, doc.numero) + ': ' : '') + (m.nota || '').replace(/\.$/, '')); });
      ((d.ia && d.ia.puntos) || []).filter((p) => p.estado === 'bloquea').forEach((p) => pts.push(p.titulo));
      t = 'Pedir excepción'; boton = 'Enviar pedido';
      cuerpo = '<label class="rotulo" for="fPunto">Qué quieres que se acepte</label><select class="campo" id="fPunto">' + pts.map((p) => '<option>' + esc(p.slice(0, 280)) + '</option>').join('') + '<option>Otro</option></select>' +
        '<label class="rotulo arriba" for="fTexto">Motivo</label><textarea class="campo al-area" id="fTexto" maxlength="1000" aria-describedby="eForm"></textarea><div class="error" id="eForm" role="alert"></div>' +
        '<p class="nota">Al administrador le llega tu pedido. La solicitud queda en espera hasta que responda.</p>';
    } else if(tipo === 'decidir'){
      const m = x.modo; t = { aprobar: d.etiqueta === 'excepcion' ? 'Admitir excepción' : 'Aprobar', negar: 'Negar excepción', devolver: 'Pedir corregir', noprocede: 'Marcar No procede' }[m]; boton = t;
      cuerpo = (d.excepcion && d.excepcion.motivo ? '<div class="al-nota"><b>' + esc(d.excepcion.punto || 'Excepción') + '.</b> ' + esc(d.excepcion.motivo) + '</div>' : '') +
        '<label class="rotulo arriba" for="fTexto">Respuesta para el aliado</label><textarea class="campo al-area" id="fTexto" maxlength="2000" aria-describedby="eForm"></textarea><div class="error" id="eForm" role="alert"></div>' +
        '<p class="nota">' + esc({ aprobar: 'Queda Lista para instalar y el aliado ve tu respuesta.', negar: 'Vuelve a Recaudos incompletos: el aliado puede seguir corrigiendo.', devolver: 'Vuelve a Recaudos incompletos con tu respuesta.', noprocede: 'Solo para casos puntuales: documentos de otro cliente o algo sin arreglo. El cliente queda libre.' }[m]) + ' Queda en la bitácora.</p>';
    } else if(tipo === 'curso'){
      t = 'Instalación en curso';
      const hoy = window.Comun.hoyClave();
      cuerpo = '<label class="rotulo" for="fFecha">Fecha en que vas a instalar</label><input class="campo" id="fFecha" type="date" min="' + hoy + '" value="' + esc(d.fecha_instalacion || hoy) + '" aria-describedby="eForm"><div class="error" id="eForm" role="alert"></div>' +
        '<p class="nota">El cliente queda reservado para ti. Si llega la fecha y no aparece la orden de instalación, te preguntamos si se instaló.</p>';
    } else if(tipo === 'noinst'){
      t = 'No se instaló'; boton = 'Confirmar';
      cuerpo = '<label class="rotulo" for="fMotivo">Motivo</label><select class="campo" id="fMotivo"><option value="desistio">El cliente desistió</option><option value="factibilidad">No hubo factibilidad</option><option value="tecnico">Problema técnico en la instalación</option><option value="otro">Otro</option></select>' +
        '<label class="rotulo arriba" for="fTexto">Qué pasó (si elegiste Otro)</label><textarea class="campo al-area" id="fTexto" maxlength="500" aria-describedby="eForm"></textarea><div class="error" id="eForm" role="alert"></div><p class="nota">El cliente queda libre para otros.</p>';
    } else if(tipo === 'referir'){
      const can = modo === 'canales'; t = can ? 'Cargar referido' : 'Referir cliente'; s = x.cliente || 'Pásalo a la oficina'; boton = can ? 'Cargar' : 'Referir';
      const c = (id, l, tp, v, dis) => '<label class="rotulo arriba" for="' + id + '">' + esc(l) + '</label><input class="campo" id="' + id + '" type="' + tp + '" maxlength="120" value="' + esc(v || '') + '"' + (dis ? ' disabled' : '') + '>';
      cuerpo = c('fRif', 'RIF del cliente', 'text', x.rif ? rifFmt(x.rif) : '', !!x.sol) + (can ? c('fNombre', 'Nombre', 'text') + c('fApellido', 'Apellido', 'text') + c('fTel', 'Teléfono', 'tel') + c('fCoord', 'Coordenadas', 'text') : c('fTel', 'Teléfono de contacto (opcional)', 'tel')) +
        '<div class="error" id="eForm" role="alert"></div><p class="nota">El referido le llega al administrador para aceptarlo. Se paga con dos residenciales cuando el cliente se instala.</p>';
    } else if(tipo === 'ref'){
      const r = refs().find((y) => y.id === x.id); if(!r) return;
      t = r.cliente || 'Referido'; s = [rifFmt(r.rif), r.codigo, r.aliado].join(' · '); boton = r.etiqueta === 'referido' && modo === 'admin' ? 'Aceptar referido' : '';
      cuerpo = '<div class="estado ' + (ETQ_RF[r.etiqueta][1] || 'al-gris') + '"><b>' + esc(ETQ_RF[r.etiqueta][0]) + '</b><small>' + esc(r.etiqueta === 'referido' ? 'Esperando respuesta del administrador.' : r.etiqueta === 'aceptado' ? 'Lo lleva ' + r.lider + '. Se paga cuando se instale.' : r.etiqueta === 'instalado' ? 'Instalado el ' + fecha(r.instalado_en) + '. ' + (r.horas >= 0 ? 'Quedan ' + r.horas + ' h para pagar.' : 'Pago atrasado.') : r.etiqueta === 'pagado' ? 'Pagado con dos residenciales.' : (r.respuesta || 'No se aceptó.')) + '</small></div>' +
        (r.telefono ? '<p class="nota">Teléfono del cliente: ' + esc(r.telefono) + (r.coordenadas ? ' · ' + esc(r.coordenadas) : '') + '</p>' : '') +
        (r.etiqueta === 'referido' && modo === 'admin' ? '<label class="rotulo arriba" for="fLider">Pasárselo a</label><select class="campo" id="fLider"><option value="">Elige el líder</option>' + ((D && D.lideres) || []).map((l) => '<option>' + esc(l) + '</option>').join('') + '</select>' +
          '<label class="rotulo arriba" for="fTexto">Si no lo aceptas, por qué</label><textarea class="campo al-area" id="fTexto" maxlength="1000"></textarea><div class="error" id="eForm" role="alert"></div>' : '');
    } else if(tipo === 'sinp'){
      const p = ((D && D.sin_permiso) || []).find((y) => y.id === x.id); if(!p) return;
      t = p.cliente || 'Instalación'; s = 'Instaló ' + (p.aliado || 'sin enlazar'); boton = p.revisado_en ? '' : 'Marcar revisado';
      cuerpo = '<div class="estado rojo"><b>Instalado sin permiso</b><small>' + esc((p.aliado || 'Un aliado') + ' lo instaló el ' + fecha(p.instalada_en, true) + ' sin una solicitud aprobada' + (p.origen === 'historico' ? ' (antes del módulo, no aparece en AppSheet).' : '.')) + '</small></div>' +
        (p.revisado_en ? '<p class="nota">Revisado el ' + esc(fecha(p.revisado_en, true)) + (p.nota ? ': ' + esc(p.nota) : '') + '</p>' : '<label class="rotulo arriba" for="fTexto">Nota (opcional)</label><textarea class="campo al-area" id="fTexto" maxlength="500"></textarea><div class="error" id="eForm" role="alert"></div><p class="nota">No entra en Pagos. Márcalo revisado cuando hables con el aliado.</p>');
    } else if(tipo === 'pagar'){
      t = 'Marcar pagado'; s = x.cliente || ''; boton = 'Marcar pagado';
      cuerpo = '<p class="nota">' + esc(x.tipo === 'referido' ? 'Referido pagado con dos residenciales.' : 'Instalación PYME del aliado pagada.') + ' Queda en la bitácora con tu nombre.</p><div class="error" id="eForm" role="alert"></div>';
    }
    h.dataset.tipo = tipo; h.dataset.extra = JSON.stringify(x);
    h.innerHTML = cab('hojaForm', t, s) + '<div class="hoja-cuerpo">' + cuerpo + '</div>' +
      '<div class="hoja-pie">' + (tipo === 'ref' && x && modo === 'admin' && boton ? '<button type="button" class="btn btn-2" data-acc="rechazarRef">No aceptar</button>' : '<button type="button" class="btn btn-2" data-cierra="1">' + (boton ? 'Cancelar' : 'Cerrar') + '</button>') + (boton ? '<button type="button" class="btn" data-acc="guardarForm">' + esc(boton) + '</button>' : '') + '</div>';
    abrirHoja('hojaForm');
  }
  const valor = (id) => { const el = $(id); return el ? String(el.value || '').trim() : ''; };
  async function guardarForm(b, rechazar){
    const h = $('hojaForm'); const tipo = h.dataset.tipo; const x = JSON.parse(h.dataset.extra || '{}'); const err = (m) => { const e = $('eForm'); if(e) e.textContent = m; b.disabled = false; };
    b.disabled = true;
    try {
      if(tipo === 'excepcion'){ const m = valor('fTexto'); if(m.length < 5) return err('Escribe el motivo (al menos 5 letras).'); await rpc('solicitud_excepcion', { p_sol: SOL.id, p_punto: valor('fPunto'), p_motivo: m }); toast('Pedido enviado. La respuesta queda en la solicitud'); }
      else if(tipo === 'decidir'){ const m = valor('fTexto'); if(m.length < 5) return err('Escribe la respuesta (al menos 5 letras).'); await rpc('solicitud_decidir', { p_sol: SOL.id, p_modo: x.modo, p_texto: m }); toast('Respuesta guardada en la bitácora'); }
      else if(tipo === 'curso'){ const f = valor('fFecha'); if(!f) return err('Escoge la fecha.'); await rpc('solicitud_instalacion', { p_sol: SOL.id, p_fecha: f }); toast('Cliente reservado hasta el ' + fecha(f)); }
      else if(tipo === 'noinst'){ const m = valor('fMotivo'); const n = valor('fTexto'); if(m === 'otro' && n.length < 5) return err('Escribe qué pasó (al menos 5 letras).'); await rpc('solicitud_no_instalo', { p_sol: SOL.id, p_motivo: m, p_nota: n || null }); toast('Listo. El cliente quedó libre'); }
      else if(tipo === 'referir'){
        const can = modo === 'canales';
        if(!x.sol && !/^[VEJGPC][-\s]?\d/i.test(valor('fRif'))) return err('Escribe el RIF con su letra, por ejemplo J-12345678-9.');
        if(can && (valor('fNombre').length < 2 || valor('fApellido').length < 2 || valor('fTel').replace(/\D/g, '').length < 10)) return err('Escribe nombre, apellido y teléfono.');
        await rpc('referido_crear', { p_rif: x.sol ? null : valor('fRif'), p_nombre: can ? valor('fNombre') : null, p_apellido: can ? valor('fApellido') : null, p_telefono: valor('fTel') || null, p_coordenadas: can ? valor('fCoord') || null : null, p_solicitud: x.sol || null });
        toast('Referido enviado al administrador');
      }
      else if(tipo === 'ref'){
        if(rechazar){ const m = valor('fTexto'); if(m.length < 5) return err('Escribe por qué no se acepta (al menos 5 letras).'); await rpc('referido_decidir', { p_ref: x.id, p_aceptar: false, p_lider: null, p_texto: m }); toast('Referido no aceptado'); }
        else { const l = valor('fLider'); if(!l) return err('Elige a qué líder se lo pasas.'); await rpc('referido_decidir', { p_ref: x.id, p_aceptar: true, p_lider: l, p_texto: null }); toast('Referido aceptado y pasado a ' + l); }
      }
      else if(tipo === 'sinp'){ await rpc('sin_permiso_revisar', { p_id: x.id, p_nota: valor('fTexto') || null }); toast('Marcado como revisado'); }
      else if(tipo === 'pagar'){ await rpc('pago_marcar', { p_tipo: x.tipo, p_id: x.id }); toast('Marcado como pagado'); pagos = null; }
    } catch (e) { return err(e.message); }
    cerrarHoja(true);
    if(tipo === 'referir' && hojaAbierta() === 'hojaNueva') cerrarHoja(true);
    invalidar(); if(SOL && hojaAbierta() === 'hojaSol') cargarSol(); cargar();
  }
  const invalidar = () => { D = null; cache.guardar(clave(), null); };

  // ---------- Eventos ----------
  document.addEventListener('click', async (ev) => {
    const t = ev.target; let b;
    if((b = t.closest('[data-tab]'))){ tab = b.dataset.tab; mostrar = POR_PAGINA; guardarUrl(); pintarTabs(); cargar(); return; }
    if((b = t.closest('[data-sol]'))){ if(hojaAbierta() === 'hojaNueva') cerrarHoja(true); abrirSol(Number(b.dataset.sol)); return; }
    if((b = t.closest('[data-ref]'))){ abrirForm('ref', { id: Number(b.dataset.ref) }); return; }
    if((b = t.closest('[data-sinp]'))){ abrirForm('sinp', { id: Number(b.dataset.sinp) }); return; }
    if((b = t.closest('[data-pagar]'))){ const l = b.dataset.pagar === 'referido' ? (pagos.referidos || []) : (pagos.instalaciones || []); const f = l.find((y) => String(y.id) === b.dataset.id) || {}; abrirForm('pagar', { tipo: b.dataset.pagar, id: Number(b.dataset.id), cliente: f.cliente }); return; }
    if((b = t.closest('[data-form]'))){ abrirForm(b.dataset.form, { modo: b.dataset.modo }); return; }
    if((b = t.closest('[data-tipon]'))){ if(!N || b.disabled) return; const tp = b.dataset.tipon; try { await rpc('solicitud_crear', { p_tipo: tp }); N.tipo = tp; N.cas = {}; N.estado = null; pintarNueva(); } catch (e) { toast(e.message, 'error'); } return; }
    if((b = t.closest('[data-subirn]'))){ if(b.disabled) return; const k = b.dataset.subirn; elegir((f) => (k === casillasN()[0][0] + ':' + casillasN()[0][1] && N.estado !== 'libre' ? leerRif(f) : subirN(k, f))); return; }
    if((b = t.closest('[data-subirs]'))){ const k = b.dataset.subirs.split(':'); const d = SOL.d; elegir(async (f) => { b.disabled = true; b.textContent = 'Subiendo…'; try { await subir(d.cliente_id, f, k[0], Number(k[1])); toast('Subido. Cuando termines, toca Revisar de nuevo'); } catch (e) { toast(e.message, 'error'); } cargarSol(); }); return; }
    if(!(b = t.closest('[data-acc]'))) return;
    const a = b.dataset.acc;
    if(a === 'nueva') abrirNueva();
    else if(a === 'referir') abrirForm('referir', {});
    else if(a === 'referirSol'){ const id = Number(b.dataset.id); const d = SOL && SOL.d && SOL.d.id === id ? SOL.d : null; abrirForm('referir', { sol: id, rif: d ? d.rif : N && N.rif, cliente: d ? d.cliente : N && N.nombre }); }
    else if(a === 'reintentar') cargar();
    else if(a === 'reintentarSol') cargarSol();
    else if(a === 'mas'){ mostrar += POR_PAGINA; pintar(); }
    else if(a === 'excel') excel();
    else if(a === 'masAsamblea'){ N.asambleas = Math.min(4, N.asambleas + 1); pintarNueva(); }
    else if(a === 'masRep'){ N.reps = Math.min(4, N.reps + 1); pintarNueva(); }
    else if(a === 'enviarN') enviarN();
    else if(a === 'guardarForm') guardarForm(b, false);
    else if(a === 'rechazarRef') guardarForm(b, true);
    else if(a === 'whats'){ const d = SOL && SOL.d; window.open(enlaceWa('', 'Hola, sobre la solicitud ' + (d ? d.codigo + ' de ' + d.cliente : '') + ':'), '_blank', 'noopener'); }
    else if(a === 'expediente'){ const d = SOL.d; window.Ficha.abrir(d.cliente_id, { yo, tab: 'documentos' }); }
    else if(a === 'yaInstale'){ b.disabled = true; try { await rpc('solicitud_ya_instale', { p_sol: SOL.id }); toast('Anotado. Pasa a Instalada cuando llegue la orden'); } catch (e) { toast(e.message, 'error'); } cargarSol(); }
    else if(a === 'revisarDeNuevo'){ b.disabled = true; b.textContent = 'Enviando…'; try { await rpc('solicitud_enviar', { p_sol: SOL.id }); invalidar(); } catch (e) { toast(e.message, 'error'); } cargarSol(); }
    else if(a === 'guardarContacto'){
      b.disabled = true; $('eContacto').textContent = '';
      try { await guardarContacto(SOL.id, { correo: valor('s_correo'), tel: valor('s_tel'), correoEmp: valor('s_correoEmp') }, SOL.d.tipo); toast('Contacto guardado. Toca Revisar de nuevo'); }
      catch (e) { $('eContacto').textContent = e.message; }
      b.disabled = false;
    }
  });
  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if(el.dataset && el.dataset.campon && N){ N.c[el.dataset.campon] = el.value; if(N.err[el.dataset.campon]){ delete N.err[el.dataset.campon]; const e = $('e_' + el.dataset.campon); if(e) e.textContent = ''; el.removeAttribute('aria-invalid'); } pintarPieNueva(); }
    if(el.id === 'fTexto' && $('eForm')) $('eForm').textContent = '';
  });
  document.addEventListener('change', (ev) => { const el = ev.target; if(el.dataset && el.dataset.enlazar) enlazar(el); });
  $('alArchivo').addEventListener('change', () => { const f = ($('alArchivo').files || [])[0]; const fn = destino; destino = null; if(f && fn) fn(f); });
  document.addEventListener('visibilitychange', () => { if(!document.hidden && yo && !hojaAbierta()) cargar(); });
  document.addEventListener('hoja-cerrada', () => {});

  (async function(){
    yo = await S.requerir(['admin', 'aliado', 'analista', 'lider', 'abogado']);
    if(!yo) return;
    modo = yo.rol === 'admin' ? 'admin' : yo.rol === 'aliado' ? 'aliado' : yo.rol === 'analista' && yo.canales ? 'canales' : 'equipo';
    window.Armazon.montar(yo, { activo: 'aliados' });
    if(window.Ficha && modo === 'admin'){ window.Ficha.montar(); }
    $('titulo').textContent = modo === 'equipo' ? 'Instalados por aliados' : modo === 'admin' ? 'Aliados comerciales' : 'Hola, ' + (window.Comun.primerNombre(yo.nombre) || yo.nombre);
    leerUrl(); pintarTabs(); cargar();
    const s = Number(new URLSearchParams(location.search).get('s')) || 0;
    if(s && modo !== 'equipo') abrirSol(s);
  })();
})();
