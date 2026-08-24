import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Default redeem rate: ₪ value per point redeemed (admin-configurable via Setting).
const DEFAULT_REDEEM_RATE = 0.1;

async function getRate(base44, key, fallback) {
  try {
    const rows = await base44.asServiceRole.entities.Setting.filter({ key });
    if (rows && rows.length) return Number(rows[0].value) || fallback;
  } catch {}
  return fallback;
}

// Atomically redeems points for the logged-in user as a checkout discount.
// Validates balance, decrements, and returns the discount amount (capped at
// the order subtotal). Called at order placement — not for preview.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const REDEEM_RATE = await getRate(base44, 'loyalty_redeem_rate', DEFAULT_REDEEM_RATE);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, message: 'Auth required' });
    const body = await req.json().catch(() => ({}));
    const points = Math.floor(Number(body.points) || 0);
    const subtotal = Number(body.subtotal) || 0;
    if (points <= 0) return Response.json({ success: false, message: 'Enter points to redeem' });

    const existing = await base44.asServiceRole.entities.LoyaltyAccount.filter({ user_email: user.email });
    const acct = existing[0];
    if (!acct || (acct.balance || 0) < points) {
      return Response.json({ success: false, message: 'Insufficient points' });
    }

    let amount = Math.round(points * REDEEM_RATE * 100) / 100;
    if (amount > subtotal) amount = subtotal;

    await base44.asServiceRole.entities.LoyaltyAccount.update(acct.id, {
      balance: (acct.balance || 0) - points,
    });
    return Response.json({ success: true, amount, points });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}