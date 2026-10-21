// Lote 22/10 tanda C + Lote A: avisos en la app. Campana con contador y el icono de usuario en la barra (también en el teléfono),
// avisos agrupados por categoría (sin leer y total, plegables, "Venció" como marca roja), marcar leído por grupo y todo,
// tocar un aviso abre la tarea exacta. Tarjeta "Activar alertas" en Inicio. "Contactar al responsable" en la ficha.
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
      { id: 4, tipo: 'devuelto', titulo: 'Te devolvieron documentos', texto: 'Panaderia Inventada Dos: RIF vencido. Venció el 18/10', enlace: 'clientes.html?c=' + c.id, en: new Date(Date.now() - 7200e3).toISOString(), leido: false, vencido: true, para: 'lucia' },
      { id: 2, tipo: 'cambio', titulo: 'Cambio confirmado en el TAD', texto: 'Panaderia Inventada Uno: entra al corte con Legal y pago.', enlace: 'migraciones.html?c=7', en: new Date(Date.now() - 3600e3).toISOString(), leido: false, para: 'lucia' },
      { id: 3, tipo: 'cliente', titulo: 'Cliente nuevo', texto: 'Ferreteria Inventada entró con la carga.', enlace: 'clientes.html?c=' + c.id, en: new Date(Date.now() - 86400e3).toISOString(), leido: true, para: 'lucia' }];
    const p = await entrar(ctx, 'lucia', '739105'); p.on('pageerror', (e) => errores.push(e.message));
    await p.waitForSelector('#campana .nbadge:not(.hidden)');
    ok(nombre + ': la campana está en la barra con los avisos sin leer', (await p.textContent('#campana .nbadge')) === '3' && /3 sin leer/.test(await p.getAttribute('#campana', 'aria-label')));
    ok(nombre + ': el icono de usuario se ve junto a la campana', await p.locator('#cuenta .av').isVisible());
    // Tarjeta "Activar alertas" en Inicio: en iPhone pide instalar primero; sin https en la laptop no sale
    await p.waitForTimeout(300);
    ok(nombre + ': la tarjeta de alertas de Inicio sigue la misma lógica', nombre === 'tel' ? /instala la app/i.test(await p.textContent('#zonaAlertas')) : (await p.locator('#zonaAlertas .av-push').count()) === 0);
    if(nombre === 'tel'){ await p.screenshot({ path: 'capturas/45-tel-inicio-alertas.png' }); await p.click('#zonaAlertas [data-av="ahoraNo"]'); await p.waitForTimeout(200);
      ok('tel: "Ahora no" esconde la tarjeta de alertas', (await p.locator('#zonaAlertas .av-push').count()) === 0); }
    await p.click('#campana'); await p.waitForSelector('#hojaAvisos.ver [data-avg]');
    ok(nombre + ': los avisos salen agrupados por categoría', (await p.locator('#hojaAvisos [data-avg]').count()) === 3 && /2 sin leer · 2 avisos/.test(await p.textContent('#hojaAvisos [data-avg="devuelto"]')));
    await p.waitForSelector('#hojaAvisos [data-aviso="4"]');
    ok(nombre + ': el grupo con sin leer se abre solo y el vencido lleva la marca roja', (await p.locator('#hojaAvisos [data-aviso="4"] .av-venc').count()) === 1 && /1 vencido/.test(await p.textContent('#hojaAvisos [data-avg="devuelto"]')));
    ok(nombre + ': sin https no ofrece el permiso de push y no falla', (await p.locator('[data-av="activar"]').count()) === 0);
    ok(nombre + ': la lista sin desborde', await sinDesborde(p));
    await p.screenshot({ path: 'capturas/45-' + nombre + '-avisos.png' });
    await p.click('#hojaAvisos [data-avg="cambio"]'); await p.waitForSelector('#hojaAvisos [data-aviso="2"]');
    await p.click('[data-av-leer-g="cambio"]'); await p.waitForFunction(() => document.querySelector('#campana .nbadge').textContent === '2');
    ok(nombre + ': Marcar leído un grupo baja el contador', llamo(mundo, 'avisos_leer_grupo').some((l) => l[2].p_tipo === 'cambio'));
    await p.click('[data-av="leerTodo"]'); await p.waitForFunction(() => document.querySelectorAll('#hojaAvisos .av-f.nuevo').length === 0);
    ok(nombre + ': Marcar todo leído apaga el contador', llamo(mundo, 'avisos_leer').some((l) => l[2].p_ids === null) && (await p.locator('#campana .nbadge.hidden').count()) === 1);
    mundo.datos.avisos[0].leido = false;
    await p.keyboard.press('Escape'); await p.click('#campana'); await p.waitForSelector('#hojaAvisos.ver [data-aviso="1"]');
    await Promise.all([p.waitForURL('**/clientes.html?c=' + c.id + '&t=documentos'), p.click('[data-aviso="1"]')]);
    ok(nombre + ': tocar un aviso lo marca leído y abre la tarea exacta', llamo(mundo, 'avisos_leer').some((l) => JSON.stringify(l[2].p_ids) === '[1]'));
    await p.waitForSelector('#hojaFicha.ver #tFicha');
    ok(nombre + ': llega al expediente del cliente', (await p.textContent('#tFicha')).includes(c.nombre.split(',')[0]));
    // Contactar al responsable: documentos en revisión, el paso es del administrador
    await p.waitForSelector('#cabFicha .ct-zona .ct-btn');
    const href = await p.getAttribute('#cabFicha .ct-btn', 'href');
    ok(nombre + ': el líder contacta al administrador por WhatsApp con el mensaje escrito', /^https:\/\/wa\.me\/58\d+\?text=/.test(href) && decodeURIComponent(href).includes('me revisas los documentos de ' + c.nombre) && /Contactar a Marcos/.test(await p.textContent('#cabFicha .ct-btn')));
    await p.evaluate(() => { const a = document.querySelector('#cabFicha .ct-btn'); a.removeAttribute('target'); a.addEventListener('click', (e) => e.preventDefault()); });
    await p.click('#cabFicha .ct-btn'); await p.waitForTimeout(300);
    ok(nombre + ': el contacto queda en la bitácora', llamo(mundo, 'contacto_anotar2').some((l) => l[2].p_medio === 'whatsapp' && l[2].p_caso === 'cliente'));
    await p.screenshot({ path: 'capturas/45-' + nombre + '-contactar.png' });
    await ctx.close();
  }
  // El administrador mirando un expediente en revisión: el paso es suyo, no sale "Contactar"
  {
    const { ctx, mundo } = await contexto(nav, PC); const c = mundo.datos.clientes[0];
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'clientes.html?c=' + c.id); await p.waitForSelector('#hojaFicha.ver #tFicha'); await p.waitForTimeout(600);
    ok('admin: si el paso es suyo no sale Contactar', (await p.locator('#cabFicha .ct-btn').count()) === 0 && llamo(mundo, 'contacto_destino').length > 0);
    await ctx.close();
  }
  ok('sin errores de la página', errores.length === 0, errores);
  await nav.close(); cerrar();
})();
