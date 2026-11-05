// Lote 05/11, parte A: Inicio y Mi trabajo con la misma cuenta; la Analista Senior no aprueba ni devuelve documentos
// ni ve la revisión de documentos; texto de la póliza VGT (responsabilidad civil general mínimo US$ 100.000).
// Datos inventados (mundo.js).
const { chromium, H, TEL, PC, contexto, marcador, entrar } = require('./simulador');
const { RPC } = require('./mundo');
const { ok, cerrar } = marcador();

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['pc', PC], ['tel', TEL]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    // Una sola fuente: el total de Inicio es el número de ítems de Mi trabajo, para cada persona
    const iguales = mundo.personas.filter((p) => p.activo && ['admin', 'analista', 'lider'].includes(p.rol)).every((p) => {
      const r = RPC.trabajo_resumen(mundo, p); const t = RPC.mi_trabajo(mundo, p, {});
      return r && r.total === (t.items || []).length;
    });
    ok(nombre + ': Inicio y Mi trabajo cuentan lo mismo para cada persona', iguales);
    const elena = mundo.personas.find((p) => p.senior);
    ok(nombre + ': la Analista Senior no recibe revisión de documentos en Mi trabajo', !(RPC.mi_trabajo(mundo, elena, {}).items || []).some((i) => ['revisar_docs', 'cambio_revisar'].includes(i.tipo)));
    // La Senior abre el expediente con documentos por revisar: no ve Aprobar ni Devolver
    const p = await entrar(ctx, 'elena', '315806'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'cliente.html?id=1001&t=documentos&revisar=1'); await p.waitForSelector('[data-casilla], .vacio', { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(800);
    ok(nombre + ': la Senior no ve Aprobar ni Devolver', !(await p.locator('#verAprobar, #verDevolver').count()));
    await ctx.close();
  }
  ok('sin errores de JavaScript', !errores.length, errores.slice(0, 3));
  await nav.close(); cerrar();
})();
