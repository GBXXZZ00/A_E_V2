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
    await p.click('[data-rs-ver="resumen"]'); await p.waitForSelector('#zonaRes .rs-n');
    ok(nombre + ': el Resumen esconde la lista y queda en la dirección', !(await p.isVisible('#lista')) && /v=resumen/.test(p.url()) && (await p.isVisible('#tarjetas')));
    ok(nombre + ': cuatro números y las gráficas de Clientes', (await p.locator('#zonaRes .rs-n').count()) === 4 && /Instalaciones PYME/.test(await p.textContent('#zonaRes')) && /Estatus legal por segmento/.test(await p.textContent('#zonaRes')) && /Siguen habilitadas/.test(await p.textContent('#zonaRes')));
    ok(nombre + ': pide el resumen de clientes del mes', llamo(mundo, 'modulo_resumen').some((l) => l[2].p_modulo === 'clientes' && /-01$/.test(l[2].p_desde)));
    await p.click('[data-rs-vista2="inst:anio"]');
    ok(nombre + ': Año contra año', (await p.locator('#zonaRes .rs-par').count()) >= 1 && /\(/.test(await p.textContent('#zonaRes .rs-anio + .ley')) || (await p.locator('#zonaRes .rs-par').count()) >= 1);
    await p.click('[data-rs-vista2="inst:mes"]');
    // Un tramo del estatus legal abre su lista
    await p.locator('#zonaRes .rs-s-barra button').first().click(); await p.waitForSelector('#hojaRes.ver .rs-df');
    const det = llamo(mundo, 'modulo_detalle').pop();
    ok(nombre + ': el tramo pide su detalle (legal, segmento:grupo)', det && det[2].p_grafica === 'legal' && /^pyme:/.test(det[2].p_valor) && det[2].p_pagina === 0);
    ok(nombre + ': el panel tiene título, cantidad, lista, Exportar a Excel y Ver todos en la lista', /PYME/.test(await p.textContent('#tRes')) && /registro/.test(await p.textContent('#nRes')) && (await p.locator('#hojaRes [data-rs-excel]').count()) === 1 && (await p.locator('#hojaRes a.btn[href*="clientes.html"]').count()) === 1);
    const [baja] = await Promise.all([p.waitForEvent('download'), p.click('#hojaRes [data-rs-excel]')]);
    const csv = fs.readFileSync(await baja.path(), 'utf8');
    ok(nombre + ': el Excel es CSV con BOM, separado por punto y coma', csv.charCodeAt(0) === 0xFEFF && /^﻿"Nombre";"Detalle";"Estado"/.test(csv) && /\.csv$/.test(baja.suggestedFilename()) && llamo(mundo, 'modulo_detalle').some((l) => l[2].p_pagina === -1));
    await p.locator('#hojaRes button.rs-df').first().click(); await p.waitForFunction(() => window.Comun.hojasAbiertas().length === 2);
    ok(nombre + ': una fila abre el expediente encima', await p.evaluate(() => window.Comun.hojasAbiertas()[1] !== 'hojaRes'));
    for(let i = 0; i < 3 && await p.evaluate(() => !!window.Comun.hojaAbierta()); i++){ await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
    // Un número abre su lista
    await p.locator('#zonaRes .rs-n').nth(2).click(); await p.waitForSelector('#hojaRes.ver');
    ok(nombre + ': un número abre su lista', llamo(mundo, 'modulo_detalle').pop()[2].p_valor === 'todos:faltan');
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    // Tarjeta de dedicados: Resumen de Dedicados
    await p.click('#tarjetas [data-tarjeta="corporativo"]'); await p.waitForFunction(() => /Dedicados/.test(document.getElementById('zonaRes').textContent));
    ok(nombre + ': con la tarjeta de dedicados el Resumen es el de Dedicados', llamo(mundo, 'modulo_resumen').some((l) => l[2].p_modulo === 'dedicados') && /Ingresos de dedicados/.test(await p.textContent('#zonaRes')));
    await p.click('#tarjetas [data-tarjeta="pyme"]');
    ok(nombre + ': Clientes Resumen no desborda', await sinDesborde(p));
    // Otros módulos
    for(const [pg, mod] of [['comisiones.html', 'comisiones'], ['revision.html', 'revision'], ['migraciones.html', 'migraciones'], ['factibilidad.html', 'factibilidad']]){
      await p.goto(H + pg + '?v=resumen'); await p.waitForSelector('#zonaRes .rs-n');
      ok(nombre + ': ' + mod + ' abre en Resumen desde la dirección', llamo(mundo, 'modulo_resumen').some((l) => l[2].p_modulo === mod) && (await p.locator('#zonaRes .rs-card').count()) >= 1 && await sinDesborde(p));
    }
    await p.click('[data-rs-ver="lista"]');
    ok(nombre + ': volver a Lista la muestra igual', await p.isVisible('#faLista') && !/v=resumen/.test(p.url()));
    // ----- Líder: lo suyo -----
    const c2 = await contexto(nav, dispositivo, mundo); const l = await entrar(c2.ctx, 'lucia', '739105'); l.on('pageerror', (e) => errores.push(e.message));
    await l.goto(H + 'clientes.html?v=resumen'); await l.waitForSelector('#zonaRes .rs-n');
    const tot = await l.textContent('#zonaRes .rs-n b');
    ok(nombre + ': el líder ve solo sus clientes en el Resumen', Number(tot.replace(/\D/g, '')) === mundo.datos.clientes.filter((c) => !c.unido_a && (c.lider_id === '22222222-2222-4222-8222-222222222222' || (c.dedicado && c.dedicado.ejecutiva_id === '22222222-2222-4222-8222-222222222222'))).length);
    await c2.ctx.close();
    await ctx.close();
  }
  ok('sin errores de la página', errores.length === 0, errores);
  await nav.close(); cerrar();
})();
