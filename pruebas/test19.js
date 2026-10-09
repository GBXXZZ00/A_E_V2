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
  const s = { activos: 0, maxActivos: 0, guardadas: [], seguir: 0, resultado: null, fallo: null, lecturas: {}, subidas: 0 };
  const archivos = op.archivos;
  const db = { rpc: async (fn, a) => {
    if(fn === 'ia_trabajo') return { data: { corrida: 1, hoy: '2026-10-09', ajustes: { modelo: 'gemini-x-pro', precio_entrada: '1', precio_salida: '1' }, excepciones: [],
      cliente: { nombre: 'Ejemplo' }, representantes: [], faltantes: [], documentos: [], archivos, lecturas: Object.assign({}, s.lecturas) } };
    if(fn === 'ia_guardar_lectura'){ s.guardadas.push(a.p_archivo); s.lecturas[String(a.p_archivo)] = a.p_datos; return {}; }
    if(fn === 'ia_guardar_resultado'){ s.resultado = a.p_resultado; return {}; }
    if(fn === 'ia_fallo'){ s.fallo = a.p_error; return {}; }
    if(fn === 'ia_archivo_datos') return { data: { archivo: archivos[0], ajustes: { modelo: 'gemini-x-pro', precio_entrada: '1', precio_salida: '1' }, leido: !!op.yaLeido } };
    if(fn === 'ia_guardar_lectura_sola'){ s.sola = a; return {}; }
    return {};
  } };
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
    if(url.includes(':generateContent')){
      s.activos++; s.maxActivos = Math.max(s.maxActivos, s.activos);
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

(async () => {
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
