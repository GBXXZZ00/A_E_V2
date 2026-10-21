// Conecta un buzón de Gmail (solo lectura) a la app. verify_jwt apagado a propósito: Google redirige sin sesión.
// Solo funciona con un enlace de un solo uso (privado.correo_estados, 20 minutos) que genera el administrador.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const URL_FN = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "") + "/functions/v1/correo_conectar";
const pagina = (titulo: string, texto: string, status = 200) => new Response(
  `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title>` +
  `<style>body{font-family:Inter,system-ui,sans-serif;background:#fff;color:#14171f;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}main{max-width:420px}h1{font-size:20px;color:#1B3A9E}p{color:#4a5160;line-height:1.5}</style></head>` +
  `<body><main><h1>${titulo}</h1><p>${texto}</p></main></body></html>`,
  { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });

Deno.serve(async (req: Request) => {
  try {
    const u = new URL(req.url);
    const srv = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
    const inicio = u.searchParams.get("inicio");
    if (inicio) {
      const { data: ok } = await srv.rpc("correo_estado_valido", { p_estado: inicio });
      if (!ok) return pagina("Enlace vencido", "Este enlace ya se usó o pasaron más de 20 minutos. Pide uno nuevo.", 400);
      const g = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      g.searchParams.set("client_id", (Deno.env.get("GOOGLE_CLIENT_ID") || "").trim());
      g.searchParams.set("redirect_uri", URL_FN);
      g.searchParams.set("response_type", "code");
      g.searchParams.set("scope", "https://www.googleapis.com/auth/gmail.readonly");
      g.searchParams.set("access_type", "offline");
      g.searchParams.set("prompt", "consent select_account");
      g.searchParams.set("state", inicio);
      return Response.redirect(g.toString(), 302);
    }
    const err = u.searchParams.get("error");
    if (err) return pagina("No se conectó", "Google no dio el permiso (" + err.replace(/[^a-z_]/gi, "") + "). Si dice acceso bloqueado, avísale al administrador.", 400);
    const code = u.searchParams.get("code");
    const estado = u.searchParams.get("state");
    if (!code || !estado) return pagina("Enlace incompleto", "Pide un enlace nuevo para conectar el correo.", 400);
    const { data: usado } = await srv.rpc("correo_estado_usar", { p_estado: estado });
    if (!usado) return pagina("Enlace vencido", "Este enlace ya se usó o pasaron más de 20 minutos. Pide uno nuevo.", 400);
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, redirect_uri: URL_FN, grant_type: "authorization_code",
        client_id: (Deno.env.get("GOOGLE_CLIENT_ID") || "").trim(),
        client_secret: (Deno.env.get("GOOGLE_CLIENT_SECRET") || "").trim(),
      }),
    });
    const t = await r.json().catch(() => ({}));
    if (!r.ok || !t.access_token) { console.error("token", r.status, t?.error); return pagina("No se conectó", "Google no entregó el permiso. Intenta de nuevo con un enlace nuevo.", 502); }
    if (!String(t.scope || "").includes("gmail.readonly")) return pagina("Falta el permiso", "Al aceptar, marca la casilla para leer el correo. Pide un enlace nuevo.", 400);
    const p = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: { Authorization: "Bearer " + t.access_token } });
    const perfil = await p.json().catch(() => ({}));
    if (!p.ok || !perfil.emailAddress) { console.error("perfil", p.status); return pagina("No se conectó", "No se pudo leer el buzón. Revisa que la API de Gmail esté habilitada.", 502); }
    const { error } = await srv.rpc("correo_buzon_guardar", { p_email: perfil.emailAddress, p_token: t.refresh_token || null });
    if (error) { console.error("guardar", error); return pagina("No se guardó", "El permiso llegó pero no se pudo guardar. Intenta de nuevo.", 500); }
    return pagina("Correo conectado", "Listo: " + String(perfil.emailAddress).replace(/[<>&"]/g, "") + " quedó conectado a Airtek Empresas en modo solo lectura. Ya puedes cerrar esta pestaña.");
  } catch (e) {
    console.error(e);
    return pagina("Algo falló", "Intenta de nuevo en un momento.", 500);
  }
});
