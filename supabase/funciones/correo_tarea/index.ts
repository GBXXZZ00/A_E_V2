// Bandeja de correos: barre buzones de Gmail conectados (solo lectura) y sube adjuntos al expediente.
// verify_jwt apagado a propósito: entra solo con el token interno del Vault (correo_tarea) en la cabecera x-tarea.
// Acciones: barrer (lista correos con adjuntos y los guarda/coteja en la base) y subir (baja el adjunto de Gmail,
// lo sube a la carpeta de Drive del cliente y lo registra con documentos_registrar a nombre del administrador).
// Copia del código publicado en Supabase. Sin claves: los secretos de Google viven en Supabase.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { "Content-Type": "application/json" } });
const srv = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
const CID = () => (Deno.env.get("GOOGLE_CLIENT_ID") || "").trim();
const CSE = () => (Deno.env.get("GOOGLE_CLIENT_SECRET") || "").trim();

async function tokenDe(refresh: string): Promise<string> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CID(), client_secret: CSE(), refresh_token: refresh, grant_type: "refresh_token" }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) { console.error("token", r.status, d?.error); return ""; }
  return d.access_token;
}
const tokens: Record<string, { t: string; v: number }> = {};
async function tokenGmail(buzon: string) {
  const k = "g:" + buzon;
  if (tokens[k] && Date.now() < tokens[k].v) return tokens[k].t;
  const { data: refresh } = await srv.rpc("correo_buzon_token", { p_email: buzon });
  if (!refresh) throw new Error("El buzón " + buzon + " no está conectado");
  const t = await tokenDe(refresh);
  if (!t) throw new Error("El permiso de Gmail venció para " + buzon + ". Conéctalo de nuevo");
  tokens[k] = { t, v: Date.now() + 50 * 60000 };
  return t;
}
async function tokenDrive() {
  const k = "drive";
  if (tokens[k] && Date.now() < tokens[k].v) return tokens[k].t;
  const t = await tokenDe((Deno.env.get("GOOGLE_REFRESH_TOKEN") || "").trim());
  if (!t) throw new Error("El permiso de Drive venció. Avísale al administrador");
  tokens[k] = { t, v: Date.now() + 50 * 60000 };
  return t;
}
async function gmail(buzon: string, ruta: string) {
  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/" + ruta, { headers: { Authorization: "Bearer " + await tokenGmail(buzon) } });
  if (!r.ok) throw new Error("Gmail respondió " + r.status + " en " + ruta.split("?")[0]);
  return r.json();
}

