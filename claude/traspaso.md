# Traspaso (se actualiza al cerrar cada sesión)

Actualizado: 09/10/2026. Publicado: `?v=25` (revisión con IA que se actualiza sola cuando cambia el expediente).

## Estado
- Publicado y con pruebas (test01 a test18 en TODO OK): acceso con PIN, Usuarios, Inicio, Clientes, expediente como hoja (`assets/js/ficha.js`), Comisiones (`comisiones.js`), Actualizar con cruce (`actualizar.js`), proforma y carta en PDF (`documentos.js`, `marca.js`), bienvenidas por enviar (`bienvenidas.js`), ZIP y Excel sin librerías (`archivos.js`), página de privacidad (`privacidad.html`), Enviar pendientes en Comisiones y Factibilidad (`factibilidad.js`, `coordenadas.js`, `mapared.js`, `kmz-lector.js`).
- Base: lotes 1 a 12 aplicados. Corte de referencia para probar comisiones: septiembre 2026 = 59 filas y 49 cumplen; octubre = 48 filas. Si un cambio mueve esos números sin razón, está mal.
- Documentos nuevos (v21): van directo a Drive, nada al almacenamiento de Supabase (ver punto 6 de la corrida del 09/10).
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

6. **Subidas nuevas directo a Drive** (v21). Falta que el administrador suba un documento real en web y teléfono.
   - Función de borde `drive_subir` (copia en `supabase/funciones/drive_subir/`): revisa el permiso con `public.drive_destino` (sesión del usuario), busca la carpeta del cliente en `privado.drive_carpetas`; si no hay o ya no existe, la busca en Drive por el RIF dentro de la raíz de expedientes y, si no está, crea "RIF - NOMBRE" (bitácora `drive_carpeta_creada`). Dentro usa o crea la subcarpeta por tipo (`privado.drive_subcarpeta`: PYMES, DEDICADO CORPORATIVO, DEDICADO ISP, DEDICADO ... + PYME, PERSONA NATURAL). Sube el archivo con su nombre original y lo anota en `privado.drive_subidas`.
   - `documentos_registrar` ahora solo acepta `drive_id` anotados en `privado.drive_subidas` para ese cliente y ese usuario (nombre, tipo y tamaño salen del servidor). Rechaza `ruta`. `drive_carpeta_fijar` y `drive_subida_anotar` solo las puede llamar la función (llave de servicio).
   - La raíz es la carpeta de contratos vieja (en `privado.drive_estado`, clave `raiz_expedientes`). 1.740 clientes quedaron enlazados a su carpeta existente; si había dos con el mismo RIF, la de más archivos.
   - Almacenamiento: el bucket `expedientes` estaba vacío; una política restrictiva (`expedientes_cerrado`) ya no deja subir ahí. `ficha.js` ya no lo usa para nada.
   - Probado en la base con función temporal (deshecha): sin subida, de otro cliente, con `ruta` y llamadas de usuario a las funciones de servicio se rechazan; el registro crea el archivo con su enlace de Drive y deja bitácora; septiembre siguió en 59 y 49 antes, durante y después.
   - No probado contra Google desde aquí (la terminal no llega a Supabase). Si el permiso de Google fuera solo de lectura, la app dice "Google no dio permiso para guardar en Drive": habría que volver a autorizar con permiso de escritura.

7. **Ajustes de la prueba de Drive** (v22). El administrador subió una foto real el 09/10 y llegó a la carpeta vieja del cliente (no creó otra).
   - "Subiendo a Drive…" en la misma casilla, con barra y etiqueta "Subiendo" (y "x de y" si son varios); en la hoja de comisión el botón de la casilla dice "Subiendo…". La línea de arriba sigue.
   - Fila "Carpeta en Drive" en Documentos, solo admin (`public.drive_carpeta_info`, devuelve null a los demás): Abrir y una nota ("Carpeta de la app vieja" o "Creada por la app ... por ..." y "Última subida ..."); sin carpeta: "Se crea sola con el primer documento".
   - "Reemplazar archivo" también para quien revisa (antes solo el líder).
   - No se hace "Quitar": decidido que basta con Reemplazar.

