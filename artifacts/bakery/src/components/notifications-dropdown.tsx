import { useState, useRef, useEffect } from "react";
import { Bell, Package, CreditCard, PackageCheck, X, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { getToken } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { API_BASE } from "@/lib/api";

interface AppNotification {
  id: string;
  type: "warning" | "info" | "danger" | "success";
  category: "inventory" | "subscription" | "allocation" | "activity";
  title: string;
  message: string;
  link?: string;
  createdAt: string;
}

const SEEN_KEY = "nmb_seen_notifications";

function getSeenIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]")); } catch { return new Set(); }
}
function markSeen(ids: string[]) {
  try {
    const all = getSeenIds();
    ids.forEach(id => all.add(id));
    localStorage.setItem(SEEN_KEY, JSON.stringify([...all].slice(-200)));
  } catch {}
}

const TYPE_STYLES: Record<string, string> = {
  danger:  "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800",
  warning: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
  info:    "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",
  success: "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800",
};

const DOT_STYLES: Record<string, string> = {
  danger:  "bg-red-500",
  warning: "bg-amber-500",
  info:    "bg-blue-500",
  success: "bg-green-500",
};

const CATEGORY_ICON: Record<string, React.ElementType> = {
  inventory:    Package,
  subscription: CreditCard,
  allocation:   PackageCheck,
  activity:     Bell,
};

export default function NotificationsDropdown({ themeClass }: { themeClass?: string }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const seenIds = getSeenIds();
  const unreadCount = notifications.filter(n => !seenIds.has(n.id)).length;

  const fetchNotifications = async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(API_BASE + "/api/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setNotifications(await res.json());
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = () => {
    setOpen(o => !o);
    if (!open) {
      markSeen(notifications.map(n => n.id));
    }
  };

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className={cn(
          "relative p-1.5 rounded transition-colors",
          themeClass
            ? "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            : "text-muted-foreground hover:text-foreground hover:bg-accent"
        )}
        aria-label="Notifications"
        data-testid="button-notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-9 w-80 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Notifications</span>
              {notifications.length > 0 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">{notifications.length}</Badge>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors">
              <X size={14} />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[360px] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
                <span>Loading…</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Bell size={28} className="mb-2 opacity-30" />
                <p className="text-sm">All clear — no alerts</p>
              </div>
            ) : (
              <div className="p-2 space-y-1.5">
                {notifications.map(n => {
                  const Icon = CATEGORY_ICON[n.category] ?? Bell;
                  const content = (
                    <div
                      key={n.id}
                      className={cn(
                        "flex gap-3 p-3 rounded-lg border text-sm transition-colors cursor-default",
                        TYPE_STYLES[n.type],
                        n.link && "hover:opacity-90 cursor-pointer"
                      )}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        <div className={cn("w-2 h-2 rounded-full mt-1", DOT_STYLES[n.type])} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-foreground leading-tight">{n.title}</p>
                          {n.link && <ExternalLink size={12} className="flex-shrink-0 text-muted-foreground mt-0.5" />}
                        </div>
                        <p className="text-muted-foreground text-xs mt-0.5 leading-snug">{n.message}</p>
                      </div>
                    </div>
                  );
                  return n.link ? (
                    <Link key={n.id} href={n.link} onClick={() => setOpen(false)}>{content}</Link>
                  ) : content;
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">Updates every 60 seconds</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
