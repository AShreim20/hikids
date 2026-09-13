import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { categoryName } from '@/lib/bilingual';
import { AGE_OPTIONS } from '@/lib/ages';
import { GENDER_MALE, GENDER_FEMALE } from '@/lib/gender';

export { AGE_OPTIONS };


export function ageRange(a) {
  if (!a) return { min: 0, max: Infinity };
  if (a.trim() === '0+') return { min: 0, max: Infinity };
  const [lo, hi] = a.split('-').map((x) => parseInt(x.trim(), 10));
  return { min: isNaN(lo) ? 0 : lo, max: isNaN(hi) ? Infinity : hi };
}

export const overlaps = (a, b) => a.max >= b.min && a.min <= b.max;

// Single source of truth for "which categories are worth showing": only
// ones that exist in the DB, are active, and currently have at least one
// product — no hard-coded list. Shared by the full filter body (drawer) and
// the toolbar's own Category quick-filter popover so the two can never drift
// out of sync with each other.
export function visibleCategories(extraCategories = [], usedCategoryNames = []) {
  const usedSet = new Set(usedCategoryNames);
  return extraCategories
    .filter((c) => c && c.active !== false && usedSet.has(c.name))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || String(a.name).localeCompare(String(b.name)));
}

const Chip = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`squish h-10 px-4 rounded-full text-sm font-medium transition-colors ${
      active ? 'bg-cosmic text-white' : 'bg-background text-foreground/70 hover:bg-accent/20'
    }`}
  >
    {children}
  </button>
);

// Each section below is self-contained (own heading + controls) so it can be
// rendered either standalone inside a quick-filter popover, or all four
// together inside the advanced Filter Drawer — same state, same handlers,
// two different presentations, zero duplicated filtering logic.

export function CategorySection({ cats, setCats, extraCategories = [], usedCategoryNames = [] }) {
  const { t, lang } = useLanguage();
  const toggle = (val) => setCats(cats.includes(val) ? cats.filter((x) => x !== val) : [...cats, val]);
  const cases = React.useMemo(() => visibleCategories(extraCategories, usedCategoryNames), [extraCategories, usedCategoryNames]);
  return (
    <div>
      <p className="text-sm font-heading font-bold mb-3">{t('plp.category')}</p>
      <div className="flex flex-wrap gap-2">
        {cases.map((c) => (
          <Chip key={c.id} active={cats.includes(c.name)} onClick={() => toggle(c.name)}>
            {categoryName(c, lang)}
          </Chip>
        ))}
      </div>
    </div>
  );
}

export function PriceSection({ priceBounds, price, setPrice }) {
  const { t } = useLanguage();
  const [minBound, maxBound] = priceBounds;
  const [pmin, pmax] = price;
  const step = Math.max(1, Math.round((maxBound - minBound) / 100));
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-heading font-bold">{t('plp.priceRange')}</p>
        {/* bdi: without isolation the RTL page swaps the two ends of the
            range, showing the max first — "₪50 – ₪10". */}
        <p className="text-sm text-muted-foreground"><bdi>₪{pmin} – ₪{pmax}</bdi></p>
      </div>
      <div className="space-y-3">
        <input
          type="range" min={minBound} max={maxBound} step={step} value={pmin}
          onChange={(e) => setPrice([Math.min(Number(e.target.value), pmax), pmax])}
          className="w-full accent-cosmic"
        />
        <input
          type="range" min={minBound} max={maxBound} step={step} value={pmax}
          onChange={(e) => setPrice([pmin, Math.max(Number(e.target.value), pmin)])}
          className="w-full accent-cosmic"
        />
      </div>
    </div>
  );
}

export function GenderSection({ gender, setGender }) {
  const { t } = useLanguage();
  return (
    <div>
      <p className="text-sm font-heading font-bold mb-3">{t('plp.gender')}</p>
      <div className="flex flex-wrap gap-2">
        <Chip active={gender === GENDER_MALE} onClick={() => setGender(gender === GENDER_MALE ? null : GENDER_MALE)}>{t('gender.boys')}</Chip>
        <Chip active={gender === GENDER_FEMALE} onClick={() => setGender(gender === GENDER_FEMALE ? null : GENDER_FEMALE)}>{t('gender.girls')}</Chip>
      </div>
    </div>
  );
}

// A single on/off toggle rather than a multi-select chip group (there's only
// ever one real choice here) — same Chip visual so it doesn't invent a new
// filter style, just used with one option instead of several.
export function OnSaleSection({ onSale, setOnSale }) {
  const { t } = useLanguage();
  return (
    <div>
      <p className="text-sm font-heading font-bold mb-3">{t('plp.onSale')}</p>
      <div className="flex flex-wrap gap-2">
        <Chip active={onSale} onClick={() => setOnSale(!onSale)}>{t('plp.onSale')}</Chip>
      </div>
    </div>
  );
}

export function AgeSection({ ages, setAges }) {
  const { t } = useLanguage();
  const toggle = (val) => setAges(ages.includes(val) ? ages.filter((x) => x !== val) : [...ages, val]);
  return (
    <div>
      <p className="text-sm font-heading font-bold mb-3">{t('plp.age')}</p>
      <div className="flex flex-wrap gap-2">
        {AGE_OPTIONS.map((g) => (
          <Chip key={g.id} active={ages.includes(g.id)} onClick={() => toggle(g.id)}>
            {t(`age.${g.id}`)}
          </Chip>
        ))}
      </div>
    </div>
  );
}

// Full filter body — every section together, in one scrollable column.
// Used inside the advanced Filter Drawer (its header/footer wrap this).
export default function ProductFilters({
  cats, setCats, ages, setAges, priceBounds, price, setPrice,
  extraCategories = [], usedCategoryNames = [], gender, setGender,
  onSale, setOnSale,
}) {
  return (
    <div className="space-y-7">
      <OnSaleSection onSale={onSale} setOnSale={setOnSale} />
      <CategorySection cats={cats} setCats={setCats} extraCategories={extraCategories} usedCategoryNames={usedCategoryNames} />
      <PriceSection priceBounds={priceBounds} price={price} setPrice={setPrice} />
      <GenderSection gender={gender} setGender={setGender} />
      <AgeSection ages={ages} setAges={setAges} />
    </div>
  );
}