// ---------- lectura de mensajes ----------
const b64 = (s: string) => { const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/")); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
const texto = (s: string) => { try { return new TextDecoder().decode(b64(s)); } catch (_) { return ""; } };
type Parte = { partId?: string; mimeType?: string; filename?: string; headers?: { name: string; value: string }[]; body?: { data?: string; attachmentId?: string; size?: number }; parts?: Parte[] };
function recorrer(p: Parte, f: (x: Parte) => void) { f(p); (p.parts || []).forEach((h) => recorrer(h, f)); }
function firma(p: Parte) {
  const n = (p.filename || "").toLowerCase();
  const img = (p.mimeType || "").startsWith("image/");
  return n.startsWith("http") || (img && (n === "noname" || /^image0\d\d/.test(n) || (p.body?.size || 0) < 40000));
}
function leer(m: any, buzon: string) {
  const h = (n: string) => (m.payload?.headers || []).find((x: any) => x.name.toLowerCase() === n)?.value || "";
  let plano = "", html = "";
  const adjuntos: unknown[] = [];
  recorrer(m.payload || {}, (p) => {
    if (p.filename && p.body?.attachmentId) {
      if (!firma(p)) adjuntos.push({ part: p.partId, nombre: p.filename, mime: p.mimeType, tamano: p.body.size || 0 });
    } else if (p.mimeType === "text/plain" && p.body?.data && !plano) plano = texto(p.body.data);
    else if (p.mimeType === "text/html" && p.body?.data && !html) html = texto(p.body.data);
  });
  if (!plano && html) plano = html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  plano = plano.replace(/\s+\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  return {
    id: m.id, hilo: m.threadId, fecha: new Date(Number(m.internalDate)).toISOString(), de: h("from"), para: h("to"),
    asunto: h("subject"), texto: plano.slice(0, 6000), enlace: "https://mail.google.com/mail/?authuser=" + encodeURIComponent(buzon) + "#all/" + m.threadId, adjuntos,
  };
}
async function enLotes<T, R>(xs: T[], n: number, f: (x: T) => Promise<R>) {
  const out: R[] = [];
  for (let i = 0; i < xs.length; i += n) out.push(...await Promise.all(xs.slice(i, i + n).map(f)));
  return out;
}

async function barrer(buzon: string, q: string, max: number, pagina?: string) {
  const lista = await gmail(buzon, "messages?maxResults=" + Math.min(Math.max(max, 1), 100) + "&q=" + encodeURIComponent(q + " has:attachment") + (pagina ? "&pageToken=" + encodeURIComponent(pagina) : ""));
  const ids: string[] = (lista.messages || []).map((x: any) => x.id);
  const msgs = await enLotes(ids, 8, (id) => gmail(buzon, "messages/" + id + "?format=full").catch((e) => { console.error(e); return null; }));
  const items = msgs.filter(Boolean).map((m) => leer(m, buzon)).filter((x: any) => x.adjuntos.length);
  let guardados = 0;
  if (items.length) {
    const { data, error } = await srv.rpc("correo_guardar", { p_buzon: buzon, p_items: items });
    if (error) throw new Error("No se guardaron los correos: " + error.message);
    guardados = data || 0;
  }
  return { leidos: ids.length, con_adjuntos: items.length, guardados, siguiente: lista.nextPageToken || null };
}

// ---------- subida a Drive (misma lógica de drive_subir) ----------
const API = "https://www.googleapis.com/drive/v3/files";
const CARPETA = "application/vnd.google-apps.folder";
async function drive(url: string, init: RequestInit = {}) {
  return fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: "Bearer " + await tokenDrive() } });
}
const comillas = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
const igual = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[()]/g, " ").replace(/\bPYMES\b/g, "PYME").replace(/\s+/g, " ").trim();
async function viva(id: string) {
  const r = await drive(API + "/" + encodeURIComponent(id) + "?fields=id,trashed,mimeType&supportsAllDrives=true");
  if (r.status === 404) return false;
  if (!r.ok) throw new Error("Drive no respondió");
  const d = await r.json(); return !d.trashed && d.mimeType === CARPETA;
}
async function carpetasEn(padre: string, contiene: string) {
  const q = "'" + comillas(padre) + "' in parents and mimeType = '" + CARPETA + "' and trashed = false" + (contiene ? " and name contains '" + comillas(contiene) + "'" : "");
  const r = await drive(API + "?q=" + encodeURIComponent(q) + "&fields=files(id,name,createdTime)&orderBy=createdTime&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true");
  if (!r.ok) throw new Error("Drive no respondió");
  return ((await r.json()).files || []) as { id: string; name: string }[];
}
async function crearCarpeta(nombre: string, padre: string) {
  const r = await drive(API + "?fields=id&supportsAllDrives=true", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nombre, mimeType: CARPETA, parents: [padre] }) });
  if (!r.ok) throw new Error("No se pudo crear la carpeta en Drive (" + r.status + ")");
  return (await r.json()).id as string;
}
const ETIQUETA: Record<string, string> = { cedula: "Cédula", rif_personal: "RIF personal", rif_empresa: "RIF", acta_constitutiva: "Acta constitutiva", acta_asamblea: "Acta de asamblea", conatel: "Conatel", contrato_pyme: "Contrato PYME", contrato_dedicado: "Contrato dedicado", otro: "Otro" };

