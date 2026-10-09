# Módulo Factibilidad: lo que hay que construir

Aprobado por el administrador el 09/10/2026. Maqueta aprobada: `claude/maquetas/factibilidad-f1.html` (ábrela en el navegador y síguela; los nombres y códigos son de ejemplo).

## Qué es
Dice si una ubicación tiene red, usando el mapa de proyectos de ingeniería (un archivo KMZ). El líder recibe la ubicación del cliente por WhatsApp y la consulta sin abrir Google Maps ni copiar coordenadas. Cada consulta queda guardada y se vuelve a revisar sola cada vez que se sube un mapa nuevo; si cambia, avisa al líder.

## Decisiones del administrador
- Al consultar SÍ se pide el tipo de cliente: PYME o Dedicado. Cambia las reglas de distancia.
- La "posible excepción" sale solo de las reglas de distancia. No hay flujo de aprobación: el resultado dice que confirme con ingeniería.
- Un líder del equipo propio puede vender en cualquier zona. Zona exclusiva de un aliado: se puede instalar, solo se avisa "Zona exclusiva de [aliado]". Planta Externa: el aviso es para el aliado, que ahí no puede instalar.
- Nombre, teléfono y RIF del prospecto son opcionales.
- El historial de consultas de la app vieja NO se migra.
- El texto para la orden de Odoo es un bloque opcional, plegado, con botón Copiar. Formato: `INST. PROMO PYME NOMBRE J000000000` (RIF sin guiones con su letra; si no lo llenó, queda el relleno).
- El mapa nuevo lo sube el administrador desde la pantalla Actualizar, arrastrando el KMZ, sin Python.
- Las zonas se toman tal como vienen en el mapa: no se renombra ni se concilia nada a mano.
- Excepción de stack aprobada: Leaflet por CDN para el mapa.

Decidido por Claude, sin confirmar:
- Los aliados no usan Factibilidad hasta que exista el módulo de aliados.
- El líder ve solo sus consultas; admin y analistas ven todas; abogado no entra.
- Código de vendedor: un número por usuario, campo nuevo en Usuarios (`perfiles.codigo_vendedor`), que se agrega al final del texto de Odoo solo cuando la orden la crea otra persona.

## Reglas del motor (deterministas, en el servidor)
- Dentro de una zona operativa: Hay red.
- Dentro de una zona en diseño: En espera. PERO primero se mide la distancia a la zona operativa más cercana: un Dedicado dentro de diseño a menos de 2 km de red es Posible excepción, y una PYME dentro de diseño a menos de 400 m también. (La app vieja cortaba antes de medir: era un error.)
- PYME fuera de zona: a menos de 400 m del borde, Posible excepción; de 400 m a 2 km, En espera; a más de 2 km, Sin red.
- Dedicado fuera de zona: hasta 2 km, Posible excepción; más, Sin red.
- La distancia se mide al BORDE del polígono, no al primer vértice.

## Cómo viene el KMZ
- Es un zip con `doc.kml`. Ruta de carpetas: mapa > mapa > [En Operacion | En Desarrollo] > [Liberado | Exclusiva | Diseño | Construccion | Permiso VGT] > [ciudad] > [MDT ...kml] > [MDT ...].
- El estado sale de la CARPETA, no del color (el color solo como respaldo). Liberado y Exclusiva son operativas; Diseño, Construcción y Permiso VGT no.
- Mapa vigente al escribir esto: 1.961 polígonos y 1.932 puntos. Reparto: Liberado 1.507, Exclusiva 36, Diseño 416, Construcción 1, Permiso VGT 1. Una prueba debe verificar ese reparto cuando se suba el archivo real.
- El punto (MDT) y su polígono están en la misma subcarpeta; el nombre del punto puede no coincidir con el del polígono.
- La capacidad viene en el nombre del polígono: "XXX013 (792HP)" = 792 hogares.
- La exclusividad viene en la descripción del PUNTO ("MDT: ...", "Estado: ...", "Exclusividad: ..."). Valores: "Planta Externa" (con variantes de mayúsculas), nombres de aliados, y valores sucios en las liberadas ("Zona ...", "FALSO", "En Operacion", vacío). Normalizar con `normalizeStr()` a lista cerrada: liberada, planta_externa, aliado (guardando el nombre).
- El archivo real NO va al repo. Para las pruebas, arma un KMZ pequeño inventado con esa misma estructura.

