// Low-level .xlsx reader for Product Import — the counterpart to
// excelExport.js. Deliberately dependency-light: this file only reads the
// workbook and locates the real table; productImportFields.js/
// ProductImportDialog.jsx own everything about what a cell MEANS.
import ExcelJS from 'exceljs';
import { buildHeaderLookup } from './productImportFields';

// A HiKids export has a compact title block (HiKids / report subtitle /
// count+date) above the real header row — so the header can never be
// assumed to be row 1. Scan the first several rows and pick whichever one
// has the most cells matching a known HiKids column label; a row containing
// the Product Code header specifically is treated as an even stronger
// signal, since every HiKids export always includes it.
function detectHeaderRow(worksheet, headerLookup) {
  const maxScan = Math.min(worksheet.rowCount, 15);
  let best = { rowNumber: 1, score: -1, hasProductCode: false };
  for (let r = 1; r <= maxScan; r++) {
    const row = worksheet.getRow(r);
    let score = 0;
    let hasProductCode = false;
    row.eachCell({ includeEmpty: false }, (cell) => {
      const text = String(cell.value ?? '').trim().toLowerCase();
      const key = headerLookup.get(text);
      if (key) {
        score += 1;
        if (key === 'product_code') hasProductCode = true;
      }
    });
    const better = hasProductCode && !best.hasProductCode
      ? true
      : hasProductCode === best.hasProductCode && score > best.score;
    if (better) best = { rowNumber: r, score, hasProductCode };
  }
  return best.rowNumber;
}

// Returns { columns: [{ colIndex, header, fieldKey }], rows: [{ rowNumber, cells: { fieldKey: rawValue } }] }
// `rawValue` is exactly what ExcelJS parsed for that cell — a real number
// for a numeric cell (regardless of its display numFmt), a real Date for a
// date cell, a string otherwise, or a `{formula,result}` object for a
// formula cell (productImportFields.js's parsers already handle that shape).
export async function parseProductWorkbook(file) {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('emptyWorkbook');

  const headerLookup = buildHeaderLookup();
  const headerRowNum = detectHeaderRow(worksheet, headerLookup);
  const headerRow = worksheet.getRow(headerRowNum);

  const columns = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colIndex) => {
    const text = String(cell.value ?? '').trim();
    if (!text) return;
    columns.push({ colIndex, header: text, fieldKey: headerLookup.get(text.toLowerCase()) || null });
  });
  if (!columns.length) throw new Error('noColumnsFound');

  const rows = [];
  for (let r = headerRowNum + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    if (row.actualCellCount === 0) continue;
    const cells = {};
    let hasAnyValue = false;
    for (const col of columns) {
      const v = row.getCell(col.colIndex).value;
      if (v != null && v !== '') hasAnyValue = true;
      cells[col.colIndex] = v;
    }
    if (!hasAnyValue) continue;
    rows.push({ rowNumber: r, cells });
  }

  return { columns, rows, headerRowNum, sheetName: worksheet.name };
}
