-- Lote 28/10, parte A (2 de 3): Comisiones por equipos, carta y proforma en un solo envío, órdenes por instalar con horas,
-- cliente nuevo sin orden, resumen por corte (ranking, Líder del mes, monto) y aviso al líder a las 24 horas.
-- Migración: lote28_a2_comisiones

create or replace function privado.orden_horas_alerta() returns integer language sql stable security definer set search_path to '' as $$
  select coalesce((select nullif(a.valor, '')::int from privado.ajustes_app a where a.clave = 'orden_horas_alerta'), 24) $$;
create or replace function privado.comision_monto() returns numeric language sql stable security definer set search_path to '' as $$
  select coalesce((select nullif(a.valor, '')::numeric from privado.ajustes_app a where a.clave = 'comision_monto'), 30) $$;
create or replace function privado.carta_desde() returns timestamptz language sql stable security definer set search_path to '' as $$
  select (coalesce((select nullif(a.valor, '')::date from privado.ajustes_app a where a.clave = 'carta_desde'), date '2026-10-21')::timestamp at time zone 'America/Caracas') $$;
-- Inicio del corte (momento en que abre) y del corte en curso
create or replace function privado.corte_abre(c date) returns timestamptz language sql stable set search_path to '' as $$ select privado.corte_cierre((c - interval '1 month')::date) $$;

create or replace function public.orden_horas_guardar(p_horas integer) returns integer language plpgsql security definer set search_path to '' as $$
declare antes text;
begin
  perform privado.exigir('admin');
  if p_horas is null or p_horas < 1 or p_horas > 720 then raise exception 'Escribe entre 1 y 720 horas' using errcode = 'P0001'; end if;
  select valor into antes from privado.ajustes_app where clave = 'orden_horas_alerta';
  insert into privado.ajustes_app (clave, valor) values ('orden_horas_alerta', p_horas::text) on conflict (clave) do update set valor = excluded.valor;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues) values ((select auth.uid()), 'ajuste', 'ajustes_app', 'orden_horas_alerta', jsonb_build_object('valor', antes), jsonb_build_object('valor', p_horas));
  return p_horas;
end $$;

-- Origen de un envío: Canales (analistas y administrador) o el líder (respaldo)
create or replace function privado.envio_origen(p_origen text, p_por uuid) returns text language sql stable security definer set search_path to '' as $$
  select coalesce(p_origen, case when (select pf.rol from public.perfiles pf where pf.id = p_por) in ('admin', 'analista') then 'canales' else 'lider' end) $$;

-- Estado de la carta de bienvenida y proforma de una instalación (también cambios de categoría)
create or replace function privado.carta_estado(p_inst bigint) returns jsonb language sql stable security definer set search_path to '' as $$
  with i as (select x.*, coalesce(x.servicio_id, (select s.id from public.servicios s where s.cliente_id = x.cliente_id and s.sucursal = x.sucursal and s.codigo = x.codigo order by s.id limit 1)) sid
             from public.instalaciones x where x.id = p_inst),
  e as (select en.*, privado.envio_origen(en.origen, en.por) ori from public.envios en, i
        where en.tipo = 'bienvenida' and (en.instalacion_id = i.id or (i.sid is not null and en.servicio_id = i.sid) or (i.cambio_id is not null and en.cambio_id = i.cambio_id))
          and en.en >= i.instalada_en - interval '2 days'),
  c as (select (select row_to_json(z) from (select privado.nombre_de(e.por) por, e.en, e.canal from e where e.ori = 'canales' order by e.en desc limit 1) z) can,
               (select row_to_json(z) from (select privado.nombre_de(e.por) por, e.en, e.canal from e where e.ori = 'lider' order by e.en desc limit 1) z) lid)
  select jsonb_build_object(
    'k', case when c.can is not null then 'enviada' when c.lid is not null then 'lider'
              when i.instalada_en < privado.carta_desde() then 'sin_registro'
              when i.sid is not null and not exists (select 1 from public.servicios s where s.id = i.sid and (nullif(btrim(coalesce(s.ip, '')), '') is not null or nullif(btrim(coalesce(s.ip6, '')), '') is not null)) then 'falta_ip'
              else 'por_enviar' end,
    'dias', privado.hoy() - (i.instalada_en at time zone 'America/Caracas')::date,
    'servicio_id', i.sid, 'canales', c.can, 'lider', c.lid, 'aliado', coalesce(i.es_aliado, false))
  from i cross join c $$;

-- Envío de proforma y carta: queda el origen; el líder no envía la de clientes de aliados
create or replace function public.envio_registrar(p_servicio bigint, p_tipos text[], p_canal text, p_destino text default null) returns void language plpgsql security definer set search_path to '' as $$
#variable_conflict use_variable
declare v_rol text := privado.exigir('admin', 'analista', 'lider'); v_yo uuid := (select auth.uid()); s public.servicios; t text; v_carta jsonb; v_inst bigint;
  v_prof boolean := false; v_bien boolean := false; v_ori text; v_cambio bigint;
begin
  select * into s from public.servicios where id = p_servicio;
  if not found then raise exception 'Ese servicio no existe' using errcode = 'P0001'; end if;
  perform privado.exigir_cliente(s.cliente_id);
  if p_canal is null or p_canal not in ('whatsapp', 'correo', 'manual') then raise exception 'Canal no reconocido' using errcode = 'P0001'; end if;
  if p_canal = 'manual' and v_rol not in ('admin', 'analista') then raise exception 'No tienes permiso para hacer esto' using errcode = 'P0001'; end if;
  if p_tipos is null or cardinality(p_tipos) = 0 then raise exception 'Elige qué se envió' using errcode = 'P0001'; end if;
  v_carta := privado.carta_de(s.id); v_inst := (v_carta->>'instalacion')::bigint;
  if v_rol = 'lider' and coalesce((select i.es_aliado from public.instalaciones i where i.id = v_inst), false) then
    raise exception 'La carta y proforma de los clientes de aliados la envía Canales de atención' using errcode = 'P0001'; end if;
  foreach t in array p_tipos loop
    if t not in ('proforma', 'bienvenida') then raise exception 'Documento no reconocido' using errcode = 'P0001'; end if;
    if t = 'bienvenida' and not coalesce((v_carta->>'puede')::boolean, false) then
      raise exception 'La carta de bienvenida sale cuando la instalación tenga dueño' using errcode = 'P0001';
    end if;
    if t = 'proforma' then v_prof := true; else v_bien := true; end if;
  end loop;
  v_ori := case when v_rol in ('admin', 'analista') then 'canales' else 'lider' end;
  v_cambio := (select i.cambio_id from public.instalaciones i where i.id = v_inst);
  if v_prof then insert into public.envios (cliente_id, servicio_id, instalacion_id, tipo, canal, destino, por, origen, cambio_id) values (s.cliente_id, s.id, v_inst, 'proforma', p_canal, left(nullif(btrim(coalesce(p_destino, '')), ''), 160), v_yo, v_ori, v_cambio); end if;
  if v_bien then insert into public.envios (cliente_id, servicio_id, instalacion_id, tipo, canal, destino, por, origen, cambio_id) values (s.cliente_id, s.id, v_inst, 'bienvenida', p_canal, left(nullif(btrim(coalesce(p_destino, '')), ''), 160), v_yo, v_ori, v_cambio); end if;
  update public.clientes set proforma_en = case when v_prof then now() else proforma_en end, proforma_por = case when v_prof then v_yo else proforma_por end,
    bienvenida_en = case when v_bien then now() else bienvenida_en end, bienvenida_por = case when v_bien then v_yo else bienvenida_por end, actualizado_en = now()
  where id = s.cliente_id;
  insert into public.hilo (cliente_id, tipo, texto, detalle, autor_id)
  values (s.cliente_id, 'gestion', case when v_prof and v_bien then 'ambas' when v_bien then 'bienvenida' else 'proforma' end,
    jsonb_build_object('hecho', true, 'canal', p_canal, 'servicio', s.id, 'codigo', s.sucursal || '-' || s.codigo, 'origen', v_ori), v_yo);
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues)
  values (v_yo, 'envio_documentos', 'servicios', s.id::text, jsonb_build_object('tipos', to_jsonb(p_tipos), 'canal', p_canal, 'destino', p_destino, 'origen', v_ori, 'instalacion', v_inst));
  perform privado.gestion(s.cliente_id, v_yo);
