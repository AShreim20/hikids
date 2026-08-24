import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getOrCreateWallet, postLedger, setPending, TX } from '../../shared/loyalty.ts';
import { can } from '../../shared/permissions.ts';

// Settles loyalty when an order is cancelled, returned or refunded:
//  * pending (not yet spendable) points for the order are dropped,
//  * points the order already earned are clawed back,
//  * points the customer spent on the order are refunded.
// Each movement is keyed per order and references the original transaction, so
// no reversal or refund can ever be applied twice.
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
    if (order.loyalty_reversed) {
      return Response.json({ success: true, message: 'already reversed', reversed: 0, refunded: 0 });
    }

    const ref = String(orderId).slice(-8).toUpperCase();
    const cancelled = order.status === 'cancelled';
    let wallet = await getOrCreateWallet(base44, {
      id: order.created_by_id || '',
      email: order.customer_email,
      full_name: order.customer_name || '',
      phone: order.phone || '',
    });

    // 1. Drop pending points this order accrued but never paid out.
    const pending = Math.max(0, Number(order.loyalty_pending_points) || 0);
    if (pending > 0) wallet = await setPending(base44, wallet, -pending);

    // 2. Claw back points the order already earned (never below zero).
    let reversed = 0;
    if (order.loyalty_awarded) {
      const earned = await base44.asServiceRole.entities.LoyaltyTransaction.filter({
        order_id: orderId, type: TX.REWARD,
      });
      const legacy = await base44.asServiceRole.entities.LoyaltyTransaction.filter({
        order_id: orderId, type: 'earn',
      });
      const rewards = [...(earned || []), ...(legacy || [])];
      const total = rewards.reduce((s, t) => s + (t.points || 0), 0);
      const take = Math.min(total, wallet.balance || 0);
      if (take > 0) {
        const res = await postLedger(base44, {
          wallet,
          points: -take,
          type: cancelled ? TX.CANCEL_REVERSAL : TX.RETURN_REVERSAL,
          reason: `Reward reversed — order #${ref} ${cancelled ? 'cancelled' : 'returned'}`,
          order_id: orderId,
          reference_transaction_id: rewards[0] ? rewards[0].id : '',
          actor_email: user.email,
          idempotency_key: `reversal:${orderId}`,
        });
        if (!res.skipped) {
          reversed = take;
          wallet = res.wallet;
          for (const r of rewards) {
            await base44.asServiceRole.entities.LoyaltyTransaction.update(r.id, { status: 'reversed' }).catch(() => {});
          }
        }
      }
    }

    // 3. Refund points the customer spent on this order.
    let refunded = 0;
    const spent = Math.floor(Number(order.loyalty_points) || 0);
    if (spent > 0) {
      const redemptions = await base44.asServiceRole.entities.LoyaltyTransaction.filter({
        order_id: orderId, type: TX.REDEEM,
      });
      let originalId = redemptions && redemptions[0] ? redemptions[0].id : '';
      if (!originalId && order.loyalty_redeem_key) {
        const byKey = await base44.asServiceRole.entities.LoyaltyTransaction.filter({
          idempotency_key: `redeem:${order.loyalty_redeem_key}`,
        });
        if (byKey && byKey[0]) originalId = byKey[0].id;
      }
      const res = await postLedger(base44, {
        wallet,
        points: spent,
        type: cancelled ? TX.CANCEL_REVERSAL : TX.REFUND,
        reason: `Points refunded — order #${ref}`,
        order_id: orderId,
        reference_transaction_id: originalId,
        actor_email: user.email,
        idempotency_key: `refund:${orderId}`,
      });
      if (!res.skipped) {
        refunded = spent;
        wallet = res.wallet;
        if (originalId) {
          await base44.asServiceRole.entities.LoyaltyTransaction.update(originalId, { status: 'reversed' }).catch(() => {});
        }
      }
    }

    await base44.asServiceRole.entities.Order.update(orderId, {
      loyalty_reversed: true,
      loyalty_pending_points: 0,
    });
    return Response.json({ success: true, reversed, refunded, pending_dropped: pending, balance: wallet.balance });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}