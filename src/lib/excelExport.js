import ExcelJS from 'exceljs';

// Shared Excel-export ENGINE for the admin dashboard (see
// src/components/admin/ExportExcelButton.jsx for the UI half, and
// excelExportHelpers.js for the small dependency-free helpers pages use
// while assembling rows). A page only ever needs to describe ITS data:
// which rows, which columns, what to name the file. Every formatting
// concern below is handled once, here, so no page re-implements bold
// headers, frozen panes, autofilter, RTL, currency/date number formats, or
// the actual file download.
//
// This file pulls in `exceljs` (a large library) at the top level —
// ExportExcelButton loads it via a dynamic import() so it never ends up in
// a page's own bundle just because that page renders an export button.
// Import it statically only from another lazily-loaded module.
//
// Column shape: { header, key, width, type, wrap }
//   - key: property name read off each row object.
//   - type: 'currency' | 'int' | 'number' | 'date' | 'text' (default 'text').
//     Only 'text'/'date' columns get a raw value; currency/int/number
//     columns MUST receive an actual JS number (never a pre-formatted
//     string like "150.50 ₪") — the number format below does the display
//     formatting, so Excel still treats the cell as a real number anyone can
//     sum/sort/chart. 'date' columns should receive a real Date object.
//   - wrap: wrap long text instead of letting it overflow into neighboring
//     cells (used for reasons/notes/descriptions/multi-value lists).
const CURRENCY_FMT = '#,##0.00 "₪"';
const INT_FMT = '#,##0';
const NUMBER_FMT = '#,##0.00';
const DATE_FMT = 'yyyy-mm-dd';

function numFmtFor(type) {
  if (type === 'currency') return CURRENCY_FMT;
  if (type === 'int') return INT_FMT;
  if (type === 'number') return NUMBER_FMT;
  if (type === 'date') return DATE_FMT;
  return undefined;
}

// One sheet: { name, columns, rows, rtl, freezeHeader, autoFilter, boldRowIf }
// `boldRowIf(row, index)` lets a report sheet bold its totals/section-header
// rows without the caller hand-styling cells itself.
function addSheet(workbook, sheet) {
  const {
    name, columns, rows = [], rtl = false,
    freezeHeader = true, autoFilter = true, boldRowIf,
  } = sheet;
  // Sheet names can't exceed 31 chars and can't contain : \ / ? * [ ].
  const safeName = String(name || 'Sheet').replace(/[:\\/?*[\]]/g, ' ').slice(0, 31);
  const ws = workbook.addWorksheet(safeName, {
    views: [{ rightToLeft: rtl, state: freezeHeader ? 'frozen' : 'normal', ySplit: freezeHeader ? 1 : 0 }],
  });

  ws.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width || Math.max(12, Math.min(40, (c.header || '').length + 4)),
  }));

  rows.forEach((r) => ws.addRow(r));

  columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    const fmt = numFmtFor(c.type);
    if (fmt) col.numFmt = fmt;
    if (c.wrap) col.alignment = { wrapText: true, vertical: 'top', horizontal: rtl ? 'right' : 'left' };
  });

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', horizontal: rtl ? 'right' : 'left', wrapText: true };
  headerRow.height = 22;

  if (boldRowIf) {
    rows.forEach((r, i) => {
      if (boldRowIf(r, i)) ws.getRow(i + 2).font = { bold: true };
    });
  }

  if (autoFilter && columns.length && rows.length) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  }

  return ws;
}

// Builds the workbook only — useful when a caller wants to add sheets in a
// custom order/loop before downloading (e.g. a report with a title block
// above the table). Most callers should use exportExcel() below instead.
export function buildWorkbook({ sheets, rtl = false, title }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'HiKids Admin';
  workbook.created = new Date();
  for (const sheet of sheets) addSheet(workbook, { rtl, ...sheet });
  if (title) workbook.title = title;
  return workbook;
}

export async function downloadWorkbook(workbook, fileName) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on a delay — some browsers cancel the download if the object URL
  // is revoked synchronously right after click().
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// The one function most callers need: build the workbook and hand it to the
// browser as a download, in one call.
export async function exportExcel({ sheets, fileName, rtl = false }) {
  const workbook = buildWorkbook({ sheets, rtl });
  await downloadWorkbook(workbook, fileName);
}
