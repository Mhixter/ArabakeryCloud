import { Link } from "wouter";
import LandingNav from "./nav";

const SECTIONS = [
  {
    tag: "Production",
    emoji: "🏭",
    color: "#fef3c7",
    accent: "#f59e0b",
    heading: "Total control over your baking operations",
    desc: "Know exactly what's coming out of your ovens every day — and how much it costs you to make it.",
    features: [
      "Log daily production batches with quantities and recipes",
      "Track yield efficiency — actual output vs. expected",
      "Waste recording with category analysis",
      "Production history and performance trends",
      "Recipe cost calculator per product",
    ],
    visual: ["🍞","🥐","🥖","🧇","🥞"],
  },
  {
    tag: "Inventory",
    emoji: "📦",
    color: "#d1fae5",
    accent: "#10b981",
    heading: "Never run out of ingredients again",
    desc: "Real-time ingredient tracking with automatic deductions when production is logged.",
    features: [
      "Ingredient stock levels updated in real time",
      "Low-stock alerts before you run out",
      "Supplier price tracking and purchase history",
      "Inventory valuation and cost of goods",
      "Stock adjustment with audit trail",
    ],
    visual: ["🌾","🧈","🥚","🥛","🍯"],
  },
  {
    tag: "Sales",
    emoji: "💳",
    color: "#e0e7ff",
    accent: "#6366f1",
    heading: "Fast checkout and beautiful receipts",
    desc: "Record sales across all your product lines, issue branded receipts, and never miss a transaction.",
    features: [
      "Quick sales entry — counter, wholesale and custom orders",
      "Branded receipts with your logo and theme",
      "Daily cash reconciliation reports",
      "Customer transaction history",
      "Multi-payment method support (cash, transfer, POS)",
    ],
    visual: ["💵","🧾","📱","💳","🏷️"],
  },
  {
    tag: "Reports",
    emoji: "📊",
    color: "#fce7f3",
    accent: "#ec4899",
    heading: "Insights that actually help you grow",
    desc: "Weekly and monthly dashboards that show you what's working and what needs attention.",
    features: [
      "Sales trend charts — daily, weekly, monthly",
      "Profit margin analysis per product",
      "Production efficiency and waste percentage",
      "Top-selling products and slow movers",
      "Branch comparison (for multi-location bakeries)",
    ],
    visual: ["📈","💰","📉","🏆","🎯"],
  },
];

const EXTRAS = [
  { icon: "👥", title: "Team Roles", desc: "Managing Director, Baker, Cashier, Manager — each with the right permissions." },
  { icon: "🔐", title: "Audit Logs", desc: "Every action logged with timestamps. Know who changed what and when." },
  { icon: "🎨", title: "5 Themes", desc: "Amber, Orange, Blue, Green, Slate — pick the personality that fits your brand." },
  { icon: "🏢", title: "Multi-Branch", desc: "Manage all your locations from one account with per-branch reporting." },
  { icon: "📱", title: "Mobile Ready", desc: "Works beautifully on phones and tablets — manage from anywhere." },
  { icon: "☁️", title: "Always Synced", desc: "Cloud-based — your data is always backed up and accessible from any device." },
];

