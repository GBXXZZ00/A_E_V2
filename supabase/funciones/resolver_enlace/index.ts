// Abre un enlace corto de Google Maps (maps.app.goo.gl) y devuelve el enlace largo, que trae las coordenadas.
// Solo sigue enlaces de Google y solo para quien tiene sesión en la app. Copia del código publicado en Supabase.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { ...cors, "Content-Type": "application/json" } });
const PERMITIDOS = /^(maps\.app\.goo\.gl|goo\.gl|g\.co|share\.google|maps\.google\.[a-z.]+|(www\.)?google\.[a-z.]+|consent\.google\.[a-z.]+)$/i;
// Busca coordenadas en un enlace o en la página de Google, en las formas que usa Maps
function coordenadas(texto: string, pagina = false): { lat: number; lng: number } | null {
  let t = texto;
  try { t = decodeURIComponent(texto); } catch { /* queda como vino */ }
  t = t.replace(/\\u0026/g, "&").replace(/&amp;/g, "&");
  const formas = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /[?&](?:q|query|ll|center|daddr|destination|sll)=(?:loc:)?\s*(-?\d+\.\d+)\s*(?:,|%2C|\+)\s*\+?(-?\d+\.\d+)/i,
    /\/(?:search|place|dir)\/(?:[^/]*\/)?(-?\d+\.\d+)\s*,\s*\+?(-?\d+\.\d+)/,
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /\[null,null,(-?\d+\.\d{3,}),(-?\d+\.\d{3,})\]/,
  ];
  // Dos números sueltos solo valen en el enlace, no en la página (allí hay muchos números)
  if (!pagina) formas.push(/(-?\d{1,2}\.\d{4,}),\s*\+?(-?\d{1,3}\.\d{4,})/);
  for (const f of formas) {
    const m = f.exec(t);
    if (m) { const lat = Number(m[1]), lng = Number(m[2]); if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)) return { lat, lng }; }
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resp({ error: "Método no permitido" }, 405);
  try {
    const sesion = req.headers.get("Authorization") || "";
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: sesion } },
    });
    const { data: rol } = await db.rpc("mi_rol_fact");
    if (!rol) return resp({ error: "Tu sesión venció. Entra de nuevo" }, 401);
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    let url = typeof b.url === "string" ? b.url.trim().slice(0, 600) : "";
    for (let i = 0; i < 6; i++) {
      let u: URL;
      try { u = new URL(url); } catch { return resp({ error: "Ese enlace no se puede abrir" }, 400); }
      if (u.protocol !== "https:" && u.protocol !== "http:") return resp({ error: "Ese enlace no se puede abrir" }, 400);
      if (!PERMITIDOS.test(u.hostname)) return resp({ error: "Ese enlace no es de Google Maps" }, 400);
      const c = coordenadas(url);
      if (c) return resp({ url, ...c });
      // La página de consentimiento trae el destino en "continue"
      const sigue = u.searchParams.get("continue");
      if (/^consent\./i.test(u.hostname) && sigue) { url = sigue; continue; }
      const r = await fetch(url, { redirect: "manual", headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36", "Accept-Language": "es" } });
      const lugar = r.headers.get("location");
      console.log("salto", i, r.status, u.hostname + u.pathname.slice(0, 50), lugar ? "-> " + lugar.slice(0, 120) : "");
      if (r.status >= 300 && r.status < 400 && lugar) { url = new URL(lugar, url).toString(); continue; }
      // Sin redirección: a veces el destino viene dentro de la página
      const html = (await r.text()).slice(0, 800000);
      const enPagina = coordenadas(html, true);
      console.log("pagina", r.status, html.length, enPagina ? "con coordenadas" : "sin coordenadas");
      if (enPagina) return resp({ url, ...enPagina });
      break;
    }
    return resp({ error: "No pude leer las coordenadas de ese enlace" }, 422);
  } catch (e) {
    console.error(e);
    return resp({ error: "No pude abrir el enlace. Intenta de nuevo" }, 502);
  }
});
