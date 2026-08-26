import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Backend enforcement of product-barcode uniqueness. The Product editor calls
// this before saving: it checks the supplied barcode against every product
// (service role, exact match) and returns a conflict if the barcode is owned
// by a different product. An empty barcode is always allowed. Editing a
// product may keep its own existing barcode (exclude_id).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ success: false, message: 'Admin only' }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const barcode = String(body.barcode || '').trim();
    if (!barcode) return Response.json({ success: true, unique: true });

    const excludeId = String(body.exclude_id || '');
    const rows = await base44.asServiceRole.entities.Product.filter({ barcode }).catch(() => []);
    const conflict = (rows || []).find((p) => p.id !== excludeId);
    if (conflict) {
      return Response.json({ success: true, unique: false, conflict: { id: conflict.id, name: conflict.name } });
    }
    return Response.json({ success: true, unique: true });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}