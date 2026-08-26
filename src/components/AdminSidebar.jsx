import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { getAdminNav } from '@/lib/adminNav';
import AdminNavGroup from '@/components/AdminNavGroup';

// Desktop admin icon rail. Direct links render as simple buttons; merged
// groups render as AdminNavGroup flyouts. A single `openGroup` state in the
// rail guarantees only one flyout is open at a time — opening one closes
// any other, and navigating anywhere closes the open flyout.
export default function AdminSidebar() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [openGroup, setOpenGroup] = useState(null);

  if (user?.role !== 'admin') return null;

  const nav = getAdminNav(t);

  return (
    <aside className="hidden md:flex fixed left-0 top-28 md:top-34 bottom-0 z-40 flex-col items-center gap-1.5 w-14 py-6 border-r border-border/60 bg-background/80 backdrop-blur-xl overflow-visible">
      {nav.map((item) =>
        item.type === 'group' ? (
          <AdminNavGroup
            key={item.id}
            group={item}
            activePaths={item.children.map((c) => c.to)}
            open={openGroup === item.id}
            onToggle={() => setOpenGroup((v) => (v === item.id ? null : item.id))}
            onClose={() => setOpenGroup(null)}
          />
        ) : (
          <NavButton
            key={item.to}
            item={item}
            active={pathname === item.to}
            onSelect={() => { setOpenGroup(null); navigate(item.to); }}
          />
        )
      )}
    </aside>
  );
}

function NavButton({ item, active, onSelect }) {
  const Icon = item.icon;
  return (
    <button
      onClick={onSelect}
      title={item.label}
      aria-label={item.label}
      className={`grid place-items-center w-11 h-11 rounded-xl transition-colors cursor-pointer ${
        active
          ? 'bg-cosmic text-white'
          : 'bg-mist text-foreground/70 hover:bg-cosmic hover:text-white'
      }`}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}