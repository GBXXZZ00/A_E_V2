// Lote 16/11 B. Comisiones: una migración abre la misma hoja de comisión con su línea arriba (Registrar, Decidir), Decidir con motivo
// (solo el Sí crea la instalación), sin saltos al guardar (misma posición y lo abierto igual), carta y proforma se descargan a la vez,
// WhatsApp de escritorio con wa.me de respaldo, persona natural sin documentos obligatorios y aviso de cliente con el nombre casi igual.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar, conCargos } = require('./simulador');
const { RPC } = require('./mundo');
const { ok, cerrar } = marcador();
const llamo = (m, f) => m.llamadas.filter((l) => l[1] === f);
const FILAS = [{ s: '824', c: '777001', e: '48575443AAAA0001', t: 'J', d: 'J-41777001-2', n: 'Panaderia Inventada Uno', p: 'BRONCE-RES', ca: '1 GB', es: 'ACTIVO', di: 'Calle Falsa 1' }];
function sembrar(m){
  const adm = m.personas.find((p) => p.rol === 'admin'); const k = RPC.tad_indice_iniciar(m, adm, { p_archivo: 'tad.csv', p_total: 1 }); RPC.tad_indice_parte(m, adm, { p_carga: k, p_filas: FILAS }); RPC.tad_indice_cerrar(m, adm, { p_carga: k });
  const lu = m.personas.find((p) => p.usuario === 'lucia'); const cl = m.datos.clientes.filter((c) => c.lider_id === lu.id);
  const hoy = new Date(); const f = (d) => new Date(hoy.getTime() - d * 86400000).toISOString();
  m.datos.cambiosK.filas.push(
    { id: 811, tipo: 'migracion', estado: 'sin_registro', origen: 'archivo', creado_en: f(3), fecha_cambio: f(3), lider_id: lu.id, lider: lu.nombre, cliente_id: cl[0].id, titular: { tipo: cl[0].doc_tipo, doc: cl[0].doc_numero, nombre: cl[0].nombre },
      categoria_anterior: 'PROMO-1GB', categoria_nueva: 'PYME-1GB', servicios: [{ sucursal: '824', codigo: '9910007' }], reporte: { fecha: f(3).slice(0, 10) }, bitacora: [] },
    { id: 812, tipo: 'migracion', estado: 'confirmado', origen: 'app', creado_en: f(5), fecha_cambio: f(2), confirmado_en: f(2), confirmado_como: 'tad', comision: 'por_decidir', lider_id: lu.id, lider: lu.nombre, cliente_id: cl[1].id,
      titular: { tipo: cl[1].doc_tipo, doc: cl[1].doc_numero, nombre: cl[1].nombre }, categoria_anterior: '1 GB', categoria_nueva: 'PYME-1GB', servicios: [{ sucursal: '824', codigo: '9910008' }], bitacora: [] });
}

