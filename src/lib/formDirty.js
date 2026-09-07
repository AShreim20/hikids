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
