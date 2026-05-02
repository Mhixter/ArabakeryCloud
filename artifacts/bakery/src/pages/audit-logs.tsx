import { useState, useCallback } from "react";
import { useListAuditLogs, useListUsers } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText, Download, ChevronLeft, ChevronRight, Filter, X } from "lucide-react";
import { format } from "date-fns";

function downloadCSV(rows: Record<string, string | number>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map(r => headers.map(h => {
      const v = String(r[h] ?? "").replace(/"/g, '""');
      return v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v}"` : v;
    }).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const ACTION_COLORS: Record<string, string> = {
  SALE_CREATED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  RETURN_SUBMITTED: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  RETURN_APPROVED: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  RETURN_REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  INVENTORY_CREATED: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  INVENTORY_ADJUSTED: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  INVENTORY_DELETED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  PRODUCTION_RECORDED: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  ALLOCATION_CREATED: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  USER_CREATED: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  USER_UPDATED: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  USER_DELETED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  LOGIN: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  LOGOUT: "bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300",
};

const ACTION_OPTIONS = [
  "SALE_CREATED",
  "RETURN_SUBMITTED", "RETURN_APPROVED", "RETURN_REJECTED",
  "INVENTORY_CREATED", "INVENTORY_ADJUSTED", "INVENTORY_DELETED",
  "PRODUCTION_RECORDED",
  "ALLOCATION_CREATED",
  "USER_CREATED", "USER_UPDATED", "USER_DELETED",
  "LOGIN", "LOGOUT",
];

const PAGE_SIZE = 50;

export default function AuditLogsPage() {
  const [action, setAction] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const params = {
    action: action || undefined,
    userId: userId ? parseInt(userId) : undefined,
    startDate: startDate ? new Date(startDate).toISOString() : undefined,
    endDate: endDate ? new Date(endDate + "T23:59:59").toISOString() : undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  };

  const { data, isLoading } = useListAuditLogs(params);
  const { data: usersData } = useListUsers({});

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = !!(action || userId || startDate || endDate);

  const clearFilters = useCallback(() => {
    setAction("");
    setUserId("");
    setStartDate("");
    setEndDate("");
    setPage(0);
  }, []);

  return (
    <div className="space-y-6" data-testid="page-audit-logs">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Audit Logs</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Complete record of all system actions and changes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
            onClick={() => setShowFilters(v => !v)}>
            <Filter size={12} /> Filters {hasFilters && <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">{[action, userId, startDate, endDate].filter(Boolean).length}</Badge>}
          </Button>
          {logs.length > 0 && (
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
              onClick={() => downloadCSV(
                logs.map(l => ({
                  Date: format(new Date(l.createdAt), "dd/MM/yyyy HH:mm"),
                  Action: l.action,
                  Type: l.entityType,
                  ID: l.entityId ?? "",
                  Details: l.details ?? "",
                  "Performed By": l.userName ?? "System",
                })),
                `audit-logs-${format(new Date(), "yyyy-MM-dd")}.csv`
              )}>
              <Download size={12} /> Export CSV
            </Button>
          )}
        </div>
      </div>

      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Action Type</Label>
                <Select value={action} onValueChange={v => { setAction(v === "_all" ? "" : v); setPage(0); }}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All actions</SelectItem>
                    {ACTION_OPTIONS.map(a => (
                      <SelectItem key={a} value={a}>{a.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">User</Label>
                <Select value={userId} onValueChange={v => { setUserId(v === "_all" ? "" : v); setPage(0); }}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All users</SelectItem>
                    {(usersData ?? []).map(u => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">From Date</Label>
                <Input type="date" className="h-8 text-xs" value={startDate}
                  onChange={e => { setStartDate(e.target.value); setPage(0); }} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">To Date</Label>
                <Input type="date" className="h-8 text-xs" value={endDate}
                  onChange={e => { setEndDate(e.target.value); setPage(0); }} />
              </div>
            </div>
            {hasFilters && (
              <div className="mt-3 pt-3 border-t">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={clearFilters}>
                  <X size={11} /> Clear filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">
              Activity History
              {total > 0 && <span className="ml-2 text-sm font-normal text-muted-foreground">({total.toLocaleString()} records)</span>}
            </CardTitle>
            {totalPages > 1 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                  onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                  <ChevronLeft size={14} />
                </Button>
                <span>Page {page + 1} / {totalPages}</span>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                  <ChevronRight size={14} />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ScrollText size={36} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">{hasFilters ? "No logs match the selected filters." : "No audit logs yet."}</p>
              {hasFilters && (
                <Button variant="link" size="sm" className="mt-1 text-xs" onClick={clearFilters}>Clear filters</Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {logs.map((log) => (
                <div key={log.id} className="px-4 py-3 hover:bg-muted/30 transition-colors" data-testid={`row-log-${log.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${ACTION_COLORS[log.action] ?? "bg-muted text-muted-foreground"}`}>
                          {log.action.replace(/_/g, " ")}
                        </span>
                        <span className="text-sm font-medium text-foreground capitalize">{log.entityType?.replace(/_/g, " ")}</span>
                        {log.entityId && (
                          <span className="text-xs text-muted-foreground">#{log.entityId}</span>
                        )}
                      </div>
                      {log.details && (
                        <p className="text-xs text-muted-foreground mt-1 truncate max-w-md">{log.details}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs text-muted-foreground">by</span>
                        <span className="text-xs font-medium text-foreground">{log.userName ?? "System"}</span>
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
            <ChevronLeft size={14} className="mr-1" /> Previous
          </Button>
          <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
            Next <ChevronRight size={14} className="ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
