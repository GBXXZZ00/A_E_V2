-- Lote 05/11 parte F: dedicado registrado a mano y VGT por solicitud (aplicada con el conector)
alter table public.dedicados add column if not exists a_mano_en timestamptz;
alter table public.dedicados add column if not exists a_mano_por uuid;
alter table public.dedicados add column if not exists servicio_texto text;

-- "Aún no está en el TAD": registrado a mano y sin servicios del TAD ni enlaces de la analista
create or replace function privado.ded_sin_tad(p bigint) returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.dedicados d where d.cliente_id = p and d.a_mano_en is not null)
     and not exists (select 1 from public.servicios s where s.cliente_id = p)
     and not exists (select 1 from public.dedicado_enlaces e where e.cliente_id = p)
$$;

create or replace function public.dedicado_registro_datos(p_rif text) returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare v_rol text := privado.exigir('admin', 'analista', 'lider'); v_num text := privado.rif_num(p_rif); k public.clientes;
begin
  if v_num is not null and v_num ~ '^[1-9][0-9]{4,9}$' then
    select * into k from public.clientes where doc_numero = v_num;
    if k.unido_a is not null then select * into k from public.clientes where id = k.unido_a; end if;
  end if;
  return jsonb_build_object(
    'existe', case when k.id is null then null else jsonb_build_object('id', k.id, 'nombre', case when privado.puede_cliente(k.id) then k.nombre end, 'puedo', privado.puede_cliente(k.id),
      'lider', coalesce(privado.nombre_de(k.lider_id), k.lider_nombre)) end,
    'lideres', case when v_rol = 'lider' then '[]'::jsonb else (select coalesce(jsonb_agg(jsonb_build_object('id', pf.id, 'nombre', pf.nombre) order by pf.nombre), '[]'::jsonb)
      from public.perfiles pf where pf.activo and pf.rol = 'lider') end);
end $$;

create or replace function public.dedicado_registrar(p_rif text, p_nombre text, p_tipo text, p_lider uuid, p_servicio text default null) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare v_rol text := privado.exigir('admin', 'analista', 'lider'); yo uuid := (select auth.uid()); v_tipo text := coalesce(privado.rif_letra(p_rif), 'J'); v_num text := privado.rif_num(p_rif);
  v_nom text := left(btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g')), 200); v_lid uuid; v_lnom text; v_id bigint; v_srv text := left(nullif(btrim(coalesce(p_servicio, '')), ''), 200);
begin
  if v_num is null or v_num !~ '^[1-9][0-9]{4,9}$' then raise exception 'Escribe un RIF válido' using errcode = 'P0001'; end if;
  if v_tipo in ('V', 'E') then raise exception 'Un dedicado es una empresa: escribe el RIF que empieza por J, G o C' using errcode = 'P0001'; end if;
  if length(v_nom) < 3 then raise exception 'Escribe la razón social' using errcode = 'P0001'; end if;
  if p_tipo is null or p_tipo not in ('isp', 'corporativo') then raise exception 'Elige si es ISP o corporativo' using errcode = 'P0001'; end if;
  if exists (select 1 from public.clientes where doc_numero = v_num) then raise exception 'Ese RIF ya existe en la app. Ábrelo desde el aviso' using errcode = 'P0001'; end if;
  v_lid := case when v_rol = 'lider' then yo else p_lider end;
  select pf.nombre into v_lnom from public.perfiles pf where pf.id = v_lid and pf.activo and pf.rol = 'lider';
  if v_lnom is null then raise exception 'Elige el líder' using errcode = 'P0001'; end if;
  insert into public.clientes (doc_tipo, doc_numero, nombre, es_natural, lider_id, lider_nombre, estatus, estatus_desde, es_isp)
  values (v_tipo, v_num, v_nom, false, v_lid, v_lnom, 'documentos_pendientes', now(), p_tipo = 'isp') returning id into v_id;
  insert into public.dedicados (cliente_id, tipo, ejecutiva_id, ejecutiva_nombre, activo, a_mano_en, a_mano_por, servicio_texto)
  values (v_id, p_tipo, v_lid, v_lnom, true, now(), yo, v_srv);
  insert into public.hilo (cliente_id, tipo, texto, detalle, autor_id) values (v_id, 'dato', 'dedicado_registrado', jsonb_build_object('rif', v_tipo || '-' || v_num, 'nombre', v_nom, 'tipo', p_tipo, 'lider', v_lnom, 'servicio', v_srv), yo);
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues) values (yo, 'dedicado_registrado', 'clientes', v_id::text,
    jsonb_build_object('rif', v_tipo || '-' || v_num, 'nombre', v_nom, 'tipo', p_tipo, 'lider', v_lnom, 'servicio', v_srv));
  perform privado.recalcular(v_id, yo);
  return jsonb_build_object('cliente_id', v_id, 'nombre', v_nom);
