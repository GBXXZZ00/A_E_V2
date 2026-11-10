# Inventario de funciones (lote 10/11)

Regla del lote: ninguna función se quita. Antes de tocar cada pantalla se anota lo que había y, al terminar, dónde quedó.
Columna "Queda": **igual**, **movido a …** o **nuevo**. Se marca ✔ cuando la prueba o la captura lo confirman.

## Parte A · Datos y reglas (sin pantallas nuevas)
| Función de hoy | Queda |
|---|---|
| Actualizar: leer TAD con suspensión, habilitación y estatus actual por palabra en el encabezado | igual + reconoce `ULTSUPENSION` y `ULTACTIVACION`; 01-01-1900 vacío ✔ (test51) |
| Actualizar: TAD sin fechas en rojo "Sin fechas" | igual ✔ (test51) |
| Reporte de IP: cuadra por sucursal + código + ONT, llena IP, por confirmar, filas que no cuadran guardadas | igual + guarda las DISPONIBLE (sin cliente) con su IP ✔ (prueba SQL deshecha) |
| Hoja de comisión: IP "Lo más parecido" (misma ONT, mismo código, nombre), Usar esta IP, Ver otros parecidos, Escribir la IP | igual + arriba "Posible IP, confírmala en el sistema técnico" con las siguientes del pool; el botón se llama "Escribir IP" |
| Expediente: Escribir IP / Cambiar IP en cada servicio | igual |
| Clientes y Gerencia: churn, infancia y calidad (escondidos con `churn_visible = no`) | igual de escondidos; la pérdida sale de las reglas del 10/11 |
| IA: reglas de contratos (21) | igual (tabla Contratos y Aliados en `ia-reglas.md`); RIF sin vencimiento con fecha de inscripción o actualización = Digital ✔ (test16) |
| IA: lectura adelantada de aliados, OCR de RIF y cédula, combinados | igual; RIF y cédula con el modelo rápido |

## Parte B · Subir lo del día (`actualizar.js`, `actualizar.html`)
| Función de hoy | Queda |
|---|---|
| Qué toca actualizar (TAD, Odoo, Instalaciones, IP, Dedicados, índice; al día, toca hoy, nunca se ha subido, sin fechas) | movido a la tabla del día: cada archivo es una fila con su estado ("Falta el de hoy", "Opcional", "Al día") |
| Qué toca: Cambios de categoría y Mapa de red | Cambios: fila propia cuando se suelta; Mapa de red: su panel debajo (igual) |
| Zona para soltar varios archivos (CSV, Excel, KMZ) y Elegir archivos | igual, arriba, con los nombres de los archivos del día |
| Reconocer cada archivo por sus columnas; archivo desconocido "No sirve"; dos del mismo tipo no se mezclan | igual; la fila sale en rojo con qué hacer y "Quitar" |
| Cargar N archivos (botón) | **sin botón**: lo leído se sube solo (decidido 10/11) |
| TAD corto: Cargar igual / Quitar todos | igual (aviso arriba) |
| Casilla "Actualizar también el índice de residenciales" | movido a la fila del índice: se decide solo (toca o no) con "Actualizar el índice igual" y "Saltar el índice hoy" |
| Índice en segundo plano con su porcentaje; Seguir con el índice; Seguir solo con el índice | igual, en la fila "Índice de residenciales" |
| Instalaciones con fechas viejas: Va solo a Aliados / Usarlo para comisiones | igual, en su fila: "Así está bien" o "Usarlo para comisiones" antes de subirlo |
| Carga que se detiene: Reintentar | igual, en la fila ("Reintentar") |
| TAD sin fechas en rojo | igual, en la fila y en el historial |
| Cruzar ahora → resumen → Guardar cruce | **el cruce corre solo** al terminar (decidido 10/11); el resumen queda en "Ver detalle del cruce"; si falla, "Cruzar otra vez" |
| Historial agrupado por fecha con quién subió | tabla Fecha, Archivo, Estado, Números (las últimas 15 y "Ver más") |
| Solo administrador y Analista Senior | igual |

## Parte C · Clientes (`ficha.js`)
| Función de hoy | Queda |
|---|---|
| Panel "Revisión del expediente" con 6 puntos, Bien / Pedir / Revisar, propuesta de la IA, Cerrar revisión | igual; fuera de una revisión es una línea "Revisión: N de 6 marcados · Abrir" (se abre con Abrir, con Revisar o entrando con revisar=1); los puntos van en una fila compacta; lo marcado queda como chip y al tocarlo se cambia; "Plegar" ✔ (test52) |
| Pedir (requerimiento), Devolver, Ya no aplica, actas, Qué pedirle al cliente | igual ✔ (test52, test40, test04) |
| Pestañas del expediente | igual (Documentos con secciones plegables cerradas en la parte J) |

## Parte D · Comisiones (`comisiones.js`, `comisiones.html`)
| Función de hoy | Queda |
|---|---|
| Tarjetas Instalaciones, Cambios de categoría, Cartas y proformas (filtran) | igual |
| Avisos Por instalar, Por asignar, Subir documentos de un cliente nuevo | igual, junto a las tarjetas |
| Pestañas por equipo (Ventas corporativas, Canales, Aliados) | chips con **Todos** por defecto; persona al elegir un equipo; aliado (sin subgrupos, etiqueta morada en cada fila) |
| Filtros Todas, Comisionan, Falta legal, Sin pago, Del corte anterior, Por asignar, Archivos por subir, Pendientes, Eventos | igual + **Les falta algo** y **Carta por enviar** |
| Buscador, Bajar Excel, Días para el pago, Cerrar corte, selector de corte | igual |
| Agrupado por dueño con secciones (corte anterior, este corte, cumplieron, por instalar) y Enviar pendientes | igual (vista normal); los aliados en un solo grupo |
| Nuevo | **Lista por fecha** (la más nueva primero, dueño en etiqueta, Legal · Pago · Orden y carta) y **Desde / Hasta** |
| Hoja: Cliente y orden (¿Es este cliente?, Confirmar orden, Elegir otra orden, Cambiar dueño) | igual, cerrada al abrir |
| Hoja: Legal (firma, Aprobar o Quitar Legal, Pedir al cliente, Subir varios, casillas con subir o arrastrar) | igual, cerrada al abrir |
| Hoja: Pago (TAD, Marcar o Quitar pago, nota) | igual, cerrada al abrir |
| Hoja: Carta (WhatsApp, Descargar, correo, Ya enviada, IP con lo más parecido y el pool) | igual + "Se envía a" con Cambiar; sin número: Descargar en color y Agregar número; al descargar "¿La vas a enviar por WhatsApp?"; "Descargada · por confirmar" con Ya la envié; aviso a las 2 horas |
| Hoja: Más acciones (evento, cambiar de corte, excepción, No comisiona, corregir corte certificado, escribir nota) | movido a **Corte y comisión** (todo menos la nota) y la nota al **Hilo** |
| Hoja: Hilo | igual, cerrado, con "Escribir una nota" |
