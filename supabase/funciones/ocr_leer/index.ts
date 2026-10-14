// OCR con Google Drive: copia el archivo convirtiéndolo a documento de Google (Drive hace el OCR), saca el texto y borra la copia.
// Guarda el texto y lo que sacan los lectores con reglas fijas (lectores.mjs) en public.ocr_lecturas: un archivo se lee una sola vez.
// Si algo falla (permiso, tamaño, archivo ilegible) queda "sin_lectura" y la app sigue por el camino de siempre (la IA).
// Tres entradas: la app con un archivo ya guardado (sesión del usuario, responde enseguida), la app con un archivo recién elegido
// (formulario de titular y aliados: se sube convertido, se lee y se borra; no se guarda) y la base (token interno x-tarea, varios en segundo plano).
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
const META = JSON.stringify({ name: "ocr-temporal", mimeType: "application/vnd.google-apps.document" });
async function ocrDrive(driveId: string): Promise<string> {
  return convertir((H) => fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(driveId) + "/copy?supportsAllDrives=true&ocrLanguage=es&fields=id", {
    method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: META,
  }));
}
// Un archivo que todavía no está en Drive (formulario de titular, aliados): se sube ya convertido y se borra
async function ocrSuelto(bytes: Uint8Array, mime: string): Promise<string> {
  return convertir((H) => {
    const limite = "ocr" + crypto.randomUUID().replace(/-/g, "");
    const enc = new TextEncoder();
    const cuerpo = new Blob([enc.encode("--" + limite + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + META + "\r\n--" + limite + "\r\nContent-Type: " + mime + "\r\n\r\n"), bytes, enc.encode("\r\n--" + limite + "--")]);
    return fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&ocrLanguage=es&fields=id", { method: "POST", headers: { ...H, "Content-Type": "multipart/related; boundary=" + limite }, body: cuerpo });
  });
}
// La copia convertida tiene datos del cliente: se borra siempre y, si Google no deja, se reintenta y queda en el registro
async function borrarCopia(id: string, H: Record<string, string>) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(id) + "?supportsAllDrives=true", { method: "DELETE", headers: H }).catch(() => null);
    if (r && (r.ok || r.status === 404)) return;
    await new Promise((x) => setTimeout(x, 800 * (i + 1)));
  }
  console.error("ocr: no se pudo borrar la copia temporal", id);
}
// Copias que quedaron de intentos fallidos (nombre "ocr-temporal", más de 1 hora): se borran de a poco
async function limpiarHuerfanas() {
  try {
    const tk = await tokenGoogle(); if (!tk) return;
    const H = { Authorization: "Bearer " + tk };
    const q = encodeURIComponent("name contains 'ocr-temporal' and modifiedTime < '" + new Date(Date.now() - 3600_000).toISOString() + "' and trashed = false");
    const r = await fetch("https://www.googleapis.com/drive/v3/files?pageSize=20&fields=files(id)&q=" + q, { headers: H });
    if (!r.ok) return;
    for (const f of ((await r.json()).files || []) as { id: string }[]) await borrarCopia(f.id, H);
  } catch (_) { /* es limpieza: si falla, la próxima */ }
}
async function convertir(crear: (H: Record<string, string>) => Promise<Response>): Promise<string> {
  const tk = await tokenGoogle();
  if (!tk) throw new Error("El permiso de Google venció");
  const H = { Authorization: "Bearer " + tk };
  const copiar = () => crear(H);
  let c = await copiar();
  // Google a veces falla por su lado (500): un segundo intento. Si el primero dejó una copia, la limpieza de "ocr-temporal" la borra
  if (c.status >= 500) { await new Promise((r) => setTimeout(r, 1500)); c = await copiar(); }
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
    await borrarCopia(cj.id, H);
  }
}

type Archivo = { id: number; drive_id: string; mime: string; tamano: number; casilla?: string | null };
// Lee un archivo (o devuelve lo ya leído) y guarda el resultado
async function procesar(a: Archivo): Promise<Record<string, unknown>> {
  const { data: ya } = await db.from("ocr_lecturas").select("estado, tipo, datos, dudosa, error, lector, texto").eq("archivo_id", a.id).maybeSingle();
  if (ya && ya.lector === VERSION) return ya;   // ya leído con esta versión (también lo que quedó sin lectura)
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

// Archivo suelto: cualquiera con sesión (también un aliado). No se guarda nada: solo devuelve lo leído
async function suelto(req: Request): Promise<Response> {
  const sesion = req.headers.get("Authorization") || "";
  if (!/^Bearer\s+\S+/i.test(sesion)) return respuesta({ error: "Tu sesión venció. Entra de nuevo" }, 401);
  const { data: u } = await db.auth.getUser(sesion.replace(/^Bearer\s+/i, ""));
  if (!u?.user) return respuesta({ error: "Tu sesión venció. Entra de nuevo" }, 401);
  // Solo cuentas activas y con tope por hora (cada lectura sube una copia al Drive de la empresa)
  const { data: uso, error: eu } = await db.rpc("ocr_uso_registrar", { p_usuario: u.user.id });
  if (eu) return respuesta({ estado: "sin_lectura", error: "No se pudo comprobar tu cuenta" });
  if (uso === "inactivo") return respuesta({ error: "Tu cuenta no está activa" }, 403);
  if (uso === "limite") return respuesta({ estado: "sin_lectura", error: "Llegaste al tope de lecturas de esta hora. Escribe los datos a mano" });
  const form = await req.formData().catch(() => null);
  const archivo = form ? form.get("archivo") : null;
  if (!(archivo instanceof File) || !archivo.size) return respuesta({ estado: "sin_lectura", error: "No llegó el archivo" });
  if (!TIPOS.test(archivo.type)) return respuesta({ estado: "sin_lectura", error: "El OCR solo lee PDF, JPG y PNG" });
  if (archivo.size > 10 * 1024 * 1024) return respuesta({ estado: "sin_lectura", error: "Archivo muy grande para el OCR" });
  const t0 = Date.now();
  try {
    const texto = await ocrSuelto(new Uint8Array(await archivo.arrayBuffer()), archivo.type);
    if (texto.replace(/\s/g, "").length < 15) return respuesta({ estado: "sin_lectura", error: "Google no encontró texto legible", ms: Date.now() - t0 });
    const l = leer(texto);
    return respuesta({ estado: "ok", tipo: l.tipo, datos: l.datos, dudosa: l.dudosa, error: null, ms: Date.now() - t0 });
  } catch (e) {
    return respuesta({ estado: "sin_lectura", error: (e as Error).message, ms: Date.now() - t0 });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respuesta({ error: "Método no permitido" }, 405);
  try {
    if (/multipart\/form-data/i.test(req.headers.get("Content-Type") || "")) return await suelto(req);
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const tarea = req.headers.get("x-tarea") || "";
    if (tarea) {
      // La base: varios archivos en segundo plano
      const { data: valido } = await db.rpc("ia_tarea_ok", { p_token: tarea });
      if (valido !== true) return respuesta({ error: "No autorizado" }, 401);
      const ids = (Array.isArray(b.archivos) ? b.archivos : []).map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 60);
      if (!ids.length) return respuesta({ error: "Faltan los archivos" }, 400);
      // La revisión con IA espera la lectura de un archivo suelto antes de decidir si gasta Gemini
      if (b.esperar === true && ids.length <= 4) { await lote(ids); return respuesta({ ok: true, archivos: ids.length }); }
      EdgeRuntime.waitUntil(lote(ids).then(limpiarHuerfanas));
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
