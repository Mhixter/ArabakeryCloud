import { enqueue } from "./offline-queue";
import { populateFromApiResponse, getOfflineFallback } from "./sync-service";
import { localDb } from "./local-db";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return (input as Request).url;
}

function resolveMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

/* ── Helpers for reading current user/branch from localStorage ── */
function _getUser(): Record<string, unknown> | null {
  try { return JSON.parse(localStorage.getItem("nmb_user") ?? "null"); } catch { return null; }
}
function _getActiveBranch(): Record<string, unknown> | null {
  try { return JSON.parse(localStorage.getItem("nmb_active_branch") ?? "null"); } catch { return null; }
}

/* ── Write an offline mutation to Dexie and return a synthetic record ── */
async function handleOfflineMutation(
  url: string,
  bodyStr: string,
): Promise<Record<string, unknown> | null> {
  try {
    const body   = JSON.parse(bodyStr) as Record<string, unknown>;
    const user   = _getUser();
    const branch = _getActiveBranch();
    const ts     = Date.now();
    // Negative ID guarantees no collision with positive server IDs
    const negId  = -(ts * 1000 + Math.floor(Math.random() * 1000));
    const localId = `loc-${ts}-${Math.random().toString(36).slice(2, 7)}`;

    /* ── Sales ── */
    if (/\/api\/sales\b/.test(url)) {
      const qty   = Number(body.quantity)   || 0;
      const price = Number(body.pricePerUnit) || 0;
      const record = {
        id:            negId,
        localId,
        syncStatus:    "pending" as const,
        receiptNumber: `OFF-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${ts % 100000}`,
        breadType:     String(body.breadType ?? ""),
        quantity:      qty,
        pricePerUnit:  price,
        totalAmount:   qty * price,
        paymentMethod: String(body.paymentMethod ?? "cash"),
        saleDate:      new Date().toISOString(),
        branchId:      body.branchId ? Number(body.branchId) : ((user?.branchId as number | undefined) ?? null),
        cashierName:   (user?.fullName as string | undefined) ?? null,
        branchName:    (branch?.name as string | undefined) ?? (user?.branchName as string | undefined) ?? null,
        _savedAt:      ts,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await localDb.sales.put(record as any);
      return record;
    }

    /* ── Production ── */
    if (/\/api\/production\b/.test(url)) {
      const produced = Number(body.quantityProduced) || 0;
      const waste    = Number(body.wasteQuantity)    || 0;
      const record = {
        id:               negId,
        localId,
        syncStatus:       "pending" as const,
        breadType:        String(body.breadType ?? ""),
        quantityProduced: produced,
        wasteQuantity:    waste,
        netQuantity:      produced - waste,
        productionDate:   new Date().toISOString(),
        staffName:        (user?.fullName as string | undefined) ?? null,
        branchName:       (branch?.name as string | undefined) ?? (user?.branchName as string | undefined) ?? null,
        branchId:         body.branchId ? Number(body.branchId) : ((user?.branchId as number | undefined) ?? null),
        notes:            body.notes ? String(body.notes) : null,
        _savedAt:         ts,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await localDb.production.put(record as any);
      return record;
    }

    /* ── Expenses ── */
    if (/\/api\/expenses\b/.test(url)) {
      const record = {
        id:               negId,
        localId,
        syncStatus:       "pending" as const,
        note:             String(body.note ?? ""),
        amount:           String(body.amount ?? "0"),
        expenseDate:      body.expenseDate ? String(body.expenseDate) : new Date().toISOString(),
        categoryName:     null as string | null,
        workerName:       null as string | null,
        workerCategoryName: null as string | null,
        // preserve IDs for sync replay
        expenseCategoryId: body.expenseCategoryId ? Number(body.expenseCategoryId) : null,
        workerId:          body.workerId           ? Number(body.workerId)           : null,
        branchId:         body.branchId ? Number(body.branchId) : ((user?.branchId as number | undefined) ?? null),
        branchName:       (branch?.name as string | undefined) ?? (user?.branchName as string | undefined) ?? null,
        _savedAt:         ts,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await localDb.expenses.put(record as any);
      return record;
    }

    return null;
  } catch {
    return null;
  }
}

export function installOfflineInterceptor() {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async function offlineFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const method = resolveMethod(input, init);
    const url    = resolveUrl(input);

    /* ── Offline mutation handling ────────────────────────────────────
       For POST to known mutable endpoints, write directly to Dexie with
       syncStatus:'pending' so the record appears immediately in offline
       list views. The sync service drains these when connectivity returns.
       For other mutations (PUT/PATCH/DELETE, unknown routes) we fall back
       to the old enqueue approach.
    ─────────────────────────────────────────────────────────────────── */
    if (!navigator.onLine && MUTATION_METHODS.has(method) && url.includes("/api/")) {
      let body: string | null = null;
      if (init?.body) {
        body = typeof init.body === "string" ? init.body : null;
      } else if (input instanceof Request) {
        try { body = await input.clone().text(); } catch { body = null; }
      }

      // Try local-first Dexie write for POST to known endpoints
      if (method === "POST" && body) {
        const localRecord = await handleOfflineMutation(url, body);
        if (localRecord) {
          window.dispatchEvent(new Event("nmb:queued"));
          return new Response(JSON.stringify(localRecord), {
            status: 200,
            headers: { "Content-Type": "application/json", "X-Offline-Pending": "true" },
          });
        }
      }

      // Fallback: enqueue raw request (covers PUT/PATCH/DELETE and unknown POSTs)
      let enqueued = false;
      try {
        await enqueue({ url, method, body, queuedAt: Date.now() });
        enqueued = true;
        window.dispatchEvent(new Event("nmb:queued"));
      } catch {
        // Enqueue failed — do NOT tell the user it was saved
      }

      if (enqueued) {
        return new Response(JSON.stringify({ queued: true }), {
          status: 202,
          headers: { "Content-Type": "application/json", "X-Offline-Queued": "true" },
        });
      }

      throw new TypeError("Failed to fetch: offline and action could not be saved.");
    }

    /* ── GET request with offline read fallback ──────────────────────
       Attempt the real fetch. If it throws (network error / SW miss),
       fall back to Dexie — which now includes any 'pending' records
       created offline, so lists stay populated.
    ─────────────────────────────────────────────────────────────────── */
    if (method === "GET" && url.includes("/api/")) {
      try {
        const response = await originalFetch(input, init);

        // Populate Dexie from successful responses (keeps local DB warm)
        if (response.ok) {
          const contentType = response.headers.get("content-type") ?? "";
          if (contentType.includes("application/json")) {
            response.clone().json().then((data: unknown) => {
              populateFromApiResponse(url, data).catch(() => {});
              window.dispatchEvent(new Event("nmb:data-saved"));
            }).catch(() => {});
          }
        }

        return response;
      } catch {
        // Network failed — try Dexie fallback (includes pending records)
        const fallback = await getOfflineFallback(url);
        if (fallback) return fallback;

        return new Response("[]", {
          status: 200,
          headers: { "Content-Type": "application/json", "X-Offline-Cache": "empty" },
        });
      }
    }

    /* ── All other requests ─────────────────────────────────────────── */
    return originalFetch(input, init);
  };
}
