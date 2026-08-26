import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PageHeader from '@/components/PageHeader';
import ProductCard from '@/components/ProductCard';
import BundleCard from '@/components/bundles/BundleCard';
import ProductFilters, {
  AGE_OPTIONS, ageRange, overlaps,
} from '@/components/shop/ProductFilters';
import { useLanguage } from '@/context/LanguageContext';
import { useCategories } from '@/context/CategoryContext';
import { priceInfo } from '@/lib/pricing';
import { isBundleActive } from '@/lib/bundles';

const SORTS = [
  { id: 'featured', label: 'plp.sortFeatured' },
  { id: 'priceLow', label: 'plp.sortPriceLow' },
  { id: 'priceHigh', label: 'plp.sortPriceHigh' },
  { id: 'newest', label: 'plp.sortNewest' },
];

export default function Shop() {
  const { t } = useLanguage();
  const { discountPctFor, categories } = useCategories();
  const effectivePrice = (p) => priceInfo(p, discountPctFor(p.category)).final;
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cats, setCats] = useState([]);
  const [ages, setAges] = useState([]);
  const [price, setPrice] = useState([0, 1000]);
  const [priceBounds, setPriceBounds] = useState([0, 1000]);
  const [sort, setSort] = useState('featured');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const search = (searchParams.get('search') || '').trim();

  useEffect(() => {
    base44.entities.Product.list('-updated_date', 100)
      .then((list) => {
        setProducts(list);
        if (list.length) {
          const prices = list.map(effectivePrice);
          const lo = Math.floor(Math.min(...prices));
          const hi = Math.ceil(Math.max(...prices));
          setPriceBounds([lo, hi]);
          setPrice([lo, hi]);
        }
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
    base44.entities.Bundle.list('-updated_date', 100)
      .then((list) => setBundles((list || []).filter(isBundleActive)))
      .catch(() => setBundles([]));
  }, []);

  // Preselect category/age from URL (deep links from homepage category cards).
  useEffect(() => {
    const c = searchParams.get('category');
    if (c && categories.some((cat) => cat.name === c)) setCats([c]);
    const a = searchParams.get('age');
    if (a && AGE_OPTIONS.some((g) => g.id === a)) setAges([a]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const usedCategoryNames = useMemo(() => products.map((p) => p.category).filter(Boolean), [products]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    const selectedAges = AGE_OPTIONS.filter((g) => ages.includes(g.id));
    const list = products.filter((p) => {
      const catOk = cats.length === 0 || cats.includes(p.category);
      const ep = effectivePrice(p);
      const priceOk = ep >= price[0] && ep <= price[1];
      const ageOk =
        selectedAges.length === 0 ||
        selectedAges.some((g) => overlaps(ageRange(p.age_range), { min: g.min, max: g.max }));
      const searchOk =
        !term ||
        (p.name && p.name.toLowerCase().includes(term)) ||
        (p.name_en && p.name_en.toLowerCase().includes(term)) ||
        (p.category && p.category.toLowerCase().includes(term)) ||
        (Array.isArray(p.tags) && p.tags.some((tg) => tg.toLowerCase().includes(term)));
      return catOk && priceOk && ageOk && searchOk;
    });
    return list.sort((a, b) => {
      if (sort === 'priceLow') return effectivePrice(a) - effectivePrice(b);
      if (sort === 'priceHigh') return effectivePrice(b) - effectivePrice(a);
      if (sort === 'newest') return new Date(b.created_date) - new Date(a.created_date);
      return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
    });
  }, [products, cats, ages, price, search, sort]);

  const hasActive =
    cats.length > 0 ||
    ages.length > 0 ||
    !!search ||
    price[0] !== priceBounds[0] ||
    price[1] !== priceBounds[1];

  const clearAll = () => {
    setCats([]);
    setAges([]);
    setPrice(priceBounds);
    if (search) setSearchParams({}, { replace: true });
  };

  const FiltersEl = (
    <ProductFilters
      cats={cats} setCats={setCats} ages={ages} setAges={setAges}
      priceBounds={priceBounds} price={price} setPrice={setPrice}
      onClear={clearAll} hasActive={hasActive}
      extraCategories={categories}
      usedCategoryNames={usedCategoryNames}
    />
  );

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={t('plp.title')} />
      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8 md:py-12">
        <div className="mb-6 hidden md:flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading font-extrabold text-4xl md:text-5xl">{t('plp.title')}</h1>
            <p className="mt-2 text-muted-foreground max-w-lg">{t('plp.subtitle')}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            {loading ? t('common.loading') : `${filtered.length} ${t('plp.results')}`}
          </p>
        </div>

        <div className="flex md:hidden items-center justify-between mb-4">
          <h1 className="font-heading font-extrabold text-2xl">{t('plp.title')}</h1>
          <button
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-full bg-mist font-heading font-bold text-sm"
          >
            <SlidersHorizontal className="w-4 h-4" /> {t('plp.filter')}
            {cats.length + ages.length > 0 && (
              <span className="grid place-items-center min-w-5 h-5 px-1 rounded-full bg-cosmic text-white text-[11px]">
                {cats.length + ages.length}
              </span>
            )}
          </button>
        </div>

        {bundles.length > 0 && !hasActive && (
          <section className="mb-10">
            <h2 className="font-heading font-extrabold text-2xl md:text-3xl mb-5">{t('bundle.sectionTitle')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
              {bundles.slice(0, 4).map((b) => (
                <BundleCard key={b.id} bundle={b} products={products} />
              ))}
            </div>
          </section>
        )}

        <div className="grid md:grid-cols-[260px_1fr] gap-8">
          <aside className="hidden md:block">
            <div className="sticky top-24 rounded-3xl bg-mist/60 p-6">{FiltersEl}</div>
          </aside>

          <div>
            <div className="flex items-center justify-between mb-4 gap-3">
              <p className="text-sm text-muted-foreground md:hidden">
                {loading ? t('common.loading') : `${filtered.length} ${t('plp.results')}`}
              </p>
              <div className="flex items-center gap-2 ms-auto">
                <label className="text-sm text-muted-foreground">{t('plp.sort')}</label>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="h-10 rounded-full bg-mist px-3 text-sm font-medium focus:outline-none"
                >
                  {SORTS.map((s) => (
                    <option key={s.id} value={s.id}>{t(s.label)}</option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="aspect-[4/5] rounded-[2rem] bg-mist animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20">
                <p className="font-heading font-bold text-2xl">{t('plp.noResults')}</p>
                <p className="mt-2 text-muted-foreground">{t('plp.noResultsDesc')}</p>
                {hasActive && (
                  <button onClick={clearAll} className="mt-5 text-cosmic font-heading font-bold hover:underline">
                    {t('plp.clearAll')}
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
                {filtered.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />

      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="absolute end-0 top-0 h-full w-[85%] max-w-sm bg-background shadow-2xl overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading font-bold text-lg">{t('plp.filter')}</h2>
              <button
                onClick={() => setDrawerOpen(false)}
                className="grid place-items-center w-10 h-10 rounded-full bg-mist"
                aria-label={t('common.back')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {FiltersEl}
            <button
              onClick={() => setDrawerOpen(false)}
              className="mt-8 w-full h-12 rounded-full bg-cosmic text-white font-heading font-bold"
            >
              {t('plp.apply')} ({filtered.length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}