import React, { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { ChooseForKidsMenuDesktop, ChooseForKidsMenuMobile } from '@/components/ChooseForKidsMenu';

// Top-level "Shop" menu — consolidates All Toys / Choose for Kids / Bundles
// & Packages under one trigger (header cleanup). Open state is owned by the
// parent Navbar (`open`/`onToggle`/`onClose`) so it and RewardsMenu can
// enforce "only one top-level menu open at a time", mirroring the same
// lifted-state pattern AdminSidebar already uses for its nav groups.
//
// The top-level trigger is click-only (no hover-to-open/close) by design:
// combining click-toggle with hover-open/close on the SAME trigger is what
// causes classic dropdown flicker when the pointer travels diagonally into
// a nested submenu. Once open, the nested Choose for Kids cascade is still
// hover-driven — safe here because the panel no longer auto-closes on
// mouse movement, only on outside click / Escape / navigation / re-click.
export default function ShopMenu({ open, onToggle, onClose, mobile = false }) {
  const { t } = useLanguage();
  const location = useLocation();
  const rootRef = useRef(null);

  const isActive = location.pathname === '/shop' || location.pathname === '/bundles';

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (mobile) {
    return (
      <div ref={rootRef} className="relative shrink-0">
        <button
          type="button"
          onClick={onToggle}
          aria-haspopup="true"
          aria-expanded={open}
          aria-controls="shop-menu-mobile-panel"
          className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
            isActive ? 'text-accent' : 'text-white/85 hover:text-accent'
          }`}
        >
          <LayoutGrid className="w-4 h-4" /> {t('nav.shop')}
        </button>
        {open && (
          <div
            id="shop-menu-mobile-panel"
            className="absolute start-0 top-full mt-2 z-[60] min-w-[240px] max-w-[calc(100vw-2rem)] rounded-2xl bg-[#3A2660] border border-white/20 shadow-2xl p-3"
          >
            <Link to="/shop" onClick={onClose} className="block rounded-lg px-3 py-2 text-sm font-heading font-bold text-white hover:bg-white/10">
              {t('nav.allToys')}
            </Link>
            <ChooseForKidsMenuMobile onNavigate={onClose} />
            <Link to="/bundles" onClick={onClose} className="block rounded-lg px-3 py-2 text-sm font-heading font-bold text-white hover:bg-white/10">
              {t('nav.bundles')}
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="shop-menu-panel"
        className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
          isActive ? 'text-accent' : 'text-white/85 hover:text-accent'
        }`}
      >
        <LayoutGrid className="w-4 h-4" /> {t('nav.shop')}
      </button>
      {open && (
        <div id="shop-menu-panel" className="absolute start-0 top-full mt-2 z-[60] min-w-[220px] rounded-2xl bg-[#3A2660] border border-white/20 shadow-2xl p-2">
          <Link to="/shop" onClick={onClose} className="block rounded-lg px-3 py-2 text-sm font-heading font-bold text-white hover:bg-white/10">
            {t('nav.allToys')}
          </Link>
          <ChooseForKidsMenuDesktop onNavigate={onClose} />
          <Link to="/bundles" onClick={onClose} className="block rounded-lg px-3 py-2 text-sm font-heading font-bold text-white hover:bg-white/10">
            {t('nav.bundles')}
          </Link>
        </div>
      )}
    </div>
  );
}
