// Lote 13/11, parte 7: Mi trabajo empieza todo plegado para administrador, líder y analista; sin "Lo más urgente" suelto;
// cada grupo con su número y sus vencidos; El equipo también plegado; lo que se abre se recuerda al volver.
const { chromium, H, TEL, PC, contexto, marcador, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, disp] of [['pc', PC], ['tel', TEL]]){
    const hoyS = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
    for(const [u, pin, cargo] of [['marcos', '482913', 'administrador'], ['lucia', '739105', 'líder'], ['elena', '315806', 'analista']]){
      const { ctx, mundo: m } = await contexto(nav, disp); const cl = m.datos.clientes;
      m.datos.extra = [0, 1].map((i) => ({ tipo: 'revisar_docs', clave: 'r' + i, cliente_id: cl[i].id, titulo: cl[i].nombre, detalle: 'Subió 3 documentos', para: 'admin', vence: hoyS(i - 1), desde: hoyS(-2) + 'T12:00:00Z', ref: {} }));
      const p = await entrar(ctx, u, pin); p.on('pageerror', (e) => errores.push(nombre + ' ' + cargo + ': ' + e.message));
      await p.goto(H + 'trabajo.html'); await p.waitForTimeout(1500);
      const tx = await p.textContent('#cuerpo');
      const nPl = await p.locator('#cuerpo details.bz-pl').count();
      ok(nombre + ' ' + cargo + ': sin "Lo más urgente" suelto y todo plegado', !/Lo más urgente/.test(tx) && (await p.locator('#cuerpo details.bz-pl[open]').count()) === 0);
      if(nPl){
        ok(nombre + ' ' + cargo + ': la línea de arriba lo dice', /Todo plegado: abre solo lo que vas a trabajar/.test(tx));
        const k = await p.getAttribute('#cuerpo details.bz-pl >> nth=0', 'data-pl') || await p.getAttribute('#cuerpo details.bz-pl >> nth=0', 'data-cn');
        await p.click('#cuerpo details.bz-pl >> nth=0 >> summary');
        await p.reload(); await p.waitForTimeout(1500);
        ok(nombre + ' ' + cargo + ': lo abierto se recuerda al volver', (await p.locator('#cuerpo details.bz-pl >> nth=0').getAttribute('open')) !== null, k);
      }
      if(cargo === 'administrador'){
        ok(nombre + ': cada grupo lleva su número y sus vencidos', (await p.locator('#cuerpo details.bz-pl summary .bz-pl-n').count()) > 0 && (await p.locator('#cuerpo details.bz-pl summary .mt-pill.r').count()) > 0);
        ok(nombre + ': El equipo también es un plegable', (await p.locator('#cuerpo details.bz-pl[data-pl="equipo"]').count()) === 1);
      }
      await ctx.close();
    }
  }
  ok('sin errores de página', errores.length === 0); if(errores.length) console.log(errores.join('\n'));
  await nav.close(); cerrar();
})();
