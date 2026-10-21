# Notificaciones v2 (20/10/2026)

Aprobado por el administrador el 20/10. Reemplaza la propuesta del 14/10, que sigue en el historial de git. Se programa en la tanda C de `claude/lote-22oct.md`. Si falta algo, se agrega aquí.

## Idea central
- **Todo encadenado entre procesos.** Cada vez que alguien termina su parte, le avisa al siguiente, al momento. Nada de resúmenes para Legal ni para los líderes: les llega lo que amerite, cuando amerite.
- Cada aviso es una tarea de **Mi trabajo** y al tocarlo abre esa tarea exacta. Un aviso se apaga solo cuando se resuelve la tarea.
- Nada avisa dos veces lo mismo. Si una tarea vence, llega **un solo** recordatorio.
- Texto: quién hizo qué, a qué cliente y qué toca hacer, con fecha límite si la hay.

## Canales
- **En la app:** campana con contador, más los contadores de Mi trabajo e Inicio. Siempre.
- **Push** al teléfono y a la laptop (app instalada, `sw.js`). Entre 10 p.m. y 8 a.m. no suena: lo de la noche llega a las 8 a.m.
- **Correo al cliente:** fase 2 (ver al final).

## Formato
> 📄 **Te devolvieron documentos**
> El administrador revisó **Comercial Ejemplo**. Devolvió 2: cédula vencida y RIF ilegible. Corrígelos antes del **18/10**.
> [Abrir expediente]

## Roles
- Administrador.
- Analista Senior (comisiones).
- Coordinador de analistas: ve y puede hacer todo lo de los analistas.
- Analista del líder: el asignado en Usuarios; si no hay, el coordinador.
- Líderes.
- Legal.
- Aliados.
- Gerencia (pendiente de definir).

---

## 1. Expediente y documentos
| Cuando | Le llega a | Qué hacer |
|---|---|---|
| El líder o un aliado sube documentos | Administrador | Revisar (cola de Revisar documentos) |
| Llegan documentos por correo (lector de Gmail) | Administrador y líder del cliente | Revisar |
| El administrador devuelve documentos | Líder (y el aliado si es suyo) | Corregir, con el motivo de cada uno |
| El administrador aprueba todo y el cliente pasa a Documentos recibidos | Legal, líder y analista | Legal: elaborar contrato |
| Contrato listo para firmar | Líder | Hacerlo firmar (digital o físico) |
| Contrato firmado | Analista y líder | Analista: bienvenida y proforma |
| Contrato firmado sin archivo o sin vencimiento | Legal | Subir el contrato o poner el vencimiento |
| Contrato por vencer (60 días) | Líder y Legal | Renovar |
| **Cada 3 días** | Cada líder | Lista de sus clientes a los que les faltan documentos, con lo que falta de cada uno |

## 2. Instalación y comisiones
| Cuando | Le llega a | Qué hacer |
|---|---|---|
| Orden nueva en Odoo | Líder | Por instalar (corre el reloj) |
| Instalada | Analista y líder | Analista: bienvenida; IP si falta |
| IP por confirmar (solo cuando no cuadra) | Analista y coordinador | Confirmar IP |
| Pago confirmado por el TAD | Líder | Nada; informativo |
| Revisar pago | Analista y Analista Senior | Revisar |
| 3 días antes del día límite del corte | Cada líder | Sus clientes que todavía no comisionan y qué les falta |
| Día límite del corte | Administrador y Analista Senior | Cerrar el corte |
| Corte cerrado | Cada líder | Su resultado: cuántos comisionan y cuáles pasan al siguiente |
| Comisión decidida (evento, no comisiona, corrección) | Líder | Informativo, con el motivo |

## 3. Migraciones
| Cuando | Le llega a | Qué hacer |
|---|---|---|
| El líder registra un cambio | Administrador | Revisar documentos |
| Planilla de titular lista | Líder | Enviarla al cliente para firmar |
| Documentos aprobados | Analista del líder (y coordinador) | Emitir en Proham, plan y categoría |
| El TAD muestra solo uno de los dos cambios | Analista | Falta cambiar el plan o la categoría |
| Confirmada en el TAD | Líder | Informativo; entra al corte |
| Cambio sin registro | Administrador y Analista Senior | Asignar líder o descartar |
| Cambio a residencial confirmado | Líder y administrador | Indicador negativo |
| Por emitir más de 2 días | Coordinador y administrador | Atrasado |

## 4. Aliados
| Cuando | Le llega a | Qué hacer |
|---|---|---|
| Un aliado pide permiso por un cliente | Administrador | Aprobar o rechazar |
| **Bloqueo:** el cliente ya está en gestión de un líder o es TOP | El aliado (bloqueado y por qué), el líder dueño del cliente (un aliado intentó tu cliente) y el administrador | Revisar si procede |
| Permiso aprobado o rechazado | Aliado y líder dueño | Seguir o no |
| Documentos devueltos | Aliado | Corregir |
| Instalado | Aliado | Informativo |
| Pago al aliado | Aliado | Informativo |
| Referido asignado | Líder | Contactarlo |

## 5. Gestiones
| Cuando | Le llega a | Qué hacer |
|---|---|---|
| Te asignan a una gestión o un cliente en ella | Responsable | Empezar |
| Cambia el estado de un cliente (por ejemplo, Esperando a Recibido) | Responsable y quien creó la gestión | Seguir |
| El plazo vence mañana | Responsables | Cerrar pendientes |
| La gestión se queda atrás de su meta | Quien la creó | Revisar |
| Meta cumplida | Quien la creó y responsables | Informativo |

## 6. Cambios en un cliente
| Cuando | Le llega a |
|---|---|
| Cambio de líder | Líder anterior y líder nuevo |
| Suspendido o reactivado | Líder |
| Cambio de tipo de cliente | Líder y Legal |
| Cliente nuevo creado por la carga (TAD, Odoo, órdenes) | Líder asignado |

## 7. Datos y cargas
| Cuando | Le llega a |
|---|---|
| TAD con menos filas que la carga anterior, o un archivo que falla | Administrador |
| Clientes que dejan de aparecer en el TAD dos cargas seguidas | Administrador y líder |

## 8. Cuentas y seguridad
| Cuando | Le llega a |
|---|---|
| Cuenta bloqueada por intentos fallidos | Administrador |
| PIN restablecido | La persona |

## Constancia de cada cliente (desde ya, en la app)
El Hilo del cliente registra cada documento recibido (quién y por dónde: app, correo o aliado), cada respuesta de revisión (aprobado o devuelto, con motivo), cada pedido de documentos (qué, a quién, por dónde), cada respuesta y cada cambio. Así queda constancia de todo.

## Fase 2: correo al cliente (no va en el lote 22/10)
Desde la cuenta de ventas, en un mismo hilo por cliente:
- acuse de recibo de documentos;
- resultado de la revisión;
- lo que falta.

Requiere el permiso de enviar correo de Google (con la seguridad del 21/10).

## Pendiente
- **Gerencia:** el administrador todavía no lo ha pensado; por ahora solo lo que ve de aliados.
