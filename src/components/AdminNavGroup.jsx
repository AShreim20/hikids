import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';

// A sidebar icon that opens a flyout list of child routes. The flyout is
// rendered through a portal to document.body so it escapes the admin
// sidebar's stacking context (backdrop-blur creates one) and is never
// trapped behind page content or pushed off-screen by RTL positioning.
export default function AdminNavGroup({ group, open, onToggle, onClose, activePaths }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const anyActive = (group.children || []).some((c) => activePaths?.includes(c.to));
  const Icon = group.icon;

  useEffect(() => {
    if (!open) return;

    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const menuW = 208;
      const menuH = (group.children?.length || 0) * 44 + 52;
      let left = r.right + 8;
      if (left + menuW > window.innerWidth - 8) left = r.left - menuW - 8;
      left = Math.max(8, Math.min(left, window.innerWidth - menuW - 8));
      const top = Math.max(8, Math.min(r.top, window.innerHeight - menuH - 8));
      setPos({ top, left });
    };
    place();

    const onDown = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      onClose();
    };
    const onKey = (e) => {if (e.key === 'Escape') onClose();};
    const onScrollOrResize = () => onClose();

    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, onClose, group.children]);

  const go = (to) => {
    onClose();
    navigate(to);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={onToggle}
        title={group.label}
        aria-label={group.label}
        aria-expanded={open}
        className={`grid place-items-center w-11 h-11 rounded-xl transition-colors cursor-pointer mx-1 ${
        open || anyActive ?
        'bg-cosmic text-white' :
        'bg-mist text-foreground/70 hover:bg-cosmic hover:text-white'}`
        }>
        
        <Icon className="w-5 h-5" />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ position: 'fixed', top: `${pos.top}px`, left: `${pos.left}px`, zIndex: 9999 }}
          className="w-52 rounded-2xl bg-card border border-border/70 shadow-xl p-1.5">
          
          <p className="px-3 pt-2 pb-1.5 text-[11px] uppercase tracking-wider font-heading font-bold text-muted-foreground">
            {group.label}
          </p>
          {group.children.map((c) => {
            const active = pathname === c.to;
            const CIcon = c.icon;
            return (
              <button
                key={`${c.to}-${c.label}`}
                type="button"
                onClick={() => go(c.to)}
                role="menuitem"
                className={`w-full flex items-center gap-3 h-11 px-3 rounded-xl text-start font-heading font-bold text-sm transition-colors cursor-pointer ${
                active ? 'bg-cosmic text-white' : 'text-foreground hover:bg-mist'}`
                }>
                
                <CIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">{c.label}</span>
              </button>);

          })}
        </div>,
        document.body
      )}
    </>);

}