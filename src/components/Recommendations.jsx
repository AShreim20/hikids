import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Star, Flame, ThumbsUp, ArrowRight, Plus, Check, Heart } from 'lucide-react';
import { db } from '@/api/entities';
import { Image } from '@/components/ui/image';
import { useCart } from '@/context/CartContext';
import { useCartFly } from '@/context/CartFlyContext';
import { useWishlist } from '@/context/WishlistContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCategories } from '@/context/CategoryContext';
import { productName, categoryName } from '@/lib/bilingual';
import { queryKeys } from '@/lib/queryKeys';
import { isPublishedReview } from '@/lib/reviews';
import { priceInfo } from '@/lib/pricing';
import SaleBadge from '@/components/SaleBadge';
import DiscountPriceDisplay from '@/components/DiscountPriceDisplay';

// onSale is excluded here — it now renders the shared SaleBadge (with its
// "-20%" percentage) instead of a generic tag, so it isn't just one more
// entry in this same-shaped badge list.
function badgeFor(p, t) {
  if (p.purchaseCount >= 3) return { label: t('rec.bestSeller'), icon: Flame, cls: 'bg-cosmic text-white' };
  if (p.avgRating >= 4.5 && p.reviewCount >= 2) return { label: t('rec.topRated'), icon: ThumbsUp, cls: 'bg-emerald-500 text-white' };
  return null;
}

