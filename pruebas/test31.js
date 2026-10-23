// Lote 7 (14/10): Gerencia, primera versión. Resumen por mes o rango, líder y segmento; cada número o barra abre su lista y de ahí la ficha;
// Descargar Excel; administrador y Gerencia ven aliados y negativos; el líder solo lo suyo; la cuenta Gerencia es de solo lectura.
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
    ok(nombre + ': Inicio tiene el módulo Gerencia', (await p.locator('#zonaModulos [data-modulo="gerencia"]').count()) === 1);
    await p.goto(H + 'gerencia.html'); await p.waitForSelector('#zonaG .ge-bento .ge-n');
    ok(nombre + ': arranca en el corte en curso del servidor', (await p.inputValue('#gDesde')) === '2026-10-01' && (await p.inputValue('#gHasta')) === '2026-10-01' && /octubre/i.test(await p.textContent('#subG')));
    const z = await p.textContent('#zonaG');
    ok(nombre + ': portada con clientes activos, instalaciones contra el mes anterior, comisiones, expedientes y negativos', /Clientes activos\s*4/.test(z) && /\+1 contra el mes anterior/.test(z) && /Certificado|Corte abierto/.test(z) && /Expedientes completos/.test(z) && (await p.locator('.ge-k.neg').count()) === 1);
    ok(nombre + ': el administrador ve Aliados y Negativos', (await p.locator('#secAli').count()) === 1 && (await p.locator('#secNeg').count()) === 1);
    ok(nombre + ': septiembre sale como certificado en la serie de comisiones', /sep 26\s*Certificado/.test(await p.textContent('#secCom')));
    ok(nombre + ': sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/31-' + nombre + '-admin.png', fullPage: true });
    // Una barra abre su lista y de ahí la ficha
    await p.locator('#secCom .ge-t').first().locator('.ge-p.verde').last().click(); await p.waitForSelector('#hojaG.ver .ge-li');
    ok(nombre + ': tocar una barra abre la lista de esa barra', /Comisiones que cumplen/.test(await p.textContent('#tG')) && /Vidrios El Faro/.test(await p.textContent('#cuerpoLista')) && llamo(mundo, 'gerencia_lista').slice(-1)[0][2].p_mes === '2026-10-01');
    await p.screenshot({ path: 'capturas/31-' + nombre + '-lista.png' });
    await p.locator('#hojaG button.ge-li', { hasText: 'Vidrios El Faro' }).click(); await p.waitForSelector('#hojaFicha.ver');
    ok(nombre + ': de la lista se abre la ficha encima', await p.evaluate(() => window.Comun.hojasAbiertas().join() === 'hojaG,hojaFicha'));
    await cerrarHojas(p);
    // Negativos tocables
    await p.locator('#secNeg .ge-ng', { hasText: 'Instalado sin autorización' }).click(); await p.waitForSelector('#hojaG.ver .ge-li');
    ok(nombre + ': un negativo abre su lista', /Tornillos El Yunque/.test(await p.textContent('#cuerpoLista')));
    await cerrarHojas(p);
    // Filtros: rango inválido y segmento
    await p.selectOption('#gDesde', '2026-10-01'); await p.selectOption('#gHasta', '2026-09-01');
    ok(nombre + ': un rango al revés da error debajo', /antes de/.test(await p.textContent('#eRango')));
    await p.selectOption('#gHasta', '2026-10-01'); await p.selectOption('#gSeg', 'Dedicado ISP'); await p.waitForFunction(() => /Clientes activos\s*1/.test(document.getElementById('zonaG').textContent));
    ok(nombre + ': el segmento filtra en el servidor y queda en la dirección', llamo(mundo, 'gerencia').slice(-1)[0][2].p_segmento === 'Dedicado ISP' && p.url().includes('s=Dedicado'));
    await p.selectOption('#gSeg', ''); await p.waitForFunction(() => /Clientes activos\s*4/.test(document.getElementById('zonaG').textContent));
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#excelG')]);
    ok(nombre + ': Descargar Excel baja el resumen', /^Gerencia_2026-10\.xlsx$/.test(dl.suggestedFilename()));
    // ----- Líder: solo lo suyo, sin aliados ni negativos -----
    const c2 = await contexto(nav, dispositivo, mundo); const q = await entrar(c2.ctx, 'lucia', '739105'); q.on('pageerror', (e) => errores.push(e.message));
    await q.goto(H + 'gerencia.html'); await q.waitForSelector('#zonaG .ge-bento .ge-n');
    ok(nombre + ': el líder ve solo sus clientes, sin filtro de líder ni aliados ni negativos', /Clientes activos\s*2/.test(await q.textContent('#zonaG')) && (await q.locator('#gLider').count()) === 0 && (await q.locator('#secAli, #secNeg, .ge-k.neg').count()) === 0);
    await q.screenshot({ path: 'capturas/31-' + nombre + '-lider.png', fullPage: true });
    await c2.ctx.close();
    // ----- Cuenta Gerencia: solo lectura, entra directo a Gerencia -----
    const c3 = await contexto(nav, dispositivo, mundo); const g = await c3.ctx.newPage(); g.on('pageerror', (e) => errores.push(e.message));
    await g.goto(H + 'index.html'); await g.waitForSelector('#pasoEquipo:not(.hidden)'); await g.click('[data-equipo="ventas"]'); await g.fill('#usuario', 'gina'); await g.click('#seguir');
    const pc = await g.evaluate(() => window.matchMedia('(min-width:900px)').matches);
    if(pc){ await g.locator('#pinCampo').focus(); await g.keyboard.type('640218', { delay: 15 }); } else for(const n of '640218') await g.locator('.tecla[data-k="' + n + '"]').click();
    await g.waitForURL('**/gerencia.html**'); await g.waitForSelector('#zonaG .ge-bento .ge-n');
    ok(nombre + ': la cuenta Gerencia entra directo a Gerencia y ve negativos', (await g.locator('#secNeg').count()) === 1);
    ok(nombre + ': su menú solo tiene Gerencia y el Panel', await g.evaluate(() => [...document.querySelectorAll('.navpc a, #navTel a, nav a')].every((a) => /gerencia\.html|panel\.html|inicio\.html|#/.test(a.getAttribute('href') || ''))));
    await g.locator('#secCom .ge-p.verde').last().click(); await g.waitForSelector('#hojaG.ver .ge-li');
    ok(nombre + ': Gerencia ve la lista pero no abre fichas', (await g.locator('#hojaG button.ge-li').count()) === 0);
    await cerrarHojas(g);
    await g.goto(H + 'clientes.html'); await g.waitForURL('**/gerencia.html**');
    ok(nombre + ': si Gerencia intenta entrar a otro módulo vuelve a Gerencia', true);
    await c3.ctx.close();
    // ----- Usuarios: la opción Gerencia -----
    await p.goto(H + 'usuarios.html'); await p.waitForSelector('#lista button');
    ok(nombre + ': Usuarios muestra la cuenta como Gerencia (solo lectura) y ofrece la opción', /Gerencia \(solo lectura\)/.test(await p.textContent('#lista')) && (await p.locator('#fRol option[value="gerencia"]').count()) === 1);
    await ctx.close();
  }
  ok('sin errores de la página', errores.length === 0, errores);
  await nav.close(); cerrar();
})();
