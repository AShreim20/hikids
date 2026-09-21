import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { db } from '@/api/entities';
import { useLanguage } from '@/context/LanguageContext';
import { useCategories } from '@/context/CategoryContext';
import ProductCard from '@/components/ProductCard';
import { priceInfo } from '@/lib/pricing';
import { AGE_OPTIONS, ageRangeToIds } from '@/lib/ages';
import { GENDER_BOTH } from '@/lib/gender';
import { hasVariants, getVariants, isSellable } from '@/lib/variants';
import { isPublishedReview } from '@/lib/reviews';

// How many related products to show — two full rows on desktop
// (grid-cols-4), four rows on mobile (grid-cols-2). Comfortably inside the
// "4-8, don't overload" range.
const TARGET_COUNT = 8;

// Weighted similarity score. Weights are ordered so a single higher-priority
// signal always outranks any combination of lower ones — same category alone
// (50) already beats age+gender+tags+price combined (20+10+20+8=58 is the
// only way to exceed it, which only happens for a near-perfect match anyway).
// This is what makes the "gradual fallback" from the spec emerge for free out
// of one sort instead of needing separate discrete passes: with enough
// same-category candidates they fill the list on their own; cross-category
// tag/price matches only surface once those run out, and if nothing scores
// above zero the list still fills with other published products (level 5).
//
// Category itself is no longer binary now that a product can have a Primary
// Category plus zero or more Additional ones (see categoryScore below):
// same Primary is the strongest match, a Primary/Additional cross-match is
// next, and shared Additional Categories add on top of either — multiple
// overlapping categories genuinely score higher, they don't just flip a bit.
const SCORE_CATEGORY_PRIMARY = 50;
const SCORE_CATEGORY_CROSS = 35;
const SCORE_CATEGORY_SHARED_ADDITIONAL = 15;
const MAX_SHARED_ADDITIONAL_SCORE = 30;
const SCORE_AGE_FULL = 20;
const SCORE_AGE_ADJACENT = 10;
const SCORE_GENDER = 10;
const SCORE_PER_TAG = 4;
const MAX_TAG_SCORE = 20;
const SCORE_PRICE_MAX = 8;
const SCORE_RATING_MAX = 1;
// Out-of-stock is a penalty, not a hard filter/bucket: a highly relevant
// sold-out item can still outrank a barely-relevant in-stock one, but among
// comparably relevant candidates the in-stock one wins — matching "prefer
// in-stock" without "sacrificing relevance" for it.
const OUT_OF_STOCK_PENALTY = 15;

const AGE_INDEX = Object.fromEntries(AGE_OPTIONS.map((o, i) => [o.id, i]));

// Prefers the structured `ages` array (the actual current data model) and
// only falls back to parsing the legacy free-text `age_range` for older rows
// that predate it — never a raw string comparison.
function productAgeIds(p) {
  if (Array.isArray(p.ages) && p.ages.length) return p.ages;
  if (p.age_range) return ageRangeToIds(p.age_range);
  return [];
}

function ageScore(currentIds, candidateIds) {
  if (!currentIds.length || !candidateIds.length) return 0;
  // 'all' is the "suitable for every age" attribute (see lib/ages.js) — full
  // credit either direction rather than a literal id match.
  if (currentIds.includes('all') || candidateIds.includes('all')) return SCORE_AGE_FULL;
  let adjacent = false;
  for (const a of currentIds) {
    for (const b of candidateIds) {
      if (a === b) return SCORE_AGE_FULL;
      const ia = AGE_INDEX[a];
      const ib = AGE_INDEX[b];
      if (ia != null && ib != null && Math.abs(ia - ib) === 1) adjacent = true;
    }
  }
  return adjacent ? SCORE_AGE_ADJACENT : 0;
}

