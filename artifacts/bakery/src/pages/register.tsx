import { useState } from "react";
import { useLocation } from "wouter";
import { setToken, setStoredUser, setStoredCompany } from "@/lib/auth";
import { applyTheme } from "@/lib/theme";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wheat, Loader2, Building2, CheckCircle } from "lucide-react";
import { API_BASE } from "@/lib/api";

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ companyName: "", phone: "", adminFullName: "", adminUsername: "", adminPassword: "", adminEmail: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName || !form.adminFullName || !form.adminUsername || !form.adminPassword) {
      toast({ title: "Please fill in all required fields", variant: "destructive" }); return;
    }
    setLoading(true);
    try {
      const res = await fetch(API_BASE + "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName,
          phone: form.phone || null,
          adminFullName: form.adminFullName,
          adminUsername: form.adminUsername,
          adminPassword: form.adminPassword,
          adminEmail: form.adminEmail || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error ?? "Registration failed", variant: "destructive" }); return; }
      setToken(data.token);
      setStoredUser(data.user);
      setStoredCompany(data.company);
      applyTheme(data.company.themeColor ?? "amber");
      toast({ title: `Welcome to ${data.company.name}! Your 7-day trial has started.` });
      setLocation("/dashboard");
    } catch {
      toast({ title: "Registration failed. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4 shadow-lg">
            <Wheat size={32} className="text-primary-foreground" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Ara Bakery Cloud</h1>
          <p className="text-muted-foreground text-sm mt-1">Register your bakery — free 7-day trial</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 size={18} />Create Your Account</CardTitle>
            <CardDescription>Set up your bakery management system</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bakery Information</p>
                <div className="space-y-1.5">
                  <Label>Bakery Name <span className="text-destructive">*</span></Label>
                  <Input placeholder="e.g. ABC Bakery" value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} disabled={loading} />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone Number</Label>
                  <Input placeholder="e.g. 08012345678" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} disabled={loading} />
                </div>
              </div>

              <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Admin Account</p>
                <div className="space-y-1.5">
                  <Label>Full Name <span className="text-destructive">*</span></Label>
                  <Input placeholder="Your full name" value={form.adminFullName} onChange={e => setForm({ ...form, adminFullName: e.target.value })} disabled={loading} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Username <span className="text-destructive">*</span></Label>
                    <Input placeholder="e.g. admin" value={form.adminUsername} onChange={e => setForm({ ...form, adminUsername: e.target.value })} disabled={loading} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Password <span className="text-destructive">*</span></Label>
                    <Input type="password" placeholder="••••••••" value={form.adminPassword} onChange={e => setForm({ ...form, adminPassword: e.target.value })} disabled={loading} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Email (optional)</Label>
                  <Input type="email" placeholder="admin@example.com" value={form.adminEmail} onChange={e => setForm({ ...form, adminEmail: e.target.value })} disabled={loading} />
                </div>
              </div>

              <div className="bg-primary/10 rounded-lg p-3 flex items-start gap-2">
                <CheckCircle size={16} className="text-primary mt-0.5 flex-shrink-0" />
                <p className="text-xs text-foreground/70">Start with a <strong>7-day free trial</strong>. No credit card required. ₦3,000/month after trial.</p>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <><Loader2 size={16} className="mr-2 animate-spin" />Creating account...</> : "Create Account & Start Trial"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Already have an account?{" "}
          <button onClick={() => setLocation("/login")} className="text-primary font-medium hover:underline">Sign in</button>
        </p>
      </div>
    </div>
  );
}
