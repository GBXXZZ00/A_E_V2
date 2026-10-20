-- Lote 21/10, tanda B (partes 3 y 4): Clientes lista y hoja. Aplicado con el conector (migración lote_21oct_clientes).
-- Septiembre vivo 46/41 y octubre 68/53 antes y después (la comisión usa instalaciones.lider_id, no el líder del cliente).

-- ---------- Columnas nuevas ----------
alter table public.documentos add column if not exists titulo text check (titulo is null or length(titulo) <= 80);
alter table public.dedicado_contratos add column if not exists vence_en date;
alter table public.dedicado_contratos add column if not exists firma text check (firma is null or firma in ('digital', 'fisica'));

-- ---------- Un dedicado excluido (dedicados.excluido_en) no cuenta como dedicado ----------
create or replace function privado.segmento(p bigint)
 returns text language sql stable security definer set search_path to ''
as $function$
  select case
    when x.ded and x.pyme then 'PYME + Dedicado'
    when x.ded then case when c.es_isp or d.tipo = 'isp' then 'Dedicado ISP' else 'Dedicado corporativo' end
    when c.es_natural then 'Natural'
    else 'PYME' end
  from public.clientes c
  left join public.dedicados d on d.cliente_id = c.id
  cross join lateral (select
    (coalesce(bool_or(privado.norm(s.categoria) ~ '(dedicad|conectiv)'), false) or d.cliente_id is not null) and d.excluido_en is null as ded,
    coalesce(bool_or(privado.norm(s.categoria) !~ '(dedicad|conectiv)'), false) or d.excluido_en is not null as pyme
    from public.servicios s where s.cliente_id = c.id) x
  where c.id = p
$function$;

create or replace function privado.tarjetas_todas()
 returns table(cliente_id bigint, pyme boolean, ded text) language sql stable security definer set search_path to ''
as $function$
  select c.id, (not x.ded) or x.pyme, case when x.ded then case when c.es_isp or d.tipo = 'isp' then 'isp' else 'corporativo' end end
  from public.clientes c
  left join public.dedicados d on d.cliente_id = c.id
  left join (select s.cliente_id, bool_or(privado.norm(s.categoria) ~ '(dedicad|conectiv)') ded, bool_or(privado.norm(s.categoria) !~ '(dedicad|conectiv)') pyme
             from public.servicios s group by s.cliente_id) v on v.cliente_id = c.id
  cross join lateral (select (coalesce(v.ded, false) or d.cliente_id is not null) and d.excluido_en is null as ded, coalesce(v.pyme, false) as pyme) x
$function$;

select privado.reemplazar_en_funcion('privado.dedicado_json(bigint)'::regprocedure,
  'from public.dedicados d where d.cliente_id = p' || chr(10),
  'from public.dedicados d where d.cliente_id = p and d.excluido_en is null' || chr(10));
