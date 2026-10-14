-- Lote 5 (14/10): cadena completa de la coordinación de canales con datos inventados.
-- Se corre desde el conector: crea la función y la llama en la MISMA ejecución; termina en raise exception y todo se deshace.
-- Resultado esperado: rif libre, 2 documentos en el expediente, etiqueta "instalada", 1 nueva en Sin autorización,
-- aparece en Pagos y queda pagada, septiembre 59/49. Un RIF de un cliente con líder da "cartera" y no guarda archivos.
create or replace function privado.prueba_tmp() returns void language plpgsql security definer set search_path = '' as $f$
declare u uuid := gen_random_uuid(); adm uuid; sid bigint; r jsonb; cid bigint; nd int; ndoc int; e1 text; pag jsonb; s0 int; s1 int; sep jsonb; res jsonb := '{}';
begin
  select id into adm from public.perfiles where rol = 'admin' and activo limit 1;
  select count(*) into s0 from public.aliado_sin_permiso;
  insert into auth.users (id, instance_id, aud, role, email) values (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'coordprueba@aev2.app');
  insert into public.perfiles (id, usuario, nombre, rol, equipo, activo, canales) values (u, 'coordprueba', 'Coordinadora De Prueba', 'analista', 'aliados', true, true);
  update public.aliados set perfil_id = u where es_canales;
  insert into public.aliado_instaladores (texto, aliado_id) select privado.norm('Coordinacion Prueba Instala'), id from public.aliados where es_canales limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  sid := (public.solicitud_crear('empresa')->>'id')::bigint;
  r := public.solicitud_rif_leido(sid, '{"documentos":[{"tipo":"rif_empresa","numero":"J-41999888-7","razon_social":"EMPRESA INVENTADA CADENA","legible":true}]}');
  cid := (r->>'cliente')::bigint; res := res || jsonb_build_object('rif', r->>'estado');
  insert into privado.drive_subidas (drive_id, cliente_id, usuario_id, nombre, mime, tamano, en) values ('DRV-CADENA-1', cid, u, 'rif.pdf', 'application/pdf', 1000, now()), ('DRV-CADENA-2', cid, u, 'acta.pdf', 'application/pdf', 1000, now());
  nd := public.documentos_registrar(cid, '[{"archivos":[{"drive_id":"DRV-CADENA-1"}],"casillas":[{"casilla":"rif_empresa","numero":0}]},{"archivos":[{"drive_id":"DRV-CADENA-2"}],"casillas":[{"casilla":"acta_constitutiva","numero":0}]}]');
  select count(*) into ndoc from public.documentos d join public.documento_archivos da on da.documento_id = d.id and da.vigente where d.cliente_id = cid;
  res := res || jsonb_build_object('docs_registrados', nd, 'docs_en_expediente', ndoc);
  update public.aliado_solicitudes set etiqueta = 'revision' where id = sid;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  perform public.solicitud_decidir(sid, 'aprobar', 'Aprobada en la prueba');
  insert into public.instalaciones (sucursal, codigo, instalada_en, nombre, categoria, instalador, es_aliado, cliente_id, doc_numero)
  values ('824', '99900001', now(), 'EMPRESA INVENTADA CADENA', 'PYME-1GB', 'Coordinacion Prueba Instala', true, cid, '41999888');
  select etiqueta into e1 from public.aliado_solicitudes where id = sid;
  insert into public.instalaciones (sucursal, codigo, instalada_en, nombre, categoria, instalador, es_aliado, doc_numero)
  values ('824', '99900002', now(), 'OTRA EMPRESA INVENTADA', 'PYME-1GB', 'Coordinacion Prueba Instala', true, '41999777');
  select count(*) into s1 from public.aliado_sin_permiso;
  res := res || jsonb_build_object('etiqueta_tras_orden', e1, 'sin_permiso_nuevas', s1 - s0);
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  pag := public.aliados_pagos();
  res := res || jsonb_build_object('en_pagos', exists (select 1 from jsonb_array_elements(pag->'instalaciones') x where (x->>'id')::bigint = sid));
  perform public.pago_marcar('instalacion', sid);
  res := res || jsonb_build_object('pagada', (select pagada_en is not null from public.aliado_solicitudes where id = sid));
  select jsonb_build_object('filas', count(*), 'cumplen', count(*) filter (where cumple)) into sep from privado.comision_filas3('2026-09-01');
  raise exception 'RESULTADO %', res || jsonb_build_object('septiembre', sep);
end $f$;
select privado.prueba_tmp();
