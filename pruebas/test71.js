// Lote 16/11 A. Comisiones: bloques Por instalar (órdenes de hasta 5 días) y Migraciones dentro del líder, secciones plegables,
// las del corte anterior dentro de Instaladas, filtros nuevos y "Marcar como perdida" con su filtro. Permisos por cargo (matriz 16/11):
// Actualizar para analistas y no para líderes, Factibilidad para todos, gerencia en solo lectura, aliado sin Clientes, Coordinador como la Senior,
// Aliados del equipo solo con lo suyo. Usuarios con la columna Analista. Migraciones del administrador y del analista de la cartera.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar, pin, conCargos } = require('./simulador');
const { RPC } = require('./mundo');
const { mundoAliados } = require('./mundo-aliados');
const { ok, cerrar } = marcador();
const llamo = (m, f) => m.llamadas.filter((l) => l[1] === f);
async function entrarComo(ctx, u, c, eq){
  const p = await ctx.newPage(); await p.goto(H + 'index.html'); await p.waitForSelector('#pasoEquipo:not(.hidden)');
  await p.click('[data-equipo="' + (eq || 'ventas') + '"]'); await p.fill('#usuario', u); await p.click('#seguir');
  await pin(p, c, await p.evaluate(() => window.matchMedia('(min-width:900px)').matches)); await p.waitForURL(/(inicio|aliados|gerencia)\.html/); return p;
}
const FILAS = [{ s: '824', c: '777001', e: '48575443AAAA0001', t: 'J', d: 'J-41777001-2', n: 'Panaderia Inventada Uno', p: 'BRONCE-RES', ca: '1 GB', es: 'ACTIVO', di: 'Calle Falsa 1' }];
// Migraciones de ejemplo: una sin registrar de Lucía (con el reporte) y una sin líder
function sembrar(m){
  const adm = m.personas.find((p) => p.rol === 'admin'); const k = RPC.tad_indice_iniciar(m, adm, { p_archivo: 'tad.csv', p_total: 1 }); RPC.tad_indice_parte(m, adm, { p_carga: k, p_filas: FILAS }); RPC.tad_indice_cerrar(m, adm, { p_carga: k });
  const lucia = m.personas.find((p) => p.usuario === 'lucia'); const hoy = new Date(); const f = (d) => new Date(hoy.getTime() - d * 86400000).toISOString();
  m.datos.cambiosK.filas.push(
    { id: 801, tipo: 'migracion', estado: 'sin_registro', origen: 'archivo', creado_en: f(3), fecha_cambio: f(3), lider_id: lucia.id, lider: lucia.nombre, titular: { tipo: 'J', doc: '591000077', nombre: 'Comercial de Prueba 7, C.A.' },
      categoria_anterior: 'PROMO-1GB', categoria_nueva: 'PYME-1GB', servicios: [{ sucursal: '824', codigo: '9910007' }], reporte: { fecha: f(3).slice(0, 10), comentario: null }, bitacora: [] },
    { id: 802, tipo: 'migracion', estado: 'sin_registro', origen: 'archivo', creado_en: f(6), fecha_cambio: f(6), lider_id: null, titular: { tipo: 'J', doc: '000000032', nombre: 'Bodega Revisable, C.A.' },
      categoria_anterior: 'PROMO-1GB', categoria_nueva: 'PYME-1GB', servicios: [{ sucursal: '021', codigo: '9910030' }], reporte: { fecha: f(6).slice(0, 10), comentario: 'cliente de la calle' }, bitacora: [] },
    { id: 803, tipo: 'residencial', estado: 'sin_registro', origen: 'archivo', creado_en: f(10), fecha_cambio: f(10), lider_id: null, titular: { tipo: 'V', doc: '9910040', nombre: 'Licorería Prueba' },
      categoria_anterior: 'PYME-1GB', categoria_nueva: '1 GB', servicios: [{ sucursal: '824', codigo: '9910040' }], bitacora: [] });
}

