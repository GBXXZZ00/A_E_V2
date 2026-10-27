// Corrida 23/10: modo práctica. Una cuenta "prueba." entra al mundo de práctica que corre en el navegador:
// pide cambiar el PIN temporal, muestra la banda y la guía, el aliado pide un cliente del líder y al líder le llega el aviso,
// el administrador manda un aviso de práctica y reinicia. Lo más importante: con el modo encendido NADA llega al servidor real.
const { chromium, H, TEL, PC, marcador, sinDesborde, pin } = require('./simulador');
const { armar } = require('./armar-practica');
const fs = require('fs');
const { ok, cerrar } = marcador();

(async () => {
  ok('el mundo de práctica está armado con el mundo de las pruebas al día', fs.readFileSync(__dirname + '/../assets/js/practica-mundo.js', 'utf8') === armar());
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, disp] of [['tel', TEL], ['pc', PC]]){
    const ctx = await nav.newContext(Object.assign({}, disp));
    // El "servidor real": cualquier llamada que llegue aquí es una falla
    const reales = []; await ctx.route('**/*.supabase.co/**', (r) => { reales.push(r.request().url()); return r.fulfill({ status: 500, body: '{}' }); });
    await ctx.route('https://cdn.jsdelivr.net/npm/chart.js@4.4.1/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(__dirname + '/vendor/chart/chart.umd.min.js') }));
    const p = await ctx.newPage(); p.on('pageerror', (e) => { if(!/Transition was aborted because of invalid state/.test(e.message)) errores.push(e.message); });   // aviso de Chromium al encadenar navegaciones, no es de la app
    const pc = nombre === 'pc';
    const entrarComo = async (u, clave) => {
      // Como un teléfono que entra con otra cuenta: se olvida el usuario recordado, pero se queda el mundo de práctica
      await p.goto(H + 'index.html'); await p.evaluate(() => Object.keys(localStorage).filter((k) => k !== 'ae_practica_estado').forEach((k) => localStorage.removeItem(k)));
      await p.goto(H + 'index.html'); await p.waitForSelector('#pasoEquipo:not(.hidden)');
      await p.click('[data-equipo="' + (u === 'pruebaaliado' ? 'aliados' : 'ventas') + '"]'); await p.fill('#usuario', u); await p.click('#seguir');
      await pin(p, clave || '583014', pc);
    };
    await entrarComo('pruebalider');
    await p.waitForFunction(() => /Crea tu PIN nuevo/.test(document.body.textContent), null, { timeout: 8000 });
    ok(nombre + ': el PIN temporal obliga a cambiarlo', /nuevo|cambia/i.test(await p.textContent('body')));
    await pin(p, '271828', pc); await p.waitForTimeout(300); await pin(p, '271828', pc);
    await p.waitForURL('**/inicio.html', { timeout: 10000 });
    await p.waitForSelector('#prBanda');
    ok(nombre + ': la banda dice que es práctica', /Modo práctica/.test(await p.textContent('#prBanda')));
    await p.click('[data-pr="guia"]'); await p.waitForSelector('#hojaPrGuia.ver .pr-pasos li');
    ok(nombre + ': la guía trae los pasos del líder', /campana/.test(await p.textContent('#hojaPrGuia')));
    await p.keyboard.press('Escape');
    await p.goto(H + 'clientes.html'); await p.waitForSelector('#lista .cli, #lista [data-cli], #lista button', { timeout: 10000 });
    await p.locator('#lista button.cli, #lista [data-cli]').first().click(); await p.waitForSelector('#hojaFicha.ver .pr-caja');
    ok(nombre + ': el expediente de práctica trae su recuadro de instrucciones', /Caso de práctica/.test(await p.textContent('#hojaFicha .pr-caja')));
    if(nombre === 'tel') await p.screenshot({ path: 'capturas/48-tel-ficha-practica.png' });
    await p.keyboard.press('Escape'); await p.waitForTimeout(350);
    await p.click('[data-pr="salir"]'); await p.waitForURL('**/index.html');
    ok(nombre + ': al salir apaga el modo', await p.evaluate(() => localStorage.getItem('ae_practica')) === null);
    // El administrador manda un aviso de práctica a los líderes
    await entrarComo('pruebaadmin'); await p.waitForFunction(() => /Crea tu PIN nuevo/.test(document.body.textContent));
    await pin(p, '314159', pc); await p.waitForTimeout(300); await pin(p, '314159', pc); await p.waitForURL('**/inicio.html');
    await p.waitForSelector('#prBanda [data-pr="admin"]:not(.hidden)', { timeout: 5000 });
    await p.click('[data-pr="admin"]'); await p.waitForSelector('#hojaPrAdmin.ver #prTexto');
    await p.selectOption('#prPara', 'lider'); await p.fill('#prTexto', 'Revisa tus expedientes de práctica');
    await p.click('#prAviso [type="submit"]'); await p.waitForTimeout(400);
    if(pc) await p.screenshot({ path: 'capturas/48-pc-admin-practica.png' });
    await p.keyboard.press('Escape'); await p.waitForTimeout(350);
    await p.click('[data-pr="salir"]'); await p.waitForURL('**/index.html');
    await entrarComo('pruebalider', '271828'); await p.waitForURL('**/inicio.html');
    await p.waitForSelector('#campana .nbadge:not(.hidden)'); await p.click('#campana'); await p.waitForSelector('#hojaAvisos.ver');
    await p.waitForTimeout(500);
    ok(nombre + ': al líder le llega el aviso de práctica del administrador', /Revisa tus expedientes de práctica/.test(await p.textContent('#hojaAvisos')), [(await p.textContent('#hojaAvisos')).slice(0, 300), await p.evaluate(() => (JSON.parse(localStorage.getItem('ae_practica_estado')).datos.avisos || []).slice(0, 3).map((a) => a.para + ':' + a.titulo))]);
    ok(nombre + ': sin desborde', await sinDesborde(p));
    ok(nombre + ': NADA llegó al servidor real', reales.length === 0, reales.slice(0, 3));
    await ctx.close();
  }
  ok('sin errores de la página', errores.length === 0, errores);
  await nav.close(); cerrar();
})();
