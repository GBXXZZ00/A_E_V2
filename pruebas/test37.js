// Lote urgente 20/10, parte 2: cambiar una instalación de corte (solo entre el corte en curso y el siguiente, ambos abiertos),
// con motivo y bitácora; la fila dice "Movida a mano"; nunca desde ni hacia un corte cerrado; el líder no puede.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar, plegables } = require('./simulador');
const { ok, cerrar } = marcador();
const { RPC, corte } = require('./mundo');
// Lote 27/10: con un día fijo el corte en curso sigue abierto pasado su fin (es el caso de esta prueba: dos cortes abiertos)
const hoyReal = new Date(Date.now() - 4 * 3600000).toISOString().slice(0, 10); corte.fijarHoy(hoyReal);
const llamo = (m, f) => m.llamadas.filter((l) => l[1] === f);
const cerrarHojas = async (p) => { for(let i = 0; i < 4 && await p.evaluate(() => !!window.Comun.hojaAbierta()); i++){ await p.keyboard.press('Escape'); await p.waitForTimeout(260); } };

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'comisiones.html'); await p.waitForSelector('.grupo');
    const adm = mundo.personas.find((x) => x.rol === 'admin');
    const d0 = RPC.comisiones_corte(mundo, adm, {}); const actual = d0.actual; const sig = d0.siguiente;
    ok(nombre + ': hay un corte en curso y uno siguiente abiertos', !!actual && !!sig && sig > actual);
    // Una instalación del corte en curso, con orden confirmada
    const fila = d0.filas.find((f) => f.origen === 'corte' && f.orden_ok);
    const abrirGrupo = async (pg, lider) => { const g = pg.locator('.grupo').filter({ has: pg.locator('.grupo-cab', { hasText: lider }) }); if(!(await g.evaluate((x) => x.classList.contains('abierto')))) await g.locator('.grupo-cab').click(); };
    await abrirGrupo(p, fila.lider);
    await p.click('[data-com="' + fila.instalacion_id + '"]'); await p.waitForSelector('#hojaComision.ver .req'); await plegables(p, 'ajustes');
    ok(nombre + ': la hoja de comisión ofrece "Cambiar de corte" al administrador', (await p.locator('#corteCambiar').count()) === 1 && /Cuenta en el corte de/.test(await p.textContent('#hojaComision')));
    await p.click('#corteCambiar'); await p.waitForSelector('#hojaCorteMov.ver #corteMovMotivo');
    ok(nombre + ': solo ofrece el otro corte abierto', (await p.locator('[data-corte-mov]').count()) === 1 && (await p.getAttribute('[data-corte-mov]', 'data-corte-mov')) === sig && /Pasa a /.test(await p.textContent('#hojaCorteMov')));
    await p.click('#corteMovGuardar');
    ok(nombre + ': sin motivo da error debajo', /motivo/.test(await p.textContent('#eCorteMov')) && llamo(mundo, 'instalacion_mover_corte').length === 0);
    await p.screenshot({ path: 'capturas/37-' + nombre + '-cambiar-corte.png' });
    await p.fill('#corteMovMotivo', 'Se instaló el 17 pero el acta llegó tarde'); await p.click('#corteMovGuardar');
    await p.waitForFunction(() => /Movida a mano/.test((document.getElementById('hojaComision') || {}).textContent || ''));
    const hoja = await p.textContent('#hojaComision');
    ok(nombre + ': la hoja dice el corte nuevo, de qué corte era y el motivo', hoja.includes('Movida a mano') && hoja.includes('Por su fecha era de') && hoja.includes('el acta llegó tarde'));
    ok(nombre + ': queda en la bitácora', (mundo.bitacora || []).some((b) => b.accion === 'instalacion_corte_movida' && b.instalacion === fila.instalacion_id && b.despues === sig && /acta/.test(b.motivo)));
    await cerrarHojas(p);
    await p.waitForFunction((id) => !document.querySelector('[data-com="' + id + '"]'), fila.instalacion_id);
    ok(nombre + ': ya no está en el corte en curso', (await p.locator('[data-com="' + fila.instalacion_id + '"]').count()) === 0);
    await p.selectOption('#corte', sig); await p.waitForSelector('.grupo'); await abrirGrupo(p, fila.lider); await p.waitForSelector('[data-com="' + fila.instalacion_id + '"]');
    ok(nombre + ': en el corte siguiente sale con la etiqueta "Movida a mano"', (await p.textContent('[data-com="' + fila.instalacion_id + '"]')).includes('Movida a mano'));
    ok(nombre + ': lista sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/37-' + nombre + '-movida.png', fullPage: true });
    // Reglas del servidor: hacia un corte que no es abierto, desde un corte cerrado, y el líder no puede
    const e1 = RPC.instalacion_mover_corte(mundo, adm, { p_instalacion: fila.instalacion_id, p_corte: '2026-01-01', p_motivo: 'motivo largo' });
    const lid = mundo.personas.find((x) => x.rol === 'lider');
    const e2 = RPC.instalacion_mover_corte(mundo, lid, { p_instalacion: fila.instalacion_id, p_corte: actual, p_motivo: 'motivo largo' });
    const otra = d0.filas.find((f) => f.origen === 'corte' && f.instalacion_id !== fila.instalacion_id);
    mundo.certificados = mundo.certificados || {}; mundo.certificados[actual] = { en: new Date().toISOString(), filas: [], total: 0, cumplen: 0, por: 'x' };
    const e3 = RPC.instalacion_mover_corte(mundo, adm, { p_instalacion: otra.instalacion_id, p_corte: sig, p_motivo: 'motivo largo' });
    delete mundo.certificados[actual];
    ok(nombre + ': no se mueve a un corte que no esté abierto, ni desde uno cerrado, y el líder no puede', /Solo se puede pasar/.test(e1.__error.message) && !!e2.__error && /corte cerrado/.test(e3.__error.message));
    // Volver a su corte quita la etiqueta
    const r = RPC.instalacion_mover_corte(mundo, adm, { p_instalacion: fila.instalacion_id, p_corte: actual, p_motivo: 'vuelve a su corte' });
    ok(nombre + ': volver a su corte por fecha quita "Movida a mano"', r && r.movida === false && !RPC.comisiones_corte(mundo, adm, {}).filas.find((f) => f.instalacion_id === fila.instalacion_id).movida);
    await ctx.close();

    // El líder ve la hoja sin el botón
    const s = await contexto(nav, dispositivo); const q = await entrar(s.ctx, 'lucia', '739105'); q.on('pageerror', (e) => errores.push(e.message));
    await q.goto(H + 'comisiones.html'); await q.waitForSelector('.grupo');
    if(!(await q.locator('.grupo.abierto').count())) await q.locator('.grupo-cab').first().click();
    await q.locator('[data-com]:visible').first().click(); await q.waitForSelector('#hojaComision.ver .req');
    ok(nombre + ': el líder no puede cambiar de corte', (await q.locator('#corteCambiar').count()) === 0);
    await s.ctx.close();
  }
  ok('sin errores de la página', errores.length === 0, errores.join(' | '));
  await nav.close(); cerrar();
})();
