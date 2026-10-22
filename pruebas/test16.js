// Reglas de la revisión con IA: los 14 casos de claude/ia-reglas.md con datos inventados (sin documentos y sin Gemini).
// Prueba solo la parte que decide (supabase/funciones/ia_revisar/reglas.mjs) con lo que la IA "habría leído".
const path = require('path');
const { marcador } = require('./simulador');
const { ok, cerrar } = marcador();

const DIR = 'Avenida Bella Vista, Edificio Sol, piso 2, local 4, Maracaibo, Zulia';
function base(cambios){
  const e = {
    hoy: '2026-10-09',
    cliente: { nombre: 'Ejemplo Uno, C.A.', es_natural: false, regimen_firma: 'individual', es_isp: false },
    representantes: [{ orden: 1, nombre: null, correo: 'pedro@ejemplo.test', telefono: '0414-0000000' }],
    faltantes: [],
    documentos: [
      { id: 11, casilla: 'cedula', numero: 1, estado: 'por_revisar', archivos: [1] },
      { id: 12, casilla: 'rif_personal', numero: 1, estado: 'por_revisar', archivos: [2] },
      { id: 13, casilla: 'rif_empresa', numero: 0, estado: 'por_revisar', archivos: [3] },
      { id: 14, casilla: 'acta_constitutiva', numero: 0, estado: 'por_revisar', archivos: [4] }
    ],
    lecturas: {
      1: { estado: 'ok', documentos: [{ tipo: 'cedula', pagina_inicio: 1, legible: true, nombre: 'PEDRO JOSE EJEMPLO', numero: 'V-11.111.111', fecha_expedicion: '2020-05', fecha_vencimiento: '2030-05' }] },
      2: { estado: 'ok', documentos: [{ tipo: 'rif_personal', pagina_inicio: 1, legible: true, nombre: 'PEDRO JOSE EJEMPLO', numero: 'V111111110', fecha_vencimiento: '2028-02-15' }] },
      3: { estado: 'ok', documentos: [{ tipo: 'rif_empresa', pagina_inicio: 1, legible: true, razon_social: 'EJEMPLO UNO, C.A.', numero: 'J000000010', fecha_vencimiento: '2028-01-10', direccion: DIR }] },
      4: { estado: 'ok', documentos: [{ tipo: 'acta_constitutiva', pagina_inicio: 1, pagina_fin: 12, legible: true, razon_social: 'EJEMPLO UNO, C.A.', fecha_inscripcion: '2020-03-14',
        duracion_anos: 50, junta_anos: 10, junta: [{ nombre: 'PEDRO JOSE EJEMPLO', cedula: '11111111', cargo: 'Presidente' }], regimen_firma: 'separada', direccion: DIR, clausula_permanencia: false }] }
    },
    excepciones: []
  };
  if(cambios) cambios(e);
  return e;
}
const acta = (e) => e.lecturas[4].documentos[0];
function asamblea(e, datos){
  e.documentos.push({ id: 15, casilla: 'acta_asamblea', numero: 1, estado: 'por_revisar', archivos: [5] });
  e.lecturas[5] = { estado: 'ok', documentos: [Object.assign({ tipo: 'acta_asamblea', pagina_inicio: 1, legible: true }, datos)] };
};
function segundoRep(e, nombre, cedula, enJunta){
  e.documentos.push({ id: 21, casilla: 'cedula', numero: 2, estado: 'por_revisar', archivos: [6] }, { id: 22, casilla: 'rif_personal', numero: 2, estado: 'por_revisar', archivos: [7] });
  e.lecturas[6] = { estado: 'ok', documentos: [{ tipo: 'cedula', pagina_inicio: 1, legible: true, nombre, numero: cedula, fecha_expedicion: '2021-01', fecha_vencimiento: '2031-01' }] };
  e.lecturas[7] = { estado: 'ok', documentos: [{ tipo: 'rif_personal', pagina_inicio: 1, legible: true, nombre, numero: 'V' + cedula + '0', fecha_vencimiento: '2029-01-01' }] };
  if(enJunta) acta(e).junta.push({ nombre, cedula, cargo: 'Director' });
};
const P = (r, id) => r.puntos.find((p) => p.id === id) || {};
const M = (r, doc) => r.marcas.find((m) => m.documento === doc) || {};

