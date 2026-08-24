import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Default earn/redeem rates (admin-configurable via Setting entity).
const DEFAULT_EARN_RATE = 1;
const DEFAULT_REDEEM_RATE = 0.1;

async function getRate(base44, key, fallback) {
  try {
    const rows = await base44.asServiceRole.entities.Setting.filter({ key });
    if (rows && rows.length) return Number(rows[0].value) || fallback;
  } catch {}
  return fallback;
}

// Returns the logged-in user's loyalty balance + rates for display/preview.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, message: 'Auth required' });
    const existing = await base44.asServiceRole.entities.LoyaltyAccount.filter({ user_email: user.email });
    const acct = existing[0];
    const earn_rate = await getRate(base44, 'loyalty_earn_rate', DEFAULT_EARN_RATE);
    const redeem_rate = await getRate(base44, 'loyalty_redeem_rate', DEFAULT_REDEEM_RATE);
    return Response.json({
      success: true,
      balance: acct?.balance || 0,
      lifetime_earned: acct?.lifetime_earned || 0,
      earn_rate,
      redeem_rate,
    });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}