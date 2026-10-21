// Lote 22/10: Migraciones simple. Nuevo cambio en una pantalla (servicio por código, nombre o RIF; qué cambia con sus 4 tipos; nuevo titular y documentos),
// planilla oficial con fondo, Por revisar (documentos del expediente), Hecho del analista, confirmación con el TAD (con aviso de lo que falta),
// Sin registro (asignar, error o revertido) y en Actualizar el reporte de cambios de categoría (solo la fecha) y el de IP.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { RPC } = require('./mundo');
const { ok, cerrar } = marcador();
const llamo = (m, f) => m.llamadas.filter((l) => l[1] === f);
async function cerrarHojas(p){ for(let i = 0; i < 5 && await p.evaluate(() => !!window.Comun.hojaAbierta()); i++){ await p.keyboard.press('Escape'); await p.waitForTimeout(260); } }
const FILAS = [
  { s: '824', c: '777001', e: '48575443AAAA0001', t: 'J', d: 'J-41777001-2', n: 'Panaderia Inventada Uno', p: 'BRONCE-RES', ca: '1 GB', es: 'ACTIVO', di: 'Calle Falsa 1' },
  { s: '824', c: '777002', e: '48575443AAAA0002', t: 'J', d: '417770012', n: 'Panaderia Inventada Uno', p: 'BRONCE-RES', ca: 'PROMO-1GB', es: 'ACTIVO', di: 'Calle Falsa 1' },
  { s: '824', c: '777003', e: '48575443AAAA0003', t: 'V', d: 'V-9777003', n: 'Persona Inventada Dos', p: 'ORO-EMP', ca: 'PYME-1GB', es: 'ACTIVO', di: 'Calle Falsa 3' },
  { s: '824', c: '777004', e: '48575443AAAA0004', t: 'J', d: '417770049', n: 'Taller Inventado Cuatro', p: 'ORO-EMP', ca: 'PYME-1GB', es: 'ACTIVO', di: 'Calle Falsa 4' }];
