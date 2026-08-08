import { Link, useLocation } from "wouter";
import { LayoutDashboard, Building2, LogOut, Shield, CreditCard, Receipt, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveClock } from "@/components/live-clock";

const ADMIN_NAV = [
  { href: "/admin",              label: "Dashboard",    icon: LayoutDashboard },
  { href: "/admin/companies",    label: "Companies",    icon: Building2 },
  { href: "/admin/transactions", label: "Transactions", icon: Receipt },
  { href: "/admin/settings",     label: "Gateway",      icon: CreditCard },
  { href: "/admin/backup",       label: "Backup",       icon: Database },
];

function getAdminUser() {
  try { return JSON.parse(localStorage.getItem("nmb_admin_user") ?? "null"); } catch { return null; }
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const admin = getAdminUser();

  const handleLogout = () => {
    localStorage.removeItem("nmb_admin_token");
    localStorage.removeItem("nmb_admin_user");
    setLocation("/admin/login");
  };

  const pageLabel = ADMIN_NAV.slice().reverse().find(n =>
    n.href === "/admin" ? location === "/admin" || location === "/admin/" : location.startsWith(n.href)
  )?.label ?? "Admin";

  return (
    <div className="flex h-screen" style={{ colorScheme: "dark" }}>
      {/* Sidebar */}
      <aside className="w-56 flex flex-col flex-shrink-0" style={{
        background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
        borderRight: "1px solid #334155"
      }}>
        {/* Brand */}
        <div className="px-5 py-5 border-b border-slate-700/60 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Shield size={16} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Super Admin</p>
            <p className="text-slate-400 text-xs">Platform Control</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-0.5">
          {ADMIN_NAV.map(item => {
            const Icon = item.icon;
            const isActive = item.href === "/admin"
              ? location === "/admin" || location === "/admin/"
              : location.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <button className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:bg-slate-700/60 hover:text-slate-100"
                )}>
                  <Icon size={16} />
                  <span>{item.label}</span>
                </button>
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-2 py-4 border-t border-slate-700/60">
          <div className="px-3 py-1 mb-2">
            <p className="text-slate-200 text-sm font-medium truncate">{admin?.fullName ?? "Super Admin"}</p>
            <p className="text-slate-500 text-xs">Platform Administrator</p>
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors">
            <LogOut size={15} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        <header className="h-14 px-6 border-b border-slate-200 bg-white flex items-center justify-between">
          <h1 className="text-slate-700 font-semibold text-sm">{pageLabel}</h1>
          <LiveClock className="text-slate-500 text-xs" showDate={true} showSeconds={true} />
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
