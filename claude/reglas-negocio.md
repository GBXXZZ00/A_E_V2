# Reglas de negocio fijadas por el administrador

Sin nombres reales: el repo es público. "Analista Senior" es el responsable de comisiones; "canales" es la persona externa que lleva a los aliados.

## Fuentes y cruce
- Cadena: orden en Odoo (venta del líder) -> orden de instalación -> aparece en el TAD (consolidado de usuarios, no de clientes).
- La base es por cliente (RIF), no por usuario. "Cantidad de usuarios" es la cantidad de servicios por RIF. El RIF se normaliza tomando el del TAD.
- Una orden de Odoo creada y no instalada entra a la base con ese estatus, para que el líder suba documentos.
- El cruce de archivos (Odoo, órdenes de instalación, TAD, base vieja) lo hace la app en la pantalla Actualizar, arrastrando los archivos todos juntos. A futuro serán más de cuatro archivos.
- En la orden de instalación: "instalador xx" es el equipo propio; un nombre propio es un aliado. Los reemplazos son cambios de equipo y no comisionan (sirven de indicador).
- Lo que no coincide con la base vieja queda en "Grandes negocios", para hacerle gestión.
- Una PYME instalada como residencial es un error: queda como pendiente con aviso.

## Comisiones
- Corte del 21 al 20 hasta septiembre 2026; desde octubre 2026 del 18 al 17 con límite el 18 (ver Decidido 13/10). Hora de Caracas. Requisitos: Legal y pago. Si no cumple pasa al corte siguiente; si tampoco cumple, se pierde y queda constancia. Los que vienen del corte anterior se marcan como prioritarios.
- El dueño de la comisión lo manda la orden de instalación: comisiona quien instala, aunque el cliente esté en cartera de otro. Si instaló un aliado, es del aliado aunque la orden la haya montado un líder.
- La orden de Odoo es obligatoria, debe ser nueva (creada hasta 45 días antes de la instalación) y va siempre a la vista. Sin orden clara: "pendiente por asignar" hasta que el Analista Senior confirme o asigne.
- Pago: lo dice el TAD (deuda por RIF). El Analista Senior puede marcarlo o quitarlo a mano y eso se respeta en la siguiente carga.
- Excepciones: solo el administrador, con motivo.
- Decidido 09/10: la excepción del documento (revisión e IA) y la excepción de la comisión son cosas distintas. Si al cliente le falta un acta, se le puede pagar la comisión por excepción, pero el acta sigue saliendo como "Falta" en el expediente y se sigue buscando. En la revisión solo admiten excepción la junta vencida y el firmante fuera de la junta.
- Decidido 09/10: Factibilidad no pasa sola a "Vendida" (los líderes no siempre ponen los datos). Si la consulta tiene RIF y aparece una orden de Odoo con ese RIF, se muestra como indicador.
- Dedicados, conectividad, aliados y reemplazos no comisionan. Los eventos comisionan a veces: decide el Analista Senior.
- Naturales: también salen en el corte y se pagan. Solo cédula y RIF personal; contacto opcional; sin contrato.
- Canales comisiona con las mismas reglas de documentos.

