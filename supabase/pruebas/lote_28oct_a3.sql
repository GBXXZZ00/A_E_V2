-- Lote 28/10, parte A (3 de 3): Clientes (panel y resumen con churn), detalle por dueño, Mi trabajo (buzón por rol y notas),
-- revisión en lote con la IA y Actualizar ("Qué toca actualizar", solo administrador y Analista Senior).
-- Migraciones: lote28_a3_*. Además, con privado.reemplazar_en_funcion (ya aplicado):
--   tad_iniciar, crudo_iniciar, cruce_aplicar, cruce_probar, carga_solo_aliados, tad_permitir_corto: perform privado.exigir_senior();
--   ip_reporte_cargar: además de exigir, v_sen uuid := privado.exigir_senior();
--   res_filas: el tono de "legal" es verde para Firmado (antes "completo").

-- Servicios con su segmento, si siguen activos, cuándo se perdieron (si se sabe) y su dueño (líder, Canales o Aliados)
create or replace function privado.srv_base(v_l uuid) returns table(id bigint, cliente_id bigint, nombre text, codigo text, seg text, vgt boolean, activo boolean, suspendido boolean,
  fecha date, perdida date, dueno text, equipo text, lider_id uuid, estatus text)
language sql stable security definer set search_path to '' as $$
  select s.id, c.id, c.nombre, s.sucursal || '-' || s.codigo,
    case when c.es_isp then 'isp' when d.cliente_id is not null and d.excluido_en is null then 'corporativo' else 'pyme' end,
    exists (select 1 from public.dedicado_contratos k where k.cliente_id = c.id and k.tipo = 'vgt'),
    s.estado = 'Habilitado' and s.retirado_en is null, s.estado is distinct from 'Habilitado' and s.retirado_en is null,
    s.fecha_instalacion,
    case when s.retirado_en is not null then s.retirado_en
         when s.estado is distinct from 'Habilitado' then coalesce(s.ult_suspension,
           (select max(e.fecha) from public.servicio_estados e where e.servicio_id = s.id and e.estado is distinct from 'Habilitado' and e.estado_antes = 'Habilitado')) end,
    case when ow.ali then 'Aliados comerciales' when ow.eq = 'canales' then 'Canales de atención' else coalesce(privado.nombre_de(ow.pid), ow.nom, 'Sin líder') end,
    case when ow.ali then 'aliados' else coalesce(ow.eq, 'corporativas') end,
    coalesce(ow.pid, c.lider_id), c.estatus
  from public.servicios s join public.clientes c on c.id = s.cliente_id
  left join public.dedicados d on d.cliente_id = c.id
  left join lateral (select i.es_aliado, i.lider_id, i.lider_nombre, i.dueno_manual, o.vendedor_id from public.instalaciones i left join public.ordenes_odoo o on o.id = i.orden_id
                     where i.anulada_en is null and (i.servicio_id = s.id or (i.cliente_id = c.id and i.sucursal = s.sucursal and i.codigo = s.codigo)) order by i.instalada_en desc limit 1) i on true
  cross join lateral (select coalesce(i.es_aliado, false) or (c.lider_id is null and privado.norm(coalesce(c.lider_nombre, '')) = 'aliado comercial') ali,
      coalesce(case when i.dueno_manual then i.lider_id else coalesce(i.lider_id, i.vendedor_id) end, privado.perfil_por_nombre(i.lider_nombre), c.lider_id) pid,
      coalesce(i.lider_nombre, c.lider_nombre) nom) o0
  cross join lateral (select o0.ali, o0.pid, o0.nom, privado.equipo_de(o0.pid) eq) ow
  where c.unido_a is null and (v_l is null or c.lider_id = v_l or d.ejecutiva_id = v_l)
    and (c.es_isp or (d.cliente_id is not null and d.excluido_en is null) or privado.norm(coalesce(s.categoria, '')) !~ '(dedicad|conectiv)') $$;

-- Panel de arriba de Clientes: tarjetas por segmento con su estatus legal en 5 grupos, gestiones activas y la prioridad
create or replace function public.clientes_panel() returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare r text := privado.exigir('admin', 'analista', 'lider', 'abogado'); yo uuid := (select auth.uid()); v_l uuid; segs jsonb; ges jsonb; pri jsonb; hoy date := privado.hoy();
begin
  if r = 'lider' then v_l := yo; end if;
  select coalesce(jsonb_object_agg(z.seg, z.o), '{}'::jsonb) into segs from (
    select x.seg, jsonb_build_object('total', count(*),
      'grupos', jsonb_build_array(count(*) filter (where privado.grupo_legal(x.estatus) = 'sin_gestionar'), count(*) filter (where privado.grupo_legal(x.estatus) = 'faltan'),
        count(*) filter (where privado.grupo_legal(x.estatus) = 'revision'), count(*) filter (where privado.grupo_legal(x.estatus) = 'por_firmar'), count(*) filter (where privado.grupo_legal(x.estatus) = 'firmado')),
      'sin_fecha', case when x.seg <> 'pyme' then (select count(*) from public.dedicado_contratos k join privado.res_cli(v_l) y on y.id = k.cliente_id where y.seg = x.seg and k.vence_en is null) end,
      'polizas', case when x.seg = 'isp' then (select count(distinct p.cliente_id) from privado.pendientes() p join privado.res_cli(v_l) y on y.id = p.cliente_id where y.seg = 'isp' and p.tipo in ('vgt', 'poliza')) end,
      'habilitacion', case when x.seg = 'isp' then (select count(*) from privado.res_cli(v_l) y where y.seg = 'isp' and not exists (select 1 from public.documentos dd where dd.cliente_id = y.id and dd.casilla ilike '%habilit%' and dd.estado in ('aprobado', 'por_revisar'))) end,
      'suspendidos', case when x.seg = 'isp' then (select count(distinct sb.cliente_id) from privado.srv_base(v_l) sb where sb.seg = 'isp' and sb.suspendido) end) o
    from privado.res_cli(v_l) x group by x.seg) z;
  select coalesce(jsonb_agg(privado.gestion_json(g.id, false) order by g.plazo nulls last), '[]'::jsonb) into ges from public.gestiones g
  where g.estado = 'activa' and (r <> 'lider' or exists (select 1 from public.gestion_responsables x where x.gestion_id = g.id and x.perfil_id = yo));
  select jsonb_build_object('n', count(*), 'clientes', coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'nombre', q.nombre)) filter (where q.rn <= 500), '[]'::jsonb)) into pri
  from (select x.id, x.nombre, row_number() over (order by x.nombre) rn from privado.res_cli(v_l) x
        where x.seg = 'pyme' and privado.grupo_legal(x.estatus) = 'sin_gestionar'
          and exists (select 1 from public.servicios s where s.cliente_id = x.id and s.estado = 'Habilitado' and s.retirado_en is null and s.fecha_instalacion >= (hoy - interval '6 months')::date)) q;
  return jsonb_build_object('segmentos', segs, 'gestiones', ges, 'prioridad', pri, 'rol', r, 'puedo_crear_gestion', privado.puede_crear_gestion(),
    'puedo_gestion', r = 'admin' or privado.es_senior());
end $$;

