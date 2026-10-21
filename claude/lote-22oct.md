# Lote 22/10: migraciones, IP, Mi trabajo con gestiones y notificaciones

Aprobado por el administrador el 20/10 en el chat del proyecto. Ejecútalo completo, en tres tandas, siguiendo CLAUDE.md:
- pruebas solo del módulo tocado por parte, batería completa al final de cada tanda;
- capturas solo de lo que cambió;
- una publicación por tanda;
- respuesta final corta.

Mantén el diseño que ya tiene la app. Todo tiene que ser fácil de entender para un líder.

**Datos que ya están en la base (no van al repo, el repo es público):**
- `privado.migraciones_historico`: 50 filas (septiembre 27, octubre 23) del consolidado de cambios de categoría.
- `privado.app_vieja_docs`: 67 archivos de la app vieja que no están en la app nueva, con `rif`, `casilla`, `numero`, `drive_id`, `rif_app` (RIF con que existe el cliente en la app, si es distinto) y `nota`.

**En el repo:**
- `assets/plantillas/`: planilla de cambio de titular.
- `claude/maquetas/mi-trabajo/`: maqueta aprobada de Mi trabajo, con nombres inventados.

**Referencia de comisiones al empezar y al terminar cada tanda:** septiembre 46/41 en vivo (la foto certificada 59/49 no se toca) y el corte de octubre como esté al empezar (68/49 el 20/10; puede haber subido por aprobaciones de Legal en vivo).

---

## TANDA A

### A1. Expediente: actas y representantes
- Hasta **15 actas de asamblea**, cada una con su fecha para ordenarlas. Hoy la pantalla limita a 4 (`ficha.js`, test07).
- Al subir varias actas de una vez, cada archivo toma el número siguiente.
- Hasta **10 representantes**. Hoy la base exige `representantes.orden` entre 1 y 4: cambia ese límite.
- La regla de firma conjunta, la IA y `Cerrar revisión` revisan a todos los representantes, no solo a los 4 primeros.

### A2. Migraciones: módulo simple
Reemplaza el flujo de 8 pestañas de v38. Se reaprovechan `cambios`, `cambio_*`, `tad_indice` y `privado.tad_cambios_detectados`.

**Decisiones del administrador**
- Desde el 21/10 todo cambio se registra en la app: el líder lo registra y sube los documentos. Nada anterior a septiembre.
- El deber ser: al hacer un cambio de categoría en Proham se cambian **el plan y la categoría** a la vez.
- Los documentos los revisa el **administrador**, como en una instalación. Al aprobarlos, el cambio pasa solo al analista: no hay otra aprobación aparte.
- Persona natural: cédula y RIF. Titularidad a jurídico: todo lo legal del nuevo titular.
- El caso negativo se llama **"Cambio a residencial"**.
- En Comisiones, las migraciones van separadas de las instalaciones.

**Tipos:** Migración a PYME · Cambio de titular · Ambos · Cambio a residencial.

**Formulario "Nuevo cambio"** (una sola pantalla, tres bloques y un botón):
1. **Servicio:** buscar por código, nombre, cédula o RIF en el índice del TAD y marcar los servicios. Se ven código, sucursal, plan, categoría, dirección y estado.
2. **Qué cambia:** los 4 tipos, cada uno con una línea de ayuda.
3. **Nuevo titular y documentos** (solo si hay titularidad):
   - "Subir RIF" lee nombre, RIF y domicilio (ya existe).
   - Si es jurídico, se piden el nombre y la cédula del representante legal.
   - Correo y teléfono.
   - Una zona para soltar varios archivos, que muestra las casillas que tocan:
     - Migración a PYME: las de una instalación.
     - Cambio de titular: planilla firmada, identidad del titular actual y documentos del nuevo titular.
     - Ambos: la suma.
     - Cambio a residencial: sin documentos, motivo obligatorio.
- **Registrar.** Los documentos quedan en el expediente del cliente, por revisar. Si el cliente no existe, se crea con su RIF.

