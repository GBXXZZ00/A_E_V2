# Reglas de la revisión con IA (programadas el 09/10/2026, v24)

Salen de los scripts viejos (contratos y aliados), que se armaron a prueba y error. Aquí cada regla dice de dónde viene, qué opino y si falta que la confirme el administrador o la abogada. Nada de esto está programado todavía.

## Cómo trabaja el motor (propuesta)
- La IA solo lee: devuelve los datos de cada documento y la página donde los vio. No escribe faltantes ni veredicto.
- Cada archivo se lee una sola vez y lo leído se guarda. Las reglas se vuelven a calcular sin costo cuando cambia algo. Solo se paga la lectura de archivos nuevos.
- El administrador elige qué clientes se corren. La abogada también puede lanzar la revisión.
- Ante cualquier dato dudoso o ilegible: "revisar a mano". Nunca se aprueba ni se rechaza por suposición.
- Resultado por cliente: Apto, Con observaciones o No apto, más la lista de lo que falta y por qué. Es una marca aparte del estatus legal. El veredicto final lo aprueba el administrador (09/10).
- Se revisa el expediente completo en conjunto y sale un solo veredicto, no documento por documento por separado (09/10). Propuesta en espera: la IA deja un borrador de la misma revisión de Legal (cada documento con su problema y detalle) y el administrador la cierra con "Cerrar revisión".
- Mismo motor para aliados (después).

## Reglas
Estado: SEGUIR = se queda como estaba; CAMBIAR = propongo otra cosa; CONFIRMAR = decide la abogada o el administrador.

### Identidad
1. **Cédula vigente.** Vence el último día del mes impreso. Bloquea si está vencida. Viene de: los dos scripts. SEGUIR.
2. **Cruce de la cédula.** Expedición más 10 años debe dar el mismo año de vencimiento; si no, se toma como mal leída y va a revisión a mano. La cédula venezolana dura 10 años. Viene de: aliados. SEGUIR y aplicarlo a todos.
3. **RIF personal vigente** según la fecha impresa. Bloquea. SEGUIR.
4. **Nombre de la cédula igual al del RIF.** Lo compara el código por palabras (60 %). El umbral es práctico, no es norma. SEGUIR y medirlo en la prueba.
5. **Cédula vencida.** Bloquea, pero el administrador puede conceder la excepción (por ejemplo, en trámite). El RIF vencido no la admite. DECIDIDO 09/10.

### Empresa
6. **RIF de la empresa vigente.** Bloquea. SEGUIR.
7. **Razón social del acta igual a la del RIF** (o una asamblea que cambió el nombre). Bloquea. SEGUIR.
8. **Domicilio.** La dirección vigente (la del acta, o la de la última asamblea de cambio de domicilio) debe parecerse a la del RIF en un 65 % o más. Si no se parece, falta un acta de asamblea de cambio de domicilio. Se mantiene la excepción del acta con cláusula de sucursales. Si el acta solo trae la ciudad, se mira en las otras páginas antes de concluir. Bloquea: hace falta el acta de asamblea de cambio de domicilio. DECIDIDO 09/10.
9. **Fechas de las asambleas:** cuenta la de inscripción en el Registro, no la de la reunión. Las reformas tienen efecto ante terceros desde que se inscriben. SEGUIR.
10. **Duración de la empresa.** La IA busca en todo el acta, no solo en la cláusula: muchas veces está en otra página o dice que no vence. Si dice que no vence, no vence. Si no aparece en ningún lado, 30 años desde la inscripción. Si la empresa está vencida y hay actas de asamblea, se renueva 10 años desde la inscripción de la última (criterio de la oficina, no norma). DECIDIDO 09/10.
11. **Conatel** solo para dedicado ISP. SEGUIR.

### Junta y firmantes
12. **Junta vigente.** Fecha de la última ratificación o designación inscrita (o del acta constitutiva) más los años que diga el acta (10 si no dice). DECIDIDO 09/10.
13. **Cláusula de "permanecen hasta ser sustituidos".** Si el período de la junta ya venció pero el acta trae esa cláusula, la junta sigue valiendo mientras no hayan pasado 10 años desde la inscripción del acta que la designó. Pasados 10 años, hace falta un acta de asamblea de ratificación o cambio de junta. Sin corte por año. DECIDIDO 09/10.
14. **Junta vencida:** bloquea. El administrador puede conceder la excepción. DECIDIDO 09/10.
15. **El firmante debe estar en la junta vigente**, en el acta constitutiva o en la de asamblea que lo designó: nombre y número de cédula (comparación en código; el número manda si el acta lo trae). Si no está, bloquea y el administrador decide. El caso del poder notariado (alguien fuera de la junta autorizado a firmar) es raro: se sube en "Otros" y lo concede el administrador como excepción. Sin casilla nueva. DECIDIDO 09/10.
16. **Régimen de firma.** "Conjunta y/o separada" cuenta como separada (vale la opción menos estricta). Solo cuenta cómo firman los directores, no los poderes a terceros. Si una asamblea cambió la cláusula, vale la más reciente. SEGUIR.
17. **Firma separada:** basta un representante completo (cédula, RIF y en la junta). **Conjunta:** todos los que exige la cláusula. SEGUIR.
18. **Contacto** (teléfono y correo) del firmante que cuenta. Lo revisa la app, no la IA. SEGUIR.

