import { Link } from "wouter";
import LandingNav from "./nav";
import {
  CheckCircle, X, ChevronRight, Wheat,
  TrendingDown, TrendingUp, Clock, Star, Minus,
} from "lucide-react";

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
  { q: "Is the 7-day trial really free?", a: "Yes — full access to every feature during your trial. No credit card required. You only pay after the 7 days if you decide to continue." },
  { q: "What happens after my trial ends?", a: "Your account enters a grace period. Renew at ₦3,000/month to continue. Nothing is deleted." },
  { q: "Can I manage multiple bakery branches?", a: "Absolutely. One account supports multiple branches with consolidated reports or per-branch drill-downs." },
  { q: "How do I pay the subscription?", a: "We support Paystack and Flutterwave — bank transfer, card, USSD, and mobile money." },
  { q: "Can I cancel at any time?", a: "Yes. No long-term contracts. Cancel whenever and your access continues to the end of your billing period." },
  { q: "Is my bakery data safe?", a: "All data is encrypted at rest and in transit, with daily backups and 99.9% uptime." },
];

const COMPARISONS = [
  { feature: "Production tracking",           cloud: true,  sheet: "Manual" },
  { feature: "Automatic inventory deduction", cloud: true,  sheet: false },
  { feature: "Real-time sales dashboard",     cloud: true,  sheet: false },
  { feature: "Branded receipts",             cloud: true,  sheet: false },
  { feature: "Staff role management",        cloud: true,  sheet: false },
  { feature: "Profit & waste reports",       cloud: true,  sheet: "Manual" },
  { feature: "Multi-branch support",         cloud: true,  sheet: false },
  { feature: "Works on mobile",              cloud: true,  sheet: "Partial" },
];

const BENEFITS = [
  { icon: TrendingDown, title: "Stop the waste losses",  desc: "Average bakery wastes ₦45,000/month. Real-time tracking cuts that by 40%." },
  { icon: TrendingUp,   title: "Know your best sellers", desc: "Find which products make the most profit — and double down on them." },
  { icon: Clock,        title: "Save 3 hours daily",     desc: "No more manual spreadsheets. Spend time running the bakery, not counting." },
  { icon: Star,         title: "Look professional",       desc: "Branded receipts and clean reporting make your bakery stand out to wholesale clients." },
];

