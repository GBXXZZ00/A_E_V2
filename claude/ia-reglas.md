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
5. **Cédula vencida en trámite.** En aliados se permitía una excepción; el RIF no la admite. CONFIRMAR si vale también para clientes.

### Empresa
6. **RIF de la empresa vigente.** Bloquea. SEGUIR.
7. **Razón social del acta igual a la del RIF** (o una asamblea que cambió el nombre). Bloquea. SEGUIR.
8. **Domicilio.** El script comparaba la dirección completa del RIF con la del acta (65 % de palabras). CAMBIAR: el acta casi siempre trae solo la ciudad y el estado, y el RIF la dirección completa, así que esa comparación falla aunque todo esté bien. Propongo comparar solo ciudad y estado, y que solo avise. CONFIRMAR si bloquea o solo avisa (contratos bloqueaba, aliados avisaba).
9. **Fechas de las asambleas:** cuenta la de inscripción en el Registro, no la de la reunión. Las reformas tienen efecto ante terceros desde que se inscriben. SEGUIR.
10. **Duración de la empresa.** Los años salen de la cláusula del acta, más las prórrogas. CAMBIAR dos cosas: (a) si no se lee la duración, el script suponía 30 años; propongo revisión a mano; (b) el script tomaba cualquier asamblea inscrita como prórroga de 10 años; no conozco norma que diga eso, una prórroga normalmente es una reforma expresa. CONFIRMAR con la abogada.
11. **Conatel** solo para dedicado ISP. SEGUIR.

### Junta y firmantes
12. **Junta vigente.** Fecha de la última ratificación inscrita (o del acta constitutiva) más los años que diga el acta. CAMBIAR: si el acta no dice los años, el script suponía 10; propongo revisión a mano.
13. **Cláusula de "permanecen hasta ser sustituidos".** El script la aceptaba solo en actas desde 2012 (contratos) o 2010 (aliados). No conozco norma que fije ese año. CONFIRMAR con la abogada si la cláusula vale sin importar el año.
14. **Junta vencida:** en contratos bloqueaba; en aliados solo avisaba. CONFIRMAR.
15. **El firmante debe estar en la junta vigente** (comparación de nombres en código). SEGUIR. FALTA en los scripts: alguien con poder notariado también puede firmar. Propongo una casilla "Poder" y aceptarlo como firmante. CONFIRMAR.
16. **Régimen de firma.** "Conjunta y/o separada" cuenta como separada (vale la opción menos estricta). Solo cuenta cómo firman los directores, no los poderes a terceros. Si una asamblea cambió la cláusula, vale la más reciente. SEGUIR.
17. **Firma separada:** basta un representante completo (cédula, RIF y en la junta). **Conjunta:** todos los que exige la cláusula. SEGUIR.
18. **Contacto** (teléfono y correo) del firmante que cuenta. Lo revisa la app, no la IA. SEGUIR.

### Otros
19. **Documento duplicado** (la misma cédula en dos representantes): aviso. SEGUIR.
20. **Persona natural:** solo cédula y RIF personal, más contacto. SEGUIR.
21. **Varios documentos en un solo PDF:** CONFIRMAR si la IA los separa o se pide que los suban separados.

## Antes de programar
1. Respuestas a los CONFIRMAR (5, 8, 10, 13, 14, 15, 21).
2. Prueba con 20 clientes que Legal ya decidió, con Gemini y con Claude: gana la que más acierte. Se mide documento por documento.
3. Maqueta de la pantalla (resultado por cliente, lista para elegir qué correr, comparación con Legal) y aprobación.
