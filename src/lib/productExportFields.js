// Single source of truth for "which product fields can go into an Excel
// export, and how to read each one off a real product row." Used by
// ProductExportDialog (the field-picker modal) and nowhere else needs to
// know how e.g. Features or Additional Categories are actually computed.
//
// Every key here is a real column on `products` (or a value derived from
// one — see the comment on each field). Nothing here invents a database
// field that doesn't exist.
import { cleanFeatureList } from './features.js';
import { ageLabels } from './ages.js';
import { hasVariants, getVariants } from './variants.js';

const totalStock = (p) =>
  hasVariants(p) ? getVariants(p).reduce((s, v) => s + (Number(v.stock) || 0), 0) : Number(p.stock) || 0;

const genderLabel = (g, t) =>
  g === 'male' ? t('gender.boy') : g === 'female' ? t('gender.girl') : g === 'both' ? t('gender.both') : '';

const yesNo = (v, ar) => (v ? (ar ? 'نعم' : 'Yes') : (ar ? 'لا' : 'No'));

// { key, group, label: {ar,en}, type, width, wrap, getValue(product, ctx) }
// type: 'text' | 'currency' | 'int' | 'date' (see excelExport.js for what
// each does to the actual Excel cell — 'text' is forced to a real Excel
// Text-formatted cell so a barcode never gets reinterpreted as a number).
export const PRODUCT_EXPORT_FIELDS = [
  // ── Basic ────────────────────────────────────────────────────────────
  {
    // The stable business identifier (HK-000001-style, or manually set) —
    // never Barcode/SKU/row id. Listed first: it's the recommended primary
    // matching key for any HiKids Excel file meant to be re-imported later.
    key: 'product_code', group: 'basic', type: 'text', width: 14,
    label: { ar: 'كود المنتج', en: 'Product Code' },
    getValue: (p) => p.product_code || '',
  },
  {
    key: 'name', group: 'basic', type: 'text', width: 26, wrap: true,
    label: { ar: 'اسم الصنف (عربي)', en: 'Arabic Product Name' },
    getValue: (p) => p.name || '',
  },
  {
    key: 'name_en', group: 'basic', type: 'text', width: 26, wrap: true,
    label: { ar: 'اسم الصنف (إنجليزي)', en: 'English Product Name' },
    getValue: (p) => p.name_en || '',
  },
  {
    key: 'barcode', group: 'basic', type: 'text', width: 16,
    label: { ar: 'الباركود', en: 'Barcode' },
    getValue: (p) => p.barcode || '',
  },
  {
    // Products have no top-level SKU column — SKU lives per-variant. A
    // product with no variants has no SKU to show; one with variants lists
    // all of them in one cell (see the "one product = one row" rule).
    key: 'sku', group: 'basic', type: 'text', width: 20, wrap: true,
    label: { ar: 'SKU', en: 'SKU' },
    getValue: (p) => (Array.isArray(p.variants) ? p.variants.map((v) => v.sku).filter(Boolean).join(' | ') : ''),
  },

  // ── Pricing ──────────────────────────────────────────────────────────
  {
    key: 'price', group: 'pricing', type: 'currency', width: 13,
    label: { ar: 'سعر البيع', en: 'Selling Price' },
    getValue: (p) => Number(p.price) || 0,
  },
  {
    key: 'sale_price', group: 'pricing', type: 'currency', width: 13,
    label: { ar: 'سعر الخصم', en: 'Discount Price' },
    getValue: (p) => (p.sale_price != null ? Number(p.sale_price) : null),
  },
  {
    key: 'unit_cost', group: 'pricing', type: 'currency', width: 13,
    label: { ar: 'سعر التكلفة', en: 'Unit Cost' },
    getValue: (p) => (p.unit_cost != null ? Number(p.unit_cost) : null),
  },

  // ── Inventory ────────────────────────────────────────────────────────
  {
    key: 'stock', group: 'inventory', type: 'int', width: 11,
    label: { ar: 'الكمية', en: 'Current Stock' },
    getValue: (p) => totalStock(p),
  },
  {
    key: 'stock_status', group: 'inventory', type: 'text', width: 15,
    label: { ar: 'حالة المخزون', en: 'Stock Status' },
    getValue: (p, { ar }) => (totalStock(p) > 0 ? (ar ? 'متوفر' : 'Available') : (ar ? 'غير متوفر' : 'Out of stock')),
  },

  // ── Classification ───────────────────────────────────────────────────
  {
    // Prefers the resolved category (via primary_category_id, bilingual) —
    // falls back to the legacy denormalized `category` name text when a
    // product predates that link or it didn't resolve.
    key: 'category', group: 'classification', type: 'text', width: 18,
    label: { ar: 'التصنيف الرئيسي', en: 'Primary Category' },
    getValue: (p, { categoryNameById }) => (p.primary_category_id && categoryNameById?.[p.primary_category_id]) || p.category || '',
  },
  {
    key: 'extra_categories', group: 'classification', type: 'text', width: 24, wrap: true,
    label: { ar: 'تصنيفات إضافية', en: 'Additional Categories' },
    getValue: (p, { categoryNameById }) =>
      (Array.isArray(p.category_ids) ? p.category_ids.map((id) => categoryNameById?.[id]).filter(Boolean) : []).join(' | '),
  },
  {
    key: 'age', group: 'classification', type: 'text', width: 16,
    label: { ar: 'الفئة العمرية', en: 'Age' },
    getValue: (p, { t }) => ageLabels(p, t),
  },
  {
    key: 'gender', group: 'classification', type: 'text', width: 10,
    label: { ar: 'الجنس', en: 'Gender' },
    getValue: (p, { t }) => genderLabel(p.gender, t),
  },

  // ── Product information ──────────────────────────────────────────────
  {
    key: 'description', group: 'info', type: 'text', width: 36, wrap: true,
    label: { ar: 'الوصف (عربي)', en: 'Arabic Description' },
    getValue: (p) => p.description || '',
  },
  {
    key: 'description_en', group: 'info', type: 'text', width: 36, wrap: true,
    label: { ar: 'الوصف (إنجليزي)', en: 'English Description' },
    getValue: (p) => p.description_en || '',
  },
  {
    // One bullet per line inside the single cell — never a row per feature.
    key: 'features_ar', group: 'info', type: 'text', width: 34, wrap: true,
    label: { ar: 'المزايا (عربي)', en: 'Arabic Features' },
    getValue: (p) => cleanFeatureList(p.features_ar).map((f) => `• ${f}`).join('\n'),
  },
  {
    key: 'features_en', group: 'info', type: 'text', width: 34, wrap: true,
    label: { ar: 'المزايا (إنجليزي)', en: 'English Features' },
    getValue: (p) => cleanFeatureList(p.features_en).map((f) => `• ${f}`).join('\n'),
  },
  {
    key: 'material', group: 'info', type: 'text', width: 16,
    label: { ar: 'الخامة', en: 'Material' },
    getValue: (p) => p.material || '',
  },
  {
    key: 'tags', group: 'info', type: 'text', width: 22, wrap: true,
    label: { ar: 'الوسوم', en: 'Tags' },
    getValue: (p) => (Array.isArray(p.tags) ? p.tags.join(' | ') : ''),
  },

  // ── Other ────────────────────────────────────────────────────────────
  {
    key: 'status_label', group: 'other', type: 'text', width: 13,
    label: { ar: 'الحالة', en: 'Status' },
    getValue: (p, { ar }) => (p.status === 'draft' ? (ar ? 'مسودة' : 'Draft') : (ar ? 'منشور' : 'Published')),
  },
  {
    key: 'featured', group: 'other', type: 'text', width: 10,
    label: { ar: 'مميز', en: 'Featured' },
    getValue: (p, { ar }) => yesNo(!!p.featured, ar),
  },
  {
    key: 'loyalty_exempt', group: 'other', type: 'text', width: 14,
    label: { ar: 'مستثنى من نقاط الولاء', en: 'Loyalty Exempt' },
    getValue: (p, { ar }) => yesNo(!!p.loyalty_exempt, ar),
  },
  {
    key: 'created_date', group: 'other', type: 'date', width: 13,
    label: { ar: 'تاريخ الإنشاء', en: 'Created Date' },
    getValue: (p) => p.created_date || null,
  },
  {
    key: 'updated_date', group: 'other', type: 'date', width: 13,
    label: { ar: 'آخر تحديث', en: 'Last Updated' },
    getValue: (p) => p.updated_date || null,
  },
];

