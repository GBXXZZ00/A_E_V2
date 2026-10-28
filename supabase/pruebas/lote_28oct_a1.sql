-- Lote 28/10, parte A (1 de 3): fechas del TAD por servicio, estatus legal en 5 grupos, equipo de cada usuario,
-- envíos de carta y proforma con su origen, cliente nuevo sin orden y notas personales.
-- Migración: lote28_a1_base

-- A1: lo que trae el TAD de cada servicio (fechas como fecha) y cuándo dejó de venir (retirado)
alter table public.servicios add column if not exists ult_suspension date;
alter table public.servicios add column if not exists ult_habilitacion date;
alter table public.servicios add column if not exists estatus_tad text;
alter table public.servicios add column if not exists retirado_en date;

-- A3: equipo comercial de cada usuario (vacío = el de su rol: líder Ventas corporativas, analista Canales de atención)
alter table public.perfiles add column if not exists equipo_com text;
alter table public.perfiles add constraint perfiles_equipo_com_chk check (equipo_com is null or equipo_com in ('corporativas', 'canales', 'aliados'));

-- A8: quién envió la carta y proforma (Canales es obligatorio; el líder es respaldo) y para qué cambio de categoría
alter table public.envios add column if not exists origen text;
alter table public.envios add constraint envios_origen_chk check (origen is null or origen in ('canales', 'lider'));
alter table public.envios add column if not exists cambio_id bigint;

-- A7: cliente nuevo subido sin orden (con posible nombre y RIF): "Pendiente por instalar" hasta que el TAD lo trae
alter table public.clientes add column if not exists pendiente_instalar_en timestamptz;
alter table public.clientes add column if not exists pendiente_instalar_por uuid;
alter table public.clientes add column if not exists nuevo_enviado_en timestamptz;

-- A9: notas personales con recordatorio (se marcan a mano)
create table if not exists public.notas_personales (
  id bigint generated always as identity primary key,
  perfil_id uuid not null references public.perfiles(id),
  texto text not null check (length(texto) between 1 and 500),
  recordar date,
  cliente_id bigint references public.clientes(id),
  creada_en timestamptz not null default now(),
  hecha_en timestamptz
);
alter table public.notas_personales enable row level security;
create index if not exists notas_personales_perfil on public.notas_personales (perfil_id) where hecha_en is null;

insert into privado.ajustes_app (clave, valor) values ('orden_horas_alerta', '24') on conflict (clave) do nothing;
insert into privado.ajustes_app (clave, valor) values ('comision_monto', '30') on conflict (clave) do nothing;
insert into privado.ajustes_app (clave, valor) values ('carta_desde', '2026-10-21') on conflict (clave) do nothing;

create or replace function privado.equipo_de(p uuid) returns text language sql stable security definer set search_path to '' as $$
  select coalesce(pf.equipo_com, case when pf.rol = 'lider' then 'corporativas' when pf.rol = 'analista' then 'canales' end)
  from public.perfiles pf where pf.id = p $$;

-- Equipo de una instalación: la de un aliado es de Aliados; si no, el de su dueño
create or replace function privado.equipo_inst(p_aliado boolean, p_dueno uuid) returns text language sql stable security definer set search_path to '' as $$
  select case when coalesce(p_aliado, false) then 'aliados' when p_dueno is null then 'sin_dueno' else coalesce(privado.equipo_de(p_dueno), 'corporativas') end $$;

create or replace function public.perfiles_equipos() returns jsonb language plpgsql stable security definer set search_path to '' as $$
begin
  perform privado.exigir('admin');
  return coalesce((select jsonb_object_agg(p.id, jsonb_build_object('equipo', p.equipo_com, 'efectivo', privado.equipo_de(p.id))) from public.perfiles p), '{}'::jsonb);
end $$;

