import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, Tag, Flame, ThumbsUp, ArrowRight, Plus, Check, Heart } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import { useCart } from '@/context/CartContext';
import { useCartFly } from '@/context/CartFlyContext';
import { useWishlist } from '@/context/WishlistContext';
import { useLanguage } from '@/context/LanguageContext';
import { productName } from '@/lib/bilingual';

function badgeFor(p, t) {
  if (p.onSale) return { label: t('rec.onSale'), icon: Tag, cls: 'bg-accent text-white' };
  if (p.purchaseCount >= 3) return { label: t('rec.bestSeller'), icon: Flame, cls: 'bg-cosmic text-white' };
  if (p.avgRating >= 4.5 && p.reviewCount >= 2) return { label: t('rec.topRated'), icon: ThumbsUp, cls: 'bg-emerald-500 text-white' };
  return null;
}

export default function Recommendations() {
  const { addItem } = useCart();
  const { flyToCart } = useCartFly();
  const { toggle, isSaved } = useWishlist();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState({});
  const { t, formatPrice, lang } = useLanguage();

  useEffect(() => {
    Promise.all([
      base44.entities.Product.list('-updated_date', 50),
      base44.entities.Review.list(),
      base44.entities.Order.list(),
    ])
      .then(([products, reviews, orders]) => {
        const purchases = {};
        orders.forEach((o) =>
          (o.items || []).forEach((it) => {
            purchases[it.id] = (purchases[it.id] || 0) + (it.qty || 1);
          })
        );
        const ratingMap = {};
        reviews.forEach((r) => {
          const e = ratingMap[r.product_id] || { sum: 0, count: 0 };
          e.sum += r.rating || 0;
          e.count += 1;
          ratingMap[r.product_id] = e;
        });

        const scored = products.map((p) => {
          const onSale = p.sale_price != null && p.sale_price < p.price;
          const purchaseCount = purchases[p.id] || 0;
          const r = ratingMap[p.id];
          const avgRating = r ? r.sum / r.count : p.rating || 0;
          const reviewCount = r ? r.count : 0;
          const eligible = onSale || (purchaseCount >= 2 && avgRating >= 4) || (avgRating >= 4.5 && reviewCount >= 2);
          const score =
            (onSale ? 30 : 0) + purchaseCount * 6 + avgRating * 4 + reviewCount * 2 + (p.featured ? 3 : 0);
          return { ...p, onSale, purchaseCount, avgRating, reviewCount, eligible, score };
        });

        let recs = scored.filter((x) => x.eligible).sort((a, b) => b.score - a.score);
        if (recs.length < 4) {
          const have = new Set(recs.map((r) => r.id));
          const fill = scored.filter((x) => !have.has(x.id)).sort((a, b) => b.score - a.score);
          recs = [...recs, ...fill].slice(0, 4);
        } else {
          recs = recs.slice(0, 4);
        }
        setItems(recs);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const quickAdd = (p, originEl) => {
    flyToCart(originEl);
    addItem(p, 1);
    setAdded((a) => ({ ...a, [p.id]: true }));
    setTimeout(() => setAdded((a) => ({ ...a, [p.id]: false })), 1500);
  };

  return (
    <section className="max-w-7xl mx-auto px-5 sm:px-8 py-10 md:py-14">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">
            {t('rec.label')}
          </p>
          <h2 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl">
            {t('rec.title')}
          </h2>
          <p className="mt-3 text-muted-foreground max-w-lg">
            {t('rec.subtitle')}
          </p>
        </div>
        <Link to="/shop" className="text-cosmic font-heading font-bold hover:underline hidden sm:inline-flex items-center gap-1">
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
                {b && (
                  <span className={`absolute top-4 left-4 z-10 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-heading font-bold ${b.cls}`}>
                    <b.icon className="w-3.5 h-3.5" /> {b.label}
                  </span>
                )}
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
                  <p className="text-xs text-muted-foreground">{p.category}</p>
                  <Link to={`/product/${p.id}`} className="mt-1 font-display font-semibold text-xl leading-tight hover:text-cosmic line-clamp-2">
                    {productName(p, lang)}
                  </Link>
                  <div className="mt-2 flex items-center gap-1.5">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${i < Math.round(p.avgRating) ? 'fill-accent text-accent' : 'text-border'}`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {p.avgRating ? p.avgRating.toFixed(1) : t('rec.new')}
                      {p.reviewCount > 0 && ` (${p.reviewCount})`}
                    </span>
                  </div>
                  <div className="mt-auto pt-4 flex items-center justify-between gap-3">
                    <div className="flex items-baseline gap-2">
                      <span className="font-heading font-extrabold text-xl text-cosmic">
                        {formatPrice(p.onSale ? p.sale_price : p.price)}
                      </span>
                      {p.onSale && (
                        <span className="text-sm text-muted-foreground line-through">{formatPrice(p.price)}</span>
                      )}
                    </div>
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