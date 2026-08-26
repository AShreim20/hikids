import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { isRewardExpired } from '../../shared/rewards.ts';

// Called right after an order is placed. It is the server-side authority that
// turns a product-reward "free line" into a Used reward, and — as a backup to
// redeemDiscount — marks a discount-code reward used. A reward only becomes
// Used here, after a real order exists; viewing or copying never marks it used.
//
// If the same spin already shows as used (duplicate cart line placed twice),
// the free line is re-priced back to the product's normal price and the order
// totals are corrected, so a reward can never be redeemed more than once.
export default async function (req) {
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

    const items = Array.isArray(order.items) ? order.items : [];
    const spinIds = [...new Set(items.map((i) => i.wheel_spin_id).filter(Boolean))];
    let marked = 0;
    let repriced = 0;

    for (const sid of spinIds) {
      const spin = await base44.asServiceRole.entities.WheelSpin.get(sid).catch(() => null);
      if (!spin) continue;
      if (spin.user_email !== order.customer_email) continue; // not this customer's reward

      const expired = isRewardExpired(spin);
      const alreadyUsed = spin.status === 'used' && spin.redeemed_order_id && spin.redeemed_order_id !== orderId;

      if (spin.status === 'unused' && !expired) {
        await base44.asServiceRole.entities.WheelSpin.update(sid, {
          status: 'used', redeemed_order_id: orderId,
        });
        marked++;
      } else if (alreadyUsed || expired || spin.status === 'unavailable') {
        // Duplicate / expired / unavailable: the free line is invalid. Re-price
        // it back to the product's normal price so the customer pays for it.
        const price = Number(spin.product_price) || 0;
        let changed = false;
        const newItems = items.map((it) => {
          if (it.wheel_spin_id === sid && it.is_wheel_reward) {
            changed = true;
            return { ...it, price, is_wheel_reward: false, wheel_reward_reversed: true };
          }
          return it;
        });
        if (changed) {
          const subtotal = newItems.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 0), 0);
          const total = Math.max(0,
            subtotal + Number(order.delivery_cost || 0)
            - Number(order.discount_amount || 0) - Number(order.loyalty_discount || 0));
          const note = `\nWheel reward ${sid} ${expired ? 'expired' : 'already used'}; free line re-priced.`;
          await base44.asServiceRole.entities.Order.update(orderId, {
            items: newItems, subtotal, total,
            internal_notes: (order.internal_notes || '') + note,
          });
          repriced++;
        }
        if (expired && spin.status !== 'expired') {
          await base44.asServiceRole.entities.WheelSpin.update(sid, { status: 'expired' });
        }
      }
    }

    // Backup: if the order used a wheel discount code, make sure its spin is marked
    // used (redeemDiscount already does this, but this covers any missed path).
    if (order.discount_code) {
      const dcs = await base44.asServiceRole.entities.DiscountCode.filter({ code: order.discount_code });
      const dc = dcs && dcs[0];
      if (dc && dc.wheel_spin_id) {
        const spin = await base44.asServiceRole.entities.WheelSpin.get(dc.wheel_spin_id).catch(() => null);
        if (spin && spin.status === 'unused' && !isRewardExpired(spin) && spin.user_email === order.customer_email) {
          await base44.asServiceRole.entities.WheelSpin.update(spin.id, {
            status: 'used', redeemed_order_id: orderId,
          });
          marked++;
        }
      }
    }

    return Response.json({ success: true, marked, repriced });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}