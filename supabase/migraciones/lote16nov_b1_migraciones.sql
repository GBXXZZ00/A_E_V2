-- Lote 16/11 B, tramo 1 (18/11): Migraciones (Decidir a mano, documentos de persona natural opcionales, casillas como la maqueta,
-- filtro del reporte con activaciones por RADIUS), bloques de Comisiones (Meses anteriores · faltan documentos) y duplicados.
-- No toca privado.comision_filas3 ni el pago.

-- Activaciones por RADIUS vistas en los reportes: solo el dato (código y fecha), para saber que un servicio nació así
create table if not exists privado.cambios_activaciones (codigo text not null, fecha date not null, carga bigint, primary key (codigo, fecha));
alter table privado.cambios_activaciones enable row level security;
alter table privado.cambios_cargas add column if not exists sin_identificar int;

-- Casillas de la migración: el expediente de quien queda como titular, en el orden y con los nombres de la maqueta.
-- Persona natural: RIF y cédula, opcionales (no ameritan documentos).
create or replace function privado.cambio_requisitos(p bigint) returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare c public.cambios; cli bigint; nat boolean;
begin
  select * into c from public.cambios where id = p;
  if not found or c.tipo = 'residencial' then return '[]'::jsonb; end if;
  cli := case when c.tipo = 'migracion' then c.cliente_id else c.nuevo_cliente_id end;
  if cli is null then return '[]'::jsonb; end if;
  nat := coalesce((select k.es_natural from public.clientes k where k.id = cli), false);
  return coalesce((select jsonb_agg(jsonb_build_object('cliente_id', cli, 'casilla', q.r_casilla, 'numero', q.r_numero, 'texto', q.txt, 'opcional', nat,
      'estado', coalesce((select d.estado from public.documentos d where d.cliente_id = cli and d.casilla = q.r_casilla and d.numero = q.r_numero
        and exists (select 1 from public.documento_archivos da where da.documento_id = d.id and da.vigente) limit 1), 'falta')) order by q.ord, q.r_casilla, q.r_numero)
    from (select rq.r_casilla, rq.r_numero,
        case when nat then case rq.r_casilla || ':' || rq.r_numero when 'rif_personal:1' then 'RIF' when 'cedula:1' then 'Cédula' else upper(left(rq.r_texto, 1)) || substr(rq.r_texto, 2) end
             else case rq.r_casilla || ':' || rq.r_numero when 'rif_empresa:0' then 'RIF de la empresa' when 'acta_constitutiva:0' then 'Acta constitutiva'
               when 'cedula:1' then 'Cédula del representante legal' when 'rif_personal:1' then 'RIF del representante legal' else upper(left(rq.r_texto, 1)) || substr(rq.r_texto, 2) end end txt,
        case when nat then case rq.r_casilla || ':' || rq.r_numero when 'rif_personal:1' then 1 when 'cedula:1' then 2 else 10 end
             else case rq.r_casilla || ':' || rq.r_numero when 'rif_empresa:0' then 1 when 'acta_constitutiva:0' then 2 when 'cedula:1' then 3 when 'rif_personal:1' then 4 else 10 end end ord
      from privado.requeridos(cli) rq) q), '[]'::jsonb);
end $$;

