import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home as HomeIcon, Heart, ShoppingBag, BarChart3 } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';

const tabs = [
  { to: '/', label: 'Home', icon: HomeIcon, exact: true },
  { to: '/wishlist', label: 'Wishlist', icon: Heart, badge: 'wish' },
  { to: '/cart', label: 'Cart', icon: ShoppingBag, badge: 'cart' },
  { to: '/analytics', label: 'Insights', icon: BarChart3 },
];

export default function MobileNav() {
  const { count: cartCount } = useCart();
  const { count: wishCount } = useWishlist();
  const counts = { cart: cartCount, wish: wishCount };

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/60 safe-bottom">
      <div className="grid grid-cols-4">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.exact}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors no-select ${
                isActive ? 'text-cosmic' : 'text-muted-foreground'
              }`
            }
          >
            <span className="relative">
              <t.icon className="w-6 h-6" />
              {t.badge && counts[t.badge] > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 grid place-items-center rounded-full bg-accent text-white text-[9px] font-bold">
                  {counts[t.badge]}
                </span>
              )}
            </span>
            {t.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}