// Lote 12/11 B, parte 2: arriba de Comisiones (maqueta comisiones-hoja.html 1, 6a, 6b y 8d), filtros que se suman y mensaje al líder. Datos inventados.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['pc', PC], ['tel', TEL]]){
    const { ctx } = await contexto(nav, dispositivo);
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(nombre + ': ' + e.message));
    await p.goto(H + 'comisiones.html'); await p.waitForSelector('#equipos [data-equipo]', { timeout: 15000 });
    ok(nombre + ': sin las tarjetas grandes de antes', (await p.locator('.cx-al').count()) === 0);
    ok(nombre + ': "+ Cliente nuevo" en la fila del título', (await p.locator('.cabeza #cxNuevo [data-abrir="nuevo"]').count()) === 1 && /Cliente nuevo/.test(await p.textContent('#cxNuevo')));
    const av = await p.textContent('#alertas');
    ok(nombre + ': la línea de avisos dice órdenes de 24 h y sin dueño con su enlace', /pasan? de 24 h sin instalar/.test(av) && /Ver órdenes/.test(av) && /sin dueño/.test(av) && /Asignar dueño/.test(av));
    ok(nombre + ': sin desborde arriba', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/lote12novB-p2-arriba-' + nombre + '.png' });
    // Cada número cuenta igual que la lista (lista por fecha, todas visibles)
    await p.click('[data-vista="fecha"]'); await p.waitForSelector('.cx-lfecha');
    await p.click('#filtros [data-filtro="falta"]'); await p.waitForTimeout(150);
    const nChip = Number((await p.textContent('#filtros [data-filtro="falta"] em')).trim()); const nFilas = await p.locator('.cx-lfecha .cx-lf[data-com]').count();
    const nEq = Number((await p.textContent('#equipos .cx-eq.on .cnt')).trim());
    ok(nombre + ': la pastilla y el equipo cuentan igual que la lista', nChip === nFilas && nEq === nFilas, [nChip, nEq, nFilas]);
    // Con fechas sin resultados: "Nada … en estas fechas" y "Ver las N sin fechas"; Mostrando con Quitar todo
    await p.fill('#cxDesde', '2020-01-01'); await p.dispatchEvent('#cxDesde', 'change'); await p.fill('#cxHasta', '2020-01-02'); await p.dispatchEvent('#cxHasta', 'change'); await p.waitForTimeout(200);
    ok(nombre + ': sin nada en esas fechas dice cuántas hay en todo el corte', /Nada pendiente en estas fechas/.test(await p.textContent('#lista')) && /Hay \d+ pendiente en todo el corte/.test(await p.textContent('#lista')) && (await p.locator('#lista [data-sin-fechas]').count()) === 1);
    const mo = await p.textContent('#ayudaFiltro .cx-mostrando');
    ok(nombre + ': "Mostrando" lista los filtros puestos con Quitar todo', /Mostrando/.test(mo) && /Les falta algo/.test(mo) && /01\/01 al 02\/01/.test(mo) && /Quitar todo/.test(mo));
    ok(nombre + ': con las fechas, la pastilla cuenta 0 igual que la lista', /\b0\b/.test(await p.textContent('#filtros [data-filtro="falta"]')));
    await p.click('#lista [data-sin-fechas]'); await p.waitForTimeout(150);
    ok(nombre + ': "Ver las N sin fechas" quita solo las fechas', (await p.locator('.cx-lfecha .cx-lf[data-com]').count()) === nFilas && p.url().includes('f=falta'));
    // El filtro no se pierde al abrir y cerrar el drawer
    await p.locator('.cx-lfecha .cx-lf[data-com]').first().click(); await p.waitForSelector('#hojaComision.ver #cuerpoCom .plg-com', { timeout: 15000 });
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    ok(nombre + ': el filtro elegido sigue después de cerrar el drawer', p.url().includes('f=falta') && (await p.getAttribute('#filtros [data-filtro="falta"]', 'aria-selected')) === 'true');
    await p.click('#ayudaFiltro [data-quitar-todo]'); await p.waitForTimeout(150);
    ok(nombre + ': Quitar todo deja todo como al entrar', !p.url().includes('f=') && (await p.locator('#ayudaFiltro .cx-mostrando').count()) === 0);
    // Aliado: pastilla al lado de "Aliado comercial" solo con ese equipo
    ok(nombre + ': con Todos no sale "Aliado: todos"', (await p.locator('#cxAliado').count()) === 0);
    // Mensaje al líder (contacto.js)
    const m = await p.evaluate(() => { const M = window.Contacto.mensaje; const q = { nombre: 'Carla Prueba' };
      return [M({ motivo: 'docs_faltan', cliente: 'Cliente Uno', detalle: { todos: true, faltan: 4 } }, q),
        M({ motivo: 'docs_faltan', cliente: 'Cliente Uno', detalle: { faltan: 2, lista: [{ k: 'rif_personal' }, { k: 'cedula' }] } }, q),
        M({ motivo: 'docs_faltan', cliente: 'Cliente Uno', detalle: { faltan: 5, lista: [{ k: 'a' }, { k: 'b' }, { k: 'c' }, { k: 'd' }, { k: 'e' }] } }, q),
        M({ motivo: 'com_legal_docs_faltan', cliente: 'Cliente Uno', detalle: { todos: true, cierra: '2026-11-18' } }, q)]; });
    ok(nombre + ': mensaje "le faltan todos los documentos"', m[0] === 'Hola Carla, a Cliente Uno le faltan todos los documentos en la app. ¿Me ayudas a conseguirlos?', m[0]);
    ok(nombre + ': mensaje con nombres "el RIF y la cédula del representante"', /le faltan el RIF y la cédula del representante en la app/.test(m[1]), m[1]);
    ok(nombre + ': mensaje con muchos: "le faltan 5 documentos"', /le faltan 5 documentos en la app/.test(m[2]), m[2]);
    ok(nombre + ': desde Comisiones, igual y con el cierre del corte', /le faltan todos los documentos en la app\. ¿Me ayudas a conseguirlos\? Cierra el corte el/.test(m[3]), m[3]);
    await ctx.close();
  }
  ok('sin errores de JavaScript', errores.length === 0, errores.slice(0, 3));
  await nav.close(); cerrar();
})();
