# Lote 05/11: Documentos, Mi trabajo, Comisiones, Dedicados/VGT, Resúmenes y arreglos (APROBADO por el administrador el 05/11)

Maquetas aprobadas: `claude/maquetas/lote-05nov/` (abrir los `.dc.html`; mandan sobre el texto si hay duda). Lienzo vivo del administrador: https://claude.ai/artifact/Ja8aAdXC8fjiqtWGC2yT2w
Datos de las maquetas inventados. Este repo es público: nada de datos reales en pruebas ni capturas.

## Reglas para este lote (obligatorias, aprendidas del 28/10)
1. **Nunca quitar una función.** Antes de tocar una pantalla, haz el inventario de botones y acciones de la versión actual y de v66 (`claude/auditoria-v66-v67.md`). Al terminar, cada función tiene que tener su lugar. Deja el inventario en `claude/inventario-05nov.md`.
2. **Evidencia, no "hecho".** Todo lo que el traspaso diga que funciona se demuestra con una consulta a la base real (conteo) y una captura. Ejemplo de lo que falló: el traspaso del 28/10 decía que el TAD leía la última suspensión y no la lee.
3. **Pruebas contra datos reales.** Además de `pruebas/`, compara los números de Inicio, Mi trabajo, Clientes, Comisiones y Gerencia contra la base real (solo lectura) y que den lo mismo. Comisiones: referencia `privado.comision_filas3` igual al empezar y al terminar.
4. **Una sola fuente por número.** Si dos pantallas muestran el mismo número, lo calcula una sola función del servidor.
5. Publica por partes (una versión `?v=` por parte), en el orden de abajo, y corre la batería entera al final.
6. **Pendientes viejos:** todo lo anotado antes (28/10-B, 30/10, `revision-modulos.md`, `por-definir.md`) va en este lote de una vez. Si algún pendiente viejo choca con lo decidido el 05/11 (este documento y sus maquetas), manda el 05/11: ese pendiente NO se hace y se anota en el traspaso por qué.
7. Prohibido el guion largo en textos. Maqueta = referencia de diseño; el estilo final usa `base.css` y `app.css`.

## Parte A · Arreglos directos (sin maqueta)
1. **Firma separada** (`privado.requeridos`): con firma separada basta UN representante completo (cédula, RIF, contacto y en la junta). Los demás representantes no generan faltantes aunque tengan datos o archivos. Con conjunta, todos los que exige la cláusula. Revisar también `reglas.mjs`.
2. **Aprobar nunca baja un estatus** de `contrato_en_curso`, `por_firmar` o `contrato_firmado` (en `recalcular`, `documento_revisar`, `revision_lote`, `revision_cerrar` y cualquier otro camino). Prueba que lo demuestre.
3. **Lote 28/10-B** (`claude/revision-modulos.md`, sección "Fallas encontradas al usar v67"): la Analista Senior NO aprueba ni devuelve documentos (servidor y pantalla); el cambio de PIN obligatorio no debe cerrar la sesión ni dejar la marca puesta; Inicio y Mi trabajo cuentan con la MISMA función; el mismo archivo subido dos veces no se lee ni se paga dos veces.
4. **Pendientes del 30/10** (`claude/por-definir.md`, última sección): junta sin período NO asume 10 años (bloquea y pide "Acta de asamblea de ratificación o cambio de junta directiva"); nombres completos de las actas; correo del representante parecido a su nombre o "revisar a mano"; firma conjunta exige cédula y RIF vigentes de ambos; póliza RC general mínimo US$ 100.000 (patronal sin mínimo); TV Cable: Addendum N.º 1 del 01/10/2026, 105 postes, Taratara a Puerto Cumarebo, USD 1 por poste al mes (hoy dice 270 de Sabaneta El Recreo).

