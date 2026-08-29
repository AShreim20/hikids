import { getCallerUser, serviceRoleClient } from '../_shared/client.ts';
import { handlePreflight, json } from '../_shared/cors.ts';

// Verifiable share tracking for "share" challenges. A share link encodes the
// challenge + the sharing customer; when a *different* visitor opens it, this
// endpoint records a recipient fingerprint (IP + UA hash). The same fingerprint
// can't count twice, and the sharer can't count themselves. We can't prove a
// message was actually delivered on an external platform — but we can prove a
// distinct visitor opened the link, which is the verifiable action here.
async function fingerprint(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || '0';
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
