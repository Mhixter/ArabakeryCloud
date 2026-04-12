import { Link } from "wouter";
import LandingNav from "./nav";

const SECTIONS = [
  {
    tag: "Production",
    accent: "#f59e0b",
    bg: "#fef3c7",
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
    accent: "#10b981",
    bg: "#d1fae5",
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
    accent: "#6366f1",
    bg: "#e0e7ff",
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
    accent: "#ec4899",
    bg: "#fce7f3",
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
  { icon: "👥", title: "Team Roles", desc: "Managing Director, Baker, Cashier, Manager — each with the right permissions." },
  { icon: "🔐", title: "Audit Logs", desc: "Every action logged with timestamps. Know who changed what and when." },
  { icon: "🎨", title: "5 Themes", desc: "Amber, Orange, Blue, Green, Slate — pick the personality that fits your brand." },
  { icon: "🏢", title: "Multi-Branch", desc: "Manage all your locations from one account with per-branch reporting." },
  { icon: "📱", title: "Mobile Ready", desc: "Optimised for phones and tablets — manage from anywhere, even offline." },
  { icon: "☁️", title: "Always Synced", desc: "Cloud-based — your data is backed up and accessible from any device." },
];

export default function LandingFeatures() {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <LandingNav />

      {/* Hero */}
      <section className="pt-24 pb-14 text-center relative" style={{background:"linear-gradient(160deg,#fffbeb 0%,#fef3c7 50%,#fff7ed 100%)"}}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 relative z-10">
          <p className="text-amber-600 text-sm font-bold uppercase tracking-widest mb-3">Everything included</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 mb-5 leading-tight" style={{fontFamily:"'Playfair Display',serif"}}>
            Features built for <span style={{color:"#d97706"}}>real bakeries</span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 leading-relaxed mb-8">
            One platform handles every corner of your bakery business — no spreadsheets, no guesswork, no chaos.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/register"
              className="flex items-center justify-center px-7 py-3.5 rounded-xl text-white font-semibold shadow-lg hover:opacity-90 active:scale-95 transition-all touch-manipulation w-full sm:w-auto"
              style={{background:"linear-gradient(135deg,#f59e0b,#d97706)"}}>
              Start Free Trial
            </Link>
            <Link href="/pricing"
              className="flex items-center justify-center px-7 py-3.5 rounded-xl font-semibold text-slate-700 border-2 border-amber-200 hover:border-amber-400 hover:bg-amber-50 active:scale-95 transition-all touch-manipulation w-full sm:w-auto">
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Main feature sections — alternating layout */}
      {SECTIONS.map((s, i) => (
        <section key={s.tag} className={`py-14 sm:py-20 ${i % 2 === 1 ? "bg-slate-50/60" : "bg-white"}`}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className={`grid lg:grid-cols-2 gap-10 lg:gap-16 items-center ${i % 2 === 1 ? "lg:grid-flow-dense" : ""}`}>

              {/* Text */}
              <div className={i % 2 === 1 ? "lg:col-start-2" : ""}>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold mb-5"
                  style={{background: s.bg, color: s.accent}}>
                  {s.tag}
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-4 leading-snug" style={{fontFamily:"'Playfair Display',serif"}}>
                  {s.heading}
                </h2>
                <p className="text-slate-500 mb-6 leading-relaxed text-base sm:text-lg">{s.desc}</p>
                <ul className="space-y-3">
                  {s.features.map(f => (
                    <li key={f} className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold text-white"
                        style={{background: s.accent}}>✓</span>
                      <span className="text-slate-600 text-sm leading-relaxed">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Real photo */}
              <div className={i % 2 === 1 ? "lg:col-start-1 lg:row-start-1" : ""}>
                <div className="rounded-3xl overflow-hidden shadow-2xl border-4 border-white"
                  style={{aspectRatio:"4/3"}}>
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

      {/* Bakery gallery strip */}
      <section className="py-4 bg-white overflow-hidden">
        <div className="flex gap-4 animate-none" style={{display:"flex",gap:16,overflowX:"auto",padding:"0 24px",scrollbarWidth:"none"}}>
          {[
            "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&h=200&fit=crop&q=70",
            "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=300&h=200&fit=crop&q=70",
            "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=300&h=200&fit=crop&q=70",
            "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=300&h=200&fit=crop&q=70",
            "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=300&h=200&fit=crop&q=70",
            "https://images.unsplash.com/photo-1517433670267-08bbd4be890f?w=300&h=200&fit=crop&q=70",
          ].map((src, i) => (
            <div key={i} className="rounded-2xl overflow-hidden shadow-md flex-shrink-0 border-4 border-white" style={{width:240,height:160}}>
              <img src={src} alt="Bakery product" className="w-full h-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      </section>

      {/* Extra features grid */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-12">
            <p className="text-amber-600 text-sm font-bold uppercase tracking-widest mb-2">And much more</p>
            <h2 className="text-3xl font-extrabold text-slate-900" style={{fontFamily:"'Playfair Display',serif"}}>
              Everything else your bakery needs
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {EXTRAS.map(e => (
              <div key={e.title} className="flex gap-4 p-5 rounded-2xl border border-slate-100 hover:border-amber-200 hover:shadow-md transition-all bg-white">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{background:"#fef3c7"}}>
                  {e.icon}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 mb-1">{e.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{e.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 text-center" style={{background:"linear-gradient(160deg,#fffbeb 0%,#fff7ed 100%)"}}>
        <div className="max-w-xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-extrabold text-slate-900 mb-4" style={{fontFamily:"'Playfair Display',serif"}}>
            Ready to try all of this?
          </h2>
          <p className="text-slate-500 mb-8">Start your 7-day free trial today. No credit card required.</p>
          <Link href="/register"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-semibold text-lg shadow-xl hover:opacity-90 active:scale-95 transition-all touch-manipulation"
            style={{background:"linear-gradient(135deg,#f59e0b,#d97706)"}}>
            Get Started Free →
          </Link>
        </div>
      </section>

      <footer className="py-10 border-t border-slate-100 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🍞</span>
            <span className="font-bold text-slate-700" style={{fontFamily:"'Playfair Display',serif"}}>Ara Bakery Cloud</span>
          </div>
          <p className="text-sm text-slate-400">© {new Date().getFullYear()} Ara Bakery Cloud. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
