// Maqueta 16/11: Migraciones rediseñado (tarjetas, por líder, sin registrar del reporte). Montada sobre la app del simulador. Datos inventados.
const { chromium, H, TEL, PC, contexto, pin } = require('../../../pruebas/simulador');
const OUT = __dirname + '/img/';
const CSS = `
#filtros,#ayuda,#lista{display:none !important}
.mg{display:flex;flex-direction:column;gap:16px;margin-top:6px}
.mg-kpis{display:grid;grid-template-columns:1.35fr 1fr 1fr 1fr;gap:10px}
.mg-k{border:1px solid var(--line);border-radius:14px;padding:12px 14px;background:#fff;text-align:left}
.mg-k small{display:block;font-size:12px;color:var(--text2);font-weight:600}
.mg-k b{display:block;font-size:24px;font-weight:800;line-height:1.15;margin:2px 0}
.mg-k span{font-size:12px;color:var(--text2)}
.mg-k.on{background:#E8EDFB;border-color:#C9D5F6}
.mg-k.am b{color:#8A5A00}
.mg-av{display:flex;align-items:center;gap:10px;background:#FDF3DC;border-radius:12px;padding:10px 14px;font-size:13px;color:#5C4300}
.mg-av b{font-weight:700}.mg-av a{margin-left:auto;font-weight:700;color:#1A3A9E;white-space:nowrap}
.mg-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.mg-ch{height:36px;padding:0 14px;border-radius:99px;background:#F3F4F6;font-size:13px;font-weight:600;color:var(--text2);display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.mg-ch em{font-style:normal;opacity:.75}.mg-ch.on{background:#1A3A9E;color:#fff}
.mg-seg{margin-left:auto;display:inline-flex;background:#F3F4F6;border-radius:99px;padding:3px}
.mg-seg span{height:32px;padding:0 14px;border-radius:99px;display:inline-flex;align-items:center;font-size:13px;font-weight:600;color:var(--text2)}
.mg-seg span.on{background:#fff;color:var(--text);box-shadow:0 1px 3px rgba(17,19,21,.12)}
.mg-g{border:1px solid var(--line);border-radius:16px;background:#fff;overflow:hidden}
.mg-gh{display:flex;align-items:center;gap:10px;padding:12px 16px}
.mg-gh .ini{width:28px;height:28px;border-radius:50%;background:#EEF0F3;display:grid;place-items:center;font-size:11px;font-weight:700}
.mg-gh b{font-size:15px}.mg-gh .der{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.mg-env{height:28px;padding:0 10px;border-radius:99px;border:1px solid #BFE3CF;color:#0F6642;font-size:12px;font-weight:700;display:inline-flex;align-items:center}
.mg-p{height:24px;padding:0 9px;border-radius:99px;font-size:11.5px;font-weight:700;display:inline-flex;align-items:center;white-space:nowrap}
.mg-p.am{background:#FDF3DC;color:#8A5A00}.mg-p.az{background:#E8EDFB;color:#1A3A9E}.mg-p.ve{background:#E3F4EA;color:#0F6642}.mg-p.ro{background:#FBE5E3;color:#A32116}.mg-p.gr{background:#F0F1F3;color:#555C66}
.mg-sub{background:#F7F8FA;font-size:12px;font-weight:700;color:var(--text2);padding:7px 16px;border-top:1px solid var(--line)}
.mg-sub.am{background:#FDF8EC;color:#8A5A00}
.mg-r{display:grid;grid-template-columns:74px 1.5fr 1.1fr 1.25fr 118px;gap:14px;align-items:center;padding:12px 16px;border-top:1px solid var(--line)}
.mg-r .f b{display:block;font-size:13px}.mg-r .f small,.mg-r .c small{font-size:11.5px;color:var(--text2);display:block}
.mg-r .c b{font-size:13.5px;display:block}
.mg-r .k{font-size:12.5px;font-weight:600}.mg-r .k i{font-style:normal;color:var(--text2);font-weight:500}
.mg-r .e small{display:block;font-size:11.5px;color:var(--text2);margin-top:3px}
.mg-btn{height:34px;padding:0 14px;border-radius:99px;font-size:12.5px;font-weight:700;display:inline-flex;align-items:center;white-space:nowrap}
.mg-r>div:last-child{text-align:right}
.mg-nuevo{height:40px;padding:0 16px;border-radius:99px;background:#1A3A9E;color:#fff;font-weight:700;font-size:13.5px;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.mg-top{display:flex;gap:10px;align-items:stretch}.mg-top .mg-av{flex:1}
.mg-btn.p{background:#1A3A9E;color:#fff}.mg-btn.s{background:#F3F4F6;color:var(--text)}
@media (max-width:700px){
 .mg-kpis{grid-template-columns:1fr 1fr}.mg-seg{margin-left:0}
 .mg-bar{flex-wrap:nowrap;overflow-x:auto;margin:0 -16px;padding:0 16px}
 .mg-top{flex-direction:column}.mg-nuevo{justify-content:center;height:46px}
 .mg-r>div:last-child{text-align:left}
 .mg-r{grid-template-columns:1fr auto;gap:6px 10px;padding:14px 16px}
 .mg-r .f{grid-column:1/-1;display:flex;gap:8px;align-items:baseline}.mg-r .c{grid-column:1/-1}.mg-r .k{grid-column:1/-1}
 .mg-gh{flex-wrap:wrap}.mg-gh .der{margin-left:38px;justify-content:flex-start;width:100%}
 .mg-av{flex-wrap:wrap}.mg-av a{margin-left:0}
}`;
const fila = (f, hace, cli, doc, de, a, chip, cls, sub, btn, bc) => `<div class="mg-r"><div class="f"><b>${f}</b><small>${hace}</small></div><div class="c"><b>${cli}</b><small>${doc}</small></div><div class="k">${de} <i>→</i> ${a}</div><div class="e"><span class="mg-p ${cls}">${chip}</span><small>${sub}</small></div><div>${btn ? `<span class="mg-btn ${bc}">${btn}</span>` : ''}</div></div>`;
const grupo = (ini, nom, chips, cuerpo, env) => `<section class="mg-g"><div class="mg-gh"><span class="ini">${ini}</span><b>${nom}</b>${env ? '<span class="mg-env">Enviar pendientes</span>' : ''}<span class="der">${chips}</span></div>${cuerpo}</section>`;
function html(lider){
  const k = lider
    ? `<div class="mg-k on am"><small>Te falta registrar</small><b>2</b><span>ya se hicieron, faltan documentos</span></div><div class="mg-k"><small>En revisión</small><b>1</b><span>las ve el administrador</span></div><div class="mg-k"><small>En curso</small><b>1</b><span>por emitir o confirmar</span></div><div class="mg-k"><small>Confirmadas del corte</small><b>2</b><span>1 comisiona</span></div>`
    : `<div class="mg-k on"><small>Esperan tu decisión</small><b>4</b><span>3 por revisar · 1 comisión por decidir</span></div><div class="mg-k am"><small>Sin registrar</small><b>7</b><span>las encontró el reporte</span></div><div class="mg-k"><small>En curso</small><b>3</b><span>por emitir o confirmar</span></div><div class="mg-k"><small>Confirmadas del corte</small><b>9</b><span>5 comisionan</span></div>`;
  const aviso = lider
    ? `<div class="mg-av"><span><b>2 migraciones tuyas ya se hicieron sin registro.</b> Regístralas para que entren a tu comisión.</span></div>`
    : `<div class="mg-av"><span><b>Reporte de cambios de categoría: hasta el 16/11.</b> 7 cambios a PYME sin registrar y 1 que pasó a residencial.</span><a>Subir reporte</a></div>`;
  const chips = lider
    ? `<span class="mg-ch on">Todas <em>6</em></span><span class="mg-ch">Te falta registrar <em>2</em></span><span class="mg-ch">En revisión <em>1</em></span><span class="mg-ch">En curso <em>1</em></span><span class="mg-ch">Confirmadas <em>2</em></span>`
    : `<span class="mg-ch on">Esperan tu decisión <em>4</em></span><span class="mg-ch">Sin registrar <em>7</em></span><span class="mg-ch">En curso <em>3</em></span><span class="mg-ch">Confirmadas <em>9</em></span><span class="mg-ch">Pasaron a residencial <em>1</em></span><span class="mg-ch">Todas <em>24</em></span><span class="mg-seg"><span class="on">Por líder</span><span>Por fecha</span></span>`;
  const sinReg = '<div class="mg-sub am">Ya se hicieron y nadie las registró · 2</div>' +
    fila('31/10', 'hace 16 días', 'Comercial de Prueba 7, C.A.', 'J-591000077 · 824-9910007', 'PROMO-1GB', 'PYME-1GB', 'Sin registrar', 'am', 'Faltan documentos · reporte del 31/10', lider ? 'Registrar' : 'Recordar', lider ? 'p' : 's') +
    fila('05/11', 'hace 11 días', 'Kiosco La Parada', 'V-99100022 · 824-99100002', '1 GB', 'PYME-1GB', 'Sin registrar', 'am', 'Comentario: solicitado por Lucía', lider ? 'Registrar' : 'Recordar', lider ? 'p' : 's');
  const reg = '<div class="mg-sub">Registradas · ' + (lider ? 4 : 2) + '</div>' +
    fila('09/11', 'hace 7 días', 'Vidrios El Faro, C.A.', 'J-591000011 · 824-99100001', 'PROMO-1GB', 'PYME-1GB', 'Documentos por revisar', 'az', 'Registrada por Lucía el 09/11', lider ? '' : 'Revisar', 'p') +
    fila('02/11', 'hace 14 días', 'Tornillos El Yunque, C.A.', 'J-591000044 · 824-99100004', '1 GB', 'PYME-1GB', lider ? 'Confirmada · comisiona' : 'Comisión por decidir', lider ? 've' : 'az', 'Confirmada en el TAD del 04/11', lider ? '' : 'Decidir', 'p') +
    (lider ? fila('12/11', 'hace 4 días', 'Autolavado El Chorro, C.A.', 'J-591000066 · 824-99100006', 'PROMO-1GB', 'PYME-1GB', 'Por emitir', 'gr', 'Aprobada el 13/11 · la emite el analista', '', '') +
      fila('28/10', 'hace 19 días', 'Inversiones Bahía Azul, C.A.', 'J-591000033 · 824-99100003', '1 GB', 'PYME-1GB', 'Confirmada · no comisiona', 'gr', 'Motivo: ya era cliente PYME', '', '') : '');
  const g1 = grupo('LF', 'Lucía Ferrer', lider ? '' : '<span class="mg-p am">2 sin registrar</span><span class="mg-p az">2 esperan tu decisión</span>', sinReg + reg, !lider);
  const g2 = lider ? '' : grupo('RP', 'Rosa Paredes', '<span class="mg-p am">3 sin registrar</span><span class="mg-p az">1 espera tu decisión</span>', '<div class="mg-sub am">Ya se hicieron y nadie las registró · 3</div>' +
      fila('26/10', 'hace 21 días', 'Comercial de Prueba 11, C.A.', 'J-591000111 · 005-9910011', '1 GB', 'PYME-1GB', 'Sin registrar', 'am', 'Faltan documentos · reporte del 26/10', 'Recordar', 's'), true) +
    grupo('?', 'Por asignar', '<span class="mg-p am">2 sin registrar</span><span class="mg-p ro">1 pasó a residencial</span>',
      fila('10/11', 'hace 6 días', 'Bodega Revisable, C.A.', 'J-00000003-2 · 021-9910030', 'PROMO-1GB', 'PYME-1GB', 'Sin registrar', 'am', 'Cliente sin líder', 'Asignar líder', 'p') +
      fila('31/10', 'hace 16 días', 'Licorería Prueba', 'V-9910040 · 824-9910040', 'PYME-1GB', '1 GB', 'Pasó a residencial', 'ro', 'Era PYME desde agosto', 'Ver cliente', 's'), false);
  return `<div class="mg"><div class="mg-top">${aviso}<span class="mg-nuevo">+ Nuevo cambio</span></div><div class="mg-kpis">${k}</div><div class="mg-bar">${chips}</div>${g1}${g2}</div>`;
}
(async () => { const nav = await chromium.launch();
  for(const [quien, u, c] of [['admin', 'marcos', '482913'], ['lider', 'lucia', '739105']]) for(const [d, dev] of [['pc', PC], ['tel', TEL]]){
    const { ctx } = await contexto(nav, dev); const p = await ctx.newPage(); await p.goto(H + 'index.html'); await p.waitForSelector('#pasoEquipo:not(.hidden)');
    await p.click('[data-equipo="ventas"]'); await p.fill('#usuario', u); await p.click('#seguir'); await pin(p, c, d === 'pc'); await p.waitForURL(/inicio/);
    await p.goto(H + 'migraciones.html'); await p.waitForTimeout(1500);
    await p.addStyleTag({ content: CSS }); await p.evaluate((h) => { const x = document.createElement('div'); x.innerHTML = h; document.getElementById('lista').after(x.firstChild); const a = document.querySelector('.ayuda-filtro ~ p, .aviso-tad'); }, html(quien === 'lider'));
    await p.evaluate(() => { document.querySelectorAll('main.pagina > p, main.pagina > .aviso').forEach((e) => { if(/Falta subir el TAD/.test(e.textContent)) e.style.display = 'none'; }); });
    await p.screenshot({ path: OUT + 'migraciones-' + quien + '-' + d + '.png', fullPage: d === 'tel' }); await ctx.close(); }
  await nav.close(); console.log('ok'); })();
