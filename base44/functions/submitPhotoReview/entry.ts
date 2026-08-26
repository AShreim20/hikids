import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// A customer submits a review with a photo of their child using the product.
// The photo is NOT published and NO reward is granted here — both wait for
// admin approval (see reviewPhoto). The review is created in 'pending' status;
// the public review list hides pending/rejected photo reviews client-side.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, message: 'Auth required' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const productId = String(body.product_id || '');
    const fileUrl = String(body.file_url || '');
    if (!productId || !fileUrl) {
      return Response.json({ success: false, message: 'product_id and file_url required' }, { status: 400 });
    }
    const rating = Math.min(5, Math.max(1, Math.trunc(Number(body.rating) || 5)));
    const name = String(body.name || '').trim() || user.full_name || user.email || 'Customer';
    const comment = String(body.comment || '').trim();

    await base44.asServiceRole.entities.Review.create({
      product_id: productId,
      rating,
      name,
      comment,
      photo_url: fileUrl,
      status: 'pending',
      reward_granted: false,
      user_id: user.id || '',
      user_email: user.email,
    });

    return Response.json({ success: true, status: 'pending' });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}