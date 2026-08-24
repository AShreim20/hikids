import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getOrCreateWallet, postLedger, TX } from '../../shared/loyalty.ts';

// Releases points that were reserved for a checkout that never became an order
// (payment failed, order creation failed, checkout abandoned). The refund is
// keyed to the original redemption, so it can never be paid out twice, and the
// original transaction is marked reversed for the audit trail.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, message: 'Auth required' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const checkoutKey = String(body.idempotency_key || '').trim();
    if (!checkoutKey) return Response.json({ success: false, message: 'idempotency_key required' }, { status: 400 });

    const rows = await base44.asServiceRole.entities.LoyaltyTransaction.filter({
      idempotency_key: `redeem:${checkoutKey}`,
    });
    const original = rows && rows[0];
    if (!original) return Response.json({ success: true, released: 0, message: 'nothing reserved' });

    if (original.user_email !== user.email && user.role !== 'admin') {
      return Response.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }

    const points = Math.abs(Number(original.points) || 0);
    if (!points) return Response.json({ success: true, released: 0 });

    const wallet = await getOrCreateWallet(base44, {
      id: original.user_id || '',
      email: original.user_email,
      full_name: '',
    });

    const res = await postLedger(base44, {
      wallet,
      points,
      type: TX.REFUND,
      reason: 'Reserved points released — checkout not completed',
      order_id: original.order_id || '',
      reference_transaction_id: original.id,
      actor_email: user.email,
      idempotency_key: `release:${checkoutKey}`,
    });
    if (res.duplicate) return Response.json({ success: true, released: 0, duplicate: true });

    await base44.asServiceRole.entities.LoyaltyTransaction.update(original.id, { status: 'reversed' });
    if (body.order_id) {
      await base44.asServiceRole.entities.Order.update(body.order_id, { loyalty_released: true }).catch(() => {});
    }
    return Response.json({ success: true, released: points, balance: res.wallet.balance });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}