// Lote 12/11 B, parte 4: Actualizar datos (barras de subida, historial por día y por semana) y "Ya la envié" en un toque (maqueta 8a, 8b y 8c). Datos inventados.
const { ddAbrir, ddClick, esperarDia, chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar, enHoja } = require('./simulador');
const { ok, cerrar } = marcador();
function csv(n){
  let t = 'Sucursal,Cliente,Tipo,Documento,Fecha_Instalacion,Nombre,Equipo,Plan,Estado,CATEGORIA,CXCPENDIENTE,INSTALADOR,Telefono,Direccion\n';
  for(let i = 1; i <= n; i++) t += '824,' + String(700000 + i).padStart(8, '0') + ',J,0' + (597000000 + i) + ',15-03-2025,"Comercio de Prueba ' + i + ', C.A",SERIE' + i + ',ORO-EMP,Habilitado,PYME-1GB,NO,INVENTADO,04140000000,Calle\n';
  return t;
}
(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['pc', PC], ['tel', TEL]]){
    // Historial agrupado
    { const { ctx, mundo } = await contexto(nav, dispositivo);
      const d = (n, h) => { const t = new Date(); t.setDate(t.getDate() - n); t.setHours(h, 40, 0, 0); return t.toISOString(); };
      mundo.cargas = [[0, 12, 'tad'], [0, 12, 'ip'], [0, 12, 'odoo'], [1, 12, 'tad'], [9, 12, 'tad'], [10, 12, 'odoo'], [17, 12, 'tad']].map((x, i) => ({ id: 500 + i, fuente: x[2], en: d(x[0], x[1]), archivo: x[2] + '_prueba.xlsx', por: 'Marcos Rivas', filas: 120, estado: i === 5 ? 'fallo' : 'lista', resumen: {} }));
      const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(nombre + ': ' + e.message));
      await p.goto(H + 'actualizar.html'); await p.waitForSelector('#cargas .sd-hist2', { timeout: 15000 });
      const grupos = await p.$$eval('#cargas .sd-dia b', (b) => b.map((x) => x.textContent));
      ok(nombre + ': Hoy y Ayer abiertos por día', grupos[0] === 'Hoy' && grupos[1] === 'Ayer' && /3 cargas/.test(await p.textContent('#cargas .sd-hgr .sd-dia')));
      const pl = await p.$$eval('#cargas details.sd-pl > summary', (s) => s.map((x) => x.textContent));
      ok(nombre + ': las semanas anteriores van plegadas por semana', pl.some((t) => /^Semana del/.test(t)) && (await p.locator('#cargas details.sd-pl[open]').count()) === 0, pl);
      ok(nombre + ': la semana con una carga que no terminó lo avisa', pl.some((t) => /no terminó/.test(t)));
      ok(nombre + ': sin desborde', await sinDesborde(p));
      await p.screenshot({ path: 'capturas/lote12novB-p4-hist-' + nombre + '.png', fullPage: true });
      // Subiendo: la zona dice "Subiendo N archivos" y cada archivo tiene su barra
      mundo.lento = 700;
      await p.setInputFiles('#archivos', [{ name: 'tad1.csv', mimeType: 'text/csv', buffer: Buffer.from(csv(4)) }]);
      await p.waitForSelector('#zona .sd-subiendo, #dia .sd-barra2', { timeout: 8000 }).catch(() => {});
      ok(nombre + ': mientras sube, la fila tiene su barra', (await p.locator('#dia .sd-barra2').count()) >= 1);
      await esperarDia(p, 60000);
      ok(nombre + ': al terminar ya no queda ninguna barra corriendo y la zona vuelve a "Suelta aquí"', (await p.locator('#dia .sd-barra2.ind, #zona .sd-subiendo').count()) === 0 && /Suelta aquí/.test(await p.textContent('#zona')));
      await ctx.close(); }
    // Carta descargada: "Ya la envié" marca con fecha de hoy y sale el aviso con Cambiar
    { const { ctx, mundo } = await contexto(nav, dispositivo);
      const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(nombre + ' carta: ' + e.message));
      await p.goto(H + 'comisiones.html'); await p.waitForSelector('#equipos [data-equipo]', { state: 'attached', timeout: 15000 });
      await p.click('#filtros [data-filtro="carta"]'); await p.click('[data-vista="fecha"]'); await p.waitForSelector('.cx-lfecha .cx-lf[data-com]');
      await p.locator('.cx-lfecha .cx-lf[data-com]').first().click(); await p.waitForSelector('#hojaComision.ver #cuerpoCom .plg-com', { timeout: 15000 });
      await enHoja(p, '#cartaPdfs'); await p.click('#cartaPdfs'); await p.waitForSelector('#hojaDescargada.ver');
      const t = await p.textContent('#hojaDescargada');
      ok(nombre + ': la hoja trae Ya la envié y Solo descargar', /Ya la envié/.test(t) && /Solo descargar/.test(t) && !/por otro lado/.test(t));
      await p.click('#descOtro'); await p.waitForSelector('.toast .toast-acc', { timeout: 8000 });
      const m = mundo.llamadas.filter((l) => l[1] === 'carta_marcar_enviada').slice(-1)[0];
      ok(nombre + ': "Ya la envié" marca carta y proforma con la fecha de hoy, sin preguntar', !!m && m[2].p_que === 'ambas' && m[2].p_canal === 'otro' && !!m[2].p_fecha && (await p.locator('#hojaMarcarCarta.ver').count()) === 0);
      ok(nombre + ': sale "Marcada como enviada hoy" con Cambiar', /Marcada como enviada hoy/.test(await p.textContent('.toast.con-acc')) && /Cambiar/.test(await p.textContent('.toast-acc')));
      await p.screenshot({ path: 'capturas/lote12novB-p4-carta-' + nombre + '.png' });
      await p.click('.toast-acc'); await p.waitForSelector('#hojaMarcarCarta.ver');
      ok(nombre + ': "Cambiar" abre la hoja de siempre (qué, cuándo y por dónde)', (await p.locator('#formMarcar input[name="mcCanal"]').count()) === 4);
      await ctx.close(); }
  }
  ok('sin errores de JavaScript', errores.length === 0, errores.slice(0, 3));
  await nav.close(); cerrar();
})();
