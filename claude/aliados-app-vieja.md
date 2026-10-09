# Aliados e IA en las apps viejas (referencia, 09/10/2026)

Resumen de dos scripts que pasó el administrador: el módulo de aliados de la app vieja (Apps Script, con Gemini) y la validación que usaban los aliados en AppSheet (OCR de Google Docs con expresiones regulares). No se copian los scripts ni sus identificadores: solo las reglas. Esto es lo que había, no lo decidido; lo decidido va en `reglas-negocio.md`.

## Flujo del aliado (app vieja)
1. El aliado crea una solicitud: persona natural, jurídica o "extraordinaria" (texto libre, sin análisis automático).
2. Sube los documentos por casilla: cédula y RIF de hasta 2 representantes, RIF de la empresa, acta constitutiva (obligatoria para jurídica), hasta 4 actas de asamblea, hasta 4 documentos extra con nota. Teléfono y correo del contacto y de la empresa.
3. Pulsa analizar: la IA lee todo y el sistema decide al momento.
4. Resultado: AUTORIZADO, AUTORIZADO CON SALVEDADES, REQUIERE ACCIÓN (puede corregir o pedir excepción), NO AUTORIZADO, NO AUTORIZADO TOP.
5. Si algo falla puede volver a subir un documento (se analiza otra vez) o pedir excepción o revisión manual con una observación. El caso queda congelado hasta que el administrador aprueba o niega con respuesta escrita.
6. El aliado confirma la instalación. El administrador la "promueve a cartera" (crea el cliente con el aliado como responsable).
7. Referidos: el aliado puede pasar un cliente a la oficina en vez de instalarlo (con o sin RIF y cédula). Se marca instalado cuando el RIF aparece en la cartera.
8. Todo deja historial por solicitud y un solo hilo de correo por caso.

## Reglas que usaba (la IA extrae, el sistema decide)
- Cédula: vence el último día del mes indicado. Se cruza con la fecha de expedición más 10 años; si el año no cuadra, se toma como "no legible", nunca como vigente.
- Cédula vencida: bloquea, pero admite excepción (por ejemplo, en trámite). Fecha no legible: bloquea y pide foto más clara o revisión manual.
- RIF de persona natural vencido o no legible: bloquea y no admite excepción.
- Nombre de la cédula igual al del RIF: lo compara el sistema por palabras (60 % de coincidencia), no la IA. Si no coincide, bloquea.
- Razón social del acta igual a la del RIF de la empresa: si no, bloquea.
- Al menos un representante debe estar en la junta directiva vigente (la de la última ratificación, o la del acta constitutiva). Si ninguno está, bloquea.
- Junta vencida: aviso que no bloquea. La junta dura lo que diga el acta (10 años si no dice). Si el acta tiene cláusula de "permanecen hasta ser sustituidos" y es de 2010 en adelante (aliados) o 2012 en adelante (contratos), sigue vigente.
- Empresa con duración vencida y domicilio distinto al del RIF: avisos que no bloquean.
- Régimen de firma: se informa siempre. "Conjunta y/o separada" se toma como separada. Solo cuenta cómo firman los directores, no los poderes a terceros.
- Cartera: RIF comparado en solo dígitos. TOP bloquea y avisa por correo al líder dueño. Cliente de un líder sin marca TOP: el aliado podía instalar igual y el correo dejaba constancia del líder anterior.
- En AppSheet, en cambio, cualquier cliente con dueño se declinaba solo y se avisaba al líder como oportunidad; lo dudoso iba a revisión manual.
- Modelo: Gemini 2.5 Flash, temperatura 0,1, respuesta en JSON.

## Qué servía y qué no
- Sirve y se conserva: la IA solo extrae y el veredicto es de código; ante la duda, revisión manual; el cruce expedición más 10 años; comparar nombres en código; excepción solo para la cédula.
- No servía: el OCR con expresiones regulares de AppSheet (tomaba la fecha más alta del documento como vencimiento); la IA de la app vieja a veces devolvía datos con otra forma (directores como objetos) y fallaba a medias; todo vivía en hojas de cálculo y correos.
- En esta app: el veredicto va en el servidor; los documentos en Drive; la cartera sale de la base; los avisos van por módulo (todavía no hay correo desde el servidor).
