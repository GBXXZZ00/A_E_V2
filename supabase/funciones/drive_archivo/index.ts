// Entrega un archivo de Drive (cuenta de ventas) a quien tiene permiso de ver ese cliente en la app.
// El permiso lo decide la base con la sesión del usuario (public.archivo_drive, mismas reglas de cliente_ficha).
// Copia del código publicado en Supabase. Sin claves: los secretos de Google viven en Supabase.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const fallo = (mensaje: string, status: number) =>
  new Response(JSON.stringify({ error: mensaje }), { status, headers: { ...cors, "Content-Type": "application/json" } });

// El permiso de Google dura una hora: se guarda mientras la función siga viva.
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

const MIME = /^[a-z]+\/[a-z0-9.+-]{1,100}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fallo("Método no permitido", 405);
  try {
    const sesion = req.headers.get("Authorization") || "";
    if (!/^Bearer\s+\S+/i.test(sesion)) return fallo("Tu sesión venció. Entra de nuevo", 401);
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const archivo = Number(b.archivo);
    if (!Number.isInteger(archivo) || archivo < 1) return fallo("Falta el archivo", 400);

    // La base revisa con la sesión del usuario si puede ver a ese cliente
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: sesion } },
    });
    const { data: a, error } = await db.rpc("archivo_drive", { p_archivo: archivo });
    if (error) {
      const m = error.code === "P0001" ? error.message : "No tienes acceso a este archivo";
      return fallo(m, /venci/i.test(m) ? 401 : /no existe|no está/i.test(m) ? 404 : 403);
    }

    const token = await tokenGoogle();
    if (!token) return fallo("El permiso de Google venció. Avísale al administrador", 503);
    const r = await fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(a.drive_id) + "?alt=media&supportsAllDrives=true", {
      headers: { Authorization: "Bearer " + token },
    });
    if (!r.ok || !r.body) {
      if (r.status === 401) permiso = { token: "", vence: 0 };
      console.error("drive", r.status, archivo);
      return fallo(r.status === 404 ? "Ese archivo ya no está en Drive" : "Drive no respondió. Intenta de nuevo", r.status === 404 ? 404 : 502);
    }
    const tipo = MIME.test(String(a.mime || "")) ? String(a.mime) : (r.headers.get("Content-Type") || "application/octet-stream");
    const nombre = encodeURIComponent(String(a.nombre || "archivo").slice(0, 150));
    const cab: Record<string, string> = {
      ...cors,
      "Content-Type": tipo,
      "Content-Disposition": "inline; filename*=UTF-8''" + nombre,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    };
    const largo = r.headers.get("Content-Length");
    if (largo) cab["Content-Length"] = largo;
    return new Response(r.body, { status: 200, headers: cab });
  } catch (e) {
    console.error(e);
    return fallo("Algo falló en el servidor. Intenta de nuevo", 500);
  }
});
