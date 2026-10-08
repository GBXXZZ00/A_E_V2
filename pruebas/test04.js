// Clientes y expediente: la lista se queda, el cliente sale encima; filtros, documentos, revisión, datos y comisión.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
const PDF = { name: 'cedula.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 prueba') };
const llamo = (m, f) => m.llamadas.filter((l) => l[0] === 'rpc' && l[1] === f);
const abiertas = (p) => p.evaluate(() => window.Comun.hojasAbiertas());
(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    // ----- Líder: lista, búsqueda, expediente encima, pedir y subir -----
    const { ctx, mundo } = await contexto(nav, dispositivo);
    const p = await entrar(ctx, 'lucia', '739105'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'clientes.html'); await p.waitForSelector('.cli');
    const mias = await p.locator('.cli').count();
    ok(nombre + ': el líder ve solo sus clientes', mias >= 2 && mias <= 4 && (await p.locator('.cli:has-text("Bahía Azul")').count()) === 0);
    ok(nombre + ': el menú de cuenta sigue en la barra', (await p.locator('#cuenta .av').count()) === 1);
    ok(nombre + ': Clientes sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/04-' + nombre + '-lista.png' });
    await p.fill('#busca', 'zzzz'); await p.waitForSelector('#lista .vacio');
    ok(nombre + ': búsqueda sin resultados explica', (await p.locator('.cli').count()) === 0);
    await p.fill('#busca', 'kiosco'); await p.waitForFunction(() => document.querySelectorAll('.cli').length === 1 && document.querySelector('.cli').textContent.includes('Kiosco'));
    ok(nombre + ': la búsqueda queda en la dirección', p.url().includes('q=kiosco'));
    const kiosco = Number(await p.getAttribute('.cli', 'data-cliente'));
    await p.click('.cli'); await p.waitForSelector('#hojaFicha.ver #tFicha');
    ok(nombre + ': el expediente sale encima y la lista sigue detrás', (await abiertas(p)).join() === 'hojaFicha' && (await p.locator('.cli.sel').count()) === 1 && p.url().includes('clientes.html'));
    ok(nombre + ': abre en Datos', (await p.locator('#tabs .on').textContent()).trim() === 'Datos' && (await p.locator('#tab-datos .tj').count()) >= 3);
    await p.click('[data-tab="documentos"]');
    ok(nombre + ': Documentos trae los tres números y los bloques', (await p.locator('#tab-documentos .res b').count()) === 3 && (await p.textContent('#tab-documentos')).includes('Contacto') && (await p.locator('[data-grupo="empresa"]').count()) === 0);
    ok(nombre + ': el líder no ve botones de revisión', (await p.locator('#revisarTodo').count()) === 0);
    ok(nombre + ': la casilla vacía lleva el signo de más', (await p.locator('[data-subir^="cedula"] .ico.mas').count()) === 1);
    await p.screenshot({ path: 'capturas/04-' + nombre + '-documentos.png' });

    await p.click('#tab-documentos [data-paso^="pedir"]'); await p.waitForSelector('#hojaPedir.ver');
    ok(nombre + ': Pedir sale encima del expediente', (await abiertas(p)).join() === 'hojaFicha,hojaPedir');
    const msj = await p.inputValue('#pedirMsj');
    ok(nombre + ': mensaje listo con lo que falta', msj.length > 40 && (await p.locator('#pedirFalta .chip').count()) >= 1 && !msj.includes('—'));
    ok(nombre + ': el enlace va a WhatsApp', /wa\.me|whatsapp/.test(await p.getAttribute('#pedirIr', 'href')));
    await p.evaluate(() => { document.getElementById('pedirIr').removeAttribute('target'); document.getElementById('pedirIr').addEventListener('click', (e) => e.preventDefault()); });
    await p.click('#pedirIr'); await p.waitForFunction(() => window.Comun.hojasAbiertas().join() === 'hojaFicha');
    await p.waitForFunction(() => /solicitados/i.test(document.getElementById('cabFicha').textContent));
    const con = llamo(mundo, 'cliente_contacto')[0];
    ok(nombre + ': pedir deja registro, vuelve al expediente y pasa a Documentos solicitados', con && con[2].p_canal === 'whatsapp' && con[2].p_motivo === 'pedir');

    const antes = await p.locator('#tab-documentos .doc.falta').count();
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.locator('[data-subir^="cedula"]').first().click()]);
    await fc.setFiles(PDF);
    await p.waitForFunction((n) => document.querySelectorAll('#tab-documentos .doc.falta').length < n, antes);
    const reg = llamo(mundo, 'documentos_registrar')[0];
    ok(nombre + ': subir guarda el archivo en la carpeta del cliente', reg && reg[2].p_items[0].casillas[0].casilla === 'cedula' && reg[2].p_items[0].archivos[0].ruta.indexOf(kiosco + '/') === 0 && mundo.llamadas.some((l) => l[0] === 'subir'));
    ok(nombre + ': la casilla queda Por revisar', (await p.locator('.casilla:has-text("Cédula") :text("Por revisar")').count()) >= 1);
    mundo.fallaSubida = true;
    const [fc2] = await Promise.all([p.waitForEvent('filechooser'), p.locator('#tab-documentos [data-subir]').first().click()]);
    await fc2.setFiles(PDF); await p.waitForFunction(() => Array.from(document.querySelectorAll('.toast')).some((t) => /No se pudo subir/.test(t.textContent)));
    ok(nombre + ': si la subida falla avisa y no registra', llamo(mundo, 'documentos_registrar').length === 1);
    mundo.fallaSubida = false;
    const [fc3] = await Promise.all([p.waitForEvent('filechooser'), p.locator('#tab-documentos [data-subir]').first().click()]);
    await fc3.setFiles({ name: 'virus.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('x') });
    await p.waitForFunction(() => Array.from(document.querySelectorAll('.toast')).some((t) => /no es una foto ni un PDF/.test(t.textContent)));
    ok(nombre + ': rechaza archivos que no son foto ni PDF', llamo(mundo, 'documentos_registrar').length === 1);

    // Teléfono y correo del representante son casillas
    await p.locator('#tab-documentos [data-campo="rep:1"]').first().click(); await p.waitForSelector('#hojaCampo.ver');
    await p.fill('#cCorreo', 'malo'); await p.click('#guardarCampo');
    ok(nombre + ': correo mal escrito se marca debajo del campo', (await p.textContent('#eCampo')).includes('válido'));
    await p.fill('#cCorreo', 'dueno@kiosco.test'); await p.fill('#cTel', '0414-555 02 02'); await p.click('#guardarCampo');
    await p.waitForFunction(() => window.Comun.hojasAbiertas().join() === 'hojaFicha' && document.getElementById('tab-documentos').textContent.includes('dueno@kiosco.test'));
    ok(nombre + ': guarda teléfono y correo del representante', llamo(mundo, 'cliente_representante').length === 1);

    // Subir varios marcando qué trae cada archivo
    await p.waitForFunction(() => { const b = document.getElementById('subirVarios'); return b && !b.disabled; });
    await p.click('#subirVarios'); await p.waitForSelector('#hojaVarios.ver');
    await p.setInputFiles('#archivosLote', [{ name: 'rif.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 a') }]);
    await p.waitForSelector('#hojaVarios .arch');
    ok(nombre + ': sin marcar qué trae no deja guardar', await p.locator('#guardarLote').isDisabled());
    await p.locator('#hojaVarios .arch [data-marca]').nth(1).click();
    await p.screenshot({ path: 'capturas/04-' + nombre + '-varios.png' });
    await p.click('#guardarLote'); await p.waitForFunction(() => window.Comun.hojasAbiertas().join() === 'hojaFicha');
    ok(nombre + ': subir varios registra y vuelve al expediente', llamo(mundo, 'documentos_registrar').length === 2);
    ok(nombre + ': con todo completo pasa a revisión', /revisi/i.test(await p.textContent('#cabFicha')));

    await p.click('[data-tab="hilo"]');
    await p.fill('#nota', 'Llamé y <b>manda</b> mañana'); await p.press('#nota', 'Enter');
    await p.waitForFunction(() => document.getElementById('hilo').textContent.includes('manda'));
    ok(nombre + ': la nota entra al hilo como texto', (await p.locator('#hilo b:text-is("manda")').count()) === 0 && llamo(mundo, 'cliente_nota').length === 1);
    ok(nombre + ': expediente sin desborde', await sinDesborde(p));

    const listas = llamo(mundo, 'clientes_lista2').length;
    await p.click('#cabFicha [data-cierra]'); await p.waitForFunction(() => !window.Comun.hojaAbierta());
    await p.waitForFunction((n) => true, listas);
    ok(nombre + ': al cerrar vuelve a la lista y la refresca', (await p.locator('.cli').count()) === 1 && llamo(mundo, 'clientes_lista2').length > listas);
    await p.click('.cli'); await p.waitForSelector('#hojaFicha.ver #tFicha'); await p.goBack(); await p.waitForFunction(() => !window.Comun.hojaAbierta());
    ok(nombre + ': el botón Atrás cierra el expediente sin salir de Clientes', p.url().includes('clientes.html') && (await p.locator('.cli').count()) === 1);
    await ctx.close();

    // ----- Administrador: filtros, revisar, devolver, datos y comisión -----
    const b = await contexto(nav, dispositivo); const m = b.mundo;
    const q = await entrar(b.ctx, 'marcos', '482913'); q.on('pageerror', (e) => errores.push(e.message));
    await q.goto(H + 'clientes.html?f=todos'); await q.waitForSelector('.cli');
    if(nombre === 'tel'){ await q.click('#abrirFiltros'); await q.waitForSelector('#hojaFiltros.ver'); await q.selectOption('#tlider', 'Tomás Guerra'); await q.screenshot({ path: 'capturas/04-tel-filtros.png' }); await q.click('#verFiltrados'); }
    else await q.selectOption('#plider', 'Tomás Guerra');
    await q.waitForFunction(() => { const f = document.querySelectorAll('.cli'); return f.length > 0 && location.search.includes('lider='); });
    await q.waitForFunction(() => document.getElementById('cuentaLista').textContent.includes('Quitar filtros'));
    const filtrado = llamo(m, 'clientes_lista2').slice(-1)[0][2];
    ok(nombre + ': el filtro de líder viaja al servidor y queda en la dirección', filtrado.p_filtros.lider === 'Tomás Guerra' && q.url().includes('lider='));
    if(nombre === 'pc'){ await q.selectOption('#pestatus', 'documentos_solicitados'); await q.waitForFunction(() => location.search.includes('estatus=')); ok('pc: los filtros se combinan', llamo(m, 'clientes_lista2').slice(-1)[0][2].p_filtros.estatus === 'documentos_solicitados'); }
    await q.click('#quitarFiltros'); await q.waitForFunction(() => !location.search.includes('lider='));
    ok(nombre + ': Quitar filtros los limpia', Object.keys(llamo(m, 'clientes_lista2').slice(-1)[0][2].p_filtros).length === 0);

    await q.goto(H + 'cliente.html?id=1001&t=documentos&revisar=1'); await q.waitForSelector('#hojaVer.ver');
    ok(nombre + ': el enlace viejo lleva a Clientes con el expediente y la revisión encima', q.url().includes('clientes.html') && (await abiertas(q)).join() === 'hojaFicha,hojaVer' && (await q.textContent('#hojaVer')).includes('Documento 1 de 4'));
    await q.screenshot({ path: 'capturas/04-' + nombre + '-revisar.png' });
    await q.click('#verAprobar'); await q.waitForFunction(() => document.getElementById('hojaVer').textContent.includes('Documento 2'));
    ok(nombre + ': Aprobar pasa al siguiente', llamo(m, 'documento_revisar')[0][2].p_accion === 'aprobar');
    await q.click('#verDevolver'); await q.waitForSelector('#devConfirmar');
    ok(nombre + ': Devolver exige motivo', await q.locator('#devConfirmar').isDisabled());
    await q.click('[data-motivo="ilegible"]'); await q.fill('#notaDev', 'No se lee el número'); await q.click('#devConfirmar');
    await q.waitForFunction(() => document.getElementById('hojaVer').textContent.includes('Documento 3') || !document.querySelector('#hojaVer.ver'));
    const dev = llamo(m, 'documento_revisar')[1];
    ok(nombre + ': Devolver guarda motivo y nota', dev && dev[2].p_accion === 'devolver' && dev[2].p_motivo === 'ilegible' && dev[2].p_nota === 'No se lee el número');
    await q.goto(H + 'clientes.html?c=1001&t=documentos'); await q.waitForSelector('#tab-documentos .casilla');
    ok(nombre + ': con un devuelto pasa a Documentos pendientes y la casilla dice por qué', (await q.textContent('#cabFicha')).includes('pendientes') && (await q.locator('.doc.dev').count()) >= 1 && (await q.textContent('.doc.dev')).includes('No se lee el número'));

    await q.click('[data-tab="datos"]'); await q.waitForSelector('#cambiarEstatus');
    await q.click('[data-regimen="conjunta"]'); await q.waitForFunction(() => document.querySelector('[data-regimen="conjunta"]').className.includes('on'));
    ok(nombre + ': régimen de firma se guarda', llamo(m, 'cliente_dato').some((l) => l[2].p_campo === 'regimen_firma' && l[2].p_valor === 'conjunta'));
    await q.click('[data-tab="documentos"]');
    ok(nombre + ': con firma conjunta aparece el representante 2 obligatorio', (await q.locator('[data-grupo="rep2"] .chip.rojo').count()) >= 2);
    await q.click('#agregarRep');
    ok(nombre + ': Agregar representante abre el bloque 3', (await q.locator('[data-grupo="rep3"]').count()) === 1);
    await q.click('[data-tab="datos"]');
    await q.click('[data-interr="es_isp"]'); await q.waitForFunction(() => document.querySelector('[data-interr="es_isp"]').getAttribute('aria-checked') === 'true');
    ok(nombre + ': marcar ISP se guarda', llamo(m, 'cliente_dato').some((l) => l[2].p_campo === 'es_isp'));
    await q.click('#cambiarEstatus'); await q.waitForSelector('#hojaEstatus.ver');
    await q.locator('#hojaEstatus [data-estatus]').first().click();
    ok(nombre + ': cambiar estatus sale encima y pide elegir', (await abiertas(q)).join() === 'hojaFicha,hojaEstatus' && (await q.locator('#guardarEstatus').count()) === 1);
    await q.keyboard.press('Escape'); await q.waitForFunction(() => window.Comun.hojasAbiertas().join() === 'hojaFicha');
    ok(nombre + ': Escape cierra solo la de arriba', true);
    await q.locator('[data-enviar]').first().click(); await q.waitForSelector('#hojaEnviar.ver #envManual');
    await q.click('#envManual'); ok(nombre + ': marcar como enviado pide un segundo toque', llamo(m, 'envio_registrar').length === 0);
    await q.click('#envManual'); await q.waitForFunction(() => /enviada el/i.test(document.getElementById('tab-datos').textContent));
    ok(nombre + ': el envío por fuera queda anotado', llamo(m, 'envio_registrar').length === 1 && llamo(m, 'envio_registrar')[0][2].p_canal === 'manual');
    await q.click('[data-tab="comision"]');
    await q.locator('[data-pago]').first().click(); await q.waitForFunction(() => document.querySelectorAll('.toast').length > 0);
    ok(nombre + ': pago manual llama al servidor', llamo(m, 'instalacion_pago').length === 1);
    ok(nombre + ': expediente del administrador sin desborde', await sinDesborde(q));
    m.fallaRpc = 'cliente_ficha'; await q.goto(H + 'clientes.html?c=1001'); await q.waitForSelector('#hojaFicha #reintentar');
    m.fallaRpc = null; await q.click('#hojaFicha #reintentar'); await q.waitForSelector('#tFicha');
    ok(nombre + ': si el expediente falla, Reintentar lo recupera', true);
    await q.goto(H + 'clientes.html?c=999999'); await q.waitForSelector('#cabFicha .aviso');
    ok(nombre + ': cliente que no existe lo dice', (await q.textContent('#cabFicha')).includes('No tienes acceso'));
    await b.ctx.close();
  }
  ok('sin errores de JavaScript', errores.length === 0); if(errores.length) console.log(errores);
  await nav.close(); cerrar();
})();
