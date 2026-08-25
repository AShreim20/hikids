import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Posts a draft purchase order — the only path that moves inventory and the
// supplier ledger. Idempotent: a PO that is already posted is a no-op.
// On post: each line increments product stock and sets product unit_cost to
// the line's purchase cost (latest-cost). The supplier ledger records a
// PURCHASE for the full total and a PAYMENT for the amount already paid, so
// the net owed equals (total - paid). Selling price is never touched.
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
    if (po.posted || po.status === 'posted') {
      return Response.json({ success: true, posted: true, message: 'already posted' });
    }
    if (po.status === 'cancelled') {
      return Response.json({ success: false, message: 'Cannot post a cancelled order' }, { status: 400 });
    }

    const items = Array.isArray(po.items) ? po.items : [];
    for (const line of items) {
      if (!line.product_id) continue;
      const qty = Math.max(0, Number(line.quantity) || 0);
      const cost = line.unit_cost == null || line.unit_cost === '' ? null : Number(line.unit_cost);
      if (qty > 0) {
        const ops = { $inc: { stock: qty } };
        if (cost != null && !Number.isNaN(cost)) ops.$set = { unit_cost: cost };
        await base44.asServiceRole.entities.Product.updateMany({ id: line.product_id }, ops);
      } else if (cost != null && !Number.isNaN(cost)) {
        await base44.asServiceRole.entities.Product.updateMany({ id: line.product_id }, { $set: { unit_cost: cost } });
      }
    }

    const total = Number(po.total) || 0;
    const paid = Math.max(0, Math.min(total, Number(po.paid_amount) || 0));
    const owed = Math.max(0, total - paid);

    const supplier = po.supplier_id
      ? await base44.asServiceRole.entities.Supplier.get(po.supplier_id).catch(() => null)
      : null;

    if (po.supplier_id && total > 0) {
      const txs = await base44.asServiceRole.entities.SupplierTransaction.filter({ supplier_id: po.supplier_id }).catch(() => []);
      let bal = (txs || []).reduce((s, t) => s + (Number(t.amount) || 0), 0);

      await base44.asServiceRole.entities.SupplierTransaction.create({
        supplier_id: po.supplier_id,
        supplier_name: supplier?.name || po.supplier_name || '',
        type: 'PURCHASE',
        amount: total,
        po_id: poId,
        po_number: po.po_number || '',
        reason: `Purchase ${po.po_number || poId}`,
        actor_email: user.email,
        balance_before: bal,
        balance_after: bal + total,
      });
      bal += total;

      if (paid > 0) {
        await base44.asServiceRole.entities.SupplierTransaction.create({
          supplier_id: po.supplier_id,
          supplier_name: supplier?.name || po.supplier_name || '',
          type: 'PAYMENT',
          amount: -paid,
          po_id: poId,
          po_number: po.po_number || '',
          reason: `Payment on ${po.po_number || poId} (at post)`,
          actor_email: user.email,
          balance_before: bal,
          balance_after: bal - paid,
        });
      }
    }

    const paymentStatus = total <= 0 ? 'unpaid' : paid >= total ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
    await base44.asServiceRole.entities.PurchaseOrder.update(poId, {
      posted: true,
      status: 'posted',
      posted_at: new Date().toISOString(),
      paid_amount: paid,
      remaining: owed,
      payment_status: paymentStatus,
      supplier_name: supplier?.name || po.supplier_name || '',
    });

    await base44.functions.invoke('logAuditActivity', {
      action: 'po.posted',
      target_type: 'purchase_order',
      target_id: poId,
      details: `Posted ${po.po_number} — owed ${owed}`,
    }).catch(() => {});

    return Response.json({ success: true, posted: true, remaining: owed, payment_status: paymentStatus });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}