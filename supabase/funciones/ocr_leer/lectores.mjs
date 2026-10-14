// Lectores con reglas fijas sobre el texto que saca el OCR de Google Drive. Sin IA y sin costo.
// RIF viejo (con vencimiento), RIF Digital v2.0 (sin vencimiento), cédula y póliza. El dígito verificador del RIF
// y el código del sello confirman la lectura; si algo no cuadra, la lectura es "dudosa" y el archivo va a la IA.
// Lo usan la función ocr_leer (Supabase) y las pruebas (pruebas/test35.js). Nada de esto decide: solo lee.
export const VERSION = "ocr-3";

const LETRA = { V: 1, E: 2, J: 3, P: 4, G: 5 };
const DE_SELLO = { 1: "V", 2: "E", 3: "J", 4: "P", 5: "G" };
const PESOS = [4, 3, 2, 7, 6, 5, 4, 3, 2];

// Dígito verificador del RIF: letra y 8 dígitos con pesos 4,3,2,7,6,5,4,3,2; 11 menos el resto (10 y 11 dan 0)
export function digitoRif(letra, ocho){
  const l = LETRA[String(letra || "").toUpperCase()]; const d = String(ocho || "");
  if(!l || !/^\d{8}$/.test(d)) return null;
  let s = l * PESOS[0]; for(let i = 0; i < 8; i++) s += Number(d[i]) * PESOS[i + 1];
  const v = 11 - (s % 11); return v >= 10 ? 0 : v;
}
export const rifValido = (rif) => { const m = /^([VEJPG])(\d{8})(\d)$/.exec(String(rif || "")); return !!m && digitoRif(m[1], m[2]) === Number(m[3]); };

// Google a veces mete letras cirílicas o griegas que se ven iguales a las nuestras
const PARECIDAS = { "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M", "Н": "H", "О": "O", "Р": "P", "С": "C", "Т": "T", "Х": "X", "У": "Y", "І": "I",
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "у": "y", "Ο": "O", "Α": "A", "Ε": "E", "Ι": "I", "Ν": "N", "Τ": "T" };
export function limpiar(t){
  return String(t || "").replace(/[\u0370-\u03ff\u0400-\u04ff]/g, (c) => PARECIDAS[c] || c).replace(/\r/g, "").replace(/[ \t\u00a0]+/g, " ");
}
// Para comparar: mayúsculas y sin tildes (la Ñ se queda)
const plano = (s) => String(s || "").toUpperCase().replace(/Ñ/g, "\u0001").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u0001/g, "Ñ");
const fechaIso = (d) => { const m = /^(\d{2})[\/-](\d{2})[\/-](\d{4})$/.exec(d || ""); return m ? m[3] + "-" + m[2] + "-" + m[1] : null; };
const FECHA = /(\d{2}\/\d{2}\/\d{4})/;

// Líneas que son rótulos del comprobante y nunca la razón social
const ROTULO = /REGISTRO UNICO|DATOS DE REGISTRO|FECHA DE|ULTIMA ACTUALIZACION|IDENTIFICACION DEL|COMPROBANTE|SENIAT|SENIA|REPUBLICA|SERVICIO|MINISTERIO|DOMICILIO|FIRMA|DIVISION|GERENCIA|UNIDAD|SECTOR TRIBUTOS|CONDICION|CONTRIBUYENTE|DOCUMENTO EMITIDO|SELLO|VALIDEZ|ECONOMIA Y FINANZAS|VENEZUELA|RIF DIGITAL|^\W*$/;

