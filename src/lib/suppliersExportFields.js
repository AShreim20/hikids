// Suppliers' config for the shared ExcelExportDialog — export only. No
// stable Supplier Code exists yet and supplier records carry a running
// financial balance, so bulk-editing them via a generic Excel Import isn't
// something this pass adds (see the final report's module matrix).
import { toExcelDate } from './excelExportHelpers';

export const SUPPLIER_EXPORT_FIELDS = [
  { key: 'name', group: 'basic', type: 'text', width: 24, label: { ar: 'اسم المورّد', en: 'Supplier Name' }, getValue: (s) => s.name || '' },
  { key: 'contact_person', group: 'basic', type: 'text', width: 20, label: { ar: 'الشخص المسؤول', en: 'Contact Person' }, getValue: (s) => s.contact_person || '' },
  { key: 'phone', group: 'basic', type: 'text', width: 16, label: { ar: 'الهاتف', en: 'Phone' }, getValue: (s) => s.phone || '' },
  { key: 'email', group: 'basic', type: 'text', width: 22, label: { ar: 'البريد الإلكتروني', en: 'Email' }, getValue: (s) => s.email || '' },
  { key: 'address', group: 'basic', type: 'text', width: 28, wrap: true, label: { ar: 'العنوان', en: 'Address' }, getValue: (s) => s.address || '' },
  { key: 'notes', group: 'basic', type: 'text', width: 28, wrap: true, label: { ar: 'ملاحظات', en: 'Notes' }, getValue: (s) => s.notes || '' },
  { key: 'balance', group: 'financial', type: 'currency', width: 14, label: { ar: 'الرصيد المستحق', en: 'Balance Owed' }, getValue: (s, { balances }) => (balances && balances[s.id]) || 0 },
  { key: 'created_date', group: 'financial', type: 'date', width: 13, label: { ar: 'تاريخ الإضافة', en: 'Added Date' }, getValue: (s) => s.created_date || null },
];

export const SUPPLIER_EXPORT_GROUPS = [
  { id: 'basic', label: { ar: 'معلومات أساسية', en: 'Basic Information' } },
  { id: 'financial', label: { ar: 'مالية', en: 'Financial' } },
];

export const SUPPLIER_EXPORT_PRESETS = [
  { id: 'basic', label: { ar: 'معلومات أساسية', en: 'Basic Information' }, keys: ['name', 'contact_person', 'phone', 'email'] },
  { id: 'balances', label: { ar: 'الأرصدة', en: 'Balances' }, keys: ['name', 'balance'] },
];

export function buildSupplierExportRow(supplier, fieldKeys, ctx) {
  const row = {};
  const byKey = Object.fromEntries(SUPPLIER_EXPORT_FIELDS.map((f) => [f.key, f]));
  for (const key of fieldKeys) {
    const field = byKey[key];
    if (field) row[key] = key === 'created_date' ? toExcelDate(field.getValue(supplier, ctx)) : field.getValue(supplier, ctx);
  }
  return row;
}

export function supplierExportDialogProps({ suppliers, balances }) {
  return {
    dialogTitle: { ar: 'تصدير الموردين إلى Excel', en: 'Export Suppliers to Excel' },
    sheetName: { ar: 'الموردون', en: 'Suppliers' },
    reportSubtitle: { ar: 'تقرير الموردين / Suppliers Export', en: 'تقرير الموردين / Suppliers Export' },
    countLabel: { ar: 'عدد الموردين', en: 'Suppliers' },
    fileNamePrefix: 'Suppliers',
    fields: SUPPLIER_EXPORT_FIELDS,
    groups: SUPPLIER_EXPORT_GROUPS,
    presets: SUPPLIER_EXPORT_PRESETS,
    defaultFieldKeys: ['name', 'contact_person', 'phone', 'balance'],
    records: suppliers,
    buildRow: buildSupplierExportRow,
    fieldCtx: { balances },
  };
}
