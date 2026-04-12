import { Link } from "wouter";
import LandingNav from "./nav";

/* ── Real Unsplash bakery photos ── */
const PHOTOS = [
  {
    src: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&h=600&fit=crop&q=80",
    alt: "Fresh artisan bread loaf",
    label: "Artisan Bread",
    span: "row-span-2",
  },
  {
    src: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&h=400&fit=crop&q=80",
    alt: "Flaky golden croissants",
    label: "Croissants",
    span: "",
  },
  {
    src: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&h=400&fit=crop&q=80",
    alt: "Rich chocolate cake",
    label: "Chocolate Cake",
    span: "",
  },
  {
    src: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=600&h=400&fit=crop&q=80",
    alt: "Glazed donuts",
    label: "Donuts",
    span: "",
  },
];

const FEATURES = [
  {
    src: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=500&h=340&fit=crop&q=80",
    alt: "Bakery production tracking",
    icon: "🏭",
    title: "Production Tracking",
    desc: "Log daily bakes, monitor batch yields, and eliminate waste with real-time production dashboards.",
  },
  {
    src: "https://images.unsplash.com/photo-1454944338482-a69bb95894af?w=500&h=340&fit=crop&q=80",
    alt: "Bakery inventory management",
    icon: "📦",
    title: "Inventory Control",
    desc: "Track every ingredient — flour, butter, eggs — with automatic stock deductions and low-stock alerts.",
  },
  {
    src: "https://images.unsplash.com/photo-1556742208-999815fca738?w=500&h=340&fit=crop&q=80",
    alt: "Sales and receipts",
    icon: "💳",
    title: "Sales & Receipts",
    desc: "Record sales, issue branded receipts, and track daily revenue — all from your phone or tablet.",
  },
  {
    src: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500&h=340&fit=crop&q=80",
    alt: "Business analytics",
    icon: "📊",
    title: "Smart Reports",
    desc: "Sales trends, profit margins, waste analysis — beautiful dashboards that reveal exactly how your bakery is performing.",
  },
];

const STEPS = [
  { num: "01", title: "Register your bakery", desc: "Create your account in 2 minutes. No credit card needed for your 7-day free trial." },
  { num: "02", title: "Add your products", desc: "Add breads, pastries, and other products with pricing and production recipes." },
  { num: "03", title: "Start from day one", desc: "Log production, record sales, and watch real-time insights fill your dashboard immediately." },
];

