-- Lote S1: sesiones (cerrar al restablecer PIN o desactivar, sesión viva) y ajuste de horas sin uso
alter table public.perfiles add column if not exists sesiones_desde timestamptz;
comment on column public.perfiles.sesiones_desde is 'Lote S: las sesiones abiertas antes de esta hora ya no valen (PIN restablecido o cuenta desactivada)';

create or replace function privado.rol_actual()
 returns text language sql stable security definer set search_path to ''
as $function$
  select p.rol from public.perfiles p
  where p.id = (select auth.uid()) and p.activo
    and (p.sesiones_desde is null or exists (
      select 1 from auth.sessions s
      where s.id = nullif((select auth.jwt()) ->> 'session_id', '')::uuid and s.created_at >= p.sesiones_desde))
$function$;

create or replace function public.sesiones_cerrar(p_id uuid)
 returns void language plpgsql security definer set search_path to ''
as $function$
begin
  update public.perfiles set sesiones_desde = now() where id = p_id;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues)
  values (null, 'sesiones_cerradas', 'perfiles', p_id::text, jsonb_build_object('desde', now()));
end $function$;
revoke all on function public.sesiones_cerrar(uuid) from public, anon, authenticated;
grant execute on function public.sesiones_cerrar(uuid) to service_role;

create or replace function public.sesion_viva()
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare v_sid uuid := nullif((select auth.jwt()) ->> 'session_id', '')::uuid; v_h int;
begin
  select case when valor ~ '^\d+$' then valor::int end into v_h from privado.ia_ajustes where clave = 'inactividad_horas';
  return jsonb_build_object(
    'viva', (select auth.uid()) is not null and privado.rol_actual() is not null
            and (v_sid is null or exists (select 1 from auth.sessions s where s.id = v_sid)),
    'horas', coalesce(v_h, 12));
end $function$;
revoke all on function public.sesion_viva() from public, anon;
grant execute on function public.sesion_viva() to authenticated;

create or replace function public.inactividad_guardar(p_horas int)
 returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_yo uuid := (select auth.uid()); ant text;
begin
  perform privado.exigir('admin');
  if p_horas is null or p_horas < 1 or p_horas > 72 then raise exception 'Escribe entre 1 y 72 horas' using errcode = 'P0001'; end if;
  select valor into ant from privado.ia_ajustes where clave = 'inactividad_horas';
  insert into privado.ia_ajustes (clave, valor) values ('inactividad_horas', p_horas::text)
  on conflict (clave) do update set valor = excluded.valor;
  insert into public.bitacora (usuario_id, accion, tabla, registro_id, antes, despues)
  values (v_yo, 'ajuste', 'ia_ajustes', 'inactividad_horas', jsonb_build_object('valor', ant), jsonb_build_object('valor', p_horas));
  return jsonb_build_object('horas', p_horas);
end $function$;
revoke all on function public.inactividad_guardar(int) from public, anon;
grant execute on function public.inactividad_guardar(int) to authenticated;

-- Limpieza: sin acceso para quien no entró
revoke execute on function public.cambio_categorias() from public, anon;
revoke execute on function public.ocr_ajustes() from public, anon;
revoke execute on function public.ocr_ajuste_guardar(text, boolean) from public, anon;
revoke all on table public.drive_inventario from anon, authenticated;

-- Probado en la base (21/10, con rollback): con la sesión del JWT, rol_actual da el rol; tras sesiones_cerrar da null y sesion_viva
--   dice viva=false; una sesión creada después vuelve a valer; queda 1 fila 'sesiones_cerradas' en la bitácora.
-- Funciones de borde (lote S): CORS solo https://gbxxzz00.github.io (y localhost para pruebas) en aliado_rif, drive_archivo, drive_subir,
--   entrar, gestionar_usuarios (v14, además llama sesiones_cerrar en "pin" y en "activo" = false), ocr_leer y resolver_enlace.
--   Probado con pg_net: una petición con Origin https://malo.com recibe Allow-Origin de github (el navegador la bloquea).
-- Pendiente del administrador en el panel de Supabase: borrar las funciones drive_prueba y drive_inventario, la tabla
--   public.drive_inventario (ya sin permisos) y privado.prueba_tmp (sin permisos para nadie): el conector no deja borrar.

-- S2 (revisión independiente): perfiles_leer, pendientes_leer, consultas_fact_leer y consultas_fact_hist_leer exigen sesión válida en la rama
--   del propio usuario; es_senior, es_coordinador, mi_aliado, puede_hecho y pin_cambiado también (privado.rol_actual() is not null).
--   Probado con rollback: tras sesiones_cerrar la sesión vieja ve 0 perfiles, es_senior da false y pin_cambiado falla.