-- Gestiones activas: cambiar la fecha (administrador, Senior o quien la creó)
create or replace function public.gestion_plazo(p_id bigint, p_plazo date) returns void language plpgsql security definer set search_path to '' as $$
declare r text := privado.exigir('admin', 'analista', 'lider'); yo uuid := (select auth.uid()); g public.gestiones;
begin
  select * into g from public.gestiones where id = p_id;
  if not found or g.estado <> 'activa' then raise exception 'Esa gestión ya no está activa' using errcode = 'P0001'; end if;
  if not (r = 'admin' or privado.es_senior() or g.creado_por = yo) then raise exception 'Solo quien la creó o el administrador cambia la fecha' using errcode = 'P0001'; end if;
  if p_plazo is null or p_plazo < privado.hoy() then raise exception 'Elige una fecha de hoy en adelante' using errcode = 'P0001'; end if;
  update public.gestiones set plazo = p_plazo where id = p_id;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues) values (yo, 'gestion_plazo', 'gestiones', p_id::text, jsonb_build_object('plazo', g.plazo), jsonb_build_object('plazo', p_plazo));
end $$;

-- Resumen de Clientes (pantalla 4): por tipo de cliente; churn del mes y de infancia (perdido antes de 60 días de instalado);
-- calidad de la venta por dueño; gestiones activas; estatus legal por segmento. Sin deuda.
create or replace function public.clientes_resumen(p_mes date default null, p_seg text default 'pyme') returns jsonb language plpgsql stable security definer set search_path to '' as $$
#variable_conflict use_variable
declare r text := privado.exigir('admin', 'analista', 'lider', 'abogado', 'gerencia'); yo uuid := (select auth.uid()); v_l uuid; hoy date := privado.hoy();
  m date := date_trunc('month', coalesce(p_mes, privado.hoy())::timestamp)::date; seg text := coalesce(nullif(p_seg, ''), 'pyme');
  tarj jsonb; nums jsonb; ges jsonb; leg jsonb; sinf boolean;
begin
  if r = 'lider' then v_l := yo; end if;
  if seg not in ('pyme', 'corporativo', 'isp', 'vgt') then raise exception 'Tipo de cliente no reconocido' using errcode = 'P0001'; end if;
  if m > date_trunc('month', hoy::timestamp)::date then m := date_trunc('month', hoy::timestamp)::date; end if;
  select jsonb_build_object('pyme', count(*) filter (where x.seg = 'pyme'), 'corporativo', count(*) filter (where x.seg = 'corporativo'), 'isp', count(*) filter (where x.seg = 'isp'),
      'vgt', (select count(distinct k.cliente_id) from public.dedicado_contratos k join privado.res_cli(v_l) y on y.id = k.cliente_id where k.tipo = 'vgt'),
      'vgt_contratos', (select count(*) from public.dedicado_contratos k join privado.res_cli(v_l) y on y.id = k.cliente_id where k.tipo = 'vgt'),
      'vgt_postes', (select coalesce(sum(k.postes), 0) from public.dedicado_contratos k join privado.res_cli(v_l) y on y.id = k.cliente_id where k.tipo = 'vgt'))
    into tarj from privado.res_cli(v_l) x;
  sinf := not exists (select 1 from public.servicios s where s.ult_suspension is not null or s.retirado_en is not null)
          and not exists (select 1 from public.servicio_estados e where e.estado_antes = 'Habilitado' and e.estado is distinct from 'Habilitado');

  with b as (select * from privado.srv_base(v_l) s where case when seg = 'vgt' then s.vgt else s.seg = seg end),
  meses as (select g::date mm from generate_series((m - interval '11 months')::date, m, interval '1 month') g),
  pm as (select mm,
      (select count(*) from b where date_trunc('month', b.fecha)::date = mm) inst,
      (select count(*) from b where b.fecha < mm and (b.activo or b.perdida >= mm)) base,
      (select count(*) from b where date_trunc('month', b.perdida)::date = mm) perd,
      (select count(*) from b where date_trunc('month', b.fecha)::date = mm and b.perdida is not null and b.perdida - b.fecha <= 60) inf,
      (select count(*) from b where date_trunc('month', b.fecha)::date = mm and b.activo) siguen,
      (select count(*) from public.clientes c join privado.res_cli(v_l) y on y.id = c.id where (case when seg = 'vgt' then exists (select 1 from public.dedicado_contratos k where k.cliente_id = c.id and k.tipo = 'vgt') else y.seg = seg end)
         and c.estatus = 'contrato_firmado' and date_trunc('month', c.estatus_desde at time zone 'America/Caracas')::date = mm) firm
    from meses)
  select jsonb_build_object(
      'nums', jsonb_build_object('habilitados', (select count(*) from b where b.activo), 'suspendidos', (select count(*) from b where b.suspendido),
        'inst', (select inst from pm where mm = m), 'inst_prev', (select inst from pm where mm = (m - interval '1 month')::date), 'inst_prom', (select round(avg(inst)) from pm),
        'churn', (select case when base > 0 then round(100.0 * perd / base, 1) end from pm where mm = m), 'perdidos', (select perd from pm where mm = m),
        'infancia', (select case when inst > 0 then round(100.0 * inf / inst, 1) end from pm where mm = m), 'inf_n', (select inf from pm where mm = m),
        'sin_gestionar', (select count(*) from privado.res_cli(v_l) y where (case when seg = 'vgt' then exists (select 1 from public.dedicado_contratos k where k.cliente_id = y.id and k.tipo = 'vgt') else y.seg = seg end) and privado.grupo_legal(y.estatus) = 'sin_gestionar'),
        'recientes', (select count(distinct b.cliente_id) from b where b.activo and b.fecha >= (hoy - interval '6 months')::date and privado.grupo_legal(b.estatus) = 'sin_gestionar')),
      'prom', jsonb_build_object('inst', (select round(avg(inst)) from pm), 'perd', (select round(avg(perd)) from pm),
        'churn', (select round(avg(case when base > 0 then 100.0 * perd / base end), 1) from pm), 'infancia', (select round(avg(case when inst > 0 then 100.0 * inf / inst end), 1) from pm),
        'firmados', (select round(avg(firm)) from pm)),
      'serie', (select jsonb_agg(jsonb_build_object('m', to_char(mm, 'YYYY-MM'), 'a', siguen, 'b', inst - siguen) order by mm) from pm),
      'churn', (select jsonb_agg(jsonb_build_object('m', to_char(mm, 'YYYY-MM'), 'tot', case when base > 0 then round(100.0 * perd / base, 1) else 0 end,
                  'inf', case when inst > 0 then round(100.0 * inf / inst, 1) else 0 end) order by mm) from pm where mm > (m - interval '6 months')::date),
      'calidad', (select coalesce(jsonb_agg(jsonb_build_object('d', z.dueno, 'inst', z.inst, 'siguen', round(100.0 * z.sig / z.inst), 'churn', round(100.0 * z.inf / z.inst, 1), 'firm', z.firm) order by z.inst desc, z.dueno), '[]'::jsonb)
                  from (select b.dueno, count(*) inst, count(*) filter (where b.activo) sig, count(*) filter (where b.perdida is not null and b.perdida - b.fecha <= 60) inf,
                          count(distinct b.cliente_id) filter (where b.estatus = 'contrato_firmado') firm
                        from b where b.fecha >= (date_trunc('month', hoy::timestamp) - interval '6 months')::date group by b.dueno) z))
    into nums;

  select coalesce(jsonb_agg(privado.gestion_json(g.id, false) order by g.plazo nulls last), '[]'::jsonb) into ges from public.gestiones g
  where g.estado = 'activa' and (r not in ('lider') or exists (select 1 from public.gestion_responsables x where x.gestion_id = g.id and x.perfil_id = yo));
  select coalesce(jsonb_agg(jsonb_build_object('l', case s.seg when 'pyme' then 'PYME' when 'corporativo' then 'Dedicado corporativo' else 'Dedicado ISP' end, 'x', s.seg, 'v', jsonb_build_array(s.a, s.b, s.c, s.d, s.e)) order by s.o), '[]'::jsonb) into leg
  from (select x.seg, case x.seg when 'pyme' then 1 when 'corporativo' then 2 else 3 end o,
          count(*) filter (where privado.grupo_legal(x.estatus) = 'sin_gestionar') a, count(*) filter (where privado.grupo_legal(x.estatus) = 'faltan') b,
          count(*) filter (where privado.grupo_legal(x.estatus) = 'revision') c, count(*) filter (where privado.grupo_legal(x.estatus) = 'por_firmar') d,
          count(*) filter (where privado.grupo_legal(x.estatus) = 'firmado') e from privado.res_cli(v_l) x group by x.seg) s;
  return jsonb_build_object('mes', m, 'mes_nombre', privado.mes_nombre(m), 'seg', seg, 'tarjetas', tarj, 'gestiones', ges, 'legal', leg, 'sin_fechas', sinf,
    'rol', r, 'solo_lectura', r in ('gerencia', 'abogado')) || nums;
