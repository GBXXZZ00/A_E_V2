// Lote 2, parte E: entrada segura. Pasa por la función "entrar" (nunca directo a Supabase), avisa los intentos que quedan,
// bloquea a los 5 fallos con un mensaje claro, el PIN temporal se cambia por la función, la entrada de respaldo
// funciona si la función no responde, y en Usuarios el líder puede marcarse como ejecutiva de dedicados.
const { chromium, H, TEL, PC, contexto, marcador, pin, entrar } = require('./simulador');
const { ok, cerrar } = marcador();

async function hastaPin(p, usuario){
  await p.goto(H + 'index.html'); await p.waitForSelector('#pasoEquipo:not(.hidden), #pasoPin:not(.hidden), #pasoUsuario:not(.hidden)');
  if(await p.locator('#pasoEquipo:not(.hidden)').count()) await p.click('[data-equipo="ventas"]');
  if(await p.locator('#pasoPin:not(.hidden)').count()){ await p.click('#enlacePie'); }
  await p.fill('#usuario', usuario); await p.click('#seguir'); await p.waitForSelector('#pasoPin:not(.hidden)');
}
const estado = (p) => p.textContent('#estadoPin');

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    const p = await ctx.newPage(); p.on('pageerror', (e) => errores.push(e.message));
    await hastaPin(p, 'lucia');
    const intento = async (v) => { const n0 = mundo.llamadas.filter((l) => l[0] === 'entrar').length; await pin(p, v, nombre === 'pc');
      for(let t = 0; t < 100 && mundo.llamadas.filter((l) => l[0] === 'entrar').length === n0; t++) await p.waitForTimeout(50);
      await p.waitForFunction(() => document.getElementById('estadoPin').textContent.trim().length > 0 && !/Entrando/.test(document.getElementById('estadoPin').textContent)); };
    for(let i = 1; i <= 3; i++) await intento('00000' + i);
    ok(nombre + ': entra por la función, nunca directo a Supabase', mundo.llamadas.filter((l) => l[0] === 'entrar').every((l) => l[2] === 'segura') && mundo.llamadas.some((l) => l[0] === 'entrar'));
    ok(nombre + ': al tercer fallo avisa que quedan 2 intentos', /quedan 2 intentos/.test(await estado(p)));
    await intento('000004');
    ok(nombre + ': al cuarto avisa que queda 1', /queda 1 intento/.test(await estado(p)));
    await intento('000005');
    ok(nombre + ': al quinto bloquea y dice cuánto esperar y qué hacer', /Espera 15 minutos/.test(await estado(p)) && /administrador/.test(await estado(p)));
    await p.screenshot({ path: 'capturas/26-' + nombre + '-bloqueo.png' });
    await intento('739105');
    ok(nombre + ': bloqueada, ni con el PIN bueno entra', !p.url().includes('inicio.html'));

    // PIN temporal: se cambia por la función
    await hastaPin(p, 'pedro'); await pin(p, '204871', nombre === 'pc');
    await p.waitForFunction(() => document.getElementById('tPin').textContent === 'Crea tu PIN nuevo');
    await pin(p, '640278', nombre === 'pc'); await p.waitForFunction(() => document.getElementById('tPin').textContent === 'Repite tu PIN nuevo'); await pin(p, '640278', nombre === 'pc');
    await p.waitForURL('**/inicio.html');
    ok(nombre + ': el PIN temporal se cambia por la función y entra', mundo.llamadas.some((l) => l[0] === 'pin' && l[1] === 'pedro' && l[2] === '640278') && mundo.llamadas.some((l) => l[0] === 'pin_cambiado'));

    // Respaldo: la función no responde y la cuenta todavía tiene la clave de antes
    const c2 = await contexto(nav, dispositivo); c2.mundo.entradaCaida = true;
    const q = await c2.ctx.newPage(); q.on('pageerror', (e) => errores.push(e.message));
    await hastaPin(q, 'marcos'); await pin(q, '482913', nombre === 'pc'); await q.waitForURL('**/inicio.html');
    ok(nombre + ': si la función no responde, entra por el respaldo', c2.mundo.llamadas.some((l) => l[0] === 'entrar' && l[2] === 'caida') && c2.mundo.llamadas.some((l) => l[0] === 'entrar' && !l[2]));
    await c2.ctx.close();

    // Usuarios: marca de ejecutiva de dedicados solo para líderes
    if(nombre === 'pc'){
      const c3 = await contexto(nav, dispositivo); const a = await entrar(c3.ctx, 'marcos', '482913'); a.on('pageerror', (e) => errores.push(e.message));
      await a.goto(H + 'usuarios.html'); await a.waitForSelector('.persona');
      await a.click('.persona:has-text("Lucía Ferrer")'); await a.waitForSelector('#hojaUsuario.ver');
      ok('pc: en un líder aparece "Ejecutiva de dedicados"', await a.locator('#zonaDed').isVisible());
      await a.selectOption('#fRol', 'abogado');
      ok('pc: en otro rol no aparece', !(await a.locator('#zonaDed').isVisible()));
      await a.selectOption('#fRol', 'lider'); await a.click('#fDed');
      await a.screenshot({ path: 'capturas/26-pc-usuario-dedicados.png' });
      await a.click('#guardar');
      await a.waitForFunction(() => /Líder de dedicados/.test(document.querySelector('#lista').textContent));
      ok('pc: se guarda y la lista lo dice', c3.mundo.llamadas.some((l) => l[0] === 'usuarios' && l[1].accion === 'editar' && l[1].dedicados === true));
      await c3.ctx.close();
    }
    await ctx.close();
  }
  ok('sin errores de la página', errores.length === 0); if(errores.length) console.log(errores);
  await nav.close(); cerrar();
})();
