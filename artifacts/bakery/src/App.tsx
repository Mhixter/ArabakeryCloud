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
import ProductsPage from "@/pages/products";
import AllocationsPage from "@/pages/allocations";
import Layout from "@/components/layout";
import AdminLoginPage from "@/pages/admin/login";
import AdminDashboardPage from "@/pages/admin/dashboard";
import AdminCompaniesPage from "@/pages/admin/companies";
import AdminSettingsPage from "@/pages/admin/settings";
import AdminTransactionsPage from "@/pages/admin/transactions";
import LandingHome from "@/pages/landing/home";
import LandingFeatures from "@/pages/landing/features";
import LandingPricing from "@/pages/landing/pricing";
import { isAuthenticated, getStoredUser } from "@/lib/auth";
import { initTheme } from "@/lib/theme";
import SubscriptionGuard from "@/components/subscription-guard";
import { BranchProvider } from "@/lib/branch-context";
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

/** Redirect to /dashboard if the logged-in user's role isn't in the allowed list */
function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const user = getStoredUser();
  const role = user?.role ?? "";
  useEffect(() => {
    if (!roles.includes(role)) setLocation("/dashboard");
  }, [role, roles, setLocation]);
  if (!roles.includes(role)) return null;
  return <>{children}</>;
}

function Protected({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <SubscriptionGuard>
        <Layout>{children}</Layout>
      </SubscriptionGuard>
    </AuthGuard>
  );
}

function ProtectedRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  return (
    <Protected>
      <RequireRole roles={roles}>{children}</RequireRole>
    </Protected>
  );
}

function Router() {
  return (
    <Switch>
      {/* Landing pages */}
      <Route path="/" component={LandingHome} />
      <Route path="/features" component={LandingFeatures} />
      <Route path="/pricing" component={LandingPricing} />

      {/* Public */}
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />

      {/* Super Admin */}
      <Route path="/admin/login" component={AdminLoginPage} />
      <Route path="/admin/companies" component={AdminCompaniesPage} />
      <Route path="/admin/transactions" component={AdminTransactionsPage} />
      <Route path="/admin/settings" component={AdminSettingsPage} />
      <Route path="/admin"><AdminDashboardPage /></Route>

      {/* Bakery app — each route enforces the roles that match the nav definition */}
      <Route path="/dashboard"><Protected><DashboardPage /></Protected></Route>
      <Route path="/sales"><ProtectedRole roles={["managing_director","manager","receptionist","supplier"]}><SalesPage /></ProtectedRole></Route>
      <Route path="/production"><ProtectedRole roles={["managing_director","manager","production_staff"]}><ProductionPage /></ProtectedRole></Route>
      <Route path="/inventory"><ProtectedRole roles={["managing_director","manager"]}><InventoryPage /></ProtectedRole></Route>
      <Route path="/reports"><ProtectedRole roles={["managing_director","manager"]}><ReportsPage /></ProtectedRole></Route>
      <Route path="/users"><ProtectedRole roles={["managing_director"]}><UsersPage /></ProtectedRole></Route>
      <Route path="/audit-logs"><ProtectedRole roles={["managing_director"]}><AuditLogsPage /></ProtectedRole></Route>
      <Route path="/products"><ProtectedRole roles={["managing_director","manager","receptionist"]}><ProductsPage /></ProtectedRole></Route>
      <Route path="/allocations"><ProtectedRole roles={["managing_director","manager","receptionist","supplier"]}><AllocationsPage /></ProtectedRole></Route>
      <Route path="/settings"><ProtectedRole roles={["managing_director"]}><SettingsPage /></ProtectedRole></Route>
      <Route path="/company-settings"><ProtectedRole roles={["managing_director"]}><CompanySettingsPage /></ProtectedRole></Route>
      <Route path="/subscription"><ProtectedRole roles={["managing_director"]}><SubscriptionPage /></ProtectedRole></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BranchProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <ThemeInit />
            <Router />
          </WouterRouter>
          <Toaster />
        </BranchProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
