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

    // Stock deduction is now handled atomically by `commitOrderStock`, which
    // Checkout calls right after creating the order.

    const ref = String(order.id).slice(-8).toUpperCase();
    const paymentLabel = order.payment_method === 'card'
      ? 'Paid by card'
      : order.payment_method === 'loyalty'
        ? 'Paid with loyalty points'
        : 'Cash on delivery';
    const itemRows = (order.items || [])
      .map((it) => {
        const lineTotal = (Number(it.price) * Number(it.qty)).toFixed(2);
        const label = it.variant_label ? ` <span style="color:#9a8fbf;font-size:13px;">(${it.variant_label})</span>` : '';
        return `<tr>
          <td style="padding:12px 0;border-bottom:1px solid #f1ecfa;color:#3d2b5f;">${it.name}${label}<br><span style="font-size:13px;color:#9a8fbf;">Qty ${it.qty}</span></td>
          <td style="padding:12px 0 12px 24px;border-bottom:1px solid #f1ecfa;text-align:right;font-weight:700;color:#3d2b5f;white-space:nowrap;">$${lineTotal}</td>
        </tr>`;
      })
      .join('');
    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f7f4fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4fb;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:24px;overflow:hidden;max-width:600px;width:100%;box-shadow:0 6px 24px rgba(61,43,95,0.08);">
        <tr><td style="background:#3d2b5f;padding:28px 40px;text-align:center;">
          <div style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">HiKids</div>
          <div style="font-size:13px;color:#c9b8f0;margin-top:4px;">Gallery of Wonder</div>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <h1 style="margin:0 0 8px;font-size:24px;color:#3d2b5f;">Thank you for your order, ${order.customer_name || 'friend'}! 🎁</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#6b5b8c;line-height:1.6;">We've received your order and our team is getting it ready with care. Here's your confirmation:</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4fb;border-radius:16px;margin-bottom:24px;">
            <tr><td style="padding:16px 20px;color:#9a8fbf;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">Order reference</td><td style="padding:16px 20px;text-align:right;font-weight:700;color:#3d2b5f;">#${ref}</td></tr>
            <tr><td style="padding:0 20px 16px;color:#9a8fbf;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">Payment</td><td style="padding:0 20px 16px;text-align:right;font-weight:700;color:#3d2b5f;">${paymentLabel}</td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0">${itemRows}
            <tr><td colspan="2" style="padding-top:20px;"></td></tr>
            <tr><td style="padding:12px 0;color:#6b5b8c;font-weight:700;">Total</td><td style="padding:12px 0 12px 24px;text-align:right;font-size:18px;font-weight:800;color:#3d2b5f;">$${Number(order.total || 0).toFixed(2)}</td></tr>
          </table>
          <div style="margin-top:24px;padding:20px;background:#f7f4fb;border-radius:16px;">
            <div style="font-size:13px;color:#9a8fbf;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Delivery to</div>
            <div style="font-size:15px;color:#3d2b5f;line-height:1.5;">${order.customer_name || ''}<br>${order.address || ''}<br>${order.phone || ''}</div>
          </div>
          <p style="margin:28px 0 0;font-size:14px;color:#6b5b8c;line-height:1.6;">We'll be in touch as soon as your order is on its way. If you have any questions, just reply to this email.</p>
          <p style="margin:20px 0 0;font-size:14px;color:#3d2b5f;font-weight:700;">— The HiKids team</p>
        </td></tr>
        <tr><td style="background:#f7f4fb;padding:20px 40px;text-align:center;font-size:12px;color:#9a8fbf;">© ${new Date().getFullYear()} HiKids · Gallery of Wonder</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    // SendEmail only reaches registered app users; skip silently otherwise.
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: order.customer_email,
        subject: `Your HiKids order confirmation — #${ref}`,
        body: html,
        from_name: 'HiKids',
      });
    } catch (e) {
      // recipient not a registered app user or delivery failed — non-fatal
    }

    // Notify store admins of every new sale in real time.
    try {
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      const itemCount = (order.items || []).reduce((n, it) => n + Number(it.qty || 0), 0);
      const adminLines = (order.items || [])
        .map((it) => `• ${it.name}${it.variant_label ? ` (${it.variant_label})` : ''} × ${it.qty} — $${(Number(it.price) * Number(it.qty)).toFixed(2)}`)
        .join('\n');
      const adminBody =
        `New order received!\n\n` +
        `Order: #ORD-${String(order.id).slice(-6).toUpperCase()}\n` +
        `Items: ${itemCount}\n` +
        `Status: ${order.status || 'new'}\n` +
        `Placed: ${new Date(order.created_date || Date.now()).toLocaleString('en-GB')}\n` +
        `Reference: ${ref}\n` +
        `Customer: ${order.customer_name || '-'} (${order.customer_email})\n` +
        `Phone: ${order.phone || '-'}\n` +
        `City: ${order.city || '-'}\n` +
        `Address: ${order.address || '-'}\n` +
        `Payment: ${paymentLabel}\n\n` +
        `Items:\n${adminLines}\n\n` +
        `Total: $${Number(order.total || 0).toFixed(2)}`;
      for (const a of admins || []) {
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: a.email,
            subject: `🛒 New HiKids order — ${ref}`,
            body: adminBody,
            from_name: 'HiKids',
          });
        } catch {}
      }
    } catch {}

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}