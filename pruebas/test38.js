// Lote urgente 20/10, parte 3: el pago marcado a mano no lo quita la carga del TAD; quitar el pago pide confirmación;
// el texto de "Revisar pago" explica que el TAD no puede decidir cuando hay más de un servicio.
const { chromium, H, TEL, PC, contexto, marcador, entrar, plegables } = require('./simulador');
const { ok, cerrar } = marcador();
const { RPC } = require('./mundo');
const llamo = (m, f) => m.llamadas.filter((l) => l[1] === f);

// Una carga del TAD de mentira por las mismas funciones que usa la pantalla Actualizar
function cargaTad(m, yo, cl, conDeuda){
  const id = RPC.tad_iniciar(m, yo, { p_archivo: 'tad.csv', p_total: cl.servicios.length });
  RPC.tad_filas(m, yo, { p_carga: id, p_filas: cl.servicios.map((sv) => ({ s: sv.sucursal, c: sv.codigo, t: cl.doc_tipo, d: cl.doc_numero, n: cl.nombre, p: sv.plan, ca: sv.categoria, es: sv.estado, e: sv.equipo, cx: conDeuda ? 'SI' : 'NO' })) });
  return RPC.tad_cerrar(m, yo, { p_carga: id });
}

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    const adm = mundo.personas.find((x) => x.rol === 'admin');
    await p.goto(H + 'comisiones.html'); await p.waitForSelector('.grupo');
    const d0 = RPC.comisiones_corte(mundo, adm, {});
    // Un cliente con un solo servicio que debe la instalación
    const fila = d0.filas.find((f) => !f.pago_ok && mundo.datos.clientes.find((c) => c.id === f.cliente_id).servicios.length === 1);
    const cl = mundo.datos.clientes.find((c) => c.id === fila.cliente_id); const ins = cl.instalaciones.find((i) => i.id === fila.instalacion_id);
    // 1. Se marca a mano
    RPC.instalacion_pago(mundo, adm, { p_instalacion: ins.id, p_pagada: true }); const marcado = ins.pago_ok_en;
    // 2. El TAD llega con deuda: el pago marcado a mano se queda
    const r1 = cargaTad(mundo, adm, cl, true);
    ok(nombre + ': la carga del TAD con deuda no quita el pago marcado a mano', ins.pago_ok_en === marcado && r1.pagos_marcados === 0);
    // 3. Quitar el pago pide confirmación
    await p.goto(H + 'comisiones.html'); await p.waitForSelector('.grupo');
    const g = p.locator('.grupo').filter({ has: p.locator('.grupo-cab', { hasText: fila.lider }) });
    if(!(await g.evaluate((x) => x.classList.contains('abierto')))) await g.locator('.grupo-cab').click();
    await p.click('[data-com="' + ins.id + '"]'); await p.waitForSelector('#hojaComision.ver #pagoCom', { state: 'attached' }); await plegables(p, 'pago');
    const antes = llamo(mundo, 'instalacion_pago').length;
    await p.click('#pagoCom'); await p.waitForSelector('#pagoConfirma');
    ok(nombre + ': "Quitar pago" pregunta antes', (await p.textContent('#pagoConfirma')).includes('¿Quitar el pago de este cliente?') && llamo(mundo, 'instalacion_pago').length === antes);
    await p.screenshot({ path: 'capturas/38-' + nombre + '-quitar-pago.png' });
    await p.click('[data-pago-no]');
    ok(nombre + ': "No" lo deja como estaba', (await p.locator('#pagoConfirma').count()) === 0 && (await p.textContent('#hojaComision')).includes('Quitar pago') && !!ins.pago_ok_en);
    await p.click('#pagoCom'); await p.click('#pagoSi');
    await p.waitForFunction(() => document.querySelector('#hojaComision').textContent.includes('Marcar pagada'));
    ok(nombre + ': "Sí, quitar" lo quita', !ins.pago_ok_en && llamo(mundo, 'instalacion_pago').slice(-1)[0][2].p_pagada === false);
    // 4. Quitado a mano, el TAD sin deuda no lo vuelve a marcar solo
    const r2 = cargaTad(mundo, adm, cl, false);
    ok(nombre + ': un pago quitado a mano no vuelve con el TAD', !ins.pago_ok_en && r2.pagos_marcados === 0);
    // 5. Sin marcar a mano, la primera carga sin deuda sí lo marca (regla de siempre)
    const otra = d0.filas.find((f) => !f.pago_ok && f.cliente_id !== cl.id && mundo.datos.clientes.find((c) => c.id === f.cliente_id).servicios.length === 1);
    if(otra){ const c2 = mundo.datos.clientes.find((c) => c.id === otra.cliente_id); const i2 = c2.instalaciones.find((i) => i.id === otra.instalacion_id);
      cargaTad(mundo, adm, c2, false); ok(nombre + ': sin pago a mano, el TAD sin deuda lo marca', !!i2.pago_ok_en); }
    // 6. Revisar pago: más de un servicio
    const multi = d0.filas.find((f) => f.revisar_pago && f.revisar_motivo === 'varios_servicios');
    if(multi){
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      const g2 = p.locator('.grupo').filter({ has: p.locator('.grupo-cab', { hasText: multi.lider }) });
      if(!(await g2.evaluate((x) => x.classList.contains('abierto')))) await g2.locator('.grupo-cab').click();
      await p.click('[data-com="' + multi.instalacion_id + '"]'); await p.waitForSelector('#hojaComision.ver [data-plg-btn="legal"]');
      ok(nombre + ': la cabecera del plegable Pago dice Revisar pago', (await p.textContent('[data-plg-btn="pago"]')).includes('Revisar pago'));
      ok(nombre + ': "Revisar pago" explica que el TAD no puede decidir', (await p.textContent('#hojaComision')).includes('El cliente tiene más de un servicio; el TAD no puede decidir. Marca el pago a mano.'));
    } else ok(nombre + ': hay un cliente con más de un servicio para probar Revisar pago', false);
    await ctx.close();
  }
  ok('sin errores de la página', errores.length === 0, errores.join(' | '));
  await nav.close(); cerrar();
})();
