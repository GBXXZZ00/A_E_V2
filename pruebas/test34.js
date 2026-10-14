// Corrida urgente 14/10, parte 2: Clientes es la única lista de expedientes. Tres tarjetas (PYME, Dedicado corporativo, Dedicado ISP)
// con su número; un combinado sale en dos con su etiqueta; la última tarjeta se recuerda; en las de dedicados aparecen los filtros VGT
// y Enlaces; el atajo Faltan documentos; un líder sin marca de dedicados ve sus dedicados; los enlaces viejos siguen funcionando.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
const LUCIA = '22222222-2222-4222-8222-222222222222';
const cli = (m, n) => m.datos.clientes.find((c) => c.nombre.indexOf(n) === 0);
async function cerrarHojas(p){ for(let i = 0; i < 5 && await p.evaluate(() => !!window.Comun.hojaAbierta()); i++){ await p.keyboard.press('Escape'); await p.waitForTimeout(260); } }
function preparar(m){
  const isp = cli(m, 'Tornillos El Yunque'); const comb = cli(m, 'Vidrios El Faro');
  // ISP solo dedicado, de Lucía (sin marca de dedicados en su cuenta)
  isp.servicios = []; isp.instalaciones = []; isp.lider_id = LUCIA; isp.es_isp = true;
  isp.dedicado = { tipo: 'isp', ejecutiva: 'Lucía Ferrer', ejecutiva_id: LUCIA, activo: true, verificar: false, cods: ['601'],
    enlaces: [{ id: 1, codigo: 'ENL-1', servicio: 'internet', nodo: 'NODO PRUEBA', cap_entregada: 500, activo: true }], contactos: [], contratos: [{ id: 31, tipo: 'servicio', estatus: 'firmado' }] };
  // Combinado: PYME (sus servicios) + dedicado corporativo con VGT por firmar
  comb.dedicado = { tipo: 'corporativo', ejecutiva: 'Lucía Ferrer', ejecutiva_id: LUCIA, activo: true, verificar: false, cods: ['602'], enlaces: [], contactos: [],
    contratos: [{ id: 41, tipo: 'servicio', estatus: 'firmado' }, { id: 42, tipo: 'vgt', estatus: 'por_firmar', proyecto: 'Proyecto de prueba', postes: 4 }] };
  return { isp, comb };
}

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo); const { isp, comb } = preparar(mundo);
    // ----- Administrador -----
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'clientes.html'); await p.waitForSelector('#tarjetas [data-tarjeta="pyme"] b:not(:empty)'); await p.waitForSelector('.cli');
    const t = await p.textContent('#tarjetas');
    ok(nombre + ': arriba las tres tarjetas con su número y PYME marcada', /PYME/.test(t) && /Dedicado corporativo/.test(t) && /Dedicado ISP/.test(t) && (await p.getAttribute('#tarjetas [data-tarjeta="pyme"]', 'aria-pressed')) === 'true' && /\d+\s*Dedicado corporativo/.test(t) && /[1-9]\d*\s*Dedicado ISP/.test(t));
    const at = await p.textContent('#filtros');
    ok(nombre + ': los atajos sirven para las tres (con Faltan documentos)', ['En curso', 'Por revisar', 'Sin gestión', 'Faltan documentos', 'Todos'].every((x) => at.includes(x)));
    await p.click('#filtros [data-filtro="todos"]'); await p.waitForFunction(() => /Vidrios El Faro/.test(document.getElementById('lista').textContent));
    ok(nombre + ': el combinado sale en PYME con su etiqueta y el ISP solo no', /Combinado/.test(await p.locator('.cli', { hasText: 'Vidrios El Faro' }).textContent()) && !(await p.textContent('#lista')).includes('Tornillos El Yunque'));
    ok(nombre + ': en PYME no están los filtros de dedicados', (await p.locator('[data-sel="vgt"], [data-sel="enlaces"]').count()) === 0);
    ok(nombre + ': sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/34-' + nombre + '-admin-pyme.png', fullPage: true });
    // Dedicado corporativo: el combinado también sale aquí, con los filtros VGT y Enlaces
    await p.click('#tarjetas [data-tarjeta="corporativo"]'); await p.waitForFunction(() => /Vidrios El Faro/.test(document.getElementById('lista').textContent) && /Dedicado corporativo/.test(document.getElementById('cuentaLista').textContent));
    ok(nombre + ': el combinado también sale en Dedicado corporativo', (await p.getAttribute('#tarjetas [data-tarjeta="corporativo"]', 'aria-pressed')) === 'true');
    ok(nombre + ': en las tarjetas de dedicados aparecen VGT y Enlaces', (await p.locator('[data-sel="vgt"]').count()) >= 1 && (await p.locator('[data-sel="enlaces"]').count()) >= 1);
    const llam = mundo.llamadas.filter((l) => l[1] === 'clientes_lista2').slice(-1)[0][2];
    ok(nombre + ': la tarjeta viaja al servidor y queda en la dirección', llam.p_filtros.tarjeta === 'corporativo' && p.url().includes('s=corporativo'));
    // ISP y se recuerda
    await p.click('#tarjetas [data-tarjeta="isp"]'); await p.waitForFunction(() => /Tornillos El Yunque/.test(document.getElementById('lista').textContent));
    await p.screenshot({ path: 'capturas/34-' + nombre + '-admin-isp.png', fullPage: true });
    await p.goto(H + 'clientes.html'); await p.waitForSelector('#tarjetas [data-tarjeta="isp"][aria-pressed="true"]');
    ok(nombre + ': la última tarjeta elegida se recuerda', true);
    // Un atajo que viene de Inicio (sin tarjeta) muestra todas, como el número que lo trajo
    await p.goto(H + 'clientes.html?f=todos'); await p.waitForFunction(() => /en todas las tarjetas/.test(document.getElementById('cuentaLista').textContent));
    ok(nombre + ': un atajo de Inicio abre en todas las tarjetas sin cambiar la guardada', (await p.locator('#tarjetas [aria-pressed="true"]').count()) === 0 && await p.evaluate(() => localStorage.getItem('ae_cli_tarjeta') === 'isp'));
    await p.click('#tarjetas [data-tarjeta="isp"]'); await p.waitForSelector('#tarjetas [data-tarjeta="isp"][aria-pressed="true"]');
    // La hoja del dedicado conserva Contratos; la del combinado, Comisión y Contratos
    await p.click('#filtros [data-filtro="todos"]'); await p.locator('.cli', { hasText: 'Tornillos El Yunque' }).click(); await p.waitForSelector('#hojaFicha.ver #tab-datos [data-ded-enl]');
    ok(nombre + ': la hoja del ISP muestra enlaces y Contratos, sin Comisión', await p.evaluate(() => !document.querySelector('#tabs [data-tab="contratos"]').classList.contains('hidden') && document.querySelector('#tabs [data-tab="comision"]').classList.contains('hidden')));
    await cerrarHojas(p);
    await p.click('#tarjetas [data-tarjeta="pyme"]'); await p.click('#filtros [data-filtro="todos"]');
    await p.locator('.cli', { hasText: 'Vidrios El Faro' }).click(); await p.waitForSelector('#hojaFicha.ver');
    await p.click('#tabs [data-tab="contratos"]'); await p.waitForSelector('#tab-contratos.on');
    const ctr = await p.textContent('#tab-contratos');
    ok(nombre + ': la hoja del combinado tiene Comisión y en Contratos el dedicado, el PYME y el VGT con su proyecto', await p.evaluate(() => !document.querySelector('#tabs [data-tab="comision"]').classList.contains('hidden')) && ctr.includes('Servicio dedicado') && ctr.includes('Contrato PYME') && ctr.includes('Proyecto de prueba'));
    await cerrarHojas(p);
    // Enlace viejo con el segmento
    await p.goto(H + 'clientes.html?tipo=Dedicado%20ISP'); await p.waitForSelector('#tarjetas [data-tarjeta="isp"][aria-pressed="true"]');
    ok(nombre + ': un enlace viejo con el segmento abre la tarjeta que le toca', true);

    // ----- Líder sin marca de dedicados -----
    const c2 = await contexto(nav, dispositivo, mundo); const q = await entrar(c2.ctx, 'lucia', '739105'); q.on('pageerror', (e) => errores.push(e.message));
    await q.evaluate(() => { try { localStorage.removeItem('ae_cli_tarjeta'); } catch (e) {} });
    await q.goto(H + 'clientes.html'); await q.waitForSelector('#tarjetas [data-tarjeta="isp"] b:not(:empty)');
    ok(nombre + ': la líder (sin marca) ve sus dedicados contados en las tarjetas', /1\s*Dedicado ISP/.test(await q.textContent('#tarjetas')) && /[1-9]\d*\s*Dedicado corporativo/.test(await q.textContent('#tarjetas')));
    await q.click('#tarjetas [data-tarjeta="isp"]'); await q.click('#filtros [data-filtro="todos"]'); await q.waitForFunction(() => /Tornillos El Yunque/.test(document.getElementById('lista').textContent));
    await q.screenshot({ path: 'capturas/34-' + nombre + '-lider-isp.png', fullPage: true });
    await q.locator('.cli', { hasText: 'Tornillos El Yunque' }).click(); await q.waitForSelector('#hojaFicha.ver #tab-datos [data-ded-enl]');
    ok(nombre + ': la líder abre la hoja de su dedicado con sus enlaces', true);
    await cerrarHojas(q);
    await q.goto(H + 'dedicados.html?c=' + isp.id); await q.waitForURL('**/clientes.html**'); await q.waitForSelector('#hojaFicha.ver');
    ok(nombre + ': un enlace viejo a un dedicado abre su hoja en Clientes', q.url().includes('clientes.html'));
    await c2.ctx.close(); await ctx.close();
  }
  ok('sin errores de la página', errores.length === 0, errores);
  await nav.close(); cerrar();
})();
