# Lote 10/11: Cargas, TAD y churn, IP, Aliados, Comisiones, Clientes, Usuarios y correo (APROBADO por el administrador el 10/11)

Salió de la revisión con el administrador del 10/11 (chat del proyecto). Todo lo que dice "Diagnóstico" se midió con la base real ese día.
Este repo es público: nada de datos reales en pruebas, capturas ni maquetas.

## Reglas para este lote (obligatorias)
1. Las 7 reglas del lote 05/11 siguen vigentes: nunca quitar una función (inventario antes y después), evidencia con consulta y captura, pruebas contra datos reales, una sola fuente por número, publicar por partes, sin guion largo.
2. Las partes marcadas con 🖼 tienen **maqueta APROBADA** en `claude/maquetas/lote-10nov/` (abrir los `.dc.html`; mandan sobre el texto si hay duda). El estilo final usa `base.css` y `app.css`. Se programa todo seguido, sin volver a pedir aprobación de diseño.
3. Orden de ejecución: A (datos) → B, C, D, E, F, H, I → G (correo) → batería completa y revisión independiente. Referencia de maquetas (copia en `claude/maquetas/lote-10nov/`, abrir los `.dc.html`; lienzo vivo del administrador: https://claude.ai/artifact/PjFwv7wpZ7yYfC8CuE8W8a). Las maquetas ya están APROBADAS: no hay que volver a hacerlas → B, C, D, E, F → G (correo) → batería completa y revisión independiente.
4. Comisiones: referencia `privado.comision_filas3` igual al empezar y al terminar (este lote no cambia el cálculo).

---

## Parte A · Datos y reglas (sin maqueta)

### A1. TAD: fechas de suspensión y activación
Diagnóstico: el TAD real trae las columnas **`ULTSUPENSION`** (así, sin la primera "s") y **`ULTACTIVACION`** (pegada), con fechas `dd-mm-aaaa`. `actualizar.js` busca `/susp/` y `ult_activ`, por eso las cargas del 30/10, 05/11, 09/11 y 10/11 dicen `con_fechas: 0`. La fecha **01-01-1900 significa "nunca"**.
1. Reconocer `ultsupension`, `ultsuspension`, `ultactivacion`, `ult_activacion` y los nombres que ya se aceptaban.
2. `01-01-1900` (y cualquier año menor a 1990) se guarda vacío.
3. Prueba con un TAD de ejemplo con esos encabezados y fechas, incluida 01-01-1900.
4. Después de publicar, el administrador sube el TAD y se verifica `con_fechas > 0` con consulta.

### A2. Reglas de churn (DECIDIDAS 10/11)
Por servicio se comparan: **Estado** del TAD (manda siempre), instalación (I), última suspensión (S), última activación (A).
1. **Habilitado** y (S vacía o A ≥ S): normal.
2. **Suspendido** con S − I ≤ 60 días: **churn de infancia** (cuenta como pérdida en el mes de S).
3. **Suspendido** con S − I > 60 días:
   - hasta 80 días suspendido (hoy − S ≤ 80): **posible pérdida**;
   - más de 80 días suspendido: **pérdida**, contada en el mes de S (DECIDIDO 10/11).
4. Si una posible pérdida o una pérdida vuelve a **Habilitado** (A > S): **Reactivación**, en el mes de A. Un mes ya cerrado no se recalcula.
5. **Fechas que contradicen el Estado** (Habilitado con S > A, Suspendido con A > S, Suspendido sin S): manda el Estado y el servicio se marca "fechas por revisar" (lista aparte para el administrador).
6. Retirado del TAD: baja definitiva (como hoy).
7. Diagnóstico con el TAD 31 (solo empresas en la app): 1.486 habilitados nunca suspendidos, 1.628 habilitados reactivados, 234 habilitados con fechas raras, 362 suspendidos (87 de menos de 30 días), 9 suspendidos con fechas raras. De las 362 pérdidas: 34 dentro de 90 días de la instalación.
8. Se enciende `churn_visible` solo después de revisar con el administrador los números del primer TAD con fechas. Documentar las reglas en `claude/reglas-negocio.md`.

### A3. IP
Diagnóstico del 10/11:
- El reporte "Clientes Empresariales" trae 2.642 IP con cliente; **2.621 ya están en su servicio correcto**.
- De las 15 IP que el administrador sacó a mano del sistema técnico (Framed-IP-Address, 10/11), **14 salen en el reporte como DISPONIBLE** (sin cliente, fecha 01-01-1900) aunque están en uso, y 1 sale ASIGNADA a otra ONT (la vieja del cliente). Causa probable: en el sistema técnico el campo "IP" del Detalle Administrativo está vacío; la IP solo aparece en el Detalle Técnico. Riesgo para el área técnica: el pool las da por libres.
- Hay un orden: las IP se asignan seguidas del pool según se instala (156.255.157.99 a .104 y .155 a .160 para instalaciones del 14/10 al 09/11).
- 62 servicios instalados desde el 01/10 seguían sin IP (26 ORO-EMP, 22 conectividad, 14 residencial o promo). Cruce por nombre aproximado: 0 candidatas libres.
- 10/11: se cargaron a mano las 15 IP (IPv4 e IPv6), `ip_mano = true`, con bitácora `ip_mano`.

Qué hacer:
1. Al cargar el reporte, guardar también las filas sin cliente (DISPONIBLE y ASIGNADO) con su IP, para que la hoja de IP de un servicio nuevo proponga **las siguientes IP del pool en orden** como "Posible IP, confírmala en el sistema técnico" y el analista elija con un toque (nunca se pone sola).
2. En la hoja de comisión y la ficha, "IP: falta" muestra el botón **Escribir IP** (IPv4 e IPv6, valida formato, `ip_mano`).
3. Pendiente de negocio (lo decide el administrador con su cotejo): qué categorías llevan IP. Hasta entonces, "Sin IP" sigue para todos.
4. Pedir al área técnica que el reporte incluya el cliente en esas filas (lo gestiona el administrador; no es código).

### A4. Reglas de la IA para aliados (DECIDIDAS 10/11)
1. **Correo que no se parece al nombre del representante:** en aliados es **observación** (no frena). En contratos sigue igual.
2. **Correo de la empresa que falta:** en aliados es observación (hoy bloquea: 5 de 10 corridas).
3. **Representantes:** basta **uno** que esté en la junta vigente, aunque la firma sea conjunta. No se le pide el segundo al aliado.
4. **Junta vencida pero el representante aparece en el acta:** **Lista con observaciones**: "Sube el acta de asamblea donde se ratifica la junta". No bloquea.
5. **RIF Digital:** si el RIF no trae vencimiento pero sí fecha de inscripción o de última actualización, es digital y vale, aunque la IA no marque el formato. Diagnóstico: de 58 RIF leídos, 10 salieron "No se leyó la fecha de vencimiento" y solo 6 se reconocieron como digitales.
6. **Lecturas fallidas** son lo más común (fecha no leída: actas 7, RIF personal 7, cédula 5, RIF empresa 3). Revisar el prompt de lectura de fechas y probar con esos archivos; si la fecha existe y no se leyó, es falla de lectura, no del documento.
7. Lo que sigue sin bloquear: domicilio distinto al RIF, duración vencida (como hoy).
8. **Velocidad:** cada documento tarda 14 a 34 s en leerse (modelo gemini-3.1-pro-preview; RIF y cédula 14 a 30 s, actas de 10 páginas 32 a 34 s). Probar un modelo rápido para RIF y cédula y dejar el pro para actas; medir antes y después con los mismos archivos.
9. Revisar las 21 reglas de `claude/ia-reglas.md` una por una y dejar en `claude/ia-reglas.md` una tabla "Contratos | Aliados" con lo que cambia para aliados. Subir VERSION en `reglas.mjs` y publicar `ia_revisar`.

### A5. Datos
1. Clientes duplicados por nombre (3 casos; la lista está en el traspaso del chat del proyecto, no en el repo). Buscarlos con una consulta de nombres normalizados repetidos, proponer la unión al administrador con lo que tiene cada ficha; no unir sin su OK.
2. Un cliente cuya descripción en el sistema técnico trae otro nombre (dato en el traspaso del chat): anotarlo como nota del cliente.
3. Odoo: medir con datos cuántas órdenes no cruzan con instalación y cuántas quedan sin dueño, y por qué. Informe antes de cambiar nada.
4. Verificar con captura que en Mi trabajo de Reina (abogado) salen primero los contratos ISP por elaborar (lote 05/11 parte D).

---

## Parte B · Subir lo del día 🖼
Diagnóstico: el 10/11 entraron bien TAD 31, Odoo e Instalaciones; el índice de residenciales (418.004 filas) terminó solo en 12 minutos; el 09/11 Instalaciones quedó anulada (177 filas) y el índice del 05/11 nunca cerró. El administrador no entiende qué pasa ni si debe "cruzar".
1. Una sola zona: se sueltan todos los archivos juntos; la app reconoce cada uno (TAD, IP, Odoo, Instalaciones, Dedicados).
2. Una fila por archivo con su avance: **Leído → Cruzado → Listo** y sus números (nuevos, actualizados, con fechas, sin cruzar). Error en rojo con qué hacer.
3. El índice de residenciales sale como fila propia "en segundo plano" con su porcentaje; se aclara que no hace falta tocar nada.
4. Sin botones de "Cruzar" sueltos: el cruce corre solo al terminar cada lectura. Si falta un archivo del día, se dice cuál.
5. Historial de cargas debajo (fecha, archivo, estado, números).

## Parte C · Clientes 🖼
1. **Revisión del expediente**: cuando el cliente no está en revisión, una sola línea "Revisión: N de M marcados · Abrir". El panel completo solo se despliega al revisar.
2. Las pestañas y plegables del drawer del cliente empiezan **cerrados**.

## Parte D · Comisiones 🖼
1. Una sola lista **Todos** por defecto, ordenada por fecha de instalación (nueva primero), con chips para filtrar por equipo (Ventas corporativas, Canales de atención, Aliado comercial) y por persona. Hoy el orden es confuso y obliga a entrar a cada pestaña.
2. **Aliados:** no hay subgrupos por aliado; cada fila lleva una etiqueta con el nombre del aliado y hay un filtro por aliado.
3. **Nombres repetidos** (hay dos "Oriana"): en etiquetas, filtros y rankings se muestra nombre y apellido o la inicial que las distinga.
4. Filtro **Desde / Hasta** además del corte.
5. **Agrupado por dueño** es la vista normal (como antes); **Lista por fecha** es la otra opción (maqueta 3c).
6. Las **tarjetas de arriba** mantienen el diseño actual de la app (número grande a la izquierda, título y detalle; la elegida con borde azul; Cartas y Por instalar en ámbar; Subir documentos de un cliente nuevo en azul) y **filtran** la lista al tocarlas (Cartas por enviar, Les falta algo, Por instalar, Por asignar), como antes.
7. El filtro de **líder o persona aparece solo al elegir un equipo** y muestra la gente de ese equipo.
8. **Opciones extra dentro de su sección** (maqueta 3d): Cambiar dueño y Elegir otra orden en "Cliente y orden"; sección nueva "Corte y comisión" con Cambiar de corte, Dar excepción, **Marcar como evento** y No comisiona; Escribir nota en el Hilo. Se quita "Más acciones". **Legal** conserva "+ Subir o arrastrar" en cada documento que falta o fue devuelto, "+ Agregar acta de asamblea", "+ Otro documento", Pedir documentos y Aprobar Legal a mano.
9. Verificar que teléfono y escritorio den los mismos números con la misma cuenta (capturas).
10. Drawer: todas las secciones **cerradas** al abrir; fondo **blanco** siempre; pendiente = borde y punto naranja; cumplido = borde verde suave y check.
11. Carta y proforma:
   - con número: **Enviar por WhatsApp** es el botón principal (anota solo el envío); Descargar es secundario;
   - sin número: solo **Descargar** en color, con "Sin número del cliente: envíala tú y márcala";
   - al tocar Descargar: hoja "¿La vas a enviar por WhatsApp?" con **Enviar por WhatsApp** y **Ya la envié**;
   - si descargó y no marcó, push a las 2 horas: "Descargaste la carta de X. ¿La marcamos como enviada?" con **Ya la envié**.
   - Confirmar de dónde sale el número: primero el del representante, si no, el del TAD.

## Parte E · Aliados 🖼
Diagnóstico: el primer aliado real (10/11) dejó una solicitud en borrador sin saber que faltaba el RIF del representante y el contacto (el contacto está al final del formulario). La otra quedó "En revisión" solo por el correo (A4.1).
1. **Formulario por pasos** con avance arriba: RIF de la empresa → Documentos → Contacto → Enviar.
2. **Mientras se lee el RIF de la empresa**, en esa misma pantalla se piden teléfono y correos.
3. **Barra fija abajo** con lo que falta ("Te falta: RIF del representante, teléfono"); con todo completo se vuelve **Enviar solicitud**.
4. Cada archivo muestra su avance al subir y la casilla pasa a **Leyendo → Leído ✓**.
5. En la lista, "Borrador" pasa a **"Sin enviar · faltan N"**.
6. **Pantalla de resultado** a pantalla completa (como una venta en Artesanos), según el caso:
   - al leer el RIF: Cliente en cartera (gris, botón Referir cliente) o En gestión por otro (gris); disponible sigue sin pantalla;
   - al enviar: pantalla "Revisando" con los pasos;
   - al terminar la IA: Lista para instalar (verde, Marcar instalación), Lista con observaciones (verde con notas), Recaudos incompletos (ámbar, lista de lo que falta y Subir ahora), En revisión (morado, qué se revisa);
   - después: decisión del administrador (aprobada o negada), Instalada, Pago registrado.
   Si la app está abierta sale al momento; si está cerrada, el push abre esa pantalla.
7. **Pestaña Avisos** con el historial de avisos; cada uno abre su solicitud.
8. Push **"Tu solicitud de X quedó sin enviar. Falta: …"** si deja un borrador más de 1 hora (una sola vez). El aviso que hoy llega en ese caso se corrige.
9. **Escritorio** (maqueta 5d): lista a la izquierda y la solicitud a la derecha; se pueden **arrastrar todos los documentos juntos** y la app los pone en su casilla, o soltar cada uno sobre su casilla.
10. **Registro de la solicitud** (maqueta 5e): qué sigue, historial (enviada, revisada, a revisión, aprobada), documentos con su estado y "Escribir al administrador por WhatsApp" (número del administrador en Ajustes de Aliados). Mientras está en revisión el aliado espera; al salir el resultado le llega el push, que abre la pantalla de resultado y de ahí el registro.
11. **"Escribir al administrador por WhatsApp"** en las pantallas de revisando, te falta, en revisión y en el registro.
12. **Revisión del administrador** (maqueta 5f): en Aliados, "Esperan tu decisión" abre la solicitud con sus documentos (Ver), la revisión de la IA, por qué está ahí, nota para el aliado y Aprobar, Aprobar con la nota, Devolver para corregir, Negar; más "Abrir expediente completo". Lo mismo en Mi trabajo, Por decidir. La lista "Sin enviar" le muestra al administrador quién se quedó a medias.
13. **Escritorio, solicitud abierta** (maqueta 5g): drawer a la derecha con el estado, Qué sigue (fecha y Marcar instalación), nota del administrador, historial, documentos con Ver, Escribir al administrador por WhatsApp y No se instaló. Arriba de la lista, tarjetas Listas para instalar, Sin enviar e Instaladas del mes que filtran.
14. RIF ya usado: se mantiene que no se guarda nada más que el RIF (verificar con prueba).

## Parte F · Usuarios 🖼
1. Primero se elige el **cargo** (Líder, Canales de atención/ATC corporativo, Abogado, Analista, Aliado, Gerencia, Administrador); la app pide solo lo de ese cargo y llena sola rol, equipo y equipo de comisiones.
2. **Código de vendedor** solo para quien vende (líderes y Canales), con ayuda: "Su número de vendedor en Odoo; con él se sabe de quién es cada orden".
3. Al crear un **Aliado**, elegir su empresa de la lista de aliados (hoy se enlaza a mano: primer aliado, 09/11).
4. Lo avanzado (senior, coordinador, dedicados, gerencia) en un plegable.
5. El PIN que pone el administrador sirve para entrar sin cambio obligatorio (problemas reales con el cambio de PIN, 09/11); el usuario puede cambiarlo cuando quiera desde su cuenta.

## Parte H · Mi trabajo 🖼 (maquetas 4a y 4b)
1. **Abogado (Reina):** submódulos a la izquierda; números arriba; grupo "Por elaborar contrato" con chips por tipo y orden ISP, corporativo, VGT, PYME y días desde que quedó completo; luego Enviado a firmar, Firmado falta subir, Vencen en 60 días (plegados).
2. **Coordinadora de Canales (ATC)** (maqueta 4c): "Lo mío" y "Mi equipo"; carga por persona con Ver su trabajo; cartas del equipo por persona o por días con Pasar a otra persona, Recordarle y Enviar yo; órdenes de Canales sin dueño con Elegir dueño.
3. **Analista (Canales):** Cartas y proformas primero, con "Descargada · por confirmar" (botón Ya la envié) y el botón Enviar por WhatsApp en la misma fila; Esperan la IP con la IP sugerida del pool; Cambios por emitir y Pago por revisar plegados; "Todo el equipo" para ver lo de Canales.

## Parte I · Teléfono (maqueta 7)
Comisiones (tarjetas que se deslizan, chips, por dueño, filas como tarjetas), hoja de comisión cerrada, Mi trabajo y cliente con todo cerrado. Barra de navegación abajo.

## Parte G · Correo (Gmail) y clientes ISP
Diagnóstico del correo de los últimos 30 días: 4 clientes ISP o dedicados que no existen en la app y 5 clientes que existen con 0 documentos. **Los nombres están en el traspaso del chat del proyecto (`claude/traspaso-chat.md` en el Project), no en este repo público.** El administrador los confirma al empezar esta parte.
1. Probar el botón **Nuevo ISP** con el primero de esa lista: crear el cliente desde el correo y subir los adjuntos a sus casillas. Arreglar lo que falle y documentar el paso a paso para el administrador.
2. Repetir con los demás y dejar la lista con su estado en el traspaso.

---

## Pendientes que NO son de este lote
- Cotejo de IP del administrador (archivo `servicios-nuevos-sin-ip-cruce.xlsx`) para decidir qué categorías llevan IP.
- Repo privado (GitHub Pro), tareas del administrador del traspaso.
