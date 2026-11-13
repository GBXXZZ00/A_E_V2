// Aliados comerciales: el aliado pide un cliente subiendo sus documentos (el RIF se lee primero y dice si está disponible),
// la IA revisa el resto y él sigue cada paso con etiquetas. El administrador decide excepciones, referidos y el buzón;
// la coordinación de canales paga instalaciones y referidos; el equipo ve los instalados por aliados.
(function(){
  'use strict';
  const { $, esc, ic, rpc, toast, vacio, esqueleto, abrirHoja, cerrarHoja, hojaAbierta, fecha, hora, plural, docFmt, casilla, enlaceWa, cache, capital, normalizeStr } = window.Comun;
  const S = window.Sesion;
  const POR_PAGINA = 40;
  const MAX = 15 * 1024 * 1024;
  const TIPOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

  // Etiquetas: el color es solo para el estado
  const ETQ = {
    borrador: ['Sin enviar', 'ambar'], analizando: ['Recibido, en revisión', 'azul'], recaudos: ['Recaudos incompletos', 'ambar'], excepcion: ['Excepción solicitada', 'morado'],
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
  let pedido = 0; let mostrar = POR_PAGINA; let sondeo = null; let chipSol = 'todas'; let avAl = null;

  // ---------- Secciones según el rol ----------
  const TABS = {
    aliado: [['inicio', 'Inicio'], ['solicitudes', 'Mis solicitudes'], ['avisos', 'Avisos'], ['referidos', 'Referidos']],
    // Lote 3: "Instalados por aliados" quedó dentro de "Por mes"; lo instalado sin consultar va solo en "Sin autorización"
    canales: [['inicio', 'Inicio'], ['solicitudes', 'Mis solicitudes'], ['referidos', 'Referidos'], ['registro', 'Registro'], ['mes', 'Por mes'], ['sinp', 'Sin autorización'], ['pagos', 'Pagos']],
    admin: [['registro', 'Solicitudes'], ['mes', 'Por mes'], ['sinp', 'Sin autorización'], ['pagos', 'Pagos'], ['aliados', 'Aliados y usuarios']],
    equipo: [['registro', 'Registro'], ['mes', 'Por mes'], ['sinp', 'Sin autorización']]
  };
  const AYUDA = {
    inicio: 'Sube los documentos del cliente y en minutos sabes si puedes instalarlo.', solicitudes: 'Todas tus solicitudes con su etiqueta.', avisos: 'Cada aviso abre su solicitud.',
    referidos: 'Clientes que pasaste a la oficina. Se pagan con dos residenciales cuando se instalan.',
    para_ti: 'Excepciones, revisiones, referidos e instalaciones sin permiso que esperan tu respuesta.', analizando: 'La IA las está revisando.',
    recaudos: 'El aliado debe completar o corregir.', listas: 'Aprobadas: el aliado puede instalar.', curso: 'El aliado marcó cuándo va a instalar.',
    instaladas: 'Llegó la orden de instalación.', cerradas: 'No se instalaron o no proceden. El cliente quedó libre.',
    bloq: 'Pidieron un cliente que ya es de la oficina o que otra persona gestiona.', refs: 'Clientes referidos por los aliados.',
    sinp: 'Instalaciones de aliados hechas sin consultar (sin solicitud aprobada). Llegan solas con cada carga de órdenes de instalación. Revisa cada una y deja una nota.',
    viejas: 'Los casos de la app vieja (AppSheet), con su situación.', pagos: 'Solo PYME instaladas por el mismo aliado de la solicitud, y referidos instalados. Aparte del corte de los líderes.',
    instalados: 'Clientes que instalaron los aliados. Solo para ver.',
    mes: 'Todo lo que instalaron los aliados, por mes desde enero, con o sin permiso. Aparte de las comisiones de los líderes.',
    registro: 'Lo que espera tu decisión va primero. Toca un registro para revisarlo.', aliados: 'Enlaza cada aliado con su usuario. Los usuarios se crean en Usuarios con el rol Aliado.'
  };
  const tabs = () => TABS[modo] || [];

  // Lote 12/11 B (maqueta 9): el administrador elige el mes (como Comisiones) y el aliado; aplica a Solicitudes, Por mes, Sin autorización y Pagos
  const mesHoy = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  let mesAl = mesHoy(); let aliadoF = '';
  function leerUrl(){
    const u = new URLSearchParams(location.search); const t = u.get('t');
    tab = tabs().some((x) => x[0] === t) ? t : tabs()[0][0];
    if(/^\d{4}-(0[1-9]|1[0-2])$/.test(u.get('m') || '')) mesAl = u.get('m');
    aliadoF = (u.get('al') || '').slice(0, 80);
  }
  function guardarUrl(){
    const u = new URLSearchParams(); if(tab !== tabs()[0][0]) u.set('t', tab);
    if(modo === 'admin'){ if(mesAl !== mesHoy()) u.set('m', mesAl); if(aliadoF) u.set('al', aliadoF); }
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
    // Lote 12/11 (maqueta aliados, A): el administrador ve una bandeja; lo demás son enlaces arriba
    if(modo === 'admin'){
      $('filtros').innerHTML = '';
      $('titulo').textContent = tab === 'registro' ? 'Aliados comerciales' : (tabs().find((x) => x[0] === tab) || ['', 'Aliados'])[1];
      $('ayuda').textContent = tab === 'registro' ? 'Solicitudes, instalaciones y pagos de los aliados' : AYUDA[tab] || '';
      $('zonaRegistro').classList.toggle('hidden', tab !== 'registro');
      const conMes = ['registro', 'mes', 'sinp', 'pagos'].indexOf(tab) >= 0;
      const alis = Array.from(new Set(((R && R.solicitudes) || []).concat((R && R.referidos) || []).map((x) => String(x.aliado || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
      $('accionCab').innerHTML = conMes ? '<div class="al-mesbar"><div class="al-mes"><button type="button" data-mesal="-1" aria-label="Mes anterior">' + ic('izquierda') + '</button><b>' + esc(window.Comun.capital(nomMes(mesAl + '-15'))) + '</b>' +
          '<button type="button" data-mesal="1" aria-label="Mes siguiente"' + (mesAl >= mesHoy() ? ' disabled' : '') + '>' + ic('derecha') + '</button></div>' +
          '<label class="solo-lector" for="alAliadoF">Aliado</label><select class="al-sel" id="alAliadoF"><option value="">Aliado: todos</option>' + alis.map((n) => '<option value="' + esc(n) + '"' + (aliadoF === n ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select></div>' : '';
      $('filtros').innerHTML = '<span class="al-enl">' + tabs().filter((x) => x[0] !== tab).map((x) => { const c = cuenta(x[0]);
        return '<button type="button" class="enlace" data-tab="' + x[0] + '">' + esc(x[0] === 'registro' ? 'Volver a solicitudes' : x[1]) + (c ? ' (' + c + ')' : '') + '</button>'; }).join('') +
        (tab === 'registro' && R && R.puedo && R.puedo.prueba ? '<button type="button" class="btn btn-chico btn-2" data-acc="nueva">Solicitud de prueba</button><button type="button" class="btn btn-chico btn-2" data-acc="avisosDemo">Ver los avisos</button>' : '') + '</span>';
      return;
    }
    $('filtros').innerHTML = tabs().length > 1 ? tabs().map((x) => { const c = cuenta(x[0]);
      return '<button type="button" data-tab="' + x[0] + '" class="' + (x[0] === tab ? 'on' : '') + '" aria-pressed="' + (x[0] === tab) + '">' + esc(x[1]) + (c !== null ? ' <em>' + c + '</em>' : '') + '</button>'; }).join('') : '';
    document.querySelector('main.pagina').classList.toggle('al-en-inicio', tab === 'inicio');   // maqueta aliado-flujo: el inicio va sin pestañas ni texto de ayuda
    if(holaTx && (modo === 'aliado' || modo === 'canales')) $('titulo').textContent = tab === 'inicio' ? holaTx : (tabs().find((x) => x[0] === tab) || ['', holaTx])[1];
    $('ayuda').textContent = (AYUDA[tab] || '') + (tab === 'registro' && modo !== 'admin' ? ' Solo para ver: las decisiones las toma el administrador.' : '');
    $('zonaRegistro').classList.toggle('hidden', tab !== 'registro');
    $('accionCab').innerHTML = (modo === 'aliado' || modo === 'canales') && tab !== 'inicio' && tab !== 'pagos' && tab !== 'instalados' && tab !== 'mes' && tab !== 'sinp' ? '<button type="button" class="btn btn-chico solo-pc" data-acc="nueva">+ Nuevo cliente</button>'
      : modo === 'admin' && tab === 'registro' && R && R.puedo && R.puedo.prueba ? '<button type="button" class="btn btn-chico btn-2" data-acc="nueva">Solicitud de prueba</button><button type="button" class="btn btn-chico btn-2" data-acc="avisosDemo">Ver los avisos</button>' : '';
  }
  const clave = () => 'aliados:' + modo;
  async function cargar(){
    const mio = ++pedido; clearTimeout(sondeo);
    if(tab === 'pagos') return cargarPagos(mio);
    if(tab === 'instalados') return cargarInstalados(mio);
    if(tab === 'mes') return cargarMes(mio);
    if(tab === 'aliados') return cargarAliadosAdm(mio);
    if((tab === 'registro' || tab === 'sinp') && modo !== 'admin') return cargarRegistro(mio);
    if(!D){ const g = cache.leer(clave()); if(g){ D = g; pintarTabs(); pintar(); } else { $('lista').innerHTML = esqueleto(6); $('cuentaLista').textContent = 'Cargando…'; } }
    try {
      const d = await rpc(modo === 'admin' ? 'aliados_registro' : 'aliado_inicio', {});
      if(mio !== pedido) return;
      D = d; if(modo === 'admin') R = d; cache.guardar(clave(), d); pintarTabs(); pintar(); vigilar(); revisarCambios();
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

  // ---------- Lote 10/11 E7: Avisos del aliado (historial; cada uno abre su solicitud) ----------
  async function cargarAvisosAl(){
    try { const a = await rpc('avisos_grupo', { p_tipo: 'aliado', p_limite: 60 }).catch(() => []); const b = await rpc('avisos_grupo', { p_tipo: 'aliado_pago', p_limite: 30 }).catch(() => []);
      avAl = [].concat(a || [], b || []).sort((x, y) => String(y.en || y.creado_en).localeCompare(String(x.en || x.creado_en))); }
    catch (e) { avAl = []; toast(e.message, 'error'); }
    if(tab === 'avisos') pintar();
  }
  function pintarAvisosAl(){
    if(avAl === null){ cargarAvisosAl(); return esqueleto(4); }
    if(!avAl.length) return vacio('Sin avisos todavía', 'Aquí queda cada resultado, decisión y pago. Cada aviso abre su solicitud.');
    const tono = (x) => /aprob|lista|pago|instal/i.test(x.titulo) ? 'verde' : /sin enviar|falta|devolv|bloque/i.test(x.titulo + x.texto) ? 'ambar' : /revis/i.test(x.titulo) ? 'morado' : '';
    return '<div class="al-avisos">' + avAl.map((x) => { const m = /[?&]s=(\d+)/.exec(x.enlace || ''); const cu = x.en || x.creado_en;
      return '<button type="button" class="al-av"' + (m ? ' data-sol="' + m[1] + '"' : '') + '><i class="pt ' + tono(x) + '" aria-hidden="true"></i><span><b>' + esc(x.titulo) + '</b><small>' + esc(x.texto || '') + '</small></span><small class="cu">' + esc(cu ? fecha(cu) + ' ' + hora(cu) : '') + '</small></button>'; }).join('') + '</div>';
  }

  const delMes = (x) => x.etiqueta === 'instalada' && String(x.instalada_en || '').slice(0, 7) === new Date().toISOString().slice(0, 7);
  // ---------- Listas ----------
  function filaSol(s){
    const sub = [rifFmt(s.rif), s.codigo, modo === 'admin' ? s.aliado : ''].filter(Boolean).join(' · ');
    const cuando = s.etiqueta === 'curso' && s.fecha_instalacion ? 'Instala el ' + fecha(s.fecha_instalacion) : s.etiqueta === 'instalada' && s.instalada_en ? 'Instalada el ' + fecha(s.instalada_en) : 'Desde el ' + fecha(s.creada_en);
    return '<div class="rv"><button type="button" class="rv-cuerpo" data-sol="' + esc(s.id) + '">' +
      '<span class="quien"><span class="mono" aria-hidden="true">' + esc(String(s.cliente || 'S').charAt(0)) + '</span><span><b>' + esc(s.cliente || 'RIF por leer') + '</b><small>' + esc(sub) + '</small></span></span>' +
      '<span class="rv-chips">' + (s.etiqueta === 'borrador' ? '<span class="chip punto ambar">' + esc('Sin enviar' + (s.faltan ? ' · ' + (s.faltan === 1 ? 'falta 1' : 'faltan ' + s.faltan) : '')) + '</span>' : chip(s.etiqueta)) + (s.pagada_en ? '<span class="chip">Pagada</span>' : '') + '</span>' +
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
    if(tab === 'registro' || tab === 'sinp'){ if(modo === 'admin') R = D; pintarRegistro(); return; }
    const s = sols(); let h = ''; let n = 0;
    const de = (f) => s.filter(f);
    if(tab === 'inicio'){
      // Lote 12/11 (maqueta aliado-flujo, 1): una sola acción y debajo solo lo que necesita de él
      const sig = de((x) => x.etiqueta === 'borrador' || x.etiqueta === 'recaudos'); const lst = de((x) => x.etiqueta === 'lista' || x.etiqueta === 'listaobs');
      const rev = de((x) => ['analizando', 'revision', 'excepcion'].indexOf(x.etiqueta) >= 0);
      const tarjeta = (x, cls, t, sub, acc) => '<button type="button" class="al-tc ' + cls + '" data-sol="' + esc(x.id) + '"><span class="al-tc-k"><b>' + esc(t) + '</b>' + chip(x.etiqueta === 'borrador' ? 'borrador' : x.etiqueta).replace('chip punto', 'chip') + '</span><small>' + esc(sub) + '</small>' + (acc ? '<span class="enlace">' + esc(acc) + '</span>' : '') + '</button>';
      h = '<button type="button" class="al-nuevo" data-acc="nueva">+ Nuevo cliente</button>' +
        sig.map((x) => tarjeta(x, 'am', x.etiqueta === 'borrador' ? 'Sigue donde quedaste' : 'Falta corregir algo', (x.cliente || 'RIF por leer') + (x.faltan ? ' · ' + (x.faltan === 1 ? 'falta 1' : 'faltan ' + x.faltan) : ''), 'Continuar')).join('') +
        lst.map((x) => tarjeta(x, 've', x.cliente || 'Cliente', 'Ya puedes instalar · marca la fecha', 'Marcar instalación')).join('') +
        rev.map((x) => tarjeta(x, '', x.cliente || 'Cliente', x.etiqueta === 'analizando' ? 'La revisión automática está en curso · te avisamos' : 'El administrador lo está revisando · te avisamos', '')).join('') +
        (sig.length + lst.length + rev.length ? '' : '<p class="nota al-nada">No tienes nada pendiente. Cuando registres un cliente, aquí ves en qué va.</p>') +
        '<div class="al-ini-pie"><button type="button" class="enlace" data-tab="solicitudes">Ver todas mis solicitudes (' + s.length + ')</button><button type="button" class="enlace" data-acc="referir">Referir un cliente a la oficina</button></div>';
      n = sig.length + lst.length + rev.length;
    } else if(tab === 'solicitudes'){
      // Lote 10/11 E: chips Todas, Sin enviar, Listas, Revisión
      const CH = [['todas', 'Todas', () => true], ['sin', 'Sin enviar', (x) => x.etiqueta === 'borrador'], ['listas', 'Listas', (x) => x.etiqueta === 'lista' || x.etiqueta === 'listaobs'], ['rev', 'Revisión', (x) => ['analizando', 'revision', 'excepcion', 'recaudos'].indexOf(x.etiqueta) >= 0], ['inst', 'Instaladas del mes', delMes]];
      const cf = (CH.find((c) => c[0] === chipSol) || CH[0]); const l = s.filter(cf[2]);
      h = '<div class="cx-chips al-chips">' + CH.map((c) => '<button type="button" class="cx-chip' + (c[0] === cf[0] ? ' on' : '') + '" data-chipsol="' + c[0] + '" aria-pressed="' + (c[0] === cf[0]) + '">' + c[1] + ' <span>' + s.filter(c[2]).length + '</span></button>').join('') + '</div>' + paginar(l, filaSol, ['Todavía no tienes solicitudes', 'Toca Nueva solicitud y sube los documentos del cliente.', '<button type="button" class="btn btn-chico" data-acc="nueva">Nueva solicitud</button>']); n = l.length; }
    else if(tab === 'avisos'){ h = pintarAvisosAl(); n = (avAl || []).length; }
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
  // ---------- Registro: todo agrupado por aliado (C1 a C6) ----------
  let R = null; let chipAl = 'todo'; let chipIni = false; let holaTx = ''; let buscaAl = ''; const abiertosAl = {}; const masAl = {};
  async function cargarRegistro(mio){
    if(!R){ const g = cache.leer('aliados:registro:' + modo); if(g){ R = g; pintarRegistro(); } else { $('lista').innerHTML = esqueleto(6); $('cuentaLista').textContent = 'Cargando…'; } }
    try { const d = await rpc('aliados_registro', {}); if(mio !== pedido) return; R = d; cache.guardar('aliados:registro:' + modo, d); pintarRegistro(); }
    catch (e) { if(mio !== pedido) return; if(!R) $('lista').innerHTML = errorCaja('No se pudo cargar el registro', e.message); toast(e.message, 'error'); }
  }
  const fuente = () => (tab === 'registro' && R ? R : D) || {};
  function itemsAl(){
    const r = R || {}; const it = [];
    (r.solicitudes || []).forEach((x) => it.push({ t: 'sol', id: x.id, aliado: x.aliado, cliente: x.cliente || 'RIF por leer', rif: rifFmt(x.rif), fecha: x.actualizada_en || x.creada_en, k: x.etiqueta, x, tu: !!x.tu_cliente }));
    (r.referidos || []).forEach((x) => it.push({ t: 'ref', id: x.id, aliado: x.aliado, cliente: x.cliente || 'Cliente ' + rifFmt(x.rif), rif: rifFmt(x.rif), fecha: x.pagado_en || x.instalado_en || x.creado_en, k: 'rf', x, tu: !!x.tu_cliente }));
    (r.viejas || []).forEach((x) => it.push({ t: 'vieja', id: x.id, aliado: x.aliado, cliente: x.cliente || 'Sin nombre', rif: x.rif || '', fecha: null, k: 'vieja', x, tu: !!x.tu_cliente }));
    it.forEach((i) => { i.aliado = String(i.aliado || 'Sin aliado').trim() || 'Sin aliado'; });
    return it;
  }
  const paraTi = (i) => !i.x.revisado && ((i.t === 'sol' && (i.k === 'excepcion' || i.k === 'revision')) || (i.t === 'ref' && i.x.etiqueta === 'referido'));
  const CHIPS_AL = [
    ['todo', 'Todo', () => true], ['para_ti', 'Esperan tu decisión', paraTi], ['mio', 'Lo mío', (i) => i.tu],
    ['sin', 'Sin enviar', (i) => i.t === 'sol' && i.k === 'borrador'],
    ['encurso', 'En curso', (i) => i.t === 'sol' && ['analizando', 'recaudos', 'lista', 'listaobs', 'curso'].indexOf(i.k) >= 0],   // Lote 10/11 E12: quién se quedó a medias
    ['analizando', 'En revisión', (i) => i.t === 'sol' && i.k === 'analizando'], ['recaudos', 'Recaudos incompletos', (i) => i.t === 'sol' && i.k === 'recaudos'],
    ['decidir', 'Excepción o revisión', (i) => i.t === 'sol' && (i.k === 'excepcion' || i.k === 'revision')], ['listas', 'Listas para instalar', (i) => i.t === 'sol' && (i.k === 'lista' || i.k === 'listaobs')],
    ['curso', 'Instalación en curso', (i) => i.t === 'sol' && i.k === 'curso'], ['instaladas', 'Instaladas', (i) => i.t === 'sol' && i.k === 'instalada'],
    ['cerradas', 'Sin instalar o no procede', (i) => i.t === 'sol' && (i.k === 'sininst' || i.k === 'noprocede')], ['bloq', 'Bloqueadas', (i) => i.t === 'sol' && (i.k === 'cartera' || i.k === 'otro')],
    ['refs', 'Referidos', (i) => i.t === 'ref'], ['viejas', 'Consultas viejas', (i) => i.t === 'vieja']
  ];
  const visto = () => { try { return JSON.parse(localStorage.getItem('ae_al_visto_' + (yo && yo.id)) || 'null'); } catch (e) { return null; } };
  const guardarVisto = (v) => { try { localStorage.setItem('ae_al_visto_' + (yo && yo.id), JSON.stringify(v)); } catch (e) {} };
  function chipItem(i){
    if(i.t === 'sol') return chip(i.k);
    if(i.t === 'ref') return chipRf(i.x.etiqueta);
    if(i.t === 'sinp') return i.x.revisado_en ? '<span class="chip">Sin permiso, revisado</span>' : '<span class="chip punto rojo">Instalado sin permiso</span>';
    return '<span class="chip punto ' + (/^instalado/.test(i.x.situacion) ? 'verde' : i.x.situacion === 'consulta' ? '' : 'ambar') + '">' + esc((VIEJA[i.x.situacion] || i.x.situacion) + ' (app vieja)') + '</span>';
  }
  const TIPO_AL = { sol: 'Solicitud', ref: 'Referido', sinp: 'Instalación', vieja: 'Consulta vieja' };
  function filaAl(i, conAliado){
    const dato = 'data-' + (i.t === 'vieja' ? 'vieja' : i.t) + '="' + esc(i.id) + '"';
    const sub = [conAliado ? i.aliado : '', TIPO_AL[i.t], i.rif, i.fecha ? fecha(i.fecha) : '', i.t === 'sinp' && i.x.origen === 'historico' ? 'Antes del módulo' : ''].filter(Boolean).join(' · ');
    return '<button type="button" class="fila" ' + dato + '><span class="tx"><b>' + esc(i.cliente) + '</b><small>' + esc(sub) + '</small>' + (i.tu ? '<small class="etqs"><span class="tagn azul">Tu cliente</span></small>' : '') + '</span>' +
      '<span class="par-m">' + chipItem(i) + '</span></button>';
  }
  // Sin autorización: instalaciones de aliados sin solicitud aprobada, las que faltan por revisar primero
  function pintarSinp(){
    const sp = (R.sin_permiso || []).filter((p) => modo !== 'admin' || ((!aliadoF || String(p.aliado || '').trim() === aliadoF) && String(p.instalada_en || '').slice(0, 7) === mesAl)).sort((x, y) => Number(!!x.revisado_en) - Number(!!y.revisado_en) || String(y.instalada_en || '').localeCompare(String(x.instalada_en || '')));
    const pend = sp.filter((p) => !p.revisado_en).length;
    $('cuentaLista').textContent = plural(sp.length, 'instalación', 'instalaciones') + (pend ? ' · ' + plural(pend, 'por revisar', 'por revisar') : '');
    $('lista').innerHTML = paginar(sp, filaSinp, ['Ninguna', 'Todo lo que instalaron los aliados tenía permiso.']);
  }
  function pintarRegistro(){
    if(!R || (tab !== 'registro' && tab !== 'sinp')) return;   // el buscador espera un momento: no repinta otra pestaña
    if(tab === 'sinp') return pintarSinp();
    const todosT = itemsAl(); const P = R.puedo || {};
    // El administrador ve el mes elegido y el aliado elegido; lo que espera su decisión sale aunque sea de otro mes
    const fechaAlta = (i) => String(i.x.creada_en || i.x.creado_en || i.fecha || '').slice(0, 7);
    // Con algo escrito en el buscador se busca en todos los meses (también lo de la app vieja)
    const todos = modo !== 'admin' ? todosT : todosT.filter((i) => (!aliadoF || i.aliado === aliadoF) && (buscaAl ? true : chipAl === 'viejas' ? i.t === 'vieja' : i.t !== 'vieja' && (paraTi(i) || fechaAlta(i) === mesAl)));
    const chips = CHIPS_AL.filter((c) => (c[0] !== 'para_ti' || P.decidir) && (c[0] !== 'mio' || modo !== 'admin'));
    if(!chips.some((c) => c[0] === chipAl)) chipAl = 'todo';
    if(modo === 'admin' && !chipIni){ chipIni = true; if(P.decidir && todos.filter(paraTi).length) chipAl = 'para_ti'; }
    const pend = todos.filter(paraTi).length;
    if(modo === 'admin'){
      // Números del mes (maqueta 9): sin repetir lo que ya dice el Resumen
      const sm = todos.filter((i) => i.t === 'sol' && fechaAlta(i) === mesAl);
      const apro = sm.filter((i) => ['lista', 'listaobs', 'curso', 'instalada'].indexOf(i.k) >= 0).length; const neg = sm.filter((i) => i.k === 'noprocede').length;
      const inst = sm.filter((i) => i.k === 'instalada').length;
      const sp = (R.sin_permiso || []).filter((x) => (!aliadoF || String(x.aliado || '').trim() === aliadoF) && String(x.instalada_en || '').slice(0, 7) === mesAl);
      const spPend = sp.filter((x) => !x.revisado_en).length;
      const k = (cls, t, n, sub, dato) => '<button type="button" class="al-kpi' + cls + '"' + dato + '><span>' + esc(t) + '</span><b>' + n + '</b><small>' + esc(sub) + '</small></button>';
      $('avisoAl').innerHTML = '<div class="al-kpis">' + k(' prin', 'Esperan tu decisión', pend, 'excepciones y revisiones', ' data-chipal="para_ti"') + k('', 'Solicitudes del mes', sm.length, plural(apro, 'aprobada', 'aprobadas') + ' · ' + plural(neg, 'negada', 'negadas'), ' data-chipal="todo"') +
        k('', 'Instaladas', inst + sp.length, inst + ' con permiso', ' data-chipal="instaladas"') + k('', 'Sin autorización', sp.length, spPend + ' por revisar', ' data-tab="sinp"') + '</div>';
    } else $('avisoAl').innerHTML = P.decidir && pend && chipAl !== 'para_ti' ? '<button type="button" class="franja ambar" data-chipal="para_ti">' + ic('alerta') + '<span><b>' + plural(pend, 'espera tu decisión', 'esperan tu decisión') + '</b>Excepciones, revisiones y referidos. Si ya lo resolviste por fuera, márcalo Revisado.</span>' + ic('derecha') + '</button>' : '';
    $('vistaAl').innerHTML = '<div class="tres dos" role="radiogroup" aria-label="Cómo ver el registro">' + [['general', 'Todo junto'], ['aliado', 'Por aliado']].map((x) =>
      '<button type="button" role="radio" data-vistaal="' + x[0] + '" aria-checked="' + (verAl === x[0]) + '" class="' + (verAl === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div>';
    // Lote 12/11 (maqueta aliados, A): Esperan tu decisión, En curso, Sin enviar y Todas; el resto en "Más filtros"
    const PRIN = modo === 'admin' ? ['para_ti', 'encurso', 'sin', 'instaladas', 'todo'] : chips.map((c) => c[0]).filter((k) => k === 'todo' || k === chipAl || todos.filter(chips.find((c) => c[0] === k)[2]).length);
    const btnC = (c) => { const n = todos.filter(c[2]).length; return '<button type="button" data-chipal="' + c[0] + '" class="' + (c[0] === chipAl ? 'on' : '') + '" aria-pressed="' + (c[0] === chipAl) + '">' + esc(c[0] === 'todo' ? 'Todas' : c[1]) + ' <em>' + n + '</em></button>'; };
    const otrosC = chips.filter((c) => PRIN.indexOf(c[0]) < 0 && (todos.filter(c[2]).length || c[0] === chipAl));
    $('chipsAl').innerHTML = PRIN.map((k) => chips.find((c) => c[0] === k)).filter(Boolean).map(btnC).join('') + (otrosC.some((c) => c[0] === chipAl) ? btnC(chips.find((c) => c[0] === chipAl)) : '') +
      (otrosC.length ? '<details class="cx-mas"><summary>Más filtros</summary><div class="cx-menu">' + otrosC.filter((c) => c[0] !== chipAl).map(btnC).join('') + '</div></details>' : '');
    const f = chips.find((c) => c[0] === chipAl)[2]; const b = window.Comun.normalizeStr(buscaAl); const dg = buscaAl.replace(/\D/g, '');
    const lista = todos.filter(f).filter((i) => !b || window.Comun.normalizeStr(i.cliente).indexOf(b) >= 0 || window.Comun.normalizeStr(i.aliado).indexOf(b) >= 0 || (dg.length >= 4 && String(i.rif).replace(/\D/g, '').indexOf(dg) >= 0));
    if(verAl === 'general') return modo === 'admin' ? pintarSemanas(lista) : pintarGeneral(lista, todos);
    // Grupos por aliado, ordenados por el registro más reciente
    const g = {}; lista.forEach((i) => { (g[i.aliado] = g[i.aliado] || []).push(i); });
    const ultimo = (l) => l.reduce((a, i) => (i.fecha && i.fecha > a ? i.fecha : a), '');
    Object.keys(g).forEach((k) => g[k].sort((x, y) => String(y.fecha || '').localeCompare(String(x.fecha || ''))));
    const orden = Object.keys(g).sort((x, y) => ultimo(g[y]).localeCompare(ultimo(g[x])) || x.localeCompare(y));
    let v = visto(); if(!v){ v = {}; const ahora = new Date().toISOString(); Object.keys(g).forEach((k) => { v[k] = ahora; }); guardarVisto(v); }
    $('cuentaLista').textContent = plural(lista.length, 'registro', 'registros') + ' de ' + plural(orden.length, 'aliado', 'aliados');
    if(!lista.length){ $('lista').innerHTML = vacio(buscaAl ? 'Sin resultados' : 'Nada en esta etiqueta', buscaAl ? 'Nadie coincide con "' + buscaAl + '".' : 'Prueba con otra etiqueta o mira todo.'); return; }
    const solo = orden.length === 1 || !!buscaAl || chipAl !== 'todo';   // con un filtro o una búsqueda, todo a la vista
    $('lista').innerHTML = orden.map((k) => {
      const l = g[k]; const ab = solo || !!abiertosAl[k];
      const nuevo = !ab && ultimo(l) && (!v[k] || ultimo(l) > v[k]);
      const cnt = [[l.filter((i) => i.t === 'sol' && ABIERTA.indexOf(i.k) >= 0).length, 'abierta', 'abiertas'], [l.filter((i) => (i.t === 'sol' && i.k === 'instalada') || i.t === 'sinp' || (i.t === 'vieja' && /^instalado/.test(i.x.situacion))).length, 'instalada', 'instaladas'],
        [l.filter((i) => i.t === 'ref').length, 'referido', 'referidos'], [l.filter((i) => (i.t === 'sol' && i.k === 'instalada' && !i.x.pagada_en) || (i.t === 'ref' && i.x.etiqueta === 'instalado')).length, 'pago pendiente', 'pagos pendientes']]
        .filter((c) => c[0]).map((c) => plural(c[0], c[1], c[2])).join(' · ');
      const ver = masAl[k] ? l : l.slice(0, 30);
      return '<div class="grupo' + (ab ? ' abierto' : '') + '"><button type="button" class="grupo-cab" data-grupoal="' + esc(k) + '" aria-expanded="' + ab + '"><span class="tx"><b>' + esc(k) + (nuevo ? ' <span class="tagn azul">Nuevo</span>' : '') + '</b><small>' + esc(cnt || 'Sin movimiento') + '</small></span>' +
        '<span class="num">' + l.length + '</span>' + ic('abajo') + '</button><div class="grupo-cuerpo">' + ver.map((i) => (P.decidir && paraTi(i) ? filaRevisar(i, false) : filaAl(i))).join('') +
        (l.length > ver.length ? '<button type="button" class="fila mas" data-masal="' + esc(k) + '">Ver ' + (l.length - ver.length) + ' más</button>' : '') + '</div></div>';
    }).join('');
  }
  // "Esperan tu decisión": cada registro con una acción simple "Revisado" y nota (lo resuelto fuera de la app)
  function filaRevisar(i, conAliado){
    return '<div class="fila-rev">' + filaAl(i, conAliado !== false) + '<button type="button" class="mini" data-revisado="' + esc(i.t + ':' + i.id) + '" data-nombre="' + esc(i.cliente) + '">Revisado</button></div>';
  }
  // Vista general: todo a la vista por secciones (es poco volumen), lo más reciente arriba
  let verAl = 'general';
  try { verAl = localStorage.getItem('ae_aliados_vista') === 'aliado' ? 'aliado' : 'general'; } catch (e) {}
  function pintarGeneral(lista, todos){
    const reciente = (x, y) => String(y.fecha || '').localeCompare(String(x.fecha || ''));
    const SECC = [
      ['decidir', 'Esperan tu decisión', (i) => paraTi(i)],
      ['pend', 'Solicitudes pendientes', (i) => i.t === 'sol' && ABIERTA.indexOf(i.k) >= 0 && !paraTi(i)],
      ['inst', 'Solicitudes instaladas y referidos', (i) => (i.t === 'sol' && ABIERTA.indexOf(i.k) < 0) || i.t === 'ref'],
      ['viejas', 'Registros viejos (app anterior)', (i) => i.t === 'vieja']
    ];
    const usados = new Set(); let h = '';
    $('cuentaLista').textContent = plural(lista.length, 'registro', 'registros');
    SECC.forEach((sc) => {
      const l = lista.filter((i) => !usados.has(i) && sc[2](i)).sort(reciente); l.forEach((i) => usados.add(i));
      if(!l.length || (sc[0] === 'decidir' && !(R.puedo || {}).decidir)) return;
      const ver = masAl['g|' + sc[0]] ? l : l.slice(0, 30);
      h += '<section class="al-secc"><div class="bandeja-cab"><h3>' + esc(sc[1]) + '</h3><span class="n">' + l.length + '</span></div><div class="grupo abierto">' +
        ver.map((i) => (sc[0] === 'decidir' ? filaRevisar(i) : filaAl(i, true))).join('') + (l.length > ver.length ? '<button type="button" class="fila mas" data-masal="g|' + sc[0] + '">Ver ' + (l.length - ver.length) + ' más</button>' : '') + '</div></section>';
    });
    $('lista').innerHTML = h || vacio(buscaAl ? 'Sin resultados' : 'Nada en esta etiqueta', buscaAl ? 'Nadie coincide con "' + buscaAl + '".' : 'Prueba con otra etiqueta o mira todo.');
  }
  // Lote 12/11 B (maqueta 9): la lista del administrador agrupada por semana; cada fila con su acción (Decidir o Abrir)
  function pintarSemanas(lista){
    const MC = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const loc = (x) => { const t = new Date(x); return isNaN(t) ? null : new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
    const lunes = (t) => { const x = new Date(t); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
    const hoyL = lunes(loc(new Date())); const antL = new Date(hoyL); antL.setDate(antL.getDate() - 7);
    const g = {}; const sinF = [];
    lista.slice().sort((x, y) => String(y.x.creada_en || y.x.creado_en || y.fecha || '').localeCompare(String(x.x.creada_en || x.x.creado_en || x.fecha || ''))).forEach((i) => {
      const t = loc(i.x.creada_en || i.x.creado_en || i.fecha); if(!t){ sinF.push(i); return; } const L = lunes(t); const k = L.getTime(); (g[k] = g[k] || { L, l: [] }).l.push(i); });
    $('cuentaLista').textContent = plural(lista.length, 'registro', 'registros');
    const P = R.puedo || {};
    const fila = (i) => { const f = loc(i.x.creada_en || i.x.creado_en || i.fecha); const dec = P.decidir && paraTi(i);
      const dato = 'data-' + (i.t === 'vieja' ? 'vieja' : i.t) + '="' + esc(i.id) + '"';
      return '<div class="al-r"><span class="f">' + esc(f ? f.getDate() + ' ' + MC[f.getMonth()] : '') + '</span><span class="c"><b>' + esc(i.cliente) + '</b><small>' + esc(i.rif || '') + '</small></span>' +
        '<span class="a"><b>' + esc(i.aliado) + '</b><small>' + esc(i.t === 'ref' ? 'referido' : 'aliado') + (i.tu ? ' · tu cliente' : '') + '</small></span><span class="e">' + chipItem(i) + '</span>' +
        '<span class="b"><button type="button" class="hc-b ch' + (dec ? '' : ' s') + '" ' + dato + '>' + (dec ? 'Decidir' : 'Abrir') + '</button>' +
        (dec ? '<button type="button" class="enlace" data-revisado="' + esc(i.t + ':' + i.id) + '" data-nombre="' + esc(i.cliente) + '">Revisado</button>' : '') + '</span></div>'; };
    const tit = (L) => { const D = new Date(L); D.setDate(D.getDate() + 6); const r = L.getDate() + (L.getMonth() !== D.getMonth() ? ' ' + MC[L.getMonth()] : '') + ' al ' + D.getDate() + ' ' + MC[D.getMonth()];
      return L.getTime() === hoyL.getTime() ? 'Esta semana · ' + r : L.getTime() === antL.getTime() ? 'Semana anterior · ' + r : 'Semana del ' + r; };
    const ks = Object.keys(g).sort((a, b) => Number(b) - Number(a));
    let h = ks.map((k) => '<div class="al-s">' + esc(tit(g[k].L)) + '</div>' + g[k].l.map(fila).join('')).join('') + (sinF.length ? '<div class="al-s">Sin fecha</div>' + sinF.map(fila).join('') : '');
    $('lista').innerHTML = h ? '<div class="al-l">' + h + '</div>' : vacio(buscaAl ? 'Sin resultados' : 'Nada en ' + nomMes(mesAl + '-15'), buscaAl ? 'Nadie coincide con "' + buscaAl + '".' : 'Prueba con otro mes, otra pastilla o "Aliado: todos".');
  }
  const VIEJA = { instalado: 'Instalado', instalado_sin_cliente: 'Instalado sin cliente', pendiente_por_instalacion: 'Pendiente por instalación', consulta: 'Consulta' };

  // ---------- Pagos ----------
  async function cargarPagos(mio){
    if(!pagos){ $('lista').innerHTML = esqueleto(4); $('cuentaLista').textContent = 'Cargando…'; }
    try { const d = await rpc('aliados_pagos', {}); if(mio !== pedido) return; pagos = d; pintarPagos(); }
    catch (e) { if(mio !== pedido) return; $('lista').innerHTML = errorCaja('No se pudieron cargar los pagos', e.message); }
  }
  function pintarPagos(){
    const deAl = (x) => modo !== 'admin' || !aliadoF || String(x.aliado || '').trim() === aliadoF;
    const ins = (pagos.instalaciones || []).filter(deAl); const rf = (pagos.referidos || []).filter(deAl);
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

  // ---------- Instalaciones de aliados por mes (desde enero) ----------
  let porMes = null; const abiertoMes = {};
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const nomMes = (iso) => { const m = parseInt(String(iso).slice(5, 7), 10); return (MESES[m - 1] || '') + ' ' + String(iso).slice(0, 4); };
  async function cargarMes(mio){
    if(!porMes){ const g = cache.leer('aliados:mes'); if(g){ porMes = g; pintarMes(); } else { $('lista').innerHTML = esqueleto(5); $('cuentaLista').textContent = 'Cargando…'; } }
    try { const d = await rpc('aliados_por_mes', {}); if(mio !== pedido) return; porMes = d; cache.guardar('aliados:mes', d); pintarMes(); }
    catch (e) { if(mio !== pedido) return; if(!porMes) $('lista').innerHTML = errorCaja('No se pudieron cargar las instalaciones por mes', e.message); toast(e.message, 'error'); }
  }
  // Al cambiar de mes, Por mes abre ese mes
  function abiertoMesAl(){ Object.keys(abiertoMes).forEach((k) => { delete abiertoMes[k]; }); }
  function pintarMes(){
    const ms = porMes.meses || []; const tot = porMes.total || 0;
    $('cuentaLista').textContent = plural(tot, 'instalación de aliados', 'instalaciones de aliados') + ' desde enero';
    if(!ms.length){ $('lista').innerHTML = vacio('Todavía no hay instalaciones de aliados', 'Sube en Actualizar datos el archivo de órdenes de instalación desde enero. Va solo a aliados y no toca las comisiones.'); return; }
    const top = {}; ms.forEach((m) => (m.aliados || []).forEach((a) => { top[a.aliado] = (top[a.aliado] || 0) + a.n; }));
    const lider = Object.keys(top).sort((x, y) => top[y] - top[x])[0];
    const sinPermiso = ms.reduce((s, m) => s + (m.filas || []).filter((f) => !f.con_permiso).length, 0);
    let h = '<div class="ins-kpis" role="group" aria-label="Resumen"><div class="ik grande"><small>Desde enero</small><b>' + tot + '</b><span>' + esc(plural(Object.keys(top).length, 'aliado', 'aliados')) + '</span></div>' +
      '<div class="ik"><small>Este mes</small><b>' + (ms[0] && ms[0].mes.slice(0, 7) === new Date().toISOString().slice(0, 7) ? ms[0].total : 0) + '</b><span>' + esc(nomMes(new Date().toISOString())) + '</span></div>' +
      '<div class="ik"><small>Más instalaciones</small><b>' + (top[lider] || 0) + '</b><span>' + esc(lider || '') + '</span></div>' +
      '<div class="ik"><small>Sin permiso</small><b>' + sinPermiso + '</b><span>sin solicitud aprobada</span></div></div>';
    h += ms.map((m, i) => {
      const ab = abiertoMes[m.mes] !== undefined ? abiertoMes[m.mes] : modo === 'admin' ? String(m.mes).slice(0, 7) === mesAl : i === 0;
      return '<div class="grupo' + (ab ? ' abierto' : '') + '"><button type="button" class="grupo-cab" data-mes="' + esc(m.mes) + '" aria-expanded="' + ab + '"><span class="tx"><b>' + esc(window.Comun.capital(nomMes(m.mes))) + '</b><small>' +
        esc((m.aliados || []).slice(0, 4).map((a) => a.aliado + ' ' + a.n).join(' · ') + ((m.aliados || []).length > 4 ? ' y ' + ((m.aliados || []).length - 4) + ' más' : '')) + '</small></span><span class="num">' + m.total + '</span>' + ic('abajo') + '</button>' +
        '<div class="grupo-cuerpo">' + (m.filas || []).filter((f) => !aliadoF || String(f.aliado || '').trim() === aliadoF).map((f) => '<div class="fila"><span class="tx"><b>' + esc(f.cliente || 'Sin nombre') + '</b><small>' + esc([f.aliado, f.codigo, fecha(f.dia), f.categoria].filter(Boolean).join(' · ')) + '</small></span>' +
          (f.con_permiso ? '<span class="m verde">Con permiso</span>' : '<span class="m ambar">Sin permiso</span>') + '</div>').join('') + '</div></div>';
    }).join('');
    const sol = (porMes.cargas || []).filter((c) => c.solo_aliados);
    h += '<p class="nota-chica">' + (sol.length ? 'Incluye ' + plural(sol.length, 'archivo', 'archivos') + ' solo para aliados (no tocan comisiones).' : 'Para ver desde enero, sube en Actualizar datos el archivo de órdenes de instalación desde enero: va solo a aliados.') + '</p>';
    $('lista').innerHTML = h;
  }

  // ---------- Aliados y usuarios (administrador) ----------
  async function cargarAliadosAdm(mio){
    if(!aliadosAdm){ $('lista').innerHTML = esqueleto(6); $('cuentaLista').textContent = 'Cargando…'; }
    try { const d = await rpc('aliados_lista', {}); if(mio !== pedido) return; aliadosAdm = d; pintarAliadosAdm(); }
    catch (e) { if(mio !== pedido) return; $('lista').innerHTML = errorCaja('No se pudo cargar la lista', e.message); }
  }
  // Lote 5: el número de "Escribir al administrador" es un ajuste que cambia el administrador
  let ajustes = {};
  function cargarAjustes(){ rpc('ajustes_app', {}).then((a) => { ajustes = a || {}; }).catch(() => {}); }
  function bloqueWa(){
    return '<div class="al-wa"><label class="rotulo" for="waAdm">WhatsApp del administrador</label><div class="busca-linea"><input class="campo" id="waAdm" type="tel" inputmode="tel" autocomplete="off" maxlength="20" value="' + esc(ajustes.whatsapp_admin || '') + '">' +
      '<button type="button" class="btn btn-chico" data-acc="guardarWa">Guardar</button></div><div class="error" id="eWaAdm" role="alert"></div>' +
      '<p class="nota-chica">' + (ajustes.whatsapp_admin ? 'Los aliados y la coordinación lo usan en "Escribir al administrador".' : 'Sin número, "Escribir al administrador" abre WhatsApp para elegir el chat. Escríbelo aquí.') + '</p></div>';
  }
  function pintarAliadosAdm(){
    const as = aliadosAdm.aliados || []; const ps = aliadosAdm.perfiles || [];
    $('cuentaLista').textContent = plural(as.length, 'aliado', 'aliados') + ', ' + as.filter((a) => a.perfil).length + ' con usuario';
    $('lista').innerHTML = bloqueWa() + '<div class="lista-rv">' + as.map((a) => {
      const opc = ps.filter((p) => (a.es_canales ? p.rol === 'analista' : p.rol === 'aliado'));
      if(a.es_canales && !opc.length && !a.perfil) return '<div class="rv al-enlace"><div class="rv-cuerpo"><span class="quien"><span class="mono" aria-hidden="true">C</span><span><b>Coordinación de canales</b><small>Hace solicitudes, referidos y pagos</small></span></span></div>' +
        '<p class="nota-chica al-sin">Crea primero el usuario en Usuarios con rol Analista. Después lo eliges aquí.</p></div>';
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
    fd.append('casillas', casilla(cas, num));   // en Drive se llama "RIF - Casilla - fecha"
    fd.append('archivo', file.type === t ? file : file.slice(0, file.size, t), file.name || 'archivo');
    let r; try { r = await fetch(db.supabaseUrl + '/functions/v1/drive_subir', { method: 'POST', headers: { Authorization: 'Bearer ' + tk, apikey: db.supabaseKey }, body: fd }); }
    catch (e) { throw new Error('Sin conexión. El archivo no se subió. Revisa el internet e intenta de nuevo'); }
    let d = {}; try { d = await r.json(); } catch (e) {}
    if(!r.ok || !d.drive_id) throw new Error(String(d.error || 'No se pudo subir el archivo. Intenta de nuevo'));
    await rpc('documentos_registrar', { p_cliente: cliente, p_items: [{ archivos: [{ drive_id: d.drive_id }], casillas: [{ casilla: cas, numero: num }] }] });
  }
  let destino = null;   // { fn(file) }
  function elegir(fn){ destino = fn; const i = $('alArchivo'); i.value = ''; i.click(); }

  // ---------- Nueva solicitud (lote 12/11 B, lámina aliado-pantallas.html) ----------
  // Un solo drawer con tres secciones en orden: 1 El cliente (Empresa/Persona y su RIF), 2 Contacto (se puede escribir mientras se lee el RIF)
  // y 3 Documentos (se abre cuando el RIF dice "disponible"). Cada documento va en su casilla; si uno trae varios, "Viene en otro archivo".
  let N = null;
  const CAS_EMP = [['rif_empresa', 0, 'RIF de la empresa'], ['acta_constitutiva', 0, 'Acta constitutiva'], ['cedula', 1, 'Cédula del representante'], ['rif_personal', 1, 'RIF del representante']];
  const CAS_NAT = [['rif_personal', 1, 'RIF personal'], ['cedula', 1, 'Cédula']];
  const NOM_TIPO = { rif_empresa: 'un RIF de empresa', rif_personal: 'un RIF personal', cedula: 'una cédula', acta_constitutiva: 'un acta constitutiva', acta_asamblea: 'un acta de asamblea', conatel: 'una habilitación de Conatel', contrato: 'un contrato', poliza: 'una póliza' };
  function casillasN(){
    if(N.tipo === 'natural') return CAS_NAT;
    const l = CAS_EMP.slice();
    for(let r = 2; r <= N.reps; r++){ l.push(['cedula', r, 'Cédula del representante ' + r]); l.push(['rif_personal', r, 'RIF del representante ' + r]); }
    return l;
  }
  async function abrirNueva(){
    N = { id: null, tipo: null, rif: null, cliente: null, nombre: '', estado: null, msg: '', cas: {}, reps: 1, c: { correo: '', tel: '', correoEmp: '' }, err: {}, otro: null };
    const h = hoja('hojaNueva'); h.classList.add('al-dw');
    h.innerHTML = cab('hojaNueva', 'Nuevo cliente', 'Empieza por el RIF: con eso sabemos si está disponible') + '<div class="hoja-cuerpo" id="cNueva">' + esqueleto(3) + '</div><div class="hoja-pie" id="pNueva"></div>';
    abrirHoja('hojaNueva');
    try { const r = await rpc('solicitud_crear', { p_tipo: 'empresa' }); N.id = r.id; N.codigo = r.codigo; pintarNueva(); }
    catch (e) { $('cNueva').innerHTML = errorCaja('No se pudo empezar la solicitud', e.message); }
  }
  const okMail = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v || '').trim()); const okTel = (v) => String(v || '').replace(/\D/g, '').length >= 10;
  function faltaContacto(){
    const f = []; if(!okTel(N.c.tel)) f.push(N.tipo === 'natural' ? 'teléfono' : 'teléfono del representante');
    if(!okMail(N.c.correo)) f.push(N.tipo === 'natural' ? 'correo' : 'correo del representante');
    return f;
  }
  const kDe = (c) => c[0] + ':' + c[1];
  const casListo = (k) => !!N.cas[k] && (N.cas[k].estado === 'listo' || N.cas[k].estado === 'enlazado');
  const faltaDocs = () => casillasN().slice(1).filter((c) => !casListo(kDe(c))).map((c) => c[2].replace(/^./, (x) => x.toLowerCase()));
  function faltanN(){ return (N.estado === 'libre' ? [] : ['RIF']).concat(faltaDocs()).concat(faltaContacto()); }
  // Cómo va una casilla: subiendo con %, leyendo, corresponde, parece otra cosa, o viene en otro archivo
  function estadoCas(c, i){
    const k = kDe(c); const st = N.cas[k];
    if(i === 0 && N.estado === 'libre') return { cls: 'ok', tx: (N.nombre ? N.nombre + ' · ' : '') + rifFmt(N.rif) + ' · disponible', ver: 'ok' };
    if(!st) return { cls: '', tx: 'Suelta aquí o elígelo' };
    if(st.estado === 'subiendo') return { cls: '', tx: 'Subiendo' + (st.pct ? ' ' + st.pct + ' %' : ''), barra: st.pct || 0, giro: true };
    if(st.estado === 'error') return { cls: 'mal', tx: st.error || 'No se subió. Intenta de nuevo' };
    if(st.estado === 'enlazado') return { cls: 'az', tx: 'Viene en el archivo de ' + (st.deNombre || 'otro documento').replace(/^./, (x) => x.toLowerCase()) };
    if(!st.lectura) return { cls: '', tx: 'Leyendo', barra: -1, giro: true };
    if(st.lectura === 'ilegible' || st.lectura === 'formato') return { cls: 'w', tx: 'No se lee bien. Toma la foto de frente y con luz, o sube el PDF.', cambiar: true };
    const tipos = st.tipos || []; const quiere = c[0] === 'rif_personal' && N.tipo === 'natural' ? 'rif_personal' : c[0];
    if(tipos.length && tipos.indexOf(quiere) < 0 && !(quiere === 'rif_personal' && tipos.indexOf('rif_empresa') >= 0 && N.tipo === 'natural'))
      return { cls: 'w', tx: 'Esto parece ' + (NOM_TIPO[tipos[0]] || 'otro documento') + ', no ' + (NOM_TIPO[quiere] || 'lo que va aquí') + '. ¿Lo cambias?', cambiar: true };
    return { cls: 'ok', tx: 'Leído · corresponde' };
  }
  function filaCasN(c, i){
    const k = kDe(c); const st = N.cas[k] || {}; const e = estadoCas(c, i);
    const vacia = !N.cas[k] && !(i === 0 && N.estado === 'libre');
    const otros = vacia ? Object.keys(N.cas).filter((x) => x !== k && N.cas[x].estado === 'listo' && N.cas[x].archivo) : [];
    let acc = '';
    if(st.estado === 'enlazado') acc = '<button type="button" class="enlace" data-quitarn="' + k + '">Quitar</button>';
    else if(i === 0 && N.estado === 'libre') acc = '';
    else if(st.estado === 'subiendo' || (st.estado === 'listo' && !st.lectura)) acc = '';
    else if(vacia) acc = (otros.length ? '<button type="button" class="enlace" data-otron="' + k + '">Viene en otro archivo</button>' : '') + '<button type="button" class="hc-b s ch" data-subirn="' + k + '">Subir</button>';
    else acc = '<button type="button" class="hc-b s ch" data-subirn="' + k + '">' + (e.cambiar ? 'Cambiar archivo' : 'Cambiar') + '</button>';
    let h = '<div class="al-cas2' + (e.cls === 'mal' ? ' mal' : e.cls === 'w' ? ' w' : '') + '" data-casn="' + k + '"><span class="e ' + e.cls + '" aria-hidden="true">' + (e.cls === 'ok' ? ic('check') : '') + '</span>' +
      '<span class="tx"><b>' + esc(c[2]) + '</b><small class="' + e.cls + '">' + (e.giro ? '<i class="sd-giro" aria-hidden="true"></i>' : '') + esc(e.tx) + '</small>' +
      (e.barra !== undefined ? '<span class="sd-barra2' + (e.barra < 0 ? ' ind' : '') + '"><span class="sd-pista"><i style="transform:scaleX(' + (e.barra < 0 ? 1 : e.barra / 100) + ')"></i></span></span>' : '') + '</span>' +
      '<span class="acc">' + acc + '</span></div>';
    if(N.otro === k && otros.length) h += '<div class="al-otro">' + otros.map((x) => { const cx = casillasN().find((y) => kDe(y) === x) || ['', '', x];
      return '<div class="al-otro-f"><span class="tx"><b>' + esc(cx[2]) + '</b><small>' + esc((N.cas[x].archivo || {}).nombre || '') + '</small></span><button type="button" class="hc-b ch" data-enlazarn="' + k + '" data-de="' + x + '">Está aquí</button></div>'; }).join('') + '</div>';
    return h;
  }
  // El RIF: zona para soltar, leyendo, disponible o con su error en la misma casilla
  function casRif(){
    const c = casillasN()[0]; const e = N.estado; const nomR = N.tipo === 'natural' ? 'RIF personal' : 'RIF de la empresa';
    if(!e) return '<div class="al-zona" data-casn="' + kDe(c) + '"><span class="ic">' + ic('subir') + '</span><span class="tx"><b>Suelta aquí el ' + esc(nomR) + '</b><small>Foto o PDF. Te decimos al momento si está disponible.</small></span><button type="button" class="hc-b s ch" data-subirn="' + kDe(c) + '">Elegir archivo</button></div>';
    if(e === 'leyendo') return '<div class="al-cas2" data-casn="' + kDe(c) + '"><span class="e" aria-hidden="true"></span><span class="tx"><b>' + esc(nomR) + '</b><small>' + esc(N.archivoRif ? N.archivoRif.name : '') + '</small></span><span class="al-lee"><span class="sd-barra2 ind"><span class="sd-pista"><i></i></span><small><i class="sd-giro" aria-hidden="true"></i>Leyendo el RIF</small></span></span></div>';
    if(e === 'libre') return '<div class="al-cas2" data-casn="' + kDe(c) + '"><span class="e ok" aria-hidden="true">' + ic('check') + '</span><span class="tx"><b>' + esc(nomR) + '</b><small class="ok">' + esc((N.nombre ? N.nombre + ' · ' : '') + rifFmt(N.rif) + ' · disponible') + '</small></span><span class="acc"><button type="button" class="enlace" data-subirn="' + kDe(c) + '">Cambiar</button></span></div>';
    if(e === 'cartera' || e === 'otro') return '<div class="al-cas2" data-casn="' + kDe(c) + '"><span class="e" aria-hidden="true"></span><span class="tx"><b>' + esc(nomR) + '</b><small>' + esc(e === 'cartera' ? 'Este cliente ya está carterizado' : 'Este cliente ya está siendo gestionado') + '</small></span></div>';
    if(e === 'repetida') return '<div class="al-cas2 w" data-casn="' + kDe(c) + '"><span class="e w" aria-hidden="true"></span><span class="tx"><b>Ya tienes una solicitud de este cliente</b><small class="w">Es la ' + esc(N.repetida) + '. Síguela desde ahí.</small></span><span class="acc"><button type="button" class="hc-b s ch" data-sol="' + esc(N.repetidaId) + '">Abrir ' + esc(N.repetida) + '</button></span></div>';
    const noEs = e === 'no_es_rif';
    return '<div class="al-cas2 ' + (noEs ? 'mal' : 'w') + '" data-casn="' + kDe(c) + '"><span class="e ' + (noEs ? 'mal' : 'w') + '" aria-hidden="true"></span><span class="tx"><b>' + esc(nomR) + '</b><small class="' + (noEs ? 'mal' : 'w') + '">' +
      esc(noEs ? 'Esto no parece el RIF. Sube la foto o el PDF del ' + nomR + '.' : (N.msg || 'No se lee bien. Toma la foto de frente y con luz, o sube el PDF.')) + '</small></span><span class="acc"><button type="button" class="hc-b s ch" data-subirn="' + kDe(c) + '">' + (noEs ? 'Cambiar archivo' : 'Intentar de nuevo') + '</button></span></div>' +
      (noEs ? '' : '<p class="al-ayuda">¿Sigue fallando? <button type="button" class="enlace" data-res="whats">Escribir al administrador de contratos</button></p>');
  }
  function pintarNueva(){
    if(!N || !$('cNueva')) return;
    const libre = N.estado === 'libre'; const l = casillasN(); const t = N.tipo;
    const bloq = N.estado === 'cartera' || N.estado === 'otro' || N.estado === 'repetida';
    // Cabecera: el nombre cuando ya está disponible
    const cb = $('thojaNueva'); const sb = cb && cb.parentNode.querySelector('small');
    if(cb){ cb.textContent = libre && N.nombre ? N.nombre : 'Nuevo cliente'; sb.textContent = libre ? rifFmt(N.rif) + ' · Es tuyo mientras completas la solicitud' : N.estado === 'leyendo' ? 'Leyendo el RIF…' : N.estado && N.estado !== 'libre' ? 'Revisa el archivo' : 'Empieza por el RIF: con eso sabemos si está disponible'; }
    const num = (n, hecho) => '<i class="' + (hecho ? 'h' : '') + '">' + (hecho ? ic('check') : n) + '</i>';
    let h = '<section class="al-sec"><h3>' + num(1, libre) + 'El cliente</h3>' + (t ? '' : '<p class="al-q">¿Qué cliente es?</p>') +
      '<div class="al-seg2" role="radiogroup" aria-label="Qué cliente es">' + [['empresa', 'Empresa'], ['natural', 'Persona']].map((x) => '<button type="button" role="radio" aria-checked="' + (t === x[0]) + '" class="' + (t === x[0] ? 'on' : '') + '" data-tipon="' + x[0] + '"' + (N.estado && ['ilegible', 'no_es_rif', 'error'].indexOf(N.estado) < 0 ? ' disabled' : '') + '>' + x[1] + '</button>').join('') + '</div>' +
      (t ? casRif() : '') + '</section>';
    // 2 Contacto: se puede escribir mientras se lee el RIF
    const campos = [['tel', t === 'natural' ? 'Teléfono' : 'Teléfono del representante', 'tel'], ['correo', t === 'natural' ? 'Correo' : 'Correo del representante', 'email']];
    const okC = !faltaContacto().length;
    h += '<section class="al-sec' + (t && !bloq ? '' : ' bloq') + '"><h3>' + num(2, t && okC) + 'Contacto</h3>' + (t && !bloq ? (N.estado === 'leyendo' ? '<p class="al-ayuda">Mientras leemos, adelanta el contacto.</p>' : '') +
      '<div class="al-dos">' + campos.map((c) => '<div><label class="rotulo" for="n_' + c[0] + '">' + esc(c[1]) + '</label><input class="campo" id="n_' + c[0] + '" data-campon="' + c[0] + '" type="' + c[2] + '" inputmode="' + (c[2] === 'tel' ? 'tel' : 'email') + '" autocomplete="off" maxlength="120" value="' + esc(N.c[c[0]]) + '"' + (N.err[c[0]] ? ' aria-invalid="true"' : '') + ' aria-describedby="e_' + c[0] + '"><div class="error" id="e_' + c[0] + '" role="alert">' + esc(N.err[c[0]] || '') + '</div></div>').join('') + '</div>' +
      (t === 'empresa' ? '<label class="rotulo arriba" for="n_correoEmp">Correo de la empresa <span class="al-opc">(opcional)</span></label><input class="campo" id="n_correoEmp" data-campon="correoEmp" type="email" inputmode="email" autocomplete="off" maxlength="120" value="' + esc(N.c.correoEmp) + '"><div class="error" id="e_correoEmp" role="alert">' + esc(N.err.correoEmp || '') + '</div>' : '') : '') + '</section>';
    // 3 Documentos: se abren cuando el RIF dice "disponible"
    h += '<section class="al-sec' + (libre ? '' : ' bloq') + '"><h3>' + num(3, libre && !faltaDocs().length) + 'Documentos</h3>' +
      (libre ? '<div class="al-tarj">' + l.map((c, i) => filaCasN(c, i)).join('') + '</div>' + (t === 'empresa' ? '<button type="button" class="enlace al-mas" data-acc="masRep"' + (N.reps >= 4 ? ' disabled' : '') + '>Agregar otro representante</button>' : '')
        : '<p class="al-ayuda">Se abren cuando el RIF diga que el cliente está disponible.</p>') + '</section>';
    // Al repintar (llega una lectura) no se pierde el campo que se está escribiendo
    const ae = document.activeElement; const fid = ae && ae.id && $('cNueva').contains(ae) ? ae.id : null; const pos = fid && typeof ae.selectionStart === 'number' ? ae.selectionStart : null;
    $('cNueva').innerHTML = h;
    if(fid && $(fid)){ $(fid).focus(); if(pos !== null) try { $(fid).setSelectionRange(pos, pos); } catch (e) { /* email no tiene cursor */ } }
    pintarPieNueva();
  }
  function pintarPieNueva(){
    const p = $('pNueva'); if(!p || !N) return;
    if(N.estado === 'cartera' || N.estado === 'otro' || N.estado === 'repetida'){ p.className = 'hoja-pie al-pie2'; p.innerHTML = '<button type="button" class="hc-b s" data-cierra="1">Cerrar</button>'; return; }
    const subiendo = Object.keys(N.cas).some((k) => N.cas[k].estado === 'subiendo');
    p.className = 'hoja-pie al-pie2';
    p.innerHTML = '<button type="button" class="hc-b s" data-acc="guardarN">Guardar lo que llevo</button><button type="button" class="hc-b" data-acc="enviarN"' + (faltanN().length || subiendo || N.enviando ? ' disabled' : '') + '>' + (N.enviando ? 'Enviando…' : 'Enviar solicitud') + '</button>';
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
    if(!N) return;
    if(!r.ok){ N.estado = 'error'; N.msg = String(d.error || 'No se pudo leer el RIF. Intenta de nuevo.'); pintarNueva(); return; }
    N.estado = d.estado; N.nombre = d.nombre || ''; N.rif = d.rif || null;
    if(d.estado === 'repetida'){ N.repetida = d.codigo; N.repetidaId = d.id; }
    if(d.estado === 'libre'){ N.cliente = d.cliente; subirN(kDe(casillasN()[0]), file); }
    pintarNueva(); invalidar();
    if(d.estado === 'cartera' || d.estado === 'otro') mostrarRes({ id: N.id, etiqueta: d.estado, cliente: N.nombre });
  }
  async function subirN(k, file){
    const [cas, num] = k.split(':'); N.cas[k] = { estado: 'subiendo', pct: 0 }; pintarNueva();
    // El avance se ve con la barra: sube hasta 90 % mientras llega y termina al registrarse
    // Solo se mueve la barra de esa casilla (sin repintar todo: no se pierde lo que se está escribiendo)
    const mio = N.cas[k]; const tm = setInterval(() => { if(N && N.cas[k] === mio && mio.pct < 90){ mio.pct += 10; const z = document.querySelector('#hojaNueva [data-casn="' + k + '"]');
      if(z){ const i = z.querySelector('.sd-pista i'); if(i) i.style.transform = 'scaleX(' + (mio.pct / 100) + ')'; const sm = z.querySelector('.tx small'); if(sm) sm.lastChild.textContent = 'Subiendo ' + mio.pct + ' %'; } } else clearInterval(tm); }, 400);
    try { await subir(N.cliente, file, cas, Number(num)); clearInterval(tm); if(!N) return; N.cas[k] = { estado: 'listo', lectura: null, nombre: file.name }; vigilarN(); }
    catch (e) { clearInterval(tm); if(!N) return; N.cas[k] = { estado: 'error', error: e.message }; toast(e.message, 'error'); }
    pintarNueva();
  }
  let sondeoN = null;
  // Cada documento se lee apenas sube: la casilla pasa de Leyendo a "corresponde" o "Esto parece X"
  function vigilarN(){
    clearTimeout(sondeoN);
    sondeoN = setTimeout(async () => {
      if(!N || hojaAbierta() !== 'hojaNueva') return;
      try {
        const d = await rpc('solicitud_estado', { p_sol: N.id });
        (d.docs || []).forEach((x) => { const k = x.casilla + ':' + x.numero; const a = (x.archivos || [])[0];
          if(N.cas[k] && N.cas[k].estado === 'listo' && a){ N.cas[k].lectura = a.lectura; N.cas[k].tipos = a.tipos || []; N.cas[k].archivo = { id: a.id, nombre: a.nombre }; } });
        pintarNueva();
      } catch (e) {}
      if(N && Object.keys(N.cas).some((k) => N.cas[k].estado === 'listo' && (!N.cas[k].lectura || !N.cas[k].archivo))) vigilarN();
    }, 4000);
  }
  // Combinados: el mismo archivo queda también en otra casilla, sin subirlo de nuevo
  async function enlazarN(k, de, quitar){
    const [cas, num] = k.split(':'); const st = quitar ? N.cas[k] : N.cas[de]; const arch = st && (st.archivo || {}).id; if(!arch) return;
    try {
      await rpc('solicitud_casilla_enlazar', { p_sol: N.id, p_archivo: arch, p_casilla: cas, p_numero: Number(num), p_quitar: !!quitar });
      if(quitar) delete N.cas[k];
      else { const cx = casillasN().find((y) => kDe(y) === de); N.cas[k] = { estado: 'enlazado', archivo: st.archivo, de, deNombre: cx ? cx[2] : '' }; }
      N.otro = null; pintarNueva();
    } catch (e) { toast(e.message, 'error'); }
  }
  async function guardarContacto(sol, c, tipo){
    return rpc('solicitud_contacto', { p_sol: sol, p_correo: c.correo || null, p_telefono: c.tel || null, p_correo_empresa: tipo === 'empresa' ? (c.correoEmp || null) : null });
  }
  async function guardarN(b){
    if(!N) return;
    if(!N.cliente){ cerrarHoja(true); toast('Guardado. Sigue cuando quieras desde Inicio'); invalidar(); cargar(); return; }
    b.disabled = true;
    try { if(N.c.tel || N.c.correo || N.c.correoEmp) await guardarContacto(N.id, N.c, N.tipo); toast('Guardado. Sigue cuando quieras desde Inicio'); N = null; cerrarHoja(true); invalidar(); cargar(); }
    catch (e) { toast(e.message, 'error'); if(document.contains(b)) b.disabled = false; }
  }
  async function enviarN(){
    N.err = {};
    if(!okMail(N.c.correo)) N.err.correo = 'Escribe un correo válido.';
    if(!okTel(N.c.tel)) N.err.tel = 'Escribe el teléfono con su código, por ejemplo 0414 1234567.';
    // Lote 10/11 A4: el correo de la empresa es opcional para aliados (si se escribe, debe ser válido)
    if(N.tipo === 'empresa' && N.c.correoEmp.trim() && !okMail(N.c.correoEmp)) N.err.correoEmp = 'Escribe un correo válido o déjalo vacío.';
    if(Object.keys(N.err).length){ pintarNueva(); const k = Object.keys(N.err)[0]; const el = $('n_' + k); if(el) el.focus(); return; }
    N.enviando = true; pintarPieNueva();
    try { await guardarContacto(N.id, N.c, N.tipo); await rpc('solicitud_enviar', { p_sol: N.id }); }
    catch (e) { N.enviando = false; pintarPieNueva(); toast(e.message, 'error'); return; }
    // Revisando: el recuadro sale encima con la solicitud difuminada detrás; al terminar cambia solo
    const id = N.id; N = null; cerrarHoja(true); invalidar(); cargar(); resPara = id; abrirSol(id);
  }

  // ---------- Lote 10/11 E6: pantalla de resultado a pantalla completa (como una venta en Artesanos) ----------
  const RES_ESTADOS = ['lista', 'listaobs', 'recaudos', 'revision', 'excepcion', 'noprocede', 'instalada'];
  const WA_ADM = ['whats', 'Escribir al administrador de contratos', 'wa'];
  // Lote 12/11 B (lámina aliado-pantallas): los textos de cada caso
  function resDe(d){
    const nom = d.cliente || 'Tu cliente'; const pts = (est) => ((d.ia && d.ia.puntos) || []).filter((p) => p.estado === est);
    const acta = (l) => l.some((p) => /acta/i.test((p.titulo || '') + ' ' + (p.detalle || '')));
    switch(d.etiqueta){
      case 'cartera': return { tono: 'gris', ico: 'casa', t: 'Este cliente ya está carterizado', x: nom + ' ya es cliente de Airtek y tiene su ejecutivo. Si lo conseguiste tú, puedes referirlo.', chip: 'Si se instala por tu referido, se te paga', b: [['referirSol', 'Referir cliente', 'pri'], WA_ADM, ['inicio', 'Volver al inicio', '']] };
      case 'otro': return { tono: 'gris', ico: 'candado', t: 'Este cliente ya está siendo gestionado', x: 'No se puede instalar ni referir mientras tanto. Si esa gestión se cierra, el cliente vuelve a quedar libre.', chip: 'Si crees que es un error, escríbenos', b: [WA_ADM, ['nueva', 'Nueva solicitud', ''], ['inicio', 'Volver al inicio', '']] };
      case 'analizando': return { tono: 'azul', ico: 'reloj', t: 'Revisando tu solicitud', puntos: true, x: 'Estamos leyendo los documentos. Tarda unos segundos.', noSalgas: true, pasos: true, b: [] };
      case 'lista': return { tono: 'verde', ico: 'check', t: '¡Puedes instalar!', x: nom + ' pasó la revisión. Cuando llegue la orden de instalación con tu nombre, pasa sola a Instalada y te avisamos.', b: [['inicio', 'Volver al inicio', 'pri'], ['ver', 'Ver la solicitud', '']] };
      case 'listaobs': return { tono: 'verde', ico: 'check', t: 'Puedes instalar, con observaciones', x: 'Estas notas no te frenan. Súbelas cuando puedas. Cuando llegue la orden con tu nombre, pasa sola a Instalada.', notas: pts('aviso'), b: [['inicio', 'Volver al inicio', 'pri'], ['ver', 'Ver la solicitud y subir', '']] };
      case 'recaudos': {
        const l = pts('bloquea');
        // Si faltan documentos nunca es "No procede": si la excepción se negó, vuelve aquí
        if(d.excepcion && d.respuesta) return { tono: 'rojo', ico: 'x', t: 'La excepción no se aprobó', x: 'Hace falta el acta. Cuando la tengas, súbela y toca Revisar de nuevo.', resp: d.respuesta, b: [['ver', 'Subir el acta', 'pri'], WA_ADM] };
        return { tono: 'ambar', ico: 'subir', t: 'Te falta algo para instalar', x: 'Sube lo que falta y toca Revisar de nuevo. Si no existe, pide una excepción.', notas: l, b: [['ver', acta(l) ? 'Subir el acta' : 'Subir lo que falta', 'pri'], ['form:excepcion', 'Pedir excepción', ''], WA_ADM] };
      }
      case 'revision': return { tono: 'morado', ico: 'lupa', t: 'Lo está revisando el administrador', x: 'Un punto necesita una persona. Te avisamos apenas responda.', notas: pts('mano'), b: [WA_ADM, ['ver', 'Ver la solicitud', '']] };
      case 'excepcion': return { tono: 'morado', ico: 'lupa', t: 'Pediste una excepción', x: 'El administrador de contratos la revisa. Te avisamos apenas responda.', b: [WA_ADM, ['ver', 'Ver la solicitud', '']] };
      case 'noprocede': return { tono: 'rojo', ico: 'x', t: 'No procede', x: d.respuesta || 'El administrador cerró esta solicitud. El cliente quedó libre.', b: [WA_ADM, ['ver', 'Ver la solicitud', '']] };
      case 'instalada': return { tono: 'verde', ico: 'usuarios', t: 'Instalación confirmada', x: 'Llegó la orden con tu nombre. ' + nom + ' ya está en tu cartera.', chip: d.pagada_en ? 'Pago registrado el ' + fecha(d.pagada_en) : '', b: [['ver', 'Ver la solicitud', 'pri']] };
      case 'referido': return { tono: 'verde', ico: 'check', t: 'Referido enviado', x: 'El administrador lo revisa. Si se instala, se te paga y lo ves en Pagos.', b: [['inicio', 'Volver al inicio', 'pri'], ['referidos', 'Ver mis referidos', '']] };
      default: return null;
    }
  }
  let resId = null; let resPara = null; let resDemo = false;
  // Recuadro grande centrado (600 px en PC, 350 en teléfono), todo del color del estado, con lo de atrás difuminado
  // Lote 13/11: también en la Solicitud de prueba del administrador (y en "Ver los avisos", con datos de ejemplo)
  function mostrarRes(d, demo){
    if(modo === 'equipo') return;
    resDemo = !!demo;
    const r = resDe(d); if(!r) return;
    let v = $('alResVelo'); if(!v){ v = document.createElement('div'); v.id = 'alResVelo'; v.className = 'al-res-velo'; document.body.appendChild(v); }
    let z = $('alRes'); if(!z){ z = document.createElement('section'); z.id = 'alRes'; z.setAttribute('role', 'dialog'); z.setAttribute('aria-modal', 'true'); z.setAttribute('aria-labelledby', 'alResT'); document.body.appendChild(z); }
    resId = d.id; z.className = 'al-res2 t-' + r.tono;
    const p = r.pasos ? PASOS(d) : null;
    const paso = (i, t) => '<div class="al-rp2 ' + (p.n > i ? 'hecho' : p.n === i ? 'activo' : '') + '"><i aria-hidden="true">' + (p.n > i ? ic('check') : p.n === i ? '<span class="al-pts"><b></b><b></b><b></b></span>' : (i - 1)) + '</i>' + esc(t) + '</div>';
    const frac = p ? Math.min(1, (p.n - 1 + (p.n === 2 && p.total ? p.av / p.total : 0)) / 3) : 0;
    z.innerHTML = '<button type="button" class="cerrar al-res-x" data-res="cerrar" aria-label="Cerrar">' + ic('x') + '</button><div class="al-res-c2"><span class="al-res-ic" aria-hidden="true">' + ic(r.ico) + '</span>' +
      '<h2 id="alResT">' + esc(r.t) + (r.puntos ? ' <span class="al-pts" aria-hidden="true"><b></b><b></b><b></b></span>' : '') + '</h2><p>' + esc(r.x) + '</p>' +
      (r.noSalgas ? '<span class="al-nosalgas">' + ic('info') + 'No salgas de aquí hasta que termine</span>' : '') +
      (r.chip ? '<span class="al-res-chip">' + esc(r.chip) + '</span>' : '') +
      (p ? '<div class="al-res-caja">' + paso(2, 'Documentos leídos' + (p.total ? ' (' + p.av + ' de ' + p.total + ')' : '')) + paso(3, 'Revisando firmantes y actas') + paso(4, 'Armando el resultado') +
        '<span class="sd-barra2 al-res-barra"><span class="sd-pista"><i style="transform:scaleX(' + frac.toFixed(3) + ')"></i></span></span></div>' : '') +
      (r.notas && r.notas.length ? '<div class="al-res-caja">' + r.notas.map((n) => '<p class="al-res-n">' + esc(n.titulo + (n.detalle ? '. ' + n.detalle : '')) + '</p>').join('') + '</div>' : '') +
      (r.resp ? '<div class="al-res-caja"><p class="al-res-n"><b>Respuesta del administrador:</b> ' + esc(r.resp) + '</p></div>' : '') +
      (r.b.length ? '<div class="al-res-acc">' + r.b.map((x) => '<button type="button" class="hc-b an ' + (x[2] === 'pri' ? '' : x[2] === 'wa' ? 'wa2' : 's') + '" data-res="' + x[0] + '">' + (x[2] === 'wa' ? ic('wa') : '') + esc(x[1]) + '</button>').join('') + '</div>' : '') + '</div>';
    z.classList.add('ver'); v.classList.add('ver'); document.documentElement.classList.add('con-res');
    if(modo === 'aliado') marcarVisto(d.id, d.etiqueta);
  }
  // Lote 13/11: "Ver los avisos" (administrador): cada caso del aliado con datos de ejemplo, sin tocar la base
  const DEMOS = [['analizando', 'Revisando', 'Mientras se leen los documentos'], ['lista', '¡Puedes instalar!', 'Pasó la revisión'], ['recaudos', 'Te falta algo', 'Falta un documento para instalar'],
    ['cartera', 'Carterizado', 'El cliente ya tiene su ejecutivo'], ['otro', 'Ya está siendo gestionado', 'Otro aliado o una orden abierta'], ['excepcionNo', 'Excepción no aprobada', 'Pidió excepción y se negó'],
    ['noprocede', 'No procede', 'El administrador cerró la solicitud'], ['repetida', 'Ya tienes una solicitud', 'El mismo RIF dos veces, dentro del alta'], ['referido', 'Referido enviado', 'Después de referir un cliente']];
  function abrirAvisosDemo(){
    const h = hoja('hojaAvisos'); h.classList.add('al-dw');
    h.innerHTML = cab('hojaAvisos', 'Avisos del aliado', 'Así los ve el aliado. Son de ejemplo: no se guarda nada') + '<div class="hoja-cuerpo"><section class="al-sec"><div class="al-tarj">' +
      DEMOS.map((x) => '<button type="button" class="al-cas2 al-demo" data-demo="' + x[0] + '"><span class="tx"><b>' + esc(x[1]) + '</b><small>' + esc(x[2]) + '</small></span><span class="acc">' + ic('derecha') + '</span></button>').join('') +
      '</div></section></div><div class="hoja-pie al-pie2"><button type="button" class="hc-b s" data-cierra="1">Cerrar</button></div>';
    abrirHoja('hojaAvisos');
  }
  function verDemo(k){
    const nom = 'PANADERÍA EJEMPLO, C.A.';
    if(k === 'repetida'){
      N = { demo: true, id: null, tipo: 'empresa', rif: null, cliente: null, nombre: '', estado: 'repetida', repetida: 'AL-0001', repetidaId: 0, msg: '', cas: {}, reps: 1, c: { correo: '', tel: '', correoEmp: '' }, err: {}, otro: null };
      const h = hoja('hojaNueva'); h.classList.add('al-dw');
      h.innerHTML = cab('hojaNueva', 'Nuevo cliente', '') + '<div class="hoja-cuerpo" id="cNueva"></div><div class="hoja-pie" id="pNueva"></div>';
      abrirHoja('hojaNueva'); pintarNueva(); return;
    }
    const d = { id: 0, cliente: nom, etiqueta: k === 'excepcionNo' ? 'recaudos' : k, ia: { estado: 'leyendo', total: 6, avance: 4, puntos: [{ estado: 'bloquea', titulo: 'Falta el acta de asamblea', detalle: 'La que nombra al representante que firma' }] },
      excepcion: k === 'excepcionNo', respuesta: k === 'excepcionNo' ? 'Sin el acta no se puede firmar.' : k === 'noprocede' ? 'El cliente ya tiene una orden con otro vendedor.' : null };
    mostrarRes(d, true);
  }
  function cerrarRes(){ const z = $('alRes'); if(z) z.classList.remove('ver'); const v = $('alResVelo'); if(v) v.classList.remove('ver'); document.documentElement.classList.remove('con-res'); resId = null; resDemo = false; }
  const K_VISTO = 'ae_al_vistos';
  function vistos(){ try { return JSON.parse(localStorage.getItem(K_VISTO) || 'null'); } catch (e) { return null; } }
  function marcarVisto(id, et){ try { const v = vistos() || {}; v[id] = et; localStorage.setItem(K_VISTO, JSON.stringify(v)); } catch (e) {} }
  // Al abrir la app: si una solicitud cambió a un resultado desde la última vez, sale su pantalla (la primera vez solo se anota)
  function revisarCambios(){
    if(modo !== 'aliado' || !D || hojaAbierta() || resId) return;
    const v = vistos(); const s = sols();
    if(!v){ const n = {}; s.forEach((x) => { n[x.id] = x.etiqueta; }); try { localStorage.setItem(K_VISTO, JSON.stringify(n)); } catch (e) {} return; }
    const c = s.find((x) => RES_ESTADOS.indexOf(x.etiqueta) >= 0 && v[x.id] !== undefined && v[x.id] !== x.etiqueta);
    s.forEach((x) => { if(v[x.id] === undefined) marcarVisto(x.id, x.etiqueta); });
    if(c){ resPara = c.id; abrirSol(c.id); }
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
    try { const d = await rpc('solicitud_estado', { p_sol: SOL.id }); if(!SOL || SOL.id !== d.id) return; SOL.d = d; pintarSol();
      if(resPara === d.id){ resPara = null; mostrarRes(d); } else if(resId === d.id) mostrarRes(d); }
    catch (e) { if($('cSol')) $('cSol').innerHTML = errorCaja('No se pudo abrir la solicitud', e.message).replace('data-acc="reintentar"', 'data-acc="reintentarSol"'); }
  }
  const PASOS = (d) => { const k = d.ia || {}; const total = Number(k.total) || 0; const av = Number(k.avance) || 0; const leyendo = k.estado === 'en_cola' || k.estado === 'leyendo';
    const n = !k.estado ? 2 : leyendo ? (av >= total ? 3 : 2) : 4;
    return { n, av, total }; };
  function pasos(d){
    const p = PASOS(d);
    const fila = (i, t, s) => '<div class="al-paso ' + (p.n > i ? 'hecho' : p.n === i ? 'activo' : 'espera') + '"><i aria-hidden="true"></i><div><b>' + esc(t) + '</b>' + (s ? '<small>' + esc(s) + '</small>' : '') + '</div></div>';
    const frac = Math.min(1, (p.n - 1 + (p.n === 2 && p.total ? p.av / p.total : 0)) / 4);
    // Lote 3: la IA nunca frena la solicitud. Queda recibida al instante y el resultado llega después.
    return '<div class="al-banda verde"><b>Recibido, en revisión</b><p>Tu solicitud ya está guardada. El cliente está disponible y la revisión corre aparte: el resultado llega a Mis solicitudes.</p></div>' +
      '<div class="h2 al-h2">Revisión de documentos</div><span class="al-barra" aria-hidden="true"><i style="transform:scaleX(' + frac.toFixed(2) + ')"></i></span>' +
      '<div class="al-pasos" role="status">' + fila(0, 'RIF leído', d.cliente + ', ' + rifFmt(d.rif)) + fila(1, 'Cartera revisada', 'No es TOP, no tiene orden abierta ni otro aliado') +
      fila(2, 'Leyendo documentos', p.total ? p.av + ' de ' + p.total + ' leídos' : 'Lo que ya se leyó al subir no se vuelve a leer') + fila(3, 'Revisando firmantes, junta y actas', 'Mismas reglas de los contratos') + fila(4, 'Armando el resultado', '') + '</div>' +
      '<p class="nota">Puedes cerrar esta pantalla. El resultado queda en Mis solicitudes.</p>' +
      (d.es_admin || d.solo_ver ? '' : '<div class="al-acc"><button type="button" class="btn btn-chico btn-2" data-acc="whats">Escribir al administrador por WhatsApp</button></div>');
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
    const solo = !!d.solo_ver; const aliadoPuede = !adm && !solo && (k === 'recaudos' || k === 'instalada');   // lote 3: lo que sube después de instalar también va al expediente
    let acc = '';
    if(solo){ acc = ''; }
    else if(!adm){
      if(k === 'recaudos') acc = '<button type="button" class="btn btn-chico" data-acc="revisarDeNuevo">Revisar de nuevo</button><button type="button" class="btn btn-chico btn-2" data-form="excepcion">Pedir excepción</button><button type="button" class="btn btn-chico btn-2" data-acc="whats">Escribir al administrador</button>';
      else if(k === 'lista' || k === 'listaobs') acc = '<button type="button" class="btn btn-chico" data-form="curso">Marcar instalación en curso</button><button type="button" class="btn btn-chico btn-2" data-form="noinst">No se instaló</button>';
      else if(k === 'curso') acc = (d.fecha_instalacion && d.fecha_instalacion < window.Comun.hoyClave() ? '<button type="button" class="btn btn-chico" data-acc="yaInstale"' + (d.ya_instale_en ? ' disabled' : '') + '>' + (d.ya_instale_en ? 'Ya avisaste que instalaste' : 'Sí, ya instalé') + '</button>' : '<button type="button" class="btn btn-chico btn-2" data-form="curso">Cambiar fecha</button>') + '<button type="button" class="btn btn-chico btn-2" data-form="noinst">No se instaló</button>';
      else if(k === 'cartera') acc = '<button type="button" class="btn btn-chico" data-acc="referirSol" data-id="' + esc(d.id) + '">Referir cliente</button>';
      else if(k === 'excepcion' || k === 'revision') acc = '<button type="button" class="btn btn-chico btn-2" data-acc="whats">Escribir al administrador</button>';
      // Lote C: el aliado solo contacta al administrador, y puede hacerlo en toda solicitud abierta o instalada
      if(acc.indexOf('data-acc="whats"') < 0 && ['recaudos', 'excepcion', 'revision', 'lista', 'listaobs', 'curso', 'instalada'].indexOf(k) >= 0) acc += '<button type="button" class="btn btn-chico btn-2" data-acc="whats">Escribir al administrador</button>';
    } else {
      if(k === 'excepcion') acc = '<button type="button" class="btn btn-chico" data-form="decidir" data-modo="aprobar">Admitir excepción</button><button type="button" class="btn btn-chico btn-2" data-form="decidir" data-modo="negar">Negar</button>';
      else if(k === 'revision') acc = '<button type="button" class="btn btn-chico" data-form="decidir" data-modo="aprobar">Aprobar</button><button type="button" class="btn btn-chico btn-2" data-form="decidir" data-modo="devolver">Pedir corregir</button>';
      else if(k === 'recaudos') acc = '<button type="button" class="btn btn-chico btn-2" data-form="decidir" data-modo="aprobar">Aprobar igual</button>';
      if(ABIERTA.indexOf(k) >= 0 && k !== 'borrador') acc += '<button type="button" class="btn btn-chico btn-2" data-form="decidir" data-modo="noprocede">No procede</button>';
      if(d.cliente_id) acc += '<button type="button" class="btn btn-chico btn-2" data-acc="expediente">Abrir expediente</button>';
    }
    const det = k === 'recaudos' ? 'Revisa lo marcado abajo. ' + SIGUE[k] : k === 'curso' && d.fecha_instalacion ? 'Instalas el ' + fecha(d.fecha_instalacion) + '. ' + SIGUE[k] : k === 'sininst' ? (d.motivo_cierre || '') + ' ' + SIGUE[k] : SIGUE[k] || '';
    $('cSol').innerHTML = (adm ? '' : lineaSol(d)) + (k === 'analizando' ? pasos(d) :
      '<div class="estado ' + (e[1] || 'al-gris') + '"><b>' + esc(e[0]) + '</b><small>' + esc(det) + '</small></div>' +
      (adm && d.bloqueo ? '<p class="nota">Bloqueo: ' + esc({ top: 'cliente TOP', cartera: 'cartera de un líder', grandes_negocios: 'Grandes negocios', servicio: 'ya tiene servicio', odoo: 'orden de Odoo abierta', otro_aliado: 'otro aliado lo pidió' }[d.bloqueo] || d.bloqueo) + (d.lider ? ' (' + esc(d.lider) + ')' : '') + '.</p>' : '') +
      (d.excepcion && d.excepcion.motivo ? '<div class="al-nota"><b>Excepción pedida' + (d.excepcion.punto ? ': ' + esc(d.excepcion.punto) : '') + '.</b> ' + esc(d.excepcion.motivo) + '</div>' : '') +
      (d.respuesta ? '<div class="al-nota"><b>Respuesta del administrador:</b> ' + esc(d.respuesta) + '</div>' : '') +
      (acc ? '<div class="al-acc">' + acc + '</div>' : '') +
      (adm && (k === 'lista' || k === 'listaobs') ? '<p class="nota">Correo de aprobación al aliado: pendiente, llega con las notificaciones.</p>' : '') +
      (k === 'cartera' || k === 'otro' ? '<p class="nota">Sus archivos no se guardaron: solo se leyó el RIF.</p>' : '<div class="h2 al-h2">Documentos</div>' + docsSol(d, aliadoPuede) + puntosSol(d)) +
      (aliadoPuede ? contactoSol(d) : '')) +
      '<div class="h2 al-h2">Historial</div><div class="al-hilo">' + (d.hilo || []).map((x) => '<div class="al-hi ' + esc(x.color) + '"><div>' + esc(x.texto) + '<small>' + esc(fecha(x.en) + ' ' + hora(x.en)) + '</small></div></div>').join('') + '</div>' +
      fechasSol(d) + bitacoraSol(d);
    if(k === 'analizando'){ sondeoS = setTimeout(() => { if(hojaAbierta() === 'hojaSol') cargarSol(); }, 3000); }
  }
  // Lote 12/11 (maqueta aliado-flujo, 4): la misma línea de tiempo en cada solicitud; siempre dice en qué paso va y qué sigue
  function lineaSol(d){
    const k = d.etiqueta; const pagada = !!d.pagada_en;
    const n = { analizando: 1, recaudos: 1, excepcion: 2, revision: 2, lista: 3, listaobs: 3, curso: 4, instalada: pagada ? 5 : 4 }[k];
    if(n === undefined) return '';
    const P = [['Enviado', d.enviada_en || d.creada_en ? fecha(d.enviada_en || d.creada_en, true) : ''],
      ['Revisión automática', k === 'recaudos' ? 'Falta corregir algo: míralo abajo' : n === 1 ? 'Unos 2 minutos · puedes cerrar, te avisamos' : 'Lista'],
      ['Revisión del administrador', n === 2 ? 'La está revisando · te avisamos' : n > 2 && (d.excepcion || d.respuesta) ? 'Aprobada' : 'Solo si algo no cuadra'],
      ['Lista para instalar', n === 3 ? 'Marca la fecha de instalación' : d.aprobada_en ? fecha(d.aprobada_en, true) : ''],
      ['Instalado y pagado', k === 'curso' ? (d.fecha_instalacion ? 'Instalas el ' + fecha(d.fecha_instalacion) : 'Instalación en curso') : k === 'instalada' ? (pagada ? 'Pagado el ' + fecha(d.pagada_en, true) : 'Instalada, falta el pago') : 'Ves tu pago aquí']];
    return '<ol class="al-tl" aria-label="En qué va la solicitud">' + P.map((x, i) => { const st = i < n || (i === 4 && pagada) ? 'v' : i === n ? (k === 'recaudos' ? 'r' : 'a') : '';
      return '<li class="' + st + '"' + (st === 'a' || st === 'r' ? ' aria-current="step"' : '') + '><i aria-hidden="true">' + (st === 'v' ? '✓' : i + 1) + '</i><span><b>' + esc(x[0]) + '</b>' + (x[1] ? '<small>' + esc(x[1]) + '</small>' : '') + '</span></li>'; }).join('') + '</ol>';
  }
  function fechasSol(d){
    const f = [['Creada', d.creada_en], ['Aprobada', d.aprobada_en], ['Instalación prevista', d.fecha_instalacion], ['Instalada', d.instalada_en], ['Cerrada', d.cerrada_en], ['Vence', d.vence_en]].filter((x) => x[1]);
    if(!f.length) return '';
    return '<div class="h2 al-h2">Fechas</div><div class="al-casillas">' + f.map((x) => '<div class="al-cas"><div class="tx"><b>' + esc(x[0]) + '</b></div><span>' + esc(fecha(x[1], true)) + '</span></div>').join('') + '</div>';
  }
  const ACCION_AL = { aliado_decision: 'Decisión del administrador', solicitud_enviada: 'Solicitud enviada', solicitud_creada: 'Solicitud creada', solicitud_excepcion: 'Pidió excepción', solicitud_instalacion: 'Marcó instalación en curso', solicitud_no_instalo: 'No se instaló', pago_marcado: 'Pago marcado' };
  function bitacoraSol(d){
    if(!d.bitacora || !d.bitacora.length) return d.bitacora ? '<div class="h2 al-h2">Bitácora</div><p class="nota">Sin movimientos registrados todavía.</p>' : '';
    return '<div class="h2 al-h2">Bitácora</div><div class="al-hilo">' + d.bitacora.map((b) => '<div class="al-hi"><div>' + esc(ACCION_AL[b.accion] || capital(String(b.accion || '').replace(/_/g, ' '))) + (b.por ? ', ' + esc(b.por) : '') +
      (b.despues && b.despues.texto ? '. "' + esc(b.despues.texto) + '"' : '') + '<small>' + esc(fecha(b.en) + ' ' + hora(b.en)) + '</small></div></div>').join('') + '</div>';
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
      const can = modo === 'canales'; t = can ? 'Cargar referido' : 'Referir cliente'; s = can ? x.cliente || 'Pásalo a la oficina' : 'Pásalo a la oficina'; boton = can ? 'Cargar' : 'Referir';
      const c = (id, l, tp, v, dis) => '<label class="rotulo arriba" for="' + id + '">' + l + '</label><input class="campo" id="' + id + '" type="' + tp + '" maxlength="120" value="' + esc(v || '') + '"' + (dis ? ' disabled' : '') + '>';
      // Lote 12/11 B (lámina, caso 2): el cliente, el servicio (Internet PYME), teléfono y coordenadas opcionales
      cuerpo = (x.sol && x.cliente ? '<div class="al-cli-r"><span class="e ok" aria-hidden="true">' + ic('check') + '</span><span><b>' + esc(x.cliente) + '</b><small>' + esc(x.rif ? rifFmt(x.rif) : '') + '</small></span></div><input type="hidden" id="fRif" value="' + esc(x.rif ? rifFmt(x.rif) : '') + '">' : c('fRif', 'RIF del cliente', 'text', x.rif ? rifFmt(x.rif) : '', !!x.sol)) +
        (can ? c('fNombre', 'Nombre', 'text') + c('fApellido', 'Apellido', 'text') + c('fTel', 'Teléfono', 'tel') + c('fCoord', 'Coordenadas', 'text')
          : '<label class="rotulo arriba" for="fServ">Servicio</label><input class="campo" id="fServ" value="Internet PYME" disabled>' + c('fTel', 'Teléfono de contacto', 'tel') + c('fCoord', 'Coordenadas <span class="al-opc">(opcional)</span>', 'text')) +
        '<div class="error" id="eForm" role="alert"></div><p class="nota">El administrador lo acepta y se paga con dos residenciales cuando se instala. ¿Dudas? <button type="button" class="enlace" data-res="whats">Escribir al administrador de contratos</button></p>';
      if(!can) boton = 'Enviar referido';
    } else if(tipo === 'ref'){
      const r = (fuente().referidos || []).find((y) => y.id === x.id); if(!r) return;
      t = r.cliente || 'Referido'; s = [rifFmt(r.rif), r.codigo, r.aliado].join(' · '); boton = r.etiqueta === 'referido' && modo === 'admin' ? 'Aceptar referido' : '';
      cuerpo = '<div class="estado ' + (ETQ_RF[r.etiqueta][1] || 'al-gris') + '"><b>' + esc(ETQ_RF[r.etiqueta][0]) + '</b><small>' + esc(r.etiqueta === 'referido' ? 'Esperando respuesta del administrador.' : r.etiqueta === 'aceptado' ? 'Lo lleva ' + r.lider + '. Se paga cuando se instale.' : r.etiqueta === 'instalado' ? 'Instalado el ' + fecha(r.instalado_en) + '. ' + (r.horas >= 0 ? 'Quedan ' + r.horas + ' h para pagar.' : 'Pago atrasado.') : r.etiqueta === 'pagado' ? 'Pagado con dos residenciales.' : (r.respuesta || 'No se aceptó.')) + '</small></div>' +
        (r.telefono ? '<p class="nota">Teléfono del cliente: ' + esc(r.telefono) + (r.coordenadas ? ' · ' + esc(r.coordenadas) : '') + '</p>' : '') +
        (r.etiqueta === 'referido' && modo === 'admin' ? '<label class="rotulo arriba" for="fLider">Pasárselo a</label><select class="campo" id="fLider"><option value="">Elige el líder</option>' + ((D && D.lideres) || []).map((l) => '<option>' + esc(l) + '</option>').join('') + '</select>' +
          '<label class="rotulo arriba" for="fTexto">Si no lo aceptas, por qué</label><textarea class="campo al-area" id="fTexto" maxlength="1000"></textarea><div class="error" id="eForm" role="alert"></div>' : '');
    } else if(tipo === 'sinp'){
      const p = (fuente().sin_permiso || []).find((y) => y.id === x.id); if(!p) return;
      t = p.cliente || 'Instalación'; s = 'Instaló ' + (p.aliado || 'sin enlazar'); boton = p.revisado_en || modo !== 'admin' ? '' : 'Marcar revisado';
      cuerpo = '<div class="estado rojo"><b>Instalado sin permiso</b><small>' + esc((p.aliado || 'Un aliado') + ' lo instaló el ' + fecha(p.instalada_en, true) + ' sin una solicitud aprobada' + (p.origen === 'historico' ? ' (antes del módulo, no aparece en AppSheet).' : '.')) + '</small></div>' +
        (p.revisado_en ? '<p class="nota">Revisado el ' + esc(fecha(p.revisado_en, true)) + (p.nota ? ': ' + esc(p.nota) : '') + '</p>' : modo !== 'admin' ? '<p class="nota">Lo revisa el administrador.</p>' : '<label class="rotulo arriba" for="fTexto">Nota (opcional)</label><textarea class="campo al-area" id="fTexto" maxlength="500"></textarea><div class="error" id="eForm" role="alert"></div><p class="nota">No entra en Pagos. Márcalo revisado cuando hables con el aliado.</p>');
    } else if(tipo === 'revisado'){
      t = 'Marcar revisado'; s = x.nombre || ''; boton = 'Marcar revisado';
      cuerpo = '<p class="nota">Sale de "Esperan tu decisión" sin cambiar su etiqueta. Úsalo cuando ya se resolvió por fuera de la app.</p>' +
        '<label class="rotulo arriba" for="fTexto">Nota (opcional)</label><textarea class="campo al-area" id="fTexto" maxlength="500"></textarea><p class="nota">Por ejemplo: aprobada por correo.</p><div class="error" id="eForm" role="alert"></div>';
    } else if(tipo === 'vieja'){
      const v = (fuente().viejas || []).find((y) => y.id === x.id); if(!v) return;
      t = v.cliente || 'Consulta vieja'; s = [v.rif, v.aliado].filter(Boolean).join(' · '); boton = '';
      cuerpo = '<div class="estado ' + (/^instalado/.test(v.situacion) ? 'verde' : 'al-gris') + '"><b>' + esc(VIEJA[v.situacion] || v.situacion) + '</b><small>Caso de la app vieja (AppSheet), antes del módulo de aliados.</small></div>' +
        '<p class="nota">Aliado: ' + esc(v.aliado || 'Sin aliado') + (v.rif ? '. RIF leído entonces: ' + esc(v.rif) : '') + '.</p>';
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
        await rpc('referido_crear', { p_rif: x.sol ? null : valor('fRif'), p_nombre: can ? valor('fNombre') : null, p_apellido: can ? valor('fApellido') : null, p_telefono: valor('fTel') || null, p_coordenadas: valor('fCoord') || null, p_solicitud: x.sol || null });
        if(modo === 'aliado') setTimeout(() => mostrarRes({ id: x.sol || 0, etiqueta: 'referido' }), 350); else toast('Referido enviado al administrador');
      }
      else if(tipo === 'ref'){
        if(rechazar){ const m = valor('fTexto'); if(m.length < 5) return err('Escribe por qué no se acepta (al menos 5 letras).'); await rpc('referido_decidir', { p_ref: x.id, p_aceptar: false, p_lider: null, p_texto: m }); toast('Referido no aceptado'); }
        else { const l = valor('fLider'); if(!l) return err('Elige a qué líder se lo pasas.'); await rpc('referido_decidir', { p_ref: x.id, p_aceptar: true, p_lider: l, p_texto: null }); toast('Referido aceptado y pasado a ' + l); }
      }
      else if(tipo === 'revisado'){ await rpc('aliado_revisado', { p_tipo: x.tipo, p_id: x.id, p_nota: valor('fTexto') || null }); toast('Marcado como revisado'); }
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
    if((b = t.closest('[data-sol]')) && N && N.demo){ toast('Es un ejemplo: aquí se abre esa solicitud'); return; }
    if((b = t.closest('[data-demo]'))){ verDemo(b.dataset.demo); return; }
    if((b = t.closest('[data-sol]'))){ if(hojaAbierta() === 'hojaNueva') cerrarHoja(true); abrirSol(Number(b.dataset.sol)); return; }
    if((b = t.closest('[data-ref]'))){ abrirForm('ref', { id: Number(b.dataset.ref) }); return; }
    if((b = t.closest('[data-revisado]'))){ const p = b.dataset.revisado.split(':'); abrirForm('revisado', { tipo: p[0], id: Number(p[1]), nombre: b.dataset.nombre }); return; }
    if((b = t.closest('[data-sinp]'))){ abrirForm('sinp', { id: Number(b.dataset.sinp) }); return; }
    if((b = t.closest('[data-vieja]'))){ abrirForm('vieja', { id: Number(b.dataset.vieja) }); return; }
    if((b = t.closest('[data-vistaal]'))){ verAl = b.dataset.vistaal; try { localStorage.setItem('ae_aliados_vista', verAl); } catch (x) {} pintarRegistro(); return; }
    if((b = t.closest('[data-mes]'))){ const k = b.dataset.mes; abiertoMes[k] = !b.parentNode.classList.contains('abierto'); b.parentNode.classList.toggle('abierto', abiertoMes[k]); b.setAttribute('aria-expanded', String(abiertoMes[k])); return; }
    if((b = t.closest('[data-chipal]'))){ chipAl = b.dataset.chipal; pintarRegistro(); return; }
    if((b = t.closest('[data-mesal]'))){ if(b.disabled) return; const [a, m] = mesAl.split('-').map(Number); const d = new Date(a, m - 1 + Number(b.dataset.mesal), 1);
      mesAl = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); guardarUrl(); pintarTabs(); if(tab === 'mes'){ abiertoMesAl(); pintar(); } else if(tab === 'pagos') pintar(); else pintarRegistro(); return; }
    if((b = t.closest('[data-masal]'))){ masAl[b.dataset.masal] = true; pintarRegistro(); return; }
    if((b = t.closest('[data-grupoal]'))){ const k = b.dataset.grupoal; abiertosAl[k] = !b.parentNode.classList.contains('abierto');
      if(abiertosAl[k]){ const v = visto() || {}; v[k] = new Date().toISOString(); guardarVisto(v); }
      pintarRegistro(); return; }
    if((b = t.closest('[data-pagar]'))){ const l = b.dataset.pagar === 'referido' ? (pagos.referidos || []) : (pagos.instalaciones || []); const f = l.find((y) => String(y.id) === b.dataset.id) || {}; abrirForm('pagar', { tipo: b.dataset.pagar, id: Number(b.dataset.id), cliente: f.cliente }); return; }
    if((b = t.closest('[data-form]'))){ abrirForm(b.dataset.form, { modo: b.dataset.modo }); return; }
    if((b = t.closest('[data-res]'))){ const r = b.dataset.res; const rid = resId;
      if(resDemo){ cerrarRes(); return; }
      if(r === 'cerrar' || r === 'ver'){ cerrarRes(); return; }
      cerrarRes();
      if(r === 'inicio' || r === 'solicitudes' || r === 'nueva' || r === 'referidos'){ while(hojaAbierta()) cerrarHoja(true); tab = modo === 'admin' ? 'registro' : r === 'solicitudes' ? 'solicitudes' : r === 'referidos' ? 'referidos' : 'inicio'; pintarTabs(); cargar(); if(r === 'nueva') abrirNueva(); return; }
      if(r === 'referirSol'){ abrirForm('referir', { sol: rid, rif: N && N.rif, cliente: N && N.nombre }); return; }
      if(r === 'whats'){ const d = SOL && SOL.d; window.open(enlaceWa(ajustes.whatsapp_admin || '', 'Hola, sobre la solicitud ' + (d ? d.codigo + ' de ' + d.cliente : '') + ':'), '_blank', 'noopener'); return; }
      if(r.indexOf('form:') === 0){ abrirForm(r.slice(5), {}); return; }
      return; }
    if((b = t.closest('[data-ircard]'))){ chipSol = b.dataset.ircard; tab = 'solicitudes'; mostrar = POR_PAGINA; pintarTabs(); pintar(); return; }
    if((b = t.closest('[data-chipsol]'))){ chipSol = b.dataset.chipsol; mostrar = POR_PAGINA; pintar(); return; }
    if((b = t.closest('[data-otron]')) && N){ N.otro = N.otro === b.dataset.otron ? null : b.dataset.otron; pintarNueva(); return; }
    if((b = t.closest('[data-enlazarn]')) && N){ b.disabled = true; enlazarN(b.dataset.enlazarn, b.dataset.de, false); return; }
    if((b = t.closest('[data-quitarn]')) && N){ b.disabled = true; enlazarN(b.dataset.quitarn, null, true); return; }
    if((b = t.closest('[data-tipon]'))){ if(!N || b.disabled) return; const tp = b.dataset.tipon; try { await rpc('solicitud_crear', { p_tipo: tp }); N.tipo = tp; N.cas = {}; N.estado = null; pintarNueva(); } catch (e) { toast(e.message, 'error'); } return; }
    if((b = t.closest('[data-subirn]'))){ if(b.disabled) return; const k = b.dataset.subirn; elegir((f) => (k === casillasN()[0][0] + ':' + casillasN()[0][1] && N.estado !== 'libre' ? leerRif(f) : subirN(k, f))); return; }
    if((b = t.closest('[data-subirs]'))){ const k = b.dataset.subirs.split(':'); const d = SOL.d; elegir(async (f) => { b.disabled = true; b.textContent = 'Subiendo…'; try { await subir(d.cliente_id, f, k[0], Number(k[1])); toast('Subido. Cuando termines, toca Revisar de nuevo'); } catch (e) { toast(e.message, 'error'); } cargarSol(); }); return; }
    if(!(b = t.closest('[data-acc]'))) return;
    const a = b.dataset.acc;
    if(a === 'nueva') abrirNueva();
    if(a === 'avisosDemo') abrirAvisosDemo();
    else if(a === 'referir') abrirForm('referir', {});
    else if(a === 'referirSol'){ const id = Number(b.dataset.id); const d = SOL && SOL.d && SOL.d.id === id ? SOL.d : null; abrirForm('referir', { sol: id, rif: d ? d.rif : N && N.rif, cliente: d ? d.cliente : N && N.nombre }); }
    else if(a === 'reintentar') cargar();
    else if(a === 'reintentarSol') cargarSol();
    else if(a === 'mas'){ mostrar += POR_PAGINA; pintar(); }
    else if(a === 'excel') excel();
    else if(a === 'masAsamblea'){ N.asambleas = Math.min(4, N.asambleas + 1); pintarNueva(); }
    else if(a === 'masRep'){ N.reps = Math.min(4, N.reps + 1); pintarNueva(); }
    else if(a === 'enviarN') enviarN();
    else if(a === 'guardarN') guardarN(b);
    else if(a === 'guardarForm') guardarForm(b, false);
    else if(a === 'rechazarRef') guardarForm(b, true);
    else if(a === 'whats'){ const d = SOL && SOL.d; window.open(enlaceWa(ajustes.whatsapp_admin || '', 'Hola, sobre la solicitud ' + (d ? d.codigo + ' de ' + d.cliente : '') + ':'), '_blank', 'noopener'); }
    else if(a === 'guardarWa'){
      const er = $('eWaAdm'); er.textContent = ''; b.disabled = true; b.textContent = 'Guardando…';
      try { await rpc('ajuste_guardar', { p_clave: 'whatsapp_admin', p_valor: valor('waAdm') }); ajustes = (await rpc('ajustes_app', {})) || ajustes; toast('WhatsApp guardado'); pintarAliadosAdm(); }
      catch (e) { er.textContent = e.message; b.disabled = false; b.textContent = 'Guardar'; }
    }
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
  document.addEventListener('change', (ev) => { const el = ev.target; if(el.dataset && el.dataset.enlazar) enlazar(el);
    if(el.id === 'alAliadoF'){ aliadoF = el.value; guardarUrl(); if(tab === 'registro' || tab === 'sinp') pintarRegistro(); else pintar(); } });
  // Lote 12/11 B: se arrastra en todo el drawer; cada archivo va a la casilla donde se suelta (sin adivinar por el nombre).
  // Antes de que el RIF diga "disponible", lo que se suelta se lee como el RIF.
  const sinSobre = () => Array.prototype.forEach.call(document.querySelectorAll('#hojaNueva .sobre'), (x) => x.classList.remove('sobre'));
  document.addEventListener('dragover', (ev) => { const d = ev.target.closest && ev.target.closest('#hojaNueva'); if(!d || !N || !N.tipo || !N.id) return; ev.preventDefault(); sinSobre();
    const z = ev.target.closest('[data-casn]'); if(z && (N.estado === 'libre' || z.dataset.casn === kDe(casillasN()[0]))) z.classList.add('sobre'); });
  document.addEventListener('dragleave', (ev) => { const d = $('hojaNueva'); if(d && !d.contains(ev.relatedTarget)) sinSobre(); });
  document.addEventListener('drop', (ev) => { const d = ev.target.closest && ev.target.closest('#hojaNueva'); if(!d || !N || !N.tipo || !N.id) return; ev.preventDefault(); sinSobre();
    const f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0]; if(!f) return;
    const z = ev.target.closest('[data-casn]'); const k0 = kDe(casillasN()[0]);
    if(N.estado !== 'libre'){ if(['leyendo', 'cartera', 'otro', 'repetida'].indexOf(N.estado) < 0) leerRif(f); return; }
    if(!z || z.dataset.casn === k0){ toast('Suéltalo sobre la casilla que le toca', 'error'); return; }
    const st = N.cas[z.dataset.casn]; if(st && (st.estado === 'subiendo' || st.estado === 'enlazado')) return;
    subirN(z.dataset.casn, f); });
  let tBuscaAl = null;
  $('buscaAl').addEventListener('input', () => { clearTimeout(tBuscaAl); tBuscaAl = setTimeout(() => { buscaAl = $('buscaAl').value.trim().slice(0, 60); pintarRegistro(); }, 160); });
  $('alArchivo').addEventListener('change', () => { const f = ($('alArchivo').files || [])[0]; const fn = destino; destino = null; if(f && fn) fn(f); });
  document.addEventListener('visibilitychange', () => { if(!document.hidden && yo && !hojaAbierta()) cargar(); });
  document.addEventListener('hoja-cerrada', () => {});

  window.Armazon.arrancar(['admin', 'aliado', 'analista', 'lider', 'abogado'], { activo: 'aliados' }, (p) => {
    yo = p;
    modo = yo.rol === 'admin' ? 'admin' : yo.rol === 'aliado' ? 'aliado' : yo.rol === 'analista' && yo.canales ? 'canales' : 'equipo';
    if(window.Ficha && modo === 'admin'){ window.Ficha.montar(); }
    document.querySelector('main.pagina').classList.add('al-m-' + modo);   // Lote 12/11: el aliado en PC lleva el menú a la izquierda
    holaTx = 'Hola, ' + (window.Comun.primerNombre(yo.nombre) || yo.nombre);
    $('titulo').textContent = modo === 'equipo' || modo === 'admin' ? 'Aliados comerciales' : holaTx;
    leerUrl(); pintarTabs(); cargar(); cargarAjustes();
    if(window.Resumen && (modo === 'admin' || modo === 'equipo')) window.Resumen.enModulo({ modulo: 'aliados', yo: p });   // lote 27/10
    const s = Number(new URLSearchParams(location.search).get('s')) || 0;
    if(s){ resPara = modo === 'aliado' ? s : null; abrirSol(s); }
    // Lote 12/11 B: desde Mi trabajo, el referido abre su hoja cuando cargó la lista
    const rf = Number(new URLSearchParams(location.search).get('ref')) || 0;
    if(rf){ let n = 0; const t = setInterval(() => { n++; if((fuente().referidos || []).some((y) => y.id === rf)){ clearInterval(t); abrirForm('ref', { id: rf }); } else if(n > 40) clearInterval(t); }, 250); }
  }, (p) => { yo = p; });
})();
