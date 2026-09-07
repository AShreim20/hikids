// Centralized "is this hero slide publicly visible right now" rule — the
// single place both the public HeroCarousel and the admin status badges read
// it from, so the two can never disagree with each other.
//
// A slide is publicly eligible only when Active is true AND the current
// time is inside its optional [display_start, display_end] window. An empty
// start/end means "no restriction" on that side.
export function isSlidePubliclyVisible(slide, now = new Date()) {
  if (!slide || slide.active === false) return false;
  const t = now.getTime();
  if (slide.display_start && t < new Date(slide.display_start).getTime()) return false;
  if (slide.display_end && t > new Date(slide.display_end).getTime()) return false;
  return true;
}

// Admin-facing status, derived — never stored/selected manually.
//   'inactive'  — Active is off, regardless of schedule
//   'scheduled' — Active, but display_start is still in the future
//   'expired'   — Active, but display_end has passed
//   'active'    — Active and currently inside its window (or no window)
export function slideStatus(slide, now = new Date()) {
  if (slide.active === false) return 'inactive';
  const t = now.getTime();
  if (slide.display_start && t < new Date(slide.display_start).getTime()) return 'scheduled';
  if (slide.display_end && t > new Date(slide.display_end).getTime()) return 'expired';
  return 'active';
}