select privado.reemplazar_en_funcion('privado.dedicado_json(bigint)'::regprocedure,
  '''vence'', k.vence_texto,',
  '''vence'', k.vence_texto, ''vence_en'', k.vence_en, ''firma'', k.firma, ''falta_archivo'', k.falta_archivo, ''con_archivo'', k.tipo = ''servicio'' and exists (select 1 from public.documentos d2 join public.documento_archivos da on da.documento_id = d2.id and da.vigente where d2.cliente_id = p and d2.casilla = ''contrato_dedicado''),');

-- ---------- Contrato firmado sin archivo o sin vencimiento ----------
-- 'sin_archivo' gana sobre 'sin_vence'. PYME: estatus Contrato firmado y la casilla contrato_pyme. Dedicados: cada contrato firmado.
create or replace function privado.contrato_pendiente(p bigint)
 returns text language sql stable security definer set search_path to ''
as $function$
  with c as (select c.* from public.clientes c where c.id = p),
  dp as (select d.vence_en, exists (select 1 from public.documento_archivos da where da.documento_id = d.id and da.vigente) as arch
         from public.documentos d where d.cliente_id = p and d.casilla = 'contrato_pyme'),
  dd as (select exists (select 1 from public.documentos d join public.documento_archivos da on da.documento_id = d.id and da.vigente
                        where d.cliente_id = p and d.casilla = 'contrato_dedicado') as arch),
  k as (select k.* from public.dedicado_contratos k join public.dedicados x on x.cliente_id = k.cliente_id and x.excluido_en is null
        where k.cliente_id = p and k.estatus = 'firmado'),
  py as (select (c.estatus = 'contrato_firmado' and not c.es_natural and privado.segmento(c.id) in ('PYME', 'PYME + Dedicado')) as firmado from c)
  select case
    when (select firmado from py) and not exists (select 1 from dp where dp.arch) then 'sin_archivo'
    when exists (select 1 from k where k.falta_archivo or (k.tipo = 'servicio' and not (select arch from dd))) then 'sin_archivo'
    when (select firmado from py) and exists (select 1 from dp where dp.arch and dp.vence_en is null) then 'sin_vence'
    when exists (select 1 from k where k.vence_en is null) then 'sin_vence'
  end
$function$;

-- ---------- Etiquetas de gestión (Contactado, Sin contacto, Esperando documentos) ----------
create or replace function privado.etiquetar(p_cliente bigint, p_etiqueta text, p_fecha date, p_nota text, p_yo uuid)
 returns void language plpgsql security definer set search_path to ''
as $function$
declare nt text := left(nullif(btrim(coalesce(p_nota, '')), ''), 300); f date := coalesce(p_fecha, privado.hoy());
begin
  if p_etiqueta is null or p_etiqueta not in ('contactado', 'sin_contacto', 'esperando') then raise exception 'Etiqueta no reconocida' using errcode = 'P0001'; end if;
  if f > privado.hoy() + 90 or f < privado.hoy() - 365 then raise exception 'Revisa la fecha' using errcode = 'P0001'; end if;
  insert into public.cliente_gestion (cliente_id, etiqueta, fecha, nota, por, en) values (p_cliente, p_etiqueta, f, nt, p_yo, now());
  insert into public.hilo (cliente_id, tipo, texto, detalle, autor_id) values (p_cliente, 'dato', 'etiqueta', jsonb_build_object('etiqueta', p_etiqueta, 'fecha', f, 'nota', nt), p_yo);
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues)
  values (p_yo, 'cliente_etiqueta', 'cliente_gestion', p_cliente::text, jsonb_build_object('etiqueta', p_etiqueta, 'fecha', f, 'nota', nt));
end $function$;

create or replace function public.cliente_etiqueta(p_cliente bigint, p_etiqueta text, p_fecha date default null, p_nota text default null)
 returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare rol text := privado.exigir_cliente(p_cliente); yo uuid := (select auth.uid());
begin
  perform privado.etiquetar(p_cliente, p_etiqueta, p_fecha, p_nota, yo);
  perform privado.gestion(p_cliente, yo);
  return (select jsonb_build_object('e', g.etiqueta, 'fecha', g.fecha, 'nota', g.nota, 'por', privado.nombre_de(g.por), 'en', g.en)
          from public.cliente_gestion g where g.cliente_id = p_cliente order by g.en desc, g.id desc limit 1);
end $function$;

-- Pedir o recordar documentos pone sola la etiqueta "Esperando documentos"
create or replace function public.cliente_contacto(p_cliente bigint, p_canal text, p_motivo text default 'contacto'::text)
 returns text language plpgsql security definer set search_path to ''
as $function$
declare rol text := privado.exigir_cliente(p_cliente); yo uuid := (select auth.uid()); e text;
begin
  if p_canal is null or p_canal not in ('whatsapp', 'correo', 'llamada') then raise exception 'Canal no reconocido' using errcode = 'P0001'; end if;
  if p_motivo is null or p_motivo not in ('pedir', 'recordar', 'firma', 'contacto') then raise exception 'Motivo no reconocido' using errcode = 'P0001'; end if;
  insert into public.hilo (cliente_id, tipo, texto, detalle, autor_id)
  values (p_cliente, 'contacto', p_motivo, jsonb_build_object('canal', p_canal, 'motivo', p_motivo), yo);
  perform privado.gestion(p_cliente, yo);
  select estatus into e from public.clientes where id = p_cliente;
  if p_motivo = 'pedir' and e = 'grandes_negocios' then
    perform privado.poner_estatus(p_cliente, 'documentos_solicitados', yo, 'auto');
    e := 'documentos_solicitados';
  end if;
  if p_motivo in ('pedir', 'recordar') then perform privado.etiquetar(p_cliente, 'esperando', privado.hoy(), null, yo); end if;
  return e;
