-- Corrida 14/10 tarde, Parte 2: pendientes por módulo y sin "Hecho".
-- Un pendiente solo sale cuando la condición deja de cumplirse. privado.pendientes_hechos queda sin uso (no se borra).

-- Módulo de cada tipo de pendiente (Mi trabajo, Inicio y el menú cuentan desde aquí)
create or replace function privado.modulo_de(p_tipo text) returns text
 language sql immutable set search_path to ''
as $function$
  select case
    when p_tipo in ('docs_faltan', 'devuelto', 'por_firmar', 'sin_gestion', 'rif_verificar') then 'expedientes'
    when p_tipo in ('por_instalar', 'por_enviar', 'sin_ip', 'por_asignar', 'certificar', 'sin_cliente', 'sin_servicio') then 'comisiones'
    when p_tipo in ('cambio_emitir', 'sin_solicitud', 'cambio_comision', 'planilla') then 'migraciones'
    when p_tipo in ('vgt', 'poliza') then 'dedicados'
    when p_tipo in ('referido') then 'aliados'
    else 'otros' end
$function$;

create or replace function privado.pendientes()
 returns table(tipo text, clave text, cliente_id bigint, titulo text, detalle text, lider_id uuid, analista_id uuid, para text, desde timestamp with time zone, vence date, ref jsonb)
 language plpgsql stable security definer set search_path to ''
as $function$
declare d_orden int := privado.dias_ajuste('dias_orden_sin_instalar', 15); d_docs int := privado.dias_ajuste('dias_sin_documentos', 30);
  d_env int := privado.dias_ajuste('dias_por_enviar', 3); d_cam int := privado.dias_ajuste('dias_cambio_por_emitir', 2);
  actual date := privado.corte_en_curso(); lim date := privado.corte_limite(privado.corte_en_curso()); ini timestamptz := privado.corte_cierre((privado.corte_en_curso() - interval '1 month')::date);
  hoy date := privado.hoy();
