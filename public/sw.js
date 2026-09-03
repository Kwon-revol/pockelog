/* global caches, fetch, self */

const CACHE_PREFIX = "pockelog-static-";
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const PUBLIC_ICON_PATHS = new Set([
  "/favicon.ico",
  "/apple-icon",
  "/icons/pockelog-192.png",
  "/icons/pockelog-512.png",
  "/icons/pockelog-maskable-192.png",
  "/icons/pockelog-maskable-512.png",
]);
const PRECACHE_URLS = [...PUBLIC_ICON_PATHS].filter((path) =>
  path.startsWith("/icons/"),
);

function isCacheableRequest(request) {
  if (
    request.method !== "GET"
    || request.mode === "navigate"
    || request.destination === "document"
  ) {
    return false;
  }

  const url = new URL(request.url);
  return url.origin === self.location.origin
    && (
      url.pathname.startsWith("/_next/static/")
      || PUBLIC_ICON_PATHS.has(url.pathname)
    );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter(
              (name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME,
            )
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (!isCacheableRequest(event.request)) return;

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;

    const response = await fetch(event.request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(event.request, response.clone());
    }

    return response;
  })());
});
