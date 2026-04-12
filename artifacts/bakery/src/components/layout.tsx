import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, ShoppingCart, Factory, Package, BarChart3,
  Users, ScrollText, Settings, LogOut, Wheat, Menu, AlertTriangle,
  Building2, CreditCard, X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { clearToken, clearStoredUser, getStoredUser, clearStoredCompany, getStoredCompany } from "@/lib/auth";
import { initTheme } from "@/lib/theme";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { useGetLowStockItems } from "@workspace/api-client-react";

interface NavItem { href: string; label: string; icon: React.ElementType; roles: string[] }

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",        label: "Dashboard",   icon: LayoutDashboard, roles: ["managing_director","manager","receptionist","production_staff"] },
  { href: "/sales",            label: "Sales",        icon: ShoppingCart,    roles: ["managing_director","manager","receptionist"] },
  { href: "/production",       label: "Production",   icon: Factory,         roles: ["managing_director","manager","production_staff"] },
  { href: "/inventory",        label: "Inventory",    icon: Package,         roles: ["managing_director","manager"] },
  { href: "/reports",          label: "Reports",      icon: BarChart3,       roles: ["managing_director","manager"] },
  { href: "/users",            label: "Users",        icon: Users,           roles: ["managing_director"] },
  { href: "/audit-logs",       label: "Audit Logs",   icon: ScrollText,      roles: ["managing_director"] },
  { href: "/settings",         label: "Settings",     icon: Settings,        roles: ["managing_director"] },
  { href: "/company-settings", label: "Company",      icon: Building2,       roles: ["managing_director"] },
  { href: "/subscription",     label: "Subscription", icon: CreditCard,      roles: ["managing_director"] },
];

const ROLE_LABELS: Record<string, string> = {
  managing_director: "Managing Director",
  manager: "Manager",
  receptionist: "Receptionist",
  production_staff: "Production Staff",
};

/* ─────────────────────── shared hook ─────────────────────── */
function useLayoutState() {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const queryClient = useQueryClient();
  const user = getStoredUser();
  const company = getStoredCompany();
  const theme = company?.themeColor ?? "amber";
  const userRole = user?.role ?? "";
  const { data: lowStockItems } = useGetLowStockItems();
  const lowStockCount = lowStockItems?.length ?? 0;
  const visibleNav = NAV_ITEMS.filter(i => i.roles.includes(userRole));

  useEffect(() => { initTheme(); }, []);

  const handleLogout = () => {
    clearToken(); clearStoredUser(); clearStoredCompany();
    queryClient.clear(); setLocation("/login");
  };

  return { location, setLocation, mobileOpen, setMobileOpen, user, company, theme, userRole, lowStockCount, visibleNav, handleLogout };
}

/* ─────────────────────── BLUE: top-nav layout ─────────────── */
function TopNavLayout({ children, ls }: { children: React.ReactNode; ls: ReturnType<typeof useLayoutState> }) {
  const { location, mobileOpen, setMobileOpen, user, company, userRole, lowStockCount, visibleNav, handleLogout } = ls;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* ── Top navigation bar ── */}
      <header className="theme-topnav-bar flex items-center gap-0 h-14 px-4 bg-sidebar border-b border-sidebar-border flex-shrink-0 z-30">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mr-6 flex-shrink-0">
          <div className="w-8 h-8 rounded-md bg-sidebar-primary flex items-center justify-center overflow-hidden flex-shrink-0">
            {company?.logoUrl
              ? <img src={company.logoUrl} alt="Logo" className="w-full h-full object-contain" />
              : <Wheat size={18} className="text-sidebar-primary-foreground" />}
          </div>
          <span className="theme-sidebar-brand-name font-semibold text-sidebar-foreground text-sm hidden sm:block truncate max-w-[140px]">
            {company?.name ?? "New Model Bread"}
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
                </button>
              </Link>
            );
          })}
        </nav>

        <div className="flex-1 lg:hidden" />

        {/* Mobile hamburger */}
        <button onClick={() => setMobileOpen(true)} className="lg:hidden p-1.5 rounded hover:bg-sidebar-accent text-sidebar-foreground mr-2">
          <Menu size={18} />
        </button>

        {/* User info + logout */}
        <div className="hidden lg:flex items-center gap-3 flex-shrink-0 border-l border-sidebar-border pl-4 ml-2">
          <div className="text-right">
            <p className="text-xs font-semibold text-sidebar-foreground leading-none">{user?.fullName ?? "User"}</p>
            <p className="text-[10px] text-sidebar-foreground/50 mt-0.5">{ROLE_LABELS[userRole] ?? userRole}</p>
          </div>
          <button onClick={handleLogout} data-testid="button-logout"
            className="p-1.5 rounded hover:bg-destructive/20 hover:text-destructive text-sidebar-foreground/60 transition-colors">
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-50 w-60 bg-sidebar flex flex-col border-r border-sidebar-border">
            <div className="flex items-center justify-between px-4 py-3 border-b border-sidebar-border">
              <span className="font-semibold text-sidebar-foreground text-sm">{company?.name ?? "Menu"}</span>
              <button onClick={() => setMobileOpen(false)} className="text-sidebar-foreground/60"><X size={18} /></button>
            </div>
            <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
              {visibleNav.map(item => {
                const Icon = item.icon;
                const isActive = location === item.href || (item.href === "/dashboard" && location === "/");
                return (
                  <Link key={item.href} href={item.href}>
                    <button onClick={() => setMobileOpen(false)}
                      className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                        isActive ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent"
                      )}>
                      <Icon size={16} /><span>{item.label}</span>
                    </button>
                  </Link>
                );
              })}
            </nav>
            <div className="px-2 py-3 border-t border-sidebar-border">
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-sidebar-foreground/70 hover:bg-destructive/20 hover:text-destructive">
                <LogOut size={16} /><span>Sign out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Warning banner ── */}
      {lowStockCount > 0 && (userRole === "managing_director" || userRole === "manager") && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 flex items-center gap-2 text-amber-800 text-xs">
          <AlertTriangle size={13} className="flex-shrink-0" />
          <span><strong>{lowStockCount}</strong> inventory item{lowStockCount > 1 ? "s are" : " is"} low.</span>
          <Link href="/inventory"><button className="underline font-medium">View</button></Link>
        </div>
      )}

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
    </div>
  );
}

