import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, X } from 'lucide-react';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { getAdminNav, isActivePath } from '@/lib/adminNav';
import { useActionItems } from '@/lib/actionRequiredStore';
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
  const { t, lang } = useLanguage();
  const ar = lang === 'ar';
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  // Its own trigger stays visible in the still-open admin drawer, so pressing
  // it again toggles this side panel closed (in addition to the sheet's own
  // overlay/X close).
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionItems = useActionItems();

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
    <>
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent className="max-h-[85vh]">
        <div className="px-4 pt-2 pb-6 safe-bottom max-h-[85vh] overflow-y-auto">
          <DrawerTitle className="px-2 font-heading font-extrabold text-lg">{t('nav.admin')}</DrawerTitle>
          <div className="mt-3 grid gap-1.5">
            {nav.map((item) =>
              item.type === 'group' ? (
                <Group key={item.id} group={item} pathname={pathname} go={go} />
              ) : (
                item.type === 'action' ? (
                  <ActionTrigger key={item.id} item={item} count={actionItems.length} onClick={() => setActionsOpen((v) => !v)} />
                ) : (
                  <Row key={item.id || item.to} item={item} active={pathname === item.to} onClick={() => go(item.to)} />
                )
              )
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>

    {/* "Required Actions": a side panel (not a bottom sheet) stacked above the
        still-open admin drawer -- its own trigger button stays reachable, so
        tapping it again toggles this panel closed. */}
    <Sheet open={actionsOpen} onOpenChange={setActionsOpen}>
      <SheetContent side={ar ? 'right' : 'left'} className="w-[85vw] max-w-sm p-0 flex flex-col">
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-border/60">
          <SheetTitle className="font-heading font-extrabold text-lg">{t('nav.actionRequired')}</SheetTitle>
          <button type="button" onClick={() => setActionsOpen(false)} aria-label={ar ? 'إغلاق' : 'Close'} className="relative grid place-items-center w-9 h-9 rounded-full bg-mist after:absolute after:-inset-2 after:content-['']">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 grid gap-1.5">
          {actionItems.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">{ar ? 'لا توجد إجراءات مطلوبة' : 'No required actions'}</p>
          ) : actionItems.map((i, idx) => (
            <button
              key={`${i.route}-${i.ref}-${idx}`}
              type="button"
              onClick={() => { setActionsOpen(false); navigate(i.route); }}
              className={`flex items-center gap-2 min-h-12 px-4 py-2 rounded-2xl text-start bg-mist/60 ${i.priority === 'urgent' ? 'border border-destructive/40' : ''}`}
            >
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-heading font-bold truncate">{ar ? i.title_ar : i.title_en}</span>
                <span className="block text-xs text-muted-foreground truncate" dir="ltr">{i.ref}{i.customer ? ` · ${i.customer}` : ''}</span>
              </span>
              <span className="shrink-0 text-xs font-heading font-bold text-cosmic">{ar ? i.action_ar : i.action_en}</span>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
    </>
  );
}

// Menu row that toggles the Required Actions side panel (does not expand
// in place, and does not navigate).
function ActionTrigger({ item, count, onClick }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 h-14 px-4 rounded-2xl text-start font-heading font-bold bg-mist text-foreground"
    >
      <Icon className="w-5 h-5 shrink-0" />
      <span className="truncate flex-1">{item.label}</span>
      {count > 0 && <span className="min-w-6 h-6 px-1.5 grid place-items-center rounded-full bg-accent text-white text-xs font-bold">{count}</span>}
    </button>
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