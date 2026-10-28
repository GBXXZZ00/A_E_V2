# Lote 28/10: rediseño de Comisiones, Clientes, Mi trabajo e Inicio, y base de datos

Aprobado por el administrador la noche del 27/10. Corrida única: hacer todo, en este orden, sin preguntar lo que aquí ya está decidido.
Maquetas aprobadas (mandan sobre cualquier duda de diseño; abrir los `.dc.html`):
- `claude/maquetas/comisiones-28oct/`
- `claude/maquetas/clientes-28oct/`
- `claude/maquetas/mi-trabajo-28oct/`
Detalle de cada decisión y su porqué: `claude/revision-modulos.md` (módulos 1 a 4). Nombres de las maquetas: inventados. Cantidades: de ejemplo salvo donde la maqueta dice que son reales.
Regla general: lo que no se menciona queda como está. La IA, la subida actual de documentos, Migraciones, Factibilidad, Aliados, Gerencia y Dedicados NO se tocan en este lote, salvo para aplicar el detalle nuevo y el estatus legal corregido.

## Parte A · Base de datos (sin pantalla)
1. **Fechas del TAD por servicio.** Guardar en cada carga la última suspensión, el estatus actual y la última habilitación que trae el TAD (columnas en `servicios`, fechas como fecha). De ahí salen: churn del mes, churn de infancia (suspendido o retirado dentro de los 60 días de instalado), movimiento del mes (instalados, reactivados, suspendidos, retirados, pasaron a residencial, neto) y calidad de la venta por dueño. Primera carga después del lote: llenar todo lo que traiga el TAD.
2. **Estatus legal en 5 grupos** en todo lo que cuente estatus (`modulo_resumen`, `modulo_detalle`, Gerencia, Inicio): Sin gestionar (`grandes_negocios`) · Faltan documentos (`documentos_solicitados` + `documentos_pendientes`) · En revisión (`documentos_recibidos` + `documentos_en_revision`) · Por firmar (`por_firmar` + `contrato_en_curso`) · Firmado (`contrato_firmado`). "Grandes negocios" NUNCA cuenta como completo.
3. **Equipo de cada usuario.** Campo `equipo` en perfiles: Ventas corporativas, Canales de atención (analistas y coordinadora) o Aliado. Lo asigna el administrador en Usuarios (columna nueva). Por defecto: líder → Ventas corporativas; analista → Canales. Una instalación pertenece al equipo de su dueño; si el instalador es un aliado, al equipo Aliados.
4. **Resumen de Comisiones por corte**, no por mes de calendario: selector de corte y comparación con el anterior a la misma fecha. Ranking del corte por dueño (Líderes, Canales, Aliados) y por equipo; "Líder del mes" del último corte cerrado.
5. **Monto del corte:** ajuste `comision_monto` (30 $ por cliente). Total a comisionar (cumplen), pasan al próximo corte si no cumplen el día límite (primer corte) y se pierden si no cumplen y ya venían del anterior. Por corte y por dueño.
6. **Órdenes por instalar:** solo las del mes en la vista normal; las de meses anteriores como "Viejas". Horas con el reloj acordado (de 8 a. m. a 10 p. m., todos los días). Aviso al líder dueño al pasar 24 horas (reemplaza el aviso de 15 días; `orden_dias_alerta` pasa a horas: `orden_horas_alerta` = 24).
7. **Cliente nuevo sin orden:** subir documentos con "posible nombre" y RIF crea el cliente como provisional "Pendiente por instalar" (reusar provisionales, `provisional_rif`, el parecido y "¿Es este cliente?"). El cruce con Odoo o el TAD lo une solo. Con orden: igual que hoy (`orden_cliente_rif`).
8. **Carta de bienvenida y proforma: un solo envío** (las dos juntas). Registrar cada envío: quién, cuándo, canal (WhatsApp o correo) y si fue de Canales (obligatorio) o del líder (respaldo). Queda "por enviar" hasta que lo envíe alguien de Canales, aunque el líder ya lo haya enviado. Aplica también a cambios de categoría confirmados. El líder no puede enviar la de clientes de aliados (solo ve la etiqueta). Todo con bitácora.
9. **Mi trabajo (buzón):** ítems por rol con su origen y su destino exacto (cliente, pestaña y casilla, o instalación). Se resuelven solos cuando se hace la acción (no hay botón "Hecho"). Notas personales con recordatorio (se marcan a mano). El administrador puede ver el buzón de cualquier persona en solo consulta. Grupos por rol según la maqueta: todos los que venden tienen "Mis ventas" (devueltos, faltan para comisionar, por instalar); administrador: revisar documentos, por decidir, aliados, alertas, otras tareas, el equipo; Legal: contratos por etapa y vencimientos; Canales: cartas y proformas, IP por escribir, apoyo con pago y documentos; líder: lo suyo y sus gestiones asignadas. Migraciones también entra al buzón: "Aprobar documentos del cambio" (administrador) y "Emitir en Proham" (analista, con el Hecho del flujo actual), cada uno con su Ir al cambio.
10. **Revisión en lote:** aprobar varios, devolver varios con el motivo de la IA (editable) y leer con IA varios (respetar el límite y el aviso de costo de hoy), todo con bitácora por documento y aviso al líder. Filtros IA: Apto, No apto, A mano, Sin leer; "Solo el corte actual".
11. **Actualizar:** lista "Qué toca actualizar" con cada archivo, su última carga y si está al día (TAD, Odoo y órdenes: cada mañana, con una carga opcional a las 5 p. m.; KMZ: cuando cambie el mapa). Una sola zona de subida, KMZ incluido. Historial agrupado por fecha (se despliega). El cruce se lanza con un botón "Cruzar ahora" al terminar de cargar. Índice del TAD: medir la próxima carga; si sigue lento, pasarlo a un paso aparte con barra de avance que no bloquee. Actualizar solo para administrador y Analista Senior.

