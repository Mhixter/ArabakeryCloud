import { Link } from "wouter";
import LandingNav from "./nav";
import {
  Factory, Package, ShoppingCart, BarChart3,
  Users, Shield, Palette, Building2, Smartphone, Cloud,
  CheckCircle, ChevronRight, Wheat,
} from "lucide-react";

const SECTIONS = [
  {
    tag: "Production",
    heading: "Total control over your baking operations",
    desc: "Know exactly what's coming out of your ovens every day — and how much it costs you to make it.",
    icon: Factory,
    features: [
      "Log daily production batches with quantities and recipes",
      "Track yield efficiency — actual output vs. expected",
      "Waste recording with category analysis",
      "Production history and performance trends",
      "Recipe cost calculator per product",
    ],
  },
  {
    tag: "Inventory",
    heading: "Never run out of ingredients again",
    desc: "Real-time ingredient tracking with automatic deductions when production is logged.",
    icon: Package,
    features: [
      "Ingredient stock levels updated in real time",
      "Low-stock alerts before you run out",
      "Supplier price tracking and purchase history",
      "Inventory valuation and cost of goods",
      "Stock adjustment with full audit trail",
    ],
  },
  {
    tag: "Sales",
    heading: "Fast checkout and beautiful receipts",
    desc: "Record sales across all your product lines, issue branded receipts, and never miss a transaction.",
    icon: ShoppingCart,
    features: [
      "Quick sales entry — counter, wholesale and custom orders",
      "Branded receipts with your logo and theme",
      "Daily cash reconciliation reports",
      "Cash and bank transfer tracking",
      "Downloadable receipts for every sale",
    ],
  },
  {
    tag: "Reports",
    heading: "Insights that drive real decisions",
    desc: "Revenue, profit margins, waste analysis — everything you need to know about your bakery's health.",
    icon: BarChart3,
    features: [
      "Daily, weekly and monthly sales dashboards",
      "Product profitability and margin analysis",
      "Production vs. sales gap tracking",
      "Staff performance metrics",
      "Exportable reports for your accountant",
    ],
  },
];

const PLATFORM = [
  { icon: Users,      title: "Role-based access",    desc: "MD, Manager, Cashier, Receptionist — each person sees only what they need." },
  { icon: Building2,  title: "Multi-branch",          desc: "Run multiple bakery locations from a single account. Consolidated or per-branch views." },
  { icon: Palette,    title: "Custom branding",       desc: "Upload your logo and choose from 5 themes to match your brand on all receipts." },
  { icon: Shield,     title: "Secure & private",      desc: "Your data is encrypted, backed up daily, and never shared." },
  { icon: Smartphone, title: "Works on any device",   desc: "Phones, tablets, laptops — install as a mobile app or use in any browser." },
  { icon: Cloud,      title: "Works offline",         desc: "Lose internet? No problem. Sync automatically when you reconnect." },
];

export default function LandingFeatures() {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <LandingNav />

      {/* Hero */}
      <section className="bg-slate-950 pt-28 pb-20">
        <div className="max-w-2xl mx-auto px-5 text-center">
          <p className="text-amber-400 text-xs font-bold uppercase tracking-[0.2em] mb-4">Everything included</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.1] mb-5">
            Features built for<br />real bakeries
          </h1>
          <p className="text-white/40 text-base leading-relaxed mb-8">
            One platform handles every corner of your bakery business — no spreadsheets, no guesswork, no chaos.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/register"
              className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-slate-950 font-bold bg-amber-400 hover:bg-amber-300 transition-colors text-base no-underline w-full sm:w-auto">
              Start Free Trial
              <ChevronRight size={16} />
            </Link>
            <Link href="/pricing"
              className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-white/60 font-semibold border border-white/10 hover:border-white/20 hover:text-white transition-colors text-base no-underline w-full sm:w-auto">
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Feature sections */}
      {SECTIONS.map((s, idx) => {
        const Icon = s.icon;
        const flip = idx % 2 === 1;
        return (
          <section key={s.tag} className={`py-20 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
            <div className="max-w-5xl mx-auto px-5">
              <div className={`grid md:grid-cols-2 gap-12 items-center ${flip ? "md:flex md:flex-row-reverse" : ""}`}>
                {/* Text */}
                <div>
                  <div className="inline-flex items-center gap-2 bg-slate-950 text-amber-400 text-xs font-bold px-3 py-1.5 rounded-full mb-5">
                    <Icon size={12} />
                    {s.tag}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight leading-snug mb-4">
                    {s.heading}
                  </h2>
                  <p className="text-slate-400 leading-relaxed mb-7">{s.desc}</p>
                  <ul className="space-y-3">
                    {s.features.map(f => (
                      <li key={f} className="flex items-start gap-3 text-sm text-slate-600">
                        <CheckCircle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Visual */}
                <div className={`flex justify-center ${flip ? "md:justify-start" : "md:justify-end"}`}>
                  <div className="w-full max-w-sm rounded-2xl bg-slate-950 p-8 flex items-center justify-center" style={{ minHeight: 280 }}>
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-2xl bg-amber-400 flex items-center justify-center mx-auto mb-5">
                        <Icon size={32} className="text-slate-950" />
                      </div>
                      <p className="text-white font-bold text-lg mb-2">{s.tag}</p>
                      <p className="text-white/40 text-sm leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      })}

      {/* Platform section */}
      <section className="py-20 bg-slate-950">
        <div className="max-w-5xl mx-auto px-5">
          <div className="text-center mb-14">
            <p className="text-amber-400 text-xs font-bold uppercase tracking-[0.2em] mb-3">Platform</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Everything works together
            </h2>
            <p className="text-white/40 mt-4 max-w-lg mx-auto">
              Ara Bakery Cloud is designed as a complete system — every feature connects to every other.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PLATFORM.map(p => {
              const Icon = p.icon;
              return (
                <div key={p.title} className="rounded-2xl bg-white/5 border border-white/5 p-6">
                  <div className="w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center mb-5">
                    <Icon size={18} className="text-slate-950" />
                  </div>
                  <h3 className="font-bold text-white mb-2">{p.title}</h3>
                  <p className="text-white/40 text-sm leading-relaxed">{p.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-white">
        <div className="max-w-xl mx-auto px-5 text-center">
          <h2 className="text-3xl font-extrabold text-slate-950 tracking-tight mb-4">
            Ready to take control?
          </h2>
          <p className="text-slate-400 mb-8">Start your 7-day free trial. No credit card. No contracts.</p>
          <Link href="/register"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-slate-950 font-bold bg-amber-400 hover:bg-amber-300 transition-colors text-base no-underline">
            Start Free Trial
            <ChevronRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="py-10 bg-slate-950 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-400 flex items-center justify-center">
              <Wheat size={14} className="text-slate-950" />
            </div>
            <span className="font-bold text-white text-sm tracking-tight">Ara Bakery Cloud</span>
          </div>
          <p className="text-sm text-white/20">&copy; {new Date().getFullYear()} Ara Bakery Cloud. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
