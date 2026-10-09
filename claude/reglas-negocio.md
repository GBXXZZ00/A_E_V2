# Reglas de negocio fijadas por el administrador

Sin nombres reales: el repo es público. "Analista Senior" es el responsable de comisiones; "canales" es la persona externa que lleva a los aliados.

## Fuentes y cruce
- Cadena: orden en Odoo (venta del líder) -> orden de instalación -> aparece en el TAD (consolidado de usuarios, no de clientes).
- La base es por cliente (RIF), no por usuario. "Cantidad de usuarios" es la cantidad de servicios por RIF. El RIF se normaliza tomando el del TAD.
- Una orden de Odoo creada y no instalada entra a la base con ese estatus, para que el líder suba documentos.
- El cruce de archivos (Odoo, órdenes de instalación, TAD, base vieja) lo hace la app en la pantalla Actualizar, arrastrando los archivos todos juntos. A futuro serán más de cuatro archivos.
- En la orden de instalación: "instalador xx" es el equipo propio; un nombre propio es un aliado. Los reemplazos son cambios de equipo y no comisionan (sirven de indicador).
- Lo que no coincide con la base vieja queda en "Grandes negocios", para hacerle gestión.
- Una PYME instalada como residencial es un error: queda como pendiente con aviso.

## Comisiones
- Corte del 21 al 20, hora de Caracas. Requisitos: Legal y pago. Si no cumple pasa al corte siguiente; si tampoco cumple, se pierde y queda constancia. Los que vienen del corte anterior se marcan como prioritarios.
- El dueño de la comisión lo manda la orden de instalación: comisiona quien instala, aunque el cliente esté en cartera de otro. Si instaló un aliado, es del aliado aunque la orden la haya montado un líder.
- La orden de Odoo es obligatoria, debe ser nueva (creada hasta 45 días antes de la instalación) y va siempre a la vista. Sin orden clara: "pendiente por asignar" hasta que el Analista Senior confirme o asigne.
- Pago: lo dice el TAD (deuda por RIF). El Analista Senior puede marcarlo o quitarlo a mano y eso se respeta en la siguiente carga.
- Excepciones: solo el administrador, con motivo.
- Dedicados, conectividad, aliados y reemplazos no comisionan. Los eventos comisionan a veces: decide el Analista Senior.
- Naturales: también salen en el corte y se pagan. Solo cédula y RIF personal; contacto opcional; sin contrato.
- Canales comisiona con las mismas reglas de documentos.

## Nomenclatura de Odoo (arranca el lunes 12/10/2026)
- Formato del texto que escribe el líder: `INST. [TIPO] NOMBRE J000000000` y, solo si la orden la crea otra persona por él, su código de vendedor en número al final. El MDT o nodo lo pone Odoo solo.
- RIF sin guiones y con su letra (J, V, G, E). Para persona natural, la cédula con su letra. Hay que prever RIF mal tecleado.
- TIPO es una lista cerrada, una forma por categoría de orden:
  - `PROMO PYME`: instalación PYME nueva. Es casi todo.
  - `EVENTO`: instalación para un evento. Comisiona a veces; decide el Analista Senior.
  - `MIGRACION`: cliente que ya tiene servicio residencial y pasa a PYME.
  - `CAMBIO`: cambio de plan o de equipo en un cliente que ya existe.
  - `DEDICADO`: lo puso Claude Code por su cuenta; el administrador no lo ha confirmado.
- En Factibilidad solo aplican los tipos de cliente nuevo: PROMO PYME, EVENTO y, si se confirma, DEDICADO. Migración y cambio son de clientes que ya tienen servicio y no pasan por factibilidad.
- Lo que hoy se escribe delante y estorba el cruce (reprogramada, requiere construcción, día y hora) va al final o en notas, nunca delante.
- El cruce debe llevar el número de la orden de trabajo de Odoo.

## Expediente y documentos
- Casillas: cédula y RIF personal por representante (hasta 4), RIF de la empresa, acta constitutiva, actas de asamblea (agregables hasta 4), Conatel, contrato PYME, contrato dedicado, otros.
- Orden en Documentos: por representante teléfono y correo (una sola celda de contacto), cédula y RIF; después lo de la empresa. Teléfono y correo cuentan para "faltan".
- El nombre del representante no se escribe a mano: lo llena la IA al analizar.
- Al subir varios archivos, la persona marca qué trae cada uno.
- El contrato PYME solo se sube desde "Pendiente por firmar". La marca de proveedor ISP es solo para dedicados.
- Cuando el líder pide documentos el estatus pasa a "documentos solicitados"; cuando el líder sube, a "en revisión"; cuando Legal aprueba, a "recibidos".
- Cliente TOP se mantiene: bloquea cartera frente a los aliados.
- Tipos de cliente: PYME, dedicado corporativo, dedicado ISP y combinados. Contratos distintos, mismos documentos. "Evento" no aparece en el filtro.
- Desde Comisiones se gestiona sin abrir todo el expediente: subir y escribir ahí mismo.

