import React, { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import { db } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';
import BundleCard from '@/components/bundles/BundleCard';
import { useLanguage } from '@/context/LanguageContext';
import { isBundleActive, bundleProductIds } from '@/lib/bundles';

// Customer-facing bundles index — reuses the same BundleCard already used in
// Shop.jsx's teaser strip, just without the 4-card cap. Fetches only the
// product ids the active bundles actually reference (never the full
// catalog) to compute live availability, same as Shop.jsx.
export default function BundlesList() {
  const { t } = useLanguage();
  const [bundles, setBundles] = useState(null);
  const [stockMap, setStockMap] = useState(null);

  useEffect(() => {
    let cancelled = false;
    db.Bundle.list('-updated_date', 100)
      .then((list) => {
        if (cancelled) return;
        const active = (list || []).filter(isBundleActive);
        setBundles(active);
        const ids = bundleProductIds(active);
        if (!ids.length) { setStockMap({}); return; }
        supabase.from('products').select('id,stock').in('id', ids)
          .then(({ data, error }) => {
            if (cancelled) return;
            if (error) { setStockMap({}); return; }
            const m = {};
            for (const p of data || []) m[p.id] = p;
            setStockMap(m);
          });
      })
      .catch(() => { if (!cancelled) setBundles([]); });
    return () => { cancelled = true; };
  }, []);

  const loading = bundles === null || stockMap === null;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={t('nav.bundles')} />
      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8 md:py-12">
        <h1 className="font-heading font-extrabold text-3xl md:text-5xl">{t('nav.bundles')}</h1>
        <p className="mt-2 text-muted-foreground max-w-lg">{t('bundle.pageSubtitle')}</p>

        <div className="mt-8">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-[4/5] rounded-[2rem] bg-mist animate-pulse" />
              ))}
            </div>
          ) : bundles.length === 0 ? (
            <div className="text-center py-20">
              <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-mist">
                <Package className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="mt-5 font-heading font-bold text-2xl">{t('bundle.emptyTitle')}</p>
              <p className="mt-2 text-muted-foreground">{t('bundle.emptyDesc')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
              {bundles.map((b) => (
                <BundleCard key={b.id} bundle={b} products={stockMap} />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
