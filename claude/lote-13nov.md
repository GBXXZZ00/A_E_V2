# Lote 13/11: observaciones sobre lo publicado del lote 12/11 B (aprobado por Gualfredo el 13/11)

Maquetas montadas sobre la app real del simulador: `claude/maquetas/obs-13nov/img/` (script `montar-maqueta.js` en la misma carpeta).
**La pantalla publicada tiene que quedar igual a la maqueta** (Gualfredo lo pidió expreso): mismas medidas, colores, textos, orden y espacios; si algo de la maqueta no se puede, se pregunta antes, no se cambia por cuenta propia. Regla de siempre: copiar medidas y textos de la maqueta, sacar capturas a 1366x768 y en iPhone y compararlas con la maqueta antes de publicar. No tocar el cálculo de comisiones (al terminar, septiembre 46/41, octubre 83/75 y noviembre con las mismas huellas).

## 1. Aliado: los recuadros de resultado también en la Solicitud de prueba del administrador
- Hoy el recuadro centrado sale para el aliado (test20 lo prueba) pero NO en la Solicitud de prueba del administrador: `aliados.js` `mostrarRes()` sale de una vez si `modo` no es `aliado` ni `canales`. Gualfredo prueba con la Solicitud de prueba, por eso no lo vio.
- Arreglo: en la Solicitud de prueba todo se ve y se comporta igual que para el aliado (mismo drawer de 640 px, mismos recuadros 600/350 px de la lámina `aliado-pantallas.html`, mismos textos y botones). Lo único distinto: lo que se crea queda marcado como prueba, como hoy.
- Además, en Aliados del administrador, junto a "Solicitud de prueba", un botón **Ver los avisos** que abre una lista con cada caso (Revisando, ¡Puedes instalar!, Te falta algo, Carterizado, Ya está siendo gestionado, Excepción no aprobada, No procede, Ya tienes una solicitud, Referido enviado) y al tocar uno muestra su recuadro tal cual con datos de ejemplo, sin tocar la base. Sirve para mirarlos todos sin tener que provocar cada caso.
- Code revisa también, en la base real y con rollback, qué devuelve `aliado_rif` para un RIF de un cliente con líder (debe ser `cartera`) y para uno sin líder; lo anota en el traspaso.
- Pruebas: los recuadros en modo administrador (prueba) y "Ver los avisos" con los 9 casos.

## 2. Revisión de documentos: visor alto (maqueta 01, 01b)
- `.hoja.rv-pant` ocupa la ventana con 12 px de margen: `width:calc(100vw - 24px); height:calc(100dvh - 24px)`, radio 20 (se quita el tope de 1300x724).
- La línea de la IA sube a la cabecera como pastilla (`padding 6px 6px 6px 14px`, radio 99, 13 px) entre el título y "Abrir carpeta en Drive": "Estás revisando tú · La IA no los ha leído · Que la revise la IA" (y sus otros estados: leyendo con barra corta, ya leyó, no pudo). "Ver todo lo que vio la IA" queda dentro de esa pastilla.
- Lista a 340 px; filas con `padding 9px 12px`.
- Cabecera del documento en una sola fila de 58 px: título y quién lo subió a la izquierda; a la derecha **Vence** (campo de 150 px, solo si aplica), **Más ▾**, Marcar que firma (si aplica), Devolver, Bien.
- **Más** reúne lo que antes ocupaba dos filas bajo el PDF: Es otro documento, Reemplazar archivo, Abrir en Drive, No está en la junta, Ya no aplica. Se quitan `.rv-dt` y `.rv-rep` (la fecha del acta va en la cabecera como Vence cuando el documento es un acta).
- El PDF se lleva todo el alto que queda (márgenes 12/16 px). A 1366x768 debe medir al menos 500 px de alto (hoy ~290).

## 3. Devolver con motivos por documento (maqueta 02, 02b, 03)
- Devolver ya no empuja el PDF hacia abajo: abre un panel a la derecha del PDF (350 px, borde rojo claro), con lista de opciones (radio de 18 px, texto y una línea de ayuda), nota opcional y pie fijo con Cancelar / Marcar para devolver. El PDF se angosta, no pierde alto.
- Motivos por tipo de documento (solo se ven los del documento abierto):
  - Cédula: Está vencida · Borrosa, cortada o con reflejo · Es de otra persona · El nombre no coincide (con el acta o con el RIF personal) · Otro motivo.
  - RIF personal: Está vencido · Borroso, cortado o incompleto · Es de otra persona · No coincide con la cédula · Otro motivo.
  - RIF de la empresa: Está vencido · Borroso, cortado o incompleto · No es de esta empresa · El domicilio no coincide con el acta · La razón social no coincide · Otro motivo.
  - Acta constitutiva: Ilegible o le faltan páginas · No es de esta empresa · Sin los datos del Registro · Falta un acta · Otro motivo. (Se quita el bloqueo "solo se devuelve si…" de la hoja vieja.)
  - Acta de asamblea: Ilegible o le faltan páginas · No es de esta empresa · Sin los datos del Registro · No nombra al representante · Otro motivo.
