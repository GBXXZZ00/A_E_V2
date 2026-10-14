// Inicio: saludo, días para el corte, pendientes según el rol y accesos a los módulos.
(function(){
  'use strict';
  const { $, esc, ic, rpc, cache, toast, fecha, fechaDia, mes, plural, primerNombre, capital, hoyClave } = window.Comun;
  const S = window.Sesion;
  const K_OCULTO = 'ae_pend_oculto';

  const PRONTO = [
    { id: 'dedicados', nombre: 'Dedicados', icono: 'servidor', roles: ['admin', 'abogado', 'analista'] }
  ];

  function pintarCorte(d){
    const c = d.corte; if(!c){ $('zonaCorte').innerHTML = ''; return; }
    const m = mes(c.etiqueta); const com = d.comision || {};
    const titulo = c.dias <= 0 ? 'Hoy es el límite del corte de ' + m : (c.dias === 1 ? 'día' : 'días') + ' para el límite del corte de ' + m;
    const detalle = 'Instalaciones del ' + fecha(c.inicio) + ' al ' + fecha(c.fin) + '. Legal y pago hasta el ' + fecha(c.limite || c.fin).split(' de ')[0] + '.' +
      (com.total ? ' ' + com.cumplen + ' de ' + plural(com.total, 'instalación', 'instalaciones') + ' ya ' + (com.cumplen === 1 ? 'cumple' : 'cumplen') + '.' : '');
    $('zonaCorte').innerHTML = '<a class="corte" href="comisiones.html" data-ir="corte">' +
      '<div class="dias">' + (c.dias <= 0 ? ic('reloj', 'g') : esc(c.dias)) + '</div>' +
      '<div class="cuerpo"><b>' + esc(titulo) + '</b><small>' + esc(detalle) + '</small>' +
      '<div class="linea"><i style="transform:scaleX(' + Math.max(0, Math.min(100, Number(c.avance) || 0)) / 100 + ')"></i></div></div>' + ic('derecha', 'ch') + '</a>';
  }

  // Cada rol ve lo que le toca resolver
  function pendientes(d, rol){
    const c = d.clientes || {}; const com = d.comision || {}; const r = [];
    const admin = rol === 'admin', legal = rol === 'abogado', lider = rol === 'lider', analista = rol === 'analista';
    if((admin || analista) && window.ACTUALIZAR_LISTO && (d.tad_dias === null || d.tad_dias === undefined || d.tad_dias >= 2)){
      r.push({ c: 'rojo', i: 'actualizar', t: d.tad_dias === null || d.tad_dias === undefined ? 'Todavía no se ha cargado el TAD' : 'TAD sin cargar hace ' + plural(d.tad_dias, 'día', 'días'),
        s: 'Sin TAD no se actualiza el pago de instalación', e: 'actualizar.html', k: 'tad' });
    }
    if((admin || legal) && c.por_revisar > 0){
      r.push({ c: 'ambar', i: 'doc', t: plural(c.por_revisar, 'expediente', 'expedientes') + ' por revisar',
        s: c.por_revisar_dias > 0 ? 'El más viejo espera ' + plural(c.por_revisar_dias, 'día', 'días') : 'Llegaron hoy', e: 'clientes.html?f=por_revisar', k: 'por_revisar' });
    }
    // Lote 6: lo que vive en la bandeja "Mi trabajo" se cuenta una sola vez, desde la misma fuente del servidor
    const T = d.trabajo; const conBandeja = !!T && (lider || analista || admin);
    if(conBandeja){
      const g = T.tipos || {}; const suma = (ts) => ts.reduce((a, k) => [a[0] + ((g[k] || {}).n || 0), a[1] + ((g[k] || {}).rojo || 0)], [0, 0]);
      const GR = lider ? [['docs', ['docs_faltan', 'devuelto'], 'cliente con documentos pendientes', 'clientes con documentos pendientes', 'doc'], ['firmar', ['por_firmar'], 'contrato por firmar', 'contratos por firmar', 'lapiz'],
          ['titular', ['planilla'], 'cambio de titular con documentos por subir', 'cambios de titular con documentos por subir', 'cambio', 'migraciones.html'], ['referidos', ['referido'], 'referido por contactar', 'referidos por contactar', 'usuarios'],
          ['vgt', ['vgt'], 'dedicado con requisitos VGT', 'dedicados con requisitos VGT', 'servidor'], ['gestion', ['sin_gestion'], 'cliente sin gestión', 'clientes sin gestión', 'alerta']]
        : [['cambios', ['cambio_emitir'], 'cambio por emitir', 'cambios por emitir', 'cambio', 'migraciones.html?f=por_emitir'], ['enviar', ['por_enviar'], 'proforma y carta por enviar', 'proformas y cartas por enviar', 'enviar'],
          ['ip', ['sin_ip'], 'servicio sin IP', 'servicios sin IP', 'alerta'], ['datos', ['rif_verificar', 'sin_cliente', 'sin_servicio'], 'dato por corregir', 'datos por corregir', 'lapiz'],
          ['sinsol', ['sin_solicitud'], 'cambio sin solicitud', 'cambios sin solicitud', 'cambio', 'migraciones.html?f=sin_solicitud']].concat(d.senior || admin ? [['certificar', ['certificar'], 'instalación por cumplir para certificar', 'instalaciones por cumplir para certificar', 'barras'],
            ['decidir', ['cambio_comision'], 'cambio con la comisión por decidir', 'cambios con la comisión por decidir', 'cambio', 'migraciones.html?f=decidir']] : []);
      GR.forEach((x) => { const n = suma(x[1]); if(!n[0]) return;
        r.push({ c: n[1] ? 'rojo' : 'azul', i: x[4], t: plural(n[0], x[2], x[3]), s: n[1] ? plural(n[1], 'vencido', 'vencidos') + (x[5] ? '. Míralo en Migraciones' : '. Míralo en Mi trabajo') : x[5] ? 'En Migraciones, a tiempo' : 'En Mi trabajo, a tiempo', e: x[5] || 'trabajo.html?f=' + x[0], k: 'tr_' + x[0] }); });
    }
    if(!conBandeja && (lider || analista || admin) && c.devueltos > 0){
      r.push({ c: 'rojo', i: 'devolver', t: plural(c.devueltos, 'cliente', 'clientes') + ' con documentos devueltos',
        s: 'Hay que pedirlos de nuevo al cliente', e: 'clientes.html?f=devueltos', k: 'devueltos' });
    }
    if((d.senior || admin) && com.por_asignar > 0){
      r.push({ c: 'ambar', i: 'alerta', t: plural(com.por_asignar, 'instalación', 'instalaciones') + ' por asignar',
        s: 'No comisionan hasta confirmar la orden y a quién pertenecen', e: 'comisiones.html?f=asignar', k: 'asignar' });
    }
    const ins = d.instalar || {};
    if((analista || admin || lider) && (ins.rojo > 0 || ins.ambar > 0)){
      r.push({ c: ins.rojo ? 'rojo' : 'ambar', i: 'reloj', t: ins.rojo ? plural(ins.rojo, 'orden en rojo', 'órdenes en rojo') : plural(ins.ambar, 'orden en ámbar', 'órdenes en ámbar'),
        s: (ins.rojo ? 'Llevan 24 horas o más sin instalación' : 'Llevan 16 horas o más sin instalación') + (ins.rojo && ins.ambar ? '. Y ' + ins.ambar + ' en ámbar' : ''), e: 'comisiones.html?t=instalar', k: 'instalar' });
    }
    if(!conBandeja && (analista || admin || lider) && d.bienvenidas > 0){
      r.push({ c: 'azul', i: 'enviar', t: plural(d.bienvenidas, 'bienvenida', 'bienvenidas') + ' por enviar',
        s: 'Instalaciones de este corte sin su carta de bienvenida', e: 'clientes.html?bienvenidas=1', k: 'bienvenidas' });
    }
    if(com.ultimo > 0){
      r.push({ c: 'azul', i: 'reloj', t: plural(com.ultimo, 'instalación', 'instalaciones') + ' en su último corte',
        s: 'Si no ' + (com.ultimo === 1 ? 'cumple' : 'cumplen') + ' el ' + (d.corte ? fecha(d.corte.limite || d.corte.fin).split(' de ')[0] : '18') + ', se pierde la comisión', e: 'comisiones.html?f=ultimo', k: 'ultimo' });
    }
    if(!conBandeja && (lider || analista || admin) && c.sin_gestion > 0){
      r.push({ c: 'gris', i: 'alerta', t: plural(c.sin_gestion, 'cliente', 'clientes') + ' sin gestión',
        s: 'Llevan más de 3 días sin que nadie los contacte', e: 'clientes.html?f=sin_gestion', k: 'sin_gestion' });
    }
    if((admin || legal) && c.por_firmar > 0){
      r.push({ c: 'morado', i: 'lapiz', t: plural(c.por_firmar, 'contrato', 'contratos') + ' por cerrar',
        s: 'En curso o esperando la firma del cliente', e: 'clientes.html?f=por_firmar', k: 'por_firmar' });
    }
    return r;
  }
  function oculto(){ try { return localStorage.getItem(K_OCULTO) === hoyClave(); } catch (e) { return false; } }
  function pintarPendientes(d, rol){
    const lista = pendientes(d, rol); const z = $('zonaPendientes');
    if(!lista.length){
      z.innerHTML = '<div class="h2">Pendientes</div><div class="linea-info">' + ic('check') + 'No tienes nada pendiente por ahora.</div>';
      return;
    }
    const oc = oculto();
    z.innerHTML = '<div class="h2">Pendientes <span class="n">' + lista.length + '</span>' +
      '<button type="button" class="der" id="alternaPend" aria-expanded="' + (!oc) + '">' + (oc ? 'Mostrar' : 'Ocultar') + '</button></div>' +
      '<div class="pend' + (oc ? ' hidden' : '') + '" id="listaPend">' + lista.map((x, n) =>
        '<a class="pf ' + x.c + '" href="' + esc(x.e) + '" data-pend="' + esc(x.k) + '" style="--index:' + n + '"><span class="ic">' + ic(x.i) + '</span>' +
        '<span class="tx">' + esc(x.t) + '<small>' + esc(x.s) + '</small></span>' + ic('derecha', 'ch') + '</a>').join('') + '</div>';
  }

  function pintarModulos(d, rol){
    const c = d.clientes || {}; const com = d.comision || {};
    const activos = [
      { id: 'comisiones', nombre: 'Comisiones', icono: 'barras', enlace: 'comisiones.html',
        texto: d.comision ? (com.total ? plural(com.total, 'instalación', 'instalaciones') + ' en este corte' : 'Sin instalaciones en este corte') : 'Legal, pago y corte del 18 al 17' },
      { id: 'clientes', nombre: 'Clientes', icono: 'edificio', enlace: 'clientes.html',
        texto: d.clientes ? (c.en_curso ? c.en_curso + ' con documentos en curso' : 'Sin expedientes en curso') : 'Expediente, documentos e hilo' }
    ];
    if(['admin', 'lider', 'analista'].indexOf(rol) >= 0) activos.unshift({ id: 'trabajo', nombre: 'Mi trabajo', icono: 'check', enlace: 'trabajo.html',
      texto: d.trabajo ? (d.trabajo.total ? plural(d.trabajo.total, 'pendiente', 'pendientes') + (d.trabajo.rojo ? ', ' + plural(d.trabajo.rojo, 'vencido', 'vencidos') : '') : 'Todo al día') : 'Tus pendientes del día' });
    if(['admin', 'lider', 'analista'].indexOf(rol) >= 0) activos.push({ id: 'migraciones', nombre: 'Migraciones', icono: 'cambio', enlace: 'migraciones.html', texto: 'Cambios de categoría y de titular' });
    if(['admin', 'lider', 'analista'].indexOf(rol) >= 0) activos.push({ id: 'factibilidad', nombre: 'Factibilidad', icono: 'wifi', enlace: 'factibilidad.html', texto: 'Si una ubicación tiene red' });
    activos.push({ id: 'aliados', nombre: 'Aliados', icono: 'usuarios', enlace: 'aliados.html',
      texto: rol === 'admin' ? 'Solicitudes, referidos y pagos de aliados' : canales ? 'Tus solicitudes, referidos y pagos' : 'Registro de aliados e instalados, para ver' });
    if(['admin', 'analista', 'abogado'].indexOf(rol) >= 0 || (rol === 'lider' && dedicados)) activos.push({ id: 'dedicados', nombre: 'Dedicados', icono: 'servidor', enlace: 'dedicados.html',
      texto: rol === 'lider' ? 'Tus clientes dedicados: enlaces, documentos y contratos' : 'ISP y corporativos: enlaces, documentos y contratos' });
    if(['admin', 'analista', 'lider', 'abogado'].indexOf(rol) >= 0) activos.push({ id: 'gerencia', nombre: 'Gerencia', icono: 'barras', enlace: 'gerencia.html',
      texto: rol === 'lider' ? 'Tus números: instalaciones, comisiones y expedientes' : 'Resumen del negocio por mes, líder y segmento' });
    if(rol === 'admin' || rol === 'abogado') activos.push({ id: 'revision', nombre: 'Revisión', icono: 'doc', enlace: 'revision.html', texto: rol === 'admin' ? 'Documentos por revisar, también con IA' : 'Tus contratos por hacer y por firmar' });
    const pronto = PRONTO.filter((m) => m.roles.indexOf(rol) >= 0);
    $('zonaModulos').innerHTML = '<div class="h2 primero">Módulos</div><div class="mods">' +
      activos.map((m) => '<a class="mod" href="' + m.enlace + '" data-modulo="' + m.id + '"><span class="ic">' + ic(m.icono, 'g') + '</span><span><b>' + m.nombre + '</b><small>' + esc(m.texto) + '</small></span></a>').join('') +
      pronto.map((m) => '<div class="mod pronto" aria-disabled="true" data-modulo="' + m.id + '"><span class="ic">' + ic(m.icono, 'g') + '</span><span><b>' + m.nombre + '</b><small>En construcción</small></span></div>').join('') +
      '</div>' +
      (d.hay_demo ? '<div class="linea-info" id="avisoDemo">' + ic('estrella') + '<span>Estás viendo datos de ejemplo, con nombres inventados.</span></div>' : '');
  }

  let canales = false; let dedicados = false;
  function pintar(d, rol){ pintarCorte(d); pintarPendientes(d, rol); pintarModulos(d, rol); }

  function esqueletoInicio(){
    $('zonaCorte').innerHTML = '<div class="sk" style="height:92px;border-radius:22px;margin-top:18px"></div>';
    $('zonaPendientes').innerHTML = '<div class="h2">Pendientes</div><div class="pend"><div class="sk" style="height:60px;border-radius:18px"></div><div class="sk" style="height:60px;border-radius:18px"></div></div>';
    $('zonaModulos').innerHTML = '<div class="h2 primero">Módulos</div><div class="mods"><div class="sk" style="height:132px;border-radius:22px"></div><div class="sk" style="height:132px;border-radius:22px"></div></div>';
  }

  function arrancar(){ window.Armazon.arrancar(null, { activo: 'inicio' }, iniciar); }
  async function iniciar(p){
    const { equipo } = window.Armazon.montar(p, { activo: 'inicio' });
    $('saludo').textContent = 'Hola, ' + (primerNombre(p.nombre) || p.nombre);
    $('subSaludo').textContent = fechaDia(new Date().toISOString());
    canales = !!p.canales; dedicados = !!p.dedicados;
    // El aliado trabaja en su propio módulo
    if(p.rol === 'aliado'){ location.replace('aliados.html'); return; }
    if(equipo === 'aliados'){
      $('subSaludo').textContent = 'Aliados comerciales';
      $('zonaCorte').innerHTML = '<div class="aviso"><b>Este espacio está en construcción</b><p>El módulo de aliados comerciales llega después de instalaciones y documentos. Te avisaremos cuando esté listo.</p></div>';
      return;
    }
    const guardado = cache.leer('inicio');
    if(guardado && guardado.rol === p.rol) pintar(guardado, p.rol); else esqueletoInicio();
    try {
      const d = await rpc('inicio_datos');
      if(['admin', 'analista', 'lider'].indexOf(p.rol) >= 0){ try { d.trabajo = await rpc('trabajo_resumen'); } catch (e) { d.trabajo = null; } }
      cache.guardar('inicio', d);
      pintar(d, p.rol);
      window.Armazon.datosMenu(d);
    } catch (e) {
      if(!guardado){
        $('zonaCorte').innerHTML = ''; $('zonaModulos').innerHTML = '';
        pintarModulos({}, p.rol);
        $('zonaPendientes').innerHTML = '<div class="aviso" role="alert"><b>No se pudo cargar el resumen</b><p>' + esc(e.message) + '</p><p style="margin-top:16px"><button type="button" class="btn btn-chico" id="reintentar">Reintentar</button></p></div>';
      }
      toast(e.message, 'error');
    }
  }

  document.addEventListener('click', (e) => {
    if(e.target.closest('#reintentar')){ location.reload(); return; }
    const b = e.target.closest('#alternaPend'); if(!b) return;
    const l = $('listaPend'); const ocultar = !l.classList.contains('hidden');
    l.classList.toggle('hidden', ocultar);
    b.textContent = ocultar ? 'Mostrar' : 'Ocultar'; b.setAttribute('aria-expanded', String(!ocultar));
    try { ocultar ? localStorage.setItem(K_OCULTO, hoyClave()) : localStorage.removeItem(K_OCULTO); } catch (err) {}
  });
  // Una ubicación compartida antes de entrar: se sigue en Factibilidad
  let compartido = false; try { compartido = !!sessionStorage.getItem('ae_compartido'); } catch (e) {}
  if(compartido) location.replace('factibilidad.html'); else arrancar();
})();
