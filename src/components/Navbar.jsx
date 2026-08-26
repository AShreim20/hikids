import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, BarChart3, Heart, Settings as SettingsIcon, Search, MapPin, ChevronDown } from 'lucide-react';
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

const MOBILE_LINK_CLASS =
  'text-sm font-medium text-white/85 hover:text-accent transition-colors whitespace-nowrap shrink-0';

function MobileLinkItem({ link, onClick, className = MOBILE_LINK_CLASS }) {
  return link.external ? (
    <a href={link.to} onClick={onClick} className={className}>
      {link.label}
    </a>
  ) : (
    <Link to={link.to} onClick={onClick} className={className}>
      {link.label}
    </Link>
  );
}

// "More" overflow menu for mobile nav links that don't fit on the second line.
function MobileMoreMenu({ links }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-sm font-medium text-white/85 hover:text-accent transition-colors whitespace-nowrap"
      >
        {t('nav.more')} <ChevronDown className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute end-0 top-full mt-2 z-50 min-w-[180px] rounded-2xl bg-[#5D3F85] border border-white/15 shadow-xl py-1.5">
            {links.map((l) => (
              <MobileLinkItem
                key={l.key}
                link={l}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm text-white/85 hover:bg-white/10 hover:text-accent whitespace-nowrap"
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

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
    { label: t('nav.home'), to: '/#categories' },
    { label: t('nav.explore'), to: '/shop' },
  ];

  // Mobile second-line nav links (Explore, World of Play, Orders, Challenges,
  // Wheel, Rewards, Insights). Links that don't fit collapse into "More".
  const mobileLinks = useMemo(() => {
    const arr = [
      { key: 'worlds', label: t('nav.home'), to: '/#categories', external: true },
      { key: 'explore', label: t('nav.explore'), to: '/shop', external: false },
    ];
    if (user) {
      arr.push({ key: 'orders', label: t('orders.title'), to: '/orders', external: false });
      arr.push({ key: 'challenges', label: t('nav.challenges'), to: '/challenges', external: false });
      arr.push({ key: 'wheel', label: t('nav.wheel'), to: '/wheel', external: false });
      arr.push({ key: 'rewards', label: t('nav.wheelRewards'), to: '/wheel-rewards', external: false });
    }
    if (user?.role === 'admin') {
      arr.push({ key: 'insights', label: t('nav.insights'), to: '/analytics', external: false });
    }
    return arr;
  }, [user, t]);

  // Measure which links fit on one line; the rest go into the "More" menu.
  const measureRef = useRef(null);
  const rowRef = useRef(null);
  const [visibleCount, setVisibleCount] = useState(mobileLinks.length);
  useLayoutEffect(() => {
    const compute = () => {
      const measureEl = measureRef.current;
      const rowEl = rowRef.current;
      if (!measureEl || !rowEl) return;
      const widths = Array.from(measureEl.children).map((c) => c.offsetWidth);
      const gap = 16; // gap-4
      const moreW = 80; // reserved width for the "More" button
      const avail = rowEl.clientWidth;
      const fit = (reserveMore) => {
        const a = avail - (reserveMore ? moreW + gap : 0);
        let total = 0, count = 0;
        for (let i = 0; i < widths.length; i++) {
          const add = (i > 0 ? gap : 0) + widths[i];
          if (total + add > a) break;
          total += add;
          count++;
        }
        return count;
      };
      let count = fit(false);
      if (count < widths.length) count = fit(true);
      setVisibleCount(widths.length ? Math.max(count, 1) : 0);
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (rowRef.current) ro.observe(rowRef.current);
    return () => ro.disconnect();
  }, [mobileLinks]);

  return (
    <>
      <header ref={headerRef} className="fixed top-0 left-0 right-0 z-50 bg-[#5D3F85]/90 backdrop-blur-xl border-b border-accent/30 safe-top">
        {/* Section 1 — brand + search + mobile action icons */}
        <div className="border-b border-white/10">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 md:h-20 flex items-center gap-4">
            <Link to="/" className="flex items-center group shrink-0">
              <Logo className="h-14 md:h-16 w-auto group-hover:scale-95 transition-transform" />
            </Link>

            {/* Prominent search — desktop/tablet */}
            <div className="hidden md:block flex-1 max-w-xl mx-auto">
              <SearchBar className="w-full" />
            </div>

            {/* Mobile: search + language + settings inline in the first line */}
            <div className="md:hidden ms-auto flex items-center gap-1.5">
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

        {/* Section 2 — desktop navigation + account actions (desktop only) */}
        <div className="hidden md:block">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 h-12 md:h-14 flex items-center justify-between gap-3">
            <div className="hidden md:flex items-center gap-5 lg:gap-9">
              {links.map((l) => (
                <a
                  key={l.label}
                  href={l.to}
                  className="text-sm font-medium text-white/85 hover:text-accent transition-colors mx-5"
                >
                  {l.label}
                </a>
              ))}
              {user && (
                <Link to="/orders" className="text-sm font-medium text-white/85 hover:text-accent transition-colors">
                  {t('orders.title')}
                </Link>
              )}
              {user && (
                <Link to="/challenges" className="text-sm font-medium text-white/85 hover:text-accent transition-colors">
                  {t('nav.challenges')}
                </Link>
              )}
              <HeaderWheelSpins />
              {user && (
                <Link to="/wheel-rewards" className="text-sm font-medium text-white/85 hover:text-accent transition-colors">
                  {t('nav.wheelRewards')}
                </Link>
              )}
              {user?.role === 'admin' && (
                <Link to="/analytics" className="text-sm font-medium text-accent hover:text-accent/80 transition-colors flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4" /> {t('nav.insights')}
                </Link>
              )}
            </div>

            <div className="flex items-center gap-1.5 lg:gap-2 ms-auto">
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
                data-cart-anchor
              >
                <ShoppingBag className="w-5 h-5" />
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

        {/* Mobile second line — nav links with "More" overflow */}
        <div className="md:hidden relative">
          {/* invisible measure row (kept in flow for accurate widths) */}
          <div
            ref={measureRef}
            aria-hidden
            className="absolute top-0 left-0 right-0 h-0 overflow-hidden flex items-center gap-4 pointer-events-none opacity-0"
          >
            {mobileLinks.map((l) => (
              <MobileLinkItem key={l.key} link={l} />
            ))}
          </div>
          <div className="max-w-7xl mx-auto px-5 sm:px-8 h-12 flex items-center">
            <div ref={rowRef} className="flex items-center gap-4 flex-1 min-w-0">
              {mobileLinks.slice(0, visibleCount).map((l) => (
                <MobileLinkItem key={l.key} link={l} />
              ))}
              {visibleCount < mobileLinks.length && (
                <MobileMoreMenu links={mobileLinks.slice(visibleCount)} />
              )}
            </div>
          </div>
        </div>

        {searchOpen && (
          <div className="md:hidden border-t border-white/10 px-5 sm:px-8 py-3 max-w-7xl mx-auto">
            <SearchBar autoFocus className="w-full" onSubmitted={() => setSearchOpen(false)} />
          </div>
        )}
        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      </header>
      <div aria-hidden className="h-[112px] md:h-[136px]" style={headerH ? { height: `${headerH}px` } : undefined} />
    </>
  );
}