end $$;

-- Detalle de cada gráfica del Resumen de Clientes (pantalla 4b): filas con su dueño para agrupar
create or replace function privado.cli_filas_det(m date, seg text, g text, x text, v_l uuid) returns table(cliente_id bigint, n text, s text, e text, t text, d text, k text)
language plpgsql stable security definer set search_path to '' as $$
#variable_conflict use_variable
declare hoy date := privado.hoy(); x1 text := split_part(coalesce(x, ''), '|', 1); x2 text := split_part(coalesce(x, ''), '|', 2); mx date;
begin
  if x1 ~ '^\d{4}-\d{2}$' then mx := (x1 || '-01')::date; end if;
  if g in ('inst', 'churn', 'calidad', 'hab') then
    return query select b.cliente_id, b.nombre, b.codigo || ' · instalado ' || coalesce(to_char(b.fecha, 'DD/MM/YYYY'), 'sin fecha'),
        case when b.activo then 'Habilitado' when b.perdida is not null then 'Perdido el ' || to_char(b.perdida, 'DD/MM') else 'Suspendido' end,
        case when b.activo then 'ok' else 'r' end, b.dueno, privado.norm(b.nombre)
      from privado.srv_base(v_l) b
      where (case when seg = 'vgt' then b.vgt else b.seg = seg end)
        and case g
          when 'inst' then date_trunc('month', b.fecha)::date = mx and (x2 = '' or (x2 = 'siguen' and b.activo) or (x2 = 'no' and not b.activo))
          when 'churn' then case when x2 = 'inf' then date_trunc('month', b.fecha)::date = mx and b.perdida is not null and b.perdida - b.fecha <= 60 else date_trunc('month', b.perdida)::date = mx end
          when 'calidad' then b.fecha >= (date_trunc('month', hoy::timestamp) - interval '6 months')::date and (x1 = 'todos' or privado.norm(b.dueno) = x1)
            and (x2 = '' or (x2 = 'no' and not b.activo) or (x2 = 'inf' and b.perdida is not null and b.perdida - b.fecha <= 60))
          when 'hab' then (x1 = 'a' and b.activo) or (x1 = 's' and b.suspendido)
          else false end;
  elsif g in ('legal', 'singes') then
    return query select y.id, y.nombre, y.doc, privado.estatus_nombre(y.estatus),
        case privado.grupo_legal(y.estatus) when 'firmado' then 'ok' when 'faltan' then 'w' when 'por_firmar' then 'b' else '' end,
        coalesce(privado.nombre_de(y.lider_id), 'Sin líder'), privado.norm(y.nombre)
      from privado.res_cli(v_l) y
      where case g
          when 'legal' then (split_part(x, ':', 1) = 'todos' or y.seg = split_part(x, ':', 1)) and (split_part(x, ':', 2) = '' or privado.grupo_legal(y.estatus) = split_part(x, ':', 2))
          else (case when seg = 'vgt' then exists (select 1 from public.dedicado_contratos dc where dc.cliente_id = y.id and dc.tipo = 'vgt') else y.seg = seg end) and privado.grupo_legal(y.estatus) = 'sin_gestionar'
            and (x1 <> 'recientes' or exists (select 1 from public.servicios sv where sv.cliente_id = y.id and sv.estado = 'Habilitado' and sv.retirado_en is null and sv.fecha_instalacion >= (hoy - interval '6 months')::date)) end;
  else raise exception 'Gráfica no reconocida' using errcode = 'P0001';
  end if;
end $$;

create or replace function public.clientes_detalle(p_mes date, p_seg text, p_grafica text, p_valor text, p_pagina integer default 0) returns jsonb language plpgsql stable security definer set search_path to '' as $$
#variable_conflict use_variable
declare r text := privado.exigir('admin', 'analista', 'lider', 'abogado', 'gerencia'); yo uuid := (select auth.uid()); v_l uuid;
  m date := date_trunc('month', coalesce(p_mes, privado.hoy())::timestamp)::date; seg text := coalesce(nullif(p_seg, ''), 'pyme'); pp int := 50; tot int; grupos jsonb; filas jsonb;
begin
  if r = 'lider' then v_l := yo; end if;
  if p_grafica is null or p_valor is null or length(p_valor) > 200 then raise exception 'Falta qué mostrar' using errcode = 'P0001'; end if;
  if seg not in ('pyme', 'corporativo', 'isp', 'vgt') then raise exception 'Tipo de cliente no reconocido' using errcode = 'P0001'; end if;
  if coalesce(p_pagina, 0) < 0 then pp := 5000; end if;
  with f as (select * from privado.cli_filas_det(m, seg, p_grafica, p_valor, v_l))
  select (select count(*) from f),
    (select coalesce(jsonb_agg(jsonb_build_object('d', z.d, 'n', z.n) order by z.n desc, z.d), '[]'::jsonb) from (select f.d, count(*) n from f group by 1) z),
    (select coalesce(jsonb_agg(jsonb_build_object('c', z.cliente_id, 'n', z.n, 's', z.s, 'e', z.e, 't', z.t, 'd', z.d) order by z.d, z.k), '[]'::jsonb)
       from (select * from f order by f.d, f.k offset greatest(coalesce(p_pagina, 0), 0) * pp limit pp) z)
    into tot, grupos, filas;
  return jsonb_build_object('total', tot, 'grupos', grupos, 'pagina', greatest(coalesce(p_pagina, 0), 0), 'por_pagina', pp, 'filas', filas,
    'lista', 'clientes.html?' || case when seg in ('corporativo', 'isp') then 's=' || seg else 'f=todos' end ||
      case when p_grafica = 'legal' then case split_part(p_valor, ':', 2) when 'sin_gestionar' then '&est=grandes_negocios' when 'firmado' then '&est=contrato_firmado' when 'por_firmar' then '&est=por_firmar|contrato_en_curso'
        when 'revision' then '&est=documentos_recibidos|documentos_en_revision' when 'faltan' then '&est=documentos_solicitados|documentos_pendientes' else '' end
        when p_grafica = 'singes' then '&est=grandes_negocios' else '' end,
    'solo_lectura', r in ('gerencia', 'abogado'));
