// Sube un documento nuevo al Drive de la cuenta de ventas, en la carpeta del cliente "RIF - NOMBRE" y su subcarpeta por tipo de servicio.
// La carpeta se crea sola con el primer documento. El permiso lo decide la base con la sesión del usuario (public.drive_destino).
// El archivo queda anotado en privado.drive_subidas y solo así lo acepta documentos_registrar.
// Copia del código publicado en Supabase. Sin claves: los secretos de Google viven en Supabase.
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

class ErrorDrive extends Error { constructor(public estado: number, m: string) { super(m); } }
const API = "https://www.googleapis.com/drive/v3/files";
const CARPETA = "application/vnd.google-apps.folder";
async function drive(url: string, init: RequestInit = {}) {
  const token = await tokenGoogle();
  if (!token) throw new ErrorDrive(503, "El permiso de Google venció. Avísale al administrador");
  const r = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: "Bearer " + token } });
  if (r.status === 401) permiso = { token: "", vence: 0 };
  return r;
}
const comillas = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
// "DEDICADO (ISP)" y "DEDICADO ISP" son la misma carpeta; "PYME" y "PYMES" también
const igual = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[()]/g, " ").replace(/\bPYMES\b/g, "PYME").replace(/\s+/g, " ").trim();

async function viva(id: string): Promise<boolean> {
  const r = await drive(API + "/" + encodeURIComponent(id) + "?fields=id,trashed,mimeType&supportsAllDrives=true");
  if (r.status === 404) return false;
  if (!r.ok) throw new ErrorDrive(502, "Drive no respondió. Intenta de nuevo");
  const d = await r.json();
  return !d.trashed && d.mimeType === CARPETA;
}
async function carpetasEn(padre: string, contiene: string) {
  const q = "'" + comillas(padre) + "' in parents and mimeType = '" + CARPETA + "' and trashed = false" + (contiene ? " and name contains '" + comillas(contiene) + "'" : "");
  const r = await drive(API + "?q=" + encodeURIComponent(q) + "&fields=files(id,name,createdTime)&orderBy=createdTime&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true");
  if (!r.ok) throw new ErrorDrive(502, "Drive no respondió. Intenta de nuevo");
  return ((await r.json()).files || []) as { id: string; name: string }[];
}
async function crearCarpeta(nombre: string, padre: string): Promise<string> {
  const r = await drive(API + "?fields=id&supportsAllDrives=true", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: nombre, mimeType: CARPETA, parents: [padre] }),
  });
  if (!r.ok) { console.error("crear carpeta", r.status, await r.text().catch(() => "")); throw new ErrorDrive(502, r.status === 403 ? "Google no dio permiso para guardar en Drive. Avísale al administrador" : "No se pudo crear la carpeta del cliente en Drive. Intenta de nuevo"); }
  return (await r.json()).id;
}

