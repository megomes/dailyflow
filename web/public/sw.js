/* DailyFlow service worker: offline shell. Data lives in IndexedDB; this only keeps the app loadable. */
const VERSION = 'df-v2';
const SHELL = ['/', '/settings/templates', '/settings/areas', '/settings/validation', '/settings/device', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION).then(cache => Promise.all(SHELL.map(u => cache.add(new Request(u, { credentials: 'include' })).catch(() => {})))).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Pages: network first, cached copy when offline (never cache a redirect to /login).
  // Keyed by path with Vary ignored: Next's HTML varies on RSC headers, so keying by the request
  // kept the install-time copy alongside newer ones and the offline fallback served that old build.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        if (res.ok && !res.redirected) {
          const copy = res.clone();
          caches.open(VERSION).then(async c => { await c.delete(url.pathname, { ignoreVary: true }); await c.put(url.pathname, copy); });
        }
        return res;
      }).catch(async () =>
        (await caches.match(url.pathname, { ignoreVary: true })) || (await caches.match('/', { ignoreVary: true })) || Response.error()),
    );
    return;
  }

  // Hashed build assets never change: cache first.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) caches.open(VERSION).then(c => c.put(req, res.clone()));
        return res;
      })),
    );
    return;
  }

  // Everything else (icons, fonts, manifest): stale while revalidate.
  event.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res.ok) caches.open(VERSION).then(c => c.put(req, res.clone()));
        return res;
      }).catch(() => hit);
      return hit || net;
    }),
  );
});
