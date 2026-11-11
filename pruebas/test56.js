// Lote 10/11, parte D: Comisiones. Equipo "Todos" por defecto, persona solo al elegir un equipo, Lista por fecha (la más nueva primero),
// Desde / Hasta, hoja con todo cerrado, "Corte y comisión" en vez de "Más acciones" y la carta descargada. Datos inventados.
const { enHoja, chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['pc', PC], ['tel', TEL]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(nombre + ': ' + e.message));
    await p.goto(H + 'comisiones.html'); await p.waitForSelector('#equipos [data-equipo]', { timeout: 15000 });
    ok(nombre + ': el equipo empieza en Todos', /Todos/.test(await p.textContent('#equipos .cx-eq.on')));
    ok(nombre + ': sin equipo elegido no sale el filtro de persona', !(await p.locator('[data-persona]').count()));
    await p.click('#equipos [data-equipo="corporativas"]'); await p.waitForSelector('[data-persona]');
    const personas = await p.locator('[data-persona]').count();
    ok(nombre + ': al elegir el equipo sale la gente de ese equipo', personas >= 3);
    const quien = await p.locator('[data-persona]').nth(1).getAttribute('data-persona');
    await p.locator('[data-persona]').nth(1).click(); await p.waitForTimeout(150);
    const lideres = await p.$$eval('.cx-grupo:not(.bandeja-extra)', (g) => g.map((x) => x.dataset.lider));
    ok(nombre + ': con una persona elegida solo sale su grupo', lideres.length === 1 && lideres[0] === quien, lideres);
    await p.click('#equipos [data-equipo="todos"]');
    // Lista por fecha: la instalación más nueva primero
    await p.click('[data-vista="fecha"]'); await p.waitForSelector('.cx-lfecha .cx-lf[data-com]');
    const fechas = await p.$$eval('.cx-lfecha .cx-lf[data-com] .cx-lf-f b', (l) => l.map((x) => x.textContent));
    const y = new Date().getFullYear(); const iso = fechas.map((t) => y + '-' + t.split('/').reverse().join('-'));
    ok(nombre + ': Lista por fecha ordena de la más nueva a la más vieja', iso.length > 2 && iso.every((x, i) => i === 0 || iso[i - 1] >= x), fechas.slice(0, 6));
    ok(nombre + ': cada fila dice su dueño en una etiqueta', (await p.locator('.cx-lfecha .cx-lf[data-com] .cx-lf-d .chip').count()) === (await p.locator('.cx-lfecha .cx-lf[data-com]').count()));
    ok(nombre + ': sin desborde con la lista por fecha', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/lote10nov-D-' + nombre + '-fecha.png', fullPage: false });
    // Desde / Hasta
    const total = await p.locator('.cx-lfecha .cx-lf[data-com]').count();
    const primera = iso[0];
    await p.fill('#cxDesde', primera); await p.dispatchEvent('#cxDesde', 'change'); await p.waitForTimeout(150);
    const conDesde = await p.locator('.cx-lfecha .cx-lf[data-com]').count();
    ok(nombre + ': Desde deja solo lo instalado desde esa fecha', conDesde >= 1 && conDesde < total, [conDesde, total]);
    await p.click('[data-sin-fechas]'); await p.waitForTimeout(150);
    ok(nombre + ': Quitar fechas vuelve a mostrar todo', (await p.locator('.cx-lfecha .cx-lf[data-com]').count()) === total);
    await p.click('[data-vista="dueno"]'); await p.waitForSelector('.cx-grupo');
    // Hoja: todo cerrado, sin "Más acciones", con "Corte y comisión" y la nota en el hilo
    if(!(await p.locator('.cx-grupo.abierto .cx-fila2').count())) await p.locator('.cx-grupo:not(.bandeja-extra) .grupo-cab').first().click();
    await p.locator('.cx-grupo.abierto .cx-fila2[data-com]').first().click(); await p.waitForSelector('#hojaComision.ver #cuerpoCom .plg-com', { timeout: 15000 });
    const abiertas = await p.$$eval('#cuerpoCom .plg-com > .plegado', (b) => b.filter((x) => x.getAttribute('aria-expanded') === 'true').length);
    ok(nombre + ': al abrir la hoja todas las secciones están cerradas', abiertas === 0, abiertas);
    const txt = await p.textContent('#cuerpoCom');
    ok(nombre + ': ya no hay "Más acciones"; sale "Corte y comisión"', !/Más acciones/.test(txt) && /Corte y comisión/.test(txt));
    const orden = await p.$$eval('#cuerpoCom .plg-com', (s) => s.map((x) => x.dataset.plg));
    ok(nombre + ': secciones en el orden de la maqueta', orden.join(',').indexOf('orden,legal,pago,carta') === 0 && orden.slice(-2).join(',') === 'corte,hilo', orden);
    await p.click('[data-plg-btn="hilo"]');
    ok(nombre + ': Escribir una nota está en el Hilo', (await p.locator('[data-plg="hilo"] #verHiloNota').count()) === 1);
    // Carta: al descargar pregunta si se va a enviar por WhatsApp y queda anotada la descarga
    if(await p.locator('[data-plg-btn="carta"]').count()){
      await p.click('[data-plg-btn="carta"]');
      if(await p.locator('#cartaPdfs').count()){
        ok(nombre + ': con número, WhatsApp es el botón principal y dice a quién se envía; sin número, Descargar en color', (await p.locator('#cartaWa').count()) === 1 ? /Se envía a/.test(await p.textContent('[data-plg="carta"]')) : /Sin número/.test(await p.textContent('[data-plg="carta"]')));
        await enHoja(p, '#cartaPdfs'); await p.click('#cartaPdfs'); await p.waitForSelector('#hojaDescargada.ver');
        ok(nombre + ': al descargar sale "¿La vas a enviar por WhatsApp?" con Ya la envié y Solo descargar', /La vas a enviar por WhatsApp/.test(await p.textContent('#hojaDescargada')) && (await p.locator('#descOtro').count()) === 1 && (await p.locator('#descSolo').count()) === 1);
        await p.screenshot({ path: 'capturas/lote12nov-descargada-' + nombre + '.png' });
        await p.waitForFunction(() => true); await p.waitForTimeout(200);
        ok(nombre + ': la descarga queda anotada (para el aviso de las 2 horas)', (mundo.bitacora || []).some((b) => b.accion === 'carta_descargada'));
        await p.click('#descSolo');
      } else ok(nombre + ': (esta fila no tiene carta para descargar)', true);
    } else ok(nombre + ': (esta fila no tiene la sección de carta)', true);
    ok(nombre + ': sin desborde con la hoja', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/lote10nov-D-' + nombre + '-hoja.png', fullPage: false });
    await ctx.close();
  }
  ok('sin errores de JavaScript', !errores.length, errores.slice(0, 3));
  await nav.close(); cerrar();
})();
