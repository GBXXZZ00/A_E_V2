// Revisión con IA en la app: módulo Revisión (bandejas, marcar varios, lanzar), el resultado dentro del expediente, excepciones,
// aprobar contra la IA, Cerrar revisión con IA, comparar con Legal, la bandeja de la abogada y los errores.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
const llamo = (m, f) => m.llamadas.filter((l) => l[0] === 'rpc' && l[1] === f);
const abiertas = (p) => p.evaluate(() => window.Comun.hojasAbiertas());
const ABOGADA = { id: '77777777-7777-4777-8777-777777777777', usuario: 'sara', pin: '640217', nombre: 'Sara Ibáñez', rol: 'abogado', cargo: 'Abogada', equipo: 'ambos', codigo_vendedor: null, nombre_odoo: null, activo: true, debe_cambiar_pin: false };
(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const tel = nombre === 'tel';
    const { ctx, mundo: m } = await contexto(nav, dispositivo);
    m.personas.push(Object.assign({}, ABOGADA));
    const cli = (id) => m.datos.clientes.find((c) => c.id === id);

    // ----- Administrador: Revisión vive en Mi trabajo (revisión en lote, lote 28/10) -----
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    await p.waitForSelector('[data-modulo="revision"]');
    ok(nombre + ': Inicio muestra el módulo Revisión y lleva a la revisión en lote', /trabajo\.html\?v=lote/.test(await p.getAttribute('[data-modulo="revision"]', 'href')));
    ok(nombre + ': la navegación ya no tiene Revisión', (await p.locator(tel ? '#navAbajo a[href="revision.html"]' : '.navpc a[href="revision.html"]').count()) === 0);
    await p.goto(H + 'revision.html'); await p.waitForURL(/trabajo\.html\?v=lote/); await p.waitForSelector('#rlLista .rl-grp, #rlLista .vacio');
    ok(nombre + ': la revisión en lote trae el cliente en revisión', (await p.textContent('#rlLista')).includes('Vidrios El Faro'));
    await p.screenshot({ path: 'capturas/17-' + nombre + '-bandeja.png' });
    ok(nombre + ': no desborda', await sinDesborde(p));

    // ----- Elegir y leer con IA -----
    // Lote 12/11 B: solo se marcan los clientes que cuadran; los demás se pasan a la IA o se abren con Revisar
    ok(nombre + ': el cliente sin leer no se puede aprobar en lote', (await p.locator('[data-rl-cli="1001"]').count()) === 0 && (await p.locator('[data-rl-uno="1001"]').count()) === 1);
    await p.click('[data-rl-leer="1001"]'); await p.waitForSelector('#hojaRlIA.ver [data-rl="ia-ok"]');
    ok(nombre + ': antes de gastar dice cuánto va a leer', /archivos? nuevos? por leer/.test(await p.textContent('#hojaRlIA')) && /US\$/.test(await p.textContent('#hojaRlIA')));
    await p.click('[data-rl="ia-ok"]'); await p.waitForFunction(() => !document.querySelector('#hojaRlIA.ver'));
    ok(nombre + ': lanza la lectura del cliente elegido', llamo(m, 'ia_lanzar').length === 1 && llamo(m, 'ia_lanzar')[0][2].p_clientes.join() === '1001');
    const otro = '1001';

    // ----- La banda de la ficha muestra el avance; la pantalla de revisión, el resultado -----
    await p.goto(H + 'clientes.html?c=1001&t=documentos'); await p.waitForFunction(() => /Está leyendo/.test((document.getElementById('paso') || {}).textContent || ''));
    ok(nombre + ': la banda dice que la IA está leyendo con su barra', (await p.locator('#paso .paso-bar').count()) === 1 && (await p.locator('#paso [data-paso="ia"]').count()) === 0);
    m.iaPaso = 20;
    await p.waitForFunction(() => /La IA ya los leyó/.test(document.getElementById('paso').textContent), null, { timeout: 15000 });
    ok(nombre + ': al terminar la banda dice cuántos cuadran', /cuadra/.test(await p.textContent('#paso')));
    await p.click('#paso [data-paso="revisar"]'); await p.waitForSelector('#hojaVer.ver .rv-ia.mal');
    ok(nombre + ': la franja dice lo que encontró la IA', /La IA encontró/.test(await p.textContent('#hojaVer .rv-ia')));
    ok(nombre + ': lo que propone ya está marcado en la lista', (await p.locator('#hojaVer .rv-e.d').count()) >= 1 && (await p.locator('#hojaVer .rv-e.b').count()) >= 1);
    await p.screenshot({ path: 'capturas/17-' + nombre + '-resultado.png' });
    ok(nombre + ': no desborda con el resultado', await sinDesborde(p));

    // Excepción sobre la junta (en la franja o en "Ver todo lo que vio la IA")
    await p.evaluate(() => document.querySelectorAll('#hojaVer details.rv-ia-det').forEach((d) => { d.open = true; }));
    await p.locator('#hojaVer [data-exc-ia="junta"]').first().click(); await p.waitForSelector('#hojaExcIA.ver #darExcIA');
    ok(nombre + ': la excepción sale encima de la revisión', (await abiertas(p)).slice(-1)[0] === 'hojaExcIA');
    await p.click('#darExcIA');
    ok(nombre + ': la excepción exige motivo', (await p.textContent('#eExcIA')).length > 0 && llamo(m, 'ia_excepcion').length === 0);
    await p.fill('#motExcIA', 'El acta de ratificación ya está en el Registro'); await p.click('#darExcIA');
    await p.waitForFunction(() => !document.querySelector('#hojaExcIA.ver'));
    await p.evaluate(() => document.querySelectorAll('#hojaVer details.rv-ia-det').forEach((d) => { d.open = true; }));
    await p.waitForSelector('#hojaVer [data-quitar-exc="junta"]');
    ok(nombre + ': la excepción queda y se puede quitar', llamo(m, 'ia_excepcion')[0][2].p_motivo.includes('Registro'));

    // Aprobar lo que la IA devolvió pide motivo
    const dev = cli(1001).ia.marcas.find((x) => x.propuesta === 'problema').documento;
    await p.click('#hojaVer [data-rv-ir="d:' + dev + '"]'); await p.waitForSelector('#hojaVer.ver #excDoc');
    const antes = llamo(m, 'documento_marcar').length;
    await p.click('#verAprobar'); await p.waitForTimeout(300);
    ok(nombre + ': sin motivo no aprueba', llamo(m, 'documento_marcar').length === antes);
    await p.fill('#excDoc', 'Trajo la cédula nueva por correo'); await p.click('#verAprobar');
    await p.waitForFunction((d) => !document.querySelector('#hojaVer .rv-d.sel[data-rv-ir="d:' + d + '"]'), dev);
    ok(nombre + ': aprueba con el motivo como excepción', llamo(m, 'documento_marcar').slice(-1)[0][2].p_nota === 'Trajo la cédula nueva por correo' && cli(1001).marcas[dev].origen === 'manual');

    // Terminar la revisión con la IA: decide lo que falte y cierra
    for(let i = 0; i < 12 && await p.locator('#rvTerminar[disabled], #rvAprobar[disabled]').count(); i++){
      const k = await p.getAttribute('#hojaVer .rv-d.sel', 'data-rv-ir'); await p.click('#verAprobar');
      await p.waitForFunction((x) => { const s = document.querySelector('#hojaVer .rv-d.sel'); return !s || s.dataset.rvIr !== x || !document.querySelector('#rvTerminar[disabled], #rvAprobar[disabled]'); }, k);
    }
    if(await p.locator('#rvTerminar').count()){
      await p.click('#rvTerminar'); await p.waitForSelector('#hojaCerrarRev.ver');
      ok(nombre + ': la hoja de cierre muestra lo que dijo la IA', /La IA/.test(await p.textContent('#hojaCerrarRev')));
      await p.screenshot({ path: 'capturas/17-' + nombre + '-cerrar.png' });
      await p.click('#cerrarRevSolo'); await p.waitForFunction(() => !document.querySelector('#hojaCerrarRev.ver') && !document.querySelector('#hojaVer.ver'));
    } else {
      await p.click('#rvAprobar'); await p.waitForSelector('#hojaRvOk.ver'); await p.keyboard.press('Escape');
    }
    await p.waitForSelector('[data-grupo="revisiones"]');
    ok(nombre + ': queda en el historial como revisión con IA', /con IA/.test(await p.textContent('[data-grupo="revisiones"]')) && cli(1001).ia.estado === 'cerrada');
    await p.keyboard.press('Escape'); await p.waitForFunction(() => !window.Comun.hojaAbierta());

    // ----- Comparar con Legal (sigue en revision.html?b=comparar) -----
    await p.goto(H + 'revision.html?b=comparar'); await p.waitForSelector('.cifras-rv');
    ok(nombre + ': comparar muestra cuántos documentos coinciden', /documentos donde la IA coincide con Legal/.test(await p.textContent('#lista')) && (await p.locator('#lista .rv').count()) >= 1);
    await p.screenshot({ path: 'capturas/17-' + nombre + '-comparar.png' });
    ok(nombre + ': comparar no desborda', await sinDesborde(p));

    // ----- Errores: la IA no termina; la revisión en lote no carga -----
    m.iaFalla = 'Google no aceptó la clave de Gemini'; m.iaPaso = 1;
    const c2 = Number(otro); Object.assign(cli(c2).ia, { estado: 'leyendo', avance: 0 });
    await p.goto(H + 'clientes.html?c=' + c2 + '&t=documentos'); await p.waitForSelector('#paso [data-paso="reanudar"]', { timeout: 15000 });
    ok(nombre + ': si la IA falla la banda lo dice y ofrece Reintentar', /no pudo terminar/.test(await p.textContent('#paso')) && /clave de Gemini/.test(await p.textContent('#paso')));
    m.iaFalla = null; await p.click('#paso [data-paso="reanudar"]'); await p.waitForFunction(() => /Está leyendo/.test(document.getElementById('paso').textContent));
    ok(nombre + ': Reintentar la vuelve a poner a leer', llamo(m, 'ia_reanudar').length === 1);
    await p.keyboard.press('Escape');
    m.fallaRpc = 'revision_lote_lista';
    await p.goto(H + 'trabajo.html?v=lote'); await p.waitForSelector('#rlLista [data-rl="reintentar"]');
    ok(nombre + ': si la revisión en lote no carga ofrece Reintentar', true);
    m.fallaRpc = null; await p.click('#rlLista [data-rl="reintentar"]'); await p.waitForSelector('#rlLista .rl-grp, #rlLista .vacio');
    ok(nombre + ': Reintentar la carga', true);

    // ----- La abogada: su bandeja, sin IA ni casillas -----
    cli(1001).documentos.filter((d) => d.casilla === 'cedula').forEach((d) => { d.estado = 'por_revisar'; });   // vuelve a tener algo por revisar
    const ab = await contexto(nav, dispositivo, m); const s = await entrar(ab.ctx, 'sara', '640217'); s.on('pageerror', (e) => errores.push(e.message));
    await s.goto(H + 'revision.html'); await s.waitForURL(/v=lote/); await s.waitForSelector('#rlLista .rl-grp, #rlLista .vacio');
    ok(nombre + ': la abogada ve la revisión en lote solo para consultar', (await s.locator('[data-rl-cli], [data-rl-doc]').count()) === 0 && (await s.locator('#rlBar:not(.hidden)').count()) === 0);
    await s.click('[data-rl-uno="1001"]'); await s.waitForSelector('#hojaFicha.ver #tab-documentos .doc-sec');
    ok(nombre + ': la abogada no ve Mandar a revisión con IA', (await s.locator('#mandarIA, #paso [data-paso="ia"]').count()) === 0);
    await s.screenshot({ path: 'capturas/17-' + nombre + '-abogada.png' });
    await ab.ctx.close();

    // ----- El líder no entra -----
    const li = await contexto(nav, dispositivo, m); const l = await entrar(li.ctx, 'lucia', '739105');
    ok(nombre + ': el líder no ve Revisión en la navegación', (await l.locator('a[href="revision.html"]').count()) === 0);
    await l.goto(H + 'revision.html'); await l.waitForURL(/trabajo\.html/); await l.waitForSelector('#tarjetas .bz-mi');
    ok(nombre + ': si el líder entra a la dirección, queda en su Mi trabajo, sin la revisión en lote', await l.isHidden('#vistaLote'));
    await li.ctx.close();
    await ctx.close();
  }
  await nav.close();
  ok('sin errores en la página', errores.length === 0, errores);
  cerrar();
})();
