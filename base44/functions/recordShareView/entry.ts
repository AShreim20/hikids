import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Verifiable share tracking for "share" challenges. A share link encodes the
// challenge + the sharing customer; when a *different* visitor opens it, this
// endpoint records a recipient fingerprint (IP + UA hash). The same fingerprint
// can't count twice, and the sharer can't count themselves. We can't prove a
// message was actually delivered on an external platform — but we can prove a
// distinct visitor opened the link, which is the verifiable action here.
async function fingerprint(req) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || '0';
  const ua = req.headers.get('user-agent') || '';
  const data = new TextEncoder().encode(`${ip}|${ua}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const challengeId = String(body.challenge_id || '');
    const sharerEmail = String(body.sharer_email || '').trim().toLowerCase();
    if (!challengeId || !sharerEmail) return Response.json({ success: false, message: 'missing params' }, { status: 400 });

    const challenge = await base44.asServiceRole.entities.Challenge.get(challengeId).catch(() => null);
    if (!challenge || challenge.type !== 'share') return Response.json({ success: false, message: 'Invalid challenge' });

    // Don't let the sharer count themselves.
    const visitor = await base44.auth.me().catch(() => null);
    if (visitor && visitor.email && visitor.email.trim().toLowerCase() === sharerEmail) {
      return Response.json({ success: true, counted: false, self: true });
    }

    const fp = await fingerprint(req);
    const rows = await base44.asServiceRole.entities.ChallengeProgress.filter({ challenge_id: challengeId, user_email: sharerEmail });
    const progress = rows && rows[0];
    if (!progress) return Response.json({ success: true, counted: false });
    const recipients = progress.recipients || [];
    if (recipients.includes(fp)) return Response.json({ success: true, counted: false, duplicate: true });

    const need = Number(challenge.target?.share_count) || 0;
    await base44.asServiceRole.entities.ChallengeProgress.update(progress.id, { recipients: [...recipients, fp] });
    return Response.json({ success: true, counted: true, progress: recipients.length + 1, need });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}