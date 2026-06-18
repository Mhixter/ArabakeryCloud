import { enqueue } from "./offline-queue";

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

    if (!navigator.onLine && MUTATION_METHODS.has(method)) {
      const url = resolveUrl(input);

      if (url.includes("/api/")) {
        let body: string | null = null;
        if (init?.body) {
          body = typeof init.body === "string" ? init.body : null;
        } else if (input instanceof Request) {
          try { body = await input.clone().text(); } catch { body = null; }
        }

        try {
          await enqueue({ url, method, body, queuedAt: Date.now() });
          window.dispatchEvent(new Event("nmb:queued"));
        } catch {
          // Queue failed — fall through to let the real fetch fail naturally
        }

        const err = new Error("Offline: action saved — will sync when reconnected.");
        (err as any).isOfflineQueued = true;
        throw err;
      }
    }

    return originalFetch(input, init);
  };
}
