-- Lote urgente 20/10, parte 1: corte con cierre manual (aplicado con el conector, migración corte_cierre_manual).
-- Desde el corte de octubre 2026 el corte no se cierra solo: el límite de Legal y pago es el momento en que el
-- administrador o el Analista Senior lo cierran ("Cerrar corte" = certificar). El día límite queda como aviso.
-- Los cortes anteriores (septiembre y antes) siguen con su calendario: no se mueven.

create or replace function privado.corte_manual_desde() returns date language sql immutable set search_path to '' as $$ select date '2026-10-01' $$;

-- ¿El corte ya está cerrado? Los anteriores al cierre manual cuentan como cerrados.
create or replace function privado.corte_cerrado(c date) returns boolean language sql stable security definer set search_path to '' as $$
  select date_trunc('month', c::timestamp)::date < privado.corte_manual_desde()
    or exists (select 1 from public.cortes_certificados k where k.corte = date_trunc('month', c::timestamp)::date and k.anulado_en is null)
$$;

-- Límite de Legal y pago: calendario hasta septiembre 2026; desde octubre, el momento del cierre (abierto: todo cuenta)
create or replace function privado.corte_limite_ts(c date) returns timestamptz language sql stable security definer set search_path to '' as $$
  select case when date_trunc('month', c::timestamp)::date < privado.corte_manual_desde()
    then ((privado.corte_limite(c) + 1)::timestamp at time zone 'America/Caracas')
    else coalesce((select k.certificado_en from public.cortes_certificados k
                   where k.corte = date_trunc('month', c::timestamp)::date and k.anulado_en is null), 'infinity'::timestamptz) end
$$;

-- Corte en curso: el más viejo que sigue abierto (desde octubre 2026); si todos están cerrados, el del calendario
create or replace function privado.corte_en_curso() returns date language sql stable security definer set search_path to '' as $$
  select coalesce(
    (select min(g)::date from generate_series(privado.corte_manual_desde()::timestamp, privado.corte_de(privado.hoy())::timestamp, interval '1 month') g
      where not privado.corte_cerrado(g::date)),
    privado.corte_de(privado.hoy()))
$$;

