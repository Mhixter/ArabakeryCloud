import { useState, useEffect, useCallback, useRef } from "react";
import { drainQueue, getPendingCount } from "@/lib/offline-queue";

export interface OfflineState {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  syncNow: () => Promise<void>;
}

export function useOffline(): OfflineState {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
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
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [refreshCount]);

  useEffect(() => {
    refreshCount();

    const handleOnline = () => {
      setIsOnline(true);
      syncNow();
    };
    const handleOffline = () => setIsOnline(false);
    const handleQueued = () => refreshCount();

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("nmb:queued", handleQueued);

    const interval = setInterval(refreshCount, 10000);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("nmb:queued", handleQueued);
      clearInterval(interval);
    };
  }, [refreshCount, syncNow]);

  return { isOnline, pendingCount, isSyncing, syncNow };
}
