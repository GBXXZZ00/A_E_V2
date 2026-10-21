-- Lote A (21/10). Aplicado con el conector (migración lote_a1_avisos_grupos_contacto).
-- Probado con rollback: líder ante documentos en revisión -> paso admin, destino el administrador; el administrador ante lo mismo -> propio (sin botón);
--   el administrador ante documentos pendientes -> el líder; agrupado: 'Documentos por revisar' 318 con 304 vencidos (el 'v:' se une a su 'p:').
-- avisos_push v2: agrupa por tipo (más de 3 del mismo tipo, uno solo con el número).

-- Lote A1: avisos agrupados por categoría (el "Venció" va dentro de su aviso como marca roja) y leer por grupo
create or replace function privado.aviso_grupo(t text)
 returns text language sql immutable set search_path to ''
as $function$
  select case t when 'cliente' then 'Clientes' when 'cambio' then 'Migraciones' when 'corte' then 'Cortes' when 'comision' then 'Comisiones'
    when 'cuenta' then 'Tu cuenta' when 'resumen_docs' then 'Clientes con documentos por conseguir' when 'corte_cerca' then 'Cierre del corte'
    when 'gestion' then 'Gestiones' when 'aliado' then 'Aliados' when 'aliado_pago' then 'Pagos de aliados'
    else case when privado.aviso_titulo(t) = 'Tarea nueva' then 'Otros avisos' else privado.aviso_titulo(t) end end
$function$;

-- Cada aviso que se ve: el "v:" (venció) se une a su pendiente "p:" y lo marca; ids trae los dos para marcarlos leídos juntos
create or replace function privado.avisos_items(yo uuid)
 returns table(id bigint, tipo text, titulo text, texto text, enlace text, en timestamptz, leido boolean, vencido boolean, ids bigint[])
 language sql stable security definer set search_path to ''
as $function$
  select a.id, a.tipo, a.titulo, a.texto, a.enlace, a.creado_en,
    a.leido_en is not null and (v.id is null or v.leido_en is not null),
    a.clave like 'v:%' or a.clave like 'atr:%' or v.id is not null,
    array_remove(array[a.id, v.id], null)
  from public.avisos a
  left join public.avisos v on a.clave like 'p:%' and v.para = a.para and v.clave = 'v:' || substr(a.clave, 3) and v.apagado_en is null
  where a.para = yo and a.apagado_en is null
    and not (a.clave like 'v:%' and exists (select 1 from public.avisos p where p.para = a.para and p.clave = 'p:' || substr(a.clave, 3) and p.apagado_en is null))
    and (a.clave ~ '^(p|v|atr):' or a.leido_en is null or a.creado_en > now() - interval '14 days')
$function$;
revoke all on function privado.avisos_items(uuid) from public, anon, authenticated;

create or replace function public.avisos_contar()
 returns integer language sql stable security definer set search_path to ''
as $function$
  select count(*)::int from privado.avisos_items((select auth.uid())) i where not i.leido
$function$;

create or replace function public.avisos_mios(p_limite integer default 40)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare yo uuid := (select auth.uid());
begin
  perform privado.exigir('admin', 'abogado', 'analista', 'lider', 'aliado');
  return (with it as (select * from privado.avisos_items(yo))
    select jsonb_build_object(
      'sin_leer', (select count(*) from it where not it.leido),
      'grupos', coalesce((select jsonb_agg(g order by (g.sin_leer > 0) desc, g.vencidos desc, g.ultimo desc) from (
          select it.tipo, privado.aviso_grupo(it.tipo) nombre, count(*) filter (where not it.leido) sin_leer, count(*) total,
            count(*) filter (where it.vencido) vencidos, max(it.en) ultimo
          from it group by it.tipo) g), '[]'::jsonb),
      -- Lista corta sin agrupar (la usaba la v56; se deja para no romper la app abierta durante el cambio)
      'avisos', coalesce((select jsonb_agg(x order by x.en desc) from (select it.id, it.tipo, it.titulo, it.texto, it.enlace, it.en, it.leido, it.vencido, it.ids
          from it order by (not it.leido) desc, it.en desc limit least(greatest(coalesce(p_limite, 40), 1), 100)) x), '[]'::jsonb)));
end $function$;

create or replace function public.avisos_grupo(p_tipo text, p_limite integer default 60)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare yo uuid := (select auth.uid());
begin
  perform privado.exigir('admin', 'abogado', 'analista', 'lider', 'aliado');
  return coalesce((select jsonb_agg(x) from (select it.id, it.tipo, it.titulo, it.texto, it.enlace, it.en, it.leido, it.vencido, it.ids
    from privado.avisos_items(yo) it where it.tipo = p_tipo
    order by (not it.leido) desc, it.vencido desc, it.en desc limit least(greatest(coalesce(p_limite, 60), 1), 300)) x), '[]'::jsonb);
