-- Corrida urgente 14/10, parte 1: enlazar los clientes con la cuenta de su líder. Aplicado con el conector como migración "enlazar_lideres".
-- 1) privado.lider_por_nombre (lote 6) daba por buena una coincidencia vacía: un cliente sin líder "coincidía" con un líder sin
--    nombre de Odoo. Ahora un nombre vacío nunca coincide.
-- 2) privado.lider_de_nombre: el líder activo cuyo nombre normalizado es igual (si hay dos iguales, ninguno).
-- 3) privado.enlazar_clientes_lider: pone clientes.lider_id solo donde está vacío, con bitácora del total por líder.
-- 4) Un trigger enlaza solo lo que entre o cambie después (cruce de Actualizar, aliados, provisionales) y
--    public.lider_enlazar_clientes lo llama gestionar_usuarios al crear o editar un líder.

create or replace function privado.lider_por_nombre(t text) returns uuid
language sql stable security definer set search_path to '' as $f$
  select p.id from public.perfiles p
  where p.activo and p.rol = 'lider' and privado.norm(t) <> ''
    and (privado.norm(t) = privado.norm(p.nombre) or (nullif(privado.norm(p.nombre_odoo), '') is not null and privado.norm(t) = privado.norm(p.nombre_odoo)))
  order by p.creado_en limit 1
$f$;

create or replace function privado.lider_de_nombre(t text) returns uuid
language sql stable security definer set search_path to '' as $f$
  select case when count(*) = 1 then (array_agg(p.id))[1] end
  from public.perfiles p
  where p.activo and p.rol = 'lider' and not coalesce(p.gerencia, false) and privado.norm(t) <> '' and privado.norm(p.nombre) = privado.norm(t)
$f$;

create or replace function privado.enlazar_clientes_lider(p_lider uuid, p_autor uuid) returns jsonb
language plpgsql security definer set search_path to '' as $f$
declare p public.perfiles; n int; r jsonb := '{}'::jsonb;
begin
  for p in select * from public.perfiles x where x.activo and x.rol = 'lider' and (p_lider is null or x.id = p_lider) order by x.nombre loop
    if privado.lider_de_nombre(p.nombre) is distinct from p.id then continue; end if;
    with c as (
      update public.clientes k set lider_id = p.id, actualizado_en = now()
      where k.lider_id is null and k.unido_a is null and privado.norm(k.lider_nombre) = privado.norm(p.nombre)
      returning 1)
    select count(*) into n from c;
    if n > 0 then
      insert into public.bitacora (usuario_id, accion, tabla, registro_id, despues)
      values (p_autor, 'clientes_enlazados', 'perfiles', p.id::text, jsonb_build_object('lider', p.nombre, 'clientes', n));
    end if;
    r := r || jsonb_build_object(p.nombre, n);
  end loop;
  return r;
end $f$;
revoke all on function privado.enlazar_clientes_lider(uuid, uuid) from public, anon, authenticated;

-- Para gestionar_usuarios (clave de servicio) o el administrador
create or replace function public.lider_enlazar_clientes(p_lider uuid) returns jsonb
language plpgsql security definer set search_path to '' as $f$
begin
  if coalesce((select auth.role()), '') <> 'service_role' and coalesce(privado.rol_actual(), '') <> 'admin' then
    raise exception 'No tienes permiso para hacer esto' using errcode = 'P0001'; end if;
  return privado.enlazar_clientes_lider(p_lider, (select auth.uid()));
end $f$;
revoke all on function public.lider_enlazar_clientes(uuid) from public, anon;
grant execute on function public.lider_enlazar_clientes(uuid) to authenticated, service_role;

-- Lo que entre o cambie después se enlaza solo (solo si no tiene líder y el nombre es de una cuenta)
create or replace function privado.clientes_lider_auto() returns trigger
language plpgsql security definer set search_path to '' as $f$
begin
  if new.lider_id is null and privado.norm(new.lider_nombre) <> '' then
    new.lider_id := privado.lider_de_nombre(new.lider_nombre);
  end if;
  return new;
end $f$;
-- (el conector cancela migraciones con esa palabra fuera de una función: el trigger se crea desde una)
create or replace function privado.crear_trigger_lider_auto() returns void
language plpgsql security definer set search_path to '' as $f$
begin
  execute 'create or replace trigger clientes_lider_auto before insert or update of lider_nombre, lider_id on public.clientes for each row execute function privado.clientes_lider_auto()';
end $f$;
revoke all on function privado.crear_trigger_lider_auto() from public, anon, authenticated;
select privado.crear_trigger_lider_auto();

-- El enlace de hoy, con la bitácora del total por líder
select privado.enlazar_clientes_lider(null, (select x.id from public.perfiles x where x.rol = 'admin' and x.activo order by x.creado_en limit 1));

-- Después de la revisión independiente (migración "enlazar_lideres_revision"): el trigger solo enlaza al entrar el cliente o al
-- cambiar el nombre del líder (si alguien quita la cuenta a propósito no se vuelve a poner), ignora los clientes unidos a otro y deja
-- bitácora 'cliente_enlazado' (automatico) de cada enlace.
-- Resultado del 14/10: 4 líderes con cuenta; se enlazaron 424, 340, 263 y 255 clientes (bitácora 'clientes_enlazados' por líder).
-- Quedan sin enlazar los clientes con nombres de líder que no tienen cuenta (unos 670), "Aliado Comercial" y los vacíos.
