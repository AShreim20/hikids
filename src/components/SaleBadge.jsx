import React from 'react';
import { Tag } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

// One reusable discount badge, used everywhere a discounted product's image
// is shown (ProductCard, homepage Deals, wishlist, similar/related products,
// search results...) so the design and the "which text to show" decision
// never drifts between pages. Percentage-first ("-20%") per the brief —
// customers see their savings immediately — falling back to a plain
// "SALE"/"خصم" word only when a reliable percentage isn't available.
//
// Not self-positioned: the caller places it (each card's corner layout
// differs slightly, e.g. whether it needs to stack above an out-of-stock
// badge), this only renders the pill itself.
export default function SaleBadge({ percentage, className = '' }) {
  const { t } = useLanguage();
  const hasPct = typeof percentage === 'number' && Number.isFinite(percentage) && percentage > 0;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent text-white text-[11px] font-heading font-extrabold shadow-md shadow-accent/30 ring-2 ring-white/70 ${className}`}
    >
      {hasPct ? (
        // The minus sign is part of the string (not a separate glyph) so it
        // never gets bidi-reordered away from the number in RTL.
        <bdi>{`-${Math.round(percentage)}%`}</bdi>
      ) : (
        <>
          <Tag className="w-3 h-3 shrink-0" />
          {t('sale.badge')}
        </>
      )}
    </span>
  );
}
