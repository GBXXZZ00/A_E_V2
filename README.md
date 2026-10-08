# A_E_V2

App interna. HTML, CSS y JavaScript puros, con Supabase como servidor.

- `index.html`: acceso (equipo, usuario y PIN) y cambio de PIN.
- `inicio.html`: accesos a los módulos según el rol.
- `usuarios.html`: cuentas del equipo, solo para el administrador.
- `assets/`: estilos, funciones compartidas, librería de Supabase y fuente.
- `pruebas/`: robots de prueba. Ver `pruebas/LEEME.md`.

Este repositorio no lleva claves secretas ni datos. La clave que aparece en `assets/js/supabase-client.js` es la pública; el acceso a los datos lo controlan el PIN de cada persona y los permisos por tabla.

Cada cambio sube el número `?v=` en los HTML y pasa las pruebas antes de publicarse.
