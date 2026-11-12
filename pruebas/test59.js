// Lote 12/11 B, parte 1: drawer de la comisión a 600 px (maqueta comisiones-hoja.html 2, 3, 5 y 7) y Mi trabajo que abre ese mismo drawer.
// Tabla: cada tipo de tarea de comisión abre el drawer; las que no tienen cliente caen en su sitio exacto. Datos inventados.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['pc', PC], ['tel', TEL]]){
    // Analista de Canales: "Escribir IP" desde Mi trabajo abre el drawer de Comisiones y encima la hoja de la IP
    { const { ctx, mundo } = await contexto(nav, dispositivo);
      mundo.personas.find((p) => p.usuario === 'pedro').debe_cambiar_pin = false;
      (mundo.datos.ipReporte = mundo.datos.ipReporte || []).push({ id: 9901, ip: '192.0.2.50', ip6: '2001:db8::50/128', libre: true }, { id: 9902, ip: '192.0.2.51', libre: true });
      const p = await entrar(ctx, 'pedro', '204871'); p.on('pageerror', (e) => errores.push(nombre + ': ' + e.message));
      await p.goto(H + 'trabajo.html'); await p.waitForSelector('.cn-tiles', { timeout: 15000 });
      await p.click('[data-cn-eq="1"]'); await p.waitForTimeout(200);
      await p.locator('[data-cn-hacer]').filter({ hasText: 'Escribir IP' }).first().click();
      await p.waitForSelector('#hojaIp.ver #ipZona .ipf', { timeout: 15000 });
      ok(nombre + ': sin_ip abre el drawer de Comisiones y encima la hoja de la IP, sin salir de Mi trabajo', p.url().includes('trabajo.html') && (await p.evaluate(() => window.Comun.hojasAbiertas().join())) === 'hojaComision,hojaIp');
      const ip = await p.textContent('#hojaIp');
      ok(nombre + ': la hoja de la IP trae el aviso, Libres del pool con "Siguiente", Parecidos y ¿No es ninguna?', /Confírmala en el sistema técnico antes de usarla/.test(ip) && /Libres del pool/.test(ip) && /Siguiente/.test(ip) && /Parecidos en el reporte/.test(ip) && /¿No es ninguna\?/.test(ip));
      ok(nombre + ': la primera libre lleva el botón en color y las otras en blanco', (await p.locator('#hojaIp .ipf').first().locator('.hc-b:not(.s)').count()) === 1 && (await p.locator('#hojaIp .ipf').nth(1).locator('.hc-b.s').count()) === 1);
      ok(nombre + ': sin desborde con la hoja de la IP', await sinDesborde(p));
      await p.screenshot({ path: 'capturas/lote12novB-p1-ip-' + nombre + '.png' });
      await p.locator('#hojaIp [data-ip-fila]').first().click();
      await p.waitForFunction(() => !document.querySelector('#hojaIp.ver'), null, { timeout: 8000 });
      ok(nombre + ': "Usar" guarda la IP, cierra la hoja y vuelve al drawer', (mundo.bitacora || []).some((b) => b.accion === 'servicio_ip') && (await p.evaluate(() => window.Comun.hojasAbiertas().join())) === 'hojaComision');
      // Drawer: cabecera sin contactar, aviso de estado arriba, bloques iguales
      await p.waitForSelector('#hojaComision.ver #cuerpoCom .plg-com');
      ok(nombre + ': la cabecera solo trae "Ver expediente completo"', (await p.locator('#cabCom #abrirExp').count()) === 1 && (await p.locator('#cabCom .ct-zona').count()) === 0 && (await p.locator('#hojaComision .datos-com').count()) === 0);
      ok(nombre + ': todos los bloques llevan punto, pastilla y flecha', await p.evaluate(() => [...document.querySelectorAll('#hojaComision .plg-com > .plegado')].every((b) => b.querySelector('.pt') && b.querySelector('.m') && b.querySelector('svg'))));
      ok(nombre + ': el bloque se llama "Carta y proforma"', /^Carta y proforma/.test((await p.textContent('[data-plg-btn="carta"] .plg-tx')).trim()));
      const txt = await p.textContent('#plg-carta');
      ok(nombre + ': sin las notas largas de antes', !/Ya enviada" es para|debe enviarla siempre|Un toque: abre el chat/.test(txt));
      ok(nombre + ': "Ya enviada (marcar)" ahora es "Ya la envié"', !/Ya enviada \(marcar\)/.test(txt));
      if(nombre === 'pc') ok('pc: el drawer mide 600 px', Math.round((await p.locator('#hojaComision').boundingBox()).width) === 600);
      await p.screenshot({ path: 'capturas/lote12novB-p1-drawer-' + nombre + '.png' });
      await ctx.close(); }
    // Administrador: las tareas sin cliente caen en su sitio exacto
    { const { ctx, mundo } = await contexto(nav, dispositivo);
      const marcos = mundo.personas.find((p) => p.usuario === 'marcos');
      const base = (t, k, ref) => ({ tipo: t, clave: k, cliente_id: null, titulo: 'Tarea ' + t, detalle: 'Prueba', para: 'admin', lider_id: null, analista_id: null, desde: new Date().toISOString(), vence: null, ref: ref || {} });
      mundo.datos.pendientes = [base('cerrar_corte', 'c1'), base('por_asignar', '77', { corte: '2026-11-01', instalacion: 77 }), base('referido', '5'), base('certificar', '78', { corte: '2026-11-01', instalacion: 78 })];
      const casos = [['cerrar_corte|c1', 'comisiones.html?cierre=1'], ['por_asignar|77', 'comisiones.html?f=asignar&c=2026-11'], ['referido|5', 'aliados.html?ref=5'], ['certificar|78', 'comisiones.html?f=falta&c=2026-11']];
      const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(nombre + ' admin: ' + e.message));
      for(const [k, destino] of casos){
        await p.goto(H + 'trabajo.html'); await p.waitForSelector('[data-hacer="' + k + '"]', { state: 'attached', timeout: 15000 }).catch(() => {});
        if(!(await p.locator('[data-hacer="' + k + '"]').count())){ ok(nombre + ': (no sale la tarea ' + k + ')', false); continue; }
        await p.evaluate((kk) => document.querySelector('[data-hacer="' + kk + '"]').click(), k);
        await p.waitForURL((u) => !String(u).includes('trabajo.html'), { timeout: 10000 }).catch(() => {});
        ok(nombre + ': ' + k.split('|')[0] + ' sin cliente lleva a ' + destino, p.url().endsWith(destino), p.url());
      }
      await ctx.close(); }
  }
  ok('sin errores de JavaScript', errores.length === 0, errores.slice(0, 3));
  await nav.close(); cerrar();
})();
