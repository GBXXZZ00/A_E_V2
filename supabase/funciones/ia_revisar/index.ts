// Revisión con IA: lee con Gemini los archivos vigentes de un cliente (desde Drive), guarda lo leído y decide con las reglas.
// La despierta la base (privado.ia_despertar) con un token interno; no la llama el navegador. La IA solo lee: decide reglas.mjs.
// Copia del código publicado en Supabase. Sin claves: GEMINI_API_KEY y los secretos de Google viven en Supabase.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { evaluar } from "./reglas.mjs";

const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const db = createClient(URL_BASE, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
const respuesta = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
const MAX_BYTES = 30 * 1024 * 1024;  // tope para no llenar la memoria de la función
const TIPOS = /^(application\/pdf|image\/(jpeg|png|webp|heic|heif))$/i;

// ---------- Google Drive ----------
let permiso = { token: "", vence: 0 };
async function tokenGoogle(): Promise<string> {
  if (permiso.token && Date.now() < permiso.vence) return permiso.token;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: (Deno.env.get("GOOGLE_CLIENT_ID") || "").trim(),
      client_secret: (Deno.env.get("GOOGLE_CLIENT_SECRET") || "").trim(),
      refresh_token: (Deno.env.get("GOOGLE_REFRESH_TOKEN") || "").trim(),
      grant_type: "refresh_token",
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) { console.error("token google", r.status, d?.error); return ""; }
  permiso = { token: d.access_token, vence: Date.now() + (Number(d.expires_in) || 3600) * 1000 - 120000 };
  return permiso.token;
}
async function bajar(driveId: string): Promise<Uint8Array> {
  const tk = await tokenGoogle();
  if (!tk) throw new Error("El permiso de Google venció");
  const r = await fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(driveId) + "?alt=media&supportsAllDrives=true", { headers: { Authorization: "Bearer " + tk } });
  if (!r.ok) { if (r.status === 401) permiso = { token: "", vence: 0 }; throw new Error(r.status === 404 ? "El archivo ya no está en Drive" : "Drive no respondió (" + r.status + ")"); }
  return new Uint8Array(await r.arrayBuffer());
}

