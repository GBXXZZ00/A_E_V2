// Lote 05/11, parte D: Mi trabajo. Botones que dicen adónde llevan ("Revisar aquí" en documentos), grupos plegables con su número,
// lo pedido al líder en "Devueltos o pedidos", buscador por RIF o nombre y aviso "Qué cambió" con Entendido. Datos inventados.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['pc', PC], ['tel', TEL]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    // Un pedido abierto para un cliente de Lucía
    const c = mundo.datos.clientes.find((x) => x.lider === 'Lucía Ferrer' && !x.es_natural);
    c.requerimientos = [{ id: 501, casilla: 'acta_asamblea', numero: 3, tipo: 'junta', texto: 'Acta de asamblea de ratificación o cambio de junta directiva', motivo: null, estado: 'abierto', por: 'Marcos Rivas', en: new Date().toISOString() }];
    const l = await entrar(ctx, 'lucia', '739105'); l.on('pageerror', (e) => errores.push(nombre + ': ' + e.message));
    await l.goto(H + 'trabajo.html'); await l.waitForSelector('#cuerpo .bz-it', { state: 'attached' }); await l.evaluate(() => document.querySelectorAll('#cuerpo details.bz-pl').forEach((d) => { d.open = true; })); 
    const idx = await l.textContent('#tarjetas');
    ok(nombre + ': el líder tiene "Devueltos o pedidos" y ahí está lo pedido', /Devueltos o pedidos/.test(idx) && /Falta: Acta de asamblea de ratificación/.test(await l.textContent('#cuerpo')));
    ok(nombre + ': los grupos son plegables con su número', (await l.locator('#cuerpo details.bz-pl').count()) >= 1 && (await l.locator('#cuerpo details.bz-pl .bz-pl-n').count()) >= 1);
    const botones = await l.$$eval('#cuerpo [data-hacer]', (xs) => xs.map((x) => x.textContent));
    ok(nombre + ': cada botón dice adónde lleva', botones.length > 0 && botones.every((t) => /^(Abrir expediente|Abrir|Subir firmado|Ir a |Revisar aquí|Registrar|Hacerlo yo)/.test(t)));
    // Qué cambió, una vez por persona
    // Lote 12/11 (maqueta mi-trabajo): ya no sale el aviso "Qué cambió"; arriba solo "Hola" y el buscador
    ok(nombre + ': sin el aviso Qué cambió y con "Hola, …"', (await l.locator('#queCambio').evaluate((x) => x.classList.contains('hidden'))) && /^Hola, /.test(await l.textContent('#saludo')));
    // Buscador por nombre y por RIF
    await l.fill('#bzBuscar', c.nombre); await l.waitForTimeout(400);
    let tit = await l.$$eval('#cuerpo .bz-it b > span:not(.mt-pill)', (xs) => xs.map((x) => x.textContent));
    ok(nombre + ': el buscador filtra por nombre', tit.length > 0 && tit.every((t) => t.indexOf(c.nombre) >= 0));
    await l.fill('#bzBuscar', 'J-' + c.doc_numero); await l.waitForTimeout(400);
    tit = await l.$$eval('#cuerpo .bz-it b > span:not(.mt-pill)', (xs) => xs.map((x) => x.textContent));
    ok(nombre + ': y por RIF', tit.length > 0 && tit.every((t) => t.indexOf(c.nombre) >= 0));
    await l.fill('#bzBuscar', 'zzz nada'); await l.waitForTimeout(400);
    ok(nombre + ': sin resultados lo dice', /Nada con/.test(await l.textContent('#cuerpo')));
    await l.fill('#bzBuscar', ''); await l.waitForTimeout(400);
    ok(nombre + ': sin desborde', await sinDesborde(l));
    await ctx.close();
    // El administrador: "Revisar aquí" en documentos por revisar
    const c2 = await contexto(nav, dispositivo);
    c2.mundo.datos.extra = [{ tipo: 'revisar_docs', clave: '1001', cliente_id: 1001, titulo: 'Cliente de prueba', detalle: '2 archivos por revisar', para: 'admin', vence: null, desde: new Date().toISOString(), ref: { revisar: true } }];
    const a = await entrar(c2.ctx, 'marcos', '482913'); a.on('pageerror', (e) => errores.push(nombre + ' admin: ' + e.message));
    await a.goto(H + 'trabajo.html?g=rev'); await a.waitForSelector('#cuerpo .bz-it');
    ok(nombre + ': el administrador revisa documentos con "Revisar aquí"', (await a.$$eval('#cuerpo [data-hacer]', (xs) => xs.map((x) => x.textContent))).some((t) => t === 'Revisar aquí'));
    await c2.ctx.close();
  }
  ok('sin errores de JavaScript', !errores.length, errores.slice(0, 3));
  await nav.close(); cerrar();
})();
