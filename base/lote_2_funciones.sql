-- Lote 2: reglas del servidor para clientes, documentos, hilo y comisiones.
-- Todo lo que escribe pasa por estas funciones: revisan el rol, dejan hilo y bitácora.

-- ---------- Ayudas ----------
create or replace function privado.norm(t text) returns text
language sql immutable set search_path to '' as $$
  select btrim(regexp_replace(translate(lower(coalesce(t, '')), 'áéíóúüñàèìòùäëïö', 'aeiouunaeiouaeio'), '\s+', ' ', 'g'))
$$;

create or replace function privado.hoy() returns date
language sql stable set search_path to '' as $$ select (now() at time zone 'America/Caracas')::date $$;

-- El corte de un mes va del 21 del mes anterior al 20 de ese mes. La etiqueta es el día 1 del mes.
create or replace function privado.corte_de(d date) returns date
language sql immutable set search_path to '' as $$
  select (date_trunc('month', d::timestamp) + case when extract(day from d) >= 21 then interval '1 month' else interval '0' end)::date
$$;
create or replace function privado.corte_inicio(c date) returns date
language sql immutable set search_path to '' as $$ select ((c - interval '1 month')::date + 20) $$;
create or replace function privado.corte_fin(c date) returns date
language sql immutable set search_path to '' as $$ select (c + 19) $$;
-- Primer instante después del cierre (hora de Caracas)
create or replace function privado.corte_cierre(c date) returns timestamptz
language sql stable set search_path to '' as $$ select ((c + 20)::timestamp at time zone 'America/Caracas') $$;

-- Qué estatus cuentan como legal cumplido para la comisión. Es el único lugar donde se decide.
create or replace function privado.legal_cumple(e text) returns boolean
language sql immutable set search_path to '' as $$
  select e in ('documentos_recibidos', 'contrato_en_curso', 'por_firmar', 'contrato_firmado')
$$;

create or replace function privado.comisionable(categoria text, es_aliado boolean) returns boolean
language sql immutable set search_path to '' as $$
  select not coalesce(es_aliado, false) and privado.norm(categoria) !~ '(dedicad|conectiv)'
$$;

create or replace function privado.exigir(variadic roles text[]) returns text
language plpgsql stable security definer set search_path to '' as $$
declare r text := privado.rol_actual();
begin
  if r is null then raise exception 'Tu sesión venció. Entra de nuevo' using errcode = 'P0001'; end if;
  if not (r = any (roles)) then raise exception 'No tienes permiso para hacer esto' using errcode = 'P0001'; end if;
  return r;
end $$;

create or replace function privado.exigir_cliente(p bigint) returns text
language plpgsql stable security definer set search_path to '' as $$
declare r text := privado.rol_actual();
begin
  if r is null then raise exception 'Tu sesión venció. Entra de nuevo' using errcode = 'P0001'; end if;
  if p is null or not privado.puede_cliente(p) then raise exception 'No tienes acceso a este cliente' using errcode = 'P0001'; end if;
  return r;
end $$;

create or replace function privado.segmento(p bigint) returns text
language sql stable security definer set search_path to '' as $$
  select case
    when x.ded and x.pyme then 'PYME + Dedicado'
    when x.ded then case when c.es_isp then 'Dedicado ISP' else 'Dedicado corporativo' end
    when c.es_natural then 'Natural'
    else 'PYME' end
  from public.clientes c
  cross join lateral (select
    coalesce(bool_or(privado.norm(s.categoria) ~ '(dedicad|conectiv)'), false) as ded,
    coalesce(bool_or(privado.norm(s.categoria) !~ '(dedicad|conectiv)'), false) as pyme
    from public.servicios s where s.cliente_id = c.id) x
  where c.id = p
$$;

-- ---------- Requisitos del expediente ----------
create or replace function privado.requeridos(p bigint) returns table (r_casilla text, r_numero int, r_texto text)
language plpgsql stable security definer set search_path to '' as $$
declare c public.clientes; n int; i int; suf text;
begin
  select * into c from public.clientes where id = p;
  if not found then return; end if;
  n := case when not c.es_natural and c.regimen_firma = 'conjunta' then 2 else 1 end;
  for i in 1..n loop
    suf := case when n > 1 then ' del representante ' || i else '' end;
    r_casilla := 'cedula'; r_numero := i; r_texto := 'cédula' || suf; return next;
    r_casilla := 'rif_personal'; r_numero := i; r_texto := 'RIF personal' || suf; return next;
  end loop;
  if not c.es_natural then
    r_casilla := 'rif_empresa'; r_numero := 0; r_texto := 'RIF de la empresa'; return next;
    r_casilla := 'acta_constitutiva'; r_numero := 0; r_texto := 'acta constitutiva'; return next;
    if c.es_isp then r_casilla := 'conatel'; r_numero := 0; r_texto := 'permiso de Conatel'; return next; end if;
  end if;
end $$;

-- Lo que falta o fue devuelto. e = 'falta' | 'devuelto'. dato = true cuando no es un documento.
create or replace function privado.faltantes(p bigint) returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare c public.clientes; r jsonb := '[]'::jsonb; q record; rp public.representantes;
begin
  select * into c from public.clientes where id = p;
  if not found then return r; end if;
  for q in
    select rq.r_casilla, rq.r_numero, rq.r_texto, d.estado, d.motivo
    from privado.requeridos(p) rq
    left join public.documentos d on d.cliente_id = p and d.casilla = rq.r_casilla and d.numero = rq.r_numero
  loop
    if q.estado is null then
      r := r || jsonb_build_array(jsonb_build_object('k', q.r_casilla, 'n', q.r_numero, 't', q.r_texto, 'e', 'falta'));
    elsif q.estado = 'devuelto' then
      r := r || jsonb_build_array(jsonb_build_object('k', q.r_casilla, 'n', q.r_numero, 't', q.r_texto, 'e', 'devuelto', 'm', q.motivo));
    end if;
  end loop;
  select * into rp from public.representantes where cliente_id = p and orden = 1;
  if coalesce(btrim(rp.correo), '') = '' then
    r := r || jsonb_build_array(jsonb_build_object('k', 'correo', 'n', 1, 't', 'correo', 'e', 'falta', 'dato', true));
  end if;
  if coalesce(btrim(rp.telefono), '') = '' then
    r := r || jsonb_build_array(jsonb_build_object('k', 'telefono', 'n', 1, 't', 'número de contacto', 'e', 'falta', 'dato', true));
  end if;
  if not c.es_natural and coalesce(btrim(c.correo_empresa), '') = '' then
    r := r || jsonb_build_array(jsonb_build_object('k', 'correo_empresa', 'n', 0, 't', 'correo de la empresa', 'e', 'falta', 'dato', true));
  end if;
  return r;
