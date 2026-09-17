import React, { useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Heart, Settings as SettingsIcon, Search, MapPin } from 'lucide-react';
import SearchBar from '@/components/SearchBar';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import SettingsDialog from '@/components/SettingsDialog';
import Logo from '@/components/Logo';
import LanguageToggle from '@/components/LanguageToggle';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import HeaderLoyaltyBalance from '@/components/HeaderLoyaltyBalance';
import ShopMenu from '@/components/ShopMenu';
import RewardsMenu from '@/components/RewardsMenu';
import HeaderToyPattern from '@/components/HeaderToyPattern';

export default function Navbar() {
  const { count } = useCart();
  const { count: wishCount } = useWishlist();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // Which of the two consolidated top-level dropdowns is open — shared so
  // opening one always closes the other (never both at once), the same
  // lifted-single-open-group pattern AdminSidebar/AdminNavGroup already use.
  const [openMenu, setOpenMenu] = useState(null); // null | 'shop' | 'rewards'
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

  const toggleShop = () => setOpenMenu((v) => (v === 'shop' ? null : 'shop'));
  const toggleRewards = () => setOpenMenu((v) => (v === 'rewards' ? null : 'rewards'));
  const closeMenus = () => setOpenMenu(null);

  return (
    <>
      <header ref={headerRef} className="fixed top-0 left-0 right-0 z-50 bg-[#5D3F85]/90 backdrop-blur-xl border-b border-accent/30 safe-top">
        {/* Playful toy-themed brand pattern — opposite the logo, behind all
            content. Flat vector toys in the logo's palette; fewer/smaller on
            mobile so the header stays clean. */}
        <HeaderToyPattern />
        {/* Section 1 — brand + search + mobile action icons */}
        <div className="relative z-10 border-b border-white/10">
          <div className="max-w-7xl mx-auto px-6 sm:px-10 h-16 md:h-20 flex items-center gap-5 md:gap-6">
            <Link to="/" className="flex items-center group shrink-0">
              <Logo className="h-14 md:h-16 w-auto group-hover:scale-95 transition-transform" />
            </Link>

            {/* Prominent search — desktop/tablet */}
            <div className="hidden md:block flex-1 max-w-xl mx-auto">
              <SearchBar className="w-full" />
            </div>

            {/* Mobile: search + language + settings inline in the first line */}
            <div className="md:hidden ms-auto flex items-center gap-2">
              <button
                onClick={() => setSearchOpen((v) => !v)}
                className="grid place-items-center w-11 h-11 rounded-2xl bg-white/15 text-white hover:bg-accent hover:text-white transition-colors"
                aria-label={t('nav.search')}
              >
                <Search className="w-5 h-5" />
              </button>
              <LanguageToggle />
              <button
                onClick={() => setSettingsOpen(true)}
                className="grid place-items-center w-11 h-11 rounded-2xl bg-white/15 text-white hover:bg-accent hover:text-white transition-colors"
                aria-label={t('nav.settings')}
              >
                <SettingsIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Section 2 — desktop navigation + account actions (desktop only).
            Two independent flex groups (nav on the start side, actions
            pushed to the end via ms-auto) — free space in between is left
            alone rather than stretched, so removing links here doesn't pull
            the remaining ones apart. */}
        <div className="hidden md:block relative z-10">
          <div className="max-w-7xl mx-auto px-6 sm:px-10 h-12 md:h-14 flex items-center gap-4">
            <div className="flex items-center gap-6 lg:gap-8">
              {/* A hash-only link needs a real anchor: React Router's <Link>
                  to a path + hash on a different route doesn't reliably
                  scroll to the fragment. */}
              <a href="/#categories" className="text-sm font-medium text-white/85 hover:text-accent transition-colors whitespace-nowrap">
                {t('nav.home')}
              </a>
              <ShopMenu open={openMenu === 'shop'} onToggle={toggleShop} onClose={closeMenus} />
              {user && (
                <Link to="/orders" className="text-sm font-medium text-white/85 hover:text-accent transition-colors whitespace-nowrap">
                  {t('orders.title')}
                </Link>
              )}
              <RewardsMenu open={openMenu === 'rewards'} onToggle={toggleRewards} onClose={closeMenus} />
            </div>

            <div className="flex items-center gap-2 lg:gap-2.5 ms-auto">
              <span className="hidden md:inline-flex"><LanguageToggle /></span>
              <HeaderLoyaltyBalance />
              {user && (
                <button
                  onClick={() => navigate('/addresses')}
                  className="hidden lg:grid squish place-items-center w-11 h-11 rounded-2xl bg-white/15 text-white hover:bg-accent hover:text-white transition-colors"
                  aria-label={t('address.title')}
                >
                  <MapPin className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={() => setSettingsOpen(true)}
                className="hidden md:grid place-items-center w-11 h-11 rounded-2xl bg-white/15 text-white hover:bg-accent hover:text-white transition-colors"
                aria-label={t('nav.settings')}
              >
                <SettingsIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigate('/wishlist')}
                className="hidden md:grid relative squish place-items-center w-11 h-11 rounded-2xl bg-white/15 text-white hover:bg-accent hover:text-white transition-colors"
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
                className="hidden md:grid relative squish place-items-center w-11 h-11 rounded-2xl bg-white/15 text-white hover:bg-accent hover:text-white transition-colors"
                aria-label="Cart"
              >
                <ShoppingBag className="w-5 h-5" data-cart-anchor />
                {count > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 grid place-items-center rounded-full bg-accent text-white text-[11px] font-bold">
                    {count}
                  </span>
                )}
              </button>
              {!user && (
                <div className="hidden md:flex items-center gap-2 ms-1">
                  <Link
                    to="/login"
                    className="h-11 px-4 rounded-2xl bg-white/15 text-white text-sm font-heading font-bold inline-flex items-center hover:bg-accent hover:text-white transition-colors"
                  >
                    {t('nav.signIn')}
                  </Link>
                  <Link
                    to="/register"
                    className="h-11 px-4 rounded-2xl bg-accent text-white text-sm font-heading font-bold inline-flex items-center hover:bg-accent/90 transition-colors whitespace-nowrap"
                  >
                    {t('nav.signUp')}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile second line — mirrors the desktop nav group (Home / Shop /
            My Orders / Rewards) one-for-one, no separate mobile-only link
            set and no width-measuring "More" overflow needed now that it's
            down to 3-4 short items. No overflow-x-auto here: it would make
            overflow-y a clipping context too (a classic CSS gotcha), which
            clips the absolutely-positioned Shop/Rewards dropdown panels
            instead of just scrolling the row. */}
        <div className="md:hidden relative z-10">
          <div className="max-w-7xl mx-auto px-6 sm:px-10 h-12 flex items-center">
            <div className="flex items-center gap-4 shrink-0">
              <a href="/#categories" className="text-sm font-medium text-white/85 hover:text-accent transition-colors whitespace-nowrap">
                {t('nav.home')}
              </a>
              <ShopMenu mobile open={openMenu === 'shop'} onToggle={toggleShop} onClose={closeMenus} />
              {user && (
                <Link to="/orders" className="text-sm font-medium text-white/85 hover:text-accent transition-colors whitespace-nowrap">
                  {t('orders.title')}
                </Link>
              )}
              <RewardsMenu mobile open={openMenu === 'rewards'} onToggle={toggleRewards} onClose={closeMenus} />
            </div>
          </div>
        </div>

        {searchOpen && (
          <div className="md:hidden relative z-10 border-t border-white/10 px-6 sm:px-10 py-3 max-w-7xl mx-auto">
            <SearchBar autoFocus className="w-full" onSubmitted={() => setSearchOpen(false)} />
          </div>
        )}
        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      </header>
      <div aria-hidden className="h-[112px] md:h-[136px]" style={headerH ? { height: `${headerH}px` } : undefined} />
    </>
  );
}
