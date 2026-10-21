-- Lote C (21/10). Migraciones lote_c1_avisos_aliados y lote_c2_app_vieja.
-- Recorrido de una cuenta de aliado de prueba con las RPC reales y rollback (no quedó ninguna cuenta): pedir permiso por un cliente de un líder
--   (bloqueo: aviso al aliado, al líder dueño y al administrador, 1 cada uno), cliente nuevo devuelto (1) y aprobado (1), instalado (1), pago (1);
--   pago confirmado por el TAD al líder (1) y cuenta bloqueada al administrador (1). La campana del aliado agrupa 'Aliados' y 'Pagos de aliados'.
-- App vieja (21/10, ejecutado): 9 clientes creados (sin nombre en ninguna fuente: 'RIF J-... (app anterior)', documentos recibidos, sin líder),
--   49 documentos traídos por revisar (48 de esos 9 y 1 de la persona natural, en su empresa). La fila 'no tocar' sigue sin traer.

-- Lote C1: avisos de aliados que faltaban (notificaciones.md sección 4), pago confirmado por el TAD (al líder) y cuenta bloqueada (al administrador)
create or replace function privado.avisos_aliados()
 returns trigger language plpgsql security definer set search_path to ''
as $function$
declare s public.aliado_solicitudes; r public.aliado_referidos; a public.aliados; c public.clientes; p record; quien uuid; mot text; nom text; e text;
begin
  begin
    if new.accion in ('aliado_bloqueado', 'aliado_intento_top', 'aliado_decision') or (new.accion = 'pago_aliado' and new.tabla = 'aliado_solicitudes') then
      select * into s from public.aliado_solicitudes where id = new.registro_id::bigint;
      select * into a from public.aliados where id = s.aliado_id;
      select x.id into quien from public.perfiles x where x.id = a.perfil_id and x.activo;
      if s.cliente_id is not null then select * into c from public.clientes where id = s.cliente_id; end if;
      nom := coalesce(c.nombre, s.nombre, 'el cliente');
    end if;
    if new.accion in ('aliado_bloqueado', 'aliado_intento_top') then
      mot := case new.despues ->> 'bloqueo' when 'top' then 'Es un cliente reservado de la empresa.' when 'cartera' then 'Ya es cliente de un líder: puedes referirlo.'
        when 'odoo' then 'Ya hay una orden en curso para ese cliente.' when 'otro_aliado' then 'Otro aliado ya lo está gestionando.' else 'Ya es cliente de la empresa.' end;
      if quien is not null then perform privado.aviso_poner(quien, 'aliado', 'Solicitud bloqueada', nom || ': ' || mot, 'aliados.html?s=' || s.id, 'b:' || new.id, false); end if;
      if c.lider_id is not null then perform privado.aviso_poner(c.lider_id, 'aliado', 'Un aliado intentó tu cliente', coalesce(a.nombre, 'Un aliado') || ' pidió permiso por ' || nom || '. Quedó bloqueado.', 'clientes.html?c=' || c.id, 'b:' || new.id, false); end if;
      for p in select x.id from public.perfiles x where x.activo and x.rol = 'admin' and not coalesce(x.gerencia, false) loop
        perform privado.aviso_poner(p.id, 'aliado', 'Aliado bloqueado', coalesce(a.nombre, 'Un aliado') || ' intentó ' || nom || '. ' || mot, 'aliados.html?s=' || s.id, 'b:' || new.id, false);
      end loop;
    elsif new.accion = 'aliado_decision' then
      e := new.despues ->> 'etiqueta';
      if quien is not null and e in ('lista', 'noprocede', 'recaudos') then
        perform privado.aviso_poner(quien, 'aliado', case e when 'lista' then 'Permiso aprobado' when 'noprocede' then 'Permiso rechazado' else 'Te devolvieron la solicitud' end,
          nom || ': ' || case e when 'lista' then 'ya puedes instalar.' else coalesce(nullif(new.despues ->> 'texto', ''), 'revisa la respuesta del administrador.') end, 'aliados.html?s=' || s.id, 'b:' || new.id, false);
      end if;
      if c.lider_id is not null and e in ('lista', 'noprocede') then
        perform privado.aviso_poner(c.lider_id, 'aliado', case e when 'lista' then 'Aprobaron un permiso de aliado' else 'Rechazaron un permiso de aliado' end,
          coalesce(a.nombre, 'Un aliado') || ' por ' || nom || '.', 'clientes.html?c=' || c.id, 'b:' || new.id, false);
      end if;
    elsif new.accion = 'pago_aliado' then
      if new.tabla = 'aliado_referidos' then
        select * into r from public.aliado_referidos where id = new.registro_id::bigint;
        select x.id into quien from public.perfiles x join public.aliados y on y.perfil_id = x.id where y.id = r.aliado_id and x.activo;
        nom := coalesce(nullif(btrim(coalesce(r.nombre, '') || ' ' || coalesce(r.apellido, '')), ''), 'tu referido');
      end if;
      if quien is not null then perform privado.aviso_poner(quien, 'aliado_pago', 'Pago registrado', 'Se registró tu pago por ' || nom || '.', 'aliados.html', 'b:' || new.id, false); end if;
    elsif new.accion = 'acceso_bloqueado' then
      nom := case when new.registro_id ~ '^[0-9a-f-]{36}$' then coalesce(privado.nombre_de(new.registro_id::uuid), new.registro_id) else new.registro_id end;
      for p in select x.id from public.perfiles x where x.activo and x.rol = 'admin' and not coalesce(x.gerencia, false) loop
        perform privado.aviso_poner(p.id, 'cuenta', 'Cuenta bloqueada', 'La cuenta de ' || coalesce(nom, 'alguien') || ' se bloqueó por intentos fallidos con el PIN. Si fue la persona, restablécele el PIN en Usuarios.', 'usuarios.html', 'b:' || new.id, false);
      end loop;
    end if;
  exception when others then
    raise warning 'aviso de aliado no creado: %', sqlerrm;
  end;
  return null;
