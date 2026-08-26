import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, Plus, Check, ArrowRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import { useCart } from '@/context/CartContext';
import { useCartFly } from '@/context/CartFlyContext';
import { useLanguage } from '@/context/LanguageContext';
import { priceInfo } from '@/lib/pricing';
import { productName } from '@/lib/bilingual';
import { useCategories } from '@/context/CategoryContext';

const overlap = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b)) return 0;
  const set = new Set(a);
  let n = 0;
  b.forEach((x) => set.has(x) && n++);
  return n;
};

// "You May Also Like" — recommends products related to the current one using
// category, age range, and tag overlap. The current product is excluded, and
// out-of-stock items are avoided when there are enough alternatives. Only real
// catalog products are ever shown.
export default function SimilarProducts({ product }) {
  const { t, lang, formatPrice } = useLanguage();
  const ar = lang === 'ar';
  const { addItem } = useCart();
  const { flyToCart } = useCartFly();
  const { discountPctFor } = useCategories();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState({});

  useEffect(() => {
    let alive = true;
    base44.entities.Product.list('-updated_date', 100)
      .then((all) => {
        const pool = (all || []).filter((p) => p.id !== product.id);
        const scored = pool.map((p) => {
          let score = 0;
          if (p.category && p.category === product.category) score += 6;
          if (p.age_range && p.age_range === product.age_range) score += 3;
          score += overlap(product.tags, p.tags) * 2;
          if (p.featured) score += 1;
          if (p.rating) score += Math.min(2, p.rating / 2.5);
          return { p, score, inStock: Number(p.stock || 0) > 0 };
        });
        const inStock = scored.filter((s) => s.inStock).sort((a, b) => b.score - a.score);
        const others = scored.filter((s) => !s.inStock).sort((a, b) => b.score - a.score);
        // Prefer in-stock, avoid unavailable products; only fall back to OOS to fill the grid.
        const ordered = [...inStock, ...others];
        if (alive) setItems(ordered.slice(0, 4).map((s) => s.p));
      })
      .catch(() => alive && setItems([]))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [product.id]);

  const quickAdd = (p, originEl) => {
    flyToCart(originEl);
    const pi = priceInfo(p, discountPctFor(p.category));
    addItem(p, 1, null, pi ? pi.final : p.price);
    setAdded((a) => ({ ...a, [p.id]: true }));
    setTimeout(() => setAdded((a) => ({ ...a, [p.id]: false })), 1500);
  };

  if (!loading && items.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-5 sm:px-8 py-10 md:py-14">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">
            {ar ? 'قد يعجبك أيضًا' : 'You may also like'}
          </p>
          <h2 className="mt-2 font-heading font-extrabold text-3xl md:text-4xl">
            {ar ? 'منتجات مشابهة' : 'Similar products'}
          </h2>
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
            const pi = priceInfo(p, discountPctFor(p.category));
            const out = Number(p.stock || 0) <= 0;
            return (
              <div
                key={p.id}
                className="group relative rounded-[2rem] bg-card border border-border/60 overflow-hidden flex flex-col transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_30px_70px_-28px_rgba(26,26,30,0.35)]"
              >
                <Link to={`/product/${p.id}`} className="relative aspect-square overflow-hidden bg-mist">
                  <Image src={p.image_url} alt={productName(p, lang)} fittingType="fill" className="w-full h-full transition-transform duration-700 group-hover:scale-105" />
                </Link>
                <div className="p-4 flex flex-col flex-1">
                  <p className="text-xs text-muted-foreground">{p.category}</p>
                  <Link to={`/product/${p.id}`} className="mt-1 font-display font-semibold text-lg leading-tight hover:text-cosmic line-clamp-2">
                    {productName(p, lang)}
                  </Link>
                  <div className="mt-1 flex items-center gap-1">
                    <Star className={`w-3.5 h-3.5 ${p.rating ? 'fill-accent text-accent' : 'text-border'}`} />
                    <span className="text-xs text-muted-foreground">{p.rating ? p.rating.toFixed(1) : t('rec.new')}</span>
                  </div>
                  <div className="mt-auto pt-3 flex items-center justify-between gap-3">
                    <div className="flex items-baseline gap-2">
                      <span className="font-heading font-extrabold text-lg text-cosmic">
                        {formatPrice(pi && pi.hasDiscount ? pi.final : p.price)}
                      </span>
                      {pi && pi.hasDiscount && (
                        <span className="text-xs text-muted-foreground line-through">{formatPrice(pi.original)}</span>
                      )}
                    </div>
                    <button
                      onClick={(e) => quickAdd(p, e.currentTarget)}
                      disabled={out}
                      className="squish grid place-items-center w-10 h-10 rounded-full bg-cosmic text-white hover:bg-primary transition-colors disabled:opacity-40"
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