create or replace function public.perfil_equipo_guardar(p_perfil uuid, p_equipo text) returns jsonb language plpgsql security definer set search_path to '' as $$
declare antes text; yo uuid := (select auth.uid());
begin
  perform privado.exigir('admin');
  if p_equipo is not null and p_equipo not in ('corporativas', 'canales', 'aliados') then raise exception 'Equipo no reconocido' using errcode = 'P0001'; end if;
  select equipo_com into antes from public.perfiles where id = p_perfil;
  if not found then raise exception 'Ese usuario no existe' using errcode = 'P0001'; end if;
  update public.perfiles set equipo_com = p_equipo where id = p_perfil;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues)
  values (yo, 'perfil_equipo', 'perfiles', p_perfil::text, jsonb_build_object('equipo', antes), jsonb_build_object('equipo', p_equipo));
  return jsonb_build_object('equipo', p_equipo, 'efectivo', privado.equipo_de(p_perfil));
end $$;

-- A2: estatus legal en 5 grupos. "Grandes negocios" es el arranque: Sin gestionar, nunca completo.
create or replace function privado.grupo_legal(e text) returns text language sql immutable set search_path to '' as $$
  select case when e is null or e = 'grandes_negocios' then 'sin_gestionar' when e = 'contrato_firmado' then 'firmado' when e in ('por_firmar', 'contrato_en_curso') then 'por_firmar'
    when e in ('documentos_recibidos', 'documentos_en_revision') then 'revision' else 'faltan' end $$;

create or replace function privado.estatus_nombre(e text) returns text language sql immutable set search_path to '' as $$
  select case e when 'grandes_negocios' then 'Sin gestionar' when 'documentos_pendientes' then 'Documentos pendientes' when 'documentos_solicitados' then 'Documentos solicitados'
    when 'documentos_en_revision' then 'En revisión' when 'documentos_recibidos' then 'Recibidos' when 'contrato_en_curso' then 'Contrato en curso'
    when 'por_firmar' then 'Por firmar' when 'contrato_firmado' then 'Contrato firmado' else coalesce(e, '') end $$;

create or replace function privado.res_lista(p_modulo text, p_g text, p_x text) returns text language sql immutable set search_path to '' as $$
  select case
    when p_g in ('legal', 'seg') and p_modulo in ('clientes', 'revision', 'dedicados') then
      'clientes.html?' || case when coalesce(nullif(split_part(p_x, ':', 1), ''), 'todos') in ('todos', 'dedicados') then 'f=todos' else 's=' || split_part(p_x, ':', 1) end ||
      case split_part(p_x, ':', 2) when 'sin_gestionar' then '&est=grandes_negocios' when 'firmado' then '&est=contrato_firmado' when 'por_firmar' then '&est=por_firmar|contrato_en_curso'
        when 'revision' then '&est=documentos_recibidos|documentos_en_revision' when 'faltan' then '&est=documentos_solicitados|documentos_pendientes' else '' end
    when p_modulo = 'comisiones' and p_g in ('sin_instalar', 'por_instalar') then 'comisiones.html?t=por_instalar'
    when p_modulo = 'clientes' and p_g = 'lider' and p_x like '%|sin' then 'comisiones.html?t=por_asignar'
    when p_modulo = 'comisiones' and p_g = 'cartas' then 'comisiones.html?t=cartas'
    when p_modulo = 'comisiones' then 'comisiones.html'
    when p_modulo = 'revision' then 'trabajo.html?g=rev'
    when p_modulo = 'migraciones' then 'migraciones.html'
    when p_modulo = 'factibilidad' then 'factibilidad.html'
    when p_modulo = 'dedicados' and p_g = 'sin_vence' then 'clientes.html?s=corporativo&f=revisar_fecha'
    when p_modulo = 'dedicados' and p_g = 'activos' and p_x in ('corporativo', 'isp') then 'clientes.html?s=' || p_x
    when p_modulo = 'dedicados' then 'clientes.html?s=corporativo'
    when p_modulo = 'aliados' then 'aliados.html'
    when p_modulo = 'clientes' then 'clientes.html?f=todos'
  end $$;

