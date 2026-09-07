import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { db } from '@/api/entities';
import { useLanguage } from '@/context/LanguageContext';
import { useCategories } from '@/context/CategoryContext';
import { useSiteContent } from '@/context/SiteContentContext';
import CategoryCard from '@/components/home/CategoryCard';

// "World of Play" homepage section — driven entirely by the live Categories
// database. Admin can pick up to 6 categories (stored in SiteContent key
// "world_of_play"); when none are picked, the 6 categories with the most
// products are shown automatically. Only active categories are ever eligible
// for either path.
export default function WorldOfPlay() {
  const { t, lang } = useLanguage();
  const ar = lang === 'ar';
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

  const activeCategories = useMemo(
    () => categories.filter((c) => c.active !== false),
    [categories]
  );

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
        .map((id) => activeCategories.find((c) => c.id === id))
        .filter(Boolean)
        .slice(0, 6);
      if (chosen.length) return chosen;
    }
    return [...activeCategories]
      .sort((a, b) => (counts[b.name] || 0) - (counts[a.name] || 0) || (a.sort_order || 0) - (b.sort_order || 0))
      .slice(0, 6);
  }, [activeCategories, selection, counts]);

  // Nothing eligible to show — hide the whole section rather than a giant
  // empty box (there is nothing here to discover).
  if (!loading && picks.length === 0) return null;

  return (
    <section
      id="categories"
      className="scroll-mt-[112px] md:scroll-mt-[136px] max-w-7xl mx-auto px-5 sm:px-8 py-8 md:py-10"
    >
      <div className="mb-6 md:mb-8 max-w-2xl">
        <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">{t('cats.curateBy')}</p>
        <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
          <h2 className="font-heading font-extrabold text-3xl md:text-4xl">{t('cats.title')}</h2>
          {ar && <span className="text-sm md:text-base text-muted-foreground font-medium">{t('cats.titleTag')}</span>}
        </div>
        <p className="mt-2 text-sm md:text-base text-muted-foreground">{t('cats.subtitle')}</p>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5 lg:gap-6">
          {picks.map((c, i) => (
            <CategoryCard key={c.id} category={c} lang={lang} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}
