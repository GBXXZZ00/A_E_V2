# Lote G: datos accionables, tablero gerencial, vista del gerente y modo práctica (APROBADO 23/10)

Va DESPUÉS del lote S+A+C+D+E+F (`claude/lote-seguridad-avisos.md`). Orden acordado con el administrador:
1) este lote, 2) pruebas por rol con cuentas de prueba, 3) ajustes, 4) presentaciones en vivo.

**Maqueta primero** (regla del proyecto): G1 y G2 se muestran en maqueta (escritorio 1366x768 e iPhone) y se aprueban antes de tocar archivos reales. G3 y G4 se describen en una lista corta para aprobar.

## G1. Números accionables en cada módulo
Una franja arriba de cada módulo con los números del mes que importan **para quien mira** (admin, Senior, líder, analista, abogado, aliado, gerencia). Reglas:
- Cada número es un botón: al tocarlo **filtra la lista** de abajo o abre la cola de "qué hacer" de ese grupo. El que está activo se marca; tocarlo otra vez quita el filtro.
- Máximo 4 números en teléfono (deslizables) y 6 en escritorio. Un número en rojo o ámbar solo si pide acción.
- Debajo de la franja, **"Para hoy"**: las 3 a 5 acciones más urgentes del módulo con su botón directo (subir, revisar, llamar, contactar al responsable).
- Comparativa corta con el mes anterior ("+3 vs septiembre") donde tenga sentido.
- Todo sale de una sola RPC por módulo (`modulo_resumen(p_modulo, p_corte)`), cacheada 2 minutos, sin bloquear la lista.

Contenido mínimo por módulo (ajustar en la maqueta):
- **Inicio / Mi trabajo:** pendientes de hoy, vencidos, avisos sin leer, gestiones activas con avance.
- **Clientes:** con documentos completos, por subir, devueltos, por revisar, sin contrato, en gestión.
- **Comisiones:** instaladas en el corte, cumplen, sin Legal, sin pago, por asignar, días para el cierre; por líder para admin/Senior.
- **Migraciones:** por revisar, por emitir, por confirmar, confirmadas en el corte, cambios a residencial (negativo).
- **Revisión (Legal):** por revisar hoy, devueltos esperando, bloqueados por IA, excepciones pedidas, tiempo promedio de revisión.
- **Factibilidad:** consultas del mes, con red, vendidas, sin interés.
- **Dedicados:** ISP y corporativos activos, en actualización de datos, VGT en uso (postes), deben pólizas, pólizas por vencer, contratos sin archivo o sin vencimiento.
- **Aliados:** solicitudes, aprobadas, bloqueadas, instaladas, pagadas.
- **Actualizar:** última carga de cada fuente y su antigüedad (ámbar si pasa de N días).

## G2. Tablero gerencial (módulo Gerencia, para Iván, y útil para todos en parte)
Diseño de primera, denso y claro (estilo panel B2B del proyecto, Chart.js, grid asimétrico, sin tarjetas iguales en fila).
- **Filtros arriba:** período (mes calendario o corte de comisiones), comparar contra (mes anterior, mismo mes del año pasado, promedio de 3 meses), líder, sucursal, segmento (PYME, dedicado ISP, dedicado corporativo, aliado).
- **Bloques:**
  1. Instalaciones: del mes y del corte, comisionables, por líder (top y comparativa), tendencia 6 meses.
  2. Calidad de la venta: perdidas, churn de infancia y churn real, reactivados. **Regla del administrador (23/10):**
     - Se mide con marcas de tiempo por servicio: fecha de instalación, fecha de la ÚLTIMA suspensión y fecha de la última habilitación.
     - **Churn de infancia:** la última suspensión ocurrió dentro de N días desde la instalación (N ajustable, por defecto 90) y NO hubo habilitación después.
     - **Churn real:** la última suspensión ocurrió después de esos N días y NO hubo habilitación después.
     - Si el servicio se habilitó DESPUÉS de su última suspensión, NO es churn: es **reactivación** (se cuenta aparte como "reactivados").
     - Hoy la base NO guarda el historial de estados con fecha (solo el estado actual del TAD). Hace falta: (a) tabla `servicio_estados` que registre cada cambio de estado entre cargas del TAD con la fecha de la carga (desde ya, para tener historia), y (b) si Proham tiene un reporte de suspensiones y reconexiones con fecha, una fuente nueva en Actualizar que lo cargue con la fecha exacta (el administrador confirma si existe). Mientras no haya historia suficiente, el bloque dice "en construcción" y no inventa cifras.
  3. Tiempo de instalación: de la orden de Odoo a instalada (mediana y percentil 90), órdenes vencidas sin instalar, reprogramaciones.
  4. Cambios de categoría: migraciones a PYME (positivo) y cambios a residencial (negativo), por líder.
  5. Comisiones: cumplen vs no cumplen y por qué (Legal, pago, orden), monto del corte, excepciones.
  6. Expedientes: % de clientes con documentos completos por segmento; dedicados en actualización de datos; VGT en uso y pólizas.
  7. Aliados: embudo solicitudes → instaladas → pagadas.
