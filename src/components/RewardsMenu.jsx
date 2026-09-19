import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Gift } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { useAvailableSpins } from '@/lib/useAvailableSpins';
import { navTriggerClass } from '@/lib/navTriggerClass';

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
//
// Navbar renders a desktop AND a mobile instance of this component at the
// same time (one hidden via a `hidden md:block` / `md:hidden` ancestor, not
// unmounted) and both read the same shared `open` prop. When Rewards is
// opened from the desktop trigger, the mobile instance's `open` becomes
// true too, so it *also* mounts its own panel/outside-click listener — and
// that listener's own root ref only wraps its own (hidden) subtree, so it
// sees a click on the desktop panel as "outside" and immediately closes the
// shared state before the click's navigation could complete. Fixed by
// matching on a shared `data-nav-dropdown` marker instead of a
// per-instance ref, so every instance agrees a click landing in *either*
// instance's panel is "inside".
export default function RewardsMenu({ open, onToggle, onClose, mobile = false }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const location = useLocation();
  const available = useAvailableSpins();

  const isActive = ['/challenges', '/wheel', '/wheel-rewards'].includes(location.pathname);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (!e.target.closest('[data-nav-dropdown]')) onClose();
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

  const panelWidthClass = mobile ? 'w-full' : 'min-w-[260px]';

  const Panel = (
    <div className={`${panelWidthClass} rounded-2xl bg-[#3A2660] border border-white/20 shadow-2xl p-2`}>
      {ROWS.map((r) => (
        <Link
          key={r.to}
          to={r.to}
          onClick={onClose}
          className={`flex items-start gap-3 rounded-lg px-3 hover:bg-white/10 transition-colors ${mobile ? 'py-3' : 'py-2'}`}
        >
          <span className={`leading-none mt-0.5 ${mobile ? 'text-2xl' : 'text-lg'}`}>{r.emoji}</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className={`font-heading font-bold text-white ${mobile ? 'text-base' : 'text-sm'}`}>{t(r.labelKey)}</span>
              {r.showSpins && available > 0 && (
                <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-highlight text-foreground text-[11px] font-bold leading-none shadow-sm">
                  {available}
                </span>
              )}
            </span>
            <span className={`block mt-0.5 ${mobile ? 'text-sm text-white/75' : 'text-xs text-white/60'}`}>{t(r.descKey)}</span>
          </span>
        </Link>
      ))}
    </div>
  );

  // Mobile keeps the original compact, unpadded trigger (the second nav
  // line is a tight strip with no room for a hit-box/hover background);
  // only the desktop trigger adopts the shared Header recipe so Rewards
  // matches Shop/Home/My Orders exactly (open-state background, focus
  // ring instead of the browser's default outline, etc).
  const triggerClass = mobile
    ? `inline-flex items-center gap-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
        isActive ? 'text-accent' : 'text-white/85 hover:text-accent'
      }`
    : navTriggerClass({ active: isActive, open });

  return (
    <div data-nav-dropdown="rewards" className={mobile ? 'shrink-0' : 'relative shrink-0'}>
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
        <div id={mobile ? 'rewards-menu-mobile-panel' : 'rewards-menu-panel'} className={mobile ? 'absolute inset-x-4 top-full mt-1 z-[60]' : 'absolute start-0 top-full mt-2 z-[60]'}>
          {Panel}
        </div>
      )}
    </div>
  );
}
