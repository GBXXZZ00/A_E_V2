# Traspaso (se actualiza al cerrar cada sesión)

Actualizado: 09/10/2026. Publicado: `?v=19` (Factibilidad simplificada según la maqueta F2).

## Estado
- Publicado y con pruebas (test01 a test14 en TODO OK): acceso con PIN, Usuarios, Inicio, Clientes, expediente como hoja (`assets/js/ficha.js`), Comisiones (`comisiones.js`), Actualizar con cruce (`actualizar.js`), proforma y carta en PDF (`documentos.js`, `marca.js`), bienvenidas por enviar (`bienvenidas.js`), ZIP y Excel sin librerías (`archivos.js`), página de privacidad (`privacidad.html`), Enviar pendientes en Comisiones y Factibilidad (`factibilidad.js`, `coordenadas.js`, `mapared.js`, `kmz-lector.js`).
- Base: lotes 1 a 12 aplicados. Corte de referencia para probar comisiones: septiembre 2026 = 59 filas y 49 cumplen; octubre = 48 filas. Si un cambio mueve esos números sin razón, está mal.
- Documentos: los de la app vieja ya están registrados en `archivos` (con `drive_id` y `url_externa`), `documentos` y `documento_archivos`. Son unos 2.000 archivos de unos 390 clientes. Los de clientes ya aprobados por Legal entraron aprobados; el resto por revisar. Desde v13 se ven dentro de la app: `ficha.js` (`bajarDeDrive`) pide el archivo a la función de borde `drive_archivo` (copia en `supabase/funciones/drive_archivo/`), que revisa el permiso con `public.archivo_drive` (mismas reglas de `cliente_ficha`) y entrega el archivo desde Drive. El enlace de Drive ya no se abre. Word y ZIP se ofrecen para descargar.
- Drive: los tres secretos de Google están en Supabase (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`; hacer `.trim()` a los tres). El permiso está en modo Prueba y vence cada 7 días hasta que se publique la app de OAuth, que exige página principal y política de privacidad.
- No verificado: nada de la última corrida se ha probado con usuarios reales; el arreglo del pago quitado a mano no se probó con una carga real del TAD; `actualizar.js` solo tuvo revisión por encima.

## Hecho en la corrida del 09/10 (falta que el administrador lo pruebe con datos reales)
1. **Archivos de Drive desde la app** (v13): función `drive_archivo` + `public.archivo_drive`. Probar abriendo un documento viejo en web y teléfono.
2. **Privacidad** (v14): `privacidad.html`, pública y enlazada en la entrada. Dirección para Google: `https://gbxxzz00.github.io/A_E_V2/privacidad.html` (página principal: `https://gbxxzz00.github.io/A_E_V2/`). Falta que el administrador la ponga en la pantalla de consentimiento de OAuth y pase la app a producción.
3. **Enviar pendientes** (v15): botón en el grupo de cada líder en Comisiones (solo admin, corte en curso). Funciones `pendientes_lider` y `pendientes_enviados` (bitácora `pendientes_enviados`). Con más de 12 clientes: resumen y PDF de varias páginas (`Documentos.pendientes`). Hoy ningún líder tiene usuario con WhatsApp: se abre WhatsApp sin número y se elige el chat.
4. **Factibilidad** (v16 a v18), pasos 1 a 5 de `claude/factibilidad.md`:
   - Base: `mapas_red`, `zonas_red`, `consultas_fact`, `consultas_fact_hist` (RLS). Motor `privado.fact_evaluar` con `privado.fact_medir` (distancia al borde, sin PostGIS). Batería en `supabase/pruebas/factibilidad_bateria.sql`: 12 de 12 puntos correctos en la base real.
   - Mapa: panel "Mapa de red" en Actualizar (solo admin). El KMZ se lee en `kmz-lector.js` (fuera de la pantalla) y sube por lotes con `mapa_iniciar`, `mapa_zonas`, `mapa_cerrar`. El cierre compara con el mapa anterior y revisa solas las consultas abiertas (marca NUEVO).
   - Pantalla: `factibilidad.html` con lista, atajos, hoja de consulta, resultado con Leaflet (OpenStreetMap y Esri satélite), mapa amplio, datos del cliente, texto de Odoo plegado, Ya lo vendí y Ya no interesa.
   - WhatsApp: `share_target` en `manifest.json` (Android instalada), retoma lo compartido después del PIN, ayuda de una sola vez, Pegar en iPhone. Enlaces cortos con la función `resolver_enlace` (no confirmado que Google no la bloquee: si falla, pide coordenadas).
   - **Falta probar con el KMZ real**: subirlo en Actualizar y verificar el reparto (Liberado 1.507, Exclusiva 36, Diseño 416, Construcción 1, Permiso VGT 1; 1.961 polígonos). El resumen de la carga lo muestra.

5. **Factibilidad simplificada** (v19), según `claude/maquetas/factibilidad-f2.html` aprobada:
   - Lista con cada consulta en su bandeja; en teléfono, botón ancho "Nueva consulta" encima de la barra de abajo (opción B).
   - Hoja de consulta: PYME o Dedicado arriba, un solo campo y una nota para pegar. Sin botón Pegar y sin "Usar mi ubicación".
   - Resultado nuevo: estado, frase, MDT con distancia y capacidad, mapa, "Copiar mensaje para el cliente" y "Cerrar". El historial sale solo con más de un cambio; "Ya lo vendí" y "Ya no interesa" solo en una consulta guardada, bajo "Cerrar seguimiento".
   - Mensaje para el cliente con negritas de WhatsApp ("Notificación de cobertura"), firmado por el líder.
   - Texto de Odoo dentro de "Datos del cliente", solo PYME y con nombre y RIF: Hay red, `INST. PROMO PYME|EVENTO NOMBRE RIF`; Posible excepción, `FACTIBILIDAD NOMBRE RIF`. Dedicado sin texto hasta el módulo de dedicados.

## Siguientes tareas para Claude Code, en orden
Antes de cada una: explicar en simple y esperar el OK.

1. Lo que salga de las pruebas del administrador de lo hecho el 09/10.
2. **Factibilidad paso 6**: avisos al teléfono y cierre automático a "Vendida" cuando aparezca una orden de Odoo con ese RIF.
3. **Subidas nuevas directo a Drive** (después de que el administrador pruebe con el Analista Senior). Carpeta "RIF - NOMBRE" creada sola, subcarpeta por tipo de servicio como ya existe. La app deja de usar el bucket `expedientes`. Es el cambio con más riesgo: toca `guardarItems` en `ficha.js` y `documentos_registrar`. test04, test05, test07 y test08 deben seguir pasando. Espera decisión del administrador.
4. **Revisión de documentos con IA.** Falta la columna para la marca de la IA (separada del estatus legal). La IA corre en una función de borde que lee de Drive; nunca pasan documentos reales por este repo. Necesita la clave de la API de IA como secreto en Supabase. Espera decisión del administrador.
5. **Módulo de aliados**: consultas viejas con el indicador de instaladas, y sus documentos. Fuente: `privado.aliados_appsheet`.

## Pendientes que NO son de este repo (se hacen en el chat del proyecto)
- Hecho el 09/10: los expedientes viejos de aliados ya están en la app (unos 440 archivos de 68 clientes, subidos por "Aliado: nombre", por revisar) con correo y teléfono del representante. Falta una carpeta de aliados con códigos AL- sin cliente identificado.
- En la base existe `privado.aliados_appsheet`: los 79 expedientes viejos de aliados con su situación (instalado, pendiente_por_instalacion, instalado_sin_cliente, consulta). Es la fuente de "consultas viejas" para el módulo de aliados.
- Decidir si se recalcula el estatus de los clientes cuyos documentos entraron por revisar.
- Carpetas de Drive con archivos cuyo RIF no existe como cliente.
- Cambiar el secreto de Google (previsto para el martes 13/10).
- Seguridad: migración "endurecer_acceso_y_permisos" (entrada por función de borde con bloqueo, permisos de escritura, sesiones). Con el administrador presente.

## Decisiones tomadas por Claude que el administrador NO ha confirmado
- Una orden de Odoo se puede repetir dentro del mismo cliente.
- Se permite certificar un corte con pendientes por asignar, con aviso.
- Los nombres salen con ", C.A." en los documentos.
- Las bienvenidas pendientes cuentan solo el corte en curso.

- Factibilidad: el líder ve solo sus consultas; admin y analistas todas; abogado y aliado no entran.
- Factibilidad: un polígono que no está en una carpeta de estado (Liberado, Exclusiva, Diseño, Construcción, Permiso VGT) queda fuera y el resumen lo dice; no se usa el color como respaldo.
- Factibilidad: en iPhone, la ayuda de la lista ofrece Pegar (la hoja de consulta ya no tiene ese botón, solo la nota); no se lee el portapapeles sin que la persona toque.
- Factibilidad: bajo el texto de Odoo sigue la nota del código de vendedor cuando la orden la crea otra persona.
- Enviar pendientes: el saludo cambia según la hora (Buenos días, Buenas tardes, Buenas noches); el mensaje se puede editar antes de enviarlo; "más de 12" cuenta los clientes pendientes, no todos.
- Enviar pendientes: si el documento está subido pero sin aprobar, dice "documentos en revisión con Legal"; si lo devolvieron, "corregir ... (lo devolvió Legal)".
- Privacidad: el contacto es "el administrador de la app" (sin correo, porque el repo es público).

## Problemas ya resueltos (no repetir)
- Sin acceso de red desde la terminal a Supabase: todo por el conector.
- `pg_net` y `http` no están instalados: no se llama a funciones de borde desde SQL.
- No se puede cambiar el check de `perfiles.rol`: el Analista Senior es `rol = 'analista'` con `senior = true`.
- PDF sin librerías: Helvetica estándar, anchos de letra en una tabla dentro de `documentos.js`, texto en hexadecimal; el QR es una imagen de un bit idéntica a la original.
- Drive devuelve como máximo 460 elementos por página cuando se piden los padres.
- No dejar funciones de borde abiertas (`verify_jwt` apagado) después de una prueba. `drive_prueba` quedó abierta y se apagó el 09/10 (devuelve 404 y pide sesión); `drive_inventario` también está apagada.
- Leaflet: fijar la vista antes de agregar zonas y sin animaciones; si no, falla al cerrar la hoja (`_leaflet_pos`, `_clipPoints`).
- Las pruebas sirven Leaflet desde `pruebas/vendor/leaflet` y los mosaicos con una imagen de mentira (por eso el mapa se ve rojo en las capturas).
- Chromium ignora el atributo `download` de un enlace dentro de una hoja: se descarga con un enlace suelto en la página (ver `#bajarArch` en `ficha.js`).
