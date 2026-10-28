// Lote 28/10: Resumen de Clientes (maqueta clientes-28oct, pantallas 4 y 4b). RPC clientes_resumen y clientes_detalle.
// Tarjetas por tipo de cliente (PYME, Dedicado corporativo, Dedicado ISP, VGT) que cambian las gráficas, promedios de 12 meses,
// churn del mes y de infancia (perdido antes de 60 días de instalado; sale de la última suspensión y habilitación del TAD),
// instalados por mes y si siguen habilitados, calidad de la venta por dueño, gestiones activas y estatus legal por segmento. Sin deuda.
(function(){
  'use strict';
  const C = window.Comun;
  const { esc, rpc, toast, cache, normalizeStr } = C;
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const num = (n) => Number(n || 0).toLocaleString('es-VE');
  const pct = (n) => (n === null || n === undefined ? 'Sin datos' : String(Number(n)).replace('.', ',') + ' %');
  const cap = (t) => String(t || '').replace(/^./, (c) => c.toUpperCase());
  const mesDe = (m) => MESES[Number(String(m).slice(5, 7)) - 1] || '';
  const SEGS = [['pyme', 'PYME'], ['corporativo', 'Dedicado corporativo'], ['isp', 'Dedicado ISP'], ['vgt', 'VGT']];
  const LEGAL = [['sin_gestionar', 'Sin gestionar', 'gris'], ['faltan', 'Faltan documentos', 'w'], ['revision', 'En revisión', 'azul2'], ['por_firmar', 'Por firmar', 'azul'], ['firmado', 'Firmado', 'ok']];
  const dato = (g, x, t) => ' data-cl-g="' + esc(g) + '" data-cl-x="' + esc(x) + '" data-cl-t="' + esc(t) + '"';
  function periodos(){ const r = []; const d = new Date(); for(let i = 0; i < 13; i++){ const x = new Date(d.getFullYear(), d.getMonth() - i, 1); r.push(x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-01'); } return r; }

  function crear(cont, o){
    const st = { mes: periodos()[0], seg: 'pyme', datos: null, pedido: 0, yo: o.yo };
    cont.classList.add('rs', 'clr');
    function cab(d){
      return '<div class="cr-barra"><label class="cr-sel"><span>Período</span><select class="campo" data-cl-mes aria-label="Período">' +
        periodos().map((m) => '<option value="' + m + '"' + (m === st.mes ? ' selected' : '') + '>' + esc(cap(mesDe(m)) + ' ' + m.slice(0, 4)) + '</option>').join('') + '</select></label>' +
        '<span class="cr-cmp">Comparar con <b>' + esc(cap(mesDe(periodos()[periodos().indexOf(st.mes) + 1] || st.mes))) + '</b></span>' + (d && d.solo_lectura ? '<span class="chip gris">Solo lectura</span>' : '') + '</div>';
    }
    function tarjetas(d){
      const t = d.tarjetas || {};
      const sub = { pyme: 'Gráficas de instalaciones y churn', corporativo: 'Contratos y estatus legal', isp: 'Habilitación y contratos', vgt: num(t.vgt_contratos) + ' contratos · ' + num(t.vgt_postes) + ' postes · pólizas' };
      return '<div class="clr-segs">' + SEGS.map((s) => '<button type="button" class="cx-seg' + (st.seg === s[0] ? ' on' : '') + '" data-cl-seg="' + s[0] + '" aria-pressed="' + (st.seg === s[0]) + '"><b>' + num(t[s[0]]) + '</b><span><span class="t">' + s[1] + '</span><small>' + esc(sub[s[0]]) + '</small></span></button>').join('') + '</div>';
    }
    function promedios(d){
      const p = d.prom || {};
      return '<div class="clr-prom"><span class="t">Promedios<br>12 meses</span>' + [[num(p.inst), 'instalaciones al mes'], [num(p.perd), 'pérdidas al mes (suspendidos y retirados)'], [pct(p.churn), 'churn mensual'], [pct(p.infancia), 'churn de infancia (60 días)'], [num(p.firmados), 'expedientes firmados al mes']]
        .map((x) => '<span class="p"><b>' + x[0] + '</b><small>' + x[1] + '</small></span>').join('') + '</div>';
    }
    function numeros(d){
      const n = d.nums || {}; const m = mesDe(d.mes);
      const t = (g, x, tit, v, sub, tono) => '<button type="button" class="cr-num' + (tono ? ' ' + tono : '') + '"' + dato(g, x, tit) + '><small>' + esc(tit) + '</small><b>' + v + '</b><span>' + esc(sub) + '</span></button>';
      return '<div class="clr-nums">' + t('hab', 'a', 'Servicios habilitados', num(n.habilitados), num(n.suspendidos) + ' suspendidos') +
        t('inst', d.mes.slice(0, 7), 'Instalados en ' + m, num(n.inst), num(n.inst_prev) + ' en ' + mesDe(periodos()[periodos().indexOf(d.mes) + 1] || d.mes) + ' · promedio ' + num(n.inst_prom)) +
        t('churn', d.mes.slice(0, 7) + '|tot', 'Churn del mes', pct(n.churn), num(n.perdidos) + ' perdidos sobre la base', 'r') +
        t('churn', d.mes.slice(0, 7) + '|inf', 'Churn de infancia', pct(n.infancia), 'Suspendidos antes de 60 días', 'r') +
        t('singes', 'todos', 'Sin gestionar legal', num(n.sin_gestionar), num(n.recientes) + ' recientes', 'w') + '</div>';
    }
    function instalados(d){
      const s = d.serie || []; const mx = Math.max(1, ...s.map((x) => x.a + x.b));
      return '<section class="rs-card"><div class="cr-h"><h3>Instalados por mes y si siguen habilitados</h3><small>Últimos 12 meses · toca un mes</small></div><div class="cr-cols clr-cols">' +
        s.map((x, i) => '<button type="button" class="cr-col' + (i === s.length - 1 ? ' hoy' : '') + '"' + dato('inst', x.m, 'Instalados en ' + mesDe(x.m + '-01') + ' ' + x.m.slice(0, 4)) + ' aria-label="' + esc(mesDe(x.m + '-01') + ': ' + (x.a + x.b) + ' instalados, ' + x.a + ' siguen') + '"><em>' + num(x.a + x.b) + '</em>' +
          '<span class="pila" style="height:' + ((x.a + x.b) / mx * 100).toFixed(1) + '%"><i class="no" style="flex:' + x.b + ' 1 0"></i><i class="si" style="flex:' + x.a + ' 1 0"></i></span><small>' + esc(cap(mesDe(x.m + '-01')).slice(0, 3)) + '</small></button>').join('') +
        '</div><div class="ley"><span><i class="c-azul"></i>Siguen habilitados</span><span><i class="c-w"></i>Ya no</span></div></section>';
    }
    function churn(d){
      const s = d.churn || []; const mx = Math.max(6, ...s.map((x) => Math.max(x.tot, x.inf)));
      return '<section class="rs-card"><div class="cr-h"><h3>Churn por mes</h3><small>Total y de infancia</small></div>' +
        '<div class="clr-ch"><span></span><small>Churn del mes</small><small>De infancia (60 días)</small></div>' +
        s.map((x) => '<div class="clr-ch"><span>' + esc(cap(mesDe(x.m + '-01')).slice(0, 3)) + '</span>' +
          '<button type="button" class="cr-hb"' + dato('churn', x.m + '|tot', 'Perdidos en ' + mesDe(x.m + '-01')) + '><span class="bar"><i class="c-azul2" style="transform:scaleX(' + (x.tot / mx).toFixed(3) + ')"></i></span><b>' + pct(x.tot) + '</b></button>' +
          '<button type="button" class="cr-hb"' + dato('churn', x.m + '|inf', 'Churn de infancia de ' + mesDe(x.m + '-01')) + '><span class="bar"><i class="' + (x.inf > 5 ? 'c-b' : 'c-w') + '" style="transform:scaleX(' + (x.inf / mx).toFixed(3) + ')"></i></span><b>' + pct(x.inf) + '</b></button></div>').join('') +
        '<p class="nota-chica">' + (d.sin_fechas ? 'Todavía sin datos: sale de la última suspensión y la última habilitación del TAD y se llena con la próxima carga. ' : 'Sale de la última suspensión y la última habilitación del TAD. ') + 'Meta de infancia: menos de 5 %.</p></section>';
    }
    function calidad(d){
      const c = d.calidad || [];
      const tono = (v, malo, medio, alto) => (alto ? (v >= medio ? 'verde' : v >= malo ? 'ambar' : 'rojo') : (v <= malo ? 'verde' : v <= medio ? 'ambar' : 'rojo'));
      return '<section class="rs-card"><div class="cr-h"><h3>Calidad de la venta por dueño</h3><small>Lo instalado en los últimos 6 meses</small></div>' +
        (c.length ? '<div class="clr-tab"><div class="th"><span>Dueño</span><span>Instalados</span><span>Siguen</span><span>Churn 60 días</span><span>Expediente firmado</span></div>' +
          c.map((x) => '<button type="button" class="tr"' + dato('calidad', normalizeStr(x.d), x.d + ' · instalado en 6 meses') + '><b>' + esc(x.d) + '</b><span>' + num(x.inst) + '</span><span><span class="chip ' + tono(x.siguen, 85, 90, true) + '">' + pct(x.siguen) + '</span></span>' +
            '<span><span class="chip ' + tono(x.churn, 4, 6) + '">' + pct(x.churn) + '</span></span><span>' + num(x.firm) + '</span></button>').join('') + '</div>' : '<p class="nota-chica">Sin instalaciones en los últimos 6 meses.</p>') + '</section>';
    }
    function gestiones(d){
      const g = d.gestiones || [];
      return '<section class="rs-card"><div class="cr-h"><h3>Gestiones activas</h3><small>Toca una para ver sus clientes</small></div>' +
        (g.length ? g.map((x) => { const tot = Math.max(1, x.total || 0); const venc = x.plazo && x.plazo < new Date().toISOString().slice(0, 10);
          return '<a class="clr-ge" href="clientes.html?f=todos&ges=' + esc(x.id) + '"><span><b>' + esc(x.nombre) + '</b><small>' + esc(x.plazo ? 'Meta ' + x.plazo.slice(8, 10) + '/' + x.plazo.slice(5, 7) + (venc ? ' · venció' : '') : 'Sin fecha') + '</small></span>' +
            '<span class="cp-pr"><i style="transform:scaleX(' + ((x.hechos || 0) / tot).toFixed(3) + ')"></i></span><span class="chip ' + (venc ? 'rojo' : x.plazo ? 'gris' : 'ambar') + '">' + num(x.hechos) + ' de ' + num(x.total) + '</span></a>'; }).join('')
          : '<p class="nota-chica">No hay gestiones activas.</p>') + '</section>';
    }
    function legal(d){
      const rows = d.legal || [];
      return '<section class="rs-card clr-legal"><div class="cr-h"><h3>Estatus legal por segmento</h3><small>Toca un tramo para ver sus clientes</small></div>' +
        rows.map((r) => { const tot = r.v.reduce((a, x) => a + x, 0);
          return '<div class="clr-lf"><b>' + esc(r.l) + '</b><span class="clr-lb">' + r.v.map((n, i) => n ? '<button type="button" class="c-' + LEGAL[i][2] + '" style="flex:' + n + ' 1 0"' + dato('legal', r.x + ':' + LEGAL[i][0], r.l + ' · ' + LEGAL[i][1]) + ' aria-label="' + esc(r.l + ', ' + LEGAL[i][1] + ': ' + n) + '">' + (n / Math.max(1, tot) > .06 ? num(n) : '') + '</button>' : '').join('') + '</span><small>' + num(tot) + '</small></div>'; }).join('') +
        '<div class="ley">' + LEGAL.map((x) => '<span><i class="c-' + x[2] + '"></i>' + x[1] + '</span>').join('') + '</div></section>';
    }
    function pintar(){
      const d = st.datos;
      if(!d){ cont.innerHTML = cab(null) + '<div class="rs-sk"><div class="clr-segs">' + '<span class="sk" style="height:66px;border-radius:18px"></span>'.repeat(4) + '</div><span class="sk" style="height:80px;border-radius:20px;display:block;margin-top:14px"></span><span class="sk" style="height:300px;border-radius:20px;display:block;margin-top:14px"></span></div>'; return; }
      if(d.error){ cont.innerHTML = cab(null) + '<div class="vacio" role="alert"><b>No se pudo cargar el resumen</b><p>' + esc(d.error) + '</p><button type="button" class="btn btn-chico" data-cl-reintentar>Reintentar</button></div>'; return; }
      cont.innerHTML = cab(d) + tarjetas(d) + promedios(d) + numeros(d) + '<div class="cr-g2">' + instalados(d) + churn(d) + '</div><div class="cr-g2">' + calidad(d) + gestiones(d) + '</div>' + legal(d);
    }
    async function cargar(){
      const n = ++st.pedido; const k = 'clres:' + st.mes + ':' + st.seg;
      const visto = cache.leer(k); st.datos = visto && !visto.error ? visto : st.datos; pintar();
      try { const d = await rpc('clientes_resumen', { p_mes: st.mes, p_seg: st.seg }); if(n !== st.pedido) return; st.datos = d; cache.guardar(k, d); pintar(); }
      catch (e) { if(n !== st.pedido) return; if(!st.datos || st.datos.error){ st.datos = { error: e.message }; pintar(); } else toast('No se pudo actualizar el resumen. ' + e.message, 'error'); }
    }
    cont.addEventListener('click', (ev) => {
      const t = ev.target; let b;
      if(t.closest('[data-cl-reintentar]')){ cargar(); return; }
      if((b = t.closest('[data-cl-seg]'))){ st.seg = b.dataset.clSeg; st.datos = null; cargar(); return; }
      if((b = t.closest('[data-cl-g]')) && st.datos){
        const d = st.datos; const g = b.dataset.clG;
        window.Resumen.detalle({ pre: 'Clientes · ' + (SEGS.find((s) => s[0] === d.seg) || [0, ''])[1], t: b.dataset.clT, g, x: b.dataset.clX, yo: st.yo, soloLectura: !!d.solo_lectura, tono: g === 'churn' ? 'r' : g === 'singes' ? 'w' : '',
          fuente: (pagina, cur) => rpc('clientes_detalle', { p_mes: d.mes, p_seg: d.seg, p_grafica: g, p_valor: cur.x, p_pagina: pagina }),
          filtros: g === 'inst' ? [{ x: b.dataset.clX, t: 'Todos' }, { x: b.dataset.clX + '|siguen', t: 'Siguen habilitados' }, { x: b.dataset.clX + '|no', t: 'Ya no' }] : null });
      }
    });
    cont.addEventListener('change', (ev) => { if(ev.target.matches('[data-cl-mes]')){ st.mes = ev.target.value; st.datos = null; cargar(); } });
    cargar();
    return { recargar: cargar, modulo: () => {} };
  }
  window.CliResumen = { crear };
})();
