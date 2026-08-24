import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Default earn rate: points awarded per ₪ spent (admin-configurable via Setting).
const DEFAULT_EARN_RATE = 1;

async function getRate(base44, key, fallback) {
  try {
    const rows = await base44.asServiceRole.entities.Setting.filter({ key });
    if (rows && rows.length) return Number(rows[0].value) || fallback;
  } catch {}
  return fallback;
}

// Awards loyalty points to the logged-in user for a verified order's subtotal.
// The subtotal is read server-side from the order record (never trusted from
// the client) and the award is idempotent per order. Runs as service role.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const EARN_RATE = await getRate(base44, 'loyalty_earn_rate', DEFAULT_EARN_RATE);

    let user;
    try {
      user = await base44.auth.me();
    } catch (e) {
      return Response.json({ success: false, message: 'Auth required' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const orderId = body && body.order_id;
    if (!orderId) return Response.json({ success: false, message: 'order_id required' }, { status: 400 });

    const order = await base44.asServiceRole.entities.Order.get(orderId);
    if (!order) return Response.json({ success: false, message: 'Order not found' }, { status: 404 });

    const isOwner = order.created_by_id === user.id || order.customer_email === user.email;
    if (!isOwner && user.role !== 'admin') {
      return Response.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }

    // Idempotency: never award twice for the same order.
    if (order.loyalty_awarded) return Response.json({ success: true, awarded: 0, message: 'already awarded' });

    // Orders paid entirely with loyalty points don't earn new points.
    if (order.payment_method === 'loyalty') {
      await base44.asServiceRole.entities.Order.update(orderId, { loyalty_awarded: true });
      return Response.json({ success: true, awarded: 0 });
    }

    const subtotal = Number(order.subtotal) || 0;
    const awarded = Math.floor(subtotal * EARN_RATE);

    if (awarded > 0) {
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
    }

    await base44.asServiceRole.entities.Order.update(orderId, { loyalty_awarded: true });
    return Response.json({ success: true, awarded });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}