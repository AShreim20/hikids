import { serviceRoleClient } from '../_shared/client.ts';
import { handlePreflight, json } from '../_shared/cors.ts';

// Validates a promo code against the current cart subtotal WITHOUT mutating
// state. DiscountCode reads are admin-only via RLS, so this runs as the
// service role to look the code up. Works for guest checkout (no auth needed).
Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  try {
    const body = await req.json().catch(() => ({}));
    const code = String(body.code || '').trim().toUpperCase();
    const subtotal = Number(body.subtotal) || 0;
    if (!code) return json({ valid: false, message: 'Code is required' });

    const service = serviceRoleClient();
    const { data: rows } = await service.from('discount_codes').select('*').eq('code', code);
    const dc = rows && rows[0];
    if (!dc) return json({ valid: false, message: 'Invalid code' });
    if (!dc.active) return json({ valid: false, message: 'This code is no longer active' });
    if (dc.expires_at && new Date(dc.expires_at) < new Date(new Date().toDateString())) {
      return json({ valid: false, message: 'This code has expired' });
    }
    if (dc.usage_limit && (dc.used_count || 0) >= dc.usage_limit) {
      return json({ valid: false, message: 'This code has reached its usage limit' });
    }
    if (subtotal < (dc.min_subtotal || 0)) {
      return json({ valid: false, message: `Minimum subtotal is ₪${dc.min_subtotal}` });
    }

    let discount_amount =
      dc.type === 'percent' ? Math.round((subtotal * dc.value) / 100) : dc.value;
    if (discount_amount > subtotal) discount_amount = subtotal;

    return json({
      valid: true,
      discount_amount,
      code: { id: dc.id, code: dc.code, type: dc.type, value: dc.value },
    });
  } catch (error) {
    return json({ valid: false, message: error.message }, { status: 500 });
  }
});
