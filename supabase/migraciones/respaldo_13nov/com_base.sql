CREATE OR REPLACE FUNCTION privado.com_base(c date)
 RETURNS TABLE(instalacion_id bigint, cliente_id bigint, nombre text, doc text, instalada_en timestamp with time zone, dueno_id uuid, dueno text, equipo text, origen text, cumple boolean, legal_ok boolean, pago_ok boolean, orden_id bigint, orden text, migracion boolean, servicio_id bigint, estatus text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select f.instalacion_id, f.cliente_id, f.nombre, f.doc, f.instalada_en, d.id, coalesce(privado.nombre_de(d.id), f.lider),
    case when f.lider = 'Por asignar' then 'sin_dueno' else coalesce(privado.equipo_de(d.id), 'corporativas') end,
    f.origen, f.cumple, f.legal_ok, f.pago_ok, f.orden_id, f.orden, i.cambio_id is not null, i.servicio_id, f.estatus
  from privado.comision_filas3(c) f join public.instalaciones i on i.id = f.instalacion_id
  cross join lateral (select coalesce(f.lider_id, case when f.lider <> 'Por asignar' then privado.perfil_por_nombre(f.lider) end) id) d
  union all
  select i.id, i.cliente_id, coalesce(cl.nombre, i.nombre), case when cl.id is not null then cl.doc_tipo || '-' || cl.doc_numero else i.doc_numero end, i.instalada_en, null::uuid,
    coalesce(nullif(btrim(i.instalador), ''), 'Aliado'), 'aliados', 'corte', false, coalesce(cl.legal_ok_en is not null, false), i.pago_ok_en is not null, i.orden_id, o.numero, false, i.servicio_id, coalesce(cl.estatus, 'grandes_negocios')
  from public.instalaciones i left join public.clientes cl on cl.id = i.cliente_id left join public.ordenes_odoo o on o.id = i.orden_id
  where i.es_aliado and i.anulada_en is null and privado.norm(i.categoria) !~ '(dedicad|conectiv)'
    and i.instalada_en >= privado.corte_abre(c) and i.instalada_en < privado.corte_cierre(c) $function$
;
