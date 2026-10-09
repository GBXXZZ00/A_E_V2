// La IA ya dio su resultado y después cambia el expediente: con un dato nuevo se actualiza sola y gratis (respeta las excepciones);
// con un archivo nuevo avisa y ofrece "Actualizar resultado" (en el expediente y en la hoja de cierre). La abogada solo ve el aviso.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
const llamo = (m, f) => m.llamadas.filter((l) => l[0] === 'rpc' && l[1] === f);
const ABOGADA = { id: '77777777-7777-4777-8777-777777777777', usuario: 'sara', pin: '640217', nombre: 'Sara Ibáñez', rol: 'abogado', cargo: 'Abogada', equipo: 'ambos', codigo_vendedor: null, nombre_odoo: null, activo: true, debe_cambiar_pin: false };
(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo: m } = await contexto(nav, dispositivo);
    m.personas.push(Object.assign({}, ABOGADA));
    const cli = () => m.datos.clientes.find((c) => c.id === 1001);
    cli().correo_empresa = null;

    // ----- La IA lee el expediente y dice que falta el correo de la empresa -----
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'revision.html?c=1001'); await p.waitForSelector('#hojaFicha.ver #mandarIA');
    await p.click('#mandarIA'); await p.waitForSelector('#hojaIA.ver #lanzarIA'); await p.click('#lanzarIA');
    m.iaPaso = 20; await p.waitForSelector('#iaResultado', { timeout: 15000 });
    ok(nombre + ': la IA dice que falta el correo de la empresa', /Falta correo de la empresa/.test(await p.textContent('#iaResultado')));
    ok(nombre + ': recién leído no sale el aviso de resultado viejo', (await p.locator('.ia-vieja').count()) === 0);

    // Excepción en la junta: debe quedar después de actualizar
    await p.click('[data-exc-ia="junta"]'); await p.waitForSelector('#hojaExcIA.ver #darExcIA');
    await p.fill('#motExcIA', 'El acta de ratificación ya está en el Registro'); await p.click('#darExcIA');
    await p.waitForSelector('[data-quitar-exc="junta"]', { timeout: 15000 });

    // ----- Escribe el correo: el resultado se actualiza solo, sin costo -----
    const costo = cli().ia.costo_usd;
    await p.click('[data-campo="correo_empresa"]'); await p.waitForSelector('#hojaCampo.ver #cCorreo');
    await p.fill('#cCorreo', 'admin@vidrioselfaro.test'); await p.click('#guardarCampo');
    await p.waitForFunction(() => !document.querySelector('#hojaCampo.ver'));
    await p.waitForFunction(() => { const r = document.getElementById('iaResultado'); return r && !/Falta correo de la empresa/.test(r.textContent); }, null, { timeout: 15000 });
    ok(nombre + ': al guardar el correo la IA se actualiza sola', llamo(m, 'ia_actualizar').length === 1);
    ok(nombre + ': ya no dice que falta el correo', !/Falta correo de la empresa/.test(await p.textContent('#iaResultado')));
    ok(nombre + ': la excepción de la junta se mantiene', (await p.locator('[data-quitar-exc="junta"]').count()) === 1);
    ok(nombre + ': actualizar por un dato no cuesta', cli().ia.costo_usd === costo && cli().ia.nuevos === 0);
    ok(nombre + ': queda en la bitácora', (m.bitacora || []).some((b) => b.accion === 'ia_actualizada'));
    ok(nombre + ': sin cambios no hay aviso', (await p.locator('#iaResultado .ia-vieja').count()) === 0);
    await p.keyboard.press('Escape'); await p.waitForFunction(() => !window.Comun.hojaAbierta());

    // ----- Suben un archivo nuevo: avisa y ofrece actualizar, no gasta solo -----
    cli().documentos[0].archivos.push({ id: 99001, ruta: null, url_externa: null, nombre: 'cedula-nueva.pdf', mime: 'application/pdf', tamano: 120000 });
    await p.goto(H + 'revision.html?c=1001'); await p.waitForSelector('#hojaFicha.ver #iaResultado .ia-vieja');
    const aviso = await p.textContent('#iaResultado .ia-vieja');
    ok(nombre + ': avisa que el resultado no incluye el archivo nuevo', /Subieron 1 archivo después de la IA/.test(aviso) && /US\$ 0\.04/.test(aviso));
    await p.waitForTimeout(600);
    ok(nombre + ': con archivos nuevos no gasta solo', llamo(m, 'ia_actualizar').length === 1);
    await p.locator('#iaResultado').scrollIntoViewIfNeeded(); await p.screenshot({ path: 'capturas/18-' + nombre + '-viejo.png' });
    ok(nombre + ': el aviso no desborda', await sinDesborde(p));

    // En la hoja de cierre también sale, con el botón
    await p.click('#abrirCerrarRev'); await p.waitForSelector('#hojaCerrarRev.ver .ia-vieja [data-actualizar-ia]');
    ok(nombre + ': la hoja de cierre avisa que el resultado es de antes', /después de la IA/.test(await p.textContent('#hojaCerrarRev')));
    await p.screenshot({ path: 'capturas/18-' + nombre + '-cerrar.png' });
    m.iaPaso = 0.001; await p.click('#hojaCerrarRev [data-actualizar-ia]'); await p.waitForFunction(() => !document.querySelector('#hojaCerrarRev.ver'));
    await p.waitForSelector('#iaLeyendo');
    ok(nombre + ': Actualizar resultado pone a leer solo lo nuevo', llamo(m, 'ia_actualizar').length === 2 && cli().ia.nuevos === 1 && /La IA está leyendo/.test(await p.textContent('#iaLeyendo')));
    m.iaPaso = 20; await p.waitForSelector('#iaResultado', { timeout: 15000 });
    ok(nombre + ': al terminar el aviso desaparece', (await p.locator('#iaResultado .ia-vieja').count()) === 0);
    await p.keyboard.press('Escape');

    // ----- Error de red al actualizar: lo dice y deja el botón -----
    cli().documentos[0].archivos.push({ id: 99002, ruta: null, url_externa: null, nombre: 'rif-nuevo.pdf', mime: 'application/pdf', tamano: 120000 });
    await p.goto(H + 'revision.html?c=1001'); await p.waitForSelector('#iaResultado [data-actualizar-ia]');
    m.fallaRpc = 'ia_actualizar'; await p.click('#iaResultado [data-actualizar-ia]'); await p.waitForSelector('.toast');
    ok(nombre + ': si falla lo dice y deja Actualizar', (await p.locator('#iaResultado [data-actualizar-ia]:not([disabled])').count()) === 1);
    m.fallaRpc = null;

    // ----- La abogada ve el aviso pero no actualiza -----
    const ab = await contexto(nav, dispositivo, m); const s = await entrar(ab.ctx, 'sara', '640217'); s.on('pageerror', (e) => errores.push(e.message));
    await s.goto(H + 'revision.html?c=1001'); await s.waitForSelector('#hojaFicha.ver #tab-documentos .casilla');
    const n0 = llamo(m, 'ia_actualizar').length;
    cli().correo_empresa = 'otro@vidrioselfaro.test';
    await s.goto(H + 'revision.html?c=1001'); await s.waitForSelector('#hojaFicha.ver #tab-documentos .casilla'); await s.waitForTimeout(600);
    ok(nombre + ': la abogada no lanza la actualización', llamo(m, 'ia_actualizar').length === n0 && (await s.locator('[data-actualizar-ia]').count()) === 0);
    ok(nombre + ': la abogada ve que el resultado es de antes', /El administrador debe actualizarlo/.test(await s.textContent('#iaResultado')));
    await s.locator('#iaResultado').scrollIntoViewIfNeeded(); await s.screenshot({ path: 'capturas/18-' + nombre + '-abogada.png' });
    await ab.ctx.close();
    await ctx.close();
  }
  await nav.close();
  ok('sin errores en la página', errores.length === 0, errores);
  cerrar();
})();
