-- Lote 4 (14/10): cambios de categoría y de titularidad con datos inventados. Crear y llamar en la MISMA ejecución: termina en raise exception y se deshace.
-- Resultado del 14/10: índice 4 filas; buscar por RIF da 2 servicios y por nombre 1 titular; el líder crea "por_emitir" y no puede emitir;
-- servicios de dos titulares se rechazan; el archivo confirma 1, ignora 1 (RADIUS) y deja 1 sin solicitud; el cambio a PYME comisiona en el corte en curso;
-- vincular un sin solicitud lo confirma; titularidad pide 6 requisitos, queda por aprobar y el TAD la confirma por PON, sin comisión; septiembre 59/49.
create or replace function privado.prueba_tmp() returns void language plpgsql security definer set search_path = '' as $f$
declare adm uuid; li uuid := gen_random_uuid(); k bigint; b jsonb; c1 bigint; c2 bigint; r jsonb; res jsonb := '{}'; e text; inst bigint; sep jsonb; errm text;
begin
  select id into adm from public.perfiles where rol = 'admin' and activo limit 1;
  insert into auth.users (id, instance_id, aud, role, email) values (li, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'liderprueba@aev2.app');
  insert into public.perfiles (id, usuario, nombre, rol, equipo, activo) values (li, 'liderprueba', 'Lider De Prueba', 'lider', 'ventas', true);
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  k := public.tad_indice_iniciar('tad_prueba.csv', 4);
  perform public.tad_indice_parte(k, '[{"s":"824","c":"777001","t":"J","d":"J-41777001-2","n":"Panaderia Inventada Uno","p":"HOGAR 300","ca":"RESIDENCIAL","es":"ACTIVO","di":"Calle Falsa 1","pon":"PONX-1"},
     {"s":"824","c":"777002","t":"J","d":"417770012","n":"Panaderia Inventada Uno","p":"HOGAR 300","ca":"RESIDENCIAL","es":"ACTIVO","di":"Calle Falsa 1","pon":"PONX-2"},
     {"s":"824","c":"777003","t":"V","d":"V-9777003","n":"Persona Inventada Dos","p":"PYME 1GB","ca":"PYME-1GB","es":"ACTIVO","di":"Calle Falsa 3","pon":"PONX-3"},
     {"s":"824","c":"777004","t":"J","d":"J-41777004-0","n":"Ferreteria Inventada","p":"HOGAR","ca":"RESIDENCIAL","es":"ACTIVO","di":"Calle Falsa 4","pon":"PONX-4"}]');
  res := res || jsonb_build_object('indice', public.tad_indice_cerrar(k));
  b := public.servicios_buscar('417770012'); res := res || jsonb_build_object('buscar_rif_servicios', jsonb_array_length(b->'titulares'->0->'servicios'));
  b := public.servicios_buscar('panadería inventada'); res := res || jsonb_build_object('buscar_nombre', jsonb_array_length(b->'titulares'));
  perform set_config('request.jwt.claims', json_build_object('sub', li, 'role', 'authenticated')::text, true);
  c1 := public.cambio_crear('{"tipo":"categoria","servicios":["824-777001"],"categoria_nueva":"PYME-1GB"}');
  select estado into e from public.cambios where id = c1; res := res || jsonb_build_object('categoria_estado', e);
  begin perform public.cambio_accion(c1, 'emitido', null, null); exception when others then errm := sqlerrm; end;
  res := res || jsonb_build_object('lider_no_emite', errm);
  begin perform public.cambio_crear('{"tipo":"categoria","servicios":["824-777002","824-777003"],"categoria_nueva":"PYME-1GB"}'); exception when others then errm := sqlerrm; end;
  res := res || jsonb_build_object('dos_titulares', errm);
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  perform public.cambio_accion(c1, 'emitido', null, null);
  r := public.cambios_archivo_cargar('cambios.xlsx', '[{"codigo":"777001","nombre":"PANADERIA","fecha":"14-10-2026","anterior":"RESIDENCIAL","actual":"PYME-1GB","operador":"Juan","comentario":""},
     {"codigo":"777009","nombre":"X","fecha":"14-10-2026","anterior":"056","actual":"PYME-1GB","operador":"RADIUS","comentario":""},
     {"codigo":"777004","nombre":"FERRETERIA","fecha":"13-10-2026","anterior":"RESIDENCIAL","actual":"PYME-1GB","operador":"Ana","comentario":""}]');
  res := res || jsonb_build_object('archivo', r);
  select estado, instalacion_id into e, inst from public.cambios where id = c1;
  res := res || jsonb_build_object('categoria_tras_archivo', e, 'comisiona_en_corte', exists (select 1 from privado.comision_filas3(privado.corte_en_curso()) f where f.instalacion_id = inst and f.lider = 'Lider De Prueba'));
  select id into c2 from public.cambios where estado = 'sin_solicitud' and titular_doc = '417770040';
  perform public.cambio_accion(c2, 'vincular', 'Lo vendió el líder', li);
  select estado into e from public.cambios where id = c2; res := res || jsonb_build_object('sin_solicitud_vinculado', e);
  perform set_config('request.jwt.claims', json_build_object('sub', li, 'role', 'authenticated')::text, true);
  c2 := public.cambio_crear('{"tipo":"titularidad","servicios":["824-777003"],"nuevo":{"tipo":"J","doc":"J-41777999-1","nombre":"Nueva Empresa Inventada","natural":false}}');
  res := res || jsonb_build_object('titularidad_requisitos', (select jsonb_array_length(privado.cambio_requisitos(c2))), 'titularidad_estado', (select estado from public.cambios where id = c2));
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  perform public.cambio_accion(c2, 'aprobar', null, null); perform public.cambio_accion(c2, 'emitido', null, null);
  k := public.tad_indice_iniciar('tad_prueba2.csv', 1);
  perform public.tad_indice_parte(k, '[{"s":"824","c":"888003","t":"J","d":"J-41777999-1","n":"Nueva Empresa Inventada","p":"PYME 1GB","ca":"PYME-1GB","es":"ACTIVO","di":"Calle Falsa 3","pon":"PONX-3"}]');
  perform public.tad_indice_cerrar(k);
  res := res || jsonb_build_object('titularidad_tras_tad', (select estado || '/' || confirmado_como from public.cambios where id = c2), 'titularidad_sola_comisiona', (select instalacion_id is not null from public.cambios where id = c2));
  select jsonb_build_object('filas', count(*), 'cumplen', count(*) filter (where cumple)) into sep from privado.comision_filas3('2026-09-01');
  raise exception 'RESULTADO %', res || jsonb_build_object('septiembre', sep);
end $f$;
select privado.prueba_tmp();
