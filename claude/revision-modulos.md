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

## Módulo 1 · Inicio y Actualizar (probado 27/10)
**Inicio:** OK, todo probado por el administrador.
- Teléfono · falla · alta: al volver a abrir la app con la sesión abierta, la pantalla se ve mal unos segundos. Poner una pantalla de carga (logo y esqueleto) hasta que todo esté listo.

**Actualizar:**
- cambio · alta: arriba, una lista "Qué toca actualizar": cada archivo (TAD, Odoo, Órdenes de instalación, KMZ y los que vengan) con la fecha de su última carga y si está al día o atrasado.
- cambio · alta: una sola zona de subida para todo, incluido el KMZ (hoy el KMZ va aparte).
- cambio · media: historial de cargas agrupado por fecha; al tocar una fecha se despliega qué se subió (archivo, hora, quién, resultado).
- cambio · baja: quitar los botones "Ver comisiones" y "Ver factibilidad".
- cambio · alta: el cruce no se lanza archivo por archivo: cuando se termina de cargar todo, sale un botón "Cruzar ahora".
- falla · alta: el TAD tarda muchísimo por el índice de residenciales (glosario de migraciones). Medir la próxima carga (debería subir solo lo que cambió). Si sigue lento: cargar primero empresas y dejar el índice como un paso aparte con su barra de avance, sin bloquear al administrador.
- Permisos: Actualizar solo para el administrador y el Analista Senior. Confirmar en las pruebas por rol.

## Pruebas por rol (al final)
Probar cada módulo desde las otras cuentas (líder, analista, Senior, abogado, aliado, gerencia), con el modo práctica o con cuentas reales.
