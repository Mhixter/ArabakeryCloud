import { useListAuditLogs } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollText } from "lucide-react";
import { format } from "date-fns";

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  UPDATE: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  DELETE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  LOGIN: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  LOGOUT: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
};

export default function AuditLogsPage() {
  const { data: logs, isLoading } = useListAuditLogs({});

  return (
    <div className="space-y-6" data-testid="page-audit-logs">
      <div>
        <h1 className="text-2xl font-serif font-bold text-foreground">Audit Logs</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Complete record of all system actions and changes</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Activity History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : !logs?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <ScrollText size={36} className="mx-auto mb-2 opacity-40" />
              <p>No audit logs yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {[...(logs ?? [])].reverse().map((log) => (
                <div key={log.id} className="px-4 py-3 hover:bg-muted/30 transition-colors" data-testid={`row-log-${log.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold tracking-wide ${ACTION_COLORS[log.action] ?? "bg-muted text-muted-foreground"}`}>
                          {log.action}
                        </span>
                        <span className="text-sm font-medium text-foreground">{log.entityType}</span>
                        {log.entityId && (
                          <span className="text-xs text-muted-foreground">#{log.entityId}</span>
                        )}
                      </div>
                      {log.details && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{log.details}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs text-muted-foreground">by</span>
                        <span className="text-xs font-medium text-foreground">{log.performedByName}</span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                      {format(new Date(log.createdAt), "dd/MM/yy HH:mm")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
