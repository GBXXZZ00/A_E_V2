CREATE OR REPLACE FUNCTION public.comisiones_corte(p_corte date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare v_rol text := privado.exigir('admin', 'abogado', 'analista', 'lider'); v_yo uuid := (select auth.uid());
  v_hoy date := privado.hoy(); actual date := privado.corte_en_curso(); v_max date := privado.corte_de(privado.hoy()); c date; filas jsonb; pinst jsonb := '[]'::jsonb; comp jsonb; cl jsonb;
  v_mis text[]; cert public.cortes_certificados; v_senior boolean := privado.es_senior(); v_duenos jsonb := '[]'::jsonb; v_manual boolean;
begin
  if v_max < actual then v_max := actual; end if;
  c := coalesce(date_trunc('month', p_corte::timestamp)::date, actual);
  if c > v_max then c := v_max; end if;
  v_manual := c >= privado.corte_manual_desde();
  select array_remove(array[privado.norm(p.nombre), privado.norm(p.nombre_odoo)], '') into v_mis from public.perfiles p where p.id = v_yo;
  select * into cert from public.cortes_certificados k where k.corte = c and k.anulado_en is null;
  if cert.id is not null then
    select coalesce(jsonb_agg(e || coalesce(privado.fila_extras((e->>'instalacion_id')::bigint, (e->>'cliente_id')::bigint), '{}'::jsonb) order by e->>'lider', e->>'origen', e->>'instalada_en'), '[]'::jsonb) into filas
    from jsonb_array_elements(cert.filas) e
    where v_rol <> 'lider' or (e->>'lider_id')::uuid = v_yo or privado.norm(e->>'lider') = any (v_mis);
  else
    select coalesce(jsonb_agg(to_jsonb(f) || coalesce(privado.fila_extras(f.instalacion_id, f.cliente_id), '{}'::jsonb) order by f.lider, f.origen, f.instalada_en), '[]'::jsonb) into filas
    from privado.comision_filas3(c) f where v_rol <> 'lider' or f.lider_id = v_yo or privado.norm(f.lider) = any (v_mis);
  end if;

  if c = actual then
    select coalesce(jsonb_agg(jsonb_build_object('orden', o.numero, 'cliente_id', o.cliente_id,
        'nombre', coalesce(cl2.nombre, nullif(o.cliente_nombre, ''), o.titulo), 'creada_en', o.creada_en, 'etapa', o.etapa,
        'lider', coalesce(pf.nombre, cl2.lider_nombre, nullif(o.creador_nombre, ''), 'Sin líder')) order by o.creada_en), '[]'::jsonb)
    into pinst
    from public.ordenes_odoo o
    left join public.clientes cl2 on cl2.id = o.cliente_id
    left join public.perfiles pf on pf.id = coalesce(o.vendedor_id, cl2.lider_id)
    where o.tipo = 'pyme' and o.creada_en > now() - interval '90 days'
      and privado.norm(o.etapa) !~ '(cancel|realiz)'
      and not exists (select 1 from public.instalaciones i where i.orden_id = o.id)
      and not exists (select 1 from public.ordenes_odoo o2 where o2.orden_anterior_id = o.id)
      and (v_rol <> 'lider' or o.vendedor_id = v_yo or o.creador_id = v_yo or cl2.lider_id = v_yo or privado.norm(o.creador_nombre) = any (v_mis));
  end if;

  select jsonb_agg(jsonb_build_object('corte', g.k, 'total', t.total, 'cumplen', t.cumplen) order by g.k) into comp
  from (select (actual - (n || ' month')::interval)::date as k from generate_series(0, 5) n) g
  cross join lateral (
    select count(*) filter (where f.origen = 'corte') as total, count(*) filter (where f.cumple) as cumplen
    from privado.comision_filas3(g.k) f where v_rol <> 'lider' or f.lider_id = v_yo or privado.norm(f.lider) = any (v_mis)) t;

  select coalesce(jsonb_agg(jsonb_build_object('lider', z.lider, 'actual', z.a, 'anterior', z.b) order by z.a desc, z.lider), '[]'::jsonb) into cl
  from (
    select coalesce(x.lider, y.lider) as lider, coalesce(x.n, 0) as a, coalesce(y.n, 0) as b
    from (select f.lider, count(*) n from privado.comision_filas3(c) f where f.origen = 'corte' and (v_rol <> 'lider' or f.lider_id = v_yo or privado.norm(f.lider) = any (v_mis)) group by 1) x
    full join (select f.lider, count(*) n from privado.comision_filas3((c - interval '1 month')::date) f where f.origen = 'corte' and (v_rol <> 'lider' or f.lider_id = v_yo or privado.norm(f.lider) = any (v_mis)) group by 1) y
      on y.lider = x.lider
  ) z;

  if v_senior then select coalesce(jsonb_agg(d), '[]'::jsonb) into v_duenos from privado.duenos() d; end if;

  return jsonb_build_object(
    'corte', c, 'actual', actual, 'siguiente', case when v_max > actual then v_max end, 'hoy', v_hoy, 'inicio', privado.corte_inicio(c), 'fin', privado.corte_fin(c),
    'limite', privado.corte_limite(c), 'certifica', privado.corte_certifica(c), 'dias', privado.corte_limite(c) - v_hoy, 'rol', v_rol,
    'manual', v_manual, 'abierto', cert.id is null and not (c < privado.corte_manual_desde() and v_hoy > privado.corte_limite(c)),
    'cierra_desde', case when v_manual then privado.corte_fin(c) + 1 end,
    'filas', filas,
    'no_comisionan', (select coalesce(jsonb_agg(jsonb_build_object('instalacion_id', i.id, 'cliente_id', i.cliente_id, 'nombre', coalesce(cl3.nombre, i.nombre), 'codigo', i.codigo,
        'instalada_en', i.instalada_en, 'motivo', i.anulada_motivo, 'por', privado.nombre_de(i.anulada_por), 'en', i.anulada_en) order by i.anulada_en desc), '[]'::jsonb)
      from public.instalaciones i left join public.clientes cl3 on cl3.id = i.cliente_id
      where i.anulada_en is not null and i.anulada_motivo is not null
        and coalesce(i.corte_manual, privado.corte_de((i.instalada_en at time zone 'America/Caracas')::date)) = c
        and (v_rol <> 'lider' or i.lider_id = v_yo or cl3.lider_id = v_yo)),
    'fuera_foto', case when cert.id is not null and v_rol = 'admin' then (select coalesce(jsonb_agg(jsonb_build_object('instalacion_id', i.id, 'cliente_id', i.cliente_id, 'nombre', coalesce(cl4.nombre, i.nombre),
        'codigo', i.codigo, 'instalada_en', i.instalada_en, 'motivo', privado.cruce_motivo(i.id), 'evento', i.es_evento, 'lider', coalesce(privado.nombre_de(i.lider_id), i.lider_nombre, 'Por asignar')) order by i.instalada_en), '[]'::jsonb)
      from public.instalaciones i left join public.clientes cl4 on cl4.id = i.cliente_id
      where i.anulada_en is null and privado.comisionable(i.categoria, i.es_aliado)
        and coalesce(i.corte_manual, privado.corte_de((i.instalada_en at time zone 'America/Caracas')::date)) = c
        and not exists (select 1 from jsonb_array_elements(cert.filas) e where (e->>'instalacion_id')::bigint = i.id)) end,
    'por_instalar', pinst, 'comparativa', coalesce(comp, '[]'::jsonb), 'lideres', cl,
    'duenos', v_duenos, 'exc_pagada', case when v_rol in ('admin', 'analista') then (select count(*) from public.clientes x where x.exc_pagada and x.unido_a is null and privado.faltan_archivos(x.id)) else 0 end, 'eventos', case when v_rol <> 'abogado' then privado.eventos_corte(c, v_rol, v_yo, v_mis) else '[]'::jsonb end,
    'certificado', case when cert.id is not null then jsonb_build_object('en', cert.certificado_en, 'por', coalesce(privado.nombre_de(cert.certificado_por), cert.certificado_nombre), 'total', cert.total, 'cumplen', cert.cumplen) end,
    'puedo', jsonb_build_object('asignar', v_senior and cert.id is null, 'pago', v_senior, 'excepcion', v_rol = 'admin' and cert.id is null,
      'certificar', v_senior and cert.id is null and c = actual and case when v_manual then v_hoy > privado.corte_fin(c) else v_hoy >= privado.corte_certifica(c) end,
      'no_comisiona', v_senior, 'reactivar', v_rol = 'admin', 'corregir', v_rol = 'admin' and cert.id is not null, 'pago_dias', v_rol = 'admin', 'quitar_certificado', v_rol = 'admin' and cert.id is not null and not privado.corte_cerrado((c + interval '1 month')::date)));
end $function$
;