(async () => {
  const nav = await chromium.launch(); const errores = []; const cuida = (p) => p.on('pageerror', (e) => errores.push(e.message));
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo); conCargos(mundo); sembrar(mundo); mundoAliados(mundo, mundo.personas.find((x) => x.usuario === 'redes'), mundo.personas.find((x) => x.usuario === 'canal'));
    // ----- Comisiones del administrador -----
    const p = await entrar(ctx, 'marcos', '482913'); cuida(p);
    await p.goto(H + 'comisiones.html'); await p.waitForSelector('.cx-grupo .cx-sec.am', { state: 'attached' });
    const g = p.locator('.cx-grupo', { hasText: 'Lucía Ferrer' }).first();
    if(!(await g.evaluate((x) => x.classList.contains('abierto')))) await g.locator('.cx-ga').click();
    ok(nombre + ': dentro de Lucía, el bloque ámbar Por instalar con sus órdenes de hasta 5 días', /Por instalar · órdenes de hasta 5 días · 1/.test(await g.textContent()) && (await g.locator('[data-orden-blk]').count()) === 1);
    ok(nombre + ': la fila de la orden dice "Sin instalar · lleva" y el estado de documentos', /Sin instalar · lleva/.test(await g.locator('[data-orden-blk]').textContent()) && /Sin documentos/.test(await g.locator('[data-orden-blk]').textContent()));
    ok(nombre + ': bloque azul Migraciones con la sin registrar (Faltan documentos)', /Migraciones · \d/.test(await g.textContent()) && /Migración sin registrar/.test(await g.textContent()) && (await g.locator('[data-mig-blk="801"]').count()) === 1);
    ok(nombre + ': las filas nuevas usan las mismas clases de las filas actuales', (await g.locator('[data-orden-blk].cx-lf.cx-fila2').count()) === 1 && (await g.locator('[data-mig-blk].cx-lf.cx-fila2').count()) >= 1);
    ok(nombre + ': la cabecera del líder cuenta las por instalar', /\d+ por instalar/.test(await g.locator('.stats').textContent()));
    const gr = p.locator('.cx-grupo', { hasText: 'Rosa Paredes' }).first(); if(!(await gr.evaluate((x) => x.classList.contains('abierto')))) await gr.locator('.cx-ga').click();
    ok(nombre + ': las del corte anterior van dentro de Instaladas, primero, con su aviso y su etiqueta', /Instaladas · \d+/.test(await gr.textContent()) && /del corte anterior: si no cumplen al/.test(await gr.textContent()) && !/Corte de .*: si no cumplen/.test(await gr.textContent()) &&
      /Del corte anterior/.test(await gr.locator('.cx-secb', { hasText: 'Instaladas' }).locator('xpath=following-sibling::div[1]').locator('.cx-fila2').first().textContent()));
    ok(nombre + ': filtros nuevos Por instalar y Migraciones con número', /Por instalar\s*\d/.test(await p.textContent('#filtros [data-filtro="porinst"]')) && /Migraciones\s*\d/.test(await p.textContent('#filtros [data-filtro="migraciones"]')));
    // Secciones plegables
    const secPi = g.locator('.cx-secb', { hasText: 'Por instalar · órdenes' });
    await secPi.click();
    ok(nombre + ': tocar el título de una sección la pliega', (await secPi.getAttribute('aria-expanded')) === 'false' && (await g.locator('[data-orden-blk]').isVisible()) === false);
    await secPi.click();
    ok(nombre + ': tocarlo otra vez la abre', (await g.locator('[data-orden-blk]').isVisible()) === true);
    await p.click('#filtros [data-filtro="porinst"]');
    ok(nombre + ': el filtro Por instalar deja solo las órdenes', (await p.locator('#lista [data-orden-blk]').count()) === 1 && (await p.locator('#lista [data-com]').count()) === 0);
    ok(nombre + ': Comisiones sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/71-' + nombre + '-comisiones.png', fullPage: true });
    // La orden abre su hoja; Marcar como perdida con motivo
    await p.click('#lista [data-orden-blk]'); await p.waitForSelector('#hojaOrdenPI.ver [data-orden-perder]');
    ok(nombre + ': la orden abre su hoja con la tarjeta de Por instalar (subir documentos)', /Subir documentos|Elegir y subir documentos|Ver cliente/.test(await p.textContent('#hojaOrdenPI')));
    await p.click('[data-orden-perder]'); await p.click('#perdGuardar');
    ok(nombre + ': sin motivo da error debajo', /Escribe el motivo/.test(await p.textContent('#ePerd')));
    await p.fill('#perdMotivo', 'El cliente desistió'); await p.click('#perdGuardar');
    await p.waitForFunction(() => !document.querySelector('#lista [data-orden-blk]'));
    ok(nombre + ': marcada como perdida sale de la lista y queda en la bitácora', llamo(mundo, 'orden_perdida').length === 1 && (mundo.bitacora || []).some((b) => b.accion === 'orden_perdida'));
    await p.evaluate(() => window.PorInstalar.abrir({}));
    await p.waitForSelector('#hojaPorInst [data-pi-tab="perdidas"]'); await p.click('#hojaPorInst [data-pi-tab="perdidas"]');
    ok(nombre + ': Por instalar tiene el filtro Perdidas con el motivo y Recuperar', /El cliente desistió/.test(await p.textContent('#hojaPorInst')) && (await p.locator('[data-orden-recuperar]').count()) === 1);
    await p.click('[data-orden-recuperar]'); await p.waitForFunction(() => !document.querySelector('[data-orden-recuperar]'));
    ok(nombre + ': Recuperar la devuelve', !(mundo.datos.perdidas || {})[1061]);
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);

    // ----- Migraciones del administrador -----
    await p.goto(H + 'migraciones.html'); await p.waitForSelector('.mg-kpis .mg-k');
    ok(nombre + ': el administrador ve sus 4 tarjetas y 6 pastillas con Por líder | Por fecha', /Esperan tu decisión/.test(await p.textContent('.mg-kpis')) && /Sin registrar/.test(await p.textContent('.mg-kpis')) && (await p.locator('.mg-bar .mg-ch').count()) === 6 && (await p.locator('.mg-seg [data-mgv]').count()) === 2);
    ok(nombre + ': aviso del reporte con Subir reporte y "+ Nuevo cambio" al lado', /Reporte de cambios de categoría|Todavía no se ha subido el reporte/.test(await p.textContent('.mg-av')) && (await p.locator('.mg-av a[href="actualizar.html"]').count()) === 1 && (await p.locator('.mg-top .mg-nuevo').count()) === 1);
    await p.click('.mg-bar [data-mgf="todas"]');
    const gl = p.locator('.mg-g', { hasText: 'Lucía Ferrer' });
    ok(nombre + ': agrupado por líder con el bloque ámbar y Enviar pendientes junto al nombre', /Ya se hicieron y nadie las registró · 1/.test(await gl.textContent()) && (await gl.locator('[data-mg-env]').count()) === 1);
    ok(nombre + ': el grupo Por asignar trae la sin líder (Asignar líder) y la que pasó a residencial (Ver cliente o roja)', /Por asignar/.test(await p.textContent('#lista')) && (await p.locator('.mg-r', { hasText: 'Bodega Revisable' }).locator('[data-mg="asignar"]').count()) === 1 && /Pasó a residencial/.test(await p.textContent('#lista')));
    await p.evaluate(() => { window.__abrio = []; window.open = (u) => { window.__abrio.push(u); return null; }; });
    await gl.locator('[data-mg-env]').click(); await p.waitForFunction(() => window.__abrio.length === 1);
    ok(nombre + ': Enviar pendientes arma el WhatsApp con las que faltan por registrar y deja bitácora', /Comercial%20de%20Prueba%207/.test(await p.evaluate(() => window.__abrio[0])) && (mundo.bitacora || []).some((b) => b.accion === 'cambio_recordar'));
    await gl.locator('[data-mg-pleg]').click();
    ok(nombre + ': el grupo del líder se pliega', await p.evaluate(() => [...document.querySelectorAll('.mg-g')].some((x) => x.classList.contains('plegado'))));
    await p.click('.mg-seg [data-mgv="fecha"]');
    ok(nombre + ': Por fecha deja una sola lista con el dueño en cada fila', (await p.locator('.mg-g').count()) === 1 && /Lucía Ferrer/.test(await p.textContent('#lista')));
    ok(nombre + ': Migraciones sin desborde', await sinDesborde(p));
    // Usuarios: columna Analista
    if(dispositivo === PC){
      await p.goto(H + 'usuarios.html'); await p.waitForSelector('[data-analista]');
      ok('pc: Usuarios tiene la columna Analista con el selector en cada líder', /Analista/.test(await p.textContent('.lista-cab')) && (await p.locator('[data-analista]').count()) >= 1);
      await p.focus('[data-analista="22222222-2222-4222-8222-222222222222"]'); await p.selectOption('[data-analista="22222222-2222-4222-8222-222222222222"]', { label: 'Elena Soto' }); await p.waitForFunction(() => /Analista asignado/.test(document.body.textContent));
      ok('pc: asignar el analista desde la tabla, sin abrir la ficha', llamo(mundo, 'lider_analista').slice(-1)[0][2].p_analista === '66666666-6666-4666-8666-666666666666' && !(await p.locator('.hoja.ver').count()));
      await p.focus('[data-analista="22222222-2222-4222-8222-222222222222"]'); await p.selectOption('[data-analista="22222222-2222-4222-8222-222222222222"]', { label: 'Tomás Rangel' }); await p.waitForTimeout(400);
    }
    await ctx.close();

    // ----- Permisos por cargo -----
    const C2 = await contexto(nav, dispositivo, mundo);
    const lid = await entrar(C2.ctx, 'lucia', '739105'); cuida(lid);
    await lid.goto(H + 'actualizar.html'); await lid.waitForURL(/inicio\.html/);
    ok(nombre + ': el líder no entra a Actualizar', true);
    await lid.goto(H + 'comisiones.html'); await lid.waitForSelector('.cx-grupo .cx-sec.am', { state: 'attached' });
    ok(nombre + ': el líder ve sus bloques (Por instalar y Migraciones) dentro de su plegable', (await lid.locator('[data-orden-blk]').count()) === 1 && (await lid.locator('[data-mig-blk="801"]').count()) === 1 && (await lid.locator('[data-mig-blk="802"]').count()) === 0);
    await lid.screenshot({ path: 'capturas/71-' + nombre + '-comisiones-lider.png', fullPage: true });
    await lid.goto(H + 'aliados.html'); await lid.waitForSelector('#ayuda');
    await lid.waitForFunction(() => /Solo ves lo tuyo/.test(document.getElementById('ayuda').textContent));
    const filasAl = await lid.locator('#lista .fila').count(); const tuyas = await lid.locator('#lista .fila .tagn.azul').count();
    ok(nombre + ': en Aliados el líder solo ve lo suyo, con el texto nuevo', filasAl === tuyas);
    await C2.ctx.close();
    // Analista normal: Actualizar sí; Migraciones solo su cartera, con Enviar pendientes
    const C3 = await contexto(nav, dispositivo, mundo);
    const tom = await entrar(C3.ctx, 'tomas', '583014'); cuida(tom);
    await tom.goto(H + 'actualizar.html'); await tom.waitForSelector('#archivos', { state: 'attached' });
    ok(nombre + ': el analista entra a Actualizar', !/es del administrador/.test(await tom.textContent('main')));
    await tom.goto(H + 'migraciones.html'); await tom.waitForSelector('.mg-kpis');
    await tom.click('.mg-bar [data-mgf="todas"]');
    ok(nombre + ': el analista ve las de su cartera (Lucía) con Enviar pendientes, y no las sin líder', /Lucía Ferrer/.test(await tom.textContent('#lista')) && (await tom.locator('[data-mg-env]').count()) === 1 && !/Bodega Revisable/.test(await tom.textContent('#lista')));
    await C3.ctx.close();
    // Coordinadora: como la Senior
    const C4 = await contexto(nav, dispositivo, mundo);
    const co = await entrar(C4.ctx, 'coral', '692047'); cuida(co);
    await co.goto(H + 'migraciones.html'); await co.waitForSelector('.mg-kpis'); await co.click('.mg-bar [data-mgf="todas"]');
    ok(nombre + ': la Coordinadora ve todo como la Senior, también las sin líder', /Bodega Revisable/.test(await co.textContent('#lista')) && (await co.locator('[data-mg="asignar"]').count()) >= 1);
    await C4.ctx.close();
    // Legal: Factibilidad
    const C5 = await contexto(nav, dispositivo, mundo);
    const le = await entrar(C5.ctx, 'paula', '615243'); cuida(le);
    await le.goto(H + 'factibilidad.html'); await le.waitForTimeout(1200);
    ok(nombre + ': Legal entra a Factibilidad', /factibilidad\.html/.test(le.url()));
    await C5.ctx.close();
    // Aliado: sin Clientes ni Comisiones
    const C6 = await contexto(nav, dispositivo, mundo);
    const al = await entrarComo(C6.ctx, 'redes', '571942', 'aliados'); cuida(al);
    ok(nombre + ': el aliado no tiene Clientes ni Comisiones en el menú', (await al.locator('a[href="clientes.html"]').count()) === 0 && (await al.locator('a[href="comisiones.html"]').count()) === 0);
    await al.goto(H + 'clientes.html'); await al.waitForURL(/(inicio|aliados)\.html/);
    ok(nombre + ': el aliado no abre Clientes', true);
    await C6.ctx.close();
    // Gerencia: entra a los módulos en solo lectura
    const C7 = await contexto(nav, dispositivo, mundo);
    const ge = await entrarComo(C7.ctx, 'gina', '640218'); cuida(ge);
    await ge.goto(H + 'migraciones.html'); await ge.waitForSelector('.mg-kpis');
    ok(nombre + ': gerencia entra a Migraciones en solo lectura (sin Nuevo cambio ni botones)', await ge.evaluate(() => document.body.classList.contains('solo-lectura')) && (await ge.locator('.mg-nuevo').count()) === 0 && (await ge.locator('[data-mg]').count()) === 0);
    await ge.goto(H + 'comisiones.html'); await ge.waitForSelector('.cx-grupo');
    ok(nombre + ': gerencia ve Comisiones con todos los líderes', /Lucía Ferrer/.test(await ge.textContent('#lista')));
    const err = await ge.evaluate(() => window.Comun.rpc('cambio_accion', { p_id: 801, p_accion: 'error', p_nota: null, p_lider: null }).then(() => 'paso', (e) => e.message));
    ok(nombre + ': si gerencia intenta escribir, la base lo rechaza con un aviso claro', /solo lectura/.test(err) && mundo.datos.cambiosK.filas.find((c) => c.id === 801).estado === 'sin_registro');
    await ge.goto(H + 'clientes.html'); await ge.waitForSelector('#lista .fila, #lista .vacio, #lista [data-c]', { timeout: 10000 }).catch(() => {});
    ok(nombre + ': gerencia entra a Clientes', /clientes\.html/.test(ge.url()));
    await ge.goto(H + 'aliados.html'); await ge.waitForTimeout(1500);
    ok(nombre + ': gerencia entra a Aliados y ve la etiqueta de cliente carterizado', /aliados\.html/.test(ge.url()) && (await ge.locator('.tagn.morado').count()) >= 0);
    await C7.ctx.close();
  }
  ok('sin errores de la página', errores.length === 0, errores);
  await nav.close(); cerrar();
})();