end $function$;

-- ---------- Cambiar líder (solo administrador). PYME: clientes.lider_id. Dedicado: dedicados.ejecutiva_id ----------
create or replace function public.cliente_lider_cambiar(p_cliente bigint, p_lider uuid, p_cual text default 'pyme')
 returns void language plpgsql security definer set search_path to ''
as $function$
declare yo uuid := (select auth.uid()); antes uuid; antes_n text; nom text;
begin
  perform privado.exigir('admin');
  if p_cual is null or p_cual not in ('pyme', 'dedicado') then raise exception 'Elige si es el líder PYME o del dedicado' using errcode = 'P0001'; end if;
  select pf.nombre into nom from public.perfiles pf where pf.id = p_lider and pf.activo and pf.rol = 'lider';
  if nom is null then raise exception 'Elige un líder activo' using errcode = 'P0001'; end if;
  if p_cual = 'pyme' then
    select c.lider_id, coalesce(privado.nombre_de(c.lider_id), c.lider_nombre) into antes, antes_n from public.clientes c where c.id = p_cliente for update;
    if not found then raise exception 'Ese cliente no existe' using errcode = 'P0001'; end if;
    update public.clientes set lider_id = p_lider, lider_nombre = nom, actualizado_en = now() where id = p_cliente;
  else
    select d.ejecutiva_id, coalesce(privado.nombre_de(d.ejecutiva_id), d.ejecutiva_nombre) into antes, antes_n from public.dedicados d where d.cliente_id = p_cliente for update;
    if not found then raise exception 'Este cliente no es dedicado' using errcode = 'P0001'; end if;
    update public.dedicados set ejecutiva_id = p_lider, ejecutiva_nombre = nom, actualizado_en = now() where cliente_id = p_cliente;
  end if;
  insert into public.hilo (cliente_id, tipo, texto, detalle, autor_id) values (p_cliente, 'dato', 'lider', jsonb_build_object('cual', p_cual, 'antes', antes_n, 'lider', nom), yo);
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues)
  values (yo, 'cliente_lider', case when p_cual = 'pyme' then 'clientes' else 'dedicados' end, p_cliente::text,
    jsonb_build_object('lider_id', antes, 'lider', antes_n), jsonb_build_object('lider_id', p_lider, 'lider', nom, 'cual', p_cual));
end $function$;

-- ---------- Suspender o reactivar (solo administrador). Suspendido: fuera de la lista y de los contadores ----------
create or replace function public.cliente_suspender(p_cliente bigint, p_suspender boolean, p_nota text default null)
 returns void language plpgsql security definer set search_path to ''
as $function$
declare yo uuid := (select auth.uid()); a public.clientes; nt text := left(nullif(btrim(coalesce(p_nota, '')), ''), 300);
begin
  perform privado.exigir('admin');
  select * into a from public.clientes where id = p_cliente for update;
  if not found then raise exception 'Ese cliente no existe' using errcode = 'P0001'; end if;
  if coalesce(p_suspender, false) then
    if nt is null or length(nt) < 3 then raise exception 'Escribe por qué se suspende' using errcode = 'P0001'; end if;
    if a.suspendido_en is not null then raise exception 'Ya está suspendido' using errcode = 'P0001'; end if;
    update public.clientes set suspendido_en = now(), suspendido_por = yo, suspendido_nota = nt, actualizado_en = now() where id = p_cliente;
  else
    if a.suspendido_en is null then raise exception 'No está suspendido' using errcode = 'P0001'; end if;
    update public.clientes set suspendido_en = null, suspendido_por = null, suspendido_nota = null, actualizado_en = now() where id = p_cliente;
  end if;
  insert into public.hilo (cliente_id, tipo, texto, detalle, autor_id)
  values (p_cliente, 'dato', case when p_suspender then 'suspendido' else 'reactivado' end, jsonb_build_object('nota', coalesce(nt, a.suspendido_nota)), yo);
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues)
  values (yo, case when p_suspender then 'cliente_suspendido' else 'cliente_reactivado' end, 'clientes', p_cliente::text,
    jsonb_build_object('suspendido_en', a.suspendido_en, 'nota', a.suspendido_nota), jsonb_build_object('suspendido', p_suspender, 'nota', nt));
