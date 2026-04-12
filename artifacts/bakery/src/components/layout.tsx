import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  ShoppingCart,
  Factory,
  Package,
  BarChart3,
  Users,
  ScrollText,
  Settings,
  LogOut,
  Wheat,
  Menu,
  X,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { clearToken, clearStoredUser, getStoredUser } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useGetLowStockItems } from "@workspace/api-client-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["managing_director", "manager", "receptionist", "production_staff"] },
  { href: "/sales", label: "Sales", icon: ShoppingCart, roles: ["managing_director", "manager", "receptionist"] },
  { href: "/production", label: "Production", icon: Factory, roles: ["managing_director", "manager", "production_staff"] },
  { href: "/inventory", label: "Inventory", icon: Package, roles: ["managing_director", "manager"] },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: ["managing_director", "manager"] },
  { href: "/users", label: "Users", icon: Users, roles: ["managing_director"] },
  { href: "/audit-logs", label: "Audit Logs", icon: ScrollText, roles: ["managing_director"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["managing_director"] },
];

const ROLE_LABELS: Record<string, string> = {
  managing_director: "Managing Director",
  manager: "Manager",
  receptionist: "Receptionist",
  production_staff: "Production Staff",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const queryClient = useQueryClient();
  const user = getStoredUser();
  const userRole = user?.role ?? "";

  const { data: lowStockItems } = useGetLowStockItems();
  const lowStockCount = lowStockItems?.length ?? 0;

  const visibleNav = NAV_ITEMS.filter(item => item.roles.includes(userRole));

  const handleLogout = () => {
    clearToken();
    clearStoredUser();
    queryClient.clear();
    setLocation("/login");
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
          <Wheat size={20} className="text-sidebar-primary-foreground" />
        </div>
        <div>
          <p className="font-serif font-bold text-sidebar-foreground text-sm leading-tight">New Model</p>
          <p className="font-serif font-bold text-sidebar-primary text-sm leading-tight">Bread</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" data-testid="sidebar-nav">
        {visibleNav.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || (item.href === "/dashboard" && location === "/");
          return (
            <Link key={item.href} href={item.href}>
              <button
                data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors relative",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon size={16} />
                <span className="flex-1 text-left">{item.label}</span>
                {item.href === "/inventory" && lowStockCount > 0 && (
                  <Badge variant="destructive" className="text-xs px-1.5 py-0.5 min-w-[1.25rem] h-5 flex items-center justify-center">
                    {lowStockCount}
                  </Badge>
                )}
              </button>
            </Link>
          );
        })}
      </nav>

      {/* User & Logout */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <div className="px-3 py-2 mb-1">
          <p className="text-sidebar-foreground font-medium text-sm truncate">{user?.fullName ?? "User"}</p>
          <p className="text-sidebar-foreground/50 text-xs">{ROLE_LABELS[userRole] ?? userRole}</p>
        </div>
        <button
          data-testid="button-logout"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground/75 hover:bg-destructive/20 hover:text-destructive transition-colors"
        >
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 flex-col flex-shrink-0 bg-sidebar border-r border-sidebar-border">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-50 w-60 flex flex-col bg-sidebar border-r border-sidebar-border">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between h-14 px-4 border-b border-border bg-card">
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-md hover:bg-accent" data-testid="button-mobile-menu">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Wheat size={18} className="text-primary" />
            <span className="font-serif font-bold text-foreground">New Model Bread</span>
          </div>
          <div className="w-9" />
        </header>

        {/* Low stock warning banner */}
        {lowStockCount > 0 && (userRole === "managing_director" || userRole === "manager") && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center gap-2 text-amber-800 dark:text-amber-200 text-sm">
            <AlertTriangle size={14} className="flex-shrink-0" />
            <span><strong>{lowStockCount}</strong> inventory item{lowStockCount > 1 ? "s are" : " is"} running low.</span>
            <Link href="/inventory">
              <button className="underline font-medium hover:no-underline">View inventory</button>
            </Link>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
