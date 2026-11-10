// Lote 05/11, parte C: panel "Revisión del expediente" (la IA solo propone), Devolver y Pedir separados, requerimientos en rojo con
// el nombre completo y Quitar pedido, representantes Ya no aplica / Volver a contar, documentos extra con Cambiar título,
// acta que cambia la junta y "Qué pedirle al cliente" para el líder. Datos inventados (mundo.js).
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
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
    // Lote 10/11 C1: fuera de una revisión el panel es una línea "Revisión: N de 6 marcados · Abrir"
    await p.goto(H + 'cliente.html?id=1001&t=documentos'); await p.waitForSelector('.rp-linea [data-rp-abrir]');
    ok(nombre + ': fuera de la revisión el panel es una sola línea con lo marcado y Abrir', /Revisión: 0 de 6 marcados/.test(await p.textContent('.rp-linea')) && !(await p.locator('.rp [data-pt]').count()));
    await p.click('[data-rp-abrir]'); await p.waitForSelector('.rp [data-pt]');
    const panel = await p.textContent('.rp');
    ok(nombre + ': panel con los 6 puntos en el orden de la oficina', ['Razón social', 'Domicilio fiscal', 'Vigencia de la empresa', 'Junta directiva', 'Firmantes', 'Contacto'].every((t) => panel.includes(t)) && (await p.locator('.rp [data-rp]').count()) === 6);
    ok(nombre + ': sin marcar nada no dice Bien (la IA nunca lo deja marcado)', !(await p.locator('.rp .rp-op.on').count()));
    await p.click('[data-pt="razon_social:bien"]'); await p.waitForSelector('[data-rp="razon_social"] .rp-chip');
    ok(nombre + ': Bien queda marcado', /Bien/.test(await p.textContent('[data-rp="razon_social"] .chip')));
    await p.click('[data-pt="junta:pedir"]'); await p.waitForSelector('#hojaCampo.ver [data-req-tipo="junta"][aria-checked="true"]');
    ok(nombre + ': Pedir abre la lista cerrada con el acta de la junta elegida', (await p.locator('#hojaCampo [data-req-tipo]').count()) === 6 && /ratificación o cambio de junta directiva/.test(await p.textContent('#hojaCampo')));
    await p.fill('#reqNota', 'La constitutiva no dice cuánto dura la junta'); await p.click('#reqGuardar');
    await p.waitForSelector('[data-rp="junta"] .rp-chip');
    ok(nombre + ': lo marcado queda como chip y al tocarlo se puede cambiar', (await p.click('[data-rp-cambiar="razon_social"]'), await p.locator('[data-rp="razon_social"] [data-pt]').count()) === 3);
    await p.click('[data-pt-cerrar]');
    await p.waitForSelector('.casilla.pedida', { timeout: 15000 });
    const ped = await p.textContent('.casilla.pedida');
    ok(nombre + ': al cerrar, la casilla queda en rojo con el nombre completo, el motivo y quién lo pidió', /Falta: Acta de asamblea de ratificación o cambio de junta directiva/.test(ped) && /cuánto dura/.test(ped) && /Marcos/.test(ped));
    ok(nombre + ': queda en bitácora', (mundo.bitacora || []).some((b) => b.accion === 'requerimiento_creado') && (mundo.bitacora || []).some((b) => b.accion === 'revision_puntos'));
    ok(nombre + ': Qué pedirle al cliente trae el mensaje listo', /necesitamos el siguiente documento: Acta de asamblea de ratificación o cambio de junta directiva/.test(await p.textContent('.qp')));
    // Quitar pedido con dos toques
    await p.click('[data-req-quitar]'); await p.click('[data-req-quitar]'); await p.waitForFunction(() => !document.querySelector('.casilla.pedida'));
    ok(nombre + ': Quitar pedido lo anula', c.requerimientos.every((z) => z.estado === 'anulado'));
    // Devolver o Pedir: la constitutiva solo con 3 motivos
    const dc = c.documentos.find((d) => d.casilla === 'acta_constitutiva');
    await p.click('[data-ver="' + dc.id + '"]'); await p.waitForSelector('#hojaVer.ver #verDevolver'); await p.click('#verDevolver'); await p.waitForSelector('#verPedir');
    const mots = await p.$$eval('#hojaVer [data-motivo]', (xs) => xs.map((x) => x.dataset.motivo));
    ok(nombre + ': la constitutiva solo se devuelve por no ser de la empresa, ilegible o sin datos del Registro', mots.length === 3 && ['ilegible', 'no_corresponde', 'sin_registro'].every((k) => mots.includes(k)));
    await p.click('#verPedir'); await p.waitForSelector('#hojaCampo.ver #reqGuardar');
    ok(nombre + ': Pedir otro documento guarda el origen', /Origen: Acta constitutiva/.test(await p.textContent('#hojaCampo')));
    await p.click('#reqGuardar'); await p.waitForSelector('.casilla.pedida');
    ok(nombre + ': pedido desde el documento queda con su origen', c.requerimientos.some((z) => z.estado === 'abierto' && z.origen === dc.id));
    await p.waitForFunction(() => window.Comun.hojaAbierta() === 'hojaFicha');
    // Representantes: Ya no aplica y Volver a contar
    await p.click('[data-rep-marca="2:ya_no_aplica"]'); await p.waitForSelector('[data-grupo="rep2"].rep-fuera');
    ok(nombre + ': Ya no aplica queda en gris y no se le pide nada', /Ya no aplica/.test(await p.textContent('[data-grupo="rep2"]')) && /no se le pide nada/.test(await p.textContent('[data-grupo="rep2"]')));
    await p.click('[data-rep-marca="2:cuenta"]'); await p.waitForFunction(() => !document.querySelector('[data-grupo="rep2"].rep-fuera'));
    ok(nombre + ': Volver a contar lo devuelve', (c.representantes.find((r) => r.orden === 2) || {}).marca === 'cuenta');
    ok(nombre + ': sin desborde', await sinDesborde(p));
    await ctx.close();
    // El líder ve "Qué pedirle al cliente" con Subir esta acta
    const { ctx: c2, mundo: m2 } = await contexto(nav, dispositivo);
    const c1 = m2.datos.clientes.find((x) => x.id === 1001); c1.requerimientos = [{ id: 1, casilla: 'acta_asamblea', numero: 2, tipo: 'junta', texto: 'Acta de asamblea de ratificación o cambio de junta directiva', motivo: 'La constitutiva no dice cuánto dura la junta', estado: 'abierto', por: 'Marcos Rivas', en: new Date().toISOString() }];
    const l = await entrar(c2, 'lucia', '739105'); l.on('pageerror', (e) => errores.push(nombre + ' líder: ' + e.message));
    await l.goto(H + 'cliente.html?id=1001&t=documentos'); await l.waitForSelector('.qp');
    const qp = await l.textContent('.qp');
    ok(nombre + ': el líder ve el mensaje con WhatsApp y Copiar y el botón Subir esta acta', /Enviar por WhatsApp/.test(qp) && /Copiar mensaje/.test(qp) && (await l.locator('.qp [data-subir="acta_asamblea:2"]').count()) === 1);
    ok(nombre + ': el líder no ve el panel de revisión', !(await l.locator('.rp').count()));
    await c2.close();
  }
  ok('sin errores de JavaScript', !errores.length, errores.slice(0, 3));
  await nav.close(); cerrar();
})();
