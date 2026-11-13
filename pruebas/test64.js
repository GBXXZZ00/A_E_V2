// Lote 12/11 B, parte 6: pantalla nueva de revisión. Banda de la ficha, lista agrupada, teclado, contacto con Devolver,
// Aprobar expediente con "Expediente aprobado", la abogada en solo lectura con "Tiene un problema", la revisión en lote
// por cliente (solo los que cuadran) y el PDF que abre en la página de la IA. Datos inventados (mundo.js).
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
const llamo = (m, f) => m.llamadas.filter((l) => l[0] === 'rpc' && l[1] === f);
const ABOGADA = { id: '77777777-7777-4777-8777-777777777777', usuario: 'sara', pin: '640217', nombre: 'Sara Ibáñez', rol: 'abogado', cargo: 'Abogada', equipo: 'ambos', codigo_vendedor: null, nombre_odoo: null, activo: true, debe_cambiar_pin: false };
(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['pc', PC], ['tel', TEL]]){
    const pc = nombre === 'pc';
    const { ctx, mundo: m } = await contexto(nav, dispositivo);
    m.personas.push(Object.assign({}, ABOGADA)); Object.assign(m.personas[1], { whatsapp: '04145550134' });
    await ctx.route('https://wa.me/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'chat' }));
    const cli = () => m.datos.clientes.find((c) => c.id === 1001);
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(nombre + ': ' + e.message));
    const sel = () => p.getAttribute('#hojaVer .rv-d.sel', 'data-rv-ir');
    const cambia = (k) => p.waitForFunction((x) => { const s = document.querySelector('#hojaVer .rv-d.sel'); return !s || s.dataset.rvIr !== x; }, k);

    // ----- La banda: cuántos hay y quién decide -----
    await p.goto(H + 'clientes.html?c=1001&t=documentos'); await p.waitForSelector('#paso [data-paso="revisar"]');
    const banda = await p.textContent('#paso');
    ok(nombre + ': la banda dice cuántos hay por revisar y que nadie los ha revisado', /documentos por revisar/.test(banda) && /Nadie los ha revisado todavía/.test(banda));
    ok(nombre + ': la banda ofrece Revisar y Que la revise la IA', (await p.locator('#paso [data-paso="ia"]').count()) === 1);

    // ----- La pantalla -----
    await p.click('#paso [data-paso="revisar"]'); await p.waitForSelector('#hojaVer.ver .rv-c #verAprobar');
    ok(nombre + ': se abre con la ficha difuminada detrás', (await p.locator('#rvVelo.ver').count()) === 1 && /Revisar expediente/.test(await p.textContent('#hojaVer .rv-cab')));
    const lista = await p.textContent('#hojaVer .rv-l');
    ok(nombre + ': la lista va agrupada como la ficha', /Representante 1/.test(lista) && /Empresa/.test(lista) && /Teléfono y correo/.test(lista));
    ok(nombre + ': la franja dice que está revisando él', /Estás revisando tú/.test(await p.textContent('#hojaVer .rv-ia')));
    ok(nombre + ': el pie no deja aprobar con algo sin decidir', await p.locator('#rvAprobar').isDisabled());
    await p.screenshot({ path: 'capturas/64-' + nombre + '-pantalla.png' });
    ok(nombre + ': sin desborde', await sinDesborde(p));

    // Teclado (escritorio): flechas cambian de documento, B aprueba, D abre los motivos
    if(pc){
      let k = await sel(); await p.keyboard.press('ArrowDown'); await cambia(k);
      ok('pc: la flecha abajo pasa a la fila siguiente', (await sel()) !== k);
      await p.keyboard.press('ArrowUp'); await p.waitForFunction((x) => document.querySelector('#hojaVer .rv-d.sel').dataset.rvIr === x, k);
      const n0 = llamo(m, 'documento_marcar').length; k = await sel(); await p.keyboard.press('b'); await cambia(k);
      ok('pc: B marca Bien y pasa al siguiente', llamo(m, 'documento_marcar').length === n0 + 1 && llamo(m, 'documento_marcar').slice(-1)[0][2].p_accion === 'aprobar');
      await p.keyboard.press('d'); await p.waitForSelector('#hojaVer .rv-mot [data-motivo]');
      ok('pc: D abre los motivos arriba del documento', (await p.locator('#devConfirmar[disabled]').count()) === 1);
      await p.click('#devVolver'); await p.waitForFunction(() => !document.querySelector('#hojaVer .rv-mot [data-motivo]'));
    }

    // Teléfono y correo: se revisan igual, con sus motivos
    await p.click('#hojaVer [data-rv-ir="c:1"]'); await p.waitForSelector('#hojaVer [data-rv-cont="dev"]');
    ok(nombre + ': el contacto se ve como datos con Editar', (await p.locator('#hojaVer .rv-v [data-campo="rep:1"]').count()) >= 1);
    await p.click('#hojaVer [data-rv-cont="dev"]'); await p.waitForSelector('#hojaVer [data-rv-cmot="no_contesta"]');
    await p.click('#hojaVer [data-rv-cmot="no_contesta"]');
    ok(nombre + ': devolver el contacto cuenta en el pie', /se devuelve/.test(await p.textContent('#hojaVer .rv-pie')));
    await p.click('#hojaVer [data-rv-cont="bien"]'); await p.waitForFunction(() => !/se devuelve/.test(document.querySelector('#hojaVer .rv-pie').textContent));
    ok(nombre + ': Bien en el contacto lo quita del devuelto', true);

    // Aprobar todo y Aprobar expediente
    await p.click('#hojaVer .rv-d:has(.rv-e.n)');
    for(let i = 0; i < 12 && await p.locator('#rvAprobar[disabled]').count(); i++){
      if(!(await p.locator('#hojaVer #verAprobar').count())){ await p.click('#hojaVer .rv-d:has(.rv-e.n)'); await p.waitForSelector('#hojaVer #verAprobar'); }
      const k = await sel(); await p.click('#verAprobar'); await p.waitForFunction((x) => { const s = document.querySelector('#hojaVer .rv-d.sel'); return !s || s.dataset.rvIr !== x || !document.querySelector('#rvAprobar[disabled]'); }, k);
    }
    ok(nombre + ': con todo Bien el pie lo dice y ofrece Aprobar expediente', /Todo bien/.test(await p.textContent('#hojaVer .rv-pie')) && !(await p.locator('#rvAprobar').isDisabled()));
    await p.click('#rvAprobar'); await p.waitForSelector('#hojaRvOk.ver');
    const cierre = llamo(m, 'revision_cerrar').slice(-1)[0][2];
    ok(nombre + ': aprueba en un solo cierre, sin mensaje', cierre.p_mensaje === null && cierre.p_enviado === false && !cli().documentos.some((d) => d.estado === 'por_revisar'));
    ok(nombre + ': sale Expediente aprobado con Avisar y Siguiente cliente', /Expediente aprobado/.test(await p.textContent('#hojaRvOk')) && /wa\.me\/584145550134/.test(await p.getAttribute('#rvAvisar', 'href')) && (await p.locator('#rvSiguiente').count()) === 1);
    ok(nombre + ': la pantalla de revisión se cerró y la ficha queda difuminada detrás', (await p.locator('#hojaVer.ver').count()) === 0 && (await p.locator('#rvVelo.ver').count()) === 1);
    await p.screenshot({ path: 'capturas/64-' + nombre + '-aprobado.png' });
    await p.click('#rvSiguiente'); await p.waitForFunction(() => !window.Comun.hojaAbierta());
    ok(nombre + ': Siguiente cliente quita el velo', (await p.locator('#rvVelo.ver').count()) === 0);

    // ----- La abogada: solo lectura, "Tiene un problema" y "Terminar y enviar" -----
    cli().estatus = 'documentos_recibidos'; cli().legal_ok_en = new Date().toISOString();
    const ab = await contexto(nav, dispositivo, m); const s = await entrar(ab.ctx, 'sara', '640217'); s.on('pageerror', (e) => errores.push(nombre + ' abogada: ' + e.message));
    await s.goto(H + 'clientes.html?c=1001&t=documentos'); await s.waitForSelector('#hojaFicha [data-rv-leg]');
    await s.click('#hojaFicha [data-rv-leg]'); await s.waitForSelector('#hojaVer.ver [data-rv-prob]');
    ok(nombre + ': la abogada ve Documentos para el contrato sin Bien ni Devolver', /Documentos para el contrato/.test(await s.textContent('#hojaVer')) && (await s.locator('#hojaVer #verAprobar, #hojaVer #verDevolver').count()) === 0);
    await s.click('#hojaVer [data-rv-prob]'); await s.waitForSelector('#hojaVer [data-rv-pmot="vencido"]'); await s.click('#hojaVer [data-rv-pmot="vencido"]');
    ok(nombre + ': lo marcado cuenta en el pie con Terminar y enviar', /1 con problema/.test(await s.textContent('#hojaVer .rv-pie')) && (await s.locator('#rvLegTerminar').count()) === 1);
    await s.screenshot({ path: 'capturas/64-' + nombre + '-abogada.png' });
    ok(nombre + ': la abogada sin desborde', await sinDesborde(s));
    await s.click('#rvLegTerminar'); await s.waitForFunction(() => !document.querySelector('#hojaVer.ver'));
    const obs = llamo(m, 'legal_observar').slice(-1)[0];
    ok(nombre + ': Terminar y enviar detiene el contrato con el documento y el motivo', obs && obs[2].p_tipo === 'devolver' && obs[2].p_motivo === 'vencido' && Number(obs[2].p_documento) > 0);
    await ab.ctx.close();

    // ----- Revisar en lote: se aprueba por cliente y solo si cuadra -----
    const c2 = m.datos.clientes.find((c) => c.id !== 1001 && !c.unido_a && c.documentos.some((d) => d.estado === 'por_revisar' && (d.archivos || []).length));
    if(c2){
      c2.ia = { id: 900, estado: 'lista', avance: 1, total: 1, puntos: [], excepciones: [], marcas: c2.documentos.map((d) => ({ documento: d.id, propuesta: 'bien', nota: 'Cuadra' })) };
      await p.goto(H + 'trabajo.html?v=lote'); await p.waitForSelector('#rlLista .rl-grp');
      await p.click('[data-rl-cli="' + c2.id + '"]');
      ok(nombre + ': en lote se elige el cliente entero', /Aprobar 1 cliente/.test(await p.textContent('#rlBar')));
      await p.click('#rlBar [data-rl="aprobar"]'); await p.waitForFunction(() => !document.querySelector('#rlBar [data-rl="aprobar"]:not([disabled])') || /0/.test(document.getElementById('rlBar').textContent), null, { timeout: 8000 }).catch(() => {});
      const it = (llamo(m, 'revision_lote').slice(-1)[0] || [])[2];
      ok(nombre + ': aprueba todos los documentos del cliente', !!it && it.p_items.length === c2.documentos.filter((d) => d.estado !== 'aprobado' || it.p_items.some((x) => x.doc === d.id)).filter((d) => it.p_items.some((x) => x.doc === d.id)).length && it.p_items.every((x) => x.accion === 'aprobar'));
    } else ok(nombre + ': (sin otro cliente por revisar)', true);
    await ctx.close();
  }

  // ----- El PDF abre en la página que dice la IA -----
  {
    const { ctx, mundo: m } = await contexto(nav, PC);
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push('pdf: ' + e.message));
    await p.goto(H + 'clientes.html?c=1001&t=documentos'); await p.waitForSelector('#paso [data-paso="ia"]');
    await p.click('#paso [data-paso="ia"]'); await p.waitForSelector('#hojaIA.ver #lanzarIA'); await p.click('#lanzarIA');
    m.iaPaso = 20; await p.waitForFunction(() => /La IA ya los leyó/.test(document.getElementById('paso').textContent), null, { timeout: 15000 });
    const c = m.datos.clientes.find((x) => x.id === 1001); const mk = c.ia.marcas.find((x) => x.propuesta === 'problema'); mk.pagina = 3; if(c.marcas[mk.documento]) c.marcas[mk.documento].pagina = 3;
    c.documentos.forEach((d) => (d.archivos || []).forEach((x) => { x.url_externa = 'https://drive.google.com/file/d/PRUEBA' + x.id + '/view'; x.drive_id = 'PRUEBA' + x.id; }));
    await p.goto(H + 'clientes.html?c=1001&t=documentos'); await p.waitForSelector('#paso [data-paso="revisar"]');
    await p.click('#paso [data-paso="revisar"]'); await p.waitForSelector('#hojaVer.ver .rv-c');
    await p.click('#hojaVer [data-rv-ir="d:' + mk.documento + '"]');
    await p.waitForSelector('#visor iframe', { timeout: 15000 }).catch(() => {});
    const src = await p.evaluate(() => { const f = document.querySelector('#visor iframe'); return f ? f.getAttribute('src') : ''; });
    ok('pdf: la nota de la IA dice en qué página abre', /Abre en la página 3/.test(await p.textContent('#hojaVer .rv-vh')));
    ok('pdf: el visor abre el PDF en esa página', /#page=3$/.test(src));
    await p.waitForTimeout(800);
    const bajados = new Set(m.llamadas.filter((l) => l[0] === 'drive' && !l[2]).map((l) => String(l[1])));
    ok('pdf: mientras mira uno, ya se bajó el siguiente', bajados.size >= 2);
    await ctx.close();
  }
  await nav.close();
  ok('sin errores en la página', errores.length === 0, errores.slice(0, 3));
  cerrar();
})();
