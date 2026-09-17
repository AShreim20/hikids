import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { wheelState } from '@/lib/wheelFunctions';
import { useAuth } from '@/lib/AuthContext';

// The single source of truth for the header's "available spins" count —
// extracted from the old standalone HeaderWheelSpins nav link so the new
// RewardsMenu (its top-level badge AND its Spin & Win row) both read the
// same fetch/state instead of each doing their own wheelState() call.
// Refetches on navigation and when the tab regains focus so the count
// stays current.
export function useAvailableSpins() {
  const { user } = useAuth();
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

  return available;
}
