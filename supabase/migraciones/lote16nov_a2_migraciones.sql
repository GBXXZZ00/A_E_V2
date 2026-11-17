-- Lote 16/11 A, tramo 2: Migraciones (partes 1, 2 y 3). No toca privado.comision_filas3.

-- Dueño de un cambio: quien lo tiene; si es "sin registrar" y nadie lo tiene, el líder del cliente
create or replace function privado.cambio_dueno(c public.cambios) returns uuid language sql stable security definer set search_path to '' as $$
  select coalesce(c.lider_id, case when c.estado = 'sin_registro' then (select k.lider_id from public.clientes k where k.id = c.cliente_id) end)
$$;

-- Quién ve un cambio: administrador y Senior/Coordinador todo; analista su cartera (o líderes sin analista); líder lo suyo
create or replace function privado.cambio_puedo_ver(c public.cambios) returns boolean language plpgsql stable security definer set search_path to '' as $$
declare r text := privado.rol_actual(); yo uuid := (select auth.uid()); d uuid;
begin
  if r = 'admin' then return true; end if;
  if r is null or yo is null then return false; end if;
  if c.creado_por = yo then return true; end if;
  d := privado.cambio_dueno(c);
  if r = 'lider' then return coalesce(d = yo, false); end if;
  if r = 'analista' then return privado.es_senior() or (d is not null and coalesce(privado.analista_de(d), yo) = yo); end if;
  return false;
end $$;

-- Líder nombrado en un texto (comentario del reporte): solo si hay uno y nada más
create or replace function privado.lider_en_texto(t text) returns uuid language sql stable security definer set search_path to '' as $$
  select case when count(*) = 1 then (array_agg(p.id))[1] end from public.perfiles p
  where p.activo and p.rol = 'lider' and privado.norm(t) <> '' and length(privado.norm(split_part(btrim(p.nombre), ' ', 1))) >= 3
    and privado.norm(t) ~ ('\m' || privado.norm(split_part(btrim(p.nombre), ' ', 1)) || '\M')
$$;

create or replace function privado.cambio_json(c public.cambios) returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object('id', c.id, 'tipo', c.tipo, 'estado', c.estado, 'origen', c.origen, 'creado_en', c.creado_en, 'creado_por', privado.nombre_de(c.creado_por),
    'lider', coalesce(privado.nombre_de(c.lider_id), c.lider_nombre), 'lider_id', c.lider_id, 'cliente_id', c.cliente_id,
    'titular', jsonb_build_object('tipo', c.titular_tipo, 'doc', c.titular_doc, 'nombre', c.titular_nombre, 'natural', c.titular_natural),
    'nuevo', case when c.nuevo_doc is null then null else jsonb_build_object('tipo', c.nuevo_tipo, 'doc', c.nuevo_doc, 'nombre', c.nuevo_nombre, 'natural', c.nuevo_natural, 'cliente_id', c.nuevo_cliente_id,
      'correo', c.nuevo_correo, 'telefono', c.nuevo_telefono, 'domicilio', c.nuevo_domicilio, 'rep_nombre', c.rep_nombre, 'rep_cedula', c.rep_cedula) end,
    'categoria_anterior', c.categoria_anterior, 'categoria_nueva', c.categoria_nueva, 'plan_anterior', c.plan_anterior, 'plan_nuevo', c.plan_nuevo,
    'servicios', c.servicios, 'nota', c.nota, 'motivo', c.motivo, 'aviso', c.aviso,
    'aprobado_en', c.aprobado_en, 'emitido_en', c.emitido_en, 'emitido_por', privado.nombre_de(c.emitido_por),
    'confirmado_en', c.confirmado_en, 'confirmado_como', c.confirmado_como, 'cierre_nota', c.cierre_nota, 'cerrado_por', privado.nombre_de(c.cerrado_por),
    'fecha_cambio', c.fecha_cambio, 'comision', c.comision, 'instalacion_id', c.instalacion_id, 'pagado_fuera', c.pagado_fuera, 'corte', c.corte,
    'corte_cambio', case when c.fecha_cambio is not null then privado.corte_de((c.fecha_cambio at time zone 'America/Caracas')::date) end,
    'puedo_hecho', c.estado = 'por_emitir' and privado.puede_hecho(c),
    'borrador', c.borrador, 'dueno_id', x.d, 'dueno', coalesce(privado.nombre_de(x.d), c.lider_nombre), 'analista_id', privado.analista_de(x.d),
    'sugerido_id', c.sugerido_id, 'sugerido', privado.nombre_de(c.sugerido_id),
    'reporte', (select jsonb_build_object('fecha', a.fecha, 'comentario', a.comentario, 'operador', a.operador) from public.cambios_archivo a where a.id = c.archivo_fila),
    'docs', (select jsonb_build_object('total', count(*), 'aprobados', count(*) filter (where r->>'estado' = 'aprobado'), 'faltan', count(*) filter (where r->>'estado' in ('falta', 'devuelto')))
             from jsonb_array_elements(privado.cambio_requisitos(c.id)) r))
  from (select privado.cambio_dueno(c) d) x
