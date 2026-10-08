# Pruebas de la app (Playwright, teléfono y escritorio)

Simulan Supabase con datos falsos: no tocan la base real y los PIN son inventados.

1. En la carpeta del repo: `python3 -m http.server 8765`
2. En otra terminal, desde `pruebas/`: `mkdir -p capturas && node test01.js` (y así con cada una)
3. Cada una termina con `TODO OK` o dice qué falló. Las capturas quedan en `pruebas/capturas/` (no se suben).

- `simulador.js`: el Supabase de mentira (acceso, perfiles, cambio de PIN y gestión de usuarios) y las ayudas comunes.
- test01: acceso. Equipo solo la primera vez y recordado, usuario recordado, PIN con teclado en teléfono y con casillas en escritorio, PIN errado, cuenta desactivada, equipo que no corresponde, sin internet, PIN temporal que obliga a crear uno nuevo, PIN fácil rechazado, cambio de PIN desde Inicio, Inicio según el rol y equipo de aliados en construcción.
- test02: Usuarios (solo administrador). Lista con estados, crear con errores debajo de cada campo, usuario sin acentos ni espacios, Generar PIN, editar, restablecer PIN, desactivar, no desactivarse a sí mismo, un líder no entra, y el texto de la base nunca se ejecuta como código.
- `mundo.js`: la base de mentira (clientes, documentos, hilo y comisiones con nombres inventados) y las mismas reglas del servidor en pequeño.
- test03: Inicio (corte, módulos, menú de cuenta, navegación) y Comisiones (grupos por líder, último corte, filtros, por instalar, cambiar de corte, el líder solo ve lo suyo, error y Reintentar).
- test04: Clientes (búsqueda, lo que ve cada rol), Pedir documentos por WhatsApp o correo, y la ficha: subir uno o varios, archivo que falla o no sirve, nota en el hilo, revisar, aprobar, devolver con motivo, régimen de firma, ISP, estatus, gestión del analista y pago manual.
- test05: Actualizar datos. Rechaza archivos que no son el TAD, muestra cuántos servicios y clientes trae, carga por lotes, limpia valores corruptos y fechas imposibles, deja historial, permite reintentar si falla y un líder no entra.
