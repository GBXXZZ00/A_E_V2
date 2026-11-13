// Capturas de todas las pantallas por cargo, a 1366x768 y en iPhone, para comparar antes y después de un lote.
// Datos inventados (simulador). Uso: servidor en la raíz y, desde pruebas/: node capturas-todas.js capturas/antes-13nov/
const { chromium, H, TEL, PC, contexto, pin } = require('./simulador');
const { mundoAliados } = require('./mundo-aliados');
const OUT = (process.argv[2] || 'capturas/antes/').replace(/\/?$/, '/');
const ALIADO = { id: '88888888-8888-4888-8888-888888888888', usuario: 'redes', pin: '571942', nombre: 'Redes Norte Ejemplo', rol: 'aliado', cargo: 'Aliado comercial', equipo: 'aliados', codigo_vendedor: null, nombre_odoo: null, activo: true, debe_cambiar_pin: false };
const CANALES = { id: '99999999-9999-4999-8999-999999999999', usuario: 'canal', pin: '640375', nombre: 'Carla Canales', rol: 'analista', canales: true, cargo: 'Coordinación de canales', equipo: 'ambos', codigo_vendedor: null, nombre_odoo: null, activo: true, debe_cambiar_pin: false };
const LEGAL = { id: '77777777-7777-4777-8777-777777777777', usuario: 'paula', pin: '615243', nombre: 'Paula Legal', rol: 'abogado', cargo: 'Legal', equipo: 'ventas', activo: true, debe_cambiar_pin: false };
const GERENCIA = { id: '77777777-7777-4777-8777-777777777700', usuario: 'gina', pin: '640218', nombre: 'Gina Paredes', rol: 'abogado', gerencia: true, cargo: 'Gerente', equipo: 'ambos', codigo_vendedor: null, nombre_odoo: null, activo: true, debe_cambiar_pin: false };

const PANT = {
  admin: { u: 'marcos', c: '482913', eq: 'ventas', p: [['inicio', 'inicio.html'], ['comisiones', 'comisiones.html'], ['comisiones-resumen', 'comisiones.html?v=resumen'], ['clientes', 'clientes.html'],
    ['ficha', 'clientes.html?c=1001&t=documentos'], ['revision', 'clientes.html?c=1001&t=documentos', 'rev'], ['trabajo', 'trabajo.html'], ['aliados', 'aliados.html'], ['migraciones', 'migraciones.html'],
    ['factibilidad', 'factibilidad.html'], ['gerencia', 'gerencia.html'], ['usuarios', 'usuarios.html'], ['actualizar', 'actualizar.html']] },
  lider: { u: 'lucia', c: '739105', eq: 'ventas', p: [['inicio', 'inicio.html'], ['comisiones', 'comisiones.html'], ['comisiones-resumen', 'comisiones.html?v=resumen'], ['clientes', 'clientes.html'], ['trabajo', 'trabajo.html'], ['aliados', 'aliados.html']] },
  senior: { u: 'elena', c: '315806', eq: 'ventas', p: [['trabajo', 'trabajo.html'], ['comisiones', 'comisiones.html']] },
  legal: { u: 'paula', c: '615243', eq: 'ventas', p: [['trabajo', 'trabajo.html'], ['clientes', 'clientes.html']] },
  canales: { u: 'canal', c: '640375', eq: 'ventas', p: [['trabajo', 'trabajo.html'], ['comisiones', 'comisiones.html']] },
  gerencia: { u: 'gina', c: '640218', eq: 'ventas', p: [['gerencia', 'gerencia.html']] },
  aliado: { u: 'redes', c: '571942', eq: 'aliados', p: [['aliados', 'aliados.html']] }
};
const solo = process.argv[3] ? process.argv[3].split(',') : null;

(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const nav = await chromium.launch(); let n = 0;
  for(const [disp, dev] of [['pc', PC], ['tel', TEL]]){
    for(const [cargo, d] of Object.entries(PANT)){
      if(solo && !solo.includes(cargo)) continue;
      const { ctx, mundo: m } = await contexto(nav, dev);
      m.personas.push(Object.assign({}, ALIADO), Object.assign({}, CANALES), Object.assign({}, LEGAL), Object.assign({}, GERENCIA)); mundoAliados(m, ALIADO, CANALES);
      const p = await ctx.newPage(); await p.goto(H + 'index.html'); await p.waitForSelector('#pasoEquipo:not(.hidden)');
      await p.click('[data-equipo="' + d.eq + '"]'); await p.fill('#usuario', d.u); await p.click('#seguir');
      await pin(p, d.c, disp === 'pc'); await p.waitForURL(/(inicio|aliados|gerencia)\.html/, { timeout: 15000 }).catch(() => {});
      for(const [nom, url, extra] of d.p){
        try {
          await p.goto(H + url); await p.waitForLoadState('networkidle').catch(() => {}); await p.waitForTimeout(1500);
          if(extra === 'rev'){ await p.click('#paso [data-paso="revisar"]', { timeout: 8000 }); await p.waitForSelector('#hojaVer.ver', { timeout: 8000 }); await p.waitForTimeout(900); }
          await p.screenshot({ path: OUT + disp + '-' + cargo + '-' + nom + '.png' }); n++;
        } catch (e) { console.log('NO: ' + disp + ' ' + cargo + ' ' + nom + ': ' + e.message.split('\n')[0]); }
      }
      await ctx.close();
    }
  }
  await nav.close(); console.log('capturas: ' + n + ' en ' + OUT);
})();