### Decidido 13/10 (Lote 1: comisiones)
- Período desde el corte de octubre 2026: instalaciones del 18 del mes anterior al 17, hora de Caracas. El 18 es la fecha límite fija para Legal y pago (no se mueve por fin de semana). El 19 se puede certificar y el 20 el Analista Senior certifica y envía. Una instalación del 18, 19 o 20 es el primer corte del ciclo siguiente. Lo que no cumple al límite pasa al corte siguiente y, si tampoco, se pierde.
- Transición: octubre del 21/09 al 17/10; noviembre del 18/10 al 17/11. Los cortes hasta septiembre conservan la regla del 21 al 20. La regla vive en la base con fecha de inicio (`privado.corte_reglas`), no fija en el código. La tarjeta de días cuenta hacia el límite; hasta el día límite inclusive el corte anterior sigue "en curso".
- Evento a mano: mientras no haya nomenclatura, el Analista Senior marca o desmarca Evento en la hoja de comisión y decide si comisiona (bitácora y hilo). EVENTO en el título lo marca solo; la marca a mano no la pisa el cruce. Los eventos que no comisionan salen en el filtro "Eventos".
- Órdenes creadas por otra persona: lista "Crean órdenes por otros" en Usuarios (por el nombre de Odoo, porque muchos líderes aún no tienen usuario). Toda orden de esa persona sin código de vendedor al final del título queda SIEMPRE por asignar, aunque el nombre coincida, con el motivo "Orden creada por otra persona, sin código". Con código, el dueño es el vendedor de ese código. Lo ya confirmado solo desde octubre volvió a por asignar (fueron 4); los cortes certificados no se tocan.
- Cada fila por confirmar o por asignar dice su motivo en una frase (nombre parecido, sin orden, orden de otra persona, orden vieja, falta a quién pertenece).
- IP a mano: se escribe desde la hoja de comisión y desde la hoja de envío; la escriben el administrador y los analistas (incluido el Analista Senior). Queda marcada como escrita a mano (`servicios.ip_mano`): una carga posterior vacía no la borra (hoy ninguna carga toca la IP).
- Proforma y carta: bloque arriba en la hoja de comisión, con Descargar y Enviar, "Enviada por <nombre>, fecha" y "Falta IP". El PDF sale siempre con los datos del momento y se puede reenviar; cada envío queda anotado. En la fila solo la etiqueta "Bienvenida por enviar" o "Enviada dd/mm". Envían el administrador, los analistas (incluido el Senior) y el líder.
- Excel del corte (para planta externa): agrega técnico o instalador y número de orden de Odoo. El formato definitivo llega con un histórico; las columnas están en una sola lista para reordenarlas.
- Archivos por subir: marca aparte del estatus legal para clientes con Legal aprobado (documentos recibidos o más adelante) con casillas obligatorias sin archivo, según natural o jurídico. No toca estatus, comisión ni corte certificado. Etiqueta y filtro con contador en Comisiones; filtro en Clientes (reemplaza el atajo "Por instalar"). Lo que sube el administrador a un cliente ya aprobado entra aprobado y no cambia el estatus (salvo contratos, que siguen su flujo). La marca se quita sola al completar. El 13/10 eran 26 clientes del corte de septiembre.

- Por instalar (pestaña de Comisiones, reemplaza el filtro de Comisiones y el atajo de Clientes): órdenes de Odoo abiertas sin instalación. El líder ve las suyas; el administrador y los analistas, todas, agrupadas por líder, con las rojas arriba. Reloj: cuenta solo de 8:00 a 22:00 hora de Caracas, todos los días, desde la primera orden de la misma venta (las reprogramadas no lo vuelven a cero y llevan etiqueta con las veces). Ámbar a las 16 horas contadas y rojo a las 24. Se apaga cuando llega la instalación o Odoo la cancela. En Inicio solo un contador que lleva a la pestaña. Aparte, para el administrador y el Analista Senior, "Realizada en Odoo sin instalación" (60 días).
- Cliente provisional: cada orden abierta sin cliente identificado crea un cliente provisional con el nombre del título, a nombre de quien creó la orden (o por asignar si la creó otra persona sin código; lo elige el Analista Senior). Si el nombre se parece a un cliente existente, la app pregunta "¿Es este cliente?" antes de crearlo. Cuando se conoce el RIF (escrito en el expediente, por la nomenclatura o al llegar la instalación) se une al cliente real si existe (con sus documentos, contactos e hilo) o pasa a ser cliente normal. Como el RIF de clientes es obligatorio, el provisional usa un número interno 99xxxxxxxx que nunca es un RIF real y en pantalla dice "Provisional, sin RIF". Decisión de Claude Code (falta confirmar): la lectura del RIF por la IA todavía no lo une sola; se escribe en el expediente.

## Migraciones (cambios de categoría y de titular), decidido 14/10
- Viven en su propio módulo "Migraciones", no en Comisiones. En Comisiones solo quedan las filas "Cambio de categoría" del corte y el aviso de los que faltan por decidir.
- Ningún cambio entra solo a comisión. Un cambio a PYME confirmado queda "Comisión: por decidir"; el Analista Senior o el administrador marcan Sí o No con motivo (bitácora). Solo el Sí entra al corte. Quitar el Sí lo saca, salvo que el corte esté certificado. Así hasta que se resuelva el flujo completo.
- Fecha mínima para comisionar (ajuste editable, hoy 21/09/2026): un cambio de antes queda solo como registro.
- No se cargan datos reales ni el histórico hasta que el administrador coteje los cambios del mes.

