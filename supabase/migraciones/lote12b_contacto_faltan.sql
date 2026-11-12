-- Lote 12/11 B, parte 2: contacto_destino manda faltan, todos, total y lista (nombres) para el mensaje al líder
CREATE OR REPLACE FUNCTION public.contacto_destino(p_caso text, p_id bigint, p_falta text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare yo uuid := (select auth.uid()); r text; me public.perfiles; c public.clientes; z public.cambios; i public.instalaciones; s public.aliado_solicitudes;
  v_lider uuid; v_paso text; v_motivo text; v_nombre text; v_detalle jsonb := '{}'; v_gestor boolean; v_ids uuid[]; v_propio boolean;
begin
  r := privado.exigir('admin', 'abogado', 'analista', 'lider', 'aliado');
  select * into me from public.perfiles where id = yo;
  if coalesce(me.gerencia, false) then raise exception 'No tienes permiso para hacer esto' using errcode = 'P0001'; end if;
  -- El aliado solo pregunta por sus solicitudes, y siempre le toca el administrador
  if r = 'aliado' and p_caso <> 'aliado' then raise exception 'No tienes permiso para hacer esto' using errcode = 'P0001'; end if;
  v_gestor := r = 'admin' or me.senior or me.coordinador;
  if p_caso = 'aliado' then
    select * into s from public.aliado_solicitudes where id = p_id;
    if s.id is null or (r = 'aliado' and s.aliado_id is distinct from privado.mi_aliado()) or r not in ('aliado', 'admin') then raise exception 'No tienes permiso para hacer esto' using errcode = 'P0001'; end if;
    v_nombre := coalesce((select k.nombre from public.clientes k where k.id = s.cliente_id), s.nombre, 'la solicitud ' || privado.al_codigo(s.id));
  elsif p_caso = 'cliente' then
    select * into c from public.clientes where id = p_id;
    if c.id is null then raise exception 'No existe ese cliente' using errcode = 'P0001'; end if;
    v_lider := c.lider_id; v_nombre := c.nombre;
  elsif p_caso = 'cambio' then
    select * into z from public.cambios where id = p_id;
    if z.id is null then raise exception 'No existe ese cambio' using errcode = 'P0001'; end if;
    v_lider := z.lider_id; v_nombre := coalesce(z.titular_nombre, z.nuevo_nombre);
    if z.cliente_id is not null then select * into c from public.clientes where id = z.cliente_id; end if;
  elsif p_caso = 'comision' then
    select * into i from public.instalaciones where id = p_id;
    if i.id is null then raise exception 'No existe esa instalación' using errcode = 'P0001'; end if;
    -- Dueño como en Comisiones: el puesto a mano manda; si no, el de la instalación o el vendedor de la orden
    v_lider := case when i.dueno_manual then i.lider_id else coalesce(i.lider_id, (select o.vendedor_id from public.ordenes_odoo o where o.id = i.orden_id)) end;
    v_nombre := i.nombre;
    if i.cliente_id is not null then select * into c from public.clientes where id = i.cliente_id; v_nombre := coalesce(c.nombre, v_nombre); end if;
  else raise exception 'Caso no reconocido' using errcode = 'P0001';
  end if;
  if r = 'lider' and v_lider is distinct from yo then raise exception 'No tienes permiso para hacer esto' using errcode = 'P0001'; end if;
  if p_caso = 'aliado' then v_paso := 'admin'; v_motivo := 'aliado';
  elsif p_caso = 'cambio' then
    v_paso := case z.estado when 'por_revisar' then 'admin' when 'por_emitir' then 'analista' when 'por_confirmar' then case when z.aviso is not null then 'analista' else 'admin' end
      when 'sin_registro' then 'admin' else 'lider' end;
    v_motivo := case z.estado when 'por_revisar' then 'cambio_revisar' when 'por_emitir' then 'cambio_emitir'
      when 'por_confirmar' then case when z.aviso is not null then z.aviso else 'cambio_tad' end when 'sin_registro' then 'cambio_registro' else 'cambio_listo' end;
    v_detalle := jsonb_build_object('tipo', z.tipo, 'estado', z.estado);
  elsif p_caso = 'cliente' and p_falta = 'vgt' then v_paso := 'lider'; v_motivo := 'vgt_polizas';
    v_detalle := jsonb_build_object('faltan', privado.vgt_faltan(c.id), 'tramos', (select jsonb_agg(jsonb_build_object('proyecto', k.proyecto, 'postes', k.postes) order by k.id)
      from public.dedicado_contratos k where k.cliente_id = c.id and k.tipo = 'vgt' and k.en_uso in ('SI', 'EN PROYECTO')));
  elsif p_caso = 'comision' and p_falta = 'pago' then v_paso := 'admin'; v_motivo := 'com_pago';
  elsif p_caso = 'comision' and p_falta = 'orden' then v_paso := 'lider'; v_motivo := 'com_orden';
  elsif p_caso = 'comision' and p_falta is null then v_paso := 'lider'; v_motivo := 'com_general';
  else
    if c.id is not null and exists (select 1 from public.documentos d where d.cliente_id = c.id and d.estado = 'devuelto') then
      v_paso := 'lider'; v_motivo := 'devuelto';
      v_detalle := jsonb_build_object('devueltos', (select jsonb_agg(jsonb_build_object('casilla', d.casilla, 'numero', d.numero, 'motivo', coalesce(d.motivo, d.nota)))
        from public.documentos d where d.cliente_id = c.id and d.estado = 'devuelto'));
    else
      v_paso := case c.estatus when 'documentos_recibidos' then 'admin' when 'documentos_en_revision' then 'admin' when 'contrato_en_curso' then 'legal' else 'lider' end;
      v_motivo := case c.estatus when 'documentos_solicitados' then 'docs_faltan' when 'documentos_pendientes' then 'docs_faltan'
        when 'documentos_recibidos' then 'docs_revisar' when 'documentos_en_revision' then 'docs_revisar' when 'contrato_en_curso' then 'contrato'
        when 'por_firmar' then 'firma' else 'general' end;
      -- Lote 12/11 B: el mensaje al líder nombra lo que falta: todos, hasta 3 por su nombre o cuántos
      if c.id is not null and v_motivo = 'docs_faltan' then v_detalle := jsonb_build_object('faltan', privado.casillas_vacias(c.id),
        'todos', not exists (select 1 from public.documentos d where d.cliente_id = c.id),
        'total', (select count(*) from jsonb_array_elements(privado.faltantes(c.id)) x where not coalesce((x->>'dato')::boolean, false)),
        'lista', coalesce((select jsonb_agg(jsonb_build_object('k', x->>'k', 't', x->>'t', 'n', x->'n')) from jsonb_array_elements(privado.faltantes(c.id)) x
          where x->>'e' = 'falta' and not coalesce((x->>'dato')::boolean, false)), '[]'::jsonb)); end if;
    end if;
    if p_caso = 'comision' then v_motivo := 'com_legal_' || v_motivo; end if;
  end if;
  if p_caso = 'comision' then v_detalle := v_detalle || jsonb_build_object('cierra', privado.corte_limite(privado.corte_en_curso())); end if;
  select array_agg(x) into v_ids from privado.contacto_personas(v_paso, v_lider) x;
  v_propio := yo = any (coalesce(v_ids, '{}'));
  if v_gestor and not v_propio and v_paso = 'analista' and v_lider is not null and not (v_lider = any (coalesce(v_ids, '{}'))) then v_ids := v_ids || v_lider; end if;
  return jsonb_build_object('paso', v_paso, 'motivo', v_motivo, 'propio', v_propio, 'cliente', v_nombre, 'detalle', v_detalle,
    'destinos', case when v_propio then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'rol', case when p.id = v_lider then 'lider' else p.rol end,
      'whatsapp', p.whatsapp, 'correo', p.correo) order by array_position(v_ids, p.id)) from public.perfiles p where p.id = any (v_ids) and p.id <> yo), '[]'::jsonb) end);
end $function$
;
