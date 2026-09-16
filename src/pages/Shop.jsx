import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SlidersHorizontal, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from '@/api/entities';
import { invokeFunction } from '@/lib/supabaseFunctions';
import { queryKeys } from '@/lib/queryKeys';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PageHeader from '@/components/PageHeader';
import ProductCard from '@/components/ProductCard';
import BundleCard from '@/components/bundles/BundleCard';
import FilterPopover from '@/components/shop/FilterPopover';
import FilterDrawer from '@/components/shop/FilterDrawer';
import {
  AGE_OPTIONS, CategorySection, PriceSection, GenderSection, AgeSection,
} from '@/components/shop/ProductFilters';
import { useLanguage } from '@/context/LanguageContext';
import { useCategories } from '@/context/CategoryContext';
import { categoryName } from '@/lib/bilingual';
import { isBundleActive, bundleProductIds } from '@/lib/bundles';
import { supabase } from '@/api/supabaseClient';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { SITE_URL } from '@/lib/siteUrl';
import { parseGenderParam, GENDER_MALE, GENDER_FEMALE } from '@/lib/gender';

const SORTS = [
  { id: 'featured', label: 'plp.sortFeatured' },
  { id: 'priceLow', label: 'plp.sortPriceLow' },
  { id: 'priceHigh', label: 'plp.sortPriceHigh' },
  { id: 'newest', label: 'plp.sortNewest' },
  { id: 'discount', label: 'plp.sortDiscount' },
];

const PER_PAGE_OPTIONS = [25, 50, 75, 100];

// Small count badge shown on a filter trigger once it has a selection —
// shared look for the toolbar popovers and the Filters/drawer button.
function CountBadge({ children }) {
  return (
    <span className="grid place-items-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-white/25 text-[11px] leading-none">
      {children}
    </span>
  );
}

