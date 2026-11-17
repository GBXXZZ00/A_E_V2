-- Lote 16/11 A, tramo 1: herramientas, columnas nuevas y permisos (parte 5).
-- No toca privado.comision_filas3 ni el cálculo de comisiones.

-- Reescribe una función existente cambiando trozos exactos de su texto. Cada trozo debe aparecer exactamente una vez;
-- si no, no cambia nada y avisa. Sirve para funciones largas donde solo cambia una línea.
create or replace function privado.redefinir(p regprocedure, pares jsonb)
returns void language plpgsql security definer set search_path to '' as $$
declare t text := pg_get_functiondef(p); x jsonb; n int;
begin
  for x in select * from jsonb_array_elements(pares) loop
    n := (length(t) - length(replace(t, x->>0, ''))) / greatest(length(x->>0), 1);
    if n <> 1 then raise exception 'redefinir %: el trozo aparece % veces: %', p, n, left(x->>0, 120); end if;
    t := replace(t, x->>0, x->>1);
  end loop;
  execute t;
end $$;
revoke all on function privado.redefinir(regprocedure, jsonb) from public, anon, authenticated;

-- Columnas nuevas
alter table public.cambios add column if not exists borrador boolean not null default false;
alter table public.cambios add column if not exists sugerido_id uuid references public.perfiles(id);
alter table privado.cambios_cargas add column if not exists hasta date;
alter table privado.cambios_cargas add column if not exists resumen jsonb;
alter table public.ordenes_odoo add column if not exists perdida_en timestamptz;
alter table public.ordenes_odoo add column if not exists perdida_por uuid references public.perfiles(id);
alter table public.ordenes_odoo add column if not exists perdida_motivo text;

-- Coordinador de analistas: ve y hace lo mismo que la Senior
create or replace function privado.es_senior() returns boolean language sql stable security definer set search_path to '' as $$
  select coalesce((select p.rol = 'admin' or (p.rol = 'analista' and (p.senior or coalesce(p.coordinador, false))) from public.perfiles p where p.id = (select auth.uid()) and p.activo), false) and privado.rol_actual() is not null
$$;

-- Actualizar: administrador y todos los analistas (Senior, Coordinador, analistas y canales)
create or replace function privado.exigir_carga() returns uuid language plpgsql stable security definer set search_path to '' as $$
begin
  perform privado.exigir('admin', 'analista');
  return (select auth.uid());
end $$;

select privado.redefinir('public.tad_iniciar'::regproc::regprocedure, '[["privado.exigir_senior()", "privado.exigir_carga()"]]');
select privado.redefinir('public.crudo_iniciar'::regproc::regprocedure, '[["privado.exigir_senior()", "privado.exigir_carga()"]]');
select privado.redefinir('public.carga_solo_aliados'::regproc::regprocedure, '[["privado.exigir_senior()", "privado.exigir_carga()"]]');
select privado.redefinir('public.tad_permitir_corto'::regproc::regprocedure, '[["privado.exigir_senior()", "privado.exigir_carga()"]]');
select privado.redefinir('public.ip_reporte_cargar'::regproc::regprocedure, '[["privado.exigir_senior()", "privado.exigir_carga()"]]');
select privado.redefinir('public.actualizar_estado'::regproc::regprocedure, '[["privado.exigir_senior()", "privado.exigir_carga()"]]');
select privado.redefinir('public.tad_indice_iniciar'::regproc::regprocedure, '[["privado.exigir(''admin'')", "privado.exigir(''admin'', ''analista'')"]]');
select privado.redefinir('public.tad_indice_parte'::regproc::regprocedure, '[["privado.exigir(''admin'')", "privado.exigir(''admin'', ''analista'')"]]');
select privado.redefinir('public.tad_indice_comparar'::regproc::regprocedure, '[["privado.exigir(''admin'')", "privado.exigir(''admin'', ''analista'')"]]');
select privado.redefinir('public.tad_indice_bloques'::regproc::regprocedure, '[["privado.exigir(''admin'')", "privado.exigir(''admin'', ''analista'')"]]');
select privado.redefinir('public.tad_indice_marcar'::regproc::regprocedure, '[["privado.exigir(''admin'')", "privado.exigir(''admin'', ''analista'')"]]');
select privado.redefinir('public.tad_indice_cerrar'::regproc::regprocedure, '[["privado.exigir(''admin'')", "privado.exigir(''admin'', ''analista'')"]]');