// Primary Category match is strongest; a Primary matching the *other*
// product's Additional Categories is next; shared Additional Categories add
// a smaller bonus on top of whichever of those applied (capped so a long
// tail of shared tags can't out-rank an actual category match). Falls back
// to the old plain-text `category` comparison only when NEITHER product has
// a primary_category_id yet — i.e. it hasn't been touched since the
// multi-category migration backfilled it, which the migration itself
// guarantees happens for every pre-existing product with a resolvable
// category name.
function categoryScore(current, candidate) {
  const curPrimary = current.primary_category_id || null;
  const candPrimary = candidate.primary_category_id || null;
  if (!curPrimary && !candPrimary) {
    return current.category && current.category === candidate.category ? SCORE_CATEGORY_PRIMARY : 0;
  }
  const curAdditional = Array.isArray(current.category_ids) ? current.category_ids : [];
  const candAdditional = Array.isArray(candidate.category_ids) ? candidate.category_ids : [];

  let score = 0;
  if (curPrimary && candPrimary && curPrimary === candPrimary) {
    score += SCORE_CATEGORY_PRIMARY;
  } else if ((curPrimary && candAdditional.includes(curPrimary)) || (candPrimary && curAdditional.includes(candPrimary))) {
    score += SCORE_CATEGORY_CROSS;
  }
  const sharedAdditional = curAdditional.filter((id) => candAdditional.includes(id)).length;
  if (sharedAdditional > 0) {
    score += Math.min(sharedAdditional * SCORE_CATEGORY_SHARED_ADDITIONAL, MAX_SHARED_ADDITIONAL_SCORE);
  }
  return score;
}

const normGender = (g) => (g === 'male' || g === 'female' || g === GENDER_BOTH ? g : null);

// Missing/unclassified gender is deliberately neutral (0), never a strong
// match *or* a penalty — an unclassified candidate isn't punished twice (it
// already loses out on ranking by simply not earning this point).
function genderScore(current, candidate) {
  if (!current || !candidate) return 0;
  if (current === GENDER_BOTH) return SCORE_GENDER; // unisex source: male/female/both all qualify
  return candidate === current || candidate === GENDER_BOTH ? SCORE_GENDER : 0;
}

function tagScore(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || !a.length || !b.length) return 0;
  const set = new Set(a);
  let shared = 0;
  b.forEach((x) => set.has(x) && shared++);
  return Math.min(shared, MAX_TAG_SCORE / SCORE_PER_TAG) * SCORE_PER_TAG;
}

// Secondary signal only — full credit at an identical price, tapering to
// zero once the two are ~75%+ apart, so it nudges the order without ever
// outweighing category/age/gender.
function priceScore(curPrice, candPrice) {
  if (!curPrice || !candPrice) return 0;
  const diff = Math.abs(curPrice - candPrice) / Math.max(curPrice, candPrice, 1);
  const closeness = Math.max(0, 1 - diff / 0.75);
  return closeness * SCORE_PRICE_MAX;
}

const effectivePrice = (p, discountPctFor) => {
  const pi = priceInfo(p, discountPctFor(p.category));
  return pi ? pi.final : Number(p.price) || 0;
};

const inStock = (p) => (hasVariants(p) ? getVariants(p).some(isSellable) : Number(p.stock || 0) > 0);

