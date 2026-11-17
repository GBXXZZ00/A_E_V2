// Lote 16/11 A: capturas de las pantallas del lote y una imagen lado a lado (maqueta | publicado).
// Uso: servidor en la raíz y, desde pruebas/: node comparar-16nov.js [migraciones|solicitud|comisiones]
// Capturas en capturas/lote16nov-*.png y comparaciones en capturas/lote16nov-comparar/ (no se suben). Datos inventados.
const { chromium, H, TEL, PC, contexto, entrar } = require('./simulador');
const { RPC } = require('./mundo');
const fs = require('fs'); const path = require('path');
const MAQ = path.join(__dirname, '../claude/maquetas/lote-16nov/img/');
const OUT = path.join(__dirname, 'capturas/'); const CMP = OUT + 'lote16nov-comparar/';
const solo = process.argv[2] ? process.argv[2].split(',') : null;
const ROSA = { id: '22222222-2222-4222-8222-000000000009', usuario: 'rosa', pin: '700111', nombre: 'Rosa Paredes', rol: 'lider', cargo: 'Líder de ventas', equipo: 'ventas', codigo_vendedor: null, nombre_odoo: 'Rosa Paredes', activo: true, debe_cambiar_pin: false };
const dia = (n) => new Date(Date.now() - n * 86400000).toISOString();
const FILAS = [{ s: '824', c: '9910007', e: '48575443AAAA0007', t: 'J', d: 'J-591000077', n: 'Comercial de Prueba 7, C.A.', p: 'PROMO-RES', ca: 'PROMO-1GB', es: 'ACTIVO', di: 'Calle Falsa 7' }];
function mundoMig(m){
  m.personas.push(Object.assign({}, ROSA));
  const adm = m.personas.find((p) => p.rol === 'admin'); const k = RPC.tad_indice_iniciar(m, adm, { p_archivo: 'tad.csv', p_total: 1 }); RPC.tad_indice_parte(m, adm, { p_carga: k, p_filas: FILAS }); RPC.tad_indice_cerrar(m, adm, { p_carga: k });
  const K = m.datos.cambiosK; K.hasta = new Date().toISOString().slice(0, 10); K.archivo = { en: new Date().toISOString(), filas: 9 };
  const L = m.personas.find((p) => p.usuario === 'lucia'); const idx = Object.values(K.idx)[0];
  const f = (id, o) => Object.assign({ id, origen: 'app', creado_en: dia(o.d), creado_por: L.nombre, creado_por_id: L.id, lider_id: L.id, lider: L.nombre, tipo: 'migracion', nuevo: null, aviso: null, pagado_fuera: false, bitacora: [],
    categoria_anterior: o.ca || 'PROMO-1GB', categoria_nueva: 'PYME-1GB', servicios: [{ sucursal: '824', codigo: o.cod }], titular: { tipo: o.tt || 'J', doc: o.doc, nombre: o.n } }, o.x || {});
  K.filas.push(
    f(701, { d: 16, n: 'Comercial de Prueba 7, C.A.', doc: '591000077', cod: '9910007', x: { estado: 'sin_registro', origen: 'archivo', creado_por: null, creado_por_id: null, fecha_cambio: dia(16), reporte: { fecha: dia(16).slice(0, 10) }, servicios: [Object.assign({}, idx)] } }),
    f(702, { d: 11, n: 'Kiosco La Parada', doc: '99100022', tt: 'V', cod: '99100002', ca: '1 GB', x: { estado: 'sin_registro', origen: 'archivo', creado_por: null, creado_por_id: null, fecha_cambio: dia(11), reporte: { fecha: dia(11).slice(0, 10), comentario: 'solicitado por Lucía' }, sugerido_id: L.id } }),
    f(703, { d: 7, n: 'Vidrios El Faro, C.A.', doc: '591000011', cod: '99100001', x: { estado: 'por_revisar' } }),
    f(704, { d: 14, n: 'Tornillos El Yunque, C.A.', doc: '591000044', cod: '99100004', ca: '1 GB', x: { estado: 'confirmado', fecha_cambio: dia(14), confirmado_en: dia(12), confirmado_como: 'tad', comision: null } }),
    f(705, { d: 4, n: 'Autolavado El Chorro, C.A.', doc: '591000066', cod: '99100006', x: { estado: 'por_emitir', aprobado_en: dia(3) } }),
    f(706, { d: 19, n: 'Inversiones Bahía Azul, C.A.', doc: '591000033', cod: '99100003', ca: '1 GB', x: { estado: 'confirmado', fecha_cambio: dia(19), confirmado_en: dia(18), confirmado_como: 'tad', comision: 'no', cierre_nota: 'ya era cliente PYME' } }),
    f(707, { d: 21, n: 'Comercial de Prueba 11, C.A.', doc: '591000111', cod: '9910011', ca: '1 GB', x: { estado: 'sin_registro', origen: 'archivo', creado_por: null, creado_por_id: null, lider_id: ROSA.id, lider: ROSA.nombre, fecha_cambio: dia(21), reporte: { fecha: dia(21).slice(0, 10) } } }),
    f(708, { d: 6, n: 'Bodega Revisable, C.A.', doc: '000000032', cod: '9910030', x: { estado: 'sin_registro', origen: 'archivo', creado_por: null, creado_por_id: null, lider_id: null, lider: null, fecha_cambio: dia(6) } }),
    f(709, { d: 16, n: 'Licorería Prueba', doc: '9910040', tt: 'V', cod: '9910040', ca: 'PYME-1GB', x: { tipo: 'residencial', categoria_nueva: '1 GB', estado: 'sin_registro', origen: 'archivo', creado_por: null, creado_por_id: null, lider_id: null, lider: null, fecha_cambio: dia(16) } }));
  // La de Vidrios con sus documentos completos (por revisar)
}
// Órdenes de hasta 5 días de Lucía para el bloque Por instalar de Comisiones
function mundoCom(m){
  mundoMig(m);
  const L = m.personas.find((p) => p.usuario === 'lucia'); const cs = m.datos.clientes.filter((c) => c.lider_id === L.id && !c.orden).slice(0, 2);
  cs.forEach((c, i) => { c.orden = { id: 8800 + i, numero: 'F-OPE-0001/41003' + i, creada_en: dia(i ? 3.25 : 1.1), etapa: 'Programado' }; c.instalaciones = []; c.pendiente = true; });
}
const CASOS = {
  migraciones: [
    { n: 'migraciones-admin', maq: 'migraciones-admin-pc', prep: mundoMig, act: async (p) => { await p.goto(H + 'migraciones.html'); await p.waitForSelector('.mg-kpis'); await p.waitForTimeout(600); } },
    { n: 'migraciones-admin', maq: 'migraciones-admin-tel', tel: true, full: true, prep: mundoMig, act: async (p) => { await p.goto(H + 'migraciones.html'); await p.waitForSelector('.mg-kpis'); await p.waitForTimeout(600); } },
    { n: 'migraciones-lider', maq: 'migraciones-lider-pc', u: 'lucia', pin: '739105', prep: mundoMig, act: async (p) => { await p.goto(H + 'migraciones.html'); await p.waitForSelector('.mg-kpis'); await p.waitForTimeout(600); } },
    { n: 'migraciones-lider', maq: 'migraciones-lider-tel', tel: true, full: true, u: 'lucia', pin: '739105', prep: mundoMig, act: async (p) => { await p.goto(H + 'migraciones.html'); await p.waitForSelector('.mg-kpis'); await p.waitForTimeout(600); } }
  ],
  solicitud: [false, true].map((tel) => ({ n: 'sol-p3', maq: 'sol-p3-' + (tel ? 'tel' : 'pc'), tel, full: true, u: 'lucia', pin: '739105', prep: mundoMig, act: async (p, m) => {
    await p.goto(H + 'migraciones.html'); await p.waitForSelector('.mg-r'); await p.locator('.mg-r', { hasText: 'Comercial de Prueba 7' }).locator('[data-mg="registrar"]').click();
    await p.waitForSelector('#msFondo:not([hidden]) [data-mstipo]'); await p.click('[data-ms="sig1"]'); await p.waitForSelector('#msRifZona'); await p.click('[data-ms="sig2"]'); await p.waitForSelector('.ms-doc');
    // Dos documentos ya en el expediente, como en la maqueta
    const c = m.datos.clientes.find((x) => x.doc_numero === '591000077'); c.documentos = c.documentos || [];
    [['rif_empresa', 0], ['acta_constitutiva', 0]].forEach((x, i) => c.documentos.push({ id: 99100 + i, casilla: x[0], numero: x[1], estado: 'por_revisar', archivos: [{ id: 'q' + i, nombre: x[0] + '.pdf', vigente: true }] }));
    await p.keyboard.press('Escape'); await p.waitForTimeout(300); await p.locator('.mg-r', { hasText: 'Comercial de Prueba 7' }).locator('[data-mg="seguir"]').click(); await p.waitForSelector('.ms-doc'); await p.waitForTimeout(400); } }))
    .concat([false, true].map((tel) => ({ n: 'sol-p4', maq: 'sol-p4-' + (tel ? 'tel' : 'pc'), tel, full: true, u: 'lucia', pin: '739105', prep: mundoMig, act: async (p, m) => {
      await p.goto(H + 'migraciones.html'); await p.waitForSelector('.mg-r'); await p.locator('.mg-r', { hasText: 'Comercial de Prueba 7' }).locator('[data-mg="registrar"]').click();
      await p.waitForSelector('#msFondo:not([hidden]) [data-mstipo]'); await p.click('[data-ms="sig1"]'); await p.waitForSelector('#msRifZona'); await p.click('[data-ms="sig2"]'); await p.waitForSelector('.ms-doc');
      const lucia = m.personas.find((x) => x.usuario === 'lucia'); const d = RPC.cambio_detalle(m, lucia, { p_id: 701 });
      (d.requisitos || []).forEach((r, i) => { const c = m.datos.clientes.find((x) => x.id === r.cliente_id); c.documentos = c.documentos || []; c.documentos.push({ id: 99200 + i, casilla: r.casilla, numero: r.numero, estado: 'por_revisar', archivos: [{ id: 'w' + i, nombre: 'x.pdf', vigente: true }] }); });
      await p.keyboard.press('Escape'); await p.waitForTimeout(300); await p.locator('.mg-r', { hasText: 'Comercial de Prueba 7' }).locator('[data-mg="seguir"]').click(); await p.waitForSelector('.ms-doc');
      await p.click('[data-ms="enviar"]'); await p.waitForSelector('.ms-ok'); await p.waitForTimeout(300); } }))),
  comisiones: [['admin', 'marcos', '482913'], ['lider', 'lucia', '739105']].reduce((a, x) => a.concat([false, true].map((tel) => ({ n: 'comisiones-' + x[0], maq: 'comisiones-' + x[0] + '-' + (tel ? 'tel' : 'pc'), tel, full: tel, u: x[1], pin: x[2], prep: mundoCom, alto: 900,
    act: async (p) => { await p.goto(H + 'comisiones.html'); await p.waitForSelector('.cx-grupo .cx-blq.am', { state: 'attached' }); const g = p.locator('.cx-grupo', { hasText: 'Lucía Ferrer' }).first();
      if(!(await g.evaluate((y) => y.classList.contains('abierto')))) await g.locator('.cx-ga').click(); await p.waitForTimeout(400); await g.evaluate((y) => y.scrollIntoView({ block: 'start' })).catch(() => {}); await p.evaluate(() => window.scrollTo(0, 0)); } }))), [])
};
async function ladoALado(nav, maq, cap, sal){
  const pg = await nav.newPage({ viewport: { width: 2752, height: 800 } });
  const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  await pg.setContent('<body style="margin:0;background:#888;display:flex;gap:20px;font:14px sans-serif;align-items:flex-start"><div><div style="color:#fff;padding:4px">Maqueta</div><img src="' + b64(maq) + '" style="width:1366px;display:block"></div>' +
    '<div><div style="color:#fff;padding:4px">Publicado</div><img src="' + b64(cap) + '" style="width:1366px;display:block"></div></body>');
  await pg.waitForTimeout(100); await pg.screenshot({ path: sal, fullPage: true }); await pg.close();
}
(async () => {
  fs.mkdirSync(CMP, { recursive: true });
  const nav = await chromium.launch();
  for(const [grupo, casos] of Object.entries(CASOS)){
    if(solo && !solo.includes(grupo)) continue;
    for(const c of casos){
      const { ctx, mundo: m } = await contexto(nav, c.tel ? TEL : PC); if(c.prep) c.prep(m);
      const p = await entrar(ctx, c.u || 'marcos', c.pin || '482913'); p.on('pageerror', (e) => console.log('ERROR ' + c.n + ': ' + e.message));
      if(!c.tel && c.alto) await p.setViewportSize({ width: 1366, height: c.alto });
      try { await c.act(p, m); await p.waitForTimeout(500); const f = OUT + 'lote16nov-' + c.maq + '.png'; await p.screenshot({ path: f, fullPage: !!c.full });
        await ladoALado(nav, MAQ + c.maq + '.png', f, CMP + c.maq + '.png'); console.log('ok ' + c.maq); }
      catch (e) { console.log('NO ' + c.maq + ': ' + e.message.split('\n')[0]); }
      await ctx.close();
    }
  }
  await nav.close();
})();
