---
name: PWA Service Worker Strategy
description: Why the bakery frontend uses injectManifest instead of generateSW for VitePWA, and how push events are handled.
---

VitePWA strategy is `injectManifest` (not `generateSW`).

**Why:** `generateSW` generates the SW automatically — you can't add custom event listeners (like `push` or `notificationclick`) to it. `injectManifest` lets you write a custom `src/sw.ts` that calls `precacheAndRoute(self.__WB_MANIFEST)` and also registers `push` / `notificationclick` handlers.

**How to apply:** Any new service worker behaviour (background sync, push, periodic sync) must go in `artifacts/bakery/src/sw.ts`. The precache manifest injection point is `self.__WB_MANIFEST`. Runtime caching routes are also defined there (not in vite.config.ts workbox key — that key is unused under injectManifest).

**VAPID keys** are stored as shared env vars: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VITE_VAPID_PUBLIC_KEY`. They were auto-generated; do not regenerate unless rotating credentials (all stored subscriptions break on rotation).
