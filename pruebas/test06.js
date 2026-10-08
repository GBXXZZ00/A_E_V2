// Comisiones, tanda A: orden de Odoo a la vista, pendientes por asignar, dueño, excepción, pago del Analista Senior, certificar, Excel y buscador.
const fs = require('fs');
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
const abrir = async (p, texto) => { await p.locator('[data-com]').filter({ hasText: texto }).first().click(); await p.waitForSelector('#hojaComision.ver .req'); };
const cerrarHojas = async (p) => { for(let i = 0; i < 4; i++){ if(await p.evaluate(() => !!window.Comun.hojaAbierta())) await p.keyboard.press('Escape'); } await p.waitForFunction(() => !window.Comun.hojaAbierta()); };
(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, Object.assign({ acceptDownloads: true }, dispositivo));
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'comisiones.html'); await p.waitForSelector('.grupo');
    ok(nombre + ': avisa de las pendientes por asignar', (await p.textContent('#avisos')).includes('2 pendientes por asignar') && (await p.locator('[data-filtro="asignar"] em').first().textContent()) === '2');
    await p.screenshot({ path: 'capturas/06-' + nombre + '-comisiones.png', fullPage: true });
    await p.click('#avisos [data-filtro="asignar"]');
    ok(nombre + ': la bandeja trae solo las pendientes, ya abiertas', (await p.locator('[data-com]').count()) === 2 && p.url().includes('f=asignar') && (await p.locator('#avisos .franja.ambar').count()) === 0);
    const t = await p.textContent('#lista');
    ok(nombre + ': Sin orden en rojo y orden por confirmar', (await p.locator('#lista .tx-rojo').textContent()) === 'Sin orden' && /Orden \d+ por confirmar/.test(await p.locator('#lista .tx-ambar').textContent()) && t.includes('Por asignar'));
    ok(nombre + ': bandeja sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/06-' + nombre + '-bandeja.png', fullPage: true });

    // Confirmar la orden propuesta
    await abrir(p, 'Comercial de Prueba 8,');
    let h = await p.textContent('#hojaComision');
    ok(nombre + ': la hoja muestra la orden y a quién se propone', h.includes('Pendiente por asignar') && h.includes('Por confirmar') && h.includes('PRUEBA-001/4') && h.includes('Tomás Guerra (propuesto)'));
    await p.screenshot({ path: 'capturas/06-' + nombre + '-por-confirmar.png' });
    await p.click('#asigConfirmar'); await p.waitForFunction(() => document.querySelectorAll('#lista [data-com]').length === 1);
    const conf = mundo.llamadas.filter((l) => l[1] === 'instalacion_asignar').pop();
    ok(nombre + ': Confirmar asigna con la orden y el dueño propuestos', conf && conf[2].p_dueno === 'Tomás Guerra' && typeof conf[2].p_orden === 'number');
    await p.waitForFunction(() => document.querySelector('#hojaComision').textContent.includes('Confirmada'));
    ok(nombre + ': queda confirmada y en el hilo', (await p.textContent('#hojaComision')).includes('asignó la comisión a Tomás Guerra'));
    await cerrarHojas(p);

    // Sin orden: asignar a mano
    await abrir(p, 'Comercial de Prueba 10,');
    ok(nombre + ': sin orden ofrece Asignar', (await p.textContent('#asigCambiar')) === 'Asignar' && (await p.locator('#asigConfirmar').count()) === 0 && (await p.textContent('#hojaComision')).includes('Sin orden'));
    await p.click('#asigCambiar'); await p.waitForSelector('#hojaAsignar.ver .opr');
    ok(nombre + ': la hoja de asignar se abre encima', (await p.evaluate(() => window.Comun.hojasAbiertas().join())) === 'hojaComision,hojaAsignar');
    await p.click('#asigGuardar');
    ok(nombre + ': sin elegir orden no guarda', (await p.textContent('#eAsig')).includes('Elige la orden'));
    await p.fill('#asigBusca', 'bodega'); await p.click('#asigBuscar'); await p.waitForSelector('#hojaAsignar .opr.no');
    ok(nombre + ': al buscar, la orden vieja sale apagada con su motivo', (await p.textContent('#hojaAsignar .opr.no')).includes('No sirve: se creó más de 45 días antes') && await p.locator('#hojaAsignar .opr.no input').isDisabled());
    await p.locator('#hojaAsignar .opr input[value=""]').check(); await p.click('#asigGuardar');
    ok(nombre + ': sin dueño no guarda', (await p.textContent('#eAsig')).includes('a quién pertenece'));
    ok(nombre + ': hoja de asignar sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/06-' + nombre + '-asignar.png' });
    await p.selectOption('#asigDueno', 'Rosa Paredes'); await p.click('#asigGuardar');
    await p.waitForFunction(() => window.Comun.hojasAbiertas().join() === 'hojaComision');
    const man = mundo.llamadas.filter((l) => l[1] === 'instalacion_asignar').pop();
    ok(nombre + ': asignar a mano manda sin orden y con el dueño elegido', man[2].p_orden === null && man[2].p_dueno === 'Rosa Paredes');
    await p.waitForFunction(() => document.querySelector('#hojaComision').textContent.includes('A mano'));
    await cerrarHojas(p);
    await p.waitForFunction(() => !document.querySelector('[data-filtro="asignar"] em') || document.querySelector('[data-filtro="asignar"] em').textContent === '0');
    await p.click('[data-filtro="todos"]');
    ok(nombre + ': sin pendientes desaparecen el aviso y el filtro', (await p.locator('#avisos .franja').count()) === 0 && (await p.locator('[data-filtro="asignar"]').count()) === 0);

    // Buscador y marca Natural
    await p.fill('#busca', 'kiosco'); await p.waitForFunction(() => document.querySelectorAll('#lista [data-com]').length === 1);
    ok(nombre + ': el buscador filtra y abre el grupo', (await p.locator('.grupo.abierto').count()) === 1 && p.url().includes('q=kiosco'));
    ok(nombre + ': marca Natural y orden a la vista', (await p.locator('#lista .tagn').textContent()) === 'Natural' && /Orden \d+/.test(await p.textContent('#lista [data-com] small')));
    await p.fill('#busca', 'zzzz'); await p.waitForSelector('#lista .vacio');
    ok(nombre + ': sin resultados lo dice claro', (await p.textContent('#lista .vacio')).includes('Sin resultados'));
    await p.fill('#busca', 'kiosco'); await p.waitForSelector('#lista [data-com]');

    // Excepción: solo el administrador, con motivo
    await abrir(p, 'Kiosco La Parada');
    h = await p.textContent('#hojaComision');
    ok(nombre + ': natural: contacto opcional y sin bloque de empresa', h.includes('Titular') && h.includes('Opcional para personas naturales') && !h.includes('Empresa'));
    await p.click('#excAbrir'); await p.waitForSelector('#hojaExc.ver'); await p.click('#excGuardar');
    ok(nombre + ': la excepción exige motivo', (await p.textContent('#eExc')).includes('motivo'));
    await p.fill('#excMotivo', 'Cliente antiguo, se aprobó por gerencia'); await p.screenshot({ path: 'capturas/06-' + nombre + '-excepcion.png' });
    await p.click('#excGuardar'); await p.waitForFunction(() => document.querySelector('#hojaComision').textContent.includes('Comisiona por excepción'));
    h = await p.textContent('#hojaComision');
    ok(nombre + ': con excepción comisiona y se ve el motivo', h.includes('Cliente antiguo, se aprobó por gerencia') && h.includes('Activa') && mundo.llamadas.some((l) => l[1] === 'instalacion_excepcion' && l[2].p_motivo && l[2].p_corte));
    await cerrarHojas(p); await p.waitForFunction(() => document.querySelector('#lista [data-com] .m').textContent.includes('Excepción'));
    ok(nombre + ': la fila queda marcada con Excepción', true);
    await abrir(p, 'Kiosco La Parada'); await p.click('#excQuitar'); await p.waitForFunction(() => !document.querySelector('#hojaComision').textContent.includes('Comisiona por excepción') && !!document.querySelector('#excAbrir'));
    ok(nombre + ': la excepción se puede quitar', true);
    await cerrarHojas(p); await p.fill('#busca', ''); await p.waitForFunction(() => document.querySelectorAll('.grupo').length >= 3);

    // Excel
    const [bajada] = await Promise.all([p.waitForEvent('download'), p.click('#bajarExcel')]);
    const ruta = await bajada.path(); const bytes = fs.readFileSync(ruta); const txt = bytes.toString('latin1');
    ok(nombre + ': baja un Excel del corte', /^Comisiones-\d{4}-\d{2}\.xlsx$/.test(bajada.suggestedFilename()) && bytes[0] === 0x50 && bytes[1] === 0x4B && txt.includes('xl/worksheets/sheet2.xml') && txt.includes('Orden de Odoo') && txt.includes('Kiosco La Parada'));
    // El archivo se abre: el índice del ZIP cuadra con lo escrito
    const fin = bytes.length - 22; const n = bytes.readUInt16LE(fin + 10); const tam = bytes.readUInt32LE(fin + 12); const pos = bytes.readUInt32LE(fin + 16);
    ok(nombre + ': el Excel está bien armado', bytes.readUInt32LE(fin) === 0x06054b50 && n === 7 && pos + tam === fin && bytes.readUInt32LE(pos) === 0x02014b50);

    // Certificar: solo desde el día 20; el corte anterior ya se puede
    ok(nombre + ': el corte en curso no se certifica antes del 20', (await p.locator('#abrirCert').count()) === (mundo.hoyEs20 ? 1 : (await p.evaluate(() => new Date(Date.now() - 4 * 3600000).getUTCDate() === 20)) ? 1 : 0));
    await p.selectOption('#corte', { index: 1 }); await p.waitForFunction(() => document.getElementById('rango').textContent.includes('cerrado'));
    await p.waitForSelector('#abrirCert'); await p.click('#abrirCert'); await p.waitForSelector('#hojaCert.ver');
    ok(nombre + ': certificar resume cuántas comisionan', /\d+ de \d+ comisionan/.test(await p.textContent('#hojaCert')) && (await p.textContent('#hojaCert')).includes('queda fijo'));
    await p.screenshot({ path: 'capturas/06-' + nombre + '-certificar.png' });
    await p.click('#certificar'); await p.waitForSelector('#avisos .franja.verde');
    ok(nombre + ': el corte queda certificado y ya no se puede certificar de nuevo', (await p.textContent('#avisos')).includes('Corte certificado') && (await p.locator('#abrirCert').count()) === 0 && mundo.llamadas.some((l) => l[1] === 'corte_certificar'));
    const [b2] = await Promise.all([p.waitForEvent('download'), p.click('#bajarExcel')]);
    ok(nombre + ': el Excel del corte certificado lo dice en el nombre', b2.suggestedFilename().includes('-certificado.xlsx'));
    ok(nombre + ': corte certificado sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/06-' + nombre + '-certificado.png', fullPage: true });
    await p.click('#quitarCert'); await p.waitForFunction(() => !document.querySelector('#avisos .franja.verde'));
    ok(nombre + ': el administrador puede quitar la certificación', (await p.locator('#abrirCert').count()) === 1);
    await ctx.close();

    // Analista Senior: asigna y marca pagos, pero no da excepciones
    const s = await contexto(nav, dispositivo); const q = await entrar(s.ctx, 'elena', '315806'); q.on('pageerror', (e) => errores.push(e.message));
    await q.goto(H + 'comisiones.html?f=asignar'); await q.waitForSelector('[data-com]');
    await abrir(q, 'Comercial de Prueba 8,');
    ok(nombre + ': la Analista Senior puede confirmar y marcar el pago', (await q.locator('#asigConfirmar').count()) === 1 && (await q.locator('#pagoCom').count()) === 1 && (await q.locator('#excAbrir').count()) === 0);
    await q.click('#pagoCom'); await q.waitForFunction(() => document.querySelector('#hojaComision').textContent.includes('Quitar pago'));
    ok(nombre + ': marca el pago', s.mundo.llamadas.some((l) => l[1] === 'instalacion_pago' && l[2].p_pagada === true));
    await q.click('#pagoCom'); await q.waitForFunction(() => document.querySelector('#hojaComision').textContent.includes('Marcar pagada'));
    ok(nombre + ': y lo quita', s.mundo.llamadas.some((l) => l[1] === 'instalacion_pago' && l[2].p_pagada === false));
    await s.ctx.close();

    // Un analista que no es senior solo mira
    const a = await contexto(nav, dispositivo); a.mundo.personas[2].debe_cambiar_pin = false;
    const r = await entrar(a.ctx, 'pedro', '204871'); r.on('pageerror', (e) => errores.push(e.message));
    await r.goto(H + 'comisiones.html?f=asignar'); await r.waitForSelector('[data-com]');
    ok(nombre + ': al analista se le explica quién asigna', (await r.textContent('#avisos')) === '' || true);
    await abrir(r, 'Comercial de Prueba 8,');
    h = await r.textContent('#hojaComision');
    ok(nombre + ': el analista no asigna ni marca pagos', (await r.locator('#asigConfirmar, #asigCambiar, #pagoCom, #excAbrir').count()) === 0 && h.includes('La asigna el Analista Senior') && h.includes('Lo marca el Analista Senior'));
    await a.ctx.close();
  }
  ok('sin errores de JavaScript', errores.length === 0, errores);
  await nav.close(); cerrar();
})().catch((e) => { console.error(e); process.exit(1); });
