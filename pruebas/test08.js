// Tanda C: proforma y carta de bienvenida en PDF con el formato original, envío por WhatsApp y correo, y bienvenidas por enviar.
const fs = require('fs'); const { execFileSync } = require('child_process');
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
const abiertas = (p) => p.evaluate(() => window.Comun.hojasAbiertas().join());
const cerrarTodo = async (p) => { for(let i = 0; i < 5; i++){ if(await p.evaluate(() => !!window.Comun.hojaAbierta())) await p.keyboard.press('Escape'); } await p.waitForFunction(() => !window.Comun.hojaAbierta()); };
const abrirCliente = async (p, texto) => { await p.fill('#busca', texto); await p.waitForFunction((t) => document.querySelectorAll('.cli').length === 1 && document.querySelector('.cli').textContent.includes(t), texto); await p.locator('.cli').first().click(); await p.waitForSelector('#hojaFicha.ver #tFicha'); };
const texto = (ruta) => { try { return execFileSync('pdftotext', [ruta, '-']).toString().replace(/\s+/g, ' '); } catch (e) { return null; } };
const llamo = (m, n) => m.llamadas.filter((l) => l[1] === n);
(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const tel = nombre === 'tel';
    const { ctx, mundo } = await contexto(nav, Object.assign({ acceptDownloads: true }, dispositivo));
    await ctx.route('https://wa.me/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'chat' }));
    // En el teléfono se comparte el archivo: se simula la hoja de Compartir del sistema
    if(tel) await ctx.addInitScript(() => { navigator.canShare = () => true; navigator.share = (d) => { window.__compartido = { nombres: (d.files || []).map((f) => f.name), tipos: (d.files || []).map((f) => f.type), texto: d.text || '', titulo: d.title || '' }; return Promise.resolve(); }; });
    await ctx.addInitScript(() => { try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__copiado = t; return Promise.resolve(); } }, configurable: true }); } catch (e) {} });
    // Un servicio sin IP y la líder con WhatsApp y correo en Usuarios
    const faro = mundo.datos.clientes[0]; faro.servicios[0].ip = null; faro.direccion = 'Av. 5 de Julio con calle 72, local 3';
    Object.assign(mundo.personas[1], { whatsapp: '04145550199', correo: 'lucia@prueba.test' });
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'clientes.html?f=todos'); await p.waitForSelector('.cli');
    await abrirCliente(p, 'Vidrios El Faro');
    ok(nombre + ': cada servicio dice si ya se envió y ofrece Proforma y carta', (await p.locator('[data-enviar]').count()) === 2 && (await p.textContent('#tab-datos')).includes('Proforma y carta sin enviar') && (await p.locator('[data-gestion]').count()) === 0);
    await p.locator('[data-enviar]').first().click(); await p.waitForSelector('#hojaEnviar.ver #envWa');
    let h = await p.textContent('#hojaEnviar');
    ok(nombre + ': avisa antes de generar que falta la IP', h.includes('no tiene IP') && h.includes('Pendiente por asignar') && (await p.locator('#envIp').count()) === 1);
    ok(nombre + ': propone Las dos y los números del cliente', (await p.locator('[data-env-tipo="ambas"].on').count()) === 1 && (await p.locator('#envNum option').count()) >= 2 && (await p.textContent('#envNum')).includes('representante'));
    ok(nombre + ': la hoja de envío no desborda', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/08-' + nombre + '-enviar.png' });

    // Los PDF: formato original con los datos corregidos
    const pdfs = await p.evaluate(async () => { const D = window.Documentos; const F = await window.Comun.rpc('cliente_ficha', { p_cliente: document.querySelector('.cli').dataset.cliente });
      const x = D.datosDe(F, F.servicios.find((s) => !s.ip), '04145550134'); const b64 = async (b) => { const u = new Uint8Array(await b.arrayBuffer()); let s = ''; u.forEach((c) => { s += String.fromCharCode(c); }); return btoa(s); };
      return { x, proforma: await b64(D.proforma(x)), carta: await b64(D.carta(x)), aliado: await b64(D.carta(Object.assign({}, x, { lider: '', liderWhatsapp: '', liderCorreo: '' }))) }; });
    const guardar = (k) => { const r = 'capturas/08-' + nombre + '-' + k + '.pdf'; fs.writeFileSync(r, Buffer.from(pdfs[k], 'base64')); return r; };
    const bp = Buffer.from(pdfs.proforma, 'base64');
    ok(nombre + ': los PDF están bien armados', bp.slice(0, 8).toString() === '%PDF-1.4' && bp.slice(-6).toString().includes('%%EOF') && bp.includes('/Helvetica-Bold') && bp.includes('/Subtype /Image') && bp.includes('portal-de-pagos.html'));
    ok(nombre + ': datos del cliente con formato', pdfs.x.identificacion === 'J-59100001-1' && pdfs.x.tipoDocumento === 'RIF' && pdfs.x.telefono === '0414 555 0134' && pdfs.x.contrato === '99100001' && /^\d\d\/\d\d\/\d{4}$/.test(pdfs.x.fecha) && pdfs.x.nombre === 'Vidrios El Faro, C.A.');
    const tp = texto(guardar('proforma')); const tc = texto(guardar('carta')); const ta = texto(guardar('aliado'));
    if(tp !== null){
      ok(nombre + ': proforma con la descripción y el monto fijos', tp.includes('Instalación / Activación de servicio de internet') && (tp.match(/\$60\.00/g) || []).length === 2 && tp.includes('Hola, Vidrios El Faro, C.A.') && tp.includes('J-59100001-1') && tp.includes('0414 555 0134') && tp.includes('0191-0032442132-071165') && tp.includes('Gracias por su confianza'));
      ok(nombre + ': carta con producto, DNS, gateway, día límite e IP pendiente', tc.includes('Servicio de internet') && (tc.match(/190\.124\.28\.22/g) || []).length === 2 && tc.includes('Automático') && tc.includes('antes del 10 de cada mes') && (tc.match(/Pendiente por asignar/g) || []).length === 2 && tc.includes('CONFIGURACIÓN DE DIRECCIONES IP'));
      ok(nombre + ': carta con el líder, su WhatsApp y su correo', tc.includes('Lucía Ferrer') && tc.includes('0414 555 0199') && tc.includes('lucia@prueba.test') && tc.includes('su Líder de Ventas asignado'));
      ok(nombre + ': carta de aliado sin líder ni sus datos', !/L[IÍ]DER DE VENTAS/i.test(ta) && !ta.includes('WHATSAPP') && ta.includes('nuestro equipo de atención') && ta.includes('Gracias por elegirnos'));
    }
    ok(nombre + ': nombres limpios', await p.evaluate(() => { const L = window.Documentos.limpiarNombre; return L('  Bakery   Motion CA ') === 'Bakery Motion, C.A.' && L('Esnet C.A') === 'Esnet, C.A.' && L('Inversiones Uno , S.A..') === 'Inversiones Uno, S.A.' && L('Lilibeth Elena Montero') === 'Lilibeth Elena Montero' && window.Documentos.telFmt('584145550134') === '0414 555 0134'; }));

    // Enviar por WhatsApp
    if(tel){
      await p.click('#envWa'); await p.waitForFunction(() => !!window.__compartido);
      const c = await p.evaluate(() => [window.__compartido, window.__copiado]);
      ok(nombre + ': comparte los dos PDF y copia el número', c[0].nombres.join() === 'Proforma_Vidrios_El_Faro_C_A.pdf,Carta_Bienvenida_Vidrios_El_Faro_C_A.pdf' && c[0].tipos.every((t) => t === 'application/pdf') && c[0].texto.includes('carta de bienvenida') && c[1] === '0414 555 0134');
    } else {
      const bajadas = []; p.on('download', (d) => bajadas.push(d.suggestedFilename()));
      const [chat] = await Promise.all([ctx.waitForEvent('page'), p.click('#envWa')]);
      await p.waitForFunction(() => !document.querySelector('#hojaEnviar.ver'));
      ok(nombre + ': descarga los dos PDF, copia el número y abre el chat', bajadas.sort().join() === 'Carta_Bienvenida_Vidrios_El_Faro_C_A.pdf,Proforma_Vidrios_El_Faro_C_A.pdf' && chat.url().includes('wa.me/584145550134') && decodeURIComponent(chat.url()).includes('carta de bienvenida') && (await p.evaluate(() => window.__copiado)) === '0414 555 0134');
      await chat.close();
    }
    await p.waitForFunction(() => /Carta enviada el/.test(document.getElementById('tab-datos').textContent));
    const reg = llamo(mundo, 'envio_registrar').pop();
    ok(nombre + ': queda anotado quién, qué y por dónde', reg[2].p_tipos.join() === 'proforma,bienvenida' && reg[2].p_canal === 'whatsapp' && reg[2].p_destino === '0414 555 0134' && (await p.textContent('#tab-datos')).includes('Marcos'));
    await p.click('[data-tab="hilo"]');
    ok(nombre + ': el hilo lo cuenta', (await p.textContent('#tab-hilo')).includes('envió la proforma y la carta de bienvenida por WhatsApp'));
    await p.click('[data-tab="datos"]');

    // Otro número y correo formal
    await p.locator('[data-enviar]').first().click(); await p.waitForSelector('#hojaEnviar.ver #envWa');
    await p.selectOption('#envNum', ''); await p.fill('#envOtro', '0414'); await p.click('#envWa');
    ok(nombre + ': un número incompleto se avisa', (await p.textContent('#eEnv')).includes('número de WhatsApp completo'));
    const antes = llamo(mundo, 'envio_registrar').length;
    if(tel) await p.evaluate(() => { window.__compartido = null; });
    await p.click('#envCorreo'); await p.waitForFunction((n) => true, antes);
    await p.waitForFunction(() => !document.querySelector('#hojaEnviar.ver'));
    const co = llamo(mundo, 'envio_registrar').pop();
    ok(nombre + ': el correo lleva las dos y queda anotado', llamo(mundo, 'envio_registrar').length === antes + 1 && co[2].p_canal === 'correo' && co[2].p_destino === 'gerente@vidrioselfaro.test' && co[2].p_tipos.length === 2);
    if(tel){ const c = await p.evaluate(() => window.__compartido); ok(nombre + ': el correo formal va con asunto, texto y los dos PDF', c.nombres.length === 2 && c.titulo.includes('Bienvenido a Airtek Empresas') && c.texto.includes('Estimados señores de Vidrios El Faro, C.A.') && c.texto.includes('Atentamente')); }
    await cerrarTodo(p);

    // Sin dueño no sale la carta
    await abrirCliente(p, 'Comercial de Prueba 8,'); await p.locator('[data-enviar]').first().click(); await p.waitForSelector('#hojaEnviar.ver #envWa');
    ok(nombre + ': sin dueño solo se puede la proforma', (await p.textContent('#hojaEnviar')).includes('cuando la instalación tenga dueño') && await p.locator('[data-env-tipo="bienvenida"]').isDisabled() && await p.locator('[data-env-tipo="ambas"]').isDisabled() && (await p.locator('[data-env-tipo="proforma"].on').count()) === 1 && (await p.locator('[data-env-ver="bienvenida"]').count()) === 0);
    await p.click('#envCorreo');
    ok(nombre + ': sin correo del cliente se explica qué hacer', (await p.textContent('#eEnv')).includes('no tiene correo'));
    await cerrarTodo(p); await ctx.close();

    // Inicio de la analista: bienvenidas por enviar
    const s = await contexto(nav, dispositivo); const q = await entrar(s.ctx, 'elena', '315806'); q.on('pageerror', (e) => errores.push(e.message));
    await q.waitForSelector('[data-pend="bienvenidas"]');
    ok(nombre + ': Inicio lista las bienvenidas por enviar y las pendientes por asignar', /\d+ bienvenidas por enviar/.test(await q.textContent('[data-pend="bienvenidas"]')) && (await q.textContent('[data-pend="asignar"]')).includes('2 instalaciones por asignar'));
    await q.screenshot({ path: 'capturas/08-' + nombre + '-inicio.png', fullPage: true });
    await q.click('[data-pend="bienvenidas"]'); await q.waitForSelector('#hojaBienv.ver [data-bienv]');
    const n = await q.locator('#hojaBienv [data-bienv]').count();
    ok(nombre + ': la lista trae las instalaciones con dueño y marca las que no tienen IP', n >= 5 && !(await q.textContent('#hojaBienv')).includes('Comercial de Prueba 8,') && !q.url().includes('bienvenidas'));
    ok(nombre + ': lista de bienvenidas sin desborde', await sinDesborde(q));
    await q.screenshot({ path: 'capturas/08-' + nombre + '-bienvenidas.png' });
    await q.locator('#hojaBienv [data-bienv]').first().click(); await q.waitForSelector('#hojaEnviar.ver #envManual');
    ok(nombre + ': al tocar una se abre lista para enviar', (await abiertas(q)) === 'hojaBienv,hojaFicha,hojaEnviar');
    await q.click('#envManual'); await q.click('#envManual'); await q.waitForFunction(() => !document.querySelector('#hojaEnviar.ver'));
    await q.keyboard.press('Escape'); await q.waitForFunction((k) => window.Comun.hojasAbiertas().join() === 'hojaBienv' && document.querySelectorAll('#hojaBienv [data-bienv]').length === k - 1, n);
    ok(nombre + ': la enviada sale de la lista', true);
    await s.ctx.close();

    // La líder también puede enviar las suyas
    const l = await contexto(nav, dispositivo); const r = await entrar(l.ctx, 'lucia', '739105'); r.on('pageerror', (e) => errores.push(e.message));
    await r.waitForSelector('[data-pend="bienvenidas"]'); await r.click('[data-pend="bienvenidas"]'); await r.waitForSelector('#hojaBienv.ver [data-bienv]');
    ok(nombre + ': la líder ve solo las bienvenidas de sus clientes', (await r.locator('#hojaBienv [data-bienv]').count()) === 3);
    await r.locator('#hojaBienv [data-bienv]').first().click(); await r.waitForSelector('#hojaEnviar.ver #envWa');
    ok(nombre + ': la líder puede enviar pero no marcar por fuera', (await r.locator('#envManual').count()) === 0 && (await r.locator('#envCorreo').count()) === 1);
    await l.ctx.close();
  }
  ok('sin errores de JavaScript', errores.length === 0, errores);
  await nav.close(); cerrar();
})().catch((e) => { console.error(e); process.exit(1); });