-- Factibilidad: todos los cargos; cada quien ve lo suyo (administrador y analistas, todo)
select privado.redefinir('public.fact_cercanas'::regproc::regprocedure, '[["privado.exigir(''admin'', ''analista'', ''lider'')", "privado.exigir(''admin'', ''analista'', ''lider'', ''abogado'', ''aliado'')"]]');
select privado.redefinir('public.fact_consultar'::regproc::regprocedure, '[["privado.exigir(''admin'', ''analista'', ''lider'')", "privado.exigir(''admin'', ''analista'', ''lider'', ''abogado'', ''aliado'')"]]');
select privado.redefinir('public.fact_lista'::regproc::regprocedure, '[["privado.exigir(''admin'', ''analista'', ''lider'')", "privado.exigir(''admin'', ''analista'', ''lider'', ''abogado'', ''aliado'')"]]');
select privado.redefinir('privado.fact_exigir_consulta'::regproc::regprocedure, '[["privado.exigir(''admin'', ''analista'', ''lider'')", "privado.exigir(''admin'', ''analista'', ''lider'', ''abogado'', ''aliado'')"], ["v_rol = ''lider'' or (p_editar", "v_rol in (''lider'', ''abogado'', ''aliado'') or (p_editar"]]');

-- Gerencia: entra a todo como administrador, pero SOLO LECTURA. Cada pedido de una cuenta de gerencia corre en una
-- transacción de solo lectura (public.pre_request, que PostgREST llama antes de cada pedido); la base rechaza cualquier escritura.
-- rol_actual solo dice 'admin' cuando la transacción es de solo lectura; si no, sigue como hoy.
create or replace function privado.rol_actual() returns text language sql stable security definer set search_path to '' as $$
  select case when coalesce(p.gerencia, false) and current_setting('transaction_read_only', true) = 'on' then 'admin' else p.rol end
  from public.perfiles p
  where p.id = (select auth.uid()) and p.activo
    and (p.sesiones_desde is null or exists (
      select 1 from auth.sessions s
      where s.id = nullif((select auth.jwt()) ->> 'session_id', '')::uuid and s.created_at >= p.sesiones_desde))
$$;

create or replace function public.pre_request() returns void language plpgsql security definer set search_path to '' as $$
begin
  -- Lo poco que gerencia sí escribe: su sesión, sus avisos leídos y sus alertas
  if current_setting('request.path', true) in ('/rpc/sesion_viva', '/rpc/avisos_leer', '/rpc/avisos_leer_grupo', '/rpc/push_suscribir', '/rpc/push_quitar', '/rpc/pin_cambiado') then return; end if;
  if exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.gerencia) then
    perform set_config('transaction_read_only', 'on', true);
  end if;
end $$;
grant execute on function public.pre_request() to anon, authenticated;

alter role authenticator set pgrst.db_pre_request to 'public.pre_request';
notify pgrst, 'reload config';

-- Aliados para el equipo: cada quien ve solo lo suyo (sus clientes o los de su cartera). El administrador, todo.
create or replace function privado.al_mio(p_cliente bigint) returns boolean language plpgsql stable security definer set search_path to '' as $$
declare r text := privado.rol_actual(); yo uuid := (select auth.uid()); mis text[];
begin
  if r = 'admin' then return true; end if;
  if p_cliente is null or yo is null then return false; end if;
  if r = 'lider' then
    select array_remove(array[privado.norm(p.nombre), privado.norm(p.nombre_odoo)], '') into mis from public.perfiles p where p.id = yo;
    return privado.al_tu_cliente(p_cliente, yo, mis);
  end if;
  if r = 'analista' then
    return exists (select 1 from public.clientes c where c.id = p_cliente and c.lider_id is not null and privado.analista_de(c.lider_id) = yo);
  end if;
  return false;
end $$;

