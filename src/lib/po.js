// Shared purchasing helpers (currency-agnostic; uses the app's formatPrice for display).

export const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'cheque'];
export const PO_STATUSES = ['draft', 'posted', 'cancelled'];
export const PO_PAYMENT_STATUSES = ['unpaid', 'partial', 'paid'];

export const lineTotal = (l) => (Number(l?.quantity) || 0) * (Number(l?.unit_cost) || 0);
export const poSubtotal = (items = []) => items.reduce((s, l) => s + lineTotal(l), 0);

export const computePaymentStatus = (total, paid) => {
  const t = Number(total) || 0;
  const p = Math.max(0, Math.min(t, Number(paid) || 0));
  if (t <= 0) return 'unpaid';
  if (p >= t) return 'paid';
  if (p > 0) return 'partial';
  return 'unpaid';
};

// Build a PO number like PO-20260825-0007 based on existing count.
export const generatePoNumber = (existing = []) => {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const n = ((existing?.length || 0) + 1).toString().padStart(4, '0');
  return `PO-${ymd}-${n}`;
};

// First matching SKU across the product's variants (used as "product number/code").
export const productSku = (p) => {
  const variants = Array.isArray(p?.variants) ? p.variants : [];
  const v = variants.find((x) => x && x.sku);
  return v?.sku || '';
};

// Fast client-side product match by name, variant SKU, or record id fragment.
export const productMatches = (p, q) => {
  if (!q) return true;
  const term = q.trim().toLowerCase();
  if (!term) return true;
  if ((p.name || '').toLowerCase().includes(term)) return true;
  if (productSku(p).toLowerCase().includes(term)) return true;
  if (String(p.id || '').toLowerCase().includes(term)) return true;
  return false;
};