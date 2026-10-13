// Gestión de usuarios: solo el administrador. Crea cuentas, edita, restablece PIN y activa o desactiva.
// Desde el lote 2 (13/10) la clave de la cuenta es la huella del PIN (igual que en la función "entrar"),
// el PIN temporal puede ser cualquiera de 6 números (se obliga a cambiarlo al entrar) y restablecer desbloquea.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const DOMINIO = "@aev2.app";
const ROLES = ["admin", "abogado", "lider", "analista", "aliado"];
const EQUIPOS = ["ventas", "aliados", "ambos"];
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, "Content-Type": "application/json" } });
const fallo = (mensaje: string, status = 400) => resp({ error: mensaje }, status);

// PIN temporal: 6 números. Quien entra con él está obligado a cambiarlo por uno que no sea fácil.
const pinTemporal = (p: unknown) => typeof p === "string" && /^\d{6}$/.test(p);
const txt = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// deno-lint-ignore no-explicit-any
async function clave(admin: any, usuario: string, pin: string): Promise<string> {
  const { data, error } = await admin.rpc("acceso_pimienta");
  if (error || typeof data !== "string" || data.length < 32) throw new Error("Falta el secreto de la entrada");
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(data), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const f = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(usuario + ":" + pin));
  return "k1-" + Array.from(new Uint8Array(f)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function datosPerfil(b: Record<string, unknown>) {
  const nombre = txt(b.nombre, 80);
  const rol = txt(b.rol, 20);
  const equipo = txt(b.equipo, 20) || "ventas";
  if (!nombre) return { error: "Escribe el nombre" };
  if (!ROLES.includes(rol)) return { error: "Elige un rol válido" };
  if (!EQUIPOS.includes(equipo)) return { error: "Elige un equipo válido" };
  let codigo: number | null = null;
  if (b.codigo_vendedor !== null && b.codigo_vendedor !== undefined && b.codigo_vendedor !== "") {
    codigo = Number(b.codigo_vendedor);
    if (!Number.isInteger(codigo) || codigo < 1 || codigo > 99) return { error: "El número de vendedor va de 1 a 99" };
  }
  // WhatsApp: solo dígitos. Correo: en minúsculas. Los dos salen en la carta de bienvenida del líder.
  const whatsapp = txt(b.whatsapp, 25).replace(/\D/g, "");
  if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 15)) return { error: "Ese WhatsApp no parece válido" };
  const correo = txt(b.correo, 120).toLowerCase();
  if (correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return { error: "Ese correo no parece válido" };
  return {
    datos: {
      nombre, rol, equipo, cargo: txt(b.cargo, 80) || null, nombre_odoo: txt(b.nombre_odoo, 120) || null, codigo_vendedor: codigo,
      senior: rol === "analista" && b.senior === true, whatsapp: whatsapp || null, correo: correo || null,
      dedicados: rol === "lider" && b.dedicados === true,
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fallo("Método no permitido", 405);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: quien, error: eQuien } = await admin.auth.getUser(token);
    if (eQuien || !quien?.user) return fallo("Sesión vencida. Vuelve a entrar", 401);
    const yo = quien.user.id;
    const { data: miPerfil } = await admin.from("perfiles").select("rol, activo").eq("id", yo).maybeSingle();
    if (!miPerfil || !miPerfil.activo || miPerfil.rol !== "admin") return fallo("Solo el administrador puede hacer esto", 403);

    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const accion = txt(b.accion, 20);
    const anotar = (a: string, id: string, despues: unknown) =>
      admin.from("bitacora").insert({ usuario_id: yo, accion: a, tabla: "perfiles", registro_id: id, despues });

    if (accion === "listar") {
      const { data, error } = await admin.from("perfiles")
        .select("id, usuario, nombre, rol, senior, dedicados, cargo, equipo, codigo_vendedor, nombre_odoo, whatsapp, correo, activo, debe_cambiar_pin, creado_en")
        .order("activo", { ascending: false }).order("nombre");
      if (error) throw error;
      return resp({ usuarios: data });
    }

    if (accion === "crear") {
      const usuario = txt(b.usuario, 30).toLowerCase();
      if (!/^[a-z0-9]{3,30}$/.test(usuario)) return fallo("El usuario va en minúsculas, sin espacios ni acentos (3 a 30 letras o números)");
      if (!pinTemporal(b.pin)) return fallo("El PIN temporal debe tener 6 números");
      const p = datosPerfil(b);
      if (p.error) return fallo(p.error);
      const { data: ya } = await admin.from("perfiles").select("id").eq("usuario", usuario).maybeSingle();
      if (ya) return fallo("Ese usuario ya existe");
      const { data: creado, error: eCrear } = await admin.auth.admin.createUser({
        email: usuario + DOMINIO, password: await clave(admin, usuario, b.pin as string), email_confirm: true,
      });
      if (eCrear || !creado?.user) return fallo("No se pudo crear la cuenta. Intenta de nuevo", 500);
      const fila = { id: creado.user.id, usuario, ...p.datos, debe_cambiar_pin: true };
      const { error: ePerfil } = await admin.from("perfiles").insert(fila);
      if (ePerfil) {
        await admin.auth.admin.deleteUser(creado.user.id);
        return fallo(ePerfil.code === "23505" ? "Ese número de vendedor ya lo tiene otra persona" : "No se pudo guardar el usuario", 400);
      }
      await anotar("usuario_creado", creado.user.id, { usuario, ...p.datos });
      return resp({ ok: true, id: creado.user.id });
    }

    const id = txt(b.id, 40);
    if (!/^[0-9a-f-]{36}$/.test(id)) return fallo("Falta el usuario");

    if (accion === "editar") {
      const p = datosPerfil(b);
      if (p.error) return fallo(p.error);
      if (id === yo && p.datos!.rol !== "admin") return fallo("No puedes quitarte el rol de administrador");
      const { error } = await admin.from("perfiles").update(p.datos).eq("id", id);
      if (error) return fallo(error.code === "23505" ? "Ese número de vendedor ya lo tiene otra persona" : "No se pudo guardar", 400);
      await anotar("usuario_editado", id, p.datos);
      return resp({ ok: true });
    }

    if (accion === "pin") {
      if (!pinTemporal(b.pin)) return fallo("El PIN temporal debe tener 6 números");
      const { data: per } = await admin.from("perfiles").select("usuario").eq("id", id).maybeSingle();
      if (!per) return fallo("No existe ese usuario", 404);
      const { error } = await admin.auth.admin.updateUserById(id, { password: await clave(admin, per.usuario, b.pin as string) });
      if (error) return fallo("No se pudo cambiar el PIN", 500);
      await admin.from("perfiles").update({ debe_cambiar_pin: true }).eq("id", id);
      await admin.rpc("acceso_desbloquear", { p_usuario: per.usuario });
      await anotar("pin_restablecido", id, null);
      return resp({ ok: true });
    }

    if (accion === "activo") {
      const activo = b.activo === true;
      if (id === yo && !activo) return fallo("No puedes desactivar tu propia cuenta");
      const { error: eBan } = await admin.auth.admin.updateUserById(id, { ban_duration: activo ? "none" : "876000h" });
      if (eBan) return fallo("No se pudo cambiar el acceso", 500);
      const { error } = await admin.from("perfiles").update({ activo }).eq("id", id);
      if (error) return fallo("No se pudo guardar", 500);
      await anotar(activo ? "usuario_activado" : "usuario_desactivado", id, { activo });
      return resp({ ok: true });
    }

    return fallo("Acción no reconocida");
  } catch (e) {
    console.error(e);
    return fallo("Algo falló en el servidor. Intenta de nuevo", 500);
  }
});