begin
  -- Analista: cambios por emitir (sale al marcar Emitido)
  return query select 'cambio_emitir'::text, c.id::text, (select x.id from public.clientes x where x.doc_numero = c.titular_doc and x.unido_a is null order by x.id limit 1),
    coalesce(c.titular_nombre, 'Cambio'), case when c.tipo = 'categoria' then 'Cambio de categoría a ' || coalesce(c.categoria_nueva, '') else 'Cambio de titular' || case when c.tipo = 'ambos' then ' y categoría' else '' end end,
    c.lider_id, privado.analista_de(c.lider_id), 'analista'::text, coalesce(c.aprobado_en, c.creado_en), (coalesce(c.aprobado_en, c.creado_en) at time zone 'America/Caracas')::date + d_cam, jsonb_build_object('cambio', c.id)
  from public.cambios c where c.estado = 'por_emitir';
  -- Senior: cambios sin solicitud (sale al vincular, "Fue un error" o "Revertido")
  return query select 'sin_solicitud'::text, c.id::text, null::bigint, coalesce(c.titular_nombre, 'Cambio sin solicitud'), coalesce(c.categoria_anterior, '?') || ' a ' || coalesce(c.categoria_nueva, '?'),
    null::uuid, null::uuid, 'senior'::text, c.creado_en, (c.creado_en at time zone 'America/Caracas')::date + d_cam, jsonb_build_object('cambio', c.id)
  from public.cambios c where c.estado = 'sin_solicitud';
  -- Senior: cambios confirmados con la comisión por decidir (sale al decidir Sí o No)
  return query select 'cambio_comision'::text, c.id::text, null::bigint, coalesce(c.titular_nombre, 'Cambio de categoría'), coalesce(c.categoria_anterior, '?') || ' a ' || coalesce(c.categoria_nueva, '?') || ': ¿comisiona?',
    c.lider_id, null::uuid, 'senior'::text, c.confirmado_en, (c.confirmado_en at time zone 'America/Caracas')::date + d_cam, jsonb_build_object('cambio', c.id)
  from public.cambios c where c.estado = 'confirmado' and c.comision = 'por_decidir'
    and (coalesce(c.fecha_cambio, c.confirmado_en) at time zone 'America/Caracas')::date >= privado.cambios_desde();
  -- Analista: órdenes de Odoo sin instalar (desde el 01/10; sale cuando llega la instalación o Odoo la cancela)
  return query select 'por_instalar'::text, o.orden_id::text, o.cliente_id, coalesce(o.cliente, 'Cliente nuevo'), 'Orden ' || coalesce(o.numero, '') || ' sin instalar' || case when o.veces > 0 then ', reprogramada ' || o.veces || ' veces' else '' end,
    o.lider_id, privado.analista_de(o.lider_id), case when o.lider_id is null then 'senior' else 'analista' end, o.inicio, (o.inicio at time zone 'America/Caracas')::date + d_orden, jsonb_build_object('orden', o.orden_id)
  from privado.ordenes_abiertas() o where o.creada_en >= privado.instalar_desde();
  -- Analista: proformas y cartas por enviar (sale al registrar el envío) y servicios sin IP (sale al escribir la IP)
  return query select case when b.sin_ip then 'sin_ip' else 'por_enviar' end, b.instalacion_id::text, b.cliente_id, b.nombre,
    case when b.sin_ip then 'Falta la IP del servicio ' else 'Proforma y carta por enviar del servicio ' end || b.sucursal || '-' || b.codigo,
    l.lid, privado.analista_de(l.lid), case when l.lid is null then 'senior' else 'analista' end, b.instalada_en, (b.instalada_en at time zone 'America/Caracas')::date + d_env, jsonb_build_object('servicio', b.servicio_id, 'instalacion', b.instalacion_id)
  from privado.bienvenidas_filas() b
  cross join lateral (select coalesce(i.lider_id, o.vendedor_id, privado.lider_por_nombre(b.lider)) lid from public.instalaciones i left join public.ordenes_odoo o on o.id = i.orden_id where i.id = b.instalacion_id) l;
  -- Datos por corregir: RIF por verificar (sale al quitar la marca en Editar dedicado), instalación sin cliente, cliente sin servicio enlazado
  return query select 'rif_verificar'::text, dd.cliente_id::text, dd.cliente_id, c.nombre, coalesce(dd.verificar_motivo, 'RIF por verificar'), c.lider_id, privado.analista_de(c.lider_id),
    case when c.lider_id is null then 'senior' else 'analista' end, coalesce(dd.actualizado_en, dd.creado_en), (coalesce(dd.actualizado_en, dd.creado_en) at time zone 'America/Caracas')::date + d_docs, jsonb_build_object('dedicado', true)
  from public.dedicados dd join public.clientes c on c.id = dd.cliente_id where dd.verificar;
  return query select 'sin_cliente'::text, i.id::text, null::bigint, coalesce(i.nombre, 'Instalación sin nombre'), 'Instalación ' || i.sucursal || '-' || i.codigo || ' sin cliente en la app',
    null::uuid, null::uuid, 'senior'::text, i.instalada_en, (i.instalada_en at time zone 'America/Caracas')::date + d_env, jsonb_build_object('instalacion', i.id)
  from public.instalaciones i where i.instalada_en >= ini and i.cliente_id is null and privado.comisionable(i.categoria, i.es_aliado);
  return query select 'sin_servicio'::text, i.id::text, i.cliente_id, c.nombre, 'La instalación ' || i.sucursal || '-' || i.codigo || ' no tiene servicio enlazado',
    coalesce(i.lider_id, c.lider_id), privado.analista_de(coalesce(i.lider_id, c.lider_id)), case when coalesce(i.lider_id, c.lider_id) is null then 'senior' else 'analista' end,
    i.instalada_en, (i.instalada_en at time zone 'America/Caracas')::date + d_env, jsonb_build_object('instalacion', i.id)
  from public.instalaciones i join public.clientes c on c.id = i.cliente_id
  where i.instalada_en >= ini and i.servicio_id is null and coalesce(i.equipo, '') <> 'CAMBIO' and privado.comisionable(i.categoria, i.es_aliado)
    and not exists (select 1 from public.servicios s where s.cliente_id = i.cliente_id and s.sucursal = i.sucursal and ltrim(s.codigo, '0') = ltrim(i.codigo, '0'));
  -- Senior: lo que le falta al corte en curso. Sin la orden confirmada es "por asignar"; con la orden, "para certificar" (Legal o pago)
  return query select case when not f.orden_ok then 'por_asignar' else 'certificar' end, f.instalacion_id::text, f.cliente_id, f.nombre,
    concat_ws(', ', case when not f.orden_ok then 'falta asignar la orden' end, case when not f.legal_ok then 'falta Legal' end, case when not f.pago_ok then 'falta el pago' end),
    f.lider_id, privado.analista_de(f.lider_id), 'senior'::text, f.instalada_en, lim, jsonb_build_object('instalacion', f.instalacion_id, 'corte', actual)
  from privado.comision_filas3(actual) f where not f.cumple;
  -- Líder: documentos que faltan o devueltos (sale al subirlos), contratos por firmar (sale al firmar)
  return query select case when exists (select 1 from public.documentos x where x.cliente_id = c.id and x.estado = 'devuelto') then 'devuelto' else 'docs_faltan' end, c.id::text, c.id, c.nombre,
    case when exists (select 1 from public.documentos x where x.cliente_id = c.id and x.estado = 'devuelto') then 'Legal devolvió documentos: corrígelos' else 'Faltan ' || privado.casillas_vacias(c.id) || ' documentos' end,
    c.lider_id, privado.analista_de(c.lider_id), 'lider'::text, coalesce(c.estatus_desde, c.creado_en), (coalesce(c.estatus_desde, c.creado_en) at time zone 'America/Caracas')::date + d_docs, jsonb_build_object('estatus', c.estatus)
  from public.clientes c where c.unido_a is null and c.lider_id is not null and c.estatus in ('documentos_solicitados', 'documentos_pendientes')
    and (privado.casillas_vacias(c.id) > 0 or exists (select 1 from public.documentos x where x.cliente_id = c.id and x.estado = 'devuelto'));
  return query select 'por_firmar'::text, c.id::text, c.id, c.nombre, 'Contrato por firmar', c.lider_id, privado.analista_de(c.lider_id), 'lider'::text, c.estatus_desde,
    (c.estatus_desde at time zone 'America/Caracas')::date + d_docs, jsonb_build_object('estatus', c.estatus)
  from public.clientes c where c.unido_a is null and c.lider_id is not null and c.estatus = 'por_firmar';
  -- Líder: planillas de titularidad sin firmar o incompletas (sale al completar los requisitos)
  return query select 'planilla'::text, c.id::text, c.nuevo_cliente_id, coalesce(c.titular_nombre, 'Cambio de titular'), 'Faltan documentos del cambio de titular a ' || coalesce(c.nuevo_nombre, ''),
    c.lider_id, privado.analista_de(c.lider_id), 'lider'::text, c.creado_en, (c.creado_en at time zone 'America/Caracas')::date + d_cam, jsonb_build_object('cambio', c.id)
  from public.cambios c where c.lider_id is not null and c.tipo in ('titularidad', 'ambos') and c.estado in ('por_aprobar', 'por_emitir', 'emitido')
    and exists (select 1 from jsonb_array_elements(privado.cambio_requisitos(c.id)) r where not (r->>'ok')::boolean);
  -- Líder: referidos que le pasaron (sale con una gestión en el hilo del cliente después del referido, o cuando cambia su etiqueta)
  return query select 'referido'::text, f.id::text, f.cliente_id, coalesce(nullif(btrim(coalesce(f.nombre, '') || ' ' || coalesce(f.apellido, '')), ''), 'Referido ' || coalesce(f.rif, '')), 'Referido de un aliado: contáctalo',
    l.lid, privado.analista_de(l.lid), 'lider'::text, f.creado_en, (f.creado_en at time zone 'America/Caracas')::date + d_env, jsonb_build_object('referido', f.id)
  from public.aliado_referidos f cross join lateral (select privado.lider_por_nombre(f.lider_nombre) lid) l
  where f.etiqueta = 'aceptado' and l.lid is not null
    and not exists (select 1 from public.clientes x where x.id = f.cliente_id and x.ultima_gestion_en > f.creado_en);
  -- Líder: dedicados con requisitos VGT incompletos (sale al subirlos)
  return query select 'vgt'::text, dd.cliente_id::text, dd.cliente_id, c.nombre, 'Faltan ' || privado.vgt_faltan(dd.cliente_id) || ' requisitos VGT', c.lider_id, privado.analista_de(c.lider_id), 'lider'::text,
    dd.creado_en, (dd.creado_en at time zone 'America/Caracas')::date + d_docs, jsonb_build_object('dedicado', true)
  from public.dedicados dd join public.clientes c on c.id = dd.cliente_id where c.lider_id is not null and privado.vgt_faltan(dd.cliente_id) > 0;
  -- Líder: pólizas VGT vencidas o que vencen en 30 días (sale al subir la renovación con su vencimiento nuevo)
  return query select 'poliza'::text, p.cliente_id || ':' || p.numero, p.cliente_id, c.nombre,
    case when p.numero = 66 then 'Póliza de responsabilidad civil' else 'Póliza de responsabilidad patronal' end || case when p.vence < hoy then ' vencida' else ' por vencer' end || ': pide la renovación',
    c.lider_id, privado.analista_de(c.lider_id), case when c.lider_id is null then 'senior' else 'lider' end, (p.vence - 30)::timestamptz, p.vence, jsonb_build_object('dedicado', true, 'poliza', p.numero)
  from (select d.cliente_id, d.numero, max(d.vence_en) vence from public.documentos d
        where d.casilla = 'otro' and d.numero in (66, 67) and d.vence_en is not null and d.estado <> 'devuelto' group by 1, 2) p
  join public.clientes c on c.id = p.cliente_id
  where c.unido_a is null and p.vence <= hoy + 30;
  -- Líder: clientes instalados en este corte o el anterior a los que no se les ha pedido nada (sale con una gestión en el hilo o al cambiar el estatus)
  return query select 'sin_gestion'::text, c.id::text, c.id, c.nombre, 'Instalado y sin gestión: pide los documentos', c.lider_id, privado.analista_de(c.lider_id), 'lider'::text,
    coalesce(c.ultima_gestion_en, c.creado_en), (coalesce(c.ultima_gestion_en, c.creado_en) at time zone 'America/Caracas')::date + 3, jsonb_build_object('estatus', c.estatus)
  from public.clientes c
  cross join lateral (select min(i.instalada_en) ins from public.instalaciones i where i.cliente_id = c.id and i.instalada_en >= ini and privado.comisionable(i.categoria, i.es_aliado)) x
  where c.unido_a is null and c.lider_id is not null and c.estatus = 'grandes_negocios' and x.ins is not null
    and (c.ultima_gestion_en is null or c.ultima_gestion_en < x.ins);
