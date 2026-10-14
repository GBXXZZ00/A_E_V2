# Bandeja de correos (base, 14/10/2026)

Hecho desde el chat del proyecto con el conector de Supabase. Falta la pantalla "Correos" (Claude Code).

- Tablas: `public.correos`, `public.correo_adjuntos` (RLS sin políticas: solo por funciones), `privado.correo_buzones` (token de cada buzón conectado, solo lectura de Gmail), `privado.correo_estados` (enlaces de conexión de un solo uso, 20 min).
- Secreto `correo_tarea` en el Vault: token interno de la función `correo_tarea` (cabecera `x-tarea`); `privado.correo_llamar(jsonb)` la llama con pg_net.
- Funciones de borde (verify_jwt apagado a propósito): `correo_conectar` (inicio con `?inicio=<estado>` de `privado.correo_estado_nuevo()`, vuelta de Google, guarda el buzón) y `correo_tarea` (acciones `barrer` {buzon, q, max, pagina} y `subir` {adjuntos: [ids]}).
- Cotejo en el servidor (`privado.correo_cotejar`): RIF con letra o 9 dígitos idénticos (alta), código de servicio (alta), correo del contacto (alta), nombre del asunto por parecido pg_trgm (media si ≥ 0,75 y separado del segundo por 0,15; si no, baja con candidatos). Casilla por el nombre del archivo (`privado.correo_casilla`).
- Subir: `correo_destino` + Drive (misma lógica de drive_subir, nombre "RIF - Casilla - fecha") + `correo_registrar`, que llama a `documentos_registrar` como el administrador (misma regla: a un cliente aprobado entra aprobado). No sube si ya hay un archivo con el mismo nombre y tamaño en el cliente. Bitácora `correo_adjunto_subido`.
- Probado con datos inventados dentro de una transacción deshecha: HH Network (media, contrato_dedicado), Siderúrgica (media, acta y cédula), San Juan Group (baja: hay dos clientes con ese nombre), RIF en el texto (alta).