end $$;

-- ---------- VGT por solicitud ----------
create table if not exists public.vgt_documentos (
  id bigserial primary key,
  contrato_id bigint not null references public.dedicado_contratos(id),
  cliente_id bigint not null references public.clientes(id),
  numero int not null check (numero between 200 and 999),
  tipo text not null check (tipo in ('propuesta', 'planilla')),
  creado_por uuid, creado_en timestamptz not null default now(),
  unique (cliente_id, numero));
create index if not exists vgt_documentos_contrato on public.vgt_documentos (contrato_id);
alter table public.vgt_documentos enable row level security;
create policy vgt_documentos_ver on public.vgt_documentos for select to authenticated using (privado.puede_cliente(cliente_id));

create or replace function privado.vgt_doc_ok(p_cliente bigint, p_numero int) returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.documentos d join public.documento_archivos da on da.documento_id = d.id and da.vigente
    where d.cliente_id = p_cliente and d.casilla = 'otro' and d.numero = p_numero and d.estado <> 'devuelto')
$$;
-- Una solicitud pide documentos si está en uso o en proyecto, no está negada ni ya firmada
create or replace function privado.vgt_sol_pide(k bigint) returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.dedicado_contratos c where c.id = k and c.tipo = 'vgt' and c.negada_en is null
    and upper(btrim(coalesce(c.en_uso, ''))) in ('SI', 'SÍ', 'EN PROYECTO') and c.estatus not in ('firmado', 'del_cliente'))
$$;
create or replace function privado.vgt_sol_req(k bigint) returns int language sql stable security definer set search_path to '' as $$
  select (case when exists (select 1 from public.vgt_documentos v where v.contrato_id = k and v.tipo = 'propuesta' and privado.vgt_doc_ok(v.cliente_id, v.numero)) then 0 else 1 end)
       + (case when exists (select 1 from public.vgt_documentos v where v.contrato_id = k and v.tipo = 'planilla' and privado.vgt_doc_ok(v.cliente_id, v.numero)) then 0 else 1 end)
$$;
create or replace function privado.vgt_polizas_faltan(p bigint) returns int language sql stable security definer set search_path to '' as $$
  select count(*)::int from privado.vgt_requisitos() r where r.requerido and not privado.vgt_doc_ok(p, r.numero)
$$;
-- La propuesta comercial ya no se pide a nivel de cliente: va por solicitud (la 68 queda como historial)
create or replace function privado.vgt_requisitos() returns table(numero integer, clave text, texto text, requerido boolean, vence boolean) language sql immutable set search_path to '' as $$
  values (66, 'poliza_rc', 'Póliza de responsabilidad civil general', true, true),
         (67, 'poliza_patronal', 'Póliza de responsabilidad patronal', true, true),
         (68, 'propuesta', 'Propuesta comercial (subida antes de las solicitudes)', false, false)
$$;
create or replace function privado.vgt_faltan(p bigint) returns integer language sql stable security definer set search_path to '' as $$
  select case when not privado.tiene_vgt(p) then 0 else privado.vgt_polizas_faltan(p)
    + coalesce((select sum(privado.vgt_sol_req(k.id))::int from public.dedicado_contratos k where k.cliente_id = p and k.tipo = 'vgt' and privado.vgt_sol_pide(k.id)), 0) end
