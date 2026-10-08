// Archivos que la app arma sola, sin librerías: Excel (.xlsx) y descargas.
(function(){
  'use strict';
  const enc = new TextEncoder();

  // ---------- ZIP sin compresión (lo que pide un .xlsx) ----------
  let TABLA = null;
  function crc32(b){
    if(!TABLA){ TABLA = new Uint32Array(256); for(let n = 0; n < 256; n++){ let c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; TABLA[n] = c >>> 0; } }
    let c = 0xFFFFFFFF;
    for(let i = 0; i < b.length; i++) c = TABLA[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  // archivos: [{ nombre, datos: Uint8Array | string }]
  function zip(archivos){
    const partes = []; const central = []; let pos = 0;
    archivos.forEach((a) => {
      const nombre = enc.encode(a.nombre); const datos = typeof a.datos === 'string' ? enc.encode(a.datos) : a.datos; const crc = crc32(datos);
      const cab = new DataView(new ArrayBuffer(30));
      cab.setUint32(0, 0x04034b50, true); cab.setUint16(4, 20, true); cab.setUint16(6, 0x0800, true); cab.setUint16(8, 0, true);
      cab.setUint16(10, 0, true); cab.setUint16(12, 0x21, true); cab.setUint32(14, crc, true); cab.setUint32(18, datos.length, true); cab.setUint32(22, datos.length, true);
      cab.setUint16(26, nombre.length, true); cab.setUint16(28, 0, true);
      partes.push(new Uint8Array(cab.buffer), nombre, datos);
      const cen = new DataView(new ArrayBuffer(46));
      cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true); cen.setUint16(10, 0, true);
      cen.setUint16(12, 0, true); cen.setUint16(14, 0x21, true); cen.setUint32(16, crc, true); cen.setUint32(20, datos.length, true); cen.setUint32(24, datos.length, true);
      cen.setUint16(28, nombre.length, true); cen.setUint32(42, pos, true);
      central.push(new Uint8Array(cen.buffer), nombre);
      pos += 30 + nombre.length + datos.length;
    });
    const tamCentral = central.reduce((n, x) => n + x.length, 0);
    const fin = new DataView(new ArrayBuffer(22));
    fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true); fin.setUint32(12, tamCentral, true); fin.setUint32(16, pos, true);
    return new Blob(partes.concat(central, [new Uint8Array(fin.buffer)]));
  }

  // ---------- Excel ----------
  const x = (v) => String(v === null || v === undefined ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function col(n){ let s = ''; n++; while(n > 0){ const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; }
  // hojas: [{ nombre, columnas: [{ t: 'Título', ancho: 20 }], filas: [[...]] }]. Los números van como número; lo demás como texto.
  function xlsx(hojas){
    const hoja = (h) => {
      const celda = (v, f, c, negrita) => {
        const ref = col(c) + (f + 1);
        if(typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"' + (negrita ? ' s="1"' : '') + '><v>' + v + '</v></c>';
        return '<c r="' + ref + '" t="inlineStr"' + (negrita ? ' s="1"' : '') + '><is><t xml:space="preserve">' + x(v) + '</t></is></c>';
      };
      const filas = [h.columnas.map((k) => k.t)].concat(h.filas);
      return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
        '<cols>' + h.columnas.map((k, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + (k.ancho || 16) + '" customWidth="1"/>').join('') + '</cols>' +
        '<sheetData>' + filas.map((f, i) => '<row r="' + (i + 1) + '">' + f.map((v, c) => celda(v, i, c, i === 0)).join('') + '</row>').join('') + '</sheetData></worksheet>';
    };
    const nombreHoja = (n) => x(String(n).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
    const archivos = [
      { nombre: '[Content_Types].xml', datos: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        hojas.map((h, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>' },
      { nombre: '_rels/.rels', datos: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { nombre: 'xl/workbook.xml', datos: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        hojas.map((h, i) => '<sheet name="' + nombreHoja(h.nombre) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>' },
      { nombre: 'xl/_rels/workbook.xml.rels', datos: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        hojas.map((h, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') +
        '<Relationship Id="rId' + (hojas.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { nombre: 'xl/styles.xml', datos: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>' }
    ].concat(hojas.map((h, i) => ({ nombre: 'xl/worksheets/sheet' + (i + 1) + '.xml', datos: hoja(h) })));
    return new Blob([zip(archivos)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  function descargar(blob, nombre){
    const u = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = u; a.download = nombre; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 60000);
  }

  window.Archivos = { zip, xlsx, descargar, crc32 };
})();
