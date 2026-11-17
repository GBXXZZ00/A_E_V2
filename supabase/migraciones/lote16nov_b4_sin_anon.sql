-- Lote 16/11 B, revisión: las dos funciones nuevas solo para usuarios con sesión (como las demás).
revoke execute on function public.clientes_parecidos from public, anon;
revoke execute on function public.comisiones_bloques from public, anon;
grant execute on function public.clientes_parecidos to authenticated;
grant execute on function public.comisiones_bloques to authenticated;
