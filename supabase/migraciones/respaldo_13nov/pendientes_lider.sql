CREATE OR REPLACE FUNCTION public.pendientes_lider(p_lider text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare v_rol text := privado.exigir('admin'); actual date := privado.corte_en_curso(); v_hoy date := privado.hoy();
  v_lider text := nullif(btrim(coalesce(p_lider, '')), ''); pf public.perfiles; filas jsonb;
begin
  if v_lider is null then raise exception 'Falta el líder' using errcode = 'P0001'; end if;
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
    'ultimo', (select e.en from public.bitacora e where e.accion = 'pendientes_enviados' and e.registro_id = v_lider order by e.en desc limit 1));
end $function$
;
