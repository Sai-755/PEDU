const CACHE = 'pvgj-shell-v2';
const STATIC_FILES = ['/', '/index.html', '/manifest.webmanifest', '/pvgj-logo.png', '/pvgj-logo-light.png'];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(STATIC_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('pvgj-') && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  const isPublicApi = url.pathname.startsWith('/api/content/') || url.pathname === '/api/external-jobs';
  if (request.method !== 'GET' || (url.origin !== self.location.origin && !isPublicApi)) return;
  if (url.pathname.startsWith('/api/auth/') || url.pathname.startsWith('/api/learning/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match(request)) || (await caches.match('/'))));
    return;
  }
  if (isPublicApi) {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
      return response;
    }).catch(async () => (await caches.match(request)) || new Response(JSON.stringify({ items: [], jobs: [], offline: true }), { headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  if (['script','style','image'].includes(request.destination) || url.pathname === '/manifest.webmanifest') {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
      return response;
    })));
  }
});
