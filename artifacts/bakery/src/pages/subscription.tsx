import { useState, useEffect } from "react";
import { getToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, CheckCircle, AlertTriangle, Clock } from "lucide-react";

interface Subscription {
  status: string;
  plan: string;
  priceMonthly: number;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  daysRemaining: number;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge className="bg-green-500/15 text-green-700 border-green-200">Active</Badge>;
  if (status === "trial") return <Badge className="bg-blue-500/15 text-blue-700 border-blue-200">Free Trial</Badge>;
  if (status === "expired") return <Badge variant="destructive">Expired</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export default function SubscriptionPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [renewing, setRenewing] = useState(false);
  const [sub, setSub] = useState<Subscription | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const token = getToken();
        const res = await fetch("/api/subscription", { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setSub(await res.json());
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const handleRenew = async () => {
    setRenewing(true);
    try {
      const token = getToken();
      const res = await fetch("/api/subscription/renew", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setSub(data);
        toast({ title: "Subscription renewed!", description: "Your plan is now active for 1 month." });
      } else {
        const data = await res.json().catch(() => ({}));
        const msg = data?.error ?? "Renewal failed. Please try again.";
        toast({ title: "Cannot renew", description: msg, variant: "destructive" });
      }
    } catch { toast({ title: "Renewal failed", description: "Network error. Please try again.", variant: "destructive" }); }
    finally { setRenewing(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6 max-w-2xl" data-testid="page-subscription">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Subscription</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your plan and billing</p>
      </div>

      {sub && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><CreditCard size={18} />Current Plan</CardTitle>
                <StatusBadge status={sub.status} />
              </div>
              <CardDescription>Starter Plan — all features included</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <p className="text-2xl font-bold text-foreground">₦{sub.priceMonthly.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">per month</p>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <p className="text-2xl font-bold text-foreground">{sub.daysRemaining}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">days remaining</p>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <p className="text-2xl font-bold text-foreground capitalize">{sub.status}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">status</p>
                </div>
              </div>

              {sub.status === "trial" && sub.trialEndsAt && (
                <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <Clock size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">Trial Period</p>
                    <p className="text-xs text-blue-600">Your trial ends on {new Date(sub.trialEndsAt).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}. Renew to continue using all features.</p>
                  </div>
                </div>
              )}

              {sub.status === "expired" && (
                <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <AlertTriangle size={16} className="text-destructive mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Subscription Expired</p>
                    <p className="text-xs text-destructive/80">Your subscription has expired. Renew now to restore full access.</p>
                  </div>
                </div>
              )}

              {sub.status === "active" && sub.currentPeriodEnd && (
                <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
                  <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-800">Active Subscription</p>
                    <p className="text-xs text-green-600">Next renewal due: {new Date(sub.currentPeriodEnd).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Renew Plan</CardTitle>
              <CardDescription>Pay ₦3,000 to activate or extend your subscription for 1 month.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {["Unlimited sales & production records", "Full inventory management", "Comprehensive reports & analytics", "User management (all roles)", "Branded receipts with your logo", "Audit logs & activity tracking"].map(f => (
                  <div key={f} className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-primary flex-shrink-0" />
                    <span className="text-sm">{f}</span>
                  </div>
                ))}
              </div>
              <Button onClick={handleRenew} disabled={renewing} size="lg" className="w-full">
                {renewing ? <><Loader2 size={16} className="mr-2 animate-spin" />Processing...</> : <>Pay ₦3,000 — Renew for 1 Month</>}
              </Button>
              <p className="text-xs text-muted-foreground text-center">Paystack payment integration coming soon. Contact support to process payment.</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
