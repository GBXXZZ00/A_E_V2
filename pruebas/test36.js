// Corrida 14/10 tarde, Parte 4: ajustes del OCR y datos del expediente leídos del RIF.
// Solo el administrador ve "Lectura con OCR" en su menú; los tres interruptores arrancan en NO y cada cambio va al servidor.
// Con "Llenar datos del expediente con OCR" prendido, al subir el RIF de la empresa se proponen razón social y domicilio
// (la persona marca lo que usa); si el RIF del archivo es de otro cliente, avisa; con el ajuste en NO no se llama al OCR.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
const llamo = (m, f) => m.llamadas.filter((l) => l[1] === f);
async function cerrarHojas(p){ for(let i = 0; i < 5 && await p.evaluate(() => !!window.Comun.hojaAbierta()); i++){ await p.keyboard.press('Escape'); await p.waitForTimeout(260); } }

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    const faro = mundo.datos.clientes.find((c) => /Vidrios El Faro/.test(c.nombre));
    faro.documentos = faro.documentos.filter((d) => d.casilla !== 'rif_empresa'); faro.direccion = 'Calle vieja 1';
    // ----- Administrador: los interruptores -----
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    await p.waitForSelector('#cuenta'); await p.click('#cuenta'); await p.waitForSelector('#hojaCuenta.ver [data-ocr-aj]');
    await p.click('#hojaCuenta [data-ocr-aj]'); await p.waitForSelector('#hojaOcrAj.ver [data-ocr-sw]');
    ok(nombre + ': Lectura con OCR tiene los tres ajustes y arrancan en NO', (await p.locator('#hojaOcrAj [data-ocr-sw]').count()) === 3 && (await p.locator('#hojaOcrAj [data-ocr-sw][aria-checked="true"]').count()) === 0);
    ok(nombre + ': ajustes sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/36-' + nombre + '-ajustes.png' });
    await p.click('[data-ocr-sw="expediente"]'); await p.waitForSelector('[data-ocr-sw="expediente"][aria-checked="true"]');
    ok(nombre + ': prender un ajuste pasa por el servidor y queda en la bitácora', llamo(mundo, 'ocr_ajuste_guardar').some((l) => l[2].p_clave === 'expediente' && l[2].p_si === true) && mundo.bitacora.some((b) => b.clave === 'ocr_expediente'));
    await cerrarHojas(p);
    // ----- Expediente: subir el RIF de la empresa propone razón social y domicilio -----
    mundo.ocr = { estado: 'ok', tipo: 'rif_viejo', dudosa: false, datos: { rif: 'J591000011', razon_social: 'VIDRIOS EL FARO INVENTADO, C.A', domicilio: 'AV 2 LOCAL 3 CIUDAD PRUEBA ZONA POSTAL 4001', motivos: [] } };
    await p.goto(H + 'clientes.html?c=' + faro.id + '&t=documentos'); await p.waitForSelector('#hojaFicha.ver [data-subir="rif_empresa:0"]');
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-subir="rif_empresa:0"]')]);
    await fc.setFiles({ name: 'rif.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 rif') });
    await p.waitForSelector('#hojaOcr.ver [data-ocr-campo]');
    const prop = await p.textContent('#hojaOcr');
    ok(nombre + ': propone la razón social y el domicilio del RIF junto a lo de hoy', /VIDRIOS EL FARO INVENTADO/.test(prop) && /ZONA POSTAL 4001/.test(prop) && /Calle vieja 1/.test(prop) && (await p.locator('#hojaOcr [data-ocr-campo]').count()) === 2);
    await p.screenshot({ path: 'capturas/36-' + nombre + '-propuesta.png' });
    await p.uncheck('[data-ocr-campo="nombre"]'); await p.click('#usarOcr'); await p.waitForSelector('#hojaOcr', { state: 'hidden' });
    ok(nombre + ': guarda solo lo marcado (el domicilio)', llamo(mundo, 'cliente_dato').some((l) => l[2].p_campo === 'direccion' && /ZONA POSTAL 4001/.test(l[2].p_valor)) && !llamo(mundo, 'cliente_dato').some((l) => l[2].p_campo === 'nombre') && faro.direccion.includes('ZONA POSTAL 4001'));
    await cerrarHojas(p);
    // El cliente guardado sin el dígito verificador (8 dígitos) es el mismo RIF: propone, no avisa
    const docViejo = faro.doc_numero; faro.doc_numero = String(docViejo).slice(0, -1);
    faro.documentos = faro.documentos.filter((d) => d.casilla !== 'rif_empresa');
    await p.goto(H + 'clientes.html?c=' + faro.id + '&t=documentos'); await p.waitForSelector('#hojaFicha.ver [data-subir="rif_empresa:0"]');
    const [fc8] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-subir="rif_empresa:0"]')]);
    await fc8.setFiles({ name: 'rif3.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 rif') });
    await p.waitForSelector('#hojaOcr.ver [data-ocr-campo]', { timeout: 8000 }).catch(() => {});
    ok(nombre + ': el RIF con dígito verificador coincide con el cliente guardado sin él', (await p.locator('#hojaOcr.ver').count()) === 1 && !/no el de este cliente/.test(await p.textContent('body')));
    faro.doc_numero = docViejo; await cerrarHojas(p);
    // RIF de otro cliente: avisa y no propone nada
    faro.documentos = faro.documentos.filter((d) => d.casilla !== 'rif_empresa');
    mundo.ocr = { estado: 'ok', tipo: 'rif_viejo', dudosa: false, datos: { rif: 'J418888023', razon_social: 'OTRA EMPRESA INVENTADA, C.A', domicilio: 'X ZONA POSTAL 1000', motivos: [] } };
    await p.goto(H + 'clientes.html?c=' + faro.id + '&t=documentos'); await p.waitForSelector('#hojaFicha.ver [data-subir="rif_empresa:0"]');
    const [fc2] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-subir="rif_empresa:0"]')]);
    await fc2.setFiles({ name: 'rif2.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 rif') });
    await p.waitForFunction(() => /no el de este cliente/.test(document.body.textContent));
    ok(nombre + ': si el RIF del archivo es de otro cliente, avisa', (await p.locator('#hojaOcr.ver').count()) === 0);
    await cerrarHojas(p);
    // Con el ajuste en NO no se llama al OCR
    mundo.datos.ocrAjustes.expediente = false; faro.documentos = faro.documentos.filter((d) => d.casilla !== 'rif_empresa');
    const antes = mundo.llamadas.filter((l) => l[0] === 'ocr').length;
    await p.goto(H + 'clientes.html?c=' + faro.id + '&t=documentos'); await p.waitForSelector('#hojaFicha.ver [data-subir="rif_empresa:0"]');
    const [fc3] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-subir="rif_empresa:0"]')]);
    await fc3.setFiles({ name: 'rif3.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 rif') });
    await p.waitForFunction(() => /documento guardado/.test(document.body.textContent)); await p.waitForTimeout(400);
    ok(nombre + ': con el ajuste en NO la subida es igual que antes (sin OCR)', mundo.llamadas.filter((l) => l[0] === 'ocr').length === antes);
    // ----- La líder no ve los ajustes -----
    const c2 = await contexto(nav, dispositivo, mundo); const q = await entrar(c2.ctx, 'lucia', '739105'); q.on('pageerror', (e) => errores.push(e.message));
    await q.waitForSelector('#cuenta'); await q.click('#cuenta'); await q.waitForSelector('#hojaCuenta.ver');
    ok(nombre + ': la líder no ve Lectura con OCR', (await q.locator('#hojaCuenta [data-ocr-aj]').count()) === 0);
    await c2.ctx.close(); await ctx.close();
  }
  ok('sin errores de la página', errores.length === 0, errores);
  await nav.close(); cerrar();
})();
