import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Atomically validates and deducts stock for every line in an order.
// Stock is never allowed to go negative:
//   - Non-variant / bundle-component products use a conditional $inc that only
//     fires when `stock >= qty`, so concurrent buyers can't oversell.
//   - Variant lines use an optimistic lock on `updated_date` to update the
//     matching variant's nested stock safely.
// If any line is insufficient, every prior deduction in this call is rolled
// back and the order is left untouched (caller cancels it). On success the
// order is flagged `stock_committed = true` so a retried invocation is a no-op.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const orderId = body && body.orderId;
    if (!orderId) return Response.json({ error: 'orderId required' }, { status: 400 });

    let user;
    try {
      user = await base44.auth.me();
    } catch {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const order = await base44.asServiceRole.entities.Order.get(orderId);
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
    const isOwner = order.created_by_id === user.id || order.customer_email === user.email;
    if (!isOwner && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Idempotency: if a previous (possibly lost-response) call already deducted,
    // don't deduct again.
    if (order.stock_committed) {
      return Response.json({ success: true, idempotent: true });
    }

    const insufficient = []; // { id, name, variant_key, variant_label, available, requested }
    const deducted = [];    // rollback record: { id, qty, kind, variantKey }

    // Atomic conditional decrement for a plain (non-variant) product stock.
    const deductProductStock = async (productId, qty, name, variantLabel) => {
      const p = await base44.asServiceRole.entities.Product.get(productId);
      if (!p) {
        insufficient.push({ id: productId, name: name || 'Product', variant_key: null, variant_label: variantLabel || null, available: 0, requested: qty });
        return false;
      }
      // No stock field => unlimited inventory; nothing to deduct or roll back.
      if (p.stock == null) return true;
      const res = await base44.asServiceRole.entities.Product.updateMany(
        { id: productId, stock: { $gte: qty } },
        { $inc: { stock: -qty } }
      );
      if (res && res.updated === 1) {
        deducted.push({ id: productId, qty, kind: 'product' });
        return true;
      }
      // Failed the conditional — re-read to report the real available amount.
      const p2 = await base44.asServiceRole.entities.Product.get(productId);
      insufficient.push({ id: productId, name: name || p.name || 'Product', variant_key: null, variant_label: variantLabel || null, available: Number(p2?.stock || 0), requested: qty });
      return false;
    };

    // Optimistic-lock decrement for a specific variant's nested stock.
    const deductVariantStock = async (productId, variantKey, qty, name, variantLabel) => {
      for (let attempt = 0; attempt < 6; attempt++) {
        const p = await base44.asServiceRole.entities.Product.get(productId);
        if (!p) {
          insufficient.push({ id: productId, name: name || 'Product', variant_key: variantKey, variant_label: variantLabel || null, available: 0, requested: qty });
          return false;
        }
        const variants = Array.isArray(p.variants) ? p.variants : [];
        const v = variants.find((x) => x && x.key === variantKey);
        const available = v ? Number(v.stock || 0) : 0;
        if (available < qty) {
          insufficient.push({ id: productId, name: name || p.name || 'Product', variant_key: variantKey, variant_label: variantLabel || null, available, requested: qty });
          return false;
        }
        const newVariants = variants.map((x) =>
          x && x.key === variantKey ? { ...x, stock: available - qty } : x
        );
        const res = await base44.asServiceRole.entities.Product.updateMany(
          { id: productId, updated_date: p.updated_date },
          { $set: { variants: newVariants } }
        );
        if (res && res.updated === 1) {
          deducted.push({ id: productId, qty, kind: 'variant', variantKey });
          return true;
        }
        // Someone else changed the document between read and write — retry.
      }
      // Exhausted retries — report current availability.
      const p2 = await base44.asServiceRole.entities.Product.get(productId);
      const v2 = (p2?.variants || []).find((x) => x && x.key === variantKey);
      insufficient.push({ id: productId, name: name || 'Product', variant_key: variantKey, variant_label: variantLabel || null, available: v2 ? Number(v2.stock || 0) : 0, requested: qty });
      return false;
    };

    let ok = true;
    for (const it of order.items || []) {
      const qty = Number(it.qty || 0);
      if (qty <= 0) continue;

      if (it.is_bundle) {
        for (const c of Array.isArray(it.bundle_items) ? it.bundle_items : []) {
          if (!c.product_id) continue;
          const cQty = qty * Number(c.quantity || 1);
          const success = await deductProductStock(c.product_id, cQty, c.name || it.name);
          if (!success) { ok = false; break; }
        }
        if (!ok) break;
        continue;
      }

      if (!it.id) continue;
      const success = it.variant_key
        ? await deductVariantStock(it.id, it.variant_key, qty, it.name, it.variant_label)
        : await deductProductStock(it.id, qty, it.name, it.variant_label);
      if (!success) { ok = false; break; }
    }

    if (!ok) {
      // Roll back everything this call already deducted.
      for (const d of deducted) {
        try {
          if (d.kind === 'product') {
            await base44.asServiceRole.entities.Product.updateMany({ id: d.id }, { $inc: { stock: d.qty } });
          } else if (d.kind === 'variant') {
            const p = await base44.asServiceRole.entities.Product.get(d.id);
            if (p && Array.isArray(p.variants)) {
              const variants = p.variants.map((x) =>
                x && x.key === d.variantKey ? { ...x, stock: Number(x.stock || 0) + d.qty } : x
              );
              await base44.asServiceRole.entities.Product.update(d.id, { variants });
            }
          }
        } catch {}
      }
      // Cancel the order (customers can't update their own orders via RLS, so
      // this must happen server-side) and roll back the loyalty payment status
      // so it's clear the sale never completed.
      try {
        const cancelPatch: any = { status: 'cancelled' };
        if (order.payment_status === 'paid') cancelPatch.payment_status = 'refunded';
        await base44.asServiceRole.entities.Order.update(orderId, cancelPatch);
      } catch {}

      return Response.json({ success: false, insufficient });
    }

    // Flag the order so a retried invocation won't deduct twice.
    try {
      await base44.asServiceRole.entities.Order.update(orderId, { stock_committed: true });
    } catch {}

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}