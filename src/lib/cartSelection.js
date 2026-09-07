// Resolves which cart lines actually take part in a total/checkout
// calculation, given a lineId selection. Shared by Cart.jsx (the live
// checkbox selection while browsing the cart) and Checkout.jsx (the
// selection snapshotted right before navigating here), so the two pages can
// never disagree about which items — and therefore which total — a
// customer action refers to.
//
// Selection rule ("none selected = checkout all"): a missing selection, or
// one with nothing in it, means "no filter" — resolve to the whole
// (available) cart. A non-empty selection resolves to just those lines.
// Unavailable (out-of-stock) lines are excluded either way — they're never
// charged for and can never be checked out.
export function resolveCheckoutItems(items, selection) {
  const ids = selection instanceof Set ? selection : selection ? new Set(selection) : null;
  const hasFilter = !!ids && ids.size > 0;
  return items.filter((i) => !i.unavailable && (!hasFilter || ids.has(i.lineId || i.id)));
}

// Same qty*price sum CartContext's own `total` uses — each line's `price`
// is already the final effective per-unit price (sale price, if any, is
// baked in at add-to-cart time), so no separate discount logic to reproduce
// here.
export function cartLineTotal(items) {
  return items.reduce((s, i) => s + i.qty * i.price, 0);
}
