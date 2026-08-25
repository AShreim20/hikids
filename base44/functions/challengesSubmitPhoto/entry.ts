import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { grantPoints, grantDiscountCode, recordReward } from '../../shared/rewards.ts';
import { inWindow, getOrCreateProgress } from '../../shared/challenges.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, message: 'Auth required' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const challengeId = String(body.challenge_id || '');
    const fileUrl = String(body.file_url || '');
    if (!challengeId || !fileUrl) return Response.json({ success: false, message: 'challenge_id and file_url required' }, { status: 400 });

    const challenge = await base44.asServiceRole.entities.Challenge.get(challengeId).catch(() => null);
    if (!challenge) return Response.json({ success: false, message: 'Challenge not found' }, { status: 404 });
    if (challenge.type !== 'photo_upload') return Response.json({ success: false, message: 'Not a photo challenge' });
    if (!challenge.active || !inWindow(challenge)) return Response.json({ success: false, message: 'Challenge is not active' });

    // One pending/approved submission per period prevents spamming uploads.
    const existing = await base44.asServiceRole.entities.ChallengeSubmission.filter({ challenge_id: challengeId, user_email: user.email });
    const hasActive = (existing || []).some((s) => s.status === 'pending' || (s.status === 'approved' && s.reward_granted));
    if (hasActive) return Response.json({ success: false, message: 'You already submitted this challenge' });

    const submission = await base44.asServiceRole.entities.ChallengeSubmission.create({
      challenge_id: challengeId, challenge_name: challenge.name,
      user_id: user.id || '', user_email: user.email,
      file_url: fileUrl, note: String(body.note || ''),
      status: challenge.requires_review ? 'pending' : 'approved',
      reward_granted: false,
    });

    // Auto-approve path: grant immediately and record it.
    if (!challenge.requires_review) {
      const progress = await getOrCreateProgress(base44, challengeId, user);
      const newRewarded = (progress.rewarded_count || 0) + 1;
      let discountCode = '';
      let points = 0;
      if (challenge.reward_type === 'points') {
        points = Math.trunc(Number(challenge.reward_value) || 0);
        await grantPoints(base44, user, points, `Challenge: ${challenge.name}`, `chl-${challengeId}-${user.id}-${newRewarded}`);
      } else if (challenge.reward_type === 'discount_percent' || challenge.reward_type === 'discount_fixed' || challenge.reward_type === 'credit') {
        const type = challenge.reward_type === 'discount_percent' ? 'percent' : 'fixed';
        discountCode = await grantDiscountCode(base44, { prefix: challenge.reward_code_prefix || 'CHL', type, value: challenge.reward_value, expires_at: challenge.end_date });
      }
      await base44.asServiceRole.entities.ChallengeSubmission.update(submission.id, { reward_granted: true });
      await base44.asServiceRole.entities.ChallengeProgress.update(progress.id, {
        rewarded_count: newRewarded, completions: (progress.completions || 0) + 1, last_completed_at: new Date().toISOString(),
      });
      await recordReward(base44, {
        user_id: user.id, user_email: user.email, source: 'challenge', source_id: challengeId,
        source_name: challenge.name, reward_type: challenge.reward_type, reward_label: challenge.reward_label || challenge.name,
        points, discount_code: discountCode, product_id: challenge.product_id || '',
        amount: challenge.reward_type === 'credit' ? Number(challenge.reward_value) || 0 : 0, fulfillment: 'auto',
      });
    }

    return Response.json({ success: true, status: submission.status, requires_review: !!challenge.requires_review });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}