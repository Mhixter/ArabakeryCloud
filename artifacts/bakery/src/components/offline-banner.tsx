import { useEffect, useState } from "react";
import { useOffline } from "@/hooks/use-offline";
import { useQueryClient } from "@tanstack/react-query";
import { WifiOff, RefreshCw, CheckCircle } from "lucide-react";

export default function OfflineBanner() {
  const { isOnline, pendingCount, isSyncing, syncNow } = useOffline();
  const queryClient = useQueryClient();
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    function handleSynced(e: Event) {
      const count = (e as CustomEvent<{ count: number }>).detail?.count ?? 0;
      if (count > 0) {
        setJustSynced(true);
        queryClient.invalidateQueries();
        setTimeout(() => setJustSynced(false), 3000);
      }
    }
    window.addEventListener("nmb:synced", handleSynced);
    return () => window.removeEventListener("nmb:synced", handleSynced);
  }, [queryClient]);

  if (isOnline && pendingCount === 0 && !justSynced) return null;

  if (isOnline && justSynced) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 bg-green-500 text-white text-sm font-medium py-2 px-4 shadow-md">
        <CheckCircle className="h-4 w-4" />
        Synced successfully — data is up to date
      </div>
    );
  }

  if (isOnline && pendingCount > 0) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 bg-amber-500 text-white text-sm font-medium py-2 px-4 shadow-md">
        <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
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

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 bg-gray-700 text-white text-sm font-medium py-2 px-4 shadow-md">
      <WifiOff className="h-4 w-4" />
      You are offline
      {pendingCount > 0 && (
        <span className="ml-1 opacity-80">
          — {pendingCount} {pendingCount === 1 ? "action" : "actions"} queued for sync
        </span>
      )}
    </div>
  );
}
