import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import { useLanguage } from '@/context/LanguageContext';

const TOY_TYPES = [
  'All',
  'Build & Create',
  'Plush & Soft',
  'Vehicles & Motion',
  'Early Years',
  'Pretend Play',
  'Arts & Crafts',
];

const CAT_KEYS = {
  'Build & Create': 'build',
  'Plush & Soft': 'plush',
  'Vehicles & Motion': 'vehicles',
  'Early Years': 'early',
  'Pretend Play': 'pretend',
  'Arts & Crafts': 'arts',
};

const AGE_GROUPS = [
  { id: 'all', min: 0, max: Infinity },
  { id: '0_2', min: 0, max: 2 },
  { id: '3_5', min: 3, max: 5 },
  { id: '6', min: 6, max: Infinity },
];

function ageRange(a) {
  if (!a) return { min: 0, max: Infinity };
  if (a.trim() === '0+') return { min: 0, max: Infinity };
  const [lo, hi] = a.split('-').map((x) => parseInt(x.trim(), 10));
  return { min: isNaN(lo) ? 0 : lo, max: isNaN(hi) ? Infinity : hi };
}

function overlaps(a, b) {
  return a.max >= b.min && a.min <= b.max;
}

export default function ProductExplorer({ products, loading }) {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = (searchParams.get('search') || '').trim();
  const [toyType, setToyType] = useState('All');
  const [age, setAge] = useState('all');
  const [tag, setTag] = useState('All');

  const activeAge = AGE_GROUPS.find((g) => g.id === age);
  const typeLabel = (v) => (v === 'All' ? t('explore.all') : t(`cat.${CAT_KEYS[v]}`));

  const allTags = useMemo(() => {
    const set = new Set();
    products.forEach((p) => Array.isArray(p.tags) && p.tags.forEach((tg) => set.add(tg)));
    return ['All', ...Array.from(set)];
  }, [products]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return products.filter((p) => {
      const typeOk = toyType === 'All' || p.category === toyType;
      const ageOk =
        !activeAge || overlaps(ageRange(p.age_range), { min: activeAge.min, max: activeAge.max });
      const tagOk = tag === 'All' || (Array.isArray(p.tags) && p.tags.includes(tag));
      const searchOk =
        !term ||
        (p.name && p.name.toLowerCase().includes(term)) ||
        (p.category && p.category.toLowerCase().includes(term)) ||
        (Array.isArray(p.tags) && p.tags.some((tg) => tg.toLowerCase().includes(term)));
      return typeOk && ageOk && tagOk && searchOk;
    });
  }, [products, toyType, activeAge, tag, search]);

  const reset = () => {
    setToyType('All');
    setAge('all');
    setTag('All');
    if (searchParams.get('search')) setSearchParams({}, { replace: true });
  };

  return (
    <section id="explore" className="max-w-7xl mx-auto px-5 sm:px-8 py-8 md:py-12">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">
            {t('explore.label')}
          </p>
          <h2 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl">{t('explore.title')}</h2>
        </div>
        <Link to="/cart" className="text-cosmic font-heading font-bold hover:underline">{t('common.viewCart')}</Link>
      </div>

      <div className="rounded-3xl bg-mist/60 p-5 md:p-6 mb-10">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground font-medium mb-4">
          <SlidersHorizontal className="w-3.5 h-3.5" /> {t('explore.filter')}
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-heading font-bold w-20 shrink-0">{t('explore.type')}</span>
            <div className="flex gap-2 flex-wrap">
              {TOY_TYPES.map((ty) => (
                <button
                  key={ty}
                  onClick={() => setToyType(ty)}
                  className={`squish h-10 px-4 rounded-full text-sm font-medium transition-colors ${
                    toyType === ty ? 'bg-cosmic text-white' : 'bg-background text-foreground/70 hover:bg-accent/20'
                  }`}
                >
                  {typeLabel(ty)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-heading font-bold w-20 shrink-0">{t('explore.age')}</span>
            <div className="flex gap-2 flex-wrap">
              {AGE_GROUPS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setAge(g.id)}
                  className={`squish h-10 px-4 rounded-full text-sm font-medium transition-colors ${
                    age === g.id ? 'bg-cosmic text-white' : 'bg-background text-foreground/70 hover:bg-accent/20'
                  }`}
                >
                  {t(`age.${g.id}`)}
                </button>
              ))}
            </div>
          </div>

          {allTags.length > 1 && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-heading font-bold w-20 shrink-0">{t('explore.tags')}</span>
              <div className="flex gap-2 flex-wrap">
                {allTags.map((tg) => (
                  <button
                    key={tg}
                    onClick={() => setTag(tg)}
                    className={`squish h-10 px-4 rounded-full text-sm font-medium transition-colors ${
                      tag === tg ? 'bg-cosmic text-white' : 'bg-background text-foreground/70 hover:bg-accent/20'
                    }`}
                  >
                    {tg === 'All' ? t('explore.all') : tg}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm text-muted-foreground">
            {loading
              ? t('common.loading')
              : `${filtered.length} ${filtered.length === 1 ? t('common.foundOne') : t('common.found')}`}
          </p>
          {(toyType !== 'All' || age !== 'all' || tag !== 'All' || search) && (
            <button onClick={reset} className="text-sm text-cosmic font-heading font-bold hover:underline">
              {t('common.clear')}
            </button>
          )}
        </div>
      </div>

      {search && (
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3 rounded-2xl bg-mist/60 px-5 py-3">
          <p className="text-sm text-muted-foreground">
            {t('explore.resultsFor')} <span className="font-heading font-bold text-foreground">"{search}"</span>
          </p>
          <button
            onClick={() => setSearchParams({}, { replace: true })}
            className="text-sm text-cosmic font-heading font-bold hover:underline"
          >
            {t('common.clear')}
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] rounded-[2rem] bg-mist animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="font-heading font-bold text-2xl">{t('common.noMatch')}</p>
          <p className="mt-2 text-muted-foreground">{t('common.tryWiden')}</p>
          <button onClick={reset} className="mt-5 text-cosmic font-heading font-bold hover:underline">
            {t('common.clear')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
          {filtered.map((p, i) => (
            <ProductCard key={p.id} product={p} large={i < 2} />
          ))}
        </div>
      )}
    </section>
  );
}