end $function$;

-- ---------- Aprobar seleccionados: marca para aprobar varios documentos de una vez (se aprueban al cerrar la revisión) ----------
create or replace function public.documentos_marcar_varios(p_documentos bigint[])
 returns integer language plpgsql security definer set search_path to ''
as $function$
declare d bigint; n int := 0;
begin
  perform privado.exigir('admin', 'abogado');
  if p_documentos is null or cardinality(p_documentos) = 0 then raise exception 'Marca al menos un documento' using errcode = 'P0001'; end if;
  if cardinality(p_documentos) > 40 then raise exception 'Son muchos de una vez. Marca hasta 40' using errcode = 'P0001'; end if;
  foreach d in array p_documentos loop
    if exists (select 1 from public.documentos x where x.id = d and x.estado = 'por_revisar') then
      perform public.documento_marcar(d, 'aprobar', null, null, null); n := n + 1;
    end if;
  end loop;
  return n;
end $function$;

-- ---------- Contratos de dedicados: vencimiento como fecha (obligatorio al marcar Firmado) y firma Digital o Física ----------
create or replace function public.dedicado_contrato_editar(p_id bigint, p_campos jsonb)
 returns void language plpgsql security definer set search_path to ''
as $function$
declare v_yo uuid := (select auth.uid()); a public.dedicado_contratos; b public.dedicado_contratos; k text; r record; v_est text; v_vence date; v_firma date;
begin
  perform privado.exigir('admin');
  select * into a from public.dedicado_contratos where id = p_id for update;
  if not found then raise exception 'No encontré ese contrato'; end if;
  for k in select jsonb_object_keys(p_campos) loop
    if k not in ('estatus', 'firmado_en', 'vence', 'vence_en', 'firma', 'nota') then raise exception 'No se puede cambiar %', k; end if;
  end loop;
  if p_campos ? 'estatus' and p_campos->>'estatus' not in ('sin_contrato', 'en_elaboracion', 'por_firmar', 'firmado', 'actualizar', 'del_cliente', 'por_confirmar') then
    raise exception 'Estatus de contrato no válido'; end if;
  if p_campos ? 'firma' and nullif(p_campos->>'firma', '') is not null and p_campos->>'firma' not in ('digital', 'fisica') then raise exception 'Firma no válida'; end if;
  if p_campos ? 'firmado_en' and nullif(p_campos->>'firmado_en', '') is not null and (p_campos->>'firmado_en')::date > privado.hoy() then
    raise exception 'La fecha de firma no puede ser futura'; end if;
  v_est := coalesce(p_campos->>'estatus', a.estatus);
  v_vence := case when p_campos ? 'vence_en' then nullif(p_campos->>'vence_en', '')::date else a.vence_en end;
  v_firma := case when p_campos ? 'firmado_en' then nullif(p_campos->>'firmado_en', '')::date else a.firmado_en end;
  if v_est = 'firmado' and v_vence is null then raise exception 'Pon la fecha de vencimiento del contrato' using errcode = 'P0001'; end if;
  if v_vence is not null and v_firma is not null and v_vence <= v_firma then raise exception 'El vencimiento debe ser después de la firma' using errcode = 'P0001'; end if;
  if a.tipo = 'vgt' and p_campos->>'estatus' in ('por_firmar', 'firmado') and p_campos->>'estatus' is distinct from a.estatus and privado.vgt_faltan(a.cliente_id) > 0 then
    raise exception 'Faltan % de los requisitos VGT. El contrato VGT no pasa a Por firmar hasta completarlos', privado.vgt_faltan(a.cliente_id) using errcode = 'P0001';
  end if;
  for r in select x.id from public.dedicado_contratos x
           where x.id = p_id or (a.tipo = 'vgt' and x.tipo = 'vgt' and x.cliente_id = a.cliente_id and coalesce(x.numero, '') = coalesce(a.numero, ''))
  loop
    select * into a from public.dedicado_contratos where id = r.id for update;
    update public.dedicado_contratos set
      estatus = coalesce(p_campos->>'estatus', estatus),
      firmado_en = case when p_campos ? 'firmado_en' then nullif(p_campos->>'firmado_en', '')::date else firmado_en end,
      vence_texto = case when p_campos ? 'vence' then left(nullif(btrim(p_campos->>'vence'), ''), 120) else vence_texto end,
      vence_en = case when p_campos ? 'vence_en' then nullif(p_campos->>'vence_en', '')::date else vence_en end,
      firma = case when p_campos ? 'firma' then nullif(p_campos->>'firma', '') else firma end,
      nota = case when p_campos ? 'nota' then left(nullif(btrim(p_campos->>'nota'), ''), 500) else nota end,
      editado_por = v_yo, editado_en = now(), actualizado_en = now()
    where id = r.id returning * into b;
    insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues)
    values (v_yo, 'dedicado_contrato', 'dedicado_contratos', r.id::text,
      jsonb_build_object('estatus', a.estatus, 'firmado_en', a.firmado_en, 'vence', a.vence_texto, 'vence_en', a.vence_en, 'firma', a.firma, 'nota', a.nota),
      jsonb_build_object('estatus', b.estatus, 'firmado_en', b.firmado_en, 'vence', b.vence_texto, 'vence_en', b.vence_en, 'firma', b.firma, 'nota', b.nota, 'cliente', b.cliente_id));
  end loop;
