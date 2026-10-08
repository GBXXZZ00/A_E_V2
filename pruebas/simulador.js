// Supabase de mentira para las pruebas: no toca la base real y los PIN son inventados.
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const H = 'http://127.0.0.1:8765/';
const { baseDatos, RPC } = require('./mundo');
// Imagen PNG de 1 x 1 para simular un archivo guardado
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const ahora = () => Math.floor(Date.now() / 1000);
const jwt = (id) => b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: id, exp: ahora() + 3600, role: 'authenticated', aud: 'authenticated' }) + '.firma';

function basePersonas(){
  return [
    { id: '11111111-1111-4111-8111-111111111111', usuario: 'marcos', pin: '482913', nombre: 'Marcos Rivas', rol: 'admin', cargo: 'Administrador de contratos', equipo: 'ambos', codigo_vendedor: 1, nombre_odoo: null, activo: true, debe_cambiar_pin: false },
    { id: '22222222-2222-4222-8222-222222222222', usuario: 'lucia', pin: '739105', nombre: 'Lucía Ferrer', rol: 'lider', cargo: 'Líder de ventas', equipo: 'ventas', codigo_vendedor: null, nombre_odoo: 'Lucía Ferrer', activo: true, debe_cambiar_pin: false },
    { id: '33333333-3333-4333-8333-333333333333', usuario: 'pedro', pin: '204871', nombre: 'Pedro Salas', rol: 'analista', cargo: 'Analista de canales', equipo: 'ventas', codigo_vendedor: 5, nombre_odoo: 'Pedro Salas', activo: true, debe_cambiar_pin: true },
    { id: '66666666-6666-4666-8666-666666666666', usuario: 'elena', pin: '315806', nombre: 'Elena Soto', rol: 'analista', senior: true, cargo: 'Analista Senior', equipo: 'ambos', codigo_vendedor: null, nombre_odoo: null, whatsapp: null, correo: null, activo: true, debe_cambiar_pin: false },
    { id: '44444444-4444-4444-8444-444444444444', usuario: 'baja', pin: '918273', nombre: 'Cuenta De Baja', rol: 'lider', cargo: null, equipo: 'ventas', codigo_vendedor: null, nombre_odoo: null, activo: false, debe_cambiar_pin: false }
  ];
}

