# Pendientes y lo que falta definir (actualizado 20/10/2026, noche)

La versión del 09/10 sigue en el historial de git. Lo de migraciones, Mi trabajo, gestiones, filtros, IP y notificaciones ya se definió y está en `claude/lote-22oct.md`.

## Mañana 21/10 (chat del proyecto, con el administrador)
1. **Seguridad**, antes de dar acceso a aliados:
   - repo privado (GitHub Pro, revisar que GitHub Pages siga publicando);
   - cerrar todas las sesiones al restablecer un PIN;
   - cierre por inactividad (30 minutos, ajustable);
   - copia semanal de la base;
   - borrar funciones de prueba (`drive_prueba`, `drive_inventario` y la tabla vacía `public.drive_inventario`);
   - revisar `ocr_leer`, que está abierta sin sesión.
2. **Google:** confirmar que el permiso de Drive está en producción (que no venza cada 7 días); el de Gmail (lectura) también; y el permiso de enviar correo, para la fase 2 de notificaciones.
3. **Presentación** del flujo de la app con instrucciones de uso.
4. **Reglas de nomenclatura** para subir las instalaciones a Odoo.
5. **Requisitos del VGT:** los dice el administrador.
6. El administrador tiene anotadas varias cosas que debe probar antes de abrir la app.

## Aliados
Construido en v26 y conectado con clientes e instalaciones, pero nunca usado: hay 45 aliados, ninguna solicitud y ninguna cuenta de aliado. Antes de dar acceso:
1. seguridad (arriba);
2. una cuenta de aliado de prueba y el recorrido completo (pedir permiso, bloqueo, documentos, instalación, pago);
3. sus notificaciones (en `notificaciones.md` sección 4, incluido el bloqueo que avisa al aliado, al líder dueño y al administrador).

## Dedicados (después del lote 22/10)
- Módulo de la analista: base actualizable, cobranza y finanzas.
- Cambiar el tipo de cliente desde la hoja (hoy el tipo vive en dos sitios: `clientes.es_isp` y `dedicados.tipo`; unificarlo).
- Contratos (el filtro va en el lote 22/10).

## Otros
- Pantalla de correos: lo que el lector de Gmail ya subió (519 archivos a 91 clientes) y terminar de revisar el correo desde marzo.
- Correo al cliente con constancia (fase 2 de notificaciones).
- Notificaciones de Gerencia.
- Revisión de documentos con IA: proveedor y clave de pago (sigue pendiente desde el 09/10).
- Clientes de la base vieja que no están en la app: 9 tienen documentos en `privado.app_vieja_docs` ("cliente no existe en la app"). El administrador decide si se crean.
- Cliente de la base vieja con RIF dañado (0, 000000, 3505, 668850): falta el RIF correcto.
- Pago y TAD: días después de instalar para dar el pago por bueno (hoy ajuste `pago_dias_tad` = 3).
