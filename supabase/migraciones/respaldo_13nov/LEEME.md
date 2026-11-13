# Respaldo de Comisiones (13/11/2026)

Copia exacta, tal como estaban en la base antes del lote 13/11 (partes 9 y 11), de las funciones de Comisiones que solo vivían en la base:
`comisiones_lista`, `comisiones_corte`, `comisiones_resumen`, `comisiones_detalle`, `privado.com_base`, `migraciones_corte`, `pendientes_lider` y `pendientes_enviados`.

Cada archivo es el texto de `pg_get_functiondef` seguido de `;`. Se verificó con md5 contra la base (sin el `;` final).
Para volver a una de ellas: se aplica su archivo como migración.
