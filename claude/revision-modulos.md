# Revisión módulo por módulo (desde el 27/10, con el administrador)

Se anota aquí cada hallazgo de las pruebas en vivo. Al cerrar la revisión se arma un solo lote para Code.
Formato: módulo · tipo (falla / cambio / mejora) · prioridad (alta / media / baja) · qué pasa y qué se espera.

## Para la siguiente pasada (anotado 27/10)
- Clientes y Gerencia · falla · alta: el Resumen cuenta "Grandes negocios" como "Completo". Grandes negocios es el estatus de arranque (nunca se pidió nada), así que infla los completos. Debe contar como "Faltan documentos" (o un grupo propio "Sin gestionar"). Ejemplos: 3 ISP sin un solo documento salen como Completo.
- Dedicados · cambio · media: la propuesta comercial del VGT sigue siendo requisito, pero se genera sola con los datos del cliente y de la solicitud cada vez que se emite una. Un cliente con varios VGT puede necesitar una o varias propuestas (una por solicitud). Va con el módulo de solicitudes VGT.
- Dedicados · gestión: Telmaca tiene 2 VGT marcados firmados, pero solo uno tiene contrato (el que está en uso). Confirmar con Reina. Los contratos ISP y de VGT de Telmaca están en el correo del administrador: subirlos.
- Suspensiones: resuelto, el TAD ya trae última suspensión, estatus actual y última habilitación.
- Nomenclatura de Odoo: se hace con la presentación a los líderes.
- Proveedor de IA: después; mientras tanto revisión manual.

## Módulo 1 · Inicio y Actualizar
(pendiente)
