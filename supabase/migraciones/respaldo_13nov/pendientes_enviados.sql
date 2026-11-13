CREATE OR REPLACE FUNCTION public.pendientes_enviados(p_lider text, p_pendientes integer, p_pdf boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_rol text := privado.exigir('admin'); v_lider text := nullif(btrim(coalesce(p_lider, '')), '');
begin
  if v_lider is null then raise exception 'Falta el líder' using errcode = 'P0001'; end if;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues)
  values ((select auth.uid()), 'pendientes_enviados', 'comisiones', left(v_lider, 120),
    jsonb_build_object('corte', privado.corte_en_curso(), 'pendientes', greatest(coalesce(p_pendientes, 0), 0), 'pdf', coalesce(p_pdf, false)));
end $function$
;