end $$;

-- Detalle genérico de las gráficas (todos los módulos): cada fila con su dueño y los totales por dueño para agrupar
create or replace function public.modulo_detalle(p_modulo text, p_grafica text, p_valor text, p_pagina integer default 0, p_desde date default null, p_hasta date default null) returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare r text := privado.exigir('admin', 'analista', 'lider', 'abogado', 'gerencia'); v_l uuid; hoy date := privado.hoy(); h date; d date; tot int; filas jsonb; grupos jsonb; pp int := 50;
begin
  if r = 'lider' then v_l := (select auth.uid()); end if;
  if (p_modulo = 'revision' and r = 'lider') or (p_modulo = 'comisiones' and r = 'abogado' and not coalesce((select p.gerencia from public.perfiles p where p.id = (select auth.uid())), false)) then raise exception 'No tienes permiso para ver este resumen' using errcode = 'P0001'; end if;
  if p_grafica is null or p_valor is null or length(p_valor) > 200 then raise exception 'Falta qué mostrar' using errcode = 'P0001'; end if;
  h := least(coalesce(p_hasta, hoy), hoy); d := coalesce(p_desde, date_trunc('month', h)::date);
  if p_modulo is null or p_modulo not in ('clientes', 'comisiones', 'revision', 'migraciones', 'factibilidad', 'dedicados', 'aliados') then raise exception 'Módulo no reconocido' using errcode = 'P0001'; end if;
  if p_grafica = 'sin_instalar' and p_modulo <> 'comisiones' then raise exception 'Esa lista está en Comisiones' using errcode = 'P0001'; end if;
  if d > h or h - d > 800 then raise exception 'Elige un período válido' using errcode = 'P0001'; end if;
  if coalesce(p_pagina, 0) < 0 then pp := 5000; end if;
  with f as (select x.*, coalesce((select privado.nombre_de(k.lider_id) from public.clientes k where k.id = x.cliente_id), 'Sin dueño') dd from privado.res_filas(p_modulo, p_grafica, p_valor, d, h, v_l) x)
  select (select count(*) from f),
    (select coalesce(jsonb_agg(jsonb_build_object('d', z.dd, 'n', z.n) order by z.n desc, z.dd), '[]'::jsonb) from (select f.dd, count(*) n from f group by 1) z),
    (select coalesce(jsonb_agg(jsonb_build_object('c', z.cliente_id, 'n', z.n, 's', z.s, 'e', z.e, 't', z.t, 'd', z.dd) order by z.dd, z.k, z.n), '[]'::jsonb)
       from (select * from f order by f.dd, f.k, f.n offset greatest(coalesce(p_pagina, 0), 0) * pp limit pp) z)
    into tot, grupos, filas;
  return jsonb_build_object('total', tot, 'grupos', grupos, 'pagina', greatest(coalesce(p_pagina, 0), 0), 'por_pagina', pp, 'filas', filas, 'lista', privado.res_lista(p_modulo, p_grafica, p_valor));
end $$;

-- Notas personales con recordatorio (solo las ve quien las escribe)
create or replace function public.nota_guardar(p_id bigint, p_texto text, p_recordar date default null, p_cliente bigint default null) returns bigint language plpgsql security definer set search_path to '' as $$
declare r text := privado.exigir('admin', 'analista', 'lider', 'abogado'); yo uuid := (select auth.uid()); t text := btrim(coalesce(p_texto, '')); v_id bigint;
begin
  if t = '' then raise exception 'Escribe la nota' using errcode = 'P0001'; end if;
  if length(t) > 500 then raise exception 'La nota es muy larga. Máximo 500 letras' using errcode = 'P0001'; end if;
  if p_cliente is not null then perform privado.exigir_cliente(p_cliente); end if;
  if p_id is null then
    insert into public.notas_personales (perfil_id, texto, recordar, cliente_id) values (yo, t, p_recordar, p_cliente) returning id into v_id;
  else
    update public.notas_personales set texto = t, recordar = p_recordar, cliente_id = p_cliente where id = p_id and perfil_id = yo returning id into v_id;
    if v_id is null then raise exception 'Esa nota ya no existe' using errcode = 'P0001'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.nota_hecha(p_id bigint, p_hecha boolean default true) returns void language plpgsql security definer set search_path to '' as $$
declare r text := privado.exigir('admin', 'analista', 'lider', 'abogado'); yo uuid := (select auth.uid());
begin
  update public.notas_personales set hecha_en = case when p_hecha then now() end where id = p_id and perfil_id = yo;
  if not found then raise exception 'Esa nota ya no existe' using errcode = 'P0001'; end if;
end $$;

-- Pendientes nuevos del buzón (lote 28/10): carta y proforma para Canales; "Mis ventas" de quien vende (faltan para comisionar, clientes nuevos por instalar)
create or replace function privado.pendientes_buzon() returns table(tipo text, clave text, cliente_id bigint, titulo text, detalle text, lider_id uuid, analista_id uuid, para text, desde timestamptz, vence date, ref jsonb)
language sql stable security definer set search_path to '' as $$
  with bc as (select b.*, privado.carta_estado(b.instalacion_id) k from privado.com_base(privado.corte_en_curso()) b)
  select 'carta_enviar'::text, bc.instalacion_id::text, bc.cliente_id, bc.nombre,
    case bc.k->>'k' when 'lider' then 'Enviada por el líder · falta Canales' when 'falta_ip' then 'Carta y proforma por enviar · falta la IP' else 'Carta y proforma por enviar' end
      || case when bc.migracion then ' · cambio de categoría' else ' · instalada ' || to_char(bc.instalada_en at time zone 'America/Caracas', 'DD/MM') end,
    bc.dueno_id, null::uuid, 'analista'::text, bc.instalada_en, (bc.instalada_en at time zone 'America/Caracas')::date + 2,
    jsonb_build_object('instalacion', bc.instalacion_id, 'servicio', (bc.k->>'servicio_id')::bigint, 'carta', bc.k->>'k', 'aliado', bc.equipo = 'aliados')
  from bc where bc.origen = 'corte' and bc.k->>'k' in ('por_enviar', 'falta_ip', 'lider') and bc.cliente_id is not null
  union all
  select 'venta_falta'::text, bc.instalacion_id::text, bc.cliente_id, bc.nombre,
    case when not bc.legal_ok and not bc.pago_ok then 'Falta legal y pago' when not bc.legal_ok then 'Falta legal' when not bc.pago_ok then 'Falta el pago' else 'Falta la orden' end
      || case when bc.origen = 'anterior' then ' · viene del corte anterior' else '' end,
    bc.dueno_id, null::uuid, 'vende'::text, bc.instalada_en, privado.corte_limite(privado.corte_en_curso()), jsonb_build_object('instalacion', bc.instalacion_id, 'legal', bc.legal_ok, 'pago', bc.pago_ok)
  from bc where not bc.cumple and not bc.migracion and bc.equipo in ('corporativas', 'canales') and bc.dueno_id is not null and bc.cliente_id is not null
  union all
  select 'cliente_nuevo'::text, p.cliente_id::text, p.cliente_id, p.nombre,
    'Pendiente por instalar · ' || p.docs || case when p.docs = 1 then ' documento subido' else ' documentos subidos' end || case when p.enviado then ' · enviado a revisión' else '' end,
    p.dueno_id, null::uuid, 'vende'::text, p.desde, null::date, jsonb_build_object('cliente', p.cliente_id)
  from privado.pendientes_instalar() p where p.dueno_id is not null $$;

