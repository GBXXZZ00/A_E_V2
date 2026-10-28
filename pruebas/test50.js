// Lote 28/10: rediseño. Estatus legal en 5 grupos, Comisiones por equipo con ranking y monto, órdenes por instalar en horas (aviso de 24 h),
// cliente nuevo sin orden, carta y proforma en un solo envío (Canales y líder; el líder no envía las de aliados), Mi trabajo por rol con
// Ir y tachado al resolverse, notas personales con Deshacer, revisión en lote, Inicio con "Mis pendientes, agrupados", Actualizar y Usuarios.
// Datos inventados (mundo.js).
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
const llamo = (m, f) => m.llamadas.filter((l) => l[1] === f);
async function cerrarHojas(p){ for(let i = 0; i < 5 && await p.evaluate(() => !!window.Comun.hojaAbierta()); i++){ await p.keyboard.press('Escape'); await p.waitForTimeout(260); } }

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    const vigilar = (p) => p.on('pageerror', (e) => errores.push(nombre + ': ' + e.message));

    // ----- Clientes: estatus legal en 5 grupos -----
    const a = await entrar(ctx, 'marcos', '482913'); vigilar(a);
    await a.goto(H + 'clientes.html'); await a.waitForSelector('#panelCli .cp-leg, #panelCli [data-cp-g]', { timeout: 15000 }).catch(() => {});
    const txt = await a.textContent('#panelCli').catch(() => '');
    ok(nombre + ': Clientes cuenta el estatus legal en 5 grupos', ['Sin gestionar', 'Faltan documentos', 'En revisión', 'Por firmar', 'Firmado'].every((t) => txt.includes(t)));
    ok(nombre + ': "Grandes negocios" sale como Sin gestionar, nunca como completo', !/Grandes negocios/.test(txt));

    // ----- Comisiones: equipos, avisos de 24 horas, resumen con ranking y monto -----
    await a.goto(H + 'comisiones.html'); await a.waitForSelector('#equipos button, #equipos [data-equipo]', { timeout: 15000 });
    const eq = await a.textContent('#equipos');
    ok(nombre + ': Comisiones separa por equipo (Ventas corporativas, Canales, Aliados)', /corporativas/i.test(eq) && /Canales/i.test(eq) && /Aliados/i.test(eq));
    ok(nombre + ': arriba las tarjetas Instalaciones, Cambios de categoría y Cartas y proformas', /Instalaciones/.test(await a.textContent('#segs')) && /Cambios de categor/.test(await a.textContent('#segs')) && /Cartas y proformas/.test(await a.textContent('#segs')));
    ok(nombre + ': el aviso de Por instalar habla en horas', /hora/i.test(await a.textContent('#alertas')));
    ok(nombre + ': Comisiones sin desborde', await sinDesborde(a));
    await a.goto(H + 'comisiones.html?v=resumen'); await a.waitForSelector('.cr-rank, .cr-podio, [data-cr]', { timeout: 15000 }).catch(() => {});
    const res = await a.textContent('main');
    ok(nombre + ': el Resumen de Comisiones trae ranking, monto del corte y Líder del mes', /Ranking del corte/.test(res) && /\$/.test(res) && /Líder de /.test(res));
    ok(nombre + ': el Resumen se pide por corte', llamo(mundo, 'comisiones_resumen').length >= 1);

    // ----- Revisión en lote -----
    await a.goto(H + 'revision.html'); await a.waitForURL(/trabajo\.html\?v=lote/);
    ok(nombre + ': revision.html lleva a la revisión en lote de Mi trabajo', true);
    await a.waitForSelector('#rlFlt .rl-f');
    ok(nombre + ': filtros de la IA (Apto, No apto, A mano, Sin leer) y Solo el corte', (await a.locator('#rlFlt [data-rl-ia]').count()) === 4 && (await a.locator('#rlFlt [data-rl-corte]').count()) === 1);
    ok(nombre + ': Revisión ya no está en el menú', (await a.locator('nav a[href="revision.html"]').count()) === 0);
    const hayDocs = await a.locator('[data-rl-cli]').count();
    if(hayDocs){
      await a.locator('[data-rl-cli]').first().click();
      ok(nombre + ': elegir el cliente marca todos sus documentos', /seleccionad/.test(await a.textContent('#rlBar')) && !(await a.locator('[data-rl="aprobar"]').isDisabled()));
      await a.click('[data-rl="aprobar"]'); await a.waitForSelector('#bzAviso:not(.hidden)');
      ok(nombre + ': Aprobar seleccionados pasa por revision_lote y avisa en la misma pantalla', llamo(mundo, 'revision_lote').length === 1 && /aprobad/.test(await a.textContent('#bzAviso')) && /quedan/.test(await a.textContent('#bzAviso')));
    } else ok(nombre + ': hay documentos por revisar en el mundo de prueba', false);
    await a.screenshot({ path: 'capturas/lote28-' + nombre + '-revision-lote.png', fullPage: true });
    await a.click('[data-rl="volver"]'); await a.waitForSelector('#tarjetas .bz-cd');
    ok(nombre + ': Volver deja el buzón', await a.isVisible('#vistaBuzon'));

    // ----- Mi trabajo: líder (Mis ventas y su rol), Ir con tachado, notas -----
    const cL = await contexto(nav, dispositivo, mundo); const p = await entrar(cL.ctx, 'lucia', '739105'); vigilar(p);
    await p.goto(H + 'trabajo.html'); await p.waitForSelector('#tarjetas .bz-cd');
    // Carta y proforma: el líder no envía la de un cliente de aliado (lo decide el servidor); Canales sí
    const ali = mundo.datos.clientes.find((c) => c.lider_id === '22222222-2222-4222-8222-222222222222' && c.servicios.length && c.instalaciones.length);
    ali.instalaciones.forEach((i) => { i.es_aliado = true; });
    const envia = (pg) => pg.evaluate(async (x) => { try { await window.Comun.rpc('envio_registrar', { p_servicio: x, p_tipos: ['proforma', 'bienvenida'], p_canal: 'manual', p_destino: null }); return 'ok'; } catch (e) { return e.message; } }, ali.servicios[0].id);
    ok(nombre + ': el líder no puede enviar la carta de un cliente de aliado', (await envia(p)) !== 'ok');
    ok(nombre + ': Canales o el administrador sí la envían', (await envia(a)) === 'ok');
    ali.instalaciones.forEach((i) => { i.es_aliado = false; });
    const idx = await p.textContent('#tarjetas');
    ok(nombre + ': la líder ve Mis ventas (Devueltos, Faltan para comisionar, Por instalar) y su rol', /Mis ventas/i.test(idx) && /Devueltos/.test(idx) && /Faltan para comisionar/.test(idx) && /Mi rol/i.test(idx) && /Gestiones asignadas/.test(idx));
    ok(nombre + ': un solo Por instalar en el índice', (idx.match(/Por instalar/g) || []).length === 1);
    ok(nombre + ': números arriba (devueltos, órdenes de 24 horas, cierre y faltan)', (await p.locator('#nums .bz-num').count()) === 4 && /24 horas/.test(await p.textContent('#nums')));
    ok(nombre + ': Lo más urgente con su botón', /Lo más urgente/.test(await p.textContent('#cuerpo')) && (await p.locator('#cuerpo [data-hacer]').count()) > 0);
    ok(nombre + ': Mi trabajo de la líder sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/lote28-' + nombre + '-mitrabajo-lider.png', fullPage: true });
    // Ir: abre la hoja encima en la pestaña que toca; al resolverse queda tachado
    await p.click('#tarjetas [data-grupo="doc"]');
    const k = await p.locator('#cuerpo [data-hacer]').first().getAttribute('data-hacer');
    await p.locator('#cuerpo [data-hacer]').first().click(); await p.waitForSelector('#hojaFicha.ver');
    ok(nombre + ': Ir abre el cliente encima, en Documentos', (await p.evaluate(() => window.Comun.hojasAbiertas().join())) === 'hojaFicha' && (await p.locator('#tabs [data-tab="documentos"].on').count()) === 1);
    mundo.datos.pendientes = mundo.datos.pendientes.filter((x) => x.tipo + '|' + x.clave !== k);   // como si ya hubiera subido lo que faltaba
    await cerrarHojas(p); await p.waitForSelector('#bzAviso:not(.hidden)');
    ok(nombre + ': al volver, lo resuelto sale tachado y el aviso dice cuántos quedan', /Se quitó de tus pendientes/.test(await p.textContent('#bzAviso')) && (await p.locator('#cuerpo .bz-it.hecho').count()) >= 1);
    // Gestión: el estado se cambia ahí mismo
    await p.click('#tarjetas [data-grupo="ges"]');
    if(await p.locator('#cuerpo [data-gest-est="esperando"]').count()){
      await p.locator('#cuerpo [data-gest-est="sin_contacto"]').first().click(); await p.waitForTimeout(400);
      ok(nombre + ': el estado de la gestión se marca desde la lista', llamo(mundo, 'gestion_cliente_estado').length >= 1);
    }
    // Notas personales con recordatorio y Deshacer
    await p.click('#tarjetas [data-grupo="notas"]'); await p.waitForSelector('#formNotaP');
    await p.click('#formNotaP [type="submit"]');
    ok(nombre + ': la nota vacía avisa debajo del campo', /Escribe la nota/.test(await p.textContent('#eNt')));
    await p.fill('#ntTexto', 'Llamar a la clínica por el acta'); await p.click('#formNotaP [type="submit"]'); await p.waitForSelector('#cuerpo [data-nota-hecha]');
    ok(nombre + ': la nota se guarda y sale en Mis notas', /Llamar a la clínica/.test(await p.textContent('#cuerpo')) && llamo(mundo, 'nota_guardar').length === 1);
    await p.click('#cuerpo [data-nota-hecha]'); await p.waitForSelector('#bzAviso [data-tr="deshacer"]');
    ok(nombre + ': marcar la nota como hecha ofrece Deshacer', /hecha/.test(await p.textContent('#bzAviso')));
    await p.click('#bzAviso [data-tr="deshacer"]'); await p.waitForTimeout(400);
    ok(nombre + ': Deshacer la desmarca', llamo(mundo, 'nota_hecha').length === 2 && llamo(mundo, 'nota_hecha')[1][2].p_hecha === false);

    // ----- Inicio: Mis pendientes, agrupados -----
    await p.goto(H + 'inicio.html'); await p.waitForSelector('.bz-ini-card', { timeout: 15000 });
    ok(nombre + ': Inicio trae Mis pendientes, agrupados con Ver todo mi trabajo', /Mis pendientes, agrupados/.test(await p.textContent('#zonaPendientes')) && /Ver todo mi trabajo/.test(await p.textContent('#zonaPendientes')));
    ok(nombre + ': cada grupo abre Mi trabajo en ese grupo', /trabajo\.html\?g=/.test(await p.locator('.bz-ini').first().getAttribute('href')));
    ok(nombre + ': los módulos de Inicio siguen como hoy', (await p.locator('#zonaModulos .mod').count()) >= 4);
    await p.screenshot({ path: 'capturas/lote28-' + nombre + '-inicio.png', fullPage: true });

    // ----- Mi trabajo del administrador: el equipo en solo consulta -----
    await a.goto(H + 'trabajo.html'); await a.waitForSelector('#tarjetas .bz-cd');
    if(await a.locator('[data-persona]').count()){
      await a.locator('[data-persona]').first().click(); await a.waitForSelector('#bandaPersona:not(.hidden)');
      ok(nombre + ': el administrador ve el buzón de otra persona en solo consulta, sin botones', /Solo consulta/.test(await a.textContent('#bandaPersona')) && (await a.locator('#cuerpo [data-hacer]').count()) === 0);
    }

    // ----- Actualizar: qué toca, solo administrador y Senior -----
    await a.goto(H + 'actualizar.html'); await a.waitForSelector('#ultimas .act-f', { timeout: 15000 });
    ok(nombre + ': Actualizar dice qué toca actualizar con cada archivo', /TAD/.test(await a.textContent('#ultimas')) && /Mapa de red/.test(await a.textContent('#ultimas')));
    ok(nombre + ': Actualizar no tiene los botones de ir a Comisiones ni a Factibilidad', !/Ver comisiones|Ir a Factibilidad/.test(await a.textContent('main')));
    mundo.personas.find((x) => x.usuario === 'pedro').debe_cambiar_pin = false;
    const cP = await contexto(nav, dispositivo, mundo); const q = await entrar(cP.ctx, 'pedro', '204871').catch(() => null);
    if(q){ await q.goto(H + 'actualizar.html'); await q.waitForSelector('main .vacio', { timeout: 15000 }).catch(() => {});
      ok(nombre + ': un analista que no es Senior no actualiza', /administrador y la Analista Senior/.test(await q.textContent('main'))); }

    // ----- Usuarios: columna Equipo -----
    if(nombre === 'pc'){
      await a.goto(H + 'usuarios.html'); await a.waitForSelector('.persona');
      await a.waitForFunction(() => /Ventas corporativas|Canales de atención/.test(document.getElementById('lista').textContent));
      ok(nombre + ': Usuarios muestra el equipo de comisiones de cada uno', /Canales de atención/.test(await a.textContent('#lista')));
      await a.locator('.persona', { hasText: 'Pedro' }).first().click(); await a.waitForSelector('#fEquipoCom');
      await a.selectOption('#fEquipoCom', 'corporativas'); await a.click('#guardar'); await a.waitForTimeout(600);
      ok(nombre + ': cambiar el equipo pasa por perfil_equipo_guardar', llamo(mundo, 'perfil_equipo_guardar').length === 1 && llamo(mundo, 'perfil_equipo_guardar')[0][2].p_equipo === 'corporativas');
    }
    await cL.ctx.close(); await cP.ctx.close(); await ctx.close();
  }
  ok('sin errores de JavaScript', errores.length === 0); if(errores.length) console.log(errores.slice(0, 5).join('\n'));
  await nav.close(); cerrar();
})().catch((e) => { console.error(e); process.exit(1); });
