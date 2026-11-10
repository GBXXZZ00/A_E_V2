const { chromium, H, TEL, PC, contexto, entrar } = require('./simulador');
(async () => { const [,, out, disp] = process.argv; const nav = await chromium.launch(); const { ctx } = await contexto(nav, disp === 'tel' ? TEL : PC);
  const p = await entrar(ctx, 'marcos', '482913'); await p.goto(H + 'usuarios.html'); await p.waitForSelector('#nuevo'); await p.click('#nuevo'); await p.waitForTimeout(500);
  await p.screenshot({ path: out + '-1.png' }); await p.click('[data-cargo="lider"]'); await p.waitForTimeout(400); await p.screenshot({ path: out + '-2.png' }); await nav.close(); })();
