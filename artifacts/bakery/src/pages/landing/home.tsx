import { Link } from "wouter";
import LandingNav from "./nav";
import {
  LayoutDashboard, ShoppingCart, Factory, Package, BarChart3,
  TrendingUp, TrendingDown, AlertTriangle, ChevronRight,
  Wheat, ArrowUpRight, MoreHorizontal, CheckCircle,
  Zap, Shield, Smartphone,
} from "lucide-react";

/* ══════════════════════════════════════════════════════════
   PHONE FRAME + APP SCREENS
   ══════════════════════════════════════════════════════════ */
function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-44 bg-slate-900 rounded-[2rem] p-[3px] shadow-2xl flex-shrink-0" style={{ height: 340 }}>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-16 h-[14px] bg-slate-900 rounded-full z-20" />
      <div className="w-full h-full bg-white rounded-[1.75rem] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-3 pt-6 pb-0.5 flex-shrink-0">
          <span className="text-[8px] font-bold text-slate-500">9:41</span>
          <div className="flex items-center gap-0.5">
            <div className="w-3 h-1.5 rounded-sm bg-slate-300" />
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
          </div>
        </div>
        <div className="flex-1 overflow-hidden">{children}</div>
        <div className="flex justify-center pb-2 pt-1 flex-shrink-0">
          <div className="w-20 h-[3px] rounded-full bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

function BottomNav({ active }: { active: number }) {
  return (
    <div className="bg-white border-t border-slate-100 flex items-center justify-around px-1 py-1.5 flex-shrink-0">
      {[LayoutDashboard, ShoppingCart, Factory, Package, MoreHorizontal].map((Icon, i) => (
        <div key={i} className={`flex flex-col items-center gap-0.5 ${i === active ? "text-amber-500" : "text-slate-200"}`}>
          <Icon size={12} />
          {i === active && <div className="w-2.5 h-0.5 rounded-full bg-amber-500" />}
        </div>
      ))}
    </div>
  );
}

