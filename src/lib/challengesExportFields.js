// Challenges' config for the shared ExcelExportDialog — export only. A
// challenge DEFINITION (this table) is a separate concept from a customer's
// reward/progress record — importing definitions must never itself grant
// points, so this pass only exports the definitions; a safe bulk-edit
// Import would still need to go through the same review/reward logic
// challengesReview()/challengeFunctions.js already enforce, not a direct
// table write, and that's out of scope here (see the final report).
import { toExcelDate } from './excelExportHelpers';

const TYPE_LABEL = {
  product_purchase: { ar: 'شراء منتج محدد', en: 'Buy a specific product' },
  spend_amount: { ar: 'الإنفاق فوق مبلغ', en: 'Spend above an amount' },
  purchase_count: { ar: 'عدد المشتريات', en: 'Number of purchases' },
  photo_upload: { ar: 'رفع صورة', en: 'Upload a photo' },
  share: { ar: 'المشاركة مع أشخاص', en: 'Share with people' },
  custom: { ar: 'مخصص (يدوي)', en: 'Custom (manual)' },
};

function targetSummary(c, lang) {
  const t = c.target || {};
  switch (c.type) {
    case 'product_purchase': return t.product_name || '';
    case 'spend_amount': return t.amount != null ? String(t.amount) : '';
    case 'purchase_count': return t.count != null ? String(t.count) : '';
    case 'share': return t.share_count != null ? String(t.share_count) : '';
    default: return '';
  }
}

export const CHALLENGE_EXPORT_FIELDS = [
  { key: 'name', group: 'basic', type: 'text', width: 24, label: { ar: 'الاسم (عربي)', en: 'Arabic Name' }, getValue: (c) => c.name || '' },
  { key: 'name_en', group: 'basic', type: 'text', width: 24, label: { ar: 'الاسم (إنجليزي)', en: 'English Name' }, getValue: (c) => c.name_en || '' },
  { key: 'description', group: 'basic', type: 'text', width: 30, wrap: true, label: { ar: 'الوصف', en: 'Description' }, getValue: (c) => c.description || '' },
  { key: 'type', group: 'basic', type: 'text', width: 20, label: { ar: 'النوع', en: 'Type' }, getValue: (c, { lang }) => TYPE_LABEL[c.type]?.[lang] || c.type || '' },
  { key: 'target', group: 'basic', type: 'text', width: 20, label: { ar: 'الهدف', en: 'Target' }, getValue: (c, { lang }) => targetSummary(c, lang) },
  { key: 'reward_type', group: 'reward', type: 'text', width: 16, label: { ar: 'نوع المكافأة', en: 'Reward Type' }, getValue: (c) => c.reward_type || '' },
  { key: 'reward_value', group: 'reward', type: 'number', width: 14, label: { ar: 'قيمة المكافأة', en: 'Reward Value' }, getValue: (c) => Number(c.reward_value) || 0 },
  { key: 'reward_label', group: 'reward', type: 'text', width: 22, label: { ar: 'تسمية المكافأة', en: 'Reward Label' }, getValue: (c, { lang }) => (lang === 'ar' ? c.reward_label : (c.reward_label_en || c.reward_label)) || '' },
  { key: 'start_date', group: 'schedule', type: 'date', width: 13, label: { ar: 'تاريخ البداية', en: 'Start Date' }, getValue: (c) => c.start_date || null },
  { key: 'end_date', group: 'schedule', type: 'date', width: 13, label: { ar: 'تاريخ النهاية', en: 'End Date' }, getValue: (c) => c.end_date || null },
  { key: 'frequency', group: 'schedule', type: 'text', width: 14, label: { ar: 'التكرار', en: 'Frequency' }, getValue: (c) => c.frequency || '' },
  { key: 'requires_review', group: 'settings', type: 'text', width: 14, label: { ar: 'يتطلب مراجعة', en: 'Requires Review' }, getValue: (c, { ar }) => (c.requires_review ? (ar ? 'نعم' : 'Yes') : (ar ? 'لا' : 'No')) },
  { key: 'active', group: 'settings', type: 'text', width: 12, label: { ar: 'الحالة', en: 'Status' }, getValue: (c, { ar }) => (c.active ? (ar ? 'نشط' : 'Active') : (ar ? 'متوقف' : 'Inactive')) },
  { key: 'created_date', group: 'settings', type: 'date', width: 13, label: { ar: 'تاريخ الإنشاء', en: 'Created Date' }, getValue: (c) => c.created_date || null },
];

export const CHALLENGE_EXPORT_GROUPS = [
  { id: 'basic', label: { ar: 'أساسي', en: 'Basic' } },
  { id: 'reward', label: { ar: 'المكافأة', en: 'Reward' } },
  { id: 'schedule', label: { ar: 'الجدولة', en: 'Schedule' } },
  { id: 'settings', label: { ar: 'الإعدادات', en: 'Settings' } },
];

export const CHALLENGE_EXPORT_PRESETS = [
  { id: 'summary', label: { ar: 'ملخص التحديات', en: 'Challenge Summary' }, keys: ['name', 'type', 'target', 'reward_type', 'reward_value', 'active'] },
];

export function buildChallengeExportRow(challenge, fieldKeys, ctx) {
  const row = {};
  const byKey = Object.fromEntries(CHALLENGE_EXPORT_FIELDS.map((f) => [f.key, f]));
  for (const key of fieldKeys) {
    const field = byKey[key];
    if (!field) continue;
    row[key] = (key === 'start_date' || key === 'end_date' || key === 'created_date')
      ? toExcelDate(field.getValue(challenge, ctx))
      : field.getValue(challenge, ctx);
  }
  return row;
}

export function challengeExportDialogProps({ challenges }) {
  return {
    dialogTitle: { ar: 'تصدير التحديات إلى Excel', en: 'Export Challenges to Excel' },
    sheetName: { ar: 'التحديات', en: 'Challenges' },
    reportSubtitle: { ar: 'تقرير التحديات / Challenges Export', en: 'تقرير التحديات / Challenges Export' },
    countLabel: { ar: 'عدد التحديات', en: 'Challenges' },
    fileNamePrefix: 'Challenges',
    fields: CHALLENGE_EXPORT_FIELDS,
    groups: CHALLENGE_EXPORT_GROUPS,
    presets: CHALLENGE_EXPORT_PRESETS,
    defaultFieldKeys: ['name', 'type', 'target', 'reward_type', 'reward_value', 'active'],
    records: challenges,
    buildRow: buildChallengeExportRow,
  };
}