end $$;

create or replace function privado.nombre_de(u uuid) returns text
language sql stable security definer set search_path to '' as $$ select nombre from public.perfiles where id = u $$;

create or replace function privado.gestion(p bigint, u uuid) returns void
language sql security definer set search_path to '' as $$
  update public.clientes set ultima_gestion_en = now(), ultima_gestion_por = u, ultima_gestion_nombre = null, actualizado_en = now() where id = p
$$;

create or replace function privado.poner_estatus(p bigint, nuevo text, autor uuid, como text) returns boolean
language plpgsql security definer set search_path to '' as $$
declare ant text;
begin
  select estatus into ant from public.clientes where id = p for update;
  if ant is null or ant = nuevo then return false; end if;
  update public.clientes set estatus = nuevo, estatus_desde = now(), actualizado_en = now(),
    legal_ok_en = case when privado.legal_cumple(nuevo) then coalesce(legal_ok_en, now()) else null end
  where id = p;
  insert into public.hilo (cliente_id, tipo, texto, detalle, autor_id)
  values (p, 'estatus', nuevo, jsonb_build_object('antes', ant, 'como', como), case when como = 'manual' then autor else null end);
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues)
  values (autor, 'cambio_estatus', 'clientes', p::text, jsonb_build_object('estatus', ant), jsonb_build_object('estatus', nuevo, 'como', como));
  return true;
end $$;

-- Estatus que la app mueve sola según los documentos. Los de contrato los mueve Legal.
create or replace function privado.recalcular(p bigint, autor uuid) returns text
language plpgsql security definer set search_path to '' as $$
declare c public.clientes; f jsonb; dev boolean; falta boolean; rev boolean; algo boolean; nuevo text;
begin
  select * into c from public.clientes where id = p for update;
  if not found then return null; end if;
  f := privado.faltantes(p);
  dev := exists (select 1 from jsonb_array_elements(f) x where x ->> 'e' = 'devuelto');
  falta := exists (select 1 from jsonb_array_elements(f) x where x ->> 'e' = 'falta');
  rev := exists (select 1 from privado.requeridos(p) rq join public.documentos d
            on d.cliente_id = p and d.casilla = rq.r_casilla and d.numero = rq.r_numero where d.estado = 'por_revisar');
  algo := exists (select 1 from public.documentos d where d.cliente_id = p);
  nuevo := c.estatus;
  if exists (select 1 from public.documentos d where d.cliente_id = p and d.casilla in ('contrato_pyme', 'contrato_dedicado')
             and d.firmado_en is not null and d.estado <> 'devuelto') then
    nuevo := 'contrato_firmado';
  elsif c.estatus in ('grandes_negocios', 'documentos_pendientes', 'documentos_solicitados', 'documentos_en_revision', 'documentos_recibidos') then
    if dev then nuevo := 'documentos_pendientes';
    elsif not falta then nuevo := case when rev then 'documentos_en_revision' else 'documentos_recibidos' end;
    elsif algo then nuevo := 'documentos_pendientes';
    end if;
  end if;
  perform privado.poner_estatus(p, nuevo, autor, 'auto');
  return nuevo;
end $$;

-- ---------- Comisiones ----------
create or replace function privado.comision_filas(p_corte date)
returns table (instalacion_id bigint, cliente_id bigint, nombre text, doc text, instalada_en timestamptz,
  lider_id uuid, lider text, origen text, legal_ok boolean, pago_ok boolean, cumple boolean,
  estatus text, codigo text, sucursal text, revisar_pago boolean)
language sql stable security definer set search_path to '' as $$
  with lim as (
    select privado.corte_cierre((p_corte - interval '2 month')::date) as ini_ant,
           privado.corte_cierre((p_corte - interval '1 month')::date) as ini,
           privado.corte_cierre(p_corte) as fin
  ), base as (
    select i.id, i.cliente_id as cid, coalesce(c.nombre, i.nombre) as nom,
      case when c.id is not null then c.doc_tipo || '-' || c.doc_numero else i.doc_numero end as docu,
      i.instalada_en as inst, coalesce(i.lider_id, o.vendedor_id, c.lider_id) as lid,
      coalesce(pf.nombre, i.lider_nombre, c.lider_nombre, 'Sin líder') as lnom,
      c.legal_ok_en as leg, i.pago_ok_en as pag, coalesce(c.estatus, 'grandes_negocios') as est,
      i.codigo as cod, i.sucursal as suc, lim.ini, lim.fin,
      (i.pago_ok_en is null and (select count(*) from public.servicios s where s.cliente_id = i.cliente_id) > 1) as rev
    from public.instalaciones i cross join lim
    left join public.clientes c on c.id = i.cliente_id
    left join public.ordenes_odoo o on o.id = i.orden_id
    left join public.perfiles pf on pf.id = coalesce(i.lider_id, o.vendedor_id, c.lider_id)
    where i.instalada_en >= lim.ini_ant and i.instalada_en < lim.fin
      and privado.comisionable(i.categoria, i.es_aliado)
      and (not i.es_evento or coalesce(o.comisiona_evento, false))
  )
  select id, cid, nom, docu, inst, lid, lnom,
    case when inst >= ini then 'corte' else 'anterior' end,
    coalesce(leg < fin, false), coalesce(pag < fin, false), coalesce(leg < fin and pag < fin, false),
    est, cod, suc, rev
  from base
  where inst >= ini or not coalesce(leg < ini and pag < ini, false)
$$;

create or replace function public.comisiones_corte(p_corte date default null) returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare rol text := privado.exigir('admin', 'abogado', 'analista', 'lider'); yo uuid := (select auth.uid());
  hoy date := privado.hoy(); actual date := privado.corte_de(privado.hoy()); c date; filas jsonb; pinst jsonb := '[]'::jsonb; comp jsonb; cl jsonb;
