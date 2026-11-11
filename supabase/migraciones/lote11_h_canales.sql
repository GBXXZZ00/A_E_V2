-- Lote 11/11, H2 (coordinadora de Canales) y H3 (analista): asignar tareas a una persona, recordarle, y los datos de cada fila
-- (teléfono para WhatsApp, carta descargada sin confirmar, IP sugerida del pool). Aplicada con el conector como migración.

create table if not exists public.trabajo_asignaciones (
  tipo text not null, clave text not null, analista_id uuid not null references public.perfiles(id),
  por uuid references public.perfiles(id), en timestamptz not null default now(),
  primary key (tipo, clave));
alter table public.trabajo_asignaciones enable row level security;
revoke all on public.trabajo_asignaciones from anon, authenticated;

-- Igual que antes, pero si la coordinadora pasó una tarea a otra persona, esa persona es la dueña
create or replace function privado.trabajo_items(p_quien uuid, p_vista text, p_yo uuid, p_persona uuid)
 returns table(tipo text, clave text, cliente_id bigint, titulo text, detalle text, lider_id uuid, analista_id uuid, para text, desde timestamp with time zone, vence date, ref jsonb)
 language plpgsql stable security definer set search_path to '' as $function$
declare sin_rev boolean := exists (select 1 from public.perfiles pf where pf.id = p_quien and pf.rol = 'analista' and pf.senior);
begin
  return query
  with base0 as (select * from privado.pendientes() union all select * from privado.pendientes_extra() union all select * from privado.pendientes_buzon()
    union all
    select 'pedido'::text, z.id::text, z.cliente_id, k.nombre, 'Falta: ' || z.texto || coalesce(' · ' || z.motivo, ''), k.lider_id, privado.analista_de(k.lider_id), 'lider'::text,
      z.creado_en, (z.creado_en at time zone 'America/Caracas')::date + 3, jsonb_build_object('casilla', z.casilla, 'numero', z.numero, 'requerimiento', z.id)
    from public.requerimientos z join public.clientes k on k.id = z.cliente_id where z.estado = 'abierto' and k.unido_a is null
    union all
    -- Lote 10/11 J5: por solicitud, y dice si toca el Contrato VGT o el Adendum N.º n
    select 'elaborar_vgt'::text, kk.id::text, kk.cliente_id, c.nombre, coalesce(privado.vgt_doc_tipo(kk.id)->>'titulo', 'VGT') || ' · ' || coalesce(kk.proyecto, 'Solicitud ' || kk.id) || coalesce(' · ' || kk.postes || ' postes', ''),
      coalesce(dd.ejecutiva_id, c.lider_id), null::uuid, 'abogado'::text, kk.actualizado_en, (kk.actualizado_en at time zone 'America/Caracas')::date + 3, jsonb_build_object('contrato', kk.id, 'doc', privado.vgt_doc_tipo(kk.id))
    from public.dedicado_contratos kk join public.clientes c on c.id = kk.cliente_id left join public.dedicados dd on dd.cliente_id = c.id
    where kk.tipo = 'vgt' and kk.estatus in ('sin_contrato', 'en_elaboracion') and c.unido_a is null and privado.vgt_sol_pide(kk.id)
      and privado.vgt_sol_req(kk.id) = 0 and privado.vgt_polizas_faltan(kk.cliente_id) = 0),
  -- Lote 11/11 H2: la asignación de la coordinadora manda sobre la del líder
  base as (select b0.tipo, b0.clave, b0.cliente_id, b0.titulo, b0.detalle, b0.lider_id, coalesce(ta.analista_id, b0.analista_id) analista_id, b0.para, b0.desde, b0.vence, b0.ref
    from base0 b0 left join public.trabajo_asignaciones ta on ta.tipo = b0.tipo and ta.clave = b0.clave and b0.para = 'analista'),
  mio as (select b.* from base b where (b.para = 'vende' and b.lider_id = p_quien) or case p_vista
      when 'admin' then b.para in ('admin', 'senior') or (b.para = 'analista' and b.analista_id = p_quien and p_quien <> p_yo)
      when 'coord' then b.para = 'analista' and (p_persona is null or p_quien = p_yo or b.analista_id = p_quien)
      when 'analista' then b.para = 'analista' and (b.analista_id = p_quien or (b.analista_id is null and p_quien = p_yo) or (b.analista_id is null and b.tipo = 'carta_enviar'))
      when 'abogado' then b.para = 'abogado'
      when 'lider' then b.para = 'lider' and b.lider_id = p_quien
      else false end),
  gesitems as (select 'gestion'::text tipo, gc.gestion_id || ':' || gc.cliente_id clave, gc.cliente_id, k.nombre titulo,
      g.nombre || ' · ' || case gc.estado when 'contactado' then 'Contactado' when 'esperando' then 'Esperando' else 'Sin contacto' end || coalesce(' · ' || gc.nota, '') detalle,
      k.lider_id, null::uuid analista_id, 'lider'::text para, gc.actualizado_en desde, coalesce(gc.promesa, g.plazo) vence, jsonb_build_object('gestion', g.id, 'estado', gc.estado) ref
    from public.gestion_clientes gc join public.gestiones g on g.id = gc.gestion_id join public.clientes k on k.id = gc.cliente_id
    where g.estado = 'activa' and gc.estado not in ('cumplido', 'resuelto') and not privado.gestion_meta_ok(g.meta, gc.cliente_id)
      and p_vista = 'lider' and exists (select 1 from public.gestion_responsables x where x.gestion_id = g.id and x.perfil_id = p_quien))
  select t.* from (select * from mio union all select * from gesitems) t
  where not (sin_rev and t.tipo in ('revisar_docs', 'cambio_revisar'));
