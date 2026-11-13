# Consejo 13/11: Comisiones (vista del líder y Resumen)

Tres revisiones independientes (UX del líder, gráficos del Resumen, reglas y datos en la base). Pendiente de decisiones de Gualfredo y maqueta.

## Errores de datos encontrados (no son de diseño)
1. `comisiones_resumen` no filtra por rol: el líder ve números de toda la empresa, el ranking con nombres y el monto total.
2. A la Lista del líder le llegan todas las instalaciones de aliados de la empresa (`comisiones_lista` líneas 16-19); se suman a su tarjeta Instalaciones PYME y a Cartas (`comisiones.js:70, 74, 142, 144`).
3. `migCorte()` nunca se pinta (`comisiones.js:410`: `filtro` siempre trae valor): las migraciones del líder no se ven en su lista.
4. Instaladas (66) incluye aliados (12) y sin dueño (9); Equipos no cuenta sin dueño; Comisionan + Esperan (69) no da Instaladas (66): mezclan poblaciones (corte anterior, aliados, sin dueño).
5. Equipos compara contra octubre COMPLETO; las tarjetas contra octubre a la misma fecha.
6. "Instaladas por corte": "cumplen" incluye lo del corte anterior y "total" no, la parte "No comisionan" sale mal.
7. Por instalar en horas de reloj (8 a 22): "más de 7 días" son unos 12 días de calendario; las etiquetas engañan. Lo "del corte" se decide por la última orden pero las horas desde la primera.
8. Monto del corte excluye migraciones que sí se pagan (en octubre cumplieron 18).
9. Dueños sin perfil caen en 'corporativas' por defecto (`com_base` línea 8): uno sin perfil (instalador "mb-02") podría salir "Líder del mes".
10. Ranking de aliados por texto del instalador sin normalizar: un aliado escrito de dos formas sale dos veces.
11. Las funciones de Comisiones viven solo en la base (aev2), no en `supabase/migraciones/`: hay que respaldarlas en el repo.
12. Barra del ranking (filas 4 en adelante): el tramo vacío sale negro y se lee como dato.

## Propuesta: vista del líder
- Arriba, una franja de números tocables: instaladas · comisionan · deben documentos · deben el pago · cambios de categoría; día límite a la derecha.
- Se quitan: Equipo, Por dueño | Por fecha, Por asignar, grupo con su propio nombre. Queda: buscador · Todas · Comisionan · Faltan documentos · Falta el pago · Cambios de categoría · ··· (Fechas, Del corte anterior).
- Lista plana por secciones: Se pierden el 18 · Les falta algo · Cambios de categoría · Ya comisionan.
- Cada fila dice qué falta con nombre: "Faltan: cédula y RIF del representante", "Legal la devolvió: acta", "Debe la instalación", "Pago por revisar"; acción "Subir documentos" cuando le toca a él. Carta en gris: "La envía Canales".
- Teléfono: título y corte en una línea, números en 2 columnas, buscador fijo con "Filtrar" en hoja inferior, tarjetas por cliente con las pastillas y "Subir documentos" a todo el ancho.
- Resumen del líder: su número contra el corte pasado, su posición, lo que le falta para cobrar y lo que pierde el 18. Sin Equipos, Monto de la empresa ni Cartas.
- Servidor: la lista trae `falta` y `devuelto` por fila; no le llegan aliados; resumen filtrado por rol.

## Propuesta: Resumen (administrador)
- Banda clara (no negra) "Ganadores de octubre" con 3 bloques iguales: Ventas corporativas, Canales de atención, Aliado comercial; en teléfono apilados.
- Tarjetas solo del equipo corporativo, cada una con número, flecha y % contra el corte anterior al mismo día del corte: Instaladas del corte · Ya comisionan (N de M con barra) · Órdenes atrasadas · Días de orden a instalación (si sube, flecha roja).
- Ranking: pestañas Líderes | Canales | Aliados comerciales con su escala; "7 instaladas · 0 comisionan"; fondo de barra gris claro.
- Equipos: dos barras por equipo (este corte al día N contra octubre al día N) con %; aliados separados por una línea; leyenda "Comisiona · Pendiente · Octubre al mismo día".
- Instaladas por corte: selector "Ritmo del corte" (línea acumulada día a día: este corte, el anterior y el promedio de 3) y "Cortes cerrados" (6 cortes apilados: Comisionaron · Pasaron al siguiente · Se perdieron).
- Por instalar: días de calendario; Al día (<1) · Atrasadas (1 a 3) · Muy atrasadas (4 a 9) · Perdidas (10 o más, o de antes del corte) en renglón aparte.
- Monto: una barra "480 $ posibles" = Asegurado (verde) · En juego (ámbar) · Última oportunidad (rojo); incluye migraciones que pagan.
- Cartas: igual, subtítulo "Instaladas del corte".
