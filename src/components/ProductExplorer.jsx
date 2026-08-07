import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';
import ProductCard from '@/components/ProductCard';

const TOY_TYPES = [
  'All',
  'Build & Create',
  'Plush & Soft',
  'Vehicles & Motion',
  'Early Years',
  'Pretend Play',
  'Arts & Crafts',
];

const AGE_GROUPS = [
  { label: 'All ages', min: 0, max: Infinity },
  { label: '0-2 years', min: 0, max: 2 },
  { label: '3-5 years', min: 3, max: 5 },
  { label: '6+ years', min: 6, max: Infinity },
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
  const [toyType, setToyType] = useState('All');
  const [age, setAge] = useState('All ages');

  const activeAge = AGE_GROUPS.find((g) => g.label === age);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const typeOk = toyType === 'All' || p.category === toyType;
      const ageOk =
        !activeAge || overlaps(ageRange(p.age_range), { min: activeAge.min, max: activeAge.max });
      return typeOk && ageOk;
    });
  }, [products, toyType, activeAge]);

  const reset = () => {
    setToyType('All');
    setAge('All ages');
  };

  return (
    <section id="explore" className="max-w-7xl mx-auto px-5 sm:px-8 py-8 md:py-12">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">
            The collection
          </p>
          <h2 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl">
            Curated Discovery
          </h2>
        </div>
        <Link to="/cart" className="text-cosmic font-heading font-bold hover:underline">
          View cart →
        </Link>
      </div>

      {/* Filter bar */}
      <div className="rounded-3xl bg-mist/60 p-5 md:p-6 mb-10">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground font-medium mb-4">
          <SlidersHorizontal className="w-3.5 h-3.5" /> Filter
        </div>

        <div className="space-y-4">
          {/* Toy type */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-heading font-bold w-20 shrink-0">Type</span>
            <div className="flex gap-2 flex-wrap">
              {TOY_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setToyType(t)}
                  className={`squish h-10 px-4 rounded-full text-sm font-medium transition-colors ${
                    toyType === t
                      ? 'bg-cosmic text-white'
                      : 'bg-background text-foreground/70 hover:bg-accent/20'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Age group */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-heading font-bold w-20 shrink-0">Age</span>
            <div className="flex gap-2 flex-wrap">
              {AGE_GROUPS.map((g) => (
                <button
                  key={g.label}
                  onClick={() => setAge(g.label)}
                  className={`squish h-10 px-4 rounded-full text-sm font-medium transition-colors ${
                    age === g.label
                      ? 'bg-cosmic text-white'
                      : 'bg-background text-foreground/70 hover:bg-accent/20'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm text-muted-foreground">
            {loading ? 'Loading…' : `${filtered.length} product${filtered.length === 1 ? '' : 's'} found`}
          </p>
          {(toyType !== 'All' || age !== 'All ages') && (
            <button
              onClick={reset}
              className="text-sm text-cosmic font-heading font-bold hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] rounded-[2rem] bg-mist animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="font-heading font-bold text-2xl">No toys match those filters</p>
          <p className="mt-2 text-muted-foreground">Try widening your search.</p>
          <button onClick={reset} className="mt-5 text-cosmic font-heading font-bold hover:underline">
            Clear filters
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