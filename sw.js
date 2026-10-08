// Service worker: guarda en el dispositivo los archivos con versión (?v=N) para que abran al instante.
// Las páginas (HTML) y los datos siempre vienen de internet: nunca se ve una versión vieja.
const CACHE = 'ae-archivos-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.searchParams.has('v') || !/\/assets\//.test(url.pathname)) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const guardado = await c.match(req);
    if (guardado) return guardado;
    const r = await fetch(req);
    if (r.ok) {
      e.waitUntil(c.put(req, r.clone()).then(() => c.keys()).then((ks) => Promise.all(ks
        .filter((k) => { const u = new URL(k.url); return u.pathname === url.pathname && u.search !== url.search; })
        .map((k) => c.delete(k)))).catch(() => {}));
    }
    return r;
  }).catch(() => fetch(req)));
});
