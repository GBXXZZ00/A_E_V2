// Lote 12/11 B, parte 3: Cliente nuevo leyendo el RIF (maqueta comisiones-hoja.html 4 y 6c). OCR simulado; datos inventados.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
const fs = require('fs'); const path = require('path');
const ARCH = path.join(__dirname, 'capturas', 'rif-prueba.pdf');

(async () => {
  fs.mkdirSync(path.dirname(ARCH), { recursive: true }); fs.writeFileSync(ARCH, '%PDF-1.4 prueba');
  const nav = await chromium.launch(); const errores = [];
  const RIF_OK = { estado: 'ok', tipo: 'rif_digital', datos: { rif: 'J412345678', razon_social: 'Inversiones Ejemplo, C.A.', motivos: [] }, dudosa: false };
  for(const [nombre, dispositivo] of [['pc', PC], ['tel', TEL]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    const p = await entrar(ctx, 'lucia', '739105'); p.on('pageerror', (e) => errores.push(nombre + ': ' + e.message));
    const abrir = async () => { await p.goto(H + 'comisiones.html'); await p.waitForSelector('#cxNuevo [data-abrir="nuevo"]', { timeout: 15000 }); await p.click('#cxNuevo [data-abrir="nuevo"]'); await p.waitForSelector('#hojaNuevo.ver [data-nv-zona]'); };
    const soltar = async (ocr) => { mundo.ocr = ocr; await p.setInputFiles('#nvArchivo', ARCH); await p.waitForFunction(() => !/Leyendo el archivo/.test(document.getElementById('hojaNuevo').textContent)); await p.waitForTimeout(250); };
    await abrir();
    const t1 = await p.textContent('#hojaNuevo');
    ok(nombre + ': paso 1 con la zona para el RIF y "No tengo el RIF"', /El RIF/.test(t1) && /Documentos/.test(t1) && /Elegir archivo|Tomar foto o elegir/.test(t1) && /No tengo el RIF: escribir los datos/.test(t1));
    ok(nombre + ': sin el selector Jurídico / Natural', (await p.locator('[data-nv-tipo]').count()) === 0);
    await p.screenshot({ path: 'capturas/lote12novB-p3-1-' + nombre + '.png' });
    // Leído bien: RIF y razón social editables, "No está en la app"
    await soltar(RIF_OK); await p.waitForSelector('#hojaNuevo .nv-banda.verde');
    ok(nombre + ': lo leído llena el RIF y la razón social', (await p.inputValue('#nvRif')) === 'J-41234567-8' && (await p.inputValue('#nvNom')) === 'Inversiones Ejemplo, C.A.');
    ok(nombre + ': dice "No está en la app" y que el RIF queda en su casilla', /No está en la app/.test(await p.textContent('#hojaNuevo .nv-banda')) && /queda subido en su casilla/.test(await p.textContent('#hojaNuevo .nv-banda')));
    ok(nombre + ': sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/lote12novB-p3-2-' + nombre + '.png' });
    // Dudoso, no es RIF, cédula
    await p.click('[data-nv-cambiar]').catch(() => {}); await soltar(Object.assign({}, RIF_OK, { dudosa: true, datos: Object.assign({}, RIF_OK.datos, { motivos: ['sin fecha'] }) }));
    ok(nombre + ': lectura dudosa en ámbar', /Lectura dudosa/.test(await p.textContent('#hojaNuevo .nv-banda.ambar')));
    await soltar({ estado: 'ok', tipo: 'otro', datos: { motivos: [] }, dudosa: true });
    ok(nombre + ': si no es un RIF lo dice en rojo', /No corresponde a un RIF/.test(await p.textContent('#hojaNuevo .nv-banda.rojo')));
    await soltar({ estado: 'ok', tipo: 'cedula', datos: { letra: 'V', numero: '12345678', nombres: 'ANA', apellidos: 'PRUEBA', motivos: [] }, dudosa: false });
    ok(nombre + ': una cédula se lee como cédula', (await p.inputValue('#nvRif')) === 'V-12345678' && (await p.textContent('label[for="nvRif"]')) === 'Cédula o RIF');
    // RIF de otro líder: sin su nombre y sin poder seguir
    const otro = mundo.datos.clientes.find((c) => c.lider_id && c.lider_id !== mundo.personas.find((x) => x.usuario === 'lucia').id && c.doc_numero);
    if(otro){ await p.fill('#nvRif', 'J-' + otro.doc_numero); await p.waitForSelector('#hojaNuevo .nv-banda.rojo', { timeout: 5000 }).catch(() => {});
      const b = await p.textContent('#hojaNuevo .nv-banda.rojo').catch(() => '');
      ok(nombre + ': RIF de otro líder: lo dice sin su nombre y no deja seguir', /Ese RIF ya es de otro líder/.test(b) && !(otro.lider && b.includes(otro.lider)) && await p.locator('[data-nv-seguir]').isDisabled(), b); }
    // Vuelve al bueno y continúa: el RIF queda en su casilla
    await soltar(RIF_OK); await p.waitForSelector('#hojaNuevo .nv-banda.verde');
    await p.click('[data-nv-seguir]'); await p.waitForSelector('#docsNuevo [data-casilla]', { timeout: 10000 });
    await p.waitForFunction(() => /1 documento guardado|Subiendo/.test(document.body.textContent) || true); await p.waitForTimeout(1200);
    const c = mundo.datos.clientes.find((x) => x.doc_numero === '412345678');
    ok(nombre + ': se crea el cliente y el RIF queda en la casilla RIF de la empresa', !!c && (c.documentos || []).some((d) => d.casilla === 'rif_empresa'), c && c.documentos);
    ok(nombre + ': el paso 2 marca El RIF como hecho', (await p.locator('#hojaNuevo .nv-p2 .hecho').count()) === 1);
    // Pantalla final al enviar
    await p.evaluate(() => { const b = document.querySelector('[data-nv-enviar]'); b.disabled = false; b.click(); });
    await p.waitForSelector('#hojaNuevo .nv-fin');
    const f = await p.textContent('#hojaNuevo');
    ok(nombre + ': al enviar: Enviado a revisión, los 3 pasos y los dos botones', /Enviado a revisión/.test(f) && /bandeja del administrador/.test(f) && /Documentos subidos/.test(f) && /Revisión del administrador/.test(f) && /Instalación/.test(f) && (await p.locator('[data-nv-otro]').count()) === 1 && (await p.locator('[data-nv-pend]').count()) === 1);
    await p.screenshot({ path: 'capturas/lote12novB-p3-fin-' + nombre + '.png' });
    await p.click('[data-nv-pend]'); await p.waitForTimeout(400);
    ok(nombre + ': "Ver mis pendientes" lleva a Pendientes por instalar', p.url().includes('f=pendientes'));
    // "No tengo el RIF": escribir los datos
    await p.click('#cxNuevo [data-abrir="nuevo"]'); await p.waitForSelector('#hojaNuevo.ver [data-nv-manual]'); await p.click('[data-nv-manual]');
    ok(nombre + ': "No tengo el RIF" abre los campos', (await p.locator('#nvRif').count()) === 1 && (await p.locator('#nvNom').count()) === 1);
    await ctx.close();
  }
  ok('sin errores de JavaScript', errores.length === 0, errores.slice(0, 3));
  await nav.close(); cerrar();
})();
