// Lote 13/11, parte 12: la lista del líder conserva su diseño; filtros de estado a la vista (Todas · Comisionan · Faltan documentos ·
// Falta el pago · Carta por enviar · Migraciones), las migraciones dentro de la lista con la etiqueta azul "Migración", sin la tarjeta
// "Cambios de categoría", y el Resumen nuevo (administrador) y el del líder (solo lo suyo). Teléfono y PC.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, disp] of [['pc', PC], ['tel', TEL]]){
    const { ctx, mundo: m } = await contexto(nav, disp);
    // Una instalación de Lucía viene de un cambio de categoría (migración)
    const c = m.datos.clientes.find((x) => x.lider === 'Lucía Ferrer' && (x.instalaciones || []).length); c.instalaciones[0].cambio_id = 77;
    const l = await entrar(ctx, 'lucia', '739105'); l.on('pageerror', (e) => errores.push(nombre + ' líder: ' + e.message));
    await l.goto(H + 'comisiones.html'); await l.waitForSelector('#lista .cx-grupo', { timeout: 15000 });
    const fs = await l.$$eval('#filtros > button', (bs) => bs.map((b) => b.dataset.filtro));
    ok(nombre + ': el líder ve los filtros de estado a la vista, sin Más filtros', fs.join() === 'todos,comisionan,legal,pago,carta,migraciones' && (await l.locator('#filtros .cx-mas').count()) === 0, fs);
    ok(nombre + ': sin la tarjeta Cambios de categoría', !/Cambios de categor/.test(await l.textContent('#segs')));
    ok(nombre + ': la migración sale dentro de su lista con la etiqueta Migración', (await l.locator('#lista .cx-grupo .chip.azul', { hasText: 'Migración' }).count()) >= 1);
    await l.click('#filtros [data-filtro="migraciones"]'); await l.waitForTimeout(200);
    ok(nombre + ': el filtro Migraciones deja solo las migraciones', (await l.locator('#lista [data-com]').count()) >= 1 && (await l.locator('#lista [data-com]').count()) === (await l.locator('#lista .chip.azul', { hasText: 'Migración' }).count()));
    await l.click('#cxMasBtn');
    ok(nombre + ': el ··· del líder trae Fechas y Del corte anterior', (await l.locator('#acciones [data-cx-rango]').count()) >= 4 && /Del corte anterior/.test(await l.textContent('#acciones')));
    await l.keyboard.press('Escape');
    ok(nombre + ': al líder no le llegan las instalaciones de aliados', !(await l.locator('#lista .chip.morado').count()));
    // Resumen del líder: solo lo suyo
    await l.goto(H + 'comisiones.html?v=resumen'); await l.waitForSelector('.cr2-k', { timeout: 15000 });
    const rl = await l.textContent('.cr2-r');
    ok(nombre + ': el Resumen del líder trae sus números, su posición y lo que pierde el día límite', /Tus instaladas del corte/.test(rl) && /Vas \d+\.º de \d+/.test(rl) && /Te falta para cobrar/.test(rl) && /Se pierden el/.test(rl));
    ok(nombre + ': el líder no ve Equipos, Dinero del corte, Cartas ni el ranking de los demás', !/Equipos|Dinero del corte|Cartas y proformas|Ranking del corte/.test(rl));
    ok(nombre + ': sin desborde (líder)', await sinDesborde(l));

    // Administrador
    const c2 = await contexto(nav, disp, m); const a = await entrar(c2.ctx, 'marcos', '482913'); a.on('pageerror', (e) => errores.push(nombre + ' admin: ' + e.message));
    await a.goto(H + 'comisiones.html'); await a.waitForSelector('#lista .cx-grupo', { timeout: 15000 });
    ok(nombre + ': el administrador tiene la pastilla Migraciones y no la tarjeta', (await a.locator('#filtros [data-filtro="migraciones"]').count()) === 1 && !/Cambios de categor/.test(await a.textContent('#segs')));
    await a.goto(H + 'comisiones.html?t=cambios'); await a.waitForSelector('#lista', { timeout: 15000 }); await a.waitForTimeout(400);
    ok(nombre + ': un enlace viejo a Cambios de categoría abre el filtro Migraciones', (await a.getAttribute('#filtros [data-filtro="migraciones"]', 'aria-selected')) === 'true');
    await a.goto(H + 'comisiones.html?v=resumen'); await a.waitForSelector('.cr2-k', { timeout: 15000 });
    const ra = await a.textContent('.cr2-r');
    ok(nombre + ': el Resumen trae Ganadores, tarjetas de Ventas corporativas, Ranking, Equipos con Sin dueño, Instaladas por corte, Órdenes y Dinero',
      /Ganadores de/.test(ra) && /Instaladas del corte · Ventas corporativas/.test(ra) && /Ranking del corte/.test(ra) && /Sin dueño/.test(ra) && /Ritmo del corte/.test(ra) && /Órdenes por instalar/.test(ra) && /Dinero del corte/.test(ra) && /posibles/.test(ra));
    ok(nombre + ': el ritmo es una línea por día', (await a.locator('.cr2-svg polyline').count()) >= 2);
    await a.click('[data-cr-vs="cerrados"]');
    ok(nombre + ': Cortes cerrados con Comisionaron, Pasaron y Se perdieron', /Comisionaron/.test(await a.textContent('.cr2-r')) && /Pasaron al siguiente/.test(await a.textContent('.cr2-r')));
    await a.click('[data-cr-rk="aliados"]');
    ok(nombre + ': el ranking cambia a Aliados comerciales', /Instaladas por aliado/.test(await a.textContent('.cr2-r')));
    await a.click('.cr2-pi .perd'); await a.waitForSelector('.hoja.ver', { timeout: 10000 });
    ok(nombre + ': Perdidas abre su detalle', true);
    ok(nombre + ': sin desborde (administrador)', await sinDesborde(a));
    await c2.ctx.close(); await ctx.close();
  }
  ok('sin errores de página', errores.length === 0); if(errores.length) console.log(errores.join('\n'));
  await nav.close(); cerrar();
})();