end $$;

-- Un solo envío: carta y proforma juntas (si la carta no puede salir todavía, solo la proforma)
create or replace function public.carta_enviar(p_servicio bigint, p_canal text, p_destino text default null) returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_carta jsonb;
begin
  perform privado.exigir('admin', 'analista', 'lider');
  v_carta := privado.carta_de(p_servicio);
  if v_carta is null then raise exception 'Ese servicio no existe' using errcode = 'P0001'; end if;
  perform public.envio_registrar(p_servicio, case when coalesce((v_carta->>'puede')::boolean, false) then array['proforma', 'bienvenida'] else array['proforma'] end, p_canal, p_destino);
  return case when (v_carta->>'instalacion') is not null then privado.carta_estado((v_carta->>'instalacion')::bigint) else '{}'::jsonb end;
end $$;

-- Lote 27/10 + 28/10: tad_cerrar marca retirado con la fecha de la última carga en que se vio
create or replace function public.tad_cerrar(p_carga bigint) returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_pagos int := 0; v_res jsonb; v_ret int := 0;
begin
  perform privado.exigir('admin','analista');
  if not exists (select 1 from public.cargas where id=p_carga and fuente='tad' and estado='procesando') then
    raise exception 'Esta carga ya se cerró' using errcode='P0001'; end if;
  update public.instalaciones i set pago_ok_en = now()
  where i.pago_ok_en is null and i.cliente_id is not null
    and (select count(*) from public.servicios s where s.cliente_id=i.cliente_id) = 1
    and exists (select 1 from public.servicios s where s.cliente_id=i.cliente_id and s.visto_en_carga=p_carga and s.con_deuda is false)
    and (i.instalada_en at time zone 'America/Caracas')::date + privado.pago_dias_tad() <= privado.hoy();
  get diagnostics v_pagos = row_count;
  perform privado.servicio_estados_anotar(p_carga);
  with ult as (select array_agg(id) ids from (select c.id from public.cargas c where c.fuente = 'tad' and (c.id = p_carga or c.estado in ('lista', 'con_errores')) and c.id <= p_carga order by c.id desc limit 2) q)
  update public.clientes k set no_aparece_tad_en = case when x.falta then coalesce(k.no_aparece_tad_en, now()) end
  from (select s.cliente_id, bool_and(s.visto_en_carga is null or not (s.visto_en_carga = any (ult.ids))) and cardinality(ult.ids) = 2 falta
        from public.servicios s cross join ult group by s.cliente_id, ult.ids) x
  where x.cliente_id = k.id and (k.no_aparece_tad_en is null) = x.falta;
  -- Lote 28/10: un servicio del TAD que falta en las dos últimas cargas cuenta como retirado desde la última carga en que vino
  with ult as (select array_agg(id) ids from (select c.id from public.cargas c where c.fuente = 'tad' and (c.id = p_carga or c.estado in ('lista', 'con_errores')) and c.id <= p_carga order by c.id desc limit 2) q)
  update public.servicios s set retirado_en = coalesce((select (k.subido_en at time zone 'America/Caracas')::date from public.cargas k where k.id = s.visto_en_carga), privado.hoy())
  from ult where cardinality(ult.ids) = 2 and s.retirado_en is null and s.visto_en_carga is not null and not (s.visto_en_carga = any (ult.ids));
  get diagnostics v_ret = row_count;
  update public.cargas set estado = case when (resumen->>'invalidas')::int > 0 then 'con_errores' else 'lista' end,
    resumen = resumen || jsonb_build_object('pagos_marcados', v_pagos, 'retirados', v_ret, 'clientes_total', (select count(*) from public.clientes), 'servicios_total', (select count(*) from public.servicios))
  where id=p_carga returning resumen || jsonb_build_object('filas', filas_total, 'usadas', filas_usadas) into v_res;
  insert into public.bitacora(usuario_id, accion, tabla, registro_id, despues) values (auth.uid(), 'carga_tad', 'cargas', p_carga::text, v_res);
  return v_res;
end $$;

-- Filas del corte con su equipo (los aliados aparte: no comisionan aquí, pero se gestionan y llevan carta)
create or replace function privado.com_base(c date) returns table(instalacion_id bigint, cliente_id bigint, nombre text, doc text, instalada_en timestamptz, dueno_id uuid, dueno text, equipo text,
  origen text, cumple boolean, legal_ok boolean, pago_ok boolean, orden_id bigint, orden text, migracion boolean, servicio_id bigint, estatus text)
language sql stable security definer set search_path to '' as $$
  select f.instalacion_id, f.cliente_id, f.nombre, f.doc, f.instalada_en, f.lider_id, f.lider,
    case when f.lider = 'Por asignar' then 'sin_dueno' else coalesce(privado.equipo_de(f.lider_id), 'corporativas') end,
    f.origen, f.cumple, f.legal_ok, f.pago_ok, f.orden_id, f.orden, i.cambio_id is not null, i.servicio_id, f.estatus
  from privado.comision_filas3(c) f join public.instalaciones i on i.id = f.instalacion_id
  union all
  select i.id, i.cliente_id, coalesce(cl.nombre, i.nombre), case when cl.id is not null then cl.doc_tipo || '-' || cl.doc_numero else i.doc_numero end, i.instalada_en, null::uuid,
    coalesce(nullif(btrim(i.instalador), ''), 'Aliado'), 'aliados', 'corte', false, coalesce(cl.legal_ok_en is not null, false), i.pago_ok_en is not null, i.orden_id, o.numero, false, i.servicio_id, coalesce(cl.estatus, 'grandes_negocios')
  from public.instalaciones i left join public.clientes cl on cl.id = i.cliente_id left join public.ordenes_odoo o on o.id = i.orden_id
  where i.es_aliado and i.anulada_en is null and privado.norm(i.categoria) !~ '(dedicad|conectiv)'
    and i.instalada_en >= privado.corte_abre(c) and i.instalada_en < privado.corte_cierre(c) $$;

