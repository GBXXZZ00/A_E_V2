// Página de privacidad: pública (sin PIN), no llama al servidor, se lee bien en teléfono y escritorio, y la entrada la enlaza.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde } = require('./simulador');
const { ok, cerrar } = marcador();
(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const { ctx, mundo } = await contexto(nav, dispositivo);
    const p = await ctx.newPage(); p.on('pageerror', (e) => errores.push(e.message));
    const servidor = []; p.on('request', (r) => { if(/supabase\.co/.test(r.url())) servidor.push(r.url()); });
    await p.goto(H + 'privacidad.html'); await p.waitForSelector('h1');
    const t = await p.textContent('body');
    ok(nombre + ': abre sin entrar y sin llamar al servidor', p.url().includes('privacidad.html') && servidor.length === 0, servidor);
    ok(nombre + ': explica el uso de Google Drive y el uso limitado', t.includes('Google Drive') && t.includes('uso limitado') && t.includes('no se venden'));
    ok(nombre + ': dice cómo pedir corregir o borrar datos', t.includes('Corregir o borrar datos'));
    ok(nombre + ': sin guion largo ni correos ni teléfonos', !t.includes('—') && !/@[a-z]/i.test(t) && !/\d{4}-?\d{3}/.test(t.replace('2026', '')));
    ok(nombre + ': no desborda', await sinDesborde(p));
    ok(nombre + ': el enlace Entrar a la app mide 44 px', (await p.locator('.priv-volver').boundingBox()).height >= 44);
    await p.screenshot({ path: 'capturas/10-' + nombre + '-privacidad.png', fullPage: false });
    await p.goto(H + 'index.html'); await p.waitForSelector('.priv-enlace');
    await p.click('.priv-enlace'); await p.waitForURL('**/privacidad.html');
    ok(nombre + ': la entrada enlaza la privacidad', true);
    await ctx.close();
  }
  ok('sin errores de JavaScript', errores.length === 0, errores);
  await nav.close(); cerrar();
})().catch((e) => { console.error(e); process.exit(1); });
