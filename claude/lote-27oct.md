# Lote 27/10: Resumen con gráficas en cada módulo, gerencia y arreglos de base

Aprobado por el administrador el 27/10. Corrida única: hacer todo, en este orden, sin preguntar lo que aquí ya está decidido.
Maquetas aprobadas: `claude/maquetas/resumen-27oct/` (abrir los `.dc.html` en el navegador). Mandan sobre cualquier duda de diseño.
Los números de las maquetas son reales al 27/10 (los nombres son inventados): sirven para probar que los cálculos dan lo mismo.

## Parte A · Base de datos (sin pantalla)
1. **Historial de estados del TAD.** Tabla `servicio_estados` (servicio, estado, fecha de la carga, carga_id). En cada carga del TAD se anota solo el cambio de estado. Empieza hoy: sin esto no hay churn ni reactivados.
2. **Índice de residenciales del TAD.** Hoy se detiene a mitad (415 mil filas, cargas 12 y 13 quedaron cortadas). Que suba solo las filas que cambiaron, en lotes más pequeños, y que retome donde quedó. Si falla, la carga de empresas sigue dándose por buena y la pantalla lo dice claro.
3. **`modulo_resumen(p_modulo, p_desde, p_hasta)`**: una sola llamada por módulo con los números y las series de sus gráficas. Respeta permisos (el líder ve lo suyo; admin, Senior y gerencia ven todo). Caché de 2 minutos.
4. **`modulo_detalle(p_modulo, p_grafica, p_valor, p_pagina)`**: la lista detrás de cada número, barra o tramo, de 50 en 50. La misma consulta sirve para "Exportar a Excel" (CSV con separador `;` y UTF-8 con BOM).
5. **Órdenes sin instalar.** Orden de Odoo PYME abierta (no Realizado ni Cancelado) sin instalación del TAD. Cuando el TAD trae la instalación, el cruce la une a la orden y pasa a comisiones sin cargarla de nuevo. Aviso al líder dueño cuando pasa de N días (ajuste `orden_dias_alerta`, 15 por defecto) y un resumen al administrador.
6. **Avisos de gerencia**: resumen semanal (lunes 8:00, Caracas) y cierre de corte certificado.
7. **IA**: relanzar sola la revisión cuando una lectura termina después de lanzada la corrida.
8. **Copia semanal de la base** a almacenamiento privado (tablas de negocio, sin secretos). Si el plan de Supabase no lo permite, decirlo en el traspaso.
9. **Tipo de cliente de dedicados en un solo sitio** (hoy `clientes.es_isp` y `dedicados.tipo`).
10. Arreglar los datos de prueba de `test03`, `test06`, `test11`, `test39`, `test43` y `test44` (dependen de la fecha).

## Parte B · Pantallas (según las maquetas)
**Reglas comunes**
- Se quita "Panel" del menú; `panel.html` lleva a Inicio.
- Cada módulo tiene arriba **Lista | Resumen**. La Lista queda igual que hoy (tarjetas, atajos y Filtros). No se agregan franjas de números encima de la Lista.
- **Resumen**: fila de 4 números tocables y gráficas. Gráficas con Chart.js o CSS, con el aspecto de la maqueta: líneas de referencia suaves, valor encima de cada barra, color solo para estado (ámbar = atención, rojo = vencido).
- **Todo se toca.** Número, barra o tramo abren el **panel de detalle**: a la derecha en escritorio, hoja desde abajo en teléfono. Tiene título, cantidad, lista (50 por página), "Exportar a Excel" y "Ver todos en la lista" (abre la Lista con ese filtro por la URL).
- Teléfono: números deslizables y gráficas una debajo de otra (ver `ResumenTelefono.dc.html`).