### Otros
19. **Documento duplicado** (la misma cédula en dos representantes): aviso. SEGUIR.
20. **Persona natural:** solo cédula y RIF personal, más contacto. SEGUIR.
21. **Varios documentos en un solo PDF.** La pantalla de subida YA deja marcar un archivo en varias casillas (por ejemplo cédula y RIF): no hay que tocar `ficha.js`. Lo nuevo es solo de la IA: lee el archivo una vez, devuelve cada documento con su página y, si encuentra uno que no se marcó, lo avisa en el resultado ("en el archivo de la cédula también hay un RIF personal, página 2"). No lo marca sola: el aviso dice qué hacer. No se pide separar archivos. PROPUESTA AJUSTADA 09/10, falta el OK.

## Excepciones
Las concede solo el administrador, con motivo, y quedan en la bitácora: cédula vencida, junta vencida y firmante fuera de la junta (poder).

## Casos de prueba (hipotéticos, resultado esperado)
Fecha de referencia: hoy. Las fechas de actas son siempre las de inscripción en el Registro (regla 9). Cada caso dice todo lo que debe salir, no solo lo principal.
1. Empresa inscrita en 2008, junta de 5 años, sin asambleas, con cláusula de permanencia: pasaron más de 10 años desde 2008, así que No apto: falta acta de ratificación de junta (excepción posible). La duración de la empresa no se discute si el acta la trae.
2. Empresa de 2020, junta de 5 años vencida en 2025, con cláusula: menos de 10 años, la junta vale hasta 2030. Apto en ese punto.
3. Igual al 2 pero sin cláusula: No apto por junta vencida (excepción posible del administrador).
4. Acta sin duración en ninguna página, inscrita en 1990, sin asambleas: 30 años, vence en 2020. No apto por dos cosas: falta acta de prórroga y la junta está vencida desde el 2000.
5. Igual al 4 con una asamblea inscrita en 2019 que ratifica la junta: duración renovada hasta 2029 y junta vigente hasta 2029. Apto en esos puntos. Si esa asamblea fuera solo de aumento de capital, la duración igual se renueva (regla 10) pero la junta sigue vencida: No apto.
6. "Conjunta y/o separada", un representante completo y en la junta: Apto aunque falte el segundo.
7. Firma conjunta con dos directores y solo uno subido: No apto, falta el segundo.
8. Cédula con vencimiento 2031 y expedición 2016: el cruce da 2026, no cuadra. Revisar a mano, no se aprueba ni se rechaza.
9. RIF con dirección completa y acta de 2015 con otra dirección (menos de 65 % parecida), sin cláusula de sucursales: No apto, falta acta de asamblea de cambio de domicilio.
10. Firmante que no está en la junta pero trae poder en "Otros": No apto hasta que el administrador conceda la excepción; con la excepción, Apto y la excepción queda en la bitácora.
11. RIF personal del firmante vencido y cédula vigente: No apto, sin excepción posible (regla 5).
12. Cédula vencida con excepción concedida por el administrador ("en trámite"): Apto, y el resultado muestra la excepción con su motivo.
13. Un PDF marcado solo como cédula que en la página 2 trae el RIF personal: la IA lee los dos, avisa "hay un RIF personal sin marcar" y el RIF no cuenta hasta que alguien marque la casilla (regla 21).
14. Persona natural con cédula y RIF vigentes y mismo nombre: Apto; no se piden actas ni junta (regla 20).

## Antes de programar
1. OK del administrador a la regla 21 y a los casos de prueba.
2. Prueba con 20 clientes que Legal ya decidió, con Gemini y con Claude: gana la que más acierte. Se mide documento por documento.
3. Maqueta de la pantalla (resultado por cliente, lista para elegir qué correr, comparación con Legal) y aprobación.

## Encaje con la revisión de una sola vez (v22, 09/10)
- La IA lee solo los archivos vigentes (`documento_archivos.vigente = true`). Un reemplazo es un archivo nuevo: se lee aparte y lo leído del anterior queda guardado.
- Motivos: la misma lista de Legal (`vencido`, `ilegible`, `no_corresponde`, `falta_firma`, `otro`).
- La marca de la IA nunca cambia `documentos.estado` ni avisa al líder. La persona la confirma o corrige y "Cerrar revisión" hace el cambio una sola vez.
- Modelo: el más avanzado de Gemini (Pro). El nombre del modelo queda como ajuste, no en el código: se cambia sin programar.
- Prueba: con documentos reales de clientes que Legal ya decidió (decidido 09/10: se ajusta con lo que salga). Los 14 casos quedan solo como pruebas automáticas de las reglas, sin IA y sin costo.

