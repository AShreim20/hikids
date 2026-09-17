import React, { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Gift } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { useAvailableSpins } from '@/lib/useAvailableSpins';

const ROWS = [
  { to: '/challenges', emoji: '🎯', labelKey: 'nav.challenges', descKey: 'nav.rewardsChallengesDesc' },
  { to: '/wheel', emoji: '🎡', labelKey: 'nav.wheel', descKey: 'nav.rewardsWheelDesc', showSpins: true },
  { to: '/wheel-rewards', emoji: '🎁', labelKey: 'nav.wheelRewards', descKey: 'nav.rewardsMyRewardsDesc' },
];

// Top-level "Rewards" menu — consolidates Challenges / Spin & Win / My
// Rewards under one trigger. Hidden entirely for guests, exactly matching
// the pre-consolidation behavior (each of these three links was previously
// only rendered `{user && ...}`). Reuses useAvailableSpins() — the same
// source of truth the old standalone "Mystery Wheel" header link read —
// for both the top-level badge and the Spin & Win row's own count, so
// there's still only one place that count is fetched.
export default function RewardsMenu({ open, onToggle, onClose, mobile = false }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const location = useLocation();
  const available = useAvailableSpins();
  const rootRef = useRef(null);

  const isActive = ['/challenges', '/wheel', '/wheel-rewards'].includes(location.pathname);

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

  if (!user) return null;

  const panelWidthClass = mobile ? 'min-w-[240px] max-w-[calc(100vw-2rem)]' : 'min-w-[260px]';

  const Panel = (
    <div className={`${panelWidthClass} rounded-2xl bg-[#3A2660] border border-white/20 shadow-2xl p-2`}>
      {ROWS.map((r) => (
        <Link
          key={r.to}
          to={r.to}
          onClick={onClose}
          className="flex items-start gap-2.5 rounded-lg px-3 py-2 hover:bg-white/10 transition-colors"
        >
          <span className="text-lg leading-none mt-0.5">{r.emoji}</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="text-sm font-heading font-bold text-white">{t(r.labelKey)}</span>
              {r.showSpins && available > 0 && (
                <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-highlight text-foreground text-[11px] font-bold leading-none shadow-sm">
                  {available}
                </span>
              )}
            </span>
            <span className="block text-xs text-white/60 mt-0.5">{t(r.descKey)}</span>
          </span>
        </Link>
      ))}
    </div>
  );

  const triggerClass = `inline-flex items-center gap-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
    isActive ? 'text-accent' : 'text-white/85 hover:text-accent'
  }`;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={mobile ? 'rewards-menu-mobile-panel' : 'rewards-menu-panel'}
        className={triggerClass}
      >
        <Gift className="w-4 h-4" />
        {t('nav.rewards')}
        {available > 0 && (
          <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-highlight text-foreground text-[11px] font-bold leading-none shadow-sm">
            {available}
          </span>
        )}
      </button>
      {open && (
        <div id={mobile ? 'rewards-menu-mobile-panel' : 'rewards-menu-panel'} className="absolute start-0 top-full mt-2 z-[60]">
          {Panel}
        </div>
      )}
    </div>
  );
}
