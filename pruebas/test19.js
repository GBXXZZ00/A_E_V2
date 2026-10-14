// IA más rápida: la función ia_revisar lee varios archivos a la vez (hasta 4 y sin pasar ~45 MB) y guarda cada lectura igual que antes.
// Corre el código real de supabase/funciones/ia_revisar/index.ts con Drive, Gemini y la base simulados (sin red y sin costo).
const fs = require('fs');
const path = require('path');
const ts = require(require('child_process').execSync('npm root -g').toString().trim() + '/typescript');
const { marcador } = require('./simulador');
const { ok, cerrar } = marcador();

const fuente = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'funciones', 'ia_revisar', 'index.ts'), 'utf8')
  .replace(/^import .*$/gm, '') + '\nglobalThis.__trabajar = trabajar; globalThis.__leerSuelto = leerSuelto;\n';
const js = ts.transpileModule(fuente, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;

function montar(op){
  const s = { activos: 0, maxActivos: 0, guardadas: [], seguir: 0, resultado: null, fallo: null, lecturas: {}, subidas: 0, gemini: 0, ocrLeido: 0, ocrPedido: 0 };
  const ocr = Object.assign({}, op.ocr || {});
  const archivos = op.archivos;
  const db = { rpc: async (fn, a) => {
    if(fn === 'ia_trabajo') return { data: { corrida: 1, hoy: '2026-10-09', ajustes: Object.assign({ modelo: 'gemini-x-pro', precio_entrada: '1', precio_salida: '1' }, op.ajustes || {}), excepciones: [],
      cliente: { nombre: 'Ejemplo' }, representantes: [], faltantes: [], documentos: op.documentos || [], archivos, lecturas: Object.assign({}, s.lecturas) } };
    if(fn === 'ia_guardar_lectura'){ s.guardadas.push(a.p_archivo); s.lecturas[String(a.p_archivo)] = a.p_datos; return {}; }
    if(fn === 'ia_guardar_resultado'){ s.resultado = a.p_resultado; return {}; }
    if(fn === 'ia_fallo'){ s.fallo = a.p_error; return {}; }
    if(fn === 'ia_archivo_datos') return { data: { archivo: archivos[0], ajustes: { modelo: 'gemini-x-pro', precio_entrada: '1', precio_salida: '1' }, leido: !!op.yaLeido } };
    if(fn === 'ia_guardar_lectura_sola'){ s.sola = a; return {}; }
    return {};
  },
  // Corrida 14/10 tarde: lo que el OCR ya leyó (public.ocr_lecturas)
  from: (t) => ({ select: () => ({ in: async (k, ids) => { s.ocrLeido++; return { data: ids.filter((v) => ocr[v]).map((v) => ({ archivo_id: v, ...ocr[v] })) }; } }) }) };
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const fetchFalso = async (url, o) => {
    url = String(url);
    if(url.includes('oauth2')) return op.sinToken ? { ok: false, status: 400, json: async () => ({ error: 'invalid_grant' }) } : { ok: true, json: async () => ({ access_token: 't', expires_in: 3600 }) };
    if(url.includes('/drive/v3/files/')){
      const id = decodeURIComponent(url.split('/files/')[1].split('?')[0]);
      if(op.driveFalla === id) return { ok: false, status: op.driveStatus || 500, json: async () => ({}) };
      return { ok: true, arrayBuffer: async () => new Uint8Array(10).buffer };
    }
    if(url.includes('/upload/v1beta/files')) return { ok: true, headers: { get: () => 'https://subir.test/x' }, json: async () => ({}) };
    if(url.startsWith('https://subir.test')){ s.subidas++; return { ok: true, json: async () => ({ file: { uri: 'u' + s.subidas, name: 'files/' + s.subidas, state: 'ACTIVE' } }) }; }
    if(url.includes('/functions/v1/ocr_leer')){ s.ocrPedido++; if(op.ocrCaido) throw new Error('sin red'); for(const id of JSON.parse(o.body).archivos) if(op.ocrTarde && op.ocrTarde[id]) ocr[id] = op.ocrTarde[id]; return { ok: true, json: async () => ({ ok: true }) }; }
    if(url.includes(':generateContent')){
      s.gemini++; s.activos++; s.maxActivos = Math.max(s.maxActivos, s.activos);
      await espera(op.demora || 120);
      s.activos--;
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ legible: true, paginas: 1, documentos: [{ tipo: 'cedula', pagina_inicio: 1, legible: true }] }) }] } }], usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 100 } }) };
    }
    if(url.includes('/functions/v1/ia_revisar')){ s.seguir++; return { ok: true }; }
    if(o && o.method === 'DELETE') return { ok: true };
    return { ok: true, json: async () => ({}) };
  };
  const ctx = {
    console: { error(){}, log(){} }, setTimeout, Promise, JSON, Math, Number, String, Error, Object, Uint8Array, URLSearchParams, Date, encodeURIComponent, decodeURIComponent,
    fetch: fetchFalso,
    Deno: { env: { get: (k) => ({ SUPABASE_URL: 'https://base.test', GEMINI_API_KEY: 'clave' })[k] || 'x' }, serve(){} },
    EdgeRuntime: { waitUntil(){} },
    createClient: () => db,
    evaluar: (e) => ({ veredicto: 'apto', leidos: Object.keys(e.lecturas).length, puntos: [], marcas: [] }),
    globalThis: null
  };
  ctx.globalThis = ctx;
  new Function(...Object.keys(ctx), js).apply(null, Object.values(ctx));
  return { s, trabajar: ctx.__trabajar, leerSuelto: ctx.__leerSuelto };
}
const arch = (n, extra) => Array.from({ length: n }, (_, i) => Object.assign({ id: i + 1, drive_id: 'd' + (i + 1), nombre: 'a' + (i + 1) + '.pdf', mime: 'application/pdf', tamano: 1024 * 1024 }, extra && extra(i)));

