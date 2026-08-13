const CACHE_NAME = 'oil-mart-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // We only cache GET requests
  if (event.request.method !== 'GET') return;

  // We explicitly IGNORE /api/ routes in the Service Worker.
  // Our application code (api-client.ts) handles /api/ caching manually via LocalStorage.
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Network-first strategy for HTML pages, cache-first for static assets
      const isHtml = event.request.headers.get('accept')?.includes('text/html');
      
      if (isHtml) {
        return fetch(event.request)
          .then((response) => {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
            return response;
          })
          .catch(() => cachedResponse || new Response('Offline', { status: 503 }));
      }

      // For JS, CSS, Images: Try Cache first, then Network
      return cachedResponse || fetch(event.request).then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      }).catch((e) => {
        console.warn('[SW] Fetch failed for', event.request.url, e);
      });
    })
  );
});
