// Lote 2, parte A: arrastrar y soltar sin recuadro pegado, "Aprobado, documentos por subir",
// a Documentos recibidos solo con documentos, y Por instalar con indicadores y dos bandejas.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();

const cliente = (mundo, nombre) => mundo.datos.clientes.find((c) => c.nombre === nombre || c.nombre === nombre + ', C.A.');
const sinSobre = (p) => p.evaluate(() => !document.querySelector('#tab-documentos.sobre, #tab-documentos .sobre'));
async function arrastrar(p, sobre){
  await p.evaluate((sel) => {
    const dt = new DataTransfer(); dt.items.add(new File(['x'], 'a.pdf', { type: 'application/pdf' }));
    const el = document.querySelector(sel); el.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, sobre);
}

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    // Aprobado por Legal, hoy en grandes negocios (como los corregidos el 13/10), con el acta sin archivo
    const yunque = cliente(mundo, 'Tornillos El Yunque');
    Object.assign(yunque, { estatus: 'grandes_negocios' }); yunque.documentos.find((d) => d.casilla === 'acta_constitutiva').archivos = [];

    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'clientes.html?c=' + yunque.id); await p.waitForSelector('#hojaFicha.ver');
    await p.click('#tabs [data-tab="documentos"]'); await p.waitForSelector('#tab-documentos .al-banda');
    const banda = await p.textContent('#tab-documentos .al-banda');
    ok(nombre + ': el aprobado con casillas vacías dice "Aprobado, documentos por subir"', banda.includes('Aprobado, documentos por subir') && banda.includes('no cambia su aprobación'));
    await p.screenshot({ path: 'capturas/24-' + nombre + '-aprobado-por-subir.png' });

    if(nombre === 'pc'){
      // Arrastrar: sobre la zona (fuera de casillas) y cancelar; sobre una casilla y soltar fuera
      await arrastrar(p, '#tab-documentos');
      ok('pc: al arrastrar sobre la pestaña se marca la zona', await p.evaluate(() => document.querySelector('#tab-documentos').classList.contains('sobre')));
      await p.evaluate(() => window.dispatchEvent(new DragEvent('dragend', { bubbles: true })));
      ok('pc: al cancelar el arrastre no queda el recuadro', await sinSobre(p));
      await arrastrar(p, '#tab-documentos [data-suelta]');
      ok('pc: sobre una casilla se marca solo la casilla', await p.evaluate(() => !!document.querySelector('#tab-documentos [data-suelta].sobre') && !document.querySelector('#tab-documentos').classList.contains('sobre')));
      await p.evaluate(() => document.body.dispatchEvent(new DragEvent('drop', { dataTransfer: new DataTransfer(), bubbles: true, cancelable: true })));
      ok('pc: al soltar fuera de una casilla no queda el recuadro', await sinSobre(p));
      await arrastrar(p, '#tab-documentos');
      await p.evaluate(() => document.dispatchEvent(new DragEvent('dragleave', { bubbles: true, relatedTarget: null })));
      ok('pc: al salir de la ventana arrastrando no queda el recuadro', await sinSobre(p));
      await arrastrar(p, '#tab-documentos');
      await p.evaluate(() => document.querySelector('#tab-documentos').dispatchEvent(new DragEvent('drop', { dataTransfer: new DataTransfer(), bubbles: true, cancelable: true })));
      ok('pc: soltar algo que no es archivo tampoco lo deja puesto', await sinSobre(p));
    }

    // A Documentos recibidos a mano sin los archivos: el servidor lo niega y la pantalla lo dice
    await p.click('#tabs [data-tab="datos"]'); await p.click('#cambiarEstatus'); await p.waitForSelector('#hojaEstatus.ver');
    await p.click('#hojaEstatus [data-estatus="documentos_recibidos"]'); await p.click('#guardarEstatus');
    await p.waitForSelector('.toast.error');
    ok(nombre + ': pasar a recibidos sin documentos se niega con un aviso claro', /deben estar subidos todos los documentos/.test(await p.textContent('.toast.error')) && yunque.estatus === 'grandes_negocios');
    ok(nombre + ': y conserva la aprobación de Legal', !!yunque.legal_ok_en);
    await p.keyboard.press('Escape'); await p.waitForTimeout(300); await p.keyboard.press('Escape'); await p.waitForTimeout(300);

    // Clientes: la etiqueta distingue al aprobado
    await p.goto(H + 'clientes.html'); await p.waitForSelector('[data-cliente]');
    await p.fill('#busca', 'Yunque'); await p.waitForFunction(() => document.querySelectorAll('#lista [data-cliente]').length === 1);
    ok(nombre + ': en Clientes sale la etiqueta "Aprobado, documentos por subir"', (await p.textContent('#lista')).includes('Aprobado, documentos por subir'));

    // C: Debe instalación y Por asignar se explican en una línea al elegirlos
    await p.goto(H + 'comisiones.html'); await p.waitForSelector('#filtros [data-filtro="pago"]');
    await p.click('#filtros [data-filtro="pago"]'); await p.waitForSelector('#ayudaFiltro .ayuda-filtro');
    ok(nombre + ': "Debe instalación" dice qué es (falta el pago según el TAD)', /según el TAD.*no ha pagado la instalación/.test(await p.textContent('#ayudaFiltro .ayuda-filtro')));
    await p.click('#filtros [data-filtro="asignar"]'); await p.waitForFunction(() => /qué líder/.test((document.querySelector('#ayudaFiltro .ayuda-filtro') || {}).textContent || ''));
    ok(nombre + ': "Por asignar" dice qué es (no se sabe el dueño) y quién lo resuelve', /Analista Senior/.test(await p.textContent('#ayudaFiltro .ayuda-filtro')));
    await p.screenshot({ path: 'capturas/24-' + nombre + '-ayuda-filtro.png' });
    await p.click('#filtros [data-filtro="todos"]');
    ok(nombre + ': sin filtro no se repite la ayuda', (await p.locator('#ayudaFiltro .ayuda-filtro').count()) === 0);
    // Por instalar: indicadores arriba y dos bandejas con título y contador
    await p.goto(H + 'comisiones.html?t=instalar'); await p.waitForSelector('.ins-kpis');
    const k = await p.textContent('.ins-kpis');
    ok(nombre + ': indicadores de faltan, promedio, la más vieja y reprogramadas', ['Faltan por instalar', 'Promedio', 'La más vieja', 'Reprogramadas'].every((x) => k.includes(x)));
    ok(nombre + ': indicadores con faltantes por líder', k.includes('Faltan por líder'));
    const bandejas = await p.$$eval('.bandeja-ins h3', (a) => a.map((x) => x.textContent));
    ok(nombre + ': dos bandejas separadas', bandejas.length >= 1 && bandejas[0] === 'Órdenes abiertas sin instalar');
    ok(nombre + ': sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/24-' + nombre + '-por-instalar.png', fullPage: true });
    await ctx.close();
  }
  ok('sin errores de la página', errores.length === 0); if(errores.length) console.log(errores);
  await nav.close(); cerrar();
})();