-- Clientes nuevos que esperan instalación: subidos sin orden (A7) u órdenes del corte con documentos
create or replace function privado.pendientes_instalar() returns table(cliente_id bigint, nombre text, doc text, dueno_id uuid, dueno text, equipo text, desde timestamptz, orden text, docs integer, enviado boolean)
language sql stable security definer set search_path to '' as $$
  select c.id, c.nombre, c.doc_tipo || '-' || c.doc_numero, c.lider_id, coalesce(privado.nombre_de(c.lider_id), 'Por asignar'), coalesce(privado.equipo_de(c.lider_id), 'sin_dueno'),
    c.pendiente_instalar_en,
    (select o.numero from public.ordenes_odoo o where o.cliente_id = c.id order by o.creada_en desc limit 1),
    (select count(*)::int from public.documentos d where d.cliente_id = c.id and exists (select 1 from public.documento_archivos da where da.documento_id = d.id and da.vigente)),
    c.nuevo_enviado_en is not null
  from public.clientes c
  where c.pendiente_instalar_en is not null and c.unido_a is null
    and not exists (select 1 from public.servicios s where s.cliente_id = c.id)
    and not exists (select 1 from public.instalaciones i where i.cliente_id = c.id and i.anulada_en is null) $$;

-- Lista de Comisiones (maqueta 28/10): lo de comisiones_corte más equipo, carta y proforma, aliados y pendientes por instalar
create or replace function public.comisiones_lista(p_corte date default null) returns jsonb language plpgsql stable security definer set search_path to '' as $$
#variable_conflict use_variable
declare r jsonb := public.comisiones_corte(p_corte); v_rol text := privado.rol_actual(); yo uuid := (select auth.uid()); c date; filas jsonb; ali jsonb; pend jsonb; pi jsonb; actual date := privado.corte_en_curso();
  v_mis text[];
begin
  c := (r->>'corte')::date;
  select array_remove(array[privado.norm(p.nombre), privado.norm(p.nombre_odoo)], '') into v_mis from public.perfiles p where p.id = yo;
  select coalesce(jsonb_agg(e || jsonb_build_object('equipo', b.equipo, 'carta', privado.carta_estado(b.instalacion_id), 'migracion', b.migracion,
      'orden_creada', (select o.creada_en from public.ordenes_odoo o where o.id = b.orden_id))), '[]'::jsonb) into filas
  from jsonb_array_elements(r->'filas') e left join privado.com_base(c) b on b.instalacion_id = (e->>'instalacion_id')::bigint;
  -- Aliados: todos los ven (el líder sin enviar la carta)
  select coalesce(jsonb_agg(jsonb_build_object('instalacion_id', b.instalacion_id, 'cliente_id', b.cliente_id, 'nombre', b.nombre, 'doc', b.doc, 'instalada_en', b.instalada_en,
      'lider', b.dueno, 'equipo', 'aliados', 'origen', 'corte', 'legal_ok', b.legal_ok, 'pago_ok', b.pago_ok, 'cumple', false, 'orden', b.orden, 'estatus', b.estatus,
      'servicio_id', b.servicio_id, 'carta', privado.carta_estado(b.instalacion_id)) order by b.dueno, b.instalada_en), '[]'::jsonb) into ali
  from privado.com_base(c) b where b.equipo = 'aliados';
  select coalesce(jsonb_agg(to_jsonb(p) order by p.desde desc), '[]'::jsonb) into pend
  from privado.pendientes_instalar() p where v_rol <> 'lider' or p.dueno_id = yo;
  select jsonb_build_object('mas24', count(*) filter (where f.horas >= privado.orden_horas_alerta() and f.creada_en >= privado.corte_abre(actual)),
      'menos24', count(*) filter (where f.horas < privado.orden_horas_alerta() and f.creada_en >= privado.corte_abre(actual)),
      'viejas', count(*) filter (where f.creada_en < privado.corte_abre(actual)))
    into pi from privado.ordenes_abiertas() f
  where (v_rol <> 'lider' or f.lider_id = yo or f.vendedor_id = yo or privado.norm(f.lider) = any (v_mis));
  return r || jsonb_build_object('filas', filas, 'aliados', ali, 'pendientes', pend, 'pi', pi, 'horas_alerta', privado.orden_horas_alerta(),
    'yo', jsonb_build_object('id', yo, 'equipo', privado.equipo_de(yo)), 'monto', privado.comision_monto(),
    'puedo', (r->'puedo') || jsonb_build_object('enviar', v_rol in ('admin', 'analista', 'lider'), 'enviar_aliados', v_rol in ('admin', 'analista'), 'subir_nuevo', v_rol in ('admin', 'analista', 'lider'), 'horas', v_rol = 'admin'));
end $$;

-- Por instalar (pantalla 4): órdenes del corte con horas del reloj; viejas aparte; documentos subidos; clientes nuevos sin orden
create or replace function public.por_instalar() returns jsonb language plpgsql stable security definer set search_path to '' as $$
#variable_conflict use_variable
declare v_rol text := privado.exigir('admin', 'analista', 'lider'); v_yo uuid := (select auth.uid()); v_mis text[]; v_senior boolean := privado.es_senior(); filas jsonb; real jsonb; pend jsonb;
  v_abre timestamptz := privado.corte_abre(privado.corte_en_curso());
begin
  select array_remove(array[privado.norm(p.nombre), privado.norm(p.nombre_odoo)], '') into v_mis from public.perfiles p where p.id = v_yo;
  select coalesce(jsonb_agg(jsonb_build_object('orden_id', f.orden_id, 'numero', f.numero, 'titulo', f.titulo, 'etapa', f.etapa, 'creada_en', f.creada_en,
      'inicio', f.inicio, 'veces', f.veces, 'horas', f.horas, 'color', f.color, 'cliente_id', f.cliente_id, 'cliente', f.cliente, 'provisional', f.provisional,
      'parecido_id', f.parecido_id, 'parecido', f.parecido, 'lider', coalesce(f.lider, 'Por asignar'), 'de_otro', f.de_otro, 'anterior', f.creada_en < v_abre, 'vieja', f.creada_en < v_abre,
      'en_app', f.cliente_id is not null and not f.provisional,
      'docs', case when f.cliente_id is null then 0 else (select count(*) from public.documentos d where d.cliente_id = f.cliente_id and exists (select 1 from public.documento_archivos da where da.documento_id = d.id and da.vigente)) end,
      'rif', (select k.doc_tipo || '-' || k.doc_numero from public.clientes k where k.id = f.cliente_id and not k.provisional))
      order by case f.color when 'rojo' then 0 when 'ambar' then 1 else 2 end, f.horas desc), '[]'::jsonb)
  into filas from privado.ordenes_abiertas() f
  where v_rol <> 'lider' or f.lider_id = v_yo or f.vendedor_id = v_yo or privado.norm(f.lider) = any (v_mis)
     or (f.lider is null and not f.de_otro and privado.norm(f.creador) = any (v_mis));
  if v_rol = 'admin' or v_senior then
    select coalesce(jsonb_agg(jsonb_build_object('orden_id', o.id, 'numero', o.numero, 'titulo', o.titulo, 'creada_en', o.creada_en, 'ejecutada_en', o.ejecutada_en,
        'cliente_id', o.cliente_id, 'cliente', coalesce(c.nombre, nullif(o.cliente_nombre, ''), initcap(privado.titulo_nombre(o.titulo))), 'lider', coalesce(privado.nombre_de(o.vendedor_id), o.creador_nombre), 'anterior', o.creada_en < v_abre)
        order by coalesce(o.ejecutada_en, o.creada_en) desc), '[]'::jsonb)
    into real from public.ordenes_odoo o left join public.clientes c on c.id = o.cliente_id
    where o.etapa = 'Realizado' and o.tipo in ('pyme', 'evento') and o.creada_en > now() - interval '60 days'
      and not exists (select 1 from public.instalaciones i where i.orden_id = o.id)
      and not (o.cliente_id is not null and exists (select 1 from public.instalaciones i where i.cliente_id = o.cliente_id and i.instalada_en >= o.creada_en - interval '1 day'));
  end if;
  select coalesce(jsonb_agg(to_jsonb(p) order by p.desde desc), '[]'::jsonb) into pend from privado.pendientes_instalar() p where v_rol <> 'lider' or p.dueno_id = v_yo;
  return jsonb_build_object('rol', v_rol, 'ahora', now(), 'filas', filas, 'realizadas', real, 'pendientes', pend, 'horas_alerta', privado.orden_horas_alerta(), 'corte_abre', v_abre,
    'duenos', case when v_senior then (select coalesce(jsonb_agg(d), '[]'::jsonb) from privado.duenos() d) else '[]'::jsonb end,
    'desde', v_abre, 'puedo', jsonb_build_object('asignar', v_senior, 'realizadas', v_rol = 'admin' or v_senior, 'horas', v_rol = 'admin'));
