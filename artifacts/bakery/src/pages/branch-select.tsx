import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Wheat, Building2, Settings, LogOut, Loader2, Plus, ArrowRight } from "lucide-react";
import { clearToken, clearStoredUser, clearStoredCompany, getStoredUser, getStoredCompany, getToken } from "@/lib/auth";
import { useActiveBranch } from "@/lib/branch-context";
import { applyTheme } from "@/lib/theme";
import { API_BASE } from "@/lib/api";

interface Branch {
  id: number;
  name: string;
  location: string | null;
  address: string | null;
  phone: string | null;
}

export default function BranchSelectPage() {
  const [, setLocation] = useLocation();
  const { setActiveBranch } = useActiveBranch();
  const user = getStoredUser();
  const company = getStoredCompany();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    applyTheme(company?.themeColor ?? "amber");
    const token = getToken();
    if (!token) { setLocation("/login"); return; }
    fetch(`${API_BASE}/api/branches`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((bs: Branch[]) => setBranches(bs))
      .catch(() => setBranches([]))
      .finally(() => setLoading(false));
  }, []);

  const enterBranch = (branch: Branch) => {
    setActiveBranch({ id: branch.id, name: branch.name });
    setLocation("/dashboard");
  };

  const handleLogout = () => {
    clearToken(); clearStoredUser(); clearStoredCompany();
    setLocation("/login");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-sidebar border-b border-sidebar-border px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0 overflow-hidden">
            {company?.logoUrl
              ? <img src={company.logoUrl} alt="Logo" className="w-full h-full object-contain" />
              : <Wheat size={18} className="text-sidebar-primary-foreground" />}
          </div>
          <div>
            <p className="font-bold text-sidebar-foreground text-sm leading-tight">{company?.name ?? "Ara Bakery Cloud"}</p>
            <p className="text-sidebar-foreground/50 text-xs">Managing Director</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLocation("/company-settings")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <Settings size={15} />
            <span className="hidden sm:inline">Settings</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-sidebar-foreground/70 hover:bg-destructive/15 hover:text-destructive transition-colors"
          >
            <LogOut size={15} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Select a Branch</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Welcome back, <strong>{user?.fullName ?? "Director"}</strong>. Choose a branch to manage.
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={28} className="animate-spin text-primary" />
            </div>
          ) : branches.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-border rounded-2xl">
              <Building2 size={36} className="text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm font-medium">No branches found</p>
              <p className="text-muted-foreground/60 text-xs mt-1">Go to Settings to create your first branch</p>
              <button
                onClick={() => setLocation("/settings")}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Plus size={15} />
                Create Branch
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {branches.map(branch => (
                <button
                  key={branch.id}
                  onClick={() => enterBranch(branch)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card border border-border hover:border-primary/50 hover:shadow-md transition-all group text-left"
                >
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                    <Building2 size={20} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm">{branch.name}</p>
                    {(branch.address || branch.location) && (
                      <p className="text-muted-foreground text-xs mt-0.5 truncate">
                        {branch.address ?? branch.location}
                      </p>
                    )}
                    {branch.phone && (
                      <p className="text-muted-foreground/60 text-xs">{branch.phone}</p>
                    )}
                  </div>
                  <ArrowRight size={16} className="text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                </button>
              ))}
            </div>
          )}

          {branches.length > 0 && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => setLocation("/settings")}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus size={14} />
                Add another branch
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
