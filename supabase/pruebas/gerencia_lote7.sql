-- Lote 7 (14/10): resumen de Gerencia. Aplicado con el conector como migración "gerencia_lote7".
-- Una sola fuente de hechos (privado.gerencia_hechos) de la que salen los contadores, las barras, las listas al tocar y el Excel.
-- Marca Gerencia: perfiles.gerencia. Con la marca, privado.rol_actual() devuelve 'gerencia' y todas las funciones que exigen
-- otro rol responden "No tienes permiso": la cuenta queda de solo lectura sin tocar cada función.

alter table public.perfiles add column if not exists gerencia boolean not null default false;

create or replace function privado.rol_actual() returns text
language sql stable security definer set search_path to '' as $f$
  select case when p.gerencia then 'gerencia' else p.rol end from public.perfiles p where p.id = (select auth.uid()) and p.activo
$f$;

create or replace function privado.gerencia_causa(cumple boolean, exc boolean, legal boolean, pago boolean, orden boolean) returns text
language sql immutable set search_path to '' as $f$
  select case when cumple then case when coalesce(exc, false) then 'Por excepción' else 'Cumple' end
              when not coalesce(legal, false) then 'Falta Legal'
              when not coalesce(pago, false) then 'Falta pago'
              when not coalesce(orden, false) then 'Sin orden'
              else 'Otra causa' end
$f$;

-- s: sección, k: clave dentro de la sección, mes: corte (null = foto de hoy), n: días (para promedios)
create or replace function privado.gerencia_hechos(p_desde date, p_hasta date)
returns table(s text, k text, mes date, cliente_id bigint, nombre text, lider_id uuid, detalle text, n numeric)
language plpgsql stable security definer set search_path to '' as $f$
#variable_conflict use_column
declare
  hoy date := (now() at time zone 'America/Caracas')::date;
  v_ini date := (date_trunc('month', p_desde) - interval '5 months')::date;
  v_fin date := least(date_trunc('month', p_hasta)::date, privado.corte_de(hoy));
  v_c date;