end $function$;

-- ---------- Documentos: "Otro" con nombre y nota; contrato con firma exige vencimiento ----------
select privado.reemplazar_en_funcion('documentos_registrar(bigint,jsonb)'::regprocedure,
  'if cas in (''contrato_pyme'', ''contrato_dedicado'') and rol not in (''admin'', ''abogado'') then raise exception ''El contrato lo sube Legal'' using errcode = ''P0001''; end if;',
  'if cas in (''contrato_pyme'', ''contrato_dedicado'') and rol not in (''admin'', ''abogado'') then raise exception ''El contrato lo sube Legal'' using errcode = ''P0001''; end if;
      if cas in (''contrato_pyme'', ''contrato_dedicado'') and nullif(it ->> ''firmado_en'', '''') is not null and nullif(it ->> ''vence_en'', '''') is null then raise exception ''Pon la fecha de vencimiento del contrato'' using errcode = ''P0001''; end if;');
select privado.reemplazar_en_funcion('documentos_registrar(bigint,jsonb)'::regprocedure,
  'insert into public.documentos (cliente_id, casilla, numero, estado, subido_por, subido_en, vence_en, firmado_en, revisado_por, revisado_en)
      values (p_cliente, cas, num, case when v_ok then ''aprobado'' else ''por_revisar'' end, yo, now(), nullif(it ->> ''vence_en'', '''')::date, nullif(it ->> ''firmado_en'', '''')::date, case when v_ok then yo end, case when v_ok then now() end)',
  'insert into public.documentos (cliente_id, casilla, numero, estado, subido_por, subido_en, vence_en, firmado_en, revisado_por, revisado_en, titulo, nota)
      values (p_cliente, cas, num, case when v_ok then ''aprobado'' else ''por_revisar'' end, yo, now(), nullif(it ->> ''vence_en'', '''')::date, nullif(it ->> ''firmado_en'', '''')::date, case when v_ok then yo end, case when v_ok then now() end,
        case when cas = ''otro'' and num < 60 then left(nullif(btrim(it ->> ''titulo''), ''''), 80) end, case when cas = ''otro'' and num < 60 then left(nullif(btrim(it ->> ''nota''), ''''), 500) end)');
select privado.reemplazar_en_funcion('documentos_registrar(bigint,jsonb)'::regprocedure,
  'motivo = null, nota = null, subido_por = yo,',
  'motivo = null, nota = excluded.nota, titulo = coalesce(excluded.titulo, documentos.titulo), subido_por = yo,');

-- ---------- Ficha: suspensión, líder, etiquetas, contrato pendiente, título del documento, permisos ----------
select privado.reemplazar_en_funcion('cliente_ficha(bigint)'::regprocedure,
  '''provisional'', c.provisional, ''unido_a'', c.unido_a,',
  '''provisional'', c.provisional, ''unido_a'', c.unido_a, ''lider_id'', c.lider_id, ''suspendido_en'', c.suspendido_en, ''suspendido_por'', privado.nombre_de(c.suspendido_por), ''suspendido_nota'', c.suspendido_nota, ''contrato_pend'', privado.contrato_pendiente(c.id),');
select privado.reemplazar_en_funcion('cliente_ficha(bigint)'::regprocedure,
  '''firmado_en'', d.firmado_en, ''subido_en'', d.subido_en,',
  '''firmado_en'', d.firmado_en, ''titulo'', d.titulo, ''subido_en'', d.subido_en,');
select privado.reemplazar_en_funcion('cliente_ficha(bigint)'::regprocedure,
  '''faltantes'', privado.faltantes(c.id),',
  '''faltantes'', privado.faltantes(c.id),
    ''gestion'', (select coalesce(jsonb_agg(jsonb_build_object(''e'', g.etiqueta, ''fecha'', g.fecha, ''nota'', g.nota, ''por'', privado.nombre_de(g.por), ''en'', g.en) order by g.en desc, g.id desc), ''[]''::jsonb)
      from (select * from public.cliente_gestion g0 where g0.cliente_id = c.id order by g0.en desc, g0.id desc limit 10) g),
    ''lideres'', case when v_rol = ''admin'' then (select coalesce(jsonb_agg(jsonb_build_object(''id'', pf.id, ''nombre'', pf.nombre) order by pf.nombre), ''[]''::jsonb)
      from public.perfiles pf where pf.rol = ''lider'' and pf.activo) end,');
select privado.reemplazar_en_funcion('cliente_ficha(bigint)'::regprocedure,
  '''enviar'', v_rol in (''admin'', ''analista'', ''lider''))',
  '''enviar'', v_rol in (''admin'', ''analista'', ''lider''), ''lider_cambiar'', v_rol = ''admin'', ''suspender'', v_rol = ''admin'', ''etiquetar'', true)');

-- ---------- Bandeja de Legal: contratos firmados sin archivo o sin vencimiento ----------
select privado.reemplazar_en_funcion('revision_bandeja(text,text,integer,integer)'::regprocedure,
  'case when c.estatus = ''por_firmar'' then ''por_firmar'' end,',
  'case when c.estatus = ''por_firmar'' then ''por_firmar'' end,
        case when c.suspendido_en is null and privado.contrato_pendiente(c.id) is not null then ''contrato_pend'' end,');
select privado.reemplazar_en_funcion('revision_bandeja(text,text,integer,integer)'::regprocedure,
  '''lider'', coalesce(privado.nombre_de(p.lider_id), p.lider_nombre), ''estatus'', p.estatus,',
  '''lider'', coalesce(privado.nombre_de(p.lider_id), p.lider_nombre), ''estatus'', p.estatus, ''contrato_pend'', privado.contrato_pendiente(p.id),');

-- Ajuste (migración lote_21oct_contrato_pendiente): un contrato de servicio deja de estar "sin archivo" al subir su documento;
-- falta_archivo solo cuenta para VGT y colocation (no tienen casilla).
-- (privado.contrato_pendiente reescrita con: (k.tipo = 'servicio' and not dd.arch) or (k.tipo <> 'servicio' and k.falta_archivo))
