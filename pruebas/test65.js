// Lote 13/11, parte 1: la Solicitud de prueba del administrador muestra los mismos recuadros que ve el aliado,
// y "Ver los avisos" muestra los 9 casos con datos de ejemplo sin tocar la base. Teléfono y PC.
const { chromium, H, TEL, PC, contexto, marcador, entrar } = require('./simulador');
const { mundoAliados } = require('./mundo-aliados');
const { ok, cerrar } = marcador();
const ALIADO = { id: '88888888-8888-4888-8888-888888888888', usuario: 'redes', pin: '571942', nombre: 'Redes Norte Ejemplo', rol: 'aliado', cargo: 'Aliado comercial', equipo: 'aliados', codigo_vendedor: null, nombre_odoo: null, activo: true, debe_cambiar_pin: false };
const CANALES = { id: '99999999-9999-4999-8999-999999999999', usuario: 'canal', pin: '640375', nombre: 'Carla Canales', rol: 'analista', canales: true, cargo: 'Coordinación de canales', equipo: 'ambos', codigo_vendedor: null, nombre_odoo: null, activo: true, debe_cambiar_pin: false };
const PDF = { name: 'rif.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 prueba') };
const CASOS = [['analizando', /Revisando tu solicitud/], ['lista', /¡Puedes instalar!/], ['recaudos', /Te falta algo para instalar/], ['cartera', /ya está carterizado/], ['otro', /ya está siendo gestionado/],
  ['excepcionNo', /La excepción no se aprobó/], ['noprocede', /No procede/], ['referido', /Referido enviado/]];

(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, disp] of [['pc', PC], ['tel', TEL]]){
    const { ctx, mundo: m } = await contexto(nav, disp);
    m.personas.push(Object.assign({}, ALIADO), Object.assign({}, CANALES)); mundoAliados(m, ALIADO, CANALES);
    await ctx.route('**/functions/v1/aliado_rif', (r) => { m.llamadas.push(['aliado_rif']);
      r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ estado: 'cartera', nombre: 'DISTRIBUIDORA INVENTADA, C.A.', rif: 'J000000014' }) }); });
    const p = await entrar(ctx, 'marcos', '482913'); p.on('pageerror', (e) => errores.push(nombre + ': ' + e.message));
    await p.goto(H + 'aliados.html'); await p.waitForSelector('[data-acc="avisosDemo"]');

    // ----- Solicitud de prueba: el mismo drawer y el mismo recuadro del aliado -----
    await p.locator('[data-acc="nueva"]:visible').first().click(); await p.waitForSelector('#hojaNueva.ver [data-tipon="empresa"]');
    ok(nombre + ': Solicitud de prueba abre el drawer del aliado', (await p.locator('#hojaNueva.al-dw').count()) === 1);
    await p.click('[data-tipon="empresa"]'); await p.waitForSelector('[data-subirn="rif_empresa:0"]');
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-subirn="rif_empresa:0"]')]); await fc.setFiles(PDF);
    await p.waitForSelector('#alRes.ver', { timeout: 10000 });
    ok(nombre + ': en la prueba sale el recuadro "ya está carterizado" con lo de atrás difuminado', /Este cliente ya está carterizado/.test(await p.textContent('#alRes')) && (await p.locator('#alResVelo.ver').count()) === 1);
    await p.screenshot({ path: 'capturas/lote13nov-p1-prueba-' + nombre + '.png' });
    await p.click('#alRes [data-res="inicio"]'); await p.waitForTimeout(400);
    ok(nombre + ': Volver al inicio deja al administrador en Solicitudes, sin hojas abiertas', (await p.locator('#alRes.ver').count()) === 0 && (await p.locator('.hoja.ver').count()) === 0 && (await p.locator('[data-acc="avisosDemo"]:visible').count()) >= 1);

    // ----- Ver los avisos: 9 casos, sin tocar la base -----
    const antes = m.llamadas.length;
    await p.locator('[data-acc="avisosDemo"]:visible').first().click(); await p.waitForSelector('#hojaAvisos.ver');
    ok(nombre + ': "Ver los avisos" lista los 9 casos', (await p.locator('#hojaAvisos [data-demo]').count()) === 9);
    await p.screenshot({ path: 'capturas/lote13nov-p1-avisos-' + nombre + '.png' });
    for(const [k, re] of CASOS){
      await p.click('#hojaAvisos [data-demo="' + k + '"]'); await p.waitForSelector('#alRes.ver');
      ok(nombre + ': aviso ' + k + ' sale con su recuadro', re.test(await p.textContent('#alRes')));
      if(k === 'lista' || k === 'excepcionNo') await p.screenshot({ path: 'capturas/lote13nov-p1-' + k + '-' + nombre + '.png' });
      await p.locator('#alRes [data-res]').last().click(); await p.waitForFunction(() => !document.querySelector('#alRes.ver'));
    }
    await p.click('#hojaAvisos [data-demo="repetida"]'); await p.waitForSelector('#hojaNueva.ver');
    ok(nombre + ': "Ya tienes una solicitud" sale dentro del alta, como lo ve el aliado', /Ya tienes una solicitud de este cliente/.test(await p.textContent('#hojaNueva')));
    await p.click('#hojaNueva [data-sol]'); await p.waitForTimeout(300);
    ok(nombre + ': en el ejemplo, Abrir no busca nada en la base', (await p.locator('#hojaSol.ver').count()) === 0);
    const nuevas = m.llamadas.slice(antes).filter((x) => x[0] !== 'avisos_contar' && !/^(aliados_registro|avisos)/.test(String(x[1] || x[0])));
    ok(nombre + ': mirar los avisos no llamó al servidor', nuevas.filter((x) => /solicitud|referido|aliado_rif/.test(JSON.stringify(x))).length === 0);
    await ctx.close();
  }
  ok('sin errores de página', errores.length === 0); if(errores.length) console.log(errores.join('\n'));
  await nav.close(); cerrar();
})();
