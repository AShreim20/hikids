// Client-side reward/progress helpers for the gamification UI. Mirrors the
// server reward types for display only — the server remains the source of truth.

export const CLOSED_ORDER = ['cancelled', 'returned', 'return_approved', 'failed_delivery'];
export const validOrders = (orders) => (orders || []).filter((o) => !CLOSED_ORDER.includes(o.status));

export const rewardLabel = (r, ar, formatPrice) => {
  if (!r) return '';
  const v = r.reward_value ?? r.value ?? r.points ?? 0;
  switch (r.reward_type) {
    case 'points': return `+${v} ${ar ? 'نقطة' : 'pts'}`;
    case 'discount_percent': return `${v}% ${ar ? 'خصم' : 'off'}`;
    case 'discount_fixed': return `${formatPrice ? formatPrice(v) : v} ${ar ? 'خصم' : 'off'}`;
    case 'free_delivery': return ar ? 'توصيل مجاني' : 'Free delivery';
    case 'product': return ar ? 'منتج مجاني' : 'Free product';
    case 'credit': return `${formatPrice ? formatPrice(v) : v} ${ar ? 'رصيد' : 'credit'}`;
    case 'free_spin': return ar ? 'دورة مجانية' : 'Free spin';
    default: return r.reward_label || '';
  }
};

export const challengeProgress = (c, progress, orders) => {
  const prog = (progress || []).find((p) => p.challenge_id === c.id);
  const valid = validOrders(orders);
  const t = c.target || {};
  const claimed = (prog && prog.rewarded_count) || 0;
  switch (c.type) {
    case 'product_purchase': {
      const done = valid.some((o) => (o.items || []).some((it) => it.id === t.product_id));
      return { done, claimed, text: done ? (ar) => '' : '' , current: done ? 1 : 0, target: 1 };
    }
    case 'spend_amount': {
      const qualifying = valid.filter((o) => (Number(o.subtotal) || 0) >= Number(t.amount));
      return { done: qualifying.length > 0, claimed, current: qualifying.length, target: qualifying.length || 0 };
    }
    case 'purchase_count': {
      return { done: valid.length >= Number(t.count), claimed, current: valid.length, target: Number(t.count) || 0 };
    }
    case 'share': {
      const got = (prog && (prog.recipients || []).length) || 0;
      return { done: got >= Number(t.share_count), claimed, current: got, target: Number(t.share_count) || 0 };
    }
    default:
      return { done: false, claimed, current: 0, target: 0 };
  }
};