begin
  -- Clientes activos por segmento (foto de hoy)
  return query select 'seg'::text, privado.segmento_filtro(c.id), null::date, c.id, c.nombre, c.lider_id, null::text, null::numeric
    from public.clientes c
    where c.unido_a is null and not coalesce(c.es_demo, false)
      and exists (select 1 from public.servicios v where v.cliente_id = c.id and v.estado = 'Habilitado');

  -- Instalaciones (sin reemplazos ni cambios de categoría), con días desde la orden de Odoo
  return query select 'ins'::text, coalesce(privado.segmento_filtro(x.cliente_id), 'Sin cliente'), privado.corte_de((x.instalada_en at time zone 'America/Caracas')::date),
      x.cliente_id, coalesce(c.nombre, x.nombre), x.lider_id, case when x.es_aliado then initcap(coalesce(x.instalador, 'Aliado')) end,
      (select round((extract(epoch from x.instalada_en - o.creada_en) / 86400)::numeric, 1) from public.ordenes_odoo o where o.id = x.orden_id and o.creada_en <= x.instalada_en)
    from public.instalaciones x left join public.clientes c on c.id = x.cliente_id
    where not coalesce(x.es_evento, false) and coalesce(x.equipo, '') <> 'CAMBIO' and x.instalada_en is not null
      and privado.corte_de((x.instalada_en at time zone 'America/Caracas')::date) between v_ini and v_fin;

  -- Comisiones por corte: los certificados salen de su foto fija; los abiertos, del cálculo de siempre
  for v_c in select g::date from generate_series(v_ini, v_fin, interval '1 month') g loop
    if exists (select 1 from public.cortes_certificados cc where cc.corte = v_c and cc.anulado_en is null) then
      return query select 'com'::text, case when (f->>'cumple')::boolean then 'cumple' else 'no' end, v_c,
          nullif(f->>'cliente_id', '')::bigint, f->>'nombre', nullif(f->>'lider_id', '')::uuid,
          privado.gerencia_causa((f->>'cumple')::boolean, (f->>'excepcion')::boolean, (f->>'legal_ok')::boolean, (f->>'pago_ok')::boolean, (f->>'orden_ok')::boolean), null::numeric
        from public.cortes_certificados cc cross join lateral jsonb_array_elements(cc.filas) f
        where cc.corte = v_c and cc.anulado_en is null;
      return query select 'cert'::text, 'certificado'::text, v_c, null::bigint, null::text, null::uuid, null::text, null::numeric;
    else
      return query select 'com'::text, case when r.cumple then 'cumple' else 'no' end, v_c, r.cliente_id, r.nombre, r.lider_id,
          privado.gerencia_causa(r.cumple, r.excepcion, r.legal_ok, r.pago_ok, r.orden_ok), null::numeric
        from privado.comision_filas3(v_c) r;
    end if;
  end loop;

  -- Expedientes: embudo por estatus (foto de hoy) y días hasta Legal listo
  return query select 'exp'::text, c.estatus, null::date, c.id, c.nombre, c.lider_id, null::text, null::numeric
    from public.clientes c where c.unido_a is null and not coalesce(c.es_demo, false) and c.estatus is not null;
  return query select 'legal'::text, 'listo'::text, privado.corte_de((c.legal_ok_en at time zone 'America/Caracas')::date), c.id, c.nombre, c.lider_id, null::text,
      round((extract(epoch from c.legal_ok_en - c.creado_en) / 86400)::numeric, 1)
    from public.clientes c where c.legal_ok_en is not null and c.unido_a is null and not coalesce(c.es_demo, false)
      and privado.corte_de((c.legal_ok_en at time zone 'America/Caracas')::date) between v_ini and v_fin;
  return query select 'dev'::text, d.casilla, null::date, c.id, c.nombre, c.lider_id, d.motivo, null::numeric
    from public.documentos d join public.clientes c on c.id = d.cliente_id where d.estado = 'devuelto' and c.unido_a is null;
  return query select 'fal'::text, it->>'t', null::date, c.id, c.nombre, c.lider_id, null::text, null::numeric
    from public.clientes c cross join lateral jsonb_array_elements(privado.faltantes(c.id)) it
    where c.unido_a is null and not coalesce(c.es_demo, false)
      and c.estatus in ('documentos_solicitados', 'documentos_pendientes', 'documentos_recibidos') and it->>'e' = 'falta';

  -- Cambios de plan
  return query select 'cam'::text, case when m.estado in ('sin_solicitud', 'error', 'revertido') then m.estado else m.tipo end,
      privado.corte_de((m.creado_en at time zone 'America/Caracas')::date),
      coalesce(m.nuevo_cliente_id, (select c.id from public.clientes c where c.doc_numero = m.titular_doc and c.unido_a is null limit 1)),
      m.titular_nombre, m.lider_id, m.estado, null::numeric
    from public.cambios m where m.estado not in ('cancelado', 'rechazado')
      and privado.corte_de((m.creado_en at time zone 'America/Caracas')::date) between v_ini and v_fin;
  return query select 'cam'::text, 'pyme_otra'::text, privado.corte_de((t.en at time zone 'America/Caracas')::date), v.cliente_id, c.nombre, c.lider_id,
      t.cat_anterior || ' a ' || t.cat_actual, null::numeric
    from privado.tad_cambios_detectados t
    left join public.servicios v on v.sucursal || '-' || v.codigo = t.clave
    left join public.clientes c on c.id = v.cliente_id
    where coalesce(t.cat_anterior, '') ~* 'pyme' and coalesce(t.cat_actual, '') !~* 'pyme'
      and privado.corte_de((t.en at time zone 'America/Caracas')::date) between v_ini and v_fin;

  -- Aliados
  return query select 'ali'::text, x.k, privado.corte_de((x.en at time zone 'America/Caracas')::date), x.cliente_id, x.nombre, null::uuid, x.aliado, null::numeric
    from (
      select 'solicitud' k, a.creada_en en, a.cliente_id, a.nombre, l.nombre aliado from public.aliado_solicitudes a left join public.aliados l on l.id = a.aliado_id
      union all select 'aprobada', a.aprobada_en, a.cliente_id, a.nombre, l.nombre from public.aliado_solicitudes a left join public.aliados l on l.id = a.aliado_id where a.aprobada_en is not null
      union all select 'instalada', x2.instalada_en, a.cliente_id, a.nombre, l.nombre from public.aliado_solicitudes a join public.instalaciones x2 on x2.id = a.instalacion_id left join public.aliados l on l.id = a.aliado_id
      union all select 'pagada', a.pagada_en, a.cliente_id, a.nombre, l.nombre from public.aliado_solicitudes a left join public.aliados l on l.id = a.aliado_id where a.pagada_en is not null
      union all select 'referido', f.creado_en, f.cliente_id, f.nombre || coalesce(' ' || f.apellido, ''), l.nombre from public.aliado_referidos f left join public.aliados l on l.id = f.aliado_id
      union all select 'pagada', f.pagado_en, f.cliente_id, f.nombre || coalesce(' ' || f.apellido, ''), l.nombre from public.aliado_referidos f left join public.aliados l on l.id = f.aliado_id where f.pagado_en is not null
    ) x
    where x.en is not null and privado.corte_de((x.en at time zone 'America/Caracas')::date) between v_ini and v_fin;

  -- Dedicados (foto de hoy)
  return query select 'ded'::text, coalesce(c.estatus, 'sin_estatus'), null::date, c.id, c.nombre, coalesce(c.lider_id, d.ejecutiva_id), d.tipo, null::numeric
    from public.dedicados d join public.clientes c on c.id = d.cliente_id where d.activo;
  return query select 'ded'::text, 'poliza_por_vencer'::text, null::date, c.id, c.nombre, coalesce(c.lider_id, d.ejecutiva_id), to_char(o.vence_en, 'DD/MM/YYYY'), (o.vence_en - hoy)::numeric
    from public.documentos o join public.dedicados d on d.cliente_id = o.cliente_id and d.activo join public.clientes c on c.id = o.cliente_id
    where o.vence_en between hoy and hoy + 30;

  -- Negativos (siempre visibles)
  return query select 'neg'::text, 'sin_permiso'::text, privado.corte_de((p.instalada_en at time zone 'America/Caracas')::date), p.cliente_id, coalesce(c.nombre, p.nombre), c.lider_id, initcap(coalesce(p.instalador, '')), null::numeric
    from public.aliado_sin_permiso p left join public.clientes c on c.id = p.cliente_id
    where p.instalada_en is not null and privado.corte_de((p.instalada_en at time zone 'America/Caracas')::date) between v_ini and v_fin;
  return query select 'neg'::text, 'exc_docs'::text, null::date, c.id, c.nombre, c.lider_id, null::text, null::numeric
    from public.clientes c where c.exc_pagada and c.unido_a is null
      and exists (select 1 from jsonb_array_elements(privado.faltantes(c.id)) it where it->>'e' = 'falta' and not coalesce((it->>'dato')::boolean, false));
  return query select 'neg'::text, 'pyme_otra'::text, h.mes, h.cliente_id, h.nombre, h.lider_id, h.detalle, null::numeric
    from (select 1) z cross join lateral (
      select privado.corte_de((t.en at time zone 'America/Caracas')::date) mes, v.cliente_id, c.nombre, c.lider_id, t.cat_anterior || ' a ' || t.cat_actual detalle
      from privado.tad_cambios_detectados t left join public.servicios v on v.sucursal || '-' || v.codigo = t.clave left join public.clientes c on c.id = v.cliente_id
      where coalesce(t.cat_anterior, '') ~* 'pyme' and coalesce(t.cat_actual, '') !~* 'pyme') h
    where h.mes between v_ini and v_fin;
  return query select 'neg'::text, 'cambio_mal'::text, privado.corte_de((m.creado_en at time zone 'America/Caracas')::date), m.nuevo_cliente_id, m.titular_nombre, m.lider_id, m.estado, null::numeric
    from public.cambios m where m.estado in ('sin_solicitud', 'error', 'revertido')
      and privado.corte_de((m.creado_en at time zone 'America/Caracas')::date) between v_ini and v_fin;
  return query select 'neg'::text, 'com_quitada'::text, privado.corte_de((c.legal_quitado_en at time zone 'America/Caracas')::date), c.id, c.nombre, c.lider_id, null::text, null::numeric
    from public.clientes c where c.legal_quitado_en is not null
      and privado.corte_de((c.legal_quitado_en at time zone 'America/Caracas')::date) between v_ini and v_fin;
  return query select 'neg'::text, case when q.tipo = 'por_instalar' then 'orden_15' else 'docs_30' end, null::date, q.cliente_id, coalesce(c.nombre, q.detalle), q.lider_id, q.titulo,
      (hoy - (q.desde at time zone 'America/Caracas')::date)::numeric
    from privado.pendientes() q left join public.clientes c on c.id = q.cliente_id
    where (q.tipo = 'por_instalar' and q.desde < now() - interval '15 days') or (q.tipo = 'docs_faltan' and q.desde < now() - interval '30 days');
  return query select 'neg'::text, 'poliza_vencida'::text, null::date, c.id, c.nombre, coalesce(c.lider_id, d.ejecutiva_id), to_char(o.vence_en, 'DD/MM/YYYY'), (hoy - o.vence_en)::numeric
    from public.documentos o join public.dedicados d on d.cliente_id = o.cliente_id and d.activo join public.clientes c on c.id = o.cliente_id
    where o.vence_en < hoy;