## Nomenclatura de Odoo (arranca el lunes 12/10/2026)
- Formato del texto que escribe el líder: `INST. [TIPO] NOMBRE J000000000` y, solo si la orden la crea otra persona por él, su código de vendedor en número al final. El MDT o nodo lo pone Odoo solo.
- RIF sin guiones y con su letra (J, V, G, E). Para persona natural, la cédula con su letra. Hay que prever RIF mal tecleado.
- TIPO es una lista cerrada, una forma por categoría de orden:
  - `PROMO PYME`: instalación PYME nueva. Es casi todo.
  - `EVENTO`: instalación para un evento. Comisiona a veces; decide el Analista Senior.
  - `MIGRACION`: cliente que ya tiene servicio residencial y pasa a PYME.
  - `CAMBIO`: cambio de plan o de equipo en un cliente que ya existe.
  - `DEDICADO`: lo puso Claude Code por su cuenta; el administrador no lo ha confirmado.
- En Factibilidad solo aplican los tipos de cliente nuevo: PROMO PYME, EVENTO y, si se confirma, DEDICADO. Migración y cambio son de clientes que ya tienen servicio y no pasan por factibilidad.
- Lo que hoy se escribe delante y estorba el cruce (reprogramada, requiere construcción, día y hora) va al final o en notas, nunca delante.
- El cruce debe llevar el número de la orden de trabajo de Odoo.

## Expediente y documentos
- Casillas: cédula y RIF personal por representante (hasta 4), RIF de la empresa, acta constitutiva, actas de asamblea (agregables hasta 4), Conatel, contrato PYME, contrato dedicado, otros.
- Orden en Documentos: por representante teléfono y correo (una sola celda de contacto), cédula y RIF; después lo de la empresa. Teléfono y correo cuentan para "faltan".
- El nombre del representante no se escribe a mano: lo llena la IA al analizar.
- Al subir varios archivos, la persona marca qué trae cada uno.
- El contrato PYME solo se sube desde "Pendiente por firmar". La marca de proveedor ISP es solo para dedicados.
- Cuando el líder pide documentos el estatus pasa a "documentos solicitados"; cuando el líder sube, a "en revisión"; cuando Legal aprueba, a "recibidos".
- Cliente TOP se mantiene: bloquea cartera frente a los aliados.
- Tipos de cliente: PYME, dedicado corporativo, dedicado ISP y combinados. Contratos distintos, mismos documentos. "Evento" no aparece en el filtro.
- Desde Comisiones se gestiona sin abrir todo el expediente: subir y escribir ahí mismo.

## Documentos en Drive
- Todo documento vive en Drive (cuenta de ventas), nada en el almacenamiento de Supabase. No dos lugares.
- La carpeta del cliente ("RIF - NOMBRE") se crea sola al subir el primer documento.
- Los documentos de la app vieja aparecen en la app como si se hubieran subido en ella, y conservan el estatus legal que ya tenía el cliente.
- Un documento subido no se borra: se reemplaza. Pueden reemplazar el líder, el administrador y quien revisa. El archivo viejo queda en Drive como respaldo (09/10).
- La fila "Carpeta en Drive" del expediente es solo para el administrador, como soporte (09/10).
- Revisión de una sola vez (09/10, por construir): se revisa el expediente completo, cada documento queda marcado con su problema y detalle, y solo al cerrar la revisión cambia el estatus y se avisa al líder una vez con la lista. No se le avisa por cada documento.
- Estatus legal y revisión de la IA son dos marcas distintas. La IA entra "sin revisar", lee el expediente completo, solo propone, y se compara contra lo que Legal ya decidió. Se ejecuta cuando el administrador lo decida.

