// Usuarios (solo administrador): lista, crear, editar, restablecer PIN, desactivar y permisos.
const { chromium, H, TEL, PC, contexto, marcador, pin, sinDesborde } = require('./simulador');
const { ok, cerrar } = marcador();
async function entrar(ctx, usuario, clave){
  const p = await ctx.newPage();
  await p.goto(H + 'index.html'); await p.waitForSelector('#pasoEquipo:not(.hidden)');
  await p.click('[data-equipo="ventas"]'); await p.fill('#usuario', usuario); await p.click('#seguir');
  const pc = await p.evaluate(() => window.matchMedia('(min-width:900px)').matches);
  await pin(p, clave, pc); await p.waitForURL('**/inicio.html');
  return p;
}
(async () => {
  const nav = await chromium.launch();
  const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    // Un nombre con código dentro: debe verse como texto, nunca ejecutarse
    mundo.personas[1].nombre = 'Lucía <img src=x onerror="window.__xss=1">';
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    await p.click('a.acceso[data-modulo="usuarios"]'); await p.waitForURL('**/usuarios.html');
    await p.waitForSelector('.persona');
    ok(nombre + ': lista a las 4 personas', (await p.locator('.persona').count()) === 4);
    ok(nombre + ': resumen de accesos', (await p.textContent('#resumen')) === '3 con acceso, 1 sin acceso');
    ok(nombre + ': estados por color', (await p.locator('.chip-ok').count()) === 2 && (await p.locator('.chip-warn').count()) === 1 && (await p.locator('.chip-off').count()) === 1);
    ok(nombre + ': el texto de la base no se ejecuta', (await p.evaluate(() => window.__xss)) === undefined && (await p.locator('.persona img').count()) === 0);
    ok(nombre + ': sin desborde horizontal', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/02-' + nombre + '-lista.png', fullPage: true });

    await p.click('#nuevo'); await p.waitForSelector('#hojaUsuario.ver');
    await p.click('#guardar');
    ok(nombre + ': crear vacío marca cada campo', (await p.textContent('#eNombre')) === 'Escribe el nombre' && (await p.textContent('#eUsuarioF')).includes('usuario') && (await p.textContent('#ePin')).includes('6 números'));
    ok(nombre + ': no llama al servidor con errores', !mundo.llamadas.some((l) => l[0] === 'usuarios' && l[1].accion === 'crear'));
    await p.fill('#fNombre', 'Andrés Peña'); await p.fill('#fUsuario', 'Andrés Peña'); await p.locator('#fUsuario').blur();
    ok(nombre + ': el usuario se limpia solo', (await p.inputValue('#fUsuario')) === 'andrespena');
    await p.fill('#fCargo', 'Analista de canales'); await p.selectOption('#fRol', 'analista'); await p.fill('#fCodigo', '3');
    await p.fill('#fPin', '123456'); await p.click('#guardar');
    ok(nombre + ': PIN fácil rechazado', (await p.textContent('#ePin')).includes('muy fácil'));
    await p.click('#generar');
    const generado = await p.inputValue('#fPin');
    ok(nombre + ': Generar da 6 números', /^\d{6}$/.test(generado) && generado !== '123456');
    await p.screenshot({ path: 'capturas/02-' + nombre + '-nuevo.png' });
    ok(nombre + ': hoja cerrada no recibe foco', await p.evaluate(() => document.getElementById('hojaCuenta') === null && document.getElementById('hojaUsuario').inert === false && document.querySelector('main').inert === true));
    await p.click('#guardar');
    await p.waitForFunction(() => document.querySelectorAll('.persona').length === 5);
    const creado = mundo.llamadas.find((l) => l[0] === 'usuarios' && l[1].accion === 'crear');
    ok(nombre + ': se crea con los datos correctos', creado && creado[1].usuario === 'andrespena' && creado[1].rol === 'analista' && creado[1].codigo_vendedor === 3 && creado[1].pin === generado);
    ok(nombre + ': al crear muestra el PIN temporal una vez', (await p.textContent('#pinNuevo')) === generado && (await p.textContent('#pinDe')) === 'Usuario: andrespena' && !(await p.locator('#form').isVisible()));
    await p.screenshot({ path: 'capturas/02-' + nombre + '-creado.png' });
    await p.locator('#zonaListo button').click(); await p.waitForFunction(() => !document.querySelector('#hojaUsuario.ver'));
    ok(nombre + ': hoja cerrada queda sin foco y el fondo vuelve', await p.evaluate(() => document.getElementById('hojaUsuario').inert === true && document.querySelector('main').inert === false));

    await p.locator('.persona').filter({ hasText: 'Pedro Salas' }).click(); await p.waitForSelector('#hojaUsuario.ver');
    ok(nombre + ': al editar no se cambia el usuario ni se pide PIN', await p.locator('#fUsuario').isDisabled() && !(await p.locator('#zonaPin').isVisible()));
    await p.fill('#fCargo', 'Analista senior'); await p.click('#guardar'); await p.waitForFunction(() => !document.querySelector('#hojaUsuario.ver'));
    ok(nombre + ': editar guarda el cambio', mundo.personas[2].cargo === 'Analista senior');
    await p.locator('.persona').filter({ hasText: 'Pedro Salas' }).click(); await p.waitForSelector('#hojaUsuario.ver');
    await p.click('#restablecer');
    ok(nombre + ': Restablecer pide confirmar', (await p.textContent('#restablecer')).includes('Seguro') && !mundo.llamadas.some((l) => l[0] === 'usuarios' && l[1].accion === 'pin'));
    await p.click('#restablecer'); await p.waitForSelector('#pinListo:not(.hidden)');
    const nuevo = await p.textContent('#pinNuevo');
    ok(nombre + ': Restablecer muestra el PIN nuevo una vez', /^\d{6}$/.test(nuevo) && mundo.personas[2].pin === nuevo && mundo.personas[2].debe_cambiar_pin === true);
    await p.click('#alternar');
    ok(nombre + ': Desactivar pide confirmar', mundo.personas[2].activo === true);
    await p.click('#alternar'); await p.waitForFunction(() => !document.querySelector('#hojaUsuario.ver'));
    ok(nombre + ': Desactivar quita el acceso', mundo.personas[2].activo === false);
    await p.locator('.persona').filter({ hasText: 'Marcos Rivas' }).click(); await p.waitForSelector('#hojaUsuario.ver');
    ok(nombre + ': no puedes desactivarte a ti mismo', !(await p.locator('#alternar').isVisible()));
    await p.keyboard.press('Escape');
    await ctx.close();
  }

  // Un líder no entra a Usuarios aunque escriba la dirección
  const { ctx, mundo } = await contexto(nav, TEL);
  const p = await entrar(ctx, 'lucia', '739105'); p.on('pageerror', (e) => errores.push(e.message));
  await p.waitForSelector('[data-modulo="instalaciones"]');
  ok('líder: no ve el acceso a Usuarios', (await p.locator('[data-modulo="usuarios"]').count()) === 0 && (await p.locator('[data-modulo="actualizar"]').count()) === 0);
  await p.goto(H + 'usuarios.html'); await p.waitForURL('**/inicio.html');
  ok('líder: Usuarios lo devuelve a Inicio', !mundo.llamadas.some((l) => l[0] === 'usuarios'));
  await ctx.close();

  ok('sin errores de JavaScript', errores.length === 0, errores);
  await nav.close();
  cerrar();
})().catch((e) => { console.error(e); process.exit(1); });
