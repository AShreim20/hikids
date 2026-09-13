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

// Centralized "is this product on sale right now" check — the ONE place
// this decision is made, reused everywhere a discount badge, filter, or
// sale price display is needed (product cards, PLP, product detail,
// wishlist, similar/related products, homepage deals). Never duplicate
// this boolean elsewhere; a product's discount schema (price/sale_price,
// plus a category's discount_active/discount_percent) has no start/end
// date fields today, so there is no date-range check to perform — if such
// fields are ever added, this is the only function that needs to change.
export function isProductOnSale(product, catPct = 0) {
  return priceInfo(product, catPct).hasDiscount;
}

// Whole-number discount percentage, derived the same way priceInfo already
// computes it — never store/hardcode a percentage separately from price.
export function getDiscountPercentage(product, catPct = 0) {
  return priceInfo(product, catPct).discountPct;
}