// Product Management's config for the shared ExcelExportDialog — the
// reference implementation every other module's export config follows the
// same shape as. Keeping this glue in its own file (rather than inlining it
// in Admin.jsx) is what makes it trivial to point a second module at the
// same dialog: copy this file's shape, swap in that module's field
// registry.
import { db } from '@/api/entities';
import { fetchAllRows } from '@/lib/excelExportHelpers';
import { PRODUCT_EXPORT_FIELDS, PRODUCT_EXPORT_FIELDS_BY_KEY, PRODUCT_EXPORT_GROUPS, PRODUCT_EXPORT_PRESETS } from '@/lib/productExportFields';

export const PRODUCT_DEFAULT_EXPORT_FIELDS = ['product_code', 'name', 'barcode', 'category', 'price', 'stock'];

// Reads every selected field off one product into a flat row object, plus a
// few hidden (non-column) flags the workbook's conditional highlighting
// reads regardless of which columns were actually picked — see
// excelExport.js: ExcelJS only ever writes keys that appear in `columns`,
// so stashing extra properties here is safe and never becomes a stray cell.
export function buildProductExportRow(product, fieldKeys, ctx) {
  const row = {};
  for (const key of fieldKeys) {
    const field = PRODUCT_EXPORT_FIELDS_BY_KEY[key];
    if (field) row[key] = field.getValue(product, ctx);
  }
  const stock = PRODUCT_EXPORT_FIELDS_BY_KEY.stock.getValue(product, ctx);
  row._outOfStock = stock === 0;
  row._lowStock = stock > 0 && stock <= 5;
  row._discounted = product.sale_price != null && Number(product.sale_price) < Number(product.price);
  return row;
}

export function productExportCellHighlight(row, key) {
  if (key === 'stock' && row._outOfStock) return 'FDECEA';
  if (key === 'stock' && row._lowStock) return 'FFF4E5';
  if ((key === 'sale_price' || key === 'price') && row._discounted) return 'E8F5E9';
  return null;
}

export function productExportDialogProps({ products, filterFn, selectedIds, categoryNameById }) {
  return {
    dialogTitle: { ar: 'تصدير المنتجات إلى Excel', en: 'Export Products to Excel' },
    sheetName: { ar: 'المنتجات', en: 'Products' },
    reportSubtitle: { ar: 'تقرير المنتجات / Products Export', en: 'تقرير المنتجات / Products Export' },
    countLabel: { ar: 'عدد الأصناف', en: 'Products' },
    fileNamePrefix: 'Products',
    fields: PRODUCT_EXPORT_FIELDS,
    groups: PRODUCT_EXPORT_GROUPS,
    presets: PRODUCT_EXPORT_PRESETS,
    defaultFieldKeys: PRODUCT_DEFAULT_EXPORT_FIELDS,
    records: products,
    filterFn,
    selectedIds,
    buildRow: buildProductExportRow,
    cellHighlight: productExportCellHighlight,
    fetchAll: () => fetchAllRows(db.Product, '-updated_date'),
    fieldCtx: { categoryNameById },
  };
}
