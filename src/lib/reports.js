import { normalizeStatus, RETURN_STATUSES } from '@/lib/orderStatus';

export const PERIODS = [
  { id: 'today', labelKey: 'reports.today' },
  { id: 'yesterday', labelKey: 'reports.yesterday' },
  { id: 'week', labelKey: 'reports.week' },
  { id: 'month', labelKey: 'reports.month' },
  { id: 'lastMonth', labelKey: 'reports.lastMonth' },
  { id: 'year', labelKey: 'reports.year' },
  { id: 'custom', labelKey: 'reports.custom' },
];

export function periodRange(id, custom = {}) {
  const now = new Date();
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  let start = new Date(now); start.setHours(0, 0, 0, 0);
  if (id === 'yesterday') {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);
  } else if (id === 'week') {
    const d = (now.getDay() + 6) % 7; // Monday-start
    start.setDate(now.getDate() - d);
  } else if (id === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (id === 'lastMonth') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end2 = new Date(now.getFullYear(), now.getMonth(), 0);
    end2.setHours(23, 59, 59, 999);
    return { start, end: end2 };
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
// Order line items are stored as {id, name, price, qty, ...} (see
// src/pages/Checkout.jsx / secure_order in 0008_orders_phase5.sql) — NOT
// {product_id, quantity}. A bundle line is the one exception: it carries its
// own `id`/`qty` for the bundle itself, plus a `bundle_items[]` array whose
// entries use `product_id`/`quantity` (see src/pages/BundleDetail.jsx).
const itemRevenue = (it) => num(it.price) * num(it.qty);

// Cost of goods sold for one order line, in the product's *current* unit
// cost (matches translations.js's documented "COGS uses current product unit
// cost" behavior). Bundle lines have no unit_cost of their own — they're
// costed by expanding into their component products.
function lineCogs(it, productMap) {
  if (it.is_bundle) {
    return (it.bundle_items || []).reduce(
      (s, c) => s + num(productMap[c.product_id]?.unit_cost) * num(c.quantity) * num(it.qty),
      0
    );
  }
  return num(productMap[it.id]?.unit_cost) * num(it.qty);
}

// Map product id -> product (for unit cost + category lookups).
export function buildProductMap(products) {
  const m = {};
  for (const p of products || []) m[p.id] = p;
  return m;
}

// Map expense_category id -> category (bilingual name lookup for reports).
export function buildCategoryMap(categories) {
  const m = {};
  for (const c of categories || []) m[c.id] = c;
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
      cogs += lineCogs(it, productMap);
      const key = it.name || it.id || '—';
      byProduct[key] = byProduct[key] || { name: key, qty: 0, revenue: 0 };
      byProduct[key].qty += num(it.qty);
      byProduct[key].revenue += rev;
      // Bundles have no single category of their own (each component product
      // does) — only attribute revenue to a category for plain product lines.
      const cat = !it.is_bundle ? productMap[it.id]?.category : null;
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

// Operating expenses only — rent, salaries, marketing, etc. Deliberately
// separate from purchasesReport: supplier purchases are inventory and already
// reach the P&L through COGS, so they must never appear here too.
export function expensesReport(expenses, categories, range) {
  const categoryMap = buildCategoryMap(categories);
  const inR = (expenses || []).filter((e) => inRange(e.expense_date || e.created_date, range));
  const total = inR.reduce((s, e) => s + num(e.amount), 0);
  const byCategory = {};
  const byDate = {};
  const byMethod = {};
  for (const e of inR) {
    const cat = categoryMap[e.category_id];
    const key = e.category_id || 'uncategorized';
    byCategory[key] = byCategory[key] || {
      category_id: e.category_id || null,
      name: cat?.name || null,
      name_en: cat?.name_en || null,
      total: 0,
      count: 0,
    };
    byCategory[key].total += num(e.amount);
    byCategory[key].count += 1;
    const day = (e.expense_date || e.created_date || '').slice(0, 10);
    byDate[day] = (byDate[day] || 0) + num(e.amount);
    const m = e.payment_method || 'unknown';
    byMethod[m] = (byMethod[m] || 0) + num(e.amount);
  }
  return {
    total,
    count: inR.length,
    byCategory: Object.values(byCategory).sort((a, b) => b.total - a.total),
    byDate: Object.entries(byDate).map(([date, total]) => ({ date, total })).sort((a, b) => a.date.localeCompare(b.date)),
    byMethod: Object.entries(byMethod).map(([method, total]) => ({ method, total })).sort((a, b) => b.total - a.total),
  };
}

// `expenseRows`/`expenseCategories` default to [] so every existing call site
// (before Reports.jsx is updated to pass them) keeps working with expenses=0,
// exactly like the previous hardcoded literal — no call site breaks mid-rollout.
export function profitLoss(orders, productMap, range, expenseRows = [], expenseCategories = []) {
  const inR = (orders || []).filter((o) => inRange(o.created_date, range) && normalizeStatus(o.status) !== 'cancelled');
  let grossSales = 0, discounts = 0, revenue = 0, cogs = 0;
  for (const o of inR) {
    grossSales += num(o.subtotal);
    discounts += num(o.discount_amount) + num(o.loyalty_discount);
    revenue += num(o.total); // "Net Sales" — post-discount, matches salesReport's `net`.
    for (const it of o.items || []) {
      cogs += lineCogs(it, productMap);
    }
  }
  // Gross Profit is fully computed above, from sales and COGS only — expenses
  // are introduced afterward and can only ever affect Net Profit.
  const grossProfit = revenue - cogs;
  const exp = expensesReport(expenseRows, expenseCategories, range);
  const netProfit = grossProfit - exp.total;
  return {
    grossSales,
    discounts,
    revenue,
    cogs,
    grossProfit,
    expenses: exp.total,
    expensesByCategory: exp.byCategory,
    expenseCount: exp.count,
    netProfit,
    orderCount: inR.length,
  };
}