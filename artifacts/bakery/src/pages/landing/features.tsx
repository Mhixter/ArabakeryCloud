import { Link } from "wouter";
import LandingNav from "./nav";
import {
  Factory, Package, ShoppingCart, BarChart3,
  Users, Shield, Palette, Building2, Smartphone, Cloud,
  CheckCircle, ChevronRight,
} from "lucide-react";

const SECTIONS = [
  {
    tag: "Production",
    tagColor: "text-amber-700 bg-amber-50 border-amber-200",
    heading: "Total control over your baking operations",
    desc: "Know exactly what's coming out of your ovens every day — and how much it costs you to make it.",
    photo: "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=700&h=500&fit=crop&q=80",
    photoAlt: "Baker kneading dough in professional kitchen",
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
    tagColor: "text-green-700 bg-green-50 border-green-200",
    heading: "Never run out of ingredients again",
    desc: "Real-time ingredient tracking with automatic deductions when production is logged.",
    photo: "https://images.unsplash.com/photo-1454944338482-a69bb95894af?w=700&h=500&fit=crop&q=80",
    photoAlt: "Bakery ingredients and supplies",
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
    tagColor: "text-indigo-700 bg-indigo-50 border-indigo-200",
    heading: "Fast checkout and beautiful receipts",
    desc: "Record sales across all your product lines, issue branded receipts, and never miss a transaction.",
    photo: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=700&h=500&fit=crop&q=80",
    photoAlt: "Bakery counter with display of fresh products",
    features: [
      "Quick sales entry — counter, wholesale and custom orders",
      "Branded receipts with your logo and theme",
      "Daily cash reconciliation reports",
      "Customer transaction history",
      "Multi-payment method support (cash, transfer, POS)",
    ],
  },
  {
    tag: "Reports",
    tagColor: "text-rose-700 bg-rose-50 border-rose-200",
    heading: "Insights that actually help you grow",
    desc: "Weekly and monthly dashboards that show you what's working and what needs attention.",
    photo: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=700&h=500&fit=crop&q=80",
    photoAlt: "Business analytics dashboard",
    features: [
      "Sales trend charts — daily, weekly, monthly",
      "Profit margin analysis per product",
      "Production efficiency and waste percentage",
      "Top-selling products and slow movers",
      "Branch comparison (for multi-location bakeries)",
    ],
  },
];

const EXTRAS = [
  { icon: Users,        title: "Team Roles",      desc: "Managing Director, Baker, Cashier, Manager — each with the right permissions." },
  { icon: Shield,       title: "Audit Logs",       desc: "Every action logged with timestamps. Know who changed what and when." },
  { icon: Palette,      title: "5 Themes",         desc: "Amber, Orange, Blue, Green, Slate — pick the look that fits your brand." },
  { icon: Building2,    title: "Multi-Branch",     desc: "Manage all your locations from one account with per-branch reporting." },
  { icon: Smartphone,   title: "Mobile Ready",     desc: "Optimised for phones and tablets — manage from anywhere, even offline." },
  { icon: Cloud,        title: "Always Synced",    desc: "Cloud-based — your data is backed up and accessible from any device." },
];

