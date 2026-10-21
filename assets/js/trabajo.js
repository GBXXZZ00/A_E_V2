// Mi trabajo (lote 6): la bandeja de cada quien, de una sola fuente en el servidor (privado.pendientes).
// Analista: lo de los clientes de sus líderes. Analista Senior: además lo que falta para certificar. Coordinación: las bandejas de todos
// los analistas y Aliados. Líder: lo suyo. Administrador: todo, con filtro por persona. Agrupado por módulo; sin "Hecho": sale solo al resolverse.
(function(){
  'use strict';
  const C = window.Comun;
  const { $, esc, ic, rpc, toast, cache, vacio, fecha, plural } = C;
  // Corrida 14/10 tarde: agrupado por módulo, sin "Hecho". Un pendiente sale solo cuando la app ve que se resolvió.
  const MOD = {
    todo: { t: 'Todo', tipos: null },
    expedientes: { t: 'Expedientes', tipos: { docs_faltan: 'Faltan documentos', devuelto: 'Devueltos', por_firmar: 'Por firmar', sin_gestion: 'Sin gestión', rif_verificar: 'RIF por verificar' } },
    comisiones: { t: 'Comisiones', tipos: { por_instalar: 'Por instalar', por_enviar: 'Por enviar', sin_ip: 'Sin IP', ip_confirmar: 'IP por confirmar', por_asignar: 'Por asignar', certificar: 'Para certificar', sin_cliente: 'Instalación sin cliente', sin_servicio: 'Sin servicio enlazado' } },
    migraciones: { t: 'Migraciones', tipos: { cambio_emitir: 'Por emitir', sin_registro: 'Sin registro', cambio_revisar: 'Documentos por revisar', planilla: 'Faltan documentos' } },
    dedicados: { t: 'Dedicados', tipos: { vgt: 'VGT incompleto', poliza: 'Pólizas' } },
    aliados: { t: 'Aliados', tipos: { referido: 'Referidos' } }
  };
  // Qué hace que cada pendiente salga solo
  const SALE = {
    docs_faltan: 'Sale cuando se suben los documentos que faltan.', devuelto: 'Sale cuando se sube el documento corregido.', por_firmar: 'Sale cuando el contrato queda firmado.',
    sin_gestion: 'Sale con una gestión en el hilo del cliente.', rif_verificar: 'Sale cuando el administrador corrige el RIF y quita la marca en Editar dedicado.',
    por_instalar: 'Sale cuando llega la instalación o Odoo cancela la orden.', por_enviar: 'Sale al registrar el envío de la proforma y la carta.', sin_ip: 'Sale al escribir la IP del servicio o con el reporte de IP.', ip_confirmar: 'Sale al elegir la IP del reporte o dejar la actual.',
    por_asignar: 'Sale cuando se confirma la orden y a quién pertenece.', certificar: 'Sale cuando cumple Legal y el pago.', sin_cliente: 'Sale cuando la instalación queda enlazada a su cliente.',
    sin_servicio: 'Sale cuando el TAD trae el servicio de esa instalación.', cambio_emitir: 'Sale al marcarlo Hecho en Migraciones.', sin_registro: 'Sale al asignarlo a un líder, o marcarlo como error o revertido.', cambio_revisar: 'Sale al aprobar los documentos en el expediente.',
    cambio_comision: 'Sale al decidir en Migraciones si comisiona.', planilla: 'Sale cuando están todos los documentos del cambio.', vgt: 'Sale cuando se suben los requisitos VGT.',
    poliza: 'Sale al subir la póliza renovada con su vencimiento nuevo.', referido: 'Sale con una gestión en el hilo del cliente.'
  };
  // Enlaces viejos (?f=) a las bandejas de antes
  const VIEJO = { hoy: ['todo', ''], cambios: ['migraciones', 'cambio_emitir'], instalar: ['comisiones', 'por_instalar'], enviar: ['comisiones', 'por_enviar'], ip: ['comisiones', 'sin_ip'],
    datos: ['todo', ''], sinsol: ['migraciones', 'sin_registro'], decidir: ['migraciones', 'cambio_revisar'], certificar: ['comisiones', ''], docs: ['expedientes', 'docs_faltan'],
    firmar: ['expedientes', 'por_firmar'], titular: ['migraciones', 'planilla'], referidos: ['aliados', 'referido'], vgt: ['dedicados', 'vgt'], gestion: ['expedientes', 'sin_gestion'], aliados: ['aliados', ''] };
  const TIPO_TXT = {}; Object.keys(MOD).forEach((m) => { if(MOD[m].tipos) Object.assign(TIPO_TXT, MOD[m].tipos); });
  let yo = null; let D = null; let tab = 'todo'; let sub = ''; let persona = ''; let pedido = 0;

  // Todos los módulos para todos: los que no tienen nada para la persona no se muestran
  const modulos = () => (D ? ['todo', 'expedientes', 'comisiones', 'migraciones', 'dedicados', 'aliados'] : ['todo']);
  const deMod = (id) => (D ? D.filas || [] : []).filter((f) => id === 'todo' || f.modulo === id);
  const deVista = () => deMod(tab).filter((f) => !sub || f.tipo === sub);
  const nAliados = () => { const a = D && D.aliados; return a ? (a.solicitudes || 0) + (a.pagos || 0) + (a.sin_permiso || 0) : 0; };
  function leerUrl(){
    const u = new URLSearchParams(location.search); const v = VIEJO[u.get('f')];
    tab = MOD[u.get('m')] ? u.get('m') : v ? v[0] : 'todo'; sub = (u.get('s') || (v ? v[1] : '')).slice(0, 30); persona = (u.get('p') || '').slice(0, 40);
  }
  function guardarUrl(){ const u = new URLSearchParams(); if(tab !== 'todo') u.set('m', tab); if(sub) u.set('s', sub); if(persona) u.set('p', persona); const s = u.toString(); history.replaceState(history.state, '', location.pathname + (s ? '?' + s : '')); }

  async function cargar(){
    const mio = ++pedido; const clave = 'trabajo2:' + (yo && yo.rol) + ':' + persona;
    if(!D){ const g = cache.leer(clave); if(g){ D = g; pintar(); } else $('lista').innerHTML = '<div class="sk-bloque"><span class="sk" style="height:64px;border-radius:16px"></span><span class="sk" style="height:64px;border-radius:16px"></span><span class="sk" style="height:64px;border-radius:16px"></span></div>'; }
    try { const r = await rpc('trabajo', { p_persona: persona || null }); if(mio !== pedido) return; D = r; cache.guardar(clave, r); pintar(); if(!persona) window.Armazon.contadores(resumenDe(r), yo); }
    catch (e) {
      if(mio !== pedido) return;
      if(!D) $('lista').innerHTML = '<div class="vacio" role="alert"><b>No se pudo cargar tu trabajo</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" data-tr="reintentar">Reintentar</button></div>';
      toast(e.message, 'error');
    }
  }
  // El mismo resumen que da el servidor (trabajo_resumen), armado con lo que ya llegó: así el menú no pide otra vez
  function resumenDe(r){
    const l = r.filas || []; const hoy = r.hoy; const al = r.aliados; const nal = al ? (al.solicitudes || 0) + (al.pagos || 0) + (al.sin_permiso || 0) : 0; const modulos = {};
    ['expedientes', 'comisiones', 'migraciones', 'dedicados', 'aliados'].forEach((k) => { const x = l.filter((f) => f.modulo === k);
      modulos[k] = { n: x.length + (k === 'aliados' ? nal : 0), rojo: x.filter((f) => f.vence < hoy).length, hoy: x.filter((f) => f.vence === hoy).length }; });
    return { total: l.length, rojo: l.filter((f) => f.vence < hoy).length, hoy: l.filter((f) => f.vence === hoy).length, modulos, aliados: al || null };
  }
  function pintar(){
    if(!D) return;
    const ms = modulos(); if(ms.indexOf(tab) < 0){ tab = 'todo'; sub = ''; }
    if(sub && (tab === 'todo' || !MOD[tab].tipos[sub])) sub = '';
    const todas = D.filas || []; const rojas = todas.filter((f) => f.color === 'rojo').length;
    $('resumen').textContent = todas.length ? plural(todas.length, 'pendiente', 'pendientes') + (rojas ? ', ' + plural(rojas, 'vencido', 'vencidos') : ', ninguno vencido') + '. Cada uno sale solo cuando se resuelve.' : 'No tienes pendientes.';
    // Solo se muestran los módulos que tienen algo (y el que está abierto)
    const cuenta = (id) => deMod(id).length + (id === 'aliados' ? nAliados() : 0);
    const vis = ms.filter((id) => id === 'todo' || id === tab || cuenta(id));
    $('filtros').innerHTML = vis.map((id) => {
      const n = cuenta(id); const r = deMod(id).filter((f) => f.color === 'rojo').length;
      return '<button type="button" role="tab" data-tab="' + id + '" aria-selected="' + (id === tab) + '" class="' + (id === tab ? 'on' : '') + '">' + esc(MOD[id].t) + ' <em' + (r ? ' class="rj"' : '') + '>' + n + '</em></button>';
    }).join('');
    // Dentro de un módulo: un chip por tipo con su número
    const tipos = MOD[tab].tipos; const zs = $('subs');
    if(tipos){
      const l = deMod(tab); const ks = Object.keys(tipos).filter((k) => k === sub || l.some((f) => f.tipo === k));
      zs.innerHTML = ks.length > 1 || sub ? '<button type="button" data-sub="" class="' + (!sub ? 'on' : '') + '" aria-pressed="' + !sub + '">Todos <em>' + l.length + '</em></button>' +
        ks.map((k) => '<button type="button" data-sub="' + k + '" class="' + (k === sub ? 'on' : '') + '" aria-pressed="' + (k === sub) + '">' + esc(tipos[k]) + ' <em>' + l.filter((f) => f.tipo === k).length + '</em></button>').join('') : '';
    } else zs.innerHTML = '';
    zs.classList.toggle('hidden', !zs.innerHTML);
    $('ayuda').textContent = sub ? SALE[sub] || '' : tab === 'todo' ? 'Todo lo tuyo, de todos los módulos. Toca un pendiente para resolverlo.' : 'Toca un pendiente para resolverlo. Sale solo cuando la app ve que se resolvió.';
    // Filtro por persona: el administrador ve todo; la coordinación, las bandejas de los analistas
    const zp = $('zonaPersona'); const ps = D.personas || [];
    zp.classList.toggle('hidden', !ps.length);
    if(ps.length) $('persona').innerHTML = '<option value="">' + (D.rol === 'admin' ? 'Todo el equipo' : 'Todos los analistas') + '</option>' +
      ps.map((p) => '<option value="' + esc(p.id) + '"' + (p.id === persona ? ' selected' : '') + '>' + esc(p.nombre + (p.rol === 'lider' ? ' (líder)' : ' (analista)')) + '</option>').join('');
    let h = tab === 'aliados' && D.aliados && !sub ? aliadosHtml() : '';
    const l = deVista();
    if(!l.length){
      if(!h) h = vacio(tab === 'todo' ? 'Todo al día' : 'Nada aquí', tab === 'todo' ? 'No tienes pendientes. Cuando algo necesite de ti, aparece aquí.' : 'Cuando haya algo de ' + MOD[tab].t + ' para ti, aparece aquí.');
      $('lista').innerHTML = h; pintarDias(); return;
    }
    // Dentro: vencido, vence hoy, nuevo y el resto a tiempo
    const grupos = [['Vencido', l.filter((f) => f.color === 'rojo')], ['Vence hoy', l.filter((f) => f.color === 'ambar')], ['Nuevo', l.filter((f) => f.color === 'verde' && f.nuevo)], ['A tiempo', l.filter((f) => f.color === 'verde' && !f.nuevo)]];
    h += grupos.filter((g) => g[1].length).map((g) => '<section class="tr-g"><h2 class="tr-gt">' + esc(g[0]) + ' <em>' + g[1].length + '</em></h2><div class="grupo abierto tr-lista">' + g[1].map(filaHtml).join('') + '</div></section>').join('');
    $('lista').innerHTML = h;
    pintarDias();
  }
  function filaHtml(f){
    const hoy = D.hoy; const dd = C.diasEntre(f.vence, hoy);
    const plazo = f.color === 'rojo' ? 'Venció hace ' + plural(dd, 'día', 'días') : f.color === 'ambar' ? 'Vence hoy' : 'Vence el ' + fecha(f.vence).replace(/ de \d{4}$/, '');
    const quien = [D.rol !== 'lider' && f.lider ? 'Líder: ' + f.lider : '', (D.rol === 'admin' || D.canales) && f.analista ? 'Analista: ' + f.analista : '', D.rol !== 'lider' && f.para === 'analista' && !f.analista ? 'Sin analista asignado' : ''].filter(Boolean).join(' · ');
    return '<div class="tr-f"><button type="button" class="fila" data-abrir="' + esc(f.tipo + '|' + f.clave) + '"><span class="pto ' + f.color + '" aria-hidden="true"></span><span class="tx"><b>' + esc(f.titulo) + '</b><small>' + esc(f.detalle) + '</small>' +
      '<small class="etqs"><span class="tagn ' + (f.color === 'verde' ? 'gris' : f.color) + '">' + esc(plazo) + '</span>' + (!sub && TIPO_TXT[f.tipo] ? '<span class="tagn">' + esc(TIPO_TXT[f.tipo]) + '</span>' : '') +
      (f.nuevo ? '<span class="tagn azul">Nuevo</span>' : '') + (quien ? '<span class="tr-q">' + esc(quien) + '</span>' : '') + '</small></span>' + ic('derecha', 'ch') + '</button></div>';
  }
  function aliadosHtml(){
    const a = D.aliados || {};
    const it = [['solicitudes', 'Solicitudes abiertas', 'aliados.html'], ['referidos', 'Referidos por atender', 'aliados.html'], ['pagos', 'Pagos pendientes', 'aliados.html?t=pagos'], ['sin_permiso', 'Instaladas sin autorización', 'aliados.html?t=sinp']];
    return '<div class="tr-al">' + it.map((x) => '<a class="tr-al-k" href="' + x[2] + '"><b>' + esc(a[x[0]] || 0) + '</b><small>' + esc(x[1]) + '</small>' + ic('derecha', 'ch') + '</a>').join('') + '</div>';
  }
  // Días límite (ajustes editables, solo el administrador)
  function pintarDias(){
    const z = $('zonaDias'); if(!D || D.rol !== 'admin'){ z.innerHTML = ''; return; }
    const d = D.dias || {};
    const it = [['dias_orden_sin_instalar', 'Orden sin instalar'], ['dias_sin_documentos', 'Cliente sin documentos'], ['dias_por_enviar', 'Por enviar'], ['dias_cambio_por_emitir', 'Cambio por emitir']];
    z.innerHTML = '<details class="tr-dias"><summary>Días límite' + ic('abajo') + '</summary><p class="nota-chica">Cuántos días tiene cada pendiente antes de ponerse en rojo.</p><div class="tr-dias-g">' +
      it.map((x) => '<div class="campo-s"><label for="' + x[0] + '">' + esc(x[1]) + '</label><div class="busca-linea"><input class="campo" id="' + x[0] + '" type="number" inputmode="numeric" min="1" max="365" value="' + esc(d[x[0]] || '') + '">' +
        '<button type="button" class="btn btn-chico btn-2" data-dias="' + x[0] + '">Guardar</button></div><div class="error" id="e_' + x[0] + '" role="alert"></div></div>').join('') + '</div></details>';
  }

  // Abrir: el expediente encima; los cambios en Migraciones; las órdenes sin cliente, en Comisiones
  function abrir(f){
    const ref = f.ref || {};
    if(ref.cambio){ location.href = 'migraciones.html?f=' + ({ cambio_emitir: 'por_emitir', sin_registro: 'sin_registro', cambio_revisar: 'por_revisar', planilla: 'por_revisar' }[f.tipo] || '') + '&c=' + encodeURIComponent(ref.cambio); return; }
    if(f.tipo === 'referido' && !f.cliente_id){ location.href = 'aliados.html'; return; }
    if(f.tipo === 'por_instalar' && !f.cliente_id){ location.href = 'comisiones.html?t=instalar'; return; }
    if(!f.cliente_id){ location.href = 'comisiones.html'; return; }
    window.Ficha.abrir(f.cliente_id, { yo, alCerrar: cargar, tab: f.tipo === 'certificar' || f.tipo === 'por_enviar' || f.tipo === 'sin_ip' ? 'comision' : f.tipo === 'ip_confirmar' ? 'datos' : f.tipo === 'docs_faltan' || f.tipo === 'devuelto' || f.tipo === 'vgt' || f.tipo === 'poliza' ? 'documentos' : '' });
  }
  const buscar = (k) => (D.filas || []).find((f) => f.tipo + '|' + f.clave === k);

  document.addEventListener('click', async (ev) => {
    const t = ev.target; let b;
    if((b = t.closest('#filtros [data-tab]'))){ tab = b.dataset.tab; sub = ''; guardarUrl(); pintar(); return; }
    if((b = t.closest('#subs [data-sub]'))){ sub = b.dataset.sub; guardarUrl(); pintar(); return; }
    if(t.closest('[data-tr="reintentar"]')){ cargar(); return; }
    if((b = t.closest('[data-abrir]'))){ const f = buscar(b.dataset.abrir); if(f) abrir(f); return; }
    if((b = t.closest('[data-dias]'))){
      const k = b.dataset.dias; const er = $('e_' + k); er.textContent = ''; b.disabled = true;
      try { await rpc('ajuste_guardar', { p_clave: k, p_valor: $(k).value }); toast('Guardado'); D = null; cargar(); }
      catch (e) { er.textContent = e.message; b.disabled = false; }
    }
  });
  $('persona').addEventListener('change', () => { persona = $('persona').value; guardarUrl(); D = null; cargar(); });
  document.addEventListener('visibilitychange', () => { if(!document.hidden && yo && !C.hojaAbierta()) cargar(); });

  window.Armazon.arrancar(['admin', 'analista', 'lider'], { activo: 'trabajo' }, (p) => {
    yo = p; window.Ficha.montar(); leerUrl(); cargar();
  }, (p) => { yo = p; });
})();
