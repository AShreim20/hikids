import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Earn/redeem rates (mirrored client-side in src/lib/loyalty.js).
const EARN_RATE = 1;
const REDEEM_RATE = 0.1;

// Returns the logged-in user's loyalty balance + rates for display/preview.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, message: 'Auth required' });
    const existing = await base44.asServiceRole.entities.LoyaltyAccount.filter({ user_email: user.email });
    const acct = existing[0];
    return Response.json({
      success: true,
      balance: acct?.balance || 0,
      lifetime_earned: acct?.lifetime_earned || 0,
      earn_rate: EARN_RATE,
      redeem_rate: REDEEM_RATE,
    });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}