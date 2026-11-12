# Lote 12/11 B: Comisiones, Mi trabajo, Cliente nuevo, Actualizar y Aliados

Aprobado por el administrador el 12/11/2026 ("vamos a darle"). Maqueta: `claude/maquetas/lote-12nov-b/comisiones-hoja.html` (secciones 1 a 9). La maqueta manda: cada parte se monta, se saca captura en PC (1366x768) y en iPhone y se compara con su sección antes de publicar.

Reglas para todo el lote:
- **No se pierde ningún botón ni función** (ver la lista de cada parte). Si algo cambia de lugar, se anota aquí.
- Sin `—` en textos. Etiquetas arriba del campo. Botones de una línea, 44 px en teléfono.
- Cada parte: pruebas de `pruebas/`, pruebas nuevas, captura contra la maqueta, revisión independiente, `?v=` arriba, commit y push. Se publica parte por parte.
- Toda parte que toque Comisiones se prueba contra la referencia: septiembre 46/41 (huella `9be38f4e0ec17103eaa5c4093a674844`), octubre 83/75, noviembre 55/4 (mismas cantidades; las huellas de oct y nov pueden cambiar por movimientos reales).

---

## Parte 1. Drawer de la comisión (maqueta 2, 3, 5, 6b, 7) y Mi trabajo

**Drawer (`#hojaComision`, comisiones.js + app.css)**
- Ancho en PC: 600 px (hoy `.hoja.lado.corta` = 440). En teléfono, pantalla completa como hoy.
- Cabecera: nombre y una línea con RIF · código · líder · instalada · corte (la que ya existe). Debajo solo "Ver expediente completo". **Sin recuadro de datos** (`datosClave` se quita: está repetido).
- "Contactar a la líder" sale de arriba y va dentro del aviso de estado ("Todavía no cumple"): línea "¿Le escribes a X para que lo resuelva?" + botón "Escribirle a X". Usa el mismo `window.Contacto` (mismo destino, mismo mensaje, mismo registro). Solo sale si hay algo que pedirle.
- **Bloques iguales** (`plegable`): siempre punto (verde listo, ámbar falta, gris informativo), título en una línea, pastilla con estilo y flecha en el mismo sitio. Corte e Hilo hoy salen sin punto ni pastilla: arreglar. Título "Carta y proforma" (antes "Carta de bienvenida y proforma").
- **Carta y proforma**, mismo orden en todos los estados: (1) quién la envió, (2) un recuadro con Proforma · Ver PDF, Carta · Ver PDF, IP del servicio, Se envía a, (3) acción.
  - IP sin asignar: fila con "Escribir IP" (blanco) y "Ver sugeridas (N)" (color). Abre la hoja nueva de IP. Ya no se pinta el pool dentro del bloque.
  - Por enviar con número: WhatsApp verde ancho; debajo 3 botones iguales: Descargar PDF, Por correo, Ya la envié.
  - Sin número: "Agregar número" en la fila; principal "Descargar carta y proforma"; debajo Por correo, Ya la envié.
  - Descargada sin confirmar: banda azul "La descargó X el …" con "Ya la envié" y "Todavía no".
  - La envió el líder, falta Canales: línea azul "La envió X (líder) · Canales igual debe enviarla" + WhatsApp principal.
  - Sin dueño: carta "Sale cuando la instalación tenga dueño"; "Enviar la proforma por WhatsApp".
  - Enviada por Canales: línea verde con quién, cuándo y por dónde; 3 botones blancos: Volver a enviar, Descargar PDF, Por correo. Nada en color.
  - Cliente de aliado visto por el líder: solo los PDF y una línea.
  - Se quitan las 3 notas largas. **Error a corregir**: la nota "Ya enviada es para…" salía aunque el botón no estaba.
  - "Ya enviada (marcar)" se llama "Ya la envié" y abre la misma hoja de siempre (qué, cuándo, por dónde).
- **Hoja de IP nueva** (`hojaIp`, encima del drawer, 520 px en PC): aviso "Confírmala en el sistema técnico antes de usarla."; "Libres del pool" (IPv4 17 px, IPv6 en una línea con letra de ancho fijo, la primera con "Siguiente" y botón en color, "Usar"); "Parecidos en el reporte" (filas con motivo, o línea gris si no hay; "Ver otros parecidos"); "¿No es ninguna?" con IPv4 e IPv6 y "Guardar la IP escrita". "Escribir IP" de afuera abre esta hoja con foco en el campo. Usa `ip_parecidos`, `ip_usar` y lo que hoy usa `#profIp`.
- **No se pierde**: Aprobar/Quitar Legal, firma digital/física, Pedir al cliente, Subir varios, arrastrar a casillas, Marcar/Quitar pago, nota del pago, Paso 2 de WhatsApp, Cambiar número, Agregar número, Enviar por correo, Confirmar orden, Elegir otra orden, Cambiar dueño, ¿Es este cliente?, evento, corte, excepción, No comisiona, Volver a activar, Corregir corte certificado, Hilo.

