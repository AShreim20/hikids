import React, { useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, Loader2, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/components/ui/use-toast';

const SCOPE_LABEL = {
  filtered: { ar: 'النتائج المفلترة', en: 'Filtered Results' },
  all: { ar: 'جميع البيانات', en: 'All Data' },
  selected: { ar: 'الصفوف المحددة', en: 'Selected Rows' },
};

// Reusable "Export Excel" control for any admin table/report. A page only
// supplies `getSheets(scope)` — an async function returning either
// `{ sheets, fileName }` (sheets in the shape excelExport.buildWorkbook
// expects) or a falsy value to silently cancel (e.g. the page already
// toasted "nothing selected" and there's nothing to export). Everything
// else — the button, the scope menu, the loading state, error handling,
// and the actual file generation/download — lives here once.
//
// `scopes` controls what's offered: omit it (or pass a single-item array)
// for a page where only one export makes sense — clicking exports directly,
// no menu. Pass e.g. ['filtered', 'all'] or ['filtered', 'all', 'selected']
// to show the small scope menu the task asks for.
export default function ExportExcelButton({ getSheets, scopes, disabled, className = '' }) {
  const { lang } = useLanguage();
  const ar = lang === 'ar';
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const list = scopes && scopes.length ? scopes : ['filtered'];

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const run = async (scope) => {
    setOpen(false);
    if (busy) return;
    setBusy(true);
    try {
      const result = await getSheets(scope);
      if (!result) return; // page already explained why (e.g. nothing selected)
      const { sheets, fileName } = result;
      if (!sheets || !sheets.some((s) => (s.rows || []).length)) {
        toast({ title: ar ? 'لا توجد بيانات لتصديرها' : 'No data to export' });
        return;
      }
      // ExcelJS is a large dependency that most admin page-loads never
      // need — loaded on demand, right when an export is actually
      // requested, instead of bloating every admin page's own bundle.
      const { exportExcel } = await import('@/lib/excelExport');
      await exportExcel({ sheets, fileName, rtl: ar });
    } catch (err) {
      toast({
        title: ar ? 'تعذّر إنشاء ملف Excel' : 'Could not generate the Excel file',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => (list.length > 1 ? setOpen((o) => !o) : run(list[0]))}
        className="squish inline-flex items-center gap-2 h-10 px-4 rounded-full bg-mist border border-border text-sm font-heading font-bold text-foreground/80 hover:border-cosmic disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <FileSpreadsheet className="w-4 h-4 shrink-0" />}
        <span className="whitespace-nowrap">
          {busy ? (ar ? 'جاري تجهيز ملف Excel...' : 'Preparing Excel file...') : (ar ? 'تصدير Excel' : 'Export Excel')}
        </span>
        {list.length > 1 && !busy && <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
      </button>

      {open && list.length > 1 && (
        <div
          className="absolute z-20 mt-1 w-52 rounded-2xl bg-card border border-border shadow-xl overflow-hidden py-1"
          style={ar ? { right: 0 } : { left: 0 }}
        >
          {list.map((scope) => (
            <button
              key={scope}
              type="button"
              onClick={() => run(scope)}
              className="w-full text-start px-4 py-2.5 text-sm hover:bg-mist transition-colors"
            >
              {SCOPE_LABEL[scope]?.[lang] || scope}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
