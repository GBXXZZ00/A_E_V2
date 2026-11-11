// Lote 12/11 (maqueta revision): "Hay un problema" de Legal desde Mi trabajo y lo que ve el administrador; línea de revisión según el caso. Datos inventados.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
const dia = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['pc', PC], ['tel', TEL]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    mundo.personas.push({ id: '77777777-7777-4777-8777-777777777777', usuario: 'paula', pin: '615243', nombre: 'Paula Legal', rol: 'abogado', cargo: 'Legal', equipo: 'ventas', activo: true, debe_cambiar_pin: false });
    const cli = mundo.datos.clientes;
    mundo.datos.extra = [{ tipo: 'elaborar_contrato', clave: String(cli[0].id), cliente_id: cli[0].id, titulo: cli[0].nombre, detalle: 'PYME · en Documentos recibidos', para: 'abogado', vence: dia(-2), desde: dia(-5) + 'T12:00:00Z', ref: {} }];
    // Legal: "Hay un problema" en su contrato por elaborar
    const p = await entrar(ctx, 'paula', '615243'); p.on('pageerror', (e) => errores.push(nombre + ': ' + e.message));
    await p.goto(H + 'trabajo.html'); await p.waitForSelector('#cuerpo [data-problema]', { timeout: 15000 });
    ok(nombre + ': cada contrato por elaborar trae "Hay un problema"', (await p.locator('#cuerpo [data-problema]').count()) >= 1);
    await p.locator('#cuerpo [data-problema]').first().click(); await p.waitForSelector('#hojaProblema.ver');
    ok(nombre + ': la hoja trae Devolver, Pedir y Solo avisar', (await p.locator('#hojaProblema [data-pb]').count()) === 3);
    await p.click('#pbOk'); await p.waitForTimeout(150);
    ok(nombre + ': sin observación no deja enviar', /observación/.test(await p.textContent('#ePb')));
    await p.click('#hojaProblema [data-pb="avisar"]'); await p.fill('#pb_obs', 'Confirmar el plan contratado antes de seguir');
    ok(nombre + ': sin desborde en la hoja', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/lote12nov-legal-' + nombre + '.png', fullPage: false });
    await p.click('#pbOk'); await p.waitForFunction(() => !document.querySelector('#hojaProblema.ver'), null, { timeout: 10000 }).catch(() => {});
    ok(nombre + ': queda la observación y la bitácora', (mundo.datos.legalObs || []).length === 1 && (mundo.bitacora || []).some((b) => b.accion === 'legal_observa'));
    await ctx.close();
    // Administrador: la banda en la ficha
    const c2 = await contexto(nav, dispositivo, mundo); const q = await entrar(c2.ctx, 'marcos', '482913'); q.on('pageerror', (e) => errores.push(nombre + ' admin: ' + e.message));
    await q.goto(H + 'clientes.html?c=' + cli[0].id + '&t=documentos'); await q.waitForSelector('#tab-documentos .lg-obs', { timeout: 15000 });
    ok(nombre + ': en la ficha sale la observación de Legal', /Confirmar el plan contratado/.test(await q.textContent('#tab-documentos .lg-obs')));
    ok(nombre + ': arriba de Documentos va una sola línea de revisión', (await q.locator('#tab-documentos .rp-linea').count()) <= 1);
    await c2.ctx.close();
  }
  ok('sin errores de JavaScript', !errores.length, errores.slice(0, 3));
  await nav.close(); cerrar();
})();
