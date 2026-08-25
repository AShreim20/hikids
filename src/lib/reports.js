import { normalizeStatus, RETURN_STATUSES } from '@/lib/orderStatus';

export const PERIODS = [
  { id: 'today', labelKey: 'reports.today' },
  { id: 'week', labelKey: 'reports.week' },
  { id: 'month', labelKey: 'reports.month' },
  { id: 'year', labelKey: 'reports.year' },
  { id: 'custom', labelKey: 'reports.custom' },
];

export function periodRange(id, custom = {}) {
  const now = new Date();
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  let start = new Date(now); start.setHours(0, 0, 0, 0);
  if (id === 'week') {
    const d = (now.getDay() + 6) % 7; // Monday-start
    start.setDate(now.getDate() - d);
  } else if (id === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (id === 'year') {
    start = new Date(now.getFullYear(), 0, 1);
  } else if (id === 'custom') {
    const s = custom.from ? new Date(custom.from) : null;
    const e = custom.to ? new Date(new Date(custom.to).setHours(23, 59, 59, 999)) : new Date(end);
    return { start: s, end: e };
  }
  return { start, end };
}

export function inRange(date, range) {
  if (!date) return false;
  const d = new Date(date);
  if (range.start && d < range.start) return false;
  if (range.end && d > range.end) return false;
  return true;
}

const num = (n) => Number(n) || 0;
const itemRevenue = (it) => num(it.price) * num(it.quantity);

// Map product id -> product (for unit cost + category lookups).
export function buildProductMap(products) {
  const m = {};
  for (const p of products || []) m[p.id] = p;
  return m;
}

export function salesReport(orders, productMap, range) {
  const inR = (orders || []).filter((o) => inRange(o.created_date, range));
  const active = inR.filter((o) => normalizeStatus(o.status) !== 'cancelled');
  const returns = inR.filter((o) => RETURN_STATUSES.includes(normalizeStatus(o.status)));

  let gross = 0, discounts = 0, net = 0, cogs = 0;
  const byDate = {};
  const byProduct = {};
  const byCategory = {};

  for (const o of active) {
    gross += num(o.subtotal);
    discounts += num(o.discount_amount) + num(o.loyalty_discount);
    net += num(o.total);
    const day = (o.created_date || '').slice(0, 10);
    byDate[day] = (byDate[day] || 0) + num(o.total);
    for (const it of o.items || []) {
      const rev = itemRevenue(it);
      cogs += num(productMap[it.product_id]?.unit_cost) * num(it.quantity);
      const key = it.name || it.product_id || '—';
      byProduct[key] = byProduct[key] || { name: key, qty: 0, revenue: 0 };
      byProduct[key].qty += num(it.quantity);
      byProduct[key].revenue += rev;
      const cat = productMap[it.product_id]?.category;
      if (cat) byCategory[cat] = (byCategory[cat] || 0) + rev;
    }
  }
  const returnsTotal = returns.reduce((s, o) => s + num(o.total), 0);

  return {
    orderCount: active.length,
    gross,
    discounts,
    net,
    returnsTotal,
    returnsCount: returns.length,
    cogs,
    grossProfit: net - cogs,
    byDate: Object.entries(byDate).map(([date, total]) => ({ date, total })).sort((a, b) => a.date.localeCompare(b.date)),
    byProduct: Object.values(byProduct).sort((a, b) => b.revenue - a.revenue),
    byCategory: Object.entries(byCategory).map(([category, revenue]) => ({ category, revenue })).sort((a, b) => b.revenue - a.revenue),
  };
}

export function paymentsReport(orders, supplierTxs, range) {
  const inR = (orders || []).filter((o) => inRange(o.created_date, range));
  let totalIn = 0, completed = 0, pending = 0, failed = 0;
  const byMethod = {};
  const byDate = {};
  for (const o of inR) {
    const ps = o.payment_status || 'unpaid';
    const amt = num(o.total);
    const day = (o.created_date || '').slice(0, 10);
    if (ps === 'paid') { totalIn += amt; completed += amt; byDate[day] = (byDate[day] || 0) + amt; }
    else if (ps === 'failed') failed += amt;
    else pending += amt;
    const m = o.payment_method || 'unknown';
    byMethod[m] = byMethod[m] || { method: m, total: 0, count: 0 };
    if (ps === 'paid') { byMethod[m].total += amt; byMethod[m].count += 1; }
  }
  const supIn = (supplierTxs || []).filter((x) => inRange(x.created_date, range) && x.type === 'PAYMENT');
  const supplierOut = supIn.reduce((s, x) => s + num(x.amount), 0);
  return {
    totalIn,
    completed,
    pending,
    failed,
    byMethod: Object.values(byMethod).sort((a, b) => b.total - a.total),
    byDate: Object.entries(byDate).map(([date, total]) => ({ date, total })).sort((a, b) => a.date.localeCompare(b.date)),
    supplierOut,
    supplierPaymentCount: supIn.length,
  };
}

export function purchasesReport(purchaseOrders, range) {
  const inR = (purchaseOrders || []).filter((p) => inRange(p.purchase_date || p.created_date, range) && p.status === 'posted');
  let total = 0;
  const bySupplier = {};
  const byProduct = {};
  const byDate = {};
  for (const p of inR) {
    total += num(p.total);
    const day = (p.purchase_date || p.created_date || '').slice(0, 10);
    byDate[day] = (byDate[day] || 0) + num(p.total);
    const sup = p.supplier_name || '—';
    bySupplier[sup] = (bySupplier[sup] || 0) + num(p.total);
    for (const it of p.items || []) {
      const key = it.name || it.product_id || '—';
      byProduct[key] = byProduct[key] || { name: key, qty: 0, cost: 0 };
      byProduct[key].qty += num(it.quantity);
      byProduct[key].cost += num(it.total);
    }
  }
  return {
    total,
    count: inR.length,
    bySupplier: Object.entries(bySupplier).map(([supplier, total]) => ({ supplier, total })).sort((a, b) => b.total - a.total),
    byProduct: Object.values(byProduct).sort((a, b) => b.cost - a.cost),
    byDate: Object.entries(byDate).map(([date, total]) => ({ date, total })).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export function profitLoss(orders, productMap, range) {
  const inR = (orders || []).filter((o) => inRange(o.created_date, range) && normalizeStatus(o.status) !== 'cancelled');
  let revenue = 0, cogs = 0;
  for (const o of inR) {
    revenue += num(o.total);
    for (const it of o.items || []) {
      cogs += num(productMap[it.product_id]?.unit_cost) * num(it.quantity);
    }
  }
  const grossProfit = revenue - cogs;
  const expenses = 0; // No separate expense entity — supplier payments are inventory (COGS), not opex.
  const netProfit = grossProfit - expenses;
  return { revenue, cogs, grossProfit, expenses, netProfit, orderCount: inR.length };
}