// Google a veces parte los rótulos en varias líneas o cambia letras ("CEDUA", "IDENTIDA D"): se busca sobre el texto en una línea
function tipoDe(P1){
  const rif = /REGISTRO UNICO|INFORMACION FISCAL/.test(P1) || (/COMPROBANTE/.test(P1) && /DOMICILIO FISCAL/.test(P1));
  const ced = /\bCEDU\w{0,3}\b/.test(P1) && /IDENTIDA|\bAPE\w*\b|\b[NH]OMBRES\b/.test(P1);
  if(rif && ced) return "combinado";   // cédula y RIF en el mismo archivo: siempre la IA
  if(rif) return "rif";
  if(ced) return "cedula";
  if(/POLIZA/.test(P1) && /(VIGENCIA|HASTA|DESDE)/.test(P1)) return "poliza";
  return "otro";
}

// ---------- RIF ----------
function leerRif(t, P0){
  const P = P0.replace(/[ \t]*\n[ \t]*/g, " ");   // rótulos y fechas aunque Google los parta en líneas
  const lineas = t.split("\n").map((x) => x.trim()); const L = lineas.map(plano);
  const v2 = /RIF DIGITAL V\s*2/.test(P) || (/DATOS DE REGISTRO Y VIGENCIA/.test(P) && !/FECHA DE VENCIMIENTO/.test(P));
  // El número: primero el rótulo "RIF:", si no, la primera letra con 9 dígitos (con o sin guiones)
  const TOK = /\b([VEJPG])[\s-]?(\d{8})[\s-]?(\d)\b/;
  let m = /RIF\s*:\s*([VEJPG])[\s-]?(\d{8})[\s-]?(\d)\b/.exec(P) || TOK.exec(P);
  let rif = m ? m[1] + m[2] + m[3] : null;
  // El sello del comprobante repite el número: 3 = J, 1 = V... (3419999015-HPT)
  const s = /\b([1-5])(\d{9})-[A-Z]{3}\b/.exec(P); const sello = s ? DE_SELLO[s[1]] + s[2] : null;
  const datos = { rif, sello_coincide: sello ? sello === rif : null };
  if(!rif && sello){ rif = sello; datos.rif = rif; }
  // Razón social: lo que sigue al número en su línea; si no hay, la primera línea que no es rótulo antes del domicilio
  let razon = null;
  const iRif = rif ? L.findIndex((x) => x.replace(/[\s-]/g, "").indexOf(rif) >= 0) : -1;
  const iDom = L.findIndex((x) => /DOMICILIO FISCAL/.test(x));
  if(iRif >= 0){
    const resto = lineas[iRif].replace(/^.*?\b[VEJPG][\s-]?\d{8}[\s-]?\d\b/i, "").trim();
    if(/[A-ZÑ]{2}/i.test(resto) && !ROTULO.test(plano(resto))) razon = resto;
  }
  if(!razon){
    const fin = iDom >= 0 ? iDom : L.length;
    for(let i = Math.max(0, iRif); i < fin; i++){
      const x = L[i]; if(i === iRif || ROTULO.test(x) || FECHA.test(x) || /\d{6,}/.test(x) || !/[A-ZÑ]{3}/.test(x)) continue;
      razon = lineas[i]; break;
    }
  }
  datos.razon_social = razon ? razon.replace(/\s+/g, " ").trim() : null;
  // Domicilio fiscal: desde el rótulo hasta "ZONA POSTAL nnnn" (o un máximo de 4 líneas)
  if(iDom >= 0){
    let d = lineas[iDom].replace(/^.*?DOMICILIO FISCAL\s*:?/i, " ");
    for(let i = iDom + 1; i < Math.min(L.length, iDom + 5) && !/ZONA POSTAL\s*\d{4}/.test(plano(d)); i++){
      if(/^\d{10}-[A-Z]{3}/.test(L[i]) || (ROTULO.test(L[i]) && !/^(?:AV|CALLE|CARRERA|URB|SECTOR|LOCAL|EDIF)/.test(L[i]))) break;
      d += " " + lineas[i];
    }
    const z = /^(.*?ZONA [PF]OSTAL\s*\d{4})/i.exec(d.replace(/\s+/g, " ").trim());
    datos.domicilio = (z ? z[1] : d.replace(/\s+/g, " ").trim()).replace(/ZONA FOSTAL/i, "ZONA POSTAL") || null;
  } else datos.domicilio = null;
  // Fechas: con su rótulo; la de inscripción puede quedar unas líneas más abajo
  const tras = (rx, alcance) => { const k = rx.exec(P); if(!k) return null; const resto = P.slice(k.index + k[0].length, k.index + k[0].length + alcance);
    const cortado = resto.split(/ULTIMA ACTUALIZACION|FECHA DE VENCIMIENTO|COMPROBANTE/)[0]; const f = FECHA.exec(cortado) || (alcance > 40 ? FECHA.exec(resto) : null); return f ? fechaIso(f[1]) : null; };
  datos.vencimiento = tras(/FECHA DE VENCIMIENTO\s*:?/, 30);
  datos.ultima_actualizacion = tras(/ULTIMA ACTUALIZACION\s*:?/, 30);
  datos.inscripcion = tras(/FECHA DE INSCRIPCION\s*:?/, 320);
  const c = /COMPROBANTE\s*:?\s*([0-9]{6}[A-Z][0-9]{10,})/.exec(P); datos.comprobante = c ? c[1] : null;
  const tipo = v2 ? "rif_digital" : "rif_viejo";
  if(v2) datos.vencimiento = null;   // el RIF Digital v2.0 no vence
  // Dudosa: sin número, dígito que no cuadra, sello distinto, sin razón social, o el viejo sin vencimiento
  const motivos = [];
  if(!rif) motivos.push("sin RIF"); else if(!rifValido(rif)) motivos.push("el dígito verificador no cuadra");
  if(datos.sello_coincide === false) motivos.push("el sello dice otro número");
  if(!datos.razon_social) motivos.push("sin razón social");
  if(!v2 && !datos.vencimiento) motivos.push("sin fecha de vencimiento");
  return { tipo, datos: Object.assign(datos, { motivos }), dudosa: motivos.length > 0 };
}