function DashboardScreen() {
  return (
    <div className="h-full bg-slate-50 text-xs flex flex-col overflow-hidden">
      <div className="bg-slate-950 px-3 pt-1 pb-5 flex-shrink-0">
        <p className="text-slate-400 text-[8px] mb-0.5">Welcome back</p>
        <p className="text-white font-bold text-[11px]">Golden Crust Bakery</p>
      </div>
      <div className="-mt-3 mx-2 grid grid-cols-2 gap-1.5 flex-shrink-0">
        {[
          { label: "Today's Sales", value: "₦48,200", pos: true },
          { label: "Items Baked",   value: "342",      pos: true },
          { label: "Waste (kg)",    value: "2.4",      pos: false },
          { label: "Low Stock",     value: "3 items",  pos: false },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-2 shadow-sm">
            <p className="text-[7px] text-slate-400 leading-none mb-1">{s.label}</p>
            <p className="font-bold text-slate-800 text-[10px]">{s.value}</p>
            <div className={`flex items-center gap-0.5 mt-0.5 ${s.pos ? "text-green-500" : "text-red-400"}`}>
              {s.pos ? <TrendingUp size={6} /> : <TrendingDown size={6} />}
              <span className="text-[6px] font-semibold">{s.pos ? "+12%" : "−5%"}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mx-2 mt-2 bg-white rounded-xl p-2 shadow-sm flex-shrink-0">
        <p className="text-[7px] text-slate-400 mb-1.5 font-semibold uppercase tracking-wide">Revenue · 7 days</p>
        <div className="flex items-end gap-0.5 h-10">
          {[30, 45, 35, 60, 55, 80, 48].map((h, i) => (
            <div key={i} className="flex-1 rounded-sm bg-amber-500/80" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
      <div className="flex-1" />
      <BottomNav active={0} />
    </div>
  );
}

function SalesScreen() {
  return (
    <div className="h-full bg-white text-xs flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-100 flex-shrink-0">
        <p className="font-bold text-slate-800 text-[10px]">Record Sale</p>
        <p className="text-[7px] text-slate-400">Select products to add</p>
      </div>
      <div className="flex-1 overflow-hidden px-2 py-1.5 space-y-1.5">
        {[
          { name: "Agege Bread", qty: 40, price: "₦300" },
          { name: "Butter Roll", qty: 25, price: "₦150" },
          { name: "Meat Pie",    qty: 18, price: "₦500" },
          { name: "Cream Cake",  qty: 8,  price: "₦1,200" },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-2 py-1 border-b border-slate-50">
            <div className="w-5 h-5 rounded bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Wheat size={9} className="text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-700 text-[8px] truncate">{item.name}</p>
              <p className="text-[7px] text-slate-400">Qty: {item.qty}</p>
            </div>
            <p className="font-bold text-slate-800 text-[8px]">{item.price}</p>
          </div>
        ))}
      </div>
      <div className="mx-2 mb-1 bg-slate-950 rounded-xl py-2 flex items-center justify-center gap-1.5 flex-shrink-0">
        <ShoppingCart size={10} className="text-white" />
        <span className="text-white font-bold text-[8px]">Complete — ₦12,450</span>
      </div>
      <BottomNav active={1} />
    </div>
  );
}

function ProductionScreen() {
  return (
    <div className="h-full bg-slate-50 text-xs flex flex-col overflow-hidden">
      <div className="bg-white px-3 py-2 border-b border-slate-100 flex-shrink-0 flex items-center justify-between">
        <div>
          <p className="font-bold text-slate-800 text-[10px]">Production</p>
          <p className="text-[7px] text-slate-400">Mon, 12 Apr 2026</p>
        </div>
        <span className="text-[7px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">2/3 done</span>
      </div>
      <div className="flex-1 overflow-hidden px-2 py-2 space-y-1.5">
        {[
          { name: "Agege Bread", done: true,  pct: 96 },
          { name: "Butter Roll", done: true,  pct: 100 },
          { name: "Meat Pie",    done: false, pct: 0 },
        ].map((b, i) => (
          <div key={i} className="bg-white rounded-xl p-2 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <p className="font-semibold text-slate-700 text-[8px]">{b.name}</p>
              <span className={`text-[6px] px-1 py-0.5 rounded-full font-bold ${b.done ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"}`}>
                {b.done ? "Done" : "Pending"}
              </span>
            </div>
            <div className="h-1 rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-amber-500" style={{ width: `${b.pct}%` }} />
            </div>
          </div>
        ))}
        <button className="w-full bg-amber-500 rounded-xl py-2 flex items-center justify-center gap-1">
          <Factory size={9} className="text-white" />
          <span className="text-white font-bold text-[8px]">Log New Batch</span>
        </button>
      </div>
      <BottomNav active={2} />
    </div>
  );
}

function InventoryScreen() {
  return (
    <div className="h-full bg-white text-xs flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-100 flex-shrink-0 flex items-center justify-between">
        <p className="font-bold text-slate-800 text-[10px]">Inventory</p>
        <span className="flex items-center gap-0.5 text-[7px] text-red-500 font-bold bg-red-50 px-1.5 py-0.5 rounded-full">
          <AlertTriangle size={7} /> 2 low
        </span>
      </div>
      <div className="flex-1 overflow-hidden px-2 py-1">
        {[
          { name: "Flour",  stock: "80 kg",  s: "ok" },
          { name: "Butter", stock: "3.2 kg", s: "low" },
          { name: "Sugar",  stock: "12 kg",  s: "ok" },
          { name: "Yeast",  stock: "0.4 kg", s: "critical" },
          { name: "Eggs",   stock: "24 pcs", s: "ok" },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-2 py-1.5 border-b border-slate-50">
            <div className={`w-1 h-7 rounded-full flex-shrink-0 ${
              item.s === "critical" ? "bg-red-500" : item.s === "low" ? "bg-amber-400" : "bg-green-400"
            }`} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-700 text-[8px]">{item.name}</p>
              <p className="text-[7px] text-slate-400">{item.stock}</p>
            </div>
            <span className={`text-[6px] px-1.5 py-0.5 rounded-full font-bold ${
              item.s === "critical" ? "bg-red-50 text-red-600" : item.s === "low" ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-600"
            }`}>
              {item.s === "critical" ? "Critical" : item.s === "low" ? "Low" : "OK"}
            </span>
          </div>
        ))}
      </div>
      <BottomNav active={3} />
    </div>
  );
}

function ReportsScreen() {
  return (
    <div className="h-full bg-slate-50 text-xs flex flex-col overflow-hidden">
      <div className="bg-white px-3 py-2 border-b border-slate-100 flex-shrink-0">
        <p className="font-bold text-slate-800 text-[10px]">Reports</p>
        <p className="text-[7px] text-slate-400">April 2026</p>
      </div>
      <div className="flex-1 overflow-hidden px-2 py-2 space-y-1.5">
        <div className="bg-slate-950 rounded-xl p-2.5">
          <p className="text-slate-400 text-[7px] mb-0.5">Monthly Revenue</p>
          <p className="text-white font-bold text-sm">₦1,240,000</p>
          <div className="flex items-center gap-0.5 mt-0.5">
            <ArrowUpRight size={8} className="text-amber-400" />
            <span className="text-amber-400 text-[7px] font-semibold">+18% vs last month</span>
          </div>
        </div>
        <div className="bg-white rounded-xl p-2 shadow-sm">
          <p className="text-[7px] text-slate-400 mb-1.5 font-semibold uppercase tracking-wide">Top Products</p>
          {[
            { name: "Agege Bread", pct: 78 },
            { name: "Butter Roll", pct: 52 },
            { name: "Meat Pie",    pct: 35 },
          ].map(p => (
            <div key={p.name} className="mb-1.5">
              <div className="flex justify-between mb-0.5">
                <span className="text-[7px] text-slate-600">{p.name}</span>
                <span className="text-[7px] font-bold text-slate-700">{p.pct}%</span>
              </div>
              <div className="h-1 rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-amber-500" style={{ width: `${p.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <BottomNav active={4} />
    </div>
  );
}

const SCREENS = [
  { component: DashboardScreen,  label: "Dashboard" },
  { component: SalesScreen,      label: "Sales" },
  { component: ProductionScreen, label: "Production" },
  { component: InventoryScreen,  label: "Inventory" },
  { component: ReportsScreen,    label: "Reports" },
];

const FEATURES = [
  { icon: Factory,    title: "Production Tracking", desc: "Log daily batches, track yields, and eliminate waste in real-time." },
  { icon: Package,    title: "Inventory Control",   desc: "Auto-deduct ingredients on every sale. Never run out unexpectedly." },
  { icon: ShoppingCart, title: "Sales & Receipts", desc: "Record sales in seconds. Print or download branded receipts." },
  { icon: BarChart3,  title: "Smart Reports",       desc: "Revenue, profit margins, waste analysis — all in one dashboard." },
];

const STEPS = [
  { n: "01", title: "Register your bakery",  desc: "Create your account in under 2 minutes. No credit card needed." },
  { n: "02", title: "Add your products",     desc: "Add your breads, pastries, and prices. We handle the rest." },
  { n: "03", title: "Go live immediately",   desc: "Log production, record sales, watch insights fill your dashboard." },
];

const PERKS = [
  { icon: Zap,        title: "Works offline",       desc: "No internet? No problem. Log sales and sync when you're back." },
  { icon: Smartphone, title: "Phone & tablet ready", desc: "Optimised for any screen. Install as a mobile app — no app store needed." },
  { icon: Shield,     title: "Your data is safe",    desc: "Encrypted, backed up daily, and only you can access it." },
];

export default function LandingHome() {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <LandingNav />

      {/* ══ HERO ══════════════════════════════════════════════════════ */}
      <section className="bg-slate-950 pt-28 pb-0 overflow-hidden">
        <div className="max-w-6xl mx-auto px-5">
          <div className="text-center max-w-3xl mx-auto pb-16">
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-white/60 text-xs font-medium px-4 py-1.5 rounded-full mb-8">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              7-day free trial — no credit card required
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] tracking-tight mb-6">
              Run your bakery<br />
              <span className="text-amber-400">smarter, faster.</span>
            </h1>
            <p className="text-lg text-white/50 leading-relaxed mb-10 max-w-xl mx-auto">
              Complete bakery management — production, inventory, sales, and reports — built for Nigerian bakeries.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/register"
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-slate-950 font-bold bg-amber-400 hover:bg-amber-300 transition-colors text-base no-underline w-full sm:w-auto">
                Start Free Trial
                <ChevronRight size={16} />
              </Link>
              <Link href="/features"
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-white/70 font-semibold border border-white/10 hover:border-white/20 hover:text-white transition-colors text-base no-underline w-full sm:w-auto">
                See Features
              </Link>
            </div>
            <p className="mt-5 text-sm text-white/30">No setup fees · ₦3,000/month after trial · Works offline</p>
          </div>
        </div>

        {/* Phone mockups strip on dark bg */}
        <div className="relative pb-0">
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-slate-950 to-transparent z-10 pointer-events-none hidden sm:block" />
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-slate-950 to-transparent z-10 pointer-events-none hidden sm:block" />
          <div className="flex gap-4 sm:justify-center overflow-x-auto px-6 sm:px-0 pb-0 pt-2 scrollbar-hide" style={{ scrollSnapType: "x mandatory" }}>
            {SCREENS.map(({ component: Comp, label }, i) => (
              <div key={label} style={{ scrollSnapAlign: "center" }}
                className={`flex-shrink-0 flex flex-col items-center gap-3 transition-all duration-200 ${
                  i === 2 ? "translate-y-0 scale-105" : "translate-y-4 scale-95 opacity-70"
                } ${i === 0 || i === 4 ? "hidden sm:flex" : "flex"}`}>
                <PhoneFrame><Comp /></PhoneFrame>
                <span className="text-xs font-semibold text-white/30 uppercase tracking-widest">{label}</span>
              </div>
            ))}
          </div>
          {/* Fade bottom into white */}
          <div className="h-24 bg-gradient-to-b from-slate-950 to-white" />
        </div>
      </section>

      {/* ══ STATS ═════════════════════════════════════════════════════ */}
      <section className="py-12 bg-white border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-5">
          <div className="grid grid-cols-3 gap-6 sm:gap-12">
            {[
              { value: "500+",   label: "Bakeries using Ara" },
              { value: "₦2M+",  label: "Sales tracked daily" },
              { value: "99.9%", label: "Uptime guarantee" },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">{s.value}</p>
                <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FEATURES ══════════════════════════════════════════════════ */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-5">
          <div className="text-center mb-14">
            <p className="text-amber-500 text-xs font-bold uppercase tracking-[0.2em] mb-3">Everything you need</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
              Built for bakeries, by bakers
            </h2>
            <p className="text-slate-400 mt-4 max-w-lg mx-auto text-base">
              Every feature designed around real Nigerian bakery workflows — from the oven to the counter.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map(f => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="group rounded-2xl p-6 border border-slate-100 hover:border-slate-200 hover:shadow-md transition-all bg-white">
                  <div className="w-10 h-10 rounded-xl bg-slate-950 flex items-center justify-center mb-5">
                    <Icon size={18} className="text-amber-400" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2 text-sm">{f.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ══════════════════════════════════════════════ */}
      <section className="py-20 bg-slate-950">
        <div className="max-w-3xl mx-auto px-5">
          <div className="text-center mb-14">
            <p className="text-amber-400 text-xs font-bold uppercase tracking-[0.2em] mb-3">Simple setup</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Up and running in minutes
            </h2>
          </div>
          <div className="space-y-3">
            {STEPS.map((s, i) => (
              <div key={s.n} className="flex items-start gap-5 bg-white/5 rounded-2xl p-6 border border-white/5">
                <div className="w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center font-extrabold text-slate-950 flex-shrink-0 text-sm">
                  {s.n}
                </div>
                <div className="pt-0.5">
                  <h3 className="font-bold text-white mb-1.5 text-base">{s.title}</h3>
                  <p className="text-white/40 text-sm leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PERKS ═════════════════════════════════════════════════════ */}
      <section className="py-20 bg-white border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-5">
          <div className="text-center mb-14">
            <p className="text-amber-500 text-xs font-bold uppercase tracking-[0.2em] mb-3">Platform</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
              Manage your bakery from anywhere
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {PERKS.map(p => {
              const Icon = p.icon;
              return (
                <div key={p.title} className="rounded-2xl p-6 bg-slate-50 border border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center mb-5">
                    <Icon size={18} className="text-slate-950" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2">{p.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{p.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══ PRICING TEASER ════════════════════════════════════════════ */}
      <section className="py-20 bg-white">
        <div className="max-w-2xl mx-auto px-5 text-center">
          <p className="text-amber-500 text-xs font-bold uppercase tracking-[0.2em] mb-3">Pricing</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight mb-4">
            One plan. Everything included.
          </h2>
          <p className="text-slate-400 text-base mb-8 leading-relaxed">
            No tiers, no hidden fees. Every bakery gets the full platform.
          </p>
          <div className="inline-flex flex-col sm:flex-row items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-8 py-6 mb-8">
            <div className="text-center sm:text-left">
              <p className="text-5xl font-extrabold text-slate-950 tracking-tight">₦3,000</p>
              <p className="text-slate-400 text-sm mt-1">per month, after your trial</p>
            </div>
            <div className="sm:ml-8 space-y-2 text-left">
              {["7-day free trial", "Unlimited sales & production", "Up to 5 staff accounts", "All features included"].map(f => (
                <div key={f} className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle size={14} className="text-amber-500 flex-shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          </div>
          <div>
            <Link href="/register"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-slate-950 font-bold bg-amber-400 hover:bg-amber-300 transition-colors text-base no-underline">
              Start your free trial
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ══ FINAL CTA ═════════════════════════════════════════════════ */}
      <section className="py-20 bg-slate-950">
        <div className="max-w-2xl mx-auto px-5 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
            Ready to grow your bakery?
          </h2>
          <p className="text-white/40 text-base mb-10 leading-relaxed">
            Join hundreds of Nigerian bakery owners who already use Ara Bakery Cloud every day.
          </p>
          <Link href="/register"
            className="inline-flex items-center gap-2 px-9 py-4 rounded-xl bg-amber-400 text-slate-950 font-bold text-base hover:bg-amber-300 transition-colors no-underline">
            Get started free — no card needed
            <ArrowUpRight size={18} />
          </Link>
          <p className="mt-5 text-sm text-white/25">₦3,000/month after 7-day trial · Cancel anytime</p>
        </div>
      </section>

      {/* ══ FOOTER ════════════════════════════════════════════════════ */}
      <footer className="py-10 bg-slate-950 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-400 flex items-center justify-center">
              <Wheat size={14} className="text-slate-950" />
            </div>
            <span className="font-bold text-white text-sm tracking-tight">Ara Bakery Cloud</span>
          </div>
          <div className="flex items-center gap-5 text-sm text-white/30">
            <Link href="/features" className="hover:text-white/70 transition-colors no-underline">Features</Link>
            <Link href="/pricing"  className="hover:text-white/70 transition-colors no-underline">Pricing</Link>
            <Link href="/login"    className="hover:text-white/70 transition-colors no-underline">Sign in</Link>
          </div>
          <p className="text-sm text-white/20">&copy; {new Date().getFullYear()} Ara Bakery Cloud</p>
        </div>
      </footer>
    </div>
  );
}
