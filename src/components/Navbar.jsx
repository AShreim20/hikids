import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, BarChart3, Heart, Settings as SettingsIcon, Search, MapPin } from 'lucide-react';
import SearchBar from '@/components/SearchBar';
import SearchHover from '@/components/SearchHover';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import SettingsDialog from '@/components/SettingsDialog';
import Logo from '@/components/Logo';
import LanguageToggle from '@/components/LanguageToggle';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';



export default function Navbar() {
  const { count } = useCart();
  const { count: wishCount } = useWishlist();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();

  const links = [
    { label: t('nav.explore'), to: '/#explore' },
    { label: t('nav.worlds'), to: '/#categories' },
    { label: t('nav.about'), to: '/about' },
    { label: t('nav.faq'), to: '/faq' },
  ];
  if (user?.role === 'admin') {
    links.push({ label: t('nav.track'), to: '/track-order' });
    links.push({ label: t('nav.admin'), to: '/admin' });
    links.push({ label: t('staff.nav'), to: '/staff' });
    links.push({ label: t('delivery.title'), to: '/delivery' });
  }

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/60 safe-top">
      <nav className="max-w-7xl mx-auto px-5 sm:px-8 h-16 md:h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center group">
          <Logo className="h-10 md:h-12 w-auto rounded-xl group-hover:scale-95 transition-transform" />
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
            <BarChart3 className="w-4 h-4" /> {t('nav.insights')}
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <SearchHover />
          <button
            onClick={() => setSearchOpen((v) => !v)}
            className="md:hidden grid place-items-center w-11 h-11 rounded-2xl bg-mist text-foreground hover:bg-accent hover:text-white transition-colors"
            aria-label={t('nav.search')}
          >
            <Search className="w-5 h-5" />
          </button>
          <LanguageToggle />
          {user && (
            <button
              onClick={() => navigate('/addresses')}
              className="hidden md:grid squish place-items-center w-11 h-11 rounded-2xl bg-mist text-foreground hover:bg-accent hover:text-white transition-colors"
              aria-label={t('address.title')}
            >
              <MapPin className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => setSettingsOpen(true)}
            className="grid place-items-center w-11 h-11 rounded-2xl bg-mist text-foreground hover:bg-accent hover:text-white transition-colors"
            aria-label={t('nav.settings')}
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => navigate('/wishlist')}
            className="hidden md:grid relative squish place-items-center w-11 h-11 rounded-2xl bg-mist text-foreground hover:bg-accent hover:text-white transition-colors"
            aria-label="Wishlist"
          >
            <Heart className="w-5 h-5" />
            {wishCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 grid place-items-center rounded-full bg-accent text-white text-[11px] font-bold">
                {wishCount}
              </span>
            )}
          </button>
          <button
            onClick={() => navigate('/cart')}
            className="hidden md:grid relative squish place-items-center w-11 h-11 rounded-2xl bg-mist text-foreground hover:bg-accent hover:text-white transition-colors"
            aria-label="Cart"
          >
            <ShoppingBag className="w-5 h-5" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 grid place-items-center rounded-full bg-cosmic text-white text-[11px] font-bold">
                {count}
              </span>
            )}
          </button>
        </div>
      </nav>
      {searchOpen && (
        <div className="md:hidden border-t border-border/60 px-5 sm:px-8 py-3 max-w-7xl mx-auto">
          <SearchBar autoFocus className="w-full" onSubmitted={() => setSearchOpen(false)} />
        </div>
      )}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </header>
  );
}