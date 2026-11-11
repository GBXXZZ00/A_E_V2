// Lote 05/11, parte F: Dedicados y VGT. "+ Registrar dedicado nuevo" solo en las tarjetas de dedicados y en la búsqueda por RIF sin resultados,
// el RIF que ya existe avisa y enlaza, el registro abre el expediente en Documentos con "Aún no está en el TAD"; VGT por solicitud:
// pólizas del cliente arriba, propuesta y planillas por solicitud ("+ Otra planilla"), negadas no piden nada, "+ Nueva solicitud". Datos inventados.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
const cliente = (mundo, nombre) => mundo.datos.clientes.find((c) => c.nombre === nombre || c.nombre === nombre + ', C.A.');
const llamo = (m, f) => m.llamadas.filter((l) => l[1] === f);
async function cerrarHojas(p){ for(let i = 0; i < 6 && await p.evaluate(() => !!window.Comun.hojaAbierta()); i++){ await p.keyboard.press('Escape'); await p.waitForTimeout(260); } }
const pdf = (n) => ({ name: n, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 prueba') });

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['pc', PC], ['tel', TEL]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    const a = cliente(mundo, 'Tornillos El Yunque');
    a.servicios = []; a.instalaciones = [];
    a.dedicado = { tipo: 'isp', ejecutiva: 'Lucía Ferrer', activo: true, verificar: false, cods: ['501'], enlaces: [], contactos: [],
      contratos: [{ id: 12, tipo: 'vgt', estatus: 'en_elaboracion', proyecto: 'Troncal Inventada', postes: 10, en_uso: 'SI', fecha: '22/09/2026' },
        { id: 13, tipo: 'vgt', estatus: 'sin_contrato', proyecto: 'Sector Inventado', postes: 8, en_uso: 'NEGADA', negada_en: '2026-10-01' }],
      vgt: { correo: null, polizas: [], requisitos: [[66, 'poliza_rc', 'Póliza de responsabilidad civil general', true, true], [67, 'poliza_patronal', 'Póliza de responsabilidad patronal', true, true],
        [68, 'propuesta', 'Propuesta comercial firmada y sellada', true, false]].map((r) => ({ numero: r[0], clave: r[1], texto: r[2], requerido: r[3], vence: r[4] })) } };
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(nombre + ': ' + e.message));

    // ----- F1: el botón solo con la tarjeta de dedicados -----
    await p.goto(H + 'clientes.html?s=pyme&f=todos'); await p.waitForSelector('#lista .cli');
    ok(nombre + ': con PYME no sale "Registrar dedicado nuevo"', await p.locator('#dedNuevo').isHidden());
    await p.goto(H + 'clientes.html?s=isp&f=todos'); await p.waitForSelector('#lista .cli');
    ok(nombre + ': con Dedicado ISP sale junto al buscador', await p.locator('#dedNuevo').isVisible());
    // Búsqueda por RIF sin resultados: el mismo botón
    await p.fill('#busca', 'J-41887766'); await p.waitForFunction(() => /No encontramos/.test(document.getElementById('lista').textContent), null, { timeout: 8000 });
    ok(nombre + ': "No encontramos" por RIF ofrece registrarlo', (await p.locator('#lista [data-ded-nuevo]').count()) === 1);
    await p.click('#lista [data-ded-nuevo]'); await p.waitForSelector('#hojaDedNuevo.ver #formDedNuevo');
    await p.waitForFunction(() => document.querySelectorAll('#dnLider option').length > 1, null, { timeout: 8000 }).catch(() => {});
    ok(nombre + ': la hoja trae el RIF buscado y la lista de líderes', (await p.inputValue('#dnRif')) === 'J-41887766' && (await p.locator('#dnLider option').count()) > 1);
    // RIF que ya existe: avisa y enlaza
    await p.fill('#dnRif', 'J-591000011'); await p.waitForFunction(() => /Ya existe/.test(document.getElementById('dnRifNota').textContent), null, { timeout: 8000 });
    ok(nombre + ': el RIF que ya existe avisa con "Abrir su expediente"', (await p.locator('#dnRifNota [data-dn-abrir]').count()) === 1);
    await p.fill('#dnRif', 'J-41887766-0'); await p.waitForFunction(() => /No existe en la app/.test(document.getElementById('dnRifNota').textContent), null, { timeout: 8000 });
    ok(nombre + ': el RIF nuevo dice que puede seguir', true);
    // Errores debajo de cada campo
    await p.click('#guardarDedNuevo');
    ok(nombre + ': sin razón social ni líder avisa debajo; el tipo viene de la tarjeta (ISP)', /razón social/.test(await p.textContent('#eDnNom')) && /líder/.test(await p.textContent('#eDnLider')) && (await p.getAttribute('[data-dn-tipo="isp"]', 'aria-pressed')) === 'true');
    await p.fill('#dnNom', 'Red Inventada Net, C.A.'); await p.click('[data-dn-tipo="isp"]');
    ok(nombre + ': ISP avisa que pide Conatel', /Conatel/.test(await p.textContent('#dnTipoNota')));
    await p.selectOption('#dnLider', { label: 'Lucía Ferrer' }); await p.fill('#dnSrv', 'Enlace de 100 Mbps');
    await p.screenshot({ path: 'capturas/lote05nov-F-' + nombre + '-registrar.png' });
    await p.click('#guardarDedNuevo');
    await p.waitForSelector('#hojaFicha.ver #tab-documentos.on', { timeout: 10000 }).catch(() => {});
    const nuevo = mundo.datos.clientes.find((c) => c.nombre === 'Red Inventada Net, C.A.');
    const lr = llamo(mundo, 'dedicado_registrar').pop();
    ok(nombre + ': se registra con RIF, tipo, líder y servicio', !!nuevo && !!lr && lr[2].p_tipo === 'isp' && lr[2].p_servicio === 'Enlace de 100 Mbps' && nuevo.lider === 'Lucía Ferrer' && nuevo.doc_numero === '418877660');
    ok(nombre + ': abre su expediente en Documentos', await p.locator('#hojaFicha.ver #tab-documentos.on').count() === 1);
    ok(nombre + ': la cabecera dice "Aún no está en el TAD"', /Aún no está en el TAD/.test(await p.textContent('#hojaFicha')));
    ok(nombre + ': queda en la bitácora', (mundo.bitacora || []).some((b) => b.accion === 'dedicado_registrado'));
    await cerrarHojas(p);
    await p.fill('#busca', 'Red Inventada'); await p.waitForFunction(() => /Red Inventada/.test(document.getElementById('lista').textContent), null, { timeout: 8000 });
    ok(nombre + ': en la lista lleva la etiqueta azul', /Aún no está en el TAD/.test(await p.textContent('#lista')));
    // Cuando llega del TAD (tiene servicios) la etiqueta se va sola
    nuevo.servicios = [{ id: 99901, cliente_id: nuevo.id, categoria: 'Dedicado', estado: 'activo', sucursal: 'Principal' }];
    await p.fill('#busca', ''); await p.fill('#busca', 'Red Inventada Net'); await p.waitForTimeout(900);
    ok(nombre + ': con el RIF en el TAD la etiqueta desaparece', !/Aún no está en el TAD/.test(await p.textContent('#lista')));

    // ----- F3: VGT por solicitud -----
    await p.fill('#busca', ''); await p.waitForTimeout(500);
    // Lote 10/11 J: VGT es una sección de Documentos; cada solicitud es una tarjeta que abre su hoja
    await p.goto(H + 'clientes.html?s=isp&f=todos&c=' + a.id + '&t=vgt'); await p.waitForSelector('#hojaFicha.ver #tab-documentos details.doc-sec[data-sec="vgt"][open] [data-vgt-sol="12"]', { timeout: 10000 });
    ok(nombre + ': sin pestañas Contrato ni VGT; Documentos tiene Expediente, Contratos y VGT', (await p.locator('#tabs [data-tab="contrato"]:not(.hidden), #tabs [data-tab="vgt"]:not(.hidden)').count()) === 0 &&
      (await p.locator('#tab-documentos details.doc-sec[data-sec="exp"]').count()) === 1 && (await p.locator('#tab-documentos details.doc-sec[data-sec="ctr"]').count()) === 1);
    let tc = await p.textContent('#tab-documentos [data-sec="vgt"]');
    ok(nombre + ': pólizas del cliente arriba, "Sirven para todas sus solicitudes"', /Pólizas VGT del cliente/.test(tc) && /Sirven para todas sus solicitudes/.test(tc));
    ok(nombre + ': la tarjeta de la solicitud dice lo que falta y qué documento contractual le toca', /Troncal Inventada/.test(tc) && /Falta propuesta/.test(await p.textContent('[data-vgt-sol="12"]')) && /Contrato VGT|Adendum/.test(await p.textContent('[data-vgt-sol="12"]')), await p.textContent('[data-vgt-sol="12"]'));
    ok(nombre + ': la negada queda en el historial', /solicitud negada/i.test(tc));
    await p.click('[data-vgt-sol="12"]'); await p.waitForSelector('#hojaVgtSol.ver [data-vgt-subir="12:propuesta"]');
    ok(nombre + ': la hoja de la solicitud pide propuesta, planilla y el contrato o adendum firmado', (await p.locator('#hojaVgtSol [data-vgt-subir="12:planilla"]').count()) === 1 && (await p.locator('#hojaVgtSol [data-vgt-subir="12:contrato"]').count()) === 1 && (await p.locator('#hojaVgtSol #formVgtDoc').count()) === 1);
    // Subir la propuesta: el servidor da su casilla y el archivo se registra ahí
    { const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.locator('#hojaVgtSol [data-vgt-subir="12:propuesta"]').click()]); await fc.setFiles(pdf('propuesta.pdf')); }
    await p.waitForFunction(() => !document.querySelector('#hojaVgtSol [data-vgt-subir="12:propuesta"]'), null, { timeout: 15000 }).catch(() => {});
    const vc = llamo(mundo, 'vgt_casilla').pop(); const dr = llamo(mundo, 'documentos_registrar').pop();
    ok(nombre + ': la propuesta va a la casilla de su solicitud', !!vc && vc[2].p_contrato === 12 && vc[2].p_tipo === 'propuesta' && !!dr && dr[2].p_items[0].casillas[0].numero === 71);
    { const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.locator('#hojaVgtSol [data-vgt-subir="12:planilla"]').click()]); await fc.setFiles(pdf('planilla.pdf')); }
    await p.waitForFunction(() => /Planilla de tendido 1/.test(document.getElementById('hojaVgtSol').textContent), null, { timeout: 15000 }).catch(() => {});
    ok(nombre + ': la planilla queda en su casilla y sigue "Agregar planilla"', /Planilla de tendido 1/.test(await p.textContent('#hojaVgtSol')) && (await p.locator('#hojaVgtSol [data-vgt-subir="12:planilla:otra"]').count()) === 1);
    { const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.locator('#hojaVgtSol [data-vgt-subir="12:planilla:otra"]').click()]); await fc.setFiles(pdf('planilla2.pdf')); }
    await p.waitForFunction(() => /Planilla de tendido 2/.test(document.getElementById('hojaVgtSol').textContent), null, { timeout: 15000 }).catch(() => {});
    ok(nombre + ': la segunda planilla queda en su propia casilla', /Planilla de tendido 2/.test(await p.textContent('#hojaVgtSol')) && llamo(mundo, 'vgt_casilla').pop()[2].p_otra === true);
    // Contrato o adendum firmado: archivo, N.º, fecha de firma y vencimiento
    const antesDr = llamo(mundo, 'documentos_registrar').length;
    { const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.locator('#hojaVgtSol [data-vgt-subir="12:contrato"]').first().click()]); await fc.setFiles(pdf('contrato-firmado.pdf')); }
    for(let i = 0; i < 60 && llamo(mundo, 'documentos_registrar').length === antesDr; i++) await p.waitForTimeout(250);
    await p.waitForFunction(() => /firmado/.test(document.getElementById('hojaVgtSol').textContent) && !!document.querySelector('#hojaVgtSol [data-ver]'), null, { timeout: 15000 }).catch(() => {});
    ok(nombre + ': el contrato firmado se sube en su casilla de la solicitud', llamo(mundo, 'vgt_casilla').some((l) => l[2].p_tipo === 'contrato' && l[2].p_contrato === 12));
    await p.fill('#vgNum', '1234'); await p.fill('#vgFirma', '2026-10-01'); await p.fill('#vgVence', '2027-10-01'); await p.click('#hojaVgtSol [data-vg-firma="digital"]'); await p.click('#vgGuardar');
    await p.waitForFunction(() => !!document.querySelector('#hojaVgtSol .vgt-franja.verde'), null, { timeout: 10000 }).catch(() => {});
    ok(nombre + ': al guardar el número y la firma, la franja pasa a verde', llamo(mundo, 'vgt_documento_guardar').length === 1 && (await p.locator('#hojaVgtSol .vgt-franja.verde').count()) === 1, await p.textContent('#hojaVgtSol .vgt-franja'));
    await p.screenshot({ path: 'capturas/lote10nov-J-' + nombre + '-solicitud.png' });
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    await p.screenshot({ path: 'capturas/lote10nov-J-' + nombre + '-documentos.png', fullPage: true });
    // Nueva solicitud
    await p.click('#vgtNueva'); await p.waitForSelector('#hojaCampo.ver #formSol');
    await p.click('#guardarSol'); ok(nombre + ': la solicitud nueva pide el proyecto', /proyecto/.test(await p.textContent('#eSProy')));
    await p.fill('#sProy', 'Ruta Nueva Inventada'); await p.fill('#sPostes', '6'); await p.click('#guardarSol');
    await p.waitForFunction(() => /Ruta Nueva Inventada/.test((document.getElementById('tab-documentos') || {}).textContent || ''), null, { timeout: 10000 }).catch(() => {});
    ok(nombre + ': "+ Nueva solicitud" la crea, como Adendum', /Ruta Nueva Inventada/.test(await p.textContent('#tab-documentos')) && (mundo.bitacora || []).some((b) => b.accion === 'vgt_solicitud_nueva'));
    ok(nombre + ': sin desborde', await sinDesborde(p));
    await ctx.close();
  }
  // Legal no registra dedicados
  { const { ctx } = await contexto(nav, PC); const p = await entrar(ctx, 'lucia', '739105');
    await p.goto(H + 'clientes.html?s=isp&f=todos'); await p.waitForSelector('#lista', { timeout: 10000 }); await p.waitForTimeout(600);
    ok('la líder también lo ve (líder: ella misma)', await p.locator('#dedNuevo').isVisible());
    if(await p.locator('#dedNuevo').isVisible()){ await p.click('#dedNuevo'); await p.waitForSelector('#hojaDedNuevo.ver'); ok('la hoja de la líder no pide elegir líder', (await p.locator('#dnLider').count()) === 0 && /Líder: tú/.test(await p.textContent('#hojaDedNuevo'))); }
    await ctx.close(); }
  ok('sin errores de JavaScript', !errores.length, errores.slice(0, 3));
  await nav.close(); cerrar();
})();
