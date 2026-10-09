// Base de datos de mentira para las pruebas: clientes, documentos, hilo y comisiones con nombres inventados.
// Repite en pequeño las reglas del servidor para poder probar las pantallas sin tocar la base real.
const LUCIA = '22222222-2222-4222-8222-222222222222';
const DIA = 86400000;
const hace = (dias, horas) => new Date(Date.now() - dias * DIA - (horas || 0) * 3600000).toISOString();

// ----- Corte: del 21 al 20, hora de Caracas -----
const caracas = (iso) => new Date(new Date(iso).getTime() - 4 * 3600000);
const fechaClave = (d) => d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
const hoy = () => fechaClave(caracas(new Date().toISOString()));
function corteDe(clave){ // AAAA-MM-DD -> AAAA-MM-01 del corte
  let a = Number(clave.slice(0, 4)), m = Number(clave.slice(5, 7)); const d = Number(clave.slice(8, 10));
  if(d >= 21){ m++; if(m > 12){ m = 1; a++; } }
  return a + '-' + String(m).padStart(2, '0') + '-01';
}
function masMeses(corte, n){ const d = new Date(Date.UTC(Number(corte.slice(0, 4)), Number(corte.slice(5, 7)) - 1 + n, 1)); return fechaClave(d); }
const corteInicio = (c) => { const p = masMeses(c, -1); return p.slice(0, 8) + '21'; };
const corteFin = (c) => c.slice(0, 8) + '20';
const cierre = (c) => new Date(Date.UTC(Number(c.slice(0, 4)), Number(c.slice(5, 7)) - 1, 21, 4)).getTime(); // 21 a las 00:00 de Caracas
const dias = (a, b) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / DIA);

const LEGAL_OK = ['documentos_recibidos', 'contrato_en_curso', 'por_firmar', 'contrato_firmado'];
const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const comisionable = (i) => !i.es_aliado && !/(dedicad|conectiv)/.test(norm(i.categoria));

let sec = 1000;
function cliente(o){
  const c = Object.assign({ id: ++sec, doc_tipo: 'J', es_natural: false, lider_id: null, lider: 'Rosa Paredes', estatus: 'grandes_negocios', estatus_desde: hace(2),
    legal_ok_en: null, es_top: false, regimen_firma: null, es_isp: false, correo_empresa: null, telefono: null, direccion: 'Calle inventada 1', ug_en: null, ug_por: null,
    creado_en: hace(10), proforma_en: null, proforma_por: null, bienvenida_en: null, bienvenida_por: null, es_demo: false,
    servicios: [], representantes: [], documentos: [], hilo: [], instalaciones: [], orden: null }, o);
  return c;
}
function doc(casilla, numero, estado, extra){
  return Object.assign({ id: ++sec, casilla, numero, estado, motivo: null, nota: null, vence_en: null, firmado_en: null, subido_en: hace(1), subido_por: 'Lucía Ferrer', revisado_en: null, revisado_por: null,
    archivos: [{ id: ++sec, ruta: null, url_externa: null, nombre: 'ejemplo-' + casilla + '.pdf', mime: 'application/pdf', tamano: 250000 }], comparte: [] }, extra || {});
}
function servicio(cod, o){ return Object.assign({ id: ++sec, codigo: cod, sucursal: '824', plan: 'PYME 1 GB', categoria: 'pyme-1gb', estado: 'HABILITADO', fecha_instalacion: hoy(), ip: '10.24.1.6', ip6: null, equipo: 'SERIE' + cod, direccion: 'Calle inventada 1', telefono: '0414-555 01 00', con_deuda: false }, o || {}); }
function instalacion(cod, diasAtras, pagoDias, o){ return Object.assign({ id: ++sec, codigo: cod, sucursal: '824', categoria: 'pyme-1gb', instalada_en: hace(diasAtras), pago_ok_en: pagoDias === null ? null : hace(pagoDias), pago_manual: false, es_aliado: false, instalador: 'instalador mb-02', orden: { id: Number(cod.slice(-5)), numero: 'PRUEBA-001/4' + cod.slice(-5), titulo: 'Solicitud de Instalación PROMO PYME cliente ' + cod.slice(-3), creador: null }, cruce: 'rif', confirmada: true, excepcion_corte: null, excepcion_motivo: null, excepcion_por: null }, o || {}); }
const linea = (tipo, texto, detalle, autor, en) => ({ id: ++sec, tipo, texto: texto || '', detalle: detalle || {}, autor: autor || null, autor_id: null, en: en || hace(0) });

function baseDatos(){
  sec = 1000;
  // Días desde el inicio del corte actual, para poner instalaciones dentro y antes de él
  const actual = corteDe(hoy()); const dentro = Math.max(1, Math.min(8, dias(corteInicio(actual), hoy())));
  const antes = dias(corteInicio(actual), hoy()) + 6;
  const cs = [];
  // 1. En revisión, con escaneo que trae dos documentos. De la líder Lucía.
  let c = cliente({ nombre: 'Vidrios El Faro, C.A.', doc_numero: '591000011', lider_id: LUCIA, lider: 'Lucía Ferrer', estatus: 'documentos_en_revision', estatus_desde: hace(2), regimen_firma: 'individual',
    correo_empresa: 'admin@vidrioselfaro.test', ug_en: hace(0, 2), ug_por: 'Lucía Ferrer', es_top: true });
  c.servicios = [servicio('99100001', { fecha_instalacion: fechaClave(caracas(hace(dentro))) }), servicio('98100001', { sucursal: '900', plan: 'Dedicado 50 Mbps', categoria: 'dedicado', estado: 'SUSPENDIDO' })];
  c.instalaciones = [instalacion('99100001', dentro, 1)];
  c.representantes = [{ orden: 1, nombre: null, correo: 'gerente@vidrioselfaro.test', telefono: '0414-555 01 34' }];
  const acta = doc('acta_constitutiva', 0, 'por_revisar'); const asam = doc('acta_asamblea', 1, 'por_revisar', { archivos: acta.archivos });
  acta.comparte = [{ casilla: 'acta_asamblea', numero: 1 }]; asam.comparte = [{ casilla: 'acta_constitutiva', numero: 0 }];
  c.documentos = [doc('cedula', 1, 'por_revisar'), doc('rif_personal', 1, 'por_revisar'), doc('rif_empresa', 0, 'aprobado', { vence_en: '2027-03-14' }), acta, asam];
  c.hilo = [linea('instalacion', '', {}, null, hace(dentro)), linea('contacto', 'pedir', { canal: 'whatsapp', motivo: 'pedir' }, 'Lucía Ferrer', hace(dentro - 0.2)),
    linea('estatus', 'documentos_solicitados', { antes: 'grandes_negocios', como: 'auto' }, null, hace(dentro - 0.2)),
    linea('nota', 'El cliente manda <b>la foto</b> nueva hoy.', {}, 'Lucía Ferrer', hace(0, 3)), linea('documento_subido', '4', {}, 'Lucía Ferrer', hace(0, 2)),
    linea('estatus', 'documentos_en_revision', { antes: 'documentos_solicitados', como: 'auto' }, null, hace(0, 2))];
  cs.push(c);
  // 2. Persona natural sin nada, sin gestión
  c = cliente({ nombre: 'Kiosco La Parada', doc_tipo: 'V', doc_numero: '99100022', es_natural: true, lider_id: LUCIA, lider: 'Lucía Ferrer', creado_en: hace(6) });
  c.servicios = [servicio('99100002', { telefono: '0424-555 01 77' })]; c.instalaciones = [instalacion('99100002', Math.min(dentro, 4), null)];
  c.hilo = [linea('instalacion', '', {}, null, hace(4))];
  cs.push(c);
  // 3. Devuelto y en su último corte
  c = cliente({ nombre: 'Inversiones Bahía Azul, C.A.', doc_numero: '591000033', lider: 'Rosa Paredes', estatus: 'documentos_pendientes', estatus_desde: hace(1), regimen_firma: 'individual', correo_empresa: 'a@bahiaazul.test', ug_en: hace(1), ug_por: 'Marcos Rivas' });
  c.servicios = [servicio('99100003', { con_deuda: true }), servicio('98100003', { sucursal: '900', categoria: 'dedicado', plan: 'Dedicado 50 Mbps' })]; c.instalaciones = [instalacion('99100003', antes, null)];
  c.representantes = [{ orden: 1, nombre: null, correo: 'b@bahiaazul.test', telefono: '0261-555 01 20' }];
  c.documentos = [doc('cedula', 1, 'aprobado'), doc('rif_personal', 1, 'aprobado'), doc('rif_empresa', 0, 'aprobado'), doc('acta_constitutiva', 0, 'devuelto', { motivo: 'vencido' })];
  cs.push(c);
  // 4. Firmado y cumple
  c = cliente({ nombre: 'Tornillos El Yunque, C.A.', doc_numero: '591000044', lider_id: LUCIA, lider: 'Lucía Ferrer', estatus: 'contrato_firmado', estatus_desde: hace(1), legal_ok_en: hace(1), regimen_firma: 'individual', correo_empresa: 'c@elyunque.test', ug_en: hace(1), ug_por: 'Marcos Rivas' });
  c.servicios = [servicio('99100004')]; c.instalaciones = [instalacion('99100004', dentro, 1)];
  c.representantes = [{ orden: 1, nombre: 'Ana Inventada', correo: 'd@elyunque.test', telefono: '0414-555 01 44' }];
  c.documentos = [doc('cedula', 1, 'aprobado'), doc('rif_personal', 1, 'aprobado'), doc('rif_empresa', 0, 'aprobado'), doc('acta_constitutiva', 0, 'aprobado'), doc('contrato_pyme', 0, 'aprobado', { firmado_en: hoy() })];
  cs.push(c);
  // 5. Dedicado por firmar (no comisiona)
  c = cliente({ nombre: 'Posada Brisa Marina, C.A.', doc_numero: '591000055', lider: 'Rosa Paredes', estatus: 'por_firmar', estatus_desde: hace(7), legal_ok_en: hace(7), regimen_firma: 'individual', correo_empresa: 'e@brisamarina.test', ug_en: hace(7), ug_por: 'Marcos Rivas' });
  c.servicios = [servicio('98100005', { sucursal: '900', categoria: 'dedicado', plan: 'Dedicado 100 Mbps' })]; c.instalaciones = [instalacion('98100005', dentro, null, { sucursal: '900', categoria: 'dedicado' })];
  c.representantes = [{ orden: 1, nombre: null, correo: 'f@brisamarina.test', telefono: '0261-555 01 88' }];
  c.documentos = [doc('cedula', 1, 'aprobado'), doc('rif_personal', 1, 'aprobado'), doc('rif_empresa', 0, 'aprobado'), doc('acta_constitutiva', 0, 'aprobado')];
  cs.push(c);
  // 6. Por instalar
  c = cliente({ nombre: 'Autolavado El Chorro, C.A.', doc_numero: '591000066', lider_id: LUCIA, lider: 'Lucía Ferrer', creado_en: hace(3) });
  c.orden = { numero: 'PRUEBA/0006', creada_en: hace(3), etapa: 'Planificada' };
  cs.push(c);
  // 7 a 30: relleno para probar la paginación y la comparativa
  for(let n = 7; n <= 30; n++){
    const firmado = n % 3 === 0;
    c = cliente({ nombre: 'Comercial de Prueba ' + n + ', C.A.', doc_numero: String(591000000 + n * 11), lider: n % 2 ? 'Rosa Paredes' : 'Tomás Guerra',
      estatus: firmado ? 'contrato_firmado' : 'documentos_solicitados', estatus_desde: hace(n % 5), legal_ok_en: firmado ? hace(antes + 20) : null, ug_en: hace(n % 5), ug_por: 'Rosa Paredes', creado_en: hace(40) });
    const viejo = n > 18;
    c.servicios = [servicio('991000' + n, { telefono: '0414-555 02 ' + n })];
    c.instalaciones = [instalacion('991000' + n, viejo ? antes + 25 + n : dentro, firmado ? (viejo ? antes + 22 : 1) : null)];
    c.representantes = [{ orden: 1, nombre: null, correo: null, telefono: '0414-555 02 ' + n }];
    // Dos pendientes por asignar: una con orden de nombre parecido y otra sin orden ni dueño
    if(n === 8){ c.instalaciones[0].confirmada = false; c.instalaciones[0].cruce = 'nombre_parecido'; c.instalaciones[0].orden.creador = 'Tomás Guerra'; }
    if(n === 10){ c.instalaciones[0].confirmada = false; c.instalaciones[0].cruce = 'sin_orden'; c.instalaciones[0].orden = null; c.instalaciones[0].dueno = null; }
    cs.push(c);
  }
  // La primera empresa ya tenía carpeta en Drive desde la app vieja
  return { clientes: cs, subidas: {}, carpetas: { [cs[0].id]: { nombre: cs[0].doc_numero + ' - VIEJA', subs: {}, vieja: true, id: 'CARPETAVIEJA0001' } } };
}

