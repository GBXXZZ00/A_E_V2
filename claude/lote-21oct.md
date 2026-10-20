# Lote 21/10: comisiones, clientes y dedicados, velocidad de documentos

Aprobado por el administrador el 20/10. Ejecútalo completo, en este orden, siguiendo las reglas de ahorro de CLAUDE.md (pruebas por módulo, batería completa y publicación UNA vez al final, capturas al final, respuesta final corta). No cambies la estructura que ya le gusta: mejórala.

## Contexto (cambios hechos en la base desde el chat del proyecto, 20/10)
- Septiembre: la foto certificada (59/49) no se toca. El cálculo vivo quedó en 46/41: 10 instalaciones que no se pagaron pasaron a octubre (`instalaciones.corte_manual`), Pinytex y Agencia Naviera quedaron pagadas en septiembre (`corte_manual` + `excepcion_corte`), Alkosto anulada (`anulada_en`, se pagó como migración). Octubre: 68 filas, 49 comisionan. Esa es la referencia de este lote.
- Testigos de Jehová: evento que no comisiona. Totalcom: pago quitado (el TAD lo dio solvente antes de facturar la instalación).
- Cuentas nuevas: maria (líder), elizabeth y ender (analistas), PIN 123456 con cambio obligatorio.
- Base nueva, SIN pantalla todavía: `clientes.suspendido_en/suspendido_por/suspendido_nota` (9 clientes suspendidos), `dedicados.excluido_en/excluido_motivo` (1: no es dedicado), `dedicado_contratos.falta_archivo` (Navegantes: firmado sin archivo), tabla `cliente_gestion` (cliente_id, etiqueta contactado | sin_contacto | esperando, fecha, nota, por, en; RLS sin políticas, todo por funciones; 12 etiquetas cargadas).
- Funciones de ajuste de un solo uso que quedaron en la base y no se pueden borrar: `privado.ajuste_tj_20oct`, `ajuste_cortes_20oct`, `ajuste_analistas_20oct`, `ajuste_dedicados_20oct`, `ajuste_galait_20oct`. No las llames.

## 1. Comisiones: hoja de comisión rehecha
- Arriba: la tarjeta de estado (comisiona o qué le falta) y los datos clave del cliente: estatus legal, líder, código, fecha de instalación y orden de Odoo. Se quita la lista de chequeo suelta.
- Tres bloques plegables, cada uno con su mini lista de chequeo y su estado en la cabecera:
  1. Legal y documentos: las casillas del expediente (mismas que Clientes, arrastrar y subir varios), firma Digital o Física, Aprobar Legal (con motivo) y Pedir al cliente. Persona natural: solo cédula y RIF.
  2. Pago: qué dice el TAD y cuándo, aviso de revisar pago, Marcar / Quitar pago (pregunta antes) y nota.
  3. Bienvenida y proforma: la IP va aquí (no tiene que ver con la comisión), enviar o descargar, quién la mandó y cuándo.
- Abajo, "Ajustes de la comisión": a quién pertenece (cambiar), evento, cambiar de corte, "No comisiona" con motivo (anula con bitácora, reversible por el administrador).
- Corregir un corte certificado (solo administrador): mover una instalación que está en la foto de un corte certificado al corte abierto ("no se pagó") o marcarla pagada en el certificado ("se pagó allá"), con motivo y bitácora, sin cambiar la foto. Lo mismo para instalaciones de fecha de un corte certificado que no quedaron en su foto (por ejemplo, sin líder): se pueden asignar, marcar evento o mover al corte abierto.

## 2. Comisiones: reglas de pago con el TAD
- Pago fijo: si un TAD ya dio la instalación por solvente, el pago queda; ninguna carga posterior lo quita (ni manual ni automático).
- Instalados del 20 al 31: un TAD cargado después del día 1 trae la factura nueva del mes; esa deuda no quita el pago y, si no había pago, sale como "Revisar pago: factura nueva del mes".
- Revisar pago siempre que el RIF tenga más de un servicio, contando también los residenciales del mismo RIF (índice del TAD completo).
- Un TAD cargado el mismo día de la instalación no basta para dar pago (la cuenta por cobrar se genera después): exige un TAD de al menos N días después de instalar, con N como ajuste editable (por defecto 3). Ver `claude/por-definir.md`.

## 3. Clientes: lista
- "Todos" es el atajo por defecto y el primero, siempre. No cambies los atajos que hay; solo el orden y el valor por defecto.
- Filtros: Segmento (PYME, Dedicado, Dedicado ISP, Combinado), Líder, Estatus legal, VGT (Con VGT, VGT por firmar, Requisitos VGT incompletos). Quita los demás filtros de dedicados (enlaces y similares).
- Suspendidos: no salen en la lista ni en los contadores; filtro "Ver suspendidos". Se les pueden seguir pidiendo documentos. Dedicados con `excluido_en` no cuentan como dedicados.
- Paginación con flechas ("‹ 1–30 de N ›") en vez de "Ver más", en teléfono y escritorio.
- Etiquetas de gestión (`cliente_gestion`): Contactado, Sin contacto, Esperando documentos, con fecha y nota. Se ponen con un toque desde la fila o la hoja; la última se ve como etiqueta en la fila. No cambian el estatus. Arriba, la cuenta de cada etiqueta, que filtra al tocarla. "Pedir documentos" pone sola "Esperando documentos".
- Combinado visible: etiqueta "PYME + Dedicado" en la fila y en la hoja.

## 4. Clientes: hoja
- Pestañas: Datos, Documentos, Contrato, VGT (solo si tiene), Hilo, Comisión (solo PYME del corte). Mismo diseño de hoy.
- Datos: "Cambiar líder" (solo administrador, bitácora) para PYME y dedicados. "Marcar como suspendido" / "Reactivar" con nota (administrador, bitácora).
- Documentos: soltar o elegir varios archivos sin esperar a que termine el anterior (cola en segundo plano con avance; se puede seguir trabajando). "Otro" pide nombre y nota. Casilla Conatel para ISP: "Habilitación vigente con atributos de Internet y Transporte". "Aprobar seleccionados": casilla por documento y aprobar varios sin abrirlos. Cada documento con "Abrir en Drive".
- Contrato: una tarjeta por contrato (Dedicado, PYME, Colocation), cada una con estatus y firma Digital o Física. Física = contrato presencial (no pide correos ni teléfono): unifica las dos opciones en una. "Firmado en físico" con fecha y escaneado. Al marcar Firmado la fecha de vencimiento es obligatoria. Si un contrato está firmado sin archivo (`falta_archivo` o sin documento en la casilla) o sin vencimiento: etiqueta "Firmado: falta subir contrato" o "Falta vencimiento" en la lista y pendiente en la bandeja de Legal.
- VGT: requisitos, pólizas y proyectos separados de los documentos normales.

## 5. Velocidad de documentos
- Mide dónde se va el tiempo al abrir la vista previa y al aprobar (función `drive_archivo`, recalcular).
- Vista previa ligera primero (miniatura o primera página) y el archivo completo por detrás; botón "Abrir en Drive".
- Aprobar responde al instante (la marca se guarda y el recálculo va por detrás); nunca espera a que cargue la vista previa.

## Verificación
Septiembre 46/41 (vivo) y octubre 68/49 al empezar y al terminar, y después de cada parte que toque comisiones. Pruebas nuevas solo para lo nuevo. Batería completa una vez al final. Un `?v=`, un commit, un push.
