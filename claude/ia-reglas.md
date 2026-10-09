# Reglas de la revisión con IA: propuesta (09/10/2026)

Salen de los scripts viejos (contratos y aliados), que se armaron a prueba y error. Aquí cada regla dice de dónde viene, qué opino y si falta que la confirme el administrador o la abogada. Nada de esto está programado todavía.

## Cómo trabaja el motor (propuesta)
- La IA solo lee: devuelve los datos de cada documento y la página donde los vio. No escribe faltantes ni veredicto.
- Cada archivo se lee una sola vez y lo leído se guarda. Las reglas se vuelven a calcular sin costo cuando cambia algo. Solo se paga la lectura de archivos nuevos.
- El administrador elige qué clientes se corren. La abogada también puede lanzar la revisión.
- Ante cualquier dato dudoso o ilegible: "revisar a mano". Nunca se aprueba ni se rechaza por suposición.
- Resultado por cliente: Apto, Con observaciones o No apto, más la lista de lo que falta y por qué. Es una marca aparte del estatus legal; Legal decide.
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
8. **Domicilio.** La dirección vigente (la del acta, o la de la última asamblea de cambio de domicilio) debe parecerse a la del RIF en un 65 % o más. Si no se parece, falta un acta de asamblea de cambio de domicilio. Se mantiene la excepción del acta con cláusula de sucursales. Si el acta solo trae la ciudad, se mira en las otras páginas antes de concluir. DECIDIDO 09/10.
9. **Fechas de las asambleas:** cuenta la de inscripción en el Registro, no la de la reunión. Las reformas tienen efecto ante terceros desde que se inscriben. SEGUIR.
10. **Duración de la empresa.** La IA busca en todo el acta, no solo en la cláusula: muchas veces está en otra página o dice que no vence. Si dice que no vence, no vence. Si no aparece en ningún lado, 30 años desde la inscripción. Si la empresa está vencida y hay actas de asamblea, se renueva 10 años desde la inscripción de la última (criterio de la oficina, no norma). DECIDIDO 09/10.
11. **Conatel** solo para dedicado ISP. SEGUIR.

### Junta y firmantes
12. **Junta vigente.** Fecha de la última ratificación o designación inscrita (o del acta constitutiva) más los años que diga el acta (10 si no dice). DECIDIDO 09/10.
13. **Cláusula de "permanecen hasta ser sustituidos".** Si el período de la junta ya venció pero el acta trae esa cláusula, la junta sigue valiendo mientras no hayan pasado 10 años desde la inscripción del acta que la designó. Pasados 10 años, hace falta un acta de asamblea de ratificación o cambio de junta. Sin corte por año. DECIDIDO 09/10.
14. **Junta vencida:** bloquea. El administrador puede conceder la excepción. DECIDIDO 09/10.
15. **El firmante debe estar en la junta vigente** (comparación de nombres en código). Si no está, bloquea y el administrador decide. El caso del poder notariado (alguien fuera de la junta autorizado a firmar) es raro: se sube en "Otros" y lo concede el administrador como excepción. Sin casilla nueva. DECIDIDO 09/10.
16. **Régimen de firma.** "Conjunta y/o separada" cuenta como separada (vale la opción menos estricta). Solo cuenta cómo firman los directores, no los poderes a terceros. Si una asamblea cambió la cláusula, vale la más reciente. SEGUIR.
17. **Firma separada:** basta un representante completo (cédula, RIF y en la junta). **Conjunta:** todos los que exige la cláusula. SEGUIR.
18. **Contacto** (teléfono y correo) del firmante que cuenta. Lo revisa la app, no la IA. SEGUIR.

### Otros
19. **Documento duplicado** (la misma cédula en dos representantes): aviso. SEGUIR.
20. **Persona natural:** solo cédula y RIF personal, más contacto. SEGUIR.
21. **Varios documentos en un solo PDF.** Al subir, la persona marca todo lo que trae el archivo (un archivo puede llenar varias casillas, por ejemplo cédula y RIF). La IA lo lee una vez, devuelve cada documento con su página y avisa si encontró algo que no se marcó. No se pide separar archivos. Toca la pantalla de subida (`ficha.js`): se hace después de que termine la sesión de Drive. PROPUESTA, falta el OK.

## Excepciones
Las concede solo el administrador, con motivo, y quedan en la bitácora: cédula vencida, junta vencida y firmante fuera de la junta (poder).

## Casos de prueba (hipotéticos, resultado esperado)
1. Empresa de 2008, junta de 5 años, sin asambleas, con cláusula de permanencia: hoy han pasado más de 10 años, así que es No apto (falta acta de ratificación), con excepción posible.
2. Empresa de 2020, junta de 5 años vencida en 2025, con cláusula: menos de 10 años, junta vale.
3. Igual al 2 pero sin cláusula: No apto por junta vencida.
4. Acta sin duración en ninguna página, inscrita en 1990, sin asambleas: 30 años, vence en 2020. No apto, falta acta de prórroga.
5. Igual al 4 con una asamblea inscrita en 2019: renovada hasta 2029, vigente.
6. "Conjunta y/o separada", un representante completo y en la junta: Apto aunque falte el segundo.
7. Firma conjunta con dos directores y solo uno subido: No apto, falta el segundo.
8. Cédula con vencimiento 2031 y expedición 2016: el cruce da 2026, no cuadra. Revisión a mano, no se aprueba.
9. RIF con dirección completa y acta de 2015 con otra dirección, sin cláusula de sucursales: falta acta de cambio de domicilio.
10. Firmante que no está en la junta pero trae poder en "Otros": No apto hasta que el administrador conceda la excepción.

## Antes de programar
1. OK del administrador a la regla 21 y a los casos de prueba.
2. Prueba con 20 clientes que Legal ya decidió, con Gemini y con Claude: gana la que más acierte. Se mide documento por documento.
3. Maqueta de la pantalla (resultado por cliente, lista para elegir qué correr, comparación con Legal) y aprobación.
