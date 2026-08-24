import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, MapPin, Ticket, Award } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';

export default function AdminSidebar() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (user?.role !== 'admin') return null;

  const links = [
    { to: '/admin', label: t('nav.admin'), icon: LayoutDashboard },
    { to: '/delivery', label: t('delivery.title'), icon: MapPin },
    { to: '/discounts', label: t('discount.title'), icon: Ticket },
    { to: '/loyalty-admin', label: t('loyalty.nav'), icon: Award },
  ];

  return (
    <aside className="hidden md:flex fixed left-0 top-16 md:top-20 bottom-0 z-40 flex-col items-center gap-1.5 w-14 py-6 border-r border-border/60 bg-background/80 backdrop-blur-xl">
      {links.map((l) => {
        const active = pathname === l.to;
        return (
          <button
            key={l.to}
            onClick={() => navigate(l.to)}
            title={l.label}
            aria-label={l.label}
            className={`grid place-items-center w-11 h-11 rounded-xl transition-colors ${
              active
                ? 'bg-cosmic text-white'
                : 'bg-mist text-foreground/70 hover:bg-cosmic hover:text-white'
            }`}
          >
            <l.icon className="w-5 h-5" />
          </button>
        );
      })}
    </aside>
  );
}