import { enqueue } from "./offline-queue";
import { populateFromApiResponse, getOfflineFallback } from "./sync-service";

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

export function installOfflineInterceptor() {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async function offlineFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const method = resolveMethod(input, init);
    const url    = resolveUrl(input);

    /* ── Offline mutation queuing ────────────────────────────────────
       When the browser is offline and a mutation is attempted, enqueue
       it in IndexedDB and throw a typed error so TanStack Query / the
       MutationCache in App.tsx can show the "saved offline" toast.
       If the enqueue itself fails (e.g. storage full / IDB error) we
       throw a plain network error so the caller knows the action was
       NOT saved, preventing silent data loss.
    ─────────────────────────────────────────────────────────────────── */
    if (!navigator.onLine && MUTATION_METHODS.has(method) && url.includes("/api/")) {
      let body: string | null = null;
      if (init?.body) {
        body = typeof init.body === "string" ? init.body : null;
      } else if (input instanceof Request) {
        try { body = await input.clone().text(); } catch { body = null; }
      }

      let enqueued = false;
      try {
        await enqueue({ url, method, body, queuedAt: Date.now() });
        enqueued = true;
        window.dispatchEvent(new Event("nmb:queued"));
      } catch {
        // Enqueue failed — do NOT tell the user it was saved
      }

      if (enqueued) {
        // Return a synthetic 202 Accepted so the calling component's success
        // path runs (modal closes, form resets) rather than its catch block.
        // The nmb:queued event already updated the offline banner count.
        return new Response(JSON.stringify({ queued: true }), {
          status: 202,
          headers: { "Content-Type": "application/json", "X-Offline-Queued": "true" },
        });
      }

      // Enqueue failed — surface a real network error so callers can handle it
      throw new TypeError("Failed to fetch: offline and action could not be queued.");
    }

    /* ── GET request with offline read fallback ──────────────────────
       Attempt the real fetch (the service worker's NetworkFirst / SW
       cache will handle it when online or when the SW cache is warm).
       If the fetch throws (network error while offline OR SW cache
       miss), fall back to Dexie-cached data so the UI never shows a
       blank page.
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
        // Network failed — try Dexie fallback
        const fallback = await getOfflineFallback(url);
        if (fallback) return fallback;

        // Nothing in Dexie either — return an empty-array 200 so pages
        // show their empty state instead of crashing.
        return new Response("[]", {
          status: 200,
          headers: { "Content-Type": "application/json", "X-Offline-Cache": "empty" },
        });
      }
    }

    /* ── All other requests (non-API, or online mutations) ─────────── */
    return originalFetch(input, init);
  };
}
