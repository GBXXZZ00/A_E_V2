// Corrida 14/10 tarde, Parte 4: lectores del OCR con reglas fijas (supabase/funciones/ocr_leer/lectores.mjs).
// Textos inventados con la forma real de lo que devuelve Google Drive: RIF viejo, RIF Digital v2.0, cédula, póliza,
// dígito verificador, sello, letras cirílicas, nombres en otra línea y archivo que no corresponde a su casilla.
const { marcador } = require('./simulador');
const { ok, cerrar } = marcador();

(async () => {
  const L = await import('../supabase/funciones/ocr_leer/lectores.mjs');
  // Dígito verificador (calculado a mano con los pesos 4,3,2,7,6,5,4,3,2)
  ok('dígito: J-29968295 da 0', L.digitoRif('J', '29968295') === 0);
  ok('dígito: J-41163326 da 7', L.digitoRif('J', '41163326') === 7);
  ok('dígito: RIF bueno y malo', L.rifValido('J299682950') && !L.rifValido('J299682951'));

  const viejo = '________________\r\n\r\nREPUBLICA BOLIVARIANA DE VENEZUELA\r\nSENIAT\r\nN° COMPROBANTE: 201803A0000012345678\r\nREGISTRO ÚNICO DE INFORMACIÓN FISCAL (RIF)\r\n' +
    'J299682950 FERRETERIA INVENTADA UNO, C.A\r\nFECHA DE INSCRIPCIÓN:\r\nDOMICILIO FISCAL AV 1 CON CALLE 2 LOCAL NRO 3 SECTOR PRUEBA CIUDAD PRUEBA ZONA FOSTAL 4001\r\n' +
    'DIVISIÓN DE CONTRIBUYENTES ESPECIALES\r\n3299682950-ABC FIRMA AUTORIZADA\r\n09/07/2018\r\nFECHA DE ÚLTIMA ACTUALIZACIÓN: 02/10/2023 FECHA DE VENCIMIENTО: 02/12/2026\r\n' +
    "La validez de este Comprobante debe verificarse mediante la opción 'Consulta Comprobante Digital RIF'.";
  const a = L.leer(viejo);
  ok('RIF viejo: tipo, número y razón social', a.tipo === 'rif_viejo' && a.datos.rif === 'J299682950' && a.datos.razon_social === 'FERRETERIA INVENTADA UNO, C.A', JSON.stringify(a.datos));
  ok('RIF viejo: vencimiento aunque Google meta una O cirílica', a.datos.vencimiento === '2026-12-02');
  ok('RIF viejo: inscripción unas líneas más abajo, actualización y comprobante', a.datos.inscripcion === '2018-07-09' && a.datos.ultima_actualizacion === '2023-10-02' && a.datos.comprobante === '201803A0000012345678', JSON.stringify(a.datos));
  ok('RIF viejo: domicilio hasta la zona postal (corrige FOSTAL)', a.datos.domicilio === 'AV 1 CON CALLE 2 LOCAL NRO 3 SECTOR PRUEBA CIUDAD PRUEBA ZONA POSTAL 4001');
  ok('RIF viejo: sello coincide y lectura clara', a.datos.sello_coincide === true && !a.dudosa);

  const v2 = 'seniat \r\nREGISTRO ÚNICO DE INFORMACIÓN FISCAL (RIF) \r\nIDENTIFICACIÓN DEL CONTRIBUYENTE \r\nRIF: J411633267 \r\nDATOS DE REGISTRO Y VIGENCIA \r\nFECHA DE INSCRIPCIÓN 08/07/2022 \r\n' +
    'ÚLTIMA ACTUALIZACIÓN 19/08/2026 \r\n INVERSIONES INVENTADAS DOS, C.A \r\nDOMICILIO FISCAL: \r\n AV 91 ENTRE CALLES 68 Y 69 LOCAL NRO 1 BARRIO PRUEBA \r\nCIUDAD PRUEBA ZULIA ZONA POSTAL 4002 \r\n3411633267-ZXA \r\n' +
    'FIRMA AUTORIZADA / SISTEMA \r\nN° COMPROBANTE: 202204Y0000099999999 \r\n Servicio Nacional Integrado de Administración Tributaria - RIF Digital v2.0';
  const b = L.leer(v2);
  ok('RIF Digital v2.0: tipo, número, razón social en otra línea', b.tipo === 'rif_digital' && b.datos.rif === 'J411633267' && b.datos.razon_social === 'INVERSIONES INVENTADAS DOS, C.A', JSON.stringify(b.datos));
  ok('RIF Digital v2.0: sin vencimiento, con inscripción y última actualización', b.datos.vencimiento === null && b.datos.inscripcion === '2022-07-08' && b.datos.ultima_actualizacion === '2026-08-19');
  ok('RIF Digital v2.0: domicilio en dos líneas y lectura clara', b.datos.domicilio === 'AV 91 ENTRE CALLES 68 Y 69 LOCAL NRO 1 BARRIO PRUEBA CIUDAD PRUEBA ZULIA ZONA POSTAL 4002' && !b.dudosa);

  const malo = L.leer(viejo.replace('J299682950 FERRETERIA', 'J299682951 FERRETERIA'));
  ok('dígito que no cuadra: lectura dudosa', malo.dudosa && malo.datos.motivos.includes('el dígito verificador no cuadra'));
  const sinNombre = L.leer('REGISTRO ÚNICO DE INFORMACIÓN FISCAL (RIF)\nRIF: V128967423\nDOMICILIO FISCAL CALLE 1 ZONA POSTAL 5201\nFECHA DE VENCIMIENTO: 27/04/2028');
  ok('RIF personal sin razón social: dudosa', sinNombre.datos.rif === 'V128967423' && sinNombre.dudosa && sinNombre.datos.motivos.includes('sin razón social'));

  const ced = '________________\r\n\r\nREPUBLICA BOLIVARIANA DE VENEZUELA\r\nCEDULA DE IDENTIDAD\r\nV 13.004.774\r\nAPELLIDOS PEREZ INVENTADO\r\nNOMBRES ANA MARIA\r\n0444\r\nFIRMA TITULAR\r\n06/11/1977 CASADO\r\nF. NACIMIENTO\r\n15/06/2023 F. EXPEDICION\r\n06/2033\r\nF. VENCIMIENTO\r\nVENEZOLANO';
  const c = L.leer(ced);
  ok('cédula: número, apellidos, nombres y vencimiento', c.tipo === 'cedula' && c.datos.numero === '13004774' && c.datos.apellidos === 'PEREZ INVENTADO' && c.datos.nombres === 'ANA MARIA' && c.datos.vencimiento === '2033-06' && !c.dudosa, JSON.stringify(c.datos));
  const ced2 = L.leer('REPUBLICA BOLIVARIANA DE VENEZUELA \r\nCEDULA DE IDENTIDAD \r\nV 14.654.021 \r\nAPELLIDOS GOMEZ PRUEBA \r\nNOMBRES \r\nFIRMA TITULAR \r\nLUISA TRINIDAD \r\n22-08-78 SOLTERA \r\n26-02-18 02-2028 \r\nF. EXPEDICION F. VENCIMIENTO');
  ok('cédula: nombres unas líneas después del rótulo y vencimiento con guion', ced2.datos.nombres === 'LUISA TRINIDAD' && ced2.datos.vencimiento === '2028-02', JSON.stringify(ced2.datos));
  const ced3 = L.leer('CEDULA DE IDENTIDAD\r\nV 20.662.491\r\nAPELLIDO FERNANDEZ PRUEBA\r\nRUBEN ALFONSO\r\n21/03/1991 SOLTERO\r\n24/11/2020 11/2030');
  ok('cédula: sin rótulo de nombres, la línea que sigue a los apellidos', ced3.datos.nombres === 'RUBEN ALFONSO' && ced3.datos.apellidos === 'FERNANDEZ PRUEBA' && ced3.datos.vencimiento === '2030-11');

  const partida = L.leer('REPUBLICA BOLIVARIANA DE VENEZUELA \r\nCEDULA \r\nDE \r\nIDENTIDAD \r\nV 9.782.934 \r\n041 \r\nAPELDOOS PRUEBA SORICE \r\nHOMBRES JOSE GUIDO \r\n17/08/2021 08/2031');
  ok('cédula con el rótulo partido en líneas y letras cambiadas (APELDOOS, HOMBRES)', partida.tipo === 'cedula' && partida.datos.numero === '9782934' && partida.datos.apellidos === 'PRUEBA SORICE' && partida.datos.nombres === 'JOSE GUIDO' && !partida.dudosa, JSON.stringify(partida));
  const suelta = L.leer('REPUBLICA BOLIVARIANA DE VENEZUE\r\nCEDULA V DE IDENTIDAD 16.836.866\r\nAPELLIDOS PRUEBA OCANDO\r\nNOMBRES ALDO FRANCISCO');
  ok('cédula con la letra separada del número', suelta.datos.letra === 'V' && suelta.datos.numero === '16836866');
  const junto = L.leer(ced + '\r\n' + viejo);
  ok('cédula y RIF en el mismo archivo: combinado, siempre a la IA', junto.tipo === 'combinado' && junto.dudosa && !L.basta('rif_personal', junto) && L.corresponde('rif_personal', junto) === null);
  ok('casilla: una cédula subida en la casilla RIF no corresponde', L.corresponde('rif_personal', c) === false && !L.basta('rif_personal', c));
  ok('casilla: RIF claro en su casilla basta para no gastar IA', L.corresponde('rif_empresa', a) === true && L.basta('rif_empresa', a));
  ok('casilla: lectura dudosa o combinado van a la IA', !L.basta('rif_empresa', malo) && L.corresponde('cedula_rif', c) === null && !L.basta('cedula_rif', c));
  const pol = L.leer('POLIZA DE RESPONSABILIDAD CIVIL GENERAL N° 123\r\nVIGENCIA DESDE 01/02/2026 HASTA 01/02/2027\r\nSUMA ASEGURADA');
  ok('póliza: propone el vencimiento', pol.tipo === 'poliza' && pol.datos.vencimiento_propuesto === '2027-02-01');
  const otro = L.leer('ACTA CONSTITUTIVA DE LA SOCIEDAD MERCANTIL PRUEBA');
  ok('acta u otro documento: no se reconoce y va a la IA', otro.tipo === 'otro' && otro.dudosa && L.corresponde('rif_empresa', otro) === null);
  cerrar();
})();
