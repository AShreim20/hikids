import { serviceRoleClient } from '../_shared/client.ts';
import { handlePreflight, json } from '../_shared/cors.ts';

// Validates a promo code against the current cart subtotal WITHOUT mutating
// state. DiscountCode reads are admin-only via RLS, so this runs as the
// service role to look the code up. Works for guest checkout (no auth needed).
//
// Rate limiting (P2): a public, unauthenticated endpoint with no limit at all
// let anyone enumerate/probe codes for free. Reuses the same fixed-window
// limiter as trackOrder/chatAssistant (assistant_rate_check), with its own
// scope and generous thresholds — a shopper legitimately retries a mistyped
// code a few times per checkout, so this must never interfere with that.
// Fails closed (matches trackOrder/chatAssistant) if the limiter itself
// errors, so the limiter can't be silently bypassed by breaking it.

const LIMITS = [
  { scope: 'disc_ip10m', windowSeconds: 600, limit: 30 },
  { scope: 'disc_global1h', windowSeconds: 3_600, limit: 5_000 },
] as const;

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((x) => x.toString(16).padStart(2, '0')).join('');
}

// Same trusted-address logic as chatAssistant/trackOrder.
function clientAddress(req: Request) {
  const cf = req.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return 'unknown';
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  try {
    const service = serviceRoleClient();

    const ipHash = (await sha256Hex(clientAddress(req))).slice(0, 32);
    for (const l of LIMITS) {
      const { data, error } = await service.rpc('assistant_rate_check', {
        p_scope: l.scope,
        p_id: l.scope === 'disc_global1h' ? 'all' : ipHash,
        p_limit: l.limit,
        p_window_seconds: l.windowSeconds,
      });
      if (error || !data) {
        console.error('validateDiscount rate limiter failure', error?.message);
        return json({ valid: false, message: 'Please try again in a moment.' }, { status: 503 });
      }
      if (!data.allowed) {
        return json({ valid: false, message: 'Too many attempts. Please try again shortly.', retry_after: data.retry_after }, { status: 429 });
      }
    }

    const body = await req.json().catch(() => ({}));
    const code = String(body.code || '').trim().toUpperCase();
    const subtotal = Number(body.subtotal) || 0;
    if (!code) return json({ valid: false, message: 'Code is required' });

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