## Parte B · TAD y Resúmenes (sin maqueta)
Diagnóstico del 05/11 (en el servidor): 0 de 3.738 servicios tienen `ult_suspension` ni `ult_habilitacion`; la carga del TAD del 05/11 dice `con_fechas: 0`; `actualizar.js` no busca esas columnas.
1. El TAD lee **última suspensión, última habilitación y estatus actual** buscando la columna por palabra en el encabezado. Si una carga trae 0 fechas, la fila de la carga lo dice en rojo y no se da por buena.
2. **Instalaciones PYME por mes:** una sola función para todas las pantallas (hoy octubre da 123 en `res_clientes`/Gerencia y 95 en `clientes_resumen`). Documenta la definición en `claude/reglas-negocio.md`.
3. **Sin datos ≠ cero:** las series empiezan donde hay datos (Comisiones desde septiembre) y donde no hay se lee "Sin datos". Nada de "por armar" ni "Gráfica no reconocida" publicado: o funciona o no se muestra.
4. **Mes en curso:** comparar contra el mismo tramo del mes anterior (del 1 al día de hoy) y rotularlo "mes en curso".
5. Detalles que fallan hoy: churn de infancia y serie de Clientes ("Gráfica no reconocida"), calidad por dueño (vacío), equipo Canales en Comisiones (vacío aunque el ranking tiene 1).
6. Churn, churn de infancia y calidad por dueño se ESCONDEN hasta que el TAD tenga fechas de al menos un mes completo y cuadren con un caso conocido.

## Parte C · Documentos del expediente (maquetas 1a, 1b, 1c, 1d)
1. **Panel "Revisión del expediente"** junto a las casillas, en el orden de la oficina: razón social, domicilio fiscal, vigencia de la empresa, junta directiva, firmantes, contacto. Cada punto: Bien / Pedir / Revisar. Si la IA leyó, su propuesta sale con borde punteado y la etiqueta "Propuesta, falta confirmar"; NUNCA como Bien ya marcado. Sin IA funciona igual (todo en blanco). Estado "La IA no pudo leer". "Cerrar revisión" aplica todo de una vez y avisa al líder.
2. **Dos acciones distintas:** Devolver (documento subido malo; motivos: vencido, ilegible o incompleto, no es de esta empresa, sin los datos del Registro, otro) y **Pedir** (documento que no está). Pedir crea un **requerimiento**: cliente, casilla destino, documento pedido (lista cerrada: Acta de asamblea de ratificación o cambio de junta directiva, …de cambio de razón social, …de cambio de domicilio fiscal, …de prórroga de la duración, Acta que nombra al representante, Otro con texto), motivo, documento origen, quién y cuándo, estado (abierto, por revisar, cumplido, anulado). La casilla queda en rojo con el nombre completo. Al subir algo en esa casilla pasa a "por revisar"; se cumple al aprobarlo; si se devuelve vuelve a abierto. Bitácora en todo. La IA solo propone requerimientos; los confirma una persona.
3. La **constitutiva solo se devuelve** si no es de la empresa, está ilegible o no trae los datos del Registro. Ya no se devuelve para pedir actas.
4. **Representantes:** "Firma este" marca al que cuenta. "No está en la junta" y **"Ya no aplica"** (gris, sus documentos quedan en el historial, no cuentan, "Volver a contar").
5. **Acta que cambia la junta o el representante** (1c): casilla en el acta + fecha de inscripción + directores que quedan (nombre, cédula, cargo, si firma). Al guardar: los que salieron pasan a "Ya no aplica"; si alguien nuevo firma, se piden su cédula y RIF (requerimiento). Desmarcar revierte con bitácora. Una venta de acciones sola no cambia la junta.
6. **Documentos extra:** título obligatorio al subir y "Cambiar título". "Convertir en acta" (pide fecha de inscripción, sin volver a subir).
7. **Archivo combinado:** un archivo marcado en varias casillas se sube UNA vez a Drive con el nombre combinado y queda enlazado a cada casilla; cada casilla dice "Mismo archivo que …". Hoy se sube una vez por casilla (caso real: un PDF quedó 3 veces).
8. **Para el líder** (1d, también en la ficha): recuadro "Qué pedirle al cliente" con el mensaje listo (WhatsApp y Copiar) armado con los requerimientos y devoluciones abiertos; cada línea roja con su botón "Subir esta …" que cae en la casilla correcta.

