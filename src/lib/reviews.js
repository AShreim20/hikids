// Shared review-approval rule. A photo review is only public once an admin
// approves it (see components/Reviews.jsx's own copy of this exact rule for
// the Product Detail review list); a text-only review has no approval step
// and always counts. Anything that decides "does this product actually have
// reviews" — a rating summary on a product card, a future consolidation of
// that logic — should filter through this first rather than trusting a raw
// review count or a legacy `products.rating` seed value.
export const isPublishedReview = (r) => !r.photo_url || r.status === 'approved';

// Aggregates a product's *published* reviews only. Returns count: 0,
// average: 0 for a product with no published reviews — callers should treat
// that as "no reviews yet", never as a real 0-star rating.
export function reviewStats(reviews) {
  const published = (reviews || []).filter(isPublishedReview);
  const count = published.length;
  const average = count ? published.reduce((sum, r) => sum + (r.rating || 0), 0) / count : 0;
  return { count, average };
}