create or replace function privado.res_dedicados(d date, h date, v_l uuid) returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare v_corp int; v_isp int; v_post int; v_vgt int; v_pol int; v_sinv int; v_ctr int; tip jsonb; leg jsonb; act jsonb;
begin
  select count(*) filter (where x.seg = 'corporativo'), count(*) filter (where x.seg = 'isp') into v_corp, v_isp from privado.res_cli(v_l) x;
  select coalesce(sum(k.postes) filter (where k.tipo = 'vgt'), 0), count(*) filter (where k.tipo = 'vgt'), count(*) filter (where k.vence_en is null), count(*)
    into v_post, v_vgt, v_sinv, v_ctr
  from public.dedicado_contratos k join privado.res_cli(v_l) x on x.id = k.cliente_id where x.seg <> 'pyme';
  select count(*) into v_pol from privado.pendientes() p where p.tipo = 'vgt' and (v_l is null or p.lider_id = v_l);
  select coalesce(jsonb_agg(jsonb_build_object('l', z.l, 'a', z.n, 'x', z.tipo, 'c', z.c) order by z.n desc), '[]'::jsonb) into tip
  from (select k.tipo, case k.tipo when 'servicio' then 'Servicio' when 'vgt' then 'VGT' when 'colocation' then 'Colocation' else initcap(k.tipo) end l,
          case k.tipo when 'vgt' then 'azul' when 'colocation' then 'verde2' end c, count(*) n
        from public.dedicado_contratos k join privado.res_cli(v_l) x on x.id = k.cliente_id where x.seg <> 'pyme' group by 1, 2, 3) z;
  select coalesce(jsonb_agg(jsonb_build_object('l', case s.seg when 'corporativo' then 'Corporativos' else 'ISP' end, 'x', s.seg, 'v', jsonb_build_array(s.a, s.b, s.c, s.d, s.e)) order by s.seg), '[]'::jsonb) into leg
  from (select x.seg, count(*) filter (where privado.grupo_legal(x.estatus) = 'sin_gestionar') a, count(*) filter (where privado.grupo_legal(x.estatus) = 'faltan') b,
          count(*) filter (where privado.grupo_legal(x.estatus) = 'revision') c, count(*) filter (where privado.grupo_legal(x.estatus) = 'por_firmar') d,
          count(*) filter (where privado.grupo_legal(x.estatus) = 'firmado') e from privado.res_cli(v_l) x where x.seg <> 'pyme' group by x.seg) s;
  act := jsonb_build_array(jsonb_build_object('l', 'Corporativos', 'a', v_corp, 'x', 'corporativo'), jsonb_build_object('l', 'ISP', 'a', v_isp, 'x', 'isp', 'c', 'azul'));
  return jsonb_build_object(
    'nums', jsonb_build_array(
      jsonb_build_object('id', 'act', 'v', v_corp + v_isp, 'l', 'Dedicados', 's', privado.miles(v_corp) || ' corporativos · ' || privado.miles(v_isp) || ' ISP', 'g', 'activos', 'x', 'todos'),
      jsonb_build_object('id', 'postes', 'v', v_post, 'l', 'Postes VGT', 's', 'En ' || v_vgt || case when v_vgt = 1 then ' contrato' else ' contratos' end, 'g', 'tipo', 'x', 'vgt'),
      jsonb_build_object('id', 'pol', 'v', v_pol, 'l', 'Deben pólizas VGT', 's', 'Pedírselas al cliente', 'tono', case when v_pol > 0 then 'w' end, 'g', 'polizas', 'x', 'todos'),
      jsonb_build_object('id', 'sinv', 'v', v_sinv, 'l', 'Contratos sin vencimiento', 's', case when v_sinv = v_ctr and v_ctr > 0 then 'Todos' else 'De ' || privado.miles(v_ctr) end, 'tono', case when v_sinv > 0 then 'w' end, 'g', 'sin_vence', 'x', 'todos')),
    'charts', jsonb_build_array(
      jsonb_build_object('id', 'tipo', 'tipo', 'h', 'w', 1.4, 't', 'Contratos por tipo', 's', 'Servicio, VGT y colocation', 'data', tip, 'badge', case when v_sinv > 0 then privado.miles(v_sinv) || ' sin fecha de vencimiento' end, 'bc', 'w'),
      jsonb_build_object('id', 'legal', 'tipo', 's', 'w', 1, 't', 'Estatus legal', 's', 'Por tipo de dedicado', 'data', leg, 'tip', 'Toca un tramo para ver esos clientes.'),
      jsonb_build_object('id', 'activos', 'tipo', 'h', 'w', 1.4, 't', 'Dedicados por tipo', 's', 'Corporativos e ISP', 'data', act),
      jsonb_build_object('id', 'ingresos', 'tipo', 'hueco', 'w', 1, 't', 'Ingresos de dedicados', 's', 'Facturación, cobranza y por cliente', 'h', 'Espacio reservado para ingresos y datos de dedicados.')));
