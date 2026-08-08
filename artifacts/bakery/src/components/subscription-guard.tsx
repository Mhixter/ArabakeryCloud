import { useEffect, useState, useRef, createContext, useContext } from "react";
import { useLocation } from "wouter";
import { getToken } from "@/lib/auth";
import { AlertTriangle, Clock, Lock } from "lucide-react";
import { API_BASE } from "@/lib/api";

interface SubStatus {
  status: string;
  daysRemaining: number;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
}

interface SubscriptionContextValue {
  status: string | null;
  isExpired: boolean;
  isLoading: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  status: null,
  isExpired: false,
  isLoading: true,
});

export function useSubscription() {
  return useContext(SubscriptionContext);
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

    if (cachedSub && Date.now() - cacheTime < CACHE_TTL) {
      setSub(cachedSub);
      setChecked(true);
      return;
    }

    if (fetchingRef.current) return;
    fetchingRef.current = true;

    fetch(API_BASE + "/api/subscription", { headers: { Authorization: `Bearer ${token}` } })
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

  const isExpired = !isExempt && checked && sub?.status === "expired";
  const ctxValue: SubscriptionContextValue = {
    status: sub?.status ?? null,
    isExpired,
    isLoading: !checked,
  };

  const showTrialWarning =
    !isExempt &&
    checked &&
    sub &&
    (sub.status === "trial" || sub.status === "active") &&
    sub.daysRemaining <= 2;

  return (
    <SubscriptionContext.Provider value={ctxValue}>
      {isExpired && (
        <ExpiredBanner onGoToSubscription={() => setLocation("/subscription")} />
      )}
      {showTrialWarning && !isExpired && (
        <TrialWarningBanner
          daysRemaining={sub!.daysRemaining}
          isTrial={sub!.status === "trial"}
          onRenew={() => setLocation("/subscription")}
        />
      )}
      {children}
    </SubscriptionContext.Provider>
  );
}

/* ──── Expired view-only banner ──── */
function ExpiredBanner({ onGoToSubscription }: { onGoToSubscription: () => void }) {
  return (
    <div className="bg-red-600 text-white px-4 py-2.5 flex items-center gap-3 sticky top-0 z-50">
      <Lock size={15} className="flex-shrink-0" />
      <p className="text-sm font-semibold flex-1">
        Subscription expired — <span className="font-normal">view only mode. You can browse your data but cannot make changes.</span>
      </p>
      <button
        onClick={onGoToSubscription}
        className="text-xs font-bold underline underline-offset-2 whitespace-nowrap bg-white/20 hover:bg-white/30 px-2 py-1 rounded"
      >
        Renew Now
      </button>
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
