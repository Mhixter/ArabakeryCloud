---
name: Local-first offline mutations
description: How offline POSTs are stored locally and synced — design decisions and key implementation points
---

# Local-first offline mutation architecture

## Rule
Offline POSTs to /api/sales, /api/production, /api/expenses write directly to Dexie with syncStatus:'pending' and a negative ID (to avoid collision with positive server IDs). Other mutations (PUT/PATCH/DELETE, unknown routes) fall back to the old enqueue system.

**Why:** The old approach queued raw HTTP requests but didn't add pending records to the local DB tables, so list views showed empty/stale data when offline. Now pending records appear immediately in list views via the Dexie GET fallback.

**How to apply:** offline-intercept.ts handles this in handleOfflineMutation(). Sync is done by syncPendingRecords() in sync-service.ts — reads pending rows, POSTs to server, deletes the negative-ID record, saves server record as 'synced'. use-offline.ts calls both syncPendingRecords() and drainQueue() on reconnect for backward compat.

## Offline auth counter
storeOfflineSession() sets offlineLoginsRemaining:7. verifyOfflineLogin() decrements it; returns null when exhausted. getOfflineLoginInfo() lets login.tsx show the counter without consuming a login. storeOfflineSession() resets counter to 7 on every successful online login.

## DB version
local-db.ts version bumped 1→2. v2 adds syncStatus and localId indexes to sales/production/expenses and migrates existing records to syncStatus:'synced'.

## Sync badges
Pages show an amber "pending" badge (Clock icon) when (record as any).syncStatus === 'pending'. Covered: sales.tsx (receiptNumber column), production.tsx (breadType label), expenses.tsx (category badge row).