## Hecho el 09/10 (v25): el resultado de la IA se actualiza cuando cambia el expediente
- Pedido del administrador tras probar 10 clientes (10 de 10 bien): si después de la IA llena un dato (correo, teléfono) o suben un archivo, el resultado no debe quedar viejo.
- Migración `ia_actualizar_resultado`: columna `ia_corridas.huella` (md5 de lo que usan las reglas: datos del cliente, representantes, faltantes, documentos y archivos vigentes; la guarda `ia_guardar_resultado`), `privado.ia_huella`, `privado.ia_sin_leer(cliente, desde)` (archivos que la corrida no intentó leer) y `ia_actualizar(p_corrida)` (solo admin: vuelve a pasar las reglas sobre la MISMA corrida, conserva las excepciones, solo lee y cobra lo nuevo, bitácora `ia_actualizada`). `revision_estado.ia` trae `cambio` y `sin_leer`. La función de borde no cambió.
- Pantalla: si cambió un dato y no hay archivos nuevos, la ficha la actualiza sola (gratis; una vez por resultado y máximo 3 por corrida). Si hay archivos nuevos, aviso ámbar con "Actualizar resultado" y el costo, en el bloque de la IA y en la hoja de cierre. La abogada solo ve el aviso.
- Las 6 corridas abiertas de antes (sin huella) se actualizan solas, gratis, la primera vez que el admin abra cada cliente.
- Prueba nueva: `pruebas/test18.js`.

## Hecho el 09/10 (v24): revisión con IA (falta que el administrador la pruebe)
- Todo lo de `claude/ia-reglas.md`, secciones "Cómo quedó programado" y "Prueba con 5 clientes reales".
- Base (migraciones `ia_motor`, `revision_con_ia`, `revision_bandejas`, `ia_soltar`, `ia_trabajo_fallos`): pg_net instalado; `privado.ia_ajustes`; secreto `ia_tarea` en el Vault; tablas `ia_lecturas`, `ia_corridas`, `ia_marcas` (RLS: leen admin y abogado); `revision_marcas` con `ia_corrida_id` y `pagina`. Funciones: `ia_estimar`, `ia_lanzar` (solo admin, hasta 25), `ia_reanudar`, `ia_excepcion` (junta y firmantes), `revision_bandeja` (admin y abogado), `ia_comparar` (admin); de servicio: `ia_tarea_ok`, `ia_trabajo`, `ia_guardar_lectura`, `ia_guardar_resultado`, `ia_fallo`, `ia_soltar`. Reescritas: `documento_marcar` (aprobar lo que la IA devolvió exige motivo y solo admin), `revision_estado` (trae la última revisión con IA), `revision_cerrar` (enlaza la corrida y no cierra mientras la IA lee).
- Función de borde `ia_revisar` (verify_jwt apagado: entra solo con el token interno del Vault que manda la base). Secreto `GEMINI_API_KEY` (cuenta de ventas, prepago).
- Pantalla: módulo `revision.html` + `assets/js/revision.js` (navegación e Inicio para admin y abogado); en el expediente (`ficha.js`) el bloque "Revisión con IA", las propuestas marcadas, excepciones y el motivo al aprobar contra la IA.
- La abogada ve su bandeja (Para contrato, Por firmar, Por revisar, Revisión en curso); no lanza la IA ni cierra.
- Pruebas: test16 (reglas) y test17 (pantallas). Septiembre 59 y 49 antes y después.
- Ojo: los 5 clientes de la prueba (en Documentos recibidos) quedaron con propuestas de la IA marcadas. Si el administrador no está de acuerdo, puede quitar las marcas o cerrar la revisión.

