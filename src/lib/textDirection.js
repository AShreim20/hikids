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

// Detects a string's own writing direction from its content, for places
// where direction isn't simply "whatever the site language currently is" —
// e.g. an AI chat message: it's asked to reply in the site's language, but
// rendering from the message's own content means an already-sent message
// keeps its own correct direction even if the customer switches the site
// language mid-conversation, and a bilingual fallback value (an English
// product name falling back to Arabic when empty) always gets the right
// direction for what it actually contains rather than what was requested.
const RTL_CHAR_RE = /[֑-߿ࢠ-ࣿיִ-﷿ﹰ-﻿]/;

export function detectTextDir(text) {
  return RTL_CHAR_RE.test(String(text ?? '')) ? 'rtl' : 'ltr';
}

// Date/time formatting passes 'ar-u-nu-latn' rather than plain 'ar'. The bare
// locale makes toLocaleDateString/toLocaleTimeString render Arabic-Indic
// numerals (٠١٢٣), which don't match the Western digits used everywhere else
// for prices, order references and stock counts. The `-u-nu-latn` extension
// keeps Arabic month names while forcing Latin digits.
export const AR_DATE_LOCALE = 'ar-u-nu-latn';
