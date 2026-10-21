// Lote 22/10: envía los avisos nuevos como notificaciones push (Web Push con VAPID, cifrado aes128gcm, sin librerías).
// La llama la tarea programada de la base cada 5 minutos (privado.avisos_tarea) con su clave en la cabecera x-tarea.
// Entre 10 p.m. y 8 a.m. (hora de Caracas) no suena: lo de la noche sale a las 8 a.m.
// Lote A: los avisos se agrupan por tipo (más de 3 del mismo tipo, uno solo con el número).
// Las claves VAPID se generan aquí la primera vez y quedan en privado.push_claves: nunca están en el repo.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUJETO = "mailto:avisos@aev2.app";
const enc = new TextEncoder();
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const deB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const unir = (...ps: Uint8Array[]) => { const r = new Uint8Array(ps.reduce((a, p) => a + p.length, 0)); let o = 0; for (const p of ps) { r.set(p, o); o += p.length; } return r; };
async function hmac(clave: Uint8Array, datos: Uint8Array) {
  const k = await crypto.subtle.importKey("raw", clave, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, datos));
}

// deno-lint-ignore no-explicit-any
async function claves(db: any, tarea: string) {
  const { data, error } = await db.rpc("push_tarea_ok", { p_tarea: tarea });
  if (error) throw new Error("No autorizado");
  if (data) return data;
  const par = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const publica = b64u(new Uint8Array(await crypto.subtle.exportKey("raw", par.publicKey)));
  const privada_jwk = await crypto.subtle.exportKey("jwk", par.privateKey);
  await db.rpc("push_claves_guardar", { p_tarea: tarea, p_publica: publica, p_jwk: privada_jwk });
  const { data: otra } = await db.rpc("push_tarea_ok", { p_tarea: tarea });
  return otra || { publica, privada_jwk };
}

async function jwtVapid(aud: string, jwk: JsonWebKey) {
  const k = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const cab = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const cue = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUJETO })));
  const firma = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, k, enc.encode(cab + "." + cue)));
  return cab + "." + cue + "." + b64u(firma);
}

// RFC 8291: cifra el mensaje para la suscripción del navegador
async function cifrar(texto: string, p256dh: string, auth: string) {
  const uaPub = deB64u(p256dh); const secreto = deB64u(auth);
  const efimera = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", efimera.publicKey));
  const ua = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const compartido = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: ua }, efimera.privateKey, 256));
  const prkClave = await hmac(secreto, compartido);
  const ikm = await hmac(prkClave, unir(enc.encode("WebPush: info\0"), uaPub, asPub, new Uint8Array([1])));
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(sal, ikm);
  const cek = (await hmac(prk, unir(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, unir(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);
  const k = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, k, unir(enc.encode(texto), new Uint8Array([2]))));
  return unir(sal, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPub.length]), asPub, cifrado);
}

const resp = (c: unknown, status = 200) => new Response(JSON.stringify(c), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return resp({ error: "Método no permitido" }, 405);
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
    const tarea = req.headers.get("x-tarea") || "";
    let k;
    try { k = await claves(db, tarea); } catch (_) { return resp({ error: "No autorizado" }, 401); }
    const hora = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/Caracas" }).format(new Date()));
    if (hora < 8 || hora >= 22) return resp({ ok: true, silencio: true });
    const desde = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
    const { data: avisos, error } = await db.from("avisos").select("id, para, tipo, titulo, texto, enlace")
      .is("push_en", null).is("leido_en", null).is("apagado_en", null).gte("creado_en", desde).order("creado_en").limit(300);
    if (error) throw error;
    if (!avisos?.length) return resp({ ok: true, enviados: 0 });
    const porPersona = new Map<string, typeof avisos>();
    for (const a of avisos) { const l = porPersona.get(a.para) || []; l.push(a); porPersona.set(a.para, l); }
    const { data: subs } = await db.from("push_suscripciones").select("id, perfil_id, endpoint, p256dh, auth, fallos").in("perfil_id", [...porPersona.keys()]).lt("fallos", 5);
    let enviados = 0;
    for (const [persona, l] of porPersona) {
      // Lote A: más de 3 del mismo tipo salen en uno solo con el número; si aun así son más de 3 mensajes, uno solo con el total
      const porTipo = new Map<string, typeof l>();
      for (const a of l) { const t = porTipo.get(a.tipo) || []; t.push(a); porTipo.set(a.tipo, t); }
      let mensajes = [...porTipo.values()].flatMap((t) => t.length > 3
        ? [{ titulo: t[0].titulo + " (" + t.length + ")", texto: t.slice(0, 2).map((a) => a.texto).join(" · "), enlace: "trabajo.html", id: 0 }]
        : t.map((a) => ({ titulo: a.titulo, texto: a.texto, enlace: a.enlace, id: a.id })));
      if (mensajes.length > 3) mensajes = [{ titulo: "Tienes " + l.length + " avisos nuevos", texto: mensajes.slice(0, 3).map((m) => m.titulo).join(" · "), enlace: "trabajo.html", id: 0 }];
      for (const s of (subs || []).filter((x) => x.perfil_id === persona)) {
        for (const msg of mensajes) {
          try {
            const url = new URL(s.endpoint);
            const cuerpo = await cifrar(JSON.stringify(msg), s.p256dh, s.auth);
            const r = await fetch(s.endpoint, { method: "POST", body: cuerpo, headers: {
              "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "86400", Urgency: "normal",
              Authorization: "vapid t=" + await jwtVapid(url.origin, k.privada_jwk) + ", k=" + k.publica } });
            if (r.status === 404 || r.status === 410) { await db.from("push_suscripciones").update({ fallos: 99 }).eq("id", s.id); break; }
            if (r.ok) { enviados++; await db.from("push_suscripciones").update({ ultimo_ok: new Date().toISOString(), fallos: 0 }).eq("id", s.id); }
            else await db.from("push_suscripciones").update({ fallos: (s.fallos || 0) + 1 }).eq("id", s.id);
          } catch (e) { console.error(e); }
        }
      }
    }
    await db.from("avisos").update({ push_en: new Date().toISOString() }).in("id", avisos.map((a) => a.id));
    return resp({ ok: true, enviados, avisos: avisos.length });
  } catch (e) {
    console.error(e);
    return resp({ error: "Algo falló enviando los avisos" }, 500);
  }
});
