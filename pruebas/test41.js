// Lote urgente 20/10, parte 6: contrato presencial. El interruptor está arriba de Documentos (expediente y hoja de comisión);
// con él no se piden correos ni teléfono (sí los documentos legales); faltantes, "Pedir lo que falta" y el paso a revisión cambian.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar, plegables } = require('./simulador');
const { ok, cerrar } = marcador();
const { RPC } = require('./mundo');
const llamo = (m, f) => m.llamadas.filter((l) => l[1] === f);
const cerrarHojas = async (p) => { for(let i = 0; i < 5 && await p.evaluate(() => !!window.Comun.hojaAbierta()); i++){ await p.keyboard.press('Escape'); await p.waitForTimeout(260); } };

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    const adm = mundo.personas.find((x) => x.rol === 'admin');
    // Una empresa con todos los documentos, a la que solo le faltan los correos y el teléfono
    const c = mundo.datos.clientes.find((x) => !x.es_natural && !x.legal_ok_en && !x.contrato_presencial && x.instalaciones.length);
    c.estatus = 'documentos_pendientes'; c.correo_empresa = ''; c.representantes.forEach((r) => { if(r.orden === 1){ r.correo = ''; r.telefono = ''; } });
    const req = ['cedula:1', 'rif_personal:1', 'rif_empresa:0', 'acta_constitutiva:0'].concat(c.es_isp ? ['conatel:0'] : []).concat(c.regimen_firma === 'conjunta' ? ['cedula:2', 'rif_personal:2'] : []);
    req.forEach((k) => { const [cas, n] = k.split(':'); let d = c.documentos.find((x) => x.casilla === cas && x.numero === Number(n));
      if(!d){ d = { id: 900000 + Math.floor(Math.random() * 99999), casilla: cas, numero: Number(n), archivos: [{ id: 990000 + Math.floor(Math.random() * 9999), nombre: cas + '.pdf' }] }; c.documentos.push(d); }
      d.estado = 'por_revisar'; });
    const fal = () => RPC.cliente_ficha(mundo, adm, { p_cliente: c.id }).faltantes;
    ok(nombre + ': sin presencial faltan correo, teléfono y correo de la empresa', ['correo', 'telefono', 'correo_empresa'].every((k) => fal().some((x) => x.k === k)));
    // Lote 21/10: la firma Digital o Física (Física = presencial) está en la tarjeta del contrato PYME, en la pestaña Contrato
    await p.goto(H + 'clientes.html?c=' + c.id + '&t=documentos'); await p.waitForSelector('#hojaFicha.ver #tab-documentos .fd-sum');
    ok(nombre + ': antes, el contador dice que faltan 3 (correos y teléfono)', (await p.getAttribute('#tab-documentos .fd-sum', 'data-faltan')) === '3');
    await p.click('#tabs [data-tab="contrato"]'); await p.waitForSelector('#tab-contrato.on .ctr-pyme [data-firma-cli]');
    ok(nombre + ': la tarjeta del contrato PYME trae Firma Digital (marcada) y Física', (await p.getAttribute('#tab-contrato [data-firma-cli][data-valor="digital"]', 'aria-checked')) === 'true');
    await p.click('#tab-contrato [data-firma-cli][data-valor="fisica"]');
    await p.waitForFunction(() => { const b = document.querySelector('#tab-contrato [data-firma-cli][data-valor="fisica"]'); return b && b.getAttribute('aria-checked') === 'true'; });
    ok(nombre + ': con Física sale el aviso del contrato presencial', (await p.textContent('#tab-contrato .ctr-pyme')).includes('El cliente firma en físico. No se piden correos ni teléfono; sí los documentos legales. Comisiona igual.') &&
      (await p.textContent('#tab-contrato .ctr-pyme')).includes('Subir firmado en físico') === !!(await p.locator('#tab-contrato .ctr-pyme [data-subir]').count()));
    await p.screenshot({ path: 'capturas/41-' + nombre + '-presencial.png' });
    await p.click('#tabs [data-tab="documentos"]');
    ok(nombre + ': arriba de Documentos queda el aviso de firma física', await p.evaluate(() => { const z = document.getElementById('tab-documentos'); const s = z.querySelector('.presencial-docs'); return !!s && z.firstElementChild === s; }));
    const f1 = fal();
    ok(nombre + ': con presencial no se piden correos ni teléfono, sí los documentos', f1.length === 0 && llamo(mundo, 'cliente_marca').some((l) => l[2].p_marca === 'contrato_presencial' && l[2].p_valor === true));
    ok(nombre + ': el contacto y el correo de la empresa quedan opcionales', (await p.locator('#tab-documentos [data-campo="rep:1"] .chip.rojo, #tab-documentos [data-campo="correo_empresa"] .chip.rojo').count()) === 0 &&
      (await p.textContent('#tab-documentos [data-campo="rep:1"]')).includes('contrato presencial'));
    ok(nombre + ': el contador queda en 0 y "Pedir lo que falta" no sale', (await p.getAttribute('#tab-documentos .fd-sum', 'data-faltan')) === '0' && (await p.locator('#tab-documentos [data-paso^="pedir:"]').count()) === 0);
    ok(nombre + ': con los documentos subidos pasa a Documentos en revisión', c.estatus === 'documentos_en_revision');
    // Un documento legal sigue haciendo falta aunque sea presencial
    c.documentos = c.documentos.filter((x) => x.casilla !== 'acta_constitutiva');
    ok(nombre + ': con presencial el acta constitutiva se sigue pidiendo', fal().some((x) => x.k === 'acta_constitutiva'));
    ok(nombre + ': documentos sin desborde', await sinDesborde(p));
    await cerrarHojas(p);
    // En la hoja de comisión (lote 21/10): Firma Digital/Física dentro de Legal y documentos
    const ins = c.instalaciones[0];
    await p.goto(H + 'comisiones.html'); await p.waitForSelector('.grupo');
    const fila = RPC.comisiones_corte(mundo, adm, {}).filas.find((f) => f.cliente_id === c.id);
    if(fila){
      const g = p.locator('.grupo').filter({ has: p.locator('.grupo-cab', { hasText: fila.lider }) });
      if(!(await g.evaluate((x) => x.classList.contains('abierto')))) await g.locator('.grupo-cab').click();
      await p.click('[data-com="' + fila.instalacion_id + '"]'); await p.waitForSelector('#hojaComision.ver [data-docs-com]'); await plegables(p, 'legal');
      await p.waitForSelector('#docsCom [data-firma="fisica"]');
      ok(nombre + ': la hoja de comisión trae Firma Digital/Física en Legal, ya en Física', (await p.getAttribute('#docsCom [data-firma="fisica"]', 'aria-checked')) === 'true' && (await p.locator('#docsCom [data-marca-cli="contrato_presencial"]').count()) === 0);
      await p.click('#docsCom [data-firma="digital"]');
      await p.waitForFunction(() => { const b = document.querySelector('#docsCom [data-firma="digital"]'); return b && b.getAttribute('aria-checked') === 'true'; });
      ok(nombre + ': desde la comisión también se cambia (pasa por el servidor)', c.contrato_presencial === false && llamo(mundo, 'cliente_marca').slice(-1)[0][2].p_cliente === c.id);
    } else ok(nombre + ': el cliente está en el corte (' + (ins && ins.codigo) + ')', false);
    await ctx.close();
  }
  ok('sin errores de la página', errores.length === 0, errores.join(' | '));
  await nav.close(); cerrar();
})();
