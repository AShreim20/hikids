// Returns & Exchanges — shared constants/labels for the Return Reason
// foundation (Phase 1). Mirrors orderStatus.js/po.js: plain constants +
// bilingual label maps, no business logic beyond simple lookups. The
// Return Request workflow itself (statuses, activity log) is prepared in
// the database (see supabase/migrations/0031_returns_foundation.sql) but
// has no UI yet — that's Phase 2+.

export const DELIVERY_RESPONSIBILITIES = ['hikids', 'customer', 'manual_review'];

export const DELIVERY_RESPONSIBILITY_LABEL = {
  hikids: { ar: 'تكلفة التوصيل على HiKids', en: 'HiKids pays delivery' },
  customer: { ar: 'تكلفة التوصيل على الزبون', en: 'Customer pays delivery' },
  manual_review: { ar: 'يتم تحديد تكلفة التوصيل بعد مراجعة الطلب', en: 'Delivery cost decided after manual review' },
};

export const deliveryResponsibilityLabel = (value, lang = 'en') =>
  DELIVERY_RESPONSIBILITY_LABEL[value]?.[lang] || value;

// Workflow states for a future Return Request (section 6) — foundation
// only, no status here yet triggers stock/refund/loyalty changes.
export const RETURN_REQUEST_STATUSES = [
  'draft', 'submitted', 'under_review', 'needs_information',
  'approved', 'rejected', 'awaiting_return', 'received',
  'processing', 'completed', 'cancelled',
];

export const RETURN_REQUEST_STATUS_LABEL = {
  en: {
    draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review',
    needs_information: 'Needs Information', approved: 'Approved', rejected: 'Rejected',
    awaiting_return: 'Awaiting Return', received: 'Received', processing: 'Processing',
    completed: 'Completed', cancelled: 'Cancelled',
  },
  ar: {
    draft: 'مسودة', submitted: 'مُقدَّم', under_review: 'قيد المراجعة',
    needs_information: 'يتطلب معلومات إضافية', approved: 'مقبول', rejected: 'مرفوض',
    awaiting_return: 'بانتظار الإرجاع', received: 'تم الاستلام', processing: 'قيد المعالجة',
    completed: 'مكتمل', cancelled: 'ملغى',
  },
};

export const returnRequestStatusLabel = (status, lang = 'en') =>
  RETURN_REQUEST_STATUS_LABEL[lang === 'ar' ? 'ar' : 'en'][status] || status;

export const REQUEST_TYPES = ['return', 'exchange'];

export const REQUEST_TYPE_LABEL = {
  return: { ar: 'إرجاع', en: 'Return' },
  exchange: { ar: 'استبدال', en: 'Exchange' },
};

// Extensible resolution classification (section 5/20) — plain labels only,
// no workflow branches on these yet.
export const RESOLUTION_TYPES = ['missing_item', 'missing_part', 'wrong_item', 'damaged_item'];

export const RESOLUTION_TYPE_LABEL = {
  missing_item: { ar: 'صنف ناقص من الطلب', en: 'Missing item' },
  missing_part: { ar: 'قطعة أو جزء ناقص', en: 'Missing part' },
  wrong_item: { ar: 'وصل منتج خاطئ', en: 'Wrong item' },
  damaged_item: { ar: 'المنتج وصل تالفاً', en: 'Damaged item' },
};

// Which "allowed actions" a reason can be configured with (section 10),
// used by both the admin form and any future customer-facing eligibility
// check ("can this reason be used for a return? an exchange?").
export const REASON_ALLOWED_ACTION_FIELDS = [
  { key: 'allow_return', label: { ar: 'إرجاع', en: 'Return' } },
  { key: 'allow_exchange', label: { ar: 'استبدال', en: 'Exchange' } },
  { key: 'allow_missing_item', label: { ar: 'حل صنف ناقص من الطلب', en: 'Missing Item Resolution' } },
  { key: 'allow_missing_part', label: { ar: 'حل قطعة ناقصة من المنتج', en: 'Missing Part Resolution' } },
];

export const reasonName = (reason, lang = 'en') =>
  (lang === 'ar' ? reason?.name : (reason?.name_en || reason?.name)) || '';

export const reasonDescription = (reason, lang = 'en') =>
  (lang === 'ar' ? reason?.description : (reason?.description_en || reason?.description)) || '';

