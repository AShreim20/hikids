import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, Menu } from 'lucide-react';
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { getAdminNav } from '@/lib/adminNav';

// Admin navigation for phones and tablets: a floating button that opens a
// bottom-sheet drawer with the grouped management menu.
export default function AdminMobileMenu() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  if (user?.role !== 'admin') return null;

  const nav = getAdminNav(t);
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
        <div className="px-4 pt-2 pb-6 safe-bottom max-h-[85vh] overflow-y-auto">
          <DrawerTitle className="px-2 font-heading font-extrabold text-lg">{t('nav.admin')}</DrawerTitle>
          <div className="mt-3 grid gap-1.5">
            {nav.map((item) =>
              item.type === 'group' ? (
                <Group key={item.id} group={item} pathname={pathname} go={go} />
              ) : (
                <Row key={item.to} item={item} active={pathname === item.to} onClick={() => go(item.to)} />
              )
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function Row({ item, active, onClick }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 h-14 px-4 rounded-2xl text-start font-heading font-bold transition-colors ${
        active ? 'bg-cosmic text-white' : 'bg-mist text-foreground'
      }`}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <span className="truncate">{item.label}</span>
    </button>
  );
}

function Group({ group, pathname, go }) {
  const [expanded, setExpanded] = useState(() => group.children.some((c) => c.to === pathname));
  const Icon = group.icon;
  const anyActive = group.children.some((c) => c.to === pathname);

  return (
    <div className="rounded-2xl bg-mist/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`w-full flex items-center gap-3 h-14 px-4 text-start font-heading font-bold transition-colors ${
          anyActive ? 'text-cosmic' : 'text-foreground'
        }`}
      >
        <Icon className="w-5 h-5 shrink-0" />
        <span className="truncate flex-1">{group.label}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="px-2 pb-2 grid gap-1">
          {group.children.map((c) => {
            const CIcon = c.icon;
            const active = pathname === c.to;
            return (
              <button
                key={`${c.to}-${c.label}`}
                type="button"
                onClick={() => go(c.to)}
                className={`flex items-center gap-3 h-12 ps-9 pe-4 rounded-2xl text-start font-heading font-bold text-sm transition-colors ${
                  active ? 'bg-cosmic text-white' : 'bg-card text-foreground hover:bg-mist'
                }`}
              >
                <CIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">{c.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}