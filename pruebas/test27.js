// Lote 2, parte B: Actualizar con un solo cuadro. El archivo de dedicados de la analista (Excel de varias hojas, datos inventados)
// se reconoce por los nombres de sus hojas, sube cada hoja por partes y se aplica al cerrar; solo el administrador;
// el mapa vigente se ve dentro del cuadro; sin cargas pendientes el cruce dice que todo está cruzado.
const { execFileSync } = require('child_process');
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();

// Excel mínimo con tres hojas (texto en línea, sin sharedStrings), armado con Python sin librerías externas
function excelDedicados(){
  const py = String.raw`
import zipfile, io, sys
def celda(ref, v):
    if v is None: return ''
    if isinstance(v, (int, float)): return '<c r="%s"><v>%s</v></c>' % (ref, v)
    v = str(v).replace('&','&amp;').replace('<','&lt;')
    return '<c r="%s" t="inlineStr"><is><t>%s</t></is></c>' % (ref, v)
def hoja(filas):
    out = []
    for i, f in enumerate(filas, 1):
        cs = ''.join(celda(chr(65 + j) + str(i), v) for j, v in enumerate(f))
        out.append('<row r="%d">%s</row>' % (i, cs))
    return '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>%s</sheetData></worksheet>' % ''.join(out)
enlaces = [['Titulo del reporte'], ['EJECUTIVO','COD.','ACTIVO / SUSPENDIDO','TIPO DE CLIENTE','RAZON SOCIAL','COD. ENLACE','NODO','SERVICIO','FECHA DE INICIO','Tarifa','RIF'],
  ['EJECUTIVA INVENTADA','00000901','ACTIVO','ISP','RED INVENTADA, C.A.','CRM-SRV-AIRTEK-001.12/009001','NODO PRUEBA','INTERNET',44445,2,'J400000001'],
  ['EJECUTIVA INVENTADA','00000901','SUSPENDIDO','ISP','RED INVENTADA, C.A.',None,'NODO PRUEBA 2','TRANSPORTE',None,1,'J400000001']]
clientes = [['COD.','RAZON SOCIAL','RIF','DIRECCIÓN FISCAL','PRESIDENCIA',None,'CONTACTO ADMINISTRATIVO',None],
  ['00000901','RED INVENTADA, C.A.','J400000001','Calle inventada','414 0000001','PERSONA UNO','414 0000002','PERSONA DOS']]
base = [['COD.','RAZON SOCIAL','RIF.','Correo'], ['00000901','RED INVENTADA, C.A.','J400000001','info@inventada.test']]
z = io.BytesIO(); w = zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED)
w.writestr('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
w.writestr('xl/workbook.xml', '<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="RESUMEN (enlaces)" sheetId="1" r:id="rId1"/><sheet name="RESUMEN (clientes y contactos)" sheetId="2" r:id="rId2"/><sheet name="base de contacto" sheetId="3" r:id="rId3"/></sheets></workbook>')
w.writestr('xl/_rels/workbook.xml.rels', '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Target="worksheets/sheet3.xml"/></Relationships>')
w.writestr('xl/worksheets/sheet1.xml', hoja(enlaces)); w.writestr('xl/worksheets/sheet2.xml', hoja(clientes)); w.writestr('xl/worksheets/sheet3.xml', hoja(base))
w.close(); sys.stdout.buffer.write(z.getvalue())`;
  return execFileSync('python3', ['-c', py]);
}

