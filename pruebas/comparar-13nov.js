// Lote 13/11: capturas de las pantallas del lote y una imagen lado a lado (maqueta | captura) para revisarlas con lupa.
// Uso: servidor en la raíz y, desde pruebas/: node comparar-13nov.js [revision|clientes|trabajo|comisiones|...]
// Las capturas quedan en capturas/lote13nov-pN-*.png y las comparaciones en capturas/lote13nov-comparar/.
const { chromium, H, TEL, PC, contexto, entrar } = require('./simulador');
const fs = require('fs'); const path = require('path');
const MAQ = path.join(__dirname, '../claude/maquetas/obs-13nov/img/');
const OUT = path.join(__dirname, 'capturas/'); const CMP = OUT + 'lote13nov-comparar/';
const solo = process.argv[2] ? process.argv[2].split(',') : null;

// Ajustes del mundo para cada caso (datos inventados)
const separar = (m) => { const c = m.datos.clientes.find((x) => x.id === 1001); const a = c.documentos.find((d) => d.casilla === 'acta_asamblea');
  a.archivos = [{ id: 1008, ruta: null, url_externa: null, nombre: 'ejemplo-acta_asamblea.pdf', mime: 'application/pdf', tamano: 250000 }]; c.documentos.forEach((d) => { d.comparte = []; }); };
const mismo = (m) => { const c = m.datos.clientes.find((x) => x.id === 1001); const arch = { id: 1006, ruta: null, url_externa: null, nombre: 'expediente-completo.pdf', mime: 'application/pdf', tamano: 250000 };
  ['acta_constitutiva', 'acta_asamblea', 'rif_empresa'].forEach((k) => { const d = c.documentos.find((x) => x.casilla === k); d.archivos = [arch]; d.estado = 'por_revisar'; });
  const pg = { acta_constitutiva: 1, rif_empresa: 13 }; c.marcas = c.marcas || {};
  c.documentos.filter((d) => pg[d.casilla]).forEach((d) => { c.marcas[d.id] = { documento: d.id, accion: 'aprobar', motivo: null, nota: null, vence_en: null, por: 'Marcos Rivas', en: new Date().toISOString(), origen: 'manual', pagina: pg[d.casilla] }; }); };
const varios = (m) => { separar(m); const c = m.datos.clientes.find((x) => x.id === 1001); const d = c.documentos.find((x) => x.casilla === 'acta_constitutiva');
  d.archivos = ['acta-p1.pdf', 'acta-p2.pdf', 'foto.jpg'].map((n, i) => ({ id: 1100 + i, ruta: null, url_externa: null, nombre: n, mime: /pdf$/.test(n) ? 'application/pdf' : 'image/jpeg', tamano: 1000 })); };
const docId = (m, cas) => m.datos.clientes.find((x) => x.id === 1001).documentos.find((d) => d.casilla === cas).id;
const abrirRev = async (p) => { await p.goto(H + 'clientes.html?c=1001&t=documentos'); await p.waitForSelector('#paso [data-paso="revisar"]'); await p.click('#paso [data-paso="revisar"]');
  await p.waitForSelector('#hojaVer.ver .rv-c', { state: 'attached' }); await p.waitForTimeout(500); };
const ir = async (p, m, cas) => { await p.click('#hojaVer [data-rv-ir="d:' + docId(m, cas) + '"]'); await p.waitForTimeout(300); };

