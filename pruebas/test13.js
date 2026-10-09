// Factibilidad paso 3 y 4: lista, consulta, resultado con mapa, mapa amplio, enlaces cortos, datos del cliente, seguimiento y la marca NUEVO con un mapa nuevo.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { RPC } = require('./mundo');
const { ok, cerrar } = marcador();
const abiertas = (p) => p.evaluate(() => window.Comun.hojasAbiertas().join());
const cerrarTodo = async (p) => { for(let i = 0; i < 4; i++){ if(await p.evaluate(() => !!window.Comun.hojaAbierta())) await p.keyboard.press('Escape'); } await p.waitForFunction(() => !window.Comun.hojaAbierta()); };
const cuadro = (m, e, x, a, lng0, lat0, lng1, lat1, c) => ({ m, n: m, e, x, a, c: c || '100', ci: 'Ciudad Prueba', lng: [lng0, lng1, lng1, lng0], lat: [lat0, lat0, lat1, lat1] });
function subirMapa(mundo, fecha, disenoLiberado){
  const adm = mundo.personas[0];
  const id = RPC.mapa_iniciar(mundo, adm, { p_fecha: fecha, p_archivo: 'mapa.kmz', p_poligonos: 4, p_puntos: 3 });
  RPC.mapa_zonas(mundo, adm, { p_mapa: id, p_filas: [cuadro('A-LIB', 'liberado', 'liberada', null, -71.010, 10.000, -71.000, 10.010, '792'), cuadro('B-EXC', 'exclusiva', 'aliado', 'Aliado Uno', -71.010, 10.020, -71.000, 10.030),
    cuadro('C-PE', 'liberado', 'planta_externa', null, -71.010, 10.040, -71.000, 10.050), cuadro('D-DIS', disenoLiberado ? 'liberado' : 'diseno', 'liberada', null, -70.997, 10.000, -70.990, 10.010)] });
  return RPC.mapa_cerrar(mundo, adm, { p_mapa: id });
}
async function consultar(p, texto, tipo){
  if(await p.evaluate(() => window.Comun.hojaAbierta() === 'hojaFact' && !!document.getElementById('faEnlace')) === false){
    await p.locator(p.viewportSize().width < 900 ? '.fa-fab' : '.cabeza [data-nueva]').click(); await p.waitForSelector('#hojaFact.ver #faEnlace');
  }
  await p.fill('#faEnlace', texto);
  if(tipo) await p.click('[data-tipo="' + tipo + '"]');
  await p.click('#faConsultar');
}
const esperaResultado = (p) => p.waitForSelector('#hojaFact .fa-veredicto');
(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const tel = nombre === 'tel';
    const { ctx, mundo } = await contexto(nav, Object.assign({ permissions: ['geolocation', 'clipboard-read', 'clipboard-write'], geolocation: { latitude: 10.025, longitude: -71.005 } }, dispositivo));
    await ctx.addInitScript(() => { try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__copiado = t; return Promise.resolve(); }, readText: () => Promise.resolve(window.__portapapeles || '') }, configurable: true }); } catch (e) {} });

    // Sin mapa todavía
    const p = await entrar(ctx, 'lucia', '739105'); p.on('pageerror', (e) => errores.push(e.message + ' | ' + (e.stack || '').split('\n').slice(0, 3).join(' ')));
    await p.waitForSelector('a.mod', { timeout: 10000 }).catch(() => {});
    ok(nombre + ': Inicio trae Factibilidad como módulo activo', (await p.locator('a.mod[data-modulo="factibilidad"]').count()) === 1);
    await p.click('a.mod[data-modulo="factibilidad"]'); await p.waitForURL('**/factibilidad.html'); await p.waitForSelector('#faLista .vacio');
    ok(nombre + ': la navegación marca Factibilidad', (await p.locator((tel ? '#navAbajo' : '.navpc') + ' a.on[href="factibilidad.html"]').count()) === 1);
    ok(nombre + ': sin consultas explica qué hacer', /Toca (Consultar|Nueva consulta)/.test(await p.textContent('#faLista')) && (await p.textContent('#faFecha')).includes('Todavía no hay mapa'));
    await consultar(p, '10.005, -71.005', 'pyme'); await p.waitForFunction(() => /mapa de red/.test((document.getElementById('eEnlace') || {}).textContent || ''));
    ok(nombre + ': sin mapa lo dice debajo del campo', (await p.textContent('#eEnlace')).includes('Pide al administrador'));
    await cerrarTodo(p);

    subirMapa(mundo, '2026-10-01', false);
    await p.reload(); await p.waitForSelector('#faFecha b');
    ok(nombre + ': al pie sale la fecha del mapa y las zonas', (await p.textContent('#faFecha')).includes('4 zonas'));

    // Errores del campo
    await consultar(p, '', 'pyme'); ok(nombre + ': campo vacío pide el enlace', (await p.textContent('#eEnlace')).includes('Pega el enlace'));
    await consultar(p, 'https://example.com/lugar'); ok(nombre + ': enlace que no es de Maps se explica', (await p.textContent('#eEnlace')).includes('no es de Google Maps'));
    ok(nombre + ': el formulario no desborda', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/13-' + nombre + '-form.png' });

    // Hay red, dentro de la zona liberada
    await consultar(p, '10.005, -71.005', 'pyme'); await esperaResultado(p);
    let t = await p.textContent('#hojaFact');
    ok(nombre + ': Hay red con la frase aprobada', t.includes('Hay red') && t.includes('Se puede vender. La zona tiene red activa.') && t.includes('MDT A-LIB · dentro de la zona · 792 hogares'), t.slice(0, 300));
    await p.waitForSelector('#faMapa .leaflet-container'); await p.waitForSelector('#faCerca .fa-mdt');
    ok(nombre + ': dibuja el mapa con las zonas y el punto', (await p.locator('#faMapa path.leaflet-interactive').count()) >= 2 && (await p.locator('#faMapa .fa-pin').count()) === 1);
    ok(nombre + ': lista los MDT cercanos con distancia', (await p.textContent('#faCerca')).includes('A-LIB') && (await p.textContent('#faCerca')).includes('Dentro'));
    await p.click('[data-plegar="odoo"]');
    ok(nombre + ': texto de Odoo plegado con el relleno', (await p.textContent('#txOdoo')) === 'INST. PROMO PYME NOMBRE DEL CLIENTE J000000000');
    await p.click('[data-plegar="datos"]');
    await p.fill('#gNom', 'Panadería <img src=x onerror="window.__xss=1">'); await p.fill('#gRif', 'j-12345678-9');
    ok(nombre + ': el texto de Odoo se arma con nombre y RIF', (await p.textContent('#txOdoo')) === 'INST. PROMO PYME PANADERÍA <IMG SRC=X ONERROR="WINDOW.__XSS=1"> J123456789');
    await p.locator('#gTel').fill('0414-555.01.99'); await p.locator('#gTel').press('Tab');
    await p.waitForFunction(() => document.getElementById('tFact').textContent.includes('Panadería'));
    const c1 = mundo.consultas[mundo.consultas.length - 1];
    ok(nombre + ': los datos se guardan solos y normalizados', c1.rif === '123456789' && c1.rif_tipo === 'J' && c1.telefono === '04145550199', c1);
    await p.fill('#gTel', '123'); await p.locator('#gTel').press('Tab'); await p.waitForFunction(() => /teléfono/.test(document.getElementById('eDatos').textContent));
    ok(nombre + ': un teléfono malo se explica debajo', true);
    await p.click('#faCopiarCliente'); await p.waitForFunction(() => !!window.__copiado);
    ok(nombre + ': Copiar para el cliente arma un mensaje corto', (await p.evaluate(() => window.__copiado)).startsWith('Buenas noticias'));
    ok(nombre + ': el resultado no desborda', await sinDesborde(p));
    await p.waitForTimeout(350); await p.screenshot({ path: 'capturas/13-' + nombre + '-hay-red.png' });

    // Mapa amplio encima
    await p.click('#faAmplio'); await p.waitForSelector('#hojaMapa.ver #faGrande .leaflet-container');
    ok(nombre + ': el mapa amplio sale encima del resultado', (await abiertas(p)) === 'hojaFact,hojaMapa');
    ok(nombre + ': el mapa amplio trae las zonas y el círculo de 2 km', (await p.locator('#faGrande path').count()) >= 5, await p.locator('#faGrande path').count());
    await p.click('[data-capa="dis"]'); ok(nombre + ': se puede apagar una capa', (await p.getAttribute('[data-capa="dis"]', 'aria-pressed')) === 'false');
    await p.click('#faSat'); ok(nombre + ': vista satélite', (await p.getAttribute('#faSat', 'aria-pressed')) === 'true');
    await p.waitForTimeout(350); await p.screenshot({ path: 'capturas/13-' + nombre + '-amplio.png' });
    await p.keyboard.press('Escape'); await p.waitForFunction(() => window.Comun.hojasAbiertas().join() === 'hojaFact');
    ok(nombre + ': Atrás vuelve al resultado', true);
    await cerrarTodo(p);

    // Zona exclusiva, Dedicado a 1,5 km y enlace corto
    await consultar(p, '10.025, -71.005', 'pyme'); await esperaResultado(p);
    ok(nombre + ': zona exclusiva avisa el aliado', (await p.textContent('#hojaFact')).includes('Zona exclusiva de Aliado Uno'));
    await cerrarTodo(p);
    await consultar(p, '10°00\'18"N 71°01\'25.3"W', 'dedicado'); await esperaResultado(p);
    t = await p.textContent('#hojaFact');
    ok(nombre + ': Dedicado a 1,5 km es Posible excepción', t.includes('Posible excepción') && t.includes('Confirma con ingeniería') && t.includes('1,5 km del borde'), t.slice(0, 200));
    await p.waitForTimeout(350); await p.screenshot({ path: 'capturas/13-' + nombre + '-excepcion.png' });
    await cerrarTodo(p);
    mundo.cortos = { 'https://maps.app.goo.gl/Prueba1': 'https://www.google.com/maps/place/Posada/@10.0,-70.99,15z/data=!3d10.005!4d-70.991' };
    await consultar(p, 'Mira: https://maps.app.goo.gl/Prueba1', 'pyme'); await esperaResultado(p);
    ok(nombre + ': el enlace corto se abre en el servidor y da En espera', (await p.textContent('#hojaFact')).includes('En espera') && mundo.llamadas.some((l) => l[0] === 'resolver'));
    await cerrarTodo(p);
    await consultar(p, 'https://maps.app.goo.gl/NoSirve', 'pyme'); await p.waitForFunction(() => /coordenadas/.test((document.getElementById('eEnlace') || {}).textContent || ''));
    ok(nombre + ': si el enlace corto falla, pide las coordenadas', (await p.textContent('#eEnlace')).includes('copia las coordenadas'));

    // Pegar y, en teléfono, usar mi ubicación
    await p.evaluate(() => { window.__portapapeles = '10.045, -71.005'; });
    await p.click('#faPegar'); await esperaResultado(p);
    ok(nombre + ': Pegar consulta solo', (await p.textContent('#hojaFact')).includes('Planta Externa'));
    await cerrarTodo(p);
    if(tel){
      await p.click('.fa-fab'); await p.waitForSelector('#faUbic'); await p.click('#faUbic'); await esperaResultado(p);
      ok('tel: Usar mi ubicación consulta donde estás', (await p.textContent('#hojaFact')).includes('Aliado Uno'));
      await cerrarTodo(p);
    } else ok('pc: en web no se ofrece Usar mi ubicación', true);

    // Lista y atajos
    await p.waitForSelector('.fa-pro');
    const n = await p.locator('.fa-pro').count();
    ok(nombre + ': la lista trae todas las consultas abiertas', n === (tel ? 6 : 5), n);
    ok(nombre + ': el nombre en la lista sale como texto', (await p.textContent('#faLista')).includes('onerror') && !(await p.evaluate(() => window.__xss)));
    await p.click('[data-filtro="espera"]'); await p.waitForFunction(() => document.querySelectorAll('.fa-pro').length === 1);
    ok(nombre + ': atajo En espera', (await p.textContent('#faLista')).includes('En espera'));
    // Ya lo vendí
    await p.click('[data-filtro="abiertas"]'); await p.waitForFunction((k) => document.querySelectorAll('.fa-pro').length === k, n);
    await p.locator('.fa-pro', { hasText: 'Panadería' }).click(); await esperaResultado(p);
    await p.click('[data-seguir="vendida"]'); await p.waitForSelector('[data-seguir="abierta"]');
    ok(nombre + ': Ya lo vendí la cierra y deja reabrir', (await p.textContent('#hojaFact')).includes('Vendida') && (mundo.bitacora || []).some((b) => b.accion === 'factibilidad_seguimiento'));
    await cerrarTodo(p);
    await p.click('[data-filtro="cerradas"]'); await p.waitForFunction(() => document.querySelectorAll('.fa-pro').length === 1);
    ok(nombre + ': la vendida pasa a Cerradas', (await p.textContent('#faLista')).includes('Vendida'));
    await p.click('[data-filtro="abiertas"]');
    await p.waitForTimeout(300); await p.screenshot({ path: 'capturas/13-' + nombre + '-lista.png' });

    // Mapa nuevo: el diseño se libera y la consulta en espera pasa a Hay red con NUEVO
    subirMapa(mundo, '2026-10-08', true);
    await p.reload(); await p.waitForSelector('.fa-cambio');
    ok(nombre + ': aviso arriba de las que ahora tienen red', (await p.textContent('.fa-cambio')).includes('1 consulta ahora tiene red'));
    await p.click('.fa-cambio [data-filtro="con_red"]'); await p.waitForFunction(() => document.querySelectorAll('.fa-pro').length === 1);
    ok(nombre + ': la consulta sale con NUEVO y el estado anterior tachado', (await p.locator('.fa-pro .fa-nuevo').count()) === 1 && (await p.textContent('.fa-pro s')) === 'En espera');
    await p.waitForTimeout(300); await p.screenshot({ path: 'capturas/13-' + nombre + '-nuevo.png' });
    await p.click('.fa-pro'); await esperaResultado(p);
    ok(nombre + ': al abrirla dice qué cambió', (await p.textContent('#hojaFact')).includes('Cambió con el mapa del') && (await p.textContent('.fa-hist')).includes('Hay red'));
    await p.waitForFunction(() => !document.querySelector('.fa-cambio'));
    ok(nombre + ': al verla deja de ser nueva', mundo.consultas.every((c) => c.visto));
    await cerrarTodo(p);

    // Error de red con Reintentar
    mundo.fallaRpc = 'fact_lista'; await p.evaluate(() => window.Comun.cache.borrarTodo()); await p.goto(H + 'factibilidad.html');
    await p.waitForSelector('#faReintentar'); mundo.fallaRpc = null; await p.click('#faReintentar'); await p.waitForSelector('.fa-pro');
    ok(nombre + ': si falla la lista se puede reintentar', true);
    await p.close();

    // El admin ve las consultas de todos con el nombre del líder
    const o = await contexto(nav, dispositivo, mundo); const q = await entrar(o.ctx, 'marcos', '482913'); q.on('pageerror', (e) => errores.push(e.message));
    await q.goto(H + 'factibilidad.html'); await q.waitForSelector('.fa-pro');
    ok(nombre + ': el admin ve el líder de cada consulta', (await q.textContent('#faLista')).includes('Lucía Ferrer'));
    await o.ctx.close();
    await ctx.close();
  }
  ok('sin errores de JavaScript', errores.length === 0, errores);
  await nav.close(); cerrar();
})().catch((e) => { console.error(e); process.exit(1); });
