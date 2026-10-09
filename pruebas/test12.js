// Factibilidad paso 2: subir el mapa de red (KMZ) en Actualizar. Lectura fuera de la pantalla, carga por lotes, resumen y revisión de consultas.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { RPC } = require('./mundo');
const { kmz } = require('./kmz');
const { ok, cerrar } = marcador();
const archivo = (nombre, buffer) => ({ name: nombre, mimeType: 'application/vnd.google-earth.kmz', buffer });
(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    // El analista ve el mapa vigente pero no lo sube
    mundo.personas.find((x) => x.usuario === 'pedro').debe_cambiar_pin = false;
    { const o = await contexto(nav, dispositivo, mundo); const q = await entrar(o.ctx, 'pedro', '204871'); q.on('pageerror', (e) => errores.push(e.message));
      await q.goto(H + 'actualizar.html'); await q.waitForFunction(() => /administrador sube/.test(document.getElementById('mapaRed').textContent));
      ok(nombre + ': el analista no puede subir el mapa', (await q.locator('#mapaSoltar').count()) === 0 && (await q.textContent('#mapaRed')).includes('Todavía no hay mapa'));
      await o.ctx.close(); }

    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'actualizar.html'); await p.waitForSelector('#mapaSoltar');
    ok(nombre + ': sin mapa avisa que Factibilidad no puede consultar', (await p.textContent('#mapaRed')).includes('Factibilidad no puede consultar'));

    // Un archivo que no es un KMZ
    await p.setInputFiles('#archivoMapa', archivo('malo.kmz', Buffer.from('esto no es un zip')));
    await p.waitForFunction(() => /no es un KMZ/.test(document.getElementById('mapaRed').textContent));
    ok(nombre + ': un archivo dañado dice por qué no sirve', true);

    // El KMZ inventado, soltado junto con los demás archivos
    await p.setInputFiles('#archivos', archivo('Mapa Proyectos.kmz', kmz()));
    await p.waitForSelector('#mapaCargar');
    const t = await p.textContent('#mapaRed');
    ok(nombre + ': lee zonas, puntos y el reparto por estado', t.includes('8 zonas y 4 puntos') && t.includes('Liberado 3 · Exclusiva 2 · Diseño 1 · Construcción 1 · Permiso VGT 1'), t);
    ok(nombre + ': avisa de la zona que no está en una carpeta de estado', t.includes('1 zona queda fuera'));
    ok(nombre + ': no se metió en la lista de archivos del TAD', (await p.locator('#listaArch').count()) === 0);
    ok(nombre + ': el panel del mapa no desborda', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/12-' + nombre + '-leido.png', fullPage: true });

    // Si un lote falla tres veces, se detiene sin tocar el mapa vigente
    mundo.fallaZonas = 3;
    await p.click('#mapaCargar'); await p.waitForFunction(() => /La carga se detuvo/.test(document.getElementById('mapaRed').textContent), null, { timeout: 20000 });
    ok(nombre + ': si se corta, lo dice y deja reintentar', (await p.locator('#mapaCargar').count()) === 1 && !(mundo.mapas || []).some((x) => x.estado === 'vigente'));
    mundo.fallaZonas = 0; mundo.lotesMapa = [];

    await p.click('#mapaCargar'); await p.waitForFunction(() => /Mapa cargado/.test(document.getElementById('mapaRed').textContent), null, { timeout: 20000 });
    const zonas = [].concat(...mundo.lotesMapa); const de = (m) => zonas.filter((z) => z.m === m);
    ok(nombre + ': MDT y capacidad salen del nombre del polígono', de('AAA001').length === 1 && de('AAA001')[0].c === '792' && de('AAA002')[0].c === '120');
    ok(nombre + ': la exclusividad se normaliza a lista cerrada', de('AAA001')[0].x === 'liberada' && de('AAA002')[0].x === 'liberada' && de('AAA003')[0].x === 'planta_externa' && de('EXC001').every((z) => z.x === 'aliado' && z.a === 'Aliado Uno'));
    ok(nombre + ': MultiGeometry da una zona por polígono', de('EXC001').length === 2);
    ok(nombre + ': el estado sale de la carpeta y la ciudad también', de('DIS001')[0].e === 'diseno' && de('CON001')[0].e === 'construccion' && de('VGT001')[0].e === 'permiso_vgt' && de('AAA001')[0].ci === 'Ciudad Prueba');
    ok(nombre + ': el punto del MDT viaja con su zona', JSON.stringify(de('AAA001')[0].p) === JSON.stringify([-71.005, 10.005]) && de('DIS001')[0].p === null);
    ok(nombre + ': sin vértice repetido al cerrar', de('AAA001')[0].lng.length === 4);
    let r = await p.textContent('#mapaRed');
    ok(nombre + ': el resumen del primer mapa', r.includes('8 zonas') && r.includes('Todavía no hay consultas guardadas') && (await p.locator('#mapaRed a[href="factibilidad.html"]').count()) === 1, r);
    ok(nombre + ': queda en la bitácora', (mundo.bitacora || []).some((b) => b.accion === 'mapa_red_subido'));

    // Una consulta en espera dentro del diseño; el mapa nuevo trae el diseño liberado
    RPC.fact_consultar(mundo, mundo.personas[1], { p_lat: 10.005, p_lng: -70.991, p_tipo: 'pyme' });
    ok(nombre + ': la consulta queda en espera con el primer mapa', mundo.consultas[0].resultado === 'espera');
    await p.click('#mapaOtro');
    await p.setInputFiles('#archivoMapa', archivo('Mapa Proyectos 2.kmz', kmz({ disenoLiberado: true })));
    await p.waitForSelector('#mapaCargar'); await p.click('#mapaCargar');
    await p.waitForFunction(() => /Mapa cargado/.test(document.getElementById('mapaRed').textContent), null, { timeout: 20000 });
    r = await p.textContent('#mapaRed');
    ok(nombre + ': el resumen dice qué cambió frente al anterior', r.includes('1 cambió de estado') && r.includes('1 ahora tiene red') && r.includes('DIS001: Diseño a Liberado'), r);
    ok(nombre + ': las consultas se revisaron solas y avisa las nuevas', r.includes('1 consulta abierta revisada') && r.includes('NUEVO'));
    ok(nombre + ': la consulta pasó a Hay red y queda marcada', mundo.consultas[0].resultado === 'hay_red' && mundo.consultas[0].anterior === 'espera' && mundo.consultas[0].visto === false);
    ok(nombre + ': arriba sale el mapa vigente nuevo', (await p.textContent('#mapaRed')).includes('Mapa vigente del'));
    await p.screenshot({ path: 'capturas/12-' + nombre + '-resumen.png', fullPage: true });
    await ctx.close();
  }
  ok('sin errores de JavaScript', errores.length === 0, errores);
  await nav.close(); cerrar();
})().catch((e) => { console.error(e); process.exit(1); });