end $function$;
revoke all on function public.avisos_grupo(text, integer) from public, anon;
grant execute on function public.avisos_grupo(text, integer) to authenticated;

-- Leer: marca también su "venció"; con p_tipo marca todo el grupo
create or replace function public.avisos_leer(p_ids bigint[])
 returns void language plpgsql security definer set search_path to ''
as $function$
declare yo uuid := (select auth.uid());
begin
  perform privado.exigir('admin', 'abogado', 'analista', 'lider', 'aliado');
  update public.avisos set leido_en = now() where para = yo and leido_en is null
    and (p_ids is null or id = any (p_ids)
      or clave in (select 'v:' || substr(a.clave, 3) from public.avisos a where a.para = yo and a.id = any (p_ids) and a.clave like 'p:%'));
end $function$;

create or replace function public.avisos_leer_grupo(p_tipo text)
 returns void language plpgsql security definer set search_path to ''
as $function$
declare yo uuid := (select auth.uid());
begin
  perform privado.exigir('admin', 'abogado', 'analista', 'lider', 'aliado');
  update public.avisos set leido_en = now() where para = yo and leido_en is null and tipo = p_tipo and apagado_en is null;
end $function$;
revoke all on function public.avisos_leer_grupo(text) from public, anon;
grant execute on function public.avisos_leer_grupo(text) to authenticated;

-- Lote A2: "Contactar al responsable". Un solo botón que va a quien tiene el paso que falta (decidido por el administrador el 21/10):
-- el aliado solo contacta al administrador; si el paso es del administrador, el botón de los demás va a él;
-- si el paso es de quien mira, no hay botón (sale su acción); el administrador elige si faltan cosas de dos personas.
create or replace function privado.contacto_personas(p_paso text, p_lider uuid)
 returns setof uuid language sql stable security definer set search_path to ''
as $function$
  select x.id from public.perfiles x where x.activo and not coalesce(x.gerencia, false) and (
       (p_paso = 'admin' and x.rol = 'admin')
    or (p_paso = 'legal' and x.rol = 'abogado')
    or (p_paso = 'lider' and x.id = p_lider)
    or (p_paso = 'analista' and x.id = (select l.analista_id from public.perfiles l where l.id = p_lider)))
  union
  -- Sin analista asignado (o inactivo): el coordinador; si no hay, el administrador
  select x.id from public.perfiles x where p_paso = 'analista' and x.activo and not coalesce(x.gerencia, false)
    and not exists (select 1 from public.perfiles l join public.perfiles a on a.id = l.analista_id and a.activo where l.id = p_lider)
    and (x.coordinador or (x.rol = 'admin' and not exists (select 1 from public.perfiles c where c.activo and c.coordinador)))
$function$;
revoke all on function privado.contacto_personas(text, uuid) from public, anon, authenticated;

create or replace function public.contacto_destino(p_caso text, p_id bigint, p_falta text default null)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare yo uuid := (select auth.uid()); r text; me public.perfiles; c public.clientes; z public.cambios; i public.instalaciones;
  v_lider uuid; v_paso text; v_motivo text; v_nombre text; v_detalle jsonb := '{}'; v_gestor boolean; v_ids uuid[]; v_propio boolean;
