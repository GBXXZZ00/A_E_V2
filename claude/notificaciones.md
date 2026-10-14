# Notificaciones: propuesta proceso por proceso (14/10/2026)

Estado: APROBADO en lo general por el administrador el 14/10 ("confío en ti"). NO programar todavía: se ejecuta después de migraciones y dedicados. Las 4 preguntas del final se cierran antes de programar.

## Reglas generales
1. Todo aviso nace de la lista única de pendientes del servidor (`privado.pendientes`) o de un evento de la bitácora. Nada avisa dos veces lo mismo.
2. Horario: entre 10 p.m. y 8 a.m. no llega nada al teléfono; lo de la noche sale en el resumen de las 8 a.m. (aprobado 14/10).
3. Urgencias:
   - **Inmediato**: alguien tiene que actuar hoy.
   - **Resumen 8 a.m.**: un solo aviso con todo lo del día por persona.
   - **Semanal**: lunes 8 a.m., para indicadores y lo que se arrastra.
4. Canales:
   - 📱 Push al teléfono y a la laptop (app instalada, `sw.js` + función de Supabase).
   - ✉️ Correo desde la cuenta de ventas (permiso de enviar se agrega al pasar Google a producción).
   - 🔔 En la app: contador en Inicio y en Mi trabajo (siempre, aunque no llegue push).
5. Cada aviso dice **quién hizo qué** (el involucrado por su nombre), **a qué cliente** y **qué hacer**, y al tocarlo abre la hoja exacta.
6. Al cliente la app nunca le escribe por WhatsApp. Al cliente solo por correo, con hilo, cuando se apruebe ese punto.
7. Un aviso se apaga solo cuando se resuelve la condición (sin botón "Hecho").
8. Cada persona puede silenciar el resumen semanal; los inmediatos no se silencian.

## Formato del texto (estilo Artesanos)
- **Título**: emoji + frase corta de lo que pasó.
- **Cuerpo**: quién lo hizo, a qué cliente, y qué toca hacer, con fecha límite si la hay.
- **Botón**: verbo de la acción ("Abrir expediente", "Revisar", "Emitir").

Ejemplo:
> 📄 **Te devolvieron documentos**
> Legal revisó **Comercial Ejemplo**. Devolvió 2: cédula vencida y RIF ilegible. Corrígelos antes del **18/10**.
> [Abrir expediente]

## Participantes (por rol; los nombres viven en la base, no en el repo)
Administrador · Legal (abogada) · Analista Senior (responsable de comisiones) · Analista del líder (el asignado en Usuarios; si no tiene, el Analista Senior) · Líderes (todos llevan dedicados) · Aliados · Coordinación de canales · Gerencia (solo lectura).

---

## 1. Expediente y revisión de documentos
| # | Evento | Lo provoca | Le llega a | Canal | Urgencia | Texto |
|---|---|---|---|---|---|---|
| 1.1 | Cliente pasa a Documentos en revisión | Líder | Administrador, Legal | 📱🔔 | Resumen 8 a.m. | 📥 **Expedientes nuevos para revisar** · {n} clientes llegaron a revisión. El último: {cliente}, de {líder}. [Revisar] |
| 1.2 | Se cierra la revisión con devueltos | Administrador (o Legal marcó) | Líder del cliente | 📱🔔 | Inmediato | 📄 **Te devolvieron documentos** · {revisor} revisó **{cliente}**. Devolvió {n}: {motivos}. Corrígelos antes del {límite}. [Abrir expediente] |
| 1.3 | Se cierra la revisión todo aprobado (Legal listo) | Administrador | Líder del cliente | 📱🔔 | Inmediato | ✅ **Legal aprobó a {cliente}** · {revisor} aprobó el expediente. Si ya pagó, entra en el corte del {corte}. [Ver cliente] |
| 1.4 | Pasa a Pendiente por firmar | Legal | Líder del cliente | 📱✉️🔔 | Inmediato | ✍️ **Contrato listo para firmar** · Legal dejó listo el contrato de **{cliente}**. Coordina la firma y súbelo firmado. [Abrir contrato] |
| 1.5 | Contrato firmado subido | Líder | Legal, Administrador | 🔔 | Resumen 8 a.m. | 🖋️ **Contrato firmado** · {líder} subió el contrato firmado de {cliente}. [Revisar] |
| 1.6 | Documento vence en 30 días (póliza, junta, RIF) | Sistema | Líder del cliente | 📱🔔 | Semanal | ⏳ **Documentos por vencer** · {n} documentos de tus clientes vencen este mes. El primero: {documento} de {cliente}, el {fecha}. [Ver lista] |
| 1.7 | Cliente sin documentos más de 30 días | Sistema | Líder, su analista | 🔔 | Semanal | 🗂️ **Clientes sin documentos** · {n} clientes llevan más de 30 días sin documentos. Escríbeles hoy. [Ver lista] |
| 1.8 | Resultado de la IA listo | IA | Administrador | 📱🔔 | Inmediato | 🤖 **La IA terminó de revisar {cliente}** · Propone aprobar {a} y devolver {d}. Confirma y cierra la revisión. [Abrir revisión] |