$$;
create or replace function privado.vgt_json(p bigint) returns jsonb language sql stable security definer set search_path to '' as $$
  select case when not privado.tiene_vgt(p) then null else jsonb_build_object(
    'correo', (select dd.vgt_correo from public.dedicados dd where dd.cliente_id = p),
    'faltan', privado.vgt_faltan(p), 'polizas_faltan', privado.vgt_polizas_faltan(p),
    'requisitos', (select jsonb_agg(jsonb_build_object('numero', r.numero, 'clave', r.clave, 'texto', r.texto, 'requerido', r.requerido, 'vence', r.vence) order by r.numero) from privado.vgt_requisitos() r),
    'polizas', (select coalesce(jsonb_agg(jsonb_build_object('numero', d.numero, 'vence_en', d.vence_en) order by d.numero), '[]'::jsonb)
                from public.documentos d where d.cliente_id = p and d.casilla = 'otro' and d.numero in (66, 67)),
    'solicitudes', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'proyecto', k.proyecto, 'postes', k.postes, 'fecha', k.fecha_texto, 'en_uso', k.en_uso, 'estatus', k.estatus,
        'odt', k.odt, 'negada', k.negada_en is not null or upper(btrim(coalesce(k.en_uso, ''))) = 'NEGADA', 'pide', privado.vgt_sol_pide(k.id), 'faltan', case when privado.vgt_sol_pide(k.id) then privado.vgt_sol_req(k.id) else 0 end,
        'docs', (select coalesce(jsonb_agg(jsonb_build_object('numero', v.numero, 'tipo', v.tipo, 'ok', privado.vgt_doc_ok(p, v.numero),
            'id', d.id, 'estado', d.estado, 'subido_en', d.subido_en, 'firmado_en', d.firmado_en) order by v.tipo desc, v.numero), '[]'::jsonb)
          from public.vgt_documentos v left join public.documentos d on d.cliente_id = p and d.casilla = 'otro' and d.numero = v.numero where v.contrato_id = k.id))
        order by k.id), '[]'::jsonb) from public.dedicado_contratos k where k.cliente_id = p and k.tipo = 'vgt')) end
$$;

-- La casilla (número de documento) de una propuesta o planilla de una solicitud
create or replace function public.vgt_casilla(p_contrato bigint, p_tipo text, p_otra boolean default false) returns int language plpgsql security definer set search_path to '' as $$
declare k public.dedicado_contratos; v_num int; yo uuid := (select auth.uid());
begin
  select * into k from public.dedicado_contratos where id = p_contrato and tipo = 'vgt';
  if k.id is null then raise exception 'Esa solicitud de VGT no existe' using errcode = 'P0001'; end if;
  perform privado.exigir_cliente(k.cliente_id);
  if p_tipo is null or p_tipo not in ('propuesta', 'planilla') then raise exception 'Documento no reconocido' using errcode = 'P0001'; end if;
  if not coalesce(p_otra, false) or p_tipo = 'propuesta' then
    -- La propuesta es una sola; una planilla reusa la casilla que nunca se llegó a subir
    select v.numero into v_num from public.vgt_documentos v where v.contrato_id = k.id and v.tipo = p_tipo
      and (p_tipo = 'propuesta' or not exists (select 1 from public.documentos d where d.cliente_id = k.cliente_id and d.casilla = 'otro' and d.numero = v.numero))
    order by v.numero limit 1;
    if v_num is null and p_tipo = 'planilla' and not coalesce(p_otra, false) then
      select v.numero into v_num from public.vgt_documentos v where v.contrato_id = k.id and v.tipo = 'planilla' order by v.numero limit 1;
    end if;
  end if;
  if v_num is null then
    perform pg_advisory_xact_lock(k.cliente_id);
    select greatest(199, coalesce(max(v.numero), 199)) + 1 into v_num from public.vgt_documentos v where v.cliente_id = k.cliente_id;
    if v_num > 999 then raise exception 'Este cliente tiene demasiados documentos de VGT' using errcode = 'P0001'; end if;
    insert into public.vgt_documentos (contrato_id, cliente_id, numero, tipo, creado_por) values (k.id, k.cliente_id, v_num, p_tipo, yo);
  end if;
  return v_num;
end $$;