end $f$;

-- Hechos con los filtros y permisos aplicados. Líder: solo lo suyo. Aliados y negativos: solo administrador y Gerencia.
create or replace function privado.gerencia_filtrado(p_desde date, p_hasta date, p_lider uuid, p_segmento text)
returns table(s text, k text, mes date, cliente_id bigint, nombre text, lider_id uuid, detalle text, n numeric)
language plpgsql stable security definer set search_path to '' as $f$
#variable_conflict use_column
declare r text := privado.exigir('admin', 'analista', 'lider', 'abogado', 'gerencia'); v_todo boolean;
begin
  v_todo := r in ('admin', 'gerencia');
  if r = 'lider' then p_lider := (select auth.uid()); end if;
  if p_desde is null or p_hasta is null or p_desde > p_hasta then raise exception 'Elige un rango de meses válido' using errcode = 'P0001'; end if;
  if p_segmento is not null and p_segmento not in ('PYME', 'Combinado', 'Dedicado ISP', 'Dedicado corporativo') then raise exception 'Elige un segmento válido' using errcode = 'P0001'; end if;
  return query select h.s, h.k, h.mes, h.cliente_id, h.nombre, h.lider_id, case when not v_todo and h.s = 'ins' then null else h.detalle end, h.n
    from privado.gerencia_hechos(date_trunc('month', p_desde)::date, date_trunc('month', p_hasta)::date) h
    where (v_todo or h.s not in ('ali', 'neg'))
      and (p_lider is null or h.lider_id = p_lider or h.s = 'cert')
      and (p_segmento is null or h.s = 'cert'
           or (h.s in ('seg', 'ins') and h.k = p_segmento)
           or (h.s not in ('seg', 'ins') and h.cliente_id is not null and privado.segmento_filtro(h.cliente_id) = p_segmento));
