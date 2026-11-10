# Inventario de funciones (lote 10/11)

Regla del lote: ninguna función se quita. Antes de tocar cada pantalla se anota lo que había y, al terminar, dónde quedó.
Columna "Queda": **igual**, **movido a …** o **nuevo**. Se marca ✔ cuando la prueba o la captura lo confirman.

## Parte A · Datos y reglas (sin pantallas nuevas)
| Función de hoy | Queda |
|---|---|
| Actualizar: leer TAD con suspensión, habilitación y estatus actual por palabra en el encabezado | igual + reconoce `ULTSUPENSION` y `ULTACTIVACION`; 01-01-1900 vacío ✔ (test51) |
| Actualizar: TAD sin fechas en rojo "Sin fechas" | igual ✔ (test51) |
| Reporte de IP: cuadra por sucursal + código + ONT, llena IP, por confirmar, filas que no cuadran guardadas | igual + guarda las DISPONIBLE (sin cliente) con su IP ✔ (prueba SQL deshecha) |
| Hoja de comisión: IP "Lo más parecido" (misma ONT, mismo código, nombre), Usar esta IP, Ver otros parecidos, Escribir la IP | igual + arriba "Posible IP, confírmala en el sistema técnico" con las siguientes del pool; el botón se llama "Escribir IP" |
| Expediente: Escribir IP / Cambiar IP en cada servicio | igual |
| Clientes y Gerencia: churn, infancia y calidad (escondidos con `churn_visible = no`) | igual de escondidos; la pérdida sale de las reglas del 10/11 |
| IA: reglas de contratos (21) | igual (tabla Contratos y Aliados en `ia-reglas.md`); RIF sin vencimiento con fecha de inscripción o actualización = Digital ✔ (test16) |
| IA: lectura adelantada de aliados, OCR de RIF y cédula, combinados | igual; RIF y cédula con el modelo rápido |