$$;

-- Documentos que pide un cambio: el expediente de quien queda como titular (persona natural: cédula y RIF; empresa: el de siempre).
-- La planilla de cambio de titular es obligatoria para hacer el cambio, pero no entra en la revisión del administrador.
create or replace function privado.cambio_requisitos(p bigint) returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare c public.cambios; r jsonb := '[]'::jsonb; q record; cli bigint;
begin
  select * into c from public.cambios where id = p;
  if not found or c.tipo = 'residencial' then return r; end if;
  cli := case when c.tipo = 'migracion' then c.cliente_id else c.nuevo_cliente_id end;
  if cli is null then return r; end if;
  for q in select rq.r_casilla, rq.r_numero, rq.r_texto from privado.requeridos(cli) rq loop
    r := r || jsonb_build_array(jsonb_build_object('cliente_id', cli, 'casilla', q.r_casilla, 'numero', q.r_numero,
      'texto', upper(left(q.r_texto, 1)) || substr(q.r_texto, 2) || case when c.tipo = 'migracion' then '' else ' del nuevo titular' end));
  end loop;
  return coalesce((select jsonb_agg(x || jsonb_build_object('estado', coalesce((select d.estado from public.documentos d
            where d.cliente_id = cli and d.casilla = x->>'casilla' and d.numero = (x->>'numero')::int
              and exists (select 1 from public.documento_archivos da where da.documento_id = d.id and da.vigente) limit 1), 'falta')))
          from jsonb_array_elements(r) x), '[]'::jsonb);
end $$;

create or replace function public.cambios_lista() returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare v_rol text := privado.exigir('admin', 'analista', 'lider'); v_yo uuid := (select auth.uid()); senior boolean := privado.es_senior(); coord boolean := privado.es_coordinador();
  lectura boolean := current_setting('transaction_read_only', true) = 'on';
begin
  return jsonb_build_object('rol', v_rol, 'yo', v_yo, 'hoy', privado.hoy(), 'desde', privado.cambios_desde(), 'corte', privado.corte_en_curso(),
    'indice', (select jsonb_build_object('en', k.cerrada_en, 'filas', k.filas) from privado.tad_indice_cargas k where k.id = privado.tad_indice_vigente()),
    'archivo', (select jsonb_build_object('en', k.en, 'filas', k.filas) from privado.cambios_cargas k order by k.id desc limit 1),
    'reporte', (select jsonb_build_object('hasta', max(k.hasta), 'en', max(k.en)) from privado.cambios_cargas k),
    'puedo', jsonb_build_object('revisar', v_rol = 'admin' and not lectura, 'emitir', v_rol in ('admin', 'analista') and not lectura, 'confirmar', (v_rol = 'admin' or senior) and not lectura,
      'sin_registro', (v_rol = 'admin' or senior) and not lectura, 'asignar', (v_rol = 'admin' or senior) and not lectura, 'coordinador', coord, 'elegir_lider', v_rol in ('admin', 'analista') and not lectura,
      'subir_reporte', v_rol in ('admin', 'analista') and not lectura, 'enviar_todos', (v_rol = 'admin' or senior) and not lectura, 'por_lider', v_rol <> 'lider', 'nuevo', not lectura, 'lectura', lectura),
    'lideres', case when v_rol in ('admin', 'analista') then (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'analista_id', p.analista_id) order by p.nombre), '[]'::jsonb) from public.perfiles p where p.activo and p.rol = 'lider') else '[]'::jsonb end,
    'filas', coalesce((select jsonb_agg(privado.cambio_json(c) order by coalesce(c.fecha_cambio, c.creado_en) desc) from public.cambios c
      where privado.cambio_puedo_ver(c)
        and (c.estado in ('por_revisar', 'por_emitir', 'por_confirmar', 'sin_registro') or c.actualizado_en > now() - interval '120 days' or c.origen = 'historico')), '[]'::jsonb));
end $$;

select privado.redefinir('public.cambio_detalle'::regproc::regprocedure, jsonb_build_array(jsonb_build_array(
  E'if not found or (v_rol = ''lider'' and c.lider_id is distinct from v_yo and c.creado_por is distinct from v_yo)\n     or (c.estado = ''sin_registro'' and v_rol <> ''admin'' and not privado.es_senior()) then',
  'if not found or not privado.cambio_puedo_ver(c) then')));

