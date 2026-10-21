// Service worker: la app abre desde el dispositivo y se actualiza por detrás.
// - Archivos con versión (assets/...?v=N): se guardan una vez y no se vuelven a pedir.
// - Páginas (HTML): se muestran desde el dispositivo si todos sus archivos con versión ya están guardados
//   (así nunca se mezcla una página vieja con archivos nuevos) y se piden de nuevo por detrás.
//   La versión nueva se ve en la siguiente apertura. Sin página guardada, o si falta algo, se pide a internet.
// - Los datos (Supabase) nunca pasan por aquí.
const CACHE = 'ae-archivos-v1';
const PAGINAS = 'ae-paginas-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

const esArchivo = (url) => url.searchParams.has('v') && /\/assets\//.test(url.pathname);
const esPagina = (req, url) => req.mode === 'navigate' && (/\.html$/.test(url.pathname) || /\/$/.test(url.pathname));
// La página se guarda sin la parte de búsqueda (?c=123): es el mismo archivo
const clavePagina = (url) => url.origin + url.pathname;
const versionados = (html, base) => (html.match(/(?:src|href)="(assets\/[^"]+\?v=[^"]+)"/g) || [])
  .map((m) => new URL(m.replace(/^(?:src|href)="|"$/g, ''), base).href);

async function guardarArchivo(c, req, r){
  const url = new URL(req.url);
  await c.put(req, r);
  // Se borran las otras versiones del mismo archivo
  const ks = await c.keys();
  await Promise.all(ks.filter((k) => { const u = new URL(k.url); return u.pathname === url.pathname && u.search !== url.search; }).map((k) => c.delete(k)));
}

async function archivo(req){
  const c = await caches.open(CACHE);
  const guardado = await c.match(req);
  if(guardado) return guardado;
  const r = await fetch(req);
  if(r.ok) guardarArchivo(c, req, r.clone()).catch(() => {});
  return r;
}

// Guarda la página junto con sus archivos con versión (primero los archivos, para no dejarla a medias)
async function guardarPagina(url, texto){
  const c = await caches.open(CACHE);
  await Promise.all(versionados(texto, url.href).map(async (a) => {
    if(await c.match(a)) return;
    try { const x = await fetch(a); if(x.ok) await guardarArchivo(c, new Request(a), x); } catch (e) {}
  }));
  await (await caches.open(PAGINAS)).put(clavePagina(url), new Response(texto, { headers: { 'content-type': 'text/html; charset=utf-8' } }));
}
const esHtml = (r) => r.ok && r.type === 'basic' && /text\/html/.test(r.headers.get('content-type') || '');
// Pide la página a internet por detrás y la deja guardada para la próxima vez
async function refrescarPagina(url){
  const r = await fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' });
  if(esHtml(r)) await guardarPagina(url, await r.text());
}

async function pagina(e, url){
  const p = await caches.open(PAGINAS);
  const guardada = await p.match(clavePagina(url));
  if(guardada){
    const texto = await guardada.clone().text();
    const c = await caches.open(CACHE);
    const completos = (await Promise.all(versionados(texto, url.href).map((a) => c.match(a)))).every(Boolean);
    if(completos){
      e.waitUntil(refrescarPagina(url).catch(() => {}));
      return guardada;
    }
  }
  try {
    const r = await fetch(e.request);
    if(esHtml(r)) e.waitUntil(r.clone().text().then((t) => guardarPagina(url, t)).catch(() => {}));
    return r;
  } catch (err) {
    if(guardada) return guardada;   // sin internet: mejor la página guardada que nada
    throw err;
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;
  if(esPagina(req, url)){ e.respondWith(pagina(e, url).catch(() => fetch(req))); return; }
  if(esArchivo(url)) e.respondWith(archivo(req).catch(() => fetch(req)));
});

// Para las pruebas (node): funciones puras
if(typeof module !== 'undefined') module.exports = { versionados, clavePagina, esPagina, esArchivo };

// Lote 22/10: avisos al teléfono y a la laptop (Web Push). Al tocar el aviso se abre la tarea exacta.
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (err) { d = { titulo: 'Airtek Empresas', texto: e.data ? e.data.text() : '' }; }
  const enlace = /^[a-z]+\.html(\?.*)?$/.test(d.enlace || '') ? d.enlace : 'trabajo.html';
  e.waitUntil(self.registration.showNotification(d.titulo || 'Airtek Empresas', { body: d.texto || '', icon: 'assets/img/icon-192.png', badge: 'assets/img/icon-192.png',
    tag: d.id ? 'aviso-' + d.id : 'avisos', data: { enlace } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.enlace) || 'trabajo.html', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((l) => {
    const w = l.find((c) => c.url.indexOf(self.registration.scope) === 0);
    if(w){ return w.navigate(url).then((x) => (x || w).focus()).catch(() => self.clients.openWindow(url)); }
    return self.clients.openWindow(url);
  }));
});
