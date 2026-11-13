// Lote 13/11, partes 2 a 5 y 10: revisión con el visor alto. La IA en la cabecera, Más con lo que antes ocupaba dos filas,
// Devolver con los motivos de cada documento en un panel al lado del PDF, Es otro documento (documento_reclasificar),
// documentos del mismo PDF agrupados con sus tramos, y en el teléfono la lista primero y el documento a todo el alto.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar, rvAbierto, rvLista } = require('./simulador');
const { ok, cerrar } = marcador();
const llamo = (m, f) => m.llamadas.filter((l) => l[1] === f);
const cliDe = (m) => m.datos.clientes.find((x) => x.id === 1001);
const docDe = (m, cas, n) => cliDe(m).documentos.find((d) => d.casilla === cas && (n === undefined || d.numero === n));

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, disp] of [['pc', PC], ['tel', TEL]]){
    const pc = nombre === 'pc';
    const { ctx, mundo: m } = await contexto(nav, disp);
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(nombre + ': ' + e.message));
    const abrir = async () => { await p.goto(H + 'clientes.html?c=1001&t=documentos'); await p.waitForSelector('#paso [data-paso="revisar"]'); await p.click('#paso [data-paso="revisar"]'); await p.waitForSelector('#hojaVer.ver .rv-c', { state: 'attached' }); };
    const ir = async (d) => { await rvLista(p); await p.click('#hojaVer [data-rv-ir="d:' + d.id + '"]'); await p.waitForSelector('#hojaVer .rv-v >> visible=true'); };

    await abrir();
    // ----- Parte 2: la IA en la cabecera y la pantalla alta -----
    ok(nombre + ': la línea de la IA va dentro de la cabecera', (await p.locator('#hojaVer .rv-cab .rv-ia').count()) === 1 && /Estás revisando tú/.test(await p.textContent('#hojaVer .rv-cab .rv-ia')));
    if(pc){
      await p.waitForTimeout(400); const box = await p.locator('#hojaVer').boundingBox(); const pdf = await p.locator('#hojaVer .rv-pdfw').boundingBox();
      ok('pc: la pantalla ocupa la ventana con 12 px de margen', Math.abs(box.x - 12) <= 1 && Math.abs(box.width - (1366 - 24)) <= 1 && Math.abs(box.height - (768 - 24)) <= 1);
      ok('pc: el PDF mide al menos 500 px de alto', pdf.height >= 500);
      ok('pc: la lista mide 340 px', Math.round((await p.locator('#hojaVer .rv-l').boundingBox()).width) === 340);
      ok('pc: la cabecera del documento es una sola fila (66 px, como la maqueta 01)', Math.abs((await p.locator('#hojaVer .rv-vh').boundingBox()).height - 66) <= 2);
    } else {
      ok('tel: abre con la lista', await p.locator('#hojaVer .rv-l').isVisible() && !(await p.locator('#hojaVer .rv-v').isVisible()));
      await rvAbierto(p);
      ok('tel: el documento abre a todo el alto con ← Documentos', await p.locator('#hojaVer [data-rv-lista]').isVisible() && !(await p.locator('#hojaVer .rv-l').isVisible()));
      ok('tel: Devolver y Bien abajo', (await p.locator('#hojaVer .rv-vh .der.rv-dec').evaluate((x) => getComputedStyle(x).position)) === 'fixed');
    }
    ok(nombre + ': ya no están las filas de abajo del PDF', (await p.locator('#hojaVer .rv-dt, #hojaVer .rv-rep').count()) === 0);
    ok(nombre + ': Vence está en la cabecera del documento', (await p.locator('#hojaVer .rv-vh #venceDoc').count()) === 1);
    await p.click('#rvMas');
    const mas = await p.textContent('#rvMasMenu');
    ok(nombre + ': Más reúne Es otro documento, Reemplazar, No está en la junta y Ya no aplica', /Es otro documento/.test(mas) && /Reemplazar archivo/.test(mas) && /No está en la junta/.test(mas) && /Ya no aplica/.test(mas) && await p.locator('#rvMasMenu').isVisible());
    await p.click('#hojaVer .rv-vh h3'); ok(nombre + ': tocar fuera cierra Más', !(await p.locator('#rvMasMenu').isVisible()));

    // ----- Parte 3: Devolver con los motivos de la cédula -----
    await p.click('#verDevolver'); await p.waitForSelector('#hojaVer .rv-panel [data-motivo]');
    const mots = await p.$$eval('#hojaVer .rv-panel [data-motivo]', (xs) => xs.map((x) => x.dataset.motivo).join());
    ok(nombre + ': la cédula trae sus motivos', mots === 'vencido,ilegible,no_corresponde,nombre,otro' && /¿Por qué devuelves la cédula\?/.test(await p.textContent('#hojaVer .rv-panel')));
    if(pc) ok('pc: el panel va a la derecha del PDF (350 px) y el PDF no pierde alto', Math.round((await p.locator('#hojaVer .rv-panel').boundingBox()).width) === 350 && (await p.locator('#hojaVer .rv-pdfw').boundingBox()).height >= 500);
    await p.click('[data-motivo="nombre"]'); await p.fill('#notaDev', 'Dice otro segundo apellido');
    const ced = docDe(m, 'cedula', 1); await p.click('#devConfirmar'); await p.waitForFunction(() => !document.querySelector('#hojaVer .rv-panel'));
    const mk = llamo(m, 'documento_marcar').slice(-1)[0][2];
    ok(nombre + ': un motivo que el servidor no tiene se guarda como "otro" con su texto', mk.p_documento === ced.id && mk.p_motivo === 'otro' && mk.p_nota === 'El nombre no coincide. Dice otro segundo apellido');

    // RIF personal y RIF de la empresa: sus motivos
    await ir(docDe(m, 'rif_personal', 1)); await p.click('#verDevolver'); await p.waitForSelector('#hojaVer .rv-panel [data-motivo]');
    ok(nombre + ': el RIF personal trae sus motivos', (await p.$$eval('#hojaVer .rv-panel [data-motivo]', (xs) => xs.map((x) => x.dataset.motivo).join())) === 'vencido,ilegible,no_corresponde,no_coincide,otro');
    await p.click('[data-motivo="vencido"]'); await p.click('#devConfirmar'); await p.waitForFunction(() => !document.querySelector('#hojaVer .rv-panel'));
    ok(nombre + ': un motivo del servidor va tal cual', llamo(m, 'documento_marcar').slice(-1)[0][2].p_motivo === 'vencido');
    await ir(docDe(m, 'acta_asamblea')); await p.click('#verDevolver'); await p.waitForSelector('#hojaVer .rv-panel [data-motivo]');
    ok(nombre + ': el acta de asamblea trae sus motivos', (await p.$$eval('#hojaVer .rv-panel [data-motivo]', (xs) => xs.map((x) => x.dataset.motivo).join())) === 'ilegible,no_corresponde,sin_registro,no_nombra,otro');
    await p.click('#devVolver');

    // ----- Parte 4: Es otro documento -----
    const acta = docDe(m, 'acta_constitutiva');
    await ir(acta); await p.click('#rvMas'); await p.click('#rvMasMenu [data-rv-masop="otro"]'); await p.waitForSelector('#hojaVer .rv-panel.az');
    const ops = await p.$$eval('#hojaVer .rv-panel [data-rv-otro]', (xs) => xs.map((x) => x.dataset.rvOtro).join());
    ok(nombre + ': ¿Qué documento es? sin la casilla en la que está', ops === 'rif_empresa,acta_asamblea,cedula,rif_personal,otro' && /Acta constitutiva queda vacía y entra en lo que se le pide/.test(await p.textContent('#hojaVer .rv-panel')));
    await p.click('[data-rv-otro="cedula"]'); await p.click('[data-rv-mover]');
    ok(nombre + ': la cédula pide el representante', /Elige el representante/.test(await p.textContent('#eOtro')));
    await p.click('[data-rv-orep="1"]'); await p.click('[data-rv-mover]'); await p.waitForSelector('#hojaVer [data-rv-mover="reemplazar"]');
    ok(nombre + ': si la casilla ya tiene archivo pregunta Reemplazar o Dejar los dos', (await p.locator('#hojaVer [data-rv-mover="dos"]').count()) === 1 && /ya tiene un archivo/.test(await p.textContent('#hojaVer .rv-panel')));
    await p.click('#otroCancelar');
    await p.click('#rvMas'); await p.click('#rvMasMenu [data-rv-masop="otro"]'); await p.click('[data-rv-otro="acta_asamblea"]'); await p.click('[data-rv-mover]');
    await p.waitForFunction(() => !document.querySelector('#hojaVer .rv-panel'));
    const rc = llamo(m, 'documento_reclasificar').slice(-1)[0][2];
    ok(nombre + ': Moverlo llama a documento_reclasificar con el documento y la casilla', rc.p_documento === acta.id && rc.p_casilla === 'acta_asamblea' && rc.p_modo === null);
    ok(nombre + ': queda en la bitácora y la constitutiva entra en lo que falta', (m.bitacora || []).some((b) => b.accion === 'documento_reclasificado') && acta.casilla === 'acta_asamblea' && /Acta de asamblea 2/.test(await p.textContent('#hojaVer .rv-l')));

    // ----- Parte 5: documentos en un mismo PDF -----
    await ctx.close();
    const c2 = await contexto(nav, disp); const q = await entrar(c2.ctx, 'marcos', '482913'); q.on('pageerror', (e) => errores.push(nombre + ' pdf: ' + e.message));
    const cc = cliDe(c2.mundo); const arch = { id: 1006, ruta: null, url_externa: null, nombre: 'expediente-completo.pdf', mime: 'application/pdf', tamano: 1000 };
    ['acta_constitutiva', 'acta_asamblea', 'rif_empresa'].forEach((k) => { const d = cc.documentos.find((x) => x.casilla === k); d.archivos = [arch]; d.estado = 'por_revisar'; });
    cc.marcas = { [docDe(c2.mundo, 'acta_constitutiva').id]: { documento: docDe(c2.mundo, 'acta_constitutiva').id, accion: 'aprobar', origen: 'manual', pagina: 1 }, [docDe(c2.mundo, 'rif_empresa').id]: { documento: docDe(c2.mundo, 'rif_empresa').id, accion: 'aprobar', origen: 'manual', pagina: 13 } };
    await q.goto(H + 'clientes.html?c=1001&t=documentos'); await q.click('#paso [data-paso="revisar"]'); await q.waitForSelector('#hojaVer.ver .rv-c', { state: 'attached' });
    ok(nombre + ': la lista agrupa los documentos del mismo archivo en una tarjeta', (await q.locator('#hojaVer .rv-pdfg .rv-d').count()) === 3 && /Un solo archivo con 3 documentos/.test(await q.textContent('#hojaVer .rv-pdfg')) && /expediente-completo\.pdf/.test(await q.textContent('#hojaVer .rv-pdfg')));
    ok(nombre + ': cada uno dice su estado y sus páginas', /Bien · páginas 1 a 12/.test(await q.textContent('#hojaVer .rv-pdfg')));
    const asam = docDe(c2.mundo, 'acta_asamblea');
    if(await q.locator('#hojaVer [data-rv-lista]:visible').count()) await q.click('#hojaVer [data-rv-lista]:visible');
    await q.click('#hojaVer [data-rv-ir="d:' + asam.id + '"]'); await q.waitForSelector('#hojaVer .rv-tramos >> visible=true');
    ok(nombre + ': la cabecera dice "Mismo PDF que 2 documentos más"', /Mismo PDF que 2 documentos más/.test(await q.textContent('#hojaVer .rv-vh')));
    ok(nombre + ': encima del PDF los tramos del archivo con el abierto marcado', (await q.locator('#hojaVer .rv-tramos [data-rv-tramo]').count()) === 3 && /Acta de asamblea 1/.test(await q.textContent('#hojaVer .rv-tramos button.on')));
    await q.click('#verDevolver'); await q.waitForSelector('#hojaVer [data-rv-alcance="todo"]');
    ok(nombre + ': devolver dentro del archivo pregunta qué se devuelve', /Solo el acta de asamblea/.test(await q.textContent('#hojaVer .rv-panel')) && /El acta constitutiva y el RIF siguen bien/.test(await q.textContent('#hojaVer .rv-panel')));
    await q.click('[data-motivo="ilegible"]'); await q.click('[data-rv-alcance="todo"]'); const n0 = llamo(c2.mundo, 'documento_marcar').length; await q.click('#devConfirmar');
    await q.waitForFunction((n) => true, n0); await q.waitForTimeout(500);
    const nuevas = llamo(c2.mundo, 'documento_marcar').slice(n0).map((l) => l[2]);
    ok(nombre + ': "El archivo completo" devuelve los 3 documentos', nuevas.length === 3 && nuevas.every((x) => x.p_accion === 'devolver' && x.p_motivo === 'ilegible'));
    await q.screenshot({ path: 'capturas/lote13nov-p5-test-' + nombre + '.png' });
    ok(nombre + ': sin desborde', await sinDesborde(q));
    await c2.ctx.close();
  }
  ok('sin errores de página', errores.length === 0); if(errores.length) console.log(errores.join('\n'));
  await nav.close(); cerrar();
})();