**Mi trabajo (trabajo.js)**
- Las tareas de comisión (`carta_enviar`, `por_enviar`, `sin_ip`, `revisar_pago`, `certificar`, `venta_falta` con Legal listo) abren **el mismo drawer de Comisiones**, no la pestaña Comisión de la ficha ni la hoja vieja `abrirEnviar`. Hay que poder montar el drawer fuera de comisiones.html (módulo reutilizable).
- Las que hoy llevan a una página general deben caer en el sitio exacto: `por_asignar` sin cliente → Comisiones con filtro Por asignar; `cerrar_corte` → Comisiones en el cierre; `referido` sin cliente → Aliados en esa solicitud; otros sin cliente → Comisiones con el filtro que corresponda.
- Revisar que cada tipo de tarea abra en su sitio (tabla en la prueba nueva).

## Parte 2. Arriba de Comisiones, filtros y mensajes (maqueta 1, 6a, 6b, 8d)

- Sin las 3 tarjetas grandes. Fila de título "Comisiones · Corte de … · límite el …" con botón "+ Cliente nuevo" a la derecha. Debajo, línea de avisos (solo si hay algo): "N órdenes pasan de 24 h sin instalar · Ver órdenes" y "N instalaciones sin dueño · Asignar dueño" (este último no lo ve el líder).
- "Aliado: todos" ya no ocupa su fila: pastilla al lado de "Aliado comercial" solo con ese equipo elegido.
- **Errores de filtros a corregir** (comisiones.js):
  - `filasVista()` con `filtro === 'asignar'` ignora fechas, equipo y persona (devuelve todo `!orden_ok`).
  - `pasaExtra()` saca los pendientes cuando hay fechas: usar la fecha de la orden (`f.desde`).
  - `conteo()` y `porAsignar()` no cuentan con los mismos filtros que la lista.
  - Regla: todo se suma siempre (equipo, persona o aliado, fechas, búsqueda, pastilla) y cada número cuenta igual que la lista.
- Línea "Mostrando: … · Quitar todo" cuando hay filtros. Estado vacío: "Nada … en estas fechas. Hay N en todo el corte" + "Ver las N sin fechas".
- El filtro elegido no se pierde al abrir y cerrar el drawer.
- Mensajes: Documentos "Faltan todos los documentos" si no hay ninguno, nombra hasta 3, si no "Faltan N". Gramática "1 falta / 2 faltan" en la lista.
- **Mensaje al líder** (contacto.js `docs_faltan` + `contacto_destino`): el servidor manda `faltan`, `total` y `lista` (nombres). Texto: "le faltan todos los documentos" / "le faltan el RIF y la cédula del representante" / "le faltan 5 documentos".
- Cliente nuevo: el mensaje de RIF de otro líder no debe decir el nombre del otro líder (pendiente de confirmar con el administrador).

## Parte 3. Cliente nuevo con el RIF (maqueta 4, 6c)

- Paso 1: zona "Suelta aquí el RIF de la empresa" (PDF o foto) + "Elegir archivo"; enlace "No tengo el RIF: escribir los datos". Usa el OCR que ya existe (`ocr_leer`, mismo manejo que cambios.js: leído, dudoso en ámbar, no es RIF en rojo, no se pudo leer).
- Con lo leído: RIF y razón social editables; busca en la app ("No está en la app: se crea", "Ya está: abrir su expediente", o "¿Es este?" con provisionales como hoy); orden de Odoo sugerida por nombre ("Es esta" / "Otra"), opcional.
- Se quita el selector Jurídico/Natural (la regla dice que no se distingue); si el archivo es una cédula se lee como cédula.
- El archivo del RIF queda en su casilla al entrar al paso 2.
- Pantalla final al enviar: check, "Enviado a revisión", "Los N documentos quedaron en la bandeja del administrador", 3 pasos (Documentos subidos con hora, Revisión del administrador, Instalación) y botones "Subir otro cliente" / "Ver mis pendientes".
- Sigue igual: lo del líder solo lo ve él (ya protegido en `cliente_nuevo` y `por_instalar`).

## Parte 4. Actualizar datos y carta descargada (maqueta 8a, 8b, 8c)

- Subiendo: barra por archivo (se llena con el %), franja que corre mientras lee sin %, círculo girando y "Subiendo N archivos" en la zona de soltar, barra verde al terminar. Respeta `prefers-reduced-motion`.
- Historial: Hoy y Ayer abiertos por día; resto de la semana plegado por día; semanas anteriores plegadas por semana con aviso si una carga no terminó.
- Hoja "¿La vas a enviar por WhatsApp?": "Ya la envié" marca carta y proforma con fecha de hoy sin preguntar (canal otro) y sale el aviso "Marcada como enviada hoy · Cambiar" (abre la hoja de siempre). Botones: Enviar por WhatsApp, Ya la envié, Solo descargar.

## Parte 5. Aliados, vista del administrador y formulario (maqueta 9)

- Selector de mes arriba (como Comisiones, con flechas) y "Aliado: todos"; aplica a Solicitudes, Por mes, Sin autorización y Pagos.
- Fila de números del mes: Esperan tu decisión, Solicitudes del mes (aprobadas · negadas), Instaladas (con permiso), Sin autorización (por revisar).
- Pastillas: Esperan tu decisión, En curso, Sin enviar, Instaladas, Todas, Más filtros; contadas con el mes.
- Lista agrupada por semana.
- Formulario en PC: 920 px, dos columnas (zona de soltar y contacto a la izquierda, casillas a la derecha). Arrastrar funciona en toda la hoja, también en el paso 1 (soltar el RIF: OCR y revisión de disponibilidad; el archivo queda en su casilla). Hoy `dragover/drop` solo aceptan en paso 2. En teléfono, una columna como hoy.
