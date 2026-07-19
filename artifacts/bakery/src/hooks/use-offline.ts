import { useState, useEffect, useCallback, useRef } from "react";
import { drainQueue, getPendingCount } from "@/lib/offline-queue";
import { getLastSyncTime } from "@/lib/local-db";

export interface OfflineState {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncAt: number | null;
  syncNow: () => Promise<void>;
}

export function useOffline(): OfflineState {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const syncingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {
      // ignore
    }
  }, []);

  const refreshLastSync = useCallback(async () => {
    try {
      const ts = await getLastSyncTime();
      setLastSyncAt(ts);
    } catch {
      // ignore
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const { success } = await drainQueue();
      if (success > 0) {
        window.dispatchEvent(new CustomEvent("nmb:synced", { detail: { count: success } }));
      }
      await refreshCount();
      await refreshLastSync();
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [refreshCount, refreshLastSync]);

  useEffect(() => {
    refreshCount();
    refreshLastSync();

    const handleOnline = () => {
      setIsOnline(true);
      syncNow();
    };
    const handleOffline = () => setIsOnline(false);
    const handleQueued  = () => refreshCount();
    const handleSynced  = () => refreshLastSync();

    window.addEventListener("online",      handleOnline);
    window.addEventListener("offline",     handleOffline);
    window.addEventListener("nmb:queued",  handleQueued);
    window.addEventListener("nmb:synced",  handleSynced);
    window.addEventListener("nmb:data-saved", handleSynced);

    const interval = setInterval(() => {
      refreshCount();
      refreshLastSync();
    }, 15_000);

    return () => {
      window.removeEventListener("online",       handleOnline);
      window.removeEventListener("offline",      handleOffline);
      window.removeEventListener("nmb:queued",   handleQueued);
      window.removeEventListener("nmb:synced",   handleSynced);
      window.removeEventListener("nmb:data-saved", handleSynced);
      clearInterval(interval);
    };
  }, [refreshCount, refreshLastSync, syncNow]);

  return { isOnline, pendingCount, isSyncing, lastSyncAt, syncNow };
}
