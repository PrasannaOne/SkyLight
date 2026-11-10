/*
 * SkyLight offline shell + safe update lifecycle.
 * Bump CACHE_VERSION whenever app files change in a release.
 */
const CACHE_VERSION = 'v3';
const CACHE_NAME = `skylight-shell-${CACHE_VERSION}`;
const APP_SHELL = [
  './', './index.html', './manifest.webmanifest', './skylight-icon.svg',
  './favicon-16.png', './favicon-32.png', './icon-192.png', './icon-512.png',
  './apple-touch-icon.png', './skylight-preview.png'
];

self.addEventListener('install', event => {
  // Precache the complete app shell before the new worker can be offered.
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKYLIGHT_SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('skylight-shell-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Always try the network for navigations so published HTML is discovered;
  // fall back to the cached app shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(new URL('./index.html', self.registration.scope).href, response.clone());
        }
        return response;
      } catch (error) {
        const cached = await caches.match(new URL('./index.html', self.registration.scope).href);
        return cached || caches.match(new URL('./', self.registration.scope).href);
      }
    })());
    return;
  }

  // App-shell assets are cache-first for instant startup; missing assets are
  // fetched and cached. A new worker has its own versioned cache.
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
