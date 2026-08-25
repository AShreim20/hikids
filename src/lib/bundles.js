// Product Bundle helpers. Bundles reference existing products by id — they
// never duplicate product records and never change individual product prices.
// Inventory availability is derived from the component products' stock.

export const bundleItemPrice = (it) => Number(it?.unit_price) || 0;
export const bundleItemQty = (it) => Math.max(1, Math.floor(Number(it?.quantity) || 0));

// Combined original price (sum of each component's unit price × quantity).
export const bundleOriginalPrice = (bundle) =>
  (bundle?.items || []).reduce((s, it) => s + bundleItemPrice(it) * bundleItemQty(it), 0);

// Bundle selling price: stored bundle_price wins; otherwise derived from a
// stored discount percentage applied to the original combined price.
export const bundleSellingPrice = (bundle) => {
  const bp = Number(bundle?.bundle_price);
  if (bp != null && bp > 0) return bp;
  const orig = bundleOriginalPrice(bundle);
  const pct = Math.max(0, Math.min(100, Number(bundle?.discount_percent) || 0));
  return Math.round(orig * (1 - pct / 100) * 100) / 100;
};

// Discount percentage implied by the stored bundle price vs the combined price.
export const bundleDiscountPercent = (bundle) => {
  const orig = bundleOriginalPrice(bundle);
  const sell = bundleSellingPrice(bundle);
  if (orig <= 0 || sell >= orig) return 0;
  return Math.round((1 - sell / orig) * 100);
};

export const bundleSavings = (bundle) =>
  Math.max(0, bundleOriginalPrice(bundle) - bundleSellingPrice(bundle));

// How many complete bundles can be assembled from component stock right now.
// `products` is the live product list (or a map id->product). Returns 0 when
// any component is missing or out of stock.
export const bundleAvailability = (bundle, products) => {
  const lookup = (id) =>
    products && !Array.isArray(products) ? products[id] : (Array.isArray(products) ? products.find((p) => p.id === id) : null);
  let avail = Infinity;
  for (const it of bundle?.items || []) {
    const p = lookup(it.product_id);
    const stock = Math.max(0, Math.floor(Number(p?.stock) || 0));
    avail = Math.min(avail, Math.floor(stock / bundleItemQty(it)));
  }
  return avail === Infinity ? 0 : avail;
};

const inDateWindow = (bundle, now = new Date()) => {
  const start = bundle?.start_date ? new Date(bundle.start_date) : null;
  const end = bundle?.end_date ? new Date(bundle.end_date) : null;
  if (start && now < start) return false;
  // end_date is inclusive of the whole day.
  if (end) {
    const endOfDay = new Date(end);
    endOfDay.setHours(23, 59, 59, 999);
    if (now > endOfDay) return false;
  }
  return true;
};

export const isBundleActive = (bundle, now = new Date()) =>
  !!bundle?.active && inDateWindow(bundle, now);

// Snapshot of the bundle's components for an order line — keeps the link to
// the underlying products so inventory can be deducted on completion and the
// receipt can list what was inside the package.
export const bundleOrderItems = (bundle) =>
  (bundle?.items || []).map((it) => ({
    product_id: it.product_id,
    name: it.name,
    sku: it.sku || null,
    quantity: bundleItemQty(it),
    unit_price: bundleItemPrice(it),
  }));