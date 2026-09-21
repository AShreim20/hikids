import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useLanguage } from '@/context/LanguageContext';
import ProductFilters from './ProductFilters';

// Mobile (<768px) bottom sheet for the existing filters. Edits a local draft
// and only applies it (one URL/state update) on "Apply Filters"; Reset clears
// the draft, Close discards it. The sections are the same ProductFilters used
// by the desktop drawer -- no duplicated filtering logic.
export default function FilterSheet({ open, onClose, onApply, current, ...sectionProps }) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState(current);
  useEffect(() => { if (open) setDraft(current); }, [open]);

  const reset = () => setDraft({ cats: [], ages: [], gender: null, onSale: false, price: null });
  const priceValue = draft.price || sectionProps.priceBounds;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="bottom" className="flex max-h-[88vh] flex-col rounded-t-3xl p-0 [&>button]:hidden">
        <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-5 py-4">
          <SheetTitle className="font-heading font-bold text-lg">{t('plp.filters')}</SheetTitle>
          <button type="button" onClick={onClose} className="squish relative grid place-items-center w-10 h-10 rounded-full bg-mist after:absolute after:-inset-2 after:content-['']" aria-label={t('plp.close')}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <ProductFilters
            {...sectionProps}
            cats={draft.cats} setCats={(v) => setDraft((d) => ({ ...d, cats: v }))}
            ages={draft.ages} setAges={(v) => setDraft((d) => ({ ...d, ages: v }))}
            gender={draft.gender} setGender={(v) => setDraft((d) => ({ ...d, gender: v }))}
            onSale={draft.onSale} setOnSale={(v) => setDraft((d) => ({ ...d, onSale: v }))}
            price={priceValue} setPrice={(v) => setDraft((d) => ({ ...d, price: v }))}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2 border-t border-border/60 bg-background px-5 py-3 safe-bottom">
          <button type="button" onClick={reset} className="h-12 px-5 rounded-full bg-mist font-heading font-bold">{t('plp.reset')}</button>
          <button type="button" onClick={() => onApply(draft)} className="flex-1 h-12 rounded-full bg-cosmic text-white font-heading font-bold">{t('plp.applyFilters')}</button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