export default function Recommendations({ limit = 4, alwaysShowBrowse = false }) {
  const { addItem } = useCart();
  const { flyToCart } = useCartFly();
  const { toggle, isSaved } = useWishlist();
  const { byName, discountPctFor } = useCategories();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState({});
  const { t, lang } = useLanguage();

  // p.category is the legacy denormalized *name* (Arabic, since Arabic is
  // mandatory) — resolve it through the real category record so English UI
  // shows the English name instead of a raw Arabic string leaking through.
  // Falls back to the stored string itself for an orphaned/legacy label.
  const categoryLabel = (p) => {
    const cat = byName(p.category);
    return cat ? categoryName(cat, lang) : p.category;
  };

  // Recommendations and SaleBanner both build off "the recent catalog" —
  // sharing this query key means React Query fetches it once and caches it
  // for both (and for a repeat Home visit within the cache window), instead
  // of two components independently firing the same request.
  const { data: recentProducts, isSuccess: productsLoaded } = useQuery({
    queryKey: queryKeys.recentProducts(50),
    queryFn: () => db.Product.list('-updated_date', 50),
  });

  useEffect(() => {
    if (!productsLoaded) return;
    // allSettled: one failing list shouldn't blank out the rest.
    Promise.allSettled([
      db.Review.list(),
      db.Order.list(),
    ])
      .then(([reviews, orders]) => {
        const products = recentProducts || [];
        reviews = reviews.status === 'fulfilled' ? reviews.value : [];
        orders = orders.status === 'fulfilled' ? orders.value : [];
        const purchases = {};
        orders.forEach((o) =>
          (o.items || []).forEach((it) => {
            purchases[it.id] = (purchases[it.id] || 0) + (it.qty || 1);
          })
        );
        // Only approved/published reviews count toward the rating shown on
        // the card — a text review always counts, a photo review only once
        // an admin approves it (same rule Reviews.jsx uses on the product
        // page). A product with zero published reviews must never fall back
        // to the legacy `products.rating` seed value — that field is not a
        // real customer rating and showing it here would be a fake rating.
        const ratingMap = {};
        reviews.filter(isPublishedReview).forEach((r) => {
          const e = ratingMap[r.product_id] || { sum: 0, count: 0 };
          e.sum += r.rating || 0;
          e.count += 1;
          ratingMap[r.product_id] = e;
        });

        const scored = products.map((p) => {
          // Named priceData, deliberately not `price` — p.price is the raw
          // DB column addItem()/the cart read directly; overwriting it with
          // this computed object would silently break cart pricing.
          const priceData = priceInfo(p, discountPctFor(p.category));
          const onSale = priceData.hasDiscount;
          const purchaseCount = purchases[p.id] || 0;
          const r = ratingMap[p.id];
          const avgRating = r ? r.sum / r.count : 0;
          const reviewCount = r ? r.count : 0;
          const eligible = onSale || (purchaseCount >= 2 && avgRating >= 4) || (avgRating >= 4.5 && reviewCount >= 2);
          const score =
            (onSale ? 30 : 0) + purchaseCount * 6 + avgRating * 4 + reviewCount * 2 + (p.featured ? 3 : 0);
          return { ...p, onSale, priceData, purchaseCount, avgRating, reviewCount, eligible, score };
        });

        let recs = scored.filter((x) => x.eligible).sort((a, b) => b.score - a.score);
        if (recs.length < limit) {
          const have = new Set(recs.map((r) => r.id));
          const fill = scored.filter((x) => !have.has(x.id)).sort((a, b) => b.score - a.score);
          recs = [...recs, ...fill].slice(0, limit);
        } else {
          recs = recs.slice(0, limit);
        }
        setItems(recs);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [productsLoaded, recentProducts, limit]);

  const quickAdd = (p, originEl) => {
    flyToCart(originEl);
    addItem(p, 1);
    setAdded((a) => ({ ...a, [p.id]: true }));
    setTimeout(() => setAdded((a) => ({ ...a, [p.id]: false })), 1500);
  };

  return (
    <section className="max-w-7xl mx-auto px-5 sm:px-8 py-8 md:py-10">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6 md:mb-8">
        <div>
          <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">
            {t('rec.label')}
          </p>
          <h2 className="mt-1.5 font-heading font-extrabold text-3xl md:text-4xl">
            {t('rec.title')}
          </h2>
          <p className="mt-2 text-muted-foreground max-w-lg text-sm md:text-base">
            {t('rec.subtitle')}
          </p>
        </div>
        <Link to="/shop" className={`text-cosmic font-heading font-bold hover:underline items-center gap-1 ${alwaysShowBrowse ? 'inline-flex' : 'hidden sm:inline-flex'}`}>
          {t('rec.browse')} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] rounded-[2rem] bg-mist animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {items.map((p) => {
            const b = badgeFor(p, t);
            return (
              <div
                key={p.id}
                className="group relative rounded-[2rem] bg-card border border-border/60 overflow-hidden flex flex-col transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_30px_70px_-28px_rgba(26,26,30,0.35)]"
              >
                {/* Sale badge takes priority over the bestseller/top-rated
                    tag — both would compete for the same corner otherwise —
                    and always renders the shared component so its design
                    and "-X%"/fallback text can never drift from any other
                    card on the site. */}
                {p.onSale ? (
                  <SaleBadge percentage={p.priceData.discountPct} className="absolute top-4 left-4 z-10" />
                ) : b ? (
                  <span className={`absolute top-4 left-4 z-10 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-heading font-bold ${b.cls}`}>
                    <b.icon className="w-3.5 h-3.5" /> {b.label}
                  </span>
                ) : null}
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(p); }}
                  className={`absolute top-4 right-4 z-10 squish grid place-items-center w-10 h-10 rounded-full backdrop-blur-md transition-all duration-300 ${isSaved(p.id) ? 'bg-accent text-white' : 'bg-card/85 text-foreground hover:bg-card'}`}
                  aria-label="Toggle wishlist"
                >
                  <Heart className={`w-5 h-5 ${isSaved(p.id) ? 'fill-current' : ''}`} />
                </button>
                <Link to={`/product/${p.id}`} className="relative aspect-square overflow-hidden bg-mist">
                  <Image src={p.image_url} alt={productName(p, lang)} fittingType="fill" className="w-full h-full transition-transform duration-700 group-hover:scale-105" />
                </Link>
                <div className="p-5 flex flex-col flex-1">
                  <p className="text-xs text-muted-foreground">{categoryLabel(p)}</p>
                  <Link to={`/product/${p.id}`} className="mt-1 font-display font-semibold text-xl leading-tight hover:text-cosmic line-clamp-2">
                    {productName(p, lang)}
                  </Link>
                  <div className="mt-2 flex items-center gap-1.5">
                    {p.reviewCount > 0 ? (
                      <>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${i < Math.round(p.avgRating) ? 'fill-accent text-accent' : 'text-border'}`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {p.avgRating.toFixed(1)} ({p.reviewCount})
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t('rec.new')}</span>
                    )}
                  </div>
                  <div className="mt-auto pt-4 flex items-center justify-between gap-3">
                    <DiscountPriceDisplay
                      original={p.priceData.original}
                      final={p.priceData.final}
                      hasDiscount={p.priceData.hasDiscount}
                      discountPct={p.priceData.discountPct}
                    />
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); quickAdd(p, e.currentTarget); }}
                      className="squish grid place-items-center w-10 h-10 rounded-full bg-cosmic text-white hover:bg-primary transition-colors"
                      aria-label={t('common.addToCart')}
                    >
                      {added[p.id] ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}