import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Menu, X, Wheat } from "lucide-react";

export default function LandingNav() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "/", label: "Home" },
    { href: "/features", label: "Features" },
    { href: "/pricing", label: "Pricing" },
  ];

  const isHero = location === "/" || location === "/features" || location === "/pricing";

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
      scrolled
        ? "bg-slate-950/95 backdrop-blur-sm border-b border-white/5"
        : isHero
          ? "bg-transparent"
          : "bg-slate-950 border-b border-white/5"
    }`}>
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 cursor-pointer no-underline">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
            <Wheat size={16} className="text-white" />
          </div>
          <span className="font-bold text-white text-base tracking-tight">
            Ara Bakery <span className="text-amber-400">Cloud</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {links.map(l => (
            <Link key={l.href} href={l.href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors no-underline ${
                location === l.href
                  ? "text-white bg-white/10"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}>
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/login"
            className="text-sm font-medium text-white/60 hover:text-white transition-colors px-3 py-2 no-underline">
            Sign in
          </Link>
          <Link href="/register"
            className="text-sm font-semibold px-5 py-2.5 rounded-lg text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors no-underline">
            Get Started Free
          </Link>
        </div>

        <button className="md:hidden p-2 text-white/60 hover:text-white rounded-lg" onClick={() => setOpen(!open)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-slate-950 border-t border-white/5 px-5 py-4 space-y-1">
          {links.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
              className={`block px-4 py-3 rounded-lg text-sm font-medium no-underline ${
                location === l.href ? "text-white bg-white/10" : "text-white/60 hover:text-white hover:bg-white/5"
              }`}>
              {l.label}
            </Link>
          ))}
          <div className="pt-3 flex flex-col gap-2 border-t border-white/5 mt-2">
            <Link href="/login"
              className="block text-center px-4 py-3 rounded-lg text-sm font-medium text-white/60 border border-white/10 no-underline hover:bg-white/5">
              Sign in
            </Link>
            <Link href="/register"
              className="block text-center px-4 py-3 rounded-lg text-sm font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 no-underline">
              Get Started Free
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
