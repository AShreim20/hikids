import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { loadLoyaltySettings, getOrCreateWallet, maxRedeemable, postLedger, expiryDate } from '../../shared/loyalty.ts';

// Deducts points for the logged-in customer at order placement and writes the
// ledger entry. All rules (frozen wallet, minimum, max % / max value, combining
// with a promo code) are enforced server-side — the client value is advisory.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, message: 'Auth required' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const requested = Math.floor(Number(body.points) || 0);
    if (requested <= 0) return Response.json({ success: false, message: 'Enter points to redeem' });

    const settings = await loadLoyaltySettings(base44);
    const wallet = await getOrCreateWallet(base44, user);
    if (wallet.frozen) return Response.json({ success: false, message: 'Wallet is frozen' });

    const discountAmount = Number(body.discount_amount) || 0;
    if (!settings.loyalty_redeem_with_discount && discountAmount > 0) {
      return Response.json({ success: false, message: 'Points cannot be combined with a discount code' });
    }
    if (settings.loyalty_min_redeem > 0 && requested < settings.loyalty_min_redeem) {
      return Response.json({ success: false, message: `Minimum ${settings.loyalty_min_redeem} points per redemption` });
    }
    if ((wallet.balance || 0) < requested) {
      return Response.json({ success: false, message: 'Insufficient points' });
    }

    const limits = maxRedeemable(settings, {
      subtotal: Number(body.subtotal) || 0,
      delivery_cost: Number(body.delivery_cost) || 0,
      discount_amount: discountAmount,
    });
    const points = Math.min(requested, limits.max_points);
    if (points <= 0) return Response.json({ success: false, message: 'Points cannot be applied to this order' });
    const amount = Math.min(Math.round(points * limits.rate * 100) / 100, limits.max_amount);

    const key = body.idempotency_key ? `redeem:${body.idempotency_key}` : '';
    const res = await postLedger(base44, {
      wallet,
      points: -points,
      type: 'redeem',
      reason: body.reason || 'Redeemed at checkout',
      order_id: body.order_id || '',
      actor_email: user.email,
      idempotency_key: key,
      expires_at: expiryDate(settings),
    });
    if (res.duplicate) return Response.json({ success: true, points, amount, duplicate: true });

    return Response.json({ success: true, points, amount, balance: res.wallet.balance });
  } catch (error) {
    const insufficient = error.code === 'insufficient';
    return Response.json(
      { success: false, message: insufficient ? 'Insufficient points' : error.message },
      { status: insufficient ? 200 : 500 }
    );
  }
}