-- Lote 16/11 A, tramo 3: Comisiones, bloques "Por instalar" y "Migraciones" dentro del líder, y órdenes perdidas (parte 4).
-- No toca privado.comision_filas3: los bloques salen de una función aparte.

-- Una orden marcada como perdida sale de las abiertas (Por instalar, avisos y bloques)
select privado.redefinir('privado.ordenes_abiertas'::regproc::regprocedure, jsonb_build_array(jsonb_build_array(
  'where b.etapa not in (''Realizado'', ''Cancelado'') and b.creada_en > now() - interval ''60 days''',
  'where b.etapa not in (''Realizado'', ''Cancelado'') and b.creada_en > now() - interval ''60 days'' and b.perdida_en is null')));

-- Por instalar: lista de las perdidas (últimos 60 días) para su filtro
select privado.redefinir('public.por_instalar'::regproc::regprocedure, jsonb_build_array(jsonb_build_array(
  'return jsonb_build_object(''rol'', v_rol, ''ahora'', now(),',
  'return jsonb_build_object(''perdidas'', (select coalesce(jsonb_agg(jsonb_build_object(''orden_id'', o.id, ''numero'', o.numero, ''titulo'', o.titulo, ''creada_en'', o.creada_en,
      ''cliente_id'', o.cliente_id, ''cliente'', coalesce(c.nombre, nullif(o.cliente_nombre, ''''), initcap(privado.titulo_nombre(o.titulo))), ''lider'', coalesce(privado.nombre_de(o.vendedor_id), o.creador_nombre),
      ''perdida_en'', o.perdida_en, ''perdida_por'', privado.nombre_de(o.perdida_por), ''motivo'', o.perdida_motivo) order by o.perdida_en desc), ''[]''::jsonb)
    from public.ordenes_odoo o left join public.clientes c on c.id = o.cliente_id
    where o.perdida_en > now() - interval ''60 days'' and (v_rol <> ''lider'' or o.vendedor_id = v_yo or privado.norm(o.creador_nombre) = any (v_mis))),
    ''puedo_perdida'', current_setting(''transaction_read_only'', true) <> ''on'',
    ''rol'', v_rol, ''ahora'', now(),')));

-- Marcar una orden como perdida (o recuperarla) con motivo. Bitácora.
create or replace function public.orden_perdida(p_orden bigint, p_motivo text, p_recuperar boolean default false) returns void language plpgsql security definer set search_path to '' as $$
declare v_rol text := privado.exigir('admin', 'analista', 'lider'); v_yo uuid := (select auth.uid()); o public.ordenes_odoo; mot text := left(nullif(btrim(coalesce(p_motivo, '')), ''), 300); mis text[];
begin
  select * into o from public.ordenes_odoo where id = p_orden for update;
  if not found then raise exception 'No encontré esa orden' using errcode = 'P0001'; end if;
  if v_rol = 'lider' then
    select array_remove(array[privado.norm(p.nombre), privado.norm(p.nombre_odoo)], '') into mis from public.perfiles p where p.id = v_yo;
    if not (o.vendedor_id = v_yo or privado.norm(o.creador_nombre) = any (mis)
            or exists (select 1 from privado.ordenes_abiertas() f where f.orden_id = o.id and f.lider_id = v_yo)) then
      raise exception 'Esa orden no es tuya' using errcode = 'P0001'; end if;
  end if;
  if p_recuperar then
    if v_rol <> 'admin' and not privado.es_senior() then raise exception 'La recupera el administrador o la Senior' using errcode = 'P0001'; end if;
    if o.perdida_en is null then raise exception 'Esa orden no está marcada como perdida' using errcode = 'P0001'; end if;
    update public.ordenes_odoo set perdida_en = null, perdida_por = null, perdida_motivo = null where id = p_orden;
    insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues) values (v_yo, 'orden_recuperada', 'ordenes_odoo', p_orden::text, jsonb_build_object('motivo', o.perdida_motivo), jsonb_build_object('perdida', false));
    return;
  end if;
  if o.perdida_en is not null then raise exception 'Esa orden ya está marcada como perdida' using errcode = 'P0001'; end if;
  if mot is null or length(mot) < 4 then raise exception 'Escribe el motivo' using errcode = 'P0001'; end if;
  update public.ordenes_odoo set perdida_en = now(), perdida_por = v_yo, perdida_motivo = mot where id = p_orden;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues) values (v_yo, 'orden_perdida', 'ordenes_odoo', p_orden::text, jsonb_build_object('motivo', mot, 'numero', o.numero));
end $$;
grant execute on function public.orden_perdida(bigint, text, boolean) to authenticated;

-- Estado de documentos de un cliente para las filas: sin documentos, faltan N, completos
create or replace function privado.docs_estado(p_cliente bigint) returns jsonb language sql stable security definer set search_path to '' as $$
  select case when p_cliente is null then jsonb_build_object('subidos', 0, 'faltan', null)
    else jsonb_build_object(
      'subidos', (select count(*) from public.documentos d where d.cliente_id = p_cliente and exists (select 1 from public.documento_archivos da where da.documento_id = d.id and da.vigente)),
      'faltan', (select count(*) from privado.requeridos(p_cliente) rq where not exists (select 1 from public.documentos d where d.cliente_id = p_cliente and d.casilla = rq.r_casilla and d.numero = rq.r_numero
                   and exists (select 1 from public.documento_archivos da where da.documento_id = d.id and da.vigente)))) end
$$;

-- Bloques dentro del plegable del líder en Comisiones (corte en curso)
create or replace function public.comisiones_bloques() returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare v_rol text := privado.exigir('admin', 'analista', 'lider', 'abogado'); v_yo uuid := (select auth.uid()); v_mis text[]; actual date := privado.corte_en_curso();
begin
  select array_remove(array[privado.norm(p.nombre), privado.norm(p.nombre_odoo)], '') into v_mis from public.perfiles p where p.id = v_yo;
  return jsonb_build_object('corte', actual, 'ahora', now(),
    -- Órdenes de Odoo abiertas sin instalación con hasta 5 días de reloj (las de más días siguen en la pestaña Por instalar)
    'ordenes', coalesce((select jsonb_agg(jsonb_build_object('orden_id', f.orden_id, 'numero', f.numero, 'creada_en', f.creada_en, 'inicio', coalesce(f.inicio, f.creada_en),
        'cliente_id', f.cliente_id, 'cliente', f.cliente, 'provisional', f.provisional, 'lider', f.lider, 'lider_id', f.lider_id,
        'equipo', (select coalesce(p.equipo_com, 'corporativas') from public.perfiles p where p.id = f.lider_id),
        'rif', (select k.doc_tipo || '-' || k.doc_numero from public.clientes k where k.id = f.cliente_id and not coalesce(k.provisional, false)),
        'docs', privado.docs_estado(f.cliente_id)) order by coalesce(f.inicio, f.creada_en))
      from privado.ordenes_abiertas() f
      where coalesce(f.inicio, f.creada_en) > now() - interval '5 days'
        and (v_rol <> 'lider' or f.lider_id = v_yo or f.vendedor_id = v_yo or privado.norm(f.lider) = any (v_mis)
             or (f.lider is null and not f.de_otro and privado.norm(f.creador) = any (v_mis)))), '[]'::jsonb),
    -- Migraciones del líder: sin registrar y registradas (las confirmadas que ya comisionan salen como fila del corte)
    'migraciones', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'estado', c.estado, 'borrador', c.borrador, 'tipo', c.tipo, 'comision', c.comision,
        'fecha', coalesce(c.fecha_cambio, c.creado_en), 'titular', c.titular_nombre, 'doc_tipo', c.titular_tipo, 'doc', c.titular_doc, 'servicios', c.servicios,
        'categoria_anterior', c.categoria_anterior, 'categoria_nueva', c.categoria_nueva, 'cliente_id', coalesce(c.nuevo_cliente_id, c.cliente_id),
        'lider', privado.nombre_de(privado.cambio_dueno(c)), 'lider_id', privado.cambio_dueno(c),
        'equipo', (select coalesce(p.equipo_com, 'corporativas') from public.perfiles p where p.id = privado.cambio_dueno(c)),
        'faltan', (select count(*) from jsonb_array_elements(privado.cambio_requisitos(c.id)) r where r->>'estado' in ('falta', 'devuelto'))) order by coalesce(c.fecha_cambio, c.creado_en))
      from public.cambios c
      where c.tipo in ('migracion', 'ambos') and c.origen <> 'historico'
        and (c.estado in ('sin_registro', 'por_revisar', 'por_emitir', 'por_confirmar')
             or (c.estado = 'confirmado' and c.instalacion_id is null and c.fecha_cambio is not null and privado.corte_de((c.fecha_cambio at time zone 'America/Caracas')::date) = actual))
        and (v_rol <> 'lider' or privado.cambio_dueno(c) = v_yo or c.creado_por = v_yo)), '[]'::jsonb));
end $$;
grant execute on function public.comisiones_bloques() to authenticated;
