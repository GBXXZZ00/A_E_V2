# Auditoría v66 → v67 (29/10): qué se eliminó, qué se escondió y qué se movió

Comparación automática de `assets/js` y los HTML entre `26fdb75` (v66) y `dc7f1d9` (v67), revisada a mano. Sirve de base para el lote 28/10-B.

## Eliminado (ya no existe)
- Hoja del cliente: elegir qué enviar (Proforma, Carta o Las dos). Ahora es un solo envío de las dos.
- Hoja del cliente: sección de Notas del cliente ("Todavía no hay notas"); las notas quedan solo en el Hilo y en Mi trabajo.
- Hoja del cliente, subir varios: avisos "Falta marcar" y "Todo marcado. Quedan por revisar al guardar".
- Comisiones, lista: secciones "Último corte: si no cumplen se pierden", "Cumplen hasta hoy", "Cumplieron", la vista "Por líder" y los mensajes "Todo cuadra" y "Ninguna en rojo" (reemplazados por grupos por dueño).
- Comisiones, por instalar: "Ver anteriores / Ocultar anteriores" (reemplazado por la pestaña Viejas).
- Comisiones: las pestañas Corte, Por instalar, Sin instalar y Sin líder (reemplazadas por tarjetas y avisos).
- Actualizar: lista de últimas cargas y subidas (`cargas_ultimas`, `subidas_ultimas`) y las casillas Base vieja, TAD completo y Odoo (reemplazadas por "Qué toca actualizar" y el historial por fecha).
- Gerencia: "Expedientes completos" pasó a "Contratos firmados".

## Escondido (existe, pero ya no está a la vista)
- Hoja de comisión: todo va en secciones plegables (Legal y documentos, Pago, Orden de Odoo, Carta y proforma, Más acciones). Lo que está en verde queda cerrado y sus botones no se ven.
- "Más acciones" (antes "Ajustes de la comisión"): Cambiar de corte, Dar excepción o quitarla, Evento comisiona o no, No comisiona y Volver a activar, Escribir una nota.
- Dentro de las plegables: Aprobar Legal o Quitar Legal, Se pagó allá y No se pagó, Confirmar o Cambiar la orden, Asignar dueño.
- La firma digital o física quedó como dos botones grandes dentro de Legal.

## Movido de lugar
- Confirmar o elegir la orden de Odoo, "¿Es este cliente?" de provisionales y elegir el dueño del provisional: pasaron de la lista de Comisiones a la hoja de Por instalar (`por-instalar.js`).
- Las tareas de Mi trabajo cambiaron de nombre (por ejemplo, "Revisar documentos del cambio" ahora es "Aprobar documentos del cambio").