end $$;

-- A7: cliente nuevo sin orden. Con un RIF que ya existe, se usa ese cliente; si hay un provisional parecido, se pregunta "¿Es este cliente?".
-- p_parecido: null = buscar parecidos; 0 = "No, es otro" (crear); id = "Sí, es ese" (el provisional recibe el RIF).
create or replace function public.cliente_nuevo(p_rif text, p_nombre text, p_parecido bigint default null) returns jsonb language plpgsql security definer set search_path to '' as $$
#variable_conflict use_variable
declare v_rol text := privado.exigir('admin', 'analista', 'lider'); yo uuid := (select auth.uid()); v_tipo text := coalesce(privado.rif_letra(p_rif), 'J'); v_num text := privado.rif_num(p_rif);
  v_nom text := left(btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g')), 200); k public.clientes; v_id bigint; par jsonb; v_clave text;
begin
  if v_num is null or v_num !~ '^[1-9][0-9]{4,9}$' then raise exception 'Escribe un RIF o cédula válido' using errcode = 'P0001'; end if;
  if v_nom = '' then raise exception 'Escribe el posible nombre del cliente' using errcode = 'P0001'; end if;
  select * into k from public.clientes where doc_numero = v_num;
  if k.id is not null then
    if k.unido_a is not null then select * into k from public.clientes where id = k.unido_a; end if;
    if not privado.puede_cliente(k.id) then
      raise exception 'Ese RIF ya es un cliente de %. Pídele al administrador que lo revise', coalesce(privado.nombre_de(k.lider_id), k.lider_nombre, 'otro líder') using errcode = 'P0001'; end if;
    return jsonb_build_object('cliente_id', k.id, 'nombre', k.nombre, 'existe', true);
  end if;
  if p_parecido is null then
    v_clave := privado.norm(split_part(v_nom, ' ', 1) || ' ' || split_part(v_nom, ' ', 2));
    select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'lider', coalesce(privado.nombre_de(c.lider_id), c.lider_nombre, 'Por asignar'))), '[]'::jsonb) into par
    from (select c.* from public.clientes c where c.provisional and c.unido_a is null and length(v_clave) >= 4
            and (privado.norm(c.nombre) like '%' || btrim(v_clave) || '%' or privado.norm(v_nom) like '%' || privado.norm(c.nombre) || '%')
            and (v_rol <> 'lider' or c.lider_id = yo or c.lider_id is null) order by c.creado_en desc limit 3) c;
    if jsonb_array_length(par) > 0 then return jsonb_build_object('parecidos', par); end if;
  elsif p_parecido > 0 then
    if not exists (select 1 from public.clientes c where c.id = p_parecido and c.provisional and c.unido_a is null
                   and (v_rol <> 'lider' or c.lider_id is null or c.lider_id = yo)) then
      raise exception 'Ese cliente ya no está disponible' using errcode = 'P0001'; end if;
    v_id := privado.provisional_rif(p_parecido, v_tipo, v_num, yo);
    update public.clientes set pendiente_instalar_en = coalesce(pendiente_instalar_en, now()), pendiente_instalar_por = coalesce(pendiente_instalar_por, yo),
      lider_id = coalesce(lider_id, case when v_rol in ('lider', 'analista') then yo end), actualizado_en = now() where id = v_id;
    insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues) values (yo, 'cliente_nuevo_sin_orden', 'clientes', v_id::text, jsonb_build_object('rif', v_tipo || '-' || v_num, 'provisional', p_parecido));
    return jsonb_build_object('cliente_id', v_id, 'nombre', (select nombre from public.clientes where id = v_id), 'unido', true);
  end if;
  insert into public.clientes (doc_tipo, doc_numero, nombre, es_natural, lider_id, estatus, estatus_desde, pendiente_instalar_en, pendiente_instalar_por)
  values (v_tipo, v_num, v_nom, v_tipo in ('V', 'E'), case when v_rol in ('lider', 'analista') then yo end, 'documentos_pendientes', now(), now(), yo)
  returning id into v_id;
  insert into public.hilo (cliente_id, tipo, texto, detalle, autor_id) values (v_id, 'dato', 'cliente_nuevo', jsonb_build_object('rif', v_tipo || '-' || v_num, 'nombre', v_nom), yo);
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues) values (yo, 'cliente_nuevo_sin_orden', 'clientes', v_id::text, jsonb_build_object('rif', v_tipo || '-' || v_num, 'nombre', v_nom));
  return jsonb_build_object('cliente_id', v_id, 'nombre', v_nom, 'creado', true);
end $$;

-- "Enviar a revisión" de un cliente nuevo: queda anotado y los documentos siguen en la bandeja del administrador (no cambia el estatus)
create or replace function public.cliente_nuevo_enviar(p_cliente bigint) returns void language plpgsql security definer set search_path to '' as $$
declare v_rol text := privado.exigir_cliente(p_cliente); yo uuid := (select auth.uid());
begin
  if v_rol not in ('admin', 'analista', 'lider') then raise exception 'No tienes permiso para hacer esto' using errcode = 'P0001'; end if;
  update public.clientes set nuevo_enviado_en = now(), actualizado_en = now() where id = p_cliente;
  insert into public.hilo (cliente_id, tipo, texto, detalle, autor_id) values (p_cliente, 'gestion', 'enviado_revision', jsonb_build_object('hecho', true), yo);
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues) values (yo, 'cliente_nuevo_enviado', 'clientes', p_cliente::text, jsonb_build_object('en', now()));
end $$;