## Revisión de documentos con IA (definiéndose desde el 09/10)
- Proveedor: Gemini. Mientras tanto se usa la clave de la cuenta personal del administrador; cuando active la de la cuenta de ventas (pago previsto para el 03/11) se cambia el secreto en Supabase, sin tocar código. La clave nunca va en el repo.
- Se lanza por lote, porque es un acumulado. La lanzan el administrador y el abogado.
- Las reglas salen de la app vieja (App-Airtek-Empresas) y del script de Apps Script que el administrador va a pasar. No funcionaban al 100 %: hay que adaptarlas a esta app y mejorarlas.
- Lo que revisaba la app vieja: por representante, cédula y RIF vigentes, nombre igual en los dos, que esté en la junta directiva vigente (si no está pero otro sí firma, no bloquea) y documentos duplicados; RIF de la empresa vigente y con el mismo nombre del sistema; acta constitutiva (fecha de inscripción, empresa vigente, régimen de firma, junta vigente y hasta cuándo, domicilio igual al del RIF); actas de asamblea (cambio de nombre, de domicilio, de directores o presidente, ratificación de junta, prórroga, aumento de capital); faltantes críticos y no críticos, incluidos Conatel, correo y teléfono.
- Veredicto de la app vieja: aprobado, con observaciones o no apto. Desde ahí Legal aprobaba o mandaba los faltantes al líder.
- La cuenta personal de Gemini ya es de pago.
- 09/10: la cuenta de ventas ya tiene la API de Gemini en plan pago (Nivel 1, prepago). Se usa esa desde el inicio, con una clave propia para esta app; la personal ya no hace falta. Con prepago, si se acaba el saldo la IA se detiene (sirve de tope).
- Referencia de cómo funcionaban aliados e IA en las apps viejas: `claude/aliados-app-vieja.md`.
- Un solo motor de lectura para todo: el mismo que revisa expedientes de clientes sirve para las solicitudes de aliados. Primero se arma el motor; aliados va después.
- El administrador elige qué clientes se corren; nunca se corre toda la base de una vez. Volumen: unos 80 clientes nuevos al mes, más los viejos que falta recopilar.
- Proveedor por decidir con una prueba: Gemini contra Claude sobre los mismos clientes que Legal ya decidió.
- Decidido 09/10 (segunda tanda): el domicilio distinto al del RIF bloquea (hace falta acta de asamblea de cambio de domicilio). El veredicto final lo aprueba el administrador. Se revisa el expediente completo en conjunto y sale un solo veredicto; cuenta que haya correo y teléfono del representante y que el representante y su cédula estén en el acta constitutiva o en la de asamblea.
- Decidido 09/10 (cuarta tanda): la revisión manual sigue existiendo (el administrador puede revisar sin IA y cerrar igual). Solo el administrador lanza la IA (antes también el abogado). En el módulo Revisión, la abogada ve su bandeja: clientes con documentos recibidos (revisados con IA o a mano) para hacer el contrato; cuando el contrato pasa a "Pendiente por firmar" aparece en la bandeja del administrador y en la de ella.
- Programado el 09/10 (v24, decisión de Claude Code, falta confirmar): lo que falta en las actas (junta vencida, empresa vencida, domicilio, razón social) se pide devolviendo el acta constitutiva con la nota de qué acta de asamblea falta; el correo de la empresa que falta cuenta como bloqueo, igual que en el estatus.
- Reglas de revisión decididas el 09/10 (detalle en `claude/ia-reglas.md`): cédula vencida y junta vencida bloquean, con excepción del administrador; domicilio parecido al del RIF en 65 % o se pide acta de cambio de domicilio; duración de la empresa: si no aparece, 30 años desde la inscripción, y si está vencida y hay asambleas, se renueva 10 años desde la última (criterio de la oficina); la cláusula de permanencia vale hasta 10 años desde la inscripción del acta que designó la junta; el poder notariado es excepción del administrador.

## Aliados
- "Aliado Comercial" es el nombre de la cartera: instalaciones de canales más las de los aliados. Hay que mostrar quién instaló cada una.
- Los aliados no suben a Odoo: piden permiso, se revisan sus documentos y de ahí sigue todo. Un aliado puede instalar lo que otro registró.
- Los registros viejos de aliados que no se instalaron se guardan en el módulo de aliados como consultas viejas, con el indicador de cuáles se lograron instalar. Los dudosos entran como "pendiente por instalación". También se migran sus correos y teléfonos.
- Si un cliente ya está en gestión de un líder, el aliado queda bloqueado.

