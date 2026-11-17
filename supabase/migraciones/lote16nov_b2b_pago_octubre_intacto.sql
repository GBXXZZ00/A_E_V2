-- Lote 16/11 B, tramo 2b (18/11): las instalaciones del corte de octubre que la regla nueva marcó pagadas al aplicarla
-- se dejan como estaban (octubre no se mueve). Se usó una vez, con bitácora 'pago_tad_deshecho' por instalación.
create or replace function privado.pago_tad_deshacer_octubre()
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare r record; ids jsonb := '[]'::jsonb;
begin
  for r in select i.id, i.sucursal, i.codigo from public.instalaciones i
    where i.id in (select registro_id::bigint from public.bitacora where accion = 'pago_tad' and en > now() - interval '3 hours')
      and i.id in (select f.instalacion_id from privado.comision_filas3('2026-10-01') f) loop
    update public.instalaciones set pago_quitado = true, pago_ok_en = null where id = r.id;
    update public.instalaciones set pago_quitado = false where id = r.id;
    insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues) values (null, 'pago_tad_deshecho', 'instalaciones', r.id::text, jsonb_build_object('motivo', 'Instalación del corte de octubre: queda como estaba (lote 16/11 B)'));
    ids := ids || jsonb_build_array(r.sucursal || '-' || ltrim(r.codigo, '0'));
  end loop;
  return ids;
end $function$;