-- Al aprobar los documentos pasa al analista; si ya estaba hecha en el sistema (el reporte trajo la fecha o el TAD la vio), salta ese paso
create or replace function privado.cambio_avanzar(p bigint, autor uuid) returns void language plpgsql security definer set search_path to '' as $$
declare c public.cambios; ev text;
begin
  select * into c from public.cambios where id = p for update;
  if not found or c.estado <> 'por_revisar' or c.borrador then return; end if;
  if exists (select 1 from jsonb_array_elements(privado.cambio_requisitos(p)) x where x->>'estado' <> 'aprobado') then return; end if;
  update public.cambios set estado = 'por_emitir', aprobado_en = now(), aprobado_por = autor, actualizado_en = now() where id = p;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues) values (autor, 'cambio_docs_aprobados', 'cambios', p::text, jsonb_build_object('estado', 'por_emitir'));
  if c.fecha_cambio is not null and c.tipo <> 'titularidad' then
    perform privado.cambio_confirmar(p, c.fecha_cambio, 'archivo', autor);
  elsif c.origen = 'tad' then
    ev := privado.cambio_evaluar(p);
    if ev = 'ok' then perform privado.cambio_confirmar(p, c.creado_en, 'tad', autor); end if;
  end if;
end $$;

-- Asignar líder a una sin registrar: queda sin registrar (el líder la registra con sus documentos); a residencial se confirma como antes
select privado.redefinir('public.cambio_accion'::regproc::regprocedure, jsonb_build_array(jsonb_build_array(
  E'        estado = case when c.tipo = ''residencial'' then ''por_confirmar'' else ''por_revisar'' end, actualizado_en = now() where id = p_id;\n      if c.tipo = ''residencial'' then perform privado.cambio_confirmar(p_id, c.creado_en, ''tad'', v_yo); else perform privado.cambio_avanzar(p_id, v_yo); end if;',
  E'        estado = case when c.tipo = ''residencial'' then ''por_confirmar'' else ''sin_registro'' end, sugerido_id = null, actualizado_en = now() where id = p_id;\n      if c.tipo = ''residencial'' then perform privado.cambio_confirmar(p_id, coalesce(c.fecha_cambio, c.creado_en), ''tad'', v_yo); end if;')));

-- Registrar un cambio (también desde una "sin registrar": p_datos.desde) o guardarlo como borrador (p_datos.borrador)
create or replace function public.cambio_crear(p_datos jsonb) returns bigint language plpgsql security definer set search_path to '' as $$
declare v_rol text := privado.exigir('admin', 'analista', 'lider'); v_yo uuid := (select auth.uid()); v bigint := privado.tad_indice_vigente();
  v_tipo text := p_datos->>'tipo'; claves text[]; srv jsonb; n int; docs int; tit record; nv jsonb := p_datos->'nuevo';
  nd text; nt text; nn text; nnat boolean; cid bigint; tcid bigint; lid uuid; nid bigint; td text; mot text := left(nullif(btrim(coalesce(p_datos->>'motivo', '')), ''), 500);
  co text; te text; rn text; rc text; v_desde bigint := nullif(p_datos->>'desde', '')::bigint; v_borr boolean := coalesce((p_datos->>'borrador')::boolean, false); d0 public.cambios;
  v_nota text := left(nullif(btrim(coalesce(p_datos->>'nota', '')), ''), 500);
