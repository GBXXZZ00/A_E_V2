-- Lote 12/11 (maqueta legal): la tarea "Contrato en curso" para Legal; antes desaparecía al pasar de Documentos recibidos
create or replace function privado.pendientes_legal()
 returns table(tipo text, clave text, cliente_id bigint, titulo text, detalle text, lider_id uuid, analista_id uuid, para text, desde timestamp with time zone, vence date, ref jsonb)
 language sql stable security definer set search_path to '' as $function$
  select 'contrato_curso'::text, c.id::text, c.id, c.nombre, privado.segmento(c.id) || ' · en curso desde el ' || to_char(coalesce(c.estatus_desde, c.creado_en) at time zone 'America/Caracas', 'DD/MM'),
    c.lider_id, null::uuid, 'abogado'::text, coalesce(c.estatus_desde, c.creado_en), (coalesce(c.estatus_desde, c.creado_en) at time zone 'America/Caracas')::date + 3, jsonb_build_object('estatus', c.estatus)
  from public.clientes c where c.unido_a is null and c.estatus = 'contrato_en_curso' and not c.es_natural;
$function$;
revoke all on function privado.pendientes_legal() from public, anon, authenticated;

create or replace function privado.trabajo_items(p_quien uuid, p_vista text, p_yo uuid, p_persona uuid)
 returns table(tipo text, clave text, cliente_id bigint, titulo text, detalle text, lider_id uuid, analista_id uuid, para text, desde timestamp with time zone, vence date, ref jsonb)
 language plpgsql stable security definer set search_path to '' as $function$
declare sin_rev boolean := exists (select 1 from public.perfiles pf where pf.id = p_quien and pf.rol = 'analista' and pf.senior);
begin
  return query
  with base0 as (select * from privado.pendientes() union all select * from privado.pendientes_extra() union all select * from privado.pendientes_buzon()
    union all select * from privado.pendientes_legal()
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
      and privado.vgt_sol_req(kk.id) = 0 and privado.vgt_polizas_faltan(kk.cliente_id) = 0
    union all
    -- Lote 12/11: lo que Legal detuvo le llega al administrador
    select 'legal_obs'::text, o.id::text, o.cliente_id, k.nombre, coalesce(privado.nombre_de(o.por), 'Legal') || ': ' || o.texto, k.lider_id, null::uuid, 'admin'::text,
      o.en, (o.en at time zone 'America/Caracas')::date + 1, jsonb_build_object('obs', o.id, 'tipo', o.tipo)
    from public.legal_observaciones o join public.clientes k on k.id = o.cliente_id where privado.legal_obs_activa(o, k.estatus) and k.unido_a is null),
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
