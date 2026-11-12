# Lote 12/11 B: Comisiones, Mi trabajo, Cliente nuevo, Actualizar y Aliados

## ENCARGO PARA CLAUDE CODE (leer primero)
El administrador aprobó todo el lote el 12/11/2026. Ejecútalo completo, por partes, sin volver a preguntar lo ya decidido aquí.

**El diseño es lo más importante de este lote.** En lotes anteriores las maquetas se veían bien y la app quedó distinta y fea. Esta vez no:
1. **Antes de tocar una pantalla, abre su maqueta en el navegador** (`python3 -m http.server 8765` y `http://localhost:8765/claude/maquetas/lote-12nov-b/…`) y saca su captura. Esa captura es la meta.
2. **Copia las medidas de la maqueta, no las inventes:** anchos (drawer 600, hoja IP 520, formulario aliado 760 a 920), rellenos (16 a 26 px), radios (14, 18, 24, 28), tamaños de letra (13 a 15 px cuerpo, 17 a 26 títulos), alturas de botón (38 chico, 44 normal, 48 a 50 principal), colores de `:root`. Si una clase de app.css ya existe y da otra medida, gana la maqueta (cámbiala con un selector específico de esa pantalla, sin romper otras).
3. **Compara lado a lado** captura de la app (1366x768 y 390x844) contra captura de la maqueta, pantalla por pantalla y estado por estado (vacío, cargando, error, listo). Si algo no coincide (alineación, espacio, botón que salta a dos líneas, texto que no es el de la maqueta), se corrige antes de seguir. Los textos de la maqueta son los textos finales.
4. **No se pierde ningún botón ni función** (lista en cada parte). Si algo cambia de sitio, se anota aquí.
5. Al terminar cada parte: pruebas del módulo, capturas comparadas, y se publica esa parte (el administrador pidió ver en vivo parte por parte). Batería completa y revisión propia al final del lote.
6. Comisiones: referencia antes y después de cada parte que toque Comisiones (ver más abajo).

Maquetas (en `claude/maquetas/lote-12nov-b/`, y para las partes 6 y 7 en `claude/maquetas/revision-nueva/`):
- `comisiones-hoja.html`: secciones 1 a 10 (Comisiones arriba y filtros, drawer de comisión, hoja de IP, cliente nuevo con OCR, teléfono, ajustes, estados de la carta, Actualizar datos, Aliados administrador, casillas del aliado).
- `aliado-flujo.html`: el flujo general del aliado y su inicio en PC.
- `aliado-pantallas.html`: **la referencia del aliado**: pantalla completa de PC caso por caso (8 casos) y la versión de teléfono. Manda sobre `aliado-flujo.html` y sobre la sección 9 y 10 de `comisiones-hoja.html` si hay diferencia.

Decisión por defecto (el administrador no la contestó; si dice otra cosa, se cambia): cuando un líder sube en Cliente nuevo el RIF de un cliente de otro líder, el mensaje es "Ese RIF ya es de otro líder. Pídele al administrador que lo revise.", **sin el nombre** del otro líder.

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

### Parte 5b. Aliado: una casilla por documento y combinados (maqueta 10)
Decidido por el administrador (12/11): no se identifica todo junto; cada documento va en su casilla (separa responsabilidades y evita retrabajo).
- Se quita la zona general "Arrastra todos los documentos juntos" y `casillaPorNombre` (adivinaba por el nombre y metía lo desconocido en la primera casilla libre). Cada casilla acepta soltar o elegir su archivo, también la del RIF en el paso 1.
- Cada casilla muestra su análisis: barra con % al subir, "Leyendo" mientras se lee (`vigilarN`), y al final verde "corresponde" o ámbar "Esto parece X, no Y. ¿Lo cambias?" con "Cambiar archivo" (usar la lectura que ya llega en `solicitud_estado`).
- Combinados: en una casilla vacía, enlace "Viene en otro archivo" que muestra los archivos ya subidos de esa solicitud con "Está aquí". El mismo archivo queda en las dos casillas sin subirlo de nuevo (revisar en el servidor cómo enlazar un archivo a otra casilla; la revisión ya trata archivos con varias casillas). La casilla queda en azul "Viene en el mismo archivo de …" con "Quitar".
- El resumen de Aliados (vista Resumen que ya existe, `Resumen.enModulo`) usa el mismo mes que la lista; la fila de números de la maqueta 9 no debe repetir lo que ya muestra el Resumen.

