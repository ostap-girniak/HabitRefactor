// Catalyst Forge — Service Worker
// Handles push notifications and basic offline caching

const CACHE_NAME = "catalyst-forge-v2";
const STATIC_ASSETS = ["/", "/dashboard", "/login", "/register", "/offline.html"];

// Install: cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Push notifications
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || "Time to check in, warrior.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    vibrate: [200, 100, 200],
    data: { url: data.url || "/dashboard" },
    actions: [
      { action: "checkin", title: "✓ Check In" },
      { action: "dismiss", title: "Later" },
    ],
    tag: data.tag || "catalyst-notification",
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || "🔥 Catalyst Forge",
      options
    )
  );
});

// Notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/dashboard";

  if (event.action === "checkin") {
    event.waitUntil(clients.openWindow("/checkin"));
  } else {
    event.waitUntil(clients.openWindow(url));
  }
});

// Dynamic caching for Next.js assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // DISABLE CACHE FOR LOCALHOST (DEVELOPMENT)
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return;
  }

  // Only handle GET requests
  if (request.method !== "GET") return;

  // API calls: Network-only (we want fresh data for API)
  if (url.pathname.startsWith("/api")) return;

  // Next.js static assets and images: Cache First, fallback to Network
  if (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/images/") || url.pathname.includes("logo")) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // HTML pages: Network First, fallback to Cache (Offline mode)
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Cache the latest version
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
        }
        return networkResponse;
      })
      .catch(async () => {
        // Fallback to cache if network fails
        const cachedResponse = await caches.match(request);
        if (cachedResponse) return cachedResponse;
        
        // If it's a page request and we don't have it in cache, show offline fallback
        if (request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html")) {
          return caches.match("/offline.html");
        }
      })
  );
});
