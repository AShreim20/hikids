import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  loadLoyaltySettings, getOrCreateWallet, postLedger, setPending, earnableForOrder,
  loadExemptProductIds, reachedAwardStage, isOrderClosed, expiryDate, isWalletBlocked, TX,
} from '../../shared/loyalty.ts';

// Accrues / releases the reward for an order. Amounts are always recomputed from
// the stored order server-side. Before the configured award stage the points are
// only accrued as PENDING (not spendable); once the stage is reached they are
// posted to the ledger exactly once (idempotent per order).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, message: 'Auth required' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const orderId = body.order_id;
    if (!orderId) return Response.json({ success: false, message: 'order_id required' }, { status: 400 });

    const order = await base44.asServiceRole.entities.Order.get(orderId);
    if (!order) return Response.json({ success: false, message: 'Order not found' }, { status: 404 });

    const isOwner = order.created_by_id === user.id || order.customer_email === user.email;
    if (!isOwner && user.role !== 'admin') {
      return Response.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }
    if (order.loyalty_awarded) return Response.json({ success: true, awarded: 0, message: 'already awarded' });
    if (isOrderClosed(order)) return Response.json({ success: true, awarded: 0, message: 'order not eligible' });

    const settings = await loadLoyaltySettings(base44);
    const exempt = await loadExemptProductIds(base44);
    const earnable = earnableForOrder(settings, order, exempt);

    const walletUser = {
      id: order.created_by_id || '',
      email: order.customer_email,
      full_name: order.customer_name || '',
      phone: order.phone || '',
    };
    let wallet = await getOrCreateWallet(base44, walletUser);
    if (isWalletBlocked(wallet)) {
      return Response.json({ success: true, awarded: 0, message: 'wallet blocked' });
    }

    const alreadyPending = Math.max(0, Number(order.loyalty_pending_points) || 0);

    // Not spendable yet — hold the reward as pending points.
    if (!reachedAwardStage(settings, order)) {
      if (earnable !== alreadyPending) {
        wallet = await setPending(base44, wallet, earnable - alreadyPending);
        await base44.asServiceRole.entities.Order.update(orderId, { loyalty_pending_points: earnable });
      }
      return Response.json({ success: true, awarded: 0, pending: earnable, message: 'pending until award stage' });
    }

    if (earnable > 0) {
      await postLedger(base44, {
        wallet,
        points: earnable,
        type: TX.REWARD,
        reason: `Order #${String(orderId).slice(-8).toUpperCase()} reward`,
        order_id: orderId,
        actor_email: 'system',
        idempotency_key: `reward:${orderId}`,
        expires_at: expiryDate(settings),
      });
    }
    if (alreadyPending > 0) await setPending(base44, wallet, -alreadyPending);

    await base44.asServiceRole.entities.Order.update(orderId, {
      loyalty_awarded: true,
      loyalty_pending_points: 0,
    });
    return Response.json({ success: true, awarded: earnable });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}