import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, ArrowRight } from 'lucide-react';
import { db } from '@/api/entities';
import { useLanguage } from '@/context/LanguageContext';
import { useCategories } from '@/context/CategoryContext';
import { useSiteContent } from '@/context/SiteContentContext';
import { queryKeys } from '@/lib/queryKeys';
import { resolveHomepageDeals, HOMEPAGE_DEALS_KEY, HOMEPAGE_DEALS_DEFAULT } from '@/lib/homepageDeals';
import ProductCard from '@/components/ProductCard';

// Homepage "Deals & Offers" section — up to 6 currently-discounted products,
// either the latest eligible ones or an admin's manual pick (with automatic
// fallback for any pick that's no longer valid; see resolveHomepageDeals).
// Renders nothing at all when there are zero eligible products right now
// (task's explicit "don't show an empty section" rule) rather than an empty
// shell or a loading skeleton that never resolves into content.
//
// Reuses the exact same recent-catalog query Recommendations.jsx already
// fires (same query key) — React Query serves both from one request/cache
// entry instead of two, and ProductCard for the cards themselves, so the
// sale badge/price display here can never drift from any other product
// grid on the site.
export default function HomepageDealsSection() {
  const { t } = useLanguage();
  const { discountPctFor } = useCategories();
  const { content, loaded: contentLoaded } = useSiteContent();

  const { data: recentProducts, isSuccess } = useQuery({
    queryKey: queryKeys.recentProducts(50),
    queryFn: () => db.Product.list('-updated_date', 50),
  });

  if (!isSuccess || !contentLoaded) return null;

  const config = content(HOMEPAGE_DEALS_KEY, HOMEPAGE_DEALS_DEFAULT);
  const deals = resolveHomepageDeals({ products: recentProducts || [], discountPctFor, config });

  if (deals.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-5 sm:px-8 py-8 md:py-10">
      {/* Small playful sale-accent decorations only — the products stay the
          main visual focus, no new color language beyond the existing
          cosmic/accent tokens. */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-cosmic/10 via-transparent to-accent/10 p-5 sm:p-8">
        <div aria-hidden className="absolute -top-10 -end-10 w-40 h-40 rounded-full bg-accent/10 blur-3xl" />
        <div aria-hidden className="absolute -bottom-8 -start-8 w-32 h-32 rounded-full bg-cosmic/10 blur-2xl" />

        <div className="relative flex items-end justify-between flex-wrap gap-4 mb-6 md:mb-8">
          <div>
            <p className="inline-flex items-center gap-1.5 text-sm uppercase tracking-widest text-accent font-bold">
              <Sparkles className="w-4 h-4" /> {t('rec.onSale')}
            </p>
            <h2 className="mt-1.5 font-heading font-extrabold text-3xl md:text-4xl">{t('deals.title')}</h2>
            <p className="mt-2 text-muted-foreground max-w-lg text-sm md:text-base">{t('deals.subtitle')}</p>
          </div>
          <Link
            to="/shop?onSale=true"
            className="squish inline-flex items-center gap-2 h-11 px-5 rounded-full bg-cosmic text-white font-heading font-bold hover:bg-primary transition-colors shrink-0"
          >
            {t('deals.viewAll')} <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </Link>
        </div>

        <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {deals.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