### Parte 5c. Flujo del aliado (lámina `aliado-pantallas.html`, corregida 12/11 10:48)
- Un solo drawer "Nuevo cliente" con tres secciones en orden: 1 El cliente (Empresa/Persona; al elegir aparece la casilla del RIF), 2 Contacto, 3 Documentos. Mientras lee el RIF ya se puede escribir el contacto. Documentos se abre cuando el RIF dice "disponible". Pie: Guardar lo que llevo · Enviar solicitud.
- Documentos de una empresa: RIF de la empresa, acta constitutiva, cédula y RIF del representante. El acta de asamblea NO va de entrada: solo aparece su casilla cuando la revisión la pide (domicilio, junta, razón social), y ahí está "Pedir excepción".
- Resultados: **recuadro grande centrado** (600 px en PC, 350 en teléfono, radio 28/24), **todo el recuadro del color del estado** (fondo verde, gris, ámbar, azul, morado o rojo claro; icono en círculo blanco; cajas internas blancas), con la solicitud difuminada detrás (blur y velo). Reemplaza la pantalla completa `al-res`.
- Teléfono: el alta es una hoja que sube desde abajo hasta casi arriba; pie con Enviar solicitud arriba y Guardar lo que llevo debajo, ambos a todo el ancho y 48 px; en el inicio, "Nuevo cliente" fijo abajo sobre la barra de navegación.
- Revisando: "Revisando tu solicitud" con tres puntos animados, el paso en curso con puntos y una franja que corre, y el aviso "No salgas de aquí hasta que termine".
- ¡Puedes instalar!: sin fecha ni calendario. Texto: "Cuando llegue la orden de instalación con tu nombre, pasa sola a Instalada y te avisamos." Botones: Volver al inicio · Ver la solicitud. (Marcar instalación con fecha existe hoy: no se borra la función; queda dentro de Ver la solicitud hasta que el administrador decida quitarla.)
- Cartera: "Este cliente ya está carterizado"; sin "No guardamos sus documentos". Botones: Referir cliente, Escribir al administrador de contratos, Volver al inicio.
- En gestión por otro: un solo texto "Este cliente ya está siendo gestionado", sin decir quién (no hace falta que el servidor distinga).
- Excepción negada: no es "No procede" (si faltan documentos nunca es No procede): vuelve a "La excepción no se aprobó" con Subir el acta.
- En todo caso negativo: "Escribir al administrador de contratos".
- Referir: servicio Internet PYME fijo; teléfono de contacto y coordenadas (opcional); nota con "Escribir al administrador de contratos".

---
## Parte 6. Revisión de documentos (aprobada el 12/11, maqueta `claude/maquetas/revision-nueva/`)
Referencia visual: `revision-nueva/index.html` (capturas montadas sobre la app real) y su guion `montar-maqueta.js`, que pinta cada estado encima de la app del simulador. **Para comparar: corre el guion, corre la app nueva con los mismos datos y compara captura con captura.** El CSS que usa el guion (clases `zz-*`) es la referencia exacta de medidas: 1300 x 724 la pantalla de revisión, lista 380 px, filas de 12 px de relleno y 15 px de título, botones Devolver/Bien arriba del documento, pie con resumen y botón principal.
Proceso actual documentado (para saber qué se reemplaza): `claude/maquetas/revision-actual/`.

**Quién revisa lo decide el administrador.** La IA NO corre sola.
- Ficha, pestaña Documentos: una sola banda arriba (la `#paso` de hoy) con "N documentos por revisar", una línea de estado y dos botones: **Que la revise la IA** (secundario, solo si la IA no ha leído) y **Revisar**. Mientras la IA lee: "Se los pasaste a la IA. Está leyendo: 3 de 4" con barra. Al terminar: "La IA ya los leyó: 3 cuadran y 1 tiene algo que mirar".
- Se quitan de la ficha: el recuadro `.rp-linea` (N por revisar · Ver los 6 puntos), la fila `Revisar N · Aprobar seleccionados`, la tarjeta `.ia-bloque`, el panel de 6 puntos `.rp` con su "Cerrar revisión", la barra `#barraRev` con el otro "Cerrar revisión" y el visor `hojaVer` de un documento por hoja. El "Revisar" de cada casilla abre la pantalla nueva ya parada en ese documento.
- Todo lo demás de la ficha queda igual (pestañas, Expediente, Contratos, VGT, casillas, Agregar representante/acta, Otros documentos, Drive).