end $function$;

-- Datos de Canales para Mi trabajo: el equipo con su carga, teléfono de cada carta, cartas descargadas sin confirmar, IP del pool y órdenes sin dueño
create or replace function public.trabajo_canales() returns jsonb
 language plpgsql stable security definer set search_path to '' as $function$
declare r text := privado.exigir('admin', 'analista'); yo uuid := (select auth.uid()); jefe boolean; coord boolean := privado.es_coordinador(); n_ip int;
begin
  jefe := r = 'admin' or privado.es_senior();
  return (with eq as (select * from privado.trabajo_items(yo, 'coord', yo, null)),
  srv as (select distinct (e.ref->>'servicio')::bigint sid from eq e where e.tipo in ('carta_enviar', 'por_enviar', 'sin_ip') and (e.ref->>'servicio') ~ '^[0-9]+$'),
  dat as (select s.id sid,
      coalesce((select jsonb_build_object('t', rp.telefono, 'de', case when c.es_natural then 'Titular' else 'Representante' end) from public.representantes rp
                where rp.cliente_id = c.id and length(regexp_replace(coalesce(rp.telefono, ''), '\D', '', 'g')) >= 10 order by rp.orden limit 1),
               case when length(regexp_replace(coalesce(c.telefono, ''), '\D', '', 'g')) >= 10 then jsonb_build_object('t', c.telefono, 'de', 'Proham') end,
               case when length(regexp_replace(coalesce(s.telefono, ''), '\D', '', 'g')) >= 10 then jsonb_build_object('t', s.telefono, 'de', 'TAD') end) tel,
      (select jsonb_build_object('en', x.en, 'por', privado.nombre_de(x.por)) from public.carta_descargas x where x.servicio_id = s.id
         and not exists (select 1 from public.envios e where e.servicio_id = s.id and e.tipo = 'bienvenida' and e.en >= x.en - interval '1 minute') order by x.en desc limit 1) descargada,
      (select i.instalada_en from public.instalaciones i where i.servicio_id = s.id and i.anulada_en is null order by i.instalada_en desc nulls last limit 1) instalada
    from srv join public.servicios s on s.id = srv.sid join public.clientes c on c.id = s.cliente_id),
  an as (select p.id, p.nombre from public.perfiles p where p.activo and p.rol = 'analista')
  select jsonb_build_object('hoy', privado.hoy(), 'coord', coord, 'jefe', jefe,
    'extra', coalesce((select jsonb_object_agg(d.sid::text, jsonb_build_object('tel', d.tel, 'descargada', d.descargada, 'instalada', d.instalada)) from dat d), '{}'::jsonb),
    'pool', coalesce((select jsonb_agg(jsonb_build_object('fila', p.id, 'ip', p.ip) order by p.ip::inet) from privado.ip_pool((select count(*)::int from eq where eq.tipo = 'sin_ip')) p), '[]'::jsonb),
    'analistas', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'nombre', a.nombre) order by a.nombre) from an a), '[]'::jsonb),
    'equipo', coalesce((select jsonb_agg(jsonb_build_object('tipo', e.tipo, 'clave', e.clave, 'cliente_id', e.cliente_id, 'titulo', e.titulo, 'detalle', e.detalle, 'vence', e.vence, 'desde', e.desde,
        'lider', privado.nombre_de(e.lider_id), 'analista_id', e.analista_id, 'analista', privado.nombre_de(e.analista_id), 'ref', e.ref) order by e.vence nulls last, e.desde) from eq e), '[]'::jsonb),
    'carga', coalesce((select jsonb_agg(z order by z.venc desc, z.n desc) from (
        select a.id, a.nombre, count(e.*) n, count(e.*) filter (where e.vence < privado.hoy()) venc, count(e.*) filter (where e.vence = privado.hoy()) hoy,
          count(e.*) filter (where e.tipo in ('carta_enviar', 'por_enviar')) cartas, count(e.*) filter (where e.tipo in ('sin_ip', 'ip_confirmar')) ip,
          count(e.*) filter (where e.tipo = 'cambio_emitir') emi, count(e.*) filter (where e.tipo = 'revisar_pago') pago
        from an a left join eq e on e.analista_id = a.id group by a.id, a.nombre) z), '[]'::jsonb),
    'sin_asignar', (select count(*) from eq e where e.analista_id is null),
    'sin_dueno', case when coord or jefe then coalesce((select jsonb_agg(jsonb_build_object('tipo', b.tipo, 'clave', b.clave, 'cliente_id', b.cliente_id, 'titulo', b.titulo, 'detalle', b.detalle,
        'desde', b.desde, 'vence', b.vence, 'ref', b.ref) order by b.desde) from privado.pendientes() b where b.tipo = 'por_asignar'), '[]'::jsonb) else '[]'::jsonb end));