end $f$;

create or replace function public.gerencia(p_desde date, p_hasta date, p_lider uuid default null, p_segmento text default null) returns jsonb
language plpgsql stable security definer set search_path to '' as $f$
declare r text := privado.exigir('admin', 'analista', 'lider', 'abogado', 'gerencia');
begin
  return jsonb_build_object(
    'rol', r, 'todo', r in ('admin', 'gerencia'),
    'corte_actual', privado.corte_de((now() at time zone 'America/Caracas')::date),
    'lideres', case when r = 'lider' then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre) order by p.nombre) from public.perfiles p where p.rol = 'lider' and p.activo and not p.gerencia), '[]'::jsonb) end,
    'grupos', coalesce((select jsonb_agg(jsonb_build_object('s', g.s, 'k', g.k, 'mes', g.mes, 'l', g.lider_id, 'ln', privado.nombre_de(g.lider_id), 'd', g.detalle, 'c', g.c, 'n', g.n) order by g.s, g.k, g.mes)
      from (select f.s, f.k, f.mes, f.lider_id, case when f.s in ('com', 'ins', 'ali', 'ded') then f.detalle end detalle, count(*) c, round(avg(f.n), 1) n
            from privado.gerencia_filtrado(p_desde, p_hasta, p_lider, p_segmento) f group by 1, 2, 3, 4, 5) g), '[]'::jsonb));
