// Lote 13/11, partes 8 y 9: Comisiones con los filtros en dos renglones (buscador · Equipo · Fechas · Por dueño | Por fecha · ···)
// y "Enviar pendientes" al lado del nombre del líder: el administrador, la Senior con todos y la analista solo con sus líderes;
// el líder no lo ve. Teléfono y PC.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar, ddAbrir, ddClick } = require('./simulador');
const { ok, cerrar } = marcador();
const ANA = { id: '12121212-1212-4121-8121-121212121212', usuario: 'ana', pin: '520391', nombre: 'Ana Prueba', rol: 'analista', cargo: 'Analista de canales', equipo: 'ambos', codigo_vendedor: null, nombre_odoo: null, activo: true, debe_cambiar_pin: false };

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, disp] of [['pc', PC], ['tel', TEL]]){
    const pc = nombre === 'pc';
    const { ctx, mundo: m } = await contexto(nav, disp);
    m.personas.push(Object.assign({}, ANA)); m.personas.find((x) => x.usuario === 'lucia').analista_id = ANA.id;
    await ctx.route('https://wa.me/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'chat' }));
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(nombre + ': ' + e.message));
    await p.goto(H + 'comisiones.html'); await p.waitForSelector('#lista .cx-grupo', { timeout: 15000 });

    // ----- Parte 8 -----
    ok(nombre + ': sin recuadro ni etiquetas EQUIPO y VER', (await p.locator('.cx-rot').count()) === 0 && (await p.locator('.cx-p2').evaluate((x) => getComputedStyle(x).borderTopWidth)) === '0px');
    const r1 = await p.textContent('#cxT1');
    ok(nombre + ': renglón 1 con Equipo, Fechas, Por dueño | Por fecha y ···', /Equipo:\s*Todos/.test(r1) && /Fechas:\s*todo el corte/.test(r1) && /Por dueño/.test(r1) && /Por fecha/.test(r1) && (await p.locator('#cxMasBtn').count()) === 1);
    if(pc) ok('pc: el renglón 1 mide 44 px de alto', Math.round((await p.locator('#cxEqBtn').boundingBox()).height) === 44);
    const r2 = await p.$$eval('#filtros > button', (bs) => bs.map((b) => b.dataset.filtro));
    ok(nombre + ': renglón 2 con Todas, Comisionan, Faltan documentos, Falta el pago y Carta por enviar; Les falta algo en Más filtros', r2.slice(0, 5).join() === 'todos,comisionan,legal,pago,carta' && /Faltan documentos/.test(await p.textContent('#filtros')) && /Falta el pago/.test(await p.textContent('#filtros')) && (await p.locator('#filtros .cx-mas [data-filtro="falta"]').count()) === 1);
    await p.click('#cxEqBtn');
    ok(nombre + ': Equipo abre la lista de equipos con sus números y la gente bajo Persona', await p.locator('#equipos').isVisible() && (await p.locator('#equipos [data-equipo]').count()) >= 4 && (await p.locator('#equipos [data-persona]').count()) >= 2);
    await p.keyboard.press('Escape'); ok(nombre + ': Escape lo cierra', !(await p.locator('#equipos').isVisible()));
    await ddClick(p, '#equipos [data-equipo="corporativas"]');
    ok(nombre + ': elegir un equipo cierra el desplegable y lo dice el botón', !(await p.locator('#equipos').isVisible()) && /Ventas corporativas/.test(await p.textContent('#cxEqBtn')) && p.url().includes('e=corporativas'));
    await ddClick(p, '#equipos [data-equipo="todos"]');
    await ddClick(p, '[data-cx-rango="semana"]');
    ok(nombre + ': Fechas: Esta semana pone Desde y Hasta en la dirección', /desde=\d{4}-\d{2}-\d{2}/.test(p.url()) && /hasta=/.test(p.url()) && /esta semana/.test(await p.textContent('#cxFeBtn')));
    await ddClick(p, '[data-cx-rango=""]');
    ok(nombre + ': Todo el corte quita las fechas', !/desde=/.test(p.url()));
    await p.click('#cxMasBtn');
    ok(nombre + ': ··· trae Bajar Excel y Días para el pago', await p.locator('#acciones #bajarExcel').isVisible() && await p.locator('#acciones #pagoDiasAbrir').isVisible());
    await p.keyboard.press('Escape');
    ok(nombre + ': sin desborde', await sinDesborde(p));

    // ----- Parte 9: administrador -----
    const cab = p.locator('#lista .cx-grupo[data-lider="Lucía Ferrer"] .cx-gcab');
    ok(nombre + ': Enviar pendientes va en la cabecera, al lado del nombre', (await cab.locator('.cx-env[data-pend]').count()) === 1 && (await p.locator('.pend-barra').count()) === 0);
    ok(nombre + ': Sin dueño no lleva el botón', (await p.locator('#lista .cx-grupo[data-lider="Por asignar"] [data-pend]').count()) === 0);
    const ab0 = await p.locator('#lista .cx-grupo[data-lider="Lucía Ferrer"]').getAttribute('class');
    await cab.locator('.cx-env').click(); await p.waitForSelector('#hojaPend.ver, .hoja.ver #pendEnviar', { timeout: 10000 });
    ok(nombre + ': tocar el botón no abre ni cierra el grupo', (await p.locator('#lista .cx-grupo[data-lider="Lucía Ferrer"]').getAttribute('class')) === ab0);
    ok(nombre + ': el mensaje firma con quien envía', /Gracias\.\s*Marcos/.test(await p.evaluate(() => (document.querySelector('.hoja.ver textarea') || {}).value || document.querySelector('.hoja.ver').textContent)));
    await p.click('#pendEnviar'); await p.waitForTimeout(600);
    const bit = (m.bitacora || []).filter((b) => b.accion === 'pendientes_enviados').pop();
    ok(nombre + ': la bitácora guarda quién envió', bit && bit.por === 'Marcos Rivas');
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    ok(nombre + ': después dice el último envío y quién', /hoy, Marcos/.test(await cab.locator('.cx-env').textContent()));
    await ctx.close();

    // ----- La analista: solo con los líderes que lleva -----
    const c2 = await contexto(nav, disp, m); const a = await entrar(c2.ctx, 'ana', ANA.pin); a.on('pageerror', (e) => errores.push(nombre + ' analista: ' + e.message));
    await a.goto(H + 'comisiones.html'); await a.waitForSelector('#lista .cx-grupo', { timeout: 15000 });
    const conBoton = await a.$$eval('#lista .cx-grupo [data-pend]', (bs) => bs.map((b) => b.dataset.pend));
    ok(nombre + ': la analista lo ve solo con su líder', conBoton.length >= 1 && conBoton.every((x) => x === 'Lucía Ferrer'), conBoton);
    await c2.ctx.close();
    // ----- El líder no lo ve, y no tiene Equipo ni Por dueño | Por fecha -----
    const c3 = await contexto(nav, disp, m); const l = await entrar(c3.ctx, 'lucia', '739105'); l.on('pageerror', (e) => errores.push(nombre + ' líder: ' + e.message));
    await l.goto(H + 'comisiones.html'); await l.waitForSelector('#lista .cx-grupo, #lista .vacio', { timeout: 15000 });
    ok(nombre + ': el líder no ve Enviar pendientes', (await l.locator('[data-pend]').count()) === 0);
    ok(nombre + ': el líder no tiene Equipo ni Por dueño | Por fecha; las fechas están en ···', !(await l.locator('#cxEqBtn').isVisible()) && !(await l.locator('#cxSeg').isVisible()) && (await l.locator('#acciones [data-cx-rango]').count()) >= 4);
    await c3.ctx.close();
  }
  ok('sin errores de página', errores.length === 0); if(errores.length) console.log(errores.join('\n'));
  await nav.close(); cerrar();
})();