(async () => {
  const { evaluar, parecido, fecha } = await import(path.join(__dirname, '../supabase/funciones/ia_revisar/reglas.mjs'));
  let r;

  // 0. El caso base está completo
  r = evaluar(base());
  ok('base: expediente completo es Apto', r.veredicto === 'apto', r);
  ok('base: llena el nombre del representante con la cédula', r.representantes[0] && r.representantes[0].nombre === 'PEDRO JOSE EJEMPLO');

  // 1. Empresa de 2008, junta de 5 años, sin asambleas, con cláusula de permanencia: más de 10 años
  r = evaluar(base((e) => Object.assign(acta(e), { fecha_inscripcion: '2008-06-10', junta_anos: 5, clausula_permanencia: true })));
  ok('caso 1: junta de 2008 con cláusula, pasados 10 años, bloquea', r.veredicto === 'no_apto' && P(r, 'junta').estado === 'bloquea' && P(r, 'junta').excepcionable === true, P(r, 'junta'));
  ok('caso 1 (lote 3): pide el acta de asamblea sin devolver el acta constitutiva', P(r, 'junta').falta === 'Acta de asamblea: ratificación o cambio de junta' && P(r, 'junta').pedir === true && M(r, 14).propuesta === 'bien', M(r, 14));
  r = evaluar(base((e) => { Object.assign(acta(e), { fecha_inscripcion: '2008-06-10', junta_anos: 5, clausula_permanencia: true }); e.excepciones = [{ punto: 'junta', motivo: 'Acta en el Registro' }]; }));
  ok('caso 1: con excepción del administrador queda Apto y el acta se aprueba', r.veredicto === 'apto' && /Excepción/.test(P(r, 'junta').detalle) && M(r, 14).propuesta === 'bien');

  // 2. Empresa de 2020, junta de 5 años vencida en 2025, con cláusula: menos de 10 años
  r = evaluar(base((e) => Object.assign(acta(e), { fecha_inscripcion: '2020-03-14', junta_anos: 5, clausula_permanencia: true })));
  ok('caso 2: la cláusula la mantiene hasta 2030', r.veredicto === 'apto' && P(r, 'junta').estado === 'ok' && /14\/03\/2030/.test(P(r, 'junta').detalle), P(r, 'junta'));

  // 3. Igual sin cláusula
  r = evaluar(base((e) => Object.assign(acta(e), { fecha_inscripcion: '2020-03-14', junta_anos: 5, clausula_permanencia: false })));
  ok('caso 3: sin cláusula, junta vencida', r.veredicto === 'no_apto' && P(r, 'junta').estado === 'bloquea' && /14\/03\/2025/.test(P(r, 'junta').detalle));

  // 4. Acta sin duración, de 1990, sin asambleas: 30 años, vence 2020; y la junta (10 años) desde 2000
  r = evaluar(base((e) => Object.assign(acta(e), { fecha_inscripcion: '1990-02-01', duracion_anos: null, junta_anos: null })));
  ok('caso 4: sin duración se toman 30 años y está vencida', P(r, 'duracion').estado === 'bloquea' && /30 años/.test(P(r, 'duracion').detalle) && /prórroga/.test(P(r, 'duracion').falta || ''), P(r, 'duracion'));
  ok('caso 4: la junta también está vencida desde el 2000', P(r, 'junta').estado === 'bloquea' && /01\/02\/2000/.test(P(r, 'junta').detalle) && r.veredicto === 'no_apto');

  // 5. Igual con asamblea de 2019 que ratifica la junta: renovada hasta 2029; si solo aumenta capital, la junta sigue vencida
  r = evaluar(base((e) => { Object.assign(acta(e), { fecha_inscripcion: '1990-02-01', duracion_anos: null, junta_anos: null }); asamblea(e, { fecha_inscripcion: '2019-07-01', asamblea_temas: ['ratificacion_junta'], junta: acta(e).junta, junta_anos: 10 }); }));
  ok('caso 5: asamblea de 2019 renueva la empresa hasta 2029', P(r, 'duracion').estado === 'ok' && /01\/07\/2029/.test(P(r, 'duracion').detalle), P(r, 'duracion'));
  ok('caso 5: la asamblea ratifica la junta y queda Apto', P(r, 'junta').estado === 'ok' && r.veredicto === 'apto', r.puntos);
  r = evaluar(base((e) => { Object.assign(acta(e), { fecha_inscripcion: '1990-02-01', duracion_anos: null, junta_anos: null }); asamblea(e, { fecha_inscripcion: '2019-07-01', asamblea_temas: ['aumento_capital'] }); }));
  ok('caso 5: si solo aumenta capital, la duración se renueva pero la junta sigue vencida', P(r, 'duracion').estado === 'ok' && P(r, 'junta').estado === 'bloquea' && r.veredicto === 'no_apto');

  // 6. "Conjunta y/o separada" con un representante completo en la junta
  r = evaluar(base((e) => { acta(e).regimen_firma = 'conjunta_o_separada'; acta(e).junta.push({ nombre: 'MARIA EJEMPLO', cedula: '22222222', cargo: 'Directora' }); }));
  ok('caso 6: y/o cuenta como separada; basta uno completo', P(r, 'firmantes').estado === 'ok' && /separada/.test(P(r, 'firmantes').detalle) && r.veredicto === 'apto', P(r, 'firmantes'));

  // 7. Firma conjunta con dos directores y solo uno subido
  r = evaluar(base((e) => { acta(e).regimen_firma = 'conjunta'; acta(e).junta.push({ nombre: 'MARIA EJEMPLO', cedula: '22222222', cargo: 'Directora' }); e.cliente.regimen_firma = 'conjunta'; }));
  ok('caso 7: conjunta con uno solo, falta el segundo', P(r, 'firmantes').estado === 'bloquea' && /otro representante/.test(P(r, 'firmantes').detalle) && r.veredicto === 'no_apto', P(r, 'firmantes'));
  r = evaluar(base((e) => { acta(e).regimen_firma = 'conjunta'; e.cliente.regimen_firma = 'conjunta'; segundoRep(e, 'MARIA EJEMPLO', '22222222', true); }));
  ok('caso 7: con el segundo completo queda Apto', P(r, 'firmantes').estado === 'ok' && r.veredicto === 'apto', r.puntos);

  // 8. Cédula con vencimiento 2031 y expedición 2016
  r = evaluar(base((e) => Object.assign(e.lecturas[1].documentos[0], { fecha_expedicion: '2016-04', fecha_vencimiento: '2031-04' })));
  ok('caso 8: el cruce no cuadra, va a revisar a mano', M(r, 11).propuesta === 'revisar_a_mano' && /2026/.test(M(r, 11).nota) && r.veredicto === 'revisar_a_mano', M(r, 11));

  // 9. RIF con dirección completa y acta con otra, sin cláusula de sucursales
  r = evaluar(base((e) => { acta(e).direccion = 'Calle 72 con avenida 3E, Centro Comercial Las Lomas, local 12, Valencia, Carabobo'; }));
  ok('caso 9: domicilio distinto bloquea y pide acta de cambio de domicilio', P(r, 'domicilio').estado === 'bloquea' && /cambio de domicilio/.test(P(r, 'domicilio').falta) && r.veredicto === 'no_apto', P(r, 'domicilio'));
  r = evaluar(base((e) => { acta(e).direccion = 'Calle 72, Valencia, Carabobo'; acta(e).clausula_sucursales = true; }));
  ok('caso 9: con cláusula de sucursales no hace falta que coincida', P(r, 'domicilio').estado === 'ok');
  r = evaluar(base((e) => { acta(e).direccion = 'Maracaibo'; }));
  ok('caso 9: si el acta solo trae la ciudad, a mano', P(r, 'domicilio').estado === 'mano');

  // 10. Firmante que no está en la junta pero trae poder en Otros
  r = evaluar(base((e) => { acta(e).junta = [{ nombre: 'LUIS OTRO DIRECTOR', cedula: '33333333', cargo: 'Presidente' }];
    e.documentos.push({ id: 30, casilla: 'otro', numero: 1, estado: 'por_revisar', archivos: [8] }); e.lecturas[8] = { estado: 'ok', documentos: [{ tipo: 'poder', pagina_inicio: 1, legible: true }] }; }));
  ok('caso 10: firmante fuera de la junta bloquea hasta la excepción', P(r, 'firmantes').estado === 'bloquea' && P(r, 'firmantes').excepcionable && r.veredicto === 'no_apto', P(r, 'firmantes'));
  r = evaluar(base((e) => { acta(e).junta = [{ nombre: 'LUIS OTRO DIRECTOR', cedula: '33333333', cargo: 'Presidente' }]; e.excepciones = [{ punto: 'firmantes', motivo: 'Poder notariado en Otros' }]; }));
  ok('caso 10: con la excepción queda Apto', P(r, 'firmantes').estado === 'ok' && r.veredicto === 'apto');

  // 11. RIF personal vencido y cédula vigente
  r = evaluar(base((e) => { e.lecturas[2].documentos[0].fecha_vencimiento = '2025-12-01'; e.excepciones = [{ documento: 12, motivo: 'En trámite' }]; }));
  ok('caso 11: RIF personal vencido es No apto aunque pidan excepción', M(r, 12).propuesta === 'problema' && M(r, 12).motivo === 'vencido' && /no admite excepción/.test(M(r, 12).nota) && r.veredicto === 'no_apto', M(r, 12));

  // 12. Cédula vencida con excepción concedida
  r = evaluar(base((e) => { Object.assign(e.lecturas[1].documentos[0], { fecha_expedicion: '2016-05', fecha_vencimiento: '2026-05' }); }));
  ok('caso 12: cédula vencida sin excepción se devuelve', M(r, 11).propuesta === 'problema' && M(r, 11).motivo === 'vencido' && /31\/05\/2026/.test(M(r, 11).nota));
  r = evaluar(base((e) => { Object.assign(e.lecturas[1].documentos[0], { fecha_expedicion: '2016-05', fecha_vencimiento: '2026-05' }); e.excepciones = [{ documento: 11, motivo: 'En trámite, trajo constancia' }]; }));
  ok('caso 12: con excepción queda Apto y muestra el motivo', M(r, 11).propuesta === 'bien' && /Excepción: En trámite/.test(M(r, 11).nota) && r.veredicto === 'apto');

  // 13. PDF marcado solo como cédula que trae el RIF personal en la página 2
  r = evaluar(base((e) => { e.documentos = e.documentos.filter((d) => d.casilla !== 'rif_personal'); e.lecturas[1].documentos.push(Object.assign({}, e.lecturas[2].documentos[0], { pagina_inicio: 2 }));
    e.faltantes = [{ k: 'rif_personal', n: 1, t: 'RIF personal', e: 'falta' }]; }));
  const sin = r.puntos.find((p) => /^sin_marcar_/.test(p.id)) || {};
  ok('caso 13: avisa el RIF sin marcar con su página', sin.estado === 'aviso' && /RIF personal en la página 2/.test(sin.detalle), r.puntos);
  ok('caso 13: el RIF no cuenta hasta que lo marquen', P(r, 'falta_rif_personal_1').estado === 'bloquea' && r.veredicto === 'no_apto');

  // 14. Persona natural con cédula y RIF vigentes y el mismo nombre
  r = evaluar(base((e) => { e.cliente.es_natural = true; e.documentos = e.documentos.filter((d) => d.casilla === 'cedula' || d.casilla === 'rif_personal'); }));
  ok('caso 14: persona natural sin actas ni junta es Apto', r.veredicto === 'apto' && !P(r, 'junta').id && !P(r, 'domicilio').id, r.puntos);
  r = evaluar(base((e) => { e.cliente.es_natural = true; e.documentos = e.documentos.filter((d) => d.casilla === 'cedula' || d.casilla === 'rif_personal'); e.lecturas[2].documentos[0].nombre = 'ANA MARIA DISTINTA'; }));
  ok('caso 14: si el nombre del RIF no es el de la cédula, no corresponde (regla 4)', M(r, 12).propuesta === 'problema' && M(r, 12).motivo === 'no_corresponde');

  // Otros casos de las reglas
  r = evaluar(base((e) => { e.lecturas[3].documentos[0].razon_social = 'OTRA EMPRESA DISTINTA, S.A.'; }));
  ok('regla 7: razón social distinta a la del RIF bloquea', P(r, 'razon_social').estado === 'bloquea');
  r = evaluar(base((e) => { acta(e).duracion_indefinida = true; acta(e).fecha_inscripcion = '1970-01-01'; acta(e).junta_anos = 50; }));
  ok('regla 10: si el acta dice que no vence, no vence', P(r, 'duracion').estado === 'ok' && /no vence/.test(P(r, 'duracion').detalle));
  r = evaluar(base((e) => { e.lecturas[4] = { estado: 'ilegible', documentos: [] }; }));
  ok('ilegible: el acta va a mano y no se inventa nada', M(r, 14).propuesta === 'revisar_a_mano' && r.veredicto !== 'apto');
  r = evaluar(base((e) => { e.lecturas[3].documentos[0].tipo = 'cedula'; }));
  ok('archivo equivocado: no corresponde', M(r, 13).propuesta === 'problema' && M(r, 13).motivo === 'no_corresponde');
  r = evaluar(base((e) => { e.faltantes = [{ k: 'correo', n: 1, t: 'correo', e: 'falta', dato: true }]; }));
  ok('regla 18: sin correo del representante bloquea', P(r, 'falta_correo_1').estado === 'bloquea' && r.veredicto === 'no_apto');
  r = evaluar(base((e) => { segundoRep(e, 'PEDRO JOSE EJEMPLO', 'V-11.111.111', false); }));
  ok('regla 19: la misma cédula en dos representantes avisa', r.puntos.some((p) => /^duplicado_/.test(p.id)));
  r = evaluar(base((e) => { e.cliente.regimen_firma = 'conjunta'; }));
  ok('aviso: el régimen de la app no coincide con el acta', P(r, 'regimen_app').estado === 'aviso');
  r = evaluar(base((e) => { const a = e.lecturas[1]; e.lecturas[1] = e.lecturas[2]; e.lecturas[2] = a; }));
  ok('al revés: cédula y RIF en la casilla del otro van a mano diciendo dónde están', M(r, 11).propuesta === 'revisar_a_mano' && /Está en el archivo de RIF personal/.test(M(r, 11).nota) && M(r, 12).propuesta === 'revisar_a_mano' && /Está en el archivo de Cédula/.test(M(r, 12).nota), [M(r, 11), M(r, 12)]);
  ok('al revés: el firmante no se da por fuera de la junta', P(r, 'firmantes').estado !== 'bloquea' && r.veredicto === 'revisar_a_mano', P(r, 'firmantes'));
  r = evaluar(base((e) => { e.lecturas[1].documentos[0].nombre = null; e.lecturas[1].documentos[0].numero = null; }));
  ok('firmante: si la cédula no trae nombre, se busca con el RIF personal', P(r, 'firmantes').estado === 'ok', P(r, 'firmantes'));
  ok('fechas: la cédula vence el último día del mes', fecha('2030-02', true) === '2030-02-28' && fecha('15/03/2031', true) === '2031-03-31' && fecha('15/03/2031') === '2031-03-15');
  ok('parecido: por palabras, sin tildes ni C.A.', parecido('Inversiones Ñandú, C.A.', 'INVERSIONES NANDU CA') === 1);
  // Corrida 14/10 tarde: RIF Digital v2.0 (sin vencimiento) vale siempre; el viejo sin vencimiento sigue a mano
  r = evaluar(base((e) => { Object.assign(e.lecturas[3].documentos[0], { fecha_vencimiento: null, formato: 'rif_digital' }); Object.assign(e.lecturas[2].documentos[0], { fecha_vencimiento: null, formato: 'rif_digital' }); }));
  ok('RIF Digital v2.0 de la empresa y personal: vigentes sin vencimiento', M(r, 13).propuesta === 'bien' && /no vence/.test(M(r, 13).nota) && M(r, 12).propuesta === 'bien', [M(r, 12), M(r, 13)]);
  r = evaluar(base((e) => { Object.assign(e.lecturas[3].documentos[0], { fecha_vencimiento: '2020-01-10', formato: 'rif_viejo' }); }));
  ok('RIF viejo vencido sigue siendo problema', M(r, 13).propuesta === 'problema');
  r = evaluar(base((e) => { e.lecturas[3].documentos[0].fecha_vencimiento = null; }));
  ok('RIF sin vencimiento y sin formato nuevo: a mano', M(r, 13).propuesta === 'revisar_a_mano');
  // ---------- Parte E (22/10): actas varias. Datos inventados que reproducen el caso Totalcom y cada tipo de error ----------
  const junta6 = [['PEDRO JOSE EJEMPLO', '11111111'], ['ANA UNO', '30000001'], ['LUIS DOS', '30000002'], ['RITA TRES', '30000003'], ['JOSE CUATRO', '30000004'], ['EVA CINCO', '30000005']].map((x) => ({ nombre: x[0], cedula: x[1], cargo: 'Director' }));
  const segunda = (e, numero, archivo, datos) => { e.documentos.push({ id: 30 + numero, casilla: 'acta_asamblea', numero, estado: 'por_revisar', archivos: [archivo] }); e.lecturas[archivo] = { estado: 'ok', documentos: [Object.assign({ tipo: 'acta_asamblea', pagina_inicio: 1, legible: true }, datos)] }; };
  // E1 (Totalcom): constitutiva de 1998 y una "aclaratoria" de 2023 marcada "otro" que trae la junta completa por 5 años
  r = evaluar(base((e) => { Object.assign(acta(e), { fecha_inscripcion: '1998-03-02', duracion_anos: 50, junta_anos: 10 }); asamblea(e, { fecha_inscripcion: '2023-12-12', asamblea_temas: ['otro'], junta: junta6, junta_anos: 5 }); }));
  ok('E1 Totalcom: la junta del acta "otro" de 2023 cuenta y está vigente hasta el 12/12/2028', P(r, 'junta').estado === 'ok' && /12\/12\/2028/.test(P(r, 'junta').detalle) && r.veredicto === 'apto', P(r, 'junta'));
  ok('E1: la fuente de la junta es el acta de asamblea', r.fuentes && r.fuentes.junta && r.fuentes.junta.casilla === 'acta_asamblea' && r.fuentes.junta.inscripcion === '2023-12-12');
  // E2: un acta más nueva cambia la razón social aunque el tema diga "otro"
  r = evaluar(base((e) => { Object.assign(acta(e), { razon_social: 'EJEMPLO VIEJO, S.R.L.' }); asamblea(e, { fecha_inscripcion: '2022-05-05', asamblea_temas: ['otro'], razon_social: 'EJEMPLO UNO, C.A.' }); }));
  ok('E2: la razón social sale del acta más reciente que la trae', P(r, 'razon_social').estado === 'ok' && r.fuentes.nombre.casilla === 'acta_asamblea', P(r, 'razon_social'));
  // E3: domicilio nuevo en un acta "otro"; un acta que solo dice la ciudad no lo pisa
  r = evaluar(base((e) => { Object.assign(acta(e), { direccion: 'Calle Vieja 1, Galpon 9, Cabimas, Zulia' }); asamblea(e, { fecha_inscripcion: '2021-01-20', asamblea_temas: ['otro'], direccion: DIR }); segunda(e, 2, 9, { fecha_inscripcion: '2024-02-02', asamblea_temas: ['aumento_capital'], direccion: 'Maracaibo' }); }));
  ok('E3: el domicilio sale del acta más reciente con dirección completa', P(r, 'domicilio').estado === 'ok' && r.fuentes.domicilio.inscripcion === '2021-01-20', P(r, 'domicilio'));
  // E4: actas subidas en desorden (la n.º 1 es la más nueva): manda la fecha de inscripción, no el número de casilla
  r = evaluar(base((e) => { Object.assign(acta(e), { fecha_inscripcion: '1998-03-02', junta_anos: 10 }); asamblea(e, { fecha_inscripcion: '2024-06-30', asamblea_temas: ['ratificacion_junta'], junta: junta6.slice(0, 2), junta_anos: 5 }); segunda(e, 2, 9, { fecha_inscripcion: '2012-04-04', asamblea_temas: ['cambio_junta'], junta: junta6.slice(0, 1), junta_anos: 5 }); }));
  ok('E4: con actas en desorden toma la más reciente por inscripción (vigente hasta 30/06/2029)', P(r, 'junta').estado === 'ok' && /30\/06\/2029/.test(P(r, 'junta').detalle), P(r, 'junta'));
  ok('E4: las actas quedan ordenadas por fecha de inscripción', r.fuentes.actas.map((a) => a.inscripcion).join() === '1998-03-02,2012-04-04,2024-06-30');
  // E5: un acta más nueva sin junta y sin tema de junta no cambia quién la designó
  r = evaluar(base((e) => { Object.assign(acta(e), { fecha_inscripcion: '1998-03-02', junta_anos: 10 }); asamblea(e, { fecha_inscripcion: '2025-01-15', asamblea_temas: ['aumento_capital'] }); }));
  ok('E5: un acta sin junta no cuenta como designación (la junta de 1998 sigue vencida)', P(r, 'junta').estado === 'bloquea' && r.fuentes.junta.casilla === 'acta_constitutiva', P(r, 'junta'));
  ok('sin guion largo en los textos', !JSON.stringify(evaluar(base((e) => { Object.assign(acta(e), { fecha_inscripcion: '1990-02-01', duracion_anos: null }); }))).includes('—'));
  cerrar();
})();
