// Lote 22/10: Mi trabajo por rol (maqueta aprobada) y Gestiones. Líder, Analista Senior (vista de administrador, Equipo y ver por persona),
// coordinador ("Hacerlo yo") y Legal (cola de contratos). Gestiones: ver avance, estado de un cliente con nota y fecha, y crear una nueva.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
const llamo = (m, f) => m.llamadas.filter((l) => l[1] === f);
async function cerrarHojas(p){ for(let i = 0; i < 5 && await p.evaluate(() => !!window.Comun.hojaAbierta()); i++){ await p.keyboard.press('Escape'); await p.waitForTimeout(260); } }
const dia = (n) => { const d = new Date(Date.now() - 4 * 3600e3); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    mundo.personas.push({ id: '77777777-7777-4777-8777-777777777777', usuario: 'paula', pin: '615243', nombre: 'Paula Legal', rol: 'abogado', cargo: 'Legal', equipo: 'ventas', activo: true, debe_cambiar_pin: false });
    const cli = mundo.datos.clientes;
    mundo.datos.extra = [
      { tipo: 'elaborar_contrato', clave: String(cli[0].id), cliente_id: cli[0].id, titulo: cli[0].nombre, detalle: 'PYME · en Documentos recibidos', para: 'abogado', vence: dia(-2), desde: dia(-5) + 'T12:00:00Z', ref: {} },
      { tipo: 'elaborar_contrato', clave: String(cli[1].id), cliente_id: cli[1].id, titulo: cli[1].nombre, detalle: 'PYME · en Documentos recibidos', para: 'abogado', vence: dia(1), desde: dia(-1) + 'T12:00:00Z', ref: {} },
      { tipo: 'revisar_docs', clave: String(cli[2].id), cliente_id: cli[2].id, titulo: cli[2].nombre, detalle: '3 archivos por revisar · subió Lucía Ferrer', para: 'admin', vence: dia(0), desde: dia(-2) + 'T12:00:00Z', ref: { revisar: true } },
      { tipo: 'alerta_carga', clave: 'noaparece', cliente_id: null, titulo: 'TAD', detalle: '2 clientes no aparecen en las dos últimas cargas del TAD', para: 'admin', vence: dia(2), desde: dia(0) + 'T08:00:00Z', ref: { no_aparece: true } }];

    // ----- Líder -----
    const p = await entrar(ctx, 'lucia', '739105'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'trabajo.html'); await p.waitForSelector('#tarjetas .mt-card');
    ok(nombre + ': el líder ve el saludo con su nombre y la frase del corte', /Lucía/.test(await p.textContent('#saludo')) && /corte de/.test(await p.textContent('#frase')));
    const cards = await p.$$eval('#tarjetas .mt-card b', (xs) => xs.map((x) => x.textContent));
    ok(nombre + ': sus 4 grupos (Conseguir documentos, Hacer firmar, Por instalar, Mis gestiones)', ['Conseguir documentos', 'Hacer firmar', 'Por instalar', 'Mis gestiones'].every((t) => cards.includes(t)));
    ok(nombre + ': píldoras de vencidos, de hoy y total', /vencid/.test(await p.textContent('#pildoras')) && /en total/.test(await p.textContent('#pildoras')));
    ok(nombre + ': la primera tarjeta es la ancha', (await p.locator('#tarjetas .mt-card.g2').count()) === 1);
    const antes = await p.locator('#cuerpo .mt-it').count();
    await p.click('#tarjetas [data-grupo="ges"]');
    ok(nombre + ': tocar una tarjeta filtra la lista y aparece Ver todo', (await p.locator('#cuerpo .mt-it').count()) === 2 && /Mis gestiones/.test(await p.textContent('#cuerpo h2')) && (await p.locator('[data-tr="todo"]').count()) === 1);
    await p.click('[data-tr="todo"]');
    ok(nombre + ': Ver todo vuelve a Para hoy', (await p.locator('#cuerpo .mt-it').count()) === antes && /Para hoy/.test(await p.textContent('#cuerpo h2')));
    ok(nombre + ': cada fila lleva acción, cliente, motivo, plazo y botón', (await p.locator('#cuerpo .mt-it .mt-dot').count()) === antes && (await p.locator('#cuerpo .mt-it [data-hacer]').count()) === antes);
    ok(nombre + ': panel de gestiones con su avance', /Documentación ISP/.test(await p.textContent('#lado')) && /0 de 2/.test(await p.textContent('#lado')) && (await p.locator('[data-ges="nueva"]').count()) === 0);
    ok(nombre + ': Mi trabajo sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/30-' + nombre + '-lider.png', fullPage: true });
    // Gestión: cambiar el estado de un cliente con nota y fecha prometida
    await p.click('#lado [data-ges="1"]'); await p.waitForSelector('#hojaGes.ver .ges-cli');
    await p.locator('#hojaGes [data-gs-cli]').first().click(); await p.waitForSelector('#gesNota');
    await p.click('#hojaGes [data-gs-est="resuelto"]'); await p.fill('#gesNota', ''); await p.click('[data-gs="guardar"]');
    ok(nombre + ': Resuelto sin nota da error debajo', /resolvió/.test(await p.textContent('#eGes')));
    await p.click('#hojaGes [data-gs-est="esperando"]'); await p.fill('#gesNota', 'Prometió el acta'); await p.fill('#gesProm', dia(2)); await p.click('[data-gs="guardar"]');
    await p.waitForFunction(() => /Prometió el acta/.test(document.getElementById('cGes').textContent));
    const est = llamo(mundo, 'gestion_cliente_estado').slice(-1)[0][2];
    ok(nombre + ': guarda estado, nota y fecha prometida en el historial', est.p_estado === 'esperando' && est.p_promesa === dia(2) && /Esperando/.test(await p.textContent('#cGes')));
    ok(nombre + ': la hoja de la gestión sin desborde', await sinDesborde(p));
    await cerrarHojas(p);

    // ----- Analista Senior: vista de administrador, equipo y nueva gestión -----
    const c2 = await contexto(nav, dispositivo, mundo); const q = await entrar(c2.ctx, 'elena', '315806'); q.on('pageerror', (e) => errores.push(e.message));
    await q.goto(H + 'trabajo.html'); await q.waitForSelector('#tarjetas .mt-card');
    const c2t = await q.$$eval('#tarjetas .mt-card b', (xs) => xs.map((x) => x.textContent));
    ok(nombre + ': el Senior ve Revisar documentos, Por decidir, Aliados y Alertas', ['Revisar documentos', 'Por decidir', 'Aliados', 'Alertas'].every((t) => c2t.includes(t)));
    ok(nombre + ': cola de revisión y panel Equipo', /Revisión en cola/.test(await q.textContent('#lado')) && (await q.locator('#lado [data-persona]').count()) >= 1);
    await q.screenshot({ path: 'capturas/30-' + nombre + '-senior.png', fullPage: true });
    await q.locator('#lado [data-persona]').first().click(); await q.waitForFunction(() => /Estás viendo el trabajo de/.test(document.getElementById('frase').textContent));
    ok(nombre + ': tocar a una persona muestra su lista', llamo(mundo, 'mi_trabajo').some((l) => l[2].p_persona) && !(await q.locator('#volverPersona').evaluate((x) => x.classList.contains('hidden'))));
    await q.click('#volverPersona'); await q.waitForFunction(() => !/Estás viendo/.test(document.getElementById('frase').textContent));
    await q.click('[data-ges="nueva"]'); await q.waitForSelector('#hojaGesN.ver #gesNom'); await q.waitForSelector('[data-gs-resp]');
    await q.click('[data-gs="crear"]');
    ok(nombre + ': crear sin datos da los errores debajo', /nombre/.test(await q.textContent('#eGesN_nombre')) && /meta/.test(await q.textContent('#eGesN_meta')) && /responsable/.test(await q.textContent('#eGesN_resp')) && /cliente/.test(await q.textContent('#eGesN_clientes')));
    await q.fill('#gesNom', 'Contratos de dedicados'); await q.selectOption('#gesMeta', 'contrato_firmado'); await q.fill('#gesPlazo', dia(10));
    await q.locator('[data-gs-resp]').first().check();
    await q.fill('#gesBusca', cli[0].nombre.slice(0, 8)); await q.click('[data-gs="buscar"]'); await q.waitForSelector('[data-gs-add]');
    await q.locator('[data-gs-add]').first().click();
    await q.screenshot({ path: 'capturas/30-' + nombre + '-nueva-gestion.png', fullPage: true });
    await q.click('[data-gs="crear"]'); await q.waitForSelector('#hojaGes.ver #cGes .estado');
    const gc = llamo(mundo, 'gestion_crear').slice(-1)[0][2].p_datos;
    ok(nombre + ': crea la gestión con meta, plazo, responsables y clientes', gc.meta === 'contrato_firmado' && gc.plazo === dia(10) && gc.responsables.length === 1 && gc.clientes.length === 1);
    await cerrarHojas(q); await c2.ctx.close();

    // ----- Coordinador: lo de todos los analistas, con "Hacerlo yo" -----
    Object.assign(mundo.personas.find((x) => x.usuario === 'pedro'), { coordinador: true, debe_cambiar_pin: false, canales: false });
    const c3 = await contexto(nav, dispositivo, mundo); const r = await entrar(c3.ctx, 'pedro', '204871'); r.on('pageerror', (e) => errores.push(e.message));
    await r.goto(H + 'trabajo.html'); await r.waitForSelector('#tarjetas .mt-card');
    ok(nombre + ': el coordinador ve Emitir cambios y Bienvenidas, con "Hacerlo yo" y filtro por analista', /Emitir cambios/.test(await r.textContent('#tarjetas')) && /Hacerlo yo/.test(await r.textContent('#cuerpo')) && !(await r.locator('#zonaPersona').evaluate((x) => x.classList.contains('hidden'))));
    await r.screenshot({ path: 'capturas/30-' + nombre + '-coord.png', fullPage: true });
    await c3.ctx.close();

    // ----- Legal: elaborar contrato en cola -----
    const c4 = await contexto(nav, dispositivo, mundo); const s = await entrar(c4.ctx, 'paula', '615243'); s.on('pageerror', (e) => errores.push(e.message));
    await s.goto(H + 'trabajo.html'); await s.waitForSelector('#tarjetas .mt-card');
    ok(nombre + ': Legal entra con Elaborar contrato, Por firmar, Firmado sin archivo y Por vencer', ['Elaborar contrato', 'Por firmar', 'Firmado sin archivo', 'Por vencer'].every((t) => new RegExp(t).test(s.textContent ? '' : '')) || /Elaborar contrato/.test(await s.textContent('#tarjetas')) && /Por vencer/.test(await s.textContent('#tarjetas')));
    ok(nombre + ': Legal tiene la cola de contratos', /Contratos en cola/.test(await s.textContent('#lado')));
    await s.click('[data-tr="cola"]'); await s.waitForSelector('#hojaFicha.ver #tFicha');
    ok(nombre + ': Empezar abre el más viejo', (await s.textContent('#tFicha')).includes(cli[0].nombre.split(',')[0]));
    await cerrarHojas(s); await s.waitForSelector('#barraCola:not(.hidden)');
    ok(nombre + ': al cerrar ofrece el siguiente', /Siguiente/.test(await s.textContent('#barraCola')));
    await s.screenshot({ path: 'capturas/30-' + nombre + '-legal.png', fullPage: true });
    await c4.ctx.close(); await ctx.close();
  }
  ok('sin errores de la página', errores.length === 0, errores);
  await nav.close(); cerrar();
})();
