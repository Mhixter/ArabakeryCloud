import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { setToken, setStoredUser, setStoredCompany } from "@/lib/auth";
import { applyTheme } from "@/lib/theme";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wheat, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

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
          if ((data as { company?: { themeColor?: string } }).company) {
            setStoredCompany((data as { company: unknown }).company);
            applyTheme(((data as { company: { themeColor?: string } }).company).themeColor ?? "amber");
          }
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

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-sm font-medium">Username</Label>
              <Input
                id="username"
                data-testid="input-username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                disabled={login.isPending}
                className="h-10"
              />
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
