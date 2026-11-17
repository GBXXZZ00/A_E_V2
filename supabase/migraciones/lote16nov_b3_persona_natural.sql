-- Lote 16/11 B, tramo 3 (18/11): persona natural. Desde el corte de noviembre 2026, a una PYME o migración de persona natural
-- el legal no le frena la comisión (la subida de documentos es opcional). Cambio de dos líneas sobre la versión del 17/11
-- (respaldo en respaldo_18nov/comision_filas3_antes.sql). El arrastre del corte anterior y la regla del certificado no cambian.
select privado.redefinir('privado.comision_filas3'::regproc::regprocedure, jsonb_build_array(
  jsonb_build_array(E'    coalesce(leg < lts, false), coalesce(pag < lts, false),\n    (coalesce(leg < lts and pag < lts, false) or coalesce(exc <= p_corte, false)) and ook,',
    E'    coalesce(leg < lts, false) or (nat and p_corte >= date ''2026-11-01''), coalesce(pag < lts, false),\n    (coalesce((leg < lts or (nat and p_corte >= date ''2026-11-01'')) and pag < lts, false) or coalesce(exc <= p_corte, false)) and ook,')));