-- A6: el aviso al líder dueño sale cuando la orden del corte pasa de 24 horas del reloj (8 a. m. a 10 p. m.); reemplaza el de 15 días
create or replace function privado.pendientes_extra() returns table(tipo text, clave text, cliente_id bigint, titulo text, detalle text, lider_id uuid, analista_id uuid, para text, desde timestamptz, vence date, ref jsonb)
language plpgsql stable security definer set search_path to '' as $$
declare hoy date := privado.hoy(); actual date := privado.corte_en_curso(); al jsonb := privado.aliados_pendientes(); v_h int := privado.orden_horas_alerta(); v_abre timestamptz := privado.corte_abre(privado.corte_en_curso());
begin
  return query select 'revisar_docs'::text, c.id::text, c.id, c.nombre,
    x.n || case when x.n = 1 then ' archivo por revisar' else ' archivos por revisar' end || coalesce(' · subió ' || x.quien, ''),
    c.lider_id, privado.analista_de(c.lider_id), 'admin'::text, x.desde, (x.desde at time zone 'America/Caracas')::date + 2, jsonb_build_object('revisar', true)
  from public.clientes c
  join lateral (select count(*) n, min(d.subido_en) desde, (array_agg(coalesce(privado.nombre_de(d.subido_por), d.subido_nombre) order by d.subido_en desc))[1] quien
                from public.documentos d where d.cliente_id = c.id and d.estado = 'por_revisar'
                  and exists (select 1 from public.documento_archivos da where da.documento_id = d.id and da.vigente)) x on x.n > 0
  where c.unido_a is null and c.suspendido_en is null;
  return query select 'elaborar_contrato'::text, c.id::text, c.id, c.nombre, privado.segmento(c.id) || ' · en Documentos recibidos desde el ' || to_char(coalesce(c.estatus_desde, c.creado_en) at time zone 'America/Caracas', 'DD/MM'),
    c.lider_id, null::uuid, 'abogado'::text, coalesce(c.estatus_desde, c.creado_en), (coalesce(c.estatus_desde, c.creado_en) at time zone 'America/Caracas')::date + 3, jsonb_build_object('estatus', c.estatus)
  from public.clientes c where c.unido_a is null and c.estatus = 'documentos_recibidos' and not c.es_natural;
  return query select 'seguir_firma'::text, c.id::text, c.id, c.nombre, 'Contrato enviado a firmar el ' || to_char(coalesce(c.estatus_desde, c.creado_en) at time zone 'America/Caracas', 'DD/MM'),
    c.lider_id, null::uuid, 'abogado'::text, coalesce(c.estatus_desde, c.creado_en), (coalesce(c.estatus_desde, c.creado_en) at time zone 'America/Caracas')::date + 7, jsonb_build_object('estatus', c.estatus)
  from public.clientes c where c.unido_a is null and c.estatus = 'por_firmar';
  return query select 'contrato_archivo'::text, c.id::text, c.id, c.nombre, case k.p when 'sin_archivo' then 'Firmado: falta subir el contrato' else 'Firmado: falta la fecha de vencimiento' end,
    c.lider_id, null::uuid, 'abogado'::text, coalesce(c.estatus_desde, c.creado_en), (coalesce(c.estatus_desde, c.creado_en) at time zone 'America/Caracas')::date + 7, jsonb_build_object('estatus', c.estatus)
  from public.clientes c cross join lateral (select privado.contrato_pendiente(c.id) p) k
  where c.unido_a is null and (c.estatus = 'contrato_firmado' or exists (select 1 from public.dedicados x where x.cliente_id = c.id)) and k.p is not null;
  return query select 'contrato_vence'::text, c.id::text, c.id, c.nombre, 'El contrato vence el ' || to_char(v.vence, 'DD/MM/YYYY') || ': avisa al líder',
    c.lider_id, null::uuid, 'abogado'::text, (v.vence - 60)::timestamptz, v.vence, jsonb_build_object('vence', v.vence)
  from (select x.cliente_id, min(x.v) vence from (
          select d.cliente_id, d.vence_en v from public.documentos d where d.casilla in ('contrato_pyme', 'contrato_dedicado') and d.vence_en between hoy and hoy + 60
          union all select k.cliente_id, k.vence_en from public.dedicado_contratos k where k.estatus = 'firmado' and k.vence_en between hoy and hoy + 60) x group by x.cliente_id) v
  join public.clientes c on c.id = v.cliente_id where c.unido_a is null;
  return query select 'revisar_pago'::text, f.instalacion_id::text, f.cliente_id, f.nombre,
    case privado.revisar_pago(f.instalacion_id) when 'factura_mes' then 'Factura nueva del mes después del día 20' else 'Tiene más de un servicio en el mismo RIF' end,
    f.lider_id, privado.analista_de(f.lider_id), 'analista'::text, f.instalada_en, (f.instalada_en at time zone 'America/Caracas')::date + 3, jsonb_build_object('instalacion', f.instalacion_id)
  from privado.comision_filas3(actual) f where f.revisar_pago and not f.pago_ok;
  if hoy >= privado.corte_limite(actual) and not privado.corte_cerrado(actual) then
    return query select 'cerrar_corte'::text, actual::text, null::bigint, 'Comisiones'::text,
      (select count(*) || ' filas · ' || count(*) filter (where f.cumple) || ' cumplen · ' || count(*) filter (where not f.cumple) || ' pasan al siguiente' from privado.comision_filas3(actual) f),
      null::uuid, null::uuid, 'senior'::text, privado.corte_limite(actual)::timestamptz, privado.corte_limite(actual), jsonb_build_object('corte', actual);
  end if;
  if coalesce((al->>'solicitudes')::int, 0) > 0 then
    return query select 'aliado_permisos'::text, 'sol'::text, null::bigint, 'Aliados'::text, (al->>'solicitudes') || ' solicitudes abiertas de aliados', null::uuid, null::uuid, 'admin'::text,
      (select min(s.creada_en) from public.aliado_solicitudes s where s.etiqueta in ('analizando', 'recaudos', 'excepcion', 'revision', 'lista', 'listaobs', 'curso')),
      ((select min(s.creada_en) from public.aliado_solicitudes s where s.etiqueta in ('analizando', 'recaudos', 'excepcion', 'revision', 'lista', 'listaobs', 'curso')) at time zone 'America/Caracas')::date + 2, jsonb_build_object('aliados', 'registro');
  end if;
  if coalesce((al->>'sin_permiso')::int, 0) > 0 then
    return query select 'aliado_sin_permiso'::text, 'sinp'::text, null::bigint, 'Aliados'::text, (al->>'sin_permiso') || ' instaladas sin autorización', null::uuid, null::uuid, 'admin'::text,
      now() - interval '1 day', hoy, jsonb_build_object('aliados', 'sinp');
  end if;
  -- Lote 28/10 A6: órdenes del corte que pasan de N horas del reloj (al líder dueño) y un resumen semanal al administrador
  return query select 'orden_atrasada'::text, o.orden_id::text, o.cliente_id, coalesce(o.cliente, 'Orden ' || o.numero),
    'Orden ' || coalesce(o.numero, '') || ' sin instalar hace ' || floor(o.horas)::int || ' horas' || case when o.cliente_id is null then ' · sin cliente en la app' else '' end,
    o.lider_id, null::uuid, 'lider'::text, o.creada_en, null::date, jsonb_build_object('orden', o.orden_id)
  from privado.ordenes_abiertas() o where o.creada_en >= v_abre and o.horas >= v_h and o.lider_id is not null;
  return query select 'ordenes_atrasadas'::text, 'sem' || to_char(hoy, 'IYYYIW'), null::bigint, 'Comisiones'::text,
    count(*) || case when count(*) = 1 then ' orden del corte pasa' else ' órdenes del corte pasan' end || ' de ' || v_h || ' horas sin instalar (' || count(*) filter (where o.cliente_id is null) || ' sin cliente en la app)',
    null::uuid, null::uuid, 'admin'::text, min(o.creada_en), null::date, jsonb_build_object('sin_instalar', true)
  from privado.ordenes_abiertas() o where o.creada_en >= v_abre and o.horas >= v_h having count(*) > 0;
  return query select 'alerta_carga'::text, k.id::text, null::bigint, 'Subidas'::text,
    case when k.estado = 'con_errores' then 'La carga del ' || to_char(k.subido_en at time zone 'America/Caracas', 'DD/MM HH24:MI') || ' (' || k.fuente || ') quedó con ' || coalesce((k.resumen->>'invalidas') || ' filas sin leer de ' || k.filas_total, 'filas sin leer') || '. Revisa el archivo en Actualizar' end,
    null::uuid, null::uuid, 'admin'::text, k.subido_en, (k.subido_en at time zone 'America/Caracas')::date + 1, jsonb_build_object('carga', k.id)
  from public.cargas k where k.estado = 'con_errores' and k.subido_en > now() - interval '3 days'
    and not (k.fuente = 'tad' and coalesce((k.resumen->>'invalidas')::int, 0) * 100 < greatest(k.filas_total, 1));
  return query select 'alerta_carga'::text, 'corto' || b.id, null::bigint, 'Subidas'::text, 'Se cargó un TAD con menos filas que el anterior (confirmado a mano)',
    null::uuid, null::uuid, 'admin'::text, b.en, (b.en at time zone 'America/Caracas')::date + 1, jsonb_build_object('bitacora', b.id)
  from public.bitacora b where b.accion = 'tad_corto_confirmado' and b.en > now() - interval '3 days';
  return query select 'alerta_carga'::text, 'noaparece', null::bigint, 'TAD'::text, n || case when n = 1 then ' cliente no aparece' else ' clientes no aparecen' end || ' en las dos últimas cargas del TAD',
    null::uuid, null::uuid, 'admin'::text, now(), hoy + 3, jsonb_build_object('no_aparece', true)
  from (select count(*) n from public.clientes c where c.no_aparece_tad_en is not null and c.unido_a is null) q where q.n > 0;