begin
  c := coalesce(date_trunc('month', p_corte::timestamp)::date, actual);
  if c > actual then c := actual; end if;
  select coalesce(jsonb_agg(to_jsonb(f) order by f.lider, f.origen, f.instalada_en), '[]'::jsonb) into filas
  from privado.comision_filas(c) f where rol <> 'lider' or f.lider_id = yo;

  if c = actual then
    select coalesce(jsonb_agg(jsonb_build_object('orden', o.numero, 'cliente_id', o.cliente_id,
        'nombre', coalesce(cl2.nombre, nullif(o.cliente_nombre, ''), o.titulo), 'creada_en', o.creada_en, 'etapa', o.etapa,
        'lider', coalesce(pf.nombre, cl2.lider_nombre, nullif(o.creador_nombre, ''), 'Sin líder')) order by o.creada_en), '[]'::jsonb)
    into pinst
    from public.ordenes_odoo o
    left join public.clientes cl2 on cl2.id = o.cliente_id
    left join public.perfiles pf on pf.id = coalesce(o.vendedor_id, cl2.lider_id)
    where o.tipo = 'pyme' and o.creada_en > now() - interval '90 days'
      and privado.norm(o.etapa) !~ '(cancel|realiz)'
      and not exists (select 1 from public.instalaciones i where i.orden_id = o.id)
      and not exists (select 1 from public.ordenes_odoo o2 where o2.orden_anterior_id = o.id)
      and (rol <> 'lider' or o.vendedor_id = yo or o.creador_id = yo or cl2.lider_id = yo);
  end if;

  select jsonb_agg(jsonb_build_object('corte', g.k, 'total', t.total, 'cumplen', t.cumplen) order by g.k) into comp
  from (select (actual - (n || ' month')::interval)::date as k from generate_series(0, 5) n) g
  cross join lateral (
    select count(*) filter (where f.origen = 'corte') as total, count(*) filter (where f.cumple) as cumplen
    from privado.comision_filas(g.k) f where rol <> 'lider' or f.lider_id = yo) t;

  select coalesce(jsonb_agg(jsonb_build_object('lider', z.lider, 'actual', z.a, 'anterior', z.b) order by z.a desc, z.lider), '[]'::jsonb) into cl
  from (
    select coalesce(x.lider, y.lider) as lider, coalesce(x.n, 0) as a, coalesce(y.n, 0) as b
    from (select f.lider, count(*) n from privado.comision_filas(c) f where f.origen = 'corte' and (rol <> 'lider' or f.lider_id = yo) group by 1) x
    full join (select f.lider, count(*) n from privado.comision_filas((c - interval '1 month')::date) f where f.origen = 'corte' and (rol <> 'lider' or f.lider_id = yo) group by 1) y
      on y.lider = x.lider
  ) z;

  return jsonb_build_object(
    'corte', c, 'actual', actual, 'hoy', hoy, 'inicio', privado.corte_inicio(c), 'fin', privado.corte_fin(c),
    'dias', privado.corte_fin(c) - hoy, 'rol', rol,
    'filas', filas, 'por_instalar', pinst, 'comparativa', coalesce(comp, '[]'::jsonb), 'lideres', cl);
end $$;

-- ---------- Inicio ----------
create or replace function public.inicio_datos() returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare rol text := privado.exigir('admin', 'abogado', 'analista', 'lider', 'aliado'); yo uuid := (select auth.uid());
  hoy date := privado.hoy(); actual date := privado.corte_de(privado.hoy()); com jsonb; cli jsonb; tad timestamptz; usuarios int;
begin
  if rol = 'aliado' then return jsonb_build_object('rol', rol, 'hoy', hoy); end if;
  select jsonb_build_object('total', count(*), 'cumplen', count(*) filter (where f.cumple),
    'ultimo', count(*) filter (where f.origen = 'anterior' and not f.cumple)) into com
  from privado.comision_filas(actual) f where rol <> 'lider' or f.lider_id = yo;

  select jsonb_build_object(
    'en_curso', count(*) filter (where v.estatus <> 'contrato_firmado' and not v.pinst),
    'por_revisar', count(*) filter (where v.estatus = 'documentos_en_revision'),
    'por_revisar_dias', coalesce(max(hoy - (v.estatus_desde at time zone 'America/Caracas')::date) filter (where v.estatus = 'documentos_en_revision'), 0),
    'devueltos', count(*) filter (where v.dev),
    'sin_gestion', count(*) filter (where v.estatus in ('grandes_negocios', 'documentos_solicitados', 'documentos_pendientes') and not v.pinst
        and coalesce(v.ultima_gestion_en, v.creado_en) < now() - interval '3 days'),
    'por_firmar', count(*) filter (where v.estatus in ('contrato_en_curso', 'por_firmar')),
    'por_instalar', count(*) filter (where v.pinst)) into cli
  from (
    select c.*, (not exists (select 1 from public.servicios s where s.cliente_id = c.id)
                 and not exists (select 1 from public.instalaciones i where i.cliente_id = c.id)) as pinst,
      exists (select 1 from public.documentos d where d.cliente_id = c.id and d.estado = 'devuelto') as dev
    from public.clientes c
    where rol in ('admin', 'abogado', 'analista') or (rol = 'lider' and c.lider_id = yo)
  ) v;

  if rol in ('admin', 'analista') then
    select max(g.subido_en) into tad from public.cargas g where g.fuente = 'tad' and g.estado = 'lista';
  end if;
  if rol = 'admin' then select count(*) into usuarios from public.perfiles where activo; end if;

  return jsonb_build_object('rol', rol, 'hoy', hoy,
    'corte', jsonb_build_object('etiqueta', actual, 'inicio', privado.corte_inicio(actual), 'fin', privado.corte_fin(actual),
       'dias', privado.corte_fin(actual) - hoy,
       'avance', round(100.0 * (hoy - privado.corte_inicio(actual) + 1) / (privado.corte_fin(actual) - privado.corte_inicio(actual) + 1))),
    'comision', com, 'clientes', cli, 'tad_en', tad,
    'tad_dias', case when tad is null then null else hoy - (tad at time zone 'America/Caracas')::date end,
    'usuarios', usuarios,
    'hay_demo', exists (select 1 from public.clientes where es_demo));
end $$;