end $function$;

-- Sin "Hecho": la bandeja es exactamente lo que sigue pendiente (lo marcado antes como hecho vuelve si la condición sigue)
create or replace function privado.trabajo_mio(p_persona uuid)
 returns table(tipo text, clave text, cliente_id bigint, titulo text, detalle text, lider_id uuid, analista_id uuid, para text, desde timestamp with time zone, vence date, ref jsonb)
 language plpgsql stable security definer set search_path to ''
as $function$
declare v_yo uuid := (select auth.uid()); r text := privado.rol_actual(); senior boolean := privado.es_senior();
  canales boolean := coalesce((select pf.canales from public.perfiles pf where pf.id = (select auth.uid())), false);
begin
  return query select p.* from privado.pendientes() p
  where case
      when r = 'admin' then p_persona is null or p.analista_id = p_persona or p.lider_id = p_persona
      when r = 'lider' then p.para = 'lider' and p.lider_id = v_yo
      when r = 'analista' and canales then p.para in ('analista', 'senior') and (p_persona is null or p.analista_id = p_persona)
      when r = 'analista' and senior then (p.para = 'analista' and (p.analista_id = v_yo or p.analista_id is null)) or p.para = 'senior'
      when r = 'analista' then p.para = 'analista' and p.analista_id = v_yo
      else false end;
