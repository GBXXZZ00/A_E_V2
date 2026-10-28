// Comisiones del 13/10: período del 18 al 17 con límite el 18, evento a mano, orden de otra persona,
// motivo visible, IP a mano, Excel con técnico, Proforma y carta en la hoja, archivos por subir y quienes crean órdenes por otros.
const fs = require('fs');
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar, plegables } = require('./simulador');
const { corte: K } = require('./mundo');
const { ok, cerrar } = marcador();

// ----- Bordes del período (misma regla que privado.corte_reglas) -----
ok('el 20/09 es del corte de septiembre (regla vieja)', K.corteDe('2026-09-20') === '2026-09-01');
ok('el 21/09 abre octubre (transición)', K.corteDe('2026-09-21') === '2026-10-01');
ok('el 17/10 es de octubre', K.corteDe('2026-10-17') === '2026-10-01');
ok('el 18/10 ya es de noviembre, su primer corte', K.corteDe('2026-10-18') === '2026-11-01');
ok('el 19/10 y el 20/10 también son de noviembre', K.corteDe('2026-10-19') === '2026-11-01' && K.corteDe('2026-10-20') === '2026-11-01');
ok('el 17/11 es de noviembre y el 18/11 de diciembre', K.corteDe('2026-11-17') === '2026-11-01' && K.corteDe('2026-11-18') === '2026-12-01');
ok('octubre va del 21/09 al 17/10', K.corteInicio('2026-10-01') === '2026-09-21' && K.corteFin('2026-10-01') === '2026-10-17');
ok('noviembre va del 18/10 al 17/11', K.corteInicio('2026-11-01') === '2026-10-18' && K.corteFin('2026-11-01') === '2026-11-17');
ok('septiembre conserva la regla vieja', K.corteInicio('2026-09-01') === '2026-08-21' && K.corteFin('2026-09-01') === '2026-09-20' && K.corteLimite('2026-09-01') === '2026-09-20');
ok('octubre: límite movido al 21 (20/10); noviembre vuelve a 18 y certifica desde el 19', K.corteLimite('2026-10-01') === '2026-10-21' && K.corteCertifica('2026-10-01') === '2026-10-21' && K.corteLimite('2026-11-01') === '2026-11-18' && K.corteCertifica('2026-11-01') === '2026-11-19');
// Lote urgente 20/10: el corte se cierra a mano; mientras no se cierre sigue en curso
const { usar } = require('./mundo');
usar({ certificados: {} });
K.fijarHoy('2026-10-17'); ok('el 17 el corte en curso es octubre', K.enCurso() === '2026-10-01');
K.fijarHoy('2026-10-22'); ok('pasado el día límite, octubre sigue en curso si nadie lo cerró', K.enCurso() === '2026-10-01');
K.fijarHoy('2026-11-25'); ok('aunque pase noviembre, sigue en curso el corte abierto más viejo', K.enCurso() === '2026-10-01');
usar({ certificados: { '2026-10-01': { en: '2026-10-22T15:00:00Z', filas: [] } } });
ok('cerrado octubre, el corte en curso es noviembre', K.enCurso() === '2026-11-01');
K.fijarHoy('2026-10-22'); ok('cerrado octubre antes del día 18, en curso noviembre', K.enCurso() === '2026-11-01');
K.fijarHoy('2026-09-10'); usar({ certificados: {} }); ok('antes de octubre 2026 el calendario manda (septiembre)', K.enCurso() === '2026-09-01');
K.fijarHoy(null); usar(null);