export default function Shop() {
  const { t, lang } = useLanguage();
  const ar = lang === 'ar';
  const { categories } = useCategories();
  // Canonical always points at the bare /shop URL regardless of active
  // filters — avoids indexing a separate "page" per category/age/gender/
  // search/sort combination (Google's own recommended technique for
  // faceted navigation) without touching filter/URL behavior itself.
  useDocumentMeta({ title: `${t('plp.title')} | HiKids`, description: t('plp.subtitle'), canonical: `${SITE_URL}/shop` });
  const [searchParams, setSearchParams] = useSearchParams();

  const [bundles, setBundles] = useState([]);
  const [bundleStockMap, setBundleStockMap] = useState(null);

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [sort, setSort] = useState('featured');
  const initialCat = searchParams.get('category');
  const [cats, setCats] = useState(() => (initialCat ? [initialCat] : []));
  // Gender and age are read straight from the URL on every render, not
  // cached in state from the initial mount. The header "Shop by Gender" menu
  // navigates here with new query params while this page may already be
  // mounted (same /shop route — React Router re-renders, it doesn't
  // remount), so state seeded only once at mount would go stale and the
  // header link would silently stop applying its filter on a second visit.
  const ages = useMemo(() => {
    const ids = (searchParams.get('age') || '').split(',').map((s) => s.trim()).filter(Boolean);
    return ids.filter((id) => AGE_OPTIONS.some((g) => g.id === id));
  }, [searchParams]);
  const gender = useMemo(() => parseGenderParam(searchParams.get('gender')), [searchParams]);
  // Same "read straight from the URL" treatment as gender/age above — the
  // homepage's "View All Deals" link and a shared/bookmarked
  // /shop?onSale=true URL both need this active the instant the page mounts,
  // survive a refresh, and respond to browser Back/Forward.
  const onSale = searchParams.get('onSale') === 'true';
  const [priceBounds, setPriceBounds] = useState([0, 1000]);
  const [price, setPrice] = useState(null); // null = untouched → use bounds
  const [usedCategoryNames, setUsedCategoryNames] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const search = (searchParams.get('search') || '').trim();
  // Local, debounced copy of the search box so every keystroke doesn't
  // immediately rewrite the URL / refire the query — synced back from the
  // URL too, so a header link or browser back/forward that changes `search`
  // is reflected in the box.
  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => { setSearchInput(search); }, [search]);
  const metaLoaded = useRef(false);
  const priceBoundsRef = useRef(priceBounds);
  priceBoundsRef.current = priceBounds;

  // Load active bundles + a projected stock map of their component products
  // (so bundle availability stays correct without loading the full catalog —
  // fetches only the specific product ids the active bundles reference,
  // never all 10,000 products).
  useEffect(() => {
    db.Bundle.list('-updated_date', 100)
      .then((list) => {
        const active = (list || []).filter(isBundleActive);
        setBundles(active);
        const ids = bundleProductIds(active);
        if (ids.length) {
          supabase.from('products').select('id,stock').in('id', ids)
            .then(({ data, error }) => {
              if (error) { setBundleStockMap({}); return; }
              const m = {};
              for (const p of data || []) m[p.id] = p;
              setBundleStockMap(m);
            });
        } else {
          setBundleStockMap({});
        }
      })
      .catch(() => setBundles([]));
  }, []);

  // Server-side paginated product fetch, cached by React Query. Catalog
  // listings are the textbook "cacheable, stale-while-revalidate" case from
  // the freshness audit: returning to /shop with the same filters within the
  // staleTime window shows the previous page instantly (no duplicate
  // request); once stale it still shows that same content immediately while
  // quietly refetching in the background, and the list re-renders in place
  // when that finishes — never a full-page reload or a forced spinner over
  // content the visitor is already looking at. New products and edits to
  // purely descriptive fields are intentionally allowed to wait for this —
  // per-product commercial fields (price/discount/stock) are a separate
  // concern, kept live independently (see useProductCommercial, used on the
  // product detail page) rather than riding along in this cached list.
  const { data: pageDataRaw, isLoading: loading } = useQuery({
    queryKey: queryKeys.products({ page, perPage, sort, cats, ages, gender, price, search, onSale }),
    queryFn: async () => {
      const pb = priceBoundsRef.current;
      const activePrice = price || pb;
      const priceActive = !!price && (price[0] !== pb[0] || price[1] !== pb[1]);
      const d = await invokeFunction('shopProducts', {
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
        onSale,
        includeMeta: !metaLoaded.current,
      });
      // Meta (price bounds / which categories currently have products) isn't
      // itself cache-worthy per filter combination — it describes the whole
      // catalog, not this page of it — so it's synced to plain state here,
      // fetched only once regardless of how many filter combinations get
      // queried afterward.
      if (d.priceBounds) setPriceBounds(d.priceBounds);
      if (d.usedCategories) setUsedCategoryNames(d.usedCategories);
      metaLoaded.current = true;
      return { items: d.items || [], total: d.total ?? null, hasMore: !!d.hasMore };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  const pageData = pageDataRaw || { items: [], total: null, hasMore: false };

  const priceActive = !!price && (price[0] !== priceBounds[0] || price[1] !== priceBounds[1]);
  const hasActive = cats.length > 0 || ages.length > 0 || !!gender || !!search || priceActive || onSale;
  const activeCount = cats.length + ages.length + (gender ? 1 : 0) + (priceActive ? 1 : 0) + (onSale ? 1 : 0);

  // Gender/age live in the URL (see above), so changing them writes back to
  // the URL — via the functional updater, so it merges with whatever else is
  // already there (category, search) instead of clobbering it. This is also
  // what makes refresh and browser Back/Forward restore the right filter:
  // there's nothing to restore beyond what's already in the address bar.
  const setUrlParam = (key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const empty = value == null || value === '' || (Array.isArray(value) && value.length === 0);
      if (empty) next.delete(key);
      else next.set(key, Array.isArray(value) ? value.join(',') : value);
      return next;
    });
  };

  // Filter / sort / perPage changes reset to page 1.
  const onSortChange = (v) => { setSort(v); setPage(1); };
  const onSetCats = (v) => { setCats(v); setPage(1); };
  const onSetAges = (v) => { setUrlParam('age', v); setPage(1); };
  const onSetGender = (v) => { setUrlParam('gender', v); setPage(1); };
  const onSetOnSale = (v) => { setUrlParam('onSale', v ? 'true' : null); setPage(1); };
  const onSetPrice = (v) => { setPrice(v); setPage(1); };
  const onPerPage = (v) => { setPerPage(v); setPage(1); };

  const clearAll = () => {
    setCats([]);
    setPrice(null);
    setSearchParams({});
    setPage(1);
  };

  // Debounced write-back of the search box into the URL (and therefore the
  // query key) — 400ms of no typing before it actually filters.
  useEffect(() => {
    const term = searchInput.trim();
    if (term === search) return;
    const id = setTimeout(() => {
      setUrlParam('search', term);
      setPage(1);
    }, 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const displayPrice = price || priceBounds;
  const totalItems = pageData.total;
  const totalPages = totalItems != null ? Math.max(1, Math.ceil(totalItems / perPage)) : null;
  const nextDisabled = totalPages != null ? page >= totalPages : !pageData.hasMore;
  const resultsLabel = loading
    ? t('common.loading')
    : totalItems != null
      ? `${totalItems} ${t('plp.results')}`
      : `${pageData.items.length}${pageData.hasMore ? '+' : ''} ${t('plp.results')}`;

  const catLabel = (name) => {
    const c = categories.find((x) => x.name === name);
    return c ? categoryName(c, lang) : name;
  };
  const removeCat = (name) => onSetCats(cats.filter((c) => c !== name));
  const removeAge = (id) => onSetAges(ages.filter((a) => a !== id));
  const removeGender = () => onSetGender(null);
  const removePrice = () => onSetPrice(null);

  const genderLabel = gender === GENDER_MALE ? t('gender.boys') : gender === GENDER_FEMALE ? t('gender.girls') : null;

  const filterSectionProps = {
    cats, setCats: onSetCats, ages, setAges: onSetAges, gender, setGender: onSetGender,
    priceBounds, price: displayPrice, setPrice: onSetPrice,
    extraCategories: categories, usedCategoryNames,
    onSale, setOnSale: onSetOnSale,
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={t('plp.title')} />
      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8 md:py-12">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading font-extrabold text-3xl md:text-5xl">{t('plp.title')}</h1>
            <p className="hidden md:block mt-1 text-muted-foreground max-w-lg">{t('plp.subtitle')}</p>
          </div>
          <p className="text-sm text-muted-foreground">{resultsLabel}</p>
        </div>

        {/* ── Product toolbar: search, quick filters, Filters drawer, sort,
            per-page — replaces the old permanent sidebar entirely. */}
        <div className="mt-5 rounded-3xl bg-mist/60 p-3 sm:p-4 space-y-3">
          <div className="relative">
            <Search className="absolute top-1/2 -translate-y-1/2 start-4 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('nav.search')}
              className="w-full h-11 ps-11 pe-10 rounded-full bg-card border border-border/70 text-sm focus:outline-none focus:ring-2 focus:ring-cosmic/40"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                aria-label={t('plp.clearAll')}
                className="absolute top-1/2 -translate-y-1/2 end-3 grid place-items-center w-6 h-6 rounded-full text-muted-foreground hover:bg-card"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick filters — desktop/tablet only; mobile relies on the
              Filters drawer for everything (see point 18 of the brief). */}
          <div className="hidden md:flex flex-wrap items-center gap-2">
            {/* A single on/off filter, not a "choose from options" one — a
                plain toggle pill (same active/inactive styling as every
                FilterPopover trigger) rather than a popover with one
                checkbox inside it. */}
            <button
              type="button"
              onClick={() => onSetOnSale(!onSale)}
              aria-pressed={onSale}
              className={`squish inline-flex items-center gap-1.5 h-11 px-4 rounded-full text-sm font-heading font-bold transition-colors ${
                onSale ? 'bg-cosmic text-white' : 'bg-mist text-foreground/80 hover:bg-accent/20'
              }`}
            >
              {onSale && '✓ '}{t('plp.onSale')}
            </button>
            <FilterPopover label={<>{t('plp.category')} {cats.length > 0 && <CountBadge>{cats.length}</CountBadge>}</>} active={cats.length > 0}>
              <CategorySection cats={cats} setCats={onSetCats} extraCategories={categories} usedCategoryNames={usedCategoryNames} />
            </FilterPopover>
            <FilterPopover label={<>{t('plp.age')} {ages.length > 0 && <CountBadge>{ages.length}</CountBadge>}</>} active={ages.length > 0}>
              <AgeSection ages={ages} setAges={onSetAges} />
            </FilterPopover>
            <FilterPopover label={genderLabel || t('plp.gender')} active={!!gender}>
              <GenderSection gender={gender} setGender={onSetGender} />
            </FilterPopover>
            <FilterPopover label={priceActive ? <bdi>₪{displayPrice[0]}–₪{displayPrice[1]}</bdi> : t('plp.priceRange')} active={priceActive}>
              <PriceSection priceBounds={priceBounds} price={displayPrice} setPrice={onSetPrice} />
            </FilterPopover>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setDrawerOpen(true)}
              className="squish inline-flex items-center gap-2 h-11 px-4 rounded-full bg-mist font-heading font-bold text-sm hover:bg-accent/20 transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" /> {t('plp.filters')}
              {activeCount > 0 && <CountBadge>{activeCount}</CountBadge>}
            </button>

            <div className="flex items-center gap-2 flex-wrap ms-auto">
              <select
                value={sort}
                onChange={(e) => onSortChange(e.target.value)}
                aria-label={t('plp.sort')}
                className="h-11 rounded-full bg-card border border-border/70 px-4 text-sm font-medium focus:outline-none"
              >
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>{t(s.label)}</option>
                ))}
              </select>
              <select
                value={perPage}
                onChange={(e) => onPerPage(Number(e.target.value))}
                aria-label={ar ? 'عدد المنتجات في الصفحة' : 'Products per page'}
                className="h-11 rounded-full bg-card border border-border/70 px-4 text-sm font-medium focus:outline-none"
              >
                {PER_PAGE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{ar ? `عرض ${n}` : `Show ${n}`}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Active filter chips ─────────────────────────────────────── */}
        {hasActive && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {onSale && <ActiveChip onRemove={() => onSetOnSale(false)}>{t('plp.onSale')}</ActiveChip>}
            {cats.map((c) => (
              <ActiveChip key={`cat-${c}`} onRemove={() => removeCat(c)}>{catLabel(c)}</ActiveChip>
            ))}
            {ages.map((a) => (
              <ActiveChip key={`age-${a}`} onRemove={() => removeAge(a)}>{t(`age.${a}`)}</ActiveChip>
            ))}
            {gender && <ActiveChip onRemove={removeGender}>{genderLabel}</ActiveChip>}
            {priceActive && (
              <ActiveChip onRemove={removePrice}><bdi>₪{displayPrice[0]} – ₪{displayPrice[1]}</bdi></ActiveChip>
            )}
            {search && (
              <ActiveChip onRemove={() => { setUrlParam('search', null); setPage(1); }}>“{search}”</ActiveChip>
            )}
            <button onClick={clearAll} className="text-sm text-cosmic font-heading font-bold hover:underline ms-1">
              {t('plp.clearAll')}
            </button>
          </div>
        )}

        {bundles.length > 0 && !hasActive && bundleStockMap && (
          <section className="mt-10 mb-2">
            <div className="flex items-end justify-between gap-3 mb-5">
              <h2 className="font-heading font-extrabold text-2xl md:text-3xl">{t('bundle.sectionTitle')}</h2>
              {bundles.length > 4 && (
                <Link to="/bundles" className="text-sm text-cosmic font-heading font-bold hover:underline whitespace-nowrap">
                  {t('bundle.viewAll')}
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
              {bundles.slice(0, 4).map((b) => (
                <BundleCard key={b.id} bundle={b} products={bundleStockMap} />
              ))}
            </div>
          </section>
        )}

        <div className="mt-8">
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
              {Array.from({ length: Math.min(perPage, 12) }).map((_, i) => (
                <div key={i} className="aspect-[4/5] rounded-[2rem] bg-mist animate-pulse" />
              ))}
            </div>
          ) : pageData.items.length === 0 ? (
            <div className="text-center py-20">
              <p className="font-heading font-bold text-2xl">{onSale ? t('deals.empty') : t('plp.noResults')}</p>
              {!onSale && <p className="mt-2 text-muted-foreground">{t('plp.noResultsDesc')}</p>}
              {hasActive && (
                <button onClick={clearAll} className="mt-5 text-cosmic font-heading font-bold hover:underline">
                  {t('plp.clearAll')}
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Recovered sidebar width → an extra column at lg/xl versus the
                  old 3-column max next to the permanent sidebar. */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
                {pageData.items.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>

              <div className="mt-10 flex items-center justify-center gap-3">
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
            </>
          )}
        </div>
      </main>
      <Footer />

      <FilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeCount={activeCount}
        resultCount={totalItems != null ? totalItems : pageData.items.length}
        onClear={clearAll}
        hasActive={hasActive}
        {...filterSectionProps}
      />
    </div>
  );
}

function ActiveChip({ children, onRemove }) {
  const { lang } = useLanguage();
  const removeLabel = lang === 'ar' ? 'إزالة' : 'Remove';
  return (
    <span className="inline-flex items-center gap-1.5 h-9 ps-4 pe-2 rounded-full bg-cosmic/10 text-cosmic border border-cosmic/20 text-sm font-medium">
      {children}
      <button
        type="button"
        onClick={onRemove}
        className="grid place-items-center w-5 h-5 rounded-full hover:bg-cosmic hover:text-white transition-colors"
        aria-label={removeLabel}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}
