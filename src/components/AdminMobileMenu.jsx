import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, MapPin, Ticket, Award, ClipboardList, Menu, GalleryHorizontal, Truck, ShoppingCart, Tags, BarChart3 } from 'lucide-react';
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';

// Admin navigation for phones and tablets: a floating button that opens a
// bottom-sheet drawer, since the icon rail is desktop-only.
export default function AdminMobileMenu() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  if (user?.role !== 'admin') return null;

  const links = [
    { to: '/admin', label: t('nav.admin'), icon: LayoutDashboard },
    { to: '/admin/carousel', label: 'Carousel', icon: GalleryHorizontal },
    { to: '/admin/suppliers', label: t('nav.suppliers'), icon: Truck },
    { to: '/admin/po', label: t('nav.po'), icon: ShoppingCart },
    { to: '/admin/categories', label: t('nav.categories'), icon: Tags },
    { to: '/orders-admin', label: t('nav.ordersAdmin'), icon: ClipboardList },
    { to: '/admin/reports', label: t('nav.reports'), icon: BarChart3 },
    { to: '/delivery', label: t('delivery.title'), icon: MapPin },
    { to: '/discounts', label: t('discount.title'), icon: Ticket },
    { to: '/loyalty-admin', label: t('loyalty.nav'), icon: Award },
  ];

  const go = (to) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button
          type="button"
          aria-label={t('nav.admin')}
          className="md:hidden fixed z-40 ltr:right-4 rtl:left-4 grid place-items-center w-12 h-12 rounded-full bg-cosmic text-white shadow-lg squish"
          style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
        >
          <Menu className="w-5 h-5" />
        </button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[85vh]">
        <div className="px-4 pt-2 pb-6 safe-bottom">
          <DrawerTitle className="px-2 font-heading font-extrabold text-lg">{t('nav.admin')}</DrawerTitle>
          <div className="mt-3 grid gap-2">
            {links.map((l) => {
              const active = pathname === l.to;
              return (
                <button
                  key={l.to}
                  type="button"
                  onClick={() => go(l.to)}
                  className={`flex items-center gap-3 h-14 px-4 rounded-2xl text-start font-heading font-bold transition-colors ${
                    active ? 'bg-cosmic text-white' : 'bg-mist text-foreground'
                  }`}
                >
                  <l.icon className="w-5 h-5 shrink-0" />
                  <span className="truncate">{l.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}