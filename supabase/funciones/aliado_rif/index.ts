// Lectura rápida del RIF de una solicitud de aliado: el aliado lo sube y en segundos sabe si el cliente está disponible.
// La IA solo lee el número y el nombre; decide la base (public.solicitud_rif_leido): bloqueos por TOP, cartera, Odoo u otro aliado.
// El archivo no se guarda aquí: si el cliente queda libre, la pantalla lo sube después a Drive como cualquier documento.
// Copia del código publicado en Supabase. Sin claves: GEMINI_API_KEY vive en Supabase.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { ...cors, "Content-Type": "application/json" } });
const fallo = (mensaje: string, status: number) => json({ error: mensaje }, status);
const MAX = 15 * 1024 * 1024;
const TIPOS = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

const CLAVE = () => (Deno.env.get("GEMINI_API_KEY") || "").trim();
const API = "https://generativelanguage.googleapis.com/v1beta/";
let modeloElegido = "";
// 'auto': el Flash más nuevo (rápido y barato); el expediente completo lo sigue leyendo el modelo Pro
async function elegirModelo(ajuste: string): Promise<string> {
  const a = String(ajuste || "auto").trim();
  if (a && a !== "auto") return a.replace(/^models\//, "");
  if (modeloElegido) return modeloElegido;
  const r = await fetch(API + "models?pageSize=1000", { headers: { "x-goog-api-key": CLAVE() } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Google no aceptó la clave de Gemini");
  const ver = (n: string) => { const m = n.match(/gemini-(\d+(?:\.\d+)?)/); return m ? Number(m[1]) : 0; };
  const flash = ((d.models || []) as { name: string; supportedGenerationMethods?: string[] }[])
    .map((m) => ({ n: String(m.name || "").replace(/^models\//, ""), g: m.supportedGenerationMethods || [] }))
    .filter((m) => /^gemini-[\d.]+-flash/.test(m.n) && m.g.includes("generateContent") && !/(lite|tts|image|audio|live|embedding|exp|8b)/.test(m.n))
    .sort((x, y) => ver(y.n) - ver(x.n) || Number(/latest/.test(y.n)) - Number(/latest/.test(x.n)) || x.n.length - y.n.length);
  if (!flash.length) throw new Error("Esta clave no tiene un modelo Flash de Gemini disponible");
  modeloElegido = flash[0].n;
  return modeloElegido;
}

const S = (extra: Record<string, unknown> = {}) => ({ type: "STRING", nullable: true, ...extra });
const ESQUEMA = {
  type: "OBJECT",
  properties: {
    documentos: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          tipo: { type: "STRING", enum: ["rif_empresa", "rif_personal", "cedula", "acta_constitutiva", "acta_asamblea", "otro"] },
          legible: { type: "BOOLEAN" },
          numero: S({ description: "Número del RIF o de la cédula tal como aparece, con su letra" }),
          razon_social: S(),
          nombre: S({ description: "Nombre de la persona (RIF personal o cédula)" }),
        },
        required: ["tipo", "legible"],
      },
    },
  },
  required: ["documentos"],
};
const INSTRUCCIONES = `Lees documentos de Venezuela. Solo extraes datos, no decides nada.
Di qué documento es: RIF de una empresa (persona jurídica, letra J o G), RIF de una persona (letra V o E), cédula, acta u otro.
Del RIF: el número completo con su letra (por ejemplo J-12345678-9) y la razón social o el nombre. No inventes: si no se lee bien, legible en false.`;

function base64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fallo("Método no permitido", 405);
  try {
    const sesion = req.headers.get("Authorization") || "";
    if (!/^Bearer\s+\S+/i.test(sesion)) return fallo("Tu sesión venció. Entra de nuevo", 401);
    let form: FormData;
    try { form = await req.formData(); } catch (_) { return fallo("No llegó el archivo. Intenta de nuevo", 400); }
    const sol = Number(form.get("solicitud"));
    const archivo = form.get("archivo");
    if (!Number.isInteger(sol) || sol < 1) return fallo("Falta la solicitud", 400);
    if (!(archivo instanceof File) || !archivo.size) return fallo("No llegó el archivo. Intenta de nuevo", 400);
    if (archivo.size > MAX) return fallo("El archivo pesa más de 15 MB", 413);
    const mime = TIPOS.includes(archivo.type) ? archivo.type : "";
    if (!mime) return fallo("Solo se aceptan fotos y PDF", 415);

    // Permiso con la sesión del aliado
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: sesion } },
    });
    const { data: p, error } = await db.rpc("solicitud_rif_permiso", { p_sol: sol });
    if (error) {
      const m = error.code === "P0001" ? error.message : "No tienes acceso a esta solicitud";
      return fallo(m, /venci/i.test(m) ? 401 : 403);
    }
    if (!CLAVE()) return fallo("Falta la clave de Gemini. Avísale al administrador", 500);
    const aj = (p && p.ajustes) || {};
    const modelo = await elegirModelo(aj.modelo_rapido);

    const cuerpo = JSON.stringify({
      systemInstruction: { parts: [{ text: INSTRUCCIONES }] },
      contents: [{ role: "user", parts: [{ inlineData: { mimeType: mime, data: base64(new Uint8Array(await archivo.arrayBuffer())) } }, { text: "Lee este documento y devuelve los datos según el esquema." }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: ESQUEMA, maxOutputTokens: 4096 },
    });
    let datos: { documentos?: unknown[] } | null = null; let u: Record<string, number> = {}; let ultimo = "";
    for (const espera of [0, 2500]) {
      if (espera) await new Promise((r) => setTimeout(r, espera));
      const r = await fetch(API + "models/" + encodeURIComponent(modelo) + ":generateContent", { method: "POST", headers: { "x-goog-api-key": CLAVE(), "Content-Type": "application/json" }, body: cuerpo });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        const texto = ((d.candidates?.[0]?.content?.parts || []) as { text?: string; thought?: boolean }[]).filter((x) => !x.thought).map((x) => x.text || "").join("");
        try { datos = JSON.parse(texto); } catch { datos = { documentos: [] }; }
        u = d.usageMetadata || {};
        break;
      }
      ultimo = d?.error?.message || String(r.status);
      if (![429, 500, 502, 503, 504].includes(r.status)) break;
    }
    if (!datos) { console.error("gemini", ultimo); return fallo("No se pudo leer el RIF ahora. Intenta de nuevo en un momento", 502); }

    const srv = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
    const entrada = Number(u.promptTokenCount) || 0; const salida = (Number(u.candidatesTokenCount) || 0) + (Number(u.thoughtsTokenCount) || 0);
    const costo = Math.round(((entrada * (Number(aj.precio_rapido_entrada) || 0) + salida * (Number(aj.precio_rapido_salida) || 0)) / 1e6) * 1e5) / 1e5;
    const { data: res, error: e2 } = await srv.rpc("solicitud_rif_leido", { p_sol: sol, p_datos: datos });
    await srv.rpc("ia_rif_costo", { p_sol: sol, p_datos: { modelo, tokens_entrada: entrada, tokens_salida: salida, costo_usd: costo, estado: res?.estado || "error" } });
    if (e2) { console.error("rif_leido", e2); return fallo("No se pudo revisar la cartera. Intenta de nuevo", 500); }
    return json(res);
  } catch (e) {
    console.error(e);
    return fallo(/clave de Gemini/.test((e as Error).message) ? "Google no aceptó la clave de Gemini. Avísale al administrador" : "Algo falló en el servidor. Intenta de nuevo", 500);
  }
});
