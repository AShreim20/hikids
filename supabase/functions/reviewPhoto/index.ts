import { callerClient, getCallerUser, serviceRoleClient } from '../_shared/client.ts';
import { handlePreflight, json } from '../_shared/cors.ts';

// Admin review of a customer photo review. Approving publishes the photo and
// grants the configured loyalty points exactly once (the review id is the
// idempotency key, so a repeated approve can never pay twice). Rejecting hides
// the photo and grants nothing.
async function getRewardPoints(service) {
  try {
    const { data } = await service
      .from('settings')
      .select('value')
      .eq('key', 'photo_review_reward_points')
      .maybeSingle();
    if (data && data.value != null) return Math.max(0, Math.trunc(Number(data.value)));
  } catch {
    /* fall back to default */
  }
  return 50;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  try {
    const user = await getCallerUser(req);
    if (!user) return json({ success: false, message: 'Auth required' }, { status: 401 });

    const { data: profile } = await callerClient(req)
      .from('profiles')
      .select('role, permissions')
      .eq('id', user.id)
      .maybeSingle();
    const canReview = profile?.role === 'admin' || (profile?.permissions || []).includes('loyalty.add');
    if (!canReview) return json({ success: false, message: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const reviewId = String(body.review_id || '');
    const action = body.action === 'reject' ? 'reject' : 'approve';
    if (!reviewId) return json({ success: false, message: 'review_id required' }, { status: 400 });

    const service = serviceRoleClient();
    const { data: review } = await service.from('reviews').select('*').eq('id', reviewId).maybeSingle();
    if (!review) return json({ success: false, message: 'Review not found' }, { status: 404 });
    if (!review.photo_url) return json({ success: false, message: 'Not a photo review' }, { status: 400 });

    if (action === 'reject') {
      const { error } = await service
        .from('reviews')
        .update({ status: 'rejected', reviewed_by: user.email, review_note: String(body.note || '') })
        .eq('id', review.id);
      if (error) throw error;
      return json({ success: true, status: 'rejected' });
    }

    // Approve: grant points once, then mark approved + reward_granted.
    const alreadyGranted = !!review.reward_granted;
    let points = 0;
    if (!alreadyGranted) {
      points = await getRewardPoints(service);
      if (points > 0 && review.user_email) {
        const { data: wallet, error: walletError } = await service.rpc('get_or_create_wallet', {
          p_user_id: review.user_id || null,
          p_user_email: review.user_email,
        });
        if (walletError) throw walletError;
        const { error: ledgerError } = await service.rpc('post_ledger', {
          p_wallet_id: wallet.id,
          p_points: points,
          p_type: 'ADMIN_CREDIT',
          p_reason: 'Photo review reward',
          p_idempotency_key: `photo-review-${review.id}`,
        });
        if (ledgerError) throw ledgerError;
      }
      const { error: rhError } = await service.from('reward_history').insert({
        user_id: review.user_id || null,
        user_email: review.user_email || '',
        source: 'photo_review',
        source_id: review.id,
        source_name: 'Photo Review',
        reward_type: 'points',
        reward_label: 'Photo review reward',
        points,
        fulfillment: 'auto',
      });
      if (rhError) throw rhError;
    }

    const { error } = await service
      .from('reviews')
      .update({
        status: 'approved',
        reviewed_by: user.email,
        review_note: String(body.note || ''),
        reward_granted: true,
      })
      .eq('id', review.id);
    if (error) throw error;

    return json({ success: true, status: 'approved', points, already_granted: alreadyGranted });
  } catch (error) {
    return json({ success: false, message: error.message }, { status: 500 });
  }
});
