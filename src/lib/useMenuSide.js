import { useLayoutEffect, useRef, useState } from 'react';

// Decides which logical side ('start' or 'end') a cascading submenu should
// open toward, flipping away from the default 'start' the moment the
// rendered panel would overflow the viewport on either edge. Works the same
// in RTL and LTR since it measures the actual rendered box, not direction.
// Resets to 'start' on close so the next open re-evaluates fresh rather than
// staying flipped forever.
export function useMenuSide(open) {
  const ref = useRef(null);
  const [side, setSide] = useState('start');

  useLayoutEffect(() => {
    if (!open) {
      setSide('start');
      return;
    }
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth || rect.left < 0) {
      setSide((s) => (s === 'start' ? 'end' : 'start'));
    }
  }, [open]);

  return [ref, side];
}
