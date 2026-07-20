/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { StaleWhileRevalidate, NetworkFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

/* ─── SPA Navigation fallback ───────────────────────────────────────
   Without this, Chrome shows its own "You're offline" screen when the
   user opens the app offline because the SW has no handler for HTML
   navigation requests. This tells the SW to serve the cached index.html
   for every page navigation — the React router then renders the right page.
─────────────────────────────────────────────────────────────────────── */
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html")));

/* ─── Runtime caching (mirrors vite.config.ts workbox settings) ─── */
registerRoute(
  ({ url }) => /\/api\/(products|branches|users)\b/.test(url.pathname),
  new StaleWhileRevalidate({
    cacheName: "ara-api-static",
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 7 * 86400 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

registerRoute(
  ({ url }) => /\/api\/(sales|production|inventory|allocations|returns|reports|dashboard)\b/.test(url.pathname),
  new NetworkFirst({
    cacheName: "ara-api-dynamic",
    networkTimeoutSeconds: 6,
    plugins: [
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 24 * 3600 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

registerRoute(
  ({ url }) => url.pathname.startsWith("/api/"),
  new NetworkFirst({
    cacheName: "ara-api-other",
    networkTimeoutSeconds: 8,
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 86400 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

/* ─── Push notifications ─── */
self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) return;

  let payload: { title?: string; body?: string; url?: string; tag?: string };
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "New Model Bread", body: event.data.text() };
  }

  const title = payload.title ?? "New Model Bread";
  const options: NotificationOptions = {
    body: payload.body ?? "",
    icon: "/icons/icon.svg",
    badge: "/icons/icon.svg",
    tag: payload.tag ?? "nmb-notification",
    data: { url: payload.url ?? "/dashboard" },
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url: string = event.notification.data?.url ?? "/dashboard";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url.includes(url));
        if (existing) return existing.focus();
        return self.clients.openWindow(url);
      }),
  );
});