## 2. Comisiones y corte
| # | Evento | Lo provoca | Le llega a | Canal | Urgencia | Texto |
|---|---|---|---|---|---|---|
| 2.1 | Faltan 3 días para el límite (15 del mes) | Sistema | Cada líder con clientes del corte sin cumplir | 📱🔔 | Resumen 8 a.m. | ⏰ **Quedan 3 días para el corte** · Tienes {n} clientes que aún no comisionan: {x} sin documentos y {y} sin pago. Límite: **18/{mes}**. [Ver mi corte] |
| 2.2 | Día límite (18) | Sistema | Líderes con pendientes, Analista Senior | 📱🔔 | Inmediato 8 a.m. | 🚨 **Hoy cierra el corte** · {n} clientes tuyos siguen sin cumplir. Lo que no cumpla hoy pasa al próximo corte. [Ver mi corte] |
| 2.3 | Corte listo para certificar (19) | Sistema | Analista Senior, Administrador | 📱✉️🔔 | Inmediato | 📊 **El corte de {mes} está listo para certificar** · {cumplen} de {total} cumplen. Revisa y certifica. [Abrir corte] |
| 2.4 | Corte certificado | Analista Senior | Líderes, Gerencia, Administrador | 📱✉️🔔 | Inmediato | 🏁 **Corte de {mes} certificado** · El Analista Senior certificó el corte: comisionas {n} clientes. [Ver detalle] |
| 2.5 | Instalación por asignar | Cruce de archivos | Analista Senior, Administrador | 🔔 | Resumen 8 a.m. | ❓ **Instalaciones sin dueño** · {n} instalaciones no se sabe de qué líder son. Asígnalas. [Asignar] |
| 2.6 | Se le quitó la comisión a un cliente | Administrador | Líder del cliente | 📱🔔 | Inmediato | ⚠️ **{cliente} salió del corte** · {quién} le quitó la comisión: {motivo}. [Ver cliente] |
| 2.7 | Cliente pasa al corte siguiente | Sistema (cierre) | Líder | 🔔 | Resumen 8 a.m. | ↪️ **{n} clientes pasan al próximo corte** · Es su última oportunidad: si no cumplen, se pierden. [Ver lista] |
| 2.8 | Proforma y carta por enviar | Instalación con dueño | Analista del líder | 🔔 | Resumen 8 a.m. | 📨 **Bienvenidas por enviar** · {n} clientes nuevos esperan proforma y carta. El más viejo: {cliente}, instalado el {fecha}. [Enviar] |

## 3. Por instalar
| # | Evento | Lo provoca | Le llega a | Canal | Urgencia | Texto |
|---|---|---|---|---|---|---|
| 3.1 | Orden pasa de 24 h de reloj (8 a.m. a 10 p.m.) | Sistema | Líder de la orden, Administrador | 📱🔔 | Inmediato | 🔴 **Orden sin instalar: {cliente}** · Lleva {h} horas desde que {líder} la registró. Pregunta a planta externa. [Ver orden] |
| 3.2 | Orden reprogramada | Archivo de órdenes | Líder de la orden | 🔔 | Resumen 8 a.m. | 🟡 **Orden reprogramada** · La instalación de {cliente} se movió. Avísale al cliente. [Ver orden] |
| 3.3 | Orden con más de 15 días | Sistema | Administrador, Gerencia | 🔔 | Semanal | 📉 **Órdenes estancadas** · {n} órdenes llevan más de 15 días sin instalar. [Ver lista] |

