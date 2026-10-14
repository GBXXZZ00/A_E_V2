-- Corrida urgente 14/10, parte 2: Clientes y Dedicados en una sola lista. Aplicado con el conector como migración "clientes_dedicados".
-- 1) El líder ve sus clientes sean PYME, dedicados o combinados: además de clientes.lider_id cuenta la ejecutiva del dedicado.
--    No depende de la marca "Ejecutiva de dedicados" (perfiles.dedicados queda sin uso).
-- 2) privado.tarjetas_todas(): a qué tarjetas va cada cliente (PYME, Dedicado corporativo, Dedicado ISP); un combinado va a dos.
-- 3) clientes_lista2: filtros nuevos (tarjeta, vgt, enlaces), atajo "faltan" (Faltan documentos), conteo por tarjeta y etiqueta de combinado.
-- 4) dedicados_lista: datos de operación (capacidad, contratos con vencimiento, VGT con proyectos y postes, pólizas).

create or replace function privado.puede_cliente(p bigint) returns boolean
language sql stable security definer set search_path to '' as $f$
  select case (select privado.rol_actual())
    when 'admin' then true when 'abogado' then true when 'analista' then true
    when 'lider' then exists (select 1 from public.clientes c where c.id = p and c.lider_id = (select auth.uid()))
                   or exists (select 1 from public.dedicados d where d.cliente_id = p and d.ejecutiva_id = (select auth.uid()))
    when 'aliado' then exists (select 1 from public.aliado_solicitudes s where s.cliente_id = p and s.aliado_id = (select privado.mi_aliado())
      and s.etiqueta in ('borrador', 'analizando', 'recaudos', 'excepcion', 'revision', 'lista', 'listaobs', 'curso', 'instalada'))
    else false end
$f$;

create or replace function privado.tarjetas_todas() returns table(cliente_id bigint, pyme boolean, ded text)
language sql stable security definer set search_path to '' as $f$
  select c.id, (not x.ded) or x.pyme, case when x.ded then case when c.es_isp or d.tipo = 'isp' then 'isp' else 'corporativo' end end
  from public.clientes c
  left join public.dedicados d on d.cliente_id = c.id
  left join (select s.cliente_id, bool_or(privado.norm(s.categoria) ~ '(dedicad|conectiv)') ded, bool_or(privado.norm(s.categoria) !~ '(dedicad|conectiv)') pyme
             from public.servicios s group by s.cliente_id) v on v.cliente_id = c.id
  cross join lateral (select coalesce(v.ded, false) or d.cliente_id is not null as ded, coalesce(v.pyme, false) as pyme) x
$f$;
revoke all on function privado.tarjetas_todas() from public, anon, authenticated;

