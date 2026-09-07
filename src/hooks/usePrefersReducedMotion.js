import { useEffect, useState } from 'react';

// Tracks the OS/browser-level "reduce motion" accessibility preference —
// used to tone down or disable purely decorative automatic animation
// (carousel auto-advance, slide transitions) while manual interaction stays
// fully available.
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return !!reduced;
}
