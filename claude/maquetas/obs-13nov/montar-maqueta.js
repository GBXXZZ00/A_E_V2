// Maqueta de las observaciones del 13/11 (visor alto, motivos por documento, falta un acta, es otro documento,
// mismo archivo, Clientes con filtros plegados y fecha, Mi trabajo plegado para todos), montada sobre la app real del simulador. Datos inventados.
// Uso: servidor en la raíz (python3 -m http.server 8765) y: node claude/maquetas/obs-13nov/montar-maqueta.js /ruta/salida/
const { chromium, H, PC, TEL, contexto, entrar } = require('../../../pruebas/simulador');
const OUT = process.argv[2] || './img/';
const CSS = `
/* 1. Visor alto: la pantalla ocupa toda la ventana (12 px de margen) y el PDF se lleva todo el alto que sobra */
.hoja.rv-pant{width:calc(100vw - 24px) !important;height:calc(100dvh - 24px) !important;border-radius:20px !important}
.rv-cab{padding:12px 20px 10px !important;gap:12px !important}
.rv-cab h2{font-size:18px !important}.rv-cab small{font-size:13px !important;margin-top:2px !important}
.rv-cab .rv-ia{margin:0 0 0 auto !important;padding:6px 6px 6px 14px !important;border-radius:99px !important;font-size:13px !important;gap:10px !important;max-width:620px}
.rv-cab .rv-ia b{font-size:13.5px !important}
.rv-cab .rv-ia .hc-b{height:34px !important;font-size:13px !important}
.rv-cab .der{margin-left:0 !important}
.rv-c{grid-template-columns:340px 1fr !important}
.rv-d{padding:9px 12px !important}.rv-gr{padding:10px 10px 4px !important}
.rv-vh{padding:10px 16px !important;gap:10px !important}
.rv-vh h3{font-size:16px !important}
.zz-vence{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:700}.zz-vence .campo{height:38px;width:150px;font-size:13px;background:#fff;border-radius:12px}
.zz-mas{height:38px;padding:0 12px;border-radius:12px;border:1.5px solid var(--line);background:#fff;font-weight:600;font-size:13px;display:inline-flex;align-items:center;gap:6px}
.zz-menu{position:absolute;right:150px;top:52px;z-index:5;background:#fff;border-radius:14px;box-shadow:0 12px 32px rgba(17,19,21,.16);border:1px solid var(--line);padding:6px;width:260px}
.zz-menu button{display:block;width:100%;text-align:left;padding:10px 12px;border-radius:10px;font-size:13.5px;font-weight:600;background:none}
.zz-menu button.sel{background:#F3F4F6}.zz-menu hr{border:0;border-top:1px solid var(--line);margin:4px 0}.zz-menu small{display:block;font-weight:500;color:var(--text2);font-size:12px;margin-top:2px}
.rv-v{overflow:hidden !important;position:relative}
.rv-dt,.rv-rep{display:none !important}
.zz-cuerpo{display:flex;flex:1;min-height:0;gap:0}
.zz-cuerpo #visor,.zz-cuerpo .zz-pdf{margin:12px 16px 12px !important;flex:1;min-height:0 !important}
.zz-pdf{border-radius:10px;overflow:hidden;display:grid;grid-template-rows:36px auto 1fr;background:#525659}
.zz-pdf .tb{background:#323639;color:#E8EAED;display:flex;align-items:center;gap:14px;padding:0 14px;font-size:12.5px}
.zz-pdf .tb .der{margin-left:auto;display:flex;gap:14px}
.zz-pdf .pz{overflow:hidden;padding:18px 0;display:flex;justify-content:center}
.zz-pg{width:440px;background:#fff;border-radius:2px;padding:28px 34px;box-shadow:0 2px 10px rgba(0,0,0,.3);height:max-content}
.zz-pg .t{font-size:12.5px;font-weight:800;text-align:center;letter-spacing:.06em;margin:0 0 6px}
.zz-pg .l{height:7px;border-radius:3px;background:#E3E6EA;margin-top:11px}.zz-pg .l.c{width:70%}.zz-pg .l.m{width:85%}
.zz-seg{display:flex;gap:6px;padding:8px 10px;background:#3C4043;flex-wrap:wrap}
.zz-seg span{height:30px;padding:0 12px;border-radius:99px;display:inline-flex;align-items:center;font-size:12.5px;font-weight:600;color:#E8EAED;background:rgba(255,255,255,.08)}
.zz-seg span.on{background:#fff;color:#1F2328}.zz-seg em{font-style:normal;opacity:.7;margin-left:6px;font-weight:500}
/* 2. Devolver: el panel va a la derecha del PDF; el PDF no pierde alto */
.zz-panel{width:350px;flex:none;margin:12px 16px 12px 0;background:#fff;border:1.5px solid #F0B4AE;border-radius:14px;display:flex;flex-direction:column;overflow:hidden}
.zz-pb{flex:1;min-height:0;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:8px}
.zz-panel .acc{display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid var(--line);background:#fff}
.zz-panel.az{border-color:#B9C6F2}
.zz-panel h4{margin:0;font-size:15px;font-weight:800}.zz-panel p.s{margin:-6px 0 0;font-size:12.5px;color:var(--text2)}
.zz-op{display:flex;align-items:flex-start;gap:10px;padding:9px 12px;border-radius:12px;border:1.5px solid var(--line);font-size:13.5px;font-weight:600;text-align:left;background:#fff;width:100%}
.zz-op i{width:18px;height:18px;border-radius:50%;border:2px solid #C9CED6;flex:none;margin-top:1px}
.zz-op small{display:block;font-weight:500;color:var(--text2);font-size:12px;margin-top:2px}
.zz-op.on{border-color:#A32117;background:#FCEDEB;color:#A32117}.zz-op.on i{border:5px solid #A32117}
.zz-panel.az .zz-op.on{border-color:#1F45C4;background:#E8EEFF;color:#1F45C4}.zz-panel.az .zz-op.on i{border-color:#1F45C4}
.zz-sub{display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 4px 28px}
.zz-sub span{padding:7px 12px;border-radius:10px;border:1.5px solid var(--line);font-size:13px;font-weight:600}
.zz-sub span.on{border-color:#A32117;color:#A32117;background:#FCEDEB}
.zz-panel textarea{min-height:64px;border:1.5px solid var(--line);border-radius:12px;padding:10px 12px;font:inherit;font-size:13.5px;resize:none}
.zz-panel .lbl{font-size:12.5px;font-weight:700;margin-bottom:-6px}
.zz-aviso{border-radius:12px;padding:10px 12px;font-size:13px;background:#FFF6E3;color:#754B00;line-height:1.45}
.zz-aviso.az{background:#E8EEFF;color:#1F45C4}
/* 5. Mismo archivo en la lista */
.zz-grupo{position:relative;margin:4px 0 6px;padding:2px 0 2px 0;border-radius:14px;background:#F7F8FA}
.zz-grupo>small{display:flex;align-items:center;gap:6px;padding:8px 12px 2px;font-size:11.5px;font-weight:700;color:var(--text2)}
.zz-grupo .rv-d{background:none}.zz-grupo .rv-d.sel{background:#E8ECF9}

/* 5b. Mismo archivo, más claro: tarjeta con el archivo arriba, línea que une los documentos y tramos con su estado */
.zz-arch{margin:6px 0 8px;border:1.5px solid #C9D3F2;border-radius:16px;background:#F7F9FF;overflow:hidden}
.zz-arch .ca{display:flex;align-items:center;gap:10px;padding:10px 12px;background:#EAF0FF;color:#1F45C4;font-size:12.5px;font-weight:700}
.zz-arch .ca .ic{width:28px;height:28px;border-radius:8px;background:#fff;display:grid;place-items:center;font-size:10px;font-weight:800;color:#A32117;flex:none}
.zz-arch .ca small{display:block;font-weight:500;color:#3D5BC9;font-size:12px}
.zz-arch .rv-d{position:relative;border-radius:0 !important;padding-left:14px !important;background:none}
.zz-arch .rv-d.sel{background:#DDE5FB !important}
.zz-arch .rv-d + .rv-d{border-top:1px solid #DCE3F7}
.zz-vh-arch{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:99px;background:#EAF0FF;color:#1F45C4;font-size:12px;font-weight:700;margin-left:8px;vertical-align:middle}
.zz-seg span .e{width:16px;height:16px;border-radius:50%;display:inline-grid;place-items:center;margin-right:6px;font-size:10px;font-weight:800}
.zz-seg span .e.b{background:#0F6642;color:#fff}.zz-seg span .e.n{border:2px solid #9AA0A6}
.zz-seg .tit{color:#BDC1C6;font-size:12px;font-weight:600;background:none;padding:0 6px 0 2px}
/* 6. Clientes */
.zz-fil{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:6px 0 10px}
.zz-dd{height:40px;padding:0 14px;border-radius:99px;border:1.5px solid var(--line);background:#fff;font-weight:600;font-size:13.5px;display:inline-flex;align-items:center;gap:8px}
.zz-dd b{font-weight:700}.zz-dd.on{border-color:var(--text);}
.zz-dd .pt{width:8px;height:8px;border-radius:50%}
.zz-sep{width:1px;height:24px;background:var(--line);margin:0 4px}
.zz-pop{position:absolute;z-index:30;background:#fff;border-radius:16px;box-shadow:0 16px 40px rgba(17,19,21,.16);border:1px solid var(--line);padding:16px;width:380px;display:flex;flex-direction:column;gap:10px}
.zz-pop .lbl{font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.05em}
.zz-pop .ops{display:flex;flex-wrap:wrap;gap:6px}
.zz-pop .ops span{height:34px;padding:0 12px;border-radius:99px;border:1.5px solid var(--line);display:inline-flex;align-items:center;font-size:13px;font-weight:600}
.zz-pop .ops span.on{background:var(--text);border-color:var(--text);color:#fff}
.zz-pop .dos{display:grid;grid-template-columns:1fr 1fr;gap:10px}.zz-pop .dos label{font-size:12.5px;font-weight:700;display:block;margin-bottom:4px}.zz-pop .dos .campo{height:40px;width:100%}
.zz-pop .acc{display:flex;justify-content:flex-end;gap:8px}
.zz-est{display:flex;flex-direction:column;gap:2px}.zz-est span{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;font-size:13.5px;font-weight:600}
.zz-est span.on{background:#F3F4F6}.zz-est span em{margin-left:auto;font-style:normal;color:var(--text2);font-weight:600;font-size:12.5px}.zz-est span i{width:8px;height:8px;border-radius:50%}
.zz-gestl{display:flex;align-items:center;gap:12px;padding:12px 16px;border:1px solid var(--line);border-radius:14px;font-size:13.5px;margin:4px 0 12px}
.zz-gestl b{font-size:14px}.zz-gestl .der{margin-left:auto;display:flex;gap:8px}
.zz-resl{display:flex;align-items:center;gap:14px;font-size:13px;color:var(--text2);margin:2px 0 8px}
.zz-barra{flex:1;max-width:360px;height:8px;border-radius:99px;overflow:hidden;display:flex}
`;
const OKI = '<svg class="i" viewBox="0 0 24 24" style="width:14px;height:14px"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const pdf = (nom, t, pag, seg) => '<div class="zz-pdf"><div class="tb"><span>' + nom + '</span><span class="der"><span>' + pag + '</span><span>−</span><span>100 %</span><span>+</span></span></div>' + (seg || '<div></div>') +
  '<div class="pz"><div class="zz-pg"><p class="t">' + t.toUpperCase() + '</p>' + Array.from({ length: 34 }, (_, i) => '<div class="l' + (i % 3 === 1 ? ' m' : i % 5 === 4 ? ' c' : '') + '"></div>').join('') + '</div></div></div>';
