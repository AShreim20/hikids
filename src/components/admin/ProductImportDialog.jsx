import React, { useMemo, useRef, useState } from 'react';
import {
  Upload, FileSpreadsheet, Loader2, AlertTriangle, CheckCircle2, XCircle, Download, ChevronRight, ChevronLeft,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/components/ui/use-toast';
import { db } from '@/api/entities';
import { invokeFunction } from '@/lib/supabaseFunctions';
import { fetchAllRows, todayStamp } from '@/lib/excelExportHelpers';
import { hasVariants } from '@/lib/variants';
import { bulkImportProducts } from '@/lib/productImportFunctions';
import {
  PRODUCT_IMPORT_FIELDS, PRODUCT_IMPORT_FIELDS_BY_KEY, READONLY_RECOGNIZED_KEYS, fieldLabel,
} from '@/lib/productImportFields';

const STEPS = ['upload', 'columns', 'fields', 'preview', 'results'];
const BATCH_SIZE = 200;

// Reads a product's CURRENT value for a given import field key, in the same
// raw shape the field's parser produces — this is what "changed vs
// unchanged" and the Preview's "Current" column both compare against.
function currentValue(product, key) {
  switch (key) {
    case 'name': return product.name || '';
    case 'name_en': return product.name_en || '';
    case 'barcode': return product.barcode || '';
    case 'price': return Number(product.price) || 0;
    case 'sale_price': return product.sale_price != null ? Number(product.sale_price) : null;
    case 'unit_cost': return product.unit_cost != null ? Number(product.unit_cost) : null;
    case 'stock': return Number(product.stock) || 0;
    case 'description': return product.description || '';
    case 'description_en': return product.description_en || '';
    case 'features_ar': return Array.isArray(product.features_ar) ? product.features_ar : [];
    case 'features_en': return Array.isArray(product.features_en) ? product.features_en : [];
    case 'material': return product.material || '';
    case 'tags': return Array.isArray(product.tags) ? product.tags : [];
    case 'gender': return product.gender || null;
    case 'status': return product.status === 'draft' ? 'draft' : 'published';
    case 'featured': return !!product.featured;
    case 'loyalty_exempt': return !!product.loyalty_exempt;
    case 'category': return { primary_category_id: product.primary_category_id || null, category: product.category || '' };
    case 'extra_categories': return Array.isArray(product.category_ids) ? [...product.category_ids].sort() : [];
    default: return null;
  }
}

function valuesEqual(key, a, b) {
  if (key === 'features_ar' || key === 'features_en' || key === 'tags') {
    return JSON.stringify(a || []) === JSON.stringify(b || []);
  }
  if (key === 'extra_categories') return JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort());
  if (key === 'category') return (a?.primary_category_id || null) === (b?.primary_category_id || null);
  return a === b;
}

function displayValue(key, value, lang) {
  if (value == null || value === '') return '—';
  if (key === 'features_ar' || key === 'features_en' || key === 'tags') return Array.isArray(value) ? value.join(', ') || '—' : String(value);
  if (key === 'extra_categories') return Array.isArray(value) && value.length ? `${value.length}` : '—';
  if (key === 'category') return value.category || '—';
  if (key === 'gender') return value === 'male' ? (lang === 'ar' ? 'ولادي' : 'Boys') : value === 'female' ? (lang === 'ar' ? 'بناتي' : 'Girls') : value === 'both' ? (lang === 'ar' ? 'الجنسين' : 'Both') : '—';
  if (key === 'status') return value === 'draft' ? (lang === 'ar' ? 'مسودة' : 'Draft') : (lang === 'ar' ? 'منشور' : 'Published');
  if (key === 'featured' || key === 'loyalty_exempt') return value ? (lang === 'ar' ? 'نعم' : 'Yes') : (lang === 'ar' ? 'لا' : 'No');
  return String(value);
}

