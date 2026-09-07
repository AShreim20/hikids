import { useSyncExternalStore } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { getStickyBarHeight, subscribeStickyBarHeight } from '@/lib/stickyBarStore';

// One shared vertical rhythm for every floating support control (the
// assistant button, the WhatsApp button, and the assistant panel) instead of
// each carrying its own hand-tuned, independent offset. `slot` is the stack
// position counting up from the bottom-most button — 0 is closest to the
// screen edge, 1 sits one circle-height above it, and so on.
//
// The base clears the mobile bottom nav (or, on desktop, just a comfortable
// margin); env(safe-area-inset-bottom) clears notch/home-indicator devices;
// and — the actual point of this hook — `stickyBarHeight` (read live from
// stickyBarStore) adds however tall the current page's own sticky purchase
// bar actually renders at, so these controls sit just above it instead of
// overlapping it. Pages with no sticky bar report 0, so nothing changes
// there.
const CIRCLE = 56; // px — one consistent w-14/h-14 touch target everywhere now
const STACK_GAP = 12; // px between stacked circles
const MOBILE_BASE = 80; // px — clears MobileNav
const DESKTOP_BASE = 24; // px

export function useFloatingOffset(slot = 0) {
  const isMobile = useIsMobile();
  const stickyBarHeight = useSyncExternalStore(subscribeStickyBarHeight, getStickyBarHeight);
  const base = isMobile ? MOBILE_BASE : DESKTOP_BASE;
  const bottomPx = base + slot * (CIRCLE + STACK_GAP) + stickyBarHeight;
  return {
    bottomPx,
    bottom: `calc(${bottomPx}px + env(safe-area-inset-bottom))`,
  };
}
