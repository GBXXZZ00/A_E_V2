-- Lote 21/10, tanda B parte 3: lista de Clientes (migración lote_21oct_clientes_lista).
-- "Todos" por defecto; filtros Segmento, Líder, Estatus legal, VGT (con, por firmar, requisitos incompletos), Sucursal y Estado del servicio;
-- suspendidos fuera de la lista y de los contadores (filtro suspendidos = '1' los muestra solos); etiqueta de gestión (última) con su cuenta y filtro;
-- contrato firmado sin archivo o sin vencimiento en la fila.
create or replace function public.clientes_lista2(p_filtro text default 'todos'::text, p_busca text default ''::text, p_limite integer default 20, p_desde integer default 0, p_filtros jsonb default '{}'::jsonb)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare rol text := privado.exigir('admin', 'abogado', 'analista', 'lider'); yo uuid := (select auth.uid());
  b text := replace(replace(privado.norm(p_busca), '%', ''), '_', ' ');
  bd text := regexp_replace(coalesce(p_busca, ''), '\D', '', 'g');
  ini timestamptz := privado.corte_cierre((privado.corte_en_curso() - interval '1 month')::date);
  ini_ant timestamptz := privado.corte_cierre((privado.corte_en_curso() - interval '2 month')::date);
  lim int := least(greatest(coalesce(p_limite, 20), 1), 60); des int := greatest(coalesce(p_desde, 0), 0); r jsonb;
  tj text := coalesce(p_filtros->>'tarjeta', '');
  sg text := coalesce(p_filtros->>'segmento', ''); vg text := coalesce(p_filtros->>'vgt', ''); ge text := coalesce(p_filtros->>'gestion', '');
  sus boolean := coalesce(p_filtros->>'suspendidos', '') = '1'; hoy date := privado.hoy();