// Builds the {product_code, fields} payload for one row's ACTUAL changes —
// the single place Update vs Replace semantics are decided.
function computePlan({ parsed, columnMap, selectedFields, importMode, productByCode, categories, t, lang, ar }) {
  const codeCol = parsed.columns.find((c) => columnMap[c.colIndex] === 'product_code');
  const codeCounts = new Map();
  if (codeCol) {
    for (const row of parsed.rows) {
      const code = String(row.cells[codeCol.colIndex] ?? '').trim().toLowerCase();
      if (code) codeCounts.set(code, (codeCounts.get(code) || 0) + 1);
    }
  }

  const fieldCols = parsed.columns.filter((c) => selectedFields.has(columnMap[c.colIndex]));
  const ctx = { t, categories };

  const rows = parsed.rows.map((row) => {
    const codeRaw = codeCol ? String(row.cells[codeCol.colIndex] ?? '').trim() : '';
    const codeLower = codeRaw.toLowerCase();
    const fields = [];
    let rowStatus = 'unchanged';
    let rowError = null;

    if (!codeRaw) {
      rowError = ar ? 'كود المنتج مفقود' : 'Missing Product Code';
    } else if (codeCounts.get(codeLower) > 1) {
      rowError = ar ? 'كود المنتج مكرر داخل الملف' : 'Duplicate Product Code in file';
    } else if (!productByCode.has(codeLower)) {
      rowError = ar ? 'كود المنتج غير معروف' : 'Unknown Product Code';
    }

    const product = productByCode.get(codeLower) || null;
    const payloadFields = {};

    if (!rowError && product) {
      for (const col of fieldCols) {
        const key = columnMap[col.colIndex];
        const def = PRODUCT_IMPORT_FIELDS_BY_KEY[key];
        if (!def) continue;

        if (key === 'stock' && hasVariants(product)) {
          fields.push({ key, current: currentValue(product, key), next: undefined, status: 'warning', message: ar ? 'يستخدم متغيرات — تم تجاهل المخزون' : 'Uses variants — Stock skipped' });
          if (rowStatus !== 'error') rowStatus = 'warning';
          continue;
        }

        const raw = row.cells[col.colIndex];
        const result = def.parse(raw, ctx);
        const cur = currentValue(product, key);

        if (result.error) {
          const msg = ar
            ? { invalidNumber: 'قيمة رقمية غير صالحة', invalidGender: 'قيمة جنس غير معروفة', invalidStatus: 'حالة غير معروفة', invalidAge: 'فئة عمرية غير معروفة' }[result.error] || 'قيمة غير صالحة'
            : { invalidNumber: 'Invalid number', invalidGender: 'Unrecognized gender', invalidStatus: 'Unrecognized status', invalidAge: 'Unrecognized age' }[result.error] || 'Invalid value';
          fields.push({ key, current: cur, next: undefined, status: 'error', message: msg });
          rowStatus = 'error';
          continue;
        }

        if (result.empty) {
          if (importMode === 'replace' && def.required) {
            fields.push({ key, current: cur, next: undefined, status: 'error', message: ar ? 'حقل مطلوب — لا يمكن تفريغه' : 'Required field — cannot be cleared' });
            rowStatus = 'error';
            continue;
          }
          if (importMode === 'replace' && !def.required) {
            const changed = !valuesEqual(key, cur, key === 'category' ? { primary_category_id: null, category: '' } : (key === 'tags' || key.startsWith('features') || key === 'extra_categories' ? [] : null));
            fields.push({ key, current: cur, next: changed ? null : cur, status: changed ? 'changed' : 'unchanged' });
            if (changed) {
              payloadFields[key === 'category' ? 'primary_category_id' : key] = key === 'tags' || key.startsWith('features') || key === 'extra_categories' ? [] : null;
              if (key === 'category') payloadFields.category = null;
              if (changed && rowStatus === 'unchanged') rowStatus = 'changed';
            }
            continue;
          }
          // Update mode, blank cell: never touch this field.
          fields.push({ key, current: cur, next: cur, status: 'unchanged' });
          continue;
        }

        let newVal = result.value;
        if (key === 'category' && !newVal) {
          fields.push({ key, current: cur, next: undefined, status: 'warning', message: ar ? 'تصنيف غير معروف — لم يتم تغييره' : 'Unknown category — left unchanged' });
          if (rowStatus !== 'error') rowStatus = 'warning';
          continue;
        }

        const changed = !valuesEqual(key, cur, newVal);
        const entry = { key, current: cur, next: newVal, status: changed ? 'changed' : 'unchanged' };
        if (result.warning) {
          entry.status = 'warning';
          entry.message = result.warning.startsWith('unrecognizedAge:')
            ? (ar ? `فئات عمرية غير معروفة: ${result.warning.split(':')[1]}` : `Unrecognized ages: ${result.warning.split(':')[1]}`)
            : result.warning.startsWith('unknownCategories:')
              ? (ar ? `تصنيفات غير معروفة: ${result.warning.split(':')[1]}` : `Unknown categories: ${result.warning.split(':')[1]}`)
              : result.warning === 'barcodeWasNumber'
                ? (ar ? 'تم تخزين الباركود كرقم في Excel — تحقق من عدم فقد الأصفار' : 'Barcode was stored as a number in Excel — verify no leading zeros were lost')
                : result.warning;
          if (rowStatus !== 'error') rowStatus = 'warning';
        } else if (changed && rowStatus === 'unchanged') {
          rowStatus = 'changed';
        }
        fields.push(entry);

        if (changed) {
          if (key === 'category') { payloadFields.primary_category_id = newVal.primary_category_id; payloadFields.category = newVal.category; }
          else if (key === 'extra_categories') payloadFields.category_ids = newVal;
          else payloadFields[key] = newVal;
        }
      }
    }

    if (rowError) rowStatus = 'error';

    return {
      rowNumber: row.rowNumber,
      productCode: codeRaw || (ar ? '(بدون كود)' : '(no code)'),
      productName: product?.name || product?.name_en || '',
      status: rowStatus,
      rowError,
      fields,
      payloadFields,
    };
  });

  const summary = {
    total: rows.length,
    changed: rows.filter((r) => r.status === 'changed').length,
    unchanged: rows.filter((r) => r.status === 'unchanged').length,
    warning: rows.filter((r) => r.status === 'warning').length,
    error: rows.filter((r) => r.status === 'error').length,
    fieldCounts: {},
  };
  for (const row of rows) {
    if (row.status === 'error') continue;
    for (const f of row.fields) {
      if (f.status === 'changed') summary.fieldCounts[f.key] = (summary.fieldCounts[f.key] || 0) + 1;
    }
  }

  return { rows, summary };
}