- Se guardan con los motivos que el servidor ya acepta (`motivo` de la lista cerrada + la nota con el texto del motivo), como hoy `sin_registro` y `falta_acta`. Si hace falta un motivo nuevo en la lista cerrada, migración y anotarlo.
- **Falta un acta**: al elegirlo aparecen de una vez las actas (`REQ_TIPOS`): Ratificación o cambio de junta directiva, Cambio de domicilio fiscal, Cambio de razón social, Prórroga de la duración, Acta que nombra al representante, Otra acta (escribe cuál). El botón dice **Pedir el acta**: la constitutiva queda aprobada y se crea el requerimiento de esa acta (el mismo de "Pedir otro documento"). Aviso ámbar: "Se le pide a [líder] el acta de … La constitutiva queda aprobada y el expediente espera esa acta." (pendiente de confirmar por Gualfredo).

## 4. Es otro documento (maqueta 04)
- Desde Más → "Es otro documento": panel azul a la derecha "¿Qué documento es?" con RIF de la empresa, Acta constitutiva, Acta de asamblea (queda como la siguiente: Acta de asamblea N), Cédula y RIF personal (eligen representante), Otro documento (escribe cuál). Botón **Moverlo**.
- Servidor: función nueva `documento_reclasificar(p_documento, p_casilla, p_numero)` que mueve el mismo archivo (sin subirlo de nuevo), deja la casilla de origen vacía para que entre en lo que falta, y anota en la bitácora quién, cuándo, de qué casilla a cuál. Si la casilla destino ya tiene archivo: preguntar "Reemplazar el que está" o "Dejar los dos".
- Solo el administrador mueve documentos; la abogada sigue marcando "Tiene un problema".

## 5. Documentos en un mismo PDF: que se vea que están juntos (maqueta 05, 05c, 05b)
- Hoy en la revisión cada documento sale suelto aunque vengan en el mismo PDF. Cambia así:
- **Lista (05):** los documentos del mismo archivo van dentro de una tarjeta con borde azul claro (`#C9D3F2`, radio 16, fondo `#F7F9FF`). Arriba de la tarjeta, una franja azul (`#EAF0FF`) con el icono PDF y "Un solo archivo con N documentos" y debajo "nombre.pdf · N páginas". Cada documento dentro dice su estado y sus páginas ("Bien · páginas 1 a 8"). Las filas van unidas, separadas por una línea fina, sin el radio de las sueltas.
- **Cabecera del documento:** al lado del título, pastilla azul "Mismo PDF que N documentos más"; debajo "nombre.pdf · páginas 9 a 12".
- **Visor:** encima del PDF, la fila "En este archivo:" con un tramo por documento, cada uno con su estado (círculo vacío, ✓ verde o ! rojo), su nombre y sus páginas; el abierto en blanco. Un toque salta a esas páginas (`#page=`) y cambia el documento seleccionado de la lista. Al decidir uno, Bien pasa al siguiente del mismo archivo.
- **Devolver dentro de un archivo compartido (05c):** además del motivo, "¿Qué se devuelve?": Solo este documento (los otros siguen bien) o El archivo completo (se piden de nuevo los N documentos).
- Las páginas salen de lo que leyó la IA. Si no hay páginas (por ejemplo, el aliado marcó "Viene en otro archivo"), la tarjeta y los tramos salen igual, sin el "p. …", y el visor abre en la página 1.
- **Un documento en varios archivos (05b):** la misma fila de tramos muestra "Archivo 1 nombre · Archivo 2 nombre…" en vez de los botones Archivo 1/2 de hoy.

## 6. Clientes: filtro de fecha (sin cambiar lo demás de Clientes)
- Botón **Fecha** al lado de "Filtros" (maqueta 06b, solo el desplegable): "Fecha de" Entró a la app · Cambió de estatus · Firmó el contrato · Vence el contrato; "Cuándo" Este mes · Mes pasado · Últimos 30 días · Este año · Entre fechas. Quitar · Ver N clientes. Queda en la dirección (`fd=`, `fde=`, `fha=`).
- Servidor: `clientes_lista3` recibe en `p_f` `fecha: {de, desde, hasta}`; conteos y facetas la respetan.

