// Lote urgente 20/10, parte 5: un representante agregado y vacío no cuenta como faltante y se quita con "Quitar representante";
// si tiene algún dato o archivo, su cédula y su RIF pasan a faltar (sin Legal aprobado).
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
const { RPC } = require('./mundo');

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    const adm = mundo.personas.find((x) => x.rol === 'admin');
    const c = mundo.datos.clientes.find((x) => !x.es_natural && !x.legal_ok_en && x.regimen_firma !== 'conjunta' && x.representantes.every((r) => r.orden === 1));
    const fal = () => RPC.cliente_ficha(mundo, adm, { p_cliente: c.id }).faltantes;
    const antes = fal().length;
    await p.goto(H + 'clientes.html?c=' + c.id + '&t=documentos'); await p.waitForSelector('#hojaFicha.ver #agregarRep');
    await p.click('#agregarRep'); await p.waitForSelector('[data-grupo="rep2"]');
    const g2 = await p.textContent('[data-grupo="rep2"]');
    ok(nombre + ': el representante agregado sale como opcional, sin nada en Falta', g2.includes('Opcional') && (await p.locator('[data-grupo="rep2"] .chip.rojo').count()) === 0);
    ok(nombre + ': agregarlo vacío no cambia los faltantes', fal().length === antes && (await p.textContent('#tab-documentos .res .r b')) === String(antes));
    ok(nombre + ': trae el botón Quitar representante', (await p.locator('[data-quitar-rep="2"]').count()) === 1);
    await p.screenshot({ path: 'capturas/40-' + nombre + '-rep-vacio.png' });
    await p.click('[data-quitar-rep="2"]'); await p.waitForFunction(() => !document.querySelector('[data-grupo="rep2"]'));
    ok(nombre + ': Quitar representante lo saca', (await p.locator('[data-grupo="rep2"]').count()) === 0 && (await p.locator('#agregarRep').count()) === 1);
    // Con un dato, se piden su cédula y su RIF
    await p.click('#agregarRep'); await p.waitForSelector('[data-grupo="rep2"] [data-campo="rep:2"]');
    await p.click('[data-grupo="rep2"] [data-campo="rep:2"]'); await p.waitForSelector('#hojaCampo.ver #cTel');
    await p.fill('#cTel', '0414-555 22 33'); await p.click('#guardarCampo');
    await p.waitForFunction(() => !document.querySelector('#hojaCampo.ver') && document.querySelectorAll('[data-grupo="rep2"] .chip.rojo').length === 2);
    const f2 = fal();
    ok(nombre + ': con un dato, su cédula y su RIF cuentan como faltantes', f2.length === antes + 2 && f2.some((x) => x.k === 'cedula' && x.n === 2) && f2.some((x) => x.k === 'rif_personal' && x.n === 2));
    ok(nombre + ': con datos ya no se puede quitar como vacío', (await p.locator('[data-quitar-rep="2"]').count()) === 0 && !(await p.textContent('[data-grupo="rep2"]')).includes('Opcional'));
    ok(nombre + ': documentos sin desborde', await sinDesborde(p));
    // Un expediente con Legal aprobado no se reabre por un representante agregado
    const ap = mundo.datos.clientes.find((x) => !x.es_natural && x.legal_ok_en && x.regimen_firma !== 'conjunta');
    if(ap){ const n0 = RPC.cliente_ficha(mundo, adm, { p_cliente: ap.id }).faltantes.length; ap.representantes.push({ orden: 2, nombre: 'PERSONA INVENTADA', correo: null, telefono: null });
      ok(nombre + ': con Legal aprobado, un representante agregado no suma faltantes', RPC.cliente_ficha(mundo, adm, { p_cliente: ap.id }).faltantes.length === n0); }
    await ctx.close();
  }
  ok('sin errores de la página', errores.length === 0, errores.join(' | '));
  await nav.close(); cerrar();
})();
