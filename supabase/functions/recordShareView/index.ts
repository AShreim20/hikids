import { getCallerUser, serviceRoleClient } from '../_shared/client.ts';
import { handlePreflight, json } from '../_shared/cors.ts';

// Verifiable share tracking for "share" challenges. A share link encodes the
// challenge + the sharing customer; when a *different* visitor opens it, this
// endpoint records a recipient fingerprint (IP + UA hash). The same fingerprint
// can't count twice, and the sharer can't count themselves. We can't prove a
// message was actually delivered on an external platform — but we can prove a
// distinct visitor opened the link, which is the verifiable action here.
//
// Hardening (P3): this feeds real challenge-reward eligibility (recipients
// reaching challenge.target.share_count lets the sharer claim a reward via
// challenges_claim), so a spoofable fingerprint has real economic value, not
// just an analytics number. Two fixes, reusing existing patterns already used
// elsewhere in this project rather than new device fingerprinting:
//  1. IP extraction now uses the same trusted-proxy convention as trackOrder/
//     chatAssistant (the platform-appended, rightmost X-Forwarded-For entry —
//     the client cannot forge this position, unlike the leftmost one this
//     used before).
//  2. A lightweight per-real-IP rate limit (assistant_rate_check, the
//     project's existing limiter) stops one visitor from rapid-cycling fake
//     "distinct recipient" credits even with a real, unspoofed IP.
const LIMITS = [
  { scope: 'share_ip10m', windowSeconds: 600, limit: 20 },
] as const;

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

async function fingerprint(req: Request) {
  const ip = clientAddress(req);
  const ua = req.headers.get('user-agent') || '';
  const data = new TextEncoder().encode(`${ip}|${ua}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  try {
    const body = await req.json().catch(() => ({}));
    const challengeId = String(body.challenge_id || '');
    const sharerEmail = String(body.sharer_email || '').trim().toLowerCase();
    if (!challengeId || !sharerEmail) {
      return json({ success: false, message: 'missing params' }, { status: 400 });
    }

    const service = serviceRoleClient();

    const ipHash = (await fingerprint(req)).slice(0, 32);
    const { data: rl, error: rlError } = await service.rpc('assistant_rate_check', {
      p_scope: LIMITS[0].scope,
      p_id: ipHash,
      p_limit: LIMITS[0].limit,
      p_window_seconds: LIMITS[0].windowSeconds,
    });
    if (rlError || !rl) {
      console.error('recordShareView rate limiter failure', rlError?.message);
      return json({ success: false, message: 'Please try again in a moment.' }, { status: 503 });
    }
    if (!rl.allowed) {
      return json({ success: false, message: 'Too many attempts.', retry_after: rl.retry_after }, { status: 429 });
    }

    const { data: challenge } = await service.from('challenges').select('*').eq('id', challengeId).maybeSingle();
    if (!challenge || challenge.type !== 'share') {
      return json({ success: false, message: 'Invalid challenge' });
    }

    // Don't let the sharer count themselves.
    const visitor = await getCallerUser(req);
    if (visitor?.email && visitor.email.trim().toLowerCase() === sharerEmail) {
      return json({ success: true, counted: false, self: true });
    }

    const fp = await fingerprint(req);
    const { data: rows } = await service
      .from('challenge_progress')
      .select('*')
      .eq('challenge_id', challengeId)
      .eq('user_email', sharerEmail);
    const progress = rows && rows[0];
    if (!progress) return json({ success: true, counted: false });
    const recipients: string[] = progress.recipients || [];
    if (recipients.includes(fp)) return json({ success: true, counted: false, duplicate: true });

    const need = Number(challenge.target?.share_count) || 0;
    const { error } = await service
      .from('challenge_progress')
      .update({ recipients: [...recipients, fp] })
      .eq('id', progress.id);
    if (error) throw error;
    return json({ success: true, counted: true, progress: recipients.length + 1, need });
  } catch (error) {
    return json({ success: false, message: error.message }, { status: 500 });
  }
});
