// Shared "is this form dirty" comparison for admin edit pages. Plain
// JSON-equality is enough here — these are modest, JSON-serializable form
// objects (no functions/dates as live objects), and comparing on every
// keystroke this way is well under a millisecond.
export function snapshotsEqual(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return a === b;
  }
}

// Counts how many top-level keys differ between two plain objects — used to
// show "N unsaved changes" instead of a plain dirty/clean boolean. Same
// JSON-equality approach as snapshotsEqual, just per-key instead of whole-
// object, so it stays accurate for the shallow form-shaped objects these
// admin pages use (a nested object/array counts as one changed field, which
// matches how one field/row reads to the admin either way).
export function diffCount(a, b) {
  try {
    const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    let n = 0;
    for (const k of keys) {
      if (JSON.stringify(a?.[k]) !== JSON.stringify(b?.[k])) n += 1;
    }
    return n;
  } catch {
    return snapshotsEqual(a, b) ? 0 : 1;
  }
}
