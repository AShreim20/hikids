import { REDEEM_RATE, pointsToValue } from '@/lib/loyalty';
import { toUnits } from '@/lib/wheelProbability';

// Rough cost to the store (₪) of ONE win of a reward. It is an upper-bound
// style estimate for the admin dashboard — not accounting:
//   points           → the points' redeem value (1000 points = ₪50)
//   discount_fixed / credit → the amount (assumes the code gets used)
//   discount_percent → the percentage of a typical basket, taken as the
//                      wheel's "spend per spin" amount
//   free_delivery    → the delivery amount it covers
//   product          → the product's unit cost (its price when no cost is set)
export function rewardCost(reward, { minAmount = 0, productCosts = {}, pointRate = REDEEM_RATE } = {}) {
  const value = Number(reward.value) || 0;
  switch (reward.type) {
    case 'points': return pointsToValue(value, pointRate);
    case 'discount_fixed':
    case 'credit':
    case 'free_delivery': return value;
    case 'discount_percent': return (value / 100) * (Number(minAmount) || 0);
    case 'product': {
      const c = productCosts[reward.product_id];
      return c == null ? null : c;
    }
    default: return 0;
  }
}

// Average cost of one spin = Σ (share of spins won × cost of that reward),
// over the ACTIVE rewards, with shares taken from their appearance
// probabilities (re-based to 100% so a half-edited draft still shows a number).
export function expectedSpinCost(rewards, ctx) {
  const active = rewards.filter((r) => r.active);
  const totalUnits = active.reduce((s, r) => s + toUnits(r.probability_percent), 0);
  if (totalUnits <= 0) return { expected: 0, unknown: 0, perReward: {} };
  let expected = 0;
  let unknown = 0;
  const perReward = {};
  active.forEach((r) => {
    const cost = rewardCost(r, ctx);
    perReward[r._key || r.id] = cost;
    if (cost == null) { unknown += 1; return; }
    expected += (toUnits(r.probability_percent) / totalUnits) * cost;
  });
  return { expected, unknown, perReward };
}