export default function ProductImportDialog({ open, onOpenChange, categories, onImported }) {
  const { t, lang } = useLanguage();
  const ar = lang === 'ar';
  const { toast } = useToast();
  const [step, setStep] = useState('upload');
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [columnMap, setColumnMap] = useState({});
  const [selectedFields, setSelectedFields] = useState(new Set());
  const [importMode, setImportMode] = useState('update');
  const [plan, setPlan] = useState(null);
  const [previewFilter, setPreviewFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [results, setResults] = useState(null);
  const fileInputRef = useRef(null);

  const reset = () => {
    setStep('upload'); setFileName(''); setParsed(null); setColumnMap({});
    setSelectedFields(new Set()); setImportMode('update'); setPlan(null);
    setPreviewFilter('all'); setResults(null);
  };
  const close = () => { if (!busy) { onOpenChange(false); setTimeout(reset, 200); } };

  const handleFile = async (file) => {
    if (!file) return;
    setParsing(true);
    setFileName(file.name);
    try {
      // exceljs is a large dependency most admin page-loads never need —
      // loaded on demand, right when a file is actually chosen, exactly
      // like ProductExportDialog already does for the export side.
      const { parseProductWorkbook } = await import('@/lib/excelImport');
      const result = await parseProductWorkbook(file);
      const map = {};
      for (const c of result.columns) if (c.fieldKey) map[c.colIndex] = c.fieldKey;
      setParsed(result);
      setColumnMap(map);
      setStep('columns');
    } catch (err) {
      toast({ title: ar ? 'تعذّرت قراءة الملف' : 'Could not read the file', description: err?.message, variant: 'destructive' });
    } finally {
      setParsing(false);
    }
  };

  const importableColumns = useMemo(
    () => (parsed ? parsed.columns.filter((c) => columnMap[c.colIndex] && !READONLY_RECOGNIZED_KEYS.has(columnMap[c.colIndex])) : []),
    [parsed, columnMap]
  );
  const hasProductCodeColumn = useMemo(() => parsed?.columns.some((c) => columnMap[c.colIndex] === 'product_code'), [parsed, columnMap]);

  const goFields = () => {
    if (!hasProductCodeColumn) {
      toast({ title: ar ? 'الملف لا يحتوي على عمود كود المنتج' : 'The file has no Product Code column', variant: 'destructive' });
      return;
    }
    setStep('fields');
  };

  const toggleField = (key) => setSelectedFields((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const runPreview = async () => {
    if (!selectedFields.size) {
      toast({ title: ar ? 'اختر حقلاً واحدًا على الأقل' : 'Select at least one field', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const products = await fetchAllRows(db.Product, '-updated_date');
      const productByCode = new Map(products.filter((p) => p.product_code).map((p) => [p.product_code.toLowerCase(), p]));
      const result = computePlan({ parsed, columnMap, selectedFields, importMode, productByCode, categories: categories || [], t, lang, ar });
      setPlan(result);
      setStep('preview');
    } catch (err) {
      toast({ title: ar ? 'تعذّر تجهيز المعاينة' : 'Could not prepare the preview', description: err?.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const confirmImport = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      // Skipped: a Preview-time problem (unknown/duplicate code, invalid
      // value) — never even sent to the backend. Failed: it WAS sent but the
      // backend rejected it (e.g. a barcode conflict that only appeared
      // between Preview and Confirm). These are deliberately two different
      // counts/reasons, matching the task's own "Skipped: 3 / Failed: 1"
      // example — not two labels for the same row.
      const skippedRows = plan.rows.filter((r) => r.status === 'error').map((r) => ({ ...r, error: r.rowError || (r.fields.find((f) => f.status === 'error')?.message) }));
      const actionable = plan.rows.filter((r) => r.status !== 'error' && Object.keys(r.payloadFields).length > 0);
      const okResults = [];
      for (let i = 0; i < actionable.length; i += BATCH_SIZE) {
        const batch = actionable.slice(i, i + BATCH_SIZE).map((r) => ({ product_code: r.productCode, fields: r.payloadFields }));
        const data = await bulkImportProducts(batch);
        if (data?.success === false) throw new Error(data.message || 'Forbidden');
        for (const res of data.results) {
          const row = actionable[okResults.length];
          okResults.push({ ...row, success: res.success, error: res.error });
        }
      }
      const updated = okResults.filter((r) => r.success).length;
      const serverFailedRows = okResults.filter((r) => !r.success);
      const unchanged = plan.rows.filter((r) => r.status === 'unchanged' || (r.status === 'warning' && Object.keys(r.payloadFields).length === 0)).length;

      setResults({
        updated, unchanged, skipped: skippedRows.length, failed: serverFailedRows.length,
        // Union, for the downloadable report only — a skipped row and a
        // server-rejected row are both "why didn't this get imported".
        errorReportRows: [...skippedRows, ...serverFailedRows],
        total: plan.summary.total,
      });
      setStep('results');
      invokeFunction('logAuditActivity', {
        action: 'product.bulk_import', target_type: 'product', target_id: '',
        details: `Bulk import: ${updated} updated, ${skippedRows.length} skipped, ${serverFailedRows.length} failed, ${plan.summary.total} rows (${importMode})`,
      }).catch(() => {});
      onImported && onImported();
    } catch (err) {
      toast({ title: ar ? 'تعذّر تنفيذ التوريد' : 'Import failed', description: err?.message, variant: 'destructive' });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const downloadTemplate = async () => {
    const { buildWorkbook, downloadWorkbook } = await import('@/lib/excelExport');
    const cols = [
      { key: 'product_code', ar: 'كود المنتج', en: 'Product Code', type: 'text', width: 14 },
      { key: 'name', ar: 'اسم الصنف', en: 'Arabic Product Name', type: 'text', width: 26 },
      { key: 'barcode', ar: 'الباركود', en: 'Barcode', type: 'text', width: 16 },
      { key: 'sku', ar: 'SKU', en: 'SKU', type: 'text', width: 16 },
      { key: 'unit_cost', ar: 'سعر التكلفة', en: 'Unit Cost', type: 'currency', width: 13 },
      { key: 'price', ar: 'سعر البيع', en: 'Selling Price', type: 'currency', width: 13 },
      { key: 'sale_price', ar: 'سعر الخصم', en: 'Discount Price', type: 'currency', width: 13 },
      { key: 'stock', ar: 'الكمية', en: 'Stock', type: 'int', width: 11 },
    ];
    const workbook = buildWorkbook({
      rtl: ar,
      sheets: [{
        name: ar ? 'المنتجات' : 'Products',
        columns: cols.map((c) => ({ header: ar ? c.ar : c.en, key: c.key, type: c.type, width: c.width })),
        rows: [],
        reportHeader: { title: 'HiKids', subtitle: 'قالب استيراد المنتجات / Product Import Template', meta: [] },
        headerStyle: { fill: '5D3F85', fontColor: 'FFFFFF' },
      }],
    });
    await downloadWorkbook(workbook, `HiKids_Import_Template_${todayStamp()}.xlsx`);
  };

  const downloadErrorReport = async () => {
    const { buildWorkbook, downloadWorkbook } = await import('@/lib/excelExport');
    const rows = results.errorReportRows.map((r) => ({ row: r.rowNumber, code: r.productCode, name: r.productName, error: r.error }));
    const workbook = buildWorkbook({
      rtl: ar,
      sheets: [{
        name: ar ? 'أخطاء' : 'Errors',
        columns: [
          { header: ar ? 'صف Excel' : 'Excel Row', key: 'row', width: 12, type: 'int' },
          { header: ar ? 'كود المنتج' : 'Product Code', key: 'code', width: 16, type: 'text' },
          { header: ar ? 'اسم المنتج' : 'Product Name', key: 'name', width: 26, wrap: true },
          { header: ar ? 'سبب الخطأ' : 'Error Reason', key: 'error', width: 36, wrap: true },
        ],
        rows,
        headerStyle: { fill: '5D3F85', fontColor: 'FFFFFF' },
      }],
    });
    await downloadWorkbook(workbook, `HiKids_Import_Errors_${todayStamp()}.xlsx`);
  };

  const filteredRows = useMemo(() => {
    if (!plan) return [];
    if (previewFilter === 'all') return plan.rows;
    if (previewFilter === 'changed') return plan.rows.filter((r) => r.status === 'changed');
    if (previewFilter === 'unchanged') return plan.rows.filter((r) => r.status === 'unchanged');
    if (previewFilter === 'warning') return plan.rows.filter((r) => r.status === 'warning');
    if (previewFilter === 'error') return plan.rows.filter((r) => r.status === 'error');
    return plan.rows;
  }, [plan, previewFilter]);

  const stepIndex = STEPS.indexOf(step);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto grid-cols-1" dir={ar ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-cosmic" />
            {ar ? 'توريد Excel' : 'Import Excel'}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {[ar ? 'رفع الملف' : 'Upload', ar ? 'الأعمدة' : 'Columns', ar ? 'الحقول' : 'Fields', ar ? 'المعاينة' : 'Preview', ar ? 'النتائج' : 'Results'].map((label, i) => (
            <React.Fragment key={label}>
              {i > 0 && (ar ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)}
              <span className={i === stepIndex ? 'font-bold text-cosmic' : ''}>{label}</span>
            </React.Fragment>
          ))}
        </div>

        {/* STEP 1 — Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-mist border border-border text-sm font-heading font-bold text-foreground/80"
            >
              <Download className="w-4 h-4" /> {ar ? 'تحميل نموذج' : 'Download Template'}
            </button>
            <div
              className="rounded-2xl border-2 border-dashed border-border p-10 text-center cursor-pointer hover:border-cosmic transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {parsing ? (
                <Loader2 className="w-8 h-8 mx-auto animate-spin text-cosmic" />
              ) : (
                <>
                  <FileSpreadsheet className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p className="mt-2 text-sm font-heading font-bold">{fileName || (ar ? 'اختر ملف Excel (.xlsx)' : 'Choose an Excel file (.xlsx)')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{ar ? 'صدّر من HiKids، عدّل الأسعار، ثم ارفعه هنا' : 'Export from HiKids, edit prices, then upload it here'}</p>
                </>
              )}
              <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
            </div>
          </div>
        )}

        {/* STEP 2 — Columns */}
        {step === 'columns' && parsed && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {ar ? `تم اكتشاف صف العناوين رقم ${parsed.headerRowNum} — ${parsed.rows.length} صف بيانات` : `Detected header row ${parsed.headerRowNum} — ${parsed.rows.length} data rows`}
            </p>
            <div className="rounded-2xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-mist">
                  <tr>
                    <th className="px-3 py-2 text-start">{ar ? 'عمود Excel' : 'Excel Column'}</th>
                    <th className="px-3 py-2 text-start">{ar ? 'الحقل المطابق' : 'Mapped Field'}</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.columns.map((c) => {
                    const key = columnMap[c.colIndex];
                    const readonly = key && READONLY_RECOGNIZED_KEYS.has(key);
                    return (
                      <tr key={c.colIndex} className="border-t border-border/60">
                        <td className="px-3 py-2 font-medium">{c.header}</td>
                        <td className="px-3 py-2">
                          {readonly ? (
                            <span className="text-xs px-2 py-1 rounded-full bg-cosmic/10 text-cosmic font-bold">
                              {key === 'product_code' ? (ar ? 'معرف / للقراءة فقط' : 'Identifier / Read Only') : (ar ? 'للقراءة فقط' : 'Read Only')}
                            </span>
                          ) : key ? (
                            <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-700 dark:text-green-400 font-bold">{fieldLabel(key, lang)}</span>
                          ) : (
                            <select
                              value=""
                              onChange={(e) => setColumnMap((m) => ({ ...m, [c.colIndex]: e.target.value || undefined }))}
                              className="h-9 px-2 rounded-lg bg-card border border-border text-xs"
                            >
                              <option value="">{ar ? 'غير معروف — تجاهل' : 'Unrecognized — Ignore'}</option>
                              {PRODUCT_IMPORT_FIELDS.map((f) => (
                                <option key={f.key} value={f.key}>{fieldLabel(f.key, lang)}</option>
                              ))}
                            </select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!hasProductCodeColumn && (
              <p className="text-sm text-destructive flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> {ar ? 'لازم يحتوي الملف على عمود كود المنتج' : 'The file must include a Product Code column'}</p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setStep('upload')} className="h-11 px-5 rounded-full bg-mist font-heading font-bold text-sm">{ar ? 'رجوع' : 'Back'}</button>
              <button type="button" onClick={goFields} className="h-11 px-5 rounded-full bg-cosmic text-white font-heading font-bold text-sm">{ar ? 'التالي' : 'Next'}</button>
            </div>
          </div>
        )}

        {/* STEP 3 — Fields + Mode */}
        {step === 'fields' && (
          <div className="space-y-5">
            <div>
              <p className="text-sm font-heading font-bold mb-2">{ar ? 'المعرف' : 'Identifier'}</p>
              <div className="h-11 px-3 rounded-2xl border border-border bg-mist/50 flex items-center gap-2 text-sm text-muted-foreground">
                {fieldLabel('product_code', lang)} — {ar ? 'يُستخدم دائمًا لتحديد المنتج ولا يتغيّر' : 'Always used to identify the product — never changed'}
              </div>
            </div>
            <div>
              <p className="text-sm font-heading font-bold mb-2">{ar ? 'الحقول المراد تحديثها' : 'Fields to Update'}</p>
              <div className="grid sm:grid-cols-2 gap-1.5">
                {importableColumns.map((c) => {
                  const key = columnMap[c.colIndex];
                  return (
                    <label key={c.colIndex} className="flex items-center gap-2 h-9 px-2 rounded-lg hover:bg-mist cursor-pointer text-sm min-w-0">
                      <Checkbox checked={selectedFields.has(key)} onCheckedChange={() => toggleField(key)} className="shrink-0" />
                      <span className="truncate min-w-0">{fieldLabel(key, lang)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            {selectedFields.has('stock') && (
              <p className="text-sm bg-accent/10 text-accent-foreground border border-accent/30 rounded-2xl px-4 py-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                {ar ? 'سيتم تعديل كميات المخزون للأصناف المحددة.' : 'Stock quantities will be changed for the selected products.'}
              </p>
            )}
            <div>
              <p className="text-sm font-heading font-bold mb-2">{ar ? 'طريقة التوريد' : 'Import Mode'}</p>
              <RadioGroup value={importMode} onValueChange={setImportMode} className="space-y-2">
                <label className={`flex items-start gap-2 p-3 rounded-2xl border cursor-pointer ${importMode === 'update' ? 'border-cosmic bg-cosmic/5' : 'border-border'}`}>
                  <RadioGroupItem value="update" className="mt-0.5 shrink-0" />
                  <span>
                    <span className="block font-heading font-bold text-sm">{ar ? 'تعديل البيانات (الافتراضي)' : 'Update (default)'}</span>
                    <span className="block text-xs text-muted-foreground">{ar ? 'الخلايا الفارغة في Excel لا تغيّر شيئًا.' : 'Blank Excel cells never change anything.'}</span>
                  </span>
                </label>
                <label className={`flex items-start gap-2 p-3 rounded-2xl border cursor-pointer ${importMode === 'replace' ? 'border-cosmic bg-cosmic/5' : 'border-border'}`}>
                  <RadioGroupItem value="replace" className="mt-0.5 shrink-0" />
                  <span>
                    <span className="block font-heading font-bold text-sm">{ar ? 'استبدال الحقول المحددة' : 'Replace Selected Fields'}</span>
                    <span className="block text-xs text-muted-foreground">{ar ? 'خلية فارغة لحقل اختياري محدد قد تُفرغ القيمة الحالية. الحقول غير المحددة أو غير الموجودة بالملف لا تتغيّر أبدًا.' : 'A blank cell for a selected optional field may clear it. Unselected or absent-from-Excel fields never change.'}</span>
                  </span>
                </label>
              </RadioGroup>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setStep('columns')} className="h-11 px-5 rounded-full bg-mist font-heading font-bold text-sm">{ar ? 'رجوع' : 'Back'}</button>
              <button type="button" onClick={runPreview} disabled={busy} className="h-11 px-5 rounded-full bg-cosmic text-white font-heading font-bold text-sm inline-flex items-center gap-2 disabled:opacity-60">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {ar ? 'معاينة' : 'Preview'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4/5 — Preview + Confirm */}
        {step === 'preview' && plan && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              {[
                [ar ? 'التغييرات' : 'Changed', plan.summary.changed, 'text-cosmic'],
                [ar ? 'بدون تغيير' : 'Unchanged', plan.summary.unchanged, 'text-muted-foreground'],
                [ar ? 'تحذيرات' : 'Warnings', plan.summary.warning, 'text-amber-600'],
                [ar ? 'أخطاء' : 'Errors', plan.summary.error, 'text-destructive'],
              ].map(([label, n, cls]) => (
                <div key={label} className="rounded-2xl bg-mist p-3">
                  <p className={`text-xl font-heading font-extrabold ${cls}`}>{n}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[['all', ar ? 'الكل' : 'All'], ['changed', ar ? 'التغييرات' : 'Changes'], ['unchanged', ar ? 'بدون تغيير' : 'Unchanged'], ['warning', ar ? 'تحذيرات' : 'Warnings'], ['error', ar ? 'أخطاء' : 'Errors']].map(([v, l]) => (
                <button key={v} type="button" onClick={() => setPreviewFilter(v)} className={`h-8 px-3 rounded-full text-xs font-heading font-bold ${previewFilter === v ? 'bg-cosmic text-white' : 'bg-mist text-foreground/70'}`}>
                  {l}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-mist sticky top-0">
                  <tr>
                    <th className="px-2.5 py-2 text-start whitespace-nowrap">{ar ? 'كود المنتج' : 'Product Code'}</th>
                    <th className="px-2.5 py-2 text-start whitespace-nowrap">{ar ? 'المنتج' : 'Product'}</th>
                    <th className="px-2.5 py-2 text-start whitespace-nowrap">{ar ? 'الحقل' : 'Field'}</th>
                    <th className="px-2.5 py-2 text-start whitespace-nowrap">{ar ? 'الحالي' : 'Current'}</th>
                    <th className="px-2.5 py-2 text-start whitespace-nowrap">{ar ? 'الجديد' : 'New'}</th>
                    <th className="px-2.5 py-2 text-start whitespace-nowrap">{ar ? 'الحالة' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.flatMap((row) => {
                    if (row.rowError) {
                      return [(
                        <tr key={row.rowNumber} className="border-t border-border/60 bg-destructive/5">
                          <td className="px-2.5 py-2 font-medium">{row.productCode}</td>
                          <td className="px-2.5 py-2">{row.productName}</td>
                          <td className="px-2.5 py-2 text-muted-foreground" colSpan={3}>{row.rowError}</td>
                          <td className="px-2.5 py-2"><XCircle className="w-3.5 h-3.5 text-destructive" /></td>
                        </tr>
                      )];
                    }
                    const shown = previewFilter === 'unchanged' ? row.fields.filter((f) => f.status === 'unchanged') : row.fields.filter((f) => f.status !== 'unchanged' || previewFilter === 'all');
                    if (!shown.length) return [];
                    return shown.map((f) => (
                      <tr key={`${row.rowNumber}-${f.key}`} className="border-t border-border/60">
                        <td className="px-2.5 py-2 font-medium whitespace-nowrap">{row.productCode}</td>
                        <td className="px-2.5 py-2 max-w-[160px] truncate">{row.productName}</td>
                        <td className="px-2.5 py-2 whitespace-nowrap">{fieldLabel(f.key, lang)}</td>
                        <td className="px-2.5 py-2">{displayValue(f.key, f.current, lang)}</td>
                        <td className="px-2.5 py-2">{f.next !== undefined ? displayValue(f.key, f.next, lang) : (f.message || '—')}</td>
                        <td className="px-2.5 py-2">
                          {f.status === 'changed' && <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />}
                          {f.status === 'unchanged' && <span className="text-muted-foreground">—</span>}
                          {f.status === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                          {f.status === 'error' && <XCircle className="w-3.5 h-3.5 text-destructive" />}
                        </td>
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>

            {/* STEP 5 — Confirm (final summary directly above the action) */}
            <div className="rounded-2xl bg-mist p-4 space-y-2">
              <p className="font-heading font-bold text-sm">
                {ar ? `سيتم تعديل ${plan.summary.changed} صنف.` : `${plan.summary.changed} products will be updated.`}
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {Object.entries(plan.summary.fieldCounts).map(([key, n]) => (
                  <li key={key}>{n} × {fieldLabel(key, lang)}</li>
                ))}
              </ul>
              {importMode === 'replace' && (
                <p className="text-xs text-amber-600 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {ar ? 'وضع الاستبدال قد يفرّغ الحقول الاختيارية المحددة إذا كانت خلية Excel فارغة.' : 'Replace mode may clear selected optional fields left blank in Excel.'}</p>
              )}
            </div>

            <div className="sticky bottom-0 bg-background pt-3 border-t border-border flex items-center justify-end gap-2">
              <button type="button" onClick={close} disabled={busy} className="h-11 px-5 rounded-full bg-mist font-heading font-bold text-sm disabled:opacity-60">{ar ? 'إلغاء' : 'Cancel'}</button>
              <button
                type="button"
                onClick={confirmImport}
                disabled={busy || !plan.summary.changed}
                className="h-11 px-5 rounded-full bg-cosmic text-white font-heading font-bold text-sm inline-flex items-center gap-2 disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {busy ? (ar ? 'جاري التوريد...' : 'Importing...') : (ar ? 'تأكيد التوريد' : 'Confirm Import')}
              </button>
            </div>
          </div>
        )}

        {/* STEP 6 — Results */}
        {step === 'results' && results && (
          <div className="space-y-4">
            <p className="font-heading font-extrabold text-xl">{ar ? 'تم التوريد' : 'Import Complete'}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              {[
                [ar ? 'تم التحديث' : 'Updated', results.updated, 'text-green-600'],
                [ar ? 'بدون تغيير' : 'Unchanged', results.unchanged, 'text-muted-foreground'],
                [ar ? 'متجاوَز' : 'Skipped', results.skipped, 'text-amber-600'],
                [ar ? 'فشل' : 'Failed', results.failed, 'text-destructive'],
              ].map(([label, n, cls]) => (
                <div key={label} className="rounded-2xl bg-mist p-3">
                  <p className={`text-xl font-heading font-extrabold ${cls}`}>{n}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            {results.errorReportRows.length > 0 && (
              <button type="button" onClick={downloadErrorReport} className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-destructive/10 text-destructive text-sm font-heading font-bold">
                <Download className="w-4 h-4" /> {ar ? 'تحميل تقرير الأخطاء' : 'Download Error Report'}
              </button>
            )}
            <div className="flex justify-end">
              <button type="button" onClick={close} className="h-11 px-5 rounded-full bg-cosmic text-white font-heading font-bold text-sm">{ar ? 'إغلاق' : 'Close'}</button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
