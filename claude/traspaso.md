# Traspaso (se actualiza al cerrar cada sesión)

Actualizado: 09/10/2026. Publicado: `?v=12`, commit f5aa154 más este commit de documentos.

## Estado
- Publicado y con pruebas (test01 a test08 en TODO OK): acceso con PIN, Usuarios, Inicio, Clientes, expediente como hoja (`assets/js/ficha.js`), Comisiones (`comisiones.js`), Actualizar con cruce (`actualizar.js`), proforma y carta en PDF (`documentos.js`, `marca.js`), bienvenidas por enviar (`bienvenidas.js`), ZIP y Excel sin librerías (`archivos.js`).
- Base: lotes 1 a 12 aplicados. Corte de referencia para probar comisiones: septiembre 2026 = 59 filas y 49 cumplen; octubre = 48 filas. Si un cambio mueve esos números sin razón, está mal.
- Documentos: los de la app vieja ya están registrados en `archivos` (con `drive_id` y `url_externa`), `documentos` y `documento_archivos`. Son unos 2.000 archivos de unos 390 clientes. Los de clientes ya aprobados por Legal entraron aprobados; el resto por revisar. `ficha.js` (cerca de la línea 707) abre `url_externa` tal cual, así que hoy el archivo abre en Drive y solo le sirve a quien tenga sesión en la cuenta de ventas.
- Drive: los tres secretos de Google están en Supabase (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`; hacer `.trim()` a los tres). El permiso está en modo Prueba y vence cada 7 días hasta que se publique la app de OAuth, que exige página principal y política de privacidad.
- No verificado: nada de la última corrida se ha probado con usuarios reales; el arreglo del pago quitado a mano no se probó con una carga real del TAD; `actualizar.js` solo tuvo revisión por encima.

## Siguientes tareas para Claude Code, en orden
Antes de cada una: explicar en simple y esperar el OK.

1. **Abrir archivos de Drive desde la app.** Función de borde que, con el permiso del usuario en la app (mismas reglas de `cliente_ficha`), entrega el archivo de Drive por su `drive_id`. `ficha.js` deja de abrir `url_externa` directo y usa esa función. Listo cuando un usuario sin sesión de Google abre un documento viejo en web y en teléfono, con prueba.
2. **Página de privacidad** pública en la app, para publicar el permiso de Google. Listo cuando existe y el administrador pudo pasar la app de OAuth a producción.
3. **Botón "Enviar pendientes" al líder** (solo admin) en el grupo de cada líder en Comisiones: mensaje de seguimiento por WhatsApp, sin enlaces. Texto aprobado:
   "Buenas tardes, [Líder]. Te paso tus pendientes del corte de [mes]. Cierra el 20 y faltan [n] días. / ÚLTIMO CORTE (si no cumplen el 20, se pierde la comisión) / 1. [Cliente] ([código]): falta [documentos]. Debe la instalación. / DE ESTE CORTE / 3. [Cliente] ([código]): falta [documentos]. / 5. [Cliente] ([código]): pendiente por asignar, todavía no comisiona. / Ya cumplen: [x] de [y]. / Cualquier documento me lo envías por aquí o lo subes en la app. Gracias."
   Sin confirmar: con más de 12 clientes, resumen corto más un PDF con la lista. Listo cuando abre WhatsApp con el texto correcto, queda anotado quién lo envió y cuándo, y hay prueba.
4. **Subidas nuevas directo a Drive** (después de que el administrador pruebe con el Analista Senior). Carpeta "RIF - NOMBRE" creada sola, subcarpeta por tipo de servicio como ya existe. La app deja de usar el bucket `expedientes`. Es el cambio con más riesgo: toca `guardarItems` en `ficha.js` y `documentos_registrar`. test04, test05, test07 y test08 deben seguir pasando.
5. **Revisión de documentos con IA.** Falta la columna para la marca de la IA (separada del estatus legal). La IA corre en una función de borde que lee de Drive; nunca pasan documentos reales por este repo. Las reglas del script viejo (vigencia, nombres, cartera, cotejo con el acta) pasan al servidor como reglas deterministas. Necesita la clave de la API de IA como secreto en Supabase. Sin propuesta todavía.
6. **Módulo de aliados**: consultas viejas con el indicador de instaladas, y sus documentos. Los datos se están cruzando fuera del repo.
7. **Factibilidad**: solo hay diagnóstico y una maqueta aprobada a medias. No empezar hasta que el administrador responda sus dudas (entre ellas, si se sigue pidiendo PYME o Dedicado al consultar) y pase el mapa vigente.

## Pendientes que NO son de este repo (se hacen en el chat del proyecto)
- Migrar los documentos de los aliados y sus contactos.
- Decidir si se recalcula el estatus de los clientes cuyos documentos entraron por revisar.
- Carpetas de Drive con archivos cuyo RIF no existe como cliente.
- Cambiar el secreto de Google (previsto para el martes 13/10).
- Seguridad: migración "endurecer_acceso_y_permisos" (entrada por función de borde con bloqueo, permisos de escritura, sesiones). Con el administrador presente.

## Decisiones tomadas por Claude que el administrador NO ha confirmado
- Una orden de Odoo se puede repetir dentro del mismo cliente.
- Se permite certificar un corte con pendientes por asignar, con aviso.
- Los nombres salen con ", C.A." en los documentos.
- Las bienvenidas pendientes cuentan solo el corte en curso.

## Problemas ya resueltos (no repetir)
- Sin acceso de red desde la terminal a Supabase: todo por el conector.
- `pg_net` y `http` no están instalados: no se llama a funciones de borde desde SQL.
- No se puede cambiar el check de `perfiles.rol`: el Analista Senior es `rol = 'analista'` con `senior = true`.
- PDF sin librerías: Helvetica estándar, anchos de letra en una tabla dentro de `documentos.js`, texto en hexadecimal; el QR es una imagen de un bit idéntica a la original.
- Drive devuelve como máximo 460 elementos por página cuando se piden los padres.
- No dejar funciones de borde abiertas (`verify_jwt` apagado) después de una prueba.
