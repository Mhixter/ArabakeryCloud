import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { setToken, setStoredUser, setStoredCompany } from "@/lib/auth";
import { applyTheme } from "@/lib/theme";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wheat, Loader2, User, X } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  managing_director: "Managing Director",
  manager: "Manager",
  receptionist: "Receptionist",
  supplier: "Supplier",
  production_staff: "Production Staff",
};

interface LastUser {
  fullName: string;
  role: string;
  branchName: string;
  username?: string;
}

function getLastUser(): LastUser | null {
  try {
    const raw = localStorage.getItem("nmb_last_login");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveLastUser(u: LastUser) {
  try { localStorage.setItem("nmb_last_login", JSON.stringify(u)); } catch {}
}

function clearLastUser() {
  try { localStorage.removeItem("nmb_last_login"); } catch {}
}

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [lastUser, setLastUser] = useState<LastUser | null>(null);

  useEffect(() => {
    setLastUser(getLastUser());
  }, []);

  const login = useLogin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({ title: "Please enter your username and password", variant: "destructive" });
      return;
    }

    login.mutate(
      { data: { username, password } },
      {
        onSuccess: (data) => {
          setToken(data.token);
          setStoredUser(data.user);
          const company = (data as { company?: { themeColor?: string; name?: string } }).company;
          if (company) {
            setStoredCompany((data as unknown as { company: unknown }).company);
            applyTheme((company.themeColor) ?? "amber");
          }
          const user = data.user as { fullName?: string; role?: string; branchName?: string };
          saveLastUser({
            fullName: user.fullName ?? username,
            role: user.role ?? "",
            branchName: (user.branchName ?? (data as any).branch?.name ?? company?.name ?? ""),
            username,
          });
          setLocation("/dashboard");
        },
        onError: (error) => {
          const msg = (error as { data?: { error?: string } })?.data?.error ?? "Invalid credentials";
          toast({ title: "Login failed", description: msg, variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4" data-testid="page-login">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-400 mb-5">
            <Wheat size={26} className="text-slate-950" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Ara Bakery Cloud</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to your bakery dashboard</p>
        </div>

        {/* Last user chip */}
        {lastUser && (
          <div className="mb-4 rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-400/20 flex items-center justify-center flex-shrink-0">
              <User size={16} className="text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">{lastUser.fullName}</p>
              <p className="text-slate-400 text-xs truncate">
                {ROLE_LABELS[lastUser.role] ?? lastUser.role}
                {lastUser.branchName ? ` · ${lastUser.branchName}` : ""}
              </p>
            </div>
            <button
              onClick={() => { clearLastUser(); setLastUser(null); setUsername(""); }}
              className="text-slate-500 hover:text-slate-300 flex-shrink-0 p-1 rounded"
              title="Not you? Switch account"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-sm font-medium">Username or Agent ID</Label>
              <Input
                id="username"
                data-testid="input-username"
                type="text"
                placeholder="Username or Agent ID (e.g. ADA96857)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                disabled={login.isPending}
                className="h-10"
              />
              <p className="text-xs text-slate-400 mt-0.5">Enter your <span className="font-medium">username</span>, <span className="font-medium">Agent ID</span> (e.g. ADA96857), or <span className="font-medium">Company Login ID</span> — then enter your password below.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <Input
                id="password"
                data-testid="input-password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={login.isPending}
                className="h-10"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-10 bg-slate-950 hover:bg-slate-800 text-white font-semibold"
              disabled={login.isPending}
              data-testid="button-login"
            >
              {login.isPending ? (
                <><Loader2 size={16} className="mr-2 animate-spin" />Signing in…</>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-400 mt-5">
          New bakery?{" "}
          <button onClick={() => setLocation("/register")} className="text-amber-400 font-medium hover:text-amber-300">
            Start your free trial
          </button>
        </p>
      </div>
    </div>
  );
}
