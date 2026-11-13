-- Lote 13/11, partes 3 y 4 (revisión de documentos).
-- 1) documento_marcar: se quita el bloqueo "la constitutiva solo se devuelve si…": la constitutiva acepta todos sus motivos
--    (Falta un acta no pasa por aquí: se aprueba y se crea el requerimiento del acta).
-- 2) documento_reclasificar: "Es otro documento". Mueve el mismo archivo a su casilla sin subirlo de nuevo, deja la de origen
--    en lo que falta y anota en la bitácora quién, cuándo y de qué casilla a cuál. Solo el administrador.
--    Si la casilla destino ya tiene archivo, devuelve {ocupada:true} y la app pregunta: p_modo 'reemplazar' o 'dos'.

create or replace function public.documento_marcar(p_documento bigint, p_accion text, p_motivo text default null::text, p_nota text default null::text, p_vence date default null::date)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare rol text := privado.exigir('admin', 'abogado'); yo uuid := (select auth.uid()); d public.documentos; m public.revision_marcas;
  nt text := nullif(btrim(coalesce(p_nota, '')), '');
begin
  select * into d from public.documentos where id = p_documento;
  if not found then raise exception 'Ese documento ya no existe' using errcode = 'P0001'; end if;
  perform privado.exigir_cliente(d.cliente_id);
  if length(coalesce(nt, '')) > 500 then raise exception 'La nota es muy larga. Máximo 500 letras' using errcode = 'P0001'; end if;
  select * into m from public.revision_marcas where documento_id = p_documento for update;
  if p_accion = 'quitar' then
    update public.revision_marcas set accion = null, motivo = null, nota = null, vence_en = null, marcado_por = yo, marcado_en = now(), origen = 'manual'
    where documento_id = p_documento;
  elsif p_accion = 'aprobar' then
    if m.origen = 'ia' and m.accion = 'devolver' then
      if rol <> 'admin' then raise exception 'Aprobar lo que la IA devolvió es una excepción: la concede el administrador' using errcode = 'P0001'; end if;
      if length(coalesce(nt, '')) < 5 then raise exception 'Escribe el motivo de la excepción' using errcode = 'P0001'; end if;
    end if;
    insert into public.revision_marcas (documento_id, cliente_id, accion, nota, vence_en, marcado_por, marcado_en, origen)
    values (p_documento, d.cliente_id, 'aprobar', nt, p_vence, yo, now(), 'manual')
    on conflict (documento_id) do update set accion = 'aprobar', motivo = null, nota = excluded.nota, vence_en = excluded.vence_en, marcado_por = yo, marcado_en = now(), origen = 'manual';
  elsif p_accion = 'devolver' then
    if p_motivo is null or p_motivo not in ('vencido', 'ilegible', 'no_corresponde', 'falta_firma', 'otro') then raise exception 'Elige por qué lo devuelves' using errcode = 'P0001'; end if;
    if p_motivo = 'otro' and nt is null then raise exception 'Escribe el motivo en la nota' using errcode = 'P0001'; end if;
    insert into public.revision_marcas (documento_id, cliente_id, accion, motivo, nota, marcado_por, marcado_en, origen)
    values (p_documento, d.cliente_id, 'devolver', p_motivo, nt, yo, now(), 'manual')
    on conflict (documento_id) do update set accion = 'devolver', motivo = excluded.motivo, nota = excluded.nota, vence_en = null, marcado_por = yo, marcado_en = now(), origen = 'manual';
  else raise exception 'Acción no reconocida' using errcode = 'P0001';
  end if;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues)
  values (yo, case when m.origen = 'ia' and m.accion = 'devolver' and p_accion = 'aprobar' then 'documento_excepcion' else 'documento_marcado' end, 'documentos', p_documento::text,
    case when m.accion is not null then jsonb_build_object('accion', m.accion, 'motivo', m.motivo, 'origen', m.origen) end,
    jsonb_build_object('accion', p_accion, 'motivo', p_motivo, 'nota', nt, 'vence_en', p_vence));
end $function$;