// ---------- Cédula ----------
function leerCedula(t, P){
  const lineas = t.split("\n").map((x) => x.trim()); const L = lineas.map(plano);
  const P1 = P.replace(/\s+/g, " ");
  let n = /CEDU\w{0,3}(?: DE)?(?: IDENTIDA ?D)?[\s\S]{0,40}?\b([VE])\s*[-.]?\s*(\d{1,2}[.,]?\d{3}[.,]?\d{3})\b/.exec(P1) || /\b([VE])\s*[-.]?\s*(\d{1,2}[.,]\d{3}[.,]\d{3})\b/.exec(P1);
  if(!n){ const k = /\b(\d{1,2}\.\d{3}\.\d{3})\b/.exec(P1); if(k) n = [k[0], /\bE\b/.test(P1.slice(Math.max(0, k.index - 30), k.index)) ? "E" : "V", k[1]]; }
  const datos = { letra: n ? n[1] : null, numero: n ? n[2].replace(/\D/g, "") : null };
  const nombreDe = (i) => { const x = L[i] || ""; return /^[A-ZÑ ]{3,}$/.test(x) && !/FIRMA|TITULAR|DIRECTOR|VENEZOLAN|REPUBLICA|CEDULA|NACIMIENTO|EXPEDICION|VENCIMIENTO|SOLTER|CASAD|DIVORCIAD|VIUD/.test(x) ? lineas[i].replace(/\s+/g, " ") : null; };
  const iA = L.findIndex((x) => /^APE\w*\b/.test(x)); const iN = L.findIndex((x) => /^[NH]OMBRES?\b/.test(x));
  datos.apellidos = iA >= 0 ? (lineas[iA].replace(/^\S+\s*/, "").trim() || nombreDe(iA + 1)) : null;
  let nom = iN >= 0 ? lineas[iN].replace(/^\S+\s*/, "").trim() : "";
  if(!nom && iN >= 0) for(let i = iN + 1; i < Math.min(L.length, iN + 4) && !nom; i++) nom = nombreDe(i) || "";
  if(!nom && iA >= 0 && iN < 0) nom = nombreDe(iA + 1) || "";   // sin rótulo de nombres: la línea siguiente a los apellidos
  datos.nombres = nom || null;
  // Vencimiento: mes y año solos (06/2033 o 02-2028), que no sean parte de una fecha completa.
  // Expedición: la fecha completa que va justo antes (la de nacimiento va más arriba); deben separarlas 10 años
  const vs = [...P1.matchAll(/(?<![\d\/-])(0[1-9]|1[0-2])[\/-](20\d{2})(?![\d\/-])/g)];
  const v = vs.length ? vs[vs.length - 1] : null;
  datos.vencimiento = v ? v[2] + "-" + v[1] : null;
  const antes = v ? [...P1.slice(0, v.index).matchAll(/\b(\d{2})[\/-](\d{2})[\/-](\d{4}|\d{2})\b/g)] : [];
  const ex = antes.length ? antes[antes.length - 1] : null;
  datos.expedicion = ex ? (ex[3].length === 2 ? "20" + ex[3] : ex[3]) + "-" + ex[2] + "-" + ex[1] : null;
  const motivos = [];
  if(!datos.numero) motivos.push("sin número"); if(!datos.apellidos) motivos.push("sin apellidos"); if(!datos.nombres) motivos.push("sin nombres");
  if(!datos.vencimiento) motivos.push("sin vencimiento");
  else if(datos.expedicion && Number(datos.vencimiento.slice(0, 4)) - Number(datos.expedicion.slice(0, 4)) !== 10) motivos.push("las fechas no cuadran");
  return { tipo: "cedula", datos: Object.assign(datos, { motivos }), dudosa: motivos.length > 0 };
}

