# Lote 16/11 A (aprobado por el administrador el 16/11/2026)

Leer antes: `claude/matriz-cargos.md` y `claude/migraciones-proceso-16nov.md`.

Maquetas aprobadas: `claude/maquetas/lote-16nov/` (scripts `maq-migraciones.js`, `maq-solicitud.js`, `maq-comisiones.js`; capturas en `img/`). Están montadas sobre la app real del simulador, en PC 1366x768 e iPhone, con datos inventados. Se regeneran con el servidor arriba: `node claude/maquetas/lote-16nov/maq-migraciones.js` (igual las otras). Lo publicado debe quedar IGUAL a esas capturas. `img/solicitud-una-hoja-referencia.png` muestra el contenido de los pasos 1 y 2 de la solicitud cuando era una sola hoja: sirve para el contenido, no para la forma (la forma aprobada es por pasos: `sol-p3-*` y `sol-p4-*`).

## Cuidar el diseño (obligatorio)
- Medidas, textos, colores y espacios como en la maqueta. Compara maqueta | publicado de cada pantalla antes de publicar (como `pruebas/comparar-13nov.js`).
- No cambiar nada que este lote no pide. No quitar botones ni funciones que existen ("+ Nuevo cambio", Resumen, pestaña Por instalar, Enviar pendientes, etc.).
- Las filas nuevas de Comisiones usan las mismas clases de las filas actuales (`cx-lf`, `cx-fila2`, `cx-sec`). No rediseñar las filas.
- Dar aire: nada amontonado, nada de formularios largos (por eso la solicitud va por pasos). Probar cada pantalla como cada cargo, en PC y en teléfono.
- Las clases `mg-`, `ms-` y `mq-` de los scripts son de la maqueta: antes de crearlas en `app.css` busca si ya existe una equivalente.
- En teléfono, la nota "Las de más de 5 días están en Por instalar" queda en dos líneas en la maqueta: acortarla para que quepa en una.

## Parte 1. Reporte de cambios de categoría en Actualizar
- Fuente nueva de carga: Excel "Consulta Cambio de Categoría" (fila 1 título, fila 2 cabecera: Codigo, Nombre, Fecha dd-mm-aaaa, Categoria Anterior, Categoria Actual, Operador, Comentario). Se suelta junto con los demás archivos y se reconoce solo.
- Filtro en el servidor: descartar categoría nueva RECONEXION, RECONEXION 02, USO INTERNO, EMPLEADO, EXONERADO, 1GB - REACTIVACION; descartar activaciones (categoría anterior `056`, `058` o `002`, comentario "CHANGE PROFILE FROM RADIUS": son instalaciones nuevas); PYME a PYME es cambio de plan, no migración. Quedan: residencial a PYME (migración) y PYME a residencial (salida, en rojo).
- Cada fila útil se empareja por código de servicio con `cambios`: si ya hay un cambio registrado, le pone `fecha_cambio` y lo confirma; si no, crea o completa el `sin_registro` con `fecha_cambio`, categorías, comentario y `corte`. Los `sin_registro` que ya existen sin fecha (hoy casi todos, por eso no caen en ningún corte) se completan cuando el reporte los traiga. Repetidos del mismo servicio y día cuentan una vez.
- Dueño: 1) quien la registró; 2) líder del cliente; 3) nombre que aparezca en el comentario (solo sugerido, confirma el administrador); 4) Por asignar.
- Resumen de la carga: cuántas a PYME, cuántas sin registrar, cuántas salieron a residencial, cuántas descartadas.

## Parte 2. Migraciones rediseñado (`migraciones.html`, `cambios.js`)
Igual a `img/migraciones-*`:
- Aviso del reporte (hasta qué fecha, cuántas sin registrar, "Subir reporte" solo para quien puede actualizar) y "+ Nuevo cambio" al lado.
- Cuatro tarjetas. Administrador: Esperan tu decisión, Sin registrar, En curso, Confirmadas del corte. Líder: Te falta registrar, En revisión, En curso, Confirmadas del corte.
- Filtros en pastillas con número; "Por líder | Por fecha" (administrador, Senior, Coordinador y analistas).
- Lista agrupada por líder, plegable, con Enviar pendientes junto al nombre (misma regla de permisos de Comisiones). Dentro: bloque ámbar "Ya se hicieron y nadie las registró" y bloque "Registradas". Grupo "Por asignar" con las sin líder y las que pasaron a residencial (rojo).
- Fila: fecha y hace cuánto · cliente y documento · cambio (anterior → nueva) · estado con una línea de detalle · un solo botón con lo que toca (Revisar, Decidir, Recordar, Asignar líder, Registrar, Ver cliente).
- En teléfono las filas pasan a tarjeta como en la maqueta. El líder solo ve lo suyo.

