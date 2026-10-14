// Pestaña Por instalar (13/10): reloj de 8:00 a 22:00, reprogramadas, cliente provisional, "¿Es este cliente?",
// dueño por asignar, Realizada en Odoo sin instalación, contadores en Inicio y el provisional que se une al cliente real.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { horasReloj } = require('./mundo');
const { ok, cerrar } = marcador();

// ----- Reloj (misma cuenta que privado.horas_reloj): solo de 8:00 a 22:00 hora de Caracas, todos los días -----
ok('reloj: registrada lunes 15:00, rojo el miércoles a las 11:00', horasReloj('2026-10-12T15:00:00-04:00', '2026-10-14T11:00:00-04:00') === 24);
ok('reloj: registrada lunes 15:00, el martes 15:00 lleva 14 horas', horasReloj('2026-10-12T15:00:00-04:00', '2026-10-13T15:00:00-04:00') === 14);
ok('reloj: registrada a las 23:00 empieza a contar a las 8:00', horasReloj('2026-10-12T23:00:00-04:00', '2026-10-13T08:00:00-04:00') === 0 && horasReloj('2026-10-12T23:00:00-04:00', '2026-10-13T10:00:00-04:00') === 2);
ok('reloj: sábado y domingo también cuentan', horasReloj('2026-10-10T21:00:00-04:00', '2026-10-11T09:00:00-04:00') === 2);
ok('reloj: ámbar a las 16 horas (lunes 8:00 a martes 10:00)', horasReloj('2026-10-12T08:00:00-04:00', '2026-10-13T10:00:00-04:00') === 16);