// ----- Reglas (igual que en el servidor) -----
function requeridos(c){
  const r = []; const n = !c.es_natural && c.regimen_firma === 'conjunta' ? 2 : 1;
  for(let i = 1; i <= n; i++){ const suf = n > 1 ? ' del representante ' + i : ''; r.push({ casilla: 'cedula', numero: i, texto: 'cédula' + suf }, { casilla: 'rif_personal', numero: i, texto: 'RIF personal' + suf }); }
  if(!c.es_natural){ r.push({ casilla: 'rif_empresa', numero: 0, texto: 'RIF de la empresa' }, { casilla: 'acta_constitutiva', numero: 0, texto: 'acta constitutiva' }); if(c.es_isp) r.push({ casilla: 'conatel', numero: 0, texto: 'permiso de Conatel' }); }
  return r;
}
const busca = (c, cas, num) => c.documentos.find((d) => d.casilla === cas && d.numero === num);
function faltantes(c){
  const r = [];
  requeridos(c).forEach((q) => { const d = busca(c, q.casilla, q.numero);
    if(!d) r.push({ k: q.casilla, n: q.numero, t: q.texto, e: 'falta' }); else if(d.estado === 'devuelto') r.push({ k: q.casilla, n: q.numero, t: q.texto, e: 'devuelto', m: d.motivo }); });
  const rp = c.representantes.find((x) => x.orden === 1) || {};
  if(c.es_natural) return r;   // naturales: solo cédula y RIF personal
  if(!String(rp.correo || '').trim()) r.push({ k: 'correo', n: 1, t: 'correo', e: 'falta', dato: true });
  if(!String(rp.telefono || '').trim()) r.push({ k: 'telefono', n: 1, t: 'número de contacto', e: 'falta', dato: true });
  if(!c.es_natural && !String(c.correo_empresa || '').trim()) r.push({ k: 'correo_empresa', n: 0, t: 'correo de la empresa', e: 'falta', dato: true });
  return r;
}
function ponerEstatus(c, nuevo, autor, como){
  if(c.estatus === nuevo) return false;
  const ant = c.estatus; c.estatus = nuevo; c.estatus_desde = hace(0);
  c.legal_ok_en = LEGAL_OK.includes(nuevo) ? (c.legal_ok_en || hace(0)) : null;
  c.hilo.push(linea('estatus', nuevo, { antes: ant, como }, como === 'manual' ? autor.nombre : null));
  return true;
}
function recalcular(c, autor){
  const f = faltantes(c); const dev = f.some((x) => x.e === 'devuelto'); const falta = f.some((x) => x.e === 'falta');
  const rev = requeridos(c).some((q) => { const d = busca(c, q.casilla, q.numero); return d && d.estado === 'por_revisar'; });
  let nuevo = c.estatus;
  if(c.documentos.some((d) => /^contrato_/.test(d.casilla) && d.firmado_en && d.estado !== 'devuelto')) nuevo = 'contrato_firmado';
  else if(['grandes_negocios', 'documentos_pendientes', 'documentos_solicitados', 'documentos_en_revision', 'documentos_recibidos'].includes(c.estatus)){
    if(dev) nuevo = 'documentos_pendientes'; else if(!falta) nuevo = rev ? 'documentos_en_revision' : 'documentos_recibidos'; else if(c.documentos.length) nuevo = 'documentos_pendientes';
  }
  ponerEstatus(c, nuevo, autor, 'auto');
}
const gestion = (c, yo) => { c.ug_en = hace(0); c.ug_por = yo.nombre; };
const porInstalar = (c) => !c.servicios.length && !c.instalaciones.length;
function segmento(c){
  const ded = c.servicios.some((s) => /(dedicad|conectiv)/.test(norm(s.categoria))); const pyme = c.servicios.some((s) => !/(dedicad|conectiv)/.test(norm(s.categoria)));
  return ded && pyme ? 'PYME + Dedicado' : ded ? (c.es_isp ? 'Dedicado ISP' : 'Dedicado corporativo') : c.es_natural ? 'Natural' : 'PYME';
}
const visibles = (m, yo) => m.datos.clientes.filter((c) => ['admin', 'abogado', 'analista'].includes(yo.rol) || (yo.rol === 'lider' && c.lider_id === yo.id));
const error = (mensaje) => ({ __error: { code: 'P0001', message: mensaje } });

