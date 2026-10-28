// Lote 27/10: Gerencia nueva. Inicio propio con tarjetas (instalaciones, en el año, órdenes sin instalar, comisiones, expedientes,
// migraciones, dedicados, calidad, estatus legal, demanda sin red, ingresos por armar y avisos), filtros Período y Comparar con;
// cada tarjeta abre el Resumen de su módulo encima en solo lectura. La cuenta Gerencia entra directo y no abre fichas.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
const llamo = (m, f) => m.llamadas.filter((l) => l[1] === f);
async function cerrarHojas(p){ for(let i = 0; i < 5 && await p.evaluate(() => !!window.Comun.hojaAbierta()); i++){ await p.keyboard.press('Escape'); await p.waitForTimeout(260); } }
const GINA = { id: '77777777-7777-4777-8777-777777777700', usuario: 'gina', pin: '640218', nombre: 'Gina Paredes', rol: 'abogado', gerencia: true, cargo: 'Gerente', equipo: 'ambos', codigo_vendedor: null, nombre_odoo: null, activo: true, debe_cambiar_pin: false };

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo); mundo.personas.push(Object.assign({}, GINA));
    // ----- Administrador -----
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    await p.waitForSelector('#zonaModulos a.mod');
    ok(nombre + ': Inicio tiene Gerencia y ya no tiene Panel', (await p.locator('#zonaModulos [data-modulo="gerencia"]').count()) === 1 && (await p.locator('#zonaModulos [data-modulo="panel"]').count()) === 0);
    await p.goto(H + 'gerencia.html'); await p.waitForSelector('#zonaG .gt-grid button.gtj');
    const z = await p.textContent('#zonaG');
    ok(nombre + ': tarjetas de la maqueta y Demanda sin red', ['Instalaciones PYME', 'En el año', 'Órdenes sin instalar', 'Comisiones del corte', 'Contratos firmados', 'Migraciones a PYME', 'Dedicados', 'Calidad de la venta', 'Estatus legal', 'Demanda sin red', 'Ingresos de dedicados', 'Tus avisos'].every((t) => z.includes(t)));
    ok(nombre + ': pide el resumen de gerencia con el período y la comparación', llamo(mundo, 'modulo_resumen').some((l) => l[2].p_modulo === 'gerencia' && l[2].p_comparar === 'anio' && /^\d{4}-\d{2}-01$/.test(l[2].p_desde)));
    await p.selectOption('#cmpG', 'mes'); await p.waitForTimeout(300);
    ok(nombre + ': Comparar con cambia la llamada', llamo(mundo, 'modulo_resumen').some((l) => l[2].p_modulo === 'gerencia' && l[2].p_comparar === 'mes'));
    ok(nombre + ': Ingresos de dedicados es un hueco por armar y no se toca', (await p.locator('.gtj.hueco').count()) === 1 && /Por armar/.test(await p.textContent('.gtj.hueco')));
    await p.locator('.gtj[data-gt="comisiones"]').first().click(); await p.waitForSelector('#hojaGMod.ver .rs-n');
    ok(nombre + ': la tarjeta abre el Resumen de su módulo encima, en solo lectura', /Comisiones/.test(await p.textContent('#tGMod')) && /solo lectura/i.test(await p.textContent('#hojaGMod')));
    await p.locator('#hojaGMod .rs-n').first().click(); await p.waitForSelector('#hojaRes.ver .hoja-cuerpo');
    ok(nombre + ': el número abre su lista encima del resumen', await p.evaluate(() => window.Comun.hojasAbiertas().join(',') === 'hojaGMod,hojaRes'));
    ok(nombre + ': en solo lectura no hay Ver todos en la lista', (await p.locator('#hojaRes a.btn').count()) === 0);
    await cerrarHojas(p);
    ok(nombre + ': Gerencia no desborda', await sinDesborde(p));
    await p.goto(H + 'panel.html'); await p.waitForURL('**/inicio.html**');
    ok(nombre + ': panel.html lleva a Inicio', true);
    // ----- Cuenta Gerencia: solo lectura, entra directo a Gerencia -----
    const c3 = await contexto(nav, dispositivo, mundo); const g = await c3.ctx.newPage(); g.on('pageerror', (e) => errores.push(e.message));
    await g.goto(H + 'index.html'); await g.waitForSelector('#pasoEquipo:not(.hidden)'); await g.click('[data-equipo="ventas"]'); await g.fill('#usuario', 'gina'); await g.click('#seguir');
    const pc = await g.evaluate(() => window.matchMedia('(min-width:900px)').matches);
    if(pc){ await g.locator('#pinCampo').focus(); await g.keyboard.type('640218', { delay: 15 }); } else for(const n of '640218') await g.locator('.tecla[data-k="' + n + '"]').click();
    await g.waitForURL('**/gerencia.html**'); await g.waitForSelector('#zonaG button.gtj');
    ok(nombre + ': la cuenta Gerencia entra directo a Gerencia y ve Comisiones', (await g.locator('.gtj[data-gt="comisiones"]').count()) >= 1);
    ok(nombre + ': su menú solo tiene Gerencia', await g.evaluate(() => [...document.querySelectorAll('.navpc a, #navTel a, nav a')].every((a) => /gerencia\.html|inicio\.html|#/.test(a.getAttribute('href') || ''))));
    await g.locator('.gtj[data-gt="clientes"]').first().click(); await g.waitForSelector('#hojaGMod.ver .rs-s-barra button');
    await g.locator('#hojaGMod .rs-s-barra button').first().click(); await g.waitForSelector('#hojaRes.ver .rs-df');
    ok(nombre + ': Gerencia ve la lista pero no abre fichas', (await g.locator('#hojaRes button.rs-df').count()) === 0);
    await cerrarHojas(g);
    await g.goto(H + 'clientes.html'); await g.waitForURL('**/gerencia.html**');
    ok(nombre + ': si Gerencia intenta entrar a otro módulo vuelve a Gerencia', true);
    await c3.ctx.close();
    // ----- Usuarios: la opción Gerencia y la columna Avisos -----
    mundo.suscripciones = ['11111111-1111-4111-8111-111111111111'];
    await p.goto(H + 'usuarios.html'); await p.waitForSelector('#lista button'); await p.waitForFunction(() => /Sin activar/.test(document.getElementById('lista').textContent));
    ok(nombre + ': Usuarios muestra Gerencia (solo lectura) y ofrece la opción', /Gerencia \(solo lectura\)/.test(await p.textContent('#lista')) && (await p.locator('#fRol option[value="gerencia"]').count()) === 1);
    ok(nombre + ': columna Avisos: activos para quien tiene equipo, Sin activar para los demás', pc0(await p.textContent('#lista')));
    await ctx.close();
  }
  ok('sin errores de la página', errores.length === 0, errores);
  await nav.close(); cerrar();
})();
function pc0(t){ return /Activos|avisos activos/.test(t) && /Sin activar|sin avisos/.test(t); }