-- Filas del corte: lo que no cumplió del corte anterior solo pasa cuando ese corte ya se cerró
CREATE OR REPLACE FUNCTION privado.comision_filas3(p_corte date)
 RETURNS TABLE(instalacion_id bigint, cliente_id bigint, nombre text, doc text, instalada_en timestamp with time zone, lider_id uuid, lider text, origen text, legal_ok boolean, pago_ok boolean, cumple boolean, estatus text, codigo text, sucursal text, revisar_pago boolean, orden_ok boolean, orden text, cruce text, orden_creador text, es_natural boolean, orden_id bigint, orden_titulo text, instalador text, excepcion boolean, excepcion_motivo text, dueno_manual boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  with lim as (
    select privado.corte_cierre((p_corte - interval '2 month')::date) as ini_ant,
           privado.corte_cierre((p_corte - interval '1 month')::date) as ini,
           privado.corte_cierre(p_corte) as fin,
           privado.corte_limite_ts((p_corte - interval '1 month')::date) as lants, privado.corte_limite_ts(p_corte) as lts,
           privado.corte_cerrado((p_corte - interval '1 month')::date) as prev_cerrado
  ), base as (
    select i.id, i.cliente_id as cid, coalesce(c.nombre, i.nombre) as nom,
      case when c.id is not null then c.doc_tipo || '-' || c.doc_numero else i.doc_numero end as docu,
      i.instalada_en as inst, pf.id as lid,
      coalesce(pf.nombre, i.lider_nombre, 'Por asignar') as lnom,
      case when c.legal_quitado_en >= lim.lts and c.legal_ok_antes < lim.lts and (c.legal_ok_en is null or c.legal_ok_en >= lim.lts) then c.legal_ok_antes else c.legal_ok_en end as leg, i.pago_ok_en as pag, coalesce(c.estatus, 'grandes_negocios') as est,
      i.codigo as cod, i.sucursal as suc, lim.ini, lim.fin, lim.lants, lim.lts, lim.prev_cerrado as pcer,
      (i.pago_ok_en is null and (select count(*) from public.servicios s where s.cliente_id = i.cliente_id) > 1) as rev,
      (i.cruce_confirmado and (i.orden_id is not null or i.cruce = 'manual') and coalesce(pf.nombre, i.lider_nombre) is not null) as ook,
      o.numero as onum, i.cruce as cru, o.creador_nombre as ocre, coalesce(c.es_natural, false) as nat,
      i.orden_id as oid, o.titulo as otit, i.instalador as insta, i.excepcion_corte as exc, i.excepcion_motivo as excm, i.dueno_manual as dman
    from public.instalaciones i cross join lim
    left join public.clientes c on c.id = i.cliente_id
    left join public.ordenes_odoo o on o.id = i.orden_id
    left join public.perfiles pf on pf.id = case when i.dueno_manual then i.lider_id else coalesce(i.lider_id, o.vendedor_id) end
    where i.instalada_en >= lim.ini_ant and i.instalada_en < lim.fin
      and i.anulada_en is null and privado.comisionable(i.categoria, i.es_aliado)
      and (not i.es_evento or coalesce(i.evento_comisiona, o.comisiona_evento, false))
  )
  select id, cid, nom, docu, inst, lid, lnom,
    case when inst >= ini then 'corte' else 'anterior' end,
    coalesce(leg < lts, false), coalesce(pag < lts, false),
    (coalesce(leg < lts and pag < lts, false) or coalesce(exc <= p_corte, false)) and ook,
    est, cod, suc, rev, ook, onum, cru, ocre, nat, oid, otit, insta, coalesce(exc <= p_corte, false), excm, dman
  from base
  where inst >= ini or (pcer and (not (coalesce(leg < lants and pag < lants, false) or coalesce(exc < p_corte, false)) or not ook))
$function$;

-- Resumen antes de cerrar: cuántas filas, cuántas cumplen, cuántas pasan al siguiente y cuántas se pierden
create or replace function public.corte_cierre_resumen(p_corte date) returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare c date := date_trunc('month', p_corte::timestamp)::date; r jsonb;
begin
  perform privado.exigir_senior();
  select jsonb_build_object('corte', c, 'total', count(*), 'cumplen', count(*) filter (where f.cumple),
    'pasan', count(*) filter (where f.origen = 'corte' and not f.cumple), 'se_pierden', count(*) filter (where f.origen = 'anterior' and not f.cumple),
    'por_asignar', count(*) filter (where not f.orden_ok))
  into r from privado.comision_filas3(c) f;
  return r;
end $$;
revoke all on function public.corte_cierre_resumen(date) from public, anon;
grant execute on function public.corte_cierre_resumen(date) to authenticated;

-- Cerrar corte (certificar): desde que terminan sus instalaciones, en orden, con bitácora. Queda fijo.
CREATE OR REPLACE FUNCTION public.corte_certificar(p_corte date)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare v_yo uuid := privado.exigir_senior(); c date := date_trunc('month', p_corte::timestamp)::date; v_hoy date := privado.hoy(); filas jsonb; n int; k int; pa int; pe int;
  ant date := (date_trunc('month', p_corte::timestamp) - interval '1 month')::date;
begin
  if c is null then raise exception 'Elige el corte' using errcode = 'P0001'; end if;
  if exists (select 1 from public.cortes_certificados x where x.corte = c and x.anulado_en is null) then raise exception 'Ese corte ya está cerrado' using errcode = 'P0001'; end if;
  if c >= privado.corte_manual_desde() then
    if v_hoy <= privado.corte_fin(c) then raise exception 'Este corte se puede cerrar desde el %, cuando terminan sus instalaciones', to_char(privado.corte_fin(c) + 1, 'DD/MM') using errcode = 'P0001'; end if;
    if not privado.corte_cerrado(ant) then raise exception 'Primero cierra el corte anterior (%)', to_char(ant, 'MM/YYYY') using errcode = 'P0001'; end if;
  elsif v_hoy < privado.corte_certifica(c) then raise exception 'Este corte se certifica desde el %', to_char(privado.corte_certifica(c), 'DD/MM') using errcode = 'P0001';
  end if;
  select coalesce(jsonb_agg(to_jsonb(f) order by f.lider, f.origen, f.instalada_en), '[]'::jsonb), count(*), count(*) filter (where f.cumple),
    count(*) filter (where f.origen = 'corte' and not f.cumple), count(*) filter (where f.origen = 'anterior' and not f.cumple)
  into filas, n, k, pa, pe from privado.comision_filas3(c) f;
  insert into public.cortes_certificados (corte, certificado_por, certificado_nombre, total, cumplen, filas) values (c, v_yo, privado.nombre_de(v_yo), n, k, filas);
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues)
  values (v_yo, 'corte_cerrado', 'cortes_certificados', c::text, null, jsonb_build_object('total', n, 'cumplen', k, 'pasan', pa, 'se_pierden', pe));
  return jsonb_build_object('total', n, 'cumplen', k, 'pasan', pa, 'se_pierden', pe);
