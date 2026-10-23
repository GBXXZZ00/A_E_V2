// Corrida 23/10: Panel por módulo. Una tarjeta por módulo con los números del mes, una minigráfica de 6 meses y su alerta.
// Al tocar una tarjeta abre el tablero del módulo: gráfica por mes (Mes a mes o Año contra año) y la lista de lo que hay que gestionar.
// Todo sale de una sola llamada (public.panel), que ya filtra por permisos: el líder ve solo lo suyo y gerencia ve todo sin editar.
(function(){
  'use strict';
  const C = window.Comun;
  const { $, esc, ic, rpc, toast, cache, fecha, plural, abrirHoja, prepararHojas } = C;
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  // a y b: qué cuenta cada serie; alerta: qué se marca en rojo
  const MOD = [
    { id: 'comisiones', t: 'Comisiones', a: 'Cumplen', b: 'No cumplen', bRojo: true, enlace: 'comisiones.html' },
    { id: 'clientes', t: 'Clientes', a: 'Clientes nuevos', b: 'Legal listo', enlace: 'clientes.html' },
    { id: 'migraciones', t: 'Migraciones', a: 'Cambios nuevos', b: 'Salieron en el TAD', enlace: 'migraciones.html' },
    { id: 'revision', t: 'Revisión', a: 'Documentos subidos', b: 'Revisados', enlace: 'revision.html' },
    { id: 'dedicados', t: 'Dedicados', a: 'Contratos firmados', b: null, enlace: 'dedicados.html' },
    { id: 'aliados', t: 'Aliados', a: 'Solicitudes', b: 'Instaladas', enlace: 'aliados.html' },
    { id: 'factibilidad', t: 'Factibilidad', a: 'Consultas', b: 'Con seguimiento', enlace: 'factibilidad.html' }
  ];
  const AZUL = '#1B3A9E'; const AZUL2 = '#9DAEE0'; const ROJO = '#A32117'; const GRIS = '#C9CED6';
  const quieto = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let yo = null; let D = null; let lider = ''; let pedido = 0; let T = null; const GRAF = new Map();

  const sumaMes = (m, k) => { const p = m.split('-'); const d = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1 + k, 1)); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-01'; };
  const mesCorto = (m) => MESES[Number(m.slice(5, 7)) - 1] + ' ' + m.slice(2, 4);
  const mesHoy = () => (D && D.hoy ? String(D.hoy) : C.hoyClave()).slice(0, 7) + '-01';
  const meses = (n) => { const h = mesHoy(); const r = []; for(let i = n - 1; i >= 0; i--) r.push(sumaMes(h, -i)); return r; };
  const serie = (m) => { const x = new Map(); ((D && D.series) || []).filter((s) => s.m === m).forEach((s) => x.set(String(s.mes).slice(0, 10), s)); return x; };
  const val = (s, mes, k) => { const f = s.get(mes); return f ? Number(f[k]) || 0 : 0; };
  const gestion = (m) => ((D && D.gestion) || []).filter((g) => g.m === m);
  const vencido = (g) => g.v && String(g.v).slice(0, 10) < String(D.hoy || C.hoyClave());
  const editaNada = () => yo && yo.rol === 'gerencia';

  async function cargar(){
    const mio = ++pedido; const clave = 'panel:' + (yo && yo.rol) + ':' + lider;
    const g = cache.leer(clave); if(g){ D = g; pintar(); } else if(!D) $('zonaPn').innerHTML = esqueleto(); else $('zonaPn').classList.add('pn-cargando');
    try {
      const hoy = C.hoyClave().slice(0, 7) + '-01';
      const r = await rpc('panel', { p_desde: sumaMes(hoy, -23), p_hasta: hoy, p_lider: lider || null }); if(mio !== pedido) return;
      D = r; cache.guardar(clave, r); $('zonaPn').classList.remove('pn-cargando'); pintarFiltro(); pintar(); if(T) pintarTablero();
    } catch (e) {
      if(mio !== pedido) return; $('zonaPn').classList.remove('pn-cargando');
      if(!D) $('zonaPn').innerHTML = '<div class="vacio" role="alert"><b>No se pudo cargar el panel</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" data-pn="reintentar">Reintentar</button></div>';
      toast(e.message, 'error');
    }
  }
  function esqueleto(){ return '<div class="pn-grid">' + MOD.map(() => '<span class="sk pn-sk"></span>').join('') + '</div>'; }

  function pintarFiltro(){
    const z = $('filtroPn'); const l = (D && D.lideres) || [];
    if(!l.length){ z.innerHTML = ''; return; }
    if(z.querySelector('select')) return;
    z.innerHTML = '<div class="campo-s"><label for="pnLider">Líder</label><select id="pnLider"><option value="">Todos los líderes</option>' + l.map((x) => '<option value="' + esc(x.id) + '"' + (x.id === lider ? ' selected' : '') + '>' + esc(x.nombre) + '</option>').join('') + '</select></div>';
  }

  function alerta(m){
    const g = gestion(m.id); const v = g.filter(vencido).length;
    if(v) return '<span class="chip rojo">' + plural(v, 'vencido', 'vencidos') + '</span>';
    if(g.length) return '<span class="chip ambar">' + g.length + ' por gestionar</span>';
    return '<span class="chip verde">Al día</span>';
  }
  function pintar(){
    if(!D) return;
    const mh = mesHoy(); const ant = sumaMes(mh, -1);
    $('zonaPn').innerHTML = '<div class="pn-grid">' + MOD.map((m) => {
      const s = serie(m.id); const a = val(s, mh, 'a'); const aAnt = val(s, ant, 'a');
      const dif = a - aAnt; const flecha = dif > 0 ? '<small class="pn-dif sube">+' + dif + ' que ' + MESES[Number(ant.slice(5, 7)) - 1] + '</small>' : dif < 0 ? '<small class="pn-dif">' + dif + ' que ' + MESES[Number(ant.slice(5, 7)) - 1] + '</small>' : '';
      return '<button type="button" class="pn-card" data-pn-mod="' + m.id + '" aria-label="' + esc(m.t + '. Ver tablero') + '">' +
        '<span class="pn-cab"><b>' + esc(m.t) + '</b>' + alerta(m) + '</span>' +
        '<span class="pn-nums"><span class="pn-num"><em>' + a + '</em><small>' + esc(m.a) + ' en ' + MESES[Number(mh.slice(5, 7)) - 1] + '</small>' + flecha + '</span>' +
        (m.b ? '<span class="pn-num"><em' + (m.bRojo && val(s, mh, 'b') ? ' class="pn-rojo"' : '') + '>' + val(s, mh, 'b') + '</em><small>' + esc(m.b) + '</small></span>' : '') +
        '<span class="pn-num"><em>' + gestion(m.id).length + '</em><small>Por gestionar</small></span></span>' +
        '<span class="pn-mini"><canvas data-pn-mini="' + m.id + '" height="56" aria-label="' + esc(m.a + ' en los últimos 6 meses') + '" role="img"></canvas></span></button>';
    }).join('') + '</div>';
    MOD.forEach((m) => mini(m));
  }

  function grafica(canvas, cfg){
    const k = canvas.dataset.pnMini || canvas.id; const vieja = GRAF.get(k); if(vieja){ try { vieja.destroy(); } catch (e) {} }
    if(!window.Chart){ canvas.replaceWith(Object.assign(document.createElement('small'), { className: 'pn-singraf', textContent: 'La gráfica no cargó. Revisa tu internet.' })); return null; }
    cfg.options = Object.assign({ responsive: true, maintainAspectRatio: false, animation: quieto() ? false : { duration: 250 }, plugins: { legend: { display: false }, tooltip: { enabled: true } } }, cfg.options || {});
    const g = new window.Chart(canvas, cfg); GRAF.set(k, g); return g;
  }
  function mini(m){
    const cv = document.querySelector('[data-pn-mini="' + m.id + '"]'); if(!cv) return;
    const ms = meses(6); const s = serie(m.id);
    grafica(cv, { type: 'bar', data: { labels: ms.map(mesCorto), datasets: [{ data: ms.map((x) => val(s, x, 'a')), backgroundColor: ms.map((x, i) => i === ms.length - 1 ? AZUL : AZUL2), borderRadius: 4, maxBarThickness: 22 }] },
      options: { events: [], scales: { x: { display: false }, y: { display: false, beginAtZero: true } } } });
  }

  // ---------- Tablero del módulo ----------
  function hoja(){
    let h = $('hojaPn');
    if(!h){ h = document.createElement('section'); h.id = 'hojaPn'; h.className = 'hoja'; h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', 'tPn'); h.setAttribute('aria-hidden', 'true'); document.body.appendChild(h); prepararHojas(); }
    return h;
  }
  function abrirTablero(id){
    const m = MOD.find((x) => x.id === id); if(!m) return;
    T = { m, modo: 'mes', mes: null, solo: '', ver: 30 };
    hoja().innerHTML = '<div class="asa" aria-hidden="true"></div><div class="cab"><div><h2 id="tPn">' + esc(m.t) + '</h2><p class="sub-hoja" id="subPnT"></p></div><button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div><div id="cuerpoPn"></div>';
    abrirHoja('hojaPn'); pintarTablero();
  }
  function pintarTablero(){
    const z = $('cuerpoPn'); if(!z || !T) return; const m = T.m;
    const g = gestion(m.id); const venc = g.filter(vencido).length;
    $('subPnT').textContent = (lider && D.lideres ? ((D.lideres.find((x) => x.id === lider) || {}).nombre || '') + ' · ' : '') + (T.modo === 'mes' ? 'Últimos 12 meses' : 'Este año contra el anterior');
    z.innerHTML = '<div class="selector pn-modo" role="group" aria-label="Cómo ver la gráfica"><button type="button" data-pn-modo="mes"' + (T.modo === 'mes' ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + '>Mes a mes</button><button type="button" data-pn-modo="anio"' + (T.modo === 'anio' ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + '>Año contra año</button></div>' +
      '<div class="pn-graf"><canvas id="pnGraf" role="img" aria-label="' + esc(m.a + ' por mes') + '"></canvas></div>' +
      '<p class="pn-ley"><span class="pn-pt" style="background:' + AZUL + '"></span>' + esc(T.modo === 'mes' ? m.a : m.a + ' este año') + (T.modo === 'mes' && m.b ? '<span class="pn-pt" style="background:' + (m.bRojo ? ROJO : AZUL2) + '"></span>' + esc(m.b) : T.modo === 'anio' ? '<span class="pn-pt" style="background:' + GRIS + '"></span>Año anterior' : '') + '<span class="pn-tip">Toca una barra para ver ese mes en la lista</span></p>' +
      '<div class="pn-fnums"><button type="button" class="pn-fn' + (!T.solo ? ' on' : '') + '" data-pn-solo="" aria-pressed="' + !T.solo + '"><em>' + g.length + '</em><small>Por gestionar</small></button>' +
      '<button type="button" class="pn-fn' + (T.solo === 'venc' ? ' on' : '') + (venc ? ' pn-rojo' : '') + '" data-pn-solo="venc" aria-pressed="' + (T.solo === 'venc') + '"><em>' + venc + '</em><small>Vencidos</small></button>' +
      (editaNada() ? '' : '<a class="btn btn-2 btn-chico pn-ir" href="' + m.enlace + '">Ir a ' + esc(m.t) + ic('derecha') + '</a>') + '</div>' +
      '<div id="listaPn"></div>';
    dibujarTablero(); pintarLista();
  }
  function dibujarTablero(){
    const cv = $('pnGraf'); if(!cv) return; const m = T.m; const s = serie(m.id);
    let cfg;
    if(T.modo === 'mes'){
      const ms = meses(12);
      const ds = [{ label: m.a, data: ms.map((x) => val(s, x, 'a')), backgroundColor: ms.map((x) => T.mes && T.mes !== x ? AZUL2 : AZUL), borderRadius: 4, maxBarThickness: 28 }];
      if(m.b) ds.push({ label: m.b, data: ms.map((x) => val(s, x, 'b')), backgroundColor: m.bRojo ? ROJO : GRIS, borderRadius: 4, maxBarThickness: 28 });
      cfg = { type: 'bar', data: { labels: ms.map(mesCorto), datasets: ds }, options: { onClick: (ev, el, g) => { if(el && el.length){ const x = ms[el[0].index]; T.mes = T.mes === x ? null : x; T.ver = 30;
          // Se recolorea en el sitio: rehacer la gráfica dentro de su propio clic la rompe
          g.data.datasets[0].backgroundColor = ms.map((y) => T.mes && T.mes !== y ? AZUL2 : AZUL); g.update('none'); pintarLista(); } },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } } } };
    } else {
      const a = Number(mesHoy().slice(0, 4)); const de = (y) => MESES.map((x, i) => val(s, y + '-' + String(i + 1).padStart(2, '0') + '-01', 'a'));
      cfg = { type: 'line', data: { labels: MESES, datasets: [{ label: String(a), data: de(a).map((v, i) => i <= Number(mesHoy().slice(5, 7)) - 1 ? v : null), borderColor: AZUL, backgroundColor: AZUL, tension: 0, pointRadius: 3 },
        { label: String(a - 1), data: de(a - 1), borderColor: GRIS, backgroundColor: GRIS, tension: 0, pointRadius: 2 }] }, options: { scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } } } };
    }
    grafica(cv, cfg);
  }
  function filas(){
    let f = gestion(T.m.id);
    if(T.solo === 'venc') f = f.filter(vencido);
    if(T.mes) f = f.filter((g) => g.d && String(g.d).slice(0, 7) === T.mes.slice(0, 7));
    return f;
  }
  function pintarLista(){
    const z = $('listaPn'); if(!z) return; const f = filas();
    const filtro = T.mes ? '<span class="chip azul pn-quitar"><span>Desde ' + esc(C.mesAnio(T.mes)) + '</span><button type="button" data-pn="sinMes" aria-label="Quitar el filtro del mes">' + ic('x') + '</button></span>' : '';
    if(!f.length){ z.innerHTML = filtro + '<div class="vacio"><b>' + (gestion(T.m.id).length ? 'Nada con este filtro' : 'No hay nada por gestionar') + '</b><p>' + (gestion(T.m.id).length ? 'Quita el filtro para ver toda la lista.' : 'Este módulo está al día.') + '</p></div>'; return; }
    const abre = (g) => g.c && !editaNada();
    z.innerHTML = filtro + '<p class="pn-cuenta">' + plural(f.length, 'caso', 'casos') + ' por gestionar</p><div class="ge-lista">' + f.slice(0, T.ver).map((g, i) => {
      const extra = [g.x, g.l, g.v ? (vencido(g) ? 'Venció el ' : 'Antes del ') + fecha(g.v) : g.d ? 'Desde el ' + fecha(String(g.d).slice(0, 10)) : ''].filter(Boolean).join(' · ');
      return (abre(g) ? '<button type="button" class="ge-li" data-pn-cli="' + i + '">' : '<div class="ge-li">') + '<span><b>' + esc(g.n || 'Sin nombre') + '</b><small' + (vencido(g) ? ' class="pn-rojo"' : '') + '>' + esc(extra) + '</small></span>' + (abre(g) ? ic('derecha', 'ch') + '</button>' : '</div>');
    }).join('') + '</div>' + (f.length > T.ver ? '<div class="acciones"><button type="button" class="btn btn-2 btn-ancho" data-pn="mas">Ver ' + Math.min(30, f.length - T.ver) + ' más</button></div>' : '');
  }

  document.addEventListener('change', (ev) => { if(ev.target.id === 'pnLider'){ lider = ev.target.value; cargar(); } });
  document.addEventListener('click', (ev) => {
    const t = ev.target; let b;
    if((b = t.closest('[data-pn-mod]'))){ abrirTablero(b.dataset.pnMod); return; }
    if((b = t.closest('[data-pn-modo]'))){ if(T){ T.modo = b.dataset.pnModo; T.mes = null; pintarTablero(); } return; }
    if((b = t.closest('[data-pn-solo]'))){ if(T){ T.solo = b.dataset.pnSolo; T.ver = 30; pintarTablero(); } return; }
    if(t.closest('[data-pn="sinMes"]')){ if(T){ T.mes = null; dibujarTablero(); pintarLista(); } return; }
    if(t.closest('[data-pn="mas"]')){ if(T){ T.ver += 30; pintarLista(); } return; }
    if(t.closest('[data-pn="reintentar"]')){ cargar(); return; }
    if((b = t.closest('#hojaPn [data-pn-cli]'))){ const g = filas()[Number(b.dataset.pnCli)]; if(g && g.c && window.Ficha) window.Ficha.abrir(g.c, { yo }); }
  });

  window.Armazon.arrancar(['admin', 'analista', 'lider', 'abogado', 'gerencia'], { activo: 'panel' }, (p) => {
    yo = p; if(window.Ficha && p.rol !== 'gerencia') window.Ficha.montar();
    cargar();
  });
})();
