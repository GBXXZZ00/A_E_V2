// Corrida 23/10: Panel por módulo. Tarjetas con números del mes, minigráfica de 6 meses (Chart.js) y alerta;
// el tablero del módulo con Mes a mes / Año contra año, filtros por número y por barra, y la lista que abre el expediente.
// El líder ve solo lo suyo (la llamada no deja elegir otro líder).
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
const llamo = (m, f) => m.llamadas.filter((l) => l[1] === f);

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['pc', PC], ['tel', TEL]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'panel.html'); await p.waitForSelector('.pn-card[data-pn-mod="clientes"]');
    ok(nombre + ': una tarjeta por cada uno de los 7 módulos', (await p.locator('.pn-card').count()) === 7);
    await p.waitForFunction(() => window.Chart && document.querySelectorAll('[data-pn-mini]').length === 7);
    ok(nombre + ': cada tarjeta trae su minigráfica', await p.evaluate(() => [...document.querySelectorAll('[data-pn-mini]')].every((c) => window.Chart.getChart(c))));
    ok(nombre + ': la alerta dice lo vencido o lo que hay por gestionar', /vencido|por gestionar|Al día/.test(await p.textContent('.pn-card[data-pn-mod="clientes"] .pn-cab')));
    ok(nombre + ': el administrador puede filtrar por líder', (await p.locator('#pnLider option').count()) > 1);
    ok(nombre + ': sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/47-' + nombre + '-panel.png', fullPage: nombre === 'pc' });
    await p.click('.pn-card[data-pn-mod="clientes"]'); await p.waitForSelector('#hojaPn.ver #pnGraf');
    const total = await p.locator('#listaPn .ge-li').count();
    ok(nombre + ': el tablero abre con la gráfica y la lista por gestionar', total > 0 && await p.evaluate(() => !!window.Chart.getChart(document.getElementById('pnGraf'))));
    await p.click('[data-pn-solo="venc"]'); await p.waitForTimeout(100);
    const venc = await p.locator('#listaPn .ge-li').count();
    ok(nombre + ': tocar "Vencidos" filtra la lista', venc >= 1 && venc < total && (await p.locator('#listaPn small.pn-rojo').count()) === venc);
    await p.click('[data-pn-solo=""]');
    // Tocar la barra del mes en curso filtra la lista a ese mes
    await p.evaluate(() => { const g = window.Chart.getChart(document.getElementById('pnGraf')); const m = g.getDatasetMeta(0).data; const b = m[m.length - 1]; g.canvas.dispatchEvent(new MouseEvent('click', { clientX: g.canvas.getBoundingClientRect().left + b.x, clientY: g.canvas.getBoundingClientRect().top + b.y + 2, bubbles: true })); });
    await p.waitForSelector('#listaPn .pn-quitar');
    ok(nombre + ': tocar una barra filtra la lista por ese mes y se puede quitar', /Desde/.test(await p.textContent('#listaPn .pn-quitar')));
    await p.click('[data-pn="sinMes"]'); await p.waitForFunction(() => !document.querySelector('#listaPn .pn-quitar'));
    await p.click('[data-pn-modo="anio"]'); await p.waitForTimeout(150);
    ok(nombre + ': Año contra año pinta este año y el anterior', await p.evaluate(() => { const g = window.Chart.getChart(document.getElementById('pnGraf')); return g.config.type === 'line' && g.data.datasets.length === 2; }));
    await p.screenshot({ path: 'capturas/47-' + nombre + '-tablero.png' });
    await p.click('#listaPn [data-pn-cli="0"]'); await p.waitForSelector('#hojaFicha.ver #tFicha');
    ok(nombre + ': tocar un caso abre su expediente encima', true);
    await ctx.close();
  }
  // El líder: solo lo suyo, sin elegir líder
  {
    const { ctx, mundo } = await contexto(nav, PC);
    const p = await entrar(ctx, 'lucia', '739105'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'panel.html'); await p.waitForSelector('.pn-card');
    const lucia = mundo.personas.find((x) => x.usuario === 'lucia');
    ok('líder: no ve el filtro de líder', (await p.locator('#pnLider').count()) === 0);
    await p.click('.pn-card[data-pn-mod="clientes"]'); await p.waitForSelector('#hojaPn.ver #listaPn');
    const ajenos = mundo.datos.clientes.filter((c) => c.lider_id !== lucia.id).map((c) => c.nombre);
    const txt = await p.textContent('#listaPn');
    ok('líder: la lista trae solo sus clientes', !ajenos.some((n) => txt.includes(n)) && llamo(mundo, 'panel').length > 0);
    await ctx.close();
  }
  ok('sin errores de la página', errores.length === 0, errores);
  await nav.close(); cerrar();
})();
