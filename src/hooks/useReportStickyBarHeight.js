import { useCallback, useRef } from 'react';
import { setStickyBarHeight } from '@/lib/stickyBarStore';

// Measures the given element's real rendered height (ResizeObserver — not a
// guessed constant) and publishes it to the shared sticky-bar-height store
// for as long as it's mounted; resets to 0 when it unmounts so pages without
// a sticky bar aren't affected.
//
// Deliberately a callback ref, not a plain ref + useEffect(..., []): the
// sticky bar only exists once the product has finished loading, so the ref
// attaches on a *later* render than this hook's own mount — a plain ref
// would have its effect run once, immediately, while ref.current is still
// null, and never fire again. A callback ref instead gets invoked by React
// every time the DOM node itself attaches or detaches, whichever render that
// happens on, which is exactly what's needed here.
export function useReportStickyBarHeight() {
  const cleanupRef = useRef(null);

  const ref = useCallback((el) => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    if (!el) {
      setStickyBarHeight(0);
      return;
    }
    const update = () => setStickyBarHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    // Fallback for the case a ResizeObserver doesn't fire on its own: the
    // bar is desktop-only (hidden md:block), and not every browser reliably
    // reports a size change when an element flips to/from display:none
    // across a responsive breakpoint.
    window.addEventListener('resize', update);
    cleanupRef.current = () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  return ref;
}
