-- Corrida 14/10, módulo Migraciones. Aplicado con el conector como migración "migraciones_comision".
-- Ningún cambio entra solo a comisión: al confirmarse un cambio a PYME queda "Comisión: por decidir" y el Analista Senior o el
-- administrador marcan Sí o No con motivo (bitácora). Solo el Sí crea la instalación CAMBIO. Quitar el Sí la anula (la base no
-- borra filas): comision_filas3 y las bienvenidas ignoran las anuladas. Un cambio con fecha anterior a "cambios_desde" queda solo como registro.

alter table public.cambios add column if not exists comision text check (comision in ('por_decidir', 'si', 'no'));
alter table public.cambios add column if not exists comision_motivo text;
alter table public.cambios add column if not exists comision_por uuid;
alter table public.cambios add column if not exists comision_en timestamptz;
alter table public.cambios add column if not exists fecha_cambio timestamptz;
alter table public.instalaciones add column if not exists anulada_en timestamptz;

insert into privado.ajustes_app (clave, valor) values ('cambios_desde', '2026-09-21') on conflict (clave) do nothing;

create or replace function privado.cambios_desde() returns date
language sql stable security definer set search_path to '' as $f$
  select coalesce((select case when a.valor ~ '^\d{4}-\d{2}-\d{2}$' then a.valor::date end from privado.ajustes_app a where a.clave = 'cambios_desde'), date '2026-09-21')
$f$;

create or replace function public.ajuste_guardar(p_clave text, p_valor text) returns void
language plpgsql security definer set search_path to '' as $f$
declare v_yo uuid := (select auth.uid()); v text := nullif(btrim(coalesce(p_valor, '')), ''); ant text;
begin
  perform privado.exigir('admin');
  select valor into ant from privado.ajustes_app where clave = p_clave for update;
  if not found then raise exception 'Ajuste no reconocido' using errcode = 'P0001'; end if;
  if p_clave = 'whatsapp_admin' and v is not null then
    v := regexp_replace(v, '\D', '', 'g');
    if v ~ '^0' then v := '58' || substr(v, 2); end if;
    if v !~ '^[1-9][0-9]{9,14}$' then raise exception 'Escribe el número con su código, por ejemplo 0414 1234567' using errcode = 'P0001'; end if;
  elsif p_clave like 'dias_%' and (v is null or v !~ '^[0-9]{1,3}$' or v::int < 1) then
    raise exception 'Escribe un número de días mayor que cero' using errcode = 'P0001';
  elsif p_clave = 'cambios_desde' then
    if v ~ '^\d{1,2}/\d{1,2}/\d{4}$' then v := to_char(to_date(v, 'DD/MM/YYYY'), 'YYYY-MM-DD'); end if;
    if v is null or v !~ '^\d{4}-\d{2}-\d{2}$' or to_char(v::date, 'YYYY-MM-DD') <> v then raise exception 'Escribe la fecha como 21/09/2026' using errcode = 'P0001'; end if;
  end if;
  update privado.ajustes_app set valor = v, actualizado_por = v_yo, actualizado_en = now() where clave = p_clave;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues)
  values (v_yo, 'ajuste', 'ajustes_app', p_clave, jsonb_build_object('valor', ant), jsonb_build_object('valor', v));
end $f$;

-- Confirmar ya no crea la comisión: deja la decisión pendiente
create or replace function privado.cambio_confirmar(p bigint, p_fecha timestamptz, p_como text, autor uuid) returns void
language plpgsql security definer set search_path to '' as $f$
declare c public.cambios; v_com text;
begin
  select * into c from public.cambios where id = p for update;
  if not found or c.estado in ('confirmado', 'rechazado', 'cancelado', 'error', 'revertido') then return; end if;
  v_com := case when c.tipo in ('categoria', 'ambos') and privado.es_pyme(c.categoria_nueva) and not privado.es_pyme(c.categoria_anterior) then 'por_decidir' end;
  update public.cambios set estado = 'confirmado', confirmado_en = now(), confirmado_como = p_como, fecha_cambio = coalesce(p_fecha, now()),
    comision = v_com, actualizado_en = now() where id = p;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues)
  values (autor, 'cambio_confirmado', 'cambios', p::text, jsonb_build_object('estado', c.estado), jsonb_build_object('como', p_como, 'fecha', coalesce(p_fecha, now()), 'comision', v_com));
end $f$;

