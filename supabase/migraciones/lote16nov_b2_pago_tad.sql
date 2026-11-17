-- Lote 16/11 B, tramo 2 (18/11): pago por TAD. Se marca pagada la instalación cuando ningún servicio PYME o residencial del cliente
-- que vino en ese TAD tiene deuda (el TAD marca la deuda por RIF). Los dedicados (categoría DEDICADO o sucursal 900) no cuentan.
-- Se mantienen los 3 días. El pago quitado a mano lo sigue respetando el disparador privado.pago_respetar.

create or replace function privado.servicio_dedicado(p_categoria text, p_sucursal text) returns boolean language sql immutable set search_path to '' as $$
  select coalesce(p_categoria, '') ilike 'DEDICADO%' or coalesce(p_sucursal, '') = '900'
$$;

select privado.redefinir('public.tad_cerrar'::regproc::regprocedure, jsonb_build_array(jsonb_build_array(
  E'    and (select count(*) from public.servicios s where s.cliente_id=i.cliente_id) = 1\n    and exists (select 1 from public.servicios s where s.cliente_id=i.cliente_id and s.visto_en_carga=p_carga and s.con_deuda is false)',
  E'    and exists (select 1 from public.servicios s where s.cliente_id=i.cliente_id and s.visto_en_carga=p_carga and not privado.servicio_dedicado(s.categoria, s.sucursal))\n    and not exists (select 1 from public.servicios s where s.cliente_id=i.cliente_id and s.visto_en_carga=p_carga and not privado.servicio_dedicado(s.categoria, s.sucursal) and s.con_deuda is not false)\n    and not coalesce(i.pago_quitado, false)')));

select privado.redefinir('privado.cruzar'::regproc::regprocedure, jsonb_build_array(jsonb_build_array(
  E'      and (select count(*) from public.servicios s where s.cliente_id = x.cliente_id) = 1\n      and exists (select 1 from public.servicios s where s.cliente_id = x.cliente_id and s.visto_en_carga = v_t and s.con_deuda is false)',
  E'      and exists (select 1 from public.servicios s where s.cliente_id = x.cliente_id and s.visto_en_carga = v_t and not privado.servicio_dedicado(s.categoria, s.sucursal))\n      and not exists (select 1 from public.servicios s where s.cliente_id = x.cliente_id and s.visto_en_carga = v_t and not privado.servicio_dedicado(s.categoria, s.sucursal) and s.con_deuda is not false)\n      and not coalesce(x.pago_quitado, false)')));

-- Una vez: la regla nueva con el último TAD cargado (las que hoy cumplen la regla y siguen sin pago). Bitácora por instalación.
create or replace function privado.pago_tad_aplicar(p_carga bigint) returns jsonb language plpgsql security definer set search_path to '' as $$
declare r record; ids jsonb := '[]'::jsonb;
begin
  for r in select i.id, i.sucursal, i.codigo from public.instalaciones i
    where i.pago_ok_en is null and i.cliente_id is not null and not coalesce(i.pago_quitado, false)
      and i.id in (select f.instalacion_id from privado.comision_filas3(privado.corte_en_curso()) f)
      and exists (select 1 from public.servicios s where s.cliente_id = i.cliente_id and s.visto_en_carga = p_carga and not privado.servicio_dedicado(s.categoria, s.sucursal))
      and not exists (select 1 from public.servicios s where s.cliente_id = i.cliente_id and s.visto_en_carga = p_carga and not privado.servicio_dedicado(s.categoria, s.sucursal) and s.con_deuda is not false)
      and (i.instalada_en at time zone 'America/Caracas')::date + privado.pago_dias_tad() <= privado.hoy() loop
    update public.instalaciones set pago_ok_en = now() where id = r.id;
    insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues) values (null, 'pago_tad', 'instalaciones', r.id::text, jsonb_build_object('carga', p_carga, 'regla', 'todos los servicios PYME y residenciales sin deuda (lote 16/11 B)'));
    ids := ids || jsonb_build_array(r.sucursal || '-' || ltrim(r.codigo, '0'));
  end loop;
  return ids;
end $$;
revoke all on function privado.pago_tad_aplicar(bigint) from public, anon, authenticated;
