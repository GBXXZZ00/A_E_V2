const { chromium, H, TEL, PC, contexto, entrar } = require('./simulador');
(async () => { const [,, pagina, out, disp, usuario, pin] = process.argv; const nav = await chromium.launch();
  const { ctx } = await contexto(nav, disp === 'tel' ? TEL : PC);
  const p = await entrar(ctx, usuario || 'marcos', pin || '482913'); await p.goto(H + pagina); await p.waitForTimeout(2500);
  await p.screenshot({ path: out, fullPage: true }); await nav.close(); })();