## Hecho el 09/10 (v23): revisión de una sola vez (falta que el administrador la pruebe con datos reales)
- Base (migración `revision_una_sola_vez`): tabla `revision_marcas` (una marca por documento: aprobar o devolver con motivo, nota y vencimiento; `origen` manual o ia) y tabla `revisiones` (historial: quién cerró, estatus antes y después, aprobados, devueltos, detalle, mensaje, si se envió; `ia_corrida_id` libre para la IA). RLS: solo leen admin y abogado; escriben solo las funciones.
- Funciones: `documento_marcar` (admin y abogado; no cambia estatus, no deja hilo, deja bitácora `documento_marcado`), `revision_estado` (marcas, historial y WhatsApp del líder) y `revision_cerrar` (solo admin: aplica todas las marcas, bitácora por documento y `revision_cerrada`, un solo recalcular, una sola entrada en el hilo con texto `revision`). Disparador `documentos_marca_al_subir`: si suben un archivo nuevo a la casilla, su marca se borra.
- Probado en la base con función temporal (deshecha): marcar no toca estatus ni hilo; cierre pasa a Documentos pendientes con una sola entrada; sin marcas no cierra; motivo inválido o "otro" sin nota se rechazan; sin perfil no entra; el disparador limpia. Septiembre 59 y 49 antes y después.
- Pantalla (`ficha.js`): Aprobar y Devolver solo marcan; la casilla dice "Para aprobar al cerrar" o "Para devolver: motivo"; barra "Revisión en curso" con Cerrar revisión (solo admin); Quitar marca en el visor; hoja Cerrar revisión con resumen, estatus que quedará y mensaje editable para el líder (Cerrar sin enviar o Cerrar y enviar por WhatsApp); historial "Revisiones" al final de Documentos; el hilo muestra "cerró la revisión: N aprobados y M devueltos". El líder no ve nada hasta el cierre.
- Cambio para la abogada: ya no aprueba ni devuelve directo; marca y el administrador cierra (decisión del 09/10: el veredicto final es del administrador).
- `documento_revisar` sigue existiendo para la app vieja en caché; la v23 no la usa. Hay una función `privado.prueba_tmp` que no es de esta sesión (aviso del asesor de seguridad).

## Siguientes tareas para Claude Code, en orden
Antes de cada una: explicar en simple y esperar el OK.

**Decidido 09/10 (después de v25):** el administrador probó la IA y la revisión (10 de 10 bien, "todo bien"). Lo siguiente es el **módulo de aliados (tarea 6)**: se construye aquí, empezando por la lógica en el servidor y con la pantalla encima. Los avisos al teléfono (tarea 3) se posponen hasta después de aliados.

1. **Revisión de una sola vez: HECHA en v23** (ver arriba). Falta la prueba del administrador.
   Antes: Hoy, al devolver un documento, el cliente pasa en ese momento a Documentos pendientes. Lo nuevo: quien revisa (el administrador o la IA) marca cada documento con su problema y detalle sin que el líder se entere todavía; al final, "Cerrar revisión" cambia el estatus una sola vez (Documentos pendientes o Recibidos), deja una sola entrada en el hilo y arma un solo mensaje al líder con la lista de qué corregir. La IA propone marcas; la persona las confirma en "Cerrar revisión". Toca estatus y Legal de comisiones: probar contra septiembre (59 y 49) antes y después. La IA se está armando en el chat del proyecto con este flujo en mente.