-- ---------- Clientes: lista ----------
create or replace function public.clientes_lista(p_filtro text default 'en_curso', p_busca text default '', p_limite int default 20, p_desde int default 0)
returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare rol text := privado.exigir('admin', 'abogado', 'analista', 'lider'); yo uuid := (select auth.uid());
  b text := replace(replace(privado.norm(p_busca), '%', ''), '_', ' ');
  bd text := regexp_replace(coalesce(p_busca, ''), '\D', '', 'g');
  actual date := privado.corte_de(privado.hoy());
  ini timestamptz := privado.corte_cierre((privado.corte_de(privado.hoy()) - interval '1 month')::date);
  ini_ant timestamptz := privado.corte_cierre((privado.corte_de(privado.hoy()) - interval '2 month')::date);
  lim int := least(greatest(coalesce(p_limite, 20), 1), 60); des int := greatest(coalesce(p_desde, 0), 0); r jsonb;
begin
  if length(bd) < 4 then bd := ''; end if;
  with vis as (
    select c.*,
      (not exists (select 1 from public.servicios s where s.cliente_id = c.id)
       and not exists (select 1 from public.instalaciones i where i.cliente_id = c.id)) as pinst,
      exists (select 1 from public.instalaciones i where i.cliente_id = c.id and privado.comisionable(i.categoria, i.es_aliado)
              and i.instalada_en >= ini_ant and i.instalada_en < ini and (c.legal_ok_en is null or i.pago_ok_en is null)) as ultimo
    from public.clientes c
    where rol in ('admin', 'abogado', 'analista') or (rol = 'lider' and c.lider_id = yo)
  ), sel as (
    select v.* from vis v
    where case when b <> '' or bd <> '' then
        (b <> '' and privado.norm(v.nombre) like '%' || b || '%')
        or (bd <> '' and (v.doc_numero like '%' || bd || '%'
            or exists (select 1 from public.servicios s where s.cliente_id = v.id
                 and (regexp_replace(s.codigo, '\D', '', 'g') like '%' || bd || '%' or regexp_replace(coalesce(s.telefono, ''), '\D', '', 'g') like '%' || bd || '%'))
            or exists (select 1 from public.representantes rp where rp.cliente_id = v.id and regexp_replace(coalesce(rp.telefono, ''), '\D', '', 'g') like '%' || bd || '%')
            or regexp_replace(coalesce(v.telefono, ''), '\D', '', 'g') like '%' || bd || '%'))
      else case coalesce(p_filtro, 'en_curso')
        when 'en_curso' then v.estatus <> 'contrato_firmado' and not v.pinst
        when 'por_revisar' then v.estatus = 'documentos_en_revision'
        when 'por_instalar' then v.pinst
        when 'sin_gestion' then v.estatus in ('grandes_negocios', 'documentos_solicitados', 'documentos_pendientes') and not v.pinst
             and coalesce(v.ultima_gestion_en, v.creado_en) < now() - interval '3 days'
        when 'devueltos' then exists (select 1 from public.documentos d where d.cliente_id = v.id and d.estado = 'devuelto')
        when 'ultimo_corte' then v.ultimo
        when 'por_firmar' then v.estatus in ('contrato_en_curso', 'por_firmar')
        when 'firmados' then v.estatus = 'contrato_firmado'
        else true end
      end
  ), pag as (
    select s.*, row_number() over (order by s.ultimo desc, s.estatus_desde desc, s.id desc) as pos
    from sel s order by s.ultimo desc, s.estatus_desde desc, s.id desc limit lim offset des
  )
  select jsonb_build_object(
    'conteos', (select jsonb_build_object(
        'en_curso', count(*) filter (where v.estatus <> 'contrato_firmado' and not v.pinst),
        'por_revisar', count(*) filter (where v.estatus = 'documentos_en_revision'),
        'por_instalar', count(*) filter (where v.pinst),
        'sin_gestion', count(*) filter (where v.estatus in ('grandes_negocios', 'documentos_solicitados', 'documentos_pendientes') and not v.pinst
             and coalesce(v.ultima_gestion_en, v.creado_en) < now() - interval '3 days'),
        'por_firmar', count(*) filter (where v.estatus in ('contrato_en_curso', 'por_firmar')),
        'firmados', count(*) filter (where v.estatus = 'contrato_firmado'),
        'todos', count(*)) from vis v),
    'total', (select count(*) from sel),
    'desde', des, 'rol', rol, 'hoy', privado.hoy(),
    'filas', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'nombre', p.nombre, 'doc_tipo', p.doc_tipo, 'doc_numero', p.doc_numero, 'es_natural', p.es_natural,
        'seg', privado.segmento(p.id), 'estatus', p.estatus, 'estatus_desde', p.estatus_desde,
        'lider', coalesce(privado.nombre_de(p.lider_id), p.lider_nombre),
        'ug_en', p.ultima_gestion_en, 'ug_por', coalesce(privado.nombre_de(p.ultima_gestion_por), p.ultima_gestion_nombre),
        'creado_en', p.creado_en, 'es_top', p.es_top, 'ultimo_corte', p.ultimo, 'por_instalar', p.pinst,
        'n_serv', (select count(*) from public.servicios s where s.cliente_id = p.id),
        'serv', (select jsonb_build_object('codigo', s.codigo, 'sucursal', s.sucursal, 'plan', s.plan, 'categoria', s.categoria, 'estado', s.estado, 'telefono', s.telefono)
                 from public.servicios s where s.cliente_id = p.id order by s.fecha_instalacion desc nulls last, s.id desc limit 1),
        'tel', coalesce((select nullif(btrim(rp.telefono), '') from public.representantes rp where rp.cliente_id = p.id and rp.orden = 1), nullif(btrim(p.telefono), ''),
                 (select nullif(btrim(s.telefono), '') from public.servicios s where s.cliente_id = p.id and nullif(btrim(s.telefono), '') is not null order by s.id desc limit 1)),
        'correo', coalesce((select nullif(btrim(rp.correo), '') from public.representantes rp where rp.cliente_id = p.id and rp.orden = 1), nullif(btrim(p.correo_empresa), '')),
        'falta', privado.faltantes(p.id),
        'por_revisar', (select count(*) from public.documentos d where d.cliente_id = p.id and d.estado = 'por_revisar')
      ) order by p.pos), '[]'::jsonb) from pag p)
  ) into r;
  return r;
end $$;

-- ---------- Clientes: ficha ----------
create or replace function public.cliente_ficha(p_cliente bigint) returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare rol text := privado.exigir_cliente(p_cliente); yo uuid := (select auth.uid()); c public.clientes;
  hoy date := privado.hoy(); actual date := privado.corte_de(privado.hoy());
