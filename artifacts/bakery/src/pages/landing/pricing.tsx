import { Link } from "wouter";
import LandingNav from "./nav";

const PLAN_FEATURES = [
  "Unlimited sales recording",
  "Production batch tracking",
  "Full inventory management",
  "Branded receipts & invoices",
  "Sales & profit reports",
  "Up to 5 staff accounts",
  "Multi-branch support",
  "Audit logs & history",
  "5 theme customizations",
  "Email & chat support",
];

const FAQS = [
  { q: "Is the 7-day trial really free?", a: "Yes! You get full access to every feature during your trial — no credit card required. You only pay after the 7 days if you decide to continue." },
  { q: "What happens after my trial ends?", a: "Your account will enter a grace period. You can renew at ₦3,000/month to continue accessing your data. Nothing is deleted." },
  { q: "Can I manage multiple bakery branches?", a: "Absolutely. One account supports multiple branches. You can view consolidated reports or drill down into each branch separately." },
  { q: "How do I pay the subscription?", a: "We support payment via Paystack and Flutterwave — bank transfer, card, USSD, and mobile money. Your bakery manager can renew directly from the dashboard." },
  { q: "Can I cancel at any time?", a: "Yes. There are no long-term contracts. Cancel whenever you want and your access continues until the end of your current billing period." },
  { q: "Is my bakery data safe?", a: "All your data is stored securely in the cloud, encrypted at rest and in transit. We perform daily backups and have 99.9% uptime." },
];

const COMPARISONS = [
  { feature: "Production tracking",       cloud: true, spreadsheet: "Manual" },
  { feature: "Automatic inventory deduction", cloud: true, spreadsheet: false },
  { feature: "Real-time sales dashboard", cloud: true, spreadsheet: false },
  { feature: "Branded receipts",          cloud: true, spreadsheet: false },
  { feature: "Staff role management",     cloud: true, spreadsheet: false },
  { feature: "Profit & waste reports",    cloud: true, spreadsheet: "Manual" },
  { feature: "Multi-branch support",      cloud: true, spreadsheet: false },
  { feature: "Works on mobile",           cloud: true, spreadsheet: "Partial" },
];

