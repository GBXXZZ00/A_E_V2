// Lote 2, parte D: Dedicados (desde la corrida urgente del 14/10, pantalla de operación). Pestañas de operación, avisos de plazo y por verificar,
// expediente con enlaces, contactos de la empresa y Contratos (sin Comisión), edición solo del administrador
// con errores debajo del campo, la ejecutiva ve solo los suyos, navegación e Inicio, y el segmento en Clientes.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar, basePersonas } = require('./simulador');
const { ok, cerrar } = marcador();

const NORA = '77777777-7777-4777-8777-777777777777';
const cliente = (mundo, nombre) => mundo.datos.clientes.find((c) => c.nombre === nombre || c.nombre === nombre + ', C.A.');
function prepararDedicados(mundo){
  const a = cliente(mundo, 'Tornillos El Yunque'); const b = cliente(mundo, 'Posada Brisa Marina'); const c = cliente(mundo, 'Inversiones Bahía Azul');
  // a: ISP de Nora, solo dedicado (sin servicios PYME), con enlaces, contactos y contratos
  a.servicios = []; a.instalaciones = []; a.lider_id = NORA; a.es_isp = true; a.documentos.find((d) => d.casilla === 'acta_constitutiva').archivos = [];
  a.dedicado = { tipo: 'isp', ejecutiva: 'Nora Quintero', ejecutiva_id: NORA, activo: true, verificar: false, ruta_documentos: 'cargar', ruta_contrato: 'Subir el contrato firmado',
    plazo: '2026-10-23', feedback: 'Documentos por correo', estatus_anterior: 'DOCUMENTOS RECIBIDOS', cods: ['501'],
    enlaces: [{ id: 1, codigo: 'CRM-SRV-AIRTEK-001.12/000901', servicio: 'internet', nodo: 'NODO CENTRO PRUEBA', cap_entregada: 2000, cap_facturada: 2000, tarifa: 1.5, activo: true, estado: 'Zulia', municipio: 'Maracaibo', inicio: '2021-03-09', infraestructura: 'Fibra Directa' },
              { id: 2, codigo: null, servicio: 'transporte', nodo: 'NODO NORTE PRUEBA', cap_entregada: 100, tarifa: 10, activo: false, estado: 'Falcón', municipio: 'Carirubana', inicio: null }],
    contactos: [{ area: 'presidencia', nombre: 'Persona Inventada Uno', telefono: '04140000001' }, { area: 'empresa', correo: 'info@inventada.test' }],
    contratos: [{ id: 11, tipo: 'servicio', estatus: 'por_firmar', nota: 'Pendiente por firma' }, { id: 12, tipo: 'vgt', estatus: 'firmado', proyecto: 'Vía de prueba', numero: 'VGT-001', postes: 12 }] };
  // b: corporativo pendiente por verificar, de otra ejecutiva
  b.dedicado = { tipo: 'corporativo', ejecutiva: 'Otra Ejecutiva', activo: true, verificar: true, verificar_motivo: 'RIF repetido en la maestra', ruta_documentos: null, cods: ['502'], enlaces: [], contactos: [], contratos: [{ id: 21, tipo: 'servicio', estatus: 'sin_contrato' }] };
  c.dedicado = { tipo: 'corporativo', ejecutiva: 'Otra Ejecutiva', activo: false, verificar: false, ruta_documentos: 'pedir', cods: ['503'], enlaces: [], contactos: [], contratos: [] };
  return a;
}
async function cerrarHojas(p){ for(let i = 0; i < 5 && await p.evaluate(() => !!window.Comun.hojaAbierta()); i++){ await p.keyboard.press('Escape'); await p.waitForTimeout(260); } }

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const personas = basePersonas().concat([{ id: NORA, usuario: 'nora', pin: '650912', nombre: 'Nora Quintero', rol: 'lider', dedicados: true, cargo: 'Ejecutiva de dedicados', equipo: 'ventas', codigo_vendedor: null, nombre_odoo: null, activo: true, debe_cambiar_pin: false }]);
    const { ctx, mundo } = await contexto(nav, dispositivo, { personas, llamadas: [], sinRed: false, fallaPerfil: false, lento: 0 });
    const a = prepararDedicados(mundo);

    // ----- Administrador -----
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'inicio.html'); await p.waitForSelector('[data-modulo="dedicados"]');
    ok(nombre + ': Inicio tiene el módulo Dedicados', true);
    if(nombre === 'pc') ok('pc: la barra de arriba lleva Dedicados', (await p.textContent('.navpc')).includes('Dedicados'));
    else ok('tel: en el teléfono del administrador la barra de abajo no se recarga con Dedicados', !(await p.textContent('#navAbajo')).includes('Dedicados'));
    await p.click('[data-modulo="dedicados"]'); await p.waitForSelector('#filtros [data-vista="pendientes"]'); await p.waitForSelector('#lista .cli');
    const vistas = await p.textContent('#filtros');
    ok(nombre + ': Dedicados es de operación: Pendientes, Enlaces, Contratos, VGT, Pólizas y Cobranza', ['Pendientes', 'Enlaces', 'Contratos', 'VGT', 'Pólizas', 'Cobranza'].every((x) => vistas.includes(x)) && (await p.getAttribute('#filtros [data-vista="pendientes"]', 'aria-pressed')) === 'true');
    const primero = await p.textContent('#lista .cli:first-child');
    ok(nombre + ': Pendientes dice lo que falta de cada cliente (ISP primero)', primero.includes('Tornillos El Yunque') && primero.includes('ISP') && primero.includes('Falta 1 documento') && primero.includes('Contrato por firmar'));
    const aviso = await p.textContent('#avisoDed');
    ok(nombre + ': aviso del plazo ISP con la semana del 19/10', aviso.includes('semana del 19/10') && /le faltan documentos|les faltan documentos/.test(aviso));
    ok(nombre + ': aviso de pendientes por verificar', aviso.includes('1 cliente pendiente por verificar'));
    ok(nombre + ': marca Pendiente por verificar en la fila', (await p.textContent('#lista')).includes('Pendiente por verificar'));
    ok(nombre + ': sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/25-' + nombre + '-lista.png', fullPage: true });
    await p.click('#avisoDed [data-extra="verificar"]');
    ok(nombre + ': el aviso Por verificar filtra', (await p.locator('#lista .cli').count()) === 1 && (await p.textContent('#lista')).includes('Posada Brisa Marina'));
    await p.click('#filtros [data-quitar-extra]');
    await p.click('#filtros [data-vista="enlaces"]'); await p.waitForFunction(() => document.querySelectorAll('#lista .cli').length === 3);
    ok(nombre + ': Enlaces muestra enlaces activos, capacidad y nodo', /1 enlace activo · 2 Gbps · NODO CENTRO PRUEBA/.test(await p.textContent('#lista')));
    await p.click('#filtros [data-vista="contratos"]');
    ok(nombre + ': Contratos muestra cada contrato con su estatus', /Servicio: por firmar · VGT: firmado/.test(await p.textContent('#lista')));
    await p.click('#filtros [data-vista="vgt"]');
    ok(nombre + ': VGT muestra proyectos y postes', /1 proyecto · 12 postes/.test(await p.textContent('#lista')));
    await p.screenshot({ path: 'capturas/25-' + nombre + '-vgt.png', fullPage: true });
    await p.click('#filtros [data-vista="cobranza"]');
    ok(nombre + ': Cobranza queda preparada sin inventar datos', /Falta que el administrador diga de qué archivo/.test(await p.textContent('#lista')));
    await p.fill('#busca', 'brisa'); await p.waitForFunction(() => document.querySelectorAll('#lista .cli').length === 1);
    ok(nombre + ': el buscador encuentra por nombre', (await p.textContent('#lista')).includes('Posada Brisa Marina'));
    await p.fill('#busca', ''); await p.click('#filtros [data-vista="enlaces"]'); await p.waitForFunction(() => document.querySelectorAll('#lista .cli').length === 3);

    // Expediente del ISP
    await p.click('#lista .cli[data-cliente="' + a.id + '"]'); await p.waitForSelector('#hojaFicha.ver #tab-datos .ded-enl');
    const datos = await p.textContent('#tab-datos');
    ok(nombre + ': Datos muestra tipo, ejecutiva, ruta y plazo ISP', datos.includes('Dedicado ISP') && datos.includes('Nora Quintero') && datos.includes('Cargar a la app') && datos.includes('Semana del 19/10'));
    ok(nombre + ': enlaces con nodo, capacidad, tarifa y la fecha cruda de la analista', datos.includes('NODO CENTRO PRUEBA') && datos.includes('2 Gbps') && datos.includes('Tarifa 1,5') && datos.includes('Inicio según la analista: 2021-03-09'));
    ok(nombre + ': el enlace suspendido se ve apagado', (await p.locator('.ded-e.apagado').count()) === 1);
    ok(nombre + ': contactos de la empresa con teléfono y correo', datos.includes('Presidencia') && datos.includes('0414-0000001') && datos.includes('info@inventada.test'));
    ok(nombre + ': sin el recuadro de "Sin instalar" de los PYME', !datos.includes('Todavía sin servicio'));
    ok(nombre + ': hay pestaña Contratos y no hay Comisión (no comisionan)', await p.evaluate(() => !document.querySelector('#tabs [data-tab="contratos"]').classList.contains('hidden') && document.querySelector('#tabs [data-tab="comision"]').classList.contains('hidden')));
    ok(nombre + ': desde Datos se puede cambiar el estatus legal', (await p.locator('#tab-datos [data-paso="estatus"]').count()) >= 1);
    await p.screenshot({ path: 'capturas/25-' + nombre + '-ficha-datos.png' });

    // Editar el dedicado: verificar sin motivo da error debajo
    await p.click('#tab-datos [data-ded-editar]'); await p.waitForSelector('#hojaDed.ver');
    await p.click('#dVer'); await p.click('#guardarDed');
    ok(nombre + ': marcar por verificar sin decir qué da error debajo', (await p.textContent('#eDed')).includes('Escribe qué hay que verificar'));
    await p.fill('#dMot', 'Confirmar RIF con la analista'); await p.selectOption('#dRuta', 'pedir'); await p.click('#guardarDed');
    await p.waitForSelector('#hojaDed', { state: 'hidden' }).catch(() => {}); await p.waitForFunction(() => /Pendiente por verificar/.test(document.querySelector('#tab-datos').textContent));
    ok(nombre + ': guardar pasa por el servidor y se ve al momento', mundo.llamadas.some((l) => l[1] === 'dedicado_editar' && l[2].p_campos.verificar === true && l[2].p_campos.ruta_documentos === 'pedir'));

    // Contratos
    await p.click('#tabs [data-tab="contratos"]'); await p.waitForSelector('#tab-contratos.on [data-ctr-editar]');
    const ctr = await p.textContent('#tab-contratos');
    ok(nombre + ': Contratos con servicio y VGT por proyecto', ctr.includes('Servicio dedicado') && ctr.includes('Por firmar') && ctr.includes('VGT') && ctr.includes('Vía de prueba') && ctr.includes('12 postes'));
    await p.screenshot({ path: 'capturas/25-' + nombre + '-ficha-contratos.png' });
    await p.click('[data-ctr-editar="11"]'); await p.waitForSelector('#hojaCtr.ver');
    await p.selectOption('#kEst', 'firmado'); await p.evaluate(() => { const f = document.querySelector('#kFirma'); f.removeAttribute('max'); f.value = '2099-01-01'; });
    await p.click('#guardarCtr');
    ok(nombre + ': fecha de firma futura da error debajo del campo', (await p.textContent('#eFirma')).includes('no puede ser futura'));
    await p.fill('#kFirma', '2026-10-01'); await p.fill('#kVence', '12 meses desde la firma'); await p.click('#guardarCtr');
    await p.waitForFunction(() => /12 meses desde la firma/.test(document.querySelector('#tab-contratos').textContent));
    ok(nombre + ': el contrato queda firmado con su vencimiento escrito y quién lo cambió', (await p.textContent('#tab-contratos')).includes('Firmado') && (await p.textContent('#tab-contratos')).includes('Marcos Rivas'));
    await cerrarHojas(p);

    // Clientes: la tarjeta Dedicado ISP trae al ISP
    await p.goto(H + 'clientes.html'); await p.waitForSelector('#tarjetas [data-tarjeta="isp"]');
    await p.click('#tarjetas [data-tarjeta="isp"]'); await p.click('#filtros [data-filtro="todos"]');
    await p.waitForFunction(() => /Tornillos El Yunque/.test(document.getElementById('lista').textContent));
    ok(nombre + ': en Clientes la tarjeta Dedicado ISP trae al ISP', (await p.getAttribute('#tarjetas [data-tarjeta="isp"]', 'aria-pressed')) === 'true');

    // ----- La ejecutiva de dedicados -----
    const c2 = await contexto(nav, dispositivo, mundo); const q = await entrar(c2.ctx, 'nora', '650912'); q.on('pageerror', (e) => errores.push(e.message));
    await q.goto(H + 'dedicados.html'); await q.waitForURL('**/clientes.html?s=isp**'); await q.click('#filtros [data-filtro="todos"]'); await q.waitForSelector('#lista .cli');
    ok(nombre + ': la líder que abre Dedicados llega a Clientes con la tarjeta ISP y ve solo los suyos', (await q.getAttribute('#tarjetas [data-tarjeta="isp"]', 'aria-pressed')) === 'true' && (await q.locator('#lista .cli').count()) === 1 && (await q.textContent('#lista')).includes('Tornillos El Yunque'));
    if(nombre === 'tel') ok('tel: la barra de abajo de la líder no tiene Dedicados (lo ve en Clientes)', !(await q.textContent('#navAbajo')).includes('Dedicados'));
    await q.click('#lista .cli'); await q.waitForSelector('#hojaFicha.ver #tab-datos .ded-enl');
    ok(nombre + ': la ejecutiva no ve Editar ni cambia contratos', (await q.locator('[data-ded-editar]').count()) === 0 && (await q.locator('[data-ctr-editar]').count()) === 0);
    await q.screenshot({ path: 'capturas/25-' + nombre + '-ejecutiva.png' });
    await c2.ctx.close(); await ctx.close();
  }
  ok('sin errores de la página', errores.length === 0); if(errores.length) console.log(errores);
  await nav.close(); cerrar();
})();
