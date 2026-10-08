// Proforma y carta de bienvenida en PDF, con el formato original de Airtek. Se arman en el dispositivo, sin librerías.
// El diseño se mide en píxeles de la plantilla (hoja de 216 x 279 mm) y se escribe como PDF con texto real y enlaces.
(function(){
  'use strict';
  const M = window.Marca;
  const ANCHO = 216 / 25.4 * 96; const ALTO = 279 / 25.4 * 96;   // 816,4 x 1054,5 px
  const X0 = 48; const W = ANCHO - 96; const ARRIBA = 40; const ABAJO = ALTO - 32;
  const PORTAL = 'https://airtek.com.ve/portal-de-pagos.html';
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const FIJO = { monto: 60, dns: '190.124.28.22', gateway: 'Automático', diaLimite: '10', atencion: '0412 247 8343', atencionLink: '+584122478343', soporte: '0424 670 6389', soporteLink: '+584246706389' };
  const PENDIENTE = 'Pendiente por asignar';

  // ---------- Medidas de Helvetica (milésimas del tamaño), caracteres 32 a 126 ----------
  const D10 = [556, 556, 556, 556, 556, 556, 556, 556, 556, 556];
  const AN = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278].concat(D10, [278, 278, 584, 584, 584, 556, 1015,
    667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333,
    556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584]);
  const AB = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278].concat(D10, [333, 333, 584, 584, 584, 611, 975,
    722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333,
    556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584]);
  const OTROS = { '\u00a0': 278, '\u00b7': 278, '\u00b0': 400, '\u00a1': 333, '\u00bf': 611, '\u00ba': 365, '\u00aa': 370 };
  function anchoLetra(ch, negrita){
    const t = negrita ? AB : AN; let c = ch.charCodeAt(0);
    if(c >= 32 && c <= 126) return t[c - 32];
    if(OTROS[ch]) return ch === '\u00a1' && !negrita ? 333 : OTROS[ch];
    const base = ch.normalize('NFD').charAt(0); c = base.charCodeAt(0);
    return c >= 32 && c <= 126 ? t[c - 32] : 556;
  }
  function ancho(texto, tam, negrita, espacio){
    let n = 0; const s = String(texto);
    for(let i = 0; i < s.length; i++) n += anchoLetra(s.charAt(i), negrita);
    return n * tam / 1000 + (espacio || 0) * s.length;
  }
  // Corta en líneas que quepan; una palabra más larga que la línea se parte
  function partir(texto, tam, negrita, max, espacio){
    const lineas = []; let actual = '';
    String(texto).split(/\s+/).filter(Boolean).forEach((p) => {
      const prueba = actual ? actual + ' ' + p : p;
      if(ancho(prueba, tam, negrita, espacio) <= max){ actual = prueba; return; }
      if(actual) lineas.push(actual);
      actual = p;
      while(ancho(actual, tam, negrita, espacio) > max && actual.length > 1){
        let k = actual.length - 1; while(k > 1 && ancho(actual.slice(0, k), tam, negrita, espacio) > max) k--;
        lineas.push(actual.slice(0, k)); actual = actual.slice(k);
      }
    });
    if(actual) lineas.push(actual);
    return lineas.length ? lineas : [''];
  }

  // ---------- Lápiz: junta las órdenes de dibujo del PDF ----------
  const n2 = (v) => { const t = (Math.round(v * 100) / 100).toFixed(2); return t.replace(/\.?0+$/, '') || '0'; };
  const rgb = (hex) => [1, 3, 5].map((i) => n2(parseInt(hex.slice(i, i + 2), 16) / 255)).join(' ');
  const W1252 = { '\u20ac': 0x80, '\u2019': 0x92, '\u201c': 0x93, '\u201d': 0x94, '\u2022': 0x95, '\u2013': 0x96, '\u2014': 0x97 };
  function hexTexto(s){
    let h = '';
    for(let i = 0; i < s.length; i++){ let c = s.charCodeAt(i); if(c > 255) c = W1252[s.charAt(i)] || 63; h += (c < 16 ? '0' : '') + c.toString(16); }
    return '<' + h + '>';
  }
  function Lapiz(){ this.ops = []; this.enlaces = []; }
  // Una línea de texto apoyada en su línea base
  Lapiz.prototype.linea = function(x, base, texto, o){
    const s = String(texto); if(!s) return 0;
    const a = ancho(s, o.tam, o.negrita, o.espacio);
    const x0 = o.derecha ? x - a : x;
    this.ops.push('BT /' + (o.negrita ? 'F2' : 'F1') + ' ' + n2(o.tam) + ' Tf ' + n2(o.espacio || 0) + ' Tc ' + rgb(o.color || '#111111') + ' rg 1 0 0 -1 ' + n2(x0) + ' ' + n2(base) + ' Tm ' + hexTexto(s) + ' Tj ET');
    if(o.enlace) this.enlaces.push({ x: x0, y: base - o.tam * 0.92, w: a, h: o.tam * 1.2, url: o.enlace });
    return a;
  };
  // Un párrafo desde su borde de arriba. Devuelve el alto que ocupa.
  Lapiz.prototype.texto = function(x, y, texto, o){
    const alto = o.tam * (o.alto || 1.15); const s = o.mayus ? String(texto).toUpperCase() : String(texto);
    const lineas = o.max ? partir(s, o.tam, o.negrita, o.max, o.espacio) : [s];
    lineas.forEach((l, i) => this.linea(x, y + i * alto + (alto - 1.117 * o.tam) / 2 + 0.905 * o.tam, l, o));
    return lineas.length * alto;
  };
  Lapiz.prototype.caja = function(x, y, w, h, color){ this.ops.push(rgb(color) + ' rg ' + n2(x) + ' ' + n2(y) + ' ' + n2(w) + ' ' + n2(h) + ' re f'); };
  Lapiz.prototype.marco = function(x, y, w, h, color, grosor){ this.ops.push(rgb(color) + ' RG ' + n2(grosor) + ' w ' + n2(x) + ' ' + n2(y) + ' ' + n2(w) + ' ' + n2(h) + ' re S'); };
  Lapiz.prototype.enlace = function(x, y, w, h, url){ this.enlaces.push({ x, y, w, h, url }); };
  Lapiz.prototype.logo = function(x, y, anchoPx){
    const e = anchoPx / M.LOGO_ANCHO; const o = ['q ' + n2(e) + ' 0 0 ' + n2(e) + ' ' + n2(x) + ' ' + n2(y) + ' cm ' + rgb('#3A414A') + ' rg'];
    M.LOGO.forEach((d) => {
      d.replace(/([MLCZ])([^MLCZ]*)/g, (t, c, resto) => {
        const v = resto.trim().split(/[\s,]+/).filter(Boolean).map(Number); const paso = c === 'C' ? 6 : 2;
        if(c === 'Z'){ o.push('h'); return ''; }
        for(let i = 0; i + paso <= v.length; i += paso) o.push(v.slice(i, i + paso).map((k) => (Math.round(k * 1000) / 1000).toString()).join(' ') + ' ' + (c === 'C' ? 'c' : c === 'M' && i === 0 ? 'm' : 'l'));
        return '';
      });
    });
    o.push('f Q'); this.ops.push(o.join('\n'));
    return anchoPx * M.LOGO_ALTO / M.LOGO_ANCHO;
  };
  // El QR va como imagen, punto por punto, igual al de la plantilla
  Lapiz.prototype.qr = function(x, y, lado){ this.conQr = true; this.ops.push('q ' + n2(lado) + ' 0 0 ' + n2(-lado) + ' ' + n2(x) + ' ' + n2(y + lado) + ' cm /Qr Do Q'); };
  // Arma el archivo PDF de una página
  Lapiz.prototype.pdf = function(titulo){
    const PT = 0.75; const anchoPt = ANCHO * PT; const altoPt = ALTO * PT;
    const contenido = n2(PT) + ' 0 0 ' + n2(-PT) + ' 0 ' + n2(altoPt) + ' cm\n' + this.ops.join('\n') + '\n';
    const objetos = [];
    const escapar = (s) => String(s).replace(/[\\()]/g, '\\$&').replace(/[^\x20-\x7e]/g, '');
    const notas = this.enlaces.map((l, i) => (8 + i) + ' 0 R').join(' ');
    objetos.push('<< /Type /Catalog /Pages 2 0 R /Lang (es) >>');
    objetos.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    objetos.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + n2(anchoPt) + ' ' + n2(altoPt) + '] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >>' + (this.conQr ? ' /XObject << /Qr 7 0 R >>' : '') + ' >>' + (notas ? ' /Annots [' + notas + ']' : '') + ' >>');
    objetos.push('<< /Length ' + contenido.length + ' >>\nstream\n' + contenido + 'endstream');
    objetos.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    objetos.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const crudo = atob(M.QR); let hex = '';
    for(let i = 0; i < crudo.length; i++){ const c = crudo.charCodeAt(i); hex += (c < 16 ? '0' : '') + c.toString(16); if(i % 40 === 39) hex += '\n'; }
    hex += '>';
    objetos.push('<< /Type /XObject /Subtype /Image /Width ' + M.QR_LADO + ' /Height ' + M.QR_LADO + ' /ColorSpace /DeviceGray /BitsPerComponent 1 /Filter /ASCIIHexDecode /Length ' + hex.length + ' >>\nstream\n' + hex + '\nendstream');
    this.enlaces.forEach((l) => objetos.push('<< /Type /Annot /Subtype /Link /Border [0 0 0] /Rect [' + [l.x * PT, altoPt - (l.y + l.h) * PT, (l.x + l.w) * PT, altoPt - l.y * PT].map(n2).join(' ') + '] /A << /S /URI /URI (' + escapar(l.url) + ') >> >>'));
    const info = objetos.length + 1;
    objetos.push('<< /Title ' + hexTexto(titulo) + ' /Producer (Airtek Empresas) >>');
    let cuerpo = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'; const pos = [];
    objetos.forEach((t, i) => { pos.push(cuerpo.length); cuerpo += (i + 1) + ' 0 obj\n' + t + '\nendobj\n'; });
    const inicio = cuerpo.length;
    cuerpo += 'xref\n0 ' + (objetos.length + 1) + '\n0000000000 65535 f \n' + pos.map((p) => String(p).padStart(10, '0') + ' 00000 n \n').join('') +
      'trailer\n<< /Size ' + (objetos.length + 1) + ' /Root 1 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + inicio + '\n%%EOF\n';
    const bytes = new Uint8Array(cuerpo.length);
    for(let i = 0; i < cuerpo.length; i++) bytes[i] = cuerpo.charCodeAt(i) & 255;
    return new Blob([bytes], { type: 'application/pdf' });
  };

  // ---------- Piezas que comparten los dos documentos ----------
  const GRIS = '#3A414A';
  function cabecera(d, y){
    const hLogo = d.logo(X0, y, Math.min(W, 720)); const y1 = y + hLogo + 12;
    const o = { tam: 10, alto: 1.5, color: '#444444' };
    const cAuto = ancho('airtek.com.ve', 10); const fr = (W - cAuto - 60) / 3.9;
    const x2 = X0 + 1.9 * fr + 20; const x3 = x2 + fr + 20; const x4 = x3 + fr + 20;
    const h = d.texto(X0, y1, 'Av. 4 Bella Vista entre calles 68 y 69. Maracaibo, Edo. Zulia, Venezuela. Corporación Matrix TV C.A Rif: J-297655948', Object.assign({ max: 1.9 * fr }, o));
    d.texto(x2, y1, 'ventascorporativas@airtek.com.ve', Object.assign({ enlace: 'mailto:ventascorporativas@airtek.com.ve' }, o)); d.texto(x2, y1 + 15, FIJO.atencion, o);
    d.texto(x3 + ancho('      ', 10, true), y1, 'Dirección de Comercial', { tam: 10, alto: 1.5, negrita: true });
    d.texto(x4, y1, 'airtek.com.ve', Object.assign({ enlace: 'https://airtek.com.ve' }, o));
    return hLogo + 12 + Math.max(h, 30);
  }
  const titulo = (d, y, t, abajo) => d.texto(X0, y, t, { tam: 11, negrita: true, espacio: 1.32, mayus: true, color: GRIS }) + abajo;
  // Etiqueta pequeña arriba y valor en negrita abajo. estilo 'p' proforma, 'c' carta
  function celda(d, x, y, w, etiqueta, valor, estilo, enlace){
    const p = estilo === 'p';
    const h1 = d.texto(x, y, etiqueta, { tam: 9, negrita: p, espacio: p ? 0.9 : 0.99, mayus: true, color: p ? '#666666' : '#444444' });
    const h2 = d.texto(x, y + h1 + (p ? 4 : 5), valor, { tam: 12, negrita: true, alto: p ? 1.4 : 1.45, max: w, enlace });
    return h1 + (p ? 4 : 5) + h2;
  }
  function pie(d, y, conSoporte, gracias){
    const col = (W - 48) / 2; const xt = X0 + 84 + 14;
    d.qr(X0, y, 84); d.enlace(X0, y, 84, 84, PORTAL);
    const frase = partir('Consulta tu saldo desde cualquier parte.', 10.5, false, 150); const hFrase = frase.length * 10.5 * 1.45;
    const hIzq = hFrase + (conSoporte ? 8 + 15 : 0); let yt = y + (84 - hIzq) / 2;
    d.texto(xt, yt, 'Consulta tu saldo desde cualquier parte.', { tam: 10.5, alto: 1.45, color: '#555555', max: 150 }); d.enlace(xt, yt, 150, hFrase, PORTAL);
    if(conSoporte){
      yt += hFrase + 8; const base = yt + (15 - 11.17) / 2 + 9.05;
      const a = d.linea(xt, base, 'Soporte técnico ', { tam: 10, color: '#777777' });
      d.linea(xt + a, base, FIJO.soporte, { tam: 10, negrita: true, enlace: 'https://wa.me/' + FIJO.soporteLink.replace('+', '') });
    }
    const xd = X0 + col + 48; const hDer = 18.4 + 4 + 13.8 + (conSoporte ? 8 + 11.5 : 0); let yd = y + (84 - hDer) / 2;
    yd += d.texto(xd, yd, gracias, { tam: 16, negrita: true }) + 4;
    yd += d.texto(xd, yd, 'El equipo de Airtek Empresas.', { tam: 12, color: '#555555' });
    if(conSoporte) d.texto(xd, yd + 8, 'airtek internet \u00a0\u00b7\u00a0 @airtekinternet \u00a0\u00b7\u00a0 airtek es internet', { tam: 10, color: '#666666', espacio: 0.4 });
    return 84;
  }

  // ---------- Proforma ----------
  function proforma(x){
    const d = new Lapiz(); let y = ARRIBA;
    y += cabecera(d, y);
    y += 26; y += d.texto(X0, y, 'Hola, ' + x.nombre, { tam: 29, negrita: true, espacio: -0.58, alto: 1.15, max: W }) + 10;
    y += d.texto(X0, y, 'Conectados en ' + x.mes + '. A continuación el detalle de su proforma de instalación, con las opciones de pago disponibles.', { tam: 13, alto: 1.55, color: '#555555', max: 500 }) + 30;
    const cw = (W - 84) / 4; const cx = (i) => X0 + i * (cw + 28);
    const fila = (p, yy, celdas) => Math.max.apply(null, celdas.map((c) => celda(p, cx(c[0]), yy, cw * (c[3] || 1) + 28 * ((c[3] || 1) - 1), c[1], c[2], 'p', c[4])));
    const cliente = (p, yy) => {
      let h = titulo(p, yy, 'Datos del Cliente', 14);
      h += fila(p, yy + h, [[0, 'Cliente', x.nombre], [1, 'N° de Identificación', x.identificacion], [2, 'Teléfono', x.telefono || 'Sin teléfono'], [3, 'Tipo de Documento', x.tipoDocumento]]) + 16;
      h += fila(p, yy + h, [[0, 'N° de Contrato', x.contrato], [1, 'Fecha de Emisión', x.fecha], [2, 'Dirección Fiscal', x.direccion || 'Sin dirección', 2]]);
      return h;
    };
    const detalle = (p, yy) => {
      let h = titulo(p, yy, 'Detalle del Servicio', 12);
      h += celda(p, X0, yy + h, W, 'Facturación', 'Mensual', 'p') + 16;
      const chica = { tam: 10, espacio: 1.1, mayus: true, color: '#444444' }; const xDesc = X0 + 94; const wDesc = W - 70 - 120 - 48; const xFin = X0 + W;
      p.texto(X0, yy + h, 'Cantidad', chica); p.texto(xDesc, yy + h, 'Descripción', chica);
      p.linea(xFin, yy + h + (11.5 - 11.17) / 2 + 9.05, 'SUBTOTAL', { tam: 10, espacio: 1.1, color: '#444444', derecha: true });
      h += 11.5 + 8; p.caja(X0, yy + h, W, 1, '#a8a8a8'); h += 1 + 12;
      const gr = { tam: 13.5, negrita: true, alto: 1.45 }; const monto = '$' + FIJO.monto.toFixed(2);
      p.texto(X0, yy + h, '1', gr); const hd = p.texto(xDesc, yy + h, 'Instalación / Activación de servicio de internet', Object.assign({ max: wDesc }, gr));
      const base = (hh) => yy + hh + (19.575 - 1.117 * 13.5) / 2 + 0.905 * 13.5;
      p.linea(xFin, base(h), monto, { tam: 13.5, negrita: true, derecha: true });
      h += hd + 12; p.caja(X0, yy + h, W, 1.5, '#111111'); h += 1.5 + 10;
      p.linea(xFin, base(h), monto, { tam: 13.5, negrita: true, derecha: true });
      p.linea(xFin - 120 - 16, base(h), 'TOTAL DE PROFORMA', { tam: 10, espacio: 1.1, color: '#444444', derecha: true });
      return h + 19.575;
    };
    const pago = (p, yy) => {
      const sub = (t, yyy) => p.texto(X0, yyy, t, { tam: 9, negrita: true, espacio: 0.9, mayus: true, color: GRIS });
      let h = titulo(p, yy, 'Opciones de Pago', 14);
      h += sub('Bolívares', yy + h) + 10;
      h += fila(p, yy + h, [[0, 'Banco', 'Banco Nacional del Crédito'], [1, 'Titular', 'Corporación Matrix TV C.A.'], [2, 'RIF', 'J-297655948'], [3, 'Pago Móvil', '0412 247 8331']]) + 16;
      h += fila(p, yy + h, [[0, 'Transferencia', '0191-0032442132-071165', 4]]) + 18;
      h += sub('Moneda Extranjera', yy + h) + 10;
      h += fila(p, yy + h, [[0, 'Titular', 'Corporación Matrix TV LLC'], [1, 'Zelle', 'zelle@airtek.com.ve', 2, 'mailto:zelle@airtek.com.ve']]);
      return h;
    };
    const final = (p, yy) => pie(p, yy, true, 'Gracias por su confianza');
    // Como en la plantilla, el espacio libre de la hoja se reparte por igual antes de cada bloque
    const bloques = [cliente, detalle, pago, final]; const borrador = new Lapiz();
    const altos = bloques.map((b) => b(borrador, 0));
    const hueco = Math.max(6, (ABAJO - y - altos.reduce((a, b) => a + b, 0)) / bloques.length);
    bloques.forEach((b, i) => { y += hueco; b(d, y); y += altos[i]; });
    return d.pdf('Proforma ' + x.nombre);
  }

  // ---------- Carta de bienvenida ----------
  function carta(x){
    const d = new Lapiz(); let y = ARRIBA;
    y += cabecera(d, y);
    y += 12 + 33.35; y += d.texto(X0, y, 'Bienvenido a Airtek Empresas', { tam: 29, negrita: true, espacio: -0.58, alto: 1.15 }) + 10;
    y += d.texto(X0, y, 'Estamos comprometidos a brindarle una atención excepcional y acompañarlo en cada paso hacia el éxito ¡Bienvenido a la experiencia Airtek!', { tam: 13, alto: 1.55, color: '#555555', max: 500 }) + 30;
    const col = (W - 48) / 2; const xd = X0 + col + 48;
    const par = (yy, a, b) => Math.max(a ? celda(d, X0, yy, col, a[0], a[1], 'c', a[2]) : 0, b ? celda(d, xd, yy, col, b[0], b[1], 'c', b[2]) : 0);
    y += 16; y += titulo(d, y, 'Titular de la Cuenta', 14); y += d.texto(X0, y, x.nombre, { tam: 13, negrita: true, max: col });
    y += 16; y += titulo(d, y, 'Información de la Cuenta', 14);
    y += par(y, ['N° Contrato', x.contrato], ['Producto', 'Servicio de internet']) + 11;
    y += par(y, ['Factura al Mes', x.mes], ['Serial PON', x.serial || 'Sin registrar']);
    y += 16; y += titulo(d, y, 'Configuración de Direcciones IP', 14);
    y += par(y, ['Dirección IP Fija IPv4', x.ip || PENDIENTE], ['Dirección IP Fija IPv6', x.ip6 || PENDIENTE]) + 11;
    // DNS: dos valores separados por una barra clara
    const hEt = d.texto(X0, y, 'DNS', { tam: 9, espacio: 0.99, mayus: true, color: '#444444' }); const base = y + hEt + 5 + (17.4 - 13.404) / 2 + 10.86;
    let xx = X0 + d.linea(X0, base, FIJO.dns + ' ', { tam: 12, negrita: true }) + 4;
    xx += d.linea(xx, base, '/', { tam: 12, color: '#d8d8d8' }) + 4; d.linea(xx, base, ' ' + FIJO.dns, { tam: 12, negrita: true });
    y += Math.max(hEt + 5 + 17.4, celda(d, xd, y, col, 'Gateway', FIJO.gateway, 'c'));
    y += 16; y += titulo(d, y, 'Contacto y Atención Personalizada', 14);
    y += par(y, ['Atención y Consultas', FIJO.atencion, 'tel:' + FIJO.atencionLink], ['Soporte Técnico', FIJO.soporte, 'tel:' + FIJO.soporteLink]);
    if(x.lider){
      y += 11; const wa = x.liderWhatsapp ? ['WhatsApp del Líder', telFmt(x.liderWhatsapp), 'https://wa.me/' + waNumero(x.liderWhatsapp)] : null;
      const co = x.liderCorreo ? ['Correo del Líder', x.liderCorreo, 'mailto:' + x.liderCorreo] : null;
      const h1 = celda(d, X0, y, col, 'Líder de Ventas', x.lider, 'c'); let h2 = 0;
      if(wa){ h2 = celda(d, xd, y, col, wa[0], wa[1], 'c', wa[2]); if(co) h2 += 9 + celda(d, xd, y + h2 + 9, col, co[0], co[1], 'c', co[2]); }
      else if(co) h2 = celda(d, xd, y, col, co[0], co[1], 'c', co[2]);
      y += Math.max(h1, h2);
    }
    y += 16;
    const hp = d.texto(X0, y, 'Si tiene alguna pregunta o necesita asistencia, no dude en ponerse en contacto con ' + (x.lider ? 'su Líder de Ventas asignado' : 'nuestro equipo de atención') + '. Esperamos construir una relación exitosa y duradera.', { tam: 11, alto: 1.6, color: '#666666', max: 280 });
    // Recuadro "Importante"
    const aviso = 'Recuerda pagar tu factura antes del ' + FIJO.diaLimite + ' de cada mes.'; const wTexto = 300 - 26 - 19;
    const lineas = partir(aviso, 11, false, wTexto); const hCaja = 20 + 14 + 2 + lineas.length * 16.5;
    d.marco(xd + 0.5, y + 0.5, 299, hCaja - 1, '#dcdcdc', 1);
    const cxI = xd + 13 + 5.5; const cyI = y + 10 + 7;
    d.ops.push(rgb('#111111') + ' RG 1 w ' + [[cxI + 4.6, cyI, 'm'], [cxI + 4.6, cyI + 2.54, cxI + 2.54, cyI + 4.6, cxI, cyI + 4.6, 'c'], [cxI - 2.54, cyI + 4.6, cxI - 4.6, cyI + 2.54, cxI - 4.6, cyI, 'c'],
      [cxI - 4.6, cyI - 2.54, cxI - 2.54, cyI - 4.6, cxI, cyI - 4.6, 'c'], [cxI + 2.54, cyI - 4.6, cxI + 4.6, cyI - 2.54, cxI + 4.6, cyI, 'c']].map((s) => s.map((v) => (typeof v === 'number' ? n2(v) : v)).join(' ')).join(' ') + ' S');
    d.linea(cxI - ancho('i', 7, true) / 2, cyI + 2.5, 'i', { tam: 7, negrita: true });
    d.texto(xd + 13 + 19, y + 10, 'Importante', { tam: 10, negrita: true, espacio: 0.8, mayus: true, alto: 1.4 });
    d.texto(xd + 13 + 19, y + 10 + 14 + 2, aviso, { tam: 11, alto: 1.5, color: '#666666', max: wTexto });
    y += Math.max(hp, hCaja);
    pie(d, Math.max(y + 22, ABAJO - 84), false, 'Gracias por elegirnos');
    return d.pdf('Carta de bienvenida ' + x.nombre);
  }

  // ---------- Datos: del expediente a lo que va escrito en el papel ----------
  const waNumero = (t) => { let n = String(t || '').replace(/\D/g, ''); if(n.length === 11 && n.charAt(0) === '0') n = '58' + n.slice(1); else if(n.length === 10) n = '58' + n; return n; };
  // 0414 555 0142
  function telFmt(t){
    let n = String(t || '').replace(/\D/g, ''); if(!n) return '';
    if(n.length === 12 && n.indexOf('58') === 0) n = '0' + n.slice(2); else if(n.length === 10 && n.charAt(0) !== '0') n = '0' + n;
    return n.length === 11 ? n.slice(0, 4) + ' ' + n.slice(4, 7) + ' ' + n.slice(7) : String(t).trim();
  }
  // Sin espacios dobles ni puntos sueltos, y con la sigla de la empresa bien puesta
  function limpiarNombre(t){
    let n = String(t || '').replace(/\s+/g, ' ').replace(/\s+([.,])/g, '$1').replace(/([.,])\1+/g, '$1').replace(/^[\s.,-]+|[\s,-]+$/g, '').trim();
    n = n.replace(/[\s,]+c\.?\s?a\.?$/i, ', C.A.').replace(/[\s,]+s\.?\s?a\.?$/i, ', S.A.').replace(/[\s,]+s\.?\s?r\.?\s?l\.?$/i, ', S.R.L.');
    return n.replace(/\.+$/, '.');
  }
  function mesAnio(fecha){ const m = /^(\d{4})-(\d{2})/.exec(String(fecha || '')); return m ? MESES[Number(m[2]) - 1] + ' ' + m[1] : ''; }
  function nombreArchivo(tipo, nombre){
    const base = String(nombre || 'cliente').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'cliente';
    return (tipo === 'bienvenida' ? 'Carta_Bienvenida_' : 'Proforma_') + base + '.pdf';
  }
  // F: lo que devuelve cliente_ficha; s: el servicio elegido; hoy: AAAA-MM-DD
  function datosDe(F, s, telefono){
    const c = F.cliente; const k = s.carta || {}; const hoy = String(F.hoy || '');
    const natural = c.doc_tipo === 'V' || c.doc_tipo === 'E';
    return {
      nombre: limpiarNombre(c.nombre), identificacion: window.Comun.docFmt(c.doc_tipo, c.doc_numero), tipoDocumento: natural ? 'Cédula' : 'RIF',
      telefono: telFmt(telefono || c.telefono || s.telefono || c.tel), contrato: String(s.codigo || '').replace(/^0+/, '') || String(s.codigo || ''),
      fecha: hoy ? hoy.slice(8, 10) + '/' + hoy.slice(5, 7) + '/' + hoy.slice(0, 4) : '', direccion: String(c.direccion || s.direccion || '').replace(/\s+/g, ' ').trim(),
      mes: mesAnio(s.fecha_instalacion || hoy), serial: String(s.equipo || '').trim(), ip: String(s.ip || '').trim(), ip6: String(s.ip6 || '').trim(),
      lider: k.aliado ? '' : String(k.lider || ''), liderWhatsapp: k.aliado ? '' : String(k.whatsapp || ''), liderCorreo: k.aliado ? '' : String(k.correo || '')
    };
  }

  window.Documentos = { proforma, carta, datosDe, nombreArchivo, telFmt, limpiarNombre, waNumero, PORTAL, _ancho: ancho, _partir: partir };
})();
