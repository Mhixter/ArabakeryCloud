import { useState, useEffect, useCallback, useRef } from "react";
import { drainQueue, getPendingCount, getConflicts, type ConflictRecord } from "@/lib/offline-queue";
import { getLastSyncTime, getPendingLocalCount } from "@/lib/local-db";
import { syncPendingRecords } from "@/lib/sync-service";

export interface OfflineState {
  isOnline:     boolean;
  pendingCount: number;
  isSyncing:    boolean;
  lastSyncAt:   number | null;
  conflicts:    ConflictRecord[];
  syncNow:      () => Promise<void>;
}

export function useOffline(): OfflineState {
  const [isOnline,     setIsOnline]     = useState(() => navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing,    setIsSyncing]    = useState(false);
  const [lastSyncAt,   setLastSyncAt]   = useState<number | null>(null);
  const [conflicts,    setConflicts]    = useState<ConflictRecord[]>([]);
  const syncingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    try {
      const [local, queued] = await Promise.all([
        getPendingLocalCount().catch(() => 0),
        getPendingCount().catch(() => 0),
      ]);
      setPendingCount(local + queued);
    } catch { /* ignore */ }
  }, []);

  const refreshLastSync = useCallback(async () => {
    try { setLastSyncAt(await getLastSyncTime()); } catch { /* ignore */ }
  }, []);

  const refreshConflicts = useCallback(async () => {
    try { setConflicts(await getConflicts()); } catch { /* ignore */ }
  }, []);

  const syncNow = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const [dexieResult, queueResult] = await Promise.allSettled([
        syncPendingRecords(),
        drainQueue(),
      ]);
      const dexieSuccess = dexieResult.status === "fulfilled" ? dexieResult.value.success : 0;
      const queueSuccess = queueResult.status === "fulfilled" ? queueResult.value.success : 0;
      const total = dexieSuccess + queueSuccess;
      if (total > 0) {
        window.dispatchEvent(new CustomEvent("nmb:synced", { detail: { count: total } }));
      }
      await refreshCount();
      await refreshLastSync();
      await refreshConflicts();
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [refreshCount, refreshLastSync, refreshConflicts]);

  useEffect(() => {
    refreshCount();
    refreshLastSync();
    refreshConflicts();

    const handleOnline    = () => { setIsOnline(true);  syncNow(); };
    const handleOffline   = () => setIsOnline(false);
    const handleQueued    = () => refreshCount();
    const handleSynced    = () => { refreshLastSync(); refreshConflicts(); };
    const handleConflicts = () => refreshConflicts();

    window.addEventListener("online",                handleOnline);
    window.addEventListener("offline",               handleOffline);
    window.addEventListener("nmb:queued",            handleQueued);
    window.addEventListener("nmb:synced",            handleSynced);
    window.addEventListener("nmb:data-saved",        handleSynced);
    window.addEventListener("nmb:conflicts-changed", handleConflicts);

    const interval = setInterval(() => {
      refreshCount();
      refreshLastSync();
    }, 15_000);

    return () => {
      window.removeEventListener("online",                handleOnline);
      window.removeEventListener("offline",               handleOffline);
      window.removeEventListener("nmb:queued",            handleQueued);
      window.removeEventListener("nmb:synced",            handleSynced);
      window.removeEventListener("nmb:data-saved",        handleSynced);
      window.removeEventListener("nmb:conflicts-changed", handleConflicts);
      clearInterval(interval);
    };
  }, [refreshCount, refreshLastSync, refreshConflicts, syncNow]);

  return { isOnline, pendingCount, isSyncing, lastSyncAt, conflicts, syncNow };
}
