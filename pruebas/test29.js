// Migraciones (lote 22/10, rediseñada en el lote 16/11 A). Lista por líder con tarjetas y pastillas; solicitud por pasos
// (Servicio, Titular, Documentos, Enviar) con el RIF que se lee solo, borrador en los pendientes y planilla oficial;
// residencial con motivo; Hecho del analista; confirmación con el TAD; sin registrar asignada a un líder; reporte en Actualizar.
const { esperarDia, chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { RPC } = require('./mundo');
const { ok, cerrar } = marcador();
const llamo = (m, f) => m.llamadas.filter((l) => l[1] === f);
async function cerrarHojas(p){ for(let i = 0; i < 5 && await p.evaluate(() => !!window.Comun.hojaAbierta() || (!!document.getElementById('msFondo') && !document.getElementById('msFondo').hidden)); i++){ await p.keyboard.press('Escape'); await p.waitForTimeout(260); } }
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
// Deja subidos (por revisar) todos los documentos que pide el cambio
function documentosListos(m, id){
  const lucia = m.personas.find((p) => p.usuario === 'lucia'); const d = RPC.cambio_detalle(m, lucia, { p_id: id });
  (d.requisitos || []).forEach((r, i) => { const c = m.datos.clientes.find((x) => x.id === r.cliente_id); c.documentos = c.documentos || [];
    c.documentos.push({ id: 70000 + id * 10 + i, casilla: r.casilla, numero: r.numero, estado: 'por_revisar', archivos: [{ id: 'a' + id + i, nombre: r.casilla + '.pdf', vigente: true }] }); });
}
const msAbierta = (p) => p.waitForSelector('#msFondo:not([hidden]) .ms');

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo); cargarTad(mundo, FILAS);
    // ----- El líder: lista y solicitud por pasos -----
    const p = await entrar(ctx, 'lucia', '739105'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'migraciones.html'); await p.waitForSelector('.mg-kpis .mg-k');
    ok(nombre + ': el líder ve sus 4 tarjetas y sus 5 pastillas, sin "Por líder | Por fecha"', (await p.locator('.mg-kpis .mg-k').count()) === 4 && /Te falta registrar/.test(await p.textContent('.mg-kpis')) &&
      (await p.locator('.mg-bar .mg-ch').count()) === 5 && (await p.locator('.mg-seg').count()) === 0);
    await p.click('[data-cam="nuevo"]'); await msAbierta(p);
    ok(nombre + ': la solicitud tiene la barra de 4 pasos con Servicio marcado', (await p.locator('.ms-st span').count()) === 4 && (await p.getAttribute('.ms-st span.on', 'aria-current')) === 'step' && /Servicio/.test(await p.textContent('.ms-st span.on')));
    await p.fill('#msBusca', 'p'); await p.click('[data-ms="buscar"]');
    ok(nombre + ': búsqueda muy corta da error debajo', /3 letras/.test(await p.textContent('#msC')));
    await p.fill('#msBusca', '777001'); await p.click('[data-ms="buscar"]'); await p.waitForSelector('[data-mssrv]');
    ok(nombre + ': busca por código y muestra código, sucursal, plan, categoría y estado', (await p.locator('[data-mssrv]').count()) === 1 && /824-777001/.test(await p.textContent('#msC')) && /Maracaibo/.test(await p.textContent('#msC')) && /BRONCE-RES · 1 GB · ACTIVO/.test(await p.textContent('#msC')));
    await p.fill('#msBusca', 'panadería'); await p.click('[data-ms="buscar"]'); await p.waitForFunction(() => document.querySelectorAll('[data-mssrv]').length === 2);
    ok(nombre + ': busca por nombre y trae todos los servicios del titular', true);
    await p.click('[data-ms="sig1"]');
    ok(nombre + ': sin servicio ni tipo da los dos errores debajo', /Marca al menos un servicio/.test(await p.textContent('#msC')) && /Elige qué cambia/.test(await p.textContent('#msC')));
    ok(nombre + ': las 4 opciones dicen si comisionan', (await p.locator('[data-mstipo]').count()) === 4 && /No comisiona/.test(await p.textContent('[data-mstipo="titularidad"]')) && /Comisiona/.test(await p.textContent('[data-mstipo="migracion"]')));
    await p.check('[data-mssrv="824-777001-48575443AAAA0001"]'); await p.click('[data-mstipo="migracion"]');
    ok(nombre + ': al marcar el servicio muestra el titular actual', /Titular actual/.test(await p.textContent('#msC')) && /Panaderia Inventada Uno/.test(await p.textContent('#msC')));
    await p.click('[data-ms="sig1"]'); await p.waitForSelector('#msRifZona');
    ok(nombre + ': paso 2 (Titular): queda a nombre del titular actual y el RIF se sube, no se escribe', /Queda a nombre de/.test(await p.textContent('#msC')) && (await p.locator('#msC input[type="text"], #msC input:not([type])').count()) === 0 && /Si su RIF ya está en el expediente/.test(await p.textContent('#msC')));
    ok(nombre + ': paso 2 sin desborde', await sinDesborde(p));
    await p.click('[data-ms="sig2"]'); await p.waitForSelector('.ms-doc');
    const c1 = llamo(mundo, 'cambio_crear').slice(-1)[0][2].p_datos;
    ok(nombre + ': al seguir se guarda como borrador y el paso 3 lista las casillas del expediente', c1.borrador === true && c1.tipo === 'migracion' && /RIF de la empresa/.test(await p.textContent('#msC')) && /Acta constitutiva/.test(await p.textContent('#msC')));
    ok(nombre + ': zona para soltar varios juntos y cada casilla con Subir', (await p.locator('#msSoltar').count()) === 1 && (await p.locator('[data-mssubir]').count()) >= 2);
    ok(nombre + ': Siguiente queda apagado mientras falten documentos y dice cuántos', await p.isDisabled('[data-ms="enviar"]') && /Faltan \d+ de \d+/.test(await p.textContent('#msC')));
    await p.screenshot({ path: 'capturas/29-' + nombre + '-p3.png', fullPage: true });
    await p.click('[data-ms="guardar"]'); await p.waitForFunction(() => document.getElementById('msFondo').hidden);
    await p.waitForFunction(() => /Sin enviar/.test(document.getElementById('lista').textContent));
    ok(nombre + ': "Guardar lo que llevo" la deja en la lista como Sin enviar, con Seguir', (await p.locator('[data-mg="seguir"]').count()) === 1);
    // Con los documentos subidos se envía
    const id1 = mundo.datos.cambiosK.filas.slice(-1)[0].id; documentosListos(mundo, id1);
    await p.click('[data-mg="seguir"]'); await msAbierta(p); await p.waitForSelector('.ms-doc');
    ok(nombre + ': Seguir vuelve al paso 3 con todo listo', !(await p.isDisabled('[data-ms="enviar"]')) && /Todo listo/.test(await p.textContent('#msC')));
    await p.click('[data-ms="enviar"]'); await p.waitForSelector('.ms-ok');
    ok(nombre + ': Enviar muestra "En verificación" con los 4 momentos y la planilla', /En verificación/.test(await p.textContent('#msC')) && (await p.locator('.ms-tl > div').count()) === 4 && (await p.locator('[data-ms="planillaWa"]').count()) === 1 && llamo(mundo, 'cambio_enviar').length === 1);
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-ms="planilla"]')]);
    const pdf = require('fs').readFileSync(await dl.path()).toString('latin1');
    ok(nombre + ': la planilla es un PDF con la hoja oficial de fondo y los datos encima', /\.pdf$/.test(dl.suggestedFilename()) && pdf.startsWith('%PDF') && /DCTDecode/.test(pdf) && /Helvetica/.test(pdf));
    await p.screenshot({ path: 'capturas/29-' + nombre + '-p4.png', fullPage: true });
    await p.click('[data-ms="listo"]'); await p.waitForFunction(() => document.getElementById('msFondo').hidden);

    // ----- Cambio de titular: el RIF del nuevo titular se lee solo -----
    await p.click('[data-cam="nuevo"]'); await msAbierta(p);
    await p.fill('#msBusca', '9777003'); await p.click('[data-ms="buscar"]'); await p.waitForSelector('[data-mssrv="824-777003-48575443AAAA0003"]');
    await p.check('[data-mssrv="824-777003-48575443AAAA0003"]'); await p.click('[data-mstipo="titularidad"]'); await p.click('[data-ms="sig1"]'); await p.waitForSelector('#msRifZona');
    ok(nombre + ': titularidad pregunta Persona natural | Empresa y no deja seguir sin el RIF', (await p.locator('[data-msnat]').count()) === 2 && await p.isDisabled('[data-ms="sig2"]'));
    await p.setInputFiles('#msRifArchivo', { name: 'rif-nuevo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 prueba') });
    await p.waitForFunction(() => /No se pudo leer/.test(document.getElementById('msC').textContent));
    ok(nombre + ': sin lectura avisa que suba otra foto y sigue sin dejar pasar', await p.isDisabled('[data-ms="sig2"]'));
    mundo.ocr = { estado: 'ok', tipo: 'rif_viejo', dudosa: false, datos: { rif: 'J417779999', razon_social: 'NUEVA EMPRESA INVENTADA, C.A', domicilio: 'CALLE 1 LOCAL 2 ZONA POSTAL 4001', vencimiento: '01/01/2028', motivos: [] } };
    await p.setInputFiles('#msRifArchivo', { name: 'rif-nuevo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 prueba') });
    await p.waitForFunction(() => /Leído del RIF/.test(document.getElementById('msC').textContent));
    const t2 = await p.textContent('#msC');
    ok(nombre + ': muestra razón social, RIF, domicilio y vencimiento, y si ya es cliente', /NUEVA EMPRESA INVENTADA/.test(t2) && /J-417779999/.test(t2) && /ZONA POSTAL 4001/.test(t2) && /01\/01\/2028/.test(t2) && /(No es cliente|Ya es cliente|otro líder)/.test(t2));
    ok(nombre + ': la cabecera dice a nombre de quién queda', /queda a nombre de NUEVA EMPRESA INVENTADA/.test(await p.textContent('#msCab')));
    await p.click('[data-ms="sig2"]'); await p.waitForSelector('.ms-doc');
    const c2 = llamo(mundo, 'cambio_crear').slice(-1)[0][2].p_datos;
    ok(nombre + ': el borrador lleva el nuevo titular leído del RIF', c2.tipo === 'titularidad' && c2.nuevo.tipo === 'J' && c2.nuevo.doc === '417779999' && c2.nuevo.nombre === 'NUEVA EMPRESA INVENTADA, C.A' && c2.nuevo.ocr.tipo === 'rif_viejo');
    ok(nombre + ': los documentos son los del nuevo titular, con los nombres de la maqueta (empresa)', /RIF de la empresa[\s\S]*Acta constitutiva[\s\S]*Cédula del representante legal[\s\S]*RIF del representante legal/.test(await p.textContent('#msC')));
    await p.waitForFunction(() => !document.querySelector('.ms-doc small') || !/Subiendo/.test(document.getElementById('msC').textContent), null, { timeout: 8000 }).catch(() => {});
    ok(nombre + ': el RIF leído se sube solo a su casilla', mundo.llamadas.some((l) => l[0] === 'subir'));
    mundo.ocr = null;
    await p.keyboard.press('Escape'); await p.waitForFunction(() => document.getElementById('msFondo').hidden);

    // ----- Cambio a residencial: motivo obligatorio, va directo al analista -----
    await p.click('[data-cam="nuevo"]'); await msAbierta(p);
    await p.fill('#msBusca', '777004'); await p.click('[data-ms="buscar"]'); await p.waitForSelector('[data-mssrv]');
    await p.check('[data-mssrv="824-777004-48575443AAAA0004"]'); await p.click('[data-mstipo="residencial"]'); await p.waitForSelector('#msMotivo');
    ok(nombre + ': cambio a residencial no pide documentos y registra en el paso 1', /no lleva documentos/.test(await p.textContent('#msC')) && /Registrar/.test(await p.textContent('[data-ms="sig1"]')));
    await p.click('[data-ms="sig1"]');
    ok(nombre + ': sin motivo da error debajo', /motivo/.test(await p.textContent('#msC')));
    await p.fill('#msMotivo', 'El cliente cerró el local'); await p.click('[data-ms="sig1"]'); await p.waitForFunction(() => document.getElementById('msFondo').hidden);
    ok(nombre + ': queda Por emitir y no es borrador', mundo.datos.cambiosK.filas.some((c) => c.tipo === 'residencial' && c.estado === 'por_emitir' && !c.borrador));
    ok(nombre + ': lista del líder sin desborde', await sinDesborde(p));

    // ----- La analista (Senior) marca Hecho; el TAD confirma o avisa lo que falta -----
    const a = await contexto(nav, dispositivo, mundo); const q = await entrar(a.ctx, 'elena', '315806'); q.on('pageerror', (e) => errores.push(e.message));
    const mig = mundo.datos.cambiosK.filas.find((c) => c.tipo === 'migracion' && c.estado === 'por_revisar'); mig.estado = 'por_emitir';   // el administrador ya aprobó los documentos
    await q.goto(H + 'migraciones.html'); await q.waitForSelector('#lista .mg-r');
    ok(nombre + ': la Senior ve "Por líder | Por fecha" y sus pendientes en Esperan tu decisión', (await q.locator('.mg-seg [data-mgv]').count()) === 2 && /por hacer en el sistema/.test(await q.textContent('.mg-kpis')));
    await q.locator('.mg-r', { hasText: 'Panaderia' }).locator('[data-mg="abrir"]').click(); await q.waitForSelector('[data-cam-acc="hecho"]');
    await q.click('[data-cam-acc="hecho"]'); await q.waitForFunction(() => /Por confirmar/.test(document.querySelector('#cCam .estado').textContent));
    ok(nombre + ': Hecho deja el cambio Por confirmar con su bitácora', /Marcó Hecho/.test(await q.textContent('#cCam')));
    await cerrarHojas(q);
    await q.locator('.mg-r', { hasText: 'Taller' }).first().click(); await q.waitForSelector('[data-cam-acc="hecho"]'); await q.click('[data-cam-acc="hecho"]');
    await q.waitForFunction(() => /Por confirmar/.test(document.querySelector('#cCam .estado').textContent)); await cerrarHojas(q);
    const r = cargarTad(mundo, [Object.assign({}, FILAS[0], { ca: 'PYME-1GB' }), FILAS[1], FILAS[2], Object.assign({}, FILAS[3], { ca: '1 GB', p: 'BRONCE-RES' })]);
    ok(nombre + ': el TAD confirma el cambio a residencial y deja la migración con aviso', r.confirmados === 1 && r.avisos === 1);
    await q.reload(); await q.waitForSelector('#lista .mg-r'); await q.click('.mg-bar [data-mgf="curso"]');
    ok(nombre + ': En curso muestra "Falta cambiar el plan"', /Falta cambiar el plan/.test(await q.textContent('#lista')));
    cargarTad(mundo, [Object.assign({}, FILAS[0], { ca: 'PYME-1GB', p: 'ORO-EMP', e: '48575443AAAA0001' }), FILAS[1], FILAS[2]]);
    ok(nombre + ': con plan y categoría la migración se confirma y queda "Comisión por decidir"', mig.estado === 'confirmado' && mig.comision === 'por_decidir' && !mig.instalacion_id);
    // Lote 16/11 B: la Senior decide con motivo; solo el Sí crea la instalación
    await q.reload(); await q.waitForSelector('#lista .mg-r'); await q.click('.mg-bar [data-mgf="decision"]');
    await q.locator('.mg-r', { hasText: 'Panaderia' }).locator('[data-mg="abrir"]').click(); await q.waitForSelector('[data-cam-acc="decidir_si"]');
    await q.click('[data-cam-acc="decidir_si"]');
    ok(nombre + ': decidir sin motivo da error debajo', /Escribe el motivo/.test(await q.textContent('#eCamAcc')));
    await q.fill('#camNotaAcc', 'Cliente nuevo para la empresa'); await q.click('[data-cam-acc="decidir_si"]');
    await q.waitForFunction(() => /comisiona/i.test(document.querySelector('#cCam .estado').textContent) && !/decide/.test(document.querySelector('#cCam .estado').textContent));
    ok(nombre + ': con el Sí comisiona y queda en la bitácora', mig.comision === 'si' && !!mig.instalacion_id && (mundo.bitacora || []).some((b) => b.accion === 'cambio_comision'));
    await cerrarHojas(q);

    // ----- Sin registrar sin líder: la Senior le asigna líder (queda sin registrar para que el líder la registre) -----
    mundo.datos.cambiosK.filas.push({ id: 900, tipo: 'migracion', estado: 'sin_registro', origen: 'tad', creado_en: new Date().toISOString(), titular: { nombre: 'Ferreteria Inventada', doc: '417770501' },
      categoria_anterior: '1 GB', categoria_nueva: 'PYME-1GB', plan_anterior: 'BRONCE-RES', plan_nuevo: 'ORO-EMP', servicios: [{ sucursal: '824', codigo: '777050' }], bitacora: [{ accion: 'cambio_sin_registro', en: new Date().toISOString() }] });
    await q.reload(); await q.waitForSelector('.mg-kpis'); await q.click('.mg-bar [data-mgf="sin"]'); await q.waitForSelector('#lista .mg-r');
    ok(nombre + ': la sin líder cae en el grupo Por asignar con "Asignar líder"', /Por asignar/.test(await q.textContent('#lista')) && (await q.locator('.mg-r', { hasText: 'Ferreteria' }).locator('[data-mg="asignar"]').count()) === 1);
    await q.locator('.mg-r', { hasText: 'Ferreteria' }).locator('[data-mg="asignar"]').click(); await q.waitForSelector('[data-cam-acc="asignar"]');
    ok(nombre + ': ofrece Asignar, Fue un error y Revertido', (await q.locator('[data-cam-acc="error"]').count()) === 1 && (await q.locator('[data-cam-acc="revertido"]').count()) === 1);
    await q.click('[data-cam-acc="asignar"]');
    ok(nombre + ': asignar sin líder da error debajo', (await q.textContent('#eCamLider')).includes('Elige el líder'));
    await q.selectOption('#camLider', { label: 'Lucía Ferrer' }); await q.click('[data-cam-acc="asignar"]');
    await q.waitForFunction(() => /registra/.test(document.querySelector('#cCam .estado').textContent));
    const f900 = mundo.datos.cambiosK.filas.find((c) => c.id === 900);
    ok(nombre + ': asignada queda Sin registrar a nombre del líder', f900.estado === 'sin_registro' && !!f900.lider_id && llamo(mundo, 'cambio_accion').some((l) => l[2].p_accion === 'asignar' && l[2].p_lider));
    await cerrarHojas(q);
    ok(nombre + ': ahora sale en el grupo del líder con Recordar', (await q.locator('.mg-r', { hasText: 'Ferreteria' }).locator('[data-mg="recordar"]').count()) === 1);
    await q.screenshot({ path: 'capturas/29-' + nombre + '-analista.png', fullPage: true });
    await a.ctx.close();
    // El líder la ve en "Te falta registrar" con Registrar, que abre la solicitud con el servicio puesto
    await p.reload(); await p.waitForSelector('#lista .mg-r');
    ok(nombre + ': el líder ve el aviso y la fila con Registrar', /ya se hizo sin registro|ya se hicieron sin registro/.test(await p.textContent('.mg-av')) && (await p.locator('.mg-r', { hasText: 'Ferreteria' }).locator('[data-mg="registrar"]').count()) === 1);
    await p.locator('.mg-r', { hasText: 'Ferreteria' }).locator('[data-mg="registrar"]').click(); await msAbierta(p);
    ok(nombre + ': "Registrar" abre la solicitud de esa migración (sin servicio en el TAD pide buscarlo)', /Registrar migración/.test(await p.textContent('#msCab')) && (await p.inputValue('#msBusca')) === '777050');
    await p.keyboard.press('Escape'); await ctx.close();

    // ----- Actualizar: reporte de cambios de categoría con su resumen y reporte de IP -----
    const b = await contexto(nav, dispositivo, mundo); const z = await entrar(b.ctx, 'marcos', '482913'); z.on('pageerror', (e) => errores.push(e.message));
    await z.goto(H + 'actualizar.html'); await z.waitForSelector('#dia .sd-f');
    ok(nombre + ': Subir lo del día dice qué toca y la última subida de cada archivo, también IP', /TAD/.test(await z.textContent('#dia')) && /IP \(Clientes Empresariales\)/.test(await z.textContent('#dia')));
    await z.setInputFiles('#archivos', [{ name: 'cambios_categoria.csv', mimeType: 'text/csv', buffer: Buffer.from('Código;Nombre;Fecha;Categoría anterior;Categoría actual;Operador;Comentario\n777002;PANADERIA;14-10-2026;1 GB;PYME-1GB;Juan;\n777010;Y;14-10-2026;056;PYME-1GB;RADIUS;CHANGE PROFILE FROM RADIUS\n') },
      { name: 'clientes_empresariales.csv', mimeType: 'text/csv', buffer: Buffer.from('Clientes Empresariales;;;;;;;;\nSucursal;Cliente;Nombre;ONT;VLAN;Fecha Asignación;Estado;IPV4;IPV6\n824 - MARACAIBO;777001;PANADERIA;48575443AAAA0001;100;01/10/2026;ASIGNADA;190.1.1.1;2803::1\n824 - MARACAIBO;;;;100;;DISPONIBLE;190.1.1.9;\n') }]);
    await esperarDia(z);
    const dia = await z.textContent('#dia');
    ok(nombre + ': reconoce el reporte de cambios y el de IP y los sube solos, con el resumen del reporte', /cambios_categoria\.csv/.test(dia) && /clientes_empresariales\.csv/.test(await z.textContent('#dia [data-k="ip"]')) && /IP por confirmar/.test(dia) && /a PYME/.test(dia) && /sin registrar/.test(dia) && /descartada/.test(dia));
    const ip = llamo(mundo, 'ip_reporte_cargar').slice(-1)[0];
    ok(nombre + ': el reporte de IP sube sucursal, código, ONT e IP, y la DISPONIBLE con su IP', ip && ip[2].p_filas.length === 2 && ip[2].p_filas[0].e === '48575443AAAA0001' && ip[2].p_filas[0].ip === '190.1.1.1' && ip[2].p_filas[1].est === 'DISPONIBLE');
    ok(nombre + ': Actualizar sin desborde', await sinDesborde(z));
    await b.ctx.close();
  }
  ok('sin errores de la página', errores.length === 0, errores);
  await nav.close(); cerrar();
})();
