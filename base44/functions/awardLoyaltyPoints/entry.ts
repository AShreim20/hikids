import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { loadLoyaltySettings, getOrCreateWallet, postLedger, earnableForOrder, expiryDate } from '../../shared/loyalty.ts';

// Awards earned points for a verified order. Amounts are read from the order
// record server-side, the award is idempotent per order, and when the store
// awards on delivery the points stay pending until the order is delivered.
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

    const settings = await loadLoyaltySettings(base44);

    if (['cancelled', 'returned', 'return_approved'].includes(order.status)) {
      return Response.json({ success: true, awarded: 0, message: 'order not eligible' });
    }
    if (settings.loyalty_award_on_delivery && order.status !== 'delivered') {
      return Response.json({ success: true, awarded: 0, pending: true, message: 'awarded on delivery' });
    }

    const awarded = earnableForOrder(settings, order);
    if (awarded > 0) {
      const walletUser = {
        id: order.created_by_id || '',
        email: order.customer_email,
        full_name: order.customer_name || '',
      };
      const wallet = await getOrCreateWallet(base44, walletUser);
      await postLedger(base44, {
        wallet,
        points: awarded,
        type: 'earn',
        reason: `Purchase #${String(orderId).slice(-8).toUpperCase()}`,
        order_id: orderId,
        actor_email: 'system',
        idempotency_key: `earn:${orderId}`,
        expires_at: expiryDate(settings),
      });
    }

    await base44.asServiceRole.entities.Order.update(orderId, { loyalty_awarded: true });
    return Response.json({ success: true, awarded });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}