## 7. Mi trabajo: todo plegado para todos (maqueta 07)
- Como el de Legal: administrador, líder, analista y coordinadora empiezan con todas las secciones plegadas y se recuerda lo que se abrió (`abiertoLg` generalizado, en `localStorage` con try/catch).
- "Lo más urgente" deja de ser una sección suelta: cada grupo plegado muestra su número y la pastilla roja de vencidos (y "N hoy").
- El equipo también es un plegable con su número y vencidos.
- Línea corta arriba: "Todo plegado: abre solo lo que vas a trabajar."

## 8. Comisiones: filtros en dos renglones sin recuadro (maquetas 10 hoy, 11, 11b, 11c, 11d)
- Se quita el recuadro `.cx-panel` y las etiquetas EQUIPO y VER.
- Renglón 1 (44 px de alto): buscador (ocupa lo que sobra) · **Equipo: Todos ▾** (desplegable con los equipos y sus números; debajo "Persona" con cada líder y su número, 11b) · **Fechas: todo el corte ▾** (Todo el corte, Esta semana, Semana pasada, Hoy, Entre fechas con Desde y Hasta, 11c) · selector **Por dueño | Por fecha** · botón **···** con Bajar Excel y Días para el pago (11d).
- Renglón 2: Todas · Comisionan · Les falta algo · Carta por enviar · Más filtros (los de hoy, iguales).
- "Aliado: todos" sigue saliendo como pastilla solo con ese equipo. Lo elegido queda en la dirección como hoy.
- Teléfono: el renglón 1 queda buscador a todo el ancho y debajo Equipo, Fechas y ··· en una fila con desplazamiento propio (no la página).

## 9. Enviar pendientes al lado del nombre del líder, también para la analista (maqueta 11, 11-analista)
- Se quita la fila `.pend-barra` de dentro del grupo. En la cabecera del grupo, justo después del nombre, una pastilla de 32 px con borde verde claro: WhatsApp + "Enviar pendientes" y, si ya se envió, "· ayer, Marcos" (último envío y quién).
- La cabecera hoy es un solo `<button class="grupo-cab">`: no se puede meter otro botón dentro. Se arma como fila con el botón de abrir/cerrar y el de Enviar pendientes aparte (delegación de eventos, `data-pend`).
- La analista también lo ve y lo usa con los líderes de las instalaciones que ella lleva (mismo armado del mensaje: lo que falta, Legal, pago, carta). Servidor: `pendientes_lider` y `pendientes_enviados` aceptan a la analista solo para esos líderes; la bitácora guarda quién envió. El mensaje firma con el nombre de quien envía.
- El líder y el Aliado comercial no lo ven. "Sin dueño" no lleva el botón.

## 10. Teléfono (sin maqueta nueva)
- Hoy en teléfono el documento queda debajo de toda la lista. Propuesta: la hoja muestra la lista; tocar un documento abre el documento a todo el alto con "← Documentos" arriba y Devolver / Bien abajo; los paneles de Devolver y Es otro documento suben como hoja desde abajo.

## Respuestas sin cambio
- La abogada (Reina) ya tiene el mismo visor, en solo lectura, con "Tiene un problema" por documento y "Terminar y enviar" / "Empecé el contrato".

## Probar cada caso del aliado (para Gualfredo, con el usuario aliado de prueba, después de recargar la app)
1. RIF nuevo que no esté en la app → "disponible", se abren los documentos.
2. RIF de un cliente con líder en la app → recuadro gris "Este cliente ya está carterizado" con Referir cliente.
3. RIF de un cliente que otro aliado tiene en una solicitud abierta → recuadro "Este cliente ya está siendo gestionado".
4. El mismo RIF dos veces con el mismo aliado → "Ya tienes una solicitud de este cliente" con Abrir.
5. Foto borrosa del RIF → ámbar "No se lee bien" con Intentar de nuevo.
6. Una cédula en lugar del RIF → rojo "Esto no parece el RIF".
7. Enviar una solicitud completa → recuadro azul "Revisando tu solicitud"; luego, según lo que decidas tú: ¡Puedes instalar!, Te falta algo, excepción no aprobada, No procede.
8. Referir desde el caso 2 → "Referido enviado".
