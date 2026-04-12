import { Link } from "wouter";
import LandingNav from "./nav";
import {
  CheckCircle, X, Minus, ChevronRight, Wheat,
  TrendingDown, TrendingUp, Clock, Star,
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
  { q: "Is the 7-day trial really free?", a: "Yes! You get full access to every feature during your trial — no credit card required. You only pay after the 7 days if you decide to continue." },
  { q: "What happens after my trial ends?", a: "Your account will enter a grace period. You can renew at ₦3,000/month to continue accessing your data. Nothing is deleted." },
  { q: "Can I manage multiple bakery branches?", a: "Absolutely. One account supports multiple branches. You can view consolidated reports or drill down into each branch separately." },
  { q: "How do I pay the subscription?", a: "We support payment via Paystack and Flutterwave — bank transfer, card, USSD, and mobile money. Your bakery manager can renew directly from the dashboard." },
  { q: "Can I cancel at any time?", a: "Yes. There are no long-term contracts. Cancel whenever you want and your access continues until the end of your current billing period." },
  { q: "Is my bakery data safe?", a: "All your data is stored securely in the cloud, encrypted at rest and in transit. We perform daily backups and have 99.9% uptime." },
];

const COMPARISONS = [
  { feature: "Production tracking",           cloud: true,  spreadsheet: "Manual" },
  { feature: "Automatic inventory deduction", cloud: true,  spreadsheet: false },
  { feature: "Real-time sales dashboard",     cloud: true,  spreadsheet: false },
  { feature: "Branded receipts",             cloud: true,  spreadsheet: false },
  { feature: "Staff role management",        cloud: true,  spreadsheet: false },
  { feature: "Profit & waste reports",       cloud: true,  spreadsheet: "Manual" },
  { feature: "Multi-branch support",         cloud: true,  spreadsheet: false },
  { feature: "Works on mobile",              cloud: true,  spreadsheet: "Partial" },
];

const BENEFITS = [
  { icon: TrendingDown, title: "Stop the waste losses",  desc: "Average bakery wastes ₦45,000/month. Real-time tracking cuts that by 40%." },
  { icon: TrendingUp,   title: "Know your best sellers", desc: "Find out which products make the most profit — and double down." },
  { icon: Clock,        title: "Save 3 hours daily",     desc: "No more manual spreadsheets. Managers spend time running the bakery, not counting." },
  { icon: Star,         title: "Look professional",       desc: "Branded receipts and clean reporting make your bakery stand out to wholesale clients." },
];

