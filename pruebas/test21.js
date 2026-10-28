// Fluidez: la navegación está desde el primer cuadro en todos los módulos, aun con la red lenta,
// y cada lista muestra lo último visto mientras llega lo nuevo.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
// En el primer cuadro que se dibuja se anota si ya estaba la navegación y qué había en la lista
const PRIMER_CUADRO = () => {
  requestAnimationFrame(() => {
    const nav = document.querySelector('.navpc a, #navAbajo a, .barra-volver');
    const l = document.getElementById('lista') || document.getElementById('zonaCorte') || document.getElementById('usuarios');
    window.__cuadro = { nav: !!nav, cuenta: !!document.querySelector('#barra .cuenta'), lista: l ? l.innerHTML.length : -1,
      sk: !!document.querySelector('.sk-fila, .sk-tarj, .sk'), vacia: !!(l && !l.textContent.trim() && !l.querySelector('.sk, .sk-fila')) };
  });
};
(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    await ctx.addInitScript(PRIMER_CUADRO);
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    await p.waitForSelector('a.corte');
    mundo.lentoTodo = 1500;
    const sel = nombre === 'tel' ? '#navAbajo' : '.navpc';
    const modulos = nombre === 'tel' ? ['comisiones', 'clientes', 'factibilidad', 'inicio'] : ['comisiones', 'clientes', 'factibilidad', 'trabajo', 'aliados', 'inicio'];
    for(const m of modulos){
      const t0 = Date.now();
      await p.click(sel + ' a[href="' + m + '.html"]'); await p.waitForURL('**/' + m + '.html');
      await p.waitForFunction(() => window.__cuadro);
      const c = await p.evaluate(() => window.__cuadro);
      ok(nombre + ': ' + m + ' tiene la navegación y la cuenta desde el primer cuadro', c.nav && c.cuenta, c);
      ok(nombre + ': ' + m + ' nunca en blanco (esqueleto o lo último visto)', !c.vacia, c);
      ok(nombre + ': ' + m + ' la pestaña marcada sin esperar al servidor', (await p.textContent(sel + ' .on')).trim().length > 0 && Date.now() - t0 < 1400);
      ok(nombre + ': ' + m + ' sin desborde', await sinDesborde(p));
      await p.waitForLoadState('networkidle');
    }
    // Segunda vuelta: Comisiones ya visto se pinta al instante con lo último visto, antes de que responda el servidor
    await p.click(sel + ' a[href="comisiones.html"]'); await p.waitForURL('**/comisiones.html');
    await p.waitForSelector('.grupo', { timeout: 1000 }).catch(() => {});
    ok(nombre + ': Comisiones abre con lo último visto mientras llega lo nuevo', (await p.locator('.grupo').count()) > 0);
    await p.screenshot({ path: 'capturas/21-' + nombre + '-comisiones-lenta.png' });
    await p.waitForLoadState('networkidle');
    ok(nombre + ': y luego se actualiza con el servidor', mundo.llamadas.filter((l) => l[1] === 'comisiones_lista').length >= 2);
    // Usuarios y Actualizar (sin barra de abajo): la barra con Volver desde el primer cuadro
    if(nombre === 'pc'){
      for(const m of ['usuarios', 'actualizar']){
        await p.goto(H + m + '.html'); await p.waitForFunction(() => window.__cuadro);
        const c = await p.evaluate(() => window.__cuadro);
        ok('pc: ' + m + ' con la barra completa desde el primer cuadro', c.nav && c.cuenta, c);
        await p.waitForLoadState('networkidle');
      }
    }
    // Paso entre módulos con fundido corto que respeta reducir movimiento
    const vt = await p.evaluate(() => { const r = []; for(const h of document.styleSheets){ try { for(const x of h.cssRules) r.push(x.cssText); } catch (e) {} } return r.join('\n'); });
    ok(nombre + ': fundido entre páginas declarado y apagado con reducir movimiento', /@view-transition/.test(vt) && /prefers-reduced-motion/.test(vt));
    ok(nombre + ': barra y navegación quedan fijas en el paso', /view-transition-name: ae-barra/.test(vt) && /view-transition-name: ae-nav/.test(vt));

    // Si el perfil cambió en el servidor (otro rol), se corrige solo
    mundo.lentoTodo = 0;
    mundo.personas[0].cargo = 'Jefe de contratos';
    await p.goto(H + 'clientes.html'); await p.waitForFunction(() => document.querySelector('#barra .cuenta small') && document.querySelector('#barra .cuenta small').textContent === 'Jefe de contratos', null, { timeout: 5000 }).catch(() => {});
    ok(nombre + ': un cambio del perfil en el servidor se corrige solo', (await p.textContent('#barra .cuenta small')) === 'Jefe de contratos');
    await ctx.close();
    // Sesión que ya no vale: sale como hoy y limpia el dispositivo (en una sesión nueva, con lo último visto guardado)
    const z = await contexto(nav, dispositivo); const q = await entrar(z.ctx, 'marcos', '482913'); q.on('pageerror', (e) => errores.push(e.message));
    await q.goto(H + 'comisiones.html'); await q.waitForSelector('.grupo'); await q.waitForLoadState('networkidle');
    z.mundo.personas[0].activo = false;
    // Se mide que la app pida la entrada (el servidor de pruebas a veces tarda en servirla)
    const sale = q.waitForRequest((r) => /\/index\.html/.test(r.url()) && r.isNavigationRequest(), { timeout: 10000 }).then(() => true).catch(() => false);
    await q.goto(H + 'comisiones.html');
    ok(nombre + ': sesión que no vale sale a la entrada', await sale);
    await q.waitForURL('**/index.html', { timeout: 30000 }).catch(() => {}); await q.waitForLoadState('networkidle');
    ok(nombre + ': al salir no queda el perfil ni lo último visto', await q.evaluate(() => !localStorage.getItem('ae_perfil') && !Object.keys(localStorage).some((k) => k.indexOf('ae_c_') === 0)));
    await z.ctx.close();
  }
  // El service worker: páginas desde el dispositivo solo si todos sus archivos están guardados
  global.self = { addEventListener(){}, location: { origin: 'https://x' } };
  const sw = require('../sw.js');
  const v = sw.versionados('<link href="assets/css/app.css?v=27"><script src="assets/js/comun.js?v=27"></script><script src="https://cdn/x.js"></script>', 'https://x/A/comisiones.html?c=1');
  ok('sw: reconoce los archivos con versión de una página', v.length === 2 && v[0] === 'https://x/A/assets/css/app.css?v=27');
  ok('sw: la página se guarda sin la búsqueda', sw.clavePagina(new URL('https://x/A/clientes.html?c=3')) === 'https://x/A/clientes.html');
  ok('sw: solo guarda archivos con versión', sw.esArchivo(new URL('https://x/A/assets/js/a.js?v=2')) && !sw.esArchivo(new URL('https://x/A/assets/js/a.js')));
  ok('sin errores de la página', errores.length === 0, errores);
  await nav.close(); cerrar();
})();
