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
- Decisiones del administrador (27/10, noche):
  - Órdenes: prioridad a las del mes que pasan de 24 horas (reloj de 8 a. m. a 10 p. m., ya acordado); notificación al líder en cuanto pasan 24 horas (hoy el aviso es a los 15 días). Las de meses anteriores van como "viejas", aparte.
  - Las pestañas actuales (Corte / Sin instalar / Sin líder) son lo que más confunde: rehacerlas.
  - Ranking: los líderes ven el ranking completo y debe verse bien.
  - Detalle de las gráficas: quiere verlo en maqueta; la lista actual se ve feísima y rara.
  - Comisiones se organiza por equipos, en pestañas grandes con subgrupos por persona: Ventas corporativas (líderes), Canales de atención (analistas y coordinadora, un solo ranking de equipo; se ayudan con recepción de documentos y pago) y Aliados comerciales (cada aliado y su ranking, y comparados como grupo). Sirve para su gestión y la de los analistas.
  - Reasignación de cartera: más adelante.
  - Por definir: cómo se reconoce una venta de Canales de atención en los datos.
- Corrección del administrador (27/10, 22:19), manda sobre lo anterior:
  - La Lista de los líderes queda igual: cada líder ve lo suyo y lo de los aliados. Los equipos son solo para Canales de atención: los analistas ven todo su equipo para ayudarse (documentos y pago).
  - En las gráficas y el ranking todos ven todo, con menos detalle.
  - Ya definido: aliado = en la orden de instalación aparece el nombre del aliado en vez de "instalador"; Canales de atención = órdenes que monta Patricia en Odoo con el código de vendedor del analista.
  - Aliados en Comisiones: gráficas, ranking y comisiones de aliados (los líderes también las ven), todo concatenado con el módulo de Aliados comerciales.
  - Detalle de las gráficas: se rehace el panel de detalle (es un solo componente para todos los módulos): encabezado con total y comparación, reparto por líder con barras, tarjetas de clientes con estado, búsqueda y Excel. Maqueta primero.

### Comisiones · MAQUETA APROBADA (27/10, 23:10)
Maqueta en `claude/maquetas/comisiones-28oct/` (abrir los `.dc.html`; manda sobre lo anotado arriba). Resumen de lo aprobado:
- Lista: tarjetas Instalaciones PYME | Cambios de categoría | Cartas y proformas (pequeña, ámbar). Pestañas por equipo (Ventas corporativas, Canales de atención, Aliados comerciales). Dentro, listas desplegables por dueño (líder o usuario de Canales) con sus números. Avisos: Por instalar (más de 24 horas), Por asignar y botón azul "Subir documentos de un cliente nuevo" con su contador de pendientes por instalar.
- Quién ve qué: administrador todo; Canales de atención ve exactamente lo mismo que el administrador (sin cerrar corte ni excepciones); líder ve lo suyo y Aliados, y en clientes de aliados solo ve la etiqueta de carta y proforma (no envía); gráficas y ranking visibles para todos; gerencia en solo lectura.
- Carta de bienvenida y proforma: un solo envío y un solo botón "Enviar carta y proforma por WhatsApp", como la nota de entrega de Artesanos (copia el número del cliente, comparte los dos PDF con el mensaje; Android con paso 2 que abre el chat; laptop descarga y abre WhatsApp Web). Correo como opción. Canales SIEMPRE debe enviarla, también en cambios de categoría; si el líder la envía queda marcado como respaldo y sigue "Enviada por el líder · falta Canales". Etiqueta en cada cliente (por enviar con días, enviada por quién, cuándo y por dónde). Al tocar la tarjeta Cartas y proformas se marcan las tres pestañas a la vez y salen todos los equipos más cambios de categoría, agrupados por dueño. "Siguiente por enviar" en la hoja.
- Hoja de comisión rediseñada: resumen arriba (Legal, Pago, Orden), lo que falta primero y resaltado en ámbar, lo listo plegado en verde, Carta y proforma como tarjeta, "Más acciones" (cambiar corte, excepción, dueño, evento, nota), Contactar al líder, Ver expediente, Hilo. Sin botones en las filas: se toca el cliente y abre la hoja.
- Por instalar: órdenes del mes (más de 24 horas, menos de 24 horas, viejas aparte), buscador por orden, nombre o RIF; reloj de 8 a. m. a 10 p. m.; aviso al líder a las 24 horas.
- Subir documentos de un cliente nuevo: la orden es OPCIONAL; sin orden se sube con posible nombre y RIF, queda "Pendiente por instalar" y se une sola en el cruce con Odoo o TAD ("¿Es este cliente?" si hay parecido). Casillas en el orden acordado, arrastrar varios, foto o archivo en teléfono, "Guardar lo que llevo" y "Enviar a revisión" cuando esté todo.
- Resumen por corte: selector de corte y comparación, Líder del mes, 4 números, ranking con podio (Líderes, Canales, Aliados), equipos comparados, instaladas por corte, por instalar por horas, cartas y proformas. Sin "Aliados del corte".
- Detalle nuevo para TODOS los módulos: total con comparación, reparto por dueño con barras, desplegables por dueño, filtros, búsqueda, Excel y atajo a la gestión.
- Pendiente: monto del corte (30 $ por cliente): mostrarlo o quitarlo.
- Recordatorio para los demás módulos: revisar sus gráficas; ya queda pendiente cambiar el detalle y agrupar por dueño.

