// Revisión de una sola vez (pantalla nueva, lote 12/11 B): marcar no cambia nada para el líder; "Terminar y avisar" aplica todo junto, deja una sola entrada y arma un solo mensaje.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
const llamo = (m, f) => m.llamadas.filter((l) => l[0] === 'rpc' && l[1] === f);
const abiertas = (p) => p.evaluate(() => window.Comun.hojasAbiertas());
const ABOGADA = { id: '77777777-7777-4777-8777-777777777777', usuario: 'sara', pin: '640217', nombre: 'Sara Ibáñez', rol: 'abogado', cargo: 'Abogada', equipo: 'ambos', codigo_vendedor: null, nombre_odoo: null, activo: true, debe_cambiar_pin: false };
(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo: m } = await contexto(nav, dispositivo);
    m.personas.push(Object.assign({}, ABOGADA)); Object.assign(m.personas[1], { whatsapp: '04145550134' });
    const chats = []; await ctx.route('https://wa.me/**', (r) => { chats.push(decodeURIComponent(r.request().url())); return r.fulfill({ status: 200, contentType: 'text/html', body: 'chat' }); });
    const cli = () => m.datos.clientes.find((c) => c.id === 1001);

    // ----- Administrador: marca dos documentos en la pantalla de revisión (lote 12/11 B, parte 6) -----
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'clientes.html?c=1001&t=documentos'); await p.waitForSelector('#paso [data-paso="revisar"]');
    const hilo0 = cli().hilo.length; const est0 = cli().estatus;
    const sel = () => p.getAttribute('#hojaVer .rv-d.sel', 'data-rv-ir');
    await p.click('#paso [data-paso="revisar"]'); await p.waitForSelector('#hojaVer.ver .rv-c #verAprobar');
    let s0 = await sel();
    await p.click('#verAprobar'); await p.waitForFunction((k) => document.querySelector('#hojaVer .rv-d.sel').dataset.rvIr !== k, s0);
    s0 = await sel();
    await p.click('#verDevolver'); await p.click('[data-motivo="ilegible"]'); await p.fill('#notaDev', 'Borrosa, se corta el número'); await p.click('#devConfirmar');
    await p.waitForFunction((k) => document.querySelector('#hojaVer .rv-d.sel').dataset.rvIr !== k, s0);
    ok(nombre + ': marcar no toca estatus ni hilo', cli().estatus === est0 && cli().hilo.length === hilo0 && Object.keys(cli().marcas).length === 2);
    const pie = await p.textContent('#hojaVer .rv-pie');
    ok(nombre + ': el pie resume y no deja terminar con algo sin decidir', /1 bien/.test(pie) && /1 se devuelve/.test(pie) && /por decidir/.test(pie) && await p.locator('#rvTerminar').isDisabled());
    ok(nombre + ': la lista muestra Bien y Devolver', (await p.locator('#hojaVer .rv-e.b').count()) >= 1 && (await p.locator('#hojaVer .rv-e.d').count()) >= 1);
    await p.keyboard.press('Escape'); await p.waitForFunction(() => window.Comun.hojasAbiertas().join() === 'hojaFicha');
    ok(nombre + ': la banda dice lo marcado y que nada se envía', /1 para aprobar y 1 para devolver/.test(await p.textContent('#paso')) && /nada se envía hasta terminar/.test(await p.textContent('#paso')));
    ok(nombre + ': ya no están la barra ni el panel viejos', (await p.locator('#barraRev, #abrirCerrarRev, .rp-linea, #revisarTodo').count()) === 0);
    ok(nombre + ': no desborda', await sinDesborde(p));

    // Quitar la marca de devolver y volver a ponerla
    await p.click('#paso [data-paso="revisar"]'); await p.waitForSelector('#hojaVer.ver .rv-c');
    await p.click('#hojaVer .rv-d:has(.rv-e.d)'); await p.waitForSelector('#verQuitarMarca');
    ok(nombre + ': el documento marcado dice qué se devuelve', /Se devuelve: .*Borrosa/.test(await p.textContent('#hojaVer .rv-v')));
    await p.click('#verQuitarMarca'); await p.waitForFunction(() => !document.getElementById('verQuitarMarca'));
    ok(nombre + ': Quitar marca la borra', llamo(m, 'documento_marcar').slice(-1)[0][2].p_accion === 'quitar' && Object.keys(cli().marcas).length === 1);
    s0 = await sel();
    await p.click('#verDevolver'); await p.click('[data-motivo="ilegible"]'); await p.fill('#notaDev', 'Borrosa, se corta el número'); await p.click('#devConfirmar');
    await p.waitForFunction((k) => document.querySelector('#hojaVer .rv-d.sel').dataset.rvIr !== k, s0);
    ok(nombre + ': se vuelve a marcar', Object.keys(cli().marcas).length === 2);
    await p.keyboard.press('Escape'); await p.waitForFunction(() => window.Comun.hojasAbiertas().join() === 'hojaFicha');

    // ----- La líder no ve nada de la revisión en curso -----
    const otro = await contexto(nav, dispositivo, m); const l = await entrar(otro.ctx, 'lucia', '739105'); l.on('pageerror', (e) => errores.push(e.message));
    await l.goto(H + 'clientes.html?c=1001&t=documentos'); await l.waitForSelector('#tab-documentos .casilla');
    ok(nombre + ': la líder no ve marcas ni el botón Revisar', (await l.locator('#paso [data-paso="revisar"], .doc.marcada').count()) === 0 && !(await l.textContent('#tab-documentos')).includes('Para devolver'));
    ok(nombre + ': la líder ve que Legal está revisando', /Legal está revisando/.test(await l.textContent('#paso')));
    ok(nombre + ': la líder no pide el estado de la revisión', !llamo(m, 'revision_estado').some((x) => x[3] === 'lucia'));
    await otro.ctx.close();

    // ----- La abogada marca pero no cierra -----
    const ab = await contexto(nav, dispositivo, m); const s = await entrar(ab.ctx, 'sara', '640217'); s.on('pageerror', (e) => errores.push(e.message));
    await s.goto(H + 'clientes.html?c=1001&t=documentos'); await s.waitForSelector('#tab-documentos .doc-sec'); await s.waitForTimeout(400);
    // Lote 12/11 (maqueta legal): la revisión es del administrador; Legal no ve la barra ni el cierre
    ok(nombre + ': la abogada no ve la revisión del administrador ni el cierre', (await s.locator('#paso [data-paso="revisar"], #rvTerminar').count()) === 0);
    await ab.ctx.close();

    // ----- Decide el resto y termina: error del servidor -----
    await p.click('#paso [data-paso="revisar"]'); await p.waitForSelector('#hojaVer.ver .rv-c');
    for(let i = 0; i < 10 && await p.locator('#rvTerminar[disabled]').count(); i++){
      s0 = await sel(); await p.click('#verAprobar'); await p.waitForFunction((k) => { const x = document.querySelector('#hojaVer .rv-d.sel'); return !x || x.dataset.rvIr !== k || !document.querySelector('#rvTerminar[disabled]'); }, s0);
    }
    await p.screenshot({ path: 'capturas/15-' + nombre + '-pantalla.png' });
    await p.click('#rvTerminar'); await p.waitForSelector('#hojaCerrarRev.ver #msjRev');
    ok(nombre + ': la hoja sale encima de la revisión', (await abiertas(p)).slice(-1)[0] === 'hojaCerrarRev');
    ok(nombre + ': la hoja se titula Avisar a la líder', /Avisar a Lucía/.test(await p.textContent('#hojaCerrarRev')));
    const msj = await p.inputValue('#msjRev');
    ok(nombre + ': el mensaje saluda a la líder y dice qué corregir', /, Lucía\. Del cliente Vidrios El Faro/.test(msj) && /• [^\n]+: ilegible o incompleto\. Borrosa, se corta el número/.test(msj) && !/—/.test(msj));
    ok(nombre + ': dice cómo quedará el estatus', /Documentos pendientes/.test(await p.textContent('#hojaCerrarRev')));
    await p.screenshot({ path: 'capturas/15-' + nombre + '-cerrar.png' });
    const nMarcas = Object.keys(cli().marcas).length; m.fallaRpc = 'revision_cerrar';
    await p.click('#cerrarRevSolo'); await p.waitForFunction(() => document.getElementById('eCerrar').textContent.length > 0);
    ok(nombre + ': si el servidor falla avisa y deja reintentar', !(await p.locator('#cerrarRevSolo').isDisabled()) && Object.keys(cli().marcas).length === nMarcas);
    m.fallaRpc = null;

    // ----- Cerrar y enviar -----
    await p.fill('#msjRev', msj + ' Saludos.');
    await p.click('#cerrarRevEnviar'); await p.waitForFunction(() => !document.querySelector('#hojaCerrarRev.ver') && !document.querySelector('#hojaVer.ver'));
    await p.waitForFunction(() => /pendientes/.test(document.getElementById('cabFicha').textContent));
    ok(nombre + ': abre el WhatsApp de la líder con el mensaje editado', chats.length === 1 && chats[0].includes('wa.me/584145550134') && chats[0].includes('Saludos.'));
    const cierre = llamo(m, 'revision_cerrar').slice(-1)[0][2];
    ok(nombre + ': cierra una vez con el mensaje y la marca de enviado', cierre.p_enviado === true && /Saludos\./.test(cierre.p_mensaje));
    ok(nombre + ': aplica las marcas juntas', cli().documentos.filter((d) => d.estado === 'aprobado').length >= 2 && !cli().documentos.some((d) => d.estado === 'por_revisar') && cli().documentos.some((d) => d.estado === 'devuelto' && d.nota === 'Borrosa, se corta el número'));
    ok(nombre + ': deja una sola entrada en el hilo', cli().hilo.length === hilo0 + 1 && cli().hilo.slice(-1)[0].texto === 'revision');
    ok(nombre + ': ya no quedan marcas', Object.keys(cli().marcas).length === 0 && (await p.locator('#paso [data-paso="revisar"]').count()) === 0);
    await p.waitForSelector('[data-grupo="revisiones"]');
    ok(nombre + ': el historial muestra la revisión', /Documentos pendientes/.test(await p.textContent('[data-grupo="revisiones"]')) && /se avisó al líder/.test(await p.textContent('[data-grupo="revisiones"]')));
    await p.click('[data-tab="hilo"]');
    ok(nombre + ': el hilo cuenta la revisión en una línea', /cerró la revisión: \d+ aprobados? y 1 devuelto/.test(await p.textContent('#tab-hilo')) && /Borrosa/.test(await p.textContent('#tab-hilo')));
    await p.screenshot({ path: 'capturas/15-' + nombre + '-hilo.png' });
    ok(nombre + ': no se usó la revisión vieja', llamo(m, 'documento_revisar').length === 0);

    // ----- Sin marcas no hay nada que cerrar; si falla leer la revisión, la ficha abre igual -----
    m.fallaRpc = 'revision_estado';
    await p.goto(H + 'clientes.html?c=1001&t=documentos'); await p.waitForSelector('#revReintentar');
    ok(nombre + ': si falla leer la revisión, la ficha abre y ofrece Reintentar', (await p.locator('#tab-documentos .casilla').count()) > 3);
    m.fallaRpc = null;
    await p.click('#revReintentar'); await p.waitForFunction(() => !document.getElementById('revReintentar'));
    ok(nombre + ': Reintentar la vuelve a leer', true);
    await ctx.close();
  }
  await nav.close();
  ok('sin errores en la página', errores.length === 0, errores);
  cerrar();
})();