end $$;

-- A1: el TAD guarda la última suspensión, la última habilitación y el estatus actual de cada servicio
create or replace function public.tad_filas(p_carga bigint, p_filas jsonb) returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_cli int := 0; v_nuevos int := 0; v_act int := 0; v_inv int := 0; v_tot int := 0; v_n int; v_k int; v_res jsonb; v_t jsonb;
begin
  perform privado.exigir('admin','analista');
  if not exists (select 1 from public.cargas where id=p_carga and fuente='tad' and estado='procesando') then
    raise exception 'Esta carga ya se cerró. Vuelve a empezar' using errcode='P0001'; end if;
  if jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) > 1000 then raise exception 'Lote de filas no válido' using errcode='P0001'; end if;
  v_tot := jsonb_array_length(p_filas);

  select coalesce(jsonb_agg(to_jsonb(z)), '[]'::jsonb) into v_t from (
    select distinct on (suc, cod, eq) * from (
      select lpad(regexp_replace(coalesce(x->>'s',''),'\D','','g'),3,'0') suc,
             lpad(regexp_replace(coalesce(x->>'c',''),'\D','','g'),8,'0') cod,
             upper(left(btrim(coalesce(x->>'t','')),1)) tipo,
             ltrim(regexp_replace(coalesce(x->>'d',''),'\D','','g'),'0') doc,
             left(btrim(regexp_replace(coalesce(x->>'n',''),'\s+',' ','g')),200) nom,
             nullif(left(btrim(coalesce(x->>'e','')),80),'') eq,
             nullif(left(btrim(coalesce(x->>'p','')),80),'') plan,
             nullif(left(btrim(coalesce(x->>'es','')),40),'') est,
             nullif(left(btrim(coalesce(x->>'ca','')),60),'') cat,
             upper(btrim(coalesce(x->>'cx',''))) = 'SI' deuda,
             privado.fecha_segura(x->>'f') fecha,
             privado.fecha_segura(x->>'us') usu,
             privado.fecha_segura(x->>'uh') uha,
             nullif(left(btrim(coalesce(x->>'ea','')),40),'') eta
      from jsonb_array_elements(p_filas) x) y
    where doc ~ '^[1-9][0-9]{4,9}$' and tipo in ('V','E','J','G','P','C') and nom <> '' and suc ~ '[1-9]' and cod ~ '[1-9]'
    order by suc, cod, eq, fecha desc nulls last) z;
  v_n := jsonb_array_length(v_t);
  v_inv := v_tot - v_n;

  insert into public.clientes(doc_tipo, doc_numero, nombre, es_natural)
  select distinct on (t.doc) t.tipo, t.doc, t.nom, t.tipo in ('V','E')
  from jsonb_to_recordset(v_t) t(suc text, cod text, tipo text, doc text, nom text, eq text, plan text, est text, cat text, deuda boolean, fecha date, usu date, uha date, eta text)
  order by t.doc, t.fecha desc nulls last
  on conflict (doc_numero) do nothing;
  get diagnostics v_cli = row_count;

  -- Servicios que entraron antes sin serial: se completan en vez de duplicarse
  update public.servicios s set equipo=t.eq
  from (select distinct on (r.suc,r.cod) r.* from jsonb_to_recordset(v_t) r(suc text, cod text, tipo text, doc text, nom text, eq text, plan text, est text, cat text, deuda boolean, fecha date, usu date, uha date, eta text)
        where r.eq is not null order by r.suc, r.cod, r.fecha desc nulls last) t
  where s.sucursal=t.suc and s.codigo=t.cod and coalesce(s.equipo,'') = ''
    and not exists (select 1 from public.servicios z where z.sucursal=t.suc and z.codigo=t.cod and z.equipo=t.eq);

  with i as (
    insert into public.servicios(cliente_id, sucursal, codigo, equipo, plan, categoria, estado, fecha_instalacion, con_deuda, visto_en_carga, ult_suspension, ult_habilitacion, estatus_tad)
    select c.id, t.suc, t.cod, t.eq, t.plan, t.cat, t.est, t.fecha, t.deuda, p_carga, t.usu, t.uha, t.eta
    from jsonb_to_recordset(v_t) t(suc text, cod text, tipo text, doc text, nom text, eq text, plan text, est text, cat text, deuda boolean, fecha date, usu date, uha date, eta text)
    join public.clientes c on c.doc_numero=t.doc where t.eq is not null
    on conflict (sucursal, codigo, equipo) do update set cliente_id=excluded.cliente_id, plan=excluded.plan, categoria=coalesce(excluded.categoria, public.servicios.categoria),
      estado=coalesce(excluded.estado, public.servicios.estado), fecha_instalacion=coalesce(excluded.fecha_instalacion, public.servicios.fecha_instalacion),
      con_deuda=excluded.con_deuda, visto_en_carga=excluded.visto_en_carga, actualizado_en=now(),
      ult_suspension=coalesce(excluded.ult_suspension, public.servicios.ult_suspension), ult_habilitacion=coalesce(excluded.ult_habilitacion, public.servicios.ult_habilitacion),
      estatus_tad=coalesce(excluded.estatus_tad, public.servicios.estatus_tad), retirado_en=null
    returning (xmax = 0) nuevo)
  select count(*) filter (where nuevo), count(*) filter (where not nuevo) into v_nuevos, v_act from i;

  update public.servicios s set plan=t.plan, categoria=coalesce(t.cat,s.categoria), estado=coalesce(t.est,s.estado), con_deuda=t.deuda, visto_en_carga=p_carga, actualizado_en=now(),
    ult_suspension=coalesce(t.usu, s.ult_suspension), ult_habilitacion=coalesce(t.uha, s.ult_habilitacion), estatus_tad=coalesce(t.eta, s.estatus_tad), retirado_en=null
  from jsonb_to_recordset(v_t) t(suc text, cod text, tipo text, doc text, nom text, eq text, plan text, est text, cat text, deuda boolean, fecha date, usu date, uha date, eta text)
  where t.eq is null and s.sucursal=t.suc and s.codigo=t.cod;
  get diagnostics v_k = row_count; v_act := v_act + v_k;
  insert into public.servicios(cliente_id, sucursal, codigo, plan, categoria, estado, fecha_instalacion, con_deuda, visto_en_carga, ult_suspension, ult_habilitacion, estatus_tad)
  select c.id, t.suc, t.cod, t.plan, t.cat, t.est, t.fecha, t.deuda, p_carga, t.usu, t.uha, t.eta
  from jsonb_to_recordset(v_t) t(suc text, cod text, tipo text, doc text, nom text, eq text, plan text, est text, cat text, deuda boolean, fecha date, usu date, uha date, eta text)
  join public.clientes c on c.doc_numero=t.doc
  where t.eq is null and not exists (select 1 from public.servicios s where s.sucursal=t.suc and s.codigo=t.cod);
  get diagnostics v_k = row_count; v_nuevos := v_nuevos + v_k;

  update public.cargas set filas_usadas = filas_usadas + v_n,
    resumen = jsonb_build_object('clientes_nuevos',(resumen->>'clientes_nuevos')::int+v_cli,'servicios_nuevos',(resumen->>'servicios_nuevos')::int+v_nuevos,
      'servicios_actualizados',(resumen->>'servicios_actualizados')::int+v_act,'invalidas',(resumen->>'invalidas')::int+v_inv,
      'con_fechas', coalesce((resumen->>'con_fechas')::int, 0) + (select count(*) from jsonb_to_recordset(v_t) t(usu date, uha date) where t.usu is not null or t.uha is not null))
  where id=p_carga returning resumen into v_res;
  return v_res;
