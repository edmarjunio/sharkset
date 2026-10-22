const STATIC_CACHE = 'sharkset-static-v1';
const HASHED_ASSET = /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.add('/index.html')));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('sharkset-static-') && key !== STATIC_CACHE).map(key => caches.delete(key)),
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') ||
    /(^|\.)youtube(-nocookie)?\.com$/i.test(url.hostname) || /(^|\.)youtu\.be$/i.test(url.hostname)) return;

  if (HASHED_ASSET.test(url.pathname)) {
    event.respondWith(caches.open(STATIC_CACHE).then(async cache => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
      return response;
    }));
    return;
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(fetch(request).then(async response => {
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(STATIC_CACHE);
        await cache.put('/index.html', response.clone());
      }
      return response;
    }).catch(async () => (await caches.match('/index.html')) || Response.error()));
  }
});
