// Shared visual recipe for the Header's top-level nav triggers (Home, Shop,
// My Orders, Rewards) — desktop only. Centralized so their hover/active/
// open/focus states can't drift out of sync across files the way they had
// (Shop showing the browser's default focus rectangle, Rewards using a
// different active color with no open-state at all).
//
// `active` = current page matches this trigger's route(s).
// `open` = this trigger's dropdown panel is currently open (Shop/Rewards
// only — plain links like Home/My Orders never pass this).
export function navTriggerClass({ active = false, open = false } = {}) {
  const base =
    'inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60';
  const color = active ? 'text-accent' : 'text-white/85 hover:text-accent';
  const bg = open ? 'bg-white/10' : 'hover:bg-white/10';
  return `${base} ${color} ${bg}`;
}
