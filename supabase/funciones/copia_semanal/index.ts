// Lote 27/10 A8: copia semanal de las tablas de negocio a un depósito privado (copias/AAAA-MM-DD/tabla.ndjson.gz).
// La llama la tarea programada de la base (privado.copia_semanal, domingos 2:00 de Caracas) con su clave en la cabecera x-tarea.
// No copia secretos: ni PIN, ni claves, ni suscripciones de avisos, ni filas crudas de las cargas.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
const DEPOSITO = "copias";
// tabla: columna para ordenar las páginas
const TABLAS: Record<string, string> = {
  clientes: "id", servicios: "id", servicio_estados: "id", representantes: "id", documentos: "id", documento_archivos: "documento_id", archivos: "id",
  hilo: "id", bitacora: "id", ordenes_odoo: "id", instalaciones: "id", cortes_certificados: "corte", cambios: "id",
  dedicados: "cliente_id", dedicado_contratos: "id", dedicado_enlaces: "id", dedicado_contactos: "id",
  consultas_fact: "id", aliados: "id", aliado_solicitudes: "id", aliado_referidos: "id", aliado_hilo: "id",
  revisiones: "id", revision_marcas: "documento_id", ia_corridas: "id", ia_marcas: "corrida_id", ia_lecturas: "archivo_id",
  cliente_gestion: "cliente_id", gestiones: "id", gestion_clientes: "gestion_id", gestion_responsables: "gestion_id", gestion_historial: "id",
  envios: "id", cargas: "id",
};
// Columnas que nunca salen de la base
const PERFIL = "id,usuario,nombre,rol,cargo,equipo,activo,senior,coordinador,gerencia,canales,dedicados,codigo_vendedor,nombre_odoo,analista_id,creado_en";

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
async function gzip(texto: string) {
  const s = new Blob([texto]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function copiar(dia: string, tabla: string, orden: string, columnas = "*") {
  const filas: string[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await db.from(tabla).select(columnas).order(orden, { ascending: true }).range(i, i + 999);
    if (error) throw new Error(tabla + ": " + error.message);
    for (const f of data || []) filas.push(JSON.stringify(f));
    if (!data || data.length < 1000) break;
  }
  const { error } = await db.storage.from(DEPOSITO).upload(dia + "/" + tabla + ".ndjson.gz", await gzip(filas.join("\n")), { contentType: "application/gzip", upsert: true });
  if (error) throw new Error(tabla + " (subir): " + error.message);
  return filas.length;
}

async function trabajar() {
  const dia = new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });
  const res: Record<string, number | string> = {}; let fallas = 0;
  for (const [t, o] of Object.entries(TABLAS)) {
    try { res[t] = await copiar(dia, t, o); } catch (e) { res[t] = "error: " + (e as Error).message; fallas++; }
  }
  try { res.perfiles = await copiar(dia, "perfiles", "id", PERFIL); } catch (e) { res.perfiles = "error: " + (e as Error).message; fallas++; }
  await db.storage.from(DEPOSITO).upload(dia + "/indice.json", new TextEncoder().encode(JSON.stringify({ dia, tablas: res }, null, 1)), { contentType: "application/json", upsert: true });
  await db.from("bitacora").insert({ usuario_id: null, accion: "copia_semanal", tabla: "copias", registro_id: dia, despues: { tablas: Object.keys(res).length, fallas } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  const { data: valido } = await db.rpc("ia_tarea_ok", { p_token: req.headers.get("x-tarea") || "" });
  if (valido !== true) return json({ error: "No autorizado" }, 401);
  EdgeRuntime.waitUntil(trabajar().catch((e) => console.error("copia", (e as Error).message)));
  return json({ ok: true }, 202);
});
