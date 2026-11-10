// Actualizar datos: subir varios archivos juntos, reconocerlos, cargarlos por lotes y ver el resultado.
const { esperarDia, chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
const llamo = (m, f) => m.llamadas.filter((l) => l[0] === 'rpc' && l[1] === f);
function csv(n){
  let t = 'Sucursal,Cliente,Tipo,Documento,Fecha_Instalacion,Nombre,Equipo,Plan,Estado,CATEGORIA,CXCPENDIENTE,INSTALADOR,Telefono,Direccion\n';
  for(let i = 1; i <= n; i++) t += '824,' + String(700000 + i).padStart(8, '0') + ',J,0' + (597000000 + i) + ',15-03-2025,"Comercio de Prueba ' + i + ', C.A",SERIE' + i + ',ORO-EMP,Habilitado,PYME-1GB,' + (i % 2 ? 'SI' : 'NO') + ',INVENTADO,' + (i % 3 ? '41455501' + String(i % 100).padStart(2, '0') : '') + ',Calle inventada ' + i + '\n';
  t += '824,00700001,J,0597000001,31-02-2025,"Comercio de Prueba 1, C.A",SERIEB,ORO-EMP,Habilitado,PYME-1GB,NO,INVENTADO\n';   // fecha imposible: entra sin fecha
  t += '824,00799999,J,#N/A,01-01-2025,Fila Mala,X,ORO,Habilitado,PYME-1GB,NO,INVENTADO\n';
  t += '824,00799998,J,597999998,01-01-2025,NaN,X,ORO,Habilitado,PYME-1GB,NO,INVENTADO\n';
  return t;
}
// Arma un .xlsx mínimo (zip con deflate) para probar la lectura de Excel sin librerías
function xlsx(filas){
  const zlib = require('zlib'); const textos = []; const ix = (t) => { let i = textos.indexOf(t); if(i < 0){ textos.push(t); i = textos.length - 1; } return i; };
  const col = (n) => String.fromCharCode(65 + n);
  const hoja = '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + filas.map((f, r) => '<row r="' + (r + 1) + '">' + f.map((v, c) => v === '' ? '' : '<c r="' + col(c) + (r + 1) + '" t="s"><v>' + ix(v) + '</v></c>').join('') + '</row>').join('') + '</sheetData></worksheet>';
  const sst = '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + textos.map((t) => '<si><t>' + t + '</t></si>').join('') + '</sst>';
  const partes = [['xl/sharedStrings.xml', sst], ['xl/worksheets/sheet1.xml', hoja]]; const loc = []; const cen = []; let pos = 0;
  partes.forEach(([n, t]) => {
    const nb = Buffer.from(n); const crudo = Buffer.from(t, 'utf8'); const z = zlib.deflateRawSync(crudo);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(8, 8); h.writeUInt32LE(z.length, 18); h.writeUInt32LE(crudo.length, 22); h.writeUInt16LE(nb.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 6); c.writeUInt16LE(8, 10); c.writeUInt32LE(z.length, 20); c.writeUInt32LE(crudo.length, 24); c.writeUInt16LE(nb.length, 28); c.writeUInt32LE(pos, 42);
    loc.push(h, nb, z); cen.push(c, nb); pos += 30 + nb.length + z.length;
  });
  const cb = Buffer.concat(cen); const e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(2, 8); e.writeUInt16LE(2, 10); e.writeUInt32LE(cb.length, 12); e.writeUInt32LE(pos, 16);
  return Buffer.concat(loc.concat([cb, e]));
}
(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    await p.click('#cuenta'); await p.waitForSelector('#hojaCuenta.ver');
    await p.click('#hojaCuenta a[data-ir="actualizar"]'); await p.waitForURL('**/actualizar.html'); await p.waitForSelector('#cargas .vacio');
    ok(nombre + ': se llega desde el menú de cuenta y empieza sin cargas; el TAD dice Falta el de hoy', /Falta el de hoy/.test(await p.textContent('#dia [data-k="tad"]')) && /Subir lo del día/.test(await p.textContent('h1')));
    await p.setInputFiles('#archivos', { name: 'notas.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b\n1,2\n') });
    await p.waitForSelector('.toast');
    ok(nombre + ': un archivo desconocido sale en rojo con qué hacer y no se carga', /No reconozco/.test(await p.textContent('#dia .sd-f.rojo')) && /Quitar/.test(await p.textContent('#dia .sd-f.rojo')) && !llamo(mundo, 'crudo_iniciar').length);
    await p.click('[data-quitar]');
    await p.setInputFiles('#archivos', [
      { name: 'tad.csv', mimeType: 'text/csv', buffer: Buffer.from(csv(900), 'latin1') },
      { name: 'odoo.xlsx', mimeType: 'application/octet-stream', buffer: xlsx([['odt', 'tema', 'creado', 'creador', 'etapa', 'fejec', 'rel', 'cliente'], ['OT-1', 'Instalación ñandú', '2026-09-01', 'Inventado', 'Nuevo', '', '', 'Comercio de Prueba 1'], ['OT-2', '#N/A', '', '', 'Hecho', '', '', 'Comercio de Prueba 2']]) },
      { name: 'ordenes.csv', mimeType: 'text/csv', buffer: Buffer.from('Título del reporte\nPref;Codcliente;Nombre;Cedula;Feccump;Usuario;Tipo;Categoria\n824;700001;Comercio de Prueba 1;597000001;2026-09-03 03:57:53 p.m.;SERIE1;INSTALACION;pyme-1gb\n824;700002;Vecino Inventado;12345678;2026-09-03 03:57:53 p.m.;SERIE2;INSTALACION;promo-1gb\n') },
      { name: 'base.csv', mimeType: 'text/csv', buffer: Buffer.from('Sucursal,EJECUTIVO,COD.,RAZON SOCIAL,RIF,TIPO_CLIENTE,ESTATUS_LEGAL\n824,Lucia,700001,Comercio de Prueba 1,597000001,PYMES,CONTRATO FIRMADO\n') }
    ]);
    const antes = mundo.datos.clientes.length;
    await esperarDia(p);
    const z = await p.textContent('#dia');
    ok(nombre + ': reconoce los cuatro archivos por sus columnas, cada uno en su fila', /tad\.csv/.test(await p.textContent('#dia [data-k="tad"]')) && /odoo\.xlsx/.test(await p.textContent('#dia [data-k="odoo"]')) && /ordenes\.csv/.test(await p.textContent('#dia [data-k="instalaciones"]')) && /base\.csv/.test(await p.textContent('#dia [data-k="base_vieja"]')));
    await p.screenshot({ path: 'capturas/05-' + nombre + '-listo.png', fullPage: true });
    const lotes = llamo(mundo, 'tad_filas');
    ok(nombre + ': sin botón de cargar: sube solo, por lotes, y cierra', lotes.length === 3 && lotes.every((l) => l[2].p_filas.length <= 400) && llamo(mundo, 'tad_cerrar').length === 1 && !(await p.locator('#cargarTodo').count()));
    ok(nombre + ': los clientes quedan en la base', mundo.datos.clientes.length === antes + 900);
    const f0 = lotes[0][2].p_filas[0];
    ok(nombre + ': la fecha viaja como fecha y los acentos se leen', f0.f === '2025-03-15' && f0.n === 'Comercio de Prueba 1, C.A' && lotes[2][2].p_filas.slice(-1)[0].f === '');
    const tc = llamo(mundo, 'tad_contactos');
    ok(nombre + ': teléfono y dirección viajan aparte y no en el lote principal', tc.length === 3 && tc[0][2].p_filas[0].di === 'Calle inventada 1' && tc[0][2].p_filas[0].te === '4145550101' && !('te' in f0) && !('di' in f0));
    const cr = llamo(mundo, 'crudo_filas'); const ini = llamo(mundo, 'crudo_iniciar').map((l) => l[2].p_fuente);
    ok(nombre + ': la base anterior, Odoo y las órdenes se guardan en ese orden', ini.join() === 'base_vieja,odoo,instalaciones' && llamo(mundo, 'crudo_cerrar').length === 3);
    const od = cr[1][2].p_filas;
    ok(nombre + ': el Excel se lee con sus tildes y sin valores dañados', od.length === 2 && od[0].tema === 'Instalación ñandú' && od[0].cliente === 'Comercio de Prueba 1' && !('tema' in od[1]) && !('fejec' in od[0]));
    ok(nombre + ': las columnas se guardan con nombre limpio', cr[0][2].p_filas[0].razon_social === 'Comercio de Prueba 1' && cr[0][2].p_filas[0].cod === '700001' && cr[2][2].p_filas[0].feccump.startsWith('2026-09-03'));
    ok(nombre + ': el resultado dice qué entró, en la fila de cada archivo', /900 clientes nuevos/.test(z) && /2 filas no se pudieron leer/.test(z) && /2 filas guardadas/.test(z), z.slice(0, 900));
    ok(nombre + ': el cruce corre solo al terminar (sin Cruzar ahora) y las filas quedan Leído, Cruzado y Listo', mundo.cruceAplicado === true && !(await p.locator('#cruzarAhora, #aplicarCruce').count()) && /Leído\s*Cruzado\s*Listo/.test(await p.textContent('#dia [data-k="odoo"]')));
    await p.click('#detCruce summary'); const cz = await p.textContent('#cruce');
    ok(nombre + ': Ver detalle del cruce dice qué cambió', cz.includes('9 clientes reciben su líder') && cz.includes('Comisiones de octubre') && cz.includes('3 quedan pendientes por asignar'));
    await p.waitForFunction(() => document.querySelectorAll('#cargas .sd-h:not(.sd-hcab)').length === 4);
    ok(nombre + ': queda en el historial (tabla) con quién la subió', (await p.textContent('#cargas')).includes('Marcos') && (await p.textContent('#cargas')).includes('TAD'));
    ok(nombre + ': sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/05-' + nombre + '-fin.png', fullPage: true });
    mundo.fallaRpc = 'tad_filas';
    await p.setInputFiles('#archivos', [{ name: 'tad2.csv', mimeType: 'text/csv', buffer: Buffer.from(csv(5)) }, { name: 'tad3.csv', mimeType: 'text/csv', buffer: Buffer.from(csv(3)) }]);
    await p.waitForFunction(() => Array.from(document.querySelectorAll('.toast')).some((t) => t.textContent.includes('se detuvo')));
    const dz = await p.textContent('#dia');
    ok(nombre + ': dos archivos del mismo tipo no se mezclan', dz.includes('Ya hay otro archivo de TAD'));
    ok(nombre + ': si falla a mitad avisa y deja reintentar en la fila', (await p.locator('[data-reintentar]').count()) === 1 && /La carga se detuvo/.test(dz));
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
