import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { unwrap } from '@/lib/invoke';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PageHeader from '@/components/PageHeader';
import ProductCard from '@/components/ProductCard';
import BundleCard from '@/components/bundles/BundleCard';
import ProductFilters, { AGE_OPTIONS } from '@/components/shop/ProductFilters';
import { useLanguage } from '@/context/LanguageContext';
import { useCategories } from '@/context/CategoryContext';
import { isBundleActive } from '@/lib/bundles';

const SORTS = [
  { id: 'featured', label: 'plp.sortFeatured' },
  { id: 'priceLow', label: 'plp.sortPriceLow' },
  { id: 'priceHigh', label: 'plp.sortPriceHigh' },
  { id: 'newest', label: 'plp.sortNewest' },
];

const PER_PAGE_OPTIONS = [25, 50, 75, 100];

export default function Shop() {
  const { t, lang } = useLanguage();
  const ar = lang === 'ar';
  const { categories } = useCategories();
  const [searchParams, setSearchParams] = useSearchParams();

  const [bundles, setBundles] = useState([]);
  const [bundleStockMap, setBundleStockMap] = useState(null);

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [sort, setSort] = useState('featured');
  const initialCat = searchParams.get('category');
  const initialAge = searchParams.get('age');
  const initialGender = searchParams.get('gender');
  const [cats, setCats] = useState(() => (initialCat ? [initialCat] : []));
  const [ages, setAges] = useState(() => (initialAge && AGE_OPTIONS.some((g) => g.id === initialAge) ? [initialAge] : []));
  const [gender, setGender] = useState(() => (initialGender === 'Boy' || initialGender === 'Girl' ? initialGender : null));
  const [priceBounds, setPriceBounds] = useState([0, 1000]);
  const [price, setPrice] = useState(null); // null = untouched → use bounds
  const [usedCategoryNames, setUsedCategoryNames] = useState([]);
  const [pageData, setPageData] = useState({ items: [], total: null, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const search = (searchParams.get('search') || '').trim();
  const metaLoaded = useRef(false);
  const priceBoundsRef = useRef(priceBounds);
  priceBoundsRef.current = priceBounds;

  // Load active bundles + a projected stock map of their component products
  // (so bundle availability stays correct without loading the full catalog).
  useEffect(() => {
    base44.entities.Bundle.list('-updated_date', 100)
      .then((list) => {
        const active = (list || []).filter(isBundleActive);
        setBundles(active);
        if (active.length) {
          base44.entities.Product.list(null, 10000, 0, ['id', 'stock'])
            .then((all) => {
              const m = {};
              for (const p of all || []) m[p.id] = p;
              setBundleStockMap(m);
            })
            .catch(() => setBundleStockMap({}));
        }
      })
      .catch(() => setBundles([]));
  }, []);

  // Server-side paginated product fetch — only the requested page is returned.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const pb = priceBoundsRef.current;
    const activePrice = price || pb;
    const priceActive = !!price && (price[0] !== pb[0] || price[1] !== pb[1]);
    base44.functions
      .invoke('shopProducts', {
        page,
        perPage,
        sort,
        cats,
        ages,
        gender,
        priceMin: activePrice[0],
        priceMax: activePrice[1],
        priceActive,
        search,
        includeMeta: !metaLoaded.current,
      })
      .then((raw) => {
        if (cancelled) return;
        const d = unwrap(raw);
        setPageData({ items: d.items || [], total: d.total ?? null, hasMore: !!d.hasMore });
        if (d.priceBounds) setPriceBounds(d.priceBounds);
        if (d.usedCategories) setUsedCategoryNames(d.usedCategories);
        metaLoaded.current = true;
      })
      .catch(() => {
        if (!cancelled) setPageData({ items: [], total: 0, hasMore: false });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, sort, cats, ages, gender, price, search]);

  const hasActive =
    cats.length > 0 ||
    ages.length > 0 ||
    !!gender ||
    !!search ||
    (!!price && (price[0] !== priceBounds[0] || price[1] !== priceBounds[1]));

  // Filter / sort / perPage changes reset to page 1.
  const onSortChange = (v) => { setSort(v); setPage(1); };
  const onSetCats = (v) => { setCats(v); setPage(1); };
  const onSetAges = (v) => { setAges(v); setPage(1); };
  const onSetGender = (v) => { setGender(v); setPage(1); };
  const onSetPrice = (v) => { setPrice(v); setPage(1); };
  const onPerPage = (v) => { setPerPage(v); setPage(1); };

  const clearAll = () => {
    setCats([]);
    setAges([]);
    setGender(null);
    setPrice(null);
    if (search) setSearchParams({}, { replace: true });
    setPage(1);
  };

  const displayPrice = price || priceBounds;
  const totalItems = pageData.total;
  const totalPages = totalItems != null ? Math.max(1, Math.ceil(totalItems / perPage)) : null;
  const nextDisabled = totalPages != null ? page >= totalPages : !pageData.hasMore;
  const resultsLabel = loading
    ? t('common.loading')
    : totalItems != null
      ? `${totalItems} ${t('plp.results')}`
      : `${pageData.items.length}${pageData.hasMore ? '+' : ''} ${t('plp.results')}`;

  const FiltersEl = (
    <ProductFilters
      cats={cats} setCats={onSetCats} ages={ages} setAges={onSetAges}
      gender={gender} setGender={onSetGender}
      priceBounds={priceBounds} price={displayPrice} setPrice={onSetPrice}
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
          <p className="text-sm text-muted-foreground">{resultsLabel}</p>
        </div>

        <div className="flex md:hidden items-center justify-between mb-4">
          <h1 className="font-heading font-extrabold text-2xl">{t('plp.title')}</h1>
          <button
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-full bg-mist font-heading font-bold text-sm"
          >
            <SlidersHorizontal className="w-4 h-4" /> {t('plp.filter')}
            {cats.length + ages.length + (gender ? 1 : 0) > 0 && (
              <span className="grid place-items-center min-w-5 h-5 px-1 rounded-full bg-cosmic text-white text-[11px]">
                {cats.length + ages.length + (gender ? 1 : 0)}
              </span>
            )}
          </button>
        </div>

        {bundles.length > 0 && !hasActive && bundleStockMap && (
          <section className="mb-10">
            <h2 className="font-heading font-extrabold text-2xl md:text-3xl mb-5">{t('bundle.sectionTitle')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
              {bundles.slice(0, 4).map((b) => (
                <BundleCard key={b.id} bundle={b} products={bundleStockMap} />
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
              <p className="text-sm text-muted-foreground md:hidden">{resultsLabel}</p>
              <div className="flex items-center gap-2 ms-auto">
                <label className="text-sm text-muted-foreground">{t('plp.sort')}</label>
                <select
                  value={sort}
                  onChange={(e) => onSortChange(e.target.value)}
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
                {Array.from({ length: Math.min(perPage, 9) }).map((_, i) => (
                  <div key={i} className="aspect-[4/5] rounded-[2rem] bg-mist animate-pulse" />
                ))}
              </div>
            ) : pageData.items.length === 0 ? (
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
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
                  {pageData.items.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>

                {/* Pagination + per-page controls */}
                <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">
                      {ar ? 'منتجات لكل صفحة' : 'Products per page'}
                    </label>
                    <select
                      value={perPage}
                      onChange={(e) => onPerPage(Number(e.target.value))}
                      className="h-9 rounded-full bg-mist px-3 text-sm font-medium focus:outline-none"
                    >
                      {PER_PAGE_OPTIONS.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="squish grid place-items-center w-9 h-9 rounded-full bg-mist disabled:opacity-40 disabled:pointer-events-none"
                      aria-label={ar ? 'السابق' : 'Previous'}
                    >
                      <ChevronLeft className="w-5 h-5 rtl:rotate-180" />
                    </button>
                    <span className="text-sm font-medium whitespace-nowrap">
                      {totalPages != null
                        ? `${ar ? 'صفحة' : 'Page'} ${page} ${ar ? 'من' : 'of'} ${totalPages}`
                        : `${ar ? 'صفحة' : 'Page'} ${page}`}
                    </span>
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={nextDisabled}
                      className="squish grid place-items-center w-9 h-9 rounded-full bg-mist disabled:opacity-40 disabled:pointer-events-none"
                      aria-label={ar ? 'التالي' : 'Next'}
                    >
                      <ChevronRight className="w-5 h-5 rtl:rotate-180" />
                    </button>
                  </div>
                </div>
              </>
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
              {t('plp.apply')} ({totalItems != null ? totalItems : pageData.items.length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}