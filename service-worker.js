
/* PflegeDok 7.4 – Service Worker
   HTML navigation: network first, never serve stale HTML from cache.
   Static assets: network first with offline cache fallback.
*/
const CACHE_VERSION = "pflegedok-v74-network-first-1";
const APP_FILES = ["./icon.svg", "./manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await Promise.allSettled(APP_FILES.map(async (url) => {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) await cache.put(url, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith("pflegedok-") && key !== CACHE_VERSION)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  // The application itself must always be fetched freshly.
  // Do not use a cached old index.html as offline fallback.
  if (request.mode === "navigate" ||
      new URL(request.url).pathname.endsWith("/index.html")) {
    event.respondWith(fetch(request, { cache: "no-store" }).catch(() =>
      new Response(
        "<!doctype html><html lang='de'><meta charset='utf-8'><title>PflegeDok offline</title><body><h2>Keine Netzwerkverbindung</h2><p>Bitte verbinde dich mit dem Internet und lade PflegeDok erneut.</p></body></html>",
        { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
      )
    ));
    return;
  }

  // Other same-origin assets: prefer network; use cached assets offline.
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_VERSION);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) return cached;
      throw error;
    }
  })());
});
