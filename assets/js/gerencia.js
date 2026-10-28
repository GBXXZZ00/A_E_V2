// Gerencia (lote 27/10): Inicio propio, solo lectura. Tarjetas con los números del negocio, filtros Período y Comparar con.
// Cada tarjeta abre el Resumen de su módulo encima (window.Resumen), sin botones de acción. Todo sale de modulo_resumen('gerencia').
(function(){
  'use strict';
  const C = window.Comun;
  const { $, esc, ic, rpc, toast, cache, abrirHoja, prepararHojas } = C;
  const R = () => window.Resumen;
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const COMPARAR = [['anio', 'Mismo mes del año pasado'], ['mes', 'El mes anterior'], ['prom3', 'Promedio de 3 meses']];
  const NOMBRES = { clientes: 'Clientes', comisiones: 'Comisiones', revision: 'Revisión', migraciones: 'Migraciones', factibilidad: 'Factibilidad', dedicados: 'Dedicados', aliados: 'Aliados' };
  let yo = null; let D = null; let pedido = 0; let F = { periodo: '', comparar: 'anio' };
  const num = (n) => Number(n || 0).toLocaleString('es-VE');
  const pct = (n) => n === null || n === undefined ? '' : (n >= 0 ? '+' : '') + n + ' %';
  function periodos(){ const h = new Date(); const l = []; for(let i = 0; i < 12; i++){ const d = new Date(h.getFullYear(), h.getMonth() - i, 1); l.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')); } return l; }
  const nombreMes = (m) => { const p = m.split('-'); return MESES_L[Number(p[1]) - 1] + ' ' + p[0]; };
  function rango(m){ const p = m.split('-').map(Number); const fin = new Date(p[0], p[1], 0); const hoy = new Date(); const f = fin > hoy ? hoy : fin;
    return { desde: m + '-01', hasta: f.getFullYear() + '-' + String(f.getMonth() + 1).padStart(2, '0') + '-' + String(f.getDate()).padStart(2, '0') }; }
  function saludo(){ const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; }
  const puede = (mod) => !((mod === 'comisiones' && yo.rol === 'abogado' && !yo.gerencia) || (mod === 'revision' && yo.rol === 'lider'));

  function filtros(){
    $('filtrosG').innerHTML = '<div><label class="rotulo" for="perG">Período</label><select class="campo" id="perG">' + periodos().map((m) => '<option value="' + m + '"' + (m === F.periodo ? ' selected' : '') + '>' + esc(nombreMes(m).replace(/^./, (c) => c.toUpperCase())) + '</option>').join('') + '</select></div>' +
      '<div><label class="rotulo" for="cmpG">Comparar con</label><select class="campo" id="cmpG">' + COMPARAR.map((c) => '<option value="' + c[0] + '"' + (c[0] === F.comparar ? ' selected' : '') + '>' + c[1] + '</option>').join('') + '</select></div>';
  }
  const tarjeta = (mod, cls, cuerpo, ir, aria) => '<button type="button" class="gtj ' + cls + '" data-gt="' + mod + '" aria-label="' + esc(aria) + '">' + cuerpo + '<span class="ir">' + esc(ir) + ic('derecha', 'ch') + '</span></button>';
  function barras(serie, ultimaBlanca){
    const tot = (x) => Number(x.a || 0) + Number(x.b || 0); const mx = Math.max(1, ...serie.map(tot));
    return '<div class="gt-barras" aria-hidden="true">' + serie.map((x, i) => '<i' + (ultimaBlanca && i === serie.length - 1 ? ' class="hoy"' : '') + ' style="height:' + Math.max(3, tot(x) / mx * 100) + '%"></i>').join('') + '</div>';
  }
  function pintar(){
    const z = $('zonaG');
    if(!D){ z.innerHTML = '<div class="gt-grid">' + '<span class="sk gt-sk grande"></span>' + '<span class="sk gt-sk"></span>'.repeat(9) + '</div>'; return; }
    if(D.error){ z.innerHTML = '<div class="vacio" role="alert"><b>No se pudo cargar el resumen</b><p>' + esc(D.error) + '</p><button type="button" class="btn btn-chico" data-ge="reintentar">Reintentar</button></div>'; return; }
    const i = D.inst || {}; const a = D.anio || {}; const s = D.sin_instalar || {}; const k = D.corte || {}; const c = D.completos || {}; const m = D.migraciones || {}; const d = D.dedicados || {};
    const q = D.calidad || {}; const sr = D.sin_red || {}; const serie = i.serie || [];
    const leg = (D.legal || []).map((x) => { const v = (x.v || []).map(Number); const t = v.reduce((p, n) => p + n, 0); return { l: x.l, p: t ? Math.round((v[4] || 0) * 100 / t) : 0 }; });   // Lote 28/10: 5 grupos, el último es Firmado
    const cal = (q.data || []).map((x) => x.b ? Math.min(100, Math.round(x.a * 100 / x.b)) : 0);
    const bajos = (q.data || []).filter((x) => x.b && x.a / x.b < 0.8).map((x) => MESES_L[Number(String(x.m).slice(5, 7)) - 1]);
    const ini = serie[0] ? MESES[Number(serie[0].m.slice(5, 7)) - 1] + ' ' + serie[0].m.slice(2, 4) : ''; const fin = serie.length ? MESES[Number(serie[serie.length - 1].m.slice(5, 7)) - 1] + ' ' + serie[serie.length - 1].m.slice(2, 4) : '';
    let h = '<div class="gt-grid">';
    h += tarjeta('clientes', 'grande oscura', '<h2>Instalaciones PYME</h2><div class="gt-v"><b>' + num(i.v) + '</b>' + (i.cmp !== null && i.cmp !== undefined ? '<span class="chip ' + (i.cmp >= 0 ? 'verde' : 'rojo') + '">' + esc(pct(i.cmp) + ' vs ' + (i.cmp_t || '')) + '</span>' : '') + '</div>' +
      '<p>' + num(i.hab) + ' siguen habilitadas · ' + num(i.ant) + ' en ' + esc(i.ant_t || 'el mes anterior') + '</p>' + barras(serie, true) + '<div class="gt-ext"><span>' + esc(ini) + '</span><span>' + esc(fin) + '</span></div>', 'Ver resumen de Clientes', 'Instalaciones PYME: ' + i.v);
    h += tarjeta('clientes', '', '<h2>En el año</h2><b class="gt-n">' + num(a.v) + '</b><p>' + esc((a.desde || 'ene').replace(/^./, (x) => x.toUpperCase()) + ' a ' + (a.hasta || '') + '. En ' + (a.anio_ant || '') + ' fueron ' + num(a.ant) + '.') + '</p>' +
      (a.cmp !== null && a.cmp !== undefined ? '<span class="chip ' + (a.cmp >= 0 ? 'verde' : 'rojo') + '">' + esc(pct(a.cmp)) + '</span>' : ''), 'Ver año contra año', 'En el año: ' + a.v);
    if(puede('comisiones')){
      h += tarjeta('comisiones', s.v ? 'ambar' : '', '<h2>Órdenes sin instalar</h2><b class="gt-n">' + num(s.v) + '</b><p>' + esc(s.s || '') + '</p>', 'Ver órdenes', 'Órdenes sin instalar: ' + s.v);
      h += tarjeta('comisiones', '', '<h2>Comisiones del corte</h2><b class="gt-n">' + num(k.v) + '</b><p>' + num((k.v || 0) - (k.sinpago || 0)) + ' con pago confirmado, ' + num(k.sinpago) + ' sin pago</p>', 'Ver Comisiones', 'Comisiones: ' + k.v);
    }
    h += tarjeta('clientes', '', '<h2>Contratos firmados</h2><b class="gt-n">' + num(c.v) + ' %</b><p>' + esc((c.s || '') + ' clientes') + '</p>', 'Ver Clientes', 'Contratos firmados: ' + c.v + ' %');
    h += tarjeta('migraciones', '', '<h2>Migraciones a PYME</h2><b class="gt-n">' + num(m.v) + '</b><p>Confirmadas · ' + num(m.rev) + ' por revisar</p>', 'Ver Migraciones', 'Migraciones: ' + m.v);
    h += tarjeta('dedicados', '', '<h2>Dedicados</h2><b class="gt-n">' + num(d.v) + '</b><p>' + esc((d.s || '') + (d.pol ? ' · ' + d.pol + ' deben pólizas VGT' : '')) + '</p>', 'Ver Dedicados', 'Dedicados: ' + d.v);
    h += tarjeta('clientes', 'ancha', '<h2>Calidad de la venta</h2><div class="gt-v"><b class="gt-n">' + (q.v === null || q.v === undefined ? 'Sin datos' : num(q.v) + ' %') + '</b><p>de lo instalado en 12 meses sigue habilitado</p></div>' +
      '<div class="gt-cal" aria-hidden="true">' + cal.map((p) => '<i' + (p && p < 80 ? ' class="bajo"' : '') + ' style="height:' + Math.max(4, (Math.max(p, 60) - 60) / 40 * 100) + '%"></i>').join('') + '</div>' +
      '<p>' + esc(bajos.length ? bajos.slice(0, 3).map((x) => x.charAt(0).toUpperCase() + x.slice(1)).join(' y ') + ' por debajo de 80 %.' : 'Todos los meses sobre 80 %.') + ' Las bajas y reactivaciones salen del historial del TAD.</p>', 'Ver resumen de Clientes', 'Calidad de la venta: ' + q.v + ' %');
    h += tarjeta('clientes', '', '<h2>Estatus legal</h2><b class="gt-n">' + num((leg[0] || {}).p) + ' %</b><p>' + esc(leg.length ? leg[0].l + ' con contrato firmado. ' + leg.slice(1).map((x) => x.l.replace('Dedicado ', '').replace(/^./, (c) => c.toUpperCase()) + ' ' + x.p + ' %').join(', ') : '') + '</p>', 'Ver por segmento', 'Estatus legal');
    h += tarjeta('factibilidad', '', '<h2>Demanda sin red</h2><b class="gt-n">' + num(sr.zonas) + '</b><p>' + (sr.zonas ? (sr.zonas === 1 ? 'zona' : 'zonas') + ' con consultas sin red este mes (' + num(sr.consultas) + (sr.consultas === 1 ? ' consulta' : ' consultas') + ')' + (sr.top ? '. Más pedida: ' + esc(sr.top.l) : '') : 'Ninguna consulta sin red este mes') + '</p>', 'Dónde crecer la red', 'Demanda sin red: ' + sr.zonas);
    h += '<div class="gtj hueco"><h2>Ingresos de dedicados</h2><b>Por armar</b><p>Espacio reservado para facturación, cobranza y por cliente.</p></div>';
    h += '<div class="gtj blanca"><h2>Tus avisos</h2><ul class="gt-avisos"><li><span>Resumen semanal</span><small>Lunes 8:00</small></li><li><span>Cierre de corte certificado</span><small>Al cerrar</small></li><li><span>Un aliado pide un cliente</span><small>Al momento</small></li></ul></div>';
    $('zonaG').innerHTML = h + '</div>';
  }
  async function cargar(){
    const n = ++pedido; const r = rango(F.periodo); const k = 'gerencia2:' + F.periodo + ':' + F.comparar;
    const visto = cache.leer(k); D = visto || null; pintar();
    try {
      const d = await rpc('modulo_resumen', { p_modulo: 'gerencia', p_desde: r.desde, p_hasta: r.hasta, p_comparar: F.comparar });
      if(n !== pedido) return; D = d; cache.guardar(k, d); pintar();
    } catch (e) { if(n !== pedido) return; if(!visto){ D = { error: e.message }; pintar(); } else toast('No se pudo actualizar. ' + e.message, 'error'); }
  }
  // El Resumen del módulo sale encima, en solo lectura
  function abrirModulo(mod){
    if(!R()) return;
    let h = $('hojaGMod');
    if(!h){ h = document.createElement('section'); h.id = 'hojaGMod'; h.className = 'hoja completa lado gt-hoja'; h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', 'tGMod'); h.setAttribute('aria-hidden', 'true'); document.body.appendChild(h); prepararHojas(); }
    h.innerHTML = '<div class="hoja-cab"><div class="tx"><small>Resumen · solo lectura</small><b id="tGMod">' + esc(NOMBRES[mod] || mod) + '</b></div><button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div><div class="hoja-cuerpo"><div id="resGMod"></div></div>';
    abrirHoja('hojaGMod');
    R().crear($('resGMod'), { modulo: mod, yo, soloLectura: true, periodo: F.periodo });
  }
  document.addEventListener('change', (ev) => {
    if(ev.target.id === 'perG'){ F.periodo = ev.target.value; cargar(); }
    if(ev.target.id === 'cmpG'){ F.comparar = ev.target.value; cargar(); }
  });
  document.addEventListener('click', (ev) => {
    const t = ev.target; let b;
    if(t.closest('[data-ge="reintentar"]')){ cargar(); return; }
    if((b = t.closest('[data-gt]'))){ abrirModulo(b.dataset.gt); }
  });

  window.Armazon.arrancar(['admin', 'analista', 'lider', 'abogado', 'gerencia'], { activo: 'gerencia' }, (p) => {
    yo = p; if(window.Ficha && p.rol !== 'gerencia') window.Ficha.montar();
    F.periodo = periodos()[0];
    $('saludoG').textContent = saludo(); const d = new Date();
    $('subG').textContent = nombreMes(F.periodo).replace(/^./, (x) => x.toUpperCase()) + ' al día ' + d.getDate() + '. Toca una tarjeta para ver su resumen.';
    filtros(); cargar();
  });
})();