// ---------- Gemini ----------
const CLAVE = () => (Deno.env.get("GEMINI_API_KEY") || "").trim();
const API = "https://generativelanguage.googleapis.com/v1beta/";
let modeloElegido = "";
// 'auto': el Pro más nuevo que ofrezca Google para esta clave
async function elegirModelo(ajuste: string): Promise<string> {
  const a = String(ajuste || "auto").trim();
  if (a && a !== "auto") return a.replace(/^models\//, "");
  if (modeloElegido) return modeloElegido;
  const r = await fetch(API + "models?pageSize=1000", { headers: { "x-goog-api-key": CLAVE() } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 400 || r.status === 403 ? "Google no aceptó la clave de Gemini" : "Google no respondió (" + r.status + ")");
  const ver = (n: string) => { const m = n.match(/gemini-(\d+(?:\.\d+)?)/); return m ? Number(m[1]) : 0; };
  const pros = ((d.models || []) as { name: string; supportedGenerationMethods?: string[] }[])
    .map((m) => ({ n: String(m.name || "").replace(/^models\//, ""), g: m.supportedGenerationMethods || [] }))
    .filter((m) => /^gemini-[\d.]+-pro/.test(m.n) && m.g.includes("generateContent") && !/(tts|image|audio|live|computer|embedding|exp)/.test(m.n))
    .sort((x, y) => ver(y.n) - ver(x.n) || Number(/latest/.test(y.n)) - Number(/latest/.test(x.n)) || x.n.length - y.n.length);
  if (!pros.length) throw new Error("Esta clave no tiene un modelo Pro de Gemini disponible");
  modeloElegido = pros[0].n;
  return modeloElegido;
}

const S = (extra: Record<string, unknown> = {}) => ({ type: "STRING", nullable: true, ...extra });
const ESQUEMA = {
  type: "OBJECT",
  properties: {
    legible: { type: "BOOLEAN" },
    paginas: { type: "INTEGER" },
    documentos: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          tipo: { type: "STRING", enum: ["cedula", "rif_personal", "rif_empresa", "acta_constitutiva", "acta_asamblea", "conatel", "contrato", "poder", "otro"] },
          pagina_inicio: { type: "INTEGER" },
          pagina_fin: { type: "INTEGER" },
          legible: { type: "BOOLEAN" },
          nombre: S({ description: "Persona (cédula, RIF personal) o firmante" }),
          numero: S({ description: "Número de cédula o RIF tal como aparece" }),
          razon_social: S(),
          fecha_expedicion: S({ description: "AAAA-MM-DD o AAAA-MM" }),
          fecha_vencimiento: S({ description: "AAAA-MM-DD o AAAA-MM" }),
          direccion: S({ description: "Domicilio completo como aparece" }),
          fecha_inscripcion: S({ description: "Fecha de inscripción en el Registro Mercantil, AAAA-MM-DD" }),
          fecha_asamblea: S({ description: "Fecha de la reunión de la asamblea, AAAA-MM-DD" }),
          duracion_anos: { type: "INTEGER", nullable: true },
          duracion_indefinida: { type: "BOOLEAN", nullable: true },
          junta: { type: "ARRAY", items: { type: "OBJECT", properties: { nombre: S(), cedula: S(), cargo: S() } } },
          junta_anos: { type: "INTEGER", nullable: true },
          clausula_permanencia: { type: "BOOLEAN", nullable: true },
          regimen_firma: { type: "STRING", enum: ["separada", "conjunta", "conjunta_o_separada", "no_dice"] },
          clausula_sucursales: { type: "BOOLEAN", nullable: true },
          asamblea_temas: { type: "ARRAY", items: { type: "STRING", enum: ["cambio_nombre", "cambio_domicilio", "cambio_junta", "ratificacion_junta", "prorroga", "aumento_capital", "otro"] } },
          firmado: { type: "BOOLEAN", nullable: true },
          firmante: S(),
          observacion: S({ description: "Dudas: lo que no se ve bien o no está claro" }),
        },
        required: ["tipo", "pagina_inicio", "legible"],
      },
    },
  },
  required: ["legible", "documentos"],
};

const INSTRUCCIONES = `Eres un lector de documentos legales de Venezuela para un proveedor de internet. Solo lees y extraes datos; no decides si el cliente es apto.
El archivo puede traer uno o varios documentos (por ejemplo cédula y RIF en el mismo PDF). Devuelve cada documento por separado con la página donde empieza y termina.
Reglas:
- No inventes. Si un dato no se ve o no está, déjalo en null. Si algo se ve borroso o dudoso, pon legible en false o explícalo en observacion.
- Fechas en formato AAAA-MM-DD; si solo trae mes y año, AAAA-MM. La cédula venezolana trae fecha de expedición y de vencimiento (mes y año).
- RIF: fecha de vencimiento, razón social o nombre, y el domicilio fiscal completo.
- Actas (constitutiva o de asamblea): revisa TODAS las páginas, no solo la cláusula. Busca:
  * fecha_inscripcion: la fecha en que el Registro Mercantil inscribió el documento, no la fecha de la reunión. Suele estar en la nota o sello de registro,
    al principio, al final o en el margen, con frases como "quedó inscrito", "inscrito en el Registro Mercantil", "bajo el N°", "Tomo"; las fechas pueden venir en letras;
  * razon_social y direccion (domicilio de la empresa) completos; si en una página solo dice la ciudad, busca en las otras;
  * duracion_anos de la empresa, o duracion_indefinida si dice que no vence; null si no aparece en ninguna página;
  * junta: quiénes forman la junta directiva con su cédula y cargo (en el acta constitutiva suele estar en las disposiciones finales o transitorias); junta_anos: por cuántos años la designan;
  * duracion_anos: la cláusula de duración suele decir "la duración de la compañía será de cincuenta (50) años"; los números pueden venir en letras;
  * clausula_permanencia: si dice que los directores permanecen en sus cargos hasta ser sustituidos o hasta que se elija nueva junta;
  * regimen_firma: cómo firman los directores (no los apoderados): separada, conjunta, o conjunta_o_separada si dice "conjunta y/o separadamente"; no_dice si no aparece;
  * clausula_sucursales: si permite abrir sucursales u oficinas en otros lugares;
  * asamblea_temas: qué decidió la asamblea (cambio de nombre, de domicilio, de junta, ratificación de junta, prórroga, aumento de capital u otro).
- Contrato: si está firmado y quién firma.
- tipo "poder" para un poder notariado; "otro" para lo que no sea ninguno de los anteriores.`;

// El archivo se entrega a Google tal cual (sin convertirlo a texto): gasta poco procesamiento en la función
async function subirAGemini(mime: string, bytes: Uint8Array, nombre: string): Promise<{ uri: string; name: string }> {
  const ini = await fetch("https://generativelanguage.googleapis.com/upload/v1beta/files", {
    method: "POST",
    headers: { "x-goog-api-key": CLAVE(), "X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.length), "X-Goog-Upload-Header-Content-Type": mime, "Content-Type": "application/json" },
    body: JSON.stringify({ file: { display_name: nombre.slice(0, 100) } }),
  });
  const url = ini.headers.get("x-goog-upload-url");
  if (!ini.ok || !url) throw new Error("Google no recibió el archivo (" + ini.status + ")");
  const sub = await fetch(url, { method: "POST", headers: { "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" }, body: bytes });
  const d = await sub.json().catch(() => ({}));
  if (!sub.ok || !d.file?.uri) throw new Error("Google no recibió el archivo (" + sub.status + ")");
  let f = d.file;
  for (let i = 0; i < 20 && f.state === "PROCESSING"; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const r = await fetch(API + f.name, { headers: { "x-goog-api-key": CLAVE() } });
    f = await r.json().catch(() => f);
  }
  if (f.state === "FAILED") throw new Error("Google no pudo abrir el archivo");
  return { uri: f.uri, name: f.name };
}
const borrarDeGemini = (name: string) => fetch(API + name, { method: "DELETE", headers: { "x-goog-api-key": CLAVE() } }).catch(() => {});

async function leerConGemini(modelo: string, mime: string, uri: string) {
  const cuerpo = JSON.stringify({
    systemInstruction: { parts: [{ text: INSTRUCCIONES }] },
    contents: [{ role: "user", parts: [{ fileData: { mimeType: mime, fileUri: uri } }, { text: "Lee este archivo y devuelve los datos según el esquema." }] }],
    // Alta resolución: los documentos son escaneos y fotos; lee mejor sellos y letra pequeña
    generationConfig: { responseMimeType: "application/json", responseSchema: ESQUEMA, maxOutputTokens: 32768, mediaResolution: "MEDIA_RESOLUTION_HIGH" },
  });
  let ultimo = "";
  for (const espera of [0, 4000, 12000]) {
    if (espera) await new Promise((r) => setTimeout(r, espera));
    const r = await fetch(API + "models/" + encodeURIComponent(modelo) + ":generateContent", { method: "POST", headers: { "x-goog-api-key": CLAVE(), "Content-Type": "application/json" }, body: cuerpo });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      const texto = ((d.candidates?.[0]?.content?.parts || []) as { text?: string; thought?: boolean }[]).filter((p) => !p.thought).map((p) => p.text || "").join("");
      const u = d.usageMetadata || {};
      let datos: { legible?: boolean; paginas?: number; documentos?: unknown[] } = {};
      try { datos = JSON.parse(texto); } catch { throw new Error("Gemini no devolvió datos legibles"); }
      return { datos, entrada: Number(u.promptTokenCount) || 0, salida: (Number(u.candidatesTokenCount) || 0) + (Number(u.thoughtsTokenCount) || 0) };
    }
    ultimo = d?.error?.message || String(r.status);
    if (![429, 500, 502, 503, 504].includes(r.status)) break;
  }
  throw new Error("Gemini: " + ultimo.slice(0, 200));
}

// ---------- Trabajo ----------
type Trabajo = {
  corrida: number; hoy: string; ajustes: Record<string, string>; excepciones: unknown[];
  cliente: Record<string, unknown>; representantes: unknown[]; faltantes: unknown[];
  documentos: { id: number; casilla: string; numero: number; estado: string; archivos: number[] }[];
  archivos: { id: number; drive_id: string | null; nombre: string; mime: string; tamano: number }[];
  lecturas: Record<string, { estado: string; documentos: unknown[]; error?: string }>;
};

async function trabajar(corrida: number) {
  const { data, error } = await db.rpc("ia_trabajo", { p_corrida: corrida });
  if (error) { console.error("ia_trabajo", error.message); return; }
  if (!data) return;   // la tiene otra llamada o ya terminó
  const w = data as Trabajo;
  try {
    const pendientes = w.archivos.filter((a) => !w.lecturas[String(a.id)]);
    let modelo = "";
    if (pendientes.length) {
      if (!CLAVE()) throw new Error("Falta la clave de Gemini en Supabase (GEMINI_API_KEY)");
      modelo = await elegirModelo(w.ajustes.modelo);
    }
    const pe = Number(w.ajustes.precio_entrada) || 0; const ps = Number(w.ajustes.precio_salida) || 0;
    // Un archivo por llamada: así ninguna llamada pasa los límites de la función; luego se llama de nuevo
    const a = pendientes[0];
    if (a) {
      let lectura: Record<string, unknown>;
      const mime = String(a.mime || "").toLowerCase();
      if (!a.drive_id) lectura = { estado: "error", error: "El archivo no está en Drive" };
      else if (!TIPOS.test(mime)) lectura = { estado: "formato", error: "Tipo de archivo que la IA no lee: " + (mime || "desconocido") };
      else if (Number(a.tamano) > MAX_BYTES) lectura = { estado: "formato", error: "Archivo muy grande para leerlo de una vez" };
      else {
        try {
          const bytes = await bajar(a.drive_id);
          if (bytes.length > MAX_BYTES) lectura = { estado: "formato", error: "Archivo muy grande para leerlo de una vez" };
          else {
            const f = await subirAGemini(mime, bytes, a.nombre || "archivo");
            let g;
            try { g = await leerConGemini(modelo, mime, f.uri); } finally { borrarDeGemini(f.name); }
            const costo = Math.round(((g.entrada * pe + g.salida * ps) / 1e6) * 1e5) / 1e5;
            lectura = { estado: g.datos.legible === false && !(g.datos.documentos || []).length ? "ilegible" : "ok", hallazgos: g.datos.documentos || [], paginas: g.datos.paginas || null,
              tokens_entrada: g.entrada, tokens_salida: g.salida, costo_usd: costo, modelo };
          }
        } catch (e) {
          lectura = { estado: "error", error: (e as Error).message };
          if (/permiso de Google|clave de Gemini|no aceptó/.test((e as Error).message)) throw e;   // no sirve seguir con los demás
        }
      }
      const { error: eg } = await db.rpc("ia_guardar_lectura", { p_corrida: corrida, p_archivo: a.id, p_datos: lectura });
      if (eg) throw new Error("No se pudo guardar lo leído: " + eg.message);
      w.lecturas[String(a.id)] = { estado: String(lectura.estado), documentos: (lectura.hallazgos as unknown[]) || [], error: lectura.error as string };
      if (pendientes.length > 1) { await seguir(corrida); return; }
    }
    // Todo leído: deciden las reglas (sin IA y sin costo)
    const r = evaluar({ hoy: w.hoy, cliente: w.cliente, representantes: w.representantes, faltantes: w.faltantes, documentos: w.documentos, lecturas: w.lecturas, excepciones: w.excepciones });
    const { error: er } = await db.rpc("ia_guardar_resultado", { p_corrida: corrida, p_resultado: r });
    if (er) throw new Error("No se pudo guardar el resultado: " + er.message);
  } catch (e) {
    console.error("corrida", corrida, (e as Error).message);
    await db.rpc("ia_fallo", { p_corrida: corrida, p_error: (e as Error).message });
  }
}
// Expedientes largos: suelta la corrida y se llama de nuevo para seguir
async function seguir(corrida: number) {
  await db.rpc("ia_soltar", { p_corrida: corrida });
  await fetch(URL_BASE + "/functions/v1/ia_revisar", { method: "POST", headers: { "Content-Type": "application/json", "x-tarea": TAREA }, body: JSON.stringify({ corrida }) }).catch((e) => console.error("seguir", e));
}

let TAREA = "";
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return respuesta({ error: "Método no permitido" }, 405);
  const tk = req.headers.get("x-tarea") || "";
  const { data: valido } = await db.rpc("ia_tarea_ok", { p_token: tk });
  if (valido !== true) return respuesta({ error: "No autorizado" }, 401);
  TAREA = tk;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const corrida = Number(b.corrida);
  if (!Number.isInteger(corrida) || corrida < 1) return respuesta({ error: "Falta la corrida" }, 400);
  // Responde enseguida; el trabajo sigue en segundo plano
  EdgeRuntime.waitUntil(trabajar(corrida));
  return respuesta({ ok: true }, 202);
});
