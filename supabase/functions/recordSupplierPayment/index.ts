import { getCallerUser, callerClient, serviceRoleClient } from '../_shared/client.ts';
import { logAudit } from '../_shared/audit.ts';
import { handlePreflight, json } from '../_shared/cors.ts';

// Records a standalone payment against a supplier, reducing the amount owed.
// The supplier balance is always the running sum of the ledger, so this just
// appends a PAYMENT entry (negative amount) and returns the new balance.
Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  try {
    const user = await getCallerUser(req);
    if (!user) return json({ success: false, message: 'Auth required' }, { status: 401 });
    const { data: profile } = await callerClient(req).from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'admin') return json({ success: false, message: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const supplierId = String(body.supplier_id || '');
    if (!supplierId) return json({ success: false, message: 'supplier_id required' }, { status: 400 });
    const amount = Math.abs(Number(body.amount) || 0);
    if (!amount) return json({ success: false, message: 'amount required' }, { status: 400 });

    const reason = String(body.reason || 'Supplier payment').trim();

    const service = serviceRoleClient();
    const { data: supplier } = await service.from('suppliers').select('*').eq('id', supplierId).maybeSingle();
    const { data: txs } = await service.from('supplier_transactions').select('amount').eq('supplier_id', supplierId);
    const bal = (txs || []).reduce((s, t) => s + (Number(t.amount) || 0), 0);

    await service.from('supplier_transactions').insert({
      supplier_id: supplierId,
      supplier_name: supplier?.name || '',
      type: 'PAYMENT',
      amount: -amount,
      po_id: body.po_id ? String(body.po_id) : null,
      po_number: body.po_number ? String(body.po_number) : '',
      reason,
      actor_email: user.email,
      balance_before: bal,
      balance_after: bal - amount,
    });

    await logAudit(service, {
      actor_id: user.id,
      actor_email: user.email,
      actor_role: profile?.role,
      action: 'supplier.payment',
      target_type: 'supplier',
      target_id: supplierId,
      details: `Payment ${amount} — ${reason}`,
    });

    return json({ success: true, balance: bal - amount });
  } catch (error) {
    return json({ success: false, message: error.message }, { status: 500 });
  }
});
