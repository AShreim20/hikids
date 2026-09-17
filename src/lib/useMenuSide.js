import { useLayoutEffect, useRef, useState } from 'react';

// Decides which logical side ('start' or 'end') a cascading submenu should
// open toward, flipping away from `preferredSide` the moment the rendered
// panel would overflow the viewport on either edge. Works the same in RTL
// and LTR since it measures the actual rendered box, not direction. Resets
// to `preferredSide` on close so the next open re-evaluates fresh rather
// than staying flipped forever.
//
// `preferredSide` lets a deeper cascade level (e.g. an Ages panel) start
// from whichever side its PARENT level (the Gender panel) actually
// resolved to, instead of always guessing 'start' fresh. Without this, two
// independent levels can each flip for their own local reason and end up
// pointing in opposite directions — the second panel folds back toward the
// first instead of continuing to cascade outward, landing the two panels
// almost on top of each other.
export function useMenuSide(open, preferredSide = 'start') {
  const ref = useRef(null);
  const [side, setSide] = useState(preferredSide);

  useLayoutEffect(() => {
    if (!open) {
      setSide(preferredSide);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth || rect.left < 0) {
      setSide((s) => (s === 'start' ? 'end' : 'start'));
    }
  }, [open, preferredSide]);

  return [ref, side];
}
