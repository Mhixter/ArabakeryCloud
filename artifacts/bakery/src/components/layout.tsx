import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, ShoppingCart, Factory, Package, BarChart3,
  Users, ScrollText, Settings, LogOut, Wheat, AlertTriangle,
  Building2, CreditCard, MoreHorizontal, X, ChevronRight, Sandwich, Download,
  PackageCheck, Activity, Receipt, Users2, DoorOpen,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { clearToken, clearStoredUser, getStoredUser, clearStoredCompany, getStoredCompany } from "@/lib/auth";
import { initTheme } from "@/lib/theme";
import { useActiveBranch, clearPersistedBranch } from "@/lib/branch-context";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { useGetLowStockItems } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { getToken } from "@/lib/auth";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import NotificationsDropdown from "@/components/notifications-dropdown";
import InstallAppPrompt from "@/components/install-app-prompt";
import { NotificationToggle } from "@/components/notification-toggle";
import { LiveClock } from "@/components/live-clock";
import { OnlineStatusDot } from "@/components/offline-banner";

interface NavItem { href: string; label: string; icon: React.ElementType; roles: string[] }

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",        label: "Dashboard",    icon: LayoutDashboard, roles: ["managing_director","manager","receptionist","production_staff","supplier"] },
  { href: "/sales",            label: "Sales",         icon: ShoppingCart,    roles: ["managing_director","manager","receptionist","supplier"] },
  { href: "/allocations",      label: "Allocations",   icon: PackageCheck,    roles: ["managing_director","manager","receptionist","supplier"] },
  { href: "/production",       label: "Production",    icon: Factory,         roles: ["managing_director","manager","production_staff"] },
  { href: "/products",         label: "Products",      icon: Sandwich,        roles: ["managing_director","manager","receptionist"] },
  { href: "/inventory",        label: "Inventory",     icon: Package,         roles: ["managing_director","manager"] },
  { href: "/expenses",         label: "Expenses",      icon: Receipt,         roles: ["managing_director","manager","receptionist"] },
  { href: "/reports",          label: "Reports",       icon: BarChart3,       roles: ["managing_director","manager"] },
  { href: "/workers",          label: "Workers",       icon: Users2,          roles: ["managing_director"] },
  { href: "/users",            label: "Users",         icon: Users,           roles: ["managing_director"] },
  { href: "/user-activity",    label: "User Activity", icon: Activity,        roles: ["managing_director"] },
  { href: "/audit-logs",       label: "Audit Logs",    icon: ScrollText,      roles: ["managing_director"] },
  { href: "/settings",         label: "Settings",      icon: Settings,        roles: ["managing_director"] },
  { href: "/company-settings", label: "Company",       icon: Building2,       roles: ["managing_director"] },
  { href: "/subscription",     label: "Subscription",  icon: CreditCard,      roles: ["managing_director"] },
];

const ROLE_LABELS: Record<string, string> = {
  managing_director: "Managing Director",
  manager: "Manager",
  receptionist: "Receptionist",
  production_staff: "Production Staff",
  supplier: "Supplier",
};