-- El Sí: crea la instalación CAMBIO (o la vuelve a activar si se había anulado)
create or replace function privado.cambio_instalar(p bigint) returns bigint
language plpgsql security definer set search_path to '' as $f$
declare c public.cambios; s jsonb; cid bigint; f timestamptz; iid bigint;
begin
  select * into c from public.cambios where id = p;
  -- Un cambio de un corte ya pasado entra en el corte en curso: un corte vencido nunca se mueve
  f := coalesce(c.fecha_cambio, c.confirmado_en, now());
  if privado.corte_de((f at time zone 'America/Caracas')::date) < privado.corte_en_curso() then f := now(); end if;
  if c.instalacion_id is not null and exists (select 1 from public.instalaciones i where i.id = c.instalacion_id) then
    update public.instalaciones set anulada_en = null, instalada_en = f, lider_id = c.lider_id, lider_nombre = privado.nombre_de(c.lider_id) where id = c.instalacion_id;
    return c.instalacion_id;
  end if;
  cid := case when c.tipo = 'ambos' then c.nuevo_cliente_id else (select x.id from public.clientes x where x.doc_numero = c.titular_doc and x.unido_a is null order by x.id limit 1) end;
  s := c.servicios->0;
  insert into public.instalaciones (sucursal, codigo, equipo, instalada_en, doc_numero, nombre, categoria, instalador, es_aliado, cliente_id, servicio_id,
    cruce, cruce_confirmado, lider_id, lider_nombre, dueno_manual, cambio_id)
  values (s->>'sucursal', s->>'codigo', 'CAMBIO', f, coalesce(c.nuevo_doc, c.titular_doc), coalesce(c.nuevo_nombre, c.titular_nombre), c.categoria_nueva, 'Cambio de categoría', false, cid,
    (select v.id from public.servicios v where v.sucursal = s->>'sucursal' and ltrim(v.codigo, '0') = ltrim(s->>'codigo', '0') order by v.id desc limit 1),
    'manual', true, c.lider_id, privado.nombre_de(c.lider_id), true, c.id)
  on conflict do nothing returning id into iid;
  if iid is null then raise exception 'Ese servicio ya tiene una instalación de cambio en la base. Avísale al administrador' using errcode = 'P0001'; end if;
  update public.cambios set instalacion_id = iid where id = p;
  return iid;
end $f$;

create or replace function public.cambio_comision(p_id bigint, p_si boolean, p_motivo text) returns void
language plpgsql security definer set search_path to '' as $f$
declare v_rol text := privado.exigir('admin', 'analista'); v_yo uuid := (select auth.uid()); c public.cambios; m text := left(nullif(btrim(coalesce(p_motivo, '')), ''), 500); iid bigint;
begin
  if v_rol = 'analista' and not privado.es_senior() then raise exception 'Solo el Analista Senior o el administrador deciden la comisión' using errcode = 'P0001'; end if;
  if p_si is null then raise exception 'Elige Sí o No' using errcode = 'P0001'; end if;
  if m is null or length(m) < 4 then raise exception 'Escribe el motivo' using errcode = 'P0001'; end if;
  select * into c from public.cambios where id = p_id for update;
  if not found or c.estado <> 'confirmado' or c.comision is null then raise exception 'Ese cambio no tiene comisión por decidir' using errcode = 'P0001'; end if;
  if (coalesce(c.fecha_cambio, c.confirmado_en) at time zone 'America/Caracas')::date < privado.cambios_desde() then
    raise exception 'Este cambio es de antes del %: queda solo como registro', to_char(privado.cambios_desde(), 'DD/MM/YYYY') using errcode = 'P0001'; end if;
  if p_si then
    if c.comision = 'si' then raise exception 'Ya está marcado que comisiona' using errcode = 'P0001'; end if;
    if c.lider_id is null then raise exception 'Primero vincula el cambio a un líder' using errcode = 'P0001'; end if;
    iid := privado.cambio_instalar(c.id);
  else
    if c.comision = 'no' then raise exception 'Ya está marcado que no comisiona' using errcode = 'P0001'; end if;
    iid := c.instalacion_id;
    if c.comision = 'si' and iid is not null then
      if exists (select 1 from public.cortes_certificados cc cross join lateral jsonb_array_elements(cc.filas) f
                 where cc.anulado_en is null and (f->>'instalacion_id')::bigint = iid) then
        raise exception 'Ya está en un corte certificado: no se puede quitar' using errcode = 'P0001'; end if;
      update public.instalaciones set anulada_en = now() where id = iid;
    end if;
  end if;
  update public.cambios set comision = case when p_si then 'si' else 'no' end, comision_motivo = m, comision_por = v_yo, comision_en = now(), actualizado_en = now() where id = p_id;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues)
  values (v_yo, 'cambio_comision', 'cambios', p_id::text, jsonb_build_object('comision', c.comision), jsonb_build_object('comision', case when p_si then 'si' else 'no' end, 'motivo', m, 'instalacion', iid));
end $f$;
revoke all on function public.cambio_comision(bigint, boolean, text) from public, anon;
grant execute on function public.cambio_comision(bigint, boolean, text) to authenticated;
revoke all on function privado.cambio_instalar(bigint) from public, anon, authenticated;

