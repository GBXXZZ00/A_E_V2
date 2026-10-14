// Corrida urgente 14/10, parte 1: un cliente con el nombre de la líder pero sin enlazar a su cuenta no lo ve ella;
// al guardar a la líder en Usuarios se enlaza solo (sin tildes ni mayúsculas importan) y desde ese momento lo ve en Clientes.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    const base = mundo.datos.clientes.find((c) => c.lider_id === '22222222-2222-4222-8222-222222222222');
    mundo.datos.clientes.push(Object.assign(JSON.parse(JSON.stringify(base)), { id: 99001, nombre: 'Panaderia Sin Enlace, C.A.', doc_numero: '591999001', lider: 'LUCIA FERRER', lider_id: null }));
    // Antes: la líder no lo ve
    const c1 = await contexto(nav, dispositivo, mundo); const q = await entrar(c1.ctx, 'lucia', '739105'); q.on('pageerror', (e) => errores.push(e.message));
    await q.goto(H + 'clientes.html'); await q.waitForSelector('.cli'); await q.fill('#busca', 'sin enlace'); await q.waitForSelector('#lista .vacio');
    ok(nombre + ': antes, la líder no ve el cliente que tiene su nombre sin enlazar', true);
    await c1.ctx.close();
    // El administrador guarda a la líder: se enlaza solo y lo dice
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'usuarios.html'); await p.waitForSelector('#lista button');
    await p.locator('#lista button', { hasText: 'Lucía Ferrer' }).first().click(); await p.waitForSelector('#guardar');
    await p.click('#guardar'); await p.waitForFunction(() => /cliente enlazado a su cuenta/.test(document.body.textContent));
    ok(nombre + ': al guardar a la líder avisa cuántos clientes se enlazaron', mundo.datos.clientes.find((c) => c.id === 99001).lider_id === '22222222-2222-4222-8222-222222222222');
    await p.screenshot({ path: 'capturas/33-' + nombre + '-usuarios.png' });
    // Después: la líder sí lo ve
    const c2 = await contexto(nav, dispositivo, mundo); const r = await entrar(c2.ctx, 'lucia', '739105'); r.on('pageerror', (e) => errores.push(e.message));
    await r.goto(H + 'clientes.html'); await r.waitForSelector('.cli'); await r.fill('#busca', 'sin enlace');
    await r.waitForFunction(() => document.querySelectorAll('.cli').length === 1 && document.querySelector('.cli').textContent.includes('Sin Enlace'));
    ok(nombre + ': después, la líder ve el cliente en Clientes', true);
    ok(nombre + ': sin desborde', await sinDesborde(r));
    await c2.ctx.close(); await ctx.close();
  }
  ok('sin errores de la página', errores.length === 0, errores);
  await nav.close(); cerrar();
})();
