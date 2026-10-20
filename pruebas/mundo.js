// Base de datos de mentira para las pruebas: clientes, documentos, hilo y comisiones con nombres inventados.
// Repite en pequeño las reglas del servidor para poder probar las pantallas sin tocar la base real.
const LUCIA = '22222222-2222-4222-8222-222222222222';
const DIA = 86400000;
const hace = (dias, horas) => new Date(Date.now() - dias * DIA - (horas || 0) * 3600000).toISOString();

// ----- Corte con regla por vigencia (igual que privado.corte_reglas), hora de Caracas -----
// Hasta septiembre 2026: del 21 al 20. Octubre 2026: del 18 al 17 con el límite movido al 21. Desde noviembre: límite el 18.
// Lote urgente 20/10: desde octubre 2026 el corte se cierra a mano (certificar); el límite es el momento del cierre.
const REGLAS = [['2000-01-01', 21, 20, 20], ['2026-10-01', 18, 21, 21], ['2026-11-01', 18, 18, 19]];
const DESDE_MANUAL = '2026-10-01';
let MUNDO = null;   // el mundo en uso: sus cortes cerrados deciden el corte en curso
const usar = (m) => { MUNDO = m; };
const caracas = (iso) => new Date(new Date(iso).getTime() - 4 * 3600000);
const fechaClave = (d) => d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
let hoyFijo = null;   // las pruebas de bordes fijan el día
const hoy = () => hoyFijo || fechaClave(caracas(new Date().toISOString()));
const regla = (c) => REGLAS.filter((r) => r[0] <= c.slice(0, 8) + '01').slice(-1)[0];
function masMeses(corte, n){ const d = new Date(Date.UTC(Number(corte.slice(0, 4)), Number(corte.slice(5, 7)) - 1 + n, 1)); return fechaClave(d); }
const conDia = (c, d) => c.slice(0, 8) + String(d).padStart(2, '0');
function corteDe(clave){ // AAAA-MM-DD -> AAAA-MM-01 del corte
  const c0 = clave.slice(0, 8) + '01';
  return Number(clave.slice(8, 10)) >= regla(c0)[1] ? masMeses(c0, 1) : c0;
}
const corteInicio = (c) => { const p = masMeses(c, -1); return conDia(p, regla(p)[1]); };
const corteFin = (c) => conDia(c, regla(c)[1] - 1);
const corteLimite = (c) => conDia(c, regla(c)[2]);
const corteCertifica = (c) => conDia(c, regla(c)[3]);
const certDe = (c) => (MUNDO && MUNDO.certificados || {})[c] || null;
const cerrado = (c) => c < DESDE_MANUAL || !!certDe(c);
// Corte en curso: el abierto más viejo desde octubre 2026; si no hay, el del calendario
const enCurso = () => { const cd = corteDe(hoy()); for(let c = DESDE_MANUAL; c <= cd; c = masMeses(c, 1)) if(!cerrado(c)) return c; return cd; };
const cierre = (c) => new Date(Date.UTC(Number(c.slice(0, 4)), Number(c.slice(5, 7)) - 1, regla(c)[1], 4)).getTime(); // inicio del período siguiente, 00:00 de Caracas
const limiteTs = (c) => c < DESDE_MANUAL ? new Date(Date.UTC(Number(c.slice(0, 4)), Number(c.slice(5, 7)) - 1, regla(c)[2] + 1, 4)).getTime() // fin del día límite
  : certDe(c) ? new Date(certDe(c).en).getTime() : Infinity;   // desde octubre 2026: el cierre (abierto, todo cuenta)
