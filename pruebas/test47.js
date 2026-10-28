// Lote 27/10: Resumen de cada módulo (Lista | Resumen). Cuatro números tocables y gráficas; todo abre el panel de detalle
// (a la derecha en escritorio, desde abajo en teléfono) con su lista, Exportar a Excel (CSV con ; y BOM) y Ver todos en la lista.
// En Clientes, las tarjetas de dedicados dan el Resumen de Dedicados. El líder ve lo suyo; Legal no ve el de Comisiones.
const fs = require('fs');
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
const llamo = (m, f) => m.llamadas.filter((l) => l[1] === f);

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['pc', PC], ['tel', TEL]]){
    const { ctx, mundo } = await contexto(nav, Object.assign({ acceptDownloads: true }, dispositivo));
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'clientes.html'); await p.waitForSelector('#lista .cli, #lista .vacio');
    ok(nombre + ': Clientes arranca en Lista con Lista | Resumen arriba', (await p.locator('.rs-vista [data-rs-ver]').count()) === 2 && !(await p.isVisible('#zonaRes')));
    await p.click('[data-rs-ver="resumen"]'); await p.waitForSelector('#zonaRes .cr-num');
    ok(nombre + ': el Resumen esconde la lista y queda en la dirección', !(await p.isVisible('#lista')) && /v=resumen/.test(p.url()));
    // Lote 28/10: tarjetas por tipo de cliente, promedios de 12 meses, churn, instalados por mes y estatus legal; sin deuda
    const zr = await p.textContent('#zonaRes');
    ok(nombre + ': tarjetas PYME, Dedicado corporativo, Dedicado ISP y VGT', ['PYME', 'Dedicado corporativo', 'Dedicado ISP', 'VGT'].every((t) => zr.includes(t)) && (await p.locator('#zonaRes [data-cl-seg]').count()) === 4);
    ok(nombre + ': promedios de 12 meses, churn del mes y de infancia, instalados por mes', /Promedios/.test(zr) && /Churn del mes/.test(zr) && /Churn de infancia/.test(zr) && /Instalados por mes/.test(zr));
    ok(nombre + ': sin deuda en el Resumen de Clientes', !/deuda/i.test(zr));
    ok(nombre + ': pide el resumen de clientes del mes', llamo(mundo, 'clientes_resumen').length >= 1);
    // Un número abre el detalle nuevo (total, reparto por dueño, desplegables, Excel)
    await p.locator('#zonaRes .cr-num[data-cl-g]').first().click(); await p.waitForSelector('#hojaRes.ver');
    const det = llamo(mundo, 'clientes_detalle').pop();
    ok(nombre + ': el número pide su detalle', !!det && det[2].p_pagina === 0);
    await p.waitForSelector('#hojaRes [data-rs-excel]');
    ok(nombre + ': el panel tiene título, Exportar a Excel', (await p.textContent('#tRes')).length > 0 && (await p.locator('#hojaRes [data-rs-excel]').count()) === 1);
    const [baja] = await Promise.all([p.waitForEvent('download'), p.click('#hojaRes [data-rs-excel]')]);
    const csv = fs.readFileSync(await baja.path(), 'utf8');
    ok(nombre + ': el Excel es CSV con BOM, separado por punto y coma y con la columna Dueño', csv.charCodeAt(0) === 0xFEFF && /;/.test(csv) && /Dueño/.test(csv) && /\.csv$/.test(baja.suggestedFilename()));
    for(let i = 0; i < 3 && await p.evaluate(() => !!window.Comun.hojaAbierta()); i++){ await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
    ok(nombre + ': Clientes Resumen no desborda', await sinDesborde(p));
    // Otros módulos
    for(const [pg, mod] of [['migraciones.html', 'migraciones'], ['factibilidad.html', 'factibilidad']]){
      await p.goto(H + pg + '?v=resumen'); await p.waitForSelector('#zonaRes .rs-n');
      ok(nombre + ': ' + mod + ' abre en Resumen desde la dirección', llamo(mundo, 'modulo_resumen').some((l) => l[2].p_modulo === mod) && (await p.locator('#zonaRes .rs-card').count()) >= 1 && await sinDesborde(p));
    }
    await p.click('[data-rs-ver="lista"]');
    ok(nombre + ': volver a Lista la muestra igual', await p.isVisible('#faLista') && !/v=resumen/.test(p.url()));
    // ----- Líder: lo suyo -----
    const c2 = await contexto(nav, dispositivo, mundo); const l = await entrar(c2.ctx, 'lucia', '739105'); l.on('pageerror', (e) => errores.push(e.message));
    await l.goto(H + 'clientes.html?v=resumen'); await l.waitForSelector('#zonaRes .cr-num');
    ok(nombre + ': el líder abre su Resumen de Clientes', llamo(mundo, 'clientes_resumen').length >= 2);
    await c2.ctx.close();
    await ctx.close();
  }
  ok('sin errores de la página', errores.length === 0, errores);
  await nav.close(); cerrar();
})();
