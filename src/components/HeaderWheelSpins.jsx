import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Gift } from 'lucide-react';
import { wheelState } from '@/lib/wheelFunctions';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

// Header entry for the Surprise Box / Mystery Wheel. Shows the user's live
// available-spin count as a small badge — only when > 0 — so the header
// never displays a misleading positive indicator. Refetches on navigation
// and when the tab regains focus so the count stays current.
export default function HeaderWheelSpins() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const [available, setAvailable] = useState(null);

  useEffect(() => {
    if (!user) { setAvailable(null); return; }
    let alive = true;
    wheelState()
      .then((res) => {
        if (!alive) return;
        if (res?.success && res.active !== false) setAvailable(Number(res.available) || 0);
        else setAvailable(null);
      })
      .catch(() => { if (alive) setAvailable(null); });
    return () => { alive = false; };
  }, [user, location.pathname]);

  useEffect(() => {
    if (!user) return;
    const handler = () => {
      wheelState()
        .then((res) => {
          if (res?.success && res.active !== false) setAvailable(Number(res.available) || 0);
          else setAvailable(null);
        })
        .catch(() => {});
    };
    window.addEventListener('focus', handler);
    document.addEventListener('visibilitychange', handler);
    return () => {
      window.removeEventListener('focus', handler);
      document.removeEventListener('visibilitychange', handler);
    };
  }, [user]);

  if (!user) return null;

  return (
    <Link to="/wheel" className="relative inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent/80 transition-colors">
      <Gift className="w-4 h-4" />
      <span>{t('nav.wheel')}</span>
      {available > 0 && (
        <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-highlight text-foreground text-[11px] font-bold leading-none shadow-sm">
          {available}
        </span>
      )}
    </Link>
  );
}