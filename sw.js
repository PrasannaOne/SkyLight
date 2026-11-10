/* SkyLight offline app shell. Only same-origin app files are cached. */
const CACHE_NAME = "skylight-shell-v2";
const APP_SHELL = [
  "./", "./index.html", "./manifest.webmanifest", "./skylight-icon.svg",
  "./favicon-16.png", "./favicon-32.png", "./icon-192.png", "./icon-512.png",
  "./apple-touch-icon.png", "./skylight-preview.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("skylight-shell-") && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(new URL("./index.html", self.registration.scope).href, copy));
        }
        return response;
      }).catch(async () => {
        const cached = await caches.match(new URL("./index.html", self.registration.scope).href);
        return cached || caches.match(new URL("./", self.registration.scope).href);
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
