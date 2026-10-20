-- Lote 21/10, partes 1 y 2 (tanda A): hoja de comisión rehecha y reglas de pago con el TAD.
-- Aplicado con el conector (migración lote_21oct_comisiones). Septiembre vivo 46/41 y octubre 68/49 antes y después.

-- ---------- Columnas ----------
alter table public.instalaciones add column if not exists anulada_motivo text;
alter table public.instalaciones add column if not exists anulada_por uuid references public.perfiles(id);
alter table public.instalaciones add column if not exists pago_nota text;
alter table public.instalaciones add column if not exists correccion text check (correccion in ('no_se_pago', 'se_pago'));
alter table public.instalaciones add column if not exists correccion_motivo text;
alter table public.instalaciones add column if not exists correccion_por uuid references public.perfiles(id);
alter table public.instalaciones add column if not exists correccion_en timestamptz;
insert into privado.ia_ajustes (clave, valor) values ('pago_dias_tad', '3') on conflict (clave) do nothing;

-- ---------- Ayudas ----------
create or replace function privado.rol_actual() returns text language sql stable security definer set search_path to '' as $$
  select p.rol from public.perfiles p where p.id = (select auth.uid()) and p.activo
$$;
-- El corte certificado en cuya foto está la instalación (null si no está en ninguna)
create or replace function privado.en_foto(p_inst bigint) returns date language sql stable security definer set search_path to '' as $$
  select k.corte from public.cortes_certificados k cross join lateral jsonb_array_elements(k.filas) e
  where k.anulado_en is null and (e->>'instalacion_id')::bigint = p_inst order by k.corte limit 1
$$;
-- Días mínimos entre la instalación y el TAD que da el pago (la cuenta por cobrar se genera después de instalar)
create or replace function privado.pago_dias_tad() returns int language sql stable security definer set search_path to '' as $$
  select coalesce((select nullif(regexp_replace(a.valor, '\D', '', 'g'), '')::int from privado.ia_ajustes a where a.clave = 'pago_dias_tad'), 3)
$$;
-- Por qué hay que revisar el pago a mano (null: no hace falta)
create or replace function privado.revisar_pago(p_inst bigint) returns text language sql stable security definer set search_path to '' as $$
  select case
    when i.pago_ok_en is not null or i.cliente_id is null then null
    -- Instalada del 20 al 31: el TAD del mes siguiente trae la factura nueva del mes; esa deuda no es la instalación
    when extract(day from (i.instalada_en at time zone 'America/Caracas')) >= 20 and exists (
      select 1 from public.servicios s join public.cargas g on g.id = s.visto_en_carga
      where s.cliente_id = i.cliente_id and s.con_deuda
        and (g.subido_en at time zone 'America/Caracas')::date >= (date_trunc('month', (i.instalada_en at time zone 'America/Caracas')) + interval '1 month')::date) then 'factura_mes'
    -- Más de un servicio en el RIF (también residenciales, con el TAD completo): el TAD no puede decidir
    when (select count(*) from public.servicios s where s.cliente_id = i.cliente_id) > 1
      or (select count(*) from public.tad_indice t where t.carga = privado.tad_indice_vigente() and t.doc_numero = c.doc_numero) > 1 then 'varios_servicios'
  end
  from public.instalaciones i left join public.clientes c on c.id = i.cliente_id where i.id = p_inst
$$;

-- ---------- Pago fijo: un pago dado (por el TAD o a mano) no lo quita ni lo cambia ningún proceso, salvo "Quitar pago" ----------
CREATE OR REPLACE FUNCTION privado.pago_respetar()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $function$
begin
  -- Quitado a mano: el TAD no lo vuelve a marcar
  if old.pago_quitado and new.pago_quitado and old.pago_ok_en is null and new.pago_ok_en is not null then new.pago_ok_en := null; end if;
  -- Dado una vez (TAD o a mano): queda con su fecha, salvo que se quite a mano
  if old.pago_ok_en is not null and not coalesce(new.pago_quitado, false) then new.pago_ok_en := old.pago_ok_en; end if;
  return new;
end $function$;

