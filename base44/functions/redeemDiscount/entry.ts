import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Increments a code's used_count after a successful order. Called by checkout
// once the order is placed. Runs as the service role (admin-only writes).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const code_id = String(body.code_id || '');
    if (!code_id) return Response.json({ success: false });

    const list = await base44.asServiceRole.entities.DiscountCode.filter({ id: code_id });
    const dc = list[0];
    if (!dc) return Response.json({ success: false });

    await base44.asServiceRole.entities.DiscountCode.update(code_id, {
      used_count: (dc.used_count || 0) + 1,
    });
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}