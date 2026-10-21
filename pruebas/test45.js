// Lote 22/10 tanda C: avisos en la app. Campana con contador en la barra, lista de avisos con enlace a la tarea exacta,
// marcar leído al tocar uno y "Marcar todo leído". El permiso de push (solo con https) no rompe nada sin él.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
const llamo = (m, f) => m.llamadas.filter((l) => l[1] === f);

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    const c = mundo.datos.clientes[0];
    mundo.datos.avisos = [
      { id: 1, tipo: 'devuelto', titulo: 'Te devolvieron documentos', texto: c.nombre + ': cédula vencida. Antes del 25/10', enlace: 'clientes.html?c=' + c.id + '&t=documentos', en: new Date().toISOString(), leido: false, para: 'lucia' },
      { id: 2, tipo: 'cambio', titulo: 'Cambio confirmado en el TAD', texto: 'Panaderia Inventada Uno: entra al corte con Legal y pago.', enlace: 'migraciones.html?c=7', en: new Date(Date.now() - 3600e3).toISOString(), leido: false, para: 'lucia' },
      { id: 3, tipo: 'cliente', titulo: 'Cliente nuevo', texto: 'Ferreteria Inventada entró con la carga.', enlace: 'clientes.html?c=' + c.id, en: new Date(Date.now() - 86400e3).toISOString(), leido: true, para: 'lucia' }];
    const p = await entrar(ctx, 'lucia', '739105'); p.on('pageerror', (e) => errores.push(e.message));
    await p.waitForSelector('#campana .nbadge:not(.hidden)');
    ok(nombre + ': la campana está en la barra con los avisos sin leer', (await p.textContent('#campana .nbadge')) === '2' && /2 sin leer/.test(await p.getAttribute('#campana', 'aria-label')));
    await p.click('#campana'); await p.waitForSelector('#hojaAvisos.ver [data-aviso]');
    ok(nombre + ': la lista trae los avisos, los nuevos marcados', (await p.locator('#hojaAvisos [data-aviso]').count()) === 3 && (await p.locator('#hojaAvisos .av-f.nuevo').count()) === 2 && /cédula vencida/.test(await p.textContent('#hojaAvisos')));
    ok(nombre + ': sin https no ofrece el permiso de push y no falla', (await p.locator('[data-av="activar"]').count()) === 0);
    ok(nombre + ': la lista sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/45-' + nombre + '-avisos.png' });
    await p.click('[data-av="leerTodo"]'); await p.waitForFunction(() => document.querySelectorAll('#hojaAvisos .av-f.nuevo').length === 0);
    ok(nombre + ': Marcar todo leído apaga el contador', llamo(mundo, 'avisos_leer').some((l) => l[2].p_ids === null) && (await p.locator('#campana .nbadge.hidden').count()) === 1);
    mundo.datos.avisos[0].leido = false;
    await p.keyboard.press('Escape'); await p.click('#campana'); await p.waitForSelector('#hojaAvisos.ver [data-aviso="1"]');
    await Promise.all([p.waitForURL('**/clientes.html?c=' + c.id + '&t=documentos'), p.click('[data-aviso="1"]')]);
    ok(nombre + ': tocar un aviso lo marca leído y abre la tarea exacta', llamo(mundo, 'avisos_leer').some((l) => JSON.stringify(l[2].p_ids) === '[1]'));
    await p.waitForSelector('#hojaFicha.ver #tFicha');
    ok(nombre + ': llega al expediente del cliente', (await p.textContent('#tFicha')).includes(c.nombre.split(',')[0]));
    await ctx.close();
  }
  ok('sin errores de la página', errores.length === 0, errores);
  await nav.close(); cerrar();
})();
