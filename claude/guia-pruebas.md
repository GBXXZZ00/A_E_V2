# Guía de pruebas con el modo práctica (23/10)

El modo práctica es un mundo inventado que corre dentro del navegador del teléfono o la computadora. Con el modo encendido la app **no habla con el servidor**: nada de lo que se haga toca clientes, comisiones, avisos ni Drive reales (lo comprueba la prueba `pruebas/test48.js`). Arriba sale la banda amarilla "Modo práctica" con **Guía** y **Salir**.

## Cómo entrar
- **Con una cuenta de práctica** (en la pantalla de acceso, equipo Ventas o Aliados): `pruebaadmin`, `pruebalider`, `pruebaanalista`, `pruebaabogado`, `pruebaaliado`, `pruebagerencia`. Todas usan el mismo PIN temporal (te lo da el administrador; no se escribe aquí) y piden crear uno propio al entrar.
- **Con tu cuenta normal**: menú de tu cuenta → **Modo práctica**. Entras como la persona de práctica de tu mismo rol, sin PIN. Para volver: **Salir** en la banda y entra con tu PIN de siempre.
- Lo que hagas queda guardado en ese dispositivo. Cada teléfono tiene su propio mundo: los avisos de práctica se ven en la campana del mismo dispositivo (sal y entra con la otra cuenta para ver lo que le llegó).

## Qué probar por cuenta
| Cuenta | Abre | Revisa |
|---|---|---|
| pruebaadmin | Clientes → un expediente "en revisión" | Aprobar o devolver documentos; el recuadro "Caso de práctica" dice qué hacer |
| pruebaadmin | Panel | Tocar un módulo, cambiar "Mes a mes" / "Año contra año", tocar una barra, tocar "Vencidos" |
| pruebaadmin | Banda → Avisos de práctica | Mandar un aviso a Líderes; Reiniciar práctica deja todo como al inicio |
| pruebalider | Campana | El aviso del administrador y "Un aliado pidió tu cliente" |
| pruebalider | Clientes → expediente | Subir un documento que falte, "Contactar" con el mensaje escrito |
| pruebalider | Panel | Ve solo lo suyo, sin filtro de líder |
| pruebaaliado | Aliados → solicitud nueva | Subir el RIF (en práctica sale un cliente del líder de práctica) y enviarla |
| pruebaanalista | Comisiones, Migraciones, Panel | Revisar el corte, seguir un cambio, filtrar el Panel por líder |
| pruebaabogado | Revisión | Revisar documentos y contratos por firmar |
| pruebagerencia | Panel y Gerencia | Todo en solo lectura |

## Lo que no está en práctica
- No llegan notificaciones push al teléfono (solo la campana dentro de la app).
- La lectura con IA y el OCR no se corren: dicen "En práctica no se lee el archivo".
- Si algo dice "Esto no está en el modo práctica todavía", pruébalo con tu cuenta normal.