begin
  if v_tipo is null or v_tipo not in ('migracion', 'titularidad', 'ambos', 'residencial') then raise exception 'Elige qué cambia' using errcode = 'P0001'; end if;
  if v is null then raise exception 'Todavía no se ha subido el TAD completo' using errcode = 'P0001'; end if;
  if v_desde is not null then
    select * into d0 from public.cambios where id = v_desde for update;
    if not found or not privado.cambio_puedo_ver(d0) then raise exception 'No encontré ese cambio' using errcode = 'P0001'; end if;
    if d0.estado <> 'sin_registro' then raise exception 'Ese cambio ya se registró' using errcode = 'P0001'; end if;
    if v_tipo = 'residencial' then raise exception 'Un cambio a residencial no se registra con documentos' using errcode = 'P0001'; end if;
  end if;
  select array_agg(distinct x) into claves from jsonb_array_elements_text(coalesce(p_datos->'servicios', '[]'::jsonb)) x;
  if claves is null then raise exception 'Marca al menos un servicio' using errcode = 'P0001'; end if;
  select jsonb_agg(jsonb_build_object('clave', i.clave, 'sucursal', i.sucursal, 'codigo', i.codigo, 'equipo', i.equipo, 'pon', i.pon, 'plan', i.plan, 'categoria', i.categoria, 'direccion', i.direccion, 'estado', i.estado) order by i.clave),
         count(*), count(distinct i.doc_numero) into srv, n, docs
  from public.tad_indice i where i.clave = any (claves) and i.carga = v;
  if n <> array_length(claves, 1) then raise exception 'Algún servicio ya no está en el TAD. Búscalo de nuevo' using errcode = 'P0001'; end if;
  if docs <> 1 then raise exception 'Los servicios deben ser del mismo titular' using errcode = 'P0001'; end if;
  select max(i.doc_tipo) t, max(i.doc_numero) d, max(i.nombre) nom, max(i.categoria) cat, max(i.plan) plan,
    bool_and(privado.emp_completa(i.categoria, i.plan)) todos_emp, bool_or(privado.es_pyme(i.categoria) or privado.es_emp(i.plan)) algo_emp
    into tit from public.tad_indice i where i.clave = any (claves) and i.carga = v;
  -- Si ya está hecha (viene de una sin registrar), el TAD puede mostrarla ya como empresa
  if v_tipo in ('migracion', 'ambos') and tit.todos_emp and v_desde is null then raise exception 'Ese servicio ya es empresa (categoría PYME y plan EMP)' using errcode = 'P0001'; end if;
  if v_tipo = 'residencial' and not tit.algo_emp then raise exception 'Ese servicio ya es residencial' using errcode = 'P0001'; end if;
  if v_tipo = 'residencial' and (mot is null or length(mot) < 4) then raise exception 'Escribe el motivo del cambio a residencial' using errcode = 'P0001'; end if;
  if exists (select 1 from public.cambios c where c.estado in ('por_revisar', 'por_emitir', 'por_confirmar', 'sin_registro') and c.id is distinct from v_desde
             and exists (select 1 from jsonb_array_elements(c.servicios) s where s->>'clave' = any (claves))) then
    raise exception 'Uno de esos servicios ya tiene un cambio en curso' using errcode = 'P0001'; end if;
  lid := case when v_rol = 'lider' then v_yo else coalesce(nullif(p_datos->>'lider_id', '')::uuid, case when v_desde is not null then privado.cambio_dueno(d0) end) end;
  if lid is not null and not exists (select 1 from public.perfiles p where p.id = lid and p.rol = 'lider' and p.activo) then raise exception 'Elige un líder activo' using errcode = 'P0001'; end if;
  -- Cliente de hoy: si no existe en la app, se crea con su RIF del TAD
  td := ltrim(coalesce(tit.d, ''), '0');
  select id into tcid from public.clientes where unido_a is null and (doc_numero = td or privado.mismo_doc(ltrim(doc_numero, '0'), td)) order by (doc_numero = td) desc, id limit 1;
  if tcid is null and v_tipo <> 'residencial' then
    insert into public.clientes (doc_tipo, doc_numero, nombre, es_natural, estatus, lider_id)
    values (coalesce(nullif(tit.t, ''), 'J'), td, upper(coalesce(tit.nom, 'SIN NOMBRE')), coalesce(tit.t, 'J') in ('V', 'E'), 'documentos_solicitados', lid)
    returning id into tcid;
    insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues) values (v_yo, 'cliente_creado', 'clientes', tcid::text, jsonb_build_object('por', 'migracion'));
  end if;
  if v_tipo in ('titularidad', 'ambos') then
    nnat := coalesce((nv->>'natural')::boolean, false);
    nd := ltrim(regexp_replace(coalesce(nv->>'doc', ''), '\D', '', 'g'), '0'); nt := upper(left(btrim(coalesce(nv->>'tipo', '')), 1));
    nn := upper(regexp_replace(btrim(coalesce(nv->>'nombre', '')), '\s+', ' ', 'g'));
    co := nullif(lower(btrim(coalesce(nv->>'correo', ''))), ''); te := nullif(btrim(coalesce(nv->>'telefono', '')), '');
    rn := nullif(upper(regexp_replace(btrim(coalesce(nv->>'rep_nombre', '')), '\s+', ' ', 'g')), ''); rc := nullif(ltrim(regexp_replace(coalesce(nv->>'rep_cedula', ''), '\D', '', 'g'), '0'), '');
    if nd !~ '^[1-9][0-9]{4,9}$' then raise exception 'Sube el RIF del nuevo titular' using errcode = 'P0001'; end if;
    if nt not in ('V', 'E', 'J', 'G', 'P', 'C') then nt := case when nnat then 'V' else 'J' end; end if;
    if nnat and nt not in ('V', 'E') then raise exception 'Una persona natural lleva cédula o RIF con V o E' using errcode = 'P0001'; end if;
    if not nnat and nt in ('V', 'E') then raise exception 'Una empresa lleva RIF con J, G, C o P' using errcode = 'P0001'; end if;
    if length(nd) = 9 and nnat and privado.rif_digito(nt, left(nd, 8)) = right(nd, 1)::int then nd := ltrim(left(nd, 8), '0'); end if;
    if length(nn) < 3 then raise exception 'Falta el nombre del nuevo titular' using errcode = 'P0001'; end if;
    if privado.mismo_doc(nd, td) then raise exception 'El nuevo titular es el mismo de ahora' using errcode = 'P0001'; end if;
    if co is not null and co !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Revisa el correo' using errcode = 'P0001'; end if;
    if te is not null and length(regexp_replace(te, '\D', '', 'g')) < 10 then raise exception 'Revisa el teléfono' using errcode = 'P0001'; end if;
    select id into cid from public.clientes where unido_a is null and (doc_numero = nd or (es_natural = nnat and privado.mismo_doc(ltrim(doc_numero, '0'), nd)))
      order by (doc_numero = nd) desc, id limit 1;
    if cid is null then
      insert into public.clientes (doc_tipo, doc_numero, nombre, es_natural, estatus, lider_id, direccion, correo_empresa, telefono)
      values (nt, nd, nn, nnat, 'documentos_solicitados', lid, nullif(btrim(coalesce(nv->>'domicilio', '')), ''), case when not nnat then co end, te)
      returning id into cid;
      insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues) values (v_yo, 'cliente_creado', 'clientes', cid::text, jsonb_build_object('por', 'cambio_titular'));
    end if;
    if nnat or rn is not null or co is not null or te is not null then
      insert into public.representantes (cliente_id, orden, nombre, correo, telefono) values (cid, 1, case when nnat then nn else rn end, co, te)
      on conflict (cliente_id, orden) do update set nombre = coalesce(public.representantes.nombre, excluded.nombre),
        correo = coalesce(public.representantes.correo, excluded.correo), telefono = coalesce(public.representantes.telefono, excluded.telefono);
    end if;
  end if;
  if v_desde is not null then
    -- La que encontró el reporte pasa a ser la registrada: guarda su fecha, su origen y su lugar en el corte
    update public.cambios set creado_por = v_yo, lider_id = lid, lider_nombre = privado.nombre_de(lid), tipo = v_tipo, estado = 'por_revisar', borrador = v_borr,
      cliente_id = tcid, titular_tipo = tit.t, titular_doc = td, titular_nombre = tit.nom, titular_natural = coalesce(tit.t, 'J') in ('V', 'E'),
      nuevo_tipo = nt, nuevo_doc = nd, nuevo_nombre = nn, nuevo_natural = nnat, nuevo_cliente_id = cid, nuevo_correo = co, nuevo_telefono = te,
      nuevo_domicilio = nullif(btrim(coalesce(nv->>'domicilio', '')), ''), rep_nombre = rn, rep_cedula = rc,
      categoria_anterior = coalesce(d0.categoria_anterior, tit.cat), categoria_nueva = coalesce(d0.categoria_nueva, 'PYME-1GB'),
      plan_anterior = coalesce(d0.plan_anterior, tit.plan), plan_nuevo = coalesce(d0.plan_nuevo, 'ORO-EMP'),
      servicios = srv, nota = coalesce(v_nota, d0.nota), sugerido_id = null, actualizado_en = now()
    where id = v_desde;
    nid := v_desde;
  else
    insert into public.cambios (creado_por, lider_id, tipo, estado, origen, cliente_id, titular_tipo, titular_doc, titular_nombre, titular_natural,
      nuevo_tipo, nuevo_doc, nuevo_nombre, nuevo_natural, nuevo_cliente_id, nuevo_correo, nuevo_telefono, nuevo_domicilio, rep_nombre, rep_cedula,
      categoria_anterior, categoria_nueva, plan_anterior, plan_nuevo, servicios, nota, motivo, borrador)
    values (v_yo, lid, v_tipo, case when v_tipo = 'residencial' then 'por_emitir' else 'por_revisar' end, 'app', tcid, tit.t, td, tit.nom, coalesce(tit.t, 'J') in ('V', 'E'),
      nt, nd, nn, nnat, cid, co, te, nullif(btrim(coalesce(nv->>'domicilio', '')), ''), rn, rc,
      tit.cat, case when v_tipo in ('migracion', 'ambos') then 'PYME-1GB' when v_tipo = 'residencial' then 'RESIDENCIAL' end, tit.plan,
      case when v_tipo in ('migracion', 'ambos') then 'ORO-EMP' when v_tipo = 'residencial' then 'RESIDENCIAL' end,
      srv, v_nota, mot, v_borr and v_tipo <> 'residencial')
    returning id into nid;
  end if;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues)
  values (v_yo, case when v_borr then 'cambio_borrador' else 'cambio_creado' end, 'cambios', nid::text,
    jsonb_build_object('tipo', v_tipo, 'servicios', n, 'nuevo', nd, 'motivo', mot, 'desde_reporte', v_desde is not null, 'ocr', case when nv ? 'ocr' then nv->'ocr' end));
  if not v_borr then perform privado.cambio_avanzar(nid, v_yo); end if;   -- si el expediente ya está aprobado, pasa de una vez
  return nid;