**Por módulo** (gráficas exactas en `Modulos.dc.html` y `Main.dc.html`)
- **Clientes**: instalaciones PYME mes a mes (24 meses, habilitados y suspendidos hoy) y año contra año; octubre por líder (con "sin líder" en ámbar); **estatus legal por segmento** (PYME, Dedicado corporativo, Dedicado ISP) en 5 grupos: Completo (`grandes_negocios`), Firmado (`contrato_firmado`), Por firmar (`por_firmar` + `contrato_en_curso`), En revisión (`documentos_recibidos` + `documentos_en_revision`), Faltan documentos (`documentos_solicitados` + `documentos_pendientes`); "Siguen habilitadas": % de lo instalado cada mes que hoy está Habilitado.
- **Comisiones**: instaladas por corte (con pago y sin pago); corte actual por líder; **sin instalar por antigüedad** (menos de 15, 15 a 60, 60 a 180, más de 180 días); número "De orden a instalación" (mediana); hueco "Monto del corte" (Por armar).
  - **Sin instalar** también es un atajo en la Lista de Comisiones: orden, cliente o "Sin cliente en la app", líder, etapa, días (ámbar desde 15, rojo desde 60), qué falta y el botón **Subir documentos**. Ese botón abre un drawer con el campo RIF (etiqueta arriba): si el RIF no existe, se crea el cliente y la orden queda unida; abajo, las casillas de documentos y "Enviar a revisión". Todo con bitácora.
- **Revisión (Legal)**: cola por antigüedad; cola por tipo de documento; revisados por semana; estatus legal por segmento.
- **Migraciones**: confirmadas por mes; confirmadas por líder; hueco "Cambios a residencial" (sale de la parte A1).
- **Factibilidad**: resultado de las consultas; por tipo de cliente; **demanda sin red por zona** (consultas sin red agrupadas por zona o ciudad, barras horizontales de mayor a menor, número "Zonas con demanda sin red"; sirve como indicador para expandir la red; al tocar una zona se ven sus consultas); hueco "Terminan en venta".
- **Dedicados**: contratos por tipo (servicio, VGT, colocation), con la marca "sin fecha de vencimiento"; estatus legal por tipo; activos por tipo; **hueco "Ingresos de dedicados"** (Por armar: ahí irán facturación, cobranza y por cliente).
- **Aliados**: embudo (solicitudes, aprobadas, instaladas, pagadas) con estado vacío; hueco "Aliados más activos".

**Gerencia** (`Gerencia.dc.html`)
- Inicio propio, solo lectura, filtros Período y Comparar con. Tarjetas: instalaciones (grande, 12 meses), en el año, órdenes sin instalar, comisiones del corte, expedientes completos, migraciones, dedicados, calidad de la venta ("siguen habilitadas"), estatus legal, hueco de ingresos de dedicados y la lista de sus avisos.
- Cada tarjeta abre el Resumen de su módulo en solo lectura (sin botones de acción).

## Parte C · Arreglos cortos de gestión (sin maqueta, con el estilo actual)
1. **Instalaciones sin líder.** Atajo "Sin líder" en la Lista de Comisiones y acción "Asignar líder" para varias a la vez (elige el líder, confirma, bitácora por cada una). Hoy hay 57 de octubre sin líder y no comisionan.
2. **Fechas de contratos de dedicados.** Ningún contrato tiene `vence_en` (está en `vence_texto` y `fecha_texto`). Convertir a fecha lo que se pueda leer sin dudas, con bitácora; lo que no, queda en la lista "Revisar fecha" de Dedicados para ponerla a mano.
3. **Avisos activos.** Solo 2 teléfonos tienen avisos. En Inicio, una tarjeta "Activa los avisos en este teléfono" (con "Ahora no") para quien no tenga suscripción, y en Usuarios una columna "Avisos" (activos o no) para el administrador.
4. **Guía de pruebas.** Actualizar `claude/guia-pruebas.md` con lo de este lote, cuenta por cuenta.

## Fuera de esta corrida
Aviso de prueba (va con la presentación), módulo de solicitudes VGT, pantalla de correos, auditoría masiva de la IA, correo al cliente con constancia y tabla "Copiar datos" de Legal.

## Al terminar
Pruebas de `pruebas/` más las nuevas (resumen, detalle, sin instalar, drawer con RIF nuevo, asignar líder en lote, fechas de contratos, permisos del líder y de gerencia); capturas en 1366x768 y en iPhone; los números del Resumen contra los de las maquetas; una revisión independiente al final; subir `?v=`; commit y push a main; actualizar `claude/traspaso.md`. Sin nombres ni datos reales en el repo.