**Planilla de cambio de titular** (en `assets/plantillas/`)
- Se genera al registrar, con **Descargar** y **Enviar por WhatsApp**. Se puede volver a generar desde el cambio.
- Usa `cambio_titular_fondo.jpg` (hoja carta a 200 ppp, idéntica a la plantilla oficial) como fondo y escribe encima con el PDF sin librerías de `documentos.js`.
- Las posiciones están en `cambio_titular_campos.json`, en puntos desde la esquina superior izquierda:
  - `linea`: escribir con la línea base en `base`;
  - `celda`: centrar en vertical;
  - `marca`: una X centrada en la casilla.
- Helvetica 9 pt, azul oscuro.
- `cambio_titular.html` es la fuente del fondo y `cambio_titular_ejemplo.pdf` muestra el resultado esperado.
- El administrador acepta que la parte de abajo (firmas) quede como está; se mejora después.
- De dónde salen los datos:
  - Titular actual: del TAD (nombre, documento, dirección, teléfono). Si ya es cliente, también del expediente (correo y representante).
  - Nuevo titular: del RIF leído y de lo que escribe el líder.

**Flujo y pestañas**
1. **Por revisar:** el administrador revisa los documentos. "Cambio a residencial" salta este paso.
2. **Por emitir:** el analista del líder hace el cambio en Proham y marca **Hecho**. El coordinador ve y puede hacer lo de todos los analistas.
3. **Por confirmar:** la app lo confirma sola con la siguiente carga del TAD (ver más abajo).
4. **Confirmadas.**
- Solo el administrador y el Analista Senior ven **Sin registro**: cambios que el TAD muestra sin registro en la app. Pueden asignar un líder (entra al flujo con sus documentos), o marcar "Fue un error" o "Revertido".
- Todo deja bitácora.

**Detección con el TAD.** Esto sale del análisis de los TAD del 29/07, 31/08, 30/09 y 20/10:
- Columnas: `CATEGORIA` (1 GB o PROMO-1GB, que pasa a PYME-1GB) y `Plan` (BRONCE-RES, que pasa a ORO-EMP). **Empresa completa = categoría con PYME y plan con EMP.**
- Identidad del servicio = **sucursal + código + equipo**. El mismo código se repite en distintas sucursales y un código puede tener varios servicios.
- Si sucursal + código siguen iguales con otro equipo, es el mismo servicio (al migrar suelen cambiar el equipo). Si el equipo pasa a otro código, es titularidad o "ambos".
- Los códigos llegan con o sin ceros a la izquierda ("021" o "21"): normaliza.
- **Confirmada:** el servicio pasa a empresa completa. Si cambió solo la categoría o solo el plan, se queda en Por confirmar con el aviso "Falta cambiar el plan" o "Falta cambiar la categoría".
- **Cambio a residencial:** se confirma cuando el servicio deja de ser empresa completa. Es el indicador negativo del líder.
- **Cambio de titular:** se confirma cuando el equipo o el código aparece con el documento nuevo.
- Lo que el TAD muestra sin registro va a Sin registro.
- El reporte de Proham "Consulta Cambio de Categoría" (Código, Nombre, Fecha, Categoría Anterior, Categoría Actual, Operador, Comentario) se puede subir para tomar la fecha exacta. Ignora las filas del operador RADIUS cuya categoría anterior es un número.

**Protección de las cargas del TAD**
- Un TAD con menos del 95% de las filas de la carga anterior se detiene con aviso y no se aplica sin confirmar.
- Ningún cliente se borra por no venir en el TAD. Si falta en dos cargas seguidas, se marca "No aparece en el TAD".
- La pantalla de subidas muestra la fecha y la hora de la última carga de cada archivo.

**Comisiones**
- Cada corte muestra dos bloques: **Instalaciones** y **Migraciones**.
- Una migración comisiona con la regla de siempre (legal y pago). Entra al corte por la fecha en que el TAD la confirma, con el mismo día límite y el mismo cierre manual.
- Titularidad sola no comisiona. "Ambos" comisiona por la categoría.
- Las fotos certificadas no se tocan.