## Módulo 3 · Clientes · MAQUETA APROBADA (27/10, 23:33)
Maqueta en `claude/maquetas/clientes-28oct/`. La lista y la hoja quedan como hoy salvo lo que muestra la maqueta. IA y subida actual siguen igual.
- falla · alta: "Grandes negocios" contaba como "Completo" (1.517 PYME, 1.442 sin un documento; firmados reales 50). Estatus legal en 5 grupos: Sin gestionar · Faltan documentos · En revisión · Por firmar · Firmado.
- Lista: arriba tarjetas por segmento, barra de estatus legal que cambia con el segmento (ISP con sus atajos: pólizas VGT, sin habilitación, contratos sin fecha, suspendidos), Gestiones activas (meta, fecha, avance, Ver sus clientes, Cambiar fecha, Dar por terminada), prioridad "312 sin gestionar instalados en 6 meses y habilitados" con Crear gestión. Abajo la lista de tarjetas como hoy, sin agrupar por líder.
- Líder: ve todo, pero primero lo suyo; los clientes de otros líderes en un desplegable de solo consulta; al buscar, el ajeno sale con "Es de ...".
- Hoja del cliente: mismas pestañas; Datos con franja de gestión activa y servicios en rectángulo (código, plan, estado, sucursal, fecha, serial, IP y etiqueta de carta y proforma); Documentos con "Faltan ..." y Pedir lo que falta; Hilo con filtros y nota; Comisión por servicio.
- Subir varios documentos: marcar qué trae cada archivo (puede ser más de una casilla), lo aprobado apagado, guardar cuando todos estén marcados.
- Resumen: tarjetas por tipo de cliente (PYME, Dedicado corporativo, Dedicado ISP, VGT) que cambian las gráficas; promedios de 12 meses (instalaciones, pérdidas, churn mensual, churn de infancia, firmados); números (habilitados, instalados del mes, churn del mes, churn de infancia, sin gestionar); instalados por mes y si siguen habilitados; churn por mes total y de infancia (meta menos de 5 %); calidad de la venta por dueño (incluye Canales y Aliados); gestiones activas; estatus legal por segmento. SIN deuda (va con cobranza, a futuro).
- Detalle de cada gráfica: el patrón nuevo (total y comparación, reparto por dueño, desplegables por dueño, Excel, Ver en la lista). Todas las gráficas siguen ese patrón.
- nuevo · alta (base de datos): guardar del TAD la última suspensión y la última habilitación de cada servicio; de ahí salen churn, churn de infancia, movimiento del mes y calidad por dueño.

## Módulo 4 · Revisión (Legal) → pasa a Mi trabajo · MAQUETA (28/10, 00:05; ajustada con el administrador)
Maqueta en `claude/maquetas/mi-trabajo-28oct/`. Decisiones:
- Revisión deja de ser módulo del menú: vive en Mi trabajo. Inicio queda EXACTAMENTE como hoy; sus pendientes salen agrupados y cada grupo abre Mi trabajo en ese grupo; botón "Ver todo mi trabajo".
- Mi trabajo: a la izquierda los submódulos; en "Todo", las tarjetas actuales (Revisar documentos, Por decidir, Aliados, Alertas, Otras tareas, Mis notas) en versión compacta, más "Lo más urgente" y "El equipo" (el administrador abre el buzón de cada persona en solo consulta).
- Cada ítem es una tarea con "Ir": abre la hoja del cliente encima (drawer), en la pestaña y casilla exactas. Al cerrar vuelve al mismo punto y el ítem ya está tachado. Hojas apilables, "Siguiente pendiente", "Ver en el módulo". Los checks se marcan solos al hacer la acción; solo las notas propias se marcan a mano. Gestiones: estados en un toque desde el buzón.
- Avisos en la misma pantalla al terminar ("Se quitó de tus pendientes · quedan N", con Deshacer) y mensajes en verde cuando algo queda bien. No al teléfono.
- Revisar documentos EN LOTE con la IA: filtros IA Apto / No apto / A mano / Sin leer y "Solo el corte"; seleccionar varios y Aprobar, Devolver con el motivo de la IA o Leer con IA; "Abrir en Drive" por cliente. Solo los "A mano" en la pantalla partida (documento grande, motivos en un toque, siguiente).
- Por rol: todos los que venden tienen "Mis ventas" (devueltos, faltan para comisionar, por instalar); Legal ve el tablero de contratos (Para elaborar, Enviado a firmar, Firmado falta subir, Listo) y vencimientos; Canales: cartas y proformas, IP, apoyo con pago y documentos; líder: lo suyo y sus gestiones.
- Contratos y VGT en la hoja del cliente: solo rediseño visual con el mismo proceso (contratos con "Poner fecha" o "Falta subir", tramos en tabla, requisitos en checklist). El proceso VGT (solicitudes, propuesta automática) queda para después, con Dedicados al final.
- Estado: maqueta presentada; el administrador pidió seguir con el siguiente módulo.