export default function LandingFeatures() {
  return (
    <div className="min-h-screen bg-white">
      <LandingNav />

      {/* Hero */}
      <section className="pt-28 pb-16 text-center" style={{background:"linear-gradient(160deg,#fffbeb 0%,#fef3c7 50%,#fff7ed 100%)"}}>
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-amber-600 text-sm font-bold uppercase tracking-widest mb-3">Everything included</p>
          <h1 className="text-5xl font-extrabold text-slate-900 mb-5 leading-tight" style={{fontFamily:"'Playfair Display',serif"}}>
            Features built for <span style={{color:"#d97706"}}>real bakeries</span>
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed">
            One platform handles every corner of your bakery business — no spreadsheets, no guesswork, no chaos.
          </p>
          <div className="flex items-center justify-center gap-4 mt-8">
            <Link href="/register" className="px-7 py-3.5 rounded-xl text-white font-semibold shadow-lg hover:opacity-90 transition-all"
                style={{background:"linear-gradient(135deg,#f59e0b,#d97706)"}}>
                Start Free Trial
              </Link>
            <Link href="/pricing" className="px-7 py-3.5 rounded-xl font-semibold text-slate-700 border-2 border-amber-200 hover:border-amber-400 hover:bg-amber-50 transition-all">
                View Pricing
              </Link>
          </div>
        </div>
      </section>

      {/* Main feature sections */}
      {SECTIONS.map((s, i) => (
        <section key={s.tag} className={`py-20 ${i % 2 === 1 ? "bg-slate-50/60" : "bg-white"}`}>
          <div className="max-w-6xl mx-auto px-6">
            <div className={`grid lg:grid-cols-2 gap-12 items-center ${i % 2 === 1 ? "lg:grid-flow-dense" : ""}`}>
              {/* Text */}
              <div className={i % 2 === 1 ? "lg:col-start-2" : ""}>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold mb-4"
                  style={{background: s.color, color: s.accent}}>
                  {s.emoji} {s.tag}
                </div>
                <h2 className="text-3xl font-extrabold text-slate-900 mb-4 leading-snug" style={{fontFamily:"'Playfair Display',serif"}}>
                  {s.heading}
                </h2>
                <p className="text-slate-500 mb-6 leading-relaxed text-lg">{s.desc}</p>
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

              {/* Visual */}
              <div className={`relative ${i % 2 === 1 ? "lg:col-start-1 lg:row-start-1" : ""}`}>
                <div className="rounded-3xl p-10 relative overflow-hidden flex items-center justify-center"
                  style={{background: s.color, minHeight: 280}}>
                  {/* Background pattern */}
                  <div className="absolute inset-0 opacity-10"
                    style={{backgroundImage:"radial-gradient(circle at 25% 25%, rgba(0,0,0,0.1) 2px, transparent 2px), radial-gradient(circle at 75% 75%, rgba(0,0,0,0.1) 2px, transparent 2px)", backgroundSize:"32px 32px"}} />

                  {/* Animated product circles */}
                  <div className="relative flex flex-wrap gap-4 items-center justify-center max-w-xs">
                    {s.visual.map((emoji, j) => (
                      <div key={j} className="w-16 h-16 rounded-2xl bg-white shadow-lg flex items-center justify-center text-3xl border-2 border-white/80"
                        style={{animation:`float ${3.5 + j * 0.3}s ease-in-out infinite`, animationDelay:`${j * 0.5}s`}}>
                        {emoji}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* Extra features grid */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-amber-600 text-sm font-bold uppercase tracking-widest mb-2">And much more</p>
            <h2 className="text-3xl font-extrabold text-slate-900" style={{fontFamily:"'Playfair Display',serif"}}>
              Everything else your bakery needs
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
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
      <section className="py-20 text-center" style={{background:"linear-gradient(160deg,#fffbeb 0%,#fff7ed 100%)"}}>
        <div className="max-w-xl mx-auto px-6">
          <h2 className="text-3xl font-extrabold text-slate-900 mb-4" style={{fontFamily:"'Playfair Display',serif"}}>
            Ready to try all of this?
          </h2>
          <p className="text-slate-500 mb-8">Start your 7-day free trial today. No credit card required.</p>
          <Link href="/register" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-semibold text-lg shadow-xl hover:opacity-90 transition-all"
              style={{background:"linear-gradient(135deg,#f59e0b,#d97706)"}}>
              Get Started Free →
            </Link>
        </div>
      </section>

      <footer className="py-10 border-t border-slate-100 bg-white">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🍞</span>
            <span className="font-bold text-slate-700" style={{fontFamily:"'Playfair Display',serif"}}>Ara Bakery Cloud</span>
          </div>
          <p className="text-sm text-slate-400">© {new Date().getFullYear()} Ara Bakery Cloud. All rights reserved.</p>
        </div>
      </footer>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}
