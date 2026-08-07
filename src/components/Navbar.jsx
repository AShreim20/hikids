import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Menu, X, BarChart3 } from 'lucide-react';
import { useCart } from '@/context/CartContext';

const links = [
  { label: 'Explore', to: '/#explore' },
  { label: 'Worlds of Play', to: '/#categories' },
  { label: 'Our Promise', to: '/#promise' },
  { label: 'About', to: '/#about' },
];

export default function Navbar() {
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/60">
      <nav className="max-w-7xl mx-auto px-5 sm:px-8 h-16 md:h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="grid place-items-center w-10 h-10 rounded-2xl bg-cosmic text-white font-heading font-extrabold text-lg shadow-lg shadow-cosmic/30 group-hover:scale-95 transition-transform">
            H
          </span>
          <span className="font-heading font-extrabold text-xl md:text-2xl tracking-tight">
            HiKids
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-9">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.to}
              className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
            >
              {l.label}
            </a>
          ))}
          <Link to="/analytics" className="text-sm font-medium text-cosmic hover:text-primary transition-colors flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4" /> Insights
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/cart')}
            className="relative squish grid place-items-center w-11 h-11 rounded-2xl bg-mist text-foreground hover:bg-accent hover:text-white transition-colors"
            aria-label="Cart"
          >
            <ShoppingBag className="w-5 h-5" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 grid place-items-center rounded-full bg-cosmic text-white text-[11px] font-bold">
                {count}
              </span>
            )}
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            className="md:hidden grid place-items-center w-11 h-11 rounded-2xl bg-mist"
            aria-label="Menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="md:hidden px-5 pb-6 border-t border-border/60 bg-background">
          <div className="flex flex-col gap-1 pt-4">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.to}
                onClick={() => setOpen(false)}
                className="px-4 py-3 rounded-2xl hover:bg-mist font-medium text-foreground/80"
              >
                {l.label}
              </a>
            ))}
            <Link
              to="/analytics"
              onClick={() => setOpen(false)}
              className="px-4 py-3 rounded-2xl hover:bg-mist font-medium text-cosmic flex items-center gap-2"
            >
              <BarChart3 className="w-4 h-4" /> Insights
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}