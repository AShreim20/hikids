import React from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import ProductFilters from './ProductFilters';

// Advanced filter panel — every filter the site supports, in one internally
// scrolling column, with a sticky header (title + active count + close) and
// a sticky footer (Clear all / Show N products) that never require scrolling
// the drawer itself to reach. Used the same way on desktop (opened from the
// toolbar's "Filters" button) and mobile (opened from the compact filter
// button) — only the width differs.
//
// Opens from the *reading start* edge (`start-0`) rather than a fixed
// physical side: that's the right edge in Arabic/RTL and the left edge in
// English/LTR, which is what was asked for either way.
export default function FilterDrawer({
  open, onClose, activeCount, resultCount, onClear, hasActive, ...filterProps
}) {
  const { t } = useLanguage();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute start-0 top-0 h-full w-[90%] max-w-sm bg-background shadow-2xl flex flex-col float-in">
        <div className="shrink-0 flex items-center justify-between px-6 py-5 border-b border-border/60">
          <h2 className="font-heading font-bold text-lg">
            {t('plp.filters')}
            {activeCount > 0 && <span className="text-muted-foreground font-normal"> ({activeCount})</span>}
          </h2>
          <button
            onClick={onClose}
            className="squish grid place-items-center w-10 h-10 rounded-full bg-mist"
            aria-label={t('common.back')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 safe-bottom">
          <ProductFilters {...filterProps} />
        </div>

        <div className="shrink-0 flex items-center gap-3 px-6 py-4 border-t border-border/60 bg-background safe-bottom">
          <button
            onClick={onClear}
            disabled={!hasActive}
            className="h-12 px-5 rounded-full bg-mist font-heading font-bold disabled:opacity-40 disabled:pointer-events-none"
          >
            {t('plp.clearAll')}
          </button>
          <button
            onClick={onClose}
            className="flex-1 h-12 rounded-full bg-cosmic text-white font-heading font-bold"
          >
            {t('plp.apply')} ({resultCount})
          </button>
        </div>
      </div>
    </div>
  );
}
