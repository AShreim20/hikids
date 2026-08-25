import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { computeWheelState, weightedPick, grantPoints, grantDiscountCode, recordReward } from '../../shared/rewards.ts';

// Grants the first-time free spin to the calling customer, exactly once per
// account. Whether the customer is "new" can be restricted by the admin.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, message: 'Auth required' }, { status: 401 });
    const state = await computeWheelState(base44, user);
    if (!state.active) return Response.json({ success: false, message: 'Wheel is not active' });
    const config = state.config;
    if (!config.first_time_enabled) return Response.json({ success: false, message: 'First-time spin is disabled' });
    if (state.progress.free_spin_granted) return Response.json({ success: false, message: 'Free spin already claimed' });
    if (config.first_time_new_only && config.start_date) {
      const created = new Date(user.created_date || 0);
      if (created < new Date(config.start_date)) return Response.json({ success: false, message: 'Free spin is for new customers only' });
    }
    await base44.asServiceRole.entities.WheelProgress.update(state.progress.id, {
      free_spin_granted: true,
      spins_earned: (state.progress.spins_earned || 0) + 1,
      last_activity_at: new Date().toISOString(),
    });
    await recordReward(base44, {
      user_id: user.id, user_email: user.email, source: 'firsttime', source_name: config.name || 'Mystery Wheel',
      reward_type: 'free_spin', reward_label: 'Free Mystery Wheel Spin', points: 0, fulfillment: 'auto',
    });
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}