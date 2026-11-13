-- Lote 12/11 B, parte 7: el tipo de cliente (Dedicado ISP, Dedicado corporativo, PYME...) de las filas de Mi trabajo, para etiquetar y filtrar todas las secciones de Legal
create or replace function public.trabajo_segmentos(p_clientes bigint[])
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare r text := privado.exigir('admin', 'abogado', 'analista', 'lider');
begin
  if p_clientes is null or array_length(p_clientes, 1) is null then return '{}'::jsonb; end if;
  if array_length(p_clientes, 1) > 1000 then raise exception 'Son demasiados clientes de una vez' using errcode = 'P0001'; end if;
  return coalesce((select jsonb_object_agg(c.id::text, privado.segmento(c.id))
    from public.clientes c where c.id = any (p_clientes) and privado.puede_cliente(c.id)), '{}'::jsonb);
end $function$;
revoke all on function public.trabajo_segmentos(bigint[]) from public, anon;
grant execute on function public.trabajo_segmentos(bigint[]) to authenticated;
