-- Lote 05/11, parte G (aplicado con el conector: lote05_g1_indice_clave_c, lote05_g2_indice_visto_y_bloques, lote05_g3_marcar_por_rango)
-- Diagnóstico: marcar 20.000 filas sin cambios en la tabla ancha del índice (298 MB, 8 índices) tardaba 25 s;
-- por eso el índice tardaba 24 a 36 minutos (cargas 13, 14 y 15). La comparación en sí era lo de menos.
-- 1. public.tad_indice pasa a llamarse public.tad_indice_datos (RLS sin políticas, sin permisos para anon/authenticated).
-- 2. privado.tad_indice_visto (clave, carga): la marca "vino en la carga N" vive aquí (angosta: 100.000 filas en ~1,5 s).
-- 3. public.tad_indice es una vista (security_invoker) con las mismas columnas y el mismo orden: las funciones que leen no cambian.
-- 4. public.tad_indice_bloques(carga, bloques): huella SHA-256 de cada bloque de 1.000 claves (orden "C"); devuelve los distintos. No escribe.
-- 5. public.tad_indice_marcar(carga, bloques): marca como vistos los rangos de claves de los bloques que cuadraron.
-- 6. tad_indice_comparar, tad_indice_parte y tad_indice_cerrar escriben la marca en privado.tad_indice_visto.
-- 7. actualizar_estado devuelve 'indice': última carga, migraciones que esperan el TAD, si toca y la carga abierta.
-- Comprobación (igual antes y después): por carga 0:822, 7:4, 8:54, 9:64, 13:23, 14:33, 15:18217, 16:399921;
-- md5 de lo vigente e8ae0fd9beb57ae6f69bfef637970441; md5 de categorias_tad 1af30c3112607a523a27d46451fb055a.
select carga, count(*) from public.tad_indice group by carga order by carga;
select md5(string_agg(clave || coalesce(huella, ''), ',' order by clave collate "C")) from public.tad_indice where carga = privado.tad_indice_vigente();
