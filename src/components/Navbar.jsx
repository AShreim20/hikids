import React, { useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, BarChart3, Heart, Settings as SettingsIcon, Search, MapPin } from 'lucide-react';
import SearchBar from '@/components/SearchBar';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import SettingsDialog from '@/components/SettingsDialog';
import Logo from '@/components/Logo';
import LanguageToggle from '@/components/LanguageToggle';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import HeaderLoyaltyBalance from '@/components/HeaderLoyaltyBalance';
import HeaderWheelSpins from '@/components/HeaderWheelSpins';



export default function Navbar() {
  const { count } = useCart();
  const { count: wishCount } = useWishlist();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();

  // The header is fixed so it stays visible; this measured spacer reserves
  // the exact header height in the flow so every page's content starts below
  // the header — auto-matching the real height on mobile and desktop.
  const headerRef = useRef(null);
  const [headerH, setHeaderH] = useState(null);
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const measure = () => setHeaderH(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const links = [
  { label: t('nav.explore'), to: '/shop' },
  { label: t('nav.worlds'), to: '/#categories' }];


  return (
    <>
    <header ref={headerRef} className="fixed top-0 left-0 right-0 z-50 bg-[#5D3F85]/90 backdrop-blur-xl border-b border-accent/30 safe-top">
      {/* Section 1 — brand + search (the main visual band) */}
      <div className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 md:h-20 flex items-center gap-4">
          <Link to="/" className="flex items-center group shrink-0">
            <Logo className="h-14 md:h-16 w-auto group-hover:scale-95 transition-transform" />
          </Link>

          {/* Prominent search — desktop/tablet */}
          <div className="hidden md:block flex-1 max-w-xl mx-auto">
            <SearchBar className="w-full" />
          </div>

          {/* Search toggle — mobile */}
          <button
            onClick={() => setSearchOpen((v) => !v)}
            className="md:hidden ms-auto grid place-items-center w-11 h-11 rounded-2xl bg-white/15 text-white hover:bg-accent hover:text-white transition-colors"
            aria-label={t('nav.search')}>
            <Search className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Section 2 — navigation + account actions */}
      <div>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-12 md:h-14 flex items-center justify-between gap-3">
          <div className="hidden md:flex items-center gap-5 lg:gap-9">
            {links.map((l) =>
            <a
              key={l.label}
              href={l.to}
              className="text-sm font-medium text-white/85 hover:text-accent transition-colors mx-5">
              {l.label}
            </a>
            )}
            {user &&
            <Link to="/orders" className="text-sm font-medium text-white/85 hover:text-accent transition-colors">
              {t('orders.title')}
            </Link>
            }
            {user &&
            <Link to="/challenges" className="text-sm font-medium text-white/85 hover:text-accent transition-colors">
              {t('nav.challenges')}
            </Link>
            }
            <HeaderWheelSpins />
            {user &&
            <Link to="/wheel-rewards" className="text-sm font-medium text-white/85 hover:text-accent transition-colors">
              {t('nav.wheelRewards')}
            </Link>
            }
            {user?.role === 'admin' &&
            <Link to="/analytics" className="text-sm font-medium text-accent hover:text-accent/80 transition-colors flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4" /> {t('nav.insights')}
            </Link>
            }
          </div>

          <div className="flex items-center gap-1.5 lg:gap-2 ms-auto">
            <LanguageToggle />
            <HeaderLoyaltyBalance />
            {user &&
            <button
              onClick={() => navigate('/addresses')}
              className="hidden lg:grid squish place-items-center w-11 h-11 rounded-2xl bg-white/15 text-white hover:bg-accent hover:text-white transition-colors"
              aria-label={t('address.title')}>
              <MapPin className="w-5 h-5" />
            </button>
            }
            <button
              onClick={() => setSettingsOpen(true)}
              className="grid place-items-center w-11 h-11 rounded-2xl bg-white/15 text-white hover:bg-accent hover:text-white transition-colors"
              aria-label={t('nav.settings')}>
              <SettingsIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/wishlist')}
              className="hidden md:grid relative squish place-items-center w-11 h-11 rounded-2xl bg-white/15 text-white hover:bg-accent hover:text-white transition-colors"
              aria-label="Wishlist">
              <Heart className="w-5 h-5" />
              {wishCount > 0 &&
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 grid place-items-center rounded-full bg-accent text-white text-[11px] font-bold">
                {wishCount}
              </span>
              }
            </button>
            <button
              onClick={() => navigate('/cart')}
              className="hidden md:grid relative squish place-items-center w-11 h-11 rounded-2xl bg-white/15 text-white hover:bg-accent hover:text-white transition-colors"
              aria-label="Cart">
              <ShoppingBag className="w-5 h-5" />
              {count > 0 &&
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 grid place-items-center rounded-full bg-accent text-white text-[11px] font-bold">
                {count}
              </span>
              }
            </button>
            {!user &&
            <div className="hidden md:flex items-center gap-2 ms-1">
              <Link
              to="/login"
              className="h-11 px-4 rounded-2xl bg-white/15 text-white text-sm font-heading font-bold inline-flex items-center hover:bg-accent hover:text-white transition-colors">
                {t('nav.signIn')}
              </Link>
              <Link
              to="/register"
              className="h-11 px-4 rounded-2xl bg-accent text-white text-sm font-heading font-bold inline-flex items-center hover:bg-accent/90 transition-colors whitespace-nowrap">
                {t('nav.signUp')}
              </Link>
            </div>
            }
          </div>
        </div>
      </div>

      {searchOpen &&
      <div className="md:hidden border-t border-white/10 px-5 sm:px-8 py-3 max-w-7xl mx-auto">
        <SearchBar autoFocus className="w-full" onSubmitted={() => setSearchOpen(false)} />
      </div>
      }
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </header>
    <div aria-hidden className="h-[112px] md:h-[136px]" style={headerH ? { height: `${headerH}px` } : undefined} />
    </>
  );

}