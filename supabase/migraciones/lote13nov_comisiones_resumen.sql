-- Lote 13/11, parte 11, parte B (lote13nov_comisiones_resumen): Resumen nuevo de Comisiones. Se aplica junto con la pantalla nueva.

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
                   and coalesce(s.ult_suspension, s.retirado_en, v_hoy) - (b.instalada_en at time zone 'America/Caracas')::date <= 60))
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