const CASOS = {
  revision: [
    { n: 'p2-01-visor-alto', maq: '01-visor-alto', prep: separar, act: async (p, m) => { await abrirRev(p); } },
    { n: 'p2-01b-mas', maq: '01b-mas', prep: separar, act: async (p, m) => { await abrirRev(p); await p.click('#rvMas'); } },
    { n: 'p3-02-devolver-cedula', maq: '02-devolver-cedula', prep: separar, act: async (p, m) => { await abrirRev(p); await p.click('#verDevolver'); await p.click('[data-motivo="ilegible"]'); await p.fill('#notaDev', 'Tómale la foto de frente, sin flash.'); } },
    { n: 'p3-02b-devolver-rif-personal', maq: '02b-devolver-rif-personal', prep: separar, act: async (p, m) => { await abrirRev(p); await ir(p, m, 'rif_personal'); await p.click('#verDevolver'); await p.click('[data-motivo="vencido"]'); } },
    { n: 'p3-03-acta-falta-un-acta', maq: '03-acta-falta-un-acta', prep: separar, act: async (p, m) => { await abrirRev(p); await ir(p, m, 'acta_constitutiva'); await p.click('#verDevolver'); await p.click('[data-motivo="falta_acta"]'); await p.click('[data-rv-acta="junta"]'); } },
    { n: 'p4-04-es-otro-documento', maq: '04-es-otro-documento', prep: separar, act: async (p, m) => { await abrirRev(p); await ir(p, m, 'acta_constitutiva'); await p.click('#rvMas'); await p.click('[data-rv-masop="otro"]'); await p.click('[data-rv-otro="acta_asamblea"]'); } },
    { n: 'p5-05-mismo-archivo', maq: '05-mismo-archivo', prep: mismo, act: async (p, m) => { await abrirRev(p); await ir(p, m, 'acta_asamblea'); } },
    { n: 'p5-05c-mismo-archivo-devolver', maq: '05c-mismo-archivo-devolver', prep: mismo, act: async (p, m) => { await abrirRev(p); await ir(p, m, 'acta_asamblea'); await p.click('#verDevolver'); await p.click('[data-motivo="ilegible"]'); } },
    { n: 'p5-05b-varios-archivos', maq: '05b-varios-archivos', prep: varios, act: async (p, m) => { await abrirRev(p); await ir(p, m, 'acta_constitutiva'); } }
  ],
  trabajo: [
    { n: 'p7-07-mi-trabajo-plegado', maq: '07-mi-trabajo-plegado', prep: (m) => { const hoyS = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); }; const cl = m.datos.clientes;
      m.datos.extra = [0, 1, 2].map((i) => ({ tipo: 'revisar_docs', clave: 'r' + i, cliente_id: cl[i].id, titulo: cl[i].nombre, detalle: 'Subió 3 documentos', para: 'admin', vence: hoyS(i - 1), desde: hoyS(-2) + 'T12:00:00Z', ref: {} }))
        .concat([3, 4].map((i) => ({ tipo: 'legal_obs', clave: 'o' + i, cliente_id: cl[i].id, titulo: cl[i].nombre, detalle: 'Legal marcó un problema', para: 'admin', vence: hoyS(1), desde: hoyS(-1) + 'T12:00:00Z', ref: {} }))); },
      act: async (p) => { await p.goto(H + 'trabajo.html'); await p.waitForTimeout(1800); } }
  ],
  comisiones: [
    { n: 'p8-11-comisiones-filtros', maq: '11-comisiones-filtros', act: async (p) => { await p.goto(H + 'comisiones.html'); await p.waitForSelector('.cx-grupo', { timeout: 15000 }); await p.waitForTimeout(800); } },
    { n: 'p8-11b-comisiones-equipo', maq: '11b-comisiones-equipo', act: async (p) => { await p.goto(H + 'comisiones.html'); await p.waitForSelector('.cx-grupo', { timeout: 15000 }); await p.click('#cxEqBtn'); } },
    { n: 'p8-11c-comisiones-fechas', maq: '11c-comisiones-fechas', act: async (p) => { await p.goto(H + 'comisiones.html'); await p.waitForSelector('.cx-grupo', { timeout: 15000 }); await p.click('#cxFeBtn'); } },
    { n: 'p8-11d-comisiones-mas', maq: '11d-comisiones-mas', act: async (p) => { await p.goto(H + 'comisiones.html'); await p.waitForSelector('.cx-grupo', { timeout: 15000 }); await p.click('#cxMasBtn'); } },
    { n: 'p9-11-comisiones-analista', maq: '11-comisiones-filtros-analista', u: 'elena', pin: '315806', act: async (p) => { await p.goto(H + 'comisiones.html'); await p.waitForSelector('.cx-grupo', { timeout: 15000 }); await p.waitForTimeout(800); } },
    { n: 'p8-tel-comisiones', tel: true, act: async (p) => { await p.goto(H + 'comisiones.html'); await p.waitForSelector('.cx-grupo', { timeout: 15000 }); await p.evaluate(() => document.querySelector('.cx-p2').scrollIntoView()); await p.waitForTimeout(600); } },
    { n: 'p8-tel-comisiones-equipo', tel: true, act: async (p) => { await p.goto(H + 'comisiones.html'); await p.waitForSelector('.cx-grupo', { timeout: 15000 }); await p.click('#cxEqBtn'); } }
  ],
  revisiontel: [
    { n: 'p10-tel-lista', tel: true, prep: separar, act: async (p) => { await abrirRev(p); } },
    { n: 'p10-tel-documento', tel: true, prep: separar, act: async (p) => { await abrirRev(p); await p.click('#hojaVer .rv-d.sel'); } },
    { n: 'p10-tel-devolver', tel: true, prep: separar, act: async (p) => { await abrirRev(p); await p.click('#hojaVer .rv-d.sel'); await p.click('#verDevolver'); await p.click('[data-motivo="ilegible"]'); } },
    { n: 'p10-tel-mismo-archivo', tel: true, prep: mismo, act: async (p, m) => { await abrirRev(p); await ir(p, m, 'acta_asamblea'); } }
  ]
};
module.exports = { CASOS };

async function ladoALado(nav, maq, cap, sal){
  const pg = await nav.newPage({ viewport: { width: 2752, height: 800 } });
  const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  await pg.setContent('<body style="margin:0;background:#888;display:flex;gap:20px;font:14px sans-serif"><div><div style="color:#fff;padding:4px">Maqueta</div><img src="' + b64(maq) + '" style="width:1366px;height:768px;display:block"></div>' +
    '<div><div style="color:#fff;padding:4px">Publicado</div><img src="' + b64(cap) + '" style="width:1366px;height:768px;display:block"></div></body>');
  await pg.screenshot({ path: sal }); await pg.close();
}
if(require.main === module) (async () => {
  fs.mkdirSync(CMP, { recursive: true });
  const nav = await chromium.launch();
  for(const [grupo, casos] of Object.entries(CASOS)){
    if(solo && !solo.includes(grupo)) continue;
    for(const c of casos){
      const { ctx, mundo: m } = await contexto(nav, c.tel ? TEL : PC); if(c.prep) c.prep(m);
      const p = await entrar(ctx, c.u || 'marcos', c.pin || '482913'); p.on('pageerror', (e) => console.log('ERROR ' + c.n + ': ' + e.message));
      try { await c.act(p, m); await p.waitForTimeout(500); const f = OUT + 'lote13nov-' + c.n + '-' + (c.tel ? 'tel' : 'pc') + '.png'; await p.screenshot({ path: f });
        if(c.maq) await ladoALado(nav, MAQ + c.maq + '.png', f, CMP + c.n + '.png'); console.log('ok ' + c.n); }
      catch (e) { console.log('NO ' + c.n + ': ' + e.message.split('\n')[0]); }
      await ctx.close();
    }
  }
  await nav.close();
})();
