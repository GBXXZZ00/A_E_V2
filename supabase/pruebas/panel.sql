-- Corrida 23/10, bloque 2: Panel por módulo. Una sola función de lectura.
-- Series por mes (a y b según el módulo) y la lista de lo que hay que gestionar.
-- Permisos como Gerencia: el líder ve solo lo suyo; administrador y gerencia ven todo; analista y Legal ven todo menos negativos.
create or replace function public.panel(p_desde date, p_hasta date, p_lider uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public, privado as $$
declare r text := privado.exigir('admin', 'analista', 'lider', 'abogado', 'gerencia'); v_l uuid := p_lider; d date; h date;
begin
  if r = 'lider' then v_l := (select auth.uid()); end if;
  if p_desde is null or p_hasta is null or p_desde > p_hasta or p_hasta - p_desde > 800 then raise exception 'Elige un rango de meses válido' using errcode = 'P0001'; end if;
  d := date_trunc('month', p_desde)::date; h := (date_trunc('month', p_hasta) + interval '1 month')::date;
  return jsonb_build_object(
    'rol', r, 'hoy', (now() at time zone 'America/Caracas')::date,
    'lideres', case when r = 'lider' then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre) order by p.nombre) from perfiles p where p.rol = 'lider' and p.activo and not p.gerencia), '[]'::jsonb) end,
    'series', coalesce((select jsonb_agg(jsonb_build_object('m', s.m, 'mes', s.mes, 'a', s.a, 'b', s.b) order by s.m, s.mes) from (
      select 'comisiones' m, f.mes, count(*) filter (where f.k = 'cumple') a, count(*) filter (where f.k = 'no') b
        from privado.gerencia_filtrado(d, h - 1, v_l, null) f where f.s = 'com' and f.mes is not null group by 2
      union all
      select 'clientes', x.mes, sum(x.a), sum(x.b) from (
        select date_trunc('month', c.creado_en at time zone 'America/Caracas')::date mes, 1 a, 0 b from clientes c where c.creado_en >= d and c.creado_en < h and (v_l is null or c.lider_id = v_l)
        union all select date_trunc('month', c.legal_ok_en at time zone 'America/Caracas')::date, 0, 1 from clientes c where c.legal_ok_en >= d and c.legal_ok_en < h and (v_l is null or c.lider_id = v_l)) x group by 2
      union all
      select 'dedicados', date_trunc('month', k.firmado_en)::date, count(*), 0
        from dedicado_contratos k join clientes c on c.id = k.cliente_id where k.firmado_en >= d and k.firmado_en < h and (v_l is null or c.lider_id = v_l) group by 2
      union all
      select 'migraciones', x.mes, sum(x.a), sum(x.b) from (
        select date_trunc('month', c.creado_en at time zone 'America/Caracas')::date mes, 1 a, 0 b from cambios c where c.creado_en >= d and c.creado_en < h and (v_l is null or c.lider_id = v_l)
        union all select date_trunc('month', c.confirmado_en at time zone 'America/Caracas')::date, 0, 1 from cambios c where c.confirmado_en >= d and c.confirmado_en < h and (v_l is null or c.lider_id = v_l)) x group by 2
      union all
      select 'revision', x.mes, sum(x.a), sum(x.b) from (
        select date_trunc('month', o.subido_en at time zone 'America/Caracas')::date mes, 1 a, 0 b from documentos o join clientes c on c.id = o.cliente_id where o.subido_en >= d and o.subido_en < h and (v_l is null or c.lider_id = v_l)
        union all select date_trunc('month', o.revisado_en at time zone 'America/Caracas')::date, 0, 1 from documentos o join clientes c on c.id = o.cliente_id where o.revisado_en >= d and o.revisado_en < h and (v_l is null or c.lider_id = v_l)) x group by 2
      union all
      select 'aliados', x.mes, sum(x.a), sum(x.b) from (
        select date_trunc('month', s.creada_en at time zone 'America/Caracas')::date mes, 1 a, 0 b from aliado_solicitudes s left join clientes c on c.id = s.cliente_id where s.etiqueta <> 'borrador' and s.creada_en >= d and s.creada_en < h and (v_l is null or c.lider_id = v_l)
        union all select date_trunc('month', coalesce(s.ya_instale_en, s.fecha_instalacion::timestamptz) at time zone 'America/Caracas')::date, 0, 1 from aliado_solicitudes s left join clientes c on c.id = s.cliente_id
          where s.etiqueta = 'instalada' and coalesce(s.ya_instale_en, s.fecha_instalacion::timestamptz) >= d and coalesce(s.ya_instale_en, s.fecha_instalacion::timestamptz) < h and (v_l is null or c.lider_id = v_l)) x group by 2
      union all
      select 'factibilidad', date_trunc('month', f.creada_en at time zone 'America/Caracas')::date, count(*), count(*) filter (where f.seguimiento_en is not null)
        from consultas_fact f where f.creada_en >= d and f.creada_en < h and (v_l is null or f.lider_id = v_l) group by 2
    ) s), '[]'::jsonb),
    'gestion', coalesce((select jsonb_agg(g order by g->>'m', g->>'v' nulls last, g->>'d') from (
      select jsonb_build_object('m', case privado.modulo_de(p.tipo) when 'expedientes' then 'clientes' else privado.modulo_de(p.tipo) end, 't', p.tipo, 'c', p.cliente_id, 'n', p.titulo, 'x', p.detalle,
             'l', privado.nombre_de(p.lider_id), 'd', p.desde, 'v', p.vence) g
        from privado.pendientes() p where privado.modulo_de(p.tipo) in ('expedientes', 'comisiones', 'dedicados') and (v_l is null or p.lider_id = v_l)
      union all
      select jsonb_build_object('m', 'revision', 't', 'docs_revisar', 'c', c.id, 'n', c.nombre, 'x', 'Documentos por revisar', 'l', privado.nombre_de(c.lider_id), 'd', c.estatus_desde, 'v', null)
        from clientes c where c.estatus = 'documentos_en_revision' and (v_l is null or c.lider_id = v_l)
      union all
      select jsonb_build_object('m', 'migraciones', 't', k.estado, 'c', k.cliente_id, 'n', c.nombre,
             'x', case k.estado when 'por_revisar' then 'Revisar documentos del cambio' when 'por_emitir' then 'Cargar en Proham' when 'por_confirmar' then 'Esperando el TAD' else 'Revisar el cambio' end,
             'l', privado.nombre_de(k.lider_id), 'd', k.actualizado_en, 'v', null)
        from cambios k join clientes c on c.id = k.cliente_id where k.estado in ('por_revisar', 'por_emitir', 'por_confirmar', 'sin_registro') and (v_l is null or k.lider_id = v_l)
      union all
      select jsonb_build_object('m', 'aliados', 't', s.etiqueta, 'c', s.cliente_id, 'n', coalesce(c.nombre, 'Solicitud ' || s.id),
             'x', case s.etiqueta when 'analizando' then 'Revisar la solicitud' when 'recaudos' then 'Esperando recaudos del aliado' when 'revision' then 'Documentos por revisar' when 'lista' then 'Lista para instalar' when 'listaobs' then 'Lista con observaciones' when 'curso' then 'Instalación en curso' else 'Revisar' end,
             'l', privado.nombre_de(c.lider_id), 'd', s.actualizada_en, 'v', null)
        from aliado_solicitudes s left join clientes c on c.id = s.cliente_id
       where s.etiqueta in ('analizando', 'recaudos', 'excepcion', 'revision', 'lista', 'listaobs', 'curso') and s.cerrada_en is null and (v_l is null or c.lider_id = v_l)
      union all
      select jsonb_build_object('m', 'factibilidad', 't', 'seguimiento', 'c', null, 'n', coalesce(nullif(f.nombre, ''), 'Consulta ' || f.id), 'x', 'Darle seguimiento a la consulta',
             'l', privado.nombre_de(f.lider_id), 'd', f.creada_en, 'v', null)
        from consultas_fact f where f.seguimiento_en is null and f.creada_en > now() - interval '60 days' and (v_l is null or f.lider_id = v_l)
    ) z), '[]'::jsonb));
end $$;
revoke all on function public.panel(date, date, uuid) from public, anon;
grant execute on function public.panel(date, date, uuid) to authenticated;
