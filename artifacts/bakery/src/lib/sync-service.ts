/**
 * sync-service.ts
 * Two responsibilities:
 * 1. Mirror successful API responses into Dexie so the app has offline data.
 * 2. Serve Dexie data as a fallback when API GET requests fail (offline).
 */
import {
  localDb,
  saveProducts,
  saveSales,
  saveInventory,
  saveExpenses,
  saveAllocations,
  saveBranches,
  saveUsers,
  saveProduction,
  saveReturns,
  setCachedApiResponse,
  getCachedApiResponse,
  setLastSyncTime,
} from "./local-db";
import { getToken } from "./auth";

/* ── helpers ── */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}
function parseQS(url: string): Record<string, string> {
  const qs = url.split("?")[1] ?? "";
  return Object.fromEntries(new URLSearchParams(qs).entries());
}

/* ══════════════════════════════════════════════════════════════
   WRITE PATH — populate Dexie from a successful API response
   ══════════════════════════════════════════════════════════════ */

/**
 * Detect the resource type from the URL path and save to the right Dexie table.
 * Never throws — all failures are swallowed so they cannot break the UI.
 */
export async function populateFromApiResponse(
  urlPath: string,
  data: unknown,
): Promise<void> {
  if (!data) return;

  try {
    const path = urlPath.replace(/\?.*$/, "");

    if      (/\/api\/products\b/.test(path)) {
      const arr = isArray(data) ? data : (isRecord(data) && isArray(data["data"]) ? data["data"] : null);
      if (arr) await saveProducts(arr as Parameters<typeof saveProducts>[0]);
      await setCachedApiResponse("products", data);
    }
    else if (/\/api\/inventory\b/.test(path)) {
      const arr = isArray(data) ? data : null;
      if (arr) await saveInventory(arr as Parameters<typeof saveInventory>[0]);
      await setCachedApiResponse("inventory", data);
    }
    else if (/\/api\/sales\b/.test(path)) {
      const arr = isArray(data) ? data : null;
      if (arr) await saveSales(arr as Parameters<typeof saveSales>[0]);
      await setCachedApiResponse(`sales:${urlPath.replace(/.*\/api\//, "")}`, data);
    }
    else if (/\/api\/expenses\b/.test(path)) {
      const arr = isArray(data) ? data : null;
      if (arr) await saveExpenses(arr as Parameters<typeof saveExpenses>[0]);
      await setCachedApiResponse(`expenses:${urlPath.replace(/.*\/api\//, "")}`, data);
    }
    else if (/\/api\/allocations\b/.test(path)) {
      const arr = isArray(data) ? data : null;
      if (arr) await saveAllocations(arr as Parameters<typeof saveAllocations>[0]);
      await setCachedApiResponse("allocations", data);
    }
    else if (/\/api\/returns\b/.test(path)) {
      const arr = isArray(data) ? data : null;
      if (arr) await saveReturns(arr as Parameters<typeof saveReturns>[0]);
      await setCachedApiResponse("returns", data);
    }
    else if (/\/api\/branches\b/.test(path)) {
      const arr = isArray(data) ? data : null;
      if (arr) await saveBranches(arr as Parameters<typeof saveBranches>[0]);
      await setCachedApiResponse("branches", data);
    }
    else if (/\/api\/users\b/.test(path)) {
      const arr = isArray(data) ? data : null;
      if (arr) await saveUsers(arr as Parameters<typeof saveUsers>[0]);
      await setCachedApiResponse("users", data);
    }
    else if (/\/api\/production\b/.test(path)) {
      const arr = isArray(data) ? data : null;
      if (arr) await saveProduction(arr as Parameters<typeof saveProduction>[0]);
      await setCachedApiResponse(`production:${urlPath.replace(/.*\/api\//, "")}`, data);
    }
    else if (/\/api\/reports\b/.test(path) || /\/api\/dashboard\b/.test(path)) {
      await setCachedApiResponse(path.replace(/.*\/api\//, "api/"), data);
    }

    await setLastSyncTime();
  } catch {
    // Never let sync errors surface to the caller
  }
}

/* ══════════════════════════════════════════════════════════════
   READ PATH — serve Dexie data when API GETs fail offline
   ══════════════════════════════════════════════════════════════ */

/**
 * Given a URL that just failed (network error / offline), try to return
 * locally-cached data from Dexie.  Returns a synthetic 200 Response
 * containing the cached data, or null if nothing is cached.
 *
 * Callers should wrap the result in a real Response before returning to fetch.
 */
export async function getOfflineFallback(url: string): Promise<Response | null> {
  try {
    const path   = url.replace(/\?.*$/, "");
    const params = parseQS(url);
    const branchId = params["branchId"] ? Number(params["branchId"]) : null;

    let data: unknown = null;

    /* ── Products ── */
    if (/\/api\/products\b/.test(path)) {
      const cached = await getCachedApiResponse("products");
      if (cached !== null) {
        data = cached;
      } else {
        const rows = branchId
          ? await localDb.products.where("branchId").equals(branchId).toArray()
          : await localDb.products.toArray();
        data = rows;
      }
    }

    /* ── Inventory ── */
    else if (/\/api\/inventory\b/.test(path)) {
      const cached = await getCachedApiResponse("inventory");
      if (cached !== null) {
        data = cached;
      } else {
        const rows = branchId
          ? await localDb.inventory.where("branchId").equals(branchId).toArray()
          : await localDb.inventory.toArray();
        data = rows;
      }
    }

    /* ── Sales (optionally date-scoped from URL cache key first) ── */
    else if (/\/api\/sales\b/.test(path)) {
      const cacheKey = `sales:${url.replace(/.*\/api\//, "")}`;
      const cached = await getCachedApiResponse(cacheKey);
      if (cached !== null) {
        data = cached;
      } else {
        // Fall back to all local sales for this branch
        const rows = branchId
          ? await localDb.sales.where("branchId").equals(branchId).toArray()
          : await localDb.sales.toArray();
        data = rows;
      }
    }

    /* ── Expenses ── */
    else if (/\/api\/expenses\b/.test(path)) {
      const cacheKey = `expenses:${url.replace(/.*\/api\//, "")}`;
      const cached = await getCachedApiResponse(cacheKey);
      if (cached !== null) {
        data = cached;
      } else {
        const rows = branchId
          ? await localDb.expenses.where("branchId").equals(branchId).toArray()
          : await localDb.expenses.toArray();
        data = rows;
      }
    }

    /* ── Allocations ── */
    else if (/\/api\/allocations\b/.test(path)) {
      const cached = await getCachedApiResponse("allocations");
      data = cached ?? await localDb.allocations.toArray();
    }

    /* ── Returns pending count (must be checked before the broad /returns match) ── */
    else if (/\/api\/returns\/pending-count\b/.test(path)) {
      const all = await localDb.returns.where("status").equals("pending").count();
      data = { count: all };
    }

    /* ── Returns ── */
    else if (/\/api\/returns\b/.test(path)) {
      const cached = await getCachedApiResponse("returns");
      data = cached ?? await localDb.returns.toArray();
    }

    /* ── Branches ── */
    else if (/\/api\/branches\b/.test(path)) {
      const cached = await getCachedApiResponse("branches");
      data = cached ?? await localDb.branches.toArray();
    }

    /* ── Users ── */
    else if (/\/api\/users\b/.test(path)) {
      const cached = await getCachedApiResponse("users");
      data = cached ?? await localDb.users.toArray();
    }

    /* ── Production ── */
    else if (/\/api\/production\b/.test(path)) {
      const cacheKey = `production:${url.replace(/.*\/api\//, "")}`;
      const cached = await getCachedApiResponse(cacheKey);
      if (cached !== null) {
        data = cached;
      } else {
        const rows = branchId
          ? await localDb.production.where("branchId").equals(branchId).toArray()
          : await localDb.production.toArray();
        data = rows;
      }
    }

    /* ── Reports / dashboard (blob cache) ── */
    else if (/\/api\/reports\b/.test(path) || /\/api\/dashboard\b/.test(path)) {
      // Keep query parameters (especially branchId) so one branch cannot
      // reuse another branch's dashboard response while offline.
      const cacheKey = url.replace(/.*\/api\//, "api/");
      data = await getCachedApiResponse(cacheKey);
    }

    /* ── Returns/pending-count ── */
    else if (/\/api\/returns\/pending-count\b/.test(path)) {
      const all = await localDb.returns.where("status").equals("pending").count();
      data = { count: all };
    }

    if (data === null) return null;

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Offline-Cache": "dexie",
      },
    });
  } catch {
    return null;
  }
}