## 4. Aliados (a quién le llega depende del resultado)
| # | Evento | Lo provoca | Le llega a | Canal | Urgencia | Texto |
|---|---|---|---|---|---|---|
| 4.1 | Solicitud enviada | Aliado | Administrador | 📱🔔 | Inmediato | 🤝 **Nueva solicitud de {aliado}** · Cliente {cliente}. La IA ya está revisando los documentos. [Revisar] |
| 4.2 | RIF en cartera (bloqueado) | Sistema | Aliado | 📱🔔 | Inmediato | 🔒 **Este cliente ya tiene dueño** · {cliente} pertenece a la cartera de Airtek. Puedes referirlo y te avisamos si se instala. [Referir] |
| 4.3 | Aprobada | Administrador | Aliado | 📱✉️🔔 | Inmediato | ✅ **Solicitud aprobada** · El administrador aprobó a {cliente}. Ya puedes instalar: tienes 30 días. [Ver solicitud] |
| 4.4 | Devuelta | Administrador | Aliado | 📱🔔 | Inmediato | 📄 **Faltan documentos en tu solicitud** · El administrador devolvió {cliente}: {motivo}. Súbelos para seguir. [Corregir] |
| 4.5 | Negada o no procede | Administrador | Aliado | 📱🔔 | Inmediato | ✖️ **Solicitud no aprobada** · {cliente}: {motivo}. [Ver detalle] |
| 4.6 | Instalada (por la orden) | Archivo de órdenes | Aliado, Coordinación, líder dueño del cliente (si "Tu cliente") | 📱🔔 | Resumen 8 a.m. | 🎉 **{cliente} quedó instalado** · {instalador} hizo la instalación el {fecha}. [Ver] |
| 4.7 | Instalación sin autorización | Archivo de órdenes | Administrador, Coordinación, líder si es su cliente | 📱🔔 | Inmediato | 🚩 **Instalación sin autorización** · {aliado} instaló a {cliente} sin solicitud aprobada. [Revisar] |
| 4.8 | Referido instalado | Sistema | Aliado que refirió | 📱🔔 | Inmediato | ⭐ **Tu referido se instaló** · {cliente} ya es cliente. [Ver pago] |
| 4.9 | Pago marcado | Administrador o Coordinación | Aliado | 📱✉️🔔 | Inmediato | 💵 **Pago registrado** · {quién} marcó pagada la instalación de {cliente}. [Ver pagos] |
| 4.10 | Solicitud por vencer (borrador 7 días, aprobada sin instalar 30) | Sistema | Aliado | 🔔 | Resumen 8 a.m. | ⏳ **Tu solicitud vence pronto** · {cliente} vence el {fecha}. [Abrir] |

## 5. Migraciones (cambios de categoría y titularidad)
Regla 14/10: los documentos son los mismos de una instalación; si el cambio de titularidad es a jurídico, todo lo legal del nuevo titular.
| # | Evento | Lo provoca | Le llega a | Canal | Urgencia | Texto |
|---|---|---|---|---|---|---|
| 5.1 | Solicitud de titularidad o ambos | Líder | Administrador | 📱🔔 | Inmediato | 🔁 **Cambio por aprobar** · {líder} pidió cambiar {tipo} de {cliente}. [Revisar] |
| 5.2 | Aprobado (o categoría sola) | Administrador o sistema | Analista del líder | 📱🔔 | Inmediato | ⚙️ **Cambio por emitir** · {cliente} pasa a {categoría}. Emítelo en Proham hoy. [Emitir] |
| 5.3 | Rechazado | Administrador | Líder | 📱🔔 | Inmediato | ✖️ **Cambio rechazado** · El administrador rechazó el cambio de {cliente}: {motivo}. [Ver] |
| 5.4 | Emitido | Analista | Líder | 🔔 | Resumen 8 a.m. | 📤 **Cambio emitido** · {analista} emitió el cambio de {cliente}. Se confirma cuando salga en el TAD. [Ver] |
| 5.5 | Confirmado por TAD o archivo | Sistema | Líder, Analista Senior | 📱🔔 | Inmediato | ✅ **Cambio confirmado** · {cliente} ya aparece como {categoría}. el Analista Senior decide si comisiona. [Ver] |
| 5.6 | Comisión decidida | Analista Senior | Líder | 📱🔔 | Inmediato | 💼 **Comisión del cambio de {cliente}** · El Analista Senior decidió: {sí/no}. {motivo}. [Ver] |
| 5.7 | Cambio detectado sin solicitud | Archivo de cambios | Líder de la cartera (o Administrador si no tiene) | 📱🔔 | Resumen 8 a.m. | 🔎 **Cambio detectado sin solicitud** · {cliente} pasó a {categoría} sin registro. Sube sus documentos para que pueda comisionar. [Abrir] |
| 5.8 | Por emitir más de 2 días | Sistema | Analista, Administrador | 📱🔔 | Resumen 8 a.m. | ⏰ **Cambios atrasados** · {n} cambios llevan más de 2 días sin emitir. [Ver lista] |
| 5.9 | PYME pasa a otra categoría (negativo) | Archivo | Administrador, Gerencia, líder | 🔔 | Semanal | 📉 **Clientes que dejaron PYME** · {n} esta semana. [Ver lista] |