## Documentos en Drive
- Todo documento vive en Drive (cuenta de ventas), nada en el almacenamiento de Supabase. No dos lugares.
- La carpeta del cliente ("RIF - NOMBRE") se crea sola al subir el primer documento.
- Los documentos de la app vieja aparecen en la app como si se hubieran subido en ella, y conservan el estatus legal que ya tenía el cliente.
- Estatus legal y revisión de la IA son dos marcas distintas. La IA entra "sin revisar", lee el expediente completo, solo propone, y se compara contra lo que Legal ya decidió. Se ejecuta cuando el administrador lo decida.

## Revisión de documentos con IA (definiéndose desde el 09/10)
- Proveedor: Gemini. Mientras tanto se usa la clave de la cuenta personal del administrador; cuando active la de la cuenta de ventas (pago previsto para el 03/11) se cambia el secreto en Supabase, sin tocar código. La clave nunca va en el repo.
- Se lanza por lote, porque es un acumulado. La lanzan el administrador y el abogado.
- Las reglas salen de la app vieja (App-Airtek-Empresas) y del script de Apps Script que el administrador va a pasar. No funcionaban al 100 %: hay que adaptarlas a esta app y mejorarlas.
- Lo que revisaba la app vieja: por representante, cédula y RIF vigentes, nombre igual en los dos, que esté en la junta directiva vigente (si no está pero otro sí firma, no bloquea) y documentos duplicados; RIF de la empresa vigente y con el mismo nombre del sistema; acta constitutiva (fecha de inscripción, empresa vigente, régimen de firma, junta vigente y hasta cuándo, domicilio igual al del RIF); actas de asamblea (cambio de nombre, de domicilio, de directores o presidente, ratificación de junta, prórroga, aumento de capital); faltantes críticos y no críticos, incluidos Conatel, correo y teléfono.
- Veredicto de la app vieja: aprobado, con observaciones o no apto. Desde ahí Legal aprobaba o mandaba los faltantes al líder.
- La cuenta personal de Gemini ya es de pago.
- Referencia de cómo funcionaban aliados e IA en las apps viejas: `claude/aliados-app-vieja.md`.
- Un solo motor de lectura para todo: el mismo que revisa expedientes de clientes sirve para las solicitudes de aliados. Primero se arma el motor; aliados va después.
- El administrador elige qué clientes se corren; nunca se corre toda la base de una vez. Volumen: unos 80 clientes nuevos al mes, más los viejos que falta recopilar.
- Proveedor por decidir con una prueba: Gemini contra Claude sobre los mismos clientes que Legal ya decidió.

## Aliados
- "Aliado Comercial" es el nombre de la cartera: instalaciones de canales más las de los aliados. Hay que mostrar quién instaló cada una.
- Los aliados no suben a Odoo: piden permiso, se revisan sus documentos y de ahí sigue todo. Un aliado puede instalar lo que otro registró.
- Los registros viejos de aliados que no se instalaron se guardan en el módulo de aliados como consultas viejas, con el indicador de cuáles se lograron instalar. Los dudosos entran como "pendiente por instalación". También se migran sus correos y teléfonos.
- Si un cliente ya está en gestión de un líder, el aliado queda bloqueado.

## Proforma y carta de bienvenida
- Formato original de la app vieja, sin rediseñar. Instalación 60 dólares, día límite 10, descripción "servicio de internet", número de contrato = código.
- Las hace el analista; al líder le salen como pendiente y puede enviarlas. Solo para clientes nuevos.
- La carta sale cuando la instalación tiene dueño; si es de aliado, sin datos de líder. WhatsApp y correo del líder salen de Usuarios.
- Envío: en teléfono se copia el número y se abre Compartir con el PDF; en web se descarga y se abre el chat. Correo formal con las dos.

## Factibilidad
- El líder no debe abrir Google Maps: pega el enlace o comparte desde WhatsApp. Nombre, teléfono y RIF son opcionales.
- Zona exclusiva de aliado: se puede instalar, solo se avisa. Planta Externa: aviso para el aliado de que ahí no puede instalar.
- Cada consulta se vuelve a revisar sola cuando se sube un mapa nuevo y avisa si cambió. El mapa se sube por la pantalla Actualizar.
- Vista amplia de los MDT cercanos, como en la app vieja.
- Confirmado el 09/10: el tipo de cliente viene marcado en PYME; lo compartido desde WhatsApp espera un toque en Consultar; con un mapa nuevo solo se revisan las consultas abiertas.
- El mensaje para el cliente sale con el formato "Notificación de cobertura" (resultado y siguiente paso en negrita) y lo firma el líder.
- Texto de Odoo en Factibilidad: Hay red, instalación PROMO PYME (por defecto) o EVENTO; Posible excepción, "FACTIBILIDAD NOMBRE RIF"; Dedicado no lleva texto hasta el módulo de dedicados.

## Generales
- Ingreso con PIN; se recuerda equipo y usuario. Roles: admin, abogado, líder, aliado, analista (el Analista Senior es analista con marca `senior`).
- Notificaciones por módulo, por correo, teléfono y página instalada. No hay "bandeja": el aviso lleva directo al módulo.
- Las cuentas las crea el administrador desde Usuarios.
- Pendiente para después: dedicados, migraciones (residencial a PYME, se cobran y exigen documentos), cambios de titularidad, clientes viejos, mensajes al cliente por caso, correo desde el servidor.