/* ══════════════════════════════════════════════════════════════
   SYNC PATH — push pending Dexie records to the server
   ══════════════════════════════════════════════════════════════ */

/**
 * Read all records with syncStatus='pending' from Dexie and POST them to the
 * server. On success, replaces the local (negative-ID) record with the real
 * server record and marks it 'synced'. On failure, marks it 'failed'.
 */
export async function syncPendingRecords(): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed  = 0;

  try {
    const token = getToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const [pendingSales, pendingProduction, pendingExpenses] = await Promise.all([
      localDb.sales.where("syncStatus").equals("pending").toArray(),
      localDb.production.where("syncStatus").equals("pending").toArray(),
      localDb.expenses.where("syncStatus").equals("pending").toArray(),
    ]);

    /* ── Sales ── */
    for (const sale of pendingSales) {
      try {
        const qty = sale.quantity || 1;
        const body = {
          breadType:     sale.breadType,
          quantity:      qty,
          pricePerUnit:  sale.totalAmount / qty,
          paymentMethod: sale.paymentMethod,
          branchId:      sale.branchId,
        };
        const res = await fetch("/api/sales", { method: "POST", headers, body: JSON.stringify(body) });
        if (res.ok) {
          const serverRecord = await res.json() as Record<string, unknown>;
          await localDb.sales.delete(sale.id);
          await localDb.sales.put({ ...serverRecord, syncStatus: "synced", _savedAt: Date.now() } as Parameters<typeof localDb.sales.put>[0]);
          success++;
        } else {
          await localDb.sales.update(sale.id, { syncStatus: "failed" });
          failed++;
        }
      } catch {
        try { await localDb.sales.update(sale.id, { syncStatus: "failed" }); } catch { /* ignore */ }
        failed++;
      }
    }

    /* ── Production ── */
    for (const batch of pendingProduction) {
      try {
        const body = {
          breadType:        batch.breadType,
          quantityProduced: batch.quantityProduced,
          wasteQuantity:    batch.wasteQuantity,
          productionDate:   batch.productionDate,
          branchId:         batch.branchId,
          notes:            batch.notes,
        };
        const res = await fetch("/api/production", { method: "POST", headers, body: JSON.stringify(body) });
        if (res.ok) {
          const serverRecord = await res.json() as Record<string, unknown>;
          await localDb.production.delete(batch.id);
          await localDb.production.put({ ...serverRecord, syncStatus: "synced", _savedAt: Date.now() } as Parameters<typeof localDb.production.put>[0]);
          success++;
        } else {
          await localDb.production.update(batch.id, { syncStatus: "failed" });
          failed++;
        }
      } catch {
        try { await localDb.production.update(batch.id, { syncStatus: "failed" }); } catch { /* ignore */ }
        failed++;
      }
    }

    /* ── Expenses ── */
    for (const expense of pendingExpenses) {
      try {
        const ext = expense as unknown as { expenseCategoryId?: number | null; workerId?: number | null };
        const body: Record<string, unknown> = {
          note:        expense.note,
          amount:      expense.amount,
          expenseDate: expense.expenseDate,
          branchId:    expense.branchId,
        };
        if (ext.expenseCategoryId) body.expenseCategoryId = ext.expenseCategoryId;
        if (ext.workerId)          body.workerId          = ext.workerId;

        const res = await fetch("/api/expenses", { method: "POST", headers, body: JSON.stringify(body) });
        if (res.ok) {
          const serverRecord = await res.json() as Record<string, unknown>;
          await localDb.expenses.delete(expense.id);
          await localDb.expenses.put({ ...serverRecord, syncStatus: "synced", _savedAt: Date.now() } as Parameters<typeof localDb.expenses.put>[0]);
          success++;
        } else {
          await localDb.expenses.update(expense.id, { syncStatus: "failed" });
          failed++;
        }
      } catch {
        try { await localDb.expenses.update(expense.id, { syncStatus: "failed" }); } catch { /* ignore */ }
        failed++;
      }
    }

    if (success > 0) await setLastSyncTime();
  } catch { /* outer guard */ }

  return { success, failed };
}
