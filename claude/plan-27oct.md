# Plan desde el 27/10 (formalizado en el chat del proyecto)

Estado: el administrador todavía NO ha probado la app. Lo último publicado (corrida 23/10: seguridad, modo práctica, panel, avisos de aliados, regla de la junta, VGT con "Denegar") no le permite probar como quería. Este documento ordena lo que falta, en este orden.

## 1. Permiso de Google que vence cada 7 días (URGENTE, lo hace el administrador con guía)
Causa: la pantalla de consentimiento de Google Cloud está en modo "Prueba" (Testing); en ese modo los refresh tokens vencen a los 7 días. Solución definitiva:
1. Google Cloud Console → proyecto de la app → "APIs y servicios" → "Pantalla de consentimiento de OAuth" (Google Auth Platform → Público/Audience).
2. "Publicar app" / "Pasar a producción". Tipo de usuario: Externo. Si pide verificación por usar Drive y Gmail (permisos sensibles o restringidos), se puede seguir usando sin verificar: Google muestra la advertencia "app no verificada" solo a quien autoriza (el administrador), y el token ya no vence a los 7 días. Requisitos que ya existen: página de privacidad `https://gbxxzz00.github.io/A_E_V2/privacidad.html` y página principal.
3. Generar el permiso de nuevo una sola vez (mismo flujo que se usó para Drive) y reemplazar el secreto `GOOGLE_REFRESH_TOKEN` en Supabase (Edge Functions → Secrets). Lo mismo para el buzón de Gmail con `correo_conectar` (enlace de un solo uso).
4. Verificar: subir un documento a Drive desde la app y que la lectura de Gmail siga corriendo.

## 2. Paneles dentro de cada módulo (no un módulo aparte)
- Quitar "Panel" como módulo propio del menú. Cada módulo (Clientes, Comisiones, Migraciones, Revisión, Dedicados, Aliados, Factibilidad) tiene una pestaña u opción "Resumen" arriba de su lista, con su gráfica y sus números.
- Usar el HISTÓRICO real: instalaciones PYME desde el TAD (`public.servicios.fecha_instalacion`, desde 2024-01, con estado habilitado/suspendido; por líder vía `clientes.lider_id`), comisiones por corte, migraciones, revisiones de Legal, solicitudes de aliados. Vistas "Mes a mes" (24 meses con el mismo mes del año anterior) y "Año contra año". Hoy el panel sale vacío porque lee instalaciones desde comisiones (solo desde agosto).
- Tocar un número o una barra filtra la lista del módulo.

## 3. Clientes con orden en Odoo y sin instalar (visibilidad para los líderes)
- Hoy existe "Por instalar" dentro de Comisiones, pero el líder no lo ve como gestión.
- Agregar en Clientes y en Mi trabajo del líder un grupo "Orden en Odoo, sin instalar": cada orden con días desde que se creó, documentos que faltan y botón "Subir documentos". El cliente se crea con su RIF si no existe.
- Cuando el TAD trae la instalación, el cruce la une a esa orden y pasa a comisiones sin cargarla de nuevo.
- Alerta al líder si la orden pasa de 15 días sin instalar (ajustable), y lo mismo resumido para el administrador.

## 4. Vista de gerencia (Iván) rehecha
- Entra a una pantalla de inicio propia: una tarjeta por módulo con 2 o 3 números del mes y su tendencia; al tocar una, abre el "Resumen" de ese módulo en solo lectura.
- Mismo diseño de la app. Sin botones de edición. Avisos de gerencia: pedido de cliente por aliado (ya existe), resumen semanal y cierre de corte.
- Crear la cuenta de Iván (rol gerencia) antes de probar.

## 5. Experiencia de gestión en cada módulo (pendiente del lote G)
- Arriba de cada lista: 3 o 4 números del mes que filtran al tocarlos y "Para hoy" con las 3 a 5 acciones urgentes y su botón directo.

## 6. Avisos reales para la presentación
- El modo práctica no manda push (corre solo en el teléfono). Agregar un botón del administrador "Enviar aviso de prueba" que mande un push REAL a las cuentas reales elegidas (o a todas), con texto inofensivo y enlace a Inicio. Con bitácora.

## 7. Pruebas del administrador (después de 1 a 6)
Guía cuenta por cuenta en `claude/guia-pruebas.md` (actualizarla con lo nuevo). Criterio para dar acceso: avisos reales llegan al teléfono; el líder sube documentos, ve su comisión y registra una migración; el administrador revisa, aprueba y devuelve.

## 8. Presentación en vivo (la arma Claude en el chat del proyecto cuando 1 a 7 estén listos)
Tres públicos: líderes, analistas y canales, gerente; aliados después con un piloto. QR para instalar, lámina "activa los avisos", guion en modo práctica y cierre con un aviso real a los teléfonos.

## Pendientes que siguen en cola (no bloquean el lanzamiento)
Contactar al responsable, app vieja (persona natural a empresa y crear los 9 clientes), auditoría masiva de la IA y relanzar la revisión cuando una lectura llega tarde, resto de VGT (contadores y ODT para Legal), módulo de solicitudes de VGT (después de dedicados, con Reina), churn exacto con fecha de última suspensión y habilitación del TAD, repo privado (cuando se pague GitHub Pro), 6 pruebas automáticas que dependen de la fecha.
