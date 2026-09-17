// Expenses' config for the shared ExcelExportDialog — export only. Expenses
// are individual transaction events with no stable business code, and
// generic Excel Import risks silently duplicating a transaction if the same
// file is re-imported (see the final report's module matrix) — that needs
// dedicated idempotency design, not something this refactor adds.
import { toExcelDate } from './excelExportHelpers';

const PAYMENT_METHOD_LABEL = {
  cash: { ar: 'نقدًا', en: 'Cash' },
  card: { ar: 'بطاقة', en: 'Card' },
  bank_transfer: { ar: 'تحويل بنكي', en: 'Bank Transfer' },
  cheque: { ar: 'شيك', en: 'Cheque' },
};

export const EXPENSE_EXPORT_FIELDS = [
  { key: 'expense_date', group: 'basic', type: 'date', width: 13, label: { ar: 'التاريخ', en: 'Date' }, getValue: (e) => e.expense_date || e.created_date || null },
  { key: 'reference', group: 'basic', type: 'text', width: 14, label: { ar: 'المرجع', en: 'Reference' }, getValue: (e) => e.reference || '' },
  { key: 'category', group: 'basic', type: 'text', width: 20, label: { ar: 'نوع المصروف', en: 'Expense Type' }, getValue: (e, { categoryLabel }) => categoryLabel(e) },
  { key: 'description', group: 'basic', type: 'text', width: 28, wrap: true, label: { ar: 'الوصف', en: 'Description' }, getValue: (e) => e.description || '' },
  { key: 'amount', group: 'financial', type: 'currency', width: 14, label: { ar: 'المبلغ', en: 'Amount' }, getValue: (e) => Number(e.amount) || 0 },
  { key: 'payment_method', group: 'financial', type: 'text', width: 16, label: { ar: 'طريقة الدفع', en: 'Payment Method' }, getValue: (e, { lang }) => (e.payment_method ? (PAYMENT_METHOD_LABEL[e.payment_method]?.[lang] || e.payment_method) : '') },
  { key: 'notes', group: 'basic', type: 'text', width: 26, wrap: true, label: { ar: 'ملاحظات', en: 'Notes' }, getValue: (e) => e.notes || '' },
  { key: 'created_by', group: 'basic', type: 'text', width: 18, label: { ar: 'أُنشئ بواسطة', en: 'Created By' }, getValue: (e, { creatorLabel }) => creatorLabel(e.created_by_id) },
];

export const EXPENSE_EXPORT_GROUPS = [
  { id: 'basic', label: { ar: 'أساسي', en: 'Basic' } },
  { id: 'financial', label: { ar: 'مالية', en: 'Financial' } },
];

export const EXPENSE_EXPORT_PRESETS = [
  { id: 'summary', label: { ar: 'ملخص المصروفات', en: 'Expense Summary' }, keys: ['expense_date', 'category', 'amount', 'payment_method'] },
];

export function buildExpenseExportRow(expense, fieldKeys, ctx) {
  const row = {};
  const byKey = Object.fromEntries(EXPENSE_EXPORT_FIELDS.map((f) => [f.key, f]));
  for (const key of fieldKeys) {
    const field = byKey[key];
    if (field) row[key] = key === 'expense_date' ? toExcelDate(field.getValue(expense, ctx)) : field.getValue(expense, ctx);
  }
  return row;
}

// Expenses are always viewed through a date-range/category/search filter
// already (there's no meaningful "unfiltered" list) — export represents
// exactly the currently-filtered rows the admin is looking at, matching the
// same principle report exports use, so there's a single implicit scope.
export function expenseExportDialogProps({ filteredExpenses, categoryLabel, creatorLabel }) {
  return {
    dialogTitle: { ar: 'تصدير المصروفات إلى Excel', en: 'Export Expenses to Excel' },
    sheetName: { ar: 'المصروفات', en: 'Expenses' },
    reportSubtitle: { ar: 'تقرير المصروفات / Expenses Export', en: 'تقرير المصروفات / Expenses Export' },
    countLabel: { ar: 'عدد المصروفات', en: 'Expenses' },
    fileNamePrefix: 'Expenses',
    fields: EXPENSE_EXPORT_FIELDS,
    groups: EXPENSE_EXPORT_GROUPS,
    presets: EXPENSE_EXPORT_PRESETS,
    defaultFieldKeys: ['expense_date', 'category', 'description', 'amount'],
    records: filteredExpenses,
    scopes: ['all'],
    buildRow: buildExpenseExportRow,
    fieldCtx: { categoryLabel, creatorLabel },
  };
}