// Crea un contexto de navegador con Supabase simulado. "llamadas" guarda lo que la app pidió.
async function contexto(navegador, opciones, mundo){
  const ctx = await navegador.newContext(opciones || {});
  const m = mundo || { personas: basePersonas(), llamadas: [], sinRed: false, fallaPerfil: false, lento: 0 };
  if(!m.datos) m.datos = baseDatos();
  const sesionDe = (p) => ({ access_token: jwt(p.id), token_type: 'bearer', expires_in: 3600, expires_at: ahora() + 3600, refresh_token: 'r-' + p.id,
    user: { id: p.id, aud: 'authenticated', role: 'authenticated', email: p.usuario + '@aev2.app', user_metadata: {} } });
  const quien = (req) => { try { const t = (req.headers().authorization || '').split(' ')[1]; const sub = JSON.parse(Buffer.from(t.split('.')[1], 'base64url')).sub; return m.personas.find((p) => p.id === sub); } catch (e) { return null; } };
  await ctx.route('**/*.supabase.co/**', async (r) => {
    const req = r.request(); const u = decodeURIComponent(req.url());
    const cab = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': 'content-range' };
    const j = (x, st = 200) => r.fulfill({ status: st, contentType: 'application/json', headers: cab, body: JSON.stringify(x) });
    if(req.method() === 'OPTIONS') return r.fulfill({ status: 200, headers: cab, body: '' });
    if(m.sinRed) return r.abort('failed');
    const cuerpo = () => { try { return JSON.parse(req.postData() || '{}'); } catch (e) { return {}; } };
    if(u.includes('/auth/v1/token')){
      const b = cuerpo(); const p = m.personas.find((x) => x.usuario + '@aev2.app' === b.email);
      m.llamadas.push(['entrar', b.email]);
      if(p && p.pin === b.password && !p.activo) return j({ code: 400, error_code: 'user_banned', msg: 'User is banned' }, 400);
      if(!p || p.pin !== b.password) return j({ code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400);
      return j(sesionDe(p));
    }
    if(u.includes('/auth/v1/logout')) return r.fulfill({ status: 204, headers: cab, body: '' });
    if(u.includes('/auth/v1/user')){
      const p = quien(req); if(!p) return j({ msg: 'no' }, 401);
      if(req.method() === 'PUT'){
        const b = cuerpo(); m.llamadas.push(['pin', p.usuario, b.password]);
        if(b.password === p.pin) return j({ code: 422, error_code: 'same_password', msg: 'New password should be different from the old password.' }, 422);
        p.pin = b.password;
      }
      return j(sesionDe(p).user);
    }
    // Almacenamiento privado: subir, pedir enlace temporal y ver
    if(u.includes('/storage/v1/object/sign/expedientes/')){
      if(!quien(req)) return j({ message: 'no' }, 401);
      const ruta = u.split('/storage/v1/object/sign/expedientes/')[1].split('?')[0];
      m.llamadas.push(['firmar', ruta]);
      if(!m.datos.objetos.includes(ruta)) return j({ statusCode: '404', error: 'not_found', message: 'Object not found' }, 400);
      return j({ signedURL: '/object/sign/expedientes/' + ruta + '?token=prueba' });
    }
    if(u.includes('/storage/v1/object/expedientes/') && req.method() === 'POST'){
      if(!quien(req)) return j({ message: 'no' }, 401);
      const ruta = u.split('/storage/v1/object/expedientes/')[1].split('?')[0];
      if(m.fallaSubida) return j({ statusCode: '500', error: 'x', message: 'fallo' }, 500);
      m.datos.objetos.push(ruta); m.llamadas.push(['subir', ruta, (req.postDataBuffer() || Buffer.alloc(0)).length]);
      return j({ Key: 'expedientes/' + ruta, Id: 'x' });
    }
    if(u.includes('/storage/v1/object/sign/') && req.method() === 'GET') return r.fulfill({ status: 200, contentType: 'image/png', headers: cab, body: PNG });
    const rp = u.match(/\/rest\/v1\/rpc\/([a-z0-9_]+)/);
    if(rp && rp[1] !== 'pin_cambiado'){
      const yo = quien(req); const args = cuerpo(); m.llamadas.push(['rpc', rp[1], args]);
      if(!yo || !yo.activo) return j({ code: 'P0001', message: 'Tu sesión venció. Entra de nuevo' }, 400);
      if(m.fallaRpc === rp[1] || m.fallaRpc === '*') return j({ message: 'error interno' }, 500);
      if(m.lento) await new Promise((ok) => setTimeout(ok, m.lento));
      if(!RPC[rp[1]]) return j({ code: 'PGRST202', message: 'no existe' }, 404);
      const res = RPC[rp[1]](m, yo, args);
      if(res && res.__error) return j(res.__error, 400);
      return j(res === undefined ? null : res);
    }
    if(u.includes('/rest/v1/rpc/pin_cambiado')){ const p = quien(req); if(p) p.debe_cambiar_pin = false; m.llamadas.push(['pin_cambiado', p && p.usuario]); return j(null); }
    if(u.includes('/rest/v1/perfiles')){
      if(m.fallaPerfil) return j({ message: 'error interno' }, 500);
      const p = quien(req); if(!p) return j([]);
      const fila = Object.assign({}, p); delete fila.pin;
      return (req.headers().accept || '').includes('vnd.pgrst.object') ? j(fila) : j([fila]);
    }
    if(u.includes('/functions/v1/gestionar_usuarios')){
      const yo = quien(req); const b = cuerpo(); m.llamadas.push(['usuarios', b]);
      if(!yo || yo.rol !== 'admin') return j({ error: 'Solo el administrador puede hacer esto' }, 403);
      if(b.accion === 'listar') return j({ usuarios: m.personas.map((p) => { const f = Object.assign({}, p); delete f.pin; return f; }) });
      if(b.accion === 'crear'){
        if(m.personas.some((p) => p.usuario === b.usuario)) return j({ error: 'Ese usuario ya existe' }, 400);
        m.personas.push({ id: '55555555-5555-4555-8555-55555555555' + m.personas.length, usuario: b.usuario, pin: b.pin, nombre: b.nombre, rol: b.rol, cargo: b.cargo || null, equipo: b.equipo, codigo_vendedor: b.codigo_vendedor, nombre_odoo: b.nombre_odoo || null, activo: true, debe_cambiar_pin: true });
        return j({ ok: true });
      }
      const p = m.personas.find((x) => x.id === b.id); if(!p) return j({ error: 'Falta el usuario' }, 400);
      if(b.accion === 'editar'){ Object.assign(p, { nombre: b.nombre, rol: b.rol, cargo: b.cargo || null, equipo: b.equipo, codigo_vendedor: b.codigo_vendedor, nombre_odoo: b.nombre_odoo || null }); return j({ ok: true }); }
      if(b.accion === 'pin'){ p.pin = b.pin; p.debe_cambiar_pin = true; return j({ ok: true }); }
      if(b.accion === 'activo'){ p.activo = b.activo; return j({ ok: true }); }
      return j({ error: 'Acción no reconocida' }, 400);
    }
    return j([]);
  });
  return { ctx, mundo: m };
}

function marcador(){
  const res = []; let fallas = 0;
  const ok = (nombre, cond, extra) => { res.push((cond ? 'OK    ' : 'FALLA ') + nombre + (extra !== undefined && !cond ? '  → ' + JSON.stringify(extra) : '')); if(!cond) fallas++; };
  const cerrar = () => { console.log(res.join('\n')); console.log(fallas ? '\n' + fallas + ' FALLA(S)' : '\nTODO OK'); process.exit(fallas ? 1 : 0); };
  return { ok, cerrar };
}
const TEL = { ...devices['iPhone 13'] };
const PC = { viewport: { width: 1366, height: 768 } };
// Escribe un PIN con el teclado de la pantalla (teléfono) o con el teclado físico (escritorio)
async function pin(pagina, numeros, escritorio){
  if(escritorio){ await pagina.locator('#pinCampo').focus(); await pagina.keyboard.type(numeros, { delay: 15 }); }
  else for(const n of numeros) await pagina.locator('.tecla[data-k="' + n + '"]').click();
}
const sinDesborde = (pagina) => pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
// Entra por la pantalla de acceso y deja la página en Inicio
async function entrar(ctx, usuario, clave){
  const p = await ctx.newPage();
  await p.goto(H + 'index.html'); await p.waitForSelector('#pasoEquipo:not(.hidden)');
  await p.click('[data-equipo="ventas"]'); await p.fill('#usuario', usuario); await p.click('#seguir');
  const pc = await p.evaluate(() => window.matchMedia('(min-width:900px)').matches);
  await pin(p, clave, pc); await p.waitForURL('**/inicio.html');
  return p;
}
module.exports = { chromium, H, TEL, PC, contexto, marcador, pin, sinDesborde, basePersonas, entrar };