## 6. Dedicados (todos los líderes)
| # | Evento | Lo provoca | Le llega a | Canal | Urgencia | Texto |
|---|---|---|---|---|---|---|
| 6.1 | Plazo de documentos ISP (semana del 19/10) | Sistema | Líderes con ISP sin completar | 📱🔔 | Resumen 8 a.m. diario hasta el plazo | 📡 **Documentos ISP: faltan {d} días** · Tienes {n} ISP con documentos incompletos. El que más falta: {cliente}. [Ver lista] |
| 6.2 | Requisitos VGT completos | Líder | Administrador | 📱🔔 | Inmediato | 🗼 **VGT listo para contrato** · {líder} completó los requisitos VGT de {cliente}. [Revisar] |
| 6.3 | Póliza VGT vence en 30 días | Sistema | Líder, Administrador | 📱✉️🔔 | Inmediato una vez, luego semanal | 🛡️ **Póliza por vencer** · La póliza de {tipo} de {cliente} vence el {fecha}. Pide la renovación. [Abrir] |
| 6.4 | Póliza vencida | Sistema | Líder, Administrador, Gerencia | 📱🔔 | Inmediato | 🚨 **Póliza vencida** · {cliente} tiene la póliza de {tipo} vencida desde el {fecha}. [Abrir] |
| 6.5 | Contrato dedicado por vencer (60 días) | Sistema | Líder, Administrador | 🔔 | Semanal | 📅 **Contratos por renovar** · {n} contratos dedicados vencen en los próximos 60 días. [Ver lista] |
| 6.6 | Dedicado firmado y PYME por elaborar | Sistema | Legal | 🔔 | Resumen 8 a.m. | ✍️ **Contrato PYME por elaborar** · {cliente} ya firmó el dedicado; falta su contrato PYME. [Abrir] |

## 7. Factibilidad
| # | Evento | Lo provoca | Le llega a | Canal | Urgencia | Texto |
|---|---|---|---|---|---|---|
| 7.1 | Mapa nuevo cambia el resultado de una consulta abierta | Administrador (sube KMZ) | Líder de la consulta | 📱🔔 | Resumen 8 a.m. | 🗺️ **Cambió la cobertura de {cliente}** · Con el mapa nuevo ahora sale "{resultado}". Avísale al cliente. [Ver consulta] |
| 7.2 | Se vendió (aparece orden de Odoo con su RIF) | Cruce | Líder | 🔔 | Resumen 8 a.m. | 🎯 **Consulta convertida** · {cliente} ya tiene orden en Odoo. [Ver] |

## 8. Cuentas y seguridad
| # | Evento | Lo provoca | Le llega a | Canal | Urgencia | Texto |
|---|---|---|---|---|---|---|
| 8.1 | Cuenta bloqueada por intentos | Sistema | Administrador | 📱✉️ | Inmediato | 🔐 **Cuenta bloqueada** · {usuario} falló el PIN {n} veces. Si fue la persona, restablécele el PIN. [Usuarios] |
| 8.2 | PIN restablecido | Administrador | La persona (correo) | ✉️ | Inmediato | 🔑 **Tu PIN fue restablecido** · Entra con el PIN temporal y cámbialo. Si no lo pediste, avisa al administrador. |
| 8.3 | Saldo de IA bajo o tope diario alcanzado | Sistema | Administrador | 📱✉️ | Inmediato | 💳 **La IA llegó a su tope** · Se gastaron {monto} hoy. Las revisiones siguen a mano. [Ajustes] |
| 8.4 | Permiso de Google por vencer o fallando | Sistema | Administrador | 📱✉️ | Inmediato | ☁️ **Drive dejó de responder** · Las subidas no llegan a Drive. Vuelve a autorizar Google. |

## 9. Resúmenes
| # | Para | Cuándo | Contenido |
|---|---|---|---|
| 9.1 | Cada persona | 8 a.m. diario (solo si hay algo) | ☀️ **Buenos días, {nombre}** · Hoy tienes {n} pendientes: {top 3 con su número}. [Abrir Mi trabajo] |
| 9.2 | Gerencia y Administrador | Lunes 8 a.m. | 📈 **Semana de Airtek Empresas** · Instalaciones {n} ({±%}), comisionables {n}, expedientes completos {%}, negativos {n}. [Ver Gerencia] |

---

## Fuera de esta propuesta (otra tarea)
- **Correos al cliente con hilo** (pedir documentos, bienvenida): se define aparte con los textos al cliente.
- **Lectura de correos para encontrar documentos** (Gmail empresarial y Outlook): es el "agente de correo"; comparte el permiso de Google pero es otro proyecto. Primero un inventario de prueba con los conectores.

## Preguntas abiertas
1. ¿Legal recibe push o solo correo y la app?
2. ¿El líder recibe 2.1 (3 días antes) y 2.2 (día límite), o solo uno?
3. ¿Gerencia recibe algo además del resumen semanal (4.7, 6.4)?
4. ¿El aviso a aliados también va por correo (4.3, 4.9) o solo push?
