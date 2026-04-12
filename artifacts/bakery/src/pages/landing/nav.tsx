import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export default function LandingNav() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/", label: "Home" },
    { href: "/features", label: "Features" },
    { href: "/pricing", label: "Pricing" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-amber-100/80 shadow-sm">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 cursor-pointer no-underline">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg" style={{background:"linear-gradient(135deg,#f59e0b,#d97706)"}}>
            🍞
          </div>
          <span className="font-bold text-slate-800 text-lg" style={{fontFamily:"'Playfair Display',serif"}}>
            Ara Bakery <span className="text-amber-600">Cloud</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {links.map(l => (
            <Link key={l.href} href={l.href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors no-underline ${location === l.href ? "text-amber-600 bg-amber-50" : "text-slate-600 hover:text-amber-600 hover:bg-amber-50/60"}`}>
              {l.label}
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-amber-600 transition-colors px-3 py-2 no-underline">
            Sign in
          </Link>
          <Link href="/register"
            className="text-sm font-semibold px-5 py-2.5 rounded-xl text-white transition-all hover:opacity-90 shadow-md hover:shadow-lg no-underline"
            style={{background:"linear-gradient(135deg,#f59e0b,#d97706)"}}>
            Get Started Free
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden p-2 text-slate-500" onClick={() => setOpen(!open)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-white border-t border-amber-100 px-6 py-4 space-y-1">
          {links.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
              className={`block px-4 py-2.5 rounded-lg text-sm font-medium no-underline ${location === l.href ? "text-amber-600 bg-amber-50" : "text-slate-600"}`}>
              {l.label}
            </Link>
          ))}
          <div className="pt-2 flex flex-col gap-2">
            <Link href="/login" className="block text-center px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 no-underline">Sign in</Link>
            <Link href="/register" className="block text-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white no-underline" style={{background:"linear-gradient(135deg,#f59e0b,#d97706)"}}>Get Started Free</Link>
          </div>
        </div>
      )}
    </nav>
  );
}
