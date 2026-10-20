-- Lote urgente 20/10, parte 2: mover una instalación de corte (aplicado con el conector, migración instalacion_mover_corte).
-- Solo administrador y Analista Senior, con motivo y bitácora. Solo entre los cortes abiertos (el en curso y el siguiente).
-- Nunca desde ni hacia un corte cerrado. La fila lleva "Movida a mano".

alter table public.instalaciones add column if not exists corte_manual date;
alter table public.instalaciones add column if not exists corte_manual_motivo text;
alter table public.instalaciones add column if not exists corte_manual_por uuid references public.perfiles(id);
alter table public.instalaciones add column if not exists corte_manual_en timestamptz;

-- Herramienta interna: cambia un tramo exacto del código de una función (debe aparecer una sola vez) y la vuelve a crear
create or replace function privado.reemplazar_en_funcion(p_fn regprocedure, p_viejo text, p_nuevo text) returns void
language plpgsql security definer set search_path to '' as $$
declare d text := pg_get_functiondef(p_fn); n int;
begin
  n := (length(d) - length(replace(d, p_viejo, ''))) / greatest(length(p_viejo), 1);
  if n <> 1 then raise exception 'El tramo aparece % veces en %', n, p_fn; end if;
  execute replace(d, p_viejo, p_nuevo);
end $$;
revoke all on function privado.reemplazar_en_funcion(regprocedure, text, text) from public, anon, authenticated;

-- Filas del corte: una instalación movida a mano cuenta en el corte elegido (y como último corte en el siguiente)
CREATE OR REPLACE FUNCTION privado.comision_filas3(p_corte date)
 RETURNS TABLE(instalacion_id bigint, cliente_id bigint, nombre text, doc text, instalada_en timestamp with time zone, lider_id uuid, lider text, origen text, legal_ok boolean, pago_ok boolean, cumple boolean, estatus text, codigo text, sucursal text, revisar_pago boolean, orden_ok boolean, orden text, cruce text, orden_creador text, es_natural boolean, orden_id bigint, orden_titulo text, instalador text, excepcion boolean, excepcion_motivo text, dueno_manual boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  with lim as (
    select privado.corte_cierre((p_corte - interval '2 month')::date) as ini_ant,
           privado.corte_cierre((p_corte - interval '1 month')::date) as ini,
           privado.corte_cierre(p_corte) as fin,
           privado.corte_limite_ts((p_corte - interval '1 month')::date) as lants, privado.corte_limite_ts(p_corte) as lts,
           privado.corte_cerrado((p_corte - interval '1 month')::date) as prev_cerrado,
           (p_corte - interval '1 month')::date as cant
  ), base as (
    select i.id, i.cliente_id as cid, coalesce(c.nombre, i.nombre) as nom,
      case when c.id is not null then c.doc_tipo || '-' || c.doc_numero else i.doc_numero end as docu,
      i.instalada_en as inst, pf.id as lid,
      coalesce(pf.nombre, i.lider_nombre, 'Por asignar') as lnom,
      case when c.legal_quitado_en >= lim.lts and c.legal_ok_antes < lim.lts and (c.legal_ok_en is null or c.legal_ok_en >= lim.lts) then c.legal_ok_antes else c.legal_ok_en end as leg, i.pago_ok_en as pag, coalesce(c.estatus, 'grandes_negocios') as est,
      i.codigo as cod, i.sucursal as suc, lim.ini, lim.fin, lim.lants, lim.lts, lim.prev_cerrado as pcer,
      case when i.corte_manual is not null then i.corte_manual = p_corte else i.instalada_en >= lim.ini end as del_corte,
      (i.pago_ok_en is null and (select count(*) from public.servicios s where s.cliente_id = i.cliente_id) > 1) as rev,
      (i.cruce_confirmado and (i.orden_id is not null or i.cruce = 'manual') and coalesce(pf.nombre, i.lider_nombre) is not null) as ook,
      o.numero as onum, i.cruce as cru, o.creador_nombre as ocre, coalesce(c.es_natural, false) as nat,
      i.orden_id as oid, o.titulo as otit, i.instalador as insta, i.excepcion_corte as exc, i.excepcion_motivo as excm, i.dueno_manual as dman
    from public.instalaciones i cross join lim
    left join public.clientes c on c.id = i.cliente_id
    left join public.ordenes_odoo o on o.id = i.orden_id
    left join public.perfiles pf on pf.id = case when i.dueno_manual then i.lider_id else coalesce(i.lider_id, o.vendedor_id) end
    where ((i.corte_manual is null and i.instalada_en >= lim.ini_ant and i.instalada_en < lim.fin) or i.corte_manual in (p_corte, lim.cant))
      and i.anulada_en is null and privado.comisionable(i.categoria, i.es_aliado)
      and (not i.es_evento or coalesce(i.evento_comisiona, o.comisiona_evento, false))
  )
  select id, cid, nom, docu, inst, lid, lnom,
    case when del_corte then 'corte' else 'anterior' end,
    coalesce(leg < lts, false), coalesce(pag < lts, false),
    (coalesce(leg < lts and pag < lts, false) or coalesce(exc <= p_corte, false)) and ook,
    est, cod, suc, rev, ook, onum, cru, ocre, nat, oid, otit, insta, coalesce(exc <= p_corte, false), excm, dman
  from base
  where del_corte or (pcer and (not (coalesce(leg < lants and pag < lants, false) or coalesce(exc < p_corte, false)) or not ook))
$function$;

-- Datos extra de cada fila: la etiqueta "Movida a mano"
CREATE OR REPLACE FUNCTION privado.fila_extras(p_inst bigint, p_cliente bigint)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'motivo', privado.cruce_motivo(i.id),
    'por_subir', coalesce(privado.archivos_por_subir(p_cliente), false), 'aprobado_por_subir', coalesce(privado.aprobado_por_subir(p_cliente), false),
    'bienvenida_en', (select max(e.en) from public.envios e where e.tipo = 'bienvenida' and (e.instalacion_id = i.id or (i.servicio_id is not null and e.servicio_id = i.servicio_id))),
    'sin_ip', (i.servicio_id is not null and not exists (select 1 from public.servicios s where s.id = i.servicio_id and (s.ip is not null or s.ip6 is not null))),
    'servicio_id', i.servicio_id, 'es_evento', i.es_evento,
    'movida', i.corte_manual is not null, 'movida_motivo', i.corte_manual_motivo)
  from public.instalaciones i where i.id = p_inst