async function subirUno(id: number) {
  const { data: d, error } = await srv.rpc("correo_destino", { p_adjunto: id });
  if (error) throw new Error(error.message);
  if (d.repetido) throw new Error("Ya estaba en la app (mismo nombre y tamaño)");
  // El id del adjunto de Gmail cambia entre lecturas: se busca por la parte del mensaje
  const m = await gmail(d.buzon, "messages/" + d.gmail_id + "?format=full");
  let aid = "";
  recorrer(m.payload || {}, (p) => { if (p.partId === d.part && p.body?.attachmentId) aid = p.body.attachmentId; });
  if (!aid) throw new Error("El adjunto ya no está en el correo");
  const bytes = b64((await gmail(d.buzon, "messages/" + d.gmail_id + "/attachments/" + aid)).data);
  if (bytes.length > 15 * 1024 * 1024) throw new Error("Pesa más de 15 MB");

  let carpeta: string = d.carpeta || "";
  if (!carpeta || !(await viva(carpeta))) {
    const halladas = (await carpetasEn(d.raiz, d.rif)).filter((f) => f.name.trim() === d.rif || f.name.startsWith(d.rif + " - ") || f.name.startsWith(d.rif + "-"));
    let creada = false; let nueva = halladas.length ? halladas[0].id : "";
    if (!nueva) { nueva = await crearCarpeta(d.nombre_carpeta, d.raiz); creada = true; }
    const { data: fija, error: e2 } = await srv.rpc("drive_carpeta_fijar", { p_cliente: d.cliente, p_carpeta: nueva, p_anterior: d.carpeta || null, p_creada: creada, p_usuario: d.admin });
    if (e2 || !fija) throw new Error("No se pudo anotar la carpeta del cliente");
    carpeta = fija;
  }
  const quiero = igual(d.subcarpeta);
  const sub = (await carpetasEn(carpeta, "")).find((f) => igual(f.name) === quiero);
  const destino = sub ? sub.id : await crearCarpeta(d.subcarpeta, carpeta);

  const ext = (String(d.nombre).match(/\.[a-z0-9]{2,5}$/i) || [""])[0];
  const hoy = new Intl.DateTimeFormat("es-VE", { timeZone: "America/Caracas", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date()).replace(/\//g, "-");
  const enDrive = (d.rif + " - " + (ETIQUETA[d.casilla] || "Documento") + " - " + hoy + ext).slice(0, 200);
  const limite = "aev2" + crypto.randomUUID().replace(/-/g, "");
  const enc = new TextEncoder();
  const cuerpo = new Blob([
    enc.encode("--" + limite + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify({ name: enDrive, parents: [destino], mimeType: d.mime }) + "\r\n--" + limite + "\r\nContent-Type: " + d.mime + "\r\n\r\n"),
    bytes, enc.encode("\r\n--" + limite + "--"),
  ]);
  const r = await drive("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,size", { method: "POST", headers: { "Content-Type": "multipart/related; boundary=" + limite }, body: cuerpo });
  if (!r.ok) throw new Error("Drive no recibió el archivo (" + r.status + ")");
  const f = await r.json();
  const { error: e3 } = await srv.rpc("correo_registrar", { p_adjunto: id, p_drive_id: f.id, p_tamano: bytes.length });
  if (e3) throw new Error("Quedó en Drive pero no se registró: " + e3.message);
  return { id, ok: true, drive_id: f.id };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  const { data: ok } = await srv.rpc("correo_tarea_ok", { p_token: req.headers.get("x-tarea") || "" });
  if (!ok) return json({ error: "No autorizado" }, 401);
  try {
    const b = await req.json().catch(() => ({}));
    if (b.accion === "barrer") return json(await barrer(String(b.buzon || ""), String(b.q || ""), Number(b.max) || 50, b.pagina));
    if (b.accion === "subir") {
      const ids: number[] = (Array.isArray(b.adjuntos) ? b.adjuntos : []).map(Number).filter((x: number) => Number.isInteger(x) && x > 0).slice(0, 25);
      const res = [];
      for (const id of ids) {
        try { res.push(await subirUno(id)); }
        catch (e) { const m = (e as Error).message; await srv.rpc("correo_fallo", { p_adjunto: id, p_error: m }); res.push({ id, ok: false, error: m }); }
      }
      return json({ resultados: res });
    }
    return json({ error: "Acción no reconocida" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