**Pantalla de revisión** (una hoja grande centrada con la ficha difuminada detrás):
- Cabecera: "Revisar expediente", cliente · RIF · líder · cuándo subió; a la derecha **Abrir carpeta en Drive** y cerrar.
- Franja de la IA (una sola): ámbar "La IA encontró N cosas" + resumen + "Ver en el acta"; verde "La IA revisó todo y cuadra"; azul "La IA está leyendo" con puntos animados y barra; gris "Estás revisando tú" con **Que la revise la IA** y su costo.
- Izquierda, la lista agrupada como la ficha: **Representante 1, Representante 2…** (cada uno: Cédula, RIF personal, **Teléfono y correo**) y **Empresa** (RIF, Acta constitutiva, Actas de asamblea, Correo de la empresa). Cada fila: punto de estado (verde Bien, rojo Devolver, ámbar la IA vio algo, vacío sin decidir, gris ya aprobado antes) + nombre + una línea. Lo aprobado en una revisión anterior sale gris "Aprobado antes" y no se vuelve a decidir.
- En la cabecera de cada representante: chip **Firma este** o botón **Marcar que firma**; en su detalle, **No está en la junta** y **Ya no aplica** (las mismas funciones de hoy, `marcar_rep`).
- Derecha, el documento elegido: título, nota de la IA en una línea (ámbar si hay algo, verde si cuadra), **Devolver** y **Bien** arriba a la derecha; debajo el visor y abajo sus datos (fecha del acta, también trae, vencimiento si aplica, Reemplazar archivo).
- Teléfono y correo: se ven como datos con Editar y se revisan igual (Bien o Devolver con motivos: el número no es del representante, no contesta, el correo rebota, el correo no es de él, otro).
- Devolver: los motivos salen arriba del documento (no en la lista) con su nota; "Falta un acta" trae el texto de la IA. **Nada se envía al marcar**: se aplica todo al terminar.
- Pie: resumen ("3 bien · 1 se devuelve · falta 1 · nada se envía hasta terminar") y un solo botón: **Aprobar expediente** (verde, cuando todo es Bien) o **Terminar y avisar a [líder]** (cuando hay algo devuelto). Deshabilitado mientras falte decidir algo.
- Excepción: el "Aprobar igual (excepción)" de un punto de la IA queda en la franja con motivo (mismo `ia_excepcion`).
- Terminar y avisar: hoja chica con qué se aprueba, qué se devuelve, en qué estatus queda y el mensaje editable; **Solo guardar** o **Guardar y enviar por WhatsApp**. Reemplaza `hojaCerrarRev` y `revision_puntos_aplicar`: un solo cierre.
- Estatus: al abrir la revisión, Documentos en revisión; al aprobar, **Documentos recibidos + Legal aprobado** (sin el panel de 6 puntos; los puntos de la IA, si la hubo, quedan guardados como hoy). Al devolver, Documentos pendientes. Final aprobado: "Expediente aprobado" con **Avisar a [líder]** y **Siguiente cliente**.
- Teclado: flechas arriba/abajo cambian de documento; B = Bien; D = Devolver.

**El visor** (importante, el administrador revisa por aquí):
- PDF en el visor del navegador (iframe con el blob, como hoy) ocupando todo el alto disponible; abre en la página que diga la IA (`#page=N`, usar `pagina_inicio` o la página del punto). Imágenes ajustadas al ancho con zoom.
- Mientras miras uno, se baja en segundo plano el siguiente (`drive_archivo`) para que al tocar Bien ya esté listo. Esqueleto mientras carga; error claro con Reintentar y "Abrir archivo".
- No se dibujan recuadros sobre el documento (la IA no da posición, solo página).

**Mi trabajo, Revisar en lote**: se aprueba por cliente, no por documento; solo se pueden marcar los clientes donde la IA dice que cuadra; los demás se abren con Revisar.

**Abogada**:
- Ficha: "Tu paso" igual, con el botón principal **Ver documentos y empezar** (abre la misma pantalla en solo lectura).
- En la pantalla: lista de documentos aprobados, en cada uno **Tiene un problema** (marca, no envía); pie con **Hay un problema** (lo que no es de un documento: pedir otro o solo avisar) y **Empecé el contrato** (pasa a **Contrato en curso**). Con algo marcado, el pie dice **Terminar y enviar a [administrador]**: un solo aviso con todo, el contrato se detiene y el cliente vuelve a Documentos pendientes (mismo `legal_observar`).
- A la abogada no le sale "por revisar" en el expediente.

**No se pierde**: motivos de devolución, Pedir otro documento (en la lista "¿Falta algo que no está?" con `requerimiento_crear`), fecha del acta, también trae, Reemplazar archivo, excepción con motivo, mensaje al líder, bitácora por documento, historial de revisiones, Comparar IA y Legal, Drive.

## Parte 7. Clientes por estatus legal y Mi trabajo de la abogada (aprobada el 12/11)
- Clientes: una fila propia "Estatus legal", aparte de "Filtros" y de la barra de grupos, con **los estatus tal cual existen en la app** (`Comun.ESTATUS`, mismo nombre y mismo color): Todos, Grandes negocios, Documentos solicitados, Documentos pendientes, Documentos en revisión, Documentos recibidos, Contrato en curso, Pendiente por firmar, Contrato firmado, cada uno con su número según la tarjeta elegida (PYME, Dedicado corporativo, Dedicado ISP). Un toque filtra; se recuerda en la dirección. Para el administrador y para la abogada. No usar los nombres de los grupos de la barra (Sin gestionar, Faltan documentos…). Maqueta: `revision-nueva/img/20-clientes-pestanas.jpg`.
- Mi trabajo de la abogada: los chips Todos, ISP, Corporativo, VGT, PYME suben arriba de todas las secciones y filtran todas (Por elaborar, En curso, Enviado a firmar, Firmado falta subir, Vencen). Cada fila de cada sección lleva su etiqueta de tipo (hoy solo la lleva Por elaborar y a veces dice PYME en un ISP: revisar `tipoDe`). Los pendientes por firmar se ven en "Enviado a firmar". Maqueta: `revision-nueva/img/21b-abogada-mi-trabajo-larga.jpg`.