export default function LandingPricing() {
  return (
    <div className="min-h-screen bg-white">
      <LandingNav />

      {/* Hero */}
      <section className="pt-28 pb-16 text-center" style={{background:"linear-gradient(160deg,#fffbeb 0%,#fef3c7 50%,#fff7ed 100%)"}}>
        <div className="max-w-2xl mx-auto px-6">
          <p className="text-amber-600 text-sm font-bold uppercase tracking-widest mb-3">Simple, honest pricing</p>
          <h1 className="text-5xl font-extrabold text-slate-900 mb-5 leading-tight" style={{fontFamily:"'Playfair Display',serif"}}>
            One plan.<br />
            <span style={{color:"#d97706"}}>Everything included.</span>
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed">
            No tiered features, no hidden fees. Every bakery gets the full platform at one straightforward price.
          </p>
        </div>
      </section>

      {/* Pricing card */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-6 items-stretch">
            {/* Starter Plan */}
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border-2 border-amber-400 flex flex-col">
              {/* Badge */}
              <div className="absolute top-5 right-5">
                <span className="px-3 py-1 rounded-full text-xs font-bold text-white" style={{background:"linear-gradient(135deg,#f59e0b,#d97706)"}}>
                  MOST POPULAR
                </span>
              </div>
              {/* Header */}
              <div className="p-8 pb-6" style={{background:"linear-gradient(135deg,#fef3c7 0%,#fff7ed 100%)"}}>
                <div className="text-4xl mb-3">🍞</div>
                <h3 className="text-xl font-extrabold text-slate-800 mb-1" style={{fontFamily:"'Playfair Display',serif"}}>Starter Plan</h3>
                <p className="text-slate-500 text-sm mb-6">For single or multi-branch bakeries ready to go digital.</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold text-slate-900" style={{fontFamily:"'Playfair Display',serif"}}>₦3,000</span>
                  <span className="text-slate-400 text-lg">/ month</span>
                </div>
                <p className="text-sm text-amber-600 font-semibold mt-2">Includes 7-day free trial</p>
              </div>
              {/* Features */}
              <div className="p-8 flex-1 bg-white">
                <ul className="space-y-3 mb-8">
                  {PLAN_FEATURES.map(f => (
                    <li key={f} className="flex items-center gap-3 text-sm text-slate-700">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{background:"#f59e0b"}}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="block text-center w-full py-4 rounded-xl text-white font-semibold text-lg shadow-lg hover:opacity-90 transition-all"
                    style={{background:"linear-gradient(135deg,#f59e0b,#d97706)"}}>
                    Start Free 7-Day Trial →
                  </Link>
                <p className="text-center text-xs text-slate-400 mt-3">No credit card required</p>
              </div>
            </div>

            {/* What you get panel */}
            <div className="rounded-3xl border border-slate-100 p-8 bg-slate-50/60 flex flex-col">
              <h3 className="text-xl font-extrabold text-slate-800 mb-2" style={{fontFamily:"'Playfair Display',serif"}}>
                Why ₦3,000 is worth it
              </h3>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                Most Nigerian bakeries lose 15–30% of potential revenue due to poor tracking. Ara Bakery Cloud pays for itself in the first week.
              </p>
              <div className="space-y-4 flex-1">
                {[
                  { icon: "📉", title: "Stop the waste losses", desc: "Average bakery wastes ₦45,000/month. Real-time tracking cuts that by 40%." },
                  { icon: "📈", title: "Know your best sellers", desc: "Find out which products make the most profit — and double down." },
                  { icon: "⏱️", title: "Save 3 hours daily", desc: "No more manual spreadsheets. Managers spend time running the bakery, not counting." },
                  { icon: "🏆", title: "Look professional", desc: "Branded receipts and clean reporting make your bakery stand out to wholesale clients." },
                ].map(b => (
                  <div key={b.title} className="flex gap-3 p-4 rounded-2xl bg-white border border-slate-100">
                    <span className="text-2xl flex-shrink-0">{b.icon}</span>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{b.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{b.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="py-16" style={{background:"linear-gradient(160deg,#fffbeb 0%,#fff7ed 100%)"}}>
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold text-slate-900" style={{fontFamily:"'Playfair Display',serif"}}>
              Ara Cloud vs. Spreadsheets
            </h2>
            <p className="text-slate-500 mt-3">See why bakeries are switching from Excel and WhatsApp groups.</p>
          </div>
          <div className="rounded-2xl overflow-hidden border border-amber-200 shadow-lg bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr style={{background:"linear-gradient(135deg,#f59e0b,#d97706)"}}>
                  <th className="text-left px-6 py-4 text-white font-semibold">Feature</th>
                  <th className="text-center px-6 py-4 text-white font-semibold">🍞 Ara Cloud</th>
                  <th className="text-center px-6 py-4 text-white/80 font-semibold">📋 Spreadsheet</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISONS.map((c, i) => (
                  <tr key={c.feature} className={`border-b border-slate-50 ${i % 2 === 0 ? "bg-white" : "bg-amber-50/30"}`}>
                    <td className="px-6 py-3.5 text-slate-700 font-medium">{c.feature}</td>
                    <td className="px-6 py-3.5 text-center">
                      {c.cloud === true ? <span className="text-green-600 font-bold text-lg">✓</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {c.spreadsheet === true
                        ? <span className="text-green-600 font-bold text-lg">✓</span>
                        : c.spreadsheet === false
                          ? <span className="text-red-400 font-bold text-lg">✗</span>
                          : <span className="text-amber-500 text-xs font-semibold">{c.spreadsheet}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-slate-900" style={{fontFamily:"'Playfair Display',serif"}}>
              Frequently asked questions
            </h2>
          </div>
          <div className="space-y-4">
            {FAQS.map(faq => (
              <details key={faq.q} className="group rounded-2xl border border-slate-100 overflow-hidden">
                <summary className="flex items-center justify-between px-6 py-4 cursor-pointer font-semibold text-slate-800 hover:bg-amber-50/50 transition-colors list-none">
                  {faq.q}
                  <span className="text-amber-500 group-open:rotate-45 transition-transform text-xl font-light flex-shrink-0 ml-4">+</span>
                </summary>
                <div className="px-6 pb-5 text-slate-500 leading-relaxed text-sm border-t border-slate-50 pt-4">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 text-center" style={{background:"linear-gradient(160deg,#fffbeb 0%,#fef3c7 100%)"}}>
        <div className="max-w-xl mx-auto px-6">
          <div className="flex justify-center gap-3 text-4xl mb-6">
            <span style={{animation:"float 3s ease-in-out infinite"}}>🍰</span>
            <span style={{animation:"float 3s ease-in-out infinite 0.5s"}}>🥐</span>
            <span style={{animation:"float 3s ease-in-out infinite 1s"}}>🎂</span>
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 mb-4" style={{fontFamily:"'Playfair Display',serif"}}>
            Start your free trial today
          </h2>
          <p className="text-slate-500 mb-8">7 days free, then ₦3,000/month. No contracts. No hidden fees.</p>
          <Link href="/register" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-semibold text-lg shadow-xl hover:opacity-90 transition-all hover:shadow-2xl"
              style={{background:"linear-gradient(135deg,#f59e0b,#d97706)"}}>
              Create your free account →
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