const esSenior = (yo) => yo.rol === 'admin' || (yo.rol === 'analista' && !!yo.senior);
const duenoDe = (c, i) => (i.dueno !== undefined ? i.dueno : c.lider);
const ordenOk = (c, i) => !!(i.confirmada && (i.orden || i.cruce === 'manual') && duenoDe(c, i));
const DUENOS = ['Lucía Ferrer', 'Rosa Paredes', 'Tomás Guerra'];
// Dueño de un servicio para la carta: el de su instalación; si no hay, el líder de la cartera
function cartaDe(m, c, sv){
  const i = c.instalaciones.find((x) => x.codigo === sv.codigo && x.sucursal === sv.sucursal);
  const dueno = i ? duenoDe(c, i) : c.lider; const ali = !!(i && i.es_aliado); const p = m.personas.find((x) => x.nombre === dueno) || {};
  return { instalacion: i ? i.id : null, puede: !i || ali || ordenOk(c, i), aliado: ali || !dueno, lider: ali ? null : dueno || null, whatsapp: ali ? null : p.whatsapp || null, correo: ali ? null : p.correo || null };
}
const ultimoEnvio = (sv, tipo) => (sv.envios || []).filter((e) => e.tipo === tipo).slice(-1)[0] || null;
function bienvenidasFilas(m, yo){
  const ini = cierre(masMeses(corteDe(hoy()), -1)); const r = [];
  visibles(m, yo).forEach((c) => c.instalaciones.forEach((i) => {
    if(new Date(i.instalada_en).getTime() < ini) return;
    const sv = c.servicios.find((x) => x.codigo === i.codigo && x.sucursal === i.sucursal); if(!sv) return;
    const k = cartaDe(m, c, sv); if(!k.puede || ultimoEnvio(sv, 'bienvenida')) return;
    if(yo.rol === 'lider' && k.lider !== yo.nombre) return;
    r.push({ instalacion_id: i.id, servicio_id: sv.id, cliente_id: c.id, nombre: c.nombre, codigo: sv.codigo, sucursal: sv.sucursal, instalada_en: i.instalada_en, lider: k.lider, aliado: k.aliado, sin_ip: !sv.ip && !sv.ip6 });
  }));
  return r.sort((a, b) => a.instalada_en.localeCompare(b.instalada_en));
}
function instPorId(m, id){ for(const c of m.datos.clientes){ const i = c.instalaciones.find((x) => x.id === Number(id)); if(i) return { c, i }; } return null; }
function filasComision(m, yo, corte){
  const cert = (m.certificados || {})[corte]; if(cert) return cert.filas.filter((f) => yo.rol !== 'lider' || f.lider_id === yo.id);
  const iniAnt = cierre(masMeses(corte, -2)), ini = cierre(masMeses(corte, -1)), fin = cierre(corte); const r = [];
  visibles(m, yo).forEach((c) => c.instalaciones.forEach((i) => {
    const t = new Date(i.instalada_en).getTime(); if(t < iniAnt || t >= fin || !comisionable(i)) return;
    const leg = c.legal_ok_en ? new Date(c.legal_ok_en).getTime() : null; const pag = i.pago_ok_en ? new Date(i.pago_ok_en).getTime() : null;
    const ook = ordenOk(c, i); const exc = !!(i.excepcion_corte && i.excepcion_corte <= corte); const excAntes = !!(i.excepcion_corte && i.excepcion_corte < corte);
    if(t < ini && ook && ((leg !== null && pag !== null && leg < ini && pag < ini) || excAntes)) return;
    const dueno = duenoDe(c, i);
    r.push({ instalacion_id: i.id, cliente_id: c.id, nombre: c.nombre, doc: c.doc_tipo + '-' + c.doc_numero, instalada_en: i.instalada_en, lider_id: dueno === c.lider ? c.lider_id : null, lider: dueno || 'Por asignar',
      origen: t >= ini ? 'corte' : 'anterior', legal_ok: leg !== null && leg < fin, pago_ok: pag !== null && pag < fin, cumple: ook && ((leg !== null && pag !== null && leg < fin && pag < fin) || exc),
      estatus: c.estatus, codigo: i.codigo, sucursal: i.sucursal, revisar_pago: pag === null && c.servicios.length > 1,
      orden_ok: ook, orden: i.orden ? i.orden.numero : null, orden_id: i.orden ? i.orden.id : null, orden_titulo: i.orden ? i.orden.titulo : null, orden_creador: i.orden ? i.orden.creador : null, cruce: i.cruce,
      es_natural: c.es_natural, instalador: i.instalador, excepcion: exc, excepcion_motivo: i.excepcion_motivo, dueno_manual: !!i.manual });
  }));
  return r.sort((a, b) => a.lider.localeCompare(b.lider) || a.origen.localeCompare(b.origen) || a.instalada_en.localeCompare(b.instalada_en));
}
const sinGestion = (c) => ['grandes_negocios', 'documentos_solicitados', 'documentos_pendientes'].includes(c.estatus) && !porInstalar(c) && new Date(c.ug_en || c.creado_en).getTime() < Date.now() - 3 * DIA;
function ultimoCorte(c){
  const actual = corteDe(hoy()); const iniAnt = cierre(masMeses(actual, -2)), ini = cierre(masMeses(actual, -1));
  return c.instalaciones.some((i) => { const t = new Date(i.instalada_en).getTime(); return comisionable(i) && t >= iniAnt && t < ini && (!c.legal_ok_en || !i.pago_ok_en); });
}

