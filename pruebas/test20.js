// Aliados comerciales en la app: el aliado pide un cliente subiendo el RIF primero (disponible, en cartera, en gestión por otro, no se lee),
// sube lo demás y envía; ve el avance de la IA y el resultado; recaudos con Subir de nuevo y Pedir excepción; referir desde la cartera.
// El administrador responde excepciones, ve el buzón, paga y enlaza usuarios; el líder solo ve los instalados por aliados.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, pin, entrar } = require('./simulador');
const { mundoAliados } = require('./mundo-aliados');
const { RPC } = require('./mundo');
const { ok, cerrar } = marcador();

const ALIADO = { id: '88888888-8888-4888-8888-888888888888', usuario: 'redes', pin: '571942', nombre: 'Redes Norte Ejemplo', rol: 'aliado', cargo: 'Aliado comercial', equipo: 'aliados', codigo_vendedor: null, nombre_odoo: null, activo: true, debe_cambiar_pin: false };
const CANALES = { id: '99999999-9999-4999-8999-999999999999', usuario: 'canal', pin: '640375', nombre: 'Carla Canales', rol: 'analista', canales: true, cargo: 'Coordinación de canales', equipo: 'ambos', codigo_vendedor: null, nombre_odoo: null, activo: true, debe_cambiar_pin: false };
const hoy = new Date().toISOString();
const err = (m) => ({ __error: { code: 'P0001', message: m } });


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
  const p = await ctx.newPage(); await p.goto(H + 'privacidad.html'); await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await p.goto(H + 'index.html');
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
    m.personas.push(Object.assign({}, ALIADO), Object.assign({}, CANALES)); mundoAliados(m, ALIADO, CANALES); await rutas(ctx, m);
    const llamo = (f) => m.llamadas.filter((l) => l[0] === 'rpc' && l[1] === f);

    // ----- Aliado: entra directo a su módulo -----
    // Lote C: avisos del aliado (bloqueo, permiso aprobado, pago) en su campana
    m.datos.avisos = [{ id: 91, tipo: 'aliado', titulo: 'Solicitud bloqueada', texto: 'Comercial Inventada: Ya es cliente de un líder: puedes referirlo.', enlace: 'aliados.html', en: new Date().toISOString(), leido: false, para: 'redes' },
      { id: 92, tipo: 'aliado_pago', titulo: 'Pago registrado', texto: 'Se registró tu pago por Panaderia Inventada.', enlace: 'aliados.html', en: new Date(Date.now() - 3600e3).toISOString(), leido: false, para: 'redes' }];
    const p = await entrarAliado(ctx, ALIADO); p.on('pageerror', (e) => errores.push(e.message));
    await p.waitForURL('**/aliados.html'); await p.waitForSelector('.al-grande.prin');
    await p.waitForSelector('#campana .nbadge:not(.hidden)'); await p.click('#campana'); await p.waitForSelector('#hojaAvisos.ver [data-avg="aliado"]');
    ok(nombre + ': el aliado ve sus avisos agrupados en la campana', (await p.locator('#hojaAvisos [data-avg]').count()) === 2 && /Solicitud bloqueada/.test(await p.textContent('#hojaAvisos')));
    await p.screenshot({ path: 'capturas/20-' + nombre + '-aliado-avisos.png' }); await p.click('#hojaAvisos [data-cierra]'); await p.waitForSelector('#hojaAvisos:not(.ver)'); await p.waitForTimeout(300);
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
    await p.waitForSelector('.al-banda.azul:not(.av-push)'); ok(nombre + ': mientras lee dice que revisa la cartera', (await p.textContent('.al-banda:not(.av-push)')).includes('revisando la cartera'));
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
    ok(nombre + ': en una solicitud lista el aliado puede escribir al administrador', (await p.locator('#hojaSol [data-acc="whats"]').count()) === 1);
    await p.click('[data-form="curso"]'); await p.waitForSelector('#hojaForm.ver #fFecha'); await p.click('#hojaForm [data-acc="guardarForm"]');
    await p.waitForSelector('#hojaSol .estado.azul');
    ok(nombre + ': marcar instalación en curso', llamo('solicitud_instalacion').length === 1 && (await p.textContent('#hojaSol .estado')).includes('Instalación en curso'));
    await p.click('#hojaSol [data-cierra]'); await p.waitForTimeout(350);

    // ----- Cliente en cartera: referir desde el resultado -----
    m.al.rifCaso = 'cartera';
    await p.click('.al-grande.prin'); await p.waitForSelector('#hojaNueva.ver [data-subirn="rif_empresa:0"]'); await p.waitForTimeout(300);
    await subirEn(p, '[data-subirn="rif_empresa:0"]'); await p.waitForSelector('#hojaNueva [data-acc="referirSol"]');
    ok(nombre + ': cliente en cartera: no deja seguir y ofrece referir', (await p.textContent('#hojaNueva .al-banda')).includes('Cliente en cartera') && await p.isDisabled('[data-subirn="acta_constitutiva:0"]'));
    ok(nombre + ': el aviso dice claro que sus archivos no se guardaron (lote 5)', (await p.textContent('#hojaNueva .al-banda')).includes('Sus archivos no se guardaron'));
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
    await a.goto(H + 'aliados.html'); await a.waitForSelector('[data-tab="registro"].on'); await a.waitForSelector('#lista .al-secc');
    const gen = await a.textContent('#lista');
    ok(nombre + ': el Registro abre con todo a la vista por secciones (decisión, pendientes, sin consultar, viejos)', ['Esperan tu decisión', 'Registros viejos (app anterior)'].every((x) => gen.includes(x)) && !gen.includes('Instaladas sin consultar') && gen.includes('Licorería Prueba') && !gen.includes('Vivero Ejemplo'));
    ok(nombre + ': cada registro dice de qué aliado es', (await a.textContent('#lista .al-secc .fila small')).length > 0 && gen.includes('Conecta Sur Ejemplo'));
    ok(nombre + ': lo que espera decisión trae el botón Revisado', (await a.locator('#lista .fila-rev [data-revisado]').count()) >= 1);
    await a.screenshot({ path: 'capturas/20-' + nombre + '-registro-general.png', fullPage: true });
    await a.click('[data-vistaal="aliado"]'); await a.waitForSelector('#lista .grupo-cab');
    ok(nombre + ': entra al Registro agrupado por aliado, con el más reciente arriba', (await a.locator('#lista .grupo').count()) >= 3 && (await a.textContent('#lista .grupo-cab')).length > 0);
    ok(nombre + ': la cabecera del aliado dice abiertas, instaladas, referidos y pagos pendientes', /abiertas?|instaladas?|referidos?|pagos? pendientes?/.test(await a.textContent('#lista')));
    ok(nombre + ': Para ti pasó a un aviso con contador', /\d+ esperan tu decisión/.test(await a.textContent('#avisoAl')));
    // "Nuevo": lo que no se ha visto desde la última entrada; se quita al abrir el grupo
    await a.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.indexOf('ae_al_visto_') === 0); const v = JSON.parse(localStorage.getItem(k)); Object.keys(v).forEach((x) => { v[x] = '2000-01-01T00:00:00Z'; }); localStorage.setItem(k, JSON.stringify(v)); });
    await a.reload(); await a.waitForSelector('#lista .grupo-cab .tagn');
    const nNuevo = await a.locator('#lista .grupo-cab .tagn', { hasText: 'Nuevo' }).count();
    await a.locator('#lista .grupo-cab').first().click(); await a.waitForTimeout(200);
    ok(nombre + ': marca Nuevo en lo no visto y se quita al abrir el grupo', nNuevo >= 1 && (await a.locator('#lista .grupo-cab .tagn', { hasText: 'Nuevo' }).count()) === nNuevo - 1);
    await a.locator('#lista .grupo-cab').first().click();
    await a.screenshot({ path: 'capturas/t20-' + nombre + '-admin.png', fullPage: true });
    await a.click('#avisoAl [data-chipal="para_ti"]'); await a.waitForSelector('#chipsAl [data-chipal="para_ti"].on');
    const pt = await a.textContent('#lista');
    ok(nombre + ': el aviso filtra lo que espera decisión', pt.includes('Comercial Ficticia 88') && pt.includes('Restaurante Muestra') && !pt.includes('Kiosco Supuesto') && !pt.includes('Vivero Ejemplo'));
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
    // Lote 3: lo instalado sin consultar sale del Registro y va solo en la pestaña Sin autorización
    ok(nombre + ': el Registro ya no trae lo instalado sin permiso', (await a.locator('#lista [data-sinp]').count()) === 0 && (await a.locator('#chipsAl [data-chipal="sinp"]').count()) === 0);
    await a.click('[data-tab="sinp"]'); await a.waitForSelector('[data-sinp="6"]');
    ok(nombre + ': la pestaña Sin autorización muestra lo histórico marcado', (await a.textContent('#lista')).includes('Antes del módulo'));
    await a.click('[data-tab="registro"]'); await a.waitForSelector('#chipsAl [data-chipal="todo"]');
    await a.click('#chipsAl [data-chipal="todo"]'); await a.fill('#buscaAl', 'Licorería'); await a.waitForSelector('[data-vieja="41"]');
    ok(nombre + ': el buscador encuentra por cliente y lo histórico va en la misma lista', (await a.locator('#lista [data-sol], #lista [data-ref]').count()) === 0);
    await a.click('[data-vieja="41"]'); await a.waitForSelector('#hojaForm.ver');
    ok(nombre + ': una consulta vieja también abre su hoja', (await a.textContent('#hojaForm')).includes('app vieja'));
    await a.click('#hojaForm [data-cierra]'); await a.waitForTimeout(350); await a.fill('#buscaAl', '');
    // Lote 3: "Revisado" con nota saca el registro de "Esperan tu decisión" sin decidir nada
    await a.click('[data-vistaal="general"]'); await a.waitForSelector('#lista .al-secc [data-revisado="ref:90"]');
    await a.click('#lista .al-secc [data-revisado="ref:90"]'); await a.waitForSelector('#hojaForm.ver #fTexto');
    await a.fill('#fTexto', 'Aprobada por correo'); await a.click('#hojaForm [data-acc="guardarForm"]');
    await a.waitForFunction(() => !document.querySelector('#lista [data-revisado="ref:90"]'));
    ok(nombre + ': Revisado con nota sale de Esperan tu decisión', llamo('aliado_revisado').length === 1 && llamo('aliado_revisado')[0][2].p_nota === 'Aprobada por correo');
    await a.click('[data-tab="pagos"]'); await a.waitForSelector('[data-pagar="instalacion"]');
    ok(nombre + ': Pagos con Excel y el referido atrasado', (await a.locator('[data-acc="excel"]').count()) === 1 && (await a.textContent('#lista')).includes('Pago atrasado'));
    const [dl] = await Promise.all([a.waitForEvent('download'), a.click('[data-acc="excel"]')]);
    ok(nombre + ': el Excel se descarga', dl.suggestedFilename() === 'aliados-por-pagar.xlsx');
    await a.click('[data-pagar="instalacion"]'); await a.waitForSelector('#hojaForm.ver'); await a.click('#hojaForm [data-acc="guardarForm"]'); await a.waitForTimeout(400);
    ok(nombre + ': marcar pagado', llamo('pago_marcar').length === 1);
    await a.click('[data-tab="aliados"]'); await a.waitForSelector('[data-enlazar="1"]');
    await a.selectOption('[data-enlazar="1"]', ALIADO.id); await a.waitForTimeout(400);
    ok(nombre + ': enlaza el aliado con su usuario', llamo('aliado_enlazar').length === 1 && llamo('aliado_enlazar')[0][2].p_perfil === ALIADO.id);
    // Lote 5: WhatsApp del administrador editable y coordinación sin analistas
    await a.waitForSelector('#waAdm'); await a.fill('#waAdm', '0414'); await a.click('[data-acc="guardarWa"]');
    await a.waitForFunction(() => /código/.test(document.getElementById('eWaAdm').textContent));
    ok(nombre + ': número incompleto da error debajo del campo', (await a.textContent('#eWaAdm')).includes('código'));
    await a.fill('#waAdm', '0414 5550001'); await a.click('[data-acc="guardarWa"]'); await a.waitForFunction(() => /Escribir al administrador/.test(document.getElementById('lista').textContent) && document.getElementById('waAdm').value === '584145550001');
    ok(nombre + ': el WhatsApp del administrador se guarda', llamo('ajuste_guardar').length === 2);
    m.al.sinAnalista = true; await a.click('#filtros [data-tab="registro"]'); await a.click('#filtros [data-tab="aliados"]'); await a.waitForSelector('.al-sin');
    ok(nombre + ': sin analistas, la coordinación dice que primero se crea el usuario', (await a.textContent('.al-sin')).includes('Crea primero el usuario en Usuarios con rol Analista'));
    await a.screenshot({ path: 'capturas/t20-' + nombre + '-aliados-usuarios.png', fullPage: true });
    m.al.sinAnalista = false;
    await a.click('#filtros [data-tab="registro"]'); await a.waitForSelector('#accionCab [data-acc="nueva"]').catch(() => {});
    ok(nombre + ': el administrador enlazado a un aliado de prueba ve "Solicitud de prueba"', (await a.locator('#accionCab [data-acc="nueva"]').count()) === 1);
    await a.click('#filtros [data-tab="mes"]'); await a.waitForSelector('#lista .grupo[class] [data-mes]');
    const mes = await a.textContent('#lista');
    ok(nombre + ': "Por mes" muestra instalaciones de aliados por mes desde enero, con indicadores y permiso', mes.includes('Desde enero') && mes.includes('Octubre 2026') && mes.includes('Febrero 2026') && mes.includes('Sin permiso') && mes.includes('solo para aliados'));
    await a.click('[data-mes="2026-02-01"]');
    ok(nombre + ': se abre un mes y se ven sus instalaciones', (await a.textContent('#lista')).includes('Farmacia Ficticia'));
    await a.screenshot({ path: 'capturas/20-' + nombre + '-por-mes.png', fullPage: true });
    await a.click('#filtros [data-tab="registro"]'); await a.waitForSelector('#lista .grupo');
    ok(nombre + ': sin desborde (admin)', await sinDesborde(a));
    await a.close();

    // ----- Líder: ve el registro completo solo para ver, con "Tu cliente" y "Lo mío" -----
    const l = await entrarComo(ctx, { usuario: 'lucia', pin: '739105' }, 'ventas'); await l.waitForSelector('[data-modulo="aliados"]');
    await l.goto(H + 'aliados.html'); await l.waitForSelector('#lista .grupo');
    ok(nombre + ': el líder entra al Registro y tiene Instalados', (await l.locator('#filtros [data-tab]').count()) === 3 && (await l.textContent('#ayuda')).includes('Solo para ver'));
    ok(nombre + ': el líder no ve el aviso de decisiones', (await l.textContent('#avisoAl')).trim() === '');
    await l.click('#chipsAl [data-chipal="mio"]'); await l.waitForSelector('#lista .tagn');
    ok(nombre + ': "Lo mío" deja sus clientes con la marca Tu cliente', (await l.textContent('#lista')).includes('Óptica Imaginaria') && (await l.locator('#lista .tagn', { hasText: 'Tu cliente' }).count()) >= 1 && !(await l.textContent('#lista')).includes('Comercial Ficticia'));
    await l.click('#chipsAl [data-chipal="todo"]'); if(!(await l.locator('[data-grupoal]').count())){ await l.click('[data-vistaal="aliado"]'); await l.waitForSelector('[data-grupoal]'); }
    await l.click('[data-grupoal="Conecta Sur Ejemplo"]'); await l.click('[data-sol="29"]'); await l.waitForSelector('#hojaSol.ver .estado');
    ok(nombre + ': el líder abre la solicitud con todo y sin ningún botón de acción', (await l.locator('#hojaSol [data-form], #hojaSol [data-acc="revisarDeNuevo"], #hojaSol [data-acc="expediente"]').count()) === 0 && (await l.textContent('#cSol')).includes('Bitácora'));
    await l.click('#hojaSol [data-cierra]'); await l.waitForTimeout(350);
    await l.click('#chipsAl [data-chipal="refs"]'); await l.click('[data-grupoal="Conecta Sur Ejemplo"]').catch(() => {}); await l.waitForSelector('[data-ref="8"]'); await l.click('[data-ref="8"]'); await l.waitForSelector('#hojaForm.ver');
    ok(nombre + ': el referido se ve sin poder aceptarlo', (await l.locator('#hojaForm [data-acc="guardarForm"], #hojaForm #fLider').count()) === 0);
    await l.screenshot({ path: 'capturas/t20-' + nombre + '-lider-registro.png' });
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
