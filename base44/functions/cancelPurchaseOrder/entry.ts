import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Cancels a purchase order. A draft simply flips to cancelled. A posted order
// is reversed: each line's quantity is subtracted back from product stock and
// a REVERSAL ledger entry removes the portion that was still owed at post time
// (stored on the PO as `remaining`). Selling price is never touched, and the
// unit_cost set at post is intentionally left in place (latest cost).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, message: 'Auth required' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ success: false, message: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const poId = String(body.po_id || '');
    if (!poId) return Response.json({ success: false, message: 'po_id required' }, { status: 400 });

    const po = await base44.asServiceRole.entities.PurchaseOrder.get(poId);
    if (!po) return Response.json({ success: false, message: 'Purchase order not found' }, { status: 404 });
    if (po.status === 'cancelled') {
      return Response.json({ success: true, cancelled: true, message: 'already cancelled' });
    }

    if (po.posted || po.status === 'posted') {
      // Reverse inventory for every line.
      const items = Array.isArray(po.items) ? po.items : [];
      for (const line of items) {
        if (!line.product_id) continue;
        const qty = Math.max(0, Number(line.quantity) || 0);
        if (qty > 0) {
          await base44.asServiceRole.entities.Product.updateMany(
            { id: line.product_id },
            { $inc: { stock: -qty } }
          );
        }
      }

      // Reverse the supplier ledger by the amount that was still owed at post.
      const remaining = Number(po.remaining) || 0;
      if (po.supplier_id && remaining > 0) {
        const txs = await base44.asServiceRole.entities.SupplierTransaction.filter({ supplier_id: po.supplier_id }).catch(() => []);
        const bal = (txs || []).reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const supplier = await base44.asServiceRole.entities.Supplier.get(po.supplier_id).catch(() => null);
        await base44.asServiceRole.entities.SupplierTransaction.create({
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

    await base44.asServiceRole.entities.PurchaseOrder.update(poId, { status: 'cancelled' });

    await base44.functions.invoke('logAuditActivity', {
      action: 'po.cancelled',
      target_type: 'purchase_order',
      target_id: poId,
      details: `Cancelled ${po.po_number}`,
    }).catch(() => {});

    return Response.json({ success: true, cancelled: true });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}