begin
  select * into c from public.clientes where id = p_cliente;
  if not found then raise exception 'Ese cliente no existe' using errcode = 'P0001'; end if;
  return jsonb_build_object(
    'rol', rol, 'hoy', hoy,
    'yo', jsonb_build_object('id', yo, 'nombre', privado.nombre_de(yo)),
    'corte', jsonb_build_object('etiqueta', actual, 'fin', privado.corte_fin(actual), 'dias', privado.corte_fin(actual) - hoy),
    'cliente', jsonb_build_object(
      'id', c.id, 'nombre', c.nombre, 'doc_tipo', c.doc_tipo, 'doc_numero', c.doc_numero, 'es_natural', c.es_natural,
      'seg', privado.segmento(c.id), 'estatus', c.estatus, 'estatus_desde', c.estatus_desde, 'legal_ok_en', c.legal_ok_en,
      'lider', coalesce(privado.nombre_de(c.lider_id), c.lider_nombre), 'es_top', c.es_top, 'regimen_firma', c.regimen_firma, 'es_isp', c.es_isp,
      'correo_empresa', c.correo_empresa, 'telefono', c.telefono, 'direccion', c.direccion,
      'proforma_en', c.proforma_en, 'proforma_por', privado.nombre_de(c.proforma_por),
      'bienvenida_en', c.bienvenida_en, 'bienvenida_por', privado.nombre_de(c.bienvenida_por),
      'ug_en', c.ultima_gestion_en, 'ug_por', coalesce(privado.nombre_de(c.ultima_gestion_por), c.ultima_gestion_nombre),
      'creado_en', c.creado_en, 'es_demo', c.es_demo,
      'por_instalar', (not exists (select 1 from public.servicios s where s.cliente_id = c.id) and not exists (select 1 from public.instalaciones i where i.cliente_id = c.id))),
    'servicios', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'codigo', s.codigo, 'sucursal', s.sucursal, 'plan', s.plan,
        'categoria', s.categoria, 'estado', s.estado, 'fecha_instalacion', s.fecha_instalacion, 'ip', s.ip, 'equipo', s.equipo,
        'direccion', s.direccion, 'telefono', s.telefono, 'con_deuda', s.con_deuda) order by s.fecha_instalacion desc nulls last, s.id desc), '[]'::jsonb)
      from public.servicios s where s.cliente_id = c.id),
    'representantes', (select coalesce(jsonb_agg(jsonb_build_object('orden', rp.orden, 'nombre', rp.nombre, 'correo', rp.correo, 'telefono', rp.telefono) order by rp.orden), '[]'::jsonb)
      from public.representantes rp where rp.cliente_id = c.id),
    'documentos', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'casilla', d.casilla, 'numero', d.numero, 'estado', d.estado,
        'motivo', d.motivo, 'nota', d.nota, 'vence_en', d.vence_en, 'firmado_en', d.firmado_en, 'subido_en', d.subido_en,
        'subido_por', coalesce(privado.nombre_de(d.subido_por), d.subido_nombre), 'revisado_en', d.revisado_en, 'revisado_por', privado.nombre_de(d.revisado_por),
        'archivos', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'ruta', a.ruta, 'url_externa', a.url_externa, 'nombre', a.nombre, 'mime', a.mime, 'tamano', a.tamano) order by da.orden, a.id), '[]'::jsonb)
                     from public.documento_archivos da join public.archivos a on a.id = da.archivo_id where da.documento_id = d.id),
        'comparte', (select coalesce(jsonb_agg(distinct jsonb_build_object('casilla', d2.casilla, 'numero', d2.numero)), '[]'::jsonb)
                     from public.documento_archivos da join public.documento_archivos db on db.archivo_id = da.archivo_id and db.documento_id <> da.documento_id
                     join public.documentos d2 on d2.id = db.documento_id where da.documento_id = d.id)
        ) order by d.casilla, d.numero), '[]'::jsonb)
      from public.documentos d where d.cliente_id = c.id),
    'requeridos', (select coalesce(jsonb_agg(jsonb_build_object('casilla', rq.r_casilla, 'numero', rq.r_numero, 'texto', rq.r_texto)), '[]'::jsonb) from privado.requeridos(c.id) rq),
    'faltantes', privado.faltantes(c.id),
    'hilo', (select coalesce(jsonb_agg(x.j order by x.en desc, x.id desc), '[]'::jsonb) from (
        select h.id, h.en, jsonb_build_object('id', h.id, 'tipo', h.tipo, 'texto', h.texto, 'detalle', h.detalle,
          'autor', coalesce(privado.nombre_de(h.autor_id), h.autor_nombre), 'mio', h.autor_id = yo, 'en', h.en) as j
        from public.hilo h where h.cliente_id = c.id order by h.en desc, h.id desc limit 120) x),
    'hilo_total', (select count(*) from public.hilo h where h.cliente_id = c.id),
    'comision', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'codigo', i.codigo, 'sucursal', i.sucursal, 'categoria', i.categoria,
        'instalada_en', i.instalada_en, 'pago_ok_en', i.pago_ok_en, 'pago_manual', i.pago_manual, 'corte', k.cp, 'comisiona', k.com,
        'estado', case when not k.com then 'no_comisiona'
                       when k.ok_en < privado.corte_cierre((k.cp + interval '1 month')::date) then 'cumple'
                       when now() < privado.corte_cierre(k.cp) then 'en_curso'
                       when now() < privado.corte_cierre((k.cp + interval '1 month')::date) then 'ultimo_corte'
                       else 'perdida' end,
        'corte_pago', case when k.ok_en is null then null when k.ok_en < privado.corte_cierre(k.cp) then k.cp else (k.cp + interval '1 month')::date end
        ) order by i.instalada_en desc), '[]'::jsonb)
      from public.instalaciones i
      left join public.ordenes_odoo o on o.id = i.orden_id
      cross join lateral (select privado.corte_de((i.instalada_en at time zone 'America/Caracas')::date) as cp,
          case when c.legal_ok_en is not null and i.pago_ok_en is not null then greatest(c.legal_ok_en, i.pago_ok_en) end as ok_en,
          (privado.comisionable(i.categoria, i.es_aliado) and (not i.es_evento or coalesce(o.comisiona_evento, false))) as com) k
      where i.cliente_id = c.id),
    'puedo', jsonb_build_object(
      'revisar', rol in ('admin', 'abogado'), 'estatus', rol in ('admin', 'abogado'), 'contrato', rol in ('admin', 'abogado'),
      'regimen', rol in ('admin', 'abogado'), 'top', rol = 'admin', 'gestion', rol in ('admin', 'analista'), 'pago', rol in ('admin', 'analista'))
  );
