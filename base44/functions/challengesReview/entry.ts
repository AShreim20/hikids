import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { can } from '../../shared/permissions.ts';
import { grantPoints, grantDiscountCode, recordReward } from '../../shared/rewards.ts';

// Admin review of a photo-upload challenge submission. Approving grants the
// reward exactly once (guarded by reward_granted); rejecting marks it rejected.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, message: 'Auth required' }, { status: 401 });
    if (!can(user, 'loyalty.add')) return Response.json({ success: false, message: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const submissionId = String(body.submission_id || '');
    const action = body.action === 'reject' ? 'reject' : 'approve';
    if (!submissionId) return Response.json({ success: false, message: 'submission_id required' }, { status: 400 });

    const sub = await base44.asServiceRole.entities.ChallengeSubmission.get(submissionId).catch(() => null);
    if (!sub) return Response.json({ success: false, message: 'Submission not found' }, { status: 404 });

    if (action === 'reject') {
      await base44.asServiceRole.entities.ChallengeSubmission.update(sub.id, {
        status: 'rejected', reviewed_by: user.email, review_note: String(body.note || ''),
      });
      return Response.json({ success: true, status: 'rejected' });
    }

    if (sub.reward_granted) return Response.json({ success: false, message: 'Reward already granted' });

    const challenge = await base44.asServiceRole.entities.Challenge.get(sub.challenge_id).catch(() => null);
    if (!challenge) return Response.json({ success: false, message: 'Challenge not found' });

    const progressRows = await base44.asServiceRole.entities.ChallengeProgress.filter({ challenge_id: sub.challenge_id, user_email: sub.user_email });
    const progress = progressRows && progressRows[0];
    const newRewarded = (progress ? (progress.rewarded_count || 0) : 0) + 1;

    let discountCode = '';
    let points = 0;
    if (challenge.reward_type === 'points') {
      points = Math.trunc(Number(challenge.reward_value) || 0);
      await grantPoints(base44, { id: sub.user_id, email: sub.user_email }, points, `Challenge: ${challenge.name}`, `chl-${sub.challenge_id}-${sub.user_email}-${newRewarded}`);
    } else if (challenge.reward_type === 'discount_percent' || challenge.reward_type === 'discount_fixed' || challenge.reward_type === 'credit') {
      const type = challenge.reward_type === 'discount_percent' ? 'percent' : 'fixed';
      discountCode = await grantDiscountCode(base44, { prefix: challenge.reward_code_prefix || 'CHL', type, value: challenge.reward_value, expires_at: challenge.end_date });
    }

    await base44.asServiceRole.entities.ChallengeSubmission.update(sub.id, {
      status: 'approved', reviewed_by: user.email, review_note: String(body.note || ''), reward_granted: true,
    });
    if (progress) {
      await base44.asServiceRole.entities.ChallengeProgress.update(progress.id, {
        rewarded_count: newRewarded, completions: (progress.completions || 0) + 1, last_completed_at: new Date().toISOString(),
      });
    }
    await recordReward(base44, {
      user_id: sub.user_id, user_email: sub.user_email, source: 'challenge', source_id: sub.challenge_id,
      source_name: challenge.name, reward_type: challenge.reward_type, reward_label: challenge.reward_label || challenge.name,
      points, discount_code: discountCode, product_id: challenge.product_id || '',
      amount: challenge.reward_type === 'credit' ? Number(challenge.reward_value) || 0 : 0, fulfillment: 'auto',
    });
    return Response.json({ success: true, status: 'approved', points, discount_code });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}