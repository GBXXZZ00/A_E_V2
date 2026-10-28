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
    const st = { corte: null, datos: null, pedido: 0, rk: 'corporativas', yo: o.yo };
    cont.classList.add('rs', 'cr');
    function cab(d){
      const cortes = (d && d.cortes) || [];
      return '<div class="cr-barra"><label class="cr-sel"><span>Corte</span><select class="campo" data-cr-corte aria-label="Corte">' +
        (cortes.length ? cortes.map((k) => '<option value="' + esc(k.corte) + '"' + (k.corte === (d && d.corte) ? ' selected' : '') + '>' + esc(cap(k.mes)) + (k.en_curso ? ' (en curso)' : k.cerrado ? '' : ' (abierto)') + '</option>').join('') : '<option>Cargando…</option>') + '</select></label>' +
        (d ? '<span class="cr-cmp">Comparar con <b>' + esc(cap(d.mes_anterior)) + (d.misma_fecha ? ', a la misma fecha' : '') + '</b></span>' : '') +
        (d && d.solo_lectura ? '<span class="chip gris">Solo lectura</span>' : '') + '</div>';
    }
    function lider(d){
      const l = d.lider_mes || {}; const x = l.lider;
      return '<div class="cr-lider">' + TROFEO + '<span class="tx"><small>Líder de ' + esc(l.mes || '') + (l.cerrado ? '' : ' (corte abierto)') + '</small><b>' + (x ? esc(x.nombre) + ' · ' + num(x.inst) + (x.inst === 1 ? ' instalada' : ' instaladas') + ', ' + num(x.com) + ' comisionan' : 'Todavía sin instalaciones') + '</b></span>' +
        '<span class="cr-otros">' + [l.canales ? 'Canales: ' + esc(l.canales.nombre) + ' (' + num(l.canales.inst) + ')' : '', l.aliados ? 'Aliados: ' + esc(l.aliados.nombre) + ' (' + num(l.aliados.inst) + ')' : ''].filter(Boolean).join(' · ') + '</span></div>';
    }
    function numeros(d){
      const n = d.nums || {};
      const t = (g, x, tit, v, sub, tono) => '<button type="button" class="cr-num' + (tono ? ' ' + tono : '') + '"' + (g ? dato(g, x, tit) : ' disabled') + '><small>' + esc(tit) + '</small><b>' + v + '</b><span>' + esc(sub) + '</span></button>';
      return '<div class="cr-nums">' + t('inst', 'todas', 'Instaladas en el corte', num(n.inst), num(n.inst_prev) + ' en ' + d.mes_anterior + (d.misma_fecha ? ' a la misma fecha' : '')) +
        t('comisionan', 'x', 'Comisionan', num(n.comisionan), num(n.esperan) + ' esperan legal o pago') +
        (n.por_instalar === null || n.por_instalar === undefined ? t('', '', 'Por instalar', 'Sin datos', 'Solo en el corte en curso') : t('por_instalar', 'mas24', 'Por instalar', num(n.por_instalar), 'Pasan de ' + (d.horas_alerta || 24) + ' horas', n.por_instalar ? 'w' : '')) +
        t('', '', 'De orden a instalación', n.mediana === null || n.mediana === undefined ? 'Sin datos' : String(n.mediana).replace('.', ',') + (Number(n.mediana) === 1 ? ' día' : ' días'), 'Mediana del corte') + '</div>';
    }
    function ranking(d){
      const l = (d.ranking || {})[st.rk] || [];
      const top = l.slice(0, 3); const resto = l.slice(3); const mx = Math.max(1, ...l.map((x) => x.inst));
      const k = (x) => st.rk + '|' + normalizeStr(x.nombre);
      const podio = top.length ? '<div class="cr-podio">' + [top[1], top[0], top[2]].map((x, i) => x ? '<button type="button" class="cr-p' + (i === 1 ? ' uno' : '') + (x.yo ? ' yo' : '') + '"' + dato('ranking', k(x), x.nombre + ' · instaladas') + '>' +
        (i === 1 ? '<span class="va">Va primero</span>' : '') + '<span class="pos">' + x.pos + '</span><span class="av">' + esc(iniciales(x.nombre)) + '</span><b>' + esc(x.nombre) + '</b><strong>' + num(x.inst) + '</strong><small>' + num(x.com) + (x.com === 1 ? ' comisiona' : ' comisionan') + '</small></button>' : '<span class="cr-p vacio"></span>').join('') + '</div>' : '';
      const filas = resto.map((x) => '<button type="button" class="cr-rf' + (x.yo ? ' yo' : '') + '"' + dato('ranking', k(x), x.nombre + ' · instaladas') + '><span class="pos">' + x.pos + '</span><span class="nm">' + esc(x.nombre) + '</span>' +
        '<span class="bar"><i class="com" style="flex:' + x.com + ' 1 0"></i><i class="pen" style="flex:' + (x.inst - x.com) + ' 1 0"></i><i style="flex:' + (mx - x.inst) + ' 1 0"></i></span><b>' + num(x.inst) + ' · ' + num(x.com) + (x.com === 1 ? ' comisiona' : ' comisionan') + '</b></button>').join('');
      return '<section class="rs-card cr-rank"><div class="cr-h"><h3>Ranking del corte</h3><small>Instaladas por dueño</small><div class="cr-tabs" role="tablist">' +
        [['corporativas', 'Líderes'], ['canales', 'Canales'], ['aliados', 'Aliados']].map((x) => '<button type="button" role="tab" data-cr-rk="' + x[0] + '" class="' + (st.rk === x[0] ? 'on' : '') + '" aria-selected="' + (st.rk === x[0]) + '">' + x[1] + '</button>').join('') + '</div></div>' +
        (l.length ? podio + filas + '<div class="ley"><span><i class="c-ok"></i>Comisiona</span><span><i class="c-verde2"></i>Instalada, falta legal o pago</span></div>' : '<p class="nota-chica">Todavía no hay instalaciones de este equipo en el corte.</p>') + '</section>';
    }
    function equipos(d){
      const n = d.nums || {}; const mx = Math.max(1, ...(d.equipos || []).map((e) => Math.max(e.ahora, e.anterior)));
      return '<section class="rs-card"><div class="cr-h"><h3>Equipos</h3><small>Este corte y ' + esc(d.mes_anterior) + ' completo</small></div>' +
        (d.equipos || []).map((e) => '<button type="button" class="cr-eq"' + dato('equipo', e.equipo, e.nombre + ' · instaladas') + '><span class="l1"><b>' + esc(e.nombre) + '</b><small>' + num(e.ahora) + ' ahora · ' + num(e.anterior) + ' en ' + esc(d.mes_anterior) + '</small></span>' +
          '<span class="bar"><i class="com" style="width:' + (e.com / mx * 100).toFixed(1) + '%"></i><i class="pen" style="width:' + ((e.ahora - e.com) / mx * 100).toFixed(1) + '%"></i><i class="ant" style="width:' + (Math.max(0, e.anterior - e.ahora) / mx * 100).toFixed(1) + '%"></i></span></button>').join('') +
        '<div class="ley"><span><i class="c-azul"></i>Comisiona</span><span><i class="c-azul2"></i>Pendiente</span></div>' +
        '<button type="button" class="cr-lin"' + dato('susp60', 'x', 'Suspendidos antes de 60 días') + '><span>Suspendidos antes de 60 días (este corte)</span><b>' + num(n.susp60) + '</b></button>' +
        '<div class="cr-lin"><span>Siguen habilitadas de ' + esc(d.mes_anterior) + '</span><b>' + (n.siguen_prev === null || n.siguen_prev === undefined ? 'Sin datos' : num(n.siguen_prev) + ' %') + '</b></div></section>';
    }
    function serie(d){
      const s = d.serie || []; const mx = Math.max(1, ...s.map((x) => x.total));
      return '<section class="rs-card"><div class="cr-h"><h3>Instaladas por corte</h3><small>Últimos ' + s.length + ' cortes</small></div><div class="cr-cols">' +
        s.map((x) => '<button type="button" class="cr-col' + (x.actual ? ' hoy' : '') + '"' + dato('serie', x.corte, 'Instaladas en ' + x.mes) + ' aria-label="' + esc(x.mes + ': ' + x.total + ' instaladas, ' + x.cumplen + ' comisionan') + '"><em>' + num(x.total) + '</em>' +
          '<span class="pila" style="height:' + (x.total / mx * 100).toFixed(1) + '%"><i class="no" style="flex:' + (x.total - x.cumplen) + ' 1 0"></i><i class="si" style="flex:' + x.cumplen + ' 1 0"></i></span><small>' + esc(mesCorto(x.mes)) + '</small></button>').join('') +
        '</div><div class="ley"><span><i class="c-azul"></i>Comisionan</span><span><i class="c-azul2"></i>No comisionan</span></div></section>';
    }
    function porInstalar(d){
      const p = d.por_instalar;
      if(!p) return '<section class="rs-card"><div class="cr-h"><h3>Por instalar</h3></div><p class="nota-chica">Solo se ve en el corte en curso.</p></section>';
      const f = [['a', 'Menos de 24 h', 'gris'], ['b', '24 a 72 horas', 'w'], ['c', '3 a 7 días', 'b'], ['d', 'Más de 7 días', 'b']]; const mx = Math.max(1, ...f.map((x) => p[x[0]] || 0));
      return '<section class="rs-card"><div class="cr-h"><h3>Por instalar</h3><small>Órdenes de ' + esc(d.mes) + '</small></div>' +
        f.map((x) => '<button type="button" class="cr-hb"' + dato('por_instalar', x[0], 'Por instalar · ' + x[1]) + '><span>' + x[1] + '</span><span class="bar"><i class="c-' + x[2] + '" style="transform:scaleX(' + ((p[x[0]] || 0) / mx).toFixed(3) + ')"></i></span><b>' + num(p[x[0]]) + '</b></button>').join('') +
        (p.viejas ? '<button type="button" class="enlace cr-viejas"' + dato('por_instalar', 'viejas', 'Órdenes viejas') + '>' + num(p.viejas) + (p.viejas === 1 ? ' orden vieja' : ' órdenes viejas') + ' (antes de ' + esc(d.mes) + ')</button>' : '') + '</section>';
    }
    function monto(d){
      const m = d.monto || {}; const $m = (n) => num(Number(n || 0) * Number(m.monto || 0)) + ' $';
      const lim = String(m.limite || '').slice(8, 10) + '/' + String(m.limite || '').slice(5, 7);
      const c = d.cartas || {}; const tot = Math.max(1, (c.canales || 0) + (c.lider || 0) + (c.por_enviar || 0));
      return '<section class="rs-card"><div class="cr-h"><h3>Monto del corte</h3><small>' + num(m.monto) + ' $ por cliente</small></div>' +
        '<button type="button" class="cr-lin"' + dato('monto', 'cumplen', 'Total a comisionar') + '><span>Total a comisionar (' + num(m.cumplen) + ' cumplen)</span><b class="tx-verde">' + $m(m.cumplen) + '</b></button>' +
        '<button type="button" class="cr-lin"' + dato('monto', 'pasan', 'Pasan al próximo corte') + '><span>' + (m.cerrado ? 'Pasaron al próximo corte' : 'Pasan al próximo corte si no cumplen el ' + lim) + ' (' + num(m.pasan) + ')</span><b class="tx-ambar">' + $m(m.pasan) + '</b></button>' +
        '<button type="button" class="cr-lin"' + dato('monto', 'pierden', 'Se pierden') + '><span>' + (m.cerrado ? 'Se perdieron' : 'Se pierden si no cumplen') + ': ya venían del corte anterior (' + num(m.pierden) + ')</span><b class="tx-rojo">' + $m(m.pierden) + '</b></button>' +
        '<div class="cr-h" style="margin-top:18px"><h3>Cartas y proformas</h3><small>Del corte, toca para ver por líder</small></div>' +
        '<div class="cr-stack"><button type="button" class="c-ok" style="flex:' + (c.canales || 0) + ' 1 0"' + dato('cartas', 'canales', 'Enviadas por Canales') + ' aria-label="Enviadas por Canales: ' + num(c.canales) + '"></button>' +
          '<button type="button" class="c-azul2" style="flex:' + (c.lider || 0) + ' 1 0"' + dato('cartas', 'lider', 'Enviadas por el líder') + ' aria-label="Enviadas por el líder: ' + num(c.lider) + '"></button>' +
          '<button type="button" class="c-w" style="flex:' + (c.por_enviar || 0) + ' 1 0"' + dato('cartas', 'por_enviar', 'Carta y proforma por enviar') + ' aria-label="Por enviar: ' + num(c.por_enviar) + '"></button>' + (tot === 1 && !c.canales && !c.lider && !c.por_enviar ? '<i class="c-gris" style="flex:1 1 0"></i>' : '') + '</div>' +
        '<button type="button" class="cr-lin"' + dato('cartas', 'canales', 'Enviadas por Canales') + '><span><i class="c-ok pt"></i>Enviadas por Canales</span><b>' + num(c.canales) + '</b></button>' +
        '<button type="button" class="cr-lin"' + dato('cartas', 'lider', 'Enviadas por el líder') + '><span><i class="c-azul2 pt"></i>Enviadas por el líder</span><b>' + num(c.lider) + '</b></button>' +
        '<button type="button" class="cr-lin"' + dato('cartas', 'por_enviar', 'Carta y proforma por enviar') + '><span><i class="c-w pt"></i>Por enviar' + (c.esperan ? ' (' + num(c.esperan) + ' esperan más de 2 días)' : '') + '</span><b>' + num(c.por_enviar) + '</b></button>' +
        (d.solo_lectura ? '' : '<a class="enlace" href="comisiones.html?t=cartas">Ir a enviar</a>') + '</section>';
    }
    function pintar(){
      const d = st.datos;
      if(!d){ cont.innerHTML = cab(null) + '<div class="rs-sk"><span class="sk" style="height:64px;border-radius:20px"></span><div class="cr-nums">' + '<span class="sk" style="height:110px;border-radius:20px"></span>'.repeat(4) + '</div><span class="sk" style="height:320px;border-radius:20px;margin-top:14px"></span></div>'; return; }
      if(d.error){ cont.innerHTML = cab(null) + '<div class="vacio" role="alert"><b>No se pudo cargar el resumen</b><p>' + esc(d.error) + '</p><button type="button" class="btn btn-chico" data-cr-reintentar>Reintentar</button></div>'; return; }
      cont.innerHTML = cab(d) + lider(d) + numeros(d) + '<div class="cr-g2">' + ranking(d) + equipos(d) + '</div><div class="cr-g3">' + serie(d) + porInstalar(d) + monto(d) + '</div>';
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
        if(g === 'inst' && d.nums) o.comp = num(d.nums.inst_prev) + ' en ' + d.mes_anterior + (d.misma_fecha ? ' a la misma fecha' : '');
        if(g === 'por_instalar'){ o.tono = 'w'; o.accion = d.solo_lectura ? null : { t: 'Ver órdenes', fn: () => { if(window.PorInstalar){ C.cerrarHoja(); window.PorInstalar.abrir({ yo: st.yo }); } } }; }
        if(g === 'monto') o.tono = x === 'cumplen' ? 'ok' : x === 'pasan' ? 'w' : 'r';
        window.Resumen.detalle(o);
      }
    });
    cont.addEventListener('change', (ev) => { if(ev.target.matches('[data-cr-corte]')){ st.corte = ev.target.value; st.datos = null; cargar(); } });
    cargar();
    return { recargar: cargar };
  }
  window.ComResumen = { crear };
})();
