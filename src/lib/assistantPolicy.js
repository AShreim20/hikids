import { RETURN_WINDOW_DAYS } from '@/lib/returns';

// Builds the "STORE FACTS" block the shopping assistant is allowed to quote.
// Everything here comes from the live site configuration (Return Reason
// policies, delivery cities, settings) or the same constants the site itself
// enforces -- nothing is written from general knowledge. Anything not listed
// must be answered with "I can't confirm that" plus the relevant page.
const RESPONSIBILITY = {
  hikids: 'HiKids covers the return delivery',
  customer: 'the customer covers the return delivery',
  manual_review: 'delivery responsibility is decided after review',
};

export function buildStoreFacts({ reasons = [], cities = [], settings = {}, lang = 'ar' }) {
  const s = (k) => (settings[k] === undefined || settings[k] === null ? null : Number(settings[k]));
  const nameOf = (r) => (lang === 'ar' ? r.name : (r.name_en || r.name));

  const reasonLines = reasons.filter((r) => r.active !== false).map((r) => {
    const allows = [r.allow_return && 'return', r.allow_exchange && 'exchange', r.allow_missing_item && 'missing item', r.allow_missing_part && 'missing part'].filter(Boolean).join('/') || 'none';
    const evidence = r.evidence_required ? `photos required (min ${r.evidence_min_images || 1})` : 'no photos required';
    const undamaged = r.requires_undamaged_return ? 'item must be returned undamaged' : 'no undamaged-condition requirement';
    return `- ${nameOf(r)}: allows ${allows}; ${evidence}; ${undamaged}; ${RESPONSIBILITY[r.delivery_responsibility] || 'delivery responsibility not specified'}`;
  }).join('\n') || '- (no reasons available right now)';

  const cityLines = cities.filter((c) => c.active !== false).map((c) => `- ${c.name}: ₪${c.price}`).join('\n') || '- (delivery prices unavailable right now)';

  const payments = [
    s('visa_payment_enabled') === 0 ? null : 'card',
    'cash on delivery',
    'loyalty points',
  ].filter(Boolean).join(', ');

  const loyalty = [
    s('loyalty_earn_rate') !== null && `earn rate: ${s('loyalty_earn_rate')} point(s) per ₪1 of eligible merchandise`,
    s('loyalty_redeem_rate') !== null && `redeem value: ₪${s('loyalty_redeem_rate')} per point`,
    s('loyalty_min_redeem') && `minimum to redeem: ${s('loyalty_min_redeem')} points`,
    s('loyalty_min_order') && `minimum order to earn: ₪${s('loyalty_min_order')}`,
    s('loyalty_expiry_days') ? `points expire after ${s('loyalty_expiry_days')} days` : 'no expiry configured',
  ].filter(Boolean).join('; ');

  return `STORE FACTS (the ONLY HiKids-specific information you may state; they come from the live site configuration):
- HiKids is an ONLINE store only. There are no physical branches or shops. Never mention visiting a store.
- Payment methods available: ${payments}.
- Delivery prices by city:
${cityLines}
- Delivery time / shipping duration: NOT available to you.
- Returns & Exchanges: the request window is ${RETURN_WINDOW_DAYS} days counted from the actual delivery date of the order. Customers sign in, open My Orders (/orders), pick the delivered order and use its Return/Exchange Request button; they follow requests under /returns. Conditions, photo evidence and who pays delivery depend on the reason chosen. Current reasons and their policies:
${reasonLines}
- Loyalty points: ${loyalty || 'settings unavailable'}. Points from a delivered order stay pending until the ${RETURN_WINDOW_DAYS}-day return window closes (or any open return is resolved); details at /loyalty.
- HiKids Wallet: holds ₪ store credit (for example from approved returns); it is separate from loyalty points; balance at /wallet.
- Mystery Wheel: spins are earned from purchases and rewards are shown at /wheel; you do not know the exact current rules.
- Order status: My Orders (/orders). Help/contact: /contact and /faq.

STRICT RULES ABOUT HIKIDS INFORMATION:
- For returns, exchanges, delivery, payments, loyalty, Wallet, Mystery Wheel, discounts, orders, availability or any policy, use ONLY the STORE FACTS and the product catalog below.
- NEVER invent or guess a duration, price, condition, procedure, branch/store, phone/email or policy, and never use general knowledge about how other stores work.
- If the answer is not in the STORE FACTS, say clearly that you cannot confirm it and point the customer to the relevant page (My Orders /orders, Returns /returns, Wallet /wallet, Loyalty /loyalty, Wheel /wheel, FAQ /faq, Contact /contact). Do not guess.`;
}