end $$;

-- "Enviar" de la solicitud por pasos: el borrador pasa a verificación del administrador
create or replace function public.cambio_enviar(p_id bigint) returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_rol text := privado.exigir('admin', 'analista', 'lider'); v_yo uuid := (select auth.uid()); c public.cambios; f int;
begin
  select * into c from public.cambios where id = p_id for update;
  if not found or not privado.cambio_puedo_ver(c) then raise exception 'No encontré ese cambio' using errcode = 'P0001'; end if;
  if not c.borrador then raise exception 'Esa solicitud ya se envió' using errcode = 'P0001'; end if;
  select count(*) into f from jsonb_array_elements(privado.cambio_requisitos(p_id)) x where x->>'estado' = 'falta';
  if f > 0 then raise exception '%', case when f = 1 then 'Falta 1 documento por subir' else 'Faltan ' || f || ' documentos por subir' end using errcode = 'P0001'; end if;
  update public.cambios set borrador = false, actualizado_en = now() where id = p_id;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues) values (v_yo, 'cambio_enviado', 'cambios', p_id::text, jsonb_build_object('borrador', true), jsonb_build_object('estado', c.estado));
  perform privado.cambio_avanzar(p_id, v_yo);
  return (select privado.cambio_json(z) from public.cambios z where z.id = p_id);
