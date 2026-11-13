-- Lote 13/11, parte 9: "Enviar pendientes" también para la analista, solo con los líderes que lleva (perfiles.analista_id).
-- El administrador y la Analista Senior, con todos. La bitácora guarda quién envió.
create or replace function privado.puede_pendientes(p_lider text)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare v_rol text := privado.rol_actual(); yo uuid := (select auth.uid()); lid uuid;
begin
  if v_rol = 'admin' then return true; end if;
  if v_rol <> 'analista' or yo is null then return false; end if;
  if privado.es_senior() then return true; end if;
  select coalesce((select f.lider_id from privado.comision_filas3(privado.corte_en_curso()) f where f.lider = p_lider and f.lider_id is not null limit 1), privado.perfil_por_nombre(p_lider)) into lid;
  return lid is not null and privado.analista_de(lid) = yo;
end $function$;

CREATE OR REPLACE FUNCTION public.pendientes_lider(p_lider text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare v_rol text := privado.exigir('admin', 'analista'); actual date := privado.corte_en_curso(); v_hoy date := privado.hoy();
  v_lider text := nullif(btrim(coalesce(p_lider, '')), ''); pf public.perfiles; filas jsonb;
begin
  if v_lider is null then raise exception 'Falta el líder' using errcode = 'P0001'; end if;
  if not privado.puede_pendientes(v_lider) then raise exception 'No le puedes enviar pendientes a ese líder' using errcode = 'P0001'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'instalacion_id', f.instalacion_id, 'cliente_id', f.cliente_id, 'nombre', f.nombre, 'codigo', f.codigo, 'origen', f.origen,
      'cumple', f.cumple, 'orden_ok', f.orden_ok, 'legal_ok', f.legal_ok, 'pago_ok', f.pago_ok,
      'falta', (select coalesce(jsonb_agg(case when x->>'k' in ('cedula', 'rif_personal') and (x->>'n')::int > 1 then (x->>'t') || ' del representante ' || (x->>'n') else x->>'t' end), '[]'::jsonb)
                from jsonb_array_elements(privado.faltantes(f.cliente_id)) x where x->>'e' = 'falta'),
      'devuelto', (select coalesce(jsonb_agg(case when x->>'k' in ('cedula', 'rif_personal') and (x->>'n')::int > 1 then (x->>'t') || ' del representante ' || (x->>'n') else x->>'t' end), '[]'::jsonb)
                from jsonb_array_elements(privado.faltantes(f.cliente_id)) x where x->>'e' = 'devuelto')
    ) order by f.origen = 'corte', f.instalada_en), '[]'::jsonb)
  into filas
  from privado.comision_filas3(actual) f where f.lider = v_lider;
  if jsonb_array_length(filas) = 0 then raise exception 'Ese líder no tiene instalaciones en este corte' using errcode = 'P0001'; end if;
  -- El WhatsApp sale de Usuarios: por la persona asignada o por su nombre
  select * into pf from public.perfiles p
   where p.activo and (p.id = (select f.lider_id from privado.comision_filas3(actual) f where f.lider = v_lider and f.lider_id is not null limit 1)
      or privado.norm(p.nombre) = privado.norm(v_lider) or privado.norm(p.nombre_odoo) = privado.norm(v_lider))
   order by (p.whatsapp is not null) desc limit 1;
  return jsonb_build_object('lider', v_lider, 'nombre', coalesce(pf.nombre, v_lider), 'whatsapp', pf.whatsapp,
    'corte', actual, 'fin', privado.corte_fin(actual), 'limite', privado.corte_limite(actual), 'dias', privado.corte_limite(actual) - v_hoy, 'filas', filas,
    'ultimo', (select e.en from public.bitacora e where e.accion = 'pendientes_enviados' and e.registro_id = v_lider order by e.en desc limit 1),
    'ultimo_por', (select privado.nombre_de(e.usuario_id) from public.bitacora e where e.accion = 'pendientes_enviados' and e.registro_id = v_lider order by e.en desc limit 1),
    'firma', privado.nombre_de((select auth.uid())));
end $function$
;

CREATE OR REPLACE FUNCTION public.pendientes_enviados(p_lider text, p_pendientes integer, p_pdf boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_rol text := privado.exigir('admin', 'analista'); v_lider text := nullif(btrim(coalesce(p_lider, '')), '');
begin
  if v_lider is null then raise exception 'Falta el líder' using errcode = 'P0001'; end if;
  if not privado.puede_pendientes(v_lider) then raise exception 'No le puedes enviar pendientes a ese líder' using errcode = 'P0001'; end if;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues)
  values ((select auth.uid()), 'pendientes_enviados', 'comisiones', left(v_lider, 120),
    jsonb_build_object('corte', privado.corte_en_curso(), 'pendientes', greatest(coalesce(p_pendientes, 0), 0), 'pdf', coalesce(p_pdf, false), 'rol', v_rol, 'por', privado.nombre_de((select auth.uid()))));
end $function$
;

