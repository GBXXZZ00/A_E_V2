-- Lote 12/11 B, parte 3: Cliente nuevo con el RIF.
-- 1) cliente_rif_buscar: con lo leído del RIF dice si el cliente es nuevo, ya está (y se puede abrir) o es de otro líder, sin crear nada.
-- 2) cliente_nuevo: si el RIF es de otro líder, el mensaje ya no dice su nombre (decisión del 12/11).
create or replace function public.cliente_rif_buscar(p_rif text, p_nombre text default null)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
#variable_conflict use_variable
declare v_rol text := privado.exigir('admin', 'analista', 'lider'); yo uuid := (select auth.uid()); v_num text := privado.rif_num(p_rif);
  v_nom text := left(btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g')), 200); k public.clientes; par jsonb; v_clave text;
begin
  if v_num is null or v_num !~ '^[1-9][0-9]{4,9}$' then raise exception 'Escribe un RIF o cédula válido' using errcode = 'P0001'; end if;
  select * into k from public.clientes where doc_numero = v_num;
  if k.id is not null then
    if k.unido_a is not null then select * into k from public.clientes where id = k.unido_a; end if;
    if not privado.puede_cliente(k.id) then return jsonb_build_object('estado', 'otro'); end if;
    return jsonb_build_object('estado', 'existe', 'cliente_id', k.id, 'nombre', k.nombre, 'estatus', k.estatus);
  end if;
  v_clave := privado.norm(split_part(v_nom, ' ', 1) || ' ' || split_part(v_nom, ' ', 2));
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'lider', coalesce(privado.nombre_de(c.lider_id), c.lider_nombre, 'Por asignar'))), '[]'::jsonb) into par
  from (select c.* from public.clientes c where c.provisional and c.unido_a is null and length(v_clave) >= 4
          and (privado.norm(c.nombre) like '%' || btrim(v_clave) || '%' or privado.norm(v_nom) like '%' || privado.norm(c.nombre) || '%')
          and (v_rol <> 'lider' or c.lider_id = yo or c.lider_id is null) order by c.creado_en desc limit 3) c;
  return jsonb_build_object('estado', 'nuevo', 'parecidos', par);
end $function$;
revoke all on function public.cliente_rif_buscar(text, text) from public, anon;
grant execute on function public.cliente_rif_buscar(text, text) to authenticated;
CREATE OR REPLACE FUNCTION public.cliente_nuevo(p_rif text, p_nombre text, p_parecido bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare v_rol text := privado.exigir('admin', 'analista', 'lider'); yo uuid := (select auth.uid()); v_tipo text := coalesce(privado.rif_letra(p_rif), 'J'); v_num text := privado.rif_num(p_rif);
  v_nom text := left(btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g')), 200); k public.clientes; v_id bigint; par jsonb; v_clave text;
begin
  if v_num is null or v_num !~ '^[1-9][0-9]{4,9}$' then raise exception 'Escribe un RIF o cédula válido' using errcode = 'P0001'; end if;
  if v_nom = '' then raise exception 'Escribe el posible nombre del cliente' using errcode = 'P0001'; end if;
  select * into k from public.clientes where doc_numero = v_num;
  if k.id is not null then
    if k.unido_a is not null then select * into k from public.clientes where id = k.unido_a; end if;
    -- Lote 12/11 B: sin el nombre del otro líder
    if not privado.puede_cliente(k.id) then
      raise exception 'Ese RIF ya es de otro líder. Pídele al administrador que lo revise.' using errcode = 'P0001'; end if;
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
    -- Unir a un provisional no cambia su dueño: si no tiene, lo elige la Analista Senior en Por instalar
    update public.clientes set pendiente_instalar_en = coalesce(pendiente_instalar_en, now()), pendiente_instalar_por = coalesce(pendiente_instalar_por, yo), actualizado_en = now() where id = v_id;
    insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues) values (yo, 'cliente_nuevo_sin_orden', 'clientes', v_id::text, jsonb_build_object('rif', v_tipo || '-' || v_num, 'provisional', p_parecido, 'lider', (select privado.nombre_de(lider_id) from public.clientes where id = v_id)));
    return jsonb_build_object('cliente_id', v_id, 'nombre', (select nombre from public.clientes where id = v_id), 'unido', true);
  end if;
  insert into public.clientes (doc_tipo, doc_numero, nombre, es_natural, lider_id, estatus, estatus_desde, pendiente_instalar_en, pendiente_instalar_por)
  values (v_tipo, v_num, v_nom, v_tipo in ('V', 'E'), case when v_rol in ('lider', 'analista') then yo end, 'documentos_pendientes', now(), now(), yo)
  returning id into v_id;
  insert into public.hilo (cliente_id, tipo, texto, detalle, autor_id) values (v_id, 'dato', 'cliente_nuevo', jsonb_build_object('rif', v_tipo || '-' || v_num, 'nombre', v_nom), yo);
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues) values (yo, 'cliente_nuevo_sin_orden', 'clientes', v_id::text, jsonb_build_object('rif', v_tipo || '-' || v_num, 'nombre', v_nom));
  return jsonb_build_object('cliente_id', v_id, 'nombre', v_nom, 'creado', true);
end $function$;
