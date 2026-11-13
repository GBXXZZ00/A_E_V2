-- Lote 13/11, parte 11: datos de Comisiones (no cambia cuánto se paga, solo cómo se agrupa y se muestra).
-- Parte A (aplicada: lote13nov_comisiones_datos_a): tipo de fila, com_base (dueños sin perfil van a Sin dueño), com_filas_det (cajones con
-- días de calendario y dinero con migraciones), comisiones_lista (sin aliados para el líder; por fila falta, devuelto y estado del pago).

create type privado.com_fila as (instalacion_id bigint, cliente_id bigint, instalada_en timestamptz, dueno_id uuid, dueno text, equipo text, origen text, cumple boolean, legal_ok boolean, pago_ok boolean, orden_id bigint, migracion boolean, servicio_id bigint, corte date);

CREATE OR REPLACE FUNCTION privado.com_base(c date)
 RETURNS TABLE(instalacion_id bigint, cliente_id bigint, nombre text, doc text, instalada_en timestamp with time zone, dueno_id uuid, dueno text, equipo text, origen text, cumple boolean, legal_ok boolean, pago_ok boolean, orden_id bigint, orden text, migracion boolean, servicio_id bigint, estatus text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select f.instalacion_id, f.cliente_id, f.nombre, f.doc, f.instalada_en, d.id, coalesce(privado.nombre_de(d.id), f.lider),
    case when f.lider = 'Por asignar' or d.id is null then 'sin_dueno' else coalesce(privado.equipo_de(d.id), 'corporativas') end,
    f.origen, f.cumple, f.legal_ok, f.pago_ok, f.orden_id, f.orden, i.cambio_id is not null, i.servicio_id, f.estatus
  from privado.comision_filas3(c) f join public.instalaciones i on i.id = f.instalacion_id
  cross join lateral (select coalesce(f.lider_id, case when f.lider <> 'Por asignar' then privado.perfil_por_nombre(f.lider) end) id) d
  union all
  select i.id, i.cliente_id, coalesce(cl.nombre, i.nombre), case when cl.id is not null then cl.doc_tipo || '-' || cl.doc_numero else i.doc_numero end, i.instalada_en, null::uuid,
    coalesce(nullif(btrim(i.instalador), ''), 'Aliado'), 'aliados', 'corte', false, coalesce(cl.legal_ok_en is not null, false), i.pago_ok_en is not null, i.orden_id, o.numero, false, i.servicio_id, coalesce(cl.estatus, 'grandes_negocios')
  from public.instalaciones i left join public.clientes cl on cl.id = i.cliente_id left join public.ordenes_odoo o on o.id = i.orden_id
  where i.es_aliado and i.anulada_en is null and privado.norm(i.categoria) !~ '(dedicad|conectiv)'
    and i.instalada_en >= privado.corte_abre(c) and i.instalada_en < privado.corte_cierre(c) $function$
;

CREATE OR REPLACE FUNCTION privado.com_filas_det(c date, g text, x text)
 RETURNS TABLE(cliente_id bigint, n text, s text, e text, t text, d text, k text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_abre timestamptz := privado.corte_abre(privado.corte_en_curso()); v_hoy date := privado.hoy();
begin
  if g in ('inst', 'ranking', 'equipo', 'comisionan', 'esperan', 'monto', 'susp60', 'cartas', 'serie') then
    return query select b.cliente_id, b.nombre,
      case when b.origen = 'anterior' then 'Del corte anterior · ' else '' end || case when b.migracion then 'Migración ' else 'Instalada ' end || to_char(b.instalada_en at time zone 'America/Caracas', 'DD/MM') || coalesce(' · ' || b.orden, ''),
      case when g = 'cartas' then case z.k->>'k' when 'enviada' then 'Enviada por Canales' when 'lider' then 'Enviada por el líder · falta Canales' when 'falta_ip' then 'Esperando la IP'
                                    when 'por_enviar' then 'Esperando ' || (z.k->>'dias') || case when (z.k->>'dias')::int = 1 then ' día' else ' días' end else 'Sin registro' end
           when g = 'susp60' then 'Suspendido antes de 60 días'
           when b.cumple then 'Comisiona' when b.equipo = 'aliados' then 'Aliado'
           when not b.legal_ok and not b.pago_ok then 'Falta legal y pago' when not b.legal_ok then 'Falta legal' when not b.pago_ok then 'Sin pago' else 'Falta la orden' end,
      case when g = 'cartas' then case z.k->>'k' when 'enviada' then 'ok' when 'lider' then 'b' when 'por_enviar' then case when (z.k->>'dias')::int > 2 then 'r' else 'w' end else 'w' end
           when g = 'susp60' then 'r' when b.cumple then 'ok' when b.equipo = 'aliados' then '' else 'w' end,
      b.dueno, privado.norm(b.dueno) || to_char(b.instalada_en, 'YYYYMMDDHH24MISS')
    from privado.com_base(case when g = 'serie' and split_part(x, '|', 1) ~ '^\d{4}-(0[1-9]|1[0-2])-01$' and split_part(x, '|', 1)::date between '2025-01-01' and privado.corte_en_curso() + 31 then split_part(x, '|', 1)::date else c end) b
    cross join lateral (select case when g = 'cartas' then privado.carta_estado(b.instalacion_id) end k) z
    -- Lote 13/11: el dinero del corte incluye las migraciones que pagan
    where not (b.migracion and g not in ('cartas', 'monto'))
      and case g
        when 'inst' then b.origen = 'corte'
        when 'serie' then b.origen = 'corte' and (split_part(x, '|', 2) = '' or b.cumple) and (split_part(x, '|', 3) = '' or b.equipo = split_part(x, '|', 3))
        when 'comisionan' then b.cumple
        when 'esperan' then not b.cumple and b.equipo <> 'aliados'
        when 'ranking' then b.origen = 'corte' and b.equipo = split_part(x, '|', 1) and (split_part(x, '|', 2) = '' or privado.norm(b.dueno) = split_part(x, '|', 2))
        when 'equipo' then b.origen = 'corte' and b.equipo = x
        when 'monto' then b.equipo <> 'aliados' and case x when 'cumplen' then b.cumple when 'pasan' then b.origen = 'corte' and not b.cumple when 'pierden' then b.origen = 'anterior' and not b.cumple else false end
        when 'susp60' then b.origen = 'corte' and exists (select 1 from public.servicios sv where sv.id = b.servicio_id and (sv.estado is distinct from 'Habilitado' or sv.retirado_en is not null)
                             and coalesce(sv.ult_suspension, sv.retirado_en, v_hoy) - (b.instalada_en at time zone 'America/Caracas')::date <= 60)
        when 'cartas' then b.origen = 'corte' and case x when 'por_enviar' then z.k->>'k' in ('por_enviar', 'falta_ip') when 'ip' then z.k->>'k' = 'falta_ip'
                                                          when 'enviadas' then z.k->>'k' in ('enviada', 'lider') when 'lider' then z.k->>'k' = 'lider' when 'canales' then z.k->>'k' = 'enviada' else true end
        else false end;
  elsif g = 'por_instalar' then
    -- Lote 13/11: días de calendario desde la primera orden de la venta; las de antes del corte o de 10 días o más, perdidas
    return query select o.cliente_id, coalesce(o.cliente, 'Sin cliente en la app'), 'Orden ' || coalesce(o.numero, '') || ' · primera orden ' || to_char(coalesce(o.inicio, o.creada_en) at time zone 'America/Caracas', 'DD/MM') || coalesce(' · ' || o.etapa, ''),
      case when z.dd = 1 then '1 día' else z.dd || ' días' end, case when z.dd >= 10 or coalesce(o.inicio, o.creada_en) < v_abre then 'r' when z.dd >= 4 then 'r' when z.dd >= 1 then 'w' else '' end,
      coalesce(o.lider, 'Por asignar'), lpad((99999 - z.dd)::text, 6, '0')
    from privado.ordenes_abiertas() o
    cross join lateral (select greatest(v_hoy - (coalesce(o.inicio, o.creada_en) at time zone 'America/Caracas')::date, 0) dd) z
    where case x when 'viejas' then coalesce(o.inicio, o.creada_en) < v_abre
      when 'perdidas' then coalesce(o.inicio, o.creada_en) < v_abre or z.dd >= 10
      when 'al_dia' then coalesce(o.inicio, o.creada_en) >= v_abre and z.dd < 1
      when 'atrasadas' then coalesce(o.inicio, o.creada_en) >= v_abre and z.dd between 1 and 3
      when 'muy' then coalesce(o.inicio, o.creada_en) >= v_abre and z.dd between 4 and 9
      when 'atrasadas_todas' then coalesce(o.inicio, o.creada_en) >= v_abre and z.dd between 1 and 9
      else o.creada_en >= v_abre and case x when 'a' then o.horas < 24 when 'b' then o.horas >= 24 and o.horas < 72 when 'c' then o.horas >= 72 and o.horas < 168 when 'd' then o.horas >= 168
                                         when 'mas24' then o.horas >= privado.orden_horas_alerta() else true end end;
  end if;
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
  -- Lote 13/11 parte 11: por fila, qué documentos faltan (por nombre), qué devolvió Legal y por qué, y el estado del pago
  select coalesce(jsonb_agg(e || jsonb_build_object('equipo', b.equipo, 'carta', privado.carta_estado(b.instalacion_id), 'migracion', b.migracion,
      'orden_creada', (select o.creada_en from public.ordenes_odoo o where o.id = b.orden_id),
      'faltan', (select coalesce(jsonb_agg(x->>'t'), '[]'::jsonb) from jsonb_array_elements(fa.l) x where x->>'e' = 'falta' and not coalesce((x->>'dato')::boolean, false)),
      'devueltos', (select coalesce(jsonb_agg(jsonb_build_object('t', x->>'t', 'm', x->>'m')), '[]'::jsonb) from jsonb_array_elements(fa.l) x where x->>'e' = 'devuelto'),
      'pago_estado', case when coalesce((e->>'pago_ok')::boolean, false) then 'ok' when coalesce((e->>'revisar_pago')::boolean, false) then 'revisar' else 'debe' end)), '[]'::jsonb) into filas
  from jsonb_array_elements(r->'filas') e left join privado.com_base(c) b on b.instalacion_id = (e->>'instalacion_id')::bigint
  cross join lateral (select case when coalesce((e->>'legal_ok')::boolean, false) then '[]'::jsonb else privado.faltantes((e->>'cliente_id')::bigint) end l) fa;
  select coalesce(jsonb_agg(jsonb_build_object('instalacion_id', b.instalacion_id, 'cliente_id', b.cliente_id, 'nombre', b.nombre, 'doc', b.doc, 'instalada_en', b.instalada_en,
      'lider', b.dueno, 'equipo', 'aliados', 'origen', 'corte', 'legal_ok', b.legal_ok, 'pago_ok', b.pago_ok, 'cumple', false, 'orden', b.orden, 'estatus', b.estatus,
      'servicio_id', b.servicio_id, 'carta', privado.carta_estado(b.instalacion_id)) order by b.dueno, b.instalada_en), '[]'::jsonb) into ali
  from privado.com_base(c) b where b.equipo = 'aliados' and v_rol <> 'lider';   -- lote 13/11: a la lista del líder no le llegan los aliados
  select coalesce(jsonb_agg(to_jsonb(p) order by p.desde desc), '[]'::jsonb) into pend
  from privado.pendientes_instalar() p where v_rol <> 'lider' or p.dueno_id = yo;
  select jsonb_build_object('mas24', count(*) filter (where f.horas >= privado.orden_horas_alerta() and f.creada_en >= privado.corte_abre(actual)),
      'menos24', count(*) filter (where f.horas < privado.orden_horas_alerta() and f.creada_en >= privado.corte_abre(actual)),
      'viejas', count(*) filter (where f.creada_en < privado.corte_abre(actual)))
    into pi from privado.ordenes_abiertas() f
  where (v_rol <> 'lider' or f.lider_id = yo or f.vendedor_id = yo or privado.norm(f.lider) = any (v_mis));
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
