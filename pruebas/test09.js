// Archivos de Drive desde la app: el documento viejo abre sin sesión de Google, con el permiso del expediente.
const { chromium, H, TEL, PC, contexto, marcador, sinDesborde, entrar } = require('./simulador');
const { ok, cerrar } = marcador();
const DRIVE = 'https://drive.google.com/file/d/PRUEBA000000/view';
const cerrarTodo = async (p) => { for(let i = 0; i < 5; i++){ if(await p.evaluate(() => !!window.Comun.hojaAbierta())) await p.keyboard.press('Escape'); } await p.waitForFunction(() => !window.Comun.hojaAbierta()); };
const abrirCliente = async (p, texto) => { await p.fill('#busca', texto); await p.waitForFunction((t) => document.querySelectorAll('.cli').length === 1 && document.querySelector('.cli').textContent.includes(t), texto); await p.locator('.cli').first().click(); await p.waitForSelector('#hojaFicha.ver #tFicha'); await p.click('[data-tab="documentos"]'); };
const visorListo = (p) => p.waitForFunction(() => { const v = document.getElementById('visor'); return v && !v.querySelector('.cargando-linea'); });
const llamadasDrive = (m) => m.llamadas.filter((l) => l[0] === 'drive');
(async () => {
  const nav = await chromium.launch(); const errores = [];
  for(const [nombre, dispositivo] of [['tel', TEL], ['pc', PC]]){
    const pc = nombre === 'pc';
    const { ctx, mundo } = await contexto(nav, Object.assign({ acceptDownloads: true }, dispositivo));
    const aDrive = []; ctx.on('request', (r) => { if(/drive\.google\.com|googleapis\.com/.test(r.url())) aDrive.push(r.url()); });
    // Documentos que vinieron de la app vieja: solo tienen el enlace de Drive
    const faro = mundo.datos.clientes.find((c) => c.nombre.includes('Faro'));
    const viejo = (n, mime, nombreArch) => Object.assign(faro.documentos[n].archivos[0], { ruta: null, url_externa: DRIVE, drive_id: 'PRUEBA00000' + n, mime, nombre: nombreArch });
    viejo(0, 'image/jpeg', 'cedula escaneada.jpg');
    viejo(1, 'application/pdf', 'rif <img src=x onerror="window.__xss=1">.pdf');
    viejo(2, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'rif empresa.docx');
    const [dImg, dPdf, dDocx] = faro.documentos;
    const ajeno = mundo.datos.clientes.find((c) => c.nombre.includes('Bahía Azul'));
    const archAjeno = ajeno.documentos[0].archivos[0]; Object.assign(archAjeno, { url_externa: DRIVE, drive_id: 'PRUEBAAJENO1' });

    const p = await entrar(ctx, 'lucia', '739105'); p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(H + 'clientes.html'); await p.waitForSelector('.cli');
    await abrirCliente(p, 'Vidrios El Faro');

    // Imagen
    await p.click('[data-ver="' + dImg.id + '"]'); await p.waitForSelector('#hojaVer.ver'); await visorListo(p);
    const src = await p.getAttribute('#visor img', 'src').catch(() => null);
    ok(nombre + ': la imagen de Drive se ve dentro de la app', !!src && src.indexOf('blob:') === 0, src);
    ok(nombre + ': la pide a la función con el número del archivo', llamadasDrive(mundo).some((l) => l[1] === dImg.archivos[0].id));
    ok(nombre + ': la app nunca abre el enlace de Drive', aDrive.length === 0 && !(await p.content()).includes('drive.google.com'), aDrive);
    ok(nombre + ': Abrir completo usa el archivo bajado', ((await p.getAttribute('#abrirCompleto', 'href')) || '').indexOf('blob:') === 0);
    ok(nombre + ': el visor no desborda', await sinDesborde(p));
    await p.waitForTimeout(400); await p.screenshot({ path: 'capturas/09-' + nombre + '-imagen.png' });
    await cerrarTodo(p); await abrirCliente(p, 'Vidrios El Faro');

    // PDF: en escritorio se ve en el visor; en teléfono, botón para abrirlo
    await p.click('[data-ver="' + dPdf.id + '"]'); await p.waitForSelector('#hojaVer.ver'); await visorListo(p);
    if(pc) ok('pc: el PDF de Drive se ve en el visor', ((await p.getAttribute('#visor iframe', 'src').catch(() => '')) || '').indexOf('blob:') === 0);
    else ok('tel: el PDF de Drive se abre con un botón', ((await p.getAttribute('#visor a.btn', 'href').catch(() => '')) || '').indexOf('blob:') === 0 && (await p.textContent('#visor')).includes('Abrir el PDF'));
    ok(nombre + ': el nombre del archivo se muestra como texto', (await p.textContent('#hojaVer')).includes('onerror') && !(await p.evaluate(() => window.__xss)));
    await p.waitForTimeout(400); await p.screenshot({ path: 'capturas/09-' + nombre + '-pdf.png' });
    await cerrarTodo(p); await abrirCliente(p, 'Vidrios El Faro');

    // Word: no se puede ver, se ofrece descargar
    await p.click('[data-ver="' + dDocx.id + '"]'); await p.waitForSelector('#hojaVer.ver'); await visorListo(p);
    ok(nombre + ': un Word ofrece descargarlo', (await p.textContent('#visor')).includes('Descargar el archivo') && (await p.getAttribute('#visor a[download]', 'download')) === 'rif empresa.docx');
    const [bajada] = await Promise.all([p.waitForEvent('download'), p.click('#visor a[download]')]);
    ok(nombre + ': la descarga trae el nombre del archivo', bajada.suggestedFilename() === 'rif empresa.docx', bajada.suggestedFilename());
    await cerrarTodo(p); await abrirCliente(p, 'Vidrios El Faro');

    // El permiso de Google vencido: lo dice claro
    mundo.fallaDrive = 'El permiso de Google venció. Avísale al administrador';
    await p.click('[data-ver="' + dImg.id + '"]'); await p.waitForSelector('#hojaVer.ver'); await visorListo(p);
    ok(nombre + ': si Google falla dice qué hacer', (await p.textContent('#visor')).includes('Avísale al administrador') && (await p.locator('#abrirCompleto.hidden').count()) === 1);
    mundo.fallaDrive = null; await cerrarTodo(p); await abrirCliente(p, 'Vidrios El Faro');

    // Sin internet
    mundo.sinRed = true;
    await p.click('[data-ver="' + dImg.id + '"]'); await p.waitForSelector('#hojaVer.ver'); await visorListo(p);
    ok(nombre + ': sin internet lo dice', (await p.textContent('#visor')).includes('Sin conexión'));
    mundo.sinRed = false; await cerrarTodo(p);

    // Un archivo de un cliente que no es suyo no sale aunque se pida a mano
    const estado = await p.evaluate(async (id) => { const s = await db.auth.getSession(); const r = await fetch(db.supabaseUrl + '/functions/v1/drive_archivo', { method: 'POST', headers: { Authorization: 'Bearer ' + s.data.session.access_token, apikey: db.supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ archivo: id }) }); return r.status; }, archAjeno.id);
    ok(nombre + ': el archivo de un cliente ajeno se niega', estado === 403, estado);
    ok(nombre + ': sigue sin abrir Drive directo', aDrive.length === 0, aDrive);
    await ctx.close();
  }
  ok('sin errores de JavaScript', errores.length === 0, errores);
  await nav.close(); cerrar();
})().catch((e) => { console.error(e); process.exit(1); });
