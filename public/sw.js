const CACHE_NAME = 'oil-mart-v1';

self.addEventListener('install', () => {
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

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Oil Mart Alert', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Oil Mart Alert';
  const options = {
    body: payload.body || payload.message || 'Important POS update available.',
    icon: payload.icon || '/icons/icon-192x192.png',
    badge: payload.badge || '/icons/icon-192x192.png',
    tag: payload.tag || payload.id || 'oil-mart-alert',
    data: { url: payload.url || payload.href || '/' },
    requireInteraction: Boolean(payload.requireInteraction),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client && client.url.startsWith(self.location.origin)) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