/* ─────────────────────── SIDEBAR layout (amber/orange/green/slate) ── */
function SidebarLayout({ children, ls }: { children: React.ReactNode; ls: ReturnType<typeof useLayoutState> }) {
  const { location, setLocation: _sl, mobileOpen, setMobileOpen, user, company, theme, userRole, lowStockCount, visibleNav, handleLogout } = ls;

  const NavItems = ({ onNavClick }: { onNavClick?: () => void }) => (
    <>
      {visibleNav.map(item => {
        const Icon = item.icon;
        const isActive = location === item.href || (item.href === "/dashboard" && location === "/");
        return (
          <Link key={item.href} href={item.href}>
            <button
              data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
              onClick={onNavClick}
              className={cn(
                "theme-nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors relative",
                isActive
                  ? cn("theme-nav-active bg-sidebar-primary text-sidebar-primary-foreground")
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}>
              {/* Icon box — styled per theme via CSS class */}
              <span className={cn("theme-nav-icon-box", isActive && "theme-nav-active-icon")}>
                <Icon size={16} />
              </span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.href === "/inventory" && lowStockCount > 0 && (
                <Badge variant="destructive" className="text-xs px-1.5 py-0.5 min-w-5 h-5">{lowStockCount}</Badge>
              )}
            </button>
          </Link>
        );
      })}
    </>
  );

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
          <p className={cn("theme-sidebar-brand-name font-bold text-sidebar-foreground text-sm leading-tight truncate",
            theme === "amber" && "font-serif"
          )}>
            {company?.name ?? "New Model Bread"}
          </p>
          <p className="text-sidebar-foreground/35 text-xs mt-0.5">
            {theme === "slate" ? "BAKERY SYS" : "Bakery System"}
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className={cn(
        "flex-1 px-2 py-3 space-y-0.5 overflow-y-auto",
        theme === "green" && "space-y-1",
        theme === "slate" && "space-y-px"
      )} data-testid="sidebar-nav">
        <NavItems onNavClick={() => setMobileOpen(false)} />
      </nav>

      {/* User */}
      <div className={cn("px-2 py-3 border-t border-sidebar-border", theme === "slate" && "py-2")}>
        <div className={cn("px-3 py-1.5 mb-1", theme === "slate" && "py-1")}>
          <p className={cn("text-sidebar-foreground font-medium text-sm truncate", theme === "slate" && "text-xs uppercase tracking-wider")}>{user?.fullName ?? "User"}</p>
          <p className="text-sidebar-foreground/45 text-xs">{ROLE_LABELS[userRole] ?? userRole}</p>
        </div>
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

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-50 w-60 flex flex-col bg-sidebar border-r border-sidebar-border">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between h-14 px-4 border-b border-border bg-card">
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-md hover:bg-accent" data-testid="button-mobile-menu">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            {company?.logoUrl
              ? <img src={company.logoUrl} alt="Logo" className="w-7 h-7 rounded object-contain" />
              : <Wheat size={18} className="text-primary" />}
            <span className={cn("font-bold text-foreground", theme === "amber" ? "font-serif" : "")}>{company?.name ?? "New Model Bread"}</span>
          </div>
          <div className="w-9" />
        </header>

        {/* Low stock banner */}
        {lowStockCount > 0 && (userRole === "managing_director" || userRole === "manager") && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-amber-800 text-sm">
            <AlertTriangle size={14} className="flex-shrink-0" />
            <span><strong>{lowStockCount}</strong> inventory item{lowStockCount > 1 ? "s are" : " is"} running low.</span>
            <Link href="/inventory"><button className="underline font-medium hover:no-underline">View inventory</button></Link>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

/* ─────────────────────── Root Layout ──────────────────────── */
export default function Layout({ children }: { children: React.ReactNode }) {
  const ls = useLayoutState();
  if (ls.theme === "blue") return <TopNavLayout ls={ls}>{children}</TopNavLayout>;
  return <SidebarLayout ls={ls}>{children}</SidebarLayout>;
}
