// Tanda B: gestionar desde la hoja de comisión sin saltar, casilla de Contacto, actas agregables, contrato desde Pendiente por firmar,
// servicios con número grande, ISP solo con dedicado, IP por servicio y Usuarios con WhatsApp, correo y Analista Senior.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar, plegables } = require('./simulador');
const { ok, cerrar } = marcador();
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const abiertas = (p) => p.evaluate(() => window.Comun.hojasAbiertas().join());
const abrirCliente = async (p, texto) => { await p.fill('#busca', texto); await p.waitForFunction((t) => document.querySelectorAll('.cli').length === 1 && document.querySelector('.cli').textContent.includes(t), texto); await p.locator('.cli').filter({ hasText: texto }).first().click(); await p.waitForSelector('#hojaFicha.ver #tFicha'); };
const cerrarTodo = async (p) => { for(let i = 0; i < 4; i++){ if(await p.evaluate(() => !!window.Comun.hojaAbierta())) await p.keyboard.press('Escape'); } await p.waitForFunction(() => !window.Comun.hojaAbierta()); };
(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'clientes.html?f=todos'); await p.waitForSelector('.cli');
    await abrirCliente(p, 'Vidrios El Faro');
    ok(nombre + ': servicios del RIF con el número grande', (await p.textContent('.serv-n b')) === '2' && (await p.textContent('.serv-n span')).includes('Servicios en este RIF'));
    ok(nombre + ': con dedicado sí sale el interruptor de ISP', (await p.locator('[data-interr="es_isp"]').count()) === 1);
    ok(nombre + ': cada servicio muestra su IP y deja cambiarla', (await p.locator('.srv-ip').count()) === 2 && (await p.textContent('.srv-ip')).includes('IPv4 10.24.1.6'));
    await p.locator('[data-ip]').first().click(); await p.waitForSelector('#hojaCampo.ver #cIp');
    await p.fill('#cIp', '999.1.1'); await p.click('#guardarCampo'); await p.waitForFunction(() => document.getElementById('eCampo').textContent.length > 3);
    ok(nombre + ': una IP mal escrita se avisa debajo del campo', (await p.textContent('#eCampo')).includes('IPv4'));
    await p.fill('#cIp', '190.124.30.15'); await p.fill('#cIp6', '2803:1a00:10::1'); await p.screenshot({ path: 'capturas/07-' + nombre + '-ip.png' });
    await p.click('#guardarCampo'); await p.waitForFunction(() => document.querySelector('.srv-ip').textContent.includes('190.124.30.15'));
    ok(nombre + ': guarda IPv4 e IPv6 del servicio', (await p.textContent('.srv-ip')).includes('IPv6 2803:1a00:10::1') && mundo.llamadas.some((l) => l[1] === 'servicio_ip' && l[2].p_ip === '190.124.30.15'));
    ok(nombre + ': Datos sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/07-' + nombre + '-datos.png' });
    await p.click('[data-tab="documentos"]');
    const rep = await p.textContent('[data-grupo="rep1"]');
    ok(nombre + ': Contacto es una sola casilla con teléfono y correo', (await p.locator('[data-grupo="rep1"] [data-campo]').count()) === 1 && rep.includes('Contacto') && rep.includes('0414-555 01 34 · gerente@vidrioselfaro.test') && !rep.includes('Teléfono'));
    ok(nombre + ': actas de asamblea: solo las que hay y un botón para agregar', (await p.locator('[data-casilla^="acta_asamblea"]').count()) === 1 && (await p.locator('#agregarActa').count()) === 1);
    for(let i = 0; i < 14; i++) await p.click('#agregarActa');
    ok(nombre + ': se agregan hasta 15 y el botón desaparece', (await p.locator('[data-casilla^="acta_asamblea"]').count()) === 15 && (await p.locator('#agregarActa').count()) === 0);
    ok(nombre + ': el acta sin fecha lo dice', (await p.textContent('[data-casilla="acta_asamblea:1"]')).includes('Falta la fecha del acta'));
    // Lote 22/10: cada acta lleva su fecha
    await p.click('[data-casilla="acta_asamblea:1"]'); await p.waitForSelector('#fechaActa');
    await p.fill('#fechaActa', '2019-05-20'); await p.click('#guardarFechaActa');
    await p.waitForFunction(() => /Acta del/.test(document.querySelector('#tab-documentos [data-casilla="acta_asamblea:1"]').textContent));
    ok(nombre + ': guarda la fecha del acta y la muestra', mundo.llamadas.some((l) => l[1] === 'documento_fecha_acta' && l[2].p_fecha === '2019-05-20'));
    await cerrarTodo(p); await abrirCliente(p, 'Vidrios El Faro'); await p.click('[data-tab="documentos"]');
    for(let i = 0; i < 9; i++) await p.click('#agregarRep');
    ok(nombre + ': se agregan hasta 10 representantes', (await p.locator('#tab-documentos [data-grupo^="rep"]').count()) === 10 && (await p.locator('#agregarRep').count()) === 0);
    ok(nombre + ': en revisión todavía no se ve el contrato', (await p.locator('[data-grupo="contrato"]').count()) === 0);
    await p.screenshot({ path: 'capturas/07-' + nombre + '-documentos.png' });
    await cerrarTodo(p);
    // Lote 21/10: el contrato vive en la pestaña Contrato (una tarjeta por contrato)
    await abrirCliente(p, 'Posada Brisa Marina'); await p.click('[data-tab="contrato"]');
    ok(nombre + ': en Pendiente por firmar aparece el contrato', (await p.locator('#tab-contrato .ctr-ded [data-subir="contrato_dedicado:0"]').count()) === 1 && (await p.textContent('#tab-contrato .ctr-ded')).includes('Por firmar') && (await p.locator('#tab-documentos [data-grupo="contrato"]').count()) === 0);
    await cerrarTodo(p);
    await abrirCliente(p, 'Tornillos El Yunque');
    ok(nombre + ': sin dedicado no sale el interruptor de ISP', (await p.locator('[data-interr="es_isp"]').count()) === 0 && (await p.locator('[data-interr="es_top"]').count()) === 1);
    await p.click('[data-tab="contrato"]');
    ok(nombre + ': firmado conserva su contrato', (await p.locator('#tab-contrato .ctr-pyme').count()) === 1 && (await p.textContent('#tab-contrato .ctr-pyme')).includes('Firmado'));
    await cerrarTodo(p);
    await abrirCliente(p, 'Kiosco La Parada'); await p.click('[data-tab="documentos"]');
    ok(nombre + ': natural: contacto opcional y sin contrato', (await p.textContent('[data-grupo="rep1"] [data-campo]')).includes('Opcional') && (await p.locator('[data-grupo="contrato"]').count()) === 0 && (await p.locator('.chip.rojo:has-text("Falta")').count()) === 2);
    await cerrarTodo(p);

    // Desde la hoja de comisión: subir y escribir sin abrir el expediente
    await p.goto(H + 'comisiones.html?q=Prueba 7,'); await p.waitForSelector('[data-com]');
    await p.locator('[data-com]').first().click(); await p.waitForSelector('#hojaComision.ver [data-plg-btn="legal"]');
    const antes = mundo.llamadas.filter((l) => l[1] === 'documentos_registrar').length;
    if(await p.evaluate(() => document.getElementById('docsCom').hidden)) await p.click('[data-docs-com]'); await p.waitForSelector('#docsCom [data-subir="cedula:1"]');
    const [selector] = await Promise.all([p.waitForEvent('filechooser'), p.locator('#docsCom [data-subir="cedula:1"]').click()]);
    mundo.lento = 900;
    await selector.setFiles({ name: 'cedula.png', mimeType: 'image/png', buffer: PNG });
    await p.waitForFunction(() => { const b = document.querySelector('#docsCom [data-casilla="cedula:1"]'); return b && /Subiendo/.test(b.textContent); });
    ok(nombre + ': en la comisión la casilla dice Subiendo mientras sube', /Subiendo a Drive/.test(await p.textContent('#docsCom [data-casilla="cedula:1"]')));
    await p.waitForFunction(() => /Por revisar/.test((document.querySelector('#docsCom [data-casilla="cedula:1"]') || {}).textContent || ''));
    mundo.lento = 0;
    const reg = mundo.llamadas.filter((l) => l[1] === 'documentos_registrar');
    ok(nombre + ': se sube la cédula desde la comisión, sin abrir el expediente', reg.length === antes + 1 && reg.pop()[2].p_items[0].casillas[0].casilla === 'cedula' && (await abiertas(p)) === 'hojaComision');
    await p.locator('#docsCom [data-campo="rep:1"]').click(); await p.waitForSelector('#hojaCampo.ver #cCorreo');
    ok(nombre + ': el contacto se escribe en una hoja encima de la comisión', (await abiertas(p)) === 'hojaComision,hojaCampo');
    await p.fill('#cCorreo', 'compras@prueba7.test'); await p.click('#guardarCampo');
    await p.waitForFunction(() => window.Comun.hojasAbiertas().join() === 'hojaComision' && document.querySelector('#hojaComision').textContent.includes('compras@prueba7.test'));
    ok(nombre + ': al guardar se vuelve a la comisión ya actualizada', mundo.llamadas.some((l) => l[1] === 'cliente_representante' && l[2].p_correo === 'compras@prueba7.test'));
    await p.locator('#docsCom [data-campo="correo_empresa"]').click(); await p.waitForSelector('#hojaCampo.ver #cCorreo'); await p.fill('#cCorreo', 'no-es-correo'); await p.click('#guardarCampo');
    ok(nombre + ': el error se dice debajo del campo', (await p.textContent('#eCampo')).includes('no parece válido'));
    ok(nombre + ': comisión con hojas sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/07-' + nombre + '-comision.png' });
    await cerrarTodo(p);

    // Usuarios: WhatsApp, correo y Analista Senior
    await p.goto(H + 'usuarios.html'); await p.waitForSelector('.persona');
    ok(nombre + ': la lista distingue a la Analista Senior', (await p.locator('.persona').filter({ hasText: 'Elena Soto' }).textContent()).includes('Analista Senior'));
    await p.locator('.persona').filter({ hasText: 'Pedro Salas' }).click(); await p.waitForSelector('#hojaUsuario.ver');
    await p.selectOption('#fRol', 'analista_senior'); await p.fill('#fWhatsapp', '0414'); await p.click('#guardar');
    ok(nombre + ': un WhatsApp incompleto no pasa', (await p.textContent('#eWhatsapp')).includes('número completo'));
    await p.fill('#fWhatsapp', '0414-555 01 99'); await p.fill('#fCorreo', 'Pedro@Prueba.test'); await p.screenshot({ path: 'capturas/07-' + nombre + '-usuario.png' });
    await p.click('#guardar'); await p.waitForFunction(() => !document.querySelector('#hojaUsuario.ver'));
    const ed = mundo.llamadas.filter((l) => l[0] === 'usuarios' && l[1].accion === 'editar').pop();
    ok(nombre + ': guarda rol Analista Senior, WhatsApp y correo', ed && ed[1].rol === 'analista' && ed[1].senior === true && ed[1].whatsapp === '04145550199' && ed[1].correo === 'pedro@prueba.test' && mundo.personas[2].senior === true);
    await p.locator('.persona').filter({ hasText: 'Pedro Salas' }).click(); await p.waitForSelector('#hojaUsuario.ver');
    ok(nombre + ': al volver a abrir trae lo guardado', (await p.inputValue('#fRol')) === 'analista_senior' && (await p.inputValue('#fWhatsapp')) === '04145550199');
    ok(nombre + ': Usuarios sin desborde', await sinDesborde(p));
    await ctx.close();
  }
  ok('sin errores de JavaScript', errores.length === 0, errores);
  await nav.close(); cerrar();
})().catch((e) => { console.error(e); process.exit(1); });
