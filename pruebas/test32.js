// Corrida 14/10, módulo Migraciones: los cambios salen de Comisiones a su propio módulo; ningún cambio entra solo a comisión
// (confirmado a PYME queda "Comisión por decidir" y el Senior o el administrador dicen Sí o No con motivo); un cambio de antes de la
// fecha mínima (21/09/2026) queda solo como registro; pestaña Negativos; Comisiones solo muestra el aviso; Inicio y Mi trabajo llevan aquí.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { RPC } = require('./mundo');
const { ok, cerrar } = marcador();
const llamo = (m, f) => m.llamadas.filter((l) => l[1] === f);
async function cerrarHojas(p){ for(let i = 0; i < 5 && await p.evaluate(() => !!window.Comun.hojaAbierta()); i++){ await p.keyboard.press('Escape'); await p.waitForTimeout(260); } }
function sembrar(m){
  const adm = m.personas.find((p) => p.rol === 'admin'); const lucia = m.personas.find((p) => p.usuario === 'lucia');
  const k = RPC.tad_indice_iniciar(m, adm, { p_archivo: 'tad.csv', p_total: 1 });
  RPC.tad_indice_parte(m, adm, { p_carga: k, p_filas: [{ s: '824', c: '777001', t: 'J', d: 'J-41777001-2', n: 'Panaderia Inventada Uno', p: 'HOGAR 300', ca: 'RESIDENCIAL', es: 'ACTIVO', di: 'Calle Falsa 1', pon: 'PONX-1' }] });
  RPC.tad_indice_cerrar(m, adm, { p_carga: k });
  RPC.cambios_archivo_cargar(m, adm, { p_archivo: 'cambios.xlsx', p_filas: [
    { codigo: '777050', nombre: 'Ferreteria Inventada', fecha: '13-10-2026', anterior: 'RESIDENCIAL', actual: 'PYME-1GB', operador: 'Ana' },
    { codigo: '777051', nombre: 'Bodega Vieja Inventada', fecha: '10-09-2026', anterior: 'RESIDENCIAL', actual: 'PYME-1GB', operador: 'Ana' },
    { codigo: '777052', nombre: 'Taller Inventado', fecha: '12-10-2026', anterior: 'PYME-1GB', actual: 'RESIDENCIAL', operador: 'Ana' }] });
  m.datos.cambiosK.filas.filter((c) => /Ferreteria|Bodega/.test(c.titular.nombre)).forEach((c) => RPC.cambio_accion(m, adm, { p_id: c.id, p_accion: 'vincular', p_lider: lucia.id }));
}

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo); sembrar(mundo);
    // ----- Analista Senior: Inicio y Mi trabajo llevan a Migraciones -----
    const p = await entrar(ctx, 'elena', '315806'); p.on('pageerror', (e) => errores.push(e.message));
    await p.waitForSelector('#zonaPendientes [data-pend="tr_decidir"]');
    ok(nombre + ': Inicio del Senior avisa los cambios con la comisión por decidir y lleva a Migraciones', /1 cambio con la comisión por decidir/.test(await p.textContent('#zonaPendientes')) && (await p.getAttribute('[data-pend="tr_decidir"]', 'href')) === 'migraciones.html?f=decidir');
    ok(nombre + ': Migraciones es un módulo en Inicio (ya no "En construcción")', (await p.locator('#zonaModulos a[data-modulo="migraciones"]').count()) === 1 && (await p.locator('#zonaModulos .pronto[data-modulo="migraciones"]').count()) === 0);
    await p.goto(H + 'trabajo.html?f=decidir'); await p.waitForSelector('#lista .tr-f');
    ok(nombre + ': Mi trabajo del Senior tiene la pestaña Comisión por decidir', (await p.getAttribute('#filtros [data-tab="decidir"]', 'aria-selected')) === 'true' && /Ferreteria Inventada/.test(await p.textContent('#lista')));
    await p.locator('#lista .tr-f [data-abrir]').first().click(); await p.waitForURL('**/migraciones.html**'); await p.waitForSelector('#hojaCambio.ver #cCam .estado');
    ok(nombre + ': tocar el pendiente abre Migraciones en la pestaña y el cambio', (await p.getAttribute('#filtros [data-camtab="decidir"]', 'aria-selected')) === 'true' && /Por decidir/.test(await p.textContent('#cCam')));
    // Sí sin motivo: error debajo; con motivo: comisiona y queda en la bitácora
    await p.click('[data-cam-com="si"]');
    ok(nombre + ': decidir sin motivo da error debajo', /Escribe el motivo/.test(await p.textContent('#eCamMotivo')) && llamo(mundo, 'cambio_comision').length === 0);
    await p.screenshot({ path: 'capturas/32-' + nombre + '-decidir.png' });
    await p.fill('#camMotivo', 'Migración real de un cliente nuevo'); await p.click('[data-cam-com="si"]');
    await p.waitForFunction(() => /Marcó que comisiona/.test(document.getElementById('cCam').textContent));
    ok(nombre + ': Sí comisiona con motivo, con quién y cuándo', llamo(mundo, 'cambio_comision').slice(-1)[0][2].p_si === true && /Comisiona/.test(await p.textContent('#cCam')) && /Migración real/.test(await p.textContent('#cCam')));
    await p.fill('#camMotivo', 'El cliente lo devolvió'); await p.click('[data-cam-com="no"]');
    await p.waitForFunction(() => /Marcó que no comisiona/.test(document.getElementById('cCam').textContent));
    ok(nombre + ': Quitar la comisión también pide motivo y lo anota', llamo(mundo, 'cambio_comision').slice(-1)[0][2].p_si === false && /No comisiona/.test(await p.textContent('#cCam .estado')));
    await cerrarHojas(p);
    // Fecha mínima: el de septiembre queda solo como registro
    await p.click('#filtros [data-camtab="confirmado"]'); await p.locator('[data-cambio]', { hasText: 'Bodega Vieja' }).click(); await p.waitForSelector('#hojaCambio.ver #cCam .estado');
    ok(nombre + ': un cambio de antes del 21/09 queda solo como registro, sin Sí ni No', /Solo registro/.test(await p.textContent('#cCam')) && (await p.locator('[data-cam-com]').count()) === 0);
    await cerrarHojas(p);
    // Negativos
    await p.click('#filtros [data-camtab="negativos"]');
    ok(nombre + ': la pestaña Negativos muestra PYME a otra categoría', /Taller Inventado/.test(await p.textContent('#lista')) && /PYME a otra categoría/.test(await p.textContent('#lista')));
    ok(nombre + ': sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/32-' + nombre + '-negativos.png', fullPage: true });
    // ----- Líder: ve el resultado pero no decide; Migraciones en su barra del teléfono -----
    const c2 = await contexto(nav, dispositivo, mundo); const q = await entrar(c2.ctx, 'lucia', '739105'); q.on('pageerror', (e) => errores.push(e.message));
    await q.goto(H + 'migraciones.html?f=confirmado'); await q.waitForSelector('#lista [data-cambio]');
    ok(nombre + ': el líder ve si comisiona pero no puede decidir', /No comisiona/.test(await q.textContent('#lista')) && (await q.locator('#filtros [data-camtab="decidir"]').count()) === 0);
    if(nombre === 'tel') ok('tel: el líder tiene Migraciones en la barra de abajo', (await q.locator('#navAbajo a[href="migraciones.html"]').count()) === 1 && (await q.locator('#navAbajo a').count()) <= 5);
    await q.goto(H + 'comisiones.html'); await q.waitForSelector('#vistas [data-vista="corte"]'); await q.waitForTimeout(400);
    ok(nombre + ': el líder no ve el aviso de cambios por decidir (no decide)', (await q.locator('#avisoCam .cam-dec').count()) === 0);
    await c2.ctx.close();
    // ----- Administrador: Comisiones solo avisa; barra del teléfono sin pasar de 5 -----
    RPC.cambio_accion(mundo, mundo.personas[0], { p_id: mundo.datos.cambiosK.filas.find((c) => /Taller/.test(c.titular.nombre)).id, p_accion: 'vincular', p_lider: '22222222-2222-4222-8222-222222222222' });
    const c3 = await contexto(nav, dispositivo, mundo); const r = await entrar(c3.ctx, 'marcos', '482913'); r.on('pageerror', (e) => errores.push(e.message));
    const ferr = mundo.datos.cambiosK.filas.find((c) => /Ferreteria/.test(c.titular.nombre)); ferr.comision = 'por_decidir';
    await r.goto(H + 'comisiones.html'); await r.waitForSelector('#avisoCam .cam-dec');
    ok(nombre + ': Comisiones ya no tiene la pestaña Cambios y avisa los cambios por decidir', (await r.locator('#vistas [data-vista="cambios"]').count()) === 0 && /1 cambio por decidir/.test(await r.textContent('#avisoCam')) && (await r.getAttribute('#avisoCam .cam-dec', 'href')) === 'migraciones.html?f=decidir');
    await r.screenshot({ path: 'capturas/32-' + nombre + '-comisiones.png' });
    if(nombre === 'tel') ok('tel: la barra del administrador no pasa de 5 (Migraciones desde Inicio)', (await r.locator('#navAbajo a').count()) === 5 && (await r.locator('#navAbajo a[href="migraciones.html"]').count()) === 0);
    else ok('pc: Migraciones está en el menú de arriba y el menú cabe en una línea', (await r.locator('.navpc a[href="migraciones.html"]').count()) === 1 && await r.evaluate(() => [...document.querySelectorAll('.navpc a')].every((a) => a.getBoundingClientRect().height <= 44)));
    await c3.ctx.close(); await ctx.close();
  }
  ok('sin errores de la página', errores.length === 0, errores);
  await nav.close(); cerrar();
})();
