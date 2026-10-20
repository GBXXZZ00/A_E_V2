// Lote 21/10, tanda B (partes 3, 4 y 5): Clientes lista y hoja, velocidad de documentos. Datos inventados (mundo.js).
// Lista: "Todos" primero y por defecto, filtros Segmento/Líder/Estatus/VGT, suspendidos aparte, páginas con flechas,
// etiqueta de gestión con un toque desde la fila (cuenta que filtra; Pedir pone Esperando), PYME + Dedicado y contrato pendiente.
// Hoja: pestañas, cambiar líder y suspender (administrador), cola de subidas, Otro con nombre, Conatel, Aprobar seleccionados,
// Abrir en Drive, vista ligera primero y aprobar sin esperar al servidor. Revisión: bandeja Contrato por completar.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();

const llamo = (m, f) => m.llamadas.filter((l) => l[0] === 'rpc' && l[1] === f);
const ultLista = (m) => llamo(m, 'clientes_lista2').slice(-1)[0][2];
async function cerrarHojas(p){ for(let i = 0; i < 5 && await p.evaluate(() => !!window.Comun.hojaAbierta()); i++){ await p.keyboard.press('Escape'); await p.waitForTimeout(260); } }
const archivo = (n, mime) => ({ name: n, mimeType: mime || 'application/pdf', buffer: Buffer.from('%PDF-1.4 prueba ' + n) });

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    mundo.personas.push({ id: '77777777-7777-4777-8777-777777777777', usuario: 'rosa', pin: '640218', nombre: 'Rosa Paredes', rol: 'lider', cargo: 'Líder de ventas', equipo: 'ventas', activo: true, debe_cambiar_pin: false });
    const cs = mundo.datos.clientes;
    // Muchos clientes para que haya varias páginas
    const base = cs.find((x) => !x.es_natural && !x.dedicado && x.servicios.length);
    for(let n = 0; n < 34; n++) cs.push(Object.assign(JSON.parse(JSON.stringify(base)), { id: 700000 + n, nombre: 'Relleno Inventado ' + String(n).padStart(2, '0') + ', C.A.', doc_numero: String(410000000 + n), estatus_desde: new Date(Date.now() - (n + 40) * 86400000).toISOString(), hilo: [], gestiones: [] }));
    // Uno suspendido y uno firmado sin contrato subido
    const sus = cs.find((x) => x.nombre.indexOf('Relleno Inventado 00') === 0); sus.suspendido_en = new Date().toISOString(); sus.suspendido_nota = 'Cliente de prueba suspendido';
    const firm = cs.find((x) => x.nombre.indexOf('Relleno Inventado 01') === 0); firm.estatus = 'contrato_firmado'; firm.estatus_desde = new Date().toISOString(); firm.documentos = firm.documentos.filter((d) => d.casilla.indexOf('contrato_') !== 0);

    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    await p.evaluate(() => { try { localStorage.removeItem('ae_cli_tarjeta'); } catch (e) {} });
    await p.goto(H + 'clientes.html'); await p.waitForSelector('#lista .cli');
    // ---------- Lista ----------
    const at = await p.evaluate(() => Array.from(document.querySelectorAll('#filtros [data-filtro]')).map((b) => b.dataset.filtro));
    ok(nombre + ': "Todos" es el primer atajo y el que está puesto', at[0] === 'todos' && (await p.getAttribute('#filtros [data-filtro="todos"]', 'aria-pressed')) === 'true' && ultLista(mundo).p_filtro === 'todos');
    ok(nombre + ': los atajos de siempre siguen', ['en_curso', 'por_revisar', 'sin_gestion', 'faltan', 'por_subir'].every((x) => at.includes(x)));
    const sels = await p.evaluate(() => Array.from(document.querySelectorAll('#selsPc [data-sel]')).map((x) => x.dataset.sel));
    ok(nombre + ': filtros Segmento, Líder, Estatus legal y VGT (sin Enlaces ni Pólizas)', ['segmento', 'lider', 'estatus', 'vgt'].every((k) => sels.includes(k)) && !sels.includes('enlaces') && !sels.includes('poliza'));
    const segOps = await p.evaluate(() => Array.from(document.querySelectorAll('#selsPc [data-sel="segmento"] option')).map((o) => o.textContent).join('|'));
    const vgtOps = await p.evaluate(() => Array.from(document.querySelectorAll('#selsPc [data-sel="vgt"] option')).map((o) => o.textContent).join('|'));
    ok(nombre + ': Segmento trae PYME, Dedicado, Dedicado ISP y Combinado; VGT trae requisitos incompletos', segOps.includes('PYME|Dedicado|Dedicado ISP|Combinado') && vgtOps.includes('Con VGT') && vgtOps.includes('VGT por firmar') && vgtOps.includes('Requisitos VGT incompletos'));
    ok(nombre + ': el suspendido no sale en la lista', !(await p.textContent('#lista')).includes('Relleno Inventado 00'));
    ok(nombre + ': la fila del combinado dice PYME + Dedicado', (await p.textContent('#lista')).includes('PYME + Dedicado') || !cs.some((x) => x.dedicado && x.servicios.some((s) => !/dedicad/.test(s.categoria))));
    // Páginas con flechas
    const tx = await p.textContent('#pagTx');
    ok(nombre + ': la lista se pagina con flechas "1–30 de N"', /^1–30 de \d+$/.test(tx) && (await p.locator('#pagAnt').isDisabled()) && (await p.locator('#verMas').count()) === 0);
    await p.click('#pagSig'); await p.waitForFunction(() => /^31–/.test(document.getElementById('pagTx').textContent));
    ok(nombre + ': la flecha pide la página siguiente al servidor', ultLista(mundo).p_desde === 30 && !(await p.locator('#pagAnt').isDisabled()));
    await p.click('#pagAnt'); await p.waitForFunction(() => /^1–30/.test(document.getElementById('pagTx').textContent));
    // Contrato firmado sin archivo en la fila
    await p.fill('#busca', 'Relleno Inventado 01'); await p.waitForFunction(() => /Relleno Inventado 01/.test(document.getElementById('lista').textContent) && document.querySelectorAll('#lista .cli').length === 1);
    ok(nombre + ': firmado sin contrato subido dice "Firmado: falta subir contrato" en la fila', (await p.textContent('#lista')).includes('Firmado: falta subir contrato'));
    await p.fill('#busca', ''); await p.waitForFunction(() => document.querySelectorAll('#lista .cli').length > 1);
    // Etiqueta desde la fila: un toque
    const primero = await p.locator('#lista .cli-w').first(); const idP = Number(await primero.locator('.cli').getAttribute('data-cliente'));
    await primero.locator('[data-etiquetar]').click(); await p.waitForSelector('#hojaEtq.ver [data-etq="contactado"]');
    ok(nombre + ': la etiqueta pide fecha (hoy) y nota arriba, con label', (await p.locator('#hojaEtq label[for="etqFecha"]').count()) === 1 && (await p.inputValue('#etqFecha')).length === 10);
    await p.fill('#etqNota', 'Llamó la asistente'); await p.click('#hojaEtq [data-etq="contactado"]');
    await p.waitForFunction(() => !document.querySelector('#hojaEtq.ver'));
    await p.waitForFunction((id) => { const c = document.querySelector('.cli[data-cliente="' + id + '"]'); return c && /Contactado/.test(c.textContent); }, idP);
    ok(nombre + ': con un toque queda la etiqueta en la fila, con su nota en el servidor', llamo(mundo, 'cliente_etiqueta').some((l) => l[2].p_etiqueta === 'contactado' && l[2].p_nota === 'Llamó la asistente'));
    ok(nombre + ': la etiqueta no cambia el estatus', cs.find((x) => x.id === idP).estatus === (mundo.datos.clientes.find((x) => x.id === idP) || {}).estatus);
    await p.waitForFunction(() => /Contactado\s*1/.test(document.getElementById('gestionCuentas').textContent));
    ok(nombre + ': arriba la cuenta de cada etiqueta', /Contactado\s*1/.test(await p.textContent('#gestionCuentas')) && (await p.textContent('#gestionCuentas')).includes('Esperando documentos'));
    await p.click('[data-etq-filtro="contactado"]'); await p.waitForFunction(() => document.querySelectorAll('#lista .cli').length === 1);
    ok(nombre + ': tocar la cuenta filtra por la etiqueta', ultLista(mundo).p_filtros.gestion === 'contactado' && p.url().includes('g=contactado'));
    await p.click('[data-etq-filtro="contactado"]'); await p.waitForFunction(() => document.querySelectorAll('#lista .cli').length > 1);
    // Ver suspendidos
    await p.click('#verSus'); await p.waitForFunction(() => /Relleno Inventado 00/.test(document.getElementById('lista').textContent));
    ok(nombre + ': "Ver suspendidos" los muestra aparte con su etiqueta', ultLista(mundo).p_filtros.suspendidos === '1' && (await p.textContent('#lista')).includes('Suspendido') && (await p.locator('#lista .cli').count()) === 1);
    await p.click('#verSus'); await p.waitForFunction(() => !/Relleno Inventado 00/.test(document.getElementById('lista').textContent));
    ok(nombre + ': lista sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/44-' + nombre + '-lista.png' });

    // ---------- Hoja: Datos ----------
    const yun = cs.find((x) => x.nombre.indexOf('Tornillos El Yunque') === 0);
    await p.goto(H + 'clientes.html?c=' + yun.id); await p.waitForSelector('#hojaFicha.ver #tab-datos .tarjs');
    const tabs = await p.evaluate(() => Array.from(document.querySelectorAll('#tabs [data-tab]')).filter((b) => !b.classList.contains('hidden')).map((b) => b.dataset.tab).join());
    ok(nombre + ': pestañas en orden (Datos, Documentos, Contrato, VGT si tiene, Hilo, Comisión si tiene)', /^datos,documentos,contrato,(vgt,)?hilo(,comision)?$/.test(tabs), tabs);
    await p.click('[data-lider-cambiar="pyme"]'); await p.waitForSelector('#hojaLider.ver');
    await p.click('#guardarLider');
    ok(nombre + ': cambiar líder sin elegir da error debajo', (await p.textContent('#eLider')).includes('Elige'));
    await p.selectOption('#lidSel', '77777777-7777-4777-8777-777777777777'); await p.click('#guardarLider');
    await p.waitForFunction(() => /Rosa Paredes/.test(document.getElementById('tab-datos').textContent));
    ok(nombre + ': el administrador cambia el líder (pasa por el servidor y queda en el hilo)', llamo(mundo, 'cliente_lider_cambiar').some((l) => l[2].p_cual === 'pyme') && yun.lider === 'Rosa Paredes' && yun.hilo.some((h) => h.texto === 'lider'));
    await p.click('[data-suspender="1"]'); await p.waitForSelector('#hojaSus.ver'); await p.click('#guardarSus');
    ok(nombre + ': suspender sin nota da error debajo', (await p.textContent('#eSus')).includes('por qué'));
    await p.fill('#susNota', 'Pidió pausa'); await p.click('#guardarSus');
    await p.waitForFunction(() => /Cliente suspendido/.test(document.getElementById('tab-datos').textContent));
    ok(nombre + ': queda suspendido con su nota y se puede reactivar', !!yun.suspendido_en && (await p.locator('[data-suspender="0"]').count()) === 1 && (await p.textContent('#cabFicha')).includes('Suspendido'));
    await p.click('[data-suspender="0"]'); await p.waitForSelector('#hojaSus.ver'); await p.click('#guardarSus');
    await p.waitForFunction(() => !/Cliente suspendido/.test(document.getElementById('tab-datos').textContent));
    ok(nombre + ': Reactivar lo devuelve', !yun.suspendido_en && llamo(mundo, 'cliente_suspender').length === 2);
    // Etiqueta desde la hoja
    await p.click('#cabFicha [data-etiquetar-ficha]'); await p.waitForSelector('#hojaEtq.ver'); await p.click('#hojaEtq [data-etq="sin_contacto"]');
    await p.waitForFunction(() => /Sin contacto/.test(document.getElementById('cabFicha').textContent));
    ok(nombre + ': la etiqueta también se pone desde la hoja y se ve arriba', (await p.textContent('#tab-datos')).includes('Sin contacto'));
    // Conatel para ISP
    await p.click('#tabs [data-tab="documentos"]');
    const conatel = await p.locator('#tab-documentos [data-casilla="conatel:0"]').textContent().catch(() => '');
    ok(nombre + ': casilla Conatel del ISP: habilitación vigente con Internet y Transporte', !yun.es_isp || (conatel.includes('Conatel') && (/Habilitación vigente con atributos de Internet y Transporte/.test(conatel) || !!yun.documentos.find((d) => d.casilla === 'conatel'))));
    await cerrarHojas(p);

    // ---------- Hoja: Documentos (cola, Otro, Aprobar seleccionados) ----------
    const c = cs.find((x) => !x.es_natural && !x.dedicado && !x.legal_ok_en && x.id < 700000 && x.servicios.length);
    c.documentos = c.documentos.filter((d) => d.casilla !== 'rif_empresa' && d.casilla !== 'acta_constitutiva');
    mundo.lentoSubida = 700;
    await p.goto(H + 'clientes.html?c=' + c.id + '&t=documentos'); await p.waitForSelector('#hojaFicha.ver #tab-documentos [data-casilla="rif_empresa:0"]');
    // Dos subidas seguidas sin esperar
    await p.click('[data-subir="rif_empresa:0"]'); await p.setInputFiles('#archivo', [archivo('rif-empresa.pdf')]);
    await p.waitForSelector('#tab-documentos .doc.subiendo[data-casilla="rif_empresa:0"]');
    ok(nombre + ': mientras sube se puede elegir otro (no está bloqueado)', !(await p.locator('#subirVarios').isDisabled()));
    await p.click('[data-subir="acta_constitutiva:0"]'); await p.setInputFiles('#archivo', [archivo('acta.pdf')]);
    await p.waitForSelector('#tab-documentos .doc.subiendo[data-casilla="acta_constitutiva:0"]');
    ok(nombre + ': la segunda queda en cola con su aviso, y se puede seguir trabajando', (await p.textContent('#tab-documentos [data-casilla="acta_constitutiva:0"]')).includes('En cola') && (await p.textContent('#textoSubida')).includes('en cola'));
    await p.click('#tabs [data-tab="hilo"]'); await p.click('#tabs [data-tab="documentos"]');
    await p.waitForFunction(() => !window.Ficha.ocupado(), null, { timeout: 15000 }); await p.waitForTimeout(400);
    ok(nombre + ': las dos se guardan en orden por detrás', llamo(mundo, 'documentos_registrar').length === 2 && llamo(mundo, 'documentos_registrar')[0][2].p_items[0].casillas[0].casilla === 'rif_empresa');
    mundo.lentoSubida = 0;
    // Otro pide nombre y nota
    await p.click('[data-subir="otro:0"]'); await p.setInputFiles('#archivo', [archivo('carta.pdf')]);
    await p.waitForSelector('#hojaCampo.ver #oNombre');
    ok(nombre + ': "Otro" pide el nombre con label arriba', (await p.locator('#hojaCampo label[for="oNombre"]').count()) === 1);
    await p.click('#formOtro button[type="submit"]');
    ok(nombre + ': sin nombre da error debajo', (await p.textContent('#eOtro')).includes('Escribe'));
    await p.fill('#oNombre', 'Carta de autorización'); await p.fill('#oNota', 'La firmó el gerente'); await p.click('#formOtro button[type="submit"]');
    await p.waitForFunction(() => !window.Ficha.ocupado() && /Carta de autorización/.test(document.getElementById('tab-documentos').textContent), null, { timeout: 8000 });
    ok(nombre + ': el documento Otro se guarda con su nombre y nota', llamo(mundo, 'documentos_registrar').slice(-1)[0][2].p_items[0].titulo === 'Carta de autorización' && (await p.textContent('#tab-documentos [data-grupo="otros"]')).includes('La firmó el gerente'));
    // Aprobar seleccionados
    const nRev = c.documentos.filter((d) => d.estado === 'por_revisar').length;
    if(nRev > 1){
      await p.click('#elegirAprobar'); await p.waitForSelector('#tab-documentos [data-sel-doc]');
      const ids = await p.evaluate(() => Array.from(document.querySelectorAll('#tab-documentos [data-sel-doc]')).slice(0, 2).map((x) => Number(x.dataset.selDoc)));
      for(const x of ids) await p.click('[data-sel-doc="' + x + '"]');
      ok(nombre + ': Aprobar seleccionados cuenta lo elegido', (await p.textContent('#aprobarSel')).includes('2'));
      await p.click('#aprobarSel'); await p.waitForFunction(() => !document.querySelector('[data-sel-doc]'));
      ok(nombre + ': una sola llamada marca los elegidos para aprobar, sin abrirlos', llamo(mundo, 'documentos_marcar_varios').length === 1 && ids.every((x) => (c.marcas || {})[x] && c.marcas[x].accion === 'aprobar'));
      ok(nombre + ': las casillas dicen que se aprueban al cerrar', (await p.locator('#tab-documentos .doc.marcada').count()) >= 2);
    } else ok(nombre + ': (sin documentos por revisar para elegir)', true);
    ok(nombre + ': documentos sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/44-' + nombre + '-documentos.png' });
    await cerrarHojas(p);

    // ---------- Velocidad: vista ligera y aprobar sin esperar ----------
    const r = cs.find((x) => x.id < 700000 && x.documentos.filter((d) => d.estado === 'por_revisar' && (d.archivos || []).length && !(x.marcas || {})[d.id]).length >= 2);
    if(r){
      r.documentos.forEach((d) => (d.archivos || []).forEach((x) => { x.url_externa = 'https://drive.google.com/file/d/PRUEBA' + x.id + '/view'; x.drive_id = 'PRUEBA' + x.id; }));
      mundo.lentoDrive = 1500; mundo.lentoRpc = { documento_marcar: 1500 };
      await p.goto(H + 'clientes.html?c=' + r.id + '&t=documentos'); await p.waitForSelector('#hojaFicha.ver #revisarTodo');
      await p.click('#revisarTodo'); await p.waitForSelector('#hojaVer.ver');
      await p.waitForSelector('#visor .visor-mini img', { timeout: 1200 }).catch(() => {});
      ok(nombre + ': primero se ve la miniatura mientras llega el archivo completo', (await p.locator('#visor .visor-mini img').count()) === 1 && mundo.llamadas.some((l) => l[0] === 'drive' && l[2] === 'mini'));
      ok(nombre + ': el visor trae "Abrir en Drive"', (await p.locator('#abrirDrive').count()) === 1);
      const t0 = Date.now(); await p.click('#verAprobar');
      await p.waitForFunction(() => /Documento 2 de/.test(document.querySelector('#hojaVer small').textContent), null, { timeout: 1200 }).catch(() => {});
      ok(nombre + ': Aprobar pasa al siguiente al instante, sin esperar al servidor ni a la vista previa', (Date.now() - t0) < 1200 && /Documento 2 de/.test(await p.textContent('#hojaVer small')));
      await p.waitForFunction(() => true); await p.waitForTimeout(1700);
      ok(nombre + ': la marca quedó guardada por detrás', llamo(mundo, 'documento_marcar').length >= 1 && Object.values(r.marcas || {}).some((x) => x.accion === 'aprobar'));
      mundo.lentoDrive = 0; mundo.lentoRpc = null;
      // Si el servidor rechaza, se avisa y la marca se quita
      mundo.fallaRpc = 'documento_marcar'; const sig = await p.textContent('#tVer');
      await p.click('#verAprobar'); await p.waitForTimeout(600);
      ok(nombre + ': si el servidor la rechaza, avisa y no la deja marcada', (await p.locator('.toast').allTextContents()).some((x) => /No se guardó la marca/.test(x)) && !!sig);
      mundo.fallaRpc = null;
      await cerrarHojas(p);
    } else ok(nombre + ': (sin cliente con dos por revisar)', true);

    // ---------- Revisión: bandeja Contrato por completar ----------
    await p.goto(H + 'revision.html'); await p.waitForSelector('#filtros [data-bandeja="contrato_pend"], [data-bandeja="contrato_pend"]');
    await p.click('[data-bandeja="contrato_pend"]'); await p.waitForFunction(() => /Relleno Inventado 01/.test(document.getElementById('lista').textContent));
    ok(nombre + ': en Revisión, "Contrato por completar" trae el firmado sin archivo con su etiqueta', (await p.textContent('#lista')).includes('Firmado: falta subir contrato'));
    await p.locator('.rv-cuerpo', { hasText: 'Relleno Inventado 01' }).click(); await p.waitForSelector('#hojaFicha.ver #tab-contrato.on');
    ok(nombre + ': abre la hoja en Contrato con el aviso', (await p.textContent('#tab-contrato')).includes('Firmado: falta subir contrato'));
    await cerrarHojas(p);

    // ---------- Líder: sin cambiar líder ni suspender ----------
    const c2 = await contexto(nav, dispositivo, mundo); const q = await entrar(c2.ctx, 'lucia', '739105'); q.on('pageerror', (e) => errores.push(e.message));
    const mio = cs.find((x) => x.lider_id === '22222222-2222-4222-8222-222222222222' && !x.suspendido_en);
    await q.goto(H + 'clientes.html?c=' + mio.id); await q.waitForSelector('#hojaFicha.ver #tab-datos .tarjs');
    ok(nombre + ': la líder no ve Cambiar líder ni Suspender, sí la etiqueta', (await q.locator('[data-lider-cambiar], [data-suspender]').count()) === 0 && (await q.locator('[data-etiquetar-ficha]').count()) >= 1);
    // Pedir documentos pone "Esperando documentos"
    const antes = (mio.gestiones || []).length;
    const r2 = require('./mundo').RPC.cliente_contacto(mundo, mundo.personas.find((x) => x.usuario === 'lucia'), { p_cliente: mio.id, p_canal: 'whatsapp', p_motivo: 'pedir' });
    ok(nombre + ': Pedir documentos pone sola la etiqueta Esperando documentos', !(r2 && r2.__error) && mio.gestiones.length === antes + 1 && mio.gestiones[0].e === 'esperando');
    await c2.ctx.close(); await ctx.close();
  }
  ok('sin errores de JavaScript', errores.length === 0, errores);
  await nav.close(); cerrar();
})();
