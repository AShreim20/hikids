// Shared age-range definitions for products.
//
// The 5 specific ranges (AGE_OPTIONS) are used by the shop age filter and the
// header "Shop by Gender" sub-menus. "all" is a product-only attribute — a toy
// suitable for all ages appears under every specific age filter.
//
// Products store their age ranges as an `ages` array of these ids. Legacy
// products may still carry a free-text `age_range` string; ageRangeToIds maps
// those to the closest structured ids, and ageLabels renders either source.

export const AGE_OPTIONS = [
  { id: '0_2', min: 0, max: 2 },
  { id: '3_5', min: 3, max: 5 },
  { id: '6_8', min: 6, max: 8 },
  { id: '9_12', min: 9, max: 12 },
  { id: '12', min: 12, max: Infinity },
];

export const PRODUCT_AGE_OPTIONS = [...AGE_OPTIONS, { id: 'all', min: 0, max: Infinity }];

// Map a legacy free-text age_range (e.g. "3-5", "0+", "6-8", "12+") to the
// closest structured age ids. Open-ended ranges ("6+") expand to every range
// at or above the minimum; "0+"/"all" maps to ["all"].
export function ageRangeToIds(a) {
  if (!a) return [];
  const raw = String(a).trim();
  if (!raw) return [];
  const s = raw.toLowerCase();
  if (s === '0+' || s === 'all' || s === '0' || s === '0-0') return ['all'];
  const parts = raw.split('-').map((x) => x.trim());
  const lo = parseInt((parts[0] || '').replace('+', ''), 10);
  const hi = parts[1] ? parseInt(parts[1].replace('+', ''), 10) : NaN;
  const min = isNaN(lo) ? 0 : lo;
  if (isNaN(hi)) {
    // open-ended, e.g. "6+", "12+": all ranges at or above min
    return AGE_OPTIONS.filter((o) => o.min >= min).map((o) => o.id);
  }
  // bounded: ranges fully contained within [min, hi]
  return AGE_OPTIONS.filter((o) => o.min >= min && o.max <= hi).map((o) => o.id);
}

// Human-readable age label(s) for a product, preferring the structured `ages`
// array and falling back to the legacy `age_range` string (mapped).
export function ageLabels(product, t) {
  const ids = Array.isArray(product?.ages) && product.ages.length ? product.ages : null;
  let list = ids;
  if (!list && product?.age_range) list = ageRangeToIds(product.age_range);
  if (!list || !list.length) return product?.age_range || '';
  return list.map((id) => t(`age.${id}`)).join(' · ');
}