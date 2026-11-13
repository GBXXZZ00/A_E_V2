// Lote 05/11, parte C (sin el panel de 6 puntos desde el lote 12/11 B): Devolver y Pedir separados, requerimientos en rojo con
// el nombre completo y Quitar pedido, representantes Ya no aplica / Volver a contar, documentos extra con Cambiar título,
// acta que cambia la junta y "Qué pedirle al cliente" para el líder. Datos inventados (mundo.js).
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar, rvAbierto, rvLista } = require('./simulador');
const { ok, cerrar } = marcador();
const llamo = (m, f) => m.llamadas.filter((l) => l[1] === f);
const cerrarHojas = async (p) => { for(let i = 0; i < 5 && await p.evaluate(() => !!window.Comun.hojaAbierta()); i++){ await p.keyboard.press('Escape'); await p.waitForTimeout(260); } };

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['pc', PC], ['tel', TEL]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(nombre + ': ' + e.message));
    const c = mundo.datos.clientes.find((x) => x.id === 1001);
    c.representantes = [{ orden: 1, nombre: 'Persona Uno Inventada', correo: 'personauno@ejemplo.test', telefono: '0414-0000001' }, { orden: 2, nombre: 'Persona Dos Inventada', correo: null, telefono: null }];
    // Lote 12/11 B: el panel de 6 puntos se quitó; Pedir otro documento vive en la pantalla de revisión
    await p.goto(H + 'cliente.html?id=1001&t=documentos'); await p.waitForSelector('#paso [data-paso="revisar"]');
    ok(nombre + ': ya no está el panel de 6 puntos', (await p.locator('.rp-linea, .rp [data-pt]').count()) === 0);
    await p.click('#paso [data-paso="revisar"]'); await p.waitForSelector('#hojaVer.ver #rvPedir');
    await p.click('#rvPedir'); await p.waitForSelector('#hojaCampo.ver [data-req-tipo]');
    await p.click('#hojaCampo [data-req-tipo="junta"]');
    ok(nombre + ': Pedir abre la lista cerrada con el acta de la junta', (await p.locator('#hojaCampo [data-req-tipo]').count()) === 6 && /ratificación o cambio de junta directiva/.test(await p.textContent('#hojaCampo')));
    await p.fill('#reqNota', 'La constitutiva no dice cuánto dura la junta'); await p.click('#reqGuardar');
    await p.waitForFunction(() => window.Comun.hojasAbiertas().slice(-1)[0] === 'hojaVer');
    ok(nombre + ': al pedir sigue en la revisión', (await p.locator('#hojaVer.ver .rv-c').count()) === 1);
    await p.keyboard.press('Escape'); await p.waitForFunction(() => window.Comun.hojasAbiertas().join() === 'hojaFicha');
    await p.waitForSelector('.casilla.pedida', { timeout: 15000 });
    const ped = await p.textContent('.casilla.pedida');
    ok(nombre + ': la casilla queda en rojo con el nombre completo, el motivo y quién lo pidió', /Falta: Acta de asamblea de ratificación o cambio de junta directiva/.test(ped) && /cuánto dura/.test(ped) && /Marcos/.test(ped));
    ok(nombre + ': queda en bitácora', (mundo.bitacora || []).some((b) => b.accion === 'requerimiento_creado'));
    ok(nombre + ': Qué pedirle al cliente trae el mensaje listo', /necesitamos el siguiente documento: Acta de asamblea de ratificación o cambio de junta directiva/.test(await p.textContent('.qp')));
    // Quitar pedido con dos toques
    await p.click('[data-req-quitar]'); await p.click('[data-req-quitar]'); await p.waitForFunction(() => !document.querySelector('.casilla.pedida'));
    ok(nombre + ': Quitar pedido lo anula', c.requerimientos.every((z) => z.estado === 'anulado'));
    // Devolver o Pedir: la constitutiva solo con 3 motivos
    const dc = c.documentos.find((d) => d.casilla === 'acta_constitutiva');
    // Lote 13/11 parte 3: los motivos de la constitutiva en el panel; "Falta un acta" pide el acta y aprueba la constitutiva
    await p.click('[data-ver="' + dc.id + '"]'); await rvAbierto(p); await p.click('#verDevolver'); await p.waitForSelector('#hojaVer .rv-panel [data-motivo]');
    const mots = await p.$$eval('#hojaVer [data-motivo]', (xs) => xs.map((x) => x.dataset.motivo));
    ok(nombre + ': la constitutiva trae sus 5 motivos', mots.join() === 'ilegible,no_corresponde,sin_registro,falta_acta,otro' && /¿Qué pasa con la constitutiva\?/.test(await p.textContent('#hojaVer .rv-panel')));
    await p.click('#hojaVer [data-motivo="falta_acta"]'); await p.waitForSelector('#hojaVer [data-rv-acta="junta"]');
    ok(nombre + ': Falta un acta muestra las actas y el botón dice Pedir el acta', (await p.locator('#hojaVer [data-rv-acta]').count()) === 6 && (await p.locator('#devPedirActa[disabled]').count()) === 1);
    await p.click('#hojaVer [data-rv-acta="junta"]'); await p.waitForSelector('#devPedirActa:not([disabled])');
    ok(nombre + ': el aviso dice qué se pide y que la constitutiva queda aprobada', /Se le pide a .+ el acta de ratificación o cambio de junta directiva\. La constitutiva queda aprobada y el expediente espera esa acta\./.test(await p.textContent('#hojaVer .rv-panel .rv-aviso')));
    await p.click('#devPedirActa'); await p.waitForFunction(() => !document.querySelector('#hojaVer .rv-panel'));
    ok(nombre + ': pedido desde el documento queda con su origen', c.requerimientos.some((z) => z.estado === 'abierto' && z.origen === dc.id && z.tipo === 'junta'));
    ok(nombre + ': la constitutiva queda marcada Bien', mundo.llamadas.some((l) => l[1] === 'documento_marcar' && l[2].p_documento === dc.id && l[2].p_accion === 'aprobar'));
    await p.keyboard.press('Escape'); await p.waitForFunction(() => window.Comun.hojaAbierta() === 'hojaFicha'); await p.waitForSelector('.casilla.pedida');
    // Representantes: Ya no aplica y Volver a contar
    // Lote 13/11: se marca desde la revisión, en el menú Más del representante
    await p.click('#paso [data-paso="revisar"]'); await p.waitForSelector('#hojaVer.ver .rv-c', { state: 'attached' }); await rvLista(p);
    const ced1 = c.documentos.find((d) => d.casilla === 'cedula' && d.numero === 1);
    await p.click('#hojaVer [data-rv-ir="d:' + ced1.id + '"]'); await p.click('#rvMas'); await p.click('#rvMasMenu [data-rep-marca="1:ya_no_aplica"]');
    await p.keyboard.press('Escape'); await p.waitForFunction(() => window.Comun.hojaAbierta() === 'hojaFicha'); await p.waitForSelector('[data-grupo="rep1"].rep-fuera');
    ok(nombre + ': Ya no aplica queda en gris y no se le pide nada', /Ya no aplica/.test(await p.textContent('[data-grupo="rep1"]')));
    await p.click('[data-grupo="rep1"] [data-rep-marca="1:cuenta"]'); await p.waitForFunction(() => !document.querySelector('[data-grupo="rep1"].rep-fuera'));
    ok(nombre + ': Volver a contar lo devuelve', (c.representantes.find((r) => r.orden === 1) || {}).marca === 'cuenta');
    ok(nombre + ': sin desborde', await sinDesborde(p));
    await ctx.close();
    // El líder ve "Qué pedirle al cliente" con Subir esta acta
    const { ctx: c2, mundo: m2 } = await contexto(nav, dispositivo);
    const c1 = m2.datos.clientes.find((x) => x.id === 1001); c1.requerimientos = [{ id: 1, casilla: 'acta_asamblea', numero: 2, tipo: 'junta', texto: 'Acta de asamblea de ratificación o cambio de junta directiva', motivo: 'La constitutiva no dice cuánto dura la junta', estado: 'abierto', por: 'Marcos Rivas', en: new Date().toISOString() }];
    const l = await entrar(c2, 'lucia', '739105'); l.on('pageerror', (e) => errores.push(nombre + ' líder: ' + e.message));
    await l.goto(H + 'cliente.html?id=1001&t=documentos'); await l.waitForSelector('.qp');
    const qp = await l.textContent('.qp');
    ok(nombre + ': el líder ve el mensaje con WhatsApp y Copiar y el botón Subir esta acta', /Enviar por WhatsApp/.test(qp) && /Copiar mensaje/.test(qp) && (await l.locator('.qp [data-subir="acta_asamblea:2"]').count()) === 1);
    ok(nombre + ': el líder no ve la revisión', !(await l.locator('.rp, #paso [data-paso="revisar"]').count()));
    await c2.close();
  }
  ok('sin errores de JavaScript', !errores.length, errores.slice(0, 3));
  await nav.close(); cerrar();
})();
