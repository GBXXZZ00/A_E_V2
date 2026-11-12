-- Lote 12/11 B, parte 5b: casillas del aliado (tipos leídos por archivo y combinados)
CREATE OR REPLACE FUNCTION public.solicitud_estado(p_sol bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.aliado_solicitudes; r text; adm boolean; v_solo boolean := false; c public.clientes; rp public.representantes; k public.ia_corridas; ver boolean; vl text := privado.ia_ajuste('version_lector');
begin
  perform privado.al_sincronizar();
  r := privado.rol_actual();
  if r in ('lider', 'abogado') or (r = 'analista' and not exists (select 1 from public.aliado_solicitudes z where z.id = p_sol and z.aliado_id = privado.mi_aliado())) then
    select * into s from public.aliado_solicitudes where id = p_sol;
    if not found then raise exception 'No se encontró la solicitud' using errcode = 'P0001'; end if;
    v_solo := true;
  else
    s := privado.al_solicitud(p_sol);
  end if;
  adm := r = 'admin';
  ver := adm or s.etiqueta not in ('cartera', 'otro');
  if ver and s.cliente_id is not null then
    select * into c from public.clientes where id = s.cliente_id;
    select * into rp from public.representantes where cliente_id = s.cliente_id and orden = 1;
  end if;
  if ver and s.corrida_id is not null then select * into k from public.ia_corridas where id = s.corrida_id; end if;
  return privado.al_fila(s) || jsonb_build_object(
    'excepcion', s.excepcion, 'respuesta', s.respuesta, 'ya_instale_en', s.ya_instale_en, 'cerrada_en', s.cerrada_en,
    'vence_en', case when s.etiqueta in ('lista', 'listaobs', 'curso') then s.aprobada_en + interval '30 days' when s.etiqueta = 'borrador' then s.creada_en + interval '7 days' end,
    'lider', case when adm and s.bloqueo is not null then (select coalesce(cc.lider_nombre, '') from public.clientes cc where cc.id = s.cliente_id) end,
    'es_admin', adm, 'solo_ver', v_solo, 'aprobada_en', s.aprobada_en,
    'bitacora', case when r <> 'aliado' then coalesce((select jsonb_agg(jsonb_build_object('accion', b.accion, 'en', b.en, 'por', privado.nombre_de(b.usuario_id), 'despues', b.despues) order by b.en desc)
       from public.bitacora b where b.tabla = 'aliado_solicitudes' and b.registro_id = s.id::text), '[]'::jsonb) end,
    'contacto', case when ver then jsonb_build_object('correo', rp.correo, 'telefono', rp.telefono, 'correo_empresa', c.correo_empresa) end,
    'docs', case when ver and s.cliente_id is not null then coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'casilla', d.casilla, 'numero', d.numero, 'estado', d.estado,
        'archivos', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'nombre', a.nombre,
            'lectura', (select l.estado from public.ia_lecturas l where l.archivo_id = a.id and l.version_lector = vl),
            -- Lote 12/11 B: qué documentos se reconocieron en el archivo (para "Esto parece X, no Y" y los combinados)
            'tipos', (select jsonb_agg(h ->> 'tipo') from public.ia_lecturas l, jsonb_array_elements(case when jsonb_typeof(l.hallazgos) = 'array' then l.hallazgos else '[]'::jsonb end) h
                      where l.archivo_id = a.id and l.version_lector = vl)) order by da.orden)
          from public.documento_archivos da join public.archivos a on a.id = da.archivo_id where da.documento_id = d.id and coalesce(da.vigente, true)), '[]'::jsonb))
        order by d.casilla, d.numero)
      from public.documentos d where d.cliente_id = s.cliente_id), '[]'::jsonb) else '[]'::jsonb end,
    'ia', case when k.id is not null then jsonb_build_object('estado', k.estado, 'veredicto', k.veredicto, 'total', k.total, 'avance', k.avance, 'puntos', k.puntos,
      'marcas', coalesce((select jsonb_agg(jsonb_build_object('documento', m.documento_id, 'propuesta', m.propuesta, 'motivo', m.motivo, 'nota', m.nota)) from public.ia_marcas m where m.corrida_id = k.id), '[]'::jsonb)) end,
    'hilo', coalesce((select jsonb_agg(jsonb_build_object('texto', h.texto, 'color', h.color, 'en', h.en) order by h.en desc, h.id desc) from public.aliado_hilo h where h.solicitud_id = s.id), '[]'::jsonb));
