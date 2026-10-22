# Lote S + A: seguridad y avisos (APROBADO por el administrador el 21/10)

Una sola corrida, dos publicaciones: primero S, luego A. Pruebas, capturas 1366x768 e iPhone, revisión independiente, `?v=`, commit y push como siempre.

## Contexto del 21/10 (chat del proyecto)
- Octubre quedó certificado (75 de 83). Los 18 cambios de categoría de octubre comisionan por excepción con nota "Legal pendiente". Noviembre está en curso.
- Revisión de seguridad hecha: no hay claves secretas en el historial de git; RLS activo en todas las tablas; validación en el servidor. Faltaban CORS, CSP y lo de sesiones.
- Repo público con PIN temporal escrito en `claude/lote-21oct.md` y `claude/traspaso.md`: el administrador restablece esas cuentas a mano. Al hacer el repo privado deja de verse.

## Lote S: seguridad
1. **Sesión hasta 12 horas sin uso** (reemplaza la sesión que muere al cerrar la app):
   - La sesión pasa de `sessionStorage` a `localStorage` (`supabase-client.js` y `sesion.js`, incluido `idSesionGuardada`).
   - Última actividad guardada en el dispositivo (toque, tecla, volver a la app). Al abrir o volver: si pasaron más horas que el ajuste, `Sesion.salir()` y a la entrada.
   - Ajuste en la base: `privado.ia_ajustes` clave `inactividad_horas` (por defecto 12, entre 1 y 72), RPC `inactividad_guardar` solo administrador, con bitácora. Un campo en la hoja de cuenta del administrador.
   - No cerrar si hay subidas en curso: `window.AE_ocupado()` lo exponen `ficha.js`, `actualizar.js` y `mapared.js` con su variable `ocupado`.
2. **Cerrar sesiones al restablecer PIN o desactivar**:
   - Función `public.sesiones_cerrar(uuid)` (borra `auth.sessions` del usuario; los refresh tokens caen en cascada), solo `service_role`. `gestionar_usuarios` la llama en `pin` y en `activo=false`.
   - RPC `public.sesion_viva()` (authenticated): `exists auth.sessions` con el `session_id` del JWT y perfil activo. `armazon.js` la consulta junto con la campana (cada 2 minutos y al volver a la app); si no está viva, sale con el aviso "Tu sesión se cerró. Entra de nuevo".
   - La migración se intentó el 21/10 y se canceló (ver el SQL en el chat); rehacerla con horas en vez de minutos.
3. **Volver a donde iba**: si un aviso o enlace abre una página sin sesión, la entrada guarda el destino (`?ir=`, solo páginas propias `^[a-z]+\.html(\?.*)?$`) y al entrar lleva ahí. En iPhone, tocar el aviso abre la hoja exacta.
4. **CORS**: en todas las funciones de borde, `Access-Control-Allow-Origin` solo `https://gbxxzz00.github.io` (y `http://localhost` para pruebas). Las de servidor a servidor (`ia_revisar`, `correo_tarea`, `avisos_push`) no lo necesitan. `correo_conectar` es la vuelta de Google: queda igual.
5. **Content Security Policy** con `<meta http-equiv>` en todos los HTML: `default-src 'self'`; scripts `'self'` y el CDN de Chart.js; `connect-src` el proyecto de Supabase (https y wss) y Google Drive si se usa desde el navegador; imágenes `'self' data: blob:` y lo que hoy se carga (Drive, mapas de Leaflet); `frame-ancestors` no aplica en meta. Probar cada página y que no salga ningún error de CSP en consola.
6. **Limpieza en la base**: quitar `execute` a `anon` en `cambio_categorias()`, `ocr_ajustes()` y `ocr_ajuste_guardar(text, boolean)`; borrar `privado.prueba_tmp` y la tabla vacía `public.drive_inventario`. Las funciones de borde `drive_prueba` y `drive_inventario` las borra el administrador en el panel de Supabase (pasos en la respuesta final).
7. Guardar el código de `correo_conectar` en `supabase/funciones/correo_conectar/` (se revisó: es segura, enlace de un solo uso de 20 minutos).
8. Quitar de los documentos de `claude/` cualquier PIN escrito (poner "PIN temporal" sin el número).

