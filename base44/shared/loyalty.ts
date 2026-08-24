// Shared loyalty-wallet core: settings, wallet lookup, redemption rules and the
// transaction ledger. Every balance change MUST go through postLedger so each
// movement is traceable, idempotent and can never drive a wallet negative.

export const LOYALTY_DEFAULTS = {
  loyalty_earn_rate: 1,            // points earned per currency unit
  loyalty_redeem_rate: 0.1,        // currency value of one point
  loyalty_min_order: 0,            // min order subtotal to earn
  loyalty_min_redeem: 0,           // min points per redemption
  loyalty_max_redeem_percent: 100, // max % of order payable with points
  loyalty_max_redeem_value: 0,     // max currency value per order (0 = no cap)
  loyalty_expiry_days: 0,          // 0 = points never expire
  loyalty_award_on_delivery: 1,    // 1 = award only once delivered
  loyalty_earn_on_delivery_fee: 0, // 1 = delivery fee earns points
  loyalty_earn_on_discounted: 1,   // 0 = discounted orders earn nothing
  loyalty_redeem_with_discount: 1, // 0 = points can't combine with a promo code
  loyalty_redeem_delivery: 1,      // 1 = points may cover the delivery fee
};

export const LOYALTY_SETTING_KEYS = Object.keys(LOYALTY_DEFAULTS);

const round2 = (n) => Math.round(n * 100) / 100;

export async function loadLoyaltySettings(base44) {
  const settings = { ...LOYALTY_DEFAULTS };
  try {
    const rows = await base44.asServiceRole.entities.Setting.list();
    (rows || []).forEach((r) => {
      if (r && r.key in settings && r.value !== null && r.value !== undefined) {
        settings[r.key] = Number(r.value);
      }
    });
  } catch {
    // fall back to defaults
  }
  return settings;
}

// Returns the customer's wallet, creating it on first touch so every customer
// effectively owns a wallet from their first interaction.
export async function getOrCreateWallet(base44, user) {
  const rows = await base44.asServiceRole.entities.LoyaltyAccount.filter({ user_email: user.email });
  if (rows && rows.length) return rows[0];
  return await base44.asServiceRole.entities.LoyaltyAccount.create({
    user_id: user.id,
    user_email: user.email,
    user_name: user.full_name || '',
    balance: 0,
    lifetime_earned: 0,
    lifetime_spent: 0,
    lifetime_removed: 0,
    expired_points: 0,
    frozen: false,
  });
}

// Maximum points/value redeemable on a given order under the current rules.
export function maxRedeemable(settings, { subtotal = 0, delivery_cost = 0, discount_amount = 0 }) {
  const rate = settings.loyalty_redeem_rate || LOYALTY_DEFAULTS.loyalty_redeem_rate;
  let base = Number(subtotal) - Number(discount_amount);
  if (settings.loyalty_redeem_delivery) base += Number(delivery_cost);
  if (!(base > 0)) return { max_amount: 0, max_points: 0, rate };
  let cap = base * ((settings.loyalty_max_redeem_percent || 100) / 100);
  if (settings.loyalty_max_redeem_value > 0) cap = Math.min(cap, settings.loyalty_max_redeem_value);
  cap = Math.min(cap, base);
  return { max_amount: round2(cap), max_points: Math.floor(cap / rate), rate };
}

// Appends a ledger entry and applies it to the wallet totals atomically enough
// for our purposes: the idempotency key blocks duplicates (double-spend, retried
// awards) and a negative resulting balance is rejected outright.
export async function postLedger(base44, { wallet, points, type, reason, order_id, actor_email, idempotency_key, expires_at }) {
  const delta = Math.trunc(Number(points) || 0);
  if (!delta) return { skipped: true, wallet };

  if (idempotency_key) {
    const dupes = await base44.asServiceRole.entities.LoyaltyTransaction.filter({ idempotency_key });
    if (dupes && dupes.length) return { skipped: true, duplicate: true, wallet, transaction: dupes[0] };
  }

  const before = wallet.balance || 0;
  const after = before + delta;
  if (after < 0) {
    const err = new Error('Insufficient points');
    err.code = 'insufficient';
    throw err;
  }

  const patch = { balance: after, last_activity_at: new Date().toISOString() };
  if (delta > 0) patch.lifetime_earned = (wallet.lifetime_earned || 0) + delta;
  else if (type === 'redeem') patch.lifetime_spent = (wallet.lifetime_spent || 0) + -delta;
  else if (type === 'expire') {
    patch.expired_points = (wallet.expired_points || 0) + -delta;
    patch.lifetime_removed = (wallet.lifetime_removed || 0) + -delta;
  } else patch.lifetime_removed = (wallet.lifetime_removed || 0) + -delta;

  await base44.asServiceRole.entities.LoyaltyAccount.update(wallet.id, patch);
  const transaction = await base44.asServiceRole.entities.LoyaltyTransaction.create({
    account_id: wallet.id,
    user_id: wallet.user_id || '',
    user_email: wallet.user_email,
    points: delta,
    type,
    reason: reason || '',
    order_id: order_id || '',
    balance_before: before,
    balance_after: after,
    actor_email: actor_email || '',
    idempotency_key: idempotency_key || '',
    expires_at: expires_at || '',
  });
  return { skipped: false, wallet: { ...wallet, ...patch }, transaction };
}

// Points an order should earn under the current rules (0 when excluded).
export function earnableForOrder(settings, order) {
  const subtotal = Number(order.subtotal) || 0;
  if (order.payment_method === 'loyalty') return 0;
  if (subtotal < (settings.loyalty_min_order || 0)) return 0;
  if (!settings.loyalty_earn_on_discounted && (Number(order.discount_amount) > 0 || Number(order.loyalty_discount) > 0)) return 0;
  let base = subtotal - (Number(order.discount_amount) || 0) - (Number(order.loyalty_discount) || 0);
  if (settings.loyalty_earn_on_delivery_fee) base += Number(order.delivery_cost) || 0;
  if (!(base > 0)) return 0;
  return Math.floor(base * (settings.loyalty_earn_rate || 0));
}

export function expiryDate(settings) {
  const days = Number(settings.loyalty_expiry_days) || 0;
  if (!days) return '';
  return new Date(Date.now() + days * 86400000).toISOString();
}