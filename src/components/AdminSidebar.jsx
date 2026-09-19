import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { getAdminNav } from '@/lib/adminNav';
import { useActionItems, openActionRequired } from '@/lib/actionRequiredStore';
import { isOwner } from '@/lib/permissions';
import AdminNavGroup from '@/components/AdminNavGroup';

// Desktop admin icon rail. Direct links render as simple buttons; merged
// groups render as AdminNavGroup flyouts. A single `openGroup` state in the
// rail guarantees only one flyout is open at a time — opening one closes
// any other, and navigating anywhere closes the open flyout.
//
// Renders on every route for a signed-in admin (by owner's request, so the
// dashboard is always one click away while browsing the storefront) — a
// pre-launch QA pass previously scoped this to admin routes only because
// the fixed left-0 rail can overlay storefront content; reverted here.
export default function AdminSidebar() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [openGroup, setOpenGroup] = useState(null);
  const actionCount = useActionItems().length;

  if (user?.role !== 'admin') return null;

  const nav = getAdminNav(t, { isOwner: isOwner(user) });

  return (
    <aside className="hidden md:flex fixed left-0 top-28 md:top-34 bottom-0 z-40 flex-col items-center gap-1.5 w-14 border-r border-border/60 bg-background/80 backdrop-blur-xl overflow-visible py-16 px-6">
      {nav.map((item) =>
      item.type === 'group' ?
      <AdminNavGroup
        key={item.id}
        group={item}
        open={openGroup === item.id}
        onToggle={() => setOpenGroup((v) => v === item.id ? null : item.id)}
        onClose={() => setOpenGroup(null)} /> :


      <NavButton
        key={item.id || item.to}
        item={item}
        badge={item.type === 'action' ? actionCount : 0}
        active={false}
        onSelect={() => {setOpenGroup(null);if (item.type === 'action') openActionRequired();else navigate(item.to);}} />


      )}
    </aside>);

}

function NavButton({ item, active, onSelect, badge = 0 }) {
  const Icon = item.icon;
  return (
    <button
      onClick={onSelect}
      title={item.label}
      aria-label={item.label}
      className={`relative grid place-items-center w-11 h-11 rounded-xl transition-colors cursor-pointer ${
      active ?
      'bg-cosmic text-white' :
      'bg-mist text-foreground/70 hover:bg-cosmic hover:text-white'}`
      }>
      
      <Icon className="w-5 h-5" />
      {badge > 0 && <span className="absolute -top-1 -end-1 min-w-5 h-5 px-1 grid place-items-center rounded-full bg-accent text-white text-[11px] font-bold">{badge}</span>}
    </button>);

}