end $function$;

create or replace function public.trabajo_hecho(p_tipo text, p_clave text, p_nota text)
 returns void language plpgsql security definer set search_path to ''
as $function$
begin
  perform privado.exigir('admin', 'analista', 'lider');
  raise exception 'Los pendientes ya no se marcan a mano: salen solos cuando se resuelven' using errcode = 'P0001';
end $function$;

create or replace function public.trabajo(p_persona uuid)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare r text := privado.exigir('admin', 'analista', 'lider'); hoy date := privado.hoy(); senior boolean := privado.es_senior();
  canales boolean := coalesce((select pf.canales from public.perfiles pf where pf.id = (select auth.uid())), false);
begin
  return jsonb_build_object('rol', r, 'senior', senior, 'canales', canales, 'hoy', hoy,
    'dias', (select jsonb_object_agg(a.clave, a.valor) from privado.ajustes_app a where a.clave like 'dias_%'),
    'personas', case when r = 'admin' or canales then (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'rol', p.rol) order by p.rol, p.nombre), '[]'::jsonb)
      from public.perfiles p where p.activo and p.rol in ('analista', 'lider') and (r = 'admin' or p.rol = 'analista')) else '[]'::jsonb end,
    'aliados', case when r = 'admin' or canales then privado.aliados_pendientes() end,
    'filas', coalesce((select jsonb_agg(jsonb_build_object('tipo', t.tipo, 'modulo', privado.modulo_de(t.tipo), 'clave', t.clave, 'cliente_id', t.cliente_id, 'titulo', t.titulo, 'detalle', t.detalle, 'para', t.para,
        'desde', t.desde, 'vence', t.vence, 'color', case when t.vence < hoy then 'rojo' when t.vence = hoy then 'ambar' else 'verde' end, 'nuevo', t.desde > now() - interval '1 day',
        'lider', privado.nombre_de(t.lider_id), 'analista', privado.nombre_de(t.analista_id), 'ref', t.ref)
      order by case when t.vence < hoy then 0 when t.vence = hoy then 1 else 2 end, t.desde desc) from privado.trabajo_mio(p_persona) t), '[]'::jsonb));
