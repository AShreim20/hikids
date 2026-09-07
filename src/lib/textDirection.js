// Helpers for keeping English/numeric content left-to-right inside the
// Arabic (RTL) UI. The document direction is set globally in
// LanguageContext, so anything that only ever holds English, numbers or
// codes has to opt out of it explicitly.

// Input types whose value is never Arabic. Browsers already force LTR on
// "tel" and "date", but not on these — so they need it set.
const LTR_INPUT_TYPES = new Set([
  'email',
  'url',
  'number',
  'password',
  'tel',
  'date',
  'time',
  'datetime-local',
]);

export function isLtrInputType(type) {
  return LTR_INPUT_TYPES.has(type);
}

// Date/time formatting passes 'ar-u-nu-latn' rather than plain 'ar'. The bare
// locale makes toLocaleDateString/toLocaleTimeString render Arabic-Indic
// numerals (٠١٢٣), which don't match the Western digits used everywhere else
// for prices, order references and stock counts. The `-u-nu-latn` extension
// keeps Arabic month names while forcing Latin digits.
export const AR_DATE_LOCALE = 'ar-u-nu-latn';