end $$;
grant execute on function public.cambio_enviar(bigint) to authenticated;

-- "Recordar" y "Enviar pendientes" en Migraciones: lo que le falta registrar al líder. Misma regla que Comisiones:
-- administrador y Senior/Coordinador a todos; el analista a los líderes de su cartera.
create or replace function public.cambio_recordar(p_id bigint default null, p_lider uuid default null) returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_rol text := privado.exigir('admin', 'analista'); v_yo uuid := (select auth.uid()); lid uuid; c public.cambios; items jsonb; ids jsonb;
begin
  if p_id is not null then
    select * into c from public.cambios where id = p_id;
    if not found or not privado.cambio_puedo_ver(c) then raise exception 'No encontré ese cambio' using errcode = 'P0001'; end if;
    lid := privado.cambio_dueno(c);
  else lid := p_lider; end if;
  if lid is null then raise exception 'Esa migración no tiene líder: asígnale uno primero' using errcode = 'P0001'; end if;
  if not (v_rol = 'admin' or privado.es_senior() or privado.analista_de(lid) = v_yo) then raise exception 'Se lo recuerda el administrador, la Senior o su analista' using errcode = 'P0001'; end if;
  select jsonb_agg(jsonb_build_object('id', z.id, 'titular', z.titular_nombre, 'tipo', z.tipo, 'servicios', z.servicios, 'fecha', coalesce(z.fecha_cambio, z.creado_en), 'estado', z.estado, 'borrador', z.borrador,
           'categoria_anterior', z.categoria_anterior, 'categoria_nueva', z.categoria_nueva) order by coalesce(z.fecha_cambio, z.creado_en)),
         jsonb_agg(z.id)
    into items, ids
  from public.cambios z where (p_id is null or z.id = p_id) and privado.cambio_dueno(z) = lid and z.tipo <> 'residencial'
    and (z.estado = 'sin_registro' or (z.estado = 'por_revisar' and (z.borrador or exists (select 1 from jsonb_array_elements(privado.cambio_requisitos(z.id)) r where r->>'estado' in ('falta', 'devuelto')))));
  if items is null then raise exception 'No tiene migraciones por registrar' using errcode = 'P0001'; end if;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues) values (v_yo, 'cambio_recordar', 'perfiles', lid::text, jsonb_build_object('cambios', ids));
  return jsonb_build_object('lider', privado.nombre_de(lid), 'telefono', (select p.whatsapp from public.perfiles p where p.id = lid), 'items', items);
end $$;
grant execute on function public.cambio_recordar(bigint, uuid) to authenticated;

-- Parte 1: reporte "Consulta Cambio de Categoría"
create or replace function public.cambios_archivo_cargar(p_archivo text, p_filas jsonb) returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_yo uuid := privado.exigir_carga(); k bigint; x jsonb; cod text; f date; ant text; act text; actn text; op text; com text; fid bigint; a_pyme boolean;
  n_pyme int := 0; n_res int := 0; n_desc int := 0; n_rep int := 0; n_sin int := 0; n_reg int := 0; n_nuevas int := 0; tot int := 0; v_hasta date;
  z public.cambios; i record; ts timestamptz; cli bigint; lid uuid; sug uuid; nid bigint; res jsonb;