### Decidido 09/10 (módulo de aliados, maqueta A1 por aprobar)
- Pedir un cliente = subir los documentos. No se escribe el RIF: se lee primero el RIF de la empresa (o cédula y RIF si es natural) y el resultado de cartera sale al momento, mientras se leen los demás. Si sale bloqueado, los documentos quedan guardados y no se sigue leyendo (no se gasta IA).
- Bloqueos al leer el RIF: TOP, cliente en cartera de un líder (también los de Grandes negocios) -> "Cliente en cartera" con botón Referir (el referido le llega al administrador; si es TOP se avisa además al líder dueño). Orden de Odoo abierta u otro aliado con solicitud sin instalar -> "En gestión por otro", sin referir.
- Documentos: empresa, los mismos que los líderes; natural, cédula, RIF, teléfono y correo. Correo y teléfono del representante y correo de la empresa son obligatorios.
- Reglas: las mismas de contratos (mismo motor). Firma conjunta exige los documentos del otro representante; si quien sube no está en la junta, los de quien firma. Lo que falte en actas (junta, empresa vencida, domicilio, nombre) bloquea: busca el acta de asamblea o pide excepción.
- La IA corre sola cuando el aliado envía. Debe ser más rápida sin perder nada (leer varios archivos a la vez, el RIF primero, leer mientras sube); en contratos también, pero ahí la sigue lanzando el administrador.
- Etiquetas: Analizando, Recaudos incompletos, Excepción solicitada, Lista para instalar, Lista con observaciones, Instalación en curso, Instalada, Sin instalar, No procede, Cliente en cartera, En gestión por otro, Referido, Referido aceptado, Referido instalado, Referido pagado.
- Cada documento dice qué le pasa, con "Subir de nuevo". Botones del aliado: Pedir excepción (la decide solo el administrador), Escribir al administrador (WhatsApp), Referir, Marcar instalación en curso (con fecha), y al llegar la fecha "¿Se instaló?" (Sí, ya instalé / No se instaló con motivo).
- "No procede" solo en casos puntuales: documentos de otro cliente, excepción negada sin arreglo o decisión del administrador. Si faltan documentos nunca es No procede.
- Sin instalar: a los 30 días sin instalación vence, con el motivo visible para el aliado.
- Instalada: cuando llega la orden de instalación con el nombre del aliado. Hace falta una tabla que une el nombre del instalador en la ODI con el usuario aliado (el administrador trae la lista).
- Solo el administrador ve las solicitudes de todos los aliados. Sin apelación de los líderes: todo el equipo ve una lista "Instalados por aliados", solo para ver.
- CAMBIA el 13/10 (Lote 1): el administrador ve, aprueba y decide todo. El resto del equipo (líderes, analistas, Legal) ve el registro completo SOLO para ver, sin ningún botón de acción; la restricción está en el servidor (`aliados_registro` y `solicitud_estado` solo leen; toda acción sigue exigiendo administrador o al aliado dueño). El aliado sigue viendo solo lo suyo.
- Decidido 13/10: al entrar, pestaña "Registro" con todo agrupado por aliado (grupos ordenados por el registro más reciente; cabecera con abiertas, instaladas, referidos y pagos pendientes; marca "Nuevo" si hay algo no visto desde la última entrada, que se quita al abrir el grupo). Dentro, una sola lista por fecha con solicitudes, referidos, instalaciones y lo histórico (consultas viejas e instalado sin permiso), cada cosa con su etiqueta. Arriba, chips de etiqueta como filtro y buscador por cliente, RIF o aliado. "Para ti" pasa a un aviso con contador ("N esperan tu decisión") que filtra el registro. Cualquier registro abre su hoja (documentos, IA, hilo, fechas y bitácora en las solicitudes). Marca "Tu cliente" cuando el aliado pide, refiere o instala un cliente de la cartera de ese líder o con una orden de Odoo suya, con filtro "Lo mío"; `privado.eventos_tu_cliente()` deja listo el aviso para la tarea de notificaciones. Pagos, Instalados y Aliados y usuarios quedan igual. Decisión de Claude Code (falta confirmar): "Nuevo" se recuerda en cada dispositivo, no en el servidor.
- Buzón "Instalado sin permiso": instalación de aliado sin solicitud aprobada. Lo viejo (ODI contra AppSheet) se cruza en el chat del proyecto y cae al mismo buzón.
- Coordinadora de canales (rol analista con marca canales): hace solicitudes como un aliado (ve solo las suyas), carga referidos (RIF, nombre, apellido, teléfono, coordenadas; se ajusta después) y con el administrador paga: instalaciones PYME de aliados (solo si instaló el mismo aliado de la solicitud; con Excel) y referidos (dos residenciales, solo cuando el referido está instalado, 72 horas de plazo; sin Excel). Va aparte del corte de los líderes.
- Referir: desde el resultado "Cliente en cartera" (sin escribir) o desde el inicio escribiendo el RIF. Vale el primero que lo refirió.
- Correos con hilo (aprobación incluida) y notificaciones al teléfono: PENDIENTE SUPER URGENTE, en la tarea de notificaciones, antes de abrir la app a los aliados.
- Factibilidad para aliados: sí la usarán, pero después.
- Programado el 09/10 (v26, decisiones de Claude Code, falta confirmar): Orden de Odoo abierta bloquea solo si tiene menos de 60 días; un cliente con servicio activo cuenta como cartera; borrador sin enviar vence a los 7 días y recaudos sin completar a los 30; lo aprobado sin instalar vence a los 30. Un cliente bloqueado no guarda los documentos del aliado (solo el RIF leído). Los pagos de instalaciones se mueven a mano (Marcar pagado), sin montos.

