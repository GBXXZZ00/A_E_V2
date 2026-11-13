// Lote 13/11, parte 6: Clientes con el botón Fecha al lado de Filtros (Fecha de y Cuándo, Entre fechas con Desde y Hasta),
// "Ver N clientes" contado por el servidor, queda en la dirección (fd, fde, fha) y Quitar lo limpia. Teléfono y PC.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, disp] of [['pc', PC], ['tel', TEL]]){
    const { ctx, mundo: m } = await contexto(nav, disp);
    // Fechas de entrada inventadas: la mitad entró el mes pasado
    const h = new Date(); const mp = new Date(h.getFullYear(), h.getMonth() - 1, 10);
    m.datos.clientes.forEach((c, i) => { c.creado_en = (i % 2 ? iso(mp) : iso(h)) + 'T12:00:00Z'; });
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(nombre + ': ' + e.message));
    await p.goto(H + 'clientes.html'); await p.waitForSelector('#abrirFecha');
    ok(nombre + ': el botón Fecha está al lado de Filtros', (await p.evaluate(() => document.getElementById('abrirFiltros').nextElementSibling.id)) === 'abrirFecha' && /Fecha: cualquiera/.test(await p.textContent('#abrirFecha')));
    await p.click('#abrirFecha'); await p.waitForSelector('#clfPop.ver');
    const pop = await p.textContent('#clfPop');
    ok(nombre + ': el desplegable trae Fecha de y Cuándo con sus opciones', ['Entró a la app', 'Cambió de estatus', 'Firmó el contrato', 'Vence el contrato', 'Este mes', 'Mes pasado', 'Últimos 30 días', 'Este año', 'Entre fechas', 'Desde', 'Hasta', 'Quitar'].every((x) => pop.includes(x)));
    ok(nombre + ': sin fecha elegida no deja ver', await p.locator('#clfPop [data-fv]').isDisabled());
    await p.click('#clfPop [data-fc="mes_pasado"]');
    const ini = iso(new Date(h.getFullYear(), h.getMonth() - 1, 1)); const fin = iso(new Date(h.getFullYear(), h.getMonth(), 0));
    ok(nombre + ': Mes pasado llena Desde y Hasta', (await p.inputValue('#clfDesde')) === ini && (await p.inputValue('#clfHasta')) === fin);
    await p.waitForFunction(() => /Ver \d+ cliente/.test(document.querySelector('#clfPop [data-fv]').textContent));
    const esperado = m.datos.clientes.filter((c, i) => i % 2 && !c.unido_a && !c.suspendido_en).length;
    ok(nombre + ': "Ver N clientes" cuenta con el servidor', /Ver \d+ clientes?/.test(await p.textContent('#clfPop [data-fv]')));
    if(nombre === 'pc') await p.screenshot({ path: 'capturas/lote13nov-p6-fecha-pc.png' }); else await p.screenshot({ path: 'capturas/lote13nov-p6-fecha-tel.png' });
    await p.click('#clfPop [data-fv]'); await p.waitForFunction(() => !document.querySelector('#clfPop.ver'));
    await p.waitForFunction(() => /fd=entro/.test(location.search));
    const u = new URL(p.url());
    ok(nombre + ': queda en la dirección', u.searchParams.get('fd') === 'entro' && u.searchParams.get('fde') === ini && u.searchParams.get('fha') === fin);
    const ll = m.llamadas.filter((l) => l[1] === 'clientes_lista3').slice(-1)[0][2];
    ok(nombre + ': la lista pide la fecha al servidor', ll.p_f.fecha && ll.p_f.fecha.de === 'entro' && ll.p_f.fecha.desde === ini);
    ok(nombre + ': el botón dice lo elegido', /Entró:/.test(await p.textContent('#abrirFecha')) && (await p.getAttribute('#abrirFecha', 'class')).includes('on'));
    await p.reload(); await p.waitForSelector('#abrirFecha');
    ok(nombre + ': al recargar sigue el filtro', /Entró:/.test(await p.textContent('#abrirFecha')));
    // Entre fechas: Desde después de Hasta avisa debajo
    await p.click('#abrirFecha'); await p.click('#clfPop [data-fc="entre"]'); await p.fill('#clfDesde', '2026-12-01'); await p.dispatchEvent('#clfDesde', 'change');
    await p.fill('#clfHasta', '2026-11-01'); await p.dispatchEvent('#clfHasta', 'change');
    ok(nombre + ': Desde después de Hasta avisa', /Desde va antes que Hasta/.test(await p.textContent('#clfErr')));
    await p.click('#clfPop [data-fq]'); await p.waitForFunction(() => !/fd=/.test(location.search));
    ok(nombre + ': Quitar limpia la fecha', /Fecha: cualquiera/.test(await p.textContent('#abrirFecha')));
    ok(nombre + ': sin desborde', await sinDesborde(p));
    await ctx.close();
  }
  ok('sin errores de página', errores.length === 0); if(errores.length) console.log(errores.join('\n'));
  await nav.close(); cerrar();
})();
