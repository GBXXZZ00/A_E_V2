// Lote 4 (14/10): cambios de categoría y de titularidad. Desde la corrida de Migraciones viven en su propio módulo (migraciones.html), buscador de servicios del TAD completo,
// pedido del líder, planilla de cambio de titular, aprobación del administrador, Emitido, Sin solicitud con Vincular,
// archivo de cambios de categoría en Actualizar (RADIUS se ignora) y la última subida de cada archivo.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { RPC } = require('./mundo');
const { ok, cerrar } = marcador();
const llamo = (m, f) => m.llamadas.filter((l) => l[1] === f);
async function cerrarHojas(p){ for(let i = 0; i < 5 && await p.evaluate(() => !!window.Comun.hojaAbierta()); i++){ await p.keyboard.press('Escape'); await p.waitForTimeout(260); } }
function sembrarIndice(m){
  const adm = m.personas.find((p) => p.rol === 'admin');
  const k = RPC.tad_indice_iniciar(m, adm, { p_archivo: 'tad.csv', p_total: 3 });
  RPC.tad_indice_parte(m, adm, { p_carga: k, p_filas: [
    { s: '824', c: '777001', t: 'J', d: 'J-41777001-2', n: 'Panaderia Inventada Uno', p: 'HOGAR 300', ca: 'RESIDENCIAL', es: 'ACTIVO', di: 'Calle Falsa 1', pon: 'PONX-1' },
    { s: '824', c: '777002', t: 'J', d: '417770012', n: 'Panaderia Inventada Uno', p: 'HOGAR 300', ca: 'RESIDENCIAL', es: 'ACTIVO', di: 'Calle Falsa 1', pon: 'PONX-2' },
    { s: '824', c: '777003', t: 'V', d: 'V-9777003', n: 'Persona Inventada Dos', p: 'PYME 1GB', ca: 'PYME-1GB', es: 'ACTIVO', di: 'Calle Falsa 3', pon: 'PONX-3' }] });
  RPC.tad_indice_cerrar(m, adm, { p_carga: k });
}

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo); sembrarIndice(mundo);
    // ----- El líder pide un cambio de categoría -----
    const p = await entrar(ctx, 'lucia', '739105'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'migraciones.html'); await p.waitForSelector('[data-cam="nuevo"]');
    ok(nombre + ': Migraciones abre con sus pestañas y dice cuándo se subió el TAD completo', (await p.locator('#filtros [data-camtab]').count()) >= 7 && /TAD completo del/.test(await p.textContent('#lista')));
    await p.click('[data-cam="nuevo"]'); await p.waitForSelector('#hojaCambioN.ver #camBusca');
    await p.fill('#camBusca', 'pa'); await p.click('[data-cam="buscar"]');
    ok(nombre + ': búsqueda muy corta da error debajo', (await p.textContent('#eCam_busca')).includes('3 letras'));
    await p.fill('#camBusca', 'panadería'); await p.click('[data-cam="buscar"]'); await p.waitForSelector('#hojaCambioN [data-srv]');
    ok(nombre + ': el buscador muestra todos los servicios del titular con código, PON, plan y dirección', (await p.locator('#hojaCambioN [data-srv]').count()) === 2 && /PON PONX-1/.test(await p.textContent('#cCamN')) && /Calle Falsa 1/.test(await p.textContent('#cCamN')));
    await p.click('[data-cam="crear"]');
    ok(nombre + ': sin marcar servicio no deja pedir', (await p.textContent('#eCam_servicios')).includes('Marca al menos un servicio'));
    await p.check('[data-srv="824-777001"]'); await p.click('[data-cam="crear"]');
    ok(nombre + ': sin categoría nueva da error debajo', (await p.textContent('#eCam_cat')).includes('categoría'));
    ok(nombre + ': la categoría nueva es una lista cerrada con las categorías del TAD', (await p.evaluate(() => document.getElementById('camCat').tagName)) === 'SELECT' && (await p.locator('#camCat option').count()) >= 6);
    await p.selectOption('#camCat', 'PYME-1GB');
    await p.screenshot({ path: 'capturas/29-' + nombre + '-nuevo.png', fullPage: true });
    await p.click('[data-cam="crear"]'); await p.waitForSelector('#hojaCambio.ver #cCam .estado');
    ok(nombre + ': queda Por emitir (va directo al analista) y se puede cancelar', (await p.textContent('#cCam .estado')).includes('Por emitir') && (await p.locator('[data-cam-acc="cancelar"]').count()) === 1 && llamo(mundo, 'cambio_crear').length === 1);
    await cerrarHojas(p);
    ok(nombre + ': la fila está en Por emitir y dice que va a PYME', (await p.getAttribute('#filtros [data-camtab="por_emitir"]', 'aria-selected')) === 'true' && /A PYME/.test(await p.textContent('#lista')));
    // ----- Titularidad: planilla y documentos -----
    await p.click('[data-cam="nuevo"]'); await p.waitForSelector('#hojaCambioN.ver #camBusca');
    await p.fill('#camBusca', '9777003'); await p.click('[data-cam="buscar"]'); await p.waitForSelector('[data-srv="824-777003"]');
    await p.check('[data-srv="824-777003"]'); await p.click('[data-camtipo="titularidad"]'); await p.waitForSelector('#camDoc');
    ok(nombre + ': tipo de solicitud con las cuatro opciones de la planilla (sin "Es")', (await p.locator('[data-camsol]').count()) === 4 && (await p.locator('[data-camnat]').count()) === 0 && /persona natural/.test(await p.textContent('#cCamN')));
    await p.click('[data-cam="crear"]');
    ok(nombre + ': titularidad sin tipo ni datos del nuevo titular da errores debajo', /tipo de solicitud/.test(await p.textContent('#eCam_sol')) && (await p.textContent('#eCam_doc')).includes('RIF') && /razón social/.test(await p.textContent('#eCam_nom')));
    // Subir RIF: si Google no lo lee, se escribe a mano y el archivo igual se guarda
    await p.setInputFiles('#camRifArchivo', { name: 'rif-nuevo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 prueba') });
    await p.waitForFunction(() => /No se pudo leer/.test(document.getElementById('cCamN').textContent));
    ok(nombre + ': sin lectura del OCR avisa y deja escribir', (await p.inputValue('#camDoc')) === '' && /se guarda/.test(await p.textContent('#cCamN')));
    // Con lectura clara: llena RIF, razón social y domicilio, y propone el tipo de solicitud
    mundo.ocr = { estado: 'ok', tipo: 'rif_viejo', dudosa: false, datos: { rif: 'J417779999', razon_social: 'NUEVA EMPRESA INVENTADA, C.A', domicilio: 'CALLE 1 LOCAL 2 CIUDAD PRUEBA ZONA POSTAL 4001', vencimiento: '2028-01-01', motivos: [] } };
    await p.click('[data-cam="rif"]').catch(() => {});
    await p.setInputFiles('#camRifArchivo', { name: 'rif-nuevo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 prueba') });
    await p.waitForFunction(() => /Leído del RIF/.test(document.getElementById('cCamN').textContent));
    ok(nombre + ': el RIF leído llena los datos para confirmar', (await p.inputValue('#camDoc')) === 'J-41777999-9' && (await p.inputValue('#camNom')) === 'NUEVA EMPRESA INVENTADA, C.A' && /ZONA POSTAL 4001/.test(await p.inputValue('#camDom')));
    ok(nombre + ': propone natural a jurídico y dice qué documentos se piden', (await p.getAttribute('[data-camsol="natural_juridico"]', 'aria-checked')) === 'true' && /RIF de la empresa nueva/.test(await p.textContent('.cam-docs')) && /Planilla/.test(await p.textContent('.cam-docs')));
    await p.click('[data-camsol="natural_natural"]'); await p.click('[data-cam="crear"]');
    ok(nombre + ': natural a natural con un RIF J da error debajo', /V o E/.test(await p.textContent('#eCam_doc')));
    await p.click('[data-camsol="natural_juridico"]');
    ok(nombre + ': formulario de titular sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/29-' + nombre + '-form-titular.png', fullPage: true });
    await p.click('[data-cam="crear"]');
    await p.waitForSelector('#hojaCambio.ver [data-cam="planilla"]');
    const cc = llamo(mundo, 'cambio_crear').slice(-1)[0][2].p_datos;
    ok(nombre + ': el cambio lleva el tipo de solicitud, el domicilio y que vino del OCR', cc.tipo_solicitud === 'natural_juridico' && /ZONA POSTAL/.test(cc.nuevo.domicilio) && cc.nuevo.ocr.tipo === 'rif_viejo');
    const conRif = () => (mundo.datos.clientes.find((c) => c.doc_numero === '417779999') || { documentos: [] }).documentos.some((d) => d.casilla === 'rif_empresa');
    for(let i = 0; i < 100 && !conRif(); i++) await p.waitForTimeout(100);
    ok(nombre + ': el RIF queda en la casilla RIF de la empresa del nuevo titular', mundo.llamadas.some((l) => l[0] === 'subir') && (mundo.datos.clientes.find((c) => c.doc_numero === '417779999') || { documentos: [] }).documentos.some((d) => d.casilla === 'rif_empresa'));
    mundo.ocr = null;
    const det = await p.textContent('#cCam');
    ok(nombre + ': titularidad queda por aprobar y pide la planilla y los documentos del nuevo titular', det.includes('Por aprobar') && det.includes('Planilla de cambio de titular firmada') && det.includes('Cédula o RIF del titular actual') && det.includes('Acta constitutiva del nuevo titular'));
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-cam="planilla"]')]);
    ok(nombre + ': la planilla se descarga en PDF', /^Cambio_de_Titular_.*\.pdf$/.test(dl.suggestedFilename()));
    ok(nombre + ': el líder no ve Aprobar', (await p.locator('[data-cam-acc="aprobar"]').count()) === 0);
    ok(nombre + ': hoja del cambio sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/29-' + nombre + '-titularidad.png', fullPage: true });
    await cerrarHojas(p);

    // ----- El administrador aprueba, marca emitido y resuelve lo que llegó sin solicitud -----
    const a = await contexto(nav, dispositivo, mundo); const q = await entrar(a.ctx, 'marcos', '482913'); q.on('pageerror', (e) => errores.push(e.message));
    RPC.cambios_archivo_cargar(mundo, mundo.personas[0], { p_archivo: 'cambios.xlsx', p_filas: [
      { codigo: '777009', nombre: 'X', fecha: '14-10-2026', anterior: '056', actual: 'PYME-1GB', operador: 'RADIUS' },
      { codigo: '777050', nombre: 'Ferreteria Inventada', fecha: '13-10-2026', anterior: 'RESIDENCIAL', actual: 'PYME-1GB', operador: 'Ana' }] });
    await q.goto(H + 'migraciones.html'); await q.waitForSelector('#lista [data-cambio]');
    const tabs = await q.textContent('#filtros');
    ok(nombre + ': el administrador ve Por aprobar, Por emitir y Sin solicitud con su contador', /Por aprobar\s*1/.test(tabs) && /Por emitir\s*1/.test(tabs) && /Sin solicitud\s*1/.test(tabs));
    ok(nombre + ': arranca en lo que le toca (Por aprobar)', (await q.getAttribute('#filtros [data-camtab="por_aprobar"]', 'aria-selected')) === 'true');
    await q.screenshot({ path: 'capturas/29-' + nombre + '-admin.png', fullPage: true });
    await q.locator('[data-cambio]', { hasText: 'Persona Inventada Dos' }).click(); await q.waitForSelector('[data-cam-acc="aprobar"]');
    await q.click('[data-cam-acc="rechazar"]');
    ok(nombre + ': rechazar sin nota pide el motivo', (await q.textContent('#eCamAcc')).includes('por qué'));
    await q.click('[data-cam-acc="aprobar"]'); await q.waitForSelector('[data-cam-acc="emitido"]');
    ok(nombre + ': aprobado pasa a Por emitir', (await q.textContent('#cCam .estado')).includes('Por emitir'));
    await q.click('[data-cam-acc="emitido"]'); await q.waitForFunction(() => /Por confirmar/.test(document.querySelector('#cCam .estado').textContent));
    ok(nombre + ': marcado emitido queda Por confirmar con su bitácora', (await q.textContent('#cCam')).includes('Marcó emitido'));
    await cerrarHojas(q);
    await q.click('#filtros [data-camtab="sin_solicitud"]'); await q.locator('[data-cambio]', { hasText: 'Ferreteria Inventada' }).click(); await q.waitForSelector('[data-cam-acc="vincular"]');
    await q.click('[data-cam-acc="vincular"]');
    ok(nombre + ': vincular sin líder da error debajo', (await q.textContent('#eCamLider')).includes('Elige el líder'));
    await q.selectOption('#camLider', { label: 'Lucía Ferrer' }); await q.click('[data-cam-acc="vincular"]');
    await q.waitForFunction(() => /Confirmado/.test(document.querySelector('#cCam .estado').textContent));
    ok(nombre + ': vinculado a un líder queda confirmado, con la comisión por decidir', llamo(mundo, 'cambio_accion').some((l) => l[2].p_accion === 'vincular' && l[2].p_lider) && /Por decidir/.test(await q.textContent('#cCam')));
    await cerrarHojas(q);

    // ----- Actualizar: archivo de cambios de categoría y última subida de cada archivo -----
    await q.goto(H + 'actualizar.html'); await q.waitForSelector('#ultimas .ult');
    ok(nombre + ': Actualizar dice la última subida del TAD completo y de los cambios', (await q.textContent('#ultimas')).includes('TAD completo') && (await q.textContent('#ultimas')).includes('Cambios de categoría'));
    await q.setInputFiles('#archivos', { name: 'cambios_categoria.csv', mimeType: 'text/csv', buffer: Buffer.from('Código;Nombre;Fecha;Categoría anterior;Categoría actual;Operador;Comentario\n777002;PANADERIA;14-10-2026;RESIDENCIAL;PYME-1GB;Juan;\n777010;Y;14-10-2026;056;PYME-1GB;RADIUS;\n') });
    await q.waitForSelector('#cargarTodo');
    ok(nombre + ': reconoce el archivo de cambios de categoría', (await q.textContent('#zona')).includes('Cambios de categoría'));
    await q.click('#cargarTodo'); await q.waitForFunction(() => /confirmado|sin solicitud/.test(document.getElementById('zona').textContent));
    const sub = llamo(mundo, 'cambios_archivo_cargar').slice(-1)[0];
    ok(nombre + ': lo sube con sus columnas y el servidor ignora RADIUS', sub && sub[2].p_filas.length === 2 && sub[2].p_filas[0].anterior === 'RESIDENCIAL' && /ignorados/.test(await q.textContent('#zona')));
    ok(nombre + ': Actualizar sin desborde', await sinDesborde(q));
    await a.ctx.close(); await ctx.close();
  }
  ok('sin errores de la página', errores.length === 0, errores);
  await nav.close(); cerrar();
})();