begin
  r := privado.exigir('admin', 'abogado', 'analista', 'lider', 'aliado');
  select * into me from public.perfiles where id = yo;
  if coalesce(me.gerencia, false) then raise exception 'No tienes permiso para hacer esto' using errcode = 'P0001'; end if;
  v_gestor := r = 'admin' or me.senior or me.coordinador;
  if p_caso = 'cliente' then
    select * into c from public.clientes where id = p_id;
    if c.id is null then raise exception 'No existe ese cliente' using errcode = 'P0001'; end if;
    v_lider := c.lider_id; v_nombre := c.nombre;
  elsif p_caso = 'cambio' then
    select * into z from public.cambios where id = p_id;
    if z.id is null then raise exception 'No existe ese cambio' using errcode = 'P0001'; end if;
    v_lider := z.lider_id; v_nombre := coalesce(z.titular_nombre, z.nuevo_nombre);
    if z.cliente_id is not null then select * into c from public.clientes where id = z.cliente_id; end if;
  elsif p_caso = 'comision' then
    select * into i from public.instalaciones where id = p_id;
    if i.id is null then raise exception 'No existe esa instalación' using errcode = 'P0001'; end if;
    v_lider := i.lider_id; v_nombre := i.nombre;
    if i.cliente_id is not null then select * into c from public.clientes where id = i.cliente_id; v_nombre := coalesce(c.nombre, v_nombre); end if;
  else raise exception 'Caso no reconocido' using errcode = 'P0001';
  end if;
  -- El líder solo ve lo suyo (igual que en Clientes)
  if r = 'lider' and v_lider is distinct from yo then raise exception 'No tienes permiso para hacer esto' using errcode = 'P0001'; end if;

  if r = 'aliado' then v_paso := 'admin'; v_motivo := 'aliado';
  elsif p_caso = 'cambio' then
    v_paso := case z.estado when 'por_revisar' then 'admin' when 'por_emitir' then 'analista' when 'por_confirmar' then case when z.aviso is not null then 'analista' else 'admin' end
      when 'sin_registro' then 'admin' else 'lider' end;
    v_motivo := case z.estado when 'por_revisar' then 'cambio_revisar' when 'por_emitir' then 'cambio_emitir'
      when 'por_confirmar' then case when z.aviso is not null then z.aviso else 'cambio_tad' end when 'sin_registro' then 'cambio_registro' else 'cambio_listo' end;
    v_detalle := jsonb_build_object('tipo', z.tipo, 'estado', z.estado);
  elsif p_caso = 'comision' and p_falta = 'pago' then v_paso := 'admin'; v_motivo := 'com_pago';
  elsif p_caso = 'comision' and p_falta = 'orden' then v_paso := 'lider'; v_motivo := 'com_orden';
  elsif p_caso = 'comision' and p_falta is null then v_paso := 'lider'; v_motivo := 'com_general';
  else
    -- Cliente, o comisión a la que le falta Legal: depende de cómo van los documentos
    if c.id is not null and exists (select 1 from public.documentos d where d.cliente_id = c.id and d.estado = 'devuelto') then
      v_paso := 'lider'; v_motivo := 'devuelto';
      v_detalle := jsonb_build_object('devueltos', (select jsonb_agg(jsonb_build_object('casilla', d.casilla, 'numero', d.numero, 'motivo', coalesce(d.motivo, d.nota)))
        from public.documentos d where d.cliente_id = c.id and d.estado = 'devuelto'));
    else
      v_paso := case c.estatus when 'documentos_recibidos' then 'admin' when 'documentos_en_revision' then 'admin' when 'contrato_en_curso' then 'legal' else 'lider' end;
      v_motivo := case c.estatus when 'documentos_solicitados' then 'docs_faltan' when 'documentos_pendientes' then 'docs_faltan'
        when 'documentos_recibidos' then 'docs_revisar' when 'documentos_en_revision' then 'docs_revisar' when 'contrato_en_curso' then 'contrato'
        when 'por_firmar' then 'firma' else 'general' end;
      if c.id is not null and v_motivo = 'docs_faltan' then v_detalle := jsonb_build_object('faltan', privado.casillas_vacias(c.id)); end if;
    end if;
    if p_caso = 'comision' then v_motivo := 'com_legal_' || v_motivo; end if;
  end if;
  if p_caso = 'comision' then v_detalle := v_detalle || jsonb_build_object('cierra', privado.corte_limite(privado.corte_en_curso())); end if;

  select array_agg(x) into v_ids from privado.contacto_personas(v_paso, v_lider) x;
  v_propio := yo = any (coalesce(v_ids, '{}'));
  -- El administrador (o Senior o coordinador) elige si el paso es del analista: también le sale el líder
  if v_gestor and not v_propio and v_paso = 'analista' and v_lider is not null and not (v_lider = any (coalesce(v_ids, '{}'))) then v_ids := v_ids || v_lider; end if;
  return jsonb_build_object('paso', v_paso, 'motivo', v_motivo, 'propio', v_propio, 'cliente', v_nombre, 'detalle', v_detalle,
    'destinos', case when v_propio then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'rol', case when p.id = v_lider then 'lider' else p.rol end,
      'whatsapp', p.whatsapp, 'correo', p.correo) order by array_position(v_ids, p.id)) from public.perfiles p where p.id = any (v_ids) and p.id <> yo), '[]'::jsonb) end);
end $function$;
revoke all on function public.contacto_destino(text, bigint, text) from public, anon;
grant execute on function public.contacto_destino(text, bigint, text) to authenticated;

create or replace function public.contacto_anotar(p_caso text, p_id bigint, p_para uuid, p_medio text, p_motivo text)
 returns void language plpgsql security definer set search_path to ''
