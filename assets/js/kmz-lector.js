// Lee el mapa de red (KMZ o KML) fuera de la pantalla para no trabarla. Sin librerías.
// Recibe { archivo: File } y devuelve { zonas, puntos, poligonos, reparto, sinEstado } o { error }.
// Estructura esperada: carpetas ... > [En Operacion | En Desarrollo] > [Liberado | Exclusiva | Diseño | Construccion | Permiso VGT] > [ciudad] > [MDT ...] > placemarks.
'use strict';
const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const ESTADOS = { 'liberado': 'liberado', 'liberados': 'liberado', 'exclusiva': 'exclusiva', 'exclusivas': 'exclusiva', 'diseno': 'diseno', 'construccion': 'construccion', 'permiso vgt': 'permiso_vgt' };
const VACIOS = ['', 'falso', 'false', 'no', 'n/a', 'na', 'ninguna', 'ninguno', 'en operacion', 'liberado', 'liberada', 'libre', '-', '0'];

function entidades(t){
  return String(t || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}
function textoPlano(t){ return entidades(t).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' '); }
function exclusividad(desc){
  const m = /exclusividad\s*:\s*([^\n]*)/i.exec(textoPlano(desc));
  const crudo = m ? m[1].replace(/\s+/g, ' ').trim() : ''; const v = norm(crudo);
  if(v.indexOf('planta externa') >= 0) return { x: 'planta_externa', a: null };
  if(VACIOS.indexOf(v) >= 0 || v.indexOf('zona') === 0) return { x: 'liberada', a: null };
  return { x: 'aliado', a: crudo.slice(0, 120) };
}
function coords(t){
  const lng = []; const lat = [];
  String(t || '').trim().split(/\s+/).forEach((p) => { const c = p.split(','); const x = Number(c[0]); const y = Number(c[1]); if(isFinite(x) && isFinite(y) && c.length >= 2){ lng.push(Math.round(x * 1e6) / 1e6); lat.push(Math.round(y * 1e6) / 1e6); } });
  if(lng.length > 3 && lng[0] === lng[lng.length - 1] && lat[0] === lat[lat.length - 1]){ lng.pop(); lat.pop(); }
  return { lng, lat };
}
function nombreDe(trozo){ const m = /<name>([\s\S]*?)<\/name>/i.exec(trozo); return m ? entidades(m[1]).replace(/\s+/g, ' ').trim() : ''; }

