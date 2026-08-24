// Loyalty Wallet core — treated as a financial ledger.
//
// Rules of the house:
//  * A wallet's available balance is ONLY ever changed by postLedger().
//  * Every movement writes a LoyaltyTransaction with balance_before/after,
//    a reason, an actor and (for reversals) the original transaction id.
//  * Every movement carries an idempotency key, so retries, double submits and
//    repeated webhooks can never double-spend or double-award.
//  * A wallet can never go negative, and a blocked wallet cannot earn or spend.

export const TX = {
  REWARD: 'PURCHASE_REWARD',
  REDEEM: 'REDEMPTION',
  CREDIT: 'ADMIN_CREDIT',
  DEBIT: 'ADMIN_DEBIT',
  REFUND: 'REFUND',
  RETURN_REVERSAL: 'RETURN_REVERSAL',
  CANCEL_REVERSAL: 'CANCELLATION_REVERSAL',
  EXPIRED: 'EXPIRED',
  ADJUSTMENT: 'ADJUSTMENT',
};

// When earned points become spendable. Stored as a number so it lives in Setting.
export const AWARD_STAGE = { PLACED: 0, PAID: 1, CONFIRMED: 2, DELIVERED: 3 };

export const LOYALTY_DEFAULTS = {
  loyalty_earn_rate: 1,            // points earned per currency unit
  loyalty_redeem_rate: 0.1,        // currency value of one point
  loyalty_min_order: 0,            // min order subtotal to earn
  loyalty_min_redeem: 0,           // min points per redemption
  loyalty_max_redeem_percent: 100, // max % of order payable with points
  loyalty_max_redeem_value: 0,     // max currency value per order (0 = no cap)
  loyalty_expiry_days: 0,          // 0 = points never expire
  loyalty_award_stage: 3,          // 0 placed / 1 paid / 2 confirmed / 3 delivered
  loyalty_earn_on_delivery_fee: 0, // 1 = delivery fee earns points
  loyalty_earn_on_discounted: 1,   // 0 = discounted orders earn nothing
  loyalty_redeem_with_discount: 1, // 0 = points can't combine with a promo code
  loyalty_redeem_delivery: 0,      // 0 = points may not cover the delivery fee
};

export const LOYALTY_SETTING_KEYS = Object.keys(LOYALTY_DEFAULTS);

const CLOSED_STATUSES = ['cancelled', 'returned', 'return_approved', 'failed_delivery'];
const CONFIRMED_STATUSES = ['confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'];

const round2 = (n) => Math.round(n * 100) / 100;

export async function loadLoyaltySettings(base44) {
  const settings = { ...LOYALTY_DEFAULTS };
  let legacyAwardOnDelivery = null;
  try {
    const rows = await base44.asServiceRole.entities.Setting.list();
    (rows || []).forEach((r) => {
      if (!r || r.value === null || r.value === undefined) return;
      if (r.key in settings) settings[r.key] = Number(r.value);
      if (r.key === 'loyalty_award_on_delivery') legacyAwardOnDelivery = Number(r.value);
    });
  } catch {
    // fall back to defaults
  }
  // Stores configured before the award-stage setting existed keep their behaviour.
  const hasStage = settings.loyalty_award_stage !== LOYALTY_DEFAULTS.loyalty_award_stage;
  if (!hasStage && legacyAwardOnDelivery !== null) {
    settings.loyalty_award_stage = legacyAwardOnDelivery ? AWARD_STAGE.DELIVERED : AWARD_STAGE.PLACED;
  }
  return settings;
}

// `status` is the source of truth; `frozen` is only read for wallets created
// before statuses existed (and is kept in sync so old code paths stay correct).
export const isWalletBlocked = (wallet) =>
  wallet.status ? wallet.status !== 'active' : !!wallet.frozen;

// Human-readable wallet id (LW-000152). Sequential, padded, unique enough for
// display; the record id remains the real primary key.
async function nextWalletCode(base44) {
  try {
    const all = await base44.asServiceRole.entities.LoyaltyAccount.list('-created_date', 500);
    return `LW-${String((all || []).length + 1).padStart(6, '0')}`;
  } catch {
    return `LW-${String(Date.now()).slice(-6)}`;
  }
}

