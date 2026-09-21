import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, ShoppingBag, Heart } from 'lucide-react';
import Logo from '@/components/Logo';
import SearchBar from '@/components/SearchBar';
import MobileMenuDrawer from '@/components/MobileMenuDrawer';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useLanguage } from '@/context/LanguageContext';

// Mobile (<768px) header: hamburger (start) | logo (center) | cart (end),
// with a full-width search bar directly below. Rendered inside Navbar's
// fixed, measured header so page content always starts beneath it.
export default function MobileHeader({ onOpenSettings }) {
  const { count } = useCart();
  const { count: wishCount } = useWishlist();
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const btn = "relative grid place-items-center w-11 h-11 rounded-2xl bg-white/15 text-white active:bg-accent transition-colors after:absolute after:-inset-2 after:content-['']";

  return (
    <div className="relative z-10 px-4 pt-2 pb-3">
      <div className="relative flex h-14 items-center justify-between">
        <button type="button" onClick={() => setMenuOpen(true)} className={btn} aria-label={t('mnav.menu')} aria-haspopup="dialog">
          <Menu className="w-6 h-6" />
        </button>
        <Link to="/" className="absolute inset-x-0 mx-auto flex w-fit items-center" aria-label="HiKids">
          <Logo className="h-12 w-auto" />
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/wishlist" className={btn} aria-label={t('nav.wishlist')}>
            <Heart className="w-6 h-6" />
            {wishCount > 0 && (
              <span className="absolute -top-1 -end-1 min-w-5 h-5 px-1 grid place-items-center rounded-full bg-accent text-white text-[11px] font-bold">{wishCount}</span>
            )}
          </Link>
          <Link to="/cart" className={btn} aria-label={t('nav.cart')}>
            <ShoppingBag className="w-6 h-6" />
            {count > 0 && (
              <span className="absolute -top-1 -end-1 min-w-5 h-5 px-1 grid place-items-center rounded-full bg-accent text-white text-[11px] font-bold">{count}</span>
            )}
          </Link>
        </div>
      </div>
      <SearchBar className="mt-2 w-full" />
      <MobileMenuDrawer open={menuOpen} onOpenChange={setMenuOpen} onOpenSettings={onOpenSettings} />
    </div>
  );
}