(async () => {
  const nav = await chromium.launch(); const errores = []; const xlsx = excelDedicados();
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'actualizar.html'); await p.waitForSelector('#zona .soltar');
    ok(nombre + ': un solo cuadro de archivos, sin panel aparte del mapa', (await p.locator('.panel').count()) === 2 && (await p.textContent('#zona').then(() => p.textContent('main'))).includes('archivo de dedicados'));
    ok(nombre + ': el mapa vigente se ve dentro del cuadro', (await p.textContent('.sub-mapa')).includes('Mapa de red'));
    await p.waitForFunction(() => /Todo cruzado/.test(document.querySelector('#cruce').textContent));
    ok(nombre + ': sin cargas pendientes, el cruce dice que todo está cruzado y no pide botones', (await p.locator('#cruce button').count()) === 0);
    await p.setInputFiles('#archivos', { name: 'DEDICADO_prueba.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: xlsx });
    await p.waitForSelector('#cargarTodo');
    const fila = await p.textContent('#listaArch');
    ok(nombre + ': reconoce el archivo de dedicados por sus hojas', fila.includes('Dedicados (archivo de la analista)') && fila.includes('1 cliente y 2 enlaces') && fila.includes('no toca comisiones'));
    await p.click('#cargarTodo');
    await p.waitForFunction(() => /archivo cargado/.test(document.querySelector('#zona').textContent));
    const partes = mundo.llamadas.filter((l) => l[1] === 'dedicados_parte');
    ok(nombre + ': sube las tres hojas con su encabezado', partes.length === 3 && partes.some((l) => l[2].p_hoja === 'RESUMEN (enlaces)' && l[2].p_cols.includes('COD. ENLACE')) && partes.some((l) => l[2].p_hoja === 'base de contacto'));
    const enl = partes.find((l) => l[2].p_hoja === 'RESUMEN (enlaces)')[2];
    ok(nombre + ': salta el título del reporte y pasa la fecha de Excel a fecha', enl.p_filas.length === 2 && enl.p_filas[0][8] === new Date(Date.UTC(1899, 11, 30) + 44445 * 864e5).toISOString().slice(0, 10));
    const cli = partes.find((l) => l[2].p_hoja === 'RESUMEN (clientes y contactos)')[2];
    ok(nombre + ': las columnas sin título quedan con su posición (el nombre del contacto)', cli.p_cols[5] === 'col5' && cli.p_filas[0][5] === 'PERSONA UNO');
    ok(nombre + ': cierra la carga y dice el resultado', mundo.llamadas.some((l) => l[1] === 'dedicados_cerrar') && (await p.textContent('#listaArch')).includes('1 dedicado') && (await p.textContent('#zona')).includes('No hace falta cruce'));
    await p.waitForFunction(() => /Dedicados/.test(document.querySelector('#cargas').textContent));
    ok(nombre + ': el historial lo muestra aplicado al subir', (await p.textContent('#cargas')).includes('Aplicada al subir'));
    ok(nombre + ': sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/27-' + nombre + '-actualizar.png', fullPage: true });
    // F2: órdenes de instalación desde enero: van solo a Aliados y no entran al cruce
    await p.click('#otro');
    await p.setInputFiles('#archivos', { name: 'ordenes_enero.csv', mimeType: 'text/csv', buffer: Buffer.from('Pref;Codcliente;Nombre;Cedula;Feccump;Usuario;Tipo;Categoria;Contratista\n824;700101;Comercio Inventado;597000101;2026-01-15 10:00:00;SERIE9;INSTALACION;pyme-1gb;ALIADO INVENTADO\n824;700102;Otro Inventado;597000102;2026-09-05 10:00:00;SERIE8;INSTALACION;pyme-1gb;INSTALADOR UNO\n') });
    await p.waitForSelector('#cargarTodo');
    ok(nombre + ': un archivo de órdenes con fechas de enero va solo a Aliados y lo dice', /Va solo a Aliados/.test(await p.textContent('#listaArch')) && /desde el/.test(await p.textContent('#listaArch')));
    await p.click('[data-para]'); ok(nombre + ': se puede cambiar a comisiones si fuera un error', /Va a comisiones/.test(await p.textContent('#listaArch')));
    await p.click('[data-para]'); ok(nombre + ': y volver a solo aliados', /Va solo a Aliados/.test(await p.textContent('#listaArch')));
    const n0 = mundo.llamadas.filter((l) => l[1] === 'cruce_probar').length;
    await p.click('#cargarTodo'); await p.waitForFunction(() => /archivo cargado/.test(document.querySelector('#zona').textContent));
    ok(nombre + ': se marca solo para aliados al subir y no prepara cruce', mundo.llamadas.some((l) => l[1] === 'carga_solo_aliados') && mundo.llamadas.filter((l) => l[1] === 'cruce_probar').length === n0 && (await p.textContent('#zona')).includes('No hace falta cruce'));
    await p.waitForFunction(() => /Solo aliados/.test(document.querySelector('#cargas').textContent));
    ok(nombre + ': el historial lo marca "Solo aliados"', true);
    await p.screenshot({ path: 'capturas/27-' + nombre + '-solo-aliados.png', fullPage: true });
    await ctx.close();
  }
  // El analista no sube el archivo de dedicados
  const b = await contexto(nav, PC); const q = await entrar(b.ctx, 'elena', '315806').catch(() => null);
  if(q){
    q.on('pageerror', (e) => errores.push(e.message));
    if(!q.url().includes('index.html')){
      await q.goto(H + 'actualizar.html'); await q.waitForSelector('#zona .soltar');
      await q.setInputFiles('#archivos', { name: 'DEDICADO_prueba.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: xlsx });
      await q.waitForFunction(() => /No sirve/.test(document.querySelector('#zona').textContent));
      ok('el analista no puede subir el archivo de dedicados', (await q.textContent('#listaArch')).includes('Solo el administrador'));
    }
  }
  await b.ctx.close();
  ok('sin errores de la página', errores.length === 0); if(errores.length) console.log(errores);
  await nav.close(); cerrar();
})();
