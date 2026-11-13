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
      { tipo: 'por_firmar', clave: 'pf' + cli[3].id, cliente_id: cli[3].id, titulo: cli[3].nombre, detalle: 'Contrato por firmar', para: 'abogado', vence: dia(5), desde: dia(-3) + 'T12:00:00Z', ref: {} },
      { tipo: 'revisar_docs', clave: String(cli[2].id), cliente_id: cli[2].id, titulo: cli[2].nombre, detalle: '3 archivos por revisar · subió Lucía Ferrer', para: 'admin', vence: dia(0), desde: dia(-2) + 'T12:00:00Z', ref: { revisar: true } },
      { tipo: 'alerta_carga', clave: 'noaparece', cliente_id: null, titulo: 'TAD', detalle: '2 clientes no aparecen en las dos últimas cargas del TAD', para: 'admin', vence: dia(2), desde: dia(0) + 'T08:00:00Z', ref: { no_aparece: true } }];

    // ----- Líder (lote 28/10: índice compacto a la izquierda, checklist a la derecha) -----
    const p = await entrar(ctx, 'lucia', '739105'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'trabajo.html'); await p.waitForSelector('#tarjetas .bz-mi');
    ok(nombre + ': el líder ve el saludo con su nombre', /Lucía/.test(await p.textContent('#frase')));
    const cards = await p.$$eval('#tarjetas .bz-mi span', (xs) => xs.map((x) => x.textContent));
    ok(nombre + ': sus grupos (Conseguir documentos, Hacer firmar, Gestiones asignadas y Mis notas)', ['Conseguir documentos', 'Hacer firmar', 'Gestiones asignadas', 'Mis notas'].every((t) => cards.includes(t)));
    ok(nombre + ': píldoras de vencidos, de hoy y total', /vencid/.test(await p.textContent('#pildoras')) && /en total/.test(await p.textContent('#pildoras')));
    await p.click('#tarjetas [data-grupo="ges"]');
    ok(nombre + ': tocar un grupo muestra solo su checklist', (await p.locator('#cuerpo .bz-it').count()) === 2 && /Gestiones asignadas/.test(await p.textContent('#cuerpo .bz-sh')));
    await p.click('#tarjetas [data-grupo=""]');
    ok(nombre + ': Todo vuelve a Lo más urgente', /Lo más urgente/.test(await p.textContent('#cuerpo')));
    ok(nombre + ': cada ítem lleva acción, cliente, motivo y botón', (await p.locator('#cuerpo .bz-it [data-hacer]').count()) >= 1 && (await p.locator('#cuerpo .bz-it .bz-ck').count()) >= 1);
    ok(nombre + ': Mi trabajo sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/30-' + nombre + '-lider.png', fullPage: true });
    await p.click('#tarjetas [data-grupo="ges"]');
    await p.locator('#cuerpo [data-gest-est]').first().waitFor();
    // La gestión completa se sigue abriendo desde Clientes
    await p.goto(H + 'clientes.html'); await p.waitForSelector('#panelCli');
    await p.evaluate(() => window.Gestiones.abrir(1, {})); await p.waitForSelector('#hojaGes.ver .ges-cli');
    // Gestión: cambiar el estado de un cliente con nota y fecha prometida
    await p.locator('#hojaGes [data-gs-cli]').first().click(); await p.waitForSelector('#gesNota');
    await p.click('#hojaGes [data-gs-est="resuelto"]'); await p.fill('#gesNota', ''); await p.click('[data-gs="guardar"]');
    ok(nombre + ': Resuelto sin nota da error debajo', /resolvió/.test(await p.textContent('#eGes')));
    await p.click('#hojaGes [data-gs-est="esperando"]'); await p.fill('#gesNota', 'Prometió el acta'); await p.fill('#gesProm', dia(2)); await p.click('[data-gs="guardar"]');
    await p.waitForFunction(() => /Prometió el acta/.test(document.getElementById('cGes').textContent));
    const est = llamo(mundo, 'gestion_cliente_estado').slice(-1)[0][2];
    ok(nombre + ': guarda estado, nota y fecha prometida en el historial', est.p_estado === 'esperando' && est.p_promesa === dia(2) && /Esperando/.test(await p.textContent('#cGes')));
    ok(nombre + ': la hoja de la gestión sin desborde', await sinDesborde(p));
    await cerrarHojas(p);

    // ----- Analista Senior: vista de administrador, el equipo en solo consulta y nueva gestión -----
    const c2 = await contexto(nav, dispositivo, mundo); const q = await entrar(c2.ctx, 'elena', '315806'); q.on('pageerror', (e) => errores.push(e.message));
    await q.goto(H + 'trabajo.html'); await q.waitForSelector('#tarjetas .bz-mi');
    const c2t = await q.$$eval('#tarjetas .bz-mi span', (xs) => xs.map((x) => x.textContent));
    // Lote 05/11 D5: la Senior ve sin dueño, provisionales y cargas; ya no ve la revisión de documentos
    ok(nombre + ': la Senior ve Sin dueño, Provisionales y Cargas del día, sin Revisar documentos', ['Sin dueño', 'Provisionales', 'Cargas del día'].every((t) => c2t.some((x) => x.indexOf(t) === 0)) && !c2t.includes('Revisar documentos'));
    ok(nombre + ': El equipo en el índice y en Todo', (await q.locator('#tarjetas [data-grupo="equipo"]').count()) === 1 && (await q.locator('#cuerpo [data-persona]').count()) >= 1);
    await q.screenshot({ path: 'capturas/30-' + nombre + '-senior.png', fullPage: true });
    await q.locator('#cuerpo [data-persona]').first().click(); await q.waitForSelector('#bandaPersona:not(.hidden)');
    ok(nombre + ': tocar a una persona muestra su buzón en solo consulta', llamo(mundo, 'mi_trabajo').some((l) => l[2].p_persona) && (await q.locator('#cuerpo [data-hacer]').allTextContents()).every((t) => t === 'Ver'));
    await q.click('#bandaPersona [data-tr="volver"]'); await q.waitForSelector('#bandaPersona.hidden', { state: 'attached' });
    await q.click('#tarjetas [data-grupo="ges"]').catch(() => {});
    await q.goto(H + 'clientes.html'); await q.waitForSelector('#panelCli');
    await q.evaluate(() => window.Gestiones.nueva({}));
    await q.waitForSelector('#hojaGesN.ver #gesNom'); await q.waitForSelector('[data-gs-resp]');
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

    // ----- Coordinador: lo de todos los analistas (Canales), con "Hacerlo yo" -----
    Object.assign(mundo.personas.find((x) => x.usuario === 'pedro'), { coordinador: true, debe_cambiar_pin: false, canales: false });
    const c3 = await contexto(nav, dispositivo, mundo); const r = await entrar(c3.ctx, 'pedro', '204871'); r.on('pageerror', (e) => errores.push(e.message));
    await r.goto(H + 'trabajo.html'); await r.waitForSelector('#tarjetas .bz-mi');
    ok(nombre + ': el coordinador ve Cartas y proformas, IP, Apoyo con pago y Emitir en Proham, con filtro por analista', (await r.textContent('#tarjetas')).includes('Cartas y proformas') && (await r.textContent('#tarjetas')).includes('Cambios por emitir') && (await r.locator('#cuerpo [data-persona]').count()) >= 1);   // Lote 12/11: se entra por "Ver su trabajo"
    await r.waitForSelector('.cn-team .cn-per');   // Lote 12/11 (maqueta Coordinadora): la coordinadora ve la carga de cada persona, sin los números de arriba
    ok(nombre + ': números arriba para Canales', (await r.locator('.cn-team .cn-per').count()) >= 1 && (await r.locator('#nums').isHidden()));
    await r.screenshot({ path: 'capturas/30-' + nombre + '-coord.png', fullPage: true });
    await c3.ctx.close();

    // ----- Legal: elaborar contrato en cola -----
    const c4 = await contexto(nav, dispositivo, mundo); const s = await entrar(c4.ctx, 'paula', '615243'); s.on('pageerror', (e) => errores.push(e.message));
    await s.goto(H + 'trabajo.html'); await s.waitForSelector('#tarjetas .bz-mi');
    // Lote 05/11 D4: Legal ve "Por elaborar" por tipo de cliente con filtros, y luego enviados, firmados y vencimientos
    ok(nombre + ': Legal ve Por elaborar contrato con chips por tipo y los vencimientos en 60 días plegados', /Por elaborar contrato · /.test(await s.textContent('#cuerpo')) && (await s.locator('#cuerpo [data-filtro-c]').count()) === 5 && /Vencen en 60 días/.test(await s.textContent('#cuerpo')));
    // Lote 12/11 B, parte 7: los tipos van arriba y valen para todas; cada fila con su etiqueta; todo plegado; por firmar en "Enviado a firmar"
    ok(nombre + ': los tipos van arriba de todas las secciones', /Vale para todas las secciones de abajo/.test(await s.textContent('#cuerpo .lg-tipos')) && (await s.locator('#cuerpo details.lg-pl').count()) === 5);
    ok(nombre + ': todas las secciones empiezan plegadas', (await s.locator('#cuerpo details.lg-pl[open]').count()) === 0);
    await s.evaluate(() => document.querySelectorAll('#cuerpo details.lg-pl').forEach((x) => { x.open = true; }));
    ok(nombre + ': cada fila de cada sección lleva su tipo', await s.evaluate(() => [...document.querySelectorAll('#cuerpo details.lg-pl .lg-row')].every((r) => r.querySelector('.lg-tag'))));
    ok(nombre + ': los pendientes por firmar salen en Enviado a firmar', (await s.textContent('#cuerpo details[data-lg="firma"]')).includes(cli[3].nombre.split(',')[0]));
    await s.click('#cuerpo [data-filtro-c="isp"]'); await s.waitForTimeout(150);
    ok(nombre + ': el tipo filtra todas las secciones y lo abierto sigue abierto', (await s.locator('#cuerpo details.lg-pl[open]').count()) === 5 && (await s.locator('#cuerpo .lg-row .lg-tag', { hasText: 'PYME' }).count()) === 0);
    await s.click('#cuerpo [data-filtro-c=""]'); await s.waitForTimeout(150);
    await s.screenshot({ path: 'capturas/lote12novB-p7-legal-' + nombre + '.png', fullPage: true });
    ok(nombre + ': Legal tiene la cola de contratos', (await s.locator('[data-tr="cola"]').count()) === 1);
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
