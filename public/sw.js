// FITR's service worker: an offline page when the network is gone, and the
// wardrobe photos kept on the phone. Pages are rendered per profile on the
// server, so no other HTML is ever cached, and server actions (POSTs) pass
// straight through. Bump VERSION whenever this file changes so the old
// caches are dropped on update.
const VERSION = "fitr-v1";
const SHELL = `${VERSION}-shell`;
const IMAGES = `${VERSION}-images`;
const OFFLINE_URL = "/offline";
const MAX_IMAGES = 300;

// The offline page and the hashed scripts, styles and fonts it names: without
// them it would arrive unstyled and its retry button would never come alive.
async function precacheShell() {
  const cache = await caches.open(SHELL);
  const response = await fetch(OFFLINE_URL, { cache: "reload" });
  if (!response.ok) throw new Error(`Offline page answered ${response.status}`);
  const html = await response.clone().text();
  await cache.put(OFFLINE_URL, response);
  const assets = new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) ?? []);
  await Promise.all([...assets].map((url) => cache.add(url).catch(() => undefined)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !key.startsWith(`${VERSION}-`)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL, { cacheName: SHELL })));
  } else if (url.pathname.startsWith("/api/images/")) {
    event.respondWith(cachedImage(event, request));
  } else if (url.pathname.startsWith("/_next/static/")) {
    // Network first, so a new build's files are never shadowed; the cached
    // copies only stand in for the offline page.
    event.respondWith(fetch(request).catch(() => caches.match(request, { cacheName: SHELL }).then((hit) => hit ?? Response.error())));
  }
});

// Stored photos never change once written (a new picture gets a new path),
// so a cached copy is always right.
async function cachedImage(event, request) {
  const cache = await caches.open(IMAGES);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) event.waitUntil(cache.put(request, response.clone()).then(() => trim(cache)));
  return response;
}

// Keys come back oldest first, so the most recent MAX_IMAGES photos stay.
async function trim(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_IMAGES)).map((key) => cache.delete(key)));
}