**Histórico septiembre y octubre**
- Carga `privado.migraciones_historico` como cambios confirmados, marcados "Pagado fuera de la app", en su corte. No crean instalación ni comisión y no tocan la foto de septiembre.
- Enlaza con el cliente por RIF; si no existe, créalo. Cada uno muestra en su ficha qué documentos tiene y cuáles faltan.
- Filas repetidas (mismo código): una sola vez, guardando los líderes en la nota.

### A3. IP: cruce automático con el reporte "Clientes Empresariales"
- Nueva fuente en la pantalla de subidas: el reporte de Proham "Clientes Empresariales". Columnas: Sucursal ("824 - MARACAIBO"), Cliente, Nombre, ONT, VLAN, Fecha Asignación, Estado, IPV4, IPV6, Delegado, Pref, StatusServicio, FechaUltSuspension, FechaIntalacion. El título va en la fila 1 y los encabezados en la 2.
- Se puede volver a subir cuando se quiera para actualizar.
- Ignora las filas con Estado DISPONIBLE (son IP libres, sin cliente).
- Cruce: sucursal + código + ONT (= equipo) contra `servicios`. Si cuadra, llena `ip` e `ip6` sin preguntar.
- Prueba con el archivo real del 20/10: de 2.293 claves, 2.266 cuadran con el TAD también por equipo; 1 trae otro equipo y 26 no están como empresa en el TAD.
- **"IP por confirmar" solo cuando lo amerite:** el equipo no coincide, o el servicio ya tiene una IP puesta a mano distinta. Si todo cuadra, no se pide nada.
- La IP siempre se puede cambiar a mano (`ip_mano`, bitácora). Ninguna carga pisa una IP puesta a mano.
- **Dedicados no entran en el cruce de IP**, salvo que se les instale un servicio PYME nuevo; ese servicio sí entra.
- El pendiente "Falta IP" sale solo para servicios PYME instalados que el reporte no trae.
- La bienvenida toma la IP sola.

### A4. Documentos de la app vieja
Usa `privado.app_vieja_docs`.
- Entran como `por_revisar`, a nombre de "App anterior", con el mismo esquema de `privado.drive_importar` (archivos con `drive_id` y `url_externa`, documentos y `documento_archivos`), y bitácora por cliente. Sin recalcular estatus.
- Casos:
  - Si `rif_app` tiene valor, enlaza con ese cliente.
  - La fila marcada "confirmar con el administrador" se le pregunta antes.
  - "Casilla ya aprobada": no se toca.
  - Si la casilla ya tiene un documento por revisar, el archivo se agrega a ese documento.
- "Cliente no existe en la app": no crees clientes. Al final, dale al administrador la lista para que decida.
- Después de cargar: marca `traido_en`.
- Para llenar correos, teléfonos y representantes vacíos, el administrador sube el CSV de la base vieja en la pantalla de subidas, como siempre (`privado.cruzar` ya llena solo lo vacío).

---

## TANDA B: Mi trabajo, Gestiones y Filtros

Maqueta aprobada: `claude/maquetas/mi-trabajo/`. `Main.dc.html` tiene la estructura, los estilos y los datos de ejemplo por rol; las demás pantallas solo cambian el rol.

### B1. Mi trabajo (rehacer `trabajo.html` y `trabajo.js` sobre `privado.pendientes()`)
- **Arriba:** el saludo con nombre y una frase del momento (por ejemplo "El corte de octubre cierra el 21/10"), más las píldoras de vencidos, de los que vencen hoy y del total.
- **Tarjetas por grupo** (rejilla asimétrica, la primera más ancha). Cada una lleva su icono, nombre, una línea de qué es, el número grande, las píldoras de vencidos y de hoy, y un pie con un dato útil. Al tocarla se filtra la lista; "Ver todo" quita el filtro.
- **"Para hoy":** lista ordenada por urgencia (vencido, hoy, mañana). Cada fila lleva un punto de color, la acción y el cliente, el motivo, el plazo y un botón que hace la acción ahí mismo. Cada tarea sale sola cuando se resuelve (sin botón "Hecho").
- **A la derecha:** gestiones con barra de avance, un panel de indicadores del rol y, según el rol, "Equipo" o una cola.
- **Grupos por rol:**
  - Líder: Conseguir documentos · Hacer firmar · Por instalar · Mis gestiones. Indicadores de su corte.
  - Analista: Emitir cambios · Bienvenidas y proformas · IP por confirmar · Revisar pago. Indicadores de su semana.
  - Coordinador de analistas: lo mismo de todos los analistas, con filtro por analista y botón "Hacerlo yo". Panel Equipo con sus analistas.
  - Legal: entra en **Documentos recibidos**. Elaborar contrato (en cola: "Empezar", al terminar uno se abre el siguiente) · Por firmar · Firmado sin archivo · Por vencer (60 días).
  - Administrador y Analista Senior:
    - **Revisar documentos**, en cola: lo que suben líderes, aliados y el correo.
    - Por decidir: cerrar corte, comisiones y cambios sin registro.
    - Aliados: permisos y bloqueos.
    - Alertas: cargas raras.
    - Panel Equipo: vencidos y de hoy por persona; al tocar a una persona se ve su lista.
