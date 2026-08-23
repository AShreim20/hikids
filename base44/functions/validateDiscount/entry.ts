import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Validates a promo code against the current cart subtotal WITHOUT mutating
// state. DiscountCode reads are admin-only via RLS, so this runs as the
// service role to look the code up. Works for guest checkout (no auth needed).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const code = String(body.code || '').trim().toUpperCase();
    const subtotal = Number(body.subtotal) || 0;
    if (!code) return Response.json({ valid: false, message: 'Code is required' });

    const found = await base44.asServiceRole.entities.DiscountCode.filter({ code });
    const dc = found[0];
    if (!dc) return Response.json({ valid: false, message: 'Invalid code' });
    if (!dc.active) return Response.json({ valid: false, message: 'This code is no longer active' });
    if (dc.expires_at && new Date(dc.expires_at) < new Date(new Date().toDateString())) {
      return Response.json({ valid: false, message: 'This code has expired' });
    }
    if (dc.usage_limit && (dc.used_count || 0) >= dc.usage_limit) {
      return Response.json({ valid: false, message: 'This code has reached its usage limit' });
    }
    if (subtotal < (dc.min_subtotal || 0)) {
      return Response.json({ valid: false, message: `Minimum subtotal is ₪${dc.min_subtotal}` });
    }

    let discount_amount =
      dc.type === 'percent' ? Math.round((subtotal * dc.value) / 100) : dc.value;
    if (discount_amount > subtotal) discount_amount = subtotal;

    return Response.json({
      valid: true,
      discount_amount,
      code: { id: dc.id, code: dc.code, type: dc.type, value: dc.value },
    });
  } catch (error) {
    return Response.json({ valid: false, message: error.message }, { status: 500 });
  }
}