-- Mi trabajo (buzón por rol): suma los pendientes nuevos, "Mis ventas" para quien vende, notas personales y el modo solo consulta
create or replace function public.mi_trabajo(p_persona uuid default null) returns jsonb language plpgsql security definer set search_path to '' as $$
#variable_conflict use_variable
declare r text := privado.exigir('admin', 'analista', 'lider', 'abogado'); yo uuid := (select auth.uid()); senior boolean := privado.es_senior(); coord boolean := privado.es_coordinador();
  hoy date := privado.hoy(); actual date := privado.corte_en_curso(); quien uuid := yo; vista text; pr public.perfiles; jefe boolean;
  canales boolean := coalesce((select pf.canales from public.perfiles pf where pf.id = (select auth.uid())), false);
begin
  jefe := r = 'admin' or senior;
  perform privado.gestiones_archivar();
  if p_persona is not null and p_persona <> yo then
    select * into pr from public.perfiles where id = p_persona and activo;
    if pr.id is null or not (jefe or (coord and pr.rol = 'analista')) then raise exception 'No puedes ver el trabajo de esa persona' using errcode = 'P0001'; end if;
    quien := p_persona;
  else select * into pr from public.perfiles where id = yo; end if;
  vista := case when quien <> yo then case pr.rol when 'analista' then case when pr.senior then 'admin' when pr.coordinador then 'coord' else 'analista' end else pr.rol end
                when jefe then 'admin' when coord then 'coord' when r = 'analista' then 'analista' else r end;
  return (with base as (select * from privado.pendientes() union all select * from privado.pendientes_extra() union all select * from privado.pendientes_buzon()),
  mio as (select b.* from base b where (b.para = 'vende' and b.lider_id = quien) or case vista
      when 'admin' then b.para in ('admin', 'senior') or (b.para = 'analista' and b.analista_id = quien and quien <> yo)
      when 'coord' then b.para = 'analista' and (p_persona is null or quien = yo or b.analista_id = quien)
      when 'analista' then b.para = 'analista' and (b.analista_id = quien or (b.analista_id is null and quien = yo) or (b.analista_id is null and b.tipo = 'carta_enviar'))
      when 'abogado' then b.para = 'abogado'
      when 'lider' then b.para = 'lider' and b.lider_id = quien
      else false end),
  ges as (select g.id from public.gestiones g where g.estado = 'activa' and (vista in ('admin', 'coord') or exists (select 1 from public.gestion_responsables x where x.gestion_id = g.id and x.perfil_id = quien))),
  gesitems as (select 'gestion'::text tipo, gc.gestion_id || ':' || gc.cliente_id clave, gc.cliente_id, k.nombre titulo,
      g.nombre || ' · ' || case gc.estado when 'contactado' then 'Contactado' when 'esperando' then 'Esperando' else 'Sin contacto' end || coalesce(' · ' || gc.nota, '') detalle,
      k.lider_id, null::uuid analista_id, 'lider'::text para, gc.actualizado_en desde, coalesce(gc.promesa, g.plazo) vence, jsonb_build_object('gestion', g.id, 'estado', gc.estado) ref
    from public.gestion_clientes gc join public.gestiones g on g.id = gc.gestion_id join public.clientes k on k.id = gc.cliente_id
    where g.estado = 'activa' and gc.estado not in ('cumplido', 'resuelto') and not privado.gestion_meta_ok(g.meta, gc.cliente_id)
      and vista = 'lider' and exists (select 1 from public.gestion_responsables x where x.gestion_id = g.id and x.perfil_id = quien)),
  todo as (select * from mio union all select * from gesitems),
  equipo as (select p.id, p.nombre, p.rol, p.senior, p.coordinador,
      (select count(*) from base b where (p.rol = 'lider' and b.para = 'lider' and b.lider_id = p.id) or (p.rol = 'analista' and b.para = 'analista' and b.analista_id = p.id) or (p.rol = 'abogado' and b.para = 'abogado') or (b.para = 'vende' and b.lider_id = p.id)) n,
      (select count(*) from base b where b.vence < hoy and ((p.rol = 'lider' and b.para = 'lider' and b.lider_id = p.id) or (p.rol = 'analista' and b.para = 'analista' and b.analista_id = p.id) or (p.rol = 'abogado' and b.para = 'abogado') or (b.para = 'vende' and b.lider_id = p.id))) venc,
      (select count(*) from base b where b.vence = hoy and ((p.rol = 'lider' and b.para = 'lider' and b.lider_id = p.id) or (p.rol = 'analista' and b.para = 'analista' and b.analista_id = p.id) or (p.rol = 'abogado' and b.para = 'abogado') or (b.para = 'vende' and b.lider_id = p.id))) vhoy
    from public.perfiles p where p.activo and p.id <> yo and ((jefe and quien = yo and p.rol in ('lider', 'analista', 'abogado')) or (coord and not jefe and quien = yo and p.rol = 'analista'))),
  cf as (select f.*, coalesce((privado.fila_extras(f.instalacion_id, f.cliente_id)->>'migracion')::boolean, false) mig from privado.comision_filas3(actual) f)
  select jsonb_build_object('rol', r, 'vista', vista, 'senior', senior, 'coordinador', coord, 'canales', canales, 'hoy', hoy,
    'nombre', pr.nombre, 'persona', case when quien <> yo then jsonb_build_object('id', pr.id, 'nombre', pr.nombre) end, 'solo_consulta', quien <> yo,
    'vende', pr.rol in ('lider', 'analista') and privado.equipo_de(pr.id) in ('corporativas', 'canales'),
    'corte', actual, 'limite', privado.corte_limite(actual),
    'items', coalesce((select jsonb_agg(jsonb_build_object('tipo', t.tipo, 'clave', t.clave, 'cliente_id', t.cliente_id, 'titulo', t.titulo, 'detalle', t.detalle, 'vence', t.vence, 'desde', t.desde,
        'lider', privado.nombre_de(t.lider_id), 'analista', privado.nombre_de(t.analista_id), 'analista_id', t.analista_id, 'ref', t.ref)
        order by t.vence nulls last, t.desde) from todo t), '[]'::jsonb),
    'notas', case when quien = yo then coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'texto', n.texto, 'recordar', n.recordar, 'cliente_id', n.cliente_id,
        'cliente', (select c.nombre from public.clientes c where c.id = n.cliente_id), 'en', n.creada_en, 'hecha', n.hecha_en is not null) order by n.hecha_en is not null, n.recordar nulls last, n.creada_en desc)
        from public.notas_personales n where n.perfil_id = yo and (n.hecha_en is null or n.hecha_en > now() - interval '2 days')), '[]'::jsonb) else '[]'::jsonb end,
    'gestiones', coalesce((select jsonb_agg(privado.gestion_json(g.id, false) order by gg.plazo) from ges g join public.gestiones gg on gg.id = g.id), '[]'::jsonb),
    'puedo_crear_gestion', privado.puede_crear_gestion(),
    'equipo', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'nombre', e.nombre, 'rol', case when e.rol = 'abogado' then 'Legal' when e.rol = 'lider' then 'Líder' when e.senior then 'Analista Senior' when e.coordinador then 'Coordinador' else 'Analista' end,
        'n', e.n, 'venc', e.venc, 'hoy', e.vhoy) order by e.venc desc, e.n desc) from equipo e where e.n > 0), '[]'::jsonb),
    'personas', case when jefe or coord then (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'rol', p.rol) order by p.rol, p.nombre), '[]'::jsonb)
        from public.perfiles p where p.activo and p.id <> yo and (p.rol = 'analista' or (jefe and p.rol in ('lider', 'abogado')))) else '[]'::jsonb end,
    'hoy_hechos', (select count(*) from public.bitacora b where b.usuario_id = yo and b.en >= (hoy::timestamp at time zone 'America/Caracas') and b.accion in ('documento_aprobar', 'documento_devolver', 'envio_documentos', 'cambio_hecho')),
    'kpis', case vista
      when 'lider' then jsonb_build_object('instalaciones', (select count(*) from cf where cf.lider_id = quien and not cf.mig), 'comisionan', (select count(*) from cf where cf.lider_id = quien and cf.cumple),
        'falta', (select count(*) from cf where cf.lider_id = quien and not cf.cumple), 'migraciones', (select count(*) from cf where cf.lider_id = quien and cf.mig))
      when 'abogado' then jsonb_build_object('recibidos', (select count(*) from public.clientes c where c.unido_a is null and c.estatus = 'documentos_recibidos'),
        'por_firmar', (select count(*) from public.clientes c where c.unido_a is null and c.estatus = 'por_firmar'),
        'firmados', (select count(*) from public.clientes c where c.unido_a is null and c.estatus = 'contrato_firmado' and c.estatus_desde > now() - interval '7 days'),
        'sin_archivo', (select count(*) from mio where mio.tipo = 'contrato_archivo'))
      when 'admin' then jsonb_build_object('instalaciones', (select count(*) from cf where not cf.mig), 'comisionan', (select count(*) from cf where cf.cumple),
        'migraciones', (select count(*) from cf where cf.mig), 'negativos', (select count(*) from public.cambios z where z.tipo = 'residencial' and z.estado = 'confirmado' and privado.corte_de((z.confirmado_en at time zone 'America/Caracas')::date) = actual))
      else jsonb_build_object('emitidos', (select count(*) from public.bitacora b where b.accion = 'cambio_hecho' and b.en > now() - interval '7 days' and (vista = 'coord' or b.usuario_id = quien)),
        'dias_emitir', (select round(avg(extract(epoch from z.emitido_en - coalesce(z.aprobado_en, z.creado_en)) / 86400)::numeric, 1) from public.cambios z where z.emitido_en > now() - interval '7 days' and (vista = 'coord' or z.emitido_por = quien)),
        'bienvenidas', (select count(*) from public.envios e where e.tipo = 'bienvenida' and e.en > now() - interval '7 days' and (vista = 'coord' or e.por = quien)),
        'yo', (select count(*) from public.bitacora b where vista = 'coord' and b.accion = 'cambio_hecho' and b.usuario_id = yo and b.en > now() - interval '7 days'))
      end));