CREATE OR REPLACE FUNCTION public.comisiones_lista(p_corte date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare r jsonb := public.comisiones_corte(p_corte); v_rol text := privado.rol_actual(); yo uuid := (select auth.uid()); c date; filas jsonb; ali jsonb; pend jsonb; pi jsonb; actual date := privado.corte_en_curso();
  v_mis text[]; penv jsonb;
begin
  c := (r->>'corte')::date;
  select array_remove(array[privado.norm(p.nombre), privado.norm(p.nombre_odoo)], '') into v_mis from public.perfiles p where p.id = yo;
  select coalesce(jsonb_agg(e || jsonb_build_object('equipo', b.equipo, 'carta', privado.carta_estado(b.instalacion_id), 'migracion', b.migracion,
      'orden_creada', (select o.creada_en from public.ordenes_odoo o where o.id = b.orden_id))), '[]'::jsonb) into filas
  from jsonb_array_elements(r->'filas') e left join privado.com_base(c) b on b.instalacion_id = (e->>'instalacion_id')::bigint;
  select coalesce(jsonb_agg(jsonb_build_object('instalacion_id', b.instalacion_id, 'cliente_id', b.cliente_id, 'nombre', b.nombre, 'doc', b.doc, 'instalada_en', b.instalada_en,
      'lider', b.dueno, 'equipo', 'aliados', 'origen', 'corte', 'legal_ok', b.legal_ok, 'pago_ok', b.pago_ok, 'cumple', false, 'orden', b.orden, 'estatus', b.estatus,
      'servicio_id', b.servicio_id, 'carta', privado.carta_estado(b.instalacion_id)) order by b.dueno, b.instalada_en), '[]'::jsonb) into ali
  from privado.com_base(c) b where b.equipo = 'aliados';
  select coalesce(jsonb_agg(to_jsonb(p) order by p.desde desc), '[]'::jsonb) into pend
  from privado.pendientes_instalar() p where v_rol <> 'lider' or p.dueno_id = yo;
  select jsonb_build_object('mas24', count(*) filter (where f.horas >= privado.orden_horas_alerta() and f.creada_en >= privado.corte_abre(actual)),
      'menos24', count(*) filter (where f.horas < privado.orden_horas_alerta() and f.creada_en >= privado.corte_abre(actual)),
      'viejas', count(*) filter (where f.creada_en < privado.corte_abre(actual)))
    into pi from privado.ordenes_abiertas() f
  where (v_rol <> 'lider' or f.lider_id = yo or f.vendedor_id = yo or privado.norm(f.lider) = any (v_mis));
  -- Lote 13/11 parte 9: a quién le puede enviar pendientes (null = a todos) y el último envío a cada líder
  if v_rol in ('admin', 'analista') then
    penv := jsonb_build_object('lideres', case when v_rol = 'admin' or privado.es_senior() then null else
        (select coalesce(jsonb_agg(distinct f.lider), '[]'::jsonb) from privado.comision_filas3(actual) f
          where v_rol = 'analista' and privado.analista_de(coalesce(f.lider_id, privado.perfil_por_nombre(f.lider))) = yo) end,
      'ultimos', (select coalesce(jsonb_object_agg(u.registro_id, jsonb_build_object('en', u.en, 'por', u.por)), '{}'::jsonb)
        from (select distinct on (e.registro_id) e.registro_id, e.en, privado.nombre_de(e.usuario_id) por from public.bitacora e
              where e.accion = 'pendientes_enviados' and e.en > now() - interval '45 days' order by e.registro_id, e.en desc) u));
  end if;
  return r || jsonb_build_object('pend_env', penv, 'filas', filas, 'aliados', ali, 'pendientes', pend, 'pi', pi, 'horas_alerta', privado.orden_horas_alerta(),
    'yo', jsonb_build_object('id', yo, 'equipo', privado.equipo_de(yo)), 'monto', privado.comision_monto(),
    'puedo', (r->'puedo') || jsonb_build_object('enviar', v_rol in ('admin', 'analista', 'lider'), 'enviar_aliados', v_rol in ('admin', 'analista'), 'subir_nuevo', v_rol in ('admin', 'analista', 'lider'), 'horas', v_rol = 'admin'));
end $function$
;

-- lote13nov_pendientes_analista_b: nunca devuelve nulo (sin analista asignada, no puede)
create or replace function privado.puede_pendientes(p_lider text)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare v_rol text := privado.rol_actual(); yo uuid := (select auth.uid()); lid uuid;
begin
  if v_rol = 'admin' then return true; end if;
  if v_rol is distinct from 'analista' or yo is null then return false; end if;
  if privado.es_senior() then return true; end if;
  select coalesce((select f.lider_id from privado.comision_filas3(privado.corte_en_curso()) f where f.lider = p_lider and f.lider_id is not null limit 1), privado.perfil_por_nombre(p_lider)) into lid;
  -- Nunca nulo: sin analista asignada, no
  return coalesce(lid is not null and privado.analista_de(lid) = yo, false);
end $function$;
