// Categories' config for the shared ExcelExportDialog — export only (see
// the audit notes in the final report: no stable Category Code exists yet,
// and with ~15 rows the admin UI is already fast, so a synthetic import
// identifier wasn't added just to satisfy this refactor).
import { toExcelDate } from './excelExportHelpers';

export const CATEGORY_EXPORT_FIELDS = [
  { key: 'name', group: 'basic', type: 'text', width: 22, label: { ar: 'الاسم (عربي)', en: 'Arabic Name' }, getValue: (c) => c.name || '' },
  { key: 'name_en', group: 'basic', type: 'text', width: 22, label: { ar: 'الاسم (إنجليزي)', en: 'English Name' }, getValue: (c) => c.name_en || '' },
  { key: 'description', group: 'basic', type: 'text', width: 32, wrap: true, label: { ar: 'الوصف (عربي)', en: 'Arabic Description' }, getValue: (c) => c.description || '' },
  { key: 'description_en', group: 'basic', type: 'text', width: 32, wrap: true, label: { ar: 'الوصف (إنجليزي)', en: 'English Description' }, getValue: (c) => c.description_en || '' },
  { key: 'active', group: 'settings', type: 'text', width: 12, label: { ar: 'الحالة', en: 'Status' }, getValue: (c, { ar }) => (c.active !== false ? (ar ? 'مفعّل' : 'Active') : (ar ? 'غير مفعّل' : 'Inactive')) },
  { key: 'discount_percent', group: 'settings', type: 'percent', width: 14, label: { ar: 'نسبة الخصم', en: 'Discount %' }, getValue: (c) => Number(c.discount_percent) || 0 },
  { key: 'discount_active', group: 'settings', type: 'text', width: 14, label: { ar: 'الخصم مفعّل', en: 'Discount Active' }, getValue: (c, { ar }) => (c.discount_active ? (ar ? 'نعم' : 'Yes') : (ar ? 'لا' : 'No')) },
  { key: 'sort_order', group: 'settings', type: 'int', width: 11, label: { ar: 'ترتيب العرض', en: 'Display Order' }, getValue: (c) => Number(c.sort_order) || 0 },
  { key: 'created_date', group: 'settings', type: 'date', width: 13, label: { ar: 'تاريخ الإنشاء', en: 'Created Date' }, getValue: (c) => c.created_date || null },
];

export const CATEGORY_EXPORT_GROUPS = [
  { id: 'basic', label: { ar: 'أساسي', en: 'Basic' } },
  { id: 'settings', label: { ar: 'الإعدادات', en: 'Settings' } },
];

export function buildCategoryExportRow(category, fieldKeys, ctx) {
  const row = {};
  const byKey = Object.fromEntries(CATEGORY_EXPORT_FIELDS.map((f) => [f.key, f]));
  for (const key of fieldKeys) {
    const field = byKey[key];
    if (field) row[key] = key === 'created_date' ? toExcelDate(field.getValue(category, ctx)) : field.getValue(category, ctx);
  }
  return row;
}

export function categoryExportDialogProps({ categories, filterFn }) {
  return {
    dialogTitle: { ar: 'تصدير التصنيفات إلى Excel', en: 'Export Categories to Excel' },
    sheetName: { ar: 'التصنيفات', en: 'Categories' },
    reportSubtitle: { ar: 'تقرير التصنيفات / Categories Export', en: 'تقرير التصنيفات / Categories Export' },
    countLabel: { ar: 'عدد التصنيفات', en: 'Categories' },
    fileNamePrefix: 'Categories',
    fields: CATEGORY_EXPORT_FIELDS,
    groups: CATEGORY_EXPORT_GROUPS,
    defaultFieldKeys: ['name', 'name_en', 'active', 'discount_percent', 'sort_order'],
    records: categories,
    filterFn,
    buildRow: buildCategoryExportRow,
  };
}