const TIPOS = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX = 15 * 1024 * 1024;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fallo("Método no permitido", 405);
  try {
    const sesion = req.headers.get("Authorization") || "";
    if (!/^Bearer\s+\S+/i.test(sesion)) return fallo("Tu sesión venció. Entra de nuevo", 401);
    let form: FormData;
    try { form = await req.formData(); } catch (_) { return fallo("No llegó el archivo. Intenta de nuevo", 400); }
    const cliente = Number(form.get("cliente"));
    const archivo = form.get("archivo");
    if (!Number.isInteger(cliente) || cliente < 1) return fallo("Falta el cliente", 400);
    if (!(archivo instanceof File) || !archivo.size) return fallo("No llegó el archivo. Intenta de nuevo", 400);
    if (archivo.size > MAX) return fallo("El archivo pesa más de 15 MB", 413);
    const mime = TIPOS.includes(archivo.type) ? archivo.type : "";
    if (!mime) return fallo("Solo se aceptan fotos y PDF", 415);
    const nombre = String(form.get("nombre") || archivo.name || "archivo").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 150) || "archivo";

    // Permiso y destino con la sesión del usuario
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: sesion } },
    });
    const { data: u } = await db.auth.getUser(sesion.replace(/^Bearer\s+/i, ""));
    if (!u?.user) return fallo("Tu sesión venció. Entra de nuevo", 401);
    const { data: d, error } = await db.rpc("drive_destino", { p_cliente: cliente });
    if (error) {
      const m = error.code === "P0001" ? error.message : "No tienes acceso a este cliente";
      return fallo(m, /venci/i.test(m) ? 401 : 403);
    }
    const srv = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });

    // Carpeta del cliente: la anotada si sigue viva; si no, la que ya tenga su RIF en Drive; si no, se crea
    let carpeta: string = d.carpeta || "";
    if (!carpeta || !(await viva(carpeta))) {
      const anterior = d.carpeta || null;
      const halladas = (await carpetasEn(d.raiz, d.rif)).filter((f) => f.name.trim() === d.rif || f.name.startsWith(d.rif + " - ") || f.name.startsWith(d.rif + "-"));
      let creada = false;
      let nueva = halladas.length ? halladas[0].id : "";
      if (!nueva) { nueva = await crearCarpeta(d.nombre_carpeta, d.raiz); creada = true; }
      const { data: fija, error: e2 } = await srv.rpc("drive_carpeta_fijar", { p_cliente: cliente, p_carpeta: nueva, p_anterior: anterior, p_creada: creada, p_usuario: u.user.id });
      if (e2 || !fija) { console.error("fijar", e2); return fallo("No se pudo anotar la carpeta del cliente. Intenta de nuevo", 500); }
      // Otra subida al mismo tiempo ganó: la carpeta vacía que se acaba de crear va a la papelera
      if (fija !== nueva && creada) await drive(API + "/" + encodeURIComponent(nueva) + "?supportsAllDrives=true", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trashed: true }) }).catch(() => null);
      carpeta = fija;
    }

    // Subcarpeta por tipo de servicio, como en las carpetas viejas
    const quiero = igual(d.subcarpeta);
    const sub = (await carpetasEn(carpeta, "")).find((f) => igual(f.name) === quiero);
    const destino = sub ? sub.id : await crearCarpeta(d.subcarpeta, carpeta);

    // Subida en una sola petición (los archivos pesan hasta 15 MB)
    const limite = "aev2" + crypto.randomUUID().replace(/-/g, "");
    const enc = new TextEncoder();
    const meta = JSON.stringify({ name: nombre, parents: [destino], mimeType: mime });
    const cuerpo = new Blob([
      enc.encode("--" + limite + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + meta + "\r\n--" + limite + "\r\nContent-Type: " + mime + "\r\n\r\n"),
      new Uint8Array(await archivo.arrayBuffer()),
      enc.encode("\r\n--" + limite + "--"),
    ]);
    const r = await drive("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,size", {
      method: "POST", headers: { "Content-Type": "multipart/related; boundary=" + limite }, body: cuerpo,
    });
    if (!r.ok) { console.error("subir", r.status, await r.text().catch(() => "")); return fallo(r.status === 403 ? "Google no dio permiso para guardar en Drive. Avísale al administrador" : "Drive no recibió el archivo. Intenta de nuevo", 502); }
    const f = await r.json();
    const { error: e3 } = await srv.rpc("drive_subida_anotar", { p_cliente: cliente, p_usuario: u.user.id, p_drive_id: f.id, p_nombre: nombre, p_mime: mime, p_tamano: archivo.size });
    if (e3) { console.error("anotar", e3); return fallo("El archivo quedó en Drive pero no se pudo anotar. Intenta de nuevo", 500); }
    return json({ drive_id: f.id, nombre, mime, tamano: archivo.size });
  } catch (e) {
    if (e instanceof ErrorDrive) return fallo(e.message, e.estado);
    console.error(e);
    return fallo("Algo falló en el servidor. Intenta de nuevo", 500);
  }
});
