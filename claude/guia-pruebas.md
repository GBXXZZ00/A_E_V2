# Guía de pruebas con el modo práctica (23/10, al día con el lote 27/10)

El modo práctica es un mundo inventado que corre dentro del navegador del teléfono o la computadora. Con el modo encendido la app **no habla con el servidor**: nada de lo que se haga toca clientes, comisiones, avisos ni Drive reales (lo comprueba la prueba `pruebas/test48.js`). Arriba sale la banda amarilla "Modo práctica" con **Guía** y **Salir**.

## Cómo entrar
- **Con una cuenta de práctica** (en la pantalla de acceso, equipo Ventas o Aliados): `pruebaadmin`, `pruebalider`, `pruebaanalista`, `pruebaabogado`, `pruebaaliado`, `pruebagerencia`. Todas usan el mismo PIN temporal (te lo da el administrador; no se escribe aquí) y piden crear uno propio al entrar.
- **Con tu cuenta normal**: menú de tu cuenta → **Modo práctica**. Entras como la persona de práctica de tu mismo rol, sin PIN. Para volver: **Salir** en la banda y entra con tu PIN de siempre.
- Lo que hagas queda guardado en ese dispositivo. Cada teléfono tiene su propio mundo: los avisos de práctica se ven en la campana del mismo dispositivo (sal y entra con la otra cuenta para ver lo que le llegó).

## Qué probar por cuenta
| Cuenta | Abre | Revisa |
|---|---|---|
| pruebaadmin | Clientes → un expediente "en revisión" | Aprobar o devolver documentos; el recuadro "Caso de práctica" dice qué hacer |
| pruebaadmin | Clientes → Resumen | Los 4 números; Mes a mes / Año contra año; tocar una barra, un tramo del estatus legal y un número: sale el panel con la lista, "Exportar a Excel" y "Ver todos en la lista" |
| pruebaadmin | Clientes → tarjeta Dedicado → Resumen | Cambia al Resumen de Dedicados; el atajo "Revisar fecha" muestra los contratos sin vencimiento |
| pruebaadmin | Comisiones → Sin instalar | Días en ámbar desde 15 y rojo desde 60; "Subir documentos": escribir un RIF que no existe pide el nombre y crea el cliente; "Cambiar días" del aviso |
| pruebaadmin | Comisiones → Sin líder | Marcar varios, "Asignar líder", elegir y confirmar |
| pruebaadmin | Usuarios | Columna "Avisos": quién los tiene activos en un equipo |
| pruebaadmin | Actualizar | Subir el mismo TAD dos veces: la segunda dice cuántas filas del índice cambiaron |
| pruebaadmin | Banda → Avisos de práctica | Mandar un aviso a Líderes; Reiniciar práctica deja todo como al inicio |
| pruebalider | Campana | El aviso del administrador y "Un aliado pidió tu cliente" |
| pruebalider | Clientes → expediente | Subir un documento que falte, "Contactar" con el mensaje escrito |
| pruebalider | Clientes y Comisiones → Resumen | Ve solo lo suyo; en Comisiones ve "Sin instalar" pero no "Sin líder" |
| pruebaaliado | Aliados → solicitud nueva | Subir el RIF (en práctica sale un cliente del líder de práctica) y enviarla |
| pruebaanalista | Comisiones, Migraciones | Revisar el corte, seguir un cambio, el Resumen de cada módulo |
| pruebaabogado | Revisión → Resumen | Cola por antigüedad y por documento; tocar una barra abre la lista |
| pruebagerencia | Gerencia | Tarjetas con Período y Comparar con; cada tarjeta abre el Resumen de su módulo en solo lectura, sin abrir expedientes |

## Lo que no está en práctica
- Los números del Resumen salen del mundo de práctica: la forma es la real, los números no.
- El Panel ya no existe: cada módulo tiene su Resumen (si alguien abre panel.html, va a Inicio).
- No llegan notificaciones push al teléfono (solo la campana dentro de la app).
- La lectura con IA y el OCR no se corren: dicen "En práctica no se lee el archivo".
- Si algo dice "Esto no está en el modo práctica todavía", pruébalo con tu cuenta normal.
