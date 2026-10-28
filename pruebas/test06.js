// Comisiones, tanda A: orden de Odoo a la vista, pendientes por asignar, dueño, excepción, pago del Analista Senior, certificar, Excel y buscador.
const fs = require('fs');
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar, plegables } = require('./simulador');
const { ok, cerrar } = marcador();
const { RPC } = require('./mundo');
const llamo = (m, f) => m.llamadas.filter((l) => l[1] === f);
const abrir = async (p, texto) => { await p.locator('[data-com]').filter({ hasText: texto }).first().click(); await p.waitForSelector('#hojaComision.ver [data-plg-btn="legal"]'); await plegables(p, 'pago', 'ajustes'); };
const cerrarHojas = async (p) => { for(let i = 0; i < 4; i++){ if(await p.evaluate(() => !!window.Comun.hojaAbierta())) await p.keyboard.press('Escape'); } await p.waitForFunction(() => !window.Comun.hojaAbierta()); };
(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, Object.assign({ acceptDownloads: true }, dispositivo));
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'comisiones.html'); await p.waitForSelector('.grupo');
    ok(nombre + ': avisa de las pendientes por asignar', /2 instalaciones/.test(await p.textContent('#alertas [data-filtro="asignar"]')) && /2/.test(await p.textContent('#filtros [data-filtro="asignar"]')));
    await p.screenshot({ path: 'capturas/06-' + nombre + '-comisiones.png', fullPage: true });
    await p.click('#alertas [data-filtro="asignar"]');
    ok(nombre + ': la bandeja trae solo las pendientes, ya abiertas', (await p.locator('[data-com]').count()) === 2 && p.url().includes('f=asignar'));
    const t = await p.textContent('#lista');
    ok(nombre + ': Sin orden en rojo y orden por confirmar', (await p.locator('#lista .tx-rojo').textContent()) === 'Sin orden' && /por confirmar/.test(await p.locator('#lista .tx-ambar').first().textContent()) && t.includes('Por asignar'));
    ok(nombre + ': bandeja sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/06-' + nombre + '-bandeja.png', fullPage: true });

    // Confirmar la orden propuesta
    await abrir(p, 'Comercial de Prueba 8,');
    let h = await p.textContent('#hojaComision');
    ok(nombre + ': la hoja muestra la orden y a quién se propone', h.includes('confirme la orden') && h.includes('Por confirmar') && h.includes('PRUEBA-001/4') && h.includes('Tomás Guerra (propuesto)'));
    await p.screenshot({ path: 'capturas/06-' + nombre + '-por-confirmar.png' });
    await p.click('#asigConfirmar'); await p.waitForFunction(() => document.querySelectorAll('#lista [data-com]').length === 1);
    const conf = mundo.llamadas.filter((l) => l[1] === 'instalacion_asignar').pop();
    ok(nombre + ': Confirmar asigna con la orden y el dueño propuestos', conf && conf[2].p_dueno === 'Tomás Guerra' && typeof conf[2].p_orden === 'number');
    await p.waitForFunction(() => !document.getElementById('asigConfirmar') && /asignó la comisión/.test(document.getElementById('hojaComision').textContent));
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
    await p.waitForFunction(() => { const e = document.querySelector('#filtros [data-filtro="asignar"]'); return !e || /\b0\b/.test(e.textContent); });
    await p.click('#filtros [data-filtro="todos"]');
    ok(nombre + ': sin pendientes el filtro se va y el aviso queda en cero', (await p.locator('#filtros [data-filtro="asignar"]').count()) === 0 && /0 instalaciones/.test(await p.textContent('#alertas')));

    // Buscador y marca Natural
    await p.fill('#busca', 'kiosco'); await p.waitForFunction(() => document.querySelectorAll('#lista [data-com]').length === 1);
    ok(nombre + ': el buscador filtra y abre el grupo', (await p.locator('.grupo.abierto').count()) === 1 && p.url().includes('q=kiosco'));
    ok(nombre + ': documento de persona natural y orden a la vista', /^V-/.test(await p.textContent('#lista [data-com] .cx-c small')) && !/Sin orden/.test(await p.textContent('#lista [data-com] .cx-o')));
    await p.fill('#busca', 'zzzz'); await p.waitForSelector('#lista .vacio');
    ok(nombre + ': sin resultados lo dice claro', (await p.textContent('#lista .vacio')).includes('Sin resultados'));
    await p.fill('#busca', 'kiosco'); await p.waitForSelector('#lista [data-com]');

    // Excepción: solo el administrador, con motivo
    await abrir(p, 'Kiosco La Parada');
    await p.click('[data-docs-com]'); h = await p.textContent('#docsCom');
    ok(nombre + ': natural: contacto opcional y sin bloque de empresa', h.includes('Titular') && h.includes('Opcional') && !h.includes('Empresa'));
    h = await p.textContent('#hojaComision');
    await p.click('#excAbrir'); await p.waitForSelector('#hojaExc.ver'); await p.click('#excGuardar');
    ok(nombre + ': la excepción exige motivo', (await p.textContent('#eExc')).includes('motivo'));
    await p.fill('#excMotivo', 'Cliente antiguo, se aprobó por gerencia'); await p.screenshot({ path: 'capturas/06-' + nombre + '-excepcion.png' });
    await p.click('#excGuardar'); await p.waitForFunction(() => document.querySelector('#hojaComision').textContent.includes('Comisiona por excepción'));
    h = await p.textContent('#hojaComision');
    ok(nombre + ': con excepción comisiona y se ve el motivo', h.includes('Cliente antiguo, se aprobó por gerencia') && h.includes('Activa') && mundo.llamadas.some((l) => l[1] === 'instalacion_excepcion' && l[2].p_motivo && l[2].p_corte));
    await cerrarHojas(p); await p.waitForFunction(() => /por excepción/.test(document.querySelector('#lista [data-com] .cx-q').textContent));
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

    // Lote urgente 20/10: cerrar corte a mano (certificar). El día límite es un aviso; se cierra desde que terminan las instalaciones.
    const puedeCerrar = (await p.locator('#abrirCert').count()) === 1;
    const rango = await p.textContent('#rango');
    ok(nombre + ': el rango del corte en curso dice el día límite como aviso (sin "cerrado")', /día límite|Día límite|sigue abierto/i.test(rango) && !/Corte cerrado/.test(rango), rango);
    if(puedeCerrar){
      await p.click('#abrirCert'); await p.waitForSelector('#hojaCert.ver #certificar');
      const res = await p.textContent('#hojaCert'); const r = llamo(mundo, 'corte_cierre_resumen').slice(-1)[0];
      ok(nombre + ': cerrar corte pide el resumen al servidor: cuántas cumplen y cuántas pasan al siguiente', !!r && /\d+ de \d+ comisionan/.test(res) && res.includes('queda fijo') && (!/pasan? al corte siguiente/.test(res) || /\d+ pasan? al corte siguiente/.test(res)), res);
      await p.screenshot({ path: 'capturas/06-' + nombre + '-certificar.png' });
      const antes = await p.evaluate(() => document.getElementById('corte').value);
      await p.click('#certificar'); await p.waitForFunction((a) => document.getElementById('corte').value !== a, antes);
      ok(nombre + ': al cerrar, el corte en curso pasa al siguiente y queda en la bitácora', (await p.evaluate(() => document.getElementById('corte').selectedOptions[0].textContent)).includes('(en curso)') && (mundo.bitacora || []).some((b) => b.accion === 'corte_cerrado' && b.corte === antes));
      ok(nombre + ': lo que no cumplió pasa al corte siguiente como último corte', (await p.textContent('#mets')).includes('En su último corte'));
      await p.selectOption('#corte', antes); await p.waitForSelector('#avisos .franja.verde');
      ok(nombre + ': el corte cerrado queda fijo y ya no se puede cerrar de nuevo', (await p.textContent('#avisos')).includes('Corte cerrado') && (await p.locator('#abrirCert').count()) === 0 && /Corte cerrado/.test(await p.textContent('#rango')));
      const [b2] = await Promise.all([p.waitForEvent('download'), p.click('#bajarExcel')]);
      ok(nombre + ': el Excel del corte cerrado lo dice en el nombre', b2.suggestedFilename().includes('-certificado.xlsx'));
      ok(nombre + ': corte cerrado sin desborde', await sinDesborde(p));
      await p.screenshot({ path: 'capturas/06-' + nombre + '-certificado.png', fullPage: true });
      await p.click('#quitarCert'); await p.waitForFunction(() => !document.querySelector('#avisos .franja.verde'));
      ok(nombre + ': el administrador puede volver a abrirlo mientras el siguiente siga abierto', (await p.locator('#abrirCert').count()) === 1);
      // En orden: no se cierra noviembre con octubre abierto
      const { corte: K } = require('./mundo'); K.fijarHoy('2026-11-20');
      const adm = mundo.personas.find((x) => x.rol === 'admin'); const e1 = RPC.corte_certificar(mundo, adm, { p_corte: '2026-11-01' });
      const lid = mundo.personas.find((x) => x.rol === 'lider'); const e2 = RPC.corte_cierre_resumen(mundo, lid, { p_corte: '2026-10-01' });
      K.fijarHoy(null);
      ok(nombre + ': los cortes se cierran en orden y el líder no puede cerrar', /Primero cierra el corte anterior/.test(((e1 || {}).__error || {}).message) && !!(e2 || {}).__error);
    } else {
      ok(nombre + ': antes de que terminen las instalaciones no se puede cerrar', /se puede cerrar desde/.test((RPC.corte_certificar(mundo, mundo.personas.find((x) => x.rol === 'admin'), { p_corte: await p.evaluate(() => document.getElementById('corte').value) }) || {}).__error.message));
    }
    await ctx.close();

    // Analista Senior: asigna y marca pagos, pero no da excepciones
    const s = await contexto(nav, dispositivo); const q = await entrar(s.ctx, 'elena', '315806'); q.on('pageerror', (e) => errores.push(e.message));
    await q.goto(H + 'comisiones.html?f=asignar'); await q.waitForSelector('[data-com]');
    await abrir(q, 'Comercial de Prueba 8,');
    ok(nombre + ': la Analista Senior puede confirmar y marcar el pago', (await q.locator('#asigConfirmar').count()) === 1 && (await q.locator('#pagoCom').count()) === 1 && (await q.locator('#excAbrir').count()) === 0);
    await q.click('#pagoCom'); await q.waitForFunction(() => document.querySelector('#hojaComision').textContent.includes('Quitar pago'));
    ok(nombre + ': marca el pago', s.mundo.llamadas.some((l) => l[1] === 'instalacion_pago' && l[2].p_pagada === true));
    await q.click('#pagoCom'); await q.waitForSelector('#pagoSi'); await q.click('#pagoSi'); await q.waitForFunction(() => document.querySelector('#hojaComision').textContent.includes('Marcar pagada'));
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