end $$;

-- A4/A5: Resumen de Comisiones por corte (pantalla 5). Todos ven el ranking; gerencia en solo lectura.
create or replace function public.comisiones_resumen(p_corte date default null) returns jsonb language plpgsql stable security definer set search_path to '' as $$
#variable_conflict use_variable
declare r text := privado.exigir('admin', 'analista', 'lider', 'abogado', 'gerencia'); yo uuid := (select auth.uid()); actual date := privado.corte_en_curso();
  v_max date := greatest(privado.corte_de(privado.hoy()), privado.corte_en_curso()); c date; p date; lm date; v_hoy date := privado.hoy();
  hasta_prev timestamptz; monto numeric := privado.comision_monto(); v_h int := privado.orden_horas_alerta(); v_abre timestamptz := privado.corte_abre(privado.corte_en_curso());
  nums jsonb; rank jsonb; lider jsonb; equipos jsonb; serie jsonb; pinst jsonb; mon jsonb; cartas jsonb; cortes jsonb; extra jsonb;
begin
  if r = 'abogado' and not coalesce((select pf.gerencia from public.perfiles pf where pf.id = yo), false) then raise exception 'No tienes permiso para ver este resumen' using errcode = 'P0001'; end if;
  c := coalesce(date_trunc('month', p_corte::timestamp)::date, actual);
  if c > v_max then c := v_max; end if;
  if c < date '2026-09-01' then c := date '2026-09-01'; end if;
  p := (c - interval '1 month')::date;
  hasta_prev := case when now() < privado.corte_cierre(c) then privado.corte_abre(p) + (now() - privado.corte_abre(c)) else privado.corte_cierre(p) end;
  lm := case when privado.corte_cerrado(c) then c else p end;

  with bc as (select * from privado.com_base(c) b where not b.migracion), bp as (select * from privado.com_base(p) b where not b.migracion)
  select jsonb_build_object(
      'inst', (select count(*) from bc where bc.origen = 'corte'),
      'inst_prev', (select count(*) from bp where bp.origen = 'corte' and bp.instalada_en < hasta_prev),
      'inst_prev_total', (select count(*) from bp where bp.origen = 'corte'),
      'comisionan', (select count(*) from bc where bc.cumple),
      'esperan', (select count(*) from bc where not bc.cumple and bc.equipo <> 'aliados'),
      'por_instalar', case when c = actual then (select count(*) from privado.ordenes_abiertas() o where o.creada_en >= v_abre and o.horas >= v_h) end,
      'mediana', (select round(percentile_cont(0.5) within group (order by extract(epoch from bc.instalada_en - o.creada_en) / 86400.0)::numeric, 1)
                  from bc join public.ordenes_odoo o on o.id = bc.orden_id where bc.origen = 'corte' and bc.instalada_en >= o.creada_en),
      'susp60', (select count(*) from bc join public.servicios s on s.id = bc.servicio_id where bc.origen = 'corte'
                   and (s.estado is distinct from 'Habilitado' or s.retirado_en is not null)
                   and coalesce(s.ult_suspension, s.retirado_en, v_hoy) - (bc.instalada_en at time zone 'America/Caracas')::date <= 60),
      'siguen_prev', (select case when count(*) > 0 then round(100.0 * count(*) filter (where s.estado = 'Habilitado' and s.retirado_en is null) / count(*)) end
                      from bp join public.servicios s on s.id = bp.servicio_id where bp.origen = 'corte'))
  into nums;

  -- Ranking del corte por equipo; los del equipo sin instalaciones salen con 0
  with bc as (select * from privado.com_base(c) b where not b.migracion and b.origen = 'corte'),
  g as (select bc.equipo, bc.dueno, bc.dueno_id, count(*) inst, count(*) filter (where bc.cumple) com from bc where bc.equipo in ('corporativas', 'canales', 'aliados') group by 1, 2, 3
        union all
        select privado.equipo_de(pf.id), pf.nombre, pf.id, 0, 0 from public.perfiles pf
        where pf.activo and pf.rol in ('lider', 'analista') and privado.equipo_de(pf.id) in ('corporativas', 'canales')
          and not exists (select 1 from bc where bc.dueno_id = pf.id)),
  o as (select g.*, row_number() over (partition by g.equipo order by g.inst desc, g.com desc, g.dueno) pos from g)
  select coalesce(jsonb_object_agg(z.equipo, z.l), '{}'::jsonb) into rank
  from (select o.equipo, jsonb_agg(jsonb_build_object('pos', o.pos, 'nombre', o.dueno, 'inst', o.inst, 'com', o.com, 'yo', o.dueno_id = yo) order by o.pos) l from o group by o.equipo) z;

  with b as (select * from privado.com_base(lm) b where not b.migracion and b.origen = 'corte'),
  g as (select b.equipo, b.dueno, count(*) inst, count(*) filter (where b.cumple) com from b where b.equipo in ('corporativas', 'canales', 'aliados') group by 1, 2),
  o as (select g.*, row_number() over (partition by g.equipo order by g.inst desc, g.com desc, g.dueno) pos from g)
  select jsonb_build_object('corte', lm, 'mes', privado.mes_nombre(lm), 'cerrado', privado.corte_cerrado(lm),
      'lider', (select jsonb_build_object('nombre', o.dueno, 'inst', o.inst, 'com', o.com) from o where o.equipo = 'corporativas' and o.pos = 1 and o.inst > 0),
      'canales', (select jsonb_build_object('nombre', o.dueno, 'inst', o.inst) from o where o.equipo = 'canales' and o.pos = 1 and o.inst > 0),
      'aliados', (select jsonb_build_object('nombre', o.dueno, 'inst', o.inst) from o where o.equipo = 'aliados' and o.pos = 1 and o.inst > 0))
  into lider;

  with bc as (select * from privado.com_base(c) b where not b.migracion and b.origen = 'corte'), bp as (select * from privado.com_base(p) b where not b.migracion and b.origen = 'corte')
  select jsonb_agg(jsonb_build_object('equipo', e.k, 'nombre', e.n, 'ahora', (select count(*) from bc where bc.equipo = e.k), 'com', (select count(*) from bc where bc.equipo = e.k and bc.cumple),
      'anterior', (select count(*) from bp where bp.equipo = e.k)) order by e.o) into equipos
  from (values ('corporativas', 'Ventas corporativas', 1), ('canales', 'Canales de atención', 2), ('aliados', 'Aliados comerciales', 3)) e(k, n, o);

  select jsonb_agg(jsonb_build_object('corte', g.k, 'mes', privado.mes_nombre(g.k), 'total', t.total, 'cumplen', t.cumplen, 'actual', g.k = c) order by g.k) into serie
  from (select (c - (n || ' month')::interval)::date k from generate_series(0, 5) n) g
  cross join lateral (select count(*) filter (where b.origen = 'corte') total, count(*) filter (where b.cumple) cumplen from privado.com_base(g.k) b where not b.migracion) t
  where g.k >= date '2026-06-01';

  if c = actual then
    select jsonb_build_object('a', count(*) filter (where o.horas < 24), 'b', count(*) filter (where o.horas >= 24 and o.horas < 72),
        'c', count(*) filter (where o.horas >= 72 and o.horas < 168), 'd', count(*) filter (where o.horas >= 168),
        'viejas', (select count(*) from privado.ordenes_abiertas() v where v.creada_en < v_abre))
      into pinst from privado.ordenes_abiertas() o where o.creada_en >= v_abre;
  end if;

  with bc as (select * from privado.com_base(c) b where not b.migracion)
  select jsonb_build_object('monto', monto, 'cumplen', count(*) filter (where bc.cumple), 'pasan', count(*) filter (where bc.origen = 'corte' and not bc.cumple and bc.equipo <> 'aliados'),
      'pierden', count(*) filter (where bc.origen = 'anterior' and not bc.cumple), 'limite', privado.corte_limite(c), 'cerrado', privado.corte_cerrado(c))
    into mon from bc;

  with bc as (select b.*, privado.carta_estado(b.instalacion_id) k from privado.com_base(c) b where b.origen = 'corte')
  select jsonb_build_object('canales', count(*) filter (where bc.k->>'k' = 'enviada'), 'lider', count(*) filter (where bc.k->>'k' = 'lider'),
      'por_enviar', count(*) filter (where bc.k->>'k' in ('por_enviar', 'falta_ip')), 'falta_ip', count(*) filter (where bc.k->>'k' = 'falta_ip'),
      'esperan', count(*) filter (where bc.k->>'k' in ('por_enviar', 'falta_ip') and (bc.k->>'dias')::int > 2))
    into cartas from bc;

  select jsonb_agg(jsonb_build_object('corte', g::date, 'mes', privado.mes_nombre(g::date), 'cerrado', privado.corte_cerrado(g::date), 'en_curso', g::date = actual) order by g desc) into cortes
  from generate_series(date '2026-09-01', v_max, interval '1 month') g;

  return jsonb_build_object('corte', c, 'mes', privado.mes_nombre(c), 'anterior', p, 'mes_anterior', privado.mes_nombre(p), 'en_curso', c = actual, 'cerrado', privado.corte_cerrado(c),
    'inicio', privado.corte_inicio(c), 'fin', privado.corte_fin(c), 'limite', privado.corte_limite(c), 'misma_fecha', now() < privado.corte_cierre(c),
    'nums', nums, 'ranking', rank, 'lider_mes', lider, 'equipos', equipos, 'serie', serie, 'por_instalar', pinst, 'monto', mon, 'cartas', cartas, 'cortes', cortes,
    'rol', r, 'yo', privado.nombre_de(yo), 'solo_lectura', r = 'gerencia' or r = 'abogado', 'horas_alerta', v_h);
