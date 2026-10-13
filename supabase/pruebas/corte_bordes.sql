-- Bordes del período de comisiones (regla con vigencia en privado.corte_reglas). Correr con el conector: todo debe dar true.
select
  privado.corte_de('2026-09-20') = '2026-09-01' as sep_20_es_septiembre,
  privado.corte_de('2026-09-21') = '2026-10-01' as sep_21_abre_octubre,
  privado.corte_de('2026-10-17') = '2026-10-01' as oct_17_es_octubre,
  privado.corte_de('2026-10-18') = '2026-11-01' as oct_18_es_noviembre,
  privado.corte_de('2026-10-20') = '2026-11-01' as oct_20_es_noviembre,
  privado.corte_inicio('2026-10-01') = '2026-09-21' and privado.corte_fin('2026-10-01') = '2026-10-17' as octubre_21_09_a_17_10,
  privado.corte_inicio('2026-11-01') = '2026-10-18' and privado.corte_fin('2026-11-01') = '2026-11-17' as noviembre_18_10_a_17_11,
  privado.corte_limite('2026-10-01') = '2026-10-18' and privado.corte_certifica('2026-10-01') = '2026-10-19' as octubre_limite_18_certifica_19,
  privado.corte_limite('2026-09-01') = '2026-09-20' and privado.corte_certifica('2026-09-01') = '2026-09-20' as septiembre_regla_vieja,
  privado.corte_limite_ts('2026-09-01') = privado.corte_cierre('2026-09-01') as septiembre_limite_igual_al_cierre;
-- Comisiones de referencia: septiembre 59 filas y 49 cumplen
select count(*) = 59 and count(*) filter (where cumple) = 49 as septiembre_59_49 from privado.comision_filas3('2026-09-01');