const masDias = (c, n) => fechaClave(new Date(Date.UTC(+c.slice(0, 4), +c.slice(5, 7) - 1, +c.slice(8, 10) + n)));
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
  const actual = enCurso(); const dentro = Math.max(1, Math.min(8, dias(corteInicio(actual), hoy())));
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
  // Lote urgente 20/10: un representante agregado solo se pide si tiene algún dato o archivo (sin Legal aprobado)
  if(!c.es_natural && !c.legal_ok_en) for(let i = n + 1; i <= 4; i++){
    const rp = c.representantes.find((x) => x.orden === i) || {};
    const algo = String(rp.nombre || '').trim() || String(rp.correo || '').trim() || String(rp.telefono || '').trim() || c.documentos.some((d) => ['cedula', 'rif_personal'].includes(d.casilla) && d.numero === i && (d.archivos || []).length);
    if(algo) r.push({ casilla: 'cedula', numero: i, texto: 'cédula del representante ' + i }, { casilla: 'rif_personal', numero: i, texto: 'RIF personal del representante ' + i });
  }
  if(!c.es_natural){ r.push({ casilla: 'rif_empresa', numero: 0, texto: 'RIF de la empresa' }, { casilla: 'acta_constitutiva', numero: 0, texto: 'acta constitutiva' }); if(c.es_isp) r.push({ casilla: 'conatel', numero: 0, texto: 'permiso de Conatel' }); }
  return r;
}
const busca = (c, cas, num) => c.documentos.find((d) => d.casilla === cas && d.numero === num);
function faltantes(c){
  const r = [];
  requeridos(c).forEach((q) => { const d = busca(c, q.casilla, q.numero);
    if(!d) r.push({ k: q.casilla, n: q.numero, t: q.texto, e: 'falta' }); else if(d.estado === 'devuelto') r.push({ k: q.casilla, n: q.numero, t: q.texto, e: 'devuelto', m: d.motivo }); });
  const rp = c.representantes.find((x) => x.orden === 1) || {};
  if(c.es_natural || c.contrato_presencial) return r;   // naturales: solo cédula y RIF personal; presencial: sin correos ni teléfono
  if(!String(rp.correo || '').trim()) r.push({ k: 'correo', n: 1, t: 'correo', e: 'falta', dato: true });
  if(!String(rp.telefono || '').trim()) r.push({ k: 'telefono', n: 1, t: 'número de contacto', e: 'falta', dato: true });
  if(!c.es_natural && !String(c.correo_empresa || '').trim()) r.push({ k: 'correo_empresa', n: 0, t: 'correo de la empresa', e: 'falta', dato: true });
  return r;
}
function ponerEstatus(c, nuevo, autor, como){
  if(c.estatus === nuevo) return false;
  // A recibidos solo con todos los archivos (como el servidor)
  if(nuevo === 'documentos_recibidos' && faltanArchivos(c)){ if(como === 'auto' || como === 'migracion') return false; throw new Error('Para pasar a Documentos recibidos deben estar subidos todos los documentos en la app'); }
  const ant = c.estatus; c.estatus = nuevo; c.estatus_desde = hace(0);
  // Lote 3: en revisión cuenta como Legal listo; una baja de un cliente que comisiona en el corte abierto conserva Legal (la pantalla pregunta)
  if(LEGAL_OK.includes(nuevo)){ c.legal_ok_en = c.legal_ok_en || hace(0); if(c.legal_como !== 'excepcion') c.legal_como = 'legal'; }
  else if(nuevo === 'documentos_en_revision'){ if(!c.legal_ok_en){ c.legal_ok_en = hace(0); c.legal_como = 'revision'; } }
  else if(c.legal_ok_en && c.legal_como !== 'excepcion' && !c.abierta){ c.legal_ok_en = null; c.legal_como = null; }
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
  if(c.legal_ok_en && !dev && !LEGAL_OK.includes(nuevo)) nuevo = c.estatus;
  ponerEstatus(c, nuevo, autor, 'auto');
}
const gestion = (c, yo) => { c.ug_en = hace(0); c.ug_por = yo.nombre; };
const porInstalar = (c) => !c.servicios.length && !c.instalaciones.length;
function segmentoFiltro(c){ const s = segmento(c); return s === 'PYME + Dedicado' ? 'Combinado' : s === 'Natural' ? 'PYME' : s; }
// Lote 21/10: un dedicado excluido (dedicados.excluido_en) no cuenta como dedicado
const excluido = (c) => !!(c.dedicado && c.dedicado.excluido_en);
function segmento(c){
  const ded = (!!c.dedicado || c.servicios.some((s) => /(dedicad|conectiv)/.test(norm(s.categoria)))) && !excluido(c); const pyme = c.servicios.some((s) => !/(dedicad|conectiv)/.test(norm(s.categoria))) || excluido(c);
  return ded && pyme ? 'PYME + Dedicado' : ded ? (c.es_isp || (c.dedicado && c.dedicado.tipo === 'isp') ? 'Dedicado ISP' : 'Dedicado corporativo') : c.es_natural ? 'Natural' : 'PYME';
}
const visibles = (m, yo) => m.datos.clientes.filter((c) => !c.unido_a && (['admin', 'abogado', 'analista'].includes(yo.rol) || (yo.rol === 'lider' && (c.lider_id === yo.id || (c.dedicado && c.dedicado.ejecutiva_id === yo.id)))));
// Corrida urgente 14/10: a qué tarjeta de Clientes va cada cliente (como privado.tarjetas_todas); un combinado va a dos
function tarjetaDe(c){
  const ded = (!!c.dedicado || c.servicios.some((s) => /(dedicad|conectiv)/.test(norm(s.categoria)))) && !excluido(c); const pyme = c.servicios.some((s) => !/(dedicad|conectiv)/.test(norm(s.categoria)));
  return { pyme: !ded || pyme, ded: ded ? (c.es_isp || (c.dedicado && c.dedicado.tipo === 'isp') ? 'isp' : 'corporativo') : null };
}
// Lote 21/10: contrato firmado sin archivo o sin vencimiento (como privado.contrato_pendiente)
function contratoPend(c){
  const dp = c.documentos.find((d) => d.casilla === 'contrato_pyme'); const dd = c.documentos.find((d) => d.casilla === 'contrato_dedicado');
  const arch = (d) => !!d && (d.archivos || []).length > 0;
  const py = c.estatus === 'contrato_firmado' && !c.es_natural && ['PYME', 'PYME + Dedicado'].includes(segmento(c));
  const ks = c.dedicado && !excluido(c) ? (c.dedicado.contratos || []).filter((k) => k.estatus === 'firmado') : [];
  if(py && !arch(dp)) return 'sin_archivo';
  if(ks.some((k) => (k.tipo === 'servicio' && !arch(dd)) || (k.tipo !== 'servicio' && k.falta_archivo))) return 'sin_archivo';
  if(py && !dp.vence_en) return 'sin_vence';
  if(ks.some((k) => !k.vence_en)) return 'sin_vence';
  return null;
}
const ultimaEtq = (c) => (c.gestiones || [])[0] || null;
function etiquetar(c, etq, fecha, nota, yo){
  if(!['contactado', 'sin_contacto', 'esperando'].includes(etq)) return error('Etiqueta no reconocida');
  const g = { e: etq, fecha: fecha || hoy(), nota: nota || null, por: yo.nombre, en: hace(0) };
  c.gestiones = [g].concat(c.gestiones || []); c.hilo.push(linea('dato', 'etiqueta', { etiqueta: etq, fecha: g.fecha, nota: g.nota }, yo.nombre)); return null;
}
// Reloj de las órdenes abiertas: solo cuenta de 8:00 a 22:00 de Caracas, todos los días (igual que privado.horas_reloj)
function horasReloj(desde, hasta){
  const a = new Date(desde).getTime() - 4 * 3600000, b = new Date(hasta || Date.now()).getTime() - 4 * 3600000; if(b <= a) return 0;
  let h = 0; for(let d = Math.floor(a / DIA) * DIA; d <= b; d += DIA){ const ini = Math.max(a, d + 8 * 3600000), fin = Math.min(b, d + 22 * 3600000); if(fin > ini) h += (fin - ini) / 3600000; }
  return Math.round(h * 100) / 100;
}
function ordenesAbiertas(m, yo){
  const r = visibles(m, yo).filter((c) => c.orden && porInstalar(c)).map((c) => { const o = c.orden; const ini = o.inicio || o.creada_en; const h = horasReloj(ini);
    return { orden_id: o.id || c.id, numero: o.numero, titulo: o.titulo || '', etapa: o.etapa, creada_en: o.creada_en, inicio: ini, veces: o.veces || 0, horas: h, color: h >= 24 ? 'rojo' : h >= 16 ? 'ambar' : 'verde',
      cliente_id: c.id, cliente: c.nombre, provisional: !!c.provisional, parecido_id: null, parecido: null, lider: c.lider || 'Por asignar', de_otro: !!o.de_otro }; });
  if(['admin', 'analista'].includes(yo.rol)) (m.datos.sueltas || []).forEach((o) => { const h = horasReloj(o.creada_en); const p = m.datos.clientes.find((x) => x.id === o.parecido_id);
    r.push({ orden_id: o.id, numero: o.numero, titulo: o.titulo, etapa: o.etapa, creada_en: o.creada_en, inicio: o.creada_en, veces: 0, horas: h, color: h >= 24 ? 'rojo' : h >= 16 ? 'ambar' : 'verde',
      cliente_id: null, cliente: o.nombre, provisional: false, parecido_id: o.parecido_id, parecido: p ? p.nombre : null, lider: o.lider || 'Por asignar', de_otro: false }); });
  const rango = { rojo: 0, ambar: 1, verde: 2 };
  return r.sort((x, y) => rango[x.color] - rango[y.color] || y.horas - x.horas);
}
const error = (mensaje) => ({ __error: { code: 'P0001', message: mensaje } });
// Lote 6: pendientes inventados como los arma privado.pendientes (analista del líder, líder, senior)
// Migraciones: los cambios a PYME confirmados esperan la decisión de comisión del Senior (como privado.pendientes)
function pendDecidir(m){
  return ((m.datos.cambiosK || {}).filas || []).filter((c) => c.estado === 'confirmado' && c.comision === 'por_decidir' && !soloRegistro(m, c))
    .map((c) => ({ tipo: 'cambio_comision', clave: String(c.id), cliente_id: null, titulo: c.titular.nombre || 'Cambio de categoría', detalle: (c.categoria_anterior || '?') + ' a ' + (c.categoria_nueva || '?') + ': ¿comisiona?',
      para: 'senior', lider_id: c.lider_id || null, analista_id: null, desde: c.confirmado_en || new Date().toISOString(), vence: hoy(), ref: { cambio: c.id } }));
}
const soloRegistro = (m, c) => !!c.comision && String(c.fecha_cambio || c.confirmado_en || '').slice(0, 10) < (m.cambiosDesde || '2026-09-21');
function confirmarCambio(m, c, fecha){
  c.estado = 'confirmado'; c.confirmado_en = new Date().toISOString(); c.fecha_cambio = fecha || c.confirmado_en;
  if(c.tipo !== 'titularidad' && /pyme/i.test(c.categoria_nueva || '') && !/pyme/i.test(c.categoria_anterior || '')) c.comision = 'por_decidir';
}
function pendientesBase(m){
  if(m.datos.pendientes) return m.datos.pendientes.concat(pendDecidir(m));
  const cli = (n) => m.datos.clientes.find((c) => c.nombre === n || c.nombre === n + ', C.A.') || m.datos.clientes[0];
  const lucia = m.personas.find((p) => p.usuario === 'lucia'); const elena = m.personas.find((p) => p.usuario === 'elena');
  const dia = (n) => { const d = new Date(hoy() + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const faro = cli('Vidrios El Faro'); const yun = cli('Tornillos El Yunque');
  m.datos.pendientes = [
    { tipo: 'por_enviar', clave: 'i1', cliente_id: faro.id, titulo: faro.nombre, detalle: 'Proforma y carta por enviar del servicio 824-99100001', para: 'analista', lider_id: lucia.id, analista_id: elena.id, desde: dia(-5) + 'T12:00:00Z', vence: dia(-2), ref: {} },
    { tipo: 'sin_ip', clave: 'i2', cliente_id: yun.id, titulo: yun.nombre, detalle: 'Falta la IP del servicio 824-99100004', para: 'analista', lider_id: lucia.id, analista_id: elena.id, desde: new Date().toISOString(), vence: dia(3), ref: {} },
    { tipo: 'cambio_emitir', clave: 'c7', cliente_id: null, titulo: 'Panaderia Inventada Uno', detalle: 'Cambio de categoría a PYME-1GB', para: 'analista', lider_id: lucia.id, analista_id: elena.id, desde: dia(0) + 'T08:00:00Z', vence: dia(0), ref: { cambio: 7 } },
    { tipo: 'certificar', clave: 'i3', cliente_id: faro.id, titulo: faro.nombre, detalle: 'falta Legal', para: 'senior', lider_id: lucia.id, analista_id: elena.id, desde: dia(-3) + 'T12:00:00Z', vence: dia(4), ref: {} },
    { tipo: 'docs_faltan', clave: String(yun.id), cliente_id: yun.id, titulo: yun.nombre, detalle: 'Faltan 2 documentos', para: 'lider', lider_id: lucia.id, analista_id: elena.id, desde: dia(-40) + 'T12:00:00Z', vence: dia(-10), ref: {} },
    { tipo: 'por_firmar', clave: String(faro.id), cliente_id: faro.id, titulo: faro.nombre, detalle: 'Contrato por firmar', para: 'lider', lider_id: lucia.id, analista_id: elena.id, desde: dia(-2) + 'T12:00:00Z', vence: dia(28), ref: {} }
  ];
  return m.datos.pendientes.concat(pendDecidir(m));
}
// Corrida 14/10 tarde: módulo de cada tipo (como privado.modulo_de) y sin "Hecho"
// Corrida 14/10 tarde: categorías del TAD (como privado.categorias_tad)
const CATEGORIAS = ['PYME-1GB', 'DEDICADO', 'EXONERADO', '1 GB', 'PROMO-1GB', 'RESIDENCIAL'];
function moduloDe(t){
  return ['docs_faltan', 'devuelto', 'por_firmar', 'sin_gestion', 'rif_verificar'].includes(t) ? 'expedientes'
    : ['por_instalar', 'por_enviar', 'sin_ip', 'por_asignar', 'certificar', 'sin_cliente', 'sin_servicio'].includes(t) ? 'comisiones'
    : ['cambio_emitir', 'sin_solicitud', 'cambio_comision', 'planilla'].includes(t) ? 'migraciones' : ['vgt', 'poliza'].includes(t) ? 'dedicados' : t === 'referido' ? 'aliados' : 'otros';
}
function misPendientes(m, yo, persona){
  const sen = yo.rol === 'analista' && !!yo.senior; const can = !!yo.canales;
  return pendientesBase(m).filter((p) =>
    yo.rol === 'admin' ? !persona || p.analista_id === persona || p.lider_id === persona
      : yo.rol === 'lider' ? p.para === 'lider' && p.lider_id === yo.id
      : can ? ['analista', 'senior'].includes(p.para) && (!persona || p.analista_id === persona)
      : sen ? (p.para === 'analista' && (p.analista_id === yo.id || !p.analista_id)) || p.para === 'senior'
      : p.para === 'analista' && p.analista_id === yo.id);
}
// Lote 4: el cambio como lo devuelve el servidor (requisitos según el tipo, contra el expediente del nuevo titular)
function cambioJson(m, c){
  const pyme = (x) => /pyme/i.test(x || '');
  let req = [];
  if(c.tipo !== 'categoria' && c.nuevo){
    const cli = m.datos.clientes.find((x) => x.id === c.nuevo.cliente_id) || { documentos: [] };
    const tiene = (cas, num) => (cli.documentos || []).some((d) => d.casilla === cas && d.numero === num && (d.archivos || []).length);
    req = [['otro', 80, 'Planilla de cambio de titular firmada'], ['otro', 81, 'Cédula o RIF del titular actual']];
    if(c.titular.natural && c.nuevo.natural) req.push(['cedula', 1, 'Cédula del nuevo titular']);
    else req.push(['rif_empresa', 0, 'RIF de la empresa del nuevo titular'], ['acta_constitutiva', 0, 'Acta constitutiva del nuevo titular'], ['cedula', 1, 'Cédula del nuevo titular'], ['rif_personal', 1, 'RIF personal del nuevo titular']);
    req = req.map((r) => ({ casilla: r[0], numero: r[1], texto: r[2], ok: tiene(r[0], r[1]) }));
  }
  return Object.assign({}, c, { solo_registro: soloRegistro(m, c), comisiona: c.tipo !== 'titularidad' && pyme(c.categoria_nueva) && !pyme(c.categoria_anterior), negativo: pyme(c.categoria_anterior) && !!c.categoria_nueva && !pyme(c.categoria_nueva), requisitos: req });
}

const esSenior = (yo) => yo.rol === 'admin' || (yo.rol === 'analista' && !!yo.senior);
const duenoDe = (c, i) => (i.dueno !== undefined ? i.dueno : c.lider);
const ordenOk = (c, i) => !!(i.confirmada && (i.orden || i.cruce === 'manual') && duenoDe(c, i));
// B4: motivo en una frase; B8: aprobado por Legal con casillas obligatorias sin archivo
const motivoDe = (c, i) => (ordenOk(c, i) ? null : i.de_otro ? 'Orden creada por otra persona, sin código' : i.cruce === 'nombre_parecido' ? 'Nombre parecido: confirma que la orden es de este cliente'
  : !i.orden && i.orden_vieja ? 'Orden vieja: se creó más de 45 días antes de instalar' : !i.orden ? 'Sin orden de Odoo reciente' : !duenoDe(c, i) ? 'Falta a quién pertenece' : 'Por confirmar');
const casillasVacias = (c) => faltantes(c).filter((x) => x.e === 'falta' && !x.dato).length;
function faltanArchivos(c){ return requeridos(c).some((q) => { const d = busca(c, q.casilla, q.numero); return !d || !(d.archivos || []).length; }); }
const porSubir = (c) => (LEGAL_OK.includes(c.estatus) || !!c.legal_ok_en) && faltanArchivos(c);
const aprobadoPorSubir = (c) => !!c.legal_ok_en && faltanArchivos(c);
const comisionaEvento = (i) => !i.es_evento || !!i.evento_comisiona;
const DUENOS = ['Lucía Ferrer', 'Rosa Paredes', 'Tomás Guerra'];
// Dueño de un servicio para la carta: el de su instalación; si no hay, el líder de la cartera
function cartaDe(m, c, sv){
  const i = c.instalaciones.find((x) => x.codigo === sv.codigo && x.sucursal === sv.sucursal);
  const dueno = i ? duenoDe(c, i) : c.lider; const ali = !!(i && i.es_aliado); const p = m.personas.find((x) => x.nombre === dueno) || {};
  return { instalacion: i ? i.id : null, puede: !i || ali || ordenOk(c, i), aliado: ali || !dueno, lider: ali ? null : dueno || null, whatsapp: ali ? null : p.whatsapp || null, correo: ali ? null : p.correo || null };
}
const ultimoEnvio = (sv, tipo) => (sv.envios || []).filter((e) => e.tipo === tipo).slice(-1)[0] || null;
function bienvenidasFilas(m, yo){
  const ini = cierre(masMeses(enCurso(), -1)); const r = [];
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
// Lote 21/10: por qué hay que revisar el pago a mano (igual que privado.revisar_pago)
function revisarMotivo(c, i){
  if(i.pago_ok_en) return null;
  const f = fechaClave(caracas(i.instalada_en)); const sig = masMeses(f.slice(0, 8) + '01', 1);
  if(Number(f.slice(8, 10)) >= 20 && c.servicios.some((sv) => sv.con_deuda && sv.tad_en && fechaClave(caracas(sv.tad_en)) >= sig)) return 'factura_mes';
  if(c.servicios.length > 1 || (c.residenciales || 0) > 0) return 'varios_servicios';
  return null;
}
const enFoto = (m, id) => Object.keys(m.certificados || {}).sort().find((k) => (m.certificados[k].filas || []).some((f) => f.instalacion_id === id)) || null;
function filasComision(m, yo, corte){
  const cert = (m.certificados || {})[corte]; if(cert) return cert.filas.filter((f) => yo.rol !== 'lider' || f.lider_id === yo.id);
  const iniAnt = cierre(masMeses(corte, -2)), ini = cierre(masMeses(corte, -1)), fin = cierre(corte); const lAnt = limiteTs(masMeses(corte, -1)), lim = limiteTs(corte); const r = [];
  visibles(m, yo).forEach((c) => c.instalaciones.forEach((i) => {
    const t = new Date(i.instalada_en).getTime(); const cm = i.corte_manual || null;
    if(i.anulada_en || (cm ? (cm !== corte && cm !== masMeses(corte, -1)) : (t < iniAnt || t >= fin)) || !comisionable(i) || !comisionaEvento(i)) return;
    const delCorte = cm ? cm === corte : t >= ini;
    const leg = c.legal_ok_en ? new Date(c.legal_ok_en).getTime() : null; const pag = i.pago_ok_en ? new Date(i.pago_ok_en).getTime() : null;
    const ook = ordenOk(c, i); const exc = !!(i.excepcion_corte && i.excepcion_corte <= corte); const excAntes = !!(i.excepcion_corte && i.excepcion_corte < corte);
    if(!delCorte && (!cerrado(masMeses(corte, -1)) || (ook && ((leg !== null && pag !== null && leg < lAnt && pag < lAnt) || excAntes)))) return;
    const dueno = duenoDe(c, i);
    r.push({ instalacion_id: i.id, cliente_id: c.id, nombre: c.nombre, doc: c.doc_tipo + '-' + c.doc_numero, instalada_en: i.instalada_en, lider_id: dueno === c.lider ? c.lider_id : null, lider: dueno || 'Por asignar',
      origen: delCorte ? 'corte' : 'anterior', movida: !!cm, movida_motivo: i.corte_manual_motivo || null, legal_ok: leg !== null && leg < lim, pago_ok: pag !== null && pag < lim, cumple: ook && ((leg !== null && pag !== null && leg < lim && pag < lim) || exc),
      estatus: c.estatus, codigo: i.codigo, sucursal: i.sucursal, revisar_pago: revisarMotivo(c, i) !== null, revisar_motivo: revisarMotivo(c, i), correccion: i.correccion || null,
      orden_ok: ook, orden: i.orden ? i.orden.numero : null, orden_id: i.orden ? i.orden.id : null, orden_titulo: i.orden ? i.orden.titulo : null, orden_creador: i.orden ? i.orden.creador : null, cruce: i.cruce,
      es_natural: c.es_natural, instalador: i.instalador, excepcion: exc, excepcion_motivo: i.excepcion_motivo, dueno_manual: !!i.manual,
      motivo: motivoDe(c, i), por_subir: porSubir(c), aprobado_por_subir: aprobadoPorSubir(c), es_evento: !!i.es_evento, servicio_id: (c.servicios.find((sv) => sv.codigo === i.codigo) || {}).id || null,
      bienvenida_en: ((ultimoEnvio(c.servicios.find((sv) => sv.codigo === i.codigo) || {}, 'bienvenida')) || {}).en || null,
      sin_ip: !!c.servicios.find((sv) => sv.codigo === i.codigo && !sv.ip && !sv.ip6) });
  }));
  return r.sort((a, b) => a.lider.localeCompare(b.lider) || a.origen.localeCompare(b.origen) || a.instalada_en.localeCompare(b.instalada_en));
}
const sinGestion = (c) => ['grandes_negocios', 'documentos_solicitados', 'documentos_pendientes'].includes(c.estatus) && !porInstalar(c) && new Date(c.ug_en || c.creado_en).getTime() < Date.now() - 3 * DIA;
function ultimoCorte(c){
  const actual = enCurso(); const iniAnt = cierre(masMeses(actual, -2)), ini = cierre(masMeses(actual, -1));
  return c.instalaciones.some((i) => { const t = new Date(i.instalada_en).getTime(); return comisionable(i) && t >= iniAnt && t < ini && (!c.legal_ok_en || !i.pago_ok_en); });
}

function cruceFalso(m, yo){
  if(!['admin', 'analista'].includes(yo.rol)) return error('No tienes permiso para hacer esto');
  return { base: { hay: true, clientes: 12, lider: 9, estatus: 4, contactos: 6, sin_tad: 1 }, odoo: { hay: true, nuevas: 7, actualizadas: 2, por_rif: 3, por_nombre: 4, sin_cliente: 2, abiertas: 1 },
    inst: { hay: true, nuevas: 5, completadas: 3, reemplazos: 2, antes_del_inicio: 4, dedicados: 1, residenciales: 2, con_orden: 4, por_confirmar: 1, sin_orden: 1, aliado: 2, pagos: 0 },
    corte: { mes: '2026-10-01', filas: 10, cumplen: 2, del_corte: 8, por_asignar: 3 }, anterior: { mes: '2026-09-01', filas: 20, cumplen: 15, del_corte: 20 }, totales: {} };
}
// Archivos vigentes de un cliente y la revisión con IA de mentira
const archivosDe = (c) => Array.from(new Set([].concat.apply([], c.documentos.map((d) => (d.archivos || []).map((x) => x.id)))));
// Lo que las reglas usan del expediente: si cambia después de la IA, su resultado quedó viejo
const huellaIA = (c) => JSON.stringify([c.nombre, c.regimen_firma, c.es_isp, c.correo_empresa, c.representantes.map((r) => [r.orden, r.nombre, r.correo, r.telefono]), archivosDe(c)]);
const sinLeer = (c) => archivosDe(c).filter((x) => !(c.leidos || {})[x]).length;
const iaActiva = (c) => !!(c.ia && ['en_cola', 'leyendo'].includes(c.ia.estado));
function avanzarIA(m, c){
  if(!iaActiva(c)) return;
  if(m.iaTrabada){ c.ia.trabada = true; return; }
  if(m.iaFalla){ Object.assign(c.ia, { estado: 'error', error: m.iaFalla, terminada_en: hace(0) }); return; }
  c.ia.avance = Math.min(c.ia.total, c.ia.avance + (m.iaPaso || 1)); c.ia.costo_usd = Math.round(c.ia.avance * 3.2) / 100;
  if(c.ia.avance < c.ia.total) return;
  c.leidos = c.leidos || {}; archivosDe(c).forEach((x) => { c.leidos[x] = true; });
  // El primer documento por revisar sale vencido; los demás bien. Junta vencida (con excepción posible) y un aviso.
  const porRev = c.documentos.filter((d) => d.estado === 'por_revisar');
  c.ia.marcas = c.documentos.map((d, i) => d === porRev[0] ? { documento: d.id, propuesta: 'problema', motivo: 'vencido', nota: 'Venció el 31/05/2026.', pagina: 1 }
    : d === porRev[1] ? { documento: d.id, propuesta: 'revisar_a_mano', motivo: null, nota: 'Se ve borroso o incompleto. Míralo tú.', pagina: 1 } : { documento: d.id, propuesta: 'bien', motivo: null, nota: 'Vigente.', pagina: 1 });
  c.ia.puntos = [{ id: 'junta', titulo: 'Junta vencida', estado: 'bloquea', detalle: 'Designada en el acta inscrita el 14/03/2012 por 5 años: venció el 14/03/2017.', pagina: 'Acta constitutiva · página 6', falta: 'Acta de asamblea de ratificación o cambio de junta', excepcionable: true },
    { id: 'sin_marcar_1', titulo: 'Documento sin marcar', estado: 'aviso', detalle: 'El archivo de Cédula también trae un RIF personal en la página 2. Márcalo en el expediente para que cuente.' },
    { id: 'duracion', titulo: 'Duración de la empresa', estado: 'ok', detalle: '50 años desde el 14/03/2012.' }]
    .concat(faltantes(c).filter((f) => f.dato).map((f) => ({ id: 'falta_' + f.k, titulo: 'Falta ' + f.t, estado: 'bloquea', detalle: 'Hay que escribirlo en el expediente.' })));
  c.ia.puntos.forEach((p) => { const e = (c.ia.excepciones || []).find((x) => x.punto === p.id); if(e){ p.excepcion = e.motivo; p.estado = 'ok'; } });
  Object.assign(c.ia, { estado: 'lista', veredicto: c.ia.puntos.some((x) => x.estado === 'bloquea') || c.ia.marcas.some((x) => x.propuesta === 'problema') ? 'no_apto' : 'apto', terminada_en: new Date().toISOString(), huella: huellaIA(c) });
  c.marcas = c.marcas || {};
  c.ia.marcas.forEach((k) => { const ant = c.marcas[k.documento]; if(ant && ant.accion && ant.origen !== 'ia') return; if(k.propuesta === 'revisar_a_mano'){ delete c.marcas[k.documento]; return; }
    c.marcas[k.documento] = { documento: k.documento, accion: k.propuesta === 'bien' ? 'aprobar' : 'devolver', motivo: k.propuesta === 'bien' ? null : k.motivo, nota: k.propuesta === 'bien' ? null : k.nota, vence_en: null, por: null, en: hace(0), origen: 'ia', pagina: k.pagina }; });
}

// ---------- Gerencia (lote 7) ----------
const efectivo = (yo) => yo && yo.gerencia ? 'gerencia' : yo && yo.rol;
function gerHechos(m){
  if(m.gerHechos) return m.gerHechos;
  const L = '22222222-2222-4222-8222-222222222222'; const O = '77777777-7777-4777-8777-777777777777'; const h = [];
  const idDe = (n) => ((m.datos && m.datos.clientes) || []).filter((c) => c.nombre === n).map((c) => c.id)[0] || null;
  const add = (s, k, mes, cliente_id, nombre, lider_id, detalle, n) => h.push({ s, k, mes, cliente_id: cliente_id && idDe(nombre), nombre, lider_id, detalle: detalle || null, n: n === undefined ? null : n });
  add('seg', 'PYME', null, 1, 'Vidrios El Faro, C.A.', L); add('seg', 'PYME', null, 2, 'Tornillos El Yunque, C.A.', L); add('seg', 'Combinado', null, 3, 'Comercial de Prueba 3, C.A.', O); add('seg', 'Dedicado ISP', null, 4, 'Red Inventada ISP, C.A.', O);
  add('ins', 'PYME', '2026-10-01', 1, 'Vidrios El Faro, C.A.', L, null, 6); add('ins', 'PYME', '2026-10-01', 2, 'Tornillos El Yunque, C.A.', L, 'Aliado Inventado', 10); add('ins', 'Combinado', '2026-09-01', 3, 'Comercial de Prueba 3, C.A.', O, null, 8);
  add('ins', 'PYME', '2026-08-01', 5, 'Panaderia Inventada Uno', L, null, 4);
  add('com', 'cumple', '2026-09-01', 3, 'Comercial de Prueba 3, C.A.', O, 'Cumple'); add('com', 'no', '2026-09-01', 5, 'Panaderia Inventada Uno', L, 'Falta Legal'); add('cert', 'certificado', '2026-09-01', null, null, null);
  add('com', 'cumple', '2026-10-01', 1, 'Vidrios El Faro, C.A.', L, 'Cumple'); add('com', 'no', '2026-10-01', 2, 'Tornillos El Yunque, C.A.', L, 'Falta pago');
  add('exp', 'documentos_solicitados', null, 1, 'Vidrios El Faro, C.A.', L); add('exp', 'contrato_firmado', null, 2, 'Tornillos El Yunque, C.A.', L); add('exp', 'por_firmar', null, 3, 'Comercial de Prueba 3, C.A.', O);
  add('legal', 'listo', '2026-10-01', 2, 'Tornillos El Yunque, C.A.', L, null, 12); add('dev', 'rif', null, 1, 'Vidrios El Faro, C.A.', L, 'Ilegible'); add('fal', 'acta constitutiva', null, 1, 'Vidrios El Faro, C.A.', L);
  add('cam', 'categoria', '2026-10-01', 5, 'Panaderia Inventada Uno', L, 'por_emitir'); add('cam', 'pyme_otra', '2026-10-01', 2, 'Tornillos El Yunque, C.A.', L, 'PYME-1GB a RESIDENCIAL');
  add('ali', 'solicitud', '2026-10-01', 2, 'Tornillos El Yunque, C.A.', null, 'Aliado Inventado'); add('ali', 'instalada', '2026-10-01', 2, 'Tornillos El Yunque, C.A.', null, 'Aliado Inventado');
  add('ded', 'contrato_firmado', null, 4, 'Red Inventada ISP, C.A.', O, 'isp'); add('ded', 'poliza_por_vencer', null, 4, 'Red Inventada ISP, C.A.', O, '30/10/2026', 16);
  add('neg', 'sin_permiso', '2026-10-01', 2, 'Tornillos El Yunque, C.A.', L, 'Aliado Inventado'); add('neg', 'orden_15', null, 1, 'Vidrios El Faro, C.A.', L, 'Orden sin instalar', 20);
  m.gerHechos = h; return h;
}
function gerFiltrar(m, yo, a){
  const r = efectivo(yo); if(!['admin', 'analista', 'lider', 'abogado', 'gerencia'].includes(r)) return error('No tienes permiso para hacer esto');
  if(!a.p_desde || !a.p_hasta || a.p_desde > a.p_hasta) return error('Elige un rango de meses válido');
  const todo = r === 'admin' || r === 'gerencia'; const lider = r === 'lider' ? yo.id : a.p_lider; const segDe = (id) => (gerHechos(m).find((h) => h.s === 'seg' && h.cliente_id === id) || {}).k || 'PYME';
  return gerHechos(m).filter((h) => (todo || !['ali', 'neg'].includes(h.s)) && (!lider || h.lider_id === lider || h.s === 'cert')
    && (!a.p_segmento || h.s === 'cert' || (['seg', 'ins'].includes(h.s) ? h.k === a.p_segmento : !!h.cliente_id && segDe(h.cliente_id) === a.p_segmento)))
    .map((h) => Object.assign({}, h, { detalle: !todo && h.s === 'ins' ? null : h.detalle }));
}

const RPC = {
  inicio_datos(m, yo){
    if(yo.rol === 'aliado') return { rol: yo.rol, hoy: hoy() };
    const actual = enCurso(); const f = filasComision(m, yo, actual); const v = visibles(m, yo);
    const rev = v.filter((c) => c.estatus === 'documentos_en_revision');
    return { rol: yo.rol, hoy: hoy(), corte: { etiqueta: actual, inicio: corteInicio(actual), fin: corteFin(actual), limite: corteLimite(actual), dias: dias(hoy(), corteLimite(actual)), avance: Math.min(100, Math.round(100 * (dias(corteInicio(actual), hoy()) + 1) / (dias(corteInicio(actual), corteLimite(actual)) + 1))) },
      senior: esSenior(yo), bienvenidas: ['admin', 'analista', 'lider'].includes(yo.rol) ? bienvenidasFilas(m, yo).length : null,
      comision: { total: f.length, cumplen: f.filter((x) => x.cumple).length, ultimo: f.filter((x) => x.origen === 'anterior' && !x.cumple && x.orden_ok).length, por_asignar: f.filter((x) => !x.orden_ok).length },
      clientes: { en_curso: v.filter((c) => c.estatus !== 'contrato_firmado' && !porInstalar(c)).length, por_revisar: rev.length,
        por_revisar_dias: rev.reduce((a, c) => Math.max(a, dias(fechaClave(caracas(c.estatus_desde)), hoy())), 0),
        devueltos: v.filter((c) => c.documentos.some((d) => d.estado === 'devuelto')).length, sin_gestion: v.filter(sinGestion).length,
        por_firmar: v.filter((c) => ['contrato_en_curso', 'por_firmar'].includes(c.estatus)).length, por_instalar: v.filter(porInstalar).length },
      tad_en: null, tad_dias: null, usuarios: yo.rol === 'admin' ? m.personas.filter((p) => p.activo).length : null, hay_demo: false,
      instalar: ['admin', 'analista', 'lider'].includes(yo.rol) ? (() => { const o = ordenesAbiertas(m, yo); return { total: o.length, rojo: o.filter((x) => x.color === 'rojo').length, ambar: o.filter((x) => x.color === 'ambar').length }; })() : null };
  },
  por_instalar(m, yo){
    if(!['admin', 'analista', 'lider'].includes(yo.rol)) return error('No tienes permiso para hacer esto');
    const sen = esSenior(yo);
    return { rol: yo.rol, ahora: new Date().toISOString(), filas: ordenesAbiertas(m, yo).map((o) => Object.assign({ anterior: o.creada_en < '2026-10-01' }, o)), realizadas: yo.rol === 'admin' || sen ? (m.datos.realizadas || []) : null, duenos: sen ? DUENOS : [],
      puedo: { asignar: sen, realizadas: yo.rol === 'admin' || sen } };
  },
  orden_es_cliente(m, yo, a){
    if(!['admin', 'analista', 'lider'].includes(yo.rol)) return error('No tienes permiso para hacer esto');
    const i = (m.datos.sueltas || []).findIndex((o) => o.id === Number(a.p_orden)); if(i < 0) return error('Esa orden ya tiene cliente');
    const o = m.datos.sueltas.splice(i, 1)[0]; let c;
    if(a.p_cliente){ if(Number(a.p_cliente) !== o.parecido_id) return error('Ese no es el cliente propuesto'); c = m.datos.clientes.find((x) => x.id === o.parecido_id); }
    else { c = cliente({ nombre: o.nombre, doc_numero: String(9900000000 + o.id), provisional: true, lider: o.lider || null, lider_id: null }); c.orden = { id: o.id, numero: o.numero, titulo: o.titulo, creada_en: o.creada_en, etapa: o.etapa }; m.datos.clientes.push(c); }
    (m.bitacora = m.bitacora || []).push({ usuario: yo.usuario, accion: 'orden_cliente', registro_id: String(o.id), despues: { es_ese: !!a.p_cliente, cliente: c.id }, en: new Date().toISOString() });
    return c.id;
  },
  provisional_dueno(m, yo, a){
    if(!esSenior(yo)) return error('Solo el Analista Senior puede hacer esto');
    const c = m.datos.clientes.find((x) => x.id === Number(a.p_cliente)); if(!c || !c.provisional) return error('Ese cliente no es provisional');
    if(DUENOS.indexOf(a.p_dueno) < 0) return error('Ese nombre no está en la lista de líderes');
    c.lider = a.p_dueno; if(c.orden) c.orden.de_otro = false;
    (m.bitacora = m.bitacora || []).push({ usuario: yo.usuario, accion: 'provisional_dueno', registro_id: String(c.id), despues: { lider: a.p_dueno }, en: new Date().toISOString() });
    return null;
  },
  provisional_rif(m, yo, a){
    const c = visibles(m, yo).find((x) => x.id === Number(a.p_cliente)); if(!c) return error('No tienes acceso a este cliente');
    if(!c.provisional) return error('Ese cliente ya no es provisional');
    const num = String(a.p_rif || '').replace(/\D/g, '').replace(/^0+/, ''); if(!/^[1-9][0-9]{4,9}$/.test(num)) return error('Ese RIF no parece válido');
    const real = m.datos.clientes.find((x) => x.doc_numero === num && x.id !== c.id);
    if(real){ c.documentos.forEach((d) => { if(!busca(real, d.casilla, d.numero)) real.documentos.push(d); }); c.documentos = []; c.unido_a = real.id; real.hilo.push(linea('dato', 'provisional_unido', { provisional: c.id }, yo.nombre)); return real.id; }
    c.doc_numero = num; c.doc_tipo = (String(a.p_rif).trim().charAt(0).toUpperCase().match(/[VEJGPC]/) || ['J'])[0]; c.provisional = false; return c.id;
  },
  // Igual que clientes_lista, con los filtros de las listas desplegables y sus opciones
  clientes_lista2(m, yo, a){
    const f = a.p_filtros || {}; const todos = visibles(m, yo); const tj = ['pyme', 'corporativo', 'isp'].includes(f.tarjeta) ? f.tarjeta : '';
    const ctr = (c) => (c.dedicado && c.dedicado.contratos) || []; const enl = (c) => ((c.dedicado && c.dedicado.enlaces) || []).some((e) => e.activo);
    // Corrida 14/10 tarde: el tipo no excluye combinados; pólizas por vencer
    const tipoOk = (c) => { const t = tarjetaDe(c); return !f.tipo || (f.tipo === 'PYME' && t.pyme) || (f.tipo === 'Dedicado ISP' && t.ded === 'isp') || (f.tipo === 'Dedicado corporativo' && t.ded === 'corporativo') || (f.tipo === 'Combinado' && t.pyme && !!t.ded); };
    const polDe = (c) => (c.documentos || []).filter((x) => x.casilla === 'otro' && [66, 67].includes(x.numero) && x.vence_en && x.estado !== 'devuelto').map((x) => x.vence_en).sort()[0] || null;
    const hoyMas30 = new Date(Date.now() + 30 * DIA).toISOString().slice(0, 10);
    const polOk = (c) => !f.poliza || (f.poliza === 'con' ? !!polDe(c) : !!polDe(c) && polDe(c).slice(0, 10) <= hoyMas30);
    const esVgt = (c) => ctr(c).some((k) => k.tipo === 'vgt');
    // Lote 21/10: Segmento, VGT con requisitos incompletos, suspendidos aparte y etiqueta de gestión
    const segOk = (c) => { const t = tarjetaDe(c); return !f.segmento || (f.segmento === 'pyme' && t.pyme && !t.ded) || (f.segmento === 'dedicado' && t.ded === 'corporativo' && !t.pyme) || (f.segmento === 'isp' && t.ded === 'isp' && !t.pyme) || (f.segmento === 'combinado' && t.pyme && !!t.ded); };
    const vgtOk = (c) => !f.vgt || (f.vgt === 'con' ? ctr(c).some((k) => k.tipo === 'vgt') : f.vgt === 'incompletos' ? !!(c.dedicado && c.dedicado.vgt && c.dedicado.vgt.faltan) : ctr(c).some((k) => k.tipo === 'vgt' && k.estatus !== 'firmado'));
    const sus = f.suspendidos === '1';
    const pasa = (c) => !!c.suspendido_en === sus && (!f.lider || (c.lider || 'Sin líder') === f.lider) && (!f.estatus || c.estatus === f.estatus) && tipoOk(c) && polOk(c) && segOk(c) && vgtOk(c) &&
      (!f.sucursal || c.servicios.some((s) => s.sucursal === f.sucursal)) && (!f.servicio || c.servicios.some((s) => norm(s.estado) === norm(f.servicio))) &&
      (!f.enlaces || (f.enlaces === 'activos') === enl(c));
    const enT = (c) => !tj || (tj === 'pyme' ? tarjetaDe(c).pyme : tarjetaDe(c).ded === tj);
    const buscando = !!(norm(a.p_busca) || String(a.p_busca || '').replace(/\D/g, '').length >= 4);
    const base = m.datos.clientes.filter(pasa);
    const etqOk = (c) => !f.gestion || buscando || (ultimaEtq(c) || {}).e === f.gestion;
    const m2 = Object.assign({}, m, { datos: Object.assign({}, m.datos, { clientes: base.filter((c) => (buscando || enT(c)) && etqOk(c)) }) });
    const r = RPC.clientes_lista(m2, yo, Object.assign({}, a, { p_filtro: a.p_filtro === 'faltan' || a.p_filtro === 'vgt' ? 'todos' : a.p_filtro, p_limite: a.p_filtro === 'vgt' ? 999 : a.p_limite })); if(r && r.__error) return r;
    // Faltan documentos y el conteo por tarjeta (el servidor los cuenta sobre lo que ve cada quien)
    const vis = visibles(m2, yo); const vb = visibles(Object.assign({}, m, { datos: Object.assign({}, m.datos, { clientes: base }) }), yo);
    r.conteos.faltan = vis.filter((c) => casillasVacias(c) > 0).length; r.conteos.vgt = vis.filter(esVgt).length;
    if(a.p_filtro === 'vgt' && !buscando){ const ids = new Set(vis.filter(esVgt).map((c) => c.id)); r.filas = r.filas.filter((x) => ids.has(x.id)); r.total = r.filas.length; }
    if(a.p_filtro === 'faltan' && !buscando){ const l = vis.filter((c) => casillasVacias(c) > 0); const ids = new Set(l.map((c) => c.id)); r.total = l.length; r.filas = r.filas.filter((x) => ids.has(x.id)); }
    r.tarjetas = { pyme: vb.filter((c) => tarjetaDe(c).pyme).length, corporativo: vb.filter((c) => tarjetaDe(c).ded === 'corporativo').length, isp: vb.filter((c) => tarjetaDe(c).ded === 'isp').length };
    r.filas.forEach((x) => { const c = m.datos.clientes.find((k) => k.id === x.id); const t = tarjetaDe(c); x.ded = t.ded; x.combinado = !!t.ded && t.pyme; x.vgt = esVgt(c); x.poliza_vence = polDe(c); x.n_enl = ((c.dedicado && c.dedicado.enlaces) || []).filter((e) => e.activo).length;
      x.suspendido = !!c.suspendido_en; const g = ultimaEtq(c); x.etq = g ? { e: g.e, fecha: g.fecha, nota: g.nota } : null; x.ctr = contratoPend(c); });
    const visT = vb.filter(enT);
    r.gestion = { contactado: 0, sin_contacto: 0, esperando: 0 }; visT.forEach((c) => { const g = ultimaEtq(c); if(g) r.gestion[g.e]++; });
    r.suspendidos = todos.filter((c) => c.suspendido_en).length;
    const un = (l) => Array.from(new Set(l)).sort();
    r.opciones = { lider: un(todos.map((c) => c.lider || 'Sin líder')), sucursal: un([].concat.apply([], todos.map((c) => c.servicios.map((s) => s.sucursal)))),
      servicio: un([].concat.apply([], todos.map((c) => c.servicios.map((s) => norm(s.estado).replace(/^./, (x) => x.toUpperCase()))))), tipo: ['PYME', 'Dedicado ISP', 'Dedicado corporativo', 'Combinado'] };
    return r;
  },
  clientes_lista(m, yo, a){
    if(yo.rol === 'aliado') return error('No tienes permiso para hacer esto');
    const v = visibles(m, yo); const b = norm(a.p_busca); let bd = String(a.p_busca || '').replace(/\D/g, ''); if(bd.length < 4) bd = '';
    const filtros = { en_curso: (c) => c.estatus !== 'contrato_firmado' && !porInstalar(c), por_revisar: (c) => c.estatus === 'documentos_en_revision', por_instalar: porInstalar, sin_gestion: sinGestion,
      devueltos: (c) => c.documentos.some((d) => d.estado === 'devuelto'), ultimo_corte: ultimoCorte, por_firmar: (c) => ['contrato_en_curso', 'por_firmar'].includes(c.estatus), firmados: (c) => c.estatus === 'contrato_firmado', por_subir: porSubir, todos: () => true };
    const sel = (b || bd) ? v.filter((c) => (b && norm(c.nombre).includes(b)) || (bd && (c.doc_numero.includes(bd) || c.servicios.some((s) => (s.sucursal + s.codigo).includes(bd) || String(s.telefono || '').replace(/\D/g, '').includes(bd)))))
      : v.filter(filtros[a.p_filtro] || filtros.todos);
    sel.sort((x, y) => (ultimoCorte(y) - ultimoCorte(x)) || y.estatus_desde.localeCompare(x.estatus_desde) || y.id - x.id);
    const lim = Math.min(Math.max(a.p_limite || 20, 1), 60), des = Math.max(a.p_desde || 0, 0);
    const cuenta = (k) => v.filter(filtros[k]).length;
    return { conteos: { en_curso: cuenta('en_curso'), por_revisar: cuenta('por_revisar'), por_instalar: cuenta('por_instalar'), sin_gestion: cuenta('sin_gestion'), por_firmar: cuenta('por_firmar'), firmados: cuenta('firmados'), por_subir: cuenta('por_subir'), todos: v.length },
      total: sel.length, desde: des, rol: yo.rol, hoy: hoy(),
      filas: sel.slice(des, des + lim).map((c) => { const s = c.servicios[0]; const rp = c.representantes.find((x) => x.orden === 1) || {};
        return { id: c.id, nombre: c.nombre, doc_tipo: c.doc_tipo, doc_numero: c.doc_numero, es_natural: c.es_natural, seg: segmento(c), estatus: c.estatus, estatus_desde: c.estatus_desde, lider: c.lider,
          ug_en: c.ug_en, ug_por: c.ug_por, creado_en: c.creado_en, es_top: c.es_top, ultimo_corte: ultimoCorte(c), por_instalar: porInstalar(c), provisional: !!c.provisional, n_serv: c.servicios.length,
          serv: s ? { codigo: s.codigo, sucursal: s.sucursal, plan: s.plan, categoria: s.categoria, estado: s.estado, telefono: s.telefono } : null,
          tel: rp.telefono || c.telefono || (s && s.telefono) || null, correo: rp.correo || c.correo_empresa || null, falta: faltantes(c), por_revisar: c.documentos.filter((d) => d.estado === 'por_revisar').length, por_subir: porSubir(c), aprobado_por_subir: aprobadoPorSubir(c) }; }) };
  },
  // Dedicados (lote 2, D): la ejecutiva ve los suyos; solo el administrador edita
  dedicados_lista(m, yo){
    if(!['admin', 'abogado', 'analista', 'lider'].includes(yo.rol)) return error('No tienes permiso para hacer esto');
    const filas = m.datos.clientes.filter((c) => c.dedicado && (yo.rol !== 'lider' || c.dedicado.ejecutiva_id === yo.id || c.lider_id === yo.id))
      .sort((x, y) => (y.dedicado.tipo === 'isp') - (x.dedicado.tipo === 'isp') || (y.dedicado.activo !== false) - (x.dedicado.activo !== false) || x.nombre.localeCompare(y.nombre))
      .map((c) => { const d = c.dedicado; return { id: c.id, nombre: c.nombre, doc_tipo: c.doc_tipo, doc_numero: c.doc_numero, provisional: !!c.provisional, tipo: d.tipo, seg: segmento(c), estatus: c.estatus,
        activo: d.activo !== false, ejecutiva: d.ejecutiva || null, verificar: !!d.verificar, verificar_motivo: d.verificar_motivo || null, ruta_documentos: d.ruta_documentos || null, ruta_contrato: d.ruta_contrato || null,
        vgt_por_firmar: (d.contratos || []).some((k) => k.tipo === 'vgt' && k.estatus !== 'firmado'), vgt_faltan: d.vgt ? d.vgt.faltan || 0 : 0, lider: c.lider,
        plazo: d.plazo || null, vacias: casillasVacias(c), por_revisar: c.documentos.filter((x) => x.estado === 'por_revisar').length, enlaces: (d.enlaces || []).filter((e) => e.activo).length,
        contrato: ((d.contratos || []).find((k) => k.tipo === 'servicio') || {}).estatus || null, vgt: (d.contratos || []).some((k) => k.tipo === 'vgt'), colocation: (d.contratos || []).some((k) => k.tipo === 'colocation'),
        // Corrida urgente 14/10: datos de operación
        capacidad: (d.enlaces || []).filter((e) => e.activo).reduce((a2, e) => a2 + (Number(e.cap_entregada || e.cap_facturada || e.cap_inicial) || 0), 0) || null,
        nodos: Array.from(new Set((d.enlaces || []).filter((e) => e.activo && e.nodo).map((e) => e.nodo))).join(', ') || null,
        contratos: (d.contratos || []).map((k) => ({ tipo: k.tipo, estatus: k.estatus, vence: k.vence || null, firmado_en: k.firmado_en || null, numero: k.numero || null })),
        vgt_proyectos: new Set((d.contratos || []).filter((k) => k.tipo === 'vgt').map((k) => k.proyecto || k.id)).size,
        vgt_postes: (d.contratos || []).filter((k) => k.tipo === 'vgt').reduce((a2, k) => a2 + (Number(k.postes) || 0), 0),
        poliza_vence: (c.documentos || []).filter((x) => x.casilla === 'otro' && [66, 67].includes(x.numero) && x.vence_en).map((x) => x.vence_en).sort()[0] || null }; });
    return { rol: yo.rol, hoy: hoy(), puedo: { editar: yo.rol === 'admin' }, filas };
  },
  dedicado_editar(m, yo, a){
    if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto');
    const c = m.datos.clientes.find((x) => x.id === Number(a.p_cliente)); if(!c || !c.dedicado) return error('Este cliente no está en Dedicados');
    const k = a.p_campos || {}; const d = c.dedicado;
    if(k.ruta_documentos && !['cargar', 'completar', 'pedir', 'validar'].includes(k.ruta_documentos)) return error('Ruta de documentos no válida');
    if('ruta_documentos' in k) d.ruta_documentos = k.ruta_documentos || null; if('ruta_contrato' in k) d.ruta_contrato = k.ruta_contrato || null;
    if('verificar' in k) d.verificar = !!k.verificar; if('verificar_motivo' in k) d.verificar_motivo = k.verificar_motivo || null;
    if('tipo' in k) d.tipo = k.tipo; if('plazo_documentos' in k) d.plazo = k.plazo_documentos || null;
    if(d.tipo === 'isp') c.es_isp = true;
    return null;
  },
  dedicado_contrato_editar(m, yo, a){
    if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto');
    let k = null; m.datos.clientes.forEach((c) => { if(c.dedicado) (c.dedicado.contratos || []).forEach((x) => { if(x.id === Number(a.p_id)) k = x; }); });
    if(!k) return error('No encontré ese contrato');
    const v = a.p_campos || {}; if(v.firmado_en && v.firmado_en > hoy()) return error('La fecha de firma no puede ser futura');
    const est = 'estatus' in v ? v.estatus : k.estatus; const ve = 'vence_en' in v ? v.vence_en || null : k.vence_en || null; const fi = 'firmado_en' in v ? v.firmado_en || null : k.firmado_en || null;
    if(est === 'firmado' && !ve) return error('Pon la fecha de vencimiento del contrato');
    if(ve && fi && ve <= fi) return error('El vencimiento debe ser después de la firma');
    if('estatus' in v) k.estatus = v.estatus; if('firmado_en' in v) k.firmado_en = v.firmado_en || null; if('vence' in v) k.vence = v.vence || null; if('nota' in v) k.nota = v.nota || null;
    if('vence_en' in v) k.vence_en = v.vence_en || null; if('firma' in v) k.firma = v.firma || null;
    k.editado_por = yo.nombre; k.editado_en = hace(0); return null;
  },
  cliente_ficha(m, yo, a){
    const c = m.datos.clientes.filter((x) => ['admin', 'abogado', 'analista'].includes(yo.rol) || (yo.rol === 'lider' && x.lider_id === yo.id)).find((x) => x.id === Number(a.p_cliente)); if(!c) return error('No tienes acceso a este cliente');
    const actual = enCurso(); const rp = c.representantes.find((x) => x.orden === 1) || {}; const s0 = c.servicios[0];
    const r = yo.rol;
    return { rol: r, hoy: hoy(), yo: { id: yo.id, nombre: yo.nombre }, corte: { etiqueta: actual, fin: corteFin(actual), limite: corteLimite(actual), dias: dias(hoy(), corteLimite(actual)) },
      cliente: { id: c.id, nombre: c.nombre, doc_tipo: c.doc_tipo, doc_numero: c.doc_numero, es_natural: c.es_natural, seg: segmento(c), estatus: c.estatus, estatus_desde: c.estatus_desde, legal_ok_en: c.legal_ok_en,
        legal_como: c.legal_como || null, presencial: !!c.contrato_presencial, exc_pagada: !!c.exc_pagada, abierta: c.abierta || null, aprobado_por_subir: aprobadoPorSubir(c), por_subir: porSubir(c),
        dedicado: c.dedicado && !excluido(c) ? Object.assign({}, c.dedicado, { vacias: casillasVacias(c), contratos: (c.dedicado.contratos || []).map((k) => Object.assign({ con_archivo: k.tipo === 'servicio' && !!c.documentos.some((d) => d.casilla === 'contrato_dedicado' && (d.archivos || []).length) }, k)) }) : null,
        lider: c.lider, es_top: c.es_top, regimen_firma: c.regimen_firma, es_isp: c.es_isp, correo_empresa: c.correo_empresa, telefono: c.telefono, direccion: c.direccion,
        proforma_en: c.proforma_en, proforma_por: c.proforma_por, bienvenida_en: c.bienvenida_en, bienvenida_por: c.bienvenida_por, ug_en: c.ug_en, ug_por: c.ug_por, creado_en: c.creado_en, es_demo: c.es_demo,
        tel: rp.telefono || c.telefono || (s0 && s0.telefono) || null, correo: rp.correo || c.correo_empresa || null, por_instalar: porInstalar(c), por_subir: porSubir(c), aprobado_por_subir: aprobadoPorSubir(c), provisional: !!c.provisional, unido_a: c.unido_a || null,
        lider_id: c.lider_id || null, suspendido_en: c.suspendido_en || null, suspendido_por: c.suspendido_por || null, suspendido_nota: c.suspendido_nota || null, contrato_pend: contratoPend(c) },
      gestion: (c.gestiones || []).slice(0, 10), lideres: r === 'admin' ? m.personas.filter((p) => p.rol === 'lider' && p.activo !== false).map((p) => ({ id: p.id, nombre: p.nombre })) : null,
      orden: c.orden, servicios: c.servicios.map((sv) => Object.assign({}, sv, { envios: undefined, carta: cartaDe(m, c, sv), proforma_envio: ultimoEnvio(sv, 'proforma'), bienvenida_envio: ultimoEnvio(sv, 'bienvenida') })), representantes: c.representantes,
      documentos: c.documentos.slice().sort((x, y) => x.casilla.localeCompare(y.casilla) || x.numero - y.numero), requeridos: requeridos(c), faltantes: faltantes(c),
      hilo: c.hilo.slice().sort((x, y) => y.en.localeCompare(x.en) || y.id - x.id).map((h) => Object.assign({ mio: h.autor === yo.nombre }, h)), hilo_total: c.hilo.length,
      comision: c.instalaciones.map((i) => { const cn = corteDe(fechaClave(caracas(i.instalada_en))); const cp = i.corte_manual || cn; const com = comisionable(i);
        const ok = c.legal_ok_en && i.pago_ok_en ? Math.max(new Date(c.legal_ok_en).getTime(), new Date(i.pago_ok_en).getTime()) : null;
        const ook = ordenOk(c, i); const comE = com && comisionaEvento(i);
        const estado = i.anulada_en ? 'anulada' : !comE ? 'no_comisiona' : !ook ? 'por_asignar' : i.excepcion_corte ? 'cumple' : ok !== null && ok < limiteTs(masMeses(cp, 1)) ? 'cumple' : Date.now() < limiteTs(cp) ? 'en_curso' : Date.now() < limiteTs(masMeses(cp, 1)) ? 'ultimo_corte' : 'perdida';
        return { id: i.id, codigo: i.codigo, sucursal: i.sucursal, categoria: i.categoria, instalada_en: i.instalada_en, pago_ok_en: i.pago_ok_en, pago_manual: i.pago_manual, corte: cp, comisiona: comE, estado, es_evento: !!i.es_evento, evento_comisiona: i.es_evento ? !!i.evento_comisiona : null, evento_manual: !!i.evento_manual, motivo: motivoDe(c, i),
          servicio_id: (c.servicios.find((sv) => sv.codigo === i.codigo) || {}).id || null, es_aliado: i.es_aliado, instalador: i.instalador, orden: i.orden ? i.orden.numero : null, orden_ok: ook, dueno: duenoDe(c, i),
          dueno_whatsapp: m.personas.filter((p) => p.nombre === duenoDe(c, i)).map((p) => p.whatsapp)[0] || null, dueno_correo: m.personas.filter((p) => p.nombre === duenoDe(c, i)).map((p) => p.correo)[0] || null,
          excepcion_corte: i.excepcion_corte, excepcion_motivo: i.excepcion_motivo, excepcion_por: i.excepcion_por, movida: !!i.corte_manual, movida_motivo: i.corte_manual_motivo || null, corte_natural: cn,
          anulada: !!i.anulada_en, anulada_motivo: i.anulada_motivo || null, anulada_por: i.anulada_por || null, anulada_en: i.anulada_en || null, pago_nota: i.pago_nota || null,
          correccion: i.correccion || null, correccion_motivo: i.correccion_motivo || null, en_foto: enFoto(m, i.id), revisar_motivo: revisarMotivo(c, i),
          tad_deuda: ((c.servicios.find((sv) => sv.codigo === i.codigo) || {}).con_deuda), tad_visto: ((c.servicios.find((sv) => sv.codigo === i.codigo) || {}).tad_en) || null, pago_dias: m.pagoDias || 3,
          corte_pago: i.excepcion_corte ? i.excepcion_corte : ok === null ? null : ok < limiteTs(cp) ? cp : masMeses(cp, 1) }; }),
      puedo: { legal: r === 'admin', presencial: ['admin', 'abogado'].includes(r), exc_pagada: r === 'admin', revisar: ['admin', 'abogado'].includes(r), estatus: ['admin', 'abogado'].includes(r), contrato: ['admin', 'abogado'].includes(r), regimen: ['admin', 'abogado'].includes(r), top: r === 'admin', gestion: ['admin', 'analista'].includes(r), pago: esSenior(yo), asignar: esSenior(yo), evento: esSenior(yo), excepcion: r === 'admin', ip: ['admin', 'analista'].includes(r), enviar: ['admin', 'analista', 'lider'].includes(r),
        lider_cambiar: r === 'admin', suspender: r === 'admin', etiquetar: true } };
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
    if(['pedir', 'recordar'].includes(a.p_motivo)) etiquetar(c, 'esperando', hoy(), null, yo);
    return c.estatus;
  },
  // Lote 21/10: etiqueta de gestión, cambiar líder, suspender y aprobar seleccionados
  cliente_etiqueta(m, yo, a){
    const c = visibles(m, yo).find((x) => x.id === Number(a.p_cliente)); if(!c) return error('No tienes acceso a este cliente');
    const e = etiquetar(c, a.p_etiqueta, a.p_fecha, String(a.p_nota || '').trim() || null, yo); if(e) return e; gestion(c, yo); (m.bitacora = m.bitacora || []).push({ accion: 'cliente_etiqueta', registro: c.id, por: yo.nombre, etiqueta: a.p_etiqueta });
    return ultimaEtq(c);
  },
  cliente_lider_cambiar(m, yo, a){
    if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto');
    const c = m.datos.clientes.find((x) => x.id === Number(a.p_cliente)); if(!c) return error('Ese cliente no existe');
    const p = m.personas.find((x) => x.id === a.p_lider && x.rol === 'lider' && x.activo !== false); if(!p) return error('Elige un líder activo');
    let antes;
    if(a.p_cual === 'dedicado'){ if(!c.dedicado) return error('Este cliente no es dedicado'); antes = c.dedicado.ejecutiva; c.dedicado.ejecutiva = p.nombre; c.dedicado.ejecutiva_id = p.id; }
    else { antes = c.lider; c.lider = p.nombre; c.lider_id = p.id; }
    c.hilo.push(linea('dato', 'lider', { cual: a.p_cual, antes, lider: p.nombre }, yo.nombre)); (m.bitacora = m.bitacora || []).push({ accion: 'cliente_lider', registro: c.id, por: yo.nombre, antes, despues: p.nombre });
    return null;
  },
  cliente_suspender(m, yo, a){
    if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto');
    const c = m.datos.clientes.find((x) => x.id === Number(a.p_cliente)); if(!c) return error('Ese cliente no existe');
    const nt = String(a.p_nota || '').trim();
    if(a.p_suspender){ if(nt.length < 3) return error('Escribe por qué se suspende'); if(c.suspendido_en) return error('Ya está suspendido'); c.suspendido_en = hace(0); c.suspendido_por = yo.nombre; c.suspendido_nota = nt; }
    else { if(!c.suspendido_en) return error('No está suspendido'); c.suspendido_en = null; c.suspendido_por = null; c.suspendido_nota = null; }
    c.hilo.push(linea('dato', a.p_suspender ? 'suspendido' : 'reactivado', { nota: nt || null }, yo.nombre)); (m.bitacora = m.bitacora || []).push({ accion: a.p_suspender ? 'cliente_suspendido' : 'cliente_reactivado', registro: c.id, por: yo.nombre });
    return null;
  },
  documentos_marcar_varios(m, yo, a){
    if(!['admin', 'abogado'].includes(yo.rol)) return error('No tienes permiso para hacer esto');
    const ids = a.p_documentos || []; if(!ids.length) return error('Marca al menos un documento'); let n = 0;
    for(const x of ids){ const c = m.datos.clientes.find((k) => k.documentos.some((d) => d.id === Number(x) && d.estado === 'por_revisar')); if(!c) continue;
      const r = RPC.documento_marcar(m, yo, { p_documento: x, p_accion: 'aprobar' }); if(r && r.__error) return r; n++; }
    return n;
  },
  // Lote 3: Legal a mano, marcas del expediente y correo VGT
  legal_aprobar(m, yo, a){ if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto'); const c = m.datos.clientes.find((x) => x.id === Number(a.p_cliente));
    if(String(a.p_motivo || '').trim().length < 3) return error('Escribe el motivo'); if(c.legal_ok_en) return error('Legal ya está listo');
    c.legal_ok_en = hace(0); c.legal_como = 'excepcion'; c.hilo.push(linea('dato', 'legal_aprobado', { motivo: a.p_motivo }, yo.nombre)); return null; },
  legal_quitar(m, yo, a){ if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto'); const c = m.datos.clientes.find((x) => x.id === Number(a.p_cliente));
    if(!c.legal_ok_en) return error('Este cliente no tiene Legal listo'); c.legal_ok_en = null; c.legal_como = null; c.hilo.push(linea('dato', 'legal_quitado', { motivo: a.p_motivo }, yo.nombre)); return null; },
  cliente_marca(m, yo, a){ if(!['admin', 'abogado'].includes(yo.rol)) return error('No tienes permiso para hacer esto'); const c = m.datos.clientes.find((x) => x.id === Number(a.p_cliente));
    if(a.p_marca === 'exc_pagada' && yo.rol !== 'admin') return error('Solo el administrador marca la excepción pagada');
    c[a.p_marca] = !!a.p_valor; c.hilo.push(linea('dato', a.p_marca, { valor: String(!!a.p_valor) }, yo.nombre)); if(a.p_marca === 'contrato_presencial') recalcular(c, yo); return null; },
  dedicado_vgt_correo(m, yo, a){ const c = m.datos.clientes.find((x) => x.id === Number(a.p_cliente)); if(!c || !c.dedicado || !c.dedicado.vgt) return error('No es un cliente dedicado');
    c.dedicado.vgt.correo = a.p_correo; c.dedicado.vgt.faltan = Math.max(0, (c.dedicado.vgt.faltan || 0) - (a.p_correo ? 1 : 0)); return null; },
  // ----- Lote 4: índice del TAD y cambios de categoría y titularidad -----
  tad_indice_iniciar(m, yo, a){ if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto'); const k = m.datos.cambiosK || (m.datos.cambiosK = { idx: {}, cargas: [], filas: [], sec: 0, archivo: null });
    k.cargas.push({ id: k.cargas.length + 1, archivo: a.p_archivo, filas: 0 }); return k.cargas.length; },
  tad_indice_parte(m, yo, a){ const k = m.datos.cambiosK; (a.p_filas || []).forEach((f) => { const cl = f.s + '-' + String(f.c).replace(/^0+/, ''); k.idx[cl] = { clave: cl, sucursal: f.s, codigo: String(f.c).replace(/^0+/, ''), doc_tipo: f.t, doc_numero: String(f.d || '').replace(/\D/g, '').replace(/^0+/, ''), nombre: f.n, plan: f.p, categoria: f.ca, estado: f.es, direccion: f.di, pon: f.pon || null, carga: a.p_carga }; });
    k.cargas[a.p_carga - 1].filas += (a.p_filas || []).length; return (a.p_filas || []).length; },
  tad_indice_cerrar(m, yo, a){ const k = m.datos.cambiosK; k.vigente = a.p_carga; k.cargas[a.p_carga - 1].en = new Date().toISOString(); return { filas: k.cargas[a.p_carga - 1].filas, confirmados: 0, sin_solicitud: 0 }; },
  servicios_buscar(m, yo, a){ const k = m.datos.cambiosK; if(!k || !k.vigente) return { sin_indice: true, titulares: [] };
    const t = String(a.p_texto || '').trim(); const d = t.replace(/\D/g, '').replace(/^0+/, ''); const n = t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if(d.length < 5 && n.length < 3) return error('Escribe al menos 3 letras o el RIF o la cédula');
    const g = {}; Object.values(k.idx).filter((i) => i.carga === k.vigente && (d.length >= 5 ? i.doc_numero.indexOf(d) === 0 || d.indexOf(i.doc_numero) === 0 : String(i.nombre).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').indexOf(n) >= 0))
      .forEach((i) => { (g[i.doc_numero] = g[i.doc_numero] || { doc_tipo: i.doc_tipo, doc_numero: i.doc_numero, nombre: i.nombre, servicios: [] }).servicios.push(i); });
    return { sin_indice: false, titulares: Object.values(g) }; },
  cambios_lista(m, yo){ if(!['admin', 'analista', 'lider'].includes(yo.rol)) return error('No tienes permiso para hacer esto'); const k = m.datos.cambiosK || { filas: [], cargas: [] }; const sen = esSenior(yo);
    return { rol: yo.rol, desde: m.cambiosDesde || '2026-09-21', puedo: { aprobar: yo.rol === 'admin', emitir: ['admin', 'analista'].includes(yo.rol), confirmar: sen, vincular: sen, decidir: sen }, indice: k.vigente ? { en: k.cargas[k.vigente - 1].en, filas: k.cargas[k.vigente - 1].filas } : null,
      archivo: k.archivo, lideres: sen ? m.personas.filter((p) => p.rol === 'lider' && p.activo).map((p) => ({ id: p.id, nombre: p.nombre })) : [],
      filas: (k.filas || []).filter((c) => yo.rol !== 'lider' || c.lider_id === yo.id || c.creado_por_id === yo.id).map((c) => cambioJson(m, c)) }; },
  cambio_crear(m, yo, a){ const k = m.datos.cambiosK; const p = a.p_datos || {}; if(!k || !k.vigente) return error('Todavía no se ha subido el TAD completo');
    const sv = (p.servicios || []).map((cl) => k.idx[cl]).filter(Boolean); if(!sv.length) return error('Elige al menos un servicio');
    if(new Set(sv.map((x) => x.doc_numero)).size > 1) return error('Los servicios deben ser del mismo titular');
    if(p.tipo !== 'titularidad' && !p.categoria_nueva) return error('Elige la categoría nueva');
    if(p.tipo !== 'titularidad' && !CATEGORIAS.includes(String(p.categoria_nueva).toUpperCase())) return error('Elige una categoría de la lista');
    if(p.tipo !== 'categoria' && !['natural_natural', 'natural_juridico', 'juridico_natural', 'juridico_juridico'].includes(p.tipo_solicitud)) return error('Elige el tipo de solicitud');
    let cli = null;
    if(p.tipo !== 'categoria'){ const d = String(p.nuevo.doc).replace(/\D/g, '').replace(/^0+/, ''); cli = m.datos.clientes.find((c) => c.doc_numero === d);
      if(!cli){ cli = Object.assign({}, { id: 90000 + (++k.sec), nombre: p.nuevo.nombre.toUpperCase(), doc_tipo: p.nuevo.tipo, doc_numero: d, es_natural: !!p.nuevo.natural, estatus: 'documentos_solicitados', lider: yo.nombre, lider_id: yo.rol === 'lider' ? yo.id : null,
        servicios: [], representantes: [], documentos: [], hilo: [], instalaciones: [], orden: null, creado_en: new Date().toISOString(), direccion: null, correo_empresa: null, telefono: null }); m.datos.clientes.push(cli); } }
    const c = { id: ++k.sec, tipo: p.tipo, estado: p.tipo === 'categoria' ? 'por_emitir' : 'por_aprobar', origen: 'app', creado_en: new Date().toISOString(), creado_por: yo.nombre, creado_por_id: yo.id, lider_id: yo.rol === 'lider' ? yo.id : null, lider: yo.rol === 'lider' ? yo.nombre : null,
      titular: { tipo: sv[0].doc_tipo, doc: sv[0].doc_numero, nombre: sv[0].nombre, natural: p.tipo_solicitud ? p.tipo_solicitud.indexOf('natural_') === 0 : ['V', 'E'].includes(sv[0].doc_tipo) }, tipo_solicitud: p.tipo_solicitud || null, ocr: p.nuevo && p.nuevo.ocr || null, nuevo: cli ? { tipo: p.nuevo.tipo, doc: cli.doc_numero, nombre: cli.nombre, natural: !!p.nuevo.natural, cliente_id: cli.id } : null,
      categoria_anterior: sv[0].categoria, categoria_nueva: p.categoria_nueva, servicios: sv, nota: p.nota, bitacora: [{ accion: 'cambio_creado', en: new Date().toISOString(), por: yo.nombre }] };
    k.filas.push(c); return c.id; },
  // Corrida 14/10 tarde: ajustes del OCR (arrancan en NO)
  ocr_ajustes(m){ return Object.assign({ aliados: false, revision: false, expediente: false }, m.datos.ocrAjustes || {}); },
  ocr_ajuste_guardar(m, yo, a){ if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto');
    m.datos.ocrAjustes = Object.assign({ aliados: false, revision: false, expediente: false }, m.datos.ocrAjustes || {}, { [a.p_clave]: !!a.p_si }); (m.bitacora = m.bitacora || []).push({ accion: 'ajuste', clave: 'ocr_' + a.p_clave, valor: a.p_si ? 'si' : 'no' }); return Object.assign({}, m.datos.ocrAjustes); },
  cambio_categorias(m, yo){ if(!['admin', 'analista', 'lider'].includes(yo.rol)) return error('No tienes permiso para hacer esto'); return CATEGORIAS.slice(); },
  cambio_detalle(m, yo, a){ const c = ((m.datos.cambiosK || {}).filas || []).find((x) => x.id === Number(a.p_id)); if(!c) return error('No encontré ese cambio');
    return Object.assign(cambioJson(m, c), { nuevo_contacto: c.nuevo ? { correo: null, telefono: null, direccion: null } : null, bitacora: c.bitacora }); },
  cambio_accion(m, yo, a){ const c = ((m.datos.cambiosK || {}).filas || []).find((x) => x.id === Number(a.p_id)); if(!c) return error('No encontré ese cambio');
    const ok = { aprobar: yo.rol === 'admin' && c.estado === 'por_aprobar', emitido: ['admin', 'analista'].includes(yo.rol) && c.estado === 'por_emitir', rechazar: yo.rol === 'admin', vincular: esSenior(yo) && c.estado === 'sin_solicitud', error: esSenior(yo), revertido: esSenior(yo), cancelar: true, confirmar: esSenior(yo) }[a.p_accion];
    if(!ok) return error('No tienes permiso para hacer esto');
    if(a.p_accion === 'rechazar' && !a.p_nota) return error('Escribe por qué se rechaza');
    if(a.p_accion === 'vincular' && !a.p_lider) return error('Elige el líder');
    c.estado = { aprobar: 'por_emitir', emitido: 'emitido', rechazar: 'rechazado', vincular: 'confirmado', error: 'error', revertido: 'revertido', cancelar: 'cancelado', confirmar: 'confirmado' }[a.p_accion];
    if(a.p_lider){ c.lider_id = a.p_lider; c.lider = (m.personas.find((p) => p.id === a.p_lider) || {}).nombre; }
    if(c.estado === 'confirmado') confirmarCambio(m, c, c.fecha_archivo || null);
    c.bitacora.push({ accion: 'cambio_' + a.p_accion, en: new Date().toISOString(), por: yo.nombre }); return null; },
  cambios_archivo_cargar(m, yo, a){ if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto'); const k = m.datos.cambiosK || (m.datos.cambiosK = { idx: {}, cargas: [], filas: [], sec: 0 });
    let conf = 0; let ign = 0; let sins = 0; let n = 0;
    (a.p_filas || []).forEach((f) => { const pyme = /pyme/i; if(/radius/i.test(f.operador || '') || f.anterior === f.actual || !(pyme.test(f.anterior) || pyme.test(f.actual))){ ign++; return; } n++;
      const c = k.filas.find((x) => ['por_emitir', 'emitido'].includes(x.estado) && x.servicios.some((s) => s.codigo === String(f.codigo).replace(/^0+/, '')));
      const fi = /^\d{1,2}-\d{1,2}-\d{4}/.test(f.fecha || '') ? f.fecha.slice(6, 10) + '-' + f.fecha.slice(3, 5) + '-' + f.fecha.slice(0, 2) + 'T12:00:00Z' : null;
      if(c){ confirmarCambio(m, c, fi); conf++; }
      else { sins++; k.filas.push({ id: ++k.sec, tipo: 'categoria', estado: 'sin_solicitud', origen: 'archivo', creado_en: new Date().toISOString(), titular: { nombre: f.nombre, doc: null }, categoria_anterior: f.anterior, categoria_nueva: f.actual,
        servicios: [{ clave: '824-' + f.codigo, sucursal: '824', codigo: String(f.codigo).replace(/^0+/, '') }], bitacora: [], fecha_archivo: fi }); } });
    k.archivo = { en: new Date().toISOString(), filas: n }; return { filas: n, ignoradas: ign, confirmados: conf, sin_solicitud: sins }; },
  cambio_comision(m, yo, a){ const c = ((m.datos.cambiosK || {}).filas || []).find((x) => x.id === Number(a.p_id));
    if(!esSenior(yo)) return error('Solo el Analista Senior o el administrador deciden la comisión');
    if(!a.p_motivo || String(a.p_motivo).trim().length < 4) return error('Escribe el motivo');
    if(!c || c.estado !== 'confirmado' || !c.comision) return error('Ese cambio no tiene comisión por decidir');
    if(soloRegistro(m, c)) return error('Este cambio es de antes del 21/09/2026: queda solo como registro');
    if(a.p_si && c.comision === 'si') return error('Ya está marcado que comisiona');
    if(!a.p_si && c.comision === 'no') return error('Ya está marcado que no comisiona');
    if(a.p_si && !c.lider_id) return error('Primero vincula el cambio a un líder');
    if(!a.p_si && c.comision === 'si' && c.certificado) return error('Ya está en un corte certificado: no se puede quitar');
    c.comision = a.p_si ? 'si' : 'no'; c.comision_motivo = a.p_motivo; c.comision_por = yo.nombre; c.comision_en = new Date().toISOString(); if(a.p_si) c.instalacion_id = c.instalacion_id || 5000 + c.id;
    c.bitacora.push({ accion: 'cambio_comision', en: c.comision_en, por: yo.nombre, despues: { comision: c.comision, motivo: a.p_motivo } }); return null; },
  subidas_ultimas(m){ const k = m.datos.cambiosK || {}; return { tad: null, odoo: null, instalaciones: null, indice: k.vigente ? k.cargas[k.vigente - 1].en : null, cambios: k.archivo ? k.archivo.en : null }; },
  // ----- Lote 6: una sola fuente de pendientes -----
  trabajo(m, yo, a){
    if(!['admin', 'analista', 'lider'].includes(yo.rol)) return error('No tienes permiso para hacer esto');
    const sen = esSenior(yo); const can = !!yo.canales; const h = hoy();
    const filas = misPendientes(m, yo, a.p_persona).map((p) => Object.assign({}, p, { modulo: moduloDe(p.tipo), color: p.vence < h ? 'rojo' : p.vence === h ? 'ambar' : 'verde', nuevo: p.desde > new Date(Date.now() - 864e5).toISOString(),
      lider: (m.personas.find((x) => x.id === p.lider_id) || {}).nombre || null, analista: (m.personas.find((x) => x.id === p.analista_id) || {}).nombre || null }));
    filas.sort((x, y) => ({ rojo: 0, ambar: 1, verde: 2 }[x.color] - { rojo: 0, ambar: 1, verde: 2 }[y.color]));
    return { rol: yo.rol, senior: yo.rol === 'analista' && !!yo.senior, canales: can, hoy: h, dias: Object.assign({}, m.datos.dias || { dias_orden_sin_instalar: '15', dias_sin_documentos: '30', dias_por_enviar: '3', dias_cambio_por_emitir: '2' }),
      personas: yo.rol === 'admin' || can ? m.personas.filter((p) => p.activo && (p.rol === 'analista' || (yo.rol === 'admin' && p.rol === 'lider'))).map((p) => ({ id: p.id, nombre: p.nombre, rol: p.rol })) : [],
      aliados: yo.rol === 'admin' || can ? { solicitudes: 2, referidos: 1, pagos: 1, sin_permiso: 3 } : null, filas }; },
  trabajo_resumen(m, yo){ if(!['admin', 'analista', 'lider'].includes(yo.rol)) return null; const h = hoy(); const l = misPendientes(m, yo, null); const tipos = {};
    l.forEach((p) => { const t = tipos[p.tipo] || (tipos[p.tipo] = { n: 0, rojo: 0 }); t.n++; if(p.vence < h) t.rojo++; });
    const al = yo.rol === 'admin' || !!yo.canales ? { solicitudes: 2, referidos: 1, pagos: 1, sin_permiso: 3 } : null; const modulos = {};
    ['expedientes', 'comisiones', 'migraciones', 'dedicados', 'aliados'].forEach((k) => { const x = l.filter((p) => moduloDe(p.tipo) === k);
      modulos[k] = { n: x.length + (k === 'aliados' && al ? al.solicitudes + al.pagos + al.sin_permiso : 0), rojo: x.filter((p) => p.vence < h).length, hoy: x.filter((p) => p.vence === h).length }; });
    return { total: l.length, rojo: l.filter((p) => p.vence < h).length, hoy: l.filter((p) => p.vence === h).length, tipos, modulos, aliados: al }; },
  trabajo_hecho(){ return error('Los pendientes ya no se marcan a mano: salen solos cuando se resuelven'); },
  lideres_analistas(m, yo){ if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto'); const l = {}; m.personas.filter((p) => p.rol === 'lider').forEach((p) => { l[p.id] = p.analista_id || null; });
    return { lideres: l, analistas: m.personas.filter((p) => p.rol === 'analista' && p.activo).map((p) => ({ id: p.id, nombre: p.nombre })) }; },
  // Lote 7: Gerencia. Los hechos inventados imitan privado.gerencia_hechos; los filtros y permisos, privado.gerencia_filtrado.
  gerencia(m, yo, a){ const f = gerFiltrar(m, yo, a); if(f.__error) return f; const r = efectivo(yo);
    const g = new Map(); f.forEach((h) => { const d = ['com', 'ins', 'ali', 'ded'].includes(h.s) ? h.detalle : null; const k = [h.s, h.k, h.mes, h.lider_id, d].join('|');
      const x = g.get(k) || { s: h.s, k: h.k, mes: h.mes, l: h.lider_id, ln: (m.personas.find((p) => p.id === h.lider_id) || {}).nombre || null, d, c: 0, n: null, _n: [] }; x.c++; if(h.n !== null && h.n !== undefined) x._n.push(h.n); g.set(k, x); });
    return { rol: r, todo: r === 'admin' || r === 'gerencia', corte_actual: '2026-10-01',
      lideres: r === 'lider' ? [] : m.personas.filter((p) => p.rol === 'lider' && p.activo && !p.gerencia).map((p) => ({ id: p.id, nombre: p.nombre })),
      grupos: [...g.values()].map((x) => { x.n = x._n.length ? Math.round(10 * x._n.reduce((a2, b) => a2 + b, 0) / x._n.length) / 10 : null; delete x._n; return x; }) };
  },
  gerencia_lista(m, yo, a){ const f = gerFiltrar(m, yo, a); if(f.__error) return f; const r = efectivo(yo);
    return f.filter((h) => h.s === a.p_s && (!a.p_k || h.k === a.p_k) && (a.p_mes ? h.mes === a.p_mes : (!h.mes || (h.mes >= a.p_desde && h.mes <= a.p_hasta))) && (!a.p_detalle || h.detalle === a.p_detalle) && (!a.p_lider_fila || h.lider_id === a.p_lider_fila))
      .map((h) => ({ cliente_id: h.cliente_id, nombre: h.nombre, lider: (m.personas.find((p) => p.id === h.lider_id) || {}).nombre || null, k: h.k, detalle: h.detalle, mes: h.mes, n: h.n === undefined ? null : h.n, abre: !!h.cliente_id && r !== 'gerencia' }));
  },
  lider_analista(m, yo, a){ if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto'); const p = m.personas.find((x) => x.id === a.p_lider); if(!p || p.rol !== 'lider') return error('Ese usuario no es líder'); p.analista_id = a.p_analista; return null; },
  ajustes_app(m){ return Object.assign({ whatsapp_admin: null }, m.datos.dias || {}); },
  ajuste_guardar(m, yo, a){ if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto'); if(/^dias_/.test(a.p_clave) && !(Number(a.p_valor) > 0)) return error('Escribe un número de días mayor que cero');
    m.datos.dias = Object.assign(m.datos.dias || {}, { [a.p_clave]: String(a.p_valor) }); return null; },
  cliente_estatus(m, yo, a){
    if(!['admin', 'abogado'].includes(yo.rol)) return error('No tienes permiso para hacer esto');
    const c = visibles(m, yo).find((x) => x.id === Number(a.p_cliente)); if(!c) return error('No tienes acceso a este cliente');
    try { if(ponerEstatus(c, a.p_estatus, yo, 'manual')) gestion(c, yo); } catch (e) { return error(e.message); } return null;
  },
  cliente_dato(m, yo, a){
    const c = visibles(m, yo).find((x) => x.id === Number(a.p_cliente)); if(!c) return error('No tienes acceso a este cliente');
    const v = String(a.p_valor || '').trim() || null;
    if(a.p_campo === 'correo_empresa'){ if(v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return error('Ese correo no parece válido'); c.correo_empresa = v ? v.toLowerCase() : null; }
    else if(a.p_campo === 'regimen_firma'){ if(!['admin', 'abogado'].includes(yo.rol)) return error('No tienes permiso para hacer esto'); c.regimen_firma = v; }
    else if(a.p_campo === 'es_isp'){ if(!['admin', 'abogado'].includes(yo.rol)) return error('No tienes permiso para hacer esto'); c.es_isp = v === 'true'; }
    else if(a.p_campo === 'es_top'){ if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto'); c.es_top = v === 'true'; }
    else if(a.p_campo === 'direccion'){ c.direccion = v; }
    else if(a.p_campo === 'nombre'){ if(!['admin', 'analista', 'abogado'].includes(yo.rol)) return error('No tienes permiso para hacer esto'); if(!v || v.length < 3) return error('Escribe la razón social completa'); c.nombre = v.toUpperCase(); }
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
  // Lote urgente 20/10: cambiar de corte entre el corte en curso y el siguiente (abiertos), con motivo y bitácora
  instalacion_mover_corte(m, yo, a){
    if(!esSenior(yo)) return error('Esto lo hace el Analista Senior o el administrador');
    const x = instPorId(m, a.p_instalacion); if(!x) return error('No se encontró la instalación');
    const mot = String(a.p_motivo || '').trim(); if(mot.length < 5) return error('Escribe el motivo');
    const act = enCurso(); const sig = corteDe(hoy()) > act ? corteDe(hoy()) : act; const dest = String(a.p_corte || '').slice(0, 8) + '01';
    const nat = corteDe(fechaClave(caracas(x.i.instalada_en))); const ef = x.i.corte_manual || nat;
    if(dest !== act && dest !== sig) return error('Solo se puede pasar al corte en curso o al siguiente');
    if(cerrado(ef)) return error('Está en un corte cerrado: no se mueve');
    if(cerrado(dest)) return error('Ese corte ya está cerrado');
    if(dest === ef) return error('Ya está en ese corte');
    x.i.corte_manual = dest === nat ? null : dest; x.i.corte_manual_motivo = dest === nat ? null : mot;
    (m.bitacora = m.bitacora || []).push({ accion: 'instalacion_corte_movida', instalacion: x.i.id, por: yo.id, antes: ef, despues: dest, motivo: mot });
    return { corte: dest, movida: dest !== nat };
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
  corte_cierre_resumen(m, yo, a){
    if(!esSenior(yo)) return error('Esto lo hace el Analista Senior o el administrador');
    const c = String(a.p_corte).slice(0, 8) + '01'; const admin = m.personas.find((p) => p.rol === 'admin'); const f = filasComision(m, admin, c);
    return { corte: c, total: f.length, cumplen: f.filter((x) => x.cumple).length, pasan: f.filter((x) => x.origen === 'corte' && !x.cumple).length,
      se_pierden: f.filter((x) => x.origen === 'anterior' && !x.cumple).length, por_asignar: f.filter((x) => !x.orden_ok).length };
  },
  // Lote urgente 20/10: "Cerrar corte" (certificar). Desde octubre 2026, desde que terminan sus instalaciones y en orden.
  corte_certificar(m, yo, a){
    if(!esSenior(yo)) return error('Esto lo hace el Analista Senior o el administrador');
    const c = String(a.p_corte).slice(0, 8) + '01'; m.certificados = m.certificados || {};
    if(m.certificados[c]) return error('Ese corte ya está cerrado');
    if(c >= DESDE_MANUAL){
      if(hoy() <= corteFin(c)){ const d = masDias(corteFin(c), 1); return error('Este corte se puede cerrar desde el ' + d.slice(8, 10) + '/' + d.slice(5, 7) + ', cuando terminan sus instalaciones'); }
      if(!cerrado(masMeses(c, -1))) return error('Primero cierra el corte anterior (' + masMeses(c, -1).slice(5, 7) + '/' + masMeses(c, -1).slice(0, 4) + ')');
    } else if(hoy() < corteCertifica(c)) return error('Este corte se certifica desde el ' + corteCertifica(c).slice(8, 10) + '/' + corteCertifica(c).slice(5, 7));
    const r = RPC.corte_cierre_resumen(m, yo, a); const admin = m.personas.find((p) => p.rol === 'admin'); const filas = filasComision(m, admin, c);
    m.certificados[c] = { en: hace(0), por: yo.nombre, total: filas.length, cumplen: r.cumplen, filas };
    (m.bitacora = m.bitacora || []).push({ accion: 'corte_cerrado', corte: c, por: yo.id, total: r.total, cumplen: r.cumplen, pasan: r.pasan, se_pierden: r.se_pierden });
    return { total: r.total, cumplen: r.cumplen, pasan: r.pasan, se_pierden: r.se_pierden };
  },
  corte_descertificar(m, yo, a){
    if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto');
    const c = String(a.p_corte).slice(0, 8) + '01'; if(!(m.certificados || {})[c]) return error('Ese corte no está certificado');
    if(c >= DESDE_MANUAL && cerrado(masMeses(c, 1))) return error('No se puede abrir: el corte siguiente ya está cerrado');
    delete m.certificados[c]; return null;
  },
  // ----- Lote 21/10 -----
  instalacion_no_comisiona(m, yo, a){
    if(!esSenior(yo)) return error('Esto lo hace el Analista Senior o el administrador');
    const x = instPorId(m, a.p_instalacion); if(!x) return error('No se encontró la instalación');
    const mot = String(a.p_motivo || '').trim();
    if(a.p_si){
      if(x.i.anulada_en) return error('Ya no comisiona'); if(mot.length < 5) return error('Escribe el motivo');
      if(enFoto(m, x.i.id)) return error('Está en un corte certificado: usa Corregir certificado');
      Object.assign(x.i, { anulada_en: hace(0), anulada_motivo: mot, anulada_por: yo.nombre });
      (m.bitacora = m.bitacora || []).push({ accion: 'instalacion_no_comisiona', instalacion: x.i.id, por: yo.id, motivo: mot }); return null;
    }
    if(yo.rol !== 'admin') return error('Solo el administrador la vuelve a activar');
    if(!x.i.anulada_en || !x.i.anulada_motivo) return error('Esta instalación no se marcó como No comisiona');
    Object.assign(x.i, { anulada_en: null, anulada_motivo: null, anulada_por: null });
    (m.bitacora = m.bitacora || []).push({ accion: 'instalacion_reactivada', instalacion: x.i.id, por: yo.id }); return null;
  },
  instalacion_corregir_certificado(m, yo, a){
    if(yo.rol !== 'admin') return error('Solo el administrador corrige un corte certificado');
    const x = instPorId(m, a.p_instalacion); if(!x || x.i.anulada_en) return error('No se encontró la instalación');
    if(!['no_se_pago', 'se_pago'].includes(a.p_accion)) return error('Elige qué pasó');
    const mot = String(a.p_motivo || '').trim(); if(mot.length < 5) return error('Escribe el motivo');
    const c = enFoto(m, x.i.id) || x.i.corte_manual || corteDe(fechaClave(caracas(x.i.instalada_en)));
    if(!(m.certificados || {})[c]) return error('No está en un corte certificado');
    const ab = enCurso();
    if(a.p_accion === 'no_se_pago') Object.assign(x.i, { corte_manual: ab, corte_manual_motivo: mot, correccion: 'no_se_pago', correccion_motivo: mot });
    else Object.assign(x.i, { corte_manual: c, excepcion_corte: c, excepcion_motivo: mot, correccion: 'se_pago', correccion_motivo: mot });
    (m.bitacora = m.bitacora || []).push({ accion: 'corte_certificado_correccion', instalacion: x.i.id, por: yo.id, accion_c: a.p_accion, corte: a.p_accion === 'no_se_pago' ? ab : c });
    return { corte: a.p_accion === 'no_se_pago' ? ab : c };
  },
  instalacion_pago_nota(m, yo, a){
    if(!esSenior(yo)) return error('Esto lo hace el Analista Senior o el administrador');
    const x = instPorId(m, a.p_instalacion); if(!x) return error('No se encontró la instalación');
    x.i.pago_nota = String(a.p_nota || '').trim().slice(0, 500) || null; (m.bitacora = m.bitacora || []).push({ accion: 'pago_nota', instalacion: x.i.id }); return null;
  },
  pago_dias(m, yo){ return m.pagoDias == null ? 3 : m.pagoDias; },
  pago_dias_guardar(m, yo, a){
    if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto');
    const n = Number(a.p_dias); if(!Number.isInteger(n) || n < 0 || n > 30) return error('Escribe un número de días entre 0 y 30');
    m.pagoDias = n; (m.bitacora = m.bitacora || []).push({ accion: 'ajuste', clave: 'pago_dias_tad', valor: n }); return n;
  },
  instalacion_pago(m, yo, a){
    if(!esSenior(yo)) return error('Esto lo hace el Analista Senior o el administrador');
    for(const c of m.datos.clientes){ const i = c.instalaciones.find((x) => x.id === Number(a.p_instalacion));
      if(i){ i.pago_ok_en = a.p_pagada ? (i.pago_ok_en || hace(0)) : null; i.pago_manual = true; i.pago_quitado = !a.p_pagada; c.hilo.push(linea('pago', a.p_pagada ? 'pagada' : 'pendiente', {}, yo.nombre)); return null; } }
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
    let n = 0; const etiquetas = []; let recalc = false;
    const aprob = yo.rol === 'admin' && LEGAL_OK.includes(c.estatus);   // lo del admin a un cliente aprobado entra aprobado
    for(const it of items){
      if(!(it.casillas || []).length) return error('Marca qué trae cada archivo');
      // Solo acepta lo que drive_subir dejó en Drive para ese cliente y ese usuario
      for(const ar of it.archivos){ const s = m.datos.subidas[ar.drive_id]; if(!s || s.cliente !== c.id || s.usuario !== yo.id) return error('El archivo no terminó de subir. Intenta de nuevo'); }
      const archivos = it.archivos.map((ar) => { const s = m.datos.subidas[ar.drive_id]; return { id: ++sec, ruta: null, drive_id: ar.drive_id, url_externa: 'https://drive.google.com/file/d/' + ar.drive_id + '/view', nombre: s.nombre, mime: s.mime, tamano: s.tamano }; });
      for(const ca of it.casillas){
        let num = Number(ca.numero || 0);
        if(/^contrato_/.test(ca.casilla) && !['admin', 'abogado'].includes(yo.rol)) return error('El contrato lo sube Legal');
        if(/^contrato_/.test(ca.casilla) && it.firmado_en && !it.vence_en) return error('Pon la fecha de vencimiento del contrato');
        if(ca.casilla === 'otro' && !(num >= 60)) num = c.documentos.filter((d) => d.casilla === 'otro' && d.numero < 60).length + 1;
        else if(!['cedula', 'rif_personal', 'acta_asamblea'].includes(ca.casilla)) num = 0;
        let d = busca(c, ca.casilla, num);
        if(!d){ d = { id: ++sec, casilla: ca.casilla, numero: num }; c.documentos.push(d); }
        const ok = aprob && !/^contrato_/.test(ca.casilla); if(!ok) recalc = true;
        const esOtro = ca.casilla === 'otro' && num < 60;
        Object.assign(d, { estado: ok ? 'aprobado' : 'por_revisar', motivo: null, nota: esOtro ? it.nota || null : null, titulo: esOtro ? it.titulo || d.titulo || null : d.titulo || null, vence_en: it.vence_en || null, firmado_en: it.firmado_en || null, subido_en: hace(0), subido_por: yo.nombre, revisado_en: ok ? hace(0) : null, revisado_por: ok ? yo.nombre : null, archivos, comparte: [] });
        if(c.marcas) delete c.marcas[d.id];   // archivo nuevo: la marca anterior ya no vale (disparador marca_al_subir)
        etiquetas.push({ casilla: ca.casilla, numero: num }); n++;
      }
      if(it.casillas.length > 1) it.casillas.forEach((ca) => { const d = c.documentos.find((x) => x.archivos === archivos && x.casilla === ca.casilla); if(d) d.comparte = c.documentos.filter((x) => x.archivos === archivos && x !== d).map((x) => ({ casilla: x.casilla, numero: x.numero })); });
    }
    c.hilo.push(linea('documento_subido', String(n), { casillas: etiquetas }, yo.nombre)); gestion(c, yo); if(recalc) recalcular(c, yo); return n;
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
  // Revisión de una sola vez: marcar no cambia el estatus ni deja hilo; cerrar aplica todo junto
  documento_marcar(m, yo, a){
    if(!['admin', 'abogado'].includes(yo.rol)) return error('No tienes permiso para hacer esto');
    for(const c of m.datos.clientes){ const d = c.documentos.find((x) => x.id === Number(a.p_documento)); if(!d) continue;
      const nt = String(a.p_nota || '').trim() || null; c.marcas = c.marcas || {};
      if(a.p_accion === 'quitar') delete c.marcas[d.id];
      else if(a.p_accion === 'aprobar'){
        const ant = c.marcas[d.id];
        if(ant && ant.origen === 'ia' && ant.accion === 'devolver'){
          if(yo.rol !== 'admin') return error('Aprobar lo que la IA devolvió es una excepción: la concede el administrador');
          if(!nt || nt.length < 5) return error('Escribe el motivo de la excepción');
        }
        c.marcas[d.id] = { documento: d.id, accion: 'aprobar', motivo: null, nota: nt, vence_en: a.p_vence || null, por: yo.nombre, en: hace(0), origen: 'manual' };
      }
      else if(a.p_accion === 'devolver'){
        if(!['vencido', 'ilegible', 'no_corresponde', 'falta_firma', 'otro'].includes(a.p_motivo)) return error('Elige por qué lo devuelves');
        if(a.p_motivo === 'otro' && !nt) return error('Escribe el motivo en la nota');
        c.marcas[d.id] = { documento: d.id, accion: 'devolver', motivo: a.p_motivo, nota: nt, vence_en: null, por: yo.nombre, en: hace(0), origen: 'manual' };
      } else return error('Acción no reconocida');
      (m.bitacora = m.bitacora || []).push({ accion: 'documento_marcado', registro: d.id, por: yo.nombre });
      return null; }
    return error('Ese documento ya no existe');
  },
  revision_estado(m, yo, a){
    if(!['admin', 'abogado'].includes(yo.rol)) return error('No tienes permiso para hacer esto');
    const c = visibles(m, yo).find((x) => x.id === Number(a.p_cliente)); if(!c) return error('No tienes acceso a este cliente');
    const p = m.personas.find((x) => x.id === c.lider_id);
    avanzarIA(m, c);
    return { puede_cerrar: yo.rol === 'admin', puede_ia: yo.rol === 'admin', lider_whatsapp: p ? p.whatsapp || null : null, archivos: archivosDe(c).length, nuevos: archivosDe(c).filter((x) => !(c.leidos || {})[x]).length,
      marcas: Object.values(c.marcas || {}).filter((x) => x.accion), historial: (c.revisiones || []).slice().reverse(),
      ia: c.ia ? Object.assign({}, c.ia, { cambio: c.ia.estado === 'lista' && c.ia.huella !== huellaIA(c), sin_leer: c.ia.estado === 'lista' ? sinLeer(c) : 0 }) : null };
  },
  // ----- Revisión con IA (en pequeño: avanza un archivo cada vez que alguien pregunta) -----
  ia_estimar(m, yo, a){
    if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto');
    return { clientes: (a.p_clientes || []).map((id) => m.datos.clientes.find((c) => c.id === Number(id))).filter(Boolean).map((c) => ({ cliente: c.id, nombre: c.nombre, archivos: archivosDe(c).length,
      nuevos: archivosDe(c).filter((x) => !(c.leidos || {})[x]).length, activa: iaActiva(c) })), precio_entrada: 2, precio_salida: 12 };
  },
  ia_lanzar(m, yo, a){
    if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto');
    const ids = a.p_clientes || []; if(!ids.length) return error('Elige al menos un cliente'); if(ids.length > 25) return error('Son muchos clientes de una vez. Elige hasta 25');
    const lanzadas = []; const omitidos = [];
    ids.forEach((id) => { const c = m.datos.clientes.find((x) => x.id === Number(id)); if(!c) return;
      if(!archivosDe(c).length){ omitidos.push({ cliente: c.id, motivo: 'No tiene documentos' }); return; }
      if(iaActiva(c)){ omitidos.push({ cliente: c.id, motivo: 'Ya se está revisando' }); return; }
      const n = archivosDe(c).length; m.secIA = (m.secIA || 0) + 1;
      c.ia = { id: m.secIA, estado: 'leyendo', avance: 0, total: n, nuevos: archivosDe(c).filter((x) => !(c.leidos || {})[x]).length, veredicto: null, puntos: [], excepciones: [], costo_usd: 0, modelo: 'gemini-de-prueba',
        error: null, lanzada_en: hace(0), terminada_en: null, por: yo.nombre, trabada: false, marcas: [] };
      (m.bitacora = m.bitacora || []).push({ accion: 'ia_lanzada', registro: c.ia.id, por: yo.nombre });
      lanzadas.push(c.ia.id); });
    return { lanzadas, omitidos };
  },
  ia_reanudar(m, yo, a){
    if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto');
    const c = m.datos.clientes.find((x) => x.ia && x.ia.id === Number(a.p_corrida)); if(!c) return error('Esa revisión ya no existe');
    Object.assign(c.ia, { estado: 'leyendo', trabada: false, error: null }); return null;
  },
  ia_actualizar(m, yo, a){
    if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto');
    const c = m.datos.clientes.find((x) => x.ia && x.ia.id === Number(a.p_corrida)); if(!c || c.ia.estado !== 'lista') return error('Esa revisión ya no está abierta');
    const nv = sinLeer(c); if(!nv && c.ia.huella === huellaIA(c)) return { actualizada: false };
    const n = archivosDe(c).length; Object.assign(c.ia, { estado: 'en_cola', total: n, avance: n - nv, nuevos: nv, error: null });
    (m.bitacora = m.bitacora || []).push({ accion: 'ia_actualizada', registro: c.ia.id, por: yo.nombre });
    return { actualizada: true, nuevos: nv };
  },
  ia_excepcion(m, yo, a){
    if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto');
    const c = m.datos.clientes.find((x) => x.ia && x.ia.id === Number(a.p_corrida)); if(!c || c.ia.estado !== 'lista') return error('Esa revisión ya no está abierta');
    const p = c.ia.puntos.find((x) => x.id === a.p_punto); if(!p) return error('Ese punto no admite excepción');
    if(!a.p_quitar && String(a.p_motivo || '').trim().length < 5) return error('Escribe el motivo de la excepción');
    if(a.p_quitar){ delete p.excepcion; p.estado = 'bloquea'; } else { p.excepcion = a.p_motivo; p.estado = 'ok'; }
    c.ia.excepciones = (c.ia.excepciones || []).filter((x) => x.punto !== a.p_punto).concat(a.p_quitar ? [] : [{ punto: a.p_punto, motivo: a.p_motivo }]);
    c.ia.veredicto = c.ia.puntos.some((x) => x.estado === 'bloquea') || c.ia.marcas.some((x) => x.propuesta === 'problema') ? 'no_apto' : 'apto';
    (m.bitacora = m.bitacora || []).push({ accion: a.p_quitar ? 'ia_excepcion_quitada' : 'ia_excepcion', registro: c.ia.id, por: yo.nombre, motivo: a.p_motivo || null });
    return null;
  },
  revision_bandeja(m, yo, a){
    if(!['admin', 'abogado'].includes(yo.rol)) return error('No tienes permiso para hacer esto');
    m.datos.clientes.forEach((c) => avanzarIA(m, c));
    const grupos = (c) => [c.estatus === 'documentos_en_revision' ? 'por_revisar' : null, Object.values(c.marcas || {}).some((x) => x.accion) ? 'en_curso' : null,
      c.ia && c.ia.estado === 'lista' ? 'borradores' : null, c.ia && ['en_cola', 'leyendo', 'error'].includes(c.ia.estado) ? 'leyendo' : null,
      ['documentos_recibidos', 'contrato_en_curso'].includes(c.estatus) ? 'contrato' : null, c.estatus === 'por_firmar' ? 'por_firmar' : null, !c.suspendido_en && contratoPend(c) ? 'contrato_pend' : null, archivosDe(c).length ? 'analizables' : null].filter(Boolean);
    const conteos = {}; m.datos.clientes.forEach((c) => grupos(c).forEach((g) => { conteos[g] = (conteos[g] || 0) + 1; }));
    const b = norm(a.p_busca);
    const sel = m.datos.clientes.filter((c) => grupos(c).includes(a.p_bandeja) && (!b || norm(c.nombre).includes(b) || c.doc_numero.includes(String(a.p_busca || '').replace(/\D/g, '') || '@')));
    const des = a.p_desde || 0; const lim = a.p_limite || 30;
    return { rol: yo.rol, bandeja: a.p_bandeja, total: sel.length, desde: des, conteos, filas: sel.slice(des, des + lim).map((c) => ({ id: c.id, nombre: c.nombre, doc_tipo: c.doc_tipo, doc_numero: c.doc_numero, es_natural: c.es_natural,
      lider: c.lider, estatus: c.estatus, estatus_desde: c.estatus_desde, archivos: archivosDe(c).length, nuevos: archivosDe(c).filter((x) => !(c.leidos || {})[x]).length,
      marcas: Object.values(c.marcas || {}).filter((x) => x.accion).length, contrato_pend: contratoPend(c), ia: c.ia ? { estado: c.ia.estado, veredicto: c.ia.veredicto, avance: c.ia.avance, total: c.ia.total, costo_usd: c.ia.costo_usd, en: c.ia.terminada_en || c.ia.lanzada_en } : null })) };
  },
  ia_comparar(m, yo){
    if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto');
    return { filas: m.datos.clientes.filter((c) => c.ia && ['lista', 'cerrada'].includes(c.ia.estado)).map((c) => ({ corrida: c.ia.id, cliente: c.id, nombre: c.nombre, doc_tipo: c.doc_tipo, doc_numero: c.doc_numero,
      estado: c.ia.estado, veredicto: c.ia.veredicto, estatus: c.estatus, costo_usd: c.ia.costo_usd, en: c.ia.terminada_en,
      docs: c.ia.marcas.map((k) => { const d = c.documentos.find((x) => x.id === k.documento) || {}; return { casilla: d.casilla, numero: d.numero, ia: k.propuesta, nota: k.nota, legal: d.estado === 'aprobado' ? 'bien' : d.estado === 'devuelto' ? 'problema' : null }; }) })) };
  },
  revision_cerrar(m, yo, a){
    if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto');
    const c = visibles(m, yo).find((x) => x.id === Number(a.p_cliente)); if(!c) return error('No tienes acceso a este cliente');
    if(iaActiva(c)) return error('La IA todavía está leyendo este expediente. Espera a que termine');
    const marcas = Object.values(c.marcas || {}).filter((x) => x.accion); if(!marcas.length) return error('No hay documentos marcados. Aprueba o devuelve al menos uno');
    const conIA = !!(c.ia && c.ia.estado === 'lista'); if(conIA) c.ia.estado = 'cerrada';
    const antes = c.estatus; let ap = 0, dv = 0; const det = [];
    marcas.forEach((k) => { const d = c.documentos.find((x) => x.id === k.documento); if(!d) return;
      if(k.accion === 'aprobar'){ Object.assign(d, { estado: 'aprobado', motivo: null, nota: null, vence_en: k.vence_en || d.vence_en, revisado_por: k.por, revisado_en: hace(0) }); ap++; }
      else { Object.assign(d, { estado: 'devuelto', motivo: k.motivo, nota: k.nota, revisado_por: k.por, revisado_en: hace(0) }); dv++; }
      det.push({ casilla: d.casilla, numero: d.numero, accion: k.accion, motivo: k.motivo, nota: k.nota }); });
    c.marcas = {}; gestion(c, yo);
    const n0 = c.hilo.length; recalcular(c, yo);
    const rid = (m.secRev = (m.secRev || 0) + 1);
    const info = { revision: rid, aprobados: ap, devueltos: dv, documentos: det, antes, estatus: c.estatus };
    const l = linea(dv ? 'documento_devuelto' : 'documento_aprobado', 'revision', info, yo.nombre);
    if(c.hilo.length > n0) c.hilo[c.hilo.length - 1] = l; else c.hilo.push(l);   // una sola entrada en el hilo
    (c.revisiones = c.revisiones || []).push({ id: rid, en: hace(0), por: yo.nombre, antes, estatus: c.estatus, aprobados: ap, devueltos: dv, detalle: det, enviado: !!a.p_enviado, con_ia: conIA });
    (m.bitacora = m.bitacora || []).push({ accion: 'revision_cerrada', registro: rid, por: yo.nombre, mensaje: a.p_mensaje || null, enviado: !!a.p_enviado });
    return info;
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
    // Igual que tad_cerrar: la primera vez que el cliente sale sin deuda se marca el pago; nunca se quita uno marcado
    // y uno quitado a mano no vuelve solo (privado.pago_respetar). Lote 21/10: solo si la carga es N días (pago_dias_tad) después de instalar
    let pagos = 0; const lim = masDias(hoy(), -(m.pagoDias == null ? 3 : m.pagoDias));
    m.datos.clientes.filter((cl) => (c.vistas || []).includes(cl.id) && cl.servicios.some((sv) => sv.con_deuda === false)).forEach((cl) => cl.instalaciones.forEach((i) => {
      if(!i.pago_ok_en && !i.pago_quitado && fechaClave(caracas(i.instalada_en)) <= lim){ i.pago_ok_en = new Date().toISOString(); pagos++; } }));
    return Object.assign({}, c.resumen, { pagos_marcados: pagos, clientes_total: m.datos.clientes.length, filas: c.filas });
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
  cruce_aplicar(m, yo){ const r = cruceFalso(m, yo); if(!r.error){ m.cruceAplicado = true; m.ultimoCruce = { en: new Date().toISOString(), por: yo.nombre }; } return r; },
  cruce_estado(m, yo){
    if(!['admin', 'analista'].includes(yo.rol)) return error('No tienes permiso para hacer esto');
    const u = m.ultimoCruce || null;
    return { ultimo_en: u && u.en, ultimo_por: u && u.por, pendientes: (m.cargas || []).filter((c) => ['odoo', 'instalaciones', 'base_vieja'].includes(c.fuente) && c.estado !== 'procesando' && !(c.resumen || {}).solo_aliados && (!u || c.en > u.en)).length };
  },
  cargas_ultimas(m, yo){
    if(!['admin', 'analista'].includes(yo.rol)) return error('No tienes permiso para hacer esto');
    const u = m.ultimoCruce || null;
    return (m.cargas || []).filter((c) => c.estado !== 'procesando').slice().reverse()
      .map((c) => Object.assign({}, c, { cruce: (c.resumen || {}).solo_aliados ? 'aliados' : ['tad', 'dedicados'].includes(c.fuente) ? 'directo' : u && u.en >= c.en ? 'aplicado' : 'pendiente' }));
  },
  carga_solo_aliados(m, yo, a){
    const c = (m.cargas || []).find((x) => x.id === a.p_carga && x.estado === 'procesando' && x.fuente === 'instalaciones'); if(!c) return error('Esa carga ya no está abierta');
    c.resumen = Object.assign({}, c.resumen, { solo_aliados: true }); return null;
  },
  // Archivo de dedicados de la analista (lote 2, B)
  dedicados_iniciar(m, yo, a){
    if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto');
    m.cargas = m.cargas || []; const c = { id: m.cargas.length + 1, fuente: 'dedicados', archivo: a.p_archivo, en: new Date().toISOString(), por: yo.nombre, estado: 'procesando', filas: 0, hojas: {} };
    m.cargas.push(c); return c.id;
  },
  dedicados_parte(m, yo, a){
    const c = (m.cargas || []).find((x) => x.id === a.p_carga && x.estado === 'procesando' && x.fuente === 'dedicados'); if(!c) return error('Esa carga ya no está abierta');
    if(!['RESUMEN (enlaces)', 'RESUMEN (clientes y contactos)', 'base de contacto'].includes(a.p_hoja)) return error('Hoja no reconocida');
    (c.hojas[a.p_hoja] = c.hojas[a.p_hoja] || { cols: a.p_cols, filas: [] }).filas.push(...a.p_filas); return null;
  },
  dedicados_cerrar(m, yo, a){
    const c = (m.cargas || []).find((x) => x.id === a.p_carga && x.estado === 'procesando' && x.fuente === 'dedicados'); if(!c) return error('Esa carga ya no está abierta');
    if(!c.hojas['RESUMEN (enlaces)'] || !c.hojas['RESUMEN (clientes y contactos)']) return error('Al archivo le falta la hoja RESUMEN (enlaces)');
    c.estado = 'lista'; c.filas = Object.keys(c.hojas).reduce((s, h) => s + c.hojas[h].filas.length, 0);
    m.dedicadosCargados = c;
    return { dedicados: c.hojas['RESUMEN (clientes y contactos)'].filas.length, nuevos: 1, enlaces: c.hojas['RESUMEN (enlaces)'].filas.length, verificar: 0, contactos: 2 };
  },
  pendientes_lider(m, yo, a){
    if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto');
    const actual = enCurso(); const filas = filasComision(m, yo, actual).filter((f) => f.lider === a.p_lider);
    if(!filas.length) return error('Ese líder no tiene instalaciones en este corte');
    const txt = (x) => (x.k === 'cedula' || x.k === 'rif_personal') && x.n > 1 ? x.t + ' del representante ' + x.n : x.t;
    const p = m.personas.find((x) => x.activo && norm(x.nombre) === norm(a.p_lider));
    const ult = (m.bitacora || []).filter((b) => b.accion === 'pendientes_enviados' && b.registro_id === a.p_lider).pop();
    return { lider: a.p_lider, nombre: p ? p.nombre : a.p_lider, whatsapp: p ? p.whatsapp || null : null, corte: actual, fin: corteFin(actual), limite: corteLimite(actual), dias: dias(hoy(), corteLimite(actual)), ultimo: ult ? ult.en : null,
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
  instalacion_evento(m, yo, a){
    if(!esSenior(yo)) return error('Solo el Analista Senior puede hacer esto');
    const x = instPorId(m, a.p_instalacion); if(!x) return error('Esa instalación no existe');
    if(!comisionable(x.i)) return error('Esta instalación no comisiona: es de aliado o dedicado');
    const cp = corteDe(fechaClave(caracas(x.i.instalada_en))); if((m.certificados || {})[cp]) return error('Ese corte ya está certificado');
    x.i.es_evento = !!a.p_evento; x.i.evento_comisiona = a.p_evento ? !!a.p_comisiona : null; x.i.evento_manual = true;
    (m.bitacora = m.bitacora || []).push({ usuario: yo.usuario, accion: 'instalacion_evento', registro_id: String(x.i.id), despues: { es_evento: x.i.es_evento, comisiona: x.i.evento_comisiona }, en: new Date().toISOString() });
    x.c.hilo.push(linea('instalacion', 'evento', { instalacion: x.i.id, evento: x.i.es_evento, comisiona: x.i.evento_comisiona }, yo.nombre));
    return null;
  },
  creadores_odoo(m, yo){
    if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto');
    const k = m.creadores = m.creadores || { 'Ana Creadora': true };
    return ['Ana Creadora', 'Lucía Ferrer', 'Rosa Paredes'].map((n, j) => ({ nombre: n, ordenes: 9 - j * 3, marcado: !!k[n] }));
  },
  creador_por_otros(m, yo, a){
    if(yo.rol !== 'admin') return error('No tienes permiso para hacer esto');
    (m.creadores = m.creadores || { 'Ana Creadora': true })[a.p_nombre] = !!a.p_valor;
    (m.bitacora = m.bitacora || []).push({ usuario: yo.usuario, accion: 'creador_por_otros', registro_id: a.p_nombre, despues: { crea_por_otros: !!a.p_valor }, en: new Date().toISOString() });
    return null;
  },
  comisiones_corte(m, yo, a){
    if(yo.rol === 'aliado') return error('No tienes permiso para hacer esto');
    const actual = enCurso(); let vmax = corteDe(hoy()); if(vmax < actual) vmax = actual; let c = a.p_corte ? String(a.p_corte).slice(0, 8) + '01' : actual; if(c > vmax) c = vmax;
    const filas = filasComision(m, yo, c);
    const pinst = c === actual ? visibles(m, yo).filter((x) => x.orden && porInstalar(x)).map((x) => ({ orden: x.orden.numero, cliente_id: x.id, nombre: x.nombre, creada_en: x.orden.creada_en, etapa: x.orden.etapa, lider: x.lider })) : [];
    const comp = [5, 4, 3, 2, 1, 0].map((n) => { const k = masMeses(actual, -n); const f = filasComision(m, yo, k); return { corte: k, total: f.filter((x) => x.origen === 'corte').length, cumplen: f.filter((x) => x.cumple).length }; });
    const cuenta = (lista) => lista.filter((x) => x.origen === 'corte').reduce((o, x) => { o[x.lider] = (o[x.lider] || 0) + 1; return o; }, {});
    const A = cuenta(filas), B = cuenta(filasComision(m, yo, masMeses(c, -1)));
    const lideres = Array.from(new Set(Object.keys(A).concat(Object.keys(B)))).map((l) => ({ lider: l, actual: A[l] || 0, anterior: B[l] || 0 })).sort((x, y) => y.actual - x.actual || x.lider.localeCompare(y.lider));
    const cert = (m.certificados || {})[c]; const sen = esSenior(yo);
    const manual = c >= DESDE_MANUAL;
    return { corte: c, actual, siguiente: vmax > actual ? vmax : null, hoy: hoy(), inicio: corteInicio(c), fin: corteFin(c), limite: corteLimite(c), certifica: corteCertifica(c), dias: dias(hoy(), corteLimite(c)), rol: yo.rol,
      manual, abierto: !cert && !(!manual && hoy() > corteLimite(c)), cierra_desde: manual ? masDias(corteFin(c), 1) : null, filas, por_instalar: pinst, comparativa: comp, lideres,
      eventos: yo.rol === 'abogado' ? [] : [].concat.apply([], visibles(m, yo).map((x) => x.instalaciones.filter((i) => { const t = new Date(i.instalada_en).getTime();
        return i.es_evento && !i.evento_comisiona && comisionable(i) && t >= cierre(masMeses(c, -1)) && t < cierre(c); }).map((i) => ({ instalacion_id: i.id, cliente_id: x.id, nombre: x.nombre, instalada_en: i.instalada_en, codigo: i.codigo, sucursal: i.sucursal, lider: duenoDe(x, i) || 'Por asignar', evento_manual: !!i.evento_manual })))),
      duenos: sen ? DUENOS : [], certificado: cert ? { en: cert.en, por: cert.por, total: cert.total, cumplen: cert.cumplen } : null,
      no_comisionan: [].concat.apply([], visibles(m, yo).map((x) => x.instalaciones.filter((i) => i.anulada_en && i.anulada_motivo && (i.corte_manual || corteDe(fechaClave(caracas(i.instalada_en)))) === c)
        .map((i) => ({ instalacion_id: i.id, cliente_id: x.id, nombre: x.nombre, codigo: i.codigo, instalada_en: i.instalada_en, motivo: i.anulada_motivo, por: i.anulada_por, en: i.anulada_en })))),
      fuera_foto: cert && yo.rol === 'admin' ? [].concat.apply([], m.datos.clientes.map((x) => x.instalaciones.filter((i) => !i.anulada_en && comisionable(i) && (i.corte_manual || corteDe(fechaClave(caracas(i.instalada_en)))) === c && !cert.filas.some((f) => f.instalacion_id === i.id))
        .map((i) => ({ instalacion_id: i.id, cliente_id: x.id, nombre: x.nombre, codigo: i.codigo, instalada_en: i.instalada_en, motivo: motivoDe(x, i), evento: !!i.es_evento, lider: duenoDe(x, i) || 'Por asignar' })))) : null,
      puedo: { no_comisiona: sen, reactivar: yo.rol === 'admin', corregir: yo.rol === 'admin' && !!cert, pago_dias: yo.rol === 'admin', asignar: sen && !cert, pago: sen, excepcion: yo.rol === 'admin' && !cert, certificar: sen && !cert && c === actual && (manual ? hoy() > corteFin(c) : hoy() >= corteCertifica(c)),
        quitar_certificado: yo.rol === 'admin' && !!cert && !cerrado(masMeses(c, 1)) } };
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
module.exports = { baseDatos, RPC, usar, LUCIA, archivoDrive, driveSubir, horasReloj, corte: { corteDe, corteInicio, corteFin, corteLimite, corteCertifica, enCurso, fijarHoy: (d) => { hoyFijo = d; } } };
