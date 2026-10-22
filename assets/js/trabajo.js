// Mi trabajo (lote 22/10, maqueta aprobada en claude/maquetas/mi-trabajo): por rol, sobre privado.pendientes (RPC mi_trabajo).
// Arriba el saludo y las píldoras; tarjetas por grupo (tocar filtra la lista); "Para hoy" ordenado por urgencia con un botón que hace la acción;
// a la derecha la cola, las gestiones, el equipo (o la cola) y los indicadores del rol. Cada tarea sale sola cuando se resuelve.
(function(){
  'use strict';
  const C = window.Comun;
  const { $, esc, ic, rpc, toast, cache, vacio, fecha, plural } = C;
  // Iconos de las tarjetas (trazos de la maqueta)
  const I = {
    doc: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4', firma: 'M3 17c3 0 4-6 7-6s2 6 5 6 4-3 6-3M3 21h18',
    inst: 'M12 2v6M5 9h14l-1 11H6zM9 13v4M15 13v4', meta: 'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zM12 12h.01',
    emitir: 'M22 2L11 13M22 2l-7 20-4-9-9-4z', sobre: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6',
    ip: 'M5 12h14M12 5v14M4 4h16v16H4z', pago: 'M2 7h20v12H2zM2 11h20M6 15h3', lupa: 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM21 21l-4.3-4.3',
    contrato: 'M6 2h9l5 5v15H6zM14 2v6h6M9 14l2 2 4-4', decidir: 'M12 3v18M3 7l9-4 9 4M5 7l-2 6a4 4 0 0 0 4 0zM19 7l-2 6a4 4 0 0 0 4 0z',
    alerta: 'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01', mas: 'M12 5v14M5 12h14'
  };
  // Grupos por rol: [id, título, línea, icono, tono, tipos]
  const GRUPOS = {
    lider: [['doc', 'Conseguir documentos', 'Faltan o Legal los devolvió', 'doc', 'b', ['docs_faltan', 'devuelto', 'sin_gestion', 'vgt', 'poliza', 'referido', 'rif_verificar']],
      ['fir', 'Hacer firmar', 'Contratos y planillas', 'firma', 'm', ['por_firmar', 'planilla']],
      ['ins', 'Por instalar', 'Ventas con orden en Odoo', 'inst', 'v', ['por_instalar']],
      ['ges', 'Mis gestiones', 'Metas con plazo', 'meta', 'a', ['gestion']]],
    analista: [['emi', 'Emitir cambios', 'Migraciones con documentos aprobados', 'emitir', 'b', ['cambio_emitir']],
      ['bien', 'Bienvenidas y proformas', 'Instalados del corte', 'sobre', 'v', ['por_enviar', 'sin_ip']],
      ['ip', 'IP por confirmar', 'El reporte no cuadró', 'ip', 'm', ['ip_confirmar']],
      ['pago', 'Revisar pago', 'Más de un servicio o factura nueva', 'pago', 'a', ['revisar_pago']]],
    abogado: [['con', 'Elaborar contrato', 'Clientes en Documentos recibidos', 'contrato', 'b', ['elaborar_contrato']],
      ['fir', 'Por firmar', 'Contrato enviado al cliente', 'firma', 'm', ['seguir_firma']],
      ['arch', 'Firmado sin archivo', 'Falta el escaneado o el vencimiento', 'doc', 'a', ['contrato_archivo']],
      ['ven', 'Por vencer', 'Contratos en los próximos 60 días', 'alerta', 'g', ['contrato_vence']]],
    admin: [['rev', 'Revisar documentos', 'Lo que suben líderes, aliados y el correo', 'lupa', 'b', ['revisar_docs', 'cambio_revisar']],
      ['dec', 'Por decidir', 'Corte, comisiones y sin registro', 'decidir', 'r', ['cerrar_corte', 'certificar', 'por_asignar', 'sin_registro', 'sin_cliente', 'sin_servicio', 'rif_verificar']],
      ['ali', 'Aliados', 'Permisos y bloqueos', 'inst', 'm', ['aliado_permisos', 'aliado_sin_permiso']],
      ['ale', 'Alertas', 'Cargas raras', 'alerta', 'a', ['alerta_carga']]]
  };
  GRUPOS.coord = GRUPOS.analista;
  // Qué se hace con cada tipo: [acción, botón]
  const ACC = {
    docs_faltan: ['Conseguir documentos', 'Pedir'], devuelto: ['Corregir documento devuelto', 'Pedir'], sin_gestion: ['Pedir documentos', 'Pedir'], vgt: ['Completar requisitos VGT', 'Subir'],
    poliza: ['Renovar póliza', 'Pedir'], referido: ['Contactar referido', 'Contactar'], rif_verificar: ['Verificar RIF', 'Revisar'], por_firmar: ['Hacer firmar contrato', 'Enviar'],
    planilla: ['Documentos del cambio', 'Subir'], por_instalar: ['Instalación pendiente', 'Ver orden'], gestion: ['Dar seguimiento', 'Registrar'],
    cambio_emitir: ['Emitir en Proham', 'Marcar hecho'], por_enviar: ['Enviar bienvenida y proforma', 'Enviar'], sin_ip: ['Falta la IP', 'Escribir IP'], ip_confirmar: ['Confirmar IP', 'Confirmar'],
    revisar_pago: ['Revisar pago', 'Revisar'], elaborar_contrato: ['Elaborar contrato', 'Elaborar'], seguir_firma: ['Seguir firma', 'Ver'], contrato_archivo: ['Subir contrato firmado', 'Subir'],
    contrato_vence: ['Contrato por vencer', 'Ver'], revisar_docs: ['Revisar expediente', 'Revisar'], cambio_revisar: ['Revisar documentos del cambio', 'Revisar'],
    cerrar_corte: ['Cerrar corte', 'Revisar y cerrar'], certificar: ['Para certificar', 'Ver'], por_asignar: ['Asignar orden', 'Asignar'], sin_registro: ['Cambio sin registro', 'Asignar líder'],
    sin_cliente: ['Instalación sin cliente', 'Ver'], sin_servicio: ['Instalación sin servicio', 'Ver'], aliado_permisos: ['Permisos de aliados', 'Revisar'], aliado_sin_permiso: ['Instalado sin permiso', 'Revisar'],
    alerta_carga: ['Carga rara', 'Revisar']
  };
  const RANGO = { admin: 'Administrador', coord: 'Coordinador', analista: 'Analista', abogado: 'Legal', lider: 'Líder' };
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  let yo = null; let D = null; let sel = ''; let persona = ''; let pedido = 0; let cuantos = 40; let cola = null;

  function leerUrl(){ const u = new URLSearchParams(location.search); sel = (u.get('g') || '').slice(0, 10); persona = (u.get('p') || '').slice(0, 40); }
  function guardarUrl(){ const u = new URLSearchParams(); if(sel) u.set('g', sel); if(persona) u.set('p', persona); const s = u.toString(); history.replaceState(history.state, '', location.pathname + (s ? '?' + s : '')); }

  async function cargar(){
    const mio = ++pedido; const clave = 'mitrabajo:' + (yo && yo.id) + ':' + persona;
    if(!D){ const g = cache.leer(clave); if(g){ D = g; pintar(); } else esqueleto(); }
    try {
      const r = await rpc('mi_trabajo', { p_persona: persona || null }); if(mio !== pedido) return;
      D = r; cache.guardar(clave, r); pintar(); if(cola) seguirCola();
    } catch (e) {
      if(mio !== pedido) return;
      if(!D) $('cuerpo').innerHTML = '<div class="vacio" role="alert"><b>No se pudo cargar tu trabajo</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" data-tr="reintentar">Reintentar</button></div>';
      toast(e.message, 'error');
    }
  }
  function esqueleto(){
    $('tarjetas').innerHTML = '<span class="sk mt-sk g2"></span><span class="sk mt-sk"></span><span class="sk mt-sk"></span><span class="sk mt-sk"></span>';
    $('cuerpo').innerHTML = '<div class="sk-bloque"><span class="sk" style="height:64px;border-radius:16px"></span><span class="sk" style="height:64px;border-radius:16px"></span><span class="sk" style="height:64px;border-radius:16px"></span></div>';
  }
  const hoyD = () => D.hoy;
  const color = (f) => f.vence < hoyD() ? 'venc' : f.vence === hoyD() ? 'hoy' : 'ok';
  function gruposDe(){
    const gs = (GRUPOS[D.vista] || GRUPOS.lider).map((g) => ({ id: g[0], titulo: g[1], sub: g[2], icono: g[3], tono: g[4], tipos: g[5] }));
    const usados = [].concat.apply([], gs.map((g) => g.tipos));
    const otros = (D.items || []).filter((f) => usados.indexOf(f.tipo) < 0);
    if(otros.length) gs.push({ id: 'otros', titulo: 'Otras tareas', sub: 'Lo demás que te toca', icono: 'mas', tono: 'g', tipos: Array.from(new Set(otros.map((f) => f.tipo))) });
    gs.forEach((g) => { g.items = (D.items || []).filter((f) => g.tipos.indexOf(f.tipo) >= 0); g.venc = g.items.filter((f) => color(f) === 'venc').length; g.hoy = g.items.filter((f) => color(f) === 'hoy').length; });
    return gs;
  }
  const diasDesde = (t) => Math.max(0, C.diasEntre(String(t || '').slice(0, 10), hoyD()) || 0);
  function pieDe(g){
    if(g.id === 'ges'){ const x = (D.gestiones || [])[0]; return x ? [x.nombre, x.hechos + ' de ' + x.total] : ['Sin gestiones activas', '']; }
    if(!g.items.length) return ['Nada pendiente', ''];
    const viejo = g.items.reduce((a, f) => (String(f.desde) < String(a.desde) ? f : a), g.items[0]);
    const nuevos = g.items.filter((f) => diasDesde(f.desde) === 0).length;
    return ['Más viejo: ' + plural(diasDesde(viejo.desde), 'día', 'días'), nuevos ? plural(nuevos, 'nuevo hoy', 'nuevos hoy') : String(g.items.length)];
  }
  function saludo(){
    const h = Number(new Intl.DateTimeFormat('es-VE', { hour: 'numeric', hour12: false, timeZone: 'America/Caracas' }).format(new Date()));
    return (h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches') + ', ' + C.primerNombre(D.nombre || (yo && yo.nombre) || '');
  }
  // La frase del momento
  function frase(){
    if(D.persona) return 'Estás viendo el trabajo de ' + D.persona.nombre + '.';
    const mes = MESES[Number(String(D.corte).slice(5, 7)) - 1] || ''; const lim = D.limite ? fecha(D.limite).replace(/ de \d{4}$/, '') : '';
    const k = D.kpis || {};
    if(D.vista === 'lider') return 'El corte de ' + mes + ' cierra el ' + lim + '.' + (k.falta ? ' Te ' + (k.falta === 1 ? 'falta 1 cliente' : 'faltan ' + k.falta + ' clientes') + ' para comisionar.' : '');
    if(D.vista === 'abogado') return 'Entran aquí los clientes en Documentos recibidos: toca el contrato.';
    if(D.vista === 'coord') return 'Ves el trabajo de todos los analistas y puedes hacerlo tú si hace falta.';
    if(D.vista === 'analista') return 'Lo de los clientes de tus líderes. El corte de ' + mes + ' cierra el ' + lim + '.';
    return 'Corte de ' + mes + ' abierto · día límite ' + lim + '.';
  }
  function pintar(){
    if(!D) return;
    window.Gestiones.puedeCrear = !!D.puedo_crear_gestion;
    const gs = gruposDe(); if(sel && !gs.some((g) => g.id === sel)) sel = '';
    const it = D.items || []; const venc = it.filter((f) => color(f) === 'venc').length; const hoy = it.filter((f) => color(f) === 'hoy').length;
    $('saludo').textContent = saludo(); $('frase').textContent = frase();
    $('pildoras').innerHTML = '<span class="mt-pill r">' + plural(venc, 'vencido', 'vencidos') + '</span><span class="mt-pill a">' + (hoy === 1 ? '1 vence hoy' : hoy + ' vencen hoy') + '</span><span class="mt-pill g">' + it.length + ' en total</span>';
    const vp = $('volverPersona'); vp.classList.toggle('hidden', !D.persona);
    // Coordinador y jefes: ver por persona
    const zp = $('zonaPersona'); const ps = D.personas || []; zp.classList.toggle('hidden', !ps.length);
    if(ps.length) $('persona').innerHTML = '<option value="">' + (D.rol === 'admin' || D.senior ? 'Mi trabajo' : 'Todos los analistas') + '</option>' +
      ps.map((p) => '<option value="' + esc(p.id) + '"' + (p.id === persona ? ' selected' : '') + '>' + esc(p.nombre + ' (' + ({ lider: 'líder', abogado: 'Legal', analista: 'analista' }[p.rol] || p.rol) + ')') + '</option>').join('');
    $('tarjetas').innerHTML = gs.map((g, i) => {
      const p = pieDe(g); const on = sel === g.id;
      return '<button type="button" class="mt-card' + (i === 0 ? ' g2' : '') + (on ? ' sel' : '') + '" data-grupo="' + g.id + '" aria-pressed="' + on + '">' +
        '<span class="mt-top"><span class="mt-ico t-' + g.tono + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + I[g.icono] + '"/></svg></span><span><b>' + esc(g.titulo) + '</b><small>' + esc(g.sub) + '</small></span></span>' +
        '<span class="mt-num"><span class="mt-big">' + g.items.length + '</span>' + (g.venc ? '<span class="mt-pill r">' + plural(g.venc, 'vencido', 'vencidos') + '</span>' : '') + (g.hoy ? '<span class="mt-pill a">' + g.hoy + ' hoy</span>' : '') + '</span>' +
        '<span class="mt-pie"><span>' + esc(p[0]) + '</span><b>' + esc(p[1]) + '</b></span></button>';
    }).join('');
    pintarLista(gs); pintarLado();
  }
  function plazo(f){
    const c = color(f); if(c === 'venc') return ['r', 'Vencido']; if(c === 'hoy') return ['a', 'Hoy'];
    const d = C.diasEntre(hoyD(), f.vence); return ['g', d === 1 ? 'Mañana' : d <= 7 ? 'En ' + d + ' días' : fecha(f.vence).replace(/ de \d{4}$/, '')];
  }
  function pintarLista(gs){
    const g = gs.find((x) => x.id === sel); const l = g ? g.items : (D.items || []);
    const orden = l.slice().sort((a, b) => (a.vence < b.vence ? -1 : a.vence > b.vence ? 1 : String(a.desde) < String(b.desde) ? -1 : 1));
    let h = '<div class="mt-sec"><div><h2>' + esc(g ? g.titulo : 'Para hoy') + '</h2><small>Ordenado por urgencia. Cada tarea sale sola cuando se resuelve.</small></div>' +
      (sel ? '<button type="button" class="enlace" data-tr="todo">Ver todo</button>' : '') + '</div>';
    if(!orden.length) h += vacio(g ? 'Nada en ' + g.titulo : 'Todo al día', g ? 'Cuando haya algo aquí, aparece en esta lista.' : 'No tienes pendientes. Cuando algo necesite de ti, aparece aquí.');
    else h += orden.slice(0, cuantos).map(filaHtml).join('') + (orden.length > cuantos ? '<button type="button" class="btn btn-chico btn-2 mt-mas" data-tr="mas">Ver ' + Math.min(40, orden.length - cuantos) + ' más de ' + (orden.length - cuantos) + '</button>' : '');
    $('cuerpo').innerHTML = h;
  }
  function filaHtml(f){
    const p = plazo(f); const a = ACC[f.tipo] || [f.tipo, 'Abrir']; const c = color(f);
    const nuevo = c === 'ok' && diasDesde(f.desde) === 0;
    const quien = [D.vista !== 'lider' && f.lider ? 'Líder ' + f.lider : '', (D.vista === 'coord' || D.vista === 'admin') && f.analista ? 'Analista ' + f.analista : ''].filter(Boolean).join(' · ');
    const yoNo = D.vista === 'coord' && f.analista_id && yo && f.analista_id !== yo.id;
    return '<div class="mt-it"><span class="mt-dot ' + (nuevo ? 'n' : c) + '" aria-hidden="true"></span><span class="mt-txt"><b>' + esc(a[0]) + ' <span>· ' + esc(f.titulo) + '</span></b><small>' + esc(f.detalle || '') + (quien ? ' · ' + esc(quien) : '') + '</small></span>' +
      '<span class="mt-pill ' + p[0] + '">' + esc(p[1]) + '</span><button type="button" class="btn btn-chico ' + (c === 'venc' ? '' : 'btn-2') + '" data-hacer="' + esc(f.tipo + '|' + f.clave) + '">' + esc(yoNo ? 'Hacerlo yo' : a[1]) + '</button></div>';
  }
  function pintarLado(){
    let h = '';
    // Cola: el administrador revisa y Legal elabora, del más viejo al más nuevo
    const enCola = D.vista === 'admin' ? (D.items || []).filter((f) => f.tipo === 'revisar_docs') : D.vista === 'abogado' ? (D.items || []).filter((f) => f.tipo === 'elaborar_contrato') : [];
    if(enCola.length && !D.persona) h += '<div class="mt-cola"><b>' + (D.vista === 'admin' ? 'Revisión en cola' : 'Contratos en cola') + '</b><p>' + esc(plural(enCola.length, D.vista === 'admin' ? 'expediente' : 'cliente', D.vista === 'admin' ? 'expedientes' : 'clientes')) +
      ', del más viejo al más nuevo. Al cerrar uno se abre el siguiente.</p><button type="button" class="btn btn-chico" data-tr="cola">' + (D.vista === 'admin' ? 'Empezar a revisar' : 'Empezar') + '</button></div>';
    // Gestiones con su avance
    const gs = D.gestiones || [];
    if(gs.length || D.puedo_crear_gestion){
      h += '<div class="mt-panel"><h3>' + (D.vista === 'lider' ? 'Mis gestiones' : 'Gestiones activas') + (D.puedo_crear_gestion ? '<button type="button" class="enlace" data-ges="nueva">Nueva gestión</button>' : '') + '</h3>' +
        (gs.length ? gs.map((g) => { const pct = g.total ? Math.round(g.hechos * 100 / g.total) : 0; const d = C.diasEntre(hoyD(), g.plazo); const e = g.estados || {};
          return '<button type="button" class="mt-ges" data-ges="' + esc(g.id) + '"><span class="mt-ges-t"><b>' + esc(g.nombre) + '</b><span class="mt-pill ' + (d <= 2 ? 'a' : 'g') + '">' + esc(d < 0 ? 'Venció' : d === 0 ? 'Vence hoy' : d === 1 ? 'Falta 1 día' : 'Faltan ' + d + ' días') + '</span></span>' +
            '<small>' + esc(window.Gestiones.META[g.meta] || g.meta) + '</small><span class="mt-barra" aria-hidden="true"><i style="transform:scaleX(' + (pct / 100).toFixed(3) + ')"></i></span>' +
            '<small><b>' + g.hechos + ' de ' + g.total + '</b>' + esc([e.esperando ? e.esperando + ' esperando' : '', e.sin_contacto ? e.sin_contacto + ' sin contacto' : ''].filter(Boolean).map((x) => ' · ' + x).join('')) + '</small></button>'; }).join('')
          : '<p class="nota-chica">No hay gestiones activas. Crea una para seguir un grupo de clientes con meta y plazo.</p>') + '</div>';
    }
    // Equipo: vencidos y de hoy por persona; al tocar se ve su lista
    const eq = D.equipo || [];
    if(eq.length) h += '<div class="mt-panel"><h3>Equipo <small>vencidos · hoy</small></h3>' + eq.slice(0, 12).map((e) => '<button type="button" class="mt-eq" data-persona="' + esc(e.id) + '"><span class="mt-av">' + esc(C.iniciales(e.nombre)) + '</span>' +
      '<span class="mt-eq-n"><b>' + esc(e.nombre) + '</b><small>' + esc(e.rol + ' · ' + plural(e.n, 'pendiente', 'pendientes')) + '</small></span><span class="mt-pill ' + (e.venc ? 'r' : 'g') + '">' + e.venc + '</span><span class="mt-pill a">' + e.hoy + '</span></button>').join('') + '</div>';
    // Indicadores del rol
    const k = D.kpis || {}; const mes = MESES[Number(String(D.corte).slice(5, 7)) - 1] || '';
    const KP = { lider: ['Mi corte de ' + mes, [[k.instalaciones, 'instalaciones'], [k.comisionan, 'comisionan'], [k.falta, 'les falta algo'], [k.migraciones, 'migraciones']]],
      admin: ['Corte de ' + mes, [[k.instalaciones, 'instalaciones'], [k.comisionan, 'comisionan'], [k.migraciones, 'migraciones'], [k.negativos, 'cambios a residencial']]],
      abogado: ['Contratos', [[k.recibidos, 'documentos recibidos'], [k.por_firmar, 'por firmar'], [k.firmados, 'firmados en 7 días'], [k.sin_archivo, 'sin archivo']]],
      analista: ['Mi semana', [[k.emitidos, 'cambios emitidos'], [k.dias_emitir === null || k.dias_emitir === undefined ? 'Sin datos' : String(k.dias_emitir).replace('.', ',') + ' días', 'tiempo para emitir'], [k.bienvenidas, 'bienvenidas enviadas'], [(D.items || []).filter((f) => f.tipo === 'ip_confirmar').length, 'IP por confirmar']]],
      coord: ['Equipo esta semana', [[k.emitidos, 'cambios emitidos'], [k.dias_emitir === null || k.dias_emitir === undefined ? 'Sin datos' : String(k.dias_emitir).replace('.', ',') + ' días', 'tiempo para emitir'], [k.bienvenidas, 'bienvenidas'], [k.yo, 'tareas que hice yo']]] };
    const kp = KP[D.vista] || KP.lider;
    h += '<div class="mt-panel"><h3>' + esc(kp[0]) + '</h3><div class="mt-kpi">' + kp[1].map((x) => '<div><b>' + esc(x[0] === undefined || x[0] === null ? 0 : x[0]) + '</b><small>' + esc(x[1]) + '</small></div>').join('') + '</div></div>';
    $('lado').innerHTML = h;
  }

  // ---------- Hacer la acción ahí mismo ----------
  const buscar = (k) => (D.items || []).find((f) => f.tipo + '|' + f.clave === k);
  function hacer(f){
    const ref = f.ref || {};
    if(f.tipo === 'gestion'){ window.Gestiones.abrir(ref.gestion, { cliente: f.cliente_id, alCerrar: cargar }); return; }
    if(ref.cambio){ location.href = 'migraciones.html?f=' + ({ cambio_emitir: 'por_emitir', sin_registro: 'sin_registro', cambio_revisar: 'por_revisar', planilla: 'por_revisar' }[f.tipo] || '') + '&c=' + encodeURIComponent(ref.cambio); return; }
    if(f.tipo === 'cerrar_corte' || ((f.tipo === 'certificar' || f.tipo === 'sin_cliente' || f.tipo === 'sin_servicio' || f.tipo === 'por_asignar') && !f.cliente_id)){ location.href = 'comisiones.html'; return; }
    if(f.tipo === 'aliado_permisos'){ location.href = 'aliados.html'; return; }
    if(f.tipo === 'aliado_sin_permiso'){ location.href = 'aliados.html?t=sinp'; return; }
    if(f.tipo === 'alerta_carga'){ location.href = ref.no_aparece ? 'clientes.html' : 'actualizar.html'; return; }
    if(f.tipo === 'referido' && !f.cliente_id){ location.href = 'aliados.html'; return; }
    if(f.tipo === 'por_instalar' && !f.cliente_id){ location.href = 'comisiones.html?t=instalar'; return; }
    if(!f.cliente_id){ location.href = 'comisiones.html'; return; }
    const tab = ['certificar', 'por_enviar', 'sin_ip', 'revisar_pago'].indexOf(f.tipo) >= 0 ? 'comision' : f.tipo === 'ip_confirmar' ? 'datos'
      : ['elaborar_contrato', 'seguir_firma', 'contrato_archivo', 'contrato_vence', 'por_firmar'].indexOf(f.tipo) >= 0 ? 'contrato'
      : ['docs_faltan', 'devuelto', 'vgt', 'poliza', 'revisar_docs', 'cambio_revisar'].indexOf(f.tipo) >= 0 ? 'documentos' : '';
    const pedir = ['docs_faltan', 'devuelto', 'sin_gestion'].indexOf(f.tipo) >= 0 ? (f.tipo === 'sin_gestion' ? 'pedir' : 'recordar') : undefined;
    window.Ficha.abrir(f.cliente_id, { yo, tab, revisar: f.tipo === 'revisar_docs' || f.tipo === 'cambio_revisar', pedir, alCerrar: alCerrarFicha });
  }
  // Cola de revisión (administrador) o de contratos (Legal): al cerrar uno se ofrece el siguiente
  function empezarCola(){
    const tipo = D.vista === 'admin' ? 'revisar_docs' : 'elaborar_contrato';
    const l = (D.items || []).filter((f) => f.tipo === tipo).sort((a, b) => (String(a.desde) < String(b.desde) ? -1 : 1));
    if(!l.length) return; cola = { tipo, hechos: [l[0].clave] }; hacer(l[0]);
  }
  function alCerrarFicha(){ cargar(); }
  function seguirCola(){
    if(!cola || C.hojaAbierta()) return;
    const sig = (D.items || []).filter((f) => f.tipo === cola.tipo && cola.hechos.indexOf(f.clave) < 0).sort((a, b) => (String(a.desde) < String(b.desde) ? -1 : 1))[0];
    const z = $('barraCola');
    if(!sig){ cola = null; z.classList.add('hidden'); toast('Terminaste la cola'); return; }
    z.innerHTML = '<span>Siguiente: <b>' + esc(sig.titulo) + '</b></span><button type="button" class="btn btn-chico btn-2" data-tr="parar">Terminar</button><button type="button" class="btn btn-chico" data-tr="seguir" data-clave="' + esc(sig.clave) + '">Seguir</button>';
    z.classList.remove('hidden');
  }

  document.addEventListener('click', (ev) => {
    const t = ev.target; let b;
    if((b = t.closest('[data-grupo]')) && b.closest('#tarjetas')){ sel = sel === b.dataset.grupo ? '' : b.dataset.grupo; cuantos = 40; guardarUrl(); pintar(); return; }
    if((b = t.closest('[data-hacer]'))){ const f = buscar(b.dataset.hacer); if(f) hacer(f); return; }
    if((b = t.closest('[data-persona]'))){ persona = b.dataset.persona; sel = ''; guardarUrl(); D = null; cargar(); window.scrollTo(0, 0); return; }
    if((b = t.closest('[data-ges]'))){ const g = b.dataset.ges; if(g === 'nueva') window.Gestiones.nueva({ alCrear: cargar }); else window.Gestiones.abrir(Number(g), { alCerrar: cargar }); return; }
    if((b = t.closest('[data-tr]'))){
      const a = b.dataset.tr;
      if(a === 'reintentar') cargar(); else if(a === 'todo'){ sel = ''; guardarUrl(); pintar(); } else if(a === 'mas'){ cuantos += 40; pintar(); }
      else if(a === 'volver'){ persona = ''; guardarUrl(); D = null; cargar(); }
      else if(a === 'cola') empezarCola();
      else if(a === 'parar'){ cola = null; $('barraCola').classList.add('hidden'); }
      else if(a === 'seguir' && cola){ const f = (D.items || []).find((x) => x.tipo === cola.tipo && x.clave === b.dataset.clave); $('barraCola').classList.add('hidden'); if(f){ cola.hechos.push(f.clave); hacer(f); } }
    }
  });
  $('persona').addEventListener('change', () => { persona = $('persona').value; sel = ''; guardarUrl(); D = null; cargar(); });
  document.addEventListener('visibilitychange', () => { if(!document.hidden && yo && !C.hojaAbierta()) cargar(); });

  window.Armazon.arrancar(['admin', 'analista', 'lider', 'abogado'], { activo: 'trabajo' }, (p) => {
    yo = p; window.Ficha.montar(); leerUrl(); cargar();
  }, (p) => { yo = p; });
})();