create or replace function public.clientes_lista2(p_filtro text default 'en_curso', p_busca text default '', p_limite integer default 20, p_desde integer default 0, p_filtros jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path to '' as $f$
declare rol text := privado.exigir('admin', 'abogado', 'analista', 'lider'); yo uuid := (select auth.uid());
  b text := replace(replace(privado.norm(p_busca), '%', ''), '_', ' ');
  bd text := regexp_replace(coalesce(p_busca, ''), '\D', '', 'g');
  ini timestamptz := privado.corte_cierre((privado.corte_en_curso() - interval '1 month')::date);
  ini_ant timestamptz := privado.corte_cierre((privado.corte_en_curso() - interval '2 month')::date);
  lim int := least(greatest(coalesce(p_limite, 20), 1), 60); des int := greatest(coalesce(p_desde, 0), 0); r jsonb;
  tj text := coalesce(p_filtros->>'tarjeta', '');
begin
  if length(bd) < 4 then bd := ''; end if;
  if tj not in ('', 'pyme', 'corporativo', 'isp') then tj := ''; end if;
  with mios as (
    -- Lo que ve cada quien: el líder, sus clientes y los dedicados de los que es la ejecutiva
    select c.* from public.clientes c
    where c.unido_a is null and (rol in ('admin', 'abogado', 'analista') or (rol = 'lider' and (c.lider_id = yo
      or exists (select 1 from public.dedicados dd where dd.cliente_id = c.id and dd.ejecutiva_id = yo))))
  ), base as (
    select c.*, t.pyme as t_pyme, t.ded as t_ded, privado.casillas_vacias(c.id) as vac,
      (not exists (select 1 from public.servicios s where s.cliente_id = c.id) and not exists (select 1 from public.dedicados dd where dd.cliente_id = c.id)
       and not exists (select 1 from public.instalaciones i where i.cliente_id = c.id)) as pinst,
      exists (select 1 from public.instalaciones i where i.cliente_id = c.id and privado.comisionable(i.categoria, i.es_aliado)
              and i.instalada_en >= ini_ant and i.instalada_en < ini and (c.legal_ok_en is null or i.pago_ok_en is null)) as ultimo
    from mios c join privado.tarjetas_todas() t on t.cliente_id = c.id
    where (coalesce(p_filtros->>'lider','') = '' or coalesce(privado.nombre_de(c.lider_id), c.lider_nombre, 'Sin líder') = p_filtros->>'lider')
      and (coalesce(p_filtros->>'estatus','') = '' or c.estatus = p_filtros->>'estatus')
      and (coalesce(p_filtros->>'tipo','') = '' or privado.segmento_filtro(c.id) = p_filtros->>'tipo')
      and (coalesce(p_filtros->>'sucursal','') = '' or exists (select 1 from public.servicios s where s.cliente_id = c.id and s.sucursal = p_filtros->>'sucursal'))
      and (coalesce(p_filtros->>'servicio','') = '' or exists (select 1 from public.servicios s where s.cliente_id = c.id and privado.norm(s.estado) = privado.norm(p_filtros->>'servicio')))
      and (coalesce(p_filtros->>'vgt','') = '' or (p_filtros->>'vgt' = 'con' and exists (select 1 from public.dedicado_contratos k where k.cliente_id = c.id and k.tipo = 'vgt'))
           or (p_filtros->>'vgt' = 'por_firmar' and exists (select 1 from public.dedicado_contratos k where k.cliente_id = c.id and k.tipo = 'vgt' and k.estatus <> 'firmado')))
      and (coalesce(p_filtros->>'enlaces','') = '' or (p_filtros->>'enlaces' = 'activos') = exists (select 1 from public.dedicado_enlaces e where e.cliente_id = c.id and e.activo))
  ), vis as (
    select v.* from base v where tj = '' or (tj = 'pyme' and v.t_pyme) or v.t_ded = tj
  ), sel as (
    -- Buscar encuentra al cliente aunque esté en otra tarjeta
    select v.* from base v
    where (b <> '' or bd <> '' or tj = '' or (tj = 'pyme' and v.t_pyme) or v.t_ded = tj) and case when b <> '' or bd <> '' then
        (b <> '' and privado.norm(v.nombre) like '%' || b || '%')
        or (bd <> '' and (v.doc_numero like '%' || bd || '%'
            or exists (select 1 from public.servicios s where s.cliente_id = v.id
                 and (regexp_replace(s.sucursal || s.codigo, '\D', '', 'g') like '%' || bd || '%' or regexp_replace(coalesce(s.telefono, ''), '\D', '', 'g') like '%' || bd || '%'))
            or exists (select 1 from public.representantes rp where rp.cliente_id = v.id and regexp_replace(coalesce(rp.telefono, ''), '\D', '', 'g') like '%' || bd || '%')
            or regexp_replace(coalesce(v.telefono, ''), '\D', '', 'g') like '%' || bd || '%'))
      else case coalesce(p_filtro, 'en_curso')
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
        'todos', count(*)) from vis v),
    'total', (select count(*) from sel),
    'opciones', jsonb_build_object(
      'lider', (select coalesce(jsonb_agg(x order by x), '[]'::jsonb) from (select distinct coalesce(privado.nombre_de(c.lider_id), c.lider_nombre, 'Sin líder') x from mios c) q),
      'sucursal', (select coalesce(jsonb_agg(x order by x), '[]'::jsonb) from (select distinct s.sucursal x from public.servicios s join mios c on c.id = s.cliente_id) q),
      'servicio', (select coalesce(jsonb_agg(x order by x), '[]'::jsonb) from (select distinct initcap(privado.norm(s.estado)) x from public.servicios s join mios c on c.id = s.cliente_id
                where nullif(btrim(s.estado), '') is not null) q),
      'tipo', jsonb_build_array('PYME', 'Dedicado ISP', 'Dedicado corporativo', 'Combinado')),
    'desde', des, 'rol', rol, 'hoy', privado.hoy(),
    'filas', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'nombre', p.nombre, 'doc_tipo', p.doc_tipo, 'doc_numero', p.doc_numero, 'es_natural', p.es_natural,
        'seg', privado.segmento(p.id), 'ded', p.t_ded, 'combinado', p.t_ded is not null and p.t_pyme, 'estatus', p.estatus, 'estatus_desde', p.estatus_desde,
        'lider', coalesce(privado.nombre_de(p.lider_id), p.lider_nombre),
        'ug_en', p.ultima_gestion_en, 'ug_por', coalesce(privado.nombre_de(p.ultima_gestion_por), p.ultima_gestion_nombre),
        'creado_en', p.creado_en, 'es_top', p.es_top, 'provisional', p.provisional, 'ultimo_corte', p.ultimo, 'por_instalar', p.pinst,
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
end $f$;

