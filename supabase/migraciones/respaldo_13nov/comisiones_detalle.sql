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
  select count(*) into tot from privado.com_filas_det(c, p_grafica, p_valor) f;
  select coalesce(jsonb_agg(jsonb_build_object('d', z.d, 'n', z.n) order by z.n desc, z.d), '[]'::jsonb) into grupos
  from (select f.d, count(*) n from privado.com_filas_det(c, p_grafica, p_valor) f group by f.d) z;
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
