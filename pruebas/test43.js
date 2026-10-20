// Lote 21/10, tanda A: hoja de comisión con datos clave y plegables; No comisiona con su bandeja (solo el administrador la reactiva);
// nota del pago; días para el pago (administrador) y la regla de N días del TAD; Revisar pago por factura del mes y por residenciales;
// corregir un corte certificado sin tocar la foto y la bandeja "Fuera de la foto".
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar, plegables } = require('./simulador');
const { ok, cerrar } = marcador();
const { RPC } = require('./mundo');
const llamo = (m, f) => m.llamadas.filter((l) => l[1] === f);
const cerrarHojas = async (p) => { for(let i = 0; i < 5 && await p.evaluate(() => !!window.Comun.hojaAbierta()); i++){ await p.keyboard.press('Escape'); await p.waitForTimeout(260); } };

function cargaTad(m, yo, cl, conDeuda){
  const id = RPC.tad_iniciar(m, yo, { p_archivo: 'tad.csv', p_total: cl.servicios.length });
  RPC.tad_filas(m, yo, { p_carga: id, p_filas: cl.servicios.map((sv) => ({ s: sv.sucursal, c: sv.codigo, t: cl.doc_tipo, d: cl.doc_numero, n: cl.nombre, p: sv.plan, ca: sv.categoria, es: sv.estado, e: sv.equipo, cx: conDeuda ? 'SI' : 'NO' })) });
  return RPC.tad_cerrar(m, yo, { p_carga: id });
}

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    const adm = mundo.personas.find((x) => x.rol === 'admin'); const sen = mundo.personas.find((x) => x.senior);
    await p.goto(H + 'comisiones.html'); await p.waitForSelector('.grupo');
    const d0 = RPC.comisiones_corte(mundo, adm, {});
    const abrirGrupo = async (pg, lider) => { const g = pg.locator('.grupo').filter({ has: pg.locator('.grupo-cab', { hasText: lider }) }); if(!(await g.evaluate((x) => x.classList.contains('abierto')))) await g.locator('.grupo-cab').click(); };
    const fila = d0.filas.find((f) => !f.pago_ok && f.orden_ok);
    await abrirGrupo(p, fila.lider); await p.click('[data-com="' + fila.instalacion_id + '"]'); await p.waitForSelector('#hojaComision.ver .datos-com');

    // 1. Plegables cerrados que se abren y cierran con su estado en la cabecera
    ok(nombre + ': los plegables empiezan cerrados', await p.evaluate(() => [...document.querySelectorAll('#hojaComision [data-plg-btn]')].every((b) => b.getAttribute('aria-expanded') === 'false' && document.getElementById(b.getAttribute('aria-controls')).hidden)));
    ok(nombre + ': la cabecera de Pago dice que debe', /Debe|Revisar pago/.test(await p.textContent('[data-plg-btn="pago"]')));
    await plegables(p, 'pago');
    ok(nombre + ': al tocarlo se abre', (await p.getAttribute('[data-plg-btn="pago"]', 'aria-expanded')) === 'true' && await p.isVisible('#pagoNota'));
    // Nota del pago
    await p.fill('#pagoNota', 'Pagó en efectivo en la oficina'); await p.click('#pagoNotaGuardar');
    await p.waitForFunction(() => Array.from(document.querySelectorAll('.toast')).some((t) => /[Nn]ota/.test(t.textContent)));
    ok(nombre + ': la nota del pago se guarda en el servidor', llamo(mundo, 'instalacion_pago_nota').slice(-1)[0][2].p_nota === 'Pagó en efectivo en la oficina');
    ok(nombre + ': el plegable abierto sigue abierto después de guardar', (await p.getAttribute('[data-plg-btn="pago"]', 'aria-expanded')) === 'true');
    await p.click('[data-plg-btn="pago"]');
    ok(nombre + ': al tocarlo otra vez se cierra', await p.evaluate(() => document.getElementById('plg-pago').hidden));
    ok(nombre + ': hoja sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/43-' + nombre + '-hoja.png', fullPage: true });

    // 2. No comisiona: con motivo, sale de la lista y entra en su bandeja
    await plegables(p, 'ajustes'); await p.click('#ncAbrir'); await p.waitForSelector('#hojaMotivoCom.ver #motivoCom');
    await p.click('#motivoComGuardar');
    ok(nombre + ': No comisiona sin motivo da error debajo', (await p.textContent('#eMotivoCom')).length > 0 && llamo(mundo, 'instalacion_no_comisiona').length === 0);
    await p.fill('#motivoCom', 'Era una mudanza del mismo cliente'); await p.click('#motivoComGuardar');
    await p.waitForFunction(() => !document.querySelector('#hojaMotivoCom.ver'));
    await p.waitForFunction(() => /No comisiona/.test(document.querySelector('[data-plg-btn="ajustes"]').textContent));
    ok(nombre + ': queda marcada con motivo y en la bitácora', llamo(mundo, 'instalacion_no_comisiona').slice(-1)[0][2].p_si === true && mundo.bitacora.some((b) => b.accion === 'instalacion_no_comisiona' && b.instalacion === fila.instalacion_id));
    await cerrarHojas(p);
    await p.waitForSelector('.bandeja-extra[data-lider="__nc"]');
    ok(nombre + ': sale de su grupo y entra en la bandeja No comisionan', (await p.locator('.grupo:not(.bandeja-extra) [data-com="' + fila.instalacion_id + '"]').count()) === 0 && (await p.textContent('.bandeja-extra[data-lider="__nc"]')).includes('No comisionan'));
    await p.click('.bandeja-extra[data-lider="__nc"] .grupo-cab'); await p.waitForSelector('.bandeja-extra.abierto [data-com="' + fila.instalacion_id + '"]');
    ok(nombre + ': la bandeja muestra el motivo', (await p.textContent('.bandeja-extra[data-lider="__nc"]')).includes('mudanza'));
    await p.screenshot({ path: 'capturas/43-' + nombre + '-bandeja.png', fullPage: true });
    // El Analista Senior no la puede volver a activar
    ok(nombre + ': el Analista Senior no la reactiva (servidor)', !!(RPC.instalacion_no_comisiona(mundo, sen, { p_instalacion: fila.instalacion_id, p_si: false }) || {}).__error);
    // El administrador sí
    await p.click('.bandeja-extra [data-com="' + fila.instalacion_id + '"]'); await plegables(p, 'ajustes'); await p.waitForSelector('#ncReactivar');
    ok(nombre + ': la hoja dice el motivo y que no comisiona', (await p.textContent('#hojaComision')).includes('Era una mudanza'));
    await p.click('#ncReactivar');
    await p.waitForFunction(() => !document.querySelector('#ncReactivar'));
    ok(nombre + ': el administrador la vuelve a activar', llamo(mundo, 'instalacion_no_comisiona').slice(-1)[0][2].p_si === false && mundo.bitacora.some((b) => b.accion === 'instalacion_reactivada'));
    await cerrarHojas(p);
    await p.waitForFunction(() => !document.querySelector('.bandeja-extra[data-lider="__nc"]'));
    ok(nombre + ': sin anuladas no sale la bandeja', true);

    // 3. Días para el pago (solo administrador)
    await p.click('#pagoDiasAbrir'); await p.waitForSelector('#hojaPagoDias.ver #pagoDias');
    await p.waitForFunction(() => document.getElementById('pagoDias').value === '3');
    ok(nombre + ': Días para el pago trae 3 por defecto', true);
    await p.fill('#pagoDias', '45'); await p.click('#pagoDiasGuardar');
    ok(nombre + ': fuera de 0 a 30 no guarda', (await p.textContent('#ePagoDias')).length > 0 && mundo.pagoDias == null);
    await p.fill('#pagoDias', '5'); await p.click('#pagoDiasGuardar'); await p.waitForFunction(() => !document.querySelector('#hojaPagoDias.ver'));
    ok(nombre + ': guarda los días en el servidor', mundo.pagoDias === 5);
    mundo.pagoDias = 3;

    // 4. Regla de N días: un TAD sin deuda el mismo día de instalar no da el pago; pasados los días, sí
    const cl = mundo.datos.clientes.find((c) => c.servicios.length === 1 && !c.residenciales && c.instalaciones.some((i) => !i.pago_ok_en && !i.anulada_en));
    const ins = cl.instalaciones.find((i) => !i.pago_ok_en && !i.anulada_en); const inst0 = ins.instalada_en;
    ins.instalada_en = new Date().toISOString();
    const r1 = cargaTad(mundo, adm, cl, false);
    ok(nombre + ': TAD sin deuda el día de la instalación no da el pago', !ins.pago_ok_en && r1.pagos_marcados === 0);
    ins.instalada_en = new Date(Date.now() - 4 * 864e5).toISOString();
    cargaTad(mundo, adm, cl, false);
    ok(nombre + ': cuatro días después (con 3) sí lo da', !!ins.pago_ok_en);
    // Pago fijo: un TAD con deuda después no lo quita
    cargaTad(mundo, adm, cl, true);
    ok(nombre + ': pago fijo: el TAD con deuda no lo quita', !!ins.pago_ok_en);
    ins.instalada_en = inst0;

    // 5. Revisar pago: factura nueva del mes y residenciales
    const c2 = mundo.datos.clientes.find((c) => c.servicios.length === 1 && c.instalaciones.some((i) => !i.pago_ok_en && !i.anulada_en) && c.id !== cl.id);
    const i2 = c2.instalaciones.find((i) => !i.pago_ok_en && !i.anulada_en); const sv = c2.servicios[0];
    const g0 = { inst: i2.instalada_en, deuda: sv.con_deuda, tad: sv.tad_en, res: c2.residenciales };
    Object.assign(i2, { instalada_en: '2026-09-25T15:00:00Z' }); Object.assign(sv, { con_deuda: true, tad_en: '2026-10-05T15:00:00Z' }); c2.residenciales = 0;
    const mot = () => (RPC.cliente_ficha(mundo, adm, { p_cliente: c2.id }).comision.find((x) => x.id === i2.id) || {}).revisar_motivo;
    ok(nombre + ': instalada el 25 con la factura del mes siguiente: Revisar pago por factura nueva del mes', mot() === 'factura_mes');
    Object.assign(sv, { con_deuda: false }); c2.residenciales = 1;
    ok(nombre + ': con un servicio residencial: Revisar pago por varios servicios', mot() === 'varios_servicios');
    Object.assign(i2, { instalada_en: g0.inst }); Object.assign(sv, { con_deuda: g0.deuda, tad_en: g0.tad }); c2.residenciales = g0.res;
    await ctx.close();

    // 6. Corte certificado: la foto no cambia; "Fuera de la foto" y corregir
    const b = await contexto(nav, dispositivo); const q = await entrar(b.ctx, 'marcos', '482913'); q.on('pageerror', (e) => errores.push(e.message));
    const adm2 = b.mundo.personas.find((x) => x.rol === 'admin');
    const e0 = RPC.comisiones_corte(b.mundo, adm2, {}); const corte = e0.corte || e0.actual;
    const dentro = e0.filas.filter((f) => f.origen === 'corte')[0]; const fuera = e0.filas.filter((f) => f.origen === 'corte')[1];
    b.mundo.certificados = { [corte]: { en: new Date().toISOString(), por: 'Marcos', total: 1, cumplen: 1, filas: [dentro] } };
    const foto = JSON.stringify(b.mundo.certificados[corte].filas);
    await q.goto(H + 'comisiones.html?corte=' + corte); await q.waitForSelector('.grupo');
    if(!(await q.locator('.bandeja-extra[data-lider="__ff"]').count())){ await q.selectOption('#corte', corte); }
    await q.waitForSelector('.bandeja-extra[data-lider="__ff"]');
    ok(nombre + ': el administrador ve la bandeja "Fuera de la foto"', (await q.textContent('.bandeja-extra[data-lider="__ff"]')).includes('Fuera de la foto'));
    await q.click('.bandeja-extra[data-lider="__ff"] .grupo-cab'); await q.click('.bandeja-extra [data-com="' + fuera.instalacion_id + '"]');
    await plegables(q, 'ajustes'); await q.waitForSelector('[data-corregir="se_pago"]');
    ok(nombre + ': la hoja dice que no quedó en la foto', (await q.textContent('#hojaComision')).includes('no quedó en su foto'));
    await q.click('[data-corregir="se_pago"]'); await q.waitForSelector('#hojaMotivoCom.ver #motivoCom');
    await q.fill('#motivoCom', 'Se pagó en la nómina de ese mes'); await q.click('#motivoComGuardar'); await q.waitForFunction(() => !document.querySelector('#hojaMotivoCom.ver'));
    const fi = b.mundo.datos.clientes.find((c) => c.id === fuera.cliente_id).instalaciones.find((i) => i.id === fuera.instalacion_id);
    ok(nombre + ': "Se pagó allá" la deja en ese corte con excepción y en la bitácora', fi.correccion === 'se_pago' && fi.excepcion_corte === corte && b.mundo.bitacora.some((x) => x.accion === 'corte_certificado_correccion'));
    await cerrarHojas(q);
    // La de la foto: "No se pagó" la pasa al corte abierto
    await q.goto(H + 'comisiones.html?corte=' + corte); await q.waitForSelector('.grupo');
    if(!(await q.locator('[data-com="' + dentro.instalacion_id + '"]').count())) await q.selectOption('#corte', corte).catch(() => {});
    const r = RPC.instalacion_corregir_certificado(b.mundo, adm2, { p_instalacion: dentro.instalacion_id, p_accion: 'no_se_pago', p_motivo: 'No llegó a pagarse' });
    const di = b.mundo.datos.clientes.find((c) => c.id === dentro.cliente_id).instalaciones.find((i) => i.id === dentro.instalacion_id);
    ok(nombre + ': "No se pagó" la pasa al corte abierto', r && r.corte && di.corte_manual === r.corte && di.correccion === 'no_se_pago');
    ok(nombre + ': la foto del corte certificado no cambia', JSON.stringify(b.mundo.certificados[corte].filas) === foto);
    const lid = b.mundo.personas.find((x) => x.rol === 'lider');
    ok(nombre + ': el líder y el Senior no corrigen, ni marcan No comisiona en la foto', !!(RPC.instalacion_corregir_certificado(b.mundo, lid, { p_instalacion: fuera.instalacion_id, p_accion: 'no_se_pago', p_motivo: 'motivo largo' }) || {}).__error &&
      !!(RPC.instalacion_no_comisiona(b.mundo, b.mundo.personas.find((x) => x.senior), { p_instalacion: di.id, p_si: true, p_motivo: 'motivo largo' }) || {}).__error);
    await b.ctx.close();

    // 7. El líder no ve Días para el pago ni No comisiona
    const s = await contexto(nav, dispositivo); const w = await entrar(s.ctx, 'lucia', '739105'); w.on('pageerror', (e) => errores.push(e.message));
    await w.goto(H + 'comisiones.html'); await w.waitForSelector('.grupo');
    if(!(await w.locator('.grupo.abierto').count())) await w.locator('.grupo-cab').first().click();
    await w.locator('[data-com]:visible').first().click(); await w.waitForSelector('#hojaComision.ver .datos-com');
    ok(nombre + ': el líder no ve Días para el pago, No comisiona ni Corregir', (await w.locator('#pagoDiasAbrir, #ncAbrir, [data-corregir]').count()) === 0);
    await s.ctx.close();
  }
  ok('sin errores de la página', errores.length === 0, errores.join(' | '));
  await nav.close(); cerrar();
})();