end $$;

-- ---------- Clientes: acciones ----------
create or replace function public.cliente_nota(p_cliente bigint, p_texto text) returns void
language plpgsql security definer set search_path to '' as $$
declare rol text := privado.exigir_cliente(p_cliente); yo uuid := (select auth.uid()); t text := btrim(coalesce(p_texto, ''));
begin
  if t = '' then raise exception 'Escribe la nota' using errcode = 'P0001'; end if;
  if length(t) > 1000 then raise exception 'La nota es muy larga. Máximo 1000 letras' using errcode = 'P0001'; end if;
  insert into public.hilo (cliente_id, tipo, texto, autor_id) values (p_cliente, 'nota', t, yo);
  perform privado.gestion(p_cliente, yo);
end $$;

-- Deja registro de un contacto. Si es el primer pedido de documentos, pasa a Documentos solicitados.
create or replace function public.cliente_contacto(p_cliente bigint, p_canal text, p_motivo text default 'contacto') returns text
language plpgsql security definer set search_path to '' as $$
declare rol text := privado.exigir_cliente(p_cliente); yo uuid := (select auth.uid()); e text;
begin
  if p_canal not in ('whatsapp', 'correo', 'llamada') then raise exception 'Canal no reconocido' using errcode = 'P0001'; end if;
  if p_motivo not in ('pedir', 'recordar', 'firma', 'contacto') then raise exception 'Motivo no reconocido' using errcode = 'P0001'; end if;
  insert into public.hilo (cliente_id, tipo, texto, detalle, autor_id)
  values (p_cliente, 'contacto', p_motivo, jsonb_build_object('canal', p_canal, 'motivo', p_motivo), yo);
  perform privado.gestion(p_cliente, yo);
  select estatus into e from public.clientes where id = p_cliente;
  if p_motivo = 'pedir' and e = 'grandes_negocios' then
    perform privado.poner_estatus(p_cliente, 'documentos_solicitados', yo, 'auto');
    e := 'documentos_solicitados';
  end if;
  return e;
end $$;

create or replace function public.cliente_estatus(p_cliente bigint, p_estatus text) returns void
language plpgsql security definer set search_path to '' as $$
declare rol text := privado.exigir('admin', 'abogado'); yo uuid := (select auth.uid());
begin
  perform privado.exigir_cliente(p_cliente);
  if p_estatus not in ('grandes_negocios', 'documentos_pendientes', 'documentos_solicitados', 'documentos_en_revision', 'documentos_recibidos', 'contrato_en_curso', 'por_firmar', 'contrato_firmado') then
    raise exception 'Estatus no reconocido' using errcode = 'P0001';
  end if;
  if privado.poner_estatus(p_cliente, p_estatus, yo, 'manual') then perform privado.gestion(p_cliente, yo); end if;
end $$;

create or replace function public.cliente_dato(p_cliente bigint, p_campo text, p_valor text) returns void
language plpgsql security definer set search_path to '' as $$
declare rol text := privado.exigir_cliente(p_cliente); yo uuid := (select auth.uid()); v text := nullif(btrim(coalesce(p_valor, '')), ''); ant text;
begin
  if p_campo = 'correo_empresa' then
    if v is not null and v !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Ese correo no parece válido' using errcode = 'P0001'; end if;
    select correo_empresa into ant from public.clientes where id = p_cliente;
    update public.clientes set correo_empresa = lower(v), actualizado_en = now() where id = p_cliente;
  elsif p_campo = 'telefono' then
    if v is not null and length(regexp_replace(v, '\D', '', 'g')) not between 7 and 15 then raise exception 'Ese teléfono no parece válido' using errcode = 'P0001'; end if;
    select telefono into ant from public.clientes where id = p_cliente;
    update public.clientes set telefono = v, actualizado_en = now() where id = p_cliente;
  elsif p_campo = 'direccion' then
    if length(coalesce(v, '')) > 300 then raise exception 'La dirección es muy larga' using errcode = 'P0001'; end if;
    select direccion into ant from public.clientes where id = p_cliente;
    update public.clientes set direccion = v, actualizado_en = now() where id = p_cliente;
  elsif p_campo = 'regimen_firma' then
    perform privado.exigir('admin', 'abogado');
    if v is not null and v not in ('individual', 'conjunta') then raise exception 'Régimen no reconocido' using errcode = 'P0001'; end if;
    select regimen_firma into ant from public.clientes where id = p_cliente;
    update public.clientes set regimen_firma = v, actualizado_en = now() where id = p_cliente;
  elsif p_campo = 'es_isp' then
    perform privado.exigir('admin', 'abogado');
    select es_isp::text into ant from public.clientes where id = p_cliente;
    update public.clientes set es_isp = (v = 'true'), actualizado_en = now() where id = p_cliente;
  elsif p_campo = 'es_top' then
    perform privado.exigir('admin');
    select es_top::text into ant from public.clientes where id = p_cliente;
    update public.clientes set es_top = (v = 'true'), actualizado_en = now() where id = p_cliente;
  else
    raise exception 'Ese dato no se puede cambiar aquí' using errcode = 'P0001';
  end if;
  if ant is distinct from v and not (p_campo in ('es_isp', 'es_top') and ant = coalesce(v, 'false')) then
    insert into public.hilo (cliente_id, tipo, texto, detalle, autor_id) values (p_cliente, 'dato', p_campo, jsonb_build_object('valor', v), yo);
    insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues)
    values (yo, 'cambio_dato', 'clientes', p_cliente::text, jsonb_build_object(p_campo, ant), jsonb_build_object(p_campo, v));
    perform privado.recalcular(p_cliente, yo);
  end if;
end $$;

-- El nombre del representante no se toca aquí: lo llena el análisis con IA.
create or replace function public.cliente_representante(p_cliente bigint, p_orden int, p_correo text, p_telefono text) returns void
language plpgsql security definer set search_path to '' as $$
declare rol text := privado.exigir_cliente(p_cliente); yo uuid := (select auth.uid());
  co text := nullif(lower(btrim(coalesce(p_correo, ''))), ''); te text := nullif(btrim(coalesce(p_telefono, '')), '');