## Parte D · Mi trabajo (maquetas 2a y 2b)
1. Solo es un índice de tareas por rol. Cada tarea abre el lugar real donde se hace (expediente en la casilla exacta, hoja de comisión, Por instalar, Migraciones, Actualizar) y al cerrar vuelve a la misma línea. El botón dice el destino ("Abrir expediente", "Ir a la comisión"…).
2. **Excepción:** la revisión de documentos se hace dentro de Mi trabajo ("Revisar aquí", botón azul), usando el MISMO panel de la Parte C (no una copia).
3. **Grupos plegables** con su número; los que tienen tareas urgentes abiertos, los demás plegados.
4. **Abogado:** "Por elaborar contrato" separado por tipo de cliente con prioridad **ISP, corporativo, VGT (por solicitud), PYME**, y botones de filtro por tipo con su número arriba. Luego Enviado a firmar, Firmado falta subir, Vencen en 60 días.
5. **Líder:** devueltos o pedidos, te faltan para comisionar, por instalar, gestiones. **Analista:** cartas y proformas, cambios por emitir, tareas sueltas. **Senior:** sin dueño, provisionales, cargas; NO ve revisión de documentos. **Administrador:** revisar documentos (aquí), por decidir, cargas.
6. "Marcar hecho" solo donde no hay acción en otro lado; pide confirmar y queda en bitácora. Mis notas se quedan.
7. Buscador por RIF o nombre. Aviso "Qué cambió" por rol con "Entendido" (una vez por persona).
8. Números arriba = los mismos de Inicio (una sola función).

## Parte E · Comisiones (maquetas 3a y 3b)
1. **Lista:** diseño actual (tarjetas, pestañas por equipo, avisos Por instalar y Por asignar). Dentro de cada dueño, secciones: "Corte de X: si no cumplen al dd/mm se pierden" (roja), "Instaladas en este corte", "Cumplieron" (verde). Bloque **Migraciones del corte** (confirmadas y por confirmar). Grupo "Sin dueño".
2. En la fila **solo etiquetas informativas**, sin botones: Legal, Pago y Orden como puntos de color; carta ("Carta enviada por Canales · fecha · canal", "por enviar · N días", "espera la IP"); "Parece ser …" en provisionales; "Orden sin confirmar"; "Instaló … (aliado)"; "Falta elegir dueño". Toda la fila abre la hoja.
3. **Hoja (3b):** la hoja de antes, con secciones PLEGABLES (lo que falta abierto en ámbar, lo listo plegado en verde). Arriba a la vista: "Ver expediente completo" y "Contactar a la líder". Secciones:
   - Cliente y orden de Odoo: "¿Es este cliente?" Sí / No, Confirmar orden, Elegir otra orden, Cambiar dueño.
   - Legal: cada documento que falta con "+ Subir o arrastrar" ahí mismo (como antes), "+ Agregar acta de asamblea", "+ Otro documento", Aprobar Legal a mano con Firma digital / Firma física.
   - Pago: Se pagó allá, Ver en el TAD.
   - Carta y proforma: IP del servicio (ver punto 4), qué enviar (Las dos, Solo carta, Solo proforma), Enviar por WhatsApp, Descargar los PDF, Enviar por correo, **"Ya enviada (marcar)"** (qué, cuándo, por dónde; queda quién lo marcó). Ya enviada: muestra quién, cuándo y canal, y "Reenviar".
   - Más acciones (plegado): cambiar de corte, dar excepción, marcar como evento, no comisiona, escribir una nota. Hilo plegado.
   - Las acciones extra son botones, no enlaces de texto.