// Loose "same toy, different listing" key for the diversity pass — strips
// piece-count numbers and duplicate-suffix noise so two near-identical
// listings (e.g. an admin-duplicated copy) don't both take a slot ahead of a
// genuinely different product, without ever dropping below the target count
// to enforce it.
function nameKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\(copy\)|\(نسخة\)/g, '')
    .replace(/[0-9٠-٩]+/g, '')
    .replace(/[^\p{L}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// "You may also like" — ranks candidates by a weighted similarity score
// (category, age-range compatibility, gender compatibility, shared tags,
// price closeness) rather than picking randomly. The current product is
// always excluded, drafts are always excluded (defense-in-depth: RLS already
// hides drafts from non-admin reads, this also protects an admin's own view
// of a live product page from seeing a draft mixed into these results), and
// out-of-stock candidates are penalized rather than removed. Product cards
// reuse the shared ProductCard component (same one Shop.jsx uses) — same
// pricing/discount/out-of-stock/wishlist/add-to-cart behavior everywhere,
// and the same "cached list, not realtime" data policy documented in
// Shop.jsx (per-product live commercial data is reserved for the single
// active Product Detail page via useProductCommercial, not every card in a
// list — this section intentionally doesn't subscribe per card).
export default function SimilarProducts({ product, horizontal = false }) {
  const { t, lang } = useLanguage();
  const ar = lang === 'ar';
  const { discountPctFor } = useCategories();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ratingMap, setRatingMap] = useState({});

  // Same "fetch once, build a map" approach Recommendations.jsx uses on the
  // Homepage — one query for every card's rating instead of one per card,
  // and only approved/published reviews count (see lib/reviews.js) so a
  // product with zero real reviews shows "New" on its card, never a fake
  // rating derived from the legacy products.rating seed value.
  useEffect(() => {
    let alive = true;
    db.Review.list('-created_date', 500)
      .then((reviews) => {
        const map = {};
        (reviews || []).filter(isPublishedReview).forEach((r) => {
          const e = map[r.product_id] || { sum: 0, count: 0 };
          e.sum += r.rating || 0;
          e.count += 1;
          map[r.product_id] = e;
        });
        if (alive) setRatingMap(map);
      })
      .catch(() => alive && setRatingMap({}));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    db.Product.list('-updated_date', 100)
      .then((all) => {
        const currentAgeIds = productAgeIds(product);
        const currentGender = normGender(product.gender);
        const currentPrice = effectivePrice(product, discountPctFor);

        const pool = (all || []).filter((p) => p.id !== product.id && p.status !== 'draft' && p.name);

        const scored = pool.map((p) => {
          let score = 0;
          score += categoryScore(product, p);
          score += ageScore(currentAgeIds, productAgeIds(p));
          score += genderScore(currentGender, normGender(p.gender));
          score += tagScore(product.tags, p.tags);
          score += priceScore(currentPrice, effectivePrice(p, discountPctFor));
          if (p.rating) score += Math.min(SCORE_RATING_MAX, p.rating / 5);
          const available = inStock(p);
          if (!available) score -= OUT_OF_STOCK_PENALTY;
          return { p, score };
        });

        scored.sort((a, b) => b.score - a.score);

        // Diversity: prefer distinct products first; only reuse a
        // near-duplicate name to fill remaining slots if there simply
        // aren't enough distinct relevant candidates.
        const seen = new Set();
        const primary = [];
        const overflow = [];
        for (const s of scored) {
          const key = nameKey(s.p.name);
          if (!seen.has(key)) {
            seen.add(key);
            primary.push(s);
          } else {
            overflow.push(s);
          }
        }
        const finalList = [...primary, ...overflow].slice(0, TARGET_COUNT).map((s) => s.p);
        if (alive) setItems(finalList);
      })
      .catch(() => alive && setItems([]))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  if (!loading && items.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-5 sm:px-8 py-8 md:py-10">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6 md:mb-8">
        <div>
          <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">
            {ar ? 'قد يعجبك أيضًا' : 'You may also like'}
          </p>
          <h2 className="mt-2 font-heading font-extrabold text-3xl md:text-4xl">
            {ar ? 'منتجات مشابهة' : 'Similar products'}
          </h2>
        </div>
        <Link to="/shop" className={`text-cosmic font-heading font-bold hover:underline items-center gap-1 ${horizontal ? 'inline-flex' : 'hidden sm:inline-flex'}`}>
          {t('rec.browse')} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-6 lg:gap-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] rounded-[2rem] bg-mist animate-pulse" />
          ))}
        </div>
      ) : (
        <div className={horizontal ? 'flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none]' : 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-6 lg:gap-8'}>
          {items.map((p) => {
            const r = ratingMap[p.id];
            return (
              <div key={p.id} className={horizontal ? 'w-40 shrink-0' : 'contents'}>
              <ProductCard
                compact={horizontal}
                product={p}
                avgRating={r ? r.sum / r.count : 0}
                reviewCount={r ? r.count : 0}
              />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
