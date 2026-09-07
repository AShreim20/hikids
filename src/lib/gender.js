// Canonical internal values for product gender classification and the
// storefront's gender filter/navigation (URL query param, filter chips,
// header "Shop by Gender" menu, admin product editor). Every call site
// compares against these three values — never against a translated label —
// so filtering keeps working regardless of UI language.
//
// A product's own classification (products.gender) is one of these three,
// or NULL for "not yet classified" — NULL is a distinct, real state and is
// never treated as GENDER_BOTH (see shopProducts' matchesGender()).
export const GENDER_MALE = 'male';
export const GENDER_FEMALE = 'female';
export const GENDER_BOTH = 'both';

// Tolerant parser for the `gender` *filter* query param (Boys/Girls only —
// there is no "both" filter selection, "both" is a product classification).
// Accepts the canonical values plus the old pre-migration 'Boy'/'Girl'
// values and a few obvious synonyms, so a bookmarked or hand-typed URL still
// resolves instead of silently dropping the filter.
export function parseGenderParam(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return null;
  if (['male', 'boy', 'boys', 'm'].includes(s)) return GENDER_MALE;
  if (['female', 'girl', 'girls', 'f'].includes(s)) return GENDER_FEMALE;
  return null;
}
