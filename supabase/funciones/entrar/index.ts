// Entrada con usuario y PIN, con bloqueo por intentos. La clave real de la cuenta NO es el PIN:
// es una huella HMAC del usuario y el PIN con un secreto que solo lee esta función (public.acceso_pimienta, con la llave de servicio).
// Así nadie puede probar PIN directo contra Supabase: solo por aquí, y aquí se cuentan los fallos.
// Las cuentas con la clave vieja (el PIN tal cual) se pasan solas a la nueva la primera vez que entran.
// Acciones: entrar {usuario, pin}; verificar {usuario, pin} (con sesión); cambiar {pin_nuevo} (con sesión).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const DOMINIO = "@aev2.app";
// Lote S: solo la app publicada (y localhost para pruebas) puede llamar esta función
const ORIGENES = /^(https:\/\/gbxxzz00\.github\.io|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;
// Toda respuesta (también OPTIONS y errores) sale con el origen permitido de esa petición
const conOrigen = (req: Request, r: Response) => {
  const o = req.headers.get("Origin") || "";
  const h = new Headers(r.headers);
  h.set("Access-Control-Allow-Origin", ORIGENES.test(o) ? o : "https://gbxxzz00.github.io");
  h.set("Vary", "Origin");
  return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
};
const cors = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, "Content-Type": "application/json" } });
const fallo = (mensaje: string, status = 400, extra: Record<string, unknown> = {}) => resp({ error: mensaje, ...extra }, status);
const pinFacil = (p: string) => /^(\d)\1{5}$/.test(p) || p === "123456" || p === "654321";

let pimientaCache = "";
// deno-lint-ignore no-explicit-any
async function leerPimienta(admin: any): Promise<string> {
  if (pimientaCache) return pimientaCache;
  const { data, error } = await admin.rpc("acceso_pimienta");
  if (error || typeof data !== "string" || data.length < 32) throw new Error("Falta el secreto de la entrada");
  pimientaCache = data; return data;
}
async function clave(pimienta: string, usuario: string, pin: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(pimienta), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const f = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(usuario + ":" + pin));
  return "k1-" + Array.from(new Uint8Array(f)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const espera = (hasta: string | null) => {
  if (!hasta) return 0;
  return Math.max(1, Math.ceil((new Date(hasta).getTime() - Date.now()) / 60000));
};

async function atender(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fallo("Método no permitido", 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
    // Llave pública: la del entorno o la que manda la app en "apikey"
    const llavePublica = Deno.env.get("SUPABASE_ANON_KEY") || req.headers.get("apikey") || "";
    const publico = () => createClient(url, llavePublica, { auth: { persistSession: false, autoRefreshToken: false } });
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const accion = typeof b.accion === "string" ? b.accion : "entrar";

    // Cambiar el PIN: con la sesión abierta de quien cambia (el primer ingreso o el cambio voluntario ya verificado)
    if (accion === "cambiar") {
      const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      const { data: q, error: eq } = await admin.auth.getUser(token);
      if (eq || !q?.user?.email?.endsWith(DOMINIO)) return fallo("Tu sesión venció. Entra de nuevo", 401);
      // Lote S: una sesión cerrada por el administrador (PIN restablecido o cuenta desactivada) ya no vale
      const u = createClient(url, llavePublica, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: "Bearer " + token } } });
      const { data: sv, error: esv } = await u.rpc("sesion_viva");
      if (esv || !sv || sv.viva !== true) return fallo("Tu sesión se cerró. Entra de nuevo", 401);
      const pin = typeof b.pin_nuevo === "string" ? b.pin_nuevo : "";
      if (!/^\d{6}$/.test(pin) || pinFacil(pin)) return fallo("El PIN debe tener 6 números y no ser uno fácil de adivinar");
      const usuario = q.user.email.slice(0, -DOMINIO.length);
      const { error } = await admin.auth.admin.updateUserById(q.user.id, { password: await clave(await leerPimienta(admin), usuario, pin) });
      if (error) return fallo("No se pudo cambiar el PIN. Intenta de nuevo", 500);
      return resp({ ok: true });
    }

    const usuario = typeof b.usuario === "string" ? b.usuario.trim().toLowerCase() : "";
    const pin = typeof b.pin === "string" ? b.pin : "";
    if (!/^[a-z0-9]{3,30}$/.test(usuario) || !/^\d{6}$/.test(pin)) return fallo("Usuario o PIN incorrecto", 401);

    // ¿Está bloqueado?
    const { data: est, error: eEst } = await admin.rpc("acceso_estado", { p_usuario: usuario });
    if (eEst) throw eEst;
    if (est?.bloqueado_hasta && new Date(est.bloqueado_hasta).getTime() > Date.now()) {
      const m = espera(est.bloqueado_hasta);
      return fallo("Demasiados intentos. Espera " + m + (m === 1 ? " minuto" : " minutos") + " o pide al administrador que te restablezca el PIN", 429, { espera_min: m });
    }

    const email = usuario + DOMINIO;
    const nueva = await clave(await leerPimienta(admin), usuario, pin);
    let sesion = null;
    const c1 = await publico().auth.signInWithPassword({ email, password: nueva });
    if (!c1.error && c1.data.session) sesion = c1.data.session;
    else if (c1.error && /banned|disabled/i.test(c1.error.message || "")) return fallo("Esta cuenta está desactivada. Habla con el administrador", 403);
    else {
      // Cuenta con la clave vieja: entra con el PIN tal cual y se pasa a la nueva
      const c2 = await publico().auth.signInWithPassword({ email, password: pin });
      if (!c2.error && c2.data.session && c2.data.user) {
        sesion = c2.data.session;
        await admin.auth.admin.updateUserById(c2.data.user.id, { password: nueva });
      } else if (c2.error && /banned|disabled/i.test(c2.error.message || "")) {
        return fallo("Esta cuenta está desactivada. Habla con el administrador", 403);
      }
    }
    if (!sesion) {
      const { data: r } = await admin.rpc("acceso_registrar", { p_usuario: usuario, p_ok: false });
      if (r?.bloqueado_hasta) {
        const m = espera(r.bloqueado_hasta);
        return fallo("Demasiados intentos. Espera " + m + (m === 1 ? " minuto" : " minutos") + " o pide al administrador que te restablezca el PIN", 429, { espera_min: m });
      }
      return fallo("Usuario o PIN incorrecto", 401, { quedan: r?.quedan ?? null });
    }
    await admin.rpc("acceso_registrar", { p_usuario: usuario, p_ok: true });
    if (accion === "verificar") return resp({ ok: true });
    return resp({ session: { access_token: sesion.access_token, refresh_token: sesion.refresh_token } });
  } catch (e) {
    console.error(e);
    return fallo("No se pudo entrar. Intenta de nuevo", 500);
  }
}

Deno.serve(async (req: Request) => conOrigen(req, await atender(req)));
