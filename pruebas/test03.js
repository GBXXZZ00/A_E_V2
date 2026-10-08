// Inicio, navegación, menú de cuenta y Comisiones.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    await p.waitForSelector('a.corte');
    ok(nombre + ': Inicio muestra el corte y los módulos', (await p.locator('a.mod[data-modulo]').count()) >= 2 && /d[ií]a|hoy/i.test(await p.textContent('a.corte')));
    ok(nombre + ': Inicio sin desborde', await sinDesborde(p));
    const navSel = nombre === 'tel' ? '#navAbajo' : '.navpc';
    ok(nombre + ': navegación con Inicio marcado', (await p.textContent(navSel + ' .on')).trim() === 'Inicio');
    await p.click('#cuenta'); await p.waitForSelector('#hojaCuenta.ver');
    ok(nombre + ': menú de cuenta con usuarios y sin Actualizar todavía', (await p.locator('#hojaCuenta [data-ir="usuarios"]').count()) === 1 && (await p.locator('#hojaCuenta [data-ir="actualizar"]').count()) === 0);
    await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('#hojaCuenta.ver'));

    await p.click('a.corte'); await p.waitForURL('**/comisiones.html'); await p.waitForSelector('.grupo');
    ok(nombre + ': Comisiones marca su pestaña', (await p.textContent(navSel + ' .on')).trim() === 'Comisiones');
    const grupos = await p.locator('.grupo').count();
    ok(nombre + ': agrupa por líder', grupos === 3 && (await p.textContent('.mets .negro')).includes('de 16'));
    ok(nombre + ': los grupos empiezan cerrados', (await p.locator('.grupo.abierto').count()) === 0);
    await p.locator('.grupo-cab').filter({ hasText: 'Rosa Paredes' }).click();
    ok(nombre + ': al abrir separa el último corte', (await p.locator('.grupo.abierto .sub-bloque').count()) === 2 && (await p.textContent('.grupo.abierto .sub-bloque')).includes('Último corte'));
    ok(nombre + ': Comisiones sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/03-' + nombre + '-comisiones.png', fullPage: true });
    await p.click('[data-filtro="ultimo"]');
    ok(nombre + ': filtro Último corte', (await p.locator('a.fila').count()) === 1 && p.url().includes('f=ultimo'));
    await p.click('[data-filtro="instalar"]');
    ok(nombre + ': Por instalar lista las órdenes abiertas', (await p.locator('a.fila').count()) === 1 && (await p.textContent('#lista')).includes('Aún no cuentan'));
    await p.click('[data-filtro="legal"]');
    ok(nombre + ': Falta legal solo trae las que no cumplen legal', (await p.locator('.m.verde:has-text("Legal")').count()) === 0);
    await p.selectOption('#corte', { index: 1 }); await p.waitForFunction(() => document.getElementById('rango').textContent.includes('cerrado'));
    ok(nombre + ': corte anterior sin filtro Por instalar', (await p.locator('[data-filtro="instalar"]').count()) === 0 && /c=\d{4}-\d{2}/.test(p.url()));
    ok(nombre + ': pide el corte elegido', mundo.llamadas.some((l) => l[0] === 'rpc' && l[1] === 'comisiones_corte' && l[2].p_corte));
    await p.selectOption('#corte', { index: 0 }); await p.waitForSelector('[data-filtro="instalar"]');
    await p.click('[data-filtro="todos"]'); await p.locator('.grupo-cab').filter({ hasText: 'Lucía Ferrer' }).click();
    await p.locator('a.fila').filter({ hasText: 'Vidrios El Faro' }).click(); await p.waitForURL('**/cliente.html?id=1001&t=comision');
    await p.waitForSelector('#cabFicha h1');
    ok(nombre + ': la fila abre la ficha en Comisión y vuelve a Comisiones', (await p.textContent('.barra-volver, #volverPc')).includes('Comisiones') || (await p.locator('a[href="comisiones.html"]').count()) > 0);
    await ctx.close();

    // Un líder solo ve lo suyo
    const b = await contexto(nav, dispositivo); const q = await entrar(b.ctx, 'lucia', '739105'); q.on('pageerror', (e) => errores.push(e.message));
    await q.goto(H + 'comisiones.html?f=ultimo'); await q.waitForSelector('.mets .met');
    ok(nombre + ': el líder solo ve sus instalaciones', (await q.textContent('.mets .negro')).includes('de 3') && (await q.locator('[data-filtro="ultimo"].on').count()) === 1);
    await q.click('[data-filtro="todos"]'); await q.waitForSelector('.grupo.abierto');
    ok(nombre + ': con un solo líder el grupo ya viene abierto', (await q.locator('a.fila').count()) === 3);
    b.mundo.fallaRpc = 'comisiones_corte'; await q.evaluate(() => Object.keys(sessionStorage).filter((k) => k.indexOf('ae_c_') === 0).forEach((k) => sessionStorage.removeItem(k))); await q.reload();
    await q.waitForSelector('#reintentar');
    ok(nombre + ': si falla muestra error y Reintentar', (await q.locator('.toast').count()) >= 1);
    b.mundo.fallaRpc = null; await q.click('#reintentar'); await q.waitForSelector('.grupo');
    ok(nombre + ': Reintentar recupera', true);
    await b.ctx.close();
  }
  ok('sin errores de JavaScript', errores.length === 0); if(errores.length) console.log(errores);
  await nav.close(); cerrar();
})();
