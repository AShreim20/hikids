import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Increments a code's used_count for a verified, authenticated order. Called by
// checkout once the order is placed. The increment is idempotent per order and
// tied to the order that actually used the code. Runs as the service role.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    let user;
    try {
      user = await base44.auth.me();
    } catch (e) {
      return Response.json({ success: false, message: 'Auth required' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const code_id = String(body.code_id || '');
    const orderId = body && body.order_id;
    if (!code_id || !orderId) {
      return Response.json({ success: false, message: 'code_id and order_id required' }, { status: 400 });
    }

    const order = await base44.asServiceRole.entities.Order.get(orderId);
    if (!order) return Response.json({ success: false, message: 'Order not found' }, { status: 404 });

    const isOwner = order.created_by_id === user.id || order.customer_email === user.email;
    if (!isOwner && user.role !== 'admin') {
      return Response.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }

    const list = await base44.asServiceRole.entities.DiscountCode.filter({ id: code_id });
    const dc = list[0];
    if (!dc) return Response.json({ success: false, message: 'Code not found' });

    // Tie the increment to the order that actually used this code.
    if (order.discount_code && order.discount_code !== dc.code) {
      return Response.json({ success: false, message: 'Code mismatch' });
    }

    // Idempotency: never count the same order twice.
    if (order.discount_counted) return Response.json({ success: true, message: 'already counted' });

    await base44.asServiceRole.entities.DiscountCode.update(code_id, {
      used_count: (dc.used_count || 0) + 1,
    });
    await base44.asServiceRole.entities.Order.update(orderId, { discount_counted: true });
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}