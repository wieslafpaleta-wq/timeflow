/**
 * TimeFlow Service Worker
 * Obsługuje cache aplikacji i umożliwia działanie offline
 */

const CACHE_NAME = 'timeflow-v1.2';

// Zasoby do cache'owania przy instalacji
const STATIC_ASSETS = [
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

// ─── INSTALACJA ───────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Instalacja...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cache otwarte, dodaję zasoby...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting()) // Aktywuj od razu bez czekania
  );
});

// ─── AKTYWACJA ────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Aktywacja...');
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        // Usuń stare wersje cache
        keys.filter(key => key !== CACHE_NAME)
            .map(key => {
              console.log('[SW] Usuwam stary cache:', key);
              return caches.delete(key);
            })
      ))
      .then(() => self.clients.claim()) // Przejmij kontrolę nad wszystkimi zakładkami
  );
});

// ─── FETCH (STRATEGIA: CACHE FIRST, FALLBACK DO SIECI) ───────────────────────
self.addEventListener('fetch', event => {
  // Ignoruj żądania nie-HTTP (chrome-extension, itp.)
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Jeśli mamy w cache – zwróć od razu
        if (cachedResponse) {
          return cachedResponse;
        }

        // W przeciwnym razie pobierz z sieci i dodaj do cache
        return fetch(event.request)
          .then(networkResponse => {
            // Tylko GET cachujemy
            if (event.request.method !== 'GET') return networkResponse;

            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, responseToCache));

            return networkResponse;
          })
          .catch(() => {
            // Offline fallback dla HTML
            if (event.request.headers.get('accept')?.includes('text/html')) {
              return caches.match('./index.html');
            }
          });
      })
  );
});

// ─── SYNC / BACKGROUND ───────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
