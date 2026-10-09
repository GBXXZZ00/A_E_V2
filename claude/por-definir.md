# Lo que falta definir con el administrador y sus pendientes (09/10/2026)

Hasta el martes 13/10 el administrador casi no tiene uso disponible en su chat del proyecto. Mientras tanto, las definiciones se conversan AQUÍ, en Claude Code: pregunta de a pocas cosas, en simple, y anota cada respuesta en `claude/reglas-negocio.md`. No programes un módulo de esta lista hasta tener sus respuestas.

## 1. Revisión de documentos con IA (va de la mano con aliados)
Lo que ya se sabe:
- La IA solo lee y propone; el veredicto es determinista y vive en el servidor. Es una marca aparte del estatus legal (falta la columna).
- Corre en una función de borde que lee el archivo de Drive. Nunca pasan documentos reales por el repo.
- Lee el expediente completo. El nombre del representante lo llena ella, no una persona.
- Se ejecuta cuando el administrador lo decida, no sola al subir.
- Hay unos 2.460 archivos ya cargados; la mayoría de los clientes ya fue revisada por Legal, así que sirve de comparación para medir si la IA acierta.
- La app vieja usaba Gemini con la cuenta personal del administrador y funcionaba a medias. No hay presupuesto: el costo debe ser mínimo.
- Reglas del script viejo que deben pasar al servidor: vigencia de cédula y RIF, que los nombres coincidan entre cédula y RIF, que el representante aparezca en el acta, que la razón social del RIF coincida con el acta, régimen de firma (conjunta exige a todos los representantes; separada basta uno completo).
Por preguntar: qué proveedor y con qué clave; si se revisa por cliente con un botón o por lote; qué ve el administrador cuando la IA y Legal no coinciden; qué hacer con varios documentos escaneados en un solo archivo.

## 2. Módulo de aliados
Lo que ya se sabe:
- Los aliados no suben a Odoo: piden permiso, se revisan sus documentos y de ahí sigue todo. Hoy lo hacían en una app aparte.
- Un aliado puede instalar lo que otro registró. Si el cliente ya está en gestión de un líder o es TOP, el aliado queda bloqueado.
- En la base existe `privado.aliados_appsheet`: 79 expedientes viejos con su situación (instalado 70, pendiente_por_instalacion 3, instalado_sin_cliente 2, consulta 4). Son las "consultas viejas" y deben verse con el indicador de cuáles se instalaron.
- Sus documentos ya están en los clientes, subidos como "Aliado: nombre".
- Proforma y carta de bienvenida serán obligatorias en este módulo.
- En Factibilidad, Planta Externa es zona donde el aliado no puede instalar.
Por preguntar: qué ve y qué puede hacer un aliado al entrar; cómo pide permiso por un cliente y quién aprueba; si usa Factibilidad; cómo se le avisa que un cliente está bloqueado; si la IA revisa su expediente antes de que lo vea el administrador.

## 3. Migraciones y cambios de titularidad (el administrador dice que es sencillo)
- Migración: residencial que pasa a PYME. Se cobra, exige documentos y comisiona. Hoy llega por correo, él aprueba y el analista la emite a mano.
- Cambio de titularidad: el titular pasa de un nombre a otro; puede ir junto con una migración. El analista entrega una carta que el cliente llena.
- Idea del administrador: primero se registra la solicitud y, con ese registro, se evalúa cuando se cumpla en la base (comparando una carga del TAD con la anterior).
Por preguntar: quién registra la solicitud, qué documentos exige cada caso y cómo entra al corte de comisión.

## 4. Dedicados
No comisionan, pero pasan por aprobación y contrato. Falta todo, incluido su texto de Odoo.

## Pendientes del administrador
- Martes 13/10: subir el KMZ real en Actualizar; pasar el permiso de Google a producción (vence cerca del 15/10); cambiar el secreto de Google; seguridad de acceso, con él presente.
- Crear usuarios: el Analista Senior y los líderes con su WhatsApp y correo.
- Probar con el Analista Senior comisiones y expediente.
- Que el Analista Senior revise 6 clientes instalados por un aliado que figuran en cartera de un líder (dos de ellos con orden de Odoo del líder).

## Cabos sueltos de datos (se resuelven en el chat del proyecto, desde el martes)
- 4 expedientes de aliados sin rastro de instalación.
- Una carpeta de Drive de aliados con subcarpetas de código AL-, sin cliente identificado (59 archivos).
- 2 correos con error de tecleo que entraron tal cual.
- 12 carpetas de Drive con archivos cuyo RIF no existe como cliente.
- Decidir si se recalcula el estatus de 166 clientes cuyos documentos entraron por revisar.
- Borrar la tabla vacía `public.drive_inventario`.
- De dónde sale el líder de cartera en la carga del cruce (hay clientes instalados por aliado asignados a un líder).

## Más adelante
Mensajes al cliente por caso, correo desde el servidor, gestión de clientes viejos, avisos al teléfono, indicador de tiempo de instalación.
