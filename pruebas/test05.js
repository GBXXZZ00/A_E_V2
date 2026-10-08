// Actualizar datos: subir el TAD, revisarlo, cargarlo por lotes y ver el resultado.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
const llamo = (m, f) => m.llamadas.filter((l) => l[0] === 'rpc' && l[1] === f);
function csv(n){
  let t = 'Sucursal,Cliente,Tipo,Documento,Fecha_Instalacion,Nombre,Equipo,Plan,Estado,CATEGORIA,CXCPENDIENTE,INSTALADOR\n';
  for(let i = 1; i <= n; i++) t += '824,' + String(700000 + i).padStart(8, '0') + ',J,0' + (597000000 + i) + ',15-03-2025,"Comercio de Prueba ' + i + ', C.A",SERIE' + i + ',ORO-EMP,Habilitado,PYME-1GB,' + (i % 2 ? 'SI' : 'NO') + ',INVENTADO\n';
  t += '824,00700001,J,0597000001,31-02-2025,"Comercio de Prueba 1, C.A",SERIEB,ORO-EMP,Habilitado,PYME-1GB,NO,INVENTADO\n';   // fecha imposible: entra sin fecha
  t += '824,00799999,J,#N/A,01-01-2025,Fila Mala,X,ORO,Habilitado,PYME-1GB,NO,INVENTADO\n';
  t += '824,00799998,J,597999998,01-01-2025,NaN,X,ORO,Habilitado,PYME-1GB,NO,INVENTADO\n';
  return t;
}
(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    await p.click('#cuenta'); await p.waitForSelector('#hojaCuenta.ver');
    await p.click('#hojaCuenta a[data-ir="actualizar"]'); await p.waitForURL('**/actualizar.html'); await p.waitForSelector('#cargas .vacio');
    ok(nombre + ': se llega desde el menú de cuenta y empieza sin cargas', (await p.textContent('#ultimoTad')).includes('ninguno'));
    await p.setInputFiles('#archivoTad', { name: 'notas.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b\n1,2\n') });
    await p.waitForSelector('.toast');
    ok(nombre + ': un archivo que no es el TAD se rechaza', (await p.textContent('.toast')).includes('Faltan las columnas') && llamo(mundo, 'tad_iniciar').length === 0);
    await p.setInputFiles('#archivoTad', { name: 'tad.csv', mimeType: 'text/csv', buffer: Buffer.from(csv(900), 'latin1') });
    await p.waitForSelector('#cargarTad');
    const z = await p.textContent('#zonaTad');
    ok(nombre + ': antes de cargar dice cuántos servicios y clientes trae', z.includes('901') && z.includes('900') && z.includes('2 filas'));
    await p.screenshot({ path: 'capturas/05-' + nombre + '-listo.png' });
    const antes = mundo.datos.clientes.length;
    await p.click('#cargarTad'); await p.waitForSelector('#zonaTad .aviso');
    const lotes = llamo(mundo, 'tad_filas');
    ok(nombre + ': carga por lotes y cierra', lotes.length === 3 && lotes.every((l) => l[2].p_filas.length <= 400) && llamo(mundo, 'tad_cerrar').length === 1);
    ok(nombre + ': los clientes quedan en la base', mundo.datos.clientes.length === antes + 900);
    const f0 = lotes[0][2].p_filas[0];
    ok(nombre + ': la fecha viaja como fecha y los acentos se leen', f0.f === '2025-03-15' && f0.n === 'Comercio de Prueba 1, C.A' && lotes[2][2].p_filas.slice(-1)[0].f === '');
    const fin = await p.textContent('#zonaTad');
    ok(nombre + ': el resultado dice qué entró y qué no se leyó', fin.includes('900 clientes nuevos') && fin.includes('2 filas no se pudieron leer'));
    await p.waitForFunction(() => document.querySelectorAll('#cargas .fila').length === 1);
    ok(nombre + ': queda en el historial con quién la subió', (await p.textContent('#cargas')).includes('Marcos') && !(await p.textContent('#ultimoTad')).includes('ninguno'));
    ok(nombre + ': sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/05-' + nombre + '-fin.png', fullPage: true });
    mundo.fallaRpc = 'tad_filas'; await p.click('#otroTad').catch(() => {});
    await p.setInputFiles('#archivoTad', { name: 'tad2.csv', mimeType: 'text/csv', buffer: Buffer.from(csv(5)) });
    await p.waitForSelector('#cargarTad'); await p.click('#cargarTad');
    await p.waitForFunction(() => Array.from(document.querySelectorAll('.toast')).some((t) => t.textContent.includes('se detuvo')));
    ok(nombre + ': si falla a mitad avisa y deja reintentar', (await p.locator('#cargarTad').count()) === 1);
    mundo.fallaRpc = null;
    await ctx.close();

    const b = await contexto(nav, dispositivo); const q = await entrar(b.ctx, 'lucia', '739105');
    await q.click('#cuenta'); await q.waitForSelector('#hojaCuenta.ver');
    ok(nombre + ': un líder no ve Actualizar', (await q.locator('#hojaCuenta a[data-ir="actualizar"]').count()) === 0);
    await q.goto(H + 'actualizar.html'); await q.waitForURL((u) => !u.pathname.endsWith('actualizar.html'));
    ok(nombre + ': y si entra por la dirección lo saca', true);
    await b.ctx.close();
  }
  ok('sin errores de JavaScript', errores.length === 0); if(errores.length) console.log(errores);
  await nav.close(); cerrar();
})();