export default function LandingHome() {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <LandingNav />

      {/* ── Hero ── */}
      <section className="relative pt-16 min-h-screen flex items-center" style={{background:"linear-gradient(145deg,#fffbeb 0%,#fef3c7 40%,#fff7ed 100%)"}}>
        {/* Decorative blobs */}
        <div className="absolute top-24 right-0 w-80 h-80 rounded-full blur-3xl opacity-30 pointer-events-none" style={{background:"#f59e0b"}} />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none" style={{background:"#d97706",animation:"pulse 5s ease-in-out infinite 1s"}} />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 lg:py-0 w-full">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">

            {/* Left — text */}
            <div className="order-1 lg:order-1">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-6"
                style={{background:"#fef3c7",color:"#92400e",border:"1px solid #fde68a"}}>
                🎉 7-day free trial — no credit card required
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-tight mb-6"
                style={{fontFamily:"'Playfair Display',serif"}}>
                Run your bakery<br />
                <span style={{background:"linear-gradient(135deg,#f59e0b,#d97706)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                  smarter, faster.
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-slate-600 leading-relaxed mb-8 max-w-lg">
                Ara Bakery Cloud gives bakery owners a complete management platform — production, inventory, sales and reports — built specifically for Nigerian bakeries.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
                <Link href="/register"
                  className="flex items-center justify-center gap-2 px-7 py-4 rounded-xl text-white font-semibold text-lg shadow-xl hover:opacity-90 active:scale-95 transition-all touch-manipulation"
                  style={{background:"linear-gradient(135deg,#f59e0b,#d97706)"}}>
                  Start Free Trial →
                </Link>
                <Link href="/features"
                  className="flex items-center justify-center gap-2 px-7 py-4 rounded-xl text-slate-700 font-semibold text-lg border-2 border-amber-200 hover:border-amber-400 hover:bg-amber-50 active:scale-95 transition-all touch-manipulation">
                  See Features
                </Link>
              </div>

              <p className="text-sm text-slate-400">✓ No setup fees &nbsp;·&nbsp; ✓ ₦3,000/month after trial &nbsp;·&nbsp; ✓ Works offline</p>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 mt-8">
                {[
                  { value: "500+", label: "Bakeries" },
                  { value: "₦2M+", label: "Sales tracked/day" },
                  { value: "99.9%", label: "Uptime" },
                ].map(s => (
                  <div key={s.label} className="text-center p-3 rounded-2xl bg-white/70 border border-amber-100 shadow-sm">
                    <p className="text-xl sm:text-2xl font-extrabold text-amber-600" style={{fontFamily:"'Playfair Display',serif"}}>{s.value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — real photo grid */}
            <div className="order-2 lg:order-2 relative">
              <div className="grid grid-cols-2 gap-3 sm:gap-4" style={{gridTemplateRows:"auto auto auto"}}>
                {/* Main large photo */}
                <div className="row-span-2 rounded-3xl overflow-hidden shadow-2xl border-4 border-white" style={{minHeight:260}}>
                  <img
                    src={PHOTOS[0].src}
                    alt={PHOTOS[0].alt}
                    className="w-full h-full object-cover"
                    style={{minHeight:260}}
                    loading="eager"
                  />
                </div>
                {/* 3 smaller photos */}
                {PHOTOS.slice(1).map(p => (
                  <div key={p.label} className="rounded-2xl overflow-hidden shadow-xl border-4 border-white aspect-square">
                    <img src={p.src} alt={p.alt} className="w-full h-full object-cover" loading="eager" />
                  </div>
                ))}
              </div>

              {/* Floating badge over photo grid */}
              <div className="absolute -bottom-4 -left-4 sm:bottom-4 sm:left-4 bg-white rounded-2xl shadow-2xl px-4 py-3 border border-amber-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{background:"linear-gradient(135deg,#f59e0b,#d97706)"}}>
                  📱
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm leading-tight">Works on any device</p>
                  <p className="text-xs text-slate-500">Phone · Tablet · Desktop</p>
                </div>
              </div>

              <div className="absolute -top-4 -right-4 sm:top-4 sm:right-4 bg-white rounded-2xl shadow-2xl px-4 py-3 border border-green-100 flex items-center gap-2">
                <span className="text-green-500 text-lg">✓</span>
                <div>
                  <p className="font-bold text-slate-800 text-sm leading-tight">Works Offline</p>
                  <p className="text-xs text-slate-500">No internet? No problem</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Wave */}
        <div className="absolute bottom-0 left-0 right-0 overflow-hidden leading-none" style={{height:40}}>
          <svg viewBox="0 0 1440 40" preserveAspectRatio="none" className="w-full h-full">
            <path d="M0,40 C360,0 1080,0 1440,40 L1440,40 L0,40 Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* ── Trust strip ── */}
      <section className="py-8 bg-white border-b border-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <p className="text-center text-slate-400 text-sm font-medium mb-6 uppercase tracking-wider">Trusted by bakeries across Nigeria</p>
          <div className="flex flex-wrap justify-center items-center gap-6 sm:gap-10">
            {["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Kano", "Enugu"].map(city => (
              <div key={city} className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                {city}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features with photos ── */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <p className="text-amber-600 text-sm font-bold uppercase tracking-widest mb-2">Everything you need</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900" style={{fontFamily:"'Playfair Display',serif"}}>
              Built for bakeries, by bakers
            </h2>
            <p className="text-slate-500 mt-4 max-w-xl mx-auto text-lg">
              Every feature designed around the real workflows of a Nigerian bakery — from the oven to the counter.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className="group rounded-2xl overflow-hidden border border-slate-100 hover:shadow-xl transition-all hover:-translate-y-1 bg-white">
                <div className="relative overflow-hidden" style={{height:180}}>
                  <img src={f.src} alt={f.alt}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <div className="absolute bottom-3 left-3 w-9 h-9 rounded-xl bg-white/90 flex items-center justify-center text-xl shadow-md">
                    {f.icon}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-slate-800 mb-1.5">{f.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link href="/features"
              className="inline-flex items-center gap-1.5 text-amber-600 font-semibold hover:text-amber-700 transition-colors touch-manipulation">
              See all features →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Full-bleed bakery photo with overlay ── */}
      <section className="relative overflow-hidden" style={{height:"clamp(260px, 40vw, 480px)"}}>
        <img
          src="https://images.unsplash.com/photo-1517433670267-08bbd4be890f?w=1400&h=500&fit=crop&q=80"
          alt="Inside a professional bakery"
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 flex items-center justify-center"
          style={{background:"linear-gradient(135deg,rgba(245,158,11,0.85),rgba(217,119,6,0.75))"}}>
          <div className="text-center px-4 sm:px-6 max-w-2xl">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-4 leading-tight" style={{fontFamily:"'Playfair Display',serif"}}>
              From the oven to the register — all in one app
            </h2>
            <p className="text-white/90 text-base sm:text-lg mb-8">
              Designed specifically for bakery owners who want to spend less time on admin and more time baking.
            </p>
            <Link href="/register"
              className="inline-flex items-center gap-2 px-7 py-4 rounded-xl bg-white font-semibold text-lg shadow-xl hover:bg-amber-50 active:scale-95 transition-all touch-manipulation"
              style={{color:"#d97706"}}>
              Get Started Free →
            </Link>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-16 sm:py-24" style={{background:"linear-gradient(160deg,#fffbeb 0%,#fff7ed 100%)"}}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-amber-600 text-sm font-bold uppercase tracking-widest mb-2">Simple setup</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900" style={{fontFamily:"'Playfair Display',serif"}}>
              Up and running in minutes
            </h2>
          </div>
          <div className="space-y-6">
            {STEPS.map((s, i) => (
              <div key={s.num} className="flex items-start gap-5 bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-amber-100">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center font-extrabold shadow-md flex-shrink-0"
                  style={{background:"linear-gradient(135deg,#f59e0b,#d97706)",color:"white",fontFamily:"'Playfair Display',serif",fontSize:"1.2rem"}}>
                  {s.num}
                </div>
                <div className="flex-1 min-w-0 pt-1 sm:pt-2">
                  <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-1">{s.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Mobile app promo ── */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-amber-600 text-sm font-bold uppercase tracking-widest mb-3">Available everywhere</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-5 leading-tight" style={{fontFamily:"'Playfair Display',serif"}}>
                Manage your bakery<br />from anywhere
              </h2>
              <p className="text-slate-500 text-lg leading-relaxed mb-8">
                Ara Bakery Cloud is a Progressive Web App — install it directly from your browser on Android or iPhone. No app store needed, but it works just like a native app.
              </p>
              <div className="space-y-4">
                {[
                  { icon: "📱", label: "Android & iOS phones", desc: "Install from your browser — works like a native app" },
                  { icon: "📟", label: "Tablets & iPads", desc: "Optimised layout for tablet screens" },
                  { icon: "🖥️", label: "Desktop & laptop", desc: "Full feature set on any browser" },
                  { icon: "📶", label: "Works offline", desc: "Log sales and production even without internet" },
                ].map(item => (
                  <div key={item.label} className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 mt-0.5" style={{background:"#fef3c7"}}>
                      {item.icon}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{item.label}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative flex justify-center">
              <div className="relative">
                <img
                  src="https://images.unsplash.com/photo-1556742208-999815fca738?w=500&h=700&fit=crop&q=80"
                  alt="Using bakery app on mobile"
                  className="rounded-3xl shadow-2xl object-cover border-4 border-white"
                  style={{width:"100%",maxWidth:340,height:"auto",aspectRatio:"340/480"}}
                  loading="lazy"
                />
                <div className="absolute -top-4 -right-4 bg-white rounded-2xl shadow-xl px-4 py-3 border border-amber-100">
                  <div className="flex items-center gap-2">
                    <span className="text-green-500 text-xl">●</span>
                    <span className="font-bold text-slate-700 text-sm">Live updates</span>
                  </div>
                </div>
                <div className="absolute -bottom-4 -left-4 bg-white rounded-2xl shadow-xl px-4 py-3 border border-amber-100">
                  <p className="text-xs text-slate-500">Today's revenue</p>
                  <p className="font-extrabold text-xl text-amber-600">₦48,200</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 sm:py-20 text-center" style={{background:"linear-gradient(160deg,#fffbeb 0%,#fef3c7 100%)"}}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-amber-200">
            <img
              src="https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=800&h=400&fit=crop&q=80"
              alt="Beautiful bakery display"
              className="w-full object-cover absolute inset-0 opacity-20"
              style={{height:"100%"}}
              loading="lazy"
            />
            <div className="relative p-10 sm:p-14">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4" style={{fontFamily:"'Playfair Display',serif"}}>
                Ready to grow your bakery?
              </h2>
              <p className="text-slate-600 mb-8 leading-relaxed text-lg">
                Join hundreds of bakery owners using Ara Bakery Cloud to manage production, track sales, and grow their business.
              </p>
              <Link href="/register"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-semibold text-lg shadow-xl hover:opacity-90 active:scale-95 transition-all touch-manipulation"
                style={{background:"linear-gradient(135deg,#f59e0b,#d97706)"}}>
                Start your free 7-day trial →
              </Link>
              <p className="mt-4 text-sm text-slate-400">No credit card required · ₦3,000/month after trial</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-10 border-t border-slate-100 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{background:"linear-gradient(135deg,#f59e0b,#d97706)"}}>🍞</div>
            <span className="font-bold text-slate-700 text-lg" style={{fontFamily:"'Playfair Display',serif"}}>Ara Bakery Cloud</span>
          </div>
          <div className="flex items-center gap-5 text-sm text-slate-400">
            <Link href="/features" className="hover:text-amber-600 transition-colors">Features</Link>
            <Link href="/pricing" className="hover:text-amber-600 transition-colors">Pricing</Link>
            <Link href="/login" className="hover:text-amber-600 transition-colors">Sign in</Link>
          </div>
          <p className="text-sm text-slate-400">© {new Date().getFullYear()} Ara Bakery Cloud</p>
        </div>
      </footer>
    </div>
  );
}