## Parte B · Pantallas (según las maquetas)
**Comisiones** (`comisiones-28oct`)
- Arriba: tarjetas Instalaciones PYME | Cambios de categoría | Cartas y proformas (pequeña, ámbar). Pestañas por equipo; dentro, listas desplegables por dueño con sus números. Avisos Por instalar (más de 24 horas), Por asignar y botón azul "Subir documentos de un cliente nuevo" con su contador.
- Al tocar Cartas y proformas: las tres pestañas quedan marcadas a la vez y salen todas las por enviar (también cambios de categoría), agrupadas por dueño.
- Quién ve qué: administrador todo; Canales igual que el administrador (sin cerrar corte ni excepciones); líder lo suyo y Aliados; gráficas y ranking para todos; gerencia solo lectura.
- Hoja de comisión rediseñada: resumen arriba (Legal, Pago, Orden), lo que falta primero en ámbar, lo listo plegado en verde, tarjeta de carta y proforma con UN botón "Enviar carta y proforma por WhatsApp" (como la nota de entrega de Artesanos: copia el número del cliente, comparte los dos PDF con el mensaje; Android con paso 2 que abre el chat; en la laptop descarga y abre WhatsApp Web) y "O enviar por correo (opcional)"; "Siguiente por enviar"; "Más acciones" (cambiar corte, excepción, dueño, evento, nota); Contactar al líder; Ver expediente; Hilo. Sin botones en las filas.
- Por instalar y Subir documentos de un cliente nuevo según las pantallas 4, 11 y 12 (orden opcional, buscador, posible nombre, casillas, Guardar lo que llevo, Enviar a revisión).
- Resumen: según la pantalla 5 (selector de corte, Líder del mes, 4 números, ranking con podio, equipos, instaladas por corte, por instalar por horas, monto del corte, cartas y proformas).