- Cada gráfico y número se puede tocar para ver la lista detrás (drill-down) con exportar a Excel.
- **Permisos:** gerencia y admin ven todo; Senior ve todo menos montos si se decide; un líder ve su propio tablero (mismos bloques, solo lo suyo) y su posición sin ver montos de otros.
- Enfoque acordado para presentar al jefe: resaltar positivos; lo que falta se llama "actualización de datos".
- Revisar qué de esto ya existe en `gerencia.js` (RPC `gerencia_hechos`) y reaprovecharlo.

## G3. Qué ve el gerente en cada módulo y sus avisos
- Gerencia es **solo lectura** en todos los módulos: ve las franjas de G1 con la vista "todo el equipo" y puede abrir listas y fichas, sin botones de acción.
- Avisos del gerente (pocos y de valor; resumen, no detalle):
  - Resumen semanal (lunes 8:00): instalaciones, comisionables, perdidas y comparación con la semana anterior.
  - Cierre de corte certificado: total y monto.
  - Alertas: orden de instalación con más de N días sin instalar (por defecto 15), caída de instalaciones mayor a 20 % vs el promedio, póliza VGT vencida.
- La lista final de avisos se aprueba en la lista corta antes de programar.

## G4. Modo práctica (para las presentaciones en vivo y la capacitación)
Objetivo: en la presentación, cada asistente escanea un QR, instala la app, entra con su usuario y practica con casos **precargados**, y le llegan avisos en vivo cuando el presentador toca un botón.
- **Datos de práctica aislados:** clientes, migraciones, documentos y comisiones marcados `practica = true`, con nombres claramente ficticios ("PRÁCTICA – Panadería La Esquina"). NUNCA cuentan en comisiones, tableros, conteos, Gerencia ni avisos reales, ni se suben a Drive real.
- **Interruptor por usuario** "Modo práctica" (cinta de color fija arriba: "Estás en modo práctica"). Al activarlo, cada módulo muestra solo los casos de práctica de ese usuario.
- **Casos precargados por rol** (cada usuario recibe su copia al activar):
  - Líder: registrar un cliente con documentos de ejemplo listos para subir (RIF, cédula, acta en PDF de muestra), una migración a PYME casi completa, una comisión que no cumple por Legal, un aviso para contactar al responsable.
  - Analista: una migración aprobada para cargar en Proham y marcar hecha, una bienvenida y proforma por enviar, una IP por confirmar.
  - Legal: documentos por revisar (uno bueno, uno vencido, una junta vencida con excepción posible).
  - Aliado: una solicitud con su RIF de ejemplo hasta la instalación.
  - Gerencia: tablero con datos de práctica.
- **Botón del presentador** (solo admin): "Enviar aviso de práctica" a todos los que están en modo práctica (o por rol), con textos de ejemplo que abren el caso exacto; "Reiniciar práctica" deja todos los casos como al inicio.
- **Instrucciones dentro del caso:** cada caso de práctica muestra un recuadro "Paso 1 de 4: sube el RIF…" que avanza al cumplir el paso.
- Al terminar la presentación: "Salir del modo práctica" y los datos de práctica se borran solos a los 7 días.

## Después de este lote (no programar todavía)
- Guía de pruebas por rol y cuentas `prueba.lider`, `prueba.analista`, `prueba.abogado`, `prueba.aliado`, `prueba.gerencia` (las crea el administrador).
- Presentación HTML en vivo por público (líderes, analistas y canales, gerente; aliados al final con piloto), con QR de instalación, lámina "instala la app primero" (iPhone) y botón de aviso en vivo. La arma Claude en el chat del proyecto cuando el lote esté probado.