## Tablas sugeridas (RLS activo, bitácora)
- `mapas_red`: cada KMZ subido (fecha del mapa, quién, cuándo, totales).
- `zonas_red`: un polígono por fila (mapa, mdt, estado, exclusividad, aliado, capacidad, ciudad, geometría). Sin PostGIS si no está: guardar los vértices y calcular en una función.
- `consultas_fact`: por líder (punto, enlace original, tipo de cliente, resultado, mdt, distancia, nombre, teléfono y RIF opcionales, estado de seguimiento, mapa con que se revisó).
- `consultas_fact_hist`: cambios de resultado por mapa.

## Pantalla (según la maqueta)
- Lista quieta con atajos: Ahora con red (solo si hay), Abiertas, En espera, Excepción, Cerradas. Marca NUEVO cuando cambió con el último mapa, con el estado anterior tachado. Al pie, la fecha del mapa y cuántas zonas.
- Web: botón "Nueva consulta". Teléfono: botón flotante "+ Consultar".
- Hoja de consulta: un solo campo "Enlace de Google Maps o coordenadas" (acepta enlace, decimales o grados/minutos/segundos), botón Pegar, "Usar mi ubicación" en teléfono, y el tipo de cliente. Errores debajo del campo.
- Carga con esqueleto. Resultado: bloque de color con el estado en grande y UNA frase:
  - Hay red: "Se puede vender. La zona tiene red activa."
  - Posible excepción: "Está muy cerca de la red, pero fuera. Confirma con ingeniería antes de vender."
  - En espera: "Todavía no hay red aquí. Queda en seguimiento: te avisamos si un mapa nuevo trae red."
  - Sin red: "No hay red cerca. Queda guardada por si la red llega más adelante."
- Debajo: MDT, distancia y capacidad; mapa con las zonas cercanas y leyenda; lista de MDT cercanos; "Mapa amplio" (otra hoja con todo lo que hay a 2 km, círculo de 2 km, capas y vista satélite).
- "Datos del cliente" plegado, todo opcional. Historial por mapa. Botones "Ya lo vendí" y "Ya no interesa". No hay botón Guardar: se guarda sola. "Copiar para el cliente" arma un mensaje corto de WhatsApp.

## Entrada desde WhatsApp
- No se puede hacer que un enlace de Google Maps abra esta app directo.
- Android con la app instalada desde Chrome: `manifest` con Web Share Target, así "Compartir" en WhatsApp ofrece la app. Pantalla de ayuda de una sola vez para instalarla.
- iPhone no deja que una app web salga en Compartir: al abrir, si hay un enlace copiado, ofrecer Pegar.
- Los enlaces cortos (maps.app.goo.gl) se resuelven en una función de borde. Sin confirmar que Google no la bloquee: si falla, pedir al usuario las coordenadas con un mensaje claro.

## Orden de construcción y criterio de listo
1. Base y motor, con una batería de puntos de prueba: dentro de liberada, dentro de exclusiva, dentro de Planta Externa, PYME a 240 m, PYME a 1 km, Dedicado a 1,5 km, dentro de diseño a 300 m de red, a más de 2 km.
2. Subir el KMZ en Actualizar, con resumen de qué cambió.
3. Pantalla y hojas según la maqueta, con capturas a 1366x768 y iPhone.
4. Revisión automática al subir un mapa nuevo, con la marca NUEVO.
5. Compartir desde Android y pegar en iPhone.
6. Después, en otra corrida: avisos al teléfono y cierre automático a "Vendida" cuando aparezca una orden de Odoo con ese RIF.
