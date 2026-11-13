CREATE OR REPLACE FUNCTION public.comisiones_lista(p_corte date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare r jsonb := public.comisiones_corte(p_corte); v_rol text := privado.rol_actual(); yo uuid := (select auth.uid()); c date; filas jsonb; ali jsonb; pend jsonb; pi jsonb; actual date := privado.corte_en_curso();
  v_mis text[];
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
  return r || jsonb_build_object('filas', filas, 'aliados', ali, 'pendientes', pend, 'pi', pi, 'horas_alerta', privado.orden_horas_alerta(),
    'yo', jsonb_build_object('id', yo, 'equipo', privado.equipo_de(yo)), 'monto', privado.comision_monto(),
    'puedo', (r->'puedo') || jsonb_build_object('enviar', v_rol in ('admin', 'analista', 'lider'), 'enviar_aliados', v_rol in ('admin', 'analista'), 'subir_nuevo', v_rol in ('admin', 'analista', 'lider'), 'horas', v_rol = 'admin'));
end $function$
;