create or replace function public.vgt_solicitud_nueva(p_cliente bigint, p_proyecto text, p_postes int, p_fecha date default null) returns bigint language plpgsql security definer set search_path to '' as $$
declare yo uuid := (select auth.uid()); v_id bigint; v_pro text := left(btrim(regexp_replace(coalesce(p_proyecto, ''), '\s+', ' ', 'g')), 120);
begin
  perform privado.exigir_cliente(p_cliente);
  perform privado.exigir('admin', 'abogado', 'lider', 'analista');
  if not exists (select 1 from public.dedicados d where d.cliente_id = p_cliente and d.excluido_en is null) then raise exception 'Este cliente no es dedicado' using errcode = 'P0001'; end if;
  if length(v_pro) < 3 then raise exception 'Escribe el nombre del proyecto o del tramo' using errcode = 'P0001'; end if;
  if p_postes is not null and (p_postes < 1 or p_postes > 5000) then raise exception 'Revisa el número de postes' using errcode = 'P0001'; end if;
  if p_fecha is not null and p_fecha > (now() at time zone 'America/Caracas')::date then raise exception 'La fecha de solicitud no puede ser futura' using errcode = 'P0001'; end if;
  insert into public.dedicado_contratos (cliente_id, clave, tipo, estatus, proyecto, postes, en_uso, fecha_texto, editado_por, editado_en)
  values (p_cliente, 'v:' || p_cliente || ':app:' || replace(gen_random_uuid()::text, '-', ''), 'vgt', 'sin_contrato', v_pro, p_postes, 'EN PROYECTO',
    to_char(coalesce(p_fecha, (now() at time zone 'America/Caracas')::date), 'DD/MM/YYYY'), yo, now()) returning id into v_id;
  insert into public.hilo (cliente_id, tipo, texto, detalle, autor_id) values (p_cliente, 'dato', 'vgt_solicitud', jsonb_build_object('proyecto', v_pro, 'postes', p_postes), yo);
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues) values (yo, 'vgt_solicitud_nueva', 'dedicado_contratos', v_id::text, jsonb_build_object('cliente', p_cliente, 'proyecto', v_pro, 'postes', p_postes, 'fecha', p_fecha));
  return v_id;
end $$;

select privado.reemplazar_en_funcion('public.documentos_registrar(bigint,jsonb)'::regprocedure,
  E'        else\n          select coalesce(max(numero), 0) + 1 into num',
  E'        elsif num between 200 and 999 then\n          if not exists (select 1 from public.vgt_documentos v where v.cliente_id = p_cliente and v.numero = num) then raise exception ''Esa casilla de VGT no existe'' using errcode = ''P0001''; end if;\n        else\n          select coalesce(max(numero), 0) + 1 into num');
select privado.reemplazar_en_funcion('public.dedicado_contrato_editar(bigint,jsonb)'::regprocedure,
  E'privado.vgt_faltan(a.cliente_id) > 0 then\n    raise exception ''Faltan % de los requisitos VGT. El contrato VGT no pasa a Por firmar hasta completarlos'', privado.vgt_faltan(a.cliente_id)',
  E'(privado.vgt_polizas_faltan(a.cliente_id) + privado.vgt_sol_req(a.id)) > 0 then\n    raise exception ''Faltan % de los requisitos VGT de esta solicitud (pólizas, propuesta y planilla). El contrato VGT no pasa a Por firmar hasta completarlos'', privado.vgt_polizas_faltan(a.cliente_id) + privado.vgt_sol_req(a.id)');
