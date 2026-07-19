---
name: Offline Conflict Resolution
description: How conflict detection and resolution work for offline mutations in the bakery PWA.
---

# Offline Conflict Resolution

## Rule
Any mutation replayed from the offline queue sends `X-Offline-Queued-At: <epochMs>` header. Server compares this against `updatedAt` of the affected record; returns 409 if the record changed after the mutation was queued. Frontend stores 409s in a durable IDB `conflicts` store and shows a dialog for user resolution.

**Why:** Silent data overwrites happen when a sale is queued offline and a product price or inventory item changes on the server in the meantime. The timestamp comparison catches this without requiring a distributed lock.

## Covered endpoints
- `PATCH /inventory/:id` — checks `inventoryItemsTable.updatedAt`
- `POST /inventory/:id/adjust` — checks `inventoryItemsTable.updatedAt`
- `POST /sales` — checks `productsTable.updatedAt` (catches price/availability change)

## 409 response shape
```json
{ "error": "Conflict", "message": "..human text..", "serverData": { ...current server record... } }
```

## Frontend files
- `src/lib/offline-queue.ts` — `ConflictRecord`, `drainQueue` (sends header + handles 409), `saveConflict`, `getConflicts`, `deleteConflict`, `forceReplay`, `discardConflict`
- `src/hooks/use-offline.ts` — exposes `conflicts: ConflictRecord[]`, refreshes on `nmb:conflicts-changed`
- `src/components/conflict-resolution-dialog.tsx` — blocks UI until user resolves; mounted in `App.tsx`

## IDB schema
- DB: `nmb-offline-db` version 2 (version 1 = pending-mutations only; version 2 adds conflicts store)
- Stores: `pending-mutations`, `conflicts`

## Resolution flow
- **Keep mine (forceReplay):** re-sends original mutation WITHOUT the timestamp header → server accepts unconditionally → removes conflict record
- **Keep server (discardConflict):** deletes conflict record → server state stands

## How to apply
- Add conflict checks to new PATCH/PUT/DELETE routes: fetch the record first, compare `record.updatedAt > new Date(parseInt(req.headers['x-offline-queued-at']))`, return 409 with `serverData` if true
- For new INSERT routes where a referenced record could change (e.g. price lookup): same check against the referenced record's `updatedAt`
