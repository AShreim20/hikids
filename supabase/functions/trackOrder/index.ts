import { handlePreflight, json } from '../_shared/cors.ts';
import { serviceRoleClient } from '../_shared/client.ts';

// Public guest order tracking. A guest proves ownership of an order with its
// public order number (ORD-XXXXXX) AND the phone number used at checkout.
//
// Security model:
//  - orders is never readable by anon. The lookup is the SECURITY DEFINER RPC
//    track_guest_order(), executable by service_role only, and it returns a
//    minimal customer-safe JSON (no ids, notes, cost, staff or audit data).
//  - The order number alone is never enough (only 6-8 hex chars of the id, not a
//    secret); the phone must also match. A wrong order number, wrong phone or
//    both all produce the identical generic "not found" response.
//  - Input is validated (types/lengths/format) BEFORE any database work.
//  - Server-side fixed-window rate limits via assistant_rate_check(): per IP,
//    per order number and per phone (so rotating IPs does not help against one
//    target), plus a global cap. Buckets hold SHA-256 hashes, never raw values.
//    If the limiter fails the request is refused (fail closed).
//  - Phone numbers are never logged.

const MAX_BODY_BYTES = 2_000;
const MAX_REF_CHARS = 16;
const MAX_PHONE_CHARS = 32;

const LIMITS = [
  { scope: 'trk_ip10m', windowSeconds: 600, limit: 20, key: 'ip' },
  { scope: 'trk_ip1d', windowSeconds: 86_400, limit: 100, key: 'ip' },
  { scope: 'trk_ref1h', windowSeconds: 3_600, limit: 10, key: 'ref' },
  { scope: 'trk_phone1h', windowSeconds: 3_600, limit: 10, key: 'phone' },
  { scope: 'trk_global1h', windowSeconds: 3_600, limit: 3_000, key: 'all' },
] as const;

const MESSAGES = {
  ar: {
    notFound: 'لم نتمكن من العثور على طلب بهذه البيانات. تأكد من رقم الطلب ورقم الهاتف.',
    rate: 'محاولات كثيرة. حاول مرة ثانية بعد قليل.',
    down: 'الخدمة غير متاحة حاليًا. حاول لاحقًا.',
  },
  en: {
    notFound: "We couldn't find an order matching these details. Please check the order number and phone number.",
    rate: 'Too many attempts. Please try again in a little while.',
    down: 'The service is unavailable right now. Please try again later.',
  },
} as const;

function fail(status: number, code: string, lang: 'ar' | 'en', key: keyof typeof MESSAGES.ar, extra: Record<string, unknown> = {}) {
  return json({ error: code, code, message: MESSAGES[lang][key], ...extra }, { status });
}

// Same trusted-address logic as chatAssistant (leftmost X-Forwarded-For entries
// are client-controlled and ignored).
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

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((x) => x.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, { status: 405 });

  let lang: 'ar' | 'en' = 'ar';
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return fail(413, 'invalid_input', lang, 'notFound');
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { return fail(400, 'invalid_input', lang, 'notFound'); }
    if (!raw || typeof raw !== 'object') return fail(400, 'invalid_input', lang, 'notFound');
    const b = raw as Record<string, unknown>;
    if (b.lang === 'en') lang = 'en';

    // Validate before any database work.
    if (typeof b.order_ref !== 'string' || typeof b.phone !== 'string') return fail(400, 'invalid_input', lang, 'notFound');
    if (b.order_ref.length > MAX_REF_CHARS || b.phone.length > MAX_PHONE_CHARS) return fail(400, 'invalid_input', lang, 'notFound');
    const ref = b.order_ref.trim().toUpperCase().replace(/^ORD-?/, '').replace(/\s+/g, '');
    if (!/^[0-9A-F]{6,8}$/.test(ref)) return fail(400, 'invalid_input', lang, 'notFound');
    if (!/^[0-9+\s\-().]{7,32}$/.test(b.phone)) return fail(400, 'invalid_input', lang, 'notFound');
    const phoneDigits = b.phone.replace(/\D/g, '');
    if (phoneDigits.length < 7 || phoneDigits.length > 15) return fail(400, 'invalid_input', lang, 'notFound');

    // Rate limiting (fail closed). Keyed on hashes; the phone bucket uses the last
    // 9 digits so '059..' / '+970 59..' / '00970 59..' share one bucket.
    const keys: Record<string, string> = {
      ip: (await sha256Hex(clientAddress(req))).slice(0, 32),
      ref: (await sha256Hex(ref.slice(-6))).slice(0, 32),
      phone: (await sha256Hex(phoneDigits.slice(-9))).slice(0, 32),
      all: 'all',
    };
    const db = serviceRoleClient();
    for (const l of LIMITS) {
      const { data, error } = await db.rpc('assistant_rate_check', {
        p_scope: l.scope,
        p_id: keys[l.key],
        p_limit: l.limit,
        p_window_seconds: l.windowSeconds,
      });
      if (error || !data) {
        console.error('trackOrder rate limiter failure', error?.message);
        return fail(503, 'unavailable', lang, 'down');
      }
      if (!data.allowed) return fail(429, 'rate_limited', lang, 'rate', { retry_after: data.retry_after });
    }

    const { data: order, error } = await db.rpc('track_guest_order', { p_ref: ref, p_phone: b.phone });
    if (error) {
      console.error('trackOrder lookup failure', error.message);
      return fail(503, 'unavailable', lang, 'down');
    }
    if (!order) return json({ found: false, message: MESSAGES[lang].notFound });
    return json({ found: true, order });
  } catch (error) {
    console.error('trackOrder error', (error as Error)?.message);
    return fail(500, 'server_error', lang, 'down');
  }
});