// ---------- Póliza: solo propone el vencimiento (la persona confirma) ----------
function leerPoliza(t, P){
  const h = /(?:HASTA|VENCE|VENCIMIENTO|FIN DE VIGENCIA)[^0-9]{0,30}(\d{2}[\/-]\d{2}[\/-]\d{4})/.exec(P);
  const todas = (P.match(/\d{2}[\/-]\d{2}[\/-]\d{4}/g) || []).map(fechaIso).filter(Boolean).sort();
  const vence = h ? fechaIso(h[1].replace(/-/g, "/")) : todas.length ? todas[todas.length - 1] : null;
  return { tipo: "poliza", datos: { vencimiento_propuesto: vence, motivos: vence ? [] : ["sin fecha"] }, dudosa: !vence };
}

export function leer(texto){
  const t = limpiar(texto); const P = plano(t);
  const tipo = tipoDe(P.replace(/\s+/g, " "));
  if(tipo === "combinado") return { tipo, datos: { motivos: ["trae cédula y RIF en el mismo archivo"] }, dudosa: true };
  if(tipo === "rif") return leerRif(t, P);
  if(tipo === "cedula") return leerCedula(t, P);
  if(tipo === "poliza") return leerPoliza(t, P);
  return { tipo: "otro", datos: { motivos: ["no se reconoce el documento"] }, dudosa: true };
}

// ¿El archivo es lo que dice su casilla? Solo para casillas de un documento; los combinados siempre van a la IA
const ESPERA = { rif_empresa: ["rif_viejo", "rif_digital"], rif_personal: ["rif_viejo", "rif_digital"], cedula: ["cedula"] };
export function corresponde(casilla, lectura){
  const e = ESPERA[casilla]; if(!e || !lectura) return null;
  if(lectura.tipo === "otro" || lectura.tipo === "combinado") return null;   // no se sabe qué es o trae varios: decide la IA
  return e.indexOf(lectura.tipo) >= 0;
}
// ¿Esta lectura basta para no gastar IA? RIF o cédula claros en su casilla; combinados, actas y dudosas nunca
export function basta(casilla, lectura){
  return !!lectura && !lectura.dudosa && corresponde(casilla, lectura) === true;
}
