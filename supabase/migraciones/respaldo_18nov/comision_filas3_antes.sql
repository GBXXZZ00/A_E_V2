-- Respaldo de privado.comision_filas3 antes del lote 16/11 B (18/11/2026): la versión del 17/11 (arrastre con certificado).
CREATE OR REPLACE FUNCTION privado.comision_filas3(p_corte date)
 RETURNS TABLE(instalacion_id bigint, cliente_id bigint, nombre text, doc text, instalada_en timestamp with time zone, lider_id uuid, lider text, origen text, legal_ok boolean, pago_ok boolean, cumple boolean, estatus text, codigo text, sucursal text, revisar_pago boolean, orden_ok boolean, orden text, cruce text, orden_creador text, es_natural boolean, orden_id bigint, orden_titulo text, instalador text, excepcion boolean, excepcion_motivo text, dueno_manual boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
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
      (privado.revisar_pago(i.id) is not null) as rev,
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
  -- 17/11: lo que en la foto del corte anterior certificado salió "cumple" ya cobró: no se arrastra al corte
  -- siguiente aunque después le devuelvan un documento (no se paga dos veces). Fuera de eso, la regla de antes.
  where del_corte or (pcer and (not (coalesce(leg < lants and pag < lants, false) or coalesce(exc < p_corte, false)) or not ook)
    and not exists (select 1 from public.cortes_certificados k, jsonb_array_elements(k.filas) e
      where k.corte = (p_corte - interval '1 month')::date and (e->>'instalacion_id')::bigint = base.id
        and coalesce((e->>'cumple')::boolean, false)))
$function$;
