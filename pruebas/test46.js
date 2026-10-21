// Lote S: seguridad. La política de seguridad (CSP) no bloquea nada en ninguna página; la sesión queda en el dispositivo
// y se cierra tras las horas sin uso (ajuste del administrador); si el administrador la cierra, la app sale sola;
// después del PIN se vuelve a la página donde iba; no se cierra con subidas en curso.
const { chromium, H, TEL, PC, contexto, marcador, pin, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
const llamo = (m, f) => m.llamadas.filter((l) => l[1] === f);
const PAGINAS = ['inicio', 'trabajo', 'clientes', 'comisiones', 'migraciones', 'factibilidad', 'aliados', 'gerencia', 'revision', 'usuarios', 'actualizar', 'privacidad'];

(async () => {
  const nav = await chromium.launch(); const errores = [];
  // ---------- CSP: ninguna página tiene bloqueos ni errores en consola ----------
  {
    const { ctx } = await contexto(nav, PC);
    const p = await entrar(ctx, 'marcos', '482913'); const csp = [];
    p.on('console', (m) => { if(m.type() === 'error' && /Content Security Policy|Refused to/i.test(m.text())) csp.push(m.text().slice(0, 160)); });
    p.on('pageerror', (e) => errores.push(e.message));
    await p.exposeFunction('anotarCsp', (t) => csp.push(t));
    await p.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => window.anotarCsp(e.violatedDirective + ' ' + e.blockedURI)));
    for(const pag of PAGINAS){ await p.goto(H + pag + '.html'); await p.waitForTimeout(900); }
    await p.goto(H + 'cliente.html?id=1'); await p.waitForURL(/clientes\.html/);
    ok('los enlaces viejos siguen llevando a Clientes (sin código dentro del HTML)', true);
    await p.goto(H + 'inicio.html'); await p.goto(H + 'dedicados.html'); await p.waitForURL(/clientes\.html/);
    ok('la CSP no bloquea nada en ' + PAGINAS.length + ' páginas', csp.length === 0, csp.slice(0, 4));
    // Ajuste de horas sin uso (administrador)
    await p.goto(H + 'inicio.html'); await p.click('#cuenta'); await p.waitForSelector('#hojaCuenta.ver [data-inact]');
    ok('la hoja de cuenta muestra el cierre por falta de uso', /12 horas/.test(await p.textContent('#hojaCuenta [data-inact]')));
    await p.click('#hojaCuenta [data-inact]'); await p.waitForSelector('#hojaInact.ver #inactHoras');
    await p.fill('#inactHoras', '90'); await p.click('[data-inact-guardar]');
    ok('fuera de 1 a 72 avisa debajo del campo', /entre 1 y 72/.test(await p.textContent('#eInact')));
    await p.fill('#inactHoras', '8'); await p.click('[data-inact-guardar]'); await p.waitForSelector('#hojaInact:not(.ver)');
    ok('guardar 8 horas queda en el dispositivo', (await p.evaluate(() => localStorage.getItem('ae_inactividad_h'))) === '8');
    // Algo escrito sin guardar en una hoja abierta: no se cierra aunque se venza
    await p.click('#hojaCuenta [data-inact]'); await p.waitForSelector('#hojaInact.ver #inactHoras'); await p.fill('#inactHoras', '30');
    await p.evaluate(() => localStorage.setItem('ae_actividad', String(Date.now() - 20 * 3600e3))); await p.locator('#hojaInact h2').click(); await p.waitForTimeout(400);
    ok('con algo escrito sin guardar no se cierra la sesión', p.url().endsWith('inicio.html') && (await p.inputValue('#inactHoras')) === '30');
    await p.screenshot({ path: 'capturas/46-pc-inactividad.png' });
    await ctx.close();
  }
  // ---------- Sesión: sigue al reabrir, se cierra sin uso, vuelve a donde iba ----------
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo); const pc = nombre === 'pc';
    const p = await entrar(ctx, 'lucia', '739105'); p.on('pageerror', (e) => errores.push(e.message));
    ok(nombre + ': la sesión queda en el dispositivo, no en la pestaña', await p.evaluate(() => Object.keys(localStorage).some((k) => /^sb-.+-auth-token$/.test(k))));
    const p2 = await ctx.newPage(); await p2.goto(H + 'trabajo.html'); await p2.waitForSelector('#barra .cuenta');
    ok(nombre + ': otra pestaña o reabrir la app no pide el PIN', p2.url().endsWith('trabajo.html')); await p2.close();
    // Subidas en curso: no se cierra aunque se venza
    await p.evaluate(() => { window.AE_ocupado(() => true); localStorage.setItem('ae_actividad', String(Date.now() - 13 * 3600e3)); });
    await p.mouse.click(5, 300); await p.waitForTimeout(400);
    ok(nombre + ': con subidas en curso no se cierra', p.url().endsWith('inicio.html') && Number(await p.evaluate(() => localStorage.getItem('ae_actividad'))) > Date.now() - 60000);
    // 13 horas sin uso: al abrir un enlace pide el PIN y después lleva ahí
    await p.evaluate(() => localStorage.setItem('ae_actividad', String(Date.now() - 13 * 3600e3)));
    await p.goto(H + 'clientes.html?c=1&t=documentos'); await p.waitForURL(/index\.html\?ir=/);
    ok(nombre + ': tras 13 horas sin uso pide el PIN', (await p.locator('.toast').first().textContent()).includes('falta de uso'));
    ok(nombre + ': la sesión vieja se borró del dispositivo', !(await p.evaluate(() => Object.keys(localStorage).some((k) => /^sb-.+-auth-token$/.test(k)))));
    await p.waitForSelector('#pasoPin:not(.hidden)'); await pin(p, '739105', pc);
    await p.waitForURL('**/clientes.html?c=1&t=documentos');
    ok(nombre + ': después del PIN vuelve a la hoja donde iba', true);
    // Un destino de otro sitio no se acepta
    await p.goto(H + 'index.html?ir=' + encodeURIComponent('https://malo.com/x.html')); await p.waitForURL('**/inicio.html');
    ok(nombre + ': un destino de otro sitio lleva a Inicio', true);
    // El administrador cerró sus sesiones: la app sale sola
    mundo.datos.sesionCerrada = true;
    await p.goto(H + 'trabajo.html'); await p.waitForURL('**/index.html*');
    ok(nombre + ': si el administrador cerró la sesión, la app sale y lo dice', (await p.locator('.toast').first().textContent()).includes('Tu sesión se cerró'));
    ok(nombre + ': se preguntó al servidor si la sesión sigue viva', llamo(mundo, 'sesion_viva').length > 0);
    await ctx.close();
  }
  ok('sin errores de la página', errores.length === 0, errores);
  await nav.close(); cerrar();
})();
