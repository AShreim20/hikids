import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Records a standalone payment against a supplier, reducing the amount owed.
// The supplier balance is always the running sum of the ledger, so this just
// appends a PAYMENT entry (negative amount) and returns the new balance.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, message: 'Auth required' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ success: false, message: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const supplierId = String(body.supplier_id || '');
    if (!supplierId) return Response.json({ success: false, message: 'supplier_id required' }, { status: 400 });
    const amount = Math.abs(Number(body.amount) || 0);
    if (!amount) return Response.json({ success: false, message: 'amount required' }, { status: 400 });

    const reason = String(body.reason || 'Supplier payment').trim();

    const supplier = await base44.asServiceRole.entities.Supplier.get(supplierId).catch(() => null);
    const txs = await base44.asServiceRole.entities.SupplierTransaction.filter({ supplier_id: supplierId }).catch(() => []);
    const bal = (txs || []).reduce((s, t) => s + (Number(t.amount) || 0), 0);

    await base44.asServiceRole.entities.SupplierTransaction.create({
      supplier_id: supplierId,
      supplier_name: supplier?.name || '',
      type: 'PAYMENT',
      amount: -amount,
      po_id: body.po_id ? String(body.po_id) : '',
      po_number: body.po_number ? String(body.po_number) : '',
      reason,
      actor_email: user.email,
      balance_before: bal,
      balance_after: bal - amount,
    });

    await base44.functions.invoke('logAuditActivity', {
      action: 'supplier.payment',
      target_type: 'supplier',
      target_id: supplierId,
      details: `Payment ${amount} — ${reason}`,
    }).catch(() => {});

    return Response.json({ success: true, balance: bal - amount });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}