begin
  if p_orden is null or p_orden not between 1 and 4 then raise exception 'Son hasta 4 representantes' using errcode = 'P0001'; end if;
  if p_orden > 1 and not exists (select 1 from public.representantes where cliente_id = p_cliente and orden = p_orden - 1) then
    raise exception 'Agrega primero el representante anterior' using errcode = 'P0001';
  end if;
  if co is not null and co !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Ese correo no parece válido' using errcode = 'P0001'; end if;
  if te is not null and length(regexp_replace(te, '\D', '', 'g')) not between 7 and 15 then raise exception 'Ese teléfono no parece válido' using errcode = 'P0001'; end if;
  insert into public.representantes (cliente_id, orden, correo, telefono) values (p_cliente, p_orden, co, te)
  on conflict (cliente_id, orden) do update set correo = excluded.correo, telefono = excluded.telefono, actualizado_en = now();
  insert into public.hilo (cliente_id, tipo, texto, detalle, autor_id) values (p_cliente, 'dato', 'representante', jsonb_build_object('orden', p_orden), yo);
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues)
  values (yo, 'cambio_representante', 'representantes', p_cliente::text, jsonb_build_object('orden', p_orden, 'correo', co, 'telefono', te));
  perform privado.gestion(p_cliente, yo);
  perform privado.recalcular(p_cliente, yo);
end $$;

create or replace function public.cliente_gestion(p_cliente bigint, p_cual text, p_hecho boolean) returns void
language plpgsql security definer set search_path to '' as $$
declare rol text := privado.exigir('admin', 'analista'); yo uuid := (select auth.uid());
begin
  perform privado.exigir_cliente(p_cliente);
  if p_cual = 'proforma' then
    update public.clientes set proforma_en = case when p_hecho then now() end, proforma_por = case when p_hecho then yo end, actualizado_en = now() where id = p_cliente;
  elsif p_cual = 'bienvenida' then
    update public.clientes set bienvenida_en = case when p_hecho then now() end, bienvenida_por = case when p_hecho then yo end, actualizado_en = now() where id = p_cliente;
  else raise exception 'Gestión no reconocida' using errcode = 'P0001';
  end if;
  insert into public.hilo (cliente_id, tipo, texto, detalle, autor_id) values (p_cliente, 'gestion', p_cual, jsonb_build_object('hecho', coalesce(p_hecho, false)), yo);
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues) values (yo, 'gestion_analista', 'clientes', p_cliente::text, jsonb_build_object(p_cual, coalesce(p_hecho, false)));
  perform privado.gestion(p_cliente, yo);
end $$;

create or replace function public.instalacion_pago(p_instalacion bigint, p_pagada boolean) returns void
language plpgsql security definer set search_path to '' as $$
declare rol text := privado.exigir('admin', 'analista'); yo uuid := (select auth.uid()); cid bigint; ant timestamptz;
begin
  select cliente_id, pago_ok_en into cid, ant from public.instalaciones where id = p_instalacion;
  if not found then raise exception 'Esa instalación no existe' using errcode = 'P0001'; end if;
  update public.instalaciones set pago_ok_en = case when p_pagada then coalesce(pago_ok_en, now()) end, pago_manual = true where id = p_instalacion;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues)
  values (yo, 'pago_instalacion_manual', 'instalaciones', p_instalacion::text, jsonb_build_object('pago_ok_en', ant), jsonb_build_object('pagada', coalesce(p_pagada, false)));
  if cid is not null then
    insert into public.hilo (cliente_id, tipo, texto, detalle, autor_id) values (cid, 'pago', case when p_pagada then 'pagada' else 'pendiente' end, jsonb_build_object('instalacion', p_instalacion), yo);
  end if;
end $$;

-- ---------- Documentos ----------
-- p_items: [{ archivos:[{ruta,nombre,mime,tamano}], casillas:[{casilla,numero}], vence_en, firmado_en }]
create or replace function public.documentos_registrar(p_cliente bigint, p_items jsonb) returns int
language plpgsql security definer set search_path to '' as $$
declare rol text := privado.exigir_cliente(p_cliente); yo uuid := (select auth.uid());
  it jsonb; ar jsonb; ca jsonb; ids bigint[]; aid bigint; did bigint; cas text; num int; n int := 0; etiquetas jsonb := '[]'::jsonb; k int;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'No llegó ningún archivo' using errcode = 'P0001'; end if;
  if jsonb_array_length(p_items) > 30 then raise exception 'Son muchos archivos de una vez. Sube hasta 30' using errcode = 'P0001'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    if jsonb_typeof(it -> 'archivos') <> 'array' or jsonb_array_length(it -> 'archivos') = 0 then raise exception 'Falta el archivo' using errcode = 'P0001'; end if;
    if jsonb_typeof(it -> 'casillas') <> 'array' or jsonb_array_length(it -> 'casillas') = 0 then raise exception 'Marca qué trae cada archivo' using errcode = 'P0001'; end if;
    ids := '{}';
    for ar in select * from jsonb_array_elements(it -> 'archivos') loop
      if coalesce(ar ->> 'ruta', '') !~ ('^' || p_cliente || '/[A-Za-z0-9._-]{1,140}$') then raise exception 'Archivo no válido' using errcode = 'P0001'; end if;
      if not exists (select 1 from storage.objects ob where ob.bucket_id = 'expedientes' and ob.name = ar ->> 'ruta') then
        raise exception 'El archivo no terminó de subir. Intenta de nuevo' using errcode = 'P0001';
      end if;
      insert into public.archivos (cliente_id, ruta, nombre, mime, tamano, subido_por)
      values (p_cliente, ar ->> 'ruta', left(coalesce(nullif(btrim(ar ->> 'nombre'), ''), 'archivo'), 200), left(ar ->> 'mime', 80), nullif(ar ->> 'tamano', '')::int, yo)
      on conflict (ruta) do update set nombre = excluded.nombre
      returning id into aid;
      ids := ids || aid;
    end loop;
    for ca in select * from jsonb_array_elements(it -> 'casillas') loop
      cas := ca ->> 'casilla'; num := coalesce(nullif(ca ->> 'numero', '')::int, 0);
      if cas not in ('cedula', 'rif_personal', 'rif_empresa', 'acta_constitutiva', 'acta_asamblea', 'conatel', 'contrato_pyme', 'contrato_dedicado', 'otro') then
        raise exception 'Casilla no reconocida' using errcode = 'P0001';
      end if;
      if cas in ('contrato_pyme', 'contrato_dedicado') and rol not in ('admin', 'abogado') then raise exception 'El contrato lo sube Legal' using errcode = 'P0001'; end if;
      if cas in ('cedula', 'rif_personal', 'acta_asamblea') then
        if num not between 1 and 4 then raise exception 'Número de casilla no válido' using errcode = 'P0001'; end if;
      elsif cas = 'otro' then
        select coalesce(max(numero), 0) + 1 into num from public.documentos where cliente_id = p_cliente and casilla = 'otro';
        if num > 99 then raise exception 'Hay demasiados documentos en Otros' using errcode = 'P0001'; end if;
      else num := 0;
      end if;
      insert into public.documentos (cliente_id, casilla, numero, estado, subido_por, subido_en, vence_en, firmado_en)
      values (p_cliente, cas, num, 'por_revisar', yo, now(), nullif(it ->> 'vence_en', '')::date, nullif(it ->> 'firmado_en', '')::date)
      on conflict (cliente_id, casilla, numero) do update set estado = 'por_revisar', motivo = null, nota = null, subido_por = yo, subido_nombre = null, subido_en = now(),
        revisado_por = null, revisado_en = null, vence_en = excluded.vence_en, firmado_en = excluded.firmado_en
      returning id into did;
      delete from public.documento_archivos where documento_id = did;
      for k in 1..array_length(ids, 1) loop
        insert into public.documento_archivos (documento_id, archivo_id, orden) values (did, ids[k], k) on conflict do nothing;
      end loop;
      etiquetas := etiquetas || jsonb_build_array(jsonb_build_object('casilla', cas, 'numero', num));
      insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues)
      values (yo, 'documento_subido', 'documentos', did::text, jsonb_build_object('cliente', p_cliente, 'casilla', cas, 'numero', num));
      n := n + 1;
    end loop;
  end loop;
  insert into public.hilo (cliente_id, tipo, texto, detalle, autor_id) values (p_cliente, 'documento_subido', n::text, jsonb_build_object('casillas', etiquetas), yo);
  perform privado.gestion(p_cliente, yo);
  perform privado.recalcular(p_cliente, yo);
  return n;