create or replace function public.dedicados_lista() returns jsonb
language plpgsql stable security definer set search_path to '' as $f$
declare v_rol text := privado.exigir('admin', 'abogado', 'analista', 'lider'); v_yo uuid := (select auth.uid());
begin
  return jsonb_build_object('rol', v_rol, 'hoy', privado.hoy(),
    'puedo', jsonb_build_object('editar', v_rol = 'admin'),
    'filas', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'nombre', c.nombre, 'doc_tipo', c.doc_tipo, 'doc_numero', c.doc_numero, 'provisional', c.provisional,
        'tipo', d.tipo, 'seg', privado.segmento(c.id), 'lider', coalesce(privado.nombre_de(c.lider_id), c.lider_nombre), 'estatus', c.estatus, 'activo', d.activo,
        'ejecutiva', coalesce(privado.nombre_de(d.ejecutiva_id), d.ejecutiva_nombre),
        'verificar', d.verificar, 'verificar_motivo', d.verificar_motivo, 'ruta_documentos', d.ruta_documentos, 'ruta_contrato', d.ruta_contrato,
        'plazo', d.plazo_documentos, 'vacias', privado.casillas_vacias(c.id),
        'por_revisar', (select count(*) from public.documentos x where x.cliente_id = c.id and x.estado = 'por_revisar'),
        'enlaces', (select count(*) from public.dedicado_enlaces e where e.cliente_id = c.id and e.activo),
        'capacidad', (select sum(coalesce(e.cap_entregada, e.cap_facturada, e.cap_inicial)) from public.dedicado_enlaces e where e.cliente_id = c.id and e.activo),
        'nodos', (select string_agg(distinct e.nodo, ', ') from public.dedicado_enlaces e where e.cliente_id = c.id and e.activo and nullif(btrim(e.nodo), '') is not null),
        'contrato', (select k.estatus from public.dedicado_contratos k where k.cliente_id = c.id and k.tipo = 'servicio' order by k.id limit 1),
        'contratos', (select coalesce(jsonb_agg(jsonb_build_object('tipo', k.tipo, 'estatus', k.estatus, 'vence', k.vence_texto, 'firmado_en', k.firmado_en, 'numero', k.numero) order by k.tipo, k.id), '[]'::jsonb)
                      from public.dedicado_contratos k where k.cliente_id = c.id),
        'vgt', exists (select 1 from public.dedicado_contratos k where k.cliente_id = c.id and k.tipo = 'vgt'),
        'vgt_por_firmar', exists (select 1 from public.dedicado_contratos k where k.cliente_id = c.id and k.tipo = 'vgt' and k.estatus <> 'firmado'),
        'vgt_proyectos', (select count(distinct coalesce(k.proyecto, k.id::text)) from public.dedicado_contratos k where k.cliente_id = c.id and k.tipo = 'vgt'),
        'vgt_postes', (select sum(k.postes) from public.dedicado_contratos k where k.cliente_id = c.id and k.tipo = 'vgt'),
        'vgt_faltan', privado.vgt_faltan(c.id),
        'poliza_vence', (select min(d2.vence_en) from public.documentos d2 where d2.cliente_id = c.id and d2.casilla = 'otro' and d2.numero in (66, 67)),
        'colocation', exists (select 1 from public.dedicado_contratos k where k.cliente_id = c.id and k.tipo = 'colocation'))
      order by (d.tipo = 'isp') desc, d.activo desc, c.nombre), '[]'::jsonb)
      from public.dedicados d join public.clientes c on c.id = d.cliente_id
      where c.unido_a is null and (v_rol <> 'lider' or d.ejecutiva_id = v_yo or c.lider_id = v_yo)));
end $f$;

-- Aplicado después como parches (migraciones "clientes_busca_todas_tarjetas" y "clientes_lista_vacias_una_vez"); este archivo ya los incluye.
