// Clientes, Pedir documentos y la ficha: hilo, documentos, revisión, datos y comisión.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
const PDF = { name: 'cedula.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 prueba') };
const llamo = (m, f) => m.llamadas.filter((l) => l[0] === 'rpc' && l[1] === f);
(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    // ----- Líder: lista, búsqueda, pedir y subir -----
    const { ctx, mundo } = await contexto(nav, dispositivo);
    const p = await entrar(ctx, 'lucia', '739105'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'clientes.html'); await p.waitForSelector('.tarj');
    const mias = await p.locator('.tarj').count();
    ok(nombre + ': el líder ve solo sus clientes', mias >= 2 && mias <= 4 && (await p.locator('.tarj:has-text("Bahía Azul")').count()) === 0);
    ok(nombre + ': Clientes sin desborde', await sinDesborde(p));
    await p.fill('#busca', 'kiosco'); await p.waitForFunction(() => document.querySelectorAll('.tarj').length === 1 && document.querySelector('.tarj').textContent.includes('Kiosco'));
    ok(nombre + ': la búsqueda queda en la dirección', p.url().includes('q=kiosco'));
    await p.fill('#busca', 'zzzz'); await p.waitForSelector('.vacio');
    ok(nombre + ': búsqueda sin resultados explica', (await p.locator('.tarj').count()) === 0);
    await p.fill('#busca', 'kiosco'); await p.waitForSelector('.tarj');
    await p.click('[data-pedir]'); await p.waitForSelector('#hojaPedir.ver');
    const msj = await p.inputValue('#pedirMsj');
    ok(nombre + ': mensaje listo con lo que falta', msj.length > 40 && (await p.locator('#pedirFalta .chip').count()) >= 1 && !msj.includes('—'));
    ok(nombre + ': el enlace va a WhatsApp', /wa\.me|whatsapp/.test(await p.getAttribute('#pedirIr', 'href')));
    await p.screenshot({ path: 'capturas/04-' + nombre + '-pedir.png' });
    await p.click('[data-canal="correo"]');
    ok(nombre + ': cambia a correo y conserva el mensaje', (await p.locator('[data-canal="correo"].on').count()) === 1 && (await p.inputValue('#pedirMsj')) === msj);
    await p.click('[data-canal="whatsapp"]');
    await p.evaluate(() => { document.getElementById('pedirIr').removeAttribute('target'); document.getElementById('pedirIr').addEventListener('click', (e) => e.preventDefault()); });
    await p.click('#pedirIr'); await p.waitForFunction(() => !document.querySelector('#hojaPedir.ver'));
    await p.waitForFunction(() => /solicitados/i.test(document.querySelector('.tarj').textContent));
    const con = llamo(mundo, 'cliente_contacto')[0];
    ok(nombre + ': pedir deja registro y pasa a Documentos solicitados', con && con[2].p_canal === 'whatsapp' && con[2].p_motivo === 'pedir');

    const kiosco = Number(await p.getAttribute('.tarj', 'data-cliente'));
    await p.goto(H + 'cliente.html?id=' + kiosco + '&t=documentos'); await p.waitForSelector('[data-subir]');
    ok(nombre + ': el líder no ve botones de revisión', (await p.locator('#revisarTodo').count()) === 0 && (await p.locator('#cambiarEstatus').count()) === 0);
    const antes = await p.locator('[data-subir]').count();
    await p.setInputFiles('#archivo', []); 
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.locator('[data-subir^="cedula"]').first().click()]);
    await fc.setFiles(PDF);
    await p.waitForFunction((n) => document.querySelectorAll('[data-subir]').length < n, antes);
    const reg = llamo(mundo, 'documentos_registrar')[0];
    ok(nombre + ': subir guarda el archivo en la carpeta del cliente', reg && reg[2].p_items[0].casillas[0].casilla === 'cedula' && reg[2].p_items[0].archivos[0].ruta.indexOf(kiosco + '/') === 0 && mundo.llamadas.some((l) => l[0] === 'subir'));
    ok(nombre + ': la casilla queda Por revisar', (await p.locator('.casilla:has-text("Cédula") :text("Por revisar")').count()) >= 1);
    mundo.fallaSubida = true;
    const [fc2] = await Promise.all([p.waitForEvent('filechooser'), p.locator('[data-subir]').first().click()]);
    await fc2.setFiles(PDF); await p.waitForSelector('.toast');
    ok(nombre + ': si la subida falla avisa y no registra', llamo(mundo, 'documentos_registrar').length === 1);
    mundo.fallaSubida = false;
    const [fc3] = await Promise.all([p.waitForEvent('filechooser'), p.locator('[data-subir]').first().click()]);
    await fc3.setFiles({ name: 'virus.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('x') });
    await p.waitForFunction(() => Array.from(document.querySelectorAll('.toast')).some((t) => /no es una foto ni un PDF/.test(t.textContent)));
    ok(nombre + ': rechaza archivos que no son foto ni PDF', llamo(mundo, 'documentos_registrar').length === 1);

    // Subir varios marcando qué trae cada archivo
    await p.waitForFunction(() => { const b = document.getElementById('subirVarios'); return b && !b.disabled; });
    await p.click('#subirVarios'); await p.waitForSelector('#hojaVarios.ver');
    await p.setInputFiles('#archivosLote', [{ name: 'rif.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 a') }]);
    await p.waitForSelector('#hojaVarios .arch');
    ok(nombre + ': sin marcar qué trae no deja guardar', await p.locator('#guardarLote').isDisabled());
    await p.locator('#hojaVarios .arch [data-marca]').first().click();
    await p.screenshot({ path: 'capturas/04-' + nombre + '-varios.png' });
    await p.click('#guardarLote'); await p.waitForFunction(() => !document.querySelector('#hojaVarios.ver'));
    ok(nombre + ': subir varios registra', llamo(mundo, 'documentos_registrar').length === 2);
    ok(nombre + ': Documentos sin desborde', await sinDesborde(p));

    // Nota en el hilo
    if(nombre === 'tel') await p.click('[data-tab="hilo"]');
    await p.fill('#nota', 'Llamé y <b>manda</b> mañana'); await p.press('#nota', 'Enter');
    await p.waitForFunction(() => document.getElementById('hilo').textContent.includes('manda'));
    ok(nombre + ': la nota entra al hilo como texto', (await p.locator('#hilo b:text-is("manda")').count()) === 0 && llamo(mundo, 'cliente_nota').length === 1);
    await ctx.close();

    // ----- Administrador: revisar, devolver, datos y comisión -----
    const b = await contexto(nav, dispositivo); const m = b.mundo;
    const q = await entrar(b.ctx, 'marcos', '482913'); q.on('pageerror', (e) => errores.push(e.message));
    await q.goto(H + 'cliente.html?id=1001&t=documentos&revisar=1'); await q.waitForSelector('#hojaVer.ver');
    ok(nombre + ': Revisar abre la cola', (await q.textContent('#hojaVer')).includes('Documento 1 de 4'));
    await q.screenshot({ path: 'capturas/04-' + nombre + '-revisar.png' });
    await q.click('#verAprobar'); await q.waitForFunction(() => document.getElementById('hojaVer').textContent.includes('de 3') || document.getElementById('hojaVer').textContent.includes('Documento 2'));
    ok(nombre + ': Aprobar pasa al siguiente', llamo(m, 'documento_revisar')[0][2].p_accion === 'aprobar');
    await q.click('#verDevolver'); await q.waitForSelector('#devConfirmar');
    ok(nombre + ': Devolver exige motivo', await q.locator('#devConfirmar').isDisabled());
    await q.click('[data-motivo="ilegible"]'); await q.fill('#notaDev', 'No se lee el número'); await q.click('#devConfirmar');
    await q.waitForFunction(() => window.__n === undefined && document.querySelectorAll('.toast').length > 0);
    const dev = llamo(m, 'documento_revisar')[1];
    ok(nombre + ': Devolver guarda motivo y nota', dev && dev[2].p_accion === 'devolver' && dev[2].p_motivo === 'ilegible' && dev[2].p_nota === 'No se lee el número');
    await q.goto(H + 'cliente.html?id=1001&t=documentos'); await q.waitForSelector('.casilla');
    ok(nombre + ': con un devuelto pasa a Documentos pendientes', (await q.textContent('#cabFicha')).includes('pendientes') && (await q.locator('.casilla :text("Devuelto")').count()) >= 1);

    await q.goto(H + 'cliente.html?id=1001&t=datos'); await q.waitForSelector('#cambiarEstatus');
    await q.click('[data-regimen="conjunta"]'); await q.waitForFunction(() => document.querySelector('[data-regimen="conjunta"]').className.includes('on'));
    ok(nombre + ': régimen de firma se guarda', llamo(m, 'cliente_dato').some((l) => l[2].p_campo === 'regimen_firma' && l[2].p_valor === 'conjunta'));
    await q.click('[data-interr="es_isp"]'); await q.waitForFunction(() => document.querySelector('[data-interr="es_isp"]').getAttribute('aria-checked') === 'true');
    ok(nombre + ': marcar ISP se guarda', llamo(m, 'cliente_dato').some((l) => l[2].p_campo === 'es_isp'));
    await q.click('#cambiarEstatus'); await q.waitForSelector('#hojaEstatus.ver');
    await q.screenshot({ path: 'capturas/04-' + nombre + '-estatus.png' });
    await q.locator('#hojaEstatus [data-estatus]').first().click(); 
    ok(nombre + ': cambiar estatus pide elegir antes', (await q.locator('#guardarEstatus').count()) === 1);
    await q.keyboard.press('Escape'); await q.waitForFunction(() => !document.querySelector('#hojaEstatus.ver'));
    await q.locator('[data-gestion="proforma"]').click(); await q.waitForFunction(() => /quitar|enviada/i.test(document.getElementById('tab-datos').textContent));
    ok(nombre + ': gestión del analista se marca', llamo(m, 'cliente_gestion').length === 1);
    if(nombre === 'tel') await q.click('[data-tab="comision"]');
    await q.locator('[data-pago]').first().click(); await q.waitForFunction(() => document.querySelectorAll('.toast').length > 0);
    ok(nombre + ': pago manual llama al servidor', llamo(m, 'instalacion_pago').length === 1);
    ok(nombre + ': ficha sin desborde', await sinDesborde(q));
    m.fallaRpc = 'cliente_ficha'; await q.goto(H + 'cliente.html?id=1001'); await q.waitForSelector('#reintentar');
    ok(nombre + ': si la ficha falla ofrece Reintentar', true);
    m.fallaRpc = null; await q.goto(H + 'cliente.html?id=999999'); await q.waitForSelector('#cabFicha .aviso');
    ok(nombre + ': cliente que no existe lo dice', (await q.textContent('#cabFicha')).includes('No tienes acceso'));
    await b.ctx.close();
  }
  ok('sin errores de JavaScript', errores.length === 0); if(errores.length) console.log(errores);
  await nav.close(); cerrar();
})();