end $$;

-- Revisión en lote (Mi trabajo, pantalla 2): documentos por revisar agrupados por cliente con lo que dijo la IA
create or replace function public.revision_lote_lista(p_ia text default 'todos', p_corte boolean default false, p_busca text default null, p_desde integer default 0, p_limite integer default 30) returns jsonb
language plpgsql stable security definer set search_path to '' as $$
#variable_conflict use_variable
declare r text := privado.exigir('admin', 'abogado'); yo uuid := (select auth.uid()); hoy date := privado.hoy(); q text := privado.norm(coalesce(p_busca, '')); res jsonb;
begin
  if coalesce(p_ia, 'todos') not in ('todos', 'apto', 'no_apto', 'mano', 'sin_leer') then raise exception 'Filtro no reconocido' using errcode = 'P0001'; end if;
  with corte as (select distinct b.cliente_id from privado.com_base(privado.corte_en_curso()) b where b.cliente_id is not null),
  docs as (
    select d.id, d.cliente_id, d.casilla, d.numero, d.subido_en, privado.casilla_nombre(d.casilla) cas,
      case ia.propuesta when 'bien' then 'apto' when 'problema' then 'no_apto' when 'revisar_a_mano' then 'mano' else 'sin_leer' end ia,
      ia.motivo ia_texto, coalesce(case when rm.origen = 'ia' and rm.accion = 'devolver' then rm.motivo end, 'otro') ia_motivo,
      coalesce(nullif(btrim(ia.nota), ''), ia.motivo) ia_nota
    from public.documentos d join public.clientes c on c.id = d.cliente_id
    left join lateral (select m.propuesta, m.motivo, m.nota from public.ia_marcas m join public.ia_corridas k on k.id = m.corrida_id
                       where m.documento_id = d.id and k.estado in ('lista', 'cerrada') and k.lanzada_en >= d.subido_en order by k.lanzada_en desc limit 1) ia on true
    left join public.revision_marcas rm on rm.documento_id = d.id
    where d.estado = 'por_revisar' and c.unido_a is null and c.suspendido_en is null
      and exists (select 1 from public.documento_archivos da where da.documento_id = d.id and da.vigente)),
  f as (select x.* from docs x join public.clientes c on c.id = x.cliente_id
        where (coalesce(p_ia, 'todos') = 'todos' or x.ia = p_ia) and (not coalesce(p_corte, false) or x.cliente_id in (select cliente_id from corte))
          and (q = '' or privado.norm(c.nombre) like '%' || q || '%' or c.doc_numero like '%' || regexp_replace(q, '\D', '', 'g') || '%' and regexp_replace(q, '\D', '', 'g') <> '')),
  cl as (select f.cliente_id, min(f.subido_en) desde, count(*) n from f group by 1),
  pag as (select cl.*, c.nombre, c.lider_id, (cl.cliente_id in (select cliente_id from corte)) en_corte from cl join public.clientes c on c.id = cl.cliente_id
          order by (cl.cliente_id in (select cliente_id from corte)) desc, cl.desde offset greatest(coalesce(p_desde, 0), 0) limit least(greatest(coalesce(p_limite, 30), 1), 100))
  select jsonb_build_object(
    'conteos', (select jsonb_build_object('apto', count(*) filter (where docs.ia = 'apto'), 'no_apto', count(*) filter (where docs.ia = 'no_apto'), 'mano', count(*) filter (where docs.ia = 'mano'),
        'sin_leer', count(*) filter (where docs.ia = 'sin_leer'), 'corte', count(distinct docs.cliente_id) filter (where docs.cliente_id in (select cliente_id from corte)),
        'clientes', count(distinct docs.cliente_id), 'docs', count(*)) from docs),
    'total', (select count(*) from cl),
    'clientes', coalesce((select jsonb_agg(jsonb_build_object('id', p.cliente_id, 'nombre', p.nombre, 'lider', coalesce(privado.nombre_de(p.lider_id), 'Sin líder'), 'n', p.n,
        'espera', hoy - (p.desde at time zone 'America/Caracas')::date, 'en_corte', p.en_corte,
        'docs', (select jsonb_agg(jsonb_build_object('id', f.id, 'casilla', f.casilla, 'cas', f.cas, 'numero', f.numero, 'ia', f.ia, 'texto', f.ia_texto, 'motivo', f.ia_motivo, 'nota', f.ia_nota,
            'dias', hoy - (f.subido_en at time zone 'America/Caracas')::date) order by f.casilla, f.numero) from f where f.cliente_id = p.cliente_id))
        order by p.en_corte desc, p.desde) from pag p), '[]'::jsonb),
    'hoy_aprobados', (select count(*) from public.bitacora b where b.usuario_id = yo and b.accion = 'documento_aprobar' and b.en >= (hoy::timestamp at time zone 'America/Caracas')),
    'corte', privado.mes_nombre(privado.corte_en_curso()), 'puedo_cerrar', r = 'admin')
  into res;
  return res;
