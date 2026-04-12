import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import SalesPage from "@/pages/sales";
import ProductionPage from "@/pages/production";
import InventoryPage from "@/pages/inventory";
import ReportsPage from "@/pages/reports";
import UsersPage from "@/pages/users";
import AuditLogsPage from "@/pages/audit-logs";
import SettingsPage from "@/pages/settings";
import Layout from "@/components/layout";
import { isAuthenticated } from "@/lib/auth";
import { useEffect } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAuthenticated()) {
      setLocation("/login");
    }
  }, [setLocation]);

  if (!isAuthenticated()) return null;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/">
        <AuthGuard>
          <Layout>
            <DashboardPage />
          </Layout>
        </AuthGuard>
      </Route>
      <Route path="/dashboard">
        <AuthGuard>
          <Layout>
            <DashboardPage />
          </Layout>
        </AuthGuard>
      </Route>
      <Route path="/sales">
        <AuthGuard>
          <Layout>
            <SalesPage />
          </Layout>
        </AuthGuard>
      </Route>
      <Route path="/production">
        <AuthGuard>
          <Layout>
            <ProductionPage />
          </Layout>
        </AuthGuard>
      </Route>
      <Route path="/inventory">
        <AuthGuard>
          <Layout>
            <InventoryPage />
          </Layout>
        </AuthGuard>
      </Route>
      <Route path="/reports">
        <AuthGuard>
          <Layout>
            <ReportsPage />
          </Layout>
        </AuthGuard>
      </Route>
      <Route path="/users">
        <AuthGuard>
          <Layout>
            <UsersPage />
          </Layout>
        </AuthGuard>
      </Route>
      <Route path="/audit-logs">
        <AuthGuard>
          <Layout>
            <AuditLogsPage />
          </Layout>
        </AuthGuard>
      </Route>
      <Route path="/settings">
        <AuthGuard>
          <Layout>
            <SettingsPage />
          </Layout>
        </AuthGuard>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
