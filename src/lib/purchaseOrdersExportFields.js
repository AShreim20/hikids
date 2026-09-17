// Purchase Orders' config for the shared ExcelExportDialog — export only.
// Import is deliberately not added here: creating/updating a PO isn't a
// simple field diff, it goes through postPurchaseOrder/cancelPurchaseOrder
// (which also move stock and supplier balances) — a safe Import would need
// to drive that same workflow, not write purchase_orders directly, and that
// needs its own dedicated design (see the final report).
//
// One purchase order can have several line items — this export keeps the
// existing, more useful line-item-level granularity (one row per item, not
// per PO) exactly like the previous implementation, by pre-flattening POs
// into per-item pseudo-records before they ever reach the shared dialog
// (see flattenPurchaseOrders below). The dialog itself still only ever
// knows "one record = one row".
import { toExcelDate } from './excelExportHelpers';

export const PURCHASE_ORDER_EXPORT_FIELDS = [
  { key: 'po_number', group: 'basic', type: 'text', width: 16, label: { ar: 'رقم أمر الشراء', en: 'Purchase Number' }, getValue: (r) => r.po_number || '' },
  { key: 'date', group: 'basic', type: 'date', width: 13, label: { ar: 'التاريخ', en: 'Date' }, getValue: (r) => r.date || null },
  { key: 'supplier', group: 'basic', type: 'text', width: 20, label: { ar: 'المورّد', en: 'Supplier' }, getValue: (r) => r.supplier || '' },
  { key: 'product', group: 'basic', type: 'text', width: 26, wrap: true, label: { ar: 'المنتج', en: 'Product' }, getValue: (r) => r.product || '' },
  { key: 'sku', group: 'basic', type: 'text', width: 16, label: { ar: 'SKU', en: 'SKU' }, getValue: (r) => r.sku || '' },
  { key: 'quantity', group: 'costs', type: 'int', width: 11, label: { ar: 'الكمية', en: 'Quantity' }, getValue: (r) => Number(r.quantity) || 0 },
  { key: 'unit_cost', group: 'costs', type: 'currency', width: 14, label: { ar: 'تكلفة الوحدة', en: 'Unit Cost' }, getValue: (r) => (r.unit_cost != null ? Number(r.unit_cost) : null) },
  { key: 'total_cost', group: 'costs', type: 'currency', width: 14, label: { ar: 'إجمالي التكلفة', en: 'Total Cost' }, getValue: (r) => Number(r.total_cost) || 0 },
  { key: 'notes', group: 'basic', type: 'text', width: 26, wrap: true, label: { ar: 'ملاحظات', en: 'Notes' }, getValue: (r) => r.notes || '' },
  { key: 'created_by', group: 'basic', type: 'text', width: 20, label: { ar: 'أُنشئ بواسطة', en: 'Created By' }, getValue: (r) => r.created_by || '' },
];

export const PURCHASE_ORDER_EXPORT_GROUPS = [
  { id: 'basic', label: { ar: 'أساسي', en: 'Basic' } },
  { id: 'costs', label: { ar: 'التكاليف', en: 'Costs' } },
];

export const PURCHASE_ORDER_EXPORT_PRESETS = [
  { id: 'summary', label: { ar: 'ملخص المشتريات', en: 'Purchase Summary' }, keys: ['po_number', 'date', 'supplier', 'total_cost'] },
  { id: 'costs', label: { ar: 'تكاليف المنتجات', en: 'Product Costs' }, keys: ['product', 'sku', 'quantity', 'unit_cost', 'total_cost'] },
];

// The extra `_`-prefixed fields aren't exportable columns (they're absent
// from PURCHASE_ORDER_EXPORT_FIELDS) — they're carried on each flattened row
// purely so a page's existing filter predicate (search/supplier/payment
// status/status/date range, all defined at the PO level) can still be
// applied after POs have been expanded into one row per line item.
export function flattenPurchaseOrders(purchaseOrders) {
  return purchaseOrders.flatMap((p) =>
    (p.items && p.items.length ? p.items : [{}]).map((it, i) => ({
      id: `${p.id}-${i}`,
      po_number: p.po_number || '',
      date: toExcelDate(p.purchase_date || p.created_date),
      supplier: p.supplier_name || '',
      product: it.name || '',
      sku: it.sku || '',
      quantity: Number(it.quantity) || 0,
      unit_cost: it.unit_cost != null ? Number(it.unit_cost) : null,
      total_cost: it.total != null ? Number(it.total) : (Number(it.quantity) || 0) * (Number(it.unit_cost) || 0),
      notes: p.notes || '',
      created_by: p.created_by_email || '',
      _supplier_id: p.supplier_id || '',
      _payment_status: p.payment_status || '',
      _status: p.status || '',
      _purchase_date: p.purchase_date || '',
      _term: `${p.po_number || ''} ${p.supplier_name || ''}`.toLowerCase(),
    }))
  );
}

export function buildPurchaseOrderExportRow(record, fieldKeys) {
  const row = {};
  const byKey = Object.fromEntries(PURCHASE_ORDER_EXPORT_FIELDS.map((f) => [f.key, f]));
  for (const key of fieldKeys) {
    const field = byKey[key];
    if (field) row[key] = field.getValue(record);
  }
  return row;
}

export function purchaseOrderExportDialogProps({ purchaseOrders, filterFn, fetchAllFlattened }) {
  return {
    dialogTitle: { ar: 'تصدير المشتريات إلى Excel', en: 'Export Purchases to Excel' },
    sheetName: { ar: 'أوامر الشراء', en: 'Purchase Orders' },
    reportSubtitle: { ar: 'تقرير المشتريات / Purchases Export', en: 'تقرير المشتريات / Purchases Export' },
    countLabel: { ar: 'عدد الأصناف', en: 'Line Items' },
    fileNamePrefix: 'Purchases',
    fields: PURCHASE_ORDER_EXPORT_FIELDS,
    groups: PURCHASE_ORDER_EXPORT_GROUPS,
    presets: PURCHASE_ORDER_EXPORT_PRESETS,
    defaultFieldKeys: ['po_number', 'date', 'supplier', 'product', 'total_cost'],
    records: flattenPurchaseOrders(purchaseOrders),
    filterFn,
    buildRow: buildPurchaseOrderExportRow,
    fetchAll: fetchAllFlattened,
  };
}
