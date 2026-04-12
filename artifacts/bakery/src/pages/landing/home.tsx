import { Link } from "wouter";
import LandingNav from "./nav";

const FEATURES = [
  { icon: "🏭", title: "Production Tracking", desc: "Log daily bakes, monitor batch yields, and reduce waste with real-time production dashboards." },
  { icon: "📦", title: "Inventory Control", desc: "Track flour, butter, eggs and every ingredient — get low-stock alerts before you run out." },
  { icon: "💳", title: "Sales & Receipts", desc: "Issue branded receipts, record walk-in and wholesale sales, and track daily revenue instantly." },
  { icon: "📊", title: "Smart Reports", desc: "Sales trends, profit margins, waste analysis — all in one beautiful reporting dashboard." },
  { icon: "👥", title: "Team Management", desc: "Role-based access for your managers, bakers, and cashiers — everyone sees what they need." },
  { icon: "🏢", title: "Multi-Branch", desc: "Run multiple locations from a single account. Consolidate reports or view each branch separately." },
];

const PRODUCTS = [
  { emoji: "🍞", name: "Bread", color: "#fef3c7", delay: "0s", duration: "4s" },
  { emoji: "🥐", name: "Croissant", color: "#fde68a", delay: "0.6s", duration: "3.5s" },
  { emoji: "🎂", name: "Cake", color: "#fed7aa", delay: "1.2s", duration: "4.5s" },
  { emoji: "🧁", name: "Cupcake", color: "#fecaca", delay: "1.8s", duration: "3.8s" },
  { emoji: "🥧", name: "Pie", color: "#d1fae5", delay: "2.4s", duration: "4.2s" },
  { emoji: "🍩", name: "Donut", color: "#e0e7ff", delay: "3s", duration: "3.6s" },
];

const STEPS = [
  { num: "01", title: "Register your bakery", desc: "Create your account in under 2 minutes. No credit card needed for your 7-day free trial." },
  { num: "02", title: "Set up your products", desc: "Add your breads, pastries and other products with pricing and production recipes." },
  { num: "03", title: "Start tracking", desc: "Log production, record sales, and watch your bakery insights come alive from day one." },
];