## Lote A: avisos y contacto
1. **Tarjeta "Activar alertas" en Inicio** (todos menos gerencia): misma lógica que la hoja de avisos (iPhone pide instalar primero; si está bloqueado, cómo activarlo). Desaparece cuando ya están activas en ese dispositivo.
2. **Avisos agrupados por categoría** en la hoja de la campana: una fila por tipo con número de sin leer y total ("Documentos por revisar · 318"), plegable; al abrirla, la lista de ese tipo. El "Venció: ..." va dentro de su grupo como marca roja, no como aviso aparte. "Marcar leído" por grupo. El push también agrupa: si hay más de 3 del mismo tipo sale uno solo con el número.
3. **Icono de usuario en el teléfono**: el arreglo de la campana (commit c72b548) lo sacó de la barra en iPhone. Que se vean los dos en 390 px.
4. **"Contactar al responsable"** en cada hoja (migración, comisión, documentos del cliente, cliente): botón que abre WhatsApp (`perfiles.whatsapp`) con el mensaje ya escrito según el estado, o el correo si no tiene WhatsApp. Ejemplos:
   - Migración aprobada: "Hola Patricia, la migración de VENTURIPLUS ya está aprobada. Falta cargarla en Proham (plan y categoría a la vez)."
   - Comisión que no cumple: "Hola María, a ALI HAIDAR le falta Legal para comisionar. Cierra el corte el 18/11."
   - Documentos devueltos: "Hola Oriana, a SUYUNIBA PRIETO le devolví la cédula: está vencida."
   Responsable = el líder dueño; si el paso es del analista, el analista del líder; el administrador elige si hay dos. Queda en la bitácora (`contacto_responsable`).
5. Nombre de la app en el teléfono: lo decide el administrador (hoy "Empresas"; el iPhone pone "from ..." y eso no se puede quitar).

## Parte C (misma corrida, después de A): lo que faltaba
1. **Avisos de aliados** que faltan de `claude/notificaciones.md` sección 4: bloqueo (al aliado, a su líder dueño y al administrador), "pago confirmado por el TAD" y "cuenta bloqueada". Probar el recorrido completo con una cuenta de aliado de prueba (pedir permiso, bloqueo, documentos, instalación, pago) y borrarla al final.
2. **App vieja, decidido el 21/10:**
   - La fila de la persona natural que pasó el servicio a su empresa se carga en el **cliente empresa**.
   - **Crear los 9 clientes** que no existen (48 filas de `privado.app_vieja_docs`) con su RIF, y traer sus documentos con `privado.app_vieja_docs_traer()`. Bitácora y prueba con rollback antes.
3. Revisar que la fila "no tocar" siga sin traer.

## Pendientes que NO son de Code
- **Repo privado:** el administrador debe pagar GitHub Pro primero. NO OLVIDAR: hasta entonces los documentos de `claude/` son públicos.
- Requisitos del VGT: después de la reunión con Reina.
- Google en producción: lo hace el administrador en Google Cloud con guía.

## Parte D (22/10, decidido por el administrador): requisitos de VGT
- Para VGT solo se piden, además del expediente completo del cliente, **dos pólizas**: responsabilidad civil general (66) y responsabilidad patronal (67), las dos con vencimiento.
- En `privado.vgt_requisitos()` dejar `requerido = false` en habilitación (65), propuesta comercial (68), planilla de tendido (69) y factibilidad técnica (70); siguen como opcionales para quien quiera subirlos. Las actas de asamblea (60 a 63) y el poder (64) siguen opcionales.
- `privado.vgt_faltan()` ya no suma el correo de VGT (`dedicados.vgt_correo`): el correo queda como dato opcional.
- Revisar textos, contadores y filtros que digan "7 recaudos" o similares (ficha del dedicado, Clientes, Mi trabajo, avisos) para que hablen de las 2 pólizas.
- Las pólizas vencen: aviso 30 días antes del vencimiento al líder y al administrador.
- Modelo de póliza (RC general de Oceánica, sin datos del cliente) disponible para los líderes: lo comparte el administrador.

## Parte E (22/10): la IA no toma la junta de un acta de asamblea marcada "otro"
- Caso real: TOTALCOM VENEZUELA CA (cliente 985, corrida 22). Acta de asamblea del 16/10/2023, inscrita el 12/12/2023, trae la junta completa (6 personas) y 5 años, pero el lector la marcó con tema `otro` ("aclaratoria de la cláusula XII sobre la conformación de la Junta Directiva"). `reglas.mjs` línea ~217 solo cuenta como designación las actas con tema `cambio_junta` o `ratificacion_junta`, así que tomó la constitutiva de 1998 y bloqueó "Junta vencida".
- Arreglo: un acta de asamblea que trae `junta` con al menos una persona cuenta como designación aunque el tema sea otro (y se toma la más reciente por fecha de inscripción). Además, ajustar el prompt del lector para que marque `ratificacion_junta` o `cambio_junta` cuando el acta nombra la junta.
- Prueba nueva con este caso (junta vigente hasta 12/12/2028). Volver a correr Totalcom después del arreglo.
- Ojo también: la corrida 22 se lanzó a las 18:31 UTC y las lecturas de las actas terminaron a las 18:33. Revisar que la corrida espere a las lecturas nuevas o se repita sola al terminar.