export default function LandingPricing() {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <LandingNav />

      {/* Hero */}
      <section className="bg-slate-950 pt-28 pb-20">
        <div className="max-w-2xl mx-auto px-5 text-center">
          <p className="text-amber-400 text-xs font-bold uppercase tracking-[0.2em] mb-4">Simple, honest pricing</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.1] mb-5">
            One plan.<br />Everything included.
          </h1>
          <p className="text-white/40 text-base leading-relaxed">
            No tiered features, no hidden fees. Every bakery gets the full platform at one straightforward price.
          </p>
        </div>
      </section>

      {/* Pricing card */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-5">
          <div className="grid md:grid-cols-2 gap-6">

            {/* Plan card */}
            <div className="rounded-2xl overflow-hidden border-2 border-slate-950 flex flex-col">
              <div className="bg-slate-950 p-7">
                <div className="flex items-center justify-between mb-5">
                  <div className="w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center">
                    <Wheat size={18} className="text-slate-950" />
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold text-slate-950 bg-amber-400">
                    MOST POPULAR
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-white mb-1 tracking-tight">Starter Plan</h3>
                <p className="text-white/40 text-sm mb-5">For single or multi-branch bakeries ready to go digital.</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold text-white tracking-tight">₦3,000</span>
                  <span className="text-white/40 text-sm">/ month</span>
                </div>
                <p className="text-sm text-amber-400 font-semibold mt-2">Includes 7-day free trial</p>
              </div>
              <div className="p-7 flex-1 bg-white">
                <ul className="space-y-3 mb-7">
                  {PLAN_FEATURES.map(f => (
                    <li key={f} className="flex items-center gap-3 text-sm text-slate-600">
                      <CheckCircle size={15} className="text-amber-500 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register"
                  className="block text-center w-full py-4 rounded-xl text-slate-950 font-bold text-base bg-amber-400 hover:bg-amber-300 transition-colors no-underline">
                  Start Free 7-Day Trial
                </Link>
                <p className="text-center text-xs text-slate-400 mt-3">No credit card required</p>
              </div>
            </div>

            {/* Why it's worth it */}
            <div className="rounded-2xl border border-slate-100 p-7 bg-slate-50 flex flex-col">
              <h3 className="text-xl font-extrabold text-slate-950 tracking-tight mb-2">
                Why ₦3,000 is worth it
              </h3>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                Most Nigerian bakeries lose 15–30% of potential revenue due to poor tracking. Ara Bakery Cloud pays for itself in the first week.
              </p>
              <div className="space-y-3 flex-1">
                {BENEFITS.map(b => {
                  const Icon = b.icon;
                  return (
                    <div key={b.title} className="flex gap-3 p-4 rounded-xl bg-white border border-slate-100">
                      <div className="w-9 h-9 rounded-xl bg-slate-950 flex items-center justify-center flex-shrink-0">
                        <Icon size={16} className="text-amber-400" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{b.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{b.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="py-20 bg-slate-950">
        <div className="max-w-3xl mx-auto px-5">
          <div className="text-center mb-12">
            <p className="text-amber-400 text-xs font-bold uppercase tracking-[0.2em] mb-3">Comparison</p>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              Ara Cloud vs. Spreadsheets
            </h2>
            <p className="text-white/40 mt-3">Why bakeries are switching from Excel and WhatsApp groups.</p>
          </div>
          <div className="rounded-2xl overflow-hidden border border-white/5">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5">
                  <th className="text-left px-6 py-4 text-white/60 font-semibold">Feature</th>
                  <th className="text-center px-6 py-4 text-amber-400 font-bold">Ara Cloud</th>
                  <th className="text-center px-6 py-4 text-white/30 font-semibold">Spreadsheet</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISONS.map((c, i) => (
                  <tr key={c.feature} className={`border-t border-white/5 ${i % 2 === 0 ? "" : "bg-white/[0.02]"}`}>
                    <td className="px-6 py-3.5 text-white/60 font-medium">{c.feature}</td>
                    <td className="px-6 py-3.5 text-center">
                      <CheckCircle size={16} className="text-green-400 mx-auto" />
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {c.sheet === true
                        ? <CheckCircle size={16} className="text-green-400 mx-auto" />
                        : c.sheet === false
                          ? <X size={16} className="text-red-400/60 mx-auto" />
                          : <span className="text-amber-400/70 text-xs font-semibold">{c.sheet}</span>}
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
        <div className="max-w-3xl mx-auto px-5">
          <div className="text-center mb-12">
            <p className="text-amber-500 text-xs font-bold uppercase tracking-[0.2em] mb-3">FAQ</p>
            <h2 className="text-3xl font-extrabold text-slate-950 tracking-tight">
              Frequently asked questions
            </h2>
          </div>
          <div className="space-y-2">
            {FAQS.map(faq => (
              <details key={faq.q} className="group rounded-2xl border border-slate-100 overflow-hidden">
                <summary className="flex items-center justify-between px-6 py-4 cursor-pointer font-semibold text-slate-800 hover:bg-slate-50 transition-colors list-none text-sm">
                  {faq.q}
                  <div className="flex-shrink-0 ml-4 w-5 h-5 rounded-full bg-slate-100 group-open:bg-amber-400 flex items-center justify-center transition-colors">
                    <Minus size={10} className="text-slate-500 group-open:hidden" />
                    <ChevronRight size={10} className="text-slate-950 hidden group-open:block rotate-90" />
                  </div>
                </summary>
                <div className="px-6 pb-5 text-slate-400 leading-relaxed text-sm border-t border-slate-50 pt-4">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-slate-950">
        <div className="max-w-xl mx-auto px-5 text-center">
          <h2 className="text-3xl font-extrabold text-white tracking-tight mb-4">
            Start your free trial today
          </h2>
          <p className="text-white/40 mb-8">7 days free, then ₦3,000/month. No contracts. No hidden fees.</p>
          <Link href="/register"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-amber-400 text-slate-950 font-bold text-base hover:bg-amber-300 transition-colors no-underline">
            Create your free account
            <ChevronRight size={18} />
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
