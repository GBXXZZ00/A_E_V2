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
  Frecuencia: TAD, Odoo y Órdenes todos los días en la mañana, y una carga opcional a las 5 p. m.; KMZ solo cuando cambie el mapa.
- cambio · alta: una sola zona de subida para todo, incluido el KMZ (hoy el KMZ va aparte).
- cambio · media: historial de cargas agrupado por fecha; al tocar una fecha se despliega qué se subió (archivo, hora, quién, resultado).
- cambio · baja: quitar los botones "Ver comisiones" y "Ver factibilidad".
- cambio · alta: el cruce no se lanza archivo por archivo: cuando se termina de cargar todo, sale un botón "Cruzar ahora".
- falla · alta: el TAD tarda muchísimo por el índice de residenciales (glosario de migraciones). Medir la próxima carga (debería subir solo lo que cambió). Si sigue lento: cargar primero empresas y dejar el índice como un paso aparte con su barra de avance, sin bloquear al administrador.
- Permisos: Actualizar solo para el administrador y el Analista Senior. Confirmar en las pruebas por rol.

## Pruebas por rol (al final)
Probar cada módulo desde las otras cuentas (líder, analista, Senior, abogado, aliado, gerencia), con el modo práctica o con cuentas reales.

## Módulo 2 · Comisiones (probado 27/10)
Le encanta en general. La hoja (drawer) de comisión queda tal cual.
- diseño · alta: Comisiones se siente mal organizado. Propuesta (por aprobar con maqueta): dos tarjetas arriba "Instalaciones PYME" | "Cambios de categoría" (como las de Clientes), y pestañas Corte | Por instalar | Por asignar. "Sin instalar" y "Sin líder" no se entienden con esos nombres.
- cambio · alta: "Por instalar" = órdenes de Odoo abiertas, se ven poco. Botón visible "Subir documentos de un cliente nuevo" con drawer como el de asignar, que muestra las órdenes de Odoo no cumplidas para elegir la suya. El líder ve esa venta en su corte como "No instalada · documentos subidos" y pasa sola al corte al instalarse.
- cambio · alta: solo órdenes recientes (ventana de comisión, 45 días); las viejas aparte, no en la vista normal.
- falla · alta: el Resumen de Comisiones cuenta por mes de calendario (octubre) mientras la lista va por corte (noviembre). Debe ir por corte, con selector de corte (actual, anterior...) y comparar con el anterior.
- falla · alta: la gráfica por líder no se nota ni se entiende; la de sin instalar por antigüedad tampoco.
- diseño · alta: el panel de detalle de las gráficas es feo y no se entiende. Debe abrir algo bonito: agrupado por líder con barras pequeñas y totales, y debajo tarjetas de clientes con chips de estado. Maqueta primero.
- nuevo · media: atajos claros para gestión actual: "Falta legal" y "Sin pago" del corte, con cantidad por líder.
- nuevo · media: suspendidos antes de 60 días (churn de infancia) por líder en Comisiones; suspendidos en general van en Clientes.
- nuevo · media: competencia del mes: ranking de instalaciones del corte por líder, podio y "Líder del mes", visible para los líderes (por confirmar qué ven).
- duda · IP: "Falta la IP" no depende de documentos: la IP viene de un archivo que aún no se carga; hoy se escribe a mano.
