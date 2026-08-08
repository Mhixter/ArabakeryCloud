import { useEffect, useState } from "react";
import { useOffline } from "@/hooks/use-offline";
import { useQueryClient } from "@tanstack/react-query";
import { WifiOff, Wifi, RefreshCw, CheckCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function OfflineBanner() {
  const { isOnline, pendingCount, isSyncing, lastSyncAt, syncNow } = useOffline();
  const queryClient = useQueryClient();
  const [justSynced, setJustSynced] = useState(false);
  const [syncedCount, setSyncedCount] = useState(0);

  useEffect(() => {
    function handleSynced(e: Event) {
      const count = (e as CustomEvent<{ count: number }>).detail?.count ?? 0;
      if (count > 0) {
        setSyncedCount(count);
        setJustSynced(true);
        queryClient.invalidateQueries();
        setTimeout(() => setJustSynced(false), 4000);
      }
    }
    window.addEventListener("nmb:synced", handleSynced);
    return () => window.removeEventListener("nmb:synced", handleSynced);
  }, [queryClient]);

  const lastSyncLabel = lastSyncAt
    ? formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true })
    : null;

  /* Nothing to show when fully online, no pending items, not just synced */
  if (isOnline && pendingCount === 0 && !justSynced) return null;

  /* Synced flash */
  if (isOnline && justSynced) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 bg-green-500 text-white text-sm font-medium py-2 px-4 shadow-md">
        <CheckCircle className="h-4 w-4 flex-shrink-0" />
        {syncedCount > 0
          ? `${syncedCount} offline ${syncedCount === 1 ? "action" : "actions"} synced — data is up to date`
          : "Synced — data is up to date"}
      </div>
    );
  }

  /* Online but pending mutations */
  if (isOnline && pendingCount > 0) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 bg-amber-500 text-white text-sm font-medium py-2 px-4 shadow-md">
        <RefreshCw className={`h-4 w-4 flex-shrink-0 ${isSyncing ? "animate-spin" : ""}`} />
        {isSyncing
          ? `Syncing ${pendingCount} offline ${pendingCount === 1 ? "action" : "actions"}…`
          : `${pendingCount} offline ${pendingCount === 1 ? "action" : "actions"} pending`}
        {!isSyncing && (
          <button
            onClick={syncNow}
            className="ml-2 underline underline-offset-2 hover:no-underline font-semibold"
          >
            Sync now
          </button>
        )}
      </div>
    );
  }

  /* Offline */
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 bg-gray-700 text-white text-sm font-medium py-2 px-4 shadow-md">
      <WifiOff className="h-4 w-4 flex-shrink-0" />
      <span>
        You are offline
        {pendingCount > 0 && (
          <span className="ml-1 opacity-80">
            — {pendingCount} {pendingCount === 1 ? "action" : "actions"} queued
          </span>
        )}
      </span>
      {lastSyncLabel && (
        <span className="ml-2 flex items-center gap-1 text-xs opacity-70">
          <Clock className="h-3 w-3" />
          Last sync {lastSyncLabel}
        </span>
      )}
    </div>
  );
}

/* ── Small online/offline status dot for layout header ── */
export function OnlineStatusDot() {
  const { isOnline, pendingCount, lastSyncAt } = useOffline();

  const lastSyncLabel = lastSyncAt
    ? formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true })
    : "never";

  const title = isOnline
    ? `Online${lastSyncAt ? ` · Last sync ${lastSyncLabel}` : ""}`
    : `Offline${pendingCount > 0 ? ` · ${pendingCount} action${pendingCount > 1 ? "s" : ""} queued` : ""}`;

  return (
    <div
      className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-default select-none"
      title={title}
    >
      {isOnline ? (
        <Wifi className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <WifiOff className="h-3.5 w-3.5 text-gray-400" />
      )}
      <span className={isOnline ? "text-emerald-600" : "text-gray-400"}>
        {isOnline ? "Online" : "Offline"}
      </span>
      {isOnline && pendingCount > 0 && (
        <span className="text-amber-500">· {pendingCount} pending</span>
      )}
    </div>
  );
}
