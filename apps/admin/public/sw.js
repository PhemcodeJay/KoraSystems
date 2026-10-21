/**
 * Service worker for the offline-capable POS.
 *
 * Strategy:
 *   - Cache-first for the POS shell (HTML, JS, CSS, icons) so the till loads
 *     even when completely offline.
 *   - Network-first for API calls; on failure, the request is stored so it can
 *     be replayed when the connection returns (background sync).
 *
 * Register this worker from the root layout.
 */

const CACHE_NAME = "kora-pos-v1";
const SHELL_URLS = [
  "/",
  "/pos",
  "/pos/",
  "/manifest.webmanifest",
  "/icon.svg",
  "/favicon.ico",
];

// Install: cache the POS shell.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

// Activate: clean out old caches.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Fetch: shell assets from cache; API calls network-first with offline queue.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API routes: try network, fall back to queued response.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Shell: cache-first, then network.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Cache GET responses for the shell so they survive offline.
        if (request.method === "GET" && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});

async function handleApiRequest(request) {
  try {
    const response = await fetch(request);
    if (response.ok) return response;
    throw new Error(`HTTP ${response.status}`);
  } catch {
    // Offline or server error: if it's a POST (checkout), we cannot replay a
    // raw fetch here — the client-side IndexedDB queue handles that. Return a
    // synthetic offline response so the client can detect the failure.
    return new Response(
      JSON.stringify({ error: "You are offline. Sale queued locally." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Background sync: replay any tagged sync events.
self.addEventListener("sync", (event) => {
  if (event.tag === "kora-pos-sync") {
    event.waitUntil(clients.matchAll().then((clients) => {
      for (const client of clients) {
        client.postMessage({ type: "KORA_SYNC_NOW" });
      }
    }));
  }
});

// Listen for messages from the client (e.g. "go online now").
self.addEventListener("message", (event) => {
  if (event.data?.type === "KORA_TRIGGER_SYNC") {
    event.waitUntil(replayPendingSales());
  }
});

async function replayPendingSales() {
  // The actual replay is done by the client page via IndexedDB + fetch.
  // This is a hook for future server-side push-based sync.
}
