// Lote 05/11, parte A: Inicio y Mi trabajo con la misma cuenta; la Analista Senior no aprueba ni devuelve documentos
// ni ve la revisión de documentos; texto de la póliza VGT (responsabilidad civil general mínimo US$ 100.000).
// Datos inventados (mundo.js).
const { chromium, H, TEL, PC, contexto, marcador, entrar } = require('./simulador');
const { RPC } = require('./mundo');
const { ok, cerrar } = marcador();

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['pc', PC], ['tel', TEL]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    // Una sola fuente: el total de Inicio es el número de ítems de Mi trabajo, para cada persona
    const iguales = mundo.personas.filter((p) => p.activo && ['admin', 'analista', 'lider'].includes(p.rol)).every((p) => {
      const r = RPC.trabajo_resumen(mundo, p); const t = RPC.mi_trabajo(mundo, p, {});
      return r && r.total === (t.items || []).length;
    });
    ok(nombre + ': Inicio y Mi trabajo cuentan lo mismo para cada persona', iguales);
    const elena = mundo.personas.find((p) => p.senior);
    ok(nombre + ': la Analista Senior no recibe revisión de documentos en Mi trabajo', !(RPC.mi_trabajo(mundo, elena, {}).items || []).some((i) => ['revisar_docs', 'cambio_revisar'].includes(i.tipo)));
    // La Senior abre el expediente con documentos por revisar: no ve Aprobar ni Devolver
    const p = await entrar(ctx, 'elena', '315806'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'cliente.html?id=1001&t=documentos&revisar=1'); await p.waitForSelector('[data-casilla], .vacio', { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(800);
    ok(nombre + ': la Senior no ve Aprobar ni Devolver', !(await p.locator('#verAprobar, #verDevolver').count()));
    // Parte B1: el TAD lee las fechas por palabra en el encabezado; sin fechas, la carga sale en rojo
    await ctx.close();
    const { ctx: ctx2, mundo: mundo2 } = await contexto(nav, dispositivo);
    const a = await entrar(ctx2, 'marcos', '482913'); a.on('pageerror', (e) => errores.push(e.message));
    const cab = 'Sucursal,Cliente,Tipo,Documento,Fecha_Instalacion,Nombre,Equipo,Plan,Estado,CATEGORIA,CXCPENDIENTE,INSTALADOR,Telefono,Direccion';
    const fila = (i, extra) => '824,' + String(710000 + i).padStart(8, '0') + ',J,0' + (598000000 + i) + ',15-03-2025,"Comercio Prueba ' + i + '",SERIEB' + i + ',ORO-EMP,Habilitado,PYME-1GB,NO,INVENTADO,,Calle ' + i + (extra || '');
    let t = cab + '\n'; for(let i = 1; i <= 5; i++) t += fila(i) + '\n';
    await a.goto(H + 'actualizar.html'); await a.waitForSelector('#zona');
    await a.setInputFiles('#archivos', { name: 'tad.csv', mimeType: 'text/csv', buffer: Buffer.from(t) });
    await a.waitForSelector('#cargarTodo'); await a.uncheck('[data-con-indice]').catch(() => {}); await a.click('#cargarTodo'); await a.waitForSelector('#otro', { timeout: 20000 });
    ok(nombre + ': un TAD sin fechas de suspensión ni habilitación sale en rojo y lo explica', /Sin fechas/.test(await a.textContent('#listaArch')) && /no trajo fechas/.test(await a.textContent('#listaArch')));
    await a.click('#otro');
    t = cab + ',Fecha Ultima Suspension,Fecha Reconexion\n'; for(let i = 1; i <= 5; i++) t += fila(i, ',2026/10/0' + i + ',05-oct-2026') + '\n';
    await a.setInputFiles('#archivos', { name: 'tad2.csv', mimeType: 'text/csv', buffer: Buffer.from(t) });
    await a.waitForSelector('#cargarTodo'); await a.uncheck('[data-con-indice]').catch(() => {}); await a.click('#cargarTodo'); await a.waitForSelector('#otro', { timeout: 20000 });
    const ult = mundo2.cargas.filter((c) => c.fuente === 'tad').slice(-1)[0];
    ok(nombre + ': con columnas "Fecha Ultima Suspension" y "Fecha Reconexion" lee las fechas y guarda qué columnas usó', ult.resumen.con_fechas === 5 && ult.resumen.columnas_fechas && /suspension/.test(ult.resumen.columnas_fechas.suspension) && /reconexion/.test(ult.resumen.columnas_fechas.habilitacion) && !/Sin fechas/.test(await a.textContent('#listaArch')));
    // Lote 10/11 A1: encabezados reales ULTSUPENSION y ULTACTIVACION; 01-01-1900 significa "nunca" y se guarda vacío
    await a.click('#otro');
    t = cab + ',ULTSUPENSION,ULTACTIVACION\n';
    for(let i = 1; i <= 5; i++) t += fila(i, i <= 3 ? ',0' + i + '-10-2026,1' + i + '-10-2026' : ',01-01-1900,01-01-1900') + '\n';
    await a.setInputFiles('#archivos', { name: 'tad3.csv', mimeType: 'text/csv', buffer: Buffer.from(t) });
    await a.waitForSelector('#cargarTodo'); await a.uncheck('[data-con-indice]').catch(() => {}); await a.click('#cargarTodo'); await a.waitForSelector('#otro', { timeout: 20000 });
    const u3 = mundo2.cargas.filter((c) => c.fuente === 'tad').slice(-1)[0];
    ok(nombre + ': lee ULTSUPENSION y ULTACTIVACION; 01-01-1900 queda vacío (3 de 5 con fechas)', u3.resumen.con_fechas === 3 && u3.resumen.columnas_fechas && u3.resumen.columnas_fechas.suspension === 'ultsupension' && u3.resumen.columnas_fechas.habilitacion === 'ultactivacion', u3.resumen);
    await ctx2.close();
  }
  ok('sin errores de JavaScript', !errores.length, errores.slice(0, 3));
  await nav.close(); cerrar();
})();
