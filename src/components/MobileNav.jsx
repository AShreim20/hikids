import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home as HomeIcon, Grid2x2, ShoppingBag, User } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';

// Mobile (<768px) bottom navigation: exactly Home / Shop / Cart / Account.
// Account opens Login when signed out, otherwise the account area (My Orders,
// which links on to addresses, returns and wallet). The page body already
// reserves bottom space for this bar (see index.css).
const startsWithAny = (path, prefixes) => prefixes.some((p) => path === p || path.startsWith(`${p}/`));
const SHOP_PATHS = ['/shop', '/bundles', '/product', '/wishlist'];
const ACCOUNT_PATHS = ['/orders', '/returns', '/wallet', '/addresses', '/loyalty', '/wheel-rewards', '/login', '/register'];

export default function MobileNav() {
  const { count: cartCount } = useCart();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { pathname } = useLocation();

  const tabs = [
    { to: '/', label: t('nav.home'), icon: HomeIcon, active: pathname === '/' },
    { to: '/shop', label: t('nav.shop'), icon: Grid2x2, active: startsWithAny(pathname, SHOP_PATHS) },
    { to: '/cart', label: t('nav.cart'), icon: ShoppingBag, active: startsWithAny(pathname, ['/cart', '/checkout']), cart: true },
    { to: user ? '/orders' : '/login', label: t('mnav.account'), icon: User, active: startsWithAny(pathname, ACCOUNT_PATHS) },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/60 safe-bottom" aria-label="Primary">
      <div className="grid grid-cols-4">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            to={tab.to}
            aria-current={tab.active ? 'page' : undefined}
            className={`relative flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] no-select transition-colors ${
              tab.active ? 'text-cosmic font-bold' : 'text-muted-foreground font-medium'
            }`}
          >
            {tab.active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-cosmic" />}
            <span className="relative">
              <tab.icon className="w-6 h-6" {...(tab.cart ? { 'data-cart-anchor': '' } : {})} />
              {tab.cart && cartCount > 0 && (
                <span className="absolute -top-1.5 -end-2 min-w-4 h-4 px-1 grid place-items-center rounded-full bg-accent text-white text-[9px] font-bold">
                  {cartCount}
                </span>
              )}
            </span>
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
