// Lote 3 (14/10): Legal en revisión y a mano, pregunta antes de quitar la comisión, contrato presencial, excepción pagada,
// proforma solo para clientes nuevos, Por instalar desde el 01/10, Dedicados con filtros de Clientes, contratos en tarjetas y requisitos VGT.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
const cliente = (mundo, nombre) => mundo.datos.clientes.find((c) => c.nombre === nombre || c.nombre === nombre + ', C.A.');
async function cerrarHojas(p){ for(let i = 0; i < 5 && await p.evaluate(() => !!window.Comun.hojaAbierta()); i++){ await p.keyboard.press('Escape'); await p.waitForTimeout(260); } }
const llamo = (m, f) => m.llamadas.filter((l) => l[1] === f);

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    const faro = cliente(mundo, 'Vidrios El Faro'); faro.legal_ok_en = null; faro.legal_como = null;
    // Orden vieja (antes del 01/10): no sale salvo con "Ver anteriores"
    mundo.datos.sueltas = [{ id: 7701, numero: 'S00777', titulo: 'INST. PROMO PYME ORDEN VIEJA DE PRUEBA', etapa: 'Programado', creada_en: '2026-09-20T14:00:00Z', nombre: 'Orden Vieja De Prueba', lider: 'Lucía Ferrer' }];
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message + ' ' + String(e.stack).split('\n').slice(0, 3).join(' | ')));

    // ----- Hoja de comisión: un solo lugar para el check de Legal -----
    await p.goto(H + 'comisiones.html'); await p.waitForSelector('.grupo');
    const fila = p.locator('[data-com]', { hasText: 'Vidrios El Faro' }).first();
    if(!(await fila.isVisible())){ await p.locator('.grupo', { has: fila }).locator('.grupo-cab').click(); }
    await fila.click(); await p.waitForSelector('#hojaComision.ver #legalCheck');
    ok(nombre + ': Legal tiene un solo botón para el administrador', (await p.locator('#hojaComision #legalCheck').count()) === 1 && (await p.textContent('#legalCheck')).includes('Aprobar Legal'));
    await p.click('#legalCheck'); await p.waitForSelector('#hojaLegal.ver'); await p.click('#legalGuardar');
    ok(nombre + ': aprobar Legal sin motivo da error debajo', (await p.textContent('#eLegal')).includes('motivo'));
    await p.fill('#legalMotivo', 'Firmó en la oficina, faltan copias'); await p.click('#legalGuardar');
    await p.waitForFunction(() => /Aprobado a mano/.test(document.querySelector('#hojaComision').textContent));
    ok(nombre + ': Legal aprobado a mano con su motivo y en el hilo', llamo(mundo, 'legal_aprobar').length === 1 && faro.hilo.some((h) => h.texto === 'legal_aprobado'));
    ok(nombre + ': Proforma y carta compacta: una línea de IP y dos botones', (await p.locator('#hojaComision .prof .prof-l').count()) === 1 && (await p.locator('#hojaComision .prof .acc-prof .mini').count()) === 2);
    ok(nombre + ': hoja de comisión sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/28-' + nombre + '-legal.png' });
    await p.click('#legalCheck'); await p.waitForSelector('#hojaLegal.ver');
    ok(nombre + ': quitar Legal tiene el motivo opcional', (await p.textContent('#hojaLegal')).includes('opcional'));
    await p.click('#legalGuardar'); await p.waitForFunction(() => /Aprobar Legal/.test((document.querySelector('#legalCheck') || {}).textContent || ''));
    ok(nombre + ': quitar Legal llama al servidor', llamo(mundo, 'legal_quitar').length === 1);
    await cerrarHojas(p);

    // ----- Expediente: bajar el estatus de quien comisiona en el corte abierto pregunta antes -----
    faro.legal_ok_en = new Date().toISOString(); faro.legal_como = 'legal'; faro.estatus = 'por_firmar'; faro.abierta = '2026-10-01';
    await p.goto(H + 'clientes.html?c=' + faro.id); await p.waitForSelector('#hojaFicha.ver #cambiarEstatus');
    await p.click('#cambiarEstatus'); await p.waitForSelector('#hojaEstatus.ver');
    await p.click('#hojaEstatus [data-estatus="documentos_pendientes"]'); await p.waitForSelector('#pregCom');
    ok(nombre + ': pregunta "¿Quitarle la comisión?" con el corte', /comisiona en el corte de octubre\. ¿Quitarle la comisión\?/.test(await p.textContent('#pregCom')));
    await p.screenshot({ path: 'capturas/28-' + nombre + '-pregunta.png' });
    await p.click('#guardarEstatus');
    ok(nombre + ': sin responder no guarda y dice qué falta', (await p.textContent('#ePregCom')).includes('Elige') && llamo(mundo, 'cliente_estatus').length === 0);
    await p.click('[data-quitar-com="si"]'); await p.click('#guardarEstatus');
    await p.waitForFunction(() => !document.querySelector('#hojaEstatus.ver'));
    await p.waitForTimeout(300);
    ok(nombre + ': cambia el estatus y quita la comisión', llamo(mundo, 'cliente_estatus').length === 1 && llamo(mundo, 'legal_quitar').length === 2);
    await p.click('#cambiarEstatus'); await p.waitForSelector('#hojaEstatus.ver');
    await p.click('#hojaEstatus [data-estatus="documentos_recibidos"]');
    ok(nombre + ': subir de estatus no pregunta', (await p.locator('#pregCom').count()) === 0);
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);

    // Contrato presencial y excepción pagada
    await p.waitForSelector('#tab-datos [data-marca-cli="contrato_presencial"]');
    ok(nombre + ': Datos tiene Contrato presencial y Excepción pagada (admin)', (await p.locator('[data-marca-cli="contrato_presencial"]').count()) === 1 && (await p.locator('[data-marca-cli="exc_pagada"]').count()) === 1);
    await p.click('[data-marca-cli="contrato_presencial"]'); await p.waitForFunction(() => document.querySelector('[data-marca-cli="contrato_presencial"]').getAttribute('aria-checked') === 'true');
    ok(nombre + ': marcar contrato presencial pasa por el servidor y queda en el hilo', llamo(mundo, 'cliente_marca').some((l) => l[2].p_marca === 'contrato_presencial' && l[2].p_valor === true) && faro.hilo.some((h) => h.texto === 'contrato_presencial'));
    await p.click('#tabs [data-tab="documentos"]');
    faro.representantes[0].correo = '';
    await p.evaluate(() => window.Ficha.recargar()); await p.waitForFunction(() => /Contrato presencial, sin correo/.test(document.querySelector('#tab-documentos').textContent));
    ok(nombre + ': con contrato presencial no se pide el correo del representante', !faro.hilo.some(() => false));
    await p.click('#tabs [data-tab="datos"]');
    await p.click('[data-marca-cli="exc_pagada"]'); await p.waitForFunction(() => document.querySelector('[data-marca-cli="exc_pagada"]').getAttribute('aria-checked') === 'true');
    ok(nombre + ': excepción pagada se marca', faro.exc_pagada === true);
    await cerrarHojas(p);

    // Proforma y carta solo para clientes con instalación en un corte
    const sin = mundo.datos.clientes.find((c) => !c.dedicado && c.servicios.length && !c.instalaciones.length);
    if(sin){
      await p.goto(H + 'clientes.html?c=' + sin.id); await p.waitForSelector('#hojaFicha.ver #tab-datos .tj');
      ok(nombre + ': sin instalación en un corte no ofrece Proforma y carta', (await p.locator('#tab-datos [data-enviar]').count()) === 0);
      await cerrarHojas(p);
    }

    // ----- Por instalar: solo desde el 01/10 -----
    await p.goto(H + 'comisiones.html?t=instalar'); await p.waitForSelector('#verAnteriores');
    ok(nombre + ': la orden vieja no sale y hay "Ver anteriores"', !(await p.textContent('#lista')).includes('Orden Vieja De Prueba') && (await p.textContent('#verAnteriores')).includes('Ver anteriores (1)'));
    await p.click('#verAnteriores'); await p.waitForFunction(() => /Orden Vieja De Prueba/.test(document.getElementById('lista').textContent));
    ok(nombre + ': con Ver anteriores aparece', (await p.textContent('#verAnteriores')).includes('Ocultar'));

    // ----- Dedicados: filtros de Clientes, VGT y requisitos -----
    const a = cliente(mundo, 'Tornillos El Yunque');
    a.servicios = []; a.instalaciones = [];
    a.dedicado = { tipo: 'isp', ejecutiva: 'Nora Quintero', activo: true, verificar: false, ruta_documentos: 'cargar', cods: ['501'], enlaces: [], contactos: [],
      contratos: [{ id: 11, tipo: 'servicio', estatus: 'firmado' }, { id: 12, tipo: 'vgt', estatus: 'en_elaboracion', proyecto: 'Ruta Inventada Uno', numero: null, postes: 12, en_uso: 'SI', estado: 'Zulia' },
        { id: 13, tipo: 'vgt', estatus: 'en_elaboracion', proyecto: 'Ruta Inventada Dos', postes: 8, en_uso: 'EN PROYECTO', odt: 'ODT-9' }, { id: 14, tipo: 'colocation', estatus: 'sin_contrato', sitio: 'Sitio Inventado', municipio: 'Maracaibo' }],
      vgt: { correo: null, faltan: 7, polizas: [{ numero: 66, vence_en: new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10) }],
        requisitos: [[60, 'asamblea', 'Acta de asamblea de cambios sustanciales', false, false], [61, 'asamblea', 'Acta de asamblea de cambios sustanciales 2', false, false], [64, 'poder', 'Poder de representación', false, false],
          [65, 'habilitacion', 'Habilitación con atributos de internet y transporte en las zonas', true, false], [66, 'poliza_rc', 'Póliza de responsabilidad civil general', true, true], [67, 'poliza_patronal', 'Póliza de responsabilidad patronal', true, true],
          [68, 'propuesta', 'Propuesta comercial firmada y sellada', true, false], [69, 'tendido', 'Planilla de solicitud de tendido aprobada', true, false], [70, 'factibilidad', 'Aprobación de factibilidad técnica (correo)', true, false]]
          .map((r) => ({ numero: r[0], clave: r[1], texto: r[2], requerido: r[3], vence: r[4] })) } };
    // Corrida 14/10 tarde: sin pantalla Dedicados; el dedicado se ve en Clientes (tarjeta ISP) con su etiqueta VGT
    await p.goto(H + 'clientes.html?s=isp&f=todos'); await p.waitForSelector('#lista .cli');
    ok(nombre + ': la fila lleva la etiqueta VGT', (await p.textContent('.cli[data-cliente="' + a.id + '"]')).includes('VGT'));
    ok(nombre + ': filtros de dedicados: VGT, Enlaces y Pólizas', (await p.locator('[data-sel="vgt"]').count()) >= 1 && (await p.locator('[data-sel="enlaces"]').count()) >= 1 && (await p.locator('[data-sel="poliza"]').count()) >= 1);
    await p.click('.cli[data-cliente="' + a.id + '"]'); await p.waitForSelector('#hojaFicha.ver #tab-datos');
    await p.waitForFunction(() => (document.querySelector('#tab-datos') || {}).textContent.includes('Requisitos VGT'), null, { timeout: 8000 }).catch(() => {});
    const dts = await p.textContent('#tab-datos');
    ok(nombre + ': Datos dice Líder (no Ejecutiva) y los requisitos VGT', dts.includes('Líder') && !dts.includes('Ejecutiva') && dts.includes('Requisitos VGT'));
    await p.click('#tabs [data-tab="contratos"]'); await p.waitForSelector('#tab-contratos.on .ctr-t');
    const ct = await p.textContent('#tab-contratos');
    ok(nombre + ': una tarjeta por contrato: VGT arriba con proyectos y total de postes, servicio, colocation por sitio', (await p.locator('#tab-contratos .ctr-t').count()) === 3 &&
      (await p.locator('#tab-contratos .ctr-t').first().getAttribute('class')).includes('ctr-vgt') && ct.includes('Ruta Inventada Uno') && ct.includes('Ruta Inventada Dos') && ct.includes('20 postes') && ct.includes('En proyecto') && ct.includes('ODT ODT-9') && ct.includes('Sitio Inventado'));
    ok(nombre + ': el bloque VGT lista los requisitos con su estado y el vencimiento de la póliza', ct.includes('Requisitos') && ct.includes('Faltan 7') && ct.includes('Póliza de responsabilidad civil general') && /Vence el/.test(ct) && !ct.includes('Acta de asamblea de cambios sustanciales'));
    await p.screenshot({ path: 'capturas/28-' + nombre + '-contratos.png', fullPage: true });
    await p.click('#tab-contratos [data-ir-tab="documentos"]'); await p.waitForSelector('#tab-documentos.on [data-grupo="vgt"]');
    const vg = await p.textContent('[data-grupo="vgt"]');
    ok(nombre + ': grupo Requisitos VGT con su contador, correo y casillas', vg.includes('Faltan 7') && vg.includes('Correo para notificaciones') && vg.includes('Póliza de responsabilidad civil general') && vg.includes('Aprobación de factibilidad técnica'));
    ok(nombre + ': la póliza que vence en menos de 30 días avisa', vg.includes('Pide la renovación'));
    ok(nombre + ': las actas de cambios sustanciales se agregan de una en una', (await p.locator('[data-grupo="vgt"] [data-casilla="otro:60"]').count()) === 1 && (await p.locator('[data-grupo="vgt"] [data-casilla="otro:61"]').count()) === 0);
    await p.click('#agregarVgt'); ok(nombre + ': Agregar muestra otra', (await p.locator('[data-grupo="vgt"] [data-casilla="otro:61"]').count()) === 1);
    ok(nombre + ': Otros documentos no muestra las casillas VGT', (await p.locator('[data-grupo="otros"] [data-casilla="otro:65"]').count()) === 0);
    await p.click('[data-grupo="vgt"] [data-campo="vgt_correo"]'); await p.waitForSelector('#hojaCampo.ver #cCorreo');
    await p.fill('#cCorreo', 'avisos@inventada.test'); await p.click('#guardarCampo'); await p.waitForFunction(() => !document.querySelector('#hojaCampo.ver'));
    ok(nombre + ': el correo de notificaciones se guarda en el servidor', llamo(mundo, 'dedicado_vgt_correo').length === 1);
    ok(nombre + ': expediente del dedicado sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/28-' + nombre + '-vgt.png', fullPage: true });
    await cerrarHojas(p);
    await ctx.close();
  }
  ok('sin errores de la página', errores.length === 0, errores);
  await nav.close(); cerrar();
})();
