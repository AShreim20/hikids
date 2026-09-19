import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { getAdminNav, isActivePath } from '@/lib/adminNav';
import { useActionItems, openActionRequired } from '@/lib/actionRequiredStore';
import { isOwner } from '@/lib/permissions';

// Admin navigation for phones and tablets: a floating button that opens a
// bottom-sheet drawer with the grouped management menu.
//
// Renders on every route for a signed-in admin (by owner's request, so the
// dashboard is always one tap away while browsing the storefront) — a
// pre-launch QA pass previously scoped this to admin routes only because
// the fixed bottom-right button can overlap ProductDetail's Buy Now / Add
// to Cart controls; reverted here.
export default function AdminMobileMenu() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const actionCount = useActionItems().length;

  // Opened from the header's admin button (Navbar) via this event.
  useEffect(() => {
    const openMenu = () => setOpen(true);
    window.addEventListener('hikids:open-admin-menu', openMenu);
    return () => window.removeEventListener('hikids:open-admin-menu', openMenu);
  }, []);

  if (user?.role !== 'admin') return null;

  const nav = getAdminNav(t, { isOwner: isOwner(user) });
  const go = (to) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent className="max-h-[85vh]">
        <div className="px-4 pt-2 pb-6 safe-bottom max-h-[85vh] overflow-y-auto">
          <DrawerTitle className="px-2 font-heading font-extrabold text-lg">{t('nav.admin')}</DrawerTitle>
          <div className="mt-3 grid gap-1.5">
            {nav.map((item) =>
              item.type === 'group' ? (
                <Group key={item.id} group={item} pathname={pathname} go={go} />
              ) : (
                <Row key={item.id || item.to} item={item} badge={item.type === 'action' ? actionCount : 0} active={false} onClick={() => { if (item.type === 'action') { setOpen(false); openActionRequired(); } else go(item.to); }} />
              )
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function Row({ item, active, onClick, badge = 0 }) {
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
      <span className="truncate flex-1">{item.label}</span>
      {badge > 0 && <span className="min-w-6 h-6 px-1.5 grid place-items-center rounded-full bg-accent text-white text-xs font-bold">{badge}</span>}
    </button>
  );
}

function Group({ group, pathname, go }) {
  const [expanded, setExpanded] = useState(() => group.children.some((c) => isActivePath(pathname, c)));
  const Icon = group.icon;
  const anyActive = group.children.some((c) => isActivePath(pathname, c));

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
            const active = isActivePath(pathname, c);
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