-- ---------- El TAD da el pago solo si se cargó al menos N días después de instalar ----------
select privado.reemplazar_en_funcion('public.tad_cerrar(bigint)'::regprocedure,
  'and s.visto_en_carga=p_carga and s.con_deuda is false);',
  'and s.visto_en_carga=p_carga and s.con_deuda is false)
    and (i.instalada_en at time zone ''America/Caracas'')::date + privado.pago_dias_tad() <= privado.hoy();');
select privado.reemplazar_en_funcion('privado.cruzar(uuid)'::regprocedure,
  'and s.visto_en_carga = v_t and s.con_deuda is false);',
  'and s.visto_en_carga = v_t and s.con_deuda is false)
      and (x.instalada_en at time zone ''America/Caracas'')::date + privado.pago_dias_tad() <= privado.hoy();');

-- ---------- Revisar pago en las filas: la regla nueva (no cambia quién cumple) ----------
select privado.reemplazar_en_funcion('privado.comision_filas3(date)'::regprocedure,
  '(i.pago_ok_en is null and (select count(*) from public.servicios s where s.cliente_id = i.cliente_id) > 1) as rev,',
  '(privado.revisar_pago(i.id) is not null) as rev,');

-- Datos extra de la fila: por qué revisar el pago, corrección del certificado
CREATE OR REPLACE FUNCTION privado.fila_extras(p_inst bigint, p_cliente bigint)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'motivo', privado.cruce_motivo(i.id),
    'por_subir', coalesce(privado.archivos_por_subir(p_cliente), false), 'aprobado_por_subir', coalesce(privado.aprobado_por_subir(p_cliente), false),
    'bienvenida_en', (select max(e.en) from public.envios e where e.tipo = 'bienvenida' and (e.instalacion_id = i.id or (i.servicio_id is not null and e.servicio_id = i.servicio_id))),
    'sin_ip', (i.servicio_id is not null and not exists (select 1 from public.servicios s where s.id = i.servicio_id and (s.ip is not null or s.ip6 is not null))),
    'servicio_id', i.servicio_id, 'es_evento', i.es_evento,
    'movida', i.corte_manual is not null, 'movida_motivo', i.corte_manual_motivo,
    'revisar_motivo', privado.revisar_pago(i.id), 'correccion', i.correccion)
  from public.instalaciones i where i.id = p_inst
$function$;

-- ---------- Ficha: lo que necesita la hoja de comisión ----------
select privado.reemplazar_en_funcion('public.cliente_ficha(bigint)'::regprocedure,
  '''movida'', i.corte_manual is not null, ''movida_motivo'', i.corte_manual_motivo,',
  '''movida'', i.corte_manual is not null, ''movida_motivo'', i.corte_manual_motivo, ''anulada'', i.anulada_en is not null, ''anulada_motivo'', i.anulada_motivo, ''anulada_por'', privado.nombre_de(i.anulada_por), ''anulada_en'', i.anulada_en, ''pago_nota'', i.pago_nota, ''correccion'', i.correccion, ''correccion_motivo'', i.correccion_motivo, ''en_foto'', privado.en_foto(i.id), ''revisar_motivo'', privado.revisar_pago(i.id), ''tad_deuda'', (select s.con_deuda from public.servicios s where s.id = i.servicio_id), ''tad_visto'', (select g.subido_en from public.servicios s join public.cargas g on g.id = s.visto_en_carga where s.id = i.servicio_id), ''pago_dias'', privado.pago_dias_tad(),');
select privado.reemplazar_en_funcion('public.cliente_ficha(bigint)'::regprocedure,
  '''estado'', case when not k.com then ''no_comisiona''',
  '''estado'', case when i.anulada_en is not null then ''anulada'' when not k.com then ''no_comisiona''');

-- ---------- Comisiones: bandejas "No comisionan" y "Fuera de la foto", y permisos ----------
select privado.reemplazar_en_funcion('public.comisiones_corte(date)'::regprocedure,
  '''filas'', filas, ''por_instalar'', pinst,',
  '''filas'', filas,
    ''no_comisionan'', (select coalesce(jsonb_agg(jsonb_build_object(''instalacion_id'', i.id, ''cliente_id'', i.cliente_id, ''nombre'', coalesce(cl3.nombre, i.nombre), ''codigo'', i.codigo,
        ''instalada_en'', i.instalada_en, ''motivo'', i.anulada_motivo, ''por'', privado.nombre_de(i.anulada_por), ''en'', i.anulada_en) order by i.anulada_en desc), ''[]''::jsonb)
      from public.instalaciones i left join public.clientes cl3 on cl3.id = i.cliente_id
      where i.anulada_en is not null and i.anulada_motivo is not null
        and coalesce(i.corte_manual, privado.corte_de((i.instalada_en at time zone ''America/Caracas'')::date)) = c
        and (v_rol <> ''lider'' or i.lider_id = v_yo or cl3.lider_id = v_yo)),
    ''fuera_foto'', case when cert.id is not null and v_rol = ''admin'' then (select coalesce(jsonb_agg(jsonb_build_object(''instalacion_id'', i.id, ''cliente_id'', i.cliente_id, ''nombre'', coalesce(cl4.nombre, i.nombre),
        ''codigo'', i.codigo, ''instalada_en'', i.instalada_en, ''motivo'', privado.cruce_motivo(i.id), ''evento'', i.es_evento, ''lider'', coalesce(privado.nombre_de(i.lider_id), i.lider_nombre, ''Por asignar'')) order by i.instalada_en), ''[]''::jsonb)
      from public.instalaciones i left join public.clientes cl4 on cl4.id = i.cliente_id
      where i.anulada_en is null and privado.comisionable(i.categoria, i.es_aliado)
        and coalesce(i.corte_manual, privado.corte_de((i.instalada_en at time zone ''America/Caracas'')::date)) = c
        and not exists (select 1 from jsonb_array_elements(cert.filas) e where (e->>''instalacion_id'')::bigint = i.id)) end,
    ''por_instalar'', pinst,');
select privado.reemplazar_en_funcion('public.comisiones_corte(date)'::regprocedure,
  '''quitar_certificado'',',
  '''no_comisiona'', v_senior, ''reactivar'', v_rol = ''admin'', ''corregir'', v_rol = ''admin'' and cert.id is not null, ''pago_dias'', v_rol = ''admin'', ''quitar_certificado'',');

-- ---------- Evento: el administrador puede marcarlo en una instalación de un corte certificado que no quedó en su foto ----------
select privado.reemplazar_en_funcion('public.instalacion_evento(bigint,boolean,boolean)'::regprocedure,
  '    raise exception ''Ese corte ya está certificado'' using errcode = ''P0001'';',
  '    if privado.en_foto(i.id) is not null or coalesce(privado.rol_actual(), '''') <> ''admin'' then raise exception ''Ese corte ya está certificado'' using errcode = ''P0001''; end if;');

-- ---------- No comisiona: anula con motivo (Analista Senior o administrador); solo el administrador la reactiva ----------
create or replace function public.instalacion_no_comisiona(p_instalacion bigint, p_si boolean, p_motivo text) returns void
language plpgsql security definer set search_path to '' as $$
#variable_conflict use_variable
declare v_yo uuid := privado.exigir_senior(); i public.instalaciones; m text := btrim(coalesce(p_motivo, ''));
begin
  select * into i from public.instalaciones x where x.id = p_instalacion;
  if i.id is null then raise exception 'No se encontró la instalación' using errcode = 'P0001'; end if;
  if p_si then
    if i.anulada_en is not null then raise exception 'Ya no comisiona' using errcode = 'P0001'; end if;
    if length(m) < 5 then raise exception 'Escribe el motivo' using errcode = 'P0001'; end if;
    if privado.en_foto(i.id) is not null then raise exception 'Está en un corte certificado: usa Corregir certificado' using errcode = 'P0001'; end if;
    update public.instalaciones x set anulada_en = now(), anulada_motivo = left(m, 500), anulada_por = v_yo where x.id = i.id;
    insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues)
    values (v_yo, 'instalacion_no_comisiona', 'instalaciones', i.id::text, null, jsonb_build_object('motivo', left(m, 500)));
  else
    if coalesce(privado.rol_actual(), '') <> 'admin' then raise exception 'Solo el administrador la vuelve a activar' using errcode = 'P0001'; end if;
    if i.anulada_en is null or i.anulada_motivo is null then raise exception 'Esta instalación no se marcó como No comisiona' using errcode = 'P0001'; end if;
    update public.instalaciones x set anulada_en = null, anulada_motivo = null, anulada_por = null where x.id = i.id;
    insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues)
    values (v_yo, 'instalacion_reactivada', 'instalaciones', i.id::text, jsonb_build_object('motivo', i.anulada_motivo), jsonb_build_object('nota', nullif(left(m, 500), '')));
  end if;
end $$;
revoke all on function public.instalacion_no_comisiona(bigint, boolean, text) from public, anon;
grant execute on function public.instalacion_no_comisiona(bigint, boolean, text) to authenticated;

-- ---------- Corregir un corte certificado (solo administrador): la foto no cambia ----------
-- no_se_pago: pasa al corte abierto. se_pago: queda pagada en el certificado (como excepción de ese corte).
create or replace function public.instalacion_corregir_certificado(p_instalacion bigint, p_accion text, p_motivo text) returns jsonb
language plpgsql security definer set search_path to '' as $$
#variable_conflict use_variable
declare v_yo uuid := (select auth.uid()); i public.instalaciones; m text := btrim(coalesce(p_motivo, '')); c date; ab date := privado.corte_en_curso();
begin
  if coalesce(privado.rol_actual(), '') <> 'admin' then raise exception 'Solo el administrador corrige un corte certificado' using errcode = 'P0001'; end if;
  select * into i from public.instalaciones x where x.id = p_instalacion;
  if i.id is null or i.anulada_en is not null then raise exception 'No se encontró la instalación' using errcode = 'P0001'; end if;
  if p_accion is null or p_accion not in ('no_se_pago', 'se_pago') then raise exception 'Elige qué pasó' using errcode = 'P0001'; end if;
  if length(m) < 5 then raise exception 'Escribe el motivo' using errcode = 'P0001'; end if;
  c := coalesce(privado.en_foto(i.id), coalesce(i.corte_manual, privado.corte_de((i.instalada_en at time zone 'America/Caracas')::date)));
  if not exists (select 1 from public.cortes_certificados k where k.corte = c and k.anulado_en is null) then
    raise exception 'No está en un corte certificado' using errcode = 'P0001'; end if;
  if p_accion = 'no_se_pago' then
    if privado.corte_cerrado(ab) then raise exception 'No hay un corte abierto' using errcode = 'P0001'; end if;
    update public.instalaciones x set corte_manual = ab, corte_manual_motivo = left(m, 500), corte_manual_por = v_yo, corte_manual_en = now(),
      correccion = 'no_se_pago', correccion_motivo = left(m, 500), correccion_por = v_yo, correccion_en = now() where x.id = i.id;
  else
    update public.instalaciones x set corte_manual = c, excepcion_corte = c, excepcion_motivo = left(m, 500), excepcion_por = v_yo, excepcion_en = now(),
      correccion = 'se_pago', correccion_motivo = left(m, 500), correccion_por = v_yo, correccion_en = now() where x.id = i.id;
  end if;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues)
  values (v_yo, 'corte_certificado_correccion', 'instalaciones', i.id::text, jsonb_build_object('corte', c),
    jsonb_build_object('accion', p_accion, 'corte', case when p_accion = 'no_se_pago' then ab else c end, 'motivo', left(m, 500)));
  return jsonb_build_object('corte', case when p_accion = 'no_se_pago' then ab else c end);
end $$;
revoke all on function public.instalacion_corregir_certificado(bigint, text, text) from public, anon;
grant execute on function public.instalacion_corregir_certificado(bigint, text, text) to authenticated;

-- ---------- Nota del pago ----------
create or replace function public.instalacion_pago_nota(p_instalacion bigint, p_nota text) returns void
language plpgsql security definer set search_path to '' as $$
declare v_yo uuid := privado.exigir_senior(); n text := nullif(left(btrim(coalesce(p_nota, '')), 500), ''); ant text;
begin
  select pago_nota into ant from public.instalaciones where id = p_instalacion;
  if not found then raise exception 'No se encontró la instalación' using errcode = 'P0001'; end if;
  update public.instalaciones set pago_nota = n where id = p_instalacion;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues)
  values (v_yo, 'pago_nota', 'instalaciones', p_instalacion::text, jsonb_build_object('nota', ant), jsonb_build_object('nota', n));
end $$;
revoke all on function public.instalacion_pago_nota(bigint, text) from public, anon;
grant execute on function public.instalacion_pago_nota(bigint, text) to authenticated;

-- ---------- Ajuste: días entre la instalación y el TAD que da el pago (administrador) ----------
create or replace function public.pago_dias_guardar(p_dias int) returns int
language plpgsql security definer set search_path to '' as $$
declare v_yo uuid := (select auth.uid()); ant int := privado.pago_dias_tad();
begin
  perform privado.exigir('admin');
  if p_dias is null or p_dias < 0 or p_dias > 30 then raise exception 'Escribe un número de días entre 0 y 30' using errcode = 'P0001'; end if;
  insert into privado.ia_ajustes (clave, valor) values ('pago_dias_tad', p_dias::text) on conflict (clave) do update set valor = excluded.valor;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues)
  values (v_yo, 'ajuste', 'ia_ajustes', 'pago_dias_tad', jsonb_build_object('valor', ant), jsonb_build_object('valor', p_dias));
  return p_dias;
end $$;
revoke all on function public.pago_dias_guardar(int) from public, anon;
grant execute on function public.pago_dias_guardar(int) to authenticated;

-- Leer el ajuste (migración pago_dias_leer)
create or replace function public.pago_dias() returns int language plpgsql stable security definer set search_path to '' as $$
begin
  perform privado.exigir('admin', 'analista', 'abogado', 'lider');
  return privado.pago_dias_tad();
end $$;
revoke all on function public.pago_dias() from public, anon;
grant execute on function public.pago_dias() to authenticated;
