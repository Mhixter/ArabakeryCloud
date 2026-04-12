import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import DashboardPage from "@/pages/dashboard";
import SalesPage from "@/pages/sales";
import ProductionPage from "@/pages/production";
import InventoryPage from "@/pages/inventory";
import ReportsPage from "@/pages/reports";
import UsersPage from "@/pages/users";
import AuditLogsPage from "@/pages/audit-logs";
import SettingsPage from "@/pages/settings";
import CompanySettingsPage from "@/pages/company-settings";
import SubscriptionPage from "@/pages/subscription";
import Layout from "@/components/layout";
import AdminLoginPage from "@/pages/admin/login";
import AdminDashboardPage from "@/pages/admin/dashboard";
import AdminCompaniesPage from "@/pages/admin/companies";
import AdminSettingsPage from "@/pages/admin/settings";
import AdminTransactionsPage from "@/pages/admin/transactions";
import { isAuthenticated } from "@/lib/auth";
import { initTheme } from "@/lib/theme";
import { useEffect } from "react";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  useEffect(() => { if (!isAuthenticated()) setLocation("/login"); }, [setLocation]);
  if (!isAuthenticated()) return null;
  return <>{children}</>;
}

function ThemeInit() {
  useEffect(() => { initTheme(); }, []);
  return null;
}

function Protected({ children }: { children: React.ReactNode }) {
  return <AuthGuard><Layout>{children}</Layout></AuthGuard>;
}

function Router() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />

      {/* Super Admin */}
      <Route path="/admin/login" component={AdminLoginPage} />
      <Route path="/admin/companies" component={AdminCompaniesPage} />
      <Route path="/admin/transactions" component={AdminTransactionsPage} />
      <Route path="/admin/settings" component={AdminSettingsPage} />
      <Route path="/admin"><AdminDashboardPage /></Route>

      {/* Bakery app */}
      <Route path="/"><Protected><DashboardPage /></Protected></Route>
      <Route path="/dashboard"><Protected><DashboardPage /></Protected></Route>
      <Route path="/sales"><Protected><SalesPage /></Protected></Route>
      <Route path="/production"><Protected><ProductionPage /></Protected></Route>
      <Route path="/inventory"><Protected><InventoryPage /></Protected></Route>
      <Route path="/reports"><Protected><ReportsPage /></Protected></Route>
      <Route path="/users"><Protected><UsersPage /></Protected></Route>
      <Route path="/audit-logs"><Protected><AuditLogsPage /></Protected></Route>
      <Route path="/settings"><Protected><SettingsPage /></Protected></Route>
      <Route path="/company-settings"><Protected><CompanySettingsPage /></Protected></Route>
      <Route path="/subscription"><Protected><SubscriptionPage /></Protected></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <ThemeInit />
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