const docsOcr = [{ id: 11, casilla: 'rif_empresa', numero: 0, estado: 'por_revisar', archivos: [1] }, { id: 12, casilla: 'cedula', numero: 1, estado: 'por_revisar', archivos: [2] },
  { id: 13, casilla: 'acta_constitutiva', numero: 0, estado: 'por_revisar', archivos: [3] }, { id: 14, casilla: 'rif_personal', numero: 1, estado: 'por_revisar', archivos: [4] }, { id: 15, casilla: 'cedula_rif', numero: 2, estado: 'por_revisar', archivos: [4] }];
const ocrFilas = { 1: { estado: 'ok', tipo: 'rif_digital', dudosa: false, datos: { rif: 'J418888023', razon_social: 'EMPRESA INVENTADA, C.A', domicilio: 'CALLE 1 ZONA POSTAL 4001', vencimiento: null } },
  2: { estado: 'ok', tipo: 'cedula', dudosa: true, datos: { letra: 'V', numero: '123', nombres: null, apellidos: 'X' } }, 3: { estado: 'ok', tipo: 'otro', dudosa: true, datos: {} },
  4: { estado: 'ok', tipo: 'rif_viejo', dudosa: false, datos: { rif: 'V128967423', razon_social: 'PERSONA INVENTADA', vencimiento: '2028-04-27' } } };