end $function$;
revoke all on function public.trabajo_canales() from public, anon;
grant execute on function public.trabajo_canales() to authenticated;

-- Pasar una tarea de Canales a otra persona (coordinadora, Analista Senior o administrador)
create or replace function public.trabajo_pasar(p_tipo text, p_clave text, p_analista uuid) returns jsonb
 language plpgsql security definer set search_path to '' as $function$
declare r text := privado.exigir('admin', 'analista'); yo uuid := (select auth.uid()); it record; a public.perfiles;
begin
  if not (r = 'admin' or privado.es_senior() or privado.es_coordinador()) then raise exception 'Solo la coordinadora o el administrador pueden pasar tareas' using errcode = 'P0001'; end if;
  select * into a from public.perfiles where id = p_analista and activo and rol = 'analista';
  if a.id is null then raise exception 'Elige a una persona de Canales' using errcode = 'P0001'; end if;
  select * into it from privado.trabajo_items(yo, 'coord', yo, null) t where t.tipo = p_tipo and t.clave = p_clave limit 1;
  if it.tipo is null then raise exception 'Esa tarea ya no está pendiente' using errcode = 'P0001'; end if;
  insert into public.trabajo_asignaciones (tipo, clave, analista_id, por) values (p_tipo, p_clave, p_analista, yo)
  on conflict (tipo, clave) do update set analista_id = excluded.analista_id, por = excluded.por, en = now();
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues)
  values (yo, 'trabajo_pasado', 'trabajo_asignaciones', p_tipo || ':' || p_clave, jsonb_build_object('analista', privado.nombre_de(it.analista_id)), jsonb_build_object('analista', a.nombre, 'titulo', it.titulo));
  if it.cliente_id is not null then
    insert into public.hilo (cliente_id, tipo, texto, detalle, autor_id) values (it.cliente_id, 'dato', 'trabajo_pasado', jsonb_build_object('a', a.nombre, 'que', it.detalle), yo);
  end if;
  if p_analista <> yo then
    perform privado.aviso_poner(p_analista, 'trabajo_pasado', 'Te pasaron una tarea: ' || coalesce(it.titulo, ''), coalesce(it.detalle, '') || '. La tienes en Mi trabajo.',
      'trabajo.html', 'pasado_' || p_tipo || ':' || p_clave || ':' || extract(epoch from now())::bigint, false);
  end if;
  return jsonb_build_object('analista', a.nombre);
end $function$;
revoke all on function public.trabajo_pasar(text, text, uuid) from public, anon;
grant execute on function public.trabajo_pasar(text, text, uuid) to authenticated;

-- Recordarle a la persona que tiene la tarea (una vez al día por tarea)
create or replace function public.trabajo_recordar(p_tipo text, p_clave text) returns jsonb
 language plpgsql security definer set search_path to '' as $function$
declare r text := privado.exigir('admin', 'analista'); yo uuid := (select auth.uid()); it record;
begin
  if not (r = 'admin' or privado.es_senior() or privado.es_coordinador()) then raise exception 'Solo la coordinadora o el administrador pueden enviar recordatorios' using errcode = 'P0001'; end if;
  select * into it from privado.trabajo_items(yo, 'coord', yo, null) t where t.tipo = p_tipo and t.clave = p_clave limit 1;
  if it.tipo is null then raise exception 'Esa tarea ya no está pendiente' using errcode = 'P0001'; end if;
  if it.analista_id is null then raise exception 'Nadie tiene esa tarea todavía. Pásala a una persona primero' using errcode = 'P0001'; end if;
  perform privado.aviso_poner(it.analista_id, 'trabajo_recordar', 'Recordatorio: ' || coalesce(it.titulo, ''), coalesce(it.detalle, '') || '. Te lo recuerda ' || coalesce(privado.nombre_de(yo), 'la coordinadora') || '.',
    'trabajo.html', 'recordar_' || p_tipo || ':' || p_clave || ':' || privado.hoy(), false);
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues)
  values (yo, 'trabajo_recordado', 'trabajo_asignaciones', p_tipo || ':' || p_clave, jsonb_build_object('a', privado.nombre_de(it.analista_id), 'titulo', it.titulo));
  return jsonb_build_object('a', privado.nombre_de(it.analista_id));
end $function$;
revoke all on function public.trabajo_recordar(text, text) from public, anon;
grant execute on function public.trabajo_recordar(text, text) to authenticated;
