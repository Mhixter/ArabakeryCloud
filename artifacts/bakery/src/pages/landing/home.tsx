import { Link } from "wouter";
import LandingNav from "./nav";
import {
  LayoutDashboard, ShoppingCart, Factory, Package, BarChart3,
  TrendingUp, TrendingDown, AlertTriangle, ChevronRight,
  Wheat, CheckCircle, ArrowUpRight, MoreHorizontal,
} from "lucide-react";

/* ══════════════════════════════════════════════════════════
   APP SCREEN MOCKUPS — rendered as real mini UI
   ══════════════════════════════════════════════════════════ */

function PhoneFrame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-48 bg-slate-900 rounded-[2rem] p-[3px] shadow-2xl flex-shrink-0" style={{ height: 360 }}>
        {/* Dynamic island */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-5 bg-slate-900 rounded-full z-20" />
        <div className="w-full h-full bg-white rounded-[1.7rem] overflow-hidden flex flex-col">
          {/* Status bar */}
          <div className="flex items-center justify-between px-4 pt-7 pb-1 flex-shrink-0">
            <span className="text-[9px] font-semibold text-slate-600">9:41</span>
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-slate-600">●●●</span>
              <span className="text-[9px] text-slate-600">▲</span>
              <span className="text-[9px] text-slate-600">■</span>
            </div>
          </div>
          {/* Content */}
          <div className="flex-1 overflow-hidden">{children}</div>
          {/* Home indicator */}
          <div className="flex justify-center pb-2 pt-1 flex-shrink-0">
            <div className="w-24 h-1 rounded-full bg-slate-200" />
          </div>
        </div>
      </div>
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
    </div>
  );
}

