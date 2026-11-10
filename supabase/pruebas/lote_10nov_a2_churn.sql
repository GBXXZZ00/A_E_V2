-- Lote 10/11 A2: reglas de churn decididas el 10/11 (se aplicó como migración lote10_a2_churn_reglas)
-- Estado del TAD manda; I = instalación, S = última suspensión, A = última activación.
create or replace function privado.churn_clase(p_estado text, p_inst date, p_s date, p_a date, p_ret date, p_hoy date)
returns table(clase text, perdida date, reactivada date, raras boolean)
language plpgsql immutable set search_path to ''
as $f$
declare hab boolean := p_estado = 'Habilitado'; inf boolean;
begin
  raras := (hab and p_s is not null and (p_a is null or p_s > p_a)) or (not hab and p_s is null) or (not hab and p_a is not null and p_s is not null and p_a > p_s);
  reactivada := null; perdida := null;
  if p_ret is not null then clase := 'baja'; perdida := p_ret; return next; return; end if;
  inf := p_s is not null and p_inst is not null and p_s - p_inst <= 60;
  if hab then
    if p_s is null or p_a is null or p_a < p_s then clase := 'normal'; return next; return; end if;
    -- volvió a Habilitado (A >= S): un mes ya cerrado no se recalcula
    if inf and date_trunc('month', p_a) > date_trunc('month', p_s) then clase := 'reactivado'; perdida := p_s; reactivada := p_a;
    elsif not inf and p_a - p_s > 80 then clase := 'reactivado'; perdida := p_s; reactivada := p_a;
    elsif not inf and p_s is not null and p_a > p_s then clase := 'reactivado'; reactivada := p_a;
    else clase := 'normal'; end if;
    return next; return;
  end if;
  -- Suspendido (el Estado manda aunque las fechas digan otra cosa)
  if p_s is null then clase := 'posible'; return next; return; end if;
  if inf then clase := 'infancia'; perdida := p_s;
  elsif p_hoy - p_s > 80 then clase := 'perdida'; perdida := p_s;
  else clase := 'posible'; end if;
  return next;
end $f$;

-- srv_base: la pérdida sale de las reglas nuevas (misma firma; S cae a la bitácora de estados si el TAD no la trae)
-- privado.srv_churn: clase por servicio (normal, infancia, posible, perdida, reactivado, baja) y "fechas por revisar"
create or replace function privado.srv_churn(v_l uuid)
returns table(id bigint, cliente_id bigint, nombre text, codigo text, estado text, fecha date, s date, a date, clase text, perdida date, reactivada date, raras boolean)
language sql stable security definer set search_path to ''
as $f$
  select b.id, b.cliente_id, b.nombre, b.codigo, sv.estado, b.fecha, sv.ult_suspension, sv.ult_habilitacion, k.clase, k.perdida, k.reactivada, k.raras
  from privado.srv_base(v_l) b join public.servicios sv on sv.id = b.id
  cross join lateral privado.churn_clase(sv.estado, sv.fecha_instalacion,
      coalesce(sv.ult_suspension, case when sv.estado is distinct from 'Habilitado' then (select max(e.fecha) from public.servicio_estados e where e.servicio_id = sv.id and e.estado is distinct from 'Habilitado' and e.estado_antes = 'Habilitado') end),
      sv.ult_habilitacion, sv.retirado_en, privado.hoy()) k
$f$;
-- Lista "fechas por revisar" (solo administrador)
create or replace function public.churn_revisar()
returns jsonb language plpgsql stable security definer set search_path to ''
as $f$
declare r text := privado.exigir('admin');
begin
  return jsonb_build_object('total', (select count(*) from privado.srv_churn(null) x where x.raras),
    'filas', coalesce((select jsonb_agg(jsonb_build_object('cliente_id', x.cliente_id, 'nombre', x.nombre, 'codigo', x.codigo, 'estado', x.estado, 's', x.s, 'a', x.a,
        'motivo', case when x.estado = 'Habilitado' then 'Habilitado con suspensión después de la activación' when x.s is null then 'Suspendido sin fecha de suspensión' else 'Suspendido con activación después de la suspensión' end)
      order by x.nombre) from (select * from privado.srv_churn(null) y where y.raras limit 500) x), '[]'::jsonb),
    'clases', (select jsonb_object_agg(z.clase, z.n) from (select y.clase, count(*) n from privado.srv_churn(null) y group by y.clase) z));
end $f$;
revoke all on function public.churn_revisar() from public, anon; grant execute on function public.churn_revisar() to authenticated;
revoke all on function privado.srv_churn(uuid) from public, anon, authenticated;
create or replace function privado.srv_base(v_l uuid)
 RETURNS TABLE(id bigint, cliente_id bigint, nombre text, codigo text, seg text, vgt boolean, activo boolean, suspendido boolean, fecha date, perdida date, dueno text, equipo text, lider_id uuid, estatus text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  select s.id, c.id, c.nombre, s.sucursal || '-' || s.codigo,
    case when c.es_isp then 'isp' when d.cliente_id is not null and d.excluido_en is null then 'corporativo' else 'pyme' end,
    exists (select 1 from public.dedicado_contratos k where k.cliente_id = c.id and k.tipo = 'vgt'),
    s.estado = 'Habilitado' and s.retirado_en is null, s.estado is distinct from 'Habilitado' and s.retirado_en is null,
    s.fecha_instalacion,
    -- Lote 10/11 A2: reglas de churn (infancia, pérdida a los 80 días, reactivación; mes cerrado no se recalcula)
    (select k.perdida from privado.churn_clase(s.estado, s.fecha_instalacion,
        coalesce(s.ult_suspension, case when s.estado is distinct from 'Habilitado' then (select max(e.fecha) from public.servicio_estados e where e.servicio_id = s.id and e.estado is distinct from 'Habilitado' and e.estado_antes = 'Habilitado') end),
        s.ult_habilitacion, s.retirado_en, privado.hoy()) k),
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
    and (c.es_isp or (d.cliente_id is not null and d.excluido_en is null) or privado.norm(coalesce(s.categoria, '')) !~ '(dedicad|conectiv)') $function$;