create or replace function public.documento_reclasificar(p_documento bigint, p_casilla text, p_numero integer default null, p_modo text default null, p_titulo text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare yo uuid := (select auth.uid()); d public.documentos; dst public.documentos; v_num int; tit text := nullif(btrim(coalesce(p_titulo, '')), '');
  ocupada boolean; nom text; base int;
begin
  perform privado.exigir('admin');
  select * into d from public.documentos where id = p_documento for update;
  if not found then raise exception 'Ese documento ya no existe' using errcode = 'P0001'; end if;
  perform privado.exigir_cliente(d.cliente_id);
  if d.casilla not in ('cedula', 'rif_personal', 'rif_empresa', 'acta_constitutiva', 'acta_asamblea', 'conatel', 'otro') then
    raise exception 'Este documento no se puede mover' using errcode = 'P0001'; end if;
  if p_casilla not in ('cedula', 'rif_personal', 'rif_empresa', 'acta_constitutiva', 'acta_asamblea', 'otro') then
    raise exception 'Elige qué documento es' using errcode = 'P0001'; end if;
  if p_modo is not null and p_modo not in ('reemplazar', 'dos') then raise exception 'Opción no reconocida' using errcode = 'P0001'; end if;
  if p_casilla in ('rif_empresa', 'acta_constitutiva') then v_num := 0;
  elsif p_casilla in ('cedula', 'rif_personal') then
    v_num := coalesce(p_numero, 0);
    if v_num not between 1 and 10 then raise exception 'Elige el representante' using errcode = 'P0001'; end if;
  elsif p_casilla = 'acta_asamblea' then
    select coalesce(max(numero), 0) + 1 into v_num from public.documentos where cliente_id = d.cliente_id and casilla = 'acta_asamblea';
    if v_num > 99 then raise exception 'No caben más actas' using errcode = 'P0001'; end if;
  else
    if tit is null or length(tit) < 3 then raise exception 'Escribe qué documento es' using errcode = 'P0001'; end if;
    if length(tit) > 80 then raise exception 'El nombre es muy largo. Máximo 80 letras' using errcode = 'P0001'; end if;
    select min(g) into v_num from generate_series(1, 59) g where not exists (select 1 from public.documentos x where x.cliente_id = d.cliente_id and x.casilla = 'otro' and x.numero = g);
    if v_num is null then raise exception 'No caben más documentos' using errcode = 'P0001'; end if;
  end if;
  if d.casilla = p_casilla and d.numero = v_num then raise exception 'Ya está en esa casilla' using errcode = 'P0001'; end if;
  nom := case p_casilla when 'cedula' then 'cédula del representante ' || v_num when 'rif_personal' then 'RIF personal del representante ' || v_num
    when 'rif_empresa' then 'RIF de la empresa' when 'acta_constitutiva' then 'acta constitutiva' when 'acta_asamblea' then 'acta de asamblea ' || v_num else tit end;

  select * into dst from public.documentos where cliente_id = d.cliente_id and casilla = p_casilla and numero = v_num for update;
  ocupada := found and exists (select 1 from public.documento_archivos where documento_id = dst.id and vigente);
  if ocupada and p_modo is null then
    return jsonb_build_object('ocupada', true, 'destino', nom);
  end if;
  -- El documento sale de su casilla: sus marcas de revisión ya no aplican
  update public.revision_marcas set accion = null, motivo = null, nota = null, vence_en = null, marcado_por = yo, marcado_en = now(), origen = 'manual' where documento_id = d.id;

  if dst.id is null then
    -- La casilla destino está libre: el documento entero se mueve y la de origen queda vacía (entra en lo que falta)
    update public.documentos set casilla = p_casilla, numero = v_num, estado = 'por_revisar', motivo = null, nota = null,
      titulo = case when p_casilla = 'otro' then tit else null end, vence_en = null, firmado_en = null where id = d.id;
  else
    -- La casilla destino ya existe: el archivo pasa a ella (reemplaza o se agrega) y la de origen queda devuelta, sin archivo
    if p_modo = 'reemplazar' or not ocupada then
      update public.documento_archivos set vigente = false where documento_id = dst.id and vigente;
    end if;
    select coalesce(max(orden), 0) into base from public.documento_archivos where documento_id = dst.id and vigente;
    insert into public.documento_archivos (documento_id, archivo_id, orden, vigente)
    select dst.id, da.archivo_id, base + row_number() over (order by da.orden, da.archivo_id), true from public.documento_archivos da where da.documento_id = d.id and da.vigente
    on conflict (documento_id, archivo_id) do update set vigente = true, orden = excluded.orden;
    update public.documento_archivos set vigente = false where documento_id = d.id and vigente;
    update public.documentos set estado = 'por_revisar', motivo = null, nota = null, revisado_por = null, revisado_en = null where id = dst.id;
    update public.documentos set estado = 'devuelto', motivo = 'otro', nota = 'Se movió a ' || nom || '. Falta este documento' where id = d.id;
    update public.revision_marcas set accion = null, motivo = null, nota = null, vence_en = null, marcado_por = yo, marcado_en = now(), origen = 'manual' where documento_id = dst.id;
  end if;

  insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues)
  values (yo, 'documento_reclasificado', 'documentos', d.id::text, jsonb_build_object('casilla', d.casilla, 'numero', d.numero, 'cliente', d.cliente_id),
    jsonb_build_object('casilla', p_casilla, 'numero', v_num, 'titulo', tit, 'modo', case when dst.id is null then 'mover' else coalesce(p_modo, 'reemplazar') end, 'destino', coalesce(dst.id, d.id)));
  perform privado.recalcular(d.cliente_id, yo);
  return jsonb_build_object('ok', true, 'documento', coalesce(dst.id, d.id), 'casilla', p_casilla, 'numero', v_num, 'destino', nom);
end $function$;

revoke all on function public.documento_reclasificar(bigint, text, integer, text, text) from public, anon;
grant execute on function public.documento_reclasificar(bigint, text, integer, text, text) to authenticated;