select privado.reemplazar_en_funcion('public.clientes_lista3(text,text,integer,integer,jsonb)'::regprocedure,
  E'''no_aparece_tad'', p.no_aparece_tad_en is not null,',
  E'''no_aparece_tad'', p.no_aparece_tad_en is not null, ''sin_tad'', privado.ded_sin_tad(p.id),');
select privado.reemplazar_en_funcion('privado.dedicado_json(bigint)'::regprocedure,
  E'''plazo'', d.plazo_documentos,',
  E'''plazo'', d.plazo_documentos, ''sin_tad'', privado.ded_sin_tad(p), ''a_mano_en'', d.a_mano_en, ''servicio_texto'', d.servicio_texto,');
-- El abogado ve cada solicitud lista en "Por elaborar · VGT"
select privado.reemplazar_en_funcion('privado.trabajo_items(uuid,text,uuid,uuid)'::regprocedure,
  E'where z.estado = ''abierto'' and k.unido_a is null),',
  E'where z.estado = ''abierto'' and k.unido_a is null\n    union all\n    select ''elaborar_vgt''::text, kk.id::text, kk.cliente_id, c.nombre, ''VGT · '' || coalesce(kk.proyecto, ''Solicitud '' || kk.id) || coalesce('' · '' || kk.postes || '' postes'', ''''),\n      coalesce(dd.ejecutiva_id, c.lider_id), null::uuid, ''abogado''::text, kk.actualizado_en, (kk.actualizado_en at time zone ''America/Caracas'')::date + 3, jsonb_build_object(''contrato'', kk.id)\n    from public.dedicado_contratos kk join public.clientes c on c.id = kk.cliente_id left join public.dedicados dd on dd.cliente_id = c.id\n    where kk.tipo = ''vgt'' and kk.estatus in (''sin_contrato'', ''en_elaboracion'') and c.unido_a is null and privado.vgt_sol_pide(kk.id)\n      and privado.vgt_sol_req(kk.id) = 0 and privado.vgt_polizas_faltan(kk.cliente_id) = 0),');
create or replace function privado.modulo_de(p_tipo text) returns text language sql immutable set search_path to '' as $$
  select case
    when p_tipo in ('docs_faltan', 'devuelto', 'por_firmar', 'sin_gestion', 'rif_verificar', 'pedido') then 'expedientes'
    when p_tipo in ('por_instalar', 'por_enviar', 'sin_ip', 'ip_confirmar', 'por_asignar', 'certificar', 'sin_cliente', 'sin_servicio', 'orden_atrasada', 'ordenes_atrasadas') then 'comisiones'
    when p_tipo in ('cambio_emitir', 'sin_registro', 'cambio_revisar', 'planilla') then 'migraciones'
    when p_tipo in ('vgt', 'poliza', 'elaborar_vgt') then 'dedicados'
    when p_tipo in ('referido') then 'aliados'
    else 'otros' end
$$;
grant execute on function public.dedicado_registro_datos(text), public.dedicado_registrar(text,text,text,uuid,text), public.vgt_casilla(bigint,text,boolean), public.vgt_solicitud_nueva(bigint,text,integer,date) to authenticated;
revoke execute on function public.dedicado_registro_datos(text), public.dedicado_registrar(text,text,text,uuid,text), public.vgt_casilla(bigint,text,boolean), public.vgt_solicitud_nueva(bigint,text,integer,date) from anon, public;
-- Lote 05/11 parte F (2): documentos.numero solo admite 0..99, así que las casillas de cada solicitud VGT usan 71-79 y 82-99.
-- La tabla vgt_documentos (rango 200-999) quedó vacía y sin uso; se reemplaza por vgt_solicitud_docs.
create table if not exists public.vgt_solicitud_docs (
  id bigserial primary key,
  contrato_id bigint not null references public.dedicado_contratos(id),
  cliente_id bigint not null references public.clientes(id),
  numero int not null check (numero between 71 and 79 or numero between 82 and 99),
  tipo text not null check (tipo in ('propuesta', 'planilla')),
  creado_por uuid, creado_en timestamptz not null default now(),
  unique (cliente_id, numero));
create index if not exists vgt_solicitud_docs_contrato on public.vgt_solicitud_docs (contrato_id);
alter table public.vgt_solicitud_docs enable row level security;
create policy vgt_solicitud_docs_ver on public.vgt_solicitud_docs for select to authenticated using (privado.puede_cliente(cliente_id));
revoke all on public.vgt_documentos from anon, authenticated;

create or replace function privado.vgt_sol_req(k bigint) returns int language sql stable security definer set search_path to '' as $$
  select (case when exists (select 1 from public.vgt_solicitud_docs v where v.contrato_id = k and v.tipo = 'propuesta' and privado.vgt_doc_ok(v.cliente_id, v.numero)) then 0 else 1 end)
       + (case when exists (select 1 from public.vgt_solicitud_docs v where v.contrato_id = k and v.tipo = 'planilla' and privado.vgt_doc_ok(v.cliente_id, v.numero)) then 0 else 1 end)
$$;
create or replace function privado.vgt_json(p bigint) returns jsonb language sql stable security definer set search_path to '' as $$
  select case when not privado.tiene_vgt(p) then null else jsonb_build_object(
    'correo', (select dd.vgt_correo from public.dedicados dd where dd.cliente_id = p),
    'faltan', privado.vgt_faltan(p), 'polizas_faltan', privado.vgt_polizas_faltan(p),
    'requisitos', (select jsonb_agg(jsonb_build_object('numero', r.numero, 'clave', r.clave, 'texto', r.texto, 'requerido', r.requerido, 'vence', r.vence) order by r.numero) from privado.vgt_requisitos() r),
    'polizas', (select coalesce(jsonb_agg(jsonb_build_object('numero', d.numero, 'vence_en', d.vence_en) order by d.numero), '[]'::jsonb)
                from public.documentos d where d.cliente_id = p and d.casilla = 'otro' and d.numero in (66, 67)),
    'solicitudes', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'proyecto', k.proyecto, 'postes', k.postes, 'fecha', k.fecha_texto, 'en_uso', k.en_uso, 'estatus', k.estatus,
        'odt', k.odt, 'negada', k.negada_en is not null or upper(btrim(coalesce(k.en_uso, ''))) = 'NEGADA', 'pide', privado.vgt_sol_pide(k.id), 'faltan', case when privado.vgt_sol_pide(k.id) then privado.vgt_sol_req(k.id) else 0 end,
        'docs', (select coalesce(jsonb_agg(jsonb_build_object('numero', v.numero, 'tipo', v.tipo, 'ok', privado.vgt_doc_ok(p, v.numero),
            'id', d.id, 'estado', d.estado, 'subido_en', d.subido_en, 'firmado_en', d.firmado_en) order by v.tipo desc, v.id), '[]'::jsonb)
          from public.vgt_solicitud_docs v left join public.documentos d on d.cliente_id = p and d.casilla = 'otro' and d.numero = v.numero where v.contrato_id = k.id))
        order by k.id), '[]'::jsonb) from public.dedicado_contratos k where k.cliente_id = p and k.tipo = 'vgt')) end
$$;
create or replace function public.vgt_casilla(p_contrato bigint, p_tipo text, p_otra boolean default false) returns int language plpgsql security definer set search_path to '' as $$
declare k public.dedicado_contratos; v_num int; yo uuid := (select auth.uid());
begin
  select * into k from public.dedicado_contratos where id = p_contrato and tipo = 'vgt';
  if k.id is null then raise exception 'Esa solicitud de VGT no existe' using errcode = 'P0001'; end if;
  perform privado.exigir_cliente(k.cliente_id);
  if p_tipo is null or p_tipo not in ('propuesta', 'planilla') then raise exception 'Documento no reconocido' using errcode = 'P0001'; end if;
  if not coalesce(p_otra, false) or p_tipo = 'propuesta' then
    -- La propuesta es una sola; una planilla reusa la casilla que nunca se llegó a subir
    select v.numero into v_num from public.vgt_solicitud_docs v where v.contrato_id = k.id and v.tipo = p_tipo
      and (p_tipo = 'propuesta' or not exists (select 1 from public.documentos d where d.cliente_id = k.cliente_id and d.casilla = 'otro' and d.numero = v.numero))
    order by v.id limit 1;
    if v_num is null and p_tipo = 'planilla' and not coalesce(p_otra, false) then
      select v.numero into v_num from public.vgt_solicitud_docs v where v.contrato_id = k.id and v.tipo = 'planilla' order by v.id limit 1;
    end if;
  end if;
  if v_num is null then
    perform pg_advisory_xact_lock(k.cliente_id);
    select g into v_num from (select generate_series(71, 79) g union all select generate_series(82, 99)) s
    where not exists (select 1 from public.vgt_solicitud_docs v where v.cliente_id = k.cliente_id and v.numero = s.g)
      and not exists (select 1 from public.documentos d where d.cliente_id = k.cliente_id and d.casilla = 'otro' and d.numero = s.g)
    order by g limit 1;
    if v_num is null then raise exception 'Este cliente ya usa todas las casillas de VGT. Avísale al administrador' using errcode = 'P0001'; end if;
    insert into public.vgt_solicitud_docs (contrato_id, cliente_id, numero, tipo, creado_por) values (k.id, k.cliente_id, v_num, p_tipo, yo);
  end if;
  return v_num;
end $$;
select privado.reemplazar_en_funcion('public.documentos_registrar(bigint,jsonb)'::regprocedure,
  E'        elsif num between 200 and 999 then\n          if not exists (select 1 from public.vgt_documentos v where v.cliente_id = p_cliente and v.numero = num)',
  E'        elsif num between 71 and 79 or num between 82 and 99 then\n          if not exists (select 1 from public.vgt_solicitud_docs v where v.cliente_id = p_cliente and v.numero = num)');

-- Evidencia (06/11, con vuelta atrás por raise exception):
-- dedicado_registrar: crea cliente J con estatus documentos_pendientes, es_isp, dedicados.a_mano_en; RIF repetido -> "Ese RIF ya existe en la app"; bitácora 2 filas (registro y solicitud).
-- vgt_casilla: propuesta 71, planilla 72, otra planilla 73; repetir propuesta -> 71; planilla sin subir se reusa (73).
-- Con pólizas 66/67 y propuesta y planilla subidas: vgt_faltan 0, la solicitud sale al abogado (elaborar_vgt = 1) y pasa a por_firmar.
-- Sin ellas: "Faltan 4 de los requisitos VGT de esta solicitud" y no pasa.
-- clientes_lista3 devuelve sin_tad = true para el registrado a mano.
-- Comisiones iguales: septiembre 46/41, octubre 83/75, noviembre 47/4.
