import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Earn rate: points awarded per ₪ spent (on subtotal, excl. delivery).
const EARN_RATE = 1;

// Awards loyalty points to the logged-in user for an order's subtotal.
// Creates the account on first purchase. Runs as service role (admin-only writes).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, message: 'Auth required' });
    const body = await req.json().catch(() => ({}));
    const subtotal = Number(body.subtotal) || 0;
    if (subtotal <= 0) return Response.json({ success: true, awarded: 0 });

    const awarded = Math.floor(subtotal * EARN_RATE);
    if (awarded <= 0) return Response.json({ success: true, awarded: 0 });

    const existing = await base44.asServiceRole.entities.LoyaltyAccount.filter({ user_email: user.email });
    const acct = existing[0];
    if (!acct) {
      await base44.asServiceRole.entities.LoyaltyAccount.create({
        user_id: user.id,
        user_email: user.email,
        user_name: user.full_name || '',
        balance: awarded,
        lifetime_earned: awarded,
      });
    } else {
      await base44.asServiceRole.entities.LoyaltyAccount.update(acct.id, {
        balance: (acct.balance || 0) + awarded,
        lifetime_earned: (acct.lifetime_earned || 0) + awarded,
      });
    }
    return Response.json({ success: true, awarded });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}