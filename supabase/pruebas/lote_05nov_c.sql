-- Lote 05/11, parte C (migraciones lote05_c1_requerimientos_y_representantes y lote05_c2_funciones_expediente, más cambios con
-- privado.reemplazar_en_funcion en cliente_ficha, documento_revisar y documento_marcar). Función ia_revisar v13 (reglas versión 5).
-- Tablas nuevas: public.requerimientos, public.revision_puntos, public.actas_junta; representantes.firma, marca, marca_motivo.
-- Disparador documentos_requerimiento: subir en la casilla pedida -> por_revisar; aprobar -> cumplido; devolver -> abierto (bitácora).
-- Prueba con datos reales que se deshizo sola (raise exception), resultado:
--   requerimiento junta -> casilla acta_asamblea 2, abierto; faltantes 1 -> 2; aviso al líder creado; repetirlo devuelve el mismo id;
--   subir -> por_revisar; devolver -> abierto; aprobar -> cumplido;
--   acta que cambia la junta con un director nuevo que firma: el representante 1 pasa a ya_no_aplica, 2 pedidos (cédula y RIF);
--   desmarcar: el representante vuelve a "cuenta" y 0 pedidos abiertos; representante_marcar deja bitácora.
-- Después: firma separada con representantes extra 0; faltantes totales 10.911; comisiones 46/41, 83/75, 47/4 (iguales).
select estado, count(*) from public.requerimientos group by 1;
select marca, count(*) from public.representantes group by 1;
