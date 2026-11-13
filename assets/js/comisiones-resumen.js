// Lote 28/10: Resumen de Comisiones por corte (maqueta comisiones-28oct, pantallas 5 y 7). RPC comisiones_resumen.
// Selector de corte y comparación con el anterior a la misma fecha, Líder del mes (último corte cerrado), 4 números, ranking con podio
// (Líderes, Canales, Aliados), equipos, instaladas por corte, por instalar por horas, monto del corte (30 $ por cliente) y cartas y proformas.
// Cada número, barra o fila abre el detalle nuevo (comisiones_detalle) agrupado por dueño.
(function(){
  'use strict';
  const C = window.Comun;
  const { esc, ic, rpc, toast, cache, normalizeStr } = C;
  const num = (n) => Number(n || 0).toLocaleString('es-VE');
  const cap = (t) => String(t || '').replace(/^./, (c) => c.toUpperCase());
  const mesCorto = (m) => cap(String(m || '').slice(0, 3));
  const dato = (g, x, t, extra) => ' data-cr-g="' + esc(g) + '" data-cr-x="' + esc(x) + '" data-cr-t="' + esc(t) + '"' + (extra || '');
  const iniciales = (n) => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
  const TROFEO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/></svg>';

  function crear(cont, o){
    const st = { corte: null, datos: null, pedido: 0, rk: 'corporativas', vs: 'ritmo', yo: o.yo };
    cont.classList.add('rs', 'cr');
    function cab(d){
      const cortes = (d && d.cortes) || [];
      return '<div class="cr-barra"><label class="cr-sel"><span>Corte</span><select class="campo" data-cr-corte aria-label="Corte">' +
        (cortes.length ? cortes.map((k) => '<option value="' + esc(k.corte) + '"' + (k.corte === (d && d.corte) ? ' selected' : '') + '>' + esc(cap(k.mes)) + (k.en_curso ? ' (en curso)' : k.cerrado ? '' : ' (abierto)') + '</option>').join('') : '<option>Cargando…</option>') + '</select></label>' +
        (d ? '<span class="cr-cmp">Comparar con <b>' + esc(cap(d.mes_anterior)) + (d.misma_fecha ? ', a la misma fecha' : '') + '</b></span>' : '') +
        (d && d.solo_lectura ? '<span class="chip gris">Solo lectura</span>' : '') + '</div>';
    }
    // ---------- Lote 13/11 parte 12 (maqueta obs-13nov 21): Resumen nuevo ----------
    const plural2 = (n, a, b) => num(n) + ' ' + (Number(n) === 1 ? a : b);
    const flecha = (pct) => { if(pct === null || pct === undefined) return ''; const sube = Number(pct) >= 0;
      return '<span class="cr2-d ' + (sube ? 'up' : 'dn') + '">' + (sube ? '↑' : '↓') + ' ' + num(Math.abs(Number(pct))) + ' %</span>'; };
    const dec = (n) => (n === null || n === undefined ? '' : String(Number(n).toFixed(1)).replace('.', ','));
    const ddmm = (s) => s ? String(s).slice(8, 10) + '/' + String(s).slice(5, 7) : '';
    function ganadores(d){
      const l = d.lider_mes || {}; if(!l.lider && !l.canales && !l.aliados) return '';
      const b = (t, x, com) => '<div><small>' + t + '</small><b>' + (x ? esc(x.nombre) : 'Sin ganador') + '</b><span>' + (x ? plural2(x.inst, 'instalada', 'instaladas') + (com && x.com !== undefined ? ' · ' + num(x.com) + ' ' + (x.com === 1 ? 'comisiona' : 'comisionan') : '') : 'Nadie instaló') + '</span></div>';
      return '<div class="cr2-gan"><div class="t">🏆 Ganadores de ' + esc(l.mes || '') + ' <span>· ' + (l.cerrado ? 'corte cerrado' : 'corte abierto') + ', por equipo</span></div>' +
        b('Ventas corporativas', l.lider, true) + b('Canales de atención', l.canales) + b('Aliado comercial', l.aliados) + '</div>';
    }
    function tarjetas(d){
      const n = d.nums || {}; const de = Number(n.inst) || 0; const com = Number(n.comisionan) || 0;
      const hay = (x) => x !== null && x !== undefined;
      const dif = hay(n.mediana) && hay(n.mediana_prev) ? Number(n.mediana) - Number(n.mediana_prev) : null;
      return '<div class="cr2-k">' +
        '<button type="button" class="cr2-kc"' + dato('equipo', 'corporativas', 'Instaladas del corte · Ventas corporativas') + '><span class="l">Instaladas del corte · Ventas corporativas</span><span class="v">' + num(de) + '</span>' + flecha(n.pct) +
          '<span class="x">' + num(n.inst_prev) + ' en ' + esc(d.mes_anterior) + ' al día ' + num(d.dia) + ' del corte</span></button>' +
        '<button type="button" class="cr2-kc"' + dato('comisionan', 'corporativas', 'Ya comisionan · Ventas corporativas') + '><span class="l">Ya comisionan</span><span class="v">' + num(com) + ' <small>de ' + num(de) + '</small></span><span class="cr2-mini"><i style="width:' + (de ? Math.round(100 * com / de) : 0) + '%"></i></span><span class="x">' + num(Math.max(0, de - com)) + ' todavía sin legal o pago</span></button>' +
        '<button type="button" class="cr2-kc"' + (hay(n.atrasadas) ? dato('por_instalar', 'atrasadas_todas', 'Órdenes atrasadas') : ' disabled') + '><span class="l">Órdenes atrasadas</span><span class="v cr2-am">' + num(n.atrasadas) + '</span><span class="x">' + (hay(n.atrasadas) ? 'Del corte, sin instalar hace más de 1 día' : 'Solo se ve en el corte en curso') + '</span></button>' +
        '<div class="cr2-kc"><span class="l">Días de orden a instalación</span><span class="v">' + (hay(n.mediana) ? dec(n.mediana) : 'Sin datos') + '</span>' +
          (dif !== null ? '<span class="cr2-d ' + (dif > 0 ? 'dn' : 'up') + '">' + (dif > 0 ? '↑' : '↓') + ' ' + dec(Math.abs(dif)) + ' días</span>' : '') +
          '<span class="x">' + (hay(n.mediana_prev) ? dec(n.mediana_prev) + ' en ' + esc(d.mes_anterior) : 'Sin dato de ' + esc(d.mes_anterior)) + '. Si sube, es peor</span></div></div>';
    }
    function ranking(d){
      const L = (d.ranking || {})[st.rk] || []; const max = Math.max(1, ...L.map((x) => Number(x.inst) || 0));
      const fila = (x) => '<button type="button" class="f' + (x.yo ? ' yo' : '') + '"' + dato('ranking', st.rk + '|' + normalizeStr(x.nombre), x.nombre + ' · instaladas') + '><span class="n">' + num(x.pos) + '</span><span class="nm">' + esc(x.nombre) + '</span>' +
        '<span class="cr2-bar bb"><i style="flex:' + (x.com || 0) + ';background:#0F6642"></i><i style="flex:' + Math.max(0, (x.inst || 0) - (x.com || 0)) + ';background:#8FD1AE"></i><i style="flex:' + Math.max(0, max - (x.inst || 0)) + '"></i></span>' +
        '<span class="r"><b>' + plural2(x.inst, 'instalada', 'instaladas') + '</b> · ' + num(x.com) + ' ' + (x.com === 1 ? 'comisiona' : 'comisionan') + '</span></button>';
      return '<section class="cr2-box"><span class="cr2-tabs" role="tablist">' + [['corporativas', 'Líderes'], ['canales', 'Canales'], ['aliados', 'Aliados comerciales']].map((x) => '<button type="button" role="tab" class="' + (st.rk === x[0] ? 'on' : '') + '" aria-selected="' + (st.rk === x[0]) + '" data-cr-rk="' + x[0] + '">' + x[1] + '</button>').join('') + '</span>' +
        '<h3>Ranking del corte</h3><p class="sub">Instaladas por ' + (st.rk === 'aliados' ? 'aliado' : 'persona') + ' en este corte</p><div class="cr2-rk">' + (L.length ? L.map(fila).join('') : '<p class="nota-chica">Nadie instaló todavía en este corte.</p>') + '</div>' +
        '<div class="cr2-ley"><span><i style="background:#0F6642"></i>Comisiona</span><span><i style="background:#8FD1AE"></i>Instalada, falta legal o pago</span></div></section>';
    }
    function equipos(d){
      const E = d.equipos || []; const sd = ((d.pob || {}).sin_dueno || {}).inst || 0;
      const tope = Math.max(10, ...E.map((e) => Math.max(e.ahora || 0, e.anterior || 0)));
      const fi = (e, ali) => '<button type="button" class="fi' + (ali ? ' cr2-sep' : '') + '"' + dato('equipo', e.equipo, e.nombre + ' · instaladas') + '><span class="h"><b>' + esc(e.nombre) + '</b><span><b>' + num(e.ahora) + '</b> · ' + esc(d.mes_anterior) + ' ' + num(e.anterior) + ' ' + flecha(e.pct) + '</span></span>' +
        '<span class="cr2-bar">' + (ali ? '<i style="flex:' + (e.ahora || 0) + ';background:#4B5563"></i>' : '<i style="flex:' + (e.com || 0) + ';background:#1F45C4"></i><i style="flex:' + Math.max(0, (e.ahora || 0) - (e.com || 0)) + ';background:#A9BCF5"></i>') + '<i style="flex:' + Math.max(0, tope - (e.ahora || 0)) + '"></i></span>' +
        '<span class="cr2-bar prev"><i style="flex:' + (e.anterior || 0) + '"></i><i style="flex:' + Math.max(0, tope - (e.anterior || 0)) + ';background:none"></i></span></button>';
      return '<section class="cr2-box"><h3>Equipos</h3><p class="sub">Este corte contra ' + esc(d.mes_anterior) + ', al mismo día del corte</p><div class="cr2-eq">' +
        E.filter((e) => e.equipo !== 'aliados').map((e) => fi(e)).join('') + E.filter((e) => e.equipo === 'aliados').map((e) => fi(e, true)).join('') +
        '<button type="button" class="fi"' + dato('equipo', 'sin_dueno', 'Sin dueño') + '><span class="h"><b>Sin dueño</b><span><b>' + num(sd) + '</b> · no comisionan hasta asignarlas</span></span></button></div>' +
        '<div class="cr2-ley"><span><i style="background:#1F45C4"></i>Comisiona</span><span><i style="background:#A9BCF5"></i>Pendiente</span><span><i style="background:#4B5563"></i>Aliados</span><span><i style="background:#B8BEC6"></i>' + esc(cap(d.mes_anterior)) + ' al mismo día</span></div></section>';
    }
    // Instaladas por corte: Ritmo del corte (línea acumulada día a día, como la maqueta) o Cortes cerrados
    function ritmoSvg(d){
      const r = d.ritmo || {}; const A = r.actual || []; const P = r.anterior || []; const M = (r.promedio || []).map(Number); const L = Math.max(r.largo || 30, A.length, P.length, 2);
      const tope = Math.max(10, ...A, ...P, ...M); const paso = tope <= 20 ? 5 : tope <= 40 ? 10 : tope <= 80 ? 20 : 50; const top = Math.ceil(tope / paso) * paso;
      const X = (i) => 30 + (380 * i / (L - 1)); const Y = (v) => 140 - 120 * v / top;
      const pts = (l) => l.map((v, i) => X(i).toFixed(1) + ',' + Y(Number(v)).toFixed(1)).join(' ');
      const ult = A.length ? A[A.length - 1] : 0; const pct = d.nums ? d.nums.pct : null;
      const grid = []; for(let v = 0; v <= top; v += paso) grid.push(v);
      return '<svg viewBox="0 0 420 170" class="cr2-svg" role="img" aria-label="' + esc('Ritmo del corte: ' + ult + ' instaladas al día ' + (r.dia || A.length)) + '"><g stroke="#ECEEF1">' + grid.map((v) => '<line x1="30" x2="410" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"/>').join('') + '</g>' +
        '<g font-size="10" fill="#69717C">' + grid.map((v) => '<text x="4" y="' + (Y(v) + 3).toFixed(1) + '">' + v + '</text>').join('') + '<text x="30" y="160">día 1</text>' +
        (r.en_curso && A.length > 1 && A.length < L ? '<text x="' + Math.min(X(A.length - 1), 330).toFixed(1) + '" y="160" text-anchor="middle">hoy, día ' + A.length + '</text>' : '') + '<text x="410" y="160" text-anchor="end">día ' + L + '</text></g>' +
        (M.length ? '<polyline fill="none" stroke="#B8BEC6" stroke-width="2" stroke-dasharray="4 4" points="' + pts(M) + '"/>' : '') +
        (P.length ? '<polyline fill="none" stroke="#69717C" stroke-width="2" points="' + pts(P) + '"/>' : '') +
        (A.length ? '<polyline fill="none" stroke="#1F45C4" stroke-width="3.5" points="' + pts(A) + '"/><circle cx="' + X(A.length - 1).toFixed(1) + '" cy="' + Y(ult).toFixed(1) + '" r="5" fill="#1F45C4"/>' +
          '<text x="' + Math.min(X(A.length - 1) + 8, 330).toFixed(1) + '" y="' + (Y(ult) - 2).toFixed(1) + '" font-size="12" font-weight="800" fill="#1F45C4">' + esc(num(ult) + (pct === null || pct === undefined ? '' : ' · ' + (pct >= 0 ? '↑' : '↓') + ' ' + num(Math.abs(pct)) + ' %')) + '</text>' : '') + '</svg>' +
        '<div class="cr2-ley"><span><i style="background:#1F45C4"></i>' + esc(cap(d.mes) + (d.en_curso ? ' (en curso)' : '')) + '</span><span><i style="background:#69717C"></i>' + esc(cap(d.mes_anterior)) + '</span><span><i style="background:#B8BEC6"></i>Promedio de 3 cortes</span></div>';
    }
    function cerradosHtml(d){
      const C2 = d.cerrados || []; if(!C2.length) return '<p class="nota-chica">Todavía no hay cortes cerrados.</p>';
      const max = Math.max(1, ...C2.map((x) => x.comisionaron + x.pasaron + x.perdieron));
      return '<div class="cr2-cer">' + C2.map((x) => '<button type="button" class="f"' + dato('serie', x.corte + '||corporativas', 'Instaladas en ' + x.mes) + '><span class="nm">' + esc(cap(x.mes)) + '</span><span class="cr2-bar"><i style="flex:' + x.comisionaron + ';background:#0F6642"></i><i style="flex:' + x.pasaron + ';background:#E0A93B"></i><i style="flex:' + x.perdieron + ';background:#A32117"></i><i style="flex:' + (max - x.comisionaron - x.pasaron - x.perdieron) + '"></i></span><b>' + num(x.comisionaron + x.pasaron + x.perdieron) + '</b></button>').join('') + '</div>' +
        '<div class="cr2-ley"><span><i style="background:#0F6642"></i>Comisionaron</span><span><i style="background:#E0A93B"></i>Pasaron al siguiente</span><span><i style="background:#A32117"></i>Se perdieron</span></div>';
    }
    function serie(d){
      return '<section class="cr2-box"><span class="cr2-tabs" role="tablist">' + [['ritmo', 'Ritmo del corte'], ['cerrados', 'Cortes cerrados']].map((x) => '<button type="button" role="tab" class="' + (st.vs === x[0] ? 'on' : '') + '" aria-selected="' + (st.vs === x[0]) + '" data-cr-vs="' + x[0] + '">' + x[1] + '</button>').join('') + '</span>' +
        '<h3>Instaladas por corte</h3><p class="sub">Ventas corporativas, ' + (st.vs === 'ritmo' ? 'día a día, contra los cortes anteriores' : 'cómo terminó cada corte') + '</p>' + (st.vs === 'ritmo' ? ritmoSvg(d) : cerradosHtml(d)) + '</section>';
    }
    function porInstalar(d){
      const p = d.por_instalar;
      if(!p) return '<section class="cr2-box"><h3>Órdenes por instalar</h3><p class="sub">Solo se ve en el corte en curso.</p></section>';
      const max = Math.max(1, p.al_dia || 0, p.atrasadas || 0, p.muy || 0);
      const f = (x, t, s, n, col) => '<button type="button" class="f"' + dato('por_instalar', x, 'Por instalar · ' + t) + '><span><b>' + t + '</b><small>' + s + '</small></span><span class="cr2-bar"><i style="flex:' + (n || 0) + ';background:' + col + '"></i><i style="flex:' + (max - (n || 0)) + '"></i></span><b>' + num(n) + '</b></button>';
      return '<section class="cr2-box"><h3>Órdenes por instalar</h3><p class="sub">Del corte. A los 10 días se dan por perdidas</p><div class="cr2-pi">' +
        f('al_dia', 'Al día', 'menos de 1 día', p.al_dia, '#B8BEC6') + f('atrasadas', 'Atrasadas', '1 a 3 días', p.atrasadas, '#E0A93B') + f('muy', 'Muy atrasadas', '4 a 9 días', p.muy, '#E5776B') +
        '<button type="button" class="perd"' + dato('por_instalar', 'perdidas', 'Perdidas') + '><span>Perdidas · 10 días o más, o de antes del corte</span><span>' + num(p.perdidas) + ' ›</span></button></div></section>';
    }
    function dinero(d){
      const m = d.monto || {}; const v = Number(m.monto) || 0; const a = (m.asegurado || 0) * v; const j = (m.en_juego || 0) * v; const u = (m.ultima || 0) * v;
      return '<section class="cr2-box cr2-m"><h3>Dinero del corte</h3><p class="sub">' + num(v) + ' $ por cliente con legal y pago, incluidas migraciones</p><div class="tot">' + num(a + j + u) + ' $ <small>posibles</small></div>' +
        '<span class="cr2-bar gr"><i style="flex:' + a + ';background:#0F6642"></i><i style="flex:' + j + ';background:#E0A93B"></i><i style="flex:' + u + ';background:#A32117"></i></span>' +
        '<button type="button" class="li"' + dato('monto', 'cumplen', 'Asegurado') + '><span><i style="background:#0F6642"></i>Asegurado · ' + plural2(m.asegurado, 'cliente', 'clientes') + '</span><b style="color:#0F6642">' + num(a) + ' $</b></button>' +
        '<button type="button" class="li"' + dato('monto', 'pasan', 'En juego') + '><span><i style="background:#E0A93B"></i>En juego · ' + num(m.en_juego) + (m.cerrado ? ' pasaron al siguiente' : ' pueden cumplir antes del ' + ddmm(m.limite)) + '</span><b style="color:#754B00">' + num(j) + ' $</b></button>' +
        '<button type="button" class="li"' + dato('monto', 'pierden', 'Última oportunidad') + '><span><i style="background:#A32117"></i>Última oportunidad · ' + num(m.ultima) + (m.ultima === 1 ? ' viene' : ' vienen') + ' de ' + esc(d.mes_anterior) + '</span><b style="color:#A32117">' + num(u) + ' $</b></button></section>';
    }
    // Cartas y proformas y suspendidos antes de 60 días: se conservan, debajo
    function cartasBox(d){
      const c = d.cartas || {}; const n = d.nums || {}; const tot = (c.canales || 0) + (c.lider || 0) + (c.por_enviar || 0);
      return '<section class="cr2-box cr2-m"><h3>Cartas y proformas</h3><p class="sub">Instaladas del corte</p>' +
        '<span class="cr2-bar gr"><i style="flex:' + (c.canales || 0) + ';background:#0F6642"></i><i style="flex:' + (c.lider || 0) + ';background:#8FA9EE"></i><i style="flex:' + (c.por_enviar || 0) + ';background:#E0A93B"></i>' + (tot ? '' : '<i style="flex:1"></i>') + '</span>' +
        '<button type="button" class="li"' + dato('cartas', 'canales', 'Enviadas por Canales') + '><span><i style="background:#0F6642"></i>Enviadas por Canales</span><b>' + num(c.canales) + '</b></button>' +
        '<button type="button" class="li"' + dato('cartas', 'lider', 'Enviadas por el líder') + '><span><i style="background:#8FA9EE"></i>Enviadas por el líder · falta Canales</span><b>' + num(c.lider) + '</b></button>' +
        '<button type="button" class="li"' + dato('cartas', 'por_enviar', 'Carta y proforma por enviar') + '><span><i style="background:#E0A93B"></i>Por enviar' + (c.esperan ? ' · ' + num(c.esperan) + ' esperan más de 2 días' : '') + '</span><b>' + num(c.por_enviar) + '</b></button>' +
        '<button type="button" class="li"' + dato('susp60', 'x', 'Suspendidos antes de 60 días') + '><span><i style="background:#A32117"></i>Suspendidos antes de 60 días (este corte)</span><b>' + num(n.susp60) + '</b></button>' +
        '<div class="li"><span><i style="background:#B8BEC6"></i>Siguen habilitadas de ' + esc(d.mes_anterior) + '</span><b>' + (n.siguen_prev === null || n.siguen_prev === undefined ? 'Sin datos' : num(n.siguen_prev) + ' %') + '</b></div></section>';
    }
    // Resumen del líder (sin maqueta propia, mismo estilo): lo suyo contra el corte pasado, su posición, lo que le falta y lo que pierde el día límite
    function vistaLider(d){
      const l = d.lider || {};
      const pos = l.pos ? 'Vas ' + num(l.pos) + '.º de ' + num(l.de) : 'Todavía sin instalaciones en este corte';
      return '<div class="cr2-k">' +
        '<div class="cr2-kc"><span class="l">Tus instaladas del corte</span><span class="v">' + num(l.inst) + '</span>' + flecha(l.pct) + '<span class="x">' + num(l.prev) + ' en ' + esc(d.mes_anterior) + ' al día ' + num(d.dia) + ' del corte</span></div>' +
        '<div class="cr2-kc"><span class="l">Ya comisionan</span><span class="v">' + num(l.com) + ' <small>de ' + num(l.inst) + '</small></span><span class="cr2-mini"><i style="width:' + (l.inst ? Math.round(100 * (l.com || 0) / l.inst) : 0) + '%"></i></span><span class="x">' + esc(pos) + '</span></div>' +
        '<a class="cr2-kc" href="comisiones.html?f=falta"><span class="l">Te falta para cobrar</span><span class="v cr2-am">' + num(l.faltan) + '</span><span class="x">' + num(l.faltan_legal) + ' sin legal · ' + num(l.faltan_pago) + ' sin pago</span></a>' +
        '<a class="cr2-kc" href="comisiones.html?f=ultimo"><span class="l">Se pierden el ' + esc(ddmm(d.limite)) + '</span><span class="v cr2-ro">' + num(l.pierden) + '</span><span class="x">Vienen de ' + esc(d.mes_anterior) + ' y todavía no cumplen</span></a></div>' +
        '<div class="cr2-g3">' + porInstalar(d) + '</div>';
    }
    function pintar(){
      const d = st.datos;
      if(!d){ cont.innerHTML = cab(null) + '<div class="rs-sk"><span class="sk" style="height:64px;border-radius:20px"></span><div class="cr-nums">' + '<span class="sk" style="height:110px;border-radius:20px"></span>'.repeat(4) + '</div><span class="sk" style="height:320px;border-radius:20px;margin-top:14px"></span></div>'; return; }
      if(d.error){ cont.innerHTML = cab(null) + '<div class="vacio" role="alert"><b>No se pudo cargar el resumen</b><p>' + esc(d.error) + '</p><button type="button" class="btn btn-chico" data-cr-reintentar>Reintentar</button></div>'; return; }
      if(d.lider && !d.nums){ cont.innerHTML = cab(d) + '<div class="cr2-r">' + vistaLider(d) + '</div>'; return; }
      cont.innerHTML = cab(d) + '<div class="cr2-r">' + ganadores(d) + tarjetas(d) + '<div class="cr2-g2">' + ranking(d) + equipos(d) + '</div><div class="cr2-g3">' + serie(d) + porInstalar(d) + dinero(d) + '</div>' + (d.cartas ? '<div class="cr2-g1">' + cartasBox(d) + '</div>' : '') + '</div>';
    }
    async function cargar(){
      const n = ++st.pedido; const k = 'comres:' + (st.corte || 'actual');
      const visto = cache.leer(k); st.datos = visto && !visto.error ? visto : st.datos; pintar();
      try {
        const d = await rpc('comisiones_resumen', { p_corte: st.corte });
        if(n !== st.pedido) return;
        st.datos = d; st.corte = d.corte; cache.guardar(k, d); pintar();
      } catch (e) {
        if(n !== st.pedido) return;
        if(!st.datos || st.datos.error){ st.datos = { error: e.message }; pintar(); } else toast('No se pudo actualizar el resumen. ' + e.message, 'error');
      }
    }
    cont.addEventListener('click', (ev) => {
      const t = ev.target; let b;
      if(t.closest('[data-cr-reintentar]')){ cargar(); return; }
      if((b = t.closest('[data-cr-rk]'))){ st.rk = b.dataset.crRk; pintar(); return; }
      if((b = t.closest('[data-cr-vs]'))){ st.vs = b.dataset.crVs; pintar(); return; }
      if((b = t.closest('[data-cr-g]')) && st.datos){
        const d = st.datos; const g = b.dataset.crG; const x = b.dataset.crX;
        const o = { pre: 'Corte de ' + d.mes + ' · Resumen', t: b.dataset.crT, g, x, yo: st.yo, soloLectura: !!d.solo_lectura,
          fuente: (pagina, cur) => rpc('comisiones_detalle', { p_corte: d.corte, p_grafica: g, p_valor: cur.x, p_pagina: pagina }) };
        if(g === 'cartas'){ const c = d.cartas || {};
          o.tono = x === 'por_enviar' ? 'w' : 'ok'; o.porQuien = 'líder';
          o.comp = num(c.canales + c.lider) + ' ya enviadas · ' + num(c.canales) + ' por Canales, ' + num(c.lider) + ' por el líder';
          o.filtros = [{ x: 'por_enviar', t: 'Por enviar', n: c.por_enviar }, { x: 'ip', t: 'Esperan la IP', n: c.falta_ip }, { x: 'enviadas', t: 'Enviadas', n: (c.canales || 0) + (c.lider || 0) }];
          o.titulos = { por_enviar: 'Carta y proforma por enviar', ip: 'Esperan la IP', enviadas: 'Cartas y proformas enviadas' };
          if(!d.solo_lectura) o.accion = { t: 'Ir a enviar', href: 'comisiones.html?t=cartas' }; }
        if((g === 'inst' || (g === 'equipo' && x === 'corporativas')) && d.nums) o.comp = num(d.nums.inst_prev) + ' en ' + d.mes_anterior + (d.misma_fecha ? ' a la misma fecha' : '');
        if(g === 'por_instalar'){ o.tono = 'w'; o.accion = d.solo_lectura ? null : { t: 'Ver órdenes', fn: () => { if(window.PorInstalar){ C.cerrarHoja(); window.PorInstalar.abrir({ yo: st.yo }); } } }; }
        if(g === 'monto') o.tono = x === 'cumplen' ? 'ok' : x === 'pasan' ? 'w' : 'r';
        if(g === 'por_instalar' && (x === 'perdidas' || x === 'muy')) o.tono = 'r';
        window.Resumen.detalle(o);
      }
    });
    cont.addEventListener('change', (ev) => { if(ev.target.matches('[data-cr-corte]')){ st.corte = ev.target.value; st.datos = null; cargar(); } });
    cargar();
    return { recargar: cargar };
  }
  window.ComResumen = { crear };
})();