end $$;

-- Detalle nuevo de las gráficas de Comisiones (pantalla 6): filas con su dueño para agrupar, chips y buscar
create or replace function privado.com_filas_det(c date, g text, x text) returns table(cliente_id bigint, n text, s text, e text, t text, d text, k text)
language plpgsql stable security definer set search_path to '' as $$
declare v_abre timestamptz := privado.corte_abre(privado.corte_en_curso()); v_hoy date := privado.hoy();
begin
  if g in ('inst', 'ranking', 'equipo', 'comisionan', 'esperan', 'monto', 'susp60', 'cartas', 'serie') then
    return query select b.cliente_id, b.nombre,
      case when b.origen = 'anterior' then 'Del corte anterior · ' else '' end || 'Instalada ' || to_char(b.instalada_en at time zone 'America/Caracas', 'DD/MM') || coalesce(' · ' || b.orden, ''),
      case when g = 'cartas' then case z.k->>'k' when 'enviada' then 'Enviada por Canales' when 'lider' then 'Enviada por el líder · falta Canales' when 'falta_ip' then 'Esperando la IP'
                                    when 'por_enviar' then 'Esperando ' || (z.k->>'dias') || case when (z.k->>'dias')::int = 1 then ' día' else ' días' end else 'Sin registro' end
           when g = 'susp60' then 'Suspendido antes de 60 días'
           when b.cumple then 'Comisiona' when b.equipo = 'aliados' then 'Aliado'
           when not b.legal_ok and not b.pago_ok then 'Falta legal y pago' when not b.legal_ok then 'Falta legal' when not b.pago_ok then 'Sin pago' else 'Falta la orden' end,
      case when g = 'cartas' then case z.k->>'k' when 'enviada' then 'ok' when 'lider' then 'b' when 'por_enviar' then case when (z.k->>'dias')::int > 2 then 'r' else 'w' end else 'w' end
           when g = 'susp60' then 'r' when b.cumple then 'ok' when b.equipo = 'aliados' then '' else 'w' end,
      b.dueno, privado.norm(b.dueno) || to_char(b.instalada_en, 'YYYYMMDDHH24MISS')
    from privado.com_base(case when g = 'serie' and split_part(x, '|', 1) ~ '^\d{4}-\d{2}-\d{2}$' then split_part(x, '|', 1)::date else c end) b
    cross join lateral (select case when g = 'cartas' then privado.carta_estado(b.instalacion_id) end k) z
    where not (b.migracion and g <> 'cartas')
      and case g
        when 'inst' then b.origen = 'corte'
        when 'serie' then b.origen = 'corte' and (split_part(x, '|', 2) = '' or b.cumple)
        when 'comisionan' then b.cumple
        when 'esperan' then not b.cumple and b.equipo <> 'aliados'
        when 'ranking' then b.origen = 'corte' and b.equipo = split_part(x, '|', 1) and (split_part(x, '|', 2) = '' or privado.norm(b.dueno) = split_part(x, '|', 2))
        when 'equipo' then b.origen = 'corte' and b.equipo = x
        when 'monto' then case x when 'cumplen' then b.cumple when 'pasan' then b.origen = 'corte' and not b.cumple and b.equipo <> 'aliados' when 'pierden' then b.origen = 'anterior' and not b.cumple else false end
        when 'susp60' then b.origen = 'corte' and exists (select 1 from public.servicios sv where sv.id = b.servicio_id and (sv.estado is distinct from 'Habilitado' or sv.retirado_en is not null)
                             and coalesce(sv.ult_suspension, sv.retirado_en, v_hoy) - (b.instalada_en at time zone 'America/Caracas')::date <= 60)
        when 'cartas' then b.origen = 'corte' and case x when 'por_enviar' then z.k->>'k' in ('por_enviar', 'falta_ip') when 'ip' then z.k->>'k' = 'falta_ip'
                                                          when 'enviadas' then z.k->>'k' in ('enviada', 'lider') when 'lider' then z.k->>'k' = 'lider' when 'canales' then z.k->>'k' = 'enviada' else true end
        else false end;
  elsif g = 'por_instalar' then
    return query select o.cliente_id, coalesce(o.cliente, 'Sin cliente en la app'), 'Orden ' || coalesce(o.numero, '') || ' · creada ' || to_char(o.creada_en at time zone 'America/Caracas', 'DD/MM') || coalesce(' · ' || o.etapa, ''),
      case when o.horas >= 48 then floor(o.horas / 14)::int || ' días' else floor(o.horas)::int || ' horas' end, case when o.horas >= 72 then 'r' when o.horas >= 24 then 'w' else '' end,
      coalesce(o.lider, 'Por asignar'), lpad((99999 - floor(o.horas))::text, 6, '0')
    from privado.ordenes_abiertas() o
    where case x when 'viejas' then o.creada_en < v_abre
      else o.creada_en >= v_abre and case x when 'a' then o.horas < 24 when 'b' then o.horas >= 24 and o.horas < 72 when 'c' then o.horas >= 72 and o.horas < 168 when 'd' then o.horas >= 168
                                         when 'mas24' then o.horas >= privado.orden_horas_alerta() else true end end;
  end if;
