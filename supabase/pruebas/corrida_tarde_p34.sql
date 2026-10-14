-- Corrida 14/10 tarde, partes 3 y 4 (ya aplicado con el conector). Copia de referencia: formulario de cambio de titular y OCR.
-- Migraciones: cambio_categorias_y_tipo_solicitud, ocr_lecturas, ocr_ajustes, cliente_dato_razon_social,
-- cambio_crear_rif_con_o_sin_digito, ocr_usos_limite. Abajo, lo principal.

-- Lectura OCR guardada (un archivo se lee una vez). RLS activo, sin políticas: solo la usan las funciones del servidor.
create table if not exists public.ocr_lecturas (
  archivo_id bigint primary key references public.archivos(id) on delete cascade, estado text not null check (estado in ('ok', 'sin_lectura')),
  texto text, error text, lector text, tipo text, datos jsonb, dudosa boolean not null default false, ms int, leido_en timestamptz not null default now());
alter table public.ocr_lecturas enable row level security;

-- Tope de lecturas sueltas (formulario de titular, expediente, aliados): cuentas activas y 60 por hora por persona
create table if not exists privado.ocr_usos (id bigint generated always as identity primary key, usuario_id uuid not null, en timestamptz not null default now());
create index if not exists ocr_usos_usuario_en on privado.ocr_usos (usuario_id, en desc);
alter table privado.ocr_usos enable row level security;

CREATE OR REPLACE FUNCTION public.ocr_uso_registrar(p_usuario uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare n int;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then raise exception 'No autorizado' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.perfiles p where p.id = p_usuario and p.activo) then return 'inactivo'; end if;
  select count(*) into n from privado.ocr_usos where usuario_id = p_usuario and en > now() - interval '1 hour';
  if n >= 60 then return 'limite'; end if;
  insert into privado.ocr_usos (usuario_id) values (p_usuario);
  return 'ok';
end $function$;

-- Ajustes del OCR (arrancan en 'no'; solo el administrador los cambia, con bitácora)
CREATE OR REPLACE FUNCTION public.ocr_ajustes()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
begin
  -- Solo dice qué está prendido (sí o no); lo usan las pantallas y las funciones del servidor
  if (select auth.uid()) is null and coalesce(current_setting('request.jwt.claim.role', true), (current_setting('request.jwt.claims', true)::jsonb)->>'role', '') <> 'service_role' then
    raise exception 'Tu sesión venció. Entra de nuevo' using errcode = 'P0001'; end if;
  return jsonb_build_object('aliados', privado.ia_ajuste('ocr_aliados') = 'si', 'revision', privado.ia_ajuste('ocr_revision') = 'si', 'expediente', privado.ia_ajuste('ocr_expediente') = 'si');
end $function$;

CREATE OR REPLACE FUNCTION public.ocr_ajuste_guardar(p_clave text, p_si boolean)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare v_yo uuid := (select auth.uid()); k text := 'ocr_' || coalesce(p_clave, ''); ant text;
begin
  perform privado.exigir('admin');
  if k not in ('ocr_aliados', 'ocr_revision', 'ocr_expediente') then raise exception 'Ajuste no reconocido' using errcode = 'P0001'; end if;
  select valor into ant from privado.ia_ajustes where clave = k;
  insert into privado.ia_ajustes (clave, valor) values (k, case when p_si then 'si' else 'no' end)
  on conflict (clave) do update set valor = excluded.valor;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues)
  values (v_yo, 'ajuste', 'ia_ajustes', k, jsonb_build_object('valor', ant), jsonb_build_object('valor', case when p_si then 'si' else 'no' end));
  return public.ocr_ajustes();
end $function$;

-- La base despierta al OCR (pg_net con el token interno ia_tarea)
CREATE OR REPLACE FUNCTION privado.ocr_despertar(p_archivos bigint[])
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare tk text;
begin
  select decrypted_secret into tk from vault.decrypted_secrets where name = 'ia_tarea';
  perform net.http_post(
    url := 'https://tgjcwgvaybidcawkqksm.supabase.co/functions/v1/ocr_leer',
    body := jsonb_build_object('archivos', to_jsonb(p_archivos[1:60])),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-tarea', tk),
    timeout_milliseconds := 10000);
end $function$;

-- Categorías del formulario de cambio: lista cerrada de tres fuentes (TAD completo vigente, servicios y archivo de cambios)
CREATE OR REPLACE FUNCTION privado.categorias_tad()
 RETURNS TABLE(categoria text, n bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  select upper(btrim(x)) c, count(*) from (
    select i.categoria x from public.tad_indice i where i.carga = privado.tad_indice_vigente()
    union all select s.categoria from public.servicios s
    union all select a.cat_actual from public.cambios_archivo a
    union all select a.cat_anterior from public.cambios_archivo a) q
  where nullif(btrim(x), '') is not null and btrim(x) !~ '^(NAN|#N/A|#REF!|#VALUE!)$'
  group by 1 order by 2 desc, 1
$function$;

CREATE OR REPLACE FUNCTION public.cambio_categorias()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
begin
  perform privado.exigir('admin', 'analista', 'lider');
  return coalesce((select jsonb_agg(c.categoria order by c.n desc, c.categoria) from privado.categorias_tad() c), '[]'::jsonb);
end $function$;

-- Dígito verificador del RIF (igual que supabase/funciones/ocr_leer/lectores.mjs)
CREATE OR REPLACE FUNCTION privado.rif_digito(p_letra text, p_num text)
 RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO ''
AS $function$
  select case when r >= 10 then 0 else r end from (
    select 11 - (( (case upper(p_letra) when 'V' then 1 when 'E' then 2 when 'J' then 3 when 'P' then 4 when 'G' then 5 when 'C' then 3 else 0 end) * 4
      + (select coalesce(sum(substr(lpad(p_num, 8, '0'), i, 1)::int * (array[3,2,7,6,5,4,3,2])[i]), 0) from generate_series(1, 8) i)) % 11) r) x
$function$;

-- cambio_crear (cambio de titular): tipo de solicitud de la planilla, categoría de la lista cerrada, domicilio del nuevo titular,
-- y el mismo número con o sin dígito verificador es la misma persona o empresa (la persona natural se guarda con su cédula).
-- Texto completo en la migración cambio_crear_rif_con_o_sin_digito. Lo que cambió respecto de la anterior:
--   if length(nd) = 9 and privado.rif_digito(nt, left(nd, 8)) = right(nd, 1)::int and nnat then nd := ltrim(left(nd, 8), '0'); end if;
--   td := ltrim(coalesce(tit.d, ''), '0');
--   if nd = td or left(nd, -1) = td or left(td, -1) = nd then raise exception 'El nuevo titular es el mismo de ahora' ...
--   select id into cid from public.clientes where unido_a is null and (doc_numero = nd
--     or (es_natural = nnat and (ltrim(doc_numero, '0') = left(nd, -1) or left(ltrim(doc_numero, '0'), -1) = nd)))
--     order by (doc_numero = nd) desc, id limit 1;
