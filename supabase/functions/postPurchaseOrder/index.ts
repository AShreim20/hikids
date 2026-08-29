import { getCallerUser, callerClient, serviceRoleClient } from '../_shared/client.ts';
import { logAudit } from '../_shared/audit.ts';
import { handlePreflight, json } from '../_shared/cors.ts';

// Posts a draft purchase order — the only path that moves inventory and the
// supplier ledger. Idempotent: a PO that is already posted is a no-op.
// On post: each line increments product stock and sets product unit_cost to
// the line's purchase cost (latest-cost). The supplier ledger records a
// PURCHASE for the full total and a PAYMENT for the amount already paid, so
// the net owed equals (total - paid). Selling price is never touched.
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
    if (po.posted || po.status === 'posted') {
      return json({ success: true, posted: true, message: 'already posted' });
    }
    if (po.status === 'cancelled') {
      return json({ success: false, message: 'Cannot post a cancelled order' }, { status: 400 });
    }

    const items = Array.isArray(po.items) ? po.items : [];
    for (const line of items) {
      if (!line.product_id) continue;
      const qty = Math.max(0, Number(line.quantity) || 0);
      const cost = line.unit_cost == null || line.unit_cost === '' ? null : Number(line.unit_cost);
      if (qty > 0 || (cost != null && !Number.isNaN(cost))) {
        await service.rpc('adjust_product_stock', {
          p_product_id: line.product_id,
          p_delta: qty,
          p_unit_cost: cost != null && !Number.isNaN(cost) ? cost : null,
        });
      }
    }

    const total = Number(po.total) || 0;
    const paid = Math.max(0, Math.min(total, Number(po.paid_amount) || 0));
    const owed = Math.max(0, total - paid);

    const { data: supplier } = po.supplier_id
      ? await service.from('suppliers').select('*').eq('id', po.supplier_id).maybeSingle()
      : { data: null };

    if (po.supplier_id && total > 0) {
      const { data: txs } = await service.from('supplier_transactions').select('amount').eq('supplier_id', po.supplier_id);
      let bal = (txs || []).reduce((s, t) => s + (Number(t.amount) || 0), 0);

      await service.from('supplier_transactions').insert({
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
        await service.from('supplier_transactions').insert({
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
    await service.from('purchase_orders').update({
      posted: true,
      status: 'posted',
      posted_at: new Date().toISOString(),
      paid_amount: paid,
      remaining: owed,
      payment_status: paymentStatus,
      supplier_name: supplier?.name || po.supplier_name || '',
    }).eq('id', poId);

    await logAudit(service, {
      actor_id: user.id,
      actor_email: user.email,
      actor_role: profile?.role,
      action: 'po.posted',
      target_type: 'purchase_order',
      target_id: poId,
      details: `Posted ${po.po_number} — owed ${owed}`,
    });

    return json({ success: true, posted: true, remaining: owed, payment_status: paymentStatus });
  } catch (error) {
    return json({ success: false, message: error.message }, { status: 500 });
  }
});
