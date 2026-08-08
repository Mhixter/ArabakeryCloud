const DB_NAME  = "nmb-offline-db";
const DB_VER   = 2;          // bump: added "conflicts" store
const PENDING  = "pending-mutations";
const CONFLICTS_STORE = "conflicts";

export interface QueuedMutation {
  id?:       number;
  url:       string;
  method:    string;
  body:      string | null;
  queuedAt:  number;
}

export interface ConflictRecord {
  id?:        number;
  mutation:   QueuedMutation;   // original offline mutation
  serverData: unknown;          // 409 body from server (current server state)
  label:      string;           // human-readable description
  message:    string;           // conflict message from server
  savedAt:    number;
}

export type DrainResult = {
  success:   number;
  failed:    number;
  conflicts: ConflictRecord[];
};

/* ── IDB ───────────────────────────────────────────────────────────── */

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(PENDING)) {
        db.createObjectStore(PENDING, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(CONFLICTS_STORE)) {
        db.createObjectStore(CONFLICTS_STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
  });
}

/* ── Pending mutations ─────────────────────────────────────────────── */

export async function enqueue(mutation: Omit<QueuedMutation, "id">): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(PENDING, "readwrite");
    const req = tx.objectStore(PENDING).add(mutation);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

export async function getPendingCount(): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(PENDING, "readonly");
    const req = tx.objectStore(PENDING).count();
    req.onsuccess = () => resolve(req.result as number);
    req.onerror   = () => reject(req.error);
  });
}

async function getAll(): Promise<QueuedMutation[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(PENDING, "readonly");
    const req = tx.objectStore(PENDING).getAll();
    req.onsuccess = () => resolve(req.result as QueuedMutation[]);
    req.onerror   = () => reject(req.error);
  });
}

async function removeById(id: number): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(PENDING, "readwrite");
    const req = tx.objectStore(PENDING).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

/* ── Conflicts ─────────────────────────────────────────────────────── */

export async function getConflicts(): Promise<ConflictRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(CONFLICTS_STORE, "readonly");
    const req = tx.objectStore(CONFLICTS_STORE).getAll();
    req.onsuccess = () => resolve(req.result as ConflictRecord[]);
    req.onerror   = () => reject(req.error);
  });
}

export async function saveConflict(conflict: Omit<ConflictRecord, "id">): Promise<ConflictRecord> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(CONFLICTS_STORE, "readwrite");
    const req = tx.objectStore(CONFLICTS_STORE).add(conflict);
    req.onsuccess = () => resolve({ ...conflict, id: req.result as number });
    req.onerror   = () => reject(req.error);
  });
}

export async function deleteConflict(id: number): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(CONFLICTS_STORE, "readwrite");
    const req = tx.objectStore(CONFLICTS_STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

/**
 * "Keep local" resolution: re-send the original mutation immediately,
 * but WITHOUT the X-Offline-Queued-At header so the server skips the
 * conflict check and accepts the local data unconditionally.
 */
export async function forceReplay(conflict: ConflictRecord): Promise<boolean> {
  try {
    const token   = localStorage.getItem("nmb_token");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const resp = await fetch(conflict.mutation.url, {
      method:  conflict.mutation.method,
      headers,
      body:    conflict.mutation.body ?? undefined,
    });

    if (resp.ok) {
      await deleteConflict(conflict.id!);
      window.dispatchEvent(new Event("nmb:conflicts-changed"));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * "Keep server" resolution: simply drop the conflict record — the server
 * already has the authoritative state.
 */
export async function discardConflict(id: number): Promise<void> {
  await deleteConflict(id);
  window.dispatchEvent(new Event("nmb:conflicts-changed"));
}

/* ── Helpers ───────────────────────────────────────────────────────── */

function buildConflictLabel(mutation: QueuedMutation): string {
  try {
    const path = mutation.url.replace(/\?.*$/, "");
    const body = mutation.body ? JSON.parse(mutation.body) : {};

    if (/\/api\/sales/.test(path) && mutation.method === "POST") {
      const price = body.pricePerUnit != null ? `₦${Number(body.pricePerUnit).toLocaleString()}` : "";
      return `Sale: ${body.quantity ?? "?"}× ${body.breadType ?? "product"}${price ? ` @ ${price}` : ""}`;
    }
    if (/\/api\/inventory\/\d+/.test(path) && mutation.method === "PATCH") {
      const itemId = path.match(/\/inventory\/(\d+)/)?.[1];
      const parts: string[] = [];
      if (body.name)             parts.push(`name → ${body.name}`);
      if (body.minimumQuantity != null) parts.push(`min qty → ${body.minimumQuantity}`);
      if (body.costPerUnit != null)     parts.push(`cost → ₦${body.costPerUnit}`);
      return `Inventory item #${itemId ?? "?"}: ${parts.join(", ") || "update"}`;
    }
    if (/\/api\/inventory\/\d+\/adjust/.test(path)) {
      const itemId = path.match(/\/inventory\/(\d+)/)?.[1];
      const sign   = Number(body.adjustment) > 0 ? "+" : "";
      return `Inventory adjust #${itemId ?? "?"}: ${sign}${body.adjustment} (${body.reason ?? ""})`;
    }
    if (/\/api\/production/.test(path) && mutation.method === "POST") {
      return `Production: ${body.quantityProduced ?? "?"}× ${body.breadType ?? "product"}`;
    }
    if (/\/api\/expenses/.test(path) && mutation.method === "POST") {
      return `Expense: ₦${body.amount ?? "?"} — ${body.description ?? ""}`;
    }
    return `${mutation.method} ${path}`;
  } catch {
    return `${mutation.method} ${mutation.url}`;
  }
}

/* ── Drain ─────────────────────────────────────────────────────────── */

export async function drainQueue(): Promise<DrainResult> {
  const items     = await getAll();
  let success     = 0;
  let failed      = 0;
  const conflicts: ConflictRecord[] = [];

  for (const item of items) {
    try {
      const token   = localStorage.getItem("nmb_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      // Tell the server when this mutation was originally queued so it can
      // detect if the underlying record was modified while we were offline.
      headers["X-Offline-Queued-At"] = String(item.queuedAt);

      const resp = await fetch(item.url, {
        method:  item.method,
        headers,
        body:    item.body ?? undefined,
      });

      if (resp.ok) {
        await removeById(item.id!);
        success++;
      } else if (resp.status === 409) {
        // Conflict — remove from pending queue (it won't succeed on retry)
        // and store it for the user to resolve.
        let serverPayload: unknown = null;
        let serverMessage          = "A conflict was detected while syncing this change.";
        try {
          const json  = await resp.json();
          serverPayload = json.serverData ?? json;
          serverMessage = json.message ?? json.error ?? serverMessage;
        } catch { /* non-JSON 409 */ }

        await removeById(item.id!);

        const conflict = await saveConflict({
          mutation:   item,
          serverData: serverPayload,
          label:      buildConflictLabel(item),
          message:    serverMessage,
          savedAt:    Date.now(),
        });
        conflicts.push(conflict);
        window.dispatchEvent(new Event("nmb:conflicts-changed"));
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { success, failed, conflicts };
}
