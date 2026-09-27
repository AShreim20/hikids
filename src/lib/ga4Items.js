// ONE centralized GA4 ecommerce item shape, so view_item_list/select_item/
// view_item/add_to_cart/remove_from_cart/view_cart/begin_checkout/
// add_shipping_info/add_payment_info/purchase never each build a slightly
// different item object. Two small entry points because a product ROW
// (Shop.jsx, ProductDetail.jsx — no quantity, no cart context yet) and a
// CART LINE (CartContext, Checkout.jsx — already has quantity/variant/the
// actual transaction price) are genuinely different shapes; both funnel
// into the same field names below.
import { pickName } from './bilingual';

// item_id prefers Product Code (HiKids' own stable business identifier —
// see CLAUDE.md) over the mutable display name, falling back to the row's
// id for a bundle (which has no product_code) or a legacy row without one.
const idFor = (row) => row?.product_code || row?.bundle_id || row?.id || '';

// A product row — from a listing (Shop.jsx) or the product page itself.
export function productToGAItem(p, lang, extra = {}) {
  if (!p) return null;
  const base = Number(p.price) || 0;
  const sale = p.sale_price != null ? Number(p.sale_price) : null;
  const onSale = sale != null && sale < base;
  const item = {
    item_id: idFor(p),
    item_name: pickName(p.name, p.name_en, lang),
    price: onSale ? sale : base,
    ...(p.category ? { item_category: p.category } : {}),
    ...extra,
  };
  if (onSale) item.discount = Math.round((base - sale) * 100) / 100;
  return item;
}

// A cart/order line — already has the actual per-unit transaction price and
// quantity baked in (sale price, wheel-reward 0, etc. — see CartContext.jsx),
// so this never recomputes a price independently.
export function cartLineToGAItem(line, lang, extra = {}) {
  if (!line) return null;
  return {
    item_id: idFor(line),
    item_name: pickName(line.name, line.name_en, lang),
    price: Number(line.price) || 0,
    quantity: Math.max(1, Number(line.qty) || 1),
    ...(line.variant_label ? { item_variant: line.variant_label } : {}),
    ...(line.is_bundle ? { item_category: 'Bundle' } : {}),
    ...extra,
  };
}

export const cartLinesToGAItems = (lines, lang) => (lines || []).map((l) => cartLineToGAItem(l, lang)).filter(Boolean);
export const productsToGAItems = (products, lang) => (products || []).map((p) => productToGAItem(p, lang)).filter(Boolean);
