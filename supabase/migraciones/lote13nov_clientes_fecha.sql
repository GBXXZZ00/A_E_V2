-- Lote 13/11, parte 6: Clientes con filtro de fecha. clientes_lista3 recibe en p_f "fecha": {de, desde, hasta}.
--   de: entro (entró a la app), estatus (cambió de estatus), firmo (firmó el contrato), vence (vence el contrato).
--   Conteos, tarjetas y facetas respetan la fecha. Sin "fecha" todo queda igual que antes.
CREATE OR REPLACE FUNCTION public.clientes_lista3(p_filtro text DEFAULT 'todos'::text, p_busca text DEFAULT ''::text, p_limite integer DEFAULT 20, p_desde integer DEFAULT 0, p_f jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare rol text := privado.exigir('admin', 'abogado', 'analista', 'lider'); yo uuid := (select auth.uid());
  b text := replace(replace(privado.norm(p_busca), '%', ''), '_', ' ');
  bd text := regexp_replace(coalesce(p_busca, ''), '\D', '', 'g');
  ini timestamptz := privado.corte_cierre((privado.corte_en_curso() - interval '1 month')::date);
  ini_ant timestamptz := privado.corte_cierre((privado.corte_en_curso() - interval '2 month')::date);
  lim int := least(greatest(coalesce(p_limite, 20), 1), 60); des int := greatest(coalesce(p_desde, 0), 0); r jsonb; hoy date := privado.hoy();
  f_tipo text[] := array(select jsonb_array_elements_text(coalesce(p_f->'tipo', '[]'))); f_est text[] := array(select jsonb_array_elements_text(coalesce(p_f->'estatus', '[]')));
  f_lid text[] := array(select jsonb_array_elements_text(coalesce(p_f->'lider', '[]'))); f_ges text[] := array(select jsonb_array_elements_text(coalesce(p_f->'gestion', '[]')));
  f_ctr text[] := array(select jsonb_array_elements_text(coalesce(p_f->'ctr', '[]'))); f_vgt text[] := array(select jsonb_array_elements_text(coalesce(p_f->'vgt', '[]')));
  sus boolean := coalesce(p_f->'otros', '[]') ? 'suspendidos';
  fd text := case when p_f->'fecha'->>'de' in ('entro', 'estatus', 'firmo', 'vence') then p_f->'fecha'->>'de' end;
  fdes date; fhas date;
begin
  if length(bd) < 4 then bd := ''; end if;
  begin fdes := nullif(p_f->'fecha'->>'desde', '')::date; fhas := nullif(p_f->'fecha'->>'hasta', '')::date;
  exception when others then raise exception 'La fecha no es válida' using errcode = 'P0001'; end;
  if fd is not null and fdes is not null and fhas is not null and fdes > fhas then raise exception 'La fecha Desde va antes que Hasta' using errcode = 'P0001'; end if;
  with todos as (
    select c.* from public.clientes c
    where c.unido_a is null and (rol in ('admin', 'abogado', 'analista') or (rol = 'lider' and (c.lider_id = yo
      or exists (select 1 from public.dedicados dd where dd.cliente_id = c.id and dd.ejecutiva_id = yo))))
  ), base0 as (
    select c.*, t.pyme as t_pyme, t.ded as t_ded, privado.casillas_vacias(c.id) as vac,
      (not exists (select 1 from public.servicios s where s.cliente_id = c.id) and not exists (select 1 from public.dedicados dd where dd.cliente_id = c.id)
       and not exists (select 1 from public.instalaciones i where i.cliente_id = c.id)) as pinst,
      exists (select 1 from public.instalaciones i where i.cliente_id = c.id and privado.comisionable(i.categoria, i.es_aliado)
              and i.instalada_en >= ini_ant and i.instalada_en < ini and (c.legal_ok_en is null or i.pago_ok_en is null)) as ultimo,
      exists (select 1 from public.dedicado_contratos k where k.cliente_id = c.id and k.tipo = 'vgt') as vgt,
      (select min(d2.vence_en) from public.documentos d2 where d2.cliente_id = c.id and d2.casilla = 'otro' and d2.numero in (66, 67) and d2.estado <> 'devuelto') as pol,
      coalesce(privado.nombre_de(c.lider_id), c.lider_nombre, 'Sin líder') as lnom,
      case when t.pyme and t.ded is not null then 'combinado' when t.ded = 'corporativo' then 'dedicado' when t.ded = 'isp' then 'isp' else 'pyme' end as tip,
      privado.contrato_pendiente(c.id) as ctrp,
      (select array_agg(gc.gestion_id::text || ':' || case when privado.gestion_meta_ok(g.meta, gc.cliente_id) then 'cumplido' else gc.estado end)
         from public.gestion_clientes gc join public.gestiones g on g.id = gc.gestion_id where gc.cliente_id = c.id and g.estado = 'activa') as ges,
      -- Lote 13/11: la fecha que se filtra
      case fd when 'entro' then (c.creado_en at time zone 'America/Caracas')::date
        when 'estatus' then (c.estatus_desde at time zone 'America/Caracas')::date
        when 'firmo' then coalesce((select max(k.firmado_en) from public.dedicado_contratos k where k.cliente_id = c.id),
                                   (select max(d3.firmado_en) from public.documentos d3 where d3.cliente_id = c.id and d3.casilla in ('contrato_pyme', 'contrato_dedicado')),
                                   case when c.estatus = 'contrato_firmado' then (c.estatus_desde at time zone 'America/Caracas')::date end)
        when 'vence' then least((select min(k.vence_en) from public.dedicado_contratos k where k.cliente_id = c.id and k.vence_en is not null),
                                (select min(d3.vence_en) from public.documentos d3 where d3.cliente_id = c.id and d3.casilla in ('contrato_pyme', 'contrato_dedicado') and d3.vence_en is not null))
      end as fch
    from todos c join privado.tarjetas_todas() t on t.cliente_id = c.id
    where (c.suspendido_en is not null) = sus
  ), base1 as (
    select v.*,
      case when v.t_ded is null then null else array_remove(array[
        case when not exists (select 1 from public.dedicado_contratos k where k.cliente_id = v.id and k.tipo = 'servicio' and k.estatus <> 'sin_contrato') then 'sin_contrato' end,
        case when exists (select 1 from public.dedicado_contratos k where k.cliente_id = v.id and k.estatus = 'por_firmar') then 'por_firmar' end,
        case when exists (select 1 from public.dedicado_contratos k where k.cliente_id = v.id and k.estatus = 'actualizar') then 'por_actualizar' end,
        case when v.ctrp = 'sin_archivo' then 'firmado_sin_archivo' end,
        case when v.ctrp = 'sin_vence' then 'sin_vence' end,
        case when exists (select 1 from public.dedicado_contratos k where k.cliente_id = v.id and k.estatus = 'firmado' and k.vence_en between hoy and hoy + 60) then 'vence_60' end], null) end as ctrs,
      array_remove(array[case when v.vgt then 'con' end,
        case when exists (select 1 from public.dedicado_contratos k where k.cliente_id = v.id and k.tipo = 'vgt' and k.estatus <> 'firmado') then 'por_firmar' end,
        case when v.vgt and privado.vgt_faltan(v.id) > 0 then 'incompletos' end], null) as vgts
    from base0 v
  ), base as (
    select v.*,
      (cardinality(f_tipo) = 0 or v.tip = any (f_tipo)) as p_tipo,
      (cardinality(f_est) = 0 or v.estatus = any (f_est)) as p_est,
      (cardinality(f_lid) = 0 or v.lnom = any (f_lid)) as p_lid,
      (cardinality(f_ges) = 0 or exists (select 1 from unnest(coalesce(v.ges, '{}')) x where x = any (f_ges) or split_part(x, ':', 1) = any (f_ges))) as p_ges,
      (cardinality(f_ctr) = 0 or coalesce(v.ctrs && f_ctr, false)) as p_ctr,
      (cardinality(f_vgt) = 0 or v.vgts && f_vgt) as p_vgt,
      (fd is null or (v.fch is not null and (fdes is null or v.fch >= fdes) and (fhas is null or v.fch <= fhas))) as p_fec
    from base1 v
  ), pasa as (
    select v.* from base v where v.p_tipo and v.p_est and v.p_lid and v.p_ges and v.p_ctr and v.p_vgt and v.p_fec
  ), sel as (
    select v.* from pasa v
    where (b <> '' or bd <> '' or coalesce(p_f->>'tarjeta', '') = '' or (p_f->>'tarjeta' = 'pyme' and v.t_pyme) or v.t_ded = p_f->>'tarjeta')
      and case when b <> '' or bd <> '' then
        (b <> '' and privado.norm(v.nombre) like '%' || b || '%')
        or (bd <> '' and (v.doc_numero like '%' || bd || '%'
            or exists (select 1 from public.servicios s where s.cliente_id = v.id
                 and (regexp_replace(s.sucursal || s.codigo, '\D', '', 'g') like '%' || bd || '%' or regexp_replace(coalesce(s.telefono, ''), '\D', '', 'g') like '%' || bd || '%'))
            or exists (select 1 from public.representantes rp where rp.cliente_id = v.id and regexp_replace(coalesce(rp.telefono, ''), '\D', '', 'g') like '%' || bd || '%')
            or regexp_replace(coalesce(v.telefono, ''), '\D', '', 'g') like '%' || bd || '%'))
      else case coalesce(p_filtro, 'todos')
        when 'en_curso' then v.estatus <> 'contrato_firmado' and not v.pinst
        when 'por_revisar' then v.estatus = 'documentos_en_revision'
        when 'por_instalar' then v.pinst
        when 'sin_gestion' then v.estatus in ('grandes_negocios', 'documentos_solicitados', 'documentos_pendientes') and not v.pinst
             and coalesce(v.ultima_gestion_en, v.creado_en) < now() - interval '3 days'
        when 'faltan' then v.vac > 0
        when 'devueltos' then exists (select 1 from public.documentos d where d.cliente_id = v.id and d.estado = 'devuelto')
        when 'ultimo_corte' then v.ultimo
        when 'por_firmar' then v.estatus in ('contrato_en_curso', 'por_firmar')
        when 'firmados' then v.estatus = 'contrato_firmado'
        when 'por_subir' then privado.archivos_por_subir(v.id)
        when 'vgt' then v.vgt
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
        'faltan', count(*) filter (where v.vac > 0),
        'por_firmar', count(*) filter (where v.estatus in ('contrato_en_curso', 'por_firmar')),
        'firmados', count(*) filter (where v.estatus = 'contrato_firmado'),
        'por_subir', count(*) filter (where privado.archivos_por_subir(v.id)),
        'vgt', count(*) filter (where v.vgt),
        'todos', count(*)) from pasa v where coalesce(p_f->>'tarjeta', '') = '' or (p_f->>'tarjeta' = 'pyme' and v.t_pyme) or v.t_ded = p_f->>'tarjeta'),
    -- Contadores de cada opción con los demás grupos aplicados (y la fecha)
    'facetas', jsonb_build_object(
      'tipo', (select coalesce(jsonb_object_agg(x.k, x.n), '{}'::jsonb) from (select v.tip k, count(*) n from base v where v.p_est and v.p_lid and v.p_ges and v.p_ctr and v.p_vgt and v.p_fec group by 1) x),
      'estatus', (select coalesce(jsonb_object_agg(x.k, x.n), '{}'::jsonb) from (select v.estatus k, count(*) n from base v where v.p_tipo and v.p_lid and v.p_ges and v.p_ctr and v.p_vgt and v.p_fec group by 1) x),
      'lider', (select coalesce(jsonb_object_agg(x.k, x.n), '{}'::jsonb) from (select v.lnom k, count(*) n from base v where v.p_tipo and v.p_est and v.p_ges and v.p_ctr and v.p_vgt and v.p_fec group by 1) x),
      'gestion', (select coalesce(jsonb_object_agg(x.k, x.n), '{}'::jsonb) from (select y k, count(*) n from base v cross join unnest(coalesce(v.ges, '{}') || array(select split_part(z, ':', 1) from unnest(coalesce(v.ges, '{}')) z)) y
                   where v.p_tipo and v.p_est and v.p_lid and v.p_ctr and v.p_vgt and v.p_fec group by 1) x),
      'ctr', (select coalesce(jsonb_object_agg(x.k, x.n), '{}'::jsonb) from (select y k, count(*) n from base v cross join unnest(coalesce(v.ctrs, '{}')) y where v.p_tipo and v.p_est and v.p_lid and v.p_ges and v.p_vgt and v.p_fec group by 1) x),
      'vgt', (select coalesce(jsonb_object_agg(x.k, x.n), '{}'::jsonb) from (select y k, count(*) n from base v cross join unnest(v.vgts) y where v.p_tipo and v.p_est and v.p_lid and v.p_ges and v.p_ctr and v.p_fec group by 1) x)),
    'suspendidos', (select count(*) from todos c where c.suspendido_en is not null),
    'tarjetas', (select jsonb_build_object('pyme', count(*) filter (where v.t_pyme), 'corporativo', count(*) filter (where v.t_ded = 'corporativo'), 'isp', count(*) filter (where v.t_ded = 'isp')) from pasa v),
    'gestiones', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'nombre', g.nombre) order by g.plazo) from public.gestiones g where g.estado = 'activa'), '[]'::jsonb),
    'total', (select count(*) from sel),
    'desde', des, 'rol', rol, 'hoy', hoy,
    'filas', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'nombre', p.nombre, 'doc_tipo', p.doc_tipo, 'doc_numero', p.doc_numero, 'es_natural', p.es_natural,
        'seg', privado.segmento(p.id), 'ded', p.t_ded, 'combinado', p.t_ded is not null and p.t_pyme, 'estatus', p.estatus, 'estatus_desde', p.estatus_desde,
        'lider', p.lnom, 'ug_en', p.ultima_gestion_en, 'ug_por', coalesce(privado.nombre_de(p.ultima_gestion_por), p.ultima_gestion_nombre),
        'creado_en', p.creado_en, 'es_top', p.es_top, 'provisional', p.provisional, 'ultimo_corte', p.ultimo, 'por_instalar', p.pinst,
        'vgt', p.vgt, 'poliza_vence', p.pol, 'suspendido', p.suspendido_en is not null, 'no_aparece_tad', p.no_aparece_tad_en is not null, 'sin_tad', privado.ded_sin_tad(p.id),
        'ges', p.ges, 'ctr', p.ctrp,
        'etq', (select jsonb_build_object('e', g0.etiqueta, 'fecha', g0.fecha, 'nota', g0.nota) from public.cliente_gestion g0 where g0.cliente_id = p.id order by g0.en desc, g0.id desc limit 1),
        'n_serv', (select count(*) from public.servicios s where s.cliente_id = p.id),
        'n_enl', (select count(*) from public.dedicado_enlaces e where e.cliente_id = p.id and e.activo),
        'serv', (select jsonb_build_object('codigo', s.codigo, 'sucursal', s.sucursal, 'plan', s.plan, 'categoria', s.categoria, 'estado', s.estado, 'telefono', s.telefono)
                 from public.servicios s where s.cliente_id = p.id order by s.fecha_instalacion desc nulls last, s.id desc limit 1),
        'tel', coalesce((select nullif(btrim(rp.telefono), '') from public.representantes rp where rp.cliente_id = p.id and rp.orden = 1), nullif(btrim(p.telefono), ''),
                 (select nullif(btrim(s.telefono), '') from public.servicios s where s.cliente_id = p.id and nullif(btrim(s.telefono), '') is not null order by s.id desc limit 1)),
        'correo', coalesce((select nullif(btrim(rp.correo), '') from public.representantes rp where rp.cliente_id = p.id and rp.orden = 1), nullif(btrim(p.correo_empresa), '')),
        'falta', privado.faltantes(p.id),
        'por_revisar', (select count(*) from public.documentos d where d.cliente_id = p.id and d.estado = 'por_revisar'),
        'por_subir', privado.archivos_por_subir(p.id), 'aprobado_por_subir', privado.aprobado_por_subir(p.id),
        'fecha', p.fch
      ) order by p.pos), '[]'::jsonb) from pag p)
  ) into r;
  return r;
end $function$;
