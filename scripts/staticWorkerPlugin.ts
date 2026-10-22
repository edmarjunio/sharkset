import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

/** Cache only this build's immutable assets and its public HTML shell. No API interception. */
export function staticWorkerPlugin(): Plugin {
  return {
    name: 'sharkset-static-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle).filter(name => name.startsWith('assets/'));
      const version = createHash('sha256').update(Object.values(bundle).map(item => item.type === 'chunk' ? item.code : String(item.source)).join('\n')).digest('hex').slice(0, 16);
      const source = `const CACHE = 'sharkset-static-${version}';
const ASSETS = new Set(${JSON.stringify(assets.map(name => '/' + name))});
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(async cache => {
    const response = await fetch('/index.html', { cache: 'reload' });
    if (response.ok && response.headers.get('content-type')?.includes('text/html')) await cache.put('/index.html', response);
  }));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('sharkset-static-') && key !== CACHE).map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('authorization') || url.pathname.startsWith('/api/') || url.pathname.startsWith('/__/')) return;
  if (ASSETS.has(url.pathname) && !url.search) {
    event.respondWith(caches.open(CACHE).then(async cache => {
      const hit = await cache.match(request); if (hit) return hit;
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
      return response;
    }));
  } else if (request.mode === 'navigate' && !url.pathname.includes('.')) {
    event.respondWith(fetch(request).catch(async () => (await caches.match('/index.html')) || Response.error()));
  }
});`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}
