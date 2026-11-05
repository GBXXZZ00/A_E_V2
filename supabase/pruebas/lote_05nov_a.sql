-- Lote 05/11, parte A (en curso). Migración lote05_a1_a2_firma_separada_y_estatus.
-- A1 privado.requeridos: solo con firma conjunta cuentan los representantes extra con datos o archivos.
--    Antes: 118 clientes (272 casillas) pedían cédula/RIF de representantes extra sin ser conjunta. Después: 0.
select count(distinct c.id) from public.clientes c, lateral privado.requeridos(c.id) r
where r.r_numero > 1 and coalesce(c.regimen_firma, '') <> 'conjunta' and c.unido_a is null;
--    No se recalculó en masa: en prueba (deshecha), recalcular a esos 118 bajaba 13 a "pendientes" por OTROS faltantes; se recalculan solos con su próximo documento.
--    reglas.mjs ya pedía 1 completo con firma separada (no se tocó).
-- A2 privado.poner_estatus: con 'auto' o 'migracion' no baja de contrato_en_curso, por_firmar ni contrato_firmado (solo el cambio manual).
--    Prueba deshecha: a los 262 clientes en esos estatus se les intentó bajar en automático y recalcular: 0 cambiaron.
--    Bitácora: los 3 casos de baja que existen fueron manuales (15/10 y 16/10).
-- Comisiones después: septiembre 46/41, octubre 83/75, noviembre 34/4 (igual que al empezar).
