// Enviar pendientes al líder: solo admin, corte en curso, mensaje aprobado sin enlaces, WhatsApp del líder, PDF con más de 12 clientes y registro del envío.
const { execFileSync } = require('child_process');
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
const texto = (ruta) => { try { return execFileSync('pdftotext', [ruta, '-']).toString().replace(/\s+/g, ' '); } catch (e) { return null; } };
const abrirGrupo = async (p, lider) => { const g = p.locator('#lista .grupo[data-lider="' + lider + '"]'); await g.waitFor(); if(!(await g.evaluate((x) => x.classList.contains('abierto')))) await g.locator('.grupo-cab').click(); };
const cerrarTodo = async (p) => { for(let i = 0; i < 4; i++){ if(await p.evaluate(() => !!window.Comun.hojaAbierta())) await p.keyboard.press('Escape'); } await p.waitForFunction(() => !window.Comun.hojaAbierta()); };
(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const tel = nombre === 'tel';
    const { ctx, mundo } = await contexto(nav, Object.assign({ acceptDownloads: true }, dispositivo));
    const chats = []; await ctx.route('https://wa.me/**', (r) => { chats.push(decodeURIComponent(r.request().url())); return r.fulfill({ status: 200, contentType: 'text/html', body: 'chat' }); });
    if(tel) await ctx.addInitScript(() => { navigator.canShare = () => true; navigator.share = (d) => { window.__compartido = { nombres: (d.files || []).map((f) => f.name), texto: d.text || '' }; return Promise.resolve(); }; });
    await ctx.addInitScript(() => { try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__copiado = t; return Promise.resolve(); } }, configurable: true }); } catch (e) {} });
    Object.assign(mundo.personas[1], { whatsapp: '04145550199' });

    // El líder y el analista no ven el botón (cada uno en su equipo)
    for(const [u, pin, quien] of [['lucia', '739105', 'el líder'], ['elena', '315806', 'el Analista Senior']]){
      const otro = await contexto(nav, dispositivo, mundo); const q = await entrar(otro.ctx, u, pin); q.on('pageerror', (e) => errores.push(e.message));
      await q.goto(H + 'comisiones.html'); await q.waitForSelector('#lista .grupo');
      ok(nombre + ': ' + quien + ' no ve Enviar pendientes', (await q.locator('[data-pend]').count()) === 0);
      await otro.ctx.close();
    }
    let p;

    // Admin: mensaje corto con el texto aprobado
    p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'comisiones.html'); await p.waitForSelector('#lista .grupo');
    await abrirGrupo(p, 'Lucía Ferrer');
    ok(nombre + ': el admin ve Enviar pendientes en el grupo del líder', (await p.locator('[data-pend="Lucía Ferrer"]').count()) === 1);
    ok(nombre + ': no sale en el grupo Por asignar', (await p.locator('[data-pend="Por asignar"]').count()) === 0);
    await p.waitForTimeout(300); await p.screenshot({ path: 'capturas/11-' + nombre + '-grupo.png' });
    await p.click('[data-pend="Lucía Ferrer"]'); await p.waitForSelector('#hojaPend.ver #pendMsj');
    let msj = await p.inputValue('#pendMsj');
    ok(nombre + ': saluda al líder y dice el corte y los días', /^(Buenos días|Buenas tardes|Buenas noches), Lucía\. Te paso tus pendientes del corte de [a-z]+\. Cierra (el 20 y falta|hoy)/.test(msj), msj.slice(0, 120));
    ok(nombre + ': numera los clientes y dice qué falta', /\n1\. [^\n]+\(\d+\): /.test(msj) && /falta |debe la instalación|pendiente por asignar/.test(msj), msj);
    ok(nombre + ': cierra con Ya cumplen y la despedida aprobada', /Ya cumplen: \d+ de \d+\./.test(msj) && msj.endsWith('Cualquier documento me lo envías por aquí o lo subes en la app. Gracias.'));
    ok(nombre + ': sin enlaces ni guion largo', !/https?:|www\./.test(msj) && !msj.includes('—'));
    ok(nombre + ': dice a qué número va', (await p.textContent('#hojaPend')).includes('0414 555 0199'));
    ok(nombre + ': la hoja no desborda', await sinDesborde(p));
    await p.waitForTimeout(300); await p.screenshot({ path: 'capturas/11-' + nombre + '-mensaje.png' });
    await p.click('#pendEnviar'); await p.waitForFunction(() => !window.Comun.hojaAbierta());
    const ultimoChat = chats[chats.length - 1] || '';
    ok(nombre + ': abre WhatsApp del líder con el mensaje', ultimoChat.includes('wa.me/584145550199') && ultimoChat.includes('Te paso tus pendientes'), ultimoChat.slice(0, 80));
    const anot = (mundo.bitacora || []).filter((b) => b.accion === 'pendientes_enviados');
    ok(nombre + ': queda anotado quién lo envió', anot.length === 1 && anot[0].usuario === 'marcos' && anot[0].registro_id === 'Lucía Ferrer' && anot[0].despues.pdf === false, anot);

    // Más de 12 clientes: resumen corto y PDF con la lista
    const base = mundo.datos.clientes.find((c) => c.nombre.includes('Faro'));
    for(let i = 0; i < 20; i++){
      const c = JSON.parse(JSON.stringify(base)); c.id = 9000 + i; c.nombre = 'Cliente Inventado ' + (i + 1) + ', C.A.'; c.doc_numero = String(591100000 + i); c.documentos = []; c.legal_ok_en = null;
      c.instalaciones.forEach((x, k) => { x.id = 9500 + i * 10 + k; x.codigo = String(99200000 + i); x.pago_ok_en = null; });
      c.servicios.forEach((x, k) => { x.id = 9800 + i * 10 + k; });
      mundo.datos.clientes.push(c);
    }
    await p.reload(); await p.waitForSelector('#lista .grupo'); await abrirGrupo(p, 'Lucía Ferrer');
    await p.click('[data-pend="Lucía Ferrer"]'); await p.waitForSelector('#hojaPend.ver #pendMsj');
    msj = await p.inputValue('#pendMsj');
    ok(nombre + ': con más de 12 va un resumen corto', /Tienes \d+ clientes con pendientes/.test(msj) && msj.includes('lista completa en PDF') && !msj.includes('Cliente Inventado 7'), msj.slice(0, 300));
    ok(nombre + ': avisa que va con PDF', (await p.locator('#pendVerPdf').count()) === 1 && (await p.textContent('#hojaPend')).includes('lista completa en PDF'));
    if(tel){
      await p.click('#pendEnviar'); await p.waitForFunction(() => !!window.__compartido);
      const comp = await p.evaluate(() => window.__compartido);
      ok('tel: comparte el PDF con el mensaje', comp.nombres.length === 1 && /^Pendientes_Lucia_Ferrer_[a-z]+\.pdf$/.test(comp.nombres[0]) && comp.texto.includes('Tienes'), comp);
      ok('tel: copia el número del líder', (await p.evaluate(() => window.__copiado)) === '0414 555 0199');
    } else {
      const [bajada] = await Promise.all([p.waitForEvent('download'), p.click('#pendEnviar')]);
      const ruta = 'capturas/11-pendientes.pdf'; await bajada.saveAs(ruta);
      const t = texto(ruta);
      ok('pc: descarga el PDF de la lista', /^Pendientes_Lucia_Ferrer_[a-z]+\.pdf$/.test(bajada.suggestedFilename()), bajada.suggestedFilename());
      if(t !== null) ok('pc: el PDF trae a todos los clientes, el último corte primero y las páginas', t.includes('Cliente Inventado 20') && t.includes('Cliente Inventado 1') && /Página 1 de [2-9]/.test(t) && t.includes('Pendientes del corte de'), t.slice(0, 300));
      await p.waitForTimeout(200);
      ok('pc: abre WhatsApp con el resumen', (chats[chats.length - 1] || '').includes('Tienes'));
    }
    await p.waitForFunction(() => !window.Comun.hojaAbierta());
    const anot2 = (mundo.bitacora || []).filter((b) => b.accion === 'pendientes_enviados');
    ok(nombre + ': el segundo envío queda anotado con PDF', anot2.length === 2 && anot2[1].despues.pdf === true && anot2[1].despues.pendientes > 12, anot2);

    // El último envío se muestra; si el servidor falla, lo dice y deja reintentar
    await p.click('[data-pend="Lucía Ferrer"]'); await p.waitForSelector('#hojaPend.ver #pendMsj');
    ok(nombre + ': muestra el último envío', (await p.textContent('#hojaPend')).includes('Último envío'));
    await cerrarTodo(p);
    mundo.fallaRpc = 'pendientes_lider';
    await p.click('[data-pend="Lucía Ferrer"]'); await p.waitForSelector('#hojaPend.ver .vacio');
    ok(nombre + ': si falla dice qué pasó y ofrece Reintentar', (await p.textContent('#hojaPend')).includes('No se pudieron armar') && (await p.locator('#hojaPend .vacio [data-pend]').count()) === 1);
    mundo.fallaRpc = null;
    await p.click('#hojaPend .vacio [data-pend]'); await p.waitForSelector('#hojaPend.ver #pendMsj');
    ok(nombre + ': Reintentar arma el mensaje sin apilar hojas', (await p.evaluate(() => window.Comun.hojasAbiertas().join())) === 'hojaPend');
    await ctx.close();
  }
  ok('sin errores de JavaScript', errores.length === 0, errores);
  await nav.close(); cerrar();
})().catch((e) => { console.error(e); process.exit(1); });