4. **IP sin cruce:** hoy 985 servicios PYME activos no tienen IP (925 habilitados, 101 instalados desde septiembre); la carga del 05/11 trajo 3.003 filas, cuadraron 2.539. Primero diagnostica por qué no cuadran (formato del código, nombre de la sucursal, ONT) y corrige la normalización. El reporte trae nombre, ONT, código y sucursal: lee también el NOMBRE. Si no cuadra por sucursal + código + ONT, busca en este orden: misma ONT; mismo código en otra sucursal; nombre más parecido (`normalizeStr`, similitud). La app propone "Lo más parecido: nombre · sucursal · IP · ONT" con Usar esta IP / Ver otros parecidos / Escribir la IP a mano. Nunca la pone sola.

## Parte F · Dedicados y VGT (maquetas 4a y 4b)
1. **Clientes queda igual.** Solo se agrega "+ Registrar dedicado nuevo" junto al buscador cuando la tarjeta seleccionada es Dedicado corporativo o Dedicado ISP; y en la búsqueda sin resultados por RIF ("No encontramos …" con el mismo botón).
2. Registrar: RIF (avisa si ya existe y enlaza), razón social, tipo ISP o corporativo, líder, servicio a contratar (opcional). Crea el cliente provisional dedicado y abre su expediente en Documentos. Etiqueta azul "Aún no está en el TAD"; cuando el TAD (o la base de la analista) trae ese RIF, se une solo (o "¿Es este cliente?" si hay duda) y la etiqueta desaparece. El abogado lo ve en "Por elaborar" cuando los documentos están aprobados.
3. **VGT por solicitud** (pestaña Contratos y VGT): las 2 pólizas por cliente (sirven para todas sus solicitudes); por cada solicitud (fila de `dedicado_contratos` tipo vgt): propuesta comercial firmada (1) y planillas de tendido aprobadas por infraestructura (1 o más, "+ Otra planilla"). Estado por solicitud ("Lista para contrato", "Faltan N"). La propuesta comercial ya no es requisito a nivel de cliente. Solicitudes negadas no piden nada. "+ Nueva solicitud".

## Parte G · Actualizar: el índice del TAD en segundo plano (va PRIMERO, antes de la Parte A)
Hoy `tad_indice` tiene 419.138 filas (298 MB). La pantalla compara en tandas de 10.000 (unas 42 vueltas) y mientras tanto `ocupado` bloquea toda la pantalla: no se puede subir Odoo ni órdenes ni tocar "Cruzar ahora".
1. **El TAD de empresas se sube siempre y primero**, como hoy. Apenas termina, el índice sigue en segundo plano con su propia barra ("Índice de residenciales: 45 %") y su propio estado, separado de `ocupado`. Mientras corre se pueden soltar y subir los demás archivos (Odoo, órdenes, IP, KMZ) y tocar "Cruzar ahora": el cruce no espera al índice. Si se cierra la pestaña se pausa y "Seguir con el índice" retoma (ya existe, 12 h). Al cerrar la pestaña con el índice corriendo, avisar que se pausará. El cierre por falta de uso no corta mientras corre.
2. **Índice opcional:** casilla "Actualizar también el índice de residenciales", marcada sola una vez por semana (si la última carga del índice tiene 7 días o más) o cuando haya migraciones esperando confirmación del TAD; los demás días desmarcada (solo empresas). "Qué toca actualizar" muestra la fecha del último índice.
3. **Comparación por bloques:** ordenar por clave y mandar la huella de cada bloque de 1.000 filas (unas 420 huellas, una sola llamada); el servidor calcula las mismas huellas sobre lo guardado y devuelve los bloques distintos; solo esos se comparan fila por fila como hoy. Medir y anotar en el traspaso el tiempo antes y después con el archivo real.
4. Nada de esto cambia qué datos quedan: las pruebas de Migraciones (confirmación por el TAD) deben dar igual antes y después.

## Al terminar
- Capturas 1366x768 e iPhone de cada parte en `pruebas/capturas/lote05nov-*`.
- Revisión independiente, corregir, subir `?v=`, commit y push a main.
- Actualizar `claude/traspaso.md` con la evidencia (consultas y números) de cada punto.