/* ─────────────────────── shared hook ─────────────────────── */
function useLayoutState() {
  const [location, setLocation] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const queryClient = useQueryClient();
  const user = getStoredUser();
  const company = getStoredCompany();
  const theme = company?.themeColor ?? "amber";
  const userRole = user?.role ?? "";
  const { data: lowStockItems } = useGetLowStockItems();
  const lowStockCount = lowStockItems?.length ?? 0;

  const canSeePendingReturns = ["managing_director", "manager", "receptionist"].includes(userRole);
  const { data: pendingReturnsData } = useQuery({
    queryKey: ["pending-returns-count"],
    queryFn: async () => {
      const res = await fetch("/api/returns/pending-count", {
        headers: { Authorization: `Bearer ${getToken() ?? ""}` },
      });
      if (!res.ok) return { count: 0 };
      return res.json() as Promise<{ count: number }>;
    },
    enabled: canSeePendingReturns,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
  const pendingReturnsCount = pendingReturnsData?.count ?? 0;
  const { activeBranch, setActiveBranch, isBranchLocked } = useActiveBranch();
  const COMPANY_ONLY_PATHS = ["/company-settings", "/subscription", "/settings"];
  const visibleNav = NAV_ITEMS.filter(i => {
    if (!i.roles.includes(userRole)) return false;
    if (userRole === "managing_director" && !activeBranch) {
      return COMPANY_ONLY_PATHS.includes(i.href);
    }
    return true;
  });

  useEffect(() => { initTheme(); }, []);

  const handleLogout = () => {
    clearToken(); clearStoredUser(); clearStoredCompany(); clearPersistedBranch();
    queryClient.clear(); setLocation("/login");
  };

  const handleExitBranch = () => {
    setActiveBranch(null);
    queryClient.clear();
    setLocation("/branch-select");
  };

  const serviceLabel = activeBranch
    ? activeBranch.name.toUpperCase()
    : theme === "slate" ? "BAKERY SYS" : "Bakery System";

  return { location, setLocation, moreOpen, setMoreOpen, user, company, theme, userRole, lowStockCount, pendingReturnsCount, visibleNav, handleLogout, handleExitBranch, activeBranch, serviceLabel, isBranchLocked };
}

/* ─────────────────────── Mobile Bottom Tab Bar ─────────────── */
function MobileBottomNav({ ls }: { ls: ReturnType<typeof useLayoutState> }) {
  const { location, visibleNav, lowStockCount, pendingReturnsCount, moreOpen, setMoreOpen, handleLogout, user, userRole } = ls;
  const { canInstall, install } = usePwaInstall();

  const primaryTabs = visibleNav.slice(0, 4);
  const secondaryItems = visibleNav.slice(4);

  return (
    <>
      {/* Bottom nav bar */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-100"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-stretch h-[60px]">
          {primaryTabs.map(item => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href === "/dashboard" && location === "/");
            return (
              <Link key={item.href} href={item.href} className="flex-1">
                <button
                  data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
                  className="relative flex flex-col items-center justify-center gap-1 w-full h-full touch-manipulation"
                >
                  {/* Active indicator — thin amber line at top */}
                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full bg-amber-400" />
                  )}
                  {/* Badge */}
                  {item.href === "/inventory" && lowStockCount > 0 && (
                    <span className="absolute top-2 right-3 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold z-10">
                      {lowStockCount > 9 ? "9+" : lowStockCount}
                    </span>
                  )}
                  {item.href === "/allocations" && pendingReturnsCount > 0 && (
                    <span className="absolute top-2 right-3 w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] flex items-center justify-center font-bold z-10">
                      {pendingReturnsCount > 9 ? "9+" : pendingReturnsCount}
                    </span>
                  )}
                  <Icon
                    size={20}
                    className={cn(
                      "transition-colors",
                      isActive ? "text-amber-500" : "text-slate-400"
                    )}
                  />
                  <span className={cn(
                    "text-[10px] font-semibold leading-none tracking-tight transition-colors",
                    isActive ? "text-amber-500" : "text-slate-400"
                  )}>
                    {item.label}
                  </span>
                </button>
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-1 touch-manipulation"
          >
            <MoreHorizontal
              size={20}
              className={cn("transition-colors", moreOpen ? "text-amber-500" : "text-slate-400")}
            />
            <span className={cn(
              "text-[10px] font-semibold leading-none tracking-tight",
              moreOpen ? "text-amber-500" : "text-slate-400"
            )}>
              More
            </span>
          </button>
        </div>
      </nav>
      {/* More bottom sheet */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl overflow-hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>

            {/* User info */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <span className="text-amber-700 font-bold text-sm">{(user?.fullName ?? "U").charAt(0).toUpperCase()}</span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 text-sm truncate">{user?.fullName ?? "User"}</p>
                <p className="text-slate-400 text-xs">{ROLE_LABELS[userRole] ?? userRole}</p>
              </div>
              <button onClick={() => setMoreOpen(false)} className="ml-auto p-2 text-slate-400">
                <X size={18} />
              </button>
            </div>

            {/* Secondary nav items */}
            {secondaryItems.length > 0 && (
              <div className="px-3 py-2 border-b border-slate-100">
                {secondaryItems.map(item => {
                  const Icon = item.icon;
                  const isActive = location === item.href;
                  return (
                    <Link key={item.href} href={item.href}>
                      <button onClick={() => setMoreOpen(false)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                          isActive ? "bg-amber-50 text-amber-700" : "text-slate-700 hover:bg-slate-50"
                        )}>
                        <Icon size={18} className={isActive ? "text-amber-600" : "text-slate-400"} />
                        <span className="flex-1 text-left">{item.label}</span>
                        <ChevronRight size={15} className="text-slate-300" />
                      </button>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* All primary items too if on More sheet */}
            {secondaryItems.length === 0 && (
              <div className="px-3 py-2 border-b border-slate-100">
                {visibleNav.map(item => {
                  const Icon = item.icon;
                  const isActive = location === item.href;
                  return (
                    <Link key={item.href} href={item.href}>
                      <button onClick={() => setMoreOpen(false)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                          isActive ? "bg-amber-50 text-amber-700" : "text-slate-700 hover:bg-slate-50"
                        )}>
                        <Icon size={18} className={isActive ? "text-amber-600" : "text-slate-400"} />
                        <span className="flex-1 text-left">{item.label}</span>
                        <ChevronRight size={15} className="text-slate-300" />
                      </button>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Install + Switch Branch + Logout */}
            <div className="px-3 py-3 space-y-1">
              {canInstall && (
                <button
                  onClick={() => { install(); setMoreOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                  <Download size={18} className="text-amber-500" />
                  <span>Install App</span>
                </button>
              )}
              {userRole === "managing_director" && (
                <button
                  onClick={() => { setMoreOpen(false); ls.handleExitBranch(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                  <DoorOpen size={18} className="text-amber-500" />
                  <span>Switch Branch</span>
                </button>
              )}
              <button
                data-testid="button-logout"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors">
                <LogOut size={18} className="text-red-400" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─────────────────────── BLUE: top-nav layout ─────────────── */
function TopNavLayout({ children, ls, banner }: { children: React.ReactNode; ls: ReturnType<typeof useLayoutState>; banner: React.ReactNode }) {
  const { location, user, company, userRole, lowStockCount, pendingReturnsCount, visibleNav, handleLogout } = ls;
  const { canInstall, install, isIos } = usePwaInstall();

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* ── Top navigation bar (desktop) ── */}
      <header className="theme-topnav-bar flex items-center gap-0 h-14 px-4 bg-sidebar border-b border-sidebar-border flex-shrink-0 z-30">
        <div className="flex items-center gap-2.5 mr-6 flex-shrink-0">
          <div className="w-8 h-8 rounded-md bg-sidebar-primary flex items-center justify-center overflow-hidden flex-shrink-0">
            {company?.logoUrl
              ? <img src={company.logoUrl} alt="Logo" className="w-full h-full object-contain" />
              : <Wheat size={18} className="text-sidebar-primary-foreground" />}
          </div>
          <span className="theme-sidebar-brand-name font-semibold text-sidebar-foreground text-sm hidden sm:block truncate max-w-[140px]">
            {company?.name ?? "Ara Bakery Cloud"}
          </span>
        </div>

        {/* Desktop nav items */}
        <nav className="hidden lg:flex flex-1 items-center gap-0.5 overflow-x-auto" data-testid="sidebar-nav">
          {visibleNav.map(item => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href === "/dashboard" && location === "/");
            return (
              <Link key={item.href} href={item.href}>
                <button
                  data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
                  className={cn(
                    "theme-topnav-item flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors relative",
                    isActive
                      ? "theme-topnav-active text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
                  )}>
                  <span className="theme-nav-icon-box"><Icon size={14} /></span>
                  <span>{item.label}</span>
                  {item.href === "/inventory" && lowStockCount > 0 && (
                    <Badge variant="destructive" className="text-[10px] px-1 py-0 min-w-4 h-4">{lowStockCount}</Badge>
                  )}
                  {item.href === "/allocations" && pendingReturnsCount > 0 && (
                    <Badge className="text-[10px] px-1 py-0 min-w-4 h-4 bg-orange-500 hover:bg-orange-500 text-white">{pendingReturnsCount > 9 ? "9+" : pendingReturnsCount}</Badge>
                  )}
                </button>
              </Link>
            );
          })}
        </nav>

        <div className="flex-1 lg:hidden" />

        {/* Mobile — company name only */}
        <div className="lg:hidden flex-1 flex justify-center">
          <span className="font-semibold text-sidebar-foreground text-sm truncate max-w-[160px]">
            {company?.name ?? "Ara Bakery Cloud"}
          </span>
        </div>

        <div className="hidden lg:flex items-center gap-2 flex-shrink-0 border-l border-sidebar-border pl-4 ml-2">
          <LiveClock className="text-sidebar-foreground/60 text-[11px] mr-1" showDate={true} showSeconds={false} />
          <OnlineStatusDot />
          <NotificationsDropdown themeClass="sidebar" />
          <div className="text-right ml-1">
            <p className="text-xs font-semibold text-sidebar-foreground leading-none">{user?.fullName ?? "User"}</p>
            <p className="text-[10px] text-sidebar-foreground/50 mt-0.5">{ROLE_LABELS[userRole] ?? userRole}</p>
          </div>
          {(canInstall || isIos) && (
            <button
              onClick={install}
              title="Install App"
              className="p-1.5 rounded hover:bg-sidebar-accent text-sidebar-foreground/60 transition-colors"
            >
              <Download size={15} />
            </button>
          )}
          <NotificationToggle iconSize={15} />
          {userRole === "managing_director" && (
            <button onClick={ls.handleExitBranch} title="Switch Branch"
              className="p-1.5 rounded hover:bg-sidebar-accent text-sidebar-foreground/60 transition-colors">
              <DoorOpen size={15} />
            </button>
          )}
          <button onClick={handleLogout} data-testid="button-logout"
            className="p-1.5 rounded hover:bg-destructive/20 hover:text-destructive text-sidebar-foreground/60 transition-colors">
            <LogOut size={15} />
          </button>
        </div>
        {/* Mobile bell */}
        <div className="flex lg:hidden items-center mr-2 flex-shrink-0">
          <NotificationsDropdown />
        </div>
      </header>

      {/* Branch banner — injected from root Layout */}
      {banner}

      {/* Low stock warning */}
      {lowStockCount > 0 && (userRole === "managing_director" || userRole === "manager") && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 flex items-center gap-2 text-amber-800 text-xs">
          <AlertTriangle size={13} className="flex-shrink-0" />
          <span><strong>{lowStockCount}</strong> inventory item{lowStockCount > 1 ? "s are" : " is"} low.</span>
          <Link href="/inventory"><button className="underline font-medium">View</button></Link>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 lg:pb-6">{children}</main>

      {/* Mobile bottom tabs */}
      <MobileBottomNav ls={ls} />
      <InstallAppPrompt />
    </div>
  );
}

/* ─────────────────────── SIDEBAR layout (amber/orange/green/slate) ── */
function SidebarLayout({ children, ls, banner }: { children: React.ReactNode; ls: ReturnType<typeof useLayoutState>; banner: React.ReactNode }) {
  const { location, user, company, theme, userRole, lowStockCount, pendingReturnsCount, visibleNav, handleLogout, handleExitBranch, serviceLabel } = ls;
  const { canInstall, install } = usePwaInstall();

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-sidebar-border">
        <div className={cn(
          "flex items-center justify-center flex-shrink-0 overflow-hidden bg-sidebar-primary",
          theme === "green" ? "w-10 h-10 rounded-2xl" : theme === "orange" ? "w-9 h-9 rounded-xl" : theme === "slate" ? "w-8 h-8 rounded" : "w-9 h-9 rounded-lg"
        )}>
          {company?.logoUrl
            ? <img src={company.logoUrl} alt="Logo" className="w-full h-full object-contain" />
            : <Wheat size={18} className="text-sidebar-primary-foreground" />}
        </div>
        <div className="min-w-0">
          <p className="theme-sidebar-brand-name font-bold text-sidebar-foreground text-sm leading-tight tracking-tight truncate">
            {company?.name ?? "Ara Bakery Cloud"}
          </p>
          <p className="text-sidebar-foreground/35 text-xs mt-0.5 truncate max-w-[140px]">
            {serviceLabel}
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className={cn(
        "flex-1 px-2 py-3 space-y-0.5 overflow-y-auto",
        theme === "green" && "space-y-1",
        theme === "slate" && "space-y-px"
      )} data-testid="sidebar-nav">
        {visibleNav.map(item => {
          const Icon = item.icon;
          const isActive = location === item.href || (item.href === "/dashboard" && location === "/");
          return (
            <Link key={item.href} href={item.href}>
              <button
                data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
                className={cn(
                  "theme-nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors relative",
                  isActive
                    ? cn("theme-nav-active bg-sidebar-primary text-sidebar-primary-foreground")
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}>
                <span className={cn("theme-nav-icon-box", isActive && "theme-nav-active-icon")}>
                  <Icon size={16} />
                </span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.href === "/inventory" && lowStockCount > 0 && (
                  <Badge variant="destructive" className="text-xs px-1.5 py-0.5 min-w-5 h-5">{lowStockCount}</Badge>
                )}
                {item.href === "/allocations" && pendingReturnsCount > 0 && (
                  <Badge className="text-xs px-1.5 py-0.5 min-w-5 h-5 bg-orange-500 hover:bg-orange-500 text-white">{pendingReturnsCount > 9 ? "9+" : pendingReturnsCount}</Badge>
                )}
              </button>
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className={cn("px-2 py-3 border-t border-sidebar-border", theme === "slate" && "py-2")}>
        <div className={cn("px-3 py-1.5 mb-1", theme === "slate" && "py-1")}>
          <p className={cn("text-sidebar-foreground font-medium text-sm truncate", theme === "slate" && "text-xs uppercase tracking-wider")}>{user?.fullName ?? "User"}</p>
          <p className="text-sidebar-foreground/45 text-xs">{ROLE_LABELS[userRole] ?? userRole}</p>
          <LiveClock className="text-sidebar-foreground/40 text-[10px] mt-1" showDate={true} showSeconds={false} />
        </div>
        {canInstall && (
          <button onClick={install}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors mb-0.5">
            <Download size={15} />
            <span>Install App</span>
          </button>
        )}
        <NotificationToggle
          showLabel
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium mb-0.5 justify-start"
          iconSize={15}
        />
        {userRole === "managing_director" && (
          <button onClick={handleExitBranch}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors mb-0.5">
            <DoorOpen size={15} />
            <span>Switch Branch</span>
          </button>
        )}
        <button data-testid="button-logout" onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground/60 hover:bg-destructive/15 hover:text-destructive transition-colors">
          <LogOut size={15} />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className={cn(
        "hidden lg:flex flex-col flex-shrink-0 bg-sidebar border-r border-sidebar-border",
        theme === "slate" ? "w-52" : "w-60"
      )}>
        <SidebarContent />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header — logo + company name only */}
        <header className="lg:hidden flex items-center justify-between h-14 px-4 border-b border-border bg-card">
          <div className="flex items-center gap-2.5">
            {company?.logoUrl
              ? <img src={company.logoUrl} alt="Logo" className="w-7 h-7 rounded object-contain" />
              : <Wheat size={18} className="text-primary" />}
            <span className="font-bold text-foreground text-sm tracking-tight">
              {company?.name ?? "Ara Bakery Cloud"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationsDropdown />
            {/* User initial avatar */}
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
              <span className="text-amber-700 font-bold text-xs">{(user?.fullName ?? "U").charAt(0).toUpperCase()}</span>
            </div>
          </div>
        </header>

        {/* Branch banner — injected from root Layout */}
        {banner}

        {/* Low stock banner */}
        {lowStockCount > 0 && (userRole === "managing_director" || userRole === "manager") && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-amber-800 text-sm">
            <AlertTriangle size={14} className="flex-shrink-0" />
            <span><strong>{lowStockCount}</strong> inventory item{lowStockCount > 1 ? "s are" : " is"} running low.</span>
            <Link href="/inventory"><button className="underline font-medium hover:no-underline">View inventory</button></Link>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24 lg:pb-6">{children}</main>
      </div>

      {/* Mobile bottom tabs */}
      <MobileBottomNav ls={ls} />
      <InstallAppPrompt />
    </div>
  );
}

/* ─────────────────────── Root Layout ──────────────────────── */
export default function Layout({ children }: { children: React.ReactNode }) {
  const ls = useLayoutState();
  const banner = null;

  if (ls.theme === "blue") {
    return (
      <TopNavLayout ls={ls} banner={banner}>{children}</TopNavLayout>
    );
  }
  return <SidebarLayout ls={ls} banner={banner}>{children}</SidebarLayout>;
}
