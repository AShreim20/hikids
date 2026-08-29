import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { db } from '@/api/entities';
import { Image } from '@/components/ui/image';
import { useLanguage } from '@/context/LanguageContext';
import { useCategories } from '@/context/CategoryContext';
import { useSiteContent } from '@/context/SiteContentContext';
import { categoryName, categoryDescription } from '@/lib/bilingual';

// "World of Play" homepage section — driven entirely by the live Categories
// database. Admin can pick up to 6 categories (stored in SiteContent key
// "world_of_play"); when none are picked, the 6 categories with the most
// products are shown automatically.
export default function WorldOfPlay() {
  const { t, lang } = useLanguage();
  const { categories } = useCategories();
  const { content } = useSiteContent();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.Product.list('-updated_date', 200)
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const selection = useMemo(
    () => content('world_of_play', { category_ids: [] }).category_ids || [],
    [content]
  );

  const counts = useMemo(() => {
    const m = {};
    for (const p of products) m[p.category] = (m[p.category] || 0) + 1;
    return m;
  }, [products]);

  const picks = useMemo(() => {
    if (selection.length) {
      const chosen = selection
        .map((id) => categories.find((c) => c.id === id))
        .filter(Boolean)
        .slice(0, 6);
      if (chosen.length) return chosen;
    }
    return [...categories]
      .sort((a, b) => (counts[b.name] || 0) - (counts[a.name] || 0) || (a.sort_order || 0) - (b.sort_order || 0))
      .slice(0, 6);
  }, [categories, selection, counts]);

  const imageFor = (c) => c.image_url || products.find((p) => p.category === c.name)?.image_url;

  return (
    <section id="categories" className="max-w-7xl mx-auto px-5 sm:px-8 py-12 md:py-16">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">{t('cats.curateBy')}</p>
          <h2 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl">{t('cats.title')}</h2>
        </div>
        <p className="text-muted-foreground max-w-sm">{t('cats.subtitle')}</p>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
      ) : picks.length === 0 ? (
        <div className="rounded-3xl bg-mist/60 p-12 text-center">
          <p className="font-heading font-bold text-xl">{lang === 'ar' ? 'لا توجد فئات بعد' : 'No categories yet'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5 md:gap-6">
          {picks.map((c, i) => {
            const img = imageFor(c);
            const name = categoryName(c, lang);
            return (
              <Link
                key={c.id}
                to={`/shop?category=${encodeURIComponent(c.name)}`}
                className="group relative overflow-hidden rounded-3xl bg-mist aspect-[4/3] sm:aspect-[5/3] flex flex-col justify-end squish float-in"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                {img ? (
                  <Image
                    src={img}
                    alt={name}
                    fittingType="fill"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.08]"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-cosmic/20" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="relative p-4 sm:p-6 md:p-8 text-white">
                  <h3 className="font-heading font-bold text-base sm:text-xl md:text-2xl leading-tight">{name}</h3>
                  {(() => { const d = categoryDescription(c, lang); return d ? <p className="text-xs sm:text-sm text-white/80 mt-1 line-clamp-2">{d}</p> : null; })()}
                  <ArrowRight className="w-5 h-5 mt-2 sm:mt-3 text-white opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}