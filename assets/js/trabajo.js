// Mi trabajo (lote 6): la bandeja de cada quien, de una sola fuente en el servidor (privado.pendientes).
// Analista: lo de los clientes de sus líderes. Analista Senior: además lo que falta para certificar. Coordinación: las bandejas de todos
// los analistas y Aliados. Líder: lo suyo. Administrador: todo, con filtro por persona. Cada pendiente: color por tiempo, Hecho con nota.
(function(){
  'use strict';
  const C = window.Comun;
  const { $, esc, ic, rpc, toast, cache, vacio, fecha, plural, abrirHoja, cerrarHoja, prepararHojas } = C;
  const B = {
    hoy: { t: 'Hoy', tipos: null, ayuda: 'Todo lo tuyo: primero lo vencido, después lo que vence hoy y lo nuevo.' },
    cambios: { t: 'Cambios por emitir', tipos: ['cambio_emitir'], ayuda: 'Hazlos en el sistema y márcalos Emitido en Migraciones.' },
    instalar: { t: 'Por instalar', tipos: ['por_instalar'], ayuda: 'Órdenes de Odoo desde el 01/10 que todavía no se instalan.' },
    enviar: { t: 'Por enviar', tipos: ['por_enviar'], ayuda: 'Proformas y cartas de bienvenida de este corte que no se han enviado.' },
    ip: { t: 'Sin IP', tipos: ['sin_ip'], ayuda: 'Servicios de este corte sin IP: la carta sale con "Pendiente por asignar".' },
    datos: { t: 'Datos por corregir', tipos: ['rif_verificar', 'sin_cliente', 'sin_servicio'], ayuda: 'RIF por verificar, instalaciones sin cliente y clientes sin servicio enlazado.' },
    sinsol: { t: 'Sin solicitud', tipos: ['sin_solicitud'], ayuda: 'Cambios hacia o desde PYME sin solicitud en la app. Se resuelven en Migraciones.' },
    decidir: { t: 'Comisión por decidir', tipos: ['cambio_comision'], ayuda: 'Cambios a PYME ya confirmados: decide en Migraciones si comisionan, con su motivo.' },
    certificar: { t: 'Para certificar', tipos: ['certificar'], ayuda: 'Lo que le falta al corte en curso: orden, Legal o pago.' },
    docs: { t: 'Documentos', tipos: ['docs_faltan', 'devuelto'], ayuda: 'Clientes a los que les faltan documentos o Legal se los devolvió.' },
    firmar: { t: 'Por firmar', tipos: ['por_firmar'], ayuda: 'Contratos que esperan la firma del cliente.' },
    titular: { t: 'Cambio de titular', tipos: ['planilla'], ayuda: 'Planillas sin firmar o documentos del nuevo titular por subir.' },
    referidos: { t: 'Referidos', tipos: ['referido'], ayuda: 'Clientes que te pasaron los aliados: contáctalos.' },
    vgt: { t: 'VGT', tipos: ['vgt'], ayuda: 'Dedicados con requisitos VGT incompletos.' },
    gestion: { t: 'Sin gestión', tipos: ['sin_gestion'], ayuda: 'Instalados en este corte o el anterior a los que no se les ha pedido nada.' },
    aliados: { t: 'Aliados', tipos: [], ayuda: 'Solicitudes, referidos, pagos e instalaciones sin autorización.' }
  };
  const DEL_ANALISTA = ['hoy', 'cambios', 'instalar', 'enviar', 'ip', 'datos', 'sinsol'];
  const DEL_LIDER = ['hoy', 'docs', 'firmar', 'titular', 'referidos', 'vgt', 'gestion'];
  let yo = null; let D = null; let tab = 'hoy'; let persona = ''; let pedido = 0; let H = null;

  function bandejas(){
    if(!D) return ['hoy'];
    if(D.rol === 'lider') return DEL_LIDER;
    if(D.rol === 'admin') return DEL_ANALISTA.concat(['certificar', 'decidir'], DEL_LIDER.slice(1), ['aliados']);
    return DEL_ANALISTA.concat(D.senior ? ['certificar', 'decidir'] : [], D.canales ? ['aliados'] : []);
  }
  const deTab = (id) => (D ? D.filas || [] : []).filter((f) => !B[id].tipos || B[id].tipos.indexOf(f.tipo) >= 0);
  function leerUrl(){ const u = new URLSearchParams(location.search); tab = B[u.get('f')] ? u.get('f') : 'hoy'; persona = (u.get('p') || '').slice(0, 40); }
  function guardarUrl(){ const u = new URLSearchParams(); if(tab !== 'hoy') u.set('f', tab); if(persona) u.set('p', persona); const s = u.toString(); history.replaceState(history.state, '', location.pathname + (s ? '?' + s : '')); }

  async function cargar(){
    const mio = ++pedido; const clave = 'trabajo:' + (yo && yo.rol) + ':' + persona;
    if(!D){ const g = cache.leer(clave); if(g){ D = g; pintar(); } else $('lista').innerHTML = '<div class="sk-bloque"><span class="sk" style="height:64px;border-radius:16px"></span><span class="sk" style="height:64px;border-radius:16px"></span><span class="sk" style="height:64px;border-radius:16px"></span></div>'; }
    try { const r = await rpc('trabajo', { p_persona: persona || null }); if(mio !== pedido) return; D = r; cache.guardar(clave, r); pintar(); }
    catch (e) {
      if(mio !== pedido) return;
      if(!D) $('lista').innerHTML = '<div class="vacio" role="alert"><b>No se pudo cargar tu trabajo</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" data-tr="reintentar">Reintentar</button></div>';
      toast(e.message, 'error');
    }
  }
  function pintar(){
    if(!D) return;
    const bs = bandejas(); if(bs.indexOf(tab) < 0) tab = 'hoy';
    const todas = D.filas || []; const rojas = todas.filter((f) => f.color === 'rojo').length;
    $('resumen').textContent = todas.length ? plural(todas.length, 'pendiente', 'pendientes') + (rojas ? ', ' + plural(rojas, 'vencido', 'vencidos') : ', ninguno vencido') + '.' : 'No tienes pendientes.';
    // El administrador tiene todas las bandejas: solo se muestran las que tienen algo
    const vis = D.rol === 'admin' ? bs.filter((id) => id === 'hoy' || id === 'aliados' || id === tab || deTab(id).length) : bs;
    $('filtros').innerHTML = vis.map((id) => {
      const n = id === 'aliados' ? null : deTab(id).length; const r = id === 'aliados' ? 0 : deTab(id).filter((f) => f.color === 'rojo').length;
      return '<button type="button" role="tab" data-tab="' + id + '" aria-selected="' + (id === tab) + '" class="' + (id === tab ? 'on' : '') + '">' + esc(B[id].t) + (n !== null ? ' <em' + (r ? ' class="rj"' : '') + '>' + n + '</em>' : '') + '</button>';
    }).join('');
    $('ayuda').textContent = B[tab].ayuda;
    // Filtro por persona: el administrador ve todo; la coordinación, las bandejas de los analistas
    const zp = $('zonaPersona'); const ps = D.personas || [];
    zp.classList.toggle('hidden', !ps.length);
    if(ps.length) $('persona').innerHTML = '<option value="">' + (D.rol === 'admin' ? 'Todo el equipo' : 'Todos los analistas') + '</option>' +
      ps.map((p) => '<option value="' + esc(p.id) + '"' + (p.id === persona ? ' selected' : '') + '>' + esc(p.nombre + (p.rol === 'lider' ? ' (líder)' : ' (analista)')) + '</option>').join('');
    if(tab === 'aliados'){ pintarAliados(); return; }
    const l = deTab(tab);
    if(!l.length){ $('lista').innerHTML = vacio(tab === 'hoy' ? 'Todo al día' : 'Nada aquí', tab === 'hoy' ? 'No tienes pendientes. Cuando algo necesite de ti, aparece aquí.' : 'Cuando haya algo de esta bandeja, aparece aquí.'); pintarDias(); return; }
    const hoy = D.hoy;
    $('lista').innerHTML = '<div class="grupo abierto tr-lista">' + l.map((f) => {
      const dd = C.diasEntre(f.vence, hoy);
      const plazo = f.color === 'rojo' ? 'Venció hace ' + plural(dd, 'día', 'días') : f.color === 'ambar' ? 'Vence hoy' : 'Vence el ' + fecha(f.vence).replace(/ de \d{4}$/, '');
      const quien = [D.rol !== 'lider' && f.lider ? 'Líder: ' + f.lider : '', (D.rol === 'admin' || D.canales) && f.analista ? 'Analista: ' + f.analista : '', D.rol !== 'lider' && f.para === 'analista' && !f.analista ? 'Sin analista asignado' : ''].filter(Boolean).join(' · ');
      return '<div class="tr-f"><button type="button" class="fila" data-abrir="' + esc(f.tipo + '|' + f.clave) + '"><span class="pto ' + f.color + '" aria-hidden="true"></span><span class="tx"><b>' + esc(f.titulo) + '</b><small>' + esc(f.detalle) + '</small>' +
        '<small class="etqs"><span class="tagn ' + (f.color === 'verde' ? 'gris' : f.color) + '">' + esc(plazo) + '</span>' + (f.nuevo ? '<span class="tagn azul">Nuevo</span>' : '') + (quien ? '<span class="tr-q">' + esc(quien) + '</span>' : '') + '</small></span></button>' +
        '<button type="button" class="mini" data-hecho="' + esc(f.tipo + '|' + f.clave) + '">Hecho</button></div>';
    }).join('') + '</div>';
    pintarDias();
  }
  function pintarAliados(){
    const a = D.aliados || {};
    const it = [['solicitudes', 'Solicitudes abiertas', 'aliados.html'], ['referidos', 'Referidos por atender', 'aliados.html'], ['pagos', 'Pagos pendientes', 'aliados.html?t=pagos'], ['sin_permiso', 'Instaladas sin autorización', 'aliados.html?t=sinp']];
    $('lista').innerHTML = '<div class="tr-al">' + it.map((x) => '<a class="tr-al-k" href="' + x[2] + '"><b>' + esc(a[x[0]] || 0) + '</b><small>' + esc(x[1]) + '</small>' + ic('derecha', 'ch') + '</a>').join('') + '</div>';
    pintarDias();
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
    if(ref.cambio){ location.href = 'migraciones.html?f=' + ({ cambio_emitir: 'por_emitir', sin_solicitud: 'sin_solicitud', cambio_comision: 'decidir' }[f.tipo] || '') + '&c=' + encodeURIComponent(ref.cambio); return; }
    if(f.tipo === 'por_instalar' && !f.cliente_id){ location.href = 'comisiones.html?t=instalar'; return; }
    if(!f.cliente_id){ location.href = 'comisiones.html'; return; }
    window.Ficha.abrir(f.cliente_id, { yo, alCerrar: cargar, tab: f.tipo === 'certificar' || f.tipo === 'por_enviar' || f.tipo === 'sin_ip' ? 'comision' : f.tipo === 'docs_faltan' || f.tipo === 'devuelto' || f.tipo === 'vgt' ? 'documentos' : '' });
  }
  function hoja(){
    let h = $('hojaHecho');
    if(!h){ h = document.createElement('section'); h.id = 'hojaHecho'; h.className = 'hoja'; h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', 'tHecho'); h.setAttribute('aria-hidden', 'true'); document.body.appendChild(h); prepararHojas(); }
    return h;
  }
  function abrirHecho(f){
    H = f;
    hoja().innerHTML = '<div class="cab"><div><h2 id="tHecho">Marcar como hecho</h2><p class="sub-hoja">' + esc(f.titulo + ' · ' + f.detalle) + '</p></div><button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      '<form id="formHecho" novalidate><label class="rotulo" for="hechoNota">Nota (opcional)</label><textarea class="area corta" id="hechoNota" maxlength="500"></textarea>' +
      '<p class="nota-chica">Sale de tu bandeja y queda en la bitácora con tu nombre.</p><div class="error" id="eHecho" role="alert"></div><div class="acciones"><button type="submit" class="btn btn-ancho" id="guardarHecho">Hecho</button></div></form>';
    abrirHoja('hojaHecho');
  }
  const buscar = (k) => (D.filas || []).find((f) => f.tipo + '|' + f.clave === k);

  document.addEventListener('click', async (ev) => {
    const t = ev.target; let b;
    if((b = t.closest('#filtros [data-tab]'))){ tab = b.dataset.tab; guardarUrl(); pintar(); return; }
    if(t.closest('[data-tr="reintentar"]')){ cargar(); return; }
    if((b = t.closest('[data-abrir]'))){ const f = buscar(b.dataset.abrir); if(f) abrir(f); return; }
    if((b = t.closest('[data-hecho]'))){ const f = buscar(b.dataset.hecho); if(f) abrirHecho(f); return; }
    if((b = t.closest('[data-dias]'))){
      const k = b.dataset.dias; const er = $('e_' + k); er.textContent = ''; b.disabled = true;
      try { await rpc('ajuste_guardar', { p_clave: k, p_valor: $(k).value }); toast('Guardado'); D = null; cargar(); }
      catch (e) { er.textContent = e.message; b.disabled = false; }
    }
  });
  document.addEventListener('submit', async (ev) => {
    if(ev.target.id !== 'formHecho' || !H) return; ev.preventDefault();
    const b = $('guardarHecho'); b.disabled = true; b.textContent = 'Guardando…';
    try { await rpc('trabajo_hecho', { p_tipo: H.tipo, p_clave: H.clave, p_nota: $('hechoNota').value.trim() || null }); toast('Listo. Salió de tu bandeja'); cerrarHoja(); H = null; cargar(); }
    catch (e) { $('eHecho').textContent = e.message; b.disabled = false; b.textContent = 'Hecho'; }
  });
  $('persona').addEventListener('change', () => { persona = $('persona').value; guardarUrl(); D = null; cargar(); });
  document.addEventListener('visibilitychange', () => { if(!document.hidden && yo && !C.hojaAbierta()) cargar(); });

  window.Armazon.arrancar(['admin', 'analista', 'lider'], { activo: 'trabajo' }, (p) => {
    yo = p; window.Ficha.montar(); leerUrl(); cargar();
  }, (p) => { yo = p; });
})();