-- Falta de verdad: lo obligatorio que no está o se devolvió (lo opcional de persona natural no cuenta)
create or replace function privado.cambio_faltan(p bigint) returns int language sql stable security definer set search_path to '' as $$
  select count(*)::int from jsonb_array_elements(privado.cambio_requisitos(p)) x where x->>'estado' in ('falta', 'devuelto') and not coalesce((x->>'opcional')::boolean, false)
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
    'fecha_cambio', c.fecha_cambio, 'comision', c.comision, 'comision_motivo', c.comision_motivo, 'comision_por', privado.nombre_de(c.comision_por),
    'instalacion_id', c.instalacion_id, 'pagado_fuera', c.pagado_fuera, 'corte', c.corte,
    'corte_cambio', case when c.fecha_cambio is not null then privado.corte_de((c.fecha_cambio at time zone 'America/Caracas')::date) end,
    'puedo_hecho', c.estado = 'por_emitir' and privado.puede_hecho(c),
    'borrador', c.borrador, 'dueno_id', x.d, 'dueno', coalesce(privado.nombre_de(x.d), c.lider_nombre), 'analista_id', privado.analista_de(x.d),
    'sugerido_id', c.sugerido_id, 'sugerido', privado.nombre_de(c.sugerido_id),
    'natural', coalesce((select k.es_natural from public.clientes k where k.id = case when c.tipo = 'migracion' or c.nuevo_cliente_id is null then c.cliente_id else c.nuevo_cliente_id end), coalesce(c.titular_natural, false)),
    'reporte', (select jsonb_build_object('fecha', a.fecha, 'comentario', a.comentario, 'operador', a.operador) from public.cambios_archivo a where a.id = c.archivo_fila),
    'docs', (select jsonb_build_object('total', count(*), 'aprobados', count(*) filter (where r->>'estado' = 'aprobado'),
               'faltan', count(*) filter (where r->>'estado' in ('falta', 'devuelto') and not coalesce((r->>'opcional')::boolean, false)))
             from jsonb_array_elements(privado.cambio_requisitos(c.id)) r))
  from (select privado.cambio_dueno(c) d) x
$$;

-- Al aprobar: lo obligatorio aprobado; de persona natural, lo que subió aprobado (si no subió nada, la aprueba el administrador a mano)
create or replace function privado.cambio_avanzar(p bigint, autor uuid) returns void language plpgsql security definer set search_path to '' as $$
declare c public.cambios; ev text; rq jsonb;
begin
  select * into c from public.cambios where id = p for update;
  if not found or c.estado <> 'por_revisar' or c.borrador then return; end if;
  rq := privado.cambio_requisitos(p);
  if jsonb_array_length(rq) > 0 and (
       exists (select 1 from jsonb_array_elements(rq) x where not coalesce((x->>'opcional')::boolean, false) and x->>'estado' <> 'aprobado')
    or exists (select 1 from jsonb_array_elements(rq) x where coalesce((x->>'opcional')::boolean, false) and x->>'estado' not in ('aprobado', 'falta'))
    or not exists (select 1 from jsonb_array_elements(rq) x where x->>'estado' = 'aprobado')) then return; end if;
  update public.cambios set estado = 'por_emitir', aprobado_en = now(), aprobado_por = autor, actualizado_en = now() where id = p;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues) values (autor, 'cambio_docs_aprobados', 'cambios', p::text, jsonb_build_object('estado', 'por_emitir'));
  if c.fecha_cambio is not null and c.tipo <> 'titularidad' then
    perform privado.cambio_confirmar(p, c.fecha_cambio, 'archivo', autor);
  elsif c.origen = 'tad' then
    ev := privado.cambio_evaluar(p);
    if ev = 'ok' then perform privado.cambio_confirmar(p, c.creado_en, 'tad', autor); end if;
  end if;
end $$;

create or replace function public.cambio_enviar(p_id bigint) returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_rol text := privado.exigir('admin', 'analista', 'lider'); v_yo uuid := (select auth.uid()); c public.cambios; f int;
begin
  select * into c from public.cambios where id = p_id for update;
  if not found or not privado.cambio_puedo_ver(c) then raise exception 'No encontré ese cambio' using errcode = 'P0001'; end if;
  if not c.borrador then raise exception 'Esa solicitud ya se envió' using errcode = 'P0001'; end if;
  f := privado.cambio_faltan(p_id);
  if f > 0 then raise exception '%', case when f = 1 then 'Falta 1 documento por subir' else 'Faltan ' || f || ' documentos por subir' end using errcode = 'P0001'; end if;
  update public.cambios set borrador = false, actualizado_en = now() where id = p_id;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues) values (v_yo, 'cambio_enviado', 'cambios', p_id::text, jsonb_build_object('borrador', true), jsonb_build_object('estado', c.estado));
  perform privado.cambio_avanzar(p_id, v_yo);
  return (select privado.cambio_json(z) from public.cambios z where z.id = p_id);
end $$;

