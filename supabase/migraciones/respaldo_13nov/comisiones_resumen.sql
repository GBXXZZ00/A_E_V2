CREATE OR REPLACE FUNCTION public.comisiones_resumen(p_corte date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare r text := privado.exigir('admin', 'analista', 'lider', 'abogado', 'gerencia'); yo uuid := (select auth.uid()); actual date := privado.corte_en_curso();
  v_max date := greatest(privado.corte_de(privado.hoy()), privado.corte_en_curso()); c date; p date; lm date; v_hoy date := privado.hoy();
  hasta_prev timestamptz; monto numeric := privado.comision_monto(); v_h int := privado.orden_horas_alerta(); v_abre timestamptz := privado.corte_abre(privado.corte_en_curso());
  nums jsonb; rank jsonb; lider jsonb; equipos jsonb; serie jsonb; pinst jsonb; mon jsonb; cartas jsonb; cortes jsonb;
begin
  if r = 'abogado' and not coalesce((select pf.gerencia from public.perfiles pf where pf.id = yo), false) then raise exception 'No tienes permiso para ver este resumen' using errcode = 'P0001'; end if;
  c := coalesce(date_trunc('month', p_corte::timestamp)::date, actual);
  if c > v_max then c := v_max; end if;
  if c < date '2026-09-01' then c := date '2026-09-01'; end if;
  p := (c - interval '1 month')::date;
  hasta_prev := case when now() < privado.corte_cierre(c) then privado.corte_abre(p) + (now() - privado.corte_abre(c)) else privado.corte_cierre(p) end;
  lm := case when privado.corte_cerrado(c) then c else p end;

  with bc as (select * from privado.com_base(c) b where not b.migracion), bp as (select * from privado.com_base(p) b where not b.migracion)
  select jsonb_build_object(
      'inst', (select count(*) from bc where bc.origen = 'corte'),
      'inst_prev', (select count(*) from bp where bp.origen = 'corte' and bp.instalada_en < hasta_prev),
      'inst_prev_total', (select count(*) from bp where bp.origen = 'corte'),
      'comisionan', (select count(*) from bc where bc.cumple),
      'esperan', (select count(*) from bc where not bc.cumple and bc.equipo <> 'aliados'),
      'por_instalar', case when c = actual then (select count(*) from privado.ordenes_abiertas() o where o.creada_en >= v_abre and o.horas >= v_h) end,
      'mediana', (select round(percentile_cont(0.5) within group (order by extract(epoch from bc.instalada_en - o.creada_en) / 86400.0)::numeric, 1)
                  from bc join public.ordenes_odoo o on o.id = bc.orden_id where bc.origen = 'corte' and bc.instalada_en >= o.creada_en),
      'susp60', (select count(*) from bc join public.servicios s on s.id = bc.servicio_id where bc.origen = 'corte'
                   and (s.estado is distinct from 'Habilitado' or s.retirado_en is not null)
                   and coalesce(s.ult_suspension, s.retirado_en, v_hoy) - (bc.instalada_en at time zone 'America/Caracas')::date <= 60),
      'siguen_prev', (select case when count(*) > 0 then round(100.0 * count(*) filter (where s.estado = 'Habilitado' and s.retirado_en is null) / count(*)) end
                      from bp join public.servicios s on s.id = bp.servicio_id where bp.origen = 'corte'))
  into nums;

  with bc as (select * from privado.com_base(c) b where not b.migracion and b.origen = 'corte'),
  g as (select bc.equipo, bc.dueno, bc.dueno_id, count(*) inst, count(*) filter (where bc.cumple) com from bc where bc.equipo in ('corporativas', 'canales', 'aliados') group by 1, 2, 3
        union all
        select privado.equipo_de(pf.id), pf.nombre, pf.id, 0, 0 from public.perfiles pf
        where pf.activo and pf.rol in ('lider', 'analista') and privado.equipo_de(pf.id) in ('corporativas', 'canales')
          and not exists (select 1 from bc where bc.dueno_id = pf.id)),
  o as (select g.*, row_number() over (partition by g.equipo order by g.inst desc, g.com desc, g.dueno) pos from g)
  select coalesce(jsonb_object_agg(z.equipo, z.l), '{}'::jsonb) into rank
  from (select o.equipo, jsonb_agg(jsonb_build_object('pos', o.pos, 'nombre', o.dueno, 'inst', o.inst, 'com', o.com, 'yo', o.dueno_id = yo) order by o.pos) l from o group by o.equipo) z;

  with b as (select * from privado.com_base(lm) b where not b.migracion and b.origen = 'corte'),
  g as (select b.equipo, b.dueno, count(*) inst, count(*) filter (where b.cumple) com from b where b.equipo in ('corporativas', 'canales', 'aliados') group by 1, 2),
  o as (select g.*, row_number() over (partition by g.equipo order by g.inst desc, g.com desc, g.dueno) pos from g)
  select jsonb_build_object('corte', lm, 'mes', privado.mes_nombre(lm), 'cerrado', privado.corte_cerrado(lm),
      'lider', (select jsonb_build_object('nombre', o.dueno, 'inst', o.inst, 'com', o.com) from o where o.equipo = 'corporativas' and o.pos = 1 and o.inst > 0),
      'canales', (select jsonb_build_object('nombre', o.dueno, 'inst', o.inst) from o where o.equipo = 'canales' and o.pos = 1 and o.inst > 0),
      'aliados', (select jsonb_build_object('nombre', o.dueno, 'inst', o.inst) from o where o.equipo = 'aliados' and o.pos = 1 and o.inst > 0))
  into lider;

  with bc as (select * from privado.com_base(c) b where not b.migracion and b.origen = 'corte'), bp as (select * from privado.com_base(p) b where not b.migracion and b.origen = 'corte')
  select jsonb_agg(jsonb_build_object('equipo', e.k, 'nombre', e.n, 'ahora', (select count(*) from bc where bc.equipo = e.k), 'com', (select count(*) from bc where bc.equipo = e.k and bc.cumple),
      'anterior', (select count(*) from bp where bp.equipo = e.k)) order by e.o) into equipos
  from (values ('corporativas', 'Ventas corporativas', 1), ('canales', 'Canales de atención', 2), ('aliados', 'Aliados comerciales', 3)) e(k, n, o);

  select jsonb_agg(jsonb_build_object('corte', g.k, 'mes', privado.mes_nombre(g.k), 'total', t.total, 'cumplen', t.cumplen, 'actual', g.k = c) order by g.k) into serie
  from (select (c - (n || ' month')::interval)::date k from generate_series(0, 5) n) g
  cross join lateral (select count(*) filter (where b.origen = 'corte') total, count(*) filter (where b.cumple) cumplen from privado.com_base(g.k) b where not b.migracion) t
  where g.k >= date '2026-06-01';

  if c = actual then
    select jsonb_build_object('a', count(*) filter (where o.horas < 24), 'b', count(*) filter (where o.horas >= 24 and o.horas < 72),
        'c', count(*) filter (where o.horas >= 72 and o.horas < 168), 'd', count(*) filter (where o.horas >= 168),
        'viejas', (select count(*) from privado.ordenes_abiertas() v where v.creada_en < v_abre))
      into pinst from privado.ordenes_abiertas() o where o.creada_en >= v_abre;
  end if;

  with bc as (select * from privado.com_base(c) b where not b.migracion)
  select jsonb_build_object('monto', monto, 'cumplen', count(*) filter (where bc.cumple), 'pasan', count(*) filter (where bc.origen = 'corte' and not bc.cumple and bc.equipo <> 'aliados'),
      'pierden', count(*) filter (where bc.origen = 'anterior' and not bc.cumple), 'limite', privado.corte_limite(c), 'cerrado', privado.corte_cerrado(c))
    into mon from bc;

  with bc as (select b.*, privado.carta_estado(b.instalacion_id) k from privado.com_base(c) b where b.origen = 'corte')
  select jsonb_build_object('canales', count(*) filter (where bc.k->>'k' = 'enviada'), 'lider', count(*) filter (where bc.k->>'k' = 'lider'),
      'por_enviar', count(*) filter (where bc.k->>'k' in ('por_enviar', 'falta_ip')), 'falta_ip', count(*) filter (where bc.k->>'k' = 'falta_ip'),
      'esperan', count(*) filter (where bc.k->>'k' in ('por_enviar', 'falta_ip') and (bc.k->>'dias')::int > 2))
    into cartas from bc;

  select jsonb_agg(jsonb_build_object('corte', g::date, 'mes', privado.mes_nombre(g::date), 'cerrado', privado.corte_cerrado(g::date), 'en_curso', g::date = actual) order by g desc) into cortes
  from generate_series(date '2026-09-01', v_max, interval '1 month') g;

  return jsonb_build_object('corte', c, 'mes', privado.mes_nombre(c), 'anterior', p, 'mes_anterior', privado.mes_nombre(p), 'en_curso', c = actual, 'cerrado', privado.corte_cerrado(c),
    'inicio', privado.corte_inicio(c), 'fin', privado.corte_fin(c), 'limite', privado.corte_limite(c), 'misma_fecha', now() < privado.corte_cierre(c),
    'nums', nums, 'ranking', rank, 'lider_mes', lider, 'equipos', equipos, 'serie', serie, 'por_instalar', pinst, 'monto', mon, 'cartas', cartas, 'cortes', cortes,
    'rol', r, 'yo', privado.nombre_de(yo), 'solo_lectura', r = 'gerencia' or r = 'abogado', 'horas_alerta', v_h);
end $function$
;
