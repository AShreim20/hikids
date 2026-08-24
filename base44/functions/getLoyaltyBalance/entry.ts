import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { loadLoyaltySettings, getOrCreateWallet, maxRedeemable, earnableForOrder } from '../../shared/loyalty.ts';

// Returns the logged-in customer's wallet: balance, totals, pending points,
// recent ledger entries and the redemption limits for the cart being checked out.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, message: 'Auth required' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const settings = await loadLoyaltySettings(base44);
    const wallet = await getOrCreateWallet(base44, user);

    const limit = Math.min(Number(body.limit) || 10, 200);
    let transactions = [];
    try {
      transactions = await base44.asServiceRole.entities.LoyaltyTransaction.filter(
        { user_email: user.email }, '-created_date', limit
      );
    } catch { transactions = []; }

    // Pending = points from placed orders that haven't been awarded yet.
    let pending = 0;
    try {
      const orders = await base44.asServiceRole.entities.Order.filter(
        { customer_email: user.email, loyalty_awarded: false }, '-created_date', 50
      );
      (orders || []).forEach((o) => {
        if (['cancelled', 'returned', 'return_approved'].includes(o.status)) return;
        pending += earnableForOrder(settings, o);
      });
    } catch { pending = 0; }

    const limits = maxRedeemable(settings, {
      subtotal: Number(body.subtotal) || 0,
      delivery_cost: Number(body.delivery_cost) || 0,
      discount_amount: Number(body.discount_amount) || 0,
    });
    const blockedByDiscount = !settings.loyalty_redeem_with_discount && Number(body.discount_amount) > 0;

    return Response.json({
      success: true,
      balance: wallet.balance || 0,
      frozen: !!wallet.frozen,
      lifetime_earned: wallet.lifetime_earned || 0,
      lifetime_spent: wallet.lifetime_spent || 0,
      lifetime_removed: wallet.lifetime_removed || 0,
      expired_points: wallet.expired_points || 0,
      pending_points: pending,
      earn_rate: settings.loyalty_earn_rate,
      redeem_rate: settings.loyalty_redeem_rate,
      min_redeem: settings.loyalty_min_redeem,
      max_redeem_points: blockedByDiscount ? 0 : Math.min(limits.max_points, wallet.balance || 0),
      max_redeem_amount: blockedByDiscount ? 0 : limits.max_amount,
      blocked_by_discount: blockedByDiscount,
      settings,
      transactions,
    });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}