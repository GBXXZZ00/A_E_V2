// Lote urgente 20/10, parte 4: en la hoja de comisión los documentos son las mismas casillas del expediente (arrastrar, Subir varios),
// en un bloque plegable cerrado; arriba los datos clave (lote 21/10). Persona natural: solo cédula y RIF (teléfono opcional), nada de empresa.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar, plegables } = require('./simulador');
const { ok, cerrar } = marcador();
const { RPC } = require('./mundo');
const llamo = (m, f) => m.llamadas.filter((l) => l[1] === f);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const cerrarHojas = async (p) => { for(let i = 0; i < 5 && await p.evaluate(() => !!window.Comun.hojaAbierta()); i++){ await p.keyboard.press('Escape'); await p.waitForTimeout(260); } };

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    const adm = mundo.personas.find((x) => x.rol === 'admin');
    await p.goto(H + 'comisiones.html'); await p.waitForSelector('.grupo');
    const d0 = RPC.comisiones_corte(mundo, adm, {});
    const abrirFila = async (f) => {
      const g = p.locator('.grupo').filter({ has: p.locator('.grupo-cab', { hasText: f.lider }) });
      if(!(await g.evaluate((x) => x.classList.contains('abierto')))) await g.locator('.grupo-cab').click();
      await p.click('[data-com="' + f.instalacion_id + '"]'); await p.waitForSelector('#hojaComision.ver [data-plg-btn="legal"]');
      if(await p.evaluate(() => document.getElementById('docsCom').hidden)) await p.click('[data-docs-com]'); await p.waitForSelector('#docsCom:not([hidden]) [data-casilla]');
    };
    // ----- Persona natural -----
    const nat = d0.filas.find((f) => f.es_natural);
    await abrirFila(nat);
    const zn = await p.textContent('#docsCom');
    ok(nombre + ': natural: solo cédula y RIF personal, sin empresa', (await p.locator('#docsCom [data-casilla="cedula:1"]').count()) === 1 && (await p.locator('#docsCom [data-casilla="rif_personal:1"]').count()) === 1 &&
      !zn.includes('Empresa') && !zn.includes('Acta constitutiva') && !zn.includes('Correo de la empresa') && (await p.locator('#docsCom [data-casilla="rif_empresa:0"]').count()) === 0);
    ok(nombre + ': natural: el contacto es opcional', (await p.textContent('#docsCom [data-campo="rep:1"]')).includes('Opcional') && (await p.locator('#docsCom [data-campo="rep:1"] .chip.rojo').count()) === 0);
    const fn = RPC.cliente_ficha(mundo, adm, { p_cliente: nat.cliente_id }).faltantes;
    ok(nombre + ': natural: el contador de faltantes solo cuenta cédula y RIF', fn.every((x) => ['cedula', 'rif_personal'].includes(x.k)));
    // Arrastrar un archivo sobre una casilla
    const antes = llamo(mundo, 'documentos_registrar').length;
    await p.evaluate((b64) => {
      const bin = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)); const dt = new DataTransfer(); dt.items.add(new File([bin], 'rif.png', { type: 'image/png' }));
      const el = document.querySelector('#docsCom [data-casilla="rif_personal:1"]');
      el.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
      el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    }, PNG.toString('base64'));
    await p.waitForFunction((n) => true, antes); await p.waitForFunction(() => /Por revisar/.test((document.querySelector('#docsCom [data-casilla="rif_personal:1"]') || {}).textContent || ''));
    const reg = llamo(mundo, 'documentos_registrar');
    ok(nombre + ': arrastrar un archivo a una casilla lo sube a esa casilla, sin abrir el expediente', reg.length === antes + 1 && reg.slice(-1)[0][2].p_items[0].casillas[0].casilla === 'rif_personal' && (await p.evaluate(() => window.Comun.hojasAbiertas().join())) === 'hojaComision');
    ok(nombre + ': Documentos sigue abierto después de subir', (await p.getAttribute('[data-docs-com]', 'aria-expanded')) === 'true');
    await cerrarHojas(p);
    // ----- Empresa: Subir varios desde la comisión -----
    const emp = d0.filas.find((f) => !f.es_natural && f.orden_ok);
    await abrirFila(emp);
    ok(nombre + ': empresa: trae las casillas de empresa en el mismo orden (representantes, empresa, otros)', await p.evaluate(() => { const g = Array.from(document.querySelectorAll('#docsCom [data-grupo]')).map((x) => x.dataset.grupo); return g.indexOf('rep1') === 0 && g.indexOf('empresa') > 0 && g.indexOf('otros') === g.length - 1; }));
    await p.click('#comVarios'); await p.waitForSelector('#hojaVarios.ver');
    ok(nombre + ': Subir varios se abre encima con el nombre del cliente', (await p.textContent('#hojaVarios')).includes(emp.nombre.split(',')[0]));
    await p.setInputFiles('#archivosLote', [{ name: 'acta.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 acta') }]);
    await p.waitForSelector('#hojaVarios [data-marca="acta_constitutiva:0"]'); await p.click('#hojaVarios [data-marca="acta_constitutiva:0"]');
    const a2 = llamo(mundo, 'documentos_registrar').length;
    await p.click('#guardarLote'); await p.waitForFunction(() => !document.querySelector('#hojaVarios.ver'));
    await p.waitForFunction(() => /Por revisar/.test((document.querySelector('#docsCom [data-casilla="acta_constitutiva:0"]') || {}).textContent || ''));
    ok(nombre + ': Subir varios guarda y vuelve a la comisión ya actualizada', llamo(mundo, 'documentos_registrar').length === a2 + 1 && (await p.evaluate(() => window.Comun.hojasAbiertas().join())) === 'hojaComision');
    ok(nombre + ': hoja de comisión sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/39-' + nombre + '-documentos.png', fullPage: true });
    await ctx.close();
  }
  ok('sin errores de la página', errores.length === 0, errores.join(' | '));
  await nav.close(); cerrar();
})();