// ---------------------------------------------------------------------------
// Phase 2 — customer eligibility helpers. These are DISPLAY-ONLY: the
// backend (submit_return_request, migration 0032) re-derives all of this
// itself from the server's own clock and is the only authoritative check.
// Mirroring the same "delivered" transition lookup here just lets the UI
// show a sensible badge/deadline without waiting on a round trip.
// ---------------------------------------------------------------------------
export const RETURN_WINDOW_DAYS = 3;

// Same lookup submit_return_request() does in SQL: the most recent
// orders.activity entry whose status transition landed on 'delivered'.
export function getDeliveredAt(order) {
  const entries = Array.isArray(order?.activity) ? order.activity : [];
  const hits = entries.filter((e) => e?.action === 'status' && e?.to === 'delivered' && e?.at);
  if (!hits.length) return null;
  return hits.map((e) => new Date(e.at)).sort((a, b) => b - a)[0];
}

export function getReturnDeadline(order) {
  const deliveredAt = getDeliveredAt(order);
  if (!deliveredAt) return null;
  return new Date(deliveredAt.getTime() + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

// { eligible, deadline, deliveredAt } — `eligible` is false when the order
// isn't delivered yet, has no recorded delivery timestamp, or the 3-day
// window has passed.
export function getReturnEligibility(order, now = new Date()) {
  if (order?.status !== 'delivered') return { eligible: false, deadline: null, deliveredAt: null };
  const deliveredAt = getDeliveredAt(order);
  if (!deliveredAt) return { eligible: false, deadline: null, deliveredAt: null };
  const deadline = getReturnDeadline(order);
  return { eligible: now <= deadline, deadline, deliveredAt };
}

// Compact "2 days left" / "8 hours left" — never seconds/minutes, matching
// the "not unnecessarily stressful" requirement (no countdown animation).
export function formatTimeRemaining(deadline, lang = 'en', now = new Date()) {
  const ms = deadline - now;
  if (ms <= 0) return null;
  const hours = Math.ceil(ms / (60 * 60 * 1000));
  const days = Math.ceil(hours / 24);
  const ar = lang === 'ar';
  if (hours < 24) return ar ? `متبقٍ ${hours} ${hours === 1 ? 'ساعة' : 'ساعات'}` : `${hours}h remaining`;
  return ar ? `متبقٍ ${days} ${days === 1 ? 'يوم' : 'أيام'}` : `${days}d remaining`;
}

// Remaining eligible quantity per original order-item index, given the
// customer's own return_request_items (each expected to carry its parent
// request's `status` — see ReturnRequestItem query in the wizard/list
// pages). Rejected/cancelled requests never consume quantity, matching the
// backend's own rule exactly.
export function remainingQuantityByItemIndex(order, myReturnItems) {
  const purchased = (order?.items || []).map((it) => Number(it.qty) || 0);
  const reserved = new Array(purchased.length).fill(0);
  for (const item of myReturnItems || []) {
    if (item.order_id !== order.id) continue;
    if (['rejected', 'cancelled'].includes(item._status)) continue;
    const idx = item.order_item_index;
    if (idx == null || idx < 0 || idx >= reserved.length) continue;
    reserved[idx] += Number(item.requested_quantity) || 0;
  }
  return purchased.map((qty, i) => Math.max(0, qty - reserved[i]));
}

// ---------------------------------------------------------------------------
// Phase 3 — admin review helpers.
// ---------------------------------------------------------------------------

// Status quick-filter tabs for the admin list (section 7) — real Phase 1
// enum values only, "all" is a client-side pseudo-filter.
export const ADMIN_STATUS_TABS = [
  'all', 'submitted', 'under_review', 'needs_information',
  'approved', 'rejected', 'awaiting_return', 'completed', 'cancelled',
];

// Which of the three main review actions make sense from a given status —
// purely a UI-enablement hint; the RPCs re-validate the real transition
// server-side regardless.
export function allowedAdminActions(status) {
  return {
    canRequestInfo: ['submitted', 'under_review'].includes(status),
    canApprove: status === 'under_review',
    canReject: status === 'under_review',
  };
}

export const returnItemName = (item, lang = 'en') =>
  (lang === 'ar' ? item?.product_name : (item?.product_name_en || item?.product_name)) || '';

// ---------------------------------------------------------------------------
// Phase 4 -- physical receiving, inspection, disposition, resolution.
// ---------------------------------------------------------------------------

export const INSPECTION_CONDITIONS = ['sellable', 'damaged', 'incomplete', 'needs_inspection'];

export const INSPECTION_CONDITION_LABEL = {
  sellable: { ar: 'قابل للبيع', en: 'Sellable' },
  damaged: { ar: 'تالف / غير قابل للبيع', en: 'Damaged' },
  incomplete: { ar: 'ناقص قطع أو ملحقات', en: 'Incomplete' },
  needs_inspection: { ar: 'يحتاج فحص إضافي', en: 'Needs further inspection' },
};

export const inspectionConditionLabel = (value, lang = 'en') =>
  INSPECTION_CONDITION_LABEL[value]?.[lang] || value;

export const REFUND_METHODS = ['wallet', 'refund'];

export const REFUND_METHOD_LABEL = {
  wallet: { ar: 'محفظة HiKids', en: 'HiKids Wallet' },
  refund: { ar: 'استرداد الأموال', en: 'Refund' },
};

export const refundMethodLabel = (value, lang = 'en') =>
  REFUND_METHOD_LABEL[value]?.[lang] || value;

export const MISSING_RESOLUTION_LABEL = {
  send_missing_item: { ar: 'إرسال الصنف الناقص', en: 'Send missing item' },
  send_missing_part: { ar: 'إرسال القطعة الناقصة', en: 'Send missing part' },
  full_exchange: { ar: 'استبدال كامل للمنتج', en: 'Full product exchange' },
};

export const missingResolutionLabel = (value, lang = 'en') =>
  MISSING_RESOLUTION_LABEL[value]?.[lang] || value;

// Per-item received/pending totals derived from the receipts/inspections
// event logs (never stored as a single mutable counter) -- mirrors exactly
// what the admin_receive_return_item / admin_inspect_return_item RPCs
// compute server-side, so the UI can show the same numbers before/without
// a round trip.
export function receivedTotals(item, receipts) {
  const received = (receipts || [])
    .filter((r) => r.return_request_item_id === item.id)
    .reduce((n, r) => n + Number(r.received_quantity || 0), 0);
  return { received, remaining: Math.max(0, Number(item.requested_quantity || 0) - received) };
}

export function inspectionTotals(item, receipts, inspections) {
  const { received } = receivedTotals(item, receipts);
  const rows = (inspections || []).filter((i) => i.return_request_item_id === item.id);
  const finalized = rows
    .filter((i) => i.condition !== 'needs_inspection')
    .reduce((n, i) => n + Number(i.quantity || 0), 0);
  const sellable = rows.filter((i) => i.condition === 'sellable').reduce((n, i) => n + Number(i.quantity || 0), 0);
  const damaged = rows.filter((i) => i.condition === 'damaged').reduce((n, i) => n + Number(i.quantity || 0), 0);
  const incomplete = rows.filter((i) => i.condition === 'incomplete').reduce((n, i) => n + Number(i.quantity || 0), 0);
  return { pending: Math.max(0, received - finalized), sellable, damaged, incomplete };
}

// Whether an item is a physical return/exchange line (went through
// AWAITING_RETURN) vs a missing item/part claim (never has a physical
// item to receive) -- purely a display-routing helper.
export const isPhysicalItem = (item) => !['missing_item', 'missing_part'].includes(item?.resolution_type);

// Customer-facing timeline labels for activity actions that don't carry a
// status transition (`entry.to` is deliberately left blank for these on the
// backend -- section 49: the raw action code / internal detail is
// admin-only, the customer gets a plain milestone instead).
const ACTIVITY_ACTION_LABEL = {
  ITEM_RECEIVED: { ar: 'تم استلام المنتج', en: 'Item received' },
  INSPECTION_RECORDED: { ar: 'تم فحص المنتج', en: 'Item inspected' },
  REFUND_METHOD_SELECTED: { ar: 'تم اختيار طريقة الاسترداد', en: 'Refund method selected' },
  EXCHANGE_REPLACEMENT_RESERVED: { ar: 'تم تأكيد المنتج البديل', en: 'Replacement confirmed' },
  EXCHANGE_RESERVATION_RELEASED: { ar: 'تم إلغاء حجز الاستبدال', en: 'Replacement reservation released' },
  DISPOSITION_REVIEW_CLEARED: { ar: 'تمت مراجعة الطلب من قبل الفريق', en: 'Reviewed by our team' },
};

export function activityEntryLabel(entry, lang = 'en') {
  if (entry?.to) return returnRequestStatusLabel(entry.to, lang);
  return ACTIVITY_ACTION_LABEL[entry?.action]?.[lang] || entry?.action || '';
}