$function$;

-- Ficha: el corte de cada instalación respeta el cambio a mano
select privado.reemplazar_en_funcion('public.cliente_ficha(bigint)'::regprocedure,
  'cross join lateral (select privado.corte_de((i.instalada_en at time zone ''America/Caracas'')::date) as cp,',
  'cross join lateral (select coalesce(i.corte_manual, privado.corte_de((i.instalada_en at time zone ''America/Caracas'')::date)) as cp,');
select privado.reemplazar_en_funcion('public.cliente_ficha(bigint)'::regprocedure,
  '''excepcion_corte'', i.excepcion_corte, ''excepcion_motivo'', i.excepcion_motivo,',
  '''excepcion_corte'', i.excepcion_corte, ''excepcion_motivo'', i.excepcion_motivo, ''movida'', i.corte_manual is not null, ''movida_motivo'', i.corte_manual_motivo, ''corte_natural'', privado.corte_de((i.instalada_en at time zone ''America/Caracas'')::date),');

-- Cambiar de corte: entre el corte en curso y el siguiente, nunca desde ni hacia uno cerrado
create or replace function public.instalacion_mover_corte(p_instalacion bigint, p_corte date, p_motivo text) returns jsonb
language plpgsql security definer set search_path to '' as $$
#variable_conflict use_variable
declare v_yo uuid := privado.exigir_senior(); i public.instalaciones; nat date; ef date; dest date := date_trunc('month', p_corte::timestamp)::date;
  act date := privado.corte_en_curso(); sig date := greatest(privado.corte_de(privado.hoy()), privado.corte_en_curso()); m text := btrim(coalesce(p_motivo, ''));
begin
  select * into i from public.instalaciones x where x.id = p_instalacion;
  if i.id is null or i.anulada_en is not null then raise exception 'No se encontró la instalación' using errcode = 'P0001'; end if;
  if length(m) < 5 then raise exception 'Escribe el motivo' using errcode = 'P0001'; end if;
  nat := privado.corte_de((i.instalada_en at time zone 'America/Caracas')::date); ef := coalesce(i.corte_manual, nat);
  if dest is null or dest not in (act, sig) then raise exception 'Solo se puede pasar al corte en curso o al siguiente' using errcode = 'P0001'; end if;
  if privado.corte_cerrado(ef) then raise exception 'Está en un corte cerrado: no se mueve' using errcode = 'P0001'; end if;
  if privado.corte_cerrado(dest) then raise exception 'Ese corte ya está cerrado' using errcode = 'P0001'; end if;
  if dest = ef then raise exception 'Ya está en ese corte' using errcode = 'P0001'; end if;
  update public.instalaciones x set corte_manual = case when dest = nat then null else dest end,
    corte_manual_motivo = case when dest = nat then null else left(m, 500) end, corte_manual_por = v_yo, corte_manual_en = now()
  where x.id = i.id;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues)
  values (v_yo, 'instalacion_corte_movida', 'instalaciones', i.id::text, jsonb_build_object('corte', ef), jsonb_build_object('corte', dest, 'motivo', left(m, 500)));
  return jsonb_build_object('corte', dest, 'movida', dest <> nat);
end $$;
revoke all on function public.instalacion_mover_corte(bigint, date, text) from public, anon;
grant execute on function public.instalacion_mover_corte(bigint, date, text) to authenticated;