end $function$;

-- Lote 12/11 B: "Viene en otro archivo": el mismo archivo ya subido de la solicitud queda también en otra casilla (sin subirlo de nuevo); "Quitar" lo saca
create or replace function public.solicitud_casilla_enlazar(p_sol bigint, p_archivo bigint, p_casilla text, p_numero int, p_quitar boolean default false)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare s public.aliado_solicitudes; yo uuid := (select auth.uid()); did bigint; v_num int := coalesce(p_numero, 0);
begin
  s := privado.al_solicitud(p_sol);
  if s.cliente_id is null then raise exception 'Primero sube el RIF' using errcode = 'P0001'; end if;
  if s.etiqueta in ('cartera', 'otro', 'instalada', 'noprocede') then raise exception 'Esta solicitud ya no se puede cambiar' using errcode = 'P0001'; end if;
  if p_casilla not in ('cedula', 'rif_personal', 'rif_empresa', 'acta_constitutiva', 'acta_asamblea') then raise exception 'Casilla no reconocida' using errcode = 'P0001'; end if;
  if p_casilla in ('cedula', 'rif_personal', 'acta_asamblea') then
    if v_num not between 1 and (case when p_casilla = 'acta_asamblea' then 15 else 10 end) then raise exception 'Número de casilla no válido' using errcode = 'P0001'; end if;
  else v_num := 0; end if;
  if not exists (select 1 from public.documento_archivos da join public.documentos d on d.id = da.documento_id
                 where da.archivo_id = p_archivo and d.cliente_id = s.cliente_id) then
    raise exception 'Ese archivo no es de esta solicitud' using errcode = 'P0001'; end if;
  if p_quitar then
    select id into did from public.documentos where cliente_id = s.cliente_id and casilla = p_casilla and numero = v_num;
    if did is null then return jsonb_build_object('ok', true); end if;
    update public.documento_archivos set vigente = false where documento_id = did and archivo_id = p_archivo;
    if not exists (select 1 from public.documento_archivos where documento_id = did and coalesce(vigente, true)) then
      update public.documentos set estado = 'devuelto', motivo = 'otro', nota = 'Se quitó el archivo' where id = did;
    end if;
    insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues)
    values (yo, 'documento_desenlazado', 'documentos', did::text, jsonb_build_object('cliente', s.cliente_id, 'casilla', p_casilla, 'numero', v_num, 'archivo', p_archivo, 'solicitud', s.id));
  else
    insert into public.documentos (cliente_id, casilla, numero, estado, subido_por, subido_en)
    values (s.cliente_id, p_casilla, v_num, 'por_revisar', yo, now())
    on conflict (cliente_id, casilla, numero) do update set estado = 'por_revisar', motivo = null, subido_por = yo, subido_nombre = null, subido_en = now()
    returning id into did;
    update public.documento_archivos set vigente = false where documento_id = did and vigente and archivo_id <> p_archivo;
    insert into public.documento_archivos (documento_id, archivo_id, orden, vigente) values (did, p_archivo, 1, true)
    on conflict (documento_id, archivo_id) do update set vigente = true, orden = 1;
    insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues)
    values (yo, 'documento_enlazado', 'documentos', did::text, jsonb_build_object('cliente', s.cliente_id, 'casilla', p_casilla, 'numero', v_num, 'archivo', p_archivo, 'solicitud', s.id));
    insert into public.hilo (cliente_id, tipo, texto, detalle, autor_id) values (s.cliente_id, 'documento_subido', '1', jsonb_build_object('casillas', jsonb_build_array(jsonb_build_object('casilla', p_casilla, 'numero', v_num)), 'mismo_archivo', true), yo);
  end if;
  perform privado.recalcular(s.cliente_id, yo);
  return jsonb_build_object('ok', true, 'documento', did);
end $function$;
revoke all on function public.solicitud_casilla_enlazar(bigint, bigint, text, int, boolean) from public, anon;
grant execute on function public.solicitud_casilla_enlazar(bigint, bigint, text, int, boolean) to authenticated;
