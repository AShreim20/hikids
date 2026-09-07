// Sanitizes a product's Features list before it's ever written to the DB (or
// re-checked on display, as defense-in-depth against legacy/malformed data):
// trims each entry, drops anything that's empty or whitespace-only, and
// preserves the admin's chosen order.
export function cleanFeatureList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((s) => String(s ?? '').trim()).filter(Boolean);
}