- **Teléfono:** tarjetas en 2 columnas, columnas apiladas y la barra de abajo de siempre.

### B2. Gestiones (nuevo)
- Una gestión tiene nombre, meta, plazo, responsables y clientes.
  - La meta se elige de una lista cerrada que se mide sola: expediente completo, actas subidas, contrato firmado, habilitación Conatel, documentos de VGT.
  - También se puede marcar cumplida a mano, con nota.
- Las crean el administrador, el Analista Senior y el coordinador, desde Mi trabajo.
- Cada cliente de la gestión tiene su estado: Contactado, Sin contacto, Esperando, Cumplido o Resuelto. Lleva nota y la fecha en que el cliente prometió entregar, con historial completo (quién, cuándo y qué).
- Avance a la vista ("7 de 12, faltan 3 días"). Al vencer o cumplirse, la gestión se archiva con su resultado.
- Un cliente puede estar en varias gestiones.
- Las 12 etiquetas de `cliente_gestion` se pasan a una gestión "Documentación ISP" con meta expediente completo.

### B3. Filtros de Clientes con subgrupos
- Un solo botón **Filtros**: en teléfono abre una hoja desde abajo, en escritorio un panel. Adentro, grupos plegables y cada opción con su contador:
  - Tipo;
  - Estatus legal;
  - Líder;
  - **Gestiones** (cada gestión activa y sus estados);
  - **Contrato de dedicado:** Sin contrato, Por firmar, Por actualizar, Firmado sin archivo, Sin vencimiento, Vence en 60 días. Solo cuenta dedicados.
  - VGT;
  - Otros: Suspendidos.
- Dentro de un grupo, las opciones se suman (una u otra). Entre grupos, se combinan (las dos a la vez).
- Los filtros activos se ven como chips con X. Los atajos actuales se quedan.

---

## TANDA C: Notificaciones

Programar según `claude/notificaciones.md` (v2, 20/10).
- Primero **en la app**: campana con contador, lista de avisos con enlace a la tarea exacta, marcar leído. Después **Web Push** con `sw.js` y una función de Supabase.
- Genera las claves VAPID y guárdalas como secretos de Supabase, nunca en el repo.
- Cada persona da permiso desde su teléfono o su laptop, con una pantalla que explique para qué sirve.
- El correo al cliente es la fase 2: no va en este lote.

---

## Verificación
- Comisiones: la referencia de arriba al empezar y al terminar cada tanda.
- Migraciones: prueba del flujo completo con datos inventados (registrar, revisar, emitir, confirmar con dos TAD de prueba) y una prueba por cada caso de detección: categoría sola, plan solo, equipo nuevo, código nuevo, cambio a residencial, titular nuevo ya PYME.
- IP: prueba con filas que cuadran, equipo distinto, IP a mano distinta, fila DISPONIBLE y dedicado.
- Mi trabajo: una prueba por rol (incluido el coordinador).
- Gestiones: crear, asignar, cambiar estado, cumplir sola.
- Notificaciones: cada evento llega a quien corresponde y una sola vez.
- Capturas en escritorio e iPhone de las pantallas nuevas.
- Al final, actualiza `claude/traspaso.md`.