begin
  if jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) > 20000 then raise exception 'El archivo no se pudo leer' using errcode = 'P0001'; end if;
  insert into privado.cambios_cargas (archivo, por) values (left(p_archivo, 200), v_yo) returning id into k;
  for x in select * from jsonb_array_elements(p_filas) loop
    tot := tot + 1;
    cod := ltrim(btrim(coalesce(x->>'codigo', '')), '0'); ant := upper(btrim(coalesce(x->>'anterior', ''))); act := upper(btrim(coalesce(x->>'actual', '')));
    op := btrim(coalesce(x->>'operador', '')); com := btrim(coalesce(x->>'comentario', '')); actn := privado.norm(act);
    f := case when x->>'fecha' ~ '^\d{1,2}[-/]\d{1,2}[-/]\d{4}' then to_date(replace(substring(x->>'fecha' from '^\d{1,2}[-/]\d{1,2}[-/]\d{4}'), '/', '-'), 'DD-MM-YYYY')
              when x->>'fecha' ~ '^\d{4}-\d\d-\d\d' then (left(x->>'fecha', 10))::date end;
    -- Descartes: sin código o fecha; reconexión, uso interno, empleado, exonerado, reactivación; activaciones (instalaciones nuevas);
    -- y lo que no cruza la línea residencial / PYME (PYME a PYME es cambio de plan)
    if cod = '' or f is null
       or actn ~ '^(reconexion( 0?2)?|uso interno|empleados?|exonerados?|1 ?gb ?- ?reactivacion)$'
       or ant ~ '^0*(56|58|2)$' or (com ~* 'change profile from radius' and ant ~ '^\s*\d+\s*$') or (op ~* 'radius' and ant ~ '^\s*\d+\s*$')
       or privado.es_pyme(ant) = privado.es_pyme(act) then
      n_desc := n_desc + 1; continue;
    end if;
    -- Repetidos del mismo servicio y día cuentan una vez (también si se sube el mismo reporte otra vez)
    if exists (select 1 from public.cambios_archivo a where a.codigo = cod and a.fecha = f) then n_rep := n_rep + 1; continue; end if;
    insert into public.cambios_archivo (carga, codigo, nombre, fecha, cat_anterior, cat_actual, operador, comentario)
    values (k, cod, left(x->>'nombre', 200), f, ant, act, left(op, 120), left(com, 500)) returning id into fid;
    a_pyme := privado.es_pyme(act);
    if a_pyme then n_pyme := n_pyme + 1; else n_res := n_res + 1; end if;
    if v_hasta is null or f > v_hasta then v_hasta := f; end if;
    ts := (f::timestamp at time zone 'America/Caracas') + interval '12 hours';
    -- 1. Ya hay un cambio de ese servicio: el registrado primero
    select * into z from public.cambios c where c.estado not in ('cancelado', 'error', 'revertido') and c.origen <> 'historico' and c.tipo <> 'titularidad'
      and (c.tipo = 'residencial') = (not a_pyme)
      and exists (select 1 from jsonb_array_elements(c.servicios) s where ltrim(s->>'codigo', '0') = cod)
      and (c.archivo_fila is null or c.estado <> 'confirmado')
    order by (c.estado = 'sin_registro'), c.creado_en desc limit 1;
    if found then
      if z.estado = 'sin_registro' then
        lid := privado.cambio_dueno(z);
        sug := case when lid is null then privado.lider_en_texto(com) end;
        update public.cambios set fecha_cambio = ts, archivo_fila = fid, corte = privado.corte_de(f),
          categoria_anterior = coalesce(nullif(ant, ''), categoria_anterior), categoria_nueva = coalesce(nullif(act, ''), categoria_nueva),
          lider_id = lid, lider_nombre = coalesce(privado.nombre_de(lid), lider_nombre), sugerido_id = coalesce(sug, sugerido_id), actualizado_en = now()
        where id = z.id;
        if a_pyme then n_sin := n_sin + 1; end if;
      else
        update public.cambios set fecha_cambio = ts, archivo_fila = fid, corte = privado.corte_de(f), actualizado_en = now() where id = z.id;
        if z.estado in ('por_emitir', 'por_confirmar') then perform privado.cambio_confirmar(z.id, ts, 'archivo', v_yo); end if;
        n_reg := n_reg + 1;
      end if;
      insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues) values (v_yo, 'cambio_reporte', 'cambios', z.id::text, jsonb_build_object('fecha', f, 'anterior', ant, 'actual', act, 'carga', k));
      continue;
    end if;
    -- 2. Nadie la registró: nace "sin registrar" (desde la fecha mínima de comisiones)
    if f < privado.cambios_desde() then continue; end if;
    select t.clave, t.sucursal, t.codigo, t.equipo, t.pon, t.plan, t.categoria, t.direccion, t.estado, t.doc_tipo, t.doc_numero, t.nombre into i
    from public.tad_indice t where ltrim(t.codigo, '0') = cod order by (t.nombre_norm = privado.norm(x->>'nombre')) desc nulls last limit 1;
    cli := case when i.clave is not null then (select c2.id from public.clientes c2 where c2.unido_a is null and privado.mismo_doc(ltrim(c2.doc_numero, '0'), ltrim(i.doc_numero, '0')) order by c2.id limit 1) end;
    lid := (select c2.lider_id from public.clientes c2 where c2.id = cli);
    sug := case when lid is null then privado.lider_en_texto(com) end;
    insert into public.cambios (tipo, origen, estado, cliente_id, titular_tipo, titular_doc, titular_nombre, titular_natural, categoria_anterior, categoria_nueva, plan_anterior,
      servicios, archivo_fila, fecha_cambio, corte, lider_id, lider_nombre, sugerido_id)
    values (case when a_pyme then 'migracion' else 'residencial' end, 'archivo', 'sin_registro', cli, i.doc_tipo, ltrim(i.doc_numero, '0'), coalesce(i.nombre, left(x->>'nombre', 200)),
      coalesce(i.doc_tipo, 'J') in ('V', 'E'), ant, act, i.plan,
      case when i.clave is null then jsonb_build_array(jsonb_build_object('codigo', cod))
           else jsonb_build_array(jsonb_build_object('clave', i.clave, 'sucursal', i.sucursal, 'codigo', i.codigo, 'equipo', i.equipo, 'pon', i.pon, 'plan', i.plan, 'categoria', i.categoria, 'direccion', i.direccion, 'estado', i.estado)) end,
      fid, ts, privado.corte_de(f), lid, privado.nombre_de(lid), sug)
    returning id into nid;
    insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues) values (v_yo, 'cambio_sin_registro', 'cambios', nid::text, jsonb_build_object('fecha', f, 'anterior', ant, 'actual', act, 'carga', k));
    if a_pyme then n_sin := n_sin + 1; end if;
    n_nuevas := n_nuevas + 1;
  end loop;
  -- 3. Las sin registrar sin líder toman el del cliente
  update public.cambios w set lider_id = c2.lider_id, lider_nombre = privado.nombre_de(c2.lider_id), actualizado_en = now()
  from public.clientes c2 where w.estado = 'sin_registro' and w.lider_id is null and c2.id = w.cliente_id and c2.lider_id is not null;
  res := jsonb_build_object('filas', tot, 'a_pyme', n_pyme, 'sin_registrar', n_sin, 'residencial', n_res, 'descartadas', n_desc, 'repetidas', n_rep, 'registradas', n_reg, 'nuevas', n_nuevas, 'hasta', v_hasta,
    'con_fecha', n_reg, 'ignoradas', n_desc + n_rep);
  update privado.cambios_cargas set filas = n_pyme + n_res, ignoradas = n_desc + n_rep, confirmados = n_reg, sin_solicitud = n_nuevas, hasta = v_hasta, resumen = res where id = k;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues) values (v_yo, 'cambios_archivo', 'cambios_archivo', k::text, res);
  return res;
