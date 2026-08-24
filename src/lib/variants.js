// Helpers for the multi-attribute product variant system.
// Product shape additions:
//   options:  [{ name: 'Color', values: [{ value: 'Red', images: ['url', ...] }] }]
//   variants: [{ key, attributes: { Color: 'Red', Size: 'S' }, price, compare_price,
//                stock, sku, barcode, weight, active }]

export const KEY_SEP = ' / ';

export const getOptions = (product) =>
  Array.isArray(product?.options) ? product.options.filter((o) => o?.name) : [];

export const getVariants = (product) =>
  Array.isArray(product?.variants) ? product.variants : [];

export const hasVariants = (product) =>
  getOptions(product).length > 0 && getVariants(product).length > 0;

export const variantKey = (options, attributes) =>
  options.map((o) => attributes?.[o.name] ?? '').join(KEY_SEP);

export const variantLabel = (attributes) =>
  Object.values(attributes || {}).filter(Boolean).join(KEY_SEP);

// All combinations of the option values (cartesian product).
export function combinations(options) {
  const clean = options.filter((o) => o?.name && (o.values || []).length > 0);
  return clean.reduce(
    (acc, opt) =>
      acc.flatMap((row) =>
        opt.values
          .filter((v) => v?.value)
          .map((v) => ({ ...row, [opt.name]: v.value }))
      ),
    [{}]
  );
}

// Generates the variant rows, keeping any already-configured values.
export function buildVariants(options, existing = []) {
  const byKey = new Map(existing.map((v) => [v.key, v]));
  return combinations(options).map((attributes) => {
    const key = variantKey(options, attributes);
    const prev = byKey.get(key);
    return {
      key,
      attributes,
      price: prev?.price ?? '',
      compare_price: prev?.compare_price ?? '',
      stock: prev?.stock ?? 0,
      sku: prev?.sku ?? '',
      barcode: prev?.barcode ?? '',
      weight: prev?.weight ?? '',
      active: prev?.active !== false,
    };
  });
}

export function findVariant(product, selection) {
  const options = getOptions(product);
  if (options.length === 0) return null;
  const key = variantKey(options, selection);
  return getVariants(product).find((v) => v.key === key) || null;
}

export const isSellable = (variant) =>
  !!variant && variant.active !== false && Number(variant.stock || 0) > 0;

// A value is selectable when at least one sellable variant matches it together
// with the other currently selected options.
export function isValueAvailable(product, optionName, value, selection) {
  const others = { ...selection, [optionName]: value };
  return getVariants(product).some(
    (v) =>
      isSellable(v) &&
      Object.entries(others).every(
        ([k, val]) => !val || v.attributes?.[k] === val
      )
  );
}

// First selectable combination, used as the default selection.
export function defaultSelection(product) {
  const options = getOptions(product);
  if (options.length === 0) return {};
  const first = getVariants(product).find(isSellable) || getVariants(product)[0];
  return first ? { ...first.attributes } : {};
}

const COLOR_NAMES = ['color', 'colour', 'لون', 'اللون'];

export const isColorOption = (name) =>
  COLOR_NAMES.includes(String(name || '').trim().toLowerCase());

const valueImages = (opt, selection) => {
  const chosen = (opt.values || []).find((v) => v.value === selection?.[opt.name]);
  return (chosen?.images || []).filter(Boolean);
};

// Images are driven by the Color attribute; other options only affect price,
// stock and availability. Falls back to any option that does carry images, then
// to the product's own gallery (empty result).
export function selectionImages(product, selection) {
  const options = getOptions(product);
  const color = options.find((o) => isColorOption(o.name));
  if (color) {
    const imgs = valueImages(color, selection);
    if (imgs.length > 0) return imgs;
    // A Color option exists but this value has no images — keep the shared gallery.
    if (options.some((o) => isColorOption(o.name) && (o.values || []).some((v) => (v.images || []).length > 0))) {
      return [];
    }
  }
  for (const opt of options) {
    const imgs = valueImages(opt, selection);
    if (imgs.length > 0) return imgs;
  }
  return [];
}

export const variantPrice = (product, variant) =>
  variant && variant.price !== '' && variant.price != null
    ? Number(variant.price)
    : Number(product?.sale_price ?? product?.price ?? 0);