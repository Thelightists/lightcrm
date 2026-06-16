// LightCRM Service Worker v2
const CACHE = "lightcrm-v2";
const ASSETS = ["/", "/index.html", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.url.includes("sheets.googleapis.com") ||
      e.request.url.includes("script.google.com")) return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
