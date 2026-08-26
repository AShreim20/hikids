// Shared reward + gamification helpers for Challenges and the Mystery Wheel.
// All eligibility/limit checks here run server-side (functions use the service
// role), so the frontend can never grant a reward by itself.
import { getOrCreateWallet, postLedger, TX } from './loyalty.ts';

const CLOSED = ['cancelled', 'returned', 'return_approved', 'failed_delivery'];

// Credit loyalty points to a customer's wallet. Idempotent — a duplicate
// idempotency_key is a no-op (postLedger dedups on the ledger).
export async function grantPoints(base44, user, points, reason, idempotency_key) {
  const wallet = await getOrCreateWallet(base44, user);
  const res = await postLedger(base44, {
    wallet,
    points: Math.trunc(Number(points) || 0),
    type: TX.CREDIT,
    reason: reason || 'Gamification reward',
    actor_email: 'rewards',
    idempotency_key,
  });
  return res;
}

// Mint a single-use discount code the customer can apply at checkout. The code
// can be bound to a specific customer + wheel spin so it can't be transferred
// or reused. Returns the full created record (use .code for the string).
export async function grantDiscountCodeRecord(base44, {
  prefix, type, value, expires_at, owner_email, wheel_spin_id, source, description,
}) {
  const code = `${prefix || 'RW'}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  return base44.asServiceRole.entities.DiscountCode.create({
    code,
    type: type === 'percent' ? 'percent' : 'fixed',
    value: Number(value) || 0,
    usage_limit: 1,
    used_count: 0,
    active: true,
    expires_at: expires_at || '',
    owner_email: owner_email || '',
    wheel_spin_id: wheel_spin_id || '',
    source: source || 'admin',
    description: description || '',
  });
}

// Back-compat wrapper: returns just the code string (challenges still use this).
export async function grantDiscountCode(base44, opts) {
  const rec = await grantDiscountCodeRecord(base44, opts);
  return rec.code;
}

// Expiry timestamp for a newly-granted reward, based on the wheel config.
export function rewardExpiresAt(config) {
  const days = Number(config && config.reward_expiry_days) || 0;
  return days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : '';
}

// Has a specific reward (not the spin itself) passed its expiry?
export function isRewardExpired(spin) {
  if (!spin || !spin.expires_at) return false;
  return new Date(spin.expires_at) < new Date();
}

// Append a single, deduplicated row to the customer's reward history.
export async function recordReward(base44, entry) {
  return base44.asServiceRole.entities.RewardHistory.create({
    user_id: entry.user_id || '',
    user_email: entry.user_email,
    source: entry.source,
    source_id: entry.source_id || '',
    source_name: entry.source_name || '',
    source_name_en: entry.source_name_en || '',
    reward_type: entry.reward_type,
    reward_label: entry.reward_label || '',
    reward_label_en: entry.reward_label_en || '',
    points: entry.points || 0,
    discount_code: entry.discount_code || '',
    product_id: entry.product_id || '',
    amount: entry.amount || 0,
    fulfillment: entry.fulfillment || 'auto',
  });
}

// Weighted random pick — the actual RNG runs here, on the server.
export function weightedPick(rewards) {
  const weighted = rewards.filter((r) => Number(r.weight) > 0);
  if (!weighted.length) return rewards[0];
  const total = weighted.reduce((s, r) => s + Number(r.weight), 0);
  let r = Math.random() * total;
  for (const rw of weighted) {
    r -= Number(rw.weight);
    if (r <= 0) return rw;
  }
  return weighted[weighted.length - 1];
}

export async function getWheelConfig(base44) {
  const rows = await base44.asServiceRole.entities.WheelConfig.filter({ active: true });
  return (rows && rows[0]) || null;
}

export async function getOrCreateProgress(base44, user) {
  const rows = await base44.asServiceRole.entities.WheelProgress.filter({ user_email: user.email });
  if (rows && rows.length) return rows[0];
  return base44.asServiceRole.entities.WheelProgress.create({
    user_id: user.id || '',
    user_email: user.email,
    eligible_amount: 0,
    spins_earned: 0,
    spins_used: 0,
    free_spin_granted: false,
  });
}

// Recompute the customer's wheel state from orders + spins (source of truth).
// Refunded/cancelled orders drop out automatically, so they never keep
// generating spins. Each spin is one WheelSpin row — consuming one is the only
// way to spend it, which makes double-spending impossible.
export async function computeWheelState(base44, user) {
  const config = await getWheelConfig(base44);
  if (!config) return { active: false };
  const now = new Date();
  if (config.start_date && now < new Date(config.start_date)) return { active: false, config, pending: true };
  if (config.end_date && now > new Date(config.end_date)) return { active: false, config, expired: true };

  const orders = await base44.asServiceRole.entities.Order.filter({ created_by_id: user.id });
  const valid = (orders || []).filter((o) => !CLOSED.includes(o.status));
  const min = Number(config.min_amount) || 0;

  let eligible = 0;
  let earned = 0;
  if (config.basis === 'single_order') {
    const qualifying = valid.filter((o) => (Number(o.subtotal) || 0) >= min);
    eligible = qualifying.length;
    earned = qualifying.length;
  } else if (config.basis === 'period') {
    const start = config.period_start ? new Date(config.period_start) : null;
    const end = config.period_end ? new Date(config.period_end) : null;
    const inPeriod = valid.filter((o) => {
      const d = new Date(o.created_date || o.created_at);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
    eligible = inPeriod.reduce((s, o) => s + Math.max(0, (Number(o.subtotal) || 0) - (Number(o.discount_amount) || 0) - (Number(o.loyalty_discount) || 0)), 0);
    earned = min > 0 ? Math.floor(eligible / min) : 0;
  } else {
    eligible = valid.reduce((s, o) => s + Math.max(0, (Number(o.subtotal) || 0) - (Number(o.discount_amount) || 0) - (Number(o.loyalty_discount) || 0)), 0);
    earned = min > 0 ? Math.floor(eligible / min) : 0;
  }

  const progress = await getOrCreateProgress(base44, user);
  if (progress.free_spin_granted) earned += 1;

  const spins = await base44.asServiceRole.entities.WheelSpin.filter({ user_email: user.email });
  const used = (spins || []).length;
  const available = Math.max(0, earned - used);
  const progressPct = min > 0 ? Math.min(100, Math.round((eligible % min) / min * 100)) : 100;

  return {
    active: true,
    config,
    progress,
    eligible_amount: eligible,
    min_amount: min,
    earned,
    used,
    available,
    progress_pct: progressPct,
    remaining_amount: min > 0 ? Math.max(0, min - (eligible % min)) : 0,
  };
}