end $$;

create or replace function public.tad_cerrar(p_carga bigint) returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_pagos int := 0; v_res jsonb; v_ret int := 0;
begin
  perform privado.exigir('admin','analista');
  if not exists (select 1 from public.cargas where id=p_carga and fuente='tad' and estado='procesando') then
    raise exception 'Esta carga ya se cerró' using errcode='P0001'; end if;
  -- Pago de instalación: la primera vez que el cliente aparece sin deuda queda cumplido y congelado. Solo con un servicio.
  update public.instalaciones i set pago_ok_en = now()
  where i.pago_ok_en is null and i.cliente_id is not null
    and (select count(*) from public.servicios s where s.cliente_id=i.cliente_id) = 1
    and exists (select 1 from public.servicios s where s.cliente_id=i.cliente_id and s.visto_en_carga=p_carga and s.con_deuda is false)
    and (i.instalada_en at time zone 'America/Caracas')::date + privado.pago_dias_tad() <= privado.hoy();
  get diagnostics v_pagos = row_count;
  -- Lote 27/10: historial de estados (solo los cambios)
  perform privado.servicio_estados_anotar(p_carga);
  -- Lote 22/10: ningún cliente se borra por no venir en el TAD; si falta en dos cargas seguidas se marca "No aparece en el TAD"
  with ult as (select array_agg(id) ids from (select c.id from public.cargas c where c.fuente = 'tad' and (c.id = p_carga or c.estado in ('lista', 'con_errores')) and c.id <= p_carga order by c.id desc limit 2) q)
  update public.clientes k set no_aparece_tad_en = case when x.falta then coalesce(k.no_aparece_tad_en, now()) end
  from (select s.cliente_id, bool_and(s.visto_en_carga is null or not (s.visto_en_carga = any (ult.ids))) and cardinality(ult.ids) = 2 falta
        from public.servicios s cross join ult group by s.cliente_id, ult.ids) x
  where x.cliente_id = k.id and (k.no_aparece_tad_en is null) = x.falta;
  -- Lote 28/10: un servicio que falta en las dos últimas cargas cuenta como retirado (vuelve solo si reaparece)
  with ult as (select array_agg(id) ids from (select c.id from public.cargas c where c.fuente = 'tad' and (c.id = p_carga or c.estado in ('lista', 'con_errores')) and c.id <= p_carga order by c.id desc limit 2) q)
  update public.servicios s set retirado_en = privado.hoy()
  from ult where cardinality(ult.ids) = 2 and s.retirado_en is null and (s.visto_en_carga is null or not (s.visto_en_carga = any (ult.ids)));
  get diagnostics v_ret = row_count;
  update public.cargas set estado = case when (resumen->>'invalidas')::int > 0 then 'con_errores' else 'lista' end,
    resumen = resumen || jsonb_build_object('pagos_marcados', v_pagos, 'retirados', v_ret, 'clientes_total', (select count(*) from public.clientes), 'servicios_total', (select count(*) from public.servicios))
  where id=p_carga returning resumen || jsonb_build_object('filas', filas_total, 'usadas', filas_usadas) into v_res;
  insert into public.bitacora(usuario_id, accion, tabla, registro_id, despues) values (auth.uid(), 'carga_tad', 'cargas', p_carga::text, v_res);
  return v_res;
end $$;
