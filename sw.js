// Legacy service worker cleanup.
// Previous versions of this demo registered a caching service worker at this
// path. This script replaces it, clears the old caches, and unregisters itself.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
    })()
  );
});