async function texto(archivo){
  const nombre = norm(archivo.name);
  if(/\.kml$/.test(nombre)) return await archivo.text();
  const buf = new Uint8Array(await archivo.arrayBuffer()); const v = new DataView(buf.buffer);
  let fin = -1;
  for(let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--){ if(v.getUint32(i, true) === 0x06054b50){ fin = i; break; } }
  if(fin < 0) throw new Error('El archivo no es un KMZ válido');
  const n = v.getUint16(fin + 10, true); let pos = v.getUint32(fin + 16, true); const dec = new TextDecoder('utf-8'); let elegido = null;
  for(let k = 0; k < n; k++){
    if(v.getUint32(pos, true) !== 0x02014b50) break;
    const ln = v.getUint16(pos + 28, true), le = v.getUint16(pos + 30, true), lc = v.getUint16(pos + 32, true);
    const e = { nombre: dec.decode(buf.subarray(pos + 46, pos + 46 + ln)), metodo: v.getUint16(pos + 10, true), tam: v.getUint32(pos + 20, true), loc: v.getUint32(pos + 42, true) };
    if(/\.kml$/i.test(e.nombre) && (!elegido || /(^|\/)doc\.kml$/i.test(e.nombre))) elegido = e;
    pos += 46 + ln + le + lc;
  }
  if(!elegido) throw new Error('El KMZ no trae el mapa (doc.kml)');
  const ini = elegido.loc + 30 + v.getUint16(elegido.loc + 26, true) + v.getUint16(elegido.loc + 28, true);
  const datos = buf.subarray(ini, ini + elegido.tam);
  if(elegido.metodo === 0) return dec.decode(datos);
  if(elegido.metodo !== 8) throw new Error('El KMZ usa una compresión que no conozco');
  const st = new Blob([datos]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return await new Response(st).text();
}

function leer(kml){
  const re = /<(\/?)(Folder|Document|Placemark)\b[^>]*>/gi;
  const pila = []; const grupos = new Map(); let m; let poligonos = 0; let puntos = 0;
  while((m = re.exec(kml))){
    const cierra = m[1] === '/'; const tag = m[2].toLowerCase();
    if(tag === 'placemark'){
      if(cierra) continue;
      const finP = kml.indexOf('</Placemark>', re.lastIndex); if(finP < 0) break;
      const trozo = kml.slice(re.lastIndex, finP); re.lastIndex = finP + 12;
      const clave = pila.map((f) => f.nombre).join('\u0001');
      if(!grupos.has(clave)) grupos.set(clave, { ruta: pila.map((f) => f.nombre), poligonos: [], punto: null });
      const g = grupos.get(clave); const nombre = nombreDe(trozo.replace(/<(Polygon|Point|MultiGeometry)\b[\s\S]*$/i, ''));
      const desc = (/<description>([\s\S]*?)<\/description>/i.exec(trozo) || [])[1] || '';
      const polis = trozo.match(/<outerBoundaryIs>[\s\S]*?<\/outerBoundaryIs>/gi) || [];
      polis.forEach((p) => { const c = coords((/<coordinates>([\s\S]*?)<\/coordinates>/i.exec(p) || [])[1]); poligonos++; if(c.lng.length >= 3) g.poligonos.push({ nombre, lng: c.lng, lat: c.lat }); });
      if(!polis.length && /<Point\b/i.test(trozo)){
        puntos++; const c = coords((/<Point\b[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/i.exec(trozo) || [])[1]);
        if(!g.punto) g.punto = { nombre, desc, p: c.lng.length ? [c.lng[0], c.lat[0]] : null };
      }
      continue;
    }
    if(cierra){ pila.pop(); continue; }
    // El nombre de la carpeta es el primer <name> antes de su primer hijo
    const resto = kml.slice(re.lastIndex, re.lastIndex + 2000); const hijo = resto.search(/<(Folder|Document|Placemark)\b/i);
    pila.push({ nombre: nombreDe(hijo >= 0 ? resto.slice(0, hijo) : resto) });
  }
  const zonas = []; const reparto = {}; let sinEstado = 0;
  grupos.forEach((g) => {
    if(!g.poligonos.length) return;
    const rn = g.ruta.map(norm); const iE = rn.findIndex((r) => ESTADOS[r]);
    if(iE < 0){ sinEstado += g.poligonos.length; return; }
    const estado = ESTADOS[rn[iE]]; const ciudad = iE + 1 < g.ruta.length - 1 ? g.ruta[iE + 1] : null;   // la carpeta de ciudad va entre el estado y la del MDT
    const ex = g.punto ? exclusividad(g.punto.desc) : { x: 'liberada', a: null };
    g.poligonos.forEach((p) => {
      const cap = /\((\d{1,6})\s*HP\)/i.exec(p.nombre); const mdt = p.nombre.replace(/\(\s*\d+\s*HP\s*\)/i, '').trim() || (g.punto && g.punto.nombre) || g.ruta[g.ruta.length - 1] || 'Sin nombre';
      zonas.push({ m: mdt.slice(0, 120), n: p.nombre.slice(0, 200), e: estado, x: ex.x, a: ex.a, c: cap ? cap[1] : null, ci: ciudad ? String(ciudad).slice(0, 80) : null, lng: p.lng, lat: p.lat, p: g.punto ? g.punto.p : null });
      reparto[estado] = (reparto[estado] || 0) + 1;
    });
  });
  return { zonas, puntos, poligonos, reparto, sinEstado };
}

self.onmessage = async (e) => {
  try {
    const kml = await texto(e.data.archivo);
    if(!/<kml\b/i.test(kml.slice(0, 5000))) throw new Error('El archivo no es un mapa KML');
    const r = leer(kml);
    if(!r.zonas.length) throw new Error('No encontré zonas con estado (Liberado, Exclusiva, Diseño...) en el mapa');
    self.postMessage(r);
  } catch (err) { self.postMessage({ error: (err && err.message) || 'No se pudo leer el mapa' }); }
};
