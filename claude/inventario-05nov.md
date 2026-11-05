# Inventario de funciones (lote 05/11)

Regla 1 del lote: ninguna función se quita. Por cada pantalla que toca el lote: lo que había (v69 y v66, ver `auditoria-v66-v67.md`) y dónde queda después.
Columna "Queda": **igual** (no se tocó), **movido a …** o **nuevo**. Se marca ✔ cuando la prueba o la captura lo confirman al final del lote.

## Expediente, pestaña Documentos (`ficha.js`) · Parte C
| Función de hoy | Queda |
|---|---|
| Resumen "Faltan N" con "Pedir lo que falta" (pedir/recordar al cliente) | igual, arriba |
| Revisar N (`revisarTodo`), Aprobar seleccionados / Elegir todos / Aprobar N | igual |
| Aviso "Aprobado, documentos por subir" | igual |
| Bloque Revisión con IA: Mandar a revisión con IA, Revisar de nuevo, Reanudar, Reintentar, Actualizar resultado, Conceder excepción, Quitar excepción, puntos que cumplen | igual (los puntos ahora también alimentan el panel "Revisión del expediente") |
| Barra "Revisión en curso" con Cerrar revisión (`abrirCerrarRev`, enviar o solo cerrar) | igual; el panel nuevo aplica sus puntos antes de cerrar |
| Subir varios (`subirVarios`): marcar qué trae cada archivo | igual; un archivo en varias casillas se sube una vez (nuevo) |
| Estado de la subida, enlace a la carpeta de Drive | igual |
| Representante N: contacto (teléfono y correo), cédula, RIF personal, Quitar representante, Agregar representante | igual + nuevo: Firma este, No está en la junta, Ya no aplica, Volver a contar |
| Empresa: correo de la empresa, RIF de la empresa, acta constitutiva, Conatel (ISP), actas de asamblea, Agregar acta de asamblea | igual + casillas pedidas en rojo con el nombre completo y "Quitar pedido" |
| Otros documentos y "Otro documento" (con título) | igual + Cambiar título y Convertir en acta |
| Historial de revisiones | igual |
| Hoja "Ver documento": ver, abrir en Drive, bajar, reemplazar, Aprobar / Aprobar y seguir, Devolver (motivo y nota), Quitar marca, fecha del acta, vencimiento, OCR | igual; Devolver pasa a "Devolver o Pedir" (1b); en actas: casilla "Esta acta cambia la junta" (1c) |
| Pestañas Datos, Hilo, Comisión, Contrato, Dedicado/VGT | igual (VGT por solicitud en la parte F) |
| Nuevo | Panel "Revisión del expediente" (Bien / Pedir / Revisar por punto), "Qué pedirle al cliente" para el líder |

## Mi trabajo (`buzon.js`, `trabajo.js`, `revision-lote.js`) · Parte D
| Función de hoy | Queda |
|---|---|
| Índice de tarjetas por grupo, Lo más urgente, checklist con Ir, tachado "Se quitó de tus pendientes" | grupos plegables con su número; Ir dice el destino |
| Gestiones desde la lista, notas personales con Deshacer | igual |
| El equipo (solo consulta), elegir persona (administrador, Senior, coordinador) | igual |
| Tablero de Legal por etapa | abogado: Por elaborar por tipo (ISP, corporativo, VGT, PYME) con filtros |
| Revisión en lote (`trabajo.html?v=lote`): filtros de la IA, Solo el corte, aprobar, devolver, leer con IA, abrir en Drive, uno por uno | igual; "Revisar aquí" usa el mismo panel de la parte C |
| Nuevo | Buscador por RIF o nombre, aviso "Qué cambió" con Entendido, Marcar hecho donde no hay acción en otro lado |

## Comisiones (`comisiones.js`, `por-instalar.js`) · Parte E
| Función (v69 y v66) | Queda |
|---|---|
| Tarjetas, pestañas por equipo, avisos Por instalar y Por asignar, grupos por dueño | igual |
| v66: secciones "Último corte: si no cumplen se pierden" y "Cumplieron" | vuelven dentro de cada dueño |
| v66: confirmar o elegir la orden, "¿Es este cliente?", elegir dueño del provisional (hoy solo en Por instalar) | vuelven a la hoja (Cliente y orden de Odoo) |
| v66: marca "ya fue enviada" de carta y proforma | vuelve: "Ya enviada (marcar)" y la etiqueta en la fila |
| Hoja: Legal (subir, aprobar a mano, firma digital/física), Pago (se pagó allá), Carta y proforma (WhatsApp, PDF, correo), Más acciones (cambiar corte, excepción, evento, no comisiona, nota), Hilo | igual, en secciones plegables (falta en ámbar abierta, listo en verde plegado); acciones extra como botones |
| Nuevo | Bloque Migraciones del corte, "Ver expediente completo", "Contactar a la líder", IP "Lo más parecido" |

## Clientes y Dedicados (`clientes.js`, `ficha.js`) · Parte F
| Función de hoy | Queda |
|---|---|
| Clientes: lista, tarjetas, filtros, buscador, Resumen | igual |
| Nuevo | "+ Registrar dedicado nuevo" con tarjetas de dedicados y en la búsqueda sin resultados |
| VGT: 2 pólizas y propuesta comercial a nivel de cliente | pólizas por cliente; propuesta y planillas por solicitud; "+ Nueva solicitud" |

## Actualizar (`actualizar.js`) · Parte G
| Función de hoy | Queda |
|---|---|
| Soltar archivos, reconocer, cargar, TAD corto con "Cargar igual", Seguir con el índice, Solo para aliados, Cruzar ahora, Guardar cruce, Qué toca actualizar, historial, mapa de red | igual ✔ (test49, test12, test27) |
| Nuevo | índice en segundo plano, casilla del índice, "Seguir solo con el índice", fila del índice en Qué toca, "Sin fechas" en rojo ✔ (test49, test51) |
