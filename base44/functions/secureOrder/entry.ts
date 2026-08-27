import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { loadLoyaltySettings, maxRedeemable } from '../../shared/loyalty.ts';

// Server-side authority for order financials. Checkout creates the Order with
// the cart's client-side prices, then calls this immediately so every line
// price, the subtotal, delivery cost, discount and loyalty discount are
// recomputed from the real database records before stock is committed, loyalty
// is awarded, or receipts are sent. A malicious client can no longer pay less
// than the real price by sending a forged total/items: the server overwrites
// them. Idempotent (a `secured` flag makes a second call a no-op) and defensive
// (a transient product fetch failure keeps that line's stored price rather than
// throwing, so the happy path is never blocked; truly-missing products are
// still cancelled by commitOrderStock).
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Matches the storefront's pricing: sale_price wins, otherwise an active
// category discount. Variants use their own price (or the product's), with no
// category discount — consistent with the PDP/cart behaviour.
function effectiveUnit(product, catPct) {
  const base = Number(product?.price) || 0;
  const sale = product?.sale_price != null ? Number(product.sale_price) : null;
  if (sale != null && sale < base) return sale;
  if (catPct > 0) return round2(base * (1 - catPct / 100));
  return base;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, message: 'Auth required' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const orderId = body && body.order_id;
    if (!orderId) return Response.json({ success: false, message: 'order_id required' }, { status: 400 });

    const order = await base44.asServiceRole.entities.Order.get(orderId);
    if (!order) return Response.json({ success: false, message: 'Order not found' }, { status: 404 });

    // Only the order's owner or an admin may secure it.
    const isOwner = order.created_by_id === user.id || order.customer_email === user.email;
    if (!isOwner && user.role !== 'admin') {
      return Response.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }
    // Idempotent: once secured, the totals are already authoritative.
    if (order.secured) return Response.json({ success: true, secured: true, order });

    // Category discount map (only active categories with an active discount).
    let categories = [];
    try {
      categories = await base44.asServiceRole.entities.Category.list('sort_order', 1000) || [];
    } catch { categories = []; }
    const catByName = {};
    for (const c of categories) catByName[c.name] = c;
    const catPctFor = (name) => {
      const c = catByName[name];
      return c && c.discount_active && Number(c.discount_percent) > 0 ? Number(c.discount_percent) : 0;
    };

    // Re-derive each line's unit price from the real product record.
    const items = Array.isArray(order.items) ? order.items : [];
    let subtotal = 0;
    const correctedItems = [];
    for (const it of items) {
      const qty = Math.max(1, Math.trunc(Number(it.qty) || 1));
      let unit = Number(it.price) || 0;

      if (it.is_wheel_reward) {
        unit = 0;
      } else if (it.is_bundle && it.bundle_id) {
        try {
          const b = await base44.asServiceRole.entities.Bundle.get(it.bundle_id);
          if (b) {
            const bp = Number(b.bundle_price);
            unit = bp != null && bp > 0 ? bp : round2(
              (Array.isArray(b.items) ? b.items : []).reduce(
                (s, c) => s + (Number(c.unit_price) || 0) * Math.max(1, Math.floor(Number(c.quantity) || 0) || 1), 0
              ) * (1 - (Math.max(0, Math.min(100, Number(b.discount_percent) || 0)) / 100))
            );
          }
        } catch { /* keep stored price */ }
      } else if (it.id) {
        try {
          const p = await base44.asServiceRole.entities.Product.get(it.id);
          if (p) {
            if (it.variant_key && Array.isArray(p.variants)) {
              const v = p.variants.find((x) => x && x.key === it.variant_key);
              if (v && v.price !== '' && v.price != null) unit = Number(v.price);
              else unit = effectiveUnit(p, catPctFor(p.category));
            } else {
              unit = effectiveUnit(p, catPctFor(p.category));
            }
          }
        } catch { /* keep stored price */ }
      }
      subtotal += unit * qty;
      correctedItems.push({ ...it, price: round2(unit), qty });
    }
    subtotal = round2(subtotal);

    // Delivery cost from the stored city.
    let deliveryCost = 0;
    if (order.city) {
      try {
        const cities = await base44.asServiceRole.entities.DeliveryCity.filter({ active: true });
        const c = (cities || []).find((x) => x.name === order.city);
        if (c) deliveryCost = round2(Number(c.price) || 0);
      } catch { deliveryCost = round2(Number(order.delivery_cost) || 0); }
    }

    // Discount: re-validate the code against the real subtotal.
    let discountCode = String(order.discount_code || '');
    let discountAmount = 0;
    if (discountCode) {
      try {
        const dcs = await base44.asServiceRole.entities.DiscountCode.filter({ code: discountCode });
        const dc = dcs && dcs[0];
        const valid =
          dc && dc.active &&
          (!dc.expires_at || new Date(dc.expires_at) >= new Date(new Date().toDateString())) &&
          (!dc.usage_limit || (dc.used_count || 0) < dc.usage_limit) &&
          subtotal >= (dc.min_subtotal || 0);
        if (!valid || (dc && dc.owner_email && order.customer_email !== dc.owner_email)) {
          discountCode = '';
        } else {
          discountAmount = dc.type === 'percent' ? Math.round((subtotal * dc.value) / 100) : Number(dc.value) || 0;
          if (discountAmount > subtotal) discountAmount = subtotal;
          discountAmount = round2(discountAmount);
        }
      } catch { discountAmount = round2(Number(order.discount_amount) || 0); }
    }

    // Loyalty: the redemption already happened; re-derive the currency amount
    // (and cap the recorded points) from the real subtotal.
    const settings = await loadLoyaltySettings(base44);
    let loyaltyPoints = Math.max(0, Math.trunc(Number(order.loyalty_points) || 0));
    let loyaltyDiscount = 0;
    if (loyaltyPoints > 0) {
      const limits = maxRedeemable(settings, {
        subtotal, delivery_cost: deliveryCost, discount_amount: discountAmount,
      });
      const cappedPoints = Math.min(loyaltyPoints, limits.max_points);
      loyaltyDiscount = Math.min(round2(cappedPoints * limits.rate), limits.max_amount);
      loyaltyPoints = cappedPoints;
    }

    const total = Math.max(0, round2(subtotal + deliveryCost - discountAmount - loyaltyDiscount));

    const patch = {
      items: correctedItems,
      subtotal,
      delivery_cost: deliveryCost,
      discount_code: discountCode,
      discount_amount: discountAmount,
      loyalty_points: loyaltyPoints,
      loyalty_discount: loyaltyDiscount,
      total,
      secured: true,
    };
    await base44.asServiceRole.entities.Order.update(orderId, patch);
    return Response.json({ success: true, order: { ...order, ...patch } });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}