**Clientes** (`clientes-28oct`)
- Lista: tarjetas por segmento, barra de estatus legal en 5 grupos que cambia con el segmento, Gestiones activas (Ver sus clientes, Cambiar fecha, Dar por terminada), prioridad "sin gestionar instalados en 6 meses y habilitados" con Crear gestión; abajo la lista de tarjetas como hoy (sin agrupar).
- Líder: lo suyo primero; los de otros líderes en un desplegable de solo consulta; al buscar, el ajeno sale con "Es de ...".
- Hoja del cliente: mismas pestañas; Datos con franja de gestión activa y servicios en rectángulo; Documentos con "Faltan ..." y Pedir lo que falta; Hilo con filtros; subir varios archivos marcando qué trae cada uno.
- Contratos y VGT de dedicados: solo el diseño de la pantalla 9 de `mi-trabajo-28oct` (mismo proceso).
- Resumen: tarjetas por tipo de cliente (PYME, Dedicado corporativo, Dedicado ISP, VGT), promedios de 12 meses, churn del mes y de infancia, instalados por mes y si siguen habilitados, calidad por dueño, gestiones activas, estatus legal por segmento. SIN deuda.

**Detalle de las gráficas (todos los módulos):** el componente de `resumen.js` pasa al patrón nuevo: total con comparación, reparto por dueño con barras, desplegables por dueño con tarjetas de clientes y sus chips, filtros, búsqueda, Exportar a Excel y Ver en la lista (pantallas 6 de Comisiones y 4b de Clientes).

**Inicio y Mi trabajo** (`mi-trabajo-28oct`)
- Inicio queda EXACTAMENTE como hoy: los módulos con sus iconos y su diseño actual NO cambian (en la maqueta solo están dibujados para indicar su lugar). Lo único nuevo: a la izquierda "Mis pendientes, agrupados" (cada grupo abre Mi trabajo en ese grupo) con "Ver todo mi trabajo"; los módulos actuales quedan a la derecha (pantalla 0).
- Mi trabajo: a la izquierda el índice hecho con las tarjetas actuales en versión compacta (pantalla 1); a la derecha "Lo más urgente", la checklist del grupo elegido y "El equipo". "Ir" abre la hoja encima en la casilla exacta; hojas apilables; al cerrar vuelve al mismo punto con el ítem tachado.
- Revisión sale del menú: vive en Mi trabajo (revisión en lote de la pantalla 2; pantalla partida solo para los "A mano"). `revision.html` lleva a Mi trabajo.
- Legal, líder y Canales según las pantallas 3, 4 y 5.
- Avisos en la misma pantalla al terminar ("Se quitó de tus pendientes · quedan N", con Deshacer) y mensajes en verde cuando algo queda bien. No van al teléfono.

**Otros**
- Teléfono: pantalla de carga (logo y esqueleto) al volver a abrir la app con la sesión abierta.
- Actualizar: según A11; quitar los botones "Ver comisiones" y "Ver factibilidad".

## Fuera de esta corrida
Proceso VGT (solicitudes, propuesta comercial automática por solicitud), módulo de Dedicados, cobranza y deuda, nomenclatura de Odoo (va con la presentación), proveedor de IA, y la revisión de Migraciones, Factibilidad, Aliados y Gerencia (se revisan el 28/10 con el administrador).

## Al terminar
Comisiones de referencia sin cambios (septiembre 46/41, octubre 83/75, noviembre según el corte en curso) antes y después de cada parte que toque el cálculo. Pruebas de `pruebas/` más las nuevas (estatus en 5 grupos, ranking y equipos, monto, por instalar por horas y aviso de 24 horas, cliente sin orden, envío de carta y proforma de Canales y del líder, líder sin envío para aliados, buzón por rol y resolución sola, revisión en lote, Actualizar). Modo práctica al día. Capturas 1366x768 e iPhone. Revisión independiente al final. Subir `?v=`, commit y push a main, actualizar `claude/traspaso.md`. Sin nombres ni datos reales en el repo.