end $function$;

-- Lo que espera en Aliados (solo administrador y coordinación de canales)
create or replace function privado.aliados_pendientes() returns jsonb
 language sql stable security definer set search_path to ''
as $function$
  select jsonb_build_object(
    'solicitudes', (select count(*) from public.aliado_solicitudes s where s.etiqueta in ('analizando', 'recaudos', 'excepcion', 'revision', 'lista', 'listaobs', 'curso')),
    'referidos', (select count(*) from public.aliado_referidos f where f.etiqueta in ('referido', 'aceptado')),
    'pagos', (select count(*) from public.aliado_solicitudes s where s.etiqueta = 'instalada' and s.pagada_en is null and s.instalada_por = s.aliado_id) + (select count(*) from public.aliado_referidos f where f.etiqueta = 'instalado'),
    'sin_permiso', (select count(*) from public.aliado_sin_permiso x where x.revisado_en is null and x.origen = 'carga'))
$function$;

-- Resumen para Inicio y el menú: total, por tipo y por módulo (Aliados suma lo que espera en su módulo)
create or replace function public.trabajo_resumen()
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare hoy date := privado.hoy(); r text := coalesce(privado.rol_actual(), '');
  canales boolean := coalesce((select pf.canales from public.perfiles pf where pf.id = (select auth.uid())), false); al jsonb; nal int := 0;
begin
  if r not in ('admin', 'analista', 'lider') then return null; end if;
  if r = 'admin' or canales then al := privado.aliados_pendientes();
    nal := coalesce((al->>'solicitudes')::int, 0) + coalesce((al->>'pagos')::int, 0) + coalesce((al->>'sin_permiso')::int, 0); end if;
  return (with t as (select x.*, privado.modulo_de(x.tipo) m from privado.trabajo_mio(null) x)
    select jsonb_build_object('total', (select count(*) from t), 'rojo', (select count(*) from t where t.vence < hoy), 'hoy', (select count(*) from t where t.vence = hoy),
      'tipos', coalesce((select jsonb_object_agg(x.tipo, jsonb_build_object('n', x.n, 'rojo', x.r)) from (select t.tipo, count(*) n, count(*) filter (where t.vence < hoy) r from t group by t.tipo) x), '{}'::jsonb),
      'modulos', (select jsonb_object_agg(k, jsonb_build_object('n', coalesce(x.n, 0) + case when k = 'aliados' then nal else 0 end, 'rojo', coalesce(x.r, 0), 'hoy', coalesce(x.h, 0)))
        from unnest(array['expedientes', 'comisiones', 'migraciones', 'dedicados', 'aliados']) k
        left join (select t.m, count(*) n, count(*) filter (where t.vence < hoy) r, count(*) filter (where t.vence = hoy) h from t group by t.m) x on x.m = k),
      'aliados', al));
end $function$;
