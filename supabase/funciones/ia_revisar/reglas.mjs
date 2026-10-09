// Reglas de la revisión con IA (claude/ia-reglas.md). La IA solo lee; aquí se decide, siempre igual con los mismos datos.
// Corre en la función de borde ia_revisar y en las pruebas (pruebas/test16.js). Sin dependencias.

export const VERSION_REGLAS = '2';

// ---------- Texto y fechas ----------
export function norm(s){
  return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
const VACIAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'con', 'c', 'a', 'ca', 's', 'sa', 'srl', 'rl', 'compania', 'anonima', 'sociedad']);
const palabras = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 1 && !VACIAS.has(w)));
// Cuánto de lo corto aparece en lo largo (0 a 1); null si falta uno de los dos
export function parecido(a, b){
  const A = palabras(a); const B = palabras(b);
  if(!A.size || !B.size) return null;
  let n = 0; A.forEach((w) => { if(B.has(w)) n++; });
  return n / Math.min(A.size, B.size);
}
const soloDigitos = (s) => String(s == null ? '' : s).replace(/\D/g, '').replace(/^0+/, '');
const pad = (n) => String(n).padStart(2, '0');
const finDeMes = (y, m) => y + '-' + pad(m) + '-' + pad(new Date(Date.UTC(y, m, 0)).getUTCDate());
// Acepta 2031-05-31, 2031-05, 2031, 31/05/2031, 05/2031. finMes: la cédula vence el último día del mes impreso.
export function fecha(s, finMes){
  const t = String(s == null ? '' : s).trim(); let m;
  if((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return finMes ? finDeMes(+m[1], +m[2]) : m[1] + '-' + pad(m[2]) + '-' + pad(m[3]);
  if((m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) return finMes ? finDeMes(+m[3], +m[2]) : m[3] + '-' + pad(m[2]) + '-' + pad(m[1]);
  if((m = t.match(/^(\d{4})-(\d{1,2})$/))) return finDeMes(+m[1], +m[2]);
  if((m = t.match(/^(\d{1,2})[/.-](\d{4})$/))) return finDeMes(+m[2], +m[1]);
  if((m = t.match(/^(\d{4})$/))) return m[1] + '-12-31';
  return null;
}
const anio = (f) => (f ? Number(f.slice(0, 4)) : null);
const masAnios = (f, n) => (f ? (Number(f.slice(0, 4)) + n) + f.slice(4) : null);
export const fechaTexto = (f) => (f ? f.slice(8, 10) + '/' + f.slice(5, 7) + '/' + f.slice(0, 4) : '');
const pct = (x) => Math.round(x * 100) + ' %';

// ---------- Casillas y lo que la IA encuentra ----------
const TIPO_DE_CASILLA = { cedula: 'cedula', rif_personal: 'rif_personal', rif_empresa: 'rif_empresa', acta_constitutiva: 'acta_constitutiva', acta_asamblea: 'acta_asamblea', conatel: 'conatel', contrato_pyme: 'contrato', contrato_dedicado: 'contrato', otro: null };
const NOMBRE_TIPO = { cedula: 'una cédula', rif_personal: 'un RIF personal', rif_empresa: 'el RIF de la empresa', acta_constitutiva: 'un acta constitutiva', acta_asamblea: 'un acta de asamblea', conatel: 'un permiso de Conatel', contrato: 'un contrato', poder: 'un poder', otro: 'otro documento' };
const CASILLA_TEXTO = { cedula: 'Cédula', rif_personal: 'RIF personal', rif_empresa: 'RIF de la empresa', acta_constitutiva: 'Acta constitutiva', acta_asamblea: 'Acta de asamblea', conatel: 'Permiso de Conatel', contrato_pyme: 'Contrato PYME', contrato_dedicado: 'Contrato dedicado', otro: 'Otro documento' };
export function nombreCasilla(casilla, numero){
  const t = CASILLA_TEXTO[casilla] || casilla;
  return (casilla === 'cedula' || casilla === 'rif_personal') && numero > 1 ? t + ' del representante ' + numero : casilla === 'acta_asamblea' && numero > 1 ? t + ' ' + numero : t;
}

/*
  e = {
    hoy: 'AAAA-MM-DD',
    cliente: { nombre, es_natural, regimen_firma, es_isp },
    representantes: [{ orden, nombre, correo, telefono }],
    faltantes: [{ k, n, t, e: 'falta'|'devuelto', dato }],      // privado.faltantes
    documentos: [{ id, casilla, numero, estado, archivos: [archivo_id] }],   // solo archivos vigentes
    lecturas: { [archivo_id]: { estado: 'ok'|'ilegible'|'error'|'formato', error, documentos: [hallazgos] } },
    excepciones: [{ documento?, punto?, motivo }]                // las concede el administrador
  }
  Devuelve { veredicto: 'apto'|'no_apto'|'revisar_a_mano', puntos: [...], marcas: [...], representantes: [{ orden, nombre }] }
*/
export function evaluar(e){
  const hoy = e.hoy; const c = e.cliente || {}; const docs = e.documentos || []; const lect = e.lecturas || {};
  const exc = e.excepciones || [];
  const puntos = []; const marcas = {}; const usados = new Set();
  const punto = (id, titulo, estado, detalle, extra) => puntos.push(Object.assign({ id, titulo, estado, detalle: detalle || '' }, extra || {}));

  // Lo que la IA vio en los archivos de cada casilla
  const halla = (d) => {
    const r = [];
    (d.archivos || []).forEach((a) => { const l = lect[a]; ((l && l.documentos) || []).forEach((h, i) => r.push(Object.assign({ _archivo: a, _i: i }, h))); });
    return r;
  };
  const estadoLectura = (d) => {
    const ls = (d.archivos || []).map((a) => lect[a]).filter(Boolean);
    if(!ls.length) return 'sin_leer';
    if(ls.some((l) => l.estado === 'ok')) return 'ok';
    return ls[0].estado || 'error';
  };
  const elegir = (d) => {
    const tipo = TIPO_DE_CASILLA[d.casilla]; const hs = halla(d);
    if(tipo === null) return hs[0] || null;   // "Otro": vale lo que traiga
    const de = hs.filter((h) => h.tipo === tipo);
    if(!de.length) return null;
    // Varias actas de asamblea en un mismo archivo: la n-ésima para la casilla n
    const h = d.casilla === 'acta_asamblea' ? de[Math.min(de.length, Math.max(1, d.numero)) - 1] : de[0];
    usados.add(h._archivo + ':' + h._i);
    return h;
  };
  const marca = (d, propuesta, motivo, nota, h, datos) => {
    marcas[d.id] = { documento: d.id, propuesta, motivo: motivo || null, nota: nota || '', pagina: h && h.pagina_inicio ? Number(h.pagina_inicio) : null, datos: datos || null };
  };
  const excDoc = (d) => exc.find((x) => x.documento === d.id);
  const excPunto = (id) => exc.find((x) => x.punto === id);

  const H = {};   // hallazgo elegido por documento
  docs.forEach((d) => {
    const est = estadoLectura(d);
    if(est !== 'ok'){
      const t = est === 'formato' ? 'La IA no puede leer este tipo de archivo (por ejemplo Word). Míralo tú.' : est === 'sin_leer' ? 'El archivo todavía no se ha leído.' : 'El archivo no se pudo leer bien. Míralo tú.';
      marca(d, 'revisar_a_mano', null, t, null); return;
    }
    const h = elegir(d); H[d.id] = h;
    if(!h){
      // ¿Está en el archivo de otra casilla? (por ejemplo cédula y RIF subidos al revés)
      const tipo = TIPO_DE_CASILLA[d.casilla];
      const otro = tipo ? docs.filter((x) => x !== d).map((x) => ({ x, h: halla(x).find((y) => y.tipo === tipo) })).find((o) => o.h) : null;
      if(otro){
        marca(d, 'revisar_a_mano', null, 'Este archivo no trae ' + NOMBRE_TIPO[tipo] + '. Está en el archivo de ' + nombreCasilla(otro.x.casilla, otro.x.numero) + (otro.h.pagina_inicio ? ' (página ' + otro.h.pagina_inicio + ')' : '') + ': corrige las casillas en el expediente.', null);
        return;
      }
      const vistos = Array.from(new Set(halla(d).map((x) => NOMBRE_TIPO[x.tipo] || 'otro documento')));
      marca(d, 'problema', 'no_corresponde', 'En el archivo no está ' + (NOMBRE_TIPO[TIPO_DE_CASILLA[d.casilla]] || 'lo que dice la casilla') + (vistos.length ? '. La IA vio ' + vistos.join(' y ') + '.' : '.'), null); return;
    }
    if(h.legible === false){ marca(d, 'revisar_a_mano', null, 'Se ve borroso o incompleto. Míralo tú.', h); return; }
  });

  // ---------- Documento por documento ----------
  const rep = (n) => (e.representantes || []).find((r) => r.orden === n) || {};
  const nombresRep = {};
  docs.forEach((d) => {
    if(marcas[d.id]) return;
    const h = H[d.id]; const x = excDoc(d);
    if(d.casilla === 'cedula'){
      const venc = fecha(h.fecha_vencimiento, true); const exp = fecha(h.fecha_expedicion);
      if(h.nombre) nombresRep[d.numero] = h.nombre;
      const datos = { nombre: h.nombre || null, numero: h.numero || null, vence: venc, expedicion: exp };
      if(!venc){ marca(d, 'revisar_a_mano', null, 'No se leyó la fecha de vencimiento.', h, datos); return; }
      if(exp && anio(exp) + 10 !== anio(venc)){ marca(d, 'revisar_a_mano', null, 'El vencimiento (' + anio(venc) + ') no cuadra con la expedición (' + anio(exp) + ' más 10 años da ' + (anio(exp) + 10) + '). Puede estar mal leída.', h, datos); return; }
      if(venc < hoy){
        if(x) { marca(d, 'bien', null, 'Venció el ' + fechaTexto(venc) + '. Excepción: ' + x.motivo, h, datos); return; }
        marca(d, 'problema', 'vencido', 'Venció el ' + fechaTexto(venc) + '.', h, datos); return;
      }
      marca(d, 'bien', null, 'Vigente hasta el ' + fechaTexto(venc) + '.', h, datos); return;
    }
    if(d.casilla === 'rif_personal'){
      const venc = fecha(h.fecha_vencimiento); const datos = { nombre: h.nombre || null, numero: h.numero || null, vence: venc };
      if(!venc){ marca(d, 'revisar_a_mano', null, 'No se leyó la fecha de vencimiento.', h, datos); return; }
      if(venc < hoy){ marca(d, 'problema', 'vencido', 'Venció el ' + fechaTexto(venc) + '. El RIF vencido no admite excepción.', h, datos); return; }
      marca(d, 'bien', null, 'Vigente hasta el ' + fechaTexto(venc) + '.', h, datos); return;
    }
    if(d.casilla === 'rif_empresa'){
      const venc = fecha(h.fecha_vencimiento); const datos = { nombre: h.razon_social || h.nombre || null, numero: h.numero || null, vence: venc };
      if(!venc){ marca(d, 'revisar_a_mano', null, 'No se leyó la fecha de vencimiento.', h, datos); return; }
      if(venc < hoy){ marca(d, 'problema', 'vencido', 'Venció el ' + fechaTexto(venc) + '.', h, datos); return; }
      marca(d, 'bien', null, 'Vigente hasta el ' + fechaTexto(venc) + '.', h, datos); return;
    }
    if(d.casilla === 'acta_constitutiva' || d.casilla === 'acta_asamblea'){
      const insc = fecha(h.fecha_inscripcion);
      if(!insc){ marca(d, 'revisar_a_mano', null, 'No se leyó la fecha de inscripción en el Registro.', h); return; }
      marca(d, 'bien', null, 'Inscrita el ' + fechaTexto(insc) + '.' + (d.casilla === 'acta_asamblea' && (h.asamblea_temas || []).length ? ' Trata: ' + h.asamblea_temas.map((t) => TEMAS[t] || t).join(', ') + '.' : ''), h, { inscripcion: insc }); return;
    }
    if(d.casilla === 'contrato_pyme' || d.casilla === 'contrato_dedicado'){
      if(h.firmado === false){ marca(d, 'problema', 'falta_firma', 'El contrato no está firmado.', h); return; }
      marca(d, 'bien', null, h.firmante ? 'Firmado por ' + h.firmante + '.' : 'Firmado.', h); return;
    }
    marca(d, 'bien', null, 'Legible.', h);
  });

  // Nombre de la cédula igual al del RIF personal (regla 4)
  docs.filter((d) => d.casilla === 'rif_personal' && marcas[d.id] && marcas[d.id].propuesta === 'bien').forEach((d) => {
    const ced = docs.find((x) => x.casilla === 'cedula' && x.numero === d.numero); const hc = ced && H[ced.id]; const hr = H[d.id];
    if(!hc || !hc.nombre || !hr || !hr.nombre) return;
    const p = parecido(hc.nombre, hr.nombre);
    if(p !== null && p < 0.6) marca(d, 'problema', 'no_corresponde', 'El nombre del RIF (' + hr.nombre + ') no coincide con el de la cédula (' + hc.nombre + ').', hr, marcas[d.id].datos);
  });

  // Documento duplicado: la misma cédula en dos representantes (regla 19)
  const numerosCed = {};
  docs.filter((d) => d.casilla === 'cedula' && H[d.id] && H[d.id].numero).forEach((d) => { const n = soloDigitos(H[d.id].numero); if(!n) return; (numerosCed[n] = numerosCed[n] || []).push(d.numero); });
  Object.keys(numerosCed).forEach((n) => { if(numerosCed[n].length > 1) punto('duplicado_' + n, 'Cédula repetida', 'aviso', 'La misma cédula está en los representantes ' + numerosCed[n].join(' y ') + '.'); });

  // Lo que falta en el expediente (documentos y contacto)
  (e.faltantes || []).filter((f) => f.e === 'falta').forEach((f) => {
    punto('falta_' + f.k + '_' + f.n, 'Falta ' + f.t, 'bloquea', f.dato ? 'Hay que escribirlo en el expediente.' : 'No está en el expediente.', { falta: f.t });
  });
  if(!c.es_natural && !(e.faltantes || []).some((f) => f.dato)) punto('contacto', 'Teléfono y correo del representante', 'ok', 'Están en el expediente.');

  // ---------- Empresa: actas, junta, firmantes, domicilio ----------
  if(!c.es_natural){
    const dActa = docs.find((d) => d.casilla === 'acta_constitutiva'); const acta = dActa && marcas[dActa.id] && marcas[dActa.id].propuesta === 'bien' ? H[dActa.id] : null;
    const asambleas = docs.filter((d) => d.casilla === 'acta_asamblea' && marcas[d.id] && marcas[d.id].propuesta === 'bien').map((d) => Object.assign({ _doc: d }, H[d.id], { _insc: fecha(H[d.id].fecha_inscripcion) })).filter((a) => a._insc).sort((a, b) => a._insc.localeCompare(b._insc));
    const inscActa = acta ? fecha(acta.fecha_inscripcion) : null;
    const actas = acta && inscActa ? [Object.assign({ _doc: dActa, _insc: inscActa }, acta)].concat(asambleas) : asambleas;
    const ultimaCon = (f) => actas.filter(f).slice(-1)[0] || null;
    const pg = (a) => (a ? nombreCasilla(a._doc.casilla, a._doc.numero) + (a.pagina_inicio ? ' · página ' + a.pagina_inicio : '') : '');

    if(!acta){
      if(dActa) punto('actas', 'Actas', 'mano', 'No se pudo leer el acta constitutiva: junta, firmantes, duración y domicilio quedan para revisar a mano.');
    } else {
      // Razón social (regla 7)
      const dRif = docs.find((d) => d.casilla === 'rif_empresa'); const hRif = dRif ? H[dRif.id] : null;
      const cambioNombre = ultimaCon((a) => (a.asamblea_temas || []).includes('cambio_nombre') && a.razon_social);
      const rsActa = (cambioNombre && cambioNombre.razon_social) || acta.razon_social || acta.nombre;
      const rsRif = hRif && (hRif.razon_social || hRif.nombre);
      if(rsActa && rsRif){
        const p = parecido(rsActa, rsRif);
        if(p !== null && p >= 0.6) punto('razon_social', 'Razón social igual a la del RIF', 'ok', rsActa + '.');
        else punto('razon_social', 'Razón social distinta a la del RIF', 'bloquea', 'El acta dice ' + rsActa + ' y el RIF dice ' + rsRif + '.', { pagina: pg(cambioNombre || actas[0]), falta: 'Acta de asamblea de cambio de nombre' });
      }

      // Duración de la empresa (regla 10)
      if(acta.duracion_indefinida) punto('duracion', 'Duración de la empresa', 'ok', 'El acta dice que no vence.', { pagina: pg(actas[0]) });
      else {
        const anos = Number(acta.duracion_anos) > 0 ? Number(acta.duracion_anos) : 30;
        const vence = masAnios(inscActa, anos); const ult = asambleas.slice(-1)[0];
        const base = (Number(acta.duracion_anos) > 0 ? anos + ' años' : 'No dice la duración en ninguna página: se toman 30 años') + ' desde el ' + fechaTexto(inscActa);
        if(vence >= hoy) punto('duracion', 'Duración de la empresa', 'ok', base + '. Vigente hasta el ' + fechaTexto(vence) + '.', { pagina: pg(actas[0]) });
        else if(ult && masAnios(ult._insc, 10) >= hoy) punto('duracion', 'Duración de la empresa', 'ok', base + ' venció el ' + fechaTexto(vence) + ', pero la asamblea inscrita el ' + fechaTexto(ult._insc) + ' la renueva hasta el ' + fechaTexto(masAnios(ult._insc, 10)) + '.', { pagina: pg(ult) });
        else punto('duracion', 'Empresa vencida', 'bloquea', base + ': venció el ' + fechaTexto(vence) + '.', { pagina: pg(actas[0]), falta: 'Acta de asamblea de prórroga de la empresa' });
      }

      // Junta vigente (reglas 12, 13 y 14)
      const designa = ultimaCon((a) => a === actas[0] || (a.asamblea_temas || []).some((t) => t === 'cambio_junta' || t === 'ratificacion_junta'));
      if(designa){
        const anosJ = Number(designa.junta_anos) > 0 ? Number(designa.junta_anos) : Number(acta.junta_anos) > 0 ? Number(acta.junta_anos) : 10;
        const venceJ = masAnios(designa._insc, anosJ); const perm = !!(designa.clausula_permanencia || acta.clausula_permanencia);
        const tope = masAnios(designa._insc, 10); const x = excPunto('junta');
        if(venceJ >= hoy) punto('junta', 'Junta vigente', 'ok', 'Designada en el acta inscrita el ' + fechaTexto(designa._insc) + ' por ' + anosJ + ' años. Vigente hasta el ' + fechaTexto(venceJ) + '.', { pagina: pg(designa) });
        else if(perm && tope >= hoy) punto('junta', 'Junta vigente por cláusula de permanencia', 'ok', 'Su período venció el ' + fechaTexto(venceJ) + ', pero la cláusula de permanencia la mantiene hasta el ' + fechaTexto(tope) + '.', { pagina: pg(designa) });
        else if(x) punto('junta', 'Junta vencida', 'ok', 'Venció el ' + fechaTexto(venceJ) + '. Excepción: ' + x.motivo, { pagina: pg(designa), excepcion: x.motivo });
        else punto('junta', 'Junta vencida', 'bloquea', 'Designada en el acta inscrita el ' + fechaTexto(designa._insc) + ' por ' + anosJ + ' años: venció el ' + fechaTexto(venceJ) + '.' + (perm ? ' Tenía cláusula de permanencia, pero ya pasaron 10 años.' : ''), { pagina: pg(designa), falta: 'Acta de asamblea de ratificación o cambio de junta', excepcionable: true });
      }

      // Régimen de firma y firmantes (reglas 15, 16 y 17)
      const conRegimen = ultimaCon((a) => a.regimen_firma && a.regimen_firma !== 'no_dice');
      const junta = (designa && (designa.junta || []).length ? designa.junta : acta.junta) || [];
      if(!conRegimen) punto('firmantes', 'Régimen de firma', 'mano', 'No se encontró cómo firman los directores. Míralo en el acta.');
      else if(!junta.length) punto('firmantes', 'Firmantes', 'mano', 'No se pudo leer quiénes forman la junta. Míralo en el acta.', { pagina: pg(designa || actas[0]) });
      else {
        const conjunta = conRegimen.regimen_firma === 'conjunta';
        const nums = (e.representantes || []).map((r) => r.orden).concat(docs.filter((d) => d.casilla === 'cedula').map((d) => d.numero)).filter((v, i, a) => a.indexOf(v) === i).sort();
        // Nombre y cédula del representante: de su cédula, o de su RIF personal (V + cédula + dígito)
        const quien = (n) => {
          const dc = docs.find((d) => d.casilla === 'cedula' && d.numero === n); const hc = dc && H[dc.id];
          const dr = docs.find((d) => d.casilla === 'rif_personal' && d.numero === n); const hr = dr && H[dr.id];
          const ci = (hc && soloDigitos(hc.numero)) || (hr && soloDigitos(hr.numero).slice(0, -1)) || '';
          return { nom: (hc && hc.nombre) || (hr && hr.nombre) || rep(n).nombre || '', ci };
        };
        const enJunta = (n) => {
          const { nom, ci } = quien(n);
          if(!nom && !ci) return null;   // no se sabe quién es
          return junta.some((j) => (ci && soloDigitos(j.cedula) === ci) || (nom && j.nombre && (parecido(nom, j.nombre) || 0) >= 0.6));
        };
        const bien = (cas, n) => { const d = docs.find((x) => x.casilla === cas && x.numero === n); return !!(d && marcas[d.id] && marcas[d.id].propuesta === 'bien'); };
        const prop = (cas, n) => { const d = docs.find((x) => x.casilla === cas && x.numero === n); return d && marcas[d.id] ? marcas[d.id].propuesta : null; };
        const completos = []; const fuera = []; const dudosos = [];
        nums.forEach((n) => {
          const dc = docs.find((d) => d.casilla === 'cedula' && d.numero === n); if(!dc) return;
          const nom = quien(n).nom || 'Representante ' + n;
          const ps = [prop('cedula', n), prop('rif_personal', n)]; const ej = enJunta(n);
          if(ej === null) dudosos.push(nom);
          else if(!ej){ if(ps[0] === 'revisar_a_mano') dudosos.push(nom); else fuera.push(nom); }
          else if(bien('cedula', n) && bien('rif_personal', n)) completos.push(nom);
          else if(ps.includes('revisar_a_mano') && !ps.includes('problema')) dudosos.push(nom);
        });
        const necesita = conjunta ? 2 : 1; const x = excPunto('firmantes');
        const reg = conjunta ? 'conjunta' : conRegimen.regimen_firma === 'conjunta_o_separada' ? 'conjunta y/o separada (cuenta como separada)' : 'separada';
        if(completos.length >= necesita) punto('firmantes', 'Firmantes', 'ok', 'Firma ' + reg + '. ' + completos.join(' y ') + (completos.length === 1 ? ' está en la junta y tiene cédula y RIF bien.' : ' están en la junta y tienen cédula y RIF bien.'), { pagina: pg(conRegimen) });
        else if(x) punto('firmantes', 'Firmantes', 'ok', 'Excepción: ' + x.motivo, { excepcion: x.motivo });
        else if(dudosos.length && completos.length + dudosos.length >= necesita) punto('firmantes', 'Firmantes', 'mano', 'Depende de lo que decidas con los documentos de ' + dudosos.join(' y ') + '.', { pagina: pg(conRegimen) });
        else if(fuera.length) punto('firmantes', 'Firmante fuera de la junta', 'bloquea', fuera.join(' y ') + ' no aparece en la junta vigente. Si firma con un poder, súbelo en Otros y concede la excepción.', { pagina: pg(designa || actas[0]), falta: 'Representante que esté en la junta vigente', excepcionable: true });
        else punto('firmantes', 'Firmantes', 'bloquea', 'Firma ' + reg + ': hace falta ' + (necesita === 2 ? 'otro representante' : 'un representante') + ' de la junta con cédula y RIF bien.', { pagina: pg(conRegimen), falta: conjunta ? 'Cédula y RIF del segundo representante que firma' : 'Cédula y RIF del representante que firma' });
        const app = c.regimen_firma === 'conjunta' ? 'conjunta' : c.regimen_firma === 'individual' ? 'separada' : null;
        const acta2 = conjunta ? 'conjunta' : 'separada';
        if(app && app !== acta2) punto('regimen_app', 'Régimen de firma distinto', 'aviso', 'En la app dice firma ' + app + ' y el acta dice ' + acta2 + '. Cámbialo en Datos.');
      }

      // Domicilio (regla 8)
      const cambioDom = ultimaCon((a) => (a.asamblea_temas || []).includes('cambio_domicilio') && a.direccion);
      const dirActa = (cambioDom && cambioDom.direccion) || acta.direccion; const dirRif = hRif && hRif.direccion;
      if(acta.clausula_sucursales) punto('domicilio', 'Domicilio', 'ok', 'El acta permite sucursales: no hace falta que coincida con el RIF.', { pagina: pg(actas[0]) });
      else if(!dirActa || !dirRif) punto('domicilio', 'Domicilio', 'mano', 'No se leyó la dirección ' + (!dirActa ? 'del acta' : 'del RIF') + '. Compáralas tú.');
      else if(palabras(dirActa).size < 3) punto('domicilio', 'Domicilio', 'mano', 'El acta solo trae ' + dirActa + '. Compara con el RIF a mano.', { pagina: pg(cambioDom || actas[0]) });
      else {
        const p = parecido(dirActa, dirRif);
        if(p !== null && p >= 0.65) punto('domicilio', 'Domicilio igual al del RIF', 'ok', 'Se parece en un ' + pct(p) + '.', { pagina: pg(cambioDom || actas[0]) });
        else punto('domicilio', 'Domicilio distinto al del RIF', 'bloquea', 'La dirección ' + (cambioDom ? 'de la última asamblea' : 'del acta') + ' se parece en un ' + pct(p || 0) + ' a la del RIF.', { pagina: pg(cambioDom || actas[0]), falta: 'Acta de asamblea de cambio de domicilio' });
      }
    }
  }

  // Lo que trae un archivo y nadie marcó (regla 21)
  docs.forEach((d) => (d.archivos || []).forEach((a) => {
    const l = lect[a]; if(!l || l.estado !== 'ok') return;
    (l.documentos || []).forEach((h, i) => {
      if(usados.has(a + ':' + i) || !h.tipo || h.tipo === 'otro' || h.tipo === 'poder') return;
      const casillas = docs.filter((x) => (x.archivos || []).includes(a)).map((x) => TIPO_DE_CASILLA[x.casilla]);
      if(casillas.includes(h.tipo)) return;
      const id = 'sin_marcar_' + a + '_' + i;
      if(puntos.some((p) => p.id === id)) return;
      punto(id, 'Documento sin marcar', 'aviso', 'El archivo de ' + nombreCasilla(d.casilla, d.numero) + ' también trae ' + (NOMBRE_TIPO[h.tipo] || 'otro documento') + (h.pagina_inicio ? ' en la página ' + h.pagina_inicio : '') + '. Márcalo en el expediente para que cuente.');
    });
  }));

  // Lo que falta en las actas (junta, duración, domicilio, razón social) se pide devolviendo el acta constitutiva:
  // así el estatus se sigue calculando por documentos, como siempre.
  const dActa2 = docs.find((d) => d.casilla === 'acta_constitutiva');
  const deActas = puntos.filter((p) => p.estado === 'bloquea' && p.falta && ['junta', 'duracion', 'domicilio', 'razon_social'].includes(p.id));
  if(dActa2 && deActas.length && marcas[dActa2.id] && marcas[dActa2.id].propuesta === 'bien'){
    const m = marcas[dActa2.id];
    marca(dActa2, 'problema', 'otro', 'Falta: ' + deActas.map((p) => p.falta.charAt(0).toLowerCase() + p.falta.slice(1)).join('; ') + '. ' + m.nota, H[dActa2.id], m.datos);
  }

  const ms = Object.values(marcas);
  const veredicto = ms.some((m) => m.propuesta === 'problema') || puntos.some((p) => p.estado === 'bloquea') ? 'no_apto'
    : ms.some((m) => m.propuesta === 'revisar_a_mano') || puntos.some((p) => p.estado === 'mano') ? 'revisar_a_mano' : 'apto';
  const representantes = Object.keys(nombresRep).map((n) => ({ orden: Number(n), nombre: String(nombresRep[n]).trim().slice(0, 120) }));
  return { veredicto, puntos, marcas: ms, representantes, version: VERSION_REGLAS };
}

const TEMAS = { cambio_nombre: 'cambio de nombre', cambio_domicilio: 'cambio de domicilio', cambio_junta: 'cambio de junta', ratificacion_junta: 'ratificación de junta', prorroga: 'prórroga', aumento_capital: 'aumento de capital', otro: 'otros temas' };
