import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { can } from '../../shared/permissions.ts';
import { grantPoints, recordReward } from '../../shared/rewards.ts';

// Admin review of a customer photo review. Approving publishes the photo and
// grants the configured loyalty points exactly once (the review id is the
// idempotency key, so a repeated approve can never pay twice). Rejecting hides
// the photo and grants nothing.
async function getRewardPoints(base44) {
  try {
    const rows = await base44.asServiceRole.entities.Setting.filter({ key: 'photo_review_reward_points' });
    if (rows && rows.length) return Math.max(0, Math.trunc(Number(rows[0].value)));
  } catch {
    /* fall back to default */
  }
  return 50;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, message: 'Auth required' }, { status: 401 });
    if (!can(user, 'loyalty.add')) return Response.json({ success: false, message: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const reviewId = String(body.review_id || '');
    const action = body.action === 'reject' ? 'reject' : 'approve';
    if (!reviewId) return Response.json({ success: false, message: 'review_id required' }, { status: 400 });

    const review = await base44.asServiceRole.entities.Review.get(reviewId).catch(() => null);
    if (!review) return Response.json({ success: false, message: 'Review not found' }, { status: 404 });
    if (!review.photo_url) return Response.json({ success: false, message: 'Not a photo review' }, { status: 400 });

    if (action === 'reject') {
      await base44.asServiceRole.entities.Review.update(review.id, {
        status: 'rejected',
        reviewed_by: user.email,
        review_note: String(body.note || ''),
      });
      return Response.json({ success: true, status: 'rejected' });
    }

    // Approve: grant points once, then mark approved + reward_granted.
    const alreadyGranted = !!review.reward_granted;
    let points = 0;
    if (!alreadyGranted) {
      points = await getRewardPoints(base44);
      if (points > 0 && review.user_email) {
        await grantPoints(
          base44,
          { id: review.user_id, email: review.user_email },
          points,
          'Photo review reward',
          `photo-review-${review.id}`
        );
      }
      await recordReward(base44, {
        user_id: review.user_id || '',
        user_email: review.user_email || '',
        source: 'photo_review',
        source_id: review.id,
        source_name: 'Photo Review',
        reward_type: 'points',
        reward_label: 'Photo review reward',
        points,
        fulfillment: 'auto',
      });
    }

    await base44.asServiceRole.entities.Review.update(review.id, {
      status: 'approved',
      reviewed_by: user.email,
      review_note: String(body.note || ''),
      reward_granted: true,
    });
    return Response.json({ success: true, status: 'approved', points, already_granted: alreadyGranted });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}