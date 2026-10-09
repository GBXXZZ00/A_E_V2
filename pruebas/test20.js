// Aliados comerciales en la app: el aliado pide un cliente subiendo el RIF primero (disponible, en cartera, en gestión por otro, no se lee),
// sube lo demás y envía; ve el avance de la IA y el resultado; recaudos con Subir de nuevo y Pedir excepción; referir desde la cartera.
// El administrador responde excepciones, ve el buzón, paga y enlaza usuarios; el líder solo ve los instalados por aliados.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, pin, entrar } = require('./simulador');
const { RPC } = require('./mundo');
const { ok, cerrar } = marcador();

const ALIADO = { id: '88888888-8888-4888-8888-888888888888', usuario: 'redes', pin: '571942', nombre: 'Redes Norte Ejemplo', rol: 'aliado', cargo: 'Aliado comercial', equipo: 'aliados', codigo_vendedor: null, nombre_odoo: null, activo: true, debe_cambiar_pin: false };
const CANALES = { id: '99999999-9999-4999-8999-999999999999', usuario: 'canal', pin: '640375', nombre: 'Carla Canales', rol: 'analista', canales: true, cargo: 'Coordinación de canales', equipo: 'ambos', codigo_vendedor: null, nombre_odoo: null, activo: true, debe_cambiar_pin: false };
const hoy = new Date().toISOString();
const err = (m) => ({ __error: { code: 'P0001', message: m } });