## Proforma y carta de bienvenida
- Formato original de la app vieja, sin rediseñar. Instalación 60 dólares, día límite 10, descripción "servicio de internet", número de contrato = código.
- Las hace el analista; al líder le salen como pendiente y puede enviarlas. Solo para clientes nuevos.
- La carta sale cuando la instalación tiene dueño; si es de aliado, sin datos de líder. WhatsApp y correo del líder salen de Usuarios.
- Envío: en teléfono se copia el número y se abre Compartir con el PDF; en web se descarga y se abre el chat. Correo formal con las dos.

## Factibilidad
- El líder no debe abrir Google Maps: pega el enlace o comparte desde WhatsApp. Nombre, teléfono y RIF son opcionales.
- Zona exclusiva de aliado: se puede instalar, solo se avisa. Planta Externa: aviso para el aliado de que ahí no puede instalar.
- Cada consulta se vuelve a revisar sola cuando se sube un mapa nuevo y avisa si cambió. El mapa se sube por la pantalla Actualizar.
- Vista amplia de los MDT cercanos, como en la app vieja.
- Confirmado el 09/10: el tipo de cliente viene marcado en PYME; lo compartido desde WhatsApp espera un toque en Consultar; con un mapa nuevo solo se revisan las consultas abiertas.
- El mensaje para el cliente sale con el formato "Notificación de cobertura" (resultado y siguiente paso en negrita) y lo firma el líder.
- Texto de Odoo en Factibilidad: Hay red, instalación PROMO PYME (por defecto) o EVENTO; Posible excepción, "FACTIBILIDAD NOMBRE RIF"; Dedicado no lleva texto hasta el módulo de dedicados.

## Generales
- Ingreso con PIN; se recuerda equipo y usuario. Roles: admin, abogado, líder, aliado, analista (el Analista Senior es analista con marca `senior`).
- Notificaciones por módulo, por correo, teléfono y página instalada. No hay "bandeja": el aviso lleva directo al módulo.
- Las cuentas las crea el administrador desde Usuarios.
- Pendiente para después: dedicados, migraciones (residencial a PYME, se cobran y exigen documentos), cambios de titularidad, clientes viejos, mensajes al cliente por caso, correo desde el servidor.

- 20/10/2026 (chat del proyecto): el límite del corte de octubre se movió del 18 al 21 (`privado.corte_reglas`, fila 2026-10-01: dia_limite 21, dia_certifica 21) porque el administrador trabajó pagos y Legal el 19 y 20. Noviembre en adelante sigue 18/18/19 (fila nueva 2026-11-01). Octubre pasó de 11 a 26 que cumplen; septiembre 59/49 igual. Siguiente: corte con cierre manual (administrador o Analista Senior) y mover instalación de corte con motivo (lote urgente comisiones).
- 20/10/2026 (lote urgente, aprobado): desde el corte de octubre 2026 el corte se cierra a mano (administrador o Analista Senior, botón "Cerrar corte" en Comisiones). Lo que se cumpla antes del cierre cuenta; al cerrar, lo que no cumple pasa al siguiente y si tampoco cumple ahí se pierde. El día límite de `privado.corte_reglas` queda como aviso. Un corte cerrado no se mueve.
- 20/10/2026 (lote urgente, aprobado): con contrato presencial no se piden el correo del representante, el correo de la empresa ni el teléfono; sí los documentos legales. Un representante agregado solo se pide si tiene algún dato o archivo (sin Legal aprobado); vacío se puede quitar.
