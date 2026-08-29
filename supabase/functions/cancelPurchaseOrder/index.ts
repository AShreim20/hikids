import { getCallerUser, callerClient, serviceRoleClient } from '../_shared/client.ts';
import { logAudit } from '../_shared/audit.ts';
import { handlePreflight, json } from '../_shared/cors.ts';

// Cancels a purchase order. A draft simply flips to cancelled. A posted order
// is reversed: each line's quantity is subtracted back from product stock and
// a REVERSAL ledger entry removes the portion that was still owed at post time
// (stored on the PO as `remaining`). Selling price is never touched, and the
// unit_cost set at post is intentionally left in place (latest cost).
Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  try {
    const user = await getCallerUser(req);
    if (!user) return json({ success: false, message: 'Auth required' }, { status: 401 });
    const { data: profile } = await callerClient(req).from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'admin') return json({ success: false, message: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const poId = String(body.po_id || '');
    if (!poId) return json({ success: false, message: 'po_id required' }, { status: 400 });

    const service = serviceRoleClient();
    const { data: po } = await service.from('purchase_orders').select('*').eq('id', poId).maybeSingle();
    if (!po) return json({ success: false, message: 'Purchase order not found' }, { status: 404 });
    if (po.status === 'cancelled') {
      return json({ success: true, cancelled: true, message: 'already cancelled' });
    }

    if (po.posted || po.status === 'posted') {
      const items = Array.isArray(po.items) ? po.items : [];
      for (const line of items) {
        if (!line.product_id) continue;
        const qty = Math.max(0, Number(line.quantity) || 0);
        if (qty > 0) {
          await service.rpc('adjust_product_stock', { p_product_id: line.product_id, p_delta: -qty });
        }
      }

      const remaining = Number(po.remaining) || 0;
      if (po.supplier_id && remaining > 0) {
        const { data: txs } = await service.from('supplier_transactions').select('amount').eq('supplier_id', po.supplier_id);
        const bal = (txs || []).reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const { data: supplier } = await service.from('suppliers').select('*').eq('id', po.supplier_id).maybeSingle();
        await service.from('supplier_transactions').insert({
          supplier_id: po.supplier_id,
          supplier_name: supplier?.name || po.supplier_name || '',
          type: 'REVERSAL',
          amount: -remaining,
          po_id: poId,
          po_number: po.po_number || '',
          reason: `Cancellation of ${po.po_number || poId}`,
          actor_email: user.email,
          balance_before: bal,
          balance_after: bal - remaining,
        });
      }
    }

    await service.from('purchase_orders').update({ status: 'cancelled' }).eq('id', poId);

    await logAudit(service, {
      actor_id: user.id,
      actor_email: user.email,
      actor_role: profile?.role,
      action: 'po.cancelled',
      target_type: 'purchase_order',
      target_id: poId,
      details: `Cancelled ${po.po_number}`,
    });

    return json({ success: true, cancelled: true });
  } catch (error) {
    return json({ success: false, message: error.message }, { status: 500 });
  }
});