as $function$
declare d jsonb;
begin
  d := public.contacto_destino(p_caso, p_id, null);
  if p_medio not in ('whatsapp', 'correo') then raise exception 'Medio no reconocido' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.perfiles p where p.id = p_para and p.activo) then raise exception 'Esa persona no está activa' using errcode = 'P0001'; end if;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues)
  values ((select auth.uid()), 'contacto_responsable', p_caso, p_id::text, jsonb_build_object('para', p_para, 'nombre', privado.nombre_de(p_para), 'medio', p_medio, 'motivo', left(p_motivo, 40)));
end $function$;
revoke all on function public.contacto_anotar(text, bigint, uuid, text, text) from public, anon;
grant execute on function public.contacto_anotar(text, bigint, uuid, text, text) to authenticated;

-- A3 (revisión independiente, migración lote_a3_contacto_revision). Probado con rollback: el aliado ya no consulta clientes (solo sus solicitudes, al administrador);
--   contacto_anotar2 rechaza anotar a alguien que no es responsable del caso.
-- Lote A3 (revisión independiente): el aliado solo consulta sus propias solicitudes; el dueño de una comisión se calcula como en Comisiones;
-- la bitácora solo anota un contacto a un responsable real del caso (contacto_anotar2 reemplaza a contacto_anotar).
create or replace function public.contacto_destino(p_caso text, p_id bigint, p_falta text default null)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare yo uuid := (select auth.uid()); r text; me public.perfiles; c public.clientes; z public.cambios; i public.instalaciones; s public.aliado_solicitudes;
  v_lider uuid; v_paso text; v_motivo text; v_nombre text; v_detalle jsonb := '{}'; v_gestor boolean; v_ids uuid[]; v_propio boolean;