const cliente = (mundo, nombre) => mundo.datos.clientes.find((c) => c.nombre === nombre || c.nombre === nombre + ', C.A.');
async function cerrarHojas(p){ for(let i = 0; i < 4 && await p.evaluate(() => !!window.Comun.hojaAbierta()); i++){ await p.keyboard.press('Escape'); await p.waitForTimeout(260); } }

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    // Datos de la prueba (inventados): orden de otra persona, aprobado sin archivo, evento y servicio sin IP
    const otro = cliente(mundo, 'Comercial de Prueba 12'); Object.assign(otro.instalaciones[0], { confirmada: false, de_otro: true, dueno: null });
    const yunque = cliente(mundo, 'Tornillos El Yunque, C.A.'); yunque.documentos.find((d) => d.casilla === 'acta_constitutiva').archivos = [];
    const evento = cliente(mundo, 'Comercial de Prueba 14'); Object.assign(evento.instalaciones[0], { es_evento: true, evento_comisiona: false });
    const faro = cliente(mundo, 'Vidrios El Faro, C.A.'); faro.servicios[0].ip = null;

    const p = await entrar(ctx, 'elena', '315806'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'comisiones.html'); await p.waitForSelector('.grupo');
    ok(nombre + ': el rango dice el período y el día límite como aviso', /Del .+\. (Día límite el \d+|Hoy es el día límite|El día límite fue el \d+)/.test(await p.textContent('#rango')));
    // Orden de otra persona: por asignar con su motivo
    await p.click('[data-filtro="asignar"]'); await p.waitForSelector('[data-com]');
    const lista = await p.textContent('#lista');
    ok(nombre + ': la orden de otra persona sale por asignar con su motivo', lista.includes('Comercial de Prueba 12') && lista.includes('Orden creada por otra persona, sin código'));
    ok(nombre + ': cada pendiente dice su motivo en una frase', lista.includes('Nombre parecido') && lista.includes('Sin orden de Odoo reciente'));
    // Archivos por subir: filtro con contador y etiqueta
    await p.click('[data-filtro="subir"]'); await p.waitForFunction(() => /Tornillos El Yunque/.test(document.getElementById('lista').textContent));
    ok(nombre + ': filtro Archivos por subir con contador', /Archivos por subir\s*\d+/.test(await p.textContent('[data-filtro="subir"]')) && (await p.textContent('#lista')).includes('Tornillos El Yunque'));
    ok(nombre + ': la fila lleva la etiqueta Archivos por subir sin cambiar la comisión', (await p.locator('#lista [data-com] .cx-q', { hasText: /Archivos por subir/ }).count()) === (await p.locator('#lista [data-com]').count()) && (await p.locator('#lista [data-com]', { hasText: 'Tornillos El Yunque' }).locator('.chip.verde').count()) >= 1);
    await p.click('[data-filtro="todos"]'); await p.waitForSelector('.grupo');
    await p.locator('.grupo-cab').filter({ hasText: 'Lucía Ferrer' }).click();
    ok(nombre + ': la fila dice Carta y proforma por enviar', (await p.locator('.grupo.abierto .cx-cp', { hasText: 'Por enviar' }).count()) >= 1);
    ok(nombre + ': Comisiones sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/22-' + nombre + '-comisiones.png', fullPage: true });

    // Hoja de comisión (lote 28/10): carta y proforma en un solo envío, Falta IP, escribir IP, enviar y quién lo envió
    await p.locator('.grupo.abierto [data-com]').filter({ hasText: 'Vidrios El Faro' }).click(); await p.waitForSelector('#hojaComision.ver [data-plg-btn="carta"]');
    ok(nombre + ': Carta y proforma es un plegable con su estado en la cabecera', /falta la IP/.test(await p.textContent('[data-plg-btn="carta"]')));
    await plegables(p, 'carta');
    const prof = await p.textContent('#plg-carta');
    ok(nombre + ': el plegable trae la proforma, la carta, la IP y un solo botón de WhatsApp', prof.includes('Carta de bienvenida') && prof.includes('Proforma') && (await p.locator('#cartaWa').count()) === 1 && (await p.locator('#cartaOtra').count()) === 1);
    ok(nombre + ': sin IP dice que falta, con el enlace Escribir', /Falta/.test(prof) && (await p.textContent('#profIp')).includes('Escribir'));
    await p.screenshot({ path: 'capturas/22-' + nombre + '-hoja-proforma.png' });
    await p.click('#profIp'); await p.waitForSelector('#hojaCampo.ver #cIp');
    await p.fill('#cIp', '190.124.30.15'); await p.click('#guardarCampo');
    await p.waitForFunction(() => !/falta la IP/.test(document.querySelector('[data-plg-btn="carta"]').textContent));
    ok(nombre + ': la IP escrita en la hoja de comisión se guarda y quita el Falta IP', mundo.llamadas.some((l) => l[1] === 'servicio_ip' && l[2].p_ip === '190.124.30.15'));
    await plegables(p, 'carta'); await p.click('#cartaOtra'); await p.waitForSelector('#hojaEnviar.ver');
    ok(nombre + ': Enviar por correo u otro abre la hoja de envío encima, sin abrir el expediente', (await p.evaluate(() => window.Comun.hojasAbiertas().join())) === 'hojaComision,hojaEnviar');
    await p.click('#envManual'); await p.click('#envManual');
    await p.waitForFunction(() => /Enviada por Canales/.test(document.querySelector('[data-plg-btn="carta"]').textContent));
    const prof2 = await p.textContent('#plg-carta');
    ok(nombre + ': queda anotado quién la envió y cuándo, y se puede volver a enviar', /Elena/.test(prof2) && (await p.textContent('#cartaWa')).includes('Volver a enviar') && mundo.llamadas.some((l) => l[1] === 'carta_enviar'));
    await cerrarHojas(p);
    await p.waitForFunction(() => [...document.querySelectorAll('.grupo.abierto .cx-cp')].some((t) => /Enviada \d\d\/\d\d/.test(t.textContent)));
    ok(nombre + ': en la fila queda Enviada con la fecha', true);

    // Evento a mano: el Analista Senior lo ve aparte y decide si comisiona
    await p.click('[data-filtro="eventos"]'); await p.waitForSelector('#lista [data-com]');
    ok(nombre + ': filtro Eventos con el evento que no comisiona', (await p.textContent('#lista')).includes('Comercial de Prueba 14'));
    await p.locator('#lista [data-com]').first().click(); await plegables(p, 'ajustes'); await p.waitForSelector('#hojaComision.ver [data-evento]');
    ok(nombre + ': la hoja dice que es evento y no comisiona', (await p.textContent('#hojaComision')).includes('Evento: no comisiona'));
    await p.click('[data-evento="si_com"]');
    await p.waitForFunction(() => document.querySelector('[data-evento="si_com"].on'));
    const ev = mundo.llamadas.filter((l) => l[1] === 'instalacion_evento').pop();
    ok(nombre + ': marcar Comisiona lo guarda en el servidor', ev && ev[2].p_evento === true && ev[2].p_comisiona === true && mundo.bitacora.some((b) => b.accion === 'instalacion_evento'));
    await cerrarHojas(p);
    await p.waitForFunction(() => !document.querySelector('[data-filtro="eventos"]') || !/Eventos\s*1/.test(document.querySelector('[data-filtro="eventos"]').textContent));
    ok(nombre + ': al comisionar sale de Eventos y vuelve a la lista', (await p.locator('[data-filtro="eventos"]').count()) === 0 || !(await p.textContent('#lista')).includes('Comercial de Prueba 14'));

    // Excel del corte con técnico y número de orden
    await p.click('[data-filtro="todos"]').catch(() => {}); await p.waitForSelector('#bajarExcel');
    const [x] = await Promise.all([p.waitForEvent('download'), p.click('#bajarExcel')]);
    const txt = fs.readFileSync(await x.path()).toString('utf8');
    ok(nombre + ': el Excel trae técnico o instalador y número de orden', txt.includes('Técnico o instalador') && txt.includes('N° de orden de Odoo') && txt.includes('Instalador mb-02'));
    await ctx.close();

    // El líder ve la marca pero no la cambia
    const b = await contexto(nav, dispositivo); Object.assign(cliente(b.mundo, 'Vidrios El Faro, C.A.').instalaciones[0], { es_evento: true, evento_comisiona: true });
    const q = await entrar(b.ctx, 'lucia', '739105'); q.on('pageerror', (e) => errores.push(e.message));
    await q.goto(H + 'comisiones.html'); await q.waitForSelector('[data-com]');
    await q.locator('[data-com]').filter({ hasText: 'Vidrios El Faro' }).click(); await q.waitForSelector('#hojaComision.ver [data-plg-btn="legal"]');
    ok(nombre + ': el líder ve que es evento pero no puede cambiarlo', (await q.textContent('#hojaComision')).includes('Evento: comisiona') && (await q.locator('[data-evento]').count()) === 0);
    ok(nombre + ': el líder también puede enviar la proforma y la carta', (await q.locator('#cartaWa').count()) === 1);
    await b.ctx.close();

    // Usuarios: quienes crean órdenes por otros. Clientes: archivos por subir
    const a = await contexto(nav, dispositivo); cliente(a.mundo, 'Tornillos El Yunque, C.A.').documentos.find((d) => d.casilla === 'acta_constitutiva').archivos = [];
    const r = await entrar(a.ctx, 'marcos', '482913'); r.on('pageerror', (e) => errores.push(e.message));
    await r.goto(H + 'usuarios.html'); await r.waitForSelector('#listaCreadores [data-creador]');
    ok(nombre + ': Usuarios lista quienes crean órdenes por otros', (await r.getAttribute('[data-creador="Ana Creadora"]', 'aria-checked')) === 'true');
    await r.click('[data-creador="Lucía Ferrer"]'); await r.waitForFunction(() => document.querySelector('[data-creador="Lucía Ferrer"]').getAttribute('aria-checked') === 'true');
    ok(nombre + ': marcar a alguien lo guarda con bitácora', a.mundo.llamadas.some((l) => l[1] === 'creador_por_otros' && l[2].p_valor === true) && a.mundo.bitacora.some((x) => x.accion === 'creador_por_otros'));
    ok(nombre + ': Usuarios sin desborde', await sinDesborde(r));
    await r.screenshot({ path: 'capturas/22-' + nombre + '-creadores.png', fullPage: true });
    await r.goto(H + 'clientes.html'); await r.waitForSelector('[data-filtro="por_subir"]');
    ok(nombre + ': Clientes ya no tiene el atajo Por instalar', (await r.locator('[data-filtro="por_instalar"]').count()) === 0);
    await r.click('[data-filtro="por_subir"]'); await r.waitForFunction(() => /Tornillos El Yunque/.test(document.getElementById('lista').textContent));
    ok(nombre + ': Clientes filtra los que tienen archivos por subir, con la etiqueta', (await r.locator('#lista .tagn', { hasText: /por subir/ }).count()) === (await r.locator('#lista [data-cliente]').count()));
    // Lo que sube el administrador a un cliente aprobado entra aprobado y no cambia el estatus
    const y = cliente(a.mundo, 'Tornillos El Yunque, C.A.'); const antes = y.estatus;
    a.mundo.datos.subidas['DRV-PRUEBA'] = { cliente: y.id, usuario: '11111111-1111-4111-8111-111111111111', nombre: 'acta.pdf', mime: 'application/pdf', tamano: 1000 };
    await r.evaluate((id) => window.Comun.rpc('documentos_registrar', { p_cliente: id, p_items: [{ archivos: [{ drive_id: 'DRV-PRUEBA' }], casillas: [{ casilla: 'acta_constitutiva', numero: 0 }] }] }), y.id);
    ok(nombre + ': lo subido por el administrador a un aprobado entra aprobado y no cambia el estatus', y.estatus === antes && y.documentos.find((d) => d.casilla === 'acta_constitutiva').estado === 'aprobado');
    ok(nombre + ': y la marca de archivos por subir se quita sola', !require('./mundo').RPC.clientes_lista(a.mundo, a.mundo.personas[0], { p_filtro: 'por_subir' }).filas.some((f) => f.id === y.id));
    await a.ctx.close();
  }
  ok('sin errores de la página', errores.length === 0, errores);
  await nav.close(); cerrar();
})();