## Diseño de datos (PROPUESTA, falta el OK; aún no aplicado)
1. `ia_lecturas`: una fila por archivo leído (es la memoria para no pagar dos veces). `archivo_id`, `modelo`, `version_lector`, `leido_en`, `paginas`, `tokens_entrada`, `tokens_salida`, `costo_usd`, `estado` (`ok`, `ilegible`, `error`), `error`, `hallazgos` (jsonb: cada documento que vio en el archivo con su tipo y página, incluidos los no marcados). Única por (`archivo_id`, `version_lector`).
2. `ia_corridas`: una por cliente cada vez que se manda a revisión. `cliente_id`, `lanzada_por`, `lanzada_en`, `terminada_en`, `estado` (`en_cola`, `leyendo`, `lista`, `error`, `cerrada`), `modelo`, `version_reglas`, `veredicto` (`apto`, `no_apto`, `revisar_a_mano`), `puntos` (jsonb: contacto, firmante en el acta, junta, domicilio, duración, régimen de firma, con detalle y página), `archivos_nuevos`, `archivos_releidos`, `costo_usd`.
3. `ia_marcas`: una por documento y corrida. `corrida_id`, `documento_id`, `archivo_id`, `propuesta` (`bien`, `problema`, `revisar_a_mano`), `motivo` (lista de Legal), `nota`, `pagina`, `datos` (jsonb: nombre, cédula, RIF, vencimiento, expedición, firma), `creado_en`.
4. "Cerrar revisión" guarda en su propio registro el `corrida_id` que usó (si hubo IA). Así la comparación con Legal es `ia_marcas` contra lo que quedó en `documentos` al cerrar.
- RLS: leen admin y abogado; escribe solo la función de borde (llave de servicio). Todo pasa por `bitacora`.

## Cuando el expediente cambia después de la IA (v25)
- Al terminar, la corrida guarda una huella de lo que usan las reglas. Si después cambia un dato (correo, teléfono, régimen, nombre) el resultado queda viejo.
- Si no hay archivos nuevos, la ficha del administrador lo actualiza sola: mismas lecturas, reglas otra vez, sin costo y con las excepciones que ya dio.
- Si subieron archivos, avisa y el administrador decide con "Actualizar resultado": solo se lee y se cobra lo nuevo.

## Cómo quedó programado (v24)
- Reglas: `supabase/funciones/ia_revisar/reglas.mjs` (versión 2), probadas en `pruebas/test16.js` con los 14 casos y otros. La IA solo lee; las reglas deciden.
- Lectura: función de borde `ia_revisar` (copia en `supabase/funciones/ia_revisar/`). La despierta la base con `privado.ia_despertar` (pg_net y un token interno en el Vault); lee un archivo por llamada desde Drive, se lo pasa a Gemini por su canal de archivos en alta resolución y se vuelve a llamar sola para el siguiente.
- Modelo: ajuste `modelo` en `privado.ia_ajustes` ('auto' = el Pro más nuevo; hoy gemini-3.1-pro-preview). `version_lector` (hoy 2): si cambia, se vuelve a leer todo. Precios para calcular el costo: `precio_entrada` y `precio_salida`.
- Base: `ia_lecturas` (lo leído de cada archivo, para no pagar dos veces), `ia_corridas` (cada envío de un cliente), `ia_marcas` (propuesta por documento); las propuestas pasan a `revision_marcas` con origen `ia` sin pisar lo que marcó una persona.
- Lo que falta en las actas (junta vencida, empresa vencida, domicilio, razón social) se propone devolviendo el acta constitutiva con la nota "Falta: acta de asamblea de ...": así el estatus se sigue calculando por documentos.
- Si un documento está en el archivo de otra casilla (por ejemplo cédula y RIF al revés), queda "a mano" diciendo dónde está.
- Excepciones: junta vencida y firmante fuera de la junta se conceden en el resultado (vuelve a decidir sin volver a leer); aprobar un documento que la IA devolvió pide motivo y queda en la bitácora como `documento_excepcion`.

## Prueba con 5 clientes reales (09/10/2026)
Clientes en "Documentos recibidos" (ya aprobados por Legal), 27 archivos, 2 minutos y unos US$ 0,16 por cliente.
- Coinciden con Legal 20 de 26 documentos antes de corregir las reglas; después, las diferencias que quedan son hallazgos o reglas nuevas:
  - Junta vencida en 2 clientes (designadas en 2008 y 2012, sin ratificación): la regla 13 decidida el 09/10 las bloquea; Legal las aprobó antes de esa regla.
  - RIF de la empresa vencido en 1 cliente (venció después de que Legal lo aprobara).
  - Cédula y RIF subidos en la casilla del otro en 1 cliente; en otro, la casilla de la cédula trae un RIF.
  - Falta el correo de la empresa en los 5 (requisito de la app que los clientes viejos no tienen).
  - 1 acta constitutiva de 12 páginas que la IA no pudo leer: queda a mano.
- No cambió ningún estatus. Quedaron sus propuestas marcadas (revisión en curso) para que el administrador las vea y decida.
