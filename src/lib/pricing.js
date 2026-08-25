// Pricing helpers — category discounts apply on top of the original price
// without overwriting it. Product-level sale_price takes priority over a
// category discount (no stacking), per the existing discount-priority logic.
// Unit cost is never touched.

export function priceInfo(product, catPct = 0) {
  const base = Number(product?.price) || 0;
  const sale = product?.sale_price != null ? Number(product.sale_price) : null;
  let original = base;
  let final = base;
  let discountPct = 0;
  let source = null;

  if (sale != null && sale < base) {
    final = sale;
    discountPct = base > 0 ? Math.round((1 - sale / base) * 100) : 0;
    source = 'sale';
  } else if (catPct > 0) {
    final = Math.round(base * (1 - catPct / 100) * 100) / 100;
    discountPct = catPct;
    source = 'category';
  }

  return { original, final, discountPct, hasDiscount: final < original, source };
}