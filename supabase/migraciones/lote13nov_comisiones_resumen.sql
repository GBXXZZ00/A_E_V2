-- Lote 13/11, parte 11, parte B (lote13nov_comisiones_resumen): Resumen nuevo de Comisiones, cajones (Ya comisionan por equipo),
-- comisiones_detalle (el líder recibe totales y grupos solo de lo suyo) y documento_reclasificar sin casilla nula. Se aplica con la pantalla nueva.

CREATE OR REPLACE FUNCTION public.comisiones_resumen(p_corte date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
-- Lote 13/11 parte 11: poblaciones separadas (Ventas corporativas, Canales, Aliados comerciales y Sin dueño), todo contra el corte anterior
-- al mismo día del corte con el % calculado aquí, ritmo diario, cortes cerrados, órdenes en días de calendario, dinero con migraciones,
-- ganador por equipo solo entre personas con perfil, aliados agrupados por nombre normalizado, y el líder solo recibe lo suyo.
declare r text := privado.exigir('admin', 'analista', 'lider', 'abogado', 'gerencia'); yo uuid := (select auth.uid()); actual date := privado.corte_en_curso();
  v_max date := greatest(privado.corte_de(privado.hoy()), privado.corte_en_curso()); c date; p date; lm date; v_hoy date := privado.hoy();
  hasta_prev timestamptz; monto numeric := privado.comision_monto(); v_h int := privado.orden_horas_alerta(); v_abre timestamptz := privado.corte_abre(privado.corte_en_curso());
  es_lid boolean; v_dia int; v_largo int;
  bcj jsonb; nums jsonb; rank jsonb; ganadores jsonb; equipos jsonb; pob jsonb; ritmo jsonb; cerrados jsonb; pinst jsonb; mon jsonb; cartas jsonb; cortes jsonb; vlid jsonb;
begin
  if r = 'abogado' and not coalesce((select pf.gerencia from public.perfiles pf where pf.id = yo), false) then raise exception 'No tienes permiso para ver este resumen' using errcode = 'P0001'; end if;
  es_lid := r = 'lider';
  c := coalesce(date_trunc('month', p_corte::timestamp)::date, actual);
  if c > v_max then c := v_max; end if;
  if c < date '2026-09-01' then c := date '2026-09-01'; end if;
  p := (c - interval '1 month')::date;
  hasta_prev := case when now() < privado.corte_cierre(c) then privado.corte_abre(p) + (now() - privado.corte_abre(c)) else privado.corte_cierre(p) end;
  lm := case when privado.corte_cerrado(c) then c else p end;
  v_largo := privado.corte_fin(c) - privado.corte_inicio(c) + 1;
  v_dia := greatest(1, least(v_hoy - privado.corte_inicio(c) + 1, v_largo));

  -- Las filas de los cortes que se usan se leen una sola vez
  select coalesce(jsonb_agg(jsonb_build_object('instalacion_id', b.instalacion_id, 'cliente_id', b.cliente_id, 'instalada_en', b.instalada_en, 'dueno_id', b.dueno_id, 'dueno', b.dueno,
      'equipo', b.equipo, 'origen', b.origen, 'cumple', b.cumple, 'legal_ok', b.legal_ok, 'pago_ok', b.pago_ok, 'orden_id', b.orden_id, 'migracion', b.migracion, 'servicio_id', b.servicio_id, 'corte', k.k)), '[]'::jsonb)
    into bcj
    from (select (c - (n || ' month')::interval)::date k from generate_series(0, 6) n) k cross join lateral privado.com_base(k.k) b
    where k.k >= date '2026-06-01' or k.k in (c, p);

  -- Cada población por separado: instaladas del corte = comisionan + esperan; contra el corte anterior al mismo día
  select jsonb_object_agg(e.k, jsonb_build_object('inst', z.inst, 'com', z.com, 'esperan', z.inst - z.com, 'prev', z.prev, 'prev_total', z.prev_total,
      'pct', case when z.prev > 0 then round(100.0 * (z.inst - z.prev) / z.prev) end)) into pob
  from (values ('corporativas'), ('canales'), ('aliados'), ('sin_dueno')) e(k)
  cross join lateral (select count(*) filter (where b.corte = c) inst, count(*) filter (where b.corte = c and b.cumple) com,
      count(*) filter (where b.corte = p and b.instalada_en < hasta_prev) prev, count(*) filter (where b.corte = p) prev_total
    from jsonb_populate_recordset(null::privado.com_fila, bcj) b where not b.migracion and b.origen = 'corte' and b.equipo = e.k and b.corte in (c, p)) z;

  -- Tarjetas (Ventas corporativas)
  with oa as (select o.*, greatest(v_hoy - (coalesce(o.inicio, o.creada_en) at time zone 'America/Caracas')::date, 0) dd, coalesce(o.inicio, o.creada_en) >= v_abre del_corte from privado.ordenes_abiertas() o)
  select jsonb_build_object(
      'inst', pob->'corporativas'->'inst', 'inst_prev', pob->'corporativas'->'prev', 'pct', pob->'corporativas'->'pct',
      'comisionan', pob->'corporativas'->'com', 'esperan', pob->'corporativas'->'esperan',
      'atrasadas', case when c = actual then (select count(*) from oa where oa.del_corte and oa.dd between 1 and 9) end,
      'mediana', (select round(percentile_cont(0.5) within group (order by extract(epoch from b.instalada_en - o.creada_en) / 86400.0)::numeric, 1)
                  from jsonb_populate_recordset(null::privado.com_fila, bcj) b join public.ordenes_odoo o on o.id = b.orden_id where b.corte = c and not b.migracion and b.origen = 'corte' and b.equipo = 'corporativas' and b.instalada_en >= o.creada_en),
      'mediana_prev', (select round(percentile_cont(0.5) within group (order by extract(epoch from b.instalada_en - o.creada_en) / 86400.0)::numeric, 1)
                  from jsonb_populate_recordset(null::privado.com_fila, bcj) b join public.ordenes_odoo o on o.id = b.orden_id where b.corte = p and not b.migracion and b.origen = 'corte' and b.equipo = 'corporativas' and b.instalada_en >= o.creada_en and b.instalada_en < hasta_prev),
      'susp60', (select count(*) from jsonb_populate_recordset(null::privado.com_fila, bcj) b join public.servicios s on s.id = b.servicio_id where b.corte = c and not b.migracion and b.origen = 'corte'
                   and (s.estado is distinct from 'Habilitado' or s.retirado_en is not null)
                   and coalesce(s.ult_suspension, s.retirado_en, v_hoy) - (b.instalada_en at time zone 'America/Caracas')::date <= 60),
      'siguen_prev', (select case when count(*) > 0 then round(100.0 * count(*) filter (where s.estado = 'Habilitado' and s.retirado_en is null) / count(*)) end
                      from jsonb_populate_recordset(null::privado.com_fila, bcj) b join public.servicios s on s.id = b.servicio_id where b.corte = p and not b.migracion and b.origen = 'corte'))
  into nums;

  -- Ranking del corte: personas de cada equipo (con perfil o no) y aliados agrupados por su nombre normalizado
  with g as (
      select b.equipo, case when b.equipo = 'aliados' then privado.norm(b.dueno) else coalesce(b.dueno_id::text, privado.norm(b.dueno)) end k,
        max(b.dueno) nombre, (array_agg(b.dueno_id))[1] dueno_id, count(*) inst, count(*) filter (where b.cumple) com
      from jsonb_populate_recordset(null::privado.com_fila, bcj) b where b.corte = c and not b.migracion and b.origen = 'corte' and b.equipo in ('corporativas', 'canales', 'aliados') group by 1, 2
      union all
      select privado.equipo_de(pf.id), pf.id::text, pf.nombre, pf.id, 0, 0 from public.perfiles pf
      where pf.activo and pf.rol in ('lider', 'analista') and privado.equipo_de(pf.id) in ('corporativas', 'canales')
        and not exists (select 1 from jsonb_populate_recordset(null::privado.com_fila, bcj) b where b.corte = c and b.origen = 'corte' and b.dueno_id = pf.id)),
  o as (select g.*, row_number() over (partition by g.equipo order by g.inst desc, g.com desc, g.nombre) pos, count(*) over (partition by g.equipo) de from g)
  select coalesce(jsonb_object_agg(z.equipo, z.l), '{}'::jsonb),
         (select jsonb_build_object('pos', o.pos, 'de', o.de, 'nombre', o.nombre, 'inst', o.inst, 'com', o.com, 'equipo', o.equipo) from o where o.dueno_id = yo limit 1)
    into rank, vlid
  from (select o.equipo, jsonb_agg(jsonb_build_object('pos', o.pos, 'nombre', o.nombre, 'k', o.k, 'inst', o.inst, 'com', o.com, 'yo', o.dueno_id = yo) order by o.pos) l from o group by o.equipo) z;

  -- Ganadores del último corte cerrado, por equipo, solo entre personas con perfil (aliados por nombre normalizado)
  with b as (select * from jsonb_populate_recordset(null::privado.com_fila, bcj) b where b.corte = lm and not b.migracion and b.origen = 'corte'),
  g as (select b.equipo, max(b.dueno) nombre, count(*) inst, count(*) filter (where b.cumple) com from b
        where (b.equipo in ('corporativas', 'canales') and b.dueno_id is not null) or b.equipo = 'aliados'
        group by b.equipo, case when b.equipo = 'aliados' then privado.norm(b.dueno) else b.dueno_id::text end),
  o as (select g.*, row_number() over (partition by g.equipo order by g.inst desc, g.com desc, g.nombre) pos from g)
  select jsonb_build_object('corte', lm, 'mes', privado.mes_nombre(lm), 'cerrado', privado.corte_cerrado(lm),
      'lider', (select jsonb_build_object('nombre', o.nombre, 'inst', o.inst, 'com', o.com) from o where o.equipo = 'corporativas' and o.pos = 1 and o.inst > 0),
      'canales', (select jsonb_build_object('nombre', o.nombre, 'inst', o.inst, 'com', o.com) from o where o.equipo = 'canales' and o.pos = 1 and o.inst > 0),
      'aliados', (select jsonb_build_object('nombre', o.nombre, 'inst', o.inst) from o where o.equipo = 'aliados' and o.pos = 1 and o.inst > 0))
  into ganadores;

  -- Equipos: este corte contra el anterior al mismo día del corte; Sin dueño aparte
  select jsonb_agg(jsonb_build_object('equipo', e.k, 'nombre', e.n, 'ahora', (pob->e.k->>'inst')::int, 'com', (pob->e.k->>'com')::int,
      'anterior', (pob->e.k->>'prev')::int, 'pct', pob->e.k->'pct') order by e.o) into equipos
  from (values ('corporativas', 'Ventas corporativas', 1), ('canales', 'Canales de atención', 2), ('aliados', 'Aliados comerciales', 3)) e(k, n, o);

  -- Ritmo del corte (Ventas corporativas): acumulado día a día del corte, del anterior y el promedio de los 3 anteriores
  with dias as (select generate_series(1, v_largo) d),
  ks as (select (c - (n || ' month')::interval)::date k, n from generate_series(0, 3) n),
  cuenta as (select ks.n, dias.d, (select count(*) from jsonb_populate_recordset(null::privado.com_fila, bcj) b where b.corte = ks.k and not b.migracion and b.origen = 'corte' and b.equipo = 'corporativas'
                                    and (b.instalada_en at time zone 'America/Caracas')::date - privado.corte_inicio(ks.k) + 1 <= dias.d) v
             from ks cross join dias)
  select jsonb_build_object('dia', v_dia, 'largo', v_largo, 'en_curso', c = actual,
      'actual', (select jsonb_agg(cu.v order by cu.d) from cuenta cu where cu.n = 0 and (c <> actual or cu.d <= v_dia)),
      'anterior', (select jsonb_agg(cu.v order by cu.d) from cuenta cu where cu.n = 1),
      'promedio', (select jsonb_agg(z.v order by z.d) from (select cu.d, round(avg(cu.v), 1) v from cuenta cu join ks on ks.n = cu.n where cu.n between 1 and 3 and ks.k >= date '2026-09-01' group by cu.d) z))
  into ritmo;

  -- Cortes cerrados (Ventas corporativas): Comisionaron / Pasaron al siguiente / Se perdieron, sin mezclar lo del corte anterior
  select coalesce(jsonb_agg(jsonb_build_object('corte', k.k, 'mes', privado.mes_nombre(k.k), 'comisionaron', z.com, 'pasaron', z.pas, 'perdieron', z.inst - z.com - z.pas) order by k.k), '[]'::jsonb)
    into cerrados
  from (select (c - (n || ' month')::interval)::date k from generate_series(0, 6) n) k
  cross join lateral (select count(*) inst, count(*) filter (where b.cumple) com,
      count(*) filter (where not b.cumple and exists (select 1 from jsonb_populate_recordset(null::privado.com_fila, bcj) s where s.corte = (k.k + interval '1 month')::date and s.instalacion_id = b.instalacion_id and s.origen = 'anterior' and s.cumple)) pas
    from jsonb_populate_recordset(null::privado.com_fila, bcj) b where b.corte = k.k and not b.migracion and b.origen = 'corte' and b.equipo = 'corporativas') z
  where k.k >= date '2026-09-01' and privado.corte_cerrado(k.k);

  -- Órdenes por instalar del corte en días de calendario desde la primera orden de la venta; "Perdida" solo se muestra
  if c = actual then
    with oa as (select o.*, greatest(v_hoy - (coalesce(o.inicio, o.creada_en) at time zone 'America/Caracas')::date, 0) dd, coalesce(o.inicio, o.creada_en) >= v_abre del_corte
                from privado.ordenes_abiertas() o where not es_lid or o.lider_id = yo or o.vendedor_id = yo)
    select jsonb_build_object('al_dia', count(*) filter (where oa.del_corte and oa.dd < 1), 'atrasadas', count(*) filter (where oa.del_corte and oa.dd between 1 and 3),
        'muy', count(*) filter (where oa.del_corte and oa.dd between 4 and 9), 'perdidas', count(*) filter (where not oa.del_corte or oa.dd >= 10))
      into pinst from oa;
  end if;

  -- Dinero del corte, con las migraciones que pagan: Asegurado · En juego · Última oportunidad
  select jsonb_build_object('monto', monto, 'asegurado', count(*) filter (where b.cumple), 'en_juego', count(*) filter (where b.origen = 'corte' and not b.cumple),
      'ultima', count(*) filter (where b.origen = 'anterior' and not b.cumple), 'migraciones', count(*) filter (where b.migracion and b.cumple),
      'limite', privado.corte_limite(c), 'cerrado', privado.corte_cerrado(c))
    into mon from jsonb_populate_recordset(null::privado.com_fila, bcj) b where b.corte = c and b.equipo <> 'aliados';

  with bc as (select b.*, privado.carta_estado(b.instalacion_id) k from jsonb_populate_recordset(null::privado.com_fila, bcj) b where b.corte = c and b.origen = 'corte')
  select jsonb_build_object('canales', count(*) filter (where bc.k->>'k' = 'enviada'), 'lider', count(*) filter (where bc.k->>'k' = 'lider'),
      'por_enviar', count(*) filter (where bc.k->>'k' in ('por_enviar', 'falta_ip')), 'falta_ip', count(*) filter (where bc.k->>'k' = 'falta_ip'),
      'esperan', count(*) filter (where bc.k->>'k' in ('por_enviar', 'falta_ip') and (bc.k->>'dias')::int > 2))
    into cartas from bc;

  select jsonb_agg(jsonb_build_object('corte', g::date, 'mes', privado.mes_nombre(g::date), 'cerrado', privado.corte_cerrado(g::date), 'en_curso', g::date = actual) order by g desc) into cortes
  from generate_series(date '2026-09-01', v_max, interval '1 month') g;

  -- El líder solo recibe lo suyo: sus números contra el corte pasado, su posición (sin los demás), lo que le falta y lo que pierde el día límite
  if es_lid then
    select coalesce(vlid, '{}'::jsonb) || jsonb_build_object(
        'inst', count(*) filter (where b.corte = c and b.origen = 'corte' and not b.migracion),
        'prev', count(*) filter (where b.corte = p and b.origen = 'corte' and not b.migracion and b.instalada_en < hasta_prev),
        'com', count(*) filter (where b.corte = c and b.origen = 'corte' and not b.migracion and b.cumple),
        'faltan', count(*) filter (where b.corte = c and b.origen = 'corte' and not b.cumple),
        'faltan_legal', count(*) filter (where b.corte = c and not b.cumple and not b.legal_ok),
        'faltan_pago', count(*) filter (where b.corte = c and not b.cumple and not b.pago_ok),
        'pierden', count(*) filter (where b.corte = c and b.origen = 'anterior' and not b.cumple),
        'limite', privado.corte_limite(c))
      into vlid from jsonb_populate_recordset(null::privado.com_fila, bcj) b where b.dueno_id = yo and b.corte in (c, p);
    vlid := vlid || jsonb_build_object('pct', case when (vlid->>'prev')::int > 0 then round(100.0 * ((vlid->>'inst')::int - (vlid->>'prev')::int) / (vlid->>'prev')::int) end);
    return jsonb_build_object('corte', c, 'mes', privado.mes_nombre(c), 'anterior', p, 'mes_anterior', privado.mes_nombre(p), 'en_curso', c = actual, 'cerrado', privado.corte_cerrado(c),
      'inicio', privado.corte_inicio(c), 'fin', privado.corte_fin(c), 'limite', privado.corte_limite(c), 'misma_fecha', now() < privado.corte_cierre(c), 'dia', v_dia,
      'lider', vlid, 'por_instalar', pinst, 'cortes', cortes, 'rol', r, 'yo', privado.nombre_de(yo), 'solo_lectura', false, 'horas_alerta', v_h);
  end if;

  return jsonb_build_object('corte', c, 'mes', privado.mes_nombre(c), 'anterior', p, 'mes_anterior', privado.mes_nombre(p), 'en_curso', c = actual, 'cerrado', privado.corte_cerrado(c),
    'inicio', privado.corte_inicio(c), 'fin', privado.corte_fin(c), 'limite', privado.corte_limite(c), 'misma_fecha', now() < privado.corte_cierre(c), 'dia', v_dia,
    'nums', nums, 'pob', pob, 'ranking', rank, 'lider_mes', ganadores, 'equipos', equipos, 'ritmo', ritmo, 'cerrados', cerrados, 'por_instalar', pinst, 'monto', mon, 'cartas', cartas, 'cortes', cortes,
    'rol', r, 'yo', privado.nombre_de(yo), 'solo_lectura', r = 'gerencia' or r = 'abogado', 'horas_alerta', v_h);
end $function$
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
        when 'comisionan' then b.cumple and (x not in ('corporativas', 'canales', 'aliados') or (b.equipo = x and b.origen = 'corte'))
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

CREATE OR REPLACE FUNCTION public.comisiones_detalle(p_corte date, p_grafica text, p_valor text, p_pagina integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare r text := privado.exigir('admin', 'analista', 'lider', 'abogado', 'gerencia'); yo uuid := (select auth.uid()); c date := coalesce(date_trunc('month', p_corte::timestamp)::date, privado.corte_en_curso());
  tot int; filas jsonb; grupos jsonb; pp int := 50; v_mis text[]; v_ali text[];
begin
  if r = 'abogado' and not coalesce((select pf.gerencia from public.perfiles pf where pf.id = yo), false) then raise exception 'No tienes permiso para ver este resumen' using errcode = 'P0001'; end if;
  if p_grafica is null or p_valor is null or length(p_valor) > 200 then raise exception 'Falta qué mostrar' using errcode = 'P0001'; end if;
  if c > greatest(privado.corte_de(privado.hoy()), privado.corte_en_curso()) or c < date '2026-09-01' then raise exception 'Elige un corte válido' using errcode = 'P0001'; end if;
  select array_remove(array[privado.norm(p.nombre), privado.norm(p.nombre_odoo)], '') into v_mis from public.perfiles p where p.id = yo;
  if coalesce(p_pagina, 0) < 0 then pp := 5000; end if;
  -- El líder ve el detalle de las filas de aliados (no las de otros líderes)
  if r = 'lider' then select array_agg(distinct privado.norm(b.dueno)) into v_ali from privado.com_base(c) b where b.equipo = 'aliados'; end if;
  -- Lote 13/11: el líder recibe el total y los grupos solo de lo suyo (y de los aliados), igual que las filas
  select count(*) into tot from privado.com_filas_det(c, p_grafica, p_valor) f
  where r <> 'lider' or privado.norm(f.d) = any (v_mis) or privado.norm(f.d) = any (coalesce(v_ali, '{}'))
    or exists (select 1 from public.clientes k where k.id = f.cliente_id and k.lider_id = yo);
  select coalesce(jsonb_agg(jsonb_build_object('d', z.d, 'n', z.n) order by z.n desc, z.d), '[]'::jsonb) into grupos
  from (select f.d, count(*) n from privado.com_filas_det(c, p_grafica, p_valor) f
        where r <> 'lider' or privado.norm(f.d) = any (v_mis) or privado.norm(f.d) = any (coalesce(v_ali, '{}'))
          or exists (select 1 from public.clientes k where k.id = f.cliente_id and k.lider_id = yo)
        group by f.d) z;
  -- Todos ven los totales por dueño; el líder solo ve el detalle de sus clientes y de los aliados
  select coalesce(jsonb_agg(jsonb_build_object('c', z.cliente_id, 'n', z.n, 's', z.s, 'e', z.e, 't', z.t, 'd', z.d) order by z.d, z.k), '[]'::jsonb) into filas
  from (select * from privado.com_filas_det(c, p_grafica, p_valor) f
        where r <> 'lider' or privado.norm(f.d) = any (v_mis) or privado.norm(f.d) = any (coalesce(v_ali, '{}'))
          or exists (select 1 from public.clientes k where k.id = f.cliente_id and k.lider_id = yo)
        order by f.d, f.k offset greatest(coalesce(p_pagina, 0), 0) * pp limit pp) z;
  return jsonb_build_object('total', tot, 'grupos', grupos, 'pagina', greatest(coalesce(p_pagina, 0), 0), 'por_pagina', pp, 'filas', filas,
    'lista', privado.res_lista('comisiones', p_grafica, p_valor), 'solo_lectura', r in ('gerencia', 'abogado'));
end $function$
;

create or replace function public.documento_reclasificar(p_documento bigint, p_casilla text, p_numero integer default null, p_modo text default null, p_titulo text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare yo uuid := (select auth.uid()); d public.documentos; dst public.documentos; v_num int; tit text := nullif(btrim(coalesce(p_titulo, '')), '');
  ocupada boolean; nom text; base int;
begin
  perform privado.exigir('admin');
  select * into d from public.documentos where id = p_documento for update;
  if not found then raise exception 'Ese documento ya no existe' using errcode = 'P0001'; end if;
  perform privado.exigir_cliente(d.cliente_id);
  if d.casilla not in ('cedula', 'rif_personal', 'rif_empresa', 'acta_constitutiva', 'acta_asamblea', 'conatel', 'otro') then
    raise exception 'Este documento no se puede mover' using errcode = 'P0001'; end if;
  if p_casilla is null or p_casilla not in ('cedula', 'rif_personal', 'rif_empresa', 'acta_constitutiva', 'acta_asamblea', 'otro') then
    raise exception 'Elige qué documento es' using errcode = 'P0001'; end if;
  if p_modo is not null and p_modo not in ('reemplazar', 'dos') then raise exception 'Opción no reconocida' using errcode = 'P0001'; end if;
  if p_casilla in ('rif_empresa', 'acta_constitutiva') then v_num := 0;
  elsif p_casilla in ('cedula', 'rif_personal') then
    v_num := coalesce(p_numero, 0);
    if v_num not between 1 and 10 then raise exception 'Elige el representante' using errcode = 'P0001'; end if;
  elsif p_casilla = 'acta_asamblea' then
    select coalesce(max(numero), 0) + 1 into v_num from public.documentos where cliente_id = d.cliente_id and casilla = 'acta_asamblea';
    if v_num > 99 then raise exception 'No caben más actas' using errcode = 'P0001'; end if;
  else
    if tit is null or length(tit) < 3 then raise exception 'Escribe qué documento es' using errcode = 'P0001'; end if;
    if length(tit) > 80 then raise exception 'El nombre es muy largo. Máximo 80 letras' using errcode = 'P0001'; end if;
    select min(g) into v_num from generate_series(1, 59) g where not exists (select 1 from public.documentos x where x.cliente_id = d.cliente_id and x.casilla = 'otro' and x.numero = g);
    if v_num is null then raise exception 'No caben más documentos' using errcode = 'P0001'; end if;
  end if;
  if d.casilla = p_casilla and d.numero = v_num then raise exception 'Ya está en esa casilla' using errcode = 'P0001'; end if;
  nom := case p_casilla when 'cedula' then 'cédula del representante ' || v_num when 'rif_personal' then 'RIF personal del representante ' || v_num
    when 'rif_empresa' then 'RIF de la empresa' when 'acta_constitutiva' then 'acta constitutiva' when 'acta_asamblea' then 'acta de asamblea ' || v_num else tit end;

  select * into dst from public.documentos where cliente_id = d.cliente_id and casilla = p_casilla and numero = v_num for update;
  ocupada := found and exists (select 1 from public.documento_archivos where documento_id = dst.id and vigente);
  if ocupada and p_modo is null then
    return jsonb_build_object('ocupada', true, 'destino', nom);
  end if;
  -- El documento sale de su casilla: sus marcas de revisión ya no aplican
  update public.revision_marcas set accion = null, motivo = null, nota = null, vence_en = null, marcado_por = yo, marcado_en = now(), origen = 'manual' where documento_id = d.id;

  if dst.id is null then
    -- La casilla destino está libre: el documento entero se mueve y la de origen queda vacía (entra en lo que falta)
    update public.documentos set casilla = p_casilla, numero = v_num, estado = 'por_revisar', motivo = null, nota = null,
      titulo = case when p_casilla = 'otro' then tit else null end, vence_en = null, firmado_en = null where id = d.id;
  else
    -- La casilla destino ya existe: el archivo pasa a ella (reemplaza o se agrega) y la de origen queda devuelta, sin archivo
    if p_modo = 'reemplazar' or not ocupada then
      update public.documento_archivos set vigente = false where documento_id = dst.id and vigente;
    end if;
    select coalesce(max(orden), 0) into base from public.documento_archivos where documento_id = dst.id and vigente;
    insert into public.documento_archivos (documento_id, archivo_id, orden, vigente)
    select dst.id, da.archivo_id, base + row_number() over (order by da.orden, da.archivo_id), true from public.documento_archivos da where da.documento_id = d.id and da.vigente
    on conflict (documento_id, archivo_id) do update set vigente = true, orden = excluded.orden;
    update public.documento_archivos set vigente = false where documento_id = d.id and vigente;
    update public.documentos set estado = 'por_revisar', motivo = null, nota = null, revisado_por = null, revisado_en = null where id = dst.id;
    update public.documentos set estado = 'devuelto', motivo = 'otro', nota = 'Se movió a ' || nom || '. Falta este documento' where id = d.id;
    update public.revision_marcas set accion = null, motivo = null, nota = null, vence_en = null, marcado_por = yo, marcado_en = now(), origen = 'manual' where documento_id = dst.id;
  end if;

  insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues)
  values (yo, 'documento_reclasificado', 'documentos', d.id::text, jsonb_build_object('casilla', d.casilla, 'numero', d.numero, 'cliente', d.cliente_id),
    jsonb_build_object('casilla', p_casilla, 'numero', v_num, 'titulo', tit, 'modo', case when dst.id is null then 'mover' else coalesce(p_modo, 'reemplazar') end, 'destino', coalesce(dst.id, d.id)));
  perform privado.recalcular(d.cliente_id, yo);
  return jsonb_build_object('ok', true, 'documento', coalesce(dst.id, d.id), 'casilla', p_casilla, 'numero', v_num, 'destino', nom);
end $function$;

