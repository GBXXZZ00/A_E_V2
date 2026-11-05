-- Lote 05/11, parte B (migraciones lote05_b1_tad_columnas, lote05_b2_instalaciones_pyme_una_fuente, lote05_b6_churn_listo y cambios
-- con privado.reemplazar_en_funcion en clientes_resumen y res_clientes). Nota: lote05_b2 creó también privado.resumen_cache_vaciar(), que no hace nada (se puede borrar desde el panel).
-- B2: misma cifra en todas las pantallas
select (select count(*) from privado.res_srv(null) where mes = '2026-10-01') gerencia_oct,
       (select count(*) from privado.srv_base(null) where seg = 'pyme' and date_trunc('month', fecha)::date = '2026-10-01') clientes_oct;   -- 95 y 95 (antes 125 y 95)
-- B6: churn visible solo con fechas de un mes completo y el ajuste churn_visible = si
select privado.churn_listo();   -- hoy false
-- B1: columnas que usó la última carga del TAD
select id, resumen->'con_fechas', resumen->'columnas_fechas' from public.cargas where fuente = 'tad' order by id desc limit 3;
