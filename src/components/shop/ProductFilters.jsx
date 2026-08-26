import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { categoryName } from '@/lib/bilingual';

export const AGE_OPTIONS = [
{ id: '0_2', min: 0, max: 2 },
{ id: '3_5', min: 3, max: 5 },
{ id: '6', min: 6, max: Infinity }];


export function ageRange(a) {
  if (!a) return { min: 0, max: Infinity };
  if (a.trim() === '0+') return { min: 0, max: Infinity };
  const [lo, hi] = a.split('-').map((x) => parseInt(x.trim(), 10));
  return { min: isNaN(lo) ? 0 : lo, max: isNaN(hi) ? Infinity : hi };
}

export const overlaps = (a, b) => a.max >= b.min && a.min <= b.max;

const Chip = ({ active, onClick, children }) =>
<button
  type="button"
  onClick={onClick}
  className={`squish h-10 px-4 rounded-full text-sm font-medium transition-colors ${
  active ? 'bg-cosmic text-white' : 'bg-background text-foreground/70 hover:bg-accent/20'}`
  }>
  
    {children}
  </button>;


export default function ProductFilters({
  cats, setCats, ages, setAges, priceBounds, price, setPrice, onClear, hasActive,
  extraCategories = [], usedCategoryNames = []
}) {
  const { t, lang } = useLanguage();
  const toggleArr = (arr, val, setter) =>
  setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);

  // Single source of truth: only categories that exist in the DB, are active,
  // and currently have at least one product are shown — no hard-coded list.
  const usedSet = React.useMemo(() => new Set(usedCategoryNames), [usedCategoryNames]);
  const visibleCats = React.useMemo(
    () =>
      extraCategories
        .filter((c) => c && c.active !== false && usedSet.has(c.name))
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || String(a.name).localeCompare(String(b.name))),
    [extraCategories, usedSet]
  );

  const [minBound, maxBound] = priceBounds;
  const [pmin, pmax] = price;
  const step = Math.max(1, Math.round((maxBound - minBound) / 100));

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-bold text-sm uppercase tracking-widest text-muted-foreground">
          {t('plp.filters')}
        </h3>
        {hasActive &&
        <button onClick={onClear} className="text-sm text-cosmic font-heading font-bold hover:underline">
            {t('plp.clearAll')}
          </button>
        }
      </div>

      <div>
        <p className="text-sm font-heading font-bold mb-3">{t('plp.category')}</p>
        <div className="flex flex-wrap gap-2">
          {visibleCats.map((c) =>
          <Chip key={c.id} active={cats.includes(c.name)} onClick={() => toggleArr(cats, c.name, setCats)}>
              {categoryName(c, lang)}
            </Chip>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-heading font-bold">{t('plp.priceRange')}</p>
          <p className="text-sm text-muted-foreground">₪{pmin} – ₪{pmax}</p>
        </div>
        <div className="space-y-3">
          <input
            type="range" min={minBound} max={maxBound} step={step} value={pmin}
            onChange={(e) => setPrice([Math.min(Number(e.target.value), pmax), pmax])}
            className="w-full accent-cosmic" />
          
          <input
            type="range" min={minBound} max={maxBound} step={step} value={pmax}
            onChange={(e) => setPrice([pmin, Math.max(Number(e.target.value), pmin)])}
            className="w-full accent-cosmic" />
          
        </div>
      </div>

      <div>
        <p className="text-sm font-heading font-bold mb-3">{t('plp.age')}</p>
        <div className="flex flex-wrap gap-2">
          {AGE_OPTIONS.map((g) =>
          <Chip key={g.id} active={ages.includes(g.id)} onClick={() => toggleArr(ages, g.id, setAges)}>
              {t(`age.${g.id}`)}
            </Chip>
          )}
        </div>
      </div>
    </div>);

}