export default function LandingFeatures() {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <LandingNav />

      {/* Hero */}
      <section className="pt-24 pb-14 bg-slate-50 border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-5 text-center pt-8">
          <p className="text-amber-600 text-sm font-bold uppercase tracking-widest mb-3">Everything included</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 mb-5 leading-tight" style={{ fontFamily: "'Playfair Display',serif" }}>
            Features built for<br />
            <span className="text-amber-600">real bakeries</span>
          </h1>
          <p className="text-lg text-slate-500 leading-relaxed mb-8">
            One platform handles every corner of your bakery business — no spreadsheets, no guesswork, no chaos.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/register"
              className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-white bg-amber-600 hover:bg-amber-700 font-semibold transition-colors no-underline w-full sm:w-auto">
              Start Free Trial
              <ChevronRight size={16} />
            </Link>
            <Link href="/pricing"
              className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-slate-700 border-2 border-slate-200 hover:border-slate-300 font-semibold transition-colors no-underline w-full sm:w-auto">
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Main feature sections — alternating */}
      {SECTIONS.map((s, i) => (
        <section key={s.tag} className={`py-14 sm:py-20 ${i % 2 === 1 ? "bg-slate-50" : "bg-white"}`}>
          <div className="max-w-6xl mx-auto px-5">
            <div className={`grid lg:grid-cols-2 gap-10 lg:gap-16 items-center ${i % 2 === 1 ? "lg:grid-flow-dense" : ""}`}>
              {/* Text */}
              <div className={i % 2 === 1 ? "lg:col-start-2" : ""}>
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold mb-5 border ${s.tagColor}`}>
                  {s.tag}
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-4 leading-snug" style={{ fontFamily: "'Playfair Display',serif" }}>
                  {s.heading}
                </h2>
                <p className="text-slate-500 mb-6 leading-relaxed">{s.desc}</p>
                <ul className="space-y-3">
                  {s.features.map(f => (
                    <li key={f} className="flex items-start gap-3">
                      <CheckCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-600 text-sm leading-relaxed">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Photo */}
              <div className={i % 2 === 1 ? "lg:col-start-1 lg:row-start-1" : ""}>
                <div className="rounded-2xl overflow-hidden shadow-xl border border-slate-100" style={{ aspectRatio: "4/3" }}>
                  <img
                    src={s.photo}
                    alt={s.photoAlt}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* Photo gallery strip */}
      <section className="py-4 bg-white">
        <div className="flex gap-4 overflow-x-auto px-5" style={{ scrollbarWidth: "none" }}>
          {[
            "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&h=200&fit=crop&q=70",
            "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=300&h=200&fit=crop&q=70",
            "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=300&h=200&fit=crop&q=70",
            "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=300&h=200&fit=crop&q=70",
            "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=300&h=200&fit=crop&q=70",
            "https://images.unsplash.com/photo-1517433670267-08bbd4be890f?w=300&h=200&fit=crop&q=70",
          ].map((src, i) => (
            <div key={i} className="rounded-xl overflow-hidden flex-shrink-0 border-2 border-white shadow-md" style={{ width: 220, height: 148 }}>
              <img src={src} alt="Bakery product" className="w-full h-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      </section>

      {/* Extra features grid */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-5">
          <div className="text-center mb-10">
            <p className="text-amber-600 text-sm font-bold uppercase tracking-widest mb-2">And much more</p>
            <h2 className="text-3xl font-extrabold text-slate-900" style={{ fontFamily: "'Playfair Display',serif" }}>
              Everything else your bakery needs
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {EXTRAS.map(e => {
              const Icon = e.icon;
              return (
                <div key={e.title} className="flex gap-4 p-5 rounded-2xl border border-slate-100 hover:border-amber-200 hover:shadow-md transition-all bg-white">
                  <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <Icon size={20} className="text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 mb-1 text-sm">{e.title}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">{e.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 bg-amber-600">
        <div className="max-w-xl mx-auto px-5 text-center">
          <h2 className="text-3xl font-extrabold text-white mb-4" style={{ fontFamily: "'Playfair Display',serif" }}>
            Ready to try all of this?
          </h2>
          <p className="text-amber-100 mb-8">Start your 7-day free trial today. No credit card required.</p>
          <Link href="/register"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-amber-700 font-bold text-lg hover:bg-amber-50 transition-colors no-underline">
            Get Started Free
            <ChevronRight size={18} />
          </Link>
        </div>
      </section>

      <footer className="py-10 border-t border-slate-100 bg-white">
        <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-600 flex items-center justify-center">
              <Factory size={14} className="text-white" />
            </div>
            <span className="font-bold text-slate-700" style={{ fontFamily: "'Playfair Display',serif" }}>Ara Bakery Cloud</span>
          </div>
          <p className="text-sm text-slate-400">&copy; {new Date().getFullYear()} Ara Bakery Cloud. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
