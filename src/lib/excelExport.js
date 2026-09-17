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
//     'text' is explicit: the cell gets a real Excel Text format (numFmt
//     '@') on top of the JS-string value ExcelJS already stores as a string
//     by default — belt-and-suspenders so a numeric-looking value (a
//     barcode) can never be reinterpreted as a number by Excel, in any
//     locale, regardless of how the value happened to be typed upstream.
//   - wrap: wrap long text instead of letting it overflow into neighboring
//     cells (used for reasons/notes/descriptions/multi-value lists).
//
// Sheet shape adds a few OPTIONAL, backward-compatible extras a caller can
// opt into for a more polished report (every existing caller that omits
// them renders byte-for-byte as before):
//   - reportHeader: { title, subtitle, meta } — a compact 2-3 row title
//     block above the table (brand title, report name, count/date line).
//   - headerStyle: { fill, fontColor } — column header row background/text
//     color (hex, no '#'). Omit for the old plain bold-on-white header.
//   - zebra: true — very light alternating row shading.
//   - cellHighlight(row, key) => hex color | falsy — per-cell conditional
//     fill (e.g. a red tint on an out-of-stock row's Stock cell). Extra,
//     non-column properties on `row` (like `_outOfStock`) are safe to read
//     here — ExcelJS only ever writes the keys that appear in `columns`.
//   - print: { orientation: 'landscape'|'portrait', repeatHeaderRows: true }
const CURRENCY_FMT = '#,##0.00 "₪"';
const INT_FMT = '#,##0';
const NUMBER_FMT = '#,##0.00';
const DATE_FMT = 'yyyy-mm-dd';
const TEXT_FMT = '@';

function numFmtFor(type) {
  if (type === 'currency') return CURRENCY_FMT;
  if (type === 'int') return INT_FMT;
  if (type === 'number') return NUMBER_FMT;
  if (type === 'date') return DATE_FMT;
  if (type === 'text') return TEXT_FMT;
  return undefined;
}

function addReportHeader(ws, { title, subtitle, meta }, columnCount, rtl) {
  let rowsUsed = 0;
  const align = { vertical: 'middle', horizontal: rtl ? 'right' : 'left' };
  const addLine = (text, font) => {
    rowsUsed += 1;
    const row = ws.getRow(rowsUsed);
    row.getCell(1).value = text;
    row.getCell(1).font = font;
    row.getCell(1).alignment = align;
    if (columnCount > 1) ws.mergeCells(rowsUsed, 1, rowsUsed, columnCount);
    return row;
  };
  if (title) {
    const row = addLine(title, { bold: true, size: 16, color: { argb: 'FF3D2560' } });
    row.height = 24;
  }
  if (subtitle) addLine(subtitle, { bold: true, size: 11, color: { argb: 'FF5D3F85' } });
  if (meta && meta.length) addLine(meta.join('   |   '), { italic: true, size: 9, color: { argb: 'FF6B6B6B' } });
  return rowsUsed;
}

// One sheet: { name, columns, rows, rtl, freezeHeader, autoFilter, boldRowIf, ...see header comment above }
function addSheet(workbook, sheet) {
  const {
    name, columns, rows = [], rtl = false,
    freezeHeader = true, autoFilter = true, boldRowIf,
    reportHeader, headerStyle, zebra = false, cellHighlight, print,
  } = sheet;
  // Sheet names can't exceed 31 chars and can't contain : \ / ? * [ ].
  const safeName = String(name || 'Sheet').replace(/[:\\/?*[\]]/g, ' ').slice(0, 31);
  const ws = workbook.addWorksheet(safeName, {
    views: [{ rightToLeft: rtl }],
  });

  const titleRows = reportHeader ? addReportHeader(ws, reportHeader, columns.length, rtl) : 0;
  const headerRowNum = titleRows + 1;

  // ws.columns (which also drives ws.addRow(obj) key-mapping) always starts
  // at row 1 — when a title block is present we build the table manually
  // instead, so the title rows above it are left untouched.
  columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = c.width || Math.max(12, Math.min(40, (c.header || '').length + 4));
    const fmt = numFmtFor(c.type);
    if (fmt) col.numFmt = fmt;
    if (c.wrap) col.alignment = { wrapText: true, vertical: 'top', horizontal: rtl ? 'right' : 'left' };
  });

  const headerRow = ws.getRow(headerRowNum);
  columns.forEach((c, i) => {
    headerRow.getCell(i + 1).value = c.header;
  });
  headerRow.font = { bold: true, color: { argb: headerStyle ? 'FFFFFFFF' : undefined } };
  headerRow.alignment = { vertical: 'middle', horizontal: rtl ? 'right' : 'left', wrapText: true };
  headerRow.height = 22;
  if (headerStyle) {
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${headerStyle.fill}` } };
      cell.font = { bold: true, color: { argb: `FF${headerStyle.fontColor || 'FFFFFF'}` } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9D2E9' } },
        bottom: { style: 'thin', color: { argb: 'FFD9D2E9' } },
      };
    });
  }

  rows.forEach((r, i) => {
    const row = ws.getRow(headerRowNum + 1 + i);
    columns.forEach((c, colIdx) => {
      row.getCell(colIdx + 1).value = r[c.key] ?? null;
    });
    if (zebra && i % 2 === 1) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F5FA' } };
      });
    }
    if (cellHighlight) {
      columns.forEach((c, colIdx) => {
        const color = cellHighlight(r, c.key);
        if (color) row.getCell(colIdx + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${color}` } };
      });
    }
    row.commit && row.commit();
  });

  if (boldRowIf) {
    rows.forEach((r, i) => {
      if (boldRowIf(r, i)) ws.getRow(headerRowNum + 1 + i).font = { bold: true };
    });
  }

  if (freezeHeader) {
    ws.views = [{ rightToLeft: rtl, state: 'frozen', ySplit: headerRowNum }];
  }

  if (autoFilter && columns.length && rows.length) {
    ws.autoFilter = {
      from: { row: headerRowNum, column: 1 },
      to: { row: headerRowNum, column: columns.length },
    };
  }

  if (print) {
    ws.pageSetup = {
      ...ws.pageSetup,
      orientation: print.orientation || (columns.length > 8 ? 'landscape' : 'portrait'),
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    };
    if (print.repeatHeaderRows) ws.pageSetup.printTitlesRow = `1:${headerRowNum}`;
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
