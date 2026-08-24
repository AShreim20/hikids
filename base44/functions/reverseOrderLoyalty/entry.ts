import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getOrCreateWallet, postLedger } from '../../shared/loyalty.ts';
import { can } from '../../shared/permissions.ts';

// Called when an order is cancelled, returned or refunded: claws back the points
// that order earned and refunds the points the customer spent on it. Both moves
// are keyed per order so they can never be applied twice.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, message: 'Auth required' }, { status: 401 });
    if (!can(user, 'orders.manage') && !can(user, 'loyalty.remove')) {
      return Response.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const orderId = body.order_id;
    if (!orderId) return Response.json({ success: false, message: 'order_id required' }, { status: 400 });

    const order = await base44.asServiceRole.entities.Order.get(orderId);
    if (!order) return Response.json({ success: false, message: 'Order not found' }, { status: 404 });
    if (order.loyalty_reversed) return Response.json({ success: true, message: 'already reversed', reversed: 0, refunded: 0 });

    const ref = String(orderId).slice(-8).toUpperCase();
    let wallet = await getOrCreateWallet(base44, {
      id: order.created_by_id || '',
      email: order.customer_email,
      full_name: order.customer_name || '',
    });

    // Claw back points earned from this order (never below zero — a customer who
    // already spent them keeps a zero floor, tracked in the ledger).
    let reversed = 0;
    if (order.loyalty_awarded) {
      const earned = await base44.asServiceRole.entities.LoyaltyTransaction.filter({ order_id: orderId, type: 'earn' });
      const total = (earned || []).reduce((s, t) => s + (t.points || 0), 0);
      const take = Math.min(total, wallet.balance || 0);
      if (take > 0) {
        const res = await postLedger(base44, {
          wallet,
          points: -take,
          type: 'reversal',
          reason: `Points reversed — order #${ref} ${order.status === 'cancelled' ? 'cancelled' : 'returned'}`,
          order_id: orderId,
          actor_email: user.email,
          idempotency_key: `reversal:${orderId}`,
        });
        if (!res.skipped) { reversed = take; wallet = res.wallet; }
      }
    }

    // Refund points the customer spent on this order.
    let refunded = 0;
    const spent = Math.floor(Number(order.loyalty_points) || 0);
    if (spent > 0) {
      const res = await postLedger(base44, {
        wallet,
        points: spent,
        type: 'refund',
        reason: `Points refunded — order #${ref}`,
        order_id: orderId,
        actor_email: user.email,
        idempotency_key: `refund:${orderId}`,
      });
      if (!res.skipped) { refunded = spent; wallet = res.wallet; }
    }

    await base44.asServiceRole.entities.Order.update(orderId, { loyalty_reversed: true });
    return Response.json({ success: true, reversed, refunded, balance: wallet.balance });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}