begin
  r := privado.exigir('admin', 'abogado', 'analista', 'lider', 'aliado');
  select * into me from public.perfiles where id = yo;
  if coalesce(me.gerencia, false) then raise exception 'No tienes permiso para hacer esto' using errcode = 'P0001'; end if;
  -- El aliado solo pregunta por sus solicitudes, y siempre le toca el administrador
  if r = 'aliado' and p_caso <> 'aliado' then raise exception 'No tienes permiso para hacer esto' using errcode = 'P0001'; end if;
  v_gestor := r = 'admin' or me.senior or me.coordinador;
  if p_caso = 'aliado' then
    select * into s from public.aliado_solicitudes where id = p_id;
    if s.id is null or (r = 'aliado' and s.aliado_id is distinct from privado.mi_aliado()) or r not in ('aliado', 'admin') then raise exception 'No tienes permiso para hacer esto' using errcode = 'P0001'; end if;
    v_nombre := coalesce((select k.nombre from public.clientes k where k.id = s.cliente_id), s.nombre, 'la solicitud ' || privado.al_codigo(s.id));
  elsif p_caso = 'cliente' then
    select * into c from public.clientes where id = p_id;
    if c.id is null then raise exception 'No existe ese cliente' using errcode = 'P0001'; end if;
    v_lider := c.lider_id; v_nombre := c.nombre;
  elsif p_caso = 'cambio' then
    select * into z from public.cambios where id = p_id;
    if z.id is null then raise exception 'No existe ese cambio' using errcode = 'P0001'; end if;
    v_lider := z.lider_id; v_nombre := coalesce(z.titular_nombre, z.nuevo_nombre);
    if z.cliente_id is not null then select * into c from public.clientes where id = z.cliente_id; end if;
  elsif p_caso = 'comision' then
    select * into i from public.instalaciones where id = p_id;
    if i.id is null then raise exception 'No existe esa instalación' using errcode = 'P0001'; end if;
    -- Dueño como en Comisiones: el puesto a mano manda; si no, el de la instalación o el vendedor de la orden
    v_lider := case when i.dueno_manual then i.lider_id else coalesce(i.lider_id, (select o.vendedor_id from public.ordenes_odoo o where o.id = i.orden_id)) end;
    v_nombre := i.nombre;
    if i.cliente_id is not null then select * into c from public.clientes where id = i.cliente_id; v_nombre := coalesce(c.nombre, v_nombre); end if;
  else raise exception 'Caso no reconocido' using errcode = 'P0001';
  end if;
  if r = 'lider' and v_lider is distinct from yo then raise exception 'No tienes permiso para hacer esto' using errcode = 'P0001'; end if;
  if p_caso = 'aliado' then v_paso := 'admin'; v_motivo := 'aliado';
  elsif p_caso = 'cambio' then
    v_paso := case z.estado when 'por_revisar' then 'admin' when 'por_emitir' then 'analista' when 'por_confirmar' then case when z.aviso is not null then 'analista' else 'admin' end
      when 'sin_registro' then 'admin' else 'lider' end;
    v_motivo := case z.estado when 'por_revisar' then 'cambio_revisar' when 'por_emitir' then 'cambio_emitir'
      when 'por_confirmar' then case when z.aviso is not null then z.aviso else 'cambio_tad' end when 'sin_registro' then 'cambio_registro' else 'cambio_listo' end;
    v_detalle := jsonb_build_object('tipo', z.tipo, 'estado', z.estado);
  elsif p_caso = 'comision' and p_falta = 'pago' then v_paso := 'admin'; v_motivo := 'com_pago';
  elsif p_caso = 'comision' and p_falta = 'orden' then v_paso := 'lider'; v_motivo := 'com_orden';
  elsif p_caso = 'comision' and p_falta is null then v_paso := 'lider'; v_motivo := 'com_general';
  else
    if c.id is not null and exists (select 1 from public.documentos d where d.cliente_id = c.id and d.estado = 'devuelto') then
      v_paso := 'lider'; v_motivo := 'devuelto';
      v_detalle := jsonb_build_object('devueltos', (select jsonb_agg(jsonb_build_object('casilla', d.casilla, 'numero', d.numero, 'motivo', coalesce(d.motivo, d.nota)))
        from public.documentos d where d.cliente_id = c.id and d.estado = 'devuelto'));
    else
      v_paso := case c.estatus when 'documentos_recibidos' then 'admin' when 'documentos_en_revision' then 'admin' when 'contrato_en_curso' then 'legal' else 'lider' end;
      v_motivo := case c.estatus when 'documentos_solicitados' then 'docs_faltan' when 'documentos_pendientes' then 'docs_faltan'
        when 'documentos_recibidos' then 'docs_revisar' when 'documentos_en_revision' then 'docs_revisar' when 'contrato_en_curso' then 'contrato'
        when 'por_firmar' then 'firma' else 'general' end;
      if c.id is not null and v_motivo = 'docs_faltan' then v_detalle := jsonb_build_object('faltan', privado.casillas_vacias(c.id)); end if;
    end if;
    if p_caso = 'comision' then v_motivo := 'com_legal_' || v_motivo; end if;
  end if;
  if p_caso = 'comision' then v_detalle := v_detalle || jsonb_build_object('cierra', privado.corte_limite(privado.corte_en_curso())); end if;
  select array_agg(x) into v_ids from privado.contacto_personas(v_paso, v_lider) x;
  v_propio := yo = any (coalesce(v_ids, '{}'));
  if v_gestor and not v_propio and v_paso = 'analista' and v_lider is not null and not (v_lider = any (coalesce(v_ids, '{}'))) then v_ids := v_ids || v_lider; end if;
  return jsonb_build_object('paso', v_paso, 'motivo', v_motivo, 'propio', v_propio, 'cliente', v_nombre, 'detalle', v_detalle,
    'destinos', case when v_propio then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'rol', case when p.id = v_lider then 'lider' else p.rol end,
      'whatsapp', p.whatsapp, 'correo', p.correo) order by array_position(v_ids, p.id)) from public.perfiles p where p.id = any (v_ids) and p.id <> yo), '[]'::jsonb) end);
end $function$;

create or replace function public.contacto_anotar2(p_caso text, p_id bigint, p_falta text, p_para uuid, p_medio text)
 returns void language plpgsql security definer set search_path to ''
as $function$
declare d jsonb;
begin
  d := public.contacto_destino(p_caso, p_id, nullif(p_falta, ''));
  if p_medio not in ('whatsapp', 'correo') then raise exception 'Medio no reconocido' using errcode = 'P0001'; end if;
  if not coalesce(d -> 'destinos', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('id', p_para)) then raise exception 'Esa persona no es la responsable de este caso' using errcode = 'P0001'; end if;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues)
  values ((select auth.uid()), 'contacto_responsable', p_caso, p_id::text, jsonb_build_object('para', p_para, 'nombre', privado.nombre_de(p_para), 'medio', p_medio, 'motivo', d ->> 'motivo'));
end $function$;
revoke all on function public.contacto_anotar2(text, bigint, text, uuid, text) from public, anon;
grant execute on function public.contacto_anotar2(text, bigint, text, uuid, text) to authenticated;
revoke execute on function public.contacto_anotar(text, bigint, uuid, text, text) from public, anon, authenticated;
