import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, RefreshCw, ServerCrash, Loader2 } from "lucide-react";
import { forceReplay, discardConflict, type ConflictRecord } from "@/lib/offline-queue";
import { useOffline } from "@/hooks/use-offline";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

/* ── individual conflict card ── */

function ConflictCard({ conflict, onResolved }: { conflict: ConflictRecord; onResolved: () => void }) {
  const [busy, setBusy] = useState<"keep" | "discard" | null>(null);
  const qc = useQueryClient();

  async function handleKeep() {
    setBusy("keep");
    try {
      const ok = await forceReplay(conflict);
      if (ok) {
        toast({ title: "Your version saved", description: conflict.label });
        qc.invalidateQueries();
        onResolved();
      } else {
        toast({ title: "Could not save", description: "The server rejected your version. Try again later.", variant: "destructive" });
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleDiscard() {
    setBusy("discard");
    try {
      await discardConflict(conflict.id!);
      toast({ title: "Change discarded", description: "The server version will be kept." });
      onResolved();
    } finally {
      setBusy(null);
    }
  }

  /* Attempt to render a readable server-state snippet */
  function ServerSnippet() {
    if (!conflict.serverData) return <span className="text-muted-foreground italic">No server data available</span>;
    const d = conflict.serverData as Record<string, unknown>;
    const lines: string[] = [];
    if (d.name != null)            lines.push(`Name: ${d.name}`);
    if (d.currentQuantity != null) lines.push(`Qty: ${d.currentQuantity}`);
    if (d.minimumQuantity != null) lines.push(`Min: ${d.minimumQuantity}`);
    if (d.costPerUnit != null)     lines.push(`Cost: ₦${d.costPerUnit}`);
    if (d.pricePerUnit != null)    lines.push(`Price: ₦${d.pricePerUnit}`);
    if (d.updatedAt != null)       lines.push(`Updated: ${new Date(d.updatedAt as string).toLocaleString()}`);
    return lines.length > 0
      ? <ul className="text-xs space-y-0.5">{lines.map(l => <li key={l} className="text-muted-foreground">{l}</li>)}</ul>
      : <span className="text-xs text-muted-foreground">{JSON.stringify(conflict.serverData).slice(0, 120)}</span>;
  }

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug">{conflict.label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{conflict.message}</p>
        </div>
        <Badge variant="outline" className="text-xs shrink-0">Conflict</Badge>
      </div>

      {/* Server state preview */}
      <div className="bg-muted/40 rounded p-2.5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <ServerCrash className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Server state (current)</span>
        </div>
        <ServerSnippet />
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
          disabled={busy !== null}
          onClick={handleDiscard}
        >
          {busy === "discard" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
          Keep server version
        </Button>
        <Button
          size="sm"
          className="flex-1 text-xs"
          disabled={busy !== null}
          onClick={handleKeep}
        >
          {busy === "keep" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
          Use my version
        </Button>
      </div>
    </div>
  );
}

/* ── exported dialog — mounts globally in App.tsx ── */

export function ConflictResolutionDialog() {
  const { conflicts } = useOffline();

  if (conflicts.length === 0) return null;

  return (
    <Dialog open>
      <DialogContent
        className="max-w-md max-h-[85vh] flex flex-col"
        /* No close button — user must resolve each conflict explicitly */
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Sync conflicts ({conflicts.length})
          </DialogTitle>
          <DialogDescription>
            Some changes you made offline conflict with updates made by others. 
            Choose how to resolve each one — your version or the server's current state.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 space-y-3 pr-1 mt-2">
          {conflicts.map((c) => (
            <ConflictCard
              key={c.id}
              conflict={c}
              onResolved={() => {
                /* useOffline auto-refreshes on nmb:conflicts-changed event */
              }}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
