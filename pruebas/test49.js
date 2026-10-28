// Lote 27/10, partes A2, A5 y C: índice del TAD que sube solo lo que cambió y retoma; en Comisiones los atajos Sin instalar
// (con "Subir documentos": RIF, cliente nuevo unido a la orden, casillas y Enviar a revisión) y Sin líder (asignar a varios);
// en Clientes el atajo Revisar fecha de los dedicados.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
const llamo = (m, f) => m.llamadas.filter((l) => l[1] === f);
function csv(n, cambio){
  let t = 'Sucursal,Cliente,Tipo,Documento,Fecha_Instalacion,Nombre,Equipo,Plan,Estado,CATEGORIA,CXCPENDIENTE,INSTALADOR,Telefono,Direccion\n';
  for(let i = 1; i <= n; i++) t += '824,' + String(700000 + i).padStart(8, '0') + ',J,0' + (597000000 + i) + ',15-03-2025,"Comercio de Prueba ' + i + '",SERIE' + i + ',ORO-EMP,' + (cambio && i === 3 ? 'Suspendidos' : 'Habilitado') + ',PYME-1GB,NO,INVENTADO,,Calle ' + i + '\n';
  return t;
}
const cerrarHojas = async (p) => { for(let i = 0; i < 5 && await p.evaluate(() => !!window.Comun.hojaAbierta()); i++){ await p.keyboard.press('Escape'); await p.waitForTimeout(280); } };

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['pc', PC], ['tel', TEL]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    // ----- A2: el índice falla, las empresas quedan y se sigue después -----
    await p.goto(H + 'actualizar.html'); await p.waitForSelector('#zona');
    await p.setInputFiles('#archivos', { name: 'tad.csv', mimeType: 'text/csv', buffer: Buffer.from(csv(30)) });
    await p.waitForSelector('#cargarTodo'); mundo.fallaRpc = 'tad_indice_parte';
    await p.click('#cargarTodo'); await p.waitForSelector('[data-seguir]', { timeout: 15000 }).catch(async () => console.log('DBG', await p.textContent('#zona'), JSON.stringify(mundo.llamadas.slice(-6).map((x) => x[1]))));
    ok(nombre + ': si el índice falla, el TAD de empresas queda cargado y lo dice', /Empresas cargadas/.test(await p.textContent('#listaArch')) && /Índice a medias/.test(await p.textContent('#listaArch')) && llamo(mundo, 'tad_cerrar').length === 1);
    mundo.fallaRpc = null; const antes = llamo(mundo, 'tad_indice_iniciar').length;
    await p.click('[data-seguir]'); await p.waitForFunction(() => /índice de \d+ servicios/.test(document.getElementById('listaArch').textContent), null, { timeout: 12000 }).catch(async () => console.log('DBG', await p.textContent('#zona'), JSON.stringify(mundo.llamadas.slice(-5).map((x) => x[1]))));
    ok(nombre + ': Seguir con el índice retoma en la misma carga', llamo(mundo, 'tad_indice_iniciar').length === antes + 1 && mundo.datos.cambiosK.cargas.length === 1 && llamo(mundo, 'tad_indice_comparar').length >= 2);
    // Otra carga con una sola fila distinta: solo esa sube
    await p.click('#otro').catch(() => {});
    await p.setInputFiles('#archivos', { name: 'tad2.csv', mimeType: 'text/csv', buffer: Buffer.from(csv(30, true)) });
    await p.waitForSelector('#cargarTodo'); const partes = llamo(mundo, 'tad_indice_parte').length;
    await p.click('#cargarTodo'); await p.waitForFunction(() => /índice de \d+ servicios \(1 cambió\)/.test(document.getElementById('listaArch').textContent));
    const ult = llamo(mundo, 'tad_indice_parte').slice(partes);
    ok(nombre + ': la segunda carga sube solo la fila que cambió', ult.length === 1 && ult[0][2].p_filas.length === 1);
    // ----- A5: Sin instalar con Subir documentos y RIF nuevo -----
    mundo.datos.sueltas = [{ id: 880001, numero: 'PRUEBA/9001', titulo: 'Solicitud de Instalación PROMO PYME', etapa: 'Planificada', creada_en: new Date(Date.now() - 40 * 864e5).toISOString(), nombre: 'Panadería Inventada', lider: 'Lucía Ferrer', parecido_id: null }];
    // Lote 28/10: Por instalar es una hoja; Subir documentos abre "cliente nuevo" con la orden ya elegida
    await p.goto(H + 'comisiones.html?t=por_instalar'); await p.waitForSelector('#hojaPorInst.ver [data-pi-tab]');
    await p.click('#hojaPorInst [data-pi-tab="viejas"]'); await p.waitForSelector('#hojaPorInst .pi-t');
    const zl = await p.textContent('#hojaPorInst');
    ok(nombre + ': la orden vieja sale en Viejas, sin cliente en la app', /Sin cliente en la app/.test(zl) && /Panadería Inventada/.test(zl));
    await p.locator('#hojaPorInst .pi-t', { hasText: 'Panadería Inventada' }).locator('[data-pi-subir]').click(); await p.waitForSelector('#hojaNuevo.ver #nvRif');
    ok(nombre + ': el panel abre con la orden, el RIF con su etiqueta arriba y el posible nombre', /9001/.test(await p.textContent('#hojaNuevo .nv-orden')) && (await p.textContent('label[for="nvRif"]')) === 'RIF' && (await p.inputValue('#nvNom')) === 'Panadería Inventada');
    await p.fill('#nvRif', '12'); await p.click('[data-nv-seguir]');
    ok(nombre + ': RIF corto: error debajo del campo', /letra y los números/.test(await p.textContent('#eNvRif')));
    await p.fill('#nvRif', 'J-41888777-1'); await p.click('[data-nv-seguir]'); await p.waitForSelector('#docsNuevo [data-casilla]');
    const nuevo = mundo.datos.clientes.find((c) => c.doc_numero === '418887771');
    ok(nombre + ': se crea el cliente, la orden queda unida y salen sus casillas', !!nuevo && nuevo.orden && nuevo.orden.id === 880001 && (mundo.bitacora || []).some((b) => b.accion === 'cliente_creado_orden'));
    ok(nombre + ': Enviar a revisión espera a que esté todo', await p.locator('[data-nv-enviar]').isDisabled());
    await cerrarHojas(p);
    await p.goto(H + 'comisiones.html?t=por_instalar'); await p.waitForSelector('#hojaPorInst.ver [data-pi-horas]');
    await p.click('#hojaPorInst [data-pi-horas]'); await p.waitForSelector('#piHoras'); await p.fill('#piHoras', '30'); await p.click('#piHorasGuardar');
    await p.waitForFunction(() => /30 horas/.test(document.getElementById('hojaPorInst').textContent));
    ok(nombre + ': el administrador cambia las horas del aviso', mundo.horasAlerta === 30);
    await cerrarHojas(p);
    // ----- C1: Sin líder y asignar a varios -----
    const sin = mundo.datos.clientes.filter((c) => !c.lider_id && !c.unido_a).slice(0, 2);
    sin.forEach((c) => { c.servicios = c.servicios.length ? c.servicios : [{ id: 1, codigo: '9' + c.id, sucursal: '824', estado: 'Habilitado', categoria: 'pyme-1gb' }]; c.servicios[0].fecha_instalacion = new Date().toISOString().slice(0, 10); });
    await p.goto(H + 'comisiones.html?t=por_asignar'); await p.waitForSelector('[data-abrir="sin_lider"]'); await p.locator('#ayudaFiltro [data-abrir="sin_lider"], [data-abrir="sin_lider"]').first().click(); await p.waitForSelector('[data-sl-marca]');
    ok(nombre + ': Sin líder lista los instalados del mes sin líder', (await p.locator('[data-sl-marca]').count()) >= 2 && (await p.locator('[data-sl-asignar][disabled]').count()) === 1);
    await p.click('[data-sl-todos]'); await p.click('[data-sl-asignar]'); await p.waitForSelector('#hojaLiderLote.ver #slLider');
    await p.click('#slConfirmar');
    ok(nombre + ': sin elegir líder: error debajo', /Elige el líder/.test(await p.textContent('#eSl')));
    await p.selectOption('#slLider', '22222222-2222-4222-8222-222222222222'); await p.click('#slConfirmar');
    await p.waitForFunction(() => !document.querySelector('#hojaLiderLote.ver'));
    ok(nombre + ': asigna el líder a todos, con bitácora por cada uno', sin.every((c) => c.lider_id === '22222222-2222-4222-8222-222222222222') && (mundo.bitacora || []).filter((b) => b.accion === 'cliente_lider').length >= 2);
    ok(nombre + ': Comisiones sin desborde', await sinDesborde(p));
    // ----- C2: Revisar fecha en dedicados -----
    await p.goto(H + 'clientes.html?s=corporativo&f=revisar_fecha'); await p.waitForSelector('#filtros [data-filtro="revisar_fecha"]');
    ok(nombre + ': atajo Revisar fecha pide los contratos sin vencimiento', llamo(mundo, 'clientes_lista3').some((l) => (l[2].p_f.ctr || []).indexOf('sin_vence') >= 0 && l[2].p_filtro === 'todos'));
    await ctx.close();
    // ----- El líder: Sin instalar solo lo suyo, sin Sin líder -----
    const c2 = await contexto(nav, dispositivo); const l = await entrar(c2.ctx, 'lucia', '739105'); l.on('pageerror', (e) => errores.push(e.message));
    await l.goto(H + 'comisiones.html?t=por_instalar'); await l.waitForSelector('#hojaPorInst.ver [data-pi-tab]');
    ok(nombre + ': el líder ve Por instalar pero no cambia las horas ni ve Sin líder', (await l.locator('[data-pi-horas]').count()) === 0 && (await l.locator('[data-abrir="sin_lider"]').count()) === 0);
    await c2.ctx.close();
  }
  ok('sin errores de la página', errores.length === 0, errores);
  await nav.close(); cerrar();
})();
