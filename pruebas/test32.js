// Lote 22/10: en Comisiones cada corte muestra dos bloques, Instalaciones y Migraciones. Las migraciones comisionan solas (Legal y pago);
// los cambios a residencial (indicador negativo) y el histórico pagado fuera de la app salen aparte; ya no hay "comisión por decidir".
// Migraciones sigue en Inicio y en la barra del líder.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
function sembrar(m){
  // Una instalación del corte pasa a ser migración (viene de un cambio confirmado)
  const c = m.datos.clientes.find((x) => (x.instalaciones || []).length); c.instalaciones[0].cambio_id = 77;
  m.datos.migCorte = { residencial: [{ id: 81, nombre: 'Taller Inventado', lider: 'Lucía Ferrer', en: new Date().toISOString() }],
    historico: [{ id: 82, nombre: 'Bodega Vieja Inventada', lider: 'Lucía Ferrer', en: new Date().toISOString() }] };
  return c;
}

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo); const cli = sembrar(mundo);
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    await p.waitForSelector('#zonaModulos a[data-modulo]');
    ok(nombre + ': Migraciones es un módulo en Inicio', (await p.locator('#zonaModulos a[data-modulo="migraciones"]').count()) === 1);
    // Lote 28/10: Instalaciones PYME y Cambios de categoría son dos tarjetas arriba; los cambios van en su propia vista
    await p.goto(H + 'comisiones.html'); await p.waitForSelector('#segs');
    ok(nombre + ': arriba las tarjetas Instalaciones PYME y Cambios de categoría', /Instalaciones PYME/.test(await p.textContent('#segs')) && /Cambios de categoría/.test(await p.textContent('#segs')));
    const ti = await p.textContent('#lista');
    ok(nombre + ': la migración no sale con las instalaciones', !ti.includes(cli.nombre) || (await p.locator('#lista [data-com]', { hasText: cli.nombre }).count()) === 0);
    await p.goto(H + 'comisiones.html?t=cambios'); await p.waitForFunction(() => /Cambios a residencial/.test(document.getElementById('lista').textContent));
    const t = await p.textContent('#lista');
    ok(nombre + ': en Cambios de categoría sale la migración', t.includes(cli.nombre));
    ok(nombre + ': cambios a residencial e histórico pagado fuera van aparte', /Cambios a residencial/.test(t) && /Histórico pagado fuera de la app/.test(t));
    ok(nombre + ': ya no hay aviso de cambios por decidir', (await p.locator('#avisoCam .cam-dec').count()) === 0);
    ok(nombre + ': sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/32-' + nombre + '-comisiones.png', fullPage: true });
    if(nombre === 'tel') ok('tel: la barra del administrador no pasa de 5', (await p.locator('#navAbajo a').count()) === 5);
    else ok('pc: Migraciones está en el menú de arriba', (await p.locator('.navpc a[href="migraciones.html"]').count()) === 1);
    const c2 = await contexto(nav, dispositivo, mundo); const q = await entrar(c2.ctx, 'lucia', '739105'); q.on('pageerror', (e) => errores.push(e.message));
    if(nombre === 'tel') ok('tel: el líder tiene Migraciones en la barra de abajo', (await q.locator('#navAbajo a[href="migraciones.html"]').count()) === 1 && (await q.locator('#navAbajo a').count()) <= 5);
    else ok('pc: el líder entra a Migraciones', (await q.locator('.navpc a[href="migraciones.html"]').count()) === 1);
    await c2.ctx.close(); await ctx.close();
  }
  ok('sin errores de la página', errores.length === 0, errores);
  await nav.close(); cerrar();
})();