end $function$;

-- Datos de Comisiones: corte en curso (el abierto más viejo), el siguiente, aviso del día límite y quién puede cerrar
CREATE OR REPLACE FUNCTION public.comisiones_corte(p_corte date DEFAULT NULL::date)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare v_rol text := privado.exigir('admin', 'abogado', 'analista', 'lider'); v_yo uuid := (select auth.uid());
  v_hoy date := privado.hoy(); actual date := privado.corte_en_curso(); v_max date := privado.corte_de(privado.hoy()); c date; filas jsonb; pinst jsonb := '[]'::jsonb; comp jsonb; cl jsonb;
  v_mis text[]; cert public.cortes_certificados; v_senior boolean := privado.es_senior(); v_duenos jsonb := '[]'::jsonb; v_manual boolean;
begin
  if v_max < actual then v_max := actual; end if;
  c := coalesce(date_trunc('month', p_corte::timestamp)::date, actual);
  if c > v_max then c := v_max; end if;
  v_manual := c >= privado.corte_manual_desde();
  select array_remove(array[privado.norm(p.nombre), privado.norm(p.nombre_odoo)], '') into v_mis from public.perfiles p where p.id = v_yo;
  select * into cert from public.cortes_certificados k where k.corte = c and k.anulado_en is null;
  if cert.id is not null then
    select coalesce(jsonb_agg(e || coalesce(privado.fila_extras((e->>'instalacion_id')::bigint, (e->>'cliente_id')::bigint), '{}'::jsonb) order by e->>'lider', e->>'origen', e->>'instalada_en'), '[]'::jsonb) into filas
    from jsonb_array_elements(cert.filas) e
    where v_rol <> 'lider' or (e->>'lider_id')::uuid = v_yo or privado.norm(e->>'lider') = any (v_mis);
  else
    select coalesce(jsonb_agg(to_jsonb(f) || coalesce(privado.fila_extras(f.instalacion_id, f.cliente_id), '{}'::jsonb) order by f.lider, f.origen, f.instalada_en), '[]'::jsonb) into filas
    from privado.comision_filas3(c) f where v_rol <> 'lider' or f.lider_id = v_yo or privado.norm(f.lider) = any (v_mis);
  end if;

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
      and (v_rol <> 'lider' or o.vendedor_id = v_yo or o.creador_id = v_yo or cl2.lider_id = v_yo or privado.norm(o.creador_nombre) = any (v_mis));
  end if;

  select jsonb_agg(jsonb_build_object('corte', g.k, 'total', t.total, 'cumplen', t.cumplen) order by g.k) into comp
  from (select (actual - (n || ' month')::interval)::date as k from generate_series(0, 5) n) g
  cross join lateral (
    select count(*) filter (where f.origen = 'corte') as total, count(*) filter (where f.cumple) as cumplen
    from privado.comision_filas3(g.k) f where v_rol <> 'lider' or f.lider_id = v_yo or privado.norm(f.lider) = any (v_mis)) t;

  select coalesce(jsonb_agg(jsonb_build_object('lider', z.lider, 'actual', z.a, 'anterior', z.b) order by z.a desc, z.lider), '[]'::jsonb) into cl
  from (
    select coalesce(x.lider, y.lider) as lider, coalesce(x.n, 0) as a, coalesce(y.n, 0) as b
    from (select f.lider, count(*) n from privado.comision_filas3(c) f where f.origen = 'corte' and (v_rol <> 'lider' or f.lider_id = v_yo or privado.norm(f.lider) = any (v_mis)) group by 1) x
    full join (select f.lider, count(*) n from privado.comision_filas3((c - interval '1 month')::date) f where f.origen = 'corte' and (v_rol <> 'lider' or f.lider_id = v_yo or privado.norm(f.lider) = any (v_mis)) group by 1) y
      on y.lider = x.lider
  ) z;

  if v_senior then select coalesce(jsonb_agg(d), '[]'::jsonb) into v_duenos from privado.duenos() d; end if;

  return jsonb_build_object(
    'corte', c, 'actual', actual, 'siguiente', case when v_max > actual then v_max end, 'hoy', v_hoy, 'inicio', privado.corte_inicio(c), 'fin', privado.corte_fin(c),
    'limite', privado.corte_limite(c), 'certifica', privado.corte_certifica(c), 'dias', privado.corte_limite(c) - v_hoy, 'rol', v_rol,
    'manual', v_manual, 'abierto', cert.id is null and not (c < privado.corte_manual_desde() and v_hoy > privado.corte_limite(c)),
    'cierra_desde', case when v_manual then privado.corte_fin(c) + 1 end,
    'filas', filas, 'por_instalar', pinst, 'comparativa', coalesce(comp, '[]'::jsonb), 'lideres', cl,
    'duenos', v_duenos, 'exc_pagada', case when v_rol in ('admin', 'analista') then (select count(*) from public.clientes x where x.exc_pagada and x.unido_a is null and privado.faltan_archivos(x.id)) else 0 end, 'eventos', case when v_rol <> 'abogado' then privado.eventos_corte(c, v_rol, v_yo, v_mis) else '[]'::jsonb end,
    'certificado', case when cert.id is not null then jsonb_build_object('en', cert.certificado_en, 'por', coalesce(privado.nombre_de(cert.certificado_por), cert.certificado_nombre), 'total', cert.total, 'cumplen', cert.cumplen) end,
    'puedo', jsonb_build_object('asignar', v_senior and cert.id is null, 'pago', v_senior, 'excepcion', v_rol = 'admin' and cert.id is null,
      'certificar', v_senior and cert.id is null and c = actual and case when v_manual then v_hoy > privado.corte_fin(c) else v_hoy >= privado.corte_certifica(c) end,
      'quitar_certificado', v_rol = 'admin' and cert.id is not null and not privado.corte_cerrado((c + interval '1 month')::date)));
end $function$;

-- Quitar la certificación (solo administrador): nunca si el corte siguiente ya está cerrado
CREATE OR REPLACE FUNCTION public.corte_descertificar(p_corte date)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare v_rol text := privado.exigir('admin'); v_yo uuid := (select auth.uid()); c date := date_trunc('month', p_corte::timestamp)::date; n int;
begin
  if c >= privado.corte_manual_desde() and exists (select 1 from public.cortes_certificados k where k.corte = (c + interval '1 month')::date and k.anulado_en is null) then
    raise exception 'No se puede abrir: el corte siguiente ya está cerrado' using errcode = 'P0001'; end if;
  update public.cortes_certificados set anulado_en = now(), anulado_por = v_yo where corte = c and anulado_en is null;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Ese corte no está certificado' using errcode = 'P0001'; end if;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues)
  values (v_yo, 'corte_certificado_anulado', 'cortes_certificados', c::text, null, null);
end $function$;
