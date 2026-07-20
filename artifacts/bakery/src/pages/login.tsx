import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { setToken, setStoredUser, setStoredCompany } from "@/lib/auth";
import { applyTheme } from "@/lib/theme";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wheat, Loader2, User, X, WifiOff } from "lucide-react";
import { storeOfflineSession, verifyOfflineLogin, getOfflineLoginInfo, type OfflineLoginResult } from "@/lib/offline-auth";

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
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [offlineLoading, setOfflineLoading] = useState(false);
  const [offlineLoginsRemaining, setOfflineLoginsRemaining] = useState<number | null>(null);

  useEffect(() => {
    setLastUser(getLastUser());
    const handleOnline  = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online",  handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online",  handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Show how many offline logins remain when the user is offline and has typed a username
  useEffect(() => {
    if (!isOffline || !username.trim()) { setOfflineLoginsRemaining(null); return; }
    getOfflineLoginInfo(username).then(info => {
      setOfflineLoginsRemaining(info?.offlineLoginsRemaining ?? null);
    }).catch(() => {});
  }, [isOffline, username]);

  const login = useLogin();

  /** Restore a session that was verified offline */
  function restoreOfflineSession(data: { token: string; user: unknown; company?: unknown }) {
    setToken(data.token);
    setStoredUser(data.user);
    if (data.company) {
      setStoredCompany(data.company);
      const company = data.company as { themeColor?: string };
      if (company.themeColor) applyTheme(company.themeColor);
    }
    const user = data.user as { fullName?: string; role?: string; branchName?: string };
    saveLastUser({
      fullName:   user.fullName ?? username,
      role:       user.role ?? "",
      branchName: user.branchName ?? "",
      username,
    });
    const role = (data.user as { role?: string }).role;
    if (role === "managing_director") {
      setLocation("/branch-select");
    } else {
      setLocation("/dashboard");
    }
  }

  /** Try to authenticate offline using cached credentials */
  async function tryOfflineLogin() {
    if (!username || !password) {
      toast({ title: "Please enter your username and password", variant: "destructive" });
      return;
    }
    setOfflineLoading(true);
    try {
      const session = await verifyOfflineLogin(username, password);
      if (session) {
        setOfflineLoginsRemaining(session.offlineLoginsRemaining);
        const rem = session.offlineLoginsRemaining;
        toast({
          title: "Signed in offline",
          description: `Working offline. ${rem} offline login${rem === 1 ? "" : "s"} remaining before reconnection required.`,
        });
        restoreOfflineSession(session as OfflineLoginResult);
      } else {
        const info = await getOfflineLoginInfo(username).catch(() => null);
        if (info?.offlineLoginsRemaining === 0) {
          toast({ title: "Offline login limit reached", description: "You've used all 7 offline logins. Connect to the internet to reset.", variant: "destructive" });
        } else {
          toast({ title: "Offline login failed", description: "No saved session for this account, or password is incorrect. Connect to the internet to sign in.", variant: "destructive" });
        }
      }
    } finally {
      setOfflineLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({ title: "Please enter your username and password", variant: "destructive" });
      return;
    }

    /* If offline, skip the network call and go straight to offline auth */
    if (isOffline) {
      await tryOfflineLogin();
      return;
    }

    login.mutate(
      { data: { username, password } },
      {
        onSuccess: async (data) => {
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

          /* Cache credentials for future offline login */
          await storeOfflineSession(username, password, {
            token:   data.token,
            user:    data.user,
            company: (data as any).company,
          });

          const role = (data.user as { role?: string }).role;
          if (role === "managing_director") {
            setLocation("/branch-select");
          } else {
            setLocation("/dashboard");
          }
        },
        onError: async (error) => {
          /* If the error looks like a network failure, try offline auth */
          if (!navigator.onLine) {
            await tryOfflineLogin();
            return;
          }
          const msg = (error as { data?: { error?: string } })?.data?.error ?? "Invalid credentials";
          toast({ title: "Login failed", description: msg, variant: "destructive" });
        },
      }
    );
  };

  const isPending = login.isPending || offlineLoading;

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

        {/* Offline notice */}
        {isOffline && (
          <div className="mb-4 rounded-xl bg-slate-700 border border-slate-600 px-4 py-3 flex items-start gap-3">
            <WifiOff size={16} className="text-slate-300 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-slate-300 text-sm">
                You are offline. Sign in with your saved credentials to continue working.
              </p>
              {offlineLoginsRemaining !== null && (
                <p className={`text-xs mt-1 ${offlineLoginsRemaining === 0 ? "text-red-400" : "text-slate-400"}`}>
                  {offlineLoginsRemaining > 0
                    ? `${offlineLoginsRemaining} offline login${offlineLoginsRemaining === 1 ? "" : "s"} remaining`
                    : "Offline login limit reached — reconnect to reset"}
                </p>
              )}
            </div>
          </div>
        )}

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
                disabled={isPending}
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
                disabled={isPending}
                className="h-10"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-10 bg-slate-950 hover:bg-slate-800 text-white font-semibold"
              disabled={isPending}
              data-testid="button-login"
            >
              {isPending ? (
                <><Loader2 size={16} className="mr-2 animate-spin" />Signing in…</>
              ) : isOffline ? (
                <><WifiOff size={16} className="mr-2" />Sign In Offline</>
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