const hace = (h) => new Date(Date.now() - h * 3600000).toISOString();
function preparar(mundo){
  const D = mundo.datos; let id = 5000;
  const nuevo = (nombre, o) => Object.assign({ id: ++id, doc_tipo: 'J', doc_numero: String(9900000000 + id), nombre, es_natural: false, lider_id: null, lider: null, estatus: 'grandes_negocios', estatus_desde: hace(5),
    legal_ok_en: null, es_top: false, regimen_firma: null, es_isp: false, correo_empresa: null, telefono: null, direccion: null, ug_en: null, ug_por: null, creado_en: hace(5),
    proforma_en: null, proforma_por: null, bienvenida_en: null, bienvenida_por: null, es_demo: false, servicios: [], instalaciones: [], representantes: [], documentos: [], hilo: [] }, o || {});
  // Provisional de una orden que creó otra persona sin código, reprogramada dos veces: el reloj cuenta desde la primera
  D.clientes.push(nuevo('Panadería Provisional', { provisional: true, orden: { id: 701, numero: 'PRUEBA/0701', titulo: 'INST. PROMO PYME PANADERIA PROVISIONAL', creada_en: hace(2), inicio: hace(96), veces: 2, etapa: 'Asignada', de_otro: true } }));
  // Orden sin cliente con un nombre parecido a uno que ya existe
  D.sueltas = [{ id: 702, numero: 'PRUEBA/0702', titulo: 'INST. PROMO PYME KIOSKO LA PARADA', nombre: 'Kiosko La Parada', etapa: 'Planificada', creada_en: hace(30), parecido_id: D.clientes.find((c) => c.nombre === 'Kiosco La Parada').id, lider: 'Rosa Paredes' }];
  // Realizada en Odoo sin instalación (para el Analista Senior)
  D.realizadas = [{ orden_id: 703, numero: 'PRUEBA/0703', titulo: 'INST. PROMO PYME FERRETERIA HECHA', creada_en: hace(200), ejecutada_en: hace(150), cliente_id: null, cliente: 'Ferretería Hecha', lider: 'Rosa Paredes' }];
}

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo); preparar(mundo);
    const p = await entrar(ctx, 'elena', '315806'); p.on('pageerror', (e) => errores.push(e.message));
    // Inicio: solo contadores que llevan a la pestaña
    await p.waitForSelector('[data-k="instalar"], .pf');
    const ini = await p.locator('[data-k="instalar"]').count() ? await p.textContent('[data-k="instalar"]') : await p.textContent('#zonaPendientes');
    ok(nombre + ': Inicio dice cuántas órdenes están en rojo', /órdenes? en rojo/.test(ini));
    await p.goto(H + 'comisiones.html?t=instalar'); await p.waitForSelector('#lista .ins');
    ok(nombre + ': la pestaña Por instalar abre marcada', (await p.getAttribute('#vistas [data-vista="instalar"]', 'aria-selected')) === 'true' && (await p.locator('#rango').isHidden()));
    ok(nombre + ': agrupada por líder, con el que tiene rojas arriba', (await p.locator('#lista .grupo-cab').count()) >= 2);
    const prov = p.locator('#lista .ins').filter({ hasText: 'Panadería Provisional' });
    const tp = await prov.textContent();
    ok(nombre + ': la reprogramada lleva su etiqueta con las veces y el reloj desde la primera orden', tp.includes('Reprogramada 2 veces') && (await prov.locator('.m.rojo').count()) === 1);
    ok(nombre + ': el provisional se ve como tal y con el dueño por asignar', tp.includes('Provisional') && tp.includes('Dueño por asignar'));
    ok(nombre + ': Por instalar sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/23-' + nombre + '-por-instalar.png', fullPage: true });
    // El Analista Senior elige el dueño
    await prov.locator('[data-dueno-prov]').click(); await p.waitForSelector('#hojaDueno.ver');
    await p.click('#guardarDueno'); ok(nombre + ': sin elegir líder avisa debajo', (await p.textContent('#eDueno')).includes('Elige'));
    await p.selectOption('#duenoSel', 'Rosa Paredes'); await p.click('#guardarDueno');
    await p.waitForFunction(() => !document.querySelector('#hojaDueno.ver'));
    ok(nombre + ': el dueño queda guardado con bitácora', mundo.bitacora.some((b) => b.accion === 'provisional_dueno' && b.despues.lider === 'Rosa Paredes'));
    // ¿Es este cliente?
    await p.waitForSelector('#lista [data-es-cli]', { state: 'attached' });
    await p.evaluate(() => { const g = document.querySelector('[data-es-cli]').closest('.grupo'); if(g && !g.classList.contains('abierto')) g.querySelector('.grupo-cab').click(); });
    ok(nombre + ': una orden con nombre parecido pregunta "¿Es este cliente?"', (await p.textContent('#lista')).includes('¿Es este cliente?') && (await p.textContent('#lista')).includes('Kiosco La Parada'));
    await p.click('[data-es-cli="no"]');
    await p.waitForFunction(() => !document.querySelector('[data-es-cli]'));
    ok(nombre + ': "No, es otro" crea el provisional', mundo.llamadas.some((l) => l[1] === 'orden_es_cliente' && l[2].p_cliente === null) && mundo.datos.clientes.some((c) => c.nombre === 'Kiosko La Parada' && c.provisional));
    // Realizada en Odoo sin instalación (la lista se repinta después de "No, es otro")
    await p.waitForFunction(() => /Ferreter/.test(document.querySelector('#lista').textContent), null, { timeout: 5000 }).catch(() => {});
    ok(nombre + ': el Analista Senior ve las realizadas en Odoo sin instalación', /Realizadas? en Odoo sin instalación/.test(await p.textContent('#lista')) && (await p.textContent('#lista')).includes('Ferretería Hecha'));
    // Abrir el provisional, escribir su RIF y que se una al cliente real
    await p.evaluate(() => { document.querySelectorAll('#lista .grupo').forEach((g) => { if(!g.classList.contains('abierto')) g.querySelector('.grupo-cab').click(); }); });
    await p.locator('#lista .ins').filter({ hasText: 'Panadería Provisional' }).locator('[data-exp]').click(); await p.waitForSelector('#hojaFicha.ver #paso');
    ok(nombre + ': el expediente dice que es provisional y sin RIF', (await p.textContent('#paso')).includes('Cliente provisional') && (await p.textContent('#cabFicha')).includes('Provisional, sin RIF'));
    await p.click('#paso [data-paso="rif"]'); await p.waitForSelector('#hojaCampo.ver #cRif');
    await p.fill('#cRif', 'J5910'); await p.click('#guardarCampo');
    ok(nombre + ': un RIF incompleto avisa debajo', (await p.textContent('#eCampo')).includes('RIF'));
    await p.fill('#cRif', 'J-591000011'); await p.click('#guardarCampo');
    await p.waitForFunction(() => /Vidrios El Faro/.test(document.getElementById('tFicha') ? document.getElementById('tFicha').textContent : ''));
    ok(nombre + ': con el RIF de un cliente existente se une a él y abre el real', mundo.datos.clientes.find((c) => c.nombre === 'Panadería Provisional').unido_a > 0);
    await p.keyboard.press('Escape');
    await ctx.close();

    // El líder ve solo las suyas, sin las realizadas ni elegir dueño
    const b = await contexto(nav, dispositivo); preparar(b.mundo);
    const q = await entrar(b.ctx, 'lucia', '739105'); q.on('pageerror', (e) => errores.push(e.message));
    await q.goto(H + 'comisiones.html?t=instalar'); await q.waitForSelector('#lista .ins');
    const tl = await q.textContent('#lista');
    ok(nombre + ': el líder ve solo sus órdenes', tl.includes('Autolavado El Chorro') && !tl.includes('Panadería Provisional') && !tl.includes('Realizada en Odoo'));
    ok(nombre + ': el líder no elige dueños', (await q.locator('[data-dueno-prov]').count()) === 0);
    await b.ctx.close();

    // En Clientes el provisional lleva la etiqueta Por instalar y no muestra un RIF inventado
    const a = await contexto(nav, dispositivo); preparar(a.mundo);
    const r = await entrar(a.ctx, 'marcos', '482913'); r.on('pageerror', (e) => errores.push(e.message));
    await r.goto(H + 'clientes.html?f=todos'); await r.fill('#busca', 'Panadería'); await r.waitForFunction(() => /Panadería Provisional/.test(document.getElementById('lista').textContent));
    const fila = await r.locator('#lista [data-cliente]').filter({ hasText: 'Panadería Provisional' }).first().textContent();
    ok(nombre + ': en Clientes el provisional dice Provisional, sin RIF y Por instalar', fila.includes('Provisional, sin RIF') && fila.includes('Por instalar'), fila);
    await a.ctx.close();
  }
  ok('sin errores de la página', errores.length === 0, errores);
  await nav.close(); cerrar();
})();
