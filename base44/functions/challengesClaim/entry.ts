import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { grantPoints, grantDiscountCode, recordReward } from '../../shared/rewards.ts';
import { inWindow, getOrCreateProgress } from '../../shared/challenges.ts';

const CLOSED = ['cancelled', 'returned', 'return_approved', 'failed_delivery'];

function withinFrequency(progress, challenge, now) {
  const last = progress.last_completed_at ? new Date(progress.last_completed_at) : null;
  const rewarded = progress.rewarded_count || 0;
  switch (challenge.frequency) {
    case 'unlimited': return true;
    case 'custom': return rewarded < (challenge.limit_count || 1);
    case 'daily': return !last || (now - last) > 86400000;
    case 'weekly': return !last || (now - last) > 7 * 86400000;
    case 'monthly': return !last || (now - last) > 30 * 86400000;
    case 'once':
    default: return rewarded < 1;
  }
}

// Compute how many un-rewarded completions the customer currently has for the
// challenge's requirement. Purchase-tied types consume one qualifying order
// per claim so the same order can never pay out twice.
async function availableCompletions(base44, challenge, progress, user) {
  const orders = await base44.asServiceRole.entities.Order.filter({ created_by_id: user.id });
  const valid = (orders || []).filter((o) => !CLOSED.includes(o.status));
  const rewardedIds = new Set(progress.rewarded_order_ids || []);
  const t = challenge.target || {};
  switch (challenge.type) {
    case 'product_purchase': {
      const pid = t.product_id;
      if (!pid) return 0;
      return valid.filter((o) => (Array.isArray(o.items) ? o.items.some((it) => it.id === pid) : false) && !rewardedIds.has(o.id)).length;
    }
    case 'spend_amount': {
      const amt = Number(t.amount) || 0;
      return valid.filter((o) => (Number(o.subtotal) || 0) >= amt && !rewardedIds.has(o.id)).length;
    }
    case 'purchase_count': {
      const count = Number(t.count) || 0;
      const total = Math.floor(valid.length / Math.max(1, count));
      return Math.max(0, total - (progress.rewarded_count || 0));
    }
    case 'share': {
      const need = Number(t.share_count) || 0;
      return (progress.recipients || []).length >= need ? 1 : 0;
    }
    default:
      return 0;
  }
}

async function consumeOrder(base44, challenge, progress, user) {
  const orders = await base44.asServiceRole.entities.Order.filter({ created_by_id: user.id });
  const valid = (orders || []).filter((o) => !CLOSED.includes(o.status));
  const rewardedIds = new Set(progress.rewarded_order_ids || []);
  const t = challenge.target || {};
  if (challenge.type === 'product_purchase') {
    const o = valid.find((o) => o.items && o.items.some((it) => it.id === t.product_id) && !rewardedIds.has(o.id));
    return o ? o.id : null;
  }
  if (challenge.type === 'spend_amount') {
    const o = valid.find((o) => (Number(o.subtotal) || 0) >= Number(t.amount) && !rewardedIds.has(o.id));
    return o ? o.id : null;
  }
  return null;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, message: 'Auth required' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const challengeId = String(body.challenge_id || '');
    if (!challengeId) return Response.json({ success: false, message: 'challenge_id required' }, { status: 400 });

    const challenge = await base44.asServiceRole.entities.Challenge.get(challengeId).catch(() => null);
    if (!challenge) return Response.json({ success: false, message: 'Challenge not found' }, { status: 404 });
    if (!challenge.active || !inWindow(challenge)) return Response.json({ success: false, message: 'Challenge is not active' });
    if (challenge.type === 'photo_upload') return Response.json({ success: false, message: 'Submit a photo for this challenge' });
    if (challenge.type === 'custom') return Response.json({ success: false, message: 'This challenge is completed manually by the store' });

    const progress = await getOrCreateProgress(base44, challengeId, user);
    const now = new Date();
    if (!withinFrequency(progress, challenge, now)) {
      return Response.json({ success: false, message: 'Already completed for this period' });
    }
    const avail = await availableCompletions(base44, challenge, progress, user);
    if (avail <= 0) return Response.json({ success: false, message: 'Requirement not met yet' });

    const newRewarded = (progress.rewarded_count || 0) + 1;
    let discountCode = '';
    let points = 0;
    let fulfillment = 'auto';
    const rewardLabel = challenge.reward_label || (challenge.reward_type === 'points' ? `+${challenge.reward_value} points` : challenge.name);

    if (challenge.reward_type === 'points') {
      points = Math.trunc(Number(challenge.reward_value) || 0);
      await grantPoints(base44, user, points, `Challenge: ${challenge.name}`, `chl-${challengeId}-${user.id}-${newRewarded}`);
    } else if (challenge.reward_type === 'discount_percent' || challenge.reward_type === 'discount_fixed' || challenge.reward_type === 'credit') {
      const type = challenge.reward_type === 'discount_percent' ? 'percent' : 'fixed';
      discountCode = await grantDiscountCode(base44, { prefix: challenge.reward_code_prefix || 'CHL', type, value: challenge.reward_value, expires_at: challenge.end_date });
    } else {
      // free_delivery / product — recorded for manual fulfillment by the store.
      fulfillment = 'manual';
    }

    const patch = {
      rewarded_count: newRewarded,
      completions: (progress.completions || 0) + 1,
      last_completed_at: now.toISOString(),
    };
    if (challenge.type === 'product_purchase' || challenge.type === 'spend_amount') {
      const orderId = await consumeOrder(base44, challenge, progress, user);
      if (orderId) patch.rewarded_order_ids = [...(progress.rewarded_order_ids || []), orderId];
    }
    await base44.asServiceRole.entities.ChallengeProgress.update(progress.id, patch);

    await recordReward(base44, {
      user_id: user.id, user_email: user.email, source: 'challenge', source_id: challengeId,
      source_name: challenge.name, source_name_en: challenge.name_en || '',
      reward_type: challenge.reward_type, reward_label: rewardLabel,
      reward_label_en: challenge.reward_label_en || '',
      points, discount_code: discountCode, product_id: challenge.product_id || '',
      amount: challenge.reward_type === 'credit' ? Number(challenge.reward_value) || 0 : 0,
      fulfillment,
    });

    return Response.json({ success: true, reward_type: challenge.reward_type, reward_label: rewardLabel, points, discount_code, fulfillment });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}