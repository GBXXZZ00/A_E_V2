// Inicio, navegación, menú de cuenta y Comisiones.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar, plegables } = require('./simulador');
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
    ok(nombre + ': menú de cuenta con Usuarios y Actualizar', (await p.locator('#hojaCuenta [data-ir="usuarios"]').count()) === 1 && (await p.locator('#hojaCuenta [data-ir="actualizar"]').count()) === 1);
    await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('#hojaCuenta.ver'));

    await p.click('a.corte'); await p.waitForURL('**/comisiones.html'); await p.waitForSelector('.grupo');
    ok(nombre + ': Comisiones marca su pestaña', (await p.textContent(navSel + ' .on')).replace(/\d+\+?/g, '').trim() === 'Comisiones');
    // Lote 28/10: tarjetas arriba, pestañas por equipo y grupos por dueño
    ok(nombre + ': agrupa por dueño dentro del equipo', (await p.locator('.grupo').count()) === 4 && /16/.test(await p.textContent('#segs')) && /Ventas corporativas/.test(await p.textContent('#equipos')));
    ok(nombre + ': el primer grupo viene abierto y el resto cerrado', (await p.locator('.grupo.abierto').count()) === 1);
    await p.locator('.grupo-cab').filter({ hasText: 'Rosa Paredes' }).click();
    ok(nombre + ': Comisiones sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/03-' + nombre + '-comisiones.png', fullPage: true });
    await p.click('#filtros [data-filtro="ultimo"]');
    ok(nombre + ': filtro Del corte anterior', (await p.locator('[data-com]').count()) === 1 && p.url().includes('f=ultimo'));
    await p.click('#alertas [data-abrir="por_instalar"]'); await p.waitForSelector('#hojaPorInst.ver');
    ok(nombre + ': Por instalar sale como hoja encima, con las órdenes en horas', /hora/i.test(await p.textContent('#hojaPorInst')));
    await p.keyboard.press('Escape'); await p.waitForFunction(() => !window.Comun.hojaAbierta());
    await p.click('#filtros [data-filtro="legal"]');
    ok(nombre + ': Falta legal solo trae las que no cumplen legal', (await p.locator('[data-com]').count()) === 11);
    // El corte anterior al que está en curso (arriba puede estar el siguiente)
    const enCursoVal = await p.evaluate(() => Array.from(document.getElementById('corte').options).find((o) => /en curso/.test(o.textContent)).value);
    const anterior = await p.evaluate(() => { const o = Array.from(document.getElementById('corte').options); return o[o.findIndex((x) => /en curso/.test(x.textContent)) + 1].value; });
    await p.selectOption('#corte', anterior); await p.waitForFunction(() => document.getElementById('rango').textContent.includes('cerrado'));
    ok(nombre + ': el corte anterior queda en la dirección', /c=\d{4}-\d{2}/.test(p.url()));
    ok(nombre + ': pide el corte elegido', mundo.llamadas.some((l) => l[0] === 'rpc' && l[1] === 'comisiones_lista' && l[2].p_corte));
    await p.selectOption('#corte', enCursoVal); await p.waitForFunction(() => /día límite|Día límite/i.test(document.getElementById('rango').textContent));
    await p.click('#filtros [data-filtro="todos"]'); await p.locator('.grupo-cab').filter({ hasText: 'Lucía Ferrer' }).click();
    await p.locator('.grupo.abierto [data-com]').filter({ hasText: 'Vidrios El Faro' }).click(); await p.waitForSelector('#hojaComision.ver [data-plg-btn="pago"]');
    const hc = await p.textContent('#hojaComision');
    ok(nombre + ': la fila abre la hoja de comisión, sin salir', p.url().includes('comisiones.html') && hc.includes('Legal') && hc.includes('Pago'));
    // Lote 28/10: resumen arriba (Legal, Pago, Orden); lo que falta primero y abierto, lo listo plegado
    ok(nombre + ': resumen arriba con Legal, Pago y Orden', /Legal/.test(await p.textContent('#hojaComision .hc-res')) && /Orden/.test(await p.textContent('#hojaComision .hc-res')));
    ok(nombre + ': plegables Legal, Carta, Pago, Orden, Más acciones e Hilo', await p.evaluate(() => ['legal', 'carta', 'pago', 'orden', 'ajustes', 'hilo'].every((id) => document.querySelector('[data-plg-btn="' + id + '"]'))));
    ok(nombre + ': lo que falta (Legal) viene abierto', (await p.getAttribute('[data-plg-btn="legal"]', 'aria-expanded')) === 'true');
    await p.screenshot({ path: 'capturas/03-' + nombre + '-comision.png' });
    const dz = await p.textContent('#docsCom');
    ok(nombre + ': trae las mismas casillas del expediente y Subir varios', dz.includes('Representante 1') && dz.includes('Empresa') && dz.includes('RIF de la empresa') && (await p.locator('#docsCom [data-casilla="cedula:1"]').count()) === 1 && (await p.locator('#comVarios').count()) === 1);
    await p.locator('#docsCom [data-ver]').first().click(); await p.waitForSelector('#hojaFicha.ver #tFicha');
    ok(nombre + ': gestionar un documento abre el expediente encima, en Documentos', (await p.evaluate(() => window.Comun.hojasAbiertas().join())) === 'hojaComision,hojaFicha' && (await p.locator('#tabs .on').textContent()).includes('Documentos'));
    await p.click('#cabFicha [data-cierra]'); await p.waitForFunction(() => window.Comun.hojasAbiertas().join() === 'hojaComision');
    ok(nombre + ': al cerrarlo se vuelve a la comisión', true);
    const pagos = mundo.llamadas.filter((l) => l[1] === 'instalacion_pago').length;
    await plegables(p, 'pago'); await p.click('#pagoCom'); if(await p.locator('#pagoSi').count()) await p.click('#pagoSi');
    await p.waitForFunction(() => Array.from(document.querySelectorAll('.toast')).some((t) => /pagada|Pago quitado/.test(t.textContent)));
    ok(nombre + ': el pago se gestiona desde la hoja', mundo.llamadas.filter((l) => l[1] === 'instalacion_pago').length === pagos + 1);
    await plegables(p, 'orden'); await p.click('#abrirExp'); await p.waitForSelector('#hojaFicha.ver #tFicha');
    ok(nombre + ': Ver expediente lleva a Datos', (await p.locator('#tabs .on').textContent()).trim() === 'Datos');
    await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.waitForFunction(() => !window.Comun.hojaAbierta());
    ok(nombre + ': Comisiones con hojas sin desborde', await sinDesborde(p));
    await ctx.close();

    // Un líder solo ve lo suyo
    const b = await contexto(nav, dispositivo); const q = await entrar(b.ctx, 'lucia', '739105'); q.on('pageerror', (e) => errores.push(e.message));
    await q.goto(H + 'comisiones.html?f=ultimo'); await q.waitForSelector('#segs');
    ok(nombre + ': el líder solo ve sus instalaciones', /^\s*3/.test(await q.textContent('#segs')) && (await q.locator('#filtros [data-filtro="ultimo"].on').count()) === 1);
    await q.click('#filtros [data-filtro="todos"]'); await q.waitForSelector('.grupo.abierto');
    ok(nombre + ': con un solo dueño el grupo ya viene abierto', (await q.locator('.grupo.abierto [data-com]').count()) === 3);
    b.mundo.fallaRpc = 'comisiones_lista'; await q.evaluate(() => Object.keys(localStorage).filter((k) => k.indexOf('ae_c_') === 0).forEach((k) => localStorage.removeItem(k))); await q.reload();
    await q.waitForSelector('#reintentar');
    ok(nombre + ': si falla muestra error y Reintentar', (await q.locator('.toast').count()) >= 1);
    b.mundo.fallaRpc = null; await q.click('#reintentar'); await q.waitForSelector('.grupo');
    ok(nombre + ': Reintentar recupera', true);
    await b.ctx.close();
  }
  ok('sin errores de JavaScript', errores.length === 0); if(errores.length) console.log(errores);
  await nav.close(); cerrar();
})();
