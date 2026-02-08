const VERSION = "v2";
const ASSET_CACHE = `assets-${VERSION}`;
const MUSIC_CACHE = `music-${VERSION}`;

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(ASSET_CACHE).then((cache) => cache.addAll(ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => ![ASSET_CACHE, MUSIC_CACHE].includes(k))
            .map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  try {
    const fresh = await fetch(req);
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch (err) {
    if (cached) return cached;
    return new Response("", { status: 504 });
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(cacheFirst("./index.html", ASSET_CACHE));
    return;
  }

  if (url.pathname.includes("/musics/") || req.destination === "audio") {
    event.respondWith(cacheFirst(req, MUSIC_CACHE));
    return;
  }

  event.respondWith(cacheFirst(req, ASSET_CACHE));
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "CACHE_TRACKS") return;

  const urls = Array.isArray(data.urls) ? data.urls : [];
  event.waitUntil(
    (async () => {
      const cache = await caches.open(MUSIC_CACHE);
      let done = 0;

      for (const url of urls) {
        try {
          const res = await fetch(url, { cache: "reload" });
          if (res.ok) await cache.put(url, res.clone());
        } catch (err) {
          // Ignore individual failures.
        }
        done += 1;
        broadcast({ type: "CACHE_PROGRESS", done, total: urls.length });
      }

      broadcast({ type: "CACHE_DONE", total: urls.length });
    })(),
  );
});

async function broadcast(message) {
  const clients = await self.clients.matchAll();
  for (const client of clients) {
    client.postMessage(message);
  }
}