-- "Pasar al analista" (aprobar a mano): sin nota cuando no falta nada obligatorio (persona natural); si ya estaba hecha, se confirma
select privado.redefinir('public.cambio_accion'::regproc::regprocedure, jsonb_build_array(
  jsonb_build_array('if nota is null then raise exception ''Escribe por qué pasa sin todos los documentos aprobados''',
    'if nota is null and privado.cambio_faltan(p_id) > 0 then raise exception ''Escribe por qué pasa sin todos los documentos aprobados'''),
  jsonb_build_array('update public.cambios set estado = ''por_emitir'', aprobado_en = now(), aprobado_por = v_yo, actualizado_en = now() where id = p_id; nuevo := ''por_emitir'';',
    'update public.cambios set estado = ''por_emitir'', aprobado_en = now(), aprobado_por = v_yo, actualizado_en = now() where id = p_id; nuevo := ''por_emitir'';
    if c.fecha_cambio is not null and c.tipo <> ''titularidad'' then perform privado.cambio_confirmar(p_id, c.fecha_cambio, ''archivo'', v_yo); nuevo := ''confirmado''; end if;')));

-- Decidir a mano: al confirmarse una migración queda "Comisión por decidir"; solo el Sí crea la instalación del corte
create or replace function privado.cambio_confirmar(p bigint, p_fecha timestamptz, p_como text, autor uuid) returns void language plpgsql security definer set search_path to '' as $$
declare c public.cambios; v_com text;
begin
  select * into c from public.cambios where id = p for update;
  if not found or c.estado in ('confirmado', 'cancelado', 'error', 'revertido') then return; end if;
  v_com := case when c.tipo in ('migracion', 'ambos') and c.lider_id is not null and (coalesce(p_fecha, now()) at time zone 'America/Caracas')::date >= privado.cambios_desde() then 'por_decidir' else 'no' end;
  update public.cambios set estado = 'confirmado', confirmado_en = coalesce(p_fecha, now()), confirmado_como = p_como, fecha_cambio = coalesce(fecha_cambio, p_fecha, now()),
    aviso = null, comision = v_com, actualizado_en = now() where id = p;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues)
  values (autor, 'cambio_confirmado', 'cambios', p::text, jsonb_build_object('estado', c.estado), jsonb_build_object('como', p_como, 'fecha', coalesce(p_fecha, now()), 'comision', v_com));
end $$;

create or replace function public.cambio_comision(p_id bigint, p_si boolean, p_motivo text) returns void language plpgsql security definer set search_path to '' as $$
declare v_rol text := privado.exigir('admin', 'analista'); v_yo uuid := (select auth.uid()); c public.cambios; mot text := left(nullif(btrim(coalesce(p_motivo, '')), ''), 500); inst public.instalaciones;
begin
  if v_rol <> 'admin' and not privado.es_senior() then raise exception 'La deciden el administrador o la Senior' using errcode = 'P0001'; end if;
  select * into c from public.cambios where id = p_id for update;
  if not found then raise exception 'No encontré ese cambio' using errcode = 'P0001'; end if;
  if c.origen = 'historico' then raise exception 'El histórico no se toca' using errcode = 'P0001'; end if;
  if c.estado <> 'confirmado' or c.tipo not in ('migracion', 'ambos') then raise exception 'Solo se decide una migración confirmada' using errcode = 'P0001'; end if;
  if mot is null or length(mot) < 4 then raise exception 'Escribe el motivo' using errcode = 'P0001'; end if;
  if p_si then
    update public.cambios set comision = 'si', comision_motivo = mot, comision_por = v_yo, comision_en = now(), actualizado_en = now() where id = p_id;
    perform privado.cambio_instalar(p_id);
  else
    select * into inst from public.instalaciones where id = c.instalacion_id;
    if inst.id is not null and inst.anulada_en is null and exists (select 1 from public.cortes_certificados k where k.anulado_en is null
         and k.corte = privado.corte_de((inst.instalada_en at time zone 'America/Caracas')::date)) then
      raise exception 'Ese corte ya está certificado: la comisión no se puede quitar' using errcode = 'P0001'; end if;
    update public.cambios set comision = 'no', comision_motivo = mot, comision_por = v_yo, comision_en = now(), actualizado_en = now() where id = p_id;
    if inst.id is not null then update public.instalaciones set anulada_en = now() where id = inst.id and anulada_en is null; end if;
  end if;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues)
  values (v_yo, 'cambio_comision', 'cambios', p_id::text, jsonb_build_object('comision', c.comision), jsonb_build_object('comision', case when p_si then 'si' else 'no' end, 'motivo', mot));
end $$;

-- Reporte "Consulta Cambio de Categoría": solo cambios de categoría reales (residencial a PYME y PYME a residencial).
-- Se ignoran sin guardarlos: activaciones por RADIUS y lo que después pasó a PYME en un servicio activado así, PYME a PYME,
-- DEDICADO, EXONERADO, USO INTERNO, EMPLEADO y RECONEXION. Un servicio cuenta una vez, con un solo líder.
create or replace function public.cambios_archivo_cargar(p_archivo text, p_filas jsonb) returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_yo uuid := privado.exigir_carga(); k bigint; x jsonb; cod text; f date; ant text; act text; op text; com text; fid bigint; a_pyme boolean; activ boolean;
  n_pyme int := 0; n_res int := 0; n_desc int := 0; n_rep int := 0; n_sin int := 0; n_reg int := 0; n_nuevas int := 0; n_radius int := 0; n_amb int := 0; n_limp int := 0; tot int := 0; v_hasta date;
  z public.cambios; i record; nc int; ts timestamptz; cli bigint; lid uuid; sug uuid; nid bigint; res jsonb;
begin
  if jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) > 20000 then raise exception 'El archivo no se pudo leer' using errcode = 'P0001'; end if;
  insert into privado.cambios_cargas (archivo, por) values (left(p_archivo, 200), v_yo) returning id into k;
  -- 1. Las activaciones por RADIUS del archivo quedan anotadas (solo código y fecha)
  for x in select * from jsonb_array_elements(p_filas) loop
    cod := ltrim(btrim(coalesce(x->>'codigo', '')), '0'); ant := upper(btrim(coalesce(x->>'anterior', ''))); op := btrim(coalesce(x->>'operador', '')); com := btrim(coalesce(x->>'comentario', ''));
    f := privado.fecha_reporte(x->>'fecha');
    if cod <> '' and f is not null and (ant ~ '^0*(56|58|2)$' or (com ~* 'change profile from radius') or (op ~* 'radius' and ant ~ '^\s*\d+\s*$')) then
      insert into privado.cambios_activaciones (codigo, fecha, carga) values (cod, f, k) on conflict do nothing;
    end if;
  end loop;
  -- 2. Los cambios
  for x in select * from jsonb_array_elements(p_filas) loop
    tot := tot + 1;
    cod := ltrim(btrim(coalesce(x->>'codigo', '')), '0'); ant := upper(btrim(coalesce(x->>'anterior', ''))); act := upper(btrim(coalesce(x->>'actual', '')));
    op := btrim(coalesce(x->>'operador', '')); com := btrim(coalesce(x->>'comentario', '')); f := privado.fecha_reporte(x->>'fecha');
    if cod = '' or f is null or ant ~ '^0*(56|58|2)$' or com ~* 'change profile from radius' or (op ~* 'radius' and ant ~ '^\s*\d+\s*$')
       or privado.norm(ant || ' ' || act) ~ '(dedicado|exonerado|uso interno|empleado|reconexion|reactivacion)'
       or privado.es_pyme(ant) = privado.es_pyme(act) then
      n_desc := n_desc + 1; continue;
    end if;
    a_pyme := privado.es_pyme(act);
    -- Un servicio que nació por RADIUS no es migración: es una instalación nueva
    activ := exists (select 1 from privado.cambios_activaciones a where a.codigo = cod and a.fecha <= f);
    if activ then n_radius := n_radius + 1; continue; end if;
    if exists (select 1 from public.cambios_archivo a where a.codigo = cod and a.fecha = f) then n_rep := n_rep + 1; continue; end if;
    insert into public.cambios_archivo (carga, codigo, nombre, fecha, cat_anterior, cat_actual, operador, comentario)
    values (k, cod, left(x->>'nombre', 200), f, ant, act, left(op, 120), left(com, 500)) returning id into fid;
    if a_pyme then n_pyme := n_pyme + 1; else n_res := n_res + 1; end if;
    if v_hasta is null or f > v_hasta then v_hasta := f; end if;
    ts := (f::timestamp at time zone 'America/Caracas') + interval '12 hours';
    -- Ya hay un cambio de ese servicio (el registrado primero): uno solo por servicio
    select * into z from public.cambios c where c.estado not in ('cancelado', 'error', 'revertido') and c.origen <> 'historico' and c.tipo <> 'titularidad'
      and (c.tipo = 'residencial') = (not a_pyme)
      and exists (select 1 from jsonb_array_elements(c.servicios) s where ltrim(s->>'codigo', '0') = cod)
      and (c.archivo_fila is null or c.estado <> 'confirmado')
    order by (c.estado = 'sin_registro'), c.creado_en desc limit 1;
    if found then
      if z.estado = 'sin_registro' then
        lid := privado.cambio_dueno(z); sug := case when lid is null then privado.lider_en_texto(com) end;
        update public.cambios set fecha_cambio = coalesce(least(fecha_cambio, ts), ts), archivo_fila = coalesce(archivo_fila, fid), corte = privado.corte_de(f),
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
    if f < privado.cambios_desde() then continue; end if;
    -- El reporte no trae la sucursal: el servicio es el que en el TAD ya tiene la categoría nueva (y el nombre que coincide). Si no se sabe cuál, no se registra.
    select count(*) into nc from public.tad_indice t where ltrim(t.codigo, '0') = cod and privado.es_pyme(t.categoria) = a_pyme;
    if nc > 1 then
      select count(*) into nc from public.tad_indice t where ltrim(t.codigo, '0') = cod and privado.es_pyme(t.categoria) = a_pyme and t.nombre_norm = privado.norm(x->>'nombre');
    end if;
    if nc <> 1 then n_amb := n_amb + 1; continue; end if;
    select t.clave, t.sucursal, t.codigo, t.equipo, t.pon, t.plan, t.categoria, t.direccion, t.estado, t.doc_tipo, t.doc_numero, t.nombre into i
    from public.tad_indice t where ltrim(t.codigo, '0') = cod and privado.es_pyme(t.categoria) = a_pyme
    order by (t.nombre_norm = privado.norm(x->>'nombre')) desc nulls last limit 1;
    cli := (select c2.id from public.clientes c2 where c2.unido_a is null and privado.mismo_doc(ltrim(c2.doc_numero, '0'), ltrim(i.doc_numero, '0')) order by c2.id limit 1);
    lid := (select c2.lider_id from public.clientes c2 where c2.id = cli);
    sug := case when lid is null then privado.lider_en_texto(com) end;
    insert into public.cambios (tipo, origen, estado, cliente_id, titular_tipo, titular_doc, titular_nombre, titular_natural, categoria_anterior, categoria_nueva, plan_anterior,
      servicios, archivo_fila, fecha_cambio, corte, lider_id, lider_nombre, sugerido_id)
    values (case when a_pyme then 'migracion' else 'residencial' end, 'archivo', 'sin_registro', cli, i.doc_tipo, ltrim(i.doc_numero, '0'), coalesce(i.nombre, left(x->>'nombre', 200)),
      coalesce(i.doc_tipo, 'J') in ('V', 'E'), ant, act, i.plan,
      jsonb_build_array(jsonb_build_object('clave', i.clave, 'sucursal', i.sucursal, 'codigo', i.codigo, 'equipo', i.equipo, 'pon', i.pon, 'plan', i.plan, 'categoria', i.categoria, 'direccion', i.direccion, 'estado', i.estado)),
      fid, ts, privado.corte_de(f), lid, privado.nombre_de(lid), sug)
    returning id into nid;
    insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues) values (v_yo, 'cambio_sin_registro', 'cambios', nid::text, jsonb_build_object('fecha', f, 'anterior', ant, 'actual', act, 'carga', k));
    if a_pyme then n_sin := n_sin + 1; end if;
    n_nuevas := n_nuevas + 1;
  end loop;
  -- 3. Lo que ya estaba "sin registrar" de un servicio activado por RADIUS deja de serlo
  n_limp := privado.cambios_limpiar(v_yo);
  -- 4. Las sin registrar sin líder toman el del cliente
  update public.cambios w set lider_id = c2.lider_id, lider_nombre = privado.nombre_de(c2.lider_id), actualizado_en = now()
  from public.clientes c2 where w.estado = 'sin_registro' and w.lider_id is null and c2.id = w.cliente_id and c2.lider_id is not null;
  res := jsonb_build_object('filas', tot, 'a_pyme', n_pyme, 'sin_registrar', n_sin, 'residencial', n_res, 'descartadas', n_desc + n_radius, 'radius', n_radius, 'repetidas', n_rep,
    'registradas', n_reg, 'nuevas', n_nuevas, 'sin_identificar', n_amb, 'limpiadas', n_limp, 'hasta', v_hasta, 'con_fecha', n_reg, 'ignoradas', n_desc + n_radius + n_rep);
  update privado.cambios_cargas set filas = n_pyme + n_res, ignoradas = n_desc + n_radius + n_rep, confirmados = n_reg, sin_solicitud = n_nuevas, sin_identificar = n_amb, hasta = v_hasta, resumen = res where id = k;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues) values (v_yo, 'cambios_archivo', 'cambios_archivo', k::text, res);
  return res;
