// Gerencia (lote 7, primera versión): resumen del negocio por mes o rango, líder y segmento.
// Todo sale de una sola fuente del servidor (privado.gerencia_hechos): los números, las barras, las listas al tocar y el Excel.
// Administrador y Gerencia ven además aliados y negativos. El líder ve solo lo suyo. Cada número o barra es un botón que abre la lista.
(function(){
  'use strict';
  const C = window.Comun;
  const { $, esc, ic, rpc, toast, cache, fecha, plural, abrirHoja, prepararHojas } = C;
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const SEG = ['PYME', 'Combinado', 'Dedicado corporativo', 'Dedicado ISP'];
  const ORDEN_EST = ['grandes_negocios', 'documentos_solicitados', 'documentos_pendientes', 'documentos_recibidos', 'documentos_en_revision', 'por_firmar', 'contrato_en_curso', 'contrato_firmado'];
  const COMPLETOS = ['documentos_en_revision', 'por_firmar', 'contrato_en_curso', 'contrato_firmado'];
  const CAM = { categoria: 'Cambio de categoría', titularidad: 'Cambio de titular', ambos: 'Categoría y titular', pyme_otra: 'PYME a otra categoría', sin_solicitud: 'Sin solicitud', error: 'Por error', revertido: 'Revertido' };
  const ALI = { solicitud: 'Solicitudes', aprobada: 'Aprobadas', instalada: 'Instaladas', referido: 'Referidos', pagada: 'Pagos hechos' };
  const NEG = { sin_permiso: 'Instalado sin autorización', exc_docs: 'Excepción pagada con documentos por subir', pyme_otra: 'PYME a otra categoría', cambio_mal: 'Cambio sin solicitud o por error',
    com_quitada: 'Comisión quitada', orden_15: 'Orden sin instalar más de 15 días', docs_30: 'Cliente sin documentos más de 30 días', poliza_vencida: 'Póliza VGT vencida' };
  const MAX_MESES = 6;
  let yo = null; let D = null; let F = { desde: '', hasta: '', lider: '', segmento: '' }; let pedido = 0; let pedidoL = 0; let L = null; let porDefecto = false; let filtrosDe = '';

  const mesCorto = (m) => { const p = String(m || '').split('-'); return p.length > 1 ? MESES[Number(p[1]) - 1] + ' ' + p[0].slice(2) : ''; };
  const mesLargo = (m) => C.mesAnio(m);
  const sumaMes = (m, k) => { const d = new Date(m + 'T12:00:00'); d.setMonth(d.getMonth() + k); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'; };
  const entre = (a, b) => { const x = a.split('-'); const y = b.split('-'); return (Number(y[0]) - Number(x[0])) * 12 + Number(y[1]) - Number(x[1]); };
  const est = (k) => (C.ESTATUS[k] && C.ESTATUS[k].t) || k;
  const G = () => (D && D.grupos) || [];
  const enRango = (g) => g.mes && g.mes >= F.desde && g.mes <= F.hasta;
  const suma = (lista) => lista.reduce((a, g) => a + g.c, 0);
  const de = (s, f) => G().filter((g) => g.s === s && (!f || f(g)));
  function agrupar(lista, clave){ const m = new Map(); lista.forEach((g) => { const k = clave(g); m.set(k, (m.get(k) || 0) + g.c); }); return m; }
  const pide = (o) => esc(JSON.stringify(o));
  const num = (n, o, txt) => '<button type="button" class="ge-n" data-gq="' + pide(o) + '" aria-label="' + esc(txt + ': ' + n + '. Ver la lista') + '">' + n + '</button>';

  // ---------- Filtros ----------
  function meses(){ const fin = (D && D.corte_actual) || F.hasta; const r = []; for(let i = 0; i < 12; i++) r.push(sumaMes(fin, -i)); return r; }
  function pintarFiltros(){
    const ms = meses(); const op = (v, t, sel) => '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + esc(t) + '</option>';
    const lid = (D && D.lideres) || [];
    $('filtrosG').innerHTML =
      '<div class="campo-s"><label for="gDesde">Desde</label><select id="gDesde">' + ms.map((m) => op(m, mesLargo(m), F.desde)).join('') + '</select></div>' +
      '<div class="campo-s"><label for="gHasta">Hasta</label><select id="gHasta">' + ms.map((m) => op(m, mesLargo(m), F.hasta)).join('') + '</select></div>' +
      (yo && yo.rol !== 'lider' ? '<div class="campo-s"><label for="gLider">Líder</label><select id="gLider">' + op('', 'Todos', F.lider) + lid.map((l) => op(l.id, l.nombre, F.lider)).join('') + '</select></div>' : '') +
      '<div class="campo-s"><label for="gSeg">Segmento</label><select id="gSeg">' + op('', 'Todos', F.segmento) + SEG.map((s) => op(s, s, F.segmento)).join('') + '</select></div>' +
      '<div class="error ge-err" id="eRango" role="alert"></div>';
    ['gDesde', 'gHasta', 'gLider', 'gSeg'].forEach((id) => { const s = $(id); if(s) s.classList.toggle('puesto', !!s.value && id !== 'gDesde' && id !== 'gHasta'); });
  }
  function leerFiltros(){
    const d = $('gDesde').value; const h = $('gHasta').value; $('eRango').textContent = '';
    if(d > h){ $('eRango').textContent = '"Desde" tiene que ser antes de "Hasta".'; return false; }
    if(entre(d, h) >= MAX_MESES){ $('eRango').textContent = 'Elige hasta ' + MAX_MESES + ' meses.'; return false; }
    F = { desde: d, hasta: h, lider: $('gLider') ? $('gLider').value : '', segmento: $('gSeg').value };
    guardarUrl(); return true;
  }
  function leerUrl(){
    const u = new URLSearchParams(location.search); const ok = (m) => /^\d{4}-\d{2}-01$/.test(m || '') ? m : '';
    F = { desde: ok(u.get('d')), hasta: ok(u.get('h')), lider: /^[0-9a-f-]{36}$/.test(u.get('l') || '') ? u.get('l') : '', segmento: SEG.indexOf(u.get('s')) >= 0 ? u.get('s') : '' };
  }
  function guardarUrl(){
    const u = new URLSearchParams(); if(F.desde) u.set('d', F.desde); if(F.hasta) u.set('h', F.hasta); if(F.lider) u.set('l', F.lider); if(F.segmento) u.set('s', F.segmento);
    try { history.replaceState(history.state, '', location.pathname + '?' + u.toString()); } catch (e) {}
  }
  const args = () => ({ p_desde: F.desde, p_hasta: F.hasta, p_lider: F.lider || null, p_segmento: F.segmento || null });

  async function cargar(){
    const mio = ++pedido; const clave = 'gerencia:' + (yo && yo.rol) + ':' + JSON.stringify(F);
    if(!D || D._clave !== clave){ const g = cache.leer(clave); if(g){ D = g; pintar(); } else if(!D) $('zonaG').innerHTML = esqueleto(); else $('zonaG').classList.add('ge-cargando'); }
    try {
      const r = await rpc('gerencia', args()); if(mio !== pedido) return;
      // Sin meses en la dirección se arranca en el corte en curso del servidor (del 18 al 17)
      if(porDefecto && r.corte_actual && r.corte_actual !== F.hasta){ porDefecto = false; F.desde = F.hasta = r.corte_actual; guardarUrl(); pintarFiltros(); return cargar(); }
      porDefecto = false; r._clave = clave; D = r; cache.guardar(clave, r); $('zonaG').classList.remove('ge-cargando');
      // Los filtros se redibujan solo si cambió la lista de líderes o el corte en curso (así no se borra lo que la persona está eligiendo)
      const fk = JSON.stringify([r.lideres, r.corte_actual]); if(fk !== filtrosDe){ filtrosDe = fk; pintarFiltros(); } pintar();
    } catch (e) {
      if(mio !== pedido) return; $('zonaG').classList.remove('ge-cargando');
      if(!D) $('zonaG').innerHTML = '<div class="vacio" role="alert"><b>No se pudo cargar el resumen</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" data-ge="reintentar">Reintentar</button></div>';
      toast(e.message, 'error');
    }
  }
  function esqueleto(){ return '<div class="ge-bento"><span class="sk ge-sk-g"></span><span class="sk ge-sk"></span><span class="sk ge-sk"></span><span class="sk ge-sk"></span><span class="sk ge-sk"></span></div><span class="sk" style="display:block;height:220px;border-radius:22px;margin-top:22px"></span>'; }

  // ---------- Barras: cada tramo es un botón ----------
  // filas: [{ t, sub, partes: [{ n, cls, g, txt }] }]
  function barras(filas, o){
    o = o || {}; const max = Math.max(1, ...filas.map((f) => f.partes.reduce((a, p) => a + p.n, 0)));
    if(!filas.length || max === 0) return '<p class="ge-vacio">' + esc(o.vacio || 'Sin datos en este rango.') + '</p>';
    return '<div class="ge-barras">' + filas.map((f) => { const tot = f.partes.reduce((a, p) => a + p.n, 0);
      return '<div class="ge-fila"><span class="ge-et">' + esc(f.t) + (f.sub ? '<small>' + esc(f.sub) + '</small>' : '') + '</span><span class="ge-pista">' +
        f.partes.filter((p) => p.n > 0).map((p) => '<button type="button" class="ge-p ' + (p.cls || '') + '" style="width:' + (100 * p.n / max).toFixed(2) + '%" data-gq="' + pide(p.g) + '" aria-label="' + esc(f.t + ', ' + (p.txt || '') + ': ' + p.n + '. Ver la lista') + '" title="' + esc((p.txt ? p.txt + ': ' : '') + p.n) + '"></button>').join('') +
        '</span><b class="ge-tot">' + tot + '</b></div>'; }).join('') + '</div>' + (o.leyenda ? '<div class="ge-ley">' + o.leyenda.map((l) => '<span><i class="' + l[0] + '"></i>' + esc(l[1]) + '</span>').join('') + '</div>' : '');
  }
  function seccion(id, titulo, sub, cuerpo){ return '<section class="ge-sec" id="' + id + '"><div class="ge-sec-cab"><h2>' + esc(titulo) + '</h2>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>' + cuerpo + '</section>'; }
  function tarjeta(t, cuerpo, o){ return '<div class="ge-t' + (o && o.ancha ? ' ancha' : '') + '"><h3>' + esc(t) + '</h3>' + cuerpo + '</div>'; }
  const rangoTxt = () => F.desde === F.hasta ? mesLargo(F.desde) : mesLargo(F.desde) + ' a ' + mesLargo(F.hasta);
  // Serie de 6 meses que termina en "Hasta" (el servidor manda desde 5 meses antes de "Desde")
  const mesesSerie = () => { const r = []; const tope = D.corte_actual && D.corte_actual < F.hasta ? D.corte_actual : F.hasta; for(let m = sumaMes(F.desde, -(MAX_MESES - entre(F.desde, F.hasta) - 1)); m <= tope; m = sumaMes(m, 1)) r.push(m); return r; };
  function porLider(lista, partes){
    const m = new Map(); lista.forEach((g) => { if(!g.l) return; const x = m.get(g.l) || { t: g.ln || 'Sin nombre', l: g.l, v: {} }; partes.forEach((p) => { if(p.f(g)) x.v[p.k] = (x.v[p.k] || 0) + g.c; }); m.set(g.l, x); });
    return [...m.values()].sort((a, b) => Object.values(b.v).reduce((x, y) => x + y, 0) - Object.values(a.v).reduce((x, y) => x + y, 0)).slice(0, 12);
  }

  // ---------- Pintar ----------
  function pintar(){
    if(!D) return;
    $('subG').textContent = rangoTxt() + (F.lider ? ' · ' + (((D.lideres || []).find((l) => l.id === F.lider) || {}).nombre || 'un líder') : '') + (F.segmento ? ' · ' + F.segmento : '') + '. Toca un número o una barra para ver la lista.';
    const serie = mesesSerie(); const certif = new Set(de('cert').map((g) => g.mes));
    // Portada
    const seg = agrupar(de('seg'), (g) => g.k); const segTot = suma(de('seg'));
    const ins = suma(de('ins', enRango)); const largo = entre(F.desde, F.hasta) + 1;
    const ant = suma(de('ins', (g) => g.mes && g.mes >= sumaMes(F.desde, -largo) && g.mes < F.desde));
    const comH = de('com', (g) => g.mes === F.hasta); const cumH = suma(comH.filter((g) => g.k === 'cumple'));
    const exp = de('exp'); const expTot = suma(exp); const comp = suma(exp.filter((g) => COMPLETOS.indexOf(g.k) >= 0));
    const neg = de('neg', (g) => !g.mes || enRango(g)); const negTot = suma(neg);
    const dif = ins - ant;
    const bento = '<div class="ge-bento">' +
      '<div class="ge-k grande"><span class="ge-kt">Clientes activos</span>' + num(segTot, { s: 'seg' }, 'Clientes activos') +
        '<div class="ge-mini">' + SEG.map((s) => '<button type="button" class="ge-chip" data-gq="' + pide({ s: 'seg', k: s }) + '"><span>' + esc(s) + '</span><b>' + (seg.get(s) || 0) + '</b></button>').join('') + '</div></div>' +
      '<div class="ge-k"><span class="ge-kt">Instalaciones</span>' + num(ins, { s: 'ins' }, 'Instalaciones') + '<small class="' + (dif > 0 ? 'sube' : dif < 0 ? 'baja' : '') + '">' + (ant || ins ? (dif > 0 ? '+' : '') + dif + ' contra ' + (largo === 1 ? 'el mes anterior' : 'los ' + largo + ' meses anteriores') : 'Sin instalaciones') + '</small></div>' +
      '<div class="ge-k"><span class="ge-kt">Comisiones de ' + esc(mesLargo(F.hasta)) + '</span><span class="ge-par">' + num(cumH, { s: 'com', k: 'cumple', mes: F.hasta }, 'Cumplen') + '<em>de ' + suma(comH) + '</em></span><small>' + (certif.has(F.hasta) ? 'Certificado, foto fija' : 'Corte abierto') + '</small></div>' +
      '<div class="ge-k"><span class="ge-kt">Expedientes completos</span><span class="ge-par"><button type="button" class="ge-n" data-gq="' + pide({ s: 'exp' }) + '" aria-label="Expedientes completos: ' + (expTot ? Math.round(100 * comp / expTot) : 0) + ' por ciento. Ver la lista">' + (expTot ? Math.round(100 * comp / expTot) : 0) + '%</button></span><small>' + comp + ' de ' + expTot + ' ya en Legal o contrato</small></div>' +
      (D.todo ? '<a class="ge-k neg" href="#secNeg"><span class="ge-kt">Negativos</span><b class="ge-n">' + negTot + '</b><small>Míralos abajo</small></a>' : '') +
      '</div>';
    // Comisiones
    const com = de('com');
    const comMes = barras(serie.map((m) => { const x = com.filter((g) => g.mes === m); const cu = suma(x.filter((g) => g.k === 'cumple')); const no = suma(x.filter((g) => g.k === 'no'));
      return { t: mesCorto(m), sub: certif.has(m) ? 'Certificado' : '', partes: [{ n: cu, cls: 'verde', g: { s: 'com', k: 'cumple', mes: m }, txt: 'cumplen' }, { n: no, cls: 'rojo', g: { s: 'com', k: 'no', mes: m }, txt: 'no cumplen' }] }; }),
      { leyenda: [['verde', 'Cumplen'], ['rojo', 'No cumplen']] });
    const comR = com.filter(enRango);
    const comLid = barras(porLider(comR, [{ k: 'cumple', f: (g) => g.k === 'cumple' }, { k: 'no', f: (g) => g.k === 'no' }]).map((x) => ({ t: x.t, partes: [{ n: x.v.cumple || 0, cls: 'verde', g: { s: 'com', k: 'cumple', lf: x.l }, txt: 'cumplen' }, { n: x.v.no || 0, cls: 'rojo', g: { s: 'com', k: 'no', lf: x.l }, txt: 'no cumplen' }] })));
    const causas = [...agrupar(comR, (g) => g.d || 'Otra causa')].sort((a, b) => b[1] - a[1]);
    const comCau = barras(causas.map(([k, n]) => ({ t: k, partes: [{ n, cls: k === 'Cumple' ? 'verde' : k === 'Por excepción' ? 'ambar' : 'rojo', g: { s: 'com', d: k }, txt: k }] })));
    // Instalaciones
    const insG = de('ins'); const segIns = SEG.concat(['Sin cliente']); const tonos = ['t1', 't2', 't3', 't4', 't5'];
    const insMes = barras(serie.map((m) => ({ t: mesCorto(m), partes: segIns.map((s, i) => ({ n: suma(insG.filter((g) => g.mes === m && g.k === s)), cls: tonos[i], g: { s: 'ins', k: s, mes: m }, txt: s })) })),
      { leyenda: segIns.map((s, i) => [tonos[i], s]) });
    const insR = insG.filter(enRango);
    const insLid = barras(porLider(insR, [{ k: 'n', f: () => true }]).map((x) => ({ t: x.t, partes: [{ n: x.v.n || 0, cls: 't1', g: { s: 'ins', lf: x.l }, txt: 'instalaciones' }] })));
    const conDias = insR.filter((g) => g.n !== null && g.n !== undefined); const pesoD = suma(conDias);
    const dias = pesoD ? Math.round(conDias.reduce((a, g) => a + g.n * g.c, 0) / pesoD) : null;
    const insAli = D.todo ? barras([...agrupar(insR.filter((g) => g.d), (g) => g.d)].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => ({ t: k, partes: [{ n, cls: 't2', g: { s: 'ins', d: k }, txt: 'instalaciones' }] })), { vacio: 'Ningún aliado instaló en este rango.' }) : '';
    // Expedientes y Legal
    const estK = [...agrupar(exp, (g) => g.k)]; estK.sort((a, b) => (ORDEN_EST.indexOf(a[0]) + 1 || 99) - (ORDEN_EST.indexOf(b[0]) + 1 || 99));
    const embudo = barras(estK.map(([k, n]) => ({ t: est(k), partes: [{ n, cls: COMPLETOS.indexOf(k) >= 0 ? 'verde' : 't1', g: { s: 'exp', k }, txt: est(k) }] })));
    const leg = de('legal', enRango); const pesoL = suma(leg.filter((g) => g.n !== null)); const diasL = pesoL ? Math.round(leg.filter((g) => g.n !== null).reduce((a, g) => a + g.n * g.c, 0) / pesoL) : null;
    const dev = suma(de('dev'));
    const fal = [...agrupar(de('fal'), (g) => g.k)].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const falB = barras(fal.map(([k, n]) => ({ t: C.capital ? C.capital(k) : k, partes: [{ n, cls: 'ambar', g: { s: 'fal', k }, txt: 'clientes' }] })), { vacio: 'No falta nada en los expedientes en curso.' });
    // Cambios de plan
    const cam = de('cam'); const camR = cam.filter(enRango);
    const camTipos = barras(Object.keys(CAM).map((k) => ({ t: CAM[k], partes: [{ n: suma(camR.filter((g) => g.k === k)), cls: ['pyme_otra', 'error', 'revertido', 'sin_solicitud'].indexOf(k) >= 0 ? 'rojo' : 't1', g: { s: 'cam', k }, txt: CAM[k] }] })).filter((f) => f.partes[0].n > 0), { vacio: 'Sin cambios de plan en este rango.' });
    const camMes = barras(serie.map((m) => ({ t: mesCorto(m), partes: [{ n: suma(cam.filter((g) => g.mes === m && g.k !== 'pyme_otra')), cls: 't1', g: { s: 'cam', mes: m }, txt: 'cambios' }] })));
    // Aliados
    const ali = D.todo ? de('ali', enRango) : [];
    const aliK = '<div class="ge-cifras">' + Object.keys(ALI).map((k) => '<div class="ge-c"><span>' + esc(ALI[k]) + '</span>' + num(suma(ali.filter((g) => g.k === k)), { s: 'ali', k }, ALI[k]) + '</div>').join('') + '</div>';
    const aliPor = barras([...agrupar(ali.filter((g) => g.k === 'instalada'), (g) => g.d || 'Sin aliado')].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => ({ t: k, partes: [{ n, cls: 't2', g: { s: 'ali', k: 'instalada', d: k }, txt: 'instaladas' }] })), { vacio: 'Ningún aliado instaló en este rango.' });
    // Dedicados
    const ded = de('ded'); const dedEst = ded.filter((g) => g.k !== 'poliza_por_vencer'); const pol = suma(ded.filter((g) => g.k === 'poliza_por_vencer'));
    const dedB = barras([...agrupar(dedEst, (g) => g.k)].sort((a, b) => (ORDEN_EST.indexOf(a[0]) + 1 || 99) - (ORDEN_EST.indexOf(b[0]) + 1 || 99)).map(([k, n]) => ({ t: est(k), partes: [{ n, cls: COMPLETOS.indexOf(k) >= 0 ? 'verde' : 't1', g: { s: 'ded', k }, txt: est(k) }] })), { vacio: 'Sin dedicados activos.' });
    // Negativos
    const negB = '<div class="ge-negs">' + Object.keys(NEG).map((k) => { const n = suma(neg.filter((g) => g.k === k));
      return '<button type="button" class="ge-ng' + (n ? ' hay' : '') + '" data-gq="' + pide({ s: 'neg', k }) + '"><b>' + n + '</b><span>' + esc(NEG[k]) + '</span></button>'; }).join('') + '</div>';

    $('zonaG').innerHTML = bento +
      seccion('secCom', 'Comisiones', 'Por corte. Los meses certificados salen de su foto fija.',
        '<div class="ge-dos">' + tarjeta('Cumplen y no cumplen, por corte', comMes, { ancha: true }) + tarjeta('Por líder, ' + rangoTxt(), comLid) + tarjeta('Causas, ' + rangoTxt(), comCau) + '</div>') +
      seccion('secIns', 'Instalaciones', 'Sin reemplazos ni cambios de categoría.',
        '<div class="ge-dos">' + tarjeta('Por mes y segmento', insMes, { ancha: true }) + tarjeta('Por líder, ' + rangoTxt(), insLid) +
        tarjeta('De la orden a la instalación', '<p class="ge-gran">' + (dias === null ? 'Sin datos' : plural(dias, 'día', 'días')) + '</p><p class="ge-nota">Promedio desde que se crea la orden en Odoo.</p>' + (D.todo ? '<h3 class="ge-h3b">Por aliado</h3>' + insAli : '')) + '</div>') +
      seccion('secExp', 'Expedientes y Legal', 'Foto de hoy, salvo los días a Legal (del rango).',
        '<div class="ge-dos">' + tarjeta('Por estatus', embudo, { ancha: true }) +
        tarjeta('Legal', '<div class="ge-cifras dos"><div class="ge-c"><span>Días hasta Legal listo</span><b class="ge-n plano">' + (diasL === null ? '-' : diasL) + '</b></div><div class="ge-c"><span>Listos en el rango</span>' + num(suma(leg), { s: 'legal' }, 'Listos en el rango') + '</div><div class="ge-c"><span>Documentos devueltos</span>' + num(dev, { s: 'dev' }, 'Documentos devueltos') + '</div></div>') +
        tarjeta('Lo que más falta', falB) + '</div>') +
      seccion('secCam', 'Cambios de plan', rangoTxt() + '.', '<div class="ge-dos">' + tarjeta('Por tipo', camTipos) + tarjeta('Mes contra mes', camMes) + '</div>') +
      (D.todo ? seccion('secAli', 'Aliados', rangoTxt() + '.', '<div class="ge-dos">' + tarjeta('En números', aliK, { ancha: true }) + tarjeta('Instaladas por aliado', aliPor) + '</div>') : '') +
      seccion('secDed', 'Dedicados', 'Foto de hoy.', '<div class="ge-dos">' + tarjeta('Contratos por estatus', dedB) + tarjeta('Pólizas', '<div class="ge-cifras dos"><div class="ge-c"><span>Vencen en 30 días</span>' + num(pol, { s: 'ded', k: 'poliza_por_vencer' }, 'Pólizas por vencer') + '</div></div>') + '</div>') +
      (D.todo ? seccion('secNeg', 'Negativos', 'Siempre a la vista. Los de hoy y los del rango.', negB) : '');
  }

  // ---------- Lista al tocar ----------
  function hojaLista(){
    let h = $('hojaG');
    if(!h){ h = document.createElement('section'); h.id = 'hojaG'; h.className = 'hoja'; h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', 'tG'); h.setAttribute('aria-hidden', 'true'); document.body.appendChild(h); prepararHojas(); }
    return h;
  }
  function titulo(o){
    const k = o.k; const s = o.s;
    const base = s === 'seg' ? 'Clientes activos' + (k ? ': ' + k : '') : s === 'ins' ? 'Instalaciones' + (k ? ': ' + k : '') + (o.d ? ' de ' + o.d : '') : s === 'com' ? (o.d ? 'Comisiones: ' + o.d : k === 'cumple' ? 'Comisiones que cumplen' : k === 'no' ? 'Comisiones que no cumplen' : 'Comisiones')
      : s === 'exp' ? (k ? est(k) : 'Expedientes') : s === 'legal' ? 'Legal listo' : s === 'dev' ? 'Documentos devueltos' : s === 'fal' ? 'Les falta: ' + k : s === 'cam' ? (k ? CAM[k] : 'Cambios de plan')
      : s === 'ali' ? (ALI[k] || 'Aliados') + (o.d ? ' de ' + o.d : '') : s === 'ded' ? (k === 'poliza_por_vencer' ? 'Pólizas que vencen en 30 días' : 'Dedicados: ' + est(k)) : s === 'neg' ? NEG[k] : '';
    return base;
  }
  async function abrirLista(o){
    const mio = ++pedidoL; L = { o, filas: null, ver: 50 };
    hojaLista().innerHTML = '<div class="asa" aria-hidden="true"></div><div class="cab"><div><h2 id="tG">' + esc(titulo(o)) + '</h2><p class="sub-hoja" id="subLista">' + esc(o.mes ? mesLargo(o.mes) : o.s === 'seg' || o.s === 'exp' || o.s === 'dev' || o.s === 'fal' || o.s === 'ded' ? 'Foto de hoy' : rangoTxt()) + '</p></div><button type="button" class="cerrar" data-cierra="1" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      '<div id="cuerpoLista">' + C.esqueleto(5) + '</div>';
    abrirHoja('hojaG');
    try {
      const r = await rpc('gerencia_lista', Object.assign(args(), { p_s: o.s, p_k: o.k || null, p_mes: o.mes || null, p_detalle: o.d || null, p_lider_fila: o.lf || null }));
      if(mio !== pedidoL || !L) return; L.filas = r || []; pintarLista();
    } catch (e) {
      if(mio !== pedidoL) return;
      $('cuerpoLista').innerHTML = '<div class="vacio" role="alert"><b>No se pudo cargar la lista</b><p>' + esc(e.message) + '</p><button type="button" class="btn btn-chico" data-ge="relista">Reintentar</button></div>';
    }
  }
  function pintarLista(){
    const f = L.filas; const z = $('cuerpoLista'); if(!z) return;
    $('subLista').textContent = plural(f.length, 'registro', 'registros') + (f.length >= 1000 ? ' (los primeros 1000)' : '') + ' · ' + (L.o.mes ? mesLargo(L.o.mes) : L.o.s === 'seg' || L.o.s === 'exp' || L.o.s === 'dev' || L.o.s === 'fal' || L.o.s === 'ded' ? 'foto de hoy' : rangoTxt());
    if(!f.length){ z.innerHTML = '<div class="vacio"><b>No hay nada aquí</b><p>Cambia el rango o los filtros arriba.</p></div>'; return; }
    const extra = (x) => [x.lider, L.o.s === 'exp' || L.o.s === 'ded' ? est(x.k) : x.detalle, x.mes ? mesCorto(x.mes) : '', x.n !== null && x.n !== undefined && (L.o.s === 'neg' || L.o.s === 'ded') ? plural(Math.round(x.n), 'día', 'días') : ''].filter(Boolean).join(' · ');
    z.innerHTML = '<div class="ge-lista">' + f.slice(0, L.ver).map((x, i) => (x.abre ? '<button type="button" class="ge-li" data-cli="' + i + '">' : '<div class="ge-li">') +
      '<span><b>' + esc(x.nombre || 'Sin nombre') + '</b><small>' + esc(extra(x)) + '</small></span>' + (x.abre ? ic('derecha', 'ch') + '</button>' : '</div>')).join('') + '</div>' +
      (f.length > L.ver ? '<div class="acciones"><button type="button" class="btn btn-2 btn-ancho" data-ge="mas">Ver ' + Math.min(50, f.length - L.ver) + ' más</button></div>' : '');
  }

  // ---------- Excel ----------
  function excel(){
    if(!D){ toast('Espera a que cargue el resumen', 'error'); return; }
    const sec = { seg: 'Clientes activos', ins: 'Instalaciones', com: 'Comisiones', cert: 'Corte certificado', exp: 'Expedientes', legal: 'Legal listo', dev: 'Devueltos', fal: 'Falta', cam: 'Cambios de plan', ali: 'Aliados', ded: 'Dedicados', neg: 'Negativos' };
    const etq = (g) => g.s === 'exp' || g.s === 'ded' ? est(g.k) : g.s === 'cam' ? CAM[g.k] || g.k : g.s === 'ali' ? ALI[g.k] || g.k : g.s === 'neg' ? NEG[g.k] || g.k : g.s === 'com' ? (g.k === 'cumple' ? 'Cumple' : 'No cumple') : g.k;
    const filas = G().filter((g) => g.s !== 'cert').map((g) => [sec[g.s] || g.s, etq(g), g.mes ? mesLargo(g.mes) : 'Hoy', g.ln || '', g.d || '', g.c, g.n === null || g.n === undefined ? '' : Number(g.n)]);
    const blob = window.Archivos.xlsx([{ nombre: 'Gerencia', columnas: [{ t: 'Sección', ancho: 18 }, { t: 'Qué', ancho: 34 }, { t: 'Mes', ancho: 18 }, { t: 'Líder', ancho: 26 }, { t: 'Detalle', ancho: 26 }, { t: 'Cantidad', ancho: 10 }, { t: 'Días promedio', ancho: 14 }], filas }]);
    window.Archivos.descargar(blob, 'Gerencia_' + F.desde.slice(0, 7) + (F.hasta !== F.desde ? '_a_' + F.hasta.slice(0, 7) : '') + '.xlsx');
  }

  document.addEventListener('change', (ev) => { if(ev.target.closest('#filtrosG select')){ porDefecto = false; if(leerFiltros()) cargar(); } });
  document.addEventListener('click', (ev) => {
    const t = ev.target; let b;
    if((b = t.closest('[data-gq]'))){ let o = null; try { o = JSON.parse(b.dataset.gq); } catch (e) { o = null; } if(o) abrirLista(o); return; }
    if(t.closest('[data-ge="reintentar"]')){ cargar(); return; }
    if(t.closest('[data-ge="relista"]')){ if(L) abrirLista(L.o); return; }
    if(t.closest('[data-ge="mas"]')){ if(L){ L.ver += 50; pintarLista(); } return; }
    if(t.closest('#excelG')){ excel(); return; }
    if((b = t.closest('#hojaG [data-cli]'))){ const x = L && L.filas && L.filas[Number(b.dataset.cli)]; if(x && x.abre && x.cliente_id) window.Ficha.abrir(x.cliente_id, { yo }); }
  });

  window.Armazon.arrancar(['admin', 'analista', 'lider', 'abogado', 'gerencia'], { activo: 'gerencia' }, (p) => {
    yo = p; if(window.Ficha && p.rol !== 'gerencia') window.Ficha.montar();
    leerUrl(); const hoy = C.hoyClave ? C.hoyClave() : new Date().toISOString().slice(0, 10);
    const mesHoy = hoy.slice(0, 7) + '-01';
    if(!F.hasta){ F.hasta = mesHoy; porDefecto = true; } if(!F.desde || F.desde > F.hasta) F.desde = F.hasta;
    pintarFiltros(); cargar();
  });
})();
