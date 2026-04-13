import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { getToken } from "@/lib/auth";
import { AlertTriangle, CreditCard, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SubStatus {
  status: string;
  daysRemaining: number;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
}

// Module-level cache — avoids re-fetching on every route change
let cachedSub: SubStatus | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000; // 1 minute

export function invalidateSubCache() {
  cachedSub = null;
  cacheTime = 0;
}

const EXEMPT_PATHS = ["/subscription", "/login", "/register", "/", "/features", "/pricing"];

export default function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [sub, setSub] = useState<SubStatus | null>(cachedSub);
  const [checked, setChecked] = useState(Date.now() - cacheTime < CACHE_TTL);
  const fetchingRef = useRef(false);

  const isExempt = EXEMPT_PATHS.some(p => location === p) || location.startsWith("/admin");

  useEffect(() => {
    if (isExempt) { setChecked(true); return; }
    const token = getToken();
    if (!token) { setChecked(true); return; }

    // Use cache if fresh
    if (cachedSub && Date.now() - cacheTime < CACHE_TTL) {
      setSub(cachedSub);
      setChecked(true);
      return;
    }

    if (fetchingRef.current) return;
    fetchingRef.current = true;

    fetch("/api/subscription", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          cachedSub = data;
          cacheTime = Date.now();
          setSub(data);
        }
      })
      .catch(() => {})
      .finally(() => {
        fetchingRef.current = false;
        setChecked(true);
      });
  }, [isExempt]);

  // Always render children if exempt or still checking (no blocking spinner for fast UX)
  if (isExempt || !checked) return <>{children}</>;

  if (sub?.status === "expired") {
    return <SubscriptionExpiredWall onGoToSubscription={() => setLocation("/subscription")} />;
  }

  if (sub && (sub.status === "trial" || sub.status === "active") && sub.daysRemaining <= 2) {
    return (
      <>
        <TrialWarningBanner
          daysRemaining={sub.daysRemaining}
          isTrial={sub.status === "trial"}
          onRenew={() => setLocation("/subscription")}
        />
        {children}
      </>
    );
  }

  return <>{children}</>;
}

/* ──── Expired wall ──── */
function SubscriptionExpiredWall({ onGoToSubscription }: { onGoToSubscription: () => void }) {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle size={32} className="text-red-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
          Subscription Expired
        </h1>
        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
          Your subscription has expired. Renew now to restore full access to your bakery dashboard — sales, production, inventory, and reports.
        </p>

        <div className="bg-white rounded-2xl p-5 mb-5 text-left space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400 flex items-center justify-center flex-shrink-0">
              <CreditCard size={16} className="text-slate-950" />
            </div>
            <div>
              <p className="font-bold text-slate-900">Starter Plan</p>
              <p className="text-xs text-slate-500">₦3,000 / month · All features included</p>
            </div>
          </div>
          {["Unlimited sales & production records", "Full inventory management", "Reports & analytics", "Multi-user access with roles"].map(f => (
            <div key={f} className="flex items-center gap-2 text-sm text-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
              {f}
            </div>
          ))}
        </div>

        <Button
          onClick={onGoToSubscription}
          className="w-full h-12 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-base"
        >
          Renew Subscription — ₦3,000
        </Button>
        <p className="text-slate-500 text-xs mt-4">
          Contact support if you need help processing payment.
        </p>
      </div>
    </div>
  );
}

/* ──── Trial warning banner ──── */
function TrialWarningBanner({
  daysRemaining, isTrial, onRenew,
}: { daysRemaining: number; isTrial: boolean; onRenew: () => void }) {
  const message = daysRemaining === 0
    ? `Your ${isTrial ? "trial" : "subscription"} expires today!`
    : `${isTrial ? "Trial" : "Subscription"} expires in ${daysRemaining} day${daysRemaining > 1 ? "s" : ""}.`;

  return (
    <div className="bg-amber-500 text-slate-950 px-4 py-2.5 flex items-center gap-3 sticky top-0 z-50">
      <Clock size={15} className="flex-shrink-0" />
      <p className="text-sm font-semibold flex-1">{message}</p>
      <button onClick={onRenew} className="text-xs font-bold underline underline-offset-2 whitespace-nowrap">
        Renew Now
      </button>
    </div>
  );
}
