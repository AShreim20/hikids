import React, { useMemo, useRef, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, X, ChevronUp, ChevronDown, Loader2, FileSpreadsheet } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/components/ui/use-toast';
import { todayStamp } from '@/lib/excelExportHelpers';

const HIKIDS_PURPLE = '5D3F85';
const PREVIEW_ROWS = 5;

function presetMatchesSelection(preset, selectedSet) {
  return preset.keys.length === selectedSet.size && preset.keys.every((k) => selectedSet.has(k));
}

// The shared, config-driven Excel export dialog used across the whole
// Admin — Product Management is just its first (and reference) caller, via
// productExportConfig.js. Every module supplies:
//   - fields/groups/presets: same registry shape productExportFields.js
//     already used (label:{ar,en}, type, width, wrap, getValue(record,ctx))
//   - records/filterFn/selectedIds: whatever "scope" means for that page
//   - buildRow(record, fieldKeys, ctx): reads one record into a flat row
//     object (may attach hidden, non-column `_flag` props for cellHighlight)
//   - fetchAll(): optional full re-fetch beyond the page's on-screen cap,
//     used for the real export (not the preview, which stays cheap/on-screen)
// Everything about the actual .xlsx (branding, header row, autofilter,
// freeze panes, RTL, data types) is unchanged from the Product reference —
// this component only decides WHICH rows/columns go into that same engine.
export default function ExcelExportDialog({
  open, onOpenChange,
  dialogTitle, sheetName, reportSubtitle, countLabel, fileNamePrefix,
  fields, groups, presets, defaultFieldKeys,
  records, filterFn, selectedIds, scopes,
  buildRow, cellHighlight, fetchAll, fieldCtx: extraCtx,
}) {
  const { t, lang } = useLanguage();
  const ar = lang === 'ar';
  const { toast } = useToast();
  const availableScopes = scopes || (selectedIds ? ['all', 'filtered', 'selected'] : filterFn ? ['all', 'filtered'] : ['all']);
  const [scope, setScope] = useState(availableScopes[0]);
  const [fieldOrder, setFieldOrder] = useState(defaultFieldKeys || fields.slice(0, 6).map((f) => f.key));
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false); // extra synchronous guard against a double-click race the busy state's re-render can't catch in time

  const fieldsByKey = useMemo(() => Object.fromEntries(fields.map((f) => [f.key, f])), [fields]);
  const selectedSet = useMemo(() => new Set(fieldOrder), [fieldOrder]);
  const fieldCtx = useMemo(() => ({ t, lang, ar, ...(extraCtx || {}) }), [t, lang, ar, extraCtx]);
  const selectedCount = selectedIds ? selectedIds.size : 0;

  const scopedOnScreen = useMemo(() => {
    if (scope === 'selected' && selectedIds) return records.filter((r) => selectedIds.has(r.id));
    if (scope === 'filtered' && filterFn) return records.filter(filterFn);
    return records;
  }, [records, scope, filterFn, selectedIds]);

  const previewRows = useMemo(
    () => scopedOnScreen.slice(0, PREVIEW_ROWS).map((r) => buildRow(r, fieldOrder, fieldCtx)),
    [scopedOnScreen, fieldOrder, fieldCtx, buildRow]
  );

  const toggleField = (key) => {
    setFieldOrder((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  };
  const applyPreset = (keys) => setFieldOrder(keys);
  const selectAll = () => setFieldOrder(fields.map((f) => f.key));
  const clearAll = () => setFieldOrder([]);
  const move = (i, delta) => {
    const target = i + delta;
    if (target < 0 || target >= fieldOrder.length) return;
    const next = [...fieldOrder];
    [next[i], next[target]] = [next[target], next[i]];
    setFieldOrder(next);
  };
  const onDragEnd = (res) => {
    if (!res.destination || res.destination.index === res.source.index) return;
    const next = Array.from(fieldOrder);
    const [moved] = next.splice(res.source.index, 1);
    next.splice(res.destination.index, 0, moved);
    setFieldOrder(next);
  };

  const runExport = async () => {
    if (busyRef.current || !fieldOrder.length) return;
    busyRef.current = true;
    setBusy(true);
    try {
      let rows;
      if (scope === 'selected' && selectedIds) {
        rows = records.filter((r) => selectedIds.has(r.id));
      } else {
        const all = fetchAll ? await fetchAll() : records;
        rows = scope === 'filtered' && filterFn ? all.filter(filterFn) : all;
      }
      if (!rows.length) {
        toast({ title: ar ? 'لا توجد بيانات لتصديرها' : 'No data to export', variant: 'destructive' });
        return;
      }

      const columns = fieldOrder.map((key) => {
        const f = fieldsByKey[key];
        return { header: f.label[lang] || f.label.en, key, width: f.width, type: f.type, wrap: f.wrap };
      });
      const exportRows = rows.map((r) => buildRow(r, fieldOrder, fieldCtx));

      const dateStamp = new Date();
      const dd = String(dateStamp.getDate()).padStart(2, '0');
      const mm = String(dateStamp.getMonth() + 1).padStart(2, '0');
      const meta = [
        `${countLabel[lang] || countLabel.en}: ${rows.length}`,
        `${ar ? 'تاريخ التصدير' : 'Export date'}: ${dd}/${mm}/${dateStamp.getFullYear()}`,
      ];

      const matchedPreset = (presets || []).find((p) => presetMatchesSelection(p, selectedSet));
      const suffix = matchedPreset ? `_${matchedPreset.label.en.replace(/\s+/g, '')}` : '';
      const fileName = `HiKids_${fileNamePrefix}${suffix}_${todayStamp()}.xlsx`;

      // ExcelJS is a large dependency most admin page-loads never need —
      // loaded on demand, right when an export is actually requested.
      const { buildWorkbook, downloadWorkbook } = await import('@/lib/excelExport');
      const workbook = buildWorkbook({
        rtl: ar,
        sheets: [{
          name: sheetName[lang] || sheetName.en,
          columns,
          rows: exportRows,
          reportHeader: { title: 'HiKids', subtitle: reportSubtitle[lang] || reportSubtitle.en, meta },
          headerStyle: { fill: HIKIDS_PURPLE, fontColor: 'FFFFFF' },
          zebra: true,
          cellHighlight,
          print: { repeatHeaderRows: true },
        }],
      });
      await downloadWorkbook(workbook, fileName);
      onOpenChange(false);
    } catch (err) {
      toast({ title: ar ? 'تعذّر إنشاء ملف Excel' : 'Could not generate the Excel file', description: err?.message, variant: 'destructive' });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const scopeLabels = {
    all: ar ? `الكل (${records.length})` : `All (${records.length})`,
    filtered: filterFn ? (ar ? `النتائج المفلترة (${records.filter(filterFn).length})` : `Filtered Results (${records.filter(filterFn).length})`) : '',
    selected: ar ? `العناصر المحددة (${selectedCount})` : `Selected (${selectedCount})`,
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      {/* grid-cols-1 overrides the base Dialog's implicit "auto" grid track —
          without it, a nowrap/truncate label anywhere below (there are many:
          field names, scope labels) contributes its full unwrapped text width
          to the track's max-content sizing and forces the whole dialog wider
          than its own box, causing a horizontal scrollbar. */}
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto grid-cols-1" dir={ar ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-cosmic" />
            {dialogTitle[lang] || dialogTitle.en}
          </DialogTitle>
        </DialogHeader>

        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={selectAll} className="h-9 px-3.5 rounded-full text-xs font-heading font-bold bg-cosmic text-white squish">
            {ar ? 'كل البيانات' : 'Select All'}
          </button>
          <button type="button" onClick={clearAll} className="h-9 px-3.5 rounded-full text-xs font-heading font-bold bg-mist text-foreground/80 squish">
            {ar ? 'إلغاء تحديد الكل' : 'Clear All'}
          </button>
          {(presets || []).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.keys)}
              className="h-9 px-3.5 rounded-full text-xs font-heading font-bold bg-mist text-foreground/80 hover:bg-cosmic/10 squish"
            >
              {p.label[lang] || p.label.en}
            </button>
          ))}
        </div>

        {/* Scope */}
        {availableScopes.length > 1 && (
          <div>
            <p className="text-sm font-heading font-bold mb-2">{ar ? 'نطاق التصدير' : 'Export Scope'}</p>
            <RadioGroup value={scope} onValueChange={setScope} className={`grid gap-2 ${availableScopes.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
              {availableScopes.map((value) => (
                <label
                  key={value}
                  className={`flex items-center gap-2 h-11 px-3 rounded-2xl border text-sm cursor-pointer min-w-0 ${
                    scope === value ? 'border-cosmic bg-cosmic/5' : 'border-border'
                  } ${value === 'selected' && selectedCount === 0 ? 'opacity-40 pointer-events-none' : ''}`}
                >
                  <RadioGroupItem value={value} disabled={value === 'selected' && selectedCount === 0} className="shrink-0" />
                  <span className="truncate min-w-0">{scopeLabels[value]}</span>
                </label>
              ))}
            </RadioGroup>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-5">
          {/* Field picker, grouped */}
          <div className="min-w-0">
            <p className="text-sm font-heading font-bold mb-2">{ar ? 'الحقول المتاحة' : 'Available Fields'}</p>
            <div className="space-y-3 max-h-72 overflow-y-auto pe-1">
              {groups.map((g) => (
                <div key={g.id}>
                  <p className="text-xs font-bold text-muted-foreground mb-1">{g.label[lang] || g.label.en}</p>
                  <div className="space-y-1">
                    {fields.filter((f) => f.group === g.id).map((f) => (
                      <label key={f.key} className="flex items-center gap-2 h-8 px-1.5 rounded-lg hover:bg-mist cursor-pointer text-sm min-w-0">
                        <Checkbox checked={selectedSet.has(f.key)} onCheckedChange={() => toggleField(f.key)} className="shrink-0" />
                        <span className="truncate min-w-0">{f.label[lang] || f.label.en}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selected fields — order = Excel column order */}
          <div className="min-w-0">
            <p className="text-sm font-heading font-bold mb-2">
              {ar ? `الحقول المحددة (${fieldOrder.length}) — اسحب لإعادة الترتيب` : `Selected Fields (${fieldOrder.length}) — drag to reorder`}
            </p>
            {!fieldOrder.length ? (
              <p className="text-sm text-muted-foreground p-3 rounded-2xl bg-mist">
                {ar ? 'اختر حقلاً واحدًا على الأقل' : 'Select at least one field'}
              </p>
            ) : (
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="export-fields">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1.5 max-h-72 overflow-y-auto pe-1">
                      {fieldOrder.map((key, i) => {
                        const f = fieldsByKey[key];
                        if (!f) return null;
                        return (
                          <Draggable key={key} draggableId={key} index={i}>
                            {(prov, snapshot) => (
                              <div
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                className={`flex items-center gap-1 rounded-xl bg-mist border p-1 ${
                                  snapshot.isDragging ? 'border-cosmic shadow-lg' : 'border-transparent'
                                }`}
                              >
                                <button type="button" {...prov.dragHandleProps} className="grid place-items-center w-7 h-7 rounded-full text-muted-foreground hover:bg-card cursor-grab active:cursor-grabbing shrink-0" aria-label={t('admin.dragToReorder')}>
                                  <GripVertical className="w-4 h-4" />
                                </button>
                                <div className="flex flex-col shrink-0">
                                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="grid place-items-center w-5 h-4 text-muted-foreground disabled:opacity-25" aria-label={t('admin.moveImageBack')}>
                                    <ChevronUp className="w-3 h-3" />
                                  </button>
                                  <button type="button" onClick={() => move(i, 1)} disabled={i === fieldOrder.length - 1} className="grid place-items-center w-5 h-4 text-muted-foreground disabled:opacity-25" aria-label={t('admin.moveImageForward')}>
                                    <ChevronDown className="w-3 h-3" />
                                  </button>
                                </div>
                                <span className="flex-1 min-w-0 truncate text-sm">{f.label[lang] || f.label.en}</span>
                                <button type="button" onClick={() => toggleField(key)} className="grid place-items-center w-7 h-7 rounded-full text-muted-foreground hover:bg-destructive hover:text-white transition-colors shrink-0" aria-label={t('admin.delete')}>
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </div>
        </div>

        {/* Preview */}
        <div>
          <p className="text-sm font-heading font-bold mb-2">
            {ar ? `معاينة (أول ${Math.min(PREVIEW_ROWS, scopedOnScreen.length)} من ${scopedOnScreen.length})` : `Preview (first ${Math.min(PREVIEW_ROWS, scopedOnScreen.length)} of ${scopedOnScreen.length})`}
          </p>
          {!fieldOrder.length || !previewRows.length ? (
            <p className="text-sm text-muted-foreground p-3 rounded-2xl bg-mist">
              {!fieldOrder.length ? (ar ? 'لا توجد حقول محددة' : 'No fields selected') : (ar ? 'لا توجد بيانات مطابقة' : 'No matching records')}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-mist">
                    {fieldOrder.map((key) => (
                      <th key={key} className="px-2.5 py-2 text-start font-heading font-bold whitespace-nowrap">
                        {fieldsByKey[key]?.label[lang] || key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-t border-border/60">
                      {fieldOrder.map((key) => (
                        <td key={key} className="px-2.5 py-2 max-w-[200px] truncate">{String(row[key] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer — sticky so it stays reachable while the field/preview lists scroll on
            mobile. No horizontal negative margin here (a -mx-6 "bleed to the dialog's own
            edge" trick briefly caused a real horizontal-overflow bug inside the grid
            layout above) — a small side margin matching the rest of the dialog is a
            fine trade-off for guaranteed no-overflow. */}
        <div className="sticky bottom-0 bg-background pt-3 border-t border-border flex items-center justify-end gap-2">
          <button type="button" onClick={() => onOpenChange(false)} disabled={busy} className="h-11 px-5 rounded-full bg-mist font-heading font-bold text-sm disabled:opacity-60">
            {ar ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={runExport}
            disabled={busy || !fieldOrder.length}
            className="h-11 px-5 rounded-full bg-cosmic text-white font-heading font-bold text-sm inline-flex items-center gap-2 disabled:opacity-50 squish"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            {busy ? (ar ? 'جاري التجهيز...' : 'Preparing...') : (ar ? 'تصدير Excel' : 'Export Excel')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