// Every customer owns exactly one wallet, created on first touch and then
// permanently linked to that email/customer id.
export async function getOrCreateWallet(base44, user) {
  const rows = await base44.asServiceRole.entities.LoyaltyAccount.filter({ user_email: user.email });
  if (rows && rows.length) {
    const wallet = rows[0];
    const patch = {};
    if (!wallet.wallet_code) patch.wallet_code = await nextWalletCode(base44);
    if (!wallet.status) patch.status = wallet.frozen ? 'frozen' : 'active';
    else if (!!wallet.frozen !== (wallet.status !== 'active')) patch.frozen = wallet.status !== 'active';
    if (!wallet.user_id && user.id) patch.user_id = user.id;
    if (Object.keys(patch).length) {
      await base44.asServiceRole.entities.LoyaltyAccount.update(wallet.id, patch);
      return { ...wallet, ...patch };
    }
    return wallet;
  }
  return await base44.asServiceRole.entities.LoyaltyAccount.create({
    wallet_code: await nextWalletCode(base44),
    user_id: user.id || '',
    user_email: user.email,
    user_name: user.full_name || '',
    user_phone: user.phone || '',
    balance: 0,
    pending_points: 0,
    lifetime_earned: 0,
    lifetime_spent: 0,
    lifetime_removed: 0,
    expired_points: 0,
    status: 'active',
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

// The one and only way the available balance changes.
export async function postLedger(base44, {
  wallet, points, type, reason, order_id, actor_email,
  idempotency_key, expires_at, reference_transaction_id,
}) {
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
  const spent = wallet.lifetime_spent || 0;
  if (type === TX.REWARD || type === TX.CREDIT || (delta > 0 && type === TX.ADJUSTMENT)) {
    patch.lifetime_earned = (wallet.lifetime_earned || 0) + delta;
  } else if (type === TX.REDEEM) {
    patch.lifetime_spent = spent + -delta;
  } else if (type === TX.REFUND || type === TX.CANCEL_REVERSAL) {
    // Returning spent points: undo the redemption total rather than count as earned.
    patch.lifetime_spent = Math.max(0, spent - delta);
  } else if (type === TX.EXPIRED) {
    patch.expired_points = (wallet.expired_points || 0) + -delta;
    patch.lifetime_removed = (wallet.lifetime_removed || 0) + -delta;
  } else if (delta < 0) {
    patch.lifetime_removed = (wallet.lifetime_removed || 0) + -delta;
    if (type === TX.RETURN_REVERSAL) {
      patch.lifetime_earned = Math.max(0, (wallet.lifetime_earned || 0) - -delta);
    }
  }

  await base44.asServiceRole.entities.LoyaltyAccount.update(wallet.id, patch);
  const transaction = await base44.asServiceRole.entities.LoyaltyTransaction.create({
    account_id: wallet.id,
    wallet_code: wallet.wallet_code || '',
    user_id: wallet.user_id || '',
    user_email: wallet.user_email,
    points: delta,
    type,
    status: 'completed',
    reason: reason || '',
    order_id: order_id || '',
    reference_transaction_id: reference_transaction_id || '',
    balance_before: before,
    balance_after: after,
    actor_email: actor_email || '',
    idempotency_key: idempotency_key || '',
    expires_at: expires_at || '',
  });
  return { skipped: false, wallet: { ...wallet, ...patch }, transaction };
}

// Pending points live outside the spendable balance until the order reaches the
// configured award stage, so cancelled/returned orders never pay out.
export async function setPending(base44, wallet, delta) {
  const next = Math.max(0, (wallet.pending_points || 0) + Math.trunc(delta));
  await base44.asServiceRole.entities.LoyaltyAccount.update(wallet.id, { pending_points: next });
  return { ...wallet, pending_points: next };
}

// Products (or whole categories) can be excluded from earning points.
export async function loadExemptProductIds(base44) {
  try {
    const rows = await base44.asServiceRole.entities.Product.filter({ loyalty_exempt: true });
    return new Set((rows || []).map((p) => p.id));
  } catch {
    return new Set();
  }
}

// Points an order should earn under the current rules (0 when excluded).
// Only line items from eligible products count toward the reward.
export function earnableForOrder(settings, order, exemptIds = new Set()) {
  const subtotal = Number(order.subtotal) || 0;
  if (order.payment_method === 'loyalty') return 0;
  if (subtotal < (settings.loyalty_min_order || 0)) return 0;
  const discount = (Number(order.discount_amount) || 0) + (Number(order.loyalty_discount) || 0);
  if (!settings.loyalty_earn_on_discounted && discount > 0) return 0;

  const items = Array.isArray(order.items) ? order.items : [];
  let eligible = subtotal;
  if (items.length && exemptIds.size) {
    eligible = items.reduce((sum, it) => {
      if (exemptIds.has(it.id)) return sum;
      return sum + (Number(it.price) || 0) * (Number(it.qty) || 0);
    }, 0);
  }
  if (!(eligible > 0)) return 0;

  // Discounts reduce the reward proportionally to the eligible share of the cart.
  const share = subtotal > 0 ? Math.min(1, eligible / subtotal) : 1;
  let base = eligible - discount * share;
  if (settings.loyalty_earn_on_delivery_fee) base += Number(order.delivery_cost) || 0;
  if (!(base > 0)) return 0;
  return Math.floor(base * (settings.loyalty_earn_rate || 0));
}

// Has the order reached the stage at which points become spendable?
export function reachedAwardStage(settings, order) {
  const stage = Number(settings.loyalty_award_stage);
  if (stage === AWARD_STAGE.PLACED) return true;
  if (stage === AWARD_STAGE.PAID) return order.payment_status === 'paid';
  if (stage === AWARD_STAGE.CONFIRMED) return CONFIRMED_STATUSES.includes(order.status);
  return order.status === 'delivered';
}

export const isOrderClosed = (order) => CLOSED_STATUSES.includes(order.status);

export function expiryDate(settings) {
  const days = Number(settings.loyalty_expiry_days) || 0;
  if (!days) return '';
  return new Date(Date.now() + days * 86400000).toISOString();
}