begin
  if length(bd) < 4 then bd := ''; end if;
  if tj not in ('', 'pyme', 'corporativo', 'isp') then tj := ''; end if;
  with todos as (
    select c.* from public.clientes c
    where c.unido_a is null and (rol in ('admin', 'abogado', 'analista') or (rol = 'lider' and (c.lider_id = yo
      or exists (select 1 from public.dedicados dd where dd.cliente_id = c.id and dd.ejecutiva_id = yo))))
  ), mios as (
    select c.* from todos c where (c.suspendido_en is not null) = sus
  ), base0 as (
    select c.*, t.pyme as t_pyme, t.ded as t_ded, privado.casillas_vacias(c.id) as vac,
      (not exists (select 1 from public.servicios s where s.cliente_id = c.id) and not exists (select 1 from public.dedicados dd where dd.cliente_id = c.id)
       and not exists (select 1 from public.instalaciones i where i.cliente_id = c.id)) as pinst,
      exists (select 1 from public.instalaciones i where i.cliente_id = c.id and privado.comisionable(i.categoria, i.es_aliado)
              and i.instalada_en >= ini_ant and i.instalada_en < ini and (c.legal_ok_en is null or i.pago_ok_en is null)) as ultimo,
      exists (select 1 from public.dedicado_contratos k where k.cliente_id = c.id and k.tipo = 'vgt') as vgt,
      (select min(d2.vence_en) from public.documentos d2 where d2.cliente_id = c.id and d2.casilla = 'otro' and d2.numero in (66, 67) and d2.estado <> 'devuelto') as pol,
      g.etiqueta as etq, g.fecha as etq_fecha, g.nota as etq_nota
    from mios c join privado.tarjetas_todas() t on t.cliente_id = c.id
    left join lateral (select g0.etiqueta, g0.fecha, g0.nota from public.cliente_gestion g0 where g0.cliente_id = c.id order by g0.en desc, g0.id desc limit 1) g on true
    where (coalesce(p_filtros->>'lider','') = '' or coalesce(privado.nombre_de(c.lider_id), c.lider_nombre, 'Sin líder') = p_filtros->>'lider')
      and (coalesce(p_filtros->>'estatus','') = '' or c.estatus = p_filtros->>'estatus')
      and (coalesce(p_filtros->>'sucursal','') = '' or exists (select 1 from public.servicios s where s.cliente_id = c.id and s.sucursal = p_filtros->>'sucursal'))
      and (coalesce(p_filtros->>'servicio','') = '' or exists (select 1 from public.servicios s where s.cliente_id = c.id and privado.norm(s.estado) = privado.norm(p_filtros->>'servicio')))
      and (vg = '' or (vg = 'con' and exists (select 1 from public.dedicado_contratos k where k.cliente_id = c.id and k.tipo = 'vgt'))
           or (vg = 'por_firmar' and exists (select 1 from public.dedicado_contratos k where k.cliente_id = c.id and k.tipo = 'vgt' and k.estatus <> 'firmado'))
           or (vg = 'incompletos' and privado.vgt_faltan(c.id) > 0))
  ), base as (
    select v.* from base0 v
    where (sg = '' or (sg = 'pyme' and v.t_pyme and v.t_ded is null) or (sg = 'dedicado' and v.t_ded = 'corporativo' and not v.t_pyme)
           or (sg = 'isp' and v.t_ded = 'isp' and not v.t_pyme) or (sg = 'combinado' and v.t_pyme and v.t_ded is not null))
  ), vis as (
    select v.* from base v where tj = '' or (tj = 'pyme' and v.t_pyme) or v.t_ded = tj
  ), sel as (
    select v.* from base v
    where (b <> '' or bd <> '' or tj = '' or (tj = 'pyme' and v.t_pyme) or v.t_ded = tj)
      and (ge = '' or b <> '' or bd <> '' or v.etq = ge)
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
    'tarjetas', (select jsonb_build_object('pyme', count(*) filter (where v.t_pyme), 'corporativo', count(*) filter (where v.t_ded = 'corporativo'),
        'isp', count(*) filter (where v.t_ded = 'isp')) from base v),
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
        'todos', count(*)) from vis v),
    'gestion', (select jsonb_build_object('contactado', count(*) filter (where v.etq = 'contactado'), 'sin_contacto', count(*) filter (where v.etq = 'sin_contacto'),
        'esperando', count(*) filter (where v.etq = 'esperando')) from vis v),
    'suspendidos', (select count(*) from todos c where c.suspendido_en is not null),
    'total', (select count(*) from sel),
    'opciones', jsonb_build_object(
      'lider', (select coalesce(jsonb_agg(x order by x), '[]'::jsonb) from (select distinct coalesce(privado.nombre_de(c.lider_id), c.lider_nombre, 'Sin líder') x from todos c) q),
      'sucursal', (select coalesce(jsonb_agg(x order by x), '[]'::jsonb) from (select distinct s.sucursal x from public.servicios s join todos c on c.id = s.cliente_id) q),
      'servicio', (select coalesce(jsonb_agg(x order by x), '[]'::jsonb) from (select distinct initcap(privado.norm(s.estado)) x from public.servicios s join todos c on c.id = s.cliente_id
                where nullif(btrim(s.estado), '') is not null) q)),
    'desde', des, 'rol', rol, 'hoy', hoy,
    'filas', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'nombre', p.nombre, 'doc_tipo', p.doc_tipo, 'doc_numero', p.doc_numero, 'es_natural', p.es_natural,
        'seg', privado.segmento(p.id), 'ded', p.t_ded, 'combinado', p.t_ded is not null and p.t_pyme, 'estatus', p.estatus, 'estatus_desde', p.estatus_desde,
        'lider', coalesce(privado.nombre_de(p.lider_id), p.lider_nombre),
        'ug_en', p.ultima_gestion_en, 'ug_por', coalesce(privado.nombre_de(p.ultima_gestion_por), p.ultima_gestion_nombre),
        'creado_en', p.creado_en, 'es_top', p.es_top, 'provisional', p.provisional, 'ultimo_corte', p.ultimo, 'por_instalar', p.pinst,
        'vgt', p.vgt, 'poliza_vence', p.pol, 'suspendido', p.suspendido_en is not null,
        'etq', case when p.etq is not null then jsonb_build_object('e', p.etq, 'fecha', p.etq_fecha, 'nota', p.etq_nota) end,
        'ctr', privado.contrato_pendiente(p.id),
        'n_serv', (select count(*) from public.servicios s where s.cliente_id = p.id),
        'n_enl', (select count(*) from public.dedicado_enlaces e where e.cliente_id = p.id and e.activo),
        'serv', (select jsonb_build_object('codigo', s.codigo, 'sucursal', s.sucursal, 'plan', s.plan, 'categoria', s.categoria, 'estado', s.estado, 'telefono', s.telefono)
                 from public.servicios s where s.cliente_id = p.id order by s.fecha_instalacion desc nulls last, s.id desc limit 1),
        'tel', coalesce((select nullif(btrim(rp.telefono), '') from public.representantes rp where rp.cliente_id = p.id and rp.orden = 1), nullif(btrim(p.telefono), ''),
                 (select nullif(btrim(s.telefono), '') from public.servicios s where s.cliente_id = p.id and nullif(btrim(s.telefono), '') is not null order by s.id desc limit 1)),
        'correo', coalesce((select nullif(btrim(rp.correo), '') from public.representantes rp where rp.cliente_id = p.id and rp.orden = 1), nullif(btrim(p.correo_empresa), '')),
        'falta', privado.faltantes(p.id),
        'por_revisar', (select count(*) from public.documentos d where d.cliente_id = p.id and d.estado = 'por_revisar'),
        'por_subir', privado.archivos_por_subir(p.id), 'aprobado_por_subir', privado.aprobado_por_subir(p.id)
      ) order by p.pos), '[]'::jsonb) from pag p)
  ) into r;
  return r;
end $function$;