end $$;

-- Pendientes: la Senior solo ve las sin registrar sin líder; el líder ve las suyas sin registrar y sus borradores; el administrador no ve borradores
select privado.redefinir('privado.pendientes'::regproc::regprocedure, jsonb_build_array(
  jsonb_build_array('from public.cambios c where c.estado = ''sin_registro'';', 'from public.cambios c where c.estado = ''sin_registro'' and c.lider_id is null;'),
  jsonb_build_array('c.estado = ''por_revisar'' and exists', 'c.estado = ''por_revisar'' and not c.borrador and exists'),
  jsonb_build_array(E'c.tipo <> ''residencial'' and c.estado = ''por_revisar''\n    and exists (select 1 from jsonb_array_elements(privado.cambio_requisitos(c.id)) r where r->>''estado'' in (''falta'', ''devuelto''));',
    E'c.tipo <> ''residencial'' and (c.estado = ''sin_registro'' or (c.estado = ''por_revisar'' and (c.borrador\n    or exists (select 1 from jsonb_array_elements(privado.cambio_requisitos(c.id)) r where r->>''estado'' in (''falta'', ''devuelto'')))));'),
  jsonb_build_array('case when c.tipo = ''migracion'' then ''Faltan documentos de la migración''',
    'case when c.estado = ''sin_registro'' then ''Migración hecha sin registro: regístrala con sus documentos'' when c.borrador then ''Solicitud sin enviar: termina de subir los documentos'' when c.tipo = ''migracion'' then ''Faltan documentos de la migración''')));
