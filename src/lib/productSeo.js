// Pure product-metadata builder — shared by two runtimes that cannot share a
// React context: ProductDetail.jsx (client, via useDocumentMeta) and
// middleware.js (Vercel Edge Middleware, serving crawlers that don't execute
// JS — Facebook/WhatsApp/Twitter/Slack/LinkedIn/Discord bots, plus Googlebot
// for guaranteed-correct dynamic rendering). Both call this exact function so
// a customer's browser and a crawler compute identical title/description/
// price/availability — no second SEO logic to drift out of sync.
//
// Deliberately has zero React/DOM imports (same discipline as pricing.js and
// bilingual.js, which this reuses rather than recalculating) so it can be
// imported directly into the edge runtime.
// Explicit .js extensions (not Vite/webpack-style extensionless imports) so
// this file resolves correctly under both the Vite build AND Node's strict
// native ESM loader — verified needed when testing middleware.js directly
// with `node` (Vercel's edge bundler may be more lenient, but explicit
// extensions work everywhere and cost nothing).
import { priceInfo } from './pricing.js';
import { productName, productDescription } from './bilingual.js';
import { hasVariants, getVariants, isSellable, variantPrice } from './variants.js';

const MAX_DESCRIPTION_LENGTH = 300;

// No selected variant exists for a crawler/first-load snapshot, so a variant
// product is represented by its lowest sellable price (falling back to the
// lowest listed price if nothing is currently sellable) and is "in stock" if
// any variant is sellable — the same isSellable() rule the storefront's own
// variant picker already uses, not a new stock rule.
function representativePriceAndStock(product, catDiscountPct) {
  if (hasVariants(product)) {
    const variants = getVariants(product);
    const sellable = variants.filter(isSellable);
    const pool = sellable.length ? sellable : variants;
    const prices = pool.map((v) => variantPrice(product, v)).filter((n) => Number.isFinite(n));
    const price = prices.length ? Math.min(...prices) : Number(product?.sale_price ?? product?.price) || 0;
    return { price, inStock: sellable.length > 0 };
  }
  const pi = priceInfo(product, catDiscountPct);
  return { price: pi.final, inStock: Number(product?.stock || 0) > 0 };
}

/**
 * @param {object} product - a full products row
 * @param {object} opts
 * @param {number} [opts.catDiscountPct] - the product's category discount %
 *   (categories.discount_percent where discount_active = true), the exact
 *   same input priceInfo() already takes elsewhere — pass 0 if unknown.
 * @param {string} opts.siteUrl - absolute origin, no trailing slash.
 * @param {'ar'|'en'} [opts.lang]
 */
export function buildProductSeo(product, { catDiscountPct = 0, siteUrl, lang = 'en' } = {}) {
  const name = productName(product, lang) || 'HiKids';
  // Collapsed to one line — real product descriptions contain embedded
  // newlines (multi-paragraph copy, bullet points), which are technically
  // legal inside an HTML attribute but render/parse inconsistently across
  // link-preview scrapers and validators; a single clean line is standard
  // practice for meta description/og:description/twitter:description.
  const rawDescription = (productDescription(product, lang) || '').replace(/\s+/g, ' ').trim();
  const description = rawDescription.length > MAX_DESCRIPTION_LENGTH
    ? `${rawDescription.slice(0, MAX_DESCRIPTION_LENGTH - 1).trimEnd()}…`
    : rawDescription;
  const canonical = `${siteUrl}/product/${product.id}`;
  // The product's actual stored image — a stable, publicly-accessible
  // Supabase Storage or legacy CDN URL, never a signed/blob/transformed one
  // (see the image-performance regression fix: Supabase URLs are already
  // plain, permanent originals).
  const image = product.image_url || null;
  // RLS already hides drafts from anonymous reads (including this fetch, in
  // both the client and the edge middleware), so `product` reaching this
  // function is published in practice — this check is defense in depth, not
  // the actual gate.
  const isPublished = product.status ? product.status === 'published' : true;
  const { price, inStock } = representativePriceAndStock(product, catDiscountPct);
  const availability = isPublished && inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    ...(image ? { image: [image] } : {}),
    ...(description ? { description } : {}),
    offers: {
      '@type': 'Offer',
      url: canonical,
      priceCurrency: 'ILS',
      price: price.toFixed(2),
      availability,
    },
  };

  return {
    title: `${name} | HiKids`,
    description,
    canonical,
    image,
    price,
    availability,
    jsonLd,
  };
}
