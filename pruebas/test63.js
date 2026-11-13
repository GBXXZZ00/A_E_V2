// Lote 12/11 B, parte 7: Clientes con una fila "Estatus legal" con los estatus reales de la app (maqueta revision-nueva/img/20). Datos inventados.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['pc', PC], ['tel', TEL]]){
    const { ctx } = await contexto(nav, dispositivo);
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(nombre + ': ' + e.message));
    await p.goto(H + 'clientes.html'); await p.waitForSelector('#estLegal [data-est-legal]', { timeout: 15000 });
    const t = await p.textContent('#estLegal');
    ok(nombre + ': fila Estatus legal con Todos y los 8 estatus de la app', (await p.locator('#estLegal [data-est-legal]').count()) === 9 && ['Grandes negocios', 'Documentos solicitados', 'Documentos pendientes', 'Documentos en revisión', 'Documentos recibidos', 'Contrato en curso', 'Pendiente por firmar', 'Contrato firmado'].every((x) => t.includes(x)));
    ok(nombre + ': no usa los nombres de los grupos de la barra', !/Sin gestionar|Faltan documentos/.test(t));
    await p.click('#estLegal [data-est-legal="documentos_pendientes"]'); await p.waitForTimeout(500);
    ok(nombre + ': un toque filtra y queda en la dirección', p.url().includes('est=documentos_pendientes') && (await p.getAttribute('#estLegal [data-est-legal="documentos_pendientes"]', 'aria-pressed')) === 'true');
    ok(nombre + ': sin desborde de la página', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/lote12novB-p7-clientes-' + nombre + '.png' });
    await p.click('#estLegal [data-est-legal=""]'); await p.waitForTimeout(300);
    ok(nombre + ': Todos quita el filtro', !p.url().includes('est='));
    await ctx.close();
    const c2 = await contexto(nav, dispositivo); const l = await entrar(c2.ctx, 'lucia', '739105');
    await l.goto(H + 'clientes.html'); await l.waitForSelector('#lista', { timeout: 15000 }); await l.waitForTimeout(800);
    ok(nombre + ': el líder no ve la fila', (await l.locator('#estLegal [data-est-legal]').count()) === 0);
    await c2.ctx.close();
  }
  ok('sin errores de JavaScript', errores.length === 0, errores.slice(0, 3));
  await nav.close(); cerrar();
})();