const op = (t, s, on) => '<button class="zz-op' + (on ? ' on' : '') + '"><i></i><span>' + t + (s ? '<small>' + s + '</small>' : '') + '</span></button>';
(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const nav = await chromium.launch();
  const { ctx, mundo } = await contexto(nav, PC);
  const p = await entrar(ctx, 'marcos', '482913');
  const tomar = async (pg, n) => { await pg.waitForTimeout(400); await pg.screenshot({ path: OUT + n + '.png' }); console.log('ok', n); };
  await p.goto(H + 'clientes.html?c=1001&t=documentos'); await p.waitForSelector('#paso [data-paso="revisar"]');
  await p.click('#paso [data-paso="revisar"]'); await p.waitForSelector('#hojaVer.ver .rv-c #verAprobar'); await p.waitForTimeout(500);
  await p.addStyleTag({ content: CSS });
  // Arreglo común: la línea de la IA sube a la cabecera; el documento con Vence, Más, Devolver y Bien en una sola fila; el PDF a todo el alto
  const armar = async (o) => p.evaluate((o) => {
    const hv = document.querySelector('#hojaVer');
    const ia = hv.querySelector('.rv-ia'); const cab = hv.querySelector('.rv-cab');
    if(ia && ia.parentElement !== cab){ const t = ia.querySelector('.tx'); t.innerHTML = '<b>Estás revisando tú</b>La IA no los ha leído'; cab.insertBefore(ia, cab.querySelector('.der')); }
    // lista
    if(o.sel){ hv.querySelectorAll('.rv-d').forEach((d) => d.classList.toggle('sel', d.textContent.trim().startsWith(o.sel.t) && (!o.sel.i || d === hv.querySelectorAll('.rv-d')[o.sel.i]))); }
    (o.estados || []).forEach(([i, e, s]) => { const d = hv.querySelectorAll('.rv-d')[i]; if(!d) return; d.querySelector('.rv-e').className = 'rv-e ' + e; d.querySelector('.rv-e').innerHTML = e === 'b' || e === 'y' ? o.OK : e === 'd' ? '!' : ''; const sm = d.querySelector('small'); if(sm) sm.textContent = s; });
    if(o.grupo){ const ds = hv.querySelectorAll('.rv-d'); const a = ds[o.grupo[0]]; const g = document.createElement('div'); g.className = 'zz-grupo'; g.innerHTML = '<small>' + o.grupo[2] + '</small>'; a.before(g); for(let i = o.grupo[0]; i <= o.grupo[1]; i++) g.appendChild(ds[i]); }
    if(o.extraLista){ const l = hv.querySelector('.rv-l'); const r = hv.querySelector('#rvPedir'); r.insertAdjacentHTML('beforebegin', o.extraLista); }
    // cabecera del documento
    const vh = hv.querySelector('.rv-vh'); vh.querySelector('div').innerHTML = '<h3>' + o.vt + '</h3><small' + (o.vsc ? ' class="' + o.vsc + '"' : '') + '>' + o.vs + '</small>';
    vh.querySelector('.der').innerHTML = (o.vence ? '<span class="zz-vence">Vence <input class="campo" type="date" value="' + o.vence + '"></span>' : '') + '<button class="zz-mas">Más<svg class="i" viewBox="0 0 24 24" style="width:14px;height:14px"><path d="M6 9l6 6 6-6"/></svg></button>' +
      (o.firma ? '<button class="hc-b s ch">Marcar que firma</button>' : '') +
      '<button class="hc-b ch rv-dev' + (o.dev ? ' on' : '') + '">Devolver</button><button class="hc-b ch ' + (o.bien ? 'rv-bien' : 's') + '">' + (o.bien ? 'Bien ✓' : 'Bien') + '</button>';
    // cuerpo
    const v = hv.querySelector('.rv-v'); v.querySelectorAll('.zz-cuerpo,.zz-menu,.rv-mot,.rv-nota').forEach((x) => x.remove());
    const vis = v.querySelector('#visor'); vis.style.display = 'none';
    v.insertAdjacentHTML('beforeend', '<div class="zz-cuerpo">' + o.pdf + (o.panel || '') + '</div>' + (o.menu || ''));
    hv.querySelector('.rv-res').innerHTML = o.res || 'Faltan 4 por decidir';
  }, Object.assign({ OK: OKI }, o));
  const PDF_CED = pdf('cedula.jpg', 'República Bolivariana de Venezuela · Cédula', '1 / 1');
  // 01: visor alto, sin nada abierto
  await armar({ sel: { t: 'Cédula' }, vt: 'Cédula · Representante 1', vs: 'Subido ayer por Lucía', vence: '2031-05-20', pdf: PDF_CED });
  await tomar(p, '01-visor-alto');
  // 01b: el menú Más (lo que antes ocupaba dos filas debajo del PDF)
  await armar({ sel: { t: 'Cédula' }, vt: 'Cédula · Representante 1', vs: 'Subido ayer por Lucía', vence: '2031-05-20', pdf: PDF_CED,
    menu: '<div class="zz-menu"><button>Es otro documento<small>Lo subieron en la casilla equivocada</small></button><button>Reemplazar archivo</button><button>Abrir en Drive</button><hr><button>No está en la junta</button><button>Ya no aplica</button></div>' });
  await tomar(p, '01b-mas');
  // 02: Devolver una cédula: motivos de la cédula
  await armar({ sel: { t: 'Cédula' }, vt: 'Cédula · Representante 1', vs: 'Subido ayer por Lucía', vence: '2031-05-20', dev: true, pdf: PDF_CED,
    panel: '<div class="zz-panel"><div class="zz-pb"><h4>¿Por qué devuelves la cédula?</h4>' + op('Está vencida') + op('Borrosa, cortada o con reflejo', 'No se leen el número o el nombre', true) + op('Es de otra persona', 'No es el representante') +
      op('El nombre no coincide', 'Con el acta o con el RIF personal') + op('Otro motivo') + '<span class="lbl">Nota para Lucía (opcional)</span><textarea>Tómale la foto de frente, sin flash.</textarea>' +
      '</div><div class="acc"><button class="hc-b s ch">Cancelar</button><button class="hc-b ch rv-dev on">Marcar para devolver</button></div></div>' });
  await tomar(p, '02-devolver-cedula');
  // 02b: RIF personal
  await armar({ sel: { t: 'RIF personal' }, vt: 'RIF personal · Representante 1', vs: 'Subido ayer por Lucía', vence: '2027-02-11', dev: true, pdf: pdf('rif-personal.pdf', 'Registro de Información Fiscal', '1 / 1'),
    panel: '<div class="zz-panel"><div class="zz-pb"><h4>¿Por qué devuelves el RIF personal?</h4>' + op('Está vencido', '', true) + op('Borroso, cortado o incompleto') + op('Es de otra persona') + op('No coincide con la cédula', 'Nombre o número distinto') + op('Otro motivo') +
      '<span class="lbl">Nota para Lucía (opcional)</span><textarea></textarea></div><div class="acc"><button class="hc-b s ch">Cancelar</button><button class="hc-b ch rv-dev on">Marcar para devolver</button></div></div>' });
  await tomar(p, '02b-devolver-rif-personal');
  // 03: Acta constitutiva: todos sus motivos y "Falta un acta" con las actas a la vista
  const PDF_ACTA = pdf('acta-constitutiva.pdf', 'Acta constitutiva', '6 / 9');
  await armar({ sel: { t: 'Acta constitutiva' }, vt: 'Acta constitutiva', vs: 'Subido ayer por Lucía · 9 páginas', dev: true, pdf: PDF_ACTA,
    panel: '<div class="zz-panel"><div class="zz-pb"><h4>¿Qué pasa con la constitutiva?</h4>' + op('Ilegible o le faltan páginas') + op('No es de esta empresa') + op('Sin los datos del Registro', 'Sin sello, tomo o número') +
      op('Falta un acta', 'La constitutiva sirve, pero hace falta otra', true) + '<div class="zz-sub"><span class="on">Ratificación o cambio de junta directiva</span><span>Cambio de domicilio fiscal</span><span>Cambio de razón social</span><span>Prórroga de la duración</span><span>Acta que nombra al representante</span><span>Otra acta (escribe cuál)</span></div>' + op('Otro motivo') +
      '<div class="zz-aviso">Se le pide a Lucía el acta de ratificación de la junta. La constitutiva queda aprobada y el expediente espera esa acta.</div>' +
      '</div><div class="acc"><button class="hc-b s ch">Cancelar</button><button class="hc-b ch rv-dev on">Pedir el acta</button></div></div>' });
  await tomar(p, '03-acta-falta-un-acta');
  // 04: Es otro documento: lo mueve a su casilla
  await armar({ sel: { t: 'Acta constitutiva' }, vt: 'Acta constitutiva', vs: 'Subido ayer por Lucía · 4 páginas', pdf: pdf('acta-constitutiva.pdf', 'Acta de asamblea extraordinaria', '1 / 4'),
    panel: '<div class="zz-panel az"><div class="zz-pb"><h4>¿Qué documento es?</h4><p class="s">Lo subieron en la casilla equivocada. Se mueve sin volver a subirlo.</p>' +
      op('RIF de la empresa') + op('Acta de asamblea', 'Queda como Acta de asamblea 2', true) + op('Cédula', 'Elige el representante') + op('RIF personal', 'Elige el representante') + op('Otro documento', 'Escribe cuál') +
      '<div class="zz-aviso az">Acta constitutiva queda vacía y entra en lo que se le pide a Lucía.</div>' +
      '</div><div class="acc"><button class="hc-b s ch">Cancelar</button><button class="hc-b ch">Moverlo</button></div></div>' });
  await tomar(p, '04-es-otro-documento');
  // 05: un archivo con varios documentos: tarjeta del archivo en la lista, el archivo en la cabecera y tramos con su estado
  const SEG = '<div class="zz-seg"><span class="tit">En este archivo:</span><span><i class="e b">✓</i>Acta constitutiva <em>p. 1 a 8</em></span><span class="on"><i class="e n"></i>Acta de asamblea 1 <em>p. 9 a 12</em></span><span><i class="e b">✓</i>RIF de la empresa <em>p. 13</em></span></div>';
  await armar({ sel: { t: 'Acta de asamblea 1' }, vt: 'Acta de asamblea 1<span class="zz-vh-arch">Mismo PDF que 2 documentos más</span>', vs: 'expediente-completo.pdf · páginas 9 a 12 · al terminar este pasa al siguiente del mismo archivo', pdf: pdf('expediente-completo.pdf', 'Acta de asamblea extraordinaria', '9 / 13', SEG),
    estados: [[3, 'b', 'Bien · página 13'], [4, 'b', 'Bien · páginas 1 a 8'], [5, 'n', 'Por decidir · páginas 9 a 12']] });
  await p.evaluate(() => { const hv = document.querySelector('#hojaVer'); const ds = hv.querySelectorAll('.rv-d'); const g = document.createElement('div'); g.className = 'zz-arch';
    g.innerHTML = '<div class="ca"><span class="ic">PDF</span><span>Un solo archivo con 3 documentos<small>expediente-completo.pdf · 13 páginas</small></span></div>';
    ds[3].before(g); [4, 5, 3].forEach((i) => g.appendChild(ds[i])); });
  await tomar(p, '05-mismo-archivo');
  await p.goto(H + 'clientes.html?c=1001&t=documentos'); await p.waitForSelector('#paso [data-paso="revisar"]'); await p.click('#paso [data-paso="revisar"]'); await p.waitForSelector('#hojaVer.ver .rv-c #verAprobar'); await p.waitForTimeout(500); await p.addStyleTag({ content: CSS });
  // 05c: devolver dentro de un archivo compartido: solo este tramo o el archivo entero
  await armar({ sel: { t: 'Acta de asamblea 1' }, vt: 'Acta de asamblea 1<span class="zz-vh-arch">Mismo PDF que 2 documentos más</span>', vs: 'expediente-completo.pdf · páginas 9 a 12', dev: true, pdf: pdf('expediente-completo.pdf', 'Acta de asamblea extraordinaria', '9 / 13', SEG),
    estados: [[3, 'b', 'Bien · página 13'], [4, 'b', 'Bien · páginas 1 a 8'], [5, 'd', 'Para devolver · páginas 9 a 12']],
    panel: '<div class="zz-panel"><div class="zz-pb"><h4>¿Por qué devuelves el acta de asamblea?</h4>' + op('Ilegible o le faltan páginas', '', true) + op('No es de esta empresa') + op('Sin los datos del Registro') + op('No nombra al representante') + op('Otro motivo') +
      '<span class="lbl">¿Qué se devuelve?</span>' + op('Solo el acta de asamblea', 'El acta constitutiva y el RIF siguen bien', true) + op('El archivo completo', 'Se piden de nuevo los 3 documentos') +
      '</div><div class="acc"><button class="hc-b s ch">Cancelar</button><button class="hc-b ch rv-dev on">Marcar para devolver</button></div></div>' });
  await p.evaluate(() => { const hv = document.querySelector('#hojaVer'); const ds = hv.querySelectorAll('.rv-d'); const g = document.createElement('div'); g.className = 'zz-arch';
    g.innerHTML = '<div class="ca"><span class="ic">PDF</span><span>Un solo archivo con 3 documentos<small>expediente-completo.pdf · 13 páginas</small></span></div>';
    ds[3].before(g); [4, 5, 3].forEach((i) => g.appendChild(ds[i])); });
  await tomar(p, '05c-mismo-archivo-devolver');
  // 05b: un documento en varios archivos (cédula por delante y por detrás, acta en 3 PDF)
  const SEG2 = '<div class="zz-seg"><span class="on">Archivo 1 <em>acta-p1.pdf</em></span><span>Archivo 2 <em>acta-p2.pdf</em></span><span>Archivo 3 <em>foto.jpg</em></span></div>';
  await armar({ sel: { t: 'Acta constitutiva' }, vt: 'Acta constitutiva', vs: 'En 3 archivos · subidos ayer por Lucía', pdf: pdf('acta-p1.pdf', 'Acta constitutiva', '1 / 5', SEG2) });
  await tomar(p, '05b-varios-archivos');
  // Teléfono: el visor alto como hoja desde abajo
  await ctx.close();
  // 06: Clientes con un solo renglón de filtros y Fecha
  const c2 = await contexto(nav, PC, mundo); const q = await entrar(c2.ctx, 'marcos', '482913');
  await q.goto(H + 'clientes.html'); await q.waitForSelector('#estLegal [data-est-legal]'); await q.waitForTimeout(800); await q.addStyleTag({ content: CSS });
  const clientes = async (pop) => q.evaluate((pop) => {
    const est = document.querySelector('#estLegal'); const f = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Filtros');
    // el panel grande de estatus legal y la tarjeta de gestiones se vuelven una línea cada uno
    const pan = Array.from(document.querySelectorAll('h2,h3,b,strong,p')).find((x) => /^Estatus legal ·/.test(x.textContent.trim()));
    const box = pan && pan.closest('section,div.tarjeta,div.panel,div[class]'); let cont = box; while(cont && cont.parentElement && !/Estatus legal ·/.test(cont.parentElement.textContent.slice(0, 200)) === false && cont.parentElement !== document.body && cont.parentElement.querySelectorAll('.tarj, [class*=tarj]').length === 0) cont = cont.parentElement;
    if(box){ const top = box.closest('[class]'); top.outerHTML = '<div class="zz-resl"><b style="color:var(--text)">Estatus legal · PYME</b><span class="zz-barra"><i style="flex:2;background:#B8BEC6"></i><i style="flex:16;background:#E0A93B"></i><i style="flex:9;background:#0F6642"></i></span><span>2 sin gestionar · 16 faltan documentos · 9 firmados</span><button class="enlace">Ver en Resumen</button></div>'; }
    const g = Array.from(document.querySelectorAll('h2,h3,p,b')).find((x) => /^Gestiones activas/.test(x.textContent.trim()));
    if(g){ const sec = g.parentElement; let card = sec.nextElementSibling; if(card) card.remove(); sec.outerHTML = '<div class="zz-gestl"><b>1 gestión activa</b><span>Documentación ISP · 0 de 2 cumplidos · vence el 16/11</span><span class="der"><button class="hc-b s ch">Ver sus clientes</button></span></div>'; }
    if(est){ const rot = est.previousElementSibling && /Estatus legal/i.test(est.previousElementSibling.textContent) ? est.previousElementSibling : null; if(rot) rot.remove(); est.innerHTML = ''; est.style.display = 'none'; }
    const fila = f.parentElement; f.remove();
    fila.insertAdjacentHTML('beforebegin', '<div class="zz-gestl"><b>1 gestión activa</b><span>Documentación ISP · 0 de 2 cumplidos · vence el 16/11</span><span class="der"><button class="hc-b s ch">Ver sus clientes</button></span></div>');
    fila.insertAdjacentHTML('beforebegin', '<div class="zz-fil" style="position:relative"><button class="zz-dd' + (pop === 'est' ? ' on' : '') + '">Estatus legal: <b>Todos</b><svg class="i" viewBox="0 0 24 24" style="width:14px;height:14px"><path d="M6 9l6 6 6-6"/></svg></button>' +
      '<button class="zz-dd' + (pop === 'fecha' ? ' on' : '') + '">' + (pop === 'aplicado' ? 'Entró: <b>octubre 2026</b>' : 'Fecha: <b>cualquiera</b>') + '<svg class="i" viewBox="0 0 24 24" style="width:14px;height:14px"><path d="M6 9l6 6 6-6"/></svg></button><button class="zz-dd">Más filtros</button>' +
      '<span class="zz-sep"></span><span style="font-size:13px;color:var(--text2)">' + (pop === 'aplicado' ? '7 clientes · <button class="enlace">Quitar todo</button>' : '') + '</span>' +
      (pop === 'fecha' ? '<div class="zz-pop" style="top:48px;left:190px"><span class="lbl">Fecha de</span><div class="ops"><span class="on">Entró a la app</span><span>Cambió de estatus</span><span>Firmó el contrato</span><span>Vence el contrato</span></div>' +
        '<span class="lbl">Cuándo</span><div class="ops"><span>Este mes</span><span class="on">Mes pasado</span><span>Últimos 30 días</span><span>Este año</span><span>Entre fechas</span></div>' +
        '<div class="dos"><div><label>Desde</label><input class="campo" type="date" value="2026-10-01"></div><div><label>Hasta</label><input class="campo" type="date" value="2026-10-31"></div></div><div class="acc"><button class="hc-b s ch">Quitar</button><button class="hc-b ch">Ver 7 clientes</button></div></div>' : '') +
      (pop === 'est' ? '<div class="zz-pop" style="top:48px;left:0;width:330px;padding:8px"><div class="zz-est"><span class="on">Todos<em>29</em></span>' + [['#8A929C', 'Grandes negocios', 2], ['#1F45C4', 'Documentos solicitados', 16], ['#A32117', 'Documentos pendientes', 1], ['#C98A12', 'Documentos en revisión', 1], ['#0F6642', 'Documentos recibidos', 0], ['#5B3AA6', 'Contrato en curso', 0], ['#5B3AA6', 'Pendiente por firmar', 0], ['#0F6642', 'Contrato firmado', 9]].map((x) => '<span><i style="background:' + x[0] + '"></i>' + x[1] + '<em>' + x[2] + '</em></span>').join('') + '</div></div>' : '') + '</div>');
  }, pop);
  await clientes(''); await tomar(q, '06-clientes-filtros');
  await q.reload(); await q.waitForSelector('#estLegal [data-est-legal]'); await q.waitForTimeout(800); await q.addStyleTag({ content: CSS }); await clientes('fecha'); await tomar(q, '06b-clientes-fecha');
  await q.reload(); await q.waitForSelector('#estLegal [data-est-legal]'); await q.waitForTimeout(800); await q.addStyleTag({ content: CSS }); await clientes('est'); await tomar(q, '06c-clientes-estatus');
  await c2.ctx.close();

  // 07: Mi trabajo del administrador: todo plegado como el de Legal (también líder, analista y coordinadora)
  const hoyS = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const cl = mundo.datos.clientes;
  mundo.datos.extra = [0, 1, 2].map((i) => ({ tipo: 'revisar_docs', clave: 'r' + i, cliente_id: cl[i].id, titulo: cl[i].nombre, detalle: 'Subió 3 documentos', para: 'admin', vence: hoyS(i - 1), desde: hoyS(-2) + 'T12:00:00Z', ref: {} }))
    .concat([3, 4].map((i) => ({ tipo: 'legal_obs', clave: 'o' + i, cliente_id: cl[i].id, titulo: cl[i].nombre, detalle: 'Legal marcó un problema', para: 'admin', vence: hoyS(1), desde: hoyS(-1) + 'T12:00:00Z', ref: {} })));
  const c3 = await contexto(nav, PC, mundo); const t = await entrar(c3.ctx, 'marcos', '482913');
  await t.goto(H + 'trabajo.html'); await t.waitForTimeout(1800); await t.addStyleTag({ content: CSS });
  await t.evaluate(() => {
    const cu = document.querySelector('#cuerpo'); if(!cu) return;
    // Lo más urgente deja de ser una sección suelta: queda como pastilla de vencidos en cada grupo
    const urg = Array.from(cu.children).find((x) => /Lo más urgente/.test(x.textContent.slice(0, 40))); if(urg) urg.remove();
    cu.querySelectorAll('details').forEach((d) => { d.open = false; });
    const eq = Array.from(cu.children).find((x) => /^\s*El equipo/.test(x.textContent));
    if(eq){ const n = eq.querySelectorAll('.bz-tm').length; eq.outerHTML = '<details class="bz-pl"><summary><b>El equipo</b><span class="bz-pl-n">' + n + '</span><span class="mt-pill r">2 vencidos</span></summary></details>'; }
    const pr = cu.querySelector('details'); if(pr) pr.insertAdjacentHTML('beforebegin', '<p class="nota-chica" style="margin:4px 0 10px">Todo plegado: abre solo lo que vas a trabajar. Se recuerda lo que dejaste abierto.</p>');
  });
  await tomar(t, '07-mi-trabajo-plegado');
  await c3.ctx.close();
  // 08: teléfono: el visor ya es una hoja de casi todo el alto
  const c4 = await contexto(nav, TEL, mundo); const tl = await entrar(c4.ctx, 'marcos', '482913');
  await tl.goto(H + 'clientes.html?c=1001&t=documentos'); await tl.waitForSelector('#paso [data-paso="revisar"]'); await tl.click('#paso [data-paso="revisar"]'); await tl.waitForSelector('#hojaVer.ver'); await tl.waitForTimeout(600);
  await tomar(tl, '08-tel-visor-hoy');
  await c4.ctx.close();
  await nav.close();
})();
