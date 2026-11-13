// Maqueta 13/11: filtros de Comisiones en dos renglones y "Enviar pendientes" al lado del nombre del líder (también la analista).
// Montada sobre la app real del simulador. Datos inventados. Uso: node claude/maquetas/obs-13nov/montar-comisiones.js /ruta/salida/
const { chromium, H, PC, TEL, contexto, entrar } = require('../../../pruebas/simulador');
const OUT = process.argv[2] || './img/';
const CSS = `
.cx-panel{border:0 !important;padding:0 !important;background:none !important;box-shadow:none !important;margin:8px 0 14px !important;display:flex;flex-direction:column;gap:12px}
.zz-t1{display:flex;align-items:center;gap:8px}
.zz-t1 .cx-buscar{flex:1;min-width:0;margin:0 !important}
.zz-dd{height:44px;padding:0 14px;border-radius:99px;border:1.5px solid var(--line);background:#fff;font-weight:600;font-size:13.5px;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;color:var(--text)}
.zz-dd b{font-weight:700}.zz-dd.on{border-color:var(--text)}
.zz-dd .i{width:14px;height:14px}
.zz-seg{display:inline-flex;background:var(--surface-2,#F3F4F6);border-radius:99px;padding:4px;height:44px;align-items:center}
.zz-seg span{height:36px;padding:0 14px;border-radius:99px;display:inline-flex;align-items:center;font-size:13.5px;font-weight:600;color:var(--text2)}
.zz-seg span.on{background:#fff;color:var(--text);box-shadow:0 1px 3px rgba(17,19,21,.12)}
.zz-ic{width:44px;height:44px;border-radius:50%;border:1.5px solid var(--line);background:#fff;display:grid;place-items:center;font-weight:800;font-size:16px;letter-spacing:1px}
.zz-t2{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.zz-t2 .zz-mos{margin-left:auto;font-size:13px;color:var(--text2)}
.zz-pop{position:absolute;z-index:30;background:#fff;border-radius:16px;box-shadow:0 16px 40px rgba(17,19,21,.16);border:1px solid var(--line);padding:8px;width:300px}
.zz-pop .zz-op{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;font-size:13.5px;font-weight:600}
.zz-pop .zz-op.on{background:#F3F4F6}.zz-pop .zz-op em{margin-left:auto;font-style:normal;color:var(--text2);font-size:12.5px}
.zz-pop hr{border:0;border-top:1px solid var(--line);margin:6px 4px}
.zz-pop .lbl{font-size:11.5px;font-weight:700;color:var(--text3,#69717C);text-transform:uppercase;letter-spacing:.06em;padding:8px 12px 2px}
.zz-pop .ops{display:flex;flex-wrap:wrap;gap:6px;padding:4px 8px 8px}.zz-pop .ops span{height:34px;padding:0 12px;border-radius:99px;border:1.5px solid var(--line);display:inline-flex;align-items:center;font-size:13px;font-weight:600}.zz-pop .ops span.on{background:var(--text);border-color:var(--text);color:#fff}
.zz-pop .dos{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 8px 8px}.zz-pop .dos label{font-size:12.5px;font-weight:700;display:block;margin-bottom:4px}.zz-pop .dos .campo{height:40px;width:100%}
.pend-barra{display:none !important}
.zz-cab{display:flex;align-items:center;gap:12px}
.zz-cab{position:relative}.zz-cab .grupo-cab{flex:1;min-width:0}.zz-cab .grupo-cab .tx{flex:0 1 auto !important}.zz-cab .grupo-cab .stats{margin-left:auto}
.zz-op{padding:8px 12px !important;min-height:0 !important}
.zz-env{height:32px;padding:0 12px;border-radius:99px;border:1.5px solid #BFE3CC;background:#fff;color:#0F6642;font-size:12.5px;font-weight:700;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;flex:none}
.zz-env .i{width:14px;height:14px}
.zz-env small{font-weight:500;color:var(--text2);font-size:12px}
`;
const CH = '<svg class="i" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';
(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const nav = await chromium.launch();
  const tomar = async (p, n, full) => { await p.waitForTimeout(400); await p.screenshot({ path: OUT + n + '.png', fullPage: !!full }); console.log('ok', n); };
  const armar = async (p, o) => p.evaluate((o) => {
    const pan = document.querySelector('.cx-panel'); const bus = pan.querySelector('.cx-buscar'); const fil = document.querySelector('#filtros'); const acc = document.querySelector('#acciones');
    // filtros de estado tal cual (Todas, Comisionan, Les falta algo, Carta por enviar, Más filtros)
    const t2 = document.createElement('div'); t2.className = 'zz-t2'; t2.appendChild(fil); t2.insertAdjacentHTML('beforeend', o.mos ? '<span class="zz-mos">' + o.mos + '</span>' : '');
    const t1 = document.createElement('div'); t1.className = 'zz-t1'; t1.style.position = 'relative'; t1.appendChild(bus);
    t1.insertAdjacentHTML('beforeend', '<button class="zz-dd' + (o.pop === 'eq' ? ' on' : '') + '">Equipo: <b>' + (o.eq || 'Todos') + '</b>' + o.CH + '</button>' + (o.persona ? '<button class="zz-dd on">Persona: <b>' + o.persona + '</b>' + o.CH + '</button>' : '') +
      '<button class="zz-dd' + (o.pop === 'fe' ? ' on' : '') + '">Fechas: <b>' + (o.fe || 'todo el corte') + '</b>' + o.CH + '</button>' +
      '<span class="zz-seg"><span class="on">Por dueño</span><span>Por fecha</span></span><button class="zz-ic" aria-label="Más acciones">···</button>' +
      (o.pop === 'eq' ? '<div class="zz-pop" style="top:52px;right:330px"><div class="zz-op op on">Todos<em>16</em></div><div class="zz-op op">Ventas corporativas<em>16</em></div><div class="zz-op op">Canales de atención<em>0</em></div><div class="zz-op op">Aliado comercial<em>0</em></div><hr><div class="lbl">Persona</div><div class="zz-op op">Rosa Paredes<em>7</em></div><div class="zz-op op">Tomás Guerra<em>5</em></div><div class="zz-op op">Lucía Ferrer<em>3</em></div></div>' : '') +
      (o.pop === 'fe' ? '<div class="zz-pop" style="top:52px;right:200px;width:340px"><div class="lbl">Instaladas</div><div class="zz-op ops"><span class="on">Todo el corte</span><span>Esta semana</span><span>Semana pasada</span><span>Hoy</span><span>Entre fechas</span></div><div class="dos"><div><label>Desde</label><input class="campo" type="date"></div><div><label>Hasta</label><input class="campo" type="date"></div></div></div>' : '') +
      (o.pop === 'mas' ? '<div class="zz-pop" style="top:52px;right:0;width:240px"><div class="zz-op op">Bajar Excel</div><div class="zz-op op">Días para el pago</div></div>' : ''));
    pan.innerHTML = ''; pan.appendChild(t1); pan.appendChild(t2); acc.style.display = 'none';
    // Enviar pendientes al lado del nombre de cada líder (fuera del botón que abre y cierra el grupo)
    document.querySelectorAll('.cx-grupo').forEach((g) => { const cab = g.querySelector('.grupo-cab'); const l = g.dataset.lider; if(!cab || !l || l === 'Por asignar') return;
      const w = document.createElement('div'); w.className = 'zz-cab'; cab.before(w); w.appendChild(cab);
      const nom = cab.querySelector('.tx'); const btn = '<span class="zz-env">' + window.Comun.ic('wa') + 'Enviar pendientes' + (o.ultimo && l === 'Rosa Paredes' ? ' <small>· ayer, Marcos</small>' : '') + '</span>';
      nom.insertAdjacentHTML('afterend', btn); });
  }, Object.assign({ CH, WA: '<svg class="i" viewBox="0 0 24 24"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/></svg>' }, o));
  for(const [u, pin, suf] of [['marcos', '482913', ''], ['elena', '315806', '-analista']]){
    const { ctx } = await contexto(nav, PC); const p = await entrar(ctx, u, pin);
    const ir = async () => { await p.goto(H + 'comisiones.html'); await p.waitForSelector('.cx-grupo', { timeout: 15000 }); await p.waitForTimeout(800); await p.addStyleTag({ content: CSS }); };
    await ir(); await tomar(p, '10-comisiones-hoy' + suf);
    await armar(p, { mos: '', ultimo: true }); await tomar(p, '11-comisiones-filtros' + suf);
    if(!suf){
      await ir(); await armar(p, { pop: 'eq' }); await tomar(p, '11b-comisiones-equipo');
      await ir(); await armar(p, { pop: 'fe' }); await tomar(p, '11c-comisiones-fechas');
      await ir(); await armar(p, { pop: 'mas' }); await tomar(p, '11d-comisiones-mas');
    }
    await ctx.close();
  }
  await nav.close();
})();