end $$;

create or replace function public.documento_revisar(p_documento bigint, p_accion text, p_motivo text default null, p_nota text default null, p_vence date default null) returns void
language plpgsql security definer set search_path to '' as $$
declare rol text := privado.exigir('admin', 'abogado'); yo uuid := (select auth.uid()); d public.documentos; nt text := nullif(btrim(coalesce(p_nota, '')), '');
begin
  select * into d from public.documentos where id = p_documento for update;
  if not found then raise exception 'Ese documento ya no existe' using errcode = 'P0001'; end if;
  perform privado.exigir_cliente(d.cliente_id);
  if length(coalesce(nt, '')) > 500 then raise exception 'La nota es muy larga. Máximo 500 letras' using errcode = 'P0001'; end if;
  if p_accion = 'aprobar' then
    update public.documentos set estado = 'aprobado', motivo = null, nota = null, vence_en = coalesce(p_vence, vence_en), revisado_por = yo, revisado_en = now() where id = p_documento;
    insert into public.hilo (cliente_id, tipo, texto, detalle, autor_id)
    values (d.cliente_id, 'documento_aprobado', d.casilla, jsonb_build_object('casilla', d.casilla, 'numero', d.numero, 'vence_en', coalesce(p_vence, d.vence_en)), yo);
  elsif p_accion = 'devolver' then
    if p_motivo is null or p_motivo not in ('vencido', 'ilegible', 'no_corresponde', 'falta_firma', 'otro') then raise exception 'Elige por qué lo devuelves' using errcode = 'P0001'; end if;
    if p_motivo = 'otro' and nt is null then raise exception 'Escribe el motivo en la nota' using errcode = 'P0001'; end if;
    update public.documentos set estado = 'devuelto', motivo = p_motivo, nota = nt, revisado_por = yo, revisado_en = now() where id = p_documento;
    insert into public.hilo (cliente_id, tipo, texto, detalle, autor_id)
    values (d.cliente_id, 'documento_devuelto', d.casilla, jsonb_build_object('casilla', d.casilla, 'numero', d.numero, 'motivo', p_motivo, 'nota', nt), yo);
  else raise exception 'Acción no reconocida' using errcode = 'P0001';
  end if;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues)
  values (yo, 'documento_' || p_accion, 'documentos', p_documento::text, jsonb_build_object('estado', d.estado), jsonb_build_object('motivo', p_motivo, 'nota', nt, 'vence_en', p_vence));
  perform privado.gestion(d.cliente_id, yo);
  perform privado.recalcular(d.cliente_id, yo);
end $$;

-- ---------- Datos de ejemplo ----------
create or replace function public.demo_borrar() returns int
language plpgsql security definer set search_path to '' as $$
declare rol text := privado.exigir('admin'); yo uuid := (select auth.uid()); n int;
begin
  delete from public.pendientes where cliente_id in (select id from public.clientes where es_demo)
     or instalacion_id in (select id from public.instalaciones where cliente_id in (select id from public.clientes where es_demo))
     or orden_id in (select id from public.ordenes_odoo where es_demo);
  delete from public.instalaciones where cliente_id in (select id from public.clientes where es_demo) or orden_id in (select id from public.ordenes_odoo where es_demo);
  update public.ordenes_odoo set orden_anterior_id = null where es_demo;
  delete from public.ordenes_odoo where es_demo;
  delete from public.servicios where cliente_id in (select id from public.clientes where es_demo);
  delete from public.clientes where es_demo;
  get diagnostics n = row_count;
  insert into public.bitacora (usuario_id, accion, tabla, despues) values (yo, 'borrar_datos_de_ejemplo', 'clientes', jsonb_build_object('clientes', n));
  return n;
end $$;

-- ---------- Permisos ----------
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as firma, n.nspname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'privado' and p.proname not in ('rol_actual', 'puede_cliente') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.firma);
  end loop;
  for f in select p.oid::regprocedure as firma from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('comisiones_corte', 'inicio_datos', 'clientes_lista', 'cliente_ficha', 'cliente_nota', 'cliente_contacto',
             'cliente_estatus', 'cliente_dato', 'cliente_representante', 'cliente_gestion', 'instalacion_pago', 'documentos_registrar', 'documento_revisar', 'demo_borrar') loop
    execute format('revoke all on function %s from public, anon', f.firma);
    execute format('grant execute on function %s to authenticated', f.firma);
  end loop;
end $$;
