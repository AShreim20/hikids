import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { computeWheelState } from '../../shared/rewards.ts';

// Read-only: returns the customer's current wheel progress + available spins.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, message: 'Auth required' }, { status: 401 });
    const state = await computeWheelState(base44, user);
    const rewards = await base44.asServiceRole.entities.WheelReward.filter({ active: true });
    return Response.json({ success: true, ...state, rewards: rewards || [] });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}