import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home as HomeIcon, Heart, ShoppingBag, Package, Trophy } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useLanguage } from '@/context/LanguageContext';

const tabs = [
  { to: '/', labelKey: 'nav.home', icon: HomeIcon, exact: true },
  { to: '/wishlist', labelKey: 'nav.wishlist', icon: Heart, badge: 'wish' },
  { to: '/cart', labelKey: 'nav.cart', icon: ShoppingBag, badge: 'cart' },
  { to: '/challenges', labelKey: 'nav.challenges', icon: Trophy },
  { to: '/orders', labelKey: 'nav.orders', icon: Package },
];

export default function MobileNav() {
  const { count: cartCount } = useCart();
  const { count: wishCount } = useWishlist();
  const { t } = useLanguage();
  const counts = { cart: cartCount, wish: wishCount };

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/60 safe-bottom">
      <div className="grid grid-cols-5">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.exact}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors no-select ${
                isActive ? 'text-cosmic' : 'text-muted-foreground'
              }`
            }
          >
            <span className="relative">
              <tab.icon className="w-6 h-6" />
              {tab.badge && counts[tab.badge] > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 grid place-items-center rounded-full bg-accent text-white text-[9px] font-bold">
                  {counts[tab.badge]}
                </span>
              )}
            </span>
            {t(tab.labelKey)}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}