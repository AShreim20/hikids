// Tiny shared store (same pattern as chatOpenStore.js) reporting the real
// rendered height of the current page's own sticky bottom purchase bar
// (Product Detail's desktop Add-to-Cart bar today — any future page that
// gets one just needs to report into this same store). 0 means "no sticky
// bar on this page". Floating support buttons and the assistant chat panel
// read this instead of a hard-coded offset, so they always clear it exactly
// — see useFloatingOffset and useReportStickyBarHeight.
let height = 0;
const listeners = new Set();

export function getStickyBarHeight() {
  return height;
}

export function setStickyBarHeight(value) {
  if (value === height) return;
  height = value;
  listeners.forEach((l) => l(height));
}

export function subscribeStickyBarHeight(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
