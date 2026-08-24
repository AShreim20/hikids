// Order lifecycle: statuses, labels, colors, workflow rules and activity log
// helpers. Legacy records (pending / paid / shipped) are normalized on read.

export const MAIN_FLOW = [
  'new',
  'confirmed',
  'preparing',
  'ready',
  'out_for_delivery',
  'delivered',
];

export const EXTRA_STATUSES = [
  'cancelled',
  'on_hold',
  'failed_delivery',
  'return_requested',
  'return_approved',
  'returned',
  'exchange_requested',
  'exchange_approved',
];

export const ALL_STATUSES = [...MAIN_FLOW, ...EXTRA_STATUSES];

const LEGACY = { pending: 'new', paid: 'confirmed', shipped: 'out_for_delivery' };

export const normalizeStatus = (status) => LEGACY[status] || status || 'new';

export const STATUS_LABEL = {
  en: {
    new: 'New',
    confirmed: 'Confirmed',
    preparing: 'Preparing',
    ready: 'Ready for Delivery',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    on_hold: 'On Hold',
    failed_delivery: 'Failed Delivery',
    return_requested: 'Return Requested',
    return_approved: 'Return Approved',
    returned: 'Returned',
    exchange_requested: 'Exchange Requested',
    exchange_approved: 'Exchange Approved',
  },
  ar: {
    new: 'طلب جديد',
    confirmed: 'مؤكَّد',
    preparing: 'قيد التجهيز',
    ready: 'جاهز للتوصيل',
    out_for_delivery: 'قيد التوصيل',
    delivered: 'تم التسليم',
    cancelled: 'ملغى',
    on_hold: 'معلّق',
    failed_delivery: 'فشل التوصيل',
    return_requested: 'طلب إرجاع',
    return_approved: 'إرجاع مقبول',
    returned: 'تم الإرجاع',
    exchange_requested: 'طلب استبدال',
    exchange_approved: 'استبدال مقبول',
  },
};

export const statusLabel = (status, lang = 'en') =>
  STATUS_LABEL[lang === 'ar' ? 'ar' : 'en'][normalizeStatus(status)] || status;

export const STATUS_COLOR = {
  new: 'bg-cosmic/10 text-cosmic',
  confirmed: 'bg-blue-100 text-blue-700',
  preparing: 'bg-amber-100 text-amber-700',
  ready: 'bg-violet-100 text-violet-700',
  out_for_delivery: 'bg-sky-100 text-sky-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-destructive/10 text-destructive',
  on_hold: 'bg-slate-200 text-slate-700',
  failed_delivery: 'bg-destructive/10 text-destructive',
  return_requested: 'bg-orange-100 text-orange-700',
  return_approved: 'bg-orange-100 text-orange-700',
  returned: 'bg-orange-200 text-orange-800',
  exchange_requested: 'bg-teal-100 text-teal-700',
  exchange_approved: 'bg-teal-100 text-teal-700',
};

export const statusColor = (status) =>
  STATUS_COLOR[normalizeStatus(status)] || 'bg-mist text-muted-foreground';

export const RETURN_STATUSES = [
  'return_requested',
  'return_approved',
  'returned',
  'exchange_requested',
  'exchange_approved',
];

// Next status in the standard workflow (null when the flow ends or the order
// left the main flow).
export function nextStatus(status) {
  const i = MAIN_FLOW.indexOf(normalizeStatus(status));
  return i > -1 && i < MAIN_FLOW.length - 1 ? MAIN_FLOW[i + 1] : null;
}

// Statuses a staff member may set: the next workflow step plus the manual
// overrides. Owners get the full list.
export function allowedTransitions(status, { isOwner = false } = {}) {
  if (isOwner) return ALL_STATUSES.filter((s) => s !== normalizeStatus(status));
  const next = nextStatus(status);
  const manual = ['cancelled', 'on_hold', 'failed_delivery', 'return_requested', 'exchange_requested'];
  return [...(next ? [next] : []), ...manual].filter((s) => s !== normalizeStatus(status));
}

// True when a change skips ahead / moves backwards in the main flow — logged as
// an override in the activity log.
export function isWorkflowOverride(from, to) {
  const a = MAIN_FLOW.indexOf(normalizeStatus(from));
  const b = MAIN_FLOW.indexOf(normalizeStatus(to));
  if (a === -1 || b === -1) return false;
  return b !== a + 1;
}

export const logEntry = ({ action, from, to, by, note }) => ({
  at: new Date().toISOString(),
  action,
  from: from || '',
  to: to || '',
  by: by || '',
  note: note || '',
});

export const appendActivity = (order, entry) => [...(order.activity || []), entry];

export const orderRef = (order) =>
  `ORD-${String(order?.id || '').slice(-6).toUpperCase()}`;

export const orderItemCount = (order) =>
  (order?.items || []).reduce((n, i) => n + Number(i.qty || 0), 0);

// Amount paid / owed breakdown, computed from the stored snapshot only.
export function orderTotals(order) {
  const subtotal = Number(order?.subtotal ?? 0);
  const delivery = Number(order?.delivery_cost ?? 0);
  const discount = Number(order?.discount_amount ?? 0);
  const loyalty = Number(order?.loyalty_discount ?? 0);
  const total = Number(order?.total ?? Math.max(0, subtotal + delivery - discount - loyalty));
  return { subtotal, delivery, discount, loyalty, total };
}