import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const orderId = body && body.orderId;
    if (!orderId) return Response.json({ error: 'orderId required' }, { status: 400 });

    // Authenticate the caller before touching order data.
    let user;
    try {
      user = await base44.auth.me();
    } catch (e) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const order = await base44.asServiceRole.entities.Order.get(orderId);
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });

    // Only the order's owner or an admin may trigger the receipt email.
    const isOwner = order.created_by_id === user.id || order.customer_email === user.email;
    if (!isOwner && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const ref = String(order.id).slice(-8).toUpperCase();
    const lines = (order.items || [])
      .map((it) => `• ${it.name} × ${it.qty} — $${(Number(it.price) * Number(it.qty)).toFixed(2)}`)
      .join('\n');
    const text =
      `Hi ${order.customer_name || 'there'},\n\n` +
      `Thank you for your order from HiKids!\n\n` +
      `Order reference: ${ref}\n` +
      `Payment: ${order.payment_method === 'card' ? 'Paid by card' : order.payment_method === 'loyalty' ? 'Paid with loyalty points' : 'Cash on delivery'}\n\n` +
      `Items:\n${lines}\n\n` +
      `Total: $${Number(order.total || 0).toFixed(2)}\n\n` +
      `Delivery to: ${order.address}\n\n` +
      `We'll be in touch shortly.\n— The HiKids team`;

    // SendEmail only reaches registered app users; skip silently otherwise.
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: order.customer_email,
        subject: `Your HiKids order receipt — ${ref}`,
        body: text,
        from_name: 'HiKids',
      });
    } catch (e) {
      // recipient not a registered app user or delivery failed — non-fatal
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}