end $f$;

-- Lista detrás de un número o una barra. p_mes null: todos los meses del rango (o la foto de hoy).
create or replace function public.gerencia_lista(p_desde date, p_hasta date, p_lider uuid, p_segmento text, p_s text, p_k text, p_mes date default null, p_detalle text default null, p_lider_fila uuid default null)
returns jsonb language plpgsql stable security definer set search_path to '' as $f$
declare r text := privado.exigir('admin', 'analista', 'lider', 'abogado', 'gerencia');
begin
  return coalesce((select jsonb_agg(jsonb_build_object('cliente_id', f.cliente_id, 'nombre', f.nombre, 'lider', privado.nombre_de(f.lider_id), 'detalle', f.detalle, 'mes', f.mes, 'n', f.n,
      'abre', f.cliente_id is not null and r <> 'gerencia') order by f.mes desc nulls first, f.nombre)
    from (select * from privado.gerencia_filtrado(p_desde, p_hasta, p_lider, p_segmento) h
          where h.s = p_s and (p_k is null or h.k = p_k)
            and (case when p_mes is not null then h.mes = date_trunc('month', p_mes)::date else (h.mes is null or h.mes between date_trunc('month', p_desde)::date and date_trunc('month', p_hasta)::date) end)
            and (p_detalle is null or h.detalle = p_detalle) and (p_lider_fila is null or h.lider_id = p_lider_fila)
          limit 1000) f), '[]'::jsonb);
end $f$;

revoke all on function privado.gerencia_hechos(date, date) from public, anon, authenticated;
revoke all on function privado.gerencia_filtrado(date, date, uuid, text) from public, anon, authenticated;
revoke all on function public.gerencia(date, date, uuid, text) from public, anon;
revoke all on function public.gerencia_lista(date, date, uuid, text, text, text, date, text, uuid) from public, anon;
grant execute on function public.gerencia(date, date, uuid, text) to authenticated;
grant execute on function public.gerencia_lista(date, date, uuid, text, text, text, date, text, uuid) to authenticated;

-- Después (migraciones "gerencia_segmentos_rapido", "gerencia_usa_segmentos_todos" y "gerencia_lista_con_clave"):
-- privado.segmentos_todos() calcula el segmento de todos los clientes de una vez (mismo resultado que privado.segmento_filtro,
-- comprobado cliente por cliente: 0 distintos) y gerencia_hechos / gerencia_filtrado lo usan con un join en vez de una llamada por fila
-- (de 2 a 0,6 segundos). gerencia_lista devuelve además 'k' (estatus o causa) para mostrarlo en cada fila.
-- Comprobado: septiembre 59 filas / 49 cumplen sale igual desde Gerencia (foto certificada) y desde comision_filas3.
