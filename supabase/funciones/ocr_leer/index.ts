// OCR con Google Drive: copia el archivo convirtiéndolo a documento de Google (Drive hace el OCR), saca el texto y borra la copia.
// Guarda el texto y lo que sacan los lectores con reglas fijas (lectores.mjs) en public.ocr_lecturas: un archivo se lee una sola vez.
// Si algo falla (permiso, tamaño, archivo ilegible) queda "sin_lectura" y la app sigue por el camino de siempre (la IA).
// Dos entradas: la app (sesión del usuario, un archivo, responde enseguida) y la base (token interno x-tarea, varios en segundo plano).
// Copia del código publicado en Supabase. Sin claves: los secretos de Google viven en Supabase.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { leer, VERSION } from "./lectores.mjs";

const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const db = createClient(URL_BASE, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const respuesta = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });
const TIPOS = /^(application\/pdf|image\/(jpeg|png))$/i;
const MAX_BYTES = 20 * 1024 * 1024;

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

// Drive: copia convertida (OCR en español), texto plano y la copia se borra siempre
async function ocrDrive(driveId: string): Promise<string> {
  const tk = await tokenGoogle();
  if (!tk) throw new Error("El permiso de Google venció");
  const H = { Authorization: "Bearer " + tk };
  const c = await fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(driveId) + "/copy?supportsAllDrives=true&ocrLanguage=es&fields=id", {
    method: "POST", headers: { ...H, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "ocr-temporal", mimeType: "application/vnd.google-apps.document" }),
  });
  const cj = await c.json().catch(() => ({}));
  if (!c.ok || !cj.id) {
    if (c.status === 401) permiso = { token: "", vence: 0 };
    const m = String(cj?.error?.message || "");
    throw new Error(c.status === 403 ? "Sin permiso de Drive para convertir este archivo" : c.status === 404 ? "El archivo ya no está en Drive" : "Drive no lo pudo convertir (" + c.status + (m ? ": " + m.slice(0, 120) : "") + ")");
  }
  try {
    const e = await fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(cj.id) + "/export?mimeType=text/plain", { headers: H });
    if (!e.ok) throw new Error("Drive no entregó el texto (" + e.status + ")");
    return (await e.text()).replace(/^\uFEFF/, "");
  } finally {
    await fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(cj.id) + "?supportsAllDrives=true", { method: "DELETE", headers: H })
      .catch((x) => console.error("borrar copia", x));
  }
}

type Archivo = { id: number; drive_id: string; mime: string; tamano: number; casilla?: string | null };
// Lee un archivo (o devuelve lo ya leído) y guarda el resultado
async function procesar(a: Archivo): Promise<Record<string, unknown>> {
  const { data: ya } = await db.from("ocr_lecturas").select("estado, tipo, datos, dudosa, error, lector, texto").eq("archivo_id", a.id).maybeSingle();
  if (ya && (ya.estado === "sin_lectura" || ya.lector === VERSION)) return ya;
  let fila: Record<string, unknown>;
  if (ya && ya.estado === "ok" && ya.texto) {
    // Ya se leyó con Google: solo se vuelven a correr los lectores nuevos (gratis)
    const l = leer(String(ya.texto));
    fila = { archivo_id: a.id, estado: "ok", texto: ya.texto, lector: VERSION, tipo: l.tipo, datos: l.datos, dudosa: l.dudosa };
  } else if (!TIPOS.test(String(a.mime || ""))) {
    fila = { archivo_id: a.id, estado: "sin_lectura", error: "Tipo de archivo que el OCR no lee: " + (a.mime || "desconocido"), lector: VERSION };
  } else if (Number(a.tamano) > MAX_BYTES) {
    fila = { archivo_id: a.id, estado: "sin_lectura", error: "Archivo muy grande para el OCR", lector: VERSION };
  } else {
    const t0 = Date.now();
    try {
      const texto = await ocrDrive(a.drive_id);
      const ms = Date.now() - t0;
      if (texto.replace(/\s/g, "").length < 15) fila = { archivo_id: a.id, estado: "sin_lectura", error: "Google no encontró texto legible", texto, ms, lector: VERSION };
      else { const l = leer(texto); fila = { archivo_id: a.id, estado: "ok", texto, ms, lector: VERSION, tipo: l.tipo, datos: l.datos, dudosa: l.dudosa }; }
    } catch (e) {
      const m = (e as Error).message;
      // El permiso vencido no se guarda: se puede volver a intentar cuando se arregle
      if (/permiso de Google venció/.test(m)) return { estado: "sin_lectura", error: m };
      fila = { archivo_id: a.id, estado: "sin_lectura", error: m, ms: Date.now() - t0, lector: VERSION };
    }
  }
  fila.leido_en = new Date().toISOString();
  const { error } = await db.from("ocr_lecturas").upsert(fila);
  if (error) console.error("guardar ocr", a.id, error.message);
  return fila;
}
// Lo que ve la app: nunca el texto completo
const publico = (f: Record<string, unknown>) => ({ estado: f.estado, tipo: f.tipo || null, datos: f.datos || null, dudosa: !!f.dudosa, error: f.error || null });

async function lote(ids: number[]) {
  const { data, error } = await db.from("archivos").select("id, drive_id, mime, tamano").in("id", ids);
  if (error) { console.error("lote", error.message); return; }
  const cola = (data || []).filter((a) => a.drive_id) as Archivo[];
  // De 3 en 3 para no pasar los límites de Google
  for (let i = 0; i < cola.length; i += 3) await Promise.all(cola.slice(i, i + 3).map((a) => procesar(a).catch((e) => console.error("ocr", a.id, e))));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respuesta({ error: "Método no permitido" }, 405);
  try {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const tarea = req.headers.get("x-tarea") || "";
    if (tarea) {
      // La base: varios archivos en segundo plano
      const { data: valido } = await db.rpc("ia_tarea_ok", { p_token: tarea });
      if (valido !== true) return respuesta({ error: "No autorizado" }, 401);
      const ids = (Array.isArray(b.archivos) ? b.archivos : []).map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 60);
      if (!ids.length) return respuesta({ error: "Faltan los archivos" }, 400);
      EdgeRuntime.waitUntil(lote(ids));
      return respuesta({ ok: true, archivos: ids.length }, 202);
    }
    // La app: un archivo que el usuario puede ver (lo decide la base con su sesión)
    const sesion = req.headers.get("Authorization") || "";
    if (!/^Bearer\s+\S+/i.test(sesion)) return respuesta({ error: "Tu sesión venció. Entra de nuevo" }, 401);
    const archivo = Number(b.archivo);
    if (!Number.isInteger(archivo) || archivo < 1) return respuesta({ error: "Falta el archivo" }, 400);
    const yo = createClient(URL_BASE, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: sesion } } });
    const { data: a, error } = await yo.rpc("archivo_drive", { p_archivo: archivo });
    if (error || !a) return respuesta({ error: error && error.code === "P0001" ? error.message : "No tienes acceso a este archivo" }, 403);
    const { data: x } = await db.from("archivos").select("id, drive_id, mime, tamano").eq("id", archivo).maybeSingle();
    if (!x || !x.drive_id) return respuesta({ estado: "sin_lectura", error: "Ese archivo no está en Drive" });
    const f = await procesar(x as Archivo);
    return respuesta(publico(f));
  } catch (e) {
    console.error(e);
    return respuesta({ estado: "sin_lectura", error: "Algo falló en el servidor" }, 200);
  }
});
