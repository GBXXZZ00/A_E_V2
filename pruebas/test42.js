// Lote urgente 20/10, parte 7: en el teléfono, deslizar hacia abajo cierra la hoja. Desde la agarradera siempre; desde el contenido
// solo si está arriba del todo; si no pasa el umbral, vuelve. Solo transform. Respeta prefers-reduced-motion. En escritorio no aplica.
const { chromium, H, TEL, PC, contexto, marcador, entrar } = require('./simulador');
const { ok, cerrar } = marcador();

async function arrastrar(cdp, x, y0, y1, pasos, ms){
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
  for(let i = 1; i <= pasos; i++){ await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + (y1 - y0) * i / pasos }] }); if(ms) await new Promise((r) => setTimeout(r, ms)); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
const abierta = (p) => p.evaluate(() => window.Comun.hojaAbierta());

(async () => {
  const nav = await chromium.launch(); const errores = [];
  // ----- Teléfono -----
  const { ctx, mundo } = await contexto(nav, TEL);
  const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
  const cdp = await ctx.newCDPSession(p);
  const c = mundo.datos.clientes.find((x) => !x.es_natural);
  const abrirFicha = async () => { await p.goto(H + 'clientes.html?c=' + c.id + '&t=documentos'); await p.waitForSelector('#hojaFicha.ver #tab-documentos .casilla'); await p.waitForTimeout(350); };
  await abrirFicha();
  let r = await p.evaluate(() => { const b = document.getElementById('hojaFicha').getBoundingClientRect(); return { top: b.top, x: b.left + b.width / 2, h: b.height }; });
  // Poco recorrido y lento: vuelve
  await arrastrar(cdp, r.x, r.top + 14, r.top + 60, 6, 40);
  await p.waitForTimeout(350);
  ok('tel: un arrastre corto y lento no la cierra y vuelve a su sitio', (await abierta(p)) === 'hojaFicha' && (await p.evaluate(() => document.getElementById('hojaFicha').style.transform)) === '');
  // Mientras se arrastra, la hoja sigue al dedo con transform
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.top + 14 }] });
  for(let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: r.x, y: r.top + 14 + i * 20 }] });
  const sigue = await p.evaluate(() => document.getElementById('hojaFicha').style.transform);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(350);
  ok('tel: la hoja sigue al dedo con transform', /translateY\(\d+(\.\d+)?px\)/.test(sigue), sigue);
  // Contenido bajado: arrastrar en el medio es scroll, no cierra
  await p.evaluate(() => { document.getElementById('hojaFicha').scrollTop = 500; }); await p.waitForTimeout(100);
  await arrastrar(cdp, r.x, r.top + r.h * 0.6, r.top + r.h * 0.6 + 300, 10, 15);
  await p.waitForTimeout(350);
  ok('tel: con el contenido bajado, arrastrar en el medio no cierra (es scroll)', (await abierta(p)) === 'hojaFicha');
  // Desde la agarradera, largo: cierra
  await p.evaluate(() => { document.getElementById('hojaFicha').scrollTop = 0; }); await p.waitForTimeout(100);
  r = await p.evaluate(() => { const b = document.getElementById('hojaFicha').getBoundingClientRect(); return { top: b.top, x: b.left + b.width / 2, h: b.height }; });
  await arrastrar(cdp, r.x, r.top + 14, r.top + 14 + Math.min(400, r.h * 0.6), 12, 15);
  await p.waitForTimeout(400);
  ok('tel: arrastrar desde la agarradera más allá del umbral la cierra', (await abierta(p)) === null);
  // Rápido y corto: cierra por velocidad
  await abrirFicha();
  r = await p.evaluate(() => { const b = document.getElementById('hojaFicha').getBoundingClientRect(); return { top: b.top, x: b.left + b.width / 2, h: b.height }; });
  await arrastrar(cdp, r.x, r.top + 14, r.top + 90, 3, 0);
  await p.waitForTimeout(400);
  ok('tel: un deslizamiento rápido la cierra aunque sea corto', (await abierta(p)) === null);
  // Hojas apiladas: cierra solo la de arriba
  await abrirFicha();
  await p.click('#tab-documentos [data-campo]'); await p.waitForSelector('#hojaCampo.ver'); await p.waitForTimeout(350);
  r = await p.evaluate(() => { const b = document.getElementById('hojaCampo').getBoundingClientRect(); return { top: b.top, x: b.left + b.width / 2, h: b.height }; });
  await arrastrar(cdp, r.x, r.top + 14, r.top + 14 + Math.max(200, r.h * 0.5), 10, 15);
  await p.waitForTimeout(400);
  ok('tel: con hojas apiladas, deslizar cierra solo la de arriba', (await p.evaluate(() => window.Comun.hojasAbiertas().join())) === 'hojaFicha');
  // Agarradera visible también en las hojas que no la traían
  ok('tel: la hoja de arriba tiene agarradera visible', await p.evaluate(() => { const h = document.getElementById('hojaCampo'); return !!h.querySelector(':scope > .asa') || getComputedStyle(h, '::before').content !== 'none'; }));
  await ctx.close();

  // ----- Movimiento reducido -----
  const rm = await contexto(nav, Object.assign({}, TEL, { reducedMotion: 'reduce' }));
  const q = await entrar(rm.ctx, 'marcos', '482913'); q.on('pageerror', (e) => errores.push(e.message));
  await q.goto(H + 'clientes.html?c=' + c.id); await q.waitForSelector('#hojaFicha.ver');
  ok('tel: con movimiento reducido la hoja no anima su transform', await q.evaluate(() => !/transform/.test(getComputedStyle(document.getElementById('hojaFicha')).transitionProperty) || getComputedStyle(document.getElementById('hojaFicha')).transitionDuration.split(',').every((d) => parseFloat(d) === 0)));
  await rm.ctx.close();

  // ----- Escritorio: no aplica -----
  const pc = await contexto(nav, Object.assign({}, PC, { hasTouch: true }));
  const w = await entrar(pc.ctx, 'marcos', '482913'); w.on('pageerror', (e) => errores.push(e.message));
  const cdp2 = await pc.ctx.newCDPSession(w);
  await w.goto(H + 'clientes.html?c=' + c.id); await w.waitForSelector('#hojaFicha.ver'); await w.waitForTimeout(400);
  const rr = await w.evaluate(() => { const b = document.getElementById('hojaFicha').getBoundingClientRect(); return { top: b.top, x: b.left + b.width / 2 }; });
  await arrastrar(cdp2, rr.x, rr.top + 20, rr.top + 420, 10, 10); await w.waitForTimeout(400);
  ok('pc: en escritorio deslizar no cierra la hoja', (await abierta(w)) === 'hojaFicha');
  await pc.ctx.close();

  ok('sin errores de la página', errores.length === 0, errores.join(' | '));
  await nav.close(); cerrar();
})();
