# Pendientes y lo que falta definir (actualizado 23/10/2026)

**23/10:** Lote G aprobado (datos accionables por módulo, tablero gerencial, vista y avisos del gerente, modo práctica): `claude/lote-g-datos-tablero-practica.md`. Va después del lote S+A+C+D+E+F. Luego: pruebas por rol, ajustes y presentaciones en vivo.

**21/10 (tarde):** lote S + A + C publicado (v57 a v59): sesión de 12 h sin uso, cierre de sesiones al restablecer PIN, CORS y CSP; avisos agrupados y Contactar al responsable; avisos de aliados; app vieja cargada (9 clientes creados). Falta que el administrador ponga su WhatsApp en Usuarios y borre en el panel las funciones de Drive de prueba.

**21/10:** octubre certificado. Lote S + A (seguridad y avisos) aprobado: `claude/lote-seguridad-avisos.md`. App vieja decidida (empresa + crear los 9) y avisos de aliados: parte C del mismo lote. **Repo privado pendiente hasta pagar GitHub Pro (no olvidar).** VGT después de reunirse con Reina. Presentación del flujo y documento de reglas de instalaciones y comisiones: después de que el administrador pruebe la app.

La versión del 09/10 sigue en el historial de git. Lo de migraciones, Mi trabajo, gestiones, filtros, IP y notificaciones ya se definió y está en `claude/lote-22oct.md`.

## Mañana 21/10 (chat del proyecto, con el administrador)
1. **Seguridad**, antes de dar acceso a aliados:
   - repo privado (GitHub Pro, revisar que GitHub Pages siga publicando);
   - cerrar todas las sesiones al restablecer un PIN (hecho 21/10, lote S);
   - cierre por inactividad (hecho 21/10: 12 horas, ajustable por el administrador);
   - copia semanal de la base;
   - borrar funciones de prueba (`drive_prueba`, `drive_inventario` y la tabla vacía `public.drive_inventario`);
   - revisar `ocr_leer`, que está abierta sin sesión.
2. **Google:** confirmar que el permiso de Drive está en producción (que no venza cada 7 días); el de Gmail (lectura) también; y el permiso de enviar correo, para la fase 2 de notificaciones.
3. **Presentación** del flujo de la app con instrucciones de uso.
4. **Reglas de nomenclatura** para subir las instalaciones a Odoo.
5. **Requisitos del VGT:** los dice el administrador.
6. El administrador tiene anotadas varias cosas que debe probar antes de abrir la app.


## Solicitudes de VGT (después de Dedicados, pedido del administrador 22/10)
Módulo para el control total de las solicitudes de VGT: registro de cada solicitud (cliente, ruta o proyecto, estado, postes, fecha), estados (solicitada, en evaluación, aprobada, negada con motivo, en proyecto, en uso), quién la aprobó o negó, ODT de infraestructura, contrato y pólizas, e historial. Reemplaza la BD consolidada de VGT en Excel. Requisitos con Reina (todavía no se ha reunido con ella).

## Aliados
Construido en v26 y conectado con clientes e instalaciones, pero nunca usado: hay 45 aliados, ninguna solicitud y ninguna cuenta de aliado. Antes de dar acceso:
1. seguridad (arriba);
2. una cuenta de aliado de prueba y el recorrido completo (pedir permiso, bloqueo, documentos, instalación, pago);
3. sus notificaciones (hecho 21/10, lote C; probado con una cuenta de prueba en la base y en el simulador).

## Dedicados (después del lote 22/10)
- Módulo de la analista: base actualizable, cobranza y finanzas.
- Cambiar el tipo de cliente desde la hoja (hoy el tipo vive en dos sitios: `clientes.es_isp` y `dedicados.tipo`; unificarlo).
- Contratos (el filtro va en el lote 22/10).

## Otros
- Pantalla de correos: lo que el lector de Gmail ya subió (519 archivos a 91 clientes) y terminar de revisar el correo desde marzo.
- Correo al cliente con constancia (fase 2 de notificaciones).
- Notificaciones de Gerencia.
- Revisión de documentos con IA: proveedor y clave de pago (sigue pendiente desde el 09/10).
- Clientes de la base vieja: los 9 se crearon el 21/10 con nombre provisional "RIF J-… (app anterior)"; falta su nombre real (se pone al revisar el RIF).
- Cliente de la base vieja con RIF dañado (0, 000000, 3505, 668850): falta el RIF correcto.
- Pago y TAD: días después de instalar para dar el pago por bueno (hoy ajuste `pago_dias_tad` = 3).