export default function LandingPricing() {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <LandingNav />

      {/* Hero */}
      <section className="pt-24 pb-14 bg-slate-50 border-b border-slate-100">
        <div className="max-w-2xl mx-auto px-5 text-center pt-8">
          <p className="text-amber-600 text-sm font-bold uppercase tracking-widest mb-3">Simple, honest pricing</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 mb-5 leading-tight" style={{ fontFamily: "'Playfair Display',serif" }}>
            One plan.<br />
            <span className="text-amber-600">Everything included.</span>
          </h1>
          <p className="text-lg text-slate-500 leading-relaxed">
            No tiered features, no hidden fees. Every bakery gets the full platform at one straightforward price.
          </p>
        </div>
      </section>

      {/* Pricing card */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-5">
          <div className="grid md:grid-cols-2 gap-6 items-stretch">

            {/* Starter Plan */}
            <div className="relative rounded-2xl overflow-hidden shadow-xl border-2 border-amber-500 flex flex-col">
              <div className="absolute top-5 right-5">
                <span className="px-3 py-1 rounded-full text-xs font-bold text-white bg-amber-600">
                  MOST POPULAR
                </span>
              </div>
              {/* Header */}
              <div className="p-7 pb-5 bg-amber-50 border-b border-amber-100">
                <div className="w-11 h-11 rounded-xl bg-amber-600 flex items-center justify-center mb-4">
                  <Wheat size={22} className="text-white" />
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 mb-1" style={{ fontFamily: "'Playfair Display',serif" }}>Starter Plan</h3>
                <p className="text-slate-500 text-sm mb-5">For single or multi-branch bakeries ready to go digital.</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold text-slate-900" style={{ fontFamily: "'Playfair Display',serif" }}>₦3,000</span>
                  <span className="text-slate-400 text-lg">/ month</span>
                </div>
                <p className="text-sm text-amber-600 font-semibold mt-2">Includes 7-day free trial</p>
              </div>
              {/* Features */}
              <div className="p-7 flex-1 bg-white">
                <ul className="space-y-3 mb-7">
                  {PLAN_FEATURES.map(f => (
                    <li key={f} className="flex items-center gap-3 text-sm text-slate-700">
                      <CheckCircle size={16} className="text-amber-600 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register"
                  className="block text-center w-full py-4 rounded-xl text-white font-semibold text-base bg-amber-600 hover:bg-amber-700 transition-colors no-underline">
                  Start Free 7-Day Trial
                </Link>
                <p className="text-center text-xs text-slate-400 mt-3">No credit card required</p>
              </div>
            </div>

            {/* Why it's worth it */}
            <div className="rounded-2xl border border-slate-100 p-7 bg-slate-50 flex flex-col">
              <h3 className="text-xl font-extrabold text-slate-900 mb-2" style={{ fontFamily: "'Playfair Display',serif" }}>
                Why ₦3,000 is worth it
              </h3>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                Most Nigerian bakeries lose 15–30% of potential revenue due to poor tracking. Ara Bakery Cloud pays for itself in the first week.
              </p>
              <div className="space-y-3 flex-1">
                {BENEFITS.map(b => {
                  const Icon = b.icon;
                  return (
                    <div key={b.title} className="flex gap-3 p-4 rounded-xl bg-white border border-slate-100">
                      <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                        <Icon size={18} className="text-amber-600" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{b.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{b.desc}</p>
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
      <section className="py-16 bg-slate-50 border-y border-slate-100">
        <div className="max-w-3xl mx-auto px-5">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold text-slate-900" style={{ fontFamily: "'Playfair Display',serif" }}>
              Ara Cloud vs. Spreadsheets
            </h2>
            <p className="text-slate-500 mt-3">See why bakeries are switching from Excel and WhatsApp groups.</p>
          </div>
          <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-amber-600">
                  <th className="text-left px-6 py-4 text-white font-semibold">Feature</th>
                  <th className="text-center px-6 py-4 text-white font-semibold">Ara Cloud</th>
                  <th className="text-center px-6 py-4 text-white/80 font-semibold">Spreadsheet</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISONS.map((c, i) => (
                  <tr key={c.feature} className={`border-b border-slate-50 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>
                    <td className="px-6 py-3.5 text-slate-700 font-medium">{c.feature}</td>
                    <td className="px-6 py-3.5 text-center">
                      <CheckCircle size={16} className="text-green-500 mx-auto" />
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {c.spreadsheet === true
                        ? <CheckCircle size={16} className="text-green-500 mx-auto" />
                        : c.spreadsheet === false
                          ? <X size={16} className="text-red-400 mx-auto" />
                          : <span className="text-amber-600 text-xs font-semibold">{c.spreadsheet}</span>}
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
            <h2 className="text-3xl font-extrabold text-slate-900" style={{ fontFamily: "'Playfair Display',serif" }}>
              Frequently asked questions
            </h2>
          </div>
          <div className="space-y-3">
            {FAQS.map(faq => (
              <details key={faq.q} className="group rounded-2xl border border-slate-100 overflow-hidden">
                <summary className="flex items-center justify-between px-6 py-4 cursor-pointer font-semibold text-slate-800 hover:bg-amber-50 transition-colors list-none">
                  {faq.q}
                  <Minus size={16} className="text-amber-500 group-open:hidden flex-shrink-0 ml-4" />
                  <ChevronRight size={16} className="text-amber-500 hidden group-open:block rotate-90 flex-shrink-0 ml-4" />
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
      <section className="py-20 bg-amber-600">
        <div className="max-w-xl mx-auto px-5 text-center">
          <h2 className="text-3xl font-extrabold text-white mb-4" style={{ fontFamily: "'Playfair Display',serif" }}>
            Start your free trial today
          </h2>
          <p className="text-amber-100 mb-8">7 days free, then ₦3,000/month. No contracts. No hidden fees.</p>
          <Link href="/register"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-amber-700 font-bold text-lg hover:bg-amber-50 transition-colors no-underline">
            Create your free account
            <ChevronRight size={18} />
          </Link>
        </div>
      </section>

      <footer className="py-10 border-t border-slate-100 bg-white">
        <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-600 flex items-center justify-center">
              <Wheat size={14} className="text-white" />
            </div>
            <span className="font-bold text-slate-700" style={{ fontFamily: "'Playfair Display',serif" }}>Ara Bakery Cloud</span>
          </div>
          <p className="text-sm text-slate-400">&copy; {new Date().getFullYear()} Ara Bakery Cloud. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