end $$;

create or replace function public.comisiones_detalle(p_corte date, p_grafica text, p_valor text, p_pagina integer default 0) returns jsonb language plpgsql stable security definer set search_path to '' as $$
#variable_conflict use_variable
declare r text := privado.exigir('admin', 'analista', 'lider', 'abogado', 'gerencia'); yo uuid := (select auth.uid()); c date := coalesce(date_trunc('month', p_corte::timestamp)::date, privado.corte_en_curso());
  tot int; filas jsonb; grupos jsonb; pp int := 50; v_mis text[]; v_nom text;
begin
  if r = 'abogado' and not coalesce((select pf.gerencia from public.perfiles pf where pf.id = yo), false) then raise exception 'No tienes permiso para ver este resumen' using errcode = 'P0001'; end if;
  if p_grafica is null or p_valor is null or length(p_valor) > 200 then raise exception 'Falta qué mostrar' using errcode = 'P0001'; end if;
  if c > greatest(privado.corte_de(privado.hoy()), privado.corte_en_curso()) or c < date '2026-09-01' then raise exception 'Elige un corte válido' using errcode = 'P0001'; end if;
  select array_remove(array[privado.norm(p.nombre), privado.norm(p.nombre_odoo)], '') into v_mis from public.perfiles p where p.id = yo;
  v_nom := privado.nombre_de(yo);
  if coalesce(p_pagina, 0) < 0 then pp := 5000; end if;
  -- Todos ven los totales por dueño; el líder solo ve el detalle de sus clientes y de los aliados
  select count(*) into tot from privado.com_filas_det(c, p_grafica, p_valor) f;
  select coalesce(jsonb_agg(jsonb_build_object('d', z.d, 'n', z.n) order by z.n desc, z.d), '[]'::jsonb) into grupos
  from (select f.d, count(*) n from privado.com_filas_det(c, p_grafica, p_valor) f group by f.d) z;
  select coalesce(jsonb_agg(jsonb_build_object('c', z.cliente_id, 'n', z.n, 's', z.s, 'e', z.e, 't', z.t, 'd', z.d) order by z.d, z.k), '[]'::jsonb) into filas
  from (select * from privado.com_filas_det(c, p_grafica, p_valor) f
        where r not in ('lider') or privado.norm(f.d) = any (v_mis) or exists (select 1 from public.instalaciones i where i.cliente_id = f.cliente_id and i.es_aliado)
          or exists (select 1 from public.clientes k where k.id = f.cliente_id and k.lider_id = yo)
        order by f.d, f.k offset greatest(coalesce(p_pagina, 0), 0) * pp limit pp) z;
  return jsonb_build_object('total', tot, 'grupos', grupos, 'pagina', greatest(coalesce(p_pagina, 0), 0), 'por_pagina', pp, 'filas', filas,
    'lista', privado.res_lista('comisiones', p_grafica, p_valor), 'solo_lectura', r in ('gerencia', 'abogado'));
end $$;

-- Ajuste (lote28_a2_comisiones_5): el dueño que viene solo por nombre se busca en Usuarios, para que no salga repetido en el ranking
create or replace function privado.perfil_por_nombre(t text) returns uuid language sql stable security definer set search_path to '' as $$
  select p.id from public.perfiles p where t is not null and privado.norm(t) <> '' and privado.norm(t) in (privado.norm(p.nombre), privado.norm(coalesce(p.nombre_odoo, '')))
  order by p.activo desc, (p.rol in ('lider', 'analista')) desc, p.creado_en limit 1 $$;

create or replace function privado.com_base(c date) returns table(instalacion_id bigint, cliente_id bigint, nombre text, doc text, instalada_en timestamptz, dueno_id uuid, dueno text, equipo text,
  origen text, cumple boolean, legal_ok boolean, pago_ok boolean, orden_id bigint, orden text, migracion boolean, servicio_id bigint, estatus text)
language sql stable security definer set search_path to '' as $$
  select f.instalacion_id, f.cliente_id, f.nombre, f.doc, f.instalada_en, d.id, coalesce(privado.nombre_de(d.id), f.lider),
    case when f.lider = 'Por asignar' then 'sin_dueno' else coalesce(privado.equipo_de(d.id), 'corporativas') end,
    f.origen, f.cumple, f.legal_ok, f.pago_ok, f.orden_id, f.orden, i.cambio_id is not null, i.servicio_id, f.estatus
  from privado.comision_filas3(c) f join public.instalaciones i on i.id = f.instalacion_id
  cross join lateral (select coalesce(f.lider_id, case when f.lider <> 'Por asignar' then privado.perfil_por_nombre(f.lider) end) id) d
  union all
  select i.id, i.cliente_id, coalesce(cl.nombre, i.nombre), case when cl.id is not null then cl.doc_tipo || '-' || cl.doc_numero else i.doc_numero end, i.instalada_en, null::uuid,
    coalesce(nullif(btrim(i.instalador), ''), 'Aliado'), 'aliados', 'corte', false, coalesce(cl.legal_ok_en is not null, false), i.pago_ok_en is not null, i.orden_id, o.numero, false, i.servicio_id, coalesce(cl.estatus, 'grandes_negocios')
  from public.instalaciones i left join public.clientes cl on cl.id = i.cliente_id left join public.ordenes_odoo o on o.id = i.orden_id
  where i.es_aliado and i.anulada_en is null and privado.norm(i.categoria) !~ '(dedicad|conectiv)'
    and i.instalada_en >= privado.corte_abre(c) and i.instalada_en < privado.corte_cierre(c) $$;