2. Lo que salga de las pruebas del administrador de lo hecho el 09/10.
3. **Factibilidad paso 6**: cierre automático a "Vendida" cuando aparezca una orden de Odoo con ese RIF. Los avisos al teléfono quedan para DESPUÉS del módulo de aliados (decidido 09/10).
4. **Estado de carga en todo lo que se congela** (pendiente): revisar pantalla por pantalla cada espera (guardar, enviar, cargar) para que siempre se vea que está trabajando, como "Subiendo a Drive".
5. **Revisión de documentos con IA: HECHA en v24** (ver arriba). Falta la prueba del administrador. Lo anterior: EN DEFINICIÓN. Reglas en `claude/ia-reglas.md`. Decidido el 09/10: el domicilio bloquea; el veredicto final es del administrador; se revisa el expediente completo con un solo veredicto. Maqueta R2 para usar con clics: `claude/maquetas/revision-ia-r2.html` (bloque Revisión con historial y "Mandar a revisión con IA" en el expediente; módulo Revisión con todos los analizables; borrador de la IA por documento con Aprobar o Devolver, motivo y nota, más los puntos del expediente; aprobar contra la IA o conceder excepción pide motivo; "Cerrar revisión" cambia el estatus una sola vez y arma el mensaje al líder; el abogado solo deja la revisión lista). Espera aprobación de la R2, de la regla 21 y de los 14 casos. No programar antes.
   Orden propuesto: (a) "Cerrar revisión" para la revisión manual (cambia estatus, probar contra septiembre 59/49); (b) motor de reglas en el servidor con los 14 casos como pruebas, sin IA; (c) función de borde que lee de Drive con Gemini y guarda lo leído; (d) prueba con 20 clientes ya decididos por Legal; (e) pantalla según la R2.
   Decidido 09/10 (tercera tanda): la R2 le gustó; se prueba con sus documentos reales de clientes ya decididos y se ajusta; modelo Gemini Pro, el más avanzado, como ajuste cambiable. Diseño de tablas propuesto en `claude/ia-reglas.md` (ia_lecturas, ia_corridas, ia_marcas), falta OK y pasárselo al chat del proyecto. Encaja con lo de v22 (solo archivos vigentes, motivos de Legal, revisión de una sola vez).
   Decidido 09/10 (cuarta tanda): revisión manual sigue; solo el administrador lanza la IA; bandeja de la abogada en Revisión (recibidos para contrato; "Pendiente por firmar" en las dos bandejas). Costo aproximado por cliente (unas 25 páginas): Gemini Pro 0,10 a 0,20 USD; Claude Sonnet 5.5 0,20 a 0,30; Claude Opus 5.5 0,40 a 0,60; por lotes, la mitad. El proveedor queda como ajuste para poder comparar.
   Proveedor: por ahora solo Gemini (el administrador no tiene saldo en la API de Claude). Falta que el administrador entregue la clave de la API de Gemini de la cuenta de pago para guardarla como secreto `GEMINI_API_KEY` en Supabase (nunca en el repo) y que ponga un tope de gasto en Google. Falta la columna para la marca de la IA.
6. **Módulo de aliados (EL SIGUIENTE)**: primero proponer la lógica (permisos, bloqueos por cartera y TOP, revisión de sus documentos con el mismo motor de IA, dueño de la instalación) con base en `claude/reglas-negocio.md` (sección Aliados) y `claude/aliados-app-vieja.md`, esperar el OK, luego maqueta y pantalla. Consultas viejas con el indicador de instaladas, y sus documentos. Fuente: `privado.aliados_appsheet`.

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
- Drive: la carpeta nueva se llama con el RIF en solo dígitos y el nombre en mayúsculas, como las viejas; el archivo conserva su nombre original (no se renombra por casilla); una PYME + Dedicado va a "DEDICADO CORPORATIVO + PYME" o "DEDICADO ISP + PYME".
- Privacidad: el contacto es "el administrador de la app" (sin correo, porque el repo es público).

## Problemas ya resueltos (no repetir)
- Sin acceso de red desde la terminal a Supabase: todo por el conector.
- `pg_net` y `http` no están instalados: no se llama a funciones de borde desde SQL.
- No se puede cambiar el check de `perfiles.rol`: el Analista Senior es `rol = 'analista'` con `senior = true`.
- PDF sin librerías: Helvetica estándar, anchos de letra en una tabla dentro de `documentos.js`, texto en hexadecimal; el QR es una imagen de un bit idéntica a la original.
- Drive devuelve como máximo 460 elementos por página cuando se piden los padres.
- No dejar funciones de borde abiertas (`verify_jwt` apagado) después de una prueba. `drive_prueba` quedó abierta y se apagó el 09/10 (devuelve 404 y pide sesión); `drive_inventario` también está apagada.
- Factibilidad, enlaces: si el texto pegado trae coordenadas y enlace, mandan las coordenadas (no se abre el enlace). `resolver_enlace` v2 busca coordenadas también dentro de la página de Google y deja en el registro cada salto ("salto" y "pagina") para ver dónde falla. El 09/10 falló un maps.app.goo.gl real con la v1; falta confirmar con la v2.
- Leaflet: fijar la vista antes de agregar zonas y sin animaciones; si no, falla al cerrar la hoja (`_leaflet_pos`, `_clipPoints`).
- Las pruebas sirven Leaflet desde `pruebas/vendor/leaflet` y los mosaicos con una imagen de mentira (por eso el mapa se ve rojo en las capturas).
- Chromium ignora el atributo `download` de un enlace dentro de una hoja: se descarga con un enlace suelto en la página (ver `#bajarArch` en `ficha.js`).
