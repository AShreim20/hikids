import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { can } from '../../shared/permissions.ts';

// Reverts wheel rewards tied to a cancelled / returned / refunded order: the
// reward goes back to Unused (so the customer can use it again) and, if a
// one-time discount code was counted against this order, its used_count is
// decremented so the code is spendable once more. Idempotent — only reverses
// rewards whose redeemed_order_id actually matches this order.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, message: 'Auth required' }, { status: 401 });
    if (!can(user, 'orders.manage')) {
      return Response.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const orderId = body.order_id;
    if (!orderId) return Response.json({ success: false, message: 'order_id required' }, { status: 400 });

    const order = await base44.asServiceRole.entities.Order.get(orderId);
    if (!order) return Response.json({ success: false, message: 'Order not found' }, { status: 404 });

    const items = Array.isArray(order.items) ? order.items : [];
    const spinIds = [...new Set(items.map((i) => i.wheel_spin_id).filter(Boolean))];
    let reverted = 0;

    for (const sid of spinIds) {
      const spin = await base44.asServiceRole.entities.WheelSpin.get(sid).catch(() => null);
      if (!spin) continue;
      if (spin.redeemed_order_id === orderId && spin.status === 'used') {
        const expired = spin.expires_at && new Date(spin.expires_at) < new Date();
        await base44.asServiceRole.entities.WheelSpin.update(sid, {
          status: expired ? 'expired' : 'unused',
          redeemed_order_id: '',
        });
        reverted++;
      }
    }

    // Discount code tied to this order: give the one-time code back to the customer.
    if (order.discount_code) {
      const dcs = await base44.asServiceRole.entities.DiscountCode.filter({ code: order.discount_code });
      const dc = dcs && dcs[0];
      if (dc && dc.wheel_spin_id && order.discount_counted) {
        const spin = await base44.asServiceRole.entities.WheelSpin.get(dc.wheel_spin_id).catch(() => null);
        if (spin && spin.redeemed_order_id === orderId) {
          const expired = spin.expires_at && new Date(spin.expires_at) < new Date();
          await base44.asServiceRole.entities.WheelSpin.update(spin.id, {
            status: expired ? 'expired' : 'unused', redeemed_order_id: '',
          });
          reverted++;
        }
        await base44.asServiceRole.entities.DiscountCode.update(dc.id, {
          used_count: Math.max(0, (dc.used_count || 0) - 1),
        });
        await base44.asServiceRole.entities.Order.update(orderId, { discount_counted: false });
      }
    }

    return Response.json({ success: true, reverted });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}