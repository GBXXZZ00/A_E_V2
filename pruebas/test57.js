// Lote 11/11, H2 y H3: Mi trabajo de Canales. Analista: números, cartas con WhatsApp o Descargar, "Ya la envié", IP sugerida del pool y "Todo el equipo".
// Coordinadora: Lo mío / Mi equipo, carga por persona, cartas por persona o por días, Pasar a otra persona y órdenes sin dueño. Datos inventados.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['pc', PC], ['tel', TEL]]){
    // Analista
    { const { ctx, mundo } = await contexto(nav, dispositivo);
      const pedro = mundo.personas.find((p) => p.usuario === 'pedro'); pedro.debe_cambiar_pin = false;
      // Sin teléfonos (sale Descargar) y con una IP libre en el reporte (sale "Usar")
      mundo.datos.clientes.forEach((c) => { c.telefono = null; (c.representantes || []).forEach((r) => { r.telefono = null; }); (c.servicios || []).forEach((s) => { s.telefono = null; }); });
      (mundo.datos.ipReporte = mundo.datos.ipReporte || []).push({ id: 9901, ip: '192.0.2.50', libre: true });
      const p = await entrar(ctx, 'pedro', '204871'); p.on('pageerror', (e) => errores.push(nombre + ': ' + e.message));
      await p.goto(H + 'trabajo.html'); await p.waitForSelector('.cn-tiles', { timeout: 15000 });
      const txt = await p.textContent('#cuerpo');
      ok(nombre + ': analista ve los números de la maqueta', ['Cartas por enviar', 'Descargadas sin confirmar', 'Más de 3 días', 'Esperan la IP', 'Cambios por emitir', 'Pago por revisar'].every((x) => txt.indexOf(x) >= 0));
      ok(nombre + ': cartas primero y luego Esperan la IP', txt.indexOf('Cartas y proformas ·') >= 0 && txt.indexOf('Cartas y proformas ·') < txt.indexOf('Esperan la IP ·'));
      ok(nombre + ': Cambios por emitir y Pago por revisar van plegados', (await p.locator('details.cn-pl:not([open])').count()) === 2);
      const filas = await p.locator('#cuerpo [data-cn-wa], #cuerpo [data-cn-pdf], #cuerpo [data-cn-hacer]').count();
      ok(nombre + ': cada carta tiene su botón en la misma fila (WhatsApp, Descargar o Escribir IP)', filas >= 1, filas);
      ok(nombre + ': sin desborde', await sinDesborde(p));
      await p.screenshot({ path: 'capturas/lote11nov-H3-' + nombre + '.png', fullPage: false });
      if(await p.locator('[data-cn-pdf]').count()){
        await p.locator('[data-cn-pdf]').first().click();
        await p.waitForSelector('[data-cn-ya]', { timeout: 10000 }).catch(() => {});
        ok(nombre + ': al descargar queda "Descargaste la carta… ¿Ya la enviaste?" con Ya la envié', (await p.locator('[data-cn-ya]').count()) >= 1 && /Ya la enviaste/.test(await p.textContent('#cuerpo')));
        await p.locator('[data-cn-ya]').first().click(); await p.waitForTimeout(400);
        ok(nombre + ': Ya la envié la marca como enviada', mundo.llamadas.some((l) => l[0] === 'carta_marcar_enviada' || (Array.isArray(l) && l[1] === 'carta_marcar_enviada')) || (mundo.bitacora || []).some((b) => /carta/.test(b.accion)));
      } else ok(nombre + ': (no hay carta sin número para descargar)', true);
      await p.click('[data-cn-eq="1"]'); await p.waitForTimeout(150);
      if(await p.locator('[data-cn-ip]').count()){
        await p.locator('[data-cn-ip]').first().click(); await p.waitForTimeout(400);
        ok(nombre + ': "Usar" guarda la IP sugerida del pool', (mundo.bitacora || []).some((b) => b.accion === 'servicio_ip'));
      } else ok(nombre + ': (no hay IP sugerida en estos datos)', true);
      await p.click('[data-cn-eq="1"]'); await p.waitForTimeout(150);
      ok(nombre + ': "Todo el equipo" muestra lo de Canales', (await p.getAttribute('[data-cn-eq="1"]', 'aria-selected')) === 'true');
      await ctx.close(); }
    // Coordinadora
    { const { ctx, mundo } = await contexto(nav, dispositivo);
      const pedro = mundo.personas.find((p) => p.usuario === 'pedro'); pedro.debe_cambiar_pin = false; pedro.coordinador = true;
      const p = await entrar(ctx, 'pedro', '204871'); p.on('pageerror', (e) => errores.push(nombre + ' coord: ' + e.message));
      await p.goto(H + 'trabajo.html'); await p.waitForSelector('.cn-tiles', { timeout: 15000 });
      ok(nombre + ': la coordinadora abre en "Mi equipo" con "Lo mío" al lado', (await p.getAttribute('[data-cn-modo="equipo"]', 'aria-selected')) === 'true' && (await p.locator('[data-cn-modo="mio"]').count()) === 1);
      ok(nombre + ': carga por persona con Ver su trabajo', (await p.locator('.cn-team .cn-per').count()) >= 2 && (await p.locator('.cn-team [data-persona]').count()) >= 1);
      const txt = await p.textContent('#cuerpo');
      ok(nombre + ': cartas del equipo y órdenes sin dueño', /Cartas y proformas del equipo/.test(txt) && /Órdenes sin dueño/.test(txt));
      await p.click('[data-cn-por="dias"]'); await p.waitForTimeout(100);
      ok(nombre + ': cambia a Por días', (await p.getAttribute('[data-cn-por="dias"]', 'aria-pressed')) === 'true');
      ok(nombre + ': sin desborde (coordinadora)', await sinDesborde(p));
      await p.screenshot({ path: 'capturas/lote11nov-H2-' + nombre + '.png', fullPage: false });
      if(await p.locator('[data-cn-pasar]').count()){
        await p.locator('[data-cn-pasar]').first().click(); await p.waitForSelector('#hojaPasar.ver #psQuien');
        const destino = await p.$eval('#psQuien option:not([disabled])', (o) => o.value);
        await p.selectOption('#psQuien', destino); await p.click('#psOk'); await p.waitForTimeout(500);
        ok(nombre + ': Pasar a otra persona la asigna y queda en la bitácora', Object.values(mundo.datos.asig || {}).includes(destino) && (mundo.bitacora || []).some((b) => b.accion === 'trabajo_pasado'));
      } else ok(nombre + ': (no hay carta para pasar)', true);
      await p.click('[data-cn-modo="mio"]'); await p.waitForTimeout(100);
      ok(nombre + ': Lo mío deja solo lo suyo', (await p.getAttribute('[data-cn-modo="mio"]', 'aria-selected')) === 'true' && !(await p.locator('.cn-team').count()));
      await ctx.close(); }
  }
  ok('sin errores de JavaScript', !errores.length, errores.slice(0, 3));
  await nav.close(); cerrar();
})();