function cruceFalso(m, yo){
  if(!['admin', 'analista'].includes(yo.rol)) return error('No tienes permiso para hacer esto');
  return { base: { hay: true, clientes: 12, lider: 9, estatus: 4, contactos: 6, sin_tad: 1 }, odoo: { hay: true, nuevas: 7, actualizadas: 2, por_rif: 3, por_nombre: 4, sin_cliente: 2, abiertas: 1 },
    inst: { hay: true, nuevas: 5, completadas: 3, reemplazos: 2, antes_del_inicio: 4, dedicados: 1, residenciales: 2, con_orden: 4, por_confirmar: 1, sin_orden: 1, aliado: 2, pagos: 0 },
    corte: { mes: '2026-10-01', filas: 10, cumplen: 2, del_corte: 8, por_asignar: 3 }, anterior: { mes: '2026-09-01', filas: 20, cumplen: 15, del_corte: 20 }, totales: {} };
}
const RPC = {
  inicio_datos(m, yo){
    if(yo.rol === 'aliado') return { rol: yo.rol, hoy: hoy() };
    const actual = corteDe(hoy()); const f = filasComision(m, yo, actual); const v = visibles(m, yo);
    const rev = v.filter((c) => c.estatus === 'documentos_en_revision');
    return { rol: yo.rol, hoy: hoy(), corte: { etiqueta: actual, inicio: corteInicio(actual), fin: corteFin(actual), dias: dias(hoy(), corteFin(actual)), avance: Math.round(100 * (dias(corteInicio(actual), hoy()) + 1) / (dias(corteInicio(actual), corteFin(actual)) + 1)) },
      senior: esSenior(yo), bienvenidas: ['admin', 'analista', 'lider'].includes(yo.rol) ? bienvenidasFilas(m, yo).length : null,
      comision: { total: f.length, cumplen: f.filter((x) => x.cumple).length, ultimo: f.filter((x) => x.origen === 'anterior' && !x.cumple && x.orden_ok).length, por_asignar: f.filter((x) => !x.orden_ok).length },
      clientes: { en_curso: v.filter((c) => c.estatus !== 'contrato_firmado' && !porInstalar(c)).length, por_revisar: rev.length,
        por_revisar_dias: rev.reduce((a, c) => Math.max(a, dias(fechaClave(caracas(c.estatus_desde)), hoy())), 0),
        devueltos: v.filter((c) => c.documentos.some((d) => d.estado === 'devuelto')).length, sin_gestion: v.filter(sinGestion).length,
        por_firmar: v.filter((c) => ['contrato_en_curso', 'por_firmar'].includes(c.estatus)).length, por_instalar: v.filter(porInstalar).length },
      tad_en: null, tad_dias: null, usuarios: yo.rol === 'admin' ? m.personas.filter((p) => p.activo).length : null, hay_demo: false };
  },
  // Igual que clientes_lista, con los filtros de las listas desplegables y sus opciones
  clientes_lista2(m, yo, a){
    const f = a.p_filtros || {}; const todos = visibles(m, yo);
    const pasa = (c) => (!f.lider || (c.lider || 'Sin líder') === f.lider) && (!f.estatus || c.estatus === f.estatus) && (!f.tipo || segmento(c) === f.tipo) &&
      (!f.sucursal || c.servicios.some((s) => s.sucursal === f.sucursal)) && (!f.servicio || c.servicios.some((s) => norm(s.estado) === norm(f.servicio)));
    const m2 = Object.assign({}, m, { datos: Object.assign({}, m.datos, { clientes: m.datos.clientes.filter(pasa) }) });
    const r = RPC.clientes_lista(m2, yo, a); if(r && r.__error) return r;
    const un = (l) => Array.from(new Set(l)).sort();
    r.opciones = { lider: un(todos.map((c) => c.lider || 'Sin líder')), sucursal: un([].concat.apply([], todos.map((c) => c.servicios.map((s) => s.sucursal)))),
      servicio: un([].concat.apply([], todos.map((c) => c.servicios.map((s) => norm(s.estado).replace(/^./, (x) => x.toUpperCase()))))), tipo: ['PYME', 'PYME + Dedicado', 'Dedicado corporativo', 'Dedicado ISP', 'Natural'] };
    return r;
  },
  clientes_lista(m, yo, a){
    if(yo.rol === 'aliado') return error('No tienes permiso para hacer esto');
    const v = visibles(m, yo); const b = norm(a.p_busca); let bd = String(a.p_busca || '').replace(/\D/g, ''); if(bd.length < 4) bd = '';
    const filtros = { en_curso: (c) => c.estatus !== 'contrato_firmado' && !porInstalar(c), por_revisar: (c) => c.estatus === 'documentos_en_revision', por_instalar: porInstalar, sin_gestion: sinGestion,
      devueltos: (c) => c.documentos.some((d) => d.estado === 'devuelto'), ultimo_corte: ultimoCorte, por_firmar: (c) => ['contrato_en_curso', 'por_firmar'].includes(c.estatus), firmados: (c) => c.estatus === 'contrato_firmado', todos: () => true };
    const sel = (b || bd) ? v.filter((c) => (b && norm(c.nombre).includes(b)) || (bd && (c.doc_numero.includes(bd) || c.servicios.some((s) => (s.sucursal + s.codigo).includes(bd) || String(s.telefono || '').replace(/\D/g, '').includes(bd)))))
      : v.filter(filtros[a.p_filtro] || filtros.todos);
    sel.sort((x, y) => (ultimoCorte(y) - ultimoCorte(x)) || y.estatus_desde.localeCompare(x.estatus_desde) || y.id - x.id);
    const lim = Math.min(Math.max(a.p_limite || 20, 1), 60), des = Math.max(a.p_desde || 0, 0);
    const cuenta = (k) => v.filter(filtros[k]).length;
    return { conteos: { en_curso: cuenta('en_curso'), por_revisar: cuenta('por_revisar'), por_instalar: cuenta('por_instalar'), sin_gestion: cuenta('sin_gestion'), por_firmar: cuenta('por_firmar'), firmados: cuenta('firmados'), todos: v.length },
      total: sel.length, desde: des, rol: yo.rol, hoy: hoy(),
      filas: sel.slice(des, des + lim).map((c) => { const s = c.servicios[0]; const rp = c.representantes.find((x) => x.orden === 1) || {};
        return { id: c.id, nombre: c.nombre, doc_tipo: c.doc_tipo, doc_numero: c.doc_numero, es_natural: c.es_natural, seg: segmento(c), estatus: c.estatus, estatus_desde: c.estatus_desde, lider: c.lider,
          ug_en: c.ug_en, ug_por: c.ug_por, creado_en: c.creado_en, es_top: c.es_top, ultimo_corte: ultimoCorte(c), por_instalar: porInstalar(c), n_serv: c.servicios.length,
          serv: s ? { codigo: s.codigo, sucursal: s.sucursal, plan: s.plan, categoria: s.categoria, estado: s.estado, telefono: s.telefono } : null,
          tel: rp.telefono || c.telefono || (s && s.telefono) || null, correo: rp.correo || c.correo_empresa || null, falta: faltantes(c), por_revisar: c.documentos.filter((d) => d.estado === 'por_revisar').length }; }) };
  },
  cliente_ficha(m, yo, a){
    const c = visibles(m, yo).find((x) => x.id === Number(a.p_cliente)); if(!c) return error('No tienes acceso a este cliente');
    const actual = corteDe(hoy()); const rp = c.representantes.find((x) => x.orden === 1) || {}; const s0 = c.servicios[0];
    const r = yo.rol;
    return { rol: r, hoy: hoy(), yo: { id: yo.id, nombre: yo.nombre }, corte: { etiqueta: actual, fin: corteFin(actual), dias: dias(hoy(), corteFin(actual)) },
      cliente: { id: c.id, nombre: c.nombre, doc_tipo: c.doc_tipo, doc_numero: c.doc_numero, es_natural: c.es_natural, seg: segmento(c), estatus: c.estatus, estatus_desde: c.estatus_desde, legal_ok_en: c.legal_ok_en,
        lider: c.lider, es_top: c.es_top, regimen_firma: c.regimen_firma, es_isp: c.es_isp, correo_empresa: c.correo_empresa, telefono: c.telefono, direccion: c.direccion,
        proforma_en: c.proforma_en, proforma_por: c.proforma_por, bienvenida_en: c.bienvenida_en, bienvenida_por: c.bienvenida_por, ug_en: c.ug_en, ug_por: c.ug_por, creado_en: c.creado_en, es_demo: c.es_demo,
        tel: rp.telefono || c.telefono || (s0 && s0.telefono) || null, correo: rp.correo || c.correo_empresa || null, por_instalar: porInstalar(c) },
      orden: c.orden, servicios: c.servicios.map((sv) => Object.assign({}, sv, { envios: undefined, carta: cartaDe(m, c, sv), proforma_envio: ultimoEnvio(sv, 'proforma'), bienvenida_envio: ultimoEnvio(sv, 'bienvenida') })), representantes: c.representantes,
      documentos: c.documentos.slice().sort((x, y) => x.casilla.localeCompare(y.casilla) || x.numero - y.numero), requeridos: requeridos(c), faltantes: faltantes(c),
      hilo: c.hilo.slice().sort((x, y) => y.en.localeCompare(x.en) || y.id - x.id).map((h) => Object.assign({ mio: h.autor === yo.nombre }, h)), hilo_total: c.hilo.length,
      comision: c.instalaciones.map((i) => { const cp = corteDe(fechaClave(caracas(i.instalada_en))); const com = comisionable(i);
        const ok = c.legal_ok_en && i.pago_ok_en ? Math.max(new Date(c.legal_ok_en).getTime(), new Date(i.pago_ok_en).getTime()) : null;
        const ook = ordenOk(c, i);
        const estado = !com ? 'no_comisiona' : !ook ? 'por_asignar' : i.excepcion_corte ? 'cumple' : ok !== null && ok < cierre(masMeses(cp, 1)) ? 'cumple' : Date.now() < cierre(cp) ? 'en_curso' : Date.now() < cierre(masMeses(cp, 1)) ? 'ultimo_corte' : 'perdida';
        return { id: i.id, codigo: i.codigo, sucursal: i.sucursal, categoria: i.categoria, instalada_en: i.instalada_en, pago_ok_en: i.pago_ok_en, pago_manual: i.pago_manual, corte: cp, comisiona: com, estado,
          servicio_id: (c.servicios.find((sv) => sv.codigo === i.codigo) || {}).id || null, es_aliado: i.es_aliado, instalador: i.instalador, orden: i.orden ? i.orden.numero : null, orden_ok: ook, dueno: duenoDe(c, i),
          dueno_whatsapp: m.personas.filter((p) => p.nombre === duenoDe(c, i)).map((p) => p.whatsapp)[0] || null, dueno_correo: m.personas.filter((p) => p.nombre === duenoDe(c, i)).map((p) => p.correo)[0] || null,
          excepcion_corte: i.excepcion_corte, excepcion_motivo: i.excepcion_motivo, excepcion_por: i.excepcion_por,
          corte_pago: i.excepcion_corte ? i.excepcion_corte : ok === null ? null : ok < cierre(cp) ? cp : masMeses(cp, 1) }; }),
      puedo: { revisar: ['admin', 'abogado'].includes(r), estatus: ['admin', 'abogado'].includes(r), contrato: ['admin', 'abogado'].includes(r), regimen: ['admin', 'abogado'].includes(r), top: r === 'admin', gestion: ['admin', 'analista'].includes(r), pago: esSenior(yo), asignar: esSenior(yo), excepcion: r === 'admin', ip: ['admin', 'analista'].includes(r), enviar: ['admin', 'analista', 'lider'].includes(r) } };
  },
  cliente_nota(m, yo, a){
    const c = visibles(m, yo).find((x) => x.id === Number(a.p_cliente)); if(!c) return error('No tienes acceso a este cliente');
    const t = String(a.p_texto || '').trim(); if(!t) return error('Escribe la nota');
    c.hilo.push(linea('nota', t, {}, yo.nombre)); gestion(c, yo); return null;
  },
  cliente_contacto(m, yo, a){
    const c = visibles(m, yo).find((x) => x.id === Number(a.p_cliente)); if(!c) return error('No tienes acceso a este cliente');
    c.hilo.push(linea('contacto', a.p_motivo, { canal: a.p_canal, motivo: a.p_motivo }, yo.nombre)); gestion(c, yo);
    if(a.p_motivo === 'pedir' && c.estatus === 'grandes_negocios') ponerEstatus(c, 'documentos_solicitados', yo, 'auto');
    return c.estatus;
  },
  cliente_estatus(m, yo, a){
    if(!['admin', 'abogado'].includes(yo.rol)) return error('No tienes permiso para hacer esto');
    const c = visibles(m, yo).find((x) => x.id === Number(a.p_cliente)); if(!c) return error('No tienes acceso a este cliente');
    if(ponerEstatus(c, a.p_estatus, yo, 'manual')) gestion(c, yo); return null;
  },
  cliente_dato(m, yo, a){
    const c = visibles(m, yo).find((x) => x.id === Number(a.p_cliente)); if(!c) return error('No tienes acceso a este cliente');
    const v = String(a.p_valor || '').trim() || null;
    if(a.p_campo === 'correo_empresa'){ if(v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return error('Ese correo no parece válido'); c.correo_empresa = v ? v.toLowerCase() : null; }
    else if(a.p_campo === 'regimen_firma'){ if(!['admin', 'abogado'].includes(yo.rol)) return error('No tienes permiso para hacer esto'); c.regimen_firma = v; }
    else if(a.p_campo === 'es_isp'){ if(!['admin', 'abogado'].includes(yo.rol)) return error('No tienes permiso para hacer esto'); c.es_isp = v === 'true'; }
    else if(a.p_campo === 'es_top'){ if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto'); c.es_top = v === 'true'; }
    else return error('Ese dato no se puede cambiar aquí');
    c.hilo.push(linea('dato', a.p_campo, { valor: v }, yo.nombre)); recalcular(c, yo); return null;
  },
  cliente_representante(m, yo, a){
    const c = visibles(m, yo).find((x) => x.id === Number(a.p_cliente)); if(!c) return error('No tienes acceso a este cliente');
    const co = String(a.p_correo || '').trim().toLowerCase() || null; const te = String(a.p_telefono || '').trim() || null;
    if(a.p_orden > 1 && !c.representantes.some((r) => r.orden === a.p_orden - 1)) return error('Agrega primero el representante anterior');
    if(co && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(co)) return error('Ese correo no parece válido');
    if(te && (te.replace(/\D/g, '').length < 7 || te.replace(/\D/g, '').length > 15)) return error('Ese teléfono no parece válido');
    let r = c.representantes.find((x) => x.orden === a.p_orden); if(!r){ r = { orden: a.p_orden, nombre: null }; c.representantes.push(r); }
    r.correo = co; r.telefono = te; c.hilo.push(linea('dato', 'representante', { orden: a.p_orden }, yo.nombre)); gestion(c, yo); recalcular(c, yo); return null;
  },
  cliente_gestion(m, yo, a){
    if(!['admin', 'analista'].includes(yo.rol)) return error('No tienes permiso para hacer esto');
    const c = visibles(m, yo).find((x) => x.id === Number(a.p_cliente)); if(!c) return error('No tienes acceso a este cliente');
    c[a.p_cual + '_en'] = a.p_hecho ? hace(0) : null; c[a.p_cual + '_por'] = a.p_hecho ? yo.nombre : null;
    c.hilo.push(linea('gestion', a.p_cual, { hecho: !!a.p_hecho }, yo.nombre)); gestion(c, yo); return null;
  },
  ordenes_buscar(m, yo, a){
    if(!esSenior(yo)) return error('Esto lo hace el Analista Senior o el administrador');
    const x = instPorId(m, a.p_instalacion); if(!x) return error('Esa instalación no existe');
    const t = norm(a.p_texto); const r = [];
    if(x.i.orden && !t) r.push({ id: x.i.orden.id, numero: x.i.orden.numero, titulo: x.i.orden.titulo, creada_en: hace(12), etapa: 'Realizado', creador: x.i.orden.creador || x.c.lider, motivo: null, actual: true });
    if(t){ r.push({ id: 77001, numero: 'PRUEBA-001/477001', titulo: 'Solicitud de Instalación PROMO PYME ' + a.p_texto, creada_en: hace(9), etapa: 'Realizado', creador: 'Rosa Paredes', motivo: null, actual: false });
      r.push({ id: 77002, numero: 'PRUEBA-001/377002', titulo: 'Solicitud vieja de ' + a.p_texto, creada_en: hace(200), etapa: 'Realizado', creador: 'Tomás Guerra', motivo: 'Se creó más de 45 días antes', actual: false }); }
    return r;
  },
  envio_registrar(m, yo, a){
    if(!['admin', 'analista', 'lider'].includes(yo.rol)) return error('No tienes permiso para hacer esto');
    for(const c of visibles(m, yo)){ const sv = c.servicios.find((x) => x.id === Number(a.p_servicio)); if(!sv) continue;
      if(a.p_canal === 'manual' && !['admin', 'analista'].includes(yo.rol)) return error('No tienes permiso para hacer esto');
      if(!(a.p_tipos || []).length) return error('Elige qué se envió');
      if(a.p_tipos.includes('bienvenida') && !cartaDe(m, c, sv).puede) return error('La carta de bienvenida sale cuando la instalación tenga dueño');
      sv.envios = sv.envios || []; a.p_tipos.forEach((t) => sv.envios.push({ tipo: t, en: hace(0), por: yo.nombre, canal: a.p_canal }));
      c.hilo.push(linea('gestion', a.p_tipos.length > 1 ? 'ambas' : a.p_tipos[0], { hecho: true, canal: a.p_canal, codigo: sv.sucursal + '-' + sv.codigo }, yo.nombre)); gestion(c, yo); return null; }
    return error('Ese servicio no existe');
  },
  bienvenidas_pendientes(m, yo){ if(!['admin', 'analista', 'lider'].includes(yo.rol)) return error('No tienes permiso para hacer esto'); return bienvenidasFilas(m, yo); },
  servicio_ip(m, yo, a){
    if(!['admin', 'analista'].includes(yo.rol)) return error('No tienes permiso para hacer esto');
    for(const c of m.datos.clientes){ const sv = c.servicios.find((x) => x.id === Number(a.p_servicio)); if(!sv) continue;
      const v4 = String(a.p_ip || '').trim() || null; const v6 = String(a.p_ip6 || '').trim().toLowerCase() || null;
      if(v4 && !/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(v4)) return error('La IPv4 no parece válida. Ejemplo: 190.124.30.15');
      if(v6 && (!/^[0-9a-f:]{2,39}(\/\d{1,3})?$/.test(v6) || !v6.includes(':'))) return error('La IPv6 no parece válida. Ejemplo: 2803:1a00:10::1');
      sv.ip = v4; sv.ip6 = v6; c.hilo.push(linea('dato', 'ip', { codigo: sv.sucursal + '-' + sv.codigo, ip: v4, ip6: v6 }, yo.nombre)); return null; }
    return error('Ese servicio no existe');
  },
  instalacion_asignar(m, yo, a){
    if(!esSenior(yo)) return error('Esto lo hace el Analista Senior o el administrador');
    const x = instPorId(m, a.p_instalacion); if(!x) return error('Esa instalación no existe');
    const dueno = DUENOS.find((n) => norm(n) === norm(a.p_dueno)); if(!a.p_dueno) return error('Elige a quién pertenece'); if(!dueno) return error('Ese nombre no está en la lista de líderes');
    if(a.p_orden === 77002) return error('Esa orden no sirve. Se creó más de 45 días antes');
    const i = x.i;
    if(a.p_orden === null || a.p_orden === undefined){ i.orden = null; i.cruce = 'manual'; }
    else if(!i.orden || i.orden.id !== a.p_orden){ i.orden = { id: a.p_orden, numero: 'PRUEBA-001/4' + a.p_orden, titulo: 'Orden elegida a mano', creador: dueno }; i.cruce = 'manual'; }
    i.confirmada = true; i.manual = true; i.dueno = dueno;
    x.c.hilo.push(linea('instalacion', 'asignada', { dueno, orden: i.orden ? i.orden.numero : null }, yo.nombre)); return null;
  },
  instalacion_excepcion(m, yo, a){
    if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto');
    const x = instPorId(m, a.p_instalacion); if(!x) return error('Esa instalación no existe');
    const mot = String(a.p_motivo || '').trim();
    if(!mot){ x.i.excepcion_corte = null; x.i.excepcion_motivo = null; x.i.excepcion_por = null; x.c.hilo.push(linea('instalacion', 'excepcion_quitada', {}, yo.nombre)); return null; }
    if(mot.length < 5) return error('Escribe el motivo de la excepción');
    const c = String(a.p_corte).slice(0, 8) + '01'; if((m.certificados || {})[c]) return error('Ese corte ya está certificado');
    x.i.excepcion_corte = c; x.i.excepcion_motivo = mot; x.i.excepcion_por = yo.nombre; x.c.hilo.push(linea('instalacion', 'excepcion', { motivo: mot, corte: c }, yo.nombre)); return null;
  },
  corte_certificar(m, yo, a){
    if(!esSenior(yo)) return error('Esto lo hace el Analista Senior o el administrador');
    const c = String(a.p_corte).slice(0, 8) + '01'; m.certificados = m.certificados || {};
    if(hoy() < corteFin(c)) return error('Este corte se certifica desde el día 20');
    if(m.certificados[c]) return error('Ese corte ya está certificado');
    const admin = m.personas.find((p) => p.rol === 'admin'); const filas = filasComision(m, admin, c);
    m.certificados[c] = { en: hace(0), por: yo.nombre, total: filas.length, cumplen: filas.filter((f) => f.cumple).length, filas };
    return { total: filas.length, cumplen: m.certificados[c].cumplen };
  },
  corte_descertificar(m, yo, a){
    if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto');
    const c = String(a.p_corte).slice(0, 8) + '01'; if(!(m.certificados || {})[c]) return error('Ese corte no está certificado');
    delete m.certificados[c]; return null;
  },
  instalacion_pago(m, yo, a){
    if(!esSenior(yo)) return error('Esto lo hace el Analista Senior o el administrador');
    for(const c of m.datos.clientes){ const i = c.instalaciones.find((x) => x.id === Number(a.p_instalacion));
      if(i){ i.pago_ok_en = a.p_pagada ? (i.pago_ok_en || hace(0)) : null; i.pago_manual = true; c.hilo.push(linea('pago', a.p_pagada ? 'pagada' : 'pendiente', {}, yo.nombre)); return null; } }
    return error('Esa instalación no existe');
  },
  drive_carpeta_info(m, yo, a){
    const c = visibles(m, yo).find((x) => x.id === Number(a.p_cliente)); if(!c) return error('No tienes acceso a este cliente');
    if(yo.rol !== 'admin') return null;
    const k = m.datos.carpetas[c.id]; const ult = Object.values(m.datos.subidas).filter((x) => x.cliente === c.id).pop();
    return { url: k ? 'https://drive.google.com/drive/folders/' + k.id : null, creada_por_app: !!(k && !k.vieja), creada_en: k && k.creada_en || null, creada_por: k && k.creada_por || null, ultima_en: ult ? ult.en : null, ultima_por: ult ? ult.quien : null };
  },
  documentos_registrar(m, yo, a){
    const c = visibles(m, yo).find((x) => x.id === Number(a.p_cliente)); if(!c) return error('No tienes acceso a este cliente');
    const items = a.p_items || []; if(!items.length) return error('No llegó ningún archivo');
    let n = 0; const etiquetas = [];
    for(const it of items){
      if(!(it.casillas || []).length) return error('Marca qué trae cada archivo');
      // Solo acepta lo que drive_subir dejó en Drive para ese cliente y ese usuario
      for(const ar of it.archivos){ const s = m.datos.subidas[ar.drive_id]; if(!s || s.cliente !== c.id || s.usuario !== yo.id) return error('El archivo no terminó de subir. Intenta de nuevo'); }
      const archivos = it.archivos.map((ar) => { const s = m.datos.subidas[ar.drive_id]; return { id: ++sec, ruta: null, drive_id: ar.drive_id, url_externa: 'https://drive.google.com/file/d/' + ar.drive_id + '/view', nombre: s.nombre, mime: s.mime, tamano: s.tamano }; });
      for(const ca of it.casillas){
        let num = Number(ca.numero || 0);
        if(/^contrato_/.test(ca.casilla) && !['admin', 'abogado'].includes(yo.rol)) return error('El contrato lo sube Legal');
        if(ca.casilla === 'otro') num = c.documentos.filter((d) => d.casilla === 'otro').length + 1;
        else if(!['cedula', 'rif_personal', 'acta_asamblea'].includes(ca.casilla)) num = 0;
        let d = busca(c, ca.casilla, num);
        if(!d){ d = { id: ++sec, casilla: ca.casilla, numero: num }; c.documentos.push(d); }
        Object.assign(d, { estado: 'por_revisar', motivo: null, nota: null, vence_en: it.vence_en || null, firmado_en: it.firmado_en || null, subido_en: hace(0), subido_por: yo.nombre, revisado_en: null, revisado_por: null, archivos, comparte: [] });
        etiquetas.push({ casilla: ca.casilla, numero: num }); n++;
      }
      if(it.casillas.length > 1) it.casillas.forEach((ca) => { const d = c.documentos.find((x) => x.archivos === archivos && x.casilla === ca.casilla); if(d) d.comparte = c.documentos.filter((x) => x.archivos === archivos && x !== d).map((x) => ({ casilla: x.casilla, numero: x.numero })); });
    }
    c.hilo.push(linea('documento_subido', String(n), { casillas: etiquetas }, yo.nombre)); gestion(c, yo); recalcular(c, yo); return n;
  },
  documento_revisar(m, yo, a){
    if(!['admin', 'abogado'].includes(yo.rol)) return error('No tienes permiso para hacer esto');
    for(const c of m.datos.clientes){ const d = c.documentos.find((x) => x.id === Number(a.p_documento)); if(!d) continue;
      const nt = String(a.p_nota || '').trim() || null;
      if(a.p_accion === 'aprobar'){ Object.assign(d, { estado: 'aprobado', motivo: null, nota: null, vence_en: a.p_vence || d.vence_en, revisado_por: yo.nombre, revisado_en: hace(0) }); c.hilo.push(linea('documento_aprobado', d.casilla, { casilla: d.casilla, numero: d.numero }, yo.nombre)); }
      else { if(!a.p_motivo) return error('Elige por qué lo devuelves'); if(a.p_motivo === 'otro' && !nt) return error('Escribe el motivo en la nota');
        Object.assign(d, { estado: 'devuelto', motivo: a.p_motivo, nota: nt, revisado_por: yo.nombre, revisado_en: hace(0) }); c.hilo.push(linea('documento_devuelto', d.casilla, { casilla: d.casilla, numero: d.numero, motivo: a.p_motivo, nota: nt }, yo.nombre)); }
      gestion(c, yo); recalcular(c, yo); return null; }
    return error('Ese documento ya no existe');
  },
  tad_iniciar(m, yo, a){
    if(!['admin', 'analista'].includes(yo.rol)) return error('No tienes permiso para hacer esto');
    m.cargas = m.cargas || []; const c = { id: m.cargas.length + 1, fuente: 'tad', archivo: a.p_archivo, en: new Date().toISOString(), por: yo.nombre, estado: 'procesando', filas: a.p_total, resumen: { clientes_nuevos: 0, servicios_nuevos: 0, servicios_actualizados: 0, invalidas: 0 }, vistas: [] };
    m.cargas.push(c); return c.id;
  },
  tad_filas(m, yo, a){
    if(!['admin', 'analista'].includes(yo.rol)) return error('No tienes permiso para hacer esto');
    const c = (m.cargas || []).find((x) => x.id === a.p_carga && x.estado === 'procesando'); if(!c) return error('Esta carga ya se cerró. Vuelve a empezar');
    (a.p_filas || []).forEach((f) => {
      const doc = String(f.d || '').replace(/\D/g, '').replace(/^0+/, ''); if(!/^[1-9][0-9]{4,9}$/.test(doc) || !f.n){ c.resumen.invalidas++; return; }
      let cl = m.datos.clientes.find((x) => x.doc_numero === doc);
      if(!cl){ cl = cliente({ nombre: f.n, doc_tipo: f.t || 'J', doc_numero: doc, lider: null, es_natural: ['V', 'E'].includes(f.t) }); m.datos.clientes.push(cl); c.resumen.clientes_nuevos++; }
      const cod = String(f.c).replace(/\D/g, '').padStart(8, '0'); const suc = String(f.s).replace(/\D/g, '').padStart(3, '0');
      const sv = cl.servicios.find((x) => x.codigo === cod || x.codigo === String(Number(cod)));
      if(sv){ sv.estado = f.es; sv.con_deuda = f.cx === 'SI'; c.resumen.servicios_actualizados++; }
      else { cl.servicios.push(servicio(cod, { sucursal: suc, plan: f.p, categoria: f.ca, estado: f.es, equipo: f.e, con_deuda: f.cx === 'SI' })); c.resumen.servicios_nuevos++; }
      c.vistas.push(cl.id);
    });
    return c.resumen;
  },
  tad_contactos(m, yo, a){ const c = (m.cargas || []).find((x) => x.id === a.p_carga && x.estado === 'procesando'); if(!c) return error('Esta carga ya se cerró. Vuelve a empezar'); c.contactos = (c.contactos || 0) + a.p_filas.length; return a.p_filas.length; },
  tad_cerrar(m, yo, a){
    const c = (m.cargas || []).find((x) => x.id === a.p_carga && x.estado === 'procesando'); if(!c) return error('Esta carga ya se cerró');
    c.estado = c.resumen.invalidas ? 'con_errores' : 'lista';
    return Object.assign({}, c.resumen, { pagos_marcados: 0, clientes_total: m.datos.clientes.length, filas: c.filas });
  },
  crudo_iniciar(m, yo, a){
    if(!['admin', 'analista'].includes(yo.rol)) return error('No tienes permiso para hacer esto');
    if(!['odoo', 'instalaciones', 'base_vieja'].includes(a.p_fuente)) return error('Tipo de archivo no reconocido');
    m.cargas = m.cargas || []; const c = { id: m.cargas.length + 1, fuente: a.p_fuente, archivo: a.p_archivo, en: new Date().toISOString(), por: yo.nombre, estado: 'procesando', filas: a.p_total, resumen: {}, crudas: [] };
    m.cargas.push(c); return c.id;
  },
  crudo_filas(m, yo, a){
    const c = (m.cargas || []).find((x) => x.id === a.p_carga && x.estado === 'procesando'); if(!c) return error('Esta carga ya no está abierta');
    if((a.p_filas || []).length > 500) return error('Lote no válido');
    c.crudas = c.crudas.concat(a.p_filas); return a.p_filas.length;
  },
  crudo_cerrar(m, yo, a){
    const c = (m.cargas || []).find((x) => x.id === a.p_carga && x.estado === 'procesando'); if(!c) return error('Esta carga ya no está abierta');
    c.estado = 'lista'; return { guardadas: c.crudas.length, total: c.filas };
  },
  clientes_rifs(m, yo){ return m.datos.clientes.map((c) => c.doc_numero); },
  cruce_probar(m, yo){ return cruceFalso(m, yo); },
  cruce_aplicar(m, yo){ const r = cruceFalso(m, yo); if(!r.error) m.cruceAplicado = true; return r; },
  cargas_ultimas(m, yo){
    if(!['admin', 'analista'].includes(yo.rol)) return error('No tienes permiso para hacer esto');
    return (m.cargas || []).filter((c) => c.estado !== 'procesando').slice().reverse();
  },
  pendientes_lider(m, yo, a){
    if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto');
    const actual = corteDe(hoy()); const filas = filasComision(m, yo, actual).filter((f) => f.lider === a.p_lider);
    if(!filas.length) return error('Ese líder no tiene instalaciones en este corte');
    const txt = (x) => (x.k === 'cedula' || x.k === 'rif_personal') && x.n > 1 ? x.t + ' del representante ' + x.n : x.t;
    const p = m.personas.find((x) => x.activo && norm(x.nombre) === norm(a.p_lider));
    const ult = (m.bitacora || []).filter((b) => b.accion === 'pendientes_enviados' && b.registro_id === a.p_lider).pop();
    return { lider: a.p_lider, nombre: p ? p.nombre : a.p_lider, whatsapp: p ? p.whatsapp || null : null, corte: actual, fin: corteFin(actual), dias: dias(hoy(), corteFin(actual)), ultimo: ult ? ult.en : null,
      filas: filas.slice().sort((x, y) => (x.origen === 'corte') - (y.origen === 'corte') || x.instalada_en.localeCompare(y.instalada_en)).map((f) => {
        const c = m.datos.clientes.find((x) => x.id === f.cliente_id); const fl = faltantes(c);
        return { instalacion_id: f.instalacion_id, cliente_id: f.cliente_id, nombre: f.nombre, codigo: f.codigo, origen: f.origen, cumple: f.cumple, orden_ok: f.orden_ok, legal_ok: f.legal_ok, pago_ok: f.pago_ok,
          falta: fl.filter((x) => x.e === 'falta').map(txt), devuelto: fl.filter((x) => x.e === 'devuelto').map(txt) };
      }) };
  },
  pendientes_enviados(m, yo, a){
    if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto');
    (m.bitacora = m.bitacora || []).push({ usuario: yo.usuario, accion: 'pendientes_enviados', registro_id: a.p_lider, despues: { pendientes: a.p_pendientes, pdf: a.p_pdf }, en: new Date().toISOString() });
  },
  comisiones_corte(m, yo, a){
    if(yo.rol === 'aliado') return error('No tienes permiso para hacer esto');
    const actual = corteDe(hoy()); let c = a.p_corte ? String(a.p_corte).slice(0, 8) + '01' : actual; if(c > actual) c = actual;
    const filas = filasComision(m, yo, c);
    const pinst = c === actual ? visibles(m, yo).filter((x) => x.orden && porInstalar(x)).map((x) => ({ orden: x.orden.numero, cliente_id: x.id, nombre: x.nombre, creada_en: x.orden.creada_en, etapa: x.orden.etapa, lider: x.lider })) : [];
    const comp = [5, 4, 3, 2, 1, 0].map((n) => { const k = masMeses(actual, -n); const f = filasComision(m, yo, k); return { corte: k, total: f.filter((x) => x.origen === 'corte').length, cumplen: f.filter((x) => x.cumple).length }; });
    const cuenta = (lista) => lista.filter((x) => x.origen === 'corte').reduce((o, x) => { o[x.lider] = (o[x.lider] || 0) + 1; return o; }, {});
    const A = cuenta(filas), B = cuenta(filasComision(m, yo, masMeses(c, -1)));
    const lideres = Array.from(new Set(Object.keys(A).concat(Object.keys(B)))).map((l) => ({ lider: l, actual: A[l] || 0, anterior: B[l] || 0 })).sort((x, y) => y.actual - x.actual || x.lider.localeCompare(y.lider));
    const cert = (m.certificados || {})[c]; const sen = esSenior(yo);
    return { corte: c, actual, hoy: hoy(), inicio: corteInicio(c), fin: corteFin(c), dias: dias(hoy(), corteFin(c)), rol: yo.rol, filas, por_instalar: pinst, comparativa: comp, lideres,
      duenos: sen ? DUENOS : [], certificado: cert ? { en: cert.en, por: cert.por, total: cert.total, cumplen: cert.cumplen } : null,
      puedo: { asignar: sen && !cert, pago: sen, excepcion: yo.rol === 'admin' && !cert, certificar: sen && !cert && hoy() >= corteFin(c), quitar_certificado: yo.rol === 'admin' && !!cert } };
  }
};

// ---------- Factibilidad: las mismas reglas del servidor en pequeño ----------
function medir(lng, lat, z){
  const kx = 111320 * Math.cos(lat * Math.PI / 180), ky = 110540; let dentro = false, d = Infinity; const n = z.lngs.length;
  for(let i = 0, j = n - 1; i < n; j = i++){
    const xi = (z.lngs[i] - lng) * kx, yi = (z.lats[i] - lat) * ky, xj = (z.lngs[j] - lng) * kx, yj = (z.lats[j] - lat) * ky;
    if((yi > 0) !== (yj > 0) && 0 < (xj - xi) * (0 - yi) / (yj - yi) + xi) dentro = !dentro;
    const dx = xj - xi, dy = yj - yi; const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, -(xi * dx + yi * dy) / (dx * dx + dy * dy)));
    d = Math.min(d, Math.hypot(xi + t * dx, yi + t * dy));
  }
  return { dentro, d };
}
function evaluar(m, lat, lng, tipo, mapaId){
  let dOp = Infinity, cerca = null, dOpZ = null, dDis = null;
  m.zonas.filter((z) => z.mapa_id === mapaId).forEach((z) => {
    const r = medir(lng, lat, z);
    if(z.operativa){ if(r.dentro && (!dOpZ || (dOpZ.exclusividad !== 'liberada' && z.exclusividad === 'liberada'))) dOpZ = z; if(!r.dentro && r.d < dOp){ dOp = r.d; cerca = z; } }
    else if(r.dentro && !dDis) dDis = z;
  });
  let res, z, dist;
  if(dOpZ){ res = 'hay_red'; z = dOpZ; dist = 0; }
  else if(dDis){ res = (tipo === 'dedicado' && dOp < 2000) || (tipo === 'pyme' && dOp < 400) ? 'excepcion' : 'espera'; z = res === 'excepcion' ? cerca : dDis; dist = dOp; }
  else if(tipo === 'pyme'){ res = dOp < 400 ? 'excepcion' : dOp <= 2000 ? 'espera' : 'sin_red'; z = cerca; dist = dOp; }
  else { res = dOp <= 2000 ? 'excepcion' : 'sin_red'; z = cerca; dist = dOp; }
  z = z || {};
  return { resultado: res, zona_id: z.id || null, mdt: z.mdt || null, estado: z.estado || null, capacidad: z.capacidad || null, exclusividad: z.exclusividad || null, aliado: z.aliado || null, ciudad: z.ciudad || null, distancia_m: isFinite(dist) ? Math.round(dist) : null };
}
const vigente = (m) => (m.mapas || []).filter((x) => x.estado === 'vigente').pop();
function detalleFact(m, yo, c){
  const mp = m.mapas.find((x) => x.id === c.mapa_id) || {}; const p = m.personas.find((x) => x.id === c.lider_id) || {};
  return Object.assign({}, c, { lider: p.nombre, lider_codigo: p.codigo_vendedor || null, mio: c.lider_id === yo.id, puedo_editar: c.lider_id === yo.id || yo.rol === 'admin',
    mapa: { id: mp.id, fecha: mp.fecha_mapa, vigente: mp.estado === 'vigente' },
    historial: m.hist.filter((h) => h.consulta_id === c.id).map((h) => Object.assign({ fecha_mapa: (m.mapas.find((x) => x.id === h.mapa_id) || {}).fecha_mapa }, h)).reverse() });
}
function consultaDe(m, yo, id, editar){
  if(!['admin', 'analista', 'lider'].includes(yo.rol)) return { e: error('No tienes permiso para hacer esto') };
  const c = (m.consultas || []).find((x) => x.id === Number(id)); if(!c) return { e: error('Esa consulta no existe') };
  if(c.lider_id !== yo.id && (yo.rol === 'lider' || (editar && yo.rol !== 'admin'))) return { e: error('No tienes acceso a esta consulta') };
  return { c };
}
function iniciarFact(m){ m.mapas = m.mapas || []; m.zonas = m.zonas || []; m.consultas = m.consultas || []; m.hist = m.hist || []; m.secF = m.secF || 70000; }
const RPC_FACT = {
  mapa_actual(m, yo){ iniciarFact(m); if(!['admin', 'analista', 'lider'].includes(yo.rol)) return error('No tienes permiso para hacer esto'); const v = vigente(m); return v ? { id: v.id, fecha: v.fecha_mapa, zonas: v.poligonos, puntos: v.puntos, reparto: v.reparto, resumen: v.resumen } : null; },
  mapa_iniciar(m, yo, a){ iniciarFact(m); if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto'); m.mapas.forEach((x) => { if(x.estado === 'cargando') x.estado = 'fallido'; });
    const x = { id: ++m.secF, fecha_mapa: a.p_fecha, archivo: a.p_archivo, poligonos: a.p_poligonos, puntos: a.p_puntos, estado: 'cargando', reparto: {} }; m.mapas.push(x); return x.id; },
  mapa_zonas(m, yo, a){ iniciarFact(m); if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto');
    const mp = m.mapas.find((x) => x.id === a.p_mapa); if(!mp || mp.estado !== 'cargando') return error('Esa carga ya no está abierta. Vuelve a subir el mapa');
    if(m.fallaZonas){ m.fallaZonas--; return error('Se cortó la conexión'); }
    let n = 0; a.p_filas.forEach((f) => { if(!['liberado', 'exclusiva', 'diseno', 'construccion', 'permiso_vgt'].includes(f.e) || f.lng.length < 3) return; n++;
      m.zonas.push({ id: ++m.secF, mapa_id: mp.id, mdt: f.m, nombre: f.n, estado: f.e, operativa: f.e === 'liberado' || f.e === 'exclusiva', exclusividad: f.x || 'liberada', aliado: f.x === 'aliado' ? f.a : null, capacidad: f.c ? Number(f.c) : null, ciudad: f.ci, lngs: f.lng, lats: f.lat, punto: f.p ? [f.p[1], f.p[0]] : null }); });
    (m.lotesMapa = m.lotesMapa || []).push(a.p_filas); return n; },
  mapa_cerrar(m, yo, a){ iniciarFact(m); if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto');
    const mp = m.mapas.find((x) => x.id === a.p_mapa); if(!mp || mp.estado !== 'cargando') return error('Esa carga ya no está abierta. Vuelve a subir el mapa');
    const zs = m.zonas.filter((z) => z.mapa_id === mp.id); if(zs.length < mp.poligonos * 0.98) return error('La carga quedó incompleta. Vuelve a subir el mapa');
    const ant = vigente(m); const rep = {}; zs.forEach((z) => { rep[z.estado] = (rep[z.estado] || 0) + 1; });
    const est = (id) => { const o = {}; m.zonas.filter((z) => z.mapa_id === id).forEach((z) => { o[z.mdt] = z.estado; }); return o; };
    const N = est(mp.id), V = ant ? est(ant.id) : {}; const op = (e) => e === 'liberado' || e === 'exclusiva';
    const ej = Object.keys(N).filter((k) => V[k] && V[k] !== N[k]).map((k) => ({ mdt: k, de: V[k], a: N[k] }));
    m.mapas.forEach((x) => { if(x.estado === 'vigente') x.estado = 'anterior'; }); mp.estado = 'vigente'; mp.reparto = rep; mp.poligonos = zs.length;
    let rev = 0, cam = 0, red = 0;
    m.consultas.filter((c) => c.seguimiento === 'abierta').forEach((c) => { rev++; const x = evaluar(m, c.lat, c.lng, c.tipo, mp.id);
      if(x.resultado !== c.resultado){ cam++; if(x.resultado === 'hay_red') red++; Object.assign(c, { anterior: c.resultado, resultado: x.resultado, cambio_en: new Date().toISOString(), visto: false });
        m.hist.push({ id: ++m.secF, consulta_id: c.id, mapa_id: mp.id, resultado: x.resultado, mdt: x.mdt, distancia_m: x.distancia_m, en: new Date().toISOString() }); }
      Object.assign(c, { zona_id: x.zona_id, mdt: x.mdt, estado_zona: x.estado, distancia_m: x.distancia_m, capacidad: x.capacidad, exclusividad: x.exclusividad, aliado: x.aliado, ciudad: x.ciudad, mapa_id: mp.id }); });
    mp.resumen = { mapa: mp.id, fecha: mp.fecha_mapa, zonas: zs.length, puntos: mp.puntos, reparto: rep, primero: !ant, cambios: { nuevas: Object.keys(N).filter((k) => !V[k]).length, quitadas: Object.keys(V).filter((k) => !N[k]).length,
      cambio_estado: ej.length, ahora_operativas: ej.filter((x) => op(x.a) && !op(x.de)).length, ejemplos: ej }, consultas: { revisadas: rev, cambiaron: cam, con_red: red } };
    (m.bitacora = m.bitacora || []).push({ usuario: yo.usuario, accion: 'mapa_red_subido', registro_id: String(mp.id), en: new Date().toISOString() });
    return mp.resumen; },
  fact_consultar(m, yo, a){ iniciarFact(m); if(!['admin', 'analista', 'lider'].includes(yo.rol)) return error('No tienes permiso para hacer esto');
    const mp = vigente(m); if(!mp) return error('Todavía no hay mapa de red. Pide al administrador que lo suba en Actualizar');
    if(!['pyme', 'dedicado'].includes(a.p_tipo)) return error('Elige si es PYME o Dedicado');
    const x = evaluar(m, a.p_lat, a.p_lng, a.p_tipo, mp.id);
    const c = { id: ++m.secF, lider_id: yo.id, creada_en: new Date().toISOString(), lat: a.p_lat, lng: a.p_lng, enlace: a.p_enlace || null, tipo: a.p_tipo, resultado: x.resultado, zona_id: x.zona_id, mdt: x.mdt, estado_zona: x.estado,
      distancia_m: x.distancia_m, capacidad: x.capacidad, exclusividad: x.exclusividad, aliado: x.aliado, ciudad: x.ciudad, nombre: null, telefono: null, rif_tipo: null, rif: null, seguimiento: 'abierta', mapa_id: mp.id, anterior: null, cambio_en: null, visto: true };
    m.consultas.push(c); m.hist.push({ id: ++m.secF, consulta_id: c.id, mapa_id: mp.id, resultado: x.resultado, mdt: x.mdt, distancia_m: x.distancia_m, en: c.creada_en });
    return detalleFact(m, yo, c); },
  fact_detalle(m, yo, a){ iniciarFact(m); const r = consultaDe(m, yo, a.p_id); return r.e || detalleFact(m, yo, r.c); },
  fact_cercanas(m, yo, a){ iniciarFact(m); const mp = vigente(m); if(!mp) return { zonas: [] };
    return { mapa: { id: mp.id, fecha: mp.fecha_mapa }, zonas: m.zonas.filter((z) => z.mapa_id === mp.id).map((z) => { const r = medir(a.p_lng, a.p_lat, z);
      return { id: z.id, mdt: z.mdt, estado: z.estado, operativa: z.operativa, exclusividad: z.exclusividad, aliado: z.aliado, capacidad: z.capacidad, ciudad: z.ciudad, punto: z.punto, dentro: r.dentro, distancia_m: Math.round(r.d), forma: z.lats.map((la, i) => [la, z.lngs[i]]) }; })
      .filter((z) => z.dentro || z.distancia_m <= 2000).sort((x, y) => (x.dentro ? 0 : x.distancia_m) - (y.dentro ? 0 : y.distancia_m)) }; },
  fact_lista(m, yo, a){ iniciarFact(m); if(!['admin', 'analista', 'lider'].includes(yo.rol)) return error('No tienes permiso para hacer esto');
    const mias = m.consultas.filter((c) => yo.rol !== 'lider' || c.lider_id === yo.id); const conRed = (c) => c.seguimiento === 'abierta' && c.resultado === 'hay_red' && c.anterior && c.anterior !== 'hay_red' && !c.visto;
    const f = a.p_filtro || 'abiertas'; const pasa = (c) => f === 'con_red' ? conRed(c) : f === 'espera' ? c.seguimiento === 'abierta' && c.resultado === 'espera' : f === 'excepcion' ? c.seguimiento === 'abierta' && c.resultado === 'excepcion' : f === 'cerradas' ? c.seguimiento !== 'abierta' : c.seguimiento === 'abierta';
    const filt = mias.filter(pasa).sort((x, y) => (x.visto - y.visto) || y.creada_en.localeCompare(x.creada_en)); const mp = vigente(m);
    return { rol: yo.rol, mapa: mp ? { fecha: mp.fecha_mapa, zonas: mp.poligonos } : null, total: filt.length,
      conteos: { con_red: mias.filter(conRed).length, abiertas: mias.filter((c) => c.seguimiento === 'abierta').length, espera: mias.filter((c) => c.seguimiento === 'abierta' && c.resultado === 'espera').length, excepcion: mias.filter((c) => c.seguimiento === 'abierta' && c.resultado === 'excepcion').length, cerradas: mias.filter((c) => c.seguimiento !== 'abierta').length },
      filas: filt.slice(a.p_desde || 0, (a.p_desde || 0) + (a.p_limite || 30)).map((c) => ({ id: c.id, creada_en: c.creada_en, resultado: c.resultado, anterior: c.anterior, nuevo: !c.visto, mdt: c.mdt, distancia_m: c.distancia_m, tipo: c.tipo, nombre: c.nombre, ciudad: c.ciudad, seguimiento: c.seguimiento, exclusividad: c.exclusividad, aliado: c.aliado, lider: yo.rol !== 'lider' ? (m.personas.find((p) => p.id === c.lider_id) || {}).nombre : null })) }; },
  fact_datos(m, yo, a){ iniciarFact(m); const r = consultaDe(m, yo, a.p_id, true); if(r.e) return r.e;
    const rif = String(a.p_rif || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); const tel = String(a.p_telefono || '').replace(/\D/g, '');
    if(rif && !/^[JGVEP]?\d{5,10}$/.test(rif)) return error('Ese RIF no parece válido');
    if(tel && (tel.length < 10 || tel.length > 15)) return error('Ese teléfono no parece válido');
    Object.assign(r.c, { nombre: String(a.p_nombre || '').replace(/\s+/g, ' ').trim() || null, telefono: tel || null, rif_tipo: rif ? (/^\d/.test(rif) ? 'J' : rif[0]) : null, rif: rif ? rif.replace(/\D/g, '') : null }); },
  fact_seguimiento(m, yo, a){ iniciarFact(m); const r = consultaDe(m, yo, a.p_id, true); if(r.e) return r.e; if(!['abierta', 'vendida', 'no_interesa'].includes(a.p_estado)) return error('Estado no válido');
    r.c.seguimiento = a.p_estado; r.c.visto = true; (m.bitacora = m.bitacora || []).push({ usuario: yo.usuario, accion: 'factibilidad_seguimiento', registro_id: String(r.c.id), despues: { seguimiento: a.p_estado } }); },
  fact_visto(m, yo, a){ iniciarFact(m); const r = consultaDe(m, yo, a.p_id); if(r.e) return r.e; if(r.c.lider_id === yo.id) r.c.visto = true; }
};
Object.assign(RPC, RPC_FACT);

