// Acceso: equipo solo la primera vez, usuario recordado, PIN, cambio de PIN temporal y errores.
const { chromium, H, TEL, PC, contexto, marcador, pin, sinDesborde } = require('./simulador');
const { ok, cerrar } = marcador();
const visible = (p, id) => p.locator('#' + id).isVisible();
(async () => {
  const nav = await chromium.launch();
  const errores = [];

  // ---------- Teléfono ----------
  let { ctx, mundo } = await contexto(nav, TEL);
  let p = await ctx.newPage(); p.on('pageerror', (e) => errores.push(e.message));
  await p.goto(H + 'index.html'); await p.waitForSelector('#pasoEquipo:not(.hidden)');
  ok('primera vez: pregunta el equipo', await visible(p, 'pasoEquipo') && !(await visible(p, 'pasoUsuario')) && !(await visible(p, 'pasoPin')));
  ok('teléfono: sin desborde horizontal', await sinDesborde(p));
  await p.screenshot({ path: 'capturas/01-tel-equipo.png' });
  await p.click('[data-equipo="ventas"]');
  ok('pasa a usuario con el equipo elegido', await visible(p, 'pasoUsuario') && (await p.textContent('#chipUsuario')) === 'Ventas corporativas');
  ok('el equipo queda recordado', (await p.evaluate(() => localStorage.getItem('ae_equipo'))) === 'ventas');
  await p.click('#seguir');
  ok('usuario vacío: error debajo del campo', (await p.textContent('#eUsuario')) === 'Escribe tu usuario');
  await p.fill('#usuario', ' Marcos ');
  await p.click('#seguir');
  ok('PIN: saluda con mayúscula', (await p.textContent('#tPin')) === 'Hola, Marcos');
  ok('PIN: antes de entrar no muestra el cargo', !(await visible(p, 'cargo')));
  ok('teléfono: teclado en pantalla, sin casillas', await p.locator('#teclado').isVisible() && !(await p.locator('.zona-casillas').isVisible()));
  await pin(p, '111222');
  await p.waitForFunction(() => document.getElementById('estadoPin').textContent.includes('incorrecto'));
  ok('PIN errado: mensaje claro y se limpia', (await p.locator('#puntos i.on').count()) === 0);
  await p.screenshot({ path: 'capturas/01-tel-pin-error.png' });
  await pin(p, '482913');
  await p.waitForURL('**/inicio.html');
  await p.waitForFunction(() => document.getElementById('saludo').textContent.includes('Marcos'));
  ok('PIN correcto: entra a Inicio', true);
  ok('admin ve Usuarios encendido', await p.locator('a.acceso[data-modulo="usuarios"]').isVisible());
  ok('módulos por construir no son enlaces', (await p.locator('a.acceso[data-modulo="instalaciones"]').count()) === 0 && await p.locator('[data-modulo="instalaciones"]').isVisible());
  ok('Inicio: sin desborde horizontal', await sinDesborde(p));
  await p.screenshot({ path: 'capturas/01-tel-inicio.png', fullPage: true });
  await p.click('#cuenta'); await p.waitForSelector('#hojaCuenta.ver');
  ok('Mi cuenta muestra cargo y equipo', (await p.textContent('#dCargo')) === 'Administrador de contratos' && (await p.textContent('#dEquipo')) === 'Ventas corporativas');
  await p.screenshot({ path: 'capturas/01-tel-cuenta.png' });

  // Otra pestaña: la sesión no se hereda, pero el usuario y el equipo sí se recuerdan
  let p2 = await ctx.newPage(); p2.on('pageerror', (e) => errores.push(e.message));
  await p2.goto(H + 'index.html'); await p2.waitForSelector('#pasoPin:not(.hidden)');
  ok('al volver abre directo en el PIN', (await p2.textContent('#tPin')) === 'Hola, Marcos');
  ok('al volver muestra el cargo', (await p2.textContent('#cargo')) === 'Administrador de contratos' && await visible(p2, 'cargo'));
  await p2.screenshot({ path: 'capturas/01-tel-pin.png' });
  ok('el PIN nunca se guarda en el dispositivo', await p2.evaluate(() => !JSON.stringify(Object.assign({}, localStorage)).includes('482913')));
  await p2.click('#enlacePie');
  ok('"Entrar con otro usuario" olvida el usuario', await visible(p2, 'pasoUsuario') && (await p2.evaluate(() => localStorage.getItem('ae_usuario'))) === null);

  // PIN temporal: obliga a crear uno nuevo
  await p2.fill('#usuario', 'pedro'); await p2.click('#seguir'); await pin(p2, '204871');
  await p2.waitForFunction(() => document.getElementById('tPin').textContent === 'Crea tu PIN nuevo');
  ok('PIN temporal: pide crear uno nuevo', true);
  await pin(p2, '111111');
  ok('PIN fácil rechazado', (await p2.textContent('#estadoPin')).includes('muy fácil'));
  await pin(p2, '640278'); await p2.waitForFunction(() => document.getElementById('tPin').textContent === 'Repite tu PIN nuevo');
  await pin(p2, '640279');
  ok('PIN repetido distinto: empieza de nuevo', (await p2.textContent('#estadoPin')).includes('No coinciden') && (await p2.textContent('#tPin')) === 'Crea tu PIN nuevo');
  await pin(p2, '640278'); await p2.waitForFunction(() => document.getElementById('tPin').textContent === 'Repite tu PIN nuevo'); await pin(p2, '640278');
  await p2.waitForURL('**/inicio.html');
  ok('PIN nuevo guardado y avisado al servidor', mundo.llamadas.some((l) => l[0] === 'pin' && l[2] === '640278') && mundo.llamadas.some((l) => l[0] === 'pin_cambiado'));
  await p2.waitForSelector('[data-modulo="actualizar"]');
  ok('analista no ve Usuarios', (await p2.locator('[data-modulo="usuarios"]').count()) === 0);
  await ctx.close();

  // Equipo que no corresponde, cuenta desactivada, sin sesión y sin internet
  ({ ctx, mundo } = await contexto(nav, TEL));
  p = await ctx.newPage(); p.on('pageerror', (e) => errores.push(e.message));
  await p.goto(H + 'inicio.html'); await p.waitForURL('**/index.html');
  ok('sin sesión, Inicio devuelve al acceso', true);
  await p.goto(H + 'usuarios.html'); await p.waitForURL('**/index.html');
  ok('sin sesión, Usuarios devuelve al acceso', true);
  await p.waitForSelector('#pasoEquipo:not(.hidden)');
  await p.click('[data-equipo="aliados"]'); await p.fill('#usuario', 'lucia'); await p.click('#seguir'); await pin(p, '739105');
  await p.waitForFunction(() => document.getElementById('estadoPin').textContent.includes('Ventas corporativas'));
  ok('equipo que no corresponde: no entra y dice por dónde', (await p.evaluate(() => sessionStorage.length)) === 0 || !(await p.evaluate(() => JSON.stringify(Object.assign({}, sessionStorage)).includes('access_token'))));
  await p.click('#enlacePie'); await p.click('#enlacePie'); await p.waitForSelector('#pasoEquipo:not(.hidden)');
  await p.click('[data-equipo="ventas"]'); await p.fill('#usuario', 'baja'); await p.click('#seguir'); await pin(p, '918273');
  await p.waitForFunction(() => document.getElementById('estadoPin').textContent.includes('desactivada'));
  ok('cuenta desactivada: mensaje claro', true);
  mundo.sinRed = true;
  await pin(p, '918273');
  await p.waitForFunction(() => document.getElementById('estadoPin').textContent.includes('Sin conexión'));
  ok('sin internet: mensaje claro', true);
  await ctx.close();

  // Aliados: el admin entra y ve el aviso de módulo en construcción
  ({ ctx, mundo } = await contexto(nav, TEL));
  p = await ctx.newPage(); p.on('pageerror', (e) => errores.push(e.message));
  await p.goto(H + 'index.html'); await p.click('[data-equipo="aliados"]'); await p.fill('#usuario', 'marcos'); await p.click('#seguir'); await pin(p, '482913');
  await p.waitForURL('**/inicio.html'); await p.waitForSelector('.aviso');
  ok('equipo aliados: aviso de en construcción, sin módulos de ventas', (await p.locator('.acceso').count()) === 0);
  await ctx.close();

  // ---------- Escritorio ----------
  ({ ctx, mundo } = await contexto(nav, PC));
  p = await ctx.newPage(); p.on('pageerror', (e) => errores.push(e.message));
  await p.goto(H + 'index.html'); await p.waitForSelector('#pasoEquipo:not(.hidden)');
  ok('escritorio: panel lateral visible', await p.locator('.lado').isVisible() && (await p.textContent('.lado h2')) === 'Todo el cliente corporativo en un solo lugar');
  await p.screenshot({ path: 'capturas/01-pc-equipo.png' });
  await p.click('[data-equipo="ventas"]'); await p.keyboard.type('marcos'); await p.keyboard.press('Enter');
  await p.waitForSelector('#pasoPin:not(.hidden)');
  ok('escritorio: casillas, sin teclado en pantalla', await p.locator('.casillas').isVisible() && !(await p.locator('#teclado').isVisible()));
  await p.keyboard.type('4829', { delay: 15 });
  ok('escritorio: se escribe con el teclado sin tocar nada', (await p.locator('#casillas i.on').count()) === 4);
  await p.screenshot({ path: 'capturas/01-pc-pin.png' });
  await p.keyboard.type('13', { delay: 15 });
  await p.waitForURL('**/inicio.html'); await p.waitForSelector('[data-modulo="usuarios"]');
  ok('escritorio: entra a Inicio', await sinDesborde(p));
  await p.screenshot({ path: 'capturas/01-pc-inicio.png' });
  await p.goto(H + 'index.html#cambiar'); await p.waitForFunction(() => document.getElementById('tPin').textContent === 'Tu PIN actual');
  ok('Cambiar PIN desde Inicio pide primero el PIN actual', (await p.textContent('#enlacePie')) === 'Volver al inicio');
  await pin(p, '000111', true);
  await p.waitForFunction(() => document.getElementById('estadoPin').textContent.includes('no es tu PIN actual'));
  ok('PIN actual errado: no deja cambiarlo', (await p.textContent('#tPin')) === 'Tu PIN actual');
  await pin(p, '482913', true); await p.waitForFunction(() => document.getElementById('tPin').textContent === 'Nuevo PIN');
  await pin(p, '482913', true);
  ok('no acepta el mismo PIN actual', (await p.textContent('#estadoPin')).includes('ya es tu PIN'));
  await pin(p, '905317', true); await p.waitForFunction(() => document.getElementById('tPin').textContent === 'Repite tu PIN nuevo'); await pin(p, '905317', true);
  await p.waitForURL('**/inicio.html');
  ok('PIN nuevo guardado desde Inicio', mundo.personas[0].pin === '905317');

  // Un corte de internet dentro de la app no cierra la sesión
  mundo.sinRed = true;
  await p.goto(H + 'usuarios.html'); await p.waitForSelector('#reintentarSesion');
  ok('sin internet dentro de la app: avisa y no cierra la sesión', (await p.evaluate(() => JSON.stringify(Object.assign({}, sessionStorage)).includes('access_token'))));
  mundo.sinRed = false;
  await p.click('#reintentarSesion'); await p.waitForSelector('.persona');
  ok('Reintentar vuelve a cargar', true);
  await ctx.close();

  // Si el PIN es bueno pero el perfil no carga, no queda una sesión a medias
  ({ ctx, mundo } = await contexto(nav, TEL));
  p = await ctx.newPage(); p.on('pageerror', (e) => errores.push(e.message));
  mundo.fallaPerfil = true;
  await p.goto(H + 'index.html'); await p.click('[data-equipo="ventas"]'); await p.fill('#usuario', 'marcos'); await p.click('#seguir'); await pin(p, '482913');
  await p.waitForFunction(() => document.getElementById('estadoPin').textContent.includes('No se pudo entrar'));
  ok('perfil que no carga: no deja sesión abierta', !(await p.evaluate(() => JSON.stringify(Object.assign({}, sessionStorage)).includes('access_token'))));
  ok('el enlace del pie mide al menos 44 px', (await p.locator('#enlacePie').boundingBox()).height >= 44);
  await ctx.close();

  ok('sin errores de JavaScript', errores.length === 0, errores);
  await nav.close();
  cerrar();
})().catch((e) => { console.error(e); process.exit(1); });