function DashboardScreen() {
  return (
    <div className="h-full bg-slate-50 overflow-hidden text-xs flex flex-col">
      <div className="bg-amber-600 px-3 pt-1 pb-5 flex-shrink-0">
        <p className="text-amber-200 text-[9px] mb-0.5">Welcome back</p>
        <p className="text-white font-bold text-sm leading-tight">Golden Crust Bakery</p>
      </div>
      <div className="-mt-3 mx-2 grid grid-cols-2 gap-1.5 flex-shrink-0">
        {[
          { label: "Today's Sales",  value: "₦48,200", up: true },
          { label: "Items Baked",    value: "342",       up: true },
          { label: "Waste (kg)",     value: "2.4",       up: false },
          { label: "Low Stock",      value: "3 items",   up: false },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-2 shadow-sm">
            <p className="text-[8px] text-slate-400 leading-none mb-1">{s.label}</p>
            <p className="font-bold text-slate-800 text-[11px] leading-tight">{s.value}</p>
            <div className={`flex items-center gap-0.5 mt-0.5 ${s.up ? "text-green-500" : "text-red-400"}`}>
              {s.up ? <TrendingUp size={7} /> : <TrendingDown size={7} />}
              <span className="text-[7px] font-medium">{s.up ? "+12%" : "−5%"}</span>
            </div>
          </div>
        ))}
      </div>
      {/* Chart bars */}
      <div className="mx-2 mt-2 bg-white rounded-xl p-2 shadow-sm flex-shrink-0">
        <p className="text-[8px] text-slate-400 mb-1.5 font-medium">Sales This Week</p>
        <div className="flex items-end gap-1 h-12">
          {[30, 45, 35, 60, 55, 80, 48].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full rounded-sm bg-amber-500" style={{ height: `${h}%` }} />
              <span className="text-[6px] text-slate-300">{["M","T","W","T","F","S","S"][i]}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Bottom nav */}
      <div className="mt-auto bg-white border-t border-slate-100 flex items-center justify-around px-1 py-1.5 flex-shrink-0">
        {[LayoutDashboard, ShoppingCart, Factory, Package, MoreHorizontal].map((Icon, i) => (
          <div key={i} className={`flex flex-col items-center gap-0.5 ${i === 0 ? "text-amber-600" : "text-slate-300"}`}>
            <Icon size={13} />
            {i === 0 && <div className="w-3 h-0.5 rounded-full bg-amber-600" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function SalesScreen() {
  const items = [
    { name: "Agege Bread",  qty: 40, price: "₦300" },
    { name: "Butter Roll",  qty: 25, price: "₦150" },
    { name: "Meat Pie",     qty: 18, price: "₦500" },
    { name: "Cream Cake",   qty: 8,  price: "₦1,200" },
  ];
  return (
    <div className="h-full bg-white overflow-hidden text-xs flex flex-col">
      <div className="px-3 py-2 border-b border-slate-100 flex-shrink-0">
        <p className="font-bold text-slate-800 text-[11px]">Record Sale</p>
        <p className="text-[8px] text-slate-400">Tap to add products</p>
      </div>
      <div className="flex-1 overflow-hidden px-2 py-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 py-1.5 border-b border-slate-50">
            <div className="w-6 h-6 rounded-md bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Wheat size={10} className="text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-700 text-[9px] truncate">{item.name}</p>
              <p className="text-[8px] text-slate-400">Qty: {item.qty}</p>
            </div>
            <p className="font-bold text-slate-800 text-[9px]">{item.price}</p>
          </div>
        ))}
      </div>
      <div className="mx-2 mb-1 bg-amber-600 rounded-xl py-2.5 flex items-center justify-center gap-2 flex-shrink-0">
        <ShoppingCart size={12} className="text-white" />
        <span className="text-white font-bold text-[10px]">Complete Sale — ₦12,450</span>
      </div>
      <div className="bg-white border-t border-slate-100 flex items-center justify-around px-1 py-1.5 flex-shrink-0">
        {[LayoutDashboard, ShoppingCart, Factory, Package, MoreHorizontal].map((Icon, i) => (
          <div key={i} className={`flex flex-col items-center gap-0.5 ${i === 1 ? "text-amber-600" : "text-slate-300"}`}>
            <Icon size={13} />
            {i === 1 && <div className="w-3 h-0.5 rounded-full bg-amber-600" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductionScreen() {
  const batches = [
    { name: "Agege Bread",  planned: 100, actual: 96, status: "done" },
    { name: "Butter Roll",  planned: 60,  actual: 60, status: "done" },
    { name: "Meat Pie",     planned: 50,  actual: 0,  status: "pending" },
  ];
  return (
    <div className="h-full bg-slate-50 overflow-hidden text-xs flex flex-col">
      <div className="bg-white px-3 py-2 border-b border-slate-100 flex-shrink-0 flex items-center justify-between">
        <div>
          <p className="font-bold text-slate-800 text-[11px]">Production</p>
          <p className="text-[8px] text-slate-400">Mon, 12 Apr 2026</p>
        </div>
        <span className="text-[8px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">2/3 done</span>
      </div>
      <div className="flex-1 overflow-hidden px-2 py-2 space-y-1.5">
        {batches.map((b, i) => (
          <div key={i} className="bg-white rounded-xl p-2 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <p className="font-semibold text-slate-700 text-[9px]">{b.name}</p>
              <span className={`text-[7px] px-1.5 py-0.5 rounded-full font-semibold ${
                b.status === "done" ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
              }`}>{b.status === "done" ? "Done" : "Pending"}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-amber-500" style={{ width: `${b.actual / b.planned * 100}%` }} />
              </div>
              <span className="text-[8px] text-slate-500">{b.actual}/{b.planned}</span>
            </div>
          </div>
        ))}
        <button className="w-full bg-amber-600 rounded-xl py-2 flex items-center justify-center gap-1.5">
          <Factory size={10} className="text-white" />
          <span className="text-white font-bold text-[9px]">Log New Batch</span>
        </button>
      </div>
      <div className="bg-white border-t border-slate-100 flex items-center justify-around px-1 py-1.5 flex-shrink-0">
        {[LayoutDashboard, ShoppingCart, Factory, Package, MoreHorizontal].map((Icon, i) => (
          <div key={i} className={`flex flex-col items-center gap-0.5 ${i === 2 ? "text-amber-600" : "text-slate-300"}`}>
            <Icon size={13} />
            {i === 2 && <div className="w-3 h-0.5 rounded-full bg-amber-600" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function InventoryScreen() {
  const items = [
    { name: "Flour",       stock: "80 kg",  status: "ok" },
    { name: "Butter",      stock: "3.2 kg", status: "low" },
    { name: "Sugar",       stock: "12 kg",  status: "ok" },
    { name: "Yeast",       stock: "0.4 kg", status: "critical" },
    { name: "Eggs",        stock: "24 pcs", status: "ok" },
  ];
  return (
    <div className="h-full bg-white overflow-hidden text-xs flex flex-col">
      <div className="px-3 py-2 border-b border-slate-100 flex-shrink-0 flex items-center justify-between">
        <p className="font-bold text-slate-800 text-[11px]">Inventory</p>
        <span className="flex items-center gap-1 text-[8px] text-red-500 font-semibold bg-red-50 px-1.5 py-0.5 rounded-full">
          <AlertTriangle size={8} /> 2 low
        </span>
      </div>
      <div className="flex-1 overflow-hidden px-2 py-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 py-1.5 border-b border-slate-50">
            <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${
              item.status === "critical" ? "bg-red-500" : item.status === "low" ? "bg-amber-400" : "bg-green-400"
            }`} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-700 text-[9px]">{item.name}</p>
              <p className="text-[8px] text-slate-400">{item.stock}</p>
            </div>
            <span className={`text-[7px] px-1.5 py-0.5 rounded-full font-semibold ${
              item.status === "critical" ? "bg-red-50 text-red-600"
              : item.status === "low" ? "bg-amber-50 text-amber-600"
              : "bg-green-50 text-green-600"
            }`}>
              {item.status === "critical" ? "Critical" : item.status === "low" ? "Low" : "OK"}
            </span>
          </div>
        ))}
      </div>
      <div className="bg-white border-t border-slate-100 flex items-center justify-around px-1 py-1.5 flex-shrink-0">
        {[LayoutDashboard, ShoppingCart, Factory, Package, MoreHorizontal].map((Icon, i) => (
          <div key={i} className={`flex flex-col items-center gap-0.5 ${i === 3 ? "text-amber-600" : "text-slate-300"}`}>
            <Icon size={13} />
            {i === 3 && <div className="w-3 h-0.5 rounded-full bg-amber-600" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportsScreen() {
  return (
    <div className="h-full bg-slate-50 overflow-hidden text-xs flex flex-col">
      <div className="bg-white px-3 py-2 border-b border-slate-100 flex-shrink-0">
        <p className="font-bold text-slate-800 text-[11px]">Reports</p>
        <p className="text-[8px] text-slate-400">April 2026</p>
      </div>
      <div className="flex-1 overflow-hidden px-2 py-2 space-y-1.5">
        {/* Revenue card */}
        <div className="bg-amber-600 rounded-xl p-2.5">
          <p className="text-amber-100 text-[8px] mb-0.5">Monthly Revenue</p>
          <p className="text-white font-bold text-sm">₦1,240,000</p>
          <div className="flex items-center gap-1 mt-1">
            <ArrowUpRight size={9} className="text-amber-200" />
            <span className="text-amber-200 text-[8px] font-medium">+18% vs last month</span>
          </div>
        </div>
        {/* Top products */}
        <div className="bg-white rounded-xl p-2 shadow-sm">
          <p className="text-[8px] text-slate-400 mb-1.5 font-medium">Top Products</p>
          {[
            { name: "Agege Bread", pct: 78 },
            { name: "Butter Roll", pct: 52 },
            { name: "Meat Pie",    pct: 35 },
          ].map(p => (
            <div key={p.name} className="mb-1.5">
              <div className="flex justify-between mb-0.5">
                <span className="text-[8px] text-slate-600">{p.name}</span>
                <span className="text-[8px] font-semibold text-slate-700">{p.pct}%</span>
              </div>
              <div className="h-1 rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-amber-500" style={{ width: `${p.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
        {/* Waste */}
        <div className="bg-white rounded-xl p-2 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[8px] text-slate-400">Total Waste</p>
            <p className="font-bold text-slate-800 text-[10px]">48.2 kg</p>
          </div>
          <div className="flex items-center gap-0.5 text-green-500">
            <TrendingDown size={9} />
            <span className="text-[8px] font-semibold">−8%</span>
          </div>
        </div>
      </div>
      <div className="bg-white border-t border-slate-100 flex items-center justify-around px-1 py-1.5 flex-shrink-0">
        {[LayoutDashboard, ShoppingCart, Factory, Package, BarChart3].map((Icon, i) => (
          <div key={i} className={`flex flex-col items-center gap-0.5 ${i === 4 ? "text-amber-600" : "text-slate-300"}`}>
            <Icon size={13} />
            {i === 4 && <div className="w-3 h-0.5 rounded-full bg-amber-600" />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   LANDING PAGE
   ══════════════════════════════════════════════════════════ */

const FEATURES = [
  {
    icon: Factory,
    title: "Production Tracking",
    desc: "Log daily bakes, monitor batch yields, and eliminate waste with real-time production dashboards.",
    photo: "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=500&h=320&fit=crop&q=80",
    photoAlt: "Baker working in professional kitchen",
  },
  {
    icon: Package,
    title: "Inventory Control",
    desc: "Track every ingredient with automatic stock deductions and low-stock alerts before you run out.",
    photo: "https://images.unsplash.com/photo-1454944338482-a69bb95894af?w=500&h=320&fit=crop&q=80",
    photoAlt: "Bakery ingredients organised on shelves",
  },
  {
    icon: ShoppingCart,
    title: "Sales & Receipts",
    desc: "Record sales, issue branded receipts, and track daily revenue — all from your phone or tablet.",
    photo: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=500&h=320&fit=crop&q=80",
    photoAlt: "Bakery counter with fresh products",
  },
  {
    icon: BarChart3,
    title: "Smart Reports",
    desc: "Sales trends, profit margins, waste analysis — dashboards that reveal exactly how your bakery is performing.",
    photo: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500&h=320&fit=crop&q=80",
    photoAlt: "Business analytics dashboard on laptop",
  },
];

const STEPS = [
  { num: "01", title: "Register your bakery",    desc: "Create your account in 2 minutes. No credit card needed for your 7-day free trial." },
  { num: "02", title: "Add your products",        desc: "Add breads, pastries and other products with pricing and production recipes." },
  { num: "03", title: "Start from day one",       desc: "Log production, record sales, and watch real-time insights fill your dashboard immediately." },
];

const SCREENS = [
  { component: DashboardScreen,  label: "Dashboard" },
  { component: SalesScreen,      label: "Sales" },
  { component: ProductionScreen, label: "Production" },
  { component: InventoryScreen,  label: "Inventory" },
  { component: ReportsScreen,    label: "Reports" },
];

export default function LandingHome() {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <LandingNav />

      {/* ══ HERO ══════════════════════════════════════════════════════ */}
      <section className="pt-24 pb-0 bg-slate-50 overflow-hidden">
        <div className="max-w-6xl mx-auto px-5">
          {/* Headline */}
          <div className="text-center max-w-3xl mx-auto pt-8 pb-12">
            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
              <CheckCircle size={13} />
              7-day free trial — no credit card required
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-tight mb-5" style={{ fontFamily: "'Playfair Display',serif" }}>
              Run your bakery<br />
              <span className="text-amber-600">smarter, faster.</span>
            </h1>
            <p className="text-lg text-slate-500 leading-relaxed mb-8 max-w-xl mx-auto">
              Ara Bakery Cloud gives bakery owners a complete management platform — production, inventory, sales and reports — built for Nigerian bakeries.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/register"
                className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-white font-semibold bg-amber-600 hover:bg-amber-700 active:bg-amber-800 transition-colors shadow-md text-base no-underline w-full sm:w-auto">
                Start Free Trial
                <ChevronRight size={16} />
              </Link>
              <Link href="/features"
                className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-slate-700 font-semibold border-2 border-slate-200 hover:border-slate-300 hover:bg-white transition-colors text-base no-underline w-full sm:w-auto">
                See Features
              </Link>
            </div>
            <p className="mt-5 text-sm text-slate-400">No setup fees · ₦3,000/month after trial · Works offline</p>
          </div>
        </div>

        {/* ── App screen mockups strip ── */}
        <div className="relative pb-0">
          {/* Gradient fade left/right on desktop */}
          <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-slate-50 to-transparent z-10 pointer-events-none hidden sm:block" />
          <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-slate-50 to-transparent z-10 pointer-events-none hidden sm:block" />

          {/* Horizontal scroll on mobile, centered flex on desktop */}
          <div className="flex gap-5 sm:justify-center overflow-x-auto px-6 sm:px-0 pb-8 pt-2 scrollbar-hide" style={{ scrollSnapType: "x mandatory" }}>
            {SCREENS.map(({ component: Comp, label }, i) => (
              <div key={label} style={{ scrollSnapAlign: "center" }}
                className={`flex-shrink-0 transition-all duration-200 ${i === 0 || i === 4 ? "scale-90 opacity-80 hidden sm:flex" : i === 2 ? "scale-105" : "scale-95 opacity-90"}`}>
                <PhoneFrame label={label}>
                  <Comp />
                </PhoneFrame>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ STATS ═════════════════════════════════════════════════════ */}
      <section className="py-12 bg-white border-y border-slate-100">
        <div className="max-w-4xl mx-auto px-5">
          <div className="grid grid-cols-3 gap-4 sm:gap-8">
            {[
              { value: "500+",    label: "Bakeries using Ara" },
              { value: "₦2M+",   label: "Sales tracked daily" },
              { value: "99.9%",  label: "Platform uptime" },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-2xl sm:text-4xl font-extrabold text-amber-600 mb-1" style={{ fontFamily: "'Playfair Display',serif" }}>{s.value}</p>
                <p className="text-xs sm:text-sm text-slate-500 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FEATURES ══════════════════════════════════════════════════ */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-5">
          <div className="text-center mb-12">
            <p className="text-amber-600 text-sm font-bold uppercase tracking-widest mb-2">Everything you need</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900" style={{ fontFamily: "'Playfair Display',serif" }}>
              Built for bakeries, by bakers
            </h2>
            <p className="text-slate-500 mt-3 max-w-xl mx-auto">
              Every feature designed around the real workflows of a Nigerian bakery — from the oven to the counter.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(f => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="group rounded-2xl overflow-hidden border border-slate-100 hover:shadow-lg transition-all hover:-translate-y-0.5 bg-white">
                  <div className="relative overflow-hidden" style={{ height: 160 }}>
                    <img src={f.photo} alt={f.photoAlt}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy" />
                    <div className="absolute inset-0 bg-black/20" />
                    <div className="absolute bottom-3 left-3 w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-md">
                      <Icon size={16} className="text-amber-600" />
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-slate-800 mb-1.5 text-sm">{f.title}</h3>
                    <p className="text-slate-500 text-xs leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══ FULL BLEED PHOTO ══════════════════════════════════════════ */}
      <section className="relative overflow-hidden" style={{ height: "clamp(220px, 35vw, 420px)" }}>
        <img
          src="https://images.unsplash.com/photo-1517433670267-08bbd4be890f?w=1400&h=500&fit=crop&q=80"
          alt="Inside a professional bakery kitchen"
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-slate-900/70 flex items-center justify-center">
          <div className="text-center px-5 max-w-2xl">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-4 leading-tight" style={{ fontFamily: "'Playfair Display',serif" }}>
              From the oven to the register — one app
            </h2>
            <p className="text-white/80 text-base sm:text-lg mb-8">
              Designed for bakery owners who want less admin and more time baking.
            </p>
            <Link href="/register"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-amber-600 text-white font-semibold hover:bg-amber-700 transition-colors no-underline">
              Get Started Free
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ══════════════════════════════════════════════ */}
      <section className="py-16 sm:py-20 bg-slate-50">
        <div className="max-w-3xl mx-auto px-5">
          <div className="text-center mb-10">
            <p className="text-amber-600 text-sm font-bold uppercase tracking-widest mb-2">Simple setup</p>
            <h2 className="text-3xl font-extrabold text-slate-900" style={{ fontFamily: "'Playfair Display',serif" }}>
              Up and running in minutes
            </h2>
          </div>
          <div className="space-y-4">
            {STEPS.map((s, i) => (
              <div key={s.num} className="flex items-start gap-5 bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-amber-600 flex items-center justify-center font-extrabold text-white flex-shrink-0"
                  style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.1rem" }}>
                  {s.num}
                </div>
                <div className="pt-1">
                  <h3 className="font-bold text-slate-800 mb-1">{s.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ MOBILE APP PROMO ══════════════════════════════════════════ */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-5">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-amber-600 text-sm font-bold uppercase tracking-widest mb-3">Available everywhere</p>
              <h2 className="text-3xl font-extrabold text-slate-900 mb-5 leading-snug" style={{ fontFamily: "'Playfair Display',serif" }}>
                Manage your bakery<br />from anywhere
              </h2>
              <p className="text-slate-500 leading-relaxed mb-8">
                Ara Bakery Cloud is a Progressive Web App — install it directly from your browser on Android or iPhone. No app store download needed. It works offline too.
              </p>
              <div className="space-y-4">
                {[
                  { icon: Package,      label: "Android & iOS phones",  desc: "Install from your browser, works like a native app" },
                  { icon: LayoutDashboard, label: "Tablets & iPads",    desc: "Optimised layout for larger screens" },
                  { icon: BarChart3,    label: "Desktop & laptop",       desc: "Full feature set on any browser" },
                  { icon: Wheat,        label: "Works offline",          desc: "Log sales and production without internet" },
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                        <Icon size={18} className="text-amber-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{item.label}</p>
                        <p className="text-slate-400 text-xs mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-center">
              <div className="relative">
                <img
                  src="https://images.unsplash.com/photo-1556742208-999815fca738?w=480&h=640&fit=crop&q=80"
                  alt="Bakery manager using the app on mobile"
                  className="rounded-3xl shadow-2xl object-cover border-4 border-white"
                  style={{ width: "100%", maxWidth: 320, aspectRatio: "320/430" }}
                  loading="lazy"
                />
                <div className="absolute -top-4 -right-3 bg-white rounded-2xl shadow-xl px-4 py-3 border border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="font-bold text-slate-700 text-sm">Live sync</span>
                  </div>
                </div>
                <div className="absolute -bottom-4 -left-3 bg-white rounded-2xl shadow-xl px-4 py-3 border border-slate-100">
                  <p className="text-xs text-slate-400 mb-0.5">Today's revenue</p>
                  <p className="font-extrabold text-xl text-amber-600">₦48,200</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ CTA ════════════════════════════════════════════════════════ */}
      <section className="py-16 sm:py-20 bg-amber-600">
        <div className="max-w-2xl mx-auto px-5 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4" style={{ fontFamily: "'Playfair Display',serif" }}>
            Ready to grow your bakery?
          </h2>
          <p className="text-amber-100 mb-8 leading-relaxed text-lg">
            Join hundreds of bakery owners using Ara Bakery Cloud to manage production, track sales, and grow their business.
          </p>
          <Link href="/register"
            className="inline-flex items-center gap-2 px-9 py-4 rounded-xl bg-white text-amber-700 font-bold text-lg hover:bg-amber-50 transition-colors shadow-lg no-underline">
            Start your free 7-day trial
            <ChevronRight size={18} />
          </Link>
          <p className="mt-4 text-sm text-amber-200">No credit card required · ₦3,000/month after trial</p>
        </div>
      </section>

      {/* ══ FOOTER ════════════════════════════════════════════════════ */}
      <footer className="py-10 border-t border-slate-100 bg-white">
        <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-600 flex items-center justify-center">
              <Wheat size={14} className="text-white" />
            </div>
            <span className="font-bold text-slate-700 text-lg" style={{ fontFamily: "'Playfair Display',serif" }}>
              Ara Bakery Cloud
            </span>
          </div>
          <div className="flex items-center gap-5 text-sm text-slate-400">
            <Link href="/features" className="hover:text-amber-600 transition-colors no-underline">Features</Link>
            <Link href="/pricing"  className="hover:text-amber-600 transition-colors no-underline">Pricing</Link>
            <Link href="/login"    className="hover:text-amber-600 transition-colors no-underline">Sign in</Link>
          </div>
          <p className="text-sm text-slate-400">&copy; {new Date().getFullYear()} Ara Bakery Cloud</p>
        </div>
      </footer>
    </div>
  );
}
