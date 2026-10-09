// Factibilidad paso 5: entrar desde WhatsApp. Compartir en Android (share_target), retomar tras entrar con PIN, ayuda de una sola vez y Pegar en iPhone.
const fs = require('fs');
const { chromium, H, TEL, contexto, marcador, sinDesborde, entrar, pin } = require('./simulador');
const { RPC } = require('./mundo');
const { ok, cerrar } = marcador();
const cuadro = (m, e, x, a, lng0, lat0, lng1, lat1) => ({ m, n: m, e, x, a, c: '100', ci: 'Ciudad Prueba', lng: [lng0, lng1, lng1, lng0], lat: [lat0, lat0, lat1, lat1] });
function subirMapa(mundo){
  const adm = mundo.personas[0];
  const id = RPC.mapa_iniciar(mundo, adm, { p_fecha: '2026-10-01', p_archivo: 'mapa.kmz', p_poligonos: 2, p_puntos: 0 });
  RPC.mapa_zonas(mundo, adm, { p_mapa: id, p_filas: [cuadro('A-LIB', 'liberado', 'liberada', null, -71.010, 10.000, -71.000, 10.010), cuadro('D-DIS', 'diseno', 'liberada', null, -70.997, 10.000, -70.990, 10.010)] });
  RPC.mapa_cerrar(mundo, adm, { p_mapa: id });
}
const ANDROID = Object.assign({}, TEL, { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36' });
(async () => {
  const nav = await chromium.launch(); const errores = [];
  const man = JSON.parse(fs.readFileSync(__dirname + '/../manifest.json', 'utf8'));
  ok('el manifiesto ofrece la app en Compartir', man.share_target && man.share_target.action === 'factibilidad.html' && man.share_target.method === 'GET' && man.share_target.params.text === 'texto' && man.share_target.params.url === 'enlace');

  // Android: compartir con la sesión abierta
  { const { ctx, mundo } = await contexto(nav, ANDROID); subirMapa(mundo);
    mundo.cortos = { 'https://maps.app.goo.gl/Prueba1': 'https://www.google.com/maps/place/x/@10.0,-71.0,15z/data=!3d10.005!4d-71.005' };
    const p = await entrar(ctx, 'lucia', '739105'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'factibilidad.html?titulo=Panaderia&texto=' + encodeURIComponent('Te paso la ubicación https://maps.app.goo.gl/Prueba1'));
    await p.waitForSelector('#hojaFact.ver #faEnlace');
    ok('android: lo compartido abre la consulta con el enlace puesto', (await p.inputValue('#faEnlace')).includes('https://maps.app.goo.gl/Prueba1') && (await p.textContent('#faAyuda')).includes('Llegó desde WhatsApp'));
    ok('android: la dirección queda limpia', !p.url().includes('texto='));
    await p.click('#faConsultar'); await p.waitForSelector('#hojaFact .fa-veredicto');
    ok('android: un toque y sale el resultado', (await p.textContent('#hojaFact')).includes('Hay red'));
    await p.keyboard.press('Escape'); await p.waitForFunction(() => !window.Comun.hojaAbierta());
    ok('android: sin instalar, la ayuda explica instalar una vez', (await p.textContent('#faAyudaApp')).includes('Instala la app una sola vez'));
    ok('android: la ayuda no desborda', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/14-android-ayuda.png' });
    await p.click('#faAyudaOk'); await p.reload(); await p.waitForSelector('#faFecha b');
    ok('android: Entendido no la vuelve a mostrar', (await p.textContent('#faAyudaApp')) === '');
    await ctx.close(); }

  // Android: compartir sin sesión. Pide el PIN y retoma la consulta.
  { const { ctx, mundo } = await contexto(nav, ANDROID); subirMapa(mundo);
    const p0 = await entrar(ctx, 'lucia', '739105'); await p0.evaluate(() => window.db.auth.signOut()); await p0.close();
    const p = await ctx.newPage(); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'factibilidad.html?texto=' + encodeURIComponent('10.005, -70.991')); await p.waitForURL('**/index.html**');
    await p.waitForSelector('#pasoPin:not(.hidden), #pasoUsuario:not(.hidden)');
    if(await p.locator('#pasoUsuario:not(.hidden)').count()){ await p.fill('#usuario', 'lucia'); await p.click('#seguir'); }
    await pin(p, '739105', false);
    await p.waitForURL('**/factibilidad.html'); await p.waitForSelector('#hojaFact.ver #faEnlace');
    ok('sin sesión: después del PIN sigue con lo compartido', (await p.inputValue('#faEnlace')) === '10.005, -70.991');
    await p.click('#faConsultar'); await p.waitForSelector('#hojaFact .fa-veredicto');
    ok('sin sesión: la consulta sale En espera', (await p.textContent('#hojaFact')).includes('En espera'));
    await ctx.close(); }

  // iPhone: copiar en WhatsApp y Pegar aquí
  { const { ctx, mundo } = await contexto(nav, TEL); subirMapa(mundo);
    await ctx.addInitScript(() => { try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.resolve(), readText: () => Promise.resolve('Ubicación: https://maps.google.com/?q=10.005,-71.005') }, configurable: true }); } catch (e) {} });
    const p = await entrar(ctx, 'lucia', '739105'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'factibilidad.html'); await p.waitForSelector('#faPegarAyuda');
    ok('iphone: la ayuda explica copiar y pegar', (await p.textContent('#faAyudaApp')).includes('toca Copiar'));
    await p.screenshot({ path: 'capturas/14-iphone-ayuda.png' });
    await p.click('#faPegarAyuda'); await p.waitForSelector('#hojaFact .fa-veredicto');
    ok('iphone: Pegar consulta sola', (await p.textContent('#hojaFact')).includes('Hay red'));
    await p.keyboard.press('Escape'); await p.waitForFunction(() => !window.Comun.hojaAbierta());
    await p.click('.fa-fab'); await p.waitForSelector('#hojaFact.ver #faEnlace');
    ok('iphone: la consulta nueva explica cómo pegar, sin botón Pegar', (await p.textContent('#faAyuda')).includes('mantén presionado el campo y toca Pegar') && (await p.locator('#faPegar').count()) === 0);
    await ctx.close(); }

  // En la computadora no sale la ayuda de teléfono
  { const { PC } = require('./simulador'); const { ctx, mundo } = await contexto(nav, PC); subirMapa(mundo);
    const p = await entrar(ctx, 'lucia', '739105'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'factibilidad.html'); await p.waitForSelector('#faFecha b');
    ok('pc: sin ayuda de compartir', (await p.textContent('#faAyudaApp')) === '');
    await ctx.close(); }

  ok('sin errores de JavaScript', errores.length === 0, errores);
  await nav.close(); cerrar();
})().catch((e) => { console.error(e); process.exit(1); });
