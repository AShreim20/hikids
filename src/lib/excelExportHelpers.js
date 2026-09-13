// Lightweight helpers a page needs while ASSEMBLING data for an export —
// deliberately kept dependency-free (no `exceljs` import) so a page can use
// them at the top level without pulling that whole library into its own
// bundle chunk. The actual workbook generation lives in excelExport.js and
// is loaded on demand (see ExportExcelButton's dynamic import) only when an
// export is actually requested.

// Pages a-la Admin.jsx / OrdersManagement.jsx load "everything" up to a
// fixed cap (list(sort, 500)) for on-screen filtering rather than true
// server pagination — fine for display, but an export must cover every
// matching record even past that cap (see the task's own "page 1 of 10 but
// 212 matches" example). This pages through the same `db.<Entity>.list()`
// the page already uses, in batches, until a short batch signals the end —
// so a store that ever grows past the on-screen cap still exports
// completely, without ever rendering that many rows in the browser table.
export async function fetchAllRows(entity, sort, batchSize = 1000) {
  const all = [];
  let offset = 0;
  // Guard against an unexpected infinite loop (a backend that ignores
  // offset/limit) rather than hanging the export forever.
  for (let i = 0; i < 200; i++) {
    const batch = await entity.list(sort, batchSize, offset);
    all.push(...batch);
    if (!batch.length || batch.length < batchSize) break;
    offset += batchSize;
  }
  return all;
}

// yyyy-mm-dd for today, or a from/to range — matches the task's own file
// name examples (products_2026-09-12.xlsx, sales_2026-09-01_to_2026-09-12.xlsx).
export function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

export function rangeStamp(start, end) {
  const s = start ? new Date(start).toISOString().slice(0, 10) : null;
  const e = end ? new Date(end).toISOString().slice(0, 10) : null;
  if (s && e && s !== e) return `${s}_to_${e}`;
  return s || e || todayStamp();
}

// Turns a value that might be a Date, an ISO string, or null into a real
// Date object for a 'date' column — never a formatted string — or null to
// leave the cell blank rather than writing "Invalid Date".
export function toExcelDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