end $$;

-- Aprobar o devolver varios a la vez. Cada cliente se cierra con las mismas reglas de la revisión (bitácora por documento, estatus, hilo);
-- las otras marcas del cliente (de la IA o de antes) se respetan; al líder le llega un aviso.
create or replace function public.revision_lote(p_items jsonb) returns jsonb language plpgsql security definer set search_path to '' as $$
#variable_conflict use_variable
declare r text := privado.exigir('admin'); yo uuid := (select auth.uid()); cli record; it jsonb; guard jsonb; info jsonb; ap int := 0; dv int := 0; om jsonb := '[]'::jsonb; ids bigint[]; listos int := 0; c public.clientes;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Elige al menos un documento' using errcode = 'P0001'; end if;
  if jsonb_array_length(p_items) > 300 then raise exception 'Son muchos a la vez. Hazlo en partes de 300' using errcode = 'P0001'; end if;
  for cli in
    select d.cliente_id, array_agg(d.id) docs from jsonb_array_elements(p_items) x join public.documentos d on d.id = (x->>'doc')::bigint
    where d.estado = 'por_revisar' group by d.cliente_id
  loop
    ids := '{}';
    for it in select x from jsonb_array_elements(p_items) x where (x->>'doc')::bigint = any (cli.docs) loop
      -- Aprobar lo que la IA devolvió es una excepción: va uno por uno
      if it->>'accion' = 'aprobar' and exists (select 1 from public.revision_marcas m where m.documento_id = (it->>'doc')::bigint and m.origen = 'ia' and m.accion = 'devolver') then
        om := om || jsonb_build_array(it->'doc'); continue; end if;
      ids := ids || (it->>'doc')::bigint;
    end loop;
    if cardinality(ids) = 0 then continue; end if;
    select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) into guard from public.revision_marcas m where m.cliente_id = cli.cliente_id and m.accion is not null and not (m.documento_id = any (ids));
    update public.revision_marcas set accion = null where cliente_id = cli.cliente_id and accion is not null and not (documento_id = any (ids));
    for it in select x from jsonb_array_elements(p_items) x where (x->>'doc')::bigint = any (ids) loop
      perform public.documento_marcar((it->>'doc')::bigint, it->>'accion', nullif(it->>'motivo', ''), nullif(it->>'nota', ''), null);
    end loop;
    info := public.revision_cerrar(cli.cliente_id, null, false);
    ap := ap + (info->>'aprobados')::int; dv := dv + (info->>'devueltos')::int;
    if info->>'estatus' in ('documentos_recibidos', 'documentos_en_revision', 'por_firmar', 'contrato_en_curso', 'contrato_firmado') then listos := listos + 1; end if;
    update public.revision_marcas m set accion = g.accion, motivo = g.motivo, nota = g.nota, vence_en = g.vence_en, marcado_por = g.marcado_por, marcado_en = g.marcado_en, origen = g.origen, ia_corrida_id = g.ia_corrida_id
    from jsonb_populate_recordset(null::public.revision_marcas, guard) g where m.documento_id = g.documento_id;
    select * into c from public.clientes where id = cli.cliente_id;
    if c.lider_id is not null then
      perform privado.aviso_poner(c.lider_id, case when (info->>'devueltos')::int > 0 then 'devuelto' else 'revision' end,
        case when (info->>'devueltos')::int > 0 then 'Devolvieron documentos de ' || c.nombre else 'Aprobaron documentos de ' || c.nombre end,
        (info->>'aprobados') || ' aprobados, ' || (info->>'devueltos') || ' devueltos. ' || case when (info->>'devueltos')::int > 0 then 'Pídele al cliente lo que falta.' else 'No tienes que hacer nada.' end,
        'clientes.html?c=' || c.id || '&t=documentos', 'rev:' || (info->>'revision'), false);
    end if;
  end loop;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues) values (yo, 'revision_lote', 'documentos', null, jsonb_build_object('aprobados', ap, 'devueltos', dv, 'omitidos', om));
  return jsonb_build_object('aprobados', ap, 'devueltos', dv, 'omitidos', om, 'listos', listos);
end $$;

