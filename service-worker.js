
const CACHE_VERSION = "pflegedok-v74";

const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.svg"
];

// App installieren
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

// Alte Caches löschen und neue Version aktivieren
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key =>
              key.startsWith("pflegedok-") &&
              key !== CACHE_VERSION
            )
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Dateien laden und zwischenspeichern
self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  // Bei Seitenaufrufen zuerst die aktuelle Version laden
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();

            caches.open(CACHE_VERSION)
              .then(cache =>
                cache.put("./index.html", copy)
              );
          }

          return response;
        })
        .catch(async () => {
          return (
            await caches.match("./index.html")
          ) || (
            await caches.match("./")
          );
        })
    );

    return;
  }

  // Andere App-Dateien aus dem Cache laden
  event.respondWith(
    caches.match(request)
      .then(async cached => {
        if (cached) return cached;

        const response = await fetch(request);

        if (response.ok) {
          const copy = response.clone();
          const cache = await caches.open(CACHE_VERSION);
          await cache.put(request, copy);
        }

        return response;
      })
  );
});
