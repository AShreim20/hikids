import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { loadLoyaltySettings, getOrCreateWallet, maxRedeemable, isWalletBlocked } from '../../shared/loyalty.ts';

// The customer's own wallet: identity, balances, ledger history and the
// redemption limits for the cart currently being checked out. The frontend never
// computes any of this itself.
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

    const limits = maxRedeemable(settings, {
      subtotal: Number(body.subtotal) || 0,
      delivery_cost: Number(body.delivery_cost) || 0,
      discount_amount: Number(body.discount_amount) || 0,
    });
    const blocked = isWalletBlocked(wallet);
    const blockedByDiscount = !settings.loyalty_redeem_with_discount && Number(body.discount_amount) > 0;
    const redeemable = blocked || blockedByDiscount ? 0 : Math.min(limits.max_points, wallet.balance || 0);

    return Response.json({
      success: true,
      wallet_code: wallet.wallet_code || '',
      status: wallet.status || (wallet.frozen ? 'frozen' : 'active'),
      balance: wallet.balance || 0,
      frozen: blocked,
      pending_points: wallet.pending_points || 0,
      lifetime_earned: wallet.lifetime_earned || 0,
      lifetime_spent: wallet.lifetime_spent || 0,
      lifetime_redeemed: wallet.lifetime_spent || 0,
      lifetime_removed: wallet.lifetime_removed || 0,
      expired_points: wallet.expired_points || 0,
      earn_rate: settings.loyalty_earn_rate,
      redeem_rate: settings.loyalty_redeem_rate,
      min_redeem: settings.loyalty_min_redeem,
      max_redeem_points: redeemable,
      max_redeem_amount: blocked || blockedByDiscount ? 0 : limits.max_amount,
      blocked_by_discount: blockedByDiscount,
      settings,
      transactions,
    });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}