## Parte 3. Solicitud de migración por pasos
Igual a `img/sol-p3-*` y `img/sol-p4-*`, con barra de cuatro pasos arriba: Servicio, Titular, Documentos, Enviar.
1. Servicio: buscar como hoy, o ya puesto si se entra desde "Registrar" de una sin registrar. Muestra el titular actual. Qué cambia: las cuatro opciones de hoy; cada una dice si comisiona. Si vino del reporte, un aviso recuerda lo que el reporte vio y que se elija "Migración y cambio de titular" si además cambió el titular.
2. Titular: a nombre de quién queda (Persona natural | Empresa). Se SUBE el RIF y se lee solo, como en Aliados (misma función de lectura); muestra razón social, RIF, domicilio y vencimiento, y avisa si ya es cliente o es de otro líder. No se escribe a mano.
3. Documentos: zona para arrastrar varios archivos juntos (en teléfono, elegir o tomar foto) y cada casilla también recibe el suyo. Persona natural: RIF y cédula. Empresa: el expediente de empresa de siempre. Aplica igual a migración de plan y a cambio de titular. Los archivos se guardan en el expediente del cliente (mismas casillas de Clientes); lo ya aprobado no se vuelve a pedir; si el titular nuevo no existe se crea el cliente. "Guardar lo que llevo" deja el borrador en los pendientes del líder.
4. Enviar: aviso "En verificación" con los cuatro momentos y el recuadro de la planilla (Descargar planilla, Enviar por WhatsApp).
- La planilla es la de cambio de titular que ya existe (`assets/plantillas/cambio_titular*`). Sale llena con el titular actual y el nuevo, y se puede descargar desde que se envía la solicitud. Es obligatoria para hacer el cambio, pero NO entra en la revisión del administrador.
- Sin IA en este flujo: el administrador revisa a mano con la pantalla de revisión existente (Bien, Devolver con motivos) y aprueba o no la migración. Al aprobar: pasa a los pendientes (Mi trabajo) del analista asignado al líder, que hace el cambio en el sistema; si ya estaba hecha, salta ese paso.
- Un cambio de titular solo no comisiona; comisiona el cambio a PYME. La comisión la deciden el administrador o la Senior, como hoy.
- Después de confirmada sigue como una instalación: contrato con Legal, proforma y carta de bienvenida (hoy la regla las excluye: cambiarla y anotarlo en `reglas-negocio.md`).

## Parte 4. Comisiones: bloques dentro del plegable del líder
Igual a `img/comisiones-*`:
- Bloque ámbar "Por instalar · órdenes de hasta 5 días · N" arriba de las instaladas: órdenes de Odoo abiertas sin instalación con hasta 5 días de reloj. Fila con fecha de la orden, cliente (o provisional), número de orden, "Sin instalar · lleva X" (rojo desde el día 4) y estado de documentos (Sin documentos, Faltan N, Documentos completos). Al tocar abre el mismo panel de la orden de "Por instalar" para subir documentos igual que una instalada. Las de más de 5 días siguen solo en la pestaña Por instalar.
- "Marcar como perdida" con motivo en el panel de la orden (bitácora; sale de las listas y queda en un filtro "Perdidas").
- Bloque azul "Migraciones · N": las sin registrar ("Faltan documentos") y las registradas con su estado. Reemplaza cómo se mostraban en el lote 13/11 dentro de la lista; al ordenar "Por fecha" llevan la etiqueta azul "Migración".
- Filtros nuevos en el renglón 2: "Por instalar" y "Migraciones" con número. Contador "N por instalar" en la cabecera del grupo.
- No tocar el cálculo de comisiones: huellas de septiembre, octubre y noviembre iguales antes y después.

## Parte 5. Permisos (ver `matriz-cargos.md`)
- Actualizar: administrador, Senior, Coordinador de analistas y analistas (también la coordinadora de canales). Líderes no.
- Factibilidad: todos los cargos; cada quien ve lo suyo.
- Gerencia (marca gerencia): entra a todos los módulos en solo lectura (Comisiones, Clientes, Migraciones, gestiones, Aliados con la etiqueta de cliente carterizado cuando un aliado instala un cliente con líder). Todos pueden abrir la pantalla Gerencia.
- Aliados para líder, analistas y Legal: quitar las solicitudes ajenas. Solo ven lo suyo: solicitudes bloqueadas por ser de su cartera o top, y clientes suyos que instaló un aliado. Cambiar el texto "Lo que espera tu decisión..." por uno que diga eso. Validado en el servidor, no solo en pantalla.
- Aliado: no abre Clientes; solo la ficha de su cliente instalado, desde Aliados.
- Coordinador de analistas: igual que la Senior.

## Parte 6. Usuarios
- Columna "Analista" en la tabla (para líderes) y poder asignarlo sin buscarlo. Hoy el campo solo aparece al editar un líder ya creado, debajo de "Código de vendedor en Odoo".

## Pruebas
- Pruebas nuevas por parte: carga del reporte con el filtro, solicitud por pasos con los dos tipos de titular, bloques de Comisiones por cargo, permisos de la parte 5. Batería completa una vez al final. Capturas PC e iPhone de lo que cambió, comparadas con las maquetas.
- Probar como cada cargo: administrador, Senior, analista, líder, Legal, canales, aliado, gerencia. El simulador no trae un analista normal: agregarlo.

## Al terminar
Qué quedó, qué debe probar el administrador (lista corta por módulo) y qué quedó pendiente.