export const PRODUCT_EXPORT_FIELDS_BY_KEY = Object.fromEntries(PRODUCT_EXPORT_FIELDS.map((f) => [f.key, f]));

export const PRODUCT_EXPORT_GROUPS = [
  { id: 'basic', label: { ar: 'أساسي', en: 'Basic' } },
  { id: 'pricing', label: { ar: 'الأسعار', en: 'Pricing' } },
  { id: 'inventory', label: { ar: 'المخزون', en: 'Inventory' } },
  { id: 'classification', label: { ar: 'التصنيف', en: 'Classification' } },
  { id: 'info', label: { ar: 'معلومات المنتج', en: 'Product Information' } },
  { id: 'other', label: { ar: 'أخرى', en: 'Other' } },
];

// Quick-selection presets — just a starting point; the admin can still
// freely add/remove fields (and reorder) after picking one.
export const PRODUCT_EXPORT_PRESETS = [
  { id: 'pricing', label: { ar: 'الأسعار', en: 'Pricing' }, keys: ['product_code', 'name', 'price', 'sale_price', 'unit_cost'] },
  { id: 'inventory', label: { ar: 'المخزون', en: 'Inventory' }, keys: ['product_code', 'name', 'barcode', 'stock', 'stock_status'] },
  { id: 'barcodePricing', label: { ar: 'الباركود والأسعار', en: 'Barcode + Pricing' }, keys: ['product_code', 'barcode', 'name', 'price', 'unit_cost'] },
];
