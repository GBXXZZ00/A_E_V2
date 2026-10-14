-- Prueba del flujo de comisión de Migraciones en la base real. Todo se deshace: termina en raise exception con el resultado.
-- Se corre de una sola vez con execute_sql (la función vive en pg_temp y desaparece al cerrar la sesión).
create or replace function pg_temp.prueba_migraciones() returns void language plpgsql as $t$
declare adm uuid := (select id from public.perfiles where rol = 'admin' and activo and not gerencia limit 1);
  lid uuid := (select id from public.perfiles where rol = 'lider' and activo and not gerencia limit 1);
  ana uuid := (select id from public.perfiles where rol = 'analista' and activo and not coalesce(senior, false) limit 1);
  v public.servicios; cl public.clientes; k bigint; k2 bigint; r jsonb := '{}'; n0 int; e text; iid bigint;
begin
  select * into v from public.servicios s where s.estado = 'Habilitado' and s.cliente_id is not null order by s.id limit 1;
  select * into cl from public.clientes where id = v.cliente_id;
  n0 := (select count(*) from privado.comision_filas3(privado.corte_en_curso()));
  insert into public.cambios (tipo, origen, estado, lider_id, titular_tipo, titular_doc, titular_nombre, titular_natural, categoria_anterior, categoria_nueva, servicios)
  values ('categoria', 'app', 'emitido', lid, cl.doc_tipo, cl.doc_numero, 'Prueba', false, 'RESIDENCIAL', 'PYME-1GB',
    jsonb_build_array(jsonb_build_object('clave', v.sucursal || '-' || v.codigo, 'sucursal', v.sucursal, 'codigo', v.codigo))) returning id into k;
  perform privado.cambio_confirmar(k, now(), 'archivo', adm);
  r := r || jsonb_build_object('1_confirmado', (select comision || ' inst:' || coalesce(instalacion_id::text, 'ninguna') from public.cambios where id = k),
    '1_corte', (select count(*) from privado.comision_filas3(privado.corte_en_curso())) - n0,
    '1_pendiente_senior', exists (select 1 from privado.pendientes() p where p.tipo = 'cambio_comision' and p.clave = k::text));
  perform set_config('request.jwt.claims', json_build_object('sub', ana)::text, true);
  begin perform public.cambio_comision(k, true, 'prueba'); r := r || '{"2_analista":"pasó (MAL)"}'; exception when others then r := r || jsonb_build_object('2_analista', sqlerrm); end;
  perform set_config('request.jwt.claims', json_build_object('sub', adm)::text, true);
  begin perform public.cambio_comision(k, true, ''); exception when others then r := r || jsonb_build_object('3_sin_motivo', sqlerrm); end;
  perform public.cambio_comision(k, true, 'Prueba: sí comisiona');
  r := r || jsonb_build_object('4_si', (select comision || ' inst:' || coalesce(instalacion_id::text, 'ninguna') from public.cambios where id = k),
    '4_corte', (select count(*) from privado.comision_filas3(privado.corte_en_curso())) - n0,
    '4_pendiente_senior', exists (select 1 from privado.pendientes() p where p.tipo = 'cambio_comision' and p.clave = k::text));
  perform public.cambio_comision(k, false, 'Prueba: lo quito');
  iid := (select instalacion_id from public.cambios where id = k);
  r := r || jsonb_build_object('5_no', (select comision from public.cambios where id = k), '5_anulada', (select anulada_en is not null from public.instalaciones where id = iid),
    '5_corte', (select count(*) from privado.comision_filas3(privado.corte_en_curso())) - n0);
  perform public.cambio_comision(k, true, 'Prueba: vuelve a sí');
  r := r || jsonb_build_object('6_si_otra_vez', (select comision from public.cambios where id = k), '6_misma_instalacion', (select instalacion_id from public.cambios where id = k) = iid,
    '6_corte', (select count(*) from privado.comision_filas3(privado.corte_en_curso())) - n0,
    '6_bitacora', (select count(*) from public.bitacora where tabla = 'cambios' and registro_id = k::text and accion = 'cambio_comision'));
  -- Un cambio de antes de la fecha mínima queda solo como registro
  insert into public.cambios (tipo, origen, estado, lider_id, titular_tipo, titular_doc, titular_nombre, titular_natural, categoria_anterior, categoria_nueva, servicios)
  values ('categoria', 'app', 'emitido', lid, cl.doc_tipo, cl.doc_numero, 'Prueba vieja', false, 'RESIDENCIAL', 'PYME-1GB', '[]'::jsonb) returning id into k2;
  perform privado.cambio_confirmar(k2, timestamptz '2026-09-10 10:00-04', 'archivo', adm);
  begin perform public.cambio_comision(k2, true, 'Prueba vieja'); r := r || '{"7_vieja":"pasó (MAL)"}'; exception when others then r := r || jsonb_build_object('7_vieja', sqlerrm); end;
  r := r || jsonb_build_object('7_solo_registro', privado.cambio_json((select c from public.cambios c where id = k2))->'solo_registro',
    '7_pendiente_senior', exists (select 1 from privado.pendientes() p where p.tipo = 'cambio_comision' and p.clave = k2::text));
  raise exception 'RESULTADO %', r;
end $t$;
select pg_temp.prueba_migraciones();