// Lo mismo que public.archivo_drive: el archivo solo sale si quien lo pide puede ver al cliente
// La función drive_subir: carpeta "RIF - NOMBRE" que se crea sola con el primer documento y subcarpeta por tipo de servicio
const SUBCARPETA = { 'PYME': 'PYMES', 'Dedicado ISP': 'DEDICADO ISP', 'Dedicado corporativo': 'DEDICADO CORPORATIVO', 'Natural': 'PERSONA NATURAL' };
function driveSubir(m, yo, cliente, nombre, mime, tamano){
  const c = visibles(m, yo).find((x) => x.id === Number(cliente)); if(!c) return { error: 'No tienes acceso a este cliente', status: 403 };
  if(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].indexOf(mime) < 0) return { error: 'Solo se aceptan fotos y PDF', status: 415 };
  const seg = segmento(c); const sub = SUBCARPETA[seg] || (seg === 'PYME + Dedicado' ? (c.es_isp ? 'DEDICADO ISP + PYME' : 'DEDICADO CORPORATIVO + PYME') : 'PYMES');
  let k = m.datos.carpetas[c.id]; const nueva = !k;
  if(!k) k = m.datos.carpetas[c.id] = { nombre: c.doc_numero + ' - ' + String(c.nombre).toUpperCase(), subs: {}, id: 'CARPETANUEVA' + c.id, creada_en: hace(0), creada_por: yo.nombre };
  if(!k.subs[sub]) k.subs[sub] = [];
  const id = 'PRUEBADRIVE' + (++sec) + 'x'; k.subs[sub].push(nombre);
  m.datos.subidas[id] = { cliente: c.id, usuario: yo.id, quien: yo.nombre, en: hace(0), nombre, mime, tamano, carpeta: k.nombre, sub, nueva };
  return { drive_id: id, nombre, mime, tamano };
}
function archivoDrive(m, yo, id){
  for(const c of m.datos.clientes) for(const d of c.documentos) for(const a of d.archivos || []){
    if(a.id !== Number(id)) continue;
    if(!visibles(m, yo).includes(c)) return { error: 'No tienes acceso a este cliente', status: 403 };
    if(!a.drive_id) return { error: 'Ese archivo no está en Drive', status: 404 };
    return { archivo: a };
  }
  return { error: 'Ese archivo no existe', status: 404 };
}
module.exports = { baseDatos, RPC, LUCIA, archivoDrive, driveSubir };
