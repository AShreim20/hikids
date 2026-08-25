import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// A sidebar icon that opens a flyout list of child routes. Used by the admin
// icon rail to group related management pages under a single icon.
export default function AdminNavGroup({ group, activePaths }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const wrapRef = useRef(null);

  const anyActive = (group.children || []).some((c) => activePaths?.includes(c.to));
  const Icon = group.icon;

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const go = (to) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title={group.label}
        aria-label={group.label}
        aria-expanded={open}
        className={`grid place-items-center w-11 h-11 rounded-xl transition-colors ${
          open || anyActive
            ? 'bg-cosmic text-white'
            : 'bg-mist text-foreground/70 hover:bg-cosmic hover:text-white'
        }`}
      >
        <Icon className="w-5 h-5" />
      </button>
      {open && (
        <div
          className="absolute top-0 ltr:left-[3.25rem] rtl:right-[3.25rem] z-50 w-52 rounded-2xl bg-card border border-border/70 shadow-xl p-1.5 origin-top ltr:origin-top-left rtl:origin-top-right"
          role="menu"
        >
          <p className="px-3 pt-2 pb-1.5 text-[11px] uppercase tracking-wider font-heading font-bold text-muted-foreground">
            {group.label}
          </p>
          {group.children.map((c) => {
            const active = pathname === c.to;
            const CIcon = c.icon;
            return (
              <button
                key={`${c.to}-${c.label}`}
                onClick={() => go(c.to)}
                role="menuitem"
                className={`w-full flex items-center gap-3 h-11 px-3 rounded-xl text-start font-heading font-bold text-sm transition-colors ${
                  active ? 'bg-cosmic text-white' : 'text-foreground hover:bg-mist'
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