end $$;

create or replace function privado.fecha_reporte(t text) returns date language sql immutable set search_path to '' as $$
  select case when t ~ '^\d{1,2}[-/]\d{1,2}[-/]\d{4}' then to_date(replace(substring(t from '^\d{1,2}[-/]\d{1,2}[-/]\d{4}'), '/', '-'), 'DD-MM-YYYY')
              when t ~ '^\d{4}-\d\d-\d\d' then (left(t, 10))::date end
$$;

-- Descarta las "sin registrar" que no son un cambio de categoría real (misma categoría de lado y lado, dedicados, exonerados...)
-- o de un servicio activado por RADIUS. Quedan en "Fue un error" con su motivo y bitácora. Los cambios de titular no se tocan.
create or replace function privado.cambios_limpiar(autor uuid) returns int language plpgsql security definer set search_path to '' as $$
declare c record; n int := 0; mot text;
begin
  for c in select z.id, z.categoria_anterior, z.categoria_nueva, z.servicios, z.tipo from public.cambios z where z.estado = 'sin_registro' and z.tipo in ('migracion', 'residencial', 'ambos') loop
    mot := case
      when exists (select 1 from jsonb_array_elements(c.servicios) s join privado.cambios_activaciones a on a.codigo = ltrim(s->>'codigo', '0'))
        then 'Servicio activado por RADIUS: es una instalación nueva, no una migración'
      when c.tipo <> 'ambos' and (privado.norm(coalesce(c.categoria_anterior, '') || ' ' || coalesce(c.categoria_nueva, '')) ~ '(dedicado|exonerado|uso interno|empleado|reconexion|reactivacion)'
        or privado.es_pyme(c.categoria_anterior) = privado.es_pyme(c.categoria_nueva))
        then 'No es un cambio de categoría real (' || coalesce(c.categoria_anterior, '?') || ' a ' || coalesce(c.categoria_nueva, '?') || ')' end;
    if mot is null then continue; end if;
    update public.cambios set estado = 'error', cerrado_en = now(), cerrado_por = autor, cierre_nota = mot, actualizado_en = now() where id = c.id;
    insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues) values (autor, 'cambio_descartado', 'cambios', c.id::text, jsonb_build_object('estado', 'sin_registro'), jsonb_build_object('estado', 'error', 'motivo', mot));
    n := n + 1;
  end loop;
  return n;
