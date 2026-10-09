// Arma un KMZ inventado con la misma estructura que el mapa real de ingeniería (sin datos reales).
const zlib = require('zlib');

const cuadro = (lng0, lat0, lng1, lat1) => [[lng0, lat0], [lng1, lat0], [lng1, lat1], [lng0, lat1], [lng0, lat0]].map((p) => p[0] + ',' + p[1] + ',0').join(' ');
const poli = (nombre, c) => '<Placemark><name>' + nombre + '</name><styleUrl>#poly</styleUrl><Polygon><outerBoundaryIs><LinearRing><coordinates>' + c + '</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>';
const multi = (nombre, cs) => '<Placemark><name>' + nombre + '</name><MultiGeometry>' + cs.map((c) => '<Polygon><outerBoundaryIs><LinearRing><coordinates>' + c + '</coordinates></LinearRing></outerBoundaryIs></Polygon>').join('') + '</MultiGeometry></Placemark>';
const punto = (nombre, lng, lat, excl, cdata) => '<Placemark><name>' + nombre + '</name><description>' + (cdata ? '<![CDATA[MDT: ' + nombre + '<br>Estado: Liberado<br>Exclusividad: ' + excl + ']]>' : 'MDT: ' + nombre + '&lt;br&gt;Estado: Liberado&lt;br&gt;Exclusividad: ' + excl) + '</description><Point><coordinates>' + lng + ',' + lat + ',0</coordinates></Point></Placemark>';
const carpeta = (nombre, dentro) => '<Folder><name>' + nombre + '</name>' + dentro + '</Folder>';
const mdt = (nombre, contenido) => carpeta('MDT ' + nombre + '.kml', carpeta('MDT ' + nombre, contenido));

// d: desplazamiento para un segundo mapa (por ejemplo, el diseño que pasa a liberado)
function kml(opciones){
  const o = opciones || {}; const disEstado = o.disenoLiberado ? 'Liberado' : 'Diseño';
  const liberado = carpeta('Ciudad Prueba',
    mdt('AAA001', punto('AAA001', -71.005, 10.005, 'Zona Norte', true) + poli('AAA001 (792HP)', cuadro(-71.010, 10.000, -71.000, 10.010))) +
    mdt('AAA002', punto('AAA002 punto', -71.005, 10.065, 'FALSO') + poli('AAA002 (120HP)', cuadro(-71.010, 10.060, -71.000, 10.070))) +
    mdt('AAA003', punto('AAA003', -71.005, 10.045, 'PLANTA EXTERNA', true) + poli('AAA003 (64HP)', cuadro(-71.010, 10.040, -71.000, 10.050))));
  const exclusiva = carpeta('Ciudad Prueba', mdt('EXC001', punto('EXC001', -71.005, 10.025, 'Aliado Uno', true) + multi('EXC001 (300HP)', [cuadro(-71.010, 10.020, -71.000, 10.030), cuadro(-70.995, 10.020, -70.990, 10.030)])));
  const diseno = carpeta('Ciudad Prueba', mdt('DIS001', poli('DIS001 (500HP)', cuadro(-70.997, 10.000, -70.990, 10.010))));
  const operacion = carpeta('En Operacion', carpeta('Liberado', liberado + (o.disenoLiberado ? diseno : '')) + carpeta('Exclusiva', exclusiva));
  const desarrollo = carpeta('En Desarrollo', (o.disenoLiberado ? '' : carpeta(disEstado, diseno)) +
    carpeta('Construccion', carpeta('Ciudad Prueba', mdt('CON001', poli('CON001', cuadro(-70.980, 10.000, -70.975, 10.005))))) +
    carpeta('Permiso VGT', carpeta('Ciudad Prueba', mdt('VGT001', poli('VGT001', cuadro(-70.970, 10.000, -70.965, 10.005))))));
  const otros = carpeta('Otros', poli('SUELTO', cuadro(-70.900, 10.000, -70.895, 10.005)));
  return '<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>mapa</name><Folder><name>mapa</name>' + operacion + desarrollo + otros + '</Folder></Document></kml>';
}

// ZIP con un solo archivo comprimido (deflate), como un KMZ de Google Earth
function zip(nombre, texto){
  const datos = Buffer.from(texto, 'utf8'); const comp = zlib.deflateRawSync(datos); const n = Buffer.from(nombre, 'utf8');
  const crc = zlib.crc32 ? zlib.crc32(datos) : crc32(datos);
  const loc = Buffer.alloc(30); loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(20, 4); loc.writeUInt16LE(0, 6); loc.writeUInt16LE(8, 8); loc.writeUInt32LE(crc >>> 0, 14); loc.writeUInt32LE(comp.length, 18); loc.writeUInt32LE(datos.length, 22); loc.writeUInt16LE(n.length, 26);
  const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(8, 10); cen.writeUInt32LE(crc >>> 0, 16); cen.writeUInt32LE(comp.length, 20); cen.writeUInt32LE(datos.length, 24); cen.writeUInt16LE(n.length, 28); cen.writeUInt32LE(0, 42);
  const cuerpo = Buffer.concat([loc, n, comp]);
  const fin = Buffer.alloc(22); fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(1, 8); fin.writeUInt16LE(1, 10); fin.writeUInt32LE(46 + n.length, 12); fin.writeUInt32LE(cuerpo.length, 16);
  return Buffer.concat([cuerpo, cen, n, fin]);
}
function crc32(b){ let c, t = []; for(let n = 0; n < 256; n++){ c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } let r = -1; for(let i = 0; i < b.length; i++) r = (r >>> 8) ^ t[(r ^ b[i]) & 255]; return (r ^ -1) >>> 0; }

const kmz = (o) => zip('doc.kml', kml(o));
module.exports = { kmz, kml };