create or replace function privado.cambio_json(c public.cambios) returns jsonb
language sql stable security definer set search_path to '' as $f$
  select jsonb_build_object('id', c.id, 'tipo', c.tipo, 'estado', c.estado, 'origen', c.origen, 'creado_en', c.creado_en, 'creado_por', privado.nombre_de(c.creado_por),
    'lider', coalesce(privado.nombre_de(c.lider_id), c.lider_nombre), 'lider_id', c.lider_id,
    'titular', jsonb_build_object('tipo', c.titular_tipo, 'doc', c.titular_doc, 'nombre', c.titular_nombre, 'natural', c.titular_natural),
    'nuevo', case when c.nuevo_doc is null then null else jsonb_build_object('tipo', c.nuevo_tipo, 'doc', c.nuevo_doc, 'nombre', c.nuevo_nombre, 'natural', c.nuevo_natural, 'cliente_id', c.nuevo_cliente_id) end,
    'categoria_anterior', c.categoria_anterior, 'categoria_nueva', c.categoria_nueva, 'servicios', c.servicios, 'nota', c.nota,
    'aprobado_en', c.aprobado_en, 'aprobado_por', privado.nombre_de(c.aprobado_por), 'emitido_en', c.emitido_en, 'emitido_por', privado.nombre_de(c.emitido_por),
    'confirmado_en', c.confirmado_en, 'confirmado_como', c.confirmado_como, 'cierre_nota', c.cierre_nota, 'cerrado_por', privado.nombre_de(c.cerrado_por),
    'instalacion_id', c.instalacion_id, 'comisiona', c.tipo in ('categoria', 'ambos') and privado.es_pyme(c.categoria_nueva) and not privado.es_pyme(c.categoria_anterior),
    'negativo', privado.es_pyme(c.categoria_anterior) and c.categoria_nueva is not null and not privado.es_pyme(c.categoria_nueva),
    'comision', c.comision, 'comision_motivo', c.comision_motivo, 'comision_por', privado.nombre_de(c.comision_por), 'comision_en', c.comision_en,
    'fecha_cambio', c.fecha_cambio,
    'solo_registro', c.comision is not null and (coalesce(c.fecha_cambio, c.confirmado_en) at time zone 'America/Caracas')::date < privado.cambios_desde(),
    'requisitos', privado.cambio_requisitos(c.id))
$f$;

create or replace function public.cambios_lista() returns jsonb
language plpgsql stable security definer set search_path to '' as $f$
declare v_rol text := privado.exigir('admin', 'analista', 'lider'); v_yo uuid := (select auth.uid()); senior boolean := privado.es_senior();
begin
  return jsonb_build_object('rol', v_rol, 'hoy', privado.hoy(), 'desde', privado.cambios_desde(),
    'indice', (select jsonb_build_object('en', k.cerrada_en, 'filas', k.filas) from privado.tad_indice_cargas k where k.id = privado.tad_indice_vigente()),
    'archivo', (select jsonb_build_object('en', k.en, 'filas', k.filas) from privado.cambios_cargas k order by k.id desc limit 1),
    'puedo', jsonb_build_object('aprobar', v_rol = 'admin', 'emitir', v_rol in ('admin', 'analista'), 'confirmar', v_rol = 'admin' or senior, 'vincular', v_rol = 'admin' or senior, 'decidir', v_rol = 'admin' or senior),
    'lideres', case when v_rol = 'admin' or senior then (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre) order by p.nombre), '[]'::jsonb) from public.perfiles p where p.activo and p.rol = 'lider') else '[]'::jsonb end,
    'filas', coalesce((select jsonb_agg(privado.cambio_json(c) order by c.creado_en desc) from public.cambios c
      where (v_rol <> 'lider' or c.lider_id = v_yo or c.creado_por = v_yo)
        and (c.estado not in ('rechazado', 'cancelado', 'error', 'revertido', 'confirmado') or c.comision = 'por_decidir' or c.actualizado_en > now() - interval '60 days')), '[]'::jsonb));
end $f$;

-- Comisiones: las instalaciones anuladas no cuentan; tampoco piden carta de bienvenida
select privado.parchar('privado.comision_filas3(date)'::regprocedure, jsonb_build_array(
  jsonb_build_array('and privado.comisionable(i.categoria, i.es_aliado)', 'and i.anulada_en is null and privado.comisionable(i.categoria, i.es_aliado)')));
select privado.parchar('privado.bienvenidas_filas()'::regprocedure, jsonb_build_array(
  jsonb_build_array('where i.instalada_en >= privado.corte_cierre((privado.corte_en_curso()', 'where i.anulada_en is null and i.instalada_en >= privado.corte_cierre((privado.corte_en_curso()')));
-- Bandeja del Senior: cambios con la comisión por decidir
select privado.parchar('privado.pendientes()'::regprocedure, jsonb_build_array(
  jsonb_build_array('  -- Analista: órdenes de Odoo sin instalar', '  -- Senior: cambios confirmados con la comisión por decidir
  return query select ''cambio_comision''::text, c.id::text, null::bigint, coalesce(c.titular_nombre, ''Cambio de categoría''), coalesce(c.categoria_anterior, ''?'') || '' a '' || coalesce(c.categoria_nueva, ''?'') || '': ¿comisiona?'',
    c.lider_id, null::uuid, ''senior''::text, c.confirmado_en, (c.confirmado_en at time zone ''America/Caracas'')::date + d_cam, jsonb_build_object(''cambio'', c.id)
  from public.cambios c where c.estado = ''confirmado'' and c.comision = ''por_decidir''
    and (coalesce(c.fecha_cambio, c.confirmado_en) at time zone ''America/Caracas'')::date >= privado.cambios_desde();
  -- Analista: órdenes de Odoo sin instalar')));