export default function LandingHome() {
  return (
    <div className="min-h-screen bg-white">
      <LandingNav />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-24 pb-20" style={{background:"linear-gradient(160deg,#fffbeb 0%,#fef3c7 45%,#fff7ed 100%)"}}>
        {/* Animated background blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 right-[8%] w-64 h-64 rounded-full opacity-20 blur-3xl animate-pulse" style={{background:"#f59e0b"}} />
          <div className="absolute bottom-10 left-[5%] w-48 h-48 rounded-full opacity-15 blur-3xl" style={{background:"#d97706",animation:"pulse 6s ease-in-out infinite 2s"}} />
        </div>

        <div className="max-w-6xl mx-auto px-6 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left */}
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-6"
                style={{background:"#fef3c7",color:"#92400e"}}>
                🎉 7-day free trial — no credit card
              </div>
              <h1 className="text-5xl lg:text-6xl font-extrabold text-slate-900 leading-tight mb-6"
                style={{fontFamily:"'Playfair Display',serif"}}>
                Run your bakery<br />
                <span style={{background:"linear-gradient(135deg,#f59e0b,#d97706)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                  smarter, faster.
                </span>
              </h1>
              <p className="text-xl text-slate-600 leading-relaxed mb-8 max-w-lg">
                Ara Bakery Cloud gives bakery owners a complete management platform — from production and inventory to sales and reports — built specifically for Nigerian bakeries.
              </p>
              <div className="flex items-center gap-4 flex-wrap">
                <Link href="/register" className="inline-flex items-center gap-2 px-7 py-4 rounded-xl text-white font-semibold text-lg shadow-xl hover:opacity-90 transition-all hover:shadow-2xl"
                    style={{background:"linear-gradient(135deg,#f59e0b,#d97706)"}}>
                    Start Free Trial →
                  </Link>
                <Link href="/features" className="inline-flex items-center gap-2 px-7 py-4 rounded-xl text-slate-700 font-semibold text-lg border-2 border-amber-200 hover:border-amber-400 hover:bg-amber-50 transition-all">
                    See Features
                  </Link>
              </div>
              <p className="mt-5 text-sm text-slate-400">✓ No setup fees &nbsp; ✓ ₦3,000/month after trial &nbsp; ✓ Cancel anytime</p>
            </div>

            {/* Right — animated product grid */}
            <div className="relative flex items-center justify-center">
              <div className="relative w-96 h-96">
                {/* Central glow */}
                <div className="absolute inset-12 rounded-full blur-2xl opacity-40" style={{background:"radial-gradient(circle,#fbbf24,transparent)"}} />
                {/* Orbiting bakery items */}
                {PRODUCTS.map((p, i) => {
                  const angle = (i / PRODUCTS.length) * 360;
                  const rad = (angle * Math.PI) / 180;
                  const r = 145;
                  const cx = 192 + r * Math.cos(rad);
                  const cy = 192 + r * Math.sin(rad);
                  return (
                    <div key={p.name} className="absolute flex flex-col items-center"
                      style={{
                        left: cx - 32, top: cy - 32,
                        animation: `float ${p.duration} ease-in-out infinite`,
                        animationDelay: p.delay,
                      }}>
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-lg border-2 border-white/80"
                        style={{background: p.color}}>
                        {p.emoji}
                      </div>
                      <span className="text-xs font-medium text-slate-500 mt-1">{p.name}</span>
                    </div>
                  );
                })}
                {/* Center badge */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-3xl flex flex-col items-center justify-center shadow-2xl border-4 border-white"
                    style={{background:"linear-gradient(135deg,#f59e0b,#d97706)"}}>
                    <span className="text-4xl">🍞</span>
                    <span className="text-white text-xs font-bold mt-1">ARA</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stat pills */}
          <div className="grid grid-cols-3 gap-4 mt-16 max-w-xl">
            {[
              { value: "500+", label: "Bakeries managed" },
              { value: "₦2M+", label: "Daily sales tracked" },
              { value: "99.9%", label: "Uptime SLA" },
            ].map(s => (
              <div key={s.label} className="text-center p-4 rounded-2xl bg-white/70 border border-amber-100 shadow-sm backdrop-blur-sm">
                <p className="text-2xl font-extrabold text-amber-600" style={{fontFamily:"'Playfair Display',serif"}}>{s.value}</p>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0 overflow-hidden leading-none" style={{height:48}}>
          <svg viewBox="0 0 1440 48" preserveAspectRatio="none" className="w-full h-full">
            <path d="M0,48 C360,0 1080,0 1440,48 L1440,48 L0,48 Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-amber-600 text-sm font-bold uppercase tracking-widest mb-2">Everything you need</p>
            <h2 className="text-4xl font-extrabold text-slate-900" style={{fontFamily:"'Playfair Display',serif"}}>
              Built for bakeries, by bakers
            </h2>
            <p className="text-slate-500 mt-4 max-w-xl mx-auto text-lg">
              Every feature designed around the real workflows of a Nigerian bakery — from the oven to the counter.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="group p-6 rounded-2xl border border-slate-100 hover:border-amber-200 hover:shadow-xl transition-all hover:-translate-y-1 bg-white">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform"
                  style={{background:"#fef3c7"}}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-slate-800 text-lg mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/features" className="inline-flex items-center gap-1.5 text-amber-600 font-semibold hover:text-amber-700 transition-colors">
                See all features → 
              </Link>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-24" style={{background:"linear-gradient(160deg,#fffbeb 0%,#fff7ed 100%)"}}>
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-amber-600 text-sm font-bold uppercase tracking-widest mb-2">Simple setup</p>
            <h2 className="text-4xl font-extrabold text-slate-900" style={{fontFamily:"'Playfair Display',serif"}}>
              Up and running in minutes
            </h2>
          </div>
          <div className="space-y-8">
            {STEPS.map((s, i) => (
              <div key={s.num} className="flex items-start gap-6 group">
                <div className="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-extrabold shadow-md border-2 border-amber-300 group-hover:scale-105 transition-transform"
                  style={{background:"linear-gradient(135deg,#f59e0b,#d97706)",color:"white",fontFamily:"'Playfair Display',serif"}}>
                  {s.num}
                </div>
                <div className="flex-1 pt-2">
                  <h3 className="text-lg font-bold text-slate-800 mb-1">{s.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{s.desc}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="absolute left-7 mt-14 w-0.5 h-8 bg-amber-200 hidden md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 text-center bg-white">
        <div className="max-w-2xl mx-auto px-6">
          <div className="p-10 rounded-3xl shadow-2xl border border-amber-100"
            style={{background:"linear-gradient(135deg,#fef3c7 0%,#fff7ed 100%)"}}>
            <div className="text-5xl mb-5">🍰</div>
            <h2 className="text-3xl font-extrabold text-slate-900 mb-4" style={{fontFamily:"'Playfair Display',serif"}}>
              Ready to grow your bakery?
            </h2>
            <p className="text-slate-600 mb-8 leading-relaxed">
              Join hundreds of bakery owners who use Ara Bakery Cloud to manage production, track sales, and grow their business.
            </p>
            <Link href="/register" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-semibold text-lg shadow-xl hover:opacity-90 transition-all hover:shadow-2xl"
                style={{background:"linear-gradient(135deg,#f59e0b,#d97706)"}}>
                Start your free 7-day trial →
              </Link>
            <p className="mt-4 text-sm text-slate-400">No credit card required. ₦3,000/month after trial.</p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-10 border-t border-slate-100 bg-white">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🍞</span>
            <span className="font-bold text-slate-700" style={{fontFamily:"'Playfair Display',serif"}}>Ara Bakery Cloud</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-400">
            <Link href="/features" className="hover:text-amber-600 transition-colors">Features</Link>
            <Link href="/pricing" className="hover:text-amber-600 transition-colors">Pricing</Link>
            <Link href="/login" className="hover:text-amber-600 transition-colors">Sign in</Link>
          </div>
          <p className="text-sm text-slate-400">© {new Date().getFullYear()} Ara Bakery Cloud. All rights reserved.</p>
        </div>
      </footer>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-12px) rotate(3deg); }
          66% { transform: translateY(-6px) rotate(-2deg); }
        }
      `}</style>
    </div>
  );
}
