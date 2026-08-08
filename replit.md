# Ara Bakery Cloud

A complete offline-first bakery management platform for Nigerian bakeries. Built as a pnpm monorepo.

## Architecture

| Package | Role | Port |
|---|---|---|
| `artifacts/bakery` | React 19 + Vite 7 frontend (PWA) | 3000 |
| `artifacts/api-server` | Express + Drizzle ORM backend | 8080 |
| `lib/db` | Drizzle schema + PostgreSQL connection | — |
| `lib/api-client-react` | Orval-generated TanStack Query hooks | — |
| `lib/api-types` | Shared TypeScript types | — |

## Running Locally

```
pnpm install
PORT=8080 BASE_PATH=/api pnpm --filter @workspace/api-server run dev &
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/bakery run dev
```

The frontend proxies `/api` to `http://localhost:8080`.

## Required Secrets / Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | API server | Neon PostgreSQL connection string |
| `SESSION_SECRET` | API server | JWT signing secret |
| `VAPID_PUBLIC_KEY` | API server + frontend | Push notification public key |
| `VAPID_PRIVATE_KEY` | API server | Push notification private key |

## Offline-First Architecture

The app is a true offline-first PWA. After the first successful online login:

- **Service Worker** (Workbox `injectManifest`) — precaches all static assets and runtime-caches API GET responses using `StaleWhileRevalidate` (products, branches, users) and `NetworkFirst` (sales, inventory, production, dashboard).
- **Offline login** (`src/lib/offline-auth.ts`) — PBKDF2-hashed credentials stored in IndexedDB via Dexie. Allows login without network after first online sign-in.
- **Mutation queue** (`src/lib/offline-queue.ts`) — any create/update/delete made offline is enqueued in IndexedDB and drained automatically when connectivity returns.
- **Local database** (`src/lib/local-db.ts`) — Dexie database (`nmb-local-db`) mirrors products, inventory, sales, expenses, allocations, branches, users, production, and returns locally.
- **Sync service** (`src/lib/sync-service.ts`) — intercepts successful API responses and populates Dexie. Also wired into the TanStack Query `QueryCache.onSuccess` callback in `App.tsx`.
- **Offline interceptor** (`src/lib/offline-intercept.ts`) — monkey-patches `window.fetch` to queue mutations offline and populate Dexie from GET responses.
- **Offline banner** (`src/components/offline-banner.tsx`) — shows offline/syncing/synced status, pending mutation count, and last sync timestamp.

## Key Libraries

- **Frontend**: React 19, Vite 7, Tailwind CSS 4, TanStack Query v5, Workbox 7, Dexie 4, Framer Motion, Lucide, wouter
- **Backend**: Express, Drizzle ORM, PostgreSQL (Neon), jsonwebtoken, web-push, Zod

## Deployment

Hosted on Render (backend) and served as a static PWA (frontend). Database on Neon PostgreSQL.

## User Preferences

- Keep existing project structure — do not restructure or migrate the monorepo layout.
- Never change the UI, routes, database schema, API endpoints, auth flow, or existing business logic unless absolutely necessary.
- Only extend, never replace working code.

## Recent Functional Changes

- **Daily Remaining Bread by Type**
  - `GET /api/reports/product-dashboard` now supports `reportDate=YYYY-MM-DD` and computes **Remaining Bread by Type** for exactly that day.
  - If `reportDate` is omitted, the endpoint defaults to the server's current day.
  - Invalid `reportDate` returns `400` with a user-friendly error.

- **Supplier settlement flow**
  - Allocation responses now include `settlementStatus` (`UNSETTLED`/`SETTLED`) plus `settledAt` and `settledByName`.
  - `GET /api/allocations` defaults to `settlementStatus=UNSETTLED` (active dues), and accepts `SETTLED` or `ALL`.
  - Director-only settlement actions:
    - `PATCH /api/allocations/:id/settle` (alias: `/clear`)
    - `POST /api/allocations/settle-supplier` (alias: `/clear-supplier`)

- **Director in-app notifications for employee-created records**
  - Added `notifications` table in `lib/db/src/schema/notifications.ts` for persisted in-app notifications.
  - Employee-created operational records now create director notifications (sales, allocations, production, expenses, inventory).
  - Notification APIs:
    - `GET /api/notifications`
    - `PATCH /api/notifications/:id/read`
    - `POST /api/notifications/read-all`
