/**
 * T2W Service Worker
 *
 * Responsibilities:
 * 1. Cache the live-tracking page shell so it opens offline.
 * 2. On Background Sync ("flush-locations"), replay queued GPS pings to the
 *    server once connectivity is restored — even if the browser tab was closed.
 *
 * Background Sync is supported on Chrome/Edge (Android & desktop).
 * On Safari / Firefox the page falls back to the `online` event instead.
 */

const CACHE_NAME = "t2w-shell-v1";

// Pages / assets to pre-cache on install so the live-tracking UI opens offline.
const PRECACHE_URLS = ["/offline.html"];

// ── Lifecycle ──────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  // Remove old caches on activation
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch strategy ──────────────────────────────────────────────────────────
// Network-first for API calls; cache-first for same-origin pages/assets.

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Let non-GET and cross-origin requests pass through
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // API routes: network only (POST location, session state, etc.)
  if (url.pathname.startsWith("/api/")) return;

  // App pages: network-first, fall back to cache, fall back to offline page
  event.respondWith(
    fetch(request)
      .then((res) => {
        // Cache successful page responses
        if (res.ok && res.type === "basic") {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        return cached || caches.match("/offline.html");
      })
  );
});

// ── Background Sync ─────────────────────────────────────────────────────────

self.addEventListener("sync", (event) => {
  if (event.tag === "flush-locations") {
    event.waitUntil(flushLocationQueue());
  }
});

// ── IndexedDB helpers (duplicated from src/lib/location-queue.ts) ────────────
// The service worker runs in its own scope and cannot import TypeScript modules,
// so the DB access logic is intentionally repeated here in plain JS.

const DB_NAME = "t2w-tracking";
const STORE = "pending-locations";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("rideId", "rideId");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllPending(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () =>
      resolve(req.result.sort((a, b) => a.timestamp - b.timestamp));
    req.onerror = () => reject(req.error);
  });
}

async function removeByIds(db, ids) {
  if (!ids.length) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const id of ids) store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Replay every queued location ping in chronological order.
 * Stops on the first network failure so pings that haven't been sent yet stay
 * in the queue for the next sync attempt.
 */
async function flushLocationQueue() {
  let db;
  try {
    db = await openDB();
  } catch {
    return; // IndexedDB unavailable
  }

  const pending = await getAllPending(db);
  if (!pending.length) return;

  const sentIds = [];

  for (const loc of pending) {
    try {
      const res = await fetch(`/api/rides/${loc.rideId}/live/location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          lat: loc.lat,
          lng: loc.lng,
          speed: loc.speed ?? null,
          heading: loc.heading ?? null,
          accuracy: loc.accuracy ?? null,
        }),
      });

      // 2xx = success; 4xx = permanent client error (session ended, auth failed,
      // invalid data) — discard so the queue doesn't grow forever.
      // 5xx = server error — stop and retry on next sync.
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        sentIds.push(loc.id);
      } else {
        break; // server error — stop, retry on next sync
      }
    } catch {
      break; // network still down — stop here, remainder stays queued
    }
  }

  await removeByIds(db, sentIds);
}
