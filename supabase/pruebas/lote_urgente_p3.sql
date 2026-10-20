-- Lote urgente 20/10, parte 3: el pago marcado a mano no lo quita nada salvo "Quitar pago" (migración pago_manual_respetar).
-- La carga del TAD (tad_cerrar) y el cruce (privado.cruzar) ya solo marcan pagos vacíos; esta guarda lo asegura en la base
-- para cualquier proceso futuro: un pago marcado a mano no se borra ni cambia de fecha, salvo que se quite a mano
-- (instalacion_pago con pagada = no, que pone pago_quitado). Un pago quitado a mano tampoco vuelve solo con el TAD.
CREATE OR REPLACE FUNCTION privado.pago_respetar()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $function$
begin
  -- Quitado a mano: el TAD no lo vuelve a marcar
  if old.pago_quitado and new.pago_quitado and old.pago_ok_en is null and new.pago_ok_en is not null then new.pago_ok_en := null; end if;
  -- Marcado a mano: nadie lo borra ni lo cambia, salvo quitarlo a mano
  if old.pago_manual and old.pago_ok_en is not null and not coalesce(new.pago_quitado, false) then new.pago_ok_en := old.pago_ok_en; end if;
  return new;
end $function$;
