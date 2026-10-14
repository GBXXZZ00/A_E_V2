// Lote 6 (14/10): una sola fuente de pendientes. Mi trabajo para el analista (con lo del Senior), el líder y el administrador
// (filtro por persona, Aliados y días límite). Desde la corrida 14/10 tarde: por módulo, sin Hecho, contadores en Inicio y en el menú
// y el analista de cada líder en Usuarios.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
const llamo = (m, f) => m.llamadas.filter((l) => l[1] === f);
async function cerrarHojas(p){ for(let i = 0; i < 5 && await p.evaluate(() => !!window.Comun.hojaAbierta()); i++){ await p.keyboard.press('Escape'); await p.waitForTimeout(260); } }

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    // ----- Analista Senior -----
    const p = await entrar(ctx, 'elena', '315806'); p.on('pageerror', (e) => errores.push(e.message));
    await p.waitForSelector('#zonaPendientes .pf, #zonaPendientes .linea-info');
    const ini = await p.textContent('#zonaPendientes');
    ok(nombre + ': Inicio cuenta por módulo desde la bandeja (Comisiones con su vencido, Migraciones que vence hoy)', /Comisiones: 3 pendientes/.test(ini) && /1 vencido/.test(ini) && /Migraciones: 1 pendiente/.test(ini) && /vence hoy/.test(ini));
    ok(nombre + ': Inicio no repite las bienvenidas aparte', !/bienvenidas? por enviar/.test(ini));
    ok(nombre + ': el módulo Mi trabajo está en Inicio con el total', /Mi trabajo/.test(await p.textContent('#zonaModulos')) && /4 pendientes/.test(await p.textContent('#zonaModulos')));
    if(nombre === 'pc') ok('pc: el menú de arriba lleva el contador de Mi trabajo y de Comisiones (rojo si hay vencidos)', (await p.textContent('.navpc [data-nav="trabajo"] .nbadge')) === '4' && (await p.getAttribute('.navpc [data-nav="comisiones"] .nbadge', 'class')).includes('rojo'));
    else ok('tel: la barra de abajo lleva el contador de Comisiones', (await p.textContent('#navAbajo [data-nav="comisiones"] .nbadge')) === '3');
    await p.click('#zonaPendientes [data-pend="tr_comisiones"]'); await p.waitForSelector('#lista .tr-f');
    ok(nombre + ': el contador lleva a su módulo', (await p.getAttribute('#filtros [data-tab="comisiones"]', 'aria-selected')) === 'true' && (await p.locator('#lista .tr-f').count()) === 3);
    const subs = await p.textContent('#subs');
    ok(nombre + ': dentro del módulo, un chip por tipo con su número', /Por enviar\s*1/.test(subs) && /Sin IP\s*1/.test(subs) && /Para certificar\s*1/.test(subs));
    const grupos = await p.$$eval('#lista .tr-gt', (xs) => xs.map((x) => x.textContent));
    ok(nombre + ': dentro, primero lo vencido, después lo nuevo y lo que va a tiempo', grupos[0].startsWith('Vencido') && grupos.some((g) => g.startsWith('Nuevo')) && grupos.some((g) => g.startsWith('A tiempo')));
    await p.click('#subs [data-sub="sin_ip"]');
    ok(nombre + ': el chip filtra y dice cómo sale solo', (await p.locator('#lista .tr-f').count()) === 1 && /Sale al escribir la IP/.test(await p.textContent('#ayuda')));
    await p.click('#filtros [data-tab="todo"]');
    const hoy = await p.textContent('#lista');
    ok(nombre + ': Todo muestra todo, lo vencido primero', (await p.locator('#lista .tr-f').count()) === 4 && (await p.locator('#lista .tr-f').first().locator('.pto.rojo').count()) === 1 && /Venció hace/.test(hoy));
    ok(nombre + ': el Senior ve Para certificar dentro de Comisiones', /Para certificar/.test(hoy));
    ok(nombre + ': lo que vence hoy sale en ámbar y lo nuevo con su etiqueta', /Vence hoy/.test(hoy) && /Nuevo/.test(hoy));
    ok(nombre + ': ya no hay botón Hecho', (await p.locator('[data-hecho], #hojaHecho').count()) === 0 && !/\bHecho\b/.test(await p.textContent('main')));
    ok(nombre + ': sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/30-' + nombre + '-analista.png', fullPage: true });
    // Enlaces viejos a una bandeja
    await p.goto(H + 'trabajo.html?f=enviar'); await p.waitForSelector('#lista .tr-f');
    ok(nombre + ': un enlace viejo (?f=enviar) abre Comisiones con Por enviar', (await p.getAttribute('#filtros [data-tab="comisiones"]', 'aria-selected')) === 'true' && (await p.locator('#lista .tr-f').count()) === 1);
    // Tocar un pendiente abre el expediente encima
    await p.locator('#lista .tr-f', { hasText: 'Proforma y carta' }).locator('[data-abrir]').click(); await p.waitForSelector('#hojaFicha.ver');
    ok(nombre + ': tocar un pendiente abre el expediente como hoja', await p.evaluate(() => window.Comun.hojasAbiertas().indexOf('hojaFicha') >= 0));
    await cerrarHojas(p);

    // ----- Líder -----
    const c2 = await contexto(nav, dispositivo, mundo); const q = await entrar(c2.ctx, 'lucia', '739105'); q.on('pageerror', (e) => errores.push(e.message));
    await q.goto(H + 'trabajo.html'); await q.waitForSelector('#lista .tr-f');
    const tabs = await q.textContent('#filtros');
    ok(nombre + ': el líder ve sus módulos con algo (Expedientes) y no Comisiones ni los vacíos', ['Todo', 'Expedientes'].every((x) => tabs.includes(x)) && !tabs.includes('Comisiones') && !tabs.includes('Migraciones'));
    ok(nombre + ': el líder solo ve lo suyo', (await q.locator('#lista .tr-f').count()) === 2 && !(await q.textContent('#lista')).includes('Falta la IP'));
    await q.screenshot({ path: 'capturas/30-' + nombre + '-lider.png', fullPage: true });
    await c2.ctx.close();

    // ----- Administrador: todo, filtro por persona, Aliados, días límite y analista de cada líder -----
    const c3 = await contexto(nav, dispositivo, mundo); const r = await entrar(c3.ctx, 'marcos', '482913'); r.on('pageerror', (e) => errores.push(e.message));
    await r.goto(H + 'trabajo.html'); await r.waitForSelector('#lista .tr-f');
    ok(nombre + ': el administrador ve todo y puede filtrar por persona', !(await r.locator('#zonaPersona').isHidden()) && (await r.locator('#lista .tr-f').count()) === 6);
    await r.selectOption('#persona', { label: 'Lucía Ferrer (líder)' }); await r.waitForFunction(() => document.querySelectorAll('#lista .tr-f').length >= 1 && /persona/.test(location.search + 'persona'));
    ok(nombre + ': el filtro por persona pide al servidor solo esa persona', llamo(mundo, 'trabajo').some((l) => l[2].p_persona === '22222222-2222-4222-8222-222222222222'));
    await r.click('#filtros [data-tab="aliados"]'); await r.waitForSelector('.tr-al-k');
    ok(nombre + ': la pestaña Aliados lleva a solicitudes, pagos y sin autorización', (await r.locator('.tr-al-k').count()) === 4 && (await r.getAttribute('.tr-al-k[href*="sinp"]', 'href')).includes('aliados.html'));
    await r.click('.tr-dias > summary'); await r.fill('#dias_por_enviar', '0'); await r.click('[data-dias="dias_por_enviar"]');
    await r.waitForFunction(() => /mayor que cero/.test(document.getElementById('e_dias_por_enviar').textContent));
    ok(nombre + ': un día límite inválido da error debajo', true);
    await r.fill('#dias_por_enviar', '4'); await r.click('[data-dias="dias_por_enviar"]'); await r.waitForTimeout(400);
    ok(nombre + ': el día límite se guarda', llamo(mundo, 'ajuste_guardar').some((l) => l[2].p_clave === 'dias_por_enviar' && l[2].p_valor === '4'));
    await r.screenshot({ path: 'capturas/30-' + nombre + '-admin.png', fullPage: true });
    // Usuarios: el analista del líder
    await r.goto(H + 'usuarios.html'); await r.waitForSelector('[data-usuario], .usuario, #lista button');
    await r.locator('#lista button', { hasText: 'Lucía Ferrer' }).first().click(); await r.waitForFunction(() => !document.getElementById('zonaAnalista').classList.contains('hidden') && document.querySelectorAll('#fAnalista option').length > 1);
    await r.selectOption('#fAnalista', { label: 'Elena Soto' }); await r.click('#guardar'); await r.waitForTimeout(500);
    ok(nombre + ': en Usuarios el administrador le pone el analista al líder', llamo(mundo, 'lider_analista').some((l) => l[2].p_analista === '66666666-6666-4666-8666-666666666666'));
    await c3.ctx.close(); await ctx.close();
  }
  ok('sin errores de la página', errores.length === 0, errores);
  await nav.close(); cerrar();
})();
