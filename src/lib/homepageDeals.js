import { priceInfo } from './pricing';

export const HOMEPAGE_DEALS_MAX = 6;
export const HOMEPAGE_DEALS_KEY = 'homepage_deals';
export const HOMEPAGE_DEALS_DEFAULT = { mode: 'auto', product_ids: [] };

// A product is eligible for the homepage Deals section when it's both
// publicly visible (published) and currently on sale, via the one
// centralized discount check (isProductOnSale/priceInfo) — never a second
// eligibility rule.
export function isEligibleForDeals(product, catPct) {
  return product?.status !== 'draft' && priceInfo(product, catPct).hasDiscount;
}

// Pure, testable resolver for "which up to 6 products does the homepage
// Deals section show right now" — used by HomepageDealsSection and safe to
// unit-test in isolation from any fetching/rendering concern.
//
// AUTO mode: the latest `HOMEPAGE_DEALS_MAX` eligible products, sorted by
// updated_date (the most reliable existing freshness timestamp — there is
// no dedicated "discount started at" column, per the brief's own
// instruction to reuse an existing field rather than add one).
//
// MANUAL mode: the admin's saved product_ids, in that exact order, skipping
// any that are no longer eligible (deleted, discount expired/removed,
// unpublished) rather than rendering a broken card — then, only if fewer
// than 6 remain, backfilling the empty slots AFTER the manual picks with
// the latest eligible auto picks, never duplicating a product already
// chosen manually.
export function resolveHomepageDeals({ products = [], discountPctFor = () => 0, config } = {}) {
  const eligible = products.filter((p) => isEligibleForDeals(p, discountPctFor(p.category)));
  const byRecency = [...eligible].sort(
    (a, b) => new Date(b.updated_date || 0) - new Date(a.updated_date || 0)
  );

  if (!config || config.mode !== 'manual') {
    return byRecency.slice(0, HOMEPAGE_DEALS_MAX);
  }

  const eligibleById = new Map(eligible.map((p) => [p.id, p]));
  const ids = Array.isArray(config.product_ids) ? config.product_ids : [];
  const picked = [];
  const seen = new Set();
  for (const id of ids) {
    const p = eligibleById.get(id);
    if (p && !seen.has(id)) {
      picked.push(p);
      seen.add(id);
    }
  }
  if (picked.length >= HOMEPAGE_DEALS_MAX) return picked.slice(0, HOMEPAGE_DEALS_MAX);

  const fallback = byRecency.filter((p) => !seen.has(p.id));
  return [...picked, ...fallback].slice(0, HOMEPAGE_DEALS_MAX);
}
