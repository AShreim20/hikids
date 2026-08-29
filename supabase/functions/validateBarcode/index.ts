import { callerClient, getCallerUser } from '../_shared/client.ts';
import { handlePreflight, json } from '../_shared/cors.ts';

// Backend enforcement of product-barcode uniqueness — replaces Base44's
// validateBarcode function. The Product editor calls this before saving: it
// checks the supplied barcode against every product and returns a conflict
// if the barcode is owned by a different product. An empty barcode is always
// allowed. Editing a product may keep its own existing barcode (exclude_id).
// Products are public-read (see 0001_init.sql), so the caller-scoped client
// can do the lookup itself — no service role needed — but the admin check is
// kept to match the original admin-only gate.
Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  try {
    const user = await getCallerUser(req);
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    const client = callerClient(req);
    const { data: profile } = await client
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (profile?.role !== 'admin') return json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const barcode = String(body.barcode || '').trim();
    if (!barcode) return json({ success: true, unique: true });

    const excludeId = String(body.exclude_id || '');
    const { data: rows, error } = await client
      .from('products')
      .select('id, name')
      .eq('barcode', barcode);
    if (error) return json({ error: error.message }, { status: 400 });

    const conflict = (rows || []).find((p) => p.id !== excludeId);
    if (conflict) {
      return json({ success: true, unique: false, conflict: { id: conflict.id, name: conflict.name } });
    }
    return json({ success: true, unique: true });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
});
