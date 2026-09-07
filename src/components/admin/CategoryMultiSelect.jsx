import React, { useMemo, useState } from 'react';
import { X, Search } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { categoryName } from '@/lib/bilingual';

// Searchable "Additional Categories" picker: a search box that filters the
// category list as you type, with matches shown once typing narrows the list
// (never a giant permanent checkbox list), and selections rendered as
// removable chips underneath. `excludeId` (the current Primary Category)
// never appears as a pickable option or, if already selected, gets dropped —
// the primary/additional split is enforced here, not just by convention.
export default function CategoryMultiSelect({ categories, selectedIds, onChange, excludeId }) {
  const { t, lang } = useLanguage();
  const [q, setQ] = useState('');

  const available = useMemo(
    () => categories.filter((c) => c.id !== excludeId && !selectedIds.includes(c.id)),
    [categories, excludeId, selectedIds]
  );
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return available.filter((c) => categoryName(c, lang).toLowerCase().includes(term)).slice(0, 8);
  }, [available, q, lang]);
  const selected = selectedIds.map((id) => categories.find((c) => c.id === id)).filter(Boolean);

  const add = (id) => { onChange([...selectedIds, id]); setQ(''); };
  const remove = (id) => onChange(selectedIds.filter((x) => x !== id));

  return (
    <div>
      <div className="relative">
        <Search className="absolute top-1/2 -translate-y-1/2 start-4 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('admin.searchCategories')}
          className="w-full h-11 ps-11 pe-4 rounded-2xl bg-mist border border-border text-sm focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic"
        />
        {q && (
          <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-2xl bg-card border border-border shadow-xl">
            {filtered.length > 0 ? (
              filtered.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => add(c.id)}
                  className="w-full text-start px-4 py-2.5 text-sm hover:bg-mist transition-colors"
                >
                  {categoryName(c, lang)}
                </button>
              ))
            ) : (
              <p className="px-4 py-2.5 text-sm text-muted-foreground">{t('admin.noResults')}</p>
            )}
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selected.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1.5 h-9 ps-3 pe-2 rounded-full bg-cosmic/10 text-cosmic border border-cosmic/20 text-sm font-medium"
            >
              {categoryName(c, lang)}
              <button
                type="button"
                onClick={() => remove(c.id)}
                className="grid place-items-center w-5 h-5 rounded-full hover:bg-cosmic hover:text-white transition-colors"
                aria-label={lang === 'ar' ? 'إزالة' : 'Remove'}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