-- Actualizar (A11): qué toca actualizar y el historial agrupado por fecha. Solo administrador y Analista Senior.
create or replace function public.actualizar_estado() returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare yo uuid := privado.exigir_senior(); hoy date := privado.hoy(); h int := extract(hour from now() at time zone 'America/Caracas')::int; ult_cruce timestamptz := (select max(b.en) from public.bitacora b where b.accion = 'cruce'); res jsonb;
begin
  with u as (select c.fuente, max(c.subido_en) en from public.cargas c where c.estado in ('lista', 'con_errores') group by 1),
  f as (select * from (values ('tad', 'TAD', 'diaria', 1), ('odoo', 'Órdenes de Odoo', 'diaria', 2), ('instalaciones', 'Órdenes de instalación', 'diaria', 3), ('kmz', 'Mapa de red (KMZ)', 'mapa', 4),
                              ('cambios', 'Cambios de categoría', 'cuando', 5), ('ip', 'IP de clientes empresariales', 'cuando', 6), ('dedicados', 'Dedicados', 'cuando', 7)) v(k, n, frec, o))
  select jsonb_build_object(
    'fuentes', (select jsonb_agg(jsonb_build_object('k', f.k, 'nombre', f.n, 'frecuencia', f.frec,
        'ultima', case when f.k = 'kmz' then (select max(m.subido_en) from public.mapas_red m where m.estado in ('vigente', 'lista', 'activo')) else (select u.en from u where u.fuente = f.k) end,
        'al_dia', case f.frec when 'diaria' then coalesce(((select u.en from u where u.fuente = f.k) at time zone 'America/Caracas')::date = hoy, false)
                              when 'mapa' then exists (select 1 from public.mapas_red m) else true end,
        'tarde', f.frec = 'diaria' and h >= 17 and coalesce((select extract(hour from u.en at time zone 'America/Caracas') from u where u.fuente = f.k and (u.en at time zone 'America/Caracas')::date = hoy), 0) < 17) order by f.o) from f),
    'historial', (select coalesce(jsonb_agg(jsonb_build_object('fecha', z.fecha, 'cargas', z.l) order by z.fecha desc), '[]'::jsonb)
        from (select (c.subido_en at time zone 'America/Caracas')::date fecha, jsonb_agg(jsonb_build_object('id', c.id, 'fuente', c.fuente, 'archivo', c.archivo_nombre, 'en', c.subido_en,
                'por', privado.nombre_de(c.subido_por), 'estado', c.estado, 'filas', c.filas_total, 'resumen', c.resumen) order by c.subido_en desc) l
              from public.cargas c where c.subido_en > now() - interval '30 days' and c.estado in ('lista', 'con_errores', 'fallo') group by 1) z),
    'cruce_pendiente', exists (select 1 from public.cargas c where c.fuente in ('odoo', 'instalaciones') and c.estado in ('lista', 'con_errores')
        and not coalesce((c.resumen->>'solo_aliados')::boolean, false) and (ult_cruce is null or c.subido_en > ult_cruce)),
    'ult_cruce', ult_cruce)
  into res;
  return res;
end $$;

-- Permisos (migración lote28_permisos): las funciones nuevas solo para usuarios con sesión
revoke execute on function public.perfiles_equipos(), public.perfil_equipo_guardar(uuid, text), public.orden_horas_guardar(integer), public.carta_enviar(bigint, text, text),
  public.comisiones_lista(date), public.cliente_nuevo(text, text, bigint), public.cliente_nuevo_enviar(bigint), public.comisiones_resumen(date), public.comisiones_detalle(date, text, text, integer),
  public.clientes_panel(), public.gestion_plazo(bigint, date), public.clientes_resumen(date, text), public.clientes_detalle(date, text, text, text, integer),
  public.nota_guardar(bigint, text, date, bigint), public.nota_hecha(bigint, boolean), public.revision_lote_lista(text, boolean, text, integer, integer), public.revision_lote(jsonb),
  public.actualizar_estado() from public, anon;
grant execute on function public.perfiles_equipos(), public.perfil_equipo_guardar(uuid, text), public.orden_horas_guardar(integer), public.carta_enviar(bigint, text, text),
  public.comisiones_lista(date), public.cliente_nuevo(text, text, bigint), public.cliente_nuevo_enviar(bigint), public.comisiones_resumen(date), public.comisiones_detalle(date, text, text, integer),
  public.clientes_panel(), public.gestion_plazo(bigint, date), public.clientes_resumen(date, text), public.clientes_detalle(date, text, text, text, integer),
  public.nota_guardar(bigint, text, date, bigint), public.nota_hecha(bigint, boolean), public.revision_lote_lista(text, boolean, text, integer, integer), public.revision_lote(jsonb),
  public.actualizar_estado() to authenticated;

-- Migración lote28_a3_clientes_otros: el líder ve los clientes de otros líderes solo para consultar
create or replace function public.clientes_otros(p_busca text default null, p_desde integer default 0, p_limite integer default 30) returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare r text := privado.exigir('lider'); yo uuid := (select auth.uid()); q text := privado.norm(coalesce(p_busca, '')); dg text := regexp_replace(coalesce(p_busca, ''), '\D', '', 'g'); res jsonb;
begin
  with f as (select c.id, c.nombre, c.doc_tipo, c.doc_numero, c.estatus, coalesce(privado.nombre_de(c.lider_id), c.lider_nombre, 'Sin líder') lider,
               (select count(*) from public.servicios s where s.cliente_id = c.id) n_serv
             from public.clientes c left join public.dedicados d on d.cliente_id = c.id
             where c.unido_a is null and c.suspendido_en is null and c.lider_id is distinct from yo and d.ejecutiva_id is distinct from yo and not c.provisional
               and (q = '' or privado.norm(c.nombre) like '%' || q || '%' or (length(dg) >= 4 and c.doc_numero like '%' || dg || '%')))
  select jsonb_build_object('total', (select count(*) from f),
    'filas', coalesce((select jsonb_agg(jsonb_build_object('nombre', z.nombre, 'doc', z.doc_tipo || '-' || z.doc_numero, 'lider', z.lider, 'grupo', privado.grupo_legal(z.estatus), 'n_serv', z.n_serv) order by z.nombre)
      from (select * from f order by f.nombre offset greatest(coalesce(p_desde, 0), 0) limit least(greatest(coalesce(p_limite, 30), 1), 60)) z), '[]'::jsonb))
  into res;
  return res;
end $$;
revoke execute on function public.clientes_otros(text, integer, integer) from public, anon;
grant execute on function public.clientes_otros(text, integer, integer) to authenticated;

-- lote28_a3_cliente_gestiones: gestiones activas de un cliente (franja de la ficha)
create or replace function public.cliente_gestiones(p_cliente bigint) returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare r text := privado.exigir_cliente(p_cliente);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('gestion', g.id, 'nombre', g.nombre, 'estado', gc.estado, 'desde', gc.actualizado_en, 'plazo', g.plazo, 'nota', gc.nota) order by g.plazo nulls last)
    from public.gestion_clientes gc join public.gestiones g on g.id = gc.gestion_id where gc.cliente_id = p_cliente and g.estado = 'activa'), '[]'::jsonb);
end $$;
revoke execute on function public.cliente_gestiones(bigint) from public, anon;
grant execute on function public.cliente_gestiones(bigint) to authenticated;

-- lote28 (aplicado con privado.reemplazar_en_funcion): privado.res_clientes cuenta en 5 grupos
--   nums 'completos' -> 'Contratos firmados' (grupo firmado, x 'todos:firmado')
--   gráfica legal: v = [sin_gestionar, faltan, revision, por_firmar, firmado] (mismo orden que res_dedicados)

-- lote28 revisión final (aplicado con privado.reemplazar_en_funcion):
--   public.cliente_nuevo: unir a un provisional parecido ya no le pone dueño (lo elige la Senior en Por instalar); la bitácora guarda el líder.
--   privado.com_filas_det: la gráfica 'serie' solo acepta un corte AAAA-MM-01 entre 2025-01-01 y el corte en curso + 1 mes.
--   public.comisiones_detalle: el líder ve el detalle de sus filas y de las filas de aliados (v_ali = dueños de equipo aliados del corte),
--     ya no el de cualquier cliente que alguna vez tuvo una instalación de aliado.