create or replace function public.aliados_registro() returns jsonb language plpgsql security definer set search_path to '' as $$
declare r text := privado.exigir('admin', 'analista', 'lider', 'abogado'); v_yo uuid := (select auth.uid()); v_mis text[];
begin
  if current_setting('transaction_read_only', true) <> 'on' then perform privado.al_sincronizar(); end if;
  select array_remove(array[privado.norm(p.nombre), privado.norm(p.nombre_odoo)], '') into v_mis from public.perfiles p where p.id = v_yo;
  return jsonb_build_object(
    'solicitudes', coalesce((select jsonb_agg(privado.al_fila(s) || jsonb_build_object('tu_cliente', privado.al_tu_cliente(s.cliente_id, v_yo, v_mis), 'revisado', s.revisado_en is not null and s.revisado_etiqueta = s.etiqueta, 'revisado_nota', s.revisado_nota,
        'carterizado', exists (select 1 from public.clientes k where k.id = s.cliente_id and k.lider_id is not null)) order by s.actualizada_en desc)
       from public.aliado_solicitudes s where s.id in (select z.id from public.aliado_solicitudes z where not (z.etiqueta = 'borrador' and z.rif is null) and (r = 'admin' or privado.al_mio(z.cliente_id)) order by z.actualizada_en desc limit 800)), '[]'::jsonb),
    'referidos', coalesce((select jsonb_agg(privado.rf_fila(f) || jsonb_build_object('tu_cliente', privado.al_tu_cliente(f.cliente_id, v_yo, v_mis), 'revisado', f.revisado_en is not null and f.revisado_etiqueta = f.etiqueta, 'revisado_nota', f.revisado_nota) order by f.creado_en desc)
       from public.aliado_referidos f where f.id in (select z.id from public.aliado_referidos z where r = 'admin' or privado.al_mio(z.cliente_id) order by z.creado_en desc limit 800)), '[]'::jsonb),
    'sin_permiso', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'origen', p.origen, 'cliente', coalesce(c.nombre, p.nombre), 'rif', coalesce(c.doc_tipo || c.doc_numero, p.doc_numero),
        'aliado', coalesce(a.nombre, initcap(p.instalador)), 'enlazado', p.aliado_id is not null, 'equipo', p.equipo, 'categoria', p.categoria, 'instalada_en', p.instalada_en,
        'revisado_en', p.revisado_en, 'nota', p.nota, 'tu_cliente', privado.al_tu_cliente(p.cliente_id, v_yo, v_mis), 'carterizado', c.lider_id is not null) order by p.instalada_en desc)
      from (select * from public.aliado_sin_permiso z where r = 'admin' or privado.al_mio(z.cliente_id) order by instalada_en desc limit 800) p left join public.aliados a on a.id = p.aliado_id left join public.clientes c on c.id = p.cliente_id), '[]'::jsonb),
    'viejas', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'cliente', v.razon, 'rif', v.rif_ocr, 'aliado', v.aliado, 'situacion', v.situacion,
        'tu_cliente', privado.al_tu_cliente(v.cliente_id, v_yo, v_mis)) order by v.aliado, v.razon) from privado.aliados_appsheet v where r = 'admin' or privado.al_mio(v.cliente_id)), '[]'::jsonb),
    'lideres', case when r = 'admin' then coalesce((select jsonb_agg(l order by l) from (select distinct btrim(lider_nombre) l from public.clientes where coalesce(btrim(lider_nombre), '') not in ('', 'Aliado Comercial')) z), '[]'::jsonb) else '[]'::jsonb end,
    'puedo', jsonb_build_object('decidir', r = 'admin' and current_setting('transaction_read_only', true) <> 'on', 'prueba', r = 'admin' and privado.mi_aliado() is not null, 'todo', r = 'admin'));
end $$;

create or replace function public.instalados_aliados() returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare r text := privado.exigir('admin', 'lider', 'analista', 'abogado');
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'cliente', coalesce(c.nombre, x.nombre), 'rif', coalesce(c.doc_tipo || c.doc_numero, x.doc_numero),
      'aliado', coalesce(a.nombre, initcap(x.instalador)), 'instalada_en', x.instalada_en, 'categoria', x.categoria, 'carterizado', c.lider_id is not null,
      'con_permiso', case when r = 'admin' then exists (select 1 from public.aliado_solicitudes s where s.instalacion_id = x.id) end) order by x.instalada_en desc)
    from (select * from public.instalaciones z where z.es_aliado and (r = 'admin' or privado.al_mio(z.cliente_id)) order by z.instalada_en desc limit 300) x
    left join public.clientes c on c.id = x.cliente_id
    left join public.aliado_instaladores ai on ai.texto = privado.norm(x.instalador)
    left join public.aliados a on a.id = ai.aliado_id), '[]'::jsonb);
end $$;

-- Aliado: solo abre la ficha de su cliente ya instalado
select privado.redefinir('public.cliente_ficha'::regproc::regprocedure, jsonb_build_array(jsonb_build_array(
  E'  select * into c from public.clientes where id = p_cliente;\n  if not found',
  E'  if v_rol = ''aliado'' and not exists (select 1 from public.aliado_solicitudes s where s.cliente_id = p_cliente and s.aliado_id = privado.mi_aliado() and s.etiqueta = ''instalada'') then\n    raise exception ''La ficha del cliente se abre cuando ya está instalado'' using errcode = ''P0001''; end if;\n  select * into c from public.clientes where id = p_cliente;\n  if not found')));

-- Ajuste (lote16nov_a4_coordinador_vista): el Coordinador tiene los permisos de la Senior, pero conserva su tablero en Mi trabajo
select privado.redefinir('privado.trabajo_vista'::regproc::regprocedure, '[["when r = ''admin'' or privado.es_senior() then ''admin'' when privado.es_coordinador() then ''coord''", "when r = ''admin'' then ''admin'' when privado.es_coordinador() then ''coord'' when privado.es_senior() then ''admin''"]]');
-- Ajuste (lote16nov_a5_coordinador_mi_trabajo): en Mi trabajo el Coordinador no cuenta como Senior (conserva su tablero del lote 11/11)
select privado.redefinir('public.mi_trabajo'::regproc::regprocedure, '[["senior boolean := privado.es_senior();", "senior boolean := privado.es_senior() and not privado.es_coordinador();"]]');
