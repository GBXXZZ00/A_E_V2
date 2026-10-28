// Lote 27/10: Resumen con gráficas de cada módulo (Lista | Resumen) y el panel de detalle detrás de cada número, barra o tramo.
// Un solo componente para los 7 módulos y Gerencia. Los números salen del servidor (modulo_resumen) y la lista de cada
// número o barra también (modulo_detalle, de 50 en 50); el mismo detalle se exporta a Excel (CSV con ; y BOM).
// Gráficas hechas con HTML y CSS: cada barra, tramo o fila es un botón.
(function(){
  'use strict';
  const C = window.Comun;
  const { $, esc, ic, rpc, toast, cache, abrirHoja, prepararHojas } = C;
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const NOMBRES = { clientes: 'Clientes', comisiones: 'Comisiones', revision: 'Revisión', migraciones: 'Migraciones', factibilidad: 'Factibilidad', dedicados: 'Dedicados', aliados: 'Aliados' };
  // Lote 28/10: estatus legal en 5 grupos ("Grandes negocios" es Sin gestionar, nunca completo)
  const LEGAL = ['Sin gestionar', 'Faltan documentos', 'En revisión', 'Por firmar', 'Firmado'];
  const LEGAL_X = ['sin_gestionar', 'faltan', 'revision', 'por_firmar', 'firmado'];
  const LEGAL_C = ['gris', 'w', 'azul2', 'azul', 'ok'];
  const COLORES = ['ok', 'verde2', 'azul', 'azul2', 'w', 'b', 'gris'];
  const POR_PAGINA = 50;
  const num = (n) => Number(n || 0).toLocaleString('es-VE');
  const fmt = (n) => n.fmt === 'pct' ? num(n.v) + ' %' : n.fmt === 'dias' ? num(n.v) + (Number(n.v) === 1 ? ' día' : ' días') : num(n.v);
  const color = (c) => COLORES.indexOf(c) >= 0 ? ' c-' + c : '';
  const mesCorto = (m, conAnio) => { const p = String(m || '').split('-'); const t = MESES[Number(p[1]) - 1] || ''; return conAnio ? t + ' ' + String(p[0]).slice(2) : t; };
  const mesLargo = (m) => { const p = String(m || '').split('-'); return (MESES_L[Number(p[1]) - 1] || '') + ' ' + p[0]; };
  const dato = (o) => ' data-rs-g="' + esc(o.g) + '" data-rs-x="' + esc(o.x) + '" data-rs-t="' + esc(o.t) + '"';
  // Tope redondo para las líneas de referencia
  function tope(mx){ if(mx <= 3) return 3; const p = Math.pow(10, Math.floor(Math.log10(mx))); const f = [1, 1.5, 2, 3, 4, 5, 6, 8, 10].find((k) => k * p >= mx) || 10; return f * p; }
  const sinMovimiento = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Gráficas ----------
  function lineas(mx){
    return '<div class="rs-ref" aria-hidden="true">' + [3, 2, 1, 0].map((i) => '<span style="bottom:' + (i / 3 * 100) + '%"><em>' + num(Math.round(mx * i / 3)) + '</em></span>').join('') + '</div>';
  }
  // Instalaciones mes a mes (24 meses) con el mismo mes del año anterior como marca tenue, o año contra año
  function graficaMes(g, st, mod){
    const d = g.data || []; const ult = d[d.length - 1] || {};
    const porMes = {}; d.forEach((x) => { porMes[x.m] = x; });
    const tot = (x) => x ? Number(x.a || 0) + Number(x.b || 0) : 0;
    const antDe = (m) => { const p = m.split('-'); return porMes[(Number(p[0]) - 1) + '-' + p[1]]; };
    const vista = st.vista[g.id] || 'mes';
    let cuerpo;
    if(vista === 'anio'){
      const anio = String(ult.m || '').slice(0, 4); const hasta = Number(String(ult.m || '').slice(5, 7)) || 12;
      const pares = []; for(let i = 1; i <= hasta; i++){ const mm = String(i).padStart(2, '0'); pares.push({ l: MESES[i - 1], a: porMes[(Number(anio) - 1) + '-' + mm], b: porMes[anio + '-' + mm], m: anio + '-' + mm }); }
      const mx = tope(Math.max(1, ...pares.map((p) => Math.max(tot(p.a), tot(p.b)))));
      const sa = pares.reduce((s, p) => s + tot(p.a), 0); const sb = pares.reduce((s, p) => s + tot(p.b), 0);
      const pc = sa ? Math.round((sb - sa) * 100 / sa) : null;
      cuerpo = '<div class="rs-plot rs-anio">' + lineas(mx) + '<div class="rs-cols">' + pares.map((p) =>
        '<button type="button" class="rs-par"' + dato({ g: g.id, x: p.m, t: 'Instalados en ' + mesLargo(p.m) }) + ' data-tip="' + esc(p.l + ': ' + num(tot(p.b)) + ' en ' + anio + ', ' + num(tot(p.a)) + ' en ' + (anio - 1) + '. Toca para ver la lista') + '" aria-label="' + esc(p.l + ' ' + anio + ': ' + tot(p.b) + ', ' + (anio - 1) + ': ' + tot(p.a)) + '">' +
        '<i class="ant" style="height:' + (tot(p.a) / mx * 100) + '%"></i><i class="act" style="height:' + (tot(p.b) / mx * 100) + '%"></i></button>').join('') + '</div>' +
        '<div class="rs-x">' + pares.map((p) => '<span>' + esc(p.l) + '</span>').join('') + '</div></div>' +
        '<div class="ley"><span><i class="c-gris"></i>' + (anio - 1) + ' · ' + num(sa) + '</span><span><i class="c-n"></i>' + anio + ' · ' + num(sb) + (pc === null ? '' : ' (' + (pc >= 0 ? '+' : '') + pc + ' %)') + '</span></div>';
    } else {
      const ver = d.slice(-25); const mx = tope(Math.max(1, ...ver.map(tot)));
      cuerpo = '<div class="rs-plot rs-meses">' + lineas(mx) + '<div class="rs-cols">' + ver.map((x, i) => {
        const a = antDe(x.m); const n = tot(x); const na = tot(a); const pc = na ? Math.round((n - na) * 100 / na) : null;
        const tip = mesLargo(x.m) + ': ' + num(n) + ' instalados, ' + num(x.a) + ' siguen habilitados' + (a ? '. ' + mesCorto(a.m, true) + ': ' + num(na) + (pc === null ? '' : ' (' + (pc >= 0 ? '+' : '') + pc + ' %)') : '') + '. Toca para ver la lista';
        return '<button type="button" class="rs-vb' + (i === ver.length - 1 ? ' hoy' : '') + '"' + dato({ g: g.id, x: x.x || x.m, t: 'Instalados en ' + mesLargo(x.m) }) + ' data-tip="' + esc(tip) + '" aria-label="' + esc(mesLargo(x.m) + ': ' + n) + '" style="--i:' + i + '">' +
          (na ? '<i class="fant" style="bottom:' + (na / mx * 100) + '%" aria-hidden="true"></i>' : '') +
          '<span class="pila" style="height:' + (n / mx * 100) + '%">' + (n ? '<em>' + num(n) + '</em>' : '') + '<i class="b" style="flex:' + Number(x.b || 0) + ' 1 0"></i><i class="a" style="flex:' + Number(x.a || 0) + ' 1 0"></i></span></button>';
      }).join('') + '</div><div class="rs-x">' + ver.map((x, i) => '<span class="' + (i === ver.length - 1 ? 'hoy mk' : (ver.length - 1 - i) % 3 === 0 ? 'mk' : '') + '">' + esc(mesCorto(x.m, i === ver.length - 1)) + '</span>').join('') + '</div></div>' +
        '<div class="ley"><span><i class="c-n"></i>' + esc(g.l1 || 'Siguen habilitados') + '</span><span><i class="c-w"></i>' + esc(g.l2 || 'Suspendidos hoy') + '</span><span><i class="c-fant"></i>Mismo mes del año anterior</span></div>';
    }
    return '<div class="rs-seg" role="group" aria-label="Vista"><button type="button" data-rs-vista2="' + esc(g.id) + ':mes"' + (vista === 'mes' ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + '>Mes a mes</button>' +
      '<button type="button" data-rs-vista2="' + esc(g.id) + ':anio"' + (vista === 'anio' ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + '>Año contra año</button></div>' + cuerpo;
  }
  // Barras verticales: a (oscuro) y b (ámbar) apiladas, con el valor encima
  function graficaV(g){
    const d = g.data || []; const tot = (x) => Number(x.a || 0) + Number(x.b || 0);
    const mx = tope(Math.max(1, ...d.map(tot)));
    const ancho = d.length <= 3 ? 72 : d.length <= 6 ? 44 : 30;
    return '<div class="rs-plot">' + lineas(mx) + '<div class="rs-cols" style="--bw:' + ancho + 'px">' + d.map((x, i) => {
      const n = tot(x);
      return '<button type="button" class="rs-vb"' + dato({ g: g.id, x: x.x, t: g.t + ' · ' + x.l }) + ' data-tip="' + esc(x.l + ': ' + num(n) + (x.b ? ' (' + num(x.a) + ' ' + (g.l1 || '').toLowerCase() + ', ' + num(x.b) + ' ' + (g.l2 || '').toLowerCase() + ')' : '') + '. Toca para ver la lista') + '" aria-label="' + esc(x.l + ': ' + n) + '" style="--i:' + i + '">' +
        '<span class="pila" style="height:' + (n / mx * 100) + '%"><em>' + num(n) + '</em><i class="b" style="flex:' + Number(x.b || 0) + ' 1 0"></i><i class="a' + color(x.c) + '" style="flex:' + Number(x.a || 0) + ' 1 0"></i></span></button>';
    }).join('') + '</div><div class="rs-x">' + d.map((x) => '<span title="' + esc(x.l) + '">' + esc(x.l) + '</span>').join('') + '</div></div>' +
      (g.l1 && g.l2 ? '<div class="ley"><span><i class="c-n"></i>' + esc(g.l1) + '</span><span><i class="c-w"></i>' + esc(g.l2) + '</span></div>' : '');
  }
  // Barras horizontales: etiqueta, barra y número
  function graficaH(g){
    const d = g.data || []; const mx = Math.max(1, ...d.map((x) => Number(x.a || 0)));
    if(g.vacio && !d.some((x) => Number(x.a) > 0)) return '<div class="rs-vacio">' + esc(g.vacio) + '</div>';
    return '<div class="rs-h">' + d.map((x, i) => '<button type="button" class="rs-hb"' + dato({ g: g.id, x: x.x, t: (g.id === 'lider' || g.id === 'zonas' || g.id === 'tipo' ? g.t + ' · ' : '') + x.l }) + ' data-tip="' + esc(x.l + ': ' + num(x.a) + '. Toca para ver la lista') + '" style="--i:' + i + '">' +
      '<span class="l">' + esc(x.l) + '</span><span class="pista"><i class="' + color(x.c).trim() + '" style="width:' + (Number(x.a) ? Math.max(3, Number(x.a) / mx * 100) : 0) + '%"></i></span><b>' + num(x.a) + '</b></button>').join('') + '</div>';
  }
  // Estatus legal por segmento: un tramo por grupo
  function graficaS(g){
    return '<div class="rs-s">' + (g.data || []).map((x) => {
      const v = (x.v || []).map(Number); const t = v.reduce((a, b) => a + b, 0);
      return '<div class="rs-s-fila"><div class="rs-s-cab"><b>' + esc(x.l) + '</b><span>' + num(t) + ' clientes · ' + (t ? Math.round(v[0] * 100 / t) : 0) + ' % completos</span></div><div class="rs-s-barra">' +
        v.map((n, i) => n ? '<button type="button" class="c-' + LEGAL_C[i] + '" style="flex:' + n + ' 1 0"' + dato({ g: g.id, x: x.x + ':' + LEGAL_X[i], t: x.l + ' · ' + LEGAL[i] }) + ' data-tip="' + esc(x.l + ', ' + LEGAL[i].toLowerCase() + ': ' + num(n) + '. Toca para ver la lista') + '" aria-label="' + esc(x.l + ', ' + LEGAL[i] + ': ' + n) + '"></button>' : '').join('') + '</div></div>';
    }).join('') + '</div><div class="ley">' + LEGAL.map((l, i) => '<span><i class="c-' + LEGAL_C[i] + '"></i>' + l + '</span>').join('') + '</div>';
  }
  // Siguen habilitadas: % de lo instalado cada mes que hoy está habilitado
  function graficaCal(g){
    const d = g.data || [];
    const peores = d.filter((x) => x.b && x.a / x.b < 0.8).map((x) => MESES_L[Number(x.m.slice(5, 7)) - 1]);
    return '<div class="rs-cal">' + d.map((x, i) => { const p = x.b ? Math.min(100, Math.round(x.a * 100 / x.b)) : 0;
      return '<button type="button" class="rs-cb' + (p && p < 80 ? ' bajo' : '') + '"' + dato({ g: g.id, x: x.x || x.m, t: 'Instalados en ' + mesLargo(x.m) }) + ' data-tip="' + esc(mesLargo(x.m) + ': ' + num(x.a) + ' de ' + num(x.b) + ' siguen habilitados. Toca para ver la lista') + '" aria-label="' + esc(mesLargo(x.m) + ': ' + p + ' %') + '" style="--i:' + i + '">' +
        '<em>' + (x.b ? p + '%' : '') + '</em><span style="height:' + (x.b ? Math.max(4, (Math.max(p, 60) - 60) / 40 * 100) : 0) + '%"></span><small>' + esc(mesCorto(x.m)) + '</small></button>'; }).join('') + '</div>' +
      (peores.length ? '<p class="rs-nota">' + esc(peores.slice(0, 3).map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join(' y ').replace(/ y (?=.* y )/g, ', ')) + ' quedaron por debajo de 80 %: revisa qué pasó con esas ventas.</p>' : '<p class="rs-nota">Todos los meses sobre 80 %.</p>');
  }
  function tarjeta(g, st, mod){
    let cuerpo;
    if(g.tipo === 'hueco') cuerpo = '<div class="rs-hueco"><b>Por armar</b><span>' + esc(g.h || '') + '</span></div>';
    else if(g.tipo === 'mes') cuerpo = graficaMes(g, st, mod);
    else if(g.tipo === 'v') cuerpo = (g.data || []).length ? graficaV(g) : '<div class="rs-vacio">' + esc(g.vacio || 'Sin datos en este período.') + '</div>';
    else if(g.tipo === 'h') cuerpo = graficaH(g);
    else if(g.tipo === 's') cuerpo = graficaS(g);
    else if(g.tipo === 'cal') cuerpo = graficaCal(g);
    else cuerpo = '';
    return '<section class="rs-card' + (g.tipo === 'hueco' ? ' hueco' : '') + '" aria-label="' + esc(g.t) + '"><div class="rs-cab"><div><h3>' + esc(g.t) + '</h3><p>' + esc(g.s || '') + '</p></div>' +
      (g.badge ? '<span class="chip ' + (g.bc === 'b' ? 'rojo' : g.bc === 'w' ? 'ambar' : 'gris') + '">' + esc(g.badge) + '</span>' : '') + '</div>' + cuerpo +
      (g.tip && g.tipo !== 'hueco' ? '<p class="rs-tipo">' + esc(g.tip) + '</p>' : '') + '</section>';
  }
  function numeros(nums){
    return '<div class="rs-nums" role="group" aria-label="Números">' + (nums || []).map((n, i) =>
      '<button type="button" class="rs-n' + (n.tono === 'w' ? ' w' : n.tono === 'b' ? ' b' : '') + '"' + dato({ g: n.g, x: n.x, t: n.l }) + ' style="--i:' + i + '" aria-label="' + esc(n.l + ': ' + fmt(n) + '. ' + (n.s || '') + '. Ver la lista') + '">' +
      '<b>' + esc(fmt(n)) + (n.cmp !== undefined && n.cmp !== null ? '<span class="rs-cmp ' + (n.cmp >= 0 ? 'sube' : 'baja') + '">' + (n.cmp >= 0 ? '↑ ' : '↓ ') + Math.abs(n.cmp) + ' %</span>' : '') + '</b>' +
      '<span>' + esc(n.l) + '</span><small>' + esc(n.s || '') + '</small></button>').join('') + '</div>';
  }
  function graficas(charts, st, mod){
    let h = '';
    for(let i = 0; i < charts.length; i += 2){
      const a = charts[i]; const b = charts[i + 1];
      h += '<div class="rs-fila' + (b ? '' : ' sola') + '"' + (b ? ' style="grid-template-columns:minmax(0,' + (Number(a.w) || 1) + 'fr) minmax(0,' + (Number(b.w) || 1) + 'fr)"' : '') + '>' + tarjeta(a, st, mod) + (b ? tarjeta(b, st, mod) : '') + '</div>';
    }
    return h;
  }
  function esqueletoRes(){
    return '<div class="rs-nums">' + '<span class="sk rs-sk-n"></span>'.repeat(4) + '</div><div class="rs-fila" style="grid-template-columns:minmax(0,1.6fr) minmax(0,1fr)">' +
      '<div class="rs-card"><span class="sk" style="width:40%;height:16px"></span><div class="rs-sk-barras">' + [52, 70, 44, 88, 63, 95, 58].map((p) => '<span class="sk" style="height:' + p + '%"></span>').join('') + '</div></div>' +
      '<div class="rs-card"><span class="sk" style="width:50%;height:16px"></span>' + [80, 55, 40, 25].map((p) => '<span class="sk rs-sk-h" style="width:' + p + '%"></span>').join('') + '</div></div>';
  }

  // ---------- Un Resumen dibujado en un contenedor ----------
  function periodos(){
    const hoy = new Date(); const l = [];
    for(let i = 0; i < 12; i++){ const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1); l.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')); }
    return l;
  }
  function rango(m){
    const p = m.split('-').map(Number); const ini = m + '-01';
    const fin = new Date(p[0], p[1], 0); const hoy = new Date();
    const f = fin > hoy ? hoy : fin;
    return { desde: ini, hasta: f.getFullYear() + '-' + String(f.getMonth() + 1).padStart(2, '0') + '-' + String(f.getDate()).padStart(2, '0') };
  }
  function crear(cont, o){
    const st = { modulo: o.modulo, periodo: periodos().indexOf(o.periodo) >= 0 ? o.periodo : periodos()[0], vista: {}, datos: null, pedido: 0, soloLectura: !!o.soloLectura, yo: o.yo || null };
    cont.classList.add('rs');
    function pintar(){
      const d = st.datos;
      const cab = '<div class="rs-barra"><div class="rs-per"><label class="solo-lector" for="rsPer' + st.modulo + '">Período</label><select class="campo rs-sel" id="rsPer' + st.modulo + '" data-rs-per>' +
        periodos().map((m) => '<option value="' + m + '"' + (m === st.periodo ? ' selected' : '') + '>' + esc(mesLargo(m).replace(/^./, (c) => c.toUpperCase())) + '</option>').join('') + '</select>' +
        (st.soloLectura ? '<span class="chip gris">Solo lectura</span>' : '') + '</div><span class="rs-ayuda">Toca un número o una barra para ver la lista</span></div>';
      if(!d){ cont.innerHTML = cab + esqueletoRes(); return; }
      if(d.error){ cont.innerHTML = cab + '<div class="vacio" role="alert"><b>No se pudo cargar el resumen</b><p>' + esc(d.error) + '</p><button type="button" class="btn btn-chico" data-rs-reintentar>Reintentar</button></div>'; return; }
      cont.innerHTML = cab + numeros(d.nums) + graficas(d.charts || [], st, st.modulo);
      if(!sinMovimiento() && !st.animado){ cont.classList.add('rs-entra'); st.animado = true; setTimeout(() => cont.classList.remove('rs-entra'), 400); }
    }
    async function cargar(){
      const n = ++st.pedido; const r = rango(st.periodo); const k = 'res:' + st.modulo + ':' + st.periodo;
      const visto = cache.leer(k); st.datos = visto && !visto.error ? visto : null; pintar();
      if(visto) cont.classList.add('rs-actualizando');
      try {
        const d = await rpc('modulo_resumen', { p_modulo: st.modulo, p_desde: r.desde, p_hasta: r.hasta });
        if(n !== st.pedido) return;
        st.datos = d; if(d && d.solo_lectura) st.soloLectura = true; cache.guardar(k, d); pintar();
      } catch (e) {
        if(n !== st.pedido) return;
        if(!st.datos){ st.datos = { error: e.message }; pintar(); }
        else toast('No se pudo actualizar el resumen. ' + e.message, 'error');
      } finally { if(n === st.pedido) cont.classList.remove('rs-actualizando'); }
    }
    cont.addEventListener('click', (ev) => {
      const t = ev.target; let b;
      if(t.closest('[data-rs-reintentar]')){ cargar(); return; }
      if((b = t.closest('[data-rs-vista2]'))){ const p = b.dataset.rsVista2.split(':'); st.vista[p[0]] = p[1]; pintar(); return; }
      if((b = t.closest('[data-rs-g]'))){ detalle({ modulo: st.modulo, g: b.dataset.rsG, x: b.dataset.rsX, t: b.dataset.rsT, periodo: st.periodo, soloLectura: st.soloLectura, yo: st.yo }); }
    });
    cont.addEventListener('change', (ev) => { if(ev.target.matches('[data-rs-per]')){ st.periodo = ev.target.value; cargar(); } });
    cargar();
    return { recargar: cargar, modulo: (m) => { if(m && m !== st.modulo){ st.modulo = m; st.vista = {}; cargar(); } }, estado: st };
  }

  // ---------- Panel de detalle (lote 28/10, un solo componente para todos los módulos) ----------
  // Arriba el total con su comparación, el reparto por dueño con barras, filtros, búsqueda y los desplegables por dueño
  // con tarjetas de clientes y sus chips. Abajo Exportar a Excel y Ver en la lista (o la acción que pida el módulo).
  // o.fuente(pagina) devuelve { total, grupos, filas, lista } (por defecto modulo_detalle); pagina -1 = todo.
  let D = null;
  function hoja(){
    let h = $('hojaRes');
    if(!h){
      h = document.createElement('section'); h.id = 'hojaRes'; h.className = 'hoja completa lado angosta rs-det';
      h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', 'tRes'); h.setAttribute('aria-hidden', 'true');
      document.body.appendChild(h); prepararHojas();
      h.addEventListener('click', clicDetalle);
      h.addEventListener('input', (ev) => { if(ev.target.id === 'rsBusca'){ clearTimeout(D && D.tb); const v = ev.target.value; if(D) D.tb = setTimeout(() => buscarDet(v), 160); } });
    }
    return h;
  }
  const tonoDe = (t) => (t === 'ok' ? 'verde' : t === 'w' ? 'ambar' : t === 'b' ? 'azul' : t === 'r' ? 'rojo' : 'gris');
  function filaDet(f, i){
    const abre = f.c && !D.soloLectura && window.Ficha;
    return '<' + (abre ? 'button type="button" data-rs-cli="' + i + '"' : 'div') + ' class="rs-df"><span class="tx"><b>' + esc(f.n) + '</b><small>' + esc(f.s || '') + '</small></span>' +
      (f.e ? '<span class="chip ' + tonoDe(f.t) + '">' + esc(f.e) + '</span>' : '') + '</' + (abre ? 'button' : 'div') + '>';
  }
  const visibles = () => { if(!D.q) return D.filas; const q = C.normalizeStr(D.q); return (D.todas || D.filas).filter((f) => C.normalizeStr([f.n, f.s, f.d, f.e].join(' ')).indexOf(q) >= 0); };
  function gruposDet(filas){
    const g = []; const idx = {};
    filas.forEach((f, i) => { const k = f.d || 'Sin dueño'; if(idx[k] === undefined){ idx[k] = g.length; g.push({ d: k, filas: [] }); } g[idx[k]].filas.push([f, i]); });
    const tot = {}; (D.grupos || []).forEach((x) => { tot[x.d] = x.n; });
    g.sort((a, b) => (tot[b.d] || b.filas.length) - (tot[a.d] || a.filas.length) || a.d.localeCompare(b.d));
    const solo = g.length === 1 || !!D.q;
    return g.map((x, n) => { const ab = solo || D.abiertos[x.d] !== undefined ? (solo || D.abiertos[x.d]) : n === 0;
      return '<div class="rs-dg' + (ab ? ' abierto' : '') + '"><button type="button" class="rs-dgc" data-rs-dg="' + esc(x.d) + '" aria-expanded="' + ab + '">' + ic('abajo') + '<b>' + esc(x.d) + '</b>' +
        '<span class="chip ' + tonoDe(D.tono || '') + '">' + num(tot[x.d] !== undefined && !D.q ? tot[x.d] : x.filas.length) + '</span></button>' +
        '<div class="rs-dgb">' + x.filas.map((p) => filaDet(p[0], p[1])).join('') + '</div></div>'; }).join('');
  }
  function pintarDetalle(){
    const h = hoja(); const d = D;
    const cab = '<div class="hoja-cab"><div class="tx"><small>' + esc(d.pre || NOMBRES[d.modulo] || d.modulo || '') + '</small><b id="tRes">' + esc(d.t) + '</b></div>' +
      '<button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>';
    let cuerpo;
    if(d.error) cuerpo = '<div class="vacio" role="alert"><b>No se pudo cargar la lista</b><p>' + esc(d.error) + '</p><button type="button" class="btn btn-chico" data-rs-det-reintentar>Reintentar</button></div>';
    else if(d.total === null) cuerpo = '<div class="rs-dt"><span class="sk" style="width:90px;height:44px;border-radius:12px"></span></div>' + C.esqueleto(6);
    else {
      const gs = (d.grupos || []).slice(0, 8); const mx = Math.max(1, ...gs.map((x) => x.n));
      cuerpo = '<div class="rs-dt"><b class="' + (d.tono ? 'tx-' + tonoDe(d.tono) : '') + '">' + num(d.total) + '</b><span>' + esc(d.comp || (d.total === 1 ? 'registro' : 'registros')) + '</span></div>' +
        (gs.length > 1 ? '<div class="rs-dp"><span class="rotulo">Por ' + esc(d.porQuien || 'dueño') + '</span>' + gs.map((x) => '<div class="rs-db"><span>' + esc(x.d) + '</span><span class="bar"><i class="c-' + (d.tono === 'w' ? 'w' : d.tono === 'r' ? 'b' : d.tono === 'ok' ? 'ok' : 'azul') + '" style="transform:scaleX(' + (x.n / mx).toFixed(3) + ')"></i></span><b>' + num(x.n) + '</b></div>').join('') + '</div>' : '') +
        ((d.filtros || []).length ? '<div class="filtros rs-df-f" role="tablist">' + d.filtros.map((x) => '<button type="button" role="tab" data-rs-fx="' + esc(x.x) + '" class="' + (x.x === d.x ? 'on' : '') + '" aria-selected="' + (x.x === d.x) + '">' + esc(x.t) + (x.n !== undefined ? ' <em>' + num(x.n) + '</em>' : '') + '</button>').join('') + '</div>' : '') +
        (d.total > 0 ? '<label class="rotulo arriba" for="rsBusca">Buscar cliente</label><input class="campo" id="rsBusca" type="search" maxlength="60" autocomplete="off" enterkeyhint="search" value="' + esc(d.q || '') + '">' : '');
      const fs = visibles();
      if(!d.total) cuerpo += C.vacio('Nada que mostrar', 'No hay registros en esta parte del resumen.');
      else if(!fs.length) cuerpo += C.vacio('Sin resultados', 'Nadie coincide con "' + d.q + '".');
      else cuerpo += '<div class="rs-dgs">' + gruposDet(fs) + '</div>' + (!d.q && d.filas.length < d.total ? '<button type="button" class="btn btn-2 btn-chico rs-mas" data-rs-mas' + (d.cargando ? ' disabled' : '') + '>' + (d.cargando ? 'Cargando…' : 'Ver ' + Math.min(POR_PAGINA, d.total - d.filas.length) + ' más') + '</button>' : '');
      if(d.total) cuerpo += '<p class="nota-chica">Cada grupo se abre y se cierra. Toca un cliente para ver su expediente.</p>';
    }
    const acc = d.accion ? (d.accion.href ? '<a class="btn" href="' + esc(d.accion.href) + '">' + esc(d.accion.t) + '</a>' : '<button type="button" class="btn" data-rs-accion>' + esc(d.accion.t) + '</button>')
      : d.lista && !d.soloLectura ? '<a class="btn" href="' + esc(d.lista) + '">Ver en la lista</a>' : '';
    const pie = d.error || d.total === null || !d.total ? '' : '<div class="hoja-pie"><button type="button" class="btn btn-2" data-rs-excel>Exportar a Excel</button>' + acc + '</div>';
    h.innerHTML = cab + '<div class="hoja-cuerpo">' + cuerpo + '</div>' + pie;
  }
  function fuenteDe(o){
    if(o.fuente) return (pagina) => o.fuente(pagina, o);
    return (pagina) => { const r = rango(o.periodo); return rpc('modulo_detalle', { p_modulo: o.modulo, p_grafica: o.g, p_valor: o.x, p_pagina: pagina, p_desde: r.desde, p_hasta: r.hasta }); };
  }
  async function pedir(pagina){
    const yo = D; const n = ++D.pedido;
    return fuenteDe(D)(pagina).then((x) => (n === D.pedido && yo === D) ? x : null);
  }
  async function detalle(o){
    D = Object.assign({}, o, { total: null, filas: [], todas: null, grupos: [], pagina: 0, pedido: 0, lista: null, error: null, q: '', abiertos: {} });
    pintarDetalle(); if(C.hojaAbierta && C.hojaAbierta() !== 'hojaRes') abrirHoja('hojaRes');
    try { const x = await pedir(0); if(!x) return; D.total = x.total; D.filas = x.filas || []; D.grupos = x.grupos || []; D.lista = x.lista; if(x.solo_lectura) D.soloLectura = true; }
    catch (e) { D.error = e.message; }
    pintarDetalle();
  }
  async function mas(){
    if(!D || D.cargando) return; D.cargando = true; pintarDetalle();
    try { const x = await pedir(D.pagina + 1); if(x){ D.pagina++; D.filas = D.filas.concat(x.filas || []); } }
    catch (e) { toast('No se pudo traer más. ' + e.message, 'error'); }
    D.cargando = false; pintarDetalle();
  }
  // La búsqueda mira todo: la primera vez trae la lista completa
  async function buscarDet(v){
    if(!D) return; D.q = String(v || '').trim();
    if(D.q && !D.todas && D.filas.length < D.total){ try { const x = await pedir(-1); if(x) D.todas = x.filas || []; } catch (e) { toast('No se pudo buscar. ' + e.message, 'error'); } }
    if(!D.todas) D.todas = D.filas;
    pintarDetalle(); const c = $('rsBusca'); if(c){ c.focus(); const n = c.value.length; c.setSelectionRange(n, n); }
  }
  // CSV con ; y BOM: Excel lo abre con acentos y columnas
  const celda = (v) => { let s = String(v === null || v === undefined ? '' : v); if(/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  async function excel(){
    const b = $('hojaRes').querySelector('[data-rs-excel]'); if(b){ b.disabled = true; b.textContent = 'Preparando…'; }
    try {
      const yo = D;
      const x = await fuenteDe(yo)(-1); if(yo !== D) return;
      const lineas = [['Dueño', 'Nombre', 'Detalle', 'Estado'].map(celda).join(';')].concat((x.filas || []).map((f) => [f.d, f.n, f.s, f.e].map(celda).join(';')));
      const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const nombre = ((D.pre || NOMBRES[D.modulo] || '') + ' ' + D.t).replace(/[^\wáéíóúñÁÉÍÓÚÑ ]+/g, ' ').trim().replace(/\s+/g, '_').slice(0, 80) + '.csv';
      if(window.Archivos) window.Archivos.descargar(blob, nombre);
      const n = (x.filas || []).length;
      toast(n < (x.total || 0) ? 'El Excel trae las primeras ' + num(n) + ' de ' + num(x.total) + ' filas. Para el resto, usa Ver en la lista' : 'Listo: ' + num(n) + ' filas en el Excel', n < (x.total || 0) ? 'error' : undefined);
    } catch (e) { toast('No se pudo exportar. ' + e.message, 'error'); }
    finally { const b2 = $('hojaRes') && $('hojaRes').querySelector('[data-rs-excel]'); if(b2){ b2.disabled = false; b2.textContent = 'Exportar a Excel'; } }
  }
  function clicDetalle(ev){
    const t = ev.target; let b;
    if(t.closest('[data-rs-mas]')){ mas(); return; }
    if(t.closest('[data-rs-excel]')){ excel(); return; }
    if(t.closest('[data-rs-det-reintentar]')){ detalle(D); return; }
    if(t.closest('[data-rs-accion]') && D && D.accion && D.accion.fn){ D.accion.fn(); return; }
    if((b = t.closest('[data-rs-fx]')) && D && b.dataset.rsFx !== D.x){ detalle(Object.assign({}, D, { x: b.dataset.rsFx, t: (D.titulos && D.titulos[b.dataset.rsFx]) || D.t })); return; }
    if((b = t.closest('[data-rs-dg]')) && D){ const k = b.dataset.rsDg; const ab = !b.parentNode.classList.contains('abierto'); D.abiertos[k] = ab; b.parentNode.classList.toggle('abierto', ab); b.setAttribute('aria-expanded', String(ab)); return; }
    if((b = t.closest('[data-rs-cli]'))){ const f = D && visibles()[Number(b.dataset.rsCli)]; if(f && f.c && window.Ficha) window.Ficha.abrir(f.c, { yo: D.yo }); }
  }

  // ---------- Etiqueta flotante al pasar el ratón (solo escritorio) ----------
  let tip = null;
  if(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches){
    document.addEventListener('pointerover', (ev) => {
      const b = ev.target.closest && ev.target.closest('.rs [data-tip]'); if(!b){ if(tip) tip.classList.remove('ver'); return; }
      if(!tip){ tip = document.createElement('div'); tip.className = 'rs-tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
      tip.textContent = b.dataset.tip; const r = b.getBoundingClientRect();
      tip.style.left = Math.max(8, Math.min(window.innerWidth - 268, r.left + r.width / 2 - 130)) + 'px'; tip.style.top = Math.max(8, r.top - 12) + 'px';
      tip.classList.add('ver');
    });
    window.addEventListener('scroll', () => { if(tip) tip.classList.remove('ver'); }, { passive: true });
  }

  // ---------- Lista | Resumen arriba de cada módulo ----------
  // La Lista queda igual; el Resumen se dibuja en #zonaRes y lo demás de la página se esconde mientras se ve.
  function enModulo(o){
    const main = document.querySelector('main.pagina'); const cab = main && main.querySelector('.cabeza');
    if(!main || !cab || $('zonaRes')) return null;
    const nav = document.createElement('div'); nav.className = 'rs-vista'; nav.setAttribute('role', 'group'); nav.setAttribute('aria-label', 'Vista');
    nav.innerHTML = '<button type="button" data-rs-ver="lista" class="on" aria-pressed="true">Lista</button><button type="button" data-rs-ver="resumen" aria-pressed="false">Resumen</button>';
    const h1 = cab.querySelector('.titulo'); h1.insertAdjacentElement('afterend', nav);
    const zona = document.createElement('div'); zona.id = 'zonaRes'; zona.hidden = true; zona.setAttribute('aria-live', 'polite'); main.appendChild(zona);
    let R = null; let actual = 'lista';
    const modulo = () => typeof o.modulo === 'function' ? o.modulo() : o.modulo;
    function ver(v, sinUrl){
      actual = v === 'resumen' ? 'resumen' : 'lista';
      main.classList.toggle('ver-res', actual === 'resumen'); zona.hidden = actual !== 'resumen';
      nav.querySelectorAll('[data-rs-ver]').forEach((b) => { const on = b.dataset.rsVer === actual; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      if(actual === 'resumen'){ if(!R) R = (o.crear || crear)(zona, { modulo: modulo(), yo: o.yo, soloLectura: o.soloLectura }); else if(R.modulo) R.modulo(modulo()); }
      if(!sinUrl){ try { const u = new URL(location.href); if(actual === 'resumen') u.searchParams.set('v', 'resumen'); else u.searchParams.delete('v'); history.replaceState(history.state, '', u.pathname + u.search); } catch (e) {} }
      if(o.alCambiar) o.alCambiar(actual);
    }
    nav.addEventListener('click', (ev) => { const b = ev.target.closest('[data-rs-ver]'); if(b) ver(b.dataset.rsVer); });
    let pedida = ''; try { pedida = new URLSearchParams(location.search).get('v') || ''; } catch (e) {}
    if(pedida === 'resumen') ver('resumen', true);
    return { ver, actual: () => actual, cambiarModulo: () => { if(R && R.modulo) R.modulo(modulo()); }, recargar: () => { if(R && R.recargar) R.recargar(); } };
  }

  window.Resumen = { enModulo, crear, detalle, mesLargo, num, tope, lineas, mesCorto };
})();
