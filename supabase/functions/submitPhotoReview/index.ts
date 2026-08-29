import { getCallerUser, serviceRoleClient } from '../_shared/client.ts';
import { handlePreflight, json } from '../_shared/cors.ts';

// A customer submits a review with a photo of their child using the product.
// The photo is NOT published and NO reward is granted here — both wait for
// admin approval (see reviewPhoto). The review is created in 'pending' status;
// the reviews_read_gated RLS policy hides pending/rejected photo reviews from
// everyone except the owner and admins.
Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  try {
    const user = await getCallerUser(req);
    if (!user) return json({ success: false, message: 'Auth required' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const productId = String(body.product_id || '');
    const fileUrl = String(body.file_url || '');
    if (!productId || !fileUrl) {
      return json({ success: false, message: 'product_id and file_url required' }, { status: 400 });
    }
    const rating = Math.min(5, Math.max(1, Math.trunc(Number(body.rating) || 5)));
    const name = String(body.name || '').trim() || user.email || 'Customer';
    const comment = String(body.comment || '').trim();

    const { error } = await serviceRoleClient().from('reviews').insert({
      product_id: productId,
      rating,
      name,
      comment,
      photo_url: fileUrl,
      status: 'pending',
      reward_granted: false,
      user_id: user.id,
      user_email: user.email,
      created_by_id: user.id,
    });
    if (error) throw error;

    return json({ success: true, status: 'pending' });
  } catch (error) {
    return json({ success: false, message: error.message }, { status: 500 });
  }
});