end $$;

-- La detección del TAD aplica el mismo filtro
select privado.redefinir('public.tad_indice_cerrar'::regproc::regprocedure, jsonb_build_array(jsonb_build_array(
  '    if tp is null then continue; end if;',
  '    if tp is null then continue; end if;
    if tp in (''migracion'', ''residencial'') and (privado.es_pyme(d.cat_anterior) = privado.es_pyme(d.cat_actual)
       or privado.norm(coalesce(d.cat_anterior, '''') || '' '' || coalesce(d.cat_actual, '''')) ~ ''(dedicado|exonerado|uso interno|empleado|reconexion|reactivacion)''
       or exists (select 1 from privado.cambios_activaciones a where a.codigo = ltrim(split_part(d.clave, ''-'', 2), ''0''))) then continue; end if;')));

-- Bloques de Comisiones: + "Meses anteriores · faltan documentos" (Devuelto / Cobró con excepción), persona natural y faltan de verdad
create or replace function public.comisiones_bloques() returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare v_rol text := privado.exigir('admin', 'analista', 'lider', 'abogado'); v_yo uuid := (select auth.uid()); v_mis text[]; actual date := privado.corte_en_curso();
begin
  select array_remove(array[privado.norm(p.nombre), privado.norm(p.nombre_odoo)], '') into v_mis from public.perfiles p where p.id = v_yo;
  return jsonb_build_object('corte', actual, 'ahora', now(),
    'ordenes', coalesce((select jsonb_agg(jsonb_build_object('orden_id', f.orden_id, 'numero', f.numero, 'creada_en', f.creada_en, 'inicio', coalesce(f.inicio, f.creada_en),
        'cliente_id', f.cliente_id, 'cliente', f.cliente, 'provisional', f.provisional, 'lider', f.lider, 'lider_id', f.lider_id,
        'equipo', (select coalesce(p.equipo_com, 'corporativas') from public.perfiles p where p.id = f.lider_id),
        'natural', (select k.es_natural from public.clientes k where k.id = f.cliente_id),
        'rif', (select k.doc_tipo || '-' || k.doc_numero from public.clientes k where k.id = f.cliente_id and not coalesce(k.provisional, false)),
        'docs', privado.docs_estado(f.cliente_id)) order by coalesce(f.inicio, f.creada_en))
      from privado.ordenes_abiertas() f
      where coalesce(f.inicio, f.creada_en) > now() - interval '5 days'
        and (v_rol <> 'lider' or f.lider_id = v_yo or f.vendedor_id = v_yo or privado.norm(f.lider) = any (v_mis)
             or (f.lider is null and not f.de_otro and privado.norm(f.creador) = any (v_mis)))), '[]'::jsonb),
    'migraciones', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'estado', c.estado, 'borrador', c.borrador, 'tipo', c.tipo, 'comision', c.comision,
        'fecha', coalesce(c.fecha_cambio, c.creado_en), 'titular', c.titular_nombre, 'doc_tipo', c.titular_tipo, 'doc', c.titular_doc, 'servicios', c.servicios,
        'categoria_anterior', c.categoria_anterior, 'categoria_nueva', c.categoria_nueva, 'cliente_id', coalesce(c.nuevo_cliente_id, c.cliente_id), 'instalacion_id', c.instalacion_id,
        'reporte', (select jsonb_build_object('fecha', a.fecha, 'comentario', a.comentario) from public.cambios_archivo a where a.id = c.archivo_fila),
        'lider', privado.nombre_de(privado.cambio_dueno(c)), 'lider_id', privado.cambio_dueno(c),
        'equipo', (select coalesce(p.equipo_com, 'corporativas') from public.perfiles p where p.id = privado.cambio_dueno(c)),
        'natural', coalesce((select k.es_natural from public.clientes k where k.id = coalesce(c.nuevo_cliente_id, c.cliente_id)), coalesce(c.titular_natural, false)),
        'faltan', privado.cambio_faltan(c.id)) order by coalesce(c.fecha_cambio, c.creado_en))
      from public.cambios c
      where c.tipo in ('migracion', 'ambos') and c.origen <> 'historico'
        and (c.estado in ('sin_registro', 'por_revisar', 'por_emitir', 'por_confirmar')
             or (c.estado = 'confirmado' and c.instalacion_id is null and c.fecha_cambio is not null and privado.corte_de((c.fecha_cambio at time zone 'America/Caracas')::date) = actual))
        and (v_rol <> 'lider' or privado.cambio_dueno(c) = v_yo or c.creado_por = v_yo)), '[]'::jsonb),
    -- Meses anteriores · faltan documentos: cobró en un corte certificado y hoy no tiene el legal. No suma ni resta comisión.
    'devueltos', coalesce((select jsonb_agg(jsonb_build_object('cliente_id', z.cid, 'nombre', z.nom, 'doc', z.doc, 'corte', z.corte, 'instalada_en', z.e->>'instalada_en',
        'codigo', z.e->>'codigo', 'sucursal', z.e->>'sucursal', 'lider', coalesce(privado.nombre_de(z.lid), z.e->>'lider'), 'lider_id', z.lid,
        'equipo', (select coalesce(p.equipo_com, 'corporativas') from public.perfiles p where p.id = z.lid), 'etiqueta', z.etq) order by z.corte, z.nom)
      from (select distinct on (c.id) c.id cid, c.nombre nom, c.doc_tipo || '-' || c.doc_numero doc, cc.corte, e, coalesce((e->>'lider_id')::uuid, c.lider_id) lid,
              case when coalesce((e->>'legal_ok')::boolean, false) then 'devuelto' else 'excepcion' end etq
            from public.cortes_certificados cc cross join lateral jsonb_array_elements(cc.filas) e join public.clientes c on c.id = (e->>'cliente_id')::bigint
            where cc.anulado_en is null and coalesce((e->>'cumple')::boolean, false) and c.legal_ok_en is null and c.unido_a is null
              and (coalesce((e->>'legal_ok')::boolean, false) or (coalesce((e->>'excepcion')::boolean, false) and c.legal_ok_antes is null))
            order by c.id, cc.corte desc) z
      where v_rol <> 'lider' or z.lid = v_yo), '[]'::jsonb));
end $$;

-- Duplicados: al crear un cliente, ¿ya existe uno con el nombre casi igual? Al aliado no se le dice cuál (queda marcado para el administrador)
create or replace function public.clientes_parecidos(p_nombre text, p_doc text default null, p_sol bigint default null) returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_rol text := privado.exigir('admin', 'analista', 'lider', 'abogado', 'aliado'); n text := privado.limpia_nombre(p_nombre); d text := ltrim(regexp_replace(coalesce(p_doc, ''), '\D', '', 'g'), '0');
  l jsonb;
begin
  if length(n) < 4 then return jsonb_build_object('posible', false, 'clientes', '[]'::jsonb); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'doc', c.doc_tipo || '-' || c.doc_numero, 'ver', privado.puede_cliente(c.id))), '[]'::jsonb) into l
  from (select * from public.clientes c where c.unido_a is null and not coalesce(c.provisional, false) and privado.limpia_nombre(c.nombre) = n
          and (d = '' or not privado.mismo_doc(ltrim(c.doc_numero, '0'), d)) order by c.id limit 3) c;
  if v_rol = 'aliado' then
    if jsonb_array_length(l) > 0 and p_sol is not null then
      insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues) values ((select auth.uid()), 'posible_duplicado', 'aliado_solicitudes', p_sol::text, jsonb_build_object('nombre', p_nombre, 'clientes', l));
    end if;
    return jsonb_build_object('posible', jsonb_array_length(l) > 0);
  end if;
  -- Del cliente que no puede ver, solo que existe (sin nombre ni RIF)
  return jsonb_build_object('posible', jsonb_array_length(l) > 0, 'clientes', (select coalesce(jsonb_agg(case when (x->>'ver')::boolean then x else jsonb_build_object('ver', false) end), '[]'::jsonb) from jsonb_array_elements(l) x));
end $$;
grant execute on function public.clientes_parecidos(text, text, bigint) to authenticated;

select privado.redefinir('public.aliados_registro'::regproc::regprocedure, jsonb_build_array(jsonb_build_array(
  E'''revisado_nota'', s.revisado_nota,\n        ''carterizado'',',
  E'''revisado_nota'', s.revisado_nota,\n        ''duplicado'', exists (select 1 from public.bitacora b where b.accion = ''posible_duplicado'' and b.tabla = ''aliado_solicitudes'' and b.registro_id = s.id::text),\n        ''carterizado'',')));

-- Una sola vez: las sin registrar viejas que no son un cambio de categoría real
select privado.cambios_limpiar(null) as descartadas;
