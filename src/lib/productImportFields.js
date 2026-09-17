// Single source of truth for the IMPORT half of Product Excel — mirrors
// productExportFields.js's fields/labels (so a HiKids-exported column header
// is recognized automatically) but adds, per field: whether it's safe to
// bulk-edit at all, whether it's a true DB-required column (so clearing it
// in Replace mode is an error, not a silent blank), and a parser that reads
// one raw Excel cell value into either a validated value or a warning/error.
//
// Nothing here writes to the database — see excelImport.js (parses the
// workbook) and ProductImportDialog.jsx (drives the wizard and calls the
// bulk_import_products RPC, which re-validates everything server-side too).
import { PRODUCT_EXPORT_FIELDS_BY_KEY } from './productExportFields';
import { cleanFeatureList, stripFeatureListMarker } from './features';
import { AGE_OPTIONS } from './ages';
import { GENDER_MALE, GENDER_FEMALE, GENDER_BOTH } from './gender';

// Excel cells with numbers formatted via a display numFmt (e.g. "130.00 ₪")
// still hand ExcelJS the real underlying number — this only needs to handle
// the one shape that ISN'T already a plain number: a formula cell, which
// ExcelJS returns as `{ formula, result }` rather than the bare result.
function rawCellText(v) {
  if (v == null) return '';
  if (typeof v === 'object' && 'result' in v) return String(v.result ?? '').trim();
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

// Deliberately strict: strips only thousands-separator commas and a
// currency symbol/whitespace, then requires the remainder to be a clean
// number — "abc" or "12abc" are errors, never silently truncated/coerced.
// (`Number('')` is 0 in JS, not NaN — a naive strip-then-Number() on "abc"
// would silently produce a valid-looking 0 instead of failing; this regex
// check is what actually catches that.)
function parseNumber(v) {
  if (v == null || v === '') return { empty: true };
  const raw = typeof v === 'object' && v && 'result' in v ? v.result : v;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? { value: raw } : { error: 'invalidNumber' };
  }
  const str = String(raw).trim();
  if (str === '') return { empty: true };
  const cleaned = str.replace(/,/g, '').replace(/₪|ils/gi, '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return { error: 'invalidNumber' };
  return { value: Number(cleaned) };
}

function parseBoolean(v) {
  const t = rawCellText(v).toLowerCase();
  if (t === '') return { empty: true };
  if (['yes', 'true', '1', 'نعم'].includes(t)) return { value: true };
  if (['no', 'false', '0', 'لا'].includes(t)) return { value: false };
  return { error: 'invalidBoolean' };
}

// Splits a multi-value cell the same way the export joins it (' | ') or, for
// a pasted/typed cell, a comma — whichever the admin actually used.
function splitList(text) {
  const sep = text.includes('|') ? '|' : ',';
  return text.split(sep).map((s) => s.trim()).filter(Boolean);
}

function splitFeatureLines(text) {
  return cleanFeatureList(
    text.split(/\r?\n/).map((l) => stripFeatureListMarker(l.trim()))
  );
}

const GENDER_LOOKUP = {
  male: GENDER_MALE, boy: GENDER_MALE, 'ولد': GENDER_MALE, 'ولادي': GENDER_MALE, 'بولد': GENDER_MALE,
  female: GENDER_FEMALE, girl: GENDER_FEMALE, 'بنت': GENDER_FEMALE, 'بناتي': GENDER_FEMALE,
  both: GENDER_BOTH, 'both boys and girls': GENDER_BOTH, 'الجنسين': GENDER_BOTH, 'كلاهما': GENDER_BOTH,
};

function parseGender(v, ctx) {
  const t = rawCellText(v).toLowerCase();
  if (t === '') return { empty: true };
  if (GENDER_LOOKUP[t]) return { value: GENDER_LOOKUP[t] };
  for (const g of [GENDER_MALE, GENDER_FEMALE, GENDER_BOTH]) {
    if (t === ctx.t(`gender.${g === GENDER_MALE ? 'boy' : g === GENDER_FEMALE ? 'girl' : 'both'}`).toLowerCase()) {
      return { value: g };
    }
  }
  return { error: 'invalidGender' };
}

function parseStatus(v) {
  const t = rawCellText(v).toLowerCase();
  if (t === '') return { empty: true };
  if (['draft', 'مسودة'].includes(t)) return { value: 'draft' };
  if (['published', 'منشور'].includes(t)) return { value: 'published' };
  return { error: 'invalidStatus' };
}

// Resolves a category NAME (ar or en, from the export's own text) back to a
// real category id — never creates one just because of a spelling
// difference. `categories` is the same list Admin.jsx already loads.
function resolveCategory(name, categories) {
  const t = name.trim().toLowerCase();
  return categories.find((c) => (c.name || '').trim().toLowerCase() === t || (c.name_en || '').trim().toLowerCase() === t) || null;
}

function parseAges(v, ctx) {
  const t = rawCellText(v);
  if (t === '') return { empty: true };
  const parts = t.split(/[·,]/).map((s) => s.trim()).filter(Boolean);
  const ids = [];
  const unknown = [];
  for (const p of parts) {
    const lower = p.toLowerCase();
    const match = [...AGE_OPTIONS, { id: 'all' }].find((o) => ctx.t(`age.${o.id}`).toLowerCase() === lower || o.id === lower);
    if (match) ids.push(match.id); else unknown.push(p);
  }
  if (!ids.length) return { error: 'invalidAge' };
  return { value: ids, warning: unknown.length ? `unrecognizedAge:${unknown.join(', ')}` : undefined };
}

// key: the JSON key the bulk_import_products RPC expects in `fields`.
// required: a true NOT NULL DB column — clearing it in Replace mode is an
// error, not a silent blank.
export const PRODUCT_IMPORT_FIELDS = [
  { key: 'name', required: true, parse: (v) => (rawCellText(v) ? { value: rawCellText(v) } : { empty: true }) },
  { key: 'name_en', required: false, parse: (v) => (rawCellText(v) ? { value: rawCellText(v) } : { empty: true }) },
  { key: 'barcode', required: false, parse: (v) => {
    const t = rawCellText(v);
    if (t === '') return { empty: true };
    const warning = typeof v === 'number' ? 'barcodeWasNumber' : undefined;
    return { value: t, warning };
  } },
  { key: 'price', required: true, parse: (v) => {
    const r = parseNumber(v);
    if (r.error || r.empty) return r;
    if (r.value < 0) return { error: 'invalidNumber' };
    return r;
  } },
  { key: 'sale_price', required: false, parse: (v) => {
    const r = parseNumber(v);
    if (r.error) return r;
    if (r.empty) return r;
    if (r.value < 0) return { error: 'invalidNumber' };
    return r;
  } },
  { key: 'unit_cost', required: false, parse: (v) => {
    const r = parseNumber(v);
    if (r.error) return r;
    if (r.empty) return r;
    if (r.value < 0) return { error: 'invalidNumber' };
    return r;
  } },
  { key: 'stock', required: false, parse: (v) => {
    const r = parseNumber(v);
    if (r.error || r.empty) return r;
    if (r.value < 0 || !Number.isFinite(r.value)) return { error: 'invalidNumber' };
    return { value: Math.trunc(r.value) };
  } },
  { key: 'description', required: false, parse: (v) => (rawCellText(v) ? { value: rawCellText(v) } : { empty: true }) },
  { key: 'description_en', required: false, parse: (v) => (rawCellText(v) ? { value: rawCellText(v) } : { empty: true }) },
  { key: 'features_ar', required: false, parse: (v) => {
    const t = rawCellText(v);
    if (!t) return { empty: true };
    return { value: splitFeatureLines(t) };
  } },
  { key: 'features_en', required: false, parse: (v) => {
    const t = rawCellText(v);
    if (!t) return { empty: true };
    return { value: splitFeatureLines(t) };
  } },
  { key: 'material', required: false, parse: (v) => (rawCellText(v) ? { value: rawCellText(v) } : { empty: true }) },
  { key: 'tags', required: false, parse: (v) => {
    const t = rawCellText(v);
    if (!t) return { empty: true };
    return { value: splitList(t) };
  } },
  { key: 'gender', required: false, parse: parseGender },
  { key: 'status', required: false, sourceExportKey: 'status_label', parse: parseStatus },
  { key: 'featured', required: false, parse: parseBoolean },
  { key: 'loyalty_exempt', required: false, parse: parseBoolean },
  { key: 'category', required: true, parse: (v, ctx) => {
    const t = rawCellText(v);
    if (!t) return { empty: true };
    const match = resolveCategory(t, ctx.categories || []);
    if (!match) return { warning: 'unknownCategory' };
    return { value: { primary_category_id: match.id, category: match.name } };
  } },
  { key: 'extra_categories', required: false, parse: (v, ctx) => {
    const t = rawCellText(v);
    if (!t) return { empty: true };
    const names = splitList(t);
    const ids = [];
    const unknown = [];
    for (const n of names) {
      const match = resolveCategory(n, ctx.categories || []);
      if (match) ids.push(match.id); else unknown.push(n);
    }
    return { value: ids, warning: unknown.length ? `unknownCategories:${unknown.join(', ')}` : undefined };
  } },
  { key: 'age', required: false, sourceExportKey: 'age', parse: parseAges },
];

export const PRODUCT_IMPORT_FIELDS_BY_KEY = Object.fromEntries(PRODUCT_IMPORT_FIELDS.map((f) => [f.key, f]));

// Every recognizable Excel header, ar+en, mapped back to an import field key
// (or 'product_code' for the identifier column). Built from the export
// registry's own labels so a HiKids-exported column is always recognized.
export function buildHeaderLookup() {
  const lookup = new Map();
  const add = (label, key) => {
    if (!label) return;
    lookup.set(String(label).trim().toLowerCase(), key);
  };
  add(PRODUCT_EXPORT_FIELDS_BY_KEY.product_code.label.ar, 'product_code');
  add(PRODUCT_EXPORT_FIELDS_BY_KEY.product_code.label.en, 'product_code');
  for (const f of PRODUCT_IMPORT_FIELDS) {
    const exportField = PRODUCT_EXPORT_FIELDS_BY_KEY[f.sourceExportKey || f.key];
    if (!exportField) continue;
    add(exportField.label.ar, f.key);
    add(exportField.label.en, f.key);
  }
  // A couple of extra recognized-but-not-importable columns, so they show up
  // as "recognized" (identifier/read-only) in the mapping step instead of
  // "unrecognized" — matching the export's own labels exactly.
  add(PRODUCT_EXPORT_FIELDS_BY_KEY.sku.label.ar, 'sku');
  add(PRODUCT_EXPORT_FIELDS_BY_KEY.sku.label.en, 'sku');
  add(PRODUCT_EXPORT_FIELDS_BY_KEY.stock_status.label.ar, 'stock_status');
  add(PRODUCT_EXPORT_FIELDS_BY_KEY.stock_status.label.en, 'stock_status');
  add(PRODUCT_EXPORT_FIELDS_BY_KEY.created_date.label.ar, 'created_date');
  add(PRODUCT_EXPORT_FIELDS_BY_KEY.created_date.label.en, 'created_date');
  add(PRODUCT_EXPORT_FIELDS_BY_KEY.updated_date.label.ar, 'updated_date');
  add(PRODUCT_EXPORT_FIELDS_BY_KEY.updated_date.label.en, 'updated_date');
  return lookup;
}

// Fields that are recognized but never editable via import (identifier or
// derived/read-only) — shown as such in the mapping step rather than as
// either a real importable field or a mysterious "unrecognized" column.
export const READONLY_RECOGNIZED_KEYS = new Set(['product_code', 'sku', 'stock_status', 'created_date', 'updated_date']);

export function fieldLabel(key, lang) {
  const exportField = PRODUCT_EXPORT_FIELDS_BY_KEY[key];
  return exportField ? (exportField.label[lang] || exportField.label.en) : key;
}
