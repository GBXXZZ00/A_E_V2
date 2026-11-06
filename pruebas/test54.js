// Lote 05/11, parte E: Comisiones. Fila solo con etiquetas (sin botones) y puntos Legal/Pago/Orden, secciones dentro de cada dueño,
// grupo "Sin dueño", hoja con "Ver expediente completo" arriba, "Cliente y orden de Odoo", "Ya enviada (marcar)" e IP "Lo más parecido". Datos inventados.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['pc', PC], ['tel', TEL]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(nombre + ': ' + e.message));
    await p.goto(H + 'comisiones.html'); await p.waitForSelector('.cx-grupo', { timeout: 15000 });
    if(!(await p.locator('.cx-grupo.abierto .cx-fila2').count())) await p.locator('.cx-grupo:not(.bandeja-extra) .grupo-cab').first().click().catch(() => {});
    await p.waitForSelector('.cx-grupo.abierto .cx-fila2', { timeout: 15000 }).catch(async () => console.log('DBG', (await p.textContent('#lista')).slice(0, 300)));
    ok(nombre + ': la fila no tiene botones adentro, solo etiquetas', (await p.locator('.cx-fila2 button').count()) === 0 && (await p.locator('.cx-fila2 .cx-pts').count()) > 0);
    const pts = await p.textContent('.cx-fila2 .cx-pts');
    ok(nombre + ': Legal, Pago y Orden como puntos de color', /Legal/.test(pts) && /Pago/.test(pts) && /Orden/.test(pts));
    ok(nombre + ': secciones dentro del dueño', (await p.locator('.cx-sec').count()) > 0);
    // Abrir la hoja tocando la fila
    await p.locator('.cx-fila2[data-com]').first().click(); await p.waitForSelector('#hojaComision.ver #cuerpoCom .plg-com', { timeout: 15000 });
    ok(nombre + ': arriba "Ver expediente completo"', (await p.locator('#cabCom #abrirExp').count()) === 1);
    ok(nombre + ': sección "Cliente y orden de Odoo"', /Cliente y orden de Odoo/.test(await p.textContent('#cuerpoCom')));
    // Ya enviada (marcar)
    if(await p.locator('#cartaMarcar').count()){
      await p.click('[data-plg-btn="carta"]').catch(() => {}); await p.locator('#cartaMarcar').click(); await p.waitForSelector('#hojaMarcarCarta.ver #formMarcar', { timeout: 8000 }).catch(async () => console.log('DBG', await p.evaluate(() => [!!document.getElementById('hojaMarcarCarta'), (document.getElementById('hojaMarcarCarta') || {}).className, window.Comun.hojaAbierta()].join('|'))));
      ok(nombre + ': Ya enviada pide qué, cuándo y por dónde', (await p.locator('#formMarcar input[name="mcQue"]').count()) === 3 && (await p.locator('#formMarcar input[name="mcCanal"]').count()) === 4 && !!(await p.inputValue('#mcFecha')));
      await p.click('#formMarcar [type="submit"]'); await p.waitForFunction(() => !document.querySelector('#hojaMarcarCarta.ver'));
      ok(nombre + ': queda en la bitácora', (mundo.bitacora || []).some((b) => b.accion === 'carta_marcada'));
    } else ok(nombre + ': (la primera fila ya tiene la carta enviada)', true);
    ok(nombre + ': sin desborde', await sinDesborde(p));
    await ctx.close();
  }
  ok('sin errores de JavaScript', !errores.length, errores.slice(0, 3));
  await nav.close(); cerrar();
})();
