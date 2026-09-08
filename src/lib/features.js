// Sanitizes a product's Features list before it's ever written to the DB (or
// re-checked on display, as defense-in-depth against legacy/malformed data):
// trims each entry, drops anything that's empty or whitespace-only, and
// preserves the admin's chosen order.
export function cleanFeatureList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((s) => String(s ?? '').trim()).filter(Boolean);
}

// Recognizes a leading list-marker on one line of pasted text — bullet
// (•●○▪‣◦·*), dash (-–—), or numbered ("1.", "2)", incl. Arabic-Indic
// digits ١٢٣) — and strips it, so pasting a copied list into a Feature row
// never stores the marker itself as part of the feature text.
//
// Each marker pattern requires trailing whitespace before it matches, which
// is what keeps this from mangling a feature that legitimately *starts*
// with a number or dash as meaningful content — "1.5 kg" (no space after
// the dot) or "2-in-1 design" (no space after the dash) are left untouched,
// since real list markers are always followed by a space in every pasted
// format this needs to support.
const BULLET_MARKER = /^[•●○▪‣◦·*]\s+/;
const DASH_MARKER = /^[-–—]\s+/;
const NUMBERED_MARKER = /^(?:\d+|[٠-٩]+)[.)]\s+/;

export function stripFeatureListMarker(line) {
  return String(line ?? '')
    .replace(BULLET_MARKER, '')
    .replace(DASH_MARKER, '')
    .replace(NUMBERED_MARKER, '');
}

// Turns pasted clipboard text into individual feature strings when it looks
// like a copied list (2+ non-empty lines) — bulleted, numbered, dashed, or
// plain multiline text all qualify equally, per "line break detection".
// Returns null for anything that isn't a multi-line paste (a single normal
// sentence, or a single bulleted line pasted alone) so the caller can fall
// back to the existing single-feature paste behavior untouched.
export function parseFeaturesPaste(text) {
  const lines = String(text ?? '').split(/\r\n|\r|\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const cleaned = lines.map((l) => stripFeatureListMarker(l).trim()).filter(Boolean);
  return cleaned.length ? cleaned : null;
}