end $function$;
create or replace trigger bitacora_avisos_aliados after insert on public.bitacora for each row
  when (new.accion in ('aliado_bloqueado', 'aliado_intento_top', 'aliado_decision', 'pago_aliado', 'acceso_bloqueado'))
  execute function privado.avisos_aliados();

-- Instalado: la solicitud o el referido pasan a instalado (lo marca el cruce con las instalaciones)
create or replace function privado.avisos_aliado_instalado()
 returns trigger language plpgsql security definer set search_path to ''
as $function$
declare quien uuid; nom text;
begin
  begin
    select x.id into quien from public.perfiles x join public.aliados y on y.perfil_id = x.id where y.id = new.aliado_id and x.activo;
    if quien is not null then
      if tg_table_name = 'aliado_solicitudes' then nom := coalesce((select k.nombre from public.clientes k where k.id = new.cliente_id), new.nombre, 'Tu cliente');
      else nom := coalesce(nullif(btrim(coalesce(new.nombre, '') || ' ' || coalesce(new.apellido, '')), ''), 'Tu referido'); end if;
      perform privado.aviso_poner(quien, 'aliado', 'Instalado', nom || ' quedó instalado.', case when tg_table_name = 'aliado_solicitudes' then 'aliados.html?s=' || new.id else 'aliados.html' end,
        'inst:' || tg_table_name || ':' || new.id, false);
    end if;
  exception when others then raise warning 'aviso de instalado no creado: %', sqlerrm;
  end;
  return null;
end $function$;
create or replace trigger aliado_sol_instalado after update of etiqueta on public.aliado_solicitudes for each row
  when (new.etiqueta = 'instalada' and old.etiqueta is distinct from 'instalada') execute function privado.avisos_aliado_instalado();
create or replace trigger aliado_ref_instalado after update of etiqueta on public.aliado_referidos for each row
  when (new.etiqueta = 'instalado' and old.etiqueta is distinct from 'instalado') execute function privado.avisos_aliado_instalado();

-- Pago confirmado por el TAD: al líder dueño, informativo
create or replace function privado.avisos_pago_tad()
 returns trigger language plpgsql security definer set search_path to ''
as $function$
begin
  begin
    perform privado.aviso_poner(new.lider_id, 'comision', 'Pago confirmado en el TAD', coalesce(new.nombre, 'Tu cliente') || ': el pago de la instalación ya está.',
      case when new.cliente_id is not null then 'clientes.html?c=' || new.cliente_id || '&t=comision' else 'comisiones.html' end, 'pagotad:' || new.id, false);
  exception when others then raise warning 'aviso de pago no creado: %', sqlerrm;
  end;
  return null;
end $function$;
create or replace trigger instalacion_pago_tad after update of pago_ok_en on public.instalaciones for each row
  when (old.pago_ok_en is null and new.pago_ok_en is not null and new.lider_id is not null and new.anulada_en is null)
  execute function privado.avisos_pago_tad();