function cargarTad(m, filas){
  const adm = m.personas.find((p) => p.rol === 'admin');
  const k = RPC.tad_indice_iniciar(m, adm, { p_archivo: 'tad.csv', p_total: filas.length });
  RPC.tad_indice_parte(m, adm, { p_carga: k, p_filas: filas }); return RPC.tad_indice_cerrar(m, adm, { p_carga: k });
}

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo); cargarTad(mundo, FILAS);
    // ----- El líder registra una migración -----
    const p = await entrar(ctx, 'lucia', '739105'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'migraciones.html'); await p.waitForSelector('[data-cam="nuevo"]');
    ok(nombre + ': Migraciones abre con sus 4 pestañas (el líder no ve Sin registro) y la fecha del TAD completo', (await p.locator('#filtros [data-camtab]').count()) === 4 && /TAD completo del/.test(await p.textContent('#lista')));
    await p.click('[data-cam="nuevo"]'); await p.waitForSelector('#hojaCambioN.ver #camBusca');
    await p.fill('#camBusca', 'p'); await p.click('[data-cam="buscar"]');
    ok(nombre + ': búsqueda muy corta da error debajo', (await p.textContent('#eCam_busca')).includes('3 letras'));
    await p.fill('#camBusca', '777001'); await p.click('[data-cam="buscar"]'); await p.waitForSelector('#hojaCambioN [data-srv]');
    ok(nombre + ': busca por código y muestra código, sucursal, plan, categoría, dirección y estado', (await p.locator('#hojaCambioN [data-srv]').count()) === 1 && /824-777001/.test(await p.textContent('#cCamN')) && /Maracaibo/.test(await p.textContent('#cCamN')) && /BRONCE-RES · 1 GB · ACTIVO/.test(await p.textContent('#cCamN')));
    await p.fill('#camBusca', 'panadería'); await p.click('[data-cam="buscar"]'); await p.waitForFunction(() => document.querySelectorAll('#hojaCambioN [data-srv]').length === 2);
    ok(nombre + ': busca por nombre y trae todos los servicios del titular', true);
    await p.click('[data-cam="crear"]');
    ok(nombre + ': sin servicio ni tipo da los dos errores debajo', (await p.textContent('#eCam_servicios')).includes('Marca al menos un servicio') && (await p.textContent('#eCam_tipo')).includes('Elige qué cambia'));
    ok(nombre + ': los 4 tipos con su línea de ayuda', (await p.locator('[data-camtipo]').count()) === 4 && /Cuenta como indicador negativo/.test(await p.textContent('#cCamN')));
    await p.check('[data-srv="824-777001-48575443AAAA0001"]'); await p.click('[data-camtipo="migracion"]'); await p.waitForSelector('.cam-docs');
    ok(nombre + ': migración muestra la zona de documentos con las casillas de una instalación', /RIF de la empresa/.test(await p.textContent('.cam-docs')) && /Acta constitutiva/.test(await p.textContent('.cam-docs')) && (await p.locator('#camSoltar').count()) === 1);
    await p.setInputFiles('#camArchivos', [{ name: 'rif.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 a') }, { name: 'acta.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 b') }]);
    await p.waitForFunction(() => document.querySelectorAll('.cam-arch li').length === 2);
    ok(nombre + ': los archivos soltados quedan listados y se pueden quitar', (await p.locator('[data-cam-quitar]').count()) === 2);
    ok(nombre + ': formulario sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/29-' + nombre + '-nuevo.png', fullPage: true });
    await p.click('[data-cam="crear"]'); await p.waitForSelector('#hojaCambio.ver #cCam .estado');
    ok(nombre + ': queda Por revisar y abre Subir varios para marcar cada archivo en el expediente', (await p.textContent('#cCam .estado')).includes('Por revisar') && llamo(mundo, 'cambio_crear').slice(-1)[0][2].p_datos.tipo === 'migracion');
    await p.waitForSelector('#hojaVarios.ver');
    ok(nombre + ': Subir varios trae los 2 archivos', (await p.locator('#hojaVarios [data-titulo], #hojaVarios .lote-f, #hojaVarios [data-i]').count()) >= 0 && /2 archivos/.test(await p.textContent('#hojaVarios')));
    await cerrarHojas(p);
    await p.click('#filtros [data-camtab="por_revisar"]');
    ok(nombre + ': la fila dice qué falta', /Falta|Faltan/.test(await p.textContent('#lista')));

    // ----- Cambio de titular: nuevo titular, planilla oficial -----
    await p.click('[data-cam="nuevo"]'); await p.waitForSelector('#hojaCambioN.ver #camBusca');
    await p.fill('#camBusca', '9777003'); await p.click('[data-cam="buscar"]'); await p.waitForSelector('[data-srv="824-777003-48575443AAAA0003"]');
    await p.check('[data-srv="824-777003-48575443AAAA0003"]'); await p.click('[data-camtipo="titularidad"]'); await p.waitForSelector('#camDoc');
    await p.click('[data-cam="crear"]');
    ok(nombre + ': titularidad sin datos del nuevo titular da errores debajo (empresa pide representante)', (await p.textContent('#eCam_doc')).includes('RIF') && /razón social/.test(await p.textContent('#eCam_nom')) && /representante/.test(await p.textContent('#eCam_repN')));
    await p.setInputFiles('#camRifArchivo', { name: 'rif-nuevo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 prueba') });
    await p.waitForFunction(() => /No se pudo leer/.test(document.getElementById('cCamN').textContent));
    ok(nombre + ': sin lectura del OCR avisa y deja escribir', (await p.inputValue('#camDoc')) === '' && /se guarda/.test(await p.textContent('#cCamN')));
    mundo.ocr = { estado: 'ok', tipo: 'rif_viejo', dudosa: false, datos: { rif: 'J417779999', razon_social: 'NUEVA EMPRESA INVENTADA, C.A', domicilio: 'CALLE 1 LOCAL 2 ZONA POSTAL 4001', vencimiento: '2028-01-01', motivos: [] } };
    await p.setInputFiles('#camRifArchivo', { name: 'rif-nuevo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 prueba') });
    await p.waitForFunction(() => /Leído del RIF/.test(document.getElementById('cCamN').textContent));
    ok(nombre + ': el RIF leído llena RIF, razón social y domicilio', (await p.inputValue('#camDoc')) === 'J-41777999-9' && (await p.inputValue('#camNom')) === 'NUEVA EMPRESA INVENTADA, C.A' && /ZONA POSTAL 4001/.test(await p.inputValue('#camDom')));
    ok(nombre + ': casillas de titularidad: planilla, identidad del titular actual y lo legal del nuevo', /Planilla/.test(await p.textContent('.cam-docs')) && /titular actual/.test(await p.textContent('.cam-docs')) && /Acta constitutiva del nuevo titular/.test(await p.textContent('.cam-docs')));
    await p.fill('#camRepN', 'Representante Inventado'); await p.fill('#camRepC', '12345678'); await p.fill('#camCorreo', 'malo'); await p.click('[data-cam="crear"]');
    ok(nombre + ': correo mal escrito se avisa debajo', /correo/.test(await p.textContent('#eCam_correo')));
    await p.fill('#camCorreo', 'nueva@empresa.test'); await p.fill('#camTel', '0414-555 12 34');
    await p.screenshot({ path: 'capturas/29-' + nombre + '-form-titular.png', fullPage: true });
    await p.click('[data-cam="crear"]'); await p.waitForSelector('#hojaCambio.ver [data-cam="planilla"]');
    const cc = llamo(mundo, 'cambio_crear').slice(-1)[0][2].p_datos;
    ok(nombre + ': el cambio lleva el nuevo titular con representante, correo y teléfono', cc.tipo === 'titularidad' && cc.nuevo.rep_nombre === 'Representante Inventado' && cc.nuevo.correo === 'nueva@empresa.test' && cc.nuevo.ocr.tipo === 'rif_viejo');
    mundo.ocr = null;
    ok(nombre + ': al registrar, la planilla queda lista para descargar o enviar', /Planilla lista/.test(await p.textContent('#cCam')) && (await p.locator('[data-cam="planillaWa"]').count()) === 1);
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-cam="planilla"]')]);
    const pdf = require('fs').readFileSync(await dl.path()).toString('latin1');
    ok(nombre + ': la planilla es un PDF con la hoja oficial de fondo y los datos encima', /\.pdf$/.test(dl.suggestedFilename()) && pdf.startsWith('%PDF') && /DCTDecode/.test(pdf) && /Helvetica/.test(pdf));
    ok(nombre + ': hoja del cambio sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/29-' + nombre + '-titularidad.png', fullPage: true });
    await cerrarHojas(p);

    // ----- Cambio a residencial: motivo obligatorio, va directo al analista -----
    await p.click('[data-cam="nuevo"]'); await p.waitForSelector('#hojaCambioN.ver #camBusca');
    await p.fill('#camBusca', '777004'); await p.click('[data-cam="buscar"]'); await p.waitForSelector('[data-srv]');
    await p.check('[data-srv="824-777004-48575443AAAA0004"]'); await p.click('[data-camtipo="residencial"]'); await p.waitForSelector('#camMotivo');
    ok(nombre + ': cambio a residencial no pide documentos', (await p.locator('.cam-docs').count()) === 0);
    await p.click('[data-cam="crear"]');
    ok(nombre + ': sin motivo da error debajo', (await p.textContent('#eCam_motivo')).includes('motivo'));
    await p.fill('#camMotivo', 'El cliente cerró el local'); await p.click('[data-cam="crear"]'); await p.waitForSelector('#hojaCambio.ver #cCam .estado');
    ok(nombre + ': queda Por emitir y el líder no ve Hecho', (await p.textContent('#cCam .estado')).includes('Por emitir') && (await p.locator('[data-cam-acc="hecho"]').count()) === 0);
    await cerrarHojas(p);

    // ----- La analista (Senior) marca Hecho; el TAD confirma o avisa lo que falta -----
    const a = await contexto(nav, dispositivo, mundo); const q = await entrar(a.ctx, 'elena', '315806'); q.on('pageerror', (e) => errores.push(e.message));
    const mig = mundo.datos.cambiosK.filas.find((c) => c.tipo === 'migracion'); mig.estado = 'por_emitir';   // el administrador ya aprobó los documentos
    await q.goto(H + 'migraciones.html'); await q.waitForSelector('#lista [data-cambio]');
    ok(nombre + ': la analista arranca en Por emitir con "Te toca"', (await q.getAttribute('#filtros [data-camtab="por_emitir"]', 'aria-selected')) === 'true' && /Te toca/.test(await q.textContent('#lista')));
    await q.locator('[data-cambio]', { hasText: 'Panaderia' }).click(); await q.waitForSelector('[data-cam-acc="hecho"]');
    await q.click('[data-cam-acc="hecho"]'); await q.waitForFunction(() => /Por confirmar/.test(document.querySelector('#cCam .estado').textContent));
    ok(nombre + ': Hecho deja el cambio Por confirmar con su bitácora', /Marcó Hecho/.test(await q.textContent('#cCam')));
    await cerrarHojas(q);
    await q.locator('[data-cambio]', { hasText: 'Taller' }).click(); await q.waitForSelector('[data-cam-acc="hecho"]'); await q.click('[data-cam-acc="hecho"]');
    await q.waitForFunction(() => /Por confirmar/.test(document.querySelector('#cCam .estado').textContent)); await cerrarHojas(q);
    // Siguiente TAD: la panadería solo cambió la categoría (falta el plan); el taller ya es residencial
    const r = cargarTad(mundo, [Object.assign({}, FILAS[0], { ca: 'PYME-1GB' }), FILAS[1], FILAS[2], Object.assign({}, FILAS[3], { ca: '1 GB', p: 'BRONCE-RES' })]);
    ok(nombre + ': el TAD confirma el cambio a residencial y deja la migración con aviso', r.confirmados === 1 && r.avisos === 1);
    await q.reload(); await q.waitForSelector('#lista [data-cambio]'); await q.click('#filtros [data-camtab="por_confirmar"]');
    ok(nombre + ': Por confirmar muestra "Falta cambiar el plan"', /Falta cambiar el plan/.test(await q.textContent('#lista')));
    await q.click('#filtros [data-camtab="confirmado"]');
    ok(nombre + ': el cambio a residencial confirmado es indicador negativo', /Indicador negativo/.test(await q.textContent('#lista')));
    cargarTad(mundo, [Object.assign({}, FILAS[0], { ca: 'PYME-1GB', p: 'ORO-EMP', e: '48575443AAAA0001' }), FILAS[1], FILAS[2]]);
    ok(nombre + ': con plan y categoría la migración se confirma y comisiona', mig.estado === 'confirmado' && mig.comision === 'si');

    // ----- Sin registro: el Analista Senior lo asigna a un líder -----
    mundo.datos.cambiosK.filas.push({ id: 900, tipo: 'migracion', estado: 'sin_registro', origen: 'tad', creado_en: new Date().toISOString(), titular: { nombre: 'Ferreteria Inventada', doc: '417770501' },
      categoria_anterior: '1 GB', categoria_nueva: 'PYME-1GB', plan_anterior: 'BRONCE-RES', plan_nuevo: 'ORO-EMP', servicios: [{ sucursal: '824', codigo: '777050' }], bitacora: [{ accion: 'cambio_sin_registro', en: new Date().toISOString() }] });
    await q.reload(); await q.waitForSelector('#filtros [data-camtab="sin_registro"]'); await q.click('#filtros [data-camtab="sin_registro"]');
    await q.locator('[data-cambio]', { hasText: 'Ferreteria' }).click(); await q.waitForSelector('[data-cam-acc="asignar"]');
    ok(nombre + ': Sin registro ofrece Asignar, Fue un error y Revertido', (await q.locator('[data-cam-acc="error"]').count()) === 1 && (await q.locator('[data-cam-acc="revertido"]').count()) === 1);
    await q.click('[data-cam-acc="asignar"]');
    ok(nombre + ': asignar sin líder da error debajo', (await q.textContent('#eCamLider')).includes('Elige el líder'));
    await q.selectOption('#camLider', { label: 'Lucía Ferrer' }); await q.click('[data-cam-acc="asignar"]');
    await q.waitForFunction(() => !/Sin registro/.test(document.querySelector('#cCam .estado').textContent));
    ok(nombre + ': asignado entra al flujo con sus documentos', llamo(mundo, 'cambio_accion').some((l) => l[2].p_accion === 'asignar' && l[2].p_lider));
    await q.screenshot({ path: 'capturas/29-' + nombre + '-analista.png', fullPage: true });
    await cerrarHojas(q); await a.ctx.close();

    // ----- Actualizar: fecha exacta del reporte de Proham y reporte de IP -----
    const b = await contexto(nav, dispositivo, mundo); const z = await entrar(b.ctx, 'marcos', '482913'); z.on('pageerror', (e) => errores.push(e.message));
    await z.goto(H + 'actualizar.html'); await z.waitForSelector('#ultimas .ult');
    ok(nombre + ': Actualizar dice la última subida de cada archivo, también IP', /TAD completo/.test(await z.textContent('#ultimas')) && /IP/.test(await z.textContent('#ultimas')));
    await z.setInputFiles('#archivos', [{ name: 'cambios_categoria.csv', mimeType: 'text/csv', buffer: Buffer.from('Código;Nombre;Fecha;Categoría anterior;Categoría actual;Operador;Comentario\n777002;PANADERIA;14-10-2026;RESIDENCIAL;PYME-1GB;Juan;\n777010;Y;14-10-2026;056;PYME-1GB;RADIUS;\n') },
      { name: 'clientes_empresariales.csv', mimeType: 'text/csv', buffer: Buffer.from('Clientes Empresariales;;;;;;;;\nSucursal;Cliente;Nombre;ONT;VLAN;Fecha Asignación;Estado;IPV4;IPV6\n824 - MARACAIBO;777001;PANADERIA;48575443AAAA0001;100;01/10/2026;ASIGNADA;190.1.1.1;2803::1\n824 - MARACAIBO;;;;100;;DISPONIBLE;190.1.1.9;\n') }]);
    await z.waitForSelector('#cargarTodo');
    ok(nombre + ': reconoce el reporte de cambios y el de IP (la fila DISPONIBLE queda fuera)', /Cambios de categoría/.test(await z.textContent('#zona')) && /IP \(Clientes Empresariales\)/.test(await z.textContent('#zona')) && /1 disponibles quedan fuera/.test(await z.textContent('#zona')));
    await z.click('#cargarTodo'); await z.waitForFunction(() => /IP por confirmar/.test(document.getElementById('zona').textContent) && /fecha exacta/.test(document.getElementById('zona').textContent));
    const ip = llamo(mundo, 'ip_reporte_cargar').slice(-1)[0];
    ok(nombre + ': el reporte de IP sube sucursal, código, ONT e IP', ip && ip[2].p_filas.length === 1 && ip[2].p_filas[0].e === '48575443AAAA0001' && ip[2].p_filas[0].ip === '190.1.1.1' && /824 - MARACAIBO/.test(ip[2].p_filas[0].s));
    ok(nombre + ': Actualizar sin desborde', await sinDesborde(z));
    await b.ctx.close(); await ctx.close();
  }
  ok('sin errores de la página', errores.length === 0, errores);
  await nav.close(); cerrar();
})();
