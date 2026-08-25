import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { computeWheelState, weightedPick, grantPoints, grantDiscountCode, recordReward } from '../../shared/rewards.ts';

// Consumes one available spin, runs the weighted random pick server-side, and
// grants the resulting reward. Creating exactly one WheelSpin row per call is
// what makes a spin non-replayable — combined with the available-spin check,
// one purchase can never unlock unlimited spins.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, message: 'Auth required' }, { status: 401 });

    const state = await computeWheelState(base44, user);
    if (!state.active) return Response.json({ success: false, message: 'Wheel is not active' });
    if (state.available <= 0) return Response.json({ success: false, message: 'No spins available' });
    if (state.config.max_spins > 0 && state.used >= state.config.max_spins) {
      return Response.json({ success: false, message: 'Maximum spins reached' });
    }

    const rewards = await base44.asServiceRole.entities.WheelReward.filter({ active: true });
    const pool = (rewards || []).filter((r) => Number(r.weight) > 0);
    if (!pool.length) return Response.json({ success: false, message: 'No rewards configured' });
    const picked = weightedPick(pool);

    let points = 0;
    let discountCode = '';
    let fulfillment = 'auto';
    if (picked.type === 'points') {
      points = Math.trunc(Number(picked.value) || 0);
      await grantPoints(base44, user, points, 'Mystery Wheel reward', `wheel-${user.id}-${Date.now()}`);
    } else if (picked.type === 'discount_percent' || picked.type === 'discount_fixed' || picked.type === 'credit') {
      const type = picked.type === 'discount_percent' ? 'percent' : 'fixed';
      discountCode = await grantDiscountCode(base44, { prefix: 'WHL', type, value: picked.value });
    } else {
      // free_delivery / product — recorded for manual fulfillment.
      fulfillment = 'manual';
    }

    const spin = await base44.asServiceRole.entities.WheelSpin.create({
      user_id: user.id || '', user_email: user.email, source: 'purchase',
      reward_id: picked.id, reward_type: picked.type, reward_label: picked.label,
      reward_value: Number(picked.value) || 0, product_id: picked.product_id || '',
      points_awarded: points, discount_code: discountCode, fulfillment,
    });

    await base44.asServiceRole.entities.WheelProgress.update(state.progress.id, {
      spins_used: (state.progress.spins_used || 0) + 1,
      last_activity_at: new Date().toISOString(),
    });

    await recordReward(base44, {
      user_id: user.id, user_email: user.email, source: 'wheel', source_id: spin.id,
      source_name: state.config.name || 'Mystery Wheel',
      reward_type: picked.type, reward_label: picked.label,
      points, discount_code: discountCode, product_id: picked.product_id || '',
      amount: picked.type === 'credit' ? Number(picked.value) || 0 : 0, fulfillment,
    });

    return Response.json({
      success: true,
      reward: { id: picked.id, label: picked.label, type: picked.type, value: picked.value, points, discount_code: discountCode, fulfillment },
    });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}