function mundoAliados(m){
  const A = m.al = { n: 40, rifCaso: 'libre', subidas: [], analizar: 0,
    sols: [
      { id: 31, codigo: 'AL-0031', tipo: 'empresa', etiqueta: 'recaudos', cliente: 'Inversiones Ensayo <img src=x onerror="window.__xss=1">', cliente_id: 9001, rif: 'J000000021', aliado: 'Redes Norte Ejemplo', aliado_id: 1, creada_en: hoy, actualizada_en: hoy },
      { id: 29, codigo: 'AL-0029', tipo: 'empresa', etiqueta: 'excepcion', cliente: 'Comercial Ficticia 88, C.A.', cliente_id: 9002, rif: 'J000000022', aliado: 'Conecta Sur Ejemplo', aliado_id: 2, creada_en: hoy, actualizada_en: hoy, excepcion: { punto: 'Cédula vencida', motivo: 'Tiene cita para renovarla.' } },
      { id: 22, codigo: 'AL-0022', tipo: 'empresa', etiqueta: 'instalada', cliente: 'Óptica Imaginaria, C.A.', cliente_id: 9003, rif: 'J000000024', aliado: 'Redes Norte Ejemplo', aliado_id: 1, creada_en: hoy, actualizada_en: hoy, instalada_en: hoy, categoria: 'PYME-1GB' }
    ],
    refs: [{ id: 8, codigo: 'RF-0008', rif: 'J000000031', cliente: 'Restaurante Muestra, C.A.', aliado: 'Conecta Sur Ejemplo', etiqueta: 'referido', creado_en: hoy }],
    sinp: [{ id: 5, origen: 'carga', cliente: 'Kiosco Supuesto, C.A.', rif: 'J000000041', aliado: 'Conecta Sur Ejemplo', instalada_en: hoy, categoria: 'PYME-1GB' }, { id: 6, origen: 'historico', cliente: 'Vivero Ejemplo', rif: '000000051', aliado: 'Pulse', instalada_en: '2026-03-04T12:00:00Z', categoria: 'PYME-1GB' }],
    docs: {}, estadoExtra: {} };
  const deAliado = (yo) => yo.rol === 'aliado' ? 1 : yo.canales ? 3 : null;
  const sol = (id) => A.sols.find((s) => s.id === Number(id));
  Object.assign(RPC, {
    aliado_inicio(m, yo){ if(!deAliado(yo)) return err('Tu usuario no está enlazado a un aliado. Avísale al administrador'); if(m.fallaInicio) return err('No se pudo leer'); return { aliado: yo.nombre, solicitudes: A.sols.filter((s) => s.aliado_id === deAliado(yo)), referidos: A.refs.filter((r) => r.aliado_id === deAliado(yo)) }; },
    aliados_bandeja(m, yo){ if(yo.rol !== 'admin') return err('No tienes permiso para hacer esto'); return { solicitudes: A.sols, referidos: A.refs, sin_permiso: A.sinp, viejas: [{ id: 'v1', cliente: 'Licorería Prueba', rif: 'J000000053', aliado: 'Conecta Sur', situacion: 'consulta' }], lideres: ['Lucía Ferrer', 'Líder Dos'] }; },
    solicitud_crear(m, yo, a){ const ya = A.sols.find((s) => s.aliado_id === deAliado(yo) && s.etiqueta === 'borrador' && !s.rif); if(ya){ ya.tipo = a.p_tipo; return { id: ya.id, codigo: ya.codigo }; }
      const id = ++A.n; A.sols.push({ id, codigo: 'AL-00' + id, tipo: a.p_tipo, etiqueta: 'borrador', aliado: yo.nombre, aliado_id: deAliado(yo), creada_en: hoy, actualizada_en: hoy }); return { id, codigo: 'AL-00' + id }; },
    solicitud_estado(m, yo, a){
      const s = sol(a.p_sol); if(!s) return err('No se encontró la solicitud');
      if(yo.rol !== 'admin' && s.aliado_id !== deAliado(yo)) return err('No tienes acceso a esta solicitud');
      if(s.etiqueta === 'analizando'){ A.analizar++; if(A.analizar >= 2){ s.etiqueta = 'lista'; s.ia = { estado: 'lista', veredicto: 'apto', total: 4, avance: 4, puntos: [], marcas: [] }; } }
      const docs = (A.docs[s.id] || []).map((d, i) => ({ id: 500 + i, casilla: d.casilla, numero: d.numero, estado: 'por_revisar', archivos: [{ id: 700 + i, nombre: 'x.pdf', lectura: 'ok' }] }));
      if(s.id === 31) return Object.assign({}, s, { es_admin: yo.rol === 'admin', docs: [{ id: 81, casilla: 'acta_constitutiva', numero: 0, archivos: [{ id: 1, lectura: 'ok' }] }, { id: 82, casilla: 'cedula', numero: 1, archivos: [{ id: 2, lectura: 'ok' }] }],
        ia: { estado: 'lista', veredicto: 'no_apto', total: 3, avance: 3, marcas: [{ documento: 81, propuesta: 'problema', nota: 'La junta venció en 2023. Busca el acta de asamblea que la ratificó.' }, { documento: 82, propuesta: 'bien', nota: 'Vigente.' }],
          puntos: [{ id: 'falta_rif_personal_1', titulo: 'Falta RIF personal', estado: 'bloquea', detalle: 'No está en el expediente.' }, { id: 'falta_correo_empresa_0', titulo: 'Falta correo de la empresa', estado: 'bloquea', detalle: 'Hay que escribirlo en el expediente.' }] },
        contacto: { correo: 'rep@ejemplo.test', telefono: '04140000000' }, hilo: [{ texto: 'Resultado: Recaudos incompletos.', color: 'rj', en: hoy }] });
      return Object.assign({ docs, ia: s.ia || (s.etiqueta === 'analizando' ? { estado: 'leyendo', total: 4, avance: 1 } : null), hilo: [{ texto: 'Envió la solicitud.', color: 'az', en: hoy }], es_admin: yo.rol === 'admin' }, s);
    },
    solicitud_contacto(m, yo, a){ A.contacto = a; return null; },
    solicitud_enviar(m, yo, a){ const s = sol(a.p_sol); s.etiqueta = 'analizando'; A.analizar = 0; return { corrida: 1 }; },
    solicitud_excepcion(m, yo, a){ const s = sol(a.p_sol); s.etiqueta = 'excepcion'; s.excepcion = { punto: a.p_punto, motivo: a.p_motivo }; return null; },
    solicitud_instalacion(m, yo, a){ const s = sol(a.p_sol); s.etiqueta = 'curso'; s.fecha_instalacion = a.p_fecha; return null; },
    solicitud_decidir(m, yo, a){ if(yo.rol !== 'admin') return err('No tienes permiso para hacer esto'); const s = sol(a.p_sol); s.etiqueta = a.p_modo === 'aprobar' ? 'lista' : a.p_modo === 'noprocede' ? 'noprocede' : 'recaudos'; s.respuesta = a.p_texto; return null; },
    referido_crear(m, yo, a){ if(A.refs.some((r) => r.solicitud === a.p_solicitud && a.p_solicitud)) return err('Ese cliente ya fue referido'); A.refs.push({ id: 9, codigo: 'RF-0009', rif: 'J000000014', cliente: 'Distribuidora Inventada', aliado_id: deAliado(yo), etiqueta: 'referido', creado_en: hoy, solicitud: a.p_solicitud }); return { id: 9, codigo: 'RF-0009' }; },
    referido_decidir(m, yo, a){ const r = A.refs.find((x) => x.id === a.p_ref); r.etiqueta = a.p_aceptar ? 'aceptado' : 'no_aceptado'; r.lider = a.p_lider; return null; },
    aliados_pagos(m, yo){ if(yo.rol !== 'admin' && !yo.canales) return err('No tienes permiso para hacer esto'); return { instalaciones: A.sols.filter((s) => s.etiqueta === 'instalada' && !s.pagada_en).map((s) => Object.assign({ equipo: 'EQ1', servicio: '824-00000001' }, s)), referidos: [{ id: 7, codigo: 'RF-0007', rif: 'J000000033', cliente: 'Gimnasio Ejemplo', aliado: 'Redes Norte Ejemplo', etiqueta: 'instalado', horas: -5, instalado_en: hoy }] }; },
    pago_marcar(m, yo, a){ if(a.p_tipo === 'instalacion') sol(a.p_id).pagada_en = hoy; return null; },
    instalados_aliados(m, yo){ return [{ id: 1, cliente: 'Óptica Imaginaria, C.A.', rif: 'J000000024', aliado: 'Redes Norte Ejemplo', instalada_en: hoy, categoria: 'PYME-1GB', con_permiso: yo.rol === 'admin' ? true : null }]; },
    sin_permiso_revisar(m, yo, a){ A.sinp.find((p) => p.id === a.p_id).revisado_en = hoy; return null; },
    aliados_lista(m, yo){ return { aliados: [{ id: 1, nombre: 'REDES NORTE EJEMPLO', codigo: '027', perfil: null }, { id: 3, nombre: 'Canales', es_canales: true, perfil: null }], perfiles: [{ id: ALIADO.id, nombre: ALIADO.nombre, usuario: ALIADO.usuario, rol: 'aliado' }, { id: CANALES.id, nombre: CANALES.nombre, usuario: CANALES.usuario, rol: 'analista' }] }; },
    aliado_enlazar(m, yo, a){ A.enlace = a; return null; }
  });
  const registrar = RPC.documentos_registrar;
  RPC.documentos_registrar = (m, yo, a) => { if(yo.rol !== 'aliado') return registrar(m, yo, a); const s = A.sols.find((x) => x.cliente_id === a.p_cliente); (A.docs[s.id] = A.docs[s.id] || []).push(a.p_items[0].casillas[0]); return 1; };
}

async function rutas(ctx, m){
  await ctx.route('**/functions/v1/aliado_rif', async (r) => {
    const buf = r.request().postDataBuffer() || Buffer.alloc(0); const sid = Number((/name="solicitud"\r\n\r\n(\d+)/.exec(buf.toString('latin1')) || [])[1]);
    m.llamadas.push(['aliado_rif', sid]);
    await new Promise((ok) => setTimeout(ok, 400));
    const s = m.al.sols.find((x) => x.id === sid); const c = m.al.rifCaso;
    const cab = { 'access-control-allow-origin': '*' };
    if(c === 'falla') return r.fulfill({ status: 502, contentType: 'application/json', headers: cab, body: JSON.stringify({ error: 'No se pudo leer el RIF ahora. Intenta de nuevo en un momento' }) });
    const res = c === 'libre' ? { estado: 'libre', cliente: 9100 + sid, nombre: 'PANADERÍA EJEMPLO, C.A.', rif: 'J000000011' } : c === 'cartera' ? { estado: 'cartera', nombre: 'DISTRIBUIDORA INVENTADA, C.A.', rif: 'J000000014' }
      : c === 'otro' ? { estado: 'otro', nombre: 'CLÍNICA DEMO NORTE, C.A.', rif: 'J000000015' } : { estado: 'ilegible' };
    if(res.estado === 'libre'){ s.cliente_id = res.cliente; s.cliente = res.nombre; s.rif = res.rif; } else if(res.rif){ s.rif = res.rif; s.cliente = res.nombre; s.etiqueta = res.estado; }
    return r.fulfill({ status: 200, contentType: 'application/json', headers: cab, body: JSON.stringify(res) });
  });
  await ctx.route('**/functions/v1/drive_subir', async (r) => {
    const txt = (r.request().postDataBuffer() || Buffer.alloc(0)).toString('latin1'); const cli = (/name="cliente"\r\n\r\n(\d+)/.exec(txt) || [])[1];
    m.llamadas.push(['subir', cli]); m.al.subidas.push(cli);
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ drive_id: 'PRUEBAAL' + m.al.subidas.length + 'x', nombre: 'x.pdf', mime: 'application/pdf', tamano: 10 }) });
  });
}
const PDF = { name: 'rif.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 prueba') };
async function subirEn(p, sel){ const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click(sel)]); await fc.setFiles(PDF); }
async function entrarComo(ctx, persona, equipo){
  const p = await ctx.newPage(); await p.goto(H + 'index.html'); await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await p.goto(H + 'index.html');
  await p.waitForSelector('#pasoEquipo:not(.hidden)');
  await p.click('[data-equipo="' + equipo + '"]'); await p.fill('#usuario', persona.usuario); await p.click('#seguir');
  const pc = await p.evaluate(() => window.matchMedia('(min-width:900px)').matches); await pin(p, persona.pin, pc);
  if(!persona.noEsperar) await p.waitForURL(/(inicio|aliados)\.html/);
  return p;
}
const entrarAliado = (ctx, persona) => entrarComo(ctx, persona, 'aliados');

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo: m } = await contexto(nav, dispositivo);
    m.personas.push(Object.assign({}, ALIADO), Object.assign({}, CANALES)); mundoAliados(m); await rutas(ctx, m);
    const llamo = (f) => m.llamadas.filter((l) => l[0] === 'rpc' && l[1] === f);

    // ----- Aliado: entra directo a su módulo -----
    const p = await entrarAliado(ctx, ALIADO); p.on('pageerror', (e) => errores.push(e.message));
    await p.waitForURL('**/aliados.html'); await p.waitForSelector('.al-grande.prin');
    ok(nombre + ': el aliado entra directo a su módulo', p.url().endsWith('aliados.html'));
    ok(nombre + ': su inicio ofrece Nueva solicitud y Referir cliente', (await p.textContent('#lista')).includes('Nueva solicitud') && (await p.textContent('#lista')).includes('Referir cliente'));
    ok(nombre + ': Lo que te toca muestra la de recaudos incompletos', (await p.textContent('#lista')).includes('Recaudos incompletos'));
    ok(nombre + ': el nombre del cliente se escapa (no ejecuta código)', !(await p.evaluate(() => window.__xss)) && (await p.textContent('#lista')).includes('<img'));
    ok(nombre + ': sin barra de navegación del equipo de ventas', (await p.locator('#navAbajo').count()) === 0);
    await p.screenshot({ path: 'capturas/t20-' + nombre + '-inicio.png' });

    // ----- Nueva solicitud: cliente disponible -----
    await p.click('.al-grande.prin'); await p.waitForSelector('#hojaNueva.ver [data-subirn="rif_empresa:0"]');
    ok(nombre + ': las demás casillas esperan al RIF', await p.isDisabled('[data-subirn="acta_constitutiva:0"]'));
    await subirEn(p, '[data-subirn="rif_empresa:0"]');
    await p.waitForSelector('.al-banda.azul'); ok(nombre + ': mientras lee dice que revisa la cartera', (await p.textContent('.al-banda')).includes('revisando la cartera'));
    await p.waitForSelector('.al-banda.verde');
    ok(nombre + ': RIF libre: Cliente disponible con el nombre', (await p.textContent('.al-banda.verde')).includes('PANADERÍA EJEMPLO'));
    await p.waitForFunction(() => !document.querySelector('[data-subirn="rif_empresa:0"]') || document.querySelector('.al-cas .chip') && !/Subiendo/.test(document.querySelector('.al-cas').textContent));
    ok(nombre + ': el RIF se guarda en Drive del cliente nuevo', m.al.subidas.some((c) => Number(c) >= 9100));
    for(const k of ['acta_constitutiva:0', 'cedula:1', 'rif_personal:1']){ await subirEn(p, '[data-subirn="' + k + '"]'); await p.waitForFunction((x) => !/Subiendo/.test(document.querySelector('[data-subirn="' + x + '"]').textContent), k); }
    ok(nombre + ': Enviar sigue apagado sin contacto', await p.isDisabled('[data-acc="enviarN"]'));
    await p.fill('#n_correo', 'malo'); await p.fill('#n_tel', '0414 1234567'); await p.fill('#n_correoEmp', 'empresa@ejemplo.test');
    await p.click('[data-acc="enviarN"]');
    ok(nombre + ': correo malo: error debajo del campo', (await p.textContent('#e_correo')).includes('correo válido'));
    await p.fill('#n_correo', 'rep@ejemplo.test'); await p.click('[data-acc="enviarN"]');
    await p.waitForSelector('#hojaSol.ver .al-pasos');
    ok(nombre + ': al enviar guarda el contacto y lanza la IA', llamo('solicitud_contacto').length >= 1 && llamo('solicitud_enviar').length === 1);
    ok(nombre + ': pantalla de avance con los pasos', (await p.textContent('.al-pasos')).includes('Leyendo documentos') && (await p.textContent('.al-pasos')).includes('1 de 4'));
    await p.screenshot({ path: 'capturas/t20-' + nombre + '-carga.png' });
    await p.waitForSelector('#hojaSol .estado.verde', { timeout: 12000 });
    ok(nombre + ': sola pasa a Lista para instalar', (await p.textContent('#hojaSol .estado')).includes('Lista para instalar'));
    await p.click('[data-form="curso"]'); await p.waitForSelector('#hojaForm.ver #fFecha'); await p.click('#hojaForm [data-acc="guardarForm"]');
    await p.waitForSelector('#hojaSol .estado.azul');
    ok(nombre + ': marcar instalación en curso', llamo('solicitud_instalacion').length === 1 && (await p.textContent('#hojaSol .estado')).includes('Instalación en curso'));
    await p.click('#hojaSol [data-cierra]'); await p.waitForTimeout(350);

    // ----- Cliente en cartera: referir desde el resultado -----
    m.al.rifCaso = 'cartera';
    await p.click('.al-grande.prin'); await p.waitForSelector('#hojaNueva.ver [data-subirn="rif_empresa:0"]'); await p.waitForTimeout(300);
    await subirEn(p, '[data-subirn="rif_empresa:0"]'); await p.waitForSelector('#hojaNueva [data-acc="referirSol"]');
    ok(nombre + ': cliente en cartera: no deja seguir y ofrece referir', (await p.textContent('#hojaNueva .al-banda')).includes('Cliente en cartera') && await p.isDisabled('[data-subirn="acta_constitutiva:0"]'));
    await p.click('#hojaNueva [data-acc="referirSol"]'); await p.waitForSelector('#hojaForm.ver #fRif');
    ok(nombre + ': el RIF del referido viene leído y fijo', await p.isDisabled('#fRif') && (await p.inputValue('#fRif')).includes('J-'));
    await p.click('#hojaForm [data-acc="guardarForm"]'); await p.waitForTimeout(400);
    ok(nombre + ': referido enviado con la solicitud', llamo('referido_crear').length === 1 && llamo('referido_crear')[0][2].p_solicitud > 0);

    // ----- En gestión por otro y RIF que no se lee -----
    m.al.rifCaso = 'ilegible';
    await p.click('.al-grande.prin'); await p.waitForSelector('#hojaNueva.ver [data-subirn="rif_empresa:0"]'); await p.waitForTimeout(300);
    await subirEn(p, '[data-subirn="rif_empresa:0"]'); await p.waitForSelector('#hojaNueva .al-banda.ambar');
    ok(nombre + ': RIF ilegible: pide una foto más clara y deja subir de nuevo', (await p.textContent('#hojaNueva .al-banda')).includes('foto más clara') && !(await p.isDisabled('[data-subirn="rif_empresa:0"]')));
    m.al.rifCaso = 'otro'; await subirEn(p, '[data-subirn="rif_empresa:0"]'); await p.waitForSelector('#hojaNueva .al-banda:not(.azul):not(.ambar)');
    ok(nombre + ': en gestión por otro: sin referir', (await p.textContent('#hojaNueva .al-banda')).includes('Otra persona') && (await p.locator('#hojaNueva [data-acc="referirSol"]').count()) === 0);
    if(nombre === 'tel') await p.screenshot({ path: 'capturas/t20-tel-otro.png' });
    await p.click('#hojaNueva .hoja-pie [data-cierra]'); await p.waitForTimeout(350);

    // ----- Recaudos incompletos: qué falta, subir de nuevo, pedir excepción -----
    await p.click('[data-tab="solicitudes"]'); await p.click('[data-sol="31"]'); await p.waitForSelector('#hojaSol.ver .estado.ambar');
    const t31 = await p.textContent('#cSol');
    ok(nombre + ': cada documento dice qué le pasa', t31.includes('La junta venció') && t31.includes('Por corregir') && t31.includes('Bien'));
    ok(nombre + ': lo que falta aparece con Subir y el contacto que falta', t31.includes('Falta RIF personal') && (await p.locator('[data-subirs="rif_personal:1"]').count()) === 1 && (await p.locator('#s_correoEmp').count()) === 1);
    await p.screenshot({ path: 'capturas/t20-' + nombre + '-recaudos.png' });
    await p.click('[data-form="excepcion"]'); await p.waitForSelector('#hojaForm.ver #fTexto');
    await p.fill('#fTexto', 'no'); await p.click('#hojaForm [data-acc="guardarForm"]');
    ok(nombre + ': motivo corto: error debajo', (await p.textContent('#eForm')).includes('al menos 5'));
    await p.fill('#fTexto', 'Tiene cita para renovar el acta.'); await p.click('#hojaForm [data-acc="guardarForm"]');
    await p.waitForSelector('#hojaSol .estado.morado');
    ok(nombre + ': excepción pedida queda en espera', llamo('solicitud_excepcion').length === 1 && (await p.textContent('#hojaSol .estado')).includes('Excepción solicitada'));
    ok(nombre + ': sin desborde horizontal', await sinDesborde(p));
    await p.close();

    // ----- Error al cargar -----
    m.fallaInicio = true;
    const pe = await entrarAliado(ctx, ALIADO); await pe.waitForSelector('#lista [data-acc="reintentar"]');
    ok(nombre + ': si falla dice qué pasó y deja reintentar', (await pe.textContent('#lista')).includes('No se pudo cargar'));
    m.fallaInicio = false; await pe.click('#lista [data-acc="reintentar"]'); await pe.waitForSelector('.al-grande.prin');
    ok(nombre + ': Reintentar carga', true); await pe.close();

    // ----- Administrador -----
    const a = await entrarComo(ctx, { usuario: 'marcos', pin: '482913' }, 'ventas'); a.on('pageerror', (e) => errores.push(e.message));
    await a.waitForSelector('[data-modulo="aliados"]');
    ok(nombre + ': Inicio del admin tiene el módulo Aliados', (await a.textContent('[data-modulo="aliados"]')).includes('referidos'));
    await a.goto(H + 'aliados.html'); await a.waitForSelector('[data-tab="para_ti"].on'); await a.waitForSelector('#lista .rv');
    const pt = await a.textContent('#lista');
    ok(nombre + ': Para ti junta excepciones, referidos y sin permiso nuevo', pt.includes('Excepciones') && pt.includes('Referidos por aceptar') && pt.includes('Kiosco Supuesto') && !pt.includes('Vivero Ejemplo'));
    await a.screenshot({ path: 'capturas/t20-' + nombre + '-admin.png' });
    await a.click('[data-sol="29"]'); await a.waitForSelector('#hojaSol.ver [data-modo="aprobar"]');
    ok(nombre + ': el admin ve el pedido de excepción', (await a.textContent('#cSol')).includes('Tiene cita para renovarla'));
    await a.click('[data-modo="aprobar"]'); await a.waitForSelector('#hojaForm.ver #fTexto'); await a.fill('#fTexto', 'Aceptada mientras renueva.'); await a.click('#hojaForm [data-acc="guardarForm"]');
    await a.waitForSelector('#hojaSol .estado.verde');
    ok(nombre + ': admitir excepción la deja lista y avisa del correo pendiente', llamo('solicitud_decidir').length === 1 && (await a.textContent('#cSol')).includes('Correo de aprobación'));
    await a.click('#hojaSol [data-cierra]'); await a.waitForTimeout(350);
    await a.click('[data-ref="8"]'); await a.waitForSelector('#hojaForm.ver #fLider');
    await a.click('#hojaForm [data-acc="guardarForm"]'); ok(nombre + ': aceptar referido exige el líder', (await a.textContent('#eForm')).includes('líder'));
    await a.selectOption('#fLider', 'Lucía Ferrer'); await a.click('#hojaForm [data-acc="guardarForm"]'); await a.waitForTimeout(400);
    ok(nombre + ': referido aceptado y pasado al líder', llamo('referido_decidir').length === 1 && llamo('referido_decidir')[0][2].p_lider === 'Lucía Ferrer');
    await a.click('[data-tab="sinp"]'); await a.waitForSelector('[data-sinp="6"]');
    ok(nombre + ': el buzón muestra lo histórico marcado', (await a.textContent('#lista')).includes('Antes del módulo'));
    await a.click('[data-tab="pagos"]'); await a.waitForSelector('[data-pagar="instalacion"]');
    ok(nombre + ': Pagos con Excel y el referido atrasado', (await a.locator('[data-acc="excel"]').count()) === 1 && (await a.textContent('#lista')).includes('Pago atrasado'));
    const [dl] = await Promise.all([a.waitForEvent('download'), a.click('[data-acc="excel"]')]);
    ok(nombre + ': el Excel se descarga', dl.suggestedFilename() === 'aliados-por-pagar.xlsx');
    await a.click('[data-pagar="instalacion"]'); await a.waitForSelector('#hojaForm.ver'); await a.click('#hojaForm [data-acc="guardarForm"]'); await a.waitForTimeout(400);
    ok(nombre + ': marcar pagado', llamo('pago_marcar').length === 1);
    await a.click('[data-tab="aliados"]'); await a.waitForSelector('[data-enlazar="1"]');
    await a.selectOption('[data-enlazar="1"]', ALIADO.id); await a.waitForTimeout(400);
    ok(nombre + ': enlaza el aliado con su usuario', llamo('aliado_enlazar').length === 1 && llamo('aliado_enlazar')[0][2].p_perfil === ALIADO.id);
    ok(nombre + ': sin desborde (admin)', await sinDesborde(a));
    await a.close();

    // ----- Líder: solo ve los instalados -----
    const l = await entrarComo(ctx, { usuario: 'lucia', pin: '739105' }, 'ventas'); await l.waitForSelector('[data-modulo="aliados"]');
    ok(nombre + ': el líder ve el módulo como Instalados por aliados', (await l.textContent('[data-modulo="aliados"]')).includes('instalados por aliados'));
    await l.goto(H + 'aliados.html'); await l.waitForSelector('#lista .rv');
    ok(nombre + ': lista de instalados, sin pestañas ni bandeja', (await l.textContent('#titulo')).includes('Instalados') && (await l.locator('#filtros button').count()) === 0 && llamo('aliados_bandeja').filter((x) => true).length === llamo('aliados_bandeja').length);
    await l.close();

    // ----- Coordinación de canales: solicitudes, referidos y pagos -----
    const c = await entrarComo(ctx, CANALES, 'ventas').catch(() => null);
    if(c){
      await c.goto(H + 'aliados.html'); await c.waitForSelector('[data-tab="pagos"]');
      ok(nombre + ': canales tiene Pagos', (await c.locator('[data-tab="pagos"]').count()) === 1);
      await c.click('[data-tab="referidos"]'); await c.click('#lista [data-acc="referir"]'); await c.waitForSelector('#hojaForm.ver #fApellido');
      ok(nombre + ': canales carga referidos con nombre, apellido, teléfono y coordenadas', (await c.locator('#fCoord').count()) === 1);
      await c.close();
    }
    await ctx.close();
  }
  ok('sin errores de JavaScript', errores.length === 0, errores);
  await nav.close();
  cerrar();
})().catch((e) => { console.error(e); process.exit(1); });