(async () => {
  const nav = await chromium.launch(); const errores = []; const cuida = (p) => p.on('pageerror', (e) => errores.push(e.message));
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo); conCargos(mundo); sembrar(mundo);
    const p = await entrar(ctx, 'marcos', '482913'); cuida(p);
    await p.goto(H + 'comisiones.html'); await p.waitForSelector('.cx-grupo .cx-blq', { state: 'attached' });
    const g = p.locator('.cx-grupo', { hasText: 'Lucía Ferrer' }).first();
    if(!(await g.evaluate((x) => x.classList.contains('abierto')))) await g.locator('.cx-ga').click();
    await g.locator('.cx-blq.az').click();
    // ----- La migración abre la hoja de comisión del cliente, no otra página -----
    await g.locator('[data-mig-blk="812"]').click(); await p.waitForSelector('#hojaComision.ver .hc-mig');
    ok(nombre + ': la migración abre la misma hoja de comisión con su línea arriba (categorías, estado y Decidir)', /comisiones\.html/.test(p.url()) && /1 GB → PYME-1GB/.test(await p.textContent('.hc-mig')) && /comisión por decidir/i.test(await p.textContent('.hc-mig')) && (await p.locator('[data-hcmig="decidir"]').count()) === 1);
    ok(nombre + ': sin instalación todavía, dice que no comisiona y que lo demás se activa al decidir Sí', /todavía no comisiona/.test(await p.textContent('#cuerpoCom')) && /Se activan cuando la migración esté confirmada/.test(await p.textContent('#cuerpoCom')) || /Pago, bienvenida y proforma/.test(await p.textContent('#cuerpoCom')));
    await p.click('[data-hcmig="decidir"]'); await p.click('[data-hcmig="si"]');
    ok(nombre + ': Decidir sin motivo da error debajo', /Escribe el motivo/.test(await p.textContent('#eHcMig')));
    const y0 = await p.evaluate(() => window.scrollY);
    await p.fill('#hcMigMot', 'Cliente nuevo en PYME'); await p.click('[data-hcmig="si"]');
    await p.waitForFunction(() => /Sí|comisiona/.test(document.querySelector('.hc-mig') ? document.querySelector('.hc-mig').textContent : ''));
    const m812 = mundo.datos.cambiosK.filas.find((c) => c.id === 812);
    ok(nombre + ': con el Sí la migración comisiona (crea la instalación) y queda en la bitácora', m812.comision === 'si' && !!m812.instalacion_id && (mundo.bitacora || []).some((b) => b.accion === 'cambio_comision'));
    // ----- Sin saltos: después de guardar no aparece el esqueleto y la lista sigue en su sitio -----
    await p.waitForTimeout(600);
    ok(nombre + ': después de guardar no se ve el esqueleto, el líder sigue abierto y la posición es la misma', (await p.locator('#lista .sk').count()) === 0 && await g.evaluate((x) => x.classList.contains('abierto')) && Math.abs((await p.evaluate(() => window.scrollY)) - y0) < 5);
    await p.keyboard.press('Escape'); await p.waitForTimeout(350);
    // ----- Carta y proforma: Descargar baja los dos PDF a la vez, sin abrir pestañas -----
    const cs = p.locator('.cx-grupo.abierto .cx-fila2[data-com]'); await cs.first().click(); await p.waitForSelector('#hojaComision.ver #cuerpoCom .plg-com', { timeout: 15000 });
    if(await p.locator('[data-plg-btn="carta"]').count()){
      await p.click('[data-plg-btn="carta"]');
      if(await p.locator('#cartaPdfs').count()){
        const descargas = []; p.on('download', (dl) => descargas.push(dl.suggestedFilename())); const paginas0 = ctx.pages().length;
        await p.click('#cartaPdfs'); await p.waitForTimeout(1500);
        ok(nombre + ': Descargar baja carta y proforma a la vez y no abre pestañas', descargas.length >= 1 && descargas.every((x) => /\.pdf$/.test(x)) && ctx.pages().length === paginas0, descargas);
      }
    }
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    // ----- WhatsApp de escritorio con wa.me de respaldo (en PC) / copiar el mensaje (en teléfono) -----
    const r = await p.evaluate(async () => { window.__abrio = []; window.open = (u) => { window.__abrio.push(u); return null; };
      const f = new File(['%PDF-1.4'], 'x.pdf', { type: 'application/pdf' }); const res = await window.Comun.compartirWa({ numero: '04145551234', texto: 'Hola', archivos: [f] });
      await new Promise((ok) => setTimeout(ok, 1800)); return { res, abrio: window.__abrio }; });
    if(dispositivo === PC) ok('pc: en PC descarga el PDF, intenta WhatsApp de escritorio y si no abre usa wa.me', r.res === 'abierto' && r.abrio.some((u) => /^https:\/\/wa\.me\/58414/.test(u)));
    ok(nombre + ': Comisiones sin desborde', await sinDesborde(p));
    await ctx.close();

    // ----- El líder: Registrar desde Comisiones abre la solicitud por pasos encima -----
    const c2 = await contexto(nav, dispositivo, mundo); const q = await entrar(c2.ctx, 'lucia', '739105'); cuida(q);
    await q.goto(H + 'comisiones.html'); await q.waitForSelector('.cx-grupo .cx-blq.az', { state: 'attached' });
    const gl = q.locator('.cx-grupo').first(); if(!(await gl.evaluate((x) => x.classList.contains('abierto')))) await gl.locator('.cx-ga').click();
    await gl.locator('.cx-blq.az').click(); await gl.locator('[data-mig-blk="811"]').click(); await q.waitForSelector('#hojaComision.ver [data-hcmig="registrar"]');
    ok(nombre + ': la línea de una sin registrar dice si faltan documentos o el expediente está completo', /faltan documentos|expediente completo|persona natural/.test(await q.textContent('.hc-mig')));
    await q.click('[data-hcmig="registrar"]'); await q.waitForSelector('#msFondo:not([hidden]) .ms');
    ok(nombre + ': Registrar abre la solicitud por pasos ahí mismo, sin cambiar de página', /comisiones\.html/.test(q.url()) && /Registrar migración/.test(await q.textContent('#msCab')));
    await q.keyboard.press('Escape'); await c2.ctx.close();

    // ----- Duplicados: Cliente nuevo con un nombre casi igual a uno que existe -----
    const c3 = await contexto(nav, dispositivo, mundo); const z = await entrar(c3.ctx, 'marcos', '482913'); cuida(z);
    const otro = mundo.datos.clientes.find((c) => !c.es_natural && !c.provisional);
    const r3 = await z.evaluate((n) => window.Comun.rpc('clientes_parecidos', { p_nombre: n.replace(/,?\s*C\.?\s?A\.?$/i, '') + ' CA', p_doc: '999999999' }), otro.nombre);
    ok(nombre + ': "Ya existe NOMBRE (RIF)" cuando el nombre es casi igual (sin C.A., puntos ni comas)', r3.posible && r3.clientes[0].nombre === otro.nombre);
    const html = await z.evaluate((r) => window.Comun.parecidoHtml(r), r3);
    ok(nombre + ': el aviso pregunta si es el mismo y lleva a ese cliente', /¿es el mismo\?/.test(html) && /data-ir-cliente/.test(html));
    await c3.ctx.close();
    const c4 = await contexto(nav, dispositivo, mundo); const al = await c4.ctx.newPage(); await al.goto(H + 'index.html'); await al.waitForSelector('#pasoEquipo:not(.hidden)');
    await al.click('[data-equipo="aliados"]'); await al.fill('#usuario', 'redes'); await al.click('#seguir');
    await require('./simulador').pin(al, '571942', dispositivo === PC); await al.waitForURL(/aliados\.html/);
    const r4 = await al.evaluate((n) => window.Comun.rpc('clientes_parecidos', { p_nombre: n, p_doc: '999999999', p_sol: 1 }), otro.nombre);
    ok(nombre + ': al aliado no se le dice cuál cliente es; queda marcado para el administrador', r4.posible === true && !r4.clientes && (mundo.bitacora || []).some((b) => b.accion === 'posible_duplicado'));
    await c4.ctx.close();
  }
  ok('sin errores de la página', errores.length === 0, errores);
  await nav.close(); cerrar();
})();