(async () => {
  // Corrida 14/10 tarde: el OCR en la revisión
  let o = montar({ archivos: arch(4), documentos: docsOcr, ocr: ocrFilas });
  await o.trabajar(1);
  ok('OCR apagado (NO): todo va a Gemini igual que hoy y ni se mira el OCR', o.s.gemini === 4 && o.s.ocrLeido === 0 && o.s.ocrPedido === 0);
  o = montar({ archivos: arch(4), documentos: docsOcr, ocr: ocrFilas, ajustes: { ocr_revision: 'si' } });
  await o.trabajar(1);
  const lo = o.s.lecturas['1'];
  ok('OCR prendido: el RIF claro no va a Gemini y pasa a las reglas sin costo', lo && lo.modelo === 'ocr-drive' && lo.costo_usd === 0 && lo.hallazgos[0].tipo === 'rif_empresa' && lo.hallazgos[0].formato === 'rif_digital' && lo.hallazgos[0].numero === 'J418888023');
  ok('OCR prendido: la cédula dudosa, el acta y el archivo combinado (cédula + RIF) sí van a Gemini', o.s.gemini === 3 && o.s.lecturas['2'].modelo === 'gemini-x-pro' && o.s.lecturas['3'].modelo === 'gemini-x-pro' && o.s.lecturas['4'].modelo === 'gemini-x-pro');
  ok('OCR prendido: las reglas deciden con todo leído', o.s.resultado && o.s.resultado.leidos === 4);
  o = montar({ archivos: arch(1), documentos: [docsOcr[0]], ocr: {}, ajustes: { ocr_revision: 'si' }, ocrTarde: { 1: ocrFilas[1] } });
  await o.trabajar(1);
  ok('sin lectura previa: pide el OCR, espera y no gasta Gemini', o.s.ocrPedido === 1 && o.s.gemini === 0 && o.s.lecturas['1'].modelo === 'ocr-drive');
  o = montar({ archivos: arch(1), documentos: [docsOcr[0]], ocr: {}, ajustes: { ocr_revision: 'si' }, ocrCaido: true });
  await o.trabajar(1);
  ok('OCR caído: vuelve al camino de hoy (Gemini) sin fallar', o.s.gemini === 1 && o.s.lecturas['1'].modelo === 'gemini-x-pro' && !o.s.fallo);
  // Seis RIF de empresa de una casilla cada uno: el OCR toma 4 en una sola llamada y los otros 2 quedan para la próxima (sin Gemini)
  const seis = [1, 2, 3, 4, 5, 6].map((i) => ({ id: 20 + i, casilla: 'rif_empresa', numero: i, estado: 'por_revisar', archivos: [i] }));
  const filas6 = {}; for(let i = 1; i <= 6; i++) filas6[i] = ocrFilas[1];
  o = montar({ archivos: arch(6), documentos: seis, ocr: filas6, ajustes: { ocr_revision: 'si' } });
  await o.trabajar(1);
  ok('OCR de 4 en 4: una llamada, 4 resueltos, los otros 2 a la próxima sin Gemini', o.s.ocrPedido === 1 && Object.keys(o.s.lecturas).length === 4 && o.s.gemini === 0 && o.s.seguir === 1 && !o.s.resultado);

  // 1. Seis archivos: lee 4 a la vez, guarda los 4 y se llama de nuevo para los otros 2
  let m = montar({ archivos: arch(6) });
  const t0 = Date.now();
  await m.trabajar(1);
  ok('lee 4 archivos a la vez (vio ' + m.s.maxActivos + ')', m.s.maxActivos === 4);
  ok('guarda los 4 en orden', m.s.guardadas.join() === '1,2,3,4');
  ok('quedan 2: se llama de nuevo y todavía no decide', m.s.seguir === 1 && !m.s.resultado);
  ok('el lote tarda como un solo archivo, no como cuatro', Date.now() - t0 < 400);
  await m.trabajar(1);
  ok('la segunda llamada lee los 2 que faltaban', m.s.guardadas.join() === '1,2,3,4,5,6');
  ok('con todo leído deciden las reglas con las 6 lecturas', m.s.resultado && m.s.resultado.leidos === 6);
  const l1 = m.s.lecturas['1'];
  ok('cada lectura guarda lo mismo que antes (estado, tokens, costo, modelo)', l1.estado === 'ok' && l1.tokens_entrada === 1000 && l1.costo_usd === 0.0011 && l1.modelo === 'gemini-x-pro');

  // 2. Archivos grandes: no pasa ~45 MB por llamada
  m = montar({ archivos: arch(3, () => ({ tamano: 20 * 1024 * 1024 })) });
  await m.trabajar(1);
  ok('con archivos de 20 MB lee 2 por llamada', m.s.guardadas.join() === '1,2');

  // 3. Un archivo que Drive no entrega no frena a los demás
  m = montar({ archivos: arch(3), driveFalla: 'd2', driveStatus: 404 });
  await m.trabajar(1);
  ok('el que falla queda con su error', m.s.lecturas['2'].estado === 'error' && /ya no está en Drive/.test(m.s.lecturas['2'].error));
  ok('los demás se leen y sale el resultado', m.s.lecturas['1'].estado === 'ok' && m.s.lecturas['3'].estado === 'ok' && m.s.resultado);

  // 4. Formatos que no se leen no llaman a Gemini
  m = montar({ archivos: arch(2, (i) => (i === 0 ? { mime: 'application/msword' } : {})) });
  await m.trabajar(1);
  ok('un Word queda como formato y solo se sube el PDF', m.s.lecturas['1'].estado === 'formato' && m.s.subidas === 1);

  // 5. Un error grave (venció el permiso de Google) detiene la corrida sin guardar lecturas a medias
  m = montar({ archivos: arch(3), sinToken: true });
  await m.trabajar(1);
  ok('sin permiso de Google la corrida falla con aviso y no guarda nada', /permiso de Google/.test(m.s.fallo || '') && !m.s.guardadas.length && !m.s.resultado);

  // 6. Lectura adelantada (solicitudes de aliados): un archivo apenas se sube, sin corrida
  m = montar({ archivos: arch(1) });
  await m.leerSuelto(1);
  ok('lee el archivo suelto y lo guarda sin corrida', m.s.sola && m.s.sola.p_archivo === 1 && m.s.sola.p_datos.estado === 'ok' && m.s.subidas === 1);
  m = montar({ archivos: arch(1), yaLeido: true });
  await m.leerSuelto(1);
  ok('si ya estaba leído no lo vuelve a leer ni cobra', !m.s.sola && m.s.subidas === 0);
  m = montar({ archivos: arch(1), sinToken: true });
  await m.leerSuelto(1);
  ok('sin permiso de Google no guarda un error que tape la lectura', !m.s.sola);

  cerrar();
})().catch((e) => { console.error(e); process.exit(1); });
