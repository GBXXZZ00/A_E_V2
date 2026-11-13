CREATE OR REPLACE FUNCTION public.migraciones_corte(p_corte date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_rol text := privado.exigir('admin', 'abogado', 'analista', 'lider'); v_yo uuid := (select auth.uid()); c date := date_trunc('month', coalesce(p_corte, privado.corte_en_curso()))::date;
begin
  return jsonb_build_object('corte', c,
    'residencial', coalesce((select jsonb_agg(jsonb_build_object('id', z.id, 'nombre', z.titular_nombre, 'lider', coalesce(privado.nombre_de(z.lider_id), z.lider_nombre, 'Sin líder'), 'en', z.confirmado_en) order by z.confirmado_en)
      from public.cambios z where z.tipo = 'residencial' and z.estado = 'confirmado' and privado.corte_de((z.confirmado_en at time zone 'America/Caracas')::date) = c
        and (v_rol <> 'lider' or z.lider_id = v_yo)), '[]'::jsonb),
    'historico', coalesce((select jsonb_agg(jsonb_build_object('id', z.id, 'nombre', z.titular_nombre, 'lider', coalesce(privado.nombre_de(z.lider_id), z.lider_nombre, 'Sin líder'), 'en', z.fecha_cambio) order by z.fecha_cambio)
      from public.cambios z where z.origen = 'historico' and z.corte = c and (v_rol <> 'lider' or z.lider_id = v_yo